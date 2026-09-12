// The same deterministic level and movement rules as the original Paper2D game.
export const ZONE_WIDTH = 8400;
export const FINISH = 41480;
export const ZONES = ['ミントの草原', 'こはくの森', '空の庭', '夕暮れの尾根', '星明かりの門'];
export const W = 30, H = 54;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function layout() {
  const platforms = [], coins = [], enemies = [], spikes = [], checkpoints = [];
  for (let zone = 0; zone < 5; zone++) {
    const base = zone * ZONE_WIDTH;
    checkpoints.push({x: base + 140, z: 0});
    for (let j = 0; j < 12; j++) {
      const x = base + j * 700;
      const gap = [0, 11].includes(j) ? 0 : 95 + (j % 3) * 20;
      const top = [0, 1, 10, 11].includes(j) ? 0 : [0, 40, 80, 40][j % 4];
      const width = 700 - gap;
      platforms.push({x, z: top - 220, w: width, h: 220, zone, floating: false});
      for (let k = 0; k < 3; k++) coins.push({x: x + 180 + k * 95, z: top + 80 + (k === 1 ? 25 : 0), taken: false, zone});
      if ([2, 5, 8, 10].includes(j)) enemies.push({x: x + 190, z: top, left: x + 110, right: x + width - 250, direction: 1, speed: 42 + zone * 7, alive: true, zone});
      if ([4, 7, 9].includes(j)) spikes.push({x: x + 270, z: top, w: 48, h: 26, zone});
      if ([3, 6, 9].includes(j)) {
        platforms.push({x: x + 110, z: top + 100, w: 170, h: 24, zone, floating: true});
        coins.push({x: x + 195, z: top + 195, taken: false, zone});
      }
    }
  }
  return {platforms, coins, enemies, spikes, checkpoints};
}

export class Game {
  constructor() {
    Object.assign(this, layout());
    Object.assign(this, {x: 140, z: 0, vx: 0, vz: 0, health: 3, score: 0, deaths: 0,
      checkpoint: 0, time: 300, elapsed: 0, invulnerable: 0, grounded: true,
      coyote: .12, buffer: 0, state: 'title', banner: '', bannerTime: 0,
      facing: 1, jumpWasDown: false, events: []});
  }
  start() { this.state = 'playing'; this.banner = '01 / ミントの草原'; this.bannerTime = 3; }
  damage(fall = false) {
    if (this.invulnerable > 0 && !fall) return;
    this.health--; this.events.push('hurt'); this.invulnerable = 1.8;
    if (fall || this.health <= 0) {
      this.deaths++;
      Object.assign(this, this.checkpoints[this.checkpoint], {vx: 0, vz: 0, grounded: true});
      if (this.health <= 0) {
        this.health = 3; this.time = Math.max(0, this.time - 10);
        this.banner = '中間地点からもう一度！ 残り時間 −10秒'; this.bannerTime = 2;
      }
    } else { this.vz = 280; this.vx = -this.facing * 150; }
  }
  step(dt, {move = 0, jump = false, sprint = false} = {}) {
    this.events = [];
    if (this.state !== 'playing') return;
    dt = clamp(dt, 0, 1 / 30);
    this.elapsed += dt; this.time = Math.max(0, this.time - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.bannerTime = Math.max(0, this.bannerTime - dt);
    if (this.time <= 0) { this.state = 'timeout'; this.events.push('hurt'); return; }
    this.coyote = this.grounded ? .12 : Math.max(0, this.coyote - dt);
    this.buffer = jump && !this.jumpWasDown ? .14 : Math.max(0, this.buffer - dt);
    if (!jump && this.jumpWasDown && this.vz > 280) this.vz = 280;
    this.jumpWasDown = jump;
    if (this.buffer > 0 && this.coyote > 0) {
      this.vz = 650; this.buffer = 0; this.coyote = 0; this.grounded = false; this.events.push('jump');
    }
    const target = clamp(move, -1, 1) * (sprint ? 355 : 245);
    const acc = this.grounded ? 1900 : 1350;
    this.vx += clamp(target - this.vx, -acc * dt, acc * dt);
    if (move) this.facing = move > 0 ? 1 : -1;
    const oldX = this.x, oldZ = this.z;
    let nx = clamp(this.x + this.vx * dt, 18, FINISH + 120);
    const nearby = this.platforms.filter(p => Math.abs(p.x - this.x) < 1200);
    for (const p of nearby) {
      if (p.floating) continue;
      if (this.z + H > p.z + 2 && this.z < p.z + p.h - 1) {
        if (oldX + W / 2 <= p.x && nx + W / 2 > p.x) { nx = p.x - W / 2; this.vx = 0; }
        else if (oldX - W / 2 >= p.x + p.w && nx - W / 2 < p.x + p.w) { nx = p.x + p.w + W / 2; this.vx = 0; }
      }
    }
    this.x = nx; this.vz = Math.max(-950, this.vz - 1500 * dt);
    let nz = this.z + this.vz * dt; this.grounded = false;
    for (const p of nearby) {
      const top = p.z + p.h;
      if (this.x + W / 2 > p.x && this.x - W / 2 < p.x + p.w && this.vz <= 0 && oldZ >= top - .5 && nz <= top) {
        nz = top; this.vz = 0; this.grounded = true;
      }
    }
    this.z = nz;
    if (this.z < -340) { this.damage(true); return; }
    for (const c of this.coins) {
      if (!c.taken && Math.abs(c.x - this.x) < 34 && Math.abs(c.z - (this.z + 27)) < 45) {
        c.taken = true; this.score++; this.events.push('coin');
      }
    }
    for (const e of this.enemies) {
      if (!e.alive || Math.abs(e.x - this.x) > 1600) continue;
      e.x += e.direction * e.speed * dt;
      if (e.x > e.right) { e.x = e.right; e.direction = -1; }
      if (e.x < e.left) { e.x = e.left; e.direction = 1; }
      if (Math.abs(e.x - this.x) < 34 && this.z < e.z + 34 && this.z + H > e.z) {
        if (this.vz < 0 && oldZ >= e.z + 26) { e.alive = false; this.vz = 440; this.score += 3; this.events.push('stomp'); }
        else this.damage();
      }
    }
    for (const s of this.spikes) {
      if (this.x + 12 > s.x && this.x - 12 < s.x + s.w && this.z < s.z + s.h - 4 && this.z + H > s.z) this.damage();
    }
    const zone = Math.min(4, Math.floor(this.x / ZONE_WIDTH));
    if (zone > this.checkpoint && this.grounded) {
      this.checkpoint = zone; this.health = 3;
      this.banner = `${String(zone + 1).padStart(2, '0')} / ${ZONES[zone]} — 中間地点を記録`; this.bannerTime = 4; this.events.push('checkpoint');
    }
    if (this.x >= FINISH) { this.state = 'won'; this.events.push('win'); }
  }
}
