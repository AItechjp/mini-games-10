/* Two production-protocol clients over the configured real Supabase Realtime service.
   Renderer facades are used: this verifies transport/state, not browser or GPU rendering. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import {makeContext} from './game23-systems.mjs';

const configScope={window:{}};
vm.runInNewContext(await readFile(new URL('../supabase-config.js',import.meta.url),'utf8'),configScope);
const cfg=configScope.window.SUPABASE_CONFIG;
assert.ok(cfg?.enabled&&cfg.url&&cfg.publishableKey,'configured public game backend required');
const response=await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0',{signal:AbortSignal.timeout(25000)});
assert.ok(response.ok,'pinned public client must load');
const vendor={module:{exports:{}},exports:{},console,require:createRequire(import.meta.url),process,Buffer,setTimeout,clearTimeout,setInterval,clearInterval,fetch,WebSocket,Headers,Request,Response,URL,AbortController,TextEncoder,TextDecoder,crypto:webcrypto};
vendor.exports=vendor.module.exports;
vm.runInNewContext(await response.text(),vendor,{filename:'supabase-js-2.115.0.js'});
const {createClient}=vendor.supabase||vendor.module.exports;assert.equal(typeof createClient,'function');
const realClients=[];
function participant(id){const p=makeContext(id),client=createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});realClients.push(client);p.context.backend=client;p.context.performance.now=()=>performance.now();return p;}
async function waitFor(check,label,ms=25000){const until=Date.now()+ms;while(!check()){if(Date.now()>until)throw new Error(`Timed out: ${label}`);await new Promise(r=>setTimeout(r,60));}}
const room='Q'+webcrypto.randomUUID().replaceAll('-','').slice(0,5).toUpperCase();
const host=participant('qa-host-'+room);let guest=participant('qa-guest-'+room);let loop;
try{
  await host.run(`connect('host','${room}')`);await guest.run(`connect('guest','${room}')`);
  await waitFor(()=>host.facts.partnerReady&&guest.facts.partnerReady,'real presence and host admission');
  console.log('LIVE: both clients admitted');
  host.run("ops.ready=true;send('ready',{ready:true,weapon:'rifle'});");guest.run("ops.ready=true;ops.weapon='marksman';send('ready',{ready:true,weapon:'marksman'});");
  await waitFor(()=>host.facts.peerReady&&guest.facts.peerReady,'mutual readiness');
  loop=setInterval(()=>{host.run('hostWorldStep(.04);networkTick(performance.now());');guest.run('networkTick(performance.now());');},40);
  host.run('resetMission()');await waitFor(()=>guest.facts.running,'live initial snapshot');
  console.log('LIVE: readiness and initial snapshot synchronized');
  assert.equal(host.facts.run,guest.facts.run);assert.equal(host.facts.area,guest.facts.area);
  host.run("{const p=state.players.get(ops.peerId),e=state.enemies.get('z0');e.x=p.x;e.z=p.z-12;}");
  guest.run('shoot()');await waitFor(()=>host.facts.enemies.find(e=>e.id==='z0')?.dead,'authoritative live guest shot');
  await waitFor(()=>guest.facts.enemies.find(e=>e.id==='z0')?.dead,'live enemy state acknowledgement');
  console.log('LIVE: guest shot and enemy defeat synchronized');
  const oldRun=host.facts.run,kills=host.facts.stats.kills;
  const oldGuest=guest;await oldGuest.context.state.channel.unsubscribe();
  await waitFor(()=>host.facts.lost,'disconnect pause');
  guest=participant('qa-guest-'+room);await guest.run(`connect('guest','${room}')`);
  await waitFor(()=>guest.facts.running&&!host.facts.lost&&host.facts.partnerReady,'rejoin from a fresh client instance');
  assert.equal(guest.facts.run,oldRun);assert.equal(guest.facts.stats.kills,kills,'rejoin preserves kills');
  console.log('LIVE: disconnected client rejoined with state preserved');
  host.run('opsSetPause(true)');await waitFor(()=>guest.facts.paused,'shared pause');
  const stopped=host.facts.time;await new Promise(r=>setTimeout(r,400));assert.equal(host.facts.time,stopped);
  host.run('opsSetPause(false)');await waitFor(()=>!guest.facts.paused,'shared resume');
  host.run("for(const o of ops.objectives)o.done=true;for(const p of state.players.values())Object.assign(p,{x:state.goal.x,z:state.goal.z,lives:3});state.bossGate=null;goalCheck();resetMission();");
  console.log('LIVE: transition diagnostics',JSON.stringify({host:host.run('({area:state.area,running:state.running,paused:ops.paused,lost:ops.lost,action:ops.action,partner:state.partnerReady,valid:OPS.validSnapshot(opsSnapshot()),players:state.players.size})'),guest:guest.run('({area:state.area,running:state.running,epoch:ops.epoch})')}));
  await waitFor(()=>guest.facts.area===1&&guest.facts.running,'live chapter transition');
  console.log(JSON.stringify({result:'PASS',transport:'real Supabase Realtime',clients:2,checks:['presence','ready','start','guest shot','shared enemy state','disconnect freeze','fresh-client rejoin','shared pause/resume','chapter transition'],renderer:'facade; browser visual QA not included'}));
}finally{
  clearInterval(loop);for(const c of realClients)await c.removeAllChannels();
}
