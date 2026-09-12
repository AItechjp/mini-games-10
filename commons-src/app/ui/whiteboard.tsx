'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {MousePointer2,PenTool,StickyNote,Square,Minus,Download,Trash2,Undo2,Redo2,RotateCw,Eraser,Maximize,Minimize,Type,Hand,ZoomIn,ZoomOut} from 'lucide-react';
import type {Tool} from '@/lib/catalog';
import type {Item} from '@/lib/types';
import type {Actions} from './room';
import {appendInk,canvasTextLayout,contains,pointAt,shapeBetween,strokePath,translate,type Point} from '@/lib/canvas-geometry';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {Slider} from '@/components/ui/slider';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel} from '@/components/ui/alert-dialog';
import {download} from './common';
import {DiscardChanges} from './discard-changes';
import {useDraft} from '@/hooks/use-draft';
import {draftScope} from '@/lib/drafts';
import {isCanvasRecovery,unresolvedDrawings,type CanvasRecovery,type CanvasDraft} from '@/lib/canvas-recovery';
import {DraftStatus} from './draft-status';

type Mode='pen'|'select'|'sticky'|'text'|'rect'|'line'|'pan';
type Draft=CanvasDraft;
type Gesture={mode:Mode;pointer:number;pointerType:string;start:Point;last:Point;points:Point[];epoch:number;color:string;width:number;item?:Item};
type TextEditor={kind:'sticky'|'text';x:number;y:number;epoch:number;item?:Item};

