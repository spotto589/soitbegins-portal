import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts, fetchNftBuyOffers
} from '../_shared.js';

// Owner accepting an incoming MAKE AN OFFER buy-offer. Builds and returns
// the exact NFTokenAcceptOffer txjson for the confirmation screen. Ownership
// and the offer's continued existence are both re-verified fresh here —
// never trusts the offers-received list's cached view.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
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
  const owner = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const nftId = body && body.nftId;
  const offerId = body && body.offerId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId) ||
      !offerId || typeof offerId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(offerId)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const nfts = await fetchAllAccountNfts(owner);
  if (!nfts.some(n => n.NFTokenID === nftId)) {
    return new Response(JSON.stringify({ error: 'not_owned' }), { status: 403 });
  }

  const offers = await fetchNftBuyOffers(nftId);
  const offer = offers.find(o => o.nft_offer_index === offerId);
  if (!offer) {
    return new Response(JSON.stringify({ error: 'offer_not_found' }), { status: 404 });
  }

  const txjson = {
    TransactionType: 'NFTokenAcceptOffer',
    Account: owner,
    NFTokenBuyOffer: offerId
  };

  return new Response(JSON.stringify({
    ok: true,
    txjson,
    display: { nftId, buyer: offer.owner, price: offer.amount.value }
  }), { headers: { 'Content-Type': 'application/json' } });
}
