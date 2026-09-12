'use client';
export function DraftStatus({draft}: {draft: {ready: boolean; dirty: boolean; stored: boolean; recovered: boolean; issue: string}}) {
  if (!draft.ready) return <p className="draft-status" role="status">下書きを確認しています…</p>;
  if (draft.issue) return <p className="draft-status draft-warning" role="status">{draft.issue}</p>;
  if (!draft.dirty) return null;
  return <p className="draft-status" role="status">{draft.recovered ? 'このタブの下書きを復元しました。' : draft.stored ? 'このタブに下書きを一時保存しています。' : ''}まだ共有されていません。タブを閉じると消える場合があります。</p>;
}
