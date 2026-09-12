import {database} from '@/db';
import {openingSeeds} from './opening-seeds';
import archive from './opening-archive-initial.json';
import {deduplicate} from './openings';
import {collectOpenings} from './opening-feeds';
import type {OpeningSnapshot} from './openings';
const key='opening-directory-v2-ramen-sauna-months',refreshMs=6*60*60*1000;
export function initialOpenings():OpeningSnapshot{const initial=archive as OpeningSnapshot;return {...initial,records:deduplicate([...initial.records,...openingSeeds])}}
export async function getOpenings():Promise<OpeningSnapshot>{
  const now=Date.now();let snapshot=initialOpenings();
  try{
    const db=database();
    await db.prepare('INSERT OR IGNORE INTO opening_cache (key,payload,updated,locked_until) VALUES (?,?,0,0)').bind(key,JSON.stringify(snapshot)).run();
    const row=await db.prepare('SELECT payload,updated,locked_until FROM opening_cache WHERE key=?').bind(key).first<{payload:string;updated:number;locked_until:number}>();
    if(row){try{const parsed=JSON.parse(row.payload);if(Array.isArray(parsed.records)&&Array.isArray(parsed.sources))snapshot=parsed}catch{}}
    if(row&&now-row.updated<refreshMs)return snapshot;
    const lock=await db.prepare('UPDATE opening_cache SET locked_until=? WHERE key=? AND locked_until<? AND updated<? RETURNING key').bind(now+60_000,key,now,now-refreshMs).first();
    if(!lock)return {...snapshot,refreshing:true};
    try{
      const updated=await collectOpenings(snapshot,new Date(now));
      // Retry a complete upstream outage in 10 minutes instead of waiting 6 hours.
      const retryAt=updated.sources.some(s=>s.ok)?now:now-refreshMs+10*60*1000;
      await db.prepare('UPDATE opening_cache SET payload=?,updated=?,locked_until=0 WHERE key=?').bind(JSON.stringify(updated),retryAt,key).run();
      return updated;
    }catch{
      await db.prepare('UPDATE opening_cache SET locked_until=0 WHERE key=?').bind(key).run();
      return {...snapshot,storageError:true};
    }
  }catch{return {...snapshot,storageError:true}}
}
