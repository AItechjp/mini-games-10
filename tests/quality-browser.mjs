// Exercises the real distribution served by the existing release workflow.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.QUALITY_BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},permissions:['camera'],acceptDownloads:true});
  const realtime=await fetch('https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-realtime/directory',{signal:AbortSignal.timeout(35000)});
  assert.ok(realtime.ok,'Verified directory data is available for comparison');
  const directoryData=await realtime.json();assert.ok(directoryData.stores.length>0);
  await context.route('**/functions/v1/commons-realtime/directory',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(directoryData)}));
  const page=await context.newPage();
  const open=async(target=page)=>{await target.getByRole('button',{name:'アプリメニューを開く',exact:true}).click();await target.getByRole('button',{name:'画面設定・記録・比較を開く',exact:true}).click();await target.locator('#aitech-assist-dialog').waitFor({state:'visible'});};
  await page.goto(new URL('trump/?game=memory',base).href);
  await open();await page.getByRole('button',{name:'現在の表示を記録',exact:true}).click();assert.match(await page.locator('.quality-history').innerText(),/日本時間/);
  await page.getByLabel('振り返りメモ',{exact:true}).fill('最初の2枚の位置を覚える');
  await page.getByText('読みやすさ・押しやすさ',{exact:true}).click();
  await page.getByLabel('文字サイズ',{exact:true}).selectOption('largest');
  assert.equal(await page.locator('html').getAttribute('data-quality-text'),'largest');
  await page.getByLabel('操作ボタンを大きく',{exact:true}).check();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'テキスト保存',exact:true}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/^aitech-memory-.*\.txt$/);
  await page.getByRole('button',{name:'閉じる',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'アプリメニューを開く',exact:true}).evaluate(el=>el===el.getRootNode().activeElement),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'The mobile game and new controls must fit the viewport');
  await page.reload();assert.equal(await page.locator('html[data-quality-ready]').getAttribute('data-quality-text'),'largest');
  const second=await context.newPage();await second.goto(new URL('trump/?game=speed',base).href);await open(second);await second.getByText('読みやすさ・押しやすさ',{exact:true}).click();await second.getByLabel('文字サイズ',{exact:true}).selectOption('normal');
  await page.waitForFunction(()=>document.documentElement.dataset.qualityText==='normal');await second.close();
  await page.goto(new URL('commons/sauna/',base).href);await page.getByRole('group',{name:'営業時間で絞り込み'}).getByRole('button',{name:/確認できた全件/}).click();await page.locator('.verified-list article').first().waitFor();await open();
  const options=await page.getByLabel('比較に追加する候補',{exact:true}).locator('option').count();assert.ok(options>1);
  await page.getByLabel('比較に追加する候補',{exact:true}).selectOption('0');await page.getByRole('button',{name:'比較に追加',exact:true}).click();assert.equal(await page.locator('.quality-compare tbody tr').count(),1);
  await page.getByRole('button',{name:'比較に追加',exact:true}).click();assert.equal(await page.locator('.quality-compare tbody tr').count(),1);
  await page.locator('.quality-compare button').click();assert.equal(await page.locator('.quality-compare tbody tr').count(),0);
  await page.goto(new URL('commons/camera/',base).href);await page.locator('#start-button').click();await page.waitForFunction(()=>!document.getElementById('capture-button').disabled);
  await page.locator('#capture-delay').selectOption('3');await page.locator('#camera-grid').check();assert.match(await page.locator('#viewfinder').getAttribute('class'),/show-thirds/);
  await page.locator('#capture-button').click();await page.locator('#capture-countdown').waitFor({state:'visible'});await page.locator('#cancel-countdown').click();assert.equal(await page.locator('#capture-countdown').isVisible(),false);
  await page.locator('#capture-button').click();await page.waitForFunction(()=>!!document.getElementById('thumbnail').getAttribute('src'),null,{timeout:10000});
  await page.locator('#stop-button').click();await context.close();
  console.log('Quality UI: mobile controls, record/export, preference restore and cross-tab sync, comparison, camera countdown/cancel/grid/capture passed.');
}finally{await browser.close();}
