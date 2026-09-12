export const projectUrl='https://dcvtubivtextycifngtk.supabase.co';
export const publishableKey='sb_publishable_IcEN-3GgzcLCHiyNLyRiCQ_RpkAhCGI';
export const apiUrl=projectUrl+'/functions/v1/commons-api';
const storageKey='commons_guest_v1';
let guest='';

// A browser-local random key preserves a guest's own posts and recent rooms.
// No account, email, password, or authentication service is involved.
function guestKey(){
 if(guest)return guest;
 for(const name of ['localStorage','sessionStorage'] as const){
  try{const saved=window[name].getItem(storageKey);if(saved&&/^[a-f0-9]{64}$/.test(saved)){guest=saved;return guest}}catch{}
 }
 guest=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 for(const name of ['localStorage','sessionStorage'] as const){try{window[name].setItem(storageKey,guest)}catch{}}
 return guest;
}

export async function apiFetch(path:string,options:RequestInit={}){
 if(!path.startsWith('/api/')||path.startsWith('/api//'))throw new Error('APIのパスを確認してください。');
 const headers=new Headers(options.headers);
 headers.delete('Authorization');
 headers.set('apikey',publishableKey);
 headers.set('x-region','ap-southeast-2');
 headers.set('X-Commons-Guest',guestKey());
 return fetch(apiUrl+path.slice(4),{...options,headers,credentials:'omit',cache:'no-store'});
}
