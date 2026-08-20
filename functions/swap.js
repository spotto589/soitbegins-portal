// ─────────────────────────────────────────────────────────────────────────
// Σκύλλα SWAP — Phase 1: Pigeon Search + Offer Builder.
//
// Flow: SEARCH -> IDENTIFY/INSPECT -> SELECT -> BUILD OFFER -> REVIEW ->
// SCYLLA OFFER (mock). Nothing here connects a wallet, calls Xaman, signs
// anything, or submits any transaction — every Pigeon, owner, and offer on
// this page is fabricated client-side.
//
// DATA-ACCESS LAYER — the real future integration seam. Every read the UI
// does about a Pigeon goes through exactly these five functions, never a
// raw mock array directly. Swapping mock data for a real Pigeon database /
// XRPL indexer later means rewriting only this block:
//
//   searchPigeons(query)
//   getPigeon(id)
//   getPigeonTraits(id)
//   getPigeonOwner(id)
//   getPigeonsByWallet(wallet)
//
// A second, SEPARATE set of functions represents the real wallet-connect /
// signing / submission flow. These are NOT implemented and NOT called
// anywhere in this file — wiring them up is the next development phase:
//
//   connectWallet(), createSwapRequest(), signSwap(), combineSignatures(),
//   submitBatch()
// ─────────────────────────────────────────────────────────────────────────

const TOTAL_PIGEONS_MOCK = 3015;
const YOUR_WALLET_MOCK = 'rMOCKY0UPR0T0TYPE00000000000000W';
const YOUR_PIGEON_NUMBERS = [456, 789, 1001, 1044];

