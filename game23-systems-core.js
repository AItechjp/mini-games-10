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
  STORIES.push(
    ['地下病棟', '封鎖の裏で第二の実験が続いていた。地下病棟から証人を連れ出す。', ['地下通路の電源を復旧', '生存研究員を護送', '収容棟の感染群を制圧'], ['activate','escort','purge']],
    ['雪原の追跡者', '救難隊の信号が移動している。吹雪の先で仲間を探す。', ['追跡装置を回収', '救難隊の合流点を防衛', '山小屋の隊員を護送'], ['collect','defend','escort']],
    ['決壊前夜', '濁流が避難所に迫る。二つの水門をつないで排水路を開く。', ['上流水門を再起動', '排水路の感染群を制圧', '下流の制御盤を復旧'], ['activate','purge','activate']],
    ['沈没船の証言', '沖合の輸送船から原株の所在が判明した。記録を守って持ち帰る。', ['船内の検疫記録を回収', '岸壁の受信機を防衛', '操舵員を護送'], ['collect','defend','escort']],
    ['赤い地下鉄', '地下鉄を避難列車として動かす。電力復旧中は線路を守れ。', ['駅構内を制圧', '車両用電源を復旧', '出発信号を防衛'], ['purge','activate','defend']],
    ['偽りの王座', '城の核は囮だった。玉座の通信機から真の施設を探す。', ['玉座前を制圧', '暗号通信を解析', '研究主任の記録を回収'], ['purge','activate','collect']],
    ['最終封鎖', '感染を断つため洋館を閉鎖する。退路を確保して起爆系を動かせ。', ['残された避難者を護送', '封鎖装置を復旧', '最後の退路を防衛'], ['escort','activate','defend']],
    ['黎明の峰', '山頂アンテナから全域へ警告を送る。送信完了まで撤退はできない。', ['増幅器を回収', '山頂回線を復旧', '広域放送を防衛'], ['collect','activate','defend']],
    ['浄化作戦', '浄化剤を川に流す前に汚染源を取り除く。作業員と設備を守る。', ['浄化作業員を護送', '取水口の感染群を制圧', '浄化装置を起動'], ['escort','purge','activate']],
    ['水平線の救難', '最後の避難船が入港する。灯台を復旧し桟橋を奪還する。', ['灯台電源を復旧', '桟橋を制圧', '避難船の信号を防衛'], ['activate','purge','defend']],
    ['街に灯を', '街の記録を未来へ残す。生存者を救出し避難放送を再開する。', ['市民の記録を回収', '避難誘導員を護送', '中央放送局を防衛'], ['collect','escort','defend']],
    ['最後の夜明け', 'すべての記録がそろった。中枢を停止し、感染源を完全に断つ。', ['中枢施設の防衛群を制圧', '原株の研究記録を回収', '中枢停止装置を起動'], ['purge','collect','activate']]
  );
  const NEW_INTEL = [
    ['地下への搬送は夜間だけ行われていた。','証人は核の輸送先を知っている。','研究室には同じ記号が六つ刻まれていた。'],
    ['足跡は山小屋で途切れている。','隊員は発信機を二つに分けて運んだ。','風が弱まる瞬間に遠くの声が聞こえる。'],
    ['水門を閉じる順番が逆に書き換えられていた。','汚染源は沈殿槽の底に残っている。','排水先には誰もいないことを確認した。'],
    ['原株の貨物番号は城の記録と一致した。','船長は貨物を海に投棄する命令を拒んだ。','操舵員は帰港するため灯台を探していた。'],
    ['車庫にはまだ動かせる列車がある。','地下の非常電源は地上の変電所につながる。','列車には医薬品と飲料水が積まれている。'],
    ['玉座の下から同じ通信が繰り返されていた。','封印は感染を止める装置ではなかった。','本当の停止コードは各施設の記録にある。'],
    ['封鎖時刻まで全員の退避を待つ。','起爆系の誤作動を防ぐため電源を分離した。','病棟に残る生存者はこれで最後だ。'],
    ['六つの施設から受信確認が届いた。','雲の向こうに救難機が見える。','広域警告は山を越えて届いている。'],
    ['浄化剤は低温でも作用を続ける。','作業員は流量を最後まで確認した。','下流の水から反応が消え始めた。'],
    ['入港船は港外で一晩待っていた。','灯台が点くまで航路を確保する。','最後の便は救難隊を迎えに戻る。'],
    ['避難者の名簿は市庁舎に残す。','中央放送はまだ電池で動いていた。','街の灯が一つずつ戻っている。'],
    ['停止コードの照合が完了した。','研究記録は今後の治療に使える。','最終報告：救難隊、生還。夜明けを確認。']
  ];
  INTEL.push(...NEW_INTEL);
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
