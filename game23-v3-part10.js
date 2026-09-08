/* GAME 23 ULTIMATE — power safety and special infected HUD */
const expansionPart10Damage=damagePlayer;
damagePlayer=function(id,reason='DAMAGE'){
  if(id===state.playerId&&expansionInvincibleUntil>performance.now()){toast('INVINCIBLE',260);return;}
  expansionPart10Damage(id,reason);
};
const expansionMapLegend=document.querySelector('.minimap-panel small');
if(expansionMapLegend)expansionMapLegend.innerHTML='白=自分 / 黄=相方 / 緑=GOAL<br>赤=感染者 / 橙=犬・RUNNER / 紫=リッカー / 大型=デブ';
