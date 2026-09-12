import type {Metadata} from 'next';
import RamenDirectory from './ramen-directory';

export const dynamic='force-dynamic';
export const metadata:Metadata={
  title:'岐阜の営業中ラーメン | COMMONS',
  description:'岐阜県のラーメン店を閲覧時点の日本時間と公表営業時間で確認。市町村で絞り込み、営業時間・ラストオーダー・公式情報・地図・電話へ。',
};
export default function Page(){return <RamenDirectory initialNow={Date.now()}/>;}
