// TEMPORARY one-off admin endpoint -- not linked from any UI. Creates a
// real Xaman sign request for a single SetRegularKey transaction,
// registering a freshly-generated backup key against the broker wallet
// (see the session's own investigation into BROKER_WALLET_SEED never
// deriving the right address on Render). Both addresses below are public
// and hardcoded deliberately, not taken from any request input. Delete
// this file once the SetRegularKey transaction has confirmed on-ledger.
import { createXamanPayload } from '../_shared.js';

const BROKER_ACCOUNT = 'rpigEoNV9KYjK6P9kzFmTqesbpqv7dpnzK';
const NEW_REGULAR_KEY = 'r9TuR7kgmZHtuAfkRUpSZWZQZtge579AQM';

export async function onRequestGet(context) {
  const { env } = context;
  const txjson = {
    TransactionType: 'SetRegularKey',
    Account: BROKER_ACCOUNT,
    RegularKey: NEW_REGULAR_KEY
  };
  const xummData = await createXamanPayload(env, txjson);
  if (!xummData || !xummData.uuid || !xummData.next) {
    return new Response(
      '<pre>xaman_request_failed\n' + JSON.stringify(xummData, null, 2) + '</pre>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
  const link = xummData.next.always;
  const qr = xummData.refs && xummData.refs.qr_png;
  return new Response(
    '<html><body style="font-family:sans-serif;padding:2rem;text-align:center;">' +
    '<h2>SetRegularKey sign request</h2>' +
    '<p>Account: ' + BROKER_ACCOUNT + '<br>New RegularKey: ' + NEW_REGULAR_KEY + '</p>' +
    (qr ? '<img src="' + qr + '" alt="QR">' : '') +
    '<p><a href="' + link + '" target="_blank" style="font-size:1.2rem;">TAP HERE TO OPEN IN XAMAN</a></p>' +
    '</body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  );
}
