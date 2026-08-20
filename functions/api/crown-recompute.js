import { recomputeCrownHolder } from '../_shared.js';

// Triggers the expensive full Pigeon-collection scan that determines the
// current Crown holder (see getPigeon Crown section in _shared.js for
// why this can't run inline on a normal page request). Nothing here is
// sensitive or destructive — it only recomputes public on-chain
// ownership data — and recomputeCrownHolder() self-rate-limits, so this
// is deliberately left open rather than gated behind a session.
//
// Cloudflare Pages Functions have no cron trigger of their own, so
// something has to call this periodically from outside the app — e.g. a
// free external scheduler (cron-job.org, a GitHub Actions scheduled
// workflow, etc.) hitting this URL every few minutes. board.js also
// opportunistically kicks off the same recompute in the background
// whenever the cached snapshot goes stale, so this endpoint is a backstop
// for freshness, not the only way the Crown ever updates.
export async function onRequestPost(context) {
  const { env } = context;

  if (!env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  const snapshot = await recomputeCrownHolder(env.coin);
  return new Response(JSON.stringify({ ok: true, snapshot }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
