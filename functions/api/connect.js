import { BOARD_COOKIE_NAME, signToken } from '../_shared.js';

const TOKEN_TTL_SECONDS = 60 * 30;

// Establishes a board-only session (separate cookie from the vault/crwn
// access-key gate) for any wallet that completes Xaman login — proving
// wallet ownership, not NFT ownership. board.js checks Pigeon ownership
// itself once a session exists.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const jwt = body && body.jwt;
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'missing_jwt' }), { status: 400 });
  }

  const userinfoRes = await fetch('https://oauth2.xumm.app/userinfo', {
    headers: { Authorization: 'Bearer ' + jwt }
  });
  if (!userinfoRes.ok) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401 });
  }
  const userinfo = await userinfoRes.json();
  const account = userinfo && userinfo.account;
  if (!account) {
    return new Response(JSON.stringify({ error: 'no_account' }), { status: 401 });
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await signToken({ acct: account, exp }, env.Σκύλλα);

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append(
    'Set-Cookie',
    `${BOARD_COOKIE_NAME}=${token}; Path=/; Max-Age=${TOKEN_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`
  );

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
