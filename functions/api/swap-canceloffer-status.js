import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftBuyOffersOrNull,
  getXamanPayloadStatus, getSwapBuyOffersMap, removeSwapBuyOffer, findCollectionOffer, getTradeConfig
} from '../_shared.js';

// Polled by the browser after [ OPEN XAMAN ] while the offerer is signing.
// Never trusts Xaman's word alone for "cancelled" — once Xaman reports the
// transaction as signed+dispatched, this requires the offer to actually be
// gone from real nft_buy_offers before declaring success.
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
  const collection = url.searchParams.get('collection') || 'pigeons';
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) || !nftId || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }
  if (!getTradeConfig(collection)) {
    return new Response(JSON.stringify({ error: 'invalid_collection' }), { status: 400 });
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

  // "Gone" is a single signal here — same reasoning as swap-delist-
  // status.js's own comment: a lookup failure must never be treated as
  // "confirmed gone," or a transient blip could wrongly declare CANCELLED
  // while the offer is still live. null means "couldn't verify" — keep
  // polling, same as still finding the offer.
  const remainingOffers = await fetchNftBuyOffersOrNull(nftId);
  const stillThere = remainingOffers === null || !!findCollectionOffer(remainingOffers, collection, buyer);
  if (stillThere) {
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Look up the tracked record's own offerId to remove it precisely —
  // it's already gone from the live ledger check above by this point, so
  // this is cleanup of the index only, not a correctness gate.
  context.waitUntil((async () => {
    const map = await getSwapBuyOffersMap(env.coin, collection);
    const stored = (map[nftId] || []).find(o => o.buyer === buyer);
    if (stored) await removeSwapBuyOffer(env.coin, nftId, stored.offerId, collection);
  })());

  return new Response(JSON.stringify({ status: 'cancelled', txHash }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
