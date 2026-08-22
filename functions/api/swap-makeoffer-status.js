import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftBuyOffers,
  getXamanPayloadStatus, addSwapBuyOffer, encodeCurrencyCode, PIGEONS_TOKEN_CONFIG
} from '../_shared.js';

// Polled by the browser after [ OPEN XAMAN ] while the offerer is signing.
// Never trusts Xaman's word alone for "offer made" — once Xaman reports the
// transaction as signed+dispatched, this cross-checks the real on-ledger
// buy-offer for that NFT (nft_buy_offers). Matched on buyer + currency/
// issuer + exact price (not just buyer + currency, unlike findPigeonsOffer)
// since a buyer could plausibly have more than one open offer on the same
// Pigeon at different prices.
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
  const priceValue = url.searchParams.get('priceValue');
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) || !nftId || !/^[0-9A-Fa-f]{64}$/.test(nftId) || !priceValue) {
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

  const currency = encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency);
  const offers = await fetchNftBuyOffers(nftId);
  const ownOffer = offers.find(o =>
    o.owner === buyer &&
    o.amount && typeof o.amount === 'object' &&
    o.amount.currency === currency &&
    o.amount.issuer === PIGEONS_TOKEN_CONFIG.issuer &&
    o.amount.value === priceValue
  );

  if (!ownOffer) {
    // Signed successfully on Xaman's side but not yet visible via
    // nft_buy_offers (ledger propagation lag) — caller should keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  context.waitUntil(addSwapBuyOffer(env.coin, nftId, {
    offerId: ownOffer.nft_offer_index,
    buyer,
    price: ownOffer.amount.value,
    createdAt: Math.floor(Date.now() / 1000)
  }));

  return new Response(JSON.stringify({
    status: 'offered',
    txHash,
    offerId: ownOffer.nft_offer_index,
    price: ownOffer.amount.value
  }), { headers: { 'Content-Type': 'application/json' } });
}
