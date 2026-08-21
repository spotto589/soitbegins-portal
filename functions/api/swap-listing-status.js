import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffers
} from '../_shared.js';

const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

// Polled by the browser after [ OPEN XAMAN ] while the user is signing.
// Never trusts Xaman's word alone for "it's listed" — once Xaman reports
// the transaction as signed+dispatched, this cross-checks the real XRPL
// sell-offer object for that NFT (nft_sell_offers) so the final result
// always comes from on-ledger state, not a browser-stored flag.
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
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

  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid');
  const nftId = url.searchParams.get('nftId');
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) || !nftId || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const xummRes = await fetch('https://xumm.app/api/v1/platform/payload/' + uuid, {
    headers: { 'X-API-Key': XAMAN_API_KEY, 'X-API-Secret': env.XAMAN_API_SECRET }
  });
  if (!xummRes.ok) {
    return new Response(JSON.stringify({ error: 'xaman_lookup_failed' }), { status: 502 });
  }
  const xummData = await xummRes.json();
  const meta = xummData && xummData.meta;
  const resp = xummData && xummData.response;

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

  // Confirm on real ledger state, not just Xaman's word — find the sell
  // offer this seller's own account created for this exact NFT (`owner` on
  // nft_sell_offers is the offer's creator).
  const seller = payload.acct;
  const offers = await fetchNftSellOffers(nftId);
  const ownOffer = offers.find(o => o.owner === seller) || null;

  if (!ownOffer) {
    // Signed successfully on Xaman's side but not yet visible via
    // nft_sell_offers (ledger propagation lag) — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    status: 'listed',
    txHash,
    offerId: ownOffer.nft_offer_index,
    price: ownOffer.amount && ownOffer.amount.value,
    currency: ownOffer.amount && ownOffer.amount.currency,
    issuer: ownOffer.amount && ownOffer.amount.issuer
  }), { headers: { 'Content-Type': 'application/json' } });
}
