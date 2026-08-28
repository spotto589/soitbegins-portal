import {
  getXamanPayloadStatus, storeXamanUserToken,
  fetchNftSellOffers, findSwapOffer, addIncomingTransfer, getSwapOfferPairs
} from '../_shared.js';

// Xaman calls this (server-to-server, not from the browser) whenever a
// payload created under this app resolves, as long as a webhook URL is
// configured in the Xaman Developer Console (https://apps.xumm.dev) —
// confirmed via Xaman's own SDK type defs (XummWebhookBody) and docs that
// this fires for every resolved payload the app's webhook URL is set for,
// not just push-enabled ones. That's what makes it useful for more than
// just push tokens (see the transfer-recording block below): it's a
// signal that arrives independent of whether the browser that started the
// flow is even still open.
//
// This URL must be set as the app's webhook/callback URL in the Xaman
// Developer Console — nothing here registers it automatically. Whatever
// field names Xaman's webhook body actually uses are logged (truncated)
// below the first few times this fires, since the exact shape should be
// confirmed against a real event rather than only this best-effort guess
// at Xaman's documented format.
//
// Deliberately doesn't trust the webhook body's own claim of which wallet
// resolved it (if any) — instead re-fetches the full payload status via
// the SAME getXamanPayloadStatus() every other endpoint already uses,
// since that's a mechanism already proven to return the real resolving
// account (response.account) reliably. Confirmed via the xumm-sdk's own
// TypeScript defs (XummGetPayloadResponse) that the original submitted
// transaction lives at payload.request_json.
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

  if (uuid) {
    context.waitUntil((async () => {
      const status = await getXamanPayloadStatus(env, uuid);
      if (!status) {
        console.log('xaman-webhook: payload lookup failed for uuid', uuid);
        return;
      }
      const wallet = status.response && status.response.account;

      if (token) {
        if (wallet) {
          await storeXamanUserToken(env.coin, wallet, token);
          console.log('xaman-webhook: stored push token for', wallet);
        } else {
          console.log('xaman-webhook: could not resolve signing account for uuid', uuid);
        }
      }

      // Incoming-transfer recording — the server-side counterpart to what
      // swap-offer-status.js already does from the browser's own polling
      // loop. That polling path only ever fires if the sender's tab stays
      // open long enough to see the signed transaction confirm; if it
      // closed early (or the phone locked, or the connection dropped)
      // right after signing, the real on-ledger offer would otherwise
      // stay permanently invisible to swap-incoming-transfers.js even
      // though it genuinely exists (confirmed live: this is exactly what
      // happened to a real transfer that only showed up on xrp.cafe, not
      // here, because xrp.cafe discovers offers by watching the ledger
      // directly rather than depending on the sender's browser). This
      // block is a second, independent path to the same KV write — it
      // doesn't replace the polling path, it just closes the gap for
      // whenever that path never got the chance to run.
      try {
        const meta = status.meta;
        const req = status.payload && status.payload.request_json;
        const resp = status.response;
        const signedOk = meta && meta.signed && !meta.cancelled && !meta.expired;
        const dispatchFailed = resp && resp.dispatched_result && resp.dispatched_result !== 'tesSUCCESS';
        const isPureTransferOffer = req
          && req.TransactionType === 'NFTokenCreateOffer'
          && req.Amount === '0'
          && typeof req.Destination === 'string'
          && typeof req.NFTokenID === 'string';

        if (signedOk && !dispatchFailed && isPureTransferOffer && wallet) {
          // Same "never write to the wrong bucket" concern the original
          // else-if chain in swap-offer-status.js handles: the swap
          // builder's own two-sided trades use this exact same txjson
          // shape (Amount "0", Destination-restricted) for BOTH legs, but
          // those are meant to live in the swap-pairs map, not here —
          // showing them again in the generic "NFT 0FFERED T0 Y0U" box
          // would be a confusing duplicate of UI that already exists
          // elsewhere for a tracked pair. Skip anything already recorded
          // as either half of a pair for this wallet+NFT before treating
          // it as a plain one-way transfer.
          const pairs = await getSwapOfferPairs(env.coin);
          const isTrackedSwapLeg = Object.values(pairs).some(pair =>
            (pair.offerer && pair.offerer.wallet === wallet && pair.offerer.nftId === req.NFTokenID) ||
            (pair.counterparty && pair.counterparty.wallet === wallet && pair.counterparty.nftId === req.NFTokenID)
          );

          if (!isTrackedSwapLeg) {
            // Never trust Xaman's own report alone — cross-check the real
            // on-ledger offer, same pattern swap-offer-status.js uses, so
            // this can only ever record something that's genuinely live.
            const offers = await fetchNftSellOffers(req.NFTokenID);
            const liveOffer = findSwapOffer(offers, wallet, req.Destination);
            if (liveOffer) {
              await addIncomingTransfer(env.coin, req.Destination, {
                nftId: req.NFTokenID,
                offerId: liveOffer.nft_offer_index,
                fromWallet: wallet,
                createdAt: Math.floor(Date.now() / 1000)
              });
              console.log('xaman-webhook: recorded incoming transfer', req.NFTokenID, wallet, '->', req.Destination);
            } else {
              console.log('xaman-webhook: transfer offer not yet visible on-ledger for uuid', uuid, '- not recording');
            }
          }
        }
      } catch (e) {
        console.log('xaman-webhook: transfer-recording block failed', String(e && e.message || e));
      }
    })());
  }

  // Xaman expects a fast 200 regardless — the actual work above runs in
  // the background via waitUntil.
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
}
