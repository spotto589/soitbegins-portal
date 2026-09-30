import { TRADEABLE_COLLECTIONS, POPULAR_COINS_KEY } from '../_shared.js';
import { getCollectionEvents } from '../_ledgerwatch.js';

// H0ME (functions/home.js) — the whole-XRPL overview.
//
// GET /api/home                         NFT + meme coin + ledger totals for all of
//                                       XRPL, the top 10 NFT collections (24h/7d/
//                                       30d/all) and top 10 meme coins (24h vol,
//                                       7d vol, market cap).
// GET /api/home?feed=1                  newest sales/listings/mints/burns/offers
//                                       across the site's own collections (the
//                                       ledger watcher's feed, _ledgerwatch.js).
// GET /api/home?img=nft&slug=<slug>     302 to that collection's cover image.
// GET /api/home?img=token&currency=..&issuer=..&md5=..
//                                       302 to that token's icon.
//
// Whole-XRPL numbers are xrpl.to's (its terms require a visible "Data by
// xrpl.to" link on the page — the home page has one). Nothing here writes
// to KV: every response is edge-cached, stale-while-revalidate, the same
// way pigeons.js serves its collection stats.

const XRPLTO = 'https://api.xrpl.to/v1';
const XRPLTO_HEADERS = { 'User-Agent': 'soitbegins.xyz home', 'Accept': 'application/json' };
const OVERVIEW_FRESH_S = 120;
const FEED_FRESH_S = 20;
const IMG_CACHE_S = 86400;
const FEED_TYPES = ['sale', 'listing', 'mint', 'burn', 'offer'];
const FEED_MAX = 30;

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

// Anonymous calls share one daily allowance across everyone calling from
// Cloudflare, which runs out (429 "Daily limit exceeded") — so production
// needs its own free key, set as the XRPLTO_API_KEY secret on the Pages
// project. 429 isn't retried: a second call would only burn more quota.
function xrplToHeaders(apiKey) {
  return apiKey ? Object.assign({ 'X-Api-Key': apiKey }, XRPLTO_HEADERS) : XRPLTO_HEADERS;
}

async function fetchXrplTo(path, apiKey, retried) {
  try {
    const res = await fetch(XRPLTO + path, { headers: xrplToHeaders(apiKey), signal: AbortSignal.timeout(8000) });
    if (res.status === 429) return null;
    if (!res.ok) return retried ? null : fetchXrplTo(path, apiKey, true);
    const d = await res.json();
    return d && d.success !== false ? d : null;
  } catch (e) {
    return retried ? null : fetchXrplTo(path, apiKey, true);
  }
}

function num(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return typeof n === 'number' && isFinite(n) ? n : null;
}

// issuer:taxon -> our collection key, and token issuer -> our collection
// key (first one wins, so a group's sister collections share their
// group's coin).
function ourIndexes() {
  const nfts = {};
  const tokens = {};
  Object.keys(TRADEABLE_COLLECTIONS).forEach(key => {
    const c = TRADEABLE_COLLECTIONS[key];
    if (c.nftIssuer && c.nftTaxon !== null && c.nftTaxon !== undefined) nfts[c.nftIssuer + ':' + c.nftTaxon] = key;
    const tc = c.tokenConfig;
    if (tc && tc.issuer && tc.currency && !tokens[tc.issuer]) tokens[tc.issuer] = key;
  });
  return { nfts, tokens };
}

const NFT_RANGES = {
  '24h': { sort: 'vol24h', vol: 'vol24h', sales: 'sales24h', floorPct: 'floor1dPercent', lightweight: true },
  '7d': { sort: 'vol7d', vol: 'vol7d', sales: 'sales7d', floorPct: 'floor7dPercent', lightweight: true },
  '30d': { sort: 'vol30d', vol: 'vol30d', sales: 'sales30d', floorPct: 'floor30dPercent', lightweight: true },
  // Lifetime totals only come back on the full (non-lightweight) shape.
  'all': { sort: 'totalVolume', vol: 'totalVolume', sales: 'totalSales', floorPct: null, lightweight: false }
};

