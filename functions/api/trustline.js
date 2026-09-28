import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, encodeCurrencyCode,
  ensurePopularCoinConfig, getTradeConfig, createXamanPayload, getXamanUserToken
} from '../_shared.js';

// GET /api/trustline?c=<collection key | coin:<md5>>[&back=help|static]
//
// A plain LINK that sets a trustline (2026-09-28) — the HELP page and the
// trustline banner point straight at it. Makes a TrustSet sign request and
// sends the browser to Xaman: a QR page on a computer, the Xaman app on a
// phone. Works signed out too: with no Account in the txjson, Xaman fills
// in whichever wallet signs it. Signed in, it's addressed to that wallet
// and pushed to the phone like every other sign request.
// Built entirely server-side from the collection's own tokenConfig — the
// link only names which token.

async function sessionAcct(request, env) {
  const token = getCookie(request, BOARD_COOKIE_NAME);
  const payload = token && env.Σκύλλα ? await verifyToken(token, env.Σκύλλα) : null;
  return payload && payload.acct ? payload.acct : null;
}

function redirect(url) {
  return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'no-store' } });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const back = url.searchParams.get('back') === 'static' ? '/static' : '/help';
  const failUrl = url.origin + back + (back === '/help' ? '?trust=failed#step-trust' : '');
  if (!env.XAMAN_PROXY_URL || !env.XAMAN_PROXY_SHARED_SECRET) return redirect(failUrl);

  const key = url.searchParams.get('c') || '';
  if (key.indexOf('coin:') === 0 && !(await ensurePopularCoinConfig(env.coin, key))) return redirect(failUrl);
  const cfg = getTradeConfig(key);
  const tc = cfg && cfg.tokenConfig;
  if (!tc || !tc.configured || !tc.currency || !tc.issuer) return redirect(failUrl);

  const acct = await sessionAcct(request, env);
  // tfSetNoRipple (0x00020000), the normal holder setting; the ledger's
  // maximum limit so no amount is ever refused (same as /api/coins).
  const txjson = {
    TransactionType: 'TrustSet',
    LimitAmount: { currency: encodeCurrencyCode(tc.currency), issuer: tc.issuer, value: '9999999999999999e80' },
    Flags: 0x00020000
  };
  if (acct) txjson.Account = acct;

  const doneUrl = url.origin + back + (back === '/help' ? '?trust=done#step-trust' : '');
  const pushToken = acct && env.coin ? await getXamanUserToken(env.coin, acct) : null;
  const xummData = await createXamanPayload(env, txjson, { expire: 10, return_url: { app: doneUrl, web: doneUrl } }, pushToken);
  if (!xummData || !xummData.next || !xummData.next.always) return redirect(failUrl);
  return redirect(xummData.next.always);
}
