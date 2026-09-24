import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffersOrNull, createXamanPayload, getXamanUserToken, findCollectionOffer, findCollectionOffers, getTradeConfig, removeSwapListing,
  normalizeOfferCurrency, removeSwapXrpListing
} from '../_shared.js';

// Called straight from the CANCEL click now — no separate confirm step
// (see openDelistConfirm in static.js) — so this is the first and only
// server round-trip: never trusts anything from the client but nftId,
// fully re-derives ownership and the real offer to cancel from a fresh
// nft_sell_offers lookup before asking Xaman to create a real sign
// request.
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
  const seller = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const collection = (body && body.collection) || 'pigeons';
  if (!getTradeConfig(collection)) {
    return new Response(JSON.stringify({ error: 'invalid_collection' }), { status: 400 });
  }

  const nftId = body && body.nftId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'invalid_nft_id' }), { status: 400 });
  }

  const offersOrNull = await fetchNftSellOffersOrNull(nftId);
  // One currency if asked, otherwise every Σκύλλα listing (token + XRP).
  const which = body && body.currency ? normalizeOfferCurrency(body.currency) : 'any';
  const ownOffer = findCollectionOffer(offersOrNull || [], collection, seller, undefined, which);
  if (!ownOffer) {
    // A confirmed-empty result (never a failed lookup, which also comes
    // back as null here — see fetchNftSellOffersOrNull's own comment on why
    // that distinction matters) means there is no real sell offer left on
    // this NFT at all, by anyone, for any currency — not just "none from
    // this seller". The KV listing map Σκύλλα SWAP itself wrote is stale:
    // the real offer was cancelled or consumed through some route entirely
    // outside this site. The LISTED browse view already self-heals this
    // exact way for whatever page it happens to render (see
    // removeSwapListing's own comment) — do it here too, since a single
    // NFT's own detail page never re-verifies on its own and would
    // otherwise keep showing a ghost BUY NOW/CANCEL forever (confirmed
    // live on Pigeon #2630: real nft_sell_offers came back objectNotFound,
    // but the site kept showing it listed and CANCEL kept 403ing).
    if (offersOrNull !== null && offersOrNull.length === 0) {
      context.waitUntil(removeSwapListing(env.coin, nftId, collection));
      context.waitUntil(removeSwapXrpListing(env.coin, nftId, collection));
    }
    return new Response(JSON.stringify({ error: 'not_listed_by_you' }), { status: 403 });
  }

  // Cancel every one of the seller's own matching offers on this NFT, not
  // just ownOffer — a leftover duplicate (see findCollectionOffers' own
  // comment, and LIST's new already-listed guard in swap-listing-
  // prepare.js) would otherwise still pass the LISTED self-heal check
  // after this "successful" cancel, leaving the Pigeon stuck looking
  // listed forever. NFTokenCancelOffer accepts multiple offer indexes in
  // one transaction.
  const ownOffers = findCollectionOffers(offersOrNull || [], collection, seller, undefined, which);
  const txjson = {
    TransactionType: 'NFTokenCancelOffer',
    Account: seller,
    NFTokenOffers: ownOffers.map(o => o.nft_offer_index)
  };

  const pushToken = await getXamanUserToken(env.coin, seller);
  const xummData = await createXamanPayload(env, txjson, undefined, pushToken);
  if (!xummData || !xummData.uuid || !xummData.next) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  console.log('SWAP delist payload created', xummData.uuid, 'for', seller, nftId, 'at', new Date().toISOString());

  return new Response(JSON.stringify({ ok: true, uuid: xummData.uuid, next: xummData.next }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
