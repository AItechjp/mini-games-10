(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const cfg = window.SUPABASE_CONFIG || {};
  const canvas = $('#wb-canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  const stateEl = $('#wb-state');
  const roomLabel = $('#wb-room-label');
  const countEl = $('#wb-user-count');
  const createBtn = $('#wb-create');
  const joinForm = $('#wb-join');
  const codeInput = $('#wb-code-input');
  const codeWrap = $('#wb-code-wrap');
  const codeEl = $('#wb-code');
  const copyBtn = $('#wb-copy');
  const clearBtn = $('#wb-clear');
  const fullscreenBtn = $('#wb-fullscreen');
  const overlay = $('#wb-overlay');
  const messageEl = $('#wb-message');

  const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const HISTORY_LIMIT = 5000;
  const SNAPSHOT_CHUNK = 140;
  const tokenKey = 'mg20-whiteboard-token';
  let playerToken = localStorage.getItem(tokenKey);
  if (!playerToken) {
    playerToken = crypto.randomUUID();
    localStorage.setItem(tokenKey, playerToken);
  }

  let client = null;
  let channel = null;
  let roomCode = '';
  let connected = false;
  let syncing = false;
  let drawing = false;
  let activePointer = null;
  let lastPoint = null;
  let color = '#111827';
  let width = 7;
  let history = [];
  let boardRevision = crypto.randomUUID();
  let syncTimer = 0;
  const seenSegments = new Set();
  const incomingSnapshots = new Map();

  function setState(text, state = 'idle', detail = '') {
    stateEl.textContent = text;
    stateEl.dataset.state = state;
    if (detail) roomLabel.textContent = detail;
    updateOverlay();
  }

  function setMessage(text) { messageEl.textContent = text; }

  function updateOverlay() {
    if (!connected) {
      overlay.textContent = '部屋へ接続すると描けます';
      overlay.classList.remove('hidden');
    } else if (syncing) {
      overlay.textContent = '既存のボードを同期中…';
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }

  function normalizeCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  function makeCode() {
    let out = '';
    for (let i = 0; i < 6; i++) out += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    return out;
  }

  function getPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  }

  function drawSegment(seg) {
    if (!seg?.a || !seg?.b) return;
    ctx.save();
    ctx.strokeStyle = seg.color || '#111827';
    ctx.lineWidth = Math.max(1, Number(seg.width || 7) * 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(seg.a[0] * canvas.width, seg.a[1] * canvas.height);
    ctx.lineTo(seg.b[0] * canvas.width, seg.b[1] * canvas.height);
    ctx.stroke();
    ctx.restore();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    history.forEach(drawSegment);
  }

  function remember(seg) {
    if (!seg) return;
    if (seg.id) {
      if (seenSegments.has(seg.id)) return;
      seenSegments.add(seg.id);
    }
    history.push(seg);
    if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
    if (seenSegments.size > HISTORY_LIMIT * 2) {
      seenSegments.clear();
      history.forEach((x) => { if (x.id) seenSegments.add(x.id); });
    }
  }

  async function broadcast(event, payload) {
    if (!channel || !connected) return false;
    try {
      const result = await channel.send({ type:'broadcast', event, payload });
      return result !== 'error';
    } catch (_) {
      setMessage('同期に失敗しました。通信状態を確認してください。');
      return false;
    }
  }

  function updatePresenceCount() {
    if (!channel) return;
    const presence = channel.presenceState();
    let total = 0;
    for (const list of Object.values(presence || {})) total += Array.isArray(list) ? list.length : 0;
    countEl.textContent = String(total);
  }

  function requestSnapshot() {
    if (!connected) return;
    clearTimeout(syncTimer);
    syncing = true;
    incomingSnapshots.clear();
    updateOverlay();
    broadcast('sync-request', { sender:playerToken, requestedAt:Date.now() });
    syncTimer = setTimeout(() => {
      if (!syncing) return;
      syncing = false;
      incomingSnapshots.clear();
      updateOverlay();
      setMessage('同期完了。リアルタイム共有中です。');
    }, 2200);
  }

  function respondSnapshot(payload) {
    if (!payload?.sender || payload.sender === playerToken || !connected) return;
    const requester = payload.sender;
    const snapshotId = crypto.randomUUID();
    const chunks = [];
    for (let i = 0; i < history.length; i += SNAPSHOT_CHUNK) chunks.push(history.slice(i, i + SNAPSHOT_CHUNK));
    if (!chunks.length) chunks.push([]);
    (async () => {
      await broadcast('snapshot-meta', {
        sender:playerToken, to:requester, snapshotId, revision:boardRevision, total:chunks.length
      });
      for (let i = 0; i < chunks.length; i++) {
        await broadcast('snapshot-chunk', {
          sender:playerToken, to:requester, snapshotId, revision:boardRevision,
          index:i, total:chunks.length, segments:chunks[i]
        });
      }
    })();
  }

  function handleSnapshotMeta(payload) {
    if (!syncing || !payload || payload.to !== playerToken || !payload.snapshotId) return;
    if (!incomingSnapshots.size) {
      incomingSnapshots.set(payload.snapshotId, { revision:payload.revision, total:Number(payload.total)||1, chunks:new Map() });
    }
  }

  function handleSnapshotChunk(payload) {
    if (!syncing || !payload || payload.to !== playerToken || !payload.snapshotId) return;
    let snap = incomingSnapshots.get(payload.snapshotId);
    if (!snap) {
      if (incomingSnapshots.size) return;
      snap = { revision:payload.revision, total:Number(payload.total)||1, chunks:new Map() };
      incomingSnapshots.set(payload.snapshotId, snap);
    }
    if (snap.revision !== payload.revision) return;
    snap.chunks.set(Number(payload.index), Array.isArray(payload.segments) ? payload.segments : []);
    if (snap.chunks.size < snap.total) return;

    const merged = [];
    for (let i = 0; i < snap.total; i++) merged.push(...(snap.chunks.get(i) || []));
    clearTimeout(syncTimer);
    boardRevision = snap.revision || crypto.randomUUID();
    history = [];
    seenSegments.clear();
    merged.slice(-HISTORY_LIMIT).forEach(remember);
    syncing = false;
    incomingSnapshots.clear();
    redraw();
    updateOverlay();
    setMessage(`盤面を同期しました。相手の描画がリアルタイムで反映されます（${history.length}線）。`);
  }

  function handleRemoteSegment(payload) {
    if (!payload || payload.sender === playerToken || !payload.segment) return;
    if (syncing) return;
    if (payload.revision !== boardRevision) {
      requestSnapshot();
      return;
    }
    remember(payload.segment);
    drawSegment(payload.segment);
  }

  function handleClear(payload) {
    if (!payload || payload.sender === playerToken) return;
    clearTimeout(syncTimer);
    boardRevision = payload.revision || crypto.randomUUID();
    history = [];
    seenSegments.clear();
    syncing = false;
    incomingSnapshots.clear();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateOverlay();
    setMessage('相手がホワイトボードを全消去しました。');
  }

  async function leaveRoom() {
    clearTimeout(syncTimer);
    connected = false;
    syncing = false;
    drawing = false;
    activePointer = null;
    lastPoint = null;
    if (channel && client) {
      try { await channel.untrack(); } catch (_) {}
      try { await client.removeChannel(channel); } catch (_) {}
    }
    channel = null;
    countEl.textContent = '0';
    updateOverlay();
  }

  async function joinRoom(code, creating = false) {
    const normalized = normalizeCode(code);
    if (normalized.length !== 6) {
      setState('入力エラー', 'error', '6桁の部屋コードを入力してください');
      return;
    }
    if (!cfg.enabled || !cfg.url || !cfg.publishableKey || !window.supabase?.createClient) {
      setState('接続エラー', 'error', 'Supabase設定を読み込めませんでした');
      return;
    }

    await leaveRoom();
    if (!client) {
      client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
        auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }
      });
    }

    roomCode = normalized;
    history = [];
    seenSegments.clear();
    boardRevision = crypto.randomUUID();
    redraw();
    setState('接続中…', 'idle', `ROOM ${roomCode} に接続しています`);
    codeInput.value = roomCode;
    if (creating) {
      codeWrap.classList.remove('hidden');
      codeEl.textContent = roomCode;
    }

    channel = client.channel(`whiteboard:${roomCode.toLowerCase()}`, {
      config: { broadcast:{ self:false }, presence:{ key:playerToken } }
    });

    channel.on('broadcast', { event:'segment' }, ({ payload }) => handleRemoteSegment(payload));
    channel.on('broadcast', { event:'clear' }, ({ payload }) => handleClear(payload));
    channel.on('broadcast', { event:'sync-request' }, ({ payload }) => respondSnapshot(payload));
    channel.on('broadcast', { event:'snapshot-meta' }, ({ payload }) => handleSnapshotMeta(payload));
    channel.on('broadcast', { event:'snapshot-chunk' }, ({ payload }) => handleSnapshotChunk(payload));
    channel.on('presence', { event:'sync' }, updatePresenceCount);
    channel.on('presence', { event:'join' }, updatePresenceCount);
    channel.on('presence', { event:'leave' }, updatePresenceCount);

    try {
      await new Promise((resolve, reject) => {
        let done = false;
        const timeout = setTimeout(() => {
          if (!done) { done = true; reject(new Error('SUBSCRIBE_TIMEOUT')); }
        }, 9000);
        channel.subscribe(async (status, err) => {
          if (status === 'SUBSCRIBED' && !done) {
            done = true; clearTimeout(timeout);
            try {
              await channel.track({ token:playerToken, joinedAt:new Date().toISOString() });
              resolve();
            } catch (e) { reject(e); }
          } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !done) {
            done = true; clearTimeout(timeout); reject(err || new Error(status));
          }
        });
      });

      connected = true;
      setState('接続中', 'connected', `ROOM ${roomCode} — リアルタイム共有中`);
      try { window.history.replaceState(null, '', `whiteboard.html?room=${roomCode}`); } catch (_) {}
      if (creating) {
        syncing = false;
        updateOverlay();
        setMessage('部屋を作成しました。コードを相手に共有してください。描画は即時同期されます。');
      } else {
        requestSnapshot();
        setMessage('既存の盤面を同期しています。完了後すぐ描けます。');
      }
    } catch (_) {
      await leaveRoom();
      setState('接続エラー', 'error', 'Realtimeに接続できませんでした。再読み込みしてお試しください');
    }
  }

  function sendLocalSegment(a, b) {
    if (!connected || syncing) return;
    const seg = {
      id: `${playerToken}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`,
      a:[Number(a.x.toFixed(5)), Number(a.y.toFixed(5))],
      b:[Number(b.x.toFixed(5)), Number(b.y.toFixed(5))],
      color, width
    };
    remember(seg);
    drawSegment(seg);
    broadcast('segment', { sender:playerToken, revision:boardRevision, segment:seg });
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (!connected) return;
    if (syncing) { setMessage('盤面同期が終わるまで少しだけお待ちください。'); return; }
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    drawing = true;
    activePointer = event.pointerId;
    lastPoint = getPoint(event);
    canvas.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!drawing || event.pointerId !== activePointer || !lastPoint) return;
    const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
    for (const e of events) {
      const point = getPoint(e);
      const dx = point.x - lastPoint.x;
      const dy = point.y - lastPoint.y;
      if (dx*dx + dy*dy < 0.0000008) continue;
      sendLocalSegment(lastPoint, point);
      lastPoint = point;
    }
    event.preventDefault();
  });

  function finishPointer(event) {
    if (event.pointerId !== activePointer) return;
    drawing = false;
    activePointer = null;
    lastPoint = null;
    try { canvas.releasePointerCapture?.(event.pointerId); } catch (_) {}
  }
  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  $$('.wb-color').forEach((btn) => btn.addEventListener('click', () => {
    color = btn.dataset.color;
    $$('.wb-color').forEach((x) => x.classList.toggle('active', x === btn));
  }));
  $$('.wb-width').forEach((btn) => btn.addEventListener('click', () => {
    width = Number(btn.dataset.width) || 7;
    $$('.wb-width').forEach((x) => x.classList.toggle('active', x === btn));
  }));

  createBtn.addEventListener('click', () => joinRoom(makeCode(), true));
  joinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    codeWrap.classList.add('hidden');
    joinRoom(codeInput.value, false);
  });
  codeInput.addEventListener('input', () => { codeInput.value = normalizeCode(codeInput.value); });
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      copyBtn.textContent = 'コピー済み';
      setTimeout(() => { copyBtn.textContent = 'コピー'; }, 1200);
    } catch (_) { setMessage(`部屋コード: ${roomCode}`); }
  });

  clearBtn.addEventListener('click', () => {
    if (!connected || syncing) return;
    boardRevision = crypto.randomUUID();
    history = [];
    seenSegments.clear();
    incomingSnapshots.clear();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    broadcast('clear', { sender:playerToken, revision:boardRevision });
    setMessage('全消去を参加者全員へ同期しました。');
  });

  fullscreenBtn.addEventListener('click', async () => {
    try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen(); } catch (_) {}
  });

  window.addEventListener('beforeunload', () => { leaveRoom(); });

  const initialCode = normalizeCode(new URLSearchParams(location.search).get('room'));
  if (initialCode.length === 6) {
    codeInput.value = initialCode;
    joinRoom(initialCode, false);
  } else {
    setState('未接続', 'idle', '部屋を作成、または参加してください');
  }
})();