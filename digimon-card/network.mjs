/**
 * Digimon's application protocol over the existing SupabasePeer adapter.
 * Attach event listeners before connect(). Host connect resolves when its room
 * is ready to share; guest connect resolves after the game handshake.
 *
 * status.detail: { online, phase, side, code, session, error? }
 * message.detail: a host's body, {type:'command', action, revision, id, actor:1},
 *                 or {type:'ack', id}. ACK means receipt, not a legal move.
 * send(body): host only; the controller must supply a redacted guest snapshot.
 * command(action, revision): guest only; returns its ID, or null if unavailable.
 * close(): synchronous, including when the adapter's cleanup RPC is offline.
 * A disconnected match never silently resumes. Make a new room to play again.
 */

const PROTOCOL = 'digimon-1';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_BYTES = 256_000;

function token() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(24);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
}

export function randomCode() {
  const bytes = new Uint8Array(6);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, n => CODE_ALPHABET[n % CODE_ALPHABET.length]).join('');
}

function detailEvent(type, detail) {
  if (typeof CustomEvent === 'function') return new CustomEvent(type, { detail });
  const event = new Event(type);
  Object.defineProperty(event, 'detail', { value: detail });
  return event;
}

function copyBody(body) {
  try {
    const json = JSON.stringify(body);
    if (!json || json.length > MAX_BYTES) return null;
    const copy = JSON.parse(json);
    return copy && typeof copy === 'object' && !Array.isArray(copy) ? copy : null;
  } catch { return null; }
}

function friendlyError(error) {
  const labels = {
    'unavailable-id': 'That room code is already in use. Create a new room.',
    'peer-unavailable': 'The room is unavailable, full, or its host has left.',
  };
  return labels[error?.type] || error?.message || 'The connection was lost.';
}

export class DigimonRoom extends EventTarget {
  constructor(options = {}) {
    super();
    this._Peer = options.Peer || globalThis.SupabasePeer;
    this._retryMs = options.retryMs ?? 700;
    this._heartbeatMs = options.heartbeatMs ?? 2500;
    this._timeoutMs = options.timeoutMs ?? 15000;
    this._connectTimeoutMs = options.connectTimeoutMs ?? 20000;
    this._online = false;
    this._side = '';
    this._code = '';
    this._session = '';
    this._phase = 'closed';
    this._epoch = 0;
    this._bindings = [];
    this._pending = new Map();
    this._peer = null;
    this._connection = null;
  }

  get online() { return this._online; }
  get side() { return this._side; }
  get code() { return this._code; }
  get session() { return this._session; }

  connect(side, code) {
    this._cleanup(new Error('Connection replaced.'));
    this._side = side === 0 ? 'host' : side === 1 ? 'guest' : side;
    this._code = String(code || (this._side === 'host' ? randomCode() : '')).trim().toUpperCase();
    this._session = '';
    this._online = false;
    this._sequence = 0;
    this._receivedSequence = 0;
    this._commandSequence = 0;
    this._receivedCommandSequence = 0;
    this._guestNonce = this._side === 'guest' ? token() : '';
    this._remoteNonce = '';
    this._lastSnapshot = null;
    this._lastSeen = 0;
    this._lastHeartbeat = 0;
    this._handshakeAt = 0;
    this._handshakeStartedAt = 0;
    const epoch = this._epoch;

    return new Promise((resolve, reject) => {
      this._resolveConnect = resolve;
      this._rejectConnect = reject;
      if (!['host', 'guest'].includes(this._side)) {
        this._fail('Choose host or guest.');
        return;
      }
      if (!/^[A-Z0-9]{4,8}$/.test(this._code)) {
        this._fail('Enter a room code of 4–8 letters or numbers.');
        return;
      }
      if (typeof this._Peer !== 'function') {
        this._fail('Online play is unavailable. Reload the page and try again.');
        return;
      }
      this._status('connecting');
      this._setupTimer = setTimeout(() => {
        if (epoch === this._epoch) this._fail('The room connection timed out. Try a new room.');
      }, this._connectTimeoutMs);
      try {
        const peer = new this._Peer(this._side === 'host' ? `mg20-${this._code.toLowerCase()}` : undefined);
        this._peer = peer;
        this._listen(peer, 'error', error => this._fail(friendlyError(error)));
        this._listen(peer, 'disconnected', () => this._fail('The connection was lost. Create a new room to continue.'));
        this._listen(peer, 'close', () => this._fail('The connection was closed.'));
        this._listen(peer, 'connection', connection => {
          if (this._side !== 'host' || this._connection) {
            connection.close();
            return;
          }
          this._attach(connection);
        });
        this._listen(peer, 'open', () => {
          if (this._side === 'host') {
            clearTimeout(this._setupTimer);
            this._setupTimer = null;
            if (!this._connection) this._status('waiting');
            this._settleConnect();
          } else {
            try { this._attach(peer.connect(`mg20-${this._code.toLowerCase()}`)); }
            catch (error) { this._fail(friendlyError(error)); }
          }
        });
      } catch (error) { this._fail(friendlyError(error)); }
    });
  }

