(() => {
  'use strict';
  const grid=document.getElementById('game-grid');if(!grid)return;
  const online=location.pathname.endsWith('/online.html')||location.pathname.endsWith('online.html');
  const extras=[
    {n:11,title:'FPS ARENA',badge:'NEW / FPS',desc:'2.5DレイキャストFPS。移動・旋回・射撃で20秒のハイスコア勝負。',href:`fps.html?mode=${online?'online':'solo'}`,action:online?'FPS対戦を開く':'1人でFPS'},
    {n:12,title:'STAR STRIKE',badge:'NEW / SHOOTING',desc:'高速縦スクロールシューティング。敵を倒してコンボ倍率を伸ばそう。',href:`shooting.html?mode=${online?'online':'solo'}`,action:online?'シューティング対戦':'1人でシューティング'},
    {n:13,title:'ログインなしチャット',badge:'REALTIME CHAT',desc:'ニックネームだけで参加。24時間履歴・オンライン人数表示つきのリアルタイムチャット。',href:'chat.html',action:'チャットを開く'}
  ];
  for(const g of extras){
    const card=document.createElement('article');card.className='game-card extra-card';
    card.innerHTML=`<span class="num">GAME ${String(g.n).padStart(2,'0')}</span><span class="catalog-extra-badge">${g.badge}</span><h3>${g.title}</h3><p>${g.desc}</p><a class="extra-link" href="${g.href}">${g.action}</a>`;
    grid.appendChild(card);
  }
})();
