import { fetchAllAccountNfts, hasGlitchKey } from '../_shared.js';

// Stateless on purpose — this isn't a session-gated area, it's a one-shot
// reveal. The client never learns what was being checked until this
// endpoint says granted:true; a denial carries no information about why.
export async function onRequestPost(context) {
  const { request } = context;

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
  const granted = hasGlitchKey(nfts);

  if (!granted) {
    return new Response(JSON.stringify({ granted: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ granted: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
