import {database} from '@/db';
import {body,clean,failure,initialItems,limit,reply,session,ApiError} from '@/lib/server';
import {findTool} from '@/lib/catalog';
import {listedToolIds} from '@/lib/site-catalog';

export async function GET(request:Request){
  try{
    const s=await session(request),params=new URL(request.url).searchParams;
    const tool=params.get('tool');
    if(tool&&!findTool(tool))throw new ApiError(400,'ツールを確認してください。');
    const selected=tool?[tool]:params.get('listed')==='1'?[...listedToolIds]:[];
    const filter=selected.length?' AND r.tool IN ('+selected.map(()=>'?').join(',')+')':'';
    const result=await database().prepare('SELECT DISTINCT r.id, r.tool, r.title, r.updated FROM rooms r JOIN members m ON m.room = r.id WHERE m.actor = ?'+filter+' ORDER BY r.updated DESC LIMIT 30').bind(s.actor,...selected).all();
    return reply({rooms:result.results},200,s.cookie);
  }catch(e){return failure(e)}
}
export async function POST(request:Request){
  try{
    const s=await session(request),b=await body(request),tool=findTool(b.tool);
    if(!tool)throw new ApiError(400,'ツールを選択してください。');
    const title=clean(b.title,80),name=clean(b.name,32);
    if(!title||!name)throw new ApiError(400,'ルーム名と表示名を入力してください。');
    if(b.requestId!==undefined&&(typeof b.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(b.requestId)))throw new ApiError(400,'作成リクエストを確認してください。');
    const hash=b.requestId?await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s.actor+':'+b.requestId)):null;
    const id=hash?Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('').slice(0,32):crypto.randomUUID().replaceAll('-','');
    const db=database();
    const matches=(r:any)=>r.owner===s.actor&&r.tool===tool.id&&r.title===title;
    const existing=await db.prepare('SELECT owner,tool,title FROM rooms WHERE id = ?').bind(id).first();
    if(existing){if(!matches(existing))throw new ApiError(409,'作成内容が変わっています。入力を確認して、もう一度作成してください。');return reply({id},200,s.cookie)}
    await limit(s.actor,'create',12);
    const now=Date.now();
    await db.batch([
      db.prepare('INSERT INTO rooms (id, tool, title, owner, created, updated) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(id,tool.id,title,s.actor,now,now),
      db.prepare('INSERT INTO members (room, actor, name, seen) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND owner = ? AND tool = ? AND title = ?) ON CONFLICT(room,actor) DO NOTHING').bind(id,s.actor,name,now,id,s.actor,tool.id,title),
      ...initialItems(tool.id).map(i=>db.prepare('INSERT INTO items (room,id,kind,body,author,name,created,updated,revision) SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1 WHERE EXISTS (SELECT 1 FROM rooms WHERE id = ? AND owner = ? AND tool = ? AND title = ?) ON CONFLICT(room,id) DO NOTHING').bind(id,i.id,i.kind,JSON.stringify(i.body),s.actor,name,now,now,id,s.actor,tool.id,title)),
    ]);
    const created=await db.prepare('SELECT owner,tool,title FROM rooms WHERE id = ?').bind(id).first();
    if(!created||!matches(created))throw new ApiError(409,'作成内容が変わっています。入力を確認して、もう一度作成してください。');
    return reply({id},201,s.cookie);
  }catch(e){return failure(e)}
}
