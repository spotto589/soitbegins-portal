import {
  KINGDOM_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts,
  findAllKingNfts, findAllHoneypots, findAllGreenNfts, findAllYellowNfts,
  KINGDOM_CLAIM_CONFIG
} from '../_shared.js';

const ELIGIBILITY = {
  honey: findAllHoneypots,
  beta: findAllGreenNfts,
  rlusd: findAllYellowNfts,
  crwn: findAllKingNfts,
};

// Kingdom Phase 1 — the token identifiers/amounts behind each claim kind
// haven't been provided yet (see KINGDOM_CLAIM_CONFIG). This endpoint
// verifies session + real NFT eligibility now, so the eligibility framework
// is solid; it stops short of an actual payout until those values exist.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
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

  const kind = body && body.kind;
  const finder = kind && ELIGIBILITY[kind];
  if (!finder) {
    return new Response(JSON.stringify({ error: 'invalid_kind' }), { status: 400 });
  }

  const nfts = await fetchAllAccountNfts(payload.acct);
  const held = finder(nfts);
  if (!held.length) {
    return new Response(JSON.stringify({ error: 'not_eligible' }), { status: 403 });
  }

  if (!KINGDOM_CLAIM_CONFIG[kind].configured) {
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 501 });
  }

  console.log(kind.toUpperCase(), 'claim requested by', payload.acct, 'at', new Date().toISOString());

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
