// H0NEYP0T in the DATABASE (2026-10-02) — a stand-in for Deeptide.
// Every other collection's browse/traits/detail/owned data comes from its
// Deeptide shop; Honeypot isn't on Deeptide (its "soitbegins" shop is
// empty), so the six Deeptide calls in _shared.js (fetchDeeptideListings,
// fetchDeeptideTraitCards, fetchDeeptideNftDetail, fetchDeeptideNftHistory,
// fetchDeeptideOwnedPigeons, fetchDeeptideSalesHistory) ask this file first
// and get answers in Deeptide's own shape, built from the ledger:
//   - assets/honeypot/snapshot.json (bundled): every NFT's metadata
//   - Clio nfts_by_issuer (live, 60s per isolate): owners, burns, new mints
//   - Clio nft_history: per-NFT mint/sale/transfer events
// One issuer + taxon holds three kinds of NFT, so the collection is split
// into three "shops" by name: Honeypots (plus one-offs like Sweet Honey),
// Ashes and Phoenixes. Burned NFTs are left out — they're on /honeypot/burns.
import snapshot from '../assets/honeypot/snapshot.json';
// Web-sized copies of every picture (scripts/honeypot-images.py) —
// Phoenix originals are 3844px / up to 10 MB, too heavy to proxy per card.
import siteImages from '../assets/honeypot/images.json';
import { HONEYPOT_ISSUER, HONEYPOT_ISSUER_HEX, HONEYPOT_TAXON, honeypotKind, canonicalIpfs } from './_honeypot.js';

// shop slug -> which kinds it holds
export const LEDGER_SHOPS = {
  'scylla-honeypot': ['honeypot', 'other'],
  'scylla-honeypot-ash': ['ash'],
  'scylla-honeypot-phoenix': ['phoenix'],
};
export function isLedgerShop(shopSlug) {
  return Object.prototype.hasOwnProperty.call(LEDGER_SHOPS, shopSlug);
}

// Same Clio servers the rest of the site uses — default port only (a
// published Worker ignores custom HTTPS ports like :51234).
const CLIO_ENDPOINTS = ['https://s2-clio.ripple.com', 'https://s1.ripple.com/'];
const IPFS_GATEWAYS = ['https://ipfs.filebase.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/'];
const IMAGE_PROXY = 'https://soitbegins.xyz/api/ipfs-image?src=';
const LIVE_TTL_MS = 60 * 1000;

// NFTokenID = flags(4) fee(4) issuer(40) scrambledTaxon(8) sequence(8)
function taxonOf(id) {
  const seq = parseInt(id.slice(56, 64), 16) >>> 0;
  const scrambled = parseInt(id.slice(48, 56), 16) >>> 0;
  return (scrambled ^ ((Math.imul(384160001, seq) + 2459) >>> 0)) >>> 0;
}
function serialOf(id) { return parseInt(id.slice(56, 64), 16) >>> 0; }
export function isHoneypotNftId(id) {
  return typeof id === 'string' && id.length === 64 && id.slice(8, 48).toUpperCase() === HONEYPOT_ISSUER_HEX && taxonOf(id) === HONEYPOT_TAXON;
}

const liveMeta = {}; // uri -> {name, attributes, image} for mints newer than the snapshot
function metaForUri(uri) { return snapshot.meta[uri] || liveMeta[uri] || null; }
const uriById = Object.assign({}, snapshot.nfts);

// 'honeypot' | 'ash' | 'phoenix' | 'other', or null if not ours / not known yet.
export function honeypotKindOfId(id) {
  if (!isHoneypotNftId(id)) return null;
  const m = metaForUri(uriById[id.toUpperCase()] || uriById[id]);
  return m ? honeypotKind(m.name).kind : null;
}
export function ledgerShopOfId(id) {
  const kind = honeypotKindOfId(id);
  if (!kind) return null;
  return Object.keys(LEDGER_SHOPS).find(s => LEDGER_SHOPS[s].includes(kind)) || null;
}

