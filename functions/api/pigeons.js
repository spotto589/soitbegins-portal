import {
  fetchDeeptideListings, fetchDeeptideNftDetail, getTraitCategoriesWithPercent,
  fetchDeeptideSalesHistory, getPigeonNumberMap, getPigeonNumberMapStats, maybeRefreshPigeonNumberMap,
  resolveOwnerCollectionLive, fetchAllAccountNfts, findAllPigeons,
  proxyIpfsImage, PIGEON_COLLECTION_SIZE_APPROX,
  getCachedCrownHolder, recomputeCrownHolder, CROWN_SNAPSHOT_MAX_AGE_SECONDS
} from '../_shared.js';

// Client sort keys -> Deeptide's own sort values (same ones its own
// marketplace UI offers — rarity-asc is "Rarest First").
const SORT_MAP = {
  RARITY_ASC: 'rarity-asc',
  RARITY_DESC: 'rarity-desc',
  NAME_ASC: 'name-asc',
  NAME_DESC: 'name-desc',
  PRICE_ASC: 'price-asc',
  PRICE_DESC: 'price-desc',
};

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

// Deeptide's CDN images hotlink fine as-is; only ipfs.io URLs (the wallet-
// scope IPFS fallback) need the same-origin proxy (see ipfs-image.js).
function displayImage(url) {
  if (!url) return null;
  return url.startsWith('https://ipfs.io/') ? proxyIpfsImage(url) : url;
}

