import {z} from 'zod';
import {addressSchema,parseTarget,spendSchema,transactionSchema} from '@/lib/bitcoin';

const PROVIDERS=[{name:'mempool.space',base:'https://mempool.space/api/'},{name:'Blockstream',base:'https://blockstream.info/api/'}];
const hash=/^[a-f0-9]{64}$/;
function reply(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}

export async function GET(request:Request){
  const p=new URL(request.url).searchParams,kind=p.get('kind'),id=p.get('id')??'',cursor=p.get('cursor');
  let path:string,schema:z.ZodTypeAny;
  if(kind==='tx'&&hash.test(id)){path='tx/'+id;schema=transactionSchema;}
  else if(kind==='outspend'&&hash.test(id)&&/^\d{1,5}$/.test(p.get('index')??'')){
    path='tx/'+id+'/outspend/'+Number(p.get('index'));schema=spendSchema;
  }else if((kind==='address'||kind==='history')&&parseTarget(id)?.kind==='address'&&(!cursor||hash.test(cursor))){
    path='address/'+encodeURIComponent(id)+(kind==='history'?'/txs'+(cursor?'/chain/'+cursor:''):'');
    schema=kind==='address'?addressSchema:z.array(transactionSchema).max(75);
  }else return reply({error:'ビットコインのアドレスまたは取引IDを確認してください。'},400);

  let lastStatus=0;
  for(const provider of PROVIDERS){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),8500);
    try{
      const response=await fetch(provider.base+path,{headers:{Accept:'application/json'},signal:controller.signal,redirect:'error'});
      if(!response.ok){lastStatus=response.status;await response.body?.cancel();continue;}
      // Bound untrusted upstream responses, including chunked bodies.
      const reader=response.body?.getReader();
      if(!reader)throw new Error('empty');
      const chunks:Uint8Array[]=[];let length=0;
      while(true){const item=await reader.read();if(item.done)break;length+=item.value.length;if(length>8_000_000){await reader.cancel();throw new Error('size');}chunks.push(item.value);}
      const bytes=new Uint8Array(length);let offset=0;
      for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      const data=schema.parse(JSON.parse(new TextDecoder().decode(bytes)));
      if(kind==='tx'&&data.txid!==id)throw new Error('mismatched transaction');
      if(kind==='address'&&data.address!==id)throw new Error('mismatched address');
      return reply({data,source:provider.name,fetchedAt:new Date().toISOString()});
    }catch{lastStatus=0;}finally{clearTimeout(timeout);}
  }
  if(lastStatus===400)return reply({error:'アドレスの形式・チェックサムを確認してください。Bitcoinメインネットのみ対応しています。'},400);
  if(lastStatus===404)return reply({error:'取引が見つかりません。取引IDとネットワークを確認してください。'},404);
  return reply({error:lastStatus===429?'データ提供元が混み合っています。少し待って再検索してください。':'ブロックチェーンのデータを取得できませんでした。時間をおいて再検索してください。'},503);
}
