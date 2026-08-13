import {
  COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findStaticVanityKey
} from '../_shared.js';

// Re-checks STAT!C Vanity Key ownership at the moment of redemption,
// separately from whatever check ran when the redeem page first loaded.
// The redeem page's client calls this first; only if it returns ok:true
// does it go on to call the existing /api/scylla-mock-redeem (untouched).
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  const token = getCookie(request, COOKIE_NAME);
  if (!token) {
    return new Response(JSON.stringify({ ok: false, reason: 'no_session' }), { status: 401 });
  }

  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return new Response(JSON.stringify({ ok: false, reason: 'invalid_session' }), { status: 401 });
  }

  const nfts = await fetchAllAccountNfts(payload.acct);
  const key = findStaticVanityKey(nfts);
  if (!key) {
    return new Response(JSON.stringify({ ok: false, reason: 'card_not_held' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
