import assert from 'node:assert/strict';
import { Game, LEVELS, WORLDS, W, H, makeLevel } from '../lantern-duo/engine.mjs';

const DT = 1 / 120;
let passed = 0;
function test(name, check) {
  check();
  passed++;
  console.log('PASS', name);
}
function advance(game, seconds, controls = [{}, {}], dt = DT) {
  for (let frame = 0; frame < Math.ceil(seconds / dt); frame++) {
    game.step(dt, typeof controls === 'function' ? controls(game) : controls);
  }
}
function place(player, x, z = 0, extra = {}) {
  Object.assign(player, { x, z, vx: 0, vz: 0, grounded: true, bubble: false,
    coyote: .12, buffer: 0, wasJump: false, ride: null, ...extra });
}

test('12 distinct stages span four worlds with reachable checkpoint floors', () => {
  assert.equal(LEVELS.length, 12);
  assert.equal(WORLDS.length, 4);
  assert.equal(new Set(LEVELS.map(level => level.name)).size, 12);
  for (const level of LEVELS) {
    const map = makeLevel(level.id);
    assert.equal(level.world, Math.floor(level.id / 3));
    assert.equal(map.gates.length, 2);
    assert.equal(map.stars.length, 3);
    assert.equal(map.enemies.filter(enemy => enemy.kind === 'boss').length, level.id % 3 === 2 ? 1 : 0);
    for (const checkpoint of map.checkpoints) {
      assert(map.platforms.some(platform => platform.kind === 'ground' &&
        checkpoint.x >= platform.x && checkpoint.x + 65 < platform.x + platform.w &&
        checkpoint.z === platform.z), `Stage ${level.id + 1} checkpoint must support both players`);
    }
  }
  const first = makeLevel(0), second = makeLevel(0);
  first.coins[0].taken = true;
  assert.equal(second.coins[0].taken, false, 'Fresh runs must not share collectible state');
});

test('jump height responds to release, lands, and cannot repeat from a held button', () => {
  const peaks = [];
  for (const holdFrames of [6, 300]) {
    const game = new Game({ mode: 'coop' });
    let peak = 0, jumps = 0;
    for (let frame = 0; frame < 300; frame++) {
      game.step(DT, [{ jump: frame < holdFrames }, {}]);
      peak = Math.max(peak, game.players[0].z);
      jumps += game.events.filter(event => event === 'jump').length;
    }
    assert.equal(jumps, 1);
    assert.equal(game.players[0].grounded, true);
    assert.equal(game.players[0].z, 0);
    peaks.push(peak);
  }
  assert(peaks[1] > peaks[0] + 50, `Held jump (${peaks[1]}) must exceed tap (${peaks[0]})`);
});

test('late edge jumps and a jump pressed just before landing both work', () => {
  let game = new Game({ mode: 'coop' });
  const ground = game.platforms.filter(platform => platform.kind === 'ground')[1];
  const player = game.players[0];
  place(player, ground.x + ground.w + W / 2 - 2, ground.z, { vx: 285 });
  place(game.players[1], player.x - 65, player.z);
  advance(game, .05, [{ move: 1 }, {}]);
  assert.equal(player.grounded, false);
  game.step(DT, [{ move: 1, jump: true }, {}]);
  assert(player.vz > 600, 'Coyote jump should catch a recent step off the ledge');

  game = new Game({ mode: 'coop' });
  place(game.players[0], 140, 5, { grounded: false, coyote: 0, vz: -300 });
  advance(game, 3 * DT, [{ jump: true }, {}]);
  assert(game.players[0].vz > 600, 'Buffered jump should trigger on the frame after landing');
});

test('raised ground blocks horizontal movement and floating platforms allow upward passage', () => {
  const game = new Game({ mode: 'coop' });
  const raised = game.platforms.find(platform => platform.kind === 'ground' && platform.z > 0);
  const player = game.players[0];
  place(player, raised.x - 70);
  place(game.players[1], player.x - 65);
  advance(game, .7, [{ move: 1 }, {}]);
  assert.equal(player.x, raised.x - W / 2);
  assert.equal(player.z, 0);
  advance(game, 1, [{ move: 1, jump: true }, {}]);
  assert(player.x > raised.x + 100);
  assert.equal(player.z, raised.z);

  const platform = game.platforms.find(platform => platform.kind === 'float');
  place(player, platform.x + platform.w / 2, raised.z);
  place(game.players[1], player.x - 65, raised.z);
  advance(game, 1.2, [{ jump: true }, {}]);
  assert.equal(player.z, platform.z);
  assert.equal(player.ride, platform);
});

