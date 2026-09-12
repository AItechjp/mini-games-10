import {database} from '@/db';
import {ApiError,body,clean,failure,limit,member,reply,room,session,validateItem} from '@/lib/server';
import {canvasEpoch,changedRoomStatements,isDrawing,resetCanvas} from '@/lib/canvas-server';
import {compactScheduleVotes} from '@/lib/vote-data';
type Ctx={params:Promise<{id:string}>};

export async function GET(request:Request,ctx:Ctx){
  try{
    const {id}=await ctx.params;
    const s=await session(request), db=database();
    const r=await room(id);
    const params=new URL(request.url).searchParams;
    if(params.get('since')===String(r.updated)){
      const now=Date.now();
      if(params.get('members')==='1'){
        const members=await db.prepare('SELECT actor, name, seen FROM members WHERE room = ? ORDER BY seen DESC LIMIT 100').bind(id).all();
        return reply({unchanged:true,members:members.results,now},200,s.cookie);
      }
      return reply({unchanged:true,now},200,s.cookie);
    }
    if(params.get('format')!=='2'){
      // Short-lived compatibility for tabs opened before the compact vote release.
      const legacy=await db.batch([
        db.prepare('SELECT * FROM items WHERE room = ? ORDER BY created ASC, id ASC LIMIT 1500').bind(id),
        db.prepare('SELECT scope, actor, choice, updated FROM votes WHERE room = ?').bind(id),
        db.prepare('SELECT actor, name, seen FROM members WHERE room = ? ORDER BY seen DESC LIMIT 100').bind(id),
        db.prepare("SELECT id, created FROM canvas_resets WHERE room = ? AND state = 'cleared' AND revision = ?").bind(id,r.canvas_revision)
      ]);
      return reply({room:r,items:legacy[0].results.map((i:any)=>({...i,body:JSON.parse(i.body)})),votes:legacy[1].results,members:legacy[2].results,canvasUndo:legacy[3].results[0]??null,me:s.actor,now:Date.now()},200,s.cookie);
    }
    const rows=await db.batch([
      db.prepare('SELECT * FROM items WHERE room = ? ORDER BY created ASC, id ASC LIMIT 1500').bind(id),
      db.prepare('SELECT actor, name, seen FROM members WHERE room = ? ORDER BY seen DESC LIMIT 100').bind(id),
      db.prepare('SELECT scope, choice, COUNT(*) AS count FROM votes WHERE room = ? GROUP BY scope, choice').bind(id),
      db.prepare('SELECT scope, choice, updated FROM votes WHERE room = ? AND actor = ?').bind(id,s.actor),
      db.prepare("SELECT v.scope, v.actor, v.choice FROM votes v JOIN items i ON i.room = v.room AND i.id = v.scope AND i.kind = 'slot' WHERE v.room = ?").bind(id),
      db.prepare("SELECT id, created FROM canvas_resets WHERE room = ? AND state = 'cleared' AND revision = ?").bind(id,r.canvas_revision)
    ]);
    const members=rows[1].results as any[];
    const voteSummary=rows[2].results.map((v:any)=>({...v,count:Number(v.count)}));
    return reply({room:r,items:rows[0].results.map((i:any)=>({...i,body:JSON.parse(i.body)})),members,voteSummary,myVotes:rows[3].results,scheduleVotes:compactScheduleVotes(members,rows[4].results as any[]),canvasUndo:rows[5].results[0]??null,me:s.actor,now:Date.now()},200,s.cookie);
  }catch(e){return failure(e)}
}

