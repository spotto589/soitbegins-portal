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

// Defense-in-depth against the exact failure class chased down live this
// session: a broker-submit attempt against a rate-limited XRPL endpoint
// came back as a bare Cloudflare 502 in under a second, with NOTHING
// logged here at all — consistent with something inside xrpl.js/ws
// throwing (or emitting an unlistened 'error' event) outside any of this
// file's own try/catch, which Node's default behavior is to crash the
// entire process for. A single hard crash mid-request would explain both
// symptoms at once: the malformed response Cloudflare saw, and the total
// silence in these logs (nothing flushes before the process dies). These
// handlers don't fix the underlying library issue, but they stop it from
// taking the whole server down silently — the request that triggered it
// still fails, but every OTHER in-flight request, and the server itself,
// survives, and this leaves a real trace here to look at afterward.
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION (server kept running):', err && err.stack || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION (server kept running):', reason && reason.stack || reason);
});

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
// Endpoint diversity, same reasoning _shared.js's own fetchXrplClusterJson
// already uses for REST reads (xrplcluster.com, then Ripple's own public
// nodes) — confirmed live this session: xrplcluster.com was rate-limiting
// this exact account hard on the REST side, and a real broker-submit
// attempt against a single hard-coded wss://xrplcluster.com consistently
// came back as a bare Cloudflare 502 (connection-level failure, not a
// clean XRPL error) within under a second — consistent with the same
// rate-limiting rejecting the WebSocket connection outright. A single
// endpoint with no fallback had nowhere to go when that happens.
const XRPL_WS_ENDPOINTS = process.env.XRPL_WS_ENDPOINT
  ? [process.env.XRPL_WS_ENDPOINT]
  : ['wss://xrplcluster.com', 'wss://s1.ripple.com', 'wss://s2.ripple.com'];
// Allowlist of what this proxy will ever sign as the broker — deliberately
// narrow (not "sign anything you send me") since a bug or compromise on
// the caller side shouldn't be able to turn this into an arbitrary
// signing oracle for a wallet that holds real funds.
const BROKER_ALLOWED_TX_TYPES = new Set(['NFTokenAcceptOffer', 'Payment']);

// Per-endpoint timeout — with up to 3 endpoints to try, this has to stay
// comfortably under the 25s Cloudflare itself allows for the whole call
// (see BROKER_SUBMIT_TIMEOUT_MS in _shared.js).
const BROKER_XRPL_TIMEOUT_MS = 6000;

async function submitAsBrokerOnce(endpoint, txjson) {
  const client = new xrpl.Client(endpoint, { connectionTimeout: 4000 });
  const work = (async () => {
    await client.connect();
    const wallet = xrpl.Wallet.fromSeed(BROKER_WALLET_SEED);
    const prepared = await client.autofill({ ...txjson, Account: wallet.address });
    const signed = wallet.sign(prepared);
    // submit(), not submitAndWait() — confirmed live this session:
    // submitAndWait() blocks for several real seconds waiting for ledger
    // validation (XRPL closes a ledger roughly every 3-5s, and this polls
    // until the tx shows up validated), and whatever's fronting this
    // Render service returns its own bare 502 well before that finishes —
    // consistently around 7s, with no x-render-origin-server header on
    // the 502 at all, meaning Cloudflare's own edge gives up on this
    // connection before Render's own layer is even involved. submit()
    // returns as soon as the node's own engine provisionally accepts (or
    // rejects) the transaction — one round trip, no waiting on a ledger
    // close — which is exactly what a broker-fee NFTokenAcceptOffer needs
    // here: the callers of this endpoint (swap-buy-status.js/
    // swap-acceptoffer-status.js) already independently re-verify the
    // real on-chain outcome (NFT ownership, offer gone) on their own
    // subsequent polls before ever telling the user it's settled, so
    // nothing downstream was actually relying on this call itself having
    // waited for full validation.
    const response = await client.submit(signed.tx_blob);
    const engineResult = response && response.result && response.result.engine_result;
    return {
      ok: typeof engineResult === 'string' && engineResult.startsWith('tes'),
      hash: signed.hash,
      engineResult: engineResult || null,
      engineResultMessage: (response && response.result && response.result.engine_result_message) || null,
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

async function submitAsBroker(txjson) {
  if (!BROKER_WALLET_SEED) {
    return { ok: false, error: 'broker_wallet_not_configured' };
  }
  if (!txjson || typeof txjson !== 'object' || !BROKER_ALLOWED_TX_TYPES.has(txjson.TransactionType)) {
    return { ok: false, error: 'transaction_type_not_allowed' };
  }
  let last = { ok: false, error: 'submit_failed' };
  for (const endpoint of XRPL_WS_ENDPOINTS) {
    const result = await submitAsBrokerOnce(endpoint, txjson);
    // A real 'engineResult' (even a non-success one like a tec/tem code)
    // means this endpoint genuinely reached the ledger and got a real
    // answer — that answer is authoritative, stop here. Only a
    // connection-level failure (never got that far) tries the next
    // endpoint; resubmitting the exact same signed blob afterward is safe
    // regardless — XRPL dedupes an already-applied transaction by hash,
    // so a lost-response-after-real-success case can't double-execute.
    if ('engineResult' in result) return result;
    last = result;
  }
  return last;
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
