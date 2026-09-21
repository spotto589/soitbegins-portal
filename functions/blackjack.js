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
  /* Full screen toggle — bottom-right, out of the way of everything else,
     for anyone whose viewport is too short to see the whole table at once. */
  .fullscreen-btn{
    position:fixed; right:1.2rem; bottom:1.2rem; z-index:200;
    width:42px; height:42px; border-radius:50%; cursor:pointer;
    background:rgba(10,10,12,0.85); border:1px solid rgba(61,243,236,0.5); color:#3df3ec;
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 0 10px rgba(61,243,236,0.25); transition:border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .fullscreen-btn:hover{ border-color:#3df3ec; box-shadow:0 0 16px rgba(61,243,236,0.5); }
  .fullscreen-btn svg{ width:20px; height:20px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
  /* Wide — the table is meant to fill the page, not sit as a small boxed
     card in the middle of the starfield. */
  .page{ max-width:1500px; width:96vw; position:relative; z-index:1; margin:0 auto; }

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
  /* Same chase, nested one level deeper, directly on .table's own edge —
     "the border of the table" specifically, per feedback, kept alongside
     the outer marquee-frame ring rather than replacing it. */
  .table-border{ position:relative; padding:2px; border-radius:6px; overflow:hidden; }
  .table{
    /* Deliberately neutral, not green — per feedback the green ring here
       clashed, while the cyan/pink chase (marquee-frame/table-border
       above) is the accent that should carry the colour. */
    border:1px solid rgba(0,0,0,0.85); padding:1.5rem 2.2rem 1.8rem;
    /* Auto height, no scroll — the box should never scroll internally; it
       just grows/shrinks with whatever's actually showing (page-level
       scroll if the viewport's short is fine, an inner scrollbar isn't). */
    display:flex; flex-direction:column;
    /* Needs to be near-opaque, not just tinted — a transparent background
       doesn't block the chase glow behind it regardless of paint order,
       so a mostly-see-through fill let both cyber-glow rings bleed across
       the whole table interior instead of staying a thin border ring
       (reported live as "swirling in the middle of the cards"). */
    background:#0a0a0c; position:relative; z-index:1;
    box-shadow:0 0 20px rgba(0,0,0,0.6);
    /* Faint HUD grid — the "playing inside a system" texture behind the
       static flecks, not just a flat dark panel. */
    background-image:
      linear-gradient(rgba(61,243,236,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(61,243,236,0.05) 1px, transparent 1px);
    background-size:28px 28px;
  }
  /* The whole betting console + hands now live inside this one growing
     box, so its static canvas must resize with it — done via a
     ResizeObserver in the client script (not just window resize), which
     is what actually fixes the old "black box cutoff" when a hand starts
     or the table grows taller than its initial size. */
  #tableStaticCanvas{ position:absolute; inset:0; z-index:-1; opacity:0.85; pointer-events:none; }
  /* One group per funded box, each with its own "BOX N" header and a
     hands-row underneath (normally 1 hand, 2 if that box split). */
  .player-boxes{ display:flex; gap:3rem; flex-wrap:wrap; justify-content:center; }
  .box-group-label{ font-size:11px; letter-spacing:0.25em; color:rgba(61,243,236,0.7); text-align:center; margin-bottom:0.3rem; }
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
  /* Sized for up to 3 boxes sharing the row now, not just one hand taking
     the full width. */
  .hand-block{ margin-bottom:0.4rem; flex:1 1 230px; min-width:230px; text-align:center; }
  .box-group{ display:flex; flex-direction:column; align-items:center; border-radius:12px; padding:0.5rem 0.7rem; transition:box-shadow 0.2s ease, background 0.2s ease; }
  /* Whichever box you're currently deciding on — obvious at a glance,
     not just a colour change on the label text. */
  .box-group.active-group{
    background:rgba(61,243,236,0.05);
    box-shadow:0 0 0 1px rgba(61,243,236,0.5), 0 0 22px rgba(61,243,236,0.3);
  }
  .box-group.active-group .box-group-label{ color:#3df3ec; text-shadow:0 0 6px rgba(61,243,236,0.6); }
  .hand-block.dealer-block{ flex-basis:100%; }
  .hand-label-row{ display:flex; align-items:center; justify-content:center; margin-bottom:0.3rem; }
  .hand-label{ font-size:14px; letter-spacing:0.2em; color:rgba(232,232,232,0.6); }
  /* Split hands only — which one is currently live, without the old
     dashed-outline "box" around it. */
  .hand-block.active-hand .hand-label{ color:#3df3ec; text-shadow:0 0 6px rgba(61,243,236,0.6); }
  .hand-label .bet-tag{ font-size:15px; font-weight:700; color:#ffb000; margin-left:0.6em; letter-spacing:0.08em; text-shadow:0 0 6px rgba(255,176,0,0.4); }
  .hand-count{ font-size:32px; line-height:1; font-weight:700; color:#39ff14; text-shadow:0 0 10px rgba(57,255,20,0.55); margin-bottom:0.5rem; }
  .hand-count.bust{ color:#ff3b3b; text-shadow:0 0 10px rgba(255,59,59,0.55); }
  .cards{ display:flex; gap:0.6rem; flex-wrap:wrap; min-height:132px; justify-content:center; }
  .card{
    width:100px; height:144px; border:3px solid rgba(232,232,232,0.4); border-radius:9px;
    background:#111; display:flex; align-items:center; justify-content:center;
    font-size:40px; font-weight:700; position:relative; overflow:hidden;
  }
  .card.hidden{ background:repeating-linear-gradient(45deg,#151515,#151515 5px,#1c1c1c 5px,#1c1c1c 10px); color:transparent; border-color:rgba(232,232,232,0.25) !important; box-shadow:none !important; }
  /* Numbered cards — a real per-rank pip layout (see PIP_LAYOUT in the
     client script), bigger now since they're the primary read, plus a
     small rank+suit index in the top-left and bottom-right corners (the
     latter mirrored) like an actual deck. */
  .card-corner{
    position:absolute; z-index:2; font-size:15px; font-weight:700; line-height:1.05; text-align:center;
  }
  .card-corner.tl{ top:5px; left:6px; }
  .card-corner.br{ bottom:5px; right:6px; transform:rotate(180deg); }
  .card-pips{ position:absolute; inset:0; z-index:1; pointer-events:none; }
  .card-pip{ position:absolute; transform:translate(-50%,-50%); font-size:25px; line-height:1; }
  /* A double-down's second card is dealt face down and only becomes
     revealable once the dealer's own hand has fully played out — you hold
     it down and peel it back to look (drag/press; a plain click/tap also
     works), and the round can't settle until every pending double is
     flipped (enforced in the client script, not just visually). */
  .double-card{ cursor:grab; border-color:rgba(255,176,0,0.6) !important; animation:doublePulse 1.4s ease-in-out infinite; transition:transform 0.2s ease, filter 0.2s ease; }
  .double-card.peeling{ transition:none; cursor:grabbing; }
  @keyframes doublePulse{ 0%,100%{ box-shadow:0 0 8px rgba(255,176,0,0.35); } 50%{ box-shadow:0 0 18px rgba(255,176,0,0.75); } }
  .double-card::after{
    content:'H0LD & PEEL'; position:absolute; bottom:6px; left:50%; transform:translateX(-50%);
    font-size:8px; letter-spacing:0.1em; color:#ffb000; text-shadow:0 0 4px rgba(255,176,0,0.8); white-space:nowrap;
  }
  /* Dealing pace — a card lands with a little drop/settle instead of just
     appearing, and every dealer card (hole card and any further draws)
     gets the same flip-swap when revealed, so the whole dealer hand reads
     consistently instead of the hole card alone doing something special. */
  @keyframes cardDeal{
    0%{ opacity:0; transform:translateY(-18px) scale(0.82) rotate(-8deg); }
    70%{ opacity:1; transform:translateY(2px) scale(1.03) rotate(1deg); }
    100%{ opacity:1; transform:translateY(0) scale(1) rotate(0); }
  }
  .card-deal{ animation:cardDeal 0.4s ease-out both; }
  @keyframes cardFlipOut{ from{ transform:scaleX(1); } to{ transform:scaleX(0); } }
  @keyframes cardFlipIn{ from{ transform:scaleX(0); } to{ transform:scaleX(1); } }
  .card-flip-out{ animation:cardFlipOut 0.2s ease-in both; }
  .card-flip-in{ animation:cardFlipIn 0.22s ease-out both; }
  /* Custom face art (Jester/Phoenix/King) drops in here once the images
     exist — see CARD_ART in the client script below. Until CARD_ART has a
     real URL for a rank, cardEl() never creates this element at all. */
  .card-art{ width:100%; height:100%; object-fit:cover; }
  /* Bigger suit mark, repeated in 3 corners (top-right, bottom-right,
     bottom-left) — the name badge already owns top-left. */
  .card-art-suit{ position:absolute; font-size:27px; text-shadow:0 0 3px #000, 0 0 3px #000; }
  .card-art-suit.tr{ top:1px; right:5px; }
  .card-art-suit.br{ bottom:2px; right:5px; }
  .card-art-suit.bl{ bottom:2px; left:5px; }
  /* The rank corner badge IS the spelled-out name (KING / QUEEN / JESTER /
     PH0EN!X) — just the capital first letter big (same size a bare "K"
     used to be), the rest of the word smaller underneath it, one letter
     per line, so a 7-letter word like PHOENIX doesn't blow up the badge. */
  .card-art-name{ position:absolute; top:1px; left:5px; text-align:center; color:#fff; text-shadow:0 0 3px #000, 0 0 3px #000; }
  .card-art-name-big{ display:block; font-size:20px; font-weight:700; line-height:1; }
  .card-art-name-rest{ display:block; font-size:10px; font-weight:700; line-height:1.05; margin-top:1px; }

  .status-line{ text-align:center; font-size:15px; letter-spacing:0.1em; min-height:1.5em; margin-bottom:0.6rem; }
  .status-line.win{ color:#39ff14; text-shadow:0 0 8px rgba(57,255,20,0.5); }
  .status-line.lose{ color:#ff3fb0; text-shadow:0 0 8px rgba(255,63,176,0.5); }
  .status-line.push{ color:#ffb000; }
  .status-line.err{ color:#ff3fb0; }

  /* Wager console — the whole betting area (plates + chip tray) now lives
     INSIDE .table itself, per feedback: it used to be a separate plain
     block below the neon-framed table, which read as a disconnected black
     box rather than part of the same system. */
  .wager-console{ display:flex; flex-direction:column; align-items:center; gap:1.4rem; margin:0.7rem 0 0.5rem; }
  /* 3 box clusters, spread well apart across the now much wider table. */
  .box-plates{ display:flex; gap:5rem; justify-content:center; flex-wrap:wrap; }
  .box-cluster{ display:flex; flex-direction:column; align-items:center; gap:0.7rem; }
  .side-mini-row{ display:flex; gap:1rem; }

  .bet-plate{ position:relative; display:flex; flex-direction:column; align-items:center; }
  /* Two counter-rotating dashed rings around each plate — smaller/tighter
     now (per feedback the ovals were too big), still a slow HUD spin so
     the betting circles feel like part of a live system, not static UI. */
  .plate-ring{ position:absolute; inset:-3px; border-radius:50%; border:1px dashed rgba(61,243,236,0.5); animation:plateSpin 12s linear infinite; pointer-events:none; }
  .plate-ring.outer{ inset:-6px; border-color:rgba(255,63,176,0.35); animation-duration:18s; animation-direction:reverse; }
  @keyframes plateSpin{ to{ transform:rotate(360deg); } }
  .plate-felt{
    position:relative; border-radius:50%; overflow:visible;
    background:radial-gradient(circle at 50% 38%, rgba(61,243,236,0.1), #060607 72%);
    border:2px solid rgba(232,232,232,0.18);
    box-shadow:inset 0 0 18px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(61,243,236,0.08);
  }
  .mini-side .plate-felt{ width:60px; height:60px; }
  .box-plate .plate-felt{ width:96px; height:96px; }
  /* A plate is where chips currently land (click, or drop a dragged chip
     on it directly) — click one to make it the target for plain chip
     taps too, so one shared chip tray can fund all 9 spots (3 boxes x
     main+PP+PB) instead of repeating the chip UI everywhere. */
  .bet-plate{ cursor:pointer; }
  .bet-plate .plate-label{ transition:color 0.15s ease; }
  .bet-plate.selected .plate-felt{ border-color:#39ff14; box-shadow:inset 0 0 18px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(61,243,236,0.08), 0 0 12px rgba(57,255,20,0.45); }
  .bet-plate.selected .plate-label{ color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.5); }
  /* A plate being dragged over — the drop target lights up so it's clear
     where a dragged chip will land. */
  .bet-plate.drag-over .plate-felt{ border-color:#ffb000; box-shadow:inset 0 0 18px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(61,243,236,0.08), 0 0 16px rgba(255,176,0,0.6); }
  .plate-placeholder{
    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); white-space:nowrap;
    font-size:9px; letter-spacing:0.15em; color:rgba(232,232,232,0.3); pointer-events:none;
  }
  .plate-label{ font-size:10px; letter-spacing:0.18em; color:rgba(232,232,232,0.55); margin-top:0.55rem; }

  /* A wager is "swallowed" into the plate — a chip flies in and vanishes,
     and the running total shows on one coin sitting in the middle of the
     circle (instead of a number underneath, or a pile of individual
     chips). The coin pops in on the first chip and bumps on every one
     after. */
  .plate-coin{
    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) scale(0.2);
    border-radius:50%; display:flex; align-items:center; justify-content:center;
    background:radial-gradient(circle at 35% 30%, rgba(255,255,255,0.22), rgba(10,10,12,0.95));
    border:2px solid #ffb000; color:#ffb000; font-weight:700; text-shadow:0 0 6px rgba(255,176,0,0.6);
    box-shadow:0 0 12px rgba(255,176,0,0.4), inset 0 0 8px rgba(0,0,0,0.6);
    opacity:0; pointer-events:none;
    transition:transform 0.3s cubic-bezier(.34,1.56,.64,1), opacity 0.2s ease;
  }
  .plate-coin.visible{ opacity:1; transform:translate(-50%,-50%) scale(1); }
  .plate-coin.bump{ animation:coinBump 0.32s ease; }
  @keyframes coinBump{ 0%{ transform:translate(-50%,-50%) scale(1); } 45%{ transform:translate(-50%,-50%) scale(1.22); } 100%{ transform:translate(-50%,-50%) scale(1); } }
  .mini-side .plate-coin{ width:70%; height:70%; font-size:12px; }
  .box-plate .plate-coin{ width:72%; height:72%; font-size:18px; }

  .main-plate-wrap{ display:flex; align-items:center; justify-content:center; margin-top:0.5rem; }
  /* Bigger and a little more theatrical — a slow ambient pulse on top of
     the usual hover/press feedback, per "make it juicier". */
  .deal-btn{
    background:radial-gradient(circle at 35% 30%, rgba(57,255,20,0.3), rgba(10,10,12,0.95));
    border:3px solid #39ff14; color:#39ff14; font-family:inherit; font-size:17px; letter-spacing:0.14em;
    width:104px; height:104px; border-radius:50%; cursor:pointer; text-shadow:0 0 10px rgba(57,255,20,0.8);
    box-shadow:0 0 22px rgba(57,255,20,0.35); transition:transform 0.12s ease, box-shadow 0.12s ease;
    display:flex; align-items:center; justify-content:center; text-transform:uppercase;
    animation:dealBtnPulse 2.2s ease-in-out infinite;
  }
  @keyframes dealBtnPulse{ 0%,100%{ box-shadow:0 0 22px rgba(57,255,20,0.35); } 50%{ box-shadow:0 0 34px rgba(57,255,20,0.6); } }
  .deal-btn:hover:not(:disabled){ transform:scale(1.08); box-shadow:0 0 40px rgba(57,255,20,0.7); animation-play-state:paused; }
  .deal-btn:active:not(:disabled){ transform:scale(0.95); }
  .deal-btn:disabled{ opacity:0.3; cursor:default; animation:none; }

  /* Fund-mode toggle — plain click on a chip normally funds whichever
     plate is "selected"; these switch that to fund every box's main
     wager, or every box's bonus bets, in one tap instead. Dragging a
     chip always targets wherever it's dropped, regardless of this. */
  .fund-mode-row{ display:flex; gap:0.5rem; }
  .fund-mode-btn{
    background:transparent; border:1px solid rgba(232,232,232,0.35); color:rgba(232,232,232,0.7);
    font-family:inherit; font-size:10px; letter-spacing:0.1em; padding:0.35em 0.8em; cursor:pointer;
    border-radius:3px; text-transform:uppercase; transition:border-color 0.15s ease, color 0.15s ease;
  }
  .fund-mode-btn:hover{ border-color:rgba(61,243,236,0.6); color:#3df3ec; }
  .fund-mode-btn.selected{ border-color:#3df3ec; color:#3df3ec; text-shadow:0 0 6px rgba(61,243,236,0.5); background:rgba(61,243,236,0.08); }
  .clear-all-btn{
    background:transparent; border:1px solid rgba(255,63,176,0.45); color:rgba(255,63,176,0.85);
    font-family:inherit; font-size:10px; letter-spacing:0.1em; padding:0.35em 0.8em; cursor:pointer;
    border-radius:3px; text-transform:uppercase; transition:border-color 0.15s ease, background 0.15s ease;
  }
  .clear-all-btn:hover{ border-color:#ff3fb0; background:rgba(255,63,176,0.1); }

  .chip-tray{ display:flex; flex-direction:column; align-items:center; gap:0.6rem; margin-bottom:0.3rem; }
  /* A chip mid-drag — the source button dims slightly while its ghost
     follows the pointer. */
  .chip.dragging{ opacity:0.35; }
  .chip-drag-ghost{ position:fixed; z-index:500; pointer-events:none; opacity:0.95; }

  /* Chip pad — click a denomination to ADD it onto whatever's already
     wagered on the currently-selected spot (real casino chip-stacking,
     not a replace); the chip itself flies to the plate and stays there as
     part of the pile. X clears that spot back to empty. */
  .chip-pad{ display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap; }
  .chip{
    position:relative; border-radius:50%; border:2px solid #ffb000; cursor:pointer; font-family:inherit; font-weight:700;
    background:radial-gradient(circle at 35% 30%, rgba(255,176,0,0.28), rgba(10,10,12,0.92));
    color:#ffb000; text-shadow:0 0 5px currentColor;
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; line-height:1;
    transition:transform 0.12s ease, box-shadow 0.12s ease;
    width:52px; height:52px; font-size:13px;
  }
  /* Dashed inner ring — reads as an actual chip edge rather than a plain
     coin/button. */
  .chip:not(.clear)::before{ content:''; position:absolute; inset:3px; border-radius:50%; border:1.5px dashed currentColor; opacity:0.55; pointer-events:none; }
  .chip-crown, .chip-val{ position:relative; z-index:1; }
  .chip:hover{ transform:translateY(-3px) rotate(-4deg); box-shadow:0 5px 12px currentColor; }
  .chip:active{ transform:translateY(0) rotate(0deg); }
  .chip.clear{ border-color:rgba(232,232,232,0.45); color:rgba(232,232,232,0.75); text-shadow:none; background:radial-gradient(circle at 35% 30%, rgba(232,232,232,0.1), rgba(10,10,12,0.92)); }
  .chip-crown{ width:15px; height:auto; fill:none; stroke:currentColor; stroke-width:1.6; stroke-linejoin:round; stroke-linecap:round; }
  /* One colour per denomination (poker-chip convention, adapted to the
     site's neon palette) — reused for the flying coin's colour too (read
     back via getComputedStyle at click time, see flyCoin in the client
     script), so a chip's colour and its coin's colour always match. */
  .chip[data-add="5"]{ border-color:#e8e8e8; color:#e8e8e8; background:radial-gradient(circle at 35% 30%, rgba(232,232,232,0.25), rgba(10,10,12,0.92)); }
  .chip[data-add="10"]{ border-color:#ff3b3b; color:#ff3b3b; background:radial-gradient(circle at 35% 30%, rgba(255,59,59,0.25), rgba(10,10,12,0.92)); }
  .chip[data-add="25"]{ border-color:#39ff14; color:#39ff14; background:radial-gradient(circle at 35% 30%, rgba(57,255,20,0.25), rgba(10,10,12,0.92)); }
  .chip[data-add="50"]{ border-color:#3df3ec; color:#3df3ec; background:radial-gradient(circle at 35% 30%, rgba(61,243,236,0.25), rgba(10,10,12,0.92)); }
  .chip[data-add="100"]{ border-color:#ff3fb0; color:#ff3fb0; background:radial-gradient(circle at 35% 30%, rgba(255,63,176,0.25), rgba(10,10,12,0.92)); }
  .chip[data-add="250"]{ border-color:#ffb000; color:#ffb000; background:radial-gradient(circle at 35% 30%, rgba(255,176,0,0.28), rgba(10,10,12,0.92)); }

  /* Flying chip — a ghost disc travels from the clicked chip button to its
     plate; once it arrives it's swapped for a real .stacked-chip that
     stays there (see flyChip in the client script). */
  .flying-chip{
    position:fixed; width:34px; height:34px; border-radius:50%; z-index:400; pointer-events:none;
    display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700;
    background:rgba(10,10,12,0.95); border:2px solid currentColor; box-shadow:0 0 10px currentColor;
    color:currentColor; text-shadow:0 0 4px currentColor;
    transition:left 0.5s cubic-bezier(.25,.65,.3,1), top 0.5s cubic-bezier(.25,.65,.3,1), opacity 0.35s ease 0.4s, transform 0.5s ease;
  }

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

  /* Win callout — a brief full-screen flash + bouncing text, shared by
     Pair/Poker Bonus hits, a main-hand win/blackjack (bigger, with a +net
     amount and the resulting balance underneath), and a small pulse for
     hitting exactly 21. Sits above the table (z-index 250) but below the
     strategy/history modals (300), and never blocks clicks either way. */
  .win-flash{ position:fixed; inset:0; z-index:250; pointer-events:none; display:flex; align-items:center; justify-content:center; opacity:0; }
  .win-flash::before{ content:''; position:absolute; inset:0; background:radial-gradient(circle, rgba(255,176,0,0.4) 0%, rgba(57,255,20,0.18) 40%, transparent 72%); }
  .win-flash span{
    position:relative; font-family:'Chakra Petch',sans-serif; font-size:clamp(26px,5.5vw,52px); font-weight:700;
    letter-spacing:0.08em; text-align:center; color:#ffb000; text-shadow:0 0 20px rgba(255,176,0,0.9), 0 0 44px rgba(255,176,0,0.55);
    text-transform:uppercase;
  }
  #winFlashText{ display:flex; flex-direction:column; align-items:center; gap:0.18em; }
  /* ID-qualified so these beat the plain ".win-flash span" rule above on
     specificity (a bare class alone would lose to class+type and never
     actually shrink). */
  #winFlashText .win-flash-amt{ font-size:0.55em; color:#39ff14; text-shadow:0 0 14px rgba(57,255,20,0.75); }
  #winFlashText .win-flash-bal{ font-size:0.26em; letter-spacing:0.2em; color:rgba(232,232,232,0.8); text-shadow:none; }
  .win-flash.play{ animation:winFlashFade 1.3s ease-out; }
  .win-flash.play span{ animation:winFlashText 1.3s cubic-bezier(.34,1.56,.64,1); }
  /* Small pulse for hitting 21 on the nose via hits — a nod, not the full
     blackjack/win fanfare. */
  .win-flash.small::before{ opacity:0.55; }
  .win-flash.small span{ font-size:clamp(18px,3vw,28px); text-shadow:0 0 12px rgba(255,176,0,0.8); }
  .win-flash.small.play{ animation:winFlashFade 0.85s ease-out; }
  .win-flash.small.play span{ animation:winFlashText 0.85s cubic-bezier(.34,1.56,.64,1); }
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
    .card-art-suit{ font-size:19px; }
    .card-art-name-big{ font-size:15px; }
    .card-art-name-rest{ font-size:8px; }
    .card-corner{ font-size:11px; }
    .card-pip{ font-size:18px; }
    .hand-count{ font-size:26px; }
    .balance-chip .bv{ font-size:24px; }
    .chip{ width:44px; height:44px; font-size:11px; }
    .box-plates{ gap:1.8rem; }
    .box-cluster{ gap:0.5rem; }
    .side-mini-row{ gap:0.6rem; }
    .mini-side .plate-felt{ width:48px; height:48px; }
    .box-plate .plate-felt{ width:76px; height:76px; }
    .mini-side .plate-coin{ font-size:10px; }
    .box-plate .plate-coin{ font-size:15px; }
    .deal-btn{ width:82px; height:82px; font-size:14px; }
    .fund-mode-row{ flex-wrap:wrap; justify-content:center; }
  }
</style>
</head>
<body>
  <canvas id="staticCanvas"></canvas>
  <div class="glow-blob a"></div>
  <div class="glow-blob b"></div>
  <div class="glow-blob c"></div>
  <div class="win-flash" id="winFlash"><span id="winFlashText"></span></div>
  <button class="fullscreen-btn" id="fullscreenBtn" title="Full screen" aria-label="Toggle full screen">
    <svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>
  </button>
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
      <div class="table-border">
      <div class="cyber-glow"></div>
      <div class="table">
      <canvas id="tableStaticCanvas"></canvas>
      <div class="hand-block dealer-block" id="dealerBlock" style="display:none;">
        <div class="hand-label-row"><span class="hand-label">DEALER</span></div>
        <div class="hand-count" id="dealerValue">&nbsp;</div>
        <div class="cards" id="dealerCards"></div>
      </div>
      <div class="player-boxes" id="playerHandsContainer"></div>
      <div class="shuffle-deck" id="shuffleDeck">
        <div class="sc"></div>
        <div class="sc"></div>
        <div class="sc"></div>
        <div class="shuffle-label">SHUFFL!NG...</div>
      </div>

      <div class="status-line" id="statusLine"></div>
      <div class="side-bet-result" id="sideBetResult"></div>

      <!-- Wager console — every betting box lives inside the table's own
           glowing/static-textured frame now, styled as felt betting
           circles with chips piling up underneath. Each box has its own
           Pair Bonus / Poker Bonus flanking it. All 9 spots (3 boxes x
           main+PP+PB) share the one chip tray below — click any plate to
           select it as the chip target (box 1 selected by default). -->
      <div class="wager-console" id="wagerConsole">
        <div class="box-plates" id="boxPlates"></div>
        <div class="main-plate-wrap">
          <button class="deal-btn" id="dealBtn"><span>DEAL</span></button>
        </div>
      </div>

      <div class="chip-tray" id="chipTray">
        <div class="fund-mode-row" id="fundModeRow">
          <button type="button" class="fund-mode-btn selected" data-mode="single">1 SP0T</button>
          <button type="button" class="fund-mode-btn" data-mode="allBoxes">ALL B0XES</button>
          <button type="button" class="fund-mode-btn" data-mode="allBonus">ALL B0NUS</button>
          <button type="button" class="clear-all-btn" id="clearAllBtn">CLEAR ALL</button>
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
      </div>
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
  // Same "glitch" static — cyan/magenta flecks on black — reused for both
  // the full-page ambient canvas (kept subtle, density/fleck size as
  // before) and a second copy scoped to just the table. The table one is
  // deliberately much denser/bigger/brighter — the page-wide density was
  // essentially imperceptible against the table's own solid background,
  // reported live three times as "the static background hasn't been
  // added" even though it technically was.
  function startStaticCanvas(canvasEl, getSize, opts){
    if (!canvasEl) return;
    opts = opts || {};
    var divisor = opts.divisor || 9000;
    var fleckSize = opts.fleckSize || 1;
    function size(){ var s = getSize(); canvasEl.width = s.w; canvasEl.height = s.h; }
    size();
    window.addEventListener('resize', size);
    // The table's own height still grows as cards/hands get added (its
    // width is fixed) without ever firing a window resize — a plain
    // resize listener left the canvas's backing bitmap sized to whatever
    // the table measured on load, so anything it grew into afterward
    // rendered as flat black instead of static (reported live as "cut
    // off with a black box"). A ResizeObserver on the element that's
    // actually changing size catches all of that.
    if (opts.observe && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(size).observe(opts.observe);
    }
    var ctx = canvasEl.getContext('2d');
    function frame(){
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);
      var flecks = Math.floor((canvasEl.width * canvasEl.height) / divisor);
      for (var i = 0; i < flecks; i++) {
        var x = Math.random() * canvasEl.width, y = Math.random() * canvasEl.height;
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(61,243,236,0.75)' : 'rgba(255,63,208,0.7)';
        ctx.fillRect(x, y, fleckSize, fleckSize);
      }
      requestAnimationFrame(frame);
    }
    frame();
  }
  startStaticCanvas(document.getElementById('staticCanvas'), function(){
    return { w: window.innerWidth, h: window.innerHeight };
  });
  var tableEl = document.querySelector('.table');
  startStaticCanvas(document.getElementById('tableStaticCanvas'), function(){
    var r = tableEl.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  }, { divisor: 1400, fleckSize: 2, observe: tableEl });

  var el = {};
  ['balanceValue','dealerValue','dealerCards','playerHandsContainer','statusLine',
   'dealBtn','actionRow','hitBtn','standBtn','doubleBtn','splitBtn','againRow','againBtn',
   'sideBetResult',
   'strategyBtn','strategyOverlay','strategyCloseBtn','strategyBody',
   'rulesBtn','rulesOverlay','rulesCloseBtn',
   'sessionBtn','sessionValue','historyOverlay','historyCloseBtn','historyEmpty','historyList',
   'shuffleDeck','dealerBlock','winFlash','winFlashText',
   'wagerConsole','chipTray','boxPlates'
  ].forEach(function(id){ el[id] = document.getElementById(id); });

  // 3 boxes, each with its own main wager + Pair Bonus + Poker Bonus — 9
  // fundable "spots" total, built here rather than repeated 9x in markup.
  // One shared chip tray funds whichever spot is currently "selected"
  // (click any plate to select it; box 1's main wager by default).
  var BOX_COUNT = 3;
  function buildPlate(kind, box){
    var isBox = kind === 'box';
    var plate = document.createElement('div');
    plate.className = 'bet-plate ' + (isBox ? 'box-plate' : 'mini-side');
    var labelText = isBox ? ('B0X ' + (box + 1)) : (kind === 'pair' ? 'PA!R' : 'P0KER');
    plate.innerHTML =
      '<div class="plate-ring"></div>' + (isBox ? '<div class="plate-ring outer"></div>' : '') +
      '<div class="plate-felt">' +
        '<div class="plate-placeholder">' + labelText + '</div>' +
        '<div class="plate-coin"><span>0</span></div>' +
      '</div>' +
      '<div class="plate-label">' + labelText + '</div>';
    var input = document.createElement('input');
    input.type = 'hidden'; input.min = '0'; input.step = '1'; input.value = '0';
    plate.appendChild(input);
    return {
      key: kind + box, kind: kind, box: box, big: isBox, plate: plate, input: input,
      felt: plate.querySelector('.plate-felt'),
      coin: plate.querySelector('.plate-coin'),
      coinAmt: plate.querySelector('.plate-coin span'),
      placeholder: plate.querySelector('.plate-placeholder')
    };
  }
  var spotsList = [];
  for (var bi = 0; bi < BOX_COUNT; bi++) {
    var cluster = document.createElement('div');
    cluster.className = 'box-cluster';
    var boxSpot = buildPlate('box', bi);
    var pairSpot = buildPlate('pair', bi);
    var pokerSpot = buildPlate('poker', bi);
    cluster.appendChild(boxSpot.plate);
    var miniRow = document.createElement('div');
    miniRow.className = 'side-mini-row';
    miniRow.appendChild(pairSpot.plate);
    miniRow.appendChild(pokerSpot.plate);
    cluster.appendChild(miniRow);
    el.boxPlates.appendChild(cluster);
    spotsList.push(boxSpot, pairSpot, pokerSpot);
  }
  var spotsByKey = {};
  spotsList.forEach(function(s){ spotsByKey[s.key] = s; });
  var selectedSpotKey = 'box0';
  function selectSpot(key){
    var spot = spotsByKey[key];
    if (!spot.big) {
      var boxSpot2 = spotsByKey['box' + spot.box];
      if ((parseInt(boxSpot2.input.value, 10) || 0) <= 0) {
        setStatus('FUND B0X ' + (spot.box + 1) + ' F!RST', 'err');
        return;
      }
    }
    selectedSpotKey = key;
    spotsList.forEach(function(s){ s.plate.classList.toggle('selected', s.key === key); });
    setStatus('', '');
  }
  spotsList.forEach(function(s){ s.plate.addEventListener('click', function(){ selectSpot(s.key); }); });
  selectSpot('box0');
  var lastBoxBets = [0, 0, 0];
  var lastSideBets = { pair: [0, 0, 0], poker: [0, 0, 0] };

  // 3 persistent card slots, one per UI box position — built once here
  // instead of being torn down and rebuilt on every deal, so a box's
  // cards always land in the exact same spot on screen instead of the
  // whole layout reshuffling itself around new content (per feedback:
  // "the page moves too much to compensate new cards").
  var boxSlots = [];
  for (var si = 0; si < BOX_COUNT; si++) {
    var slotGroup = document.createElement('div');
    slotGroup.className = 'box-group';
    var slotLabel = document.createElement('div');
    slotLabel.className = 'box-group-label';
    slotLabel.textContent = 'B0X ' + (si + 1);
    slotGroup.appendChild(slotLabel);
    var slotRow = document.createElement('div');
    slotRow.className = 'hands-row';
    slotGroup.appendChild(slotRow);
    el.playerHandsContainer.appendChild(slotGroup);
    boxSlots.push({ group: slotGroup, row: slotRow });
  }
  function clearBoxSlots(){
    boxSlots.forEach(function(s){ s.row.innerHTML = ''; });
  }

  // Every denomination chip gets a little crown icon (colour follows the
  // chip via currentColor/stroke) instead of just a bare number — built
  // once here rather than repeated per button in the template.
  var CROWN_ICON_SVG = '<svg class="chip-crown" viewBox="0 0 24 16"><path d="M2 14 L1 4 L6 8 L12 2 L18 8 L23 4 L22 14 Z"/></svg>';
  document.querySelectorAll('.chip[data-add]').forEach(function(btn){
    var val = btn.textContent;
    btn.innerHTML = CROWN_ICON_SVG + '<span class="chip-val">' + val + '</span>';
  });

  // "Actually putting chips onto a betting plate" — a ghost chip, coloured
  // to match the denomination clicked, flies from wherever it started to
  // the plate's felt and is "swallowed" there (fades out into the
  // circle) instead of landing as a visible object.
  function flyChip(sourceEl, plateFeltEl, color, value, done){
    var sRect = sourceEl.getBoundingClientRect();
    var tRect = plateFeltEl.getBoundingClientRect();
    var chip = document.createElement('div');
    chip.className = 'flying-chip';
    chip.style.color = color;
    chip.textContent = value;
    chip.style.left = (sRect.left + sRect.width / 2 - 17) + 'px';
    chip.style.top = (sRect.top + sRect.height / 2 - 17) + 'px';
    chip.style.opacity = '1';
    document.body.appendChild(chip);
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        chip.style.left = (tRect.left + tRect.width / 2 - 17) + 'px';
        chip.style.top = (tRect.top + tRect.height / 2 - 17) + 'px';
        chip.style.opacity = '0';
        chip.style.transform = 'scale(0.3) rotate(120deg)';
      });
    });
    setTimeout(function(){
      chip.remove();
      done();
    }, 480);
  }

  // The plate's own coin — shows the running total, pops in on the first
  // chip and bumps on every one after (instead of a pile of individual
  // chips, or a number sitting underneath).
  function updateCoin(spot, amount){
    spot.coinAmt.textContent = amount;
    spot.coin.classList.toggle('visible', amount > 0);
    spot.placeholder.style.display = amount > 0 ? 'none' : 'block';
  }
  function bumpCoin(spot){
    spot.coin.classList.remove('bump');
    void spot.coin.offsetWidth;
    spot.coin.classList.add('bump');
  }
  function addToSpot(spot, amount){
    var current = parseInt(spot.input.value, 10) || 0;
    var max = parseInt(spot.input.max, 10);
    var next = current + amount;
    if (Number.isFinite(max) && max > 0) next = Math.min(next, max);
    spot.input.value = next;
    updateCoin(spot, next);
    bumpCoin(spot);
  }
  function clearSpot(spot){
    spot.input.value = 0;
    updateCoin(spot, 0);
  }
  // Flies a chip from wherever it started to the spot's felt, then adds
  // its value once "swallowed" — the one path every funding gesture
  // (click, drag-drop, fund-all) goes through.
  function flyAndFund(sourceEl, spot, color, amount){
    flyChip(sourceEl, spot.felt, color, amount, function(){ addToSpot(spot, amount); });
  }

  // Fund-mode toggle — a plain click on a chip normally funds whichever
  // spot is "selected"; switching mode funds every box's main wager, or
  // every box's own Pair+Poker bonus, in one tap instead. A pair/poker
  // spot only gets funded if its box already has money down.
  var fundMode = 'single';
  var fundModeRow = document.getElementById('fundModeRow');
  fundModeRow.querySelectorAll('.fund-mode-btn').forEach(function(btn){
    btn.addEventListener('click', function(){
      fundMode = btn.getAttribute('data-mode');
      fundModeRow.querySelectorAll('.fund-mode-btn').forEach(function(b){ b.classList.toggle('selected', b === btn); });
    });
  });
  document.getElementById('clearAllBtn').addEventListener('click', function(){
    spotsList.forEach(clearSpot);
  });

  function fundedBoxCount(box){ return (parseInt(spotsByKey['box' + box].input.value, 10) || 0) > 0; }

  function handleChipTap(btn){
    var add = parseInt(btn.getAttribute('data-add'), 10) || 0;
    var color = getComputedStyle(btn).color;
    if (fundMode === 'allBoxes') {
      for (var i = 0; i < BOX_COUNT; i++) flyAndFund(btn, spotsByKey['box' + i], color, add);
    } else if (fundMode === 'allBonus') {
      for (var j = 0; j < BOX_COUNT; j++) {
        if (!fundedBoxCount(j)) continue;
        flyAndFund(btn, spotsByKey['pair' + j], color, add);
        flyAndFund(btn, spotsByKey['poker' + j], color, add);
      }
    } else {
      flyAndFund(btn, spotsByKey[selectedSpotKey], color, add);
    }
  }

  // Dragging a chip always targets wherever it's dropped, regardless of
  // fund mode or the currently selected spot; a plain click (no real
  // pointer movement) falls back to handleChipTap.
  function wireChipDrag(btn){
    var startX, startY, dragging = false, ghost = null;
    function onMove(e){
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (!dragging && Math.hypot(dx, dy) > 8) {
        dragging = true;
        btn.classList.add('dragging');
        ghost = btn.cloneNode(true);
        ghost.className = 'chip chip-drag-ghost';
        ghost.style.width = btn.offsetWidth + 'px';
        ghost.style.height = btn.offsetHeight + 'px';
        document.body.appendChild(ghost);
      }
      if (dragging && ghost) {
        ghost.style.left = (e.clientX - ghost.offsetWidth / 2) + 'px';
        ghost.style.top = (e.clientY - ghost.offsetHeight / 2) + 'px';
        var under = document.elementFromPoint(e.clientX, e.clientY);
        var plateEl = under && under.closest('.bet-plate');
        spotsList.forEach(function(s){ s.plate.classList.toggle('drag-over', s.plate === plateEl); });
      }
    }
    function onUp(e){
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      btn.classList.remove('dragging');
      spotsList.forEach(function(s){ s.plate.classList.remove('drag-over'); });
      if (dragging) {
        if (ghost) ghost.remove();
        var under = document.elementFromPoint(e.clientX, e.clientY);
        var plateEl = under && under.closest('.bet-plate');
        var spot = plateEl && spotsList.filter(function(s){ return s.plate === plateEl; })[0];
        if (spot && btn.hasAttribute('data-add')) {
          flyAndFund(btn, spot, getComputedStyle(btn).color, parseInt(btn.getAttribute('data-add'), 10) || 0);
        }
      } else if (btn.hasAttribute('data-add')) {
        handleChipTap(btn);
      }
      dragging = false; ghost = null;
    }
    btn.addEventListener('pointerdown', function(e){
      if (btn.hasAttribute('data-clear')) return;
      startX = e.clientX; startY = e.clientY; dragging = false;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  }
  document.querySelectorAll('#betChipPad .chip[data-add]').forEach(wireChipDrag);
  document.getElementById('betChipPad').addEventListener('click', function(e){
    var btn = e.target.closest('.chip[data-clear]');
    if (!btn) return;
    clearSpot(spotsByKey[selectedSpotKey]);
  });

  var SUIT_SYM = { S: '\\u2660', H: '\\u2665', D: '\\u2666', C: '\\u2663' };
  // Diamonds cyan, hearts red, clubs green, spades "black" — spades uses
  // a near-white instead of literal black since true black would be
  // invisible against the card's own dark background.
  var SUIT_COLOR = { D: '#3df3ec', H: '#ff3b3b', C: '#39ff14', S: '#f2f2f2' };
  // Real per-rank pip layout ([top%, left%] per pip) instead of a generic
  // grid — 4/5 use 2 row-levels ("two sided"), 6/7 use 3 ("3 sided"), 8 is
  // 3 sided plus 2 center accents, 9/10 use 4-5 row-levels ("4 side").
  // 2/3 get their own simple single-column look. The rank sits on top in
  // the true center, so nothing is placed at exactly (50,50) except the
  // deliberate center pip on 3/5/7/9 — the rank's own dark backdrop keeps
  // that one legible underneath it.
  var PIP_LAYOUT = {
    2: [[15, 50], [85, 50]],
    3: [[15, 50], [50, 50], [85, 50]],
    4: [[15, 25], [15, 75], [85, 25], [85, 75]],
    5: [[15, 25], [15, 75], [50, 50], [85, 25], [85, 75]],
    6: [[15, 25], [15, 75], [50, 25], [50, 75], [85, 25], [85, 75]],
    7: [[15, 25], [15, 75], [32, 50], [50, 25], [50, 75], [85, 25], [85, 75]],
    8: [[15, 25], [15, 75], [32, 50], [50, 25], [50, 75], [68, 50], [85, 25], [85, 75]],
    9: [[15, 25], [15, 75], [32, 25], [32, 75], [50, 50], [68, 25], [68, 75], [85, 25], [85, 75]],
    10: [[15, 25], [15, 75], [32, 25], [32, 75], [50, 25], [50, 75], [68, 25], [68, 75], [85, 25], [85, 75]]
  };
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
  // Spelled out one letter per line down the left edge of each face card.
  var CARD_NAMES = { J: 'JESTER', A: 'PH0EN!X', K: 'K!NG', Q: 'QUEEN' };
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
      ['tr', 'br', 'bl'].forEach(function(corner){
        var badge = document.createElement('span');
        badge.className = 'card-art-suit ' + corner;
        badge.textContent = SUIT_SYM[suit];
        badge.style.color = color;
        d.appendChild(badge);
      });
      // The corner "rank badge" IS the spelled-out name — just the
      // capital first letter big (a bare "K"-sized badge), the rest of
      // the word smaller underneath it so a long name like PHOENIX
      // doesn't blow the badge up past the card itself.
      var name = CARD_NAMES[rank] || rank;
      var nameEl = document.createElement('span');
      nameEl.className = 'card-art-name';
      nameEl.innerHTML =
        '<span class="card-art-name-big">' + name.charAt(0) + '</span>' +
        '<span class="card-art-name-rest">' + name.slice(1).split('').join('<br>') + '</span>';
      d.appendChild(nameEl);
    } else {
      d.style.color = color;
      // A real per-rank pip arrangement (bigger now — the suit is the
      // primary read), plus a small rank+suit index in the top-left and
      // bottom-right corners (the latter mirrored) like an actual deck.
      var layout = PIP_LAYOUT[parseInt(rank, 10)];
      if (layout) {
        var pips = document.createElement('div');
        pips.className = 'card-pips';
        layout.forEach(function(pos){
          var pip = document.createElement('span');
          pip.className = 'card-pip';
          pip.style.top = pos[0] + '%';
          pip.style.left = pos[1] + '%';
          pip.textContent = SUIT_SYM[suit];
          pips.appendChild(pip);
        });
        d.appendChild(pips);
      }
      var idx = rank + '<br>' + SUIT_SYM[suit];
      ['tl', 'br'].forEach(function(corner){
        var cornerEl = document.createElement('span');
        cornerEl.className = 'card-corner ' + corner;
        cornerEl.innerHTML = idx;
        d.appendChild(cornerEl);
      });
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

  // Full screen — for a short viewport where the table can't all fit at
  // once; the icon swaps to "shrink" once already full screen.
  var fullscreenBtn = document.getElementById('fullscreenBtn');
  var EXPAND_ICON = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
  var SHRINK_ICON = '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>';
  fullscreenBtn.addEventListener('click', function(){
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function(){});
    }
  });
  document.addEventListener('fullscreenchange', function(){
    fullscreenBtn.querySelector('svg').innerHTML = document.fullscreenElement ? SHRINK_ICON : EXPAND_ICON;
  });

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
      var net = handNet(h);
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
  // sideBets is now an array, one entry (or null) per funded box.
  function recordSideBetNet(sideBets){
    if (!sideBets) return;
    sideBets.forEach(function(entry){
      if (!entry) return;
      addSessionNet(sideBetNet(entry.pair) + sideBetNet(entry.poker));
    });
  }

  function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  var CARD_DELAY = 550;

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

  // The initial deal specifically "spits out" of the shuffling shoe at
  // the top instead of just appearing in place — a ghost card flies from
  // the shoe's own position to whichever box/dealer slot it's landing in,
  // then settles into the row with the normal card-deal animation.
  async function dealFromShoe(originRect, cardsEl, card, hidden){
    var c = cardEl(card, hidden);
    c.style.position = 'fixed';
    c.style.left = (originRect.left + originRect.width / 2 - 50) + 'px';
    c.style.top = (originRect.top + originRect.height / 2 - 72) + 'px';
    c.style.margin = '0';
    c.style.zIndex = '360';
    c.style.transition = 'left 0.34s ease-out, top 0.34s ease-out';
    document.body.appendChild(c);
    var tRect = cardsEl.getBoundingClientRect();
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        c.style.left = (tRect.left + tRect.width / 2 - 50) + 'px';
        c.style.top = tRect.top + 'px';
      });
    });
    await sleep(340);
    c.style.position = '';
    c.style.left = '';
    c.style.top = '';
    c.style.margin = '';
    c.style.zIndex = '';
    c.style.transition = '';
    c.classList.add('card-deal');
    cardsEl.appendChild(c);
    await sleep(160);
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

  // Highlights both the active hand-block AND the whole box it belongs to
  // (obvious at a glance which decision you're making, per feedback) — the
  // box-level class is computed once rather than toggled per-ref, since a
  // split box has 2 refs sharing one boxGroupEl and toggling independently
  // could leave the wrong one set depending on iteration order.
  function applyActiveHighlight(index){
    var seenGroups = [];
    handRefs.forEach(function(ref){
      ref.block.classList.remove('active-hand');
      if (ref.boxGroupEl && seenGroups.indexOf(ref.boxGroupEl) === -1) {
        seenGroups.push(ref.boxGroupEl);
        ref.boxGroupEl.classList.remove('active-group');
      }
    });
    var active = handRefs[index];
    if (active) {
      active.block.classList.add('active-hand');
      if (active.boxGroupEl) active.boxGroupEl.classList.add('active-group');
    }
  }

  // Generic flip-swap: a hidden card scales out, the real card scales in
  // in its place — used for the dealer's hole card, every further dealer
  // draw (same reveal, not a plain drop-in), and a player's double-down
  // card once they click it.
  function flipCard(hiddenEl, realCard){
    return new Promise(function(resolve){
      hiddenEl.classList.add('card-flip-out');
      setTimeout(function(){
        var real = cardEl(realCard, false);
        real.classList.add('card-flip-in');
        hiddenEl.replaceWith(real);
        setTimeout(function(){ resolve(real); }, 220);
      }, 200);
    });
  }

  // Hole card's flip-reveal: the hidden placeholder scales out, the real
  // card scales in — a small beat of drama for the one moment blackjack
  // actually has (Insurance aside, which this doesn't implement).
  async function flipRevealDealerHole(realCard){
    var hiddenEl = el.dealerCards.children[1];
    if (!hiddenEl) return;
    await flipCard(hiddenEl, realCard);
  }

  // Any further dealer draw beyond the opening two cards gets dealt face
  // down first, then flips — the same reveal as the hole card, so the
  // whole dealer hand plays out consistently instead of the hole card
  // alone doing something special.
  async function dealDealerCardFlipped(card){
    var hiddenEl = cardEl(null, true);
    hiddenEl.classList.add('card-deal');
    el.dealerCards.appendChild(hiddenEl);
    await sleep(CARD_DELAY);
    await flipCard(hiddenEl, card);
  }

  // Reveals the dealer's hole card, then plays out any further draws —
  // unless every player hand already busted, in which case the dealer's
  // total is moot and we just turn over the hole card rather than
  // dragging out draws that can't change the outcome.
  async function playDealerReveal(round){
    var allBust = round.hands.every(function(h){ return h.status === 'bust'; });
    await flipRevealDealerHole(round.dealer[1]);
    updateCount(el.dealerValue, handValueClient(round.dealer.slice(0, 2)));
    if (!allBust) {
      for (var i = 2; i < round.dealer.length; i++) {
        await dealDealerCardFlipped(round.dealer[i]);
        updateCount(el.dealerValue, handValueClient(round.dealer.slice(0, i + 1)));
      }
      updateCount(el.dealerValue, round.dealerValue); // authoritative final value
    }
    await sleep(200);
  }

  function handNet(h){
    return h.result === 'blackjack' ? Math.floor(h.bet * 1.5) : h.result === 'win' ? h.bet : h.result === 'push' ? 0 : -h.bet;
  }

  // "B0X 1" for a box that never split, "B0X 1A"/"B0X 1B" for one that did.
  function boxLabelFor(hand, round){
    var uiBoxNum = fundedBoxNumbers[hand.box] != null ? fundedBoxNumbers[hand.box] : hand.box + 1;
    var siblings = round.hands.filter(function(h){ return h.box === hand.box; });
    if (siblings.length <= 1) return 'B0X ' + uiBoxNum;
    return 'B0X ' + uiBoxNum + String.fromCharCode(65 + siblings.indexOf(hand));
  }

  function finishResolved(round){
    round.hands.forEach(function(h, i){
      if (handRefs[i]) updateCount(handRefs[i].count, h.value, h.status === 'bust');
    });
    handRefs.forEach(function(ref){ ref.block.classList.remove('active-hand'); });
    el.actionRow.style.display = 'none';
    el.wagerConsole.style.display = 'none';
    el.chipTray.style.display = 'none';
    el.againRow.style.display = 'flex';
    var labels = { blackjack: 'BLACKJACK!', win: 'W!N', push: 'PUSH', lose: 'L0SE' };
    var classes = { blackjack: 'win', win: 'win', push: 'push', lose: 'lose' };
    if (round.hands.length > 1) {
      var summary = round.hands.map(function(h){ return boxLabelFor(h, round) + ': ' + labels[h.result]; }).join('  ·  ');
      setStatus(summary, '');
    } else {
      var r = round.hands[0].result;
      var text = r === 'blackjack' ? 'BLACKJACK! Y0U W!N ' + Math.floor(round.hands[0].bet * 1.5) + ' CR0WN'
        : r === 'win' ? 'Y0U W!N ' + round.hands[0].bet + ' CR0WN'
        : r === 'push' ? 'PUSH — BET RETURNED'
        : 'Y0U L0SE';
      setStatus(text, classes[r]);
    }
    // Big win flash — a blackjack or an ordinary win both get it (per
    // feedback, blackjack should flash like the pair/poker bonuses do),
    // bigger than those, with a +net amount and the resulting balance
    // underneath so the payoff actually registers.
    var net = round.hands.reduce(function(sum, h){ return sum + handNet(h); }, 0);
    if (net > 0) {
      var anyBlackjack = round.hands.some(function(h){ return h.result === 'blackjack'; });
      var label = anyBlackjack ? 'BLACKJACK!' : 'Y0U W!N!';
      flashWin(
        '<span class="win-flash-main">' + label + '</span>' +
        '<span class="win-flash-amt">+' + net + ' CR0WN</span>' +
        '<span class="win-flash-bal">BALANCE ' + el.balanceValue.textContent + '</span>'
      );
    }
    recordHistory(round);
  }

  // Called once a hand stops being playable (bust, stood, or a forced-done
  // double) — either the next hand (another split hand, or the next box
  // entirely) takes over, or the round is resolved and the dealer's own
  // turn plays out.
  // Never correct to stand on 9/10/11 (the basic-strategy chart has no
  // "S" in those rows at all — it's always hit or double), so Stand is
  // disabled there rather than left as a tempting wrong answer.
  function updateActionButtons(round){
    var hand = round.hands[round.activeHandIndex];
    el.doubleBtn.disabled = !round.canDouble;
    el.splitBtn.disabled = !round.canSplit;
    el.splitBtn.style.display = round.canSplit ? 'inline-block' : 'none';
    el.standBtn.disabled = hand.value >= 9 && hand.value <= 11;
  }

  async function afterHandFinished(round){
    currentRound = round;
    if (round.status === 'active') {
      applyActiveHighlight(round.activeHandIndex);
      var activeHand = round.hands[round.activeHandIndex];
      setStatus('YOUR M0VE — ' + boxLabelFor(activeHand, round), '');
      updateActionButtons(round);
      await maybeAutoHit(round.activeHandIndex);
    } else {
      // The dealer's own hand plays out FIRST — any face-down double
      // cards only become revealable afterward (per feedback: reveal
      // comes after the suspense of the dealer's play, not before it).
      await sleep(200);
      await playDealerReveal(round);
      await revealPendingDoubles();
      finishResolved(round);
    }
  }

  // Anything 8-or-under always hits (never correct to double or stand
  // there); once a hand has already been hit at least once (canDouble is
  // false), anything under 12 keeps hitting too, since there's no double
  // option left and standing under 12 is never right either.
  async function maybeAutoHit(actingIndex){
    var round = currentRound;
    if (!round || round.status !== 'active' || round.activeHandIndex !== actingIndex) return;
    var hand = round.hands[actingIndex];
    // 21 is never a decision — hit or split could only make it worse.
    if (hand.value === 21) {
      setStatus('AUT0 STAND — ' + boxLabelFor(hand, round), '');
      await sleep(500);
      var standData = await postAction({ action: 'stand' });
      await sequenceStand(standData.round);
      return;
    }
    var shouldHit = hand.value <= 8 || (hand.value < 12 && !round.canDouble);
    if (!shouldHit) return;
    setStatus('AUT0 H!T — ' + boxLabelFor(hand, round), '');
    await sleep(500);
    var data = await postAction({ action: 'hit' });
    await sequenceHitOrDouble(actingIndex, data.round);
  }

  // Double-down cards are dealt face down and queued here instead of
  // being revealable immediately — they only become clickable/peelable
  // once the dealer's hand has fully played out (see afterHandFinished),
  // and the round can't settle until every one of them is flipped.
  var pendingDoubleCards = [];

  function revealPendingDoubles(){
    if (!pendingDoubleCards.length) return Promise.resolve();
    var entries = pendingDoubleCards.splice(0);
    setStatus('REVEAL Y0UR D0UBLE' + (entries.length > 1 ? 'S' : ''), '');
    return Promise.all(entries.map(function(entry){
      return new Promise(function(resolve){
        entry.el.classList.add('double-card');
        wireCardPeel(entry.el, function(){
          entry.el.classList.remove('double-card');
          flipCard(entry.el, entry.card).then(function(){
            updateCount(entry.ref.count, entry.hand.value, entry.hand.status === 'bust');
            resolve();
          });
        });
      });
    }));
  }

  // "Hold and peel" — press/drag upward on the card to bend its corner
  // back (a click/tap alone also works, for anyone who'd rather not
  // drag), releasing early springs it back flat.
  function wireCardPeel(cardEl, onRevealed){
    var dragging = false, startY = 0, done = false;
    function setPeel(amount){
      cardEl.style.transform = 'perspective(500px) rotateX(' + (-amount * 42) + 'deg) scale(' + (1 - amount * 0.04) + ')';
      cardEl.style.filter = 'brightness(' + (1 + amount * 0.5) + ')';
    }
    function cleanup(){
      cardEl.removeEventListener('mousedown', onDown);
      cardEl.removeEventListener('touchstart', onDown);
      window.removeEventListener('mousemove', onMove);
      cardEl.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      cardEl.removeEventListener('touchend', onUp);
      cardEl.removeEventListener('click', finish);
    }
    function finish(){
      if (done) return;
      done = true;
      cleanup();
      cardEl.style.transform = '';
      cardEl.style.filter = '';
      onRevealed();
    }
    function onDown(e){
      dragging = true;
      startY = e.touches ? e.touches[0].clientY : e.clientY;
      cardEl.classList.add('peeling');
    }
    function onMove(e){
      if (!dragging || done) return;
      var y = e.touches ? e.touches[0].clientY : e.clientY;
      var amount = Math.min(1, Math.max(0, startY - y) / 60);
      setPeel(amount);
      if (amount >= 1) finish();
    }
    function onUp(){
      if (done) return;
      dragging = false;
      cardEl.classList.remove('peeling');
      setPeel(0);
    }
    cardEl.addEventListener('mousedown', onDown);
    cardEl.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('mousemove', onMove);
    cardEl.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    cardEl.addEventListener('touchend', onUp);
    cardEl.addEventListener('click', finish);
  }

  // Restarts the flash/bounce animation even on a repeat trigger (two
  // side-bet hits back to back would otherwise silently no-op the second
  // time — a class that's already applied doesn't retrigger a CSS
  // animation without a reflow in between).
  function flashWin(html, opts){
    opts = opts || {};
    el.winFlashText.innerHTML = html;
    el.winFlash.classList.remove('play', 'small');
    void el.winFlash.offsetWidth;
    if (opts.small) el.winFlash.classList.add('small');
    el.winFlash.classList.add('play');
  }

  // sideBets is an array now — one entry (or null) per funded box, in the
  // same order as fundedBoxNumbers, so a hit can be labelled with its box.
  function describeSideBets(sideBets){
    if (!sideBets) { el.sideBetResult.innerHTML = ''; return; }
    var tierLabels = {
      perfect: 'PERFECT PA!R', colored: 'C0L0RED PA!R', mixed: 'M!XED PA!R',
      suitedTrips: 'SU!TED TR!PS', straightFlush: 'STRA!GHT FLUSH', trips: 'TR!PS', straight: 'STRA!GHT', flush: 'FLUSH'
    };
    // Only worth a line when something actually hit — a miss on a side
    // bet isn't news (per feedback, "this doesn't need to show").
    var parts = [];
    var wins = [];
    sideBets.forEach(function(entry, i){
      if (!entry) return;
      var boxTag = sideBets.length > 1 ? ('B0X ' + fundedBoxNumbers[i] + ' ') : '';
      if (entry.pair && entry.pair.payout > 0) {
        parts.push('<span class="hit">' + boxTag + 'PA!R B0NUS: ' + tierLabels[entry.pair.tier] + ' — W0N ' + entry.pair.payout + '</span>');
        wins.push(boxTag + tierLabels[entry.pair.tier] + '! +' + entry.pair.payout);
      }
      if (entry.poker && entry.poker.payout > 0) {
        parts.push('<span class="hit">' + boxTag + 'P0KER B0NUS: ' + tierLabels[entry.poker.tier] + ' — W0N ' + entry.poker.payout + '</span>');
        wins.push(boxTag + tierLabels[entry.poker.tier] + '! +' + entry.poker.payout);
      }
    });
    el.sideBetResult.innerHTML = parts.join(' &nbsp;·&nbsp; ');
    if (wins.length) flashWin(wins.join(' + '));
  }

  async function sequenceDeal(round, sideBets){
    // Shuffle burst — the idle deck (already visible on the betting
    // screen) speeds up for a beat before the table actually clears and
    // dealing starts, so "shuffling" reads as one continuous motion
    // rather than an idle animation just vanishing.
    el.shuffleDeck.classList.add('active');
    await sleep(650);
    el.shuffleDeck.classList.remove('active');
    // Captured before hiding it — every card this deal flies out from
    // this exact spot, "spitting out" of the shoe at the top of the table.
    var shoeRect = el.shuffleDeck.getBoundingClientRect();
    el.shuffleDeck.style.display = 'none';
    el.dealerBlock.style.display = 'block';

    el.dealerCards.innerHTML = '';
    updateCount(el.dealerValue, null);
    clearBoxSlots();
    describeSideBets(null);

    // Each hand lands in its box's own persistent slot (normally just 1
    // hand, 2 if that box splits) instead of the layout being rebuilt.
    handRefs = round.hands.map(function(hand){
      var slot = boxSlots[fundedBoxNumbers[hand.box] - 1];
      var hb = buildHandBlock('', hand.bet);
      hb.boxGroupRow = slot.row;
      hb.boxGroupEl = slot.group;
      slot.row.appendChild(hb.block);
      return hb;
    });

    var dealerFirst = round.status === 'active' ? round.dealerUp : round.dealer[0];

    // Classic dealing order: one card to each box in turn, then the
    // dealer, twice around (dealer's second card is the hole card) — the
    // same order the server actually deals in.
    for (var round1 = 0; round1 < 2; round1++) {
      for (var b = 0; b < handRefs.length; b++) {
        await dealFromShoe(shoeRect, handRefs[b].cards, round.hands[b].cards[round1], false);
        updateCount(handRefs[b].count, handValueClient(round.hands[b].cards.slice(0, round1 + 1)));
      }
      if (round1 === 0) {
        await dealFromShoe(shoeRect, el.dealerCards, dealerFirst, false);
        await sleep(280);
      } else {
        // Both player cards and the dealer's up card are down for every
        // box — each box's own side bets are fully determined now.
        describeSideBets(sideBets);
        recordSideBetNet(sideBets);
        await dealFromShoe(shoeRect, el.dealerCards, null, true);
      }
    }

    currentRound = round;
    if (round.status === 'active') {
      applyActiveHighlight(round.activeHandIndex);
      el.wagerConsole.style.display = 'none';
      el.chipTray.style.display = 'none';
      el.actionRow.style.display = 'flex';
      el.againRow.style.display = 'none';
      updateActionButtons(round);
      setStatus('YOUR M0VE — ' + boxLabelFor(round.hands[round.activeHandIndex], round), '');
      await maybeAutoHit(round.activeHandIndex);
    } else {
      // Every box was a natural (player and/or dealer blackjack) — the
      // dealer's 2 starting cards are already final, no extra draws.
      await sleep(300);
      await playDealerReveal(round);
      await revealPendingDoubles();
      finishResolved(round);
    }
  }

  // A double-down's card is dealt face down and queued in
  // pendingDoubleCards — it stays hidden through the dealer's whole play
  // and only becomes revealable afterward (see revealPendingDoubles), so
  // this just does the drop-in animation and moves on.
  async function dealDoubleCardFaceDown(ref, card, hand){
    var hiddenEl = cardEl(null, true);
    hiddenEl.classList.add('card-deal');
    ref.cards.appendChild(hiddenEl);
    await sleep(CARD_DELAY);
    pendingDoubleCards.push({ el: hiddenEl, card: card, hand: hand, ref: ref });
  }

  async function sequenceHitOrDouble(actingIndex, round, isDouble){
    var ref = handRefs[actingIndex];
    var hand = round.hands[actingIndex];
    var newCard = hand.cards[hand.cards.length - 1];
    var betTag = ref.label.querySelector('.bet-tag');
    if (betTag) betTag.textContent = 'BET ' + hand.bet;
    if (isDouble) {
      // Stays face down — count isn't updated and no 21 pulse until the
      // post-dealer reveal, since the outcome isn't meant to be known yet.
      await dealDoubleCardFaceDown(ref, newCard, hand);
    } else {
      await dealInto(ref.cards, newCard, false);
      updateCount(ref.count, hand.value, hand.status === 'bust');
      // A small pulse for landing on 21 via hits — the full win flash
      // (with the +net amount and balance) still only fires once the hand
      // actually resolves.
      if (hand.value === 21 && hand.status !== 'bust') {
        flashWin('<span class="win-flash-main">BLACKJACK</span>', { small: true });
      }
    }
    currentRound = round;
    if (round.status !== 'active' || round.activeHandIndex !== actingIndex) {
      await afterHandFinished(round);
    } else {
      await maybeAutoHit(actingIndex);
    }
  }

  async function sequenceStand(round){
    await afterHandFinished(round);
  }

  // Splits only the box that asked for it — the two new hands replace its
  // one hand-block, in place, inside that same box-group; every other
  // box's hand-blocks (and handRefs indices before it) are untouched.
  async function sequenceSplit(actingIndex, round){
    var oldRef = handRefs[actingIndex];
    var boxGroupRow = oldRef.boxGroupRow;
    var boxGroupEl = oldRef.boxGroupEl;
    oldRef.block.remove();
    var newHands = [round.hands[actingIndex], round.hands[actingIndex + 1]];
    var newRefs = newHands.map(function(hand){
      var hb = buildHandBlock('', hand.bet);
      hb.boxGroupRow = boxGroupRow;
      hb.boxGroupEl = boxGroupEl;
      boxGroupRow.appendChild(hb.block);
      // The first card in each new hand is half of the original pair —
      // it already existed, so it snaps into place instead of animating.
      hb.cards.appendChild(cardEl(hand.cards[0], false));
      updateCount(hb.count, handValueClient([hand.cards[0]]));
      return hb;
    });
    handRefs.splice(actingIndex, 1, newRefs[0], newRefs[1]);
    // Only the genuinely new second card deals in with the normal pacing.
    for (var i = 0; i < newHands.length; i++) {
      await dealInto(newRefs[i].cards, newHands[i].cards[1], false);
      updateCount(newRefs[i].count, newHands[i].value, newHands[i].status === 'bust');
    }
    currentRound = round;
    if (round.status === 'active') {
      applyActiveHighlight(round.activeHandIndex);
      el.wagerConsole.style.display = 'none';
      el.chipTray.style.display = 'none';
      el.actionRow.style.display = 'flex';
      el.againRow.style.display = 'none';
      updateActionButtons(round);
      setStatus('YOUR M0VE — ' + boxLabelFor(round.hands[round.activeHandIndex], round), '');
      await maybeAutoHit(round.activeHandIndex);
    } else {
      // Split Aces — both hands were already done the instant they were dealt.
      await sleep(250);
      await playDealerReveal(round);
      await revealPendingDoubles();
      finishResolved(round);
    }
  }

  function renderInstant(round){
    el.shuffleDeck.style.display = 'none';
    el.dealerBlock.style.display = 'block';
    el.dealerCards.innerHTML = '';
    el.dealerCards.appendChild(cardEl(round.dealerUp, false));
    el.dealerCards.appendChild(cardEl(null, true));
    updateCount(el.dealerValue, null);
    clearBoxSlots();

    // Rebuild the box numbering from whatever boxes are actually present
    // in the resumed round (best-effort — a page reload can't recover
    // which UI box number each one was, so they're just relabeled 1..N
    // in order, landing in that many of the 3 persistent slots).
    var boxIndices = [];
    round.hands.forEach(function(h){ if (boxIndices.indexOf(h.box) === -1) boxIndices.push(h.box); });
    boxIndices.sort(function(a, b){ return a - b; });
    fundedBoxNumbers = [];
    boxIndices.forEach(function(boxIdx, i){ fundedBoxNumbers[boxIdx] = i + 1; });

    var perBox = {};
    round.hands.forEach(function(h){ (perBox[h.box] = perBox[h.box] || []).push(h); });
    handRefs = round.hands.map(function(hand){
      var slot = boxSlots[fundedBoxNumbers[hand.box] - 1];
      var siblings = perBox[hand.box];
      var label = siblings.length > 1 ? ('HAND ' + String.fromCharCode(65 + siblings.indexOf(hand))) : '';
      var hb = buildHandBlock(label, hand.bet);
      hb.boxGroupRow = slot.row;
      hb.boxGroupEl = slot.group;
      hand.cards.forEach(function(c){ hb.cards.appendChild(cardEl(c, false)); });
      updateCount(hb.count, hand.value, hand.status === 'bust');
      slot.row.appendChild(hb.block);
      return hb;
    });
    applyActiveHighlight(round.activeHandIndex);
    currentRound = round;
    el.wagerConsole.style.display = 'none';
    el.chipTray.style.display = 'none';
    el.actionRow.style.display = 'flex';
    el.againRow.style.display = 'none';
    updateActionButtons(round);
    setStatus('R0UND RESUMED — ' + boxLabelFor(round.hands[round.activeHandIndex], round), '');
    maybeAutoHit(round.activeHandIndex);
  }

  function resetToBetting(){
    el.shuffleDeck.style.display = 'flex';
    el.dealerBlock.style.display = 'none';
    el.dealerCards.innerHTML = '';
    updateCount(el.dealerValue, null);
    clearBoxSlots();
    handRefs = [];
    currentRound = null;
    el.wagerConsole.style.display = 'flex';
    el.chipTray.style.display = 'flex';
    el.actionRow.style.display = 'none';
    el.againRow.style.display = 'none';
    // Restore every spot (boxes AND their bonus bets) to whatever it was
    // funded with last time, so clicking DEAL again just replays the same
    // bet — no chip pile to rebuild now, just set the coin straight to it.
    for (var bi2 = 0; bi2 < BOX_COUNT; bi2++) {
      ['box', 'pair', 'poker'].forEach(function(kind){
        var spot = spotsByKey[kind + bi2];
        var remembered = kind === 'box' ? lastBoxBets[bi2] : lastSideBets[kind][bi2];
        var amount = Math.min(remembered || 0, parseInt(spot.input.max, 10) || Infinity);
        spot.input.value = amount;
        updateCoin(spot, amount);
      });
    }
    selectSpot('box0');
    describeSideBets(null);
    setStatus('', '');
  }

  var handRefs = [];
  var currentRound = null;
  var uiBusy = false;
  // Maps a server box index (0-based, in the order bets were sent) back
  // to the UI's "BOX N" numbering — set fresh on every deal.
  var fundedBoxNumbers = [1, 2, 3];

  // Self-heal for "round_in_progress" — this means the server genuinely
  // still has an active round (real bet already placed) that the client
  // somehow lost track of, e.g. a crash/interruption mid-deal-animation
  // left the UI showing the bet screen while the deal had already
  // succeeded server-side. Re-fetch real state and resume it instead of
  // just leaving the player stuck behind a red error line every time.
  async function recoverFromDesync(){
    try {
      var res = await fetch('/api/crown-balance');
      var data = await res.json();
      if (data.ok && data.round && data.round.status === 'active') {
        renderInstant(data.round);
        setStatus('R0UND REC0VERED — Y0UR PREV!0US BET WAS ST!LL ACT!VE', '');
      } else {
        resetToBetting();
      }
    } catch (e) {
      // Nothing more we can do here — leave the existing error message up.
    }
  }

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
      var msg = String((e && e.message) || e);
      if (msg === 'round_in_progress') {
        await recoverFromDesync();
      } else {
        setStatus('ERR:: ' + msg.toUpperCase().replace(/_/g, ' '), 'err');
      }
    } finally {
      uiBusy = false;
      setButtonsBusy(false);
      if (currentRound && currentRound.status === 'active') {
        updateActionButtons(currentRound);
      }
    }
  }

  el.dealBtn.addEventListener('click', function(){
    runAction(async function(){
      var boxAmounts = [], pairAmounts = [], pokerAmounts = [];
      for (var i = 0; i < BOX_COUNT; i++) {
        boxAmounts.push(parseInt(spotsByKey['box' + i].input.value, 10) || 0);
        pairAmounts.push(parseInt(spotsByKey['pair' + i].input.value, 10) || 0);
        pokerAmounts.push(parseInt(spotsByKey['poker' + i].input.value, 10) || 0);
      }
      var bets = [], pairBets = [], pokerBets = [];
      // Map each funded box back to its UI number (1/2/3) so results and
      // status text can still say "BOX 2" even if box 1 was left empty —
      // and only funded boxes' own Pair/Poker bets actually ride along.
      fundedBoxNumbers = [];
      boxAmounts.forEach(function(amount, i){
        if (amount <= 0) return;
        bets.push(amount);
        fundedBoxNumbers.push(i + 1);
        pairBets.push(pairAmounts[i]);
        pokerBets.push(pokerAmounts[i]);
      });
      if (!bets.length) { setStatus('FUND AT LEAST 0NE B0X', 'err'); return; }
      lastBoxBets = boxAmounts.slice();
      lastSideBets = { pair: pairAmounts.slice(), poker: pokerAmounts.slice() };
      var data = await postAction({ action: 'deal', bets: bets, pairBets: pairBets, pokerBets: pokerBets });
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
      await sequenceHitOrDouble(actingIndex, data.round, true);
    });
  });
  el.splitBtn.addEventListener('click', function(){
    runAction(async function(){
      var actingIndex = currentRound.activeHandIndex;
      var data = await postAction({ action: 'split' });
      await sequenceSplit(actingIndex, data.round);
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
        spotsList.forEach(function(spot){ spot.input.max = data.maxBet; });
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
