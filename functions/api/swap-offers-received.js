import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts, findAllPigeons,
  getSwapBuyOffersMap, addSwapBuyOffer, removeSwapBuyOffer, fetchNftBuyOffers,
  getOwnerPigeonsViaDeeptide, encodeCurrencyCode, PIGEONS_TOKEN_CONFIG
} from '../_shared.js';

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

// How many of the owner's OWN Pigeons (not already in our own tracked
// index) get blind-checked for live offers per request — bounded the same
// way LISTINGS_ENRICH_CAP_LOW is elsewhere, since this only ever fans out
// across Pigeons this one wallet owns, not the whole collection.
const OFFERS_RECEIVED_SCAN_CAP = 45;

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

  const [ownedNfts, buyOffersMap, deeptideItems] = await Promise.all([
    fetchAllAccountNfts(owner),
    getSwapBuyOffersMap(env.coin),
    getOwnerPigeonsViaDeeptide(env.coin, owner)
  ]);
  const deeptideById = new Map(deeptideItems.map(d => [d.nftId, d]));
  const ownedPigeonIds = findAllPigeons(ownedNfts).map(n => n.NFTokenID);
  const ownedPigeonIdSet = new Set(ownedPigeonIds);
  const trackedIds = Object.keys(buyOffersMap).filter(id => ownedPigeonIdSet.has(id));
  const untrackedIds = ownedPigeonIds.filter(id => !trackedIds.includes(id)).slice(0, OFFERS_RECEIVED_SCAN_CAP);
  const candidateIds = trackedIds.concat(untrackedIds);

  const currency = encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency);
  const results = await Promise.all(candidateIds.map(async nftId => {
    const liveOffers = await fetchNftBuyOffers(nftId);
    const item = deeptideById.get(nftId) || null;
    const stored = buyOffersMap[nftId] || [];
    const storedByOfferId = {};
    stored.forEach(s => { storedByOfferId[s.offerId] = s; });
    const live = liveOffers.filter(o =>
      o.amount && typeof o.amount === 'object' &&
      o.amount.currency === currency &&
      o.amount.issuer === PIGEONS_TOKEN_CONFIG.issuer
    );
    // Prune any stored entry no longer actually on-ledger — never blocks
    // the response, just best-effort cleanup.
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
  }));

  return new Response(JSON.stringify({ items: results.filter(Boolean) }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
