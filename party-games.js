(() => {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  const COLORS = ['🔴', '🟡', '🟢', '🔵'];

  const GAMES = {
    24: { title:'REACTOR RELAY', mode:'CO-OP', kind:'sequence', goal:90, desc:'原子炉の制御コードを2人で順番につなぐ。', items:['A','B','C','D'] },
    25: { title:'METEOR DEFENSE', mode:'CO-OP', kind:'targets', goal:55, desc:'迫る隕石を分担迎撃し、基地を守る。', icon:'☄️' },
    26: { title:'CARGO RUSH', mode:'VS', kind:'risk', goal:80, desc:'安全・高速・危険レーンを選び貨物点を競う。', items:['SAFE','FAST','RISK'] },
    27: { title:'VIRUS PURGE', mode:'CO-OP', kind:'targets', goal:60, desc:'感染ノードを2人で同時駆除する。', icon:'🦠' },
    28: { title:'TREASURE HEIST', mode:'VS', kind:'risk', goal:75, desc:'宝箱の当たりと罠を読み、先に75点。', items:['SAFE BOX','GOLD BOX','CURSED BOX'] },
    29: { title:'SKY TOWER BUILDERS', mode:'CO-OP', kind:'build', goal:16, desc:'資材を共有し空中塔を16階まで建てる。', icon:'🏗️' },
    30: { title:'ESCAPE SWITCH', mode:'CO-OP', kind:'sequence', goal:80, desc:'色スイッチを正しい順で解除して脱出。', items:COLORS },
    31: { title:'SNOWBALL ARENA', mode:'VS', kind:'duel', goal:0, desc:'チャージ・ガード・雪玉攻撃でKOを狙う。', icon:'❄️' },
    32: { title:'CRYSTAL CAPTURE', mode:'VS', kind:'targets', goal:45, desc:'出現するクリスタルを早取りして45点先取。', icon:'💎' },
    33: { title:'BOMB PASS', mode:'VS', kind:'bomb', goal:0, desc:'導火線が切れる前に爆弾を相手へ渡す。', icon:'💣' },
    34: { title:'KITCHEN CHAOS', mode:'CO-OP', kind:'sequence', goal:100, desc:'注文どおりに食材を2人で連携投入。', items:['🍖','🥕','🍞','🧀'] },
    35: { title:'GHOST HUNT', mode:'VS', kind:'targets', goal:40, desc:'暗闇から出るゴーストを先に40体捕獲。', icon:'👻' },
    36: { title:'SPACE SALVAGE', mode:'VS', kind:'risk', goal:90, desc:'宇宙漂流物を回収し、レア品か故障かを競う。', items:['SAFE','DEEP','UNKNOWN'] },
    37: { title:'BRIDGE BUILDERS', mode:'CO-OP', kind:'build', goal:20, desc:'木材・ロープ・金属を集め橋を20区画架設。', icon:'🌉' },
    38: { title:'LASER MAZE', mode:'CO-OP', kind:'maze', goal:5, desc:'共有ドローンを誘導し迷路を5回突破。', icon:'🤖' },
    39: { title:'CASTLE SIEGE', mode:'VS', kind:'duel', goal:0, desc:'攻撃・防御・チャージで相手の城を破壊。', icon:'🏰' },
    40: { title:'FISHING FRENZY', mode:'VS', kind:'timing', goal:100, desc:'ゲージ中央でHOOKし先に100kg釣る。', icon:'🎣' },
    41: { title:'FIRE BRIGADE', mode:'CO-OP', kind:'targets', goal:65, desc:'広がる火災を分担消火して建物を守る。', icon:'🔥' },
    42: { title:'RHYTHM RELAY', mode:'CO-OP', kind:'sequence', goal:100, desc:'4ビートを2人でつないでライブ成功。', items:['🥁','👏','🔔','🎸'] },
    43: { title:'CROWN RACE', mode:'VS', kind:'risk', goal:70, desc:'安全道・近道・ワープを選び先に王冠へ。', items:['ROAD','DASH','WARP'] }
  };

  let gameNo = Number(params.get('game'));
  if (!GAMES[gameNo]) gameNo = 24;
  const game = GAMES[gameNo];

  const el = {
    kicker: $('#game-kicker'), title: $('#game-title'), summary: $('#game-summary'),
    badge: $('#connection-badge'), create: $('#create-room-btn'), made: $('#room-created'),
    room: $('#room-code-display'), copy: $('#copy-room-btn'), join: $('#join-form'), input: $('#room-code-input'),
    connStatus: $('#connection-status'), connDetail: $('#connection-detail'), start: $('#start-btn'), restart: $('#restart-btn'),
    time: $('#time-value'), you: $('#you-value'), rival: $('#rival-value'), rivalLabel: $('#rival-label'), team: $('#team-value'),
    status: $('#status-label'), stage: $('#game-stage'), message: $('#game-message'), dialog: $('#rules-dialog'),
    rulesTitle: $('#rules-title'), rulesBody: $('#rules-body')
  };

  document.title = `${game.title} - PARTY 5`;
  el.kicker.textContent = `GAME ${gameNo} / ${game.mode}`;
  el.title.textContent = game.title;
  el.summary.textContent = game.desc;
  el.rivalLabel.textContent = game.mode === 'CO-OP' ? 'PARTNER' : 'RIVAL';
  el.rulesTitle.textContent = `${game.title} のルール`;
  el.rulesBody.innerHTML = `<p>${game.desc}</p><ul><li>ログイン不要のオンライン2人プレイ。</li><li>最大5分。目標達成・KOならその場で終了。</li><li>${game.mode === 'CO-OP' ? '2人で同じ目標を達成すればクリア。' : '相手より先に目標到達、または相手をKOすれば勝利。'}</li></ul>`;

  $('#rules-btn').onclick = () => el.dialog.showModal();
  $('#rules-close').onclick = () => el.dialog.close();
  el.dialog.onclick = (e) => { if (e.target === el.dialog) el.dialog.close(); };
  $('#fullscreen-btn').onclick = async () => {
    try { document.fullscreenElement ? await document.exitFullscreen() : await document.documentElement.requestFullscreen(); } catch (_) {}
  };

  const ROOM_PREFIX = 'mg20-';
  const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let peer = null, conn = null, role = '', localPlayer = 0, connected = false, state = null, hostTimer = 0, lastSync = 0;

  const rand = (n) => Math.floor(Math.random() * n);
  const roomCode = () => Array.from({length:6}, () => ROOM_CHARS[rand(ROOM_CHARS.length)]).join('');
  const normalize = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  function setConnection(title, detail = '', status = 'idle') {
    el.connStatus.textContent = title;
    el.connDetail.textContent = detail;
    el.badge.textContent = status === 'connected' ? '接続中' : status === 'waiting' ? '待機中' : status === 'error' ? 'エラー' : '未接続';
    el.badge.dataset.state = status;
  }

  function destroyConnection() {
    clearInterval(hostTimer);
    try { conn?.close(); } catch (_) {}
    try { peer?.destroy(); } catch (_) {}
    peer = conn = null;
    state = null;
    connected = false;
    el.start.disabled = true;
    el.restart.disabled = true;
  }

  function peerError(error) {
    if (error?.type === 'peer-unavailable') return '部屋が見つかりません。コードを確認してください。';
    if (error?.type === 'unavailable-id') return '部屋コードが重複しました。もう一度作成してください。';
    return '通信に失敗しました。';
  }

  function send(data) {
    if (!conn?.open) return;
    try { conn.send(data); } catch (_) {}
  }

  function sync(force = false) {
    if (role !== 'host' || !state) return;
    const now = Date.now();
    if (!force && now - lastSync < 300) return;
    lastSync = now;
    send({ type:'state', gameNo, state });
  }

  function attach(connection) {
    conn = connection;
    conn.on('open', () => {
      connected = true;
      setConnection('2人接続しました', role === 'host' ? 'PLAYER 1 / HOST' : 'PLAYER 2 / GUEST', 'connected');
      el.start.disabled = role !== 'host';
      el.restart.disabled = role !== 'host';
      if (role === 'guest') send({ type:'hello', gameNo });
      render();
    });
    conn.on('data', (data) => {
      if (!data || data.gameNo !== gameNo) return;
      if (data.type === 'state' && role === 'guest') { state = data.state; render(); }
      else if (data.type === 'hello' && role === 'host') sync(true);
      else if (data.type === 'action' && role === 'host') applyAction(data.action, 1);
    });
    conn.on('close', () => {
      connected = false;
      setConnection('接続が切れました', '部屋を作り直してください。', 'error');
      render();
    });
    conn.on('error', (error) => setConnection('通信エラー', peerError(error), 'error'));
  }

  el.create.onclick = () => {
    if (!window.SupabasePeer) return setConnection('Supabase通信を読み込めません', '', 'error');
    destroyConnection();
    role = 'host'; localPlayer = 0;
    const code = roomCode();
    el.made.classList.remove('hidden'); el.room.textContent = code;
    setConnection('部屋を作成中…', `ROOM ${code}`, 'waiting');
    peer = new SupabasePeer(ROOM_PREFIX + code.toLowerCase());
    peer.on('open', () => setConnection('相手の参加待ち', `ROOM ${code}`, 'waiting'));
    peer.on('connection', attach);
    peer.on('error', (error) => setConnection('接続エラー', peerError(error), 'error'));
  };

  el.join.onsubmit = (e) => {
    e.preventDefault();
    const code = normalize(el.input.value);
    if (code.length !== 6) return setConnection('6桁コードを入力してください', '', 'error');
    destroyConnection(); role = 'guest'; localPlayer = 1;
    setConnection('接続中…', `ROOM ${code}`, 'waiting');
    peer = new SupabasePeer();
    peer.on('open', () => attach(peer.connect(ROOM_PREFIX + code.toLowerCase())));
    peer.on('error', (error) => setConnection('接続エラー', peerError(error), 'error'));
  };

  el.input.oninput = () => { el.input.value = normalize(el.input.value); };
  el.copy.onclick = async () => {
    try { await navigator.clipboard.writeText(el.room.textContent); el.copy.textContent = 'コピー済み'; setTimeout(() => el.copy.textContent = 'コピー', 900); } catch (_) {}
  };

  function makeSequence() { return Array.from({length:5}, () => game.items[rand(game.items.length)]); }
  function makeTargets(count) {
    const a = Array(12).fill(0);
    while (a.filter(Boolean).length < count) a[rand(a.length)] = 1;
    return a;
  }

  function startGame() {
    if (role !== 'host' || !connected) return;
    state = { endAt:Date.now()+300000, ended:false, scores:[0,0], team:0, message:'START!', last:[0,0] };
    if (game.kind === 'targets') { state.targets = makeTargets(game.mode === 'CO-OP' ? 3 : 1); state.baseHp = 5; state.spawnAt = Date.now()+1300; }
    if (game.kind === 'sequence') { state.sequence = makeSequence(); state.sequencePos = 0; }
    if (game.kind === 'build') state.resources = { wood:0, rope:0, metal:0 };
    if (game.kind === 'bomb') { state.life = [3,3]; state.holder = rand(2); state.fuseAt = Date.now()+6000; state.passes = 0; }
    if (game.kind === 'duel') { state.hp = [100,100]; state.energy = [1,1]; state.guard = [false,false]; }
    if (game.kind === 'risk' || game.kind === 'timing') state.cooldown = [0,0];
    if (game.kind === 'maze') { state.x = 0; state.y = 0; state.round = 0; }
    sync(true); render();
    clearInterval(hostTimer); hostTimer = setInterval(hostTick, 220);
  }

  el.start.onclick = startGame;
  el.restart.onclick = startGame;

  function finish(winner, message) {
    if (!state || state.ended) return;
    state.ended = true; state.winner = winner; state.message = message;
    sync(true); render();
  }

  function checkGoal() {
    if (game.mode === 'CO-OP' && game.goal && state.team >= game.goal) return finish('coop', '協力ミッションクリア！');
    if (game.mode === 'VS' && game.goal) {
      if (state.scores[0] >= game.goal) return finish(0, 'PLAYER 1 WIN!');
      if (state.scores[1] >= game.goal) return finish(1, 'PLAYER 2 WIN!');
    }
  }

  function submit(action) {
    if (!state || state.ended) return;
    if (role === 'guest') send({ type:'action', gameNo, action });
    else applyAction(action, 0);
  }

  function applyAction(action, player) {
    if (!state || state.ended) return;
    const now = Date.now();

    if (game.kind === 'targets') {
      const i = Number(action.i);
      if (state.targets[i]) {
        state.targets[i] = 0; state.scores[player]++;
        if (game.mode === 'CO-OP') state.team++;
        else {
          const empty = state.targets.map((v,j) => v ? -1 : j).filter((j) => j >= 0);
          if (empty.length) state.targets[empty[rand(empty.length)]] = 1;
        }
        state.message = 'GET!'; checkGoal();
      } else if (game.mode === 'CO-OP') {
        state.baseHp--; state.message = 'MISS!';
        if (state.baseHp <= 0) finish(null, 'BASE DOWN');
      }
    }

    else if (game.kind === 'sequence') {
      if (action.value === state.sequence[state.sequencePos]) {
        state.sequencePos++; state.scores[player]++; state.team++;
        if (state.sequencePos >= state.sequence.length) { state.team += 2; state.sequence = makeSequence(); state.sequencePos = 0; }
      } else {
        state.team = Math.max(0, state.team - 1); state.sequencePos = Math.max(0, state.sequencePos - 1); state.message = 'MISS';
      }
      checkGoal();
    }

    else if (game.kind === 'risk') {
      if (now < state.cooldown[player]) return;
      state.cooldown[player] = now + 650;
      const choice = Number(action.choice);
      let points;
      if (choice === 0) points = 2 + rand(3);
      else if (choice === 1) points = Math.random() < .2 ? -2 : 3 + rand(5);
      else points = Math.random() < .35 ? -(2 + rand(5)) : 6 + rand(8);
      state.scores[player] = Math.max(0, state.scores[player] + points);
      state.message = `${points > 0 ? '+' : ''}${points}`; checkGoal();
    }

    else if (game.kind === 'build') {
      if (action.resource) { state.resources[action.resource]++; state.scores[player]++; }
      if (action.build) {
        const cost = gameNo === 37 ? {wood:2,rope:1,metal:1} : {wood:1,rope:1,metal:1};
        if (Object.keys(cost).every((k) => state.resources[k] >= cost[k])) {
          Object.keys(cost).forEach((k) => state.resources[k] -= cost[k]);
          state.team++; state.scores[player]++; checkGoal();
        } else state.message = '資材不足';
      }
    }

    else if (game.kind === 'bomb') {
      if (player !== state.holder) return;
      state.holder = 1 - player; state.passes++; state.scores[player]++;
      state.fuseAt = now + Math.max(1300, 4500 - state.passes * 140);
    }

    else if (game.kind === 'duel') {
      if (now - state.last[player] < 450) return;
      state.last[player] = now;
      if (action.move === 'charge') state.energy[player] = Math.min(5, state.energy[player] + 1);
      if (action.move === 'guard') state.guard[player] = true;
      if (action.move === 'attack') {
        if (state.energy[player] <= 0) { state.message = 'ENERGY 0'; sync(true); render(); return; }
        state.energy[player]--;
        let damage = 9 + rand(8);
        if (state.guard[1-player]) { damage = Math.ceil(damage * .35); state.guard[1-player] = false; }
        state.hp[1-player] = Math.max(0, state.hp[1-player] - damage); state.scores[player] += damage;
        if (state.hp[1-player] <= 0) return finish(player, `PLAYER ${player+1} KO WIN!`);
      }
    }

    else if (game.kind === 'timing') {
      if (now < state.cooldown[player]) return;
      state.cooldown[player] = now + 800;
      const x = (Math.sin((now % 2400) / 2400 * Math.PI * 2 - Math.PI/2) + 1) / 2;
      const d = Math.abs(x - .5);
      const points = d < .07 ? 12 : d < .15 ? 8 : d < .25 ? 4 : 1;
      state.scores[player] += points; state.message = `HOOK +${points}`; checkGoal();
    }

    else if (game.kind === 'maze') {
      let x = state.x, y = state.y;
      if (action.dir === 'up') y--; if (action.dir === 'down') y++;
      if (action.dir === 'left') x--; if (action.dir === 'right') x++;
      if (x < 0 || x > 6 || y < 0 || y > 6) return;
      state.x = x; state.y = y; state.scores[player]++;
      if (x === 6 && y === 6) { state.team++; state.x = 0; state.y = 0; if (state.team >= game.goal) return finish('coop', '5回脱出成功！'); }
    }

    sync(true); render();
  }

  function hostTick() {
    if (role !== 'host' || !state || state.ended) return;
    const now = Date.now();
    if (now >= state.endAt) {
      if (game.mode === 'CO-OP') return finish(null, 'TIME UP');
      const a = state.scores[0], b = state.scores[1];
      return finish(a === b ? 'draw' : a > b ? 0 : 1, a === b ? 'DRAW' : `PLAYER ${a > b ? 1 : 2} WIN!`);
    }
    if (game.kind === 'targets' && game.mode === 'CO-OP' && now >= state.spawnAt) {
      state.spawnAt = now + 1100 + rand(800);
      const empty = state.targets.map((v,i) => v ? -1 : i).filter((i) => i >= 0);
      if (empty.length) state.targets[empty[rand(empty.length)]] = 1;
      if (state.targets.filter(Boolean).length >= 7) { state.baseHp--; const active = state.targets.map((v,i)=>v?i:-1).filter((i)=>i>=0); if (active.length) state.targets[active[rand(active.length)]] = 0; if (state.baseHp <= 0) return finish(null, 'BASE DOWN'); }
      sync(true);
    }
    if (game.kind === 'bomb' && now >= state.fuseAt) {
      const loser = state.holder;
      state.life[loser]--;
      if (state.life[loser] <= 0) return finish(1-loser, `PLAYER ${2-loser} WIN!`);
      state.holder = 1-loser; state.passes = 0; state.fuseAt = now + 6000; sync(true);
    }
    renderTime();
  }

  function renderTime() {
    const seconds = state ? Math.max(0, Math.ceil((state.endAt - Date.now()) / 1000)) : 300;
    el.time.textContent = `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  }

  function button(text, attrs = {}, cls = 'party-choice') {
    const data = Object.entries(attrs).map(([k,v]) => `data-${k}="${String(v)}"`).join(' ');
    return `<button class="${cls}" type="button" ${data}>${text}</button>`;
  }

  function render() {
    renderTime();
    if (!state) {
      el.you.textContent = '0'; el.rival.textContent = '0';
      el.team.textContent = game.mode === 'CO-OP' ? `0 / ${game.goal}` : '—';
      el.status.textContent = connected ? (role === 'host' ? '準備OK' : 'ホスト開始待ち') : '接続待ち';
      el.stage.innerHTML = `<div class="party-center"><div><div class="party-target">${game.icon || '🎮'}</div><h3>${game.mode === 'CO-OP' ? '2人協力' : '2人対戦'}</h3><p>${game.desc}</p></div></div>`;
      return;
    }

    el.you.textContent = state.scores[localPlayer];
    el.rival.textContent = state.scores[1-localPlayer];
    el.team.textContent = game.mode === 'CO-OP' ? `${state.team}/${game.goal}` : game.kind === 'duel' ? `HP ${state.hp[localPlayer]}` : `GOAL ${game.goal || 'KO'}`;
    el.status.textContent = state.ended ? 'FINISHED' : game.mode;
    el.message.textContent = state.message || '';

    if (state.ended) {
      const result = state.winner === 'coop' ? 'MISSION CLEAR' : state.winner === 'draw' ? 'DRAW' : state.winner == null ? 'MISSION FAILED' : state.winner === localPlayer ? 'YOU WIN!' : 'YOU LOSE';
      el.stage.innerHTML = `<div class="party-center"><div><div class="party-target">🏁</div><h3>${result}</h3><p>${state.message}</p></div></div>`;
      return;
    }

    if (game.kind === 'targets') {
      el.stage.innerHTML = `<div class="party-grid">${state.targets.map((v,i) => `<button class="party-cell ${v?'hot':''}" data-target="${i}"><span class="party-target">${v ? game.icon : '·'}</span></button>`).join('')}</div>${game.mode === 'CO-OP' ? `<p>BASE HP ${'♥'.repeat(Math.max(0,state.baseHp))}</p>` : ''}`;
    }
    else if (game.kind === 'sequence') {
      el.stage.innerHTML = `<div class="party-center"><div><div class="party-sequence">${state.sequence.map((x,i) => `<span class="party-seq-token ${i<state.sequencePos?'done':''}">${x}</span>`).join('')}</div><div class="party-buttons">${game.items.map((x) => button(x,{value:x})).join('')}</div><p>PROGRESS ${state.team}/${game.goal}</p></div></div>`;
    }
    else if (game.kind === 'risk') {
      el.stage.innerHTML = `<div class="party-center"><div><h3>${state.scores[0]} - ${state.scores[1]}</h3><div class="party-buttons">${game.items.map((x,i) => button(x,{choice:i})).join('')}</div><p>右ほどハイリスク・ハイリターン</p></div></div>`;
    }
    else if (game.kind === 'build') {
      const r = state.resources;
      el.stage.innerHTML = `<div class="party-center"><div><div class="party-target">${game.icon}</div><h3>${state.team}/${game.goal}</h3><p>WOOD ${r.wood} / ROPE ${r.rope} / METAL ${r.metal}</p><div class="party-buttons">${button('🪵 WOOD',{resource:'wood'})}${button('🧵 ROPE',{resource:'rope'})}${button('🔩 METAL',{resource:'metal'})}${button('🔨 BUILD',{build:1},'party-big-button')}</div></div></div>`;
    }
    else if (game.kind === 'bomb') {
      const mine = state.holder === localPlayer;
      el.stage.innerHTML = `<div class="party-center"><div><div class="party-target">💣</div><h3>${mine ? 'あなたが爆弾を所持！' : '相手が所持'}</h3><p>FUSE ${Math.max(0,(state.fuseAt-Date.now())/1000).toFixed(1)}s</p><p>P1 ${'♥'.repeat(state.life[0])} / P2 ${'♥'.repeat(state.life[1])}</p>${mine ? button('PASS!',{pass:1},'party-big-button') : ''}</div></div>`;
    }
    else if (game.kind === 'duel') {
      el.stage.innerHTML = `<div class="party-center"><div><div class="party-target">${game.icon}</div><p>YOU HP ${state.hp[localPlayer]} / EN ${state.energy[localPlayer]} ${state.guard[localPlayer]?'🛡️':''}</p><p>RIVAL HP ${state.hp[1-localPlayer]} / EN ${state.energy[1-localPlayer]} ${state.guard[1-localPlayer]?'🛡️':''}</p><div class="party-buttons">${button('⚡ CHARGE',{move:'charge'})}${button('🛡️ GUARD',{move:'guard'})}${button('💥 ATTACK',{move:'attack'},'party-big-button')}</div></div></div>`;
    }
    else if (game.kind === 'timing') {
      const x = ((Math.sin((Date.now()%2400)/2400*Math.PI*2-Math.PI/2)+1)/2)*100;
      el.stage.innerHTML = `<div class="party-center"><div style="width:90%"><div class="party-target">🎣</div><div class="party-meter"><div class="party-meter-zone"></div><div style="position:absolute;top:0;bottom:0;width:6px;left:${x}%;background:currentColor"></div></div>${button('HOOK!',{hook:1},'party-big-button')}</div></div>`;
    }
    else if (game.kind === 'maze') {
      const cells = [];
      for (let y=0;y<7;y++) for (let x=0;x<7;x++) cells.push(`<span class="${x===state.x&&y===state.y?'player':x===6&&y===6?'goal':''}">${x===state.x&&y===state.y?'🤖':x===6&&y===6?'🚪':''}</span>`);
      el.stage.innerHTML = `<div class="party-center"><div><div class="party-path">${cells.join('')}</div><div class="party-buttons">${button('↑',{dir:'up'})}${button('←',{dir:'left'})}${button('↓',{dir:'down'})}${button('→',{dir:'right'})}</div><p>ESCAPE ${state.team}/${game.goal}</p></div></div>`;
    }

    el.stage.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        if (b.dataset.target !== undefined) submit({i:Number(b.dataset.target)});
        else if (b.dataset.value !== undefined) submit({value:b.dataset.value});
        else if (b.dataset.choice !== undefined) submit({choice:Number(b.dataset.choice)});
        else if (b.dataset.resource) submit({resource:b.dataset.resource});
        else if (b.dataset.build) submit({build:true});
        else if (b.dataset.pass) submit({pass:true});
        else if (b.dataset.move) submit({move:b.dataset.move});
        else if (b.dataset.hook) submit({hook:true});
        else if (b.dataset.dir) submit({dir:b.dataset.dir});
      };
    });
  }

  setInterval(() => {
    renderTime();
    if (state && !state.ended && (game.kind === 'bomb' || game.kind === 'timing')) render();
  }, 220);

  render();
})();
