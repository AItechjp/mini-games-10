import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {APPS,FEATURES} from '../app-guide/catalog.mjs';
const base=process.env.APP_GUIDE_BASE_URL||'http://127.0.0.1:4173/';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const open=async()=>{await page.getByRole('button',{name:'アプリメニューを開く',exact:true}).click();await page.locator('#aitech-app-guide').getByRole('dialog').waitFor({state:'visible'});};
const pane=()=>page.locator('#aitech-app-guide');
const saved=async()=>page.waitForFunction(()=>document.querySelector('#aitech-app-guide')?.shadowRoot?.querySelector('#note-status')?.textContent.startsWith('保存済み'));
try{
 await page.goto(base+'trump/?game=memory',{waitUntil:'domcontentloaded'});await page.waitForSelector('#memory-board .card');await open();
 assert.equal(await page.locator('#pause').textContent(),'再開する');
 await pane().getByRole('tab',{name:'個人メモ',exact:true}).click();
 await pane().getByRole('textbox',{name:'個人メモ',exact:true}).fill('最初のメモ <script>これは文字</script>');await saved();
 await pane().getByRole('textbox',{name:'個人メモ',exact:true}).fill('2番目のメモ');await saved();
 await pane().getByRole('button',{name:'前のメモへ戻す',exact:true}).click();await saved();assert.equal(await pane().getByRole('textbox',{name:'個人メモ',exact:true}).inputValue(),'最初のメモ <script>これは文字</script>');
 const exported=page.waitForEvent('download');await pane().getByRole('button',{name:'メモを書き出す',exact:true}).click();const download=await exported;const backup=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(backup.appId,'memory');assert.equal(backup.text,'最初のメモ <script>これは文字</script>');assert.deepEqual(Object.keys(backup).sort(),['appId','appName','exportedAt','format','text']);
 const invalid={...backup,appId:'speed'};await pane().locator('#note-file').setInputFiles({name:'wrong-app.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await pane().getByRole('alert').filter({hasText:'このアプリ用のメモファイルではありません'}).waitFor();assert.equal(await pane().getByRole('textbox',{name:'個人メモ',exact:true}).inputValue(),backup.text);
 await pane().locator('#note-file').setInputFiles({name:'memory-notes.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...backup,text:'読み込みから追記'}))});await pane().getByRole('button',{name:'この内容を追記',exact:true}).click();await saved();assert((await pane().getByRole('textbox',{name:'個人メモ',exact:true}).inputValue()).endsWith('読み込みから追記'));
 await pane().getByRole('tab',{name:'使い方',exact:true}).click();await pane().getByRole('searchbox').fill('CPU　裏');assert((await pane().locator('#help-results').textContent()).includes('CPU'));await pane().getByRole('button',{name:'ヘルプ検索をクリア'}).click();
 await pane().getByRole('button',{name:'神経衰弱をお気に入りに追加',exact:true}).click();await pane().getByRole('tab',{name:'アプリを探す',exact:true}).click();await pane().getByRole('searchbox').fill('ｽﾋﾟｰﾄﾞ');assert.equal(await pane().locator('#app-results .app-card').count(),1);await pane().getByRole('button',{name:'アプリ検索をクリア'}).click();await pane().getByRole('button',{name:'お気に入り',exact:true}).click();assert((await pane().locator('#app-results').textContent()).includes('神経衰弱'));
 await pane().getByRole('tab',{name:'表示設定',exact:true}).click();await pane().getByRole('combobox',{name:'説明パネルの文字サイズ'}).selectOption('larger');await pane().locator('#contrast').click();await pane().getByRole('combobox',{name:'装飾アニメーション'}).selectOption('reduce');assert.equal(await pane().getAttribute('data-contrast'),'');assert.equal(await page.locator('html').getAttribute('data-aitech-motion'),'reduce');
 assert(await pane().getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+2));await pane().getByRole('button',{name:'表示設定を標準に戻す'}).click();await pane().getByRole('button',{name:'アプリメニューを閉じる'}).click();
 await page.keyboard.press('Alt+Shift+M');await pane().getByRole('dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');await pane().getByRole('dialog').waitFor({state:'hidden'});
 await page.goto(base+'quick-hop/',{waitUntil:'domcontentloaded'});await page.locator('#start').click();await page.waitForFunction(()=>Number(document.querySelector('#time').textContent)>0);await open();const time=await page.locator('#time').textContent();await pane().getByRole('tab',{name:'個人メモ',exact:true}).click();await pane().getByRole('textbox',{name:'個人メモ',exact:true}).pressSequentially('R P WASD');await page.waitForTimeout(450);assert.equal(await page.locator('#time').textContent(),time);assert.equal(await page.locator('#pause').textContent(),'再開');await pane().getByRole('button',{name:'アプリメニューを閉じる'}).click();
 await page.goto(base+'board-games/?game=gomoku&mode=solo',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'アプリメニューを開く',exact:true}).waitFor({state:'visible'});await page.locator('#board [data-index="112"]').click();await open();const stones=await page.locator('#board .stone').count();assert.equal(stones,1);await page.waitForTimeout(850);assert.equal(await page.locator('#board .stone').count(),stones);await pane().getByRole('button',{name:'アプリメニューを閉じる'}).click();await page.waitForFunction(()=>document.querySelectorAll('#board .stone').length===2);
 let integrated=0;
 for(const app of APPS.filter(a=>a.path.startsWith('/'))){
  await page.goto(new URL(app.path.slice(1),base).href,{waitUntil:'domcontentloaded'});await page.waitForFunction(id=>document.querySelector('#aitech-app-guide')?.dataset.app===id,app.id);await page.getByRole('button',{name:'アプリメニューを開く',exact:true}).waitFor({state:'visible'});
  assert.deepEqual((await pane().getAttribute('data-features')).split(' '),FEATURES.map(([id])=>id));integrated++;
 }
 assert.equal(integrated,32);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,integratedLocalApps:integrated,sharedFeatures:20,mobileLayout:true,notesRoundTrip:true,gameInputIsolation:true,boardCpuPause:true}));
}finally{await context.close();await browser.close();}