function shapeCollection(c, range, ours) {
  const r = NFT_RANGES[range];
  const issuer = c.issuer || c.account || null;
  return {
    name: c.name || c.slug,
    slug: c.slug,
    ours: issuer && c.taxon !== undefined ? (ours[issuer + ':' + c.taxon] || null) : null,
    hasLogo: !!c.logoImage,
    volumeXrp: num(c[r.vol]),
    sales: num(c[r.sales]),
    floorXrp: num(c.floor),
    floorChangePct: r.floorPct ? num(c[r.floorPct]) : null,
    owners: num(c.owners),
    items: num(c.items)
  };
}

function shapeToken(t, xrpUsd, ours, popular) {
  const mcap = num(t.marketcap);
  return {
    name: t.name || t.currency,
    currency: t.currency,
    issuer: t.issuer,
    md5: t.md5,
    slug: t.slug || t.md5,
    ours: ours[t.issuer] || null,
    popular: !!popular[t.md5],
    priceUsd: num(t.usd),
    change24hPct: num(t.pro24h),
    change7dPct: num(t.pro7d),
    volume24hXrp: num(t.vol24hxrp),
    volume7dXrp: num(t.vol7dxrp),
    marketCapXrp: mcap,
    marketCapUsd: mcap !== null && xrpUsd ? mcap * xrpUsd : null,
    holders: num(t.holders)
  };
}

async function buildOverview(env) {
  const idx = ourIndexes();
  const popularRaw = env.coin ? await env.coin.get(POPULAR_COINS_KEY).catch(() => null) : null;
  const popular = {};
  try { ((JSON.parse(popularRaw || 'null') || {}).coins || []).forEach(c => { if (c.md5) popular[c.md5] = true; }); } catch (e) {}

  const key = env.XRPLTO_API_KEY || null;
  const memeList = sortBy => fetchXrplTo('/tokens?start=0&limit=10&sortBy=' + sortBy + '&sortType=desc&tag=memes', key);
  const nftList = range => fetchXrplTo('/nft/collections?limit=10&sort=' + NFT_RANGES[range].sort + '&order=desc&skip_metrics=true' + (NFT_RANGES[range].lightweight ? '&lightweight=true' : ''), key);
  const [nftGlobal, memeVol24, memeVol7, memeMcap, n24, n7, n30, nAll] = await Promise.all([
    fetchXrplTo('/nft/stats/global', key),
    memeList('vol24hxrp'), memeList('vol7dxrp'), memeList('marketcap'),
    nftList('24h'), nftList('7d'), nftList('30d'), nftList('all')
  ]);

  const exchUsd = memeVol24 && memeVol24.exch ? num(memeVol24.exch.USD) : null;
  const xrpUsd = exchUsd ? 1 / exchUsd : null;

  let nft = null;
  if (nftGlobal) {
    const g = nftGlobal;
    const agg = g.aggregates || {};
    const pct = g.percentChanges || {};
    const a7 = agg['7d'] || {}, a30 = agg['30d'] || {}, aAll = agg.all || {};
    nft = {
      totalCollections: num(g.totalCollections),
      totalTraders: num(g.totalTraders),
      ranges: {
        // Rolling 24h — xrpl.to's own headline figures (aggregates['24h']
        // is the calendar day so far, a much smaller number).
        '24h': { volumeXrp: num(g.total24hVolume), sales: num(g.total24hSales), mints: num(g.total24hMints), burns: num(g.total24hBurns),
                 traders: num(g.activeTraders24h), collections: num(g.activeCollections24h), volumeChangePct: num(g.volumePct) },
        '7d': { volumeXrp: num(a7.volume), sales: num(a7.sales), mints: num(a7.mints), burns: num(a7.burns),
                traders: num(g.activeTraders7d), collections: num(a7.uniqueCollections), volumeChangePct: num(pct.volume7dPct) },
        '30d': { volumeXrp: num(a30.volume), sales: num(a30.sales), mints: num(a30.mints), burns: num(a30.burns),
                 traders: num(g.activeTraders30d), collections: num(a30.uniqueCollections), volumeChangePct: num(pct.volume30dPct) },
        'all': { volumeXrp: num(g.totalVolume), sales: num(g.totalSales), mints: num(aAll.mints), burns: num(aAll.burns),
                 traders: num(g.totalTraders), collections: num(g.totalCollections), volumeChangePct: null }
      }
    };
  }

  let meme = null;
  if (memeVol24 && memeVol24.tagMetrics) {
    const m = memeVol24.tagMetrics;
    meme = {
      count: num(m.count),
      volume24hXrp: num(m.vol24hxrp),
      marketCapXrp: num(m.marketcap),
      marketCapUsd: num(m.marketcap) !== null && xrpUsd ? num(m.marketcap) * xrpUsd : null,
      liquidityXrp: num(m.tvl),
      gainers24h: num(m.gainers),
      losers24h: num(m.losers),
      volumeChangePct: memeVol24.global ? num(memeVol24.global.gMemeVolumePro) : null
    };
  }

  let ledger = null;
  if (memeVol24 && memeVol24.H24 && memeVol24.global) {
    const h = memeVol24.H24, gl = memeVol24.global;
    ledger = {
      transactions24h: num(h.transactions24H),
      transactionsChangePct: num(h.transactions24HPro),
      activeAddresses24h: num(h.activeAddresses24H),
      uniqueTraders24h: num(h.uniqueTraders24H),
      tokensTraded24h: num(h.tradedTokens24H),
      dexVolume24hXrp: num(gl.gDexVolume),
      ammPoolsCreated24h: num(h.globalAmmCreate24htx),
      totalAccounts: num(gl.totalAddresses),
      totalTrustLines: num(gl.totalTrustLines)
    };
  }

  const topNfts = {};
  [['24h', n24], ['7d', n7], ['30d', n30], ['all', nAll]].forEach(([range, d]) => {
    topNfts[range] = d && Array.isArray(d.collections) ? d.collections.slice(0, 10).map(c => shapeCollection(c, range, idx.nfts)) : null;
  });
  const topCoins = {};
  [['vol24h', memeVol24], ['vol7d', memeVol7], ['marketcap', memeMcap]].forEach(([k, d]) => {
    topCoins[k] = d && Array.isArray(d.tokens) ? d.tokens.slice(0, 10).map(t => shapeToken(t, xrpUsd, idx.tokens, popular)) : null;
  });

  return { updatedAt: Date.now(), xrpUsd, nft, meme, ledger, topNfts, topCoins };
}

