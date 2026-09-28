import { BOARD_COOKIE_NAME, getCookie, verifyToken } from '../_shared.js';

const XRPL_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const THREAD_LIMIT = 200;

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.MESSAGES_DB) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  const token = getCookie(request, BOARD_COOKIE_NAME);
  if (!token) {
    return new Response(JSON.stringify({ error: 'no_session' }), { status: 401 });
  }
  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401 });
  }
  const me = payload.acct;

  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet');
  if (!wallet || !XRPL_ADDRESS_RE.test(wallet)) {
    return new Response(JSON.stringify({ error: 'invalid_wallet' }), { status: 400 });
  }

  // The NEWEST 200 (shown oldest first). ?after=<id> = only newer ones —
  // an open chat polls with it (2026-09-28).
  const after = Math.max(0, Number(url.searchParams.get('after')) || 0);
  const { results: newestFirst } = await env.MESSAGES_DB.prepare(`
    SELECT id, sender, recipient, body, created_at, read_at
    FROM messages
    WHERE ((sender = ?1 AND recipient = ?2) OR (sender = ?2 AND recipient = ?1)) AND id > ?4
    ORDER BY id DESC
    LIMIT ?3
  `).bind(me, wallet, THREAD_LIMIT, after).all();
  const results = (newestFirst || []).reverse();

  const now = Math.floor(Date.now() / 1000);
  // Mark their messages to me as read now that this thread's actually
  // being viewed. Fire-and-forget-ish: doesn't block the response, and a
  // failure here just means the unread badge stays stale for a bit, never
  // something that should fail the whole read.
  context.waitUntil(
    env.MESSAGES_DB.prepare(
      'UPDATE messages SET read_at = ?1 WHERE recipient = ?2 AND sender = ?3 AND read_at IS NULL'
    ).bind(now, me, wallet).run().catch(() => {})
  );

  const items = (results || []).map(row => ({
    id: row.id,
    fromMe: row.sender === me,
    body: row.body,
    createdAt: row.created_at,
    read: row.read_at !== null
  }));

  // Newest of MY messages they've opened — lets an open chat tick its
  // SEEN marks without re-fetching old messages.
  const seenUpTo = await env.MESSAGES_DB.prepare(
    'SELECT MAX(id) AS n FROM messages WHERE sender = ?1 AND recipient = ?2 AND read_at IS NOT NULL'
  ).bind(me, wallet).first('n');

  return new Response(JSON.stringify({ wallet, items, seenUpTo: seenUpTo || 0 }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
