(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

  const grid = $('#game-grid');
  const play = $('#play');
  const stage = $('#game-stage');
  const timeEl = $('#time-value');
  const scoreEl = $('#score-value');
  const rivalEl = $('#rival-value');
  const msgEl = $('#game-message');
  const titleEl = $('#play-title');
  const numberEl = $('#play-number');
  const backBtn = $('#back-btn');
  const restartBtn = $('#restart-btn');

  const createRoomBtn = $('#create-room-btn');
  const joinForm = $('#join-form');
  const roomInput = $('#room-code-input');
  const roomCreated = $('#room-created');
  const roomCodeDisplay = $('#room-code-display');
  const copyRoomBtn = $('#copy-room-btn');
  const connectionStatus = $('#connection-status');
  const connectionDetail = $('#connection-detail');
  const connectionBadge = $('#connection-badge');

  const ROUND_MS = 20000;
  const START_DELAY_MS = 2200;
  const ROOM_PREFIX = 'mg20-';
  const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const games = [
    { id: 'target', title: 'ターゲットラッシュ', desc: '現れるターゲットを素早くタップ。反射神経で勝負。' },
    { id: 'tap', title: '20秒連打', desc: '20秒間ひたすら連打。純粋なスピード勝負。' },
    { id: 'numbers', title: 'ナンバーハント', desc: '1から25まで順番に探してタップ。正確さと速さを競う。' },
    { id: 'stroop', title: 'カラー判断', desc: '文字の意味ではなく表示色を答える判断ゲーム。' },
    { id: 'memory', title: 'メモリーフラッシュ', desc: '光った順番を記憶して再現。成功するほど高得点。' },
    { id: 'math', title: '計算ブリッツ', desc: '20秒で計算問題をどこまで解けるか。' },
    { id: 'catch', title: 'スターキャッチ', desc: '星を取って爆弾を避ける。ミスは減点。' },
    { id: 'reaction', title: 'リアクション', desc: 'GOになった瞬間にタップ。反応速度で得点。' },
    { id: 'typing', title: 'タイピングスプリント', desc: '表示された英単語を20秒で何語入力できるか。' },
    { id: 'higher', title: 'HIGH or LOW', desc: '次の数字が高いか低いかを予想。連続正解で加点。' }
  ];

  let peer = null;
  let conn = null;
  let role = null;
  let roomCode = '';
  let connected = false;
  let clockOffset = 0;
  let bestSyncRtt = Infinity;
  let syncTimer = 0;

  let cleanup = () => {};
  let activeId = null;
  let roundSeed = 1;
  let rng = Math.random;
  let localScore = 0;
  let rivalScore = 0;
  let localFinished = false;
  let rivalFinished = false;
  let localExtra = '';
  let rivalExtra = '';
  let roundRunning = false;
  let scoreSendTimer = 0;
  let pendingScore = null;

  const roleName = () => role === 'host' ? 'PLAYER 1 / HOST' : role === 'guest' ? 'PLAYER 2 / GUEST' : '';

  function makeRoomCode() {
    let out = '';
    for (let i = 0; i < 6; i++) out += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
    return out;
  }

  function normalizeRoomCode(value) {
    return String(value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 6);
  }

  function setConnectionUI(status, detail = '', state = 'idle') {
    connectionStatus.textContent = status;
    connectionDetail.textContent = detail;
    connectionBadge.textContent = state === 'connected' ? '接続中' : state === 'waiting' ? '待機中' : state === 'error' ? 'エラー' : '未接続';
    connectionBadge.dataset.state = state;
  }

  function destroyPeer() {
    clearInterval(syncTimer);
    syncTimer = 0;
    if (conn) {
      try { conn.close(); } catch (_) {}
    }
    conn = null;
    if (peer) {
      try { peer.destroy(); } catch (_) {}
    }
    peer = null;
    connected = false;
    role = null;
    roomCode = '';
    clockOffset = 0;
    bestSyncRtt = Infinity;
  }

  function peerOptions() {
    return {
      debug: 0,
      config: {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        sdpSemantics: 'unified-plan'
      }
    };
  }

  function createRoom() {
    destroyPeer();
    role = 'host';
    roomCode = makeRoomCode();
    const peerId = ROOM_PREFIX + roomCode.toLowerCase();
    roomCreated.classList.remove('hidden');
    roomCodeDisplay.textContent = roomCode;
    setConnectionUI('部屋を作成しています…', '接続サーバーに登録中です。', 'waiting');

    peer = new Peer(peerId, peerOptions());
    peer.on('open', () => {
      setConnectionUI('相手の参加を待っています', `部屋コード ${roomCode} を相手に送ってください。`, 'waiting');
    });
    peer.on('connection', incoming => {
      if (conn && conn.open) {
        incoming.close();
        return;
      }
      attachConnection(incoming);
    });
    peer.on('error', err => {
      if (err && err.type === 'unavailable-id') {
        setTimeout(createRoom, 100);
        return;
      }
      setConnectionUI('接続エラー', humanPeerError(err), 'error');
    });
  }

  function joinRoom(code) {
    const normalized = normalizeRoomCode(code);
    if (normalized.length !== 6) {
      setConnectionUI('部屋コードを確認してください', '6桁の英数字を入力してください。', 'error');
      return;
    }

    destroyPeer();
    role = 'guest';
    roomCode = normalized;
    roomCreated.classList.add('hidden');
    setConnectionUI('部屋に接続しています…', `部屋 ${roomCode} を探しています。`, 'waiting');

    peer = new Peer(undefined, peerOptions());
    peer.on('open', () => {
      const outgoing = peer.connect(ROOM_PREFIX + roomCode.toLowerCase(), { reliable: true, serialization: 'json' });
      attachConnection(outgoing);
    });
    peer.on('error', err => {
      setConnectionUI('接続エラー', humanPeerError(err), 'error');
    });
  }

  function humanPeerError(err) {
    const type = err && err.type ? err.type : '';
    if (type === 'peer-unavailable') return 'その部屋が見つかりません。コードを確認してください。';
    if (type === 'network' || type === 'server-error' || type === 'socket-error') return 'ネットワークに接続できませんでした。通信環境を確認してください。';
    if (type === 'webrtc') return 'WebRTC接続に失敗しました。別の回線で試すと接続できる場合があります。';
    return '接続に失敗しました。もう一度試してください。';
  }

  function attachConnection(connection) {
    conn = connection;

    conn.on('open', () => {
      connected = true;
      setConnectionUI('対戦相手と接続しました！', `${roleName()} / 部屋 ${roomCode}。ホストがゲームを選択してください。`, 'connected');
      renderCards();
      if (role === 'guest') startClockSync();
      safeSend({ type: 'hello', role });
    });

    conn.on('data', data => handleNetworkMessage(data));

    conn.on('close', () => {
      connected = false;
      roundRunning = false;
      cleanup();
      setConnectionUI('対戦相手との接続が切れました', 'もう一度部屋を作るか、同じコードで接続し直してください。', 'error');
      msgEl.textContent = '対戦相手との接続が切れました。';
      renderCards();
    });

    conn.on('error', () => {
      setConnectionUI('P2P接続でエラーが発生しました', '通信環境を変えて再接続してください。', 'error');
    });
  }

  function safeSend(payload) {
    if (!conn || !conn.open) return;
    try { conn.send(payload); } catch (_) {}
  }

  function startClockSync() {
    clearInterval(syncTimer);
    bestSyncRtt = Infinity;
    let count = 0;
    const ping = () => {
      if (!connected || !conn || !conn.open || count >= 7) {
        clearInterval(syncTimer);
        return;
      }
      count++;
      safeSend({ type: 'ping', t0: Date.now() });
    };
    ping();
    syncTimer = setInterval(ping, 180);
  }

  function handleNetworkMessage(data) {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'ping' && role === 'host') {
      safeSend({ type: 'pong', t0: Number(data.t0) || 0, th: Date.now() });
      return;
    }

    if (data.type === 'pong' && role === 'guest') {
      const now = Date.now();
      const t0 = Number(data.t0) || now;
      const th = Number(data.th) || now;
      const rtt = now - t0;
      if (rtt >= 0 && rtt < bestSyncRtt) {
        bestSyncRtt = rtt;
        clockOffset = th - (t0 + now) / 2;
      }
      return;
    }

    if (data.type === 'select' && role === 'guest') {
      openGame(String(data.id || ''), true);
      return;
    }

    if (data.type === 'back' && role === 'guest') {
      closeGame(false);
      return;
    }

    if (data.type === 'start') {
      if (!activeId || data.id !== activeId) openGame(data.id, true);
      scheduleRound(Number(data.at), Number(data.seed) || 1);
      return;
    }

    if (data.type === 'score') {
      rivalScore = Number.isFinite(Number(data.score)) ? Number(data.score) : 0;
      rivalEl.textContent = String(rivalScore);
      return;
    }

    if (data.type === 'finish') {
      rivalScore = Number.isFinite(Number(data.score)) ? Number(data.score) : 0;
      rivalExtra = String(data.extra || '');
      rivalFinished = true;
      rivalEl.textContent = String(rivalScore);
      if (localFinished) renderBattleResult();
    }
  }

  function renderCards() {
    grid.innerHTML = games.map((g, i) => {
      let buttonText = '先にオンライン接続';
      let disabled = 'disabled';
      if (connected && role === 'host') {
        buttonText = 'このゲームで対戦';
        disabled = '';
      } else if (connected && role === 'guest') {
        buttonText = 'ホストが選択します';
      }
      return `<article class="game-card">
        <span class="num">GAME ${String(i + 1).padStart(2, '0')}</span>
        <h3>${g.title}</h3>
        <p>${g.desc}</p>
        <div class="best">ONLINE / 2 PLAYERS / 20 SEC</div>
        <button type="button" data-play="${g.id}" ${disabled}>${buttonText}</button>
      </article>`;
    }).join('');

    $$('[data-play]', grid).forEach(btn => {
      btn.addEventListener('click', () => {
        if (!connected || role !== 'host') return;
        const id = btn.dataset.play;
        safeSend({ type: 'select', id });
        openGame(id, false);
      });
    });
  }

  function openGame(id, fromRemote = false) {
    const game = games.find(g => g.id === id);
    if (!game) return;
    cleanup();
    cleanup = () => {};
    activeId = id;
    localScore = 0;
    rivalScore = 0;
    localFinished = false;
    rivalFinished = false;
    localExtra = '';
    rivalExtra = '';
    roundRunning = false;
    scoreEl.textContent = '0';
    rivalEl.textContent = '0';
    timeEl.textContent = '20.0';

    const idx = games.findIndex(g => g.id === id);
    titleEl.textContent = game.title;
    numberEl.textContent = `GAME ${String(idx + 1).padStart(2, '0')}`;
    msgEl.textContent = `${roleName()} / ${game.desc}`;
    play.classList.remove('hidden');
    restartBtn.disabled = role !== 'host';
    backBtn.disabled = role !== 'host';

    if (!fromRemote) play.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderReadyScreen();
  }

  function renderReadyScreen() {
    const game = games.find(g => g.id === activeId);
    if (!game) return;
    if (role === 'host') {
      stage.innerHTML = `<div class="start-screen"><div class="start-box">
        <div class="versus-label">ONLINE BATTLE</div>
        <h3>${game.title}</h3>
        <p>${game.desc}<br>両者同時に20秒間プレイします。</p>
        <button id="battle-start" class="big-action" type="button">20秒対戦スタート</button>
      </div></div>`;
      $('#battle-start', stage).addEventListener('click', startRoundAsHost, { once: true });
    } else {
      stage.innerHTML = `<div class="start-screen"><div class="start-box">
        <div class="versus-label">ONLINE BATTLE</div>
        <h3>${game.title}</h3>
        <p>ホストがスタートするまで待ってください。</p>
        <div class="waiting-pulse">READY</div>
      </div></div>`;
    }
  }

  function startRoundAsHost() {
    if (!connected || role !== 'host' || !activeId) return;
    const seed = Math.floor(Math.random() * 2147483646) + 1;
    const at = Date.now() + START_DELAY_MS;
    safeSend({ type: 'start', id: activeId, seed, at });
    scheduleRound(at, seed);
  }

  function scheduleRound(hostStartAt, seed) {
    cleanup();
    cleanup = () => {};
    roundSeed = seed || 1;
    localScore = 0;
    rivalScore = 0;
    localFinished = false;
    rivalFinished = false;
    localExtra = '';
    rivalExtra = '';
    scoreEl.textContent = '0';
    rivalEl.textContent = '0';
    timeEl.textContent = '20.0';

    const localHostNow = role === 'guest' ? Date.now() + clockOffset : Date.now();
    const delay = Math.max(80, Math.min(5000, hostStartAt - localHostNow));
    const startLocalAt = performance.now() + delay;
    let raf = 0;
    let cancelled = false;

    const countdown = () => {
      if (cancelled) return;
      const left = startLocalAt - performance.now();
      if (left <= 0) {
        launchRound(roundSeed);
        return;
      }
      const n = Math.max(1, Math.ceil(left / 1000));
      stage.innerHTML = `<div class="start-screen"><div class="countdown-number">${n}</div></div>`;
      raf = requestAnimationFrame(countdown);
    };
    countdown();
    cleanup = () => { cancelled = true; cancelAnimationFrame(raf); };
  }

  function seededRandom(seed) {
    let x = seed >>> 0;
    return () => {
      x += 0x6D2B79F5;
      let t = x;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function launchRound(seed) {
    if (!activeId || !runners[activeId]) return;
    rng = seededRandom(seed);
    roundRunning = true;
    msgEl.textContent = '20秒勝負！ 相手のスコアもリアルタイムで更新されます。';
    runners[activeId]();
  }

  function setLocalScore(value) {
    localScore = Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);
    scoreEl.textContent = String(localScore);
    pendingScore = localScore;
    if (!scoreSendTimer) {
      scoreSendTimer = window.setTimeout(() => {
        scoreSendTimer = 0;
        const valueToSend = pendingScore;
        pendingScore = null;
        safeSend({ type: 'score', score: valueToSend });
      }, 45);
    }
  }

  function makeTimer(onEnd) {
    const end = performance.now() + ROUND_MS;
    let raf = 0;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      const left = Math.max(0, end - performance.now());
      timeEl.textContent = (left / 1000).toFixed(1);
      if (left <= 0) {
        stopped = true;
        roundRunning = false;
        onEnd();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }

  function finishRound(score, extra = '') {
    if (localFinished) return;
    localFinished = true;
    roundRunning = false;
    localScore = Math.max(0, Number(score) || 0);
    localExtra = String(extra || '');
    scoreEl.textContent = String(localScore);
    safeSend({ type: 'finish', score: localScore, extra: localExtra });

    if (rivalFinished) {
      renderBattleResult();
    } else {
      stage.innerHTML = `<div class="end-screen"><div class="end-box">
        <h3>FINISH!</h3>
        <p>あなた <strong>${localScore}</strong> 点<br>相手の結果を待っています…</p>
        <div class="waiting-pulse">WAIT</div>
      </div></div>`;
    }
  }

  function renderBattleResult() {
    let result = 'DRAW';
    let heading = '引き分け！';
    if (localScore > rivalScore) {
      result = 'YOU WIN';
      heading = 'あなたの勝ち！';
    } else if (localScore < rivalScore) {
      result = 'YOU LOSE';
      heading = '相手の勝ち！';
    }

    const extraBits = [];
    if (localExtra) extraBits.push(`あなた: ${localExtra}`);
    if (rivalExtra) extraBits.push(`相手: ${rivalExtra}`);

    stage.innerHTML = `<div class="end-screen"><div class="end-box battle-result">
      <div class="result-kicker">${result}</div>
      <h3>${heading}</h3>
      <div class="result-score"><span>YOU <strong>${localScore}</strong></span><b>−</b><span>RIVAL <strong>${rivalScore}</strong></span></div>
      ${extraBits.length ? `<p>${extraBits.join('<br>')}</p>` : ''}
      ${role === 'host' ? '<button id="rematch-btn" class="big-action" type="button">同じゲームでもう一度</button>' : '<p>ホストが再戦を選ぶまで待ってください。</p>'}
    </div></div>`;

    if (role === 'host') {
      $('#rematch-btn', stage).addEventListener('click', () => {
        safeSend({ type: 'select', id: activeId });
        openGame(activeId, false);
      }, { once: true });
    }
  }

  function closeGame(send = true) {
    if (send && role === 'host') safeSend({ type: 'back' });
    cleanup();
    cleanup = () => {};
    roundRunning = false;
    activeId = null;
    play.classList.add('hidden');
  }

  const runners = {
    target() {
      stage.innerHTML = '';
      let score = 0;
      let combo = 0;
      let bestCombo = 0;
      let moveTimer = 0;
      const target = document.createElement('button');
      target.className = 'target';
      target.type = 'button';
      target.textContent = '+1';
      stage.appendChild(target);

      const place = () => {
        const maxX = Math.max(0, stage.clientWidth - 84);
        const maxY = Math.max(0, stage.clientHeight - 84);
        target.style.left = `${8 + rng() * maxX}px`;
        target.style.top = `${8 + rng() * maxY}px`;
      };
      const hit = e => {
        e.stopPropagation();
        combo++;
        bestCombo = Math.max(bestCombo, combo);
        score += 1 + (combo % 5 === 0 ? 2 : 0);
        setLocalScore(score);
        place();
      };
      const miss = e => { if (e.target !== target) combo = 0; };
      target.addEventListener('pointerdown', hit);
      stage.addEventListener('pointerdown', miss);
      place();
      moveTimer = setInterval(place, 850);
      const stop = makeTimer(() => {
        clearInterval(moveTimer);
        finishRound(score, `最大コンボ ${bestCombo}`);
      });
      cleanup = () => { stop(); clearInterval(moveTimer); stage.removeEventListener('pointerdown', miss); };
    },

    tap() {
      let score = 0;
      stage.innerHTML = '<div class="tap-wrap"><button class="tap-button" type="button">TAP!</button></div>';
      const button = $('.tap-button', stage);
      button.addEventListener('pointerdown', () => {
        score++;
        setLocalScore(score);
        button.classList.add('pressed');
        setTimeout(() => button.classList.remove('pressed'), 45);
      });
      const stop = makeTimer(() => finishRound(score));
      cleanup = stop;
    },

    numbers() {
      let score = 0;
      let nextNumber = 1;
      let rounds = 0;
      let alive = true;

      const draw = () => {
        const nums = Array.from({ length: 25 }, (_, i) => i + 1);
        for (let i = nums.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [nums[i], nums[j]] = [nums[j], nums[i]];
        }
        stage.innerHTML = `<div class="number-grid">${nums.map(n => `<button type="button" data-n="${n}">${n}</button>`).join('')}</div>`;
        $$('[data-n]', stage).forEach(btn => btn.addEventListener('click', () => {
          if (!alive) return;
          if (Number(btn.dataset.n) === nextNumber) {
            btn.classList.add('done');
            score++;
            nextNumber++;
            setLocalScore(score);
            if (nextNumber === 26) {
              rounds++;
              nextNumber = 1;
              draw();
            }
          } else {
            score = Math.max(0, score - 1);
            setLocalScore(score);
          }
        }));
      };

      draw();
      const stop = makeTimer(() => {
        alive = false;
        finishRound(score, `${rounds}周クリア`);
      });
      cleanup = () => { alive = false; stop(); };
    },

    stroop() {
      const defs = [['赤', '#f87171'], ['青', '#60a5fa'], ['緑', '#4ade80'], ['黄', '#facc15']];
      let score = 0;
      let alive = true;

      const next = () => {
        if (!alive) return;
        const ink = defs[Math.floor(rng() * defs.length)];
        const word = defs[Math.floor(rng() * defs.length)];
        stage.innerHTML = `<div class="center-game"><div>
          <div class="prompt" style="color:${ink[1]}">${word[0]}</div>
          <div class="subprompt">表示色は？</div>
          <div class="choices">${defs.map(d => `<button class="choice-btn" type="button" data-c="${d[0]}">${d[0]}</button>`).join('')}</div>
        </div></div>`;
        $$('[data-c]', stage).forEach(btn => btn.addEventListener('click', () => {
          score += btn.dataset.c === ink[0] ? 1 : -1;
          score = Math.max(0, score);
          setLocalScore(score);
          next();
        }));
      };

      next();
      const stop = makeTimer(() => { alive = false; finishRound(score); });
      cleanup = () => { alive = false; stop(); };
    },

    memory() {
      let score = 0;
      let sequence = [];
      let input = [];
      let locked = true;
      let round = 0;
      let alive = true;
      const timers = new Set();

      stage.innerHTML = '<div class="center-game"><div><div id="mem-status" class="subprompt">準備中…</div><div class="memory-board"></div></div></div>';
      const board = $('.memory-board', stage);
      const status = $('#mem-status', stage);
      for (let i = 0; i < 9; i++) {
        const button = document.createElement('button');
        button.className = 'memory-tile';
        button.type = 'button';
        button.dataset.i = String(i);
        board.appendChild(button);
      }

      const wait = ms => new Promise(resolve => {
        const id = setTimeout(() => { timers.delete(id); resolve(); }, ms);
        timers.add(id);
      });

      const flash = async () => {
        if (!alive) return;
        locked = true;
        input = [];
        sequence.push(Math.floor(rng() * 9));
        round++;
        status.textContent = `ROUND ${round} 覚えて…`;
        for (const n of sequence) {
          if (!alive) return;
          await wait(180);
          if (!alive) return;
          board.children[n].classList.add('lit');
          await wait(230);
          board.children[n].classList.remove('lit');
        }
        if (alive) {
          locked = false;
          status.textContent = '同じ順番でタップ';
        }
      };

      board.addEventListener('click', e => {
        const button = e.target.closest('.memory-tile');
        if (!button || locked || !alive) return;
        const n = Number(button.dataset.i);
        const pos = input.length;
        input.push(n);
        if (n !== sequence[pos]) {
          score = Math.max(0, score - 2);
          setLocalScore(score);
          sequence = [];
          round = 0;
          locked = true;
          const id = setTimeout(() => { timers.delete(id); flash(); }, 280);
          timers.add(id);
          return;
        }
        if (input.length === sequence.length) {
          score += sequence.length;
          setLocalScore(score);
          locked = true;
          const id = setTimeout(() => { timers.delete(id); flash(); }, 300);
          timers.add(id);
        }
      });

      flash();
      const stop = makeTimer(() => {
        alive = false;
        timers.forEach(clearTimeout);
        finishRound(score, `到達ラウンド ${round}`);
      });
      cleanup = () => { alive = false; timers.forEach(clearTimeout); stop(); };
    },

    math() {
      let score = 0;
      let alive = true;

      const next = () => {
        if (!alive) return;
        const a = 1 + Math.floor(rng() * 20);
        const b = 1 + Math.floor(rng() * 20);
        const plus = rng() < 0.65;
        const answer = plus ? a + b : a - b;
        const options = [answer];
        while (options.length < 4) {
          const x = answer + Math.floor(rng() * 13) - 6;
          if (!options.includes(x)) options.push(x);
        }
        for (let i = options.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [options[i], options[j]] = [options[j], options[i]];
        }
        stage.innerHTML = `<div class="center-game"><div>
          <div class="prompt">${a} ${plus ? '+' : '−'} ${b}</div>
          <div class="choices">${options.map(x => `<button class="choice-btn" type="button" data-a="${x}">${x}</button>`).join('')}</div>
        </div></div>`;
        $$('[data-a]', stage).forEach(btn => btn.addEventListener('click', () => {
          score += Number(btn.dataset.a) === answer ? 1 : -1;
          score = Math.max(0, score);
          setLocalScore(score);
          next();
        }));
      };

      next();
      const stop = makeTimer(() => { alive = false; finishRound(score); });
      cleanup = () => { alive = false; stop(); };
    },

    catch() {
      let score = 0;
      let alive = true;
      let spawner = 0;
      const rafs = new Set();
      stage.innerHTML = '';

      const spawn = () => {
        if (!alive) return;
        const good = rng() > 0.25;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `fall-item ${good ? 'fall-good' : 'fall-bad'}`;
        button.textContent = good ? '★' : '💣';
        button.style.left = `${rng() * Math.max(1, stage.clientWidth - 60) + 3}px`;
        button.style.top = '-58px';
        stage.appendChild(button);

        const duration = 1300 + rng() * 850;
        const start = performance.now();
        let raf = 0;
        const animate = t => {
          const p = Math.min(1, (t - start) / duration);
          button.style.top = `${-58 + p * (stage.clientHeight + 70)}px`;
          if (p < 1 && button.isConnected && alive) {
            raf = requestAnimationFrame(animate);
            rafs.add(raf);
          } else {
            button.remove();
          }
        };
        raf = requestAnimationFrame(animate);
        rafs.add(raf);
        button.addEventListener('pointerdown', e => {
          e.stopPropagation();
          cancelAnimationFrame(raf);
          score += good ? 1 : -3;
          score = Math.max(0, score);
          setLocalScore(score);
          button.remove();
        });
      };

      spawner = setInterval(spawn, 360);
      spawn();
      const stop = makeTimer(() => {
        alive = false;
        clearInterval(spawner);
        rafs.forEach(cancelAnimationFrame);
        finishRound(score);
      });
      cleanup = () => { alive = false; clearInterval(spawner); rafs.forEach(cancelAnimationFrame); stop(); };
    },

    reaction() {
      let score = 0;
      let rounds = 0;
      let total = 0;
      let state = 'waiting';
      let goAt = 0;
      let timeout = 0;
      let alive = true;

      stage.innerHTML = '<div class="center-game"><div class="reaction-pad reaction-wait">WAIT…</div></div>';
      const pad = $('.reaction-pad', stage);

      const schedule = () => {
        if (!alive) return;
        state = 'waiting';
        pad.className = 'reaction-pad reaction-wait';
        pad.textContent = 'WAIT…';
        timeout = setTimeout(() => {
          if (!alive) return;
          state = 'go';
          goAt = performance.now();
          pad.className = 'reaction-pad reaction-go';
          pad.textContent = 'GO!';
        }, 650 + rng() * 1500);
      };

      pad.addEventListener('pointerdown', () => {
        if (!alive) return;
        if (state === 'waiting') {
          score = Math.max(0, score - 2);
          setLocalScore(score);
          clearTimeout(timeout);
          pad.textContent = 'TOO EARLY';
          state = 'cooldown';
          timeout = setTimeout(schedule, 350);
        } else if (state === 'go') {
          const ms = Math.round(performance.now() - goAt);
          rounds++;
          total += ms;
          score += Math.max(1, Math.round((700 - ms) / 50));
          setLocalScore(score);
          state = 'cooldown';
          pad.textContent = `${ms} ms`;
          timeout = setTimeout(schedule, 380);
        }
      });

      schedule();
      const stop = makeTimer(() => {
        alive = false;
        clearTimeout(timeout);
        finishRound(score, rounds ? `平均 ${Math.round(total / rounds)} ms / ${rounds}回` : '記録なし');
      });
      cleanup = () => { alive = false; clearTimeout(timeout); stop(); };
    },

    typing() {
      const words = ['apple', 'river', 'space', 'light', 'green', 'music', 'dream', 'quick', 'tiger', 'ocean', 'stone', 'happy', 'cloud', 'night', 'power', 'game', 'mouse', 'train', 'glass', 'world', 'magic', 'brave', 'smart', 'speed'];
      let score = 0;
      let current = '';
      let alive = true;
      stage.innerHTML = '<div class="center-game"><div><div id="type-word" class="prompt"></div><div class="subprompt">入力して Enter</div><div style="margin-top:20px"><input id="type-input" class="typing-input" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="英単語入力"></div></div></div>';
      const input = $('#type-input', stage);
      const wordEl = $('#type-word', stage);

      const next = () => {
        current = words[Math.floor(rng() * words.length)];
        wordEl.textContent = current;
        input.value = '';
        input.focus();
      };

      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || !alive) return;
        e.preventDefault();
        if (input.value.trim().toLowerCase() === current) {
          score++;
        } else {
          score = Math.max(0, score - 1);
        }
        setLocalScore(score);
        next();
      });

      next();
      const stop = makeTimer(() => { alive = false; input.blur(); finishRound(score); });
      cleanup = () => { alive = false; stop(); };
    },

    higher() {
      let score = 0;
      let streak = 0;
      let current = 1 + Math.floor(rng() * 13);
      let alive = true;

      const nextRound = () => {
        if (!alive) return;
        stage.innerHTML = `<div class="center-game"><div>
          <div class="higher-number">${current}</div>
          <div class="subprompt">次の数字は？（1〜13）</div>
          <div class="choices"><button class="choice-btn" type="button" data-h="high">HIGH</button><button class="choice-btn" type="button" data-h="low">LOW</button></div>
        </div></div>`;
        $$('[data-h]', stage).forEach(btn => btn.addEventListener('click', () => {
          let next = 1 + Math.floor(rng() * 13);
          while (next === current) next = 1 + Math.floor(rng() * 13);
          const correct = btn.dataset.h === (next > current ? 'high' : 'low');
          if (correct) {
            streak++;
            score += 1 + Math.floor(streak / 4);
          } else {
            streak = 0;
            score = Math.max(0, score - 1);
          }
          current = next;
          setLocalScore(score);
          nextRound();
        }));
      };

      nextRound();
      const stop = makeTimer(() => { alive = false; finishRound(score, `最終連勝 ${streak}`); });
      cleanup = () => { alive = false; stop(); };
    }
  };

  createRoomBtn.addEventListener('click', createRoom);

  joinForm.addEventListener('submit', e => {
    e.preventDefault();
    joinRoom(roomInput.value);
  });

  roomInput.addEventListener('input', () => {
    roomInput.value = normalizeRoomCode(roomInput.value);
  });

  copyRoomBtn.addEventListener('click', async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      copyRoomBtn.textContent = 'コピーしました';
      setTimeout(() => { copyRoomBtn.textContent = 'コードをコピー'; }, 1200);
    } catch (_) {
      roomCodeDisplay.classList.add('copy-highlight');
      setTimeout(() => roomCodeDisplay.classList.remove('copy-highlight'), 1000);
    }
  });

  backBtn.addEventListener('click', () => {
    if (role !== 'host') return;
    closeGame(true);
    $('#games').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  restartBtn.addEventListener('click', () => {
    if (role !== 'host' || !activeId) return;
    safeSend({ type: 'select', id: activeId });
    openGame(activeId, false);
  });

  window.addEventListener('beforeunload', destroyPeer);

  renderCards();
  setConnectionUI('「部屋を作る」か「部屋に参加」を選んでください。', '離れた端末同士でオンライン対戦できます。', 'idle');
})();
