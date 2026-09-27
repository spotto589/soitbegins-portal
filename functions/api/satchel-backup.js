import { BOARD_COOKIE_NAME, getCookie, verifyToken, safeKvPut } from '../_shared.js';

// SATCHEL backup across Xaman's daily sign-in (reported live 2026-09-27:
// "my cart was empty" after re-signing in). On phones that sign-in leaves
// the page for Xaman and comes back through Xaman's return link, which can
// land in a different browser (or outside the home-screen app), where the
// satchel kept in the old one's storage isn't there. So just before it,
// the page saves the satchel here (one KV write, gone after a day) and puts
// the returned id in Xaman's return link; the page it lands on reads it
// back. POST needs a signed-in session (so the write quota can't be spent
// by anyone); GET only needs the unguessable id.

const MAX_ITEMS = 15;
const TTL_SECONDS = 86400;

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

function cleanItem(c) {
  if (!c || typeof c !== 'object') return null;
  if (typeof c.nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(c.nftId)) return null;
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);
  return {
    mode: c.mode === 'offer' ? 'offer' : 'buy',
    nftId: c.nftId,
    collection: str(c.collection, 40) || 'pigeons',
    currency: c.currency === 'xrp' ? 'xrp' : 'token',
    price: str(String(c.price == null ? '' : c.price), 30),
    number: typeof c.number === 'number' ? c.number : null,
    name: str(c.name, 80),
    image: str(c.image, 400)
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.Σκύλλα || !env.coin) return json({ error: 'server_misconfigured' }, 500);
  const token = getCookie(request, BOARD_COOKIE_NAME);
  const session = token ? await verifyToken(token, env.Σκύλλα) : null;
  if (!session || !session.acct) return json({ error: 'invalid_session' }, 401);
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const items = (Array.isArray(body && body.items) ? body.items : []).slice(0, MAX_ITEMS).map(cleanItem).filter(Boolean);
  if (!items.length) return json({ error: 'empty' }, 400);
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  await safeKvPut(env.coin, 'satchelbak:' + id, JSON.stringify({ wallet: session.acct, items, at: Date.now() }), { expirationTtl: TTL_SECONDS });
  return json({ ok: true, id });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.coin) return json({ error: 'server_misconfigured' }, 500);
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!/^[0-9a-f]{24}$/.test(id)) return json({ error: 'bad_request' }, 400);
  const raw = await env.coin.get('satchelbak:' + id);
  if (!raw) return json({ error: 'not_found' }, 404);
  const data = JSON.parse(raw);
  return json({ ok: true, wallet: data.wallet, items: data.items });
}
