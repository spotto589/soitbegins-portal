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

// ipfs.io now challenge-blocks image requests carrying browser Fetch
// Metadata headers (Sec-Fetch-Site: cross-site), which is exactly what a
// hotlinked <img src="https://ipfs.io/..."> sends — so every pigeon/king
// picture embedded directly broke even though the underlying content is
// fine. Routing through our own /api/ipfs-image endpoint means the ipfs.io
// fetch happens server-to-server (no Fetch Metadata headers, same as a
// plain curl request) and the browser only ever loads same-origin image
// URLs, which ipfs.io has no reason to challenge.
export function proxyIpfsImage(url) {
  return url ? `/api/ipfs-image?src=${encodeURIComponent(url)}` : url;
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
// NFT in the list, keyed by NFTokenID so repeat lookups are instant. Only
// successful resolutions (image found) are cached — a null image usually
// means the IPFS gateway fetch failed transiently, and permanently caching
// that would poison the pigeon forever even after the gateway recovers.
async function getPigeonMetaList(kv, pigeonNfts) {
  return Promise.all(pigeonNfts.map(async (nft) => {
    const cacheKey = `pigeonmeta:v2:${nft.NFTokenID}`;
    const cached = await kv.get(cacheKey);
    if (cached !== null) {
      const parsed = JSON.parse(cached);
      if (parsed.image !== null) return { nftId: nft.NFTokenID, ...parsed };
    }
    const info = await fetchPigeonMeta(nft);
    if (info.image !== null) await kv.put(cacheKey, JSON.stringify(info));
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

// ─────────────────────────────────────────────────────────────────────────
// Σκύλλα SWAP :: Pigeon collection data-access layer (Phase 1B).
//
// Real data only — everything below reads from the actual XRPL ledger
// (Clio's nfts_by_issuer/nft_info, the only methods that expose the whole
// collection or a single token without already knowing an owning wallet)
// and the actual per-NFT IPFS metadata (same hex-URI/resolveIpfsUri path
// already used by fetchPigeonMeta above, just also keeping `attributes`
// instead of discarding everything but number/image).
//
// Honest limitation: there is no ledger-side index from a Pigeon's display
// number (parsed from its metadata "name", e.g. "PIGEONS1180" -> 1180) back
// to its NFTokenID — that mapping only exists inside IPFS metadata itself,
// which can't be scanned for all ~3015 tokens inside one request without
// blowing past any reasonable page-load time. So this builds that index
// incrementally in KV, one token at a time, every time a token is actually
// looked at (collection browsing or a hit search) — coverage grows with
// real use instead of ever being faked. A number search that isn't in the
// index yet is reported as such, never guessed at.
// ─────────────────────────────────────────────────────────────────────────

// Matches board.js's own TOTAL_PIGEONS figure — an approximation for
// display only ("~3015 P!GE0NS"), never a live-counted total.
export const PIGEON_COLLECTION_SIZE_APPROX = 3015;

// Every write below is a caching/indexing optimization, never required
// for a response to be correct — the real data already came from the
// ledger/Deeptide/IPFS fetch that happened first. Cloudflare KV's free
// plan has a hard daily write quota (1,000/day); once exhausted, every
// kv.put() throws "KV put() limit exceeded for the day" until it resets
// at UTC midnight. Swallowing that here means a quota exhaustion pauses
// caching/indexing (search coverage stops growing until reset) instead of
// breaking the actual browsing/search experience, which was the real bug:
// an uncaught write failure was rejecting the whole per-owner resolution,
// dropping otherwise-successfully-fetched Pigeons from the response.
async function safeKvPut(kv, key, value, opts) {
  try {
    await kv.put(key, value, opts);
  } catch (e) {
    // Quota exhaustion or any other transient KV failure — not fatal.
  }
}

// v2: bumped when Deeptide enrichment (rarityRank/rarityTotal) was added —
// forces every pre-existing cache entry to be treated as a miss and
// re-resolved through the new path, instead of silently serving
// old-schema data (no rarity, IPFS-only image) forever.
const PIGEON_META_PREFIX = 'pswap:meta:v2:';
const PIGEON_NUMBER_INDEX_PREFIX = 'pswap:numidx:';
const PIGEON_TRAIT_MEMBER_PREFIX = 'pswap:traitmember:';

// One page (default 48) of the real, live Pigeon collection straight off
// the ledger — owner + NFTokenID + raw hex URI for each token, newest scan
// state carried forward via `marker` exactly like fetchAllAccountNfts.
export async function fetchPigeonCollectionPage(marker, limit = 48) {
  const params = { issuer: PIGEON_ISSUER, nft_taxon: PIGEON_TAXON, limit };
  if (marker) params.marker = marker;
  const res = await fetch(CLIO_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'nfts_by_issuer', params: [params] }),
  });
  const data = await res.json();
  const result = data && data.result;
  if (!result || result.error) return { items: [], marker: null };
  const items = (result.nfts || [])
    .filter(n => !n.is_burned)
    .map(n => ({ nftId: n.nft_id, owner: n.owner, uriHex: n.uri }));
  return { items, marker: result.marker || null };
}

// Fresh single-token lookup (owner + URI) via Clio's nft_info — used when
// inspecting one specific Pigeon so its owner is current at that moment,
// rather than whatever it was the last time this token's page was scanned.
export async function fetchNftInfo(nftId) {
  try {
    const res = await fetch(CLIO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'nft_info', params: [{ nft_id: nftId }] }),
    });
    const data = await res.json();
    const result = data && data.result;
    if (!result || result.error || result.is_burned) return null;
    return { owner: result.owner || null, uriHex: result.uri || null };
  } catch (e) {
    return null;
  }
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Full per-token metadata straight from IPFS — number, image, and the
// complete `attributes` array (trait_type/value pairs), whatever shape the
// collection's own metadata actually uses. Never invents a trait schema.
async function fetchPigeonFullMeta(uriHex) {
  try {
    const uri = resolveIpfsUri(hexToUtf8(uriHex));
    const res = await fetchWithTimeout(uri, 6000);
    if (!res.ok) return null;
    const meta = await res.json();
    const name = meta && meta.name;
    const match = name ? String(name).match(/(\d+)/) : null;
    const number = match ? parseInt(match[1], 10) : null;
    const image = meta && meta.image ? resolveIpfsUri(meta.image) : null;
    const attributes = Array.isArray(meta && meta.attributes) ? meta.attributes : [];
    return { number, image, attributes };
  } catch (e) {
    return null;
  }
}

