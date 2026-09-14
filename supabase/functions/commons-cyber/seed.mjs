import {readFile} from 'node:fs/promises';
const sources=JSON.parse(await readFile(new URL('./sources.json',import.meta.url),'utf8'));
const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
const cols=['id','name','website','feed_url','language','category','provenance','rank'];
console.log('insert into public.cyber_sources('+cols.join(',')+') values\n'+sources.map(s=>'('+cols.map(k=>quote(s[k])).join(',')+')').join(',\n')+'\non conflict(id) do update set name=excluded.name,website=excluded.website,feed_url=excluded.feed_url,language=excluded.language,category=excluded.category,provenance=excluded.provenance,rank=excluded.rank;');
