// ─────────────────────────────────────────────────────────────────────────
// STAT!C://C0!NS — the popular XRPL meme coins list.
//
// Which coins: xrpl.to's own "Memes" category, biggest market cap first
// (xrpl.to's terms require a visible "Data by xrpl.to" link wherever this
// list shows — see the C0!NS page in static.js). Everything the SAFETY
// badge says is read straight off the ledger instead (issuer settings, the
// real AMM pool, which top wallets are pools/burned, who owns the pool) —
// xrpl.to only picks the coins and supplies the top-holder ranking and
// the market-cap/price figures.
//
// Built in the background by cron-worker (its own "5-59/10" tick), ONE
// coin per tick: a coin's checks cost ~20-25 subrequests, and Cloudflare's
// per-invocation budget is 50 (HANDOFF.md gotcha 4), so two per tick would
// be one slow xrplcluster retry away from blowing it. The in-progress
// build lives in its own KV key and is only published as the real list
// once every coin is done, so the page never shows a half-built list.
// KV writes: one per tick while a build runs (~13 per build), one build
// every POPULAR_COINS_MAX_AGE_MS — ~80/day against the account-wide
// 1,000/day free-tier cap (HANDOFF.md).
//
// Buying goes through the exact same BUY swap panel/endpoints as the
// collection tokens — a coin's trade key is 'coin:<xrpl.to md5>' and the
// server only accepts keys that are in the CURRENT published list (see
// ensurePopularCoinConfig in _shared.js).
// ─────────────────────────────────────────────────────────────────────────
import { fetchXrplClusterJson, safeKvPut, POPULAR_COINS_KEY } from './_shared.js';

export { POPULAR_COINS_KEY };
const POPULAR_COINS_WIP_KEY = 'pcoins:wip:v1';
const POPULAR_COINS_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const POPULAR_COINS_CANDIDATES = 12; // xrpl.to's top N by market cap
const POPULAR_COINS_SHOWN = 10;      // published list size
const MAX_ATTEMPTS_PER_COIN = 2;
const XRPLTO = 'https://api.xrpl.to/v1';
const XRPLTO_HEADERS = { 'User-Agent': 'soitbegins.xyz popular-coins', 'Accept': 'application/json' };

// Addresses nobody holds a key for — a wallet whose master key is off and
// whose regular key is one of these (or unset), with no signer list, can
// never sign anything again. Tokens sitting in one are effectively burned.
const BLACKHOLE_KEYS = ['rrrrrrrrrrrrrrrrrrrrrhoLvTp', 'rrrrrrrrrrrrrrrrrrrrBZbvji', 'rrrrrrrrrrrrrrrrrNAMEtxvNvQ', 'rrrrrrrrrrrrrrrrrrrn5RM1rHd'];
const LSF_DISABLE_MASTER = 0x00100000;
const LSF_NO_FREEZE = 0x00200000;
const LSF_GLOBAL_FREEZE = 0x00400000;
const LSF_ALLOW_CLAWBACK = 0x80000000;

// Badge thresholds — shown to the user as plain sentences, see coinReasons.
const BUY_TEST_XRP = 1000;               // "a 1,000 XRP buy moves the price ~X%"
const IMPACT_YELLOW = 3, IMPACT_RED = 10;
const TOP10_YELLOW = 30, TOP10_RED = 60;
const LP_YELLOW = 25, LP_RED = 50;       // biggest share of the pool one unlocked wallet can pull

