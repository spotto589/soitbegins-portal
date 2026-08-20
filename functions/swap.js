// ─────────────────────────────────────────────────────────────────────────
// Σκύλλα SWAP — Phase 1B: real Pigeon collection explorer.
//
// Every Pigeon shown here is real: real NFTokenID, real IPFS image, real
// on-chain owner, real trait attributes — pulled live from the XRPL (via
// Clio's nfts_by_issuer/nft_info) and the collection's own IPFS metadata,
// through /api/pigeons (see functions/api/pigeons.js and the data-access
// layer at the bottom of functions/_shared.js). There is no mock data left
// in this file.
//
// Still, on purpose, nothing here connects a wallet, calls Xaman, signs
// anything, transfers XRP, or submits any XRPL transaction. "OFFER FOR
// THIS PIGEON" only sets a draft target — building and sending a real
// offer is explicitly the next phase, not this one.
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

  /* ---- search / filter bar ---- */
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
  .bar-btn.active{ background:rgba(57,255,20,0.15); color:#fff; }
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
  .search-hint{
    text-align:center;
    font-size:10px;
    letter-spacing:0.05em;
    color:rgba(232,232,232,0.3);
    margin-bottom:0.25rem;
    text-transform:uppercase;
  }

  /* ---- traits filter panel ---- */
  .traits-panel{
    border-top:1px dashed rgba(57,255,20,0.25);
    margin-top:1rem;
    padding-top:1rem;
    display:none;
  }
  .traits-panel.open{ display:block; }
  .traits-cats{
    display:flex;
    flex-wrap:wrap;
    gap:0.5rem;
    margin-bottom:0.9rem;
  }
  .trait-cat-btn{
    background:transparent;
    border:1px solid rgba(57,255,20,0.3);
    color:rgba(232,232,232,0.6);
    font-family:inherit;
    font-size:10px;
    letter-spacing:0.1em;
    padding:0.5em 0.9em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .trait-cat-btn.selected{ border-color:#39ff14; color:#39ff14; }
  .traits-values{
    display:flex;
    flex-wrap:wrap;
    gap:0.5rem;
  }
  .trait-value-chip{
    display:inline-flex;
    align-items:center;
    gap:0.4em;
    border:1px solid rgba(0,255,242,0.3);
    color:rgba(232,232,232,0.7);
    font-size:10px;
    letter-spacing:0.06em;
    padding:0.4em 0.7em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .trait-value-chip:hover{ border-color:#00fff2; }
  .trait-value-chip.selected{ border-color:#00fff2; color:#00fff2; background:rgba(0,255,242,0.08); }
  .traits-empty-note{
    font-size:10px;
    letter-spacing:0.08em;
    color:rgba(232,232,232,0.35);
    text-transform:uppercase;
  }

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

  /* ---- empty / no-match state ---- */
  .empty-state{
    text-align:center;
    padding:2rem 0;
  }
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
  .empty-state .es-note{
    font-size:10px;
    letter-spacing:0.05em;
    color:rgba(232,232,232,0.35);
    margin:0.75rem 0 1.25rem;
    text-transform:uppercase;
  }

  /* ---- pigeon image box ---- */
  .pigeon-img-box{
    aspect-ratio:1;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    background:repeating-linear-gradient(
      45deg, rgba(57,255,20,0.04) 0px, rgba(57,255,20,0.04) 6px, transparent 6px, transparent 12px
    );
    border:1px dashed rgba(57,255,20,0.15);
    font-size:10px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.3);
  }
  .pigeon-img-box img{ width:100%; height:100%; object-fit:cover; display:block; }

  /* ---- collection grid / cards ---- */
  .result-grid{
    display:grid;
    grid-template-columns:repeat(auto-fill, minmax(160px, 1fr));
    gap:0.9rem;
  }
  .result-card{
    border:1px solid rgba(57,255,20,0.25);
    overflow:hidden;
  }
  .result-card .pigeon-img-box{ border:none; border-bottom:1px solid rgba(57,255,20,0.15); }
  .result-card-body{ padding:0.65rem; }
  .result-num{ font-size:12px; letter-spacing:0.05em; color:#e8e8e8; margin-bottom:0.45rem; }
  .result-trait-line{
    font-size:10px;
    letter-spacing:0.02em;
    color:rgba(232,232,232,0.55);
    margin-bottom:0.2rem;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .result-trait-line .tl-label{ color:rgba(232,232,232,0.35); }
  .inspect-btn{
    display:block;
    width:100%;
    margin-top:0.55rem;
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
  .inspect-btn:hover{ background:rgba(0,255,242,0.1); }

  /* ---- pagination ---- */
  .pagination-row{
    display:flex;
    justify-content:center;
    gap:0.75rem;
    margin-top:1.5rem;
  }
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

  /* ---- detail / offer placeholder screens ---- */
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
  .trait-cell .tc-label{
    font-size:9px; letter-spacing:0.15em; color:rgba(232,232,232,0.4); margin-bottom:0.35rem; text-transform:uppercase;
  }
  .trait-cell .tc-value{ font-size:13px; letter-spacing:0.03em; color:#39ff14; text-shadow:0 0 4px rgba(57,255,20,0.3); }
  .tech-meta{
    max-width:560px;
    margin:1.25rem auto 0;
    border-top:1px dashed rgba(232,232,232,0.15);
    padding-top:1rem;
  }
  .tech-meta-title{
    text-align:center;
    font-size:10px;
    letter-spacing:0.2em;
    color:rgba(232,232,232,0.35);
    margin-bottom:0.6rem;
    text-transform:uppercase;
  }
  .tech-meta-row{
    display:flex;
    justify-content:space-between;
    font-size:10px;
    letter-spacing:0.02em;
    color:rgba(232,232,232,0.5);
    margin-bottom:0.35rem;
  }
  .tech-meta-row .value{ word-break:break-all; text-align:right; color:rgba(0,255,242,0.7); }
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
  .action-btn:hover{ background:rgba(57,255,20,0.1); }

  .offer-draft-card{
    border:1px dashed rgba(57,255,20,0.45);
    padding:1.75rem;
    text-align:center;
    max-width:440px;
    margin:0 auto;
  }
  .offer-draft-title{ font-size:12px; letter-spacing:0.25em; color:#fff; margin-bottom:1.25rem; text-transform:uppercase; }
  .offer-draft-label{ font-size:10px; letter-spacing:0.2em; color:rgba(232,232,232,0.4); margin:1rem 0 0.4rem; text-transform:uppercase; }
  .offer-draft-label:first-of-type{ margin-top:0; }
  .offer-draft-value{ font-size:14px; color:#e8e8e8; }
  .offer-draft-status{
    margin-top:1.25rem;
    font-size:11px;
    letter-spacing:0.15em;
    color:#ff003c;
    text-shadow:0 0 6px rgba(255,0,60,0.4);
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
    <div class="sw-eyebrow-lines">// P!GE0N DATABASE<br>// C0LLECT!0N :: P!GE0NS</div>

    <!-- SCREEN 1: BROWSE / SEARCH -->
    <div id="screenBrowse">
      <div class="sw-panel">
        <div class="search-row">
          <input class="search-input" id="searchInput" placeholder="SEARCH P!GE0NS (NUMBER, TRA!T, 0R VALUE)...">
          <button class="bar-btn" id="searchBtn">[ SEARCH ]</button>
          <button class="bar-btn" id="traitsBtn">[ TRA!TS ▼ ]</button>
          <select class="sort-select" id="sortSelect">
            <option value="NUM_ASC">[ S0RT ▼ ] NUMBER L0W → H!GH</option>
            <option value="NUM_DESC">NUMBER H!GH → L0W</option>
          </select>
        </div>
        <div class="search-hint">TRY A NUMBER (e.g. 123), A TRA!T CATEG0RY (e.g. background), 0R A VALUE (e.g. cyan)</div>

        <div class="traits-panel" id="traitsPanel">
          <div class="traits-cats" id="traitsCats"></div>
          <div class="traits-values" id="traitsValues"></div>
          <div class="traits-empty-note" id="traitsEmptyNote" style="display:none;">N0 TRA!TS !NDEXED YET — BR0WSE THE C0LLECT!0N T0 D!SC0VER CATEG0R!ES</div>
        </div>
      </div>

      <div class="sw-panel">
        <div class="status-line" id="statusLine"></div>
        <div id="resultsArea"></div>
        <div class="pagination-row" id="paginationRow" style="display:none;">
          <button class="page-btn" id="prevPageBtn" disabled>[ ← PREV PAGE ]</button>
          <button class="page-btn" id="nextPageBtn">[ NEXT PAGE → ]</button>
        </div>
      </div>
    </div>

    <!-- SCREEN 2: DETAIL -->
    <div class="sw-panel" id="screenDetail" style="display:none;">
      <div class="detail-eyebrow">// P!GE0N !DENT!F!ED</div>
      <div class="detail-num" id="detailNum"></div>
      <div class="detail-img-large pigeon-img-box" id="detailImgBox">[ IMAGE ]</div>
      <div class="detail-field"><span class="df-label">CURRENT H0LDER</span><span class="df-value" id="detailOwner"></span></div>
      <div class="detail-traits-title">TRA!TS</div>
      <div class="trait-grid" id="detailTraits"></div>
      <div class="tech-meta">
        <div class="tech-meta-title">TECHN!CAL METADATA</div>
        <div class="tech-meta-row"><span>NFT0KEN !D</span><span class="value" id="detailNftId"></span></div>
      </div>
      <div class="detail-actions">
        <button class="secondary-btn" id="backToBrowseBtn">[ ← BACK T0 C0LLECT!0N ]</button>
        <button class="action-btn" id="offerForBtn">[ OFFER F0R TH!S P!GE0N ]</button>
      </div>
    </div>

    <!-- SCREEN 3: OFFER DRAFT PLACEHOLDER -->
    <div class="sw-panel" id="screenOffer" style="display:none;">
      <div class="detail-eyebrow">SCYLLA OFFER BUILDER</div>
      <div class="offer-draft-card">
        <div class="offer-draft-title">SCYLLA OFFER</div>
        <div class="offer-draft-label">TARGET</div>
        <div class="offer-draft-value" id="offerTargetNum"></div>
        <div class="offer-draft-label">TARGET H0LDER</div>
        <div class="offer-draft-value" id="offerTargetOwner"></div>
        <div class="offer-draft-status">STATUS :: DRAFT</div>
      </div>
      <div class="detail-actions">
        <button class="secondary-btn" id="backToDetailBtn">[ ← BACK ]</button>
      </div>
    </div>

    <div class="protocol-footer">TH!S !S A PR0T0TYPE !NTERFACE. N0 ASSETS CAN BE M0VED, S!GNED, 0R TRANSFERRED.</div>
  </div>

<script>
(function(){

  var state = {
    mode: 'browse',           // 'browse' | 'search'
    markerStack: [],          // markers visited so far, for PREV PAGE
    currentMarker: null,      // marker used to fetch the CURRENT page (null = first page)
    nextMarker: null,         // marker returned for the next page
    items: [],
    sort: 'NUM_ASC',
    traitsData: null,         // { categories: {TraitType: [values...]} }
    selectedTraitCat: null,
    currentDetail: null       // the pigeon currently open in the detail screen
  };

  var el = {
    searchInput: document.getElementById('searchInput'),
    searchBtn: document.getElementById('searchBtn'),
    traitsBtn: document.getElementById('traitsBtn'),
    sortSelect: document.getElementById('sortSelect'),
    traitsPanel: document.getElementById('traitsPanel'),
    traitsCats: document.getElementById('traitsCats'),
    traitsValues: document.getElementById('traitsValues'),
    traitsEmptyNote: document.getElementById('traitsEmptyNote'),
    statusLine: document.getElementById('statusLine'),
    resultsArea: document.getElementById('resultsArea'),
    paginationRow: document.getElementById('paginationRow'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    screenBrowse: document.getElementById('screenBrowse'),
    screenDetail: document.getElementById('screenDetail'),
    screenOffer: document.getElementById('screenOffer'),
    detailNum: document.getElementById('detailNum'),
    detailImgBox: document.getElementById('detailImgBox'),
    detailOwner: document.getElementById('detailOwner'),
    detailTraits: document.getElementById('detailTraits'),
    detailNftId: document.getElementById('detailNftId'),
    backToBrowseBtn: document.getElementById('backToBrowseBtn'),
    offerForBtn: document.getElementById('offerForBtn'),
    offerTargetNum: document.getElementById('offerTargetNum'),
    offerTargetOwner: document.getElementById('offerTargetOwner'),
    backToDetailBtn: document.getElementById('backToDetailBtn')
  };

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function showScreen(name){
    el.screenBrowse.style.display = name === 'browse' ? '' : 'none';
    el.screenDetail.style.display = name === 'detail' ? '' : 'none';
    el.screenOffer.style.display = name === 'offer' ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function traitLine(attributes, wanted){
    var found = attributes.filter(function(a){ return wanted.indexOf(a.trait_type) !== -1; });
    return found;
  }

  function resultCardHtml(p){
    var previewTraits = p.attributes.slice(0, 3);
    var traitLines = previewTraits.map(function(a){
      return '<div class="result-trait-line"><span class="tl-label">' + escapeHtml(a.trait_type.toUpperCase()) + ' ::</span> ' + escapeHtml(a.value) + '</div>';
    }).join('');
    var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : '[ IMAGE ]';
    var num = p.number !== null ? '#' + p.number : '#????';
    return '<div class="result-card" data-nftid="' + escapeHtml(p.nftId) + '">' +
      '<div class="pigeon-img-box">' + img + '</div>' +
      '<div class="result-card-body">' +
        '<div class="result-num">P!GE0N ' + num + '</div>' +
        traitLines +
        '<button class="inspect-btn" data-nftid="' + escapeHtml(p.nftId) + '">[ !NSPECT ]</button>' +
      '</div>' +
    '</div>';
  }

  function sortItems(items){
    var sorted = items.slice();
    sorted.sort(function(a, b){
      var an = a.number || 0, bn = b.number || 0;
      return state.sort === 'NUM_DESC' ? bn - an : an - bn;
    });
    return sorted;
  }

  function renderResults(){
    var sorted = sortItems(state.items);
    if (!sorted.length) return; // empty state already rendered by caller
    el.resultsArea.innerHTML = '<div class="result-grid">' + sorted.map(resultCardHtml).join('') + '</div>';
  }

  function emptyStateHtml(title, lines, showClear){
    return '<div class="empty-state">' +
      '<div class="es-title">' + escapeHtml(title) + '</div>' +
      lines.map(function(l){ return '<div class="es-line">' + escapeHtml(l) + '</div>'; }).join('') +
      (showClear ? '<button class="bar-btn" id="clearSearchBtn" style="margin-top:0.75rem;">[ CLEAR SEARCH ]</button>' : '') +
    '</div>';
  }

  function api(params){
    var qs = Object.keys(params).map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch('/api/pigeons?' + qs).then(function(r){ return r.json(); });
  }

  // ---- Browse (paginated real collection) ----
  function loadBrowsePage(marker, pushCurrentToStack){
    state.mode = 'browse';
    el.paginationRow.style.display = 'none';
    el.statusLine.textContent = '';
    el.resultsArea.innerHTML = '<div class="loading-note">L0AD!NG REAL P!GE0N DATA FR0M THE LEDGER...</div>';
    api(marker ? { marker: marker } : {}).then(function(data){
      if (pushCurrentToStack) state.markerStack.push(state.currentMarker);
      state.currentMarker = marker || null;
      state.nextMarker = data.marker || null;
      state.items = data.items || [];
      var approx = data.collectionSizeApprox ? '~' + data.collectionSizeApprox : 'UNKN0WN';
      var failedNote = data.failedCount ? (' :: ' + data.failedCount + ' UNAVA!LABLE (!PFS T!ME0UT)') : '';
      el.statusLine.innerHTML = 'DISPLAYING :: <span class="hi">' + state.items.length + '</span> P!GE0NS TH!S PAGE :: ' + approx + ' !N C0LLECT!0N (APPR0X)' + failedNote;
      if (!state.items.length){
        el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0N MATCH', ['TH!S PAGE RETURNED N0 READABLE P!GE0NS.'], false);
      } else {
        renderResults();
      }
      el.paginationRow.style.display = '';
      el.prevPageBtn.disabled = state.markerStack.length === 0 && !state.currentMarker;
      el.nextPageBtn.disabled = !state.nextMarker;
    }).catch(function(){
      el.resultsArea.innerHTML = emptyStateHtml('// S!GNAL_L0ST', ['C0ULD N0T REACH THE LEDGER. TRY AGA!N.'], false);
    });
  }

  el.nextPageBtn.addEventListener('click', function(){
    if (!state.nextMarker) return;
    loadBrowsePage(state.nextMarker, true);
  });
  el.prevPageBtn.addEventListener('click', function(){
    if (!state.markerStack.length){
      loadBrowsePage(null, false);
      return;
    }
    var prev = state.markerStack.pop();
    loadBrowsePage(prev, false);
  });

  // ---- Search ----
  function runSearch(){
    var q = el.searchInput.value.trim();
    if (!q){ loadBrowsePage(null, false); return; }
    state.mode = 'search';
    el.paginationRow.style.display = 'none';
    el.resultsArea.innerHTML = '<div class="loading-note">SEARCH!NG...</div>';
    el.statusLine.textContent = '';

    var kv = q.match(/^([A-Za-z]+)\\s*:\\s*(.+)$/);
    var isNumber = /^#?\\d+$/.test(q);

    var req;
    if (isNumber){
      req = api({ number: q.replace('#', '') });
    } else if (kv){
      req = api({ trait: kv[1], value: kv[2].trim() });
    } else {
      // Free text: try as a trait CATEGORY name first (e.g. "background"),
      // then fall back to treating it as a VALUE across every known category.
      req = ensureTraitsLoaded().then(function(){
        var catMatch = Object.keys(state.traitsData.categories).filter(function(c){ return c.toLowerCase() === q.toLowerCase(); })[0];
        if (catMatch){
          return api({ trait: catMatch, value: '' }).then(function(){
            // A bare category name has no single value — union all its values.
            var vals = state.traitsData.categories[catMatch] || [];
            return Promise.all(vals.map(function(v){ return api({ trait: catMatch, value: v }); }))
              .then(function(results){
                var merged = [];
                var seen = {};
                results.forEach(function(r){
                  (r.items || []).forEach(function(it){
                    if (!seen[it.nftId]){ seen[it.nftId] = true; merged.push(it); }
                  });
                });
                return { items: merged, indexedOnly: true };
              });
          });
        }
        // Treat as a value: check it against every known category.
        var cats = Object.keys(state.traitsData.categories);
        return Promise.all(cats.map(function(c){
          var vals = state.traitsData.categories[c] || [];
          var match = vals.filter(function(v){ return v.toLowerCase().indexOf(q.toLowerCase()) !== -1; });
          return Promise.all(match.map(function(v){ return api({ trait: c, value: v }); }));
        })).then(function(nested){
          var merged = [];
          var seen = {};
          nested.forEach(function(group){
            group.forEach(function(r){
              (r.items || []).forEach(function(it){
                if (!seen[it.nftId]){ seen[it.nftId] = true; merged.push(it); }
              });
            });
          });
          return { items: merged, indexedOnly: true };
        });
      });
    }

    req.then(function(data){
      state.items = data.items || [];
      if (!state.items.length){
        if (data.notIndexed){
          el.statusLine.innerHTML = 'RESULTS :: <span class="hi">0</span>';
          el.resultsArea.innerHTML = emptyStateHtml('// N0T YET !NDEXED', [
            'QUERY :: "' + q + '"',
            'TH!S P!GE0N HAS N0T BEEN SEEN YET.',
            'BR0WSE THE C0LLECT!0N T0 D!SC0VER !T — !NDEX GR0WS AS Y0U BR0WSE.'
          ], true);
        } else {
          el.statusLine.innerHTML = 'RESULTS :: <span class="hi">0</span>';
          el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0N MATCH', [
            'QUERY :: "' + q + '"',
            data.indexedOnly ? 'SEARCHED !NDEXED P!GE0NS 0NLY (GR0WS AS Y0U BR0WSE).' : ''
          ].filter(Boolean), true);
        }
        wireClearSearch();
        return;
      }
      var note = data.indexedOnly ? ' :: SEARCHED !NDEXED P!GE0NS 0NLY' : '';
      el.statusLine.innerHTML = 'RESULTS :: <span class="hi">' + state.items.length + '</span>' + note +
        (state.items.length === 1 ? '<br>P!GE0N #' + state.items[0].number : '');
      renderResults();
    }).catch(function(){
      el.resultsArea.innerHTML = emptyStateHtml('// S!GNAL_L0ST', ['SEARCH FA!LED. TRY AGA!N.'], false);
    });
  }
  function wireClearSearch(){
    var btn = document.getElementById('clearSearchBtn');
    if (btn) btn.addEventListener('click', function(){ el.searchInput.value = ''; loadBrowsePage(null, false); });
  }
  el.searchBtn.addEventListener('click', runSearch);
  el.searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') runSearch(); });

  // ---- Sort (re-orders whatever's currently displayed) ----
  el.sortSelect.addEventListener('change', function(){
    state.sort = el.sortSelect.value;
    if (state.items.length) renderResults();
  });

  // ---- Traits filter panel ----
  function ensureTraitsLoaded(){
    if (state.traitsData) return Promise.resolve(state.traitsData);
    return api({ traits: 1 }).then(function(data){
      state.traitsData = data;
      return data;
    });
  }
  function renderTraitCats(){
    var cats = Object.keys(state.traitsData.categories || {});
    if (!cats.length){
      el.traitsEmptyNote.style.display = '';
      el.traitsCats.innerHTML = '';
      el.traitsValues.innerHTML = '';
      return;
    }
    el.traitsEmptyNote.style.display = 'none';
    el.traitsCats.innerHTML = cats.map(function(c){
      return '<button class="trait-cat-btn' + (state.selectedTraitCat === c ? ' selected' : '') + '" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c.toUpperCase()) + '</button>';
    }).join('');
    renderTraitValues();
  }
  function renderTraitValues(){
    if (!state.selectedTraitCat){ el.traitsValues.innerHTML = ''; return; }
    var vals = state.traitsData.categories[state.selectedTraitCat] || [];
    el.traitsValues.innerHTML = vals.map(function(v){
      return '<span class="trait-value-chip" data-cat="' + escapeHtml(state.selectedTraitCat) + '" data-val="' + escapeHtml(v) + '">' + escapeHtml(v.toUpperCase()) + '</span>';
    }).join('');
  }
  el.traitsBtn.addEventListener('click', function(){
    var opening = !el.traitsPanel.classList.contains('open');
    el.traitsPanel.classList.toggle('open', opening);
    el.traitsBtn.classList.toggle('active', opening);
    if (opening) ensureTraitsLoaded().then(renderTraitCats);
  });
  el.traitsCats.addEventListener('click', function(e){
    var btn = e.target.closest('.trait-cat-btn');
    if (!btn) return;
    state.selectedTraitCat = btn.getAttribute('data-cat');
    renderTraitCats();
  });
  el.traitsValues.addEventListener('click', function(e){
    var chip = e.target.closest('.trait-value-chip');
    if (!chip) return;
    var cat = chip.getAttribute('data-cat');
    var val = chip.getAttribute('data-val');
    el.searchInput.value = cat + ': ' + val;
    runSearch();
  });

  // ---- Inspect / detail ----
  el.resultsArea.addEventListener('click', function(e){
    var btn = e.target.closest('.inspect-btn');
    if (!btn) return;
    openDetail(btn.getAttribute('data-nftid'));
  });

  function traitCellHtml(a){
    return '<div class="trait-cell"><div class="tc-label">' + escapeHtml(a.trait_type) + '</div><div class="tc-value">' + escapeHtml(a.value) + '</div></div>';
  }

  function openDetail(nftId){
    var known = state.items.filter(function(p){ return p.nftId === nftId; })[0];
    el.detailNum.textContent = known && known.number !== null ? 'P!GE0N #' + known.number : 'P!GE0N ...';
    el.detailImgBox.innerHTML = known && known.image ? '<img src="' + escapeHtml(known.image) + '" alt="">' : '[ IMAGE ]';
    el.detailOwner.textContent = '...';
    el.detailTraits.innerHTML = known ? known.attributes.map(traitCellHtml).join('') : '';
    el.detailNftId.textContent = nftId;
    showScreen('detail');

    api({ detail: nftId }).then(function(data){
      if (!data.item){
        state.currentDetail = known ? { nftId: nftId, number: known.number, owner: null, ownerShort: null } : null;
        el.detailOwner.textContent = 'N0T !NDEXED';
        el.detailOwner.classList.add('not-indexed');
        return;
      }
      var p = data.item;
      state.currentDetail = p;
      el.detailNum.textContent = p.number !== null ? 'P!GE0N #' + p.number : 'P!GE0N ...';
      el.detailImgBox.innerHTML = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="">' : '[ IMAGE ]';
      el.detailTraits.innerHTML = p.attributes.map(traitCellHtml).join('');
      if (p.ownerShort){
        el.detailOwner.textContent = p.ownerShort;
        el.detailOwner.classList.remove('not-indexed');
      } else {
        el.detailOwner.textContent = 'N0T !NDEXED';
        el.detailOwner.classList.add('not-indexed');
      }
    }).catch(function(){
      el.detailOwner.textContent = 'N0T !NDEXED';
      el.detailOwner.classList.add('not-indexed');
    });
  }
  el.backToBrowseBtn.addEventListener('click', function(){ showScreen('browse'); });

  // ---- Offer draft placeholder ----
  el.offerForBtn.addEventListener('click', function(){
    var p = state.currentDetail;
    el.offerTargetNum.textContent = p && p.number !== null ? 'P!GE0N #' + p.number : el.detailNum.textContent;
    el.offerTargetOwner.textContent = (p && p.ownerShort) ? p.ownerShort : 'N0T !NDEXED';
    showScreen('offer');
  });
  el.backToDetailBtn.addEventListener('click', function(){ showScreen('detail'); });

  // ---- Initial load ----
  loadBrowsePage(null, false);

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