// Records a newly-seen token's traits into the membership index — ONE
// write per attribute (down from three: category/value existence are now
// derived by parsing membership key names via list(), never written as
// their own keys). This matters because every kv.put/get/fetch counts
// against Cloudflare's per-request subrequest budget (~50); the previous
// 3-keys-per-attribute scheme could burn 20+ subrequests on a single
// newly-seen token, which — combined with per-owner Deeptide calls and
// meta caching — was blowing the budget and causing every request to fail
// before anything ever got cached (a self-reinforcing "nothing ever warms
// up" loop). Only called from the background indexer now, never from the
// interactive browse/search path — see `indexExtras` below.
async function recordPigeonTraitIndex(kv, nftId, attributes) {
  const writes = [];
  for (const attr of attributes) {
    const traitType = attr && attr.trait_type;
    const value = attr && attr.value;
    if (!traitType || value === undefined || value === null) continue;
    writes.push(safeKvPut(kv, `${PIGEON_TRAIT_MEMBER_PREFIX}${traitType}:${value}:${nftId}`, '1'));
  }
  await Promise.all(writes);
}

// The one function that actually resolves a Pigeon's full metadata via
// IPFS (the Deeptide-covered path in resolvePigeonsForOwner below never
// reaches this for tokens Deeptide already has). KV cache first (metadata
// is immutable once minted, so a hit is permanent). `indexExtras` controls
// whether the number/trait indexes also get written on a cache miss —
// keep this OFF for anything in the interactive request path (browsing,
// search, wallet lookups) and ON only for the small, deliberately-bounded
// background indexer batches, to stay under the subrequest budget.
export async function getPigeonFullMeta(kv, nftId, uriHex, indexExtras = false) {
  const cacheKey = PIGEON_META_PREFIX + nftId;
  const cached = await kv.get(cacheKey);
  if (cached !== null) return JSON.parse(cached);

  const info = await fetchPigeonFullMeta(uriHex);
  if (!info || info.image === null) return info;

  await safeKvPut(kv, cacheKey, JSON.stringify(info));
  if (indexExtras) {
    if (info.number !== null) await safeKvPut(kv, PIGEON_NUMBER_INDEX_PREFIX + info.number, nftId);
    await recordPigeonTraitIndex(kv, nftId, info.attributes);
  }
  return info;
}

