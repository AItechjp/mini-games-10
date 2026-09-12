import { chromium } from 'playwright';

const root = (process.env.MEGA_BASE_URL || 'http://127.0.0.1:4173/').replace(/\/?$/, '/');
const full = process.env.MEGA_FULL !== '0';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
const errors = [];
page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
page.on('console', msg => {
  if (msg.type() !== 'error') return;
  const text = msg.text();
  // Browsers may surface harmless third-party/report-only CSP diagnostics as
  // console errors (for example Google frames injected by ad infrastructure).
  // They are not application JavaScript failures and must not block deploys.
  if (/\[Report Only\].*Content Security Policy/i.test(text)) return;
  errors.push(`console: ${text}`);
});

// Keep product smoke tests deterministic: third-party ad networks can return
// desktop-sized creatives to CI's desktop UA even when the viewport is mobile.
await page.route('https://adm.shinobi.jp/**', route => route.fulfill({
  status: 200,
  contentType: 'application/javascript; charset=utf-8',
  body: ''
}));

async function failIfErrors(where){
  if(errors.length) throw new Error(`${where}\n${errors.splice(0).join('\n')}`);
}

await page.goto(root + 'mega-arcade.html', {waitUntil:'networkidle'});
await page.waitForSelector('#gameGrid .game-card');
const total = await page.locator('#gameGrid .game-card').count();
if(total !== 320) throw new Error(`catalog count ${total}, expected 320`);
const stats = await page.evaluate(() => window.MEGA_ARCADE_STATS);
if(!stats || stats.total !== 320 || stats.mobile !== 100 || stats.card !== 100 || stats.board !== 100 || stats.playing !== 20 || stats.uniqueProfiles !== 320){
  throw new Error(`invalid stats ${JSON.stringify(stats)}`);
}
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if(overflow > 4) throw new Error(`mobile horizontal overflow ${overflow}px`);
await failIfErrors('initial load');

const expected = {mobile:100, card:100, board:100, playing:20};
for (const [cat,count] of Object.entries(expected)){
  await page.click(`[data-cat="${cat}"]`);
  await page.waitForFunction(n => document.querySelectorAll('#gameGrid .game-card').length === n, count);
  const actual = await page.locator('#gameGrid .game-card').count();
  if(actual !== count) throw new Error(`${cat} count ${actual}, expected ${count}`);
}
await page.click('[data-cat="all"]');

let ids = await page.locator('#gameGrid .game-card').evaluateAll(nodes => nodes.map(n => n.dataset.open));
if(!full) ids = ['m001','m061','m077','m083','c001','c058','c092','b001','b085','b099','p002','p009','p017','p020'];
for(const id of ids){
  await page.evaluate(gameId => {
    openGame(gameId);
    const play = document.querySelector('#playScreen');
    const stage = document.querySelector('#gameStage');
    if(!play || play.classList.contains('hidden')) throw new Error(`${gameId}: play screen did not open`);
    if(!stage || stage.children.length === 0) throw new Error(`${gameId}: empty game stage`);
  }, id);
  await page.waitForTimeout(12);
  await failIfErrors(`mount ${id}`);
  await page.evaluate(() => closeGame());
}

errors.length = 0;
await page.goto(root + 'index.html', {waitUntil:'domcontentloaded'});
// The AITECH home branches into Commons and the dedicated game collection.
const destinations=await page.locator('[data-destination]').evaluateAll(nodes=>nodes.map(n=>n.dataset.destination));
if(JSON.stringify(destinations)!==JSON.stringify(['commons','games'])) throw new Error('AITECH must offer Commons and Games');
if(await page.locator('article[data-game]').count()) throw new Error('Games belong in the dedicated collection');
await page.locator('[data-destination=games]').click();
await page.waitForSelector('article[data-game]');
const listed = await page.locator('article[data-game]').evaluateAll(nodes => nodes.map(n => n.dataset.game));
if(JSON.stringify(listed) !== JSON.stringify(['zombie','smash','aether','daifugo','gomoku'])) throw new Error('The game collection must list only the five selected games');
if(await page.locator('a[href="mega-arcade.html"], a[href="archive.html"], a[href="arcade100/"], a[href="yobi-ronbun.html"]').count()) throw new Error('An unlisted collection is linked from the game collection');
await page.locator('[data-game="gomoku"] .play').click();
await page.waitForSelector('.gomoku-cell');
if(await page.locator('.gomoku-cell').count() !== 225) throw new Error('Gomoku must open a full 15x15 board');
await page.locator('[data-gomoku="112"]').click();
await page.waitForFunction(() => document.querySelectorAll('.gomoku-stone').length === 2);
await page.locator('#new-game-btn').click();
await page.waitForFunction(() => document.querySelectorAll('.gomoku-stone').length === 0);
await failIfErrors('Gomoku CPU move and replay');
await page.locator('.classic-actions a').click();
await page.waitForSelector('article[data-game]');
if(await page.locator('article[data-game]').count() !== 5) throw new Error('Back navigation must return to the game collection');

console.log(`MEGA ARCADE smoke OK: ${full ? ids.length : 'representative'} modes; catalog=320; profiles=320`);
await browser.close();
