import snapshot from '@/data/sauna-snapshot.json';
import {saunaStatuses} from '@/lib/sauna-status';
import type {SaunaFacility} from '@/lib/sauna-types';

export const dynamic='force-dynamic';
export async function GET() {
  const now=Date.now();
  return Response.json({now,revision:snapshot.fetchedAt,statuses:saunaStatuses(snapshot.facilities as SaunaFacility[],now)}, {headers:{'Cache-Control':'no-store, max-age=0'}});
}
