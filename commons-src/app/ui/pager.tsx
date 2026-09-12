'use client';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Pagination,PaginationContent,PaginationItem} from '@/components/ui/pagination';
import type {PageWindow} from '@/lib/paging';

export function Pager({value,onChange,label='項目'}:{value:PageWindow<unknown>;onChange:(page:number)=>void;label?:string}){
  if(value.pages<=1)return null;
  return <div className="result-pager">
    <p id="page-status" aria-live="polite">{value.total}{label}中 {value.from}〜{value.to}{label}を表示 · {value.page}/{value.pages}ページ</p>
    <Pagination aria-labelledby="page-status"><PaginationContent>
      <PaginationItem><Button type="button" variant="outline" disabled={value.page<=1} onClick={()=>onChange(value.page-1)} aria-label="前のページ"><ChevronLeft/>前へ</Button></PaginationItem>
      <PaginationItem><Button type="button" variant="outline" disabled={value.page>=value.pages} onClick={()=>onChange(value.page+1)} aria-label="次のページ">次へ<ChevronRight/></Button></PaginationItem>
    </PaginationContent></Pagination>
  </div>;
}
