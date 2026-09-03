import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts, fetchNftBuyOffers, fetchNftSellOffers,
  getXamanPayloadStatus, takePendingBrokerAccept, releaseBrokerAcceptLock,
  recordSwapSale, removeSwapBuyOffer, removeSwapListing,
  PIGEONS_TOKEN_CONFIG, encodeCurrencyCode, MARKETPLACE_BROKER_WALLET,
  swapOfferSourceMemo, brokeredSaleMemo, submitAsBroker, verifyBrokerFeeFromMeta, payBrokerReward, applyNftRoyalty
} from '../_shared.js';

// Polled by the browser after [ OPEN XAMAN ] while the seller signs their
// own destination-restricted sell offer. Never trusts Xaman's word alone
// for "sell offer created" — once Xaman reports it signed+dispatched,
// this requires a real on-ledger read: the sell offer must actually
// appear (owner=seller, Destination=broker, real $PIGEONS amount).
//
// Once that's confirmed, THIS request (not the client) builds and submits
// the real brokered NFTokenAcceptOffer — signed by the broker wallet
// itself via xaman-proxy's /broker-submit, never by the seller or buyer.
// takePendingBrokerAccept is a single-consume KV read (get-then-delete),
// so only the first poll to reach this point actually submits; a
// concurrent/retried poll instead falls back to reading real ledger state
// (NFT ownership + offer presence) rather than resubmitting — the ledger
// itself is the only thing that can make a brokered accept happen twice,
// and it can't (accepting a buy offer consumes it).
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
  const owner = payload.acct;

  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid');
  const nftId = url.searchParams.get('nftId');
  const offerId = url.searchParams.get('offerId');
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) || !nftId || !/^[0-9A-Fa-f]{64}$/.test(nftId) ||
      !offerId || !/^[0-9A-Fa-f]{64}$/.test(offerId)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const xummData = await getXamanPayloadStatus(env, uuid);
  if (!xummData) {
    return new Response(JSON.stringify({ error: 'xaman_lookup_failed' }), { status: 502 });
  }
  const meta = xummData.meta;
  const resp = xummData.response;

  if (meta && meta.expired) {
    context.waitUntil(releaseBrokerAcceptLock(env.coin, offerId));
    return new Response(JSON.stringify({ status: 'expired' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (meta && meta.cancelled) {
    context.waitUntil(releaseBrokerAcceptLock(env.coin, offerId));
    return new Response(JSON.stringify({ status: 'rejected' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (!meta || !meta.signed) {
    return new Response(JSON.stringify({ status: 'pending' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (resp && resp.dispatched_result && resp.dispatched_result !== 'tesSUCCESS') {
    context.waitUntil(releaseBrokerAcceptLock(env.coin, offerId));
    return new Response(JSON.stringify({ status: 'failed', result: resp.dispatched_result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const pigeonsCurrency = encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency);

  // Real on-ledger read for "did the seller's sell offer actually land" —
  // never trusts Xaman's dispatched_result alone.
  const sellOffers = await fetchNftSellOffers(nftId);
  const sellOffer = sellOffers.find(o =>
    o.owner === owner &&
    o.destination === MARKETPLACE_BROKER_WALLET &&
    o.amount && typeof o.amount === 'object' &&
    o.amount.currency === pigeonsCurrency &&
    o.amount.issuer === PIGEONS_TOKEN_CONFIG.issuer
  );

  if (!sellOffer) {
    // Signed on Xaman's side but not yet reflected in a fresh
    // nft_sell_offers read — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const pending = await takePendingBrokerAccept(env.coin, uuid);
  if (!pending) {
    // Another poll already consumed this and is (or was) submitting the
    // brokered accept — don't resubmit, just read the real outcome.
    const [ownerNfts, remainingBuyOffers] = await Promise.all([
      fetchAllAccountNfts(owner),
      fetchNftBuyOffers(nftId)
    ]);
    const sellerStillHasIt = ownerNfts.some(n => n.NFTokenID === nftId);
    const buyOfferGone = !remainingBuyOffers.some(o => o.nft_offer_index === offerId);
    if (!sellerStillHasIt && buyOfferGone) {
      return new Response(JSON.stringify({ status: 'settled' }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ status: 'brokering_in_progress' }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Re-verify the buy offer is STILL there right before building the
  // brokered accept — it could have been cancelled or already consumed
  // in the time since the seller started signing.
  const buyOffers = await fetchNftBuyOffers(nftId);
  const buyOffer = buyOffers.find(o => o.nft_offer_index === offerId);
  if (!buyOffer) {
    context.waitUntil(releaseBrokerAcceptLock(env.coin, offerId));
    return new Response(JSON.stringify({ status: 'buy_offer_gone' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (buyOffer.amount.value !== pending.totalValue) {
    // The only offer that could still exist at this exact index with a
    // different amount would mean something is very wrong (offer amounts
    // are immutable once created) — refuse rather than guess.
    context.waitUntil(releaseBrokerAcceptLock(env.coin, offerId));
    return new Response(JSON.stringify({ status: 'offer_amount_mismatch' }), { headers: { 'Content-Type': 'application/json' } });
  }

  const brokerTxjson = {
    TransactionType: 'NFTokenAcceptOffer',
    NFTokenBuyOffer: offerId,
    NFTokenSellOffer: sellOffer.nft_offer_index,
    NFTokenBrokerFee: {
      currency: pigeonsCurrency,
      issuer: PIGEONS_TOKEN_CONFIG.issuer,
      value: pending.feeValue
    },
    Memos: [...swapOfferSourceMemo(), brokeredSaleMemo(pending.pigeonNumber)]
  };

  const brokerResult = await submitAsBroker(env, brokerTxjson);
  if (!brokerResult.ok) {
    context.waitUntil(releaseBrokerAcceptLock(env.coin, offerId));
    return new Response(JSON.stringify({
      status: 'failed',
      result: brokerResult.engineResult || brokerResult.error || 'broker_submit_failed'
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // Confirm the 0.589% actually landed in the broker wallet, straight from
  // this settling transaction's own metadata — not just trusting the
  // proxy's tesSUCCESS.
  const feeCheck = verifyBrokerFeeFromMeta(brokerResult.meta, MARKETPLACE_BROKER_WALLET, PIGEONS_TOKEN_CONFIG.issuer, pigeonsCurrency, pending.feeValue);

  // A THIRD, separate deduction — confirmed live against a real settled
  // sale (see applyNftRoyalty's own comment in _shared.js): pending.sellerValue
  // here is only the marketplace-fee-adjusted portion, not what actually
  // lands in the seller's wallet. XRPL takes this NFT's own on-ledger
  // royalty automatically, in the exact same settling transaction, before
  // this response is even built — this is purely catching up the DISPLAY
  // to what already really happened on-ledger, not a separate deduction
  // this code performs itself.
  const royalty = applyNftRoyalty(pending.sellerValue, nftId);

  context.waitUntil(releaseBrokerAcceptLock(env.coin, offerId));
  context.waitUntil(removeSwapBuyOffer(env.coin, nftId, offerId));
  context.waitUntil(removeSwapListing(env.coin, nftId));
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
  }));
  // $CRWN reward to both sides, TEST-PHASE flat amount — a separate
  // Payment fired right after settlement (see payBrokerReward), never
  // allowed to affect the sale's own already-settled outcome either way.
  context.waitUntil(payBrokerReward(env, pending.buyer, 'SOITBEGINS REWARD | BUYER | #' + (pending.pigeonNumber || '?')).catch(() => {}));
  context.waitUntil(payBrokerReward(env, pending.seller, 'SOITBEGINS REWARD | SELLER | #' + (pending.pigeonNumber || '?')).catch(() => {}));

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
