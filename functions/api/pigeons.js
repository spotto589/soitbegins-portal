import {
  fetchPigeonCollectionPage, fetchNftInfo, getPigeonFullMeta, getPigeonMetaCached,
  getPigeonNumberIndex, getIndexedTraitCategories, getIndexedTraitValues, getPigeonsByTraitValue,
  proxyIpfsImage, PIGEON_COLLECTION_SIZE_APPROX
} from '../_shared.js';

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

function proxiedItem(base) {
  return { ...base, image: base.image ? proxyIpfsImage(base.image) : null };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.coin) return json({ error: 'server_misconfigured' }, 500);

  const url = new URL(request.url);
  const params = url.searchParams;

  // Trait category/value discovery, for the TRAITS filter panel.
  if (params.get('traits') === '1') {
    const categories = await getIndexedTraitCategories(env.coin);
    const values = {};
    await Promise.all(categories.map(async (cat) => {
      values[cat] = await getIndexedTraitValues(env.coin, cat);
    }));
    return json({ categories: values, collectionSizeApprox: PIGEON_COLLECTION_SIZE_APPROX });
  }

  // Fresh single-token detail lookup by known NFTokenID (from a card already on screen).
  const detailId = params.get('detail');
  if (detailId) {
    const fresh = await fetchNftInfo(detailId);
    const cachedMeta = await getPigeonMetaCached(env.coin, detailId);
    const meta = cachedMeta || (fresh ? await getPigeonFullMeta(env.coin, detailId, fresh.uriHex) : null);
    if (!meta) return json({ item: null, notIndexed: true });
    return json({
      item: proxiedItem({
        nftId: detailId,
        number: meta.number,
        image: meta.image,
        attributes: meta.attributes,
        owner: fresh ? fresh.owner : null,
        ownerShort: fresh && fresh.owner ? shortenAddr(fresh.owner) : null,
        ownerIndexed: !!fresh
      })
    });
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
    return json({
      items: [proxiedItem({
        nftId,
        number: meta.number,
        image: meta.image,
        attributes: meta.attributes,
        owner: fresh ? fresh.owner : null,
        ownerShort: fresh && fresh.owner ? shortenAddr(fresh.owner) : null,
        ownerIndexed: !!fresh
      })]
    });
  }

  // Trait/value search — real, but scoped to whatever's been indexed so far.
  const trait = params.get('trait');
  const value = params.get('value');
  if (trait && value) {
    const matches = await getPigeonsByTraitValue(env.coin, trait, value, 48);
    return json({
      items: matches.map(m => proxiedItem({
        nftId: m.nftId,
        number: m.meta.number,
        image: m.meta.image,
        attributes: m.meta.attributes,
        owner: null,
        ownerShort: null,
        ownerIndexed: false
      })),
      indexedOnly: true
    });
  }

  // Default: paginate the real collection straight off the ledger.
  const marker = params.get('marker') || undefined;
  const page = await fetchPigeonCollectionPage(marker, 48);
  const results = await Promise.allSettled(
    page.items.map(async (it) => {
      const meta = await getPigeonFullMeta(env.coin, it.nftId, it.uriHex);
      if (!meta || meta.image === null) return null;
      return proxiedItem({
        nftId: it.nftId,
        number: meta.number,
        image: meta.image,
        attributes: meta.attributes,
        owner: it.owner,
        ownerShort: shortenAddr(it.owner),
        ownerIndexed: true
      });
    })
  );
  const items = results
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter(Boolean)
    .sort((a, b) => (a.number || 0) - (b.number || 0));
  const failedCount = page.items.length - items.length;

  return json({
    items,
    marker: page.marker,
    failedCount,
    collectionSizeApprox: PIGEON_COLLECTION_SIZE_APPROX
  });
}
