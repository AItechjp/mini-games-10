import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const target = new URL('touge/vendor/', root);
await mkdir(target, { recursive: true });
for (const file of ['build', 'examples', 'LICENSE']) {
  await cp(new URL(`node_modules/three/${file}`, root), new URL(file, target), { recursive: true });
}
console.log(`Prepared Three.js assets in ${fileURLToPath(target)}`);
