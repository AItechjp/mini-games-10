import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const parts = [1,2,3,4,5,6,7,8].map(n => `game23-v2-p${n}.txt`);
try {
  const source = (await Promise.all(parts.map(async path => {
    const res = await fetch(path, {cache:'no-cache'});
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.text();
  }))).join('\n');
  const executable = source.replace(/^import[^;]+;\s*/, '');
  new Function('THREE', executable)(THREE);
} catch (error) {
  console.error('GAME 23 load failed', error);
  const overlay = document.querySelector('#game23-overlay');
  const title = document.querySelector('#overlay-title');
  const text = document.querySelector('#overlay-text');
  const button = document.querySelector('#game23-start');
  if (overlay) overlay.classList.remove('hidden');
  if (title) title.textContent = 'LOAD ERROR';
  if (text) text.textContent = 'ゲーム本体の読み込みに失敗しました。ページを再読み込みしてください。';
  if (button) button.disabled = true;
}
