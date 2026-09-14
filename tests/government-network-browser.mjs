import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
const base=process.env.GOVERNMENT_BASE_URL||'http://127.0.0.1:4173/';
await mkdir('test-output/government-network',{recursive:true});
const source=JSON.parse(await readFile('commons/government-network/agencies.json','utf8'));
const recordSource=JSON.parse(await readFile('commons/reemployment-network/records.json','utf8'));
const recordIds=recordSource.records.map(r=>String(r.id));
const browser=await chromium.launch({headless:true});
const errors=[];
async function assertGraphFits(p,label){
 const graph=await p.locator('#graph').boundingBox(),world=await p.locator('#world').boundingBox();
 assert(graph&&world&&world.width>0&&world.height>0,`${label}: graph has visible content`);
 assert(world.x>=graph.x-2&&world.y>=graph.y-2&&world.x+world.width<=graph.x+graph.width+2&&world.y+world.height<=graph.y+graph.height+2,`${label}: the entire graph fits its viewport (${JSON.stringify({graph,world})})`);
}
async function assertAllRecords(p){
 const renderedIds=await p.locator('.node').evaluateAll(nodes=>nodes.map(n=>n.dataset.id));
 const rendered=new Set(renderedIds);
 assert.equal(recordIds.filter(id=>rendered.has(id)).length,1753,'Every public record has a person node in the same diagram');
}
async function assertAllView(p,label){
 assert.equal(await p.locator('#kind').inputValue(),'all',`${label}: all categories are selected by default`);
 assert.equal(await p.locator('#page-size').inputValue(),'10000',`${label}: the whole diagram is the default`);
 assert.equal(await p.locator('#pagination').isVisible(),false,`${label}: no pagination in the whole diagram`);
 await assertGraphFits(p,label);
}
async function assertFocusedSelection(p,previousScale){
 assert.equal(await p.locator('.node.selected').count(),1);
 const node=await p.locator('.node.selected').boundingBox(),graph=await p.locator('#graph').boundingBox();
 assert(node&&graph&&node.height>=50,'List selection enlarges the corresponding node to readable size');
 assert(node.x>=graph.x-2&&node.y>=graph.y-2&&node.x+node.width<=graph.x+graph.width+2&&node.y+node.height<=graph.y+graph.height+2,'The selected node is inside the graph viewport');
 assert(await p.locator('#world').evaluate(el=>el.getScreenCTM().a)>previousScale,'List selection zooms in from the whole diagram');
}
try{
 const p=await browser.newPage({viewport:{width:1440,height:1000}});
 p.on('pageerror',e=>errors.push(e.message));
 await p.goto(new URL('commons/government-network/',base).href);
 await p.locator('#download:enabled').waitFor();
 assert.match(await p.locator('#result-count').innerText(),/148/);
 await assertAllView(p,'Government desktop');
 assert.equal(await p.locator('.node').count(),149);
 await p.screenshot({path:'test-output/government-network/government-desktop.png'});
 let wholeScale=await p.locator('#world').evaluate(el=>el.getScreenCTM().a);
 await p.getByRole('button',{name:'一覧',exact:true}).click();
 await p.locator('#table-view').getByRole('button',{name:'理化学研究所',exact:true}).click();
 await assertFocusedSelection(p,wholeScale);
 await p.selectOption('#kind','国立研究開発法人');
 assert.equal(await p.locator('#table-view tbody tr').count(),26);
 await p.fill('#search','理化学');
 await p.getByRole('button',{name:'理化学研究所の詳細',exact:true}).click();
 assert.match(await p.locator('#detail').innerText(),new RegExp(source.nodes.find(n=>n.name==='理化学研究所').corporateNumber));
 await p.getByRole('button',{name:'条件を戻す',exact:true}).click();
 await p.fill('#search','JAXA');
 await p.getByRole('button',{name:'宇宙航空研究開発機構の詳細',exact:true}).click();
 for(const name of ['文部科学省','総務省','経済産業省','内閣総理大臣'])assert((await p.locator('#detail').innerText()).includes(name));
 await p.goto(new URL('commons/reemployment-network/',base).href);await p.locator('#download:enabled').waitFor();
 assert.match(await p.locator('#result-count').innerText(),/1,753/);
 await assertAllView(p,'Reemployment desktop');await assertAllRecords(p);
 await p.screenshot({path:'test-output/government-network/reemployment-desktop.png'});
 wholeScale=await p.locator('#world').evaluate(el=>el.getScreenCTM().a);
 await p.getByRole('button',{name:'一覧',exact:true}).click();
 const selectedId=await p.locator('#table-view tbody button').nth(100).getAttribute('data-record');
 await p.locator('#table-view tbody button').nth(100).click();
 await assertFocusedSelection(p,wholeScale);
 assert.equal(await p.locator('.node.selected').getAttribute('data-id'),selectedId);
 assert.equal(await p.locator('#pagination').isVisible(),false);
 await p.locator('#fit').click();await assertGraphFits(p,'Reemployment after fit');
 await p.selectOption('#page-size','8');
 assert.equal(await p.locator('#pagination').isVisible(),true);
 assert.equal(await p.locator('#page-label').innerText(),'1 / 220');
 await p.getByRole('button',{name:'次のページ',exact:true}).click();
 assert.equal(await p.locator('#page-label').innerText(),'2 / 220');
 await p.getByRole('button',{name:'一覧',exact:true}).click();
 await p.locator('#table-view tbody button').nth(100).click();
 assert.equal(await p.locator('.node.selected').getAttribute('data-id'),selectedId);
 assert.equal(await p.locator('#page-label').innerText(),'13 / 220');
 await p.selectOption('#page-size','24');
 assert.equal(await p.locator('#page-label').innerText(),'1 / 74');
 await p.getByRole('button',{name:'次のページ',exact:true}).click();
 assert.equal(await p.locator('#page-label').innerText(),'2 / 74');
 await p.selectOption('#page-size','10000');await assertAllView(p,'Reemployment restored whole diagram');await assertAllRecords(p);
 await p.selectOption('#kind','general');assert.equal(await p.locator('#table-view tbody tr').count(),1733);
 await p.selectOption('#kind','special');assert.equal(await p.locator('#table-view tbody tr').count(),20);
 await p.selectOption('#kind','all');await p.fill('#search','山田滝雄');assert.equal(await p.locator('#table-view tbody tr').count(),2);
 await p.getByRole('button',{name:'一覧',exact:true}).click();await p.locator('#table-view tbody button').first().click();
 assert.match((await p.locator('#detail').innerText()).replace(/\s/g,''),/山田滝雄/);assert.equal(await p.locator('.node.selected').count(),1);
 assert.match(await p.locator('#detail a.source').first().getAttribute('href'),/^https:\/\/www\.mofa\.go\.jp\/.*#page=/);
 await p.getByRole('button',{name:'条件を戻す',exact:true}).click();await assertAllView(p,'Reemployment reset');
 await p.selectOption('#kind','career');await p.locator('#graph-empty').waitFor({state:'visible'});assert.match(await p.locator('#graph-empty').innerText(),/採用区分/);
 await p.setViewportSize({width:393,height:852});
 await p.goto(new URL('commons/government-network/',base).href);await p.locator('#download:enabled').waitFor();
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await assertAllView(p,'Government mobile');assert.equal(await p.locator('.node').count(),149);
 await p.screenshot({path:'test-output/government-network/government-mobile.png',fullPage:true});
 await p.selectOption('#page-size','8');
 assert.equal(await p.locator('#pagination').isVisible(),true);
 assert((await p.locator('.node').first().boundingBox()).height>=55,'Optional paged mobile view keeps node labels readable');
 await p.goto(new URL('commons/reemployment-network/',base).href);await p.locator('#download:enabled').waitFor();
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 await assertAllView(p,'Reemployment mobile');await assertAllRecords(p);
 await p.screenshot({path:'test-output/government-network/reemployment-mobile.png',fullPage:true});
 wholeScale=await p.locator('#world').evaluate(el=>el.getScreenCTM().a);
 await p.getByRole('button',{name:'一覧',exact:true}).click();await p.locator('#table-view tbody button').nth(100).click();
 await assertFocusedSelection(p,wholeScale);
 assert.deepEqual(errors,[]);
 console.log('PASS: both complete diagrams fit desktop/mobile by default; 149 agency nodes and 1753 person records, list-to-node focus, optional pagination, corporation IDs, joint supervision, source links and career disclosure.');
}finally{await browser.close();}
