/* Shared display budget. It never changes simulation clocks or network cadence. */
(() => {
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  class FrameBudget {
    constructor({mode='auto',coarse=false,maxPixels=coarse?1800000:3600000}={}){
      this.coarse=coarse;this.maxPixels=maxPixels;this.factor=1;this.frameMs=16.667;
      this.cpuMs=0;this.samples=0;this.slow=0;this.fast=0;this.changedAt=0;this.nextDraw=0;
      this.frames=0;this.setMode(mode);
    }
    setMode(mode){this.mode=['auto','high','balanced','low'].includes(mode)?mode:'auto';this.factor=1;this.samples=this.slow=this.fast=0;this.nextDraw=0;}
    sample(frameMs,cpuMs,now,active=true){
      if(!active||frameMs<=0||frameMs>1000||!Number.isFinite(frameMs)||!Number.isFinite(cpuMs))return false;
      frameMs=Math.min(frameMs,120);
      const weight=this.samples<12?.2:.06;this.samples++;
      this.frameMs+=(frameMs-this.frameMs)*weight;this.cpuMs+=(Math.max(0,cpuMs)-this.cpuMs)*weight;
      if(this.mode!=='auto'||this.samples<(this.frameMs>45?8:45))return false;
      const overloaded=this.frameMs>21||this.cpuMs>12;
      this.slow=overloaded?this.slow+(this.frameMs>45?4:1):Math.max(0,this.slow-2);
      this.fast=!overloaded&&this.frameMs<18&&this.cpuMs<7?this.fast+1:0;
      if(this.slow>=24&&now-this.changedAt>1600&&this.factor>.56){this.factor=Math.max(.55,Math.round((this.factor-.15)*100)/100);this.changedAt=now;this.slow=this.fast=0;return true;}
      if(this.fast>=300&&now-this.changedAt>9000&&this.factor<1){this.factor=Math.min(1,this.factor+.05);this.changedAt=now;this.fast=0;return true;}
      return false;
    }
    scale(width,height,dpr=1){
      const modeCap=this.mode==='low'?1:this.mode==='balanced'?1.25:this.mode==='high'?2:this.coarse?1.5:2;
      const native=Math.min(Math.max(.5,dpr),modeCap,Math.sqrt(this.maxPixels/Math.max(1,width*height)));
      return Math.min(Math.sqrt(this.maxPixels/Math.max(1,width*height)),Math.max(.5,Math.floor(native*(this.mode==='auto'?this.factor:1)*20)/20));
    }
    get effects(){return this.mode==='low'?0:this.mode==='balanced'||this.factor<.8?1:2;}
    get fps(){return Math.round(1000/Math.max(1,this.frameMs));}
    get targetFps(){return this.mode==='low'||this.mode==='auto'&&this.factor<=.56&&this.frameMs>30?30:60;}
    shouldDraw(now,active=true,still=false){
      if(!active){this.nextDraw=now;return false;}
      const interval=1000/(still?Math.min(30,this.targetFps):this.targetFps);
      if(now+.8<this.nextDraw)return false;
      this.nextDraw=Math.max(now-interval, this.nextDraw)+interval;this.frames++;return true;
    }
    get stats(){return {mode:this.mode,fps:this.fps,targetFps:this.targetFps,scaleFactor:this.factor,effects:this.effects,cpuMs:Math.round(this.cpuMs*100)/100,frames:this.frames};}
  }
  globalThis.AitechFrameBudget=FrameBudget;
})();
