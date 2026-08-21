import { fetchAllAccountNfts, findAllPigeons, fetchNftSellOffers, recordSwapListing, getSwapListingsMap, mapWithConcurrency, findPigeonsOffer } from '../_shared.js';

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
const DISCOVERY_CAP = 45;

// Server-side helper shared by both the wallet-wide scan and the direct
// nftId check below.
async function verifyAndRecord(env, nftId, wallet, listed) {
  const offers = await fetchNftSellOffers(nftId);
  // Specifically the Σκύλλα $PIGEONS offer — a wallet's held Pigeon can
  // also carry an unrelated (e.g. XRP/Deeptide) offer from the same
  // owner at the same time.
  const ownOffer = findPigeonsOffer(offers, wallet);
  if (ownOffer) {
    listed[nftId] = {
      price: ownOffer.amount.value,
      currency: ownOffer.amount.currency,
      offerId: ownOffer.nft_offer_index
    };
    if (env.coin) {
      await recordSwapListing(env.coin, nftId, {
        price: ownOffer.amount.value,
        currency: ownOffer.amount.currency,
        issuer: ownOffer.amount.issuer,
        offerId: ownOffer.nft_offer_index,
        seller: wallet,
        listedAt: Math.floor(Date.now() / 1000)
      });
    }
    return true;
  }
  return false;
}

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

  // A specific, already-known NFT (e.g. the one just listed, or the one
  // MY PIGEONS is currently rendering a card for) — verified directly,
  // bypassing the wallet-wide scan and its cap entirely. Reliable
  // regardless of how many other Pigeons the wallet holds.
  const directNftId = url.searchParams.get('nftId');
  if (directNftId && /^[0-9A-Fa-f]{64}$/.test(directNftId) && !listed[directNftId]) {
    await verifyAndRecord(env, directNftId, wallet, listed);
  }

  const nfts = await fetchAllAccountNfts(wallet);
  const undiscovered = findAllPigeons(nfts).filter(nft => !listed[nft.NFTokenID]).slice(0, DISCOVERY_CAP);

  // Small batches, not one Promise.all blast — see mapWithConcurrency.
  await mapWithConcurrency(undiscovered, 5, (nft) => verifyAndRecord(env, nft.NFTokenID, wallet, listed));

  return new Response(JSON.stringify({ listed }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
