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

// Once a STAT!C Vanity Collector's Key has been redeemed, the redemption
// is permanent — this is enforced by KV, not by NFT ownership, since the
// wallet still holds the NFT afterward. Keyed by NFTokenID so it stays
// tied to a specific key even if the NFT changes hands.
const STATIC_REDEEMED_KEY_PREFIX = 'static_redeemed:';

export async function isStaticKeyRedeemed(kv, nftId) {
  const raw = await kv.get(STATIC_REDEEMED_KEY_PREFIX + nftId);
  return !!raw;
}

export async function markStaticKeyRedeemed(kv, nftId, meta) {
  await kv.put(STATIC_REDEEMED_KEY_PREFIX + nftId, JSON.stringify(meta));
}

// Fire-and-forget Discord notification for a completed redemption. Callers
// should wrap this in context.waitUntil() so it doesn't block the response,
// and it deliberately swallows its own errors — a failed notification must
// never fail or delay the redemption itself.
export async function notifyDiscordRedemption(webhookUrl, { acct, nftId, keyNumber }) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content:
          `🔑 **STAT!C key redeemed**\n` +
          `Key #${keyNumber !== null && keyNumber !== undefined ? keyNumber : '????'} (\`${nftId}\`)\n` +
          `Wallet: \`${acct}\`\n` +
          `Time: ${new Date().toISOString()}`
      })
    });
  } catch (e) {
    // Never let a notification failure surface to the redemption flow.
  }
}

export function findPigeon(nfts) {
  return nfts.find(n => n.Issuer === PIGEON_ISSUER && n.NFTokenTaxon === PIGEON_TAXON) || null;
}

export function findAllPigeons(nfts) {
  return nfts.filter(n => n.Issuer === PIGEON_ISSUER && n.NFTokenTaxon === PIGEON_TAXON);
}

// The Pigeon ACCESS LEVEL system. Levels are non-contiguous by design —
// 01/03/06/09/12/15, with 00 reserved for "no Pigeon" — and unlike the
// original 1(highest)-6(lowest) scheme this replaced, HIGHER holdings now
// give a HIGHER level number: a wallet can read its own level and every
// level below it, so 15 (Crown) sees everything and 01 sees only 01.
//
// Crown is folded directly into this scale as level 15, not layered on
// top of a separate 1-6 scale — per direction, there is exactly one
// access-level number per wallet, and Crown status is what produces it
// when applicable. The remaining five count brackets reuse the project's
// existing 6-bucket tier-color system (tier-green..tier-diamond, already
// used for the signature border) — tier-diamond is now reserved
// specifically for the Crown holder (level 15), so it also keeps the
// existing diamond-sparkle visual treatment for whoever currently wears it.
export function getPigeonCountTier(count) {
  if (count >= 100) return 'tier-gold';
  if (count >= 50) return 'tier-purple';
  if (count >= 16) return 'tier-red';
  if (count >= 5) return 'tier-pink';
  return 'tier-green';
}

const TIER_ACCESS_LEVEL = {
  'tier-green': 1, 'tier-pink': 3, 'tier-red': 6,
  'tier-purple': 9, 'tier-gold': 12, 'tier-diamond': 15,
};

// (pigeonCount, isCrown) -> access level (0/1/3/6/9/12/15). isCrown must
// come from a specific, deliberate source: the live cached Crown snapshot
// for "what is this wallet's level right now" (board.js, via
// isCrownWallet below), or the permanently-recorded rank at signing for a
// historical signature (msg.rank === 'CROWN') — never recomputed for the
// latter. This is the single trusted mapping every caller should go
// through, so every surface (relay board, signal visibility, reward
// rate, governance voting power) agrees on the same number.
export function getPigeonAccessLevel(pigeonCount, isCrown) {
  if (isCrown) return 15;
  if (!pigeonCount) return 0;
  return TIER_ACCESS_LEVEL[getPigeonCountTier(pigeonCount)] || 1;
}

