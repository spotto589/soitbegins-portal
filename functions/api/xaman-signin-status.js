import { BOARD_COOKIE_NAME, signToken, getXamanPayloadStatus } from '../_shared.js';

// Was 30 minutes — far too short for a wallet-ownership session that
// doesn't hold any funds/keys itself (every real signing action still
// requires a fresh Xaman approval regardless of how old this session is,
// so a long-lived session doesn't widen what a stolen cookie could
// actually do). 90 days reads as "stays logged in until you actually
// click SIGN OUT" for any realistic session — same value connect.js
// (the old OAuth login path) already used.
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 90;

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) });
}

// Polled by the browser after requesting a SignIn payload (see
// xaman-signin-prepare.js). Unlike a real transaction, a SignIn never
// submits anything to the ledger — response.account IS the proof of
// wallet ownership here (the standard, documented way Xaman apps
// authenticate a user), so once meta.signed is true there's nothing
// further to cross-check before issuing the session.
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
    return json({ error: 'server_misconfigured' }, 500);
  }
  if (!env.XAMAN_PROXY_URL || !env.XAMAN_PROXY_SHARED_SECRET) {
    return json({ error: 'xaman_not_configured' }, 501);
  }

  const url = new URL(request.url);
  const uuid = url.searchParams.get('uuid');
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid)) {
    return json({ error: 'bad_request' }, 400);
  }

  const xummData = await getXamanPayloadStatus(env, uuid);
  if (!xummData) {
    return json({ error: 'xaman_lookup_failed' }, 502);
  }
  const meta = xummData.meta;
  const resp = xummData.response;

  if (meta && meta.expired) {
    return json({ status: 'expired' });
  }
  if (meta && meta.cancelled) {
    return json({ status: 'rejected' });
  }
  if (!meta || !meta.signed) {
    return json({ status: 'pending' });
  }

  const account = resp && resp.account;
  if (!account) {
    // Signed on Xaman's side but the resolving account hasn't shown up in
    // the payload response yet — keep polling rather than fail outright.
    return json({ status: 'pending' });
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await signToken({ acct: account, exp }, env.Σκύλλα);

  return json({ status: 'signed' }, 200, {
    'Set-Cookie': `${BOARD_COOKIE_NAME}=${token}; Path=/; Max-Age=${TOKEN_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`
  });
}
