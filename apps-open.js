(() => {
'use strict';
function wire(){
  document.querySelectorAll('.app100-card').forEach(card=>{
    if(card.querySelector('.app100-launch'))return;
    const num=card.querySelector('.app100-number')?.textContent||'';
    const m=num.match(/(\d+)/); if(!m)return;
    const id=Number(m[1]);
    const a=document.createElement('a');
    a.className='app100-launch'; a.href=`app-tool.html?id=${id}`; a.textContent='開く / 使う';
    card.appendChild(a);
  });
}
const grid=document.getElementById('app-grid');
if(grid){new MutationObserver(wire).observe(grid,{childList:true,subtree:true});wire()}
})();