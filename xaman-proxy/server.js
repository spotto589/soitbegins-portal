// Thin proxy for the Xaman (xumm.app) platform-payload API.
//
// Why this exists: xumm.app appears to silently drop/block requests that
// originate from inside Cloudflare's own network (Cloudflare Pages
// Functions calling a Cloudflare-fronted API) - confirmed via Xaman's own
// request logs showing those attempts never arriving, while identical
// requests from a normal connection succeed. This proxy just re-homes the
// one outbound call to xumm.app onto a non-Cloudflare network so it stops
// getting caught by whatever is blocking it.
//
// The real XAMAN_API_KEY/XAMAN_API_SECRET live ONLY here, never sent by
// the caller - the caller (the Cloudflare Worker) authenticates with a
// separate shared secret instead, so this endpoint can't be used by
// anyone else to create arbitrary sign requests on your app's behalf.

const http = require('http');

const PORT = process.env.PORT || 3000;
const XAMAN_API_KEY = process.env.XAMAN_API_KEY;
const XAMAN_API_SECRET = process.env.XAMAN_API_SECRET;
const PROXY_SHARED_SECRET = process.env.PROXY_SHARED_SECRET;
const XUMM_BASE = 'https://xumm.app/api/v1/platform/payload';
const FETCH_TIMEOUT_MS = 15000;

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

async function xummFetch(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const bodyText = await res.text();
    let json;
    try { json = JSON.parse(bodyText); } catch (e) { json = null; }
    return { status: res.status, ok: res.ok, json };
  } finally {
    clearTimeout(timer);
  }
}

function checkAuth(req) {
  if (!PROXY_SHARED_SECRET) return false;
  return req.headers['x-proxy-secret'] === PROXY_SHARED_SECRET;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/') {
      return send(res, 200, { ok: true });
    }

    if (!XAMAN_API_KEY || !XAMAN_API_SECRET || !PROXY_SHARED_SECRET) {
      return send(res, 500, { error: 'proxy_misconfigured' });
    }
    if (!checkAuth(req)) {
      return send(res, 401, { error: 'unauthorized' });
    }

    const xummHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': XAMAN_API_KEY,
      'X-API-Secret': XAMAN_API_SECRET
    };

    if (req.method === 'POST' && req.url === '/payload') {
      const bodyText = await readBody(req);
      const result = await xummFetch(XUMM_BASE, { method: 'POST', headers: xummHeaders, body: bodyText });
      return send(res, result.status, result.json === null ? { error: 'upstream_non_json', status: result.status } : result.json);
    }

    const statusMatch = req.method === 'GET' && req.url.match(/^\/payload\/([0-9a-fA-F-]{10,60})$/);
    if (statusMatch) {
      const uuid = statusMatch[1];
      const result = await xummFetch(XUMM_BASE + '/' + uuid, { method: 'GET', headers: xummHeaders });
      return send(res, result.status, result.json === null ? { error: 'upstream_non_json', status: result.status } : result.json);
    }

    return send(res, 404, { error: 'not_found' });
  } catch (e) {
    console.error('proxy error', e && e.message);
    return send(res, 502, { error: 'proxy_fetch_failed', message: e && e.message });
  }
});

server.listen(PORT, () => {
  console.log('xaman-proxy listening on port', PORT);
});