function toItem(nftId, meta, ownerOverride) {
  const owner = ownerOverride !== undefined ? ownerOverride : meta.owner;
  return {
    nftId,
    number: meta.number,
    image: displayImage(meta.image),
    attributes: meta.attributes,
    rarityRank: meta.rarityRank || null,
    rarityTotal: meta.rarityTotal || null,
    owner: owner || null,
    ownerShort: owner ? shortenAddr(owner) : null,
    ownerIndexed: !!owner
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.coin) return json({ error: 'server_misconfigured' }, 500);

  const url = new URL(request.url);
  const params = url.searchParams;

  // Trait category/value/percentage discovery for the TRAITS stack filter
  // UI — real, exact counts straight from Deeptide, not sampled.
  if (params.get('traits') === '1') {
    const categories = await getTraitCategoriesWithPercent(env.coin);
    const numberMapStats = await getPigeonNumberMapStats(env.coin);
    context.waitUntil(maybeRefreshPigeonNumberMap(env.coin));
    return json({
      categories,
      collectionSizeApprox: PIGEON_COLLECTION_SIZE_APPROX,
      numberMapStats
    });
  }

  // Top 10 current Pigeon holders, network-wide — piggybacks on the same
  // cached full-scan snapshot the Crown feature already maintains (board.js),
  // so this is a cheap KV read on every normal request; a stale/missing
  // snapshot kicks off a background recompute via waitUntil, same pattern.
  if (params.get('topHolders') === '1') {
    const snapshot = await getCachedCrownHolder(env.coin);
    const stale = !snapshot || (Math.floor(Date.now() / 1000) - snapshot.computedAt) > CROWN_SNAPSHOT_MAX_AGE_SECONDS;
    if (stale) context.waitUntil(recomputeCrownHolder(env.coin).catch(() => {}));
    const holders = (snapshot && snapshot.topHolders) || [];
    return json({
      holders: holders.map(h => ({ wallet: h.wallet, ownerShort: shortenAddr(h.wallet), count: h.count })),
      computedAt: snapshot ? snapshot.computedAt : null
    });
  }

  // Real, collection-wide sales history straight from Deeptide's own
  // `/api/sales/recent` — no KV involved, same direct-passthrough pattern
  // as the main listings. Optionally scoped to one wallet (buyer or
  // seller) via `wallet`.
  if (params.get('sales') === '1') {
    const salesSkip = Math.max(0, parseInt(params.get('skip') || '0', 10) || 0);
    const salesLimit = Math.min(50, Math.max(1, parseInt(params.get('limit') || '20', 10) || 20));
    const salesWallet = params.get('wallet') || undefined;
    const page = await fetchDeeptideSalesHistory({ skip: salesSkip, limit: salesLimit, sort: 'date-desc', wallet: salesWallet });
    const items = page.items.map(it => ({
      txHash: it.txHash,
      nftId: it.nftId,
      number: it.number,
      image: displayImage(it.image),
      priceXrp: it.priceXrp,
      buyer: it.buyer,
      buyerShort: shortenAddr(it.buyer),
      seller: it.seller,
      sellerShort: shortenAddr(it.seller),
      createdAt: it.createdAt
    }));
    return json({ items, total: page.total, hasMore: page.hasMore, skip: salesSkip, limit: salesLimit });
  }

  // A wallet's full real holdings — used by the SELECT -> owner's
  // collection flow. No KV writes, cheap regardless of wallet size.
  const wallet = params.get('wallet');
  if (wallet) {
    const nfts = await fetchAllAccountNfts(wallet);
    const pigeons = findAllPigeons(nfts);
    if (!pigeons.length) return json({ items: [], owner: wallet, ownerShort: shortenAddr(wallet) });
    const ledgerItems = pigeons.map(n => ({ nftId: n.NFTokenID, uriHex: n.URI }));
    const resolved = await resolveOwnerCollectionLive(env.coin, wallet, ledgerItems);
    const items = resolved
      .map(r => toItem(r.nftId, r.meta, wallet))
      .sort((a, b) => (a.number || 0) - (b.number || 0));
    return json({ items, owner: wallet, ownerShort: shortenAddr(wallet) });
  }

  // Fresh single-token detail — real current owner, exact trait
  // percentages, rarity. Used by INSPECT and to resolve a number search.
  const detailId = params.get('detail');
  if (detailId) {
    const item = await fetchDeeptideNftDetail(detailId);
    if (!item) return json({ item: null, notIndexed: true });
    // Deeptide's own detail response has each trait's percentage but not its
    // raw count — cross-reference the (cached) collection-wide trait-card
    // counts so INSPECT can show both "12.4%" and "374 PIGEONS".
    const categories = await getTraitCategoriesWithPercent(env.coin);
    item.attributes = item.attributes.map(a => {
      const match = (categories[a.trait_type] || []).find(v => v.value === a.value);
      return { trait_type: a.trait_type, value: a.value, percent: match ? match.percent : (a.percent != null ? a.percent : null), count: match ? match.count : null };
    });
    return json({ item: toItem(item.nftId, item) });
  }

  // Direct Pigeon-number search via the number->NFTokenID map (built by
  // crawling Deeptide's cheap listings pages — see maybeRefreshPigeonNumberMap).
  const number = params.get('number');
  if (number) {
    const num = parseInt(number, 10);
    if (!num || num < 1) return json({ items: [], notIndexed: false, invalid: true });
    const map = await getPigeonNumberMap(env.coin);
    const nftId = map[num];
    if (!nftId) {
      context.waitUntil(maybeRefreshPigeonNumberMap(env.coin));
      return json({ items: [], notIndexed: true, query: num });
    }
    const item = await fetchDeeptideNftDetail(nftId);
    if (!item) return json({ items: [], notIndexed: true, query: num });
    return json({ items: [toItem(item.nftId, item)] });
  }

  // Default: the real, complete, live collection — paginated, sorted
  // (rarity by default), optionally AND-filtered by trait. No KV involved.
  const skip = Math.max(0, parseInt(params.get('skip') || '0', 10) || 0);
  const limit = Math.min(60, Math.max(1, parseInt(params.get('limit') || '36', 10) || 36));
  const sort = SORT_MAP[params.get('sort')] || 'rarity-asc';
  const filtersRaw = params.get('filters');
  let filters = [];
  if (filtersRaw) {
    try { filters = JSON.parse(filtersRaw); } catch (e) { filters = []; }
    if (!Array.isArray(filters)) filters = [];
  }

  const page = await fetchDeeptideListings({ skip, limit, sort, traits: filters });
  const items = page.items.map(it => toItem(it.nftId, it));

  context.waitUntil(maybeRefreshPigeonNumberMap(env.coin));

  return json({
    items,
    total: page.total,
    hasMore: page.hasMore,
    skip,
    limit,
    collectionSizeApprox: PIGEON_COLLECTION_SIZE_APPROX
  });
}
