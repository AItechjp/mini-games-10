import type {LocalSnapshot} from './local-hours';
const kinds=new Set(['supermarkets','saunas','sento','fishmongers']);
/** Validate the fields the directory reads before replacing a working snapshot. */
export function parseLocalSnapshot(input:unknown):LocalSnapshot {
 const value=input as LocalSnapshot;
 const bad=()=>{throw new Error('店舗情報の形式を確認できません。時間をおいて再試行してください。')};
 if(!value||!Array.isArray(value.stores)||!Array.isArray(value.sources)||typeof value.coverageNote!=='string'||!Number.isFinite(Date.parse(value.updatedAt)))return bad();
 const ids=new Set<string>();
 for(const s of value.stores){
  // Some upstream records encode missing coordinates as null; never map them to 0,0.
  if(s?.lat===null)delete s.lat;
  if(s?.lon===null)delete s.lon;
  if(!s||!['id','name','prefecture','city','address','hours','phone','website','sourceUrl','sourceName','sourceType','checkedAt'].every(key=>typeof s[key as keyof typeof s]==='string'))return bad();
  if(!s.id||ids.has(s.id)||!Array.isArray(s.categories)||!s.categories.length||!s.categories.every(k=>kinds.has(k)))return bad();
  if(!['hoursText','access','note','scope'].every(key=>s[key as keyof typeof s]===undefined||typeof s[key as keyof typeof s]==='string'))return bad();
  if(s.exceptions!==undefined&&(!s.exceptions||typeof s.exceptions!=='object'||Array.isArray(s.exceptions)||Object.entries(s.exceptions).some(([day,hours])=>!/^\d{4}-\d{2}-\d{2}$/.test(day)||typeof hours!=='string')))return bad();
  if(!['岐阜県','愛知県'].includes(s.prefecture)||!Number.isFinite(Date.parse(s.checkedAt)))return bad();
  if(s.lat!==undefined&&(!Number.isFinite(s.lat)||Math.abs(s.lat)>90)||s.lon!==undefined&&(!Number.isFinite(s.lon)||Math.abs(s.lon)>180))return bad();
  if(s.otherSources!==undefined&&(!Array.isArray(s.otherSources)||s.otherSources.some(x=>!x||typeof x.name!=='string'||typeof x.url!=='string')))return bad();
  ids.add(s.id);
 }
 for(const s of value.sources)if(!s||typeof s.name!=='string'||typeof s.url!=='string'||!Number.isFinite(s.count)||typeof s.complete!=='boolean'||typeof s.note!=='string')return bad();
 return value;
}
