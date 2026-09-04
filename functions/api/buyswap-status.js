import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, getXamanPayloadStatus, fetchValidatedTxResult, encodeCurrencyCode, PIGEONS_TOKEN_CONFIG, getTradeConfig
} from '../_shared.js';

// Polled by the browser after [ OPEN XAMAN ] while the buyer is signing.
// Never declares success on Xaman's word alone — Xaman's own
// dispatched_result is the network's immediate submission response, not a
// guarantee the transaction reached a validated ledger. Once Xaman
// reports signed, this requires a REAL fetchValidatedTxResult lookup
// (result.validated === true) before ever reporting "settled", and reads
// the actual PIGEONS delivered straight from that transaction's own
// meta.delivered_amount — never the panel's earlier estimate/minimum,
// since what actually settled is the only honest number to show.
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
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
  if (!uuid || !/^[0-9a-fA-F-]{10,60}$/.test(uuid)) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }
  const collection = url.searchParams.get('collection') || 'pigeons';
  const cfg = getTradeConfig(collection);
  const tokenConfig = cfg ? cfg.tokenConfig : PIGEONS_TOKEN_CONFIG;

  const xummData = await getXamanPayloadStatus(env, uuid);
  if (!xummData) {
    return new Response(JSON.stringify({ error: 'xaman_lookup_failed' }), { status: 502 });
  }
  const meta = xummData.meta;
  const resp = xummData.response;

  if (meta && meta.expired) {
    return new Response(JSON.stringify({ status: 'expired' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (meta && meta.cancelled) {
    return new Response(JSON.stringify({ status: 'rejected' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (!meta || !meta.signed) {
    return new Response(JSON.stringify({ status: 'pending' }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (resp && resp.dispatched_result && resp.dispatched_result !== 'tesSUCCESS') {
    return new Response(JSON.stringify({ status: 'failed', result: resp.dispatched_result }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const txHash = resp && resp.txid;
  if (!txHash) {
    return new Response(JSON.stringify({ status: 'signed_pending_ledger' }), { headers: { 'Content-Type': 'application/json' } });
  }

  const validated = await fetchValidatedTxResult(txHash);
  if (!validated) {
    // Signed on Xaman's side, but not yet showing as a validated
    // transaction on independent ledger reads — keep polling, never
    // report success from this state.
    return new Response(JSON.stringify({ status: 'signed_pending_ledger', txHash }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (validated.transactionResult !== 'tesSUCCESS') {
    return new Response(JSON.stringify({ status: 'failed', result: validated.transactionResult, txHash }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // The real settled amount — meta.delivered_amount on a successful
  // cross-currency Payment is the exact issued-currency object actually
  // received, confirmed to be the $PIGEONS side (never assumed).
  const delivered = validated.deliveredAmount;
  const wantCurrency = encodeCurrencyCode(tokenConfig.currency);
  const receivedPigeons = (delivered && typeof delivered === 'object' && delivered.currency === wantCurrency && delivered.issuer === tokenConfig.issuer)
    ? delivered.value
    : null;

  return new Response(JSON.stringify({ status: 'settled', txHash, receivedPigeons }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
