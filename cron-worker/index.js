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
import { maybeRefreshPigeonNumberMap, maybeRefreshHighSaleMap, maybeRefreshFloorIndex } from '../functions/_shared.js';

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
    ctx.waitUntil(Promise.all([
      maybeRefreshPigeonNumberMap(env.coin),
      maybeRefreshHighSaleMap(env.coin),
      // Real cross-marketplace floor (see its own comment in _shared.js) —
      // depends on the number map above for its nftId list, but reads
      // whatever's already cached rather than waiting on this same tick's
      // maybeRefreshPigeonNumberMap call, same as every other independent
      // crawl here.
      maybeRefreshFloorIndex(env.coin),
      pingXamanProxy(env),
    ]));
  },
};