async function clio(method, params) {
  for (const endpoint of CLIO_ENDPOINTS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, params: [params] }) });
        const data = await res.json();
        if (data && data.result && data.result.status === 'success') return data.result;
      } catch (e) {}
    }
  }
  return null;
}

async function fetchMeta(uri) {
  const m = /^https:\/\/ipfs\.io\/ipfs\/(.+)$/.exec(uri || '');
  const targets = m ? IPFS_GATEWAYS.map(g => g + m[1]) : (uri ? [uri] : []);
  for (const t of targets) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(t, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
      if (!res.ok) continue;
      const j = await res.json();
      return { name: j.name || '', attributes: Array.isArray(j.attributes) ? j.attributes.map(a => [a.trait_type, a.value]) : [], image: canonicalIpfs(j.image || '') };
    } catch (e) {}
  }
  return null;
}

// Live owners for every unburned NFT, from Clio. Falls back to the
// snapshot's list (owners unknown) if Clio can't be reached.
let live = null;
let liveLoading = null;
async function liveNfts() {
  if (live && Date.now() - live.at < LIVE_TTL_MS) return live;
  if (liveLoading) return liveLoading;
  liveLoading = (async () => {
    const nfts = [];
    let marker, ok = true;
    do {
      const res = await clio('nfts_by_issuer', { issuer: HONEYPOT_ISSUER, nft_taxon: HONEYPOT_TAXON, limit: 400, ...(marker ? { marker } : {}) });
      if (!res) { ok = false; break; }
      nfts.push(...res.nfts);
      marker = res.marker;
    } while (marker);
    if (!ok) {
      const burned = new Set(snapshot.burns.map(b => b.id));
      return (live = { at: Date.now() - LIVE_TTL_MS + 10000, items: Object.keys(snapshot.nfts).filter(id => !burned.has(id)).map(id => ({ id, owner: null })) });
    }
    const newOnes = [];
    for (const n of nfts) {
      if (uriById[n.nft_id] === undefined) {
        uriById[n.nft_id] = canonicalIpfs(n.uri ? hexToUtf8(n.uri) : '');
        newOnes.push(uriById[n.nft_id]);
      }
    }
    // Metadata for anything minted since the snapshot (a handful at most).
    await Promise.all([...new Set(newOnes)].filter(u => u && !metaForUri(u)).slice(0, 12).map(async u => {
      const m = await fetchMeta(u);
      if (m) liveMeta[u] = m;
    }));
    return (live = { at: Date.now(), items: nfts.filter(n => !n.is_burned).map(n => ({ id: n.nft_id, owner: n.owner })) });
  })().finally(() => { liveLoading = null; });
  return liveLoading;
}

function hexToUtf8(hex) {
  const bytes = new Uint8Array((hex.match(/.{1,2}/g) || []).map(b => parseInt(b, 16)));
  return new TextDecoder().decode(bytes);
}

// The site's own copy when there is one, else the IPFS proxy (a mint
// newer than the last images run).
export function imageUrl(ipfsUrl) {
  if (!ipfsUrl) return null;
  return siteImages[ipfsUrl] ? 'https://soitbegins.xyz' + siteImages[ipfsUrl] : IMAGE_PROXY + encodeURIComponent(ipfsUrl);
}

