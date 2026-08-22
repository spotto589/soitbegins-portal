import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, getSwapOfferPairs, fetchNftSellOffers, findSwapOffer
} from '../_shared.js';

// Builds and returns the exact NFTokenAcceptOffer txjson for accepting the
// OTHER side's half of a swap pair — never the client's own idea of which
// offer that is. The pair record only points at which NFT to look up; the
// actual offer ID being accepted always comes from a fresh nft_sell_offers
// read, never the (possibly stale) offerId cached in the pair.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
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
  const acceptor = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }
  const swapId = body && body.swapId;
  if (!swapId || typeof swapId !== 'string' || !/^[0-9a-fA-F-]{10,60}$/.test(swapId)) {
    return new Response(JSON.stringify({ error: 'invalid_swap_id' }), { status: 400 });
  }

  const pairs = await getSwapOfferPairs(env.coin);
  const pair = pairs[swapId];
  if (!pair) {
    return new Response(JSON.stringify({ error: 'swap_not_found' }), { status: 404 });
  }
  const isOfferer = pair.offerer.wallet === acceptor;
  const isCounterparty = pair.counterparty.wallet === acceptor;
  if (!isOfferer && !isCounterparty) {
    return new Response(JSON.stringify({ error: 'not_a_party_to_swap' }), { status: 403 });
  }
  const otherSide = isOfferer ? pair.counterparty : pair.offerer;
  if (!otherSide.offerId) {
    return new Response(JSON.stringify({ error: 'other_side_not_ready' }), { status: 400 });
  }

  const offers = await fetchNftSellOffers(otherSide.nftId);
  const liveOffer = findSwapOffer(offers, otherSide.wallet, acceptor);
  if (!liveOffer) {
    return new Response(JSON.stringify({ error: 'offer_no_longer_active' }), { status: 409 });
  }

  const txjson = {
    TransactionType: 'NFTokenAcceptOffer',
    Account: acceptor,
    NFTokenSellOffer: liveOffer.nft_offer_index
  };

  return new Response(JSON.stringify({
    ok: true,
    txjson,
    display: { nftId: otherSide.nftId, fromWallet: otherSide.wallet }
  }), { headers: { 'Content-Type': 'application/json' } });
}
