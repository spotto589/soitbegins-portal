const COOKIE_NAME = 'glitch_access';

function getCookie(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function fromBase64Url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function verifyToken(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const valid = await crypto.subtle.verify(
    'HMAC', key, fromBase64Url(sigB64), new TextEncoder().encode(payloadB64)
  );
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

const VAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>:: signal recovered ::</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ height:100%; background:#08080a; }
  body{
    font-family:'JetBrains Mono','Courier New',monospace;
    color:#39ff14;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
    padding:2rem;
  }
  h1{
    font-size:clamp(20px,4vw,40px);
    letter-spacing:0.15em;
    text-shadow:0 0 10px rgba(57,255,20,0.6);
  }
</style>
</head>
<body>
  <h1>SIGNAL RECOVERED<br>WELCOME, HOLDER.</h1>
</body>
</html>`;

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
    return new Response('server misconfigured', { status: 500 });
  }

  const token = getCookie(request, COOKIE_NAME);
  if (!token) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }

  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }

  return new Response(VAULT_HTML, { headers: { 'Content-Type': 'text/html' } });
}
