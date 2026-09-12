import {createRoot} from 'react-dom/client';
import {lazy,Suspense} from 'react';
import Hub from '@/app/ui/hub';
import Start from '@/app/ui/start';
import Study from '@/app/study/page';
import {findTool} from '@/lib/catalog';
import {openingSeeds} from '@/lib/opening-seeds';
import '@/app/globals.css';
import '@/app/weather/weather.css';
import '@/app/bitcoin/bitcoin.css';
import '@/app/ui/opening-directory.css';
const Room=lazy(()=>import('@/app/ui/room'));
const Weather=lazy(()=>import('@/app/weather/weather'));
const Bitcoin=lazy(()=>import('@/app/bitcoin/explorer'));
const Onion=lazy(()=>import('@/app/onion/directory'));
const Ramen=lazy(()=>import('@/app/ramen/ramen-directory'));
const Openings=lazy(()=>import('@/app/ui/opening-directory'));
const Sauna=lazy(()=>import('./sauna'));
const LocalDirectory=lazy(()=>import('./local-directory'));
function Router(){
 const path=decodeURIComponent(location.pathname.replace(/^\/commons\/?/,'').replace(/\/$/,'')),params=new URLSearchParams(location.search);
 if(!path||path==='index.html')return <Hub/>;
 if(path==='study')return <Study/>;
 if(path==='r'||path.startsWith('r/')){const id=params.get('id')??path.slice(2);if(/^[a-f0-9]{32}$/.test(id))return <Room id={id}/>}
 if(path.startsWith('tools/')){const tool=findTool(path.slice(6));if(tool)return <Start tool={tool}/>}
 if(path==='weather')return <Weather initialCity={params.get('city')??'gifu'}/>;
 if(path==='bitcoin')return <Bitcoin/>;
 if(path==='onion')return <Onion/>;
 if(path==='ramen')return <Ramen initialNow={Date.now()}/>;
 if(path==='sauna')return <Sauna/>;
 if(/^local\/(supermarkets|saunas|sento|fishmongers)$/.test(path))return <LocalDirectory kind={path.split('/')[1] as import('@/lib/local-hours').LocalKind}/>;
 if(path==='openings/restaurants'||path==='openings/ramen'||path==='openings/sauna')return <Openings kind={path.endsWith('sauna')?'sauna':'ramen'} initial={{records:openingSeeds,sources:[],updatedAt:null}} serverNow={new Date().toISOString()}/>;
 return <main className="commons-loading"><h1>ページが見つかりません</h1><a href="/commons/">コモンズに戻る</a></main>;
}
createRoot(document.getElementById('root')!).render(<Suspense fallback={<main className="commons-loading" role="status">ページを開いています…</main>}><Router/></Suspense>);
