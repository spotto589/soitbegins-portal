import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, buildBuySwapTxjson
} from '../_shared.js';

// BUY $PIGEONS swap — builds and returns the exact Payment txjson, for the
// review screen to display and the user to inspect BEFORE anything ever
// reaches Xaman. No signing/submission here at all — buildBuySwapTxjson
// (see its own comment in _shared.js) is the single source of truth this
// AND buyswap-payload.js both call, so the transaction reviewed here is
// guaranteed to be built by the exact same logic as the one actually sent
// for signing.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
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

  // The XRP amount is the only thing trusted from the client at all, and
  // even that only as a REQUEST — buildBuySwapTxjson re-derives everything
  // that actually goes into the txjson from live ledger/liquidity state.
  const xrpDrops = body && body.xrpDrops;
  const collection = (body && body.collection) || 'pigeons';
  const result = await buildBuySwapTxjson(buyer, xrpDrops, collection);
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), { status: 400 });
  }

  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
}
