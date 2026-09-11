(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const gameId = 'fps';
  const gameDef = window.ARCADE_GAME;
  if (!gameDef) return;

  const canvas = $('#arcade-canvas'), timeEl = $('#arcade-time'), scoreEl = $('#arcade-score'), rivalEl = $('#arcade-rival'), bestEl = $('#arcade-best');
  const rivalHud = $('#rival-hud'), overlay = $('#arcade-overlay'), overlayTitle = overlay.querySelector('h2'), overlayMessage = $('#overlay-message'), startBtn = $('#arcade-start');
  const toastEl = $('#arcade-toast'), lobby = $('#arcade-lobby'), modeButtons = Array.from(document.querySelectorAll('[data-arcade-mode]'));
  const createBtn = $('#create-duel'), joinBtn = $('#join-duel'), joinInput = $('#join-duel-code'), createdRoom = $('#created-room'), roomCodeEl = $('#duel-room-code'), copyBtn = $('#copy-duel-code');
  const netBadge = $('#network-badge'), duelStatus = $('#duel-status'), duelDetail = $('#duel-detail'), controlsRoot = $('#mobile-controls'), fireButton = $('#fps-fire-button'), fullscreenBtn = $('#fps-fullscreen');

  const cfg = window.SUPABASE_CONFIG || {};
  const hasSupabase = Boolean(cfg.enabled && cfg.url && cfg.publishableKey && window.supabase?.createClient);
  const client = hasSupabase ? window.supabase.createClient(cfg.url, cfg.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null;
  const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const START_DELAY_MS = 2300;
  const makeUuid = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15, v = c === 'x' ? r : (r & 3) | 8; return v.toString(16); });
  const playerToken = makeUuid();
  const bestKey = 'fps-zombie-best-ms';

  let mode = new URLSearchParams(location.search).get('mode') === 'online' ? 'online' : 'solo';
  let engine = null, running = false, localScore = 0, rivalScore = 0, roundStartedAt = 0, timeRaf = 0, finalStats = {};
  let role = null, roomCode = '', channelKey = '', channel = null, connected = false, remoteToken = '', clockOffset = 0, bestRtt = Infinity, syncInterval = 0;
  let pendingScore = null, scoreSendTimer = 0, localFinishedAt = 0, rivalFinishedAt = 0, finishJudgeTimer = 0, rivalStats = {};

  const storageGet = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const storageSet = (k,v) => { try { localStorage.setItem(k,v); } catch (_) {} };
  const formatClock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
  const getBestMs = () => Number(storageGet(bestKey) || 0);

  function toast(text) { toastEl.textContent = text; toastEl.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => toastEl.classList.remove('show'), 650); }
  function setNetworkState(state, title, detail='') { netBadge.dataset.state = state; netBadge.textContent = state === 'connected' ? '接続中' : state === 'waiting' ? '待機中' : state === 'error' ? 'エラー' : '未接続'; duelStatus.textContent = title; duelDetail.textContent = detail; }
  function setOverlay(title, html, buttonText, enabled=true) { overlayTitle.textContent = title; overlayMessage.innerHTML = html; startBtn.textContent = buttonText; startBtn.disabled = !enabled; overlay.classList.remove('hidden'); }
  function normalizeCode(v){ return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); }
  function makeRoomCode(){ let out=''; for(let i=0;i<6;i++) out += ROOM_CHARS[Math.floor(Math.random()*ROOM_CHARS.length)]; return out; }

  function setScore(v) {
    localScore = Math.max(0, Math.round(Number(v)||0)); scoreEl.textContent = String(localScore);
    if (mode === 'online' && connected && running) queueScore(localScore);
  }
  function queueScore(score){ pendingScore = score; if(scoreSendTimer) return; scoreSendTimer=setTimeout(()=>{ scoreSendTimer=0; if(pendingScore!==null) send('score',{score:pendingScore}); pendingScore=null; },60); }

  function createEngine(){
    engine?.destroy?.();
    engine = gameDef.create({
      canvas, controlsRoot, fireButton, mode,
      onScore: setScore,
      onToast: toast,
      onProgress: p => {
        if (mode === 'solo' && p?.boss) duelDetail.textContent = `大型ボス HP ${Math.max(0,p.bossHp)}/${p.bossMaxHp}`;
      },
      onComplete: detail => handleEngineComplete(detail)
    });
  }

  function startStopwatch(){
    cancelAnimationFrame(timeRaf);
    const tick=()=>{ if(!running) return; timeEl.textContent = formatClock(performance.now()-roundStartedAt); timeRaf=requestAnimationFrame(tick); };
    timeRaf=requestAnimationFrame(tick);
  }
  function adjustedNow(){ return role === 'guest' ? Date.now() + clockOffset : Date.now(); }

  function handleEngineComplete(detail){
    if (!running) return;
    finalStats = detail || {};
    if (mode === 'solo') { finishRound(detail?.type==='solo-defeat'?'solo-defeat':'solo-clear'); return; }
    localFinishedAt = adjustedNow();
    send('finish', { score: 20, at: localFinishedAt, stats: detail || {} });
    clearTimeout(finishJudgeTimer);
    finishJudgeTimer = setTimeout(() => {
      if (!running) return;
      if (rivalFinishedAt && rivalFinishedAt < localFinishedAt) finishRound('lose');
      else finishRound('win');
    }, 500);
  }

  function finishRound(result){
    if (!running) return;
    running=false; cancelAnimationFrame(timeRaf); clearTimeout(finishJudgeTimer);
    const stopped = engine?.stop?.() || {};
    finalStats = { ...stopped, ...finalStats };
    if(mode==='solo'){
      const ms=Math.round(finalStats.elapsedMs || (performance.now()-roundStartedAt));
      const accuracy=Math.round((Number(finalStats.accuracy)||0)*100),runScore=Math.max(0,Math.round(Number(finalStats.score)||0)),runKills=Math.max(0,Math.round(Number(finalStats.kills)||0));
      if(result==='solo-defeat'){
        bestEl.textContent = getBestMs() ? formatClock(getBestMs()) : '--';
        setOverlay('YOU DIED', `<div class="arcade-result-score">${runKills} / 20</div><p>スコア <strong>${runScore.toLocaleString()}</strong> • 命中率 <strong>${accuracy}%</strong><br>最大チェイン <strong>${Math.max(0,Math.round(Number(finalStats.bestCombo)||0))}</strong></p>`, 'もう一回', true);
        overlay.dataset.result='1';return;
      }
      const prev=getBestMs(); if(!prev || ms<prev) storageSet(bestKey,String(ms));
      bestEl.textContent = getBestMs() ? formatClock(getBestMs()) : '--';
      setOverlay('ESCAPED!', `<div class="arcade-result-score">20 / 20</div><p>大型ボス撃破 • スコア <strong>${runScore.toLocaleString()}</strong><br>クリアタイム <strong>${formatClock(ms)}</strong> • 命中率 <strong>${accuracy}%</strong>${getBestMs()===ms?'<br>NEW BEST!':''}</p>`, 'もう一回', true);
    } else {
      const title = result === 'win' ? 'YOU WIN!' : result === 'lose' ? 'YOU LOSE' : 'DRAW';
      setOverlay(title, `<div class="arcade-result-vs"><span>YOU<strong>${localScore}</strong></span><b>HIT</b><span>RIVAL<strong>${rivalScore}</strong></span></div><p>${result==='win'?'20HIT先取！':'相手が先に20HITしました。'}</p>`, role==='host'?'再戦する':'ホストの再戦待ち', role==='host'&&connected);
    }
    overlay.dataset.result='1';
  }

  function beginRound(seed){
    localFinishedAt=0; rivalFinishedAt=0; rivalStats={}; finalStats={}; localScore=0; rivalScore=0;
    scoreEl.textContent='0'; rivalEl.textContent='0'; timeEl.textContent='0:00'; overlay.dataset.result=''; overlay.classList.add('hidden');
    running=true; roundStartedAt=performance.now(); createEngine(); engine.start(seed>>>0); startStopwatch();
  }
  function scheduleStart(seed, hostAt){
    const localAt = role === 'guest' ? hostAt - clockOffset : hostAt;
    const tick=()=>{ const left=localAt-Date.now(); if(left<=0){ beginRound(seed); return; } const n=Math.max(1,Math.ceil(left/700)); setOverlay('READY',`<div style="font-size:72px;font-weight:950">${n}</div>`,'開始待ち',false); requestAnimationFrame(tick); };
    tick();
  }
  function soloStart(){ const seed=crypto.getRandomValues(new Uint32Array(1))[0]||1, at=Date.now()+1700; const tick=()=>{ const left=at-Date.now(); if(left<=0){beginRound(seed);return;} setOverlay('READY',`<div style="font-size:72px;font-weight:950">${Math.max(1,Math.ceil(left/550))}</div>`,'開始待ち',false); requestAnimationFrame(tick);}; tick(); }
  function hostStart(){ if(role!=='host'||!connected)return; const seed=crypto.getRandomValues(new Uint32Array(1))[0]||1, at=Date.now()+START_DELAY_MS; send('start',{seed,at}); scheduleStart(seed,at); }

  async function leaveRoom(){
    clearInterval(syncInterval); syncInterval=0; connected=false; remoteToken='';
    if(channel&&client){ try{await channel.untrack();}catch(_){} try{await client.removeChannel(channel);}catch(_){} }
    channel=null;
    if(roomCode&&client){ try{await client.rpc('leave_game_room',{p_code:roomCode,p_player_token:playerToken});}catch(_){} }
    role=null; roomCode=''; channelKey=''; createdRoom.classList.add('hidden'); roomCodeEl.textContent='------'; rivalScore=0; rivalEl.textContent='0';
  }
  function send(event,data={}){ if(!channel)return; channel.send({type:'broadcast',event,payload:{sender:playerToken,...data}}).catch(()=>{}); }
  function startClockSync(){ clearInterval(syncInterval); bestRtt=Infinity; let sent=0; const ping=()=>{if(!connected||sent>=7){clearInterval(syncInterval);return;}sent++;send('ping',{t0:Date.now()});}; ping(); syncInterval=setInterval(ping,170); }

  async function subscribeRoom(kind,key){
    if(!client) throw new Error('SUPABASE_UNAVAILABLE');
    channel=client.channel(`duel:${key}`,{config:{broadcast:{self:false},presence:{key:playerToken}}});
    channel.on('broadcast',{event:'hello'},({payload})=>{ if(kind!=='host'||!payload?.sender||payload.sender===playerToken)return; remoteToken=payload.sender; connected=true; send('ack',{to:remoteToken}); setNetworkState('connected','対戦相手が参加しました！','先に20HITで勝利。時間制限なし。'); startBtn.disabled=false; startBtn.textContent='対戦スタート'; });
    channel.on('broadcast',{event:'ack'},({payload})=>{ if(kind!=='guest'||!payload?.sender||(payload.to&&payload.to!==playerToken))return; remoteToken=payload.sender; connected=true; setNetworkState('connected','ホストと接続しました！','先に20HITで勝利。時間制限なし。'); setOverlay(gameDef.title,'接続完了。ホストの開始を待っています。','ホストの開始待ち',false); startClockSync(); });
    channel.on('broadcast',{event:'ping'},({payload})=>{ if(kind==='host'&&payload?.t0) send('pong',{to:payload.sender,t0:payload.t0,hostNow:Date.now()}); });
    channel.on('broadcast',{event:'pong'},({payload})=>{ if(kind!=='guest'||(payload.to&&payload.to!==playerToken))return; const now=Date.now(),t0=Number(payload.t0)||now,rtt=now-t0; if(rtt>=0&&rtt<bestRtt){bestRtt=rtt;clockOffset=Number(payload.hostNow||now)-(t0+now)/2;} });
    channel.on('broadcast',{event:'start'},({payload})=>{ if(payload?.seed&&payload?.at) scheduleStart(Number(payload.seed),Number(payload.at)); });
    channel.on('broadcast',{event:'score'},({payload})=>{ if(payload?.sender===playerToken)return; rivalScore=Math.max(0,Math.min(20,Math.round(Number(payload?.score)||0))); rivalEl.textContent=String(rivalScore); });
    channel.on('broadcast',{event:'finish'},({payload})=>{
      if(payload?.sender===playerToken)return;
      rivalScore=Math.max(0,Math.min(20,Math.round(Number(payload?.score)||0))); rivalEl.textContent=String(rivalScore); rivalFinishedAt=Number(payload?.at)||adjustedNow(); rivalStats=payload?.stats||{};
      if(!running)return;
      if(!localFinishedAt){ finishRound('lose'); return; }
      if(rivalFinishedAt < localFinishedAt) finishRound('lose'); else finishRound('win');
    });
    channel.on('presence',{event:'leave'},({leftPresences})=>{ if(!connected||!remoteToken)return; const left=(leftPresences||[]).some(x=>x.playerToken===remoteToken); if(left){connected=false;setNetworkState('error','対戦相手との接続が切れました','同じ部屋へ再参加してください。');if(running)toast('RIVAL DISCONNECTED');} });
    await new Promise((resolve,reject)=>{ let settled=false; const t=setTimeout(()=>{if(!settled){settled=true;reject(new Error('TIMEOUT'));}},9000); channel.subscribe(async(status,error)=>{ if(status==='SUBSCRIBED'&&!settled){settled=true;clearTimeout(t);try{await channel.track({playerToken,role:kind,gameId,joinedAt:Date.now()});}catch(_){}resolve();} else if((status==='CHANNEL_ERROR'||status==='TIMED_OUT')&&!settled){settled=true;clearTimeout(t);reject(error||new Error(status));} }); });
  }

  async function createRoom(attempt=0){
    if(!client){setNetworkState('error','Supabaseに接続できません','ページを再読み込みしてください。');return;}
    await leaveRoom(); role='host'; roomCode=makeRoomCode(); setNetworkState('waiting','部屋を作成しています…');
    const {data,error}=await client.rpc('create_duel_room',{p_code:roomCode,p_player_token:playerToken,p_game_id:gameId});
    if(error){ if(String(error.message).includes('ROOM_CODE_TAKEN')&&attempt<5)return createRoom(attempt+1); setNetworkState('error','部屋を作れませんでした','もう一度試してください。');return; }
    const row=Array.isArray(data)?data[0]:data; channelKey=row?.channel_key||'';
    try{ await subscribeRoom('host',channelKey); createdRoom.classList.remove('hidden');roomCodeEl.textContent=roomCode;setNetworkState('waiting','相手の参加を待っています',`部屋コード ${roomCode}`);setOverlay(gameDef.title,`部屋 <strong>${roomCode}</strong> を作成しました。相手の参加を待っています。`,'相手の参加待ち',false);}catch(_){setNetworkState('error','Realtime接続に失敗しました','ページを再読み込みしてください。');}
  }
  async function joinRoom(){
    const code=normalizeCode(joinInput.value);joinInput.value=code;if(code.length!==6){setNetworkState('error','部屋コードを確認してください','6桁を入力してください。');return;}if(!client)return;
    await leaveRoom();role='guest';roomCode=code;setNetworkState('waiting','部屋を探しています…',code);
    const {data,error}=await client.rpc('join_duel_room',{p_code:code,p_player_token:playerToken,p_game_id:gameId});
    if(error){const m=String(error.message||'');setNetworkState('error','参加できませんでした',m.includes('ROOM_NOT_FOUND')?'部屋が見つかりません。':m.includes('ROOM_FULL')?'2人参加済みです。':'接続に失敗しました。');return;}
    const row=Array.isArray(data)?data[0]:data;channelKey=row?.channel_key||'';
    try{await subscribeRoom('guest',channelKey);setNetworkState('waiting','ホストへ接続しています…',`部屋 ${roomCode}`);send('hello');setTimeout(()=>{if(!connected)setNetworkState('error','ホストが応答しません','ホスト側で部屋が開かれているか確認してください。');},7000);}catch(_){setNetworkState('error','Realtime接続に失敗しました','ページを再読み込みしてください。');}
  }

  function resetForMode(){
    if(running){running=false;cancelAnimationFrame(timeRaf);engine?.stop?.();}
    clearTimeout(finishJudgeTimer); overlay.dataset.result=''; localScore=0;rivalScore=0;scoreEl.textContent='0';rivalEl.textContent='0';timeEl.textContent='0:00';
    bestEl.textContent = mode==='solo' && getBestMs() ? formatClock(getBestMs()) : '--';
    lobby.classList.toggle('hidden',mode!=='online');rivalHud.classList.toggle('hidden-hud',mode!=='online');modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.arcadeMode===mode));
    const url=new URL(location.href);url.searchParams.set('mode',mode);history.replaceState(null,'',url);
    if(mode==='solo') setOverlay(gameDef.title,'通常ゾンビは命中すれば1発。デブゾンビとボスだけが複数発に耐えます。19体倒すと悪魔城に大型ボスが出現。セカンドウィンドは1回だけです。','スタート',true);
    else if(!hasSupabase){setOverlay(gameDef.title,'Supabaseを読み込めませんでした。','対戦を利用できません',false);setNetworkState('error','Supabaseを読み込めません');}
    else{setOverlay(gameDef.title,'部屋を作るか参加してください。先に20発HITしたプレイヤーの勝ちです。時間制限はありません。','接続待ち',false);setNetworkState('idle','部屋を作るか参加してください。','ログイン不要・20HIT先取。');}
    createEngine();
  }

  function bindFullscreen(){
    const shell=$('.arcade-shell'); if(!fullscreenBtn||!shell)return;
    const supported=Boolean(shell.requestFullscreen||shell.webkitRequestFullscreen);
    if(!supported){fullscreenBtn.disabled=true;fullscreenBtn.textContent='全画面非対応';return;}
    const isFs=()=>document.fullscreenElement===shell||document.webkitFullscreenElement===shell;
    const update=()=>fullscreenBtn.textContent=isFs()?'全画面を終了':'全画面で遊ぶ';
    fullscreenBtn.addEventListener('click',async()=>{try{if(isFs()){if(document.exitFullscreen)await document.exitFullscreen();else document.webkitExitFullscreen?.();}else{if(shell.requestFullscreen)await shell.requestFullscreen({navigationUI:'hide'});else shell.webkitRequestFullscreen?.();try{await screen.orientation?.lock?.('landscape');}catch(_){}}}catch(_){toast('FULLSCREEN ERROR');}update();});
    document.addEventListener('fullscreenchange',update);document.addEventListener('webkitfullscreenchange',update);update();
  }

  startBtn.addEventListener('click',()=>{overlay.dataset.result='';if(mode==='solo')soloStart();else if(role==='host'&&connected)hostStart();});
  modeButtons.forEach(btn=>btn.addEventListener('click',async()=>{const next=btn.dataset.arcadeMode;if(!next||next===mode)return;await leaveRoom();mode=next;resetForMode();}));
  createBtn?.addEventListener('click',()=>createRoom()); joinBtn?.addEventListener('click',()=>joinRoom()); joinInput?.addEventListener('input',()=>joinInput.value=normalizeCode(joinInput.value)); joinInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();joinRoom();}});
  copyBtn?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(roomCode);copyBtn.textContent='コピーしました';setTimeout(()=>copyBtn.textContent='コードをコピー',1000);}catch(_){}});
  window.addEventListener('beforeunload',()=>{if(channel){try{channel.untrack();}catch(_){}}});

  bindFullscreen(); resetForMode();
})();
