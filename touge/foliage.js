import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
// Original procedural foliage atlas; no remote textures or third-party model assets.
export function createFoliage(){
 let seed=131;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');
 function twig(ax,ay,bx,by,width){x.strokeStyle='#535344';x.lineWidth=width;x.beginPath();x.moveTo(ax,ay);x.lineTo(bx,by);x.stroke();}
 const clusters=[];for(let b=0;b<11;b++){const a=b*2.3999,len=85+rand()*120,bx=256+Math.cos(a)*len,by=256+Math.sin(a)*len;twig(256,278,bx,by,2.5);clusters.push([bx,by]);for(let j=0;j<5;j++){const t=.3+j*.14,px=256+(bx-256)*t,py=278+(by-278)*t,side=j%2?1:-1,ex=px+Math.cos(a+side*.9)*(30+rand()*35),ey=py+Math.sin(a+side*.9)*(30+rand()*35);twig(px,py,ex,ey,1.5);clusters.push([ex,ey]);}}
 for(const [bx,by] of clusters)for(let j=0;j<17;j++){const px=bx+(rand()-.5)*62,py=by+(rand()-.5)*48,a=rand()*6.28,light=23+rand()*27;x.save();x.translate(px,py);x.rotate(a);const g=x.createLinearGradient(-8,0,8,0);g.addColorStop(0,`hsl(${82+rand()*24},22%,${light-7}%)`);g.addColorStop(.5,`hsl(89,28%,${light+9}%)`);g.addColorStop(1,`hsl(102,20%,${light}%)`);x.fillStyle=g;x.beginPath();x.moveTo(-11,0);x.quadraticCurveTo(-1,-7,11,0);x.quadraticCurveTo(-1,7,-11,0);x.fill();x.strokeStyle='#bfd19b42';x.lineWidth=.6;x.beginPath();x.moveTo(-9,0);x.lineTo(8,0);x.stroke();x.restore();}
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const material=new T.MeshStandardMaterial({map:texture,color:0xbdcbb0,alphaTest:.4,side:T.DoubleSide,roughness:1,metalness:0});
 const leaves=[],branches=[];
 const stem=new T.CylinderGeometry(.105,.27,6,8);stem.translate(0,3,0);branches.push(stem);
 for(let i=0;i<23;i++){const angle=i*2.3999,level=i/23,height=3.5+level*4,radius=(.7+Math.sin(level*Math.PI)*1.3),cx=Math.cos(angle)*radius,cz=Math.sin(angle)*radius;
  for(let j=0;j<2;j++){const geo=new T.PlaneGeometry(2.6,2.15);geo.rotateX((rand()-.5)*.8);geo.rotateY(angle+j*Math.PI/2);geo.translate(cx,height,cz);leaves.push(geo);}
  if(i%2===0){const start=new T.Vector3(0,height-.65,0),end=new T.Vector3(cx,height,cz),direction=end.clone().sub(start),g=new T.CylinderGeometry(.022,.062,direction.length(),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()));g.translate(...start.add(end).multiplyScalar(.5).toArray());branches.push(g);}
 }
 const barkCanvas=document.createElement('canvas');barkCanvas.width=128;barkCanvas.height=256;const bc=barkCanvas.getContext('2d');bc.fillStyle='#565548';bc.fillRect(0,0,128,256);for(let i=0;i<250;i++){const q=25+rand()*55;bc.strokeStyle=`rgb(${q+10},${q+8},${q})`;bc.lineWidth=.5+rand()*3;const xx=rand()*128,yy=rand()*256;bc.beginPath();bc.moveTo(xx,yy);bc.lineTo(xx+rand()*5,yy+12+rand()*45);bc.stroke();}const barkTexture=new T.CanvasTexture(barkCanvas);barkTexture.colorSpace=T.SRGBColorSpace;barkTexture.wrapS=barkTexture.wrapT=T.RepeatWrapping;
 return {crown:mergeGeometries(leaves),trunk:mergeGeometries(branches),leaf:material,bark:new T.MeshStandardMaterial({map:barkTexture,roughness:1,color:0x949484})};
}
