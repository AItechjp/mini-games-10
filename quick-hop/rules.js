(function(root){
  'use strict';
  const platforms=[[0,0,620],[730,0,370],[1210,55,300],[1620,105,320],[2050,35,440],[2600,95,300],[3010,0,480],[3600,60,350],[4060,115,300],[4470,40,360],[4940,0,720]];
  const coins=platforms.map(([x,z,w])=>[x+w*.35,z+90]).concat(platforms.map(([x,z,w])=>[x+w*.7,z+105]));
  const goal=5450;
  class Game{
    constructor(){this.x=100;this.z=0;this.vx=0;this.vz=0;this.state='title';this.taken=new Set();this.falls=0;this.time=0;this.grounded=true;this.coyote=.12;this.buffer=0;this.wasJump=false;this.checkpoint=100;this.facing=1;this.events=[];}
    step(dt,move=0,jump=false){
      this.events=[];
      if(this.state!=='playing')return;
      dt=Math.max(0,Math.min(dt,1/30));this.time+=dt;
      this.coyote=this.grounded?.12:Math.max(0,this.coyote-dt);
      this.buffer=jump&&!this.wasJump?.13:Math.max(0,this.buffer-dt);
      if(this.wasJump&&!jump&&this.vz>260)this.vz=260;
      this.wasJump=jump;
      if(this.coyote>0&&this.buffer>0){this.vz=650;this.grounded=false;this.coyote=this.buffer=0;this.events.push('jump');}
      this.vx+=Math.max(-1700*dt,Math.min(1700*dt,move*300-this.vx));
      if(move)this.facing=move>0?1:-1;
      const oldx=this.x,oldz=this.z;let nx=Math.max(16,Math.min(goal+100,this.x+this.vx*dt));
      for(const [x,z,w] of platforms){
        if(this.z<z-.5&&this.z+44>z-180){
          if(oldx+14<=x&&nx+14>x){nx=x-14;this.vx=0;}
          if(oldx-14>=x+w&&nx-14<x+w){nx=x+w+14;this.vx=0;}
        }
      }
      this.x=nx;this.vz=Math.max(-1000,this.vz-1500*dt);let nz=this.z+this.vz*dt;this.grounded=false;
      for(const [x,z,w] of platforms){if(x-14<this.x&&this.x<x+w+14&&this.vz<=0&&oldz>=z-.5&&nz<=z){nz=z;this.vz=0;this.grounded=true;}}
      this.z=nz;
      if(this.z<-350){this.falls++;this.x=this.checkpoint;this.z=this.vx=this.vz=0;this.grounded=true;this.events.push('fall');}
      coins.forEach(([x,z],i)=>{if(!this.taken.has(i)&&Math.abs(x-this.x)<33&&Math.abs(z-(this.z+22))<40){this.taken.add(i);this.events.push('coin');}});
      if(this.x>3120&&this.grounded&&this.checkpoint===100){this.checkpoint=3120;this.events.push('camp');}
      if(this.x>=goal){this.state='won';this.events.push('win');}
    }
  }
  const api={Game,platforms,coins,goal};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.QuickHopRules=api;
})(typeof globalThis!=='undefined'?globalThis:this);
