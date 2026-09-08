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
      const handlers = Array.from(this.handlers.get(name) || []);
      for (const fn of handlers) {
        try { fn(...args); } catch (err) { setTimeout(() => { throw err; }, 0); }
      }
    }
  }

  const client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  let authPromise = null;
  async function ensureAuth() {
    if (!authPromise) {
      authPromise = (async () => {
        const { data: current, error: currentError } = await client.auth.getSession();
        if (currentError) throw currentError;
        let session = current?.session || null;
        if (!session) {
          const { data, error } = await client.auth.signInAnonymously();
          if (error) throw error;
          session = data?.session || null;
        }
        if (!session?.user?.id) throw new Error('ANONYMOUS_AUTH_FAILED');
        if (client.realtime?.setAuth && session.access_token) {
          client.realtime.setAuth(session.access_token);
        }
        return session;
      })().catch(err => {
        authPromise = null;
        throw err;
      });
    }
    return authPromise;
  }

  const ROOM_PREFIX = 'mg20-';

  function codeFromPeerId(peerId) {
    const raw = String(peerId || '').toLowerCase();
    if (!raw.startsWith(ROOM_PREFIX)) return '';
    return raw.slice(ROOM_PREFIX.length).toUpperCase();
  }

  function makePeerError(type, message) {
    const err = new Error(message || type);
    err.type = type;
    return err;
  }

  function classifyRpcError(error, phase) {
    const message = String(error?.message || error?.details || error?.hint || '').toUpperCase();
    if (message.includes('ROOM_CODE_TAKEN')) return makePeerError('unavailable-id', 'Room code already exists');
    if (message.includes('ROOM_NOT_FOUND')) return makePeerError('peer-unavailable', 'Room not found');
    if (message.includes('ROOM_FULL')) return makePeerError('peer-unavailable', 'Room is full');
    if (message.includes('ROOM_NOT_JOINABLE')) return makePeerError('peer-unavailable', 'Room is not joinable');
    if (message.includes('AUTH') || phase === 'auth') return makePeerError('server-error', 'Supabase anonymous auth failed');
    return makePeerError('server-error', error?.message || 'Supabase request failed');
  }

  class SupabaseConnection extends Emitter {
    constructor(owner, code, remoteUserId = '') {
      super();
      this.owner = owner;
      this.code = code;
      this.remoteUserId = remoteUserId;
      this.open = false;
      this.closed = false;
    }

    send(data) {
      if (!this.open || this.closed || !this.owner.channel) return;
      const session = this.owner.session;
      const sender = session?.user?.id || '';
      this.owner.channel.send({
        type: 'broadcast',
        event: 'peer-data',
        payload: {
          sender,
          to: this.remoteUserId || null,
          data
        }
      }).catch(() => {});
    }

    close() {
      if (this.closed) return;
      this.closed = true;
      const session = this.owner.session;
      const sender = session?.user?.id || '';
      if (this.owner.channel) {
        this.owner.channel.send({
          type: 'broadcast',
          event: 'peer-close',
          payload: { sender, to: this.remoteUserId || null }
        }).catch(() => {});
      }
      const wasOpen = this.open;
      this.open = false;
      if (wasOpen) this.emit('close');
    }

    _markOpen(remoteUserId) {
      if (this.closed || this.open) return;
      if (remoteUserId) this.remoteUserId = remoteUserId;
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
      this.session = null;
      this.channel = null;
      this.connection = null;
      this.code = codeFromPeerId(id);
      this.role = this.code ? 'host' : 'guest';
      this._joinTimeout = 0;

      if (this.role === 'host') this._initHost();
      else this._initGuestIdentity();
    }

    async _initGuestIdentity() {
      try {
        this.session = await ensureAuth();
        if (this.destroyed) return;
        this.emit('open', this.id);
      } catch (err) {
        this.emit('error', classifyRpcError(err, 'auth'));
      }
    }

    async _initHost() {
      try {
        this.session = await ensureAuth();
        if (this.destroyed) return;
        const { error } = await client.rpc('create_game_room', { p_code: this.code });
        if (error) throw classifyRpcError(error, 'create');
        await this._subscribeRoom('host');
        if (this.destroyed) return;
        this.emit('open', this.id);
      } catch (err) {
        this.emit('error', err?.type ? err : classifyRpcError(err, 'create'));
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
        this.session = this.session || await ensureAuth();
        if (this.destroyed || connection.closed) return;
        const { error } = await client.rpc('join_game_room', { p_code: this.code });
        if (error) throw classifyRpcError(error, 'join');
        await this._subscribeRoom('guest');
        if (this.destroyed || connection.closed) return;

        const userId = this.session.user.id;
        await this.channel.send({
          type: 'broadcast',
          event: 'peer-hello',
          payload: { sender: userId }
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
        const mapped = err?.type ? err : classifyRpcError(err, 'join');
        connection._error(mapped);
        this.emit('error', mapped);
      }
    }

    async _subscribeRoom(role) {
      if (!this.session?.user?.id) throw new Error('AUTH_REQUIRED');
      if (!this.code) throw new Error('ROOM_CODE_REQUIRED');
      if (this.channel) {
        try { await client.removeChannel(this.channel); } catch (_) {}
        this.channel = null;
      }

      const userId = this.session.user.id;
      const topic = `room:${this.code}`;
      const channel = client.channel(topic, {
        config: {
          private: true,
          broadcast: { self: false },
          presence: { key: userId }
        }
      });
      this.channel = channel;

      channel.on('broadcast', { event: 'peer-hello' }, ({ payload }) => {
        if (role !== 'host' || !payload?.sender || payload.sender === userId) return;
        if (!this.connection || this.connection.closed) {
          this.connection = new SupabaseConnection(this, this.code, payload.sender);
          this.emit('connection', this.connection);
        } else {
          this.connection.remoteUserId = payload.sender;
        }
        channel.send({
          type: 'broadcast',
          event: 'peer-ack',
          payload: { sender: userId, to: payload.sender }
        }).catch(() => {});
        this.connection._markOpen(payload.sender);
      });

      channel.on('broadcast', { event: 'peer-ack' }, ({ payload }) => {
        if (role !== 'guest' || !this.connection || !payload?.sender) return;
        if (payload.to && payload.to !== userId) return;
        clearTimeout(this._joinTimeout);
        this.connection._markOpen(payload.sender);
      });

      channel.on('broadcast', { event: 'peer-data' }, ({ payload }) => {
        if (!this.connection || !payload || payload.sender === userId) return;
        if (payload.to && payload.to !== userId) return;
        this.connection.remoteUserId = payload.sender || this.connection.remoteUserId;
        this.connection.emit('data', payload.data);
      });

      channel.on('broadcast', { event: 'peer-close' }, ({ payload }) => {
        if (!this.connection || !payload || payload.sender === userId) return;
        if (payload.to && payload.to !== userId) return;
        this.connection._remoteClose();
      });

      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (!this.connection?.open) return;
        const remoteId = this.connection.remoteUserId;
        if (!remoteId) return;
        const remoteLeft = (leftPresences || []).some(item => item.userId === remoteId);
        if (remoteLeft) this.connection._remoteClose();
      });

      await new Promise((resolve, reject) => {
        let settled = false;
        const timeout = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(makePeerError('server-error', 'Realtime subscribe timeout'));
        }, 8000);

        channel.subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED' && !settled) {
            settled = true;
            clearTimeout(timeout);
            try {
              await channel.track({ userId, role, joinedAt: new Date().toISOString() });
              resolve();
            } catch (trackErr) {
              reject(trackErr);
            }
          } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !settled) {
            settled = true;
            clearTimeout(timeout);
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
        this.channel = null;
      }
      if (this.code && this.session?.user?.id) {
        try { await client.rpc('leave_game_room', { p_code: this.code }); } catch (_) {}
      }
    }
  }

  window.SupabasePeer = SupabasePeer;
  window.SUPABASE_MULTIPLAYER_READY = true;
})();
