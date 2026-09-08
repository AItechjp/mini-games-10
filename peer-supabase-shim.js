(() => {
  'use strict';

  const cfg = window.SUPABASE_CONFIG || {};
  const hasConfig = Boolean(cfg.enabled && cfg.url && cfg.publishableKey);
  if (!hasConfig || !window.supabase || typeof window.supabase.createClient !== 'function') return;

  class Emitter {
    constructor() { this.handlers = new Map(); }
    on(name, fn) {
      if (!this.handlers.has(name)) this.handlers.set(name, new Set());
      this.handlers.get(name).add(fn);
      return this;
    }
    off(name, fn) { this.handlers.get(name)?.delete(fn); return this; }
    emit(name, ...args) {
      for (const fn of Array.from(this.handlers.get(name) || [])) {
        try { fn(...args); } catch (err) { setTimeout(() => { throw err; }, 0); }
      }
    }
  }

  const client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  const ROOM_PREFIX = 'mg20-';

  function codeFromPeerId(peerId) {
    const raw = String(peerId || '').toLowerCase();
    if (!raw.startsWith(ROOM_PREFIX)) return '';
    return raw.slice(ROOM_PREFIX.length).toUpperCase();
  }

  function getPlayerToken() {
    const key = 'mg20-player-token';
    let token = localStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID();
      localStorage.setItem(key, token);
    }
    return token;
  }

  function makePeerError(type, message) {
    const err = new Error(message || type);
    err.type = type;
    return err;
  }

  function classifyRpcError(error) {
    const message = String(error?.message || error?.details || error?.hint || '').toUpperCase();
    if (message.includes('ROOM_CODE_TAKEN')) return makePeerError('unavailable-id', 'Room code already exists');
    if (message.includes('ROOM_NOT_FOUND')) return makePeerError('peer-unavailable', 'Room not found');
    if (message.includes('ROOM_FULL')) return makePeerError('peer-unavailable', 'Room is full');
    if (message.includes('INVALID')) return makePeerError('server-error', 'Invalid room request');
    return makePeerError('server-error', error?.message || 'Supabase request failed');
  }

  class SupabaseConnection extends Emitter {
    constructor(owner, code, remoteToken = '') {
      super();
      this.owner = owner;
      this.code = code;
      this.remoteToken = remoteToken;
      this.open = false;
      this.closed = false;
    }

    send(data) {
      if (!this.open || this.closed || !this.owner.channel) return;
      this.owner.channel.send({
        type: 'broadcast',
        event: 'peer-data',
        payload: { sender: this.owner.playerToken, to: this.remoteToken || null, data }
      }).catch(() => {});
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      if (this.owner.channel) {
        this.owner.channel.send({
          type: 'broadcast', event: 'peer-close',
          payload: { sender: this.owner.playerToken, to: this.remoteToken || null }
        }).catch(() => {});
      }
      const wasOpen = this.open;
      this.open = false;
      if (wasOpen) this.emit('close');
    }

    _markOpen(remoteToken) {
      if (this.closed || this.open) return;
      if (remoteToken) this.remoteToken = remoteToken;
      this.open = true;
      setTimeout(() => this.emit('open'), 0);
    }

    _remoteClose() {
      if (this.closed) return;
      this.closed = true;
      const wasOpen = this.open;
      this.open = false;
      if (wasOpen) this.emit('close');
    }

    _error(err) { this.emit('error', err); }
  }

  class SupabasePeer extends Emitter {
    constructor(id) {
      super();
      this.id = id || `sb-${Math.random().toString(36).slice(2, 12)}`;
      this.destroyed = false;
      this.channel = null;
      this.connection = null;
      this.code = codeFromPeerId(id);
      this.role = this.code ? 'host' : 'guest';
      this.playerToken = getPlayerToken();
      this.channelKey = '';
      this._joinTimeout = 0;

      if (this.role === 'host') this._initHost();
      else setTimeout(() => this.emit('open', this.id), 0);
    }

    async _initHost() {
      try {
        const { data, error } = await client.rpc('create_game_room', {
          p_code: this.code,
          p_player_token: this.playerToken
        });
        if (error) throw classifyRpcError(error);
        const row = Array.isArray(data) ? data[0] : data;
        this.channelKey = row?.channel_key || '';
        await this._subscribeRoom('host');
        if (!this.destroyed) this.emit('open', this.id);
      } catch (err) {
        this.emit('error', err?.type ? err : classifyRpcError(err));
      }
    }

    connect(remotePeerId) {
      const code = codeFromPeerId(remotePeerId);
      const connection = new SupabaseConnection(this, code);
      this.connection = connection;
      this.code = code;
      this.role = 'guest';
      this._connectGuest(connection);
      return connection;
    }

    async _connectGuest(connection) {
      try {
        const { data, error } = await client.rpc('join_game_room', {
          p_code: this.code,
          p_player_token: this.playerToken
        });
        if (error) throw classifyRpcError(error);
        const row = Array.isArray(data) ? data[0] : data;
        this.channelKey = row?.channel_key || '';
        await this._subscribeRoom('guest');
        if (this.destroyed || connection.closed) return;
        await this.channel.send({
          type: 'broadcast', event: 'peer-hello',
          payload: { sender: this.playerToken }
        });
        clearTimeout(this._joinTimeout);
        this._joinTimeout = setTimeout(() => {
          if (!connection.open && !connection.closed) {
            const err = makePeerError('peer-unavailable', 'Host is not online');
            connection._error(err);
            this.emit('error', err);
          }
        }, 7000);
      } catch (err) {
        const mapped = err?.type ? err : classifyRpcError(err);
        connection._error(mapped);
        this.emit('error', mapped);
      }
    }

    async _subscribeRoom(role) {
      if (!this.channelKey) throw new Error('CHANNEL_KEY_REQUIRED');
      if (this.channel) {
        try { await client.removeChannel(this.channel); } catch (_) {}
      }

      const topic = `room:${this.channelKey}`;
      const channel = client.channel(topic, {
        config: { broadcast: { self: false }, presence: { key: this.playerToken } }
      });
      this.channel = channel;

      channel.on('broadcast', { event: 'peer-hello' }, ({ payload }) => {
        if (role !== 'host' || !payload?.sender || payload.sender === this.playerToken) return;
        if (!this.connection || this.connection.closed) {
          this.connection = new SupabaseConnection(this, this.code, payload.sender);
          this.emit('connection', this.connection);
        } else {
          this.connection.remoteToken = payload.sender;
        }
        channel.send({
          type: 'broadcast', event: 'peer-ack',
          payload: { sender: this.playerToken, to: payload.sender }
        }).catch(() => {});
        this.connection._markOpen(payload.sender);
      });

      channel.on('broadcast', { event: 'peer-ack' }, ({ payload }) => {
        if (role !== 'guest' || !this.connection || !payload?.sender) return;
        if (payload.to && payload.to !== this.playerToken) return;
        clearTimeout(this._joinTimeout);
        this.connection._markOpen(payload.sender);
      });

      channel.on('broadcast', { event: 'peer-data' }, ({ payload }) => {
        if (!this.connection || !payload || payload.sender === this.playerToken) return;
        if (payload.to && payload.to !== this.playerToken) return;
        this.connection.remoteToken = payload.sender || this.connection.remoteToken;
        this.connection.emit('data', payload.data);
      });

      channel.on('broadcast', { event: 'peer-close' }, ({ payload }) => {
        if (!this.connection || !payload || payload.sender === this.playerToken) return;
        if (payload.to && payload.to !== this.playerToken) return;
        this.connection._remoteClose();
      });

      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (!this.connection?.open) return;
        const remote = this.connection.remoteToken;
        if (!remote) return;
        if ((leftPresences || []).some(item => item.playerToken === remote)) this.connection._remoteClose();
      });

      await new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (!settled) { settled = true; reject(makePeerError('server-error', 'Realtime subscribe timeout')); }
        }, 8000);
        channel.subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED' && !settled) {
            settled = true; clearTimeout(timeout);
            try {
              await channel.track({ playerToken: this.playerToken, role, joinedAt: new Date().toISOString() });
              resolve();
            } catch (e) { reject(e); }
          } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !settled) {
            settled = true; clearTimeout(timeout);
            reject(err || makePeerError('server-error', `Realtime ${status}`));
          }
        });
      });
    }

    async destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      clearTimeout(this._joinTimeout);
      if (this.connection && !this.connection.closed) this.connection.close();
      if (this.channel) {
        try { await this.channel.untrack(); } catch (_) {}
        try { await client.removeChannel(this.channel); } catch (_) {}
      }
      if (this.code) {
        try { await client.rpc('leave_game_room', { p_code: this.code, p_player_token: this.playerToken }); } catch (_) {}
      }
    }
  }

  window.SupabasePeer = SupabasePeer;
  window.SUPABASE_MULTIPLAYER_READY = true;
})();
