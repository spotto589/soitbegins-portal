// Standalone scheduled Worker — NOT part of the Pages app in ../functions,
// since Cloudflare Pages Functions can't run on a Cron Trigger. Deployed
// separately (`npx wrangler deploy` from this folder), on its own 15-minute
// timer, bound to the same KV namespace the site already uses.
//
// Why this exists: maybeRefreshPigeonNumberMap/maybeRefreshHighSaleMap used
// to only run as a side effect of some visitor's own request happening to
// notice the cached data was stale (see functions/api/pigeons.js). That
// means freshness depended on random traffic — quiet periods could sit
// stale well past the 6h window, and a pigeon number the crawl hadn't
// reached yet showed as "not indexed" to whoever searched for it first.
// This worker just keeps both indexes warm on its own, independent of
// whether anyone is on the site.
import { maybeRefreshPigeonNumberMap, maybeRefreshHighSaleMap, maybeRefreshFloorIndex, recomputeCrownHolder, TRADEABLE_COLLECTIONS } from '../functions/_shared.js';

// xaman-proxy (../xaman-proxy, deployed separately on Render) spins down
// after ~15 minutes with no HTTP traffic on Render's free tier. The first
// BUY $PIGEONS sign request after a quiet period then has to wait out a
// cold start before Xaman's popup ever loads — confirmed live as the cause
// of "white screen, wait for it to time out, click it again" on the swap
// panel. A plain GET to its unauthenticated '/' health route is enough to
// keep it warm; this worker's own 10-minute tick (see [triggers] in
// wrangler.toml, tightened from 15 for margin against Render's 15-minute
// window) just piggybacks that ping onto the existing schedule. Failure
// here is non-fatal and logged only — never allowed to block the real
// index-refresh work above.
async function pingXamanProxy(env) {
  if (!env.XAMAN_PROXY_URL) return;
  try {
    await fetch(env.XAMAN_PROXY_URL + '/');
  } catch (e) {
    console.log('xaman-proxy keep-alive ping failed', String(e && e.message || e));
  }
}

export default {
  async scheduled(event, env, ctx) {
    // Every real tradeable collection, not just P!GE0NS (the implicit
    // default when collectionKey is undefined — see maybeRefreshHighSaleMap's
    // own shopSlug fallback in _shared.js) — confirmed live as the actual
    // reason a brand-new collection (WH!TE RABB!T/C0NSP!RACY AREA 589) never
    // got real RECORD SALE/RECENT SALE data even with a correct
    // deeptideShopSlug configured: this worker was the ONLY thing meant to
    // keep that index warm independent of site traffic (see this file's own
    // top comment), and it had literally never been extended past P!GE0NS
    // since PHN!X was the only other real collection at the time. Each
    // function still no-ops instantly for a collection with no real
    // deeptideShopSlug (SEAL/FUZZY/3RD EYE/SM0K!), so looping every key here
    // is cheap for those; HANDOFF.md's own subrequest-budget rule is the
    // reason this doesn't also loop maybeRefreshFloorIndex the same way —
    // that one's real per-item crawl cost is heavier and still Pigeons-only
    // (its own separate, bigger lift).
    const collectionKeys = Object.keys(TRADEABLE_COLLECTIONS);
    ctx.waitUntil(Promise.all([
      ...collectionKeys.map(key => maybeRefreshPigeonNumberMap(env.coin, key)),
      ...collectionKeys.map(key => maybeRefreshHighSaleMap(env.coin, key)),
      // Real cross-marketplace floor (see its own comment in _shared.js) —
      // depends on the number map above for its nftId list, but reads
      // whatever's already cached rather than waiting on this same tick's
      // maybeRefreshPigeonNumberMap call, same as every other independent
      // crawl here. Still P!GE0NS-only (see this function's own comment
      // above on why it isn't looped here too).
      maybeRefreshFloorIndex(env.coin),
      // T0P 123 H0LDERS/CR0WN — its own background recompute-on-stale
      // trigger was deliberately removed from the request path (see
      // pigeons.js's own comment on the topHolders handler, "to stop the
      // recurring KV writes"), which left the snapshot frozen at whatever
      // it was the last time someone manually ran it — reported live as
      // "hasnt been updated in a long time". Belongs here instead: this
      // worker already exists specifically to keep the other indexes warm
      // independent of site traffic, and recomputeCrownHolder's own
      // internal CROWN_RECOMPUTE_MIN_INTERVAL_SECONDS (60s) means this
      // 10-minute tick calling it unconditionally is still just 1 real
      // recompute (2 KV writes) per tick, not per request.
      recomputeCrownHolder(env.coin),
      pingXamanProxy(env),
    ]));
  },
};
