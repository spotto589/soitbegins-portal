import { BOARD_COOKIE_NAME, getCookie, verifyToken, hasWalletActivity } from '../_shared.js';

const XRPL_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

// Called right after a MAKE AN OFFER succeeds — checks whether the
// recipient (the Pigeon's owner) has any real activity on this site at
// all, before ever offering the optional ΣΚΥΛΛΑ://S!GNAL popup. Read-only,
// never sends anything itself — see swap-signal-payload.js for the actual
// payment, which only ever happens on an explicit SEND S!GNAL click.
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
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

  const url = new URL(request.url);
  const wallet = url.searchParams.get('wallet');
  if (!wallet || !XRPL_ADDRESS_RE.test(wallet)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const hasActivity = await hasWalletActivity(env, wallet);

  return new Response(JSON.stringify({
    hasActivity,
    wallet,
    walletShort: shortenAddr(wallet)
  }), { headers: { 'Content-Type': 'application/json' } });
}
