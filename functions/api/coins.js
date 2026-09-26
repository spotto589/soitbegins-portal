import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountLines, encodeCurrencyCode,
  ensurePopularCoinConfig, getTradeConfig, createXamanPayload, getXamanUserToken, clientSignResponse, POPULAR_COINS_KEY
} from '../_shared.js';

// STAT!C://C0!NS — the popular XRPL meme coins list (built in the
// background by cron-worker, see functions/_coins.js).
//
// GET  /api/coins          the published list (badge + plain-English reasons per coin)
// GET  /api/coins?mine=1   the same, plus the logged-in wallet's trustline/balance per coin
// POST /api/coins          { trust: 'coin:<md5>' } — a TrustSet sign request so the
//                          wallet can hold that coin. Signing/submission is Xaman's,
//                          same as every other sign flow here; status is polled via
//                          /api/buyswap-status (it reports any validated tx generically).

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

async function sessionAcct(request, env) {
  const token = getCookie(request, BOARD_COOKIE_NAME);
  const payload = token ? await verifyToken(token, env.Σκύλλα) : null;
  return payload && payload.acct ? payload.acct : null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.coin || !env.Σκύλλα) return json({ error: 'server_misconfigured' }, 500);
  const raw = await env.coin.get(POPULAR_COINS_KEY);
  const list = raw ? JSON.parse(raw) : null;
  if (!list || !Array.isArray(list.coins)) return json({ updatedAt: null, coins: [] });

  const out = { updatedAt: list.updatedAt, coins: list.coins };
  const url = new URL(request.url);
  if (url.searchParams.get('mine') === '1') {
    const acct = await sessionAcct(request, env);
    if (acct) {
      const lines = await fetchAllAccountLines(acct);
      out.wallet = acct;
      // null = the ledger read failed (show "couldn't load", never a fake 0).
      out.mine = {};
      for (const c of list.coins) {
        if (lines === null) { out.mine[c.key] = { hasTrustline: null, balance: null }; continue; }
        const line = lines.find(l => l.account === c.issuer && l.currency === encodeCurrencyCode(c.currency));
        out.mine[c.key] = line ? { hasTrustline: true, balance: parseFloat(line.balance) || 0 } : { hasTrustline: false, balance: 0 };
      }
    }
  }
  return json(out);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.coin || !env.Σκύλλα) return json({ error: 'server_misconfigured' }, 500);
  if (!env.XAMAN_PROXY_URL || !env.XAMAN_PROXY_SHARED_SECRET) return json({ error: 'xaman_not_configured' }, 501);
  const acct = await sessionAcct(request, env);
  if (!acct) return json({ error: 'no_session' }, 401);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const key = body && body.trust;
  if (!(await ensurePopularCoinConfig(env.coin, key))) return json({ error: 'not_tradeable' }, 400);
  const cfg = getTradeConfig(key);

  // Built entirely server-side from the published list — the client only
  // names which coin. tfSetNoRipple (0x00020000), the normal holder
  // setting; limit is the ledger's maximum so no amount is ever refused.
  const txjson = {
    TransactionType: 'TrustSet',
    Account: acct,
    LimitAmount: { currency: encodeCurrencyCode(cfg.tokenConfig.currency), issuer: cfg.tokenConfig.issuer, value: '9999999999999999e80' },
    Flags: 0x00020000
  };

  const cs = await clientSignResponse(env, body, acct, txjson, 'plain', null, null);
  if (cs) return cs;
  const pushToken = await getXamanUserToken(env.coin, acct);
  const xummData = await createXamanPayload(env, txjson, undefined, pushToken);
  if (!xummData || !xummData.uuid || !xummData.next) return json({ error: 'xaman_request_failed' }, 502);
  return json({ ok: true, uuid: xummData.uuid, next: xummData.next });
}
