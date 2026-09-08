(() => {
  'use strict';
  const grid = document.getElementById('game-grid');
  if (!grid) return;
  const online = location.pathname.endsWith('/online.html') || location.pathname.endsWith('online.html');
  const classic = (game, mode = online ? 'online' : 'solo') => `classic.html?game=${game}&mode=${mode}`;
  const extras = [
    { n: 11, title: 'LIMINAL ZOMBIE FPS', badge: 'FPS / ZOMBIE', desc: online ? '時間制限なし。黄色い迷路でゾンビを撃ち、先に20HITした方が勝ち。' : '黄色い迷路でゾンビ19体＋最後の大型ボスを倒して脱出。時間制限なし。', href: `fps.html?mode=${online ? 'online' : 'solo'}`, action: online ? '20HIT対戦を開く' : 'ゾンビFPSを遊ぶ' },
    { n: 12, title: 'STAR STRIKE', badge: 'NEW / SHOOTING', desc: '高速縦スクロールシューティング。敵を倒してコンボ倍率を伸ばそう。', href: `shooting.html?mode=${online ? 'online' : 'solo'}`, action: online ? 'シューティング対戦' : '1人でシューティング' },
    { n: 13, title: 'ログインなしチャット', badge: 'REALTIME CHAT', desc: 'ニックネームだけで参加。24時間履歴・オンライン人数表示つきのリアルタイムチャット。', href: 'chat.html', action: 'チャットを開く' },
    { n: 14, title: 'HIRAGANA TYPE ATTACK', badge: 'NEW / TYPING', desc: online ? 'お題も入力もひらがなのみ。同じお題順で2人同時に20秒スコア勝負。' : 'お題も入力もひらがなのみ。ローマ字表示なしの20秒タイピング勝負。', href: `typing.html?mode=${online ? 'online' : 'solo'}`, action: online ? 'ひらがな対戦' : 'ひらがなタイピング' },
    { n: 15, title: 'CHAIN ORBS VS CPU', badge: 'ENDLESS / PUZZLE', desc: '時間制限なしの1人対CPU戦。連鎖でおじゃまオーブを送り、先に盤面が埋まった側が負け。全画面対応。', href: 'game15.html', action: 'CPU対戦を始める' },
    { n: 16, title: 'MOUNTAIN SHADOW', badge: 'SPECIAL / 3D STEALTH', desc: '人型エージェントで美麗な山岳基地へ潜入。3目標達成で勝利、捕捉・タイムオーバーで敗北する約5分ミッション。', href: 'game16.html', action: '山岳潜入を開始' },
    { n: 17, title: 'SHARED WHITEBOARD', badge: 'REALTIME / WHITEBOARD', desc: '指・タッチペン・マウスで描ける共有ホワイトボード。部屋コードでリアルタイム同期、全消去ボタンつき。', href: 'whiteboard.html', action: '共有ボードを開く' },
    { n: 18, title: '大富豪', badge: 'CARDS / DAIFUGO', desc: online ? '部屋コードで2人対戦。8切り・革命入りの大富豪。先に手札を0枚にした方が勝ち。' : 'CPUと大富豪。8切り・革命入り。先に手札を0枚にした方が勝ち。', href: classic('daifugo'), action: online ? '大富豪で対戦' : 'CPUと大富豪' },
    { n: 19, title: 'ババ抜き', badge: 'CARDS / OLD MAID', desc: online ? '部屋コードで2人ババ抜き。相手の裏向きカードを引き、最後のジョーカーを避けよう。' : 'CPUとババ抜き。ペアは自動で捨て、最後のジョーカーを避けよう。', href: classic('oldmaid'), action: online ? 'ババ抜きで対戦' : 'CPUとババ抜き' },
    { n: 20, title: 'COLOR UNO', badge: 'CARDS / UNO', desc: online ? '色・数字・記号を合わせる2人カード対戦。SKIP、+2、WILD、W+4入り。' : 'CPUとUNOルールのカード対戦。SKIP、+2、WILD、W+4入り。', href: classic('uno'), action: online ? 'UNOで対戦' : 'CPUとUNO' },
    { n: 21, title: 'オセロ', badge: 'BOARD / OTHELLO', desc: online ? '8×8の本格オセロを部屋コードで2人対戦。置ける場所をガイド表示。' : '8×8の本格オセロをCPUと対戦。置ける場所をガイド表示。', href: classic('othello'), action: online ? 'オセロで対戦' : 'CPUとオセロ' },
    { n: 22, title: 'マルバツゲーム', badge: 'BOARD / 3×3', desc: online ? '3×3の○×ゲームを部屋コードで2人対戦。短時間で決着。' : '3×3の○×ゲーム。ミニマックスCPUと短時間勝負。', href: classic('ttt'), action: online ? 'マルバツで対戦' : 'CPUとマルバツ' },
    { n: 23, title: 'OUTBREAK: BLACK SITE', badge: '3D FPS / 5 AREAS / CO-OP', desc: online ? '全5面の協力ゾンビサバイバル。人型プレイヤーをRealtime同期し、2人そろって各エリアのゴールを目指す。ライフ3・3段階難易度・固有ボス。' : '全5面の3DゾンビサバイバルFPS。通常ゾンビは1発、各面に固有ボス。ライフ3で各ゴールを目指す。EASY/NORMAL/NIGHTMARE対応。', href: `game23.html?mode=${online ? 'coop' : 'solo'}`, action: online ? '2人協力ミッション' : 'BLACK SITEへ侵入' }
  ];
  if (online) {
    const party = [
      [24,'REACTOR RELAY','CO-OP / 5 MIN','制御コードを2人でつなぎ、原子炉を安定化。'],
      [25,'METEOR DEFENSE','CO-OP / DEFENSE','迫る隕石を分担迎撃。基地HPを守り切れ。'],
      [26,'CARGO RUSH','VS / RISK','3レーンから貨物を回収。安全策か高配当か。'],
      [27,'VIRUS PURGE','CO-OP / SPEED','感染ノードを同時駆除し、ネットワークを救う。'],
      [28,'TREASURE HEIST','VS / TREASURE','宝箱の当たりと罠を読み、先に75コイン。'],
      [29,'SKY TOWER BUILDERS','CO-OP / BUILD','資材を共有し、空中塔を16階まで建築。'],
      [30,'ESCAPE SWITCH','CO-OP / PUZZLE','色スイッチを正しい順で解除して脱出。'],
      [31,'SNOWBALL ARENA','VS / DUEL','チャージ・ガード・雪玉攻撃の読み合い。'],
      [32,'CRYSTAL CAPTURE','VS / REACTION','出現クリスタルを早取りして45点先取。'],
      [33,'BOMB PASS','VS / HOT POTATO','導火線が切れる前に爆弾を相手へPASS。'],
      [34,'KITCHEN CHAOS','CO-OP / COOKING','注文どおりに2人で食材を連携投入。'],
      [35,'GHOST HUNT','VS / HUNT','暗闇から出るゴーストを先に40体捕獲。'],
      [36,'SPACE SALVAGE','VS / RISK','宇宙漂流物を回収。レア品か故障かの勝負。'],
      [37,'BRIDGE BUILDERS','CO-OP / BUILD','木材・ロープ・金属を集めて橋を架ける。'],
      [38,'LASER MAZE','CO-OP / MAZE','共有ドローンを2人で誘導し迷路を5回突破。'],
      [39,'CASTLE SIEGE','VS / STRATEGY','攻撃・防御・チャージで相手の城を破壊。'],
      [40,'FISHING FRENZY','VS / TIMING','ゲージ中央でHOOK。先に100kg釣り上げる。'],
      [41,'FIRE BRIGADE','CO-OP / DEFENSE','広がる火災を分担消火し、建物を守る。'],
      [42,'RHYTHM RELAY','CO-OP / RHYTHM','4ビートを交互につないでライブ成功を狙う。'],
      [43,'CROWN RACE','VS / RACE','安全道・近道・ワープを選び、先に王冠へ。']
    ];
    party.forEach(([n,title,badge,desc])=>extras.push({n,title,badge,desc,href:`party.html?game=${n}`,action:'約5分マッチを開く'}));
  }
  for (const g of extras) {
    const card = document.createElement('article');
    card.className = 'game-card extra-card';
    card.innerHTML = `<span class="num">GAME ${String(g.n).padStart(2, '0')}</span><span class="catalog-extra-badge">${g.badge}</span><h3>${g.title}</h3><p>${g.desc}</p><a class="extra-link" href="${g.href}">${g.action}</a>`;
    grid.appendChild(card);
  }
})();
