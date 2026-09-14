import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchAllAccountNftsChecked,
  fetchDeeptideNftDetail, isValidUsername, isUsernameTaken, setProfile,
  isValidQuote, normalizeTwitterHandle, isValidTwitterHandle,
  isValidProfileTheme, isValidFeaturedList, FEATURED_NFTS_MAX
} from '../_shared.js';

// Lets a wallet set its own display name, profile picture, banner, quote,
// Twitter handle, THEME, SH0WCASE featured NFTs, and public/private
// visibility (banner/pfp/featured can now be ANY currently-owned NFT, any
// collection — was Pigeons-only, widened per the PR0F!LE Phase 1 pass; see
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
  const hasTheme = typeof body.theme === 'string';
  const hasFeatured = Array.isArray(body.featuredNftIds);
  const hasIsPublic = typeof body.isPublic === 'boolean';
  if (!hasUsername && !hasPfp && !hasBanner && !hasQuote && !hasTwitter && !hasTheme && !hasFeatured && !hasIsPublic) {
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

  if (hasTheme) {
    if (!isValidProfileTheme(body.theme)) {
      return new Response(JSON.stringify({ error: 'invalid_theme' }), { status: 400 });
    }
    patch.theme = body.theme;
  }

  if (hasIsPublic) {
    patch.isPublic = body.isPublic;
  }

  if (hasFeatured && !isValidFeaturedList(body.featuredNftIds)) {
    return new Response(JSON.stringify({ error: 'invalid_featured' }), { status: 400 });
  }

  // pfp/banner/featured all share the exact same "must be an NFT this
  // wallet actually owns right now" real on-ledger check — fetched once
  // (one fetchAllAccountNftsChecked call) rather than per-field when a save
  // touches more than one at a time. Widened from Pigeons-only
  // (findAllPigeons) to ANY collection — reported live wanting avatar/
  // banner/featured to work off "an NFT you currently own," not just a
  // Pigeon specifically. fetchAllAccountNftsChecked already returns every
  // NFT this wallet holds across every collection in one XRPL scan, so
  // this is just checking straight against that full list instead of a
  // Pigeons-narrowed subset of it.
  if (hasPfp || hasBanner || hasFeatured) {
    const pfpNftId = hasPfp ? body.pfpNftId : null;
    const bannerNftId = hasBanner ? body.bannerNftId : null;
    const featuredIds = hasFeatured ? body.featuredNftIds : null;
    if ((pfpNftId !== null && !/^[0-9A-Fa-f]{64}$/.test(pfpNftId)) ||
        (bannerNftId !== null && !/^[0-9A-Fa-f]{64}$/.test(bannerNftId))) {
      return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
    }
    // Checked, not the plain fetchAllAccountNfts — a failed/rate-limited
    // XRPL scan returns the same empty-ish array a genuinely-empty wallet
    // would, which would otherwise report a false not_owned for an NFT
    // this wallet actually holds (same fix already applied to every real
    // trade endpoint — see swap-listing-payload.js's own comment).
    const { nfts, ok: nftsOk } = await fetchAllAccountNftsChecked(wallet);
    if (!nftsOk) {
      return new Response(JSON.stringify({ error: 'lookup_failed' }), { status: 502 });
    }
    const ownedIds = new Set(nfts.map(n => n.NFTokenID));
    if (pfpNftId !== null) {
      if (!ownedIds.has(pfpNftId)) {
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
      if (!ownedIds.has(bannerNftId)) {
        return new Response(JSON.stringify({ error: 'not_owned' }), { status: 403 });
      }
      const item = await fetchDeeptideNftDetail(bannerNftId);
      if (!item || !item.image) {
        return new Response(JSON.stringify({ error: 'pfp_unavailable' }), { status: 503 });
      }
      patch.bannerNftId = bannerNftId;
      patch.bannerImage = item.image;
    }
    if (featuredIds !== null) {
      if (!featuredIds.every(id => ownedIds.has(id))) {
        return new Response(JSON.stringify({ error: 'not_owned' }), { status: 403 });
      }
      // Resolved to real images once here (same as pfp/banner) rather than
      // re-fetched from Deeptide every time SH0WCASE M0DE renders — at
      // most FEATURED_NFTS_MAX (6) detail calls, only on save.
      const resolved = await Promise.all(featuredIds.map(async id => {
        const item = await fetchDeeptideNftDetail(id);
        return item && item.image ? { nftId: id, image: item.image, number: item.number != null ? item.number : null } : null;
      }));
      if (resolved.some(r => !r)) {
        return new Response(JSON.stringify({ error: 'pfp_unavailable' }), { status: 503 });
      }
      patch.featuredNfts = resolved;
    }
  }

  const profile = await setProfile(env.coin, wallet, patch);

  return new Response(JSON.stringify({ ok: true, profile }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
