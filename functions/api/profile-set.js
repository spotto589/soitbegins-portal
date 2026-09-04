import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNfts, findAllPigeons,
  fetchDeeptideNftDetail, isValidUsername, isUsernameTaken, setProfile
} from '../_shared.js';

// Lets a wallet set its own display name and/or profile picture (one of its
// own Pigeons). Either field can be sent alone — setProfile merges into
// whatever's already stored rather than requiring both every time.
export async function onRequestPost(context) {
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

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const hasUsername = typeof body.username === 'string';
  const hasPfp = typeof body.pfpNftId === 'string';
  if (!hasUsername && !hasPfp) {
    return new Response(JSON.stringify({ error: 'nothing_to_update' }), { status: 400 });
  }

  const patch = {};

  if (hasUsername) {
    const username = body.username.trim();
    if (!isValidUsername(username)) {
      return new Response(JSON.stringify({ error: 'invalid_username' }), { status: 400 });
    }
    if (await isUsernameTaken(env.coin, username, wallet)) {
      return new Response(JSON.stringify({ error: 'username_taken' }), { status: 409 });
    }
    patch.username = username;
  }

  if (hasPfp) {
    const pfpNftId = body.pfpNftId;
    if (!/^[0-9A-Fa-f]{64}$/.test(pfpNftId)) {
      return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
    }
    // Only ever a Pigeon this wallet actually owns right now — the same
    // real on-ledger check every other "is this really yours" branch in
    // this app uses (see swap-acceptoffer-payload.js's not_owned), not
    // just trusting whatever nftId the client sent.
    const [nfts, item] = await Promise.all([
      fetchAllAccountNfts(wallet),
      fetchDeeptideNftDetail(pfpNftId)
    ]);
    const ownsIt = findAllPigeons(nfts).some(n => n.NFTokenID === pfpNftId);
    if (!ownsIt) {
      return new Response(JSON.stringify({ error: 'not_owned' }), { status: 403 });
    }
    if (!item || !item.image) {
      return new Response(JSON.stringify({ error: 'pfp_unavailable' }), { status: 503 });
    }
    patch.pfpNftId = pfpNftId;
    patch.pfpImage = item.image;
  }

  const profile = await setProfile(env.coin, wallet, patch);

  return new Response(JSON.stringify({ ok: true, profile }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
