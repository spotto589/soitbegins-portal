import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findAllPigeons, getBestPigeonWordLimit, getPigeonThumbnails,
  getCachedCrownHolder, isCrownWallet
} from '../_shared.js';

const MAX_LEN = 1500;
const MAX_NAME_LEN = 15;

function countWords(str) {
  const trimmed = str.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

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

  const nfts = await fetchAllAccountNfts(payload.acct);
  const pigeons = findAllPigeons(nfts);
  if (!pigeons.length) {
    return new Response(JSON.stringify({ error: 'no_pigeon' }), { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const text = (body && body.text || '').trim().slice(0, MAX_LEN);
  if (!text) {
    return new Response(JSON.stringify({ error: 'empty_message' }), { status: 400 });
  }

  const wordLimit = await getBestPigeonWordLimit(env.coin, pigeons);
  if (countWords(text) > wordLimit) {
    return new Response(JSON.stringify({ error: 'over_word_limit', wordLimit }), { status: 400 });
  }

  const name = (body && body.name || '').trim().slice(0, MAX_NAME_LEN);

  // Alpha board rule: each Pigeon NFT may post exactly once. Only allow
  // attaching a Pigeon this wallet actually holds — never trust the
  // client's claimed nftId or image URL directly — and reject if that
  // specific token has already been used to post.
  const requestedNftId = body && body.nftId;
  if (!requestedNftId) {
    return new Response(JSON.stringify({ error: 'pigeon_required' }), { status: 400 });
  }

  const thumbs = await getPigeonThumbnails(env.coin, pigeons);
  const match = thumbs.find(t => t.nftId === requestedNftId);
  if (!match) {
    return new Response(JSON.stringify({ error: 'invalid_pigeon' }), { status: 400 });
  }

  // Each Pigeon's post lives at its own KV key, keyed by nftId — never a
  // shared list. A shared list needs read-modify-write, and KV is only
  // eventually consistent, so a concurrent write for a totally different
  // pigeon could silently clobber the whole list: either erasing a used-
  // pigeon mark (letting it post twice) or dropping someone else's already-
  // posted message entirely. Independent per-token keys make that
  // impossible — one pigeon's write can never touch another's.
  const postKey = `pigeonpost:${requestedNftId}`;
  const alreadyPosted = await env.coin.get(postKey);
  if (alreadyPosted) {
    return new Response(JSON.stringify({ error: 'pigeon_already_posted' }), { status: 403 });
  }

  const nowTs = Math.floor(Date.now() / 1000);
  // Snapshot RANK AT SIGNING permanently, right now, from whatever the
  // Crown cache currently says (a live full-collection scan is far too
  // slow to run inline on a post — see _shared.js). This value is written
  // once and must never be recomputed later: the whole point is that a
  // signature keeps saying CROWN even after the Crown moves to someone
  // else. CURRENT Crown status (dynamic, shown on the Access Gate) is a
  // completely separate read, done fresh in board.js on every page view.
  const crownSnapshot = await getCachedCrownHolder(env.coin);
  const rank = isCrownWallet(crownSnapshot, payload.acct) ? 'CROWN' : 'STANDARD';
  await env.coin.put(postKey, JSON.stringify({
    text, name, image: match.image, nftId: requestedNftId, acct: payload.acct, pigeonCount: pigeons.length, ts: nowTs, rank
  }));

  // Keystone: the moment this wallet's last available Pigeon gets used.
  // Only set once — checks every other held Pigeon's used-state fresh
  // rather than trusting anything cached from before this request.
  const otherThumbs = thumbs.filter(t => t.nftId !== requestedNftId);
  const otherUsedChecks = await Promise.all(
    otherThumbs.map(t => env.coin.get(`pigeonpost:${t.nftId}`))
  );
  const allNowUsed = otherUsedChecks.every(v => v !== null);
  if (allNowUsed) {
    const keystoneKey = `keystone:${payload.acct}`;
    const existingKeystone = await env.coin.get(keystoneKey);
    if (!existingKeystone) {
      await env.coin.put(keystoneKey, String(nowTs));
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