// (pigeonCount, isCrown) -> the border-tier CSS class, following the same
// Crown-overrides-count rule as getPigeonAccessLevel. Message rows should
// use this instead of calling getPigeonCountTier directly whenever the
// signer's Crown status (current or at-signing) is known, so the border
// colour and the access level never disagree about who's wearing the Crown.
export function getPigeonTierClass(pigeonCount, isCrown) {
  if (isCrown) return 'tier-diamond';
  return getPigeonCountTier(pigeonCount || 1);
}

// wallet's NFTs (from fetchAllAccountNfts — real XRPL data, never
// client-supplied) -> verified { pigeonCount, accessLevel }. This is the
// entry point routes should call to get a wallet's trusted access level:
// wallet -> Pigeon ownership -> tier -> access level, computed server-side
// every time, never trusted from the frontend. isCrown must be resolved
// by the caller (e.g. via getCachedCrownHolder + isCrownWallet) and
// passed in, since it isn't derivable from the NFT list alone.
export function getWalletAccessLevel(nfts, isCrown) {
  const pigeonCount = findAllPigeons(nfts).length;
  return { pigeonCount, accessLevel: getPigeonAccessLevel(pigeonCount, isCrown) };
}

// Phase 4 — reward-RATE infrastructure. This is deliberately just the
// pipeline (accessLevel -> multiplier -> CRWN/PIGEON rate), not finalized
// economics: the numbers below are placeholders to be tuned once the
// actual token economics are decided, per direction ("build the
// infrastructure, not necessarily finalize the rates"). Changing a
// level's reward later means editing one line here, not touching how
// rates get calculated or displayed anywhere else.
//
// This also does NOT implement reward accrual, a balance ledger, or any
// payout mechanism — none of that exists yet. It only computes the
// *rate* a wallet would earn at, for display, given their (already
// server-verified) access level. What actually triggers a reward
// (participation-gated, not passive holding, per direction) is a later
// decision this pipeline is ready for but doesn't yet enforce.
export const REWARD_MULTIPLIER_BY_LEVEL = {
  0: 0,  // no Pigeon
  1: 1,  // entry
  3: 2,
  6: 3,
  9: 4,
  12: 5,
  15: 6, // Crown
};

// Base per-signal rates the multiplier scales against. Separate tokens on
// purpose (per direction): $CRWN as the economic/participation reward,
// $PIGEON as network reputation/utility — kept as two independent base
// rates so they can diverge later without changing the multiplier logic.
export const CRWN_BASE_RATE = 1;
export const PIGEON_BASE_RATE = 1;

export function getRewardMultiplier(accessLevel) {
  return REWARD_MULTIPLIER_BY_LEVEL[accessLevel] ?? 0;
}

// accessLevel -> { multiplier, crwnRate, pigeonRate }. The one function
// callers should use to display (not distribute) a wallet's reward rate.
export function getRewardRates(accessLevel) {
  const multiplier = getRewardMultiplier(accessLevel);
  return {
    multiplier,
    crwnRate: CRWN_BASE_RATE * multiplier,
    pigeonRate: PIGEON_BASE_RATE * multiplier,
  };
}

