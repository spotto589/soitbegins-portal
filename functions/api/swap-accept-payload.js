import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, getSwapOfferPairs, fetchNftSellOffers, findSwapOffer,
  createXamanPayload
} from '../_shared.js';

// Re-derives and re-validates the exact same txjson swap-accept-prepare.js
// already showed on the confirmation screen (never trusts a txjson the
// client might send back — only swapId), then asks Xaman to create a real
// sign request for it.
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
  const acceptor = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }
  const swapId = body && body.swapId;
  if (!swapId || typeof swapId !== 'string' || !/^[0-9a-fA-F-]{10,60}$/.test(swapId)) {
    return new Response(JSON.stringify({ error: 'invalid_swap_id' }), { status: 400 });
  }

  const pairs = await getSwapOfferPairs(env.coin);
  const pair = pairs[swapId];
  if (!pair) {
    return new Response(JSON.stringify({ error: 'swap_not_found' }), { status: 404 });
  }
  const isOfferer = pair.offerer.wallet === acceptor;
  const isCounterparty = pair.counterparty.wallet === acceptor;
  if (!isOfferer && !isCounterparty) {
    return new Response(JSON.stringify({ error: 'not_a_party_to_swap' }), { status: 403 });
  }
  const otherSide = isOfferer ? pair.counterparty : pair.offerer;
  if (!otherSide.offerId) {
    return new Response(JSON.stringify({ error: 'other_side_not_ready' }), { status: 400 });
  }

  const offers = await fetchNftSellOffers(otherSide.nftId);
  const liveOffer = findSwapOffer(offers, otherSide.wallet, acceptor);
  if (!liveOffer) {
    return new Response(JSON.stringify({ error: 'offer_no_longer_active' }), { status: 409 });
  }

  const txjson = {
    TransactionType: 'NFTokenAcceptOffer',
    Account: acceptor,
    NFTokenSellOffer: liveOffer.nft_offer_index
  };

  const xummData = await createXamanPayload(env, txjson);
  const uuid = xummData && xummData.uuid;
  const next = xummData && xummData.next;
  if (!uuid || !next) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  console.log('SWAP accept payload created', uuid, 'for', acceptor, 'swapId', swapId, 'at', new Date().toISOString());

  return new Response(JSON.stringify({ ok: true, uuid, next, qr: xummData.refs && xummData.refs.qr_png }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
