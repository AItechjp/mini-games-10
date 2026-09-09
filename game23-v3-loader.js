const PARTS = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map(n => `game23-v3-part${n}.js?v=infected-classes-2`);
const overlayTitle = document.querySelector('#overlay-title');
const overlayText = document.querySelector('#overlay-text');
const start = document.querySelector('#game23-start');
try {
  if (start) start.disabled = true;
  if (overlayTitle) overlayTitle.textContent = 'ULTIMATE BLACK SITE LOADING';
  if (overlayText) overlayText.textContent = '10種感染体・無限湧き・エリア別ボス・高性能描画を構築中…';
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
  if (overlayText) overlayText.textContent = 'ゲーム本体の読み込みに失敗しました。ページを再読み込みしてください。';
}