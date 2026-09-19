import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

// Serve dist/, not the source tree: the original failure was introduced by the
// production transform removing the JSON module import attribute.
const base = (process.env.ONEPIECE_BASE_URL || 'http://127.0.0.1:4173').replace(/\/$/, '');
const gameUrl = `${base}/onepiece-battle/`;
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}),
});
await mkdir('test-output/onepiece', { recursive: true });

async function contextFor(viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport });
  context.setDefaultTimeout(8000);
  // Cosmetic third-party fonts must not decide whether the game can boot.
  await context.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => route.abort());
  await context.addInitScript(() => {
    const random = Crypto.prototype.getRandomValues;
    Crypto.prototype.getRandomValues = function (array) {
      const result = random.call(this, array);
      // Keep crypto behavior intact except the local game's first-player/seed
      // pair. This makes both the CPU turn and handoff reproducible.
      if (array instanceof Uint32Array && array.length === 2) {
        array[0] = 0;
        array[1] = 20260919;
      }
      return result;
    };
  });
  return context;
}

async function ready(page) {
  await page.waitForFunction(() => document.documentElement.dataset.gameReady === 'true');
  assert(await page.locator('#start-game').isEnabled(), 'ready game enables the start button');
}

async function loadedImages(page, selector, minimum = 1) {
  await page.waitForFunction(({ selector, minimum }) => {
    const images = [...document.querySelectorAll(selector)];
    return images.length >= minimum && images.every(image => image.complete && image.naturalWidth > 0);
  }, { selector, minimum });
  assert(await page.locator(selector).evaluateAll(images => images.every(image => {
    const url = new URL(image.currentSrc || image.src);
    return url.origin === location.origin && url.pathname.includes('/onepiece-battle/art/');
  })), `${selector} uses bundled starter art`);
}

async function allStarterArt(page) {
  const result = await page.evaluate(async () => {
    const { CARDS } = await import('./engine.mjs');
    return Promise.all(Object.values(CARDS).map(async card => {
      const source = card.localImage || card.image || card.imageUrl || card.image_url;
      const url = new URL(source, location.href);
      const image = new Image();
      image.src = url.href;
      try {
        await Promise.race([
          image.decode(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('image timeout')), 7000)),
        ]);
        return { id: card.id, loaded: image.naturalWidth > 0,
          local: url.origin === location.origin && url.pathname.includes('/onepiece-battle/art/') };
      } catch {
        return { id: card.id, loaded: false, local: false };
      }
    }));
  });
  assert.equal(result.length, 34, 'both complete starter decks are present');
  assert.deepEqual(result.filter(card => !card.loaded || !card.local), [], 'all 34 local illustrations decode');
}

async function solo(name, viewport, testCPU) {
  const context = await contextFor(viewport);
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
    await ready(page);
    await loadedImages(page, '.showcase-card img', 2);
    if (testCPU) await allStarterArt(page);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'lobby fits viewport');
    await page.locator('#start-game').click();
    await page.locator('#battle-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.hand-cards .play-card').count(), 5, 'starting hand has five cards');
    await loadedImages(page, '.leader-zone .play-card img', 2);
    await loadedImages(page, '.hand-cards .play-card img', 5);
    const card = page.locator('.hand-cards .play-card').first();
    await card.click();
    await card.click();
    await page.locator('#details-dialog').waitFor({ state: 'visible' });
    await loadedImages(page, '#details-dialog .detail-card-picture img');
    await page.locator('#details-dialog .close-dialog').click();
    await page.getByRole('button', { name: 'この手札で開始', exact: true }).click();
    await page.getByRole('button', { name: 'ターンを終了', exact: true }).waitFor();
    if (testCPU) {
      // A real legal action must modify the board before handing over to CPU.
      await page.locator('.attach-control button').first().click();
      assert(await page.locator('.own-area .card-don').count() > 0, 'DON attachment changes the board');
      await page.getByRole('button', { name: 'ターンを終了', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#turn-heading')?.textContent === 'TURN 3');
      await page.getByRole('button', { name: 'ターンを終了', exact: true }).waitFor();
      assert(await page.locator('#game-log').innerText().then(text => text.includes('PLAYER 2')), 'CPU acts and returns the turn');
      await loadedImages(page, '#game-table .play-card img', 2);
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'battle fits viewport');
    await page.screenshot({ path: `test-output/onepiece/${name}-battle.png`, fullPage: true });
    assert.deepEqual(errors, [], `${name} has no runtime errors`);
    console.log(`PASS ${name}: boot, visible starter art, hand, detail${testCPU ? ', all 34 images and CPU turn' : ''}`);
  } finally {
    await context.close();
  }
}

async function hotseat() {
  const context = await contextFor({ width: 393, height: 852 });
  try {
    const page = await context.newPage();
    await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
    await ready(page);
    await page.locator('[data-mode="hotseat"]').click();
    await page.locator('#start-game').click();
    assert.equal(await page.locator('.hand-cards .play-card').count(), 5);
    await page.getByRole('button', { name: 'この手札で開始', exact: true }).click();
    await page.locator('#pass-screen').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#game-table [data-uid]').count(), 0, 'handoff removes private cards from DOM');
    assert.equal(await page.locator('#action-list button').count(), 0, 'handoff removes hand-derived actions');
    assert.equal(await page.locator('dialog[open]').count(), 0, 'handoff closes card details');
    await page.locator('#reveal-hand').click();
    assert.equal(await page.locator('.hand-cards .play-card').count(), 5, 'only the next player reveals their hand');
    await loadedImages(page, '.hand-cards .play-card img', 5);
    console.log('PASS hotseat: private handoff and next player illustrations');
  } finally {
    await context.close();
  }
}

async function startupRecovery() {
  const context = await contextFor();
  try {
    const page = await context.newPage();
    const engine = /\/onepiece-battle\/engine\.mjs(?:\?.*)?$/;
    await page.route(engine, route => route.abort());
    await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
    await page.locator('#startup-retry').waitFor({ state: 'visible' });
    assert(await page.locator('#startup-status').isVisible(), 'module failure explains why startup stopped');
    assert((await page.locator('#startup-status').innerText()).trim().length > 0);
    assert.notEqual(await page.evaluate(() => document.documentElement.dataset.gameReady), 'true');
    await page.unroute(engine);
    await page.locator('#startup-retry').click();
    await ready(page);
    await page.locator('#start-game').click();
    await loadedImages(page, '.hand-cards .play-card img', 5);
    console.log('PASS startup failure: visible retry recovers into a playable match');
  } finally {
    await context.close();
  }
}

try {
  await solo('desktop', { width: 1440, height: 1000 }, true);
  await solo('mobile', { width: 393, height: 852 }, false);
  await hotseat();
  await startupRecovery();
} finally {
  await browser.close();
}
