// Production-artifact coverage for every retained collection entry and removed URL.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,devices} from 'playwright';
import {retained2D,commons31,removedEntries} from './release-scope.mjs';
const base=new URL(process.env.RETAINED_BASE_URL||'http://127.0.0.1:4173/');
const output='test-output/retained';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const checks=[];
try{
 for(const profile of [{name:'desktop',options:{viewport:{width:1365,height:900}}},{name:'mobile',options:devices['Pixel 7']}]){
  const context=await browser.newContext(profile.options);
  for(const route of ['games.html','commons/',...retained2D.map(path=>`${path}/`)]){
   const page=await context.newPage(),errors=[],missing=[];
   page.on('pageerror',error=>errors.push(error.message));
   page.on('response',response=>{if(new URL(response.url()).origin===base.origin&&response.status()>=400)missing.push(`${response.status()} ${response.url()}`);});
   const response=await page.goto(new URL(route,base).href,{waitUntil:'load',timeout:45000});
   assert(response?.ok(),`${profile.name} ${route}: document HTTP ${response?.status()}`);
   if(route==='commons/'){
    await page.waitForFunction(()=>document.querySelectorAll('.site-card > a').length===31);
    const links=await page.locator('.site-card > a').evaluateAll(anchors=>anchors.map(anchor=>new URL(anchor.href).pathname).sort());
    assert.deepEqual(links,commons31.map(path=>`/commons/${path}/`).sort(),`${profile.name}: all 31 Commons tools must appear in the actual hub`);
   }
   await page.waitForTimeout(1000);
   assert((await page.title()).trim(),`${route}: page title missing`);
   assert((await page.locator('body').innerText()).trim().length>40,`${route}: page content missing`);
   assert.deepEqual(missing,[],`${profile.name} ${route}: missing same-origin assets`);
   assert.deepEqual(errors,[],`${profile.name} ${route}: JavaScript errors`);
   if(['games.html','commons/'].includes(route))await page.screenshot({path:`${output}/${profile.name}-${route==='commons/'?'commons':'games'}.png`,fullPage:true});
   checks.push({profile:profile.name,route,status:response.status()});
   await page.close();
  }
  if(profile.name==='desktop')for(const route of removedEntries){const response=await context.request.get(new URL(route,base).href);assert.equal(response.status(),404,`Removed URL must return 404: ${route}`);}
  await context.close();
 }
 await writeFile(`${output}/results.json`,JSON.stringify({passed:true,checks,removed404:removedEntries.length},null,2));
 console.log(`Retained browser coverage: ${checks.length} desktop/mobile pages; ${removedEntries.length} removed URLs return 404.`);
}finally{await browser.close();}
