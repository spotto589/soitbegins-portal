import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffers, fetchAllAccountNfts, findSwapOffer,
  getXamanPayloadStatus, getSwapOfferPairs, recordSwapOfferPair, removeSwapOfferPair
} from '../_shared.js';

// Polled by the browser after [ OPEN XAMAN ] while the acceptor is signing.
// Never trusts Xaman's word alone for "settled" — once Xaman reports the
// transaction as signed+dispatched, this requires BOTH real on-ledger
// signals: the Pigeon now appears in the acceptor's own account_nfts, AND
// the swap offer is gone from nft_sell_offers (same double-check
// swap-buy-status.js already uses for the $PIGEONS marketplace).
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
  const acceptor = payload.acct;

  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid');
  const swapId = url.searchParams.get('swapId');
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) || !swapId || !/^[0-9a-fA-F-]{10,60}$/.test(swapId)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const pairs = await getSwapOfferPairs(env.coin);
  const pair = pairs[swapId];
  if (!pair) {
    return new Response(JSON.stringify({ error: 'swap_not_found' }), { status: 404 });
  }
  const isOfferer = pair.offerer.wallet === acceptor;
  const isCounterparty = pair.counterparty.wallet === acceptor;
  if (!isOfferer && !isCounterparty) {
    return new Response(JSON.stringify({ error: 'not_a_party_to_swap' }), { status: 403 });
  }
  const mySide = isOfferer ? pair.offerer : pair.counterparty;
  const otherSide = isOfferer ? pair.counterparty : pair.offerer;

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

  const [acceptorNfts, remainingOffers] = await Promise.all([
    fetchAllAccountNfts(acceptor),
    fetchNftSellOffers(otherSide.nftId)
  ]);
  const acceptorOwnsIt = acceptorNfts.some(n => n.NFTokenID === otherSide.nftId);
  const offerGone = !findSwapOffer(remainingOffers, otherSide.wallet, acceptor);

  if (!acceptorOwnsIt || !offerGone) {
    // Signed successfully on Xaman's side but not yet fully reflected on
    // ledger reads — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  mySide.accepted = true;
  if (pair.offerer.accepted && pair.counterparty.accepted) {
    context.waitUntil(removeSwapOfferPair(env.coin, swapId));
  } else {
    context.waitUntil(recordSwapOfferPair(env.coin, swapId, pair));
  }

  return new Response(JSON.stringify({
    status: 'settled',
    txHash,
    nftReceived: otherSide.nftId,
    swapComplete: pair.offerer.accepted && pair.counterparty.accepted
  }), { headers: { 'Content-Type': 'application/json' } });
}
