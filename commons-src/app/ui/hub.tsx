'use client';
import {useEffect,useMemo,useState,useRef} from 'react';
import {matchesSearch} from '@/lib/municipalities';
import {ArrowRight,ArrowUpRight,Hotel,House,ShoppingBasket,Waves,Fish,Grid2X2,Search,Star,Clock,GraduationCap,Camera,CloudSun,Bitcoin,Globe2,Soup,Flame} from 'lucide-react';
import {findTool} from '@/lib/catalog';
import {sites,siteGroups,listedToolIds,type SiteEntry} from '@/lib/site-catalog';
import {Sidebar,SidebarContent,SidebarFooter,SidebarHeader,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarProvider,SidebarTrigger} from '@/components/ui/sidebar';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Brand,ToolIcon,Blank,api,engineIcons,dateTime} from './common';

type Recent={id:string;tool:string;title:string;updated:number};
const entryTone=(site:SiteEntry)=>({'--tone':site.color,'--wash':site.color+'11'} as React.CSSProperties);
function SiteSymbol({site}:{site:SiteEntry}) {
  const Icon=site.id==='hotel-search'?Hotel:site.id==='rental-search'?House:site.id==='local-supermarkets'?ShoppingBasket:site.id==='local-sento'?Waves:site.id==='local-fishmongers'?Fish:site.id==='local-saunas'?Flame:site.id==='restaurant-openings'?Soup:['sauna-openings','sauna-now'].includes(site.id)?Flame:site.id==='ramen'?Soup:site.id==='onion'?Globe2:site.id==='bitcoin'?Bitcoin:site.id==='weather'?CloudSun:site.id==='camera'?Camera:site.toolId?engineIcons[findTool(site.toolId)!.engine]:GraduationCap;
  return <Icon aria-hidden="true"/>;
}
function Side() {
  return <Sidebar>
    <SidebarHeader className="side-brand"><Brand/></SidebarHeader>
    <SidebarContent className="px-3">
      <SidebarMenu><SidebarMenuItem><SidebarMenuButton className="nav-button" isActive asChild><a href="/commons/"><Grid2X2/><span>サイト一覧</span><span className="nav-count">{sites.length}</span></a></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
      <div className="side-caption">カテゴリから探す</div>
      {siteGroups.map(group=><details className="commons-side-group" key={group.id} open><summary>{group.name}<span>{group.sites.length}</span></summary><SidebarMenu>{group.sites.map(site=><SidebarMenuItem key={site.id}><SidebarMenuButton className="nav-button" asChild><a href={site.href}><span className="commons-nav-number">{sites.indexOf(site)+1}</span><span>{site.name}</span></a></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></details>)}
    </SidebarContent>
    <SidebarFooter className="side-foot"><nav className="commons-parent-links" aria-label="AITECHのサイト"><a href="/">AITECHトップ</a><a href="/games.html">ゲーム集</a></nav></SidebarFooter>
  </Sidebar>;
}

export default function Hub() {
  const [query,setQuery]=useState('');
  const [tab,setTab]=useState('all');
  const [favorites,setFavorites]=useState<string[]>([]);
  const [recent,setRecent]=useState<Recent[]>([]);
  const [error,setError]=useState('');
  const [loaded,setLoaded]=useState(false);
  const [retry,setRetry]=useState(0);
  const [saveNotice,setSaveNotice]=useState('');
  const searchInput=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    const restore=()=>{try {
      const saved:unknown=JSON.parse(localStorage.getItem('commons_favorites')??'[]');
      if(Array.isArray(saved))setFavorites(saved.filter((id):id is string=>typeof id==='string'&&sites.some(site=>site.id===id)));
    }catch{setSaveNotice('この端末のお気に入りを読み込めませんでした。サイトはそのまま利用できます。')}};
    restore();
    const changed=(event:StorageEvent)=>{if(event.key==='commons_favorites')restore()};
    window.addEventListener('storage',changed);
    return()=>window.removeEventListener('storage',changed);
  },[]);
  useEffect(()=>{
    if(tab!=='rooms')return;
    const controller=new AbortController();
    setLoaded(false);setError('');
    api('/api/rooms?listed=1',undefined,{signal:controller.signal}).then(data=>{
      if(controller.signal.aborted)return;
      if(!Array.isArray(data?.rooms))throw new Error('ルームの一覧を受け取れませんでした。再試行してください。');
      setRecent(data.rooms.filter((room:unknown):room is Recent=>{
        if(!room||typeof room!=='object')return false;
        const r=room as Partial<Recent>;
        return typeof r.id==='string'&&/^[a-f0-9]{32}$/.test(r.id)&&typeof r.tool==='string'&&listedToolIds.has(r.tool)&&typeof r.title==='string'&&typeof r.updated==='number'&&Number.isFinite(r.updated);
      }));
    }).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoaded(true)});
    return()=>controller.abort();
  },[tab,retry]);
  const search=query.trim();
  const filtered=useMemo(()=>sites.filter(site=>(tab!=='favorites'||favorites.includes(site.id))&&matchesSearch([String(sites.indexOf(site)+1),siteGroups.find(g=>g.sites.includes(site))?.name,site.name,site.description,site.label,site.keywords].join(' '),search)),[search,tab,favorites]);
  const visibleRooms=useMemo(()=>recent.filter(room=>listedToolIds.has(room.tool)&&matchesSearch([room.title,findTool(room.tool)?.name].join(' '),search)),[recent,search]);
  function toggle(id:string) {
    const next=favorites.includes(id)?favorites.filter(value=>value!==id):[...favorites,id];
    setFavorites(next);
    try{localStorage.setItem('commons_favorites',JSON.stringify(next));setSaveNotice('')}catch{setSaveNotice('お気に入りを端末に保存できませんでした。この画面を開いている間は利用できます。')}
  }

  return <SidebarProvider style={{'--sidebar-width':'252px'} as React.CSSProperties}>
    <a className="skip-link" href="#site-content">本文へ移動</a>
    <Side/>
    <div className="grow">
      <header className="topbar">
        <div className="row"><SidebarTrigger aria-label="サイトメニューを開く"/><nav className="commons-path" aria-label="現在の場所"><a href="/">AITECH</a><span aria-hidden="true">/</span><span aria-current="page">コモンズ</span></nav></div>
        <div className="commons-top-tools"><a className="commons-game-link" href="/games.html">ゲーム集</a><div className="search-box"><Search aria-hidden="true"/><input ref={searchInput} type="search" aria-label={sites.length+'サイトを検索'} placeholder="例：岐阜 サウナ" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setQuery('')}}/>{query&&<button className="search-clear" aria-label="検索をクリア" onClick={()=>{setQuery('');searchInput.current?.focus()}}>×</button>}</div></div>
      </header>
      <main className="content" id="site-content" tabIndex={-1}>
        <div className="intro row spread"><div><h1>コモンズ</h1><p>学習・共同作業・日常のツール。</p></div><div className="count-badge"><strong>{sites.length}</strong>サイト</div></div>
        {tab!=='rooms'&&<nav className="commons-group-jumps" aria-label="カテゴリへ移動">{siteGroups.map(g=><a key={g.id} href={'#group-'+g.id}>{g.name}<span>{g.sites.filter(s=>filtered.includes(s)).length}</span></a>)}</nav>}
        <Tabs value={tab} onValueChange={setTab}><div className="catalog-header"><TabsList><TabsTrigger value="all">すべて</TabsTrigger><TabsTrigger value="favorites"><Star size={14}/>お気に入り</TabsTrigger><TabsTrigger value="rooms"><Clock size={14}/>最近のルーム</TabsTrigger></TabsList><span className="sort-label" role="status">{tab==='rooms'?(!loaded?'読み込み中':error?'取得できませんでした':visibleRooms.length+'ルーム'):filtered.length+'サイト'}</span></div></Tabs>
        {saveNotice&&<p className="notice" role="status">{saveNotice}</p>}
        {tab==='rooms'?<>
          {error&&<div className="notice rooms-retry" role="alert"><p>{error}</p><button onClick={()=>setRetry(n=>n+1)}>もう一度読み込む</button></div>}
          {!loaded?<p className="muted" role="status">ルームを読み込み中…</p>:!error&&(visibleRooms.length?<div className="room-list">{visibleRooms.map(room=><a key={room.id} className="recent-room" href={'/commons/r/?id='+encodeURIComponent(room.id)}><ToolIcon tool={findTool(room.tool)!}/><div className="grow"><h3>{room.title}</h3><p>{findTool(room.tool)!.name}</p></div><time className="room-time">{dateTime(room.updated)}</time><ArrowUpRight size={18} className="muted"/></a>)}</div>:<Blank title={search?'ルームが見つかりません':'ここから作業を再開できます'} text={search?'検索の言葉を変えてみてください。':'掲載ツールで作成・参加したルームが表示されます。'}/>)}
        </>:filtered.length?<div>{siteGroups.map(group=>{const entries=group.sites.filter(site=>filtered.includes(site));return entries.length?<section className="commons-group" id={'group-'+group.id} key={group.id} aria-labelledby={'heading-'+group.id}><h2 id={'heading-'+group.id}>{group.name}<span>{entries.length}サイト</span></h2><div className="site-grid">{entries.map(site=><article className="tool-card site-card" key={site.id} style={entryTone(site)}>
          <button className={'favorite '+(favorites.includes(site.id)?'on':'')} aria-label={site.name+'をお気に入り'+(favorites.includes(site.id)?'から削除':'に追加')} aria-pressed={favorites.includes(site.id)} onClick={()=>toggle(site.id)}><Star/></button>
          <a href={site.href}><div className="site-card-heading"><span className="tool-icon"><SiteSymbol site={site}/></span><span className="site-number">{String(sites.indexOf(site)+1).padStart(2,'0')}</span></div><h2>{site.name}</h2><p>{site.description}</p><div className="site-card-footer"><span>{site.label}</span><span className="site-open">{site.actionLabel??(site.toolId?'ルームを作る':'学習を始める')}<ArrowRight size={16}/></span></div></a>
        </article>)}</div></section>:null})}</div>:<Blank title={tab==='favorites'&&!search?'お気に入りのサイトを登録':'サイトが見つかりません'} text={tab==='favorites'&&!search?'カードの星を押すと、この端末のお気に入りに追加できます。':'検索の言葉を変えるか、「すべて」を選んでください。'}/>}
        <p className="catalog-note">COMMONS · {sites.length}サイト</p>
      </main>
    </div>
  </SidebarProvider>;
}
