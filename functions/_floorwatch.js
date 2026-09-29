// FL00R ALERTS (2026-09-29): every 10 minutes (cron-worker's 5-59/10
// tick) each collection's XRP floor — the same number as the banner's XRP
// FL00R, read from the site's own edge-cached stats — is compared with the
// floor at the last alert. A move of FLOOR_ALERT_PCT or more becomes a
// floor_down / floor_up event in that collection's feed (so the site's
// pop-ups and N0T!F!CAT!0NS pile get it like any other event) and a phone
// push for devices that switched it on. Small wobbles don't alert.
// KV: one write per alert (plus the first baseline), none otherwise.
import { TRADEABLE_COLLECTIONS, safeKvPut } from './_shared.js';
import { appendCollectionEvents } from './_ledgerwatch.js';
import { pushEventsToDevices } from './_webpush.js';

const FLOOR_WATCH_KEY = 'pswap:floorwatch:v1';
export const FLOOR_ALERT_PCT = 5;
const SITE = 'https://soitbegins.xyz';

// { key: { floor, at } } -> events for every collection that moved enough.
export function floorMoves(prev, floors, now) {
  const events = [], next = { ...prev };
  let changed = false;
  Object.keys(floors).forEach(key => {
    const f = floors[key];
    if (!(f > 0)) return;
    const last = prev[key] && prev[key].floor;
    if (!(last > 0)) { next[key] = { floor: f, at: now }; changed = true; return; }
    const pct = (f - last) / last * 100;
    if (Math.abs(pct) < FLOOR_ALERT_PCT) return;
    events.push({
      type: pct < 0 ? 'floor_down' : 'floor_up', collection: key, nftId: null, number: null,
      price: { xrp: f }, prev: { xrp: last }, pct: Math.round(pct * 10) / 10,
      hash: 'floor:' + key + ':' + now, time: now,
    });
    next[key] = { floor: f, at: now };
    changed = true;
  });
  return { events, next, changed };
}

export async function runFloorWatch(kv, opts) {
  opts = opts || {};
  const keys = Object.keys(TRADEABLE_COLLECTIONS);
  const floors = {};
  await Promise.all(keys.map(async key => {
    try {
      const r = await fetch(SITE + '/api/pigeons?stats=1&collection=' + encodeURIComponent(key));
      const j = r.ok ? await r.json() : null;
      if (j && typeof j.xrpFloorXrp === 'number') floors[key] = j.xrpFloorXrp;
    } catch (e) {}
  }));
  const raw = await kv.get(FLOOR_WATCH_KEY);
  const prev = raw ? JSON.parse(raw) : {};
  const now = Math.floor(Date.now() / 1000);
  const { events, next, changed } = floorMoves(prev, floors, now);
  if (changed) await safeKvPut(kv, FLOOR_WATCH_KEY, JSON.stringify(next));
  const byCollection = {};
  events.forEach(e => { (byCollection[e.collection] = byCollection[e.collection] || []).push(e); });
  for (const key of Object.keys(byCollection)) await appendCollectionEvents(kv, key, byCollection[key]);
  let push = null;
  if (opts.vapid && events.length) {
    const labels = {};
    keys.forEach(k => { labels[k] = { label: TRADEABLE_COLLECTIONS[k].label }; });
    push = await pushEventsToDevices(kv, byCollection, opts.vapid, labels, {}).catch(e => ({ error: String(e && e.message || e) }));
  }
  return { floors: Object.keys(floors).length, alerts: events.map(e => e.collection + ' ' + e.type + ' ' + e.prev.xrp + '->' + e.price.xrp), push };
}