// Read-only — never fetches. Used when we already have an nftId from a
// fresh ledger call and just want whatever's already indexed.
export async function getPigeonMetaCached(kv, nftId) {
  const cached = await kv.get(PIGEON_META_PREFIX + nftId);
  return cached !== null ? JSON.parse(cached) : null;
}

// Real, but honestly incomplete: only returns a hit if this exact number
// has been indexed already (via the background indexer). A miss does NOT
// mean the Pigeon doesn't exist — see the module comment above.
export async function getPigeonNumberIndex(kv, number) {
  return kv.get(PIGEON_NUMBER_INDEX_PREFIX + number);
}

// Every trait category actually observed so far, derived from a sample of
// membership keys (1 list() call — cheap regardless of collection size)
// rather than a separately-written key family. Grows as more of the
// collection gets indexed — never a fixed list.
export async function getIndexedTraitCategories(kv) {
  const list = await kv.list({ prefix: PIGEON_TRAIT_MEMBER_PREFIX, limit: 1000 });
  const cats = new Set();
  for (const k of list.keys) {
    const rest = k.name.slice(PIGEON_TRAIT_MEMBER_PREFIX.length);
    const type = rest.split(':')[0];
    if (type) cats.add(type);
  }
  return [...cats].sort();
}

// Every value actually observed for one trait category so far, same
// derive-from-membership-keys approach.
export async function getIndexedTraitValues(kv, traitType) {
  const prefix = `${PIGEON_TRAIT_MEMBER_PREFIX}${traitType}:`;
  const list = await kv.list({ prefix, limit: 1000 });
  const vals = new Set();
  for (const k of list.keys) {
    const rest = k.name.slice(prefix.length);
    const value = rest.split(':')[0];
    if (value) vals.add(value);
  }
  return [...vals].sort();
}

// Every currently-indexed Pigeon matching an exact trait/value pair, with
// its cached metadata attached. Only searches what's been indexed so far —
// callers must surface that as a real, disclosed limitation, not silence it.
export async function getPigeonsByTraitValue(kv, traitType, value, limit = 48) {
  const prefix = `${PIGEON_TRAIT_MEMBER_PREFIX}${traitType}:${value}:`;
  const list = await kv.list({ prefix, limit });
  const nftIds = list.keys.map(k => k.name.slice(prefix.length));
  const metas = await Promise.all(nftIds.map(id => getPigeonMetaCached(kv, id)));
  return nftIds
    .map((nftId, i) => ({ nftId, meta: metas[i] }))
    .filter(entry => entry.meta !== null);
}

