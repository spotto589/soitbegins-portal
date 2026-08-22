import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts, fetchNftBuyOffers,
  getXamanPayloadStatus, takePendingBuy, recordSwapSale, removeSwapBuyOffer, removeSwapListing
} from '../_shared.js';

// Polled by the browser after [ OPEN XAMAN ] while the owner is signing.
// Never trusts Xaman's word alone for "offer accepted" — once Xaman reports
// the transaction as signed+dispatched, this requires BOTH real on-ledger
// signals: the NFT no longer appears in the owner's own account_nfts
// (accepting a buy-offer transfers it away), AND the offer is gone from
// nft_buy_offers.
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

  const [ownerNfts, remainingOffers] = await Promise.all([
    fetchAllAccountNfts(owner),
    fetchNftBuyOffers(nftId)
  ]);
  const ownerStillHasIt = ownerNfts.some(n => n.NFTokenID === nftId);
  const offerGone = !remainingOffers.some(o => o.nft_offer_index === offerId);

  if (ownerStillHasIt || !offerGone) {
    // Signed successfully on Xaman's side but not yet fully reflected on
    // ledger reads — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  context.waitUntil(removeSwapBuyOffer(env.coin, nftId, offerId));
  // The Pigeon just changed hands entirely outside the LIST/BUY flow — any
  // stale Σκύλλα $PIGEONS listing left on it (from before this offer was
  // accepted) is now void; don't let it keep showing as buyable.
  context.waitUntil(removeSwapListing(env.coin, nftId));
  context.waitUntil((async () => {
    const pending = await takePendingBuy(env.coin, uuid);
    if (!pending) return;
    await recordSwapSale(env.coin, {
      txHash,
      nftId,
      seller: pending.seller,
      buyer: pending.buyer,
      priceValue: pending.priceValue,
      createdAt: new Date().toISOString()
    });
  })());

  return new Response(JSON.stringify({ status: 'settled', txHash }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
