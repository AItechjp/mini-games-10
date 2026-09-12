'use client';
import {Button} from '@/components/ui/button';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main className="failure-page"><h1>画面を読み込めませんでした</h1><p>接続を確認して再試行してください。保存済みのルームはコモンズから開けます。</p><div className="row wrap"><Button onClick={reset}>再試行</Button><a className="back-link" href="/commons/">コモンズへ</a></div></main>}
