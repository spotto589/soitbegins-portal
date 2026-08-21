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
    let data;
    try {
      const res = await fetch('https://xrplcluster.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'account_nfts', params: [params] })
      });
      data = await res.json();
    } catch (e) {
      // xrplcluster.com rate-limits under bursts (plain-text body, not
      // JSON) — stop here with whatever's already been collected rather
      // than throwing. Every caller treats an empty/short result as "owns
      // nothing (here)," which fails toward refusing an action, never
      // toward wrongly allowing or confirming one.
      break;
    }
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

// ── Σκύλλα SWAP: first real listing test ──────────────────────────────────
// Verified on-ledger before flipping configured:true (2026-08-21) — this
// issuer genuinely holds 50+ real trust lines for currency code
// 504947454F4E5300000000000000000000000000 (the exact hex encoding of
// "PIGEONS"), with real non-zero balances, on a long-lived account
// (Sequence 96294601). Not the same address as PIGEON_ISSUER above — that
// one is the NFT collection issuer, this one is the fungible-token issuer,
// intentionally different per the user's own instruction.
export const PIGEONS_TOKEN_CONFIG = { currency: 'PIGEONS', issuer: 'rfQVVT7X5FynwK87EczgP2T8RQXmQcQSf', configured: true };

// XRPL currency codes are exactly 3 ASCII chars ("standard") or, for
// anything else, a 40-hex-char string: the code's ASCII bytes, left-
// justified and zero-padded to 20 bytes ("non-standard"/hex currency
// codes). $PIGEONS is 7 chars, so it needs the hex form — this mirrors
// that encoding exactly rather than requiring it be pre-encoded by hand.
export function encodeCurrencyCode(code) {
  if (!code) return code;
  if (code.length === 3 && code.toUpperCase() !== 'XRP') return code;
  const bytes = new Uint8Array(20);
  bytes.set(new TextEncoder().encode(code).slice(0, 20));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// tfTransferable (0x0008) — an NFT without this flag can never be sold to
// anyone but its issuer, so a sell offer against it would only ever fail
// on-ledger. Checked before a listing payload is ever built.
export function isTransferable(nft) {
  return !!(nft && typeof nft.Flags === 'number' && (nft.Flags & 0x0008) !== 0);
}

// The Σκύλλα $PIGEONS offer among a NFT's real sell offers — NEVER
// `offers[0]` or `offers.find(o => o.owner === x)` alone. A single Pigeon
// can carry multiple simultaneous sell offers from the same owner in
// different currencies (confirmed live: one wallet had both a real 22.22
// XRP Deeptide listing AND a real $PIGEONS Scylla listing on the same
// NFT at once) — matching on owner alone silently grabs whichever offer
// happens to come first, regardless of currency. This is what BUY,
// DELIST, and the listings index must all match against; `owner` is
// optional (omit to find the currency match regardless of who created
// it, e.g. for BUY where the buyer isn't the offer's owner).
export function findPigeonsOffer(offers, owner) {
  const currency = encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency);
  return offers.find(o =>
    (owner === undefined || o.owner === owner) &&
    o.amount && typeof o.amount === 'object' &&
    o.amount.currency === currency &&
    o.amount.issuer === PIGEONS_TOKEN_CONFIG.issuer
  ) || null;
}

// Real on-ledger sell offers for one NFT — the authoritative "is this
// actually listed, and for how much" source. xrplcluster.com rate-limits
// (returns a plain-text "Rate limit..." body, not JSON) under bursts of
// concurrent calls — confirmed live while testing the LISTED view's
// per-item re-verification, which used to crash this on res.json().
//
// Two variants, deliberately different failure behavior:
// - fetchNftSellOffersOrNull: returns null when the lookup itself failed
//   (rate-limited, network error, bad response) vs [] for a confirmed-empty
//   result. DELIST's "is the offer really gone" check is a SINGLE signal —
//   if a transient failure were silently treated as "gone," a rate-limit
//   blip could wrongly declare DELISTED while the offer is still live. Use
//   this version anywhere "gone" must mean genuinely confirmed gone, not
//   just "couldn't check."
// - fetchNftSellOffers: the tolerant [] on any failure, for display/
//   discovery paths (LISTED view, badges, prepare/payload lookups) where
//   failing toward "not listed" is an acceptable, non-unsafe degradation —
//   worst case a real listing doesn't show or a step needs retrying, never
//   a false success.
// Retries once with a short backoff before giving up — xrplcluster.com's
// rate limit is bursty, not sustained, so a brief pause is often enough
// to clear it. Confirmed live: BUY was intermittently reporting a
// genuinely-listed Pigeon as "not listed" purely because a single failed
// lookup attempt was being read as a definitive answer.
export async function fetchNftSellOffersOrNull(nftId, attempt) {
  attempt = attempt || 0;
  try {
    const res = await fetch('https://xrplcluster.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'nft_sell_offers', params: [{ nft_id: nftId }] })
    });
    const data = await res.json();
    if (!data.result || data.result.error) return [];
    return data.result.offers || [];
  } catch (e) {
    if (attempt < 1) {
      await new Promise(resolve => setTimeout(resolve, 350));
      return fetchNftSellOffersOrNull(nftId, attempt + 1);
    }
    return null;
  }
}

export async function fetchNftSellOffers(nftId) {
  const result = await fetchNftSellOffersOrNull(nftId);
  return result === null ? [] : result;
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

  // Piggybacks on the same full scan for the SWAP page's "top 10 holders"
  // dropdown — no reason to run a second Clio scan just for this.
  const topHolders = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([wallet, count]) => ({ wallet, count }));

  const snapshot = {
    wallet: crownWallet,
    count: maxCount,
    since: crownSince,
    computedAt: now,
    holderCount: counts.size,
    topHolders,
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
// Σκύλλα SWAP :: Pigeon collection data-access layer (Phase 2).
//
// Real data throughout — and now sourced far more efficiently than the
// original ledger-scan design. Deeptide (the same marketplace already
// trusted for King rarity via getTopKingRarity below) turns out to run a
// full collection-wide, paginated, sortable, trait-filterable listings API
// for the xrpigeons shop — confirmed by watching soitbegins's own
// marketplace frontend make these exact calls. That single API covers
// browsing, sorting (including real rarity), AND-filtering by trait, and
// single-token detail (with fresh owner + per-trait rarity percentages)
// in a handful of cheap fetch() calls, with no per-token KV writes needed
// at all for the core browsing experience. This replaces the earlier
// ledger-scan-plus-custom-KV-index design (which was burning the KV
// account's daily write quota and Cloudflare's per-request subrequest
// budget just to reconstruct data Deeptide already serves directly).
//
// The only piece Deeptide's API doesn't cover is "look up a Pigeon by its
// display number" (e.g. searching "1842") — so a lightweight number ->
// NFTokenID map is still built and cached in KV, but now by crawling
// Deeptide's own cheap listings pages (no ledger scan, no per-token
// writes), not the old per-token indexing scheme.
// ─────────────────────────────────────────────────────────────────────────

// Matches board.js's own TOTAL_PIGEONS figure — an approximation for
// display only ("~3015 P!GE0NS"), never a live-counted total.
export const PIGEON_COLLECTION_SIZE_APPROX = 3015;

// Every write below is a caching optimization, never required for a
// response to be correct. Cloudflare KV's free plan has a hard daily write
// quota (1,000/day); once exhausted, every kv.put() throws until it resets
// at UTC midnight. Swallowing that here means a quota exhaustion pauses
// caching (a little slower, re-fetches from Deeptide more often) instead
// of breaking the actual browsing/search experience.
async function safeKvPut(kv, key, value, opts) {
  try {
    await kv.put(key, value, opts);
  } catch (e) {
    // Quota exhaustion or any other transient KV failure — not fatal.
  }
}

// Runs `fn` over `items` with at most `limit` in flight at once, rather
// than Promise.all-ing everything simultaneously. xrplcluster.com
// rate-limits under bursts of concurrent calls (confirmed live — a burst
// of ~40 concurrent nft_sell_offers requests was enough to trip it,
// silently returning empty results everywhere fetchNftSellOffers's own
// tolerant fail-safe kicked in). Anywhere iterating XRPL calls per item
// should use this instead of a bare Promise.all.
export async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(limit, items.length); w++) workers.push(worker());
  await Promise.all(workers);
  return results;
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

// IPFS fallback for the rare token Deeptide hasn't synced yet — number,
// image, and the complete `attributes` array, whatever shape the
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

// ─────────────────────────────────────────────────────────────────────────
// Deeptide: per-wallet holdings (used for the "SELECT -> load owner's
// collection" flow) and the collection-wide listings/detail/trait-card/
// sales APIs (used for the main browse/search/filter/sort/sales-history
// experience).
//
// Every function below takes an explicit `shopSlug` (defaulting to the
// Pigeons shop) rather than hardcoding it, and every KV cache key is
// namespaced by slug — Pigeons is the only collection wired up today, but
// this is deliberately the seam for importing another Deeptide-hosted
// collection later: pass its shop slug through from a caller and the same
// data-access layer works unchanged. Ledger-side pigeon detection
// (findAllPigeons / PIGEON_ISSUER / PIGEON_TAXON below, and the Clio-based
// top-holders scan) is still Pigeons-specific — genericizing that too is
// future work, not needed until a second collection is actually added.
// ─────────────────────────────────────────────────────────────────────────
export const DEEPTIDE_PIGEON_SHOP_SLUG = 'xrpigeons';
const DEEPTIDE_OWNER_CACHE_PREFIX = 'pswap:deeptideowner:';
const DEEPTIDE_OWNER_CACHE_TTL_SECONDS = 180;
const DEEPTIDE_LISTINGS_MAX_LIMIT = 60; // server-enforced cap, confirmed empirically
function deeptideListingsUrl(shopSlug) {
  return `https://api.deeptide.co/api/mint/listings/${encodeURIComponent(shopSlug)}`;
}

async function fetchDeeptideOwnedPigeons(address, shopSlug = DEEPTIDE_PIGEON_SHOP_SLUG) {
  try {
    const res = await fetch(`${DEEPTIDE_API_BASE}/api/mint/owned?address=${encodeURIComponent(address)}`);
    if (!res.ok) return [];
    const items = await res.json();
    if (!Array.isArray(items)) return [];
    return items
      .filter(it => it.shopSlug === shopSlug)
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
// any collection-wide cache, since a wallet's holdings genuinely change.
async function getOwnerPigeonsViaDeeptide(kv, address, shopSlug = DEEPTIDE_PIGEON_SHOP_SLUG) {
  const cacheKey = DEEPTIDE_OWNER_CACHE_PREFIX + shopSlug + ':' + address;
  const cached = await kv.get(cacheKey);
  if (cached !== null) return JSON.parse(cached);
  const items = await fetchDeeptideOwnedPigeons(address, shopSlug);
  await safeKvPut(kv, cacheKey, JSON.stringify(items), { expirationTtl: DEEPTIDE_OWNER_CACHE_TTL_SECONDS });
  return items;
}

// Live, uncached view of one wallet's real holdings — a single Deeptide
// call already returns every token's image/traits/rarity in one shot, so
// there's no need to also write each one to a cache just to display this
// response. Used for the "SELECT -> load owner's collection" flow, where
// the wallet size isn't bounded by us (some hold 100+ Pigeons).
export async function resolveOwnerCollectionLive(kv, owner, ledgerItems, shopSlug = DEEPTIDE_PIGEON_SHOP_SLUG) {
  const deeptideItems = await getOwnerPigeonsViaDeeptide(kv, owner, shopSlug);
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

function deeptideListingToPigeon(it) {
  const match = it.name ? String(it.name).match(/(\d+)/) : null;
  return {
    nftId: it.nftTokenId,
    number: match ? parseInt(match[1], 10) : null,
    image: it.imageUrl || null,
    attributes: Array.isArray(it.traits) ? it.traits : [],
    rarityRank: typeof it.rarityRank === 'number' ? it.rarityRank : null,
    rarityTotal: typeof it.rarityTotal === 'number' ? it.rarityTotal : null,
    owner: it.currentOwner || null,
    // Real, current lowest sell-offer price, straight from Deeptide's own
    // listing record (not a snapshot) — null when nobody's selling it.
    priceDrops: typeof it.lowestSellDrops === 'number' ? it.lowestSellDrops : null,
  };
}

// One page of the REAL, complete, live collection — sorted (rarity by
// default; also price/name/date, matching what Deeptide's own marketplace
// UI offers) and optionally AND-filtered by trait. No KV involved at all;
// this is a direct pass-through, so it's always fully up to date and never
// partial. `sort` uses Deeptide's own values: rarity-asc (rarest first),
// rarity-desc, price-asc, price-desc, name-asc, name-desc, date-desc,
// date-asc. `traits` is [{ trait, value }, ...] — ALL must match (AND).
export async function fetchDeeptideListings({ skip = 0, limit = 36, sort = 'rarity-asc', traits, shopSlug = DEEPTIDE_PIGEON_SHOP_SLUG } = {}) {
  const params = new URLSearchParams({
    skip: String(Math.max(0, skip)),
    limit: String(Math.min(Math.max(1, limit), DEEPTIDE_LISTINGS_MAX_LIMIT)),
    sort,
  });
  if (traits && traits.length) {
    params.set('traits', JSON.stringify(traits.map(f => ({ trait_type: f.trait, value: f.value }))));
  }
  try {
    const res = await fetch(`${deeptideListingsUrl(shopSlug)}?${params.toString()}`);
    if (!res.ok) return { items: [], total: 0, hasMore: false };
    const data = await res.json();
    return {
      items: (data.items || []).map(deeptideListingToPigeon),
      total: typeof data.total === 'number' ? data.total : 0,
      hasMore: !!data.hasMore,
    };
  } catch (e) {
    return { items: [], total: 0, hasMore: false, error: true };
  }
}

// Fresh single-token detail — real current owner, full traits (each with
// Deeptide's own collection-wide count/percentage, so trait rarity is
// exact, not sampled), and rarity rank/total. Used for the INSPECT screen
// and for resolving a number-search hit to current data.
export async function fetchDeeptideNftDetail(nftId) {
  try {
    const res = await fetch(`${DEEPTIDE_API_BASE}/api/mint/nft/${encodeURIComponent(nftId)}`);
    if (!res.ok) return null;
    const d = await res.json();
    const listing = d.listing || {};
    const match = listing.name ? String(listing.name).match(/(\d+)/) : null;
    // `destination` on a sell offer is NOT a private targeted-buyer offer
    // here — checked live, it's consistently Deeptide's own marketplace
    // wallet across many real active listings, i.e. how their "Buy Now"
    // flow routes the accept transaction. Still worth excluding
    // `ownerMismatch` offers (Deeptide's own field) — the signer no longer
    // holds the NFT, a stale/orphaned offer still sitting on-ledger.
    const validSellAmounts = (d.sellOffers || [])
      .filter(o => !o.ownerMismatch)
      .map(o => parseInt(o.amount, 10))
      .filter(n => !isNaN(n));
    return {
      nftId: d.tokenId || nftId,
      number: match ? parseInt(match[1], 10) : null,
      image: listing.imageUrl || null,
      attributes: (listing.traits || []).map(t => ({ trait_type: t.trait_type, value: t.value, percent: t.percentage })),
      rarityRank: typeof listing.rarityRank === 'number' ? listing.rarityRank : null,
      rarityTotal: typeof listing.rarityTotal === 'number' ? listing.rarityTotal : null,
      owner: d.owner || null,
      priceDrops: validSellAmounts.length ? Math.min(...validSellAmounts) : null,
    };
  } catch (e) {
    return null;
  }
}

// The real, buyable Deeptide floor — the listings feed's own cached
// `lowestSellDrops` (used for card sort/price display) doesn't carry
// enough per-offer detail to know if that cheapest offer is actually
// public and current (see fetchDeeptideNftDetail's filtering above), so
// this walks price-asc order and detail-fetches each candidate until it
// finds one whose price survives that same validation. Usually 1-2 fetches
// since invalid offers are the exception, not the rule; capped at 10.
export async function fetchDeeptideRealFloor(shopSlug = DEEPTIDE_PIGEON_SHOP_SLUG) {
  const page = await fetchDeeptideListings({ skip: 0, limit: 10, sort: 'price-asc', shopSlug });
  for (const it of page.items) {
    if (it.priceDrops === null || it.priceDrops === undefined) continue;
    const detail = await fetchDeeptideNftDetail(it.nftId);
    if (detail && detail.priceDrops !== null) {
      return { nftId: detail.nftId, priceDrops: detail.priceDrops };
    }
  }
  return null;
}

// Full real event history for one token — mint, transfers, and sales, each
// with its own txHash — straight from Deeptide's own per-item history
// endpoint (confirmed via `/api/mint/nft/{id}/history`, distinct from the
// shop/wallet-wide `/api/sales/recent` used elsewhere, which has no
// per-token filter). No KV involved. Used for the INSPECT screen's
// per-Pigeon sales history.
export async function fetchDeeptideNftHistory(nftId) {
  try {
    const res = await fetch(`${DEEPTIDE_API_BASE}/api/mint/nft/${encodeURIComponent(nftId)}/history`);
    if (!res.ok) return [];
    const d = await res.json();
    return (d.events || []).map(e => ({
      type: e.type,
      priceDrops: e.priceDrops !== undefined ? parseInt(e.priceDrops, 10) : null,
      buyer: e.buyer || null,
      account: e.account || null,
      receiver: e.receiver || null,
      date: e.date || null,
      txHash: e.hash || null,
    }));
  } catch (e) {
    return [];
  }
}

// One page of "trait cards" — every distinct (category, value) combo in
// the collection with its real, exact count. Powers the TRAITS filter
// panel's category/value/percentage display.
async function fetchDeeptideTraitCards(skip, limit, shopSlug = DEEPTIDE_PIGEON_SHOP_SLUG) {
  try {
    const res = await fetch(`${deeptideListingsUrl(shopSlug)}/trait-cards?skip=${skip}&limit=${limit}&sort=rarest`);
    if (!res.ok) return { traits: [], total: 0 };
    return await res.json();
  } catch (e) {
    return { traits: [], total: 0 };
  }
}

// Real trait categories/values/percentages, grouped for the filter panel.
// Cached for 10 minutes (collection-wide trait distribution barely moves)
// so opening the TRAITS panel doesn't re-crawl every card on every click.
const TRAIT_CARDS_CACHE_KEY_PREFIX = 'pswap:traitcards:v2:';
const TRAIT_CARDS_CACHE_TTL_SECONDS = 600;
export async function getTraitCategoriesWithPercent(kv, shopSlug = DEEPTIDE_PIGEON_SHOP_SLUG, collectionSizeApprox = PIGEON_COLLECTION_SIZE_APPROX) {
  const cacheKey = TRAIT_CARDS_CACHE_KEY_PREFIX + shopSlug;
  const cached = await kv.get(cacheKey);
  if (cached !== null) return JSON.parse(cached);

  let skip = 0;
  let total = Infinity;
  const all = [];
  while (skip < total && skip < 600) { // 600 is a generous ceiling well above the real ~242
    const page = await fetchDeeptideTraitCards(skip, DEEPTIDE_LISTINGS_MAX_LIMIT, shopSlug);
    total = page.total || 0;
    if (!page.traits || !page.traits.length) break;
    all.push(...page.traits);
    skip += DEEPTIDE_LISTINGS_MAX_LIMIT;
  }

  const grouped = {};
  for (const t of all) {
    if (!t.trait_type || !t.value || t.value.startsWith('__')) continue; // Deeptide's internal "no trait" placeholder

    if (!grouped[t.trait_type]) grouped[t.trait_type] = [];
    grouped[t.trait_type].push({
      value: t.value,
      count: t.count,
      percent: Math.round((t.count / collectionSizeApprox) * 1000) / 10,
    });
  }
  for (const cat of Object.keys(grouped)) grouped[cat].sort((a, b) => a.value.localeCompare(b.value));

  await safeKvPut(kv, cacheKey, JSON.stringify(grouped), { expirationTtl: TRAIT_CARDS_CACHE_TTL_SECONDS });
  return grouped;
}

// ─────────────────────────────────────────────────────────────────────────
// Sales history — Deeptide's own `/api/sales/recent` (confirmed by
// watching the SalesFeed component on deeptide.co's own shop pages make
// this exact call), real and collection-wide: txHash, both wallets, price
// in drops, and the item itself. No KV involved — direct passthrough, same
// as listings. Same `shopSlug` seam as everything else in this section, so
// a future imported collection gets its own sales feed for free.
// ─────────────────────────────────────────────────────────────────────────
export async function fetchDeeptideSalesHistory({ skip = 0, limit = 20, sort = 'date-desc', shopSlug = DEEPTIDE_PIGEON_SHOP_SLUG, wallet } = {}) {
  const params = new URLSearchParams({
    skip: String(Math.max(0, skip)),
    limit: String(Math.min(Math.max(1, limit), 50)),
    sort,
    shopSlug,
  });
  if (wallet) params.set('address', wallet);
  try {
    const res = await fetch(`${DEEPTIDE_API_BASE}/api/sales/recent?${params.toString()}`);
    if (!res.ok) return { items: [], total: 0, hasMore: false };
    const data = await res.json();
    return {
      items: (data.items || []).map(it => {
        const match = it.name ? String(it.name).match(/(\d+)/) : null;
        return {
          txHash: it.txHash,
          nftId: it.nftTokenId,
          number: match ? parseInt(match[1], 10) : null,
          image: it.imageUrl || null,
          priceXrp: typeof it.priceDrops === 'number' ? it.priceDrops / 1000000 : null,
          buyer: it.buyerWallet || null,
          seller: it.sellerWallet || null,
          createdAt: it.createdAt || null,
        };
      }),
      total: typeof data.total === 'number' ? data.total : 0,
      hasMore: !!data.hasMore,
    };
  } catch (e) {
    return { items: [], total: 0, hasMore: false, error: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// xrp.cafe's own collection stats — a second real, independent source for
// floor price (their own listings, separate liquidity from Deeptide's),
// total volume, and listed %. xrp.cafe's *site* is behind a Cloudflare
// bot-check page, but this is their own public JSON API their frontend
// calls (confirmed via curl — plain 200, no challenge), same category as
// Deeptide's API, not a scrape of the challenged HTML. Cached briefly
// since it's a live external call on every /swap page load otherwise.
// ─────────────────────────────────────────────────────────────────────────
const XRP_CAFE_API_BASE = 'https://api.xrp.cafe';
const XRP_CAFE_STATS_CACHE_KEY_PREFIX = 'pswap:xrpcafestats:v1:';
const XRP_CAFE_STATS_CACHE_TTL_SECONDS = 300;

export async function fetchXrpCafeCollectionStats(kv, vanitySlug = 'xrpigeons') {
  const cacheKey = XRP_CAFE_STATS_CACHE_KEY_PREFIX + vanitySlug;
  const cached = await kv.get(cacheKey);
  if (cached !== null) return JSON.parse(cached);

  let stats = null;
  try {
    const res = await fetch(`${XRP_CAFE_API_BASE}/api/collection/${encodeURIComponent(vanitySlug)}`);
    if (res.ok) {
      const arr = await res.json();
      const c = Array.isArray(arr) ? arr[0] : null;
      if (c) {
        stats = {
          floorDrops: typeof c.FloorPrice === 'number' ? c.FloorPrice : null,
          totalVolumeDrops: c.totalCollectionVolume ? parseInt(c.totalCollectionVolume, 10) : null,
          holders: typeof c.holders === 'number' ? c.holders : null,
          nftCount: typeof c.nft_count === 'number' ? c.nft_count : null,
          percentListed: c.percentListed ? parseFloat(c.percentListed) : null,
        };
      }
    }
  } catch (e) {
    stats = null;
  }

  await safeKvPut(kv, cacheKey, JSON.stringify(stats), { expirationTtl: XRP_CAFE_STATS_CACHE_TTL_SECONDS });
  return stats;
}

// Per-token listing on xrp.cafe — real-time, uncached (same cadence as
// Deeptide's own per-token detail fetch), for the INSPECT screen's
// LISTINGS section. `amount` is null when nobody's selling it there;
// present in the same raw-XRP units as this API's own `floor_price`
// field (unlike Deeptide, which uses drops for offer amounts).
export async function fetchXrpCafeNftListing(nftId) {
  try {
    const res = await fetch(`${XRP_CAFE_API_BASE}/api/nft/${encodeURIComponent(nftId)}`);
    if (!res.ok) return null;
    const d = await res.json();
    const n = d.nft;
    if (!n) return null;
    // Same stale-offer guard as Deeptide: only trust the amount if the
    // offer's own account still actually holds the NFT.
    const validOffer = n.amount !== null && n.amount !== undefined
      && n.offerowner && n.actualowner && n.offerowner === n.actualowner;
    // `amount` here is in drops, NOT XRP — confirmed against real live
    // listings (e.g. a genuine ~1589 XRP listing came back as
    // "1589000000"); this API's own collection-level `floor_price` field
    // is in XRP, so the two aren't unit-consistent with each other. Every
    // xrp.cafe "listing" shown before this fix was off by 1,000,000x.
    return {
      priceXrp: validOffer ? parseFloat(n.amount) / 1000000 : null,
    };
  } catch (e) {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Number -> NFTokenID map, so searching "1842" can resolve directly. Built
// by crawling Deeptide's own cheap listings pages (no ledger scan, no
// per-token KV writes) in bounded batches, self-resuming via a saved skip
// cursor — a full crawl is only ~51 pages of 60, so this completes in a
// handful of real page loads rather than weeks, unlike the old per-token
// ledger-scan indexer it replaces.
// ─────────────────────────────────────────────────────────────────────────
const PIGEON_NUMBER_MAP_KEY = 'pswap:numbermap:v1';
const PIGEON_NUMBER_MAP_STATS_KEY = 'pswap:numbermapstats:v1';
const NUMBER_MAP_REFRESH_STALE_SECONDS = 6 * 3600;
const NUMBER_MAP_CONCURRENT_GUARD_SECONDS = 10;
const NUMBER_MAP_PAGES_PER_RUN = 15; // 15 * 60 = 900 tokens/run, ~15 fetches — safely under the subrequest budget

export async function getPigeonNumberMap(kv) {
  const raw = await kv.get(PIGEON_NUMBER_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function getPigeonNumberMapStats(kv) {
  const raw = await kv.get(PIGEON_NUMBER_MAP_STATS_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function maybeRefreshPigeonNumberMap(kv) {
  const statsRaw = await kv.get(PIGEON_NUMBER_MAP_STATS_KEY);
  const stats = statsRaw ? JSON.parse(statsRaw) : null;
  const now = Math.floor(Date.now() / 1000);
  if (stats && stats.inProgress && now - stats.updatedAt < NUMBER_MAP_CONCURRENT_GUARD_SECONDS) return;
  if (stats && !stats.inProgress && now - stats.completedAt < NUMBER_MAP_REFRESH_STALE_SECONDS) return;

  let skip = stats && stats.inProgress ? stats.nextSkip : 0;
  const map = stats && stats.inProgress ? await getPigeonNumberMap(kv) : {};
  let lastTotal = 3015;

  for (let i = 0; i < NUMBER_MAP_PAGES_PER_RUN; i++) {
    const page = await fetchDeeptideListings({ skip, limit: DEEPTIDE_LISTINGS_MAX_LIMIT, sort: 'rarity-asc' });
    if (page.error || !page.items.length) break;
    for (const it of page.items) {
      if (it.number !== null) map[it.number] = it.nftId;
    }
    lastTotal = page.total || lastTotal;
    skip += DEEPTIDE_LISTINGS_MAX_LIMIT;
    if (skip >= lastTotal) {
      await safeKvPut(kv, PIGEON_NUMBER_MAP_KEY, JSON.stringify(map));
      await safeKvPut(kv, PIGEON_NUMBER_MAP_STATS_KEY, JSON.stringify({
        inProgress: false, completedAt: now, updatedAt: now, count: Object.keys(map).length,
      }));
      return;
    }
  }
  await safeKvPut(kv, PIGEON_NUMBER_MAP_KEY, JSON.stringify(map));
  await safeKvPut(kv, PIGEON_NUMBER_MAP_STATS_KEY, JSON.stringify({
    inProgress: true, nextSkip: skip, updatedAt: now, count: Object.keys(map).length,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Highest-ever sale price per token — same self-resuming crawl pattern as
// the number map above, but over `/api/sales/recent` (date-desc, so it
// doesn't need to know the total up front) instead of listings. Keeps the
// max { drops, txHash } seen per nftId (the txHash is the specific sale
// that set that record, for linking straight to it on bithomp) — a token
// not yet in the map just hasn't been reached by the crawl (or has never
// sold) — callers show nothing in that case rather than treating it as
// zero. Powers the "HIGH SALE" line on cards, its bithomp link, and the
// "H!GHEST SALE" sort.
// v2: map values became { drops, txHash } instead of a bare drops number —
// bump the key again if the shape changes further.
// ─────────────────────────────────────────────────────────────────────────
const HIGH_SALE_MAP_KEY = 'pswap:highsale:v2';
const HIGH_SALE_STATS_KEY = 'pswap:highsalestats:v2';
const HIGH_SALE_REFRESH_STALE_SECONDS = 6 * 3600;
const HIGH_SALE_CONCURRENT_GUARD_SECONDS = 10;
const HIGH_SALE_PAGES_PER_RUN = 10;
const HIGH_SALE_PAGE_LIMIT = 50; // server-enforced cap on /api/sales/recent

export async function getHighSaleMap(kv) {
  const raw = await kv.get(HIGH_SALE_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function maybeRefreshHighSaleMap(kv) {
  const statsRaw = await kv.get(HIGH_SALE_STATS_KEY);
  const stats = statsRaw ? JSON.parse(statsRaw) : null;
  const now = Math.floor(Date.now() / 1000);
  if (stats && stats.inProgress && now - stats.updatedAt < HIGH_SALE_CONCURRENT_GUARD_SECONDS) return;
  if (stats && !stats.inProgress && now - stats.completedAt < HIGH_SALE_REFRESH_STALE_SECONDS) return;

  let skip = stats && stats.inProgress ? stats.nextSkip : 0;
  const map = stats && stats.inProgress ? await getHighSaleMap(kv) : {};
  let lastTotal = Infinity;

  for (let i = 0; i < HIGH_SALE_PAGES_PER_RUN; i++) {
    const page = await fetchDeeptideSalesHistory({ skip, limit: HIGH_SALE_PAGE_LIMIT, sort: 'date-desc' });
    if (page.error || !page.items.length) break;
    for (const s of page.items) {
      if (!s.nftId || typeof s.priceXrp !== 'number') continue;
      const drops = Math.round(s.priceXrp * 1000000);
      const existing = map[s.nftId];
      if (!existing || drops > existing.drops) map[s.nftId] = { drops, txHash: s.txHash || null };
    }
    lastTotal = page.total || lastTotal;
    skip += HIGH_SALE_PAGE_LIMIT;
    if (!page.hasMore || skip >= lastTotal) {
      await safeKvPut(kv, HIGH_SALE_MAP_KEY, JSON.stringify(map));
      await safeKvPut(kv, HIGH_SALE_STATS_KEY, JSON.stringify({
        inProgress: false, completedAt: now, updatedAt: now, count: Object.keys(map).length,
      }));
      return;
    }
  }
  await safeKvPut(kv, HIGH_SALE_MAP_KEY, JSON.stringify(map));
  await safeKvPut(kv, HIGH_SALE_STATS_KEY, JSON.stringify({
    inProgress: true, nextSkip: skip, updatedAt: now, count: Object.keys(map).length,
  }));
}

// ─────────────────────────────────────────────────────────────────────────
// Σκύλλα SWAP listings index — nftId -> { price, currency, issuer, offerId,
// seller, listedAt }, written the moment swap-listing-status.js confirms a
// listing on-ledger. Unlike the number-search/highest-sale maps above, this
// isn't a crawl of external data — it's the direct record of what THIS
// system has listed, so it's complete and correct as soon as it's written
// (no "still indexing" state). It can still go stale if a listing is later
// cancelled or the NFT sells through some other route entirely outside
// Σκύλλα SWAP — the LISTED browse view re-verifies against real
// nft_sell_offers for whatever page it's showing and self-heals (removes)
// any entry that's no longer actually there; badges shown elsewhere in the
// normal browse grid are cheap (one KV read, no per-card XRPL calls) but
// are only as fresh as the last time that NFT was re-verified.
// ─────────────────────────────────────────────────────────────────────────
const SWAP_LISTINGS_MAP_KEY = 'pswap:listings:v1';

export async function getSwapListingsMap(kv) {
  const raw = await kv.get(SWAP_LISTINGS_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function recordSwapListing(kv, nftId, entry) {
  const map = await getSwapListingsMap(kv);
  map[nftId] = entry;
  await safeKvPut(kv, SWAP_LISTINGS_MAP_KEY, JSON.stringify(map));
}

export async function removeSwapListing(kv, nftId) {
  const map = await getSwapListingsMap(kv);
  if (!map[nftId]) return;
  delete map[nftId];
  await safeKvPut(kv, SWAP_LISTINGS_MAP_KEY, JSON.stringify(map));
}

// Shared Xaman Payload API calls — used by swap-buy-payload.js,
// swap-buy-status.js, swap-delist-payload.js, swap-delist-status.js (the
// original swap-listing-*.js files predate this and keep their own inline
// fetch calls rather than being refactored, to avoid touching already-
// tested code). apiSecret is only ever env.XAMAN_API_SECRET, passed in by
// the caller — never stored or logged here.
//
// Both wrapped in try/catch AND bounded by an explicit AbortController
// timeout. try/catch alone isn't enough: if xumm.app is genuinely slow,
// Cloudflare's own platform-level timeout can kill the whole request
// from OUTSIDE this function before our try/catch ever gets a chance to
// run, and Cloudflare's own timeout page isn't JSON — reported live as a
// WebKit "SyntaxError: The string did not match the expected pattern"
// (Safari's phrasing for "tried to JSON.parse a non-JSON body") on the
// client. Aborting first, on our own terms, well before that external
// kill, turns it into a normal caught rejection returning null — already
// handled by every call site as a clean xaman_request_failed/
// xaman_lookup_failed response.
const XAMAN_FETCH_TIMEOUT_MS = 10000;

export async function createXamanPayload(apiKey, apiSecret, txjson, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), XAMAN_FETCH_TIMEOUT_MS);
  try {
    // Reverted the User-Agent/Accept headers added in the previous commit —
    // confirmed live those coincided with the FIRST captured non-ok status
    // (400, with cf-ray missing from the response, suggesting it may not
    // even have reached xumm.app's actual origin), while an identical curl
    // request WITH those same headers succeeded fine outside the Workers
    // runtime. Testing whether Cloudflare Workers specifically restricts a
    // custom User-Agent on outbound fetch by going back to the bare
    // headers that were in place before that change.
    const res = await fetch('https://xumm.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-API-Secret': apiSecret
      },
      body: JSON.stringify({ txjson, options: options || { submit: true, expire: 5 } }),
      signal: controller.signal
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '(unreadable)');
      console.log('createXamanPayload not ok:', res.status, res.headers.get('cf-ray'), bodyText.slice(0, 300));
      return null;
    }
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getXamanPayloadStatus(apiKey, apiSecret, uuid) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), XAMAN_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('https://xumm.app/api/v1/platform/payload/' + uuid, {
      headers: { 'X-API-Key': apiKey, 'X-API-Secret': apiSecret },
      signal: controller.signal
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