// Stackable trait filters, ALL of which must match (AND, never OR) — each
// filter's membership set is read from the same real per-token trait index
// above, then intersected in memory. Still only searches what's been
// indexed so far; capped at 1000 members per individual filter before the
// intersection, same honesty limit as getPigeonsByTraitValue.
export async function filterPigeonsByTraits(kv, filters, limit = 48) {
  if (!filters || !filters.length) return [];
  const sets = await Promise.all(filters.map(async (f) => {
    const prefix = `${PIGEON_TRAIT_MEMBER_PREFIX}${f.trait}:${f.value}:`;
    const list = await kv.list({ prefix, limit: 1000 });
    return new Set(list.keys.map(k => k.name.slice(prefix.length)));
  }));
  let intersection = sets[0];
  for (let i = 1; i < sets.length; i++) {
    intersection = new Set([...intersection].filter(id => sets[i].has(id)));
  }
  const nftIds = [...intersection].slice(0, limit);
  const metas = await Promise.all(nftIds.map(id => getPigeonMetaCached(kv, id)));
  return nftIds
    .map((nftId, i) => ({ nftId, meta: metas[i] }))
    .filter(entry => entry.meta !== null);
}

// ─────────────────────────────────────────────────────────────────────────
// Deeptide enrichment. Deeptide (the same marketplace already used for
// King rarity via getTopKingRarity below) tracks the xrpigeons shop too —
// its per-wallet "owned" endpoint returns, in one call, every Pigeon that
// wallet holds complete with a fast CDN image, the real trait array, AND a
// real rarityRank/rarityTotal — something raw IPFS metadata never carries.
// This is real, reliable rarity data (same source/pattern already trusted
// for Kings), not invented. IPFS remains the fallback for any token
// Deeptide hasn't synced yet.
// ─────────────────────────────────────────────────────────────────────────
const DEEPTIDE_PIGEON_SHOP_SLUG = 'xrpigeons';
const DEEPTIDE_OWNER_CACHE_PREFIX = 'pswap:deeptideowner:';
const DEEPTIDE_OWNER_CACHE_TTL_SECONDS = 180;

async function fetchDeeptideOwnedPigeons(address) {
  try {
    const res = await fetch(`${DEEPTIDE_API_BASE}/api/mint/owned?address=${encodeURIComponent(address)}`);
    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    return items
      .filter(it => it.shopSlug === DEEPTIDE_PIGEON_SHOP_SLUG)
      .map(it => {
        const match = it.name ? String(it.name).match(/(\d+)/) : null;
        return {
          nftId: it.nftTokenId,
          number: match ? parseInt(match[1], 10) : null,
          image: it.imageUrl || null,
          attributes: Array.isArray(it.traits) ? it.traits : [],
          rarityRank: typeof it.rarityRank === 'number' ? it.rarityRank : null,
          rarityTotal: typeof it.rarityTotal === 'number' ? it.rarityTotal : null,
        };
      });
  } catch (e) {
    return [];
  }
}

// Short-lived cache (3 min) so repeatedly rendering pages that include a
// popular wallet doesn't hammer Deeptide — deliberately much shorter than
// the permanent per-token cache, since a wallet's holdings genuinely change.
async function getOwnerPigeonsViaDeeptide(kv, address) {
  const cacheKey = DEEPTIDE_OWNER_CACHE_PREFIX + address;
  const cached = await kv.get(cacheKey);
  if (cached !== null) return JSON.parse(cached);
  const items = await fetchDeeptideOwnedPigeons(address);
  await safeKvPut(kv, cacheKey, JSON.stringify(items), { expirationTtl: DEEPTIDE_OWNER_CACHE_TTL_SECONDS });
  return items;
}

