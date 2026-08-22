import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts, fetchNftBuyOffers,
  createXamanPayload, recordPendingBuy
} from '../_shared.js';

// Re-derives and re-validates the exact same txjson swap-acceptoffer-
// prepare.js already showed (never trusts a txjson the client might send
// back — only nftId + offerId), then asks Xaman to create a real sign
// request for it. Stashes buyer/price now (reusing the same pendingbuy KV
// helper the BUY flow uses) — by settlement time the accepted offer is
// gone from the ledger and no longer derivable.
export async function onRequestPost(context) {
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
  const owner = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const nftId = body && body.nftId;
  const offerId = body && body.offerId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId) ||
      !offerId || typeof offerId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(offerId)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const nfts = await fetchAllAccountNfts(owner);
  if (!nfts.some(n => n.NFTokenID === nftId)) {
    return new Response(JSON.stringify({ error: 'not_owned' }), { status: 403 });
  }

  const offers = await fetchNftBuyOffers(nftId);
  const offer = offers.find(o => o.nft_offer_index === offerId);
  if (!offer) {
    return new Response(JSON.stringify({ error: 'offer_not_found' }), { status: 404 });
  }

  const txjson = {
    TransactionType: 'NFTokenAcceptOffer',
    Account: owner,
    NFTokenBuyOffer: offerId
  };

  const xummData = await createXamanPayload(env, txjson);
  if (!xummData || !xummData.uuid || !xummData.next) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  if (env.coin) {
    context.waitUntil(recordPendingBuy(env.coin, xummData.uuid, {
      nftId,
      seller: owner,
      buyer: offer.owner,
      priceValue: offer.amount.value
    }));
  }

  return new Response(JSON.stringify({ ok: true, uuid: xummData.uuid, next: xummData.next }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
