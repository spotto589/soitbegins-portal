import { BOARD_COOKIE_NAME, getCookie, verifyToken } from './_shared.js';

// Σκύλλα://SYSTEM — games hub. Closed/unlisted for now (reachable only via
// the CR0WN REWARDS box on /static, no nav link) per the user's own
// instruction. Wagers here spend a KV-backed play balance seeded by
// CROWN_STARTING_GRANT in _shared.js, NOT real $CRWN — see that file's own
// comment for the real-token/legal context this whole feature sits under.
function renderHub() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Σκύλλα://SYSTEM</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#08080a; }
  body{
    font-family:'Chakra Petch',sans-serif;
    color:#e8e8e8;
    min-height:100vh;
    display:flex;
    justify-content:center;
    padding:8vh 6vw 10vh;
  }
  canvas#staticCanvas{ position:fixed; inset:0; width:100%; height:100%; z-index:0; opacity:0.5; pointer-events:none; }
  .page{ max-width:640px; width:100%; position:relative; z-index:1; }
  .eyebrow{
    font-size:12px; letter-spacing:0.35em; color:#39ff14; text-transform:uppercase;
    opacity:0.85; text-shadow:0 0 6px rgba(57,255,20,0.5); margin-bottom:0.75rem;
  }
  h1{
    font-size:clamp(26px,4.5vw,42px); letter-spacing:0.06em; color:#fff;
    text-shadow:0 0 10px rgba(57,255,20,0.25); margin-bottom:0.75rem; line-height:1.2;
  }
  .intro{ font-size:13.5px; line-height:1.75; color:rgba(232,232,232,0.65); margin-bottom:1.25rem; font-style:italic; }
  .balance-box{
    display:flex; align-items:center; justify-content:space-between;
    border:1px solid rgba(255,176,0,0.4); padding:0.9rem 1.2rem; margin-bottom:2.5rem;
    background:rgba(255,176,0,0.04);
  }
  .balance-label{ font-size:11px; letter-spacing:0.2em; color:rgba(255,176,0,0.8); }
  .balance-value{ font-size:20px; color:#ffb000; text-shadow:0 0 8px rgba(255,176,0,0.5); }
  .balance-note{ font-size:10px; color:rgba(232,232,232,0.35); margin-top:0.35rem; letter-spacing:0.03em; }

  .game-list{ display:flex; flex-direction:column; gap:1rem; }
  .game-card{
    display:flex; align-items:center; justify-content:space-between; gap:1rem;
    border:1px solid rgba(57,255,20,0.3); padding:1.1rem 1.3rem;
    text-decoration:none; color:inherit; transition:border-color 0.15s ease, background 0.15s ease;
  }
  .game-card.live{ cursor:pointer; }
  .game-card.live:hover{ border-color:#39ff14; background:rgba(57,255,20,0.06); }
  .game-card.soon{ opacity:0.5; cursor:not-allowed; }
  .game-title{ font-size:16px; letter-spacing:0.08em; color:#fff; margin-bottom:0.3rem; }
  .game-sub{ font-size:11px; letter-spacing:0.05em; color:rgba(232,232,232,0.5); }
  .game-tag{ font-size:10px; letter-spacing:0.15em; padding:0.3em 0.6em; border:1px solid currentColor; }
  .game-tag.live{ color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.5); }
  .game-tag.soon{ color:rgba(232,232,232,0.4); }

  .back-link{
    display:inline-block; margin-top:2.5rem; border:1px solid rgba(57,255,20,0.55); color:#39ff14;
    font-size:12px; letter-spacing:0.12em; text-decoration:none; text-transform:uppercase;
    padding:0.8em 1.6em; transition:background 0.15s ease;
  }
  .back-link:hover{ background:rgba(57,255,20,0.1); }
</style>
</head>
<body>
  <canvas id="staticCanvas"></canvas>
  <div class="page">
    <div class="eyebrow">Σκύλλα://SYSTEM</div>
    <h1>CR0WN REWARDS :: GAMES</h1>
    <p class="intro">Wager Crown earned from trading on the site. Closed testing — not linked from the main nav yet.</p>

    <div class="balance-box">
      <div>
        <div class="balance-label">SPENDABLE CR0WN</div>
      </div>
      <div class="balance-value" id="balanceValue">···</div>
    </div>
    <div class="balance-note" id="balanceNote" style="margin-top:-1.75rem;margin-bottom:2rem;"></div>

    <div class="game-list">
      <a class="game-card live" href="/blackjack">
        <div>
          <div class="game-title">BLACKJACK</div>
          <div class="game-sub">Dealer stands on 17 · Blackjack pays 3:2 · 6-deck shoe</div>
        </div>
        <span class="game-tag live">L!VE</span>
      </a>
      <div class="game-card soon">
        <div>
          <div class="game-title">TEXAS H0LD'EM</div>
          <div class="game-sub">Bonus-hand poker against the house</div>
        </div>
        <span class="game-tag soon">C0M!NG S00N</span>
      </div>
      <div class="game-card soon">
        <div>
          <div class="game-title">TEXAS H0LD'EM P0KER VS</div>
          <div class="game-sub">Head-to-head Hold'em, straight up against the house</div>
        </div>
        <span class="game-tag soon">C0M!NG S00N</span>
      </div>
      <div class="game-card soon">
        <div>
          <div class="game-title">BACCARAT</div>
          <div class="game-sub">Player vs Banker — closest hand to 9 wins</div>
        </div>
        <span class="game-tag soon">C0M!NG S00N</span>
      </div>
    </div>

    <a class="back-link" href="/static">&larr; BACK T0 Σκύλλα</a>
  </div>

<script>
(function(){
  var CANVAS_W = 300, CANVAS_H = 200;
  function startStaticCanvas(){
    var c = document.getElementById('staticCanvas');
    if (!c) return;
    function size(){ c.width = window.innerWidth; c.height = window.innerHeight; }
    size();
    window.addEventListener('resize', size);
    var ctx = c.getContext('2d');
    function frame(){
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      var flecks = Math.floor((c.width * c.height) / 9000);
      for (var i = 0; i < flecks; i++) {
        var x = Math.random() * c.width, y = Math.random() * c.height;
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(61,243,236,0.55)' : 'rgba(255,63,208,0.5)';
        ctx.fillRect(x, y, 1, 1);
      }
      requestAnimationFrame(frame);
    }
    frame();
  }
  startStaticCanvas();

  async function loadBalance(){
    var val = document.getElementById('balanceValue');
    var note = document.getElementById('balanceNote');
    try {
      var res = await fetch('/api/crown-balance');
      var data = await res.json();
      if (data.ok) {
        val.textContent = data.balance;
        if (data.round) note.textContent = 'R0UND !N PR0GRESS — RES0LVE !T !N BLACKJACK T0 PLAY AGA!N';
      } else {
        val.textContent = '—';
      }
    } catch (e) {
      val.textContent = '—';
    }
  }
  loadBalance();
})();
</script>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
    return new Response('server misconfigured', { status: 500 });
  }

  const token = getCookie(request, BOARD_COOKIE_NAME);
  if (!token) {
    return Response.redirect(new URL('/static', request.url).toString(), 302);
  }
  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return Response.redirect(new URL('/static', request.url).toString(), 302);
  }

  return new Response(renderHub(), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}
