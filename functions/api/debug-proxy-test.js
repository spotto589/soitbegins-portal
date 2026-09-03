// TEMPORARY diagnostic endpoint — not linked from any UI, safe to hit
// directly. Makes the exact same call submitAsBroker() makes (same URL,
// same header, same body shape) but reports the raw response back instead
// of assuming it's JSON, so we can see exactly what's coming back instead
// of guessing from a parse failure alone. Delete once the real issue is found.
export async function onRequestGet(context) {
  const { env } = context;
  const out = { xamanProxyUrlConfigured: !!env.XAMAN_PROXY_URL, xamanProxySecretConfigured: !!env.XAMAN_PROXY_SHARED_SECRET };
  try {
    const res = await fetch(env.XAMAN_PROXY_URL + '/broker-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Proxy-Secret': env.XAMAN_PROXY_SHARED_SECRET },
      body: JSON.stringify({ txjson: { TransactionType: 'Payment' } })
    });
    out.status = res.status;
    out.statusText = res.statusText;
    out.headers = Object.fromEntries(res.headers.entries());
    const text = await res.text();
    out.bodyLength = text.length;
    out.bodyPreview = text.slice(0, 500);
    try { out.parsedJson = JSON.parse(text); } catch (e) { out.jsonParseError = e.message; }
  } catch (e) {
    out.fetchThrew = true;
    out.fetchError = (e && e.message) || String(e);
    out.fetchErrorName = e && e.name;
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json' } });
}
