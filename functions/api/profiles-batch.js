import { BOARD_COOKIE_NAME, getCookie, verifyToken, getProfilesMap } from '../_shared.js';

// Public, no session REQUIRED — a username/pfp is display data meant to be
// seen by everyone looking at that wallet's Pigeons, offers, sales, etc,
// same as the short address it replaces. Every place on the site that used
// to just print a wallet's short address batches its visible addresses
// into one call here (see queueProfileResolve in static.js) instead of one
// request per address. A session cookie IS read when present, purely to
// let a wallet see its OWN full profile (pfpNftId/bannerNftId/isPublic/
// featuredNfts — the raw selection state PR0F!LE's own edit modal needs to
// highlight what's currently picked, not just the display-ready fields
// every other viewer gets) even while isPublic:false — loadProfilePanel
// reads its own profile through this exact endpoint, so without this a
// wallet that had gone private would lose the ability to see/edit its own
// settings.
const MAX_WALLETS = 80;

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const wallets = Array.isArray(body.wallets) ? body.wallets.filter(w => typeof w === 'string').slice(0, MAX_WALLETS) : [];
  if (!wallets.length) {
    return new Response(JSON.stringify({ profiles: {} }), { headers: { 'Content-Type': 'application/json' } });
  }

  let myWallet = null;
  if (env.Σκύλλα) {
    const token = getCookie(request, BOARD_COOKIE_NAME);
    if (token) {
      const payload = await verifyToken(token, env.Σκύλλα);
      if (payload && payload.acct) myWallet = payload.acct;
    }
  }

  const map = await getProfilesMap(env.coin);
  const profiles = {};
  wallets.forEach(w => {
    const p = map[w];
    const isSelf = myWallet !== null && w === myWallet;
    // isPublic:false (PR!VATE PR0F!LE, see openWalletProfile's own gating)
    // means nothing chosen-identity here gets surfaced to anyone ELSE —
    // enforced here, not just hidden client-side, since this endpoint is
    // the actual source every other wallet's view of this one reads from.
    // The owner's own request (isSelf) always sees everything regardless.
    if (p && p.isPublic === false && !isSelf) {
      profiles[w] = { isPublic: false };
      return;
    }
    // bannerImage/quote/twitter are the same kind of public identity flair
    // username/pfpImage already are — meant to be seen on this wallet's
    // own PR0F!LE page (and anywhere else it's shown), not private data.
    // pfpNftId/bannerNftId/featuredNfts/isPublic ride along too now (not
    // sensitive — same "which NFT" info the *Image fields already reveal,
    // just the raw id instead of a resolved picture) so the edit modal can
    // highlight current selections without a second request.
    profiles[w] = p ? {
      username: p.username || null,
      pfpImage: p.pfpImage || null,
      pfpNftId: p.pfpNftId || null,
      bannerImage: p.bannerImage || null,
      bannerNftId: p.bannerNftId || null,
      quote: p.quote || null,
      twitter: p.twitter || null,
      theme: p.theme || null,
      nodeCode: p.nodeCode || null,
      equippedTitle: p.equippedTitle || null,
      featuredNfts: p.featuredNfts || [],
      isPublic: p.isPublic !== false
    } : null;
  });

  return new Response(JSON.stringify({ profiles }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
