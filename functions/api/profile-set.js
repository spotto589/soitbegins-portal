import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNftsChecked, findAllPigeons,
  fetchDeeptideNftDetail, isValidUsername, isUsernameTaken, setProfile,
  isValidQuote, normalizeTwitterHandle, isValidTwitterHandle
} from '../_shared.js';

// Lets a wallet set its own display name, profile picture, banner, quote,
// and/or Twitter handle (banner/pfp are each one of its own Pigeons — see
// PR0F!LE's own "customize your identity" pitch). Any subset of fields can
// be sent alone — setProfile merges into whatever's already stored rather
// than requiring all of them every time.
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
  const hasBanner = typeof body.bannerNftId === 'string';
  const hasQuote = typeof body.quote === 'string';
  const hasTwitter = typeof body.twitter === 'string';
  if (!hasUsername && !hasPfp && !hasBanner && !hasQuote && !hasTwitter) {
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

  if (hasQuote) {
    const quote = body.quote.trim();
    if (!isValidQuote(quote)) {
      return new Response(JSON.stringify({ error: 'invalid_quote' }), { status: 400 });
    }
    patch.quote = quote;
  }

  if (hasTwitter) {
    const twitter = normalizeTwitterHandle(body.twitter);
    if (!isValidTwitterHandle(twitter)) {
      return new Response(JSON.stringify({ error: 'invalid_twitter' }), { status: 400 });
    }
    patch.twitter = twitter;
  }

  // pfp/banner share the exact same "must be a Pigeon this wallet actually
  // owns right now" real on-ledger check — fetched together (one
  // fetchAllAccountNftsChecked call covers both) rather than twice when a
  // save touches both fields at once.
  if (hasPfp || hasBanner) {
    const pfpNftId = hasPfp ? body.pfpNftId : null;
    const bannerNftId = hasBanner ? body.bannerNftId : null;
    if ((pfpNftId !== null && !/^[0-9A-Fa-f]{64}$/.test(pfpNftId)) ||
        (bannerNftId !== null && !/^[0-9A-Fa-f]{64}$/.test(bannerNftId))) {
      return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
    }
    // Checked, not the plain fetchAllAccountNfts — a failed/rate-limited
    // XRPL scan returns the same empty-ish array a genuinely-empty wallet
    // would, which would otherwise report a false not_owned for a Pigeon
    // this wallet actually holds (same fix already applied to every real
    // trade endpoint — see swap-listing-payload.js's own comment).
    const { nfts, ok: nftsOk } = await fetchAllAccountNftsChecked(wallet);
    if (!nftsOk) {
      return new Response(JSON.stringify({ error: 'lookup_failed' }), { status: 502 });
    }
    const owned = findAllPigeons(nfts);
    if (pfpNftId !== null) {
      if (!owned.some(n => n.NFTokenID === pfpNftId)) {
        return new Response(JSON.stringify({ error: 'not_owned' }), { status: 403 });
      }
      const item = await fetchDeeptideNftDetail(pfpNftId);
      if (!item || !item.image) {
        return new Response(JSON.stringify({ error: 'pfp_unavailable' }), { status: 503 });
      }
      patch.pfpNftId = pfpNftId;
      patch.pfpImage = item.image;
    }
    if (bannerNftId !== null) {
      if (!owned.some(n => n.NFTokenID === bannerNftId)) {
        return new Response(JSON.stringify({ error: 'not_owned' }), { status: 403 });
      }
      const item = await fetchDeeptideNftDetail(bannerNftId);
      if (!item || !item.image) {
        return new Response(JSON.stringify({ error: 'pfp_unavailable' }), { status: 503 });
      }
      patch.bannerNftId = bannerNftId;
      patch.bannerImage = item.image;
    }
  }

  const profile = await setProfile(env.coin, wallet, patch);

  return new Response(JSON.stringify({ ok: true, profile }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
