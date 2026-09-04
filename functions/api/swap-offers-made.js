import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, getSwapBuyOffersMap, fetchNftBuyOffersOrNull,
  removeSwapBuyOffer, findCollectionOffer, getTradeConfig, fetchDeeptideNftDetailCached, mapWithConcurrency
} from '../_shared.js';

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

// How many of the wallet's own tracked outgoing offers get live-verified
// per request — same bound as every other per-item live scan in this app
// (swap-offers-received.js/swap-listing-owned.js), for the same reason:
// this only ever fans out across offers THIS wallet made, not the whole
// collection.
const OUTGOING_OFFERS_SCAN_CAP = 45;
const OUTGOING_OFFERS_CONCURRENCY = 15;

// MY PIGEONS' own OUTGOING OFFERS — every real $PIGEONS buy-offer this
// wallet has made on someone ELSE's Pigeon, so it can be seen and
// cancelled from one place instead of only being discoverable by
// revisiting each Pigeon individually. Reported live as important to get
// right specifically so cancelling actually works.
//
// The tracked index (getSwapBuyOffersMap) already carries every offer this
// wallet has ever made, once swap-makeoffer-status.js confirms it on-ledger
// — this just filters that same shared map down to entries where THIS
// wallet is the buyer, then live-verifies each one exactly like
// swap-offers-received.js does for the seller's side: the stored record
// only says "worth checking," the live nft_buy_offers lookup is what's
// actually shown, and anything genuinely gone (accepted, cancelled,
// expired) gets pruned from the index instead of showing a dead CANCEL
// button.
export async function onRequestGet(context) {
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
  const buyer = payload.acct;
  const collection = new URL(request.url).searchParams.get('collection') || 'pigeons';
  if (!getTradeConfig(collection)) {
    return new Response(JSON.stringify({ error: 'invalid_collection' }), { status: 400 });
  }

  const buyOffersMap = await getSwapBuyOffersMap(env.coin, collection);
  const candidateIds = Object.keys(buyOffersMap)
    .filter(nftId => buyOffersMap[nftId].some(o => o.buyer === buyer))
    .slice(0, OUTGOING_OFFERS_SCAN_CAP);

  const results = await mapWithConcurrency(candidateIds, OUTGOING_OFFERS_CONCURRENCY, async nftId => {
    const storedEntry = buyOffersMap[nftId].find(o => o.buyer === buyer);
    const liveOffers = await fetchNftBuyOffersOrNull(nftId);

    // null means the live lookup itself failed (rate-limited/network) —
    // must NOT be treated as "confirmed gone," same reasoning as every
    // other self-healing index in this app. Fall back to the last-known
    // tracked record instead of hiding or pruning it.
    if (liveOffers === null) {
      if (!storedEntry) return null;
      const item = await fetchDeeptideNftDetailCached(context, nftId);
      return {
        nftId,
        offerId: storedEntry.offerId,
        price: storedEntry.price,
        createdAt: storedEntry.createdAt || null,
        number: item ? item.number : null,
        image: item ? item.image : null,
        ownerWallet: item ? item.owner : null,
        ownerShort: item && item.owner ? shortenAddr(item.owner) : null
      };
    }

    const myOffer = findCollectionOffer(liveOffers, collection, buyer);
    if (!myOffer) {
      // Genuinely gone (accepted, cancelled, or expired) — prune the
      // stale tracked record so it doesn't show up again next time.
      if (storedEntry) context.waitUntil(removeSwapBuyOffer(env.coin, nftId, storedEntry.offerId, collection));
      return null;
    }

    const item = await fetchDeeptideNftDetailCached(context, nftId);
    return {
      nftId,
      offerId: myOffer.nft_offer_index,
      price: myOffer.amount.value,
      expiration: myOffer.expiration || null,
      createdAt: (storedEntry && storedEntry.createdAt) || null,
      number: item ? item.number : null,
      image: item ? item.image : null,
      ownerWallet: item ? item.owner : null,
      ownerShort: item && item.owner ? shortenAddr(item.owner) : null
    };
  });

  return new Response(JSON.stringify({ items: results.filter(Boolean) }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
