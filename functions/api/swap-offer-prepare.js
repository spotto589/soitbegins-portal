import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts,
  PIGEON_ISSUER, PIGEON_TAXON, isTransferable
} from '../_shared.js';

const XRPL_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

// Σκύλλα SWAP — first real NFT-for-NFT settlement test, 1-for-1 only.
// XRPL has no native NFT-for-NFT offer (Amount is always XRP/an issued
// currency, never another NFTokenID), so this builds a real but
// NON-ATOMIC half of the trade: a free (Amount "0") NFTokenCreateOffer
// for the caller's own Pigeon, restricted via Destination so only the
// chosen counterparty wallet can ever accept it. The other wallet still
// has to separately create and the two sides still have to separately
// accept each other's offers — nothing here moves anything yet, it only
// builds and returns the exact txjson for the confirmation screen.
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
    Flags: 1
  };

  return new Response(JSON.stringify({ ok: true, txjson }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
