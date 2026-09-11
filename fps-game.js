(() => {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;
  const FOV = Math.PI / 3;
  const TARGET_KILLS = 20;
  const BOSS_UNLOCK_KILLS = TARGET_KILLS - 1;
  const BOSS_MAX_HP = 34;
  const normAngle = a => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  const rng32 = seed => {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  const MAPS = [
    [
      '1111111111111111','1000001000000001','1011101011110101','1000101000010101','1110101111010101',
      '1000100001010001','1011110101011101','1000000101000001','1011111101110101','1000000000010101',
      '1011110111010101','1010000100010001','1010111101111101','1000000000000001','1111111111111111'
    ],
    [
      '1111111111111111','1000000001000001','1011111101011101','1010000101000101','1010110101110101',
      '1000100100010001','1110101111011101','1000100001000001','1011111101011101','1000000101000101',
      '1011100101110101','1000100000010001','1010111111011101','1000000000000001','1111111111111111'
    ],
    [
      '1111111111111111','1000000000000001','1011110111111101','1000010100000101','1111010101110101',
      '1000010101010001','1011110101011101','1000000101000101','1011100101110101','1000100000010001',
      '1010111111011101','1010000001000001','1011111101011101','1000000000000001','1111111111111111'
    ],
    [
      '1111111111111111','1000000100000001','1011100101111101','1000100101000001','1110101101011101',
      '1000100001010001','1011111101010111','1000000100010001','1011100111110101','1010000000010101',
      '1010111111010101','1000100001010001','1011101111011101','1000000000000001','1111111111111111'
    ],
    [
      '1111111111111111','1000010000000001','1011010111111101','1000010100000101','1111010101100101',
      '1000010100100001','1011110100111101','1000000100000001','1011110111110101','1000010000010101',
      '1011011111010101','1011000000010001','1011110111111101','1000000000000001','1111111111111111'
    ],
    [
      '1111111111111111','1000001000000001','1011101011110101','1010001000010101','1010111111010101',
      '1010000001010001','1011110101011101','1000010101000001','1111010101110101','1000010000010101',
      '1011111111010101','1010000000010101','1010111111110101','1000000000000001','1111111111111111'
    ]
  ];

  const THEMES = [
    { name:'洋館', subtitle:'ABANDONED MANOR', wall:[92,71,58], wall2:[142,113,83], floor:[37,31,28], ceil:[25,22,20], fog:[74,65,57], accent:'#f6c177', weather:'dust' },
    { name:'山', subtitle:'FOG RIDGE', wall:[72,88,67], wall2:[118,132,96], floor:[40,47,37], ceil:[88,101,91], fog:[122,137,126], accent:'#b8e986', weather:'mist' },
    { name:'川', subtitle:'FLOODED PASSAGE', wall:[54,83,88], wall2:[84,126,132], floor:[22,53,61], ceil:[31,53,58], fog:[73,114,125], accent:'#78dce8', weather:'water' },
    { name:'海', subtitle:'DROWNED FACILITY', wall:[44,70,93], wall2:[75,111,142], floor:[16,39,59], ceil:[25,45,64], fog:[62,96,122], accent:'#74c7ec', weather:'spray' },
    { name:'都会', subtitle:'NEON DEADZONE', wall:[51,48,66], wall2:[91,78,118], floor:[20,19,28], ceil:[18,17,25], fog:[55,44,72], accent:'#cba6f7', weather:'rain' },
    { name:'悪魔城', subtitle:'DEMON CASTLE', wall:[66,30,35], wall2:[118,52,46], floor:[28,15,17], ceil:[19,10,13], fog:[74,25,30], accent:'#fb7185', weather:'embers' }
  ];

  const ENEMY_TYPES = Object.freeze({
    walker: Object.freeze({ name:'WALKER', hp:1, speed:.42, radius:.35, scale:1, body:'#53624a', skin:'#91a37c', damage:9, score:100 }),
    runner: Object.freeze({ name:'RUNNER', hp:1, speed:.74, radius:.30, scale:.90, body:'#4e3f3f', skin:'#b48272', damage:8, score:140 }),
    crawler:Object.freeze({ name:'CRAWLER', hp:1, speed:.58, radius:.27, scale:.68, body:'#3f4741', skin:'#728f73', damage:6, score:120 }),
    tank:   Object.freeze({ name:'FAT ZOMBIE', hp:5, fat:true, speed:.28, radius:.48, scale:1.35, body:'#42403a', skin:'#817968', damage:16, score:260 }),
    spitter:Object.freeze({ name:'SPITTER', hp:1, speed:.34, radius:.34, scale:1.02, body:'#3d4a35', skin:'#8ba36e', damage:7, score:220, ranged:true }),
    brute:  Object.freeze({ name:'FAT RAVAGER', hp:8, fat:true, speed:.32, radius:.52, scale:1.48, body:'#5b3734', skin:'#9c6b5c', damage:18, score:340 })
  });
  const isFatType = type => Boolean(ENEMY_TYPES[type]?.fat);
  const isDurableEnemy = target => Boolean(target?.boss || isFatType(target?.type));
  const resolveDamage = (target, baseDamage = 1, critical = false) => {
    if (!isDurableEnemy(target)) return Math.max(1, Number(target?.hp) || 1);
    return Math.max(1, Number(baseDamage) || 1) * (critical ? 2 : 1);
  };
  const PUBLIC_BALANCE = Object.freeze({
    targetKills: TARGET_KILLS,
    bossUnlockKills: BOSS_UNLOCK_KILLS,
    bossHp: BOSS_MAX_HP,
    oneShotTypes: Object.freeze(Object.keys(ENEMY_TYPES).filter(type => !isFatType(type))),
    fatTypes: Object.freeze(Object.keys(ENEMY_TYPES).filter(isFatType)),
    enemyTypes: Object.freeze(Object.fromEntries(Object.entries(ENEMY_TYPES).map(([type, cfg]) => [type, Object.freeze({ name:cfg.name, hp:cfg.hp, fat:Boolean(cfg.fat) })]))),
    resolveDamage
  });

  window.ARCADE_GAME = {
    title: 'LIMINAL ZOMBIE FPS — REBORN',
    instructions: '左側ドラッグで移動、右側ドラッグで視点。FIREで射撃。デブゾンビとボス以外は、命中すれば1発で倒せる。6つのステージを突破し、19体撃破後に悪魔城の大型ボスを倒せばクリア。Rでリロード、Shiftでダッシュ、Fでライト、Pで一時停止。',
    noTimeLimit: true,
    balance: PUBLIC_BALANCE,
    create({ canvas, controlsRoot, fireButton, mode = 'solo', onScore, onToast, onComplete, onProgress }) {
      const ctx = canvas.getContext('2d', { alpha:false });
      const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const keys = Object.create(null);
      let rand = Math.random;
      let running = false, paused = false, raf = 0, last = 0, elapsed = 0;
      let stage = 0, map = MAPS[0], mapW = map[0].length, mapH = map.length, openCells = [];
      let player = null, enemies = [], projectiles = [], pickups = [], props = [];
      let particles = [], floaters = [], depth = [];
      let score = 0, shots = 0, hits = 0, kills = 0, headshots = 0, combo = 0, bestCombo = 0, multiplier = 1;
      let muzzle = 0, hitFlash = 0, damageFlash = 0, recoil = 0, shake = 0, rollShake = 0, hitStop = 0, slowMo = 1;
      let bossActive = false, bossHp = 0, completed = false, lastShotAt = -99, lastShotElapsed = -99, lastKillAt = -99, completeTimer = 0;
      let stageBanner = 0, stageTransition = 0, lightning = 0, flashlight = true;
      let damageDirection = 0, damageIndicator = 0, killConfirm = 0, revives = 1;
      let director = { intensity:0, spawnClock:0, target:2 };
      let frameAvg = 16.7, rayCount = 300, weatherClock = 0;
      let fireHeld = false, fireHoldRaf = 0;
      let achievementState = new Set();
      const touchMove = { id:null, startX:0, startY:0, x:0, y:0, forward:0, strafe:0 };
      const touchAim = { id:null, lastX:0, lastY:0 };

      function resetPlayer() {
        player = { x:1.7, y:1.7, a:.15, hp:100, armor:35, stamina:100, ammo:12, reserve:108, mag:12, reload:0, fireCooldown:0, hurtCooldown:0, bob:0, moveAmount:0, invuln:0 };
      }

      function rebuildOpenCells() {
        openCells = [];
        mapH = map.length; mapW = map[0].length;
        for (let y = 1; y < mapH - 1; y++) for (let x = 1; x < mapW - 1; x++) if (map[y][x] === '0') openCells.push([x,y]);
      }

      function isWall(x, y) {
        const ix = Math.floor(x), iy = Math.floor(y);
        return iy < 0 || ix < 0 || iy >= mapH || ix >= mapW || map[iy][ix] === '1';
      }

      function randomOpenCell(minDist = 3, from = player) {
        let x = 2.5, y = 2.5;
        for (let tries = 0; tries < 100; tries++) {
          const c = openCells[Math.floor(rand() * openCells.length)] || [2,2];
          x = c[0] + .22 + rand() * .56; y = c[1] + .22 + rand() * .56;
          if (!from || Math.hypot(x - from.x, y - from.y) >= minDist) break;
        }
        return [x,y];
      }

      function randomEnemyCell(minDist = 3) {
        let fallback = randomOpenCell(minDist);
        for (let tries = 0; tries < 70; tries++) {
          const point = randomOpenCell(minDist);
          fallback = point;
          const [x,y] = point;
          const distance = Math.hypot(x-player.x,y-player.y);
          const inView = Math.abs(normAngle(Math.atan2(y-player.y,x-player.x)-player.a)) < FOV*.64;
          const crowded = enemies.some(other => Math.hypot(x-other.x,y-other.y) < .9+other.radius);
          if (!crowded && (!inView || !lineOfSight(x,y) || distance > 8.5)) return point;
        }
        return fallback;
      }

      function lineOfSight(ax, ay, bx = player.x, by = player.y) {
        const dx = bx - ax, dy = by - ay, dist = Math.hypot(dx,dy), steps = Math.ceil(dist / .07);
        for (let i = 1; i < steps; i++) {
          const p = i / steps;
          if (isWall(ax + dx*p, ay + dy*p)) return false;
        }
        return true;
      }

      function chooseEnemyType() {
        const r = rand(), d = kills / 20 + stage * .08;
        if (stage >= 4 && r < .10 + d*.06) return 'brute';
        if (stage >= 2 && r < .22 + d*.08) return 'spitter';
        if (stage >= 1 && r < .38 + d*.08) return 'tank';
        if (r < .58) return 'runner';
        if (r < .72) return 'crawler';
        return 'walker';
      }

      function spawnZombie({ boss = false, forcedType = null, minDist = 3 } = {}) {
        const type = boss ? 'boss' : forcedType || chooseEnemyType(), cfg = ENEMY_TYPES[type];
        const [x,y] = randomEnemyCell(boss ? 5 : Math.max(minDist,cfg?.fat ? 4.2 : minDist));
        if (boss) return {
          x,y,boss:true,type:'boss',hp:BOSS_MAX_HP,maxHp:BOSS_MAX_HP,speed:.30,radius:.72,scale:2.0,pulse:rand()*TAU,
          attackCd:1.2,attackWindup:0,attacking:false,spitCd:2.5,chargeCd:3.5,phase:1,flash:0,hitReact:0,aggro:1,wander:rand()*TAU,heard:0
        };
        return {
          x,y,boss:false,type,hp:cfg.hp,maxHp:cfg.hp,speed:cfg.speed,radius:cfg.radius,scale:cfg.scale,pulse:rand()*TAU,
          attackCd:.4+rand()*.8,attackWindup:0,attacking:false,spitCd:1+rand()*2,chargeCd:0,phase:1,flash:0,hitReact:0,aggro:0,wander:rand()*TAU,heard:0
        };
      }

      function setupProps() {
        props = [];
        for (let i = 0; i < 5; i++) {
          const [x,y] = randomOpenCell(2.2);
          props.push({ x,y,type:i<2?'barrel':'crate',hp:i<2?2:1,alive:true,pulse:rand()*TAU });
        }
      }

      function setupEnemies() {
        enemies = [];
        bossActive = false; bossHp = 0;
        const count = mode === 'online' ? 4 : 3;
        for (let i=0;i<count;i++) enemies.push(spawnZombie({ forcedType:i===0?'walker':null }));
      }

      function stageForKills(k) {
        if (k >= 15) return 5;
        if (k >= 12) return 4;
        if (k >= 9) return 3;
        if (k >= 6) return 2;
        if (k >= 3) return 1;
        return 0;
      }

      function switchStage(next) {
        if (next === stage) return;
        stage = clamp(next,0,5); map = MAPS[stage]; rebuildOpenCells();
        player.x = 1.7; player.y = 1.7; player.a = .15;
        enemies = []; projectiles = []; pickups = [];
        setupProps();
        for (let i=0;i<Math.min(5,2+stage);i++) enemies.push(spawnZombie());
        stageBanner = 2.6; stageTransition = 1.1; lightning = stage===5 ? .7 : 0;
        shake = Math.max(shake, 7);
        onToast?.(`STAGE ${stage+1} — ${THEMES[stage].name}`);
      }

      function spawnPickup(kind = null) {
        const [x,y] = randomOpenCell(2.3);
        const kinds = ['med','ammo','armor'];
        pickups.push({ x,y,kind:kind || kinds[Math.floor(rand()*kinds.length)],pulse:rand()*TAU,life:30 });
      }

      function spawnScreenParticles(x, y, count, kind='spark', power=1) {
        if (reducedMotion) count = Math.ceil(count*.35);
        for (let i=0;i<count;i++) {
          const a = rand()*TAU, sp=(50+rand()*220)*power;
          particles.push({ x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-(kind==='shell'?80:0),life:.25+rand()*.55,max:.8,size:1+rand()*4,kind,rot:rand()*TAU,vr:(rand()-.5)*10 });
        }
        if (particles.length > 220) particles.splice(0, particles.length-220);
      }

      function addFloater(text, x, y, color='#fff', size=16) {
        floaters.push({text,x,y,vy:-30,life:.7,max:.7,color,size});
        if (floaters.length > 24) floaters.shift();
      }

      function toastAchievement(key, text) {
        if (achievementState.has(key)) return;
        achievementState.add(key); onToast?.(`ACHIEVEMENT — ${text}`);
      }

      function damagePlayer(amount, sourceX = player.x, sourceY = player.y) {
        if (mode === 'online' || player.invuln > 0 || completed) return;
        let dmg = amount;
        if (player.armor > 0) {
          const absorbed = Math.min(player.armor, dmg*.55);
          player.armor -= absorbed; dmg -= absorbed;
        }
        player.hp = Math.max(0, player.hp - dmg);
        damageDirection = normAngle(Math.atan2(sourceY-player.y,sourceX-player.x)-player.a);
        damageIndicator = .72;
        player.invuln = .18; damageFlash = .28; shake = Math.max(shake, 12 + amount*.4); rollShake = Math.max(rollShake,.018);
        if (!reducedMotion && navigator.vibrate) try { navigator.vibrate(18); } catch (_) {}
        const a = Math.atan2(sourceY-player.y,sourceX-player.x)-player.a;
        addFloater(`-${Math.round(dmg)}`, canvas.width/2 + Math.sin(a)*90, canvas.height*.62, '#fb7185', 18);
        if (player.hp <= 30) onToast?.('CRITICAL HEALTH');
        if (player.hp > 0) return;
        if (revives > 0) {
          revives--; player.hp = 60; player.armor = 0; player.x = 1.7; player.y = 1.7; player.a = .15;
          player.invuln = 1.5; combo = 0; multiplier = 1; shake = 22; damageFlash = .5;
          onToast?.('SECOND WIND — LAST CHANCE');
          return;
        }
        complete({type:'solo-defeat',reason:'overrun',score,kills,headshots,bestCombo});
      }

      function movePlayer(dt) {
        player.moveAmount = 0;
        let forward = 0, strafe = 0;
        if (keys.KeyW || keys.ArrowUp || keys.forward) forward += 1;
        if (keys.KeyS || keys.ArrowDown || keys.back) forward -= 1;
        forward = clamp(forward + touchMove.forward,-1,1);
        strafe = clamp(strafe + touchMove.strafe,-1,1);
        const inputLength = Math.hypot(forward,strafe);
        if (inputLength > 1) { forward/=inputLength; strafe/=inputLength; }
        const sprinting = (keys.ShiftLeft || keys.ShiftRight) && player.stamina > 1 && Math.abs(forward)>.2;
        const moveSpeed = (sprinting ? 3.15 : 2.25) * dt;
        const rotSpeed = 2.1 * dt;
        if (keys.KeyA || keys.ArrowLeft || keys.left) player.a -= rotSpeed;
        if (keys.KeyD || keys.ArrowRight || keys.right) player.a += rotSpeed;
        if (inputLength > .04) {
          const moveX=(Math.cos(player.a)*forward-Math.sin(player.a)*strafe)*moveSpeed;
          const moveY=(Math.sin(player.a)*forward+Math.cos(player.a)*strafe)*moveSpeed;
          const edgeX=moveX===0?0:Math.sign(moveX)*.22,edgeY=moveY===0?0:Math.sign(moveY)*.22;
          if (!isWall(player.x+moveX+edgeX,player.y)) player.x+=moveX;
          if (!isWall(player.x,player.y+moveY+edgeY)) player.y+=moveY;
          player.moveAmount = (sprinting ? 1.4 : 1)*clamp(inputLength,0,1);
          player.bob += dt*(sprinting?11:7);
          if (sprinting) player.stamina = Math.max(0,player.stamina-dt*28);
        } else player.stamina = Math.min(100,player.stamina+dt*22);
        if (!sprinting) player.stamina = Math.min(100,player.stamina+dt*10);
        player.a = normAngle(player.a);
      }

      function tryPickup() {
        for (let i=pickups.length-1;i>=0;i--) {
          const p=pickups[i];
          if (Math.hypot(p.x-player.x,p.y-player.y) > .55) continue;
          if (p.kind==='med') { player.hp=Math.min(100,player.hp+35); onToast?.('MEDKIT +35'); }
          if (p.kind==='ammo') { player.reserve=Math.min(180,player.reserve+36); onToast?.('AMMO +36'); }
          if (p.kind==='armor') { player.armor=Math.min(60,player.armor+25); onToast?.('ARMOR +25'); }
          pickups.splice(i,1); shake=Math.max(shake,3);
        }
      }

      function enemySeparation(z) {
        let sx=0,sy=0;
        for (const o of enemies) {
          if (o===z) continue;
          const dx=z.x-o.x,dy=z.y-o.y,d=Math.hypot(dx,dy);
          const desired=(z.radius+o.radius)*.82;
          if (d>0 && d<desired) { sx += dx/d*(desired-d); sy += dy/d*(desired-d); }
        }
        return [sx,sy];
      }

      function canEnemyOccupy(x,y,radius) {
        const r=Math.max(.18,radius*.62);
        return !isWall(x-r,y)&&!isWall(x+r,y)&&!isWall(x,y-r)&&!isWall(x,y+r);
      }

      function steerEnemy(z,angle,step,sepX,sepY) {
        const turns=[0,.58,-.58,1.08,-1.08,Math.PI];
        for (const turn of turns) {
          const a=angle+turn,nx=z.x+Math.cos(a)*step+sepX*.6,ny=z.y+Math.sin(a)*step+sepY*.6;
          if (!canEnemyOccupy(nx,ny,z.radius)) continue;
          z.x=nx;z.y=ny;z.wander=a;return true;
        }
        z.wander+=.9;return false;
      }

      function spawnSpit(z) {
        const a=Math.atan2(player.y-z.y,player.x-z.x);
        projectiles.push({x:z.x,y:z.y,vx:Math.cos(a)*1.8,vy:Math.sin(a)*1.8,life:3,kind:'acid',damage:z.boss?12:7});
      }

      function moveEnemies(dt) {
        const nowIntensity = clamp(kills/BOSS_UNLOCK_KILLS + stage*.09,0,1.5);
        director.intensity = lerp(director.intensity, nowIntensity, dt*.8);
        director.target = mode==='online' ? 5 : Math.min(8,3+Math.floor(stage*.7+director.intensity*2));
        director.spawnClock -= dt;
        if (!bossActive && enemies.length < director.target && director.spawnClock<=0) {
          enemies.push(spawnZombie({ minDist:3.2 })); director.spawnClock=1.1+rand()*1.4;
        }

        for (const z of enemies) {
          if (completed) break;
          z.attackCd-=dt; z.spitCd-=dt; z.chargeCd-=dt; z.flash=Math.max(0,z.flash-dt*5); z.hitReact=Math.max(0,z.hitReact-dt*5);
          const dx=player.x-z.x,dy=player.y-z.y,dist=Math.hypot(dx,dy), los=lineOfSight(z.x,z.y);
          if (los || dist<2.1) z.aggro=Math.min(1,z.aggro+dt*2.4); else z.aggro=Math.max(0,z.aggro-dt*.18);
          if (shots && elapsed-lastShotElapsed < 1.5 && dist<7) z.heard=1.5;
          z.heard=Math.max(0,z.heard-dt);

          if (z.boss && z.hp <= z.maxHp*.5 && z.phase===1) {
            z.phase=2; z.speed=.43; stageBanner=1.4; onToast?.('BOSS PHASE II — ENRAGED'); shake=18; lightning=1;
            enemies.push(spawnZombie({forcedType:'runner',minDist:2.6}),spawnZombie({forcedType:'crawler',minDist:2.6}));
          }

          if ((z.type==='spitter' || z.boss) && los && dist>1.5 && dist<6 && z.spitCd<=0) {
            spawnSpit(z); z.spitCd=z.boss?(z.phase===2?1.4:2.2):2.6+rand();
          }

          if (z.boss && z.phase===2 && los && dist>2 && dist<7 && z.chargeCd<=0) {
            z.chargeCd=4.2; z.speed=.95; z.chargeBoost=.55; onToast?.('BOSS CHARGE!');
          }
          if (z.chargeBoost>0) { z.chargeBoost-=dt; if(z.chargeBoost<=0) z.speed=z.phase===2?.43:.30; }

          const attackRange=z.boss?.98:isFatType(z.type)?.80:.69;
          if (z.attacking) {
            z.attackWindup-=dt;
            if (z.attackWindup<=0) {
              z.attacking=false;
              if (dist<attackRange+.2&&los) damagePlayer(z.boss?(z.phase===2?22:16):(ENEMY_TYPES[z.type]?.damage||8),z.x,z.y);
              z.attackCd=z.boss?.9:isFatType(z.type)?1.3+rand()*.35:1.05+rand()*.45;
            }
            continue;
          }
          if (dist < attackRange) {
            if (z.attackCd<=0) {
              z.attacking=true;
              z.attackWindup=z.boss?.46:isFatType(z.type)?.38:.22;
              if(z.boss) onToast?.('WARDEN STRIKE!');
            }
            continue;
          }
          if (!(z.aggro>.1 || z.heard>0)) {
            z.wander += (rand()-.5)*dt; continue;
          }
          let a=Math.atan2(dy,dx);
          if(z.type==='spitter'&&los){if(dist<2.7)a+=Math.PI;else if(dist<4.4)continue;}
          const [sepX,sepY]=enemySeparation(z);
          const speed=z.speed*dt*(z.hitReact>0?.35:1);
          steerEnemy(z,a,speed,sepX*dt,sepY*dt);
        }
      }

      function updateProjectiles(dt) {
        for (let i=projectiles.length-1;i>=0;i--) {
          const p=projectiles[i]; p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
          if (p.life<=0 || isWall(p.x,p.y)) { projectiles.splice(i,1); continue; }
          if (Math.hypot(p.x-player.x,p.y-player.y)<.28) { damagePlayer(p.damage,p.x,p.y); projectiles.splice(i,1); }
        }
      }

      function reload() {
        if (!running || paused || player.reload>0 || player.ammo>=player.mag || player.reserve<=0) return;
        player.reload=1.0; onToast?.('RELOADING');
      }

      function finishReload() {
        const need=player.mag-player.ammo, take=Math.min(need,player.reserve);
        player.ammo+=take; player.reserve-=take;
      }

      function hitProp(prop, sx, sy) {
        prop.hp--; spawnScreenParticles(sx,sy,9,'spark',.8); shake=Math.max(shake,7);
        if (prop.hp>0) return;
        prop.alive=false;
        if (prop.type==='barrel') {
          shake=Math.max(shake,20); rollShake=.025; muzzle=.08; spawnScreenParticles(sx,sy,38,'ember',1.4);
          for (const z of enemies.slice()) if (Math.hypot(z.x-prop.x,z.y-prop.y)<2.2) damageZombie(z,6,false,sx,sy,true);
        }
      }

      function damageZombie(z, damage, critical, sx, sy, explosive=false) {
        if(!z||z.hp<=0||!enemies.includes(z))return false;
        const durable=isDurableEnemy(z),appliedDamage=resolveDamage(z,damage,critical);
        z.hp=Math.max(0,z.hp-appliedDamage); z.flash=1; z.hitReact=1;
        hitFlash=.14; hitStop=Math.max(hitStop,critical?.055:.028); shake=Math.max(shake,critical?14:9); rollShake=Math.max(rollShake,critical?.012:.006);
        spawnScreenParticles(sx,sy,critical?22:13,critical?'spark':'blood',critical?1.25:1);
        addFloater(!durable&&z.hp<=0?'ONE SHOT':critical?'CRIT':'HIT',sx,sy-20,critical?'#fde68a':'#a7f3d0',critical?19:15);
        if (z.hp>0) {
          const label=z.boss?'WARDEN':ENEMY_TYPES[z.type]?.name||'FAT ZOMBIE';
          addFloater(`${label} ${Math.ceil(z.hp)}/${z.maxHp}`,sx,sy-45,z.boss?'#fb7185':'#fdba74',14);
          if (z.boss) { bossHp=z.hp; onProgress?.({kills,target:TARGET_KILLS,boss:true,bossHp,bossMaxHp:z.maxHp}); }
          return false;
        }

        const idx=enemies.indexOf(z); if(idx>=0) enemies.splice(idx,1);
        kills++; killConfirm=.18; combo = elapsed-lastKillAt<3.2 ? combo+1 : 1; lastKillAt=elapsed; bestCombo=Math.max(bestCombo,combo); multiplier=1+Math.min(2,Math.floor(combo/3)*.25);
        const base=z.boss?2500:(ENEMY_TYPES[z.type]?.score||100),gained=Math.round(base*multiplier + (critical?75:0));
        if(mode!=='online')score+=gained;
        onScore?.(mode==='online'?hits:score);
        if (critical) headshots++;
        addFloater(z.boss?'BOSS DOWN':`+${Math.round(base*multiplier)}`,sx,sy-44,z.boss?'#fb7185':'#fff',z.boss?26:18);
        if (combo>=5) toastAchievement('combo5','5 CHAIN');
        if (headshots>=5) toastAchievement('crit5','DEAD EYE');
        if (hits>=10 && shots>0 && hits/shots>=.8) toastAchievement('accuracy','SHARPSHOOTER');

        if (z.boss) {
          bossHp=0; onProgress?.({kills:TARGET_KILLS,target:TARGET_KILLS,boss:true,bossHp:0,bossMaxHp:z.maxHp});
          shake=28; rollShake=.04; slowMo=.22; stageBanner=2.4; lightning=1;
          spawnScreenParticles(sx,sy,70,'ember',2); onToast?.('BOSS ANNIHILATED');
          clearTimeout(completeTimer); completeTimer=setTimeout(()=>complete({type:'solo-clear',kills:TARGET_KILLS,bossDefeated:true,score,headshots,bestCombo}),650);
          return true;
        }

        if (mode==='online') return true;
        const nextStage=stageForKills(kills); if (nextStage!==stage) switchStage(nextStage);
        if ([5,10,15].includes(kills)) spawnPickup();
        if (kills>=BOSS_UNLOCK_KILLS && !bossActive) {
          if (stage!==5) switchStage(5);
          bossActive=true; const boss=spawnZombie({boss:true}); bossHp=boss.hp; enemies=[boss];
          stageBanner=2.8; shake=18; lightning=1; onToast?.('FINAL BOSS — THE WARDEN');
          onProgress?.({kills,target:TARGET_KILLS,boss:true,bossHp,bossMaxHp:boss.maxHp});
        } else onProgress?.({kills,target:TARGET_KILLS,boss:false});
        return true;
      }

      function findHitscanTarget() {
        const ca=Math.cos(player.a),sa=Math.sin(player.a);
        let best=null;
        const consider=(kind,target,radius)=>{
          const dx=target.x-player.x,dy=target.y-player.y;
          const forward=dx*ca+dy*sa;
          if(forward<=.08||forward>22)return;
          const lateral=Math.abs(-dx*sa+dy*ca);
          const aimAssist=clamp(forward*(.008+recoil*.018),.018,.13);
          const hitRadius=radius+aimAssist;
          if(lateral>hitRadius||!lineOfSight(target.x,target.y))return;
          const contact=forward-Math.sqrt(Math.max(0,hitRadius*hitRadius-lateral*lateral));
          const aimRatio=lateral/Math.max(.001,hitRadius);
          if(!best||contact<best.contact-.03||(Math.abs(contact-best.contact)<=.03&&aimRatio<best.aimRatio)) best={kind,target,contact,aimRatio};
        };
        for(const z of enemies)consider('enemy',z,z.radius);
        for(const prop of props)if(prop.alive)consider('prop',prop,.28);
        return best;
      }

      function shoot() {
        if (!running || paused || completed || player.reload>0) return;
        const now=performance.now()/1000;
        if (now-lastShotAt<.115) return;
        if (player.ammo<=0) { reload(); onToast?.('EMPTY'); return; }
        lastShotAt=now; lastShotElapsed=elapsed; shots++; player.ammo--; player.fireCooldown=.115;
        muzzle=.10; recoil=Math.min(.12,recoil+.038); shake=Math.max(shake,reducedMotion?4:13); rollShake=Math.max(rollShake,reducedMotion?.002:.009);
        if (!reducedMotion && navigator.vibrate) try { navigator.vibrate(10); } catch (_) {}
        const cx=canvas.width/2,cy=canvas.height/2;
        spawnScreenParticles(cx+canvas.width*.03,canvas.height*.76,3,'shell',.7);
        particles.push({x:cx,y:cy,vx:0,vy:0,life:.10,max:.10,size:2,kind:'tracer',rot:0,vr:0});

        const best=findHitscanTarget();
        if (!best) { combo=0; multiplier=1; onToast?.('MISS'); if(player.ammo===0) setTimeout(reload,80); return; }

        const critical=best.aimRatio<.22;
        if(best.kind==='prop') {
          hitProp(best.target,cx,cy);
          if(player.ammo===0)setTimeout(reload,80);
          return;
        }

        hits++;
        if (mode==='online') {
          score=hits; onScore?.(hits); onProgress?.({hits,target:20}); hitFlash=.13; shake=Math.max(shake,critical?16:11);
          const eliminated=damageZombie(best.target,1,critical,cx,cy);
          onToast?.(eliminated?`ELIM ${hits}/20`:isFatType(best.target.type)?`FAT HIT ${hits}/20`:critical?`CRIT ${hits}/20`:`HIT ${hits}/20`);
          if(hits>=20) complete({type:'online-hit-goal',hits:20,shots,accuracy:hits/Math.max(1,shots)});
          return;
        }
        damageZombie(best.target,1,critical,cx,cy);
        if(player.ammo===0) setTimeout(reload,80);
      }

      function complete(detail) {
        if (completed) return;
        completed=true; running=false; fireHeld=false; clearHeldControls();cancelAnimationFrame(raf);cancelAnimationFrame(fireHoldRaf);
        onComplete?.({...detail,score,hits,shots,kills,headshots,bestCombo,accuracy:hits/Math.max(1,shots),elapsedMs:elapsed*1000});
      }

      function raycastScene() {
        const w=canvas.width,h=canvas.height,t=THEMES[stage], horizon=h*.50;
        ctx.fillStyle=`rgb(${t.ceil.join(',')})`; ctx.fillRect(0,0,w,horizon);
        ctx.fillStyle=`rgb(${t.floor.join(',')})`; ctx.fillRect(0,horizon,w,h-horizon);

        const skyGlow=ctx.createLinearGradient(0,0,0,h*.42);
        skyGlow.addColorStop(0,`rgba(${t.fog.join(',')},.35)`); skyGlow.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=skyGlow; ctx.fillRect(0,0,w,h*.45);

        for(let y=horizon+5;y<h;y+=22){ const p=(y-horizon)/(h-horizon); ctx.fillStyle=`rgba(255,255,255,${.018*(1-p)})`;ctx.fillRect(0,y,w,1); }
        if(t.weather==='water'){ for(let y=h*.58;y<h;y+=12){ctx.fillStyle=`rgba(100,210,230,${.015+.02*Math.sin(elapsed*2+y*.04)})`;ctx.fillRect(0,y,w,2);} }
        if(t.weather==='rain'){ for(let x=0;x<w;x+=70){ctx.fillStyle='rgba(197,198,255,.04)';ctx.fillRect((x+elapsed*25)%w,0,2,h);} }

        const rays=rayCount, strip=w/rays; depth=new Array(rays);
        for(let i=0;i<rays;i++){
          const rayA=player.a-FOV/2+(i/rays)*FOV,ca=Math.cos(rayA),sa=Math.sin(rayA);
          let d=.02,side=1,hx=0,hy=0;
          while(d<22){hx=player.x+ca*d;hy=player.y+sa*d;if(isWall(hx,hy)){const fx=hx-Math.floor(hx),fy=hy-Math.floor(hy);side=Math.min(fx,1-fx)<Math.min(fy,1-fy)?.78:1;break;}d+=.035;}
          const corrected=Math.max(.06,d*Math.cos(rayA-player.a));depth[i]=corrected;
          const wallH=Math.min(h*2.2,h/corrected*.98),y=horizon-wallH/2;
          const light=clamp((1-corrected/20)*side,.16,1),tex=(Math.sin((hx+hy)*17+i*.21)+Math.sin(hy*8))*0.5;
          const base=tex>.35?t.wall2:t.wall;
          let flick=1;
          if(stage===5&&lightning>0) flick+=lightning*.8;
          const r=clamp(Math.round(base[0]*light*flick+18),0,255),g=clamp(Math.round(base[1]*light*flick+16),0,255),b=clamp(Math.round(base[2]*light*flick+16),0,255);
          ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillRect(i*strip,y,strip+1,wallH);
          if(i%17===0){ctx.fillStyle=`rgba(0,0,0,${.08+.08*(1-light)})`;ctx.fillRect(i*strip,y,Math.max(1,strip),wallH);}
          if(i%31===0){ctx.fillStyle=`rgba(255,255,255,${.025*light})`;ctx.fillRect(i*strip,y,strip,wallH*.35);}
        }

        if(flashlight){
          const g=ctx.createRadialGradient(w/2,h*.48,8,w/2,h*.48,w*.42);g.addColorStop(0,'rgba(255,248,220,.18)');g.addColorStop(.55,'rgba(255,240,200,.055)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
        }
      }

      function worldToScreen(wx,wy){
        const dx=wx-player.x,dy=wy-player.y,dist=Math.hypot(dx,dy),diff=normAngle(Math.atan2(dy,dx)-player.a);
        if(Math.abs(diff)>FOV*.72||!lineOfSight(wx,wy)) return null;
        const sx=(.5+diff/FOV)*canvas.width,rayIndex=clamp(Math.floor(sx/canvas.width*depth.length),0,depth.length-1);
        if(depth[rayIndex]&&dist>depth[rayIndex]+.25)return null;
        return {dist,diff,sx};
      }

      function drawZombie(z,v){
        const h=canvas.height, cfg=z.boss?null:ENEMY_TYPES[z.type];
        const fat=!z.boss&&isFatType(z.type);
        const scale=z.boss?2.0:z.scale,size=clamp(h*.72/v.dist*scale,z.boss?90:28,z.boss?360:210);
        const bob=Math.sin(elapsed*(z.type==='runner'?12:6)+z.pulse)*(z.boss?2:4),y=h*.50-size*.34+bob;
        ctx.save();ctx.translate(v.sx,y);
        if(z.hitReact>0) ctx.rotate((rand()-.5)*.08*z.hitReact);
        ctx.shadowBlur=z.attacking?32:z.boss?30:12;ctx.shadowColor=z.attacking?'rgba(251,146,60,.88)':z.boss?'rgba(220,38,38,.5)':'rgba(80,130,70,.32)';
        const body=z.boss?'#4b2628':cfg.body,skin=z.boss?'#a56f52':cfg.skin;
        if(z.type==='crawler'&&!z.boss){ctx.scale(1,0.7);ctx.translate(0,size*.22);}
        ctx.fillStyle=body;ctx.fillRect(-size*.18,size*.20,size*.13,size*.32);ctx.fillRect(size*.05,size*.20,size*.13,size*.32);
        ctx.fillStyle=z.flash>0?'#d8f3dc':body;ctx.beginPath();
        if(z.boss)ctx.ellipse(0,size*.10,size*.35,size*.34,0,0,TAU);else ctx.roundRect(-size*.21,-size*.02,size*.42,size*.42,size*.06);ctx.fill();
        ctx.strokeStyle=z.attacking?'#fdba74':skin;ctx.lineWidth=Math.max(4,size*.095);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-size*.18,size*.04);ctx.lineTo(-size*(z.attacking?.43:.37),size*(z.attacking?-.02:.24));ctx.moveTo(size*.18,size*.04);ctx.lineTo(size*(z.attacking?.43:.37),size*(z.attacking?-.02:.24));ctx.stroke();
        ctx.fillStyle=skin;ctx.beginPath();ctx.arc(0,-size*.17,size*(z.boss?.19:.16),0,TAU);ctx.fill();
        ctx.fillStyle=z.boss?'#ffedd5':'#d1fae5';ctx.fillRect(-size*.078,-size*.205,size*.042,size*.036);ctx.fillRect(size*.036,-size*.205,size*.042,size*.036);
        ctx.fillStyle=z.type==='spitter'?'#84cc16':'#311';ctx.fillRect(-size*.07,-size*.115,size*.14,size*.035);
        if(fat){ctx.strokeStyle='rgba(255,190,105,.45)';ctx.lineWidth=2;ctx.strokeRect(-size*.25,-size*.06,size*.5,size*.5);}
        if(fat){
          ctx.fillStyle='rgba(0,0,0,.76)';ctx.fillRect(-size*.29,-size*.48,size*.58,size*.085);ctx.fillStyle='#fb923c';ctx.fillRect(-size*.28,-size*.465,size*.56*clamp(z.hp/z.maxHp,0,1),size*.042);
          ctx.fillStyle='#ffedd5';ctx.font=`900 ${Math.max(11,size*.065)}px system-ui`;ctx.textAlign='center';ctx.fillText(cfg.name,0,-size*.53);
        }
        if(z.boss){
          ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(-size*.31,-size*.49,size*.62,size*.09);ctx.fillStyle=z.phase===2?'#fb7185':'#ef4444';ctx.fillRect(-size*.30,-size*.475,size*.60*clamp(z.hp/z.maxHp,0,1),size*.055);
          ctx.fillStyle='#fff';ctx.font=`900 ${Math.max(13,size*.07)}px system-ui`;ctx.textAlign='center';ctx.fillText(z.phase===2?'WARDEN • ENRAGED':'THE WARDEN',0,-size*.55);
        }
        ctx.restore();
      }

      function drawWorldObjects() {
        const visibles=[];
        for(const z of enemies){const v=worldToScreen(z.x,z.y);if(v)visibles.push({kind:'z',z,v,dist:v.dist});}
        for(const p of pickups){const v=worldToScreen(p.x,p.y);if(v)visibles.push({kind:'pickup',p,v,dist:v.dist});}
        for(const p of props){if(!p.alive)continue;const v=worldToScreen(p.x,p.y);if(v)visibles.push({kind:'prop',p,v,dist:v.dist});}
        for(const p of projectiles){const v=worldToScreen(p.x,p.y);if(v)visibles.push({kind:'projectile',p,v,dist:v.dist});}
        visibles.sort((a,b)=>b.dist-a.dist);
        for(const o of visibles){
          if(o.kind==='z'){drawZombie(o.z,o.v);continue;}
          const size=clamp(canvas.height*.24/o.dist,12,85),x=o.v.sx,y=canvas.height*.53-size*.2;
          ctx.save();ctx.translate(x,y);
          if(o.kind==='pickup'){
            const c=o.p.kind==='med'?'#4ade80':o.p.kind==='ammo'?'#fde047':'#60a5fa';ctx.shadowBlur=18;ctx.shadowColor=c;ctx.fillStyle=c;ctx.rotate(elapsed*.8+o.p.pulse);ctx.fillRect(-size*.18,-size*.18,size*.36,size*.36);ctx.fillStyle='#fff';ctx.font=`900 ${Math.max(9,size*.13)}px system-ui`;ctx.textAlign='center';ctx.fillText(o.p.kind==='med'?'+':o.p.kind==='ammo'?'AM':'AR',0,size*.04);
          } else if(o.kind==='prop'){
            ctx.fillStyle=o.p.type==='barrel'?'#7f1d1d':'#6b4f35';ctx.fillRect(-size*.22,-size*.25,size*.44,size*.5);ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=2;ctx.strokeRect(-size*.22,-size*.25,size*.44,size*.5);if(o.p.type==='barrel'){ctx.fillStyle='#f59e0b';ctx.fillRect(-size*.16,-size*.035,size*.32,size*.07);}
          } else {
            ctx.shadowBlur=18;ctx.shadowColor='#84cc16';ctx.fillStyle='#a3e635';ctx.beginPath();ctx.arc(0,0,size*.13,0,TAU);ctx.fill();
          }
          ctx.restore();
        }
      }

      function drawWeapon() {
        const w=canvas.width,h=canvas.height,bobX=Math.sin(player.bob)*7*player.moveAmount,bobY=Math.abs(Math.cos(player.bob))*7*player.moveAmount,reloadDrop=player.reload>0?Math.sin(clamp(player.reload,0,1)*Math.PI)*h*.10:0;
        const kick=recoil*h*1.5;
        ctx.save();ctx.translate(bobX,bobY+kick+reloadDrop);ctx.rotate(-recoil*.15);
        ctx.fillStyle='#171717';ctx.beginPath();ctx.moveTo(w*.39,h);ctx.lineTo(w*.455,h*.79);ctx.lineTo(w*.545,h*.79);ctx.lineTo(w*.61,h);ctx.fill();
        ctx.fillStyle='#343434';ctx.fillRect(w*.474,h*.70,w*.052,h*.16);ctx.fillStyle='#555';ctx.fillRect(w*.487,h*.665,w*.026,h*.075);
        ctx.fillStyle='#111';ctx.fillRect(w*.43,h*.82,w*.14,h*.06);ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(w*.486,h*.68,w*.005,h*.12);
        if(muzzle>0){
          const a=clamp(muzzle*12,0,1),mx=w*.5,my=h*.665;ctx.save();ctx.translate(mx,my);ctx.fillStyle=`rgba(255,226,120,${a})`;ctx.shadowBlur=26;ctx.shadowColor='#ffb703';ctx.beginPath();for(let i=0;i<16;i++){const ang=i/16*TAU,r=i%2?10:34+muzzle*130;const x=Math.cos(ang)*r,y=Math.sin(ang)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.restore();
        }
        ctx.restore();
      }

      function drawParticles(dt) {
        for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=p.kind==='shell'?420*dt:90*dt;p.rot+=p.vr*dt;const a=clamp(p.life/p.max,0,1);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);
          if(p.kind==='blood')ctx.fillStyle=`rgba(140,28,35,${a})`;else if(p.kind==='ember')ctx.fillStyle=`rgba(251,146,60,${a})`;else if(p.kind==='shell')ctx.fillStyle=`rgba(202,138,4,${a})`;else if(p.kind==='tracer'){ctx.strokeStyle=`rgba(255,244,190,${a})`;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-canvas.width*.15,canvas.height*.22);ctx.lineTo(0,0);ctx.stroke();ctx.restore();continue;}else ctx.fillStyle=`rgba(250,250,220,${a})`;
          ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);ctx.restore();}
        for(let i=floaters.length-1;i>=0;i--){const f=floaters[i];f.life-=dt;if(f.life<=0){floaters.splice(i,1);continue;}f.y+=f.vy*dt;ctx.globalAlpha=clamp(f.life/f.max,0,1);ctx.fillStyle=f.color;ctx.font=`900 ${f.size}px system-ui`;ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y);ctx.globalAlpha=1;ctx.textAlign='start';}
      }

      function drawWeather() {
        const w=canvas.width,h=canvas.height,t=THEMES[stage],n=reducedMotion?12:34;
        ctx.save();
        if(t.weather==='rain'||t.weather==='spray'){
          ctx.strokeStyle=t.weather==='rain'?'rgba(170,190,255,.17)':'rgba(205,235,255,.11)';ctx.lineWidth=1;
          for(let i=0;i<n;i++){const x=(i*97+weatherClock*260)%w,y=(i*53+weatherClock*410)%h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-6,y+18);ctx.stroke();}
        }else if(t.weather==='embers'){
          for(let i=0;i<n;i++){const x=(i*83+Math.sin(i)*40)%w,y=h-((i*67+weatherClock*45)%h);ctx.fillStyle=`rgba(251,113,80,${.12+(i%5)*.03})`;ctx.fillRect(x,y,2+(i%2),2+(i%2));}
        }else if(t.weather==='dust'||t.weather==='mist'){
          for(let i=0;i<n;i++){const x=(i*113+weatherClock*(t.weather==='mist'?16:7))%w,y=(i*47)%h;ctx.fillStyle=t.weather==='mist'?'rgba(220,235,225,.035)':'rgba(235,220,180,.055)';ctx.beginPath();ctx.arc(x,y,1+(i%4),0,TAU);ctx.fill();}
        }
        ctx.restore();
      }

      function nearestEnemy() {
        let nearest=null,bestDistance=Infinity;
        for(const z of enemies){const distance=Math.hypot(z.x-player.x,z.y-player.y);if(distance<bestDistance){nearest=z;bestDistance=distance;}}
        return nearest?{z:nearest,distance:bestDistance}:null;
      }

      function drawObjectiveIndicator() {
        const target=nearestEnemy();if(!target)return;
        const w=canvas.width,relative=normAngle(Math.atan2(target.z.y-player.y,target.z.x-player.x)-player.a);
        const side=relative<-.08?'◀':relative>.08?'▶':'◆';
        const label=target.z.boss?'BOSS':isFatType(target.z.type)?'FAT':'TARGET';
        ctx.save();ctx.fillStyle='rgba(8,10,12,.68)';ctx.fillRect(w*.5-88,48,176,28);
        ctx.fillStyle=target.z.boss?'#fb7185':isFatType(target.z.type)?'#fb923c':'#f8fafc';ctx.font='900 12px system-ui';ctx.textAlign='center';
        ctx.fillText(`${side} ${label}  ${target.distance.toFixed(1)}m`,w*.5,67);ctx.restore();
      }

      function drawDamageIndicator() {
        if(damageIndicator<=0)return;
        const w=canvas.width,h=canvas.height,a=damageDirection-Math.PI/2,r=Math.min(w,h)*.27;
        ctx.save();ctx.globalAlpha=clamp(damageIndicator/.72,0,1);ctx.strokeStyle='#fb7185';ctx.lineWidth=8;ctx.lineCap='round';ctx.shadowBlur=14;ctx.shadowColor='#ef4444';
        ctx.beginPath();ctx.arc(w/2,h/2,r,a-.24,a+.24);ctx.stroke();ctx.restore();
      }

      function drawTouchGuides() {
        if(touchMove.id===null&&touchAim.id===null)return;
        ctx.save();ctx.lineWidth=3;
        if(touchMove.id!==null){
          const dx=touchMove.x-touchMove.startX,dy=touchMove.y-touchMove.startY,len=Math.hypot(dx,dy),limit=58,scale=len>limit?limit/len:1;
          ctx.strokeStyle='rgba(255,255,255,.34)';ctx.fillStyle='rgba(4,8,12,.24)';ctx.beginPath();ctx.arc(touchMove.startX,touchMove.startY,58,0,TAU);ctx.fill();ctx.stroke();
          ctx.fillStyle='rgba(125,211,252,.55)';ctx.beginPath();ctx.arc(touchMove.startX+dx*scale,touchMove.startY+dy*scale,24,0,TAU);ctx.fill();
        }
        if(touchAim.id!==null){ctx.strokeStyle='rgba(251,113,133,.38)';ctx.beginPath();ctx.arc(touchAim.lastX,touchAim.lastY,26,0,TAU);ctx.stroke();}
        ctx.restore();
      }

      function drawHUD() {
        const w=canvas.width,h=canvas.height,t=THEMES[stage],cx=w/2,cy=h/2;
        const crossGap=7+recoil*150+player.moveAmount*2;
        ctx.strokeStyle=killConfirm>0?'#fb7185':hitFlash>0?'#86efac':'rgba(255,255,255,.92)';ctx.lineWidth=killConfirm>0?3:2;ctx.beginPath();ctx.moveTo(cx-18-crossGap,cy);ctx.lineTo(cx-crossGap,cy);ctx.moveTo(cx+crossGap,cy);ctx.lineTo(cx+18+crossGap,cy);ctx.moveTo(cx,cy-18-crossGap);ctx.lineTo(cx,cy-crossGap);ctx.moveTo(cx,cy+crossGap);ctx.lineTo(cx,cy+18+crossGap);ctx.stroke();
        if(hitFlash>0){ctx.strokeStyle='rgba(134,239,172,.95)';ctx.beginPath();ctx.moveTo(cx-10,cy-10);ctx.lineTo(cx-3,cy-3);ctx.moveTo(cx+10,cy-10);ctx.lineTo(cx+3,cy-3);ctx.moveTo(cx-10,cy+10);ctx.lineTo(cx-3,cy+3);ctx.moveTo(cx+10,cy+10);ctx.lineTo(cx+3,cy+3);ctx.stroke();}

        ctx.fillStyle='rgba(8,10,12,.72)';ctx.fillRect(12,12,292,112);ctx.fillStyle='#fff';ctx.font='900 17px system-ui';ctx.fillText(mode==='online'?`HIT ${hits} / ${TARGET_KILLS}`:`SCORE ${score.toLocaleString()}`,24,37);ctx.fillStyle=t.accent;ctx.font='800 13px system-ui';ctx.fillText(`STAGE ${stage+1} • ${t.name} • KILL ${kills}/${TARGET_KILLS}`,24,58);ctx.fillStyle='#cbd5e1';ctx.fillText(`COMBO x${combo}  MULTI ${multiplier.toFixed(2)}  ACC ${Math.round(hits/Math.max(1,shots)*100)}%`,24,80);ctx.fillStyle='#fdba74';ctx.fillText('NORMAL: 1 SHOT  •  FAT/BOSS: ARMORED',24,102);

        const bw=220,bx=18,by=h-79;ctx.fillStyle='rgba(8,10,12,.72)';ctx.fillRect(bx-6,by-16,bw+12,80);
        ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(bx,by,bw,10);ctx.fillStyle=player.hp>30?'#4ade80':'#fb7185';ctx.fillRect(bx,by,bw*player.hp/100,10);ctx.fillStyle='#fff';ctx.font='800 12px system-ui';ctx.fillText(`HP ${Math.ceil(player.hp)}`,bx,by-3);
        ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(bx,by+22,bw,7);ctx.fillStyle='#60a5fa';ctx.fillRect(bx,by+22,bw*player.armor/60,7);ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(bx,by+39,bw,6);ctx.fillStyle='#fbbf24';ctx.fillRect(bx,by+39,bw*player.stamina/100,6);ctx.fillStyle=revives?'#a7f3d0':'#fda4af';ctx.fillText(revives?'SECOND WIND READY':'LAST CHANCE',bx,by+59);

        ctx.fillStyle='rgba(8,10,12,.72)';ctx.fillRect(w-190,h-83,178,70);ctx.fillStyle='#fff';ctx.font='950 28px ui-monospace,monospace';ctx.fillText(`${String(player.ammo).padStart(2,'0')} / ${String(player.reserve).padStart(3,'0')}`,w-178,h-49);ctx.fillStyle=player.reload>0?'#fbbf24':'#94a3b8';ctx.font='800 12px system-ui';ctx.fillText(player.reload>0?'RELOADING':'R • RELOAD   F • LIGHT',w-176,h-27);
        if(player.reload>0){ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(w-178,h-21,150,4);ctx.fillStyle='#fbbf24';ctx.fillRect(w-178,h-21,150*(1-player.reload),4);}

        ctx.fillStyle='rgba(8,10,12,.58)';ctx.fillRect(w*.5-93,12,186,30);ctx.fillStyle='#fff';ctx.font='800 12px system-ui';ctx.textAlign='center';const deg=(player.a*180/Math.PI+360)%360;ctx.fillText(`${deg<45||deg>=315?'N':deg<135?'E':deg<225?'S':'W'}  ${Math.round(deg)}°`,w*.5,32);ctx.textAlign='start';

        drawObjectiveIndicator();drawMinimap();drawDamageIndicator();drawTouchGuides();
        if(bossActive&&bossHp>0){const barW=Math.min(360,w*.42),barX=(w-barW)/2,barY=84;ctx.fillStyle='rgba(8,10,12,.78)';ctx.fillRect(barX-8,barY-18,barW+16,36);ctx.fillStyle='#fff';ctx.font='900 11px system-ui';ctx.textAlign='center';ctx.fillText('THE WARDEN',w/2,barY-5);ctx.fillStyle='rgba(255,255,255,.14)';ctx.fillRect(barX,barY,barW,8);ctx.fillStyle='#fb7185';ctx.fillRect(barX,barY,barW*clamp(bossHp/BOSS_MAX_HP,0,1),8);ctx.textAlign='start';}
        if(stageBanner>0){ctx.globalAlpha=Math.min(1,stageBanner*1.4);ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(w*.18,h*.20,w*.64,h*.22);ctx.fillStyle='#fff';ctx.font=`950 ${clamp(w*.045,26,48)}px system-ui`;ctx.textAlign='center';ctx.fillText(`STAGE ${stage+1} — ${t.name}`,w/2,h*.30);ctx.fillStyle=t.accent;ctx.font='800 16px system-ui';ctx.fillText(t.subtitle,w/2,h*.35);ctx.textAlign='start';ctx.globalAlpha=1;}
        if(paused){ctx.fillStyle='rgba(0,0,0,.62)';ctx.fillRect(0,0,w,h);ctx.fillStyle='#fff';ctx.font='950 48px system-ui';ctx.textAlign='center';ctx.fillText('PAUSED',w/2,h/2);ctx.font='700 15px system-ui';ctx.fillText('P / PAUSE で再開',w/2,h/2+32);ctx.textAlign='start';}
      }

      function drawMinimap(){
        const w=canvas.width,size=Math.min(120,w*.18),x=w-size-14,y=50,cell=size/mapW;ctx.save();ctx.globalAlpha=.78;ctx.fillStyle='rgba(0,0,0,.58)';ctx.fillRect(x-4,y-4,size+8,size*mapH/mapW+8);
        ctx.fillStyle='rgba(255,255,255,.14)';for(let my=0;my<mapH;my++)for(let mx=0;mx<mapW;mx++)if(map[my][mx]==='1')ctx.fillRect(x+mx*cell,y+my*cell,cell,cell);
        ctx.fillStyle='#4ade80';ctx.beginPath();ctx.arc(x+player.x*cell,y+player.y*cell,3,0,TAU);ctx.fill();ctx.strokeStyle='#4ade80';ctx.beginPath();ctx.moveTo(x+player.x*cell,y+player.y*cell);ctx.lineTo(x+(player.x+Math.cos(player.a)*.7)*cell,y+(player.y+Math.sin(player.a)*.7)*cell);ctx.stroke();
        const target=nearestEnemy();for(const z of enemies){const close=Math.hypot(z.x-player.x,z.y-player.y)<4.5;if(!close&&target?.z!==z)continue;ctx.fillStyle=z.boss?'#fb7185':isFatType(z.type)?'#fb923c':'#f87171';ctx.beginPath();ctx.arc(x+z.x*cell,y+z.y*cell,z.boss?3.4:isFatType(z.type)?2.5:1.7,0,TAU);ctx.fill();if(target?.z===z){ctx.strokeStyle='rgba(255,255,255,.85)';ctx.beginPath();ctx.arc(x+z.x*cell,y+z.y*cell,4+Math.sin(elapsed*5),0,TAU);ctx.stroke();}}
        ctx.restore();
      }

      function postFx() {
        const w=canvas.width,h=canvas.height;
        const vig=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.max(w,h)*.72);vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,`rgba(0,0,0,${player.hp<30?.52:.33})`);ctx.fillStyle=vig;ctx.fillRect(0,0,w,h);
        if(damageFlash>0){ctx.fillStyle=`rgba(190,24,45,${damageFlash*.42})`;ctx.fillRect(0,0,w,h);}
        if(lightning>0){ctx.fillStyle=`rgba(255,245,235,${lightning*.22})`;ctx.fillRect(0,0,w,h);}
        const grainAlpha=reducedMotion?.012:.022;ctx.fillStyle=`rgba(255,255,255,${grainAlpha})`;for(let i=0;i<65;i++)ctx.fillRect((i*97+elapsed*173)%w,(i*53+elapsed*89)%h,1,1);
        if(recoil>.02){ctx.fillStyle=`rgba(255,40,40,${recoil*.12})`;ctx.fillRect(0,0,2,h);ctx.fillStyle=`rgba(40,120,255,${recoil*.10})`;ctx.fillRect(w-2,0,2,h);}
      }

      function render(dt=.016) {
        const w=canvas.width,h=canvas.height;
        const amp=reducedMotion?shake*.25:shake, sx=(rand()-.5)*amp,sy=(rand()-.5)*amp,rot=(rand()-.5)*rollShake;
        ctx.save();ctx.translate(w/2+sx,h/2+sy);ctx.rotate(rot);ctx.translate(-w/2,-h/2);
        raycastScene();drawWorldObjects();drawWeapon();drawWeather();ctx.restore();
        drawParticles(dt);drawHUD();postFx();
      }

      function loop(now) {
        if(!running)return;
        let rawDt=Math.min(.045,(now-last)/1000||.016); last=now; frameAvg=lerp(frameAvg,rawDt*1000,.05);
        if(frameAvg>24&&rayCount>190)rayCount-=2;else if(frameAvg<17&&rayCount<340)rayCount+=1;
        if(paused){render(0);raf=requestAnimationFrame(loop);return;}
        const timeScale=slowMo<.99?slowMo:1,dt=rawDt*timeScale;elapsed+=rawDt;weatherClock+=rawDt;
        if(hitStop>0)hitStop-=rawDt;else{movePlayer(dt);moveEnemies(dt);updateProjectiles(dt);tryPickup();}
        if(player.reload>0){const before=player.reload;player.reload=Math.max(0,player.reload-rawDt);if(before>0&&player.reload===0)finishReload();}
        player.invuln=Math.max(0,player.invuln-rawDt);player.fireCooldown=Math.max(0,player.fireCooldown-rawDt);
        for(const p of pickups)p.life-=rawDt;pickups=pickups.filter(p=>p.life>0);
        muzzle=Math.max(0,muzzle-rawDt*1.7);hitFlash=Math.max(0,hitFlash-rawDt*3);damageFlash=Math.max(0,damageFlash-rawDt*1.8);damageIndicator=Math.max(0,damageIndicator-rawDt);killConfirm=Math.max(0,killConfirm-rawDt);recoil=Math.max(0,recoil-rawDt*.55);shake=Math.max(0,shake-rawDt*50);rollShake=Math.max(0,rollShake-rawDt*.11);stageBanner=Math.max(0,stageBanner-rawDt);stageTransition=Math.max(0,stageTransition-rawDt);lightning=Math.max(0,lightning-rawDt*2.4);slowMo=lerp(slowMo,1,rawDt*1.5);
        if(combo>0&&elapsed-lastKillAt>3.2){combo=0;multiplier=1;}
        if(stage===5&&rand()<rawDt*.09)lightning=.55;
        render(rawDt);raf=requestAnimationFrame(loop);
      }

      const releaseTouchControls=()=>{touchMove.id=null;touchMove.forward=0;touchMove.strafe=0;touchAim.id=null;};
      const clearHeldControls=()=>{for(const key of Object.keys(keys))keys[key]=false;releaseTouchControls();};
      const setPaused=next=>{if(!running||completed)return;paused=Boolean(next);if(paused){clearHeldControls();fireHeld=false;cancelAnimationFrame(fireHoldRaf);}onToast?.(paused?'PAUSED':'RESUME');};
      const keyDown=e=>{
        if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
        keys[e.code]=true;
        if(e.code==='Space'&&!e.repeat)shoot();
        if(e.code==='KeyR'&&!e.repeat)reload();
        if(e.code==='KeyF'&&!e.repeat){flashlight=!flashlight;onToast?.(flashlight?'FLASHLIGHT ON':'FLASHLIGHT OFF');}
        if(e.code==='KeyP'&&!e.repeat)setPaused(!paused);
      };
      const keyUp=e=>{keys[e.code]=false;};
      window.addEventListener('keydown',keyDown,{passive:false});window.addEventListener('keyup',keyUp);

      const canvasPoint=(e,rect=canvas.getBoundingClientRect())=>({x:(e.clientX-rect.left)*canvas.width/Math.max(1,rect.width),y:(e.clientY-rect.top)*canvas.height/Math.max(1,rect.height)});
      const pointerDown=e=>{
        if(!running||paused)return;
        const rect=canvas.getBoundingClientRect(),point=canvasPoint(e,rect),left=e.clientX<rect.left+rect.width*.5;
        if(left){
          if(touchMove.id!==null)return;
          Object.assign(touchMove,{id:e.pointerId,startX:point.x,startY:point.y,x:point.x,y:point.y,forward:0,strafe:0});
        }else{
          if(touchAim.id!==null)return;
          Object.assign(touchAim,{id:e.pointerId,lastX:point.x,lastY:point.y,lastClientX:e.clientX,lastClientY:e.clientY});
        }
        try{canvas.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();
      };
      const pointerMove=e=>{
        if(!running||paused)return;
        const point=canvasPoint(e);
        if(e.pointerId===touchMove.id){
          touchMove.x=point.x;touchMove.y=point.y;
          const dx=point.x-touchMove.startX,dy=point.y-touchMove.startY,dead=.08;
          touchMove.forward=Math.abs(dy)<8?0:clamp(-dy/68,-1,1);
          touchMove.strafe=Math.abs(dx)<8?0:clamp(dx/68,-1,1);
          if(Math.abs(touchMove.forward)<dead)touchMove.forward=0;if(Math.abs(touchMove.strafe)<dead)touchMove.strafe=0;
        }else if(e.pointerId===touchAim.id){
          const dx=e.clientX-touchAim.lastClientX;touchAim.lastClientX=e.clientX;touchAim.lastClientY=e.clientY;touchAim.lastX=point.x;touchAim.lastY=point.y;
          player.a=normAngle(player.a+dx*(e.pointerType==='mouse'?.0055:.0072));
        }else return;
        e.preventDefault();
      };
      const pointerUp=e=>{
        if(e.pointerId===touchMove.id){touchMove.id=null;touchMove.forward=0;touchMove.strafe=0;}
        else if(e.pointerId===touchAim.id)touchAim.id=null;
        else return;
        try{canvas.releasePointerCapture(e.pointerId);}catch(_){}e.preventDefault();
      };
      canvas.addEventListener('pointerdown',pointerDown,{passive:false});canvas.addEventListener('pointermove',pointerMove,{passive:false});canvas.addEventListener('pointerup',pointerUp,{passive:false});canvas.addEventListener('pointercancel',pointerUp,{passive:false});

      const controlHandlers=[];
      controlsRoot?.querySelectorAll('[data-fps]').forEach(btn=>{const action=btn.dataset.fps;const down=e=>{e.preventDefault();if(action==='shoot')shoot();else if(action==='reload')reload();else if(action==='flash'){flashlight=!flashlight;onToast?.(flashlight?'FLASHLIGHT ON':'FLASHLIGHT OFF');}else if(action==='pause')setPaused(!paused);else if(action==='sprint')keys.ShiftLeft=true;else keys[action]=true;};const up=e=>{e.preventDefault();if(action==='sprint')keys.ShiftLeft=false;else if(!['shoot','reload','flash','pause'].includes(action))keys[action]=false;};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);btn.addEventListener('pointerleave',up);controlHandlers.push([btn,down,up]);});

      const visibilityChange=()=>{if(document.hidden&&mode==='solo'&&running&&!paused)setPaused(true);};
      document.addEventListener('visibilitychange',visibilityChange);

      const fireDown=e=>{e.preventDefault();fireHeld=true;shoot();const tick=()=>{if(!fireHeld)return;shoot();fireHoldRaf=requestAnimationFrame(tick);};cancelAnimationFrame(fireHoldRaf);fireHoldRaf=requestAnimationFrame(tick);};
      const fireUp=e=>{if(e)e.preventDefault();fireHeld=false;cancelAnimationFrame(fireHoldRaf);};
      fireButton?.addEventListener('pointerdown',fireDown,{passive:false});fireButton?.addEventListener('pointerup',fireUp,{passive:false});fireButton?.addEventListener('pointercancel',fireUp,{passive:false});fireButton?.addEventListener('pointerleave',fireUp,{passive:false});

      function drawIdle(){const w=canvas.width,h=canvas.height;ctx.fillStyle='#120f14';ctx.fillRect(0,0,w,h);const g=ctx.createRadialGradient(w*.5,h*.42,20,w*.5,h*.42,w*.6);g.addColorStop(0,'rgba(120,32,50,.45)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);ctx.fillStyle='#fff';ctx.font=`950 ${clamp(w*.05,30,56)}px system-ui`;ctx.textAlign='center';ctx.fillText('LIMINAL ZOMBIE FPS',w/2,h*.43);ctx.fillStyle='#fb7185';ctx.font='900 18px system-ui';ctx.fillText('REBORN • 6 STAGES • FINAL WARDEN',w/2,h*.49);ctx.fillStyle='#fdba74';ctx.font='900 15px system-ui';ctx.fillText('NORMAL = ONE SHOT  •  FAT / BOSS = ARMORED',w/2,h*.55);ctx.fillStyle='#cbd5e1';ctx.font='700 14px system-ui';ctx.fillText('左: 移動 / 右: 視点 / FIRE: 射撃',w/2,h*.61);ctx.textAlign='start';}
      drawIdle();

      return {
        start(seed){
          rand=rng32(seed||1);stage=0;map=MAPS[0];rebuildOpenCells();resetPlayer();
          enemies=[];projectiles=[];pickups=[];props=[];particles=[];floaters=[];achievementState=new Set();
          score=shots=hits=kills=headshots=combo=bestCombo=0;lastShotAt=lastShotElapsed=lastKillAt=-99;clearTimeout(completeTimer);completeTimer=0;multiplier=1;elapsed=0;completed=false;paused=false;bossActive=false;bossHp=0;revives=1;muzzle=hitFlash=damageFlash=damageIndicator=killConfirm=recoil=shake=rollShake=hitStop=0;slowMo=1;stageBanner=2.4;flashlight=true;rayCount=300;director={intensity:0,spawnClock:0,target:3};clearHeldControls();
          setupProps();setupEnemies();onScore?.(0);onProgress?.(mode==='online'?{hits:0,target:TARGET_KILLS}:{kills:0,target:TARGET_KILLS,boss:false});
          running=true;last=performance.now();cancelAnimationFrame(raf);raf=requestAnimationFrame(loop);
        },
        shoot,
        stop(){running=false;fireHeld=false;clearHeldControls();clearTimeout(completeTimer);cancelAnimationFrame(raf);cancelAnimationFrame(fireHoldRaf);render(0);return{score,hits,shots,kills,headshots,bestCombo,boss:bossActive,bossHp,revives,elapsedMs:elapsed*1000};},
        destroy(){running=false;fireHeld=false;clearHeldControls();clearTimeout(completeTimer);cancelAnimationFrame(raf);cancelAnimationFrame(fireHoldRaf);window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);document.removeEventListener('visibilitychange',visibilityChange);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);fireButton?.removeEventListener('pointerdown',fireDown);fireButton?.removeEventListener('pointerup',fireUp);fireButton?.removeEventListener('pointercancel',fireUp);fireButton?.removeEventListener('pointerleave',fireUp);for(const[btn,down,up]of controlHandlers){btn.removeEventListener('pointerdown',down);btn.removeEventListener('pointerup',up);btn.removeEventListener('pointercancel',up);btn.removeEventListener('pointerleave',up);}}
      };
    }
  };
})();
