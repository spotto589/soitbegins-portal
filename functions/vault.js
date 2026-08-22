import { COOKIE_NAME, getCookie, verifyToken } from './_shared.js';

function renderVaultHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>N0TES</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#08080a; }
  body{
    font-family:'Chakra Petch',sans-serif;
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
  .section-label{
    font-size:12px;
    letter-spacing:0.3em;
    color:#39ff14;
    text-transform:uppercase;
    opacity:0.7;
    margin:2.75rem 0 1.25rem;
  }
  .section-label:first-of-type{
    margin-top:0;
  }

  .decrees{
    list-style:none;
    padding:0;
    margin:0;
  }
  .decrees li{
    border-left:2px solid rgba(57,255,20,0.35);
    padding:0.2rem 0 0.2rem 1.2rem;
    margin-bottom:1.6rem;
  }
  .decrees h2{
    font-size:13px;
    letter-spacing:0.2em;
    color:#39ff14;
    text-transform:uppercase;
    margin-bottom:0.6rem;
  }
  .decrees p{
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

  .private-notes{
    border-top:1px dashed rgba(232,232,232,0.15);
    padding-top:0.5rem;
  }
  .private-notes p{
    font-size:13px;
    line-height:1.85;
    font-style:italic;
    color:rgba(232,232,232,0.5);
    margin-bottom:1.4rem;
  }

  .sign-off{
    margin-top:3rem;
    text-align:right;
    font-size:14px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.6);
  }

  .recovery-log{
    border:1px solid rgba(57,255,20,0.25);
    padding:1rem 1.25rem;
    margin-bottom:2rem;
    font-size:12px;
    line-height:1.9;
    color:rgba(57,255,20,0.85);
  }
  .recovery-log .dim{ color:rgba(232,232,232,0.45); }
</style>
</head>
<body>
  <div class="page">
    <div class="recovery-log">
      <span class="dim">RECOVERED ARCHIVE</span><br>
      KING_LOG_${String(Math.floor(Math.random() * 200)).padStart(3, '0')}<br>
      Recovery Integrity: ${(85 + Math.random() * 14).toFixed(1)}%<br>
      <span class="dim">Recovered after STATIC BREACH</span>
    </div>
    <div class="eyebrow">CLASSIFIED :: RECOVERED FROM THE BREACH</div>
    <h1>N0TES</h1>

    <div class="section-label">T0 D0 L!ST</div>
    <ul class="decrees">
      <li>
        <h2>GL!TCH</h2>
        <p>Burn them, burn them all!</p>
      </li>
      <li>
        <h2>$CRWN</h2>
        <p class="placeholder">[content goes here]</p>
        <a class="crwn-link" href="/crwn">SPEAK TO THE K!NG →</a>
      </li>
      <li>
        <h2>THE K!NGD0M</h2>
        <p class="placeholder">[content goes here]</p>
        <a class="crwn-link" href="/kingdom">ANSWER THE C0UNC!L'S CALL →</a>
      </li>
      <li>
        <h2>$HONEY</h2>
        <p class="placeholder">[content goes here]</p>
      </li>
    </ul>

    <div class="section-label">N0TES T0 H!MSELF</div>
    <div class="private-notes">
      <p class="placeholder">[content goes here]</p>
    </div>

    <div class="sign-off">— THE K!NG</div>
  </div>
</body>
</html>`;
}

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

  return new Response(renderVaultHtml(), { headers: { 'Content-Type': 'text/html' } });
}
