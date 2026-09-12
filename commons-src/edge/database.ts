import postgres from 'npm:postgres@3.4.7';

export const sql=postgres(Deno.env.get('SUPABASE_DB_URL')!,{prepare:false,max:2,idle_timeout:20,connect_timeout:12,connection:{search_path:'commons,pg_catalog'},types:{bigint:{to:20,from:[20],serialize:String,parse:Number}}});

// This adapter is private to the migrated API. Statements originate in our
// application, never in a request. Parameters stay bound throughout.
function translate(input:string,changes=0){
  let text=input.replace(/\bwindow\b/g,'window_bucket').replace(/\bMAX\(updated \+ 1,/g,'GREATEST(updated + 1,').replace(/changes\(\)/g,String(changes));
  const ignore=/\bINSERT OR IGNORE\b/.test(text);
  text=text.replace(/\bINSERT OR IGNORE\b/g,'INSERT');
  text=text.replace(/json_group_array\(/g,'jsonb_agg(').replace(/json_object\(/g,'jsonb_build_object(').replace(/json\(i\.body\)/g,'i.body::jsonb');
  text=text.replace(/json_each\(c\.snapshot\) j/g,'jsonb_array_elements(c.snapshot::jsonb) AS j(value)');
  text=text.replace(/json_extract\((j\.value|body),\s*'\$\.([a-z_]+)'\)/g,(_,object,key)=>{
    const value=`(${object}::jsonb ->> '${key}')`;
    return ['created','updated','revision'].includes(key)?`${value}::bigint`:value;
  });
  // PostgreSQL's JSON aggregate produces jsonb; our preserved snapshots are text.
  text=text.replace(/\), '\[\]'\)\s+FROM rooms r/g,"), '[]'::jsonb)::text\n        FROM rooms r");
  if(ignore)text+=' ON CONFLICT DO NOTHING';
  let index=0;
  text=text.replace(/'(?:''|[^'])*'|\?/g,token=>token==='?'?`$${++index}`:token);
  return text;
}

class Statement {
  constructor(public text:string,public values:unknown[]=[]){ }
  bind(...values:unknown[]){return new Statement(this.text,values)}
  async execute(client:any=sql,changes=0){
    const rows=await client.unsafe(translate(this.text,changes),this.values);
    return {results:Array.from(rows),success:true,meta:{changes:rows.count??rows.length}};
  }
  async all(){return this.execute()}
  async first<T=Record<string,unknown>>(){return (await this.execute()).results[0] as T??null}
  async run(){return this.execute()}
}

export function database(){return {
  prepare:(text:string)=>new Statement(text),
  async batch(statements:Statement[]){
    return sql.begin(async (transaction:any)=>{
      const results=[];let changes=0;
      for(const statement of statements){const result=await statement.execute(transaction,changes);results.push(result);changes=result.meta.changes;}
      return results;
    });
  }
}}

export {translate};
