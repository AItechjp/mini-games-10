export const projectUrl='https://dcvtubivtextycifngtk.supabase.co';
export const publishableKey='sb_publishable_IcEN-3GgzcLCHiyNLyRiCQ_RpkAhCGI';
export const apiUrl=projectUrl+'/functions/v1/commons-api';
type Session={access_token:string;refresh_token:string;expires_at:number;user?:{email?:string}};
const storageKey='aitech_commons_auth_v1';
let memory:Session|null=null;
let refreshing:Promise<Session|null>|null=null;
function save(session:Session|null){memory=session;try{session?localStorage.setItem(storageKey,JSON.stringify(session)):localStorage.removeItem(storageKey)}catch{}}
async function authRequest(path:string,data?:unknown,token?:string,method='POST'){
 const response=await fetch(projectUrl+'/auth/v1/'+path,{method,headers:{apikey:publishableKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(15000)});
 const value:any=await response.json();
 if(!response.ok)throw new Error(response.status===429?'しばらく待ってから、もう一度お試しください。':value.msg??value.message??value.error_description??'サインインできませんでした。');
 return value;
}
function remember(value:any){if(!value||typeof value.access_token!=='string'||typeof value.refresh_token!=='string')throw new Error('認証の応答を確認できませんでした。');const session={...value,expires_at:value.expires_at??Math.floor(Date.now()/1000)+(value.expires_in??3600)} as Session;save(session);return session}
export async function getSession(){
 if(!memory){try{const value=JSON.parse(localStorage.getItem(storageKey)??'null');if(value?.access_token&&value?.refresh_token)memory=value}catch{}}
 if(!memory)return null;
 if(memory.expires_at>Date.now()/1000+90)return memory;
 if(!refreshing)refreshing=authRequest('token?grant_type=refresh_token',{refresh_token:memory.refresh_token}).then(remember).catch(()=>{save(null);return null}).finally(()=>{refreshing=null});
 return refreshing;
}
export async function activateFromLink(){
 const fragment=new URLSearchParams(location.hash.slice(1)),hash=fragment.get('token_hash');
 if(!hash)return false;
 // Authentication material never remains in the address or browser history.
 history.replaceState(null,'',location.pathname+location.search);
 const type=fragment.get('type')??'magiclink';if(!['magiclink','signup','invite','recovery','email'].includes(type))throw new Error('認証リンクを確認してください。');
 remember(await authRequest('verify',{token_hash:hash,type}));
 // Import only this app's local drafts after the destination verifies its owner.
 const legacy=fragment.get('legacy_drafts');
 if(legacy&&legacy.length<60000){
  await account();
  try{const entries=JSON.parse(legacy);if(entries&&typeof entries==='object'&&!Array.isArray(entries))for(const [key,value] of Object.entries(entries)){
   if((key==='commons_name'||key.startsWith('commons:draft:v1:'))&&typeof value==='string'&&localStorage.getItem(key)===null)localStorage.setItem(key,value);
  }}catch{}
 }
 return true;
}
export async function signIn(email:string,password:string){return remember(await authRequest('token?grant_type=password',{email:email.trim(),password}))}
export async function setPassword(password:string){const session=await getSession();if(!session)throw new Error('もう一度サインインしてください。');await authRequest('user',{password},session.access_token,'PUT')}
export async function signOut(){const session=await getSession();save(null);if(session)try{await authRequest('logout',undefined,session.access_token)}catch{}location.reload()}
export async function apiFetch(path:string,options:RequestInit={}){
 if(!path.startsWith('/api/')||path.startsWith('/api//'))throw new Error('APIのパスを確認してください。');
 const session=await getSession();
 if(!session)return Response.json({error:'サインインしてください。'},{status:401});
 const headers=new Headers(options.headers);headers.set('apikey',publishableKey);headers.set('x-region','ap-southeast-2');headers.set('Authorization','Bearer '+session.access_token);
 return fetch(apiUrl+path.slice(4),{...options,headers,credentials:'omit',cache:'no-store'});
}
export async function account(){const response=await apiFetch('/api/account');const value:any=await response.json();if(!response.ok)throw new Error(value.error??'サインインしてください。');return value as {id:string;email:string}}
