// ipfs.io challenge-blocks image requests that carry browser Fetch Metadata
// headers (Sec-Fetch-Site: cross-site) — exactly what a hotlinked <img> on
// soitbegins.xyz sends — so every pigeon/king picture embedded directly
// from ipfs.io started coming back as a 403 challenge page instead of the
// image. This endpoint re-fetches the image server-to-server and hands it
// back same-origin, so the browser never talks to an IPFS gateway directly.
// See proxyIpfsImage in _shared.js for the URL-rewriting side of this.
//
// `src` is still the canonical https://ipfs.io/ipfs/<cid>[/path] URL (that's
// what resolveIpfsUri produces and what's stored in KV), but since
// 2026-09-23 ipfs.io 429s all server requests too, so the actual fetch goes
// through fetchIpfs's gateway fallback list (filebase, then pinata).
import { fetchIpfs, ipfsPathOf } from '../_shared.js';

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const src = url.searchParams.get('src');

  if (!src || !ipfsPathOf(src)) {
    return new Response('Bad request', { status: 400 });
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), request);
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let upstream;
  try {
    upstream = await fetchIpfs(src, { headers: { Accept: 'image/*' } });
  } catch (e) {
    upstream = null;
  }
  if (!upstream || !upstream.ok) {
    return new Response('Image unavailable', { status: 502 });
  }

  // IPFS content is content-addressed (the CID is a hash of the content),
  // so this response can never go stale — cache it hard.
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
