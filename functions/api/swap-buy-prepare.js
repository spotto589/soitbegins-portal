import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffersOrNull, findPigeonsOffer, fetchNftCurrentOwner
} from '../_shared.js';

// Σκύλλα SWAP — BUY (phase 2). Builds and returns the exact
// NFTokenAcceptOffer txjson for the confirmation screen. Everything comes
// from a FRESH nft_sell_offers lookup, never the cached Σκύλλα listings
// index — that index only ever gates "is this NFT Scylla-tracked at all,"
// the live offer is the sole source of truth for the offer ID, seller, and
// price actually used or shown.
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

  // null (lookup itself failed, e.g. xrplcluster.com rate-limited) must
  // never be reported as "not listed" — confirmed live, that intermittent
  // mislabeling is exactly what made a genuinely-listed Pigeon randomly
  // fail to open. lookup_failed is retryable; not_listed is not.
  const offers = await fetchNftSellOffersOrNull(nftId);
  if (offers === null) {
    return new Response(JSON.stringify({ error: 'lookup_failed' }), { status: 503 });
  }
  // Who actually owns this NFT right now — required so the offer lookup
  // below can't pick a stale offer left behind by a PREVIOUS owner (XRPL
  // never auto-cancels those when the NFT changes hands). See
  // fetchNftCurrentOwner's own comment: this is exactly what was making a
  // real buyer, who once listed and sold this same Pigeon, get told they
  // "can't buy their own listing" on someone else's real, current one.
  const currentOwner = await fetchNftCurrentOwner(nftId);
  if (!currentOwner) {
    return new Response(JSON.stringify({ error: 'lookup_failed' }), { status: 503 });
  }
  // The Σκύλλα $PIGEONS offer specifically, and only from the confirmed
  // current owner — a Pigeon can carry other currencies' sell offers
  // simultaneously (e.g. a separate XRP listing on Deeptide), or a stale
  // offer from whoever held it before; this never grabs either by accident.
  const offer = findPigeonsOffer(offers, currentOwner);
  if (!offer) {
    return new Response(JSON.stringify({ error: 'not_listed' }), { status: 404 });
  }
  if (offer.owner === buyer) {
    return new Response(JSON.stringify({ error: 'cannot_buy_own_listing' }), { status: 400 });
  }

  const txjson = {
    TransactionType: 'NFTokenAcceptOffer',
    Account: buyer,
    NFTokenSellOffer: offer.nft_offer_index
  };

  return new Response(JSON.stringify({
    ok: true,
    txjson,
    display: {
      nftId,
      seller: offer.owner,
      price: offer.amount.value,
      currency: offer.amount.currency,
      issuer: offer.amount.issuer
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
