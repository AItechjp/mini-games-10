'use client';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from '@/components/ui/alert-dialog';
export function DiscardChanges({open,onOpenChange,onDiscard}:{open:boolean;onOpenChange:(open:boolean)=>void;onDiscard:()=>void}){
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>下書きを破棄して閉じますか？</AlertDialogTitle><AlertDialogDescription>入力中の内容と、この入力欄の一時保存は削除されます。共有済みの内容は変わりません。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>編集に戻る</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={onDiscard}>下書きを破棄する</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
