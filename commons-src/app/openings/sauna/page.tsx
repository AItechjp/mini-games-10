import type {Metadata} from 'next';
import OpeningDirectory from '@/app/ui/opening-directory';
import {initialOpenings} from '@/lib/opening-cache';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'前後2か月のサウナ開業情報 | COMMONS',description:'今日の2か月前から2か月後までのサウナ開業・新設情報を、開業日・地域・出典付きで確認。'};
export default function Page(){return <OpeningDirectory kind="sauna" initial={initialOpenings()} serverNow={new Date().toISOString()}/>}
