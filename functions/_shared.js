export const COOKIE_NAME = 'glitch_access';
export const BOARD_COOKIE_NAME = 'pigeon_session';
export const KINGDOM_COOKIE_NAME = 'kingdom_session';

export const GLITCH_ISSUER = 'rNRo76r8C6c1rMi28AR7CdArtK6r8Zptv7';
export const GLITCH_TAXON = 1;
export const SKYLLA_ISSUER = 'raNypRjrVu98Rp3AYLRhQBDUeJKyyRRV92';
export const SKYLLA_TAXON = 777;
export const KING_ISSUER = 'rKingAa11yp4eCuxVraesW2UAvz5THWNCy';
export const KING_TAXON = 123;
export const HONEYPOT_ISSUER = 'raNypRjrVu98Rp3AYLRhQBDUeJKyyRRV92';
export const HONEYPOT_TAXON = 123589321;
export const PIGEON_ISSUER = 'rpigeoNwEPTN5JGWGQ8MCoa7SpQpz1537v';
export const PIGEON_TAXON = 1;

// STAT!C Vanity Collector's Key — the Deeptide "king" shop (confirmed a
// distinct collection from Kingdom's King NFTs: different issuer, taxon 13
// vs. KING_TAXON 123). Holding one of these is what the Signal Assessment /
// redemption flow gates on.
export const STATIC_VANITY_KEY_ISSUER = 'rKymSQrwRF8DcwEzyAgNLMaaSKYSMfJNDY';
export const STATIC_VANITY_KEY_TAXON = 13;

export function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

export function toBase64Url(bytes) {
  let str = '';
  bytes.forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function signToken(payloadObj, secret) {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return payload + '.' + toBase64Url(new Uint8Array(sig));
}

export async function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify(
    'HMAC', key, fromBase64Url(sigB64), new TextEncoder().encode(payloadB64)
  );
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export async function fetchAllAccountNfts(account) {
  let all = [];
  let marker;
  do {
    const params = { account, limit: 400 };
    if (marker) params.marker = marker;
    const res = await fetch('https://xrplcluster.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'account_nfts', params: [params] })
    });
    const data = await res.json();
    const nfts = (data.result && data.result.account_nfts) || [];
    all = all.concat(nfts);
    marker = data.result && data.result.marker;
  } while (marker);
  return all;
}

export function hasAccessKey(nfts) {
  return nfts.some(n =>
    (n.Issuer === GLITCH_ISSUER && n.NFTokenTaxon === GLITCH_TAXON) ||
    (n.Issuer === SKYLLA_ISSUER && n.NFTokenTaxon === SKYLLA_TAXON)
  );
}

// Mainframe gate: GL!TCH key specifically, not Scylla. The entry point is
// framed as a normal Scylla scan — this is the check that quietly decides
// whether that scan actually "hacks" through.
export function hasGlitchKey(nfts) {
  return nfts.some(n => n.Issuer === GLITCH_ISSUER && n.NFTokenTaxon === GLITCH_TAXON);
}

export function findKingNft(nfts) {
  return nfts.find(n => n.Issuer === KING_ISSUER && n.NFTokenTaxon === KING_TAXON) || null;
}

export function findAllKingNfts(nfts) {
  return nfts.filter(n => n.Issuer === KING_ISSUER && n.NFTokenTaxon === KING_TAXON);
}

export function findAllHoneypots(nfts) {
  return nfts.filter(n => n.Issuer === HONEYPOT_ISSUER && n.NFTokenTaxon === HONEYPOT_TAXON);
}

export function findHoneypot(nfts) {
  return nfts.find(n => n.Issuer === HONEYPOT_ISSUER && n.NFTokenTaxon === HONEYPOT_TAXON) || null;
}

