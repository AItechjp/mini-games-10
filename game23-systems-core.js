/* Shared, deterministic GAME 23 rules. No renderer, clock or network side effects. */
(() => {
  'use strict';
  const VERSION = 'blacksite-operations-1';
  const FAT_TYPES = Object.freeze(['fat', 'brute', 'bloater']);
  const NORMAL_TYPES = Object.freeze(['walker', 'zombie', 'runner', 'crawler', 'dog', 'hound', 'licker', 'stalker', 'spitter', 'leaper', 'armored']);
  const WEAPONS = Object.freeze({
    rifle: Object.freeze({ name: 'アサルトライフル', magazine: 40, interval: 125, reload: 1100, damage: 1, weak: 5 }),
    smg: Object.freeze({ name: 'サブマシンガン', magazine: 60, interval: 90, reload: 1450, damage: 1, weak: 3 }),
    marksman: Object.freeze({ name: 'マークスマンライフル', magazine: 15, interval: 340, reload: 1550, damage: 3, weak: 9 }),
    carbine: Object.freeze({ name: 'カービン / 素早い再装填', magazine: 24, interval: 150, reload: 650, damage: 2, weak: 5 }),
    machinegun: Object.freeze({ name: '軽機関銃 / 制圧', magazine: 100, interval: 115, reload: 2700, damage: 1, weak: 4 }),
    interceptor: Object.freeze({ name: 'インターセプター / 超連射', magazine: 35, interval: 65, reload: 1700, damage: 1, weak: 2 }),
    revolver: Object.freeze({ name: 'マグナム / 一撃重視', magazine: 6, interval: 510, reload: 1450, damage: 7, weak: 18 }),
    scout: Object.freeze({ name: 'スカウト / 精密射撃', magazine: 10, interval: 650, reload: 1850, damage: 5, weak: 25 }),
    vanguard: Object.freeze({ name: 'ヴァンガード / 対大型', magazine: 18, interval: 235, reload: 1950, damage: 4, weak: 8 })
  });
  const STORIES = [
  [
    "灰鐘の呼び声",
    "鐘の止まった聖堂で、埋葬された者たちが目を覚ました。灯火を戻し、最初の巡礼者の手記を探す。",
    [
      "祭壇に火を灯す",
      "巡礼者の手記を拾う",
      "灰鐘の祈りを守る"
    ],
    [
      "activate",
      "collect",
      "defend"
    ]
  ],
  [
    "白い葬列",
    "凍りついた巡礼路に生者の足跡が続く。道標の火を戻し、迷った巡礼者を雪から連れ出す。",
    [
      "山道の火を灯す",
      "迷い人を護送",
      "山頂の祠を守る"
    ],
    [
      "activate",
      "escort",
      "defend"
    ]
  ],
  [
    "水底の記憶",
    "王都へ流れる水に、死者の囁きが混じる。水道橋の聖印を拾い、閉ざされた水門を開く。",
    [
      "水底の聖印を拾う",
      "古い水門を開く",
      "水路の亡者を討つ"
    ],
    [
      "collect",
      "activate",
      "purge"
    ]
  ],
  [
    "沈黙の渡し船",
    "葬送船は死者を運ぶはずだった。船乗りを救い、港に残る最後の火を守る。",
    [
      "船長の手記を拾う",
      "船乗りを護送",
      "港の灯火を守る"
    ],
    [
      "collect",
      "escort",
      "defend"
    ]
  ],
  [
    "王なき街",
    "城門は内側から閉ざされている。街の鐘を起こし、広場をさまよう旧王の兵を眠らせる。",
    [
      "城門の鐘を鳴らす",
      "広場の亡者を討つ",
      "避難者の灯火を守る"
    ],
    [
      "activate",
      "purge",
      "defend"
    ]
  ],
  [
    "黒城の封印",
    "黒城の奥で、堕ちた王が灰の心臓を抱く。封印をたどり、その玉座へ近づく。",
    [
      "封印文書を拾う",
      "玉座の封印を解く",
      "王座の眷属を討つ"
    ],
    [
      "collect",
      "activate",
      "purge"
    ]
  ],
  [
    "納骨廟の証人",
    "聖堂の地下には名を削られた墓が並ぶ。唯一生き残った墓守を、閉ざされた廟から連れ出す。",
    [
      "納骨廟の灯火を戻す",
      "老いた墓守を護送",
      "廟の亡者を討つ"
    ],
    [
      "activate",
      "escort",
      "purge"
    ]
  ],
  [
    "雪葬の誓い",
    "修道院の鐘は吹雪の夜にだけ聞こえる。誓約の印を探し、残された修道士を迎える。",
    [
      "誓約の印を拾う",
      "修道院の祠を守る",
      "修道士を護送"
    ],
    [
      "collect",
      "defend",
      "escort"
    ]
  ],
  [
    "涙の水門",
    "地下の濁流は、墓を洗い王都へ向かう。二つの水門を開き、呪われた流れを海へ逃がす。",
    [
      "上流の水門を開く",
      "地下水路を清める",
      "下流の水門を開く"
    ],
    [
      "activate",
      "purge",
      "activate"
    ]
  ],
  [
    "帰らぬ船の歌",
    "朽ちた船倉に、灰を運んだ者の記録が残る。記録と最後の操舵手を、波の向こうへ連れ帰る。",
    [
      "朽ちた航海日誌を拾う",
      "岸壁の篝火を守る",
      "操舵手を護送"
    ],
    [
      "collect",
      "defend",
      "escort"
    ]
  ],
  [
    "赤灰の行進",
    "旧市街の敷石が赤く染まる。地下の葬送路を開き、逃げ遅れた者が通る道を照らす。",
    [
      "旧市街の亡者を討つ",
      "葬送路の扉を開く",
      "道標の火を守る"
    ],
    [
      "purge",
      "activate",
      "defend"
    ]
  ],
  [
    "偽王の冠",
    "最初の玉座は空だった。王の名を騙る影を払い、砕けた冠から真の封印を読む。",
    [
      "偽王の眷属を討つ",
      "冠の封印を解く",
      "王の告白を拾う"
    ],
    [
      "purge",
      "activate",
      "collect"
    ]
  ],
  [
    "最後の鐘守",
    "聖堂の鐘楼が崩れ始めた。残る者を導き、最後の鐘が鳴り終わるまで退路を守る。",
    [
      "聖堂の生存者を護送",
      "最後の鐘を鳴らす",
      "鐘楼の退路を守る"
    ],
    [
      "escort",
      "activate",
      "defend"
    ]
  ],
  [
    "太陽のない峰",
    "霊峰の頂に夜明けは来ない。欠けた聖鏡を戻し、遠い王都へ巡礼者の火を届ける。",
    [
      "聖鏡の欠片を拾う",
      "山頂の聖鏡を戻す",
      "峰の灯火を守る"
    ],
    [
      "collect",
      "activate",
      "defend"
    ]
  ],
  [
    "枯れ井戸の祈り",
    "聖水の源は灰の下に埋まっていた。井戸守を連れ戻し、最後の一滴を汚す亡者を退ける。",
    [
      "井戸守を護送",
      "聖水の源を清める",
      "古井戸の封を解く"
    ],
    [
      "escort",
      "purge",
      "activate"
    ]
  ],
  [
    "灯火の果て",
    "最後の渡し船が闇の中で待つ。灯台と桟橋を取り戻し、帰る者のための火を保つ。",
    [
      "灯台に火を灯す",
      "桟橋の亡者を討つ",
      "最後の篝火を守る"
    ],
    [
      "activate",
      "purge",
      "defend"
    ]
  ],
  [
    "名を残す者",
    "聖都に王は戻らない。失われた名を集め、生き残った語り部を鐘の下へ導く。",
    [
      "失われた名簿を拾う",
      "語り部を護送",
      "聖都の鐘を守る"
    ],
    [
      "collect",
      "escort",
      "defend"
    ]
  ],
  [
    "灰の向こうへ",
    "十八の道の先で、王国を蝕む心臓が脈打つ。最後の真実を拾い、死者を縛る火を鎮める。",
    [
      "心臓の守り手を討つ",
      "最後の遺言を拾う",
      "灰の心臓を鎮める"
    ],
    [
      "purge",
      "collect",
      "activate"
    ]
  ]
];
  const INTEL = [
  [
    "巡礼の手記：鐘を鳴らすな。あれは生者を呼ぶ音ではない。",
    "擦れた石碑：頭を失った亡者だけが、二度と立ち上がらなかった。",
    "墓守の帳面：膨れた亡者には、いくつもの魂が詰まっている。"
  ],
  [
    "凍った手紙：雪は足跡を消す。誓いまでは消せない。",
    "山道の刻印：倒れた友のそばを離れるな。手を取ればまだ間に合う。",
    "猟師の覚書：峰の獣は、月を失った夜から吠えている。"
  ],
  [
    "水門の銘：水は王都へ、罪は海へ。",
    "井戸守の記録：腐った息が地に触れたら、そこを離れよ。",
    "流れ着いた手紙：葬送港で待つ。船にはまだ席がある。"
  ],
  [
    "船長の日誌：灯台の火が消えた日、海は帰路を忘れた。",
    "荷札の裏：灰の壺には、王家の封蝋が付いていた。",
    "船乗りの遺言：岸壁の下で、鐘より大きな声を聞いた。"
  ],
  [
    "城門の布告：民を守るために門を閉じる。開ける日付は記されていない。",
    "鍛冶屋の伝言：壊れた火器も、この炭と鉄でまだ撃てる。",
    "処刑の記録：鎧の胸に灯る光だけが、刃を通した。"
  ],
  [
    "封印文書：王の心臓は、三度その姿を変える。",
    "宮廷司祭の告白：我々は死を拒み、生を失った。",
    "巡礼者の遺言：記録を持ち帰れ。次の王に同じ冠を渡すな。"
  ],
  [
    "削られた墓碑：名を奪えば死者は静まる、と王は信じた。",
    "墓守の声：私だけが、運ばれた棺の数を覚えている。",
    "廟の壁：六つの聖印、そのすべてが内側に向いていた。"
  ],
  [
    "修道士の手記：祈りの言葉を忘れても、鐘を引く手は止まらない。",
    "千切れた誓約：印を二つに割った。片方は友に預けた。",
    "窓辺の記録：風が止むと、山の向こうから子守歌が聞こえる。"
  ],
  [
    "水門守の覚書：王の命令は上流と下流を逆にしていた。",
    "沈んだ陶片：灰は沈む。呪いだけが流れてゆく。",
    "逃げた子の手紙：川下の村には、もう誰もいない。"
  ],
  [
    "古い積荷目録：黒城、灰壺六箱、封を破るべからず。",
    "船長の告白：海へ捨てれば終わると思った。海も死んだ。",
    "操舵手の記録：火を一つ見つければ、船は帰れる。"
  ],
  [
    "錆びた道標：地下道は牢ではなく、民のための逃げ道だった。",
    "旧市街の書付：火は順に渡せ。一つを抱えて消すな。",
    "置き去りの籠：包帯と黒パンが、二人分残されている。"
  ],
  [
    "玉座の銘：王はここに座ったことがない。",
    "冠の内側：これは命を守る封印ではなく、死を縛る枷。",
    "侍従の告白：真の心臓は、十八番目の鐘の下にある。"
  ],
  [
    "鐘守の遺言：最後の一人が渡るまで、縄を離すな。",
    "崩れた梁の刻印：火の届かぬ階にも、人の声がする。",
    "聖堂の名簿：残された者の名に、一つずつ丸が付いた。"
  ],
  [
    "山頂の記録：六つの火が、吹雪の底で応えた。",
    "聖鏡の裏：太陽を呼ぶためではない。互いの火を見るために。",
    "巡礼者の声：ここからなら、海まで見える。"
  ],
  [
    "井戸守の教え：聖水は奇跡ではない。汚さず分け合った水の名だ。",
    "古井戸の縄：何人もの手が、同じところを握っていた。",
    "水底の記録：灰の反応が、少しずつ消え始めた。"
  ],
  [
    "沖待ちの航海記：一晩だけ待つはずが、三晩になった。",
    "灯台守の手紙：火が戻ったら、まっすぐこちらへ。",
    "渡し守の約束：最後の便は、君たちを迎えに戻る。"
  ],
  [
    "名簿の余白：知らない名も、ここに残す。",
    "語り部の記録：王の物語は終わる。生きた者の物語は続く。",
    "路地の落書き：火が一つ戻った。次の家へ知らせよう。"
  ],
  [
    "最後の封印：十八の祈りが、ひとつの鎖を解いた。",
    "王の遺言：死を恐れた。忘れられることを、もっと恐れた。",
    "帰還の手記：鐘は鳴らなかった。それでも、空は明るくなった。"
  ]
];
  const CHAPTERS = Object.freeze(STORIES.map((s, area) => Object.freeze({
    act: Math.floor(area / 6) + 1,
    title: s[0], brief: s[1], intel: Object.freeze(INTEL[area]),
    objectives: Object.freeze(s[2].map((label, index) => Object.freeze({
      id: `a${area}-o${index}`, label, kind: s[3][index], t: [.2, .46, .72][index],
      target: s[3][index] === 'defend' ? 45 + (area % 6) * 5 : s[3][index] === 'purge' ? 14 + (area % 6) * 2 : s[3][index] === 'escort' ? 46 : s[3][index] === 'activate' ? 5 : 2
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
    const w = typeof weapon==='string'&&Object.hasOwn(WEAPONS,weapon) ? WEAPONS[weapon] : WEAPONS.rifle;
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
    const rank = stats.bosses >= CHAPTERS.length && stats.downs === 0 && accuracy >= 55 ? 'S' : stats.bosses >= CHAPTERS.length ? 'A' : points >= 20000 ? 'B' : 'C';
    return { points, accuracy, rank };
  }
  function validCheckpoint(value) {
    return !!value && value.version === VERSION && Number.isInteger(value.area) && value.area >= 0 && value.area < CHAPTERS.length && Number.isSafeInteger(value.seed) && value.seed >= 0 && ['easy','normal','nightmare'].includes(value.difficulty) && ['campaign','survival'].includes(value.playlist);
  }
  function validSnapshot(m) {
    if(!m||!Number.isInteger(m.area)||m.area<0||m.area>=CHAPTERS.length||!Number.isSafeInteger(m.seed)||!['easy','normal','nightmare'].includes(m.difficulty)||!['campaign','survival'].includes(m.playlist)||!Number.isFinite(m.time)||!Number.isFinite(m.elapsed)||m.time<0||m.elapsed<0||!Number.isInteger(m.wave)||m.wave<1)return false;
    if(!m.stats||!['kills','shots','hits','objectives','intel','bosses','revives','downs'].every(k=>Number.isFinite(m.stats[k])&&m.stats[k]>=0)||!m.perks||!['ammo','mobility','armor'].every(k=>Number.isInteger(m.perks[k])&&m.perks[k]>=0&&m.perks[k]<=3))return false;
    if(!Array.isArray(m.players)||m.players.length>2||m.players.length<1||!m.players.every(p=>p&&typeof p.id==='string'&&typeof p.weapon==='string'&&Object.hasOwn(WEAPONS,p.weapon)&&['x','z','yaw','pitch','lives','ammo','reloadAt','invUntil','infUntil','rpgUntil','rpgShots','guardUntil','downUntil','revive'].every(k=>Number.isFinite(p[k]))&&p.lives>=0&&p.lives<=3))return false;
    if(!Array.isArray(m.enemies)||m.enemies.length>113||!m.enemies.every(a=>Array.isArray(a)&&typeof a[0]==='string'&&Number.isInteger(a[1])&&a[1]>=-1&&a[1]<112&&[2,3,4,7,8,11,12,13,14,15].every(i=>Number.isFinite(a[i]))))return false;
    if(!Array.isArray(m.objectives)||m.objectives.length>3||!Array.isArray(m.discoveries)||m.discoveries.length>5)return false;
    if(![...m.objectives,...m.discoveries].every(o=>o&&typeof o.id==='string'&&typeof o.label==='string'&&o.label.length<120&&['activate','collect','defend','escort','purge','intel','cache'].includes(o.kind)&&Number.isFinite(o.x)&&Number.isFinite(o.z)))return false;
    if(!m.objectives.every(o=>Number.isFinite(o.progress)&&Number.isFinite(o.target)&&o.target>0&&Number.isFinite(o.t)))return false;
    return Array.isArray(m.items)&&m.items.length<=100&&m.items.every(a=>Array.isArray(a)&&typeof a[0]==='string'&&['life','infinite','invincible','launcher'].includes(a[1])&&Number.isFinite(a[2])&&Number.isFinite(a[3]));
  }
  globalThis.BlacksiteRules = Object.freeze({VERSION, FAT_TYPES, NORMAL_TYPES, WEAPONS, CHAPTERS, health, damage, raySphere, rayBox, sequenceGate, objectiveStep, score, validCheckpoint, validSnapshot, clamp});
})();
