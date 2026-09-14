export const CAPACITY_MB = 1_000_000;
export const CAPACITY_GB = 1_000_000_000;
export const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function quota(used, limit) {
  if (!finite(used) || !finite(limit) || limit === 0) return null;
  const percent = used / limit * 100;
  return {used, limit, remaining: Math.max(0, limit-used), exceeded: Math.max(0, used-limit), percent, bar: Math.min(100,percent), level: percent >= 100 ? 'danger' : percent >= 80 ? 'warn' : 'ok'};
}
export function validTimestamp(value) {return typeof value === 'string' && Number.isFinite(Date.parse(value));}
export function fresh(value, now=Date.now()) {return validTimestamp(value) && now-Date.parse(value)<=180_000 && Date.parse(value)<=now+120_000;}
export function validateManual(entry, now=Date.now()) {
  if(!entry || !finite(entry.used) || !validTimestamp(entry.observedAt) || !/^\d{4}-\d{2}-\d{2}$/.test(entry.periodStart??'') || !/^\d{4}-\d{2}-\d{2}$/.test(entry.periodEnd??'')) return {valid:false,reason:'使用量・確認日時・請求期間を入力してください。'};
  const start=Date.parse(entry.periodStart+'T00:00:00+09:00'),end=Date.parse(entry.periodEnd+'T23:59:59.999+09:00'),observed=Date.parse(entry.observedAt);
  for(const day of [entry.periodStart,entry.periodEnd]) {const parsed=Date.parse(day+'T00:00:00Z');if(!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==day)return {valid:false,reason:'存在する日付を入力してください。'};}
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||observed<start||observed>end||observed>now+60_000) return {valid:false,reason:'確認日時を請求期間内・現在以前に指定してください。日付は日本時間です。'};
  return {valid:true,active:now>=start&&now<=end,stale:now-observed>86_400_000};
}
export function validateSnapshot(row) {return row && [row.database_bytes,row.storage_bytes,row.storage_objects].every(finite) && validTimestamp(row.checked_at);}
export function validateBuild(data) {return data?.version===1 && [data.bytes,data.files,data.largestFileBytes].every(finite) && validTimestamp(data.measuredAt) && /^[a-f\d]{40}$/.test(data.commit??'');}