// Kingdom Phase 1 — Green and Yellow NFT collections have not been provided
// yet. Left null on purpose: findAll*() returns [] (never matches) until
// real issuer/taxon values are filled in, so nothing breaks in the meantime.
export const GREEN_ISSUER = null;
export const GREEN_TAXON = null;
export const YELLOW_ISSUER = null;
export const YELLOW_TAXON = null;

export function findAllGreenNfts(nfts) {
  if (!GREEN_ISSUER) return [];
  return nfts.filter(n => n.Issuer === GREEN_ISSUER && n.NFTokenTaxon === GREEN_TAXON);
}

export function findAllYellowNfts(nfts) {
  if (!YELLOW_ISSUER) return [];
  return nfts.filter(n => n.Issuer === YELLOW_ISSUER && n.NFTokenTaxon === YELLOW_TAXON);
}

// Kingdom Phase 1 — only $HONEY is live so far (claimable by King holders).
// The rest stay "configured:false" (coming soon) until real token
// identifiers/amounts are provided.
export const KINGDOM_CLAIM_CONFIG = {
  honey: { label: '$HONEY', category: 'K!NG H0LDERS', currency: 'HONEY', issuer: 'rNa4hZ4kfPwEdN5gSbbNr33aSpyF5ZjzDm', amount: null, configured: true },
  beta: { label: 'BETA TEST COIN', category: 'GREEN', currency: null, issuer: null, amount: null, configured: false },
  rlusd: { label: 'RLUSD', category: 'YELLOW', currency: null, issuer: null, amount: null, configured: false },
  crwn: { label: '$CRWN', category: 'KING', currency: null, issuer: null, amount: null, configured: false },
};

// The two Council claimants. Reuses the same external listings already
// established on the mainframe page's Two Kings section rather than
// inventing new placeholder links.
export const KINGDOM_CLAIMANTS = {
  invisible: { id: 'invisible', name: 'THE INVISIBLE KING', marketplace: 'XRP Cafe', url: 'https://xrp.cafe/collection/king' },
  knight: { id: 'knight', name: 'THE KNIGHT KING', marketplace: 'Deeptide', url: 'https://deeptide.co/king-thwncy' },
};

export function findAllStaticVanityKeys(nfts) {
  return nfts.filter(n => n.Issuer === STATIC_VANITY_KEY_ISSUER && n.NFTokenTaxon === STATIC_VANITY_KEY_TAXON);
}

export function findStaticVanityKey(nfts) {
  return nfts.find(n => n.Issuer === STATIC_VANITY_KEY_ISSUER && n.NFTokenTaxon === STATIC_VANITY_KEY_TAXON) || null;
}