export async function POST(request:Request,ctx:Ctx){
  try{
    const {id}=await ctx.params;
    const s=await session(request), b=await body(request), r=await room(id), db=database(), now=Date.now();
    await limit(s.actor);
    if(b.op==='join'){
      const name=clean(b.name,32);
      if(!name)throw new ApiError(400,'表示名を入力してください。');
      const joined=await db.batch([
        db.prepare(`INSERT INTO members (room,actor,name,seen) SELECT ?,?,?,?
          WHERE (SELECT COUNT(*) FROM members WHERE room = ? AND actor != ?) < 100
          ON CONFLICT(room,actor) DO UPDATE SET name=excluded.name,seen=excluded.seen`).bind(id,s.actor,name,now,id,s.actor),
        db.prepare('UPDATE rooms SET updated = MAX(updated + 1, ?) WHERE id = ? AND changes() > 0').bind(now,id)
      ]);
      if(!joined[0].meta.changes)throw new ApiError(400,'このルームは100人までです。新しいルームで参加してください。');
      return reply({ok:true},200,s.cookie);
    }
    const m=await member(id,s.actor);
    if(b.op==='presence'){
      await db.prepare('UPDATE members SET seen = ? WHERE room = ? AND actor = ?').bind(now,id,s.actor).run();
      return reply({ok:true},200,s.cookie);
    }
    if(b.op==='clear_canvas'||b.op==='restore_canvas')return await resetCanvas(r,s.actor,b,s.cookie);
    if(b.op==='add'){
      const itemId=clean(b.id,60);
      if(!/^[a-zA-Z0-9_-]{1,60}$/.test(itemId))throw new ApiError(400,'データのIDを確認してください。');
      const value=validateItem(r.tool,b.kind,b.body), serialized=JSON.stringify(value), drawing=isDrawing(b.kind), epoch=canvasEpoch(b.epoch);
      const existing=await db.prepare('SELECT author,body,kind FROM items WHERE room = ? AND id = ?').bind(id,itemId).first<any>();
      if(existing){
        if(existing.author===s.actor&&existing.kind===b.kind&&existing.body===serialized)return reply({ok:true},200,s.cookie);
        throw new ApiError(409,'この項目はすでに存在します。最新の内容を確認してください。');
      }
      if(b.kind==='comment'&&value.parent!=='room'&&!await db.prepare('SELECT id FROM items WHERE room = ? AND id = ?').bind(id,value.parent).first())throw new ApiError(404,'コメント先は削除されています。');
      const result=await db.batch([
        db.prepare(`INSERT INTO items (room,id,kind,body,author,name,created,updated,revision)
          SELECT ?,?,?,?,?,?,?,?,1 FROM rooms r WHERE r.id = ?
          AND (? = 0 OR r.canvas_epoch = ?)
          AND (SELECT COUNT(*) FROM items WHERE room = r.id) < 1500
          AND COALESCE((SELECT SUM(length(body)) FROM items WHERE room = r.id),0) + length(?) <= 4000000
          ON CONFLICT(room,id) DO NOTHING`).bind(id,itemId,b.kind,serialized,s.actor,m.name,now,now,id,drawing?1:0,epoch,serialized),
        ...changedRoomStatements(id,now,drawing)
      ]);
      if(!result[0].meta.changes){
        const current=await room(id);
        if(drawing&&current.canvas_epoch!==epoch)throw new ApiError(409,'キャンバスがクリアされました。古い描画の保存を止めました。最新の画面で描き直してください。');
        const retry=await db.prepare('SELECT author,body,kind FROM items WHERE room = ? AND id = ?').bind(id,itemId).first<any>();
        if(retry&&retry.author===s.actor&&retry.kind===b.kind&&retry.body===serialized)return reply({ok:true},200,s.cookie);
        if(retry)throw new ApiError(409,'この項目はすでに存在します。');
        throw new ApiError(400,'ルームの保存上限（1,500件・約4MB）に達しました。内容を整理するか、新しいルームで続きを作ってください。');
      }
      return reply({ok:true},200,s.cookie);
    }
    if(b.op==='edit'){
      if(typeof b.id!=='string'||!Number.isSafeInteger(b.revision)||b.revision<1)throw new ApiError(400,'編集する項目を確認してください。');
      const old=await db.prepare('SELECT * FROM items WHERE room = ? AND id = ?').bind(id,b.id).first<any>();
      if(!old)throw new ApiError(404,'この項目は削除されています。');
      if(['message','comment'].includes(old.kind)&&old.author!==s.actor)throw new ApiError(403,'投稿者のみ編集できます。');
      const value=validateItem(r.tool,old.kind,b.body),serialized=JSON.stringify(value),drawing=isDrawing(old.kind),epoch=canvasEpoch(b.epoch);
      if(serialized===old.body)return reply({ok:true},200,s.cookie);
      const result=await db.batch([
        db.prepare(`UPDATE items SET body = ?, revision = revision + 1, updated = ? WHERE room = ? AND id = ? AND revision = ?
          AND (? = 0 OR (SELECT canvas_epoch FROM rooms WHERE id = ?) = ?)
          AND (SELECT COALESCE(SUM(length(body)),0) FROM items WHERE room = ?) - length(body) + length(?) <= 4000000`)
          .bind(serialized,now,id,b.id,b.revision,drawing?1:0,id,epoch,id,serialized),
        ...changedRoomStatements(id,now,drawing)
      ]);
      if(!result[0].meta.changes)throw new ApiError(409,'この項目が更新・クリアされたか、保存上限に達しました。最新の内容を確認して、入力を再度保存してください。');
      return reply({ok:true},200,s.cookie);
    }
    if(b.op==='delete'){
      if(typeof b.id!=='string'||b.id.length>60)throw new ApiError(400,'削除する項目を確認してください。');
      const old=await db.prepare('SELECT * FROM items WHERE room = ? AND id = ?').bind(id,b.id).first<any>();
      if(!old)return reply({ok:true},200,s.cookie);
      if(old.author!==s.actor&&r.owner!==s.actor)throw new ApiError(403,'削除できるのは投稿者かルーム作成者です。');
      if(b.revision!==undefined&&b.revision!==old.revision)throw new ApiError(409,'この項目は更新されています。内容を確認してから削除してください。');
      const drawing=isDrawing(old.kind),epoch=canvasEpoch(b.epoch);
      const result=await db.batch([
        db.prepare('DELETE FROM items WHERE room = ? AND id = ? AND revision = ? AND (? = 0 OR (SELECT canvas_epoch FROM rooms WHERE id = ?) = ?)').bind(id,b.id,old.revision,drawing?1:0,id,epoch),
        ...changedRoomStatements(id,now,drawing),
        db.prepare('DELETE FROM votes WHERE room = ? AND (scope = ? OR choice = ?) AND NOT EXISTS (SELECT 1 FROM items WHERE room = ? AND id = ?)').bind(id,b.id,b.id,id,b.id),
        db.prepare("DELETE FROM items WHERE room = ? AND kind = 'comment' AND json_extract(body, '$.parent') = ? AND NOT EXISTS (SELECT 1 FROM items p WHERE p.room = ? AND p.id = ?)").bind(id,b.id,id,b.id)
      ]);
      if(!result[0].meta.changes)throw new ApiError(409,'項目が更新されました。最新の内容を確認してください。');
      return reply({ok:true},200,s.cookie);
    }
    if(b.op==='vote'){
      const scope=clean(b.scope,60),choice=clean(b.choice,60);
      if(!scope||!choice)throw new ApiError(400,'候補を選んでください。');
      const validPoll=scope==='poll';
      const validResponse=['yes','maybe','no'].includes(choice);
      const stmt=b.remove
        ? db.prepare('DELETE FROM votes WHERE room = ? AND scope = ? AND actor = ?').bind(id,scope,s.actor)
        : validPoll
          ? db.prepare(`INSERT INTO votes (room,scope,actor,choice,updated)
              SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM items WHERE room = ? AND id = ? AND kind = 'option')
              ON CONFLICT(room,scope,actor) DO UPDATE SET choice=excluded.choice,updated=excluded.updated`).bind(id,scope,s.actor,choice,now,id,choice)
          : db.prepare(`INSERT INTO votes (room,scope,actor,choice,updated)
              SELECT ?,?,?,?,? WHERE EXISTS (
                SELECT 1 FROM items WHERE room = ? AND id = ?
                AND ((kind = 'slot' AND ? = 1) OR (kind != 'slot' AND ? = 'like')))
              ON CONFLICT(room,scope,actor) DO UPDATE SET choice=excluded.choice,updated=excluded.updated`).bind(id,scope,s.actor,choice,now,id,scope,validResponse?1:0,choice);
      const result=await db.batch([stmt,...changedRoomStatements(id,now,false)]);
      if(!b.remove&&!result[0].meta.changes)throw new ApiError(400,validPoll?'投票先がありません。':'回答先を確認してください。');
      return reply({ok:true},200,s.cookie);
    }
    throw new ApiError(400,'操作を確認してください。');
  }catch(e){return failure(e)}
}
