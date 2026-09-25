// ─────────────────────────────────────────────────────────────────────────
// Web Push (2026-09-25) — phone/desktop notifications for the installable
// site. Pure WebCrypto (works in Workers/Pages): RFC 8291 aes128gcm payload
// encryption + RFC 8292 VAPID (ES256 JWT). The VAPID private key is the
// VAPID_PRIVATE_JWK secret (cron worker + Pages); the public key below is
// what browsers subscribe with, so the two must stay a pair.
// ─────────────────────────────────────────────────────────────────────────
export const VAPID_PUBLIC_KEY = 'BGblth62SRHi74BjWnLX_uSKqlIuvBRR1JW-7qvvL2QC6do0YFFuPS_RYoxaO1mx5I9hRAHo8YR-N3wZMW5eBFI';
const VAPID_SUBJECT = 'https://soitbegins.xyz';

const enc = s => new TextEncoder().encode(s);
function concat(...parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  parts.forEach(p => { out.set(p, o); o += p.length; });
  return out;
}
export function b64urlDecode(s) {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
export function b64urlEncode(bytes) {
  let s = '';
  bytes.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function hkdf(salt, ikm, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

// RFC 8291 — one aes128gcm record.
export async function encryptPushPayload(subscription, payloadBytes) {
  const uaPublic = b64urlDecode(subscription.keys.p256dh);
  const authSecret = b64urlDecode(subscription.keys.auth);
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const ikm = await hkdf(authSecret, ecdh, concat(enc('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(payloadBytes, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

let vapidKeyCache = null;
async function vapidSigningKey(privateJwkJson) {
  if (vapidKeyCache && vapidKeyCache.src === privateJwkJson) return vapidKeyCache.key;
  const jwk = JSON.parse(privateJwkJson);
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  vapidKeyCache = { src: privateJwkJson, key };
  return key;
}
export async function vapidAuthHeader(endpoint, privateJwkJson) {
  const header = b64urlEncode(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64urlEncode(enc(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT })));
  const key = await vapidSigningKey(privateJwkJson);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc(header + '.' + claims)));
  return 'vapid t=' + header + '.' + claims + '.' + b64urlEncode(sig) + ', k=' + VAPID_PUBLIC_KEY;
}

// Returns { ok, status, gone } — gone = the subscription no longer exists
// (404/410): the caller should forget it.
export async function sendWebPush(subscription, payload, privateJwkJson, opts) {
  opts = opts || {};
  try {
    const body = await encryptPushPayload(subscription, enc(JSON.stringify(payload)));
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': await vapidAuthHeader(subscription.endpoint, privateJwkJson),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'TTL': String(opts.ttl || 86400),
        'Urgency': opts.urgency || 'normal'
      },
      body
    });
    return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 };
  } catch (e) {
    return { ok: false, status: 0, error: String(e && e.message || e) };
  }
}

// ---- Device subscriptions: one KV map, id = hash of the push endpoint.
// { id: { sub, collections: { key: { listing: true, ... } }, wallet, at } }
const PUSH_SUBS_KEY = 'pswap:pushsubs:v1';
export async function pushSubId(endpoint) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', enc(endpoint)));
  return Array.from(h.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function getPushSubs(kv) {
  const raw = await kv.get(PUSH_SUBS_KEY);
  return raw ? JSON.parse(raw) : {};
}
export async function putPushSubs(kv, subs) {
  await kv.put(PUSH_SUBS_KEY, JSON.stringify(subs));
}

// Notification text for one ledger-watcher event.
const VERBS = { listing: 'L!STED F0R', sale: 'S0LD F0R', offer: 'G0T AN 0FFER 0F', delist: 'WAS DEL!STED', transfer: 'WAS TRANSFERRED', mint: 'WAS M!NTED', burn: 'WAS BURNED' };
export function eventNotification(e, collectionLabel, tokenLabel) {
  let price = '';
  if (e.price && e.price.xrp !== undefined) price = ' ' + Number(e.price.xrp).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' XRP';
  else if (e.price && e.price.value !== undefined) price = ' ' + Number(e.price.value).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + (tokenLabel || '');
  return {
    title: collectionLabel + (e.number ? ' #' + e.number : ''),
    body: (VERBS[e.type] || e.type) + price,
    url: e.number ? '/' + e.collection + '/' + e.number : '/' + e.collection,
    tag: e.hash + ':' + e.type,
    icon: '/assets/icons/icon-192.png'
  };
}

// After the ledger watcher stores new events: push them to every device
// that has that collection + type switched on. Up to 3 individual pushes
// per device per tick, then one summary instead of a flood.
export async function pushEventsToDevices(kv, freshByCollection, privateJwkJson, labels, opts) {
  opts = opts || {};
  if (!privateJwkJson) return { skipped: 'no_vapid_key' };
  const subs = await getPushSubs(kv);
  const ids = Object.keys(subs);
  if (!ids.length) return { devices: 0 };
  let sent = 0, removed = 0;
  for (const id of ids) {
    const d = subs[id];
    const matching = [];
    Object.keys(freshByCollection).forEach(key => {
      const on = d.collections && d.collections[key];
      if (!on) return;
      freshByCollection[key].forEach(e => { if (on[e.type]) matching.push(e); });
    });
    if (!matching.length) continue;
    const payloads = matching.length <= 3
      ? await Promise.all(matching.map(async e => {
          const p = eventNotification(e, (labels[e.collection] || {}).label || e.collection, (labels[e.collection] || {}).token);
          // The NFT's own picture (Android/desktop show it; iPhone only
          // ever shows the home-screen app icon — Apple's rule).
          const img = opts.imageFor ? await opts.imageFor(e).catch(() => null) : null;
          if (img) { p.image = img; p.icon = img; }
          return p;
        }))
      : [{ title: 'Σκύλλα', body: matching.length + ' NEW EVENTS 0N Y0UR WATCHED C0LLECT!0NS', url: '/' + matching[0].collection, tag: 'summary', icon: '/assets/icons/icon-192.png' }];
    for (const p of payloads) {
      const r = await sendWebPush(d.sub, p, privateJwkJson);
      if (r.ok) sent++;
      if (r.gone) { delete subs[id]; removed++; break; }
    }
  }
  if (removed) await putPushSubs(kv, subs);
  return { devices: ids.length, sent, removed };
}
