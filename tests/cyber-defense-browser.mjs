import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
const {chromium}=await import(process.env.AEGIS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.AEGIS_SITE_ROOT||new URL('../',import.meta.url).pathname;
const server=process.env.AEGIS_BASE_URL?null:createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root)){res.writeHead(403).end();return;}const bytes=await readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end();}});
if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=process.env.AEGIS_BASE_URL||`http://127.0.0.1:${server.address().port}/`;
const browser=await chromium.launch({headless:true});
const out=new URL('../test-output/aegis/',import.meta.url).pathname;await mkdir(out,{recursive:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://fonts.googleapis.com/**',route=>route.abort());
 await page.goto(base+'cyber-defense/');await page.getByRole('button',{name:'防衛を開始する'}).waitFor();
 assert.equal(await page.locator('.mission').count(),20);
 await page.screenshot({path:out+'desktop-lobby.png'});
 await page.getByRole('button',{name:'防衛を開始する'}).click();
 assert.equal(await page.locator('.player').count(),2);
 await page.getByRole('button',{name:/報告メールを隔離し/}).click();
 await page.getByRole('button',{name:'P1：対処を確定',exact:true}).click();
 assert.equal(await page.locator('.report').count(),0);
 await page.getByRole('button',{name:/追跡分析/}).click();
 await page.getByRole('button',{name:'P2：支援を確定',exact:true}).click();
 await page.getByRole('button',{name:'次の局面へ'}).waitFor();
 assert.match(await page.locator('.report').innerText(),/連携成功/);
 await page.getByRole('button',{name:'次の局面へ'}).click();
 await page.getByRole('button',{name:'一時停止',exact:true}).click();assert.equal(await page.locator('.pause-layer').count(),1);
 await page.getByRole('button',{name:'作戦を再開',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'途中の任務を再開'}).click();
 assert.match(await page.locator('.turn-number').innerText(),/02/);
 await page.screenshot({path:out+'desktop-operation.png'});
 for(const [width,height] of [[844,390],[740,360],[932,430],[1366,768],[390,844]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  const sizes=await page.evaluate(()=>({width:innerWidth,height:innerHeight,bodyWidth:document.body.scrollWidth,bodyHeight:document.body.scrollHeight,panels:[...document.querySelectorAll('.player')].filter(e=>getComputedStyle(e).display!=='none').map(e=>({client:e.clientHeight,scroll:e.scrollHeight,buttons:[...e.querySelectorAll('.lock-button')].map(b=>({top:b.getBoundingClientRect().top,bottom:b.getBoundingClientRect().bottom}))}))}));
  assert.ok(sizes.bodyWidth<=width+1,JSON.stringify(sizes));assert.ok(sizes.bodyHeight<=height+1,JSON.stringify(sizes));
  if(width>height){for(const p of sizes.panels){assert.ok(p.scroll<=p.client+2,`Panel needs scroll: ${width}x${height} `+JSON.stringify(sizes));for(const b of p.buttons)assert.ok(b.bottom<=height&&b.top>=0,JSON.stringify(sizes));}}
  await page.screenshot({path:out+`operation-${width}x${height}.png`});
 }
 await page.setViewportSize({width:740,height:360});
 if(await page.getByRole('button',{name:'P2へ →'}).isVisible()){await page.getByRole('button',{name:'P2へ →'}).click();assert.ok(await page.locator('.player-1').isVisible());}
 const solo=await browser.newPage({viewport:{width:932,height:430}});solo.on('pageerror',e=>errors.push(e.message));await solo.route('https://fonts.googleapis.com/**',route=>route.abort());await solo.goto(base+'cyber-defense/');
 await solo.getByRole('button',{name:'1人＋相棒CPU',exact:true}).click();await solo.getByRole('button',{name:'防衛を開始する'}).click();await solo.getByRole('button',{name:/報告メールを隔離し/}).click();await solo.getByRole('button',{name:'P1：対処を確定',exact:true}).click();await solo.getByRole('button',{name:'次の局面へ'}).waitFor();
 assert.match(await solo.locator('.report').innerText(),/連携成功/);
 assert.deepEqual(errors,[]);
 console.log('Browser: local cooperation, CPU, pause, saved progress, 5 viewports, no landscape panel overflow, no page errors passed.');
}finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
