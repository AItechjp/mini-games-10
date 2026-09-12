import {build} from 'vite';
import {createRequire} from 'node:module';
import react from '@vitejs/plugin-react';
import {resolve,join} from 'node:path';
import {mkdir,readFile,writeFile,cp,rm,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const source=resolve(fileURLToPath(new URL('..',import.meta.url)));
const root=resolve(source,'..');
const output=join(root,'commons');
const input=join(source,'aitech/index.html');
// Preserve independent Commons sites (for example hotels and rentals).
// Only the routes and files generated below belong to this application.
await writeFile(input,'<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#253654"><meta name="robots" content="noindex"><title>コモンズ | AITECH</title><link rel="canonical" href="https://aitechd.com/commons/"><link rel="icon" href="/commons/favicon.svg"></head><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>');
await rm(join(output,'assets'),{recursive:true,force:true});
await rm(join(output,'camera-auth.js'),{force:true});
await rm(join(output,'auth.css'),{force:true});
await build({configFile:false,root:join(source,'aitech'),base:'/commons/',plugins:[react()],resolve:{alias:{'@':source}},css:{postcss:source},publicDir:false,build:{outDir:output,emptyOutDir:false,assetsInlineLimit:100000,rollupOptions:{input:{index:input},output:{entryFileNames:'assets/[name]-[hash].js'}}}});
const html=await readFile(join(output,'index.html'),'utf8');
const paths=['study','tools/whiteboard','tools/chat','r','weather','bitcoin','onion','ramen','openings/restaurants','openings/ramen','openings/sauna','sauna'];
paths.push(...['supermarkets','saunas','sento','fishmongers'].map(kind=>'local/'+kind));
const localTitles={supermarkets:'スーパー',saunas:'サウナ',sento:'銭湯',fishmongers:'魚屋'};
for(const path of paths){await mkdir(join(output,path),{recursive:true});let page=html.replace('href="https://aitechd.com/commons/"',`href="https://aitechd.com/commons/${path}/"`);if(path.startsWith('local/'))page=page.replace('<title>コモンズ | AITECH</title>',`<title>今開いてる${localTitles[path.split('/')[1]]}一覧｜岐阜・愛知 | AITECH</title>`);await writeFile(join(output,path,'index.html'),page)}
await cp(join(source,'public/favicon.svg'),join(output,'favicon.svg'));
await mkdir(join(output,'camera'),{recursive:true});
await cp(join(source,'public/camera'),join(output,'camera'),{recursive:true});
let camera=await readFile(join(source,'app/camera/document.html'),'utf8');
await writeFile(join(output,'camera/index.html'),camera);
await cp(join(source,'data/onion-snapshot.json'),join(output,'onion/snapshot.json'));
await cp(join(source,'public/sauna-data.json'),join(output,'sauna-data.json'));
await cp(join(source,'public/local-data.json'),join(output,'local-data.json'));
await build({configFile:false,root:source,publicDir:false,resolve:{alias:[{find:'opening_hours',replacement:'npm:opening_hours@3.14.0'},{find:'@/db',replacement:join(source,'edge/database.ts')},{find:'@',replacement:source}]},build:{outDir:join(source,'edge-output'),emptyOutDir:true,minify:false,lib:{entry:join(source,'edge/index.ts'),formats:['es'],fileName:()=> 'index.js'},rollupOptions:{external:id=>id.startsWith('npm:')||id.startsWith('node:')}}});
const require=createRequire(await realpath(join(source,'node_modules/vite/package.json')));
const transformed=await require('esbuild').transform(await readFile(join(source,'edge-output/index.js'),'utf8'),{minify:true,target:'es2022',format:'esm'});
await writeFile(join(source,'edge-output/index.js'),transformed.code);
console.log(JSON.stringify({frontend:output,server:join(source,'edge-output/index.js'),routes:paths.length+2}));
