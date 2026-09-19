// Keep browser data in an ordinary ES module. The static ES2022 minifier removes
// JSON import attributes, which would turn a native JSON import into a MIME error.
import {readFile, writeFile} from 'node:fs/promises';
const base = new URL('../onepiece-battle/', import.meta.url);
const cards = JSON.parse(await readFile(new URL('cards.json', base), 'utf8'));
await writeFile(new URL('cards.mjs', base),
  '// Generated from cards.json by scripts/build-onepiece-data.mjs.\nexport default ' + JSON.stringify(cards) + ';\n');
