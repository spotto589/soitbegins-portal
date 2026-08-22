import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffersOrNull, createXamanPayload, findPigeonsOffer
} from '../_shared.js';

// Re-derives and re-validates the exact same txjson swap-buy-prepare.js
// already showed on the confirmation screen (never trusts a txjson the
// client might send back — only nftId), then asks Xaman to create a real
// sign request for it. The server never signs, never holds a seed/key, and
// never touches the NFT or the $PIGEONS — Xaman only ever asks the buyer's
// own wallet to approve.
export async function onRequestPost(context) {
  const { request, env } = context;
  console.log('BUY-PAYLOAD start', request.headers.get('User-Agent'), request.headers.get('Content-Type'));

  if (!env.Σκύλλα) {
    console.log('BUY-PAYLOAD exit: server_misconfigured');
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }
  if (!env.XAMAN_PROXY_URL || !env.XAMAN_PROXY_SHARED_SECRET) {
    console.log('BUY-PAYLOAD exit: xaman_not_configured');
    return new Response(JSON.stringify({ error: 'xaman_not_configured' }), { status: 501 });
  }

  const token = getCookie(request, BOARD_COOKIE_NAME);
  if (!token) {
    console.log('BUY-PAYLOAD exit: no_session, Cookie header present:', !!request.headers.get('Cookie'));
    return new Response(JSON.stringify({ error: 'no_session' }), { status: 401 });
  }
  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    console.log('BUY-PAYLOAD exit: invalid_session');
    return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401 });
  }
  const buyer = payload.acct;
  console.log('BUY-PAYLOAD session ok, buyer', buyer);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    console.log('BUY-PAYLOAD exit: bad_request', e && e.message);
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const nftId = body && body.nftId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    console.log('BUY-PAYLOAD exit: invalid_nft_id', JSON.stringify(nftId));
    return new Response(JSON.stringify({ error: 'invalid_nft_id' }), { status: 400 });
  }

  // null (lookup itself failed) must never be reported as "not listed" —
  // see swap-buy-prepare.js's identical comment.
  const offers = await fetchNftSellOffersOrNull(nftId);
  if (offers === null) {
    console.log('BUY-PAYLOAD exit: lookup_failed for', nftId);
    return new Response(JSON.stringify({ error: 'lookup_failed' }), { status: 503 });
  }
  console.log('BUY-PAYLOAD offers found:', offers.length);
  // The Σκύλλα $PIGEONS offer specifically — see findPigeonsOffer's own
  // comment for why offers[0]/owner-only matching is wrong here.
  const offer = findPigeonsOffer(offers);
  if (!offer) {
    console.log('BUY-PAYLOAD exit: not_listed (no matching $PIGEONS offer among', offers.length, 'offers)');
    return new Response(JSON.stringify({ error: 'not_listed' }), { status: 404 });
  }
  if (offer.owner === buyer) {
    console.log('BUY-PAYLOAD exit: cannot_buy_own_listing');
    return new Response(JSON.stringify({ error: 'cannot_buy_own_listing' }), { status: 400 });
  }
  console.log('BUY-PAYLOAD offer matched', offer.nft_offer_index, 'seller', offer.owner);

  const txjson = {
    TransactionType: 'NFTokenAcceptOffer',
    Account: buyer,
    NFTokenSellOffer: offer.nft_offer_index
  };

  const xummData = await createXamanPayload(env, txjson);
  if (!xummData || !xummData.uuid || !xummData.next) {
    console.log('BUY-PAYLOAD exit: xaman_request_failed, xummData was', JSON.stringify(xummData));
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  console.log('BUY-PAYLOAD SUCCESS', xummData.uuid, 'for', buyer, nftId, 'at', new Date().toISOString());

  return new Response(JSON.stringify({ ok: true, uuid: xummData.uuid, next: xummData.next }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
