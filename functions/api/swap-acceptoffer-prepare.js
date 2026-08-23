import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts, fetchNftBuyOffers,
  PIGEONS_TOKEN_CONFIG, encodeCurrencyCode, computeMarketplaceFee, MARKETPLACE_BROKER_WALLET
} from '../_shared.js';

// Owner accepting an incoming MAKE AN OFFER buy-offer — now via XRPL
// brokered NFTokenAcceptOffer instead of a direct accept, so the
// marketplace fee is taken atomically in the same settling transaction
// (NFTokenBrokerFee), never a second Payment. This endpoint only builds
// and previews the FIRST leg: the seller's own real $PIGEONS sell offer,
// restricted via Destination to the broker wallet — the seller signs
// this (see swap-acceptoffer-payload.js), and only once it's confirmed
// on-ledger does the backend build/submit the actual brokered accept
// (see swap-acceptoffer-status.js). Ownership and the buy-offer's
// continued existence are both re-verified fresh here — never trusts the
// offers-received list's cached view, and the fee is computed from the
// REAL on-ledger offer amount, never a client-supplied figure.
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
  if (offer.owner === owner) {
    return new Response(JSON.stringify({ error: 'cannot_accept_own_offer' }), { status: 400 });
  }
  if (!offer.amount || typeof offer.amount !== 'object' ||
      offer.amount.currency !== encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency) ||
      offer.amount.issuer !== PIGEONS_TOKEN_CONFIG.issuer) {
    return new Response(JSON.stringify({ error: 'unexpected_offer_currency' }), { status: 400 });
  }
  // Expiration is ripple-epoch seconds — XRPL itself would refuse an
  // expired offer at accept time regardless, this just fails fast with a
  // clear reason instead of a confusing on-ledger rejection later.
  if (offer.expiration) {
    const RIPPLE_EPOCH_OFFSET_SECONDS = 946684800;
    const expiresAtMs = (offer.expiration + RIPPLE_EPOCH_OFFSET_SECONDS) * 1000;
    if (Date.now() >= expiresAtMs) {
      return new Response(JSON.stringify({ error: 'offer_expired' }), { status: 400 });
    }
  }

  const fee = computeMarketplaceFee(offer.amount.value);
  if (!fee) {
    return new Response(JSON.stringify({ error: 'invalid_offer_amount' }), { status: 400 });
  }

  const txjson = {
    TransactionType: 'NFTokenCreateOffer',
    Account: owner,
    NFTokenID: nftId,
    Amount: {
      currency: encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency),
      issuer: PIGEONS_TOKEN_CONFIG.issuer,
      value: fee.sellerValue
    },
    Destination: MARKETPLACE_BROKER_WALLET,
    Flags: 1
  };

  return new Response(JSON.stringify({
    ok: true,
    txjson,
    display: {
      nftId,
      buyer: offer.owner,
      totalValue: fee.totalValue,
      feeValue: fee.feeValue,
      sellerValue: fee.sellerValue
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
