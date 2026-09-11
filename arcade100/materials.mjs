/* Cached physical surfaces and contact shadows. All coordinates stay in game space. */
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export class MaterialStudio {
  constructor(renderer){this.r=renderer;this.texture=null;this.revision=0;this.attempted=false;}
  load(){
    if(this.attempted||typeof Image==='undefined')return;this.attempted=true;
    const image=new Image();image.decoding='async';
    image.onload=()=>{this.texture=image;this.revision++;this.r.cache.clear();};
    image.src=new URL('./assets/marble.webp',import.meta.url).href;
  }
  surface(x,y,w,h,color,radius=8,depth=7){
    const r=this.r;
    r.cached('physical:'+color+':'+w+':'+h+':'+radius+':'+depth+':'+this.revision,x,y,w,h+depth,18,()=>{
      const c=r.ctx;
      c.save();c.shadowColor='#02081399';c.shadowBlur=12;c.shadowOffsetY=7;
      r.rect(x,y+depth,w,h,'#040912',radius);c.shadowBlur=0;c.shadowOffsetY=0;
      const edge=c.createLinearGradient(x,y,x,y+h+depth);edge.addColorStop(0,'#768997');edge.addColorStop(.18,'#283e4c');edge.addColorStop(1,'#0b1724');
      r.rect(x,y+2,w,h+depth-2,edge,radius);
      const face=c.createLinearGradient(x,y,x+w*.35,y+h);face.addColorStop(0,color);face.addColorStop(1,'#172634');
      r.rect(x,y,w,h,face,radius,'#b9d8dc45');
      if(this.texture){c.save();c.beginPath();c.roundRect(x+1,y+1,w-2,h-2,radius);c.clip();c.globalAlpha=.26;c.globalCompositeOperation='screen';c.drawImage(this.texture,x,y,w,h);c.restore();}
      const light=c.createLinearGradient(x,y,x+w,y+h);light.addColorStop(0,'#d6ecf322');light.addColorStop(.35,'#b4d5e609');light.addColorStop(1,'#00000040');
      r.rect(x+1,y+1,w-2,h-2,light,radius);
      r.line(x+radius,y+2,x+w-radius,y+2,'#f3f1df75',1.5);
      r.line(x+3,y+radius,x+3,y+h-radius,'#cbdde333',1);
      r.line(x+radius,y+h+depth-2,x+w-radius,y+h+depth-2,'#020711b0',2);
      c.restore();
    });
  }
  shadow(kind,index,x,y,w,h=w,alpha=.38){
    const r=this.r,c=r.ctx,img=r.images[kind];if(!img)return;
    if(r.budget.effects===0){c.save();c.globalAlpha=alpha;c.fillStyle='#020710';c.beginPath();c.ellipse(x,y,w*.25,w*.07,0,0,TAU);c.fill();c.restore();return;}
    const scale=Math.min(1.25,r.pixelScale||1),pw=Math.ceil(w*scale),ph=Math.ceil(h*scale);
    const shadow=r.cache.get('cast:'+kind+':'+index+':'+pw+':'+ph,pw+16,ph+16,t=>{
      const [sx,sy,sw,sh]=r.spriteFrame(kind,index),ratio=Math.min(pw/sw,ph/sh),dw=sw*ratio,dh=sh*ratio;
      t.drawImage(img,sx,sy,sw,sh,8+(pw-dw)/2,8+(ph-dh)/2,dw,dh);
      t.globalCompositeOperation='source-in';t.fillStyle='#020711';t.fillRect(0,0,pw+16,ph+16);
      t.globalCompositeOperation='source-over';
    });
    if(!shadow)return;c.save();c.globalAlpha*=alpha;c.translate(x,y+4);c.transform(1,0,-.5,.23,0,0);c.drawImage(shadow,-w*.5,-h*.84,w,h);c.restore();
  }
  aura(x,y,radius,color,alpha=.3){
    if(this.r.budget.effects===0)return;const r=this.r,c=r.ctx,size=radius*2;
    c.save();c.globalCompositeOperation='screen';c.globalAlpha*=alpha;
    r.cached('light:'+color+':'+radius,x-radius,y-radius,size,size,0,()=>{const t=r.ctx,g=t.createRadialGradient(x,y,0,x,y,radius);g.addColorStop(0,color+'b0');g.addColorStop(.2,color+'38');g.addColorStop(1,color+'00');t.fillStyle=g;t.fillRect(x-radius,y-radius,size,size);});c.restore();
  }
  glint(x,y,w,h,time){
    const r=this.r;if(r.budget.effects<2||r.graphics.reduced)return;
    const c=r.ctx;c.save();c.beginPath();c.roundRect(x,y,w,h,9);c.clip();
    const at=x+((time*.014)%(w*2))-w*.5,g=c.createLinearGradient(at-70,y,at+70,y+h);
    g.addColorStop(0,'#d4efff00');g.addColorStop(.5,'#d4efff0b');g.addColorStop(1,'#d4efff00');c.fillStyle=g;c.fillRect(x,y,w,h);c.restore();
  }
  /* Rotational game-piece geometry, rasterized once per material and output size. */
  chess(type,x,y,size,color){
    const r=this.r;
    r.cached('sculpt:'+type+':'+size+':'+color,x-size*.5,y-size*.8,size,size*1.05,9,()=>{
      const c=r.ctx,faces=[],base=size*.38,top=y-size*.62,segments=28;
      const profiles={P:[[0,.53],[.09,.59],[.16,.54],[.19,.4],[.28,.31],[.61,.21],[.65,.32],[.72,.35],[.85,.39],[.96,.26],[1,0]],R:[[0,.57],[.09,.6],[.18,.51],[.23,.38],[.7,.33],[.74,.5],[.85,.52],[.88,.4],[1,.43]],B:[[0,.6],[.08,.64],[.18,.53],[.23,.37],[.59,.23],[.64,.4],[.71,.27],[.85,.37],[.98,.11],[1,0]],N:[[0,.58],[.1,.65],[.19,.5],[.25,.33],[.49,.26],[.6,.3],[.7,.42],[.79,.38],[.92,.22],[1,.12]],K:[[0,.65],[.09,.67],[.2,.56],[.25,.4],[.63,.25],[.67,.42],[.74,.41],[.77,.27],[.92,.3],[.96,.18]]};
      const rings=profiles[type]||profiles.P,height=size*.73;
      const project=(a,z,rad)=>({x:x+Math.cos(a)*rad*base,y:y-z*height+Math.sin(a)*rad*base*.3,z:Math.sin(a)*rad});
      const hex=color.replace('#',''),rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
      for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){
        const a=i/segments*TAU,b=(i+1)/segments*TAU,[z0,r0]=rings[j],[z1,r1]=rings[j+1],points=[project(a,z0,r0),project(b,z0,r0),project(b,z1,r1),project(a,z1,r1)];
        const slope=(r0-r1)/(z1-z0+.001)*.4,inv=1/Math.hypot(1,slope),nx=Math.cos((a+b)/2)*inv,ny=slope*inv,nz=Math.sin((a+b)/2)*inv;
        const diffuse=clamp(-nx*.52+ny*.66-nz*.48,0,1),spec=Math.pow(clamp(-nx*.24+ny*.28-nz*.93,0,1),22)*.55;
        const shade=.28+diffuse*.65,fill=rgb.map(v=>Math.round(clamp(v*shade+255*spec,0,255)));
        faces.push({points,z:points.reduce((a,p)=>a+p.z,0)/4,fill:'rgb('+fill.join(',')+')'});
      }
      c.save();c.fillStyle='#01071080';c.beginPath();c.ellipse(x+3,y+4,base*.74,base*.27,0,0,TAU);c.fill();
      for(const face of faces.sort((a,b)=>a.z-b.z)){c.beginPath();face.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=face.fill;c.fill();c.strokeStyle=face.fill;c.lineWidth=.5;c.stroke();}
      if(type==='K'){r.line(x,y-height-.05*size,x,y-height+.12*size,'#e7e7d4',size*.045);r.line(x-size*.06,y-height+.015*size,x+size*.06,y-height+.015*size,'#e7e7d4',size*.045);}
      if(type==='R'){for(let i=-1;i<=1;i++)r.rect(x+i*size*.1-size*.03,y-height-size*.015,size*.06,size*.1,color,1);}
      if(type==='N'){c.fillStyle=color;c.beginPath();c.moveTo(x-size*.12,top+size*.14);c.lineTo(x+size*.23,top+size*.13);c.lineTo(x+size*.27,top+size*.05);c.lineTo(x+size*.07,top-size*.09);c.lineTo(x-size*.13,top-size*.12);c.closePath();c.fill();r.circle(x+size*.075,top+size*.005,size*.018,'#101822');}
      if(type==='B')r.line(x-size*.035,y-height*.96,x+size*.07,y-height*.79,'#102535',size*.026);
      c.restore();
    });
  }
}
