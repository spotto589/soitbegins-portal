// ─────────────────────────────────────────────────────────────────────────
// Σκύλλα SWAP — collection explorer + target-selection flow.
//
// Real data throughout: real NFTokenIDs, real owners, real trait
// attributes, real rarity (via Deeptide, falling back to IPFS) — pulled
// through /api/pigeons (functions/api/pigeons.js) and the data-access
// layer in functions/_shared.js. No mock data anywhere in this file.
//
// Flow: DISCOVER -> SEARCH -> FILTER -> INSPECT -> SELECT TARGET ->
// IDENTIFY OWNER -> BROWSE OWNER COLLECTION -> SELECT TARGET ASSETS.
// Nothing past this connects a wallet, calls Xaman, signs anything, or
// moves any asset — "CONTINUE TO OFFER" only reaches a placeholder;
// building the real offer/XRP/signing stage is explicitly the next phase.
// ─────────────────────────────────────────────────────────────────────────

const SWAP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>Σκύλλα SWAP :: P!GE0N DATABASE</title>
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
    opacity:0.2;
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
  @media (prefers-reduced-motion: reduce){ canvas#staticBg{ animation:none; } }
  .page{ max-width:960px; width:100%; position:relative; z-index:1; }
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
  .sw-eyebrow-lines{
    text-align:center;
    font-size:11px;
    letter-spacing:0.15em;
    line-height:1.8;
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
  .panel-title{
    text-align:center;
    font-size:13px;
    letter-spacing:0.2em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    margin-bottom:1rem;
    text-transform:uppercase;
  }

  /* ---- target node header (owner-scope) ---- */
  .node-header{ text-align:center; margin-bottom:1.25rem; }
  .node-header .nh-label{
    font-size:11px;
    letter-spacing:0.25em;
    color:#00fff2;
    text-shadow:0 0 6px rgba(0,255,242,0.4);
    margin-bottom:0.4rem;
    text-transform:uppercase;
  }
  .node-header .nh-addr{ font-size:14px; color:#e8e8e8; margin-bottom:0.3rem; word-break:break-all; }
  .node-header .nh-count{ font-size:11px; letter-spacing:0.1em; color:rgba(232,232,232,0.5); text-transform:uppercase; }

  /* ---- search / sort bar ---- */
  .search-row{
    display:flex;
    gap:0.6rem;
    flex-wrap:wrap;
    margin-bottom:0.75rem;
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
  .bar-btn{
    flex:0 0 auto;
    background:transparent;
    border:1px solid rgba(57,255,20,0.5);
    color:#39ff14;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.75em 1.1em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .bar-btn:hover{ background:rgba(57,255,20,0.1); }
  select.sort-select{
    flex:0 0 auto;
    background:#000;
    border:1px solid rgba(0,255,242,0.4);
    color:#00fff2;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.75em 0.9em;
    text-transform:uppercase;
    cursor:pointer;
  }
  select.sort-select option{ background:#08080a; color:#e8e8e8; }
  .index-line{
    text-align:center;
    font-size:9px;
    letter-spacing:0.08em;
    color:rgba(0,255,242,0.5);
    margin-top:0.5rem;
    text-transform:uppercase;
  }

  /* ---- trait stack filter panel ---- */
  .traits-block{
    border-top:1px dashed rgba(57,255,20,0.25);
    margin-top:1rem;
    padding-top:1rem;
  }
  .traits-block-title{
    font-size:11px;
    letter-spacing:0.2em;
    color:rgba(232,232,232,0.5);
    margin-bottom:0.75rem;
    text-transform:uppercase;
  }
  .trait-row{
    display:flex;
    align-items:center;
    gap:0.5rem;
    margin-bottom:0.6rem;
    flex-wrap:wrap;
  }
  select.trait-cat-select, select.trait-val-select{
    background:#000;
    border:1px solid rgba(57,255,20,0.3);
    color:#e8e8e8;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.55em 0.7em;
    text-transform:uppercase;
    cursor:pointer;
  }
  select.trait-cat-select option, select.trait-val-select option{ background:#08080a; color:#e8e8e8; }
  .trait-row-remove{
    background:transparent;
    border:1px solid rgba(255,0,60,0.5);
    color:#ff003c;
    font-family:inherit;
    font-size:12px;
    width:2em;
    height:2em;
    cursor:pointer;
  }
  .trait-row-remove:hover{ background:rgba(255,0,60,0.1); }
  .traits-actions{
    display:flex;
    gap:0.6rem;
    margin-top:0.5rem;
    flex-wrap:wrap;
  }
  .clear-traits-btn{
    background:transparent;
    border:1px solid rgba(255,0,60,0.5);
    color:#ff003c;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.6em 1.1em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .clear-traits-btn:hover{ background:rgba(255,0,60,0.1); }

  /* ---- results status line ---- */
  .status-line{
    text-align:center;
    font-size:11px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.45);
    margin:1.1rem 0 1rem;
    text-transform:uppercase;
  }
  .status-line .hi{ color:#39ff14; text-shadow:0 0 5px rgba(57,255,20,0.4); }

  /* ---- empty state ---- */
  .empty-state{ text-align:center; padding:2rem 0; }
  .empty-state .es-title{
    font-size:13px;
    letter-spacing:0.15em;
    color:#ff003c;
    text-shadow:0 0 6px rgba(255,0,60,0.4);
    margin-bottom:1rem;
    text-transform:uppercase;
  }
  .empty-state .es-line{
    font-size:11px;
    letter-spacing:0.08em;
    color:rgba(232,232,232,0.5);
    margin-bottom:0.5rem;
    text-transform:uppercase;
  }

  /* ---- pigeon image box ---- */
  .pigeon-img-box{
    aspect-ratio:1;
    position:relative;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    background:repeating-linear-gradient(45deg, rgba(57,255,20,0.04) 0px, rgba(57,255,20,0.04) 6px, transparent 6px, transparent 12px);
    border:1px dashed rgba(57,255,20,0.15);
    font-size:10px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.3);
  }
  .pigeon-img-box img{ width:100%; height:100%; object-fit:cover; display:block; }
  .card-select-toggle{
    position:absolute;
    top:0.3rem;
    right:0.3rem;
    z-index:2;
    width:1.6em;
    height:1.6em;
    line-height:1.6em;
    padding:0;
    background:rgba(8,8,10,0.75);
    border:1px solid rgba(57,255,20,0.6);
    color:#39ff14;
    font-size:13px;
    cursor:pointer;
    text-align:center;
  }
  .card-select-toggle.selected{ background:#39ff14; color:#08080a; }

  /* ---- collection grid / cards ---- */
  /* Fixed 6 columns at every width, on purpose (not auto-fill/minmax,
     which was producing inconsistent tile sizes depending on viewport) —
     chrome is deliberately minimal (image + number + a corner select
     toggle) since 6 columns doesn't leave room for trait lines or a
     button row at any reasonable page width; tap/click the image to
     INSPECT for full detail. */
  .result-grid{
    display:grid;
    grid-template-columns:repeat(6, 1fr);
    gap:0.6rem;
  }
  .result-card{ border:1px solid rgba(57,255,20,0.25); overflow:hidden; }
  .result-card .pigeon-img-box{ border:none; }
  .result-card.in-target{ border-color:#39ff14; box-shadow:0 0 10px rgba(57,255,20,0.25) inset; }
  .result-card-body{ padding:0.4rem 0.3rem; }
  .result-num{ font-size:11px; letter-spacing:0.03em; color:#e8e8e8; text-align:center; }
  .result-rarity-line{ font-size:9px; letter-spacing:0.03em; color:#ffd700; text-shadow:0 0 3px rgba(255,215,0,0.3); text-align:center; }

  @media (max-width:700px){
    body{ padding:4vh 2.5vw 6vh; }
    .sw-panel{ padding:1rem 0.75rem; }
    .result-grid{ gap:0.25rem; }
    .result-card-body{ padding:0.3rem 0.15rem; }
    .result-num{ font-size:9px; }
    .result-rarity-line{ display:none; }
    .card-select-toggle{ width:1.4em; height:1.4em; line-height:1.4em; font-size:11px; }
  }

  /* ---- infinite scroll ---- */
  .scroll-sentinel{ height:1px; }
  .load-more-note{
    text-align:center;
    font-size:11px;
    letter-spacing:0.1em;
    color:rgba(0,255,242,0.6);
    padding:1.5rem 0;
    text-transform:uppercase;
  }
  .end-of-collection-note{
    text-align:center;
    font-size:10px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.3);
    padding:1.5rem 0;
    text-transform:uppercase;
  }

  /* ---- pagination (kept for detail-only contexts; browse now uses
     infinite scroll instead) ---- */
  .pagination-row{ display:flex; justify-content:center; gap:0.75rem; margin-top:1.5rem; }
  .page-btn{
    background:transparent;
    border:1px solid rgba(57,255,20,0.5);
    color:#39ff14;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.65em 1.3em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .page-btn:hover:not(:disabled){ background:rgba(57,255,20,0.1); }
  .page-btn:disabled{ opacity:0.3; cursor:not-allowed; }
  .loading-note{
    text-align:center;
    font-size:11px;
    letter-spacing:0.1em;
    color:rgba(0,255,242,0.6);
    padding:1.5rem 0;
    text-transform:uppercase;
  }

  /* ---- detail screen ---- */
  .detail-eyebrow{
    text-align:center;
    font-size:11px;
    letter-spacing:0.2em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    margin-bottom:0.75rem;
    text-transform:uppercase;
  }
  .detail-num{ text-align:center; font-size:22px; letter-spacing:0.05em; color:#fff; margin-bottom:1.25rem; }
  .detail-img-large{ width:100%; max-width:300px; margin:0 auto 1.25rem; }
  .detail-field{
    display:flex;
    justify-content:space-between;
    max-width:460px;
    margin:0 auto 0.7rem;
    font-size:12px;
    letter-spacing:0.05em;
  }
  .df-label{ color:rgba(232,232,232,0.45); text-transform:uppercase; }
  .df-value{ color:#e8e8e8; text-align:right; word-break:break-all; }
  .df-value.not-indexed{ color:#ff003c; text-shadow:0 0 4px rgba(255,0,60,0.3); }
  .df-value.rarity{ color:#ffd700; text-shadow:0 0 4px rgba(255,215,0,0.3); }
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
    max-width:560px;
    margin:0 auto 0.5rem;
  }
  .trait-cell{ border:1px solid rgba(57,255,20,0.2); padding:0.6rem 0.75rem; text-align:center; }
  .trait-cell .tc-label{ font-size:9px; letter-spacing:0.15em; color:rgba(232,232,232,0.4); margin-bottom:0.35rem; text-transform:uppercase; }
  .trait-cell .tc-value{ font-size:13px; letter-spacing:0.03em; color:#39ff14; text-shadow:0 0 4px rgba(57,255,20,0.3); }
  .tech-meta{ max-width:560px; margin:1.25rem auto 0; border-top:1px dashed rgba(232,232,232,0.15); padding-top:1rem; }
  .tech-meta-title{ text-align:center; font-size:10px; letter-spacing:0.2em; color:rgba(232,232,232,0.35); margin-bottom:0.6rem; text-transform:uppercase; }
  .tech-meta-row{ display:flex; justify-content:space-between; font-size:10px; letter-spacing:0.02em; color:rgba(232,232,232,0.5); margin-bottom:0.35rem; }
  .tech-meta-row .value{ word-break:break-all; text-align:right; color:rgba(0,255,242,0.7); }
  .detail-actions{ display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap; margin-top:1.5rem; }
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
  .action-btn:hover{ background:rgba(57,255,20,0.1); }
  .action-btn.selected{ background:rgba(57,255,20,0.15); color:#fff; }

  /* ---- target assets sticky bar ---- */
  .target-bar{
    position:fixed;
    left:50%;
    bottom:0;
    transform:translateX(-50%);
    z-index:40;
    width:min(960px, 100%);
    background:#08080a;
    border-top:1px solid rgba(57,255,20,0.5);
    box-shadow:0 -4px 20px rgba(0,0,0,0.5);
    padding:0.75rem 1.25rem;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:1rem;
    cursor:pointer;
  }
  .target-bar .tb-label{ font-size:12px; letter-spacing:0.1em; color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.4); text-transform:uppercase; }
  .target-bar .tb-toggle{ font-size:11px; color:rgba(232,232,232,0.5); text-transform:uppercase; }

  /* ---- target summary / offer placeholder ---- */
  .target-summary-block{ max-width:480px; margin:0 auto; text-align:center; }
  .ts-label{ font-size:10px; letter-spacing:0.2em; color:rgba(232,232,232,0.4); margin:1.1rem 0 0.4rem; text-transform:uppercase; }
  .ts-label:first-child{ margin-top:0; }
  .ts-value{ font-size:13px; color:#e8e8e8; line-height:1.7; }
  .ts-count{
    margin-top:1rem;
    font-size:12px;
    letter-spacing:0.15em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    text-transform:uppercase;
  }
  .placeholder-card{
    border:1px dashed rgba(255,0,60,0.4);
    padding:1.75rem;
    text-align:center;
    max-width:440px;
    margin:1.5rem auto 0;
  }
  .placeholder-card .pc-title{ font-size:12px; letter-spacing:0.2em; color:#ff003c; text-shadow:0 0 6px rgba(255,0,60,0.4); margin-bottom:0.75rem; text-transform:uppercase; }
  .placeholder-card .pc-body{ font-size:11px; letter-spacing:0.05em; color:rgba(232,232,232,0.6); line-height:1.7; text-transform:uppercase; }

  .protocol-footer{
    text-align:center;
    font-size:10px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.3);
    margin-top:2.5rem;
    margin-bottom:4rem;
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
    <div class="sw-eyebrow-lines">// P!GE0N DATABASE<br>// C0LLECT!0N :: 3015</div>

    <!-- SCREEN 1: COLLECTION BROWSER (whole collection OR one owner's, per scope) -->
    <div id="screenBrowse">
      <div class="sw-panel" id="nodeHeaderPanel" style="display:none;">
        <div class="node-header">
          <div class="nh-label">TARGET N0DE</div>
          <div class="nh-addr" id="nodeAddr"></div>
          <div class="nh-count" id="nodeCount"></div>
        </div>
        <div style="text-align:center;">
          <a class="back-link" href="#" id="backToFullCollectionLink" style="margin:0;">[ ← BACK T0 FULL C0LLECT!0N ]</a>
        </div>
      </div>

      <div class="sw-panel">
        <div class="panel-title" id="searchPanelTitle">P!GE0N DATABASE</div>
        <div class="search-row">
          <input class="search-input" id="searchInput" placeholder="SEARCH P!GE0NS (NUMBER, TRA!T, 0R VALUE)...">
          <button class="bar-btn" id="searchBtn">[ SEARCH ]</button>
          <select class="sort-select" id="sortSelect">
            <option value="RARITY_ASC">[ S0RT ▼ ] RAR!TY :: RAREST F!RST</option>
            <option value="RARITY_DESC">RAR!TY :: C0MM0N F!RST</option>
            <option value="NAME_ASC">NAME A → Z</option>
            <option value="NAME_DESC">NAME Z → A</option>
          </select>
        </div>
        <div class="index-line" id="indexLine"></div>

        <div class="traits-block">
          <div class="traits-block-title">TRA!TS</div>
          <div id="traitRows"></div>
          <div class="traits-actions">
            <button class="bar-btn" id="addTraitBtn">[ + ADD TRA!T ]</button>
            <button class="clear-traits-btn" id="clearTraitsBtn">[ CLEAR TRA!TS ]</button>
          </div>
        </div>
      </div>

      <div class="sw-panel">
        <div class="status-line" id="statusLine"></div>
        <div id="resultsArea"></div>
        <div class="scroll-sentinel" id="scrollSentinel"></div>
        <div class="load-more-note" id="loadMoreNote" style="display:none;">L0AD!NG M0RE P!GE0NS...</div>
        <div class="end-of-collection-note" id="endOfCollectionNote" style="display:none;">// END 0F C0LLECT!0N</div>
      </div>
    </div>

    <!-- SCREEN 2: DETAIL -->
    <div class="sw-panel" id="screenDetail" style="display:none;">
      <div class="detail-eyebrow">// P!GE0N !DENT!F!ED</div>
      <div class="detail-num" id="detailNum"></div>
      <div class="detail-img-large pigeon-img-box" id="detailImgBox">[ IMAGE ]</div>
      <div class="detail-field"><span class="df-label">OWNER</span><span class="df-value" id="detailOwner"></span></div>
      <div class="detail-field" id="detailRarityRow" style="display:none;"><span class="df-label">RAR!TY</span><span class="df-value rarity" id="detailRarity"></span></div>
      <div class="detail-traits-title">TRA!TS</div>
      <div class="trait-grid" id="detailTraits"></div>
      <div class="tech-meta">
        <div class="tech-meta-title">TECHN!CAL METADATA</div>
        <div class="tech-meta-row"><span>NFT0KEN !D</span><span class="value" id="detailNftId"></span></div>
      </div>
      <div class="detail-actions">
        <button class="secondary-btn" id="backToBrowseBtn">[ ← BACK ]</button>
        <button class="action-btn" id="detailSelectBtn">[ SELECT ]</button>
      </div>
    </div>

    <!-- SCREEN 3: TARGET SUMMARY -->
    <div class="sw-panel" id="screenSummary" style="display:none;">
      <div class="detail-eyebrow">SCYLLA TARGET</div>
      <div class="target-summary-block">
        <div class="ts-label">OWNER</div>
        <div class="ts-value" id="summaryOwner"></div>
        <div class="ts-label">REQUEST!NG</div>
        <div class="ts-value" id="summaryList"></div>
        <div class="ts-count" id="summaryCount"></div>
      </div>
      <div class="placeholder-card" id="offerPlaceholder" style="display:none;">
        <div class="pc-title">// SCYLLA 0FFER BU!LDER</div>
        <div class="pc-body">TH!S PR0T0TYPE ST0PS HERE.<br>N0 0FFER HAS BEEN CREATED.<br>N0 WALLET C0NNECTED. N0 ASSETS M0VED.<br>NEXT PHASE :: SELECT Y0UR P!GE0NS + XRP.</div>
      </div>
      <div class="detail-actions">
        <button class="secondary-btn" id="backFromSummaryBtn">[ ← BACK ]</button>
        <button class="action-btn" id="continueToOfferBtn">[ C0NT!NUE T0 0FFER ]</button>
      </div>
    </div>

    <div class="protocol-footer">TH!S !S A PR0T0TYPE !NTERFACE. N0 ASSETS CAN BE M0VED, S!GNED, 0R TRANSFERRED.</div>
  </div>

  <div class="target-bar" id="targetBar" style="display:none;">
    <span class="tb-label" id="targetBarLabel">TARGET ASSETS :: 0</span>
    <span class="tb-toggle">[ V!EW ▲ ]</span>
  </div>

<script>
(function(){

  // ---- Client-side state ----
  var PAGE_SIZE = 36;
  var state = {
    scope: null,              // null (whole collection) or { wallet, ownerShort }
    skip: 0,                  // how many items already loaded, for infinite scroll
    hasMore: true,
    loading: false,
    total: null,
    items: [],                // everything loaded so far in the current browse/search mode
    scopeAllItems: [],         // full resolved list for the current wallet scope (client-side filtered)
    mode: 'browse',            // 'browse' | 'search' | 'scoped'
    sort: 'RARITY_ASC',
    traitFilters: [],         // [{ id, category, value }]
    nextTraitRowId: 1,
    traitCategories: null,     // [name, name, ...] — cheap, loaded once
    traitValuesCache: {},      // category -> [{value, count, percent}], fetched lazily per category
    collectionSizeApprox: 3015,
    currentDetail: null,
    targetAssets: {}          // nftId -> { nftId, number, image } — only while scope is a wallet
  };

  var el = {};
  ['searchInput','searchBtn','sortSelect','indexLine','traitRows','addTraitBtn','clearTraitsBtn',
   'statusLine','resultsArea','scrollSentinel','loadMoreNote','endOfCollectionNote',
   'nodeHeaderPanel','nodeAddr','nodeCount','backToFullCollectionLink','searchPanelTitle',
   'screenBrowse','screenDetail','screenSummary',
   'detailNum','detailImgBox','detailOwner','detailRarityRow','detailRarity','detailTraits','detailNftId',
   'backToBrowseBtn','detailSelectBtn',
   'summaryOwner','summaryList','summaryCount','offerPlaceholder','backFromSummaryBtn','continueToOfferBtn',
   'targetBar','targetBarLabel'
  ].forEach(function(id){ el[id] = document.getElementById(id); });

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function showScreen(name){
    el.screenBrowse.style.display = name === 'browse' ? '' : 'none';
    el.screenDetail.style.display = name === 'detail' ? '' : 'none';
    el.screenSummary.style.display = name === 'summary' ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function api(params){
    var qs = Object.keys(params)
      .filter(function(k){ return params[k] !== undefined && params[k] !== null; })
      .map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    return fetch('/api/pigeons?' + qs).then(function(r){ return r.json(); });
  }

  // ---- Target assets (owner-scoped multi-select) ----
  function targetCount(){ return Object.keys(state.targetAssets).length; }
  function renderTargetBar(){
    if (!state.scope){ el.targetBar.style.display = 'none'; return; }
    el.targetBar.style.display = 'flex';
    el.targetBarLabel.textContent = 'TARGET ASSETS :: ' + targetCount();
  }
  function toggleTargetAsset(p){
    if (state.targetAssets[p.nftId]) delete state.targetAssets[p.nftId];
    else state.targetAssets[p.nftId] = { nftId: p.nftId, number: p.number, image: p.image };
    renderTargetBar();
    refreshCardSelectionStates();
  }
  function refreshCardSelectionStates(){
    document.querySelectorAll('.result-card').forEach(function(card){
      var id = card.getAttribute('data-nftid');
      var inTarget = !!state.targetAssets[id];
      card.classList.toggle('in-target', inTarget);
      var btn = card.querySelector('.select-btn');
      if (btn){ btn.classList.toggle('selected', inTarget); btn.textContent = inTarget ? '[ SELECTED ]' : '[ SELECT ]'; }
      var toggle = card.querySelector('.card-select-toggle');
      if (toggle){ toggle.classList.toggle('selected', inTarget); toggle.textContent = inTarget ? '✓' : '+'; }
    });
    if (el.detailSelectBtn && state.currentDetail && state.scope){
      var d = !!state.targetAssets[state.currentDetail.nftId];
      el.detailSelectBtn.classList.toggle('selected', d);
      el.detailSelectBtn.textContent = d ? '[ SELECTED ]' : '[ SELECT ]';
    }
  }
  el.targetBar.addEventListener('click', function(){ openSummary(); });

  function openSummary(){
    var items = Object.keys(state.targetAssets).map(function(k){ return state.targetAssets[k]; });
    el.summaryOwner.textContent = state.scope ? state.scope.ownerShort : '';
    el.summaryList.innerHTML = items.length
      ? items.map(function(p){ return '\\uD83D\\uDC26 P!GE0N #' + (p.number !== null ? p.number : '????'); }).join('<br>')
      : '<span style="color:rgba(232,232,232,0.3);">N0THING SELECTED YET</span>';
    el.summaryCount.textContent = 'TARGET ASSETS :: ' + items.length;
    el.offerPlaceholder.style.display = 'none';
    showScreen('summary');
  }
  el.backFromSummaryBtn.addEventListener('click', function(){ showScreen('browse'); });
  el.continueToOfferBtn.addEventListener('click', function(){ el.offerPlaceholder.style.display = ''; });

  // ---- SELECT behaviour: whole-collection scope picks a TARGET (auto
  // owner lookup + transition); wallet scope toggles a TARGET ASSET. ----
  function handleSelect(p){
    if (!state.scope){
      enterOwnerScope(p);
    } else {
      toggleTargetAsset(p);
    }
  }

  function enterOwnerScope(targetPigeon){
    if (!targetPigeon.owner){
      alert('OWNER N0T !NDEXED F0R TH!S P!GE0N YET — TRY ANOTHER, OR !NSPECT !T AGA!N SH0RTLY.');
      return;
    }
    state.scope = { wallet: targetPigeon.owner, ownerShort: targetPigeon.ownerShort || targetPigeon.owner };
    state.targetAssets = {};
    state.targetAssets[targetPigeon.nftId] = { nftId: targetPigeon.nftId, number: targetPigeon.number, image: targetPigeon.image };
    state.traitFilters = [];
    renderTraitRows();
    el.searchInput.value = '';
    el.nodeHeaderPanel.style.display = '';
    el.nodeAddr.textContent = state.scope.ownerShort;
    el.searchPanelTitle.textContent = 'TARGET N0DE C0LLECT!0N';
    el.resultsArea.innerHTML = '<div class="loading-note">L0AD!NG H0LDER\\'S REAL P!GE0NS...</div>';
    showScreen('browse');
    renderTargetBar();
    api({ wallet: targetPigeon.owner }).then(function(data){
      state.scopeAllItems = data.items || [];
      el.nodeCount.textContent = 'P!GE0NS HELD :: ' + state.scopeAllItems.length;
      runScopedQuery();
    }).catch(function(){
      el.resultsArea.innerHTML = emptyStateHtml('// S!GNAL_L0ST', ['C0ULD N0T LOAD TH!S WALLET. TRY AGA!N.'], false);
    });
  }

  el.backToFullCollectionLink.addEventListener('click', function(e){
    e.preventDefault();
    state.scope = null;
    state.scopeAllItems = [];
    state.targetAssets = {};
    state.traitFilters = [];
    renderTraitRows();
    el.nodeHeaderPanel.style.display = 'none';
    el.searchPanelTitle.textContent = 'P!GE0N DATABASE';
    el.searchInput.value = '';
    renderTargetBar();
    startCollectionBrowse();
  });

  function emptyStateHtml(title, lines, showClear){
    return '<div class="empty-state">' +
      '<div class="es-title">' + escapeHtml(title) + '</div>' +
      lines.map(function(l){ return '<div class="es-line">' + escapeHtml(l) + '</div>'; }).join('') +
      (showClear ? '<button class="bar-btn" id="clearSearchBtn" style="margin-top:0.75rem;">[ CLEAR SEARCH ]</button>' : '') +
    '</div>';
  }

  // ---- Card rendering (minimal chrome: image + number + rarity + a
  // corner select toggle — 6 columns doesn't leave room for more; tap the
  // image to INSPECT for the full trait set). ----
  function resultCardHtml(p){
    var rarityLine = p.rarityRank ? '<div class="result-rarity-line">#' + p.rarityRank + '</div>' : '';
    var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : '[ IMAGE ]';
    var num = p.number !== null ? '#' + p.number : '#????';
    var inTarget = !!state.targetAssets[p.nftId];
    return '<div class="result-card' + (inTarget ? ' in-target' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '">' +
      '<div class="pigeon-img-box" data-nftid="' + escapeHtml(p.nftId) + '">' +
        img +
        '<button class="card-select-toggle' + (inTarget ? ' selected' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '" title="SELECT">' + (inTarget ? '✓' : '+') + '</button>' +
      '</div>' +
      '<div class="result-card-body">' +
        '<div class="result-num">P!GE0N ' + num + '</div>' +
        rarityLine +
      '</div>' +
    '</div>';
  }

  function appendResults(newItems){
    if (!newItems.length) return;
    var grid = el.resultsArea.querySelector('.result-grid');
    if (!grid){
      el.resultsArea.innerHTML = '<div class="result-grid"></div>';
      grid = el.resultsArea.querySelector('.result-grid');
    }
    grid.insertAdjacentHTML('beforeend', newItems.map(resultCardHtml).join(''));
  }
  function renderResultsReplace(items){
    el.resultsArea.innerHTML = items.length ? '<div class="result-grid">' + items.map(resultCardHtml).join('') + '</div>' : '';
  }

  function wireResultClicks(container, source){
    container.addEventListener('click', function(e){
      var toggle = e.target.closest('.card-select-toggle');
      if (toggle){
        var tp = source().filter(function(x){ return x.nftId === toggle.getAttribute('data-nftid'); })[0];
        if (tp) handleSelect(tp);
        return;
      }
      var imgBox = e.target.closest('.pigeon-img-box');
      if (imgBox){ openDetail(imgBox.getAttribute('data-nftid')); }
    });
  }
  wireResultClicks(el.resultsArea, function(){ return state.items; });

  // ---- Trait data: fetched once, real categories/values/percentages
  // straight from Deeptide's collection-wide trait-card counts (exact, not
  // sampled) — no more lazy per-category round trips needed. ----
  function ensureTraitsLoaded(){
    if (state.traitCategories) return Promise.resolve(state.traitCategories);
    return api({ traits: 1 }).then(function(data){
      state.traitCategories = data.categories || {};
      state.collectionSizeApprox = data.collectionSizeApprox || state.collectionSizeApprox;
      refreshIndexLine(data.numberMapStats);
      return state.traitCategories;
    });
  }
  function refreshIndexLine(stats){
    if (!stats || !stats.count){
      el.indexLine.textContent = '!NDEX!NG :: JUST GETT!NG STARTED';
      return;
    }
    var pct = Math.round((stats.count / state.collectionSizeApprox) * 1000) / 10;
    el.indexLine.textContent = 'NUMBER SEARCH !NDEX :: ' + stats.count + ' / ~' + state.collectionSizeApprox + ' (' + pct + '%)' + (stats.inProgress ? ' :: ST!LL !NDEX!NG...' : ' :: C0MPLETE');
  }

  // ---- Infinite-scroll collection browse (real, live, always complete —
  // Deeptide's own listings endpoint, no KV involved) ----
  function startCollectionBrowse(){
    state.mode = 'collection';
    state.skip = 0;
    state.items = [];
    state.hasMore = true;
    state.total = null;
    el.endOfCollectionNote.style.display = 'none';
    el.resultsArea.innerHTML = '';
    loadMoreCollection();
  }
  function loadMoreCollection(){
    if (state.loading || !state.hasMore || state.scope) return;
    state.loading = true;
    el.loadMoreNote.style.display = '';
    var filters = activeFilters();
    api({
      skip: state.skip,
      limit: PAGE_SIZE,
      sort: state.sort,
      filters: filters.length ? JSON.stringify(filters) : undefined
    }).then(function(data){
      state.loading = false;
      el.loadMoreNote.style.display = 'none';
      var newItems = data.items || [];
      state.items = state.items.concat(newItems);
      state.skip += newItems.length;
      state.total = typeof data.total === 'number' ? data.total : state.total;
      state.hasMore = !!data.hasMore && newItems.length > 0;
      appendResults(newItems);
      var note = filters.length ? ' :: TRA!T F!LTERED' : '';
      el.statusLine.innerHTML = 'RESULTS :: <span class="hi">' + (state.total !== null ? state.total : state.items.length) + '</span>' + note;
      if (!state.items.length){
        el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0N MATCH', filters.length ? ['N0 P!GE0NS MATCH ALL SELECTED TRA!TS.'] : ['TRY AGA!N.'], filters.length > 0);
      } else if (!state.hasMore){
        el.endOfCollectionNote.style.display = '';
      }
    }).catch(function(){
      state.loading = false;
      el.loadMoreNote.style.display = 'none';
      if (!state.items.length) el.resultsArea.innerHTML = emptyStateHtml('// S!GNAL_L0ST', ['C0ULD N0T REACH THE C0LLECT!0N. TRY AGA!N.'], false);
    });
  }
  var scrollObserver = new IntersectionObserver(function(entries){
    if (entries[0].isIntersecting) loadMoreCollection();
  }, { rootMargin: '600px' });
  scrollObserver.observe(el.scrollSentinel);

  // ---- Trait stack (stackable AND filters) ----
  function renderTraitRows(){
    var cats = state.traitCategories ? Object.keys(state.traitCategories) : [];
    el.traitRows.innerHTML = state.traitFilters.map(function(row){
      var catOptions = cats.map(function(c){
        return '<option value="' + escapeHtml(c) + '"' + (row.category === c ? ' selected' : '') + '>' + escapeHtml(c.toUpperCase()) + '</option>';
      }).join('');
      var vals = (row.category && state.traitCategories[row.category]) || [];
      var valOptions = vals.map(function(v){
        var pct = v.percent !== null && v.percent !== undefined ? ' (' + v.percent + '%)' : '';
        return '<option value="' + escapeHtml(v.value) + '"' + (row.value === v.value ? ' selected' : '') + '>' + escapeHtml(v.value.toUpperCase()) + pct + '</option>';
      }).join('');
      return '<div class="trait-row" data-id="' + row.id + '">' +
        '<select class="trait-cat-select" data-id="' + row.id + '"><option value="">[ CATEG0RY ▼ ]</option>' + catOptions + '</select>' +
        '<select class="trait-val-select" data-id="' + row.id + '"' + (row.category ? '' : ' disabled') + '><option value="">[ VALUE ▼ ]</option>' + valOptions + '</select>' +
        '<button class="trait-row-remove" data-id="' + row.id + '">&times;</button>' +
      '</div>';
    }).join('');
  }
  el.addTraitBtn.addEventListener('click', function(){
    ensureTraitsLoaded().then(function(){
      state.traitFilters.push({ id: state.nextTraitRowId++, category: '', value: '' });
      renderTraitRows();
    });
  });
  el.clearTraitsBtn.addEventListener('click', function(){
    state.traitFilters = [];
    renderTraitRows();
    runQuery();
  });
  el.traitRows.addEventListener('change', function(e){
    var id = parseInt(e.target.getAttribute('data-id'), 10);
    var row = state.traitFilters.filter(function(r){ return r.id === id; })[0];
    if (!row) return;
    if (e.target.classList.contains('trait-cat-select')){ row.category = e.target.value; row.value = ''; }
    else if (e.target.classList.contains('trait-val-select')){ row.value = e.target.value; }
    renderTraitRows();
    runQuery();
  });
  el.traitRows.addEventListener('click', function(e){
    var btn = e.target.closest('.trait-row-remove');
    if (!btn) return;
    var id = parseInt(btn.getAttribute('data-id'), 10);
    state.traitFilters = state.traitFilters.filter(function(r){ return r.id !== id; });
    renderTraitRows();
    runQuery();
  });

  function activeFilters(){
    return state.traitFilters.filter(function(r){ return r.category && r.value; }).map(function(r){ return { trait: r.category, value: r.value }; });
  }

  // ---- Unified query dispatch: wallet-scope filters client-side over the
  // full holder list (already loaded whole); whole-collection scope always
  // goes through the real, live, paginated collection endpoint. ----
  function runQuery(){
    if (state.scope) runScopedQuery();
    else startCollectionBrowse();
  }

  function runScopedQuery(){
    var q = el.searchInput.value.trim().toLowerCase();
    var filters = activeFilters();
    var list = state.scopeAllItems.filter(function(p){
      if (filters.length && !filters.every(function(f){
        return p.attributes.some(function(a){ return a.trait_type === f.trait && a.value === f.value; });
      })) return false;
      if (q){
        var numMatch = p.number !== null && String(p.number).indexOf(q.replace('#','')) !== -1;
        var traitMatch = p.attributes.some(function(a){ return a.value.toLowerCase().indexOf(q) !== -1 || a.trait_type.toLowerCase().indexOf(q) !== -1; });
        if (!numMatch && !traitMatch) return false;
      }
      return true;
    });
    if (state.sort === 'RARITY_ASC' || state.sort === 'RARITY_DESC'){
      list = list.slice().sort(function(a, b){
        var ar = a.rarityRank === null ? Infinity : a.rarityRank, br = b.rarityRank === null ? Infinity : b.rarityRank;
        return state.sort === 'RARITY_DESC' ? br - ar : ar - br;
      });
    }
    state.items = list;
    el.statusLine.innerHTML = 'RESULTS :: <span class="hi">' + list.length + '</span>' + (list.length === 1 ? '<br>P!GE0N #' + list[0].number : '');
    if (!list.length){
      el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0N MATCH', ['QUERY :: "' + (q || '(traits)') + '"'], true);
      wireClearSearch();
    } else {
      renderResultsReplace(list);
    }
  }

  // Number search is exact and direct via the number->NFTokenID map; any
  // other typed text is treated as a trait-value guess (matched against the
  // already-loaded real trait data, no extra round trips) and applied as a
  // filter through the same AND-filter mechanism as the TRAITS stack.
  function runSearchBox(){
    var q = el.searchInput.value.trim();
    if (!q){ runQuery(); return; }
    var isNumber = /^#?\\d+$/.test(q);
    if (isNumber){
      el.resultsArea.innerHTML = '<div class="loading-note">SEARCH!NG...</div>';
      el.statusLine.textContent = '';
      api({ number: q.replace('#', '') }).then(function(data){
        state.items = data.items || [];
        if (!state.items.length){
          el.statusLine.innerHTML = 'RESULTS :: <span class="hi">0</span>';
          el.resultsArea.innerHTML = data.notIndexed
            ? emptyStateHtml('// N0T YET !NDEXED', ['QUERY :: "' + q + '"', 'TH!S P!GE0N HAS N0T BEEN SEEN BY THE NUMBER !NDEX YET.', 'TRY AGA!N SH0RTLY — !T CRAWLS THE C0LLECT!0N !N THE BACKGR0UND.'], true)
            : emptyStateHtml('// N0 P!GE0N MATCH', ['QUERY :: "' + q + '"'], true);
          wireClearSearch();
          return;
        }
        el.statusLine.innerHTML = 'RESULTS :: <span class="hi">1</span><br>P!GE0N #' + state.items[0].number;
        renderResultsReplace(state.items);
      }).catch(function(){
        el.resultsArea.innerHTML = emptyStateHtml('// S!GNAL_L0ST', ['SEARCH FA!LED. TRY AGA!N.'], false);
      });
      return;
    }
    var kv = q.match(/^([A-Za-z]+)\\s*:\\s*(.+)$/);
    ensureTraitsLoaded().then(function(cats){
      var trait, value;
      if (kv){
        var catKey = Object.keys(cats).filter(function(c){ return c.toLowerCase() === kv[1].toLowerCase(); })[0];
        if (catKey){
          var exact = (cats[catKey] || []).filter(function(v){ return v.value.toLowerCase() === kv[2].trim().toLowerCase(); })[0];
          trait = catKey; value = exact ? exact.value : kv[2].trim();
        }
      }
      if (!trait){
        for (var c in cats){
          var hit = (cats[c] || []).filter(function(v){ return v.value.toLowerCase().indexOf(q.toLowerCase()) !== -1; })[0];
          if (hit){ trait = c; value = hit.value; break; }
        }
      }
      if (!trait){
        el.statusLine.innerHTML = 'RESULTS :: <span class="hi">0</span>';
        el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0N MATCH', ['QUERY :: "' + q + '"', 'N0 MATCH!NG TRA!T VALUE F0UND.'], true);
        wireClearSearch();
        return;
      }
      state.traitFilters = [{ id: state.nextTraitRowId++, category: trait, value: value }];
      renderTraitRows();
      startCollectionBrowse();
    });
  }

  function wireClearSearch(){
    var btn = document.getElementById('clearSearchBtn');
    if (btn) btn.addEventListener('click', function(){
      el.searchInput.value = '';
      state.traitFilters = [];
      renderTraitRows();
      if (state.scope) runScopedQuery(); else startCollectionBrowse();
    });
  }

  el.searchBtn.addEventListener('click', runSearchBox);
  el.searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') runSearchBox(); });
  el.sortSelect.addEventListener('change', function(){
    state.sort = el.sortSelect.value;
    runQuery();
  });

  // ---- Inspect / detail ----
  function traitCellHtml(a){
    return '<div class="trait-cell"><div class="tc-label">' + escapeHtml(a.trait_type) + '</div><div class="tc-value">' + escapeHtml(a.value) + '</div></div>';
  }
  function updateDetailRarity(p){
    if (p && p.rarityRank){ el.detailRarityRow.style.display = ''; el.detailRarity.textContent = p.rarityRank + (p.rarityTotal ? ' / ' + p.rarityTotal : ''); }
    else el.detailRarityRow.style.display = 'none';
  }
  function findKnown(nftId){
    return state.items.filter(function(p){ return p.nftId === nftId; })[0] ||
      state.scopeAllItems.filter(function(p){ return p.nftId === nftId; })[0];
  }
  function openDetail(nftId){
    var known = findKnown(nftId);
    el.detailNum.textContent = known && known.number !== null ? 'P!GE0N #' + known.number : 'P!GE0N ...';
    el.detailImgBox.innerHTML = known && known.image ? '<img src="' + escapeHtml(known.image) + '" alt="">' : '[ IMAGE ]';
    el.detailOwner.textContent = known && known.ownerShort ? known.ownerShort : '...';
    el.detailOwner.classList.remove('not-indexed');
    el.detailTraits.innerHTML = known ? known.attributes.map(traitCellHtml).join('') : '';
    el.detailNftId.textContent = nftId;
    updateDetailRarity(known);
    state.currentDetail = known || { nftId: nftId, number: null, owner: null, ownerShort: null, attributes: [] };
    showScreen('detail');
    refreshCardSelectionStates();

    api({ detail: nftId }).then(function(data){
      if (!data.item){
        state.currentDetail = known || { nftId: nftId, number: null, owner: null, ownerShort: null, attributes: [] };
        el.detailOwner.textContent = 'N0T !NDEXED';
        el.detailOwner.classList.add('not-indexed');
        return;
      }
      var p = data.item;
      state.currentDetail = p;
      el.detailNum.textContent = p.number !== null ? 'P!GE0N #' + p.number : 'P!GE0N ...';
      el.detailImgBox.innerHTML = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="">' : '[ IMAGE ]';
      el.detailTraits.innerHTML = p.attributes.map(traitCellHtml).join('');
      updateDetailRarity(p);
      if (p.ownerShort){ el.detailOwner.textContent = p.ownerShort; el.detailOwner.classList.remove('not-indexed'); }
      else { el.detailOwner.textContent = 'N0T !NDEXED'; el.detailOwner.classList.add('not-indexed'); }
      refreshCardSelectionStates();
    }).catch(function(){
      el.detailOwner.textContent = 'N0T !NDEXED';
      el.detailOwner.classList.add('not-indexed');
    });
  }
  el.backToBrowseBtn.addEventListener('click', function(){ showScreen('browse'); });
  el.detailSelectBtn.addEventListener('click', function(){
    if (state.currentDetail) handleSelect(state.currentDetail);
  });

  // ---- Initial load ----
  ensureTraitsLoaded();
  startCollectionBrowse();

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
