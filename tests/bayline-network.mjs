import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {Room} from '../bayline/net.mjs';
import * as C from '../bayline/core.mjs';
const src=await readFile('supabase-config.js','utf8');
const cfg={enabled:true,url:/url:\s*['"]([^'"]+)/.exec(src)?.[1],publishableKey:/publishableKey:\s*['"]([^'"]+)/.exec(src)?.[1]};
const report={started:new Date().toISOString(),checks:[],status:[],badFrames:0};
let s=C.newGame(),remote={},hostInput={},lastFrame=null,ended=false,full=false;
const status=(who,x)=>{report.status.push({who,kind:x.kind,text:x.text});if(who==='guest'&&x.kind==='ended')ended=true;if(who==='third'&&x.kind==='full')full=true;};
let h,g,third;
h=new Room(cfg,p=>{if(p.type==='admit'){if(s.players.length>1)C.removeGuest(s);C.addPlayer(s);h.send('state',{frame:C.snapshot(s)});}if(p.type==='input')remote=C.cleanInput(p.input);if(p.type==='left')C.removeGuest(s);},x=>status('host',x));
g=new Room(cfg,p=>{if(p.type==='state'){const frame=C.readSnapshot(p.frame);if(frame)lastFrame=frame;else report.badFrames++;}},x=>status('guest',x));
third=new Room(cfg,()=>{},x=>status('third',x));
let n=0;const clock=setInterval(()=>{C.tick(s,[hostInput,remote],.02);if(++n%5===0&&h.connected)h.send('state',{frame:C.snapshot(s)});},20);
const until=async(fn,label,ms=25000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>ms)throw new Error('Timed out: '+label);await new Promise(r=>setTimeout(r,30));}};
try{
 const code=h.create();await until(()=>h.joined,'host public topic joins');g.join(code);await until(()=>h.connected&&g.connected&&lastFrame?.players.length===2,'guest receives shared world');report.checks.push('Host and guest connect to the actual Supabase Realtime service without authentication or database writes');
 const z=s.players[1].z;g.send('input',{input:{seq:1,y:1,yaw:Math.PI}});await until(()=>s.players[1].z<z-3,'guest movement reaches host');g.send('input',{input:{seq:2,y:0,yaw:Math.PI}});await until(()=>Math.abs(lastFrame.players[1].z-s.players[1].z)<.3,'movement replicates to guest');report.checks.push('Guest input moves the authoritative host player and returns in a validated network snapshot');
 for(const p of s.players){p.x=-310;p.z=430+p.id;}s.cars[0].x=-315;s.cars[0].z=430;s.cars[0].speed=0;hostInput={seq:1,action:'enter'};await until(()=>s.players[0].car===0,'host enters driver seat');g.send('input',{input:{seq:3,action:'enter'}});await until(()=>s.players[1].car===0&&lastFrame.players[1].seat===1,'guest takes passenger seat');report.checks.push('Driver and passenger seats synchronize on both peers');
 const before=s.cars[0].z;hostInput={seq:1,y:1};await until(()=>s.cars[0].z<before-4,'shared car moves');hostInput={seq:1,brake:true};assert.equal(s.players[0].z,s.players[1].z);report.checks.push('The shared vehicle transports both players to the same position');
 third.join(code);await until(()=>full,'third participant refused');assert.equal(s.players.length,2);report.checks.push('A third participant is rejected without changing the two-player world');h.close();await until(()=>ended,'host close notification');report.checks.push('The guest receives explicit host termination');assert.equal(report.badFrames,0);report.ok=true;
}catch(e){report.ok=false;report.failure=String(e.stack||e);process.exitCode=1;
}finally{clearInterval(clock);h.close();g.close();third.close();report.finished=new Date().toISOString();await mkdir('test-output/bayline',{recursive:true});await writeFile('test-output/bayline/network-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
