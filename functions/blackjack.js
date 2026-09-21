import { BOARD_COOKIE_NAME, getCookie, verifyToken } from './_shared.js';

// BLACKJACK — first game in the Σκύλλα://SYSTEM games section (see
// games.js for the hub). Wagers a KV-backed play balance, not real $CRWN —
// see _shared.js's crown-ledger comment for the full context. All game
// logic (shuffle, dealing, dealer play, double/split, payout) runs
// server-side in /api/blackjack-action.js (round shape shared via
// publicBlackjackRound in _shared.js); this page only renders whatever
// that endpoint (or /api/crown-balance's resume path) returns and never
// computes an outcome, a legal-move flag, or a payout itself.
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
    padding:4vh 4vw 6vh;
  }
  canvas#staticCanvas{ position:fixed; inset:0; width:100%; height:100%; z-index:0; opacity:0.4; pointer-events:none; }
  .glow-blob{ position:fixed; width:56vw; height:56vw; max-width:640px; max-height:640px; border-radius:50%; filter:blur(90px); z-index:0; pointer-events:none; opacity:0.16; }
  .glow-blob.a{ background:#3df3ec; top:-18vw; left:-14vw; animation:glowDrift 15s ease-in-out infinite; }
  .glow-blob.b{ background:#ff3fb0; bottom:-18vw; right:-14vw; animation:glowDrift 19s ease-in-out infinite reverse; }
  .glow-blob.c{ background:#ffb000; top:35%; left:40%; opacity:0.1; animation:glowDrift 23s ease-in-out infinite; }
  @keyframes glowDrift{ 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(3vw,-2vw) scale(1.18); } }
  .page{ max-width:980px; width:100%; position:relative; z-index:1; }

  .top-row{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.75rem; gap:1rem; flex-wrap:wrap; }
  .eyebrow{
    font-size:13px; letter-spacing:0.3em; color:#39ff14; text-transform:uppercase;
    opacity:0.85; text-shadow:0 0 6px rgba(57,255,20,0.5); margin-bottom:0.4rem;
  }
  h1{
    font-size:clamp(28px,5vw,46px); letter-spacing:0.06em; color:#fff;
    text-shadow:0 0 12px rgba(57,255,20,0.25);
  }
  .back-link{ font-size:12px; letter-spacing:0.1em; color:rgba(232,232,232,0.5); text-decoration:none; }
  .back-link:hover{ color:#39ff14; }

  .balance-chip{
    border:1px solid rgba(255,176,0,0.45); padding:0.7em 1.4em; text-align:right;
    background:rgba(255,176,0,0.05);
  }
  .balance-chip .bl{ font-size:11px; letter-spacing:0.2em; color:rgba(255,176,0,0.75); margin-bottom:0.25rem; }
  .balance-chip .bv{ font-size:34px; line-height:1; color:#ffb000; text-shadow:0 0 10px rgba(255,176,0,0.55); font-weight:700; }

  .marquee-frame{ position:relative; padding:18px; margin-bottom:1.5rem; }
  .bulbs{ position:absolute; inset:0; pointer-events:none; }
  .bulb{
    position:absolute; width:7px; height:7px; margin:-3.5px 0 0 -3.5px; border-radius:50%;
    animation:bulbPulse 1.6s ease-in-out infinite;
  }
  @keyframes bulbPulse{ 0%,100%{ opacity:0.28; transform:scale(0.8); } 50%{ opacity:1; transform:scale(1.25); } }
  .table{
    border:1px solid rgba(57,255,20,0.3); padding:2rem 2rem 1.5rem; min-height:340px;
    background:rgba(57,255,20,0.02); position:relative; z-index:1;
    animation:tableGlow 7s ease-in-out infinite;
  }
  @keyframes tableGlow{
    0%,100%{ box-shadow:0 0 20px rgba(57,255,20,0.22); border-color:rgba(57,255,20,0.35); }
    33%{ box-shadow:0 0 24px rgba(61,243,236,0.28); border-color:rgba(61,243,236,0.4); }
    66%{ box-shadow:0 0 24px rgba(255,63,208,0.28); border-color:rgba(255,63,208,0.4); }
  }
  .hands-row{ display:flex; gap:1.5rem; flex-wrap:wrap; }
  .hand-block{ margin-bottom:1.75rem; flex:1 1 260px; min-width:240px; }
  .hand-block.dealer-block{ flex-basis:100%; }
  .hand-block.active-hand{ outline:1px dashed rgba(255,63,208,0.6); outline-offset:8px; }
  .hand-label-row{ display:flex; align-items:center; justify-content:space-between; margin-bottom:0.5rem; }
  .hand-label{ font-size:13px; letter-spacing:0.2em; color:rgba(232,232,232,0.6); }
  .hand-label .bet-tag{ font-size:10px; color:rgba(255,176,0,0.7); margin-left:0.6em; letter-spacing:0.1em; }
  .hand-count{ font-size:38px; line-height:1; font-weight:700; color:#39ff14; text-shadow:0 0 10px rgba(57,255,20,0.55); margin-bottom:0.85rem; }
  .hand-count.bust{ color:#ff3fb0; text-shadow:0 0 10px rgba(255,63,176,0.55); }
  .cards{ display:flex; gap:0.6rem; flex-wrap:wrap; min-height:96px; }
  .card{
    width:64px; height:92px; border:1px solid rgba(232,232,232,0.4); border-radius:6px;
    background:#111; display:flex; align-items:center; justify-content:center;
    font-size:26px; font-weight:700; position:relative; overflow:hidden;
  }
  .card.red{ color:#ff3fb0; }
  .card.black{ color:#e8e8e8; }
  .card.hidden{ background:repeating-linear-gradient(45deg,#151515,#151515 4px,#1c1c1c 4px,#1c1c1c 8px); color:transparent; }
  /* Custom face art (Jester/Phoenix/King) drops in here once the images
     exist — see CARD_ART in the client script below. Until CARD_ART has a
     real URL for a rank, cardEl() never creates this element at all. */
  .card-art{ width:100%; height:100%; object-fit:cover; }
  .card-art-suit{ position:absolute; bottom:2px; right:4px; font-size:13px; text-shadow:0 0 3px #000, 0 0 3px #000; }

  .status-line{ text-align:center; font-size:16px; letter-spacing:0.1em; min-height:1.8em; margin-bottom:1.25rem; }
  .status-line.win{ color:#39ff14; text-shadow:0 0 8px rgba(57,255,20,0.5); }
  .status-line.lose{ color:#ff3fb0; text-shadow:0 0 8px rgba(255,63,176,0.5); }
  .status-line.push{ color:#ffb000; }
  .status-line.err{ color:#ff3fb0; }

  .bet-row{ display:flex; gap:0.85rem; align-items:center; justify-content:center; margin-bottom:1.25rem; }
  .bet-row input{
    width:130px; background:#0a0a0c; border:1px solid rgba(57,255,20,0.4); color:#e8e8e8;
    font-family:inherit; font-size:16px; padding:0.7em 0.9em; text-align:center;
  }
  .bet-row input:focus{ outline:none; border-color:#39ff14; }
  .btn-row{ display:flex; gap:0.85rem; justify-content:center; flex-wrap:wrap; }
  .gbtn{
    background:transparent; border:1px solid rgba(57,255,20,0.6); color:#39ff14;
    font-family:inherit; font-size:14px; letter-spacing:0.12em; padding:0.9em 1.8em;
    cursor:pointer; text-transform:uppercase; text-shadow:0 0 6px rgba(57,255,20,0.6);
  }
  .gbtn:hover:not(:disabled){ background:rgba(57,255,20,0.12); }
  .gbtn:disabled{ opacity:0.3; cursor:default; }
  .gbtn.secondary{ border-color:rgba(232,232,232,0.4); color:rgba(232,232,232,0.85); text-shadow:none; }
  .gbtn.accent{ border-color:rgba(255,63,208,0.6); color:#ff3fb0; text-shadow:0 0 6px rgba(255,63,208,0.5); }

  .note{ margin-top:2rem; font-size:11px; letter-spacing:0.03em; color:rgba(232,232,232,0.35); line-height:1.7; }
  @media (max-width:700px){
    .card{ width:52px; height:76px; font-size:21px; }
    .hand-count{ font-size:30px; }
    .balance-chip .bv{ font-size:26px; }
  }
</style>
</head>
<body>
  <canvas id="staticCanvas"></canvas>
  <div class="glow-blob a"></div>
  <div class="glow-blob b"></div>
  <div class="glow-blob c"></div>
  <div class="page">
    <div class="top-row">
      <div>
        <div class="eyebrow">Σκύλλα://SYSTEM</div>
        <h1>BLACKJACK</h1>
        <a class="back-link" href="/games">&larr; GAMES</a>
      </div>
      <div class="balance-chip">
        <div class="bl">SPENDABLE CR0WN</div>
        <div class="bv" id="balanceValue">···</div>
      </div>
    </div>

    <div class="marquee-frame">
      <div class="bulbs" id="bulbsLayer"></div>
      <div class="table">
      <div class="hand-block dealer-block">
        <div class="hand-label-row"><span class="hand-label">DEALER</span></div>
        <div class="hand-count" id="dealerValue">&nbsp;</div>
        <div class="cards" id="dealerCards"></div>
      </div>
      <div class="hands-row" id="playerHandsContainer"></div>
      </div>
    </div>

    <div class="status-line" id="statusLine"></div>

    <div class="bet-row" id="betRow">
      <span style="font-size:13px;letter-spacing:0.1em;color:rgba(232,232,232,0.6);">BET</span>
      <input type="number" id="betInput" min="1" step="1" value="10">
      <button class="gbtn" id="dealBtn">DEAL</button>
    </div>

    <div class="btn-row" id="actionRow" style="display:none;">
      <button class="gbtn" id="hitBtn">H!T</button>
      <button class="gbtn secondary" id="standBtn">STAND</button>
      <button class="gbtn accent" id="doubleBtn">D0UBLE</button>
      <button class="gbtn accent" id="splitBtn">SPL!T</button>
    </div>

    <div class="btn-row" id="againRow" style="display:none;">
      <button class="gbtn" id="againBtn">PLAY AGA!N</button>
    </div>

    <p class="note">Server-dealt, 6-deck shoe reshuffled every hand · dealer stands on 17 · blackjack pays 3:2 · double down on the first two cards · split any matching pair (splitting Aces deals one card each, no further action) · this Crown balance is a closed-test in-house wager balance, separate from the real $CRWN token.</p>
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

  // Chasing marquee-light bulbs around the table — plain divs placed at
  // even intervals around the rectangle perimeter (clockwise from
  // top-left), each with a staggered animation-delay so the pulse travels
  // around the frame instead of firing all at once.
  function buildMarqueeLights(){
    var layer = document.getElementById('bulbsLayer');
    if (!layer) return;
    var colors = ['#ffb000', '#3df3ec', '#ff3fb0', '#39ff14'];
    var count = 36;
    var html = '';
    for (var i = 0; i < count; i++) {
      var t = i / count;
      var seg = Math.floor(t * 4);
      var localT = (t * 4) - seg;
      var left, top;
      if (seg === 0) { left = localT * 100; top = 0; }
      else if (seg === 1) { left = 100; top = localT * 100; }
      else if (seg === 2) { left = 100 - localT * 100; top = 100; }
      else { left = 0; top = 100 - localT * 100; }
      var color = colors[i % colors.length];
      html += '<span class="bulb" style="left:' + left + '%;top:' + top + '%;background:' + color +
        ';box-shadow:0 0 6px ' + color + ',0 0 12px ' + color +
        ';animation-delay:' + (t * 1.6).toFixed(2) + 's;"></span>';
    }
    layer.innerHTML = html;
  }
  buildMarqueeLights();

  var el = {};
  ['balanceValue','dealerValue','dealerCards','playerHandsContainer','statusLine',
   'betRow','betInput','dealBtn','actionRow','hitBtn','standBtn','doubleBtn','splitBtn','againRow','againBtn'
  ].forEach(function(id){ el[id] = document.getElementById(id); });

  var SUIT_SYM = { S: '\\u2660', H: '\\u2665', D: '\\u2666', C: '\\u2663' };
  // Custom face art — drop an image URL in here once it exists (e.g.
  // J: '/assets/cards/jester.png') and that rank starts rendering with
  // the image instead of plain rank+suit text, everywhere it appears, no
  // other change needed. Leave a rank null/absent to keep the plain look.
  var CARD_ART = {
    J: null, // Jester
    A: null, // Phoenix
    K: null  // The King
  };
  function cardEl(card, hidden){
    var d = document.createElement('div');
    if (hidden) { d.className = 'card hidden'; d.textContent = '?'; return d; }
    var rank = card.slice(0, -1);
    var suit = card.slice(-1);
    var red = suit === 'H' || suit === 'D';
    d.className = 'card ' + (red ? 'red' : 'black');
    var art = CARD_ART[rank];
    if (art) {
      var img = document.createElement('img');
      img.className = 'card-art';
      img.src = art;
      img.alt = rank;
      d.appendChild(img);
      var badge = document.createElement('span');
      badge.className = 'card-art-suit';
      badge.textContent = SUIT_SYM[suit];
      badge.style.color = red ? '#ff3fb0' : '#e8e8e8';
      d.appendChild(badge);
    } else {
      d.textContent = rank + SUIT_SYM[suit];
    }
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

  // Renders 1 or 2 player hand-blocks (2 only after a split), each with its
  // own count-above-cards and its own DOUBLE/SPLIT-eligible highlighting —
  // same shape whether this came from a live action or a page-load resume.
  function renderPlayerHands(round){
    el.playerHandsContainer.innerHTML = '';
    var multi = round.hands.length > 1;
    round.hands.forEach(function(hand, i){
      var block = document.createElement('div');
      block.className = 'hand-block' + (round.status === 'active' && i === round.activeHandIndex ? ' active-hand' : '');
      var labelRow = document.createElement('div');
      labelRow.className = 'hand-label-row';
      var label = document.createElement('span');
      label.className = 'hand-label';
      label.textContent = multi ? ('HAND ' + (i + 1)) : 'Y0U';
      var betTag = document.createElement('span');
      betTag.className = 'bet-tag';
      betTag.textContent = 'BET ' + hand.bet;
      label.appendChild(betTag);
      labelRow.appendChild(label);
      block.appendChild(labelRow);

      var count = document.createElement('div');
      count.className = 'hand-count' + (hand.status === 'bust' ? ' bust' : '');
      count.textContent = hand.status === 'bust' ? hand.value + ' BUST' : hand.value;
      block.appendChild(count);

      var cardsDiv = document.createElement('div');
      cardsDiv.className = 'cards';
      hand.cards.forEach(function(c){ cardsDiv.appendChild(cardEl(c, false)); });
      block.appendChild(cardsDiv);

      el.playerHandsContainer.appendChild(block);
    });
  }

  function renderRound(round){
    renderPlayerHands(round);

    if (round.status === 'active') {
      el.dealerCards.innerHTML = '';
      el.dealerCards.appendChild(cardEl(round.dealerUp, false));
      el.dealerCards.appendChild(cardEl(null, true));
      el.dealerValue.innerHTML = '&nbsp;';
      el.dealerValue.className = 'hand-count';
      el.betRow.style.display = 'none';
      el.actionRow.style.display = 'flex';
      el.againRow.style.display = 'none';
      el.doubleBtn.disabled = !round.canDouble;
      el.splitBtn.disabled = !round.canSplit;
      el.splitBtn.style.display = round.canSplit || round.hands.length === 1 ? 'inline-block' : 'none';
      setStatus(round.hands.length > 1 ? 'YOUR M0VE — HAND ' + (round.activeHandIndex + 1) : 'YOUR M0VE', '');
    } else {
      renderCards(el.dealerCards, round.dealer);
      el.dealerValue.textContent = round.dealerValue;
      el.actionRow.style.display = 'none';
      el.betRow.style.display = 'none';
      el.againRow.style.display = 'flex';
      var labels = { blackjack: 'BLACKJACK!', win: 'W!N', push: 'PUSH', lose: 'L0SE' };
      var classes = { blackjack: 'win', win: 'win', push: 'push', lose: 'lose' };
      if (round.hands.length > 1) {
        var summary = round.hands.map(function(h, i){ return 'HAND ' + (i + 1) + ': ' + labels[h.result]; }).join('  ·  ');
        setStatus(summary, '');
      } else {
        var r = round.hands[0].result;
        var text = r === 'blackjack' ? 'BLACKJACK! Y0U W!N ' + Math.floor(round.hands[0].bet * 1.5) + ' CR0WN'
          : r === 'win' ? 'Y0U W!N ' + round.hands[0].bet + ' CR0WN'
          : r === 'push' ? 'PUSH — BET RETURNED'
          : 'Y0U L0SE';
        setStatus(text, classes[r]);
      }
    }
  }

  function resetToBetting(){
    el.dealerCards.innerHTML = '';
    el.playerHandsContainer.innerHTML = '';
    el.dealerValue.innerHTML = '&nbsp;';
    el.betRow.style.display = 'flex';
    el.actionRow.style.display = 'none';
    el.againRow.style.display = 'none';
    setStatus('', '');
  }

  var busy = false;
  async function callAction(payload){
    if (busy) return null;
    busy = true;
    [el.dealBtn, el.hitBtn, el.standBtn, el.doubleBtn, el.splitBtn].forEach(function(b){ b.disabled = true; });
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
      [el.dealBtn, el.hitBtn, el.standBtn].forEach(function(b){ b.disabled = false; });
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
  el.doubleBtn.addEventListener('click', async function(){
    var data = await callAction({ action: 'double' });
    if (data) renderRound(data.round);
  });
  el.splitBtn.addEventListener('click', async function(){
    var data = await callAction({ action: 'split' });
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
          renderRound(data.round);
          setStatus('R0UND RESUMED — ' + (data.round.hands.length > 1 ? 'HAND ' + (data.round.activeHandIndex + 1) : 'YOUR M0VE'), '');
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
