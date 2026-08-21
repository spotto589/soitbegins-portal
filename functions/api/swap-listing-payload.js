import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts,
  PIGEON_ISSUER, PIGEON_TAXON, isTransferable,
  PIGEONS_TOKEN_CONFIG, encodeCurrencyCode
} from '../_shared.js';

// Same public OAuth-login key every other page on the site already hardcodes
// (board.js, scylla.js, kingdom.js, mainframe.js, glitch.js) — it's the
// client-facing half of the Xaman app, safe to be public. The Payload API
// call below additionally needs the API *secret*, which is never put in
// source — it only ever comes from env.XAMAN_API_SECRET (a Cloudflare
// secret, configured the same way env.Σκύλλα already is).
const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

// Σκύλλα SWAP — first real listing test. Re-derives and re-validates the
// exact same txjson swap-listing-prepare.js already showed on the
// confirmation screen (never trusts a txjson the client might send back —
// only nftId + priceValue), then asks Xaman to create a real sign request
// for it. The server never signs, never holds a seed/key, and never
// touches the NFT or the $PIGEONS — Xaman only ever asks the user's own
// wallet to approve.
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
  const priceValue = body && body.priceValue;
  const priceNum = typeof priceValue === 'string' ? Number(priceValue) : priceValue;
  if (typeof priceNum !== 'number' || !isFinite(priceNum) || priceNum <= 0) {
    return new Response(JSON.stringify({ error: 'invalid_price' }), { status: 400 });
  }
  const priceStr = String(priceNum);
  if (priceStr.replace(/[-.]/g, '').length > 15) {
    return new Response(JSON.stringify({ error: 'invalid_price' }), { status: 400 });
  }

  if (!PIGEONS_TOKEN_CONFIG.configured) {
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 501 });
  }

  const nfts = await fetchAllAccountNfts(seller);
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
    Account: seller,
    NFTokenID: nftId,
    Amount: {
      currency: encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency),
      issuer: PIGEONS_TOKEN_CONFIG.issuer,
      value: priceStr
    },
    Flags: 1
  };

  const xummRes = await fetch('https://xumm.app/api/v1/platform/payload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': XAMAN_API_KEY,
      'X-API-Secret': env.XAMAN_API_SECRET
    },
    body: JSON.stringify({
      txjson,
      options: { submit: true, expire: 5 }
    })
  });

  if (!xummRes.ok) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }
  const xummData = await xummRes.json();
  const uuid = xummData && xummData.uuid;
  const next = xummData && xummData.next;
  if (!uuid || !next) {
    return new Response(JSON.stringify({ error: 'xaman_bad_response' }), { status: 502 });
  }

  console.log('SWAP listing payload created', uuid, 'for', seller, nftId, priceStr, 'at', new Date().toISOString());

  return new Response(JSON.stringify({ ok: true, uuid, next, qr: xummData.refs && xummData.refs.qr_png }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
