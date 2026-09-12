import Directory from '@/app/sauna/sauna-directory';
import snapshot from '@/data/sauna-snapshot.json';
import type {SaunaSnapshot} from '@/lib/sauna-types';
const data=snapshot as SaunaSnapshot;
export default function Sauna(){return <Directory snapshot={data} initialNow={Date.now()} initialStatuses={data.facilities.map(f=>({id:f.id,state:'unknown',reason:'営業時間を確認中'}))}/>}
