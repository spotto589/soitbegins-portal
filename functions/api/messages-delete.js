import { BOARD_COOKIE_NAME, getCookie, verifyToken } from '../_shared.js';

// Deletes one of YOUR OWN messages only (sender = you) — never a message
// the other side sent, so this can only ever unsend your own words, not
// tamper with theirs. Hard delete: this table has no soft-delete/read
// state for the row itself beyond read_at, and there's no "for everyone"
// vs "for me" distinction to preserve here.
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
  const me = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const id = body && Number(body.id);
  if (!id || !Number.isInteger(id)) {
    return new Response(JSON.stringify({ error: 'invalid_id' }), { status: 400 });
  }

  const result = await env.MESSAGES_DB.prepare(
    'DELETE FROM messages WHERE id = ?1 AND sender = ?2'
  ).bind(id, me).run();

  if (!result.meta || !result.meta.changes) {
    return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