// Resolves full metadata for every ledger item belonging to ONE owner in a
// single batch: one Deeptide call covers all of them (fast CDN images +
// real traits + real rarity), falling back to a per-token IPFS fetch only
// for whatever Deeptide doesn't have yet. Already-cached tokens are
// returned straight from KV without calling Deeptide at all.
//
// `opts.indexExtras` (default false) — whether to also write the number
// and trait indexes on a cache miss. Leave this off for anything in the
// interactive request path; only the background indexer (small, bounded
// batches) should turn it on, to stay under the subrequest budget.
export async function resolvePigeonsForOwner(kv, owner, ledgerItems, opts = {}) {
  const indexExtras = !!opts.indexExtras;
  const results = [];
  const uncached = [];
  for (const it of ledgerItems) {
    const cached = await getPigeonMetaCached(kv, it.nftId);
    if (cached) results.push({ nftId: it.nftId, meta: cached });
    else uncached.push(it);
  }
  if (!uncached.length) return results;

  const deeptideItems = await getOwnerPigeonsViaDeeptide(kv, owner);
  const byId = new Map(deeptideItems.map(d => [d.nftId, d]));

  await Promise.all(uncached.map(async (it) => {
    const fromDeeptide = byId.get(it.nftId);
    let meta;
    if (fromDeeptide && fromDeeptide.image) {
      meta = {
        number: fromDeeptide.number,
        image: fromDeeptide.image,
        attributes: fromDeeptide.attributes,
        rarityRank: fromDeeptide.rarityRank,
        rarityTotal: fromDeeptide.rarityTotal,
      };
      await safeKvPut(kv, PIGEON_META_PREFIX + it.nftId, JSON.stringify(meta));
      if (indexExtras) {
        if (meta.number !== null) await safeKvPut(kv, PIGEON_NUMBER_INDEX_PREFIX + meta.number, it.nftId);
        await recordPigeonTraitIndex(kv, it.nftId, meta.attributes);
      }
    } else {
      meta = await getPigeonFullMeta(kv, it.nftId, it.uriHex, indexExtras);
    }
    if (meta) results.push({ nftId: it.nftId, meta });
  }));
  return results;
}

