import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts,
  PIGEON_ISSUER, PIGEON_TAXON, isTransferable,
  PIGEONS_TOKEN_CONFIG, encodeCurrencyCode, createXamanPayload, getXamanUserToken, swapOfferSourceMemo,
  LISTING_DURATION_DAYS_ALLOWED, DEFAULT_LISTING_DURATION_DAYS, listingExpirationRippleSeconds,
  computeMarketplaceFee, MARKETPLACE_BROKER_WALLET, recordPendingListing
} from '../_shared.js';

// Σκύλλα SWAP — first real listing test. Re-derives and re-validates the
// exact same txjson swap-listing-prepare.js already showed on the
// confirmation screen (never trusts a txjson the client might send back —
// only nftId + priceValue), then asks Xaman to create a real sign request
// for it. The server never signs, never holds a seed/key, and never
// touches the NFT or the $PIGEONS — Xaman only ever asks the user's own
// wallet to approve.
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

  const nfts = await fetchAllAccountNfts(seller);
  const nft = nfts.find(n => n.NFTokenID === nftId);
  if (!nft) {
    return new Response(JSON.stringify({ error: 'not_owned' }), { status: 403 });
  }
  if (nft.Issuer !== PIGEON_ISSUER || nft.NFTokenTaxon !== PIGEON_TAXON) {
    return new Response(JSON.stringify({ error: 'not_a_pigeon' }), { status: 400 });
  }
  if (!isTransferable(nft)) {
    return new Response(JSON.stringify({ error: 'not_transferable' }), { status: 400 });
  }

  const fee = computeMarketplaceFee(priceStr);
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
      currency: encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency),
      issuer: PIGEONS_TOKEN_CONFIG.issuer,
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

  const pushToken = await getXamanUserToken(env.coin, seller);
  const xummData = await createXamanPayload(env, txjson, undefined, pushToken);
  const uuid = xummData && xummData.uuid;
  const next = xummData && xummData.next;
  if (!uuid || !next) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  // Stash the seller's GROSS typed price now, while it's still known —
  // once the sell offer lands on-ledger, its own Amount is the NET
  // sellerValue, and swap-listing-status.js has no other way to recover
  // what the buyer is actually meant to pay.
  if (env.coin) {
    context.waitUntil(recordPendingListing(env.coin, uuid, {
      nftId,
      seller,
      totalValue: fee.totalValue,
      feeValue: fee.feeValue,
      sellerValue: fee.sellerValue
    }));
  }

  console.log('SWAP listing payload created', uuid, 'for', seller, nftId, 'total', fee.totalValue, 'seller gets', fee.sellerValue, 'at', new Date().toISOString());

  return new Response(JSON.stringify({ ok: true, uuid, next, qr: xummData.refs && xummData.refs.qr_png }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
