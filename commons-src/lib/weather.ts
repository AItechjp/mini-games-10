export const weatherCities = [
  {id:'gifu', name:'岐阜市', area:'岐阜', latitude:35.4233, longitude:136.7607},
  {id:'kakamigahara', name:'各務原市', area:'岐阜', latitude:35.3989, longitude:136.8483},
  {id:'ogaki', name:'大垣市', area:'西濃', latitude:35.3594, longitude:136.6128},
  {id:'seki', name:'関市', area:'中濃', latitude:35.4958, longitude:136.9178},
  {id:'tajimi', name:'多治見市', area:'東濃', latitude:35.3328, longitude:137.1321},
  {id:'nakatsugawa', name:'中津川市', area:'東濃', latitude:35.4876, longitude:137.5006},
  {id:'gujo', name:'郡上市', area:'中濃', latitude:35.7486, longitude:136.9643},
  {id:'gero', name:'下呂市', area:'飛騨', latitude:35.8056, longitude:137.2442},
  {id:'takayama', name:'高山市', area:'飛騨', latitude:36.1461, longitude:137.2522},
] as const;

export type WeatherCity = typeof weatherCities[number];
export const findWeatherCity = (id:string) => weatherCities.find(city=>city.id===id);
export type WeatherHour = {time:string; temperature:number|null; probability:number|null; precipitation:number|null; code:number|null; isDay:number|null};
export type WeatherDay = {date:string; code:number|null; high:number|null; low:number|null; probability:number|null; precipitation:number|null; sunrise:string|null; sunset:string|null};
export type WeatherForecast = {
  cityId:string;
  fetchedAt:string;
  current:{time:string; temperature:number|null; feelsLike:number|null; humidity:number|null; windSpeed:number|null; windDirection:number|null; code:number|null; isDay:number|null};
  hourly:WeatherHour[];
  days:WeatherDay[];
};
export type WeatherResult = {forecast:WeatherForecast; stale:boolean};

export function weatherCondition(code:number|null, isDay:number|null=1) {
  if(code===0)return {label:isDay===0?'快晴':'晴れ',kind:isDay===0?'moon':'sun'};
  if(code===1)return {label:'晴れ',kind:isDay===0?'moon':'sun'};
  if(code===2)return {label:'晴れ時々くもり',kind:isDay===0?'cloudMoon':'cloudSun'};
  if(code===3)return {label:'くもり',kind:'cloud'};
  if(code===45||code===48)return {label:'霧',kind:'fog'};
  if(code===51||code===53||code===55)return {label:'霧雨',kind:'drizzle'};
  if(code===56||code===57||code===66||code===67)return {label:'凍雨',kind:'snow'};
  if(code===61)return {label:'弱い雨',kind:'rain'};
  if(code===63)return {label:'雨',kind:'rain'};
  if(code===65)return {label:'強い雨',kind:'rain'};
  if(code===71||code===73||code===75||code===77||code===85||code===86)return {label:'雪',kind:'snow'};
  if(code===80||code===81||code===82)return {label:'にわか雨',kind:'rain'};
  if(code===95||code===96||code===99)return {label:'雷雨',kind:'thunder'};
  return {label:'データなし',kind:'unknown'};
}

export const numberText = (value:number|null, digits=0) => value===null||!Number.isFinite(value)?'—':value.toFixed(digits);
export const japanDate = (timestamp:number) => new Date(timestamp+9*60*60*1000).toISOString().slice(0,10);
export function japanTime(value:string, options:Intl.DateTimeFormatOptions={hour:'2-digit',minute:'2-digit'}) {
  return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',...options}).format(new Date(value));
}
export function windDirectionText(value:number|null) {
  return value===null?'—':['北','北北東','北東','東北東','東','東南東','南東','南南東','南','南南西','南西','西南西','西','西北西','北西','北北西'][Math.round(value/22.5)%16];
}
