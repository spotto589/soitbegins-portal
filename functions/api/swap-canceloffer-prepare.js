import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftBuyOffersOrNull, findPigeonsOffer
} from '../_shared.js';

// Σκύλλα SWAP — CANCEL an outgoing offer (phase 1). Builds and returns the
// exact NFTokenCancelOffer txjson for the confirmation screen. Same
// pattern as swap-delist-prepare.js (which cancels a SELL offer) but for
// a BUY offer this wallet made on someone else's Pigeon — requires the
// connected wallet to exactly match the live offer's owner (the offerer),
// stricter than raw XRPL permissions, since Scylla's own UI should never
// facilitate cancelling someone else's offer.
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
  const buyer = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const nftId = body && body.nftId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'invalid_nft_id' }), { status: 400 });
  }

  // null specifically means the live nft_buy_offers lookup itself failed —
  // must NOT be treated as "genuinely not offered," same reasoning as
  // swap-delist-prepare.js's own comment on this exact bug class.
  const offers = await fetchNftBuyOffersOrNull(nftId);
  if (offers === null) {
    return new Response(JSON.stringify({ error: 'lookup_failed' }), { status: 502 });
  }
  // Specifically the Σκύλλα $PIGEONS offer — the same wallet could in
  // principle have made more than one offer type on the same NFT.
  const ownOffer = findPigeonsOffer(offers, buyer);
  if (!ownOffer) {
    return new Response(JSON.stringify({ error: 'not_offered_by_you' }), { status: 403 });
  }

  const txjson = {
    TransactionType: 'NFTokenCancelOffer',
    Account: buyer,
    NFTokenOffers: [ownOffer.nft_offer_index]
  };

  return new Response(JSON.stringify({ ok: true, txjson }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
