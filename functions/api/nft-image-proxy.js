// PR0F!LE's own banner colour-match (see profileBanner's own comment in
// static.js) needs to read real pixel data off a wallet's chosen Pigeon
// image via <canvas> — browsers taint (block reading from) a canvas drawn
// from a cross-origin image unless that image's own server sends CORS
// headers permitting it, which Deeptide's CDN doesn't. Re-fetching the
// image server-to-server and handing it back same-origin (same trick
// ipfs-image.js already uses for a different problem — see its own
// comment) sidesteps that entirely: the browser only ever draws a
// same-origin image onto the canvas, which is never tainted regardless of
// the original host's own CORS policy.
//
// Restricted to a real allowlist of image hosts this app actually uses
// (not a general-purpose proxy/SSRF vector) — every `imageUrl` field
// Deeptide's API returns is one of these.
const ALLOWED_HOSTS = new Set(['cdn.deeptide.co', 'ipfs.io']);

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const src = url.searchParams.get('src');
  if (!src) return new Response('Bad request', { status: 400 });

  let parsed;
  try {
    parsed = new URL(src);
  } catch (e) {
    return new Response('Bad request', { status: 400 });
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return new Response('Bad request', { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const upstream = await fetch(src, { headers: { Accept: 'image/*' } });
  if (!upstream.ok) {
    return new Response('Image unavailable', { status: 502 });
  }

  // Same real content-addressed-ish reasoning as ipfs-image.js — a given
  // NFT's own image URL doesn't change under this app's feet, so this can
  // cache hard rather than re-checking upstream every time.
  const response = new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=604800',
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
