import { fetchAllAccountNfts, findAllPigeons, fetchNftSellOffers, recordSwapListingsBatch, getSwapListingsMap, mapWithConcurrency, findPigeonsOffer, safeKvPut } from '../_shared.js';

// Caches the RESULT of the live-discovery pass (pass 2 below) per wallet —
// confirmed live: for a wallet with anywhere near DISCOVERY_CAP Pigeons not
// already covered by the KV listings index, this pass alone (up to 45 live
// nft_sell_offers checks) was taking 13+ seconds, EVERY single time MY
// PIGEONS opened, even when nothing had changed since the last look. A
// short TTL, same convention as the Deeptide owner cache (180s) — pass 1
// (the real Σκύλλα listings index) is always read fresh regardless, so a
// genuine new listing or a CANCEL still shows up immediately; only the
// "did this wallet secretly list something outside Σκύλλα that our own
// index doesn't know about yet" catch-all scan is what gets skipped on a
// warm cache. The direct `nftId=` check (e.g. right after LIST!NG one)
// also always bypasses this cache entirely — see its own comment below.
const DISCOVERY_CACHE_PREFIX = 'pswap:listingdiscovery:';
const DISCOVERY_CACHE_TTL_SECONDS = 180;

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
// nftId check below. Does NOT write to KV itself any more — see
// recordSwapListingsBatch's own comment for why per-call writes here were
// silently losing entries under concurrency. Just returns what it found;
// the caller collects everything and writes it in one batched call once
// every check (direct + the concurrent discovery scan) has settled.
async function verifyAndRecord(env, nftId, wallet, listed, toRecord) {
  const offers = await fetchNftSellOffers(nftId);
  // Specifically the Σκύλλα $PIGEONS offer — a wallet's held Pigeon can
  // also carry an unrelated (e.g. XRP/Deeptide) offer from the same
  // owner at the same time.
  const ownOffer = findPigeonsOffer(offers, wallet);
  if (ownOffer) {
    listed[nftId] = {
      price: ownOffer.amount.value,
      currency: ownOffer.amount.currency,
      offerId: ownOffer.nft_offer_index,
      expiration: ownOffer.expiration || null
    };
    toRecord[nftId] = {
      price: ownOffer.amount.value,
      currency: ownOffer.amount.currency,
      issuer: ownOffer.amount.issuer,
      offerId: ownOffer.nft_offer_index,
      expiration: ownOffer.expiration || null,
      seller: wallet,
      listedAt: Math.floor(Date.now() / 1000)
    };
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
  // Collected across every verifyAndRecord call below (the direct nftId
  // check AND the concurrent discovery scan), then written to KV exactly
  // once at the end — see recordSwapListingsBatch's own comment for why
  // that matters here specifically.
  const toRecord = {};

  const listingsMap = env.coin ? await getSwapListingsMap(env.coin) : {};
  for (const nftId of Object.keys(listingsMap)) {
    if (listingsMap[nftId].seller === wallet) {
      listed[nftId] = { price: listingsMap[nftId].price, currency: listingsMap[nftId].currency, offerId: listingsMap[nftId].offerId, expiration: listingsMap[nftId].expiration || null };
    }
  }

  // A specific, already-known NFT (e.g. the one just listed, or the one
  // MY PIGEONS is currently rendering a card for) — verified directly,
  // bypassing the wallet-wide scan and its cap entirely. Reliable
  // regardless of how many other Pigeons the wallet holds.
  const directNftId = url.searchParams.get('nftId');
  if (directNftId && /^[0-9A-Fa-f]{64}$/.test(directNftId) && !listed[directNftId]) {
    await verifyAndRecord(env, directNftId, wallet, listed, toRecord);
  }

  const nfts = await fetchAllAccountNfts(wallet);
  const allOwnedPigeons = findAllPigeons(nfts);

  // Once a Pigeon has been live-checked (found listed or not) within the
  // TTL window, skip re-checking it — a FOUND one is already covered by
  // pass 1 from here on anyway (verifyAndRecord's own toRecord gets
  // written into the same index getSwapListingsMap reads), so this cache
  // is really only saving the repeated cost of re-confirming the NOT-
  // listed ones, which is what was actually slow (up to 45 live XRPL
  // calls, every single MY PIGEONS open, to reconfirm the same negatives).
  const discoveryCacheKey = DISCOVERY_CACHE_PREFIX + wallet;
  let recentlyChecked = new Set();
  if (env.coin) {
    const cached = await env.coin.get(discoveryCacheKey);
    if (cached) {
      try { recentlyChecked = new Set(JSON.parse(cached)); } catch (e) {}
    }
  }
  const undiscovered = allOwnedPigeons
    .filter(nft => !listed[nft.NFTokenID] && !recentlyChecked.has(nft.NFTokenID))
    .slice(0, DISCOVERY_CAP);

  // Small batches, not one Promise.all blast — see mapWithConcurrency.
  await mapWithConcurrency(undiscovered, 5, (nft) => verifyAndRecord(env, nft.NFTokenID, wallet, listed, toRecord));

  if (env.coin) context.waitUntil(recordSwapListingsBatch(env.coin, toRecord));
  if (env.coin && undiscovered.length) {
    undiscovered.forEach(nft => recentlyChecked.add(nft.NFTokenID));
    context.waitUntil(safeKvPut(env.coin, discoveryCacheKey, JSON.stringify(Array.from(recentlyChecked)), { expirationTtl: DISCOVERY_CACHE_TTL_SECONDS }));
  }

  return new Response(JSON.stringify({ listed }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
