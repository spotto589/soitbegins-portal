import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffers, fetchNftBuyOffers, fetchAllAccountNfts,
  getXamanPayloadStatus, removeSwapListing, findCollectionOffer, getTradeConfig, takePendingBuy, recordSwapSale,
  peekPendingBrokerAccept, takePendingBrokerAccept, releaseBrokerAcceptLock,
  encodeCurrencyCode, MARKETPLACE_BROKER_WALLET,
  swapOfferSourceMemo, brokeredSaleMemo, submitAsBroker, verifyBrokerFeeFromMeta, payBrokerReward, applyNftRoyalty
} from '../_shared.js';

// Polled by the browser after [ OPEN XAMAN ] while the buyer is signing.
// Never trusts Xaman's word alone for "purchase settled" — everything below
// requires real on-ledger reads before declaring success.
//
// Two flows share this endpoint, told apart by whether swap-buy-payload.js
// stashed a pending broker-accept record for this uuid (fee-bearing,
// post-rollout listing) or not (legacy listing, predates the marketplace
// fee — see swap-buy-prepare.js's own comment). Legacy stays the original
// direct-accept settlement check. The fee-bearing flow mirrors
// swap-acceptoffer-status.js exactly, with the roles reversed: once the
// buyer's own real $PIGEONS buy offer lands on-ledger, THIS request (not
// the client) builds and submits the actual brokered NFTokenAcceptOffer —
// signed by the broker wallet itself via xaman-proxy's /broker-submit,
// never by the buyer or seller.
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
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
  const buyer = payload.acct;

  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid');
  const nftId = url.searchParams.get('nftId');
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) || !nftId || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  // Non-consuming — safe to check on every poll, including the early ones
  // where the fee-bearing flow hasn't reached settlement yet.
  const feeFlow = await peekPendingBrokerAccept(env.coin, uuid);

  const xummData = await getXamanPayloadStatus(env, uuid);
  if (!xummData) {
    return new Response(JSON.stringify({ error: 'xaman_lookup_failed' }), { status: 502 });
  }
  const meta = xummData.meta;
  const resp = xummData.response;

  if (meta && meta.expired) {
    if (feeFlow) context.waitUntil(releaseBrokerAcceptLock(env.coin, feeFlow.offerId));
    return new Response(JSON.stringify({ status: 'expired' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (meta && meta.cancelled) {
    if (feeFlow) context.waitUntil(releaseBrokerAcceptLock(env.coin, feeFlow.offerId));
    return new Response(JSON.stringify({ status: 'rejected' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (!meta || !meta.signed) {
    return new Response(JSON.stringify({ status: 'pending' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (resp && resp.dispatched_result && resp.dispatched_result !== 'tesSUCCESS') {
    if (feeFlow) context.waitUntil(releaseBrokerAcceptLock(env.coin, feeFlow.offerId));
    return new Response(JSON.stringify({ status: 'failed', result: resp.dispatched_result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const txHash = resp && resp.txid;

  // ─── Legacy: buyer's transaction WAS the direct accept — same check as
  // before the marketplace-fee rollout.
  if (!feeFlow) {
    const [buyerNfts, remainingOffers] = await Promise.all([
      fetchAllAccountNfts(buyer),
      fetchNftSellOffers(nftId)
    ]);
    const buyerOwnsIt = buyerNfts.some(n => n.NFTokenID === nftId);
    // Legacy branch only ever applies to a listing that predates the
    // marketplace-fee rollout — real for old Pigeons listings, can never
    // trigger for a new collection (every listing there is created
    // through the current Destination-restricted model), so 'pigeons' is
    // correct here unconditionally, not a collection this poll knows.
    const offerGone = !findCollectionOffer(remainingOffers, 'pigeons');

    if (!buyerOwnsIt || !offerGone) {
      return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    context.waitUntil(removeSwapListing(env.coin, nftId));
    context.waitUntil((async () => {
      const pending = await takePendingBuy(env.coin, uuid);
      if (!pending) return; // stash missing/expired — sale still settled, just no SALES DATA row
      await recordSwapSale(env.coin, {
        txHash,
        nftId,
        seller: pending.seller,
        buyer,
        priceValue: pending.priceValue,
        createdAt: new Date().toISOString()
      });
    })());

    return new Response(JSON.stringify({ status: 'settled', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ─── Fee-bearing: buyer's transaction was a real BUY offer for the full
  // price, not an accept — confirm it actually landed on-ledger before
  // doing anything else.
  const collection = feeFlow.collection || 'pigeons';
  const cfg = getTradeConfig(collection);
  if (!cfg) {
    return new Response(JSON.stringify({ error: 'invalid_collection' }), { status: 400 });
  }
  const tokenCurrency = encodeCurrencyCode(cfg.tokenConfig.currency);
  const buyOffers = await fetchNftBuyOffers(nftId);
  const buyOffer = buyOffers.find(o =>
    o.owner === buyer &&
    o.amount && typeof o.amount === 'object' &&
    o.amount.currency === tokenCurrency &&
    o.amount.issuer === cfg.tokenConfig.issuer &&
    o.amount.value === feeFlow.totalValue
  );

  if (!buyOffer) {
    // Signed on Xaman's side but not yet reflected in a fresh
    // nft_buy_offers read — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const pending = await takePendingBrokerAccept(env.coin, uuid);
  if (!pending) {
    // Another poll already consumed this and is (or was) submitting the
    // brokered accept — don't resubmit, just read the real outcome.
    const [buyerNfts, remainingSellOffers] = await Promise.all([
      fetchAllAccountNfts(buyer),
      fetchNftSellOffers(nftId)
    ]);
    const buyerOwnsIt = buyerNfts.some(n => n.NFTokenID === nftId);
    const sellOfferGone = !remainingSellOffers.some(o => o.nft_offer_index === feeFlow.offerId);
    if (buyerOwnsIt && sellOfferGone) {
      return new Response(JSON.stringify({ status: 'settled' }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ status: 'brokering_in_progress' }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Re-verify the seller's sell offer is STILL there right before building
  // the brokered accept — it could have been cancelled in the time since
  // the buyer started signing.
  const sellOffers = await fetchNftSellOffers(nftId);
  const sellOffer = sellOffers.find(o => o.nft_offer_index === pending.offerId);
  if (!sellOffer) {
    context.waitUntil(releaseBrokerAcceptLock(env.coin, pending.offerId));
    return new Response(JSON.stringify({ status: 'sell_offer_gone' }), { headers: { 'Content-Type': 'application/json' } });
  }

  const brokerTxjson = {
    TransactionType: 'NFTokenAcceptOffer',
    NFTokenBuyOffer: buyOffer.nft_offer_index,
    NFTokenSellOffer: pending.offerId,
    NFTokenBrokerFee: {
      currency: tokenCurrency,
      issuer: cfg.tokenConfig.issuer,
      value: pending.feeValue
    },
    Memos: [...swapOfferSourceMemo(), brokeredSaleMemo(pending.pigeonNumber)]
  };

  const brokerResult = await submitAsBroker(env, brokerTxjson);
  if (!brokerResult.ok) {
    context.waitUntil(releaseBrokerAcceptLock(env.coin, pending.offerId));
    return new Response(JSON.stringify({
      status: 'failed',
      result: brokerResult.engineResult || brokerResult.error || 'broker_submit_failed'
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Confirm the 0.589% actually landed in the broker wallet, straight from
  // this settling transaction's own metadata — not just trusting the
  // proxy's tesSUCCESS.
  const feeCheck = verifyBrokerFeeFromMeta(brokerResult.meta, MARKETPLACE_BROKER_WALLET, cfg.tokenConfig.issuer, tokenCurrency, pending.feeValue);

  // A THIRD, separate deduction — see applyNftRoyalty's own comment in
  // _shared.js, and swap-acceptoffer-status.js's identical fix. Real,
  // confirmed live: pending.sellerValue is only the marketplace-fee-
  // adjusted portion, not what actually lands in the seller's wallet —
  // XRPL takes this NFT's own on-ledger royalty automatically in the same
  // settling transaction, before this response is even built.
  const royalty = applyNftRoyalty(pending.sellerValue, nftId);

  context.waitUntil(releaseBrokerAcceptLock(env.coin, pending.offerId));
  context.waitUntil(removeSwapListing(env.coin, nftId, collection));
  context.waitUntil(recordSwapSale(env.coin, {
    txHash: brokerResult.hash,
    nftId,
    seller: pending.seller,
    buyer: pending.buyer,
    priceValue: pending.totalValue,
    feeValue: pending.feeValue,
    sellerValue: royalty.finalSellerValue,
    royaltyValue: royalty.royaltyValue,
    royaltyPercent: royalty.royaltyPercent,
    brokerFeeVerified: feeCheck.ok,
    createdAt: new Date().toISOString()
  }, collection));
  // $CRWN reward to both sides, TEST-PHASE flat amount — see
  // swap-acceptoffer-status.js's identical comment.
  context.waitUntil(payBrokerReward(env, pending.buyer, 'Σκύλλα REWARD | BUYER | #' + (pending.pigeonNumber || '?')).catch(() => {}));
  context.waitUntil(payBrokerReward(env, pending.seller, 'Σκύλλα REWARD | SELLER | #' + (pending.pigeonNumber || '?')).catch(() => {}));

  return new Response(JSON.stringify({
    status: 'settled',
    txHash: brokerResult.hash,
    totalValue: pending.totalValue,
    feeValue: pending.feeValue,
    sellerValue: royalty.finalSellerValue,
    royaltyValue: royalty.royaltyValue,
    royaltyPercent: royalty.royaltyPercent,
    brokerFeeVerified: feeCheck.ok
  }), { headers: { 'Content-Type': 'application/json' } });
}
