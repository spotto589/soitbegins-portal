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
//
// MY PIGEONS reuses the same wallet-identity mechanism as /board — the
// `pigeon_session` cookie, set once a wallet has signed the connect
// message there — rather than building a second, separate login flow. No
// signature exists here to create one; /swap only ever reads the cookie.
// ─────────────────────────────────────────────────────────────────────────

import { BOARD_COOKIE_NAME, getCookie, verifyToken } from './_shared.js';

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
    padding:8vh 3vw 10vh;
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
  .page{ max-width:1500px; width:100%; position:relative; z-index:1; }
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
    text-shadow:0 0 10px rgba(255,47,146,0.25);
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
    color:#ff2f92;
    text-shadow:0 0 6px rgba(255,47,146,0.4);
    margin-bottom:2rem;
    text-transform:uppercase;
  }

  .sw-panel{
    border:1px solid rgba(255,47,146,0.25);
    background:#08080a;
    padding:1.5rem;
    margin-bottom:1.75rem;
  }
  .panel-title{
    text-align:center;
    font-size:13px;
    letter-spacing:0.2em;
    color:#ff2f92;
    text-shadow:0 0 6px rgba(255,47,146,0.4);
    margin-bottom:1rem;
    text-transform:uppercase;
  }

  .my-pigeons-row{ text-align:center; margin-bottom:1.75rem; }

  /* ---- top 10 holders (expandable) ---- */
  .th-toggle{
    display:block;
    width:100%;
    text-align:center;
    background:transparent;
    border:none;
    font-family:inherit;
    font-size:13px;
    letter-spacing:0.2em;
    color:#ff2f92;
    text-shadow:0 0 6px rgba(255,47,146,0.4);
    text-transform:uppercase;
    cursor:pointer;
    padding:0;
  }
  .th-toggle.stacked-toggle{ margin-top:1.25rem; border-top:1px dashed rgba(255,47,146,0.25); padding-top:1.25rem; }
  .th-list{ margin-top:1rem; border-top:1px dashed rgba(255,47,146,0.25); padding-top:0.5rem; }
  .th-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.75rem;
    padding:0.6em 0.4em;
    border-bottom:1px solid rgba(232,232,232,0.08);
    cursor:pointer;
    font-size:12px;
    letter-spacing:0.03em;
  }
  .th-row:last-child{ border-bottom:none; }
  .th-row:hover{ background:rgba(0,255,242,0.06); }
  .th-rank{ flex:0 0 2.2em; color:#ff2f92; text-shadow:0 0 4px rgba(255,47,146,0.4); }
  .th-wallet{ flex:1; min-width:0; color:#00fff2; text-shadow:0 0 4px rgba(0,255,242,0.3); word-break:break-all; }
  .th-count{ flex:0 0 auto; color:rgba(232,232,232,0.6); text-transform:uppercase; }
  .th-empty{ text-align:center; font-size:11px; letter-spacing:0.08em; color:rgba(232,232,232,0.4); padding:0.5rem 0; text-transform:uppercase; }

  /* ---- sales history ---- */
  .sales-scrollbox{
    margin-top:1rem;
    border-top:1px dashed rgba(255,47,146,0.25);
    padding-top:0.5rem;
    max-height:820px;
    overflow-y:auto;
  }
  .sale-row{
    display:flex;
    align-items:center;
    gap:1rem;
    padding:0.9rem 0.4rem;
    border-bottom:1px solid rgba(232,232,232,0.08);
    font-size:12px;
    letter-spacing:0.03em;
    flex-wrap:wrap;
  }
  .sale-row:last-child{ border-bottom:none; }
  .sale-thumb-wrap{ display:flex; flex-direction:column; align-items:center; gap:0.4rem; flex:0 0 auto; }
  .sale-num-box{
    font-size:11px;
    letter-spacing:0.05em;
    color:#ff2f92;
    text-shadow:0 0 4px rgba(255,47,146,0.35);
    border:1px solid rgba(255,47,146,0.4);
    padding:0.3em 0.6em;
    cursor:pointer;
    white-space:nowrap;
  }
  .sale-thumb{ flex:0 0 auto; width:96px; height:96px; cursor:pointer; }
  .sale-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
  .sale-info{ flex:1 1 200px; display:flex; flex-direction:column; gap:0.35rem; }
  .sale-price{ font-size:14px; color:#ffd700; text-shadow:0 0 3px rgba(255,215,0,0.3); }
  .sale-parties{ color:rgba(232,232,232,0.55); text-transform:none; }
  .sale-parties a{ color:#00fff2; text-decoration:underline; cursor:pointer; }
  .sale-time{ color:rgba(232,232,232,0.3); text-transform:uppercase; font-size:10px; }

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
    border:1px solid rgba(255,47,146,0.35);
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
    border:1px solid rgba(255,47,146,0.5);
    color:#ff2f92;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.75em 1.1em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .bar-btn:hover{ background:rgba(255,47,146,0.1); }
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
    border-top:1px dashed rgba(255,47,146,0.25);
    margin-top:1rem;
    padding-top:1rem;
  }
  .results-block{
    border-top:1px dashed rgba(255,47,146,0.25);
    margin-top:1.25rem;
    padding-top:1.25rem;
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
  select.trait-cat-select{
    background:#000;
    border:1px solid rgba(255,47,146,0.3);
    color:#e8e8e8;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.55em 0.7em;
    text-transform:uppercase;
    cursor:pointer;
  }
  select.trait-cat-select option{ background:#08080a; color:#e8e8e8; }
  .trait-value-chips{
    display:flex;
    flex-wrap:wrap;
    align-content:flex-start;
    gap:0.4rem;
    width:100%;
    margin-top:0.5rem;
    max-height:190px;
    overflow-y:auto;
    padding:0.5rem;
    border:1px dashed rgba(255,47,146,0.2);
  }
  .trait-chip{
    background:transparent;
    border:1px solid rgba(255,47,146,0.3);
    color:rgba(232,232,232,0.75);
    font-family:inherit;
    font-size:10px;
    letter-spacing:0.05em;
    padding:0.5em 0.75em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .trait-chip:hover{ background:rgba(255,47,146,0.08); }
  .trait-chip.selected{ background:#ff2f92; color:#08080a; border-color:#ff2f92; }
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
  .status-line .hi{ color:#ff2f92; text-shadow:0 0 5px rgba(255,47,146,0.4); }

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
    background:repeating-linear-gradient(45deg, rgba(255,47,146,0.04) 0px, rgba(255,47,146,0.04) 6px, transparent 6px, transparent 12px);
    border:1px dashed rgba(255,47,146,0.15);
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
    border:1px solid rgba(255,47,146,0.6);
    color:#ff2f92;
    font-size:13px;
    cursor:pointer;
    text-align:center;
  }
  .card-select-toggle.selected{ background:#ff2f92; color:#08080a; }

  /* ---- collection grid / cards ---- */
  /* Fixed 6 columns at every width, on purpose (not auto-fill/minmax,
     which was producing inconsistent tile sizes depending on viewport) —
     chrome is deliberately minimal (number + image + rarity/high-sale +
     an INSPECT button) since 6 columns doesn't leave room for anything
     more at any reasonable page width; tap/click the image to INSPECT
     for full detail. */
  .result-grid{
    display:grid;
    grid-template-columns:repeat(6, 1fr);
    gap:0.6rem;
  }
  .result-card{ border:1px solid rgba(255,47,146,0.25); overflow:hidden; }
  .result-card .pigeon-img-box{ border:none; }
  .result-card.in-target{ border-color:#ff2f92; box-shadow:0 0 10px rgba(255,47,146,0.25) inset; }
  .result-card-body{ padding:0.55rem 0.4rem; }
  .result-num{
    font-size:13px;
    letter-spacing:0.03em;
    color:#ff2f92;
    text-shadow:0 0 4px rgba(255,47,146,0.35);
    text-align:center;
    padding:0.4rem 0.3rem;
    border-bottom:1px solid rgba(255,47,146,0.25);
  }
  .result-rarity-line{ font-size:11px; letter-spacing:0.03em; color:#ffd700; text-shadow:0 0 3px rgba(255,215,0,0.3); text-align:center; }
  .result-highsale-line{ display:block; font-size:10px; letter-spacing:0.03em; color:#ff2f92; text-shadow:0 0 3px rgba(255,47,146,0.3); text-align:center; text-transform:uppercase; text-decoration:none; }
  a.result-highsale-line{ cursor:pointer; }
  a.result-highsale-line:hover{ text-decoration:underline; }
  .card-select-toggle{ width:1.9em; height:1.9em; line-height:1.9em; font-size:16px; }
  .inspect-btn{
    display:block;
    width:100%;
    margin-top:0.4rem;
    background:transparent;
    border:1px solid rgba(0,255,242,0.4);
    color:#00fff2;
    font-family:inherit;
    font-size:10px;
    letter-spacing:0.1em;
    padding:0.4em 0;
    cursor:pointer;
    text-transform:uppercase;
  }
  .inspect-btn:hover{ background:rgba(0,255,242,0.1); }

  @media (max-width:700px){
    body{ padding:4vh 2.5vw 6vh; }
    .sw-panel{ padding:1rem 0.75rem; }
    .result-grid{ gap:0.25rem; }
    .result-card-body{ padding:0.3rem 0.15rem; }
    .result-num{ font-size:9px; padding:0.3rem 0.15rem; }
    .result-rarity-line{ display:none; }
    .result-highsale-line{ display:none; }
    .card-select-toggle{ width:1.4em; height:1.4em; line-height:1.4em; font-size:11px; }
    .inspect-btn{ font-size:8px; padding:0.3em 0; }
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
    border:1px solid rgba(255,47,146,0.5);
    color:#ff2f92;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.65em 1.3em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .page-btn:hover:not(:disabled){ background:rgba(255,47,146,0.1); }
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
    color:#ff2f92;
    text-shadow:0 0 6px rgba(255,47,146,0.4);
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
  .df-value.price{ color:#ffd700; text-shadow:0 0 4px rgba(255,215,0,0.3); }
  .df-value a.owner-link{ color:#00fff2; text-shadow:0 0 4px rgba(0,255,242,0.4); text-decoration:underline; }
  .df-value a.owner-link:hover{ color:#fff; }
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
  .trait-cell{ border:1px solid rgba(255,47,146,0.2); padding:0.6rem 0.75rem; text-align:center; cursor:pointer; }
  .trait-cell:hover{ background:rgba(255,47,146,0.08); border-color:rgba(255,47,146,0.5); }
  .trait-cell .tc-label{ font-size:9px; letter-spacing:0.15em; color:rgba(232,232,232,0.4); margin-bottom:0.35rem; text-transform:uppercase; }
  .trait-cell .tc-value{ font-size:13px; letter-spacing:0.03em; color:#ff2f92; text-shadow:0 0 4px rgba(255,47,146,0.3); }
  .trait-cell .tc-sub{ font-size:9px; letter-spacing:0.08em; color:rgba(0,255,242,0.6); margin-top:0.3rem; text-transform:uppercase; }
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
    border:1px solid rgba(255,47,146,0.6);
    color:#ff2f92;
    font-family:inherit;
    font-size:12px;
    letter-spacing:0.12em;
    padding:0.75em 1.4em;
    cursor:pointer;
    text-transform:uppercase;
    text-shadow:0 0 6px rgba(255,47,146,0.4);
  }
  .action-btn:hover{ background:rgba(255,47,146,0.1); }
  .action-btn.selected{ background:rgba(255,47,146,0.15); color:#fff; }

  /* ---- target assets sticky bar ---- */
  .target-bar{
    position:fixed;
    left:50%;
    bottom:0;
    transform:translateX(-50%);
    z-index:40;
    width:min(960px, 100%);
    background:#08080a;
    border-top:1px solid rgba(255,47,146,0.5);
    box-shadow:0 -4px 20px rgba(0,0,0,0.5);
    padding:0.75rem 1.25rem;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:1rem;
    cursor:pointer;
  }
  .target-bar .tb-label{ font-size:12px; letter-spacing:0.1em; color:#ff2f92; text-shadow:0 0 6px rgba(255,47,146,0.4); text-transform:uppercase; }
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
    color:#ff2f92;
    text-shadow:0 0 6px rgba(255,47,146,0.4);
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

    <div class="my-pigeons-row">
      <button class="bar-btn" id="myPigeonsBtn">[ MY P!GE0NS ]</button>
    </div>

    <!-- SCREEN 1: COLLECTION BROWSER (whole collection OR one owner's, per scope) -->
    <div id="screenBrowse">
      <div class="sw-panel" id="statsPanel">
        <button class="th-toggle" id="topHoldersToggle">[ T0P 10 H0LDERS ▼ ]</button>
        <div class="th-list" id="topHoldersList" style="display:none;"></div>

        <button class="th-toggle stacked-toggle" id="salesToggle">[ SALES H!ST0RY ▼ ]</button>
        <div class="sales-scrollbox" id="salesScrollBox" style="display:none;">
          <div id="salesArea"></div>
          <div class="scroll-sentinel" id="salesScrollSentinel"></div>
          <div class="load-more-note" id="salesLoadMoreNote" style="display:none;">L0AD!NG M0RE SALES...</div>
          <div class="end-of-collection-note" id="salesEndNote" style="display:none;">// END 0F SALES H!ST0RY</div>
        </div>
      </div>

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
          <input class="search-input" id="searchInput" placeholder="SEARCH P!GE0NS (NUMBER, TRA!T, 0R VALUE)..." style="display:none;">
          <button class="bar-btn" id="searchBtn" style="display:none;">[ SEARCH ]</button>
          <select class="sort-select" id="editionSelect">
            <option value="ALL">[ ED!T!0N ▼ ] N0. 1-3015</option>
            <option value="LOW">N0. 1-1515</option>
            <option value="HIGH">N0. 1516-3015</option>
          </select>
          <select class="sort-select" id="sortSelect">
            <option value="RARITY_ASC">[ S0RT ▼ ] RAR!TY H!GH</option>
            <option value="RARITY_DESC">RAR!TY L0W</option>
            <option value="NAME_ASC">A → Z</option>
            <option value="NAME_DESC">Z → A</option>
            <option value="HIGHEST_SALE">H!GHEST SALE</option>
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

        <div class="results-block">
          <div class="status-line" id="statusLine"></div>
          <div id="resultsArea"></div>
          <div class="scroll-sentinel" id="scrollSentinel"></div>
          <div class="load-more-note" id="loadMoreNote" style="display:none;">L0AD!NG M0RE P!GE0NS...</div>
          <div class="end-of-collection-note" id="endOfCollectionNote" style="display:none;">// END 0F C0LLECT!0N</div>
        </div>
      </div>
    </div>

    <!-- SCREEN 2: DETAIL -->
    <div class="sw-panel" id="screenDetail" style="display:none;">
      <div class="detail-eyebrow">// P!GE0N !DENT!F!ED</div>
      <div class="detail-num" id="detailNum"></div>
      <div class="detail-img-large pigeon-img-box" id="detailImgBox">[ IMAGE ]</div>
      <div class="detail-field"><span class="df-label">OWNER</span><span class="df-value" id="detailOwner"></span></div>
      <div class="detail-field" id="detailRarityRow" style="display:none;"><span class="df-label">RAR!TY</span><span class="df-value rarity" id="detailRarity"></span></div>
      <div class="detail-field" id="detailPriceRow" style="display:none;"><span class="df-label">PR!CE</span><span class="df-value price" id="detailPrice"></span></div>
      <div class="detail-field" id="detailHighSaleRow" style="display:none;"><span class="df-label">H!GH SALE</span><span class="df-value price" id="detailHighSale"></span></div>
      <div class="detail-traits-title">TRA!TS</div>
      <div class="trait-grid" id="detailTraits"></div>
      <div class="tech-meta">
        <div class="tech-meta-title">TECHN!CAL METADATA</div>
        <div class="tech-meta-row"><span>NFT0KEN !D</span><span class="value" id="detailNftId"></span></div>
      </div>
      <div class="detail-actions">
        <button class="secondary-btn" id="backToBrowseBtn">[ ← BACK ]</button>
        <button class="action-btn" id="detailSelectBtn">[ SELECT ]</button>
        <a class="action-btn" id="detailBuyBtn" style="display:none;" target="_blank" rel="noopener">[ BUY 0N DEEPT!DE ]</a>
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

  // Wallet of whoever is currently signed in via /board's connect flow
  // (read from the shared pigeon_session cookie server-side) — null if no
  // signature is on file. There is no login button here on purpose.
  var MY_WALLET = "__SWAP_WALLET__";

  // ---- Client-side state ----
  var PAGE_SIZE = 36;
  var state = {
    scope: null,              // null (whole collection) or { wallet, ownerShort }
    skip: 0,                  // how many items already loaded, for infinite scroll
    editionRawSkip: 0,        // position in the underlying sorted collection, for edition LOW/HIGH scans
    hasMore: true,
    loading: false,
    total: null,
    items: [],                // everything loaded so far in the current browse/search mode
    scopeAllItems: [],         // full resolved list for the current wallet scope (client-side filtered)
    mode: 'browse',            // 'browse' | 'search' | 'scoped'
    sort: 'RARITY_ASC',
    edition: 'ALL',            // 'ALL' | 'LOW' (1-1515) | 'HIGH' (1516-3015)
    traitFilters: [],         // [{ id, category, value }]
    nextTraitRowId: 1,
    traitCategories: null,     // [name, name, ...] — cheap, loaded once
    traitValuesCache: {},      // category -> [{value, count, percent}], fetched lazily per category
    collectionSizeApprox: 3015,
    currentDetail: null,
    targetAssets: {},         // nftId -> { nftId, number, image } — only while scope is a wallet
    sales: { skip: 0, hasMore: true, loading: false, opened: false }
  };

  var el = {};
  ['searchInput','searchBtn','editionSelect','sortSelect','myPigeonsBtn','topHoldersToggle','topHoldersList','indexLine','traitRows','addTraitBtn','clearTraitsBtn',
   'statusLine','resultsArea','scrollSentinel','loadMoreNote','endOfCollectionNote',
   'salesToggle','salesScrollBox','salesArea','salesScrollSentinel','salesLoadMoreNote','salesEndNote',
   'nodeHeaderPanel','nodeAddr','nodeCount','backToFullCollectionLink','searchPanelTitle',
   'screenBrowse','screenDetail','screenSummary',
   'detailNum','detailImgBox','detailOwner','detailRarityRow','detailRarity','detailPriceRow','detailPrice','detailHighSaleRow','detailHighSale','detailBuyBtn','detailTraits','detailNftId',
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

  // Shared by SELECT (auto-enters owner scope + auto-targets the pigeon
  // that got you there) and the plain "view this wallet's collection" click
  // on an owner address (no auto-targeting).
  function browseOwnerCollection(wallet, ownerShort){
    state.scope = { wallet: wallet, ownerShort: ownerShort || wallet };
    state.targetAssets = {};
    state.traitFilters = [];
    renderTraitRows();
    el.searchInput.value = '';
    el.nodeHeaderPanel.style.display = '';
    el.nodeAddr.textContent = state.scope.ownerShort;
    el.searchPanelTitle.textContent = 'TARGET N0DE C0LLECT!0N';
    el.resultsArea.innerHTML = '<div class="loading-note">L0AD!NG H0LDER\\'S REAL P!GE0NS...</div>';
    showScreen('browse');
    renderTargetBar();
    api({ wallet: wallet }).then(function(data){
      state.scopeAllItems = data.items || [];
      el.nodeCount.textContent = 'P!GE0NS HELD :: ' + state.scopeAllItems.length;
      runScopedQuery();
    }).catch(function(){
      el.resultsArea.innerHTML = emptyStateHtml('// S!GNAL_L0ST', ['C0ULD N0T LOAD TH!S WALLET. TRY AGA!N.'], false);
    });
  }

  function enterOwnerScope(targetPigeon){
    if (!targetPigeon.owner){
      alert('OWNER N0T !NDEXED F0R TH!S P!GE0N YET — TRY ANOTHER, OR !NSPECT !T AGA!N SH0RTLY.');
      return;
    }
    browseOwnerCollection(targetPigeon.owner, targetPigeon.ownerShort);
    state.targetAssets[targetPigeon.nftId] = { nftId: targetPigeon.nftId, number: targetPigeon.number, image: targetPigeon.image };
    renderTargetBar();
    refreshCardSelectionStates();
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
    var rarityLine = p.rarityRank ? '<div class="result-rarity-line">RAR!TY #' + p.rarityRank + '</div>' : '';
    var highSaleText = p.highSaleXrp !== null && p.highSaleXrp !== undefined
      ? 'H!GH SALE :: ' + p.highSaleXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP'
      : 'F!RST 0WNER';
    var highSaleLine = p.highSaleTxUrl
      ? '<a class="result-highsale-line" href="' + escapeHtml(p.highSaleTxUrl) + '" target="_blank" rel="noopener" title="V!EW SALE TXN 0N B!TH0MP">' + highSaleText + '</a>'
      : '<div class="result-highsale-line">' + highSaleText + '</div>';
    var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : '[ IMAGE ]';
    var num = p.number !== null ? '#' + p.number : '#????';
    var inTarget = !!state.targetAssets[p.nftId];
    return '<div class="result-card' + (inTarget ? ' in-target' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '">' +
      '<div class="result-num">P!GE0N ' + num + '</div>' +
      '<div class="pigeon-img-box" data-nftid="' + escapeHtml(p.nftId) + '">' +
        img +
        '<button class="card-select-toggle' + (inTarget ? ' selected' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '" title="SELECT">' + (inTarget ? '✓' : '+') + '</button>' +
      '</div>' +
      '<div class="result-card-body">' +
        rarityLine +
        highSaleLine +
        '<button class="inspect-btn" data-nftid="' + escapeHtml(p.nftId) + '">[ !NSPECT ]</button>' +
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
      var inspectBtn = e.target.closest('.inspect-btn');
      if (inspectBtn){ openDetail(inspectBtn.getAttribute('data-nftid')); return; }
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
    state.editionRawSkip = 0;
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
    var isEdition = state.edition === 'LOW' || state.edition === 'HIGH';
    var isHighestSale = state.sort === 'HIGHEST_SALE';
    var reqParams;
    if (isHighestSale){
      reqParams = { skip: state.skip, limit: PAGE_SIZE, highestSale: 1 };
    } else if (isEdition){
      reqParams = { rawSkip: state.editionRawSkip, limit: PAGE_SIZE, numberRange: state.edition === 'LOW' ? 'low' : 'high', sort: state.sort };
    } else {
      reqParams = { skip: state.skip, limit: PAGE_SIZE, sort: state.sort, filters: filters.length ? JSON.stringify(filters) : undefined };
    }
    api(reqParams).then(function(data){
      state.loading = false;
      el.loadMoreNote.style.display = 'none';
      var newItems = data.items || [];
      state.items = state.items.concat(newItems);
      state.skip += newItems.length;
      if (isEdition && typeof data.rawSkip === 'number') state.editionRawSkip = data.rawSkip;
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
  // Pick a category from the dropdown; every value for that category then
  // appears as a row of clickable chips (sorted rarest/highest % first, not
  // A-Z) rather than a second dropdown — click one to filter, click again to
  // clear it.
  function renderTraitRows(){
    // Category list: A-Z, so the (native, already-scrollable) dropdown is
    // predictable to scan. Values within a chosen category: rarest first
    // (lowest %), not alphabetical — that's the whole point of showing %.
    var cats = state.traitCategories ? Object.keys(state.traitCategories).sort(function(a, b){ return a.localeCompare(b); }) : [];
    el.traitRows.innerHTML = state.traitFilters.map(function(row){
      var catOptions = cats.map(function(c){
        return '<option value="' + escapeHtml(c) + '"' + (row.category === c ? ' selected' : '') + '>' + escapeHtml(c.toUpperCase()) + '</option>';
      }).join('');
      var vals = ((row.category && state.traitCategories[row.category]) || []).slice().sort(function(a, b){
        return (a.percent || 0) - (b.percent || 0);
      });
      var chips = vals.map(function(v){
        var pct = v.percent !== null && v.percent !== undefined ? ' (' + v.percent + '%)' : '';
        return '<button type="button" class="trait-chip' + (row.value === v.value ? ' selected' : '') + '" data-id="' + row.id + '" data-value="' + escapeHtml(v.value) + '">' + escapeHtml(v.value.toUpperCase()) + pct + '</button>';
      }).join('');
      return '<div class="trait-row" data-id="' + row.id + '">' +
        '<select class="trait-cat-select" data-id="' + row.id + '"><option value="">[ CATEG0RY ▼ ]</option>' + catOptions + '</select>' +
        '<button class="trait-row-remove" data-id="' + row.id + '">&times;</button>' +
        (row.category ? '<div class="trait-value-chips" data-id="' + row.id + '">' + chips + '</div>' : '') +
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
    renderTraitRows();
    runQuery();
  });
  el.traitRows.addEventListener('click', function(e){
    var removeBtn = e.target.closest('.trait-row-remove');
    if (removeBtn){
      var rid = parseInt(removeBtn.getAttribute('data-id'), 10);
      state.traitFilters = state.traitFilters.filter(function(r){ return r.id !== rid; });
      renderTraitRows();
      runQuery();
      return;
    }
    var chip = e.target.closest('.trait-chip');
    if (chip){
      var cid = parseInt(chip.getAttribute('data-id'), 10);
      var row = state.traitFilters.filter(function(r){ return r.id === cid; })[0];
      if (!row) return;
      var value = chip.getAttribute('data-value');
      row.value = row.value === value ? '' : value;
      renderTraitRows();
      runQuery();
    }
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
      if (state.edition === 'LOW' && !(p.number !== null && p.number <= 1515)) return false;
      if (state.edition === 'HIGH' && !(p.number !== null && p.number > 1515)) return false;
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
    } else if (state.sort === 'NAME_ASC' || state.sort === 'NAME_DESC'){
      list = list.slice().sort(function(a, b){ return state.sort === 'NAME_DESC' ? (b.number || 0) - (a.number || 0) : (a.number || 0) - (b.number || 0); });
    } else if (state.sort === 'HIGHEST_SALE'){
      list = list.slice().sort(function(a, b){
        var av = a.highSaleXrp === null || a.highSaleXrp === undefined ? -1 : a.highSaleXrp, bv = b.highSaleXrp === null || b.highSaleXrp === undefined ? -1 : b.highSaleXrp;
        return bv - av;
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

  // ---- Top 10 holders (network-wide, cached snapshot) — an expandable
  // panel at the top of the page; clicking a wallet browses their real
  // collection the same way the owner-link on INSPECT does. ----
  var topHoldersData = null;
  function loadTopHolders(){
    api({ topHolders: 1 }).then(function(data){
      topHoldersData = data.holders || [];
      if (el.topHoldersList.style.display !== 'none') renderTopHoldersList();
    }).catch(function(){ topHoldersData = []; });
  }
  function renderTopHoldersList(){
    if (topHoldersData === null){
      el.topHoldersList.innerHTML = '<div class="th-empty">L0AD!NG...</div>';
      return;
    }
    if (!topHoldersData.length){
      el.topHoldersList.innerHTML = '<div class="th-empty">N0T READY YET — TRY AGA!N SH0RTLY.</div>';
      return;
    }
    el.topHoldersList.innerHTML = topHoldersData.map(function(h, i){
      return '<div class="th-row" data-wallet="' + escapeHtml(h.wallet) + '" data-short="' + escapeHtml(h.ownerShort) + '">' +
        '<span class="th-rank">#' + (i + 1) + '</span>' +
        '<span class="th-wallet">' + escapeHtml(h.ownerShort) + '</span>' +
        '<span class="th-count">' + h.count + ' HELD</span>' +
      '</div>';
    }).join('');
  }
  el.topHoldersToggle.addEventListener('click', function(){
    var opening = el.topHoldersList.style.display === 'none';
    el.topHoldersList.style.display = opening ? '' : 'none';
    el.topHoldersToggle.textContent = opening ? '[ T0P 10 H0LDERS ▲ ]' : '[ T0P 10 H0LDERS ▼ ]';
    if (opening) renderTopHoldersList();
  });
  el.topHoldersList.addEventListener('click', function(e){
    var row = e.target.closest('.th-row');
    if (!row) return;
    browseOwnerCollection(row.getAttribute('data-wallet'), row.getAttribute('data-short'));
  });

  // ---- MY PIGEONS — reuses the /board wallet session; no login flow here. ----
  el.myPigeonsBtn.addEventListener('click', function(){
    if (!MY_WALLET){
      alert('N0 S!GNATURE DETECTED — C0NNECT Y0UR WALLET 0N /B0ARD F!RST.');
      return;
    }
    var short = MY_WALLET.slice(0, 9) + '...' + MY_WALLET.slice(-4);
    browseOwnerCollection(MY_WALLET, short);
  });

  // ---- Sales history (real, collection-wide, infinite scroll) ----
  function saleRowHtml(s){
    var thumb = s.image ? '<img src="' + escapeHtml(s.image) + '" alt="" loading="lazy">' : '';
    var num = s.number !== null ? '#' + s.number : '#????';
    var price = s.priceXrp !== null ? s.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP' : '?';
    var when = s.createdAt ? new Date(s.createdAt).toLocaleString() : '';
    return '<div class="sale-row">' +
      '<div class="sale-thumb-wrap">' +
        '<div class="sale-num-box" data-nftid="' + escapeHtml(s.nftId) + '">P!GE0N ' + num + '</div>' +
        '<div class="sale-thumb" data-nftid="' + escapeHtml(s.nftId) + '">' + thumb + '</div>' +
      '</div>' +
      '<div class="sale-info">' +
        '<div class="sale-price">' + price + '</div>' +
        '<div class="sale-parties">' +
          (s.seller ? '<a data-wallet="' + escapeHtml(s.seller) + '" data-short="' + escapeHtml(s.sellerShort || s.seller) + '">' + escapeHtml(s.sellerShort || s.seller) + '</a>' : '?') +
          ' → ' +
          (s.buyer ? '<a data-wallet="' + escapeHtml(s.buyer) + '" data-short="' + escapeHtml(s.buyerShort || s.buyer) + '">' + escapeHtml(s.buyerShort || s.buyer) + '</a>' : '?') +
        '</div>' +
        '<div class="sale-time">' + escapeHtml(when) + '</div>' +
      '</div>' +
    '</div>';
  }
  function loadMoreSales(){
    if (state.sales.loading || !state.sales.hasMore) return;
    state.sales.loading = true;
    el.salesLoadMoreNote.style.display = '';
    api({ sales: 1, skip: state.sales.skip, limit: 10 }).then(function(data){
      state.sales.loading = false;
      el.salesLoadMoreNote.style.display = 'none';
      var items = data.items || [];
      state.sales.skip += items.length;
      state.sales.hasMore = !!data.hasMore && items.length > 0;
      if (items.length) el.salesArea.insertAdjacentHTML('beforeend', items.map(saleRowHtml).join(''));
      else if (state.sales.skip === 0) el.salesArea.innerHTML = '<div class="th-empty">N0 SALES YET.</div>';
      if (!state.sales.hasMore) el.salesEndNote.style.display = '';
    }).catch(function(){
      state.sales.loading = false;
      el.salesLoadMoreNote.style.display = 'none';
    });
  }
  el.salesArea.addEventListener('click', function(e){
    var walletLink = e.target.closest('.sale-parties a');
    if (walletLink){ browseOwnerCollection(walletLink.getAttribute('data-wallet'), walletLink.getAttribute('data-short')); return; }
    var target = e.target.closest('.sale-thumb, .sale-num-box');
    if (target) openDetail(target.getAttribute('data-nftid'));
  });
  el.salesToggle.addEventListener('click', function(){
    var opening = el.salesScrollBox.style.display === 'none';
    el.salesScrollBox.style.display = opening ? '' : 'none';
    el.salesToggle.textContent = opening ? '[ SALES H!ST0RY ▲ ]' : '[ SALES H!ST0RY ▼ ]';
  });
  // Rooted at the scrollbox itself (not the viewport) so it fires on
  // scrolling *within* the box, not the page.
  var salesScrollObserver = new IntersectionObserver(function(entries){
    if (entries[0].isIntersecting) loadMoreSales();
  }, { root: el.salesScrollBox, rootMargin: '200px' });
  salesScrollObserver.observe(el.salesScrollSentinel);

  el.searchBtn.addEventListener('click', runSearchBox);
  el.searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') runSearchBox(); });
  el.sortSelect.addEventListener('change', function(){
    state.sort = el.sortSelect.value;
    runQuery();
  });
  el.editionSelect.addEventListener('change', function(){
    state.edition = el.editionSelect.value;
    runQuery();
  });

  // ---- Inspect / detail ----
  function traitCellHtml(a){
    var subParts = [];
    if (a.percent !== null && a.percent !== undefined) subParts.push(a.percent + '%');
    if (a.count !== null && a.count !== undefined) subParts.push(a.count + ' P!GE0NS');
    var sub = subParts.length ? '<div class="tc-sub">' + escapeHtml(subParts.join(' :: ')) + '</div>' : '';
    return '<div class="trait-cell" data-trait="' + escapeHtml(a.trait_type) + '" data-value="' + escapeHtml(a.value) + '" title="V!EW ALL P!GE0NS W!TH TH!S TRA!T">' +
      '<div class="tc-label">' + escapeHtml(a.trait_type) + '</div><div class="tc-value">' + escapeHtml(a.value) + '</div>' + sub +
    '</div>';
  }
  // Clicking a trait cell on the INSPECT screen filters the browse view down
  // to every Pigeon sharing that exact trait/value.
  el.detailTraits.addEventListener('click', function(e){
    var cell = e.target.closest('.trait-cell');
    if (!cell) return;
    var trait = cell.getAttribute('data-trait');
    var value = cell.getAttribute('data-value');
    if (!trait || !value) return;
    ensureTraitsLoaded().then(function(){
      state.traitFilters = [{ id: state.nextTraitRowId++, category: trait, value: value }];
      renderTraitRows();
      el.searchInput.value = '';
      showScreen('browse');
      runQuery();
    });
  });
  function renderOwnerLink(short, full){
    if (!full){ el.detailOwner.textContent = 'N0T !NDEXED'; el.detailOwner.classList.add('not-indexed'); return; }
    el.detailOwner.classList.remove('not-indexed');
    el.detailOwner.innerHTML = '<a class="owner-link" href="#" data-wallet="' + escapeHtml(full) + '" data-short="' + escapeHtml(short || full) + '" title="V!EW TH!S WALLET\\'S FULL P!GE0N C0LLECT!0N">' + escapeHtml(short || full) + '</a>';
  }
  // Clicking the owner address on INSPECT jumps straight into that wallet's
  // full real Pigeon collection (same browse UI as SELECT), not an external
  // explorer.
  el.detailOwner.addEventListener('click', function(e){
    var link = e.target.closest('.owner-link');
    if (!link) return;
    e.preventDefault();
    browseOwnerCollection(link.getAttribute('data-wallet'), link.getAttribute('data-short'));
  });
  function updateDetailRarity(p){
    if (p && p.rarityRank){ el.detailRarityRow.style.display = ''; el.detailRarity.textContent = p.rarityRank + (p.rarityTotal ? ' / ' + p.rarityTotal : ''); }
    else el.detailRarityRow.style.display = 'none';
  }
  function updateDetailPrice(p){
    if (p && p.priceXrp !== null && p.priceXrp !== undefined){
      el.detailPriceRow.style.display = '';
      el.detailPrice.textContent = p.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP';
      el.detailBuyBtn.style.display = '';
      el.detailBuyBtn.href = p.buyUrl || ('https://deeptide.co/nft/' + p.nftId);
    } else {
      el.detailPriceRow.style.display = 'none';
      el.detailBuyBtn.style.display = 'none';
    }
    if (p && p.highSaleXrp !== null && p.highSaleXrp !== undefined){
      el.detailHighSaleRow.style.display = '';
      var hsText = p.highSaleXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP';
      el.detailHighSale.innerHTML = p.highSaleTxUrl
        ? '<a class="owner-link" href="' + escapeHtml(p.highSaleTxUrl) + '" target="_blank" rel="noopener">' + escapeHtml(hsText) + '</a>'
        : escapeHtml(hsText);
    } else {
      el.detailHighSaleRow.style.display = 'none';
    }
  }
  function findKnown(nftId){
    return state.items.filter(function(p){ return p.nftId === nftId; })[0] ||
      state.scopeAllItems.filter(function(p){ return p.nftId === nftId; })[0];
  }
  function openDetail(nftId){
    var known = findKnown(nftId);
    el.detailNum.textContent = known && known.number !== null ? 'P!GE0N #' + known.number : 'P!GE0N ...';
    el.detailImgBox.innerHTML = known && known.image ? '<img src="' + escapeHtml(known.image) + '" alt="">' : '[ IMAGE ]';
    if (known && known.owner) renderOwnerLink(known.ownerShort, known.owner);
    else { el.detailOwner.textContent = '...'; el.detailOwner.classList.remove('not-indexed'); }
    el.detailTraits.innerHTML = known ? known.attributes.map(traitCellHtml).join('') : '';
    el.detailNftId.textContent = nftId;
    updateDetailRarity(known);
    updateDetailPrice(known);
    state.currentDetail = known || { nftId: nftId, number: null, owner: null, ownerShort: null, attributes: [] };
    showScreen('detail');
    refreshCardSelectionStates();

    api({ detail: nftId }).then(function(data){
      if (!data.item){
        state.currentDetail = known || { nftId: nftId, number: null, owner: null, ownerShort: null, attributes: [] };
        renderOwnerLink(null, null);
        return;
      }
      var p = data.item;
      state.currentDetail = p;
      el.detailNum.textContent = p.number !== null ? 'P!GE0N #' + p.number : 'P!GE0N ...';
      el.detailImgBox.innerHTML = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="">' : '[ IMAGE ]';
      el.detailTraits.innerHTML = p.attributes.map(traitCellHtml).join('');
      updateDetailRarity(p);
      updateDetailPrice(p);
      renderOwnerLink(p.ownerShort, p.owner);
      refreshCardSelectionStates();
    }).catch(function(){
      renderOwnerLink(null, null);
    });
  }
  el.backToBrowseBtn.addEventListener('click', function(){ showScreen('browse'); });
  el.detailSelectBtn.addEventListener('click', function(){
    if (state.currentDetail) handleSelect(state.currentDetail);
  });

  // ---- Initial load ----
  ensureTraitsLoaded();
  loadTopHolders();
  startCollectionBrowse();
  loadMoreSales();

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

export async function onRequestGet(context) {
  const { request, env } = context;
  let wallet = null;
  if (env.Σκύλλα) {
    const token = getCookie(request, BOARD_COOKIE_NAME);
    if (token) {
      const payload = await verifyToken(token, env.Σκύλλα);
      if (payload && payload.acct) wallet = payload.acct;
    }
  }
  const html = SWAP_HTML.replace('"__SWAP_WALLET__"', JSON.stringify(wallet));
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
