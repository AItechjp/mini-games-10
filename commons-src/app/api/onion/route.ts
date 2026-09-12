import snapshot from '@/data/onion-snapshot.json';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const current = await fetch('https://aitechd.com/commons/onion/snapshot.json', {signal:AbortSignal.timeout(8000)});
    if(current.ok){const data:any=await current.json();if(data.schemaVersion===1&&Array.isArray(data.sites))return Response.json(data,{headers:{'Cache-Control':'no-store'}})}
  } catch {}
  return Response.json(snapshot, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
