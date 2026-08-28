import { BOARD_COOKIE_NAME, getCookie, verifyToken } from '../_shared.js';

const XRPL_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const MAX_BODY_LENGTH = 1000;
// Per-sender flood guard — cheap D1 count query, not a hard anti-spam
// system, just enough to stop a runaway client (bug or bot) from writing
// hundreds of rows a second. 20 messages/60s is generous for a real
// back-and-forth negotiation, well below anything a human typing hits.
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export async function onRequestPost(context) {
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
  const sender = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const toWallet = body && body.toWallet;
  if (!toWallet || typeof toWallet !== 'string' || !XRPL_ADDRESS_RE.test(toWallet)) {
    return new Response(JSON.stringify({ error: 'invalid_to_wallet' }), { status: 400 });
  }
  if (toWallet === sender) {
    return new Response(JSON.stringify({ error: 'cannot_message_self' }), { status: 400 });
  }

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return new Response(JSON.stringify({ error: 'empty_message' }), { status: 400 });
  }
  if (text.length > MAX_BODY_LENGTH) {
    return new Response(JSON.stringify({ error: 'message_too_long', maxLength: MAX_BODY_LENGTH }), { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);

  const recentCount = await env.MESSAGES_DB.prepare(
    'SELECT COUNT(*) AS n FROM messages WHERE sender = ?1 AND created_at > ?2'
  ).bind(sender, now - RATE_LIMIT_WINDOW_SECONDS).first('n');
  if (recentCount >= RATE_LIMIT_MAX) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 });
  }

  const result = await env.MESSAGES_DB.prepare(
    'INSERT INTO messages (sender, recipient, body, created_at) VALUES (?1, ?2, ?3, ?4)'
  ).bind(sender, toWallet, text, now).run();

  return new Response(JSON.stringify({
    ok: true,
    id: result.meta && result.meta.last_row_id,
    createdAt: now
  }), { headers: { 'Content-Type': 'application/json' } });
}