// Live, uncached view of one wallet's real holdings — deliberately does NO
// KV writes at all (beyond the existing short-lived owner-cache in
// getOwnerPigeonsViaDeeptide), so this stays cheap regardless of how many
// Pigeons the wallet holds. A single Deeptide call already returns every
// token's image/traits/rarity in one shot; there is no need to also write
// each one to the meta cache just to display THIS response — caching is
// an optimization for future lookups, not a requirement for this one, and
// a wallet holding 100+ Pigeons would otherwise burn 100+ subrequests on
// cache-existence checks alone. Used for the "SELECT -> load owner's
// collection" flow, where the wallet size isn't bounded by us.
export async function resolveOwnerCollectionLive(kv, owner, ledgerItems) {
  const deeptideItems = await getOwnerPigeonsViaDeeptide(kv, owner);
  const byId = new Map(deeptideItems.map(d => [d.nftId, d]));
  const results = await Promise.all(ledgerItems.map(async (it) => {
    const fromDeeptide = byId.get(it.nftId);
    if (fromDeeptide && fromDeeptide.image) {
      return {
        nftId: it.nftId,
        meta: {
          number: fromDeeptide.number,
          image: fromDeeptide.image,
          attributes: fromDeeptide.attributes,
          rarityRank: fromDeeptide.rarityRank,
          rarityTotal: fromDeeptide.rarityTotal,
        },
      };
    }
    const meta = await fetchPigeonFullMeta(it.uriHex);
    return meta ? { nftId: it.nftId, meta } : null;
  }));
  return results.filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────
// Background full-collection indexer. Trait *percentages* (as opposed to
// rarityRank, which Deeptide already gives per-token immediately) need the
// true frequency of each value across the whole ~3015-token collection —
// that requires having looked at all of it at least once. This scans the
// full ledger in bounded batches (self-resuming via a saved marker) so one
// invocation can never run away; it's meant to be kicked off opportunistically
// via context.waitUntil() from a normal request, exactly like
// recomputeCrownHolder() above, not awaited inline.
// ─────────────────────────────────────────────────────────────────────────
const PIGEON_INDEX_STATS_KEY = 'pswap:indexstats';
const PIGEON_INDEX_STALE_SECONDS = 3600;
// Deliberately tiny: full indexing (meta + number index + up to ~7
// trait-membership writes) costs roughly 10-15 subrequests per NEW token,
// plus a few more per distinct owner. Cloudflare caps a single request to
// ~50 subrequests total, so this batch has to stay small enough that even
// an all-cache-miss, all-distinct-owners run can't blow that budget in one
// waitUntil invocation. Progress is saved after every page and resumes
// from the last marker, so this is meant to make real (if slow) progress
// across many real page loads, not finish in one shot.
const PIGEON_INDEX_PAGES_PER_RUN = 1;
const PIGEON_INDEX_PAGE_SIZE = 3;

export async function getPigeonIndexStats(kv) {
  const raw = await kv.get(PIGEON_INDEX_STATS_KEY);
  return raw ? JSON.parse(raw) : null;
}

// Safe to call opportunistically and often — it no-ops if a run is
// genuinely still active (concurrent request) or a complete scan finished
// recently. Each invocation runs to completion (processing just one tiny
// page) in a couple of seconds, so the "still active" guard only needs to
// catch true concurrent overlap, not block the next sequential page load
// from making progress — a long cooldown here would mean the indexer only
// ever advances once every N minutes regardless of how much real traffic
// hits the site.
const PIGEON_INDEX_CONCURRENT_GUARD_SECONDS = 10;
export async function maybeRecomputePigeonIndex(kv) {
  const stats = await getPigeonIndexStats(kv);
  const now = Math.floor(Date.now() / 1000);
  if (stats && stats.inProgress && now - stats.updatedAt < PIGEON_INDEX_CONCURRENT_GUARD_SECONDS) return;
  if (stats && !stats.inProgress && !stats.marker && now - stats.computedAt < PIGEON_INDEX_STALE_SECONDS) return; // fresh complete scan
  await recomputePigeonIndex(kv, stats);
}

export async function recomputePigeonIndex(kv, existing) {
  let marker = existing && existing.marker ? existing.marker : null;
  let totalIndexed = existing && existing.marker ? existing.totalIndexed : 0;
  const startedAt = existing && existing.inProgress ? existing.startedAt : Math.floor(Date.now() / 1000);

  for (let i = 0; i < PIGEON_INDEX_PAGES_PER_RUN; i++) {
    const page = await fetchPigeonCollectionPage(marker, PIGEON_INDEX_PAGE_SIZE);
    const byOwner = new Map();
    for (const it of page.items) {
      if (!byOwner.has(it.owner)) byOwner.set(it.owner, []);
      byOwner.get(it.owner).push(it);
    }
    await Promise.all(Array.from(byOwner.entries()).map(([owner, items]) => resolvePigeonsForOwner(kv, owner, items, { indexExtras: true })));
    totalIndexed += page.items.length;
    marker = page.marker;
    await safeKvPut(kv, PIGEON_INDEX_STATS_KEY, JSON.stringify({
      inProgress: !!marker, startedAt, marker, totalIndexed, updatedAt: Math.floor(Date.now() / 1000),
      computedAt: Math.floor(Date.now() / 1000),
    }));
    if (!marker) break;
  }
  return getPigeonIndexStats(kv);
}

// Percentage of the currently-indexed collection carrying one trait value —
// honest about being partial until a full scan (marker === null) completes.
export async function getTraitValuePercent(kv, traitType, value, stats) {
  if (!stats || !stats.totalIndexed) return null;
  const prefix = `${PIGEON_TRAIT_MEMBER_PREFIX}${traitType}:${value}:`;
  const list = await kv.list({ prefix, limit: 1000 });
  const count = list.keys.length;
  const pct = Math.round((count / stats.totalIndexed) * 1000) / 10;
  return { count, pct, truncated: !list.list_complete, partial: !!stats.marker };
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
// so every King always gets a stable, unique display ID either way. Only
// successful resolutions are cached — see getPigeonMetaList for why a null
// image must not be cached permanently.
export async function getKingThumbnails(kv, kingNfts) {
  return Promise.all(kingNfts.map(async (nft) => {
    const cacheKey = `kingmeta:${nft.NFTokenID}`;
    const cachedRaw = await kv.get(cacheKey);
    const cached = cachedRaw !== null ? JSON.parse(cachedRaw) : null;
    const info = (cached !== null && cached.image !== null) ? cached : await fetchKingMeta(nft);
    if ((cached === null || cached.image === null) && info.image !== null) await kv.put(cacheKey, JSON.stringify(info));
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
