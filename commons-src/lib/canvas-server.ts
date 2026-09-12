import {database} from '@/db';
import {ApiError, clean, reply} from './server';
import {findTool} from './catalog';

export const drawingKinds = ['stroke', 'shape', 'sticky', 'text'];
export function isDrawing(kind: string) { return drawingKinds.includes(kind); }
export function canvasEpoch(value: unknown) {
  // Version-one clients work until the first clear; after that they must reload.
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || Number(value) < 0) throw new ApiError(400, 'キャンバスの状態を確認してください。');
  return Number(value);
}
export function changedRoomStatements(id:string, now:number, canvas:boolean) {
  const db=database();
  if(!canvas)return [db.prepare('UPDATE rooms SET updated = MAX(updated + 1, ?) WHERE id = ? AND changes() > 0').bind(now,id)];
  return [
    db.prepare('UPDATE rooms SET updated = MAX(updated + 1, ?), canvas_revision = canvas_revision + 1 WHERE id = ? AND changes() > 0').bind(now,id),
    db.prepare("UPDATE canvas_resets SET snapshot = '[]', state = 'superseded' WHERE room = ? AND state = 'cleared' AND changes() > 0").bind(id)
  ];
}
export async function resetCanvas(r:any, actor:string, payload:any, cookie:string) {
  if(findTool(r.tool)?.engine!=='canvas')throw new ApiError(400,'キャンバスでのみ使える操作です。');
  if(r.owner!==actor)throw new ApiError(403,'全体をクリアできるのはルーム作成者です。');
  const db=database(), now=Date.now(), id=clean(payload.id,60);
  if(!/^[a-zA-Z0-9_-]{1,60}$/.test(id))throw new ApiError(400,'操作を確認してください。');
  const old=await db.prepare('SELECT id, state FROM canvas_resets WHERE room = ?').bind(r.id).first<any>();
  if(payload.op==='clear_canvas'){
    if(old?.id===id)return reply({ok:true},200,cookie);
    if(!Number.isSafeInteger(payload.revision)||payload.revision<0)throw new ApiError(400,'最新のキャンバスを確認してください。');
    const result=await db.batch([
      db.prepare(`INSERT INTO canvas_resets (room,id,actor,created,revision,state,snapshot)
        SELECT r.id, ?, ?, ?, r.canvas_revision + 1, 'cleared',
          COALESCE((SELECT json_group_array(json_object('id',i.id,'kind',i.kind,'body',json(i.body),'author',i.author,'name',i.name,'created',i.created,'updated',i.updated,'revision',i.revision)) FROM items i WHERE i.room = r.id AND i.kind IN ('stroke','sticky','shape','text')), '[]')
        FROM rooms r WHERE r.id = ? AND r.canvas_revision = ?
        ON CONFLICT(room) DO UPDATE SET id=excluded.id,actor=excluded.actor,created=excluded.created,revision=excluded.revision,state=excluded.state,snapshot=excluded.snapshot`)
        .bind(id,actor,now,r.id,payload.revision),
      db.prepare("DELETE FROM items WHERE room = ? AND kind IN ('stroke','sticky','shape','text') AND EXISTS (SELECT 1 FROM canvas_resets c WHERE c.room = ? AND c.id = ? AND c.state = 'cleared')").bind(r.id,r.id,id),
      db.prepare("UPDATE rooms SET canvas_epoch = canvas_epoch + 1, canvas_revision = canvas_revision + 1, updated = MAX(updated + 1, ?) WHERE id = ? AND EXISTS (SELECT 1 FROM canvas_resets c WHERE c.room = ? AND c.id = ? AND c.state = 'cleared')").bind(now,r.id,r.id,id)
    ]);
    if(!result[0].meta.changes)throw new ApiError(409,'キャンバスに新しい変更があります。最新の内容を確認してから、もう一度クリアしてください。');
    return reply({ok:true},200,cookie);
  }
  if(old?.id===id&&old.state==='restored')return reply({ok:true},200,cookie);
  if(!old||old.id!==id||old.state!=='cleared')throw new ApiError(409,'新しい描画があるため、このクリアは取り消せません。');
  const result=await db.batch([
    db.prepare(`UPDATE canvas_resets SET state = 'restoring' WHERE room = ? AND id = ? AND state = 'cleared'
      AND revision = (SELECT canvas_revision FROM rooms WHERE id = ?)`)
      .bind(r.id,id,r.id),
    db.prepare(`INSERT INTO items (room,id,kind,body,author,name,created,updated,revision)
      SELECT c.room, json_extract(j.value,'$.id'), json_extract(j.value,'$.kind'), json_extract(j.value,'$.body'),
        json_extract(j.value,'$.author'), json_extract(j.value,'$.name'), json_extract(j.value,'$.created'), ?, json_extract(j.value,'$.revision') + 1
      FROM canvas_resets c, json_each(c.snapshot) j WHERE c.room = ? AND c.id = ? AND c.state = 'restoring'`)
      .bind(now,r.id,id),
    db.prepare("UPDATE rooms SET canvas_epoch = canvas_epoch + 1, canvas_revision = canvas_revision + 1, updated = MAX(updated + 1, ?) WHERE id = ? AND EXISTS (SELECT 1 FROM canvas_resets c WHERE c.room = ? AND c.id = ? AND c.state = 'restoring')").bind(now,r.id,r.id,id),
    db.prepare("UPDATE canvas_resets SET state = 'restored', snapshot = '[]' WHERE room = ? AND id = ? AND state = 'restoring'").bind(r.id,id)
  ]);
  if(!result[0].meta.changes)throw new ApiError(409,'キャンバスが更新されたため取り消せません。最新の内容を確認してください。');
  return reply({ok:true},200,cookie);
}
