import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftBuyOffers, createXamanPayload, getXamanUserToken, findCollectionOffer, getTradeConfig
} from '../_shared.js';

// Re-derives and re-validates the exact same txjson swap-canceloffer-
// prepare.js already showed on the confirmation screen (never trusts a
// txjson the client might send back — only nftId), then asks Xaman to
// create a real sign request for it.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
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

  const collection = (body && body.collection) || 'pigeons';
  if (!getTradeConfig(collection)) {
    return new Response(JSON.stringify({ error: 'invalid_collection' }), { status: 400 });
  }

  const nftId = body && body.nftId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'invalid_nft_id' }), { status: 400 });
  }

  const offers = await fetchNftBuyOffers(nftId);
  const ownOffer = findCollectionOffer(offers, collection, buyer);
  if (!ownOffer) {
    return new Response(JSON.stringify({ error: 'not_offered_by_you' }), { status: 403 });
  }

  const txjson = {
    TransactionType: 'NFTokenCancelOffer',
    Account: buyer,
    NFTokenOffers: [ownOffer.nft_offer_index]
  };

  const pushToken = await getXamanUserToken(env.coin, buyer);
  const xummData = await createXamanPayload(env, txjson, undefined, pushToken);
  if (!xummData || !xummData.uuid || !xummData.next) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, uuid: xummData.uuid, next: xummData.next }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
