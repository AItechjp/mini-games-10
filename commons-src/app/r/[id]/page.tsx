export const metadata={title:'共有ルーム — COMMONS',robots:{index:false,follow:false}};
import Room from '@/app/ui/room';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Room id={id}/>}
