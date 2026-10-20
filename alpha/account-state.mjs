// Guest progress keeps its original key. Accounts never inherit guest/other-user data.
export const GUEST_KEY = 'tessera-progress-v1';
export const storageKey = uid => uid ? `alpha-user-v2:${uid}` : GUEST_KEY;
export function cleanState(value, defaults, validIds, deckIds) {
  const next = structuredClone(defaults);
  if (!value || typeof value !== 'object') return next;
  next.progress = Object.fromEntries(Object.entries(value.progress || {}).filter(([id,p]) => validIds.has(id) && p && Number.isFinite(p.dueAt) && Number.isFinite(p.stability) && p.stability > 0 && Number.isFinite(p.lastAt)));
  next.reviews = (Array.isArray(value.reviews) ? value.reviews : []).filter(r => r && validIds.has(r.id) && Number.isFinite(r.at) && [0,1,2,3].includes(r.grade)).slice(-12000);
  const p = value.prefs || {};
  next.prefs.retention = Number.isFinite(p.retention) ? Math.min(.95,Math.max(.85,p.retention)) : defaults.prefs.retention;
  next.prefs.newLimit = Number.isFinite(p.newLimit) ? Math.min(80,Math.max(0,Math.floor(p.newLimit))) : defaults.prefs.newLimit;
  next.prefs.selected = Array.isArray(p.selected) ? [...new Set(p.selected.filter(id => deckIds.has(id)))] : [...defaults.prefs.selected];
  next.prefs.examDate = typeof p.examDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.examDate) ? p.examDate : '';
  if(deckIds.has(p.timelineDeck)) next.prefs.timelineDeck = p.timelineDeck;
  next.modified = Number.isFinite(value.modified) ? value.modified : 0;
  return next;
}
export function readState(storage,uid,defaults,validIds,deckIds) {
  try{return cleanState(JSON.parse(storage.getItem(storageKey(uid)) || 'null'),defaults,validIds,deckIds)}catch{return structuredClone(defaults)}
}
export const maySave = (scheduledUid,currentUid,ready) => Boolean(scheduledUid && scheduledUid === currentUid && ready);
export function safeResourceUrl(value) {
  if(!value)return '';
  try{const url=new URL(value);return url.protocol==='https:'?url.href:null}catch{return null}
}
