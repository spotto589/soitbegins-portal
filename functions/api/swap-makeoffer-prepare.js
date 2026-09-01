import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchDeeptideNftDetail,
  PIGEONS_TOKEN_CONFIG, encodeCurrencyCode, swapOfferSourceMemo,
  LISTING_DURATION_DAYS_ALLOWED, DEFAULT_LISTING_DURATION_DAYS, listingExpirationRippleSeconds
} from '../_shared.js';

// MAKE AN OFFER — the reverse of LIST. Builds and returns the exact
// NFTokenCreateOffer BUY-offer txjson for the confirmation screen. Unlike
// LIST, the offerer doesn't own the NFT — the owner (and the "not your own
// Pigeon" guard) comes from a fresh Deeptide detail lookup, never from the
// caller's own account_nfts.
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

  const priceValue = body && body.priceValue;
  const priceNum = typeof priceValue === 'string' ? Number(priceValue) : priceValue;
  if (typeof priceNum !== 'number' || !isFinite(priceNum) || priceNum <= 0) {
    return new Response(JSON.stringify({ error: 'invalid_price' }), { status: 400 });
  }
  const priceStr = String(priceNum);
  if (priceStr.replace(/[-.]/g, '').length > 15) {
    return new Response(JSON.stringify({ error: 'invalid_price' }), { status: 400 });
  }

  if (!PIGEONS_TOKEN_CONFIG.configured) {
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 501 });
  }

  const item = await fetchDeeptideNftDetail(nftId);
  if (!item || !item.owner) {
    return new Response(JSON.stringify({ error: 'not_indexed' }), { status: 404 });
  }
  if (item.owner === buyer) {
    return new Response(JSON.stringify({ error: 'cannot_offer_own_pigeon' }), { status: 400 });
  }

  // Reported live as wanting offers to eventually clear themselves when
  // ignored (XRPL has no "rejected" state to detect — see
  // listingExpirationRippleSeconds's own comment on LIST's identical
  // reasoning) instead of sitting live forever with no real answer either
  // way. Same duration set/default as LIST.
  const durationDays = LISTING_DURATION_DAYS_ALLOWED.includes(body && body.durationDays) ? body.durationDays : DEFAULT_LISTING_DURATION_DAYS;
  const expiration = listingExpirationRippleSeconds(durationDays);
  const txjson = {
    TransactionType: 'NFTokenCreateOffer',
    Account: buyer,
    Owner: item.owner,
    NFTokenID: nftId,
    Amount: {
      currency: encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency),
      issuer: PIGEONS_TOKEN_CONFIG.issuer,
      value: priceStr
    },
    // FOREVER (durationDays 0) -> null -> field omitted entirely, same as LIST.
    ...(expiration !== null ? { Expiration: expiration } : {}),
    Memos: swapOfferSourceMemo()
  };

  return new Response(JSON.stringify({
    ok: true,
    txjson,
    display: { nftId, owner: item.owner, price: priceStr }
  }), { headers: { 'Content-Type': 'application/json' } });
}