// One shop's live items, with rarity: each item's score is the sum of
// 100 / (% of the shop with that value) over every category, "none"
// included — the same Layer 1 maths as every other collection. Rank 1 =
// rarest; ties go to the lower number.
async function shopItems(shopSlug) {
  const kinds = LEDGER_SHOPS[shopSlug];
  const { items } = await liveNfts();
  const out = [];
  for (const it of items) {
    const m = metaForUri(uriById[it.id]);
    if (!m) continue;
    const k = honeypotKind(m.name);
    if (!kinds.includes(k.kind)) continue;
    out.push({
      id: it.id,
      owner: it.owner,
      name: m.name,
      number: k.kind === 'other' ? null : k.num,
      image: m.image,
      traits: tidyTraits(m.attributes),
      serial: serialOf(it.id),
    });
  }
  const cats = new Set();
  out.forEach(it => it.traits.forEach(t => cats.add(t.trait_type)));
  const counts = {};
  cats.forEach(c => { counts[c] = {}; });
  out.forEach(it => cats.forEach(c => {
    const t = it.traits.find(x => x.trait_type === c);
    const v = t ? t.value : '__no_trait__';
    counts[c][v] = (counts[c][v] || 0) + 1;
  }));
  const n = out.length;
  out.forEach(it => {
    let score = 0;
    cats.forEach(c => {
      const t = it.traits.find(x => x.trait_type === c);
      score += 100 / (counts[c][t ? t.value : '__no_trait__'] / n * 100);
    });
    it.score = score;
  });
  const ranked = out.slice().sort((a, b) => (b.score - a.score) || ((a.number ?? 1e9) - (b.number ?? 1e9)));
  ranked.forEach((it, i) => { it.rarityRank = i + 1; it.rarityTotal = n; });
  return { items: out, counts, cats: Array.from(cats), total: n };
}

// Ash metadata lists "Type" twice — "Ash" and, for King burns, "Boiling
// Point 0.99" / "Boiling Point 4.99". One value per category, so the second
// becomes its own Boiling Point trait (0.99 / 4.99); any other repeated
// category gets a numbered name (Type 2).
function tidyTraits(attributes) {
  const out = [];
  const seen = {};
  for (const [rawType, rawValue] of attributes) {
    if (!rawType || rawValue === undefined || rawValue === null || rawValue === '') continue;
    let type = String(rawType), value = String(rawValue);
    const bp = /^Boiling Point\s+(.+)$/i.exec(value);
    if (bp) { type = 'Boiling Point'; value = bp[1]; }
    seen[type] = (seen[type] || 0) + 1;
    if (seen[type] > 1) type = type + ' ' + seen[type];
    out.push({ trait_type: type, value });
  }
  return out;
}

function toListing(it, shopSlug) {
  return {
    shopSlug,
    nftTokenId: it.id,
    name: it.name,
    number: it.number,
    traits: it.traits,
    imageUrl: imageUrl(it.image),
    currentOwner: it.owner,
    rarityRank: it.rarityRank,
    rarityTotal: it.rarityTotal,
    lowestSellDrops: null,
  };
}

// /api/mint/listings/<shop>?skip&limit&sort&traits
export async function ledgerListings(shopSlug, { skip = 0, limit = 36, sort = 'rarity-asc', traits } = {}) {
  const { items } = await shopItems(shopSlug);
  let list = items;
  if (traits && traits.length) {
    list = list.filter(it => traits.every(f => {
      const t = it.traits.find(x => x.trait_type === f.trait);
      return f.value === '__no_trait__' ? !t : !!t && t.value === f.value;
    }));
  }
  const byNum = (a, b) => ((a.number ?? 1e9) - (b.number ?? 1e9)) || a.name.localeCompare(b.name);
  const sorters = {
    'rarity-asc': (a, b) => a.rarityRank - b.rarityRank,
    'rarity-desc': (a, b) => b.rarityRank - a.rarityRank,
    'name-asc': byNum,
    'name-desc': (a, b) => byNum(b, a),
    'date-asc': (a, b) => a.serial - b.serial,
    'date-desc': (a, b) => b.serial - a.serial,
  };
  list = list.slice().sort(sorters[sort] || sorters['rarity-asc']);
  const page = list.slice(skip, skip + limit);
  return { items: page.map(it => toListing(it, shopSlug)), total: list.length, hasMore: skip + page.length < list.length };
}

