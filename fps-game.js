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
    instructions: '黄色い迷路を探索するゾンビFPS。画面をドラッグして視点を動かし、FIREで射撃。1人用は19体＋最後の大型ボスを倒せばクリア。オンラインは先に20HITで勝利。時間制限はありません。',
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
          speed: boss ? .22 : .30 + rand() * .16
        };
      }

      function setupEnemies() {
        bossActive = false; bossHp = 0;
        if (mode === 'online') enemies = [spawnZombie(), spawnZombie(), spawnZombie(), spawnZombie()];
        else enemies = [spawnZombie(), spawnZombie()];
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

      function movePlayer(dt) {
        const moveSpeed = 2.15 * dt;
        const rotSpeed = 2.05 * dt;
        if (keys.KeyA || keys.ArrowLeft || keys.left) player.a -= rotSpeed;
        if (keys.KeyD || keys.ArrowRight || keys.right) player.a += rotSpeed;
        let dir = 0;
        if (keys.KeyW || keys.ArrowUp || keys.forward) dir += 1;
        if (keys.KeyS || keys.ArrowDown || keys.back) dir -= 1;
        if (dir) {
          const nx = player.x + Math.cos(player.a) * moveSpeed * dir;
          const ny = player.y + Math.sin(player.a) * moveSpeed * dir;
          const r = .2;
          if (!isWall(nx + Math.cos(player.a) * r * dir, player.y)) player.x = nx;
          if (!isWall(player.x, ny + Math.sin(player.a) * r * dir)) player.y = ny;
        }
        player.a = normAngle(player.a);
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
        if (!best) { onToast?.('MISS'); return; }

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
          let d = .02, sideShade = 1, hitX = 0, hitY = 0;
          while (d < 20) {
            hitX = player.x + ca * d; hitY = player.y + sa * d;
            if (isWall(hitX, hitY)) {
              const fx = hitX - Math.floor(hitX), fy = hitY - Math.floor(hitY);
              sideShade = Math.min(fx, 1 - fx) < Math.min(fy, 1 - fy) ? .82 : 1;
              break;
            }
            d += .035;
          }
          const corrected = Math.max(.06, d * Math.cos(rayA - player.a));
          depth[i] = corrected;
          const wallH = Math.min(h * 2, h / corrected * .93);
          const y = h / 2 - wallH / 2;
          const light = clamp((1 - corrected / 19) * sideShade, .22, 1);
          const grain = (Math.sin((hitX + hitY) * 13 + i * .18) + 1) * .045;
          const r = Math.round(190 * light + 35 + grain * 50);
          const g = Math.round(178 * light + 30 + grain * 40);
          const b = Math.round(90 * light + 28);
          ctx.fillStyle = `rgb(${clamp(r,0,255)},${clamp(g,0,255)},${clamp(b,0,255)})`;
          ctx.fillRect(i * strip, y, strip + 1, wallH);
          if (i % 22 === 0) {
            ctx.fillStyle = `rgba(92,78,35,${.10 * light})`;
            ctx.fillRect(i * strip, y, Math.max(1, strip), wallH);
          }
          const base = y + wallH;
          ctx.fillStyle = `rgba(70,62,45,${.22 * light})`;
          ctx.fillRect(i * strip, base - 4, strip + 1, 4);
        }
        for (let y = h * .58; y < h; y += 24) {
          const alpha = ((y - h * .58) / (h * .42)) * .10;
          ctx.fillStyle = `rgba(35,30,22,${alpha})`; ctx.fillRect(0, y, w, 2);
        }
      }

      function drawZombie(v) {
        const { z, dist, sx } = v;
        const h = canvas.height;
        const scale = z.boss ? 1.8 : 1;
        const size = clamp(h * .72 / dist * scale, z.boss ? 80 : 34, z.boss ? 300 : 190);
        const bob = Math.sin(performance.now() * .004 + z.pulse) * (z.boss ? 2 : 5);
        const x = sx, y = h * .50 - size * .34 + bob;
        ctx.save();
        ctx.translate(x, y);
        ctx.shadowBlur = z.boss ? 26 : 12;
        ctx.shadowColor = z.boss ? 'rgba(160,40,20,.45)' : 'rgba(80,120,55,.32)';
        ctx.fillStyle = z.boss ? '#3e342e' : '#2f3334';
        ctx.fillRect(-size * .18, size * .24, size * .13, size * .30);
        ctx.fillRect(size * .05, size * .24, size * .13, size * .30);
        ctx.fillStyle = z.boss ? '#734126' : '#5b5a43';
        ctx.beginPath();
        if (z.boss) ctx.ellipse(0, size * .10, size * .34, size * .34, 0, 0, Math.PI * 2);
        else ctx.roundRect(-size * .20, -size * .02, size * .40, size * .42, size * .06);
        ctx.fill();
        ctx.strokeStyle = z.boss ? '#6c4934' : '#6d7b58';
        ctx.lineWidth = Math.max(5, size * .10); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-size * .18, size * .04); ctx.lineTo(-size * .38, size * .24); ctx.moveTo(size * .18, size * .04); ctx.lineTo(size * .38, size * .24); ctx.stroke();
        ctx.fillStyle = z.boss ? '#8d7b54' : '#82936a';
        ctx.beginPath(); ctx.arc(0, -size * .17, size * (z.boss ? .18 : .16), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f1e2bd';
        ctx.fillRect(-size * .075, -size * .20, size * .04, size * .035);
        ctx.fillRect(size * .035, -size * .20, size * .04, size * .035);
        ctx.fillStyle = '#2b1814'; ctx.fillRect(-size * .07, -size * .12, size * .14, size * .035);
        if (z.boss) {
          ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(-size * .31, -size * .47, size * .62, size * .09);
          ctx.fillStyle = '#ef4444'; ctx.fillRect(-size * .30, -size * .46, size * .60 * clamp(z.hp / z.maxHp, 0, 1), size * .065);
          ctx.fillStyle = '#fff'; ctx.font = `900 ${Math.max(12, size * .07)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText('BOSS', 0, -size * .53); ctx.textAlign = 'start';
        }
        ctx.restore();
      }

      function render() {
        const w = canvas.width, h = canvas.height;
        renderBackrooms();
        const visible = [];
        for (const z of enemies) {
          const dx = z.x - player.x, dy = z.y - player.y;
          const dist = Math.hypot(dx, dy);
          const diff = normAngle(Math.atan2(dy, dx) - player.a);
          if (Math.abs(diff) > FOV * .64 || !lineOfSight(z.x, z.y)) continue;
          const sx = (.5 + diff / FOV) * w;
          const rayIndex = clamp(Math.floor(sx / w * depth.length), 0, depth.length - 1);
          if (depth[rayIndex] && dist > depth[rayIndex] + .25) continue;
          visible.push({ z, dist, sx });
        }
        visible.sort((a, b) => b.dist - a.dist);
        for (const v of visible) drawZombie(v);

        ctx.fillStyle = 'rgba(27,25,22,.95)';
        ctx.beginPath(); ctx.moveTo(w * .41, h); ctx.lineTo(w * .465, h * .78 + recoil * h); ctx.lineTo(w * .535, h * .78 + recoil * h); ctx.lineTo(w * .59, h); ctx.fill();
        ctx.fillStyle = '#44403c'; ctx.fillRect(w * .482, h * .72 + recoil * h, w * .036, h * .13);
        if (muzzle > 0) {
          ctx.fillStyle = `rgba(255,225,105,${clamp(muzzle * 10, 0, 1)})`;
          ctx.beginPath(); ctx.arc(w / 2, h * .70, 18 + muzzle * 120, 0, Math.PI * 2); ctx.fill();
        }

        const cx = w / 2, cy = h / 2;
        ctx.strokeStyle = hitFlash > 0 ? '#86efac' : '#fff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - 18, cy); ctx.lineTo(cx - 5, cy); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 18, cy); ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy - 5); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 18); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.stroke();

        ctx.fillStyle = 'rgba(18,16,12,.66)'; ctx.fillRect(12, 12, mode === 'online' ? 220 : 260, 66);
        ctx.fillStyle = '#fff'; ctx.font = '900 17px system-ui';
        if (mode === 'online') ctx.fillText(`HIT ${hits} / 20`, 24, 38);
        else ctx.fillText(`ZOMBIE ${kills} / 20`, 24, 38);
        ctx.fillStyle = '#d5cba0'; ctx.font = '700 13px system-ui'; ctx.fillText(`SHOT ${shots}  •  ${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`, 24, 61);
      }

      function loop(now) {
        if (!running) return;
        const dt = Math.min(.04, (now - last) / 1000 || .016);
        last = now; elapsed += dt;
        movePlayer(dt); moveEnemies(dt);
        muzzle = Math.max(0, muzzle - dt);
        hitFlash = Math.max(0, hitFlash - dt);
        recoil = Math.max(0, recoil - dt * .75);
        render();
        raf = requestAnimationFrame(loop);
      }

      const keyDown = e => {
        if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
        keys[e.code] = true;
        if (e.code === 'Space' && !e.repeat) shoot();
      };
      const keyUp = e => { keys[e.code] = false; };
      window.addEventListener('keydown', keyDown, { passive: false });
      window.addEventListener('keyup', keyUp);

      let pointerId = null, pointerLastX = 0, pointerLastY = 0, pointerLeft = false;
      const pointerDown = e => {
        if (!running || pointerId !== null) return;
        pointerId = e.pointerId; pointerLastX = e.clientX; pointerLastY = e.clientY;
        const rect = canvas.getBoundingClientRect(); pointerLeft = e.clientX < rect.left + rect.width * .5;
        try { canvas.setPointerCapture(pointerId); } catch (_) {}
        e.preventDefault();
      };
      const pointerMove = e => {
        if (!running || e.pointerId !== pointerId) return;
        const dx = e.clientX - pointerLastX, dy = e.clientY - pointerLastY;
        pointerLastX = e.clientX; pointerLastY = e.clientY;
        player.a = normAngle(player.a + dx * .0062);
        if (pointerLeft) {
          const dir = clamp(-dy / 30, -1, 1);
          const step = .065 * dir;
          const nx = player.x + Math.cos(player.a) * step;
          const ny = player.y + Math.sin(player.a) * step;
          if (!isWall(nx, player.y)) player.x = nx;
          if (!isWall(player.x, ny)) player.y = ny;
        }
        e.preventDefault();
      };
      const pointerUp = e => { if (e.pointerId !== pointerId) return; pointerId = null; e.preventDefault(); };
      canvas.addEventListener('pointerdown', pointerDown, { passive: false });
      canvas.addEventListener('pointermove', pointerMove, { passive: false });
      canvas.addEventListener('pointerup', pointerUp, { passive: false });
      canvas.addEventListener('pointercancel', pointerUp, { passive: false });

      const controlHandlers = [];
      controlsRoot?.querySelectorAll('[data-fps]').forEach(btn => {
        const action = btn.dataset.fps;
        const down = e => { e.preventDefault(); if (action === 'shoot') shoot(); else keys[action] = true; };
        const up = e => { e.preventDefault(); if (action !== 'shoot') keys[action] = false; };
        btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
        controlHandlers.push([btn, down, up]);
      });
      const fireDown = e => { e.preventDefault(); shoot(); };
      fireButton?.addEventListener('pointerdown', fireDown, { passive: false });

      function drawIdle() {
        ctx.fillStyle = '#b8ad6b'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#5e5738'; ctx.font = '900 48px system-ui'; ctx.textAlign = 'center'; ctx.fillText('LIMINAL ZOMBIE FPS', canvas.width / 2, canvas.height / 2 - 12);
        ctx.fillStyle = '#423d2c'; ctx.font = '700 18px system-ui'; ctx.fillText('NO TIME LIMIT • SURVIVE THE MAZE', canvas.width / 2, canvas.height / 2 + 34); ctx.textAlign = 'start';
      }
      drawIdle();

      return {
        start(seed) {
          rand = rng32(seed || 1);
          player = { x: 1.7, y: 1.7, a: .15 };
          score = shots = hits = kills = 0;
          elapsed = 0; completed = false; bossActive = false; bossHp = 0;
          onScore?.(0); setupEnemies();
          onProgress?.(mode === 'online' ? { hits: 0, target: 20 } : { kills: 0, target: 20, boss: false });
          running = true; last = performance.now();
          cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
        },
        shoot,
        stop() {
          running = false; cancelAnimationFrame(raf); render();
          return { hits, shots, kills, boss: bossActive, bossHp, elapsedMs: elapsed * 1000 };
        },
        destroy() {
          running = false; cancelAnimationFrame(raf);
          window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp);
          canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', pointerUp);
          fireButton?.removeEventListener('pointerdown', fireDown);
          for (const [btn, down, up] of controlHandlers) {
            btn.removeEventListener('pointerdown', down); btn.removeEventListener('pointerup', up); btn.removeEventListener('pointercancel', up); btn.removeEventListener('pointerleave', up);
          }
        }
      };
    }
  };
})();
