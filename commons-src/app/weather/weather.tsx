import {apiFetch} from '@/aitech/auth';
'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowLeft,ArrowUpRight,CloudSun,CloudMoon,Cloud,CloudFog,CloudDrizzle,CloudRain,CloudSnow,CloudLightning,Sun,Moon,MapPin,RefreshCw,Droplets,Wind,Thermometer,Sunrise,Sunset,CalendarDays,Clock3,CloudOff} from 'lucide-react';
import {Select,SelectContent,SelectGroup,SelectItem,SelectLabel,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Skeleton} from '@/components/ui/skeleton';
import {Brand} from '../ui/common';
import {weatherCities,findWeatherCity,weatherCondition,numberText,japanTime,japanDate,windDirectionText,type WeatherResult,type WeatherDay} from '@/lib/weather';

const icons={sun:Sun,moon:Moon,cloudSun:CloudSun,cloudMoon:CloudMoon,cloud:Cloud,fog:CloudFog,drizzle:CloudDrizzle,rain:CloudRain,snow:CloudSnow,thunder:CloudLightning,unknown:CloudOff};
function WeatherIcon({code,isDay=1,className=''}:{code:number|null;isDay?:number|null;className?:string}){
  const {kind}=weatherCondition(code,isDay),Icon=icons[kind as keyof typeof icons];
  return <Icon className={'wx-icon wx-icon-'+kind+' '+className} aria-hidden="true" strokeWidth={1.5}/>;
}
function dateLabel(date:string,now:number){
  if(date===japanDate(now))return '今日';
  if(date===japanDate(now+24*60*60*1000))return '明日';
  return japanTime(date+'T12:00:00+09:00',{weekday:'short'});
}
function TemperatureRange({day,min,max}:{day:WeatherDay;min:number;max:number}){
  if(day.low===null||day.high===null)return <div className="wx-range wx-range-empty" aria-hidden="true"/>;
  const width=max-min||1;
  return <div className="wx-range" aria-hidden="true"><span style={{left:((day.low-min)/width*100)+'%',width:Math.max(4,(day.high-day.low)/width*100)+'%'}}/></div>;
}

