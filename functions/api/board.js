import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findAllPigeons, getBestPigeonWordLimit, getPigeonThumbnails
} from '../_shared.js';

const BOARD_KEY = 'board_messages';
const USED_PIGEONS_KEY = 'used_pigeon_nfts';
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

  const usedRaw = await env.coin.get(USED_PIGEONS_KEY);
  const usedList = usedRaw ? JSON.parse(usedRaw) : [];
  if (usedList.includes(requestedNftId)) {
    return new Response(JSON.stringify({ error: 'pigeon_already_posted' }), { status: 403 });
  }

  const raw = await env.coin.get(BOARD_KEY);
  const messages = raw ? JSON.parse(raw) : [];
  messages.push({ text, name, image: match.image, acct: payload.acct, pigeonCount: pigeons.length, ts: Math.floor(Date.now() / 1000) });
  const trimmed = messages.slice(-MAX_STORED);
  await env.coin.put(BOARD_KEY, JSON.stringify(trimmed));

  usedList.push(requestedNftId);
  await env.coin.put(USED_PIGEONS_KEY, JSON.stringify(usedList));

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
