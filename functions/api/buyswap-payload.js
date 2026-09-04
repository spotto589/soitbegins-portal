import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, buildBuySwapTxjson, createXamanPayload, getXamanUserToken
} from '../_shared.js';

// BUY $PIGEONS swap — re-derives and re-validates the exact same txjson
// buyswap-prepare.js already showed on the review screen (via the shared
// buildBuySwapTxjson — never trusts a txjson the client might send back,
// only the requested xrpDrops), then asks Xaman to create a real sign
// request for it. The server never signs, never holds a seed/key — Xaman
// only ever asks the buyer's own wallet to approve.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }
  if (!env.XAMAN_PROXY_URL || !env.XAMAN_PROXY_SHARED_SECRET) {
    return new Response(JSON.stringify({ error: 'xaman_not_configured' }), { status: 501 });
  }

  const token = getCookie(request, BOARD_COOKIE_NAME);
  if (!token) {
    return new Response(JSON.stringify({ error: 'no_session' }), { status: 401 });
  }
  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401 });
  }
  const buyer = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const xrpDrops = body && body.xrpDrops;
  const collection = (body && body.collection) || 'pigeons';
  const result = await buildBuySwapTxjson(buyer, xrpDrops, collection);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 400 });
  }

  const pushToken = await getXamanUserToken(env.coin, buyer);
  const xummData = await createXamanPayload(env, result.txjson, undefined, pushToken);
  if (!xummData || !xummData.uuid || !xummData.next) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, uuid: xummData.uuid, next: xummData.next, display: result.display }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
