import {appFor} from '../quality/apps.mjs';
import {relative} from 'node:path';
export function addQuality(html,file,root){
  const path='/'+relative(root,file).replaceAll('\\','/').replace(/index\.html$/,'');
  const included=appFor(path)||['/board-games/','/trump/','/classic.html','/commons/r/'].includes(path);
  if(!included||html.includes('data-aitech-quality'))return html;
  return html.replace('</head>','<link rel="stylesheet" href="/quality/assist.css?v=20260914-20"><script type="module" src="/quality/assist.mjs?v=20260914-20" data-aitech-quality></script></head>');
}
