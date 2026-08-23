import { getXamanPayloadStatus, storeXamanUserToken } from '../_shared.js';

// Xaman calls this (server-to-server, not from the browser) whenever a
// payload created with push:true gets resolved and the user's app grants
// push permission. The goal: capture that wallet's reusable push token so
// EVERY LATER payload for the same wallet can arrive as a real
// notification/Event on their phone instead of needing the "OPEN XAMAN"
// browser-tab flow every time (see createXamanPayload's userToken param).
//
// This URL must be set as the app's webhook/callback URL in the Xaman
// Developer Console (https://apps.xumm.dev) — nothing here registers it
// automatically. Whatever field names Xaman's webhook body actually uses
// are logged (truncated) below the first few times this fires, since the
// exact shape should be confirmed against a real event rather than only
// this best-effort guess at Xaman's documented format.
//
// Deliberately doesn't trust the webhook body's own claim of which wallet
// resolved it (if any) — instead re-fetches the full payload status via
// the SAME getXamanPayloadStatus() every other endpoint already uses,
// since that's a mechanism already proven to return the real resolving
// account (response.account) reliably.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.coin) {
    return new Response(JSON.stringify({ ok: false, error: 'server_misconfigured' }), { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: 'bad_request' }), { status: 400 });
  }

  console.log('xaman-webhook received:', JSON.stringify(body).slice(0, 1000));

  const uuid =
    (body && body.meta && body.meta.payload_uuidv4) ||
    (body && body.payloadResponse && body.payloadResponse.payload_uuidv4) ||
    (body && body.payload_uuidv4) ||
    null;

  const token =
    (body && body.userToken && body.userToken.user_token) ||
    (body && body.user_token) ||
    null;

  if (uuid && token) {
    context.waitUntil((async () => {
      const status = await getXamanPayloadStatus(env, uuid);
      const wallet = status && status.response && status.response.account;
      if (wallet) {
        await storeXamanUserToken(env.coin, wallet, token);
        console.log('xaman-webhook: stored push token for', wallet);
      } else {
        console.log('xaman-webhook: could not resolve signing account for uuid', uuid);
      }
    })());
  }

  // Xaman expects a fast 200 regardless — the actual storage work above
  // runs in the background via waitUntil.
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}
