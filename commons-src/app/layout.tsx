import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'COMMONS — 便利なサイトをひとつの場所に',description:'共同ツール、予備試験対策、カメラ、岐阜の天気とラーメン、ラーメン店の開店予定・サウナの開業情報、送金マップ、URL確認。いつものサイトをひとつの場所に。',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ja"><body>{children}</body></html>}
