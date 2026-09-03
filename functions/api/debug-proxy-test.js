// TEMPORARY diagnostic endpoint — not linked from any UI, safe to hit
// directly. Makes the exact same call submitAsBroker() makes (same URL,
// same header, same body shape) but reports the raw response back instead
// of assuming it's JSON, so we can see exactly what's coming back instead
// of guessing from a parse failure alone. Delete once the real issue is found.
async function tryFetch(url, init) {
  const started = Date.now();
  const result = { url, init: { method: (init && init.method) || 'GET', hasBody: !!(init && init.body) } };
  try {
    const res = await fetch(url, init);
    result.ms = Date.now() - started;
    result.status = res.status;
    result.statusText = res.statusText;
    result.headers = Object.fromEntries(res.headers.entries());
    const text = await res.text();
    result.bodyLength = text.length;
    result.bodyPreview = text.slice(0, 300);
  } catch (e) {
    result.ms = Date.now() - started;
    result.fetchThrew = true;
    result.fetchError = (e && e.message) || String(e);
    result.fetchErrorName = e && e.name;
  }
  return result;
}

export async function onRequestGet(context) {
  const { env } = context;
  const base = env.XAMAN_PROXY_URL;
  const out = {
    xamanProxyUrlConfigured: !!base,
    xamanProxySecretConfigured: !!env.XAMAN_PROXY_SHARED_SECRET,
    plainGetRoot: await tryFetch(base + '/'),
    postBrokerSubmitInvalidType: await tryFetch(base + '/broker-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Proxy-Secret': env.XAMAN_PROXY_SHARED_SECRET },
      body: JSON.stringify({ txjson: { TransactionType: 'NOT_A_REAL_TYPE' } })
    }),
    postBrokerSubmit: await tryFetch(base + '/broker-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Proxy-Secret': env.XAMAN_PROXY_SHARED_SECRET },
      body: JSON.stringify({ txjson: { TransactionType: 'Payment' } })
    }),
    postPayloadNoAuth: await tryFetch(base + '/payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
  };
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json' } });
}