// --- Phase 4.5: the Crown, i.e. the CURRENT top Pigeon holder,
// network-wide ---
//
// This answers a genuinely different question from everything above.
// getWalletAccessLevel etc. all answer "how many Pigeons does THIS known
// wallet hold" (fetchAllAccountNfts — one address at a time). Crown has
// to answer "out of every wallet that holds any Pigeons, which one holds
// the most right now" — which needs to see every Pigeon NFT's current
// owner, not just one wallet's.
//
// Rule, exactly as specified: Crown = greatest current Pigeon holding,
// used Pigeons included (unused/signature-count/board-activity/CRWN
// balance/voting/reward balance are explicitly NOT inputs). Ties are
// broken by whichever wallet reached that count first.
//
// This is unrelated to CROWN_TIERS below (that's King-NFT headwear
// rarity, a completely different system) and to the $CRWN reward token —
// "Crown" here means the single top-holder rank.
//
// The only way to see every current owner of a collection is XRPL's Clio
// `nfts_by_issuer` method — confirmed xrplcluster.com (used everywhere
// else in this file) does NOT support it ("Unknown method"); Ripple's own
// public Clio server does. A full scan is ~31 paginated calls for the
// ~3016-Pigeon collection (100/page) and takes 30+ seconds — far too slow
// to run inline on a page request. So this is deliberately split in two:
//   - recomputeCrownHolder() — the expensive full scan + tie-break bookkeeping.
//     Meant to be triggered from outside a normal page render — either the
//     background waitUntil() in board.js when the cache goes stale, or an
//     external pinger hitting POST /api/crown-recompute on a schedule
//     (Cloudflare Pages Functions have no cron trigger of their own).
//   - getCachedCrownHolder() — a cheap KV read of the last computed
//     result. Safe to call on every page render.
// Deliberately no :51234 — Cloudflare Workers silently ignore custom
// HTTPS ports on fetch() once deployed (confirmed via wrangler's own
// deploy-time warning), which would break this in production while still
// appearing to work in local dev. s2-clio.ripple.com serves the same
// Clio API on the default port too — confirmed working.
const CLIO_ENDPOINT = 'https://s2-clio.ripple.com';
const CROWN_SNAPSHOT_KEY = 'crown:snapshot';
const CROWN_HOLDINGS_HISTORY_KEY = 'crown:holdings-history';
// board.js only bothers kicking off a background recompute once the
// cached snapshot is at least this stale.
export const CROWN_SNAPSHOT_MAX_AGE_SECONDS = 15 * 60;
// Guards against back-to-back triggers (e.g. a misfiring external cron)
// re-running the expensive scan more often than this.
const CROWN_RECOMPUTE_MIN_INTERVAL_SECONDS = 60;

// Every current Pigeon NFT's owner, tallied into a Map<wallet, count>.
// Paginates the full collection via Clio's nfts_by_issuer — the only
// XRPL method that can answer "who owns these right now" collection-wide
// rather than per-address like fetchAllAccountNfts.
async function fetchAllPigeonOwners() {
  const counts = new Map();
  let marker;
  do {
    const params = { issuer: PIGEON_ISSUER, nft_taxon: PIGEON_TAXON, limit: 100 };
    if (marker) params.marker = marker;
    const res = await fetch(CLIO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'nfts_by_issuer', params: [params] }),
    });
    const data = await res.json();
    const result = data && data.result;
    if (!result || result.error) break;
    for (const nft of result.nfts || []) {
      if (nft.is_burned || !nft.owner) continue;
      counts.set(nft.owner, (counts.get(nft.owner) || 0) + 1);
    }
    marker = result.marker;
  } while (marker);
  return counts;
}

