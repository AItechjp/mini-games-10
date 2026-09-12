import {z} from 'zod';
import type {WeatherCity,WeatherForecast} from './weather';

const value=z.number().finite().nullable();
const values=z.array(value);
const localTime=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const providerSchema=z.object({
  timezone:z.literal('Asia/Tokyo'),
  current:z.object({time:localTime,temperature_2m:value,apparent_temperature:value,relative_humidity_2m:value,wind_speed_10m:value,wind_direction_10m:value,weather_code:value,is_day:value}),
  hourly:z.object({time:z.array(localTime).min(24),temperature_2m:values,precipitation_probability:values,precipitation:values,weather_code:values,is_day:values}),
  daily:z.object({time:z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(7),weather_code:values,temperature_2m_max:values,temperature_2m_min:values,precipitation_probability_max:values,precipitation_sum:values,sunrise:z.array(localTime.nullable()),sunset:z.array(localTime.nullable())}),
}).superRefine((data,ctx)=>{
  for(const series of [data.hourly,data.daily])for(const [key,items] of Object.entries(series)){
    if(items.length!==series.time.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Incomplete forecast: '+key});
  }
});

export function weatherProviderUrl(city:WeatherCity) {
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  url.search=new URLSearchParams({
    latitude:String(city.latitude),longitude:String(city.longitude),
    current:'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m',
    hourly:'temperature_2m,precipitation_probability,precipitation,weather_code,is_day',
    daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset',
    timezone:'Asia/Tokyo',wind_speed_unit:'ms',forecast_days:'7',
  }).toString();
  return url;
}

export function normalizeWeather(raw:unknown,city:WeatherCity,now=Date.now()):WeatherForecast {
  const data=providerSchema.parse(raw),c=data.current,h=data.hourly,d=data.daily;
  if(Math.abs(now-new Date(c.time+'+09:00').getTime())>3*60*60*1000)throw new Error('Forecast time is out of date');
  return {
    cityId:city.id,fetchedAt:new Date(now).toISOString(),
    current:{time:c.time+'+09:00',temperature:c.temperature_2m,feelsLike:c.apparent_temperature,humidity:c.relative_humidity_2m,windSpeed:c.wind_speed_10m,windDirection:c.wind_direction_10m,code:c.weather_code,isDay:c.is_day},
    hourly:h.time.map((time,i)=>({time:time+'+09:00',temperature:h.temperature_2m[i],probability:h.precipitation_probability[i],precipitation:h.precipitation[i],code:h.weather_code[i],isDay:h.is_day[i]})),
    days:d.time.slice(0,7).map((date,i)=>({date,code:d.weather_code[i],high:d.temperature_2m_max[i],low:d.temperature_2m_min[i],probability:d.precipitation_probability_max[i],precipitation:d.precipitation_sum[i],sunrise:d.sunrise[i]?d.sunrise[i]+'+09:00':null,sunset:d.sunset[i]?d.sunset[i]+'+09:00':null})),
  };
}
