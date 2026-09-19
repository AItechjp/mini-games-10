import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const api='https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-realtime/directory';
const response=await fetch(api,{signal:AbortSignal.timeout(35000)});assert.ok(response.ok,'live collector responds');
const data=await response.json();assert.ok(data.stores.length>100,'actual verified data is available');assert.ok(data.coverage.sitesConfigured>=20);
const browser=await chromium.launch({headless:true});const checks=[];await mkdir('test-output/commons-realtime',{recursive:true});
try{
 for(const viewport of [{width:1280,height:900},{width:393,height:851}]){
  const context=await browser.newContext({viewport}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/functions/v1/commons-realtime/directory',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)}));
  for(const path of ['ramen','sauna','local/supermarkets','local/saunas','local/sento','local/fishmongers']){
   await page.goto('http://127.0.0.1:4173/commons/'+path+'/');
   await page.locator('.verified-source-strip b').filter({hasText:path==='sauna'?/収集元を統合/:/\d+サイト/}).waitFor();
   await page.getByRole('group',{name:'営業時間で絞り込み'}).getByRole('button',{name:path==='sauna'?/掲載全件/:/確認できた全件/}).first().click();
   assert.ok(await page.locator('.verified-list article').count()>0,path+' has verified results');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path+' fits viewport');
   assert.equal(await page.locator('.verified-list').getByText('要確認',{exact:true}).count(),0);
   await page.getByRole('textbox',{name:'店名・住所を検索'}).fill('存在しないテスト施設-zzz');assert.equal(await page.locator('.verified-list article').count(),0);await page.getByRole('textbox',{name:'店名・住所を検索'}).fill('');
   if(path==='sauna')await page.screenshot({path:`test-output/commons-realtime/sauna-${viewport.width}.png`,fullPage:true});
   checks.push(path+' '+viewport.width);
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile('test-output/commons-realtime/results.json',JSON.stringify({passed:true,checks},null,2));console.log('Commons real data, six directories, filters, provenance, desktop and mobile verified.');
}finally{await browser.close()}
