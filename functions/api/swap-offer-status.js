import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffers, findSwapOffer,
  getXamanPayloadStatus
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
  const offerer = payload.acct;

  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid');
  const nftId = url.searchParams.get('nftId');
  const toWallet = url.searchParams.get('toWallet');
  if (
    !uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) ||
    !nftId || !/^[0-9A-Fa-f]{64}$/.test(nftId) ||
    !toWallet || !XRPL_ADDRESS_RE.test(toWallet)
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

  return new Response(JSON.stringify({
    status: 'offer_created',
    txHash,
    offerId: ownOffer.nft_offer_index,
    toWallet
  }), { headers: { 'Content-Type': 'application/json' } });
}
