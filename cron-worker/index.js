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
import { maybeRefreshPigeonNumberMap, maybeRefreshHighSaleMap } from '../functions/_shared.js';

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([
      maybeRefreshPigeonNumberMap(env.coin),
      maybeRefreshHighSaleMap(env.coin),
    ]));
  },
};
