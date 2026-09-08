(() => {
  'use strict';

  const MAP = [
    '1111111111111111',
    '1000001000000001',
    '1011101011110101',
    '1000101000010101',
    '1110101111010101',
    '1000100001010001',
    '1011110101011101',
    '1000000101000001',
    '1011111101110101',
    '1000000000010101',
    '1011110111010101',
    '1010000100010001',
    '1010111101111101',
    '1000000000000001',
    '1111111111111111'
  ];
  const MAP_W = MAP[0].length, MAP_H = MAP.length;
  const FOV = Math.PI / 3;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const normAngle = a => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
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

  window.ARCADE_GAME = {
    title: 'LIMINAL ZOMBIE FPS',
    instructions: '黄色い迷路を探索するゾンビFPS。スマホは左半分を��ラッグして移動、右半分を��ラッグして視点操作。指を倒している間は動き続け、FIREで射撃します。1人用は19体＋最後の大型ボスを倒せばクリア。オンラインは先に20HITで勝利。時間制限はありません。',
    noTimeLimit: true,
    create({ canvas, controlsRoot, fireButton, mode = 'solo', onScore, onToast, onComplete, onProgress }) {
      const ctx = canvas.getContext('2d', { alpha: false });
      const keys = Object.create(null);
      const openCells = [];
      for (let y = 1; y < MAP_H - 1; y++) {
        for (let x = 1; x < MAP_W - 1; x++) if (MAP[y][x] === '0') openCells.push([x, y]);
      }

      let running = false, raf = 0, last = 0, rand = Math.random;
      let player = { x: 1.7, y: 1.7, a: .15 };
      let enemies = [];
      let score = 0, shots = 0, hits = 0, kills = 0;
      let muzzle = 0, hitFlash = 0, recoil = 0;
      let bossActive = false, bossHp = 0;
      let completed = false;
      let depth = [];
      let elapsed = 0;

      const isWall = (x, y) => {
        const ix = Math.floor(x), iy = Math.floor(y);
        return iy < 0 || ix < 0 || iy >= MAP_H || ix >= MAP_W || MAP[iy][ix] === '1';
      };

      function randomOpenCell(minDist = 3) {
        let x = 2.5, y = 2.5;
        for (let tries = 0; tries < 80; tries++) {
          const c = openCells[Math.floor(rand() * openCells.length)];
          x = c[0] + .25 + rand() * .5;
          y = c[1] + .25 + rand() * .5;
          if (Math.hypot(x - player.x, y - player.y) >= minDist) break;
        }
        return [x, y];
      }

      function spawnZombie({ boss = false } = {}) {
        const [x, y] = randomOpenCell(boss ? 5 : 3);
        const hp = boss ? 10 : 1;
        return {
          x, y, boss, hp, maxHp: hp,
          pulse: rand() * Math.PI * 2,
          speed: boss ? .22 : .30 + rand() * .16,
          strafe: rand() < .5 ? -1 : 1
        };
      }

      function setupEnemies() {
        bossActive = false; bossHp = 0;
        if (mode === 'online') {
          enemies = [spawnZombie(), spawnZombie(), spawnZombie(), spawnZombie()];
        } else {
          enemies = [spawnZombie(), spawnZombie()];
        }
      }

      function lineOfSight(tx, ty) {
        const dx = tx - player.x, dy = ty - player.y;
        const dist = Math.hypot(dx, dy), steps = Math.ceil(dist / .055);
        for (let i = 1; i < steps; i++) {
          const p = i / steps;
          if (isWall(player.x + dx * p, player.y + dy * p)) return false;
        }
        return true;
      }

      let touchMoveX = 0, touchMoveY = 0, touchLookX = 0;

      function movePlayer(dt) {
        const moveSpeed = 2.15 * dt;
        const rotSpeed = 2.05 * dt;

        let turn = 0;
        if (keys.KeyA || keys.ArrowLeft || keys.left) turn -= 1;
        if (keys.KeyD || keys.ArrowRight || keys.right) turn += 1;
        turn += touchLookX * 1.35;
        player.a = normAngle(player.a + rotSpeed * turn);

        let forward = touchMoveY;
        let strafe = touchMoveX;
        if (keys.KeyW || keys.ArrowUp || keys.forward) forward += 1;
        if (keys.KeyS || keys.ArrowDown || keys.back) forward -= 1;

        const length = Math.hypot(forward, strafe);
        if (length > 1) {
          forward /= length;
          strafe /= length;
        }

        if (Math.abs(forward) > .02 || Math.abs(strafe) > .02) {
          const vx = Math.cos(player.a) * forward + Math.cos(player.a + Math.PI / 2) * strafe;
          const vy = Math.sin(player.a) * forward + Math.sin(player.a + Math.PI / 2) * strafe;
          const nx = player.x + vx * moveSpeed;
          const ny = player.y + vy * moveSpeed;
          const r = .2;

          const sx = Math.sign(vx) || 1;
          const sy = Math.sign(vy) || 1;
          if (!isWall(nx + sx * r, player.y)) player.x = nx;
          if (!isWall(player.x, ny + sy * r)) player.y = ny;
        }
      }

      function moveEnemies(dt) {
        for (const z of enemies) {
          const dx = player.x - z.x, dy = player.y - z.y;
          const dist = Math.hypot(dx, dy);
          if (dist < .75 || !lineOfSight(z.x, z.y)) continue;
          const a = Math.atan2(dy, dx);
          const nx = z.x + Math.cos(a) * z.speed * dt;
          const ny = z.y + Math.sin(a) * z.speed * dt;
          if (!isWall(nx, z.y)) z.x = nx;
          if (!isWall(z.x, ny)) z.y = ny;
        }
      }

      function complete(detail) {
        if (completed) return;
        completed = true;
        running = false;
        cancelAnimationFrame(raf);
        onComplete?.({ ...detail, score, hits, shots, kills, elapsedMs: elapsed * 1000 });
      }

      function shoot() {
        if (!running || completed) return;
        shots++;
        muzzle = .085;
        recoil = .055;
        let best = null;
        for (let i = 0; i < enemies.length; i++) {
          const z = enemies[i];
          const dx = z.x - player.x, dy = z.y - player.y;
          const dist = Math.hypot(dx, dy);
          const diff = Math.abs(normAngle(Math.atan2(dy, dx) - player.a));
          const radius = z.boss ? .72 : .34;
          const threshold = Math.atan2(radius, Math.max(.4, dist)) + .022;
          if (diff <= threshold && lineOfSight(z.x, z.y) && (!best || diff < best.diff)) best = { i, dist, diff };
        }
        if (!best) {
          onToast?.('MISS');
          return;
        }

        const z = enemies[best.i];
        hits++;
        hitFlash = .11;

        if (mode === 'online') {
          score = hits;
          onScore?.(score);
          onProgress?.({ hits, target: 20 });
          onToast?.(`HIT ${hits}/20`);
          enemies[best.i] = spawnZombie();
          if (hits >= 20) complete({ type: 'online-hit-goal', hits: 20 });
          return;
        }

        z.hp--;
        if (z.boss) {
          bossHp = z.hp;
          onToast?.(`BOSS HP ${Math.max(0, bossHp)}/${z.maxHp}`);
          onProgress?.({ kills, target: 20, boss: true, bossHp, bossMaxHp: z.maxHp });
          if (z.hp > 0) return;
        }

        kills++;
        score = kills;
        onScore?.(score);

        if (z.boss) {
          onToast?.('BOSS DOWN!');
          onProgress?.({ kills: 20, target: 20, boss: true, bossHp: 0, bossMaxHp: z.maxHp });
          complete({ type: 'solo-clear', kills: 20, bossDefeated: true });
          return;
        }

        onToast?.(`ZOMBIE ${kills}/20`);
        if (kills >= 19 && !bossActive) {
          bossActive = true;
          const boss = spawnZombie({ boss: true });
          bossHp = boss.hp;
          enemies = [boss];
          onToast?.('BOSS ZOMBIE!');
          onProgress?.({ kills, target: 20, boss: true, bossHp, bossMaxHp: boss.maxHp });
        } else {
          enemies[best.i] = spawnZombie();
          onProgress?.({ kills, target: 20, boss: false });
        }
      }

      function renderBackrooms() {
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = '#d8cf88'; ctx.fillRect(0, 0, w, h * .52);
        ctx.fillStyle = '#8a8060'; ctx.fillRect(0, h * .52, w, h * .48);

        // fluorescent ceiling strips
        const glow = ctx.createLinearGradient(0, 0, 0, h * .22);
        glow.addColorStop(0, 'rgba(255,255,220,.32)'); glow.addColorStop(1, 'rgba(255,255,220,0)');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h * .28);
        for (let i = -1; i < 8; i++) {
          const x = ((i * 190 - player.a * 120) % (w + 190)) - 60;
          ctx.fillStyle = 'rgba(255,255,235,.76)'; ctx.fillRect(x, 24, 92, 7);
          ctx.fillStyle = 'rgba(255,255,210,.10)'; ctx.fillRect(x - 14, 10, 120, 36);
        }

        const rays = 260, strip = w / rays;
        depth = new Array(rays);
        for (let i = 0; i < rays; i++) {
          const rayA = player.a - FOV / 2 + (i / rays) * FOV;
          const ca = Math.cos(rayA), sa = Math.sin(rayA);
          let d = .02, sideS�����_���z��