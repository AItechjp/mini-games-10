(() => {
  'use strict';
  const grid = document.getElementById('game-grid');
  if (!grid) return;
  const online = location.pathname.endsWith('/online.html') || location.pathname.endsWith('online.html');
  const extras = [
    { n: 11, title: 'LIMINAL ZOMBIE FPS', badge: 'FPS / ZOMBIE', desc: online ? '時間制限なし。黄色い迷路でゾンビを撃ち、先に20HITした方が勝ち。' : '黄色い迷路でゾンビ19体＋最後の大型ボスを倒して脱出。時間制限なし。', href: `fps.html?mode=${online ? 'online' : 'solo'}`, action: online ? '20HIT対戦を開く' : 'ゾンビFPSを遊ぶ' },
    { n: 12, title: 'STAR STRIKE', badge: 'NEW / SHOOTING', desc: '高速縦スクロールシューティング。敵を倒してコンボ倍率を伸ばそう。', href: `shooting.html?mode=${online ? 'online' : 'solo'}`, action: online ? 'シューティング対戦' : '1人でシューティング' },
    { n: 13, title: 'ログインなしチャット', badge: 'REALTIME CHAT', desc: 'ニックネームだけで参加。24時間履歴・オンライン人数表示つきのリアルタイムチャット。', href: 'chat.html', action: 'チャットを開く' },
    { n: 14, title: 'TYPE ATTACK', badge: 'NEW / TYPING', desc: online ? '日本語のお題をローマ字入力。同じお題順で2人同時に20秒スコア勝負。' : '日本語のお題をローマ字入力。WPM・正確率・ミスも記録する20秒タイピング勝負。', href: `typing.html?mode=${online ? 'online' : 'solo'}`, action: online ? 'タイピング対戦' : '1人でタイピング' },
    { n: 15, title: 'CHAIN ORBS', badge: 'NEW / PUZZLE', desc: '2個組のオーブを落とし、同色4個以上を消して連鎖倍率を伸ばす20秒パズル。', href: 'game15.html', action: '連鎖パズルを遊ぶ' },
    { n: 16, title: 'MOUNTAIN SHADOW', badge: 'SPECIAL / 3D STEALTH', desc: '山岳基地へ潜入し、レーダー停止・機密回収・脱出を遂行する約5分の3Dステルスミッション。', href: 'game16.html', action: '山岳潜入を開始' }
  ];
  for (const g of extras) {
    const card = document.createElement('article');
    card.className = 'game-card extra-card';
    card.innerHTML = `<span class="num">GAME ${String(g.n).padStart(2, '0')}</span><span class="catalog-extra-badge">${g.badge}</span><h3>${g.title}</h3><p>${g.desc}</p><a class="extra-link" href="${g.href}">${g.action}</a>`;
    grid.appendChild(card);
  }
})();
