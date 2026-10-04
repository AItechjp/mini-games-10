import { access } from 'node:fs/promises';
// The retained LAW/IT quizzes use the checked-in, bundled Three.js renderer.
for (const file of ['three.mjs', 'three-LICENSE.txt']) {
  await access(new URL(`../board-games/vendor/${file}`, import.meta.url));
}
console.log('Verified shared quiz renderer and license');