test('coins and stars count once even when both players overlap the same pickup', () => {
  const game = new Game({ mode: 'coop' }), coin = game.coins[0];
  for (const player of game.players) place(player, coin.x, coin.z - H / 2, { grounded: false });
  game.step(DT, [{}, {}]);
  assert.equal(game.score, 1);
  assert.equal(coin.taken, true);
  game.step(DT, [{}, {}]);
  assert.equal(game.score, 1);
  const star = game.stars[0];
  for (const player of game.players) place(player, star.x, star.z - H / 2, { grounded: false });
  game.step(DT, [{}, {}]);
  assert.equal(game.starCount, 1);
  assert.equal(game.score, 11);
  game.step(DT, [{}, {}]);
  assert.equal(game.starCount, 1);
});

test('damage has a grace period and a fallen player returns in a healing bubble', () => {
  const game = new Game({ mode: 'coop' }), player = game.players[0];
  player.invulnerable = 0;
  game.damage(player);
  assert.equal(player.health, 2);
  assert(player.vz > 0);
  game.damage(player);
  assert.equal(player.health, 2);
  game.damage(player, true);
  assert.equal(player.bubble, true);
  assert.equal(game.deaths, 1);
  advance(game, 1.2);
  assert.equal(player.bubble, false);
  assert.equal(player.health, 3);
  assert(player.invulnerable > 1);
  assert(Math.abs(player.x - game.players[1].x) < 80);
});

test('both players falling restarts at the earned checkpoint and preserves pickups', () => {
  const game = new Game({ mode: 'coop' }), checkpoint = game.checkpoints[1];
  for (const player of game.players) place(player, checkpoint.x + player.id * 65, checkpoint.z);
  game.step(DT, [{}, {}]);
  assert.deepEqual(game.checkpoint, { x: checkpoint.x, z: checkpoint.z });
  const savedScore = game.score;
  for (const player of game.players) game.damage(player, true);
  advance(game, 1.1);
  assert(game.players.every(player => player.bubble));
  advance(game, .2);
  assert(game.players.every(player => !player.bubble && player.health === 3));
  assert.equal(game.players[0].x, checkpoint.x);
  assert.equal(game.players[1].x, checkpoint.x + 65);
  assert.equal(game.deaths, 2);
  assert.equal(game.score, savedScore);
});

test('distant partners bubble back and manual recall revives a downed partner', () => {
  const game = new Game({ mode: 'coop' });
  place(game.players[0], 1100);
  game.step(DT, [{}, {}]);
  assert.equal(game.players[1].bubble, true);
  advance(game, 2);
  assert.equal(game.players[1].bubble, false);
  assert(Math.abs(game.players[0].x - game.players[1].x) < 80);
  game.damage(game.players[1], true);
  game.recall();
  assert.equal(game.players[1].bubble, false);
  assert.equal(game.players[1].health, 3);
});

test('co-op gates need uninterrupted simultaneous grounded pressure and stay open', () => {
  const game = new Game({ mode: 'coop' }), gate = game.gates[0];
  const center = plate => plate.x + plate.w / 2;
  for (const player of game.players) place(player, center(gate.plates[0]));
  advance(game, 1);
  assert.equal(gate.open, false);
  assert.equal(gate.charge, 0);
  place(game.players[1], center(gate.plates[1]), 10, { grounded: false, vz: 150 });
  advance(game, .1);
  assert.equal(gate.charge, 0, 'Airborne players must not press plates');
  place(game.players[1], center(gate.plates[1]));
  advance(game, .4);
  assert(gate.charge > .5 && gate.charge < 1);
  place(game.players[1], gate.plates[1].x - 25);
  game.step(DT, [{}, {}]);
  assert.equal(gate.charge, 0, 'Leaving a plate must reset incomplete progress');
  place(game.players[1], center(gate.plates[1]));
  advance(game, .7);
  assert.equal(gate.open, true);
  advance(game, 1, [{ move: 1 }, { move: 1 }]);
  assert.equal(gate.open, true);
  assert(game.players[1].x > gate.x + gate.w);
});

test('solo partner chooses the other plate whichever plate the human selects', () => {
  for (const slot of [0, 1]) for (const offset of [-180, 0]) {
    const game = new Game(), gate = game.gates[0];
    place(game.players[0], gate.plates[slot].x + 35);
    place(game.players[1], game.players[0].x + offset);
    advance(game, 3);
    assert.equal(gate.open, true, `Human plate ${slot + 1}, CPU offset ${offset}`);
  }
});

test('closed gates stop movement before the player enters the barrier', () => {
  const game = new Game({ mode: 'coop' }), gate = game.gates[0];
  place(game.players[0], gate.x - 70);
  place(game.players[1], gate.x - 110);
  advance(game, .8, [{ move: 1 }, {}]);
  assert.equal(game.players[0].x, gate.x - W / 2);
  assert.equal(gate.open, false);
});

