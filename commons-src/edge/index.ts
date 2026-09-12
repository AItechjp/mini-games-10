import * as rooms from '@/app/api/rooms/route';
import * as room from '@/app/api/rooms/[id]/route';
import * as weather from '@/app/api/weather/route';
import * as bitcoin from '@/app/api/bitcoin/route';
import * as onion from '@/app/api/onion/route';
import * as openings from '@/app/api/openings/route';
import * as time from '@/app/api/ramen/time/route';
import * as sauna from '@/app/api/sauna/status/route';
const allowedOrigins=new Set(['https://aitechd.com','https://www.aitechd.com']);
async function digest(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('')}
function response(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
async function handle(request:Request){
 const url=new URL(request.url),path=url.pathname.replace(/^\/functions\/v1\/commons-api/,'').replace(/^\/commons-api/,'')||'/';
 const origin=request.headers.get('Origin');
 if(origin&&!allowedOrigins.has(origin))return response({error:'この操作はaitech内から行ってください。'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204});
 if(path==='/health'&&request.method==='GET')return response({ok:true,service:'commons',version:2,access:'public'});
 // These account and transfer endpoints are retired. All tools are public.
 if(path==='/account'||path.startsWith('/identity/')||path.startsWith('/migration/'))return response({error:'この機能は終了しました。コモンズは登録なしで使えます。'},410);
 const id=path.match(/^\/rooms\/([a-f0-9]{32})$/)?.[1];
 const guest=request.headers.get('X-Commons-Guest')??'';
 // A one-way digest separates the private browser key from public member IDs.
 // No client-supplied verified identity or former account header is trusted.
 const actor=await digest('commons-guest:'+(/^[a-f0-9]{64}$/.test(guest)?guest:crypto.randomUUID()));
 const headers=new Headers(request.headers);
 for(const key of ['Cookie','Authorization','X-Commons-Migration','X-Commons-Guest','X-Commons-Verified-Actor','X-Commons-Verified-Account'])headers.delete(key);
 headers.set('X-Commons-Verified-Actor',actor);
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
 if(origin&&allowedOrigins.has(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','apikey, content-type, x-client-info, x-region, x-commons-guest');headers.set('Access-Control-Max-Age','600')}
 return new Response(result.body,{status:result.status,headers});
});
