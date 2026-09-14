import { syncWalletAchievements } from '../_shared.js';

// Public, no session — same reasoning myNftCounts/walletHistory already
// are: every ACH!EVEMENTS/T!TLE check is a real, server-verified boolean
// over on-ledger state (see ACHIEVEMENT_RULES in _shared.js), so there's
// nothing a caller could fake by asking to sync any wallet's own real
// achievements. Visiting a wallet's PR0F!LE -> WALLET H!ST0RY/ACH!EVEMENTS
// is what actually triggers this (static.js), not a background job.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const wallet = typeof body.wallet === 'string' ? body.wallet : null;
  if (!wallet) {
    return new Response(JSON.stringify({ error: 'missing_wallet' }), { status: 400 });
  }

  const result = await syncWalletAchievements(context, wallet);
  if (!result) {
    return new Response(JSON.stringify({ error: 'ledger_lookup_failed' }), { status: 502 });
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
}
