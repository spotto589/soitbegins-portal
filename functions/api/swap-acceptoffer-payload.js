import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNftsChecked, fetchNftBuyOffers,
  fetchDeeptideNftDetail, createXamanPayload, getXamanUserToken, getTradeConfig,
  encodeCurrencyCode, computeMarketplaceFee, MARKETPLACE_BROKER_WALLET,
  acquireBrokerAcceptLock, releaseBrokerAcceptLock, recordPendingBrokerAccept, applyNftRoyalty
} from '../_shared.js';

// Re-derives and re-validates the exact same seller sell-offer txjson
// swap-acceptoffer-prepare.js already showed (never trusts a txjson the
// client might send back — only nftId + offerId), then asks Xaman to
// create a real sign request for it. Stashes the fee breakdown + buyer +
// buy-offer id now (by settlement time the accepted buy offer is gone
// from the ledger and no longer derivable) — swap-acceptoffer-status.js
// picks this up once the seller's sell offer confirms, to build and
// submit the actual brokered NFTokenAcceptOffer.
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
  const owner = payload.acct;

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
  const offerId = body && body.offerId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId) ||
      !offerId || typeof offerId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(offerId)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  // Checked, not the plain fetchAllAccountNfts — see swap-listing-
  // payload.js's own comment on this same fix: a failed/rate-limited XRPL
  // scan returns the same empty-ish array a genuinely-empty wallet would,
  // which produced real false not_owned errors for a wallet that
  // actually does own the NFT.
  const { nfts, ok: nftsOk } = await fetchAllAccountNftsChecked(owner);
  if (!nftsOk) {
    return new Response(JSON.stringify({ error: 'lookup_failed' }), { status: 502 });
  }
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
      offer.amount.currency !== encodeCurrencyCode(cfg.tokenConfig.currency) ||
      offer.amount.issuer !== cfg.tokenConfig.issuer) {
    return new Response(JSON.stringify({ error: 'unexpected_offer_currency' }), { status: 400 });
  }

  const fee = computeMarketplaceFee(offer.amount.value);
  if (!fee) {
    return new Response(JSON.stringify({ error: 'invalid_offer_amount' }), { status: 400 });
  }

  // Lock acquired only once every validation above has passed — matches
  // swap-buy-payload.js's pattern. Acquiring it earlier (before these
  // checks) meant a routine validation failure (stale offer, wrong
  // currency, etc.) left the lock stuck for the full
  // BROKER_ACCEPT_LOCK_TTL_SECONDS with no release path, so any legitimate
  // retry on the same offer within that window got wrongly told
  // "already_processing".
  if (env.coin) {
    const gotLock = await acquireBrokerAcceptLock(env.coin, offerId);
    if (!gotLock) {
      return new Response(JSON.stringify({ error: 'already_processing' }), { status: 409 });
    }
  }

  const txjson = {
    TransactionType: 'NFTokenCreateOffer',
    Account: owner,
    NFTokenID: nftId,
    Amount: {
      currency: encodeCurrencyCode(cfg.tokenConfig.currency),
      issuer: cfg.tokenConfig.issuer,
      value: fee.sellerValue
    },
    Destination: MARKETPLACE_BROKER_WALLET,
    Flags: 1
  };

  const pushToken = await getXamanUserToken(env.coin, owner);
  const xummData = await createXamanPayload(env, txjson, undefined, pushToken);
  if (!xummData || !xummData.uuid || !xummData.next) {
    if (env.coin) context.waitUntil(releaseBrokerAcceptLock(env.coin, offerId));
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  // CANCEL/DELIST-style instant flow now (see openDelistConfirm in
  // static.js) — the confirm-first screen is gone, so this is the only
  // response the client ever gets before Xaman opens. Includes the same
  // fee/royalty breakdown swap-acceptoffer-prepare.js's old preview
  // screen used to show, so the waiting panel can still display it
  // (see applyNftRoyalty's own comment in _shared.js for why sellerValue
  // alone was never the real final number).
  const royalty = applyNftRoyalty(fee.sellerValue, nftId);

  if (env.coin) {
    const item = await fetchDeeptideNftDetail(nftId).catch(() => null);
    context.waitUntil(recordPendingBrokerAccept(env.coin, xummData.uuid, {
      nftId,
      offerId,
      seller: owner,
      buyer: offer.owner,
      collection,
      totalValue: fee.totalValue,
      feeValue: fee.feeValue,
      sellerValue: fee.sellerValue,
      pigeonNumber: (item && item.number) || null
    }));
  }

  return new Response(JSON.stringify({
    ok: true,
    uuid: xummData.uuid,
    next: xummData.next,
    display: {
      buyer: offer.owner,
      totalValue: fee.totalValue,
      feeValue: fee.feeValue,
      sellerValue: royalty.finalSellerValue,
      royaltyValue: royalty.royaltyValue,
      royaltyPercent: royalty.royaltyPercent
    }
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
