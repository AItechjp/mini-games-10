/* GAME 23 loader — keep startup compatible with non-secure HTTP custom domains. */
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

const PARTS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21].map(n => `game23-v3-part${n}.js?v=coop-continue-1`);
const overlayTitle = document.querySelector('#overlay-title');
const overlayText = document.querySelector('#overlay-text');
const start = document.querySelector('#game23-start');
try {
  if (start) start.disabled = true;
  if (overlayTitle) overlayTitle.textContent = 'ULTIMATE BLACK SITE LOADING';
  if (overlayText) overlayText.textContent = '全画面戦闘・協力コンティニュー・適応型サウンドを構築中…';
  const texts = await Promise.all(PARTS.map(async path => {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.text();
  }));
  const url = URL.createObjectURL(new Blob([texts.join('\n')], { type: 'text/javascript' }));
  try { await import(url); } finally { URL.revokeObjectURL(url); }
} catch (err) {
  console.error('GAME23 ULTIMATE load failed', err);
  if (overlayTitle) overlayTitle.textContent = 'LOAD ERROR';
  if (overlayText) overlayText.textContent = `ゲーム本体の読み込みに失敗しました。${err?.message||''}`;
  if (start) {
    start.disabled = false;
    start.textContent = '再読み込み';
    start.onclick = () => location.reload();
  }
}