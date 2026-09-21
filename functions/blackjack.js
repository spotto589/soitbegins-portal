import { BOARD_COOKIE_NAME, getCookie, verifyToken } from './_shared.js';

// BLACKJACK — first game in the Σκύλλα://SYSTEM games section (see
// games.js for the hub). Wagers a KV-backed play balance, not real $CRWN —
// see _shared.js's crown-ledger comment for the full context. All game
// logic (shuffle, dealing, dealer play, payout) runs server-side in
// /api/blackjack-action.js; this page only renders whatever that endpoint
// returns and never computes an outcome itself.
function renderPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BLACKJACK :: Σκύλλα</title>
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
    padding:6vh 5vw 8vh;
  }
  canvas#staticCanvas{ position:fixed; inset:0; width:100%; height:100%; z-index:0; opacity:0.45; pointer-events:none; }
  .page{ max-width:620px; width:100%; position:relative; z-index:1; }
  .eyebrow{
    font-size:12px; letter-spacing:0.3em; color:#39ff14; text-transform:uppercase;
    opacity:0.85; text-shadow:0 0 6px rgba(57,255,20,0.5); margin-bottom:0.5rem;
  }
  h1{
    font-size:clamp(24px,4vw,36px); letter-spacing:0.06em; color:#fff;
    text-shadow:0 0 10px rgba(57,255,20,0.25); margin-bottom:1.5rem;
  }
  .top-row{ display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; gap:1rem; flex-wrap:wrap; }
  .balance-chip{
    border:1px solid rgba(255,176,0,0.4); padding:0.5em 1em; font-size:13px;
    color:#ffb000; text-shadow:0 0 6px rgba(255,176,0,0.4); white-space:nowrap;
  }
  .balance-chip span{ opacity:0.6; font-size:11px; margin-right:0.4em; }
  .back-link{ font-size:11px; letter-spacing:0.1em; color:rgba(232,232,232,0.5); text-decoration:none; }
  .back-link:hover{ color:#39ff14; }

  .table{ border:1px solid rgba(57,255,20,0.3); padding:1.5rem; margin-bottom:1.5rem; min-height:260px; background:rgba(57,255,20,0.02); }
  .hand-block{ margin-bottom:1.5rem; }
  .hand-label{ font-size:11px; letter-spacing:0.2em; color:rgba(232,232,232,0.55); margin-bottom:0.6rem; display:flex; justify-content:space-between; }
  .hand-value{ color:#39ff14; }
  .cards{ display:flex; gap:0.5rem; flex-wrap:wrap; min-height:70px; }
  .card{
    width:48px; height:68px; border:1px solid rgba(232,232,232,0.4); border-radius:4px;
    background:#111; display:flex; align-items:center; justify-content:center;
    font-size:18px; font-weight:700;
  }
  .card.red{ color:#ff3fb0; }
  .card.black{ color:#e8e8e8; }
  .card.hidden{ background:repeating-linear-gradient(45deg,#151515,#151515 4px,#1c1c1c 4px,#1c1c1c 8px); color:transparent; }

  .status-line{ text-align:center; font-size:13px; letter-spacing:0.1em; min-height:1.6em; margin-bottom:1rem; }
  .status-line.win{ color:#39ff14; text-shadow:0 0 8px rgba(57,255,20,0.5); }
  .status-line.lose{ color:#ff3fb0; text-shadow:0 0 8px rgba(255,63,176,0.5); }
  .status-line.push{ color:#ffb000; }
  .status-line.err{ color:#ff3fb0; }

  .bet-row{ display:flex; gap:0.75rem; align-items:center; justify-content:center; margin-bottom:1rem; }
  .bet-row input{
    width:100px; background:#0a0a0c; border:1px solid rgba(57,255,20,0.4); color:#e8e8e8;
    font-family:inherit; font-size:14px; padding:0.6em 0.8em; text-align:center;
  }
  .bet-row input:focus{ outline:none; border-color:#39ff14; }
  .btn-row{ display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap; }
  .gbtn{
    background:transparent; border:1px solid rgba(57,255,20,0.6); color:#39ff14;
    font-family:inherit; font-size:13px; letter-spacing:0.12em; padding:0.8em 1.6em;
    cursor:pointer; text-transform:uppercase; text-shadow:0 0 6px rgba(57,255,20,0.6);
  }
  .gbtn:hover:not(:disabled){ background:rgba(57,255,20,0.12); }
  .gbtn:disabled{ opacity:0.35; cursor:default; }
  .gbtn.secondary{ border-color:rgba(232,232,232,0.4); color:rgba(232,232,232,0.85); text-shadow:none; }

  .note{ margin-top:2rem; font-size:10.5px; letter-spacing:0.03em; color:rgba(232,232,232,0.35); line-height:1.6; }
</style>
</head>
<body>
  <canvas id="staticCanvas"></canvas>
  <div class="page">
    <div class="top-row">
      <div>
        <div class="eyebrow">Σκύλλα://SYSTEM</div>
        <h1 style="margin-bottom:0;">BLACKJACK</h1>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.5rem;">
        <div class="balance-chip"><span>CR0WN</span><span id="balanceValue">···</span></div>
        <a class="back-link" href="/games">&larr; GAMES</a>
      </div>
    </div>

    <div class="table">
      <div class="hand-block">
        <div class="hand-label"><span>DEALER</span><span class="hand-value" id="dealerValue"></span></div>
        <div class="cards" id="dealerCards"></div>
      </div>
      <div class="hand-block" style="margin-bottom:0;">
        <div class="hand-label"><span>Y0U</span><span class="hand-value" id="playerValue"></span></div>
        <div class="cards" id="playerCards"></div>
      </div>
    </div>

    <div class="status-line" id="statusLine"></div>

    <div class="bet-row" id="betRow">
      <span style="font-size:12px;letter-spacing:0.1em;color:rgba(232,232,232,0.6);">BET</span>
      <input type="number" id="betInput" min="1" step="1" value="10">
      <button class="gbtn" id="dealBtn">DEAL</button>
    </div>

    <div class="btn-row" id="actionRow" style="display:none;">
      <button class="gbtn" id="hitBtn">H!T</button>
      <button class="gbtn secondary" id="standBtn">STAND</button>
    </div>

    <div class="btn-row" id="againRow" style="display:none;">
      <button class="gbtn" id="againBtn">PLAY AGA!N</button>
    </div>

    <p class="note">Server-dealt, 6-deck shoe reshuffled every hand · dealer stands on 17 · blackjack pays 3:2 · this Crown balance is a closed-test in-house wager balance, separate from the real $CRWN token.</p>
  </div>

<script>
(function(){
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

  var el = {};
  ['balanceValue','dealerValue','dealerCards','playerValue','playerCards','statusLine',
   'betRow','betInput','dealBtn','actionRow','hitBtn','standBtn','againRow','againBtn'
  ].forEach(function(id){ el[id] = document.getElementById(id); });

  var SUIT_SYM = { S: '\\u2660', H: '\\u2665', D: '\\u2666', C: '\\u2663' };
  function cardEl(card, hidden){
    var d = document.createElement('div');
    if (hidden) { d.className = 'card hidden'; d.textContent = '?'; return d; }
    var rank = card.slice(0, -1);
    var suit = card.slice(-1);
    var red = suit === 'H' || suit === 'D';
    d.className = 'card ' + (red ? 'red' : 'black');
    d.textContent = rank + SUIT_SYM[suit];
    return d;
  }
  function renderCards(container, cards){
    container.innerHTML = '';
    cards.forEach(function(c){ container.appendChild(cardEl(c, false)); });
  }

  function setStatus(text, cls){
    el.statusLine.textContent = text || '';
    el.statusLine.className = 'status-line' + (cls ? ' ' + cls : '');
  }

  function renderRound(round){
    renderCards(el.playerCards, round.player);
    el.playerValue.textContent = round.playerValue;

    if (round.status === 'active') {
      el.dealerCards.innerHTML = '';
      el.dealerCards.appendChild(cardEl(round.dealerUp, false));
      el.dealerCards.appendChild(cardEl(null, true));
      el.dealerValue.textContent = '';
      el.betRow.style.display = 'none';
      el.actionRow.style.display = 'flex';
      el.againRow.style.display = 'none';
      setStatus('YOUR M0VE', '');
    } else {
      renderCards(el.dealerCards, round.dealer);
      el.dealerValue.textContent = round.dealerValue;
      el.actionRow.style.display = 'none';
      el.betRow.style.display = 'none';
      el.againRow.style.display = 'flex';
      var msgs = {
        blackjack: ['BLACKJACK! Y0U W!N ' + Math.floor(round.bet * 1.5) + ' CR0WN', 'win'],
        win: ['Y0U W!N ' + round.bet + ' CR0WN', 'win'],
        push: ['PUSH — BET RETURNED', 'push'],
        lose: ['Y0U L0SE', 'lose']
      };
      var m = msgs[round.result] || ['R0UND RES0LVED', ''];
      setStatus(m[0], m[1]);
    }
  }

  function resetToBetting(){
    el.dealerCards.innerHTML = '';
    el.playerCards.innerHTML = '';
    el.dealerValue.textContent = '';
    el.playerValue.textContent = '';
    el.betRow.style.display = 'flex';
    el.actionRow.style.display = 'none';
    el.againRow.style.display = 'none';
    setStatus('', '');
  }

  var busy = false;
  async function callAction(payload){
    if (busy) return null;
    busy = true;
    el.dealBtn.disabled = true; el.hitBtn.disabled = true; el.standBtn.disabled = true;
    try {
      var res = await fetch('/api/blackjack-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus('ERR:: ' + (data.error || 'unknown').toUpperCase().replace(/_/g, ' '), 'err');
        return null;
      }
      el.balanceValue.textContent = data.balance;
      return data;
    } catch (e) {
      setStatus('ERR:: S!GNAL_L0ST', 'err');
      return null;
    } finally {
      busy = false;
      el.dealBtn.disabled = false; el.hitBtn.disabled = false; el.standBtn.disabled = false;
    }
  }

  el.dealBtn.addEventListener('click', async function(){
    var bet = parseInt(el.betInput.value, 10);
    if (!bet || bet < 1) { setStatus('ENTER A VAL!D BET', 'err'); return; }
    var data = await callAction({ action: 'deal', bet: bet });
    if (data) renderRound(data.round);
  });
  el.hitBtn.addEventListener('click', async function(){
    var data = await callAction({ action: 'hit' });
    if (data) renderRound(data.round);
  });
  el.standBtn.addEventListener('click', async function(){
    var data = await callAction({ action: 'stand' });
    if (data) renderRound(data.round);
  });
  el.againBtn.addEventListener('click', resetToBetting);

  (async function init(){
    try {
      var res = await fetch('/api/crown-balance');
      var data = await res.json();
      if (data.ok) {
        el.balanceValue.textContent = data.balance;
        el.betInput.max = data.maxBet;
        if (data.round && data.round.status === 'active') {
          // Resume an in-progress round (e.g. after a page refresh) — the
          // dealer's hole card stays hidden, same as any other active round.
          renderCards(el.playerCards, data.round.player);
          el.playerValue.textContent = data.round.playerValue;
          el.dealerCards.innerHTML = '';
          el.dealerCards.appendChild(cardEl(data.round.dealerUp, false));
          el.dealerCards.appendChild(cardEl(null, true));
          el.betRow.style.display = 'none';
          el.actionRow.style.display = 'flex';
          setStatus('R0UND RESUMED — Y0UR M0VE', '');
        }
      } else {
        el.balanceValue.textContent = '—';
      }
    } catch (e) {
      el.balanceValue.textContent = '—';
    }
  })();
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

  return new Response(renderPage(), { headers: { 'Content-Type': 'text/html; charset=UTF-8' } });
}
