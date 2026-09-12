import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=(process.env.GAME23_BASE_URL||'http://127.0.0.1:4173/').replace(/\/?$/,'/');
const output='test-output/game23-playability';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--ignore-gpu-blocklist','--enable-webgl','--use-angle=swiftshader']});
const errors=[],report={};
let check='initialization';
const checkpoint=name=>{check=name;console.log('GAME23 review:',name);};
const deadline=setTimeout(()=>{console.error('GAME23 review timed out at:',check);process.exit(1);},360000);deadline.unref();
// Test-only fixtures are appended to a routed response. No debug mutations are
// shipped in the game. All rendering, HUD and input handlers are production code.
const fixture=(await readFile(new URL('../game23-playability.js',import.meta.url),'utf8'))+`
let qaReloadFrame=false;const qaAnimate=cineAnimateWeapon;
cineAnimateWeapon=function(now,dt,t,at){return qaAnimate(now,dt,t,qaReloadFrame&&uxReloading?now-BlacksiteRules.WEAPONS[cineGun.userData.weaponId].reload*.45:at);};
window.__blacksiteQA={
  holdReload:hold=>{qaReloadFrame=hold;},
  pose:()=>({x:local.x,z:local.z,yaw:local.yaw,pitch:local.pitch}),
  arrange:()=>{
    hostWorldStep=()=>{};local.pitch=0;updateCamera();
    for(const e of state.enemies.values())e.dead=true;
    const enemies=[...state.enemies.values()].filter(e=>!e.boss).slice(0,4);
    enemies.forEach((e,i)=>{const side=(i-1.5)*2.2,d=10+i*1.8;
      Object.assign(e,{dead:false,hp:i===2?4:1,maxHp:i===2?8:1,type:i===2?'brute':'walker',cineDeathAt:0,cineHitAt:0,x:local.x+Math.cos(local.yaw)*side-Math.sin(local.yaw)*d,z:local.z-Math.sin(local.yaw)*side-Math.cos(local.yaw)*d,visualYaw:local.yaw+Math.PI});
    });return enemies.map(e=>e.id);
  },
  kill:id=>{const e=state.enemies.get(id);e.hp=0;e.dead=true;},
  equip:id=>{opsChooseWeapon.value=id;ops.weapon=id;const p=opsNowPlayer();p.weapon=id;p.ammo=BlacksiteRules.WEAPONS[id].magazine;cineMakeWeapon();uxUpdateAmmo();},
  weapon:()=>{let triangles=0,meshes=0;cineGun.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});return{id:cineGun.userData.weaponId,triangles,meshes,magazine:cineGun.userData.parts.magazine?.position.y||0};}
};`;
function captureErrors(page){page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|Report Only/.test(m.text()))errors.push(m.text());});}
async function open(context){
  context.setDefaultTimeout(15000);
  const page=await context.newPage();captureErrors(page);
  await page.route('**/game23-playability.js*',r=>r.fulfill({contentType:'text/javascript',body:fixture}));
  await page.goto(base+'game23.html?mode=solo',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.blacksitePlayability&&!document.querySelector('#game23-start')?.disabled,null,{timeout:45000});return page;
}
async function swipe(cdp,x,y,dy,hold=0){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+dy*i/8}]});
  if(hold)await new Promise(r=>setTimeout(r,hold));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
