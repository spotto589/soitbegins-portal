import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, createXamanPayload, getXamanUserToken, stringToHex, recordSwapSignal
} from '../_shared.js';

const XRPL_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
// Exactly 123 drops (0.000123 XRP) — a notification, not part of the
// trade consideration. Never sent automatically; only ever reached from
// an explicit SEND S!GNAL click on the ΣΚΥΛΛΑ://S!GNAL popup.
const SIGNAL_DROPS = '123';

// Real standalone XRP Payment, completely separate from the NFTokenCreate
// Offer it's attached to — carries two Memos: a human-readable one (shown
// in any wallet/explorer) and a structured one (nftId+offerId) so this
// signal can be reliably associated back to the exact offer later, by a
// human or a future CRWN reward engine alike.
export async function onRequestPost(context) {
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
  const sender = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const nftId = body && body.nftId;
  const offerId = body && body.offerId;
  const toWallet = body && body.toWallet;
  const pigeonNumber = body && typeof body.pigeonNumber === 'number' ? body.pigeonNumber : null;
  if (
    !nftId || !/^[0-9A-Fa-f]{64}$/.test(nftId) ||
    !offerId || !/^[0-9A-Fa-f]{64}$/.test(offerId) ||
    !toWallet || !XRPL_ADDRESS_RE.test(toWallet)
  ) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }
  if (toWallet === sender) {
    return new Response(JSON.stringify({ error: 'cannot_signal_self' }), { status: 400 });
  }

  const humanLabel = 'ΣΚΥΛΛΑ://S!GNAL :: P!GE0N #' + (pigeonNumber !== null ? pigeonNumber : '????') + ' :: OFFER';
  const txjson = {
    TransactionType: 'Payment',
    Account: sender,
    Destination: toWallet,
    Amount: SIGNAL_DROPS,
    Memos: [
      {
        Memo: {
          MemoType: stringToHex('ScyllaSignal'),
          MemoFormat: stringToHex('text/plain'),
          MemoData: stringToHex(humanLabel)
        }
      },
      // Structured, machine-readable pairing — same nftId/offerId a
      // future CRWN reward engine (or a manual audit) needs to tie this
      // exact payment back to the exact offer it was sent for.
      {
        Memo: {
          MemoType: stringToHex('ScyllaSignalOffer'),
          MemoFormat: stringToHex('application/json'),
          MemoData: stringToHex(JSON.stringify({ nftId, offerId }))
        }
      }
    ]
  };

  const pushToken = await getXamanUserToken(env.coin, sender);
  const xummData = await createXamanPayload(env, txjson, undefined, pushToken);
  if (!xummData || !xummData.uuid || !xummData.next) {
    return new Response(JSON.stringify({ error: 'xaman_request_failed' }), { status: 502 });
  }

  // Recorded as 'pending' the instant the sign request exists — never
  // 'sent' until swap-signal-status.js independently confirms real
  // on-ledger settlement. crwnEligible/crwnCredited exist now so a later
  // reward engine has a real field to query; nothing credits/withdraws
  // anything today (see this record shape's own comment in _shared.js).
  context.waitUntil(recordSwapSignal(env.coin, offerId, {
    nftId,
    offerId,
    fromWallet: sender,
    toWallet,
    pigeonNumber,
    status: 'pending',
    uuid: xummData.uuid,
    txHash: null,
    createdAt: Math.floor(Date.now() / 1000),
    crwnEligible: true,
    crwnCredited: false
  }));

  return new Response(JSON.stringify({ ok: true, uuid: xummData.uuid, next: xummData.next }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