// Each STAT!C Vanity Collector's Key's on-chain metadata carries its own
// key number ("STAT!C VANITY COLLECTOR'S KEY #1023") and, embedded in the
// description, the specific vanity XRPL address that key redeems — e.g.
// `preserved under the vanity static address "rfuzzy..."`. Both are read
// directly from IPFS (same resolveIpfsUri/hexToUtf8 pattern used for King
// metadata) rather than a third-party API, since this is the security-
// relevant data the redemption page displays.
export async function getStaticVanityKeyInfo(nft) {
  try {
    const uri = resolveIpfsUri(hexToUtf8(nft.URI));
    const res = await fetch(uri);
    if (!res.ok) return { number: null, address: null };
    const meta = await res.json();
    const name = meta && meta.name;
    const numberMatch = name ? String(name).match(/#(\d+)/) : null;
    const number = numberMatch ? parseInt(numberMatch[1], 10) : null;
    const description = (meta && meta.description) || '';
    const addressMatch = description.match(/"(r[1-9A-HJ-NP-Za-km-z]{25,34})"/);
    const address = addressMatch ? addressMatch[1] : null;
    return { number, address };
  } catch (e) {
    return { number: null, address: null };
  }
}

export function findPigeon(nfts) {
  return nfts.find(n => n.Issuer === PIGEON_ISSUER && n.NFTokenTaxon === PIGEON_TAXON) || null;
}

export function findAllPigeons(nfts) {
  return nfts.filter(n => n.Issuer === PIGEON_ISSUER && n.NFTokenTaxon === PIGEON_TAXON);
}

// Pigeon #1-1515 get the higher word limit, #1516+ get the lower one.
// Numbers come from the NFT metadata's "name" field (e.g. "PIGEONS1180"
// -> 1180), confirmed against real on-chain metadata.
export const PIGEON_LOW_EDITION_MAX = 1515;
export const PIGEON_WORD_LIMIT_LOW_EDITION = 75;
export const PIGEON_WORD_LIMIT_HIGH_EDITION = 15;

// Crown tiers, rarest first. "match" must equal the NFT metadata's
// Headwear trait value exactly (confirmed against real on-chain metadata —
// don't change these without re-verifying). "display" is the friendlier
// label shown in the UI. Multipliers are placeholders — adjust to the
// real economy numbers.
export const CROWN_TIERS = [
  { match: '9-Spike Total-Reign', display: '9 Spike KING', multiplier: 3 },
  { match: 'Invisible crown', display: 'Invisible KING', multiplier: 2.5 },
  { match: '8-Spike Broad-Reign', display: '8 Spike KING', multiplier: 2 },
  { match: 'Crown of Thorns', display: 'Thorn KING', multiplier: 1.75 },
  { match: 'Jewelled Silver Crown', display: 'Jewelled Silver KING', multiplier: 1.6 },
  { match: '5-Spike Falling-Reign', display: '5 Spike KING', multiplier: 1.5 },
  { match: '5-Spike Broken-Reign', display: '5 Spike (Broke) KING', multiplier: 1.25 },
];
export const NO_CROWN_MULTIPLIER = 1;

function hexToUtf8(hex) {
  const bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  return new TextDecoder().decode(bytes);
}

function resolveIpfsUri(uri) {
  if (uri.startsWith('ipfs://')) {
    return 'https://ipfs.io/ipfs/' + uri.slice('ipfs://'.length);
  }
  return uri;
}

async function fetchCrownTierIndexForNft(nft) {
  try {
    const uri = resolveIpfsUri(hexToUtf8(nft.URI));
    const res = await fetch(uri);
    if (!res.ok) return -1;
    const meta = await res.json();
    const attrs = (meta && meta.attributes) || [];
    const headwear = attrs.find(a => a.trait_type === 'Headwear');
    if (!headwear) return -1;
    const idx = CROWN_TIERS.findIndex(t => t.match === headwear.value);
    return idx; // -1 if no match
  } catch (e) {
    return -1;
  }
}

// Checks every King NFT the wallet holds, caching each token's resolved
// crown tier in KV permanently (metadata doesn't change), and returns the
// tier for the rarest crown found (or a "no crown" result if none of their
// King NFTs have a matching Headwear trait).
export async function getBestCrownTier(kv, kingNfts) {
  const results = await Promise.all(kingNfts.map(async (nft) => {
    const cacheKey = `crown:${nft.NFTokenID}`;
    const cached = await kv.get(cacheKey);
    if (cached !== null) return parseInt(cached, 10);
    const idx = await fetchCrownTierIndexForNft(nft);
    await kv.put(cacheKey, String(idx));
    return idx;
  }));

  const found = results.filter(idx => idx >= 0);
  if (found.length === 0) return { name: null, multiplier: NO_CROWN_MULTIPLIER, index: -1 };
  const bestIdx = Math.min(...found); // lower index = rarer
  return { name: CROWN_TIERS[bestIdx].display, multiplier: CROWN_TIERS[bestIdx].multiplier, index: bestIdx };
}

async function fetchPigeonMeta(nft) {
  try {
    const uri = resolveIpfsUri(hexToUtf8(nft.URI));
    const res = await fetch(uri);
    if (!res.ok) return { number: null, image: null };
    const meta = await res.json();
    const name = meta && meta.name;
    const match = name ? String(name).match(/(\d+)/) : null;
    const number = match ? parseInt(match[1], 10) : null;
    const image = meta && meta.image ? resolveIpfsUri(meta.image) : null;
    return { number, image };
  } catch (e) {
    return { number: null, image: null };
  }
}

// Fetches (and permanently KV-caches) { number, image } for every Pigeon
// NFT in the list, keyed by NFTokenID so repeat lookups are instant.
async function getPigeonMetaList(kv, pigeonNfts) {
  return Promise.all(pigeonNfts.map(async (nft) => {
    const cacheKey = `pigeonmeta:v2:${nft.NFTokenID}`;
    const cached = await kv.get(cacheKey);
    if (cached !== null) {
      const parsed = JSON.parse(cached);
      return { nftId: nft.NFTokenID, ...parsed };
    }
    const info = await fetchPigeonMeta(nft);
    await kv.put(cacheKey, JSON.stringify(info));
    return { nftId: nft.NFTokenID, ...info };
  }));
}

// Checks every Pigeon NFT the wallet holds and returns the word limit for
// their best (lowest-numbered / earliest) Pigeon. Unparseable/unknown
// numbers are treated as high-edition (the restrictive limit) rather than
// trusted.
export async function getBestPigeonWordLimit(kv, pigeonNfts) {
  const metas = await getPigeonMetaList(kv, pigeonNfts);
  const numbers = metas.map(m => m.number === null ? PIGEON_LOW_EDITION_MAX + 1 : m.number);
  const best = Math.min(...numbers);
  return best <= PIGEON_LOW_EDITION_MAX ? PIGEON_WORD_LIMIT_LOW_EDITION : PIGEON_WORD_LIMIT_HIGH_EDITION;
}

// Returns [{ nftId, number, image }] for every Pigeon NFT the wallet holds,
// for building a picker UI. Entries with no resolvable image are dropped.
export async function getPigeonThumbnails(kv, pigeonNfts) {
  const metas = await getPigeonMetaList(kv, pigeonNfts);
  return metas.filter(m => m.image);
}

// Kingdom Phase 1 — every King NFT needs a stable friendly ID for display
// (e.g. "KING #0013") and future per-King history. The NFTokenID itself is
// the real permanent identifier (used for votes/claims); this is just a
// human-readable label resolved from metadata, same pattern as Pigeons.
async function fetchKingMeta(nft) {
  try {
    const uri = resolveIpfsUri(hexToUtf8(nft.URI));
    const res = await fetch(uri);
    if (!res.ok) return { number: null, image: null };
    const meta = await res.json();
    const name = meta && meta.name;
    const match = name ? String(name).match(/(\d+)/) : null;
    const number = match ? parseInt(match[1], 10) : null;
    const image = meta && meta.image ? resolveIpfsUri(meta.image) : null;
    return { number, image };
  } catch (e) {
    return { number: null, image: null };
  }
}

// Returns [{ nftId, number, image, label }] for every King NFT held, caching
// resolved metadata in KV permanently. "label" falls back to the last 4
// characters of the NFTokenID when a number can't be resolved from metadata,
// so every King always gets a stable, unique display ID either way.
export async function getKingThumbnails(kv, kingNfts) {
  return Promise.all(kingNfts.map(async (nft) => {
    const cacheKey = `kingmeta:${nft.NFTokenID}`;
    const cached = await kv.get(cacheKey);
    const info = cached !== null ? JSON.parse(cached) : await fetchKingMeta(nft);
    if (cached === null) await kv.put(cacheKey, JSON.stringify(info));
    const label = info.number !== null
      ? `KING #${String(info.number).padStart(4, '0')}`
      : `KING #${nft.NFTokenID.slice(-4)}`;
    return { nftId: nft.NFTokenID, number: info.number, image: info.image, label };
  }));
}
