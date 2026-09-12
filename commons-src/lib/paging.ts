export type PageWindow<T>={items:T[];page:number;pages:number;from:number;to:number;total:number};
export function pageWindow<T>(items:T[],requestedPage:number,pageSize:number):PageWindow<T>{
  const size=Math.max(1,Math.floor(pageSize));
  const pages=Math.max(1,Math.ceil(items.length/size));
  const page=Math.min(pages,Math.max(1,Math.floor(requestedPage)||1));
  const start=(page-1)*size;
  return {items:items.slice(start,start+size),page,pages,from:items.length?start+1:0,to:Math.min(items.length,start+size),total:items.length};
}
export function recentWindow<T>(items:T[],requested:number,step:number){
  const visible=Math.min(items.length,Math.max(step,Math.ceil(Math.max(0,requested)/step)*step));
  return {items:items.slice(Math.max(0,items.length-visible)),hidden:Math.max(0,items.length-visible),visible};
}
