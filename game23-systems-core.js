/* Shared, deterministic GAME 23 rules. No renderer, clock or network side effects. */
(() => {
  'use strict';
  const VERSION = 'blacksite-operations-1';
  const FAT_TYPES = Object.freeze(['fat', 'brute', 'bloater']);
  const NORMAL_TYPES = Object.freeze(['walker', 'zombie', 'runner', 'crawler', 'dog', 'hound', 'licker', 'stalker', 'spitter', 'leaper', 'armored']);
  const WEAPONS = Object.freeze({
    rifle: Object.freeze({ name: 'アサルトライフル', magazine: 40, interval: 125, reload: 1100, damage: 1, weak: 5 }),
    smg: Object.freeze({ name: 'サブマシンガン', magazine: 60, interval: 90, reload: 1450, damage: 1, weak: 3 }),
    marksman: Object.freeze({ name: 'マークスマンライフル', magazine: 15, interval: 340, reload: 1550, damage: 3, weak: 9 })
  });
  const STORIES = [
    ['封鎖命令', '洋館の隔離病棟から連絡が途絶えた。配電を復旧し、研究記録を回収する。', ['配電盤を復旧', '隔離病棟の記録を回収', '救難通信を維持'], ['activate', 'collect', 'defend']],
    ['白い沈黙', '山頂中継所は雪に埋もれた。遭難者を連れ帰り、観測データを守る。', ['気象中継器を復旧', '遭難隊員を護送', '観測所を防衛'], ['activate', 'escort', 'defend']],
    ['逆流する記憶', '峡谷の浄水施設が汚染源だ。検体を確保し、水門を再起動する。', ['汚染検体を採取', '浄水装置を再起動', '水門周辺を制圧'], ['collect', 'activate', 'purge']],
    ['最後の船便', '港の船員が救難信号を送り続けている。船員と航海記録を救出する。', ['航海記録を回収', '船員を護送', '港湾信号を防衛'], ['collect', 'escort', 'defend']],
    ['停電都市', '都市の防衛網が落ちた。電源と中継点を確保し、避難経路を開く。', ['変電設備を復旧', '交差点の感染群を制圧', '避難通信を維持'], ['activate', 'purge', 'defend']],
    ['夜明けの代価', '悪魔城の地下に感染の中心核がある。封印を解き、生きて帰還する。', ['封印記録を回収', '封印装置を解除', '中心核の感染群を制圧'], ['collect', 'activate', 'purge']]
  ];
  const INTEL = [
    ['隔離日誌：最初の患者は、死後も扉を叩き続けた。', '看護記録：光に反応する個体がいる。頭部を狙え。', '研究室メモ：肥大個体の耐久性だけは通常種と異なる。'],
    ['観測日誌：吹雪は感染を止めなかった。', '救難隊通信：二人なら倒れた仲間を連れ帰れる。', '登山者の手記：獣の遠吠えは山頂から聞こえた。'],
    ['検査報告：汚染は上流から流れ込んでいる。', '水門職員のメモ：吐酸は着弾地点から離れれば避けられる。', '流された手紙：最後の避難船は港に残っている。'],
    ['船長の日誌：灯台が消えてから船は出せない。', '荷役記録：城へ運ばれた貨物に検疫印はなかった。', '救命艇の通信：巨大な影が岸壁の下を通った。'],
    ['避難放送原稿：感染源の記録を城まで届けろ。', '整備員の伝言：電源を戻せば避難経路はつながる。', '監視記録：処刑者は弱点を隠して突進する。'],
    ['封印文書：核は三段階で防衛反応を強める。', '研究者の告白：封鎖だけでは止められなかった。', '最終通信：記録を持ち帰れ。次の犠牲を出さないために。']
  ];
  const CHAPTERS = Object.freeze(STORIES.map((s, area) => Object.freeze({
    title: s[0], brief: s[1], intel: Object.freeze(INTEL[area]),
    objectives: Object.freeze(s[2].map((label, index) => Object.freeze({
      id: `a${area}-o${index}`, label, kind: s[3][index], t: [.2, .46, .72][index],
      target: s[3][index] === 'defend' ? 45 + area * 5 : s[3][index] === 'purge' ? 14 + area * 2 : s[3][index] === 'escort' ? 46 : s[3][index] === 'activate' ? 5 : 2
    })))
  })));
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, finite(n, lo)));
  function health(type, difficulty = 'normal', boss = false, bossHp = 100) {
    if (boss) return Math.max(1, finite(bossHp, 100));
    if (!FAT_TYPES.includes(type)) return 1;
    const base = type === 'bloater' ? 5 : 8;
    return difficulty === 'easy' ? Math.max(3, base - 2) : difficulty === 'nightmare' ? base + 3 : base;
  }
  function damage(enemy, weapon = 'rifle', weak = false, blast = false) {
    if (!enemy || enemy.dead) return 0;
    if (!enemy.boss && !FAT_TYPES.includes(enemy.type)) return Math.max(1, finite(enemy.hp, 1));
    const w = WEAPONS[weapon] || WEAPONS.rifle;
    return blast ? 6 : enemy.boss ? (weak ? w.weak : w.damage) : w.damage * (weak ? 2 : 1);
  }
  function raySphere(o, d, center, radius, range = 125) {
    const x = o.x - center.x, y = o.y - center.y, z = o.z - center.z;
    const b = x*d.x + y*d.y + z*d.z, c = x*x+y*y+z*z-radius*radius, disc = b*b-c;
    if (disc < 0) return Infinity;
    const t = -b-Math.sqrt(disc), far = -b+Math.sqrt(disc);
    return far < 0 || t > range ? Infinity : Math.max(0, t);
  }
  function rayBox(o, d, box, range = 125) {
    let near = 0, far = range;
    for (const axis of ['x', 'y', 'z']) {
      const key = axis.toUpperCase(), lo = box['min'+key] ?? (axis === 'y' ? -.2 : 0), hi = box['max'+key] ?? (axis === 'y' ? 3.6 : 0);
      if (Math.abs(d[axis]) < 1e-8) { if (o[axis] < lo || o[axis] > hi) return Infinity; }
      else { let a = (lo-o[axis])/d[axis], b = (hi-o[axis])/d[axis]; if (a>b) [a,b]=[b,a]; near=Math.max(near,a); far=Math.min(far,b); if (near>far) return Infinity; }
    }
    return near;
  }
  function sequenceGate() {
    const seen = new Map();
    return { accept(id, seq) { if (!Number.isSafeInteger(seq) || seq < 1 || seq <= (seen.get(id)||0)) return false; seen.set(id,seq); return true; }, clear(){seen.clear();} };
  }
  function objectiveStep(o, dt, { near = false, contested = false, interact = false, kills = 0 } = {}) {
    if (o.done) return o;
    const next = {...o}, step = clamp(dt, 0, .1);
    if (o.kind === 'purge') next.progress = clamp(kills - (o.killStart || 0), 0, o.target);
    else if (near && (o.kind === 'defend' || o.kind === 'escort' ? !contested : interact)) next.progress = Math.min(o.target, finite(o.progress) + step);
    next.done = next.progress >= o.target;
    return next;
  }
  function score(stats, difficulty = 'normal') {
    const accuracy = stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0;
    const points = Math.max(0, Math.round((stats.kills*100 + stats.objectives*1500 + stats.intel*500 + stats.bosses*3000 + stats.revives*800) * ({easy:.8,normal:1,nightmare:1.5}[difficulty]||1) - stats.downs*250));
    const rank = stats.bosses >= 6 && stats.downs === 0 && accuracy >= 55 ? 'S' : stats.bosses >= 6 ? 'A' : points >= 20000 ? 'B' : 'C';
    return { points, accuracy, rank };
  }
  function validCheckpoint(value) {
    return !!value && value.version === VERSION && Number.isInteger(value.area) && value.area >= 0 && value.area < 6 && Number.isSafeInteger(value.seed) && value.seed >= 0 && ['easy','normal','nightmare'].includes(value.difficulty) && ['campaign','survival'].includes(value.playlist);
  }
  function validSnapshot(m) {
    if(!m||!Number.isInteger(m.area)||m.area<0||m.area>5||!Number.isSafeInteger(m.seed)||!['easy','normal','nightmare'].includes(m.difficulty)||!['campaign','survival'].includes(m.playlist)||!Number.isFinite(m.time)||!Number.isFinite(m.elapsed)||m.time<0||m.elapsed<0||!Number.isInteger(m.wave)||m.wave<1)return false;
    if(!m.stats||!['kills','shots','hits','objectives','intel','bosses','revives','downs'].every(k=>Number.isFinite(m.stats[k])&&m.stats[k]>=0)||!m.perks||!['ammo','mobility','armor'].every(k=>Number.isInteger(m.perks[k])&&m.perks[k]>=0&&m.perks[k]<=3))return false;
    if(!Array.isArray(m.players)||m.players.length>2||m.players.length<1||!m.players.every(p=>p&&typeof p.id==='string'&&Object.hasOwn(WEAPONS,p.weapon)&&['x','z','yaw','pitch','lives','ammo','reloadAt','invUntil','infUntil','rpgUntil','rpgShots','guardUntil','downUntil','revive'].every(k=>Number.isFinite(p[k]))&&p.lives>=0&&p.lives<=3))return false;
    if(!Array.isArray(m.enemies)||m.enemies.length>113||!m.enemies.every(a=>Array.isArray(a)&&typeof a[0]==='string'&&Number.isInteger(a[1])&&a[1]>=-1&&a[1]<112&&[2,3,4,7,8,11,12,13,14,15].every(i=>Number.isFinite(a[i]))))return false;
    if(!Array.isArray(m.objectives)||m.objectives.length>3||!Array.isArray(m.discoveries)||m.discoveries.length>5)return false;
    if(![...m.objectives,...m.discoveries].every(o=>o&&typeof o.id==='string'&&typeof o.label==='string'&&o.label.length<120&&['activate','collect','defend','escort','purge','intel','cache'].includes(o.kind)&&Number.isFinite(o.x)&&Number.isFinite(o.z)))return false;
    if(!m.objectives.every(o=>Number.isFinite(o.progress)&&Number.isFinite(o.target)&&o.target>0&&Number.isFinite(o.t)))return false;
    return Array.isArray(m.items)&&m.items.length<=100&&m.items.every(a=>Array.isArray(a)&&typeof a[0]==='string'&&['life','infinite','invincible','launcher'].includes(a[1])&&Number.isFinite(a[2])&&Number.isFinite(a[3]));
  }
  globalThis.BlacksiteRules = Object.freeze({VERSION, FAT_TYPES, NORMAL_TYPES, WEAPONS, CHAPTERS, health, damage, raySphere, rayBox, sequenceGate, objectiveStep, score, validCheckpoint, validSnapshot, clamp});
})();
