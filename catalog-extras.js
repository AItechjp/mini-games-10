(() => {
  'use strict';
  const grid = document.getElementById('game-grid');
  if (!grid) return;
  const online = location.pathname.endsWith('/online.html') || location.pathname.endsWith('online.html');
  const extras = [
    { n: 11, title: 'LIMINAL ZOMBIE FPS', badge: 'FPS / ZOMBIE', desc: online ? '時間制限なし。黄色い迷路でゾンビを撃ち、先に20HITした方が勝ち。' : '黄色い迷路でゾンビ19体＋最後の大型ボスを倒して脱出。時間制限なし。', href: `fps.html?mode=${online ? 'online' : 'solo'}`, action: online ? '20HIT対戦を開く' : 'ゾンビFPSを遊ぶ' },
    { n: 12, title: 'STAR STRIKE', badge: 'NEW / SHOOTING', desc: '高速縦スクロールシューティング。敵を倒してコンボ倍率を伸ばそう。', href: `shooting.html?mode=${online ? 'online' : 'solo'}`, action: online ? 'シューティング対戦' : '1人でシューティング' },
    { n: 13, title: 'ログインなしチャット', badge: 'REALTIME CHAT', desc: 'ニックネームだけで参加。24時間履歴・オンライン人数表示つきのリアルタイムチャット。', href: 'chat.html', action: 'チャットを開く' },
    { n: 14, title: 'TYPE ATTACK', badge: 'NEW / TYPING', desc: '日本語のお題をローマ字入力。WPM・正確率・ミスも記録する20秒タイピング勝負。', href: 'typing.html', action: '20秒タイピング' }
  ];
  for (const g of extras) {
    const card = document.createElement('article');
    card.className = 'game-card extra-card';
    card.innerHTML = `<span class="num">GAME ${String(g.n).padStart(2, '0')}</span><span class="catalog-extra-badge">${g.badge}</span><h3>${g.title}</h3><p>${g.desc}</p><a class="extra-link" href="${g.href}">${g.action}</a>`;
    grid.appendChild(card);
  }
})();
