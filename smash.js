(() => {
  'use strict';

  const canvas = document.getElementById('game');
  let ctx = canvas.getContext('2d');
  const graphics=new AitechFrameBudget({coarse:matchMedia('(pointer:coarse)').matches});
  let graphicsCpu=0,graphicsRatio=1;
  const renderLayers=new Map();
  function clearLayers(){for(const c of renderLayers.values())c.width=c.height=1;renderLayers.clear();}
  function layer(key,w,h,paint){key+=':'+graphicsRatio;let c=renderLayers.get(key);if(!c){if(renderLayers.size>24)clearLayers();c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w*graphicsRatio));c.height=Math.max(1,Math.ceil(h*graphicsRatio));const previous=ctx;ctx=c.getContext('2d');ctx.setTransform(graphicsRatio,0,0,graphicsRatio,0,0);try{paint();}finally{ctx=previous;}renderLayers.set(key,c);}return c;}
  Object.defineProperty(window,'skybreakGraphics',{get:()=>({...graphics.stats,width:canvas.width,height:canvas.height,layers:renderLayers.size})});
  const $ = id => document.getElementById(id);
  const screens = {
    start: $('start-screen'),
    how: $('how-screen'),
    pause: $('pause-screen'),
    result: $('result-screen')
  };

  const ROSTER = [
    { id:'volt', name:'VOLT', title:'迅雷の剣士', color:'#43e8ff', dark:'#076f91', glyph:'⚡', speed:6.25, air:0.48, jump:12.9, weight:1.00, power:1.00, fall:0.61, special:'雷刃ダッシュ', weapon:'blade' },
    { id:'brakk', name:'BRAKK', title:'紅蓮の重戦士', color:'#ff4c56', dark:'#8e1626', glyph:'◆', speed:4.55, air:0.35, jump:11.1, weight:1.34, power:1.26, fall:0.72, special:'火山拳', weapon:'fist' },
    { id:'nyx', name:'NYX', title:'虚空の影', color:'#ad63ff', dark:'#4b198b', glyph:'☾', speed:6.85, air:0.55, jump:13.5, weight:0.86, power:0.92, fall:0.57, special:'影渡り', weapon:'dagger' },
    { id:'aero', name:'AERO', title:'蒼穹の射手', color:'#60ffad', dark:'#08794c', glyph:'✦', speed:5.45, air:0.52, jump:14.0, weight:0.92, power:0.92, fall:0.54, special:'風弾', weapon:'bow' }
  ];

  const STAGES = {
    battlefield: {
      name:'BATTLEFIELD', sky:['#090829','#3f3694','#ff6889'], glow:'#9a74ff',
      platforms:[
        {x:.16,y:.73,w:.68,h:.055,main:true},
        {x:.17,y:.49,w:.23,h:.032}, {x:.60,y:.49,w:.23,h:.032},
        {x:.38,y:.32,w:.24,h:.032}
      ]
    },
    final: {
      name:'FINAL PLATFORM', sky:['#050c24','#164b81','#43c6d9'], glow:'#42e8ff',
      platforms:[{x:.12,y:.70,w:.76,h:.06,main:true}]
    },
    ruins: {
      name:'SKY RUINS', sky:['#160722','#6c255f','#f09a71'], glow:'#ffbd73',
      platforms:[
        {x:.20,y:.74,w:.60,h:.052,main:true},
        {x:.08,y:.53,w:.24,h:.032}, {x:.68,y:.53,w:.24,h:.032},
        {x:.39,y:.38,w:.22,h:.032}
      ]
    }
  };

  let selected = 0;
  let opponent = -1;
  let mode = 'cpu';
  let cpuLevel = 6;
  let stageKey = 'battlefield';
  let itemsEnabled = true;
  let gameState = 'menu';
  let players = [];
  let projectiles = [];
  let particles = [];
  let items = [];
  let effects = [];
  let itemClock = 10;
  let matchTime = 420;
  let lastTime = performance.now();
  let screenShake = 0;
  let hitFreeze = 0;
  let cameraZoom = 1;
  let audioContext = null;
  let onlineSession = null;
  let onlineRemote = {};
  let countdownTimer = null;
  let winnerSlot = null;
  const arenaIllustration=new Image();arenaIllustration.decoding='async';arenaIllustration.onload=clearLayers;arenaIllustration.src='arcade100/assets/worlds.webp';
  let arenaHD=null,arenaTheme=-1;
  function loadArena(){const index=stageKey==='ruins'?0:stageKey==='final'?14:13;if(arenaTheme===index)return;arenaTheme=index;arenaHD=null;clearLayers();const image=new Image();image.decoding='async';image.onload=()=>{if(arenaTheme===index){arenaHD=image;clearLayers();}};image.src='arcade100/assets/worlds-hd/'+String(index).padStart(2,'0')+'.webp';}
  const fighterIllustration=new Image();fighterIllustration.src='arcade100/assets/fighters.webp';
  const FIGHTER_FRAMES=[[[31,36,262,255],[325,48,252,237],[633,66,390,216],[1019,53,214,238]],[[38,331,241,285],[350,343,292,259],[633,354,349,257],[1009,354,223,238]],[[39,646,235,273],[324,665,286,244],[635,687,367,228],[1011,664,226,229]],[[32,950,243,275],[340,960,268,248],[645,933,326,289],[1026,951,195,260]]];
  function fighterPortraitStyle(index){const [x,y,w,h]=FIGHTER_FRAMES[index][0];return `background-image:url('arcade100/assets/fighters.webp');background-size:${1254/w*100}% ${1254/h*100}%;background-position:${x/(1254-w)*100}% ${y/(1254-h)*100}%;aspect-ratio:${w}/${h}`;}


  const held = new Set();
  const pressed = new Set();
  const released = new Set();
  const touchHeld = new Set();
  const touchPressed = new Set();
  const touchReleased = new Set();

  function renderRoster() {
    $('roster').innerHTML = ROSTER.map((f, i) => `
      <button class="fighter-card ${i === selected ? 'active' : ''}" style="--fighter:${f.color}" data-fighter="${i}" type="button">
        <span class="fighter-illustration" aria-hidden="true" style="${fighterPortraitStyle(i)}"></span><strong>${f.name}</strong><span>${f.title}</span><small>${f.special}</small>
      </button>`).join('');
    document.querySelectorAll('[data-fighter]').forEach(button => {
      button.addEventListener('click', () => {
        selected = Number(button.dataset.fighter);
        renderRoster();
        tone(520 + selected * 90, .06, 'square', .025);
      });
    });
  }

  renderRoster();

  document.querySelectorAll('[data-mode]').forEach(button => {
    button.addEventListener('click', () => {
      mode = button.dataset.mode;
      document.querySelectorAll('[data-mode]').forEach(item => item.classList.toggle('active', item === button));
      $('opponent-picker').firstElementChild.textContent = mode === 'cpu' ? '対戦相手' : 'PLAYER 2';
      $('cpu-level-wrap').classList.toggle('disabled-option', mode !== 'cpu');
      $('online-room')?.classList.toggle('hidden', mode !== 'online');
      $('start-btn').classList.toggle('hidden', mode === 'online');
      tone(430, .05, 'square', .02);
    });
  });

  $('opponent-btn').addEventListener('click', () => {
    opponent = (opponent + 1) % ROSTER.length;
    $('opponent-btn').textContent = ROSTER[opponent].name;
  });
  $('cpu-level').addEventListener('input', event => {
    cpuLevel = Number(event.target.value);
    $('cpu-level-value').value = String(cpuLevel);
  });
  $('stage-select').addEventListener('change', event => stageKey = event.target.value);
  $('items-toggle').addEventListener('change', event => itemsEnabled = event.target.checked);
  $('how-btn').addEventListener('click', () => screens.how.classList.remove('hidden'));
  $('how-close').addEventListener('click', () => screens.how.classList.add('hidden'));
  $('start-btn').addEventListener('click', startMatch);
  $('pause-btn').addEventListener('click', togglePause);
  $('resume-btn').addEventListener('click', togglePause);
  $('quit-btn').addEventListener('click', returnToMenu);
  $('select-btn').addEventListener('click', returnToMenu);
  $('rematch-btn').addEventListener('click', startMatch);
  $('fullscreen-btn').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $('shell').requestFullscreen?.();
  });

  const quality=document.createElement('select');quality.setAttribute('aria-label','グラフィック品質');quality.className='graphics-quality';quality.innerHTML='<option value="auto">画質：自動</option><option value="high">高画質</option><option value="balanced">標準</option><option value="low">軽量</option>';try{graphics.setMode(localStorage.getItem('skybreak.graphics')||'auto');}catch{}quality.value=graphics.mode;document.querySelector('.topbar').append(quality);quality.onchange=()=>{graphics.setMode(quality.value);try{localStorage.setItem('skybreak.graphics',graphics.mode);}catch{}resize();};
  function resize() {
    const ratio=graphics.scale(innerWidth,innerHeight,devicePixelRatio||1);graphicsRatio=ratio;clearLayers();
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    canvas.viewWidth = innerWidth;
    canvas.viewHeight = innerHeight;
    if(onlineSession){canvas.viewWidth=1280;canvas.viewHeight=720;ctx.setTransform(ratio*innerWidth/1280,0,0,ratio*innerHeight/720,0,0);}
  }
  addEventListener('resize', resize);
  resize();

  function createPlayer(fighterIndex, slot, cpu) {
    const fighter = ROSTER[fighterIndex];
    return {
      fighter, slot, cpu,
      x: canvas.viewWidth * (slot ? .66 : .34), y: canvas.viewHeight * .22,
      previousY: 0, vx: 0, vy: 0, width: fighter.id === 'brakk' ? 42 : 34, height: fighter.id === 'brakk' ? 62 : 56,
      face: slot ? -1 : 1, grounded: false, platform: null, jumps: 2,
      damage: 0, stocks: 3, shield: 100, shieldDelay: 0,
      action: null, charge: null, hitstun: 0, stun: 0, invincible: 0,
      dodge: 0, helpless: false, fastFall: false, counter: 0,
      ledge: null, ledgeLock: 0, dropTimer: 0,
      grabbedBy: null, grabbing: null, grabTimer: 0,
      dead: false, respawn: 0, respawnPlatform: 0,
      trail: [], stale: [], aiClock: 0, aiPlan: {},
      kos: 0, falls: 0, damageGiven: 0
    };
  }

  function startMatch() {
    if(mode==='online'&&!onlineSession?.starting){window.dispatchEvent(new CustomEvent('skybreak-start-request'));return;}
    if(onlineSession)onlineSession.starting=false;
    clearInterval(countdownTimer);winnerSlot=null;
    initAudio();
    const choices = [0,1,2,3].filter(index => index !== selected);
    const rival = opponent < 0 ? choices[Math.floor(Math.random() * choices.length)] : opponent;
    players = [createPlayer(selected, 0, false), createPlayer(rival, 1, mode === 'cpu')];
    projectiles = [];
    particles = [];
    items = [];
    effects = [];
    itemClock = 8 + Math.random() * 4;
    matchTime = 420;
    gameState = 'countdown';
    screenShake = 0;
    hitFreeze = 0;
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    $('hud').classList.remove('hidden');
    $('touch-controls').classList.remove('hidden');
    updateHud();
    let count = 3;
    announce('3');
    tone(330, .08, 'square', .035);
    countdownTimer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        announce(String(count));
        tone(330 + (3 - count) * 80, .08, 'square', .035);
      } else {
        clearInterval(countdownTimer);
        announce('GO!');
        tone(720, .16, 'sawtooth', .045);
        gameState = 'playing';
        lastTime = performance.now();
      }
    }, 650);
  }

  function returnToMenu() {
    clearInterval(countdownTimer);
    if(onlineSession){window.dispatchEvent(new CustomEvent('skybreak-leave-request'));onlineSession=null;mode='cpu';resize();}
    gameState = 'menu';
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens.start.classList.remove('hidden');
    $('hud').classList.add('hidden');
    $('touch-controls').classList.add('hidden');
  }

  function togglePause() {
    if(onlineSession){announce('オンライン対戦中');return;}
    if (gameState === 'playing') {
      gameState = 'paused';
      screens.pause.classList.remove('hidden');
    } else if (gameState === 'paused') {
      gameState = 'playing';
      screens.pause.classList.add('hidden');
      lastTime = performance.now();
    }
  }

  function announce(text) {
    const element = $('announcement');
    element.textContent = text;
    element.classList.remove('show');
    void element.offsetWidth;
    element.classList.add('show');
  }

  function controlFor(player) {
    if(onlineSession&&player.slot!==onlineSession.side){const c={...onlineRemote};for(const key of Object.keys(onlineRemote))if(key.endsWith('Press')||key.endsWith('Release'))onlineRemote[key]=false;return c;}
    if (player.cpu) return cpuControl(player);
    const map = onlineSession || player.slot === 0
      ? {left:'KeyA', right:'KeyD', down:'KeyS', up:'KeyW', attack:'KeyJ', special:'KeyK', shield:'KeyL', grab:'KeyI'}
      : {left:'ArrowLeft', right:'ArrowRight', down:'ArrowDown', up:'ArrowUp', attack:'Numpad1', special:'Numpad2', shield:'Numpad3', grab:'Numpad0'};
    const touchAllowed = !!onlineSession || player.slot === 0;
    const pad = navigator.getGamepads?.()[onlineSession?0:player.slot];
    const oldPad = player.padButtons || [];
    const padButton = index => Boolean(pad?.buttons[index]?.pressed);
    const padPress = index => padButton(index) && !oldPad[index];
    const padRelease = index => !padButton(index) && Boolean(oldPad[index]);
    const axisX = Math.abs(pad?.axes?.[0] || 0) > .28 ? pad.axes[0] : 0;
    const axisY = Math.abs(pad?.axes?.[1] || 0) > .28 ? pad.axes[1] : 0;
    const isHeld = name => held.has(map[name]) || (touchAllowed && touchHeld.has(name));
    const isPressed = name => pressed.has(map[name]) || (touchAllowed && touchPressed.has(name));
    const isReleased = name => released.has(map[name]) || (touchAllowed && touchReleased.has(name));
    const result = {
      left:isHeld('left') || axisX < 0, right:isHeld('right') || axisX > 0,
      down:isHeld('down') || axisY > 0, up:isHeld('up') || (touchAllowed && touchHeld.has('jump')) || axisY < 0,
      jumpPress:isPressed('up') || (touchAllowed && touchPressed.has('jump')) || padPress(2) || padPress(3),
      jumpRelease:isReleased('up') || (touchAllowed && touchReleased.has('jump')) || padRelease(2) || padRelease(3),
      attack:isHeld('attack') || padButton(0), attackPress:isPressed('attack') || padPress(0), attackRelease:isReleased('attack') || padRelease(0),
      specialPress:isPressed('special') || padPress(1), shield:isHeld('shield') || padButton(4) || padButton(6) || padButton(7),
      shieldPress:isPressed('shield') || padPress(4) || padPress(6) || padPress(7), grabPress:isPressed('grab') || padPress(5),
      anyPress:[...pressed].some(code => Object.values(map).includes(code)) || (touchAllowed && touchPressed.size > 0) || Boolean(pad?.buttons.some(button => button.pressed))
    };
    player.padButtons = pad ? pad.buttons.map(button => button.pressed) : [];
    return result;
  }

  function cpuControl(player) {
    const enemy = players[1 - player.slot];
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const difficulty = cpuLevel / 9;
    const outOfBounds = player.y > canvas.viewHeight * .70 || player.x < canvas.viewWidth * .12 || player.x > canvas.viewWidth * .88;
    player.aiClock -= 1;
    if (player.aiClock <= 0) {
      player.aiClock = Math.max(3, 19 - cpuLevel * 1.65) + Math.random() * 8;
      const approach = Math.abs(dx) > 72;
      player.aiPlan = {
        left: approach ? dx < 0 : Math.random() < .18,
        right: approach ? dx > 0 : Math.random() < .18,
        attack: Math.abs(dx) < 88 && Math.abs(dy) < 75 && Math.random() < .40 + difficulty * .32,
        special: Math.abs(dx) > 85 && Math.abs(dx) < 300 && Math.abs(dy) < 120 && Math.random() < .18 + difficulty * .25,
        shield: enemy.action && Math.abs(dx) < 110 && Math.random() < .30 + difficulty * .48,
        grab: enemy.shielding && Math.abs(dx) < 58 && Math.random() < .55,
        jump: (dy < -72 && player.jumps > 0) || (Math.random() < .10 + difficulty * .08),
        down: dy > 95 && Math.random() < .35
      };
    }
    const plan = player.aiPlan;
    if (outOfBounds) {
      const toward = canvas.viewWidth / 2 - player.x;
      return {
        left:toward < 0, right:toward > 0, down:false, up:true, jumpPress:player.jumps > 0 && Math.random() < .18, jumpRelease:false,
        attack:false, attackPress:false, attackRelease:false,
        specialPress:player.jumps === 0 || player.y > canvas.viewHeight * .66,
        shield:false, shieldPress:false, grabPress:false, anyPress:true
      };
    }
    const attackNow = Boolean(plan.attack && Math.random() < .18 + difficulty * .1);
    const specialNow = Boolean(plan.special && Math.random() < .10 + difficulty * .06);
    const grabNow = Boolean(plan.grab && Math.random() < .22);
    const jumpNow = Boolean(plan.jump && Math.random() < .11 + difficulty * .05);
    return {
      left:Boolean(plan.left), right:Boolean(plan.right), down:Boolean(plan.down), up:dy < -35,
      jumpPress:jumpNow, jumpRelease:false, attack:attackNow, attackPress:attackNow, attackRelease:false,
      specialPress:specialNow, shield:Boolean(plan.shield), shieldPress:Boolean(plan.shield && Math.random() < .09),
      grabPress:grabNow, anyPress:attackNow || specialNow || grabNow || jumpNow
    };
  }

  function directionOf(control, player) {
    if (control.up) return 'up';
    if (control.down) return 'down';
    if (control.left || control.right) {
      const world = control.left ? -1 : 1;
      return world === player.face ? 'forward' : 'back';
    }
    return 'neutral';
  }

  function update(dt) {
    if (gameState !== 'playing') return;
    matchTime = Math.max(0, matchTime - dt);
    if (matchTime <= 0) {
      const value = player => player.stocks * 1000 - player.damage;
      finishMatch(value(players[0]) >= value(players[1]) ? 0 : 1);
      return;
    }

    if (itemsEnabled) {
      itemClock -= dt;
      if (itemClock <= 0) {
        spawnItem();
        itemClock = 12 + Math.random() * 9;
      }
    }

    const controls = players.map(controlFor);
    players.forEach((player, index) => updatePlayer(player, controls[index], dt, index));
    updateProjectiles(dt);
    updateItems(dt);
    updateParticles(dt);
    updateEffects(dt);
    screenShake = Math.max(0, screenShake - dt * 34);
    updateHud();
    pressed.clear();
    released.clear();
    touchPressed.clear();
    touchReleased.clear();
  }

  function updatePlayer(player, control, dt, index) {
    const frame = dt * 60;
    player.previousY = player.y;
    player.invincible = Math.max(0, player.invincible - dt);
    player.hitstun = Math.max(0, player.hitstun - dt);
    player.stun = Math.max(0, player.stun - dt);
    player.dodge = Math.max(0, player.dodge - dt);
    player.counter = Math.max(0, player.counter - dt);
    player.ledgeLock = Math.max(0, player.ledgeLock - dt);
    player.dropTimer = Math.max(0, player.dropTimer - dt);
    player.shieldDelay = Math.max(0, player.shieldDelay - dt);

    if (player.respawn > 0) {
      player.respawn -= dt;
      if (player.respawn <= 0) respawnPlayer(player);
      return;
    }
    if (player.dead) return;
    if (player.grabbedBy) {
      const holder = player.grabbedBy;
      player.x = holder.x + holder.face * 25;
      player.y = holder.y - 3;
      return;
    }

    if (player.ledge) {
      updateLedge(player, control, dt);
      return;
    }

    if (player.grabbing) {
      updateGrabHold(player, control, dt);
    }

    if (player.action) updateAction(player, dt, index);

    const movable = player.hitstun <= 0 && player.stun <= 0 && !player.grabbing;
    if (player.hitstun > 0) {
      const influence = (control.right ? 1 : 0) - (control.left ? 1 : 0);
      player.vx += influence * .045 * frame;
      if (control.down) player.vy += .035 * frame;
    }

    if (movable) {
      handleDefense(player, control);
      handleChargeAndAttacks(player, control, dt);
      if (!player.action || player.action.allowMove) handleMovement(player, control, frame);
    }

    if (!player.shielding) {
      const recovery = player.shieldDelay > 0 ? 0 : 17 * dt;
      player.shield = Math.min(100, player.shield + recovery);
    }

    if (player.dodge <= 0) player.invincible = Math.min(player.invincible, 2.5);

    player.vy += player.fighter.fall * frame;
    if (player.fastFall && player.vy > 0) player.vy += .30 * frame;
    player.vx *= Math.pow(player.grounded ? .77 : .988, frame);
    player.x += player.vx * frame;
    player.y += player.vy * frame;

    const wasGrounded = player.grounded;
    player.grounded = false;
    player.platform = null;
    resolvePlatforms(player, control, wasGrounded);
    tryGrabLedge(player);

    player.trail.unshift({x:player.x, y:player.y, life:.12});
    if (player.trail.length > 7) player.trail.pop();

    const w = canvas.viewWidth;
    const h = canvas.viewHeight;
    if (player.y > h + 145 || player.y < -190 || player.x < -180 || player.x > w + 180) knockOut(player, index);
  }

  function handleMovement(player, control, frame) {
    if (player.shielding || player.charge) return;
    const axis = (control.right ? 1 : 0) - (control.left ? 1 : 0);
    if (axis) {
      player.face = axis;
      const acceleration = player.grounded ? .82 : player.fighter.air;
      player.vx += axis * acceleration * frame;
      const cap = player.fighter.speed * (player.grounded ? 1 : .92);
      player.vx = clamp(player.vx, -cap, cap);
    }
    if (control.jumpPress && player.jumps > 0) {
      player.vy = -player.fighter.jump * (player.grounded ? 1 : .92);
      player.jumps -= 1;
      player.grounded = false;
      player.fastFall = false;
      player.dropTimer = .10;
      burst(player.x, player.y + player.height / 2, player.fighter.color, 7, 4);
      tone(260 + player.slot * 40, .045, 'sine', .02);
    }
    if (control.jumpRelease && player.vy < -4.5) player.vy *= .58;
    if (!player.grounded && control.down && player.vy > 0 && !player.fastFall) {
      player.fastFall = true;
      player.vy += 2.4;
      streak(player.x, player.y - 30, '#ffffff', 0, 8);
    }
    if (player.grounded && control.down) player.dropTimer = .16;
  }

  function handleDefense(player, control) {
    if (control.shieldPress && !player.grounded && !player.action && player.dodge <= 0) {
      const axis = (control.right ? 1 : 0) - (control.left ? 1 : 0);
      player.action = makeAction('AIR DODGE', .44, .30, .01, null, true);
      player.dodge = .75;
      player.invincible = .28;
      player.vx = axis * 7.5;
      player.vy = control.up ? -6.8 : control.down ? 7 : 0;
      player.helpless = true;
      return;
    }
    if (control.shieldPress && player.grounded && !player.action && player.dodge <= 0) {
      const axis = (control.right ? 1 : 0) - (control.left ? 1 : 0);
      if (axis || control.down) {
        player.action = makeAction(axis ? 'ROLL' : 'SPOT DODGE', axis ? .42 : .34, .26, .01, null, true);
        player.dodge = .62;
        player.invincible = axis ? .27 : .23;
        if (axis) {
          player.face = axis;
          player.vx = axis * 9.2;
        }
        burst(player.x, player.y + 12, '#b9ecff', 8, 3);
        return;
      }
    }
    player.shielding = Boolean(control.shield && player.grounded && !player.action && player.shield > 0 && !player.charge);
    if (player.shielding) {
      player.vx *= .75;
      player.shield = Math.max(0, player.shield - .34);
      player.shieldDelay = .55;
      if (player.shield <= 0) shieldBreak(player);
    }
  }

  function handleChargeAndAttacks(player, control, dt) {
    if (player.shielding || player.grabbing || player.grabbedBy) return;
    const direction = directionOf(control, player);

    if (player.action?.name === 'JAB' && control.attackPress && player.action.time > .11) {
      player.action = makeAction('JAB 2', .30, .13, .05, hitboxFrom({dmg:5.5,angle:46,base:3.0,growth:.038,x:31,y:-2,r:27}), true);
      whoosh(1.05);
      return;
    }

    if (player.charge) {
      player.charge.time = Math.min(1, player.charge.time + dt / .85);
      if (Math.random() < .32) burst(player.x + player.face * 23, player.y, player.fighter.color, 1, 2.5);
      if (control.attackRelease || player.charge.time >= 1) {
        if (player.charge.time < .17) startNormal(player, player.charge.direction, false);
        else startSmash(player, player.charge.direction, player.charge.time);
        player.charge = null;
      }
      return;
    }

    if (control.grabPress && !player.action) {
      startGrab(player);
      return;
    }
    if (control.specialPress && !player.action) {
      startSpecial(player, direction);
      return;
    }
    if (control.attackPress && !player.action) {
      if (!player.grounded) {
        startNormal(player, direction, true);
      } else if (direction === 'neutral') {
        startNormal(player, 'neutral', false);
      } else {
        player.charge = {direction, time:0};
        player.vx *= .45;
      }
    }
  }

  function makeAction(name, duration, endLag, activeFrom, hitbox, allowMove = false) {
    return {name, time:0, duration, endLag, activeFrom, activeTo:activeFrom + (hitbox ? .10 : 0), hitbox, hit:false, spawned:false, allowMove};
  }

  function startNormal(player, direction, aerial) {
    let action;
    if (aerial) {
      const moves = {
        neutral:{name:'NEUTRAL AIR',dmg:7,angle:48,base:3.3,growth:.043,x:4,y:0,r:34,dur:.48,start:.07},
        forward:{name:'FORWARD AIR',dmg:10,angle:42,base:3.8,growth:.051,x:32,y:-2,r:29,dur:.50,start:.10},
        back:{name:'BACK AIR',dmg:12,angle:35,base:4.1,growth:.054,x:-30,y:-5,r:27,dur:.46,start:.08,reverse:true},
        up:{name:'UP AIR',dmg:9,angle:84,base:3.5,growth:.049,x:2,y:-35,r:28,dur:.44,start:.08},
        down:{name:'DOWN AIR',dmg:11,angle:270,base:4.4,growth:.047,x:2,y:37,r:28,dur:.58,start:.14,spike:true}
      };
      const move = moves[direction] || moves.neutral;
      action = makeAction(move.name, move.dur, .16, move.start, hitboxFrom(move), true);
    } else {
      const moves = {
        neutral:{name:'JAB',dmg:4.5,angle:42,base:2.8,growth:.035,x:28,y:-2,r:25,dur:.27,start:.055},
        forward:{name:'FORWARD TILT',dmg:8.5,angle:38,base:3.6,growth:.047,x:34,y:-2,r:29,dur:.38,start:.10},
        back:{name:'BACK TILT',dmg:9,angle:42,base:3.7,growth:.046,x:-31,y:0,r:27,dur:.40,start:.11,reverse:true},
        up:{name:'UP TILT',dmg:7.5,angle:88,base:3.3,growth:.044,x:2,y:-37,r:30,dur:.37,start:.085},
        down:{name:'DOWN TILT',dmg:6.5,angle:25,base:3.0,growth:.038,x:30,y:21,r:23,dur:.33,start:.075}
      };
      const move = moves[direction] || moves.neutral;
      if (direction === 'forward' && Math.abs(player.vx) > 4.2) {
        Object.assign(move,{name:'DASH ATTACK',dmg:10.5,angle:48,base:4.2,growth:.052,x:37,y:4,r:32,dur:.50,start:.09});
        player.vx += player.face * 2.2;
      }
      action = makeAction(move.name, move.dur, .14, move.start, hitboxFrom(move), direction === 'neutral');
    }
    player.action = action;
    whoosh(player.fighter.power);
  }

  function startSmash(player, direction, charge) {
    const power = .72 + charge * .72;
    const moves = {
      forward:{name:'FORWARD SMASH',dmg:16,angle:35,base:5.3,growth:.067,x:43,y:-1,r:35,dur:.68,start:.13},
      back:{name:'BACK SMASH',dmg:15,angle:38,base:5.1,growth:.065,x:-40,y:-1,r:34,dur:.68,start:.13,reverse:true},
      up:{name:'UP SMASH',dmg:15,angle:88,base:5.0,growth:.066,x:0,y:-45,r:37,dur:.70,start:.14},
      down:{name:'DOWN SMASH',dmg:14,angle:28,base:5.0,growth:.063,x:0,y:18,r:45,dur:.72,start:.14}
    };
    const move = moves[direction] || moves.forward;
    move.dmg *= power;
    move.base *= power;
    move.growth *= .92 + charge * .28;
    player.action = makeAction(move.name, move.dur, .27, move.start, hitboxFrom(move));
    player.action.smash = true;
    player.action.charge = charge;
    screenShake = Math.max(screenShake, 2 + charge * 2);
    whoosh(1.4 + charge);
  }

  function hitboxFrom(move) {
    return {
      x:move.x, y:move.y, radius:move.r, damage:move.dmg,
      angle:move.angle, base:move.base, growth:move.growth,
      reverse:Boolean(move.reverse), spike:Boolean(move.spike)
    };
  }

  function startSpecial(player, direction) {
    const id = player.fighter.id;
    if (direction === 'up') {
      const rise = id === 'brakk' ? 12.2 : id === 'nyx' ? 15.8 : id === 'aero' ? 15.0 : 14.2;
      player.vy = -rise;
      player.vx += player.face * (id === 'nyx' ? 5.5 : 2.5);
      player.grounded = false;
      player.helpless = true;
      const move = {dmg:id === 'brakk' ? 13 : 9,angle:78,base:4.5,growth:.050,x:10,y:-28,r:31};
      player.action = makeAction('UP SPECIAL', .58, .30, .035, hitboxFrom(move), false);
      burst(player.x, player.y + 24, player.fighter.color, 16, 4);
      tone(520, .13, 'sawtooth', .035);
      return;
    }

    if (direction === 'down') {
      if (id === 'volt' || id === 'nyx') {
        player.action = makeAction(id === 'volt' ? 'VOLT COUNTER' : 'VOID COUNTER', .72, .24, .01, null);
        player.counter = .46;
        player.invincible = .06;
        effects.push({type:'counter',owner:player,life:.48,max:.48,color:player.fighter.color});
      } else if (id === 'brakk') {
        player.vy = player.grounded ? -2 : 15;
        const move = {dmg:17,angle:70,base:5.8,growth:.060,x:0,y:31,r:46};
        player.action = makeAction('MAGMA CRASH', .74, .34, .15, hitboxFrom(move));
        player.action.armor = .38;
      } else {
        player.action = makeAction('WIND TRAP', .48, .20, .10, null);
        spawnProjectile(player, {speed:0,vy:0,life:3,radius:25,damage:8,angle:78,base:4,growth:.045,type:'trap',x:player.x,y:player.y + 35});
      }
      tone(190, .15, 'square', .035);
      return;
    }

    if (direction === 'forward' || direction === 'back') {
      if (direction === 'back') player.face *= -1;
      if (id === 'volt') {
        player.vx = player.face * 16.5;
        player.vy *= .25;
        player.action = makeAction('THUNDER DASH', .42, .24, .04, hitboxFrom({dmg:13,angle:38,base:4.7,growth:.058,x:33,y:0,r:31}));
      } else if (id === 'brakk') {
        player.vx = player.face * 11.5;
        player.action = makeAction('BLAZE SHOULDER', .58, .28, .08, hitboxFrom({dmg:15,angle:34,base:5.3,growth:.060,x:30,y:0,r:35}));
        player.action.armor = .30;
      } else if (id === 'nyx') {
        player.invincible = .24;
        burst(player.x, player.y, player.fighter.color, 13, 5);
        player.x += player.face * 125;
        player.vx = player.face * 4;
        player.action = makeAction('SHADOW STEP', .42, .20, .03, hitboxFrom({dmg:11,angle:40,base:4.1,growth:.055,x:25,y:0,r:31}));
      } else {
        player.action = makeAction('GALE SHOTS', .46, .18, .06, null, true);
        [-.13,0,.13].forEach((spread, index) => spawnProjectile(player, {speed:8.4-index*.5,vy:spread*8,life:1.35,radius:8,damage:4.2,angle:35,base:2.6,growth:.032,type:'wind'}));
      }
      whoosh(1.5);
      return;
    }

    if (id === 'volt') {
      spawnProjectile(player, {speed:9.4,vy:0,life:1.3,radius:11,damage:8.5,angle:40,base:3.5,growth:.044,type:'bolt'});
      player.action = makeAction('ARC BOLT', .43, .20, .03, null, true);
    } else if (id === 'brakk') {
      player.action = makeAction('VOLCANO FIST', .60, .28, .19, hitboxFrom({dmg:20,angle:43,base:6,growth:.067,x:42,y:-4,r:39}));
      player.action.armor = .32;
    } else if (id === 'nyx') {
      spawnProjectile(player, {speed:11.5,vy:0,life:1.05,radius:8,damage:6.5,angle:32,base:3.0,growth:.038,type:'blade'});
      player.action = makeAction('VOID KNIFE', .35, .14, .02, null, true);
    } else {
      spawnProjectile(player, {speed:12.8,vy:-.3,life:1.5,radius:9,damage:10.5,angle:42,base:4.0,growth:.051,type:'arrow'});
      player.action = makeAction('SKY ARROW', .48, .20, .04, null, true);
    }
    tone(430, .09, 'triangle', .03);
  }

  function startGrab(player) {
    player.action = makeAction('GRAB', .33, .14, .06, null);
    player.action.grab = true;
    player.action.activeTo = .16;
  }

  function updateAction(player, dt, playerIndex) {
    const action = player.action;
    action.time += dt;
    if (action.armor) action.armor = Math.max(0, action.armor - dt);
    if (action.grab && action.time >= action.activeFrom && action.time <= action.activeTo && !action.hit) {
      const target = players[1 - playerIndex];
      const distance = Math.hypot(player.x + player.face * 26 - target.x, player.y - target.y);
      if (!target.dead && !target.grabbedBy && distance < 45 && target.invincible <= 0) {
        action.hit = true;
        player.grabbing = target;
        target.grabbedBy = player;
        player.grabTimer = .85 + target.damage * .0025;
        player.action = null;
        burst(target.x, target.y, '#ffe2a8', 9, 3);
      }
    } else if (action.hitbox && action.time >= action.activeFrom && action.time <= action.activeTo && !action.hit) {
      resolveHitbox(player, players[1 - playerIndex], action);
    }
    if (player.action === action && action.time >= action.duration) {
      player.action = null;
    }
  }

  function updateGrabHold(player, control, dt) {
    const victim = player.grabbing;
    if (!victim || victim.dead) {
      releaseGrab(player);
      return;
    }
    player.grabTimer -= dt;
    victim.x = player.x + player.face * 26;
    victim.y = player.y - 2;
    const direction = directionOf(control, player);
    if (control.attackPress || control.grabPress || direction !== 'neutral' || player.grabTimer <= 0) {
      throwVictim(player, victim, direction === 'neutral' ? 'forward' : direction);
    }
  }

  function throwVictim(player, victim, direction) {
    const throws = {
      forward:{angle:38,damage:8,base:5,growth:.052,dir:player.face},
      back:{angle:42,damage:9,base:5,growth:.055,dir:-player.face},
      up:{angle:88,damage:7,base:4.6,growth:.052,dir:player.face},
      down:{angle:72,damage:6,base:3.5,growth:.038,dir:player.face}
    };
    const move = throws[direction] || throws.forward;
    victim.grabbedBy = null;
    player.grabbing = null;
    applyLaunch(player, victim, {...move, reverse:false}, move.dir);
    player.action = makeAction(`${direction.toUpperCase()} THROW`, .34, .16, .01, null);
  }

  function releaseGrab(player) {
    if (player.grabbing) player.grabbing.grabbedBy = null;
    player.grabbing = null;
  }

  function resolveHitbox(attacker, victim, action) {
    if (victim.dead || victim.invincible > 0 || victim.grabbedBy) return;
    const hb = action.hitbox;
    const centerX = attacker.x + hb.x * attacker.face;
    const centerY = attacker.y + hb.y;
    const distance = Math.hypot(centerX - victim.x, centerY - victim.y);
    if (distance > hb.radius + Math.max(victim.width, victim.height) * .35) return;
    action.hit = true;
    const launchDirection = hb.reverse ? -attacker.face : attacker.face;
    applyLaunch(attacker, victim, hb, launchDirection);
  }

  function applyLaunch(attacker, victim, hitbox, direction) {
    if (victim.counter > 0) {
      victim.counter = 0;
      attacker.counter = 0;
      victim.action = makeAction('COUNTER STRIKE', .45, .19, .01, null);
      const reflected = {damage:Math.max(10, hitbox.damage * 1.35),angle:38,base:5.5,growth:.060};
      applyLaunch(victim, attacker, reflected, victim.face);
      burst(victim.x, victim.y, victim.fighter.color, 24, 6);
      announce('COUNTER!');
      return;
    }
    if (victim.action?.armor > 0 && hitbox.damage < 18) {
      victim.damage += hitbox.damage * .55;
      burst(victim.x, victim.y, '#ffbb75', 8, 3);
      return;
    }
    if (victim.shielding) {
      const shieldDamage = hitbox.damage * 1.72 + hitbox.base;
      victim.shield = Math.max(0, victim.shield - shieldDamage);
      victim.vx += direction * Math.min(3.5, shieldDamage * .10);
      victim.shieldDelay = .65;
      burst(victim.x, victim.y, '#b8edff', 11, 3.8);
      tone(165, .055, 'square', .035);
      if (victim.shield <= 0) shieldBreak(victim);
      return;
    }

    const staleCount = attacker.stale.filter(name => name === attacker.action?.name).length;
    const staleMultiplier = Math.max(.72, 1 - staleCount * .08);
    const damage = hitbox.damage * attacker.fighter.power * staleMultiplier;
    victim.damage += damage;
    attacker.damageGiven += damage;
    const knockback = (hitbox.base + victim.damage * hitbox.growth * 10 + damage * .16) / victim.fighter.weight;
    const radians = hitbox.angle * Math.PI / 180;
    victim.vx = Math.cos(radians) * knockback * direction;
    victim.vy = -Math.sin(radians) * knockback;
    if (hitbox.spike && victim.grounded) victim.vy = -Math.abs(victim.vy) * .55;
    victim.hitstun = clamp(.10 + knockback * .022, .12, .78);
    victim.action = null;
    victim.charge = null;
    victim.shielding = false;
    victim.fastFall = false;
    attacker.stale.unshift(attacker.action?.name || 'hit');
    if (attacker.stale.length > 9) attacker.stale.pop();
    hitFreeze = Math.min(.095, .018 + damage * .0024);
    screenShake = Math.max(screenShake, Math.min(18, 2.4 + knockback * .62));
    burst(victim.x, victim.y, attacker.fighter.color, Math.ceil(10 + knockback), 4.8);
    slashEffect(victim.x, victim.y, attacker.fighter.color, direction, knockback);
    tone(90 + Math.min(150, knockback * 7), .055 + damage * .002, 'square', .04);
  }

  function shieldBreak(player) {
    player.shielding = false;
    player.shield = 20;
    player.stun = 2.25;
    player.vy = -7;
    player.action = null;
    announce('SHIELD BREAK!');
    burst(player.x, player.y, '#ffffff', 30, 7);
    tone(90, .35, 'sawtooth', .05);
  }

  function spawnProjectile(owner, options) {
    projectiles.push({
      owner, x:options.x ?? owner.x + owner.face * 30, y:options.y ?? owner.y - 4,
      vx:options.speed !== undefined ? owner.face * options.speed : 0,
      vy:options.vy || 0, life:options.life || 1.2, radius:options.radius || 9,
      damage:options.damage || 7, angle:options.angle || 38, base:options.base || 3.5,
      growth:options.growth || .043, color:owner.fighter.color, type:options.type || 'energy', hit:false
    });
  }

  function updateProjectiles(dt) {
    projectiles.forEach(projectile => {
      projectile.x += projectile.vx * dt * 60;
      projectile.y += projectile.vy * dt * 60;
      projectile.life -= dt;
      if (projectile.type === 'trap') {
        projectile.vx = 0;
        projectile.vy = 0;
      }
      const victim = players[1 - projectile.owner.slot];
      if (!projectile.hit && !victim.dead && Math.hypot(projectile.x - victim.x, projectile.y - victim.y) < projectile.radius + 28) {
        if (victim.counter > 0) {
          projectile.owner = victim;
          projectile.vx *= -1.25;
          projectile.color = victim.fighter.color;
          victim.counter = 0;
          return;
        }
        projectile.hit = true;
        projectile.life = 0;
        applyLaunch(projectile.owner, victim, projectile, Math.sign(projectile.vx) || projectile.owner.face);
      }
    });
    projectiles = projectiles.filter(projectile => projectile.life > 0 && projectile.x > -90 && projectile.x < canvas.viewWidth + 90);
  }

  function resolvePlatforms(player, control, wasGrounded) {
    if (player.vy < 0 || player.dropTimer > 0) return;
    const stage = STAGES[stageKey];
    for (const platform of stage.platforms) {
      const px = platform.x * canvas.viewWidth;
      const py = platform.y * canvas.viewHeight;
      const pw = platform.w * canvas.viewWidth;
      const previousBottom = player.previousY + player.height / 2;
      const bottom = player.y + player.height / 2;
      if (player.x + player.width / 2 > px && player.x - player.width / 2 < px + pw && previousBottom <= py + 6 && bottom >= py) {
        if (player.hitstun > 0 && control.shieldPress) {
          player.invincible = .22;
          player.hitstun = 0;
          burst(player.x, py, '#d9f7ff', 9, 3);
        }
        player.y = py - player.height / 2;
        player.vy = 0;
        player.grounded = true;
        player.platform = platform;
        player.jumps = 2;
        player.fastFall = false;
        player.helpless = false;
        return;
      }
    }
    if (wasGrounded) player.jumps = Math.min(player.jumps, 1);
  }

  function tryGrabLedge(player) {
    if (player.grounded || player.ledge || player.ledgeLock > 0 || player.vy < -1 || player.hitstun > .12) return;
    const main = STAGES[stageKey].platforms.find(platform => platform.main);
    if (!main) return;
    const left = main.x * canvas.viewWidth;
    const right = (main.x + main.w) * canvas.viewWidth;
    const y = main.y * canvas.viewHeight;
    if (Math.abs(player.y - (y + 24)) > 45) return;
    if (player.x < left && Math.abs(player.x - left) < 32) grabLedge(player, left, y, -1);
    else if (player.x > right && Math.abs(player.x - right) < 32) grabLedge(player, right, y, 1);
  }

  function grabLedge(player, xPosition, yPosition, side) {
    player.ledge = {x:xPosition, y:yPosition, side, time:0};
    player.x = xPosition + side * 17;
    player.y = yPosition + 25;
    player.vx = 0;
    player.vy = 0;
    player.invincible = .65;
    player.action = null;
    player.helpless = false;
    burst(player.x, player.y, '#ffffff', 5, 2);
  }

  function updateLedge(player, control, dt) {
    const ledge = player.ledge;
    ledge.time += dt;
    player.x = ledge.x + ledge.side * 17;
    player.y = ledge.y + 25;
    const inward = -ledge.side;
    const axis = (control.right ? 1 : 0) - (control.left ? 1 : 0);
    if (control.jumpPress || control.up) {
      player.ledge = null;
      player.ledgeLock = .55;
      player.vx = inward * 4.2;
      player.vy = -10.6;
      player.jumps = 1;
    } else if (control.attackPress) {
      player.ledge = null;
      player.ledgeLock = .65;
      player.x += inward * 22;
      player.face = -ledge.side;
      player.invincible = .22;
      startNormal(player, 'forward', false);
    } else if (control.down || axis === ledge.side) {
      player.ledge = null;
      player.ledgeLock = .75;
      player.vy = 2.5;
      player.jumps = Math.max(1, player.jumps);
    } else if (axis === inward || ledge.time > 2.2) {
      player.ledge = null;
      player.ledgeLock = .55;
      player.x += inward * 40;
      player.y = ledge.y - player.height / 2;
      player.vx = inward * 2;
      player.invincible = .25;
    }
  }

  function knockOut(player, playerIndex) {
    if (player.dead) return;
    player.dead = true;
    player.stocks -= 1;
    player.falls += 1;
    const scorer = players[1 - playerIndex];
    scorer.kos += 1;
    releaseGrab(player);
    if (player.grabbedBy) releaseGrab(player.grabbedBy);
    player.grabbedBy = null;
    player.action = null;
    player.charge = null;
    screenShake = 20;
    effects.push({type:'blast',x:clamp(player.x,0,canvas.viewWidth),y:clamp(player.y,0,canvas.viewHeight),life:.75,max:.75,color:scorer.fighter.color});
    burst(clamp(player.x,0,canvas.viewWidth), clamp(player.y,0,canvas.viewHeight), '#ffffff', 42, 9);
    announce('K.O.!');
    tone(62, .40, 'sawtooth', .065);
    if (player.stocks <= 0) {
      setTimeout(() => finishMatch(1 - playerIndex), 620);
    } else {
      player.damage = 0;
      player.respawn = 1.45;
    }
  }

  function respawnPlayer(player) {
    player.dead = false;
    player.x = canvas.viewWidth / 2 + (player.slot ? 70 : -70);
    player.y = canvas.viewHeight * .12;
    player.vx = 0;
    player.vy = 0;
    player.invincible = 2.3;
    player.respawnPlatform = 1.0;
    player.jumps = 2;
    player.helpless = false;
    player.ledge = null;
  }

  function finishMatch(winnerIndex) {
    winnerSlot=winnerIndex;
    if (gameState === 'result') return;
    gameState = 'result';
    const winner = players[winnerIndex];
    const loser = players[1 - winnerIndex];
    const localTitle = onlineSession ? (winnerIndex===onlineSession.side?'VICTORY':'DEFEAT') : mode === 'local' ? `PLAYER ${winnerIndex + 1} WINS` : winnerIndex === 0 ? 'VICTORY' : 'DEFEAT';
    $('result-title').textContent = localTitle;
    $('result-copy').innerHTML = `${winner.fighter.name} WIN<br>K.O. ${winner.kos}　与ダメージ ${Math.round(winner.damageGiven)}%<br>${loser.fighter.name} 残り ${loser.stocks} STOCK`;
    $('winner-art').style.cssText=fighterPortraitStyle(ROSTER.findIndex(f=>f.id===winner.fighter.id));$('winner-art').style.setProperty('--winner',winner.fighter.color);
    screens.result.classList.remove('hidden');
    $('touch-controls').classList.add('hidden');
    tone(523, .14, 'triangle', .04);
    setTimeout(() => tone(659, .16, 'triangle', .04), 120);
    setTimeout(() => tone(784, .28, 'triangle', .04), 250);
  }

  function spawnItem() {
    const types = ['heal','bomb','power'];
    items.push({
      type:types[Math.floor(Math.random() * types.length)],
      x:canvas.viewWidth * (.22 + Math.random() * .56), y:canvas.viewHeight * .08,
      previousY:0, vx:(Math.random() - .5) * .8, vy:0, spin:0, taken:false
    });
  }

  function updateItems(dt) {
    items.forEach(item => {
      item.previousY = item.y;
      item.vy += .34 * dt * 60;
      item.x += item.vx * dt * 60;
      item.y += item.vy * dt * 60;
      item.spin += dt * 2.6;
      for (const platform of STAGES[stageKey].platforms) {
        const px = platform.x * canvas.viewWidth;
        const py = platform.y * canvas.viewHeight;
        const pw = platform.w * canvas.viewWidth;
        if (item.vy >= 0 && item.x > px && item.x < px + pw && item.previousY <= py - 15 && item.y >= py - 15) {
          item.y = py - 15;
          item.vy = 0;
        }
      }
      players.forEach(player => {
        if (item.taken || player.dead || Math.hypot(item.x-player.x,item.y-player.y) > 39) return;
        item.taken = true;
        if (item.type === 'heal') {
          player.damage = Math.max(0, player.damage - 38);
          burst(item.x,item.y,'#67ff9d',18,5);
          announce('-38%');
        } else if (item.type === 'bomb') {
          const enemy = players[1-player.slot];
          if (!enemy.dead) applyLaunch(player,enemy,{damage:16,angle:52,base:5.5,growth:.058},player.face);
          burst(item.x,item.y,'#ffcf55',30,8);
          screenShake = 15;
        } else {
          player.invincible = Math.max(player.invincible, 4.2);
          effects.push({type:'aura',owner:player,life:4.2,max:4.2,color:'#ffe66a'});
          announce('STAR POWER');
        }
      });
    });
    items = items.filter(item => !item.taken && item.y < canvas.viewHeight + 80);
  }

  function burst(x,y,color,count,speed) {
    for (let i=0;i<count;i++) {
      const angle = Math.random()*Math.PI*2;
      const velocity = speed*(.35+Math.random()*.75);
      if(particles.length>=(graphics.effects===2?220:graphics.effects===1?100:36))break;
      particles.push({x,y,vx:Math.cos(angle)*velocity,vy:Math.sin(angle)*velocity,color,life:.25+Math.random()*.42,max:.67,size:2+Math.random()*5,gravity:.10});
    }
  }

  function streak(x,y,color,vx,vy) {
    if(particles.length>=(graphics.effects===2?220:graphics.effects===1?100:36))return;
    particles.push({x,y,vx,vy,color,life:.26,max:.26,size:3,gravity:0,streak:true});
  }

  function slashEffect(x,y,color,direction,power) {
    effects.push({type:'slash',x,y,color,direction,life:.16,max:.16,power});
  }

  function updateParticles(dt) {
    particles.forEach(particle => {
      particle.x += particle.vx * dt * 60;
      particle.y += particle.vy * dt * 60;
      particle.vy += particle.gravity * dt * 60;
      particle.life -= dt;
    });
    particles = particles.filter(particle => particle.life > 0);
  }

  function updateEffects(dt) {
    effects.forEach(effect => effect.life -= dt);
    effects = effects.filter(effect => effect.life > 0);
  }

  function updateHud() {
    if (!players.length) return;
    players.forEach((player,index) => {
      const prefix = `p${index+1}`;
      $(`${prefix}-name`).textContent = `${player.cpu ? 'CPU' : `P${index+1}`} · ${player.fighter.name}`;
      $(`${prefix}-damage`).innerHTML = `${Math.round(player.damage)}<em>%</em>`;
      $(`${prefix}-damage`).style.color = damageColor(player.damage);
      $(`${prefix}-stocks`).textContent = Array(Math.max(0,player.stocks)).fill('●').join(' ');
      $(`${prefix}-portrait`).style.cssText=fighterPortraitStyle(ROSTER.findIndex(f=>f.id===player.fighter.id));$(`${prefix}-portrait`).style.setProperty('--fighter',player.fighter.color);
    });
    const minutes = Math.floor(matchTime / 60);
    const seconds = Math.ceil(matchTime % 60);
    $('clock').textContent = `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
  }

  function damageColor(damage) {
    if (damage < 50) return '#ffffff';
    if (damage < 100) return '#ffe277';
    if (damage < 150) return '#ff965d';
    return '#ff4f65';
  }

  function draw() {
    const width = canvas.viewWidth;
    const height = canvas.viewHeight;
    ctx.save();
    if (screenShake > 0) ctx.translate((Math.random()-.5)*screenShake,(Math.random()-.5)*screenShake);
    drawBackground(width,height);
    const spread = players.length > 1 ? Math.hypot(players[0].x-players[1].x,(players[0].y-players[1].y)*.7) : 0;
    const targetZoom = clamp(1-(spread-Math.min(340,width*.34))/Math.max(900,width*1.25),.86,1);
    cameraZoom += (targetZoom-cameraZoom)*.055;
    ctx.translate(width/2,height/2);
    ctx.scale(cameraZoom,cameraZoom);
    ctx.translate(-width/2,-height/2);
    drawStage(width,height);
    items.forEach(drawItem);
    projectiles.forEach(drawProjectile);
    players.forEach(drawPlayer);
    particles.forEach(drawParticle);
    effects.forEach(drawEffect);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawBackground(width,height) {
    loadArena();
    const image=layer('background:'+stageKey+':'+width+':'+height,width+60,height+60,()=>{
      const stage=STAGES[stageKey],g=ctx.createLinearGradient(0,0,0,height);stage.sky.forEach((v,i)=>g.addColorStop(i/2,v));ctx.fillStyle=g;ctx.fillRect(0,0,width+60,height+60);
      if(arenaHD){const k=Math.max((width+60)/arenaHD.width,(height+60)/arenaHD.height),w=arenaHD.width*k,h=arenaHD.height*k;ctx.drawImage(arenaHD,(width+60-w)/2,(height+60-h)/2,w,h);}
      else if(arenaIllustration.complete&&arenaIllustration.naturalWidth){const sw=arenaIllustration.width/4,sh=arenaIllustration.height/4;ctx.drawImage(arenaIllustration,arenaTheme%4*sw,Math.floor(arenaTheme/4)*sh,sw,sh,0,0,width+60,height+60);}
      const shade=ctx.createLinearGradient(0,0,0,height);shade.addColorStop(0,'#070f2820');shade.addColorStop(.5,'#08102716');shade.addColorStop(1,'#0206178a');ctx.fillStyle=shade;ctx.fillRect(0,0,width+60,height+60);
      const glow=ctx.createRadialGradient(width*.73,height*.2,0,width*.73,height*.2,width*.6);glow.addColorStop(0,stage.glow+'28');glow.addColorStop(1,'#00000000');ctx.fillStyle=glow;ctx.fillRect(0,0,width+60,height+60);
    });
    ctx.drawImage(image,-30,-30,width+60,height+60);
    if(graphics.effects>0&&!document.hidden){const t=performance.now()*.008;ctx.fillStyle='#cfe7ff60';for(let i=0;i<(graphics.effects===2?24:9);i++)ctx.fillRect((i*109+t*(1+i%3))%width,(i*i*31)%(height*.72),i%5===0?2:1,1);}
  }

  function drawStage(width,height){const margin=32;const image=layer('stage:'+stageKey+':'+width+':'+height,width+margin*2,height+margin*2,()=>{ctx.translate(margin,margin);drawStageRaw(width,height);});ctx.drawImage(image,-margin,-margin,width+margin*2,height+margin*2);}
  function drawStageRaw(width,height) {
    const stage = STAGES[stageKey];
    stage.platforms.forEach((platform,index) => {
      const px=platform.x*width, py=platform.y*height, pw=platform.w*width, ph=platform.h*height;
      const bodyHeight=ph+(platform.main?38:15),dark=stageKey==='final',edge=dark?'#83d7e1':'#dacba0';
      const gradient=ctx.createLinearGradient(px,py,px,py+bodyHeight);gradient.addColorStop(0,dark?'#6d8799':'#c9c5b5');gradient.addColorStop(.13,dark?'#354958':'#777f7d');gradient.addColorStop(.24,dark?'#20323e':'#525f66');gradient.addColorStop(1,'#131e2a');
      ctx.shadowBlur=16;ctx.shadowColor=stage.glow+'85';ctx.fillStyle=gradient;roundedRect(px,py,pw,bodyHeight,4);ctx.fill();ctx.shadowBlur=0;
      // Carved slab detail is rasterized once with the platform, not every frame.
      ctx.save();roundedRect(px+1,py+2,pw-2,bodyHeight-3,3);ctx.clip();
      for(let n=0;n<Math.ceil(pw/5);n++){const xx=px+n*5,hash=Math.sin(n*93.7+index*19.3)*43758.54,fract=hash-Math.floor(hash);ctx.fillStyle=n%3?'#e8dfc00c':'#07111c32';ctx.fillRect(xx,py+9+fract*(bodyHeight-13),1+n%4,1+fract*2);}
      const blocks=Math.max(2,Math.floor(pw/72));ctx.strokeStyle='#060e1b88';ctx.lineWidth=1;for(let n=1;n<blocks;n++){const xx=px+pw*n/blocks;ctx.beginPath();ctx.moveTo(xx,py+9);ctx.lineTo(xx+3,py+bodyHeight*.6);ctx.lineTo(xx,py+bodyHeight);ctx.stroke();}
      ctx.restore();ctx.fillStyle=edge;ctx.fillRect(px+4,py+2,pw-8,2);ctx.fillStyle='#f9f4db7a';ctx.fillRect(px+7,py+5,pw-14,1);ctx.fillStyle='#09131d8a';ctx.fillRect(px+4,py+10,pw-8,2);ctx.fillStyle=edge+'70';ctx.fillRect(px+6,py+bodyHeight-6,pw-12,1);
      ctx.strokeStyle=edge+'ae';ctx.lineWidth=1.3;for(const n of [.08,.5,.92]){const x=px+pw*n,y=py+bodyHeight*.55;ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x+5,y);ctx.lineTo(x,y+4);ctx.lineTo(x-5,y);ctx.closePath();ctx.stroke();}

    });
  }

  function drawPlayer(player) {
    if (player.dead) return;
    ctx.save();
    if(player.invincible>0&&Math.floor(player.invincible*14)%2===0)ctx.globalAlpha=.40;
    if(Math.abs(player.vx)>8||Math.abs(player.vy)>11){
      player.trail.slice(1).forEach((point,index)=>{ctx.globalAlpha=.12*(1-index/player.trail.length);ctx.fillStyle=player.fighter.color;ctx.beginPath();ctx.ellipse(point.x,point.y,player.width*.55,player.height*.46,0,0,Math.PI*2);ctx.fill()});ctx.globalAlpha=1;
    }
    ctx.translate(player.x,player.y);
    ctx.scale(player.face,1);
    if(player.shielding)drawShield(player);
    if(player.charge)drawCharge(player);
    const bob=player.grounded?Math.sin(performance.now()*.009+player.slot)*1.2:0;
    ctx.translate(0,bob);
    const lean=clamp(player.vx*.018,-.14,.14);
    ctx.rotate(lean);
    drawFighterBody(player);
    if(player.action?.hitbox&&player.action.time>=player.action.activeFrom&&player.action.time<=player.action.activeTo)drawAttackArc(player);
    if(player.grabbing){ctx.strokeStyle='#ffe6a3';ctx.lineWidth=3;ctx.beginPath();ctx.arc(24,0,15,0,Math.PI*2);ctx.stroke()}
    ctx.restore();
    if(player.ledge){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(player.x,player.y-12,3,0,Math.PI*2);ctx.fill()}
  }

  function drawFighterBody(player) {
    const f=player.fighter;
    const attacking=Boolean(player.action);
    if(fighterIllustration.complete&&fighterIllustration.naturalWidth){
      const index=Math.max(0,ROSTER.findIndex(v=>v.id===f.id)),pose=player.hitstun>0?3:attacking?2:!player.grounded||Math.abs(player.vx)>1?1:0;
      const [sx,sy,sw,sh]=FIGHTER_FRAMES[index][pose],scale=(index===1?100:92)/FIGHTER_FRAMES[index][0][3];
      const dw=sw*scale,dh=sh*scale,pad=12,anchor=pose===2?.37:pose===1?.55:.5;
      const image=layer('fighter:'+index+':'+pose,dw+pad*2,dh+pad*2,()=>{ctx.shadowColor=f.color+'90';ctx.shadowBlur=7;ctx.drawImage(fighterIllustration,sx,sy,sw,sh,pad,pad,dw,dh);});
      ctx.drawImage(image,-dw*anchor-pad,player.height/2-dh-pad,dw+pad*2,dh+pad*2);return;
    }
    ctx.shadowBlur=17;ctx.shadowColor=f.color;
    ctx.fillStyle=f.dark;roundedRect(-player.width*.46,-17,player.width*.92,39,9);ctx.fill();
    ctx.fillStyle=f.color;roundedRect(-player.width*.39,-15,player.width*.78,25,8);ctx.fill();ctx.shadowBlur=0;
    ctx.fillStyle='#f4dfd6';ctx.beginPath();ctx.arc(0,-26,12,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#17112c';ctx.beginPath();ctx.arc(0,-30,12,Math.PI,0);ctx.fill();
    ctx.fillStyle='#fff';ctx.fillRect(4,-27,5,3);
    ctx.fillStyle=f.color;ctx.fillRect(-player.width*.36,18,player.width*.28,23);ctx.fillRect(player.width*.08,18,player.width*.28,23);
    ctx.strokeStyle=f.color;ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-player.width*.40,-8);ctx.lineTo(-player.width*.70,8);ctx.moveTo(player.width*.40,-8);ctx.lineTo(player.width*.72+(attacking?12:0),1);ctx.stroke();
    if(f.weapon==='blade'||f.weapon==='dagger'){
      ctx.strokeStyle='#eefcff';ctx.lineWidth=f.weapon==='blade'?5:3;ctx.beginPath();ctx.moveTo(player.width*.7,2);ctx.lineTo(player.width*(attacking?1.65:1.22),attacking?-7:-15);ctx.stroke();
    }else if(f.weapon==='bow'){
      ctx.strokeStyle='#eafff2';ctx.lineWidth=3;ctx.beginPath();ctx.arc(player.width*.79,0,16,-1.15,1.15);ctx.stroke();
    }else if(f.weapon==='fist'){
      ctx.fillStyle='#ffbd73';ctx.beginPath();ctx.arc(player.width*(attacking?1.18:.75),0,8,0,Math.PI*2);ctx.fill();
    }
  }

  function drawShield(player) {
    const radius=25+player.shield*.13;
    const gradient=ctx.createRadialGradient(0,0,3,0,0,radius);
    gradient.addColorStop(0,'#ffffff18');gradient.addColorStop(.78,player.fighter.color+'45');gradient.addColorStop(1,'#dffaffcc');
    ctx.fillStyle=gradient;ctx.strokeStyle='#ffffffc9';ctx.lineWidth=2.5;ctx.beginPath();ctx.ellipse(0,0,radius*.82,radius,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  }

  function drawCharge(player) {
    const amount=player.charge.time;
    ctx.strokeStyle=player.fighter.color;ctx.lineWidth=2+amount*4;ctx.globalAlpha=.45+.35*amount;ctx.beginPath();ctx.arc(0,0,31+amount*8,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
  }

  function drawAttackArc(player) {
    ctx.strokeStyle='#ffffffdd';ctx.lineWidth=3+(player.action.smash?5:2);ctx.shadowBlur=18;ctx.shadowColor=player.fighter.color;ctx.beginPath();ctx.arc(19,0,30+(player.action.smash?12:0),-1.25,1.1);ctx.stroke();ctx.shadowBlur=0;
  }

  function drawProjectile(projectile) {
    ctx.save();ctx.translate(projectile.x,projectile.y);ctx.shadowBlur=22;ctx.shadowColor=projectile.color;ctx.fillStyle=projectile.color;
    if(projectile.type==='arrow'||projectile.type==='blade'){ctx.rotate(Math.atan2(projectile.vy,projectile.vx));ctx.fillRect(-13,-2,26,4);ctx.beginPath();ctx.moveTo(13,-6);ctx.lineTo(23,0);ctx.lineTo(13,6);ctx.fill()}
    else if(projectile.type==='wind'){ctx.strokeStyle=projectile.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,projectile.radius,0,Math.PI*1.55);ctx.stroke()}
    else{ctx.beginPath();ctx.arc(0,0,projectile.radius,0,Math.PI*2);ctx.fill()}
    ctx.restore();
  }

  function drawItem(item) {
    ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.spin);const colors={heal:'#67ff9d',bomb:'#ffca4d',power:'#fff477'};ctx.shadowBlur=21;ctx.shadowColor=colors[item.type];ctx.fillStyle=colors[item.type];
    if(item.type==='heal'){ctx.fillRect(-5,-15,10,30);ctx.fillRect(-15,-5,30,10)}
    else if(item.type==='bomb'){ctx.beginPath();ctx.arc(0,3,14,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(8,-10,8,Math.PI,Math.PI*1.6);ctx.stroke()}
    else{starPath(0,0,17,8,5);ctx.fill()}ctx.restore();
  }

  function drawParticle(particle) {
    ctx.globalAlpha=clamp(particle.life/particle.max,0,1);ctx.fillStyle=particle.color;
    if(particle.streak){ctx.fillRect(particle.x-1,particle.y-10,2,20)}else{ctx.fillRect(particle.x-particle.size/2,particle.y-particle.size/2,particle.size,particle.size)}
  }

  function drawEffect(effect) {
    const progress=1-effect.life/effect.max;
    ctx.save();
    if(effect.type==='slash'){
      ctx.translate(effect.x,effect.y);ctx.scale(effect.direction,1);ctx.globalAlpha=1-progress;ctx.strokeStyle=effect.color;ctx.lineWidth=8*(1-progress)+2;ctx.beginPath();ctx.arc(0,0,30+progress*60,-1.2,1.15);ctx.stroke();
    }else if(effect.type==='blast'){
      ctx.globalAlpha=1-progress;ctx.strokeStyle=effect.color;ctx.lineWidth=12*(1-progress)+2;ctx.beginPath();ctx.arc(effect.x,effect.y,25+progress*180,0,Math.PI*2);ctx.stroke();
      for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(effect.x+Math.cos(a)*20,effect.y+Math.sin(a)*20);ctx.lineTo(effect.x+Math.cos(a)*(80+progress*260),effect.y+Math.sin(a)*(80+progress*260));ctx.stroke()}
    }else if(effect.type==='counter'){
      const p=effect.owner;if(!p.dead){ctx.globalAlpha=.35*(1-progress);ctx.fillStyle=effect.color;ctx.beginPath();ctx.arc(p.x,p.y,35+progress*45,0,Math.PI*2);ctx.fill()}
    }else if(effect.type==='aura'){
      const p=effect.owner;if(!p.dead){ctx.globalAlpha=.35+.2*Math.sin(performance.now()*.02);ctx.strokeStyle=effect.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(p.x,p.y,37+5*Math.sin(performance.now()*.01),0,Math.PI*2);ctx.stroke()}
    }
    ctx.restore();
  }

  function roundedRect(x,y,w,h,r){ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h)}
  function starPath(cx,cy,outer,inner,points){ctx.beginPath();for(let i=0;i<points*2;i++){const angle=-Math.PI/2+i*Math.PI/points;const radius=i%2?inner:outer;ctx.lineTo(cx+Math.cos(angle)*radius,cy+Math.sin(angle)*radius)}ctx.closePath()}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value))}

  function initAudio(){if(!audioContext)try{audioContext=new(window.AudioContext||window.webkitAudioContext)()}catch(_error){audioContext=null}audioContext?.resume?.()}
  function tone(frequency,duration,type='sine',volume=.025){if(!audioContext)return;const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,audioContext.currentTime);gain.gain.setValueAtTime(volume,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,audioContext.currentTime+duration);oscillator.connect(gain).connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+duration)}
  function whoosh(power=1){tone(170+power*45,.045,'sawtooth',.012+power*.006)}

  function frame(now) {
    const rawFrame=now-lastTime,dt=Math.min(.033,Math.max(0,rawFrame/1000));
    lastTime=now;
    if(onlineSession?.side===1){if(players[1]){window.dispatchEvent(new CustomEvent('skybreak-control',{detail:controlFor(players[1])}));pressed.clear();released.clear();touchPressed.clear();touchReleased.clear();}}else {if(hitFreeze>0)hitFreeze-=dt;else update(dt);}
    if(onlineSession?.side===0)window.dispatchEvent(new CustomEvent('skybreak-frame'));
    graphics.sample(rawFrame,graphicsCpu,now,!document.hidden&&gameState==='playing');
    if(graphics.shouldDraw(now,!document.hidden,gameState==='menu'||gameState==='paused')){const t=performance.now(),ratio=graphics.scale(innerWidth,innerHeight,devicePixelRatio||1);if(Math.abs(ratio-graphicsRatio)>.025)resize();draw();graphicsCpu=performance.now()-t;}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  addEventListener('keydown', event => {
    if(event.target.matches('input,textarea,select'))return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(event.code))event.preventDefault();
    if(!held.has(event.code))pressed.add(event.code);
    held.add(event.code);
    if(event.code==='Escape')togglePause();
  });
  addEventListener('keyup', event => {
    held.delete(event.code);
    released.add(event.code);
  });
  document.querySelectorAll('[data-key]').forEach(button => {
    const key=button.dataset.key;
    const down=event=>{event.preventDefault();if(!touchHeld.has(key))touchPressed.add(key);touchHeld.add(key);button.classList.add('pressed');};
    const up=event=>{event.preventDefault();if(touchHeld.has(key))touchReleased.add(key);touchHeld.delete(key);button.classList.remove('pressed');};
    button.addEventListener('pointerdown',down);button.addEventListener('pointerup',up);button.addEventListener('pointercancel',up);button.addEventListener('pointerleave',up);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){held.clear();pressed.clear();touchHeld.clear();}if(document.hidden&&gameState==='playing'&&!onlineSession)togglePause()});
  window.SKYBREAK_BRIDGE={
    getConfig(){return {fighter:selected,stage:stageKey,items:itemsEnabled};},
    start(config,side){onlineSession={side,starting:true};mode='online';selected=config.fighters[0];opponent=config.fighters[1];stageKey=STAGES[config.stage]?config.stage:'battlefield';itemsEnabled=!!config.items;onlineRemote={};resize();startMatch();},
    controls(control){for(const key of ['left','right','down','up','jumpPress','jumpRelease','attack','attackPress','attackRelease','specialPress','shield','shieldPress','grabPress','anyPress']){if(key.endsWith('Press')||key.endsWith('Release'))onlineRemote[key]=onlineRemote[key]||!!control[key];else onlineRemote[key]=!!control[key];}},
    snapshot(){return JSON.parse(JSON.stringify({id:'skybreak',phase:gameState==='result'?'over':'playing',gameState,players,projectiles,particles:particles.slice(-100),items,effects,itemClock,matchTime,stageKey,itemsEnabled,screenShake,winnerSlot},(key,value)=>['owner','grabbing','grabbedBy'].includes(key)&&value&&Number.isInteger(value.slot)?{$player:value.slot}:value));},
    apply(snapshot){if(snapshot.id!=='skybreak'||!Array.isArray(snapshot.players)||snapshot.players.length!==2)return;clearInterval(countdownTimer);players=snapshot.players;const visited=new WeakSet();const restore=value=>{if(!value||typeof value!=='object')return value;if(Number.isInteger(value.$player))return players[value.$player]||null;if(visited.has(value))return value;visited.add(value);for(const key of Object.keys(value))value[key]=restore(value[key]);return value;};players.forEach(restore);projectiles=restore(snapshot.projectiles||[]);particles=snapshot.particles||[];items=snapshot.items||[];effects=restore(snapshot.effects||[]);itemClock=snapshot.itemClock;matchTime=snapshot.matchTime;stageKey=snapshot.stageKey;itemsEnabled=snapshot.itemsEnabled;screenShake=snapshot.screenShake||0;const previous=gameState;gameState=snapshot.gameState;Object.values(screens).forEach(screen=>screen.classList.add('hidden'));$('hud').classList.remove('hidden');$('touch-controls').classList.remove('hidden');updateHud();if(gameState==='result'){if(previous!=='result'){gameState='playing';finishMatch(snapshot.winnerSlot??0);}else {screens.result.classList.remove('hidden');$('touch-controls').classList.add('hidden');}}},
    restore(snapshot,side){onlineSession={side,starting:false};mode='online';resize();this.apply(snapshot);},
    message:announce,
    stop(){onlineSession=null;mode='cpu';returnToMenu();resize();}
  };
  window.dispatchEvent(new CustomEvent('skybreak-ready'));
})();
