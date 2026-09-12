export type OnionStatus = 'online' | 'redirect' | 'restricted' | 'error' | 'unreachable' | 'unverified';
export type OnionCheck = { at: string; status: OnionStatus; httpStatus: number | null; exitCode: number; attempts: number };
export type OnionSite = {
  id: string; name: string; category: string; categoryLabel: string; url: string;
  host: string; proofUrl: string | null; sourceUrl: string; status: OnionStatus;
  checkedAt: string | null; httpStatus: number | null; lastSuccessAt: string | null;
  history: OnionCheck[];
};
export type OnionSnapshot = {
  schemaVersion: 1; importedAt: string; sourceUpdatedAt: string | null;
  source: { name: string; url: string; blobSha: string; author: string; license: string; licenseUrl: string };
  schedule: { timezone: string; hour: number; minute: number; enabled: boolean };
  sites: OnionSite[];
};

// A daily measurement may be older than the daily import. Never refresh its age
// merely because the list was republished.
export const MEASUREMENT_MAX_AGE = 48 * 60 * 60 * 1000;
export function isStale(at: string | null, now = Date.now()) {
  const value = at ? Date.parse(at) : NaN;
  return !Number.isFinite(value) || value > now + 5 * 60 * 1000 || now - value > MEASUREMENT_MAX_AGE;
}
export function isResponsive(site: OnionSite, now = Date.now()) {
  return !isStale(site.checkedAt, now) && (site.status === 'online' || site.status === 'redirect');
}
export function nextUpdate(now = Date.now()) {
  const jstDay = Math.floor((now + 9 * 60 * 60 * 1000) / 86400000);
  return new Date((jstDay + 1) * 86400000 - 9 * 60 * 60 * 1000).toISOString();
}
export const statusLabels: Record<OnionStatus, string> = {
  online: '応答あり', redirect: '転送応答あり', restricted: 'アクセス制限',
  error: 'サーバーエラー', unreachable: '応答なし', unverified: '未測定',
};
