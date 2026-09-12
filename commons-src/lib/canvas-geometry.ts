export type Point=[number,number];
export type Drawing={kind:string;body:Record<string,any>};
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function pointAt(clientX:number,clientY:number,rect:{left:number;top:number;width:number;height:number}):Point{
  return [Math.round(clamp((clientX-rect.left)/rect.width*1200,0,1200)*10)/10,Math.round(clamp((clientY-rect.top)/rect.height*800,0,800)*10)/10];
}
function distance(point:Point,start:Point,end:Point){
  const dx=end[0]-start[0],dy=end[1]-start[1],len=dx*dx+dy*dy;
  const t=len?clamp(((point[0]-start[0])*dx+(point[1]-start[1])*dy)/len,0,1):0;
  return Math.hypot(point[0]-start[0]-t*dx,point[1]-start[1]-t*dy);
}
// Midpoint curves keep the original samples/endpoints, without overshooting
// tight handwriting loops as an unconstrained spline can.
export function strokePath(points:Point[],smooth=true){
  if(!points.length)return '';
  let path=`M ${points[0].join(' ')}`;
  if(points.length<3||!smooth)return path+points.slice(1).map(p=>` L ${p.join(' ')}`).join('');
  path+=` L ${(points[0][0]+points[1][0])/2} ${(points[0][1]+points[1][1])/2}`;
  for(let i=1;i<points.length-1;i++)path+=` Q ${points[i].join(' ')} ${(points[i][0]+points[i+1][0])/2} ${(points[i][1]+points[i+1][1])/2}`;
  return path+` L ${points.at(-1)!.join(' ')}`;
}
export function appendInk(points:Point[],point:Point,minDistance=.3){
  const last=points.at(-1);
  if(last&&Math.hypot(point[0]-last[0],point[1]-last[1])<minDistance)return;
  // Keep accepting the tip on long gestures instead of freezing at the limit.
  if(points.length>=2400){const reduced=points.filter((_,i)=>i%2===0);if(reduced.at(-1)!==last)reduced.push(last!);points.splice(0,points.length,...reduced)}
  points.push(point);
}
const graphemes=new Intl.Segmenter('ja',{granularity:'grapheme'});
export function canvasTextLayout(text:string,fontSize:number,width:number){
  const lines:string[]=[];
  for(const paragraph of text.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n')){
    let line='',used=0;
    for(const {segment} of graphemes.segment(paragraph)){
      const advance=fontSize*(/^[\x20-\x7e]+$/.test(segment)?.62:1);
      if(line&&used+advance>width){lines.push(line);line='';used=0}
      line+=segment;used+=advance;
    }
    lines.push(line);
  }
  return {lines,lineHeight:fontSize*1.4,height:Math.ceil(lines.length*fontSize*1.4)};
}
export function drawingSize(item:Drawing){
  const b=item.body;
  if(item.kind==='sticky')return {width:195,height:140};
  if(item.kind==='text')return {width:b.w,height:canvasTextLayout(b.text,b.fontSize,b.w).height};
  return {width:b.w,height:b.h};
}
export function contains(item:Drawing,p:Point){
  const b=item.body;
  if(item.kind==='stroke')return b.points.some((q:Point,i:number)=>distance(p,i?b.points[i-1]:q,q)<Math.max(9,(Number(b.width)||4)/2+5));
  if(item.kind==='shape'&&b.type==='line')return distance(p,[b.x,b.y],[b.x2,b.y2])<12;
  const {width,height}=drawingSize(item);
  return p[0]>=b.x-5&&p[0]<=b.x+width+5&&p[1]>=b.y-5&&p[1]<=b.y+height+5;
}
export function translate(item:Drawing,delta:Point){
  const b=item.body;
  const size=drawingSize(item);
  const points:Point[]=item.kind==='stroke'?b.points:item.kind==='shape'&&b.type==='line'?[[b.x,b.y],[b.x2,b.y2]]:[[b.x,b.y],[b.x+size.width,b.y+size.height]];
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const dx=clamp(delta[0],-Math.min(...xs),1200-Math.max(...xs)),dy=clamp(delta[1],-Math.min(...ys),800-Math.max(...ys));
  if(item.kind==='stroke')return {...b,points:points.map(p=>[Math.round((p[0]+dx)*10)/10,Math.round((p[1]+dy)*10)/10])};
  return {...b,x:b.x+dx,y:b.y+dy,...(b.type==='line'?{x2:b.x2+dx,y2:b.y2+dy}:{})};
}
export function shapeBetween(type:string,start:Point,end:Point,color:string,width:number){
  if(type==='line')return {type,x:start[0],y:start[1],x2:end[0],y2:end[1],color,width};
  return {type,x:Math.min(start[0],end[0]),y:Math.min(start[1],end[1]),w:Math.abs(end[0]-start[0]),h:Math.abs(end[1]-start[1]),color,width};
}
