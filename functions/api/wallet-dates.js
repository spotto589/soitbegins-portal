import { getWalletIdentityDates } from '../_shared.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
  });
}

// Σκύλλα://!DENT!TY's ACT!VATED / !NCEPT!0N dates for any wallet (both are
// public — shown on that wallet's profile banner). See
// getWalletIdentityDates in _shared.js.
export async function onRequestGet(context) {
  const wallet = new URL(context.request.url).searchParams.get('wallet');
  if (!wallet || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(wallet)) return json({ error: 'bad_wallet' }, 400);
  if (!context.env.coin) return json({ error: 'server_misconfigured' }, 500);
  return json(await getWalletIdentityDates(context, wallet));
}