export default function Canvas({tool,actions:a}:{tool:Tool;actions:Actions}){
  const [mode,setMode]=useState<Mode>('pen');
  const [color,setColor]=useState('#24354e');
  const [width,setWidth]=useState(3);
  const [drawing,setDrawing]=useState<Draft|null>(null);
  const recovery=useDraft<CanvasRecovery>(draftScope(a.data.room.id,a.data.me,'canvas'),{entries:[],editor:null},isCanvasRecovery);
  const pending=recovery.value.entries;
  function setPending(update:Draft[]|((before:Draft[])=>Draft[])){recovery.setValue(v=>({...v,entries:typeof update==='function'?update(v.entries):update}))}
  const [hydrated,setHydrated]=useState(false);
  const [failed,setFailed]=useState<string[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [moving,setMoving]=useState<Record<string,any>|null>(null);
  const [sticky,setSticky]=useState<TextEditor|null>(null);
  const [text,setText]=useState('');
  const [fontSize,setFontSize]=useState(28);
  const [textWidth,setTextWidth]=useState(480);
  const [textColor,setTextColor]=useState('#24354e');
  const [savingText,setSavingText]=useState(false);
  const [stickyError,setStickyError]=useState('');
  const [discardSticky,setDiscardSticky]=useState(false);
  const [discardRecovery,setDiscardRecovery]=useState(false);
  const [clearDialog,setClearDialog]=useState<{id:string;revision:number}|null>(null);
  const [clearError,setClearError]=useState('');
  const [expanded,setExpanded]=useState(false);
  const [zoom,setZoom]=useState(1);
  const [redo,setRedo]=useState<Draft|null>(null);
  const svg=useRef<SVGSVGElement>(null),panel=useRef<HTMLDivElement>(null),viewport=useRef<HTMLDivElement>(null);
  const gesture=useRef<Gesture|null>(null),frame=useRef<number|undefined>(undefined);
  const pan=useRef<{pointer:number;start:Point;scroll:Point}|null>(null);
  const touches=useRef(new Map<number,Point>()),touchPanning=useRef(false);
  const historyBusy=useRef(false),textBusy=useRef(false);
  const zoomAnchor=useRef<{x:number;y:number}|null>(null);
  const epoch=a.data.room.canvas_epoch??0;
  const currentEpoch=useRef(epoch);currentEpoch.current=epoch;
  const items=useMemo(()=>a.data.items.filter(i=>['stroke','sticky','shape','text'].includes(i.kind)),[a.data.items]);
  const owner=a.data.room.owner===a.data.me;
  const textDirty=!!sticky&&(text!==String(sticky.item?.body.text??'')||(sticky.item?.kind==='text'&&(fontSize!==sticky.item.body.fontSize||textWidth!==sticky.item.body.w)));
  useEffect(()=>{
    if(!recovery.ready)return;
    const editor=recovery.value.editor;
    if(editor){setSticky(editor);setText(editor.text);setFontSize(editor.fontSize);setTextWidth(editor.textWidth);setTextColor(editor.textColor)}
    setFailed(recovery.value.entries.map(d=>d.id));setHydrated(true);
  },[recovery.ready]);
  useEffect(()=>{
    if(!hydrated)return;
    recovery.setValue(v=>({...v,editor:sticky&&textDirty?{...sticky,text,fontSize,textWidth,textColor}:null}));
  },[hydrated,sticky,text,textDirty,fontSize,textWidth,textColor]);
  useEffect(()=>{if(viewport.current&&viewport.current.clientWidth<600)setZoom(2)},[]);
  useEffect(()=>{
    if(recovery.ready)setPending(p=>unresolvedDrawings(p,a.data.items));
    setFailed(ids=>ids.filter(id=>!a.data.items.some(x=>x.id===id)));
  },[a.data.items,epoch,recovery.ready]);
  useEffect(()=>{
    gesture.current=null;setDrawing(null);setMoving(null);setSelected(null);setFailed([]);setRedo(null);
  },[epoch]);
  useEffect(()=>{
    const dirty=pending.length>0||!!drawing||textDirty;
    if(!dirty)return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};
    window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
  },[pending.length,drawing,textDirty]);
  useEffect(()=>()=>{if(frame.current)cancelAnimationFrame(frame.current)},[]);
  useEffect(()=>{
    const el=viewport.current,anchor=zoomAnchor.current;
    if(el&&anchor&&svg.current){const rect=svg.current.getBoundingClientRect();el.scrollLeft=anchor.x*rect.width-el.clientWidth/2;el.scrollTop=anchor.y*rect.height-el.clientHeight/2;zoomAnchor.current=null}
  },[zoom]);
  useEffect(()=>{
    function keys(e:KeyboardEvent){
      const target=e.target as HTMLElement;
      if(target.closest('input,textarea,select,[contenteditable=true],[role=dialog],[role=alertdialog]')||sticky||clearDialog||e.isComposing)return;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)void redoLast();else void undoLast();return}
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.key==='Escape'){gesture.current=null;setDrawing(null);setMoving(null);setSelected(null);setExpanded(false)}
      if(e.key.toLowerCase()==='p')setMode('pen');
      if(e.key.toLowerCase()==='v')setMode('select');
      if(e.key.toLowerCase()==='h')setMode('pan');
      if(e.key.toLowerCase()==='t'){e.preventDefault();setMode('text');openText('text',visibleCenter())}
      if(e.key==='+'||e.key==='='){e.preventDefault();changeZoom(zoom+.5)}
      if(e.key==='-'){e.preventDefault();changeZoom(zoom-.5)}
      if(e.key==='Enter'&&selected&&!target.closest('button,[role=button]')){const item=items.find(i=>i.id===selected);if(item&&['text','sticky'].includes(item.kind)){e.preventDefault();editSticky(item)}}
      if(e.key==='Delete'||e.key==='Backspace'){
        const item=items.find(i=>i.id===selected);
        if(item&&(owner||item.author===a.data.me)){e.preventDefault();a.remove(item)}
      }
    }
    window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);
  },[items,selected,owner,a,sticky,clearDialog,zoom,redo,pending]);
  function coords(e:{clientX:number;clientY:number}):Point{return pointAt(e.clientX,e.clientY,svg.current!.getBoundingClientRect())}
  function visibleCenter():Point{
    const el=viewport.current;if(!el||!svg.current)return [360,200];
    const rect=el.getBoundingClientRect();return coords({clientX:rect.left+el.clientWidth/2,clientY:rect.top+el.clientHeight/2});
  }
  function changeZoom(value:number){
    if(gesture.current)return;
    const next=Math.max(1,Math.min(4,value)),el=viewport.current;
    if(el&&next!==zoom&&svg.current){const rect=svg.current.getBoundingClientRect();zoomAnchor.current={x:(el.scrollLeft+el.clientWidth/2)/rect.width,y:(el.scrollTop+el.clientHeight/2)/rect.height}}
    setZoom(next);
  }
  async function persist(d:Draft){
    if(d.epoch!==currentEpoch.current)return false;
    if(a.data.items.some(item=>item.id===d.id))return true;
    const ok=await a.add(d.kind,d.body,d.id,d.epoch);
    if(!ok&&d.epoch===currentEpoch.current)setFailed(ids=>[...new Set([...ids,d.id])]);
    return ok;
  }
  function saveDraft(kind:string,body:Record<string,any>,savedEpoch:number){
    const draft={id:crypto.randomUUID(),kind,body,epoch:savedEpoch};
    setRedo(null);setPending(p=>[...p,draft]);void persist(draft);
  }
  function paint(g:Gesture){
    // One scheduled frame reads the newest samples. Repeated cancellation can
    // starve presentation when a pen supplies more events than the display.
    if(frame.current!==undefined)return;
    frame.current=requestAnimationFrame(()=>{
      frame.current=undefined;
      if(gesture.current!==g)return;
      if(g.mode==='select'&&g.item)setMoving(translate(g.item,[g.last[0]-g.start[0],g.last[1]-g.start[1]]));
      else setDrawing({id:'draft',kind:g.mode==='pen'?'stroke':'shape',epoch:g.epoch,body:g.mode==='pen'?{points:[...g.points],color:g.color,width:g.width,smooth:true}:shapeBetween(g.mode,g.start,g.last,g.color,g.width)});
    });
  }
  function touchCenter():Point{const points=[...touches.current.values()];return [points.reduce((n,p)=>n+p[0],0)/points.length,points.reduce((n,p)=>n+p[1],0)/points.length]}
  function down(e:React.PointerEvent<SVGSVGElement>){
    if(e.button!==0||!hydrated)return;
    if(e.pointerType==='touch'){
      if(gesture.current?.pointerType==='pen')return;
      touches.current.set(e.pointerId,[e.clientX,e.clientY]);
      if(touches.current.size>1&&viewport.current){
        e.preventDefault();gesture.current=null;setDrawing(null);setMoving(null);touchPanning.current=true;
        pan.current={pointer:e.pointerId,start:touchCenter(),scroll:[viewport.current.scrollLeft,viewport.current.scrollTop]};e.currentTarget.setPointerCapture(e.pointerId);return;
      }
    }
    if(gesture.current||pan.current)return;
    e.preventDefault();const p=coords(e);
    if(mode==='pan'&&viewport.current){pan.current={pointer:e.pointerId,start:[e.clientX,e.clientY],scroll:[viewport.current.scrollLeft,viewport.current.scrollTop]};e.currentTarget.setPointerCapture(e.pointerId);return}
    if(mode==='sticky'||mode==='text'){openText(mode,p);return}
    let item:Item|undefined;
    if(mode==='select'){item=[...items].reverse().find(i=>contains(i,p));setSelected(item?.id??null);if(!item)return}
    const g={mode,pointer:e.pointerId,pointerType:e.pointerType,start:p,last:p,points:[p],epoch,color,width,item};
    gesture.current=g;e.currentTarget.setPointerCapture(e.pointerId);paint(g);
  }
  function move(e:React.PointerEvent<SVGSVGElement>){
    if(touches.current.has(e.pointerId))touches.current.set(e.pointerId,[e.clientX,e.clientY]);
    const navigation=pan.current;
    if(navigation&&viewport.current&&(touchPanning.current||navigation.pointer===e.pointerId)){
      const p=touchPanning.current?touchCenter():[e.clientX,e.clientY];
      viewport.current.scrollLeft=navigation.scroll[0]+navigation.start[0]-p[0];viewport.current.scrollTop=navigation.scroll[1]+navigation.start[1]-p[1];return;
    }
    const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;
    const p=coords(e);g.last=p;
    if(g.mode==='pen'){
      const samples=e.nativeEvent.getCoalescedEvents?.()??[];
      const rect=svg.current!.getBoundingClientRect();
      for(const sample of samples)appendInk(g.points,pointAt(sample.clientX,sample.clientY,rect));
      appendInk(g.points,p);
    }
    paint(g);
  }
  function up(e:React.PointerEvent<SVGSVGElement>){
    touches.current.delete(e.pointerId);
    if(touchPanning.current||pan.current?.pointer===e.pointerId){
      if(!touches.current.size){pan.current=null;touchPanning.current=false}
      else if(pan.current){pan.current.start=touchCenter();pan.current.scroll=[viewport.current!.scrollLeft,viewport.current!.scrollTop]}
      return;
    }
    const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;
    gesture.current=null;if(frame.current!==undefined)cancelAnimationFrame(frame.current);frame.current=undefined;
    const p=coords(e);g.last=p;setDrawing(null);setMoving(null);
    if(g.epoch!==currentEpoch.current){a.notify('キャンバスが更新されたため、描画を中断しました');return}
    if(g.mode==='select'&&g.item){
      const body=translate(g.item,[p[0]-g.start[0],p[1]-g.start[1]]);
      if(JSON.stringify(body)!==JSON.stringify(g.item.body))void a.request({op:'edit',id:g.item.id,revision:g.item.revision,body,epoch:g.epoch});
      return;
    }
    if(g.mode==='pen'){
      appendInk(g.points,p,0);
      saveDraft('stroke',{points:g.points,color:g.color,width:g.width,smooth:true},g.epoch);
    }else if(Math.hypot(p[0]-g.start[0],p[1]-g.start[1])>=2)saveDraft('shape',shapeBetween(g.mode,g.start,p,g.color,g.width),g.epoch);
  }
  function cancel(e:React.PointerEvent){touches.current.delete(e.pointerId);if(!touches.current.size){pan.current=null;touchPanning.current=false}if(gesture.current?.pointer===e.pointerId){gesture.current=null;setDrawing(null);setMoving(null)}}
  function openText(kind:'sticky'|'text',p:Point,item?:Item){
    setSticky({kind,x:p[0],y:p[1],epoch,item});setText(item?.body.text??'');setTextColor(item?.body.color??color);setFontSize(item?.body.fontSize??fontSize);setTextWidth(item?.body.w??textWidth);setStickyError('');
    touches.current.clear();pan.current=null;touchPanning.current=false;
  }
  function editSticky(item:Item){openText(item.kind as 'text'|'sticky',[item.body.x,item.body.y],item)}
  async function undoLast(){
    const last=items.filter(i=>i.author===a.data.me).at(-1);
    if(!last||a.busy||pending.length||historyBusy.current||gesture.current)return;
    if(a.data.items.some(i=>i.kind==='comment'&&i.body.parent===last.id)){a.remove(last);return}
    historyBusy.current=true;
    try{if(await a.request({op:'delete',id:last.id,revision:last.revision,epoch})&&currentEpoch.current===epoch){setRedo({id:crypto.randomUUID(),kind:last.kind,body:last.body,epoch});setSelected(null)}}finally{historyBusy.current=false}
  }
  async function redoLast(){
    if(!redo||a.busy||pending.length||historyBusy.current||redo.epoch!==epoch)return;
    historyBusy.current=true;
    try{setPending(p=>[...p,redo]);if(await persist(redo))setRedo(null)}finally{historyBusy.current=false}
  }
  function render(item:{id:string;kind:string;body:Record<string,any>},temporary=false){
    const b=item.id===selected&&moving?moving:item.body;
    const sw=Number(b.width)||4,c=/^#[0-9a-f]{6}$/i.test(b.color)?b.color:'#3455ee';
    const chosen=item.id===selected;
    if(item.kind==='stroke'){
      const points=b.points as Point[],dot=points.every(p=>p[0]===points[0][0]&&p[1]===points[0][1]),path=strokePath(points,b.smooth===true);
      return <g key={item.id} data-unsaved={temporary||undefined}>
        {chosen&&<path data-canvas-ui d={path} stroke="#91aaff66" strokeWidth={sw+11} fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
        {dot?<circle cx={points[0][0]} cy={points[0][1]} r={sw/2} fill={c}/>:<path d={path} stroke={c} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round"/>}
      </g>;
    }
    if(item.kind==='shape')return <g key={item.id}>{b.type==='line'?<><line x1={b.x} y1={b.y} x2={b.x2} y2={b.y2} stroke={c} strokeWidth={sw} strokeLinecap="round"/>{chosen&&<line data-canvas-ui x1={b.x} y1={b.y} x2={b.x2} y2={b.y2} stroke="#91aaff66" strokeWidth={sw+10}/>}</>:<><rect x={b.x} y={b.y} width={Math.max(1,b.w)} height={Math.max(1,b.h)} fill={`${c}0a`} stroke={c} strokeWidth={sw} rx={4}/>{chosen&&<rect data-canvas-ui x={b.x-4} y={b.y-4} width={b.w+8} height={b.h+8} fill="none" stroke="#6380ee" strokeWidth={1} strokeDasharray="5 4"/>}</>}</g>;
    if(item.kind==='text'){
      const layout=canvasTextLayout(b.text,b.fontSize,b.w);
      return <g key={item.id} onDoubleClick={()=>{const i=items.find(i=>i.id===item.id);if(i&&mode==='select')editSticky(i)}}>
        {chosen&&<rect data-canvas-ui x={b.x-4} y={b.y-4} width={b.w+8} height={layout.height+8} fill="#3455ee08" stroke="#6380ee" strokeWidth={1} strokeDasharray="5 4"/>}
        <text x={b.x} y={b.y+b.fontSize} fill={c} fontSize={b.fontSize} fontFamily="ui-monospace, monospace" xmlSpace="preserve">{layout.lines.map((line,index)=><tspan key={index} x={b.x} y={b.y+b.fontSize+index*layout.lineHeight}>{line||' '}</tspan>)}</text>
      </g>;
    }
    return <g key={item.id}><foreignObject x={b.x} y={b.y} width="195" height="140"><div className="canvas-sticky" style={{background:/^#[0-9a-f]{6}$/i.test(b.fill)?b.fill:'#fff1b8'}} onDoubleClick={()=>{const i=items.find(i=>i.id===item.id);if(i&&mode==='select')editSticky(i)}}>{b.text}</div></foreignObject>{chosen&&<rect data-canvas-ui x={b.x} y={b.y} width={195} height={140} fill="none" stroke="#3455ee" strokeWidth={2}/>}</g>;
  }
  const saved=useMemo(()=>items.map(i=>render(i)),[items,selected,moving,mode]);
  const textLayout=useMemo(()=>canvasTextLayout(text,fontSize,textWidth),[text,fontSize,textWidth]);
  async function saveSticky(e:React.FormEvent){
    e.preventDefault();if(!sticky||textBusy.current||!text.trim()||!hydrated)return;
    if(sticky.epoch!==epoch){setStickyError('入力中にキャンバスがクリアされました。必要な文章をコピーし、最新のキャンバスに新しく追加してください。');return}
    if(sticky.kind==='text'&&textLayout.height>800){setStickyError('文字が盤面に収まりません。サイズを小さくするか、文章を分けてください。');return}
    const w=sticky.kind==='text'?textWidth:195,h=sticky.kind==='text'?textLayout.height:140;
    const body={...sticky.item?.body,text,x:Math.max(0,Math.min(sticky.x,1200-w)),y:Math.max(0,Math.min(sticky.y,800-h)),color:textColor,...(sticky.kind==='text'?{fontSize,w:textWidth}:{fill:sticky.item?.body.fill??'#fff1b8'})};
    textBusy.current=true;setSavingText(true);
    try{
      const ok=await recovery.submit((_value,operationId)=>sticky.item?a.request({op:'edit',id:sticky.item.id,revision:sticky.item.revision,body,epoch:sticky.epoch}):a.add(sticky.kind,body,operationId({kind:sticky.kind,body,epoch:sticky.epoch}),sticky.epoch),value=>({...value,editor:null}),{entries:[],editor:null});
      if(ok){setSticky(null);setText('');setRedo(null);setMode('select');if(sticky.item)setSelected(sticky.item.id)}else setStickyError('保存できませんでした。入力は残っています。上部のメッセージを確認してください。');
    }finally{textBusy.current=false;setSavingText(false)}
  }
  async function clear(){
    if(!clearDialog)return;setClearError('');
    if(await a.request({op:'clear_canvas',id:clearDialog.id,revision:clearDialog.revision})){
      setClearDialog(null);setPending([]);setFailed([]);setSelected(null);setRedo(null);a.notify('キャンバスをクリアしました。次の描画まで取り消せます。');
    }else setClearError('クリアできませんでした。最新のキャンバスを確認して、もう一度お試しください。');
  }
  function exportCanvas(){
    if(!svg.current)return;
    const clone=svg.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width','1200');clone.setAttribute('height','800');
    clone.removeAttribute('style');clone.removeAttribute('class');clone.removeAttribute('tabindex');clone.querySelectorAll('[data-canvas-ui]').forEach(n=>n.remove());
    clone.querySelectorAll('foreignObject div').forEach(d=>{d.setAttribute('xmlns','http://www.w3.org/1999/xhtml');d.setAttribute('style',`${d.getAttribute('style')??''};padding:13px;font:16px sans-serif;white-space:pre-wrap;height:100%;overflow:hidden;color:#283756;`)});
    download(`commons-${tool.id}.svg`,new XMLSerializer().serializeToString(clone),'image/svg+xml');a.notify('キャンバスを書き出しました');
  }
  const selectedItem=items.find(i=>i.id===selected),last=items.filter(i=>i.author===a.data.me).at(-1);
  const clearChanged=clearDialog&&clearDialog.revision!==a.data.room.canvas_revision;
  const failedDrafts=pending.filter(d=>failed.includes(d.id)||d.epoch!==epoch);
  const retryable=failedDrafts.filter(d=>d.epoch===epoch);
  const oldDrafts=failedDrafts.filter(d=>d.epoch!==epoch);
  return <div ref={panel} className={`panel canvas-panel ${expanded?'canvas-expanded':''}`}>
    <div className="canvas-toolbar" role="toolbar" aria-label="描画ツール">
      {([['select',MousePointer2,'選択'],['pen',PenTool,'ペン'],['text',Type,'文字'],['pan',Hand,'移動'],['sticky',StickyNote,'付箋'],['rect',Square,'四角'],['line',Minus,'直線']] as const).map(([m,I,label])=><Button key={m} variant={mode===m?'default':'ghost'} size="sm" aria-pressed={mode===m} onClick={()=>{setMode(m);setSelected(null);if(m==='text')openText('text',visibleCenter())}}><I size={15}/>{label}</Button>)}
      <div className="row colors" style={{gap:10}}>{['#3455ee','#24354e','#e56261','#1a9b83','#bc67cd','#e0a434'].map((c,i)=><button key={c} className={`color-swatch ${color===c?'selected':''}`} style={{background:c}} aria-label={`ペンの色：${['青','黒','赤','緑','紫','黄'][i]}`} aria-pressed={color===c} onClick={()=>setColor(c)}/>)}<span className="canvas-width-label">太さ {width}</span><Slider style={{width:90}} aria-label="ペンの太さ" min={1} max={14} step={1} value={[width]} onValueChange={v=>setWidth(v[0])}/></div>
    </div>
    <div className="canvas-toolbar canvas-actions">
      <div className="row canvas-zoom" role="group" aria-label="キャンバスの拡大率"><Button variant="ghost" size="sm" aria-label="縮小" disabled={zoom<=1||!!drawing} onClick={()=>changeZoom(zoom-.5)}><ZoomOut size={17}/></Button><button className="canvas-fit" onClick={()=>changeZoom(1)} title="全体を表示" aria-label={`拡大率${zoom*100}%。押すと全体を表示`}>{zoom*100}%</button><Button variant="ghost" size="sm" aria-label="拡大" disabled={zoom>=4||!!drawing} onClick={()=>changeZoom(zoom+.5)}><ZoomIn size={17}/></Button></div>
      <span className="small muted grow">{items.length}件</span>
      <div className="row wrap" style={{gap:3}}>
        {selectedItem&&['sticky','text'].includes(selectedItem.kind)&&<Button variant="outline" size="sm" onClick={()=>editSticky(selectedItem)}>{selectedItem.kind==='text'?'文字':'付箋'}を編集</Button>}
        <Button variant="ghost" size="sm" title="自分の最後の描画を戻す（Ctrl / ⌘ + Z）" aria-label="自分の最後の描画を戻す" disabled={!last||a.busy||pending.length>0} onClick={()=>void undoLast()}><Undo2 size={16}/>戻す</Button>
        <Button variant="ghost" size="sm" title="戻した描画をやり直す（Ctrl / ⌘ + Shift + Z）" aria-label="戻した描画をやり直す" disabled={!redo||a.busy||pending.length>0} onClick={()=>void redoLast()}><Redo2 size={16}/></Button>
        <Button variant="ghost" size="sm" title="選択した項目を削除" aria-label="選択した項目を削除" disabled={!selectedItem||a.busy||(!owner&&selectedItem.author!==a.data.me)} onClick={()=>{if(selectedItem)a.remove(selectedItem)}}><Trash2 size={16}/></Button>
        <Button variant="ghost" size="sm" title="SVGで書き出す" aria-label="キャンバスをSVGで書き出す" disabled={pending.length>0||!!drawing||!!moving} onClick={exportCanvas}><Download size={16}/></Button>
        <Button variant="ghost" size="sm" aria-label={expanded?'表示を元に戻す':'キャンバスを広く表示'} aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?<Minimize size={16}/>:<Maximize size={16}/>}</Button>
        <Button className="canvas-clear" variant="outline" size="sm" title={owner?'すべての描画と付箋をクリア':'全体のクリアはルーム作成者が行えます'} disabled={!owner||a.busy||(!items.length&&!pending.length)} onClick={()=>{setClearError('');setClearDialog({id:crypto.randomUUID(),revision:a.data.room.canvas_revision??0})}}><Eraser size={16}/>クリア</Button>
      </div>
    </div>
    {owner&&a.data.canvasUndo&&<div className="canvas-undo"><span>キャンバスをクリアしました</span><Button variant="ghost" size="sm" disabled={a.busy} onClick={async()=>{if(await a.request({op:'restore_canvas',id:a.data.canvasUndo!.id}))a.notify('クリア前のキャンバスに戻しました')}}><Undo2 size={15}/>クリアを取り消す</Button><span className="form-hint">次の描画・編集まで有効</span></div>}
    {failedDrafts.length>0&&<div className="notice row wrap"><span>{failedDrafts.length}件の描画が未保存です。{oldDrafts.length>0?'クリア前の描画は再送せず、ファイルに保存できます。':'再試行して共有できます。'}</span><Button variant="outline" disabled={a.busy||!retryable.length} onClick={async()=>{for(const d of retryable)await persist(d)}}><RotateCw size={14}/>再試行</Button><Button variant="ghost" onClick={()=>download(`commons-unsaved-${tool.id}.json`,JSON.stringify(failedDrafts,null,2))}>未保存の描画を保存</Button>{oldDrafts.length>0&&<Button variant="ghost" onClick={()=>setDiscardRecovery(true)}>クリア前の控えを破棄</Button>}</div>}
    {(recovery.dirty||recovery.issue)&&<DraftStatus draft={recovery}/>}
    <div ref={viewport} className="canvas-viewport canvas-writing-viewport" tabIndex={0} aria-label="ホワイトボードの表示範囲。拡大後は移動ツール、2本指、または矢印キーで移動できます。"><div className="canvas-stage" style={{width:`${zoom*100}%`,'--canvas-zoom':zoom} as React.CSSProperties}><svg ref={svg} viewBox="0 0 1200 800" preserveAspectRatio="xMinYMin meet" aria-label="共同ホワイトボード。ペンで手書き、文字ツールで入力できます。" role="img" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} style={{cursor:mode==='pan'?'grab':mode==='pen'?'crosshair':mode==='select'?'default':mode==='text'?'text':'crosshair'}}>
      {tool.labels.length>1&&tool.labels.map((label,i)=>{const cols=tool.labels.length===4?2:tool.labels.length===6?3:tool.labels.length,rows=Math.ceil(tool.labels.length/cols),x=i%cols*1200/cols,y=Math.floor(i/cols)*800/rows;return <g key={label} pointerEvents="none"><rect x={x+8} y={y+8} width={1200/cols-16} height={800/rows-16} fill="none" stroke="#d8dfed" strokeDasharray="6 5" rx={8}/><text x={x+24} y={y+38} fontSize="18" fill="#7587a4" fontFamily="sans-serif">{label}</text></g>})}
      {saved}{pending.filter(d=>d.epoch===epoch&&!items.some(i=>i.id===d.id)).map(d=>render(d,true))}{drawing&&render(drawing,true)}
    </svg></div></div>
    <div className="canvas-hint">{mode==='select'?'選んで移動。文字は「文字を編集」またはダブルクリックで編集。':mode==='sticky'?'置きたい場所をタップして付箋を追加。':mode==='text'?'置きたい場所をタップして文字を入力。':mode==='pan'?'ドラッグして表示範囲を移動。ペンに戻すと書けます。':'細かい文字は＋で拡大すると書きやすくなります。保存中も続けて書けます。'}<span className="canvas-writing-tip">拡大後は「移動」か2本指でスクロール。P：ペン / T：文字 / H：移動</span>{pending.length>0&&<strong> {failedDrafts.length?`${failedDrafts.length}件が未保存`:`${pending.length}件を保存中`}</strong>}</div>
    <Dialog open={!!sticky} onOpenChange={v=>{if(!v&&!savingText){if(text!==String(sticky?.item?.body.text??'')||(sticky?.item?.kind==='text'&&(fontSize!==sticky.item.body.fontSize||textWidth!==sticky.item.body.w)))setDiscardSticky(true);else setSticky(null)}}}><DialogContent><DialogHeader><DialogTitle>{sticky?.kind==='text'?'文字':'付箋'}を{sticky?.item?'編集':'追加'}</DialogTitle><DialogDescription>{sticky?.kind==='text'?'手書きせずに文字を置けます。改行・日本語入力に対応。保存後は選んで移動できます。':'240文字まで。短い言葉でアイデアを書きましょう。'}</DialogDescription></DialogHeader><form onSubmit={saveSticky} className="stack">
      {sticky?.kind==='text'&&<div className="canvas-type-settings"><label>文字サイズ<select value={fontSize} disabled={savingText} onChange={e=>setFontSize(Number(e.target.value))}>{[16,20,28,40,56,64].map(size=><option value={size} key={size}>{size}</option>)}</select></label><label>折り返し幅<select value={textWidth} disabled={savingText} onChange={e=>setTextWidth(Number(e.target.value))}>{[[240,'狭い'],[480,'標準'],[720,'広い'],[1000,'最大']].map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label></div>}
      <Textarea className="canvas-type-input" autoFocus required disabled={savingText} maxLength={sticky?.kind==='text'?1000:240} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit()}}} aria-label={sticky?.kind==='text'?'文字の内容':'付箋の内容'} placeholder={sticky?.kind==='text'?'ここに文字を入力…\n改行もできます':'アイデアを入力…'}/>
      <span className="form-hint">{text.length} / {sticky?.kind==='text'?1000:240} · Ctrl / ⌘ + Enter で保存</span>
      {sticky?.kind==='text'&&text&&<div className="canvas-type-preview" aria-label="文字のプレビュー"><svg viewBox={`0 0 ${textWidth} ${Math.min(textLayout.height,800)}`} role="img" aria-label={text}><text fill={textColor} fontSize={fontSize} fontFamily="ui-monospace, monospace" xmlSpace="preserve">{textLayout.lines.map((line,index)=><tspan key={index} x={0} y={fontSize+index*textLayout.lineHeight}>{line||' '}</tspan>)}</text></svg></div>}
      {(stickyError||(sticky?.kind==='text'&&textLayout.height>800))&&<p className="notice" role="alert">{stickyError||'文字が盤面に収まりません。サイズを小さくするか、文章を分けてください。'}</p>}<Button disabled={savingText||a.busy||!text.trim()||(sticky?.kind==='text'&&textLayout.height>800)}>{savingText?'保存中…':'保存する'}</Button></form></DialogContent></Dialog>
    <AlertDialog open={discardRecovery} onOpenChange={setDiscardRecovery}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>クリア前の未送信描画を破棄しますか？</AlertDialogTitle><AlertDialogDescription>{oldDrafts.length}件の控えをこのタブから削除します。必要な場合は先に「未保存の描画を保存」で書き出してください。共有済みのキャンバスは変更しません。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>キャンセル</AlertDialogCancel><Button variant="destructive" onClick={()=>{setPending(entries=>entries.filter(d=>d.epoch===epoch));setDiscardRecovery(false)}}>控えを破棄する</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <DiscardChanges open={discardSticky} onOpenChange={setDiscardSticky} onDiscard={()=>setSticky(null)}/>
    <AlertDialog open={!!clearDialog} onOpenChange={v=>{if(!v&&!a.busy)setClearDialog(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>キャンバスをクリアしますか？</AlertDialogTitle><AlertDialogDescription>{items.length}件の描画・文字・付箋を全員の画面から消します。ルームの会話は残ります。次の描画・編集が入るまでは、クリアを取り消せます。</AlertDialogDescription></AlertDialogHeader>{(clearError||clearChanged)&&<p className="notice" role="alert">{clearChanged?'確認中に新しい変更が入りました。キャンセルして内容を確認してください。':clearError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={a.busy}>キャンセル</AlertDialogCancel><Button variant="destructive" disabled={a.busy||!!clearChanged} onClick={clear}>{a.busy?'クリア中…':'すべてクリア'}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
