import { serviceHosts } from '../commons-src/edge/origins.ts';

// Patch only the audited origin list in a downloaded production bundle. Do not
// rebuild/deploy an older app tree over live business logic or embedded data.
const legacyHosts = ['canvas','law','talk','stay','sumai','market','tokai-sauna','sento','sakana','ramen','sauna','ramen-news','sauna-news','camera','weather','btc','onion'];
export function patchCommonsLiveOrigins(source) {
  const before = JSON.stringify(legacyHosts);
  const after = JSON.stringify(serviceHosts);
  if (source.split(before).length !== 2) throw new Error('Live origin list differs from audited snapshot; inspect before deployment');
  const patched = source.replace(before, after);
  if (patched.replace(after, before) !== source) throw new Error('Unexpected change outside origin list');
  return patched;
}
