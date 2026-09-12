import {apiFetch} from '@/aitech/auth';
'use client';
import {MessagesSquare,PenTool,FileText,KanbanSquare,Presentation,Vote,CalendarDays,RefreshCw,Library,Users,ArrowUpRight,Layers,Clock,Hand,Link as LinkIcon} from 'lucide-react';
import type {Tool} from '@/lib/catalog';
import {categories} from '@/lib/catalog';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription} from '@/components/ui/empty';
export const categoryIcons:Record<string,typeof Users>={talk:MessagesSquare,draw:PenTool,write:FileText,task:KanbanSquare,meet:Presentation,decide:Vote,plan:CalendarDays,reflect:RefreshCw,knowledge:Library,team:Users};
export const engineIcons:Record<string,typeof Users>={chat:MessagesSquare,canvas:PenTool,notes:FileText,tasks:KanbanSquare,agenda:Presentation,poll:Vote,schedule:CalendarDays,retro:RefreshCw,links:LinkIcon,directory:Users,timer:Clock,queue:Hand};
export function tone(t:Tool){const c=categories.find(c=>c.id===t.category)!;return {'--tone':c.color,'--wash':`${c.color}11`} as React.CSSProperties}
export function ToolIcon({tool}:{tool:Tool}){const I=engineIcons[tool.engine];return <span className="tool-icon" style={tone(tool)}><I/></span>}
export function Brand(){return <a href="/commons/" className="brand"><span className="brand-mark"><Layers/></span>COMMONS</a>}
export function Picker({value,onChange,options,label,disabled}:{value:string;onChange:(v:string)=>void;options:string[];label:string;disabled?:boolean}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label}><SelectValue placeholder={label}/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>}
export function Blank({title='まだ投稿はありません',text='最初のひとつを追加して、共同作業を始めましょう。'}:{title?:string;text?:string}){return <Empty className="empty-state"><EmptyHeader><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{text}</EmptyDescription></EmptyHeader></Empty>}
export function dateTime(n:number){return new Date(n).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}
export class RequestError extends Error { constructor(message:string,public status=0){super(message)} }
export async function api(path:string,data?:unknown,options:{signal?:AbortSignal}={}){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  const cancel=()=>controller.abort();
  if(options.signal?.aborted)controller.abort();
  options.signal?.addEventListener('abort',cancel,{once:true});
  try {
    const res=await apiFetch(path,{...(data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}),cache:'no-store',signal:controller.signal});
    let result:any;
    try{result=await res.json()}catch{throw new RequestError('応答を受け取れませんでした。入力を残して、再試行してください。',res.status)}
    if(!res.ok)throw new RequestError(result.error??'接続できませんでした。',res.status);
    return result;
  }catch(e){
    if(e instanceof RequestError)throw e;
    throw new RequestError(controller.signal.aborted?'通信がタイムアウトしました。入力を残して、再試行してください。':'接続できませんでした。通信状態を確認してください。');
  }finally{clearTimeout(timeout);options.signal?.removeEventListener('abort',cancel)}
}
export function download(name:string,data:string,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
