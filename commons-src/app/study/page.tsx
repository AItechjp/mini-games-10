import type {Metadata} from 'next';
import {ArrowLeft,ArrowUpRight,BookOpen,PenLine} from 'lucide-react';
import {studyPages} from '@/lib/site-catalog';
import {Brand} from '@/app/ui/common';

export const metadata:Metadata={title:'予備試験対策集 — COMMONS',description:'予備試験の短答過去問と論文学習への入口。'};
export default function Study() {
  return <>
    <header className="page-header"><Brand/><a className="back-link" href="/commons/"><ArrowLeft size={16}/>コモンズへ</a></header>
    <main className="study-page">
      <div className="intro"><h1>予備試験対策集</h1><p>今日取り組む学習を選びましょう。</p></div>
      <div className="study-grid">{studyPages.map((page,index)=>{
        const Icon=index===0?BookOpen:PenLine;
        return <a className="study-card" key={page.href} href={page.href}><span className="study-icon"><Icon size={28}/></span><h2>{page.name}</h2><p>{page.description}</p><span className="study-open">{page.name}を開く<ArrowUpRight size={18}/></span></a>;
      })}</div>
      <p className="study-note">学習の進捗は、この端末・ブラウザに保存されます。これまでの短答・論文ノートの記録をそのまま使えます。</p>
    </main>
  </>;
}