// The expensive operation: live full scan -> current Crown holder,
// persisted to KV along with the per-wallet holdings history the
// tie-break rule needs. Self-rate-limited via
// CROWN_RECOMPUTE_MIN_INTERVAL_SECONDS — safe to call opportunistically
// without needing an external caller to also rate-limit itself.
export async function recomputeCrownHolder(kv) {
  const now = Math.floor(Date.now() / 1000);

  const existingSnapshotRaw = await kv.get(CROWN_SNAPSHOT_KEY);
  const existingSnapshot = existingSnapshotRaw ? JSON.parse(existingSnapshotRaw) : null;
  if (existingSnapshot && now - existingSnapshot.computedAt < CROWN_RECOMPUTE_MIN_INTERVAL_SECONDS) {
    return existingSnapshot;
  }

  const counts = await fetchAllPigeonOwners();

  const historyRaw = await kv.get(CROWN_HOLDINGS_HISTORY_KEY);
  const history = historyRaw ? JSON.parse(historyRaw) : {};

  // Tie-break rule: among every wallet currently AT the max holding, the
  // one that reached that count first (earliest recorded "since") keeps
  // the Crown. "since" only resets when a wallet's count actually
  // changes since the last recompute, so it survives repeated recomputes
  // untouched otherwise. Honest limitation: for a wallet whose current
  // count was already reached before this system started tracking,
  // "since" is only as old as the first recompute that ever observed
  // them — there's no way to know the true historical moment before that.
  for (const [wallet, count] of counts.entries()) {
    const prior = history[wallet];
    if (!prior || prior.count !== count) {
      history[wallet] = { count, since: now };
    }
  }
  // Drop wallets that no longer hold any Pigeons, so this never just grows forever.
  for (const wallet of Object.keys(history)) {
    if (!counts.has(wallet)) delete history[wallet];
  }

  let maxCount = 0;
  for (const count of counts.values()) {
    if (count > maxCount) maxCount = count;
  }

  let crownWallet = null;
  let crownSince = null;
  if (maxCount > 0) {
    for (const [wallet, count] of counts.entries()) {
      if (count !== maxCount) continue;
      const since = history[wallet].since;
      if (crownWallet === null || since < crownSince) {
        crownWallet = wallet;
        crownSince = since;
      }
    }
  }

  const snapshot = {
    wallet: crownWallet,
    count: maxCount,
    since: crownSince,
    computedAt: now,
    holderCount: counts.size,
  };

  await kv.put(CROWN_HOLDINGS_HISTORY_KEY, JSON.stringify(history));
  await kv.put(CROWN_SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
}

// Cheap read for normal page renders — never performs the live scan.
// Returns null if a recompute has genuinely never run yet.
export async function getCachedCrownHolder(kv) {
  const raw = await kv.get(CROWN_SNAPSHOT_KEY);
  return raw ? JSON.parse(raw) : null;
}

// wallet -> is this wallet the CURRENT Crown holder, per the cached
// snapshot. This is the one function callers (current-rank display,
// and later signature rank / voting power / reward multiplier) should
// go through, so they all agree with each other. Note this only ever
// answers "right now" — a signature's permanent RANK AT SIGNING is
// captured separately, at post time, in functions/api/board.js, and
// must never be recomputed from this later.
export function isCrownWallet(snapshot, wallet) {
  return !!(snapshot && snapshot.wallet && wallet && snapshot.wallet === wallet);
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

// King NFTs are minted through Deeptide's "king-thwncy" shop (same
// issuer/taxon as xrp.cafe's listing — one collection, two marketplaces),
// and Deeptide's API returns a rarityRank (1 = rarest) per token for
// whatever address currently owns it. Used to surface "top rarity" at login.
const DEEPTIDE_API_BASE = 'https://api.deeptide.co';
const DEEPTIDE_KING_SHOP_SLUG = 'king-thwncy';

// Returns the rarest-ranked King NFT this wallet holds (by Deeptide's
// rarityRank, lower = rarer), or null if the lookup fails or none of the
// wallet's King NFTokenIDs show up in Deeptide's data yet.
export async function getTopKingRarity(address, kingNftIds) {
  try {
    const res = await fetch(`${DEEPTIDE_API_BASE}/api/mint/owned?address=${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    const items = await res.json();
    if (!Array.isArray(items)) return null;
    const idSet = new Set(kingNftIds);
    const kingItems = items.filter(it =>
      it.shopSlug === DEEPTIDE_KING_SHOP_SLUG &&
      idSet.has(it.nftTokenId) &&
      typeof it.rarityRank === 'number'
    );
    if (!kingItems.length) return null;
    const best = kingItems.reduce((a, b) => (a.rarityRank <= b.rarityRank ? a : b));
    return {
      nftId: best.nftTokenId,
      name: best.name || null,
      image: best.imageUrl || null,
      rarityRank: best.rarityRank,
      rarityTotal: typeof best.rarityTotal === 'number' ? best.rarityTotal : null,
    };
  } catch (e) {
    return null;
  }
}
