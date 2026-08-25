import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffersOrNull, fetchDeeptideNftDetail
} from '../_shared.js';

// Builds and previews the exact NFTokenAcceptOffer txjson for accepting an
// incoming TRANSFER — a real free (Amount "0") sell offer someone else
// created, restricted to this wallet via Destination. Same "re-verify
// fresh against the real offer, never trust the tracked index alone"
// posture as BUY's own prepare step (swap-buy-prepare.js): the incoming-
// transfers KV index only ever says "worth checking," this is what
// actually confirms the offer is still real, still targets THIS wallet
// specifically, and is genuinely the free/Amount-"0" kind (not some other
// currency's sell offer that happens to share an nftId).
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
  const recipient = payload.acct;

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

  const offers = await fetchNftSellOffersOrNull(nftId);
  if (offers === null) {
    return new Response(JSON.stringify({ error: 'lookup_failed' }), { status: 503 });
  }
  const offer = offers.find(o => o.nft_offer_index === offerId);
  if (!offer || offer.destination !== recipient || offer.amount !== '0') {
    return new Response(JSON.stringify({ error: 'offer_not_found' }), { status: 404 });
  }

  const item = await fetchDeeptideNftDetail(nftId);

  const txjson = {
    TransactionType: 'NFTokenAcceptOffer',
    Account: recipient,
    NFTokenSellOffer: offer.nft_offer_index
  };

  return new Response(JSON.stringify({
    ok: true,
    txjson,
    display: {
      nftId,
      number: item ? item.number : null,
      fromWallet: offer.owner
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