// Newest events across every one of the site's collections. Groups (the
// ALL views) have no feed of their own — their members do.
async function buildFeed(env) {
  if (!env.coin) return { items: [] };
  const keys = Object.keys(TRADEABLE_COLLECTIONS);
  const lists = await Promise.all(keys.map(k => getCollectionEvents(env.coin, k).catch(() => [])));
  const items = [];
  lists.forEach((list, i) => (list || []).forEach(e => {
    if (FEED_TYPES.indexOf(e.type) === -1) return;
    items.push({ type: e.type, collection: e.collection || keys[i], number: e.number || null, nftId: e.nftId || null, price: e.price || null, time: e.time || null, hash: e.hash || null });
  }));
  items.sort((a, b) => (b.time || 0) - (a.time || 0));
  return { items: items.slice(0, FEED_MAX), now: Math.floor(Date.now() / 1000) };
}

// Serve a cached JSON body at once; rebuild in the background once it's
// older than freshS. First-ever request builds inline.
// isPartial(body): a body missing a section is still served, but counts
// as stale ~15s later so an upstream blip doesn't stick for freshS.
async function cachedJson(context, name, freshS, build, isPartial) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request('https://soitbegins.xyz/__cache/home/v1/' + name);
  const put = body => {
    const builtAt = isPartial && isPartial(body) ? Date.now() - Math.max(0, freshS - 15) * 1000 : Date.now();
    const res = new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400', 'X-Built-At': String(builtAt) } });
    if (cache) context.waitUntil(cache.put(key, res.clone()));
    return res;
  };
  const hit = cache ? await cache.match(key) : null;
  if (hit) {
    const builtAt = Number(hit.headers.get('X-Built-At')) || 0;
    if (Date.now() - builtAt > freshS * 1000) context.waitUntil(build().then(put).catch(() => {}));
    return new Response(hit.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  }
  const fresh = put(await build());
  return new Response(fresh.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

// Cover images: xrp.cafe's collection record (the same API pigeons.js
// reads stats from), looked up by the collection's slug, which xrpl.to
// shares with xrp.cafe for collections that launched there. Token icons:
// xrplmeta (what the C0!NS list uses), falling back to xrpl.to's own.
async function imageRedirect(context, params) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const kind = params.get('img');
  let cacheId, lookup;
  if (kind === 'nft') {
    const slug = params.get('slug') || '';
    if (!/^[a-z0-9-]{1,80}$/i.test(slug)) return new Response('Bad request', { status: 400 });
    cacheId = 'nft/' + slug;
    lookup = async () => {
      const res = await fetch('https://api.xrp.cafe/api/collection/' + encodeURIComponent(slug), { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return null;
      const arr = await res.json();
      const img = Array.isArray(arr) && arr[0] ? arr[0].collection_img : null;
      return typeof img === 'string' && /^https:\/\//.test(img) ? img : null;
    };
  } else if (kind === 'token') {
    const currency = params.get('currency') || '', issuer = params.get('issuer') || '', md5 = params.get('md5') || '';
    if (!/^[A-Za-z0-9?!@#$%^&*<>(){}[\]|]{3}$|^[0-9A-F]{40}$/.test(currency) || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(issuer) || !/^[0-9a-f]{32}$/.test(md5)) {
      return new Response('Bad request', { status: 400 });
    }
    cacheId = 'token/' + md5;
    lookup = async () => {
      try {
        const res = await fetch('https://s1.xrplmeta.org/token/' + currency + ':' + issuer, { headers: XRPLTO_HEADERS, signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const d = await res.json();
          const icon = d && d.meta && d.meta.token && d.meta.token.icon;
          if (typeof icon === 'string' && /^https:\/\//.test(icon)) return icon;
        }
      } catch (e) {}
      return 'https://s1.xrpl.to/token/' + md5 + '.webp';
    };
  } else {
    return new Response('Bad request', { status: 400 });
  }

  const key = new Request('https://soitbegins.xyz/__cache/home-img/v1/' + cacheId);
  const hit = cache ? await cache.match(key) : null;
  if (hit) return hit;
  let target = null;
  try { target = await lookup(); } catch (e) { target = null; }
  const res = target
    ? new Response(null, { status: 302, headers: { 'Location': target, 'Cache-Control': 'public, max-age=' + IMG_CACHE_S } })
    : new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, max-age=3600' } });
  if (cache) context.waitUntil(cache.put(key, res.clone()));
  return res;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const params = new URL(request.url).searchParams;
  if (params.get('img')) return imageRedirect(context, params);
  // Upstream reachability check: status + first bytes of one xrpl.to call.
  if (params.get('probe') === '1') {
    try {
      const res = await fetch(XRPLTO + '/nft/stats/global', { headers: xrplToHeaders(env.XRPLTO_API_KEY), signal: AbortSignal.timeout(8000) });
      const text = await res.text();
      return json({ status: res.status, keySet: !!env.XRPLTO_API_KEY, body: text.slice(0, 300) });
    } catch (e) {
      return json({ error: String(e && e.message || e) });
    }
  }
  if (params.get('feed') === '1') return cachedJson(context, 'feed', FEED_FRESH_S, () => buildFeed(env));
  return cachedJson(context, 'overview', OVERVIEW_FRESH_S, () => buildOverview(env),
    b => !b.nft || !b.meme || !b.ledger || Object.values(b.topNfts).some(v => !v) || Object.values(b.topCoins).some(v => !v));
}
