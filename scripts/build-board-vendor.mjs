// Reproduce the checked-in board game browser libraries from pinned npm packages.
// npm ci && npm run build:board
import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
await build({entryPoints:['scripts/board-rules-entry.mjs'],bundle:true,format:'esm',minify:true,outfile:'board-games/vendor/rules.mjs',legalComments:'eof'});
await build({entryPoints:['scripts/board-three-entry.mjs'],bundle:true,format:'esm',minify:true,outfile:'board-games/vendor/three.mjs',legalComments:'eof'});
await copyFile('node_modules/tsshogi/LICENSE','board-games/vendor/tsshogi-LICENSE.txt');
