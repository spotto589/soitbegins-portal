import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffers, fetchAllAccountNfts,
  getXamanPayloadStatus, removeIncomingTransfer
} from '../_shared.js';

// Polled by the browser after [ OPEN XAMAN ] while the recipient is
// signing. Same "never trust Xaman's word alone" posture as swap-buy-
// status.js: once Xaman reports signed+dispatched, this requires BOTH the
// NFT to now appear in the recipient's own account_nfts AND the specific
// offerId to be gone from nft_sell_offers before declaring success.
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
  const recipient = payload.acct;

  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid');
  const nftId = url.searchParams.get('nftId');
  const offerId = url.searchParams.get('offerId');
  if (
    !uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) ||
    !nftId || !/^[0-9A-Fa-f]{64}$/.test(nftId) ||
    !offerId || !/^[0-9A-Fa-f]{64}$/.test(offerId)
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

  const [recipientNfts, remainingOffers] = await Promise.all([
    fetchAllAccountNfts(recipient),
    fetchNftSellOffers(nftId)
  ]);
  const recipientOwnsIt = recipientNfts.some(n => n.NFTokenID === nftId);
  const offerGone = !remainingOffers.some(o => o.nft_offer_index === offerId);

  if (!recipientOwnsIt || !offerGone) {
    // Signed successfully on Xaman's side but not yet fully reflected on
    // ledger reads — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  context.waitUntil(removeIncomingTransfer(env.coin, recipient, offerId));

  return new Response(JSON.stringify({ status: 'settled', txHash }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
