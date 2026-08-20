import {
  fetchPigeonCollectionPage, fetchNftInfo, getPigeonFullMeta, getPigeonMetaCached,
  getPigeonNumberIndex, getIndexedTraitCategories, getIndexedTraitValues,
  filterPigeonsByTraits, resolvePigeonsForOwner, resolveOwnerCollectionLive,
  getPigeonIndexStats, maybeRecomputePigeonIndex,
  getTraitValuePercent, fetchAllAccountNfts, findAllPigeons,
  proxyIpfsImage, PIGEON_COLLECTION_SIZE_APPROX
} from '../_shared.js';

// Real per-request budget management: Cloudflare caps a single request to
// roughly 50 subrequests (every fetch() AND every KV get/put/list counts).
// These caps keep every branch below well below that, even in the
// all-cache-miss worst case.
const BROWSE_PAGE_SIZE = 8;
const FILTER_RESULT_LIMIT = 12;

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

// Deeptide's CDN images hotlink fine as-is; only ipfs.io URLs need the
// same-origin proxy (see functions/api/ipfs-image.js for why).
function displayImage(url) {
  if (!url) return null;
  return url.startsWith('https://ipfs.io/') ? proxyIpfsImage(url) : url;
}

function toItem(nftId, meta, owner, ownerIndexed) {
  return {
    nftId,
    number: meta.number,
    image: displayImage(meta.image),
    attributes: meta.attributes,
    rarityRank: meta.rarityRank || null,
    rarityTotal: meta.rarityTotal || null,
    owner: owner || null,
    ownerShort: owner ? shortenAddr(owner) : null,
    ownerIndexed: !!ownerIndexed
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

  // Trait category discovery ONLY — cheap (1 list() call), for the TRAITS
  // stack filter UI's category dropdown. Values (and their percentages)
  // are fetched lazily per-category via `traitValues=` below, once a row
  // actually picks that category — eagerly computing percentages for
  // every value across every category here would mean one list() call
  // per value (some categories have 30+ values), easily blowing the
  // subrequest budget on its own.
  if (params.get('traits') === '1') {
    const stats = await getPigeonIndexStats(env.coin);
    context.waitUntil(maybeRecomputePigeonIndex(env.coin));
    const categories = await getIndexedTraitCategories(env.coin);
    return json({
      categories,
      collectionSizeApprox: PIGEON_COLLECTION_SIZE_APPROX,
      indexStats: stats
    });
  }

  // Values (+ real percentages) for ONE trait category — lazy, called when
  // a trait-filter row actually selects that category.
  const traitValuesFor = params.get('traitValues');
  if (traitValuesFor) {
    const stats = await getPigeonIndexStats(env.coin);
    const vals = await getIndexedTraitValues(env.coin, traitValuesFor);
    const values = await Promise.all(vals.map(async (v) => {
      const pctInfo = await getTraitValuePercent(env.coin, traitValuesFor, v, stats);
      return { value: v, percent: pctInfo ? pctInfo.pct : null, partial: pctInfo ? pctInfo.partial : true };
    }));
    return json({ values });
  }

  // A wallet's full real holdings — one Deeptide batch call covers all of
  // them (image+traits+rarity), IPFS is only the per-token fallback. No KV
  // writes here (see resolveOwnerCollectionLive) so this stays cheap no
  // matter how many Pigeons the wallet holds. The client then
  // searches/filters/sorts this list entirely on its own.
  const wallet = params.get('wallet');
  if (wallet) {
    const nfts = await fetchAllAccountNfts(wallet);
    const pigeons = findAllPigeons(nfts);
    if (!pigeons.length) return json({ items: [], owner: wallet, ownerShort: shortenAddr(wallet) });
    const ledgerItems = pigeons.map(n => ({ nftId: n.NFTokenID, uriHex: n.URI }));
    const resolved = await resolveOwnerCollectionLive(env.coin, wallet, ledgerItems);
    const items = resolved
      .map(r => toItem(r.nftId, r.meta, wallet, true))
      .sort((a, b) => (a.number || 0) - (b.number || 0));
    return json({ items, owner: wallet, ownerShort: shortenAddr(wallet) });
  }

  // Fresh single-token detail lookup by known NFTokenID (from a card already on screen).
  const detailId = params.get('detail');
  if (detailId) {
    const fresh = await fetchNftInfo(detailId);
    const cachedMeta = await getPigeonMetaCached(env.coin, detailId);
    const meta = cachedMeta || (fresh ? await getPigeonFullMeta(env.coin, detailId, fresh.uriHex) : null);
    if (!meta) return json({ item: null, notIndexed: true });
    return json({ item: toItem(detailId, meta, fresh ? fresh.owner : null, !!fresh) });
  }

  // Direct Pigeon-number search — only real if it's already been indexed.
  const number = params.get('number');
  if (number) {
    const num = parseInt(number, 10);
    if (!num || num < 1) return json({ items: [], notIndexed: false, invalid: true });
    const nftId = await getPigeonNumberIndex(env.coin, num);
    if (!nftId) return json({ items: [], notIndexed: true, query: num });
    const fresh = await fetchNftInfo(nftId);
    const meta = await getPigeonMetaCached(env.coin, nftId);
    if (!meta) return json({ items: [], notIndexed: true, query: num });
    return json({ items: [toItem(nftId, meta, fresh ? fresh.owner : null, !!fresh)] });
  }

  // Stackable trait filters — ALL must match (AND). filters is a JSON
  // array like [{"trait":"Background","value":"Cyan"}, ...]. Real, but
  // scoped to whatever's been indexed so far (see filterPigeonsByTraits).
  const filtersRaw = params.get('filters');
  if (filtersRaw) {
    let filters;
    try { filters = JSON.parse(filtersRaw); } catch (e) { filters = []; }
    if (!Array.isArray(filters) || !filters.length) return json({ items: [], indexedOnly: true });
    const matches = await filterPigeonsByTraits(env.coin, filters, FILTER_RESULT_LIMIT);
    return json({
      items: matches.map(m => toItem(m.nftId, m.meta, null, false)),
      indexedOnly: true
    });
  }

  // Default: paginate the real collection straight off the ledger, batched
  // per-owner through Deeptide (falls back to IPFS per-token as needed).
  const marker = params.get('marker') || undefined;
  const page = await fetchPigeonCollectionPage(marker, BROWSE_PAGE_SIZE);
  const byOwner = new Map();
  for (const it of page.items) {
    if (!byOwner.has(it.owner)) byOwner.set(it.owner, []);
    byOwner.get(it.owner).push(it);
  }
  const resolvedGroups = await Promise.allSettled(
    Array.from(byOwner.entries()).map(([owner, items]) => resolvePigeonsForOwner(env.coin, owner, items).then(r => ({ owner, resolved: r })))
  );
  const items = [];
  for (const g of resolvedGroups) {
    if (g.status !== 'fulfilled') continue;
    for (const r of g.value.resolved) {
      if (r.meta && r.meta.image) items.push(toItem(r.nftId, r.meta, g.value.owner, true));
    }
  }
  items.sort((a, b) => (a.number || 0) - (b.number || 0));
  const failedCount = page.items.length - items.length;

  // Keep the background full-collection indexer moving forward without
  // making this page render wait on it.
  context.waitUntil(maybeRecomputePigeonIndex(env.coin));

  return json({
    items,
    marker: page.marker,
    failedCount,
    collectionSizeApprox: PIGEON_COLLECTION_SIZE_APPROX
  });
}
