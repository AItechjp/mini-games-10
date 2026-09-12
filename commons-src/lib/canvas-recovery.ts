import type {Item} from './types';
export type CanvasDraft={id:string;kind:string;body:Record<string,any>;epoch:number};
export type CanvasEditor={kind:'sticky'|'text';x:number;y:number;epoch:number;item?:Item;text:string;fontSize:number;textWidth:number;textColor:string};
export type CanvasRecovery={entries:CanvasDraft[];editor:CanvasEditor|null};
const coordinate=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=2000;
const epoch=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0;
const object=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);
function canvasBody(kind:string,b:any):boolean{
  if(!object(b)||JSON.stringify(b).length>90000)return false;
  if(b.color!==undefined&&(typeof b.color!=='string'||!/^#[a-f0-9]{6}$/i.test(b.color)))return false;
  if(b.width!==undefined&&(!Number.isFinite(b.width)||b.width<1||b.width>30))return false;
  if(kind==='stroke')return Array.isArray(b.points)&&b.points.length>0&&b.points.length<=2500&&b.points.every((p:any)=>Array.isArray(p)&&p.length===2&&p.every(coordinate));
  if(!coordinate(b.x)||!coordinate(b.y))return false;
  if(kind==='shape')return b.type==='rect'?[b.w,b.h].every(coordinate):b.type==='line'&&[b.x2,b.y2].every(coordinate);
  if(typeof b.text!=='string')return false;
  if(kind==='sticky')return b.text.length<=240&&(b.fill===undefined||/^#[a-f0-9]{6}$/i.test(b.fill));
  return kind==='text'&&b.text.length<=1000&&Number.isFinite(b.fontSize)&&b.fontSize>=16&&b.fontSize<=64&&Number.isFinite(b.w)&&b.w>=160&&b.w<=1000;
}
export function isCanvasRecovery(value:unknown):value is CanvasRecovery{
  const v=value as CanvasRecovery;
  if(!object(v)||!Array.isArray(v.entries)||v.entries.length>1500)return false;
  if(!v.entries.every(d=>object(d)&&typeof d.id==='string'&&/^[a-f0-9-]{36}$/i.test(d.id)&&epoch(d.epoch)&&canvasBody(d.kind,d.body)))return false;
  if(new Set(v.entries.map(d=>d.id)).size!==v.entries.length)return false;
  if(v.editor===null)return true;
  const e=v.editor;
  if(!object(e)||!['sticky','text'].includes(e.kind)||!coordinate(e.x)||!coordinate(e.y)||!epoch(e.epoch)||typeof e.text!=='string'||e.text.length>(e.kind==='text'?1000:240)||!Number.isFinite(e.fontSize)||e.fontSize<16||e.fontSize>64||!Number.isFinite(e.textWidth)||e.textWidth<160||e.textWidth>1000||!/^#[a-f0-9]{6}$/i.test(e.textColor))return false;
  const i=e.item;
  return !i||(object(i)&&typeof i.id==='string'&&i.id.length<=100&&i.kind===e.kind&&Number.isSafeInteger(i.revision)&&i.revision>=1&&canvasBody(i.kind,i.body));
}
export function unresolvedDrawings(entries:CanvasDraft[],saved:{id:string}[]){const ids=new Set(saved.map(i=>i.id));return entries.filter(d=>!ids.has(d.id));}
