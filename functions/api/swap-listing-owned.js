import { fetchAllAccountNfts, findAllPigeons, fetchNftSellOffers, recordSwapListing, getSwapListingsMap, mapWithConcurrency } from '../_shared.js';

// Real on-ledger "which of my own Pigeons have an active sell offer I
// created" check — powers the LISTED badge in MY PIGEONS. Never a
// browser-stored flag, so a page refresh can't lose it (section 10).
//
// Two passes, deliberately different cost profiles:
// 1. Cheap — every entry already in the Σκύλλα listings index whose
//    seller is this wallet. One KV read, no XRPL calls, complete
//    regardless of how many Pigeons the wallet holds.
// 2. Bounded live discovery — for held Pigeons NOT already covered by
//    pass 1, check nft_sell_offers directly, capped the same way
//    pigeons.js's own per-card enrichment is (LISTINGS_ENRICH_CAP). This
//    is what catches a real listing that predates the index or was
//    missed by a transient failure — confirmed necessary: a wallet
//    holding 60+ Pigeons had its real listing silently skipped when this
//    was the only pass and capped at 40, since slice() doesn't guarantee
//    the listed one falls within the first 40.
const DISCOVERY_CAP = 40;

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet');
  if (!wallet) {
    return new Response(JSON.stringify({ error: 'missing_wallet' }), { status: 400 });
  }

  const listed = {};

  const listingsMap = env.coin ? await getSwapListingsMap(env.coin) : {};
  for (const nftId of Object.keys(listingsMap)) {
    if (listingsMap[nftId].seller === wallet) {
      listed[nftId] = { price: listingsMap[nftId].price, currency: listingsMap[nftId].currency, offerId: listingsMap[nftId].offerId };
    }
  }

  const nfts = await fetchAllAccountNfts(wallet);
  const undiscovered = findAllPigeons(nfts).filter(nft => !listed[nft.NFTokenID]).slice(0, DISCOVERY_CAP);

  // Small batches, not one Promise.all blast — see mapWithConcurrency.
  await mapWithConcurrency(undiscovered, 5, async (nft) => {
    const offers = await fetchNftSellOffers(nft.NFTokenID);
    const ownOffer = offers.find(o => o.owner === wallet);
    if (ownOffer && ownOffer.amount && typeof ownOffer.amount === 'object') {
      listed[nft.NFTokenID] = {
        price: ownOffer.amount.value,
        currency: ownOffer.amount.currency,
        offerId: ownOffer.nft_offer_index
      };
      // Self-heal the index from real, just-verified ledger data — never
      // invented, this is the exact live offer just read above.
      if (env.coin) {
        context.waitUntil(recordSwapListing(env.coin, nft.NFTokenID, {
          price: ownOffer.amount.value,
          currency: ownOffer.amount.currency,
          issuer: ownOffer.amount.issuer,
          offerId: ownOffer.nft_offer_index,
          seller: wallet,
          listedAt: Math.floor(Date.now() / 1000)
        }));
      }
    }
  });

  return new Response(JSON.stringify({ listed }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
