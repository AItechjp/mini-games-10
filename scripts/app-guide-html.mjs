import {relative,dirname,join} from 'node:path';
import {APPS} from '../app-guide/catalog.mjs';
const pages=new Set(APPS.filter(a=>a.path.startsWith('/')).map(a=>{const p=new URL(a.path,'https://aitechd.com').pathname;return p.endsWith('/')?p.slice(1)+'index.html':p.slice(1);}));
for(const path of ['yobi-quiz.html','yobi-ronbun.html','commons/r/index.html'])pages.add(path);
export function addAppGuide(html,source,root){
 const path=relative(root,source).replaceAll('\\','/');
 if(!pages.has(path)||/\bdata-aitech-app-guide\b/.test(html))return html;
 const script=relative(dirname(source),join(root,'app-guide/ui.mjs')).replaceAll('\\','/');
 return html.replace(/<\/head>/i,`<script type="module" src="${script}" data-aitech-app-guide></script>\n</head>`);
}
