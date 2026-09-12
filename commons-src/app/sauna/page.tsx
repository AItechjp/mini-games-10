import type {Metadata} from 'next';
import Directory from './sauna-directory';
import snapshot from '@/data/sauna-snapshot.json';
import type {SaunaSnapshot} from '@/lib/sauna-types';
import {saunaStatuses} from '@/lib/sauna-status';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title:'いま開いている全国のサウナ | AITECH COMMONS',
  description:'全国のサウナを都道府県で絞り込み。登録営業時間に基づく営業判定、情報未登録の施設、出典を確認できます。取得施設は件数制限なしで表示。',
};
export default function Page() {
  const now=Date.now();
  const data=snapshot as SaunaSnapshot;
  return <Directory snapshot={data} initialNow={now} initialStatuses={saunaStatuses(data.facilities,now)}/>;
}
