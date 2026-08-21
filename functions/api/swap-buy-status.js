import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffers, fetchAllAccountNfts,
  getXamanPayloadStatus, removeSwapListing
} from '../_shared.js';

const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

// Polled by the browser after [ OPEN XAMAN ] while the buyer is signing.
// Never trusts Xaman's word alone for "purchase settled" — once Xaman
// reports the transaction as signed+dispatched, this requires BOTH real
// on-ledger signals before declaring success: the NFT now appears in the
// buyer's own account_nfts, AND the sell offer is gone from
// nft_sell_offers. Either alone isn't enough (ledger propagation can be
// uneven across reads).
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }
  if (!env.XAMAN_API_SECRET) {
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

  const xummData = await getXamanPayloadStatus(XAMAN_API_KEY, env.XAMAN_API_SECRET, uuid);
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

  const [buyerNfts, remainingOffers] = await Promise.all([
    fetchAllAccountNfts(buyer),
    fetchNftSellOffers(nftId)
  ]);
  const buyerOwnsIt = buyerNfts.some(n => n.NFTokenID === nftId);
  const offerGone = !remainingOffers.length;

  if (!buyerOwnsIt || !offerGone) {
    // Signed successfully on Xaman's side but not yet fully reflected on
    // ledger reads — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  context.waitUntil(removeSwapListing(env.coin, nftId));

  return new Response(JSON.stringify({ status: 'settled', txHash }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
