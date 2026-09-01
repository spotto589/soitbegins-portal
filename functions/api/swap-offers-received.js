import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNftsCached, findAllPigeons,
  getSwapBuyOffersMap, addSwapBuyOffer, removeSwapBuyOffer, fetchNftBuyOffersOrNull,
  getOwnerPigeonsViaDeeptide, getSwapListingsMap, encodeCurrencyCode, PIGEONS_TOKEN_CONFIG,
  mapWithConcurrency
} from '../_shared.js';

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

// How many of the owner's OWN Pigeons (not already in our own tracked
// index) get blind-checked for live offers per request — bounded the same
// way LISTINGS_ENRICH_CAP_LOW is elsewhere, since this only ever fans out
// across Pigeons this one wallet owns, not the whole collection.
const OFFERS_RECEIVED_SCAN_CAP = 45;

// Same concurrency swap-listing-owned.js's own live-discovery pass already
// uses — a plain Promise.all over up to 45 candidates used to fire that
// many concurrent xrplcluster.com calls at once, which is exactly the
// "up to 60 concurrent calls... triggers its rate limit" scenario already
// documented elsewhere in this app (pigeons.js's own scyllaListed comment).
// Confirmed live: this was making a real, live, confirmed-on-ledger offer
// never show up here at all — not intermittently, every time — because a
// rate-limited nft_buy_offers call for that one NFT silently came back
// empty (see fetchNftBuyOffersOrNull's own null-vs-empty distinction below).
const OFFERS_RECEIVED_CONCURRENCY = 5;

// MY PIGEONS' incoming-offers view — every real $PIGEONS buy-offer sitting
// on a Pigeon the signed-in wallet currently owns. Self-healing like the
// listings map: the stored record only says "worth checking," the live
// nft_buy_offers lookup is what's actually shown — an offer that was
// withdrawn or already accepted elsewhere silently drops out here and gets
// pruned from our own map, instead of showing a dead ACCEPT button.
//
// The tracked index (getSwapBuyOffersMap) only ever gets an entry once the
// BUYER's own MAKE AN OFFER confirm screen polls all the way through to
// "offered" (swap-makeoffer-status.js) — if that tab closed early, or the
// poll never completed for any reason, a real, live, on-ledger offer could
// otherwise stay permanently invisible to the seller here even though it
// genuinely exists. So alongside the tracked ids, this also blind-checks
// every OTHER Pigeon this wallet owns (bounded by OFFERS_RECEIVED_SCAN_CAP)
// and backfills the index for anything real it finds that wasn't tracked
// yet, instead of only ever trusting the buyer's own polling to register it.
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
  const owner = payload.acct;

  const [ownedNfts, buyOffersMap, deeptideItems, listingsMap] = await Promise.all([
    fetchAllAccountNftsCached(env.coin, owner),
    getSwapBuyOffersMap(env.coin),
    getOwnerPigeonsViaDeeptide(env.coin, owner),
    getSwapListingsMap(env.coin)
  ]);
  const deeptideById = new Map(deeptideItems.map(d => [d.nftId, d]));
  const ownedPigeonIds = findAllPigeons(ownedNfts).map(n => n.NFTokenID);
  const ownedPigeonIdSet = new Set(ownedPigeonIds);
  const trackedIds = Object.keys(buyOffersMap).filter(id => ownedPigeonIdSet.has(id));
  // This wallet's own currently-listed Pigeons — always scanned regardless
  // of OFFERS_RECEIVED_SCAN_CAP, not just whichever happen to fall in the
  // first `cap` owned NFTs by raw ledger order. A listing is exactly the
  // kind of Pigeon likely to have a real buy offer sitting on it, and a
  // large-holder wallet (hundreds of NFTs) could otherwise have its own
  // listed Pigeon's real offer silently never discovered, since it never
  // got a chance to be scanned into the tracked index in the first place.
  const ownListedIds = Object.keys(listingsMap).filter(id => listingsMap[id].seller === owner && ownedPigeonIdSet.has(id) && !trackedIds.includes(id));
  const remainingCap = Math.max(0, OFFERS_RECEIVED_SCAN_CAP - ownListedIds.length);
  const untrackedIds = ownedPigeonIds.filter(id => !trackedIds.includes(id) && !ownListedIds.includes(id)).slice(0, remainingCap);
  const candidateIds = trackedIds.concat(ownListedIds, untrackedIds);

  const currency = encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency);
  const results = await mapWithConcurrency(candidateIds, OFFERS_RECEIVED_CONCURRENCY, async nftId => {
    const liveOffers = await fetchNftBuyOffersOrNull(nftId);
    const item = deeptideById.get(nftId) || null;
    const stored = buyOffersMap[nftId] || [];
    const storedByOfferId = {};
    stored.forEach(s => { storedByOfferId[s.offerId] = s; });

    // null means the live check itself failed (rate-limited/network) —
    // must NOT be treated as "confirmed no offers," or a transient blip
    // both hides a real offer AND deletes it from our own tracked index
    // below (see this function's own comment on why that was happening).
    // Fall back to whatever was already tracked instead of reporting
    // nothing for this Pigeon this pass.
    if (liveOffers === null) {
      if (!stored.length) return null;
      return {
        nftId,
        number: item ? item.number : null,
        image: item ? item.image : null,
        offers: stored.map(s => ({
          offerId: s.offerId,
          buyer: s.buyer,
          buyerShort: shortenAddr(s.buyer),
          price: s.price,
          createdAt: s.createdAt || null
        }))
      };
    }

    const live = liveOffers.filter(o =>
      o.amount && typeof o.amount === 'object' &&
      o.amount.currency === currency &&
      o.amount.issuer === PIGEONS_TOKEN_CONFIG.issuer
    );
    // Prune any stored entry no longer actually on-ledger — never blocks
    // the response, just best-effort cleanup. Safe here specifically
    // because liveOffers is a confirmed real result, not a failed lookup.
    const liveIds = new Set(live.map(o => o.nft_offer_index));
    const stale = stored.filter(s => !liveIds.has(s.offerId));
    stale.forEach(s => context.waitUntil(removeSwapBuyOffer(env.coin, nftId, s.offerId)));
    // Backfill anything real that isn't in our own index yet (see the
    // untrackedIds scan above — this is what actually registers it).
    live.forEach(o => {
      if (!stored.some(s => s.offerId === o.nft_offer_index)) {
        context.waitUntil(addSwapBuyOffer(env.coin, nftId, {
          offerId: o.nft_offer_index,
          buyer: o.owner,
          price: o.amount.value,
          createdAt: Math.floor(Date.now() / 1000)
        }));
      }
    });

    if (!live.length) return null;
    return {
      nftId,
      number: item ? item.number : null,
      image: item ? item.image : null,
      offers: live.map(o => ({
        offerId: o.nft_offer_index,
        buyer: o.owner,
        buyerShort: shortenAddr(o.owner),
        price: o.amount.value,
        // Best-effort recency for "most recent first" sorting — the first
        // time we ever noticed this offer, not its true on-ledger creation
        // time (nft_buy_offers doesn't expose that). Missing for an entry
        // that predates this field; sorts as oldest.
        createdAt: (storedByOfferId[o.nft_offer_index] && storedByOfferId[o.nft_offer_index].createdAt) || null
      }))
    };
  });

  return new Response(JSON.stringify({ items: results.filter(Boolean) }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
