// Reuse rasterized layers instead of redoing shadows, gradients and image scaling.
export function surface(width,height){
  if(typeof OffscreenCanvas!=='undefined')return new OffscreenCanvas(width,height);
  if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=width;c.height=height;return c;}
  return null;
}
export class SurfaceCache {
  constructor(maxPixels=6500000){this.entries=new Map();this.pixels=0;this.maxPixels=maxPixels;this.hits=0;this.misses=0;}
  get(key,w,h,paint){
    const hit=this.entries.get(key);if(hit){this.entries.delete(key);this.entries.set(key,hit);this.hits++;return hit.canvas;}
    w=Math.max(1,Math.ceil(w));h=Math.max(1,Math.ceil(h));if(w*h>this.maxPixels)return null;
    const c=surface(w,h);if(!c)return null;
    while(this.pixels+w*h>this.maxPixels&&this.entries.size){const first=this.entries.keys().next().value,old=this.entries.get(first);this.pixels-=old.pixels;this.entries.delete(first);this.release(old.canvas);}
    const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';paint(ctx,c);
    while(this.pixels+w*h>this.maxPixels&&this.entries.size){const key=this.entries.keys().next().value,old=this.entries.get(key);this.pixels-=old.pixels;this.entries.delete(key);this.release(old.canvas);}
    const bitmap=typeof c.transferToImageBitmap==='function'?c.transferToImageBitmap():c;if(bitmap!==c)c.width=c.height=1;
    this.entries.set(key,{canvas:bitmap,pixels:w*h});this.pixels+=w*h;this.misses++;return bitmap;
  }
  release(canvas){if(typeof canvas.close==='function')canvas.close();else canvas.width=canvas.height=1;}
  clear(){for(const {canvas} of this.entries.values())this.release(canvas);this.entries.clear();this.pixels=0;}
}
