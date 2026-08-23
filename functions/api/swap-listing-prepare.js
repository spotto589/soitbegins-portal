import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts,
  PIGEON_ISSUER, PIGEON_TAXON, isTransferable,
  PIGEONS_TOKEN_CONFIG, encodeCurrencyCode, swapOfferSourceMemo
} from '../_shared.js';

// Σκύλλα SWAP — first real listing test. This endpoint only builds and
// returns the exact NFTokenCreateOffer txjson for the confirmation screen;
// it never talks to Xaman and never touches the NFT or any funds. The
// browser is never trusted for the seller address, the NFT's ownership, or
// the currency/issuer — all of that is re-derived here from the session and
// server-side ledger data.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
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
  // XRPL issued-currency values are strings; up to 15 significant digits.
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
    Flags: 1,
    Memos: swapOfferSourceMemo()
  };

  return new Response(JSON.stringify({ ok: true, txjson }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