  /** Only the authority sends state; the caller is responsible for redaction. */
  send(body) {
    if (!this._online || this._side !== 'host') return false;
    const copy = copyBody(body);
    if (!copy) return false;
    if (this._pending.size >= 128) {
      this._fail('The other player stopped receiving updates. Create a new room.');
      return false;
    }
    const sequence = ++this._sequence;
    const packet = this._packet('body', { sequence, body: copy });
    // A newer complete snapshot supersedes older unacknowledged snapshots.
    if (copy.type === 'state') {
      for (const [key, entry] of this._pending) {
        if (entry.packet.kind === 'body' && entry.packet.body.type === 'state') this._pending.delete(key);
      }
      this._lastSnapshot = packet;
    }
    this._queue(`body:${sequence}`, packet);
    return this._online;
  }

  command(action, revision) {
    if (!this._online || this._side !== 'guest' || this._pending.size) return null;
    if (!Number.isSafeInteger(revision) || revision < 0) return null;
    const copy = copyBody(action);
    if (!copy) return null;
    const sequence = ++this._commandSequence;
    const id = `${this._session}:${sequence}`;
    this._queue(id, this._packet('command', { sequence, id, action: copy, revision }));
    return this._online ? id : null;
  }

  close() {
    this._cleanup(new Error('Room closed.'));
    this._online = false;
    this._status('closed');
  }

  _listen(emitter, type, listener) {
    const epoch = this._epoch;
    const guarded = (...args) => { if (epoch === this._epoch) listener(...args); };
    emitter.on(type, guarded);
    this._bindings.push(() => emitter.off?.(type, guarded));
  }

  _attach(connection) {
    this._connection = connection;
    this._listen(connection, 'data', packet => this._receive(packet));
    this._listen(connection, 'error', error => this._fail(friendlyError(error)));
    this._listen(connection, 'close', () => this._fail('The other player disconnected. Create a new room to continue.'));
    let opened = false;
    const onOpen = () => {
      if (opened) return;
      opened = true;
      if (this._side === 'host') this._session = token();
      this._handshakeStartedAt = Date.now();
      this._lastSeen = Date.now();
      this._status('handshake');
      this._handshake();
      this._ticker = setInterval(() => this._tick(), Math.min(this._retryMs, this._heartbeatMs, 1000));
    };
    this._listen(connection, 'open', onOpen);
    if (connection.open) onOpen();
  }

  _packet(kind, fields = {}) {
    return { protocol: PROTOCOL, kind, session: this._session, ...fields };
  }

  _write(packet) {
    if (!this._connection?.open) return false;
    try { this._connection.send(packet); return true; }
    catch (error) { this._fail(friendlyError(error)); return false; }
  }

  _handshake() {
    this._handshakeAt = Date.now();
    if (this._side === 'guest') {
      this._write(this._packet(this._session ? 'ready' : 'join', { nonce: this._guestNonce }));
    } else if (this._remoteNonce) {
      this._write(this._packet('welcome', { nonce: this._remoteNonce }));
    }
  }

