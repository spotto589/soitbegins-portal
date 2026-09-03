import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffersOrNull, createXamanPayload, getXamanUserToken, findPigeonsOffer,
  recordPendingBuy, PIGEONS_TOKEN_CONFIG, encodeCurrencyCode, swapOfferSourceMemo, computeMarketplaceMarkup,
  MARKETPLACE_BROKER_WALLET, acquireBrokerAcceptLock, releaseBrokerAcceptLock,
  recordPendingBrokerAccept, fetchDeeptideNftDetail
} from '../_shared.js';

// Re-derives and re-validates the exact same txjson swap-buy-prepare.js
// already showed on the confirmation screen (never trusts a txjson the
// client might send back — only nftId), then asks Xaman to create a real
// sign request for it. The server never signs, never holds a seed/key, and
// never touches the NFT or the $PIGEONS — Xaman only ever asks the buyer's
// own wallet to approve.
//
// For a fee-bearing (post-rollout) listing, that sign request is a real
// $PIGEONS BUY offer for the listed price plus the marketplace's markup,
// not a direct accept — see swap-buy-prepare.js's own comment for why, and
// swap-buy-status.js for the automatic brokered-accept step that follows
// once it lands on-ledger.
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
  const offer = findPigeonsOffer(offers, undefined, buyer);
  if (!offer) {
    console.log('BUY-PAYLOAD exit: not_listed (no non-buyer $PIGEONS offer among', offers.length, 'offers)');
    return new Response(JSON.stringify({ error: 'not_listed' }), { status: 404 });
  }
  console.log('BUY-PAYLOAD offer matched', offer.nft_offer_index, 'seller', offer.owner);

  const pushToken = await getXamanUserToken(env.coin, buyer);

  // Legacy (pre-rollout) listing: no Destination restriction, on-ledger
  // amount already IS the full price — stays the original plain, fee-less
  // direct accept.
  if (offer.destination !== MARKETPLACE_BROKER_WALLET) {
    const txjson = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: buyer,
      NFTokenSellOffer: offer.nft_offer_index
    };
    const xummData = await createXamanPayload(env, txjson, undefined, pushToken);
    if (!xummData || !xummData.uuid || !xummData.next) {
      console.log('BUY-PAYLOAD exit: xaman_request_failed (legacy)', JSON.stringify(xummData));
      return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
    }
    console.log('BUY-PAYLOAD SUCCESS (legacy)', xummData.uuid, 'for', buyer, nftId, 'at', new Date().toISOString());
    if (env.coin) {
      context.waitUntil(recordPendingBuy(env.coin, xummData.uuid, {
        nftId,
        seller: offer.owner,
        buyer,
        priceValue: offer.amount.value
      }));
    }
    return new Response(JSON.stringify({
      ok: true,
      uuid: xummData.uuid,
      next: xummData.next,
      display: { seller: offer.owner, totalValue: offer.amount.value }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // The live sell offer's own Amount IS the real listed price now — see
  // swap-buy-prepare.js's identical comment.
  const fee = computeMarketplaceMarkup(offer.amount.value);
  if (!fee) {
    console.log('BUY-PAYLOAD exit: listing_price_unavailable for', nftId);
    return new Response(JSON.stringify({ error: 'listing_price_unavailable' }), { status: 409 });
  }

  // Guards against two buyers racing the same listing at once — keyed by
  // the SELL offer (the thing that already exists and can only ever be
  // consumed once), not the not-yet-created buy offer. Same best-effort
  // reasoning as ACCEPT OFFER's lock: the real backstop is the ledger
  // itself (only one brokered accept can ever consume a given sell offer).
  const sellOfferId = offer.nft_offer_index;
  if (env.coin) {
    const gotLock = await acquireBrokerAcceptLock(env.coin, sellOfferId);
    if (!gotLock) {
      console.log('BUY-PAYLOAD exit: already_processing for sell offer', sellOfferId);
      return new Response(JSON.stringify({ error: 'already_processing' }), { status: 409 });
    }
  }

  const txjson = {
    TransactionType: 'NFTokenCreateOffer',
    Account: buyer,
    Owner: offer.owner,
    NFTokenID: nftId,
    Amount: {
      currency: encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency),
      issuer: PIGEONS_TOKEN_CONFIG.issuer,
      value: fee.totalValue
    },
    Memos: swapOfferSourceMemo()
  };

  const xummData = await createXamanPayload(env, txjson, undefined, pushToken);
  if (!xummData || !xummData.uuid || !xummData.next) {
    console.log('BUY-PAYLOAD exit: xaman_request_failed', JSON.stringify(xummData));
    if (env.coin) context.waitUntil(releaseBrokerAcceptLock(env.coin, sellOfferId));
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  console.log('BUY-PAYLOAD SUCCESS', xummData.uuid, 'for', buyer, nftId, 'total', fee.totalValue, 'at', new Date().toISOString());

  if (env.coin) {
    const item = await fetchDeeptideNftDetail(nftId).catch(() => null);
    context.waitUntil(recordPendingBrokerAccept(env.coin, xummData.uuid, {
      nftId,
      offerId: sellOfferId,
      seller: offer.owner,
      buyer,
      totalValue: fee.totalValue,
      feeValue: fee.feeValue,
      sellerValue: fee.sellerValue,
      pigeonNumber: (item && item.number) || null
    }));
  }

  // No confirm-first screen any more (see openBuyConfirm in static.js) —
  // this display data is what fills the waiting panel's PIGEON/SELLER/
  // PRICE fields once this response lands, a moment after Xaman's already
  // open, instead of gating it behind a separate confirm click.
  return new Response(JSON.stringify({
    ok: true,
    uuid: xummData.uuid,
    next: xummData.next,
    display: { seller: offer.owner, totalValue: fee.totalValue }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
