import {
  fetchDeeptideListings, fetchDeeptideNftDetail, fetchDeeptideNftHistory, getTraitCategoriesWithPercent,
  fetchDeeptideSalesHistory, fetchXrpCafeCollectionStats, fetchXrpCafeNftListing, getPigeonNumberMap, getPigeonNumberMapStats, maybeRefreshPigeonNumberMap,
  getHighSaleMap, maybeRefreshHighSaleMap,
  resolveOwnerCollectionLive, fetchAllAccountNfts, findAllPigeons,
  proxyIpfsImage, PIGEON_COLLECTION_SIZE_APPROX, PIGEON_LOW_EDITION_MAX,
  getCachedCrownHolder, recomputeCrownHolder, CROWN_SNAPSHOT_MAX_AGE_SECONDS
} from '../_shared.js';

// Deeptide's own item page — the real place to buy a listed Pigeon.
function deeptideBuyUrl(nftId) {
  return `https://deeptide.co/nft/${nftId}`;
}

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

function bithompTxUrl(txHash) {
  return `https://bithomp.com/explorer/${txHash}`;
}

function toItem(nftId, meta, ownerOverride, highSaleMap) {
  const owner = ownerOverride !== undefined ? ownerOverride : meta.owner;
  const priceDrops = typeof meta.priceDrops === 'number' ? meta.priceDrops : null;
  const highSaleEntry = highSaleMap ? highSaleMap[nftId] : undefined;
  return {
    nftId,
    number: meta.number,
    image: displayImage(meta.image),
    attributes: meta.attributes,
    rarityRank: meta.rarityRank || null,
    rarityTotal: meta.rarityTotal || null,
    owner: owner || null,
    ownerShort: owner ? shortenAddr(owner) : null,
    ownerIndexed: !!owner,
    priceXrp: priceDrops !== null ? priceDrops / 1000000 : null,
    buyUrl: priceDrops !== null ? deeptideBuyUrl(nftId) : null,
    highSaleXrp: highSaleEntry ? highSaleEntry.drops / 1000000 : null,
    highSaleTxUrl: highSaleEntry && highSaleEntry.txHash ? bithompTxUrl(highSaleEntry.txHash) : null
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

  // Highest-ever sale price per token — one cheap KV read, reused for
  // every item below (cards' "HIGH SALE" line and the highest-sale sort).
  const highSaleMap = await getHighSaleMap(env.coin);

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

  // Collection-wide stats strip — items/holders (real, our own Clio-based
  // full scan, same snapshot as topHolders/Crown) plus floor price from
  // BOTH marketplaces (each has its own separate liquidity, so a real
  // floor differs by platform) and volume/listed% from xrp.cafe, whose
  // public collection-stats API is the only one of the two that tracks
  // those particular figures.
  if (params.get('stats') === '1') {
    const [deeptideFloorPage, xrpCafeStats, crownSnapshot] = await Promise.all([
      fetchDeeptideListings({ skip: 0, limit: 1, sort: 'price-asc' }),
      fetchXrpCafeCollectionStats(env.coin),
      getCachedCrownHolder(env.coin)
    ]);
    const deeptideFloorDrops = deeptideFloorPage.items[0] && typeof deeptideFloorPage.items[0].priceDrops === 'number'
      ? deeptideFloorPage.items[0].priceDrops : null;
    return json({
      items: PIGEON_COLLECTION_SIZE_APPROX,
      holders: crownSnapshot ? crownSnapshot.holderCount : null,
      deeptideFloorXrp: deeptideFloorDrops !== null ? deeptideFloorDrops / 1000000 : null,
      deeptideBuyUrl: deeptideFloorPage.items[0] ? deeptideBuyUrl(deeptideFloorPage.items[0].nftId) : null,
      xrpCafeFloorXrp: xrpCafeStats && xrpCafeStats.floorDrops !== null ? xrpCafeStats.floorDrops / 1000000 : null,
      xrpCafeUrl: 'https://xrp.cafe/collection/xrpigeons',
      totalVolumeXrp: xrpCafeStats && xrpCafeStats.totalVolumeDrops !== null ? xrpCafeStats.totalVolumeDrops / 1000000 : null,
      listedPercent: xrpCafeStats ? xrpCafeStats.percentListed : null
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
      .map(r => toItem(r.nftId, r.meta, wallet, highSaleMap))
      .sort((a, b) => (a.number || 0) - (b.number || 0));
    return json({ items, owner: wallet, ownerShort: shortenAddr(wallet) });
  }

  // Full real per-token event history (mint/transfer/sale) — used by the
  // INSPECT screen's "PIGEON HISTORY" section.
  const historyId = params.get('history');
  if (historyId) {
    const events = await fetchDeeptideNftHistory(historyId);
    return json({
      events: events.map(e => ({
        type: e.type,
        priceXrp: e.priceDrops !== null ? e.priceDrops / 1000000 : null,
        account: e.account,
        accountShort: shortenAddr(e.account),
        receiver: e.receiver,
        receiverShort: shortenAddr(e.receiver),
        buyer: e.buyer,
        buyerShort: shortenAddr(e.buyer),
        date: e.date,
        txUrl: e.txHash ? bithompTxUrl(e.txHash) : null
      }))
    });
  }

  // Fresh single-token detail — real current owner, exact trait
  // percentages, rarity. Used by INSPECT and to resolve a number search.
  const detailId = params.get('detail');
  if (detailId) {
    const [item, categories, xrpCafeListing] = await Promise.all([
      fetchDeeptideNftDetail(detailId),
      getTraitCategoriesWithPercent(env.coin),
      fetchXrpCafeNftListing(detailId)
    ]);
    if (!item) return json({ item: null, notIndexed: true });
    // Deeptide's own detail response has each trait's percentage but not its
    // raw count — cross-reference the (cached) collection-wide trait-card
    // counts so INSPECT can show both "12.4%" and "374 PIGEONS".
    item.attributes = item.attributes.map(a => {
      const match = (categories[a.trait_type] || []).find(v => v.value === a.value);
      return { trait_type: a.trait_type, value: a.value, percent: match ? match.percent : (a.percent != null ? a.percent : null), count: match ? match.count : null };
    });
    const result = toItem(item.nftId, item, undefined, highSaleMap);
    // Per-marketplace listings — each platform has its own separate sell
    // offers, so a Pigeon can be listed on one, both, or neither.
    result.listings = {
      deeptide: { priceXrp: result.priceXrp, buyUrl: result.buyUrl },
      xrpCafe: {
        priceXrp: xrpCafeListing ? xrpCafeListing.priceXrp : null,
        buyUrl: xrpCafeListing && xrpCafeListing.priceXrp !== null ? `https://xrp.cafe/nft/${detailId}` : null
      }
    };
    return json({ item: result });
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
    return json({ items: [toItem(item.nftId, item, undefined, highSaleMap)] });
  }

  // Sort by highest-ever sale price — exact (not scanned/approximate),
  // since the highSaleMap is already the complete authoritative index once
  // built. One detail fetch per item on the requested page only (up to the
  // page limit), same cost shape as the edition scan above.
  if (params.get('highestSale') === '1') {
    const limit = Math.min(60, Math.max(1, parseInt(params.get('limit') || '36', 10) || 36));
    const skip = Math.max(0, parseInt(params.get('skip') || '0', 10) || 0);
    const sortedIds = Object.keys(highSaleMap).sort((a, b) => highSaleMap[b].drops - highSaleMap[a].drops);
    const pageIds = sortedIds.slice(skip, skip + limit);
    const resolved = await Promise.all(pageIds.map(id => fetchDeeptideNftDetail(id)));
    const items = resolved.filter(Boolean).map(it => toItem(it.nftId, it, undefined, highSaleMap));
    return json({
      items,
      total: sortedIds.length,
      hasMore: skip + pageIds.length < sortedIds.length,
      skip,
      limit,
      collectionSizeApprox: PIGEON_COLLECTION_SIZE_APPROX
    });
  }

  // Edition sort — "1-1515" / "1516-3015", ordered rarest-first WITHIN that
  // range. Deeptide's API can't filter by number range directly, but it can
  // already sort the whole collection by rarity — so this scans forward
  // through that rarity-sorted feed (already-rarest-first) and keeps only
  // the items whose number falls in the requested range, stopping as soon
  // as it's collected a page's worth. No per-item detail fetch needed
  // (listings already carry number/rarity/image/traits); `rawSkip` is the
  // position in the underlying rarity-sorted feed to resume the scan from,
  // so nothing scanned-but-unused this request gets skipped or repeated
  // next request. Capped at 10 raw pages (~600 items) per request, which in
  // practice is 1-2 pages since ~half the collection matches either range.
  const numberRange = params.get('numberRange');
  if (numberRange === 'low' || numberRange === 'high') {
    const limit = Math.min(60, Math.max(1, parseInt(params.get('limit') || '36', 10) || 36));
    const underlyingSort = SORT_MAP[params.get('sort')] || 'rarity-asc';
    let cursor = Math.max(0, parseInt(params.get('rawSkip') || '0', 10) || 0);
    const matched = [];
    let exhausted = false;
    let rawPagesScanned = 0;
    while (matched.length < limit && rawPagesScanned < 10) {
      const page = await fetchDeeptideListings({ skip: cursor, limit: 60, sort: underlyingSort });
      rawPagesScanned++;
      if (!page.items.length) { exhausted = true; break; }
      for (const it of page.items) {
        cursor++;
        const inRange = numberRange === 'low' ? (it.number !== null && it.number <= PIGEON_LOW_EDITION_MAX) : (it.number !== null && it.number > PIGEON_LOW_EDITION_MAX);
        if (inRange) {
          matched.push(it);
          if (matched.length >= limit) break;
        }
      }
      if (matched.length >= limit) break;
      if (!page.hasMore) { exhausted = true; break; }
    }
    const items = matched.map(it => toItem(it.nftId, it, undefined, highSaleMap));
    return json({
      items,
      total: numberRange === 'low' ? PIGEON_LOW_EDITION_MAX : (PIGEON_COLLECTION_SIZE_APPROX - PIGEON_LOW_EDITION_MAX),
      hasMore: !exhausted,
      rawSkip: cursor,
      skip: cursor,
      limit,
      collectionSizeApprox: PIGEON_COLLECTION_SIZE_APPROX
    });
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
  const items = page.items.map(it => toItem(it.nftId, it, undefined, highSaleMap));

  context.waitUntil(maybeRefreshPigeonNumberMap(env.coin));
  context.waitUntil(maybeRefreshHighSaleMap(env.coin));

  return json({
    items,
    total: page.total,
    hasMore: page.hasMore,
    skip,
    limit,
    collectionSizeApprox: PIGEON_COLLECTION_SIZE_APPROX
  });
}
