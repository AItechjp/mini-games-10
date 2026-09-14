import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.OFFICIAL_INFO_BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true});
try{
 for(const viewport of [{width:1440,height:980},{width:393,height:851}]){
  const context=await browser.newContext({viewport,acceptDownloads:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['law','documents']){
   await page.goto(new URL('commons/'+route+'/',base).href);
   await page.getByRole('button',{name:'更新を確認',exact:true}).waitFor();
   await page.locator('#results .record').first().waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'page must fit '+viewport.width);
   assert.ok(await page.locator('#results .record').count()>0);
   assert.equal(await page.locator('#results a[target="_blank"]').evaluateAll(nodes=>nodes.every(a=>/^https?:/.test(a.href)&&a.rel.includes('noopener'))),true);
   await page.getByRole('searchbox',{name:'キーワードで横断検索'}).fill('存在しない法令資料zzzzTEST');
   await page.getByRole('heading',{name:'該当する情報はありません'}).waitFor();
   assert.equal(await page.getByRole('button',{name:'絞り込み結果をCSV保存'}).isDisabled(),true);
   await page.getByRole('button',{name:'解除',exact:true}).click();
   await page.locator('#results .record').first().waitFor();
   if(route==='documents'){
    await page.getByRole('button',{name:'機関一覧',exact:true}).click();
    assert.ok(Number((await page.locator('#count').innerText()).match(/^[\d,]+/)[0].replaceAll(',',''))>=200);
    await page.getByRole('searchbox',{name:'キーワードで横断検索'}).fill('岐阜');
    assert.ok(await page.locator('#results .record').count()>0);
    await page.getByRole('button',{name:'解除',exact:true}).click();
   }else{
    await page.getByRole('button',{name:'国会',exact:true}).click();
    assert.match(await page.locator('#results').innerText(),/開催/);
    await page.getByRole('button',{name:'法令・改正',exact:true}).click();
    assert.match(await page.locator('#results').innerText(),/公布|施行/);
   }
   await page.getByRole('button',{name:'収集状況',exact:true}).first().click();
   await page.locator('#results .record').first().waitFor();
   assert.match(await page.locator('#results').innerText(),/取得|一部/);
   const pending=page.waitForEvent('download');
   await page.getByRole('button',{name:'絞り込み結果をCSV保存'}).click();
   const download=await pending;assert.ok(download.suggestedFilename().endsWith('.csv'));
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('Official information: desktop/mobile layout, real records, search, source status, dates and CSV passed');
}finally{await browser.close()}
