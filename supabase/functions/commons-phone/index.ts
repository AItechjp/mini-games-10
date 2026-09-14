import {collect} from './core.mjs';
const PUBLIC_KEY='sb_publishable_IcEN-3GgzcLCHiyNLyRiCQ_RpkAhCGI';
const origins=new Set(['https://aitechd.com','https://www.aitechd.com']);
function headers(origin:string|null){return {'Access-Control-Allow-Origin':origin&&origins.has(origin)?origin:'https://aitechd.com','Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};}
let local:any=null,localAt=0,pending:Promise<any>|null=null;
async function database(query:string,method='GET',body?:unknown){
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!service)throw new Error('キャッシュに接続できません');
 const response=await fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/commons_phone_cache?'+query,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('取得状況を読み込めませんでした');
 return response.json();
}
async function snapshot(){
 if(local&&Date.now()-localAt<45000)return local;
 const [saved]=await database('id=eq.1&select=payload,refresh_after');
 if(saved?.payload&&Date.parse(saved.refresh_after)>Date.now()){local=saved.payload;localAt=Date.now();return local;}
 // Atomic conditional update: only one isolate collects sources within the five-minute window.
 const claimed=await database('id=eq.1&refresh_after=lte.'+encodeURIComponent(new Date().toISOString()),'PATCH',{refresh_after:new Date(Date.now()+300000).toISOString()});
 if(!claimed.length){if(saved?.payload)return saved.payload;throw new Error('初回の情報を収集中です。少し待って再確認してください');}
 const payload=await collect(saved?.payload||null);
 await database('id=eq.1','PATCH',{payload,updated_at:new Date().toISOString()});
 local=payload;localAt=Date.now();return payload;
}
Deno.serve(async request=>{
 const origin=request.headers.get('origin');const reply=(value:unknown,status=200)=>Response.json(value,{status,headers:headers(origin)});
 if(origin&&!origins.has(origin))return reply({error:'このサイトからは利用できません'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
 if(request.method!=='GET')return reply({error:'GETのみ利用できます'},405);
 // Public, read-only API-key validation; no login and no client-provided upstream URLs.
 if(request.headers.get('apikey')!==PUBLIC_KEY)return reply({error:'接続設定を確認してください'},401);
 if(new URL(request.url).search)return reply({error:'検索は端末内で行います'},400);
 try{if(!pending)pending=snapshot().finally(()=>{pending=null});return reply(await pending);}catch{return reply({error:'現在、情報源を確認できません。少し待って再確認してください。'},503);}
});
