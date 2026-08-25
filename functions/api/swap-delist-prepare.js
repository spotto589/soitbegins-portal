import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffersOrNull, findPigeonsOffer
} from '../_shared.js';

// Σκύλλα SWAP — DELIST (phase 2). Builds and returns the exact
// NFTokenCancelOffer txjson for the confirmation screen. Requires the
// connected wallet to exactly match the live offer's owner — stricter than
// raw XRPL permissions (which also allow a Destination party or, once
// expired, anyone), since Scylla's own UI should never facilitate
// cancelling someone else's listing.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  const token = getCookie(request, BOARD_COOKIE_NAME);
  if (!token) {
    return new Response(JSON.stringify({ error: 'no_session' }), { status: 401 });
  }
  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401 });
  }
  const seller = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const nftId = body && body.nftId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'invalid_nft_id' }), { status: 400 });
  }

  // null specifically means the live nft_sell_offers lookup itself failed
  // (xrplcluster.com rate-limited, network blip) — must NOT be treated as
  // "genuinely not listed," or a transient blip wrongly tells a real
  // seller their own live listing doesn't exist (confirmed: this exact
  // mistake, using the tolerant empty-array-on-failure fetchNftSellOffers
  // instead of this null-on-failure variant, was DELIST's actual bug —
  // same class of bug the scyllaListed background-verify comment already
  // warns about elsewhere in this file).
  const offers = await fetchNftSellOffersOrNull(nftId);
  if (offers === null) {
    return new Response(JSON.stringify({ error: 'lookup_failed' }), { status: 502 });
  }
  // Specifically the Σκύλλα $PIGEONS offer — the same wallet can also
  // have an unrelated XRP (or other) sell offer live on the same NFT
  // (e.g. an existing Deeptide listing); matching on owner alone would
  // risk cancelling the wrong one.
  const ownOffer = findPigeonsOffer(offers, seller);
  if (!ownOffer) {
    return new Response(JSON.stringify({ error: 'not_listed_by_you' }), { status: 403 });
  }

  const txjson = {
    TransactionType: 'NFTokenCancelOffer',
    Account: seller,
    NFTokenOffers: [ownOffer.nft_offer_index]
  };

  return new Response(JSON.stringify({ ok: true, txjson }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
