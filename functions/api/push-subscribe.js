import { BOARD_COOKIE_NAME, getCookie, verifyToken, TRADEABLE_COLLECTIONS } from '../_shared.js';
import { pushSubId, getPushSubs, putPushSubs, sendWebPush } from '../_webpush.js';

// Phone/desktop push sign-up for the installable site (2026-09-25).
// POST { subscription, collections }  -> save/refresh this device
// POST { unsubscribe: true, endpoint } -> forget this device
// POST { test: true, endpoint }        -> send this device a test notification
// Works logged in or out (a device, not a wallet, is what gets pushed to);
// the wallet is kept alongside when there is one.
const TYPES = ['listing', 'sale', 'offer', 'delist', 'transfer', 'mint', 'burn'];
const MAX_DEVICES = 5000;

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}
function cleanCollections(cols) {
  const out = {};
  Object.keys(cols || {}).forEach(key => {
    if (!TRADEABLE_COLLECTIONS[key]) return;
    const t = {};
    TYPES.forEach(type => { if (cols[key] && cols[key][type] === true) t[type] = true; });
    if (Object.keys(t).length) out[key] = t;
  });
  return out;
}
function validEndpoint(u) {
  try { const x = new URL(u); return x.protocol === 'https:'; } catch (e) { return false; }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.coin) return json({ error: 'server_misconfigured' }, 500);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }

  const endpoint = body && (body.endpoint || (body.subscription && body.subscription.endpoint));
  if (!endpoint || !validEndpoint(endpoint)) return json({ error: 'bad_endpoint' }, 400);
  const id = await pushSubId(endpoint);
  const subs = await getPushSubs(env.coin);

  if (body.unsubscribe) {
    if (subs[id]) { delete subs[id]; await putPushSubs(env.coin, subs); }
    return json({ ok: true });
  }

  if (body.test) {
    const d = subs[id];
    if (!d) return json({ error: 'not_subscribed' }, 404);
    if (!env.VAPID_PRIVATE_JWK) return json({ error: 'push_not_configured' }, 501);
    const r = await sendWebPush(d.sub, { title: 'Σκύλλα', body: 'N0T!F!CAT!0NS ARE W0RK!NG 0N TH!S DEV!CE', url: '/static', tag: 'test', icon: '/assets/icons/icon-192.png' }, env.VAPID_PRIVATE_JWK, { urgency: 'high', ttl: 300 });
    if (r.gone) { delete subs[id]; await putPushSubs(env.coin, subs); }
    return json({ ok: r.ok, status: r.status, error: r.error });
  }

  const s = body.subscription;
  if (!s || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string') return json({ error: 'bad_subscription' }, 400);
  if (!subs[id] && Object.keys(subs).length >= MAX_DEVICES) return json({ error: 'too_many_devices' }, 503);
  const token = getCookie(request, BOARD_COOKIE_NAME);
  const session = token && env.Σκύλλα ? await verifyToken(token, env.Σκύλλα) : null;
  subs[id] = {
    sub: { endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } },
    collections: cleanCollections(body.collections),
    wallet: session && session.acct ? session.acct : (subs[id] && subs[id].wallet) || null,
    at: Math.floor(Date.now() / 1000)
  };
  await putPushSubs(env.coin, subs);
  return json({ ok: true });
}
