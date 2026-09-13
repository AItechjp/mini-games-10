// Reproduce the checked-in board game browser libraries from pinned npm packages.
// npm install --no-save --no-package-lock chess.js@1.4.0 shogiops@0.21.0 three@0.180.0 esbuild@0.25.10
import {build} from 'esbuild';
await build({entryPoints:['scripts/board-rules-entry.mjs'],bundle:true,format:'esm',minify:true,outfile:'board-games/vendor/rules.mjs',legalComments:'eof'});
await build({entryPoints:['scripts/board-three-entry.mjs'],bundle:true,format:'esm',minify:true,outfile:'board-games/vendor/three.mjs',legalComments:'eof'});
