import {readFile,writeFile} from 'node:fs/promises';
const edits={
 'bayline/world.mjs':[
  ['g.setIndex(ind);g.computeVertexNormals();return g;',"g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));g.setIndex(ind);g.computeVertexNormals();return g;"],
  ['pool.position.set(-80,.37,80);','pool.position.set(-80,.66,80);']
 ],
 'bayline/core.mjs':[
  ['id:1,x:-315,z:413','id:1,x:-325,z:438'],
  ['(Math.sin(i.yaw)*i.y+Math.cos(i.yaw)*i.x)*speed*dt,dz=(Math.cos(i.yaw)*i.y-Math.sin(i.yaw)*i.x)*speed*dt','(Math.sin(i.yaw)*i.y-Math.cos(i.yaw)*i.x)*speed*dt,dz=(Math.cos(i.yaw)*i.y+Math.sin(i.yaw)*i.x)*speed*dt'],
  ["s.side.phase=1;resetStage(s);notify(s,'荷物を受け取った。目的地へ急ごう。');","s.side.phase=1;resetStage(s);s.started=true;notify(s,'荷物を受け取った。目的地へ急ごう。');"],
  ["if(!s.started){if(!near.length)return;", "if(q.type==='escape'&&!s.started){s.started=true;s.stageTime=0;s.wanted=Math.max(s.wanted,2);s.heatAt=s.time;}\n if(!s.started){if(!near.length)return;"],
  ['c.speed+=(Math.abs(err)>.8?5:11+((c.id*3)%5)-c.speed)*0;',''],
  ["const valid=(a,n)=>Array.isArray(a)&&a.length>=n&&a.slice(0,n).every(Number.isFinite);", "if(d.w<0||d.w>5||!Number.isInteger(d.ch)||!Number.isInteger(d.st)||!Number.isInteger(d.cp)||d.cp<0||d.cp>12||d.en<0||d.en>3||d.ar<0||d.ar>3||d.cash<0||d.cash>1e8)return null;\n const valid=(a,n)=>Array.isArray(a)&&a.length>=n&&a.slice(0,n).every(Number.isFinite);"],
  ["if(d.side&&(!['race','delivery'].includes(d.side.kind)", "if(d.players.some((a,i)=>a[0]!==i||a[4]<0||a[4]>160||!Number.isInteger(a[7]))||d.cars.some((a,i)=>a[0]!==i||Math.abs(a[1])>600||Math.abs(a[2])>600||!Number.isInteger(a[8])||a[8]<0||a[8]>4))return null;\n if(d.side?.kind==='race'&&d.side.index>=CIRCUITS.length)return null;\n if(d.side&&(!['race','delivery'].includes(d.side.kind)"],
  ["events:Array.isArray(d.events)?d.events.slice(-8):[]", "events:Array.isArray(d.events)?d.events.slice(-8).filter(e=>e&&Number.isFinite(e.id)&&Number.isFinite(e.x)&&Number.isFinite(e.z)&&Number.isFinite(e.t)&&['shot','enemyshot','crash','down','success','checkpoint','hurt'].includes(e.type)&&(!['shot','enemyshot'].includes(e.type)||Number.isFinite(e.yaw))):[]"]
 ],
 'bayline/game.mjs':[
  ["import {CityView} from './world.mjs';", "import {CityView} from './world.mjs';\nimport {enrichCity} from './atmosphere.mjs';"],
  ["view=new CityView($('scene'),settings.quality);view.setWeather", "view=new CityView($('scene'),settings.quality);enrichCity(view);view.setWeather"],
  ["function loop(now){const dt=Math.min(.1,(now-(lastTime||now))/1000);lastTime=now;", "function loop(now){const wallDt=(now-(lastTime||now))/1000,dt=Math.min(.12,wallDt);lastTime=now;if(running&&!$('panel').open&&settings.quality!=='low'){if(wallDt>.052)slowTime+=Math.min(wallDt,.2);else slowTime=Math.max(0,slowTime-dt);if(slowTime>7){setQuality(settings.quality==='high'?'medium':'low');showToast('動作を優先して画質を調整しました。設定から変更できます。');}}"]
 ]
};
for(const [path,replacements]of Object.entries(edits)){
 let source=await readFile(path,'utf8'),changed=false;
 for(const [before,after]of replacements){if(after&&source.includes(after))continue;if(source.includes(before)){source=source.replace(before,after);changed=true;}else if(after)throw new Error('Unexpected source; refusing a broad replacement in '+path);}
 if(changed){await writeFile(path,source);console.log('Corrected '+path);}
}
