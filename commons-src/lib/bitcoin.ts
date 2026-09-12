import {z} from 'zod';

const sats = z.number().int().min(0).max(2_100_000_000_000_000);
const hash = z.string().regex(/^[a-f0-9]{64}$/i);
export const statusSchema = z.object({confirmed:z.boolean(),block_height:z.number().int().nonnegative().optional(),block_time:z.number().int().nonnegative().optional()});
export const outputSchema = z.object({value:sats,scriptpubkey_address:z.string().max(100).optional(),scriptpubkey_type:z.string().max(60).optional()});
export const transactionSchema = z.object({
  txid:hash,fee:sats,size:z.number().int().positive(),weight:z.number().int().positive(),status:statusSchema,
  vin:z.array(z.object({txid:hash,vout:z.number().int().nonnegative(),is_coinbase:z.boolean(),prevout:outputSchema.nullable().optional()})).max(20000),
  vout:z.array(outputSchema).max(20000),
});
// Lifetime address totals can exceed the current monetary supply through reuse.
const lifetimeSats=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const statsSchema = z.object({tx_count:z.number().int().nonnegative(),funded_txo_sum:lifetimeSats,spent_txo_sum:lifetimeSats});
export const addressSchema = z.object({address:z.string(),chain_stats:statsSchema,mempool_stats:statsSchema});
export const spendSchema = z.object({spent:z.boolean(),txid:hash.optional(),vin:z.number().int().nonnegative().optional(),status:statusSchema.optional()}).refine(s=>!s.spent||!!s.txid);
export type Transaction = z.infer<typeof transactionSchema>;
export type Output = z.infer<typeof outputSchema>;
export type AddressInfo = z.infer<typeof addressSchema>;
export type Spend = z.infer<typeof spendSchema>;
export type SearchTarget = {kind:'tx'|'address';value:string};
export const EXAMPLE_TX = '40ec6a614b0797fbd2fb8cd35d17e4bf8e6b9dc5c6a8c383c4bfc24c486bb47b';

export function parseTarget(raw:string):SearchTarget|null {
  const value=raw.trim();
  if(/^[a-f0-9]{64}$/i.test(value))return {kind:'tx',value:value.toLowerCase()};
  if(/^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(value))return {kind:'address',value};
  if((value===value.toLowerCase()||value===value.toUpperCase())&&/^bc1[ac-hj-np-z02-9]{11,87}$/i.test(value))return {kind:'address',value:value.toLowerCase()};
  return null;
}
export function btc(value:number) {
  const n=Math.round(value),sign=n<0?'-':'';
  const abs=Math.abs(n),whole=Math.floor(abs/100000000),fraction=String(abs%100000000).padStart(8,'0').replace(/0+$/,'');
  return sign+whole.toLocaleString('en-US')+(fraction?'.'+fraction:'');
}
export function shortId(value:string,start=9,end=7){return value.length>start+end+2?value.slice(0,start)+'…'+value.slice(-end):value;}
export function relation(tx:Transaction,address:string) {
  const input=tx.vin.reduce((n,i)=>n+(i.prevout?.scriptpubkey_address===address?i.prevout.value:0),0);
  const output=tx.vout.reduce((n,o)=>n+(o.scriptpubkey_address===address?o.value:0),0);
  return {input,output,net:output-input,spending:input>0};
}
export function outputKind(tx:Transaction,out:Output) {
  if(out.scriptpubkey_type==='op_return')return 'データ出力（OP_RETURN）';
  if(!out.scriptpubkey_address)return 'アドレス表記のない出力';
  return tx.vin.some(i=>i.prevout?.scriptpubkey_address===out.scriptpubkey_address)?'入力と同じアドレス':'出力アドレス';
}

// Illustrative data is isolated from live API data and never uses a real address.
export const sampleTx:Transaction={
  txid:'sample-01',fee:2500,size:225,weight:900,status:{confirmed:true},
  vin:[{txid:'sample-previous',vout:0,is_coinbase:false,prevout:{value:5000000,scriptpubkey_address:'サンプルのアドレス A'}}],
  vout:[{value:1400000,scriptpubkey_address:'サンプルのアドレス B'},{value:3597500,scriptpubkey_address:'サンプルのアドレス A'}],
};
export const sampleNext:Transaction={
  txid:'sample-02',fee:2000,size:225,weight:900,status:{confirmed:true},
  vin:[{txid:'sample-01',vout:0,is_coinbase:false,prevout:sampleTx.vout[0]}],
  vout:[{value:1000000,scriptpubkey_address:'サンプルのアドレス C'},{value:398000,scriptpubkey_address:'サンプルのアドレス B'}],
};
