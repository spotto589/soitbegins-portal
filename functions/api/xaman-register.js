import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, getXamanPayloadStatus, recordPendingListing,
  recordPendingBrokerAccept, recordPendingBuy, recordSwapSignal
} from '../_shared.js';

// Browser-created sign requests (xrp.cafe-style push, 2026-09-24).
//
// A request created from the user's own Xaman browser session (XummPkce
// JWT, see static.js) is pushed straight to their phone by Xaman — a
// server-created one with a stored user_token was refused (pushed:false)
// even for a token issued seconds earlier. So for those flows the server
// only BUILDS the txjson and hands it back with a signed "intent"; the
// browser creates the request; then this endpoint links the resulting
// uuid to the server-side bookkeeping the flow needs (e.g. the pending
// listing record swap-listing-status.js cross-checks), after checking the
// real payload Xaman holds is exactly the txjson the server built.
const INTENT_SECRET_SUFFIX = ':intent';
// Fields that decide what the transaction does; Xaman may add others.
const COMPARE_FIELDS = ['TransactionType', 'Account', 'NFTokenID', 'Amount', 'Destination', 'Owner', 'Flags', 'Expiration', 'NFTokenSellOffer', 'NFTokenBuyOffer', 'NFTokenOffers'];

function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.Σκύλλα || !env.coin) return json({ error: 'server_misconfigured' }, 500);

  const token = getCookie(request, BOARD_COOKIE_NAME);
  const session = token ? await verifyToken(token, env.Σκύλλα) : null;
  if (!session || !session.acct) return json({ error: 'invalid_session' }, 401);

  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const uuid = body && body.uuid;
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid)) return json({ error: 'bad_request' }, 400);

  const intent = body.intent ? await verifyToken(body.intent, env.Σκύλλα + INTENT_SECRET_SUFFIX) : null;
  if (!intent || intent.acct !== session.acct || !intent.txjson) return json({ error: 'invalid_intent' }, 400);

  const status = await getXamanPayloadStatus(env, uuid);
  const req = status && status.payload && status.payload.request_json;
  console.log('XAMAN-PUSH register', uuid, intent.kind, 'lookup', !!status, 'app', status && status.application && status.application.uuidv4, 'hasRequest', !!req, 'browser pushed', JSON.stringify(body.pushed), 'created keys', String(body.createdKeys || '').slice(0, 200), 'opened', status && status.meta && status.meta.opened);
  if (!req) return json({ error: 'payload_not_found' }, 404);

  for (const k of COMPARE_FIELDS) {
    if (JSON.stringify(req[k]) !== JSON.stringify(intent.txjson[k])) {
      console.log('XAMAN-PUSH register mismatch', uuid, k);
      return json({ error: 'payload_mismatch' }, 400);
    }
  }

  const p = intent.pending;
  if (intent.kind === 'list') await recordPendingListing(env.coin, uuid, p);
  else if (intent.kind === 'broker') await recordPendingBrokerAccept(env.coin, uuid, p);
  else if (intent.kind === 'buy_legacy') await recordPendingBuy(env.coin, uuid, p);
  else if (intent.kind === 'signal') {
    await recordSwapSignal(env.coin, p.offerId, {
      ...p, status: 'pending', uuid, txHash: null, createdAt: Math.floor(Date.now() / 1000), crwnEligible: true, crwnCredited: false
    });
  }
  return json({ ok: true });
}
