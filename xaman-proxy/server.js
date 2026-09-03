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
const xrpl = require('xrpl');

const PORT = process.env.PORT || 3000;
const XAMAN_API_KEY = process.env.XAMAN_API_KEY;
const XAMAN_API_SECRET = process.env.XAMAN_API_SECRET;
const PROXY_SHARED_SECRET = process.env.PROXY_SHARED_SECRET;
const XUMM_BASE = 'https://xumm.app/api/v1/platform/payload';
const FETCH_TIMEOUT_MS = 15000;

// Broker/marketplace wallet — the ONLY place this seed is ever held. Used
// to sign+submit transactions where the marketplace itself is a party
// (the brokered NFTokenAcceptOffer leg of a Pigeon sale, and the $CRWN
// reward Payments sent afterward), never for anything a user's own Xaman
// wallet should sign instead. If this is unset, /broker-submit simply
// refuses to do anything — the rest of the proxy (Xaman payloads) keeps
// working regardless.
const BROKER_WALLET_SEED = process.env.BROKER_WALLET_SEED;
const XRPL_WS_ENDPOINT = process.env.XRPL_WS_ENDPOINT || 'wss://xrplcluster.com';
// Allowlist of what this proxy will ever sign as the broker — deliberately
// narrow (not "sign anything you send me") since a bug or compromise on
// the caller side shouldn't be able to turn this into an arbitrary
// signing oracle for a wallet that holds real funds.
const BROKER_ALLOWED_TX_TYPES = new Set(['NFTokenAcceptOffer', 'Payment']);

// Confirmed live: xrplcluster.com rate-limiting this same account hard on
// the REST side (Cloudflare's own reads) during a real failed settlement —
// very likely also stalling this WS connection at the same time, and
// nothing below had a timeout of its own to catch that. A hung connect()/
// submitAndWait() left this function never resolving, so the app never got
// to write ANY response — eventually Render's own platform killed the
// connection and substituted its own generic error page (HTML, not JSON),
// which is exactly what reached Cloudflare as "proxy_non_json_response".
// This timeout guarantees a real, clean JSON response either way, well
// inside the 25s Cloudflare itself allows for this whole call (see
// BROKER_SUBMIT_TIMEOUT_MS in _shared.js) — a timeout here becomes a
// normal, retryable 'failed' result instead of a silent platform-level
// non-response.
const BROKER_XRPL_TIMEOUT_MS = 18000;

async function submitAsBroker(txjson) {
  if (!BROKER_WALLET_SEED) {
    return { ok: false, error: 'broker_wallet_not_configured' };
  }
  if (!txjson || typeof txjson !== 'object' || !BROKER_ALLOWED_TX_TYPES.has(txjson.TransactionType)) {
    return { ok: false, error: 'transaction_type_not_allowed' };
  }
  const client = new xrpl.Client(XRPL_WS_ENDPOINT, { connectionTimeout: 8000 });
  const work = (async () => {
    await client.connect();
    const wallet = xrpl.Wallet.fromSeed(BROKER_WALLET_SEED);
    const prepared = await client.autofill({ ...txjson, Account: wallet.address });
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    const meta = result && result.result && result.result.meta;
    const engineResult = meta && meta.TransactionResult;
    return {
      ok: engineResult === 'tesSUCCESS',
      hash: signed.hash,
      engineResult: engineResult || null,
      meta: meta || null,
      brokerAddress: wallet.address
    };
  })().catch(e => ({ ok: false, error: (e && e.message) || 'submit_failed' }));
  const timeout = new Promise(resolve => {
    setTimeout(() => resolve({ ok: false, error: 'xrpl_submit_timeout' }), BROKER_XRPL_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    // Fire-and-forget regardless of which side of the race won — if the
    // timeout fired first, `work` may still be running in the background;
    // this doesn't need to (and must not) block the response either way.
    client.disconnect().catch(() => {});
  }
}

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

    // Broker/marketplace self-signed submission — used for the brokered
    // NFTokenAcceptOffer leg of a Pigeon sale and for the $CRWN reward
    // Payments sent afterward. Never touches Xaman at all (this wallet
    // signs for itself); same X-Proxy-Secret auth as everything else here.
    if (req.method === 'POST' && req.url === '/broker-submit') {
      const bodyText = await readBody(req);
      let body;
      try { body = JSON.parse(bodyText); } catch (e) { return send(res, 400, { error: 'bad_request' }); }
      const result = await submitAsBroker(body && body.txjson);
      return send(res, result.ok ? 200 : 502, result);
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
