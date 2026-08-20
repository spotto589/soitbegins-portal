// ipfs.io challenge-blocks image requests that carry browser Fetch Metadata
// headers (Sec-Fetch-Site: cross-site) — exactly what a hotlinked <img> on
// soitbegins.xyz sends — so every pigeon/king picture embedded directly
// from ipfs.io started coming back as a 403 challenge page instead of the
// image. This endpoint re-fetches the image server-to-server (no Fetch
// Metadata headers involved, same as a plain curl request, which ipfs.io
// still serves normally) and hands it back same-origin, so the browser
// never talks to ipfs.io directly. See proxyIpfsImage in _shared.js for the
// URL-rewriting side of this.
const IPFS_SRC_PATTERN = /^https:\/\/ipfs\.io\/ipfs\/[a-zA-Z0-9]+(\/[^?#]*)?$/;

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const src = url.searchParams.get('src');

  if (!src || !IPFS_SRC_PATTERN.test(src)) {
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

  // IPFS content is content-addressed (the CID is a hash of the content),
  // so this response can never go stale — cache it hard, same as ipfs.io's
  // own Cache-Control on these responses.
  const response = new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/octet-stream',
      'Cache-Control': 'public, max-age=29030400, immutable',
    },
  });

  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
