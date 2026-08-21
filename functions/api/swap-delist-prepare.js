import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffers
} from '../_shared.js';

// Σκύλλα SWAP — DELIST (phase 2). Builds and returns the exact
// NFTokenCancelOffer txjson for the confirmation screen. Requires the
// connected wallet to exactly match the live offer's owner — stricter than
// raw XRPL permissions (which also allow a Destination party or, once
// expired, anyone), since Scylla's own UI should never facilitate
// cancelling someone else's listing.
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
  const seller = payload.acct;

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

  const offers = await fetchNftSellOffers(nftId);
  const ownOffer = offers.find(o => o.owner === seller);
  if (!ownOffer) {
    return new Response(JSON.stringify({ error: 'not_listed_by_you' }), { status: 403 });
  }

  const txjson = {
    TransactionType: 'NFTokenCancelOffer',
    Account: seller,
    NFTokenOffers: [ownOffer.nft_offer_index]
  };

  return new Response(JSON.stringify({ ok: true, txjson }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
