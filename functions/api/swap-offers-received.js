import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts, findAllPigeons,
  getSwapBuyOffersMap, removeSwapBuyOffer, fetchNftBuyOffers, fetchDeeptideNftDetail,
  encodeCurrencyCode, PIGEONS_TOKEN_CONFIG
} from '../_shared.js';

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

// MY PIGEONS' incoming-offers view — every real $PIGEONS buy-offer sitting
// on a Pigeon the signed-in wallet currently owns. Self-healing like the
// listings map: the stored record only says "worth checking," the live
// nft_buy_offers lookup is what's actually shown — an offer that was
// withdrawn or already accepted elsewhere silently drops out here and gets
// pruned from our own map, instead of showing a dead ACCEPT button.
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

  const [ownedNfts, buyOffersMap] = await Promise.all([
    fetchAllAccountNfts(owner),
    getSwapBuyOffersMap(env.coin)
  ]);
  const ownedPigeonIds = new Set(findAllPigeons(ownedNfts).map(n => n.NFTokenID));
  const candidateIds = Object.keys(buyOffersMap).filter(id => ownedPigeonIds.has(id));

  const currency = encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency);
  const results = await Promise.all(candidateIds.map(async nftId => {
    const [liveOffers, item] = await Promise.all([
      fetchNftBuyOffers(nftId),
      fetchDeeptideNftDetail(nftId)
    ]);
    const stored = buyOffersMap[nftId] || [];
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

    if (!live.length) return null;
    return {
      nftId,
      number: item ? item.number : null,
      image: item ? item.image : null,
      offers: live.map(o => ({
        offerId: o.nft_offer_index,
        buyer: o.owner,
        buyerShort: shortenAddr(o.owner),
        price: o.amount.value
      }))
    };
  }));

  return new Response(JSON.stringify({ items: results.filter(Boolean) }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
