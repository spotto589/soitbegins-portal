import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, getSwapOfferPairs, fetchDeeptideNftDetail
} from '../_shared.js';

// Every pending swap-offer pair involving the signed-in wallet, on either
// side — this is how a counterparty discovers "someone offered you a
// Pigeon for one of yours" (no Xaman notification exists for that; the
// offer is just a Destination-restricted NFTokenOffer object sitting on
// ledger until someone looks). Each row is enriched with real image/number
// for both Pigeons and a single `action` field telling the client exactly
// what to show: reciprocate, wait, accept, or wait-for-accept.
export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
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
  const wallet = payload.acct;

  const pairs = await getSwapOfferPairs(env.coin);
  const mine = Object.values(pairs).filter(p => p.offerer.wallet === wallet || p.counterparty.wallet === wallet);

  const rows = await Promise.all(mine.map(async (p) => {
    const isOfferer = p.offerer.wallet === wallet;
    const mySide = isOfferer ? p.offerer : p.counterparty;
    const otherSide = isOfferer ? p.counterparty : p.offerer;

    let action;
    if (!mySide.offerId) action = 'need_to_offer';
    else if (!otherSide.offerId) action = 'waiting_for_other_offer';
    else if (!mySide.accepted) action = 'ready_to_accept';
    else if (!otherSide.accepted) action = 'waiting_for_other_accept';
    else action = 'done';

    const [myDetail, otherDetail] = await Promise.all([
      fetchDeeptideNftDetail(mySide.nftId),
      fetchDeeptideNftDetail(otherSide.nftId)
    ]);

    return {
      swapId: p.swapId,
      myNftId: mySide.nftId,
      myNumber: myDetail && myDetail.number,
      myImage: myDetail && myDetail.image,
      otherWallet: otherSide.wallet,
      otherNftId: otherSide.nftId,
      otherNumber: otherDetail && otherDetail.number,
      otherImage: otherDetail && otherDetail.image,
      action
    };
  }));

  return new Response(JSON.stringify({ ok: true, offers: rows.filter(r => r.action !== 'done') }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
