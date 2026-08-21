import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffers, createXamanPayload, findPigeonsOffer
} from '../_shared.js';

const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

// Re-derives and re-validates the exact same txjson swap-delist-prepare.js
// already showed on the confirmation screen (never trusts a txjson the
// client might send back — only nftId), then asks Xaman to create a real
// sign request for it.
export async function onRequestPost(context) {
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
  const seller = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const nftId = body && body.nftId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'invalid_nft_id' }), { status: 400 });
  }

  const offers = await fetchNftSellOffers(nftId);
  const ownOffer = findPigeonsOffer(offers, seller);
  if (!ownOffer) {
    return new Response(JSON.stringify({ error: 'not_listed_by_you' }), { status: 403 });
  }

  const txjson = {
    TransactionType: 'NFTokenCancelOffer',
    Account: seller,
    NFTokenOffers: [ownOffer.nft_offer_index]
  };

  const xummData = await createXamanPayload(XAMAN_API_KEY, env.XAMAN_API_SECRET, txjson);
  if (!xummData || !xummData.uuid || !xummData.next) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  console.log('SWAP delist payload created', xummData.uuid, 'for', seller, nftId, 'at', new Date().toISOString());

  return new Response(JSON.stringify({ ok: true, uuid: xummData.uuid, next: xummData.next }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
