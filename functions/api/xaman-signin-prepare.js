import { createXamanPayload } from '../_shared.js';

// Real Xaman SignIn payload — replaces the old XummPkce OAuth login.
// Reported live as wanting login to behave like xrp.cafe's, where even
// the first action on desktop pushes straight to the phone: OAuth never
// touches the payload/webhook pipeline at all, so a wallet's push token
// (see getXamanUserToken/xaman-webhook.js) could only ever get earned
// starting from a wallet's SECOND transaction through this app — never
// login itself, and never the very first offer/buy/list either. A real
// SignIn payload resolves through the exact same webhook as any other
// payload, so THIS is what earns the push token immediately — the one-
// time QR/tab moment here is what makes every real action afterward,
// including the first one, able to push straight to the phone instead.
export async function onRequestPost(context) {
  const { env } = context;

  if (!env.XAMAN_PROXY_URL || !env.XAMAN_PROXY_SHARED_SECRET) {
    return new Response(JSON.stringify({ error: 'xaman_not_configured' }), { status: 501 });
  }

  const xummData = await createXamanPayload(env, { TransactionType: 'SignIn' }, undefined, undefined);
  const uuid = xummData && xummData.uuid;
  const next = xummData && xummData.next;
  if (!uuid || !next) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  return new Response(JSON.stringify({ ok: true, uuid, next, qr: xummData.refs && xummData.refs.qr_png }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
