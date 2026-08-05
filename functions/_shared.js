export const COOKIE_NAME = 'glitch_access';
export const BOARD_COOKIE_NAME = 'pigeon_session';

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

export function findKingNft(nfts) {
  return nfts.find(n => n.Issuer === KING_ISSUER && n.NFTokenTaxon === KING_TAXON) || null;
}

export function findAllKingNfts(nfts) {
  return nfts.filter(n => n.Issuer === KING_ISSUER && n.NFTokenTaxon === KING_TAXON);
}

export function findHoneypot(nfts) {
  return nfts.find(n => n.Issuer === HONEYPOT_ISSUER && n.NFTokenTaxon === HONEYPOT_TAXON) || null;
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
