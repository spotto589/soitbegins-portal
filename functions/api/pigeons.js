import {
  fetchDeeptideListings, fetchDeeptideNftDetail, fetchDeeptideNftDetailCached, fetchDeeptideNftHistory, fetchDeeptideRealFloor, getTraitCategoriesWithPercent,
  fetchDeeptideSalesHistory, fetchXrpCafeCollectionStats, fetchXrpCafeNftListing, getPigeonNumberMap, getPigeonNumberMapStats, maybeRefreshPigeonNumberMap, getTraitExampleMap,
  getHighSaleMap, maybeRefreshHighSaleMap,
  getSwapListingsMap, removeSwapListing, fetchNftSellOffersOrNull, getSwapSalesLog, identifySaleVenue, getFloorIndex,
  resolveOwnerCollectionFast, resolveOwnerCollectionPending, fetchAllAccountNftsCheckedCached, findAllPigeons, findAllCollectionNfts, fetchPigeonsXrpRate, fetchPigeonsAccountLine, fetchXrpBalanceDrops, accountReserveDrops, quotePigeonsForXrpDrops,
  proxyIpfsImage, PIGEON_COLLECTION_SIZE_APPROX, PIGEON_LOW_EDITION_MAX, DEEPTIDE_PIGEON_SHOP_SLUG, getTradeConfig, PIGEONS_TOKEN_CONFIG,
  getCachedCrownHolder, mapWithConcurrency
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

// ─────────────────────────────────────────────────────────────────────────
// Browse-only Teddy Bear Gang / Phnix support. `tradeable: false` collections
// get NONE of the $PIGEONS-specific machinery below (Scylla listings, real
// $PIGEONS sales, the number-map/high-sale KV crawls that back number
// search, EDITION range, and highest/avg-sale sort) — none of that exists
// for these collections yet (no login/trading wired up, per explicit scope:
// browse only for now). Every mode below either short-circuits early for a
// non-tradeable collection or naturally returns empty results, since the
// three $PIGEONS maps are just empty objects for them (Object.keys(map)
// yields []) rather than crashing or silently mixing in another
// collection's data. Deeptide's own listings/traits/floor endpoints ARE
// already shopSlug-parameterized (see _shared.js's own comment on that),
// so plain browse + trait filter + floor price genuinely work today with
// no new crawl infrastructure — that's the whole reason "browse only" is
// actually a small slice of this file, not all of it.
const COLLECTIONS = {
  pigeons: {
    key: 'pigeons',
    shopSlug: DEEPTIDE_PIGEON_SHOP_SLUG,
    vanitySlug: 'xrpigeons',
    xrpCafeUrl: 'https://xrp.cafe/collection/xrpigeons',
    sizeApprox: PIGEON_COLLECTION_SIZE_APPROX,
    tradeable: true
  },
  // Sizes are approximate collection totals (Deeptide's own listings
  // endpoint reports the real total on every page; hardcoded here rather
  // than fetched, same "approx" convention PIGEON_COLLECTION_SIZE_APPROX
  // already uses, confirmed against a live listings call at the time this
  // was added). PHNIX is now real trading (see TRADEABLE_COLLECTIONS in
  // _shared.js for its NFT issuer/taxon/token) — key matches that config's
  // own key so scyllaListingsMap/pigeonsSalesMap below read PHNIX's own
  // namespaced KV data, not Pigeons'.
  phnixs: { key: 'phnixs', shopSlug: 'phnixs', vanitySlug: 'phnixs', xrpCafeUrl: 'https://xrp.cafe/collection/phnixs', sizeApprox: 1588, tradeable: true },
  // TEDDY now has a real token (see TRADEABLE_COLLECTIONS.teddybg in
  // _shared.js) so BUY $TEDDY works — tradeable:true here too, so its
  // scyllaListingsMap/pigeonsSalesMap KV reads use TEDDY's own namespaced
  // keys, same as every other tradeable collection above.
  teddybg: { key: 'teddybg', shopSlug: 'teddybg', vanitySlug: 'teddybg', xrpCafeUrl: 'https://xrp.cafe/collection/teddybg', sizeApprox: 2600, tradeable: true },
  // SEAL/FUZZY/C0NSP!RACY — token-only entries (see TRADEABLE_COLLECTIONS
  // in _shared.js), added here specifically so resolveCollection() below
  // doesn't silently fall back to $PIGEONS for these collection keys and
  // quote/prepare a Pigeons-denominated swap by mistake. No real Deeptide
  // shop slug for any of these yet, so shopSlug/vanitySlug/xrpCafeUrl/
  // sizeApprox stay null — nothing that needs them (browse/traits/stats)
  // is ever called for these three, only the BUY-with-XRP swap endpoints.
  seal: { key: 'seal', shopSlug: null, vanitySlug: null, xrpCafeUrl: null, sizeApprox: null, tradeable: true },
  fuzzy: { key: 'fuzzy', shopSlug: null, vanitySlug: null, xrpCafeUrl: null, sizeApprox: null, tradeable: true },
  conspiracy: { key: 'conspiracy', shopSlug: null, vanitySlug: null, xrpCafeUrl: null, sizeApprox: null, tradeable: true }
};
function resolveCollection(params) {
  const key = params.get('collection');
  return (key && COLLECTIONS[key]) || COLLECTIONS.pigeons;
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

function toItem(nftId, meta, ownerOverride, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency) {
  const owner = ownerOverride !== undefined ? ownerOverride : meta.owner;
  const priceDrops = typeof meta.priceDrops === 'number' ? meta.priceDrops : null;
  const highSaleEntry = highSaleMap ? highSaleMap[nftId] : undefined;
  const scyllaEntry = scyllaListingsMap ? scyllaListingsMap[nftId] : undefined;
  const pigeonsSaleEntry = pigeonsSalesMap ? pigeonsSalesMap[nftId] : undefined;
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
    highSaleTxUrl: highSaleEntry && highSaleEntry.txHash ? bithompTxUrl(highSaleEntry.txHash) : null,
    avgSaleXrp: highSaleEntry && highSaleEntry.count ? (highSaleEntry.totalDrops / highSaleEntry.count) / 1000000 : null,
    saleCount: highSaleEntry ? (highSaleEntry.count || null) : null,
    recentSaleXrp: highSaleEntry && typeof highSaleEntry.recentDrops === 'number' ? highSaleEntry.recentDrops / 1000000 : null,
    recentSaleTxUrl: highSaleEntry && highSaleEntry.recentTxHash ? bithompTxUrl(highSaleEntry.recentTxHash) : null,
    // Real $PIGEONS sales through Σκύλλα's own marketplace — 0 until a
    // Pigeon has actually sold for $PIGEONS, then the real figure.
    highSalePigeons: pigeonsSaleEntry ? pigeonsSaleEntry.highest : 0,
    avgSalePigeons: pigeonsSaleEntry ? pigeonsSaleEntry.total / pigeonsSaleEntry.count : 0,
    scyllaListing: scyllaEntry ? { price: scyllaEntry.price, currency: tokenCurrency, expiration: scyllaEntry.expiration || null } : null
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Attaches the same { deeptide, xrpCafe } breakdown the INSPECT screen
// already shows to every card in a browse page, so the grid can show both
// marketplaces (and a BUY link for each) without opening a Pigeon. One
// xrp.cafe fetch per item, capped well under the subrequest budget (the
// Deeptide side is already known from toItem's own priceXrp/buyUrl).
// Two caps: branches that already spend one Deeptide fetch per item
// (numeric/edition/highest-sale — real detail lookups, not the cheap
// listings-summary path) used to cap xrp.cafe much lower (10) on top of
// that, so most of a page never got checked at all — not "not listed,"
// just never looked up, which read as xrp.cafe listings silently missing.
// swap-listing-owned.js already fires up to 45 concurrent XRPL calls in a
// single request elsewhere in this same app without issue, so there's
// real headroom above 10+36; raised to cover a full page.
const LISTINGS_ENRICH_CAP = 40;
const LISTINGS_ENRICH_CAP_LOW = 36;
async function attachListings(kv, items, cap = LISTINGS_ENRICH_CAP) {
  const capped = items.slice(0, cap);
  await Promise.all(capped.map(async (it) => {
    const xc = await fetchXrpCafeNftListing(kv, it.nftId);
    it.listings = {
      deeptide: { priceXrp: it.priceXrp, buyUrl: it.buyUrl },
      xrpCafe: {
        priceXrp: xc && xc.priceXrp !== null && xc.priceXrp !== undefined ? xc.priceXrp : null,
        buyUrl: xc && xc.priceXrp !== null && xc.priceXrp !== undefined ? `https://xrp.cafe/nft/${it.nftId}` : null
      }
    };
  }));
  return items;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.coin) return json({ error: 'server_misconfigured' }, 500);

  const url = new URL(request.url);
  const params = url.searchParams;
  const coll = resolveCollection(params);
  const tradeable = coll.tradeable;
  // The active collection's real token currency — toItem's own
  // scyllaListing.currency used to always say 'PIGEONS' even on a PHNIX
  // card. Falls back to $PIGEONS' currency for a non-tradeable collection
  // (never actually read there, scyllaListingsMap is always empty).
  const tradeCfg = tradeable ? getTradeConfig(coll.key) : null;
  const tokenCurrency = tradeCfg ? tradeCfg.tokenConfig.currency : PIGEONS_TOKEN_CONFIG.currency;

  // Highest-ever sale price per token — one cheap KV read, reused for
  // every item below (cards' "HIGH SALE" line and the highest-sale sort).
  // Empty for a non-tradeable collection (see COLLECTIONS' own comment) —
  // no crawl exists for these yet, not this global $PIGEONS-collection map.
  const highSaleMap = tradeable ? await getHighSaleMap(env.coin) : {};

  // Σκύλλα SWAP listings — one cheap KV read, reused for every item below
  // (the Σ LISTED badge on ordinary browse cards, and the LISTED filter's
  // own $PIGEONS sort). No per-card cost beyond this single read.
  const scyllaListingsMap = tradeable ? await getSwapListingsMap(env.coin, coll.key) : {};

  // Real $PIGEONS-denominated sales, straight from the same capped log the
  // SALES DATA tab already reads (getSwapSalesLog) — grouped here by NFT
  // so "HIGHEST RECORDED"/"AVG SALE" can show a real $PIGEONS figure next
  // to the XRP one instead of always reading 0. One KV read, reused for
  // every item below, same pattern as highSaleMap.
  const pigeonsSalesMap = {};
  if (tradeable && env.coin) {
    const salesLog = await getSwapSalesLog(env.coin, coll.key);
    for (const sale of salesLog) {
      const value = parseFloat(sale.priceValue);
      if (!sale.nftId || !Number.isFinite(value)) continue;
      const entry = pigeonsSalesMap[sale.nftId] || (pigeonsSalesMap[sale.nftId] = { highest: 0, total: 0, count: 0 });
      entry.highest = Math.max(entry.highest, value);
      entry.total += value;
      entry.count += 1;
    }
  }

  // Trait category/value/percentage discovery for the TRAITS stack filter
  // UI — real, exact counts straight from Deeptide, not sampled. Real for
  // every collection (getTraitCategoriesWithPercent is shopSlug-keyed
  // already), but trait EXAMPLE images (a representative photo per trait
  // value) are a side effect of the $PIGEONS-only number-map crawl — no
  // equivalent crawl exists for a non-tradeable collection yet, so those
  // just come back empty rather than showing a Pigeon's photo on a Teddy/
  // Phnix trait.
  if (params.get('traits') === '1') {
    const categories = await getTraitCategoriesWithPercent(env.coin, coll.shopSlug, coll.sizeApprox);
    const examples = {};
    if (tradeable) {
      const rawExamples = await getTraitExampleMap(env.coin);
      // Same ipfs.io same-origin proxy every other image on this page goes
      // through (displayImage) — raw ipfs.io URLs get Fetch-Metadata-blocked
      // when hotlinked directly from the browser.
      for (const cat of Object.keys(rawExamples)) {
        examples[cat] = {};
        for (const val of Object.keys(rawExamples[cat])) {
          examples[cat][val] = displayImage(rawExamples[cat][val]);
        }
      }
    }
    const numberMapStats = tradeable ? await getPigeonNumberMapStats(env.coin) : null;
    if (tradeable) context.waitUntil(maybeRefreshPigeonNumberMap(env.coin));
    return json({
      categories,
      examples,
      collectionSizeApprox: coll.sizeApprox,
      numberMapStats
    });
  }

  // Real live $PIGEONS/XRP rate (DexScreener trade-derived price, falling
  // back to the XRPL DEX order book) — used for the "1 $PIGEONS = X XRP"
  // indicator shown while listing and the trustline banner's rate/
  // calculator (a convenience readout only, never used to set/validate a
  // price).
  if (params.get('pigeonsRate') === '1') {
    const rate = await fetchPigeonsXrpRate(env.coin, coll.key);
    return json({ xrpPerPigeon: rate.xrpPerPigeon, usdPerPigeon: rate.usdPerPigeon, marketCapUsd: rate.marketCapUsd, liquidityUsd: rate.liquidityUsd, dexUrl: rate.dexUrl });
  }

  // Real $PIGEONS trustline + balance for the logged-in wallet (LOGIN
  // button on the trustline banner) — straight from account_lines, never
  // a fabricated/cached figure.
  if (params.get('pigeonsAccountLine') === '1') {
    const wallet = params.get('wallet');
    if (!wallet) return json({ error: 'missing_wallet' }, 400);
    // The ACTIVE collection's real token, not always $PIGEONS — see
    // getTradeConfig/TRADEABLE_COLLECTIONS in _shared.js. Falls back to
    // $PIGEONS for an unknown/non-tradeable collection param rather than
    // 400ing, since this banner always needs to render something.
    const lineCfg = getTradeConfig(coll.key);
    const line = await fetchPigeonsAccountLine(wallet, lineCfg ? lineCfg.tokenConfig : PIGEONS_TOKEN_CONFIG);
    // hasTrustline === null means the live lookup itself failed (even
    // after fetchPigeonsAccountLine's own retries) — never a fabricated
    // "no trustline"/"0 balance". This used to always return 200 either
    // way, so the client's `line.hasTrustline ? balance : 0` treated a
    // failed lookup exactly like a confirmed-empty one, silently showing
    // 0 $PIGEONS on the trustline banner for a wallet that actually holds
    // a real balance. A real error status here lets the client's existing
    // retry-on-failure logic (apiWithRetry) actually retry instead of
    // accepting the false negative as final.
    if (line.hasTrustline === null) return json({ error: 'ledger_lookup_failed' }, 502);
    return json(line);
  }

  // Native XRP balance (exact drops string) — used by the BUY $PIGEONS
  // swap panel to cap the YOU PAY input at what the wallet can actually
  // afford. Read-only ledger data, same trust level as pigeonsAccountLine
  // above.
  if (params.get('xrpBalance') === '1') {
    const wallet = params.get('wallet');
    if (!wallet) return json({ error: 'missing_wallet' }, 400);
    const info = await fetchXrpBalanceDrops(wallet);
    if (!info) return json({ error: 'balance_lookup_failed' }, 502);
    // reserveDrops is the wallet's REAL reserve requirement (base + one
    // owner-reserve increment per owned ledger object — trustlines, NFT
    // pages, offers, etc.), computed here so the client never has to
    // guess it — see accountReserveDrops in _shared.js.
    return json({ drops: info.drops, reserveDrops: accountReserveDrops(info.ownerCount).toString() });
  }

  // BUY $PIGEONS swap — Stage 3 live quote (walks the real order book, see
  // quotePigeonsForXrpDrops in _shared.js). No KV, no caching — a quote is
  // meant to reflect the book right now, not a minute-old snapshot.
  if (params.get('pigeonsQuote') === '1') {
    const drops = params.get('xrpDrops');
    if (!drops || !/^[1-9][0-9]*$/.test(drops)) return json({ error: 'bad_amount' }, 400);
    const quote = await quotePigeonsForXrpDrops(drops, coll.key);
    return json(Object.assign({ quotedAt: Date.now() }, quote));
  }

  // Collection-wide stats strip — items/holders (real, our own Clio-based
  // full scan, same snapshot as topHolders/Crown) plus floor price from
  // BOTH marketplaces (each has its own separate liquidity, so a real
  // floor differs by platform) and volume/listed% from xrp.cafe, whose
  // public collection-stats API is the only one of the two that tracks
  // those particular figures.
  if (params.get('stats') === '1') {
    // holders (crownSnapshot) is a full Clio scan keyed to PIGEON_ISSUER/
    // PIGEON_TAXON specifically — no equivalent scan exists for a
    // non-tradeable collection yet, comes back null rather than showing
    // $PIGEONS' own holder count on a different collection's tile.
    const [deeptideFloor, xrpCafeStats, crownSnapshot, recentSales] = await Promise.all([
      fetchDeeptideRealFloor(coll.shopSlug),
      fetchXrpCafeCollectionStats(env.coin, coll.vanitySlug),
      // Crown is a $PIGEONS-only feature (its own holder-tracking crawl is
      // keyed to PIGEON_ISSUER/PIGEON_TAXON specifically, see its own
      // comment above) — fetching it for any other collection was
      // harmless but pointless, since the real bug was down in `holders`
      // below always reading its count regardless of collection.
      coll.key === 'pigeons' ? getCachedCrownHolder(env.coin) : Promise.resolve(null),
      fetchDeeptideSalesHistory({ limit: 50, sort: 'date-desc', shopSlug: coll.shopSlug })
    ]);
    // 24h activity — real, computed from Deeptide's own sales feed (xrp.cafe's
    // collection API has no 24h-scoped fields of its own, just lifetime
    // totals) rather than a separate, less reliable source.
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const sales24h = (recentSales.items || []).filter(s => s.createdAt && new Date(s.createdAt).getTime() >= dayAgo);
    const buyers24h = new Set(sales24h.map(s => s.buyer).filter(Boolean));
    const traded24h = new Set(sales24h.map(s => s.nftId).filter(Boolean));
    const volume24hXrp = sales24h.reduce((sum, s) => sum + (s.priceXrp || 0), 0);
    return json({
      items: coll.sizeApprox,
      // crownSnapshot.holderCount is $PIGEONS-only (see the fetch above) —
      // used to get shown as the HOLDERS tile for every OTHER tradeable
      // collection too, since this line never checked which collection it
      // was actually looking at. xrp.cafe's own per-collection stats
      // (already vanitySlug-scoped, see fetchXrpCafeCollectionStats) is a
      // real fallback for everything else, and for $PIGEONS itself when
      // Crown hasn't computed a snapshot yet.
      holders: coll.key === 'pigeons'
        ? (crownSnapshot ? crownSnapshot.holderCount : (xrpCafeStats ? xrpCafeStats.holders : null))
        : (xrpCafeStats ? xrpCafeStats.holders : null),
      deeptideFloorXrp: deeptideFloor ? deeptideFloor.priceDrops / 1000000 : null,
      deeptideBuyUrl: deeptideFloor ? deeptideBuyUrl(deeptideFloor.nftId) : null,
      xrpCafeFloorXrp: xrpCafeStats && xrpCafeStats.floorDrops !== null ? xrpCafeStats.floorDrops / 1000000 : null,
      xrpCafeUrl: coll.xrpCafeUrl,
      totalVolumeXrp: xrpCafeStats && xrpCafeStats.totalVolumeDrops !== null ? xrpCafeStats.totalVolumeDrops / 1000000 : null,
      listedPercent: xrpCafeStats ? xrpCafeStats.percentListed : null,
      scyllaListedCount: Object.keys(scyllaListingsMap).length,
      scyllaFloorPigeons: (() => {
        const prices = Object.values(scyllaListingsMap).map(l => parseFloat(l.price)).filter(n => isFinite(n));
        return prices.length ? Math.min(...prices) : null;
      })(),
      sales24hCount: sales24h.length,
      traded24hCount: traded24h.size,
      buyers24hCount: buyers24h.size,
      volume24hXrp: volume24hXrp
    });
  }

  // Top 100 current Pigeon holders, network-wide — piggybacks on the same
  // cached full-scan snapshot the Crown feature already maintains (board.js).
  // Cheap KV read only; the background recompute-on-stale trigger was
  // removed (see board.js) to stop the recurring KV writes, so this now
  // just serves whatever was last computed, frozen.
  if (params.get('topHolders') === '1') {
    const snapshot = await getCachedCrownHolder(env.coin);
    const holders = (snapshot && snapshot.topHolders) || [];
    return json({
      holders: holders.map(h => ({
        wallet: h.wallet,
        ownerShort: shortenAddr(h.wallet),
        count: h.count,
        percent: PIGEON_COLLECTION_SIZE_APPROX > 0 ? (h.count / PIGEON_COLLECTION_SIZE_APPROX) * 100 : null,
        // Only ever populated for the top 15 (see doRecomputeCrownHolder) —
        // computed once per Crown recompute, not per request.
        rarestPigeon: h.rarestPigeon || null,
      })),
      computedAt: snapshot ? snapshot.computedAt : null
    });
  }

  // Real, collection-wide sales history straight from Deeptide's own
  // `/api/sales/recent`, merged with Σκύλλα's own recorded sales (BUY
  // completions confirmed on-ledger by swap-buy-status.js) so a trade made
  // directly through Σκύλλα — never touching Deeptide's platform, priced
  // in $PIGEONS rather than XRP — still shows up here. Optionally scoped
  // to one wallet (buyer or seller) via `wallet`.
  //
  // Σκύλλα's own log is placed ahead of Deeptide's entire feed rather than
  // true chronologically interleaved: it's small and newest-first, and in
  // practice every entry in it is more recent than Deeptide's already-
  // indexed history, so this holds up without needing to pull Deeptide's
  // full remote history just to sort against it.
  if (params.get('sales') === '1') {
    const salesSkip = Math.max(0, parseInt(params.get('skip') || '0', 10) || 0);
    const salesLimit = Math.min(50, Math.max(1, parseInt(params.get('limit') || '20', 10) || 20));
    const salesWallet = params.get('wallet') || undefined;
    // XRP/$PIGEONS tabs (see SALES H!ST0RY's own currency toggle) — each
    // currency only ever comes from exactly one of the two sources below
    // (Σκύλλα's own log is 100% $PIGEONS trades, Deeptide's feed is 100%
    // XRP), so a single-currency request can paginate straight against
    // just that one source instead of the two-source interleave the
    // unfiltered branch further down still needs.
    const salesCurrency = params.get('currency');
    // This feed is a collection-wide sales index Deeptide happens to
    // operate, not proof a trade was actually brokered through Deeptide's
    // own marketplace UI - confirmed live, most of what it returns turns
    // out to be xrp.cafe trades on inspection. `via` here comes from
    // identifySaleVenue's real on-ledger check (the accept transaction's
    // own broker account), not from which feed the item came from -
    // unresolved (private/direct trade, or a lookup failure) means no tag.
    const mapDeeptideItem = async it => ({
      txHash: it.txHash,
      nftId: it.nftId,
      number: it.number,
      image: displayImage(it.image),
      priceXrp: it.priceXrp,
      currency: 'XRP',
      buyer: it.buyer,
      buyerShort: shortenAddr(it.buyer),
      seller: it.seller,
      sellerShort: shortenAddr(it.seller),
      createdAt: it.createdAt,
      via: it.txHash ? await identifySaleVenue(env.coin, it.txHash).catch(() => null) : null
    });
    if (salesCurrency === 'PIGEONS') {
      let ownSales = env.coin ? await getSwapSalesLog(env.coin, coll.key) : [];
      if (salesWallet) ownSales = ownSales.filter(s => s.buyer === salesWallet || s.seller === salesWallet);
      const slice = ownSales.slice(salesSkip, salesSkip + salesLimit);
      const details = await Promise.all(slice.map(s => fetchDeeptideNftDetail(s.nftId).catch(() => null)));
      const items = slice.map((s, i) => ({
        txHash: s.txHash,
        nftId: s.nftId,
        number: details[i] ? details[i].number : null,
        image: details[i] ? displayImage(details[i].image) : null,
        priceXrp: null,
        pigeonsPrice: typeof s.priceValue === 'string' ? Number(s.priceValue) : s.priceValue,
        currency: tokenCurrency,
        buyer: s.buyer,
        buyerShort: shortenAddr(s.buyer),
        seller: s.seller,
        sellerShort: shortenAddr(s.seller),
        createdAt: s.createdAt,
        via: 'scylla'
      }));
      return json({ items, total: ownSales.length, hasMore: (salesSkip + items.length) < ownSales.length, skip: salesSkip, limit: salesLimit });
    }
    if (salesCurrency === 'XRP') {
      const page = await fetchDeeptideSalesHistory({ skip: salesSkip, limit: salesLimit, sort: 'date-desc', wallet: salesWallet, shopSlug: coll.shopSlug });
      const items = await Promise.all(page.items.map(mapDeeptideItem));
      return json({ items, total: page.total, hasMore: page.hasMore, skip: salesSkip, limit: salesLimit });
    }

    let ownSales = env.coin ? await getSwapSalesLog(env.coin, coll.key) : [];
    if (salesWallet) {
      ownSales = ownSales.filter(s => s.buyer === salesWallet || s.seller === salesWallet);
    }
    const ownTotal = ownSales.length;

    let items, deeptideTotal, deeptideHasMore;
    if (salesSkip < ownTotal) {
      const ownSlice = ownSales.slice(salesSkip, salesSkip + salesLimit);
      // recordSwapSale only stores what's needed to identify the trade
      // (nftId, parties, price) - number/image come from the same
      // per-token metadata lookup Deeptide items already use, so a Σκύλλα
      // row looks the same as any other instead of showing a blank thumb.
      const details = await Promise.all(ownSlice.map(s => fetchDeeptideNftDetail(s.nftId).catch(() => null)));
      const ownItems = ownSlice.map((s, i) => ({
        txHash: s.txHash,
        nftId: s.nftId,
        number: details[i] ? details[i].number : null,
        image: details[i] ? displayImage(details[i].image) : null,
        priceXrp: null,
        pigeonsPrice: typeof s.priceValue === 'string' ? Number(s.priceValue) : s.priceValue,
        currency: tokenCurrency,
        buyer: s.buyer,
        buyerShort: shortenAddr(s.buyer),
        seller: s.seller,
        sellerShort: shortenAddr(s.seller),
        createdAt: s.createdAt,
        via: 'scylla'
      }));
      const remaining = salesLimit - ownItems.length;
      const page = await fetchDeeptideSalesHistory({ skip: 0, limit: Math.max(remaining, 1), sort: 'date-desc', wallet: salesWallet, shopSlug: coll.shopSlug });
      deeptideTotal = page.total;
      deeptideHasMore = page.hasMore;
      const deepItems = remaining > 0 ? await Promise.all(page.items.slice(0, remaining).map(mapDeeptideItem)) : [];
      items = ownItems.concat(deepItems);
    } else {
      const page = await fetchDeeptideSalesHistory({ skip: salesSkip - ownTotal, limit: salesLimit, sort: 'date-desc', wallet: salesWallet, shopSlug: coll.shopSlug });
      deeptideTotal = page.total;
      deeptideHasMore = page.hasMore;
      items = await Promise.all(page.items.map(mapDeeptideItem));
    }

    const total = ownTotal + deeptideTotal;
    return json({ items, total, hasMore: (salesSkip + items.length) < total, skip: salesSkip, limit: salesLimit });
  }

  // A wallet's full real holdings — used by the SELECT -> owner's
  // collection flow (and SH0W MY P!GE0NS/the Σκύλλα tab, for the signed-
  // in wallet). No KV writes, cheap regardless of wallet size.
  const wallet = params.get('wallet');
  if (wallet) {
    // The checked variant so a failed/incomplete live scan (xrplcluster.com
    // still rate-limited after all 3 retries) returns a real error status
    // instead of a 200 with items:[] — indistinguishable from a genuinely
    // empty wallet, which is exactly what was making wallet search
    // intermittently show "N0 P!GE0N MATCH" for wallets that actually own
    // Pigeons. A non-200 here lets the client's existing apiWithRetry
    // actually retry. Cached (20s, see fetchAllAccountNftsCheckedCached's
    // own comment) since MY PIGEONS/OFFERS/listing-owned all fire this
    // same lookup for the same wallet within milliseconds of each other.
    const { nfts, ok } = await fetchAllAccountNftsCheckedCached(context, wallet);
    if (!ok) return json({ error: 'ledger_lookup_failed' }, 502);
    // The ACTIVE collection's NFTs, not always Pigeons — this is the
    // wallet= handler behind SH0W MY NFTs/the FL0CK tab, so a PHNIX wallet
    // lookup must filter by PHNIX's own issuer/taxon, not Pigeons'.
    const pigeons = findAllCollectionNfts(nfts, coll.key);
    if (!pigeons.length) return json({ items: [], owner: wallet, ownerShort: shortenAddr(wallet) });
    const ledgerItems = pigeons.map(n => ({ nftId: n.NFTokenID, uriHex: n.URI }));
    // Follow-up call — the client already got the fast-phase response
    // below once, and is now asking to resolve specifically whichever
    // nftIds came back in pendingIds via the slower per-item fallback.
    // Filtered against this wallet's own real ledgerItems (not trusted
    // as-is) so a tampered id list can never resolve metadata for a
    // token this wallet doesn't actually hold.
    const resolveIds = params.get('resolveIds');
    if (resolveIds) {
      const wantIds = new Set(resolveIds.split(',').filter(Boolean));
      const wantedLedgerItems = ledgerItems.filter(it => wantIds.has(it.nftId));
      const resolvedPending = await resolveOwnerCollectionPending(wantedLedgerItems);
      const items = resolvedPending.map(r => toItem(r.nftId, r.meta, wallet, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency));
      return json({ items });
    }
    // Fast phase — only whatever Deeptide's own bulk index already has
    // ready (the vast majority of items, in practice), so this doesn't
    // block on however many slow individual metadata fetches a handful
    // of not-yet-indexed items would otherwise need. pendingIds is
    // everything left for the client to optionally resolve via a
    // resolveIds= follow-up (see above) instead of waiting on it here.
    const { resolved, pendingIds } = await resolveOwnerCollectionFast(env.coin, wallet, ledgerItems, coll.shopSlug);
    const items = resolved
      .map(r => toItem(r.nftId, r.meta, wallet, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency))
      .sort((a, b) => (a.number || 0) - (b.number || 0));
    return json({ items, owner: wallet, ownerShort: shortenAddr(wallet), pendingIds });
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
      fetchXrpCafeNftListing(env.coin, detailId)
    ]);
    if (!item) return json({ item: null, notIndexed: true });
    // Deeptide's own detail response has each trait's percentage but not its
    // raw count — cross-reference the (cached) collection-wide trait-card
    // counts so INSPECT can show both "12.4%" and "374 PIGEONS".
    item.attributes = item.attributes.map(a => {
      const match = (categories[a.trait_type] || []).find(v => v.value === a.value);
      return { trait_type: a.trait_type, value: a.value, percent: match ? match.percent : (a.percent != null ? a.percent : null), count: match ? match.count : null };
    });
    const result = toItem(item.nftId, item, undefined, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency);
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
    return json({ items: [toItem(item.nftId, item, undefined, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency)] });
  }

  // Trait filters (# 0R WALLET's own F!LTER BY TRA!TS) — parsed once here
  // so every sort mode below can honor them, not just the plain default
  // rarity path. Sort modes built from a separate pre-computed index
  // (highSaleMap for H!GHEST REC0RDED SALES, the number map for A-Z/Z-A)
  // carry no trait data of their own, so filtering them means first
  // learning which nftIds actually match via scanFilteredCandidates below,
  // then intersecting — see each branch's own comment.
  const filtersRaw = params.get('filters');
  let filters = [];
  if (filtersRaw) {
    try { filters = JSON.parse(filtersRaw); } catch (e) { filters = []; }
    if (!Array.isArray(filters)) filters = [];
  }

  // 1ST/2ND ED!T!0N (numberRange) — same "parse once, every sort mode
  // honors it" reasoning as filters just above. Confirmed live: picking
  // an edition while a sales-price/floor-price/cross-listing sort was
  // active silently ignored it and showed the whole collection, since
  // only the two dedicated edition branches further down ever looked at
  // this param. idsInEditionRange is a lazy, memoized nftId->in-range
  // lookup (built from the same crawled number map ?number= search
  // already uses) so the scyllaListed/highestSale branches below can
  // filter their own id pools without a per-item Deeptide fetch just to
  // learn each one's number.
  const numberRange = params.get('numberRange');
  let editionIdSetPromise = null;
  function idsInEditionRange() {
    if (!editionIdSetPromise) {
      editionIdSetPromise = getPigeonNumberMap(env.coin).then(map => {
        const set = new Set();
        for (const numStr of Object.keys(map)) {
          const n = parseInt(numStr, 10);
          if (numberRange === 'low' ? n <= PIGEON_LOW_EDITION_MAX : n > PIGEON_LOW_EDITION_MAX) set.add(map[numStr]);
        }
        return set;
      });
    }
    return editionIdSetPromise;
  }
  // Deeptide already filters server-side once a `traits` param is passed,
  // so this just scans its own listings feed collecting every matching
  // item — no per-item guessing needed. Bounded the same way the edition-
  // range scan below already is (10 pages of 60 = 600 items): an honest
  // limitation for a trait combo with more real matches than that, same
  // trade-off already accepted elsewhere in this file (see crossListing's
  // own comment) — a correct sort over a bounded set beats an incorrect
  // one over the whole collection.
  const FILTERED_SCAN_CAP_ITEMS = 600;
  async function scanFilteredCandidates(traitFilters) {
    const perPage = 60;
    let skip = 0;
    const items = [];
    let exhausted = false;
    while (items.length < FILTERED_SCAN_CAP_ITEMS) {
      const page = await fetchDeeptideListings({ skip, limit: perPage, sort: 'rarity-asc', traits: traitFilters, shopSlug: coll.shopSlug });
      if (!page.items.length) { exhausted = true; break; }
      items.push(...page.items);
      skip += page.items.length;
      if (!page.hasMore) { exhausted = true; break; }
    }
    return { items, exhausted };
  }

  // Σκύλλα SWAP LISTED filter — only Pigeons actually listed through this
  // system (see getSwapListingsMap), sorted by real $PIGEONS price. Served
  // directly from the KV index (fast, no XRPL calls on the request path) —
  // an earlier version live-verified every item on every page load via a
  // blocking Promise.all, which was hammering xrplcluster.com with up to
  // 60 concurrent calls per page and triggering its rate limit (confirmed
  // live: it returns a plain-text "Rate limit..." body under burst load,
  // which briefly broke listings entirely). Real safety doesn't depend on
  // this endpoint anyway — BUY and DELIST both re-verify fresh against
  // nft_sell_offers at prepare AND payload time, right before anything is
  // ever signed, so no money can move on stale display data here. This
  // still self-heals: a small sample of the current page is re-checked in
  // the background (non-blocking) and pruned if actually gone, on top of
  // the sync that already happens whenever a listing's own owner views MY
  // PIGEONS (swap-listing-owned.js).
  const scyllaListed = params.get('scyllaListed');
  if (scyllaListed === '1') {
    const limit = Math.min(60, Math.max(1, parseInt(params.get('limit') || '36', 10) || 36));
    const skip = Math.max(0, parseInt(params.get('skip') || '0', 10) || 0);
    const asc = params.get('dir') !== 'desc';
    // scyllaListingsMap carries no trait data of its own — a trait filter
    // (previously ignored entirely here) means first learning the real
    // set of matching nftIds, then restricting to that. If none of the
    // currently-listed Pigeons carry the trait, idPool ends up empty and
    // this correctly returns zero results instead of silently showing
    // every listing.
    let idPool = Object.keys(scyllaListingsMap);
    if (filters.length) {
      const scan = await scanFilteredCandidates(filters);
      const matchSet = new Set(scan.items.map(it => it.nftId));
      idPool = idPool.filter(id => matchSet.has(id));
    }
    if (numberRange === 'low' || numberRange === 'high') {
      const editionSet = await idsInEditionRange();
      idPool = idPool.filter(id => editionSet.has(id));
    }
    const sortedIds = idPool.sort((a, b) => {
      const av = parseFloat(scyllaListingsMap[a].price) || 0;
      const bv = parseFloat(scyllaListingsMap[b].price) || 0;
      return asc ? av - bv : bv - av;
    });
    const pageIds = sortedIds.slice(skip, skip + limit);
    const resolved = await mapWithConcurrency(pageIds, 15, id => fetchDeeptideNftDetailCached(context, id));
    const items = resolved.filter(Boolean).map(it => toItem(it.nftId, it, undefined, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency));

    // Deeptide's own current-owner field, reused from the detail fetch
    // above (no extra request) — lets the background self-heal below catch
    // a listing whose NFT has since changed hands even when the ORIGINAL
    // seller's sell offer is still technically present on-ledger. XRPL
    // never auto-cancels a seller's old NFTokenCreateOffer just because
    // the NFT later changed hands (see findPigeonsOffer's own excludeOwner
    // comment) — that stale-but-present offer used to pass the
    // offerId-still-there check below forever, leaving a Pigeon showing as
    // LISTED that could never actually be bought (BUY correctly refuses
    // it, since only the real current owner's offer is acceptable, but the
    // index never learned to stop advertising it).
    const currentOwnerById = {};
    resolved.forEach(it => { if (it) currentOwnerById[it.nftId] = it.owner; });

    const BACKGROUND_VERIFY_SAMPLE = 5;
    context.waitUntil((async () => {
      for (const id of pageIds.slice(0, BACKGROUND_VERIFY_SAMPLE)) {
        const entry = scyllaListingsMap[id];
        if (!entry) continue;
        const currentOwner = currentOwnerById[id];
        if (currentOwner && entry.seller && currentOwner !== entry.seller) {
          await removeSwapListing(env.coin, id);
          continue;
        }
        // null means the lookup itself failed (rate-limited, network
        // error) — must NOT be treated as "confirmed gone," or a
        // transient blip wrongly deletes a real, still-live listing from
        // the index. Confirmed live: this exact bug was silently pruning
        // real listings every time this background check happened to
        // hit xrplcluster.com's rate limit. Only an actual, successfully
        // fetched offer list missing this offerId counts as genuinely
        // delisted. Match the exact recorded offer, not just "any offer
        // by this owner" — the same owner can have an unrelated (e.g.
        // XRP) offer live on the same NFT.
        const offers = await fetchNftSellOffersOrNull(id);
        if (offers !== null && !offers.some(o => o.nft_offer_index === entry.offerId)) {
          await removeSwapListing(env.coin, id);
        }
      }
    })());

    await attachListings(env.coin, items, LISTINGS_ENRICH_CAP_LOW);

    return json({
      items,
      total: sortedIds.length,
      hasMore: skip + pageIds.length < sortedIds.length,
      skip: skip + pageIds.length,
      limit,
      collectionSizeApprox: coll.sizeApprox
    });
  }

  // Sort by highest-ever OR average sale price — exact (not scanned/
  // approximate), since the highSaleMap is already the complete
  // authoritative index once built, and (as of the totalDrops/count
  // fields added alongside the max) already has everything needed for a
  // real average too, from the same crawl. One detail fetch per item on
  // the requested page only (up to the page limit), same cost shape as
  // the edition scan above.
  if (params.get('highestSale') === '1') {
    const limit = Math.min(60, Math.max(1, parseInt(params.get('limit') || '36', 10) || 36));
    const skip = Math.max(0, parseInt(params.get('skip') || '0', 10) || 0);
    const asc = params.get('dir') === 'asc';
    const metricParam = params.get('metric');
    // 'avg_pigeons' sorts Σκύλλα's own real $PIGEONS sale log
    // (pigeonsSalesMap) instead of the XRP highSaleMap crawl — a genuinely
    // separate figure, not a currency conversion of the XRP average.
    const usePigeons = metricParam === 'avg_pigeons';
    const sourceMap = usePigeons ? pigeonsSalesMap : highSaleMap;
    const byAverage = metricParam === 'avg' || usePigeons;
    const metricOf = id => usePigeons
      ? (sourceMap[id].count ? sourceMap[id].total / sourceMap[id].count : sourceMap[id].highest)
      : (byAverage
          ? (sourceMap[id].count ? sourceMap[id].totalDrops / sourceMap[id].count : sourceMap[id].drops)
          : sourceMap[id].drops);
    // highSaleMap/pigeonsSalesMap carry no trait data of their own — a
    // trait filter here means first learning the real set of matching
    // nftIds (scanFilteredCandidates), then restricting to that.
    let idPool = Object.keys(sourceMap);
    if (filters.length) {
      const scan = await scanFilteredCandidates(filters);
      const matchSet = new Set(scan.items.map(it => it.nftId));
      idPool = idPool.filter(id => matchSet.has(id));
    }
    if (numberRange === 'low' || numberRange === 'high') {
      const editionSet = await idsInEditionRange();
      idPool = idPool.filter(id => editionSet.has(id));
    }
    const sortedIds = idPool.sort((a, b) => asc ? metricOf(a) - metricOf(b) : metricOf(b) - metricOf(a));
    const pageIds = sortedIds.slice(skip, skip + limit);
    const resolved = await mapWithConcurrency(pageIds, 15, id => fetchDeeptideNftDetailCached(context, id));
    const items = resolved.filter(Boolean).map(it => toItem(it.nftId, it, undefined, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency));
    await attachListings(env.coin, items, LISTINGS_ENRICH_CAP_LOW);
    return json({
      items,
      total: sortedIds.length,
      hasMore: skip + pageIds.length < sortedIds.length,
      skip,
      limit,
      collectionSizeApprox: coll.sizeApprox
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
  if (numberRange === 'low' || numberRange === 'high') {
    const limit = Math.min(60, Math.max(1, parseInt(params.get('limit') || '36', 10) || 36));

    // Numeric order within a range starts from a direct slice of the
    // (complete) number map restricted to that range — trait filters
    // (previously ignored here entirely, same bug as the plain numericOrder
    // branch above) restrict it further via the shared scan/intersect.
    const numericOrder = params.get('numericOrder');
    if (numericOrder === 'asc' || numericOrder === 'desc') {
      const skip = Math.max(0, parseInt(params.get('skip') || '0', 10) || 0);
      const map = await getPigeonNumberMap(env.coin);
      let nums = Object.keys(map)
        .map(n => parseInt(n, 10))
        .filter(n => numberRange === 'low' ? n <= PIGEON_LOW_EDITION_MAX : n > PIGEON_LOW_EDITION_MAX);
      let total = numberRange === 'low' ? PIGEON_LOW_EDITION_MAX : (PIGEON_COLLECTION_SIZE_APPROX - PIGEON_LOW_EDITION_MAX);
      if (filters.length) {
        const scan = await scanFilteredCandidates(filters);
        const matchSet = new Set(scan.items.map(it => it.nftId));
        nums = nums.filter(n => matchSet.has(map[n]));
        total = nums.length; // real total beyond the scan cap unknown — same honest limitation as scanFilteredCandidates itself
      }
      nums.sort((a, b) => numericOrder === 'asc' ? a - b : b - a);
      const pageNums = nums.slice(skip, skip + limit);
      const resolved = await mapWithConcurrency(pageNums, 15, n => fetchDeeptideNftDetailCached(context, map[n]));
      const items = resolved.filter(Boolean).map(it => toItem(it.nftId, it, undefined, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency));
      await attachListings(env.coin, items, LISTINGS_ENRICH_CAP_LOW);
      return json({
        items,
        total,
        hasMore: skip + pageNums.length < nums.length,
        skip: skip + pageNums.length,
        limit,
        collectionSizeApprox: coll.sizeApprox
      });
    }

    const underlyingSort = SORT_MAP[params.get('sort')] || 'rarity-asc';
    let cursor = Math.max(0, parseInt(params.get('rawSkip') || '0', 10) || 0);
    const matched = [];
    let exhausted = false;
    let rawPagesScanned = 0;
    while (matched.length < limit && rawPagesScanned < 10) {
      const page = await fetchDeeptideListings({ skip: cursor, limit: 60, sort: underlyingSort, traits: filters, shopSlug: coll.shopSlug });
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
    const items = matched.map(it => toItem(it.nftId, it, undefined, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency));
    await attachListings(env.coin, items);
    return json({
      items,
      total: numberRange === 'low' ? PIGEON_LOW_EDITION_MAX : (PIGEON_COLLECTION_SIZE_APPROX - PIGEON_LOW_EDITION_MAX),
      hasMore: !exhausted,
      rawSkip: cursor,
      skip: cursor,
      limit,
      collectionSizeApprox: coll.sizeApprox
    });
  }

  // True numeric Pigeon-number order (1, 2, 3...) — Deeptide's own
  // "name-asc"/"name-desc" sort the display NAME as a string ("PIGEONS1",
  // "PIGEONS10", "PIGEONS100"... before "PIGEONS2" — confirmed live), not
  // the number. Direct slice of the complete number map, no scan needed.
  const numericOrder = params.get('numericOrder');
  if (numericOrder === 'asc' || numericOrder === 'desc') {
    const limit = Math.min(60, Math.max(1, parseInt(params.get('limit') || '36', 10) || 36));
    const skip = Math.max(0, parseInt(params.get('skip') || '0', 10) || 0);
    const map = await getPigeonNumberMap(env.coin);
    let nums = Object.keys(map).map(n => parseInt(n, 10));
    let total = nums.length;
    // The number map carries no trait data — a trait filter (previously
    // ignored entirely here) means first learning the real set of
    // matching nftIds via the shared scan, then restricting to that.
    if (filters.length) {
      const scan = await scanFilteredCandidates(filters);
      const matchSet = new Set(scan.items.map(it => it.nftId));
      nums = nums.filter(n => matchSet.has(map[n]));
      total = nums.length; // real total beyond the scan cap unknown — same honest limitation as scanFilteredCandidates itself
    }
    nums.sort((a, b) => numericOrder === 'asc' ? a - b : b - a);
    const pageNums = nums.slice(skip, skip + limit);
    const resolved = await mapWithConcurrency(pageNums, 15, n => fetchDeeptideNftDetailCached(context, map[n]));
    const items = resolved.filter(Boolean).map(it => toItem(it.nftId, it, undefined, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency));
    await attachListings(env.coin, items, LISTINGS_ENRICH_CAP_LOW);
    return json({
      items,
      total,
      hasMore: skip + pageNums.length < nums.length,
      skip: skip + pageNums.length,
      limit,
      collectionSizeApprox: coll.sizeApprox
    });
  }

  // Real lowest/highest listing across BOTH marketplaces — reads the
  // background-built floor index (see maybeRefreshFloorIndex in
  // _shared.js) instead of scanning Deeptide's own feed live. That old
  // approach only ever cross-checked Deeptide's own cheapest candidates
  // against xrp.cafe, so a Pigeon listed ONLY on xrp.cafe (confirmed live:
  // exactly the site's own real XRP.CAFE FL00R item) could never surface.
  // The floor index is built from real on-ledger nft_sell_offers
  // collection-wide, so it has no such blind spot — this just resolves
  // each candidate's live display data (image/traits/current price) on
  // top of it.
  const crossListing = params.get('crossListing');
  if (crossListing === 'asc' || crossListing === 'desc') {
    const skip = Math.max(0, parseInt(params.get('skip') || '0', 10) || 0);
    if (skip > 0) {
      // Already exhausted the bounded, correctly-sorted set below.
      return json({ items: [], total: 0, hasMore: false, skip, limit: 0, collectionSizeApprox: coll.sizeApprox });
    }
    const floorIndex = await getFloorIndex(env.coin);
    let candidates = (floorIndex && floorIndex.items) || [];
    if (numberRange === 'low' || numberRange === 'high') {
      candidates = candidates.filter(c =>
        numberRange === 'low' ? (c.number !== null && c.number <= PIGEON_LOW_EDITION_MAX) : (c.number !== null && c.number > PIGEON_LOW_EDITION_MAX)
      );
    }
    // The floor index carries no trait data of its own — same
    // scanFilteredCandidates restriction the SCYLLA LISTED sort above
    // already applies for the same reason.
    if (filters.length) {
      const scan = await scanFilteredCandidates(filters);
      const matchSet = new Set(scan.items.map(it => it.nftId));
      candidates = candidates.filter(c => matchSet.has(c.nftId));
    }
    const details = await mapWithConcurrency(candidates, 15, c => fetchDeeptideNftDetailCached(context, c.nftId));
    let items = candidates.map((c, i) => toItem(c.nftId, details[i] || { number: c.number, attributes: [], image: null }, undefined, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency));
    await attachListings(env.coin, items, items.length);
    items.forEach(it => {
      const dt = it.listings.deeptide.priceXrp;
      const xc = it.listings.xrpCafe.priceXrp;
      const useXrpCafe = xc !== null && (dt === null || xc < dt);
      it.bestListingXrp = useXrpCafe ? xc : dt;
      it.bestListingSource = useXrpCafe ? 'xrpCafe' : 'deeptide';
    });
    // A floor-index candidate whose real offer was cancelled/accepted
    // since the background scan last ran, and isn't currently showing a
    // price on either marketplace's own live lookup either — drop rather
    // than show an impossible null-priced "lowest" result.
    items = items.filter(it => it.bestListingXrp !== null);
    items.sort((a, b) => crossListing === 'asc' ? a.bestListingXrp - b.bestListingXrp : b.bestListingXrp - a.bestListingXrp);
    return json({
      items,
      total: items.length,
      hasMore: false,
      skip: items.length,
      limit: items.length,
      collectionSizeApprox: coll.sizeApprox
    });
  }

  // Default: the real, complete, live collection — paginated, sorted
  // (rarity by default), optionally AND-filtered by trait. No KV involved.
  const skip = Math.max(0, parseInt(params.get('skip') || '0', 10) || 0);
  const limit = Math.min(60, Math.max(1, parseInt(params.get('limit') || '36', 10) || 36));
  const sort = SORT_MAP[params.get('sort')] || 'rarity-asc';

  const page = await fetchDeeptideListings({ skip, limit, sort, traits: filters, shopSlug: coll.shopSlug });
  const items = page.items.map(it => toItem(it.nftId, it, undefined, highSaleMap, scyllaListingsMap, pigeonsSalesMap, tokenCurrency));
  // attachListings is per-nftId (xrp.cafe's own token lookup), not
  // collection-scoped by anything that needs coll here — safe as-is for
  // every collection, tradeable or not (still useful: it's real
  // marketplace listing data, shown on the card regardless of whether
  // Σκύλλα's own BUY N0W/0FFER apply).
  await attachListings(env.coin, items);

  if (tradeable) {
    context.waitUntil(maybeRefreshPigeonNumberMap(env.coin));
    context.waitUntil(maybeRefreshHighSaleMap(env.coin));
  }

  return json({
    items,
    total: page.total,
    hasMore: page.hasMore,
    skip,
    limit,
    collectionSizeApprox: coll.sizeApprox
  });
}
