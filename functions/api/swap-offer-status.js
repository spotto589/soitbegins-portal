import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffers, findSwapOffer,
  getXamanPayloadStatus, getSwapOfferPairs, recordSwapOfferPair
} from '../_shared.js';

const XRPL_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

// Polled by the browser after [ OPEN XAMAN ] while the offerer is signing.
// Never trusts Xaman's word alone — once Xaman reports the transaction as
// signed+dispatched, this cross-checks the real XRPL sell-offer object for
// this NFT (nft_sell_offers) so the result always comes from on-ledger
// state. This only confirms the OFFERER's own half of the swap exists —
// it does not mean the trade is complete, since the counterparty still
// has to create and both sides still have to accept each other's offers.
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
  const offerer = payload.acct;

  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid');
  const nftId = url.searchParams.get('nftId');
  const toWallet = url.searchParams.get('toWallet');
  // Exactly one of these identifies which half of the pair this offer is:
  // wantNftId starts a brand-new pair (this is the FIRST offer, the
  // offerer's own), swapId attaches this offer as the SECOND half onto a
  // pair that already exists (the counterparty reciprocating).
  const wantNftId = url.searchParams.get('wantNftId');
  const swapId = url.searchParams.get('swapId');
  if (
    !uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) ||
    !nftId || !/^[0-9A-Fa-f]{64}$/.test(nftId) ||
    !toWallet || !XRPL_ADDRESS_RE.test(toWallet) ||
    (wantNftId && !/^[0-9A-Fa-f]{64}$/.test(wantNftId)) ||
    (swapId && !/^[0-9a-fA-F-]{10,60}$/.test(swapId))
  ) {
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

  const offers = await fetchNftSellOffers(nftId);
  const ownOffer = findSwapOffer(offers, offerer, toWallet);

  if (!ownOffer) {
    // Signed successfully on Xaman's side but not yet visible via
    // nft_sell_offers (ledger propagation lag) — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Record/update the swap pair so the counterparty can discover this
  // offer, and so either side can later find the other's offerId to
  // accept once both halves exist. A KV write failure here shouldn't stop
  // the offerer from seeing their own successful offer creation — the
  // offer really is on-ledger regardless — so this never blocks the
  // response.
  let resultSwapId = swapId || null;
  if (swapId) {
    const pairs = await getSwapOfferPairs(env.coin);
    const pair = pairs[swapId];
    // Only attach if this really is the expected reciprocal half — the
    // counterparty offering the exact NFT the offerer asked for, back to
    // the offerer's own wallet. Anything else is left alone rather than
    // silently overwriting a pair with mismatched data.
    if (pair && pair.counterparty.wallet === offerer && pair.counterparty.nftId === nftId && pair.offerer.wallet === toWallet) {
      pair.counterparty.offerId = ownOffer.nft_offer_index;
      context.waitUntil(recordSwapOfferPair(env.coin, swapId, pair));
    }
  } else if (wantNftId) {
    resultSwapId = crypto.randomUUID();
    context.waitUntil(recordSwapOfferPair(env.coin, resultSwapId, {
      swapId: resultSwapId,
      createdAt: Date.now(),
      offerer: { wallet: offerer, nftId, offerId: ownOffer.nft_offer_index, accepted: false },
      counterparty: { wallet: toWallet, nftId: wantNftId, offerId: null, accepted: false }
    }));
  }

  return new Response(JSON.stringify({
    status: 'offer_created',
    txHash,
    offerId: ownOffer.nft_offer_index,
    toWallet,
    swapId: resultSwapId
  }), { headers: { 'Content-Type': 'application/json' } });
}
