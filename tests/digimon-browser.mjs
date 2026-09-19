import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const base=process.env.DIGIMON_BASE_URL||'http://127.0.0.1:4173';
await mkdir('test-output/digimon',{recursive:true});
try{
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:393,height:852}],['landscape',{width:852,height:393}]]){
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/digimon-card/');await page.getByRole('button',{name:'CPUと対戦 →',exact:true}).waitFor();
  await page.locator('.hero-card').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.complete?null:new Promise(r=>{i.onload=r;i.onerror=r}))));
  assert(await page.locator('.hero-card').evaluateAll(imgs=>imgs.every(i=>i.naturalWidth>0)),'starter art must load');
  assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=viewport.width+1,'home must not overflow');
  await page.screenshot({path:`test-output/digimon/${name}-home.png`,fullPage:true});
  await page.getByRole('button',{name:'CPUと対戦 →',exact:true}).click();
  await page.getByRole('button',{name:'この手札で始める',exact:true}).waitFor({timeout:10000});await page.getByRole('button',{name:'この手札で始める',exact:true}).click();
  await page.locator('.hand .board-card').first().waitFor();
  await page.locator('.hand .board-card').first().click();
  await page.getByRole('button',{name:'カード詳細 ↗',exact:true}).click();assert(await page.locator('dialog').isVisible());await page.getByRole('button',{name:'閉じる',exact:true}).click();
  await page.screenshot({path:`test-output/digimon/${name}-battle.png`,fullPage:true});
  assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=viewport.width+1,'battle must not overflow');
  await page.getByRole('button',{name:'メニュー',exact:true}).click();await page.getByRole('button',{name:'カード図鑑',exact:true}).click();
  await page.getByRole('searchbox').waitFor({timeout:30000});await page.getByRole('searchbox').fill('ST1-10');await page.locator('.catalog-card').first().click();
  assert((await page.locator('dialog').innerText()).includes('Lv.5 から 2'),'correct Phoenixmon evolution condition');
  await page.getByRole('button',{name:'閉じる',exact:true}).click();
  assert.deepEqual(errors,[],name+' runtime errors');await context.close();console.log('PASS '+name+' lobby, duel selection, art, catalogue, detail, viewport');
 }
 const page=await browser.newPage();await page.goto(base+'/digimon-card/');await page.getByRole('button',{name:'２人で対戦 →',exact:true}).click();
 assert.equal(await page.locator('.hand .board-card').count(),0,'hotseat hand hidden from DOM until reveal');await page.getByRole('button',{name:'手札を表示して続ける →',exact:true}).click();
 assert.equal(await page.locator('.hand .board-card').count(),5);await page.getByRole('button',{name:'この手札で始める',exact:true}).click();
 assert.equal(await page.locator('.hand .board-card').count(),0,'next player hand hidden');await page.getByRole('button',{name:'手札を表示して続ける →',exact:true}).click();assert.equal(await page.locator('.hand .board-card').count(),5);
 console.log('PASS hotseat hand privacy and turn handoff');
 const hostContext=await browser.newContext(),guestContext=await browser.newContext();
 const host=await hostContext.newPage(),guest=await guestContext.newPage();
 try{
  await host.goto(base+'/digimon-card/');await host.getByRole('button',{name:'部屋を作成・参加 →',exact:true}).click();await host.getByRole('button',{name:'部屋を作成',exact:true}).click();
  await host.getByText('相手の参加を待っています…',{exact:true}).waitFor({timeout:30000});const code=(await host.locator('.room-code').innerText()).trim();
  await guest.goto(base+'/digimon-card/');await guest.getByRole('button',{name:'部屋を作成・参加 →',exact:true}).click();await guest.getByRole('textbox',{name:'部屋コード',exact:true}).fill(code);await guest.getByRole('button',{name:'コードで参加',exact:true}).click();
  await host.locator('.table').waitFor({timeout:30000});await guest.locator('.table').waitFor({timeout:30000});
  for(const pg of [host,guest]){await pg.locator('.hand .board-card').first().click();await pg.getByRole('button',{name:'カード詳細 ↗',exact:true}).click();assert(await pg.locator('dialog').isVisible());await pg.getByRole('button',{name:'閉じる',exact:true}).click();}
  for(let i=0;i<2;i++){const current=await host.getByRole('button',{name:'この手札で始める',exact:true}).count()?host:guest;await current.getByRole('button',{name:'この手札で始める',exact:true}).click();await current.waitForTimeout(1000);}
  const active=await host.getByRole('button',{name:'デジタマを孵化',exact:true}).count()?host:guest;await active.getByRole('button',{name:'デジタマを孵化',exact:true}).click();await active.waitForTimeout(1000);
  assert.equal(await host.locator('.turn-banner').textContent(),await guest.locator('.turn-banner').textContent());
  await active.locator('.hand .playable').first().click();await active.locator('.action-list button').first().click();await active.waitForTimeout(1000);
  assert.equal(await host.locator('.logs').innerText(),await guest.locator('.logs').innerText(),'both clients receive same public battle log');
  await host.screenshot({path:'test-output/digimon/online-host.png',fullPage:true});await guest.screenshot({path:'test-output/digimon/online-guest.png',fullPage:true});
  console.log('PASS live online connection, guest selection, ordered mulligans, legal commands and state synchronization');
 }finally{await hostContext.close();await guestContext.close();}

}finally{await browser.close();}