test('horizontal and vertical moving platforms carry resting riders at 30, 60, and 120 Hz', () => {
  for (const axis of ['x', 'z']) for (const dt of [1 / 30, 1 / 60, 1 / 120]) {
    const game = new Game({ level: 1, mode: 'coop' });
    const platform = game.platforms.find(platform => platform.kind === 'moving' && platform.axis === axis);
    for (const player of game.players) place(player, platform.x + 55 + player.id * 50, platform.z, { ride: platform });
    for (let frame = 0; frame < 5 / dt; frame++) {
      game.step(dt, [{}, {}]);
      for (const player of game.players) {
        assert.equal(player.ride, platform, `${axis}-axis at ${1 / dt} Hz, frame ${frame}`);
        assert.equal(player.grounded, true);
        assert(Math.abs(player.z - platform.z) < 1e-6);
        assert(Math.abs(player.x - platform.x - 55 - player.id * 50) < 1e-6);
      }
    }
  }
});

test('crumbling platforms drop riders, then return to support another landing', () => {
  const game = new Game({ level: 4, mode: 'coop' });
  const platform = game.platforms.find(platform => platform.kind === 'crumble');
  for (const player of game.players) place(player, platform.x + 55 + player.id * 50, platform.z, { ride: platform });
  advance(game, .7);
  assert.equal(platform.hidden, false);
  advance(game, .2);
  assert.equal(platform.hidden, true);
  assert(game.players.every(player => player.z < platform.z));
  advance(game, 3.1);
  assert.equal(platform.hidden, false);
  place(game.players[0], platform.x + 55, platform.z + 8, { grounded: false, coyote: 0, vz: -200 });
  advance(game, .08);
  assert.equal(game.players[0].ride, platform);
});

test('springs launch higher than a normal jump and later spikes change state', () => {
  const game = new Game({ level: 3, mode: 'coop' }), spring = game.springs[0];
  for (const player of game.players) place(player, spring.x + spring.w / 2, spring.z);
  game.step(DT, [{}, {}]);
  assert(game.players[0].vz > 850);
  let peak = 0;
  for (let frame = 0; frame < 120; frame++) {
    game.step(DT, [{}, {}]);
    peak = Math.max(peak, game.players[0].z - spring.z);
  }
  assert(peak > 220);
  const night = new Game({ level: 9, mode: 'coop' }), spike = night.spikes[0];
  const observed = new Set();
  for (let frame = 0; frame < 600; frame++) {
    night.step(DT, [{}, {}]);
    observed.add(spike.active);
  }
  assert.deepEqual(observed, new Set([true, false]));
});

test('each boss takes multiple distinct stomps, bounces the attacker, and awards defeat points', () => {
  for (const level of [2, 5, 8, 11]) {
    const game = new Game({ level, mode: 'coop' }), boss = game.enemies.find(enemy => enemy.kind === 'boss');
    const originalHp = boss.hp, originalScore = game.score;
    place(game.players[1], boss.x - 350);
    const drop = () => {
      place(game.players[0], boss.x, boss.z + boss.h + 1, { grounded: false, coyote: 0, vz: -300, invulnerable: 0 });
      game.step(DT, [{}, {}]);
    };
    drop();
    assert.equal(boss.hp, originalHp - 1);
    assert(game.players[0].vz > 500);
    assert.equal(game.players[0].health, 3);
    drop();
    assert.equal(boss.hp, originalHp - 1, 'A second collision during boss invulnerability must not remove another hit point');
    for (let hit = 1; hit < originalHp; hit++) {
      for (const player of game.players) place(player, boss.left - 110 - player.id * 55);
      advance(game, .7);
      drop();
      assert.equal(boss.hp, originalHp - hit - 1);
    }
    assert.equal(boss.alive, false);
    assert(game.score >= originalScore + 30);
  }
});

test('the goal requires both available partners, open gates, and a defeated boss', () => {
  const game = new Game({ mode: 'coop' });
  for (const player of game.players) place(player, game.finish);
  game.step(DT, [{}, {}]);
  assert.equal(game.state, 'playing', 'Closed gates must prevent clearing');
  for (const gate of game.gates) gate.open = true;
  place(game.players[1], game.finish - 150);
  game.step(DT, [{}, {}]);
  assert.equal(game.state, 'playing', 'One player reaching the goal must not clear');
  place(game.players[1], game.finish, 0, { bubble: true });
  game.step(DT, [{}, {}]);
  assert.equal(game.state, 'playing', 'A bubble at the goal must not count');
  place(game.players[1], game.finish);
  game.step(DT, [{}, {}]);
  assert.equal(game.state, 'clear');
  assert(game.events.includes('win'));
  const time = game.time;
  game.step(1, [{ move: -1 }, { move: -1 }]);
  assert.equal(game.time, time, 'Cleared stages must stop simulation');
  const bossStage = new Game({ level: 2, mode: 'coop' });
  for (const gate of bossStage.gates) gate.open = true;
  for (const player of bossStage.players) place(player, bossStage.finish);
  bossStage.step(DT, [{}, {}]);
  assert.equal(bossStage.state, 'playing', 'A living boss must prevent clearing');
});