  _receive(packet) {
    if (!packet || typeof packet !== 'object' || Array.isArray(packet) || packet.protocol !== PROTOCOL) {
      this._fail('This room belongs to another game or an incompatible version.');
      return;
    }
    if (packet.kind === 'join' && this._side === 'host') {
      if (typeof packet.nonce !== 'string' || packet.nonce.length < 12 || packet.nonce.length > 128) return;
      if (this._remoteNonce && packet.nonce !== this._remoteNonce) return;
      this._remoteNonce = packet.nonce;
      this._handshake();
      return;
    }
    if (packet.kind === 'welcome' && this._side === 'guest') {
      if (packet.nonce !== this._guestNonce || typeof packet.session !== 'string' || packet.session.length < 12 || packet.session.length > 128) return;
      if (this._session && packet.session !== this._session) return;
      this._session = packet.session;
      this._lastSeen = Date.now();
      this._handshake();
      return;
    }
    if (!this._session || packet.session !== this._session) return;
    if (packet.kind === 'ready' && this._side === 'host') {
      if (!this._remoteNonce || packet.nonce !== this._remoteNonce) return;
      this._lastSeen = Date.now();
      this._write(this._packet('started', { nonce: this._remoteNonce }));
      this._markOnline();
      return;
    }
    if (packet.kind === 'started' && this._side === 'guest') {
      if (packet.nonce !== this._guestNonce) return;
      this._lastSeen = Date.now();
      this._markOnline();
      return;
    }
    // A state may overtake `started` on the broadcast transport. Its session was
    // already verified by welcome, so it also confirms the host's handshake.
    if (!this._online && this._side === 'guest' && packet.kind === 'body') this._markOnline();
    if (!this._online) return;

    if (packet.kind === 'ping' || packet.kind === 'pong') {
      this._lastSeen = Date.now();
      if (packet.kind === 'ping') this._write(this._packet('pong'));
    } else if (packet.kind === 'body' && this._side === 'guest') {
      if (!Number.isSafeInteger(packet.sequence) || packet.sequence < 1) return;
      const body = copyBody(packet.body);
      if (!body) return;
      this._lastSeen = Date.now();
      this._write(this._packet('body-ack', { sequence: packet.sequence }));
      if (packet.sequence <= this._receivedSequence) return;
      this._receivedSequence = packet.sequence;
      this.dispatchEvent(detailEvent('message', body));
    } else if (packet.kind === 'command' && this._side === 'host') {
      if (!Number.isSafeInteger(packet.sequence) || packet.sequence < 1 || packet.id !== `${this._session}:${packet.sequence}`) return;
      if (!Number.isSafeInteger(packet.revision) || packet.revision < 0) return;
      const action = copyBody(packet.action);
      if (!action) return;
      this._lastSeen = Date.now();
      this._write(this._packet('command-ack', { id: packet.id }));
      if (packet.sequence <= this._receivedCommandSequence) {
        if (this._lastSnapshot) this._write(this._lastSnapshot);
        return;
      }
      this._receivedCommandSequence = packet.sequence;
      this.dispatchEvent(detailEvent('message', {
        type: 'command', action, revision: packet.revision, id: packet.id, actor: 1,
      }));
    } else if (packet.kind === 'body-ack' && this._side === 'host') {
      if (this._pending.delete(`body:${packet.sequence}`)) this._lastSeen = Date.now();
    } else if (packet.kind === 'command-ack' && this._side === 'guest') {
      if (this._pending.delete(packet.id)) {
        this._lastSeen = Date.now();
        this.dispatchEvent(detailEvent('message', { type: 'ack', id: packet.id }));
      }
    }
  }

  _queue(key, packet) {
    const now = Date.now();
    this._pending.set(key, { packet, startedAt: now, sentAt: now });
    this._write(packet);
  }

  _tick() {
    const now = Date.now();
    if (!this._online) {
      if (now - this._handshakeStartedAt >= this._connectTimeoutMs) {
        this._fail('The game handshake timed out. Both players should reload and create a new room.');
      } else if (now - this._handshakeAt >= this._retryMs) this._handshake();
      return;
    }
    if (now - this._lastSeen >= this._timeoutMs) {
      this._fail('The other player stopped responding. Create a new room to continue.');
      return;
    }
    for (const entry of this._pending.values()) {
      if (now - entry.startedAt >= this._timeoutMs) {
        this._fail('A game update could not be confirmed. Create a new room to continue.');
        return;
      }
      if (now - entry.sentAt >= this._retryMs) {
        entry.sentAt = now;
        if (!this._write(entry.packet)) return;
      }
    }
    if (now - this._lastHeartbeat >= this._heartbeatMs) {
      this._lastHeartbeat = now;
      this._write(this._packet('ping'));
    }
  }

  _markOnline() {
    if (this._online) return;
    clearTimeout(this._setupTimer);
    this._setupTimer = null;
    this._online = true;
    this._status('online');
    this._settleConnect();
  }

  _settleConnect() {
    const resolve = this._resolveConnect;
    this._resolveConnect = null;
    this._rejectConnect = null;
    resolve?.(this);
  }

  _status(phase, error) {
    this._phase = phase;
    this.dispatchEvent(detailEvent('status', {
      online: this._online, phase, side: this._side, code: this._code,
      session: this._session, ...(error ? { error } : {}),
    }));
  }

  _fail(message) {
    if (!this._peer && !this._rejectConnect && this._phase === 'disconnected') return;
    this._cleanup(new Error(message));
    this._online = false;
    this._status('disconnected', message);
  }

  _cleanup(error) {
    this._epoch++;
    clearTimeout(this._setupTimer);
    clearInterval(this._ticker);
    this._setupTimer = null;
    this._ticker = null;
    for (const remove of this._bindings.splice(0)) remove();
    this._pending.clear();
    const reject = this._rejectConnect;
    this._resolveConnect = null;
    this._rejectConnect = null;
    reject?.(error);
    const connection = this._connection;
    const peer = this._peer;
    this._connection = null;
    this._peer = null;
    try { connection?.close(); } catch { /* Already closed. */ }
    try { Promise.resolve(peer?.destroy()).catch(() => {}); } catch { /* Offline cleanup. */ }
  }
}
