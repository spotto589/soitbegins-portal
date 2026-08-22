import { recordSwapSale } from '../_shared.js';

// TEMPORARY, one-time use: backfills the single real BUY that settled at
// tx 99A233946A10E988980E8EE5FDA6C3EB64BB7947BB517B6189410E450968B338,
// right before the sales-recording feature (recordPendingBuy/recordSwapSale)
// was deployed - so it never got a pending-buy stash to record from. Every
// value below is read directly off that confirmed on-ledger transaction,
// not user input. Gated on the existing proxy shared secret purely so this
// isn't a public write endpoint for the few minutes it exists; remove this
// file entirely once it's been hit once.
export async function onRequestPost(context) {
  const { request, env } = context;
  if (request.headers.get('X-Admin-Secret') !== env.XAMAN_PROXY_SHARED_SECRET) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  if (!env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }
  await recordSwapSale(env.coin, {
    txHash: '99A233946A10E988980E8EE5FDA6C3EB64BB7947BB517B6189410E450968B338',
    nftId: '00081388145D9B828F16D70AC849B2BDF5964EEF91CD4CC71120140E05C75674',
    seller: 'rKymSQrwRF8DcwEzyAgNLMaaSKYSMfJNDY',
    buyer: 'raNypRjrVu98Rp3AYLRhQBDUeJKyyRRV92',
    priceValue: '1234',
    createdAt: '2026-08-22T06:20:41.000Z'
  });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}
