import {findWeatherCity,japanDate,type WeatherForecast,type WeatherResult} from '@/lib/weather';
import {normalizeWeather,weatherProviderUrl} from '@/lib/weather-provider';

export const dynamic='force-dynamic';
const FRESH=10*60*1000,STALE=2*60*60*1000;
const memory=new Map<string,WeatherForecast>();
const pending=new Map<string,Promise<WeatherForecast>>();
const age=(data:WeatherForecast)=>Date.now()-Date.parse(data.fetchedAt);
const reply=(data:WeatherResult)=>Response.json(data,{headers:{'Cache-Control':'no-store'}});

export async function GET(request:Request) {
  const url=new URL(request.url),city=findWeatherCity(url.searchParams.get('city')??'gifu');
  if(!city)return Response.json({error:'一覧から地域を選んでください。'},{status:400});
  // Only the fixed city coordinates above can be requested from the provider.
  const key=new Request(url.origin+'/api/weather-cache-v1/'+city.id);
  const edge=typeof caches==='undefined'?undefined:(caches as CacheStorage&{default?:Cache}).default;
  let previous=memory.get(city.id);
  if(!previous&&edge){
    try{const saved=await edge.match(key);if(saved)previous=await saved.json() as WeatherForecast;}catch{}
  }
  if(previous&&age(previous)>=0&&age(previous)<FRESH&&previous.days[0].date===japanDate(Date.now()))return reply({forecast:previous,stale:false});
  try {
    let job=pending.get(city.id);
    if(!job){
      job=(async()=>{
        const upstream=await fetch(weatherProviderUrl(city),{signal:AbortSignal.timeout(12000),headers:{Accept:'application/json'}});
        if(!upstream.ok)throw new Error('Weather provider unavailable');
        const data=normalizeWeather(await upstream.json(),city);
        memory.set(city.id,data);
        if(edge)try{await edge.put(key,Response.json(data,{headers:{'Cache-Control':'public, max-age=7200'}}));}catch{}
        return data;
      })();
      pending.set(city.id,job);
      // Both fulfillment and rejection remove the coalesced request.
      void job.then(()=>pending.delete(city.id),()=>pending.delete(city.id));
    }
    return reply({forecast:await job,stale:false});
  }catch{
    if(previous&&age(previous)>=0&&age(previous)<STALE)return reply({forecast:previous,stale:true});
    return Response.json({error:'天気データを取得できませんでした。少し待ってから、もう一度お試しください。'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'60'}});
  }
}
