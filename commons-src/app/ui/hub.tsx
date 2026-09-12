'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,Grid2X2,Search,Star,Clock,GraduationCap,Camera,CloudSun,Bitcoin,Globe2,Soup,Flame} from 'lucide-react';
import {findTool} from '@/lib/catalog';
import {sites,listedToolIds,type SiteEntry} from '@/lib/site-catalog';
import {Sidebar,SidebarContent,SidebarFooter,SidebarHeader,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarProvider,SidebarTrigger} from '@/components/ui/sidebar';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Brand,ToolIcon,Blank,api,engineIcons,dateTime} from './common';

type Recent={id:string;tool:string;title:string;updated:number};
const entryTone=(site:SiteEntry)=>({'--tone':site.color,'--wash':site.color+'11'} as React.CSSProperties);
function SiteSymbol({site}:{site:SiteEntry}) {
  const Icon=site.id==='restaurant-openings'?Soup:['sauna-openings','sauna-now'].includes(site.id)?Flame:site.id==='ramen'?Soup:site.id==='onion'?Globe2:site.id==='bitcoin'?Bitcoin:site.id==='weather'?CloudSun:site.id==='camera'?Camera:site.toolId?engineIcons[findTool(site.toolId)!.engine]:GraduationCap;
  return <Icon aria-hidden="true"/>;
}
function Side() {
  return <Sidebar>
    <SidebarHeader className="side-brand"><Brand/></SidebarHeader>
    <SidebarContent className="px-3">
      <SidebarMenu><SidebarMenuItem><SidebarMenuButton className="nav-button" isActive asChild><a href="/commons/"><Grid2X2/><span>サイト一覧</span><span className="nav-count">{sites.length}</span></a></SidebarMenuButton></SidebarMenuItem></SidebarMenu>
      <div className="side-caption">掲載サイト</div>
      <SidebarMenu>{sites.map(site=><SidebarMenuItem key={site.id}><SidebarMenuButton className="nav-button" asChild><a href={site.href}><SiteSymbol site={site}/><span>{site.name}</span></a></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>
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
  useEffect(()=>{
    try {
      const saved:unknown=JSON.parse(localStorage.getItem('commons_favorites')??'[]');
      if(Array.isArray(saved))setFavorites(saved.filter((id):id is string=>typeof id==='string'&&sites.some(site=>site.id===id)));
    }catch{}
    api('/api/rooms?listed=1').then(data=>setRecent(data.rooms)).catch(e=>setError(e.message)).finally(()=>setLoaded(true));
  },[]);
  const search=query.trim().toLocaleLowerCase('ja');
  const filtered=useMemo(()=>sites.filter(site=>(tab!=='favorites'||favorites.includes(site.id))&&[site.name,site.description,site.label,site.keywords].join(' ').toLocaleLowerCase('ja').includes(search)),[search,tab,favorites]);
  const visibleRooms=useMemo(()=>recent.filter(room=>listedToolIds.has(room.tool)&&[room.title,findTool(room.tool)?.name].join(' ').toLocaleLowerCase('ja').includes(search)),[recent,search]);
  function toggle(id:string) {
    const next=favorites.includes(id)?favorites.filter(value=>value!==id):[...favorites,id];
    setFavorites(next);
    try{localStorage.setItem('commons_favorites',JSON.stringify(next))}catch{}
  }

  return <SidebarProvider style={{'--sidebar-width':'252px'} as React.CSSProperties}>
    <a className="skip-link" href="#site-content">本文へ移動</a>
    <Side/>
    <div className="grow">
      <header className="topbar">
        <div className="row"><SidebarTrigger aria-label="サイトメニューを開く"/><nav className="commons-path" aria-label="現在の場所"><a href="/">AITECH</a><span aria-hidden="true">/</span><span aria-current="page">コモンズ</span></nav></div>
        <div className="commons-top-tools"><a className="commons-game-link" href="/games.html">ゲーム集</a><div className="search-box"><Search/><input aria-label={sites.length+'つのサイトを検索'} placeholder="サイトを検索" value={query} onChange={e=>setQuery(e.target.value)}/></div></div>
      </header>
      <main className="content" id="site-content" tabIndex={-1}>
        <div className="intro row spread"><div><h1>コモンズ</h1><p>学習・共同作業・日常のツール。</p></div><div className="count-badge"><strong>{sites.length}</strong>サイト</div></div>
        <Tabs value={tab} onValueChange={setTab}><div className="catalog-header"><TabsList><TabsTrigger value="all">すべて</TabsTrigger><TabsTrigger value="favorites"><Star size={14}/>お気に入り</TabsTrigger><TabsTrigger value="rooms"><Clock size={14}/>最近のルーム</TabsTrigger></TabsList><span className="sort-label" role="status">{tab==='rooms'?visibleRooms.length+'ルーム':filtered.length+'サイト'}</span></div></Tabs>
        {tab==='rooms'?<>
          {error&&<p role="alert" className="notice">{error}</p>}
          {!loaded?<p className="muted">ルームを読み込み中…</p>:visibleRooms.length?<div className="room-list">{visibleRooms.map(room=><a key={room.id} className="recent-room" href={'/commons/r/?id='+encodeURIComponent(room.id)}><ToolIcon tool={findTool(room.tool)!}/><div className="grow"><h3>{room.title}</h3><p>{findTool(room.tool)!.name}</p></div><time className="room-time">{dateTime(room.updated)}</time><ArrowUpRight size={18} className="muted"/></a>)}</div>:<Blank title={search?'ルームが見つかりません':'ここから作業を再開できます'} text={search?'検索の言葉を変えてみてください。':'掲載ツールで作成・参加したルームが表示されます。'}/>}
        </>:filtered.length?<div className="site-grid">{filtered.map(site=><article className="tool-card site-card" key={site.id} style={entryTone(site)}>
          <button className={'favorite '+(favorites.includes(site.id)?'on':'')} aria-label={site.name+'をお気に入り'+(favorites.includes(site.id)?'から削除':'に追加')} aria-pressed={favorites.includes(site.id)} onClick={()=>toggle(site.id)}><Star/></button>
          <a href={site.href}><div className="site-card-heading"><span className="tool-icon"><SiteSymbol site={site}/></span><span className="site-number">{String(sites.indexOf(site)+1).padStart(2,'0')}</span></div><h2>{site.name}</h2><p>{site.description}</p><div className="site-card-footer"><span>{site.label}</span><span className="site-open">{site.actionLabel??(site.toolId?'ルームを作る':'学習を始める')}<ArrowRight size={16}/></span></div></a>
        </article>)}</div>:<Blank title={tab==='favorites'&&!search?'お気に入りのサイトを登録':'サイトが見つかりません'} text={tab==='favorites'&&!search?'カードの星を押すと、この端末のお気に入りに追加できます。':'検索の言葉を変えるか、「すべて」を選んでください。'}/>}
        <p className="catalog-note">COMMONS · {sites.length}つのサイト</p>
      </main>
    </div>
  </SidebarProvider>;
}
