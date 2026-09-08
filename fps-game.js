(() => {
  'use strict';

  const MAP = [
    '111111111111',
    '100000000001',
    '101110011101',
    '100010000001',
    '100010111001',
    '100000100001',
    '101100100101',
    '100000000001',
    '101011110101',
    '100000000001',
    '111111111111'
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
    title: 'FPS ARENA',
    instructions: 'W/Sで前後、A/Dで旋回。中央の照準を敵に合わせてSpaceまたは画面タップで射撃。20秒で高得点を狙います。',
    create({ canvas, controlsRoot, onScore, onToast }) {
      const ctx = canvas.getContext('2d', { alpha: false });
      const keys = Object.create(null);
      let running = false, raf = 0, last = 0, rand = Math.random;
      let player = { x: 1.65, y: 1.65, a: 0.2 };
      let targets = [];
      let score = 0, shots = 0, hits = 0;
      let muzzle = 0, hitFlash = 0;
      let depth = [];

      const isWall = (x, y) => {
        const ix = Math.floor(x), iy = Math.floor(y);
        return iy < 0 || ix < 0 || iy >= MAP_H || ix >= MAP_W || MAP[iy][ix] === '1';
      };

      const openCells = [];
      for (let y = 1; y < MAP_H - 1; y++) for (let x = 1; x < MAP_W - 1; x++) if (MAP[y][x] === '0') openCells.push([x, y]);

      function spawnTarget(index) {
        let x = 2.5, y = 2.5;
        for (let tries = 0; tries < 30; tries++) {
          const c = openCells[Math.floor(rand() * openCells.length)];
          x = c[0] + .22 + rand() * .56;
          y = c[1] + .22 + rand() * .56;
          if (Math.hypot(x - player.x, y - player.y) > 2.3) break;
        }
        targets[index] = { x, y, pulse: rand() * Math.PI * 2 };
      }

      function lineOfSight(tx, ty) {
        const dx = tx - player.x, dy = ty - player.y;
        const dist = Math.hypot(dx, dy), steps = Math.ceil(dist / .05);
        for (let i = 1; i < steps; i++) {
          const p = i / steps;
          if (isWall(player.x + dx * p, player.y + dy * p)) return false;
        }
        return true;
      }

      function move(dt) {
        const moveSpeed = 2.2 * dt;
        const rotSpeed = 2.0 * dt;
        if (keys.KeyA || keys.ArrowLeft || keys.left) player.a -= rotSpeed;
        if (keys.KeyD || keys.ArrowRight || keys.right) player.a += rotSpeed;
        let dir = 0;
        if (keys.KeyW || keys.ArrowUp || keys.forward) dir += 1;
        if (keys.KeyS || keys.ArrowDown || keys.back) dir -= 1;
        if (dir) {
          const nx = player.x + Math.cos(player.a) * moveSpeed * dir;
          const ny = player.y + Math.sin(player.a) * moveSpeed * dir;
          const r = .18;
          if (!isWall(nx + Math.cos(player.a) * r * dir, player.y)) player.x = nx;
          if (!isWall(player.x, ny + Math.sin(player.a) * r * dir)) player.y = ny;
        }
        player.a = normAngle(player.a);
      }

      function shoot() {
        if (!running) return;
        shots++;
        muzzle = .09;
        let best = null;
        for (let i = 0; i < targets.length; i++) {
          const t = targets[i];
          const dx = t.x - player.x, dy = t.y - player.y;
          const dist = Math.hypot(dx, dy);
          const diff = Math.abs(normAngle(Math.atan2(dy, dx) - player.a));
          const threshold = Math.atan2(.34, Math.max(.4, dist)) + .018;
          if (diff <= threshold && lineOfSight(t.x, t.y) && (!best || diff < best.diff)) best = { i, dist, diff };
        }
        if (best) {
          hits++;
          const gain = 100 + Math.max(0, Math.round(90 - best.dist * 8));
          score += gain;
          onScore(score);
          onToast(`HIT +${gain}`);
          hitFlash = .12;
          spawnTarget(best.i);
        } else {
          score = Math.max(0, score - 10);
          onScore(score);
          onToast('MISS -10');
        }
      }

      function render() {
        const w = canvas.width, h = canvas.height;
        const sky = ctx.createLinearGradient(0, 0, 0, h * .52);
        sky.addColorStop(0, '#071426'); sky.addColorStop(1, '#142a42');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h * .52);
        const floor = ctx.createLinearGradient(0, h * .5, 0, h);
        floor.addColorStop(0, '#1a2130'); floor.addColorStop(1, '#05070d');
        ctx.fillStyle = floor; ctx.fillRect(0, h * .5, w, h * .5);

        const rays = 240, strip = w / rays;
        depth = new Array(rays);
        for (let i = 0; i < rays; i++) {
          const rayA = player.a - FOV / 2 + (i / rays) * FOV;
          const ca = Math.cos(rayA), sa = Math.sin(rayA);
          let d = .02, sideShade = 1;
          let px = player.x, py = player.y;
          while (d < 16) {
            px = player.x + ca * d; py = player.y + sa * d;
            if (isWall(px, py)) {
              const fx = px - Math.floor(px), fy = py - Math.floor(py);
              sideShade = Math.min(fx, 1 - fx) < Math.min(fy, 1 - fy) ? .78 : 1;
              break;
            }
            d += .035;
          }
          const corrected = Math.max(.06, d * Math.cos(rayA - player.a));
          depth[i] = corrected;
          const wallH = Math.min(h * 1.8, h / corrected * .78);
          const y = h / 2 - wallH / 2;
          const light = clamp((1 - corrected / 15) * sideShade, .18, 1);
          const r = Math.round(45 * light), g = Math.round(125 * light), b = Math.round(170 * light);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(i * strip, y, strip + 1, wallH);
          ctx.fillStyle = `rgba(255,255,255,${.035 * light})`;
          ctx.fillRect(i * strip, y, 1, wallH);
        }

        const visible = [];
        for (const t of targets) {
          const dx = t.x - player.x, dy = t.y - player.y;
          const dist = Math.hypot(dx, dy);
          const diff = normAngle(Math.atan2(dy, dx) - player.a);
          if (Math.abs(diff) > FOV * .62 || !lineOfSight(t.x, t.y)) continue;
          const sx = (.5 + diff / FOV) * w;
          const rayIndex = clamp(Math.floor(sx / w * depth.length), 0, depth.length - 1);
          if (depth[rayIndex] && dist > depth[rayIndex] + .2) continue;
          visible.push({ t, dist, diff, sx });
        }
        visible.sort((a, b) => b.dist - a.dist);
        for (const v of visible) {
          const size = clamp(h * .66 / v.dist, 30, 180);
          const bob = Math.sin(performance.now() * .005 + v.t.pulse) * 4;
          const x = v.sx, y = h * .5 - size * .43 + bob;
          ctx.save();
          ctx.translate(x, y);
          ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(255,65,95,.55)';
          ctx.fillStyle = '#ff456b';
          ctx.beginPath(); ctx.arc(0, -size * .2, size * .18, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(-size * .16, -size * .02, size * .32, size * .4);
          ctx.fillStyle = '#ffe3e8';
          ctx.fillRect(-size * .07, -size * .24, size * .045, size * .045);
          ctx.fillRect(size * .025, -size * .24, size * .045, size * .045);
          ctx.restore();
        }

        ctx.fillStyle = 'rgba(9,14,24,.92)';
        ctx.beginPath(); ctx.moveTo(w * .42, h); ctx.lineTo(w * .47, h * .79); ctx.lineTo(w * .53, h * .79); ctx.lineTo(w * .58, h); ctx.fill();
        if (muzzle > 0) {
          ctx.fillStyle = `rgba(255,235,120,${clamp(muzzle * 9, 0, 1)})`;
          ctx.beginPath(); ctx.arc(w / 2, h * .78, 26 + muzzle * 90, 0, Math.PI * 2); ctx.fill();
        }
        const cx = w / 2, cy = h / 2;
        ctx.strokeStyle = hitFlash > 0 ? '#86efac' : '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx - 18, cy); ctx.lineTo(cx - 5, cy); ctx.moveTo(cx + 5, cy); ctx.lineTo(cx + 18, cy); ctx.moveTo(cx, cy - 18); ctx.lineTo(cx, cy - 5); ctx.moveTo(cx, cy + 5); ctx.lineTo(cx, cy + 18); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.stroke();

        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(12, 12, 190, 48);
        ctx.fillStyle = '#fff'; ctx.font = '700 16px system-ui'; ctx.fillText(`HIT ${hits} / SHOT ${shots}`, 24, 41);
      }

      function loop(now) {
        if (!running) return;
        const dt = Math.min(.04, (now - last) / 1000 || .016);
        last = now;
        move(dt);
        muzzle = Math.max(0, muzzle - dt);
        hitFlash = Math.max(0, hitFlash - dt);
        render();
        raf = requestAnimationFrame(loop);
      }

      const keyDown = e => {
        if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
        keys[e.code] = true;
        if (e.code === 'Space' && !e.repeat) shoot();
      };
      const keyUp = e => { keys[e.code] = false; };
      const canvasDown = e => { if (running) { e.preventDefault(); shoot(); } };
      window.addEventListener('keydown', keyDown, { passive: false });
      window.addEventListener('keyup', keyUp);
      canvas.addEventListener('pointerdown', canvasDown, { passive: false });

      const controlHandlers = [];
      controlsRoot?.querySelectorAll('[data-fps]').forEach(btn => {
        const action = btn.dataset.fps;
        const down = e => { e.preventDefault(); if (action === 'shoot') shoot(); else keys[action] = true; };
        const up = e => { e.preventDefault(); if (action !== 'shoot') keys[action] = false; };
        btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('pointerleave', up);
        controlHandlers.push([btn, down, up]);
      });

      function drawIdle() {
        ctx.fillStyle = '#06101d'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.fillStyle = '#7dd3fc'; ctx.font = '900 46px system-ui'; ctx.textAlign = 'center'; ctx.fillText('FPS ARENA', canvas.width/2, canvas.height/2 - 10);
        ctx.fillStyle = '#aeb9d4'; ctx.font = '700 18px system-ui'; ctx.fillText('MOVE • AIM • SHOOT • 20 SECONDS', canvas.width/2, canvas.height/2 + 34); ctx.textAlign = 'start';
      }
      drawIdle();

      return {
        start(seed) {
          rand = rng32(seed || 1);
          player = { x: 1.65, y: 1.65, a: .18 };
          score = shots = hits = 0; onScore(0);
          targets = new Array(4); for (let i = 0; i < targets.length; i++) spawnTarget(i);
          running = true; last = performance.now();
          cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
        },
        stop() {
          running = false; cancelAnimationFrame(raf); render();
          return { hits, shots };
        },
        destroy() {
          running = false; cancelAnimationFrame(raf);
          window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); canvas.removeEventListener('pointerdown', canvasDown);
          for (const [btn, down, up] of controlHandlers) { btn.removeEventListener('pointerdown', down); btn.removeEventListener('pointerup', up); btn.removeEventListener('pointercancel', up); btn.removeEventListener('pointerleave', up); }
        }
      };
    }
  };
})();
