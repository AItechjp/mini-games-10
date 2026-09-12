import type {Metadata} from 'next';
import BitcoinExplorer from './explorer';
import './bitcoin.css';

export const metadata:Metadata={title:'ビットコイン送金マップ | COMMONS',description:'アドレスや取引IDからビットコインの送金先を図で確認。出力を選んで、次に使用された取引までたどれます。'};
export default function BitcoinPage(){return <BitcoinExplorer/>;}