try{
  const mobile=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36'});
  const p=await open(mobile),cdp=await mobile.newCDPSession(p);
  checkpoint('mobile startup');
  await p.locator('#game23-start').tap();await p.waitForFunction(()=>window.blacksiteSystems.running);
  assert.equal(await p.evaluate(()=>document.body.classList.contains('game23-focus-mode')),false,'Starting must keep the page scrollable');
  await p.locator('#game23-frame').scrollIntoViewIfNeeded();
  const frame=await p.locator('#game23-frame').boundingBox();
  await p.screenshot({path:output+'/mobile-before-input.png'});
  const stick=await p.locator('#touch-stick').boundingBox(),before=await p.evaluate(()=>window.__blacksiteQA.pose());
  await swipe(cdp,stick.x+stick.width/2,stick.y+stick.height/2,-35,350);
  const moved=await p.evaluate(()=>window.__blacksiteQA.pose());assert.ok(Math.hypot(moved.x-before.x,moved.z-before.z)>.15,'Inline joystick must move the player');
  const lookPoint=await p.evaluate(()=>{const look=document.querySelector('#touch-right'),r=look.getBoundingClientRect();for(let y=r.top+160;y<Math.min(innerHeight-50,r.bottom-40);y+=30)for(let x=r.left+20;x<r.right-30;x+=25)if(document.elementFromPoint(x,y)===look)return{x,y};return null;});
  assert.ok(lookPoint,'An unobstructed look area must be available');
  const lookBefore=moved.pitch;await swipe(cdp,lookPoint.x,lookPoint.y,-35,100);
  assert.notEqual((await p.evaluate(()=>window.__blacksiteQA.pose())).pitch,lookBefore,'Inline look input must turn the camera');
  checkpoint('mobile movement and look');
  const ids=await p.evaluate(()=>window.__blacksiteQA.arrange());
  await p.waitForFunction(()=>window.blacksitePlayability.enemyLife.full===3&&window.blacksitePlayability.enemyLife.damaged===1,null,{timeout:10000});
  checkpoint('full and damaged enemy life bars');
  await p.screenshot({path:output+'/mobile-inline-hp.png'});
  const ammo=await p.evaluate(()=>window.blacksiteSystems.players[0].ammo);
  await p.locator('#touch-fire').tap();await p.waitForFunction(a=>window.blacksiteSystems.players[0].ammo<a,ammo);
  // Freeze the middle of the actual reload animation for a deterministic image
  // on software-rendered CI, while the real touch button still starts the reload.
  await p.evaluate(()=>window.__blacksiteQA.holdReload(true));
  await p.locator('.ux-reload').tap();await p.waitForFunction(()=>window.blacksitePlayability.weapon.magazineOffset<-.03,null,{timeout:5000});
  report.mobileReload=await p.evaluate(()=>window.blacksitePlayability.weapon);
  checkpoint('mobile fire and reload');
  await p.screenshot({path:output+'/mobile-reload.png'});
  await p.evaluate(()=>window.__blacksiteQA.holdReload(false));
  await p.evaluate(id=>window.__blacksiteQA.kill(id),ids[0]);
  await p.waitForFunction(()=>window.blacksitePlayability.enemyLife.visible===3,null,{timeout:5000});
  const scrollBefore=await p.evaluate(()=>scrollY),rail=await p.locator('.game23-scroll-rail').boundingBox();
  await swipe(cdp,rail.x+rail.width/2,Math.min(rail.y+rail.height-15,850),-270);
  await p.waitForFunction(y=>scrollY>y+80,scrollBefore,{timeout:5000});
  checkpoint('native touch page scrolling');
  report.mobileScroll=await p.evaluate(()=>({scrollY,width:innerWidth,documentWidth:document.documentElement.scrollWidth,life:window.blacksitePlayability.enemyLife}));
  assert.ok(report.mobileScroll.documentWidth<=report.mobileScroll.width,'Portrait page must not overflow horizontally');
  await p.locator('.game23-page-nav a').tap();await p.waitForFunction(()=>window.blacksiteSystems.paused);
  await p.screenshot({path:output+'/mobile-page-guide.png'});
  await mobile.close();
  checkpoint('desktop startup');

  const desktop=await browser.newContext({viewport:{width:1440,height:1080},deviceScaleFactor:1});
  const d=await open(desktop);await d.locator('#game23-start').click();await d.waitForFunction(()=>window.blacksiteSystems.running);await d.locator('#game23-frame').scrollIntoViewIfNeeded();
  await d.evaluate(()=>window.__blacksiteQA.arrange());
  await d.waitForFunction(()=>window.blacksitePlayability.enemyLife.visible===4);
  report.weapons=[];
  for(const id of ['rifle','smg','marksman','carbine','machinegun','interceptor','revolver','scout','vanguard']){
    checkpoint('weapon '+id);
    await d.evaluate(id=>window.__blacksiteQA.equip(id),id);await d.waitForTimeout(180);
    const facts=await d.evaluate(()=>window.__blacksiteQA.weapon());assert.equal(facts.id,id);assert.ok(facts.triangles>3000&&facts.triangles<90000,JSON.stringify(facts));assert.ok(facts.meshes<25,JSON.stringify(facts));report.weapons.push(facts);
    await d.locator('#game23-frame').screenshot({path:output+'/weapon-'+id+'.png'});
  }
  assert.equal(new Set(report.weapons.map(x=>x.triangles)).size,9,'All nine loadouts need their own geometry');
  await d.locator('#game23-canvas').focus();const ammoBefore=await d.evaluate(()=>window.blacksiteSystems.players[0].ammo);await d.keyboard.press('Space');
  assert.ok((await d.evaluate(()=>window.blacksiteSystems.players[0].ammo))<ammoBefore,'PC Space fires while the game is focused');
  await d.locator('#outbreak-fullscreen').click();await d.waitForFunction(()=>document.body.classList.contains('game23-focus-mode'));
  await d.locator('.game23-exit').click();await d.waitForFunction(()=>!document.body.classList.contains('game23-focus-mode'));
  const y=await d.evaluate(()=>scrollY);await d.mouse.wheel(0,600);await d.waitForFunction(before=>scrollY>before+50,y);
  await d.screenshot({path:output+'/desktop-page-scroll.png'});report.desktopScroll=await d.evaluate(()=>scrollY);
  assert.deepEqual(errors,[]);report.errors=errors;console.log('GAME23 playability PASS',JSON.stringify(report));
}finally{await writeFile(output+'/report.json',JSON.stringify({...report,check,errors},null,2));await browser.close();clearTimeout(deadline);}
