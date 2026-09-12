import type {Metadata} from 'next';
import Weather from './weather';
import {findWeatherCity} from '@/lib/weather';
import './weather.css';

export const metadata:Metadata={title:'岐阜の天気 | COMMONS',description:'岐阜市・各務原市など岐阜県9地点の天気。現在の気温、24時間の時間別予報、7日間の週間予報を確認できます。'};
export default async function WeatherPage({searchParams}:{searchParams:Promise<{city?:string}>}){
  const params=await searchParams;
  return <Weather initialCity={findWeatherCity(params.city??'')?.id??'gifu'}/>;
}
