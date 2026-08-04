import { COOKIE_NAME, getCookie, verifyToken } from './_shared.js';

const VAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>K!NG'S N0TES</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#08080a; }
  body{
    font-family:'JetBrains Mono','Courier New',monospace;
    color:#e8e8e8;
    display:flex;
    justify-content:center;
    padding:8vh 6vw 10vh;
  }
  .page{
    max-width:640px;
    width:100%;
  }
  .eyebrow{
    font-size:12px;
    letter-spacing:0.35em;
    color:#39ff14;
    text-transform:uppercase;
    opacity:0.8;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
    margin-bottom:0.75rem;
  }
  h1{
    font-size:clamp(24px,4.5vw,40px);
    letter-spacing:0.08em;
    color:#fff;
    text-shadow:0 0 10px rgba(57,255,20,0.25);
    margin-bottom:1.75rem;
    line-height:1.2;
  }
  .intro{
    font-size:14px;
    line-height:1.8;
    color:rgba(232,232,232,0.75);
    margin-bottom:2.5rem;
    font-style:italic;
  }
  .entry{
    border-left:2px solid rgba(57,255,20,0.35);
    padding:0.2rem 0 0.2rem 1.2rem;
    margin-bottom:2rem;
  }
  .entry h2{
    font-size:13px;
    letter-spacing:0.2em;
    color:#39ff14;
    text-transform:uppercase;
    margin-bottom:0.6rem;
  }
  .entry p{
    font-size:14px;
    line-height:1.8;
    color:rgba(232,232,232,0.85);
  }
  .placeholder{
    color:rgba(255,176,0,0.75);
  }
  .crwn-link{
    display:inline-block;
    margin-top:1rem;
    padding:0.7em 1.3em;
    border:1px dashed rgba(57,255,20,0.5);
    color:#39ff14;
    text-decoration:none;
    letter-spacing:0.15em;
    font-size:13px;
    text-transform:uppercase;
    transition:background 0.15s ease;
  }
  .crwn-link:hover{
    background:rgba(57,255,20,0.1);
  }
  .sign-off{
    margin-top:3rem;
    text-align:right;
    font-size:14px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.6);
  }
</style>
</head>
<body>
  <div class="page">
    <div class="eyebrow">CLASSIFIED :: RECOVERED FROM THE BREACH</div>
    <h1>THE K!NG'S N0TES</h1>
    <p class="intro">These are not written for another world. They are only what is true in mine.</p>

    <div class="entry">
      <h2>GL!TCH</h2>
      <p>The keys were forged before the kingdom had walls. Those who carry one were listening before there was anything to hear.</p>
    </div>

    <div class="entry">
      <h2>$CRWN</h2>
      <p>The coin of the realm. Every kingdom needs one to trade in — mine is no different. <span class="placeholder">[$CRWN details go here]</span></p>
      <a class="crwn-link" href="/crwn">SPEAK TO THE K!NG →</a>
    </div>

    <div class="entry">
      <h2>$HONEY</h2>
      <p>Nothing grows here without it. The granaries run on $HONEY, and so does everyone in them. <span class="placeholder">[$HONEY details go here]</span></p>
    </div>

    <div class="sign-off">— THE K!NG</div>
  </div>
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
