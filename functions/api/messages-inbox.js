import { BOARD_COOKIE_NAME, getCookie, verifyToken } from '../_shared.js';

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

// One row per conversation partner: the latest message exchanged with
// them (either direction) plus how many of THEIR messages to me are still
// unread. A single query via window functions rather than one round trip
// per conversation — cheap on D1's free tier (5M rows read/day) even so,
// but no reason to pay per-conversation query overhead when SQLite can
// just do it in one pass.
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

  const { results } = await env.MESSAGES_DB.prepare(`
    WITH convo AS (
      SELECT *, CASE WHEN sender = ?1 THEN recipient ELSE sender END AS other
      FROM messages
      WHERE sender = ?1 OR recipient = ?1
    ),
    ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY other ORDER BY created_at DESC) AS rn
      FROM convo
    ),
    unread AS (
      SELECT sender AS other, COUNT(*) AS unread_count
      FROM messages
      WHERE recipient = ?1 AND read_at IS NULL
      GROUP BY sender
    )
    SELECT ranked.other, ranked.sender, ranked.body, ranked.created_at,
           COALESCE(unread.unread_count, 0) AS unread_count
    FROM ranked
    LEFT JOIN unread ON unread.other = ranked.other
    WHERE ranked.rn = 1
    ORDER BY ranked.created_at DESC
    LIMIT 200
  `).bind(me).all();

  const items = (results || []).map(row => ({
    wallet: row.other,
    walletShort: shortenAddr(row.other),
    lastMessage: row.body,
    lastFromMe: row.sender === me,
    lastAt: row.created_at,
    unreadCount: row.unread_count
  }));

  return new Response(JSON.stringify({ items }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
