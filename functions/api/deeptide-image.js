// Same problem/fix as ipfs-image.js, for Deeptide's own CDN instead of
// ipfs.io: cdn.deeptide.co doesn't send Access-Control-Allow-Origin, so a
// hotlinked <img> can be displayed fine but its pixels can never be read
// via canvas (getImageData throws, tainted-canvas) — needed for sampling a
// trait's dominant colour (see colorizeTraitCells in swap.js). Re-fetching
// server-to-server and handing it back same-origin sidesteps that, same
// trick ipfs-image.js already uses.
const DEEPTIDE_CDN_SRC_PATTERN = /^https:\/\/cdn\.deeptide\.co\/[^?#]*$/;

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const src = url.searchParams.get('src');

  if (!src || !DEEPTIDE_CDN_SRC_PATTERN.test(src)) {
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

  const response = new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
