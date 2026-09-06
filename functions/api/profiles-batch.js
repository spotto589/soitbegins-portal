import { getProfilesMap } from '../_shared.js';

// Public, no session needed — a username/pfp is display data meant to be
// seen by everyone looking at that wallet's Pigeons, offers, sales, etc,
// same as the short address it replaces. Every place on the site that used
// to just print a wallet's short address batches its visible addresses
// into one call here (see queueProfileResolve in static.js) instead of one
// request per address.
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

  const map = await getProfilesMap(env.coin);
  const profiles = {};
  wallets.forEach(w => {
    const p = map[w];
    // bannerImage/quote/twitter are the same kind of public identity flair
    // username/pfpImage already are — meant to be seen on this wallet's
    // own PR0F!LE page (and anywhere else it's shown), not private data.
    profiles[w] = p ? {
      username: p.username || null,
      pfpImage: p.pfpImage || null,
      bannerImage: p.bannerImage || null,
      quote: p.quote || null,
      twitter: p.twitter || null
    } : null;
  });

  return new Response(JSON.stringify({ profiles }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
