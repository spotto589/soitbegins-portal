import {
  KINGDOM_COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findAllKingNfts, KINGDOM_CLAIMANTS
} from '../_shared.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  const token = getCookie(request, KINGDOM_COOKIE_NAME);
  if (!token) {
    return new Response(JSON.stringify({ error: 'no_session' }), { status: 401 });
  }

  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const candidate = body && body.candidate;
  const nftId = body && body.nftId;
  if (!candidate || !KINGDOM_CLAIMANTS[candidate]) {
    return new Response(JSON.stringify({ error: 'invalid_candidate' }), { status: 400 });
  }
  if (!nftId) {
    return new Response(JSON.stringify({ error: 'king_required' }), { status: 400 });
  }

  // Never trust the client's claimed nftId directly — confirm this wallet
  // actually holds that exact King NFT right now.
  const nfts = await fetchAllAccountNfts(payload.acct);
  const kingNfts = findAllKingNfts(nfts);
  const match = kingNfts.find(n => n.NFTokenID === nftId);
  if (!match) {
    return new Response(JSON.stringify({ error: 'king_not_held' }), { status: 403 });
  }

  // One vote per King NFT, independent key per token — same reasoning as
  // the board's pigeonpost keys: no read-modify-write, no race between
  // unrelated Kings voting at the same time.
  const voteKey = `vote:${nftId}`;
  const alreadyVoted = await env.coin.get(voteKey);
  if (alreadyVoted) {
    return new Response(JSON.stringify({ error: 'king_already_voted' }), { status: 403 });
  }

  const nowTs = Math.floor(Date.now() / 1000);
  await env.coin.put(voteKey, JSON.stringify({
    candidate, nftId, acct: payload.acct, ts: nowTs
  }));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
