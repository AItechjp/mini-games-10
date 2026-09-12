import type {Metadata} from 'next';
import OpeningDirectory from '@/app/ui/opening-directory';
import {initialOpenings} from '@/lib/opening-cache';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'これから15日のラーメン屋 | COMMONS',description:'今日から15日間にオープン予定のラーメン店を、開店日・地域・出典付きで確認。'};
export default function Page(){return <OpeningDirectory kind="ramen" initial={initialOpenings()} serverNow={new Date().toISOString()}/>}
