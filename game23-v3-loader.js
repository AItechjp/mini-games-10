/* GAME 23 open-world FPS loader — preserve the verified v3 game while making startup resilient. */
const game23Crypto = globalThis.crypto;
if (game23Crypto && typeof game23Crypto.randomUUID !== 'function') {
  const fallbackUUID = () => {
    const bytes = new Uint8Array(16);
    if (typeof game23Crypto.getRandomValues === 'function') game23Crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const h = [...bytes].map(v => v.toString(16).padStart(2, '0'));
    return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10,16).join('')}`;
  };
  try { Object.defineProperty(game23Crypto, 'randomUUID', { configurable: true, value: fallbackUUID }); }
  catch { try { game23Crypto.randomUUID = fallbackUUID; } catch {} }
}

const PARTS = [
  ...[1,2,3,4,5,6,7,8,9,10].map(n => `game23-v3-part${n}.js?v=horror-world-1`),
  'game23-v3-part11-lite.js?v=horror-world-1',
  'game23-v3-part12-world.js?v=horror-world-1'
];
const THREE_IMPORT = "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';";
const THREE_SOURCES = [
  'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js',
  'https://unpkg.com/three@0.180.0/build/three.module.js'
];
const overlayTitle = document.querySelector('#overlay-title');
const overlayText = document.querySelector('#overlay-text');
const start = document.querySelector('#game23-start');

async function reachable(url, ms = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { cache: 'force-cache', signal: controller.signal });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    await res.body?.cancel?.();
    return true;
  } finally { clearTimeout(timer); }
}

try {
  if (start) start.disabled = true;
  if (overlayTitle) overlayTitle.textContent = 'ULTIMATE BLACK SITE LOADING';
  if (overlayText) overlayText.textContent = '蛇行する探索路・障害物・感染体10種・巨大ボスを構築中…';

  const partTexts = await Promise.all(PARTS.map(async path => {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.text();
  }));

  let threeSource = '';
  let lastThreeError = null;
  for (const source of THREE_SOURCES) {
    try { if (await reachable(source)) { threeSource = source; break; } }
    catch (err) { lastThreeError = err; }
  }
  if (!threeSource) throw lastThreeError || new Error('Three.js could not be loaded');

  let source = partTexts.join('\n');
  if (!source.includes(THREE_IMPORT)) throw new Error('Three.js import marker not found');
  source = source.replace(THREE_IMPORT, `import * as THREE from '${threeSource}';`);
  const gameUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try { await import(gameUrl); }
  finally { URL.revokeObjectURL(gameUrl); }
} catch (err) {
  console.error('GAME23 OPEN WORLD load failed', err);
  if (overlayTitle) overlayTitle.textContent = 'LOAD ERROR';
  if (overlayText) overlayText.textContent = `ゲーム本体の読み込みに失敗しました。${err?.message || ''}`;
  if (start) {
    start.disabled = false;
    start.textContent = '再読み込み';
    start.onclick = () => location.reload();
  }
}
