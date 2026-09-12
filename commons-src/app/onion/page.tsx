import type { Metadata } from 'next';
import OnionDirectory from './directory';

export const metadata: Metadata = {
  title: 'ONION CHECK — COMMONS',
  description: '公開されているonion URLの応答状況と最終測定時刻を確認。毎日0時（日本時間）にデータを更新します。',
  robots: { index: false, follow: false },
};

export default function OnionPage() {
  return <OnionDirectory />;
}
