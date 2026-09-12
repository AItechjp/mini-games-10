import {notFound,redirect} from 'next/navigation';
import {findTool} from '@/lib/catalog';
import {listedToolIds} from '@/lib/site-catalog';
import Start from '@/app/ui/start';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const t=findTool(slug);return {title:t?`${t.name} — COMMONS`:'ツールが見つかりません'}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const t=findTool(slug);if(!t)notFound();if(!listedToolIds.has(slug))redirect('/');return <Start tool={t}/>}