async function fetchXrplTo(path) {
  try {
    const res = await fetch(XRPLTO + path, { headers: XRPLTO_HEADERS });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function accountInfo(account) {
  const data = await fetchXrplClusterJson({ method: 'account_info', params: [{ account, ledger_index: 'validated', signer_lists: true }] });
  const r = data && data.result;
  if (!r || !r.account_data) return null;
  const signerLists = r.signer_lists || r.account_data.signer_lists || [];
  return { data: r.account_data, hasSigners: signerLists.length > 0 };
}

async function fetchIcon(currency, issuer) {
  try {
    const res = await fetch('https://s1.xrplmeta.org/token/' + currency + ':' + issuer, { headers: XRPLTO_HEADERS });
    if (!res.ok) return null;
    const d = await res.json();
    const icon = d && d.meta && d.meta.token && d.meta.token.icon;
    return typeof icon === 'string' && /^https:\/\//.test(icon) ? icon : null;
  } catch (e) {
    return null;
  }
}

// A few at a time, not all at once — a burst of 15 parallel account_info
// calls is exactly what gets xrplcluster to answer slowDown.
async function mapLimited(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() { while (i < items.length) { const n = i++; out[n] = await fn(items[n]); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function isLockedForever(info) {
  if (!info) return false;
  const d = info.data;
  return !!(d.Flags & LSF_DISABLE_MASTER) && (!d.RegularKey || BLACKHOLE_KEYS.indexOf(d.RegularKey) !== -1) && !info.hasSigners;
}

function worst(levels) {
  if (levels.indexOf('red') !== -1) return 'red';
  if (levels.indexOf('yellow') !== -1) return 'yellow';
  return 'green';
}

function decodeCurrency(code) {
  if (!code || code.length !== 40) return code;
  let s = '';
  for (let i = 0; i < 40; i += 2) {
    const b = parseInt(code.slice(i, i + 2), 16);
    if (b) s += String.fromCharCode(b);
  }
  return s;
}

// One coin's full check. Returns the published row, or null if a ledger
// read it depends on failed (retried on a later tick).
async function checkCoin(c) {
  const issuer = c.issuer, currency = c.currency;
  const [issuerInfo, ammData, holders, icon, gw] = await Promise.all([
    accountInfo(issuer),
    fetchXrplClusterJson({ method: 'amm_info', params: [{ asset: { currency: 'XRP' }, asset2: { currency, issuer }, ledger_index: 'validated' }] }, ['actNotFound']),
    fetchXrplTo('/holders/list/' + c.md5 + '?limit=20'),
    fetchIcon(currency, issuer),
    // Exact total issued, from the ledger — xrpl.to's own "supply" field
    // can undercount (XPM, 2026-09-26: 346M there vs 479M really issued),
    // which inflated every share-of-supply figure.
    fetchXrplClusterJson({ method: 'gateway_balances', params: [{ account: issuer, ledger_index: 'validated' }] })
  ]);
  if (!issuerInfo || !ammData || !holders || !Array.isArray(holders.richList)) return null;
  const obligations = gw && gw.result && gw.result.obligations;
  const supply = obligations && obligations[currency] ? parseFloat(obligations[currency]) : 0;
  if (!(supply > 0)) return null;
  const reasons = [];
  const levels = [];

  // 1. Issuer settings.
  const f = issuerInfo.data.Flags || 0;
  const issuerLocked = isLockedForever(issuerInfo);
  if (issuerLocked) {
    reasons.push({ level: 'green', text: 'The issuer is locked forever — no more coins can ever be created.' });
  } else {
    levels.push('red');
    reasons.push({ level: 'red', text: 'The issuer can still create more coins.' });
    if (!(f & LSF_NO_FREEZE)) reasons.push({ level: 'red', text: 'The issuer can freeze holders\u2019 coins.' });
    if (f & LSF_ALLOW_CLAWBACK) reasons.push({ level: 'red', text: 'The issuer can take coins back from holders (clawback).' });
  }
  if (f & LSF_GLOBAL_FREEZE) { levels.push('red'); reasons.push({ level: 'red', text: 'All trading in this coin is frozen right now.' }); }
  const rate = issuerInfo.data.TransferRate || 0;
  const feePct = rate > 1000000000 ? (rate / 1e9 - 1) * 100 : 0;
  if (feePct > 0) { levels.push('yellow'); reasons.push({ level: 'yellow', text: 'The issuer takes a ' + (Math.round(feePct * 100) / 100) + '% fee every time the coin is sent.' }); }

  // 2. The XRP pool: how far a 1,000 XRP buy moves the price. x*y=k, so
  // spending dx XRP moves the XRP-per-coin price by ((x+dx)/x)^2 — an
  // estimate (ignores the pool's own small trading fee and the order book).
  const amm = ammData.result && ammData.result.amm;
  let ammAccount = null, xrpInPool = 0, impactPct = null;
  if (amm) {
    ammAccount = amm.account;
    const xrpSide = typeof amm.amount === 'string' ? amm.amount : (typeof amm.amount2 === 'string' ? amm.amount2 : null);
    xrpInPool = xrpSide ? Number(xrpSide) / 1e6 : 0;
  }
  if (xrpInPool > 0) {
    impactPct = (Math.pow((xrpInPool + BUY_TEST_XRP) / xrpInPool, 2) - 1) * 100;
    const lvl = impactPct < IMPACT_YELLOW ? 'green' : (impactPct < IMPACT_RED ? 'yellow' : 'red');
    levels.push(lvl);
    reasons.push({ level: lvl, text: 'A 1,000 XRP buy moves the price about ' + (impactPct < 10 ? impactPct.toFixed(1) : Math.round(impactPct)) + '%' + (lvl === 'red' ? ' — thin, hard to sell in size.' : '.') });
  } else {
    levels.push('red');
    reasons.push({ level: 'red', text: 'No XRP pool — very little to buy or sell against.' });
  }

  // 3. Top 10 wallets — pools (any AMM, not just the XRP one) and burned
  // wallets checked on the ledger and left out.
  const top10 = [];
  let burnedPct = 0;
  const candidates = holders.richList.filter(h => h && h.account && h.account !== issuer).slice(0, 15);
  const infos = await mapLimited(candidates, 3, h => accountInfo(h.account));
  for (let i = 0; i < candidates.length && top10.length < 10; i++) {
    const info = infos[i];
    if (!info) return null; // can't classify it — don't guess, retry next tick
    const pct = supply > 0 ? (Number(candidates[i].balance) / supply) * 100 : 0;
    if (info.data.AMMID) continue;
    if (isLockedForever(info)) { burnedPct += pct; continue; }
    top10.push(pct);
  }
  const top10Pct = top10.reduce((a, b) => a + b, 0);
  const top1Pct = top10.length ? Math.max.apply(null, top10) : 0;
  const concLvl = top10Pct < TOP10_YELLOW ? 'green' : (top10Pct < TOP10_RED ? 'yellow' : 'red');
  levels.push(concLvl);
  reasons.push({ level: concLvl, text: 'The top 10 wallets hold ' + Math.round(top10Pct) + '% of all coins' + (top1Pct >= 20 ? ' (one wallet alone holds ' + Math.round(top1Pct) + '%).' : '.') });
  if (burnedPct >= 1) reasons.push({ level: 'green', text: Math.round(burnedPct) + '% sits in wallets locked forever (effectively burned).' });

  // 4. Can the pool be pulled — who owns the pool's LP tokens. Up to 3
  // pages (1,200 providers); past that ownership is spread wide anyway.
  if (amm && amm.lp_token) {
    const lpTotal = parseFloat(amm.lp_token.value) || 0;
    const lines = [];
    let marker = null, pages = 0;
    do {
      const p = { account: ammAccount, ledger_index: 'validated', limit: 400 };
      if (marker) p.marker = marker;
      const d = await fetchXrplClusterJson({ method: 'account_lines', params: [p] });
      if (!d || !d.result) return null;
      for (const l of d.result.lines || []) if (l.currency === amm.lp_token.currency && parseFloat(l.balance) < 0) lines.push({ account: l.account, amt: -parseFloat(l.balance) });
      marker = d.result.marker;
      pages++;
    } while (marker && pages < 3);
    lines.sort((a, b) => b.amt - a.amt);
    const topLp = lines.slice(0, 3);
    const lpInfos = await mapLimited(topLp, 3, l => accountInfo(l.account));
    let lockedLp = 0, biggestUnlocked = 0;
    topLp.forEach((l, i) => {
      const share = lpTotal > 0 ? (l.amt / lpTotal) * 100 : 0;
      if (isLockedForever(lpInfos[i])) lockedLp += share;
      else biggestUnlocked = Math.max(biggestUnlocked, share);
    });
    const lpLvl = biggestUnlocked < LP_YELLOW ? 'green' : (biggestUnlocked < LP_RED ? 'yellow' : 'red');
    levels.push(lpLvl);
    if (lpLvl === 'green') {
      reasons.push({ level: 'green', text: lockedLp >= 50 ? Math.round(lockedLp) + '% of the pool is locked forever — it can\u2019t be pulled.' : 'The pool is spread across many providers — no one wallet can pull it.' });
    } else {
      reasons.push({ level: lpLvl, text: 'One wallet owns ' + Math.round(biggestUnlocked) + '% of the pool and could pull it out' + (lpLvl === 'red' ? ' — rug-pull risk.' : '.') });
    }
  }

  return {
    key: 'coin:' + c.md5,
    md5: c.md5,
    name: c.name || decodeCurrency(currency),
    currency,
    issuer,
    ammAccount,
    // xrplmeta's icon (loads fine anywhere); xrpl.to's own image is the
    // fallback — its CDN refused server-side fetches when this was built.
    image: icon || ('https://s1.xrpl.to/token/' + c.md5 + '.webp'),
    marketCapUsd: c.marketCapUsd,
    usdPrice: c.usdPrice,
    xrplToUrl: 'https://xrpl.to/token/' + c.slug,
    badge: worst(levels),
    reasons,
    checkedAt: Date.now()
  };
}

async function fetchCandidates() {
  const data = await fetchXrplTo('/tokens?start=0&limit=' + POPULAR_COINS_CANDIDATES + '&sortBy=marketcap&sortType=desc&tag=memes');
  if (!data || !Array.isArray(data.tokens) || !data.tokens.length) return null;
  const xrpUsd = data.exch && data.exch.USD > 0 ? 1 / data.exch.USD : null;
  return data.tokens
    .filter(t => t && t.md5 && t.issuer && t.currency && (!t.tokenType || t.tokenType === 'trustline'))
    .map(t => ({
      md5: t.md5, slug: t.slug || t.md5, name: t.name, currency: t.currency, issuer: t.issuer, supply: t.supply || t.amount,
      marketCapUsd: xrpUsd && t.marketcap ? t.marketcap * xrpUsd : null,
      usdPrice: t.usd ? parseFloat(t.usd) : null
    }));
}

// Called on every cron tick. No-ops (one KV read, no writes) while the
// published list is fresh and no build is running.
export async function stepPopularCoins(kv) {
  if (!kv) return { skipped: 'no_kv' };
  const [listRaw, wipRaw] = await Promise.all([kv.get(POPULAR_COINS_KEY), kv.get(POPULAR_COINS_WIP_KEY)]);
  const list = listRaw ? JSON.parse(listRaw) : null;
  let wip = wipRaw ? JSON.parse(wipRaw) : null;
  if (!wip) {
    if (list && Date.now() - list.updatedAt < POPULAR_COINS_MAX_AGE_MS) return { skipped: 'fresh' };
    const candidates = await fetchCandidates();
    if (!candidates) return { error: 'candidates_failed' };
    wip = { startedAt: Date.now(), candidates, next: 0, attempts: 0, done: [] };
  }
  const c = wip.candidates[wip.next];
  let row = null;
  try { row = await checkCoin(c); } catch (e) { row = null; }
  if (row) {
    wip.done.push(row);
    wip.next++; wip.attempts = 0;
  } else if (++wip.attempts >= MAX_ATTEMPTS_PER_COIN) {
    wip.next++; wip.attempts = 0; // give up on this one for this build
  }
  if (wip.next >= wip.candidates.length) {
    const coins = wip.done
      .sort((a, b) => (b.marketCapUsd || 0) - (a.marketCapUsd || 0))
      .slice(0, POPULAR_COINS_SHOWN);
    if (coins.length) await safeKvPut(kv, POPULAR_COINS_KEY, JSON.stringify({ updatedAt: Date.now(), coins }));
    await kv.delete(POPULAR_COINS_WIP_KEY).catch(() => {});
    return { published: coins.length };
  }
  await safeKvPut(kv, POPULAR_COINS_WIP_KEY, JSON.stringify(wip));
  return { checked: c.name, ok: !!row, progress: wip.next + '/' + wip.candidates.length };
}

export async function getPopularCoins(kv) {
  if (!kv) return null;
  const raw = await kv.get(POPULAR_COINS_KEY);
  return raw ? JSON.parse(raw) : null;
}
