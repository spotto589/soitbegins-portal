import { BOARD_COOKIE_NAME, getCookie, verifyToken, safeKvPut, TRADEABLE_COLLECTIONS } from '../_shared.js';

// Per-wallet notification settings (2026-09-25): which collections, and
// which kinds of activity (from the ledger watcher's event feed, see
// functions/_ledgerwatch.js), should pop up for this wallet.
// Shape: { collections: { <key>: { listing: true, sale: true, ... } } }
export const NOTIFY_TYPES = ['listing', 'sale', 'offer', 'delist', 'transfer', 'mint', 'burn'];
const PREFS_PREFIX = 'pswap:notify:v1:';

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}
async function sessionWallet(request, env) {
  const token = getCookie(request, BOARD_COOKIE_NAME);
  const s = token && env.Σκύλλα ? await verifyToken(token, env.Σκύλλα) : null;
  return s && s.acct ? s.acct : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.coin) return json({ error: 'server_misconfigured' }, 500);
  const wallet = await sessionWallet(request, env);
  if (!wallet) return json({ error: 'no_session' }, 401);
  const raw = await env.coin.get(PREFS_PREFIX + wallet);
  return json({ ok: true, prefs: raw ? JSON.parse(raw) : { collections: {} } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.coin) return json({ error: 'server_misconfigured' }, 500);
  const wallet = await sessionWallet(request, env);
  if (!wallet) return json({ error: 'no_session' }, 401);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const clean = { collections: {} };
  const cols = (body && body.collections) || {};
  Object.keys(cols).forEach(key => {
    if (!TRADEABLE_COLLECTIONS[key]) return;
    const t = {};
    NOTIFY_TYPES.forEach(type => { if (cols[key] && cols[key][type] === true) t[type] = true; });
    if (Object.keys(t).length) clean.collections[key] = t;
  });
  await safeKvPut(env.coin, PREFS_PREFIX + wallet, JSON.stringify(clean));
  return json({ ok: true, prefs: clean });
}
