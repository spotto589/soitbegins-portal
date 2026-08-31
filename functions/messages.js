// Paused — MESSAGES_DB was never bound in the Cloudflare Pages dashboard
// for production (a manual step every other binding here needed too, see
// HANDOFF.md), so every real request from the full messaging UI 500s with
// server_misconfigured. That made the page's own "already logged in? skip
// the connect screen" check always fail and fall back to prompting login,
// over and over, regardless of session state — reported live as "why do
// we have to login again to send messages." Simplest honest fix until the
// binding is actually added: a plain coming-soon page, same as
// TRANSACTION HISTORY/$CRWN REWARDS elsewhere on the site. The full
// working implementation (connect flow, inbox, threads, composer) isn't
// deleted, just replaced here — see this file's own git history (the
// commit right before this one) to bring it back once MESSAGES_DB is
// bound; every entry point into it in functions/static.js was disabled
// alongside this, same git history.
function renderComingSoonPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>S!GNAL :: MESSAGES</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#0a0508; }
  body{
    font-family:'Chakra Petch',sans-serif;
    color:#e8e8e8;
    min-height:100vh;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
    padding:2rem 1.25rem;
  }
  .wrap{ max-width:480px; }
  .eyebrow{
    font-size:11px; letter-spacing:0.3em; color:#39ff14; text-transform:uppercase;
    opacity:0.85; margin-bottom:1rem;
  }
  h1{ font-size:clamp(22px,5vw,32px); letter-spacing:0.05em; margin-bottom:1rem; }
  p{ color:rgba(232,232,232,0.6); font-size:14px; line-height:1.6; margin-bottom:2rem; }
  .back-link{
    display:inline-block; border:1px solid rgba(57,255,20,0.55); color:#39ff14;
    font-size:12px; letter-spacing:0.12em; text-decoration:none; text-transform:uppercase;
    padding:0.8em 1.6em; transition:background 0.15s ease;
  }
  .back-link:hover{ background:rgba(57,255,20,0.1); }
</style>
</head>
<body>
  <div class="wrap">
    <div class="eyebrow">S!GNAL_N0DE :: PR!VATE CHANNEL</div>
    <h1>MESSAGES C0M!NG S00N</h1>
    <p>Wallet-to-wallet messaging is being finished up — check back soon.</p>
    <a class="back-link" href="/static">&larr; BACK T0 Σκύλλα</a>
  </div>
</body>
</html>`;
}

export async function onRequestGet() {
  return new Response(renderComingSoonPage(), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}
