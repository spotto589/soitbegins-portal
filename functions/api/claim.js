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

  let kind = 'unknown';
  try {
    const body = await request.json();
    if (body && (body.kind === 'honey' || body.kind === 'crwn')) kind = body.kind;
  } catch (e) {}

  // Claim requests are only logged, not paid out — no persistent claims
  // ledger is wired up yet beyond the KV holding-timer.
  console.log(kind.toUpperCase(), 'claim requested by', payload.acct, 'at', new Date().toISOString());

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
