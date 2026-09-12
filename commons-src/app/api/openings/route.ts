import {getOpenings} from '@/lib/opening-cache';
import {windowFor} from '@/lib/openings';
export const dynamic='force-dynamic';
export async function GET(){
  const snapshot=await getOpenings(),now=new Date();
  return Response.json({...snapshot,windows:{ramen:windowFor(now,'ramen'),sauna:windowFor(now,'sauna')},serverNow:now.toISOString()},{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
