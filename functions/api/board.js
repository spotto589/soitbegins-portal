import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findAllPigeons, getBestPigeonWordLimit, getPigeonThumbnails
} from '../_shared.js';

const BOARD_KEY = 'board_messages';
const MAX_STORED = 200;
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

  // Each Pigeon gets its own KV key rather than one shared list — a shared
  // list requires read-modify-write, and KV is only eventually consistent,
  // so a concurrent write for a totally different pigeon could silently
  // clobber the list and un-mark ones that had already posted. Independent
  // per-token keys avoid that failure mode entirely.
  const usedKey = `usedpigeon:${requestedNftId}`;
  const alreadyUsed = await env.coin.get(usedKey);
  if (alreadyUsed) {
    return new Response(JSON.stringify({ error: 'pigeon_already_posted' }), { status: 403 });
  }

  const raw = await env.coin.get(BOARD_KEY);
  const messages = raw ? JSON.parse(raw) : [];
  messages.push({ text, name, image: match.image, nftId: requestedNftId, acct: payload.acct, pigeonCount: pigeons.length, ts: Math.floor(Date.now() / 1000) });
  const trimmed = messages.slice(-MAX_STORED);
  await env.coin.put(BOARD_KEY, JSON.stringify(trimmed));

  const nowTs = Math.floor(Date.now() / 1000);
  await env.coin.put(usedKey, String(nowTs));

  // Keystone: the moment this wallet's last available Pigeon gets used.
  // Only set once — checks every other held Pigeon's used-state fresh
  // rather than trusting anything cached from before this request.
  const otherThumbs = thumbs.filter(t => t.nftId !== requestedNftId);
  const otherUsedChecks = await Promise.all(
    otherThumbs.map(t => env.coin.get(`usedpigeon:${t.nftId}`))
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