export default function Weather({initialCity}:{initialCity:string}){
  const [cityId,setCityId]=useState(initialCity);
  const [result,setResult]=useState<WeatherResult|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [now,setNow]=useState<number|null>(null);
  const hourlyScroll=useRef<HTMLDivElement>(null);
  const city=findWeatherCity(cityId)!;

  useEffect(()=>{
    let active=true;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),18000);
    setLoading(true);setError('');setNow(Date.now());
    apiFetch('/api/weather?city='+encodeURIComponent(cityId),{signal:controller.signal,cache:'no-store'})
      .then(async response=>{
        const data=await response.json() as Partial<WeatherResult>&{error?:string};
        if(!response.ok)throw new Error(data.error||'天気データを取得できませんでした。');
        if(!data.forecast||data.forecast.cityId!==cityId)throw new Error('地域のデータを確認できませんでした。');
        if(active){setResult({forecast:data.forecast,stale:data.stale===true});setNow(Date.now());}
      }).catch(cause=>{
        if(active)setError(cause instanceof Error&&cause.name!=='AbortError'?cause.message:'通信がタイムアウトしました。接続を確認して再試行してください。');
      }).finally(()=>{clearTimeout(timeout);if(active)setLoading(false);});
    return ()=>{active=false;clearTimeout(timeout);controller.abort();};
  },[cityId,refresh]);

  useEffect(()=>{
    let last=Date.now();
    const update=()=>{setNow(Date.now());if(!document.hidden&&Date.now()-last>=15*60*1000){last=Date.now();setRefresh(value=>value+1);}};
    const timer=setInterval(update,60000);
    document.addEventListener('visibilitychange',update);
    const back=()=>{const id=new URL(location.href).searchParams.get('city')??'gifu';setCityId(findWeatherCity(id)?.id??'gifu');};
    window.addEventListener('popstate',back);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update);window.removeEventListener('popstate',back);};
  },[]);

  function choose(id:string){
    if(!findWeatherCity(id)||id===cityId)return;
    setCityId(id);setError('');setLoading(true);
    const url=new URL(location.href);url.searchParams.set('city',id);window.history.replaceState(null,'',url);
    hourlyScroll.current?.scrollTo({left:0});
  }
  const matching=result?.forecast.cityId===cityId?result:null;
  const expired=matching&&now!==null&&now-Date.parse(matching.forecast.fetchedAt)>2*60*60*1000;
  const data=matching&&!expired?matching.forecast:null;
  const stale=Boolean(data&&(matching?.stale||error||now!==null&&now-Date.parse(data.fetchedAt)>20*60*1000));
  const current=data?.current;
  const today=data?.days.find(day=>day.date===japanDate(now??Date.parse(data.fetchedAt)))??data?.days[0];
  const hours=data?.hourly.filter(hour=>Date.parse(hour.time)>=Math.floor((now??Date.parse(data.current.time))/3600000)*3600000).slice(0,24)??[];
  const lows=data?.days.flatMap(day=>day.low===null?[]:[day.low])??[];
  const highs=data?.days.flatMap(day=>day.high===null?[]:[day.high])??[];
  const min=lows.length?Math.min(...lows):0,max=highs.length?Math.max(...highs):1;

  return <div className="wx-page">
    <a className="skip-link" href="#weather-content">天気予報へ移動</a>
    <header className="page-header wx-header"><Brand/><a href="/commons/" className="back-link"><ArrowLeft size={16}/>サイト一覧</a></header>
    <main className="wx-main" id="weather-content" tabIndex={-1}>
      <div className="wx-heading"><div><span className="wx-kicker">COMMONS WEATHER</span><h1>岐阜の天気</h1></div><div className="wx-controls">
        <div className="wx-place"><MapPin size={19} aria-hidden="true"/><Select value={cityId} onValueChange={choose}><SelectTrigger aria-label="予報の地域" className="wx-select"><SelectValue/></SelectTrigger><SelectContent position="popper">{['岐阜','西濃','中濃','東濃','飛騨'].map(area=><SelectGroup key={area}><SelectLabel>{area}地方</SelectLabel>{weatherCities.filter(place=>place.area===area).map(place=><SelectItem value={place.id} key={place.id}>{place.name}</SelectItem>)}</SelectGroup>)}</SelectContent></Select></div>
        <button className="wx-refresh" onClick={()=>setRefresh(value=>value+1)} disabled={loading} aria-label="最新の天気を取得"><RefreshCw size={18} className={loading?'wx-spin':''}/><span>更新</span></button>
      </div></div>
      <div className="wx-status" role="status" aria-live="polite">{loading?city.name+'の予報を取得しています…':data?`${japanTime(data.fetchedAt,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})} 取得 · 日本時間`:'日本時間で表示'}</div>
      {(error||stale||expired)&&<div className="wx-notice" role="alert">{error||expired?'最新の天気を取得できませんでした。':'予報の更新が遅れています。'}{data?' 前回取得した予報を表示しています。':' 通信状況を確認して、もう一度お試しください。'}<button onClick={()=>setRefresh(value=>value+1)} disabled={loading}>再試行</button></div>}

      {!data?<div className="wx-loading" aria-busy={loading}>{loading?<><Skeleton className="wx-skeleton-main"/><div className="wx-skeleton-row"><Skeleton/><Skeleton/><Skeleton/></div></>:<div className="wx-empty"><CloudOff size={44}/><h2>天気を読み込めませんでした</h2><p>少し待ってから更新してください。</p><button className="wx-refresh" onClick={()=>setRefresh(value=>value+1)}><RefreshCw size={18}/>もう一度読み込む</button></div>}</div>:<>
        <section className={'wx-current '+(current!.isDay===0?'wx-night':'')} aria-labelledby="current-heading">
          <div className="wx-current-main"><div className="wx-current-top"><div><p className="wx-current-date">{japanTime(current!.time,{month:'long',day:'numeric',weekday:'long'})}</p><h2 id="current-heading">{city.name}<span>現在の天気</span></h2></div><span className="wx-current-time">{japanTime(current!.time)} 時点</span></div>
            <div className="wx-reading"><div><div className="wx-temperature">{numberText(current!.temperature)}<span>°C</span></div><p className="wx-condition">{weatherCondition(current!.code,current!.isDay).label}</p></div><WeatherIcon code={current!.code} isDay={current!.isDay} className="wx-main-icon"/></div>
            <div className="wx-highlow"><span>最高 <strong>{numberText(today!.high)}°</strong></span><span>最低 <strong>{numberText(today!.low)}°</strong></span><span>体感 <strong>{numberText(current!.feelsLike)}°</strong></span></div>
          </div>
          <div className="wx-current-details">
            <div><Droplets/><span>今日の降水確率<small>1日の最大</small></span><strong>{numberText(today!.probability)}<small>%</small></strong></div>
            <div><Wind/><span>風速<small>{windDirectionText(current!.windDirection)}の風</small></span><strong>{numberText(current!.windSpeed,1)}<small>m/s</small></strong></div>
            <div><Thermometer/><span>湿度</span><strong>{numberText(current!.humidity)}<small>%</small></strong></div>
          </div>
        </section>

        <section className="wx-section wx-hourly" aria-labelledby="hourly-heading"><div className="wx-section-heading"><h2 id="hourly-heading"><Clock3 size={20}/>時間別予報</h2><span>これから24時間</span></div><div className="wx-hourly-scroll" ref={hourlyScroll} tabIndex={0} role="region" aria-label="時間別予報。横にスクロールできます"><div className="wx-hours">
          {hours.map(hour=><div className="wx-hour" key={hour.time}><time dateTime={hour.time}>{japanTime(hour.time,{hour:'numeric'})}</time><span className="wx-hour-date">{japanTime(hour.time,{month:'numeric',day:'numeric'})}</span><WeatherIcon code={hour.code} isDay={hour.isDay}/><span className="wx-hour-condition">{weatherCondition(hour.code,hour.isDay).label}</span><strong>{numberText(hour.temperature)}°</strong><span className="wx-probability"><Droplets size={12}/>{numberText(hour.probability)}%</span><div className="wx-rain-track" aria-hidden="true"><span style={{height:(hour.probability??0)+'%'} as CSSProperties}/></div><span className="wx-rain-mm">{numberText(hour.precipitation,1)} mm</span></div>)}
        </div></div><p className="wx-section-note">降水確率・降水量は、表示時刻までの1時間の予報です。横にスクロールして確認できます。</p></section>

        <div className="wx-bottom-grid"><section className="wx-section wx-weekly" aria-labelledby="weekly-heading"><div className="wx-section-heading"><h2 id="weekly-heading"><CalendarDays size={20}/>週間予報</h2><span>7日間</span></div><div className="wx-week-legend"><span>日付 / 天気</span><span>降水確率</span><span>最低 ― 最高</span></div><div className="wx-days">{data.days.map(day=><div className="wx-day" key={day.date}>
          <div className="wx-day-name"><strong>{dateLabel(day.date,now??Date.parse(data.fetchedAt))}</strong><time dateTime={day.date}>{japanTime(day.date+'T12:00:00+09:00',{month:'numeric',day:'numeric'})}</time></div><div className="wx-day-weather"><WeatherIcon code={day.code}/><span>{weatherCondition(day.code).label}</span></div><span className="wx-probability">{numberText(day.probability)}<small>%</small></span><div className="wx-day-temperatures"><span className="wx-low">{numberText(day.low)}°</span><TemperatureRange day={day} min={min} max={max}/><span className="wx-high">{numberText(day.high)}°</span></div>
        </div>)}</div><p className="wx-section-note">降水確率は1日の最大値。天気はその日に予想される最も厳しい天気を表示しています。</p></section>
        <aside className="wx-side"><section className="wx-section wx-daylight"><h2>今日の日の出・日の入り</h2><div><Sunrise/><span>日の出</span><strong>{today!.sunrise?japanTime(today!.sunrise):'—'}</strong></div><div><Sunset/><span>日の入り</span><strong>{today!.sunset?japanTime(today!.sunset):'—'}</strong></div></section><a className="wx-official" href="https://www.jma.go.jp/bosai/#area_type=offices&area_code=210000&pattern=warning" target="_blank" rel="noopener noreferrer"><span>気象庁の防災情報<strong>岐阜県の警報・注意報</strong></span><ArrowUpRight size={21}/></a></aside></div>
      </>}
      <footer className="wx-footer"><p>天気データ：<a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p><p>各市の中心部付近の予報です。現在の天気は気象モデルによる推定値です。表示中は15分ごとに再取得します。</p></footer>
    </main>
  </div>;
}
