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
    { n: 22, title: 'マルバツゲーム', badge: 'BOARD / 3×3', desc: online ? '3×3の○×ゲームを部屋コードで2人対戦。短時間で決着。' : '3×3の○×ゲーム。ミニマックスCPUと短時間勝負。', href: classic('ttt'), action: online ? 'マルバツで対戦' : 'CPUとマルバツ' }
  ];
  for (const g of extras) {
    const card = document.createElement('article');
    card.className = 'game-card extra-card';
    card.innerHTML = `<span class="num">GAME ${String(g.n).padStart(2, '0')}</span><span class="catalog-extra-badge">${g.badge}</span><h3>${g.title}</h3><p>${g.desc}</p><a class="extra-link" href="${g.href}">${g.action}</a>`;
    grid.appendChild(card);
  }
})();
