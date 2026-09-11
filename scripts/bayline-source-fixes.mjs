import {readFile,writeFile} from 'node:fs/promises';
const edits={
 'bayline/world.mjs':[
  ['g.setIndex(ind);g.computeVertexNormals();return g;',"g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));g.setIndex(ind);g.computeVertexNormals();return g;"],
  ['pool.position.set(-80,.37,80);','pool.position.set(-80,.66,80);']
 ],
 'bayline/core.mjs':[
  ['(Math.sin(i.yaw)*i.y+Math.cos(i.yaw)*i.x)*speed*dt,dz=(Math.cos(i.yaw)*i.y-Math.sin(i.yaw)*i.x)*speed*dt','(Math.sin(i.yaw)*i.y-Math.cos(i.yaw)*i.x)*speed*dt,dz=(Math.cos(i.yaw)*i.y+Math.sin(i.yaw)*i.x)*speed*dt'],
  ["s.side.phase=1;resetStage(s);notify(s,'荷物を受け取った。目的地へ急ごう。');","s.side.phase=1;resetStage(s);s.started=true;notify(s,'荷物を受け取った。目的地へ急ごう。');"],
  ["if(!s.started){if(!near.length)return;", "if(q.type==='escape'&&!s.started){s.started=true;s.stageTime=0;s.wanted=Math.max(s.wanted,2);s.heatAt=s.time;}\n if(!s.started){if(!near.length)return;"],
  ['c.speed+=(Math.abs(err)>.8?5:11+((c.id*3)%5)-c.speed)*0;','']
 ]
};
for(const [path,replacements]of Object.entries(edits)){
 let source=await readFile(path,'utf8'),changed=false;
 for(const [before,after]of replacements){if(source.includes(before)){source=source.replace(before,after);changed=true;}else if(after&&!source.includes(after))throw new Error('Unexpected source; refusing a broad replacement in '+path);}
 if(changed){await writeFile(path,source);console.log('Corrected '+path);}
}
