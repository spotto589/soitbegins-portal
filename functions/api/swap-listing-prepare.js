import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts,
  isTransferable, getTradeConfig,
  encodeCurrencyCode, swapOfferSourceMemo, computeMarketplaceMarkup, MARKETPLACE_BROKER_WALLET,
  LISTING_DURATION_DAYS_ALLOWED, DEFAULT_LISTING_DURATION_DAYS, listingExpirationRippleSeconds
} from '../_shared.js';

// Σκύλλα SWAP — LIST. This endpoint only builds and returns the exact
// NFTokenCreateOffer txjson for the confirmation screen; it never talks to
// Xaman and never touches the NFT or any funds. The browser is never
// trusted for the seller address, the NFT's ownership, or the
// currency/issuer — all of that is re-derived here from the session and
// server-side ledger data.
//
// The on-ledger sell offer is Destination-restricted to the broker wallet
// and created for the seller's exact typed price, untouched — matches how
// xrp.cafe's own listings work (confirmed against a real on-ledger sale of
// theirs, see computeMarketplaceMarkup's own comment in _shared.js). The
// marketplace fee is instead added on top of what BUY NOW charges the
// buyer, taken automatically at sale time via NFTokenBrokerFee — nothing
// is ever deducted from the seller just for listing.
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

  const collection = (body && body.collection) || 'pigeons';
  const cfg = getTradeConfig(collection);
  if (!cfg) {
    return new Response(JSON.stringify({ error: 'invalid_collection' }), { status: 400 });
  }

  const nftId = body && body.nftId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'invalid_nft_id' }), { status: 400 });
  }

  const priceValue = body && body.priceValue;
  const priceNum = typeof priceValue === 'string' ? Number(priceValue) : priceValue;
  if (typeof priceNum !== 'number' || !isFinite(priceNum) || priceNum <= 0) {
    return new Response(JSON.stringify({ error: 'invalid_price' }), { status: 400 });
  }
  // XRPL issued-currency values are strings; up to 15 significant digits.
  const priceStr = String(priceNum);
  if (priceStr.replace(/[-.]/g, '').length > 15) {
    return new Response(JSON.stringify({ error: 'invalid_price' }), { status: 400 });
  }

  if (!cfg.tokenConfig.configured) {
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 501 });
  }

  const nfts = await fetchAllAccountNfts(seller);
  const nft = nfts.find(n => n.NFTokenID === nftId);
  if (!nft) {
    return new Response(JSON.stringify({ error: 'not_owned' }), { status: 403 });
  }
  if (nft.Issuer !== cfg.nftIssuer || nft.NFTokenTaxon !== cfg.nftTaxon) {
    return new Response(JSON.stringify({ error: 'not_a_pigeon' }), { status: 400 });
  }
  if (!isTransferable(nft)) {
    return new Response(JSON.stringify({ error: 'not_transferable' }), { status: 400 });
  }

  const fee = computeMarketplaceMarkup(priceStr);
  if (!fee) {
    return new Response(JSON.stringify({ error: 'invalid_price' }), { status: 400 });
  }

  const durationDays = LISTING_DURATION_DAYS_ALLOWED.includes(body && body.durationDays) ? body.durationDays : DEFAULT_LISTING_DURATION_DAYS;
  const expiration = listingExpirationRippleSeconds(durationDays);
  const txjson = {
    TransactionType: 'NFTokenCreateOffer',
    Account: seller,
    NFTokenID: nftId,
    Amount: {
      currency: encodeCurrencyCode(cfg.tokenConfig.currency),
      issuer: cfg.tokenConfig.issuer,
      value: fee.sellerValue
    },
    Destination: MARKETPLACE_BROKER_WALLET,
    Flags: 1,
    // FOREVER (durationDays 0) -> null -> field omitted entirely, which
    // is what "never expires" actually means to XRPL (see
    // listingExpirationRippleSeconds's own comment).
    ...(expiration !== null ? { Expiration: expiration } : {}),
    Memos: swapOfferSourceMemo()
  };

  return new Response(JSON.stringify({
    ok: true,
    txjson,
    durationDays,
    display: { totalValue: fee.totalValue, feeValue: fee.feeValue, sellerValue: fee.sellerValue }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
