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
    align-items:flex-start;
    padding:1vh 3vw;
  }
  canvas#staticCanvas{ position:fixed; inset:0; width:100%; height:100%; z-index:0; opacity:0.4; pointer-events:none; }
  .glow-blob{ position:fixed; width:56vw; height:56vw; max-width:640px; max-height:640px; border-radius:50%; filter:blur(90px); z-index:0; pointer-events:none; opacity:0.16; }
  .glow-blob.a{ background:#3df3ec; top:-18vw; left:-14vw; animation:glowDrift 15s ease-in-out infinite; }
  .glow-blob.b{ background:#ff3fb0; bottom:-18vw; right:-14vw; animation:glowDrift 19s ease-in-out infinite reverse; }
  .glow-blob.c{ background:#ffb000; top:35%; left:40%; opacity:0.1; animation:glowDrift 23s ease-in-out infinite; }
  @keyframes glowDrift{ 0%,100%{ transform:translate(0,0) scale(1); } 50%{ transform:translate(3vw,-2vw) scale(1.18); } }
  .page{ max-width:980px; width:100%; position:relative; z-index:1; margin:0 auto; transition:max-width 0.35s ease; }
  /* "restrict it to the middle of the screen" once a hand is actually in
     play — narrows the whole column, back to full width on the betting
     screen. Toggled in the client script alongside the bet-row/action-row
     show/hide. */
  .page.in-hand{ max-width:640px; }

  .session-chip{
    border:1px solid rgba(57,255,20,0.45); padding:0.45em 1.1em; text-align:right;
    background:rgba(57,255,20,0.05); cursor:pointer; font-family:inherit;
    display:block; transition:border-color 0.15s ease, background 0.15s ease;
  }
  .session-chip:hover{ border-color:#39ff14; background:rgba(57,255,20,0.1); }
  .session-chip .bl{ font-size:10px; letter-spacing:0.2em; color:rgba(57,255,20,0.75); margin-bottom:0.2rem; }
  .session-chip .sv{ font-size:18px; line-height:1; font-weight:700; display:block; }
  .session-chip .sv.pos{ color:#39ff14; text-shadow:0 0 8px rgba(57,255,20,0.5); }
  .session-chip .sv.neg{ color:#ff3fb0; text-shadow:0 0 8px rgba(255,63,176,0.5); }
  .session-chip .sv.zero{ color:rgba(232,232,232,0.7); text-shadow:none; }

  .history-empty{ font-size:12px; color:rgba(232,232,232,0.4); font-style:italic; }
  .history-list{ display:flex; flex-direction:column; gap:0.6rem; max-height:55vh; overflow-y:auto; }
  .hist-row{ border-left:2px solid rgba(232,232,232,0.25); padding:0.35rem 0 0.35rem 0.7rem; font-size:12px; }
  .hist-row.hist-win{ border-left-color:#39ff14; }
  .hist-row.hist-lose{ border-left-color:#ff3fb0; }
  .hist-row.hist-push{ border-left-color:#ffb000; }
  .hist-row-top{ display:flex; justify-content:space-between; letter-spacing:0.05em; margin-bottom:0.2rem; }
  .hist-row-top span:nth-child(1){ color:rgba(232,232,232,0.5); }
  .hist-row.hist-win .hist-row-top span:nth-child(3){ color:#39ff14; }
  .hist-row.hist-lose .hist-row-top span:nth-child(3){ color:#ff3fb0; }
  .hist-row.hist-push .hist-row-top span:nth-child(3){ color:#ffb000; }
  .hist-row-sub{ color:rgba(232,232,232,0.45); letter-spacing:0.02em; }

  .modal-overlay{
    position:fixed; inset:0; background:rgba(0,0,0,0.78); z-index:300;
    display:none; align-items:center; justify-content:center; padding:4vh 4vw;
  }
  .modal-overlay.open{ display:flex; }
  .modal-box{
    background:#0a0a0c; border:1px solid rgba(57,255,20,0.4); box-shadow:0 0 30px rgba(57,255,20,0.15);
    max-width:760px; width:100%; max-height:88vh; overflow-y:auto; padding:1.5rem 1.5rem 2rem;
  }
  .modal-header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:1.1rem; }
  .modal-header span{ font-size:15px; letter-spacing:0.2em; color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.5); }
  .modal-close-btn{ background:transparent; border:1px solid rgba(232,232,232,0.4); color:rgba(232,232,232,0.8); font-family:inherit; font-size:14px; padding:0.3em 0.7em; cursor:pointer; }
  .modal-close-btn:hover{ border-color:#ff3fb0; color:#ff3fb0; }
  .modal-note{ font-size:11px; color:rgba(232,232,232,0.45); margin-bottom:1rem; line-height:1.6; }
  .strat-legend{ font-size:11px; letter-spacing:0.05em; color:rgba(232,232,232,0.6); margin-bottom:1.25rem; line-height:2.2; }
  .strat-legend b{ display:inline-block; min-width:1.6em; text-align:center; border-radius:3px; margin-right:0.3em; padding:0.1em 0.3em; }
  .strat-section-title{ font-size:12px; letter-spacing:0.2em; color:rgba(255,176,0,0.85); margin:1.25rem 0 0.6rem; }
  .rules-list{ list-style:none; padding:0; margin:0 0 0.5rem; }
  .rules-list li{ font-size:12.5px; line-height:1.7; color:rgba(232,232,232,0.75); padding-left:1.1em; position:relative; margin-bottom:0.4rem; }
  .rules-list li::before{ content:'▸'; position:absolute; left:0; color:#39ff14; }
  .strat-table{ width:100%; border-collapse:collapse; font-size:11.5px; text-align:center; }
  .strat-table th, .strat-table td{ border:1px solid rgba(232,232,232,0.15); padding:0.4em 0.3em; }
  .strat-table thead th{ color:rgba(232,232,232,0.55); font-weight:600; }
  .strat-table tbody th{ color:rgba(232,232,232,0.75); text-align:right; padding-right:0.6em; font-weight:600; white-space:nowrap; }
  .strat-hit{ background:rgba(255,63,208,0.18); color:#ff3fb0; }
  .strat-stand{ background:rgba(57,255,20,0.15); color:#39ff14; }
  .strat-double{ background:rgba(255,176,0,0.18); color:#ffb000; }
  .strat-split{ background:rgba(61,243,236,0.18); color:#3df3ec; }
  @media (max-width:600px){ .strat-table{ font-size:9.5px; } .strat-table th, .strat-table td{ padding:0.3em 0.1em; } }

  .top-row{ display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.85rem; gap:1rem; flex-wrap:wrap; }
  .eyebrow{
    font-size:13px; letter-spacing:0.3em; color:#39ff14; text-transform:uppercase;
    opacity:0.85; text-shadow:0 0 6px rgba(57,255,20,0.5); margin-bottom:0.4rem;
  }
  h1{
    font-size:clamp(24px,4vw,36px); letter-spacing:0.06em; color:#fff;
    text-shadow:0 0 12px rgba(57,255,20,0.25);
  }
  .back-link{ font-size:12px; letter-spacing:0.1em; color:rgba(232,232,232,0.5); text-decoration:none; }
  .back-link:hover{ color:#39ff14; }

  .balance-chip{
    border:1px solid rgba(255,176,0,0.45); padding:0.45em 1.1em; text-align:right;
    background:rgba(255,176,0,0.05);
  }
  .balance-chip .bl{ font-size:10px; letter-spacing:0.2em; color:rgba(255,176,0,0.75); margin-bottom:0.2rem; }
  .balance-chip .bv{ font-size:26px; line-height:1; color:#ffb000; text-shadow:0 0 10px rgba(255,176,0,0.55); font-weight:700; }

  /* Cyberpunk chasing border — a big rotating conic-gradient "comet" (cyan
     leading, pink trailing) clipped by the frame's overflow:hidden down to
     just the thin padding ring around .table, so it reads as a light
     chasing around the border rather than a bulb string. .table's own
     z-index:1 stacking context keeps the ring (z-index -1, behind
     .table's own background paint) from ever covering the cards. */
  .marquee-frame{ position:relative; padding:4px; border-radius:8px; overflow:hidden; margin-bottom:0.5rem; }
  .cyber-glow{
    position:absolute; top:50%; left:50%; width:160%; height:160%;
    transform:translate(-50%,-50%) rotate(0deg);
    background:conic-gradient(from 0deg,
      transparent 0deg, #3df3ec 6deg, rgba(61,243,236,0.35) 18deg, transparent 46deg,
      transparent 176deg, #ff3fb0 186deg, rgba(255,63,208,0.35) 200deg, transparent 230deg,
      transparent 360deg);
    animation:cyberChase 2.6s linear infinite;
    pointer-events:none;
  }
  @keyframes cyberChase{ to{ transform:translate(-50%,-50%) rotate(360deg); } }
  .table{
    border:1px solid rgba(57,255,20,0.3); padding:0.7rem 1.1rem 0.55rem; min-height:195px;
    background:rgba(57,255,20,0.02); position:relative; z-index:1;
    box-shadow:0 0 20px rgba(57,255,20,0.15);
  }
  #tableStaticCanvas{ position:absolute; inset:0; z-index:-1; opacity:0.55; pointer-events:none; }
  .hands-row{ display:flex; gap:1.5rem; flex-wrap:wrap; justify-content:center; }
  /* Deck-shuffling idle animation — sits centered in the table while
     nothing has been dealt yet (shown/hidden in lockstep with betRow).
     Three overlapping card-backs drifting independently, sped up (see
     .active below) for a couple seconds right when DEAL is clicked
     before the real dealing sequence actually starts. */
  .shuffle-deck{ display:flex; align-items:center; justify-content:center; position:relative; width:100px; height:144px; margin:0.4rem auto; }
  .shuffle-deck .sc{
    position:absolute; inset:0; border:3px solid rgba(232,232,232,0.35); border-radius:10px;
    background:repeating-linear-gradient(45deg,#151515,#151515 5px,#1c1c1c 5px,#1c1c1c 10px);
  }
  .shuffle-deck .sc:nth-child(1){ animation:shuffleCard1 1.4s ease-in-out infinite; }
  .shuffle-deck .sc:nth-child(2){ animation:shuffleCard2 1.4s ease-in-out infinite; animation-delay:0.15s; }
  .shuffle-deck .sc:nth-child(3){ animation:shuffleCard3 1.4s ease-in-out infinite; animation-delay:0.3s; }
  .shuffle-deck.active .sc:nth-child(1){ animation-duration:0.4s; }
  .shuffle-deck.active .sc:nth-child(2){ animation-duration:0.4s; }
  .shuffle-deck.active .sc:nth-child(3){ animation-duration:0.4s; }
  @keyframes shuffleCard1{ 0%,100%{ transform:translate(0,0) rotate(-4deg); } 50%{ transform:translate(-16px,-5px) rotate(-11deg); } }
  @keyframes shuffleCard2{ 0%,100%{ transform:translate(0,0) rotate(2deg); } 50%{ transform:translate(7px,-7px) rotate(9deg); } }
  @keyframes shuffleCard3{ 0%,100%{ transform:translate(0,0) rotate(-1deg); } 50%{ transform:translate(5px,5px) rotate(5deg); } }
  .shuffle-label{
    position:absolute; top:100%; left:50%; transform:translateX(-50%); margin-top:0.8rem;
    font-size:12px; letter-spacing:0.2em; color:rgba(57,255,20,0.7); white-space:nowrap;
    animation:shuffleLabelPulse 1.4s ease-in-out infinite;
  }
  @keyframes shuffleLabelPulse{ 0%,100%{ opacity:0.5; } 50%{ opacity:1; } }
  .hand-block{ margin-bottom:0.4rem; flex:1 1 320px; min-width:300px; text-align:center; }
  .hand-block.dealer-block{ flex-basis:100%; }
  .hand-block.active-hand{ outline:1px dashed rgba(255,63,208,0.6); outline-offset:8px; }
  .hand-label-row{ display:flex; align-items:center; justify-content:center; margin-bottom:0.3rem; }
  .hand-label{ font-size:14px; letter-spacing:0.2em; color:rgba(232,232,232,0.6); }
  .hand-label .bet-tag{ font-size:15px; font-weight:700; color:#ffb000; margin-left:0.6em; letter-spacing:0.08em; text-shadow:0 0 6px rgba(255,176,0,0.4); }
  .hand-count{ font-size:32px; line-height:1; font-weight:700; color:#39ff14; text-shadow:0 0 10px rgba(57,255,20,0.55); margin-bottom:0.5rem; }
  .hand-count.bust{ color:#ff3fb0; text-shadow:0 0 10px rgba(255,63,176,0.55); }
  .cards{ display:flex; gap:0.6rem; flex-wrap:wrap; min-height:132px; justify-content:center; }
  .card{
    width:100px; height:144px; border:3px solid rgba(232,232,232,0.4); border-radius:9px;
    background:#111; display:flex; align-items:center; justify-content:center;
    font-size:40px; font-weight:700; position:relative; overflow:hidden;
  }
  .card.hidden{ background:repeating-linear-gradient(45deg,#151515,#151515 5px,#1c1c1c 5px,#1c1c1c 10px); color:transparent; border-color:rgba(232,232,232,0.25) !important; box-shadow:none !important; }
  /* Dealing pace — a card lands with a little drop/settle instead of just
     appearing, and the dealer's hole card gets a flip-swap when revealed.
     Kept short (well under half a second each) so "slow enough to feel
     like a hand being played" doesn't tip into "annoyingly sluggish". */
  @keyframes cardDeal{
    0%{ opacity:0; transform:translateY(-18px) scale(0.82) rotate(-8deg); }
    70%{ opacity:1; transform:translateY(2px) scale(1.03) rotate(1deg); }
    100%{ opacity:1; transform:translateY(0) scale(1) rotate(0); }
  }
  .card-deal{ animation:cardDeal 0.32s ease-out both; }
  @keyframes cardFlipOut{ from{ transform:scaleX(1); } to{ transform:scaleX(0); } }
  @keyframes cardFlipIn{ from{ transform:scaleX(0); } to{ transform:scaleX(1); } }
  .card-flip-out{ animation:cardFlipOut 0.16s ease-in both; }
  .card-flip-in{ animation:cardFlipIn 0.18s ease-out both; }
  /* Custom face art (Jester/Phoenix/King) drops in here once the images
     exist — see CARD_ART in the client script below. Until CARD_ART has a
     real URL for a rank, cardEl() never creates this element at all. */
  .card-art{ width:100%; height:100%; object-fit:cover; }
  .card-art-suit{ position:absolute; bottom:3px; right:6px; font-size:20px; text-shadow:0 0 3px #000, 0 0 3px #000; }
  .card-art-rank{ position:absolute; top:1px; left:5px; font-size:20px; color:#fff; text-shadow:0 0 3px #000, 0 0 3px #000; }

  .status-line{ text-align:center; font-size:15px; letter-spacing:0.1em; min-height:1.5em; margin-bottom:0.6rem; }
  .status-line.win{ color:#39ff14; text-shadow:0 0 8px rgba(57,255,20,0.5); }
  .status-line.lose{ color:#ff3fb0; text-shadow:0 0 8px rgba(255,63,176,0.5); }
  .status-line.push{ color:#ffb000; }
  .status-line.err{ color:#ff3fb0; }

  .bet-row{ display:flex; gap:1rem; align-items:center; justify-content:center; margin-bottom:0.4rem; }
  .bet-row .bet-row-label{ font-size:17px; letter-spacing:0.12em; color:rgba(232,232,232,0.75); font-weight:600; }
  .bet-row input{
    width:160px; background:#0a0a0c; border:2px solid rgba(57,255,20,0.5); color:#39ff14;
    font-family:inherit; font-size:24px; font-weight:700; padding:0.4em 0.6em; text-align:center;
  }
  .bet-row input:focus{ outline:none; border-color:#39ff14; }

  /* Chip pads — click a denomination to ADD it onto whatever's already in
     that bet field (real casino chip-stacking, not a replace), X clears
     it to 0. Side-bet ("special") pads render smaller and sit above the
     main bet's big pad, per the ask. */
  .chip-pad{ display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap; }
  .chip-pad.big{ margin-bottom:0.7rem; }
  .chip{
    border-radius:50%; border:2px solid #ffb000; cursor:pointer; font-family:inherit; font-weight:700;
    background:radial-gradient(circle at 35% 30%, rgba(255,176,0,0.28), rgba(10,10,12,0.92));
    color:#ffb000; text-shadow:0 0 5px rgba(255,176,0,0.5);
    display:flex; align-items:center; justify-content:center;
    transition:transform 0.12s ease, box-shadow 0.12s ease;
  }
  .chip:hover{ transform:translateY(-3px); box-shadow:0 5px 12px rgba(255,176,0,0.35); }
  .chip:active{ transform:translateY(0); }
  .chip.clear{ border-color:rgba(232,232,232,0.45); color:rgba(232,232,232,0.75); text-shadow:none; background:radial-gradient(circle at 35% 30%, rgba(232,232,232,0.1), rgba(10,10,12,0.92)); }
  .chip:not(.small){ width:52px; height:52px; font-size:13px; }
  .chip.small{ width:34px; height:34px; font-size:11px; border-width:1.5px; }

  .side-bet-row{ display:flex; gap:1rem; justify-content:center; flex-wrap:wrap; margin-bottom:0.6rem; }
  .side-bet-field{ display:flex; flex-direction:column; align-items:center; gap:0.4rem; border:1px dashed rgba(232,232,232,0.3); padding:0.6em 0.85em; }
  .side-bet-field label{ font-size:12px; letter-spacing:0.05em; color:rgba(232,232,232,0.7); font-weight:600; }
  .side-bet-field input{
    width:78px; background:#0a0a0c; border:2px solid rgba(232,232,232,0.35); color:#e8e8e8;
    font-family:inherit; font-size:17px; font-weight:700; padding:0.3em 0.5em; text-align:center;
  }
  .side-bet-field input:focus{ outline:none; border-color:#3df3ec; }
  .side-bet-result{ text-align:center; font-size:12px; letter-spacing:0.05em; margin-bottom:0.4rem; min-height:1.3em; }
  .side-bet-result .hit{ color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.4); }
  .side-bet-result .miss{ color:rgba(232,232,232,0.35); }
  .btn-row{ display:flex; gap:0.85rem; justify-content:center; flex-wrap:wrap; }
  .gbtn{
    background:transparent; border:1px solid rgba(57,255,20,0.6); color:#39ff14;
    font-family:inherit; font-size:13px; letter-spacing:0.1em; padding:0.6em 1.5em;
    cursor:pointer; text-transform:uppercase; text-shadow:0 0 6px rgba(57,255,20,0.6);
  }
  .gbtn:hover:not(:disabled){ background:rgba(57,255,20,0.12); }
  .gbtn:disabled{ opacity:0.3; cursor:default; }
  .gbtn.secondary{ border-color:rgba(232,232,232,0.4); color:rgba(232,232,232,0.85); text-shadow:none; }
  .gbtn.accent{ border-color:rgba(255,63,208,0.6); color:#ff3fb0; text-shadow:0 0 6px rgba(255,63,208,0.5); }

  /* Side-bet win callout — a brief full-screen flash + bouncing text so a
     Pair/Poker Bonus hit is impossible to miss (reported live: "couldn't
     tell when I'd hit one"). Sits above the table (z-index 250) but below
     the strategy/history modals (300), and never blocks clicks either way. */
  .win-flash{ position:fixed; inset:0; z-index:250; pointer-events:none; display:flex; align-items:center; justify-content:center; opacity:0; }
  .win-flash::before{ content:''; position:absolute; inset:0; background:radial-gradient(circle, rgba(255,176,0,0.4) 0%, rgba(57,255,20,0.18) 40%, transparent 72%); }
  .win-flash span{
    position:relative; font-family:'Chakra Petch',sans-serif; font-size:clamp(26px,5.5vw,52px); font-weight:700;
    letter-spacing:0.08em; text-align:center; color:#ffb000; text-shadow:0 0 20px rgba(255,176,0,0.9), 0 0 44px rgba(255,176,0,0.55);
    text-transform:uppercase;
  }
  .win-flash.play{ animation:winFlashFade 1.3s ease-out; }
  .win-flash.play span{ animation:winFlashText 1.3s cubic-bezier(.34,1.56,.64,1); }
  @keyframes winFlashFade{ 0%{ opacity:0; } 8%{ opacity:1; } 75%{ opacity:1; } 100%{ opacity:0; } }
  @keyframes winFlashText{
    0%{ transform:scale(0.3) rotate(-6deg); }
    20%{ transform:scale(1.2) rotate(2deg); }
    35%{ transform:scale(1) rotate(0deg); }
    85%{ transform:scale(1) rotate(0deg); }
    100%{ transform:scale(1.15) rotate(0deg); }
  }

  @media (max-width:700px){
    .card{ width:74px; height:106px; font-size:29px; }
    .card-art-suit, .card-art-rank{ font-size:15px; }
    .hand-count{ font-size:26px; }
    .balance-chip .bv{ font-size:24px; }
    .chip:not(.small){ width:44px; height:44px; font-size:11px; }
    .chip.small{ width:30px; height:30px; font-size:10px; }
  }
</style>
</head>
<body>
  <canvas id="staticCanvas"></canvas>
  <div class="glow-blob a"></div>
  <div class="glow-blob b"></div>
  <div class="glow-blob c"></div>
  <div class="win-flash" id="winFlash"><span id="winFlashText"></span></div>
  <div class="page" id="pageEl">
    <div class="top-row">
      <div>
        <div class="eyebrow">Σκύλλα://SYSTEM</div>
        <h1>BLACKJACK</h1>
        <a class="back-link" href="/games">&larr; GAMES</a>
        &nbsp;&nbsp;
        <button class="gbtn secondary strategy-btn" id="strategyBtn" style="padding:0.35em 0.9em; font-size:11px;">H0W T0 PLAY</button>
        <button class="gbtn secondary strategy-btn" id="rulesBtn" style="padding:0.35em 0.9em; font-size:11px;">RULES</button>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:0.6rem;">
        <div class="balance-chip">
          <div class="bl">SPENDABLE CR0WN</div>
          <div class="bv" id="balanceValue">···</div>
        </div>
        <button class="session-chip" id="sessionBtn">
          <span class="bl">SESS!0N H!ST0RY</span>
          <span class="sv zero" id="sessionValue">+0</span>
        </button>
      </div>
    </div>

    <div class="marquee-frame">
      <div class="cyber-glow"></div>
      <div class="table">
      <canvas id="tableStaticCanvas"></canvas>
      <div class="hand-block dealer-block" id="dealerBlock" style="display:none;">
        <div class="hand-label-row"><span class="hand-label">DEALER</span></div>
        <div class="hand-count" id="dealerValue">&nbsp;</div>
        <div class="cards" id="dealerCards"></div>
      </div>
      <div class="hands-row" id="playerHandsContainer"></div>
      <div class="shuffle-deck" id="shuffleDeck">
        <div class="sc"></div>
        <div class="sc"></div>
        <div class="sc"></div>
        <div class="shuffle-label">SHUFFL!NG...</div>
      </div>
      </div>
    </div>

    <div class="status-line" id="statusLine"></div>
    <div class="side-bet-result" id="sideBetResult"></div>

    <div class="side-bet-row" id="sideBetRow">
      <div class="side-bet-field">
        <label>PA!R B0NUS</label>
        <input type="number" id="pairBetInput" min="0" step="1" value="0">
        <div class="chip-pad small" id="pairChipPad">
          <button type="button" class="chip small" data-add="5">5</button>
          <button type="button" class="chip small" data-add="10">10</button>
          <button type="button" class="chip small" data-add="25">25</button>
          <button type="button" class="chip small" data-add="50">50</button>
          <button type="button" class="chip small clear" data-clear>X</button>
        </div>
      </div>
      <div class="side-bet-field">
        <label>P0KER B0NUS</label>
        <input type="number" id="pokerBetInput" min="0" step="1" value="0">
        <div class="chip-pad small" id="pokerChipPad">
          <button type="button" class="chip small" data-add="5">5</button>
          <button type="button" class="chip small" data-add="10">10</button>
          <button type="button" class="chip small" data-add="25">25</button>
          <button type="button" class="chip small" data-add="50">50</button>
          <button type="button" class="chip small clear" data-clear>X</button>
        </div>
      </div>
    </div>

    <div class="bet-row" id="betRow">
      <span class="bet-row-label">BET</span>
      <input type="number" id="betInput" min="1" step="1" value="10">
      <button class="gbtn" id="dealBtn">DEAL</button>
    </div>
    <div class="chip-pad big" id="betChipPad">
      <button type="button" class="chip" data-add="5">5</button>
      <button type="button" class="chip" data-add="10">10</button>
      <button type="button" class="chip" data-add="25">25</button>
      <button type="button" class="chip" data-add="50">50</button>
      <button type="button" class="chip" data-add="100">100</button>
      <button type="button" class="chip" data-add="250">250</button>
      <button type="button" class="chip clear" data-clear>X</button>
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
  </div>

  <div class="modal-overlay" id="historyOverlay">
    <div class="modal-box">
      <div class="modal-header">
        <span>SESS!0N H!ST0RY</span>
        <button class="modal-close-btn" id="historyCloseBtn">✕</button>
      </div>
      <p class="modal-note">Running net for every hand played this session (clears on reload) — includes side bets.</p>
      <div class="history-empty" id="historyEmpty">N0 HANDS PLAYED YET</div>
      <div class="history-list" id="historyList"></div>
    </div>
  </div>

  <div class="modal-overlay" id="strategyOverlay">
    <div class="modal-box">
      <div class="modal-header">
        <span>BAS!C STRATEGY</span>
        <button class="modal-close-btn" id="strategyCloseBtn">✕</button>
      </div>
      <p class="modal-note">6-deck shoe · dealer stands on all 17s · double after split allowed · no surrender. Rows are your hand, columns are the dealer's up card.</p>
      <div class="strat-legend">
        <b class="strat-hit">H</b>H!T &nbsp;
        <b class="strat-stand">S</b>STAND &nbsp;
        <b class="strat-double">D</b>D0UBLE (H!T !F Y0U CAN'T) &nbsp;
        <b class="strat-double">Ds</b>D0UBLE (STAND !F Y0U CAN'T) &nbsp;
        <b class="strat-split">P</b>SPL!T
      </div>
      <div id="strategyBody"></div>
    </div>
  </div>

  <div class="modal-overlay" id="rulesOverlay">
    <div class="modal-box">
      <div class="modal-header">
        <span>RULES</span>
        <button class="modal-close-btn" id="rulesCloseBtn">✕</button>
      </div>
      <div class="strat-section-title">THE TABLE</div>
      <ul class="rules-list">
        <li>6-deck shoe, freshly built and reshuffled every hand.</li>
        <li>Dealer stands on all 17s (soft 17 included).</li>
        <li>Blackjack (a natural 21 on the first two cards) pays 3:2.</li>
        <li>Double down on your first two cards, on any hand — including after a split.</li>
        <li>Split any matching pair, once per round (no resplitting).</li>
        <li>Splitting Aces deals exactly one card to each hand, then both are done — no further hits or doubles on either.</li>
        <li>This Crown balance is a closed-test in-house wager balance — separate from the real $CRWN token, no withdrawal path.</li>
      </ul>
      <div class="strat-section-title">PA!R B0NUS</div>
      <p class="modal-note">Wagered separately at deal time, settled instantly off your own opening two cards — wins or loses independent of how the main hand plays out.</p>
      <table class="strat-table">
        <thead><tr><th style="text-align:left;">RESULT</th><th>PAYS</th></tr></thead>
        <tbody>
          <tr><th style="text-align:left;">M!XED PA!R — same rank, different colour</th><td>5:1</td></tr>
          <tr><th style="text-align:left;">C0L0RED PA!R — same rank, same colour, different suit</th><td>10:1</td></tr>
          <tr><th style="text-align:left;">PERFECT PA!R — same rank AND suit</th><td>30:1</td></tr>
        </tbody>
      </table>
      <div class="strat-section-title">P0KER B0NUS</div>
      <p class="modal-note">Your opening two cards plus the dealer's up card, read as a 3-card poker hand — also settled instantly at deal time, independent of the main hand. A-2-3 and Q-K-A both count as straights.</p>
      <table class="strat-table">
        <thead><tr><th style="text-align:left;">RESULT</th><th>PAYS</th></tr></thead>
        <tbody>
          <tr><th style="text-align:left;">FLUSH — 3 cards, same suit</th><td>5:1</td></tr>
          <tr><th style="text-align:left;">STRA!GHT — 3 cards in sequence</th><td>10:1</td></tr>
          <tr><th style="text-align:left;">TR!PS — 3 of a kind</th><td>30:1</td></tr>
          <tr><th style="text-align:left;">STRA!GHT FLUSH</th><td>40:1</td></tr>
          <tr><th style="text-align:left;">SU!TED TR!PS — 3 of a kind, same suit</th><td>100:1</td></tr>
        </tbody>
      </table>
    </div>
  </div>

<script>
(function(){
  // Same "glitch" static — sparse cyan/magenta flecks on black — reused
  // for both the full-page ambient canvas and a second copy scoped to
  // just the table (sized to that element's own box, not the viewport).
  function startStaticCanvas(canvasEl, getSize){
    if (!canvasEl) return;
    function size(){ var s = getSize(); canvasEl.width = s.w; canvasEl.height = s.h; }
    size();
    window.addEventListener('resize', size);
    var ctx = canvasEl.getContext('2d');
    function frame(){
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      var flecks = Math.floor((canvasEl.width * canvasEl.height) / 9000);
      for (var i = 0; i < flecks; i++) {
        var x = Math.random() * canvasEl.width, y = Math.random() * canvasEl.height;
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(61,243,236,0.55)' : 'rgba(255,63,208,0.5)';
        ctx.fillRect(x, y, 1, 1);
      }
      requestAnimationFrame(frame);
    }
    frame();
  }
  startStaticCanvas(document.getElementById('staticCanvas'), function(){
    return { w: window.innerWidth, h: window.innerHeight };
  });
  startStaticCanvas(document.getElementById('tableStaticCanvas'), function(){
    var r = document.querySelector('.table').getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  });

  var el = {};
  ['balanceValue','dealerValue','dealerCards','playerHandsContainer','statusLine',
   'betRow','betInput','dealBtn','actionRow','hitBtn','standBtn','doubleBtn','splitBtn','againRow','againBtn',
   'sideBetRow','pairBetInput','pokerBetInput','sideBetResult',
   'strategyBtn','strategyOverlay','strategyCloseBtn','strategyBody',
   'rulesBtn','rulesOverlay','rulesCloseBtn',
   'sessionBtn','sessionValue','historyOverlay','historyCloseBtn','historyEmpty','historyList',
   'shuffleDeck','dealerBlock','pageEl','winFlash','winFlashText'
  ].forEach(function(id){ el[id] = document.getElementById(id); });

  function setInHand(active){
    el.pageEl.classList.toggle('in-hand', active);
  }

  // Chip pads — a chip button ADDS its value onto whatever's already
  // typed into that bet field (real casino chip-stacking), clamped to the
  // input's own max (set once the real maxBet is known in init() below);
  // the X chip clears it back to 0. Same wiring for the big main-bet pad
  // and both smaller side-bet pads.
  function wireChipPad(padId, inputEl){
    var pad = document.getElementById(padId);
    if (!pad || !inputEl) return;
    pad.addEventListener('click', function(e){
      var btn = e.target.closest('.chip');
      if (!btn) return;
      if (btn.hasAttribute('data-clear')) {
        inputEl.value = 0;
        return;
      }
      var add = parseInt(btn.getAttribute('data-add'), 10) || 0;
      var current = parseInt(inputEl.value, 10) || 0;
      var max = parseInt(inputEl.max, 10);
      var next = current + add;
      if (Number.isFinite(max) && max > 0) next = Math.min(next, max);
      inputEl.value = next;
    });
  }
  wireChipPad('betChipPad', el.betInput);
  wireChipPad('pairChipPad', el.pairBetInput);
  wireChipPad('pokerChipPad', el.pokerBetInput);

  var SUIT_SYM = { S: '\\u2660', H: '\\u2665', D: '\\u2666', C: '\\u2663' };
  // Diamonds cyan, hearts red, clubs green, spades "black" — spades uses
  // a near-white instead of literal black since true black would be
  // invisible against the card's own dark background.
  var SUIT_COLOR = { D: '#3df3ec', H: '#ff3b3b', C: '#39ff14', S: '#f2f2f2' };
  // Custom face art — drop an image URL in here once it exists (e.g.
  // J: '/assets/cards/jester.png') and that rank starts rendering with
  // the image instead of plain rank+suit text, everywhere it appears, no
  // other change needed. Leave a rank null/absent to keep the plain look.
  var CARD_ART = {
    J: '/assets/cards/jester.png', // Jester
    A: '/assets/cards/phoenix.png', // Phoenix
    K: '/assets/cards/king.png', // The King
    Q: '/assets/cards/queen.png' // The Queen
  };
  function cardEl(card, hidden){
    var d = document.createElement('div');
    if (hidden) { d.className = 'card hidden'; d.textContent = '?'; return d; }
    var rank = card.slice(0, -1);
    var suit = card.slice(-1);
    var color = SUIT_COLOR[suit];
    d.className = 'card';
    d.style.borderColor = color;
    d.style.boxShadow = '0 0 8px ' + color + '66';
    var art = CARD_ART[rank];
    if (art) {
      var img = document.createElement('img');
      img.className = 'card-art';
      img.src = art;
      img.alt = rank;
      d.appendChild(img);
      var rankBadge = document.createElement('span');
      rankBadge.className = 'card-art-rank';
      rankBadge.textContent = rank;
      d.appendChild(rankBadge);
      var badge = document.createElement('span');
      badge.className = 'card-art-suit';
      badge.textContent = SUIT_SYM[suit];
      badge.style.color = color;
      d.appendChild(badge);
    } else {
      d.style.color = color;
      d.textContent = rank + SUIT_SYM[suit];
    }
    return d;
  }
  function setStatus(text, cls){
    el.statusLine.textContent = text || '';
    el.statusLine.className = 'status-line' + (cls ? ' ' + cls : '');
  }

  // --- Basic strategy reference — pure static data/markup, never touches
  // game state, openable any time including mid-hand (never added to
  // setButtonsBusy's disable list below). 6-deck / dealer-stands-all-17s /
  // double-after-split / no-surrender chart, the exact ruleset this game
  // actually runs.
  var STRAT_COLS = ['2','3','4','5','6','7','8','9','10','A'];
  var STRAT_HARD = [
    ['17+','S','S','S','S','S','S','S','S','S','S'],
    ['16','S','S','S','S','S','H','H','H','H','H'],
    ['15','S','S','S','S','S','H','H','H','H','H'],
    ['14','S','S','S','S','S','H','H','H','H','H'],
    ['13','S','S','S','S','S','H','H','H','H','H'],
    ['12','H','H','S','S','S','H','H','H','H','H'],
    ['11','D','D','D','D','D','D','D','D','D','H'],
    ['10','D','D','D','D','D','D','D','D','H','H'],
    ['9','H','D','D','D','D','H','H','H','H','H'],
    ['8 0R LESS','H','H','H','H','H','H','H','H','H','H']
  ];
  var STRAT_SOFT = [
    ['A,9 (S0FT 20)','S','S','S','S','S','S','S','S','S','S'],
    ['A,8 (S0FT 19)','S','S','S','S','S','S','S','S','S','S'],
    ['A,7 (S0FT 18)','S','Ds','Ds','Ds','Ds','S','S','H','H','H'],
    ['A,6 (S0FT 17)','H','D','D','D','D','H','H','H','H','H'],
    ['A,5 (S0FT 16)','H','H','D','D','D','H','H','H','H','H'],
    ['A,4 (S0FT 15)','H','H','D','D','D','H','H','H','H','H'],
    ['A,3 (S0FT 14)','H','H','H','D','D','H','H','H','H','H'],
    ['A,2 (S0FT 13)','H','H','H','D','D','H','H','H','H','H']
  ];
  var STRAT_PAIRS = [
    ['A,A','P','P','P','P','P','P','P','P','P','P'],
    ['10,10','S','S','S','S','S','S','S','S','S','S'],
    ['9,9','P','P','P','P','P','S','P','P','S','S'],
    ['8,8','P','P','P','P','P','P','P','P','P','P'],
    ['7,7','P','P','P','P','P','P','H','H','H','H'],
    ['6,6','P','P','P','P','P','H','H','H','H','H'],
    ['5,5','D','D','D','D','D','D','D','D','H','H'],
    ['4,4','H','H','H','P','P','H','H','H','H','H'],
    ['3,3','P','P','P','P','P','P','H','H','H','H'],
    ['2,2','P','P','P','P','P','P','H','H','H','H']
  ];
  var STRAT_CLASS = { H: 'strat-hit', S: 'strat-stand', D: 'strat-double', Ds: 'strat-double', P: 'strat-split' };
  function buildStrategyTable(title, rows){
    var html = '<div class="strat-section-title">' + title + '</div><table class="strat-table"><thead><tr><th></th>';
    STRAT_COLS.forEach(function(c){ html += '<th>' + c + '</th>'; });
    html += '</tr></thead><tbody>';
    rows.forEach(function(row){
      html += '<tr><th>' + row[0] + '</th>';
      for (var i = 1; i < row.length; i++) {
        html += '<td class="' + STRAT_CLASS[row[i]] + '">' + row[i] + '</td>';
      }
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }
  el.strategyBody.innerHTML =
    buildStrategyTable('HARD T0TALS', STRAT_HARD) +
    buildStrategyTable('S0FT T0TALS (ACE C0UNTS AS 11)', STRAT_SOFT) +
    buildStrategyTable('PA!RS', STRAT_PAIRS);
  function openStrategy(){ el.strategyOverlay.classList.add('open'); }
  function closeStrategy(){ el.strategyOverlay.classList.remove('open'); }
  el.strategyBtn.addEventListener('click', openStrategy);
  el.strategyCloseBtn.addEventListener('click', closeStrategy);
  el.strategyOverlay.addEventListener('click', function(e){ if (e.target === el.strategyOverlay) closeStrategy(); });

  function openHistory(){ el.historyOverlay.classList.add('open'); }
  function closeHistory(){ el.historyOverlay.classList.remove('open'); }
  el.sessionBtn.addEventListener('click', openHistory);
  el.historyCloseBtn.addEventListener('click', closeHistory);
  el.historyOverlay.addEventListener('click', function(e){ if (e.target === el.historyOverlay) closeHistory(); });

  function openRules(){ el.rulesOverlay.classList.add('open'); }
  function closeRules(){ el.rulesOverlay.classList.remove('open'); }
  el.rulesBtn.addEventListener('click', openRules);
  el.rulesCloseBtn.addEventListener('click', closeRules);
  el.rulesOverlay.addEventListener('click', function(e){ if (e.target === el.rulesOverlay) closeRules(); });

  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') { closeStrategy(); closeHistory(); closeRules(); } });

  // --- Session hand history + running net — in-memory only (clears on
  // reload), purely a client-side log of what actually happened; never
  // fed back into any game decision. Capped at the most recent 50 rows.
  // sessionNet includes both main-hand results AND side bets, updated the
  // moment each is actually known (side bets settle at deal time, well
  // before the main hand might resolve).
  var handHistory = [];
  var handCounter = 0;
  var sessionNet = 0;
  function updateSessionChip(){
    var cls = sessionNet > 0 ? 'pos' : sessionNet < 0 ? 'neg' : 'zero';
    var sign = sessionNet > 0 ? '+' : '';
    el.sessionValue.textContent = sign + sessionNet;
    el.sessionValue.className = 'sv ' + cls;
  }
  function addSessionNet(delta){
    if (!delta) return;
    sessionNet += delta;
    updateSessionChip();
  }
  function renderHistory(){
    if (!handHistory.length) { el.historyEmpty.style.display = 'block'; el.historyList.innerHTML = ''; return; }
    el.historyEmpty.style.display = 'none';
    el.historyList.innerHTML = handHistory.slice(0, 50).map(function(h){
      var cls = h.net > 0 ? 'hist-win' : h.net < 0 ? 'hist-lose' : 'hist-push';
      var sign = h.net > 0 ? '+' : '';
      var label = { blackjack: 'BLACKJACK', win: 'W!N', push: 'PUSH', lose: 'L0SE' }[h.result];
      return '<div class="hist-row ' + cls + '"><div class="hist-row-top"><span>#' + h.id + '</span><span>' + label + '</span><span>' + sign + h.net + '</span></div>' +
        '<div class="hist-row-sub">Y0U ' + h.playerValue + ' vs DEALER ' + h.dealerValue + ' \\u00b7 BET ' + h.bet + '</div></div>';
    }).join('');
  }
  function recordHistory(round){
    handCounter++;
    var multi = round.hands.length > 1;
    round.hands.forEach(function(h, i){
      var net = h.result === 'blackjack' ? Math.floor(h.bet * 1.5) : h.result === 'win' ? h.bet : h.result === 'push' ? 0 : -h.bet;
      handHistory.unshift({
        id: handCounter + (multi ? String.fromCharCode(97 + i) : ''),
        bet: h.bet,
        playerValue: h.value,
        dealerValue: round.dealerValue,
        result: h.result,
        net: net
      });
      addSessionNet(net);
    });
    renderHistory();
  }
  function sideBetNet(entry){
    if (!entry) return 0;
    return entry.payout > 0 ? entry.payout - entry.bet : -entry.bet;
  }
  function recordSideBetNet(sideBets){
    if (!sideBets) return;
    addSessionNet(sideBetNet(sideBets.pair) + sideBetNet(sideBets.poker));
  }

  function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  var CARD_DELAY = 420;

  // Cosmetic only — purely so the count above a hand can climb as each
  // card visually lands instead of jumping straight to the server's final
  // number. Never used for any decision (buttons stay gated on the
  // server's own canDouble/canSplit flags, and every payout/outcome comes
  // from round.result, not from this). Same arithmetic as
  // blackjackHandValue in _shared.js.
  function handValueClient(cards){
    var total = 0, aces = 0;
    cards.forEach(function(c){
      var r = c.slice(0, -1);
      if (r === 'A') { aces++; total += 11; }
      else if (r === 'K' || r === 'Q' || r === 'J') total += 10;
      else total += parseInt(r, 10);
    });
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  function updateCount(countEl, value, bust){
    if (value === null || value === undefined) { countEl.innerHTML = '&nbsp;'; countEl.className = 'hand-count'; return; }
    countEl.textContent = bust ? value + ' BUST' : value;
    countEl.className = 'hand-count' + (bust ? ' bust' : '');
  }

  // Drops one card into a cards row with the deal animation, pausing
  // afterward — the actual pacing of "the hand being played out" rather
  // than everything appearing at once.
  async function dealInto(cardsEl, card, hidden){
    var c = cardEl(card, hidden);
    c.classList.add('card-deal');
    cardsEl.appendChild(c);
    await sleep(CARD_DELAY);
    return c;
  }

  function buildHandBlock(labelText, bet){
    var block = document.createElement('div');
    block.className = 'hand-block';
    var labelRow = document.createElement('div');
    labelRow.className = 'hand-label-row';
    var label = document.createElement('span');
    label.className = 'hand-label';
    label.textContent = labelText;
    var betTag = document.createElement('span');
    betTag.className = 'bet-tag';
    betTag.textContent = 'BET ' + bet;
    label.appendChild(betTag);
    labelRow.appendChild(label);
    block.appendChild(labelRow);
    var count = document.createElement('div');
    count.className = 'hand-count';
    count.innerHTML = '&nbsp;';
    block.appendChild(count);
    var cardsDiv = document.createElement('div');
    cardsDiv.className = 'cards';
    block.appendChild(cardsDiv);
    return { block: block, label: label, count: count, cards: cardsDiv };
  }

  function applyActiveHighlight(index){
    handRefs.forEach(function(ref, i){ ref.block.classList.toggle('active-hand', i === index); });
  }

  // Hole card's flip-reveal: the hidden placeholder scales out, the real
  // card scales in — a small beat of drama for the one moment blackjack
  // actually has (Insurance aside, which this doesn't implement).
  async function flipRevealDealerHole(realCard){
    var hiddenEl = el.dealerCards.children[1];
    if (!hiddenEl) return;
    hiddenEl.classList.add('card-flip-out');
    await sleep(160);
    var real = cardEl(realCard, false);
    real.classList.add('card-flip-in');
    el.dealerCards.replaceChild(real, hiddenEl);
    await sleep(200);
  }

  // Reveals the dealer's hole card, then deals out any further draws one
  // at a time — this is the exact sequence that used to just dump the
  // whole final dealer hand in one instant paint.
  async function playDealerReveal(round){
    await flipRevealDealerHole(round.dealer[1]);
    updateCount(el.dealerValue, handValueClient(round.dealer.slice(0, 2)));
    for (var i = 2; i < round.dealer.length; i++) {
      await dealInto(el.dealerCards, round.dealer[i], false);
      updateCount(el.dealerValue, handValueClient(round.dealer.slice(0, i + 1)));
    }
    updateCount(el.dealerValue, round.dealerValue); // authoritative final value
    await sleep(200);
  }

  function finishResolved(round){
    round.hands.forEach(function(h, i){
      if (handRefs[i]) updateCount(handRefs[i].count, h.value, h.status === 'bust');
    });
    handRefs.forEach(function(ref){ ref.block.classList.remove('active-hand'); });
    el.actionRow.style.display = 'none';
    el.betRow.style.display = 'none';
    el.sideBetRow.style.display = 'none';
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
    recordHistory(round);
  }

  // Called once a hand stops being playable (bust, stood, or a forced-done
  // double) — either the next split hand takes over, or the round is
  // resolved and the dealer's own turn plays out.
  async function afterHandFinished(round){
    currentRound = round;
    if (round.status === 'active') {
      applyActiveHighlight(round.activeHandIndex);
      setStatus('YOUR M0VE — HAND ' + (round.activeHandIndex + 1), '');
      el.doubleBtn.disabled = !round.canDouble;
      el.splitBtn.disabled = true;
      el.splitBtn.style.display = 'none';
    } else {
      await sleep(200);
      await playDealerReveal(round);
      finishResolved(round);
    }
  }

  // Restarts the flash/bounce animation even on a repeat trigger (two
  // side-bet hits back to back would otherwise silently no-op the second
  // time — a class that's already applied doesn't retrigger a CSS
  // animation without a reflow in between).
  function flashWin(text){
    el.winFlashText.textContent = text;
    el.winFlash.classList.remove('play');
    void el.winFlash.offsetWidth;
    el.winFlash.classList.add('play');
  }

  function describeSideBets(sideBets){
    if (!sideBets) { el.sideBetResult.innerHTML = ''; return; }
    var tierLabels = {
      perfect: 'PERFECT PA!R', colored: 'C0L0RED PA!R', mixed: 'M!XED PA!R',
      suitedTrips: 'SU!TED TR!PS', straightFlush: 'STRA!GHT FLUSH', trips: 'TR!PS', straight: 'STRA!GHT', flush: 'FLUSH'
    };
    var parts = [];
    var wins = [];
    if (sideBets.pair) {
      if (sideBets.pair.payout > 0) {
        parts.push('<span class="hit">PA!R B0NUS: ' + tierLabels[sideBets.pair.tier] + ' — W0N ' + sideBets.pair.payout + '</span>');
        wins.push(tierLabels[sideBets.pair.tier] + '! +' + sideBets.pair.payout);
      } else {
        parts.push('<span class="miss">PA!R B0NUS: N0 H!T</span>');
      }
    }
    if (sideBets.poker) {
      if (sideBets.poker.payout > 0) {
        parts.push('<span class="hit">P0KER B0NUS: ' + tierLabels[sideBets.poker.tier] + ' — W0N ' + sideBets.poker.payout + '</span>');
        wins.push(tierLabels[sideBets.poker.tier] + '! +' + sideBets.poker.payout);
      } else {
        parts.push('<span class="miss">P0KER B0NUS: N0 H!T</span>');
      }
    }
    el.sideBetResult.innerHTML = parts.join(' &nbsp;·&nbsp; ');
    if (wins.length) flashWin(wins.join(' + '));
  }

  async function sequenceDeal(round, sideBets){
    setInHand(true);
    // Shuffle burst — the idle deck (already visible on the betting
    // screen) speeds up for a beat before the table actually clears and
    // dealing starts, so "shuffling" reads as one continuous motion
    // rather than an idle animation just vanishing.
    el.shuffleDeck.classList.add('active');
    await sleep(650);
    el.shuffleDeck.classList.remove('active');
    el.shuffleDeck.style.display = 'none';
    el.dealerBlock.style.display = 'block';

    el.dealerCards.innerHTML = '';
    updateCount(el.dealerValue, null);
    el.playerHandsContainer.innerHTML = '';
    describeSideBets(null);
    var hb = buildHandBlock('Y0U', round.hands[0].bet);
    el.playerHandsContainer.appendChild(hb.block);
    handRefs = [hb];

    var playerCards = round.hands[0].cards;
    var dealerFirst = round.status === 'active' ? round.dealerUp : round.dealer[0];

    // Classic dealing order: player, dealer, player, dealer(hidden). Extra
    // pause after the dealer's own card specifically (reported live: felt
    // "way too fast" right there) so it actually registers before the
    // next card lands.
    await dealInto(hb.cards, playerCards[0], false);
    updateCount(hb.count, handValueClient([playerCards[0]]));
    await dealInto(el.dealerCards, dealerFirst, false);
    await sleep(280);
    await dealInto(hb.cards, playerCards[1], false);
    updateCount(hb.count, handValueClient(playerCards));
    // Both player cards and the dealer's up card are down — side bets are
    // fully determined now, safe to reveal their result.
    describeSideBets(sideBets);
    recordSideBetNet(sideBets);
    await dealInto(el.dealerCards, null, true);

    currentRound = round;
    if (round.status === 'active') {
      applyActiveHighlight(0);
      el.betRow.style.display = 'none';
      el.sideBetRow.style.display = 'none';
      el.actionRow.style.display = 'flex';
      el.againRow.style.display = 'none';
      el.doubleBtn.disabled = !round.canDouble;
      el.splitBtn.disabled = !round.canSplit;
      el.splitBtn.style.display = 'inline-block';
      setStatus('YOUR M0VE', '');
    } else {
      // Natural blackjack (player and/or dealer) — dealer's 2 starting
      // cards are already final, no extra draws.
      await sleep(300);
      await playDealerReveal(round);
      finishResolved(round);
    }
  }

  async function sequenceHitOrDouble(actingIndex, round){
    var ref = handRefs[actingIndex];
    var hand = round.hands[actingIndex];
    var newCard = hand.cards[hand.cards.length - 1];
    await dealInto(ref.cards, newCard, false);
    updateCount(ref.count, hand.value, hand.status === 'bust');
    var betTag = ref.label.querySelector('.bet-tag');
    if (betTag) betTag.textContent = 'BET ' + hand.bet;
    currentRound = round;
    if (round.status !== 'active' || round.activeHandIndex !== actingIndex) {
      await afterHandFinished(round);
    }
  }

  async function sequenceStand(round){
    await afterHandFinished(round);
  }

  async function sequenceSplit(round){
    el.playerHandsContainer.innerHTML = '';
    handRefs = round.hands.map(function(hand, i){
      var hb = buildHandBlock('HAND ' + (i + 1), hand.bet);
      el.playerHandsContainer.appendChild(hb.block);
      // The first card in each new hand is half of the original pair —
      // it already existed, so it snaps into place instead of animating.
      hb.cards.appendChild(cardEl(hand.cards[0], false));
      updateCount(hb.count, handValueClient([hand.cards[0]]));
      return hb;
    });
    // Only the genuinely new second card deals in with the normal pacing.
    for (var i = 0; i < round.hands.length; i++) {
      var hand = round.hands[i];
      await dealInto(handRefs[i].cards, hand.cards[1], false);
      updateCount(handRefs[i].count, hand.value, hand.status === 'bust');
    }
    currentRound = round;
    if (round.status === 'active') {
      applyActiveHighlight(round.activeHandIndex);
      el.betRow.style.display = 'none';
      el.sideBetRow.style.display = 'none';
      el.actionRow.style.display = 'flex';
      el.againRow.style.display = 'none';
      el.doubleBtn.disabled = !round.canDouble;
      el.splitBtn.disabled = true;
      el.splitBtn.style.display = 'none';
      setStatus('YOUR M0VE — HAND ' + (round.activeHandIndex + 1), '');
    } else {
      // Split Aces — both hands were already done the instant they were dealt.
      await sleep(250);
      await playDealerReveal(round);
      finishResolved(round);
    }
  }

  function renderInstant(round){
    setInHand(true);
    el.shuffleDeck.style.display = 'none';
    el.dealerBlock.style.display = 'block';
    el.dealerCards.innerHTML = '';
    el.dealerCards.appendChild(cardEl(round.dealerUp, false));
    el.dealerCards.appendChild(cardEl(null, true));
    updateCount(el.dealerValue, null);
    el.playerHandsContainer.innerHTML = '';
    var multi = round.hands.length > 1;
    handRefs = round.hands.map(function(hand, i){
      var hb = buildHandBlock(multi ? 'HAND ' + (i + 1) : 'Y0U', hand.bet);
      hand.cards.forEach(function(c){ hb.cards.appendChild(cardEl(c, false)); });
      updateCount(hb.count, hand.value, hand.status === 'bust');
      el.playerHandsContainer.appendChild(hb.block);
      return hb;
    });
    applyActiveHighlight(round.activeHandIndex);
    currentRound = round;
    el.betRow.style.display = 'none';
    el.sideBetRow.style.display = 'none';
    el.actionRow.style.display = 'flex';
    el.againRow.style.display = 'none';
    el.doubleBtn.disabled = !round.canDouble;
    el.splitBtn.disabled = !round.canSplit;
    el.splitBtn.style.display = round.hands.length === 1 ? 'inline-block' : 'none';
    setStatus('R0UND RESUMED — ' + (multi ? 'HAND ' + (round.activeHandIndex + 1) : 'YOUR M0VE'), '');
  }

  function resetToBetting(){
    setInHand(false);
    el.shuffleDeck.style.display = 'flex';
    el.dealerBlock.style.display = 'none';
    el.dealerCards.innerHTML = '';
    updateCount(el.dealerValue, null);
    el.playerHandsContainer.innerHTML = '';
    handRefs = [];
    currentRound = null;
    el.betRow.style.display = 'flex';
    el.sideBetRow.style.display = 'flex';
    el.actionRow.style.display = 'none';
    el.againRow.style.display = 'none';
    describeSideBets(null);
    setStatus('', '');
  }

  var handRefs = [];
  var currentRound = null;
  var uiBusy = false;

  function setButtonsBusy(isBusy){
    [el.dealBtn, el.hitBtn, el.standBtn, el.doubleBtn, el.splitBtn, el.againBtn].forEach(function(b){ b.disabled = isBusy; });
  }

  async function postAction(payload){
    var res = await fetch('/api/blackjack-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.error || 'unknown');
    el.balanceValue.textContent = data.balance;
    return data;
  }

  // Buttons stay disabled for the full animated sequence, not just the
  // network round-trip — otherwise a fast second click could fire mid-deal.
  async function runAction(fn){
    if (uiBusy) return;
    uiBusy = true;
    setButtonsBusy(true);
    try {
      await fn();
    } catch (e) {
      setStatus('ERR:: ' + String((e && e.message) || e).toUpperCase().replace(/_/g, ' '), 'err');
    } finally {
      uiBusy = false;
      setButtonsBusy(false);
      if (currentRound && currentRound.status === 'active') {
        el.doubleBtn.disabled = !currentRound.canDouble;
        el.splitBtn.disabled = !currentRound.canSplit;
      }
    }
  }

  el.dealBtn.addEventListener('click', function(){
    runAction(async function(){
      var bet = parseInt(el.betInput.value, 10);
      if (!bet || bet < 1) { setStatus('ENTER A VAL!D BET', 'err'); return; }
      var pairBet = parseInt(el.pairBetInput.value, 10) || 0;
      var pokerBet = parseInt(el.pokerBetInput.value, 10) || 0;
      var data = await postAction({ action: 'deal', bet: bet, pairBet: pairBet, pokerBet: pokerBet });
      await sequenceDeal(data.round, data.sideBets);
    });
  });
  el.hitBtn.addEventListener('click', function(){
    runAction(async function(){
      var actingIndex = currentRound.activeHandIndex;
      var data = await postAction({ action: 'hit' });
      await sequenceHitOrDouble(actingIndex, data.round);
    });
  });
  el.standBtn.addEventListener('click', function(){
    runAction(async function(){
      var data = await postAction({ action: 'stand' });
      await sequenceStand(data.round);
    });
  });
  el.doubleBtn.addEventListener('click', function(){
    runAction(async function(){
      var actingIndex = currentRound.activeHandIndex;
      var data = await postAction({ action: 'double' });
      await sequenceHitOrDouble(actingIndex, data.round);
    });
  });
  el.splitBtn.addEventListener('click', function(){
    runAction(async function(){
      var data = await postAction({ action: 'split' });
      await sequenceSplit(data.round);
    });
  });
  el.againBtn.addEventListener('click', function(){
    resetToBetting();
  });

  (async function init(){
    try {
      var res = await fetch('/api/crown-balance');
      var data = await res.json();
      if (data.ok) {
        el.balanceValue.textContent = data.balance;
        el.betInput.max = data.maxBet;
        el.pairBetInput.max = data.maxBet;
        el.pokerBetInput.max = data.maxBet;
        if (data.round && data.round.status === 'active') {
          renderInstant(data.round);
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