const SWAP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>Σκύλλα SWAP :: P!GE0N SEARCH</title>
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
    position:relative;
    overflow-x:hidden;
  }
  canvas#staticBg{
    position:fixed;
    inset:0;
    width:100%;
    height:100%;
    z-index:0;
    opacity:0.22;
    filter:brightness(0.7) contrast(1.3);
    mix-blend-mode:screen;
    animation:static-shake 0.4s steps(2) infinite;
  }
  @keyframes static-shake{
    0%{ transform:translate(0,0); }
    10%{ transform:translate(-1px,1px); }
    20%{ transform:translate(1px,-1px); }
    30%{ transform:translate(-1px,-1px); }
    40%{ transform:translate(1px,1px); }
    50%{ transform:translate(-1px,0); }
    60%{ transform:translate(1px,0); }
    70%{ transform:translate(0,-1px); }
    80%{ transform:translate(0,1px); }
    90%{ transform:translate(-1px,1px); }
    100%{ transform:translate(0,0); }
  }
  @media (prefers-reduced-motion: reduce){
    canvas#staticBg{ animation:none; }
  }
  .page{ max-width:820px; width:100%; position:relative; z-index:1; }
  a.back-link{
    display:inline-block;
    font-size:10px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.35);
    text-decoration:none;
    margin-bottom:2.5rem;
    text-transform:uppercase;
  }
  a.back-link:hover{ color:rgba(232,232,232,0.6); }

  h1{
    font-size:clamp(15px,4.6vw,30px);
    letter-spacing:0.06em;
    color:#fff;
    text-shadow:0 0 10px rgba(57,255,20,0.25);
    margin-bottom:0.4rem;
    text-align:center;
    text-transform:none;
  }
  .sw-subtitle{
    font-size:clamp(13px,2.4vw,16px);
    letter-spacing:0.3em;
    color:#00fff2;
    text-shadow:0 0 8px rgba(0,255,242,0.4);
    text-align:center;
    margin-bottom:1rem;
    text-transform:uppercase;
  }
  .sw-eyebrow{
    text-align:center;
    font-size:11px;
    letter-spacing:0.2em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    margin-bottom:2rem;
    text-transform:uppercase;
  }

  .sw-panel{
    border:1px solid rgba(57,255,20,0.25);
    background:#08080a;
    padding:1.5rem;
    margin-bottom:1.75rem;
  }
  .mock-note{
    text-align:center;
    font-size:9px;
    letter-spacing:0.1em;
    color:rgba(0,255,242,0.55);
    margin-bottom:1.1rem;
    text-transform:uppercase;
  }

  /* ---- search ---- */
  .search-row{
    display:flex;
    gap:0.6rem;
    margin-bottom:0.5rem;
    flex-wrap:wrap;
  }
  input.search-input{
    flex:1 1 260px;
    background:#000;
    border:1px solid rgba(57,255,20,0.35);
    color:#e8e8e8;
    font-family:inherit;
    font-size:12px;
    letter-spacing:0.05em;
    padding:0.75em 0.9em;
  }
  input.search-input::placeholder{ color:rgba(232,232,232,0.3); text-transform:uppercase; }
  .search-btn{
    flex:0 0 auto;
    background:transparent;
    border:1px solid rgba(57,255,20,0.6);
    color:#39ff14;
    font-family:inherit;
    font-size:12px;
    letter-spacing:0.12em;
    padding:0.75em 1.4em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .search-btn:hover{ background:rgba(57,255,20,0.1); }
  .search-hint{
    text-align:center;
    font-size:10px;
    letter-spacing:0.05em;
    color:rgba(232,232,232,0.3);
    margin-bottom:1.25rem;
    text-transform:uppercase;
  }
  .placeholder-note{
    text-align:center;
    font-size:12px;
    letter-spacing:0.08em;
    color:rgba(232,232,232,0.35);
    padding:1.5rem 0;
    text-transform:uppercase;
  }
  .results-note{
    text-align:center;
    font-size:10px;
    letter-spacing:0.08em;
    color:rgba(232,232,232,0.35);
    margin-bottom:0.75rem;
    text-transform:uppercase;
  }

  /* ---- pigeon image box (shared) ---- */
  .pigeon-img-box{
    aspect-ratio:1;
    display:flex;
    align-items:center;
    justify-content:center;
    background:repeating-linear-gradient(
      45deg,
      rgba(57,255,20,0.04) 0px,
      rgba(57,255,20,0.04) 6px,
      transparent 6px,
      transparent 12px
    );
    border:1px dashed rgba(57,255,20,0.15);
    font-size:10px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.3);
  }

  /* ---- result cards ---- */
  .result-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill, minmax(170px, 1fr));
    gap:0.9rem;
  }
  .result-card{
    border:1px solid rgba(57,255,20,0.25);
    overflow:hidden;
  }
  .result-card .pigeon-img-box{ border:none; border-bottom:1px solid rgba(57,255,20,0.15); }
  .result-card-body{ padding:0.7rem; }
  .result-num{
    font-size:12px;
    letter-spacing:0.05em;
    color:#e8e8e8;
    margin-bottom:0.5rem;
  }
  .result-trait-line{
    font-size:10px;
    letter-spacing:0.03em;
    color:rgba(232,232,232,0.55);
    margin-bottom:0.2rem;
  }
  .result-trait-line .tl-label{ color:rgba(232,232,232,0.35); }
  .view-btn{
    display:block;
    width:100%;
    margin-top:0.6rem;
    background:transparent;
    border:1px solid rgba(0,255,242,0.5);
    color:#00fff2;
    font-family:inherit;
    font-size:10px;
    letter-spacing:0.1em;
    padding:0.5em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .view-btn:hover{ background:rgba(0,255,242,0.1); }

  /* ---- detail / builder shared ---- */
  .detail-eyebrow{
    text-align:center;
    font-size:11px;
    letter-spacing:0.2em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    margin-bottom:0.75rem;
    text-transform:uppercase;
  }
  .detail-num{
    text-align:center;
    font-size:22px;
    letter-spacing:0.05em;
    color:#fff;
    margin-bottom:1.25rem;
  }
  .detail-img-large{
    width:100%;
    max-width:280px;
    margin:0 auto 1.25rem;
  }
  .detail-img-large.small{ max-width:180px; }
  .detail-field{
    display:flex;
    justify-content:space-between;
    max-width:420px;
    margin:0 auto 0.7rem;
    font-size:12px;
    letter-spacing:0.05em;
  }
  .df-label{ color:rgba(232,232,232,0.45); text-transform:uppercase; }
  .df-value{ color:#e8e8e8; text-align:right; word-break:break-all; }
  .detail-traits-title{
    text-align:center;
    font-size:11px;
    letter-spacing:0.2em;
    color:rgba(232,232,232,0.4);
    margin:1.25rem 0 0.75rem;
    text-transform:uppercase;
  }
  .trait-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));
    gap:0.6rem;
    max-width:520px;
    margin:0 auto 0.5rem;
  }
  .trait-cell{
    border:1px solid rgba(57,255,20,0.2);
    padding:0.6rem 0.75rem;
    text-align:center;
  }
  .trait-cell .tc-label{
    font-size:9px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.4);
    margin-bottom:0.35rem;
    text-transform:uppercase;
  }
  .trait-cell .tc-value{
    font-size:13px;
    letter-spacing:0.03em;
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.3);
  }
  .detail-actions{
    display:flex;
    justify-content:center;
    gap:0.75rem;
    flex-wrap:wrap;
    margin-top:1.5rem;
  }
  .secondary-btn{
    background:transparent;
    border:1px solid rgba(232,232,232,0.3);
    color:rgba(232,232,232,0.6);
    font-family:inherit;
    font-size:12px;
    letter-spacing:0.1em;
    padding:0.75em 1.4em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .secondary-btn:hover{ background:rgba(232,232,232,0.08); }
  .action-btn{
    background:transparent;
    border:1px solid rgba(57,255,20,0.6);
    color:#39ff14;
    font-family:inherit;
    font-size:12px;
    letter-spacing:0.12em;
    padding:0.75em 1.4em;
    cursor:pointer;
    text-transform:uppercase;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
  }
  .action-btn:hover:not(:disabled){ background:rgba(57,255,20,0.1); }
  .action-btn:disabled{ opacity:0.35; cursor:not-allowed; }

  /* ---- offer builder ---- */
  .section-divider{
    text-align:center;
    font-size:11px;
    letter-spacing:0.25em;
    color:#00fff2;
    text-shadow:0 0 6px rgba(0,255,242,0.4);
    margin:1.75rem 0 1rem;
    padding-top:1.25rem;
    border-top:1px dashed rgba(232,232,232,0.15);
    text-transform:uppercase;
  }
  .checklist{
    max-width:420px;
    margin:0 auto 0.75rem;
    display:flex;
    flex-direction:column;
    gap:0.5rem;
  }
  .checklist-item{
    display:flex;
    align-items:center;
    gap:0.6em;
    border:1px solid rgba(57,255,20,0.2);
    padding:0.6em 0.9em;
    cursor:pointer;
    font-size:12px;
    letter-spacing:0.05em;
  }
  .checklist-item:hover{ border-color:rgba(57,255,20,0.4); }
  .checklist-item.checked{
    border-color:#39ff14;
    box-shadow:0 0 8px rgba(57,255,20,0.25) inset;
  }
  .checklist-item input{ accent-color:#39ff14; }
  .selection-count{
    text-align:center;
    font-size:11px;
    letter-spacing:0.12em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    text-transform:uppercase;
    margin-bottom:0.5rem;
  }
  .xrp-amount-input{
    display:block;
    width:100%;
    max-width:220px;
    margin:0 auto;
    background:#000;
    border:1px solid rgba(57,255,20,0.35);
    color:#39ff14;
    text-align:center;
    font-family:inherit;
    font-size:15px;
    letter-spacing:0.05em;
    padding:0.6em;
  }
  .offer-preview-list{
    text-align:center;
    font-size:12px;
    line-height:1.9;
    color:#e8e8e8;
    min-height:1.9em;
  }
  .offer-preview-list .empty-line{ color:rgba(232,232,232,0.3); }
  .offer-preview-list .xrp-line{ color:#ffd700; text-shadow:0 0 5px rgba(255,215,0,0.4); }

  /* ---- final summary card ---- */
  .final-card{
    border:1px dashed rgba(57,255,20,0.45);
    padding:1.5rem;
    text-align:center;
    margin-top:1.75rem;
  }
  .final-card-title{
    font-size:12px;
    letter-spacing:0.25em;
    color:#fff;
    margin-bottom:1.1rem;
    text-transform:uppercase;
  }
  .final-card-label{
    font-size:10px;
    letter-spacing:0.2em;
    color:rgba(232,232,232,0.4);
    margin:0.9rem 0 0.4rem;
    text-transform:uppercase;
  }
  .final-card-value{
    font-size:13px;
    color:#e8e8e8;
    line-height:1.7;
  }
  .final-card-status{
    margin-top:1.1rem;
    font-size:11px;
    letter-spacing:0.15em;
    color:#ff003c;
    text-shadow:0 0 6px rgba(255,0,60,0.4);
    text-transform:uppercase;
  }

  /* ---- review screen ---- */
  .review-block{ max-width:460px; margin:0 auto; text-align:center; }
  .review-label{
    font-size:10px;
    letter-spacing:0.2em;
    color:rgba(232,232,232,0.4);
    margin:1.1rem 0 0.4rem;
    text-transform:uppercase;
  }
  .review-block .review-label:first-child{ margin-top:0; }
  .review-value{
    font-size:13px;
    color:#e8e8e8;
    line-height:1.7;
  }

  /* ---- offer confirmation ---- */
  .confirm-panel{
    border:1px solid rgba(57,255,20,0.5);
    background:#000;
    padding:1.5rem;
    margin-top:1.75rem;
    text-align:center;
  }
  .confirm-title{
    font-size:13px;
    letter-spacing:0.05em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
    margin-bottom:1rem;
  }
  .confirm-status-row{
    font-size:12px;
    letter-spacing:0.1em;
    color:#ffd700;
    text-shadow:0 0 5px rgba(255,215,0,0.4);
    margin-bottom:1.1rem;
    text-transform:uppercase;
  }
  .offer-disclaimer{
    font-size:11px;
    line-height:2;
    letter-spacing:0.08em;
    color:#ff003c;
    text-shadow:0 0 4px rgba(255,0,60,0.35);
    text-transform:uppercase;
  }

  .protocol-footer{
    text-align:center;
    font-size:10px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.3);
    margin-top:2.5rem;
    text-transform:uppercase;
  }
</style>
</head>
<body>

  <canvas id="staticBg"></canvas>

  <div class="page">
    <a class="back-link" href="/board">&larr; RETURN T0 S!GNAL_RELAY</a>

    <h1>Σκύλλα</h1>
    <div class="sw-subtitle">SWAP PR0T0C0L</div>
    <div class="sw-eyebrow" id="screenEyebrow">// P!GE0N SEARCH</div>

    <!-- SCREEN 1: SEARCH -->
    <div class="sw-panel" id="screenSearch">
      <div class="search-row">
        <input class="search-input" id="searchInput" placeholder="SEARCH P!GE0NS...">
        <button class="search-btn" id="searchBtn">[ SEARCH ]</button>
      </div>
      <div class="search-hint">TRY A NUMBER, A TRA!T (e.g. PH0EN!X, BLUE), "BACKGR0UND: CYAN", 0R A WALLET ADDRESS</div>
      <div class="mock-note">// M0CK DATA — S!MULATED P!GE0N DATABASE</div>
      <div class="results-note" id="resultsNote" style="display:none;"></div>
      <div class="result-grid" id="searchResultsGrid"></div>
      <div class="placeholder-note" id="searchPlaceholder">ENTER A P!GE0N NUMBER, TRA!T, 0R WALLET T0 BEG!N</div>
    </div>

    <!-- SCREEN 2: DETAIL -->
    <div class="sw-panel" id="screenDetail" style="display:none;">
      <div class="detail-eyebrow">// P!GE0N !DENT!F!ED</div>
      <div class="detail-num" id="detailNum"></div>
      <div class="detail-img-large pigeon-img-box">[ IMAGE ]</div>
      <div class="detail-field"><span class="df-label">OWNER</span><span class="df-value" id="detailOwner"></span></div>
      <div class="detail-traits-title">TRAITS</div>
      <div class="trait-grid" id="detailTraits"></div>
      <div class="detail-field"><span class="df-label">STATUS</span><span class="df-value">HELD</span></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="backToSearchBtn">[ ← BACK T0 SEARCH ]</button>
        <button class="action-btn" id="offerForBtn">[ OFFER F0R TH!S P!GE0N ]</button>
      </div>
    </div>

    <!-- SCREEN 3: OFFER BUILDER -->
    <div class="sw-panel" id="screenBuilder" style="display:none;">
      <div class="detail-eyebrow">OFFER BUILDER</div>
      <div class="final-card-label" style="margin-top:0;">TARGET</div>
      <div class="detail-num" id="builderTargetNum"></div>
      <div class="detail-img-large small pigeon-img-box">[ IMAGE ]</div>
      <div class="detail-field"><span class="df-label">OWNER</span><span class="df-value" id="builderTargetOwner"></span></div>

      <div class="section-divider">YOU OFFER</div>
      <div class="final-card-label" style="margin-top:0;">YOUR P!GE0NS</div>
      <div class="checklist" id="yourPigeonChecklist"></div>
      <div class="selection-count" id="builderSelectionCount">SELECTED :: 0 P!GE0NS</div>

      <div class="section-divider">XRP OFFER</div>
      <input class="xrp-amount-input" id="builderXrpInput" type="number" min="0" step="0.01" value="0.00">

      <div class="section-divider">YOUR OFFER</div>
      <div class="offer-preview-list" id="builderOfferPreview"></div>

      <div class="final-card">
        <div class="final-card-title">SCYLLA OFFER</div>
        <div class="final-card-label">TARGET</div>
        <div class="final-card-value" id="finalTarget"></div>
        <div class="final-card-label">YOU OFFER</div>
        <div class="final-card-value" id="finalOffer"></div>
        <div class="final-card-status">STATUS :: DRAFT</div>
      </div>

      <div class="detail-actions">
        <button class="secondary-btn" id="backToDetailBtn">[ ← BACK ]</button>
        <button class="action-btn" id="reviewOfferBtn" disabled>[ REVIEW OFFER ]</button>
      </div>
    </div>

    <!-- SCREEN 4: REVIEW -->
    <div class="sw-panel" id="screenReview" style="display:none;">
      <div class="detail-eyebrow">// SCYLLA OFFER REVIEW</div>
      <div class="review-block">
        <div class="review-label">YOU ARE REQUESTING</div>
        <div class="review-value" id="reviewTarget"></div>
        <div class="review-label">FROM</div>
        <div class="review-value" id="reviewOwner"></div>
        <div class="review-label">YOU ARE OFFERING</div>
        <div class="review-value" id="reviewOffering"></div>
      </div>

      <div class="detail-actions">
        <button class="secondary-btn" id="backToBuilderBtn">[ ← BACK ]</button>
        <button class="action-btn" id="generateMockOfferBtn">[ GENERATE MOCK OFFER ]</button>
      </div>

      <div class="confirm-panel" id="offerConfirmPanel" style="display:none;">
        <div class="confirm-title" id="offerConfirmTitle"></div>
        <div class="confirm-status-row">STATUS :: DRAFT</div>
        <div class="offer-disclaimer">
          NO TRANSACTION CREATED<br>
          NO WALLET CONNECTED<br>
          NO ASSETS MOVED
        </div>
        <div class="detail-actions">
          <button class="secondary-btn" id="newSearchBtn">[ NEW SEARCH ]</button>
        </div>
      </div>
    </div>

    <div class="protocol-footer">TH!S !S A PR0T0TYPE !NTERFACE. N0 ASSETS CAN BE M0VED, S!GNED, 0R TRANSFERRED.</div>
  </div>

<script>
(function(){

  // ---- Deterministic mock RNG so the same Pigeon number always has the
  // same traits/owner every time it's looked up. ----
  function mulberry32(seed){
    return function(){
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(str){
    var h = 0;
    for (var i = 0; i < str.length; i++){ h = (Math.imul(31, h) + str.charCodeAt(i)) | 0; }
    return h >>> 0;
  }

  var TOTAL_PIGEONS_MOCK = ${TOTAL_PIGEONS_MOCK};
  var YOUR_WALLET_MOCK = ${JSON.stringify(YOUR_WALLET_MOCK)};
  var YOUR_PIGEON_NUMBERS = ${JSON.stringify(YOUR_PIGEON_NUMBERS)};

  var BACKGROUNDS = ['CYAN', 'MAGENTA', 'GREEN', 'BLACK', 'VOID', 'GOLD'];
  var BODIES = ['STATIC', 'GLITCH', 'SOLID', 'CHROME', 'SHADOW'];
  var EYES = ['RED', 'BLUE', 'GREEN', 'VOID', 'GOLD'];
  var AURAS = ['NONE', 'NONE', 'NONE', 'NONE', 'PHOENIX', 'STORM'];

  function pick(rnd, arr){ return arr[Math.floor(rnd() * arr.length)]; }

  function pickAccessLevel(rnd){
    var r = rnd();
    if (r < 0.55) return 1;
    if (r < 0.80) return 3;
    if (r < 0.92) return 6;
    if (r < 0.97) return 9;
    if (r < 0.995) return 12;
    return 15;
  }

  function mockOwnerForNumber(num){
    var rnd = mulberry32(hashStr('owner:' + num));
    var chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var suffix = '';
    for (var i = 0; i < 24; i++){ suffix += chars[Math.floor(rnd() * chars.length)]; }
    return 'rMOCK' + suffix;
  }

  function shortenAddr(addr){
    return addr.slice(0, 9) + '...' + addr.slice(-4);
  }

  // ---- The one place mock Pigeon records are built. Generated once for
  // every number 1..TOTAL_PIGEONS_MOCK, deterministically, so repeated
  // lookups of the same Pigeon always return identical data. ----
  var PIGEON_LIBRARY = [];
  (function buildLibrary(){
    var yoursSet = {};
    YOUR_PIGEON_NUMBERS.forEach(function(n){ yoursSet[n] = true; });
    for (var num = 1; num <= TOTAL_PIGEONS_MOCK; num++){
      var rnd = mulberry32(hashStr('pigeon:' + num));
      var owner = yoursSet[num] ? YOUR_WALLET_MOCK : mockOwnerForNumber(num);
      PIGEON_LIBRARY.push({
        id: num,
        number: num,
        owner: owner,
        attributes: [
          { trait_type: 'Background', value: pick(rnd, BACKGROUNDS) },
          { trait_type: 'Body', value: pick(rnd, BODIES) },
          { trait_type: 'Eyes', value: pick(rnd, EYES) },
          { trait_type: 'Aura', value: pick(rnd, AURAS) }
        ],
        accessLevel: pickAccessLevel(rnd)
      });
    }
  })();

  // ---- DATA-ACCESS LAYER (mock-backed today, real API/indexer later) ----
  function getPigeon(id){
    var num = parseInt(id, 10);
    if (!num || num < 1 || num > TOTAL_PIGEONS_MOCK) return null;
    return PIGEON_LIBRARY[num - 1];
  }
  function getPigeonTraits(id){
    var p = getPigeon(id);
    return p ? p.attributes : [];
  }
  function getPigeonOwner(id){
    var p = getPigeon(id);
    return p ? p.owner : null;
  }
  function getPigeonsByWallet(wallet){
    var w = String(wallet).toUpperCase();
    return PIGEON_LIBRARY.filter(function(p){ return p.owner.toUpperCase() === w; });
  }
  var MAX_RESULTS = 24;
  function searchPigeons(query){
    var q = String(query || '').trim();
    if (!q) return [];

    // Direct number / "#123" / "PIGEON #123" lookup.
    var numMatch = q.match(/^#?\\s*(?:p!?ge?0?ns?\\s*#?)?\\s*(\\d+)$/i);
    if (numMatch){
      var p = getPigeon(parseInt(numMatch[1], 10));
      return p ? [p] : [];
    }

    // Structured "TRAIT: VALUE" query.
    var kv = q.match(/^([A-Za-z]+)\\s*:\\s*(.+)$/);
    if (kv){
      var key = kv[1].toUpperCase();
      var val = kv[2].trim().toUpperCase();
      return PIGEON_LIBRARY.filter(function(pg){
        return pg.attributes.some(function(a){
          return a.trait_type.toUpperCase() === key && a.value.toUpperCase().indexOf(val) !== -1;
        });
      }).slice(0, MAX_RESULTS);
    }

    // Wallet-address-shaped query.
    if (/^r[a-z0-9]/i.test(q) && q.length >= 6){
      var qUpper = q.toUpperCase();
      return PIGEON_LIBRARY.filter(function(pg){
        return pg.owner.toUpperCase().indexOf(qUpper) !== -1 || shortenAddr(pg.owner).toUpperCase().indexOf(qUpper) !== -1;
      }).slice(0, MAX_RESULTS);
    }

    // Generic free-text: match any trait value.
    var qUp = q.toUpperCase();
    return PIGEON_LIBRARY.filter(function(pg){
      return pg.attributes.some(function(a){ return a.value.toUpperCase().indexOf(qUp) !== -1; });
    }).slice(0, MAX_RESULTS);
  }

  // ---- True future seams — intentionally unimplemented and unused here.
  // The real wallet-connect / dual-sign / Batch-submit flow plugs in here
  // in a later development phase, not this one. ----
  var SwapProtocolStub = {
    connectWallet: function(){ throw new Error('not implemented — prototype only'); },
    createSwapRequest: function(_proposal){ throw new Error('not implemented — prototype only'); },
    signSwap: function(_request){ throw new Error('not implemented — prototype only'); },
    combineSignatures: function(_a, _b){ throw new Error('not implemented — prototype only'); },
    submitBatch: function(_combined){ throw new Error('not implemented — prototype only'); }
  };

  // ---- Client-side state ----
  var state = {
    currentTarget: null,
    yourSelected: {},
    xrpAmount: 0
  };

  var el = {
    eyebrow: document.getElementById('screenEyebrow'),
    screenSearch: document.getElementById('screenSearch'),
    screenDetail: document.getElementById('screenDetail'),
    screenBuilder: document.getElementById('screenBuilder'),
    screenReview: document.getElementById('screenReview'),
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    searchResultsGrid: document.getElementById('searchResultsGrid'),
    searchPlaceholder: document.getElementById('searchPlaceholder'),
    resultsNote: document.getElementById('resultsNote'),
    detailNum: document.getElementById('detailNum'),
    detailOwner: document.getElementById('detailOwner'),
    detailTraits: document.getElementById('detailTraits'),
    backToSearchBtn: document.getElementById('backToSearchBtn'),
    offerForBtn: document.getElementById('offerForBtn'),
    builderTargetNum: document.getElementById('builderTargetNum'),
    builderTargetOwner: document.getElementById('builderTargetOwner'),
    yourPigeonChecklist: document.getElementById('yourPigeonChecklist'),
    builderSelectionCount: document.getElementById('builderSelectionCount'),
    builderXrpInput: document.getElementById('builderXrpInput'),
    builderOfferPreview: document.getElementById('builderOfferPreview'),
    finalTarget: document.getElementById('finalTarget'),
    finalOffer: document.getElementById('finalOffer'),
    backToDetailBtn: document.getElementById('backToDetailBtn'),
    reviewOfferBtn: document.getElementById('reviewOfferBtn'),
    reviewTarget: document.getElementById('reviewTarget'),
    reviewOwner: document.getElementById('reviewOwner'),
    reviewOffering: document.getElementById('reviewOffering'),
    backToBuilderBtn: document.getElementById('backToBuilderBtn'),
    generateMockOfferBtn: document.getElementById('generateMockOfferBtn'),
    offerConfirmPanel: document.getElementById('offerConfirmPanel'),
    offerConfirmTitle: document.getElementById('offerConfirmTitle'),
    newSearchBtn: document.getElementById('newSearchBtn')
  };

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function showScreen(name){
    el.screenSearch.style.display = name === 'search' ? '' : 'none';
    el.screenDetail.style.display = name === 'detail' ? '' : 'none';
    el.screenBuilder.style.display = name === 'builder' ? '' : 'none';
    el.screenReview.style.display = name === 'review' ? '' : 'none';
    var eyebrows = {
      search: '// P!GE0N SEARCH',
      detail: '// P!GE0N !DENT!F!ED',
      builder: '// OFFER BU!LDER',
      review: '// SCYLLA OFFER REVIEW'
    };
    el.eyebrow.textContent = eyebrows[name] || '';
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  // ---- Search screen ----
  function resultCardHtml(p){
    var bg = p.attributes[0], body = p.attributes[1], eyes = p.attributes[2];
    return '<div class="result-card" data-id="' + p.id + '">' +
      '<div class="pigeon-img-box">[ IMAGE ]</div>' +
      '<div class="result-card-body">' +
        '<div class="result-num">P!GE0N #' + p.number + '</div>' +
        '<div class="result-trait-line"><span class="tl-label">' + escapeHtml(bg.trait_type.toUpperCase()) + ' ::</span> ' + escapeHtml(bg.value) + '</div>' +
        '<div class="result-trait-line"><span class="tl-label">' + escapeHtml(body.trait_type.toUpperCase()) + ' ::</span> ' + escapeHtml(body.value) + '</div>' +
        '<div class="result-trait-line"><span class="tl-label">' + escapeHtml(eyes.trait_type.toUpperCase()) + ' ::</span> ' + escapeHtml(eyes.value) + '</div>' +
        '<div class="result-trait-line"><span class="tl-label">ACCESS ::</span> ' + String(p.accessLevel).padStart(2, '0') + '</div>' +
        '<button class="view-btn" data-id="' + p.id + '">[ VIEW ]</button>' +
      '</div>' +
    '</div>';
  }

  function runSearch(){
    var q = el.searchInput.value.trim();
    if (!q){
      el.searchResultsGrid.innerHTML = '';
      el.searchPlaceholder.style.display = '';
      el.resultsNote.style.display = 'none';
      return;
    }
    var results = searchPigeons(q);
    el.searchPlaceholder.style.display = results.length ? 'none' : '';
    if (!results.length){
      el.searchPlaceholder.textContent = 'N0 P!GE0NS MATCH TH!S QUERY';
      el.searchResultsGrid.innerHTML = '';
      el.resultsNote.style.display = 'none';
      return;
    }
    el.searchResultsGrid.innerHTML = results.map(resultCardHtml).join('');
    el.resultsNote.style.display = '';
    el.resultsNote.textContent = results.length >= MAX_RESULTS
      ? 'SH0WING F!RST ' + MAX_RESULTS + ' MATCHES'
      : results.length + ' MATCH' + (results.length === 1 ? '' : 'ES') + ' F0UND';
  }
  el.searchBtn.addEventListener('click', runSearch);
  el.searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') runSearch(); });
  el.searchResultsGrid.addEventListener('click', function(e){
    var btn = e.target.closest('.view-btn');
    if (!btn) return;
    openDetail(parseInt(btn.getAttribute('data-id'), 10));
  });

  // ---- Detail screen ----
  function traitCellHtml(a){
    return '<div class="trait-cell"><div class="tc-label">' + escapeHtml(a.trait_type) + '</div><div class="tc-value">' + escapeHtml(a.value) + '</div></div>';
  }
  function openDetail(id){
    var p = getPigeon(id);
    if (!p) return;
    state.currentTarget = p;
    el.detailNum.textContent = 'P!GE0N #' + p.number;
    el.detailOwner.textContent = shortenAddr(getPigeonOwner(id));
    el.detailTraits.innerHTML = getPigeonTraits(id).map(traitCellHtml).join('') +
      '<div class="trait-cell"><div class="tc-label">Access</div><div class="tc-value">' + String(p.accessLevel).padStart(2, '0') + '</div></div>';
    showScreen('detail');
  }
  el.backToSearchBtn.addEventListener('click', function(){ showScreen('search'); });
  el.offerForBtn.addEventListener('click', function(){ openBuilder(); });

  // ---- Offer builder screen ----
  function checklistItemHtml(p, checked){
    return '<label class="checklist-item' + (checked ? ' checked' : '') + '" data-id="' + p.id + '">' +
      '<input type="checkbox" data-id="' + p.id + '"' + (checked ? ' checked' : '') + '> #' + p.number +
    '</label>';
  }
  function openBuilder(){
    if (!state.currentTarget) return;
    state.yourSelected = {};
    el.builderXrpInput.value = '0.00';
    state.xrpAmount = 0;
    var p = state.currentTarget;
    el.builderTargetNum.textContent = 'P!GE0N #' + p.number;
    el.builderTargetOwner.textContent = shortenAddr(p.owner);
    var yours = getPigeonsByWallet(YOUR_WALLET_MOCK);
    el.yourPigeonChecklist.innerHTML = yours.map(function(yp){ return checklistItemHtml(yp, false); }).join('');
    renderBuilderState();
    showScreen('builder');
  }
  el.yourPigeonChecklist.addEventListener('change', function(e){
    var cb = e.target.closest('input[type="checkbox"]');
    if (!cb) return;
    var id = cb.getAttribute('data-id');
    if (cb.checked) state.yourSelected[id] = true;
    else delete state.yourSelected[id];
    cb.closest('.checklist-item').classList.toggle('checked', cb.checked);
    renderBuilderState();
  });
  el.builderXrpInput.addEventListener('input', function(){
    var v = parseFloat(el.builderXrpInput.value);
    state.xrpAmount = isNaN(v) || v < 0 ? 0 : v;
    renderBuilderState();
  });

  function renderBuilderState(){
    var ids = Object.keys(state.yourSelected);
    el.builderSelectionCount.textContent = 'SELECTED :: ' + ids.length + ' P!GE0N' + (ids.length === 1 ? '' : 'S');

    var lines = ids.map(function(id){ return '\\uD83D\\uDC26 P!GE0N #' + getPigeon(id).number; });
    if (state.xrpAmount > 0) lines.push('<span class="xrp-line">+ ' + state.xrpAmount.toFixed(2) + ' XRP</span>');
    el.builderOfferPreview.innerHTML = lines.length ? lines.join('<br>') : '<span class="empty-line">N0TH!NG SELECTED YET</span>';

    el.finalTarget.textContent = '\\uD83D\\uDC26 P!GE0N #' + state.currentTarget.number;
    el.finalOffer.innerHTML = ids.length
      ? ids.map(function(id){ return '\\uD83D\\uDC26 #' + getPigeon(id).number; }).join('<br>') + (state.xrpAmount > 0 ? '<br>+ ' + state.xrpAmount.toFixed(2) + ' XRP' : '')
      : (state.xrpAmount > 0 ? '+ ' + state.xrpAmount.toFixed(2) + ' XRP' : '<span class="empty-line">N0TH!NG SELECTED YET</span>');

    el.reviewOfferBtn.disabled = ids.length === 0 && state.xrpAmount <= 0;
  }

  el.backToDetailBtn.addEventListener('click', function(){ showScreen('detail'); });
  el.reviewOfferBtn.addEventListener('click', function(){ openReview(); });

  // ---- Review screen ----
  function openReview(){
    var p = state.currentTarget;
    var ids = Object.keys(state.yourSelected);
    el.reviewTarget.textContent = 'P!GE0N #' + p.number;
    el.reviewOwner.textContent = shortenAddr(p.owner);
    var lines = ids.map(function(id){ return 'P!GE0N #' + getPigeon(id).number; });
    if (state.xrpAmount > 0) lines.push('+ ' + state.xrpAmount.toFixed(2) + ' XRP');
    el.reviewOffering.innerHTML = lines.length ? lines.join('<br>') : '<span class="empty-line">N0TH!NG SELECTED</span>';
    el.offerConfirmPanel.style.display = 'none';
    el.generateMockOfferBtn.style.display = '';
    showScreen('review');
  }
  el.backToBuilderBtn.addEventListener('click', function(){ showScreen('builder'); });

  function mockOfferId(){
    var chars = '0123456789ABCDEF';
    var out = '';
    for (var i = 0; i < 6; i++){ out += chars[Math.floor(Math.random() * chars.length)]; }
    return 'MOCK-' + out;
  }
  el.generateMockOfferBtn.addEventListener('click', function(){
    var id = mockOfferId();
    el.offerConfirmTitle.textContent = 'SCYLLA OFFER :: ' + id;
    el.offerConfirmPanel.style.display = '';
    el.generateMockOfferBtn.style.display = 'none';
  });
  el.newSearchBtn.addEventListener('click', function(){
    state.currentTarget = null;
    state.yourSelected = {};
    state.xrpAmount = 0;
    el.searchInput.value = '';
    el.searchResultsGrid.innerHTML = '';
    el.searchPlaceholder.textContent = 'ENTER A P!GE0N NUMBER, TRA!T, 0R WALLET T0 BEG!N';
    el.searchPlaceholder.style.display = '';
    el.resultsNote.style.display = 'none';
    showScreen('search');
  });

  // TV static background, purely atmospheric — matches the rest of the site.
  (function(){
    var canvas = document.getElementById('staticBg');
    var ctx = canvas.getContext('2d');
    function resize(){
      canvas.width = Math.max(1, Math.floor(window.innerWidth / 3));
      canvas.height = Math.max(1, Math.floor(window.innerHeight / 3));
    }
    resize();
    window.addEventListener('resize', resize);
    function drawStatic(){
      var w = canvas.width, h = canvas.height;
      var imageData = ctx.createImageData(w, h);
      var buffer = imageData.data;
      for (var i = 0; i < buffer.length; i += 4){
        var shade = Math.random() * 255;
        buffer[i] = shade; buffer[i+1] = shade; buffer[i+2] = shade; buffer[i+3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    function loop(){ drawStatic(); requestAnimationFrame(loop); }
    loop();
  })();

})();
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(SWAP_HTML, { headers: { 'Content-Type': 'text/html' } });
}
