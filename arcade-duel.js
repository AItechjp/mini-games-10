(() => {
  'use strict';

  const $ = s => document.querySelector(s);
  const gameId = document.body.dataset.gameId;
  const gameDef = window.ARCADE_GAME;
  if (!gameId || !gameDef || typeof gameDef.create !== 'function') return;

  const canvas = $('#arcade-canvas');
  const timeEl = $('#arcade-time');
  const scoreEl = $('#arcade-score');
  const rivalEl = $('#arcade-rival');
  const bestEl = $('#arcade-best');
  const rivalHud = $('#rival-hud');
  const overlay = $('#arcade-overlay');
  const overlayTitle = overlay.querySelector('h2');
  const overlayMessage = $('#overlay-message');
  const startBtn = $('#arcade-start');
  const toastEl = $('#arcade-toast');
  const lobby = $('#arcade-lobby');
  const modeButtons = Array.from(document.querySelectorAll('[data-arcade-mode]'));
  const createBtn = $('#create-duel');
  const joinBtn = $('#join-duel');
  const joinInput = $('#join-duel-code');
  const createdRoom = $('#created-room');
  const roomCodeEl = $('#duel-room-code');
  const copyBtn = $('#copy-duel-code');
  const netBadge = $('#network-badge');
  const duelStatus = $('#duel-status');
  const duelDetail = $('#duel-detail');
  const controlsRoot = $('#mobile-controls');

  const cfg = window.SUPABASE_CONFIG || {};
  const hasSupabase = Boolean(cfg.enabled && cfg.url && cfg.publishableKey && window.supabase?.createClient);
  const client = hasSupabase ? window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }) : null;

  const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const ROUND_MS = 20000;
  const START_DELAY_MS = 2300;
  const makeUuid = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=crypto.getRandomValues(new Uint8Array(1))[0]&15,v=c==='x'?r:(r&3)|8;return v.toString(16);});
  const playerToken = makeUuid();
  const bestKey = `arcade-best-${gameId}`;

  let mode = new URLSearchParams(location.search).get('mode') === 'online' ? 'online' : 'solo';
  let engine = null;
  let localScore = 0;
  let rivalScore = 0;
  let running = false;
  let roundTimer = 0;
  let timeRaf = 0;
  let roundStartedAt = 0;
  let currentSeed = 1;
  let finalStats = {};

  let role = null;
  let roomCode = '';
  let channelKey = '';
  let channel = null;
  let connected = false;
  let remoteToken = '';
  let clockOffset = 0;
  let bestRtt = Infinity;
  let syncInterval = 0;
  let scoreSendTimer = 0;
  let pendingScore = null;
  let rivalFinished = false;
  let rivalStats = {};

  const storageGet = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const storageSet = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  const getBest = () => Number(storageGet(bestKey) || 0);
  const setBest = score => { if (score > getBest()) storageSet(bestKey, String(score)); };

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 520);
  }

  function setScore(value) {
    localScore = Math.max(0, Math.round(Number(value) || 0));
    scoreEl.textContent = String(localScore);
    if (mode === 'online' && connected && running) queueScore(localScore);
  }

  function queueScore(score) {
    pendingScore = score;
    if (scoreSendTimer) return;
    scoreSendTimer = setTimeout(() => {
      scoreSendTimer = 0;
      if (pendingScore !== null) send('score', { score: pendingScore });
      pendingScore = null;
    }, 75);
  }

  function createEngine() {
    if (engine) engine.destroy?.();
    engine = gameDef.create({ canvas, controlsRoot, onScore: setScore, onToast: toast });
  }

  function setNetworkState(state, title, detail = '') {
    netBadge.dataset.state = state;
    netBadge.textContent = state === 'connected' ? '接続中' : state === 'waiting' ? '待機中' : state === 'error' ? 'エラー' : '未接続';
    duelStatus.textContent = title;
    duelDetail.textContent = detail;
  }

  function setOverlay(title, html, buttonText, enabled = true) {
    overlayTitle.textContent = title;
    overlayMessage.innerHTML = html;
    startBtn.textContent = buttonText;
    startBtn.disabled = !enabled;
    overlay.classList.remove('hidden');
  }

  function makeRoomCode() {
    let out = '';
    for (let i = 0; i < 6; i++) out += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    return out;
  }

  function normalizeCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  async function leaveRoom() {
    clearInterval(syncInterval);
    syncInterval = 0;
    connected = false;
    remoteToken = '';
    if (channel && client) {
      try { await channel.untrack(); } catch (_) {}
      try { await client.removeChannel(channel); } catch (_) {}
    }
    channel = null;
    if (roomCode && client) {
      try { await client.rpc('leave_game_room', { p_code: roomCode, p_player_token: playerToken }); } catch (_) {}
    }
    role = null;
    roomCode = '';
    channelKey = '';
    createdRoom.classList.add('hidden');
    roomCodeEl.textContent = '------';
    rivalScore = 0;
    rivalEl.textContent = '0';
    rivalFinished = false;
    rivalStats = {};
  }

  async function subscribeRoom(kind, key) {
    if (!client) throw new Error('SUPABASE_UNAVAILABLE');
    if (channel) {
      try { await client.removeChannel(channel); } catch (_) {}
    }
    channel = client.channel(`duel:${key}`, {
      config: { broadcast: { self: false }, presence: { key: playerToken } }
    });

    channel.on('broadcast', { event: 'hello' }, ({ payload }) => {
      if (kind !== 'host' || !payload?.sender || payload.sender === playerToken) return;
      remoteToken = payload.sender;
      connected = true;
      send('ack', { to: remoteToken });
      setNetworkState('connected', '対戦相手が参加しました！', 'ゲーム開始ボタンで同期スタートできます。');
      startBtn.disabled = false;
      startBtn.textContent = '対戦スタート';
    });

    channel.on('broadcast', { event: 'ack' }, ({ payload }) => {
      if (kind !== 'guest' || !payload?.sender) return;
      if (payload.to && payload.to !== playerToken) return;
      remoteToken = payload.sender;
      connected = true;
      setNetworkState('connected', 'ホストと接続しました！', 'ホストが開始すると自動で同時スタートします。');
      setOverlay(gameDef.title, '接続完了。ホストの開始を待っています。', 'ホストの開始待ち', false);
      startClockSync();
    });

    channel.on('broadcast', { event: 'ping' }, ({ payload }) => {
      if (kind !== 'host' || !payload?.t0) return;
      send('pong', { to: payload.sender, t0: payload.t0, hostNow: Date.now() });
    });

    channel.on('broadcast', { event: 'pong' }, ({ payload }) => {
      if (kind !== 'guest' || (payload.to && payload.to !== playerToken)) return;
      const now = Date.now();
      const t0 = Number(payload.t0) || now;
      const rtt = now - t0;
      if (rtt >= 0 && rtt < bestRtt) {
        bestRtt = rtt;
        clockOffset = Number(payload.hostNow || now) - (t0 + now) / 2;
      }
    });

    channel.on('broadcast', { event: 'start' }, ({ payload }) => {
      if (!payload?.seed || !payload?.at) return;
      scheduleOnlineStart(Number(payload.seed), Number(payload.at));
    });

    channel.on('broadcast', { event: 'score' }, ({ payload }) => {
      if (payload?.sender === playerToken) return;
      rivalScore = Math.max(0, Math.round(Number(payload?.score) || 0));
      rivalEl.textContent = String(rivalScore);
      updateResultIfVisible();
    });

    channel.on('broadcast', { event: 'finish' }, ({ payload }) => {
      if (payload?.sender === playerToken) return;
      rivalFinished = true;
      rivalScore = Math.max(0, Math.round(Number(payload?.score) || 0));
      rivalStats = payload?.stats || {};
      rivalEl.textContent = String(rivalScore);
      updateResultIfVisible();
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      if (!connected || !remoteToken) return;
      const left = (leftPresences || []).some(x => x.playerToken === remoteToken || x.presence_ref === remoteToken);
      if (left) {
        connected = false;
        setNetworkState('error', '対戦相手との接続が切れました', '同じ部屋への再参加か、新しい部屋を作ってください。');
        if (running) toast('RIVAL DISCONNECTED');
      }
    });

    await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error('REALTIME_TIMEOUT'));
      }, 9000);
      channel.subscribe(async (status, error) => {
        if (status === 'SUBSCRIBED' && !settled) {
          settled = true;
          clearTimeout(timer);
          try {
            await channel.track({ playerToken, role: kind, gameId, joinedAt: Date.now() });
          } catch (_) {}
          resolve();
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !settled) {
          settled = true;
          clearTimeout(timer);
          reject(error || new Error(status));
        }
      });
    });
  }

  function send(event, data = {}) {
    if (!channel) return;
    channel.send({ type: 'broadcast', event, payload: { sender: playerToken, ...data } }).catch(() => {});
  }

  function startClockSync() {
    clearInterval(syncInterval);
    bestRtt = Infinity;
    let sent = 0;
    const ping = () => {
      if (!connected || sent >= 7) { clearInterval(syncInterval); return; }
      sent++;
      send('ping', { t0: Date.now() });
    };
    ping();
    syncInterval = setInterval(ping, 170);
  }

  async function createRoom(attempt = 0) {
    if (!client) {
      setNetworkState('error', 'Supabaseに接続できません', 'ページを再読み込みしてください。');
      return;
    }
    await leaveRoom();
    role = 'host';
    roomCode = makeRoomCode();
    setNetworkState('waiting', '部屋を作成しています…', 'Supabaseに登録中です。');
    const { data, error } = await client.rpc('create_duel_room', { p_code: roomCode, p_player_token: playerToken, p_game_id: gameId });
    if (error) {
      if (String(error.message).includes('ROOM_CODE_TAKEN') && attempt < 5) return createRoom(attempt + 1);
      setNetworkState('error', '部屋を作れませんでした', '通信環境を確認してもう一度試してください。');
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    channelKey = row?.channel_key || '';
    try {
      await subscribeRoom('host', channelKey);
      createdRoom.classList.remove('hidden');
      roomCodeEl.textContent = roomCode;
      setNetworkState('waiting', '相手の参加を待っています', `部屋コード ${roomCode} を相手に送ってください。`);
      setOverlay(gameDef.title, `部屋 <strong>${roomCode}</strong> を作成しました。相手の参加を待っています。`, '相手の参加待ち', false);
    } catch (_) {
      setNetworkState('error', 'Realtime接続に失敗しました', 'ページを再読み込みしてもう一度試してください。');
    }
  }

  async function joinRoom() {
    const code = normalizeCode(joinInput.value);
    joinInput.value = code;
    if (code.length !== 6) {
      setNetworkState('error', '部屋コードを確認してください', '6桁の英数字を入力してください。');
      return;
    }
    if (!client) return;
    await leaveRoom();
    role = 'guest';
    roomCode = code;
    setNetworkState('waiting', '部屋を探しています…', code);
    const { data, error } = await client.rpc('join_duel_room', { p_code: code, p_player_token: playerToken, p_game_id: gameId });
    if (error) {
      const msg = String(error.message || '');
      const detail = msg.includes('ROOM_NOT_FOUND') ? 'その部屋は見つかりません。' : msg.includes('ROOM_FULL') ? 'その部屋は2人参加済みです。' : msg.includes('WRONG_GAME') ? '別のゲーム用の部屋コードです。' : '接続に失敗しました。';
      setNetworkState('error', '参加できませんでした', detail);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    channelKey = row?.channel_key || '';
    try {
      await subscribeRoom('guest', channelKey);
      setNetworkState('waiting', 'ホストへ接続しています…', `部屋 ${roomCode}`);
      send('hello');
      setTimeout(() => { if (!connected) setNetworkState('error', 'ホストが応答しません', 'ホスト側で部屋が開かれているか確認してください。'); }, 7000);
    } catch (_) {
      setNetworkState('error', 'Realtime接続に失敗しました', 'ページを再読み込みしてもう一度試してください。');
    }
  }

  function scheduleOnlineStart(seed, hostAt) {
    if (running) return;
    currentSeed = seed >>> 0;
    rivalFinished = false;
    rivalStats = {};
    rivalScore = 0;
    rivalEl.textContent = '0';
    const localAt = role === 'guest' ? hostAt - clockOffset : hostAt;
    const tick = () => {
      const left = localAt - Date.now();
      if (left <= 0) {
        beginRound(currentSeed);
        return;
      }
      const n = Math.max(1, Math.ceil(left / 700));
      setOverlay('READY', `<div style="font-size:72px;font-weight:950">${n}</div>`, '開始待ち', false);
      requestAnimationFrame(tick);
    };
    tick();
  }

  function startSoloCountdown() {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    const at = Date.now() + 1700;
    const tick = () => {
      const left = at - Date.now();
      if (left <= 0) { beginRound(seed); return; }
      const n = Math.max(1, Math.ceil(left / 550));
      setOverlay('READY', `<div style="font-size:72px;font-weight:950">${n}</div>`, '開始待ち', false);
      requestAnimationFrame(tick);
    };
    tick();
  }

  function hostStartOnline() {
    if (role !== 'host' || !connected) return;
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    const at = Date.now() + START_DELAY_MS;
    send('start', { seed, at });
    scheduleOnlineStart(seed, at);
  }

  function beginRound(seed) {
    cancelAnimationFrame(timeRaf);
    clearTimeout(roundTimer);
    running = true;
    localScore = 0;
    rivalScore = 0;
    scoreEl.textContent = '0';
    rivalEl.textContent = '0';
    timeEl.textContent = '20.0';
    overlay.classList.add('hidden');
    roundStartedAt = performance.now();
    createEngine();
    engine.start(seed >>> 0);

    const tick = () => {
      if (!running) return;
      const elapsed = performance.now() - roundStartedAt;
      const left = Math.max(0, ROUND_MS - elapsed);
      timeEl.textContent = (left / 1000).toFixed(1);
      if (left <= 0) { finishRound(); return; }
      timeRaf = requestAnimationFrame(tick);
    };
    timeRaf = requestAnimationFrame(tick);
    roundTimer = setTimeout(finishRound, ROUND_MS + 80);
  }

  function finishRound() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(timeRaf);
    clearTimeout(roundTimer);
    timeEl.textContent = '0.0';
    finalStats = engine?.stop?.() || {};
    setBest(localScore);
    bestEl.textContent = String(getBest());
    if (mode === 'online') send('finish', { score: localScore, stats: finalStats });
    showResult();
  }

  function resultHeadline() {
    if (mode === 'solo') return localScore >= getBest() && localScore > 0 ? 'NEW BEST!' : 'FINISH!';
    if (!rivalFinished) return '結果待ち…';
    if (localScore > rivalScore) return 'YOU WIN!';
    if (localScore < rivalScore) return 'YOU LOSE';
    return 'DRAW';
  }

  function statsText(stats) {
    if (!stats || typeof stats !== 'object') return '';
    const parts = [];
    if (Number.isFinite(stats.hits)) parts.push(`HIT ${stats.hits}`);
    if (Number.isFinite(stats.shots)) parts.push(`SHOT ${stats.shots}`);
    if (Number.isFinite(stats.combo)) parts.push(`MAX COMBO ${stats.combo}`);
    if (Number.isFinite(stats.kills)) parts.push(`KILL ${stats.kills}`);
    return parts.join(' / ');
  }

  function showResult() {
    const solo = mode === 'solo';
    const myStats = statsText(finalStats);
    const vs = solo ? `<div class="arcade-result-score">${localScore}</div><p>BEST ${getBest()}${myStats ? `<br>${myStats}` : ''}</p>` : `<div class="arcade-result-vs"><span>YOU<strong>${localScore}</strong></span><b>VS</b><span>RIVAL<strong>${rivalScore}</strong></span></div><p>${myStats || '20秒バトル終了'}</p>`;
    setOverlay(resultHeadline(), vs, solo ? 'もう一回' : role === 'host' ? '再戦する' : 'ホストの再戦待ち', solo || (role === 'host' && connected));
    overlay.dataset.result = '1';
  }

  function updateResultIfVisible() {
    if (overlay.dataset.result === '1') showResult();
  }

  function resetForMode() {
    if (running) {
      running = false;
      cancelAnimationFrame(timeRaf);
      clearTimeout(roundTimer);
      engine?.stop?.();
    }
    overlay.dataset.result = '';
    localScore = 0;
    rivalScore = 0;
    scoreEl.textContent = '0';
    rivalEl.textContent = '0';
    timeEl.textContent = '20.0';
    bestEl.textContent = String(getBest());
    lobby.classList.toggle('hidden', mode !== 'online');
    rivalHud.classList.toggle('hidden-hud', mode !== 'online');
    modeButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.arcadeMode === mode));
    const url = new URL(location.href);
    url.searchParams.set('mode', mode);
    history.replaceState(null, '', url);
    if (mode === 'solo') {
      setOverlay(gameDef.title, gameDef.instructions, '20秒スタート', true);
    } else if (!hasSupabase) {
      setOverlay(gameDef.title, 'Supabaseを読み込めませんでした。通信環境を確認してください。', '対戦を利用できません', false);
      setNetworkState('error', 'Supabaseを読み込めません', 'ページを再読み込みしてください。');
    } else {
      setOverlay(gameDef.title, '部屋を作るか参加すると、ここから20秒対戦を開始できます。', '接続待ち', false);
      setNetworkState('idle', '部屋を作るか参加してください。', 'ログインは不要です。');
    }
  }

  startBtn.addEventListener('click', () => {
    overlay.dataset.result = '';
    if (mode === 'solo') startSoloCountdown();
    else if (role === 'host' && connected) hostStartOnline();
  });

  modeButtons.forEach(btn => btn.addEventListener('click', async () => {
    const next = btn.dataset.arcadeMode;
    if (!next || next === mode) return;
    await leaveRoom();
    mode = next;
    resetForMode();
  }));

  createBtn?.addEventListener('click', () => createRoom());
  joinBtn?.addEventListener('click', () => joinRoom());
  joinInput?.addEventListener('input', () => { joinInput.value = normalizeCode(joinInput.value); });
  joinInput?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); joinRoom(); } });
  copyBtn?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(roomCode); copyBtn.textContent = 'コピーしました'; setTimeout(() => copyBtn.textContent = 'コードをコピー', 1000); } catch (_) {}
  });

  window.addEventListener('beforeunload', () => {
    if (channel) { try { channel.untrack(); } catch (_) {} }
  });

  createEngine();
  bestEl.textContent = String(getBest());
  resetForMode();
})();
