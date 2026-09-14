import {build} from 'esbuild';
await build({entryPoints:['edge/realtime.ts'],outfile:'edge-output/realtime.js',bundle:true,format:'esm',platform:'neutral',target:'es2022',external:['npm:*'],alias:{opening_hours:'npm:opening_hours@3.14.0'},minify:true});
