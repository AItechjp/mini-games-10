(() => {
  'use strict';
  const grid = document.getElementById('game-grid');
  if (!grid) return;
  const online = location.pathname.endsWith('/online.html') || location.pathname.endsWith('online.html');
  const extras = [
    { n: 11, title: 'LIMINAL ZOMBIE FPS', badge: 'FPS / ZOMBIE', desc: online ? '時間制限なし。黄色い迷路でゾンビを撃ち、先に20HITした方が勝ち。' : '黄色い迷路でゾンビ19体＋最後の大型ボスを倒して脱出。時間制限なし。', href: `fps.html?mode=${online ? 'online' : 'solo'}`, action: online ? '20HIT対戦を開く' : 'ゾンビFPSを遊ぶ' },
    { n: 12, title: 'STAR STRIKE', badge: 'NEW / SHOOTING', desc: '高速縦スクロールシューティング。敵を倒してコンボ倍率を伸ばそう。', href: `shooting.html?mode=${online ? 'online' : 'solo'}`, action: online ? 'シューティング対戦' : '1人でシューティング' },
    { n: 13, title: 'ログインなしチャット', badge: 'REALTIME CHAT', desc: 'ニックネームだけで参加。24時間履歴・オンライン人数表示つきのリアルタイムチャット。', href: 'chat.html', action: 'チャットを開く' },
    { n: 14, title: 'HIRAGANA TYPE ATTACK', badge: 'NEW / TYPING', desc: online ? 'お題も入力もひらがなのみ。同じお題順で2人同時に20秒スコア勝負。' : 'お題も入力もひらがなのみ。ローマ字表示なしの20秒タイピング勝負。', href: `typing.html?mode=${online ? 'online' : 'solo'}`, action: online ? 'ひらがな対戦' : 'ひらがなタイピング' },
    { n: 15, title: 'CHAIN ORBS VS CPU', badge: 'ENDLESS / PUZZLE', desc: '時間制限なしの1人対CPU戦。連鎖でおじゃまオーブを送り、先に盤面が埋まった側が負け。全画面対応。', href: 'game15.html', action: 'CPU対戦を始める' },
    { n: 16, title: 'MOUNTAIN SHADOW', badge: 'SPECIAL / 3D STEALTH', desc: '人型エージェントで美麗な山岳基地へ潜入。3目標達成で勝利、捕捉・タイムオーバーで敗北する約5分ミッション。', href: 'game16.html', action: '山岳潜入を開始' }
  ];
  for (const g of extras) {
    const card = document.createElement('article');
    card.className = 'game-card extra-card';
    card.innerHTML = `<span class="num">GAME ${String(g.n).padStart(2, '0')}</span><span class="catalog-extra-badge">${g.badge}</span><h3>${g.title}</h3><p>${g.desc}</p><a class="extra-link" href="${g.href}">${g.action}</a>`;
    grid.appendChild(card);
  }
})();
