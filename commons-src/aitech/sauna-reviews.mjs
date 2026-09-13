import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function applySaunaReviews(source){
 const snapshot=JSON.parse(await readFile(join(source,'data/sauna-snapshot.json'),'utf8'));
 const review=JSON.parse(await readFile(join(source,'data/sauna-official-reviews.json'),'utf8'));
 for(const r of review.records){
  const facility=snapshot.facilities.find(f=>f.id===r.id);if(!facility)throw new Error('Reviewed sauna missing: '+r.id);
  facility.officialSourceUrl=r.sourceUrl;facility.officialCheckedOn=review.checkedOn;
  facility.note=r.scope+'：'+r.notes;
  if(r.hours){facility.hours=r.hours;facility.hoursScope=r.verification==='official_sauna_hours'?'sauna':'facility';}
  if(r.verification==='official_permanently_closed'){facility.permanentlyClosed=true;facility.hours='';}
  if(r.closedDates)facility.closedDates=r.closedDates;
  // A hotel sauna timetable is not evidence that non-guests can use it.
  if(r.verification==='official_sauna_hours')facility.access='private';
 }
 // Revision changes with reviewed facts too, so mixed frontend/API releases fail closed.
 const {createHash}=await import('node:crypto');
 const revision=createHash('sha256').update(JSON.stringify(snapshot.facilities)).digest('hex').slice(0,16);
 snapshot.revision=revision;
 const json=JSON.stringify(snapshot)+'\n';
 await writeFile(join(source,'data/sauna-snapshot.json'),json);
 await writeFile(join(source,'public/sauna-data.json'),json);
}
