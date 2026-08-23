import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts,
  PIGEON_ISSUER, PIGEON_TAXON, isTransferable, createXamanPayload, swapOfferSourceMemo
} from '../_shared.js';

const XRPL_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

// Re-derives and re-validates the exact same txjson swap-offer-prepare.js
// already showed on the confirmation screen (never trusts a txjson the
// client might send back — only nftId + toWallet), then asks Xaman to
// create a real sign request for it.
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
  const offerer = payload.acct;

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
  const toWallet = body && body.toWallet;
  if (!toWallet || typeof toWallet !== 'string' || !XRPL_ADDRESS_RE.test(toWallet)) {
    return new Response(JSON.stringify({ error: 'invalid_to_wallet' }), { status: 400 });
  }
  if (toWallet === offerer) {
    return new Response(JSON.stringify({ error: 'cannot_swap_with_self' }), { status: 400 });
  }

  const nfts = await fetchAllAccountNfts(offerer);
  const nft = nfts.find(n => n.NFTokenID === nftId);
  if (!nft) {
    return new Response(JSON.stringify({ error: 'not_owned' }), { status: 403 });
  }
  if (nft.Issuer !== PIGEON_ISSUER || nft.NFTokenTaxon !== PIGEON_TAXON) {
    return new Response(JSON.stringify({ error: 'not_a_pigeon' }), { status: 400 });
  }
  if (!isTransferable(nft)) {
    return new Response(JSON.stringify({ error: 'not_transferable' }), { status: 400 });
  }

  const txjson = {
    TransactionType: 'NFTokenCreateOffer',
    Account: offerer,
    NFTokenID: nftId,
    Amount: '0',
    Destination: toWallet,
    Flags: 1,
    Memos: swapOfferSourceMemo()
  };

  const xummData = await createXamanPayload(env, txjson);
  const uuid = xummData && xummData.uuid;
  const next = xummData && xummData.next;
  if (!uuid || !next) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  console.log('SWAP offer payload created', uuid, 'for', offerer, nftId, '->', toWallet, 'at', new Date().toISOString());

  return new Response(JSON.stringify({ ok: true, uuid, next, qr: xummData.refs && xummData.refs.qr_png }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
