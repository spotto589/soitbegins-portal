import { COOKIE_NAME, getCookie, verifyToken } from '../_shared.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  const token = getCookie(request, COOKIE_NAME);
  if (!token) {
    return new Response(JSON.stringify({ error: 'no_session' }), { status: 401 });
  }

  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401 });
  }

  // No persistent store wired up yet — this just acknowledges the request.
  // Claims aren't recorded anywhere durable until a KV namespace (or similar)
  // is bound and written to here.
  console.log('CRWN claim requested by', payload.acct, 'at', new Date().toISOString());

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
