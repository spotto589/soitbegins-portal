import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffersOrNull,
  getXamanPayloadStatus, removeSwapListing
} from '../_shared.js';

const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

// Polled by the browser after [ OPEN XAMAN ] while the seller is signing.
// Never trusts Xaman's word alone for "delisted" — once Xaman reports the
// transaction as signed+dispatched, this requires the offer to actually be
// gone from real nft_sell_offers before declaring success.
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
  const seller = payload.acct;

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

  // "Gone" here is a SINGLE signal for delisting — unlike BUY, there's no
  // second independent check to fall back on. A lookup failure (e.g.
  // xrplcluster.com rate-limiting) must never be treated as "confirmed
  // gone," or a transient blip could wrongly declare DELISTED while the
  // offer is still live. null means "couldn't verify" — keep polling,
  // same as still finding the offer.
  const remainingOffers = await fetchNftSellOffersOrNull(nftId);
  const stillThere = remainingOffers === null || remainingOffers.some(o => o.owner === seller);
  if (stillThere) {
    // Signed successfully on Xaman's side but not yet reflected on ledger
    // reads (or the read itself failed) — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  context.waitUntil(removeSwapListing(env.coin, nftId));

  return new Response(JSON.stringify({ status: 'delisted', txHash }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
