(() => {
'use strict';
const params=new URLSearchParams(location.search);
if(params.get('game')!=='daifugo')return;
let handScrollLeft=0;
let restorePending=false;
function playerHand(){return document.querySelector('#game-stage .you-area .hand')}
function restore(){
  const hand=playerHand();
  if(!hand)return;
  const max=Math.max(0,hand.scrollWidth-hand.clientWidth);
  hand.scrollLeft=Math.min(handScrollLeft,max);
}
document.addEventListener('click',e=>{
  const card=e.target.closest('#game-stage .you-area [data-card]');
  if(!card)return;
  const hand=playerHand();
  if(!hand)return;
  handScrollLeft=hand.scrollLeft;
  if(restorePending)return;
  restorePending=true;
  queueMicrotask(()=>{
    restore();
    requestAnimationFrame(()=>{
      restore();
      restorePending=false;
    });
  });
},true);
})();