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
  // A malformed cookie (stale format, truncated, tampered) makes atob()
  // throw inside fromBase64Url, or JSON.parse throw on the decoded
  // payload — uncaught, that's an unhandled exception in the Function,
  // which Cloudflare turns into its own HTML error page instead of our
  // JSON response. Every call site expects null for "not signed in," not
  // a crash, so any malformed-token failure is treated the same way.
  try {
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
  } catch (e) {
    return null;
  }
}

// xrplcluster.com rate-limits under bursts (plain-text body, not JSON) —
// confirmed the actual cause of the SWAP page's "click a wallet, get 0
// Pigeons back" reports: this hit most often on the very FIRST page (no
// marker yet), so a single rate-limited request was enough to make an
// otherwise-real wallet look completely empty. Several short retries per
// page before giving up on it (bumped from 3 to 5 attempts, growing
// backoff — confirmed live via production log tail that 3 wasn't always
// enough under real load) — cheap and doesn't change the function's
// contract: it still never throws, still returns whatever's been
// collected so far if every attempt on a page fails. Every caller
// (including the write/auth paths — verify, redeem, swap sign flows)
// still treats a short/empty result as "owns nothing here," same
// fail-toward-refusing behavior as before, just less likely to trip on a
// transient blip.
async function fetchAccountNftsPage(account, marker) {
  const params = { account, limit: 400 };
  if (marker) params.marker = marker;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 300 + attempt * 150));
    try {
      const res = await fetch('https://xrplcluster.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'account_nfts', params: [params] })
      });
      return await res.json();
    } catch (e) {
      // Non-JSON (rate-limit) body, or the fetch itself failed — try again
      // if attempts remain, otherwise fall through and give up on this page.
    }
  }
  return null;
}

export async function fetchAllAccountNfts(account) {
  let all = [];
  let marker;
  do {
    const data = await fetchAccountNftsPage(account, marker);
    if (!data) break;
    const nfts = (data.result && data.result.account_nfts) || [];
    all = all.concat(nfts);
    marker = data.result && data.result.marker;
  } while (marker);
  return all;
}

// Same live pagination as fetchAllAccountNfts, but also reports whether
// every page genuinely succeeded — fetchAllAccountNfts alone can't tell a
// caller "this wallet really owns 0 Pigeons" apart from "the scan gave up
// early after xrplcluster.com stayed rate-limited through all 3 retries on
// some page," both return the same empty array either way. That
// ambiguity is exactly what caused the SWAP page's wallet search to
// sometimes show "N0 P!GE0N MATCH" for a wallet that was never actually
// empty — a plain HTTP 200 with items:[] looks identical to a real empty
// result, so the client's own retry-on-failure logic never even saw a
// failure to retry. Deliberately a SEPARATE function rather than changing
// fetchAllAccountNfts's return shape — that one is used across ~15 files
// including auth/signing paths that all expect a plain array back.
export async function fetchAllAccountNftsChecked(account) {
  let all = [];
  let marker;
  let ok = true;
  do {
    const data = await fetchAccountNftsPage(account, marker);
    if (!data) { ok = false; break; }
    const nfts = (data.result && data.result.account_nfts) || [];
    all = all.concat(nfts);
    marker = data.result && data.result.marker;
  } while (marker);
  return { nfts: all, ok };
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

export function stringToHex(str) {
  return Array.from(new TextEncoder().encode(str)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// Attached to every real NFTokenCreateOffer this app builds (LIST, MAKE
// AN OFFER, the swap builder's own offer) so any offer created through
// Σκύλλα identifies its source and exact origin page on-ledger, visible
// to anyone inspecting the transaction (Bithomp, xrpscan, etc) — not
// just in this app's own UI. Standard XRPL Memo fields, hex-encoded per
// the ledger's own requirement (plain ASCII/UTF-8 isn't valid here).
export function swapOfferSourceMemo() {
  return [{
    Memo: {
      MemoType: stringToHex('Source'),
      MemoFormat: stringToHex('text/plain'),
      MemoData: stringToHex('https://soitbegins.xyz/static')
    }
  }];
}

// ---- $PIGEONS listing duration — a real XRPL NFTokenCreateOffer
// Expiration, not app-side enforcement; the ledger itself refuses to
// accept (or even keep showing via nft_sell_offers, once something
// touches it) an expired offer. Only these four presets are ever
// accepted server-side (swap-listing-prepare.js/-payload.js both
// re-validate independently, same "never trust the client" pattern as
// price) — an out-of-range or missing value quietly falls back to the
// default rather than erroring, since this is a preference, not
// something that can create an unsafe transaction. ----
export const LISTING_DURATION_DAYS_ALLOWED = [1, 3, 7, 30];
export const DEFAULT_LISTING_DURATION_DAYS = 7;
const RIPPLE_EPOCH_OFFSET_SECONDS = 946684800; // 2000-01-01T00:00:00Z, vs. Unix's 1970 epoch

export function listingExpirationRippleSeconds(durationDays) {
  const days = LISTING_DURATION_DAYS_ALLOWED.includes(durationDays) ? durationDays : DEFAULT_LISTING_DURATION_DAYS;
  return Math.floor(Date.now() / 1000) - RIPPLE_EPOCH_OFFSET_SECONDS + days * 86400;
}

// ---- Brokered $PIGEONS sale — accepting a received MAKE AN OFFER buy
// offer settles through XRPL brokered NFTokenAcceptOffer instead of a
// direct accept, so the marketplace fee is taken atomically in the same
// transaction (NFTokenBrokerFee), never a second Payment. See
// swap-acceptoffer-prepare/-payload/-status.js for the full flow. ----

// The marketplace/developer wallet — signs the brokered accept itself
// (via the xaman-proxy's /broker-submit, not Xaman) and is the
// Destination the seller's own sell-offer must be restricted to.
export const MARKETPLACE_BROKER_WALLET = 'rpigEoNV9KYjK6P9kzFmTqesbpqv7dpnzK';

// 0.589% = 589 / 100000, kept as an integer basis-point ratio (not 0.00589
// as a float) so the fee math below never has to multiply by a repeating
// binary fraction.
export const MARKETPLACE_FEE_BASIS_POINTS = 589;

function decimalToMicroUnits(valueStr) {
  const n = Number(valueStr);
  return isFinite(n) ? Math.round(n * 1e6) : NaN;
}
function microUnitsToDecimalStr(micro) {
  const sign = micro < 0 ? '-' : '';
  const abs = Math.abs(micro);
  const intPart = Math.floor(abs / 1e6).toString();
  const fracPart = (abs % 1e6).toString().padStart(6, '0').replace(/0+$/, '');
  return sign + intPart + (fracPart ? '.' + fracPart : '');
}

// Centralized $PIGEONS marketplace fee math. Works in integer "micro-unit"
// (6-decimal-place) arithmetic rather than naive `total * 0.00589`
// floating point, so feeValue + sellerValue always sums back to exactly
// totalValue — the same reasoning a drops-based integer fee calc uses for
// XRP, adapted here for a $PIGEONS decimal-string amount instead of
// integer drops. Returns null for a non-finite/non-positive amount.
export function computeMarketplaceFee(totalValueStr) {
  const totalMicro = decimalToMicroUnits(totalValueStr);
  if (!isFinite(totalMicro) || totalMicro <= 0) return null;
  const feeMicro = Math.floor(totalMicro * MARKETPLACE_FEE_BASIS_POINTS / 100000);
  const sellerMicro = totalMicro - feeMicro;
  return {
    totalValue: microUnitsToDecimalStr(totalMicro),
    feeValue: microUnitsToDecimalStr(feeMicro),
    sellerValue: microUnitsToDecimalStr(sellerMicro)
  };
}

// Identifies the marketplace + which Pigeon on-ledger, alongside the
// generic swapOfferSourceMemo() (both ride in the same Memos array —
// XRPL allows multiple Memo entries per transaction).
export function brokeredSaleMemo(pigeonNumber) {
  const label = 'SOITBEGINS | PIGEON SALE' + (pigeonNumber !== null && pigeonNumber !== undefined ? ' | #' + pigeonNumber : '');
  return {
    Memo: {
      MemoType: stringToHex('SaleInfo'),
      MemoFormat: stringToHex('text/plain'),
      MemoData: stringToHex(label)
    }
  };
}

// $CRWN reward token, paid to both sides of a settled brokered sale as a
// thank-you for trading through Σκύλλα — a real currency/issuer (confirmed
// live by the user), but a DIFFERENT, purpose-specific config from
// KINGDOM_CLAIM_CONFIG.crwn above (that one is the unrelated Kingdom
// King-holder claim feature and stays untouched/unconfigured). TEST-PHASE
// only: a small flat amount per recipient while the real "percentage of
// sale price" reward math gets worked out later.
export const SWAP_REWARD_TOKEN_CONFIG = { currency: 'CRWN', issuer: 'r99LZRNxxss7eSJqKTSEvp1Xd48JGh5Vp5', configured: true };
export const SWAP_REWARD_TEST_AMOUNT = '1';

function rewardMemo(label) {
  return {
    Memo: {
      MemoType: stringToHex('RewardInfo'),
      MemoFormat: stringToHex('text/plain'),
      MemoData: stringToHex(label)
    }
  };
}

// Posts to the xaman-proxy's /broker-submit — the broker wallet signs and
// submits the given txjson itself (no Xaman involved, since the
// marketplace is a party to the transaction, not a user). Longer timeout
// than the Xaman payload calls: this does a full connect+autofill+sign+
// submitAndWait round trip against the XRPL network, not just a proxy
// hop.
const BROKER_SUBMIT_TIMEOUT_MS = 25000;
export async function submitAsBroker(env, txjson) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BROKER_SUBMIT_TIMEOUT_MS);
  try {
    const res = await fetch(env.XAMAN_PROXY_URL + '/broker-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Proxy-Secret': env.XAMAN_PROXY_SHARED_SECRET },
      body: JSON.stringify({ txjson }),
      signal: controller.signal
    });
    const data = await res.json().catch(() => null);
    return data || { ok: false, error: 'proxy_non_json_response' };
  } catch (e) {
    return { ok: false, error: 'proxy_unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

// Sends the $CRWN reward as its own Payment, signed by the broker wallet —
// deliberately a SEPARATE transaction from the brokered sale (XRPL's
// NFTokenAcceptOffer has no field for an arbitrary third-currency payout;
// this is the closest practical approximation to "at the same time,"
// fired immediately after the sale settles, not a real atomic guarantee).
// Failure here is non-fatal to the sale itself — logged, never allowed to
// undo or block a already-settled trade.
export async function payBrokerReward(env, destination, memoLabel) {
  if (!SWAP_REWARD_TOKEN_CONFIG.configured) return { ok: false, error: 'reward_not_configured' };
  const txjson = {
    TransactionType: 'Payment',
    Destination: destination,
    Amount: {
      currency: encodeCurrencyCode(SWAP_REWARD_TOKEN_CONFIG.currency),
      issuer: SWAP_REWARD_TOKEN_CONFIG.issuer,
      value: SWAP_REWARD_TEST_AMOUNT
    },
    Memos: [rewardMemo(memoLabel)]
  };
  return submitAsBroker(env, txjson);
}

// Confirms the broker wallet's $PIGEONS trust line actually moved by
// exactly the expected fee, straight from the settling transaction's OWN
// metadata (not a before/after wallet-balance snapshot, which a concurrent
// unrelated transfer could pollute). RippleState.Balance is signed from
// the LOW account's perspective, so the sign is flipped when the broker
// is the HIGH side, to always mean "the broker's real holding increased".
export function verifyBrokerFeeFromMeta(meta, brokerWallet, issuer, currencyCode, expectedFeeValue) {
  if (!meta || !Array.isArray(meta.AffectedNodes)) return { ok: false, reason: 'no_meta' };
  for (const node of meta.AffectedNodes) {
    const entry = node.ModifiedNode || node.CreatedNode;
    if (!entry || entry.LedgerEntryType !== 'RippleState') continue;
    const fields = entry.FinalFields || entry.NewFields;
    if (!fields || !fields.Balance || fields.Balance.currency !== currencyCode) continue;
    const lowLimit = fields.LowLimit, highLimit = fields.HighLimit;
    if (!lowLimit || !highLimit) continue;
    const brokerIsLow = lowLimit.issuer === brokerWallet;
    const brokerIsHigh = highLimit.issuer === brokerWallet;
    if (!brokerIsLow && !brokerIsHigh) continue;
    const otherIssuer = brokerIsLow ? highLimit.issuer : lowLimit.issuer;
    if (otherIssuer !== issuer) continue;
    const prevValue = entry.PreviousFields && entry.PreviousFields.Balance ? Number(entry.PreviousFields.Balance.value) : 0;
    const finalValue = Number(fields.Balance.value);
    const sign = brokerIsLow ? 1 : -1;
    const delta = (finalValue - prevValue) * sign;
    const expected = Number(expectedFeeValue);
    return { ok: Math.abs(delta - expected) < 1e-6, delta, expected };
  }
  return { ok: false, reason: 'broker_trustline_not_found_in_meta' };
}

// Bridges swap-acceptoffer-payload.js (which knows the buyer/fee/pigeon
// number right as it builds the seller's destination sell-offer txjson) to
// swap-acceptoffer-status.js (which only sees "did the seller's sell offer
// land yet" — by settlement time the original buy offer may already be
// gone). Same pattern as recordPendingBuy/takePendingBuy, kept separate
// since this flow needs more fields (fee breakdown, buy-offer id).
const PENDING_BROKER_ACCEPT_PREFIX = 'pswap:pendingbrokeraccept:';
const PENDING_BROKER_ACCEPT_TTL_SECONDS = 900;

export async function recordPendingBrokerAccept(kv, uuid, entry) {
  await safeKvPut(kv, PENDING_BROKER_ACCEPT_PREFIX + uuid, JSON.stringify(entry), { expirationTtl: PENDING_BROKER_ACCEPT_TTL_SECONDS });
}
export async function takePendingBrokerAccept(kv, uuid) {
  const raw = await kv.get(PENDING_BROKER_ACCEPT_PREFIX + uuid);
  if (!raw) return null;
  await kv.delete(PENDING_BROKER_ACCEPT_PREFIX + uuid).catch(() => {});
  return JSON.parse(raw);
}

// Best-effort guard against the same buy offer being committed to accept
// twice at once (two browser tabs, a double click before the button
// disables). Not a true atomic lock — Cloudflare KV has no compare-and-
// swap — but the ledger itself is the real backstop: only one brokered
// accept can ever succeed against a given NFTokenBuyOffer, since accepting
// it removes it. This just avoids wasted Xaman round-trips on the loser.
const BROKER_ACCEPT_LOCK_PREFIX = 'pswap:brokeracceptlock:';
const BROKER_ACCEPT_LOCK_TTL_SECONDS = 600;

export async function acquireBrokerAcceptLock(kv, offerId) {
  const key = BROKER_ACCEPT_LOCK_PREFIX + offerId;
  const existing = await kv.get(key);
  if (existing) return false;
  await safeKvPut(kv, key, '1', { expirationTtl: BROKER_ACCEPT_LOCK_TTL_SECONDS });
  return true;
}
export async function releaseBrokerAcceptLock(kv, offerId) {
  await kv.delete(BROKER_ACCEPT_LOCK_PREFIX + offerId).catch(() => {});
}

// Real live $PIGEONS/XRP rate. DexScreener's public API is the primary
// source — it derives price from actual recent trades (not just whatever
// the thinnest open order happens to quote), and is the same number
// dexscreener.com's own UI shows, so it matches what anyone checking the
// pair there already sees. Falls back to the XRPL DEX order book's own
// best live sell offer (real on-ledger data, never fabricated/guessed)
// only if DexScreener itself is unreachable.
const PIGEONS_DEXSCREENER_PAIR = '504947454f4e5300000000000000000000000000.rfqvvt7x5fynwk87eczgp2t8rqxmqcqsf_xrp';
// v2: switched from top-of-book best-ask to DexScreener's trade-derived
// price, and the cached shape grew (usdPerPigeon, dexUrl alongside
// xrpPerPigeon) — bump the key again if the shape changes further.
const PIGEONS_RATE_CACHE_KEY = 'pswap:pigeonsrate:v2';
const PIGEONS_RATE_CACHE_TTL_SECONDS = 60;

async function fetchPigeonsXrpRateFromBookOffers() {
  const data = await fetchXrplClusterJson({
    method: 'book_offers',
    params: [{
      taker_gets: { currency: encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency), issuer: PIGEONS_TOKEN_CONFIG.issuer },
      taker_pays: { currency: 'XRP' },
      limit: 5
    }]
  });
  if (!data) return null;
  const offers = (data.result && data.result.offers) || [];
  const best = offers.find(o => typeof o.TakerGets === 'object' && typeof o.TakerPays === 'string' && parseFloat(o.TakerGets.value) > 0);
  if (best) {
    const pigeonsOut = parseFloat(best.TakerGets.value);
    const dropsIn = parseFloat(best.TakerPays);
    if (pigeonsOut > 0 && dropsIn > 0) return (dropsIn / 1000000) / pigeonsOut;
  }
  return null;
}

// ---- BUY $PIGEONS swap — Stage 3: live quote only, no txjson/signing.
// Quotes the BETTER of two REAL, independently-verified liquidity
// sources — never a single assumed price:
//   1. The XRPL order book (taker_gets PIGEONS / taker_pays XRP), walked
//      depth-first in price-priority order, consuming real offers (or
//      their *_funded amount when an offer owner can't back the full
//      nominal size) until the requested XRP is spent or the book runs
//      dry — reflects real depth/slippage, never a flat top-of-book price
//      applied to the whole amount.
//   2. The real on-ledger $PIGEONS/XRP AMM pool (amm_info against
//      PIGEONS_AMM_ACCOUNT, confirmed live 2026-08-25 — 11,251.96 XRP /
//      44,771,538.34 PIGEONS, 1% trading fee), priced via the exact
//      constant-product formula XRPL's own AMM uses.
// Whichever source yields more PIGEONS for the exact input wins — this is
// what a real XRPL Payment naturally does too (the ledger's own execution
// engine consumes whichever liquidity is priced better up to the amounts
// available), not a guess at which source "should" be better. Honestly
// reports insufficientLiquidity if NEITHER source can fill the full
// amount, rather than extrapolating a price past what's really there. ----
const PIGEONS_QUOTE_BOOK_DEPTH = 60;
// Confirmed real, live pool via amm_info (see comment above) — supplied
// directly, not discovered/guessed; never trust a client-supplied AMM
// account for this, only this hardcoded server-side constant.
const PIGEONS_AMM_ACCOUNT = 'rn5vs1Q5pzwbpzFhK85sVsuXpieNitVCQg';

// Both lookups below used to hit xrplcluster.com directly, which
// rate-limits under bursts (a plain-text body instead of JSON, so
// res.json() throws) — confirmed live: this is exactly what made the BUY
// $PIGEONS quote intermittently report "N0T EN0UGH L!QU!D!TY" for
// perfectly normal amounts (a transient blip failing BOTH the order-book
// AND AMM lookups at once, since they run concurrently in
// quotePigeonsForXrpDrops), and — worse — silently degraded a REAL
// transaction's Amount when the AMM lookup alone failed but the (much
// worse-priced) order book still succeeded, so buildBuySwapTxjson quietly
// built a txjson worth roughly half the real market rate instead of
// erroring. Retries alone (bumped 3 -> 5 earlier) weren't consistently
// enough under real production load, confirmed via live log tailing
// during actual user reports — a single endpoint being degraded is a
// single endpoint being degraded no matter how many times you ask it
// again. Real endpoint diversity instead: try xrplcluster.com first (a
// couple of quick retries in case it's just a blip), then fail over to
// Ripple's own public full-history nodes (s1/s2.ripple.com — both
// verified independently healthy when xrplcluster.com wasn't) before
// giving up for real. console.log on each failed endpoint so a future
// production issue shows up directly in `wrangler pages deployment tail`
// instead of only being inferable from symptoms.
const XRPL_ENDPOINTS = ['https://xrplcluster.com', 'https://s1.ripple.com:51234', 'https://s2.ripple.com:51234'];
async function fetchXrplClusterJson(body) {
  for (const endpoint of XRPL_ENDPOINTS) {
    const attempts = endpoint === XRPL_ENDPOINTS[0] ? 3 : 1; // a couple of retries on the primary, one shot on each fallback
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 300 + attempt * 150));
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        return await res.json();
      } catch (e) {
        console.log('fetchXrplClusterJson failed', endpoint, 'attempt', attempt, String(e && e.message || e), 'method:', body && body.method);
      }
    }
  }
  return null;
}

async function fetchPigeonsBookOffers(limit) {
  const data = await fetchXrplClusterJson({
    method: 'book_offers',
    params: [{
      taker_gets: { currency: encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency), issuer: PIGEONS_TOKEN_CONFIG.issuer },
      taker_pays: { currency: 'XRP' },
      limit: limit
    }]
  });
  return (data && data.result && data.result.offers) || [];
}

// Real live pool reserves + trading fee, straight from amm_info — never
// cached (the whole point of a constant-product quote is that reserves
// shift with every trade, a stale snapshot would misprice immediately).
// Returns null on any lookup/shape failure, never a fabricated fallback.
async function fetchPigeonsAmmPool() {
  try {
    const data = await fetchXrplClusterJson({ method: 'amm_info', params: [{ amm_account: PIGEONS_AMM_ACCOUNT }] });
    if (!data) { console.log('fetchPigeonsAmmPool: all endpoints failed'); return null; }
    const amm = data && data.result && data.result.amm;
    if (!amm) { console.log('fetchPigeonsAmmPool: no amm in response', JSON.stringify(data).slice(0, 300)); return null; }
    // amount = XRP side (drops, as a plain string when XRP); amount2 =
    // the issued-currency side. Confirm which one is actually PIGEONS
    // rather than assuming position, in case the pool's own field order
    // ever differs.
    const xrpSide = typeof amm.amount === 'string' ? amm.amount : null;
    const pigeonsSide = (amm.amount2 && typeof amm.amount2 === 'object' && amm.amount2.currency === encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency) && amm.amount2.issuer === PIGEONS_TOKEN_CONFIG.issuer)
      ? amm.amount2
      : (amm.amount && typeof amm.amount === 'object' && amm.amount.currency === encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency) && amm.amount.issuer === PIGEONS_TOKEN_CONFIG.issuer ? amm.amount : null);
    const xrpReserveDrops = xrpSide !== null ? xrpSide : (typeof amm.amount2 === 'string' ? amm.amount2 : null);
    if (xrpReserveDrops === null || !pigeonsSide) { console.log('fetchPigeonsAmmPool: unexpected shape', JSON.stringify(amm).slice(0, 300)); return null; }
    let xrpReserve;
    try { xrpReserve = BigInt(xrpReserveDrops); } catch (e) { console.log('fetchPigeonsAmmPool: bad drops value', xrpReserveDrops); return null; }
    const pigeonsReserve = parseFloat(pigeonsSide.value);
    const tradingFeeBps = typeof amm.trading_fee === 'number' ? amm.trading_fee : 0; // units of 1/100000
    if (xrpReserve <= 0n || !(pigeonsReserve > 0)) { console.log('fetchPigeonsAmmPool: non-positive reserve', xrpReserve.toString(), pigeonsReserve); return null; }
    return { xrpReserveDrops: xrpReserve, pigeonsReserve, tradingFeeBps };
  } catch (e) {
    console.log('fetchPigeonsAmmPool: exception', String(e && e.message || e));
    return null;
  }
}

// Constant-product AMM quote for spending exactly xrpDrops (BigInt) of
// XRP into the pool above. XRPL's own AMM formula: the trading fee is
// taken off the input before applying x*y=k, output = y*effIn/(x+effIn).
// PIGEONS-side math is Number (an inherently decimal IOU amount, and this
// is a display estimate, not a value going on-ledger) — the XRP side that
// actually matters for "never overspend" stays BigInt throughout.
function quoteFromAmmPool(pool, xrpDrops) {
  const feeFraction = pool.tradingFeeBps / 100000;
  const effIn = Number(xrpDrops) * (1 - feeFraction);
  const x = Number(pool.xrpReserveDrops);
  const y = pool.pigeonsReserve;
  const out = (y * effIn) / (x + effIn);
  return out > 0 ? out : 0;
}

// Walks the order book exactly as before, returning the total fillable
// PIGEONS for xrpDrops and whether the book had enough depth to fill it
// in full.
async function quoteFromOrderBook(xrpDrops) {
  let offers;
  try { offers = await fetchPigeonsBookOffers(PIGEONS_QUOTE_BOOK_DEPTH); } catch (e) { return { filled: false, receivePigeons: 0 }; }
  if (!Array.isArray(offers) || !offers.length) return { filled: false, receivePigeons: 0 };

  let remaining = xrpDrops;
  let total = 0;
  for (const o of offers) {
    if (remaining <= 0n) break;
    if (typeof o.TakerGets !== 'object' || typeof o.TakerPays !== 'string') continue; // wrong side / malformed
    // Prefer the *_funded fields when present — rippled includes them only
    // when the offer owner can't actually back the full nominal size, i.e.
    // this is the real available amount, not just what the offer claims.
    const availPigeons = parseFloat(o.taker_gets_funded !== undefined ? o.taker_gets_funded : o.TakerGets.value);
    const availDropsStr = o.taker_pays_funded !== undefined ? o.taker_pays_funded : o.TakerPays;
    let availDrops;
    try { availDrops = BigInt(availDropsStr); } catch (e) { continue; }
    if (!(availPigeons > 0) || availDrops <= 0n) continue;

    if (remaining >= availDrops) {
      total += availPigeons;
      remaining -= availDrops;
    } else {
      // Partial fill of this price level — Number-precision fraction is
      // fine here (display estimate, not a drops value going on-ledger).
      total += availPigeons * (Number(remaining) / Number(availDrops));
      remaining = 0n;
    }
  }
  return { filled: remaining <= 0n, receivePigeons: total };
}

// xrpDropsStr: exact integer drops (string) the user is spending — never a
// parsed float. Returns:
//   { ok:true, receivePigeons, rate, spentDrops, source }   — fully quotable
//   { ok:false, insufficientLiquidity:true }                 — neither source could fill it
//   { ok:false, error:'...' }                                 — lookup failed
// receivePigeons/rate are Numbers — this is a live ESTIMATE shown to the
// user, not a value written into a transaction (Stage 5 will re-derive
// and re-validate everything server-side from scratch before anything is
// ever signed, same as every other transaction this app builds).
export async function quotePigeonsForXrpDrops(xrpDropsStr) {
  let xrpDrops;
  try { xrpDrops = BigInt(xrpDropsStr); } catch (e) { return { ok: false, error: 'bad_amount' }; }
  if (xrpDrops <= 0n) return { ok: false, error: 'bad_amount' };

  const [bookResult, pool] = await Promise.all([
    quoteFromOrderBook(xrpDrops),
    fetchPigeonsAmmPool()
  ]);

  // If the AMM lookup itself failed (pool === null, not "AMM genuinely
  // has less liquidity"), this must NOT silently fall through to
  // whatever the order book offers — the AMM is this pair's dominant,
  // far-better-priced liquidity (confirmed live: ~3900 PIGEONS/XRP vs the
  // thin book's ~1700-2000), so treating a failed AMM lookup as "AMM
  // offers 0" let the much worse order-book price win the comparison by
  // default. Confirmed live: this is exactly what got baked into a real
  // signable transaction worth roughly HALF fair value. A failed AMM
  // lookup now fails the whole quote instead — an honest "try again" beats
  // a silently bad price on something the user is about to sign.
  if (!pool) {
    console.log('quotePigeonsForXrpDrops: AMM pool unreachable, refusing to fall back to order-book-only pricing');
    return { ok: false, error: 'quote_failed' };
  }

  const ammPigeons = quoteFromAmmPool(pool, xrpDrops); // AMM has effectively unlimited depth for any sane trade size relative to this pool, always "fills"
  const bookPigeons = bookResult.filled ? bookResult.receivePigeons : 0;

  const best = ammPigeons >= bookPigeons ? ammPigeons : bookPigeons;
  const source = ammPigeons >= bookPigeons ? 'amm' : 'orderbook';

  if (!(best > 0)) return { ok: false, insufficientLiquidity: true };

  const xrpIn = Number(xrpDrops) / 1000000;
  return { ok: true, receivePigeons: best, rate: best / xrpIn, spentDrops: xrpDrops.toString(), source: source };
}

const BUYSWAP_SLIPPAGE_BPS = 50; // 0.5% — matches the panel's own SL!PPAGE figure
// Real XRPL reserve math (post-XRPFees-amendment mainnet values), not a
// flat guess — a wallet holding NFTs/trustlines/offers has a real reserve
// requirement above the 1 XRP base, one owner-reserve increment per owned
// ledger object (OwnerCount from account_info, this includes NFTokenPages,
// so a wallet holding many NFTs does need more than the base alone). The
// old flat 2 XRP buffer under-reserved any wallet with >5 owned objects,
// letting MAX AVAILABLE show more than the wallet could actually send.
const XRPL_BASE_RESERVE_DROPS = 1000000n; // 1 XRP
const XRPL_OWNER_RESERVE_DROPS = 200000n; // 0.2 XRP per owned object
const BUYSWAP_FEE_BUFFER_DROPS = 100000n; // 0.1 XRP headroom for the tx fee itself, on top of the real reserve
function accountReserveDrops(ownerCount) {
  return XRPL_BASE_RESERVE_DROPS + XRPL_OWNER_RESERVE_DROPS * BigInt(ownerCount || 0) + BUYSWAP_FEE_BUFFER_DROPS;
}

// The single source of truth for the BUY $PIGEONS swap's txjson — used by
// BOTH buyswap-prepare.js (review screen, no signing) and
// buyswap-payload.js (the real Xaman request), so the transaction a user
// reviews is built by the exact same code path as the one actually sent
// for signing, not two independently-maintained copies that could drift.
// Re-derives EVERYTHING from live state (quote, trustline, XRP balance)
// every single call — never trusts a client-supplied amount beyond the
// XRP figure itself, and never reuses a previous call's result.
//
// Mechanism: a same-account "currency conversion" Payment (Account ===
// Destination === the buyer) — XRPL's own documented pattern for
// converting one currency to another on-ledger, not OfferCreate (never
// guaranteed to execute fully/immediately) and not a hand-built Paths
// array (rippled's own default pathfinding already auto-routes through
// both the order book and the AMM pool since the AMM amendment — the same
// combined liquidity quotePigeonsForXrpDrops already checks).
//
// Slippage protection is atomic, not a post-hoc check: Amount is the
// slippage-adjusted MINIMUM PIGEONS (floored, never rounded up), SendMax
// is the EXACT XRP requested (never more), and tfPartialPayment is
// deliberately omitted — that combination means the transaction either
// delivers AT LEAST the full Amount for AT MOST SendMax, or fails
// atomically with no funds moved, never a partial fill.
export async function buildBuySwapTxjson(buyer, xrpDrops) {
  if (typeof xrpDrops !== 'string' || !/^[1-9][0-9]*$/.test(xrpDrops)) {
    return { ok: false, error: 'bad_amount' };
  }

  // hasTrustline === null means the live lookup itself failed (even
  // after fetchPigeonsAccountLine's own retries) — genuinely different
  // from a confirmed-absent trustline (false), and must never be reported
  // as "no_trustline" (which reads to the user as "you need to set up a
  // trustline" when the real issue is a transient ledger-read failure —
  // confirmed live as the actual cause of repeated false no_trustline
  // reports for a wallet that has one set).
  const line = await fetchPigeonsAccountLine(buyer);
  if (!line || line.hasTrustline === null) {
    return { ok: false, error: 'trustline_lookup_failed' };
  }
  if (line.hasTrustline !== true) {
    return { ok: false, error: 'no_trustline' };
  }

  const balanceInfo = await fetchXrpBalanceDrops(buyer);
  if (!balanceInfo) {
    return { ok: false, error: 'balance_lookup_failed' };
  }
  let xrpDropsBig, balanceBig;
  try { xrpDropsBig = BigInt(xrpDrops); balanceBig = BigInt(balanceInfo.drops); } catch (e) {
    return { ok: false, error: 'bad_amount' };
  }
  if (xrpDropsBig > balanceBig - accountReserveDrops(balanceInfo.ownerCount)) {
    return { ok: false, error: 'exceeds_balance' };
  }

  const quote = await quotePigeonsForXrpDrops(xrpDrops);
  if (!quote.ok) {
    return { ok: false, error: quote.insufficientLiquidity ? 'insufficient_liquidity' : 'quote_failed' };
  }

  const minReceivePigeons = Math.floor(quote.receivePigeons * (10000 - BUYSWAP_SLIPPAGE_BPS) / 10000 * 1e6) / 1e6;
  if (!(minReceivePigeons > 0)) {
    return { ok: false, error: 'quote_failed' };
  }
  const minReceiveStr = minReceivePigeons.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');

  const txjson = {
    TransactionType: 'Payment',
    Account: buyer,
    Destination: buyer,
    Amount: {
      currency: encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency),
      issuer: PIGEONS_TOKEN_CONFIG.issuer,
      value: minReceiveStr
    },
    SendMax: xrpDrops,
    Memos: swapOfferSourceMemo()
  };

  return {
    ok: true,
    txjson,
    display: {
      xrpDrops,
      minReceivePigeons: minReceiveStr,
      estimateReceivePigeons: quote.receivePigeons,
      rate: quote.rate,
      source: quote.source
    }
  };
}

// Real, validated on-ledger transaction result — the only thing Stage 6's
// "only show success after real XRPL validation" requirement can honestly
// rest on. Xaman's own dispatched_result is the network's immediate
// submission response, not a guarantee the transaction reached a
// validated ledger; this is a direct `tx` lookup, checked for
// result.validated === true before trusting TransactionResult at all.
// Returns null if the transaction isn't found/validated yet (caller
// should keep polling), never a fabricated "still pending" guess.
export async function fetchValidatedTxResult(txHash) {
  const data = await fetchXrplClusterJson({ method: 'tx', params: [{ transaction: txHash }] });
  if (!data) return null;
  const result = data.result;
  if (!result || !result.validated) return null;
  const meta = result.meta || result.metaData;
  if (!meta) return null;
  return {
    validated: true,
    transactionResult: meta.TransactionResult,
    deliveredAmount: meta.delivered_amount || null
  };
}

export async function fetchPigeonsXrpRate(kv) {
  if (kv) {
    const cached = await kv.get(PIGEONS_RATE_CACHE_KEY);
    if (cached !== null) return JSON.parse(cached);
  }
  const dexUrl = 'https://dexscreener.com/xrpl/' + PIGEONS_DEXSCREENER_PAIR;
  let result = { xrpPerPigeon: null, usdPerPigeon: null, dexUrl };
  try {
    const res = await fetch('https://api.dexscreener.com/latest/dex/pairs/xrpl/' + PIGEONS_DEXSCREENER_PAIR);
    const data = await res.json();
    const pair = data && data.pairs && data.pairs[0];
    if (pair) {
      const nativeVal = parseFloat(pair.priceNative);
      if (nativeVal > 0) result.xrpPerPigeon = nativeVal;
      const usdVal = parseFloat(pair.priceUsd);
      if (usdVal > 0) result.usdPerPigeon = usdVal;
      if (pair.url) result.dexUrl = pair.url;
    }
  } catch (e) { /* fall through to book-offers fallback below */ }
  if (result.xrpPerPigeon === null) {
    result.xrpPerPigeon = await fetchPigeonsXrpRateFromBookOffers();
  }
  if (kv) await safeKvPut(kv, PIGEONS_RATE_CACHE_KEY, JSON.stringify(result), { expirationTtl: PIGEONS_RATE_CACHE_TTL_SECONDS });
  return result;
}

// Real $PIGEONS trustline + balance for one wallet, straight from the
// XRPL DEX itself (account_lines, peer-filtered to the PIGEONS issuer so
// this is one cheap targeted call, not a full account_lines scan).
// account_lines returns the currency field as the raw on-ledger hex code
// (confirmed live), never the decoded "PIGEONS" ASCII — compared against
// encodeCurrencyCode(...) here, not a literal string match. No trust line
// entry at all means no trustline (never a fabricated 0); a lookup
// failure returns nulls so callers can tell "no trustline" from
// "couldn't check" and not conflate the two.
export async function fetchPigeonsAccountLine(account) {
  // Routed through the same retrying fetchXrplClusterJson every other
  // xrplcluster.com call in the BUY $PIGEONS path now uses — this one had
  // zero retry until confirmed live as the direct cause of "N0 TRUSTL!NE"
  // intermittently showing for a wallet that genuinely has one set,
  // including inside buildBuySwapTxjson (server-side prepare/payload),
  // which made it a hard block on buying, not just a display glitch.
  const data = await fetchXrplClusterJson({
    method: 'account_lines',
    params: [{ account, peer: PIGEONS_TOKEN_CONFIG.issuer }]
  });
  if (!data) return { hasTrustline: null, balance: null };
  const lines = (data.result && data.result.lines) || [];
  const wantCurrency = encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency);
  const line = lines.find(l => l.currency === wantCurrency);
  if (!line) return { hasTrustline: false, balance: 0 };
  return { hasTrustline: true, balance: parseFloat(line.balance) || 0 };
}

// Native XRP balance for one wallet, in exact integer drops (never a
// parsed float) — account_info's own Balance field is already a drops
// string, so this is a straight pass-through, no unit conversion done
// here at all. Also returns OwnerCount from the same response (no extra
// request) so callers can compute the wallet's REAL reserve requirement
// via accountReserveDrops instead of a flat guess — see that function's
// comment. Used by the BUY $PIGEONS swap panel to cap the XRP input at
// something the wallet can actually afford; null means "couldn't check"
// (network/parse failure), not "zero balance" — callers must not conflate
// the two.
export async function fetchXrpBalanceDrops(account) {
  // Same retry-hardening as fetchPigeonsAccountLine just above — this was
  // the direct cause of buildBuySwapTxjson's "balance_lookup_failed"
  // blocking real purchases on nothing more than a transient
  // xrplcluster.com blip.
  const data = await fetchXrplClusterJson({ method: 'account_info', params: [{ account }] });
  if (!data) return null;
  const accountData = data.result && data.result.account_data;
  const drops = accountData && accountData.Balance;
  if (typeof drops !== 'string' || !/^\d+$/.test(drops)) return null;
  const ownerCount = typeof accountData.OwnerCount === 'number' ? accountData.OwnerCount : 0;
  return { drops, ownerCount };
}

export { accountReserveDrops };

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

// The Σκύλλα SWAP offer among a NFT's real sell offers — a free
// (Amount "0" XRP, not a $PIGEONS/issued-currency object) transfer offer
// restricted to a specific Destination wallet. Same "never match on owner
// alone" reasoning as findPigeonsOffer: a Pigeon can carry an unrelated
// $PIGEONS or XRP listing at the same time as a swap offer.
export function findSwapOffer(offers, owner, destination) {
  return offers.find(o =>
    (owner === undefined || o.owner === owner) &&
    (destination === undefined || o.destination === destination) &&
    typeof o.amount === 'string' && o.amount === '0'
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

// The definitive current owner of one NFT (Clio's nft_info — xrplcluster
// doesn't serve this method, confirmed live with an "unknownCmd" error, so
// this goes to CLIO_ENDPOINT like the crown scan below does). Needed so
// findPigeonsOffer never picks a STALE sell offer: XRPL doesn't cancel a
// seller's old NFTokenCreateOffer just because the NFT later changed
// hands, so nft_sell_offers can keep returning a previous owner's
// unfulfillable offer indefinitely alongside the real, current listing.
// Confirmed live as the cause of BUY NOW wrongly reporting
// "cannot_buy_own_listing": a buyer who had once listed (and sold) this
// exact Pigeon still had that old offer sitting on-ledger, and it sorted
// ahead of the real seller's — findPigeonsOffer(offers) with no owner
// filter grabbed it as "the" offer instead. Callers should pass this
// result into findPigeonsOffer's own owner argument rather than trusting
// offers[0]. Returns null on any lookup failure or a burned NFT — callers
// already treat "couldn't confirm a matching offer" as not_listed/
// lookup_failed, never as a false "yes, listed."
export async function fetchNftCurrentOwner(nftId) {
  try {
    const res = await fetch(CLIO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'nft_info', params: [{ nft_id: nftId }] })
    });
    const data = await res.json();
    const result = data && data.result;
    if (!result || result.error || result.is_burned) return null;
    return result.owner || null;
  } catch (e) {
    return null;
  }
}

// Buy offers — the MAKE AN OFFER counterpart to the sell-offer functions
// above. Same RPC shape (nft_buy_offers instead of nft_sell_offers), same
// tolerant-on-failure behavior: a lookup failure degrades to "no offers
// found" rather than a hard error, since every caller here is a display or
// discovery path, never a single go/no-go safety signal.
export async function fetchNftBuyOffersOrNull(nftId, attempt) {
  attempt = attempt || 0;
  try {
    const res = await fetch('https://xrplcluster.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'nft_buy_offers', params: [{ nft_id: nftId }] })
    });
    const data = await res.json();
    if (!data.result || data.result.error) return [];
    return data.result.offers || [];
  } catch (e) {
    if (attempt < 1) {
      await new Promise(resolve => setTimeout(resolve, 350));
      return fetchNftBuyOffersOrNull(nftId, attempt + 1);
    }
    return null;
  }
}

export async function fetchNftBuyOffers(nftId) {
  const result = await fetchNftBuyOffersOrNull(nftId);
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
//     No longer triggered automatically anywhere (the background
//     waitUntil() calls in board.js/pigeons.js and the standalone
//     /api/crown-recompute endpoint were all removed — each recompute
//     cost 4 KV writes, and this was a meaningful chunk of the free
//     tier's 1,000/day write quota). Only reachable now by calling it
//     directly (e.g. from a future admin endpoint or manually), so the
//     snapshot below is effectively frozen at whatever it last was.
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
const CROWN_RECOMPUTE_LOCK_KEY = 'crown:recompute:lock';
// board.js only bothers kicking off a background recompute once the
// cached snapshot is at least this stale.
export const CROWN_SNAPSHOT_MAX_AGE_SECONDS = 15 * 60;
// Guards against back-to-back triggers (e.g. a misfiring external cron)
// re-running the expensive scan more often than this.
const CROWN_RECOMPUTE_MIN_INTERVAL_SECONDS = 60;
// board.js and pigeons.js both opportunistically fire this off in the
// background whenever the cached snapshot goes stale — under real
// concurrent traffic that means every one of those requests independently
// starts its own full ~31-call sequential Clio scan at once, none of
// which finish fast enough to stop the next request from also seeing a
// stale snapshot and piling on another. The lock below caps that at one
// in-flight scan; the TTL just means a crashed/timed-out attempt can't
// wedge it shut forever.
const CROWN_RECOMPUTE_LOCK_TTL_SECONDS = 120;

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

  // Claim the lock before doing any expensive work — if another request
  // got here first and is still scanning, bail out now instead of also
  // burning a full Clio scan (and another two KV writes) on the same
  // stale snapshot everyone else already saw.
  const lockRaw = await kv.get(CROWN_RECOMPUTE_LOCK_KEY);
  if (lockRaw && now - Number(lockRaw) < CROWN_RECOMPUTE_LOCK_TTL_SECONDS) {
    return existingSnapshot;
  }
  await safeKvPut(kv, CROWN_RECOMPUTE_LOCK_KEY, String(now), { expirationTtl: CROWN_RECOMPUTE_LOCK_TTL_SECONDS });

  try {
    return await doRecomputeCrownHolder(kv, now);
  } finally {
    // Release promptly on both success and failure — the lock's own TTL
    // is just a backstop for a hard crash that skips this entirely, not
    // meant to make every other caller wait out the full 120s normally.
    await safeKvPut(kv, CROWN_RECOMPUTE_LOCK_KEY, '0');
  }
}

async function doRecomputeCrownHolder(kv, now) {
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

  // Piggybacks on the same full scan for the SWAP page's "top 123 holders"
  // list — no reason to run a second Clio scan just for this.
  const topHolders = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 123)
    .map(([wallet, count]) => ({ wallet, count }));

  // Rarest-held-Pigeon thumbnail for the top 15 rows only — deliberately
  // NOT a live per-request lookup (that'd mean 15 extra Deeptide calls on
  // every normal page load). Computed once here, alongside the Clio scan
  // this function already runs on its own rate-limited/locked schedule
  // (see recomputeCrownHolder above), then cached straight into the
  // snapshot topHolders already lives in — normal reads (getCachedCrownHolder)
  // stay a plain KV read either way. One Deeptide call per wallet (already
  // returns every held token's image + rarityRank in one shot, no XRPL
  // pagination needed), 15 wallets, run in parallel, at most once every
  // CROWN_RECOMPUTE_MIN_INTERVAL_SECONDS.
  await Promise.all(topHolders.slice(0, 15).map(async (h) => {
    const owned = await getOwnerPigeonsViaDeeptide(kv, h.wallet);
    const ranked = owned.filter(it => typeof it.rarityRank === 'number' && it.image);
    if (!ranked.length) return;
    const rarest = ranked.reduce((a, b) => (a.rarityRank <= b.rarityRank ? a : b));
    h.rarestPigeon = { number: rarest.number, image: rarest.image, rarityRank: rarest.rarityRank };
  }));

  const snapshot = {
    wallet: crownWallet,
    count: maxCount,
    since: crownSince,
    computedAt: now,
    holderCount: counts.size,
    topHolders,
  };

  await safeKvPut(kv, CROWN_HOLDINGS_HISTORY_KEY, JSON.stringify(history));
  await safeKvPut(kv, CROWN_SNAPSHOT_KEY, JSON.stringify(snapshot));
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
    await safeKvPut(kv, cacheKey, String(idx));
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
    if (info.image !== null) await safeKvPut(kv, cacheKey, JSON.stringify(info));
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
// Cached for 1 hour (collection-wide trait distribution barely moves) so
// opening the TRAITS panel doesn't re-crawl every card on every click, and
// so a cold-cache rebuild (below) is rare rather than happening every ~10
// cache-key-mins of traffic.
const TRAIT_CARDS_CACHE_KEY_PREFIX = 'pswap:traitcards:v2:';
const TRAIT_CARDS_CACHE_TTL_SECONDS = 3600;
export async function getTraitCategoriesWithPercent(kv, shopSlug = DEEPTIDE_PIGEON_SHOP_SLUG, collectionSizeApprox = PIGEON_COLLECTION_SIZE_APPROX) {
  const cacheKey = TRAIT_CARDS_CACHE_KEY_PREFIX + shopSlug;
  const cached = await kv.get(cacheKey);
  if (cached !== null) return JSON.parse(cached);

  // Page 0 first (sequentially) so we learn the real `total`, then fire
  // every remaining page at once instead of awaiting them one at a time —
  // a cold cache used to mean up to ~10 sequential round trips to Deeptide
  // (the real collection's ~242 items is ~5 pages); this cuts that down to
  // roughly the cost of a single page fetch.
  const first = await fetchDeeptideTraitCards(0, DEEPTIDE_LISTINGS_MAX_LIMIT, shopSlug);
  const total = first.total || 0;
  const all = [...(first.traits || [])];
  const remainingSkips = [];
  for (let skip = DEEPTIDE_LISTINGS_MAX_LIMIT; skip < Math.min(total, 600); skip += DEEPTIDE_LISTINGS_MAX_LIMIT) { // 600 is a generous ceiling well above the real ~242
    remainingSkips.push(skip);
  }
  if (first.traits && first.traits.length) {
    const pages = await Promise.all(remainingSkips.map(skip => fetchDeeptideTraitCards(skip, DEEPTIDE_LISTINGS_MAX_LIMIT, shopSlug)));
    for (const page of pages) {
      if (page.traits && page.traits.length) all.push(...page.traits);
    }
  }

  const grouped = {};
  for (const t of all) {
    if (!t.trait_type || !t.value || t.value.startsWith('__')) continue; // Deeptide's internal "no trait" placeholder

    if (!grouped[t.trait_type]) grouped[t.trait_type] = [];
    grouped[t.trait_type].push({
      value: t.value,
      count: t.count,
      percent: Math.round((t.count / collectionSizeApprox) * 100000) / 1000,
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
// since it's a live external call on every /static page load otherwise.
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

// Per-token listing on xrp.cafe, for both the INSPECT screen's LISTINGS
// section and the DATABASE grid's bottom-bar listing (one call per item,
// up to ~40 concurrent per page load). `amount` is null when nobody's
// selling it there; present in the same raw-XRP units as this API's own
// `floor_price` field (unlike Deeptide, which uses drops for offer
// amounts).
//
// KV-cached (1 hour) — a burst of ~40 concurrent calls to xrp.cafe's own
// API on every page load/reload was a real source of intermittent rate-
// limiting, which a failed call then showed as a false "NOT LISTED" (see
// the retry logic below). Caching cuts that burst down to once per NFT
// per TTL across all visitors, not per page load.
//
// TTL was originally 60s, which is far too short: every miss costs a KV
// read + a KV write, and Cloudflare's free tier caps out at 1,000 writes/
// day — a handful of page loads at 60s was enough to exhaust it. Raised
// to 600s (10 min), which cut write volume ~10x but was STILL nearing the
// daily cap under real browsing traffic (each of up to 40 items/page
// re-misses and rewrites every 10 minutes as people scroll). Raised again
// to 3600s (1 hour) for another ~6x cut. Listing prices don't move
// minute-to-minute, so an hour-stale price is an acceptable tradeoff for
// staying well under the write cap.
//
// Only a genuine result (listed or confirmed not-listed) gets cached — a
// failed lookup (both retries exhausted) is never cached, so the very
// next request tries again fresh instead of baking in a transient
// rate-limit as a permanent false negative.
const XRP_CAFE_NFT_CACHE_KEY_PREFIX = 'pswap:xrpcafenft:v1:';
const XRP_CAFE_NFT_CACHE_TTL_SECONDS = 3600;
const XRP_CAFE_NFT_MAX_ATTEMPTS = 3;
const XRP_CAFE_NFT_RETRY_DELAYS_MS = [300, 700];

async function fetchXrpCafeNftListingLive(nftId, attempt = 0) {
  try {
    const res = await fetch(`${XRP_CAFE_API_BASE}/api/nft/${encodeURIComponent(nftId)}`);
    if (!res.ok) {
      // Same "don't let a failed lookup look identical to a confirmed
      // negative" reasoning as fetchNftSellOffersOrNull — a real listing
      // could otherwise vanish from display purely because this one call
      // got rate-limited or hiccuped under a full-page burst.
      if (attempt < XRP_CAFE_NFT_MAX_ATTEMPTS - 1) {
        await new Promise(resolve => setTimeout(resolve, XRP_CAFE_NFT_RETRY_DELAYS_MS[attempt]));
        return fetchXrpCafeNftListingLive(nftId, attempt + 1);
      }
      return undefined; // exhausted — caller must not cache this
    }
    const d = await res.json();
    const n = d.nft;
    if (!n) return null; // genuine "no listing" — cacheable
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
    if (attempt < XRP_CAFE_NFT_MAX_ATTEMPTS - 1) {
      await new Promise(resolve => setTimeout(resolve, XRP_CAFE_NFT_RETRY_DELAYS_MS[attempt]));
      return fetchXrpCafeNftListingLive(nftId, attempt + 1);
    }
    return undefined;
  }
}

export async function fetchXrpCafeNftListing(kv, nftId) {
  const cacheKey = XRP_CAFE_NFT_CACHE_KEY_PREFIX + nftId;
  if (kv) {
    const cached = await kv.get(cacheKey);
    if (cached !== null) return JSON.parse(cached);
  }
  const result = await fetchXrpCafeNftListingLive(nftId);
  if (result === undefined) return null; // failed lookup — not cached, not shown as a false negative to callers below
  if (kv) await safeKvPut(kv, cacheKey, JSON.stringify(result), { expirationTtl: XRP_CAFE_NFT_CACHE_TTL_SECONDS });
  return result;
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
// Staging copy written on every intermediate tick of an in-progress
// crawl — getPigeonNumberMap() (every real reader: search, edition
// filtering, trait examples) only ever reads the KEY above, which now
// only gets touched once a full pass genuinely completes. Confirmed
// live: this used to write straight into the live key on every tick, so
// every ~6h staleness-triggered recrawl blanked it back to {} and rebuilt
// from scratch — for the ~1h (900 tokens/run, 3015 total) it took to
// finish, real Pigeons not yet re-reached that pass looked "not indexed"
// (wrong number search results, wrong edition-filter membership) even
// though they'd been correctly indexed moments before the recrawl
// started. Staging fixes it: readers always see the last COMPLETE map.
const PIGEON_NUMBER_MAP_STAGING_KEY = 'pswap:numbermap:staging:v1';
// Bumped v1 -> v2: the crawl this stats key gates now also builds the
// trait-example map below as a side effect. A v1 "completed" stats entry
// would otherwise block a fresh crawl for NUMBER_MAP_REFRESH_STALE_SECONDS
// (6h) and trait examples would stay empty that whole time — bumping the
// key makes it start a real crawl on next call, same one-time-cost
// pattern as every other KV shape change in this file.
const PIGEON_NUMBER_MAP_STATS_KEY = 'pswap:numbermapstats:v2';
const NUMBER_MAP_REFRESH_STALE_SECONDS = 6 * 3600;
const NUMBER_MAP_CONCURRENT_GUARD_SECONDS = 10;
const NUMBER_MAP_PAGES_PER_RUN = 15; // 15 * 60 = 900 tokens/run, ~15 fetches — safely under the subrequest budget

// One representative Pigeon image per trait value ("Background: Yellow" ->
// some real image of a yellow-background Pigeon), for the ADD TRAITS
// flyout's background-preview request. Piggybacks entirely on the number-
// map crawl above — every page it already fetches carries `image` and
// `attributes` per item, so this costs zero extra requests; just keep the
// first image seen for each trait_type/value pair as the crawl runs.
const TRAIT_EXAMPLE_MAP_KEY = 'pswap:traitexamples:v1';
const TRAIT_EXAMPLE_MAP_STAGING_KEY = 'pswap:traitexamples:staging:v1';

export async function getPigeonNumberMap(kv) {
  const raw = await kv.get(PIGEON_NUMBER_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function getPigeonNumberMapStaging(kv) {
  const raw = await kv.get(PIGEON_NUMBER_MAP_STAGING_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function getPigeonNumberMapStats(kv) {
  const raw = await kv.get(PIGEON_NUMBER_MAP_STATS_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function getTraitExampleMap(kv) {
  const raw = await kv.get(TRAIT_EXAMPLE_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function getTraitExampleMapStaging(kv) {
  const raw = await kv.get(TRAIT_EXAMPLE_MAP_STAGING_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function maybeRefreshPigeonNumberMap(kv) {
  const statsRaw = await kv.get(PIGEON_NUMBER_MAP_STATS_KEY);
  const stats = statsRaw ? JSON.parse(statsRaw) : null;
  const now = Math.floor(Date.now() / 1000);
  if (stats && stats.inProgress && now - stats.updatedAt < NUMBER_MAP_CONCURRENT_GUARD_SECONDS) return;
  if (stats && !stats.inProgress && now - stats.completedAt < NUMBER_MAP_REFRESH_STALE_SECONDS) return;

  let skip = stats && stats.inProgress ? stats.nextSkip : 0;
  // Resuming reads the STAGING copy (this pass's own in-progress work),
  // never the live map — starting a brand new pass starts genuinely
  // empty, same as before, but that emptiness now stays invisible to
  // real readers until the pass actually finishes (see the staging key's
  // own comment above).
  const map = stats && stats.inProgress ? await getPigeonNumberMapStaging(kv) : {};
  const traitExamples = stats && stats.inProgress ? await getTraitExampleMapStaging(kv) : {};
  let lastTotal = 3015;

  for (let i = 0; i < NUMBER_MAP_PAGES_PER_RUN; i++) {
    const page = await fetchDeeptideListings({ skip, limit: DEEPTIDE_LISTINGS_MAX_LIMIT, sort: 'rarity-asc' });
    if (page.error || !page.items.length) break;
    for (const it of page.items) {
      if (it.number !== null) map[it.number] = it.nftId;
      if (it.image && Array.isArray(it.attributes)) {
        for (const a of it.attributes) {
          if (!a.trait_type || !a.value) continue;
          if (!traitExamples[a.trait_type]) traitExamples[a.trait_type] = {};
          if (!traitExamples[a.trait_type][a.value]) traitExamples[a.trait_type][a.value] = it.image;
        }
      }
    }
    lastTotal = page.total || lastTotal;
    skip += DEEPTIDE_LISTINGS_MAX_LIMIT;
    if (skip >= lastTotal) {
      // Pass genuinely complete — ONLY now does the live map (every real
      // reader) actually change, in one atomic swap rather than the
      // gradual, visibly-incomplete rebuild this used to be.
      await safeKvPut(kv, PIGEON_NUMBER_MAP_KEY, JSON.stringify(map));
      await safeKvPut(kv, TRAIT_EXAMPLE_MAP_KEY, JSON.stringify(traitExamples));
      await safeKvPut(kv, PIGEON_NUMBER_MAP_STATS_KEY, JSON.stringify({
        inProgress: false, completedAt: now, updatedAt: now, count: Object.keys(map).length,
      }));
      return;
    }
  }
  // Still mid-pass — checkpoint into staging only. The live map (and
  // every real reader of it) stays exactly as it was after the LAST
  // completed pass until this one actually finishes above.
  await safeKvPut(kv, PIGEON_NUMBER_MAP_STAGING_KEY, JSON.stringify(map));
  await safeKvPut(kv, TRAIT_EXAMPLE_MAP_STAGING_KEY, JSON.stringify(traitExamples));
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
// v2: map values became { drops, txHash } instead of a bare drops number.
// v3: added totalDrops/count (every sale seen, not just the max) so a real
// per-NFT average sale price can be derived (totalDrops / count) alongside
// the existing highest-sale record, from the exact same crawl — no second
// system needed.
// v4: added recentDrops/recentTxHash — the crawl reads /api/sales/recent
// newest-first, so the FIRST sale seen for an nftId (before drops/txHash
// get overwritten chasing the highest-ever price) is genuinely its most
// recent sale; captured once and never touched again. Bump the key again
// if the shape changes further.
// ─────────────────────────────────────────────────────────────────────────
const HIGH_SALE_MAP_KEY = 'pswap:highsale:v4';
// Staging copy for an in-progress pass — see PIGEON_NUMBER_MAP_STAGING_KEY's
// comment above for the full reasoning. This is the one that was actually
// causing real, sold Pigeons to show "COND!T!ON :: M!NT" on cards: every
// ~6h staleness recrawl used to blank HIGH_SALE_MAP_KEY (avgSaleXrp/
// saleCount both live in it) straight back to {} and rebuild from
// scratch over ~3200+ sales, ~10 minutes of real crawl progress per
// 15-min cron tick — a real, recurring window (confirmed live: caught
// production mid-recrawl at nextSkip:500/3224 total, only 357 of however
// many actually-sold Pigeons still had real data) where most of the
// collection's genuine sale history was invisible, not actually gone.
const HIGH_SALE_MAP_STAGING_KEY = 'pswap:highsale:staging:v4';
const HIGH_SALE_STATS_KEY = 'pswap:highsalestats:v4';
const HIGH_SALE_REFRESH_STALE_SECONDS = 6 * 3600;
const HIGH_SALE_CONCURRENT_GUARD_SECONDS = 10;
const HIGH_SALE_PAGES_PER_RUN = 10;
const HIGH_SALE_PAGE_LIMIT = 50; // server-enforced cap on /api/sales/recent

export async function getHighSaleMap(kv) {
  const raw = await kv.get(HIGH_SALE_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function getHighSaleMapStaging(kv) {
  const raw = await kv.get(HIGH_SALE_MAP_STAGING_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function maybeRefreshHighSaleMap(kv) {
  const statsRaw = await kv.get(HIGH_SALE_STATS_KEY);
  const stats = statsRaw ? JSON.parse(statsRaw) : null;
  const now = Math.floor(Date.now() / 1000);
  if (stats && stats.inProgress && now - stats.updatedAt < HIGH_SALE_CONCURRENT_GUARD_SECONDS) return;
  if (stats && !stats.inProgress && now - stats.completedAt < HIGH_SALE_REFRESH_STALE_SECONDS) return;

  let skip = stats && stats.inProgress ? stats.nextSkip : 0;
  const map = stats && stats.inProgress ? await getHighSaleMapStaging(kv) : {};
  let lastTotal = Infinity;

  for (let i = 0; i < HIGH_SALE_PAGES_PER_RUN; i++) {
    const page = await fetchDeeptideSalesHistory({ skip, limit: HIGH_SALE_PAGE_LIMIT, sort: 'date-desc' });
    if (page.error || !page.items.length) break;
    for (const s of page.items) {
      if (!s.nftId || typeof s.priceXrp !== 'number') continue;
      const drops = Math.round(s.priceXrp * 1000000);
      const existing = map[s.nftId];
      if (!existing) {
        map[s.nftId] = {
          drops, txHash: s.txHash || null, totalDrops: drops, count: 1,
          recentDrops: drops, recentTxHash: s.txHash || null
        };
      } else {
        if (drops > existing.drops) { existing.drops = drops; existing.txHash = s.txHash || null; }
        existing.totalDrops += drops;
        existing.count += 1;
      }
    }
    lastTotal = page.total || lastTotal;
    skip += HIGH_SALE_PAGE_LIMIT;
    if (!page.hasMore || skip >= lastTotal) {
      // Pass genuinely complete — only now does the live map (every real
      // reader: toItem's avgSaleXrp/saleCount/highSaleXrp) actually
      // change. Real requests keep seeing the last complete pass's data
      // throughout the whole rebuild, never a partial one.
      await safeKvPut(kv, HIGH_SALE_MAP_KEY, JSON.stringify(map));
      await safeKvPut(kv, HIGH_SALE_STATS_KEY, JSON.stringify({
        inProgress: false, completedAt: now, updatedAt: now, count: Object.keys(map).length,
      }));
      return;
    }
  }
  // Still mid-pass — checkpoint into staging only.
  await safeKvPut(kv, HIGH_SALE_MAP_STAGING_KEY, JSON.stringify(map));
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

// Merges multiple entries in ONE read-modify-write instead of one per
// entry — recordSwapListing's own read-then-write is a real race when
// several calls run concurrently against the same key (confirmed live:
// swap-listing-owned.js's own discovery scan checks up to 5 Pigeons at
// once via mapWithConcurrency, and when more than one of those turned out
// to be genuinely listed, all but the LAST write to finish silently lost
// its entry — a real listing that briefly existed in the response never
// actually made it into the persisted map, so it just never showed up in
// L!STED/FL00R $P!GE0NS). Callers that discover multiple entries in the
// same pass should collect them and call this once at the end rather than
// calling recordSwapListing per entry in a loop/Promise.all.
export async function recordSwapListingsBatch(kv, entries) {
  if (!entries || !Object.keys(entries).length) return;
  const map = await getSwapListingsMap(kv);
  Object.assign(map, entries);
  await safeKvPut(kv, SWAP_LISTINGS_MAP_KEY, JSON.stringify(map));
}

export async function removeSwapListing(kv, nftId) {
  const map = await getSwapListingsMap(kv);
  if (!map[nftId]) return;
  delete map[nftId];
  await safeKvPut(kv, SWAP_LISTINGS_MAP_KEY, JSON.stringify(map));
}

// ─────────────────────────────────────────────────────────────────────────
// MAKE AN OFFER — the reverse of a listing: a non-owner proposes a
// $PIGEONS price for a Pigeon (listed or not) via a real NFTokenCreateOffer
// buy-offer (no tfSellNFToken flag), which only the current owner can
// accept. nftId -> array of entries (a Pigeon can carry several open offers
// from different wallets at once, unlike a listing which is one-per-NFT).
// Same "record on our own confirmed success, self-heal against live
// nft_buy_offers everywhere it's actually read" pattern as the listings
// map above.
// ─────────────────────────────────────────────────────────────────────────
const SWAP_BUY_OFFERS_MAP_KEY = 'pswap:buyoffers:v1';

export async function getSwapBuyOffersMap(kv) {
  const raw = await kv.get(SWAP_BUY_OFFERS_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function addSwapBuyOffer(kv, nftId, entry) {
  const map = await getSwapBuyOffersMap(kv);
  const list = map[nftId] || (map[nftId] = []);
  const existingIdx = list.findIndex(o => o.offerId === entry.offerId);
  if (existingIdx !== -1) list[existingIdx] = entry;
  else list.push(entry);
  await safeKvPut(kv, SWAP_BUY_OFFERS_MAP_KEY, JSON.stringify(map));
}

export async function removeSwapBuyOffer(kv, nftId, offerId) {
  const map = await getSwapBuyOffersMap(kv);
  if (!map[nftId]) return;
  map[nftId] = map[nftId].filter(o => o.offerId !== offerId);
  if (!map[nftId].length) delete map[nftId];
  await safeKvPut(kv, SWAP_BUY_OFFERS_MAP_KEY, JSON.stringify(map));
}

// ─────────────────────────────────────────────────────────────────────────
// TRANSFER — incoming side. TRANSFER creates a real free (Amount "0")
// NFTokenCreateOffer restricted via Destination to the recipient's wallet
// (see swap-offer-prepare/-payload.js), but that offer sits on an NFT the
// SENDER still owns — fetchAllAccountNfts(recipient) can never find it, so
// unlike every other "what's happening on MY Pigeons" view on this site,
// there's no way to discover it just by looking at what the recipient
// owns. This index is the only record that it was ever sent: written once
// by swap-offer-status.js the moment the sender's own offer is confirmed
// on-ledger (a pure transfer — no wantNftId/swapId — is what tells that
// endpoint to write here instead of into the swap-offer-pairs index).
// toWallet -> array of entries, self-healed the same way as the listings/
// buy-offers maps above: the stored entry only says "worth checking," a
// live nft_sell_offers lookup at read time is what's actually trusted.
// ─────────────────────────────────────────────────────────────────────────
const INCOMING_TRANSFERS_MAP_KEY = 'pswap:incomingtransfers:v1';

export async function getIncomingTransfersMap(kv) {
  const raw = await kv.get(INCOMING_TRANSFERS_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function addIncomingTransfer(kv, toWallet, entry) {
  const map = await getIncomingTransfersMap(kv);
  const list = map[toWallet] || (map[toWallet] = []);
  const existingIdx = list.findIndex(o => o.offerId === entry.offerId);
  if (existingIdx !== -1) list[existingIdx] = entry;
  else list.push(entry);
  await safeKvPut(kv, INCOMING_TRANSFERS_MAP_KEY, JSON.stringify(map));
}

export async function removeIncomingTransfer(kv, toWallet, offerId) {
  const map = await getIncomingTransfersMap(kv);
  if (!map[toWallet]) return;
  map[toWallet] = map[toWallet].filter(o => o.offerId !== offerId);
  if (!map[toWallet].length) delete map[toWallet];
  await safeKvPut(kv, INCOMING_TRANSFERS_MAP_KEY, JSON.stringify(map));
}

// ─────────────────────────────────────────────────────────────────────────
// Σκύλλα SWAP — NFT-for-NFT offer PAIRS. XRPL has no atomic swap, so a real
// trade is two independent NFTokenCreateOffer objects (one per side, each
// Amount "0" and Destination-restricted to the other wallet) plus two
// independent NFTokenAcceptOffer transactions. This is the record tying
// those two halves together as one logical swap, so the counterparty can
// discover an incoming offer and both sides can see whether the other has
// reciprocated/accepted yet. Same single-JSON-map-in-one-key pattern as
// the listings map above; keyed by a random swapId, not either NFT's ID,
// since either side's own offerId can independently change over the
// pair's lifetime (created, then later accepted-and-gone).
// ─────────────────────────────────────────────────────────────────────────
const SWAP_OFFER_PAIRS_KEY = 'pswap:offerpairs:v1';

export async function getSwapOfferPairs(kv) {
  const raw = await kv.get(SWAP_OFFER_PAIRS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function recordSwapOfferPair(kv, swapId, entry) {
  const map = await getSwapOfferPairs(kv);
  map[swapId] = entry;
  await safeKvPut(kv, SWAP_OFFER_PAIRS_KEY, JSON.stringify(map));
}

export async function removeSwapOfferPair(kv, swapId) {
  const map = await getSwapOfferPairs(kv);
  if (!map[swapId]) return;
  delete map[swapId];
  await safeKvPut(kv, SWAP_OFFER_PAIRS_KEY, JSON.stringify(map));
}

// Bridges swap-buy-payload.js (which knows the seller + price, right as it
// builds the accept-offer txjson) to swap-buy-status.js (which only sees
// "is the offer gone yet" — by settlement time the offer itself, and its
// price/seller, no longer exist on-ledger to look up). Keyed by the Xaman
// payload uuid so status polling can retrieve exactly the pending buy it's
// tracking; short TTL since a real buy settles or expires within minutes.
const PENDING_BUY_KEY_PREFIX = 'pswap:pendingbuy:';
const PENDING_BUY_TTL_SECONDS = 900;

export async function recordPendingBuy(kv, uuid, entry) {
  await safeKvPut(kv, PENDING_BUY_KEY_PREFIX + uuid, JSON.stringify(entry), { expirationTtl: PENDING_BUY_TTL_SECONDS });
}

export async function takePendingBuy(kv, uuid) {
  const raw = await kv.get(PENDING_BUY_KEY_PREFIX + uuid);
  if (!raw) return null;
  await kv.delete(PENDING_BUY_KEY_PREFIX + uuid).catch(() => {});
  return JSON.parse(raw);
}

// Σκύλλα's own recorded sales — BUY completions confirmed on-ledger by
// swap-buy-status.js, priced in $PIGEONS (not XRP, unlike Deeptide's feed),
// merged into the SALES DATA tab alongside Deeptide's real, collection-wide
// history so a trade made directly through Σκύλλα (never touching
// Deeptide's own platform) still shows up there. A simple capped
// newest-first list, not a full index — good enough for "did my trade show
// up," not meant to replace a real ledger scan. Read-modify-write on a
// single KV key means two settlements landing at the exact same moment
// could race and one overwrite the other's append; acceptable at current
// volume, worth revisiting if trading picks up.
const SWAP_SALES_LOG_KEY = 'pswap:saleslog:v1';
const SWAP_SALES_LOG_MAX = 300;

export async function recordSwapSale(kv, entry) {
  const raw = await kv.get(SWAP_SALES_LOG_KEY);
  const list = raw ? JSON.parse(raw) : [];
  list.unshift(entry);
  if (list.length > SWAP_SALES_LOG_MAX) list.length = SWAP_SALES_LOG_MAX;
  await safeKvPut(kv, SWAP_SALES_LOG_KEY, JSON.stringify(list));
}

export async function getSwapSalesLog(kv) {
  const raw = await kv.get(SWAP_SALES_LOG_KEY);
  return raw ? JSON.parse(raw) : [];
}

// Real venue attribution for a Deeptide-fed sale — confirmed live, that
// feed is collection-wide and NOT proof a trade went through Deeptide's
// own marketplace specifically; sampled real transactions it returned
// turned out to be xrp.cafe brokered trades. The one actually verifiable
// signal is the completed NFTokenAcceptOffer's own initiating `Account`:
// xrp.cafe brokers every trade through the same fixed account (confirmed
// against multiple real transactions, each also carrying an on-chain memo
// literally reading "xrp.cafe - sale"); Deeptide's currently active
// listings all carry this same fixed Destination-restricted address on
// their sell offer, so a completed Deeptide-brokered accept should match
// it too. Cached forever per txHash once resolved — a settled
// transaction's own broker never changes.
const XRP_CAFE_BROKER_ACCOUNT = 'rpx9JThQ2y37FaGeeJP7PXDUVEXY3PHZSC';
const DEEPTIDE_BROKER_ACCOUNT = 'rLGHuf125sJV9d6g2hcK2HzKrDH2j45dPQ';
const SALE_VENUE_CACHE_PREFIX = 'pswap:venue:v1:';

export async function identifySaleVenue(kv, txHash) {
  const cacheKey = SALE_VENUE_CACHE_PREFIX + txHash;
  if (kv) {
    const cached = await kv.get(cacheKey);
    if (cached !== null) return cached || null;
  }
  let venue = null;
  try {
    const res = await fetch('https://xrplcluster.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'tx', params: [{ transaction: txHash, binary: false }] })
    });
    const data = await res.json();
    const account = data.result && data.result.Account;
    if (account === XRP_CAFE_BROKER_ACCOUNT) venue = 'xrpcafe';
    else if (account === DEEPTIDE_BROKER_ACCOUNT) venue = 'deeptide';
  } catch (e) {
    return null; // lookup failure - not cached, worth retrying next time
  }
  if (kv) await safeKvPut(kv, cacheKey, venue || '');
  return venue;
}

// Shared Xaman Payload API calls — used by every swap-*-payload.js and
// swap-*-status.js endpoint. Routed through a small proxy (a separate
// Render service, not on Cloudflare) instead of calling xumm.app directly:
// confirmed live via Xaman's own request logs that calls from inside
// Cloudflare (Workers/Pages Functions) never arrive at xumm.app at all —
// status 400, content-length 0, no `server`/`cf-ray` headers, i.e.
// something between Cloudflare's network and xumm.app drops it before any
// real HTTP exchange happens — while an identical request from a normal
// connection succeeds every time. Retrying from the same Worker can't fix
// that, since it's the network path itself, not a transient blip. The
// proxy re-homes just this one outbound call elsewhere; the real Xaman
// API key/secret live only in the proxy's own env, never here — this side
// authenticates with env.XAMAN_PROXY_SHARED_SECRET instead.
//
// Wrapped in try/catch AND bounded by an explicit AbortController timeout,
// longer than the proxy's own internal timeout so a slow xumm.app response
// surfaces as the proxy's own clean JSON error rather than us aborting the
// proxy call first. try/catch alone isn't enough regardless: if the proxy
// itself were slow, Cloudflare's own platform-level timeout could kill the
// whole request from OUTSIDE this function before our try/catch runs, and
// Cloudflare's own timeout page isn't JSON — reported live as a WebKit
// "SyntaxError: The string did not match the expected pattern" (Safari's
// phrasing for "tried to JSON.parse a non-JSON body") on the client.
const XAMAN_FETCH_TIMEOUT_MS = 18000;

// userToken (optional): a previously-captured Xaman push token for the
// signing wallet (see getXamanUserToken/xaman-webhook.js below) — when
// present, the payload is created with push:true and Xaman delivers it
// straight to that wallet's device as a real notification/Event, no
// browser tab needed. Omitted (undefined) on a wallet's first-ever
// payload, since there's no token to reuse yet; the existing "OPEN
// XAMAN" browser-tab flow is what earns the token in the first place
// (see the webhook comment for exactly how).
export async function createXamanPayload(env, txjson, options, userToken, attempt) {
  attempt = attempt || 0;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), XAMAN_FETCH_TIMEOUT_MS);
  try {
    const mergedOptions = Object.assign({ submit: true, expire: 5 }, options || {}, userToken ? { push: true } : {});
    const requestBody = JSON.stringify(Object.assign({ txjson, options: mergedOptions }, userToken ? { user_token: userToken } : {}));
    const res = await fetch(env.XAMAN_PROXY_URL + '/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Secret': env.XAMAN_PROXY_SHARED_SECRET
      },
      body: requestBody,
      signal: controller.signal
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      console.log('createXamanPayload proxy NOT OK status=' + res.status + ' body=[' + JSON.stringify(data).slice(0, 500) + ']');
      if (attempt < 1) {
        await new Promise(resolve => setTimeout(resolve, 400));
        return createXamanPayload(env, txjson, options, userToken, attempt + 1);
      }
      return null;
    }
    return data;
  } catch (e) {
    // A real AbortError means the proxy (or xumm.app behind it) was still
    // slow after the full timeout budget — not a fast connection blip.
    // Retrying that just compounds the wait, risking Cloudflare's own
    // platform-level kill. Only retry genuine fast connection failures.
    if (attempt < 1 && e && e.name !== 'AbortError') {
      console.log('createXamanPayload exception, retrying, attempt', attempt + 1, String(e));
      await new Promise(resolve => setTimeout(resolve, 400));
      return createXamanPayload(env, txjson, options, userToken, attempt + 1);
    }
    if (e && e.name === 'AbortError') {
      console.log('createXamanPayload timed out after', XAMAN_FETCH_TIMEOUT_MS, 'ms, attempt', attempt + 1, '- not retrying');
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getXamanPayloadStatus(env, uuid) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), XAMAN_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(env.XAMAN_PROXY_URL + '/payload/' + uuid, {
      headers: { 'X-Proxy-Secret': env.XAMAN_PROXY_SHARED_SECRET },
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

// Xaman push tokens — captured via xaman-webhook.js once a wallet resolves
// a payload with push requested and their app grants it, reused on every
// LATER payload for that same wallet (see createXamanPayload's userToken
// param) so a sign request can arrive as a real notification/Event on
// their phone instead of requiring the "OPEN XAMAN" browser-tab flow.
// Durable (no TTL) — cleared only if Xaman itself reports the token
// invalid/revoked on some later attempt.
const XAMAN_USER_TOKEN_PREFIX = 'pswap:xamanusertoken:';

export async function getXamanUserToken(kv, wallet) {
  if (!kv || !wallet) return null;
  return kv.get(XAMAN_USER_TOKEN_PREFIX + wallet);
}
export async function storeXamanUserToken(kv, wallet, token) {
  if (!kv || !wallet || !token) return;
  await safeKvPut(kv, XAMAN_USER_TOKEN_PREFIX + wallet, token);
}
export async function clearXamanUserToken(kv, wallet) {
  if (!kv || !wallet) return;
  await kv.delete(XAMAN_USER_TOKEN_PREFIX + wallet).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────
// ΣΚΥΛΛΑ://S!GNAL — a wallet that has never done anything real on this site
// (no sale, no listing, no offer, no incoming transfer, never even
// connected via Σκύλλα) gets an OPTIONAL 123-drop XRP payment alongside a
// new MAKE AN OFFER, so a genuinely new recipient has some real, visible
// signal that something happened for them, before they ever open Xaman.
// "Has activity" is a proxy, not a dedicated login/session log this site
// doesn't otherwise keep — checked against every wallet-linked KV record
// already maintained elsewhere (sales, listings, buy offers, incoming
// transfers) plus whether they've ever connected through Σκύλλα at all
// (a stored Xaman push token only exists after a real login). Each of
// these reads is already a single KV get (no new XRPL calls), so this is
// cheap even though it touches several maps.
export async function hasWalletActivity(env, wallet) {
  if (!env.coin || !wallet) return true; // fail toward NOT sending an unsolicited payment
  const [sales, listings, buyOffers, incoming, xamanToken] = await Promise.all([
    getSwapSalesLog(env.coin),
    getSwapListingsMap(env.coin),
    getSwapBuyOffersMap(env.coin),
    getIncomingTransfersMap(env.coin),
    getXamanUserToken(env.coin, wallet)
  ]);
  if (xamanToken) return true;
  if (sales.some(s => s.buyer === wallet || s.seller === wallet)) return true;
  if (Object.values(listings).some(l => l.seller === wallet)) return true;
  if (Object.values(buyOffers).some(list => list.some(o => o.buyer === wallet))) return true;
  if (incoming[wallet] && incoming[wallet].length) return true;
  if (Object.values(incoming).some(list => list.some(t => t.fromWallet === wallet))) return true;
  return false;
}

// Keyed by offerId (the MAKE AN OFFER buy-offer this signal is attached
// to) — one signal per offer, overwritten wholesale on retry rather than
// appended, since only the latest attempt's outcome matters. Deliberately
// includes crwnEligible/crwnCredited even though nothing reads them yet
// (see swap-signal-status.js's own comment) — the shape exists now so a
// later CRWN reward engine has a real, already-populated field to query
// instead of needing a backfill migration across every signal sent before
// it existed. crwnCredited must only ever be flipped true by that future
// engine itself; nothing in this file (or anywhere else right now) ever
// sets it, and there is no withdrawal path — CRWN stays internal/
// account-based only.
const SWAP_SIGNALS_KEY = 'pswap:signals:v1';

export async function getSwapSignalsMap(kv) {
  const raw = await kv.get(SWAP_SIGNALS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function getSwapSignal(kv, offerId) {
  const map = await getSwapSignalsMap(kv);
  return map[offerId] || null;
}

export async function recordSwapSignal(kv, offerId, entry) {
  const map = await getSwapSignalsMap(kv);
  map[offerId] = entry;
  await safeKvPut(kv, SWAP_SIGNALS_KEY, JSON.stringify(map));
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
    if ((cached === null || cached.image === null) && info.image !== null) await safeKvPut(kv, cacheKey, JSON.stringify(info));
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
