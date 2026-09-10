import {makeHandler} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if(!url||!key)throw new Error('Server configuration missing');
async function request(path:string,method='GET',body?:unknown){const r=await fetch(url+'/rest/v1/'+path,{method,headers:{apikey:key!,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});const d=await r.json();if(!r.ok){if(d?.code==='23505')return null;throw new Error('Database '+r.status+' '+d?.code);}return d;}
const db={
 async rate(bucket:string,limit:number,expires:string){return request('rpc/arcade_take_rate','POST',{p_bucket:bucket,p_limit:limit,p_expires:expires});},
 async get(code:string){return (await request('arcade_rooms?code=eq.'+code+'&limit=1'))?.[0];},
 async insert(row:unknown){return (await request('arcade_rooms','POST',row))?.[0];},
 async update(code:string,revision:number,patch:unknown){return (await request('arcade_rooms?code=eq.'+code+'&revision=eq.'+revision,'PATCH',patch))?.[0];},
 async cleanup(iso:string){await request('arcade_rooms?expires_at=lt.'+encodeURIComponent(iso),'DELETE');await request('arcade_rate_limits?expires_at=lt.'+encodeURIComponent(iso),'DELETE');}
};
Deno.serve(makeHandler(db));
