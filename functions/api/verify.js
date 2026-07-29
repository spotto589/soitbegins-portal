const GLITCH_ISSUER = 'rNRo76r8C6c1rMi28AR7CdArtK6r8Zptv7';
const GLITCH_TAXON = 1;
const SKYLLA_ISSUER = 'raNypRjrVu98Rp3AYLRhQBDUeJKyyRRV92';
const SKYLLA_TAXON = 777;
const COOKIE_NAME = 'glitch_access';
const TOKEN_TTL_SECONDS = 60 * 30;

async function fetchAllAccountNfts(account) {
  let all = [];
  let marker;
  do {
    const params = { account, limit: 400 };
    if (marker) params.marker = marker;
    const res = await fetch('https://xrplcluster.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'account_nfts', params: [params] })
    });
    const data = await res.json();
    const nfts = (data.result && data.result.account_nfts) || [];
    all = all.concat(nfts);
    marker = data.result && data.result.marker;
  } while (marker);
  return all;
}

function hasGlitchAccess(nfts) {
  return nfts.some(n =>
    (n.Issuer === GLITCH_ISSUER && n.NFTokenTaxon === GLITCH_TAXON) ||
    (n.Issuer === SKYLLA_ISSUER && n.NFTokenTaxon === SKYLLA_TAXON)
  );
}

function toBase64Url(bytes) {
  let str = '';
  bytes.forEach(b => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signToken(payloadObj, secret) {
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(payloadObj)));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return payload + '.' + toBase64Url(new Uint8Array(sig));
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  const jwt = body && body.jwt;
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'missing_jwt' }), { status: 400 });
  }

  const userinfoRes = await fetch('https://oauth2.xumm.app/userinfo', {
    headers: { Authorization: 'Bearer ' + jwt }
  });
  if (!userinfoRes.ok) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401 });
  }
  const userinfo = await userinfoRes.json();
  const account = userinfo && userinfo.account;
  if (!account) {
    return new Response(JSON.stringify({ error: 'no_account' }), { status: 401 });
  }

  const nfts = await fetchAllAccountNfts(account);
  if (!hasGlitchAccess(nfts)) {
    return new Response(JSON.stringify({ granted: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = await signToken({ acct: account, exp }, env.Σκύλλα);

  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=/; Max-Age=${TOKEN_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`
  );

  return new Response(JSON.stringify({ granted: true }), { status: 200, headers });
}
