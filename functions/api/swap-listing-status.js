import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffers, recordSwapListing, findPigeonsOffer,
  getXamanPayloadStatus, getPendingListing, clearPendingListing, computeMarketplaceFee
} from '../_shared.js';

// Polled by the browser after [ OPEN XAMAN ] while the user is signing.
// Never trusts Xaman's word alone for "it's listed" — once Xaman reports
// the transaction as signed+dispatched, this cross-checks the real XRPL
// sell-offer object for that NFT (nft_sell_offers) so the final result
// always comes from on-ledger state, not a browser-stored flag.
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

  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid');
  const nftId = url.searchParams.get('nftId');
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) || !nftId || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const xummData = await getXamanPayloadStatus(env, uuid);
  if (!xummData) {
    return new Response(JSON.stringify({ error: 'xaman_lookup_failed' }), { status: 502 });
  }
  const meta = xummData.meta;
  const resp = xummData.response;

  if (meta && meta.expired) {
    return new Response(JSON.stringify({ status: 'expired' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (meta && meta.cancelled) {
    return new Response(JSON.stringify({ status: 'rejected' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (!meta || !meta.signed) {
    return new Response(JSON.stringify({ status: 'pending' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (resp && resp.dispatched_result && resp.dispatched_result !== 'tesSUCCESS') {
    return new Response(JSON.stringify({ status: 'failed', result: resp.dispatched_result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const txHash = resp && resp.txid;

  // Confirm on real ledger state, not just Xaman's word — find the
  // Σκύλλα $PIGEONS offer this seller's own account created for this
  // exact NFT. Specifically the $PIGEONS one, not just any offer by this
  // owner: confirmed live, a seller can have an unrelated pre-existing
  // offer (e.g. XRP, from Deeptide) on the same NFT — matching on owner
  // alone would grab that instead and either report the wrong price or
  // declare "listed" before the real new offer even exists on ledger.
  const seller = payload.acct;
  const offers = await fetchNftSellOffers(nftId);
  const ownOffer = findPigeonsOffer(offers, seller);

  if (!ownOffer) {
    // Signed successfully on Xaman's side but not yet visible via
    // nft_sell_offers (ledger propagation lag) — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // The on-ledger offer's own Amount is now the NET sellerValue (the fee
  // moved to LIST time so BUY NOW stays one buyer signature) — the GROSS
  // price buyers actually pay/see everywhere else on the site has to come
  // from the record swap-listing-payload.js stashed at signing time.
  // Cross-checked against the real on-ledger amount before trusting it, so
  // a stale/tampered pending record can never make the displayed price
  // disagree with what the buyer will really end up paying.
  const pending = await getPendingListing(env.coin, uuid);
  const pendingFee = pending ? computeMarketplaceFee(pending.totalValue) : null;
  const pendingValid = pendingFee && pendingFee.sellerValue === (ownOffer.amount && ownOffer.amount.value);
  const displayPrice = pendingValid ? pendingFee.totalValue : (ownOffer.amount && ownOffer.amount.value);

  // Record it in the Σκύλλα listings index — this is what powers the
  // LISTED browse filter, the badges on ordinary browse cards, and (via
  // swap-buy-prepare.js) the GROSS price BUY NOW charges the buyer.
  // Doesn't block the response; a KV write failure here shouldn't stop the
  // user from seeing their own successful listing result.
  context.waitUntil(recordSwapListing(env.coin, nftId, {
    price: displayPrice,
    totalValue: pendingValid ? pendingFee.totalValue : null,
    feeValue: pendingValid ? pendingFee.feeValue : null,
    sellerValue: pendingValid ? pendingFee.sellerValue : null,
    currency: ownOffer.amount && ownOffer.amount.currency,
    issuer: ownOffer.amount && ownOffer.amount.issuer,
    offerId: ownOffer.nft_offer_index,
    expiration: ownOffer.expiration || null,
    seller,
    listedAt: Math.floor(Date.now() / 1000)
  }));
  context.waitUntil(clearPendingListing(env.coin, uuid));

  return new Response(JSON.stringify({
    status: 'listed',
    txHash,
    offerId: ownOffer.nft_offer_index,
    price: displayPrice,
    currency: ownOffer.amount && ownOffer.amount.currency,
    issuer: ownOffer.amount && ownOffer.amount.issuer,
    expiration: ownOffer.expiration || null
  }), { headers: { 'Content-Type': 'application/json' } });
}
