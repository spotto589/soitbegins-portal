import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, getXamanPayloadStatus, getSwapSignal, recordSwapSignal
} from '../_shared.js';

// Polled by the browser after SEND S!GNAL while the sender is signing.
// Never marks a signal 'sent' just because Xaman accepted the sign
// request — only once dispatched_result is genuinely tesSUCCESS does this
// record it as settled. Any other outcome (rejected/expired/failed)
// leaves the signal record as 'failed' with a reason, never 'sent' — the
// popup can offer a retry, which POSTs a fresh payload and overwrites this
// same offerId-keyed entry.
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }
  if (!env.XAMAN_PROXY_URL || !env.XAMAN_PROXY_SHARED_SECRET) {
    return new Response(JSON.stringify({ error: 'xaman_not_configured' }), { status: 501 });
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
  const uuid = url.searchParams.get('uuid');
  const offerId = url.searchParams.get('offerId');
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid) || !offerId || !/^[0-9A-Fa-f]{64}$/.test(offerId)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const xummData = await getXamanPayloadStatus(env, uuid);
  if (!xummData) {
    return new Response(JSON.stringify({ error: 'xaman_lookup_failed' }), { status: 502 });
  }
  const meta = xummData.meta;
  const resp = xummData.response;

  const existing = await getSwapSignal(env.coin, offerId);

  async function markFailed(reason) {
    if (existing) {
      context.waitUntil(recordSwapSignal(env.coin, offerId, Object.assign({}, existing, { status: 'failed', failReason: reason })));
    }
  }

  if (meta && meta.expired) {
    await markFailed('expired');
    return new Response(JSON.stringify({ status: 'expired' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (meta && meta.cancelled) {
    await markFailed('rejected');
    return new Response(JSON.stringify({ status: 'rejected' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (!meta || !meta.signed) {
    return new Response(JSON.stringify({ status: 'pending' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (resp && resp.dispatched_result && resp.dispatched_result !== 'tesSUCCESS') {
    await markFailed(resp.dispatched_result);
    return new Response(JSON.stringify({ status: 'failed', result: resp.dispatched_result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const txHash = resp && resp.txid;
  if (!txHash) {
    // Signed but dispatched_result/txid not populated yet — keep polling.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  context.waitUntil(recordSwapSignal(env.coin, offerId, Object.assign({}, existing, { status: 'sent', txHash })));

  return new Response(JSON.stringify({ status: 'sent', txHash }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
