// Official providers only. Keys remain server-side; no trial, quota evasion or public proxy.
import {plain} from './core.mjs';
export function translationProvider(){
 if(Deno.env.get('DEEPL_AUTH_KEY'))return 'DeepL';
 if(Deno.env.get('GOOGLE_TRANSLATE_API_KEY'))return 'Google Cloud Translation';
 if(Deno.env.get('LIBRETRANSLATE_URL'))return 'LibreTranslate';
 return null;
}
export async function translateText(text:string,language:string){
 if(!text.trim())return '';
 const provider=translationProvider();let r:Response;
 if(provider==='DeepL'){
  const key=Deno.env.get('DEEPL_AUTH_KEY')!;
  r=await fetch(key.endsWith(':fx')?'https://api-free.deepl.com/v2/translate':'https://api.deepl.com/v2/translate',{method:'POST',headers:{Authorization:'DeepL-Auth-Key '+key,'Content-Type':'application/json'},body:JSON.stringify({text:[text],target_lang:'JA',preserve_formatting:true}),signal:AbortSignal.timeout(10000)});
  if(!r.ok){await r.body?.cancel();throw new Error('DeepL HTTP '+r.status);}const value=(await r.json()).translations?.[0]?.text;if(typeof value!=='string'||!value.trim())throw new Error('翻訳文を受信できませんでした');return value;
 }
 if(provider==='Google Cloud Translation'){
  r=await fetch('https://translation.googleapis.com/language/translate/v2',{method:'POST',headers:{'Content-Type':'application/json','X-goog-api-key':Deno.env.get('GOOGLE_TRANSLATE_API_KEY')!},body:JSON.stringify({q:text,target:'ja',format:'text'}),signal:AbortSignal.timeout(10000)});
  if(!r.ok){await r.body?.cancel();throw new Error('Google Cloud Translation HTTP '+r.status);}const value=(await r.json()).data?.translations?.[0]?.translatedText;if(typeof value!=='string'||!value.trim())throw new Error('翻訳文を受信できませんでした');return plain(value);
 }
 if(provider==='LibreTranslate'){
  const endpoint=new URL(Deno.env.get('LIBRETRANSLATE_URL')!);if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password)throw new Error('翻訳サーバーの設定を確認してください');
  r=await fetch(new URL('/translate',endpoint),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:text,source:language||'auto',target:'ja',format:'text',...(Deno.env.get('LIBRETRANSLATE_API_KEY')?{api_key:Deno.env.get('LIBRETRANSLATE_API_KEY')}:{})}),signal:AbortSignal.timeout(10000)});
  if(!r.ok){await r.body?.cancel();throw new Error('LibreTranslate HTTP '+r.status);}const value=(await r.json()).translatedText;if(typeof value!=='string'||!value.trim())throw new Error('翻訳文を受信できませんでした');return value;
 }
 throw new Error('翻訳APIが未設定です');
}
