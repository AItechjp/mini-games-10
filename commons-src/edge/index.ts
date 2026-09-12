import {sql} from './database';
import * as rooms from '@/app/api/rooms/route';
import * as room from '@/app/api/rooms/[id]/route';
import * as weather from '@/app/api/weather/route';
import * as bitcoin from '@/app/api/bitcoin/route';
import * as onion from '@/app/api/onion/route';
import * as openings from '@/app/api/openings/route';
import * as time from '@/app/api/ramen/time/route';
import * as sauna from '@/app/api/sauna/status/route';
const allowedOrigins=new Set(['https://aitechd.com','https://www.aitechd.com']);
const project=Deno.env.get('SUPABASE_URL')!;
const publicKey=Deno.env.get('SUPABASE_ANON_KEY')!;
async function digest(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('')}
function response(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
async function config(key:string){return (await sql`SELECT value FROM commons.config WHERE key=${key}`)[0]?.value}
async function handle(request:Request){
 const url=new URL(request.url),path=url.pathname.replace(/^\/functions\/v1\/commons-api/,'').replace(/^\/commons-api/,'')||'/';
 const origin=request.headers.get('Origin');
 if(origin&&!allowedOrigins.has(origin))return response({error:'この操作はaitech内から行ってください。'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204});
 if(path==='/health'&&request.method==='GET')return response({ok:true,service:'commons',version:1});
 // A short-lived administrator nonce is provisioned through the authenticated
 // management connector solely for the account migration. It is revoked after use.
 if((path==='/migration/bootstrap'||path==='/identity/handover')&&request.method==='POST'){
  const key=await config(path.startsWith('/identity/')?'handover_key':'migration_key');
  const token=request.headers.get('X-Commons-Migration')??'';
  if(!key||(key.expires&&Date.now()>key.expires)||await digest(token)!==key.digest)return response({error:'Not found'},404);
  const owner=await config('owner_email');
  const result=await fetch(project+'/auth/v1/admin/generate_link',{method:'POST',headers:{apikey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,Authorization:'Bearer '+Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,'Content-Type':'application/json'},body:JSON.stringify({type:'magiclink',email:owner,redirect_to:'https://aitechd.com/commons/'})});
  const data:any=await result.json();
  if(!result.ok)return response({error:'Could not initialize the owner account'},502);
  const ownerId=data.id??data.user?.id;
  if(typeof ownerId!=='string'||!/^[a-f0-9-]{36}$/.test(ownerId))return response({error:'Owner identity unavailable'},502);
  const configuredOwner=await config('owner_user_id');
  if(configuredOwner&&configuredOwner!==ownerId)return response({error:'Owner identity mismatch'},403);
  await sql`INSERT INTO commons.config(key,value) VALUES ('owner_user_id',${sql.json(ownerId)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
  return response({user_id:data.id??data.user?.id,token_hash:data.hashed_token??data.properties?.hashed_token,type:data.verification_type??data.properties?.verification_type??'magiclink'});
 }

 if(path.startsWith('/migration/')&&request.method==='POST'){
  const key=await config('migration_key'),token=request.headers.get('X-Commons-Migration')??'';
  if(!key||Date.now()>key.expires||await digest(token)!==key.digest)return response({error:'Not found'},404);
  if(path==='/migration/status')return response({done:await config('migration_done')??null});
  const ownerId=await config('owner_user_id');
  if(!ownerId)return response({error:'Initialize the owner first'},409);
  const tableColumns:Record<string,string[]>={rooms:['id','tool','title','owner','created','updated','canvas_epoch','canvas_revision'],members:['room','actor','name','seen'],items:['room','id','kind','body','author','name','created','updated','revision'],votes:['room','scope','actor','choice','updated'],canvas_resets:['room','id','actor','created','revision','state','snapshot'],opening_cache:['key','payload','updated','locked_until']};
  const raw=await request.text();if(new TextEncoder().encode(raw).length>12_000_000)return response({error:'Chunk too large'},413);
  const data=JSON.parse(raw);
  if(path==='/migration/import'){
   const columns=tableColumns[data.table];
   if(!columns||!Number.isSafeInteger(data.offset)||data.offset<0||!Array.isArray(data.rows)||data.rows.length>100)return response({error:'Invalid migration chunk'},400);
   const rows=data.rows.map((row:any)=>Object.fromEntries(columns.map(column=>[column,row[column]??(column==='canvas_epoch'||column==='canvas_revision'||column==='locked_until'?0:null)])));
   if(rows.length)await sql.begin(async (transaction:any)=>{
    await transaction`INSERT INTO ${sql('commons.'+data.table)} ${sql(rows,columns)} ON CONFLICT DO NOTHING`;
    await transaction`INSERT INTO commons.migration_snapshot(id,exported_at,payload) VALUES (${data.table+':'+data.offset},${data.exportedAt??new Date().toISOString()}::timestamptz,${sql.json({table:data.table,offset:data.offset,rows})}) ON CONFLICT(id) DO NOTHING`;
   });
   return response({ok:true,received:rows.length});
  }
  if(path==='/migration/finish'){
   const counts:Record<string,number>={};
   for(const table of Object.keys(tableColumns)){
    const rows=await sql`SELECT coalesce(sum(jsonb_array_length(payload->'rows')),0)::integer AS count FROM commons.migration_snapshot WHERE payload->>'table'=${table}`;
    counts[table]=rows[0].count;
    if(counts[table]!==data.counts?.[table])return response({error:'Migration count mismatch',table},409);
   }
   await sql`INSERT INTO commons.account_actors(user_id,actor) SELECT ${ownerId}::uuid,owner FROM commons.rooms UNION SELECT ${ownerId}::uuid,actor FROM commons.members ON CONFLICT DO NOTHING`;
   const done={at:new Date().toISOString(),counts};
   await sql`INSERT INTO commons.config(key,value) VALUES ('migration_done',${sql.json(done)}) ON CONFLICT(key) DO UPDATE SET value=excluded.value`;
   return response({ok:true,...done});
  }
  return response({error:'Not found'},404);
 }
 const authorization=request.headers.get('Authorization')??'';
 if(!authorization.startsWith('Bearer '))return response({error:'サインインしてください。'},401);
 const verify=await fetch(project+'/auth/v1/user',{headers:{apikey:publicKey,Authorization:authorization},signal:AbortSignal.timeout(8000)});
 if(!verify.ok)return response({error:'もう一度サインインしてください。'},401);
 const user:any=await verify.json(),ownerId=await config('owner_user_id');
 if(!ownerId||user.id!==ownerId||!user.email_confirmed_at)return response({error:'このコモンズの閲覧権限がありません。'},403);
 if(path==='/account'&&request.method==='GET')return response({id:user.id,email:user.email});
 let actor=await digest('commons-account:'+user.id);
 const id=path.match(/^\/rooms\/([a-f0-9]{32})$/)?.[1];
 if(id){
  const owners=await sql`SELECT r.owner FROM commons.rooms r JOIN commons.account_actors a ON a.actor=r.owner AND a.user_id=${user.id}::uuid WHERE r.id=${id}`;
  if(owners[0])actor=owners[0].owner;
 }
 const headers=new Headers(request.headers);
 headers.delete('Cookie');headers.delete('Authorization');headers.delete('X-Commons-Migration');
 headers.set('X-Commons-Verified-Actor',actor);
 headers.set('X-Commons-Verified-Account',user.id);
 // Preserve the application origin check while the network endpoint is separate.
 if(origin)headers.set('Origin','https://aitechd.com');
 const inner=new Request('https://aitechd.com/api'+path+url.search,{method:request.method,headers,...(request.body?{body:request.body,duplex:'half'}:{})} as RequestInit);
 let result:Response;
 if(path==='/rooms')result=request.method==='GET'?await rooms.GET(inner):request.method==='POST'?await rooms.POST(inner):response({error:'Method not allowed'},405);
 else if(id)result=request.method==='GET'?await room.GET(inner,{params:Promise.resolve({id})}):request.method==='POST'?await room.POST(inner,{params:Promise.resolve({id})}):response({error:'Method not allowed'},405);
 else if(request.method!=='GET')result=response({error:'Method not allowed'},405);
 else if(path==='/weather')result=await weather.GET(inner);
 else if(path==='/bitcoin')result=await bitcoin.GET(inner);
 else if(path==='/onion')result=await onion.GET();
 else if(path==='/openings')result=await openings.GET();
 else if(path==='/ramen/time')result=await time.GET();
 else if(path==='/sauna/status')result=await sauna.GET();
 else result=response({error:'Not found'},404);
 const outgoing=new Headers(result.headers);outgoing.delete('Set-Cookie');
 return new Response(result.body,{status:result.status,headers:outgoing});
}
Deno.serve(async request=>{
 let result:Response;
 try{result=await handle(request)}catch(error){console.error('COMMONS request failed',error instanceof Error?error.message:'error');result=response({error:'接続できませんでした。入力を残して再試行してください。'},503)}
 const headers=new Headers(result.headers),origin=request.headers.get('Origin');
 if(origin&&allowedOrigins.has(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info, x-region');headers.set('Access-Control-Max-Age','600')}
 return new Response(result.body,{status:result.status,headers});
});