test('all generated ground gaps and rises are jumpable at normal speed across frame rates and wind phases', () => {
  let crossings = 0;
  for (let level = 0; level < 12; level++) {
    const grounds = makeLevel(level).platforms.filter(platform => platform.kind === 'ground');
    for (let index = 0; index < grounds.length - 1; index++) {
      const before = grounds[index], after = grounds[index + 1], edge = before.x + before.w;
      if (after.x === edge && after.z <= before.z) continue;
      for (const dt of [1 / 30, 1 / 120]) for (const phase of [0, 5, 10]) {
        const game = new Game({ level, mode: 'coop' }), player = game.players[0];
        game.tick = phase;
        place(player, edge - 110, before.z, { vx: 285 });
        place(game.players[1], player.x - 65, player.z);
        let jumped = false, landed = false;
        for (let frame = 0; frame < 2 / dt; frame++) {
          const jump = !jumped && edge - player.x < 50;
          jumped ||= jump;
          game.step(dt, [{ move: 1, jump: jump || (!player.grounded && player.vz > 0) }, {}]);
          if (player.grounded && player.x + W / 2 > after.x && Math.abs(player.z - after.z) < 1) { landed = true; break; }
          if (player.bubble) break;
        }
        assert(landed, `Stage ${level + 1}, segment ${index}, gap ${after.x - edge}, rise ${after.z - before.z}, ${1 / dt} Hz, wind phase ${phase}`);
        crossings++;
      }
    }
  }
  console.log(`  ${crossings} ground transitions cleared`);
});

// A simple player-facing policy: run toward the next gate or goal, hold jumps
// over visible hazards and ledges, stand on a gate plate, and track the boss.
// Full runs below never teleport, remove obstacles, heal players, or force gates.
function routeInput(game, player) {
  if (player.bubble) return { move: 0, jump: false };
  const gate = game.gates.find(gate => !gate.open && gate.x - player.x < 460 && gate.x > player.x - 50);
  const boss = game.enemies.find(enemy => enemy.alive && enemy.kind === 'boss' && Math.abs(enemy.x - player.x) < 450);
  const target = gate ? gate.plates[0].x + gate.plates[0].w / 2 : boss ? boss.x : game.finish;
  const distance = target - player.x, move = Math.abs(distance) > 8 ? Math.sign(distance) : 0;
  let jump = Boolean(boss && player.grounded && Math.abs(distance) < 150);
  if (player.grounded && move) {
    const ground = game.platforms.find(platform => platform.kind === 'ground' && player.x >= platform.x &&
      player.x < platform.x + platform.w && Math.abs(player.z - platform.z) < 1);
    if (ground && ground.x + ground.w - player.x < 50) {
      const next = game.platforms.find(platform => platform.kind === 'ground' && platform.x >= ground.x + ground.w);
      if (next && (next.x > ground.x + ground.w || next.z > player.z)) jump = true;
    }
    for (const spike of game.spikes) if (spike.active && spike.x - player.x > 0 && spike.x - player.x < 75 && Math.abs(player.z - spike.z) < 5) jump = true;
    for (const enemy of game.enemies) if (enemy.alive && enemy.kind !== 'boss' && enemy.x - player.x > 0 && enemy.x - player.x < 110 && enemy.z < player.z + 80) jump = true;
  }
  return { move, jump: jump || (!player.grounded && player.vz > 0) };
}

test('all 12 stages clear with real hazards, automatic partner, gates, bosses, and checkpoint recovery', () => {
  let combinedTime = 0;
  for (let level = 0; level < 12; level++) {
    const game = new Game({ level });
    for (let frame = 0; frame < 300 / DT && game.state === 'playing'; frame++) {
      game.step(DT, [routeInput(game, game.players[0])]);
    }
    assert.equal(game.state, 'clear', `Stage ${level + 1} stalled: ${JSON.stringify(game.players.map(({ x, z, bubble }) => ({ x, z, bubble })))}`);
    assert(game.gates.every(gate => gate.open));
    assert(game.enemies.every(enemy => enemy.kind !== 'boss' || !enemy.alive));
    assert(game.checkpoint.x > game.level.width / 2);
    assert(game.players.every(player => !player.bubble && player.x >= game.finish - 85));
    combinedTime += game.stageTime;
    console.log(`  Stage ${level + 1}: ${game.stageTime.toFixed(1)} s, ${game.deaths} recoveries`);
  }
  assert(combinedTime > 12 * 60, 'Complete routes should contain sustained playable traversal');
});

console.log(`${passed} LANTERN DUO checks passed`);