// /api/mint/listings/<shop>/trait-cards — every value with its count,
// "none" (__no_trait__) included, same as Deeptide's.
export async function ledgerTraitCards(shopSlug) {
  const { items, counts } = await shopItems(shopSlug);
  const traits = [];
  Object.keys(counts).forEach(c => Object.keys(counts[c]).forEach(v => {
    const example = v === '__no_trait__' ? null : items.find(it => it.traits.some(t => t.trait_type === c && t.value === v));
    traits.push({ trait_type: c, value: v, count: counts[c][v], previewImages: example && example.image ? [imageUrl(example.image)] : [] });
  }));
  traits.sort((a, b) => a.count - b.count);
  return { traits, total: traits.length, hasMore: false };
}

// /api/mint/nft/<id> — burned or unknown -> null (Deeptide 404s those too).
export async function ledgerNftDetail(nftId) {
  const shopSlug = ledgerShopOfId(nftId);
  if (!shopSlug) {
    await liveNfts();
    if (!ledgerShopOfId(nftId)) return null;
    return ledgerNftDetail(nftId);
  }
  const { items, counts, total } = await shopItems(shopSlug);
  const it = items.find(x => x.id === nftId);
  if (!it) return null;
  return {
    tokenId: it.id,
    owner: it.owner,
    issuer: HONEYPOT_ISSUER,
    taxon: HONEYPOT_TAXON,
    listing: {
      name: it.name,
      number: it.number,
      imageUrl: imageUrl(it.image),
      shopSlug,
      traits: it.traits.map(t => ({ ...t, count: counts[t.trait_type][t.value], percentage: Math.round(counts[t.trait_type][t.value] / total * 10000) / 100 })),
      rarityRank: it.rarityRank,
      rarityTotal: it.rarityTotal,
    },
    sellOffers: [],
  };
}

// /api/mint/owned?address= — only the Honeypot part; the caller merges.
export async function ledgerOwned(address) {
  const { items } = await liveNfts();
  const mine = items.filter(it => it.owner === address);
  if (!mine.length) return [];
  const out = [];
  for (const shopSlug of Object.keys(LEDGER_SHOPS)) {
    const shop = await shopItems(shopSlug);
    shop.items.forEach(it => { if (it.owner === address) out.push(toListing(it, shopSlug)); });
  }
  return out;
}

// /api/mint/nft/<id>/history, from Clio's nft_history: mint, sale (XRP
// price when the offer was in XRP), transfer, oldest-last like Deeptide.
export async function ledgerNftHistory(nftId) {
  const events = [];
  let marker, pages = 0;
  do {
    const res = await clio('nft_history', { nft_id: nftId, limit: 100, forward: true, ...(marker ? { marker } : {}) });
    if (!res) break;
    for (const t of res.transactions || []) {
      const tx = t.tx || t.tx_json || {};
      const meta = t.meta || {};
      if (meta.TransactionResult !== 'tesSUCCESS') continue;
      const date = tx.date ? (tx.date + 946684800) * 1000 : null;
      const hash = tx.hash || t.hash;
      if (tx.TransactionType === 'NFTokenMint') {
        events.push({ type: 'mint', account: tx.Account, date, hash });
      } else if (tx.TransactionType === 'NFTokenAcceptOffer') {
        const offers = (meta.AffectedNodes || []).map(n => n.DeletedNode).filter(n => n && n.LedgerEntryType === 'NFTokenOffer' && n.FinalFields && n.FinalFields.NFTokenID === nftId).map(n => n.FinalFields);
        const sell = offers.find(o => (o.Flags & 1) === 1);
        const buy = offers.find(o => (o.Flags & 1) === 0);
        const buyer = buy ? buy.Owner : tx.Account;
        const amount = buy ? buy.Amount : sell ? sell.Amount : null;
        const drops = typeof amount === 'string' ? parseInt(amount, 10) : null;
        if (drops === 0 || amount === null) events.push({ type: 'transfer', receiver: buyer, date, hash });
        else events.push({ type: 'sale', buyer, priceDrops: drops !== null ? String(drops) : undefined, date, hash });
      }
    }
    marker = res.marker;
  } while (marker && ++pages < 5);
  return { events: events.reverse() };
}
