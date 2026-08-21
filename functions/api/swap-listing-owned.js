import { fetchAllAccountNfts, findAllPigeons, fetchNftSellOffers } from '../_shared.js';

// Real on-ledger "which of my own Pigeons have an active sell offer I
// created" check — powers the LISTED badge in MY PIGEONS. Never a
// browser-stored flag, so a page refresh can't lose it (section 10).
// Capped the same way pigeons.js's own per-card listing enrichment is
// (LISTINGS_ENRICH_CAP) — a wallet's own holdings, not the full 3015-item
// collection, so this stays well inside the subrequest budget.
const ENRICH_CAP = 40;

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet');
  if (!wallet) {
    return new Response(JSON.stringify({ error: 'missing_wallet' }), { status: 400 });
  }

  const nfts = await fetchAllAccountNfts(wallet);
  const pigeons = findAllPigeons(nfts).slice(0, ENRICH_CAP);

  const listed = {};
  await Promise.all(pigeons.map(async (nft) => {
    const offers = await fetchNftSellOffers(nft.NFTokenID);
    const ownOffer = offers.find(o => o.owner === wallet);
    if (ownOffer && ownOffer.amount && typeof ownOffer.amount === 'object') {
      listed[nft.NFTokenID] = {
        price: ownOffer.amount.value,
        currency: ownOffer.amount.currency,
        offerId: ownOffer.nft_offer_index
      };
    }
  }));

  return new Response(JSON.stringify({ listed }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
