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
<title>Σκύλλα :: SWAP</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500;700&display=swap');

  /* ==========================================================================
     Σκύλλα SWAP — colour + type system
     CYAN = signal / active / global collection / available actions
     MAGENTA = SCYLLA / target / selection / warning / attention
     WHITE = primary data, headings
     GREY = secondary data, metadata, disabled
     BLACK = depth (panels sit above the static as dark glass)
     ========================================================================== */
  :root{
    --bg:#08090b;
    --panel-bg:rgba(13,15,18,0.62);
    --panel-bg-solid:#0b0d10;
    --panel-texture:rgba(255,255,255,0.025);
    --border-dim:rgba(255,255,255,0.09);
    --border-mid:rgba(255,255,255,0.16);

    --cyan:#3df3ec;
    --cyan-dim:rgba(61,243,236,0.4);
    --cyan-faint:rgba(61,243,236,0.12);
    --cyan-glow:rgba(61,243,236,0.35);

    --magenta:#ff33cc;
    --magenta-dim:rgba(255,51,204,0.4);
    --magenta-faint:rgba(255,51,204,0.12);
    --magenta-glow:rgba(255,51,204,0.4);

    --green:#3dff8a;
    --green-glow:rgba(61,255,138,0.35);

    --white:#f3f4f6;
    --grey:rgba(226,229,233,0.56);
    --grey-dim:rgba(226,229,233,0.34);
    --grey-disabled:rgba(226,229,233,0.22);

    --font-display:'Space Grotesk','JetBrains Mono',sans-serif;
    --font-mono:'JetBrains Mono','Courier New',monospace;
    --font-body:'Inter','JetBrains Mono',sans-serif;

    --radius:2px;
  }

  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:var(--bg); }
  body{
    font-family:var(--font-mono);
    color:var(--white);
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
  /* faint fixed scanline texture, sitting above the static, below the UI —
     static, not animated; the CRT surface itself, not a live effect */
  body::before{
    content:'';
    position:fixed;
    inset:0;
    z-index:0;
    pointer-events:none;
    background:repeating-linear-gradient(
      to bottom,
      rgba(255,255,255,0.018) 0px,
      rgba(255,255,255,0.018) 1px,
      transparent 1px,
      transparent 3px
    );
    mix-blend-mode:overlay;
  }
  @keyframes flicker-in{
    0%{ opacity:0.4; }
    35%{ opacity:1; }
    45%{ opacity:0.55; }
    100%{ opacity:1; }
  }
  @media (prefers-reduced-motion: reduce){
    canvas#staticBg{ animation:none; }
    *{ animation-duration:0.001ms !important; animation-iteration-count:1 !important; transition-duration:0.001ms !important; }
  }
  .page{ max-width:1500px; width:100%; position:relative; z-index:1; }
  a.back-link{
    display:inline-block;
    font-family:var(--font-body);
    font-size:10.5px;
    letter-spacing:0.1em;
    color:var(--grey);
    text-decoration:none;
    margin-bottom:2.5rem;
    text-transform:uppercase;
    transition:color 0.15s ease;
  }
  a.back-link:hover{ color:var(--cyan); }

  h1{
    font-family:var(--font-display);
    font-weight:700;
    font-size:clamp(17px,4.6vw,32px);
    letter-spacing:0.08em;
    color:var(--white);
    text-shadow:
      -1.5px 0 rgba(61,243,236,0.55),
      1.5px 0 rgba(255,51,204,0.5);
    margin-bottom:0.4rem;
    text-align:center;
    text-transform:none;
  }
  .sw-panel{
    position:relative;
    border:1px solid var(--border-dim);
    background:var(--panel-bg);
    backdrop-filter:blur(7px);
    -webkit-backdrop-filter:blur(7px);
    box-shadow:inset 0 0 34px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.015);
    border-radius:var(--radius);
    padding:1.5rem;
    margin-bottom:1.75rem;
  }
  .sw-panel::before{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    background:repeating-linear-gradient(
      to bottom,
      var(--panel-texture) 0px,
      var(--panel-texture) 1px,
      transparent 1px,
      transparent 4px
    );
    opacity:0.5;
  }
  .panel-title{
    text-align:center;
    font-size:12.5px;
    font-weight:500;
    letter-spacing:0.24em;
    color:var(--white);
    margin-bottom:1rem;
    text-transform:uppercase;
  }

  /* ---- reference-image texture: one non-repeating instance per panel,
     cover-sized (preserves native aspect ratio, unlike percentage
     sizing which stretches per-axis) and cropped toward one corner of
     the source. Tiling this at a fixed size turned it into a regular
     wallpaper grid, which reads as decorative pattern rather than
     glitch — real static doesn't repeat periodically. Nearly blacked
     out by the scrim gradient so it reads as faint noise, never
     competing with the text on top. ---- */
  .sw-panel-signal{
    background-image:
      linear-gradient(rgba(8,9,11,0.85), rgba(8,9,11,0.85)),
      url('/assets/digitalglitchpattern.png');
    background-size:100% 100%, cover;
    background-position:center, top left;
    background-repeat:no-repeat, no-repeat;
  }
  .sw-panel-target{
    background-image:
      linear-gradient(rgba(8,9,11,0.82), rgba(8,9,11,0.82)),
      url('/assets/digitalglitchpattern.png');
    background-size:100% 100%, cover;
    background-position:center, bottom right;
    background-repeat:no-repeat, no-repeat;
  }

  /* ---- database (multi-collection) selector ---- */
  .db-select-wrap{ text-align:center; position:relative; margin-bottom:1.75rem; }
  .db-select-toggle{
    background:transparent;
    border:none;
    font-family:var(--font-mono);
    font-size:17px;
    font-weight:700;
    letter-spacing:0.14em;
    color:var(--grey);
    text-transform:uppercase;
    cursor:pointer;
    padding:0;
  }
  .db-select-toggle .db-active-name{ color:var(--cyan); text-shadow:0 0 8px var(--cyan-glow); }
  .db-select-menu{
    margin:0.75rem auto 0;
    max-width:260px;
    border:1px solid var(--border-mid);
    background:var(--panel-bg-solid);
    border-radius:var(--radius);
  }
  .db-option{
    padding:0.65em 1em;
    font-size:12px;
    letter-spacing:0.1em;
    text-transform:uppercase;
    border-bottom:1px solid var(--border-dim);
    display:flex;
    align-items:center;
    justify-content:center;
    gap:0.5em;
  }
  .db-option:last-child{ border-bottom:none; }
  .db-option-active{ color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); cursor:default; }
  .db-option-disabled{ color:var(--grey-disabled); cursor:not-allowed; }
  .db-soon{ font-size:9px; letter-spacing:0.1em; border:1px solid var(--border-mid); color:var(--grey-dim); padding:0.2em 0.4em; }

  /* ---- collection details: token/issuer info ---- */
  .collection-info{ max-width:620px; margin:0 auto 1.25rem; text-align:center; }
  .ci-label{ font-size:10px; letter-spacing:0.15em; color:var(--grey-dim); text-transform:uppercase; margin-bottom:0.6rem; }
  .ci-addr-row{ display:flex; align-items:center; justify-content:center; gap:1rem; flex-wrap:wrap; }
  .ci-value{ color:var(--white); word-break:break-all; }
  .ci-value-big{ font-size:14px; letter-spacing:0.02em; }
  .ci-copy-btn{ font-size:12px; padding:0.65em 1.1em; flex:0 0 auto; }

  .my-pigeons-grid{ margin-top:1rem; }

  /* ---- collection stats strip (global system data — cyan accent) ---- */
  .stats-strip{
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));
    gap:0.75rem;
  }
  .stat-tile{
    border:1px solid var(--border-dim);
    background:rgba(255,255,255,0.015);
    padding:0.85rem 0.5rem;
    text-align:center;
    border-radius:var(--radius);
  }
  .stat-tile-link{ display:block; width:100%; text-decoration:none; cursor:pointer; font:inherit; transition:border-color 0.15s ease, background 0.15s ease; }
  .stat-tile-link:hover{ background:var(--cyan-faint); border-color:var(--cyan-dim); }
  .stat-label{ font-size:9px; letter-spacing:0.15em; color:var(--grey-dim); margin-bottom:0.5rem; text-transform:uppercase; }
  .stat-value{ font-size:16px; letter-spacing:0.03em; color:var(--white); }
  .stat-tile-link .stat-value{ color:var(--grey); }
  .stat-tile-link:hover .stat-value{ color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); }
  /* Σκύλλα-native listings — magenta, matching the SCYLLA/target colour language */
  .stat-tile-link.scylla-active{ border-color:var(--magenta); background:var(--magenta-faint); }
  .stat-tile-link.scylla-active:hover{ background:var(--magenta-faint); border-color:var(--magenta); }
  .stat-tile-link.scylla-active .stat-value{ color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); }
  .card-scylla-listed{ margin-top:0.4rem; font-size:10px; letter-spacing:0.05em; color:var(--magenta); text-shadow:0 0 5px var(--magenta-glow); text-align:center; text-transform:uppercase; }

  /* ---- top 10 holders (expandable) ---- */
  .th-toggle{
    display:block;
    width:100%;
    text-align:center;
    background:transparent;
    border:none;
    font-family:var(--font-mono);
    font-size:12px;
    letter-spacing:0.18em;
    color:var(--cyan);
    text-shadow:0 0 5px var(--cyan-glow);
    text-transform:uppercase;
    cursor:pointer;
    padding:0;
  }
  .th-list{ margin-top:1rem; border-top:1px dashed var(--border-dim); padding-top:0.5rem; }

  /* ---- horizontal top tabs (DATABASE / MY PIGEONS / TOP 10 / SALES DATA) ---- */
  .top-tabs{
    display:flex;
    overflow-x:auto;
    gap:0.4rem;
    margin-bottom:1.75rem;
    border-bottom:1px solid var(--border-dim);
  }
  .tab-btn{
    flex:1 1 auto;
    white-space:nowrap;
    background:transparent;
    border:none;
    border-bottom:2px solid transparent;
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.12em;
    color:var(--grey-dim);
    text-transform:uppercase;
    cursor:pointer;
    padding:0.85em 0.5em;
    transition:color 0.15s ease;
  }
  .tab-btn:hover{ color:var(--grey); }
  .tab-btn.active{ color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); border-bottom-color:var(--cyan); }
  .th-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.75rem;
    padding:0.6em 0.4em;
    border-bottom:1px solid var(--border-dim);
    cursor:pointer;
    font-size:12px;
    letter-spacing:0.03em;
    transition:background 0.15s ease;
  }
  .th-row:last-child{ border-bottom:none; }
  .th-row:hover{ background:var(--cyan-faint); }
  .th-rank{ flex:0 0 2.2em; color:var(--cyan); }
  .th-wallet{ flex:1; min-width:0; color:var(--white); word-break:break-all; }
  .th-count{ flex:0 0 auto; color:var(--grey); text-transform:uppercase; }
  .th-empty{ text-align:center; font-size:11px; letter-spacing:0.08em; color:var(--grey-dim); padding:0.5rem 0; text-transform:uppercase; }

  /* ---- sales history ---- */
  .sales-scrollbox{
    margin-top:1rem;
    border-top:1px dashed var(--border-dim);
    padding-top:0.5rem;
    max-height:820px;
    overflow-y:auto;
  }
  .sale-row{
    display:flex;
    align-items:center;
    gap:1rem;
    padding:0.9rem 0.4rem;
    border-bottom:1px solid var(--border-dim);
    font-size:12px;
    letter-spacing:0.03em;
    flex-wrap:wrap;
  }
  .sale-row:last-child{ border-bottom:none; }
  .sale-thumb-wrap{ display:flex; flex-direction:column; align-items:center; gap:0.4rem; flex:0 0 auto; }
  .sale-num-box{
    font-size:11px;
    letter-spacing:0.05em;
    color:var(--white);
    border:1px solid var(--border-mid);
    padding:0.3em 0.6em;
    cursor:pointer;
    white-space:nowrap;
    border-radius:var(--radius);
  }
  .sale-thumb{ flex:0 0 auto; width:96px; height:96px; cursor:pointer; border:1px solid var(--border-dim); }
  .sale-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
  .sale-info{ flex:1 1 200px; display:flex; flex-direction:column; gap:0.35rem; }
  .sale-price{ font-family:var(--font-mono); font-size:14px; color:var(--white); }
  .sale-via{ font-family:var(--font-body); font-size:10px; letter-spacing:0.08em; color:var(--grey-dim); text-transform:uppercase; }
  .sale-parties{ font-family:var(--font-body); color:var(--grey); text-transform:none; }
  .sale-parties a{ color:var(--white); text-decoration:underline; cursor:pointer; }
  .sale-parties a:hover{ color:var(--cyan); }
  .sale-time{ font-family:var(--font-body); color:var(--grey-dim); text-transform:uppercase; font-size:10px; }

  /* ---- target node header (owner-scope) — SCYLLA / MAGENTA system ---- */
  .node-eyebrow{
    text-align:center;
    font-size:11px;
    letter-spacing:0.2em;
    color:var(--magenta);
    text-shadow:0 0 7px var(--magenta-glow);
    margin-bottom:1.25rem;
    text-transform:uppercase;
  }
  .target-pigeon-card{
    border:1px solid var(--magenta-dim);
    background:var(--magenta-faint);
    border-radius:var(--radius);
    padding:1rem;
    margin:0 auto 1.25rem;
    max-width:420px;
  }
  .tp-label{
    text-align:center;
    font-size:10px;
    letter-spacing:0.2em;
    color:var(--grey);
    margin-bottom:0.75rem;
    text-transform:uppercase;
  }
  .tp-body{ display:flex; align-items:center; gap:1rem; }
  .tp-img{ flex:0 0 76px; width:76px; height:76px; border:1px solid var(--magenta-dim); }
  .tp-info{ flex:1; min-width:0; }
  .tp-num{ font-size:16px; color:var(--white); margin-bottom:0.5rem; }
  .tp-owner-label{ font-size:9px; letter-spacing:0.15em; color:var(--grey-dim); text-transform:uppercase; }
  .tp-owner{ font-size:12px; color:var(--grey); word-break:break-all; }
  .wallet-box{
    position:relative;
    text-align:center;
    border:1px solid var(--magenta);
    background:var(--magenta-faint);
    box-shadow:0 0 22px var(--magenta-faint) inset, 0 0 14px rgba(255,63,208,0.18);
    border-radius:var(--radius);
    padding:1.5rem 1rem;
    margin-bottom:1.25rem;
    animation:flicker-in 0.5s ease-out;
  }
  .wallet-box-title{
    font-size:14px;
    font-weight:700;
    letter-spacing:0.18em;
    color:var(--magenta);
    text-shadow:0 0 9px var(--magenta-glow);
    margin-bottom:0.75rem;
    text-transform:uppercase;
  }
  .wallet-box-sub{ font-size:10px; letter-spacing:0.2em; color:var(--grey-dim); font-weight:400; }
  .wallet-box-addr{ font-size:16px; color:var(--white); margin-bottom:0.6rem; word-break:break-all; letter-spacing:0.02em; }
  .wallet-box-count{ font-size:12.5px; letter-spacing:0.1em; color:var(--grey); text-transform:uppercase; }

  /* ---- search / sort bar ---- */
  .search-row{
    display:flex;
    gap:0.6rem;
    flex-wrap:wrap;
    margin-bottom:0.75rem;
  }
  .sort-stack-row{
    display:flex;
    align-items:flex-start;
    gap:0.6rem;
    flex-wrap:wrap;
    margin-bottom:0.75rem;
  }
  input.search-input{
    flex:0 1 140px;
    background:#000;
    border:1px solid var(--border-mid);
    color:var(--white);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.55em 0.6em;
    border-radius:var(--radius);
    transition:border-color 0.15s ease;
  }
  input.search-input:focus{ outline:none; border-color:var(--cyan); box-shadow:0 0 0 1px var(--cyan-dim); }
  input.search-input::placeholder{ color:var(--grey-disabled); text-transform:uppercase; }
  .search-row .bar-btn{ padding:0.55em 0.8em; font-size:10px; }
  .bar-btn{
    flex:0 0 auto;
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.75em 1.1em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  .bar-btn:hover{ border-color:var(--cyan); color:var(--cyan); background:var(--cyan-faint); }
  select.sort-select{
    flex:0 0 auto;
    background:#000;
    border:1px solid var(--border-mid);
    color:var(--white);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.75em 0.9em;
    text-transform:uppercase;
    cursor:pointer;
    border-radius:var(--radius);
    transition:border-color 0.15s ease;
  }
  select.sort-select:focus{ outline:none; border-color:var(--cyan); }
  select.sort-select option{ background:var(--panel-bg-solid); color:var(--white); }
  .edition-toggle{
    flex:0 0 auto;
    display:flex;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    overflow:hidden;
  }
  .edition-btn{
    background:transparent;
    border:none;
    border-right:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.75em 0.9em;
    text-transform:uppercase;
    cursor:pointer;
    transition:border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  .edition-btn:last-child{ border-right:none; }
  .edition-btn:hover{ color:var(--cyan); background:var(--cyan-faint); }
  .edition-btn.active{ background:var(--magenta-faint); color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); }
  .index-line{
    text-align:center;
    font-family:var(--font-body);
    font-size:9.5px;
    letter-spacing:0.06em;
    color:var(--grey-dim);
    margin-top:0.5rem;
    text-transform:uppercase;
  }

  /* ---- trait stack filter panel (active filter = cyan) ---- */
  .traits-block{
    border-top:1px dashed var(--border-dim);
    margin-top:1rem;
    padding-top:1rem;
  }
  .results-block{
    border-top:1px dashed var(--border-dim);
    margin-top:1.25rem;
    padding-top:1.25rem;
  }
  .trait-row{
    display:flex;
    align-items:center;
    gap:0.5rem;
    margin-bottom:0.6rem;
    flex-wrap:wrap;
  }
  .trait-row-label{
    font-size:13px;
    letter-spacing:0.2em;
    color:var(--grey);
    text-transform:uppercase;
    flex:0 0 auto;
  }
  .traits-hover-wrap{ position:relative; display:inline-flex; }
  .traits-hover-wrap .trait-row-label{ cursor:pointer; padding:0.9em 0.6em; }
  #traitsHoverLabel{ color:var(--cyan); text-shadow:0 0 5px var(--cyan-glow); }
  .traits-hover-wrap:hover .trait-row-label,
  .traits-hover-wrap.open .trait-row-label{ color:var(--cyan); text-shadow:0 0 5px var(--cyan-glow); }
  .traits-flyout{
    position:absolute;
    top:100%;
    left:0;
    z-index:60;
    display:flex;
    width:min(620px, 90vw);
    max-height:420px;
    background:var(--panel-bg-solid);
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    box-shadow:0 10px 30px rgba(0,0,0,0.6);
  }
  .traits-flyout-cats{
    flex:0 0 42%;
    overflow-y:auto;
    border-right:1px solid var(--border-dim);
  }
  .traits-flyout-vals{
    flex:1;
    overflow-y:auto;
    padding:0.6rem;
  }
  .traits-flyout-cat{
    display:block;
    width:100%;
    text-align:left;
    background:transparent;
    border:none;
    border-bottom:1px solid var(--border-dim);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:13px;
    letter-spacing:0.06em;
    padding:0.9em 1em;
    cursor:pointer;
    text-transform:uppercase;
    transition:background 0.15s ease, color 0.15s ease;
  }
  .traits-flyout-cat:hover, .traits-flyout-cat.active{ background:var(--cyan-faint); color:var(--cyan); }
  .traits-flyout-val{
    display:flex;
    align-items:center;
    justify-content:space-between;
    width:100%;
    gap:0.5rem;
    background:transparent;
    border:1px solid var(--border-dim);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:13px;
    letter-spacing:0.03em;
    padding:0.75em 0.9em;
    margin-bottom:0.4rem;
    cursor:pointer;
    text-align:left;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  .traits-flyout-val:hover{ border-color:var(--cyan-dim); color:var(--white); }
  .traits-flyout-val.selected{ background:var(--cyan-faint); border-color:var(--cyan); color:var(--cyan); text-shadow:0 0 5px var(--cyan-glow); }
  .traits-flyout-val .tfv-count{ color:var(--grey-dim); font-size:11px; flex:0 0 auto; }
  select.trait-cat-select{
    background:#000;
    border:1px solid var(--border-mid);
    color:var(--white);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.55em 0.7em;
    text-transform:uppercase;
    cursor:pointer;
    border-radius:var(--radius);
  }
  select.trait-cat-select option{ background:var(--panel-bg-solid); color:var(--white); }
  .trait-value-chips{
    display:flex;
    flex-direction:column;
    gap:0.35rem;
    width:100%;
    margin-top:0.5rem;
    max-height:220px;
    overflow-y:auto;
    padding:0.5rem;
    border:1px dashed var(--border-dim);
  }
  .trait-chip{
    display:flex;
    align-items:center;
    justify-content:space-between;
    width:100%;
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.55em 0.8em;
    cursor:pointer;
    text-align:left;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .trait-chip:hover{ border-color:var(--cyan-dim); color:var(--white); }
  .trait-chip.selected{ background:var(--cyan-faint); color:var(--cyan); border-color:var(--cyan); text-shadow:0 0 5px var(--cyan-glow); }
  .trait-row-tag{
    background:var(--cyan-faint);
    border:1px solid var(--cyan-dim);
    border-radius:var(--radius);
    padding:0.4em 0.6em;
  }
  .trait-tag-label{ color:var(--cyan); font-family:var(--font-mono); font-size:11px; letter-spacing:0.04em; text-shadow:0 0 5px var(--cyan-glow); flex:1; }
  .trait-row-remove{
    background:transparent;
    border:1px solid var(--magenta-dim);
    color:var(--magenta);
    font-family:var(--font-mono);
    font-size:12px;
    width:2em;
    height:2em;
    cursor:pointer;
    border-radius:var(--radius);
    transition:background 0.15s ease;
  }
  .trait-row-remove:hover{ background:var(--magenta-faint); }
  .traits-actions{
    display:flex;
    gap:0.6rem;
    margin-top:0.5rem;
    flex-wrap:wrap;
  }
  .clear-traits-btn{
    background:transparent;
    border:1px solid rgba(255,61,61,0.5);
    color:#ff3d3d;
    text-shadow:0 0 5px rgba(255,61,61,0.5);
    font-family:var(--font-mono);
    font-size:14px;
    font-weight:700;
    letter-spacing:0.1em;
    padding:0.7em 1.3em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:background 0.15s ease;
  }
  .clear-traits-btn:hover{ background:rgba(255,61,61,0.12); }

  /* ---- results status line ---- */
  .status-line{
    text-align:center;
    font-family:var(--font-body);
    font-size:11px;
    letter-spacing:0.08em;
    color:var(--grey-dim);
    margin:1.1rem 0 1rem;
    text-transform:uppercase;
  }
  .status-line .hi{ color:var(--cyan); text-shadow:0 0 5px var(--cyan-glow); }

  /* ---- empty state (attention = magenta) ---- */
  .empty-state{ text-align:center; padding:2rem 0; }
  .empty-state .es-title{
    font-size:13px;
    letter-spacing:0.15em;
    color:var(--magenta);
    text-shadow:0 0 6px var(--magenta-glow);
    margin-bottom:1rem;
    text-transform:uppercase;
  }
  .empty-state .es-line{
    font-family:var(--font-body);
    font-size:11px;
    letter-spacing:0.03em;
    color:var(--grey);
    margin-bottom:0.5rem;
    text-transform:none;
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
    background:repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 6px, transparent 6px, transparent 12px);
    border:1px dashed var(--border-dim);
    font-size:10px;
    letter-spacing:0.1em;
    color:var(--grey-disabled);
  }
  .pigeon-img-box img{ width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.25s ease; }
  .card-select-toggle, .my-pigeon-offer-toggle{
    position:absolute;
    top:0.3rem;
    right:0.3rem;
    z-index:2;
    width:1.6em;
    height:1.6em;
    line-height:1.6em;
    padding:0;
    background:rgba(8,9,11,0.8);
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-size:13px;
    cursor:pointer;
    text-align:center;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .card-select-toggle:hover, .my-pigeon-offer-toggle:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  .card-select-toggle.selected, .my-pigeon-offer-toggle.selected{ background:var(--magenta); color:#08090b; border-color:var(--magenta); animation:flicker-in 0.3s ease-out; }
  .my-pigeon-offer-toggle.at-cap{ opacity:0.35; cursor:not-allowed; }

  /* ---- DATABASE results: two wide rows side by side, not a 6-up grid
     of tiles — a much bigger thumbnail/number/rarity on the left, every
     other detail (both marketplaces' listings, highest/average sale)
     laid out on the right where there's actually room for it. ---- */
  .result-list{
    display:grid;
    grid-template-columns:repeat(2, 1fr);
    gap:0.9rem;
  }
  .result-row{
    display:flex;
    align-items:stretch;
    gap:1.2rem;
    padding:1rem;
  }
  .result-row-left{
    flex:0 0 auto;
    width:220px;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:0.5rem;
  }
  .result-row-left .pigeon-img-box{ width:100%; }
  .result-row-left .result-num{ border-bottom:none; padding:0; font-size:22px; }
  .result-row-left .result-rarity-line{ font-size:16px; }
  .result-row-right{
    flex:1;
    min-width:0;
    display:flex;
    flex-direction:column;
    justify-content:center;
    gap:0.5rem;
  }
  .result-row-right .card-listings{ margin-top:0; }
  .result-row-right .card-sale-stats{ margin-top:0; padding-top:0.5rem; }
  @media (max-width:1100px){
    .result-list{ grid-template-columns:1fr; }
  }
  @media (max-width:700px){
    .result-row{ flex-direction:column; align-items:center; text-align:center; }
    .result-row-left{ width:100%; max-width:200px; }
  }

  /* ---- old grid-tile card, still used by MY PIGEONS (myPigeonCardHtml) ---- */
  .result-grid{
    display:grid;
    grid-template-columns:repeat(6, 1fr);
    gap:0.7rem;
  }
  .result-card{
    position:relative;
    border:1px solid var(--border-dim);
    background:rgba(255,255,255,0.012);
    border-radius:var(--radius);
    overflow:hidden;
    transition:border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .result-card:hover{ border-color:var(--cyan-dim); box-shadow:0 0 0 1px var(--cyan-faint), 0 0 16px rgba(63,231,255,0.1); }
  .result-card:hover .pigeon-img-box img{ transform:scale(1.04); }
  .result-card:hover .result-num{ color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); }
  .result-card .pigeon-img-box{ border:none; }
  .result-card.in-target{ border-color:var(--magenta); box-shadow:0 0 0 1px var(--magenta-dim) inset, 0 0 14px rgba(255,63,208,0.22); }
  .result-card.in-target .result-num{ color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); }
  .result-card-body{ padding:0.6rem 0.45rem; }
  .result-num{
    font-size:17px;
    font-weight:700;
    letter-spacing:0.03em;
    color:var(--white);
    text-align:center;
    padding:0.55rem 0.35rem;
    border-bottom:1px solid var(--border-dim);
    transition:color 0.15s ease;
  }
  .result-rarity-line{ font-size:14px; letter-spacing:0.03em; color:var(--grey); text-align:center; }
  .card-listings{ display:flex; gap:0.4rem; margin-top:0.45rem; }
  .cl-block{
    display:block;
    flex:1;
    min-width:0;
    border:1px solid var(--border-dim);
    padding:0.45rem 0.3rem;
    text-align:center;
    text-decoration:none;
  }
  .cl-market{ font-size:9px; letter-spacing:0.08em; color:var(--grey-dim); text-transform:uppercase; margin-bottom:0.35rem; }
  .cl-price{ font-size:12px; font-weight:700; letter-spacing:0.02em; color:var(--green); text-shadow:0 0 6px var(--green-glow); }
  .cl-price.cl-none{ color:var(--grey-disabled); font-size:10px; font-weight:400; text-shadow:none; text-transform:uppercase; }
  /* The whole box IS the buy action when a real listing exists — filled
     green, not just a border, so it reads as clickable at a glance. */
  .cl-block-buy{
    cursor:pointer;
    background:var(--green-glow);
    border-color:var(--green);
    transition:background 0.15s ease, box-shadow 0.15s ease;
  }
  .cl-block-buy:hover{ background:rgba(61,255,138,0.28); box-shadow:0 0 14px var(--green-glow); }
  .cl-block-buy .cl-price{ color:var(--bg); text-shadow:none; }
  .cl-block-buy .cl-market{ color:rgba(8,9,11,0.65); }
  .card-sale-stats{ display:flex; flex-direction:column; gap:0.25rem; margin-top:0.45rem; padding-top:0.45rem; border-top:1px dashed var(--border-dim); }
  .css-item{ font-size:13px; letter-spacing:0.02em; color:var(--white); text-align:center; font-weight:600; }
  .css-label{ display:inline-block; min-width:110px; color:var(--grey-dim); text-transform:uppercase; letter-spacing:0.05em; margin-right:0.4em; font-size:10px; font-weight:400; }

  /* ---- DATABASE row card: $PIGEONS listing (styled as a currency —
     coin icon + amount), traits, and an in-card sales-history toggle that
     replaces the whole right-hand box while open ---- */
  .card-scylla-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.6rem;
    padding:0.4em 0.6em;
    border:1px solid var(--magenta-dim);
    border-radius:var(--radius);
    background:rgba(255,63,208,0.05);
    margin-top:0.45rem;
  }
  .card-scylla-coin-wrap{ display:flex; align-items:center; gap:0.45rem; }
  .card-scylla-coin{ width:18px; height:18px; border-radius:50%; object-fit:cover; border:1px solid var(--magenta-dim); box-shadow:0 0 5px var(--magenta-glow); }
  .card-scylla-price{ font-size:12px; font-weight:700; letter-spacing:0.02em; color:var(--magenta); text-shadow:0 0 5px var(--magenta-glow); }
  .card-buy-scylla-btn{ background:transparent; border:1px solid var(--magenta-dim); color:var(--magenta); font-family:var(--font-mono); font-size:10px; letter-spacing:0.1em; padding:0.35em 0.7em; cursor:pointer; text-transform:uppercase; border-radius:var(--radius); transition:background 0.15s ease; }
  .card-buy-scylla-btn:hover{ background:var(--magenta-faint); }
  .card-traits{ display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.5rem; }
  .card-trait-chip{ font-size:10px; letter-spacing:0.03em; color:var(--grey); border:1px solid var(--border-dim); border-radius:var(--radius); padding:0.25em 0.55em; white-space:nowrap; }
  .card-trait-chip b{ color:var(--grey-dim); font-weight:600; text-transform:uppercase; letter-spacing:0.06em; font-size:9px; margin-right:0.35em; }
  .card-history-toggle{
    display:block;
    width:100%;
    margin-top:0.55rem;
    padding-top:0.5rem;
    border-top:1px dashed var(--border-dim);
    background:transparent;
    border-left:none; border-right:none; border-bottom:none;
    color:var(--cyan-dim);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:0.12em;
    text-transform:uppercase;
    cursor:pointer;
    text-align:center;
  }
  .card-history-toggle:hover{ color:var(--cyan); }
  .card-history-box{ margin-top:0.5rem; }
  .card-history-back{
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:0.1em;
    padding:0.35em 0.7em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    margin-bottom:0.5rem;
  }
  .card-history-back:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  .card-history-list .dh-row{ padding:0.5em 0; }
  .card-history-list .dh-line{ font-size:11px; }
  .card-select-toggle, .my-pigeon-offer-toggle{ width:1.9em; height:1.9em; line-height:1.9em; font-size:16px; }

  @media (max-width:900px){
    .result-grid{ grid-template-columns:repeat(3, 1fr); }
  }
  @media (max-width:700px){
    body{ padding:4vh 2.5vw 6vh; }
    .sw-panel{ padding:1rem 0.75rem; }
    /* 2-wide on mobile, still bigger than the old cramped tiles. */
    .result-grid{ grid-template-columns:repeat(2, 1fr); gap:0.7rem; }
    .result-card-body{ padding:0.6rem 0.5rem; }
    .result-num{ font-size:17px; padding:0.5rem 0.35rem; }
    .card-select-toggle, .my-pigeon-offer-toggle{ width:1.7em; height:1.7em; line-height:1.7em; font-size:14px; }
  }

  /* ---- infinite scroll ---- */
  .scroll-sentinel{ height:1px; }
  .load-more-note{
    text-align:center;
    font-size:11px;
    letter-spacing:0.1em;
    color:var(--cyan-dim);
    padding:1.5rem 0;
    text-transform:uppercase;
  }
  .end-of-collection-note{
    text-align:center;
    font-family:var(--font-body);
    font-size:10px;
    letter-spacing:0.06em;
    color:var(--grey-disabled);
    padding:1.5rem 0;
    text-transform:uppercase;
  }

  /* ---- pagination (kept for detail-only contexts; browse now uses
     infinite scroll instead) ---- */
  .pagination-row{ display:flex; justify-content:center; gap:0.75rem; margin-top:1.5rem; }
  .page-btn{
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.65em 1.3em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .page-btn:hover:not(:disabled){ border-color:var(--cyan-dim); color:var(--cyan); }
  .page-btn:disabled{ opacity:0.3; cursor:not-allowed; }
  .loading-note{
    text-align:center;
    font-size:11px;
    letter-spacing:0.1em;
    color:var(--cyan-dim);
    padding:1.5rem 0;
    text-transform:uppercase;
  }

  /* ---- detail screen ---- */
  .detail-eyebrow{
    text-align:center;
    font-size:11px;
    letter-spacing:0.2em;
    color:var(--cyan);
    text-shadow:0 0 6px var(--cyan-glow);
    margin-bottom:0.75rem;
    text-transform:uppercase;
  }
  .detail-num{ text-align:center; font-family:var(--font-display); font-weight:700; font-size:22px; letter-spacing:0.04em; color:var(--white); margin-bottom:1.25rem; }
  .detail-img-large{ width:100%; max-width:460px; margin:0 auto 0.75rem; border:1px solid var(--border-mid); }
  .detail-listings-row{ max-width:460px; margin:0 auto 1.25rem; }
  .detail-listings-row .cl-block{ padding:0.65rem 0.5rem; }
  .detail-listings-row .cl-market{ font-size:10px; margin-bottom:0.45rem; }
  .detail-listings-row .cl-price{ font-size:14px; }
  .detail-field{
    display:flex;
    justify-content:space-between;
    max-width:460px;
    margin:0 auto 0.7rem;
    font-size:12px;
    letter-spacing:0.05em;
  }
  .df-label{ color:var(--grey-dim); text-transform:uppercase; }
  .df-value{ color:var(--white); text-align:right; word-break:break-all; }
  .df-value.not-indexed{ color:var(--magenta); text-shadow:0 0 4px var(--magenta-glow); }
  .df-value.rarity{ color:var(--white); }
  .df-value.price{ color:var(--white); }
  .df-value a.owner-link{ color:var(--grey); text-decoration:underline; }
  .df-value a.owner-link:hover{ color:var(--cyan); }
  .detail-traits-title{
    text-align:center;
    font-size:11px;
    letter-spacing:0.2em;
    color:var(--grey);
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
  .trait-cell{ border:1px solid var(--border-dim); padding:0.6rem 0.75rem; text-align:center; cursor:pointer; border-radius:var(--radius); transition:border-color 0.15s ease, background 0.15s ease; }
  .trait-cell:hover{ background:var(--cyan-faint); border-color:var(--cyan-dim); }
  .trait-cell .tc-label{ font-size:9px; letter-spacing:0.15em; color:var(--grey-dim); margin-bottom:0.35rem; text-transform:uppercase; }
  .trait-cell .tc-value{ font-size:13px; letter-spacing:0.03em; color:var(--white); }
  .trait-cell .tc-sub{ font-size:9px; letter-spacing:0.06em; color:var(--grey); margin-top:0.3rem; text-transform:uppercase; }
  .tech-meta-title{ text-align:center; font-size:10px; letter-spacing:0.2em; color:var(--grey-dim); margin-bottom:0.6rem; text-transform:uppercase; }
  .listings-block{ max-width:460px; margin:1.25rem auto 0; }
  .listing-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.6rem;
    padding:0.5em 0.6em;
    border:1px solid var(--border-mid);
    margin-bottom:0.5rem;
    font-size:12px;
    letter-spacing:0.03em;
    border-radius:var(--radius);
  }
  .listing-market{ color:var(--grey-dim); text-transform:uppercase; letter-spacing:0.1em; font-size:10px; }
  .listing-price{ color:var(--white); }
  .listing-buy{
    background:transparent;
    border:1px solid var(--cyan-dim);
    color:var(--cyan);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:0.1em;
    padding:0.35em 0.7em;
    cursor:pointer;
    text-transform:uppercase;
    text-decoration:none;
    border-radius:var(--radius);
    transition:background 0.15s ease;
  }
  .listing-buy:hover{ background:var(--cyan-faint); }
  /* $PIGEONS marketplace listing — styled to read as a currency amount
     (coin icon + number), distinct from the plain XRP listing rows above */
  .scylla-listing-block{ max-width:460px; margin:1.25rem auto 0; }
  .scylla-listing-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.6rem;
    padding:0.5em 0.6em;
    border:1px solid var(--magenta-dim);
    margin-bottom:0.5rem;
    border-radius:var(--radius);
    background:rgba(255,63,208,0.05);
  }
  .scylla-coin-wrap{ display:flex; align-items:center; gap:0.5rem; }
  .scylla-coin-icon{ width:22px; height:22px; border-radius:50%; object-fit:cover; border:1px solid var(--magenta-dim); box-shadow:0 0 6px var(--magenta-glow); }
  .scylla-listing-price{ font-size:13px; font-weight:700; letter-spacing:0.02em; color:var(--magenta); text-shadow:0 0 5px var(--magenta-glow); }
  #detailScyllaBuyBtn{ border-color:var(--magenta-dim); color:var(--magenta); }
  #detailScyllaBuyBtn:hover{ background:var(--magenta-faint); }
  .detail-history{ max-width:560px; margin:1.25rem auto 0; border-top:1px dashed var(--border-dim); padding-top:1rem; }
  .dh-row{
    padding:0.7em 0.3em;
    border-bottom:1px solid var(--border-dim);
  }
  .dh-row:last-child{ border-bottom:none; }
  .dh-line{ font-size:12px; letter-spacing:0.02em; color:var(--grey); margin-bottom:0.35em; }
  .dh-verb{ color:var(--cyan); text-shadow:0 0 4px var(--cyan-glow); text-transform:uppercase; font-weight:700; }
  .dh-price{ color:var(--white); }
  .dh-line a{ color:var(--white); text-decoration:underline; }
  .dh-line a:hover{ color:var(--cyan); }
  .dh-meta{ display:flex; align-items:center; justify-content:space-between; gap:0.6rem; }
  .dh-time{ color:var(--grey-dim); font-size:10px; letter-spacing:0.05em; text-transform:uppercase; }
  .dh-tx{ color:var(--grey-dim); font-size:10px; letter-spacing:0.06em; text-decoration:none; text-transform:uppercase; }
  .dh-tx:hover{ color:var(--cyan); text-decoration:underline; }
  .view-elsewhere{ max-width:560px; margin:1.25rem auto 0; border-top:1px dashed var(--border-dim); padding-top:1rem; }
  .view-links{ display:flex; justify-content:center; gap:0.6rem; flex-wrap:wrap; }
  .detail-actions{ display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap; margin-top:1.5rem; }
  .secondary-btn{
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:12px;
    letter-spacing:0.1em;
    padding:0.75em 1.4em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .secondary-btn:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  .action-btn{
    background:transparent;
    border:1px solid var(--cyan-dim);
    color:var(--cyan);
    font-family:var(--font-mono);
    font-size:12px;
    letter-spacing:0.12em;
    padding:0.75em 1.4em;
    cursor:pointer;
    text-transform:uppercase;
    text-shadow:0 0 6px var(--cyan-glow);
    border-radius:var(--radius);
    transition:background 0.15s ease, border-color 0.15s ease;
  }
  .action-btn:hover{ background:var(--cyan-faint); border-color:var(--cyan); }
  .action-btn.selected{ background:var(--magenta-faint); color:var(--magenta); border-color:var(--magenta); text-shadow:0 0 7px var(--magenta-glow); animation:flicker-in 0.3s ease-out; }

  /* ---- target assets sticky bar — SCYLLA / MAGENTA ---- */
  .target-bar{
    position:fixed;
    left:50%;
    bottom:0;
    transform:translateX(-50%);
    z-index:40;
    width:min(960px, 100%);
    background:var(--panel-bg-solid);
    border-top:1px solid var(--magenta);
    box-shadow:0 -4px 20px rgba(0,0,0,0.55), 0 -1px 14px rgba(255,63,208,0.15);
    padding:0.75rem 1.25rem;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:1rem;
    cursor:pointer;
  }
  .target-bar .tb-label{ font-size:12px; letter-spacing:0.1em; color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); text-transform:uppercase; }
  .target-bar .tb-toggle{ font-size:11px; color:var(--grey); text-transform:uppercase; }

  /* ---- YOUR OFFER bundle builder — compact, lives inside the existing
     wallet-identity panel rather than as its own large panel ---- */
  .offer-builder-bar{
    margin-top:1.1rem;
    padding-top:1.1rem;
    border-top:1px dashed var(--border-mid);
    text-align:center;
  }
  .ob-eyebrow{ font-size:11px; letter-spacing:0.2em; color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); text-transform:uppercase; margin-bottom:0.75rem; }
  .ob-pile{ display:flex; justify-content:center; align-items:center; }
  .ob-slot{
    position:relative;
    width:3.4em;
    height:3.4em;
    border-radius:var(--radius);
    overflow:hidden;
    flex-shrink:0;
    box-shadow:0 2px 8px rgba(0,0,0,0.5);
    transition:transform 0.15s ease, z-index 0s;
  }
  .ob-slot + .ob-slot{ margin-left:-1.1em; }
  .ob-pile:hover .ob-slot{ transform:translateX(0); }
  .ob-slot img{ width:100%; height:100%; object-fit:cover; display:block; }
  .ob-slot.filled{ border:2px solid var(--magenta); cursor:pointer; }
  .ob-slot.filled:hover{ transform:translateY(-0.25em); z-index:5; box-shadow:0 6px 14px rgba(0,0,0,0.6), 0 0 12px rgba(255,63,208,0.3); }
  .ob-slot.filled:hover .ob-slot-remove{ opacity:1; }
  .ob-slot-remove{
    position:absolute;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    background:rgba(8,9,11,0.72);
    color:var(--white);
    font-size:18px;
    opacity:0;
    transition:opacity 0.15s ease;
  }
  .ob-slot.empty{
    border:1px dashed var(--border-mid);
    background:rgba(255,255,255,0.02);
    display:flex;
    align-items:center;
    justify-content:center;
    color:var(--grey-dim);
    font-size:16px;
    cursor:pointer;
  }
  .ob-slot.empty:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  .ob-count{ margin-top:0.75rem; font-size:11px; letter-spacing:0.15em; color:var(--grey); text-transform:uppercase; }
  .ob-submit{ margin-top:0.9rem; }
  .ob-submit:disabled{ opacity:0.35; cursor:not-allowed; }
  .ob-submit:disabled:hover{ background:transparent; border-color:var(--cyan-dim); }
  .card-select-toggle.at-cap{ opacity:0.35; cursor:not-allowed; }

  /* ---- CREATE AN OFFER — persistent trade builder on DATABASE ---- */
  .trade-box{ text-align:center; padding:0.9rem 0; }
  .trade-box + .swap-review-divider{ margin:0; }

  /* ---- SWAP REVIEW — both sides, reusing the same pile look ---- */
  .swap-review-side{ max-width:420px; margin:1.1rem auto 0; text-align:center; }
  .swap-review-side .ob-pile{ margin-top:0.75rem; }
  .swap-review-divider{ text-align:center; font-size:20px; color:var(--magenta); text-shadow:0 0 8px var(--magenta-glow); margin:0.6rem 0; }
  .review-pile .ob-slot{ cursor:default; }
  .review-pile .ob-slot.filled:hover{ transform:none; box-shadow:0 2px 8px rgba(0,0,0,0.5); }
  .review-pile .ob-slot-remove{ display:none; }
  .swap-nonatomic-note{
    max-width:520px;
    margin:0 auto 1.25rem;
    padding:0.75em 1em;
    border:1px dashed var(--magenta-dim);
    background:var(--magenta-faint);
    color:var(--magenta);
    text-shadow:none;
    font-size:11px;
    line-height:1.6;
    text-transform:none;
  }

  /* ---- target summary / offer placeholder ---- */
  .target-summary-block{ max-width:480px; margin:0 auto; text-align:center; }
  .ts-label{ font-size:10px; letter-spacing:0.2em; color:var(--grey-dim); margin:1.1rem 0 0.4rem; text-transform:uppercase; }
  .ts-label:first-child{ margin-top:0; }
  .ts-value{ font-family:var(--font-body); font-size:13px; color:var(--white); line-height:1.7; }
  .ts-count{
    margin-top:1rem;
    font-size:12px;
    letter-spacing:0.15em;
    color:var(--magenta);
    text-shadow:0 0 6px var(--magenta-glow);
    text-transform:uppercase;
  }
  .placeholder-card{
    border:1px dashed var(--border-mid);
    border-radius:var(--radius);
    padding:1.75rem;
    text-align:center;
    max-width:440px;
    margin:1.5rem auto 0;
  }
  .placeholder-card .pc-title{ font-size:12px; letter-spacing:0.2em; color:var(--grey); margin-bottom:0.75rem; text-transform:uppercase; }
  .placeholder-card .pc-body{ font-family:var(--font-body); font-size:11.5px; letter-spacing:0.01em; color:var(--grey); line-height:1.7; text-transform:none; }

  .protocol-footer{
    text-align:center;
    font-family:var(--font-body);
    font-size:10px;
    letter-spacing:0.06em;
    color:var(--grey-disabled);
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

    <h1>Σκύλλα :: SWAP</h1>

    <div class="db-select-wrap">
      <button class="db-select-toggle" id="dbSelectToggle">// DATABASE :: <span class="db-active-name">P!GE0NS</span> ▼</button>
      <div class="db-select-menu" id="dbSelectMenu" style="display:none;">
        <div class="db-option db-option-active">P!GE0NS</div>
        <div class="db-option db-option-disabled">FUZZY <span class="db-soon">C0M!NG S00N</span></div>
        <div class="db-option db-option-disabled">PHN!X <span class="db-soon">C0M!NG S00N</span></div>
      </div>
    </div>

    <div class="top-tabs" id="topTabs">
      <button class="tab-btn" data-tab="database">DATABASE</button>
      <button class="tab-btn" data-tab="mypigeons">MY P!GE0NS</button>
      <button class="tab-btn" data-tab="topholders">T0P 10</button>
      <button class="tab-btn" data-tab="sales">SALES DATA</button>
      <button class="tab-btn" id="swapOffersTabBtn" data-tab="swapoffers">SWAP 0FFERS</button>
    </div>

    <div class="sw-panel" id="swapOffersPanelWrap" style="display:none;">
      <div class="panel-title">SWAP 0FFERS</div>
      <div class="swap-nonatomic-note">EACH R0W !S 0NE PEND!NG SWAP. B0TH S!DES MUST 0FFER, THEN B0TH S!DES MUST ACCEPT — N0TH!NG M0VES UNT!L B0TH ACCEPTS ARE D0NE.</div>
      <div id="swapOffersList"></div>
    </div>

    <div class="sw-panel" id="myPigeonsPanel" style="display:none;">
      <div class="panel-title" id="myPigeonsPanelTitle">MY P!GE0NS</div>
      <div id="myPigeonsConnect" style="display:none; text-align:center;">
        <button class="bar-btn" id="connectScyllaBtn">[ CONNECT Σκύλλα ]</button>
        <div class="index-line" id="connectStatus"></div>
      </div>
      <div class="collection-info" id="myWalletInfo" style="display:none;">
        <div class="ci-label">WALLET C0NNECTED</div>
        <div class="ci-value ci-value-big" id="myWalletAddr"></div>
        <div class="stat-value" id="myWalletCount" style="margin-top:0.5rem;"></div>
      </div>
      <div class="search-row" id="myPigeonsSortRow" style="display:none; justify-content:center;">
        <select class="sort-select" id="myPigeonsSortSelect">
          <option value="RARITY_ASC" selected>RAR!TY H!GH</option>
          <option value="RARITY_DESC">RAR!TY L0W</option>
          <option value="NAME_ASC">A → Z</option>
          <option value="NAME_DESC">Z → A</option>
        </select>
      </div>
      <div id="myPigeonsList"></div>
    </div>

    <div class="sw-panel" id="topHoldersPanelWrap" style="display:none;">
      <div class="panel-title">T0P 10 H0LDERS</div>
      <div id="topHoldersList"></div>
    </div>

    <div class="sw-panel" id="salesPanelWrap" style="display:none;">
      <div class="panel-title">SALES H!ST0RY</div>
      <div class="sales-scrollbox" id="salesScrollBox">
        <div id="salesArea"></div>
        <div class="scroll-sentinel" id="salesScrollSentinel"></div>
        <div class="load-more-note" id="salesLoadMoreNote" style="display:none;">L0AD!NG M0RE SALES...</div>
        <div class="end-of-collection-note" id="salesEndNote" style="display:none;">// END 0F SALES H!ST0RY</div>
      </div>
    </div>

    <!-- SCREEN 1: COLLECTION BROWSER (whole collection OR one owner's, per scope) -->
    <div id="screenBrowse" style="display:none;">
      <div class="sw-panel sw-panel-signal" id="collectionDetailsPanel">
        <div class="panel-title">P!GE0NS</div>
        <div class="collection-info">
          <div class="ci-label">!SSUER / ADDRESS</div>
          <div class="ci-addr-row">
            <span class="ci-value ci-value-big" id="ciIssuerAddr">rfQVVT7X5FynwK87EczgP2T8RQXmQcQSf</span>
            <button class="bar-btn ci-copy-btn" id="copyIssuerBtn">[ C0PY ADDRESS ]</button>
          </div>
        </div>

        <div class="stats-strip" id="statsStrip">
          <div class="stat-tile"><div class="stat-label">!TEMS</div><div class="stat-value" id="statItems">…</div></div>
          <div class="stat-tile"><div class="stat-label">H0LDERS</div><div class="stat-value" id="statHolders">…</div></div>
          <div class="stat-tile"><div class="stat-label">T0TAL V0LUME</div><div class="stat-value" id="statVolume">…</div></div>
          <div class="stat-tile"><div class="stat-label">L!STED</div><div class="stat-value" id="statListed">…</div></div>
          <button class="stat-tile stat-tile-link" id="statScyllaListedTile" title="SH0W 0NLY P!GE0NS L!STED THR0UGH SCYLLA"><div class="stat-label">Σ SCYLLA L!STED</div><div class="stat-value" id="statScyllaListedCount">…</div></button>
          <a class="stat-tile stat-tile-link" id="statFloorDeeptideTile" target="_blank" rel="noopener"><div class="stat-label">FL00R :: DEEPT!DE</div><div class="stat-value" id="statFloorDeeptide">…</div></a>
          <a class="stat-tile stat-tile-link" id="statFloorXrpCafeTile" target="_blank" rel="noopener"><div class="stat-label">FL00R :: XRP.CAFE</div><div class="stat-value" id="statFloorXrpCafe">…</div></a>
        </div>
      </div>

      <!-- Persistent trade builder, always visible on DATABASE — this is
           the single place that starts/continues a trade now (no more
           separate stage-screens). Clicking an empty OFFER slot browses
           your own wallet (below); clicking ADD on a card either fills
           OFFER (browsing your own wallet) or fills FOR/WANT (browsing
           anyone else's, or the full collection), which for the very
           first want pick also auto-identifies that pigeon's owner as the
           target wallet via the existing enterOwnerScope. Neither box
           touches the other's contents. -->
      <div class="sw-panel sw-panel-target" id="tradeBuilderPanel">
        <div class="panel-title">CREATE AN 0FFER</div>
        <div class="trade-box" id="offerBox">
          <div class="ob-eyebrow">Y0UR 0FFER</div>
          <div class="ob-pile" id="offerPile"></div>
          <div class="ob-count" id="offerCount">0 / 4 ASSETS SELECTED</div>
        </div>
        <div class="swap-review-divider">F0R</div>
        <div class="trade-box" id="wantBox">
          <div class="ob-eyebrow">THE!R 0FFER</div>
          <div class="ob-pile" id="wantPile"></div>
          <div class="ob-count" id="wantCount">0 / 4 ASSETS SELECTED</div>
        </div>
        <div style="text-align:center; margin-top:1rem;">
          <button class="action-btn" id="completeTradeBtn" disabled>[ C0MPLETE TRADE 0FFER ]</button>
        </div>
      </div>

      <div class="sw-panel sw-panel-target" id="nodeHeaderPanel" style="display:none;">
        <div class="node-eyebrow" id="nodeEyebrowText">// TARGET N0DE !DENT!F!ED</div>

        <div class="target-pigeon-card" id="targetPigeonCard" style="display:none;">
          <div class="tp-label">TARGET P!GE0N</div>
          <div class="tp-body">
            <div class="pigeon-img-box tp-img" id="targetPigeonImg">[ IMAGE ]</div>
            <div class="tp-info">
              <div class="tp-num" id="targetPigeonNum"></div>
              <div class="tp-owner-label">OWNER</div>
              <div class="tp-owner" id="targetPigeonOwner"></div>
            </div>
          </div>
        </div>

        <div class="wallet-box">
          <div class="wallet-box-title"><span id="walletBoxTitleMain">TARGET WALLET</span><br><span class="wallet-box-sub" id="walletBoxTitleSub">// H0LDER N0DE</span></div>
          <div class="wallet-box-addr" id="nodeAddr"></div>
          <div class="wallet-box-count" id="nodeCount"></div>
        </div>

        <div style="text-align:center;">
          <a class="back-link" href="#" id="backToFullCollectionLink" style="margin:0;">[ ← EX!T TARGET WALLET :: BACK T0 FULL C0LLECT!0N ]</a>
        </div>
      </div>

      <div class="sw-panel">
        <div class="panel-title" id="searchPanelTitle">P!GE0N DATABASE</div>
        <div class="search-row">
          <input class="search-input" id="searchInput" placeholder="SEARCH #..." inputmode="numeric">
          <button class="bar-btn" id="searchBtn">[ GO ]</button>
          <div class="traits-hover-wrap" id="sortDropWrap">
            <span class="trait-row-label" id="sortDropLabel">S0RT ▾</span>
            <div class="traits-flyout" id="sortFlyout" style="display:none;">
              <div class="traits-flyout-cats" id="sortFlyoutCats"></div>
              <div class="traits-flyout-vals" id="sortFlyoutVals"><div class="th-empty">H0VER A CATEG0RY</div></div>
            </div>
          </div>
          <div class="edition-toggle" id="editionSelect">
            <button type="button" class="edition-btn active" data-value="ALL">ALL (1-3015)</button>
            <button type="button" class="edition-btn" data-value="LOW">1ST ED!T!0N (1-1515)</button>
            <button type="button" class="edition-btn" data-value="HIGH">2ND ED!T!0N (1516-3015)</button>
          </div>
        </div>
        <div class="sort-stack-row">
          <div class="traits-hover-wrap" id="traitsHoverWrap">
            <span class="trait-row-label" id="traitsHoverLabel">ADD TRA!TS ▾</span>
            <div class="traits-flyout" id="traitsFlyout" style="display:none;">
              <div class="traits-flyout-cats" id="traitsFlyoutCats"></div>
              <div class="traits-flyout-vals" id="traitsFlyoutVals"><div class="th-empty">H0VER A CATEG0RY</div></div>
            </div>
          </div>
        </div>
        <div class="index-line" id="indexLine"></div>

        <div class="traits-block">
          <div id="traitRows"></div>
          <div class="traits-actions">
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
      <div class="card-listings detail-listings-row" id="detailListingsRow"></div>
      <div class="scylla-listing-block">
        <div class="tech-meta-title">$P!GE0NS L!ST!NGS</div>
        <div class="scylla-listing-row">
          <span class="scylla-coin-wrap">
            <img class="scylla-coin-icon" src="/api/ipfs-image?src=https%3A%2F%2Fipfs.io%2Fipfs%2FQmRbNvemLYjHuRZcpYRRSq5vqqozzjoy3aDR6eSzSoTFUs" alt="$P!GE0NS">
            <span class="scylla-listing-price" id="detailScyllaPrice">N0T L!STED</span>
          </span>
          <button class="listing-buy" id="detailScyllaBuyBtn" style="display:none;">[ BUY ]</button>
        </div>
      </div>
      <div class="detail-traits-title">TRA!TS</div>
      <div class="trait-grid" id="detailTraits"></div>
      <div class="detail-field"><span class="df-label">OWNER</span><span class="df-value" id="detailOwner"></span></div>
      <div class="detail-field" id="detailRarityRow" style="display:none;"><span class="df-label">RAR!TY</span><span class="df-value rarity" id="detailRarity"></span></div>
      <div class="detail-field" id="detailPriceRow" style="display:none;"><span class="df-label">PR!CE</span><span class="df-value price" id="detailPrice"></span></div>
      <div class="detail-field" id="detailHighSaleRow" style="display:none;"><span class="df-label">REC0RD SALE</span><span class="df-value price" id="detailHighSale"></span></div>
      <div class="detail-field" id="detailAvgSaleRow" style="display:none;"><span class="df-label">AVG SALE</span><span class="df-value price" id="detailAvgSale"></span></div>
      <div class="detail-history">
        <button class="th-toggle" id="detailHistoryToggle">[ SALES H!ST0RY ]</button>
      </div>
      <div class="view-elsewhere">
        <div class="tech-meta-title">V!EW ELSEWHERE</div>
        <div class="view-links">
          <a class="secondary-btn" id="viewDeeptideLink" target="_blank" rel="noopener">[ DEEPT!DE ]</a>
          <a class="secondary-btn" id="viewXrpCafeLink" target="_blank" rel="noopener">[ XRP.CAFE ]</a>
          <a class="secondary-btn" id="viewBithompLink" target="_blank" rel="noopener">[ B!TH0MP ]</a>
        </div>
      </div>
      <div class="detail-actions">
        <button class="secondary-btn" id="backToBrowseBtn">[ ← BACK ]</button>
        <button class="action-btn" id="detailSelectBtn">[ SELECT ]</button>
        <a class="action-btn" id="detailBuyBtn" style="display:none;" target="_blank" rel="noopener">[ BUY 0N DEEPT!DE ]</a>
      </div>
    </div>

    <!-- SCREEN 2b: SALES HISTORY — a full swap of the DETAIL box, not an
         inline expand, so the history list gets the whole panel to itself -->
    <div class="sw-panel" id="screenHistory" style="display:none;">
      <div class="detail-eyebrow">// SALES H!ST0RY</div>
      <div class="detail-num" id="historyNum"></div>
      <div class="th-list" id="detailHistoryList"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="backToDetailBtn">[ ← BACK ]</button>
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

    <!-- SCREEN: SWAP REVIEW — both sides of the bundle, side by side. Still
         no XRPL/settlement logic: CREATE SWAP OFFER only prints a test
         summary, nothing is signed or sent. -->
    <div class="sw-panel" id="screenSwapReview" style="display:none;">
      <div class="detail-eyebrow">SWAP REV!EW</div>
      <div class="swap-review-side">
        <div class="ob-eyebrow">Y0U 0FFER</div>
        <div class="ob-pile review-pile" id="reviewOfferPile"></div>
        <div class="ob-count" id="reviewOfferCount"></div>
      </div>
      <div class="swap-review-divider">⇅</div>
      <div class="swap-review-side">
        <div class="ob-eyebrow">Y0U WANT</div>
        <div class="ob-pile review-pile" id="reviewWantPile"></div>
        <div class="ob-count" id="reviewWantCount"></div>
      </div>
      <div class="index-line" id="reviewResult" style="display:none; margin-top:1.25rem;"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="reviewBackBtn">[ ← BACK ]</button>
        <button class="action-btn" id="reviewCreateBtn">[ CREATE SWAP 0FFER ]</button>
      </div>
    </div>

    <!-- SCREEN: SWAP OFFER CONFIRMATION — the exact NFTokenCreateOffer
         txjson for YOUR half of the trade, before Xaman ever opens. XRPL
         has no NFT-for-NFT offer, so this is a free (Amount "0") offer
         restricted to the target wallet via Destination — NOT an atomic
         swap. The target wallet still has to create + both sides still
         have to accept each other's offers separately; that warning stays
         visible through both this screen and the result screen. -->
    <div class="sw-panel" id="screenSwapOfferConfirm" style="display:none;">
      <div class="node-eyebrow">// SWAP 0FFER C0NF!RMAT!0N</div>
      <div class="index-line swap-nonatomic-note">⚠ N0N-AT0M!C :: TH!S 0NLY SENDS Y0UR P!GE0N'S 0FFER. THE 0THER WALLET MUST SEPARATELY 0FFER THE!RS, THEN B0TH S!DES ACCEPT.</div>
      <div class="detail-field"><span class="df-label">TransactionType</span><span class="df-value" id="swapConfTxType"></span></div>
      <div class="detail-field"><span class="df-label">Account</span><span class="df-value" id="swapConfAccount"></span></div>
      <div class="detail-field"><span class="df-label">NFTokenID</span><span class="df-value" id="swapConfNftId"></span></div>
      <div class="detail-field"><span class="df-label">Amount</span><span class="df-value" id="swapConfAmount"></span></div>
      <div class="detail-field"><span class="df-label">Destination</span><span class="df-value" id="swapConfDestination"></span></div>
      <div class="detail-field"><span class="df-label">Flags</span><span class="df-value" id="swapConfFlags"></span></div>
      <div class="index-line" id="swapConfirmStatus" style="margin-top:1rem;"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="swapOfferConfirmBackBtn">[ ← BACK ]</button>
        <button class="action-btn" id="swapOfferOpenXamanBtn">[ 0PEN XAMAN ]</button>
      </div>
    </div>

    <!-- SCREEN: SWAP OFFER RESULT — verified against real on-ledger state
         (nft_sell_offers), not just Xaman's word. -->
    <div class="sw-panel" id="screenSwapOfferResult" style="display:none;">
      <div class="detail-eyebrow">// 0FFER SENT</div>
      <div class="index-line swap-nonatomic-note">TH!S !S 0NLY Y0UR HALF 0F THE TRADE. THE 0THER WALLET ST!LL NEEDS T0 CREATE THE!R 0WN 0FFER F0R THE!R P!GE0N, THEN B0TH S!DES ACCEPT EACH 0THER'S 0FFERS.</div>
      <div class="detail-field"><span class="df-label">P!GE0N 0FFERED</span><span class="df-value" id="swapResultNftId"></span></div>
      <div class="detail-field"><span class="df-label">T0 WALLET</span><span class="df-value" id="swapResultToWallet"></span></div>
      <div class="detail-field"><span class="df-label">STATUS</span><span class="df-value" id="swapResultStatus"></span></div>
      <div class="detail-field"><span class="df-label">0FFER !D</span><span class="df-value" id="swapResultOfferId"></span></div>
      <div class="detail-field"><span class="df-label">TRANSACT!0N</span><span class="df-value"><a id="swapResultTxLink" target="_blank" rel="noopener"></a></span></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="swapResultDoneBtn">[ ← BACK T0 DATABASE ]</button>
      </div>
    </div>

    <!-- SCREEN: ACCEPT SWAP CONFIRMATION — the exact NFTokenAcceptOffer
         txjson for accepting the OTHER side's offer, before Xaman ever
         opens. Accepting this really transfers their Pigeon to you and
         yours to them completes only once BOTH sides have each accepted
         the other's offer. -->
    <div class="sw-panel" id="screenSwapAcceptConfirm" style="display:none;">
      <div class="node-eyebrow">// ACCEPT SWAP C0NF!RMAT!0N</div>
      <div class="index-line swap-nonatomic-note">TH!S ACCEPTS THE!R 0FFER T0 Y0U. Y0UR 0WN P!GE0N 0NLY M0VES !F THEY (0R Y0U ALREADY D!D) SEPARATELY ACCEPT Y0UR 0FFER T00.</div>
      <div class="detail-field"><span class="df-label">TransactionType</span><span class="df-value" id="acceptConfTxType"></span></div>
      <div class="detail-field"><span class="df-label">Account</span><span class="df-value" id="acceptConfAccount"></span></div>
      <div class="detail-field"><span class="df-label">NFTokenSellOffer</span><span class="df-value" id="acceptConfOfferId"></span></div>
      <div class="detail-field"><span class="df-label">P!GE0N</span><span class="df-value" id="acceptConfNftId"></span></div>
      <div class="detail-field"><span class="df-label">FR0M WALLET</span><span class="df-value" id="acceptConfFromWallet"></span></div>
      <div class="index-line" id="acceptConfirmStatus" style="margin-top:1rem;"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="swapAcceptConfirmBackBtn">[ ← BACK ]</button>
        <button class="action-btn" id="swapAcceptOpenXamanBtn">[ 0PEN XAMAN ]</button>
      </div>
    </div>

    <!-- SCREEN: ACCEPT SWAP RESULT — verified against real on-ledger state
         (the Pigeon now in your account_nfts, the offer gone). -->
    <div class="sw-panel" id="screenSwapAcceptResult" style="display:none;">
      <div class="detail-eyebrow">// ACCEPTED</div>
      <div class="detail-field"><span class="df-label">P!GE0N RECE!VED</span><span class="df-value" id="acceptResultNftId"></span></div>
      <div class="detail-field"><span class="df-label">STATUS</span><span class="df-value" id="acceptResultStatus"></span></div>
      <div class="detail-field"><span class="df-label">TRANSACT!0N</span><span class="df-value"><a id="acceptResultTxLink" target="_blank" rel="noopener"></a></span></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="acceptResultDoneBtn">[ ← BACK T0 SWAP 0FFERS ]</button>
      </div>
    </div>

    <!-- SCREEN: LIST A PIGEON — first real listing test -->
    <div class="sw-panel" id="screenListForm" style="display:none;">
      <div class="detail-eyebrow">// SCYLLA L!ST!NG</div>
      <div class="detail-num" id="listFormPigeonNum"></div>
      <div class="detail-img-large pigeon-img-box" id="listFormImg">[ IMAGE ]</div>
      <div class="detail-field"><span class="df-label">PR!CE</span><span class="df-value"><input class="search-input" id="listPriceInput" placeholder="0" inputmode="decimal" style="text-align:right; width:140px;"></span></div>
      <div class="detail-field"><span class="df-label">CURRENCY</span><span class="df-value">$P!GE0NS</span></div>
      <div class="index-line" id="listFormError" style="display:none;"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="listFormBackBtn">[ ← BACK ]</button>
        <button class="action-btn" id="listFormSubmitBtn">[ CREATE L!ST!NG ]</button>
      </div>
    </div>

    <!-- SCREEN: LISTING CONFIRMATION — the exact txjson, before Xaman ever opens -->
    <div class="sw-panel" id="screenListConfirm" style="display:none;">
      <div class="node-eyebrow">// L!ST!NG C0NF!RMAT!0N</div>
      <div class="detail-field"><span class="df-label">TransactionType</span><span class="df-value" id="confTxType"></span></div>
      <div class="detail-field"><span class="df-label">Account</span><span class="df-value" id="confAccount"></span></div>
      <div class="detail-field"><span class="df-label">NFTokenID</span><span class="df-value" id="confNftId"></span></div>
      <div class="detail-field"><span class="df-label">Amount.currency</span><span class="df-value" id="confCurrency"></span></div>
      <div class="detail-field"><span class="df-label">Amount.issuer</span><span class="df-value" id="confIssuer"></span></div>
      <div class="detail-field"><span class="df-label">Amount.value</span><span class="df-value" id="confValue"></span></div>
      <div class="detail-field"><span class="df-label">Flags</span><span class="df-value" id="confFlags"></span></div>
      <div class="index-line" id="confirmStatus" style="margin-top:1rem;"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="listConfirmBackBtn">[ ← BACK ]</button>
        <button class="action-btn" id="openXamanBtn">[ 0PEN XAMAN ]</button>
      </div>
    </div>

    <!-- SCREEN: LISTING RESULT — verified against real on-ledger state, not a stored flag -->
    <div class="sw-panel" id="screenListResult" style="display:none;">
      <div class="detail-eyebrow" id="listResultEyebrow">// L!ST!NG CREATED</div>
      <div class="detail-num" id="listResultPigeonNum"></div>
      <div class="detail-field"><span class="df-label">PR!CE</span><span class="df-value" id="listResultPrice"></span></div>
      <div class="detail-field"><span class="df-label">STATUS</span><span class="df-value" id="listResultStatus"></span></div>
      <div class="detail-field"><span class="df-label">NFT 0FFER !D</span><span class="df-value" id="listResultOfferId"></span></div>
      <div class="detail-field"><span class="df-label">TRANSACT!0N</span><span class="df-value"><a id="listResultTxLink" target="_blank" rel="noopener"></a></span></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="listResultDoneBtn">[ ← BACK T0 MY P!GE0NS ]</button>
      </div>
    </div>

    <!-- SCREEN: BUY CONFIRMATION — the exact NFTokenAcceptOffer txjson, before Xaman ever opens -->
    <div class="sw-panel" id="screenBuyConfirm" style="display:none;">
      <div class="node-eyebrow">// BUY C0NF!RMAT!0N</div>
      <div class="detail-field"><span class="df-label">TransactionType</span><span class="df-value" id="buyConfTxType"></span></div>
      <div class="detail-field"><span class="df-label">Account</span><span class="df-value" id="buyConfAccount"></span></div>
      <div class="detail-field"><span class="df-label">NFTokenSellOffer</span><span class="df-value" id="buyConfOfferId"></span></div>
      <div class="detail-field"><span class="df-label">P!GE0N</span><span class="df-value" id="buyConfPigeon"></span></div>
      <div class="detail-field"><span class="df-label">SELLER</span><span class="df-value" id="buyConfSeller"></span></div>
      <div class="detail-field"><span class="df-label">PR!CE</span><span class="df-value" id="buyConfPrice"></span></div>
      <div class="index-line" id="buyConfirmStatus" style="margin-top:1rem;"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="buyConfirmBackBtn">[ ← BACK ]</button>
        <button class="action-btn" id="buyOpenXamanBtn">[ 0PEN XAMAN ]</button>
      </div>
    </div>

    <!-- SCREEN: BUY RESULT — verified against real on-ledger state (buyer's account_nfts + offer gone) -->
    <div class="sw-panel" id="screenBuyResult" style="display:none;">
      <div class="detail-eyebrow">// SETTLED</div>
      <div class="detail-num" id="buyResultPigeonNum"></div>
      <div class="detail-field"><span class="df-label">PR!CE</span><span class="df-value" id="buyResultPrice"></span></div>
      <div class="detail-field"><span class="df-label">STATUS</span><span class="df-value" id="buyResultStatus"></span></div>
      <div class="detail-field"><span class="df-label">TRANSACT!0N</span><span class="df-value"><a id="buyResultTxLink" target="_blank" rel="noopener"></a></span></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="buyResultDoneBtn">[ ← BACK T0 L!STED ]</button>
      </div>
    </div>

    <!-- SCREEN: DELIST CONFIRMATION — the exact NFTokenCancelOffer txjson, before Xaman ever opens -->
    <div class="sw-panel" id="screenDelistConfirm" style="display:none;">
      <div class="node-eyebrow">// DEL!ST C0NF!RMAT!0N</div>
      <div class="detail-field"><span class="df-label">TransactionType</span><span class="df-value" id="delistConfTxType"></span></div>
      <div class="detail-field"><span class="df-label">Account</span><span class="df-value" id="delistConfAccount"></span></div>
      <div class="detail-field"><span class="df-label">NFTokenOffers</span><span class="df-value" id="delistConfOfferId"></span></div>
      <div class="detail-field"><span class="df-label">P!GE0N</span><span class="df-value" id="delistConfPigeon"></span></div>
      <div class="index-line" id="delistConfirmStatus" style="margin-top:1rem;"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="delistConfirmBackBtn">[ ← BACK ]</button>
        <button class="action-btn" id="delistOpenXamanBtn">[ 0PEN XAMAN ]</button>
      </div>
    </div>

    <!-- SCREEN: DELIST RESULT — verified against real on-ledger state (offer gone) -->
    <div class="sw-panel" id="screenDelistResult" style="display:none;">
      <div class="detail-eyebrow">// DEL!STED</div>
      <div class="detail-num" id="delistResultPigeonNum"></div>
      <div class="detail-field"><span class="df-label">STATUS</span><span class="df-value" id="delistResultStatus"></span></div>
      <div class="detail-field"><span class="df-label">TRANSACT!0N</span><span class="df-value"><a id="delistResultTxLink" target="_blank" rel="noopener"></a></span></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="delistResultDoneBtn">[ ← BACK T0 MY P!GE0NS ]</button>
      </div>
    </div>

    <div class="protocol-footer">Σκύλλα SWAP :: L!ST!NG, BUY!NG, AND DEL!ST!NG ARE REAL XRPL TRANSACT!0NS. N0 MARKETPLACE FEE, NEG0T!AT!0N, 0R MULT!-!TEM 0FFERS YET.</div>
  </div>

  <div class="target-bar" id="targetBar" style="display:none;">
    <span class="tb-label" id="targetBarLabel">TARGET ASSETS :: 0</span>
    <span class="tb-toggle">[ V!EW ▲ ]</span>
  </div>

<script src="https://xumm.app/assets/cdn/xumm-oauth2-pkce.min.js"></script>
<script>
(function(){

  // Same public OAuth-login key every other page already hardcodes
  // (board.js, scylla.js, kingdom.js, mainframe.js, glitch.js) — the
  // client-facing half of the Xaman app, safe to be public.
  var XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

  // Wallet of whoever is currently signed in via the shared pigeon_session
  // cookie (set by /board's connect flow, or by the CONNECT SCYLLA button
  // below reusing the exact same login) — read server-side, null if no
  // signature is on file.
  var MY_WALLET = "__SWAP_WALLET__";

  // BETA — the NFT-for-NFT swap builder (CREATE AN OFFER box, MY PIGEONS'
  // + toggle, SWAP OFFERS tab) is fully built and working, just hidden for
  // now. Nothing behind it was removed or changed — flip this back to
  // true to bring it all back exactly as it was. This is the ONLY switch;
  // every entry point below checks it.
  var SWAP_BUILDER_ENABLED = false;

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
    activeTab: null,           // null | 'database' | 'mypigeons' | 'topholders' | 'sales'
    databaseLoaded: false,
    salesLoaded: false,
    traitFilters: [],         // [{ id, category, value }]
    nextTraitRowId: 1,
    traitCategories: null,     // [name, name, ...] — cheap, loaded once
    traitValuesCache: {},      // category -> [{value, count, percent}], fetched lazily per category
    collectionSizeApprox: 3015,
    currentDetail: null,
    targetAssets: {},         // nftId -> { nftId, number, image } — only while scope is a wallet
    sales: { skip: 0, hasMore: true, loading: false, opened: false },
    scyllaListedOnly: false,  // whole-collection LISTED filter — Pigeons listed through Scylla itself
    offerAssets: {}           // nftId -> { nftId, number, image } — up to 4, YOUR pigeons in the persistent trade builder
  };

  var el = {};
  ['searchInput','searchBtn','editionSelect','sortDropWrap','sortDropLabel','sortFlyout','sortFlyoutCats','sortFlyoutVals',
   'dbSelectToggle','dbSelectMenu','copyIssuerBtn','ciIssuerAddr',
   'topTabs','myPigeonsPanel','myPigeonsPanelTitle','myPigeonsList',
   'topHoldersPanelWrap','topHoldersList',
   'salesPanelWrap',
   'swapOffersPanelWrap','swapOffersList',
   'statItems','statHolders','statVolume','statListed','statFloorDeeptide','statFloorXrpCafe','statFloorDeeptideTile','statFloorXrpCafeTile',
   'statScyllaListedTile','statScyllaListedCount',
   'indexLine','traitRows','clearTraitsBtn',
   'traitsHoverWrap','traitsHoverLabel','traitsFlyout','traitsFlyoutCats','traitsFlyoutVals',
   'statusLine','resultsArea','scrollSentinel','loadMoreNote','endOfCollectionNote',
   'salesScrollBox','salesArea','salesScrollSentinel','salesLoadMoreNote','salesEndNote',
   'nodeHeaderPanel','nodeAddr','nodeCount','backToFullCollectionLink','searchPanelTitle',
   'nodeEyebrowText','walletBoxTitleMain','walletBoxTitleSub',
   'targetPigeonCard','targetPigeonImg','targetPigeonNum','targetPigeonOwner',
   'tradeBuilderPanel','offerPile','offerCount','wantPile','wantCount','completeTradeBtn','swapOffersTabBtn',
   'screenSwapReview','reviewOfferPile','reviewOfferCount','reviewWantPile','reviewWantCount','reviewBackBtn','reviewCreateBtn','reviewResult',
   'screenSwapOfferConfirm','swapConfTxType','swapConfAccount','swapConfNftId','swapConfAmount','swapConfDestination','swapConfFlags','swapConfirmStatus','swapOfferConfirmBackBtn','swapOfferOpenXamanBtn',
   'screenSwapOfferResult','swapResultNftId','swapResultToWallet','swapResultStatus','swapResultOfferId','swapResultTxLink','swapResultDoneBtn',
   'screenSwapAcceptConfirm','acceptConfTxType','acceptConfAccount','acceptConfOfferId','acceptConfFromWallet','acceptConfNftId','acceptConfirmStatus','swapAcceptConfirmBackBtn','swapAcceptOpenXamanBtn',
   'screenSwapAcceptResult','acceptResultNftId','acceptResultStatus','acceptResultTxLink','acceptResultDoneBtn',
   'screenBrowse','screenDetail','screenSummary','screenHistory',
   'detailNum','detailImgBox','detailOwner','detailRarityRow','detailRarity','detailPriceRow','detailPrice','detailHighSaleRow','detailHighSale','detailAvgSaleRow','detailAvgSale','detailBuyBtn','detailTraits',
   'detailScyllaPrice','detailScyllaBuyBtn','detailListingsRow',
   'detailHistoryToggle','detailHistoryList','historyNum','backToDetailBtn','viewDeeptideLink','viewXrpCafeLink','viewBithompLink',
   'backToBrowseBtn','detailSelectBtn',
   'summaryOwner','summaryList','summaryCount','offerPlaceholder','backFromSummaryBtn','continueToOfferBtn',
   'targetBar','targetBarLabel',
   'myPigeonsConnect','connectScyllaBtn','connectStatus','myWalletInfo','myWalletAddr','myWalletCount',
   'myPigeonsSortRow','myPigeonsSortSelect',
   'screenListForm','listFormPigeonNum','listFormImg','listPriceInput','listFormError','listFormBackBtn','listFormSubmitBtn',
   'screenListConfirm','confTxType','confAccount','confNftId','confCurrency','confIssuer','confValue','confFlags','confirmStatus','listConfirmBackBtn','openXamanBtn',
   'screenListResult','listResultEyebrow','listResultPigeonNum','listResultPrice','listResultStatus','listResultOfferId','listResultTxLink','listResultDoneBtn',
   'screenBuyConfirm','buyConfTxType','buyConfAccount','buyConfOfferId','buyConfPigeon','buyConfSeller','buyConfPrice','buyConfirmStatus','buyConfirmBackBtn','buyOpenXamanBtn',
   'screenBuyResult','buyResultPigeonNum','buyResultPrice','buyResultStatus','buyResultTxLink','buyResultDoneBtn',
   'screenDelistConfirm','delistConfTxType','delistConfAccount','delistConfOfferId','delistConfPigeon','delistConfirmStatus','delistConfirmBackBtn','delistOpenXamanBtn',
   'screenDelistResult','delistResultPigeonNum','delistResultStatus','delistResultTxLink','delistResultDoneBtn'
  ].forEach(function(id){ el[id] = document.getElementById(id); });

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  // ---- Top tab bar (DATABASE / MY PIGEONS / TOP 10 / SALES DATA) ----
  // A peer navigation axis to the detail/summary screens below: only one
  // of the four tab panels is ever visible, and only while on the browse
  // screen (INSPECT/target-summary hide all four regardless of tab).
  function showTab(tab){
    state.activeTab = tab;
    el.screenBrowse.style.display = tab === 'database' ? '' : 'none';
    el.myPigeonsPanel.style.display = tab === 'mypigeons' ? '' : 'none';
    el.topHoldersPanelWrap.style.display = tab === 'topholders' ? '' : 'none';
    el.salesPanelWrap.style.display = tab === 'sales' ? '' : 'none';
    el.swapOffersPanelWrap.style.display = tab === 'swapoffers' ? '' : 'none';
    var buttons = el.topTabs.querySelectorAll('.tab-btn');
    for (var i = 0; i < buttons.length; i++){
      buttons[i].classList.toggle('active', buttons[i].getAttribute('data-tab') === tab);
    }
    // Nothing fetches until its tab is actually opened for the first time.
    // Default landing view is the full collection, rarity-high first
    // (state.sort's own default) — not the Σ SCYLLA LISTED filter.
    if (tab === 'database' && !state.databaseLoaded){
      state.databaseLoaded = true;
      ensureTraitsLoaded();
      loadCollectionStats();
      runQuery();
    } else if (tab === 'mypigeons' && myPigeonsData === null){
      loadMyPigeons();
    } else if (tab === 'topholders' && topHoldersData === null){
      loadTopHolders();
    } else if (tab === 'sales' && !state.salesLoaded){
      state.salesLoaded = true;
      loadMoreSales();
    } else if (tab === 'swapoffers'){
      // Always refetches (no "loaded once" guard like the others) — this
      // list changes as soon as the other side of a pending swap acts, so
      // a stale cached view would hide real progress.
      loadSwapOffersMine();
    }
  }
  el.topTabs.addEventListener('click', function(e){
    var btn = e.target.closest('.tab-btn');
    if (!btn) return;
    showTab(btn.getAttribute('data-tab'));
  });

  function showScreen(name){
    if (name === 'browse'){
      showTab(state.activeTab);
    } else {
      el.screenBrowse.style.display = 'none';
      el.myPigeonsPanel.style.display = 'none';
      el.topHoldersPanelWrap.style.display = 'none';
      el.salesPanelWrap.style.display = 'none';
      el.swapOffersPanelWrap.style.display = 'none';
    }
    el.screenDetail.style.display = name === 'detail' ? '' : 'none';
    el.screenHistory.style.display = name === 'history' ? '' : 'none';
    el.screenSummary.style.display = name === 'summary' ? '' : 'none';
    el.screenSwapReview.style.display = name === 'swapreview' ? '' : 'none';
    el.screenSwapOfferConfirm.style.display = name === 'swapofferconfirm' ? '' : 'none';
    el.screenSwapOfferResult.style.display = name === 'swapofferresult' ? '' : 'none';
    el.screenSwapAcceptConfirm.style.display = name === 'swapacceptconfirm' ? '' : 'none';
    el.screenSwapAcceptResult.style.display = name === 'swapacceptresult' ? '' : 'none';
    el.screenListForm.style.display = name === 'listform' ? '' : 'none';
    el.screenListConfirm.style.display = name === 'listconfirm' ? '' : 'none';
    el.screenListResult.style.display = name === 'listresult' ? '' : 'none';
    el.screenBuyConfirm.style.display = name === 'buyconfirm' ? '' : 'none';
    el.screenBuyResult.style.display = name === 'buyresult' ? '' : 'none';
    el.screenDelistConfirm.style.display = name === 'delistconfirm' ? '' : 'none';
    el.screenDelistResult.style.display = name === 'delistresult' ? '' : 'none';
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function api(params){
    var qs = Object.keys(params)
      .filter(function(k){ return params[k] !== undefined && params[k] !== null; })
      .map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    return fetch('/api/pigeons?' + qs).then(function(r){ return r.json(); });
  }

  // ---- CREATE AN OFFER — persistent trade builder, always visible on
  // DATABASE. Two independent piles: offerAssets (yours) and targetAssets
  // (theirs — the SAME bucket the pre-existing target-select machinery
  // already wrote to; enterOwnerScope/browseOwnerCollection are reused
  // completely unchanged for identifying + browsing the target wallet).
  // Which pile a card's + button fills is derived purely from what wallet
  // is currently in scope, not from a separate mode flag: your own wallet
  // fills OFFER, anything else fills WANT/FOR. Neither pile is ever
  // touched just by browsing — only by explicitly adding/removing a
  // Pigeon — so switching between boxes never loses progress. ----
  var OFFER_MAX = 4;
  function offerCount(){ return Object.keys(state.offerAssets).length; }
  function targetCount(){ return Object.keys(state.targetAssets).length; }
  function isOwnWalletScope(){ return !!(state.scope && MY_WALLET && state.scope.wallet === MY_WALLET); }

  function toggleOfferAsset(p){
    if (state.offerAssets[p.nftId]){
      delete state.offerAssets[p.nftId];
    } else {
      if (offerCount() >= OFFER_MAX) return;
      state.offerAssets[p.nftId] = { nftId: p.nftId, number: p.number, image: p.image };
    }
    renderTradeBuilder();
    refreshCardSelectionStates();
    // MY PIGEONS renders its own toggle state from scratch each time
    // (cheap — a wallet's own collection, not the full 3015-item
    // database) rather than patching it into refreshCardSelectionStates,
    // which only knows about .card-select-toggle. No-ops harmlessly if
    // MY PIGEONS was never opened (myPigeonsData still null).
    if (myPigeonsData !== null) renderMyPigeonsList();
  }
  function toggleTargetAsset(p){
    if (state.targetAssets[p.nftId]){
      delete state.targetAssets[p.nftId];
    } else {
      if (targetCount() >= OFFER_MAX) return;
      state.targetAssets[p.nftId] = { nftId: p.nftId, number: p.number, image: p.image };
    }
    renderTradeBuilder();
    refreshCardSelectionStates();
  }

  function pileSlotsHtml(items, removeTitle){
    var html = items.map(function(p){
      var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="">' : '';
      return '<div class="ob-slot filled" data-nftid="' + escapeHtml(p.nftId) + '" title="' + removeTitle + '">' + img + '<span class="ob-slot-remove">×</span></div>';
    }).join('');
    for (var i = items.length; i < OFFER_MAX; i++){
      html += '<div class="ob-slot empty" title="ADD A P!GE0N">+</div>';
    }
    return html;
  }
  function updateScopeLabels(){
    if (!state.scope) return;
    if (isOwnWalletScope()){
      el.nodeEyebrowText.textContent = '// Y0UR WALLET !DENT!F!ED';
      el.walletBoxTitleMain.textContent = 'Y0UR WALLET';
      el.walletBoxTitleSub.textContent = '// BU!LD!NG Y0UR 0FFER';
      el.backToFullCollectionLink.textContent = '[ ← BACK T0 FULL C0LLECT!0N ]';
    } else {
      el.nodeEyebrowText.textContent = '// TARGET N0DE !DENT!F!ED';
      el.walletBoxTitleMain.textContent = 'TARGET WALLET';
      el.walletBoxTitleSub.textContent = '// H0LDER N0DE';
      el.backToFullCollectionLink.textContent = '[ ← EX!T TARGET WALLET :: BACK T0 FULL C0LLECT!0N ]';
    }
  }
  function renderTradeBuilder(){
    var offerItems = Object.keys(state.offerAssets).map(function(k){ return state.offerAssets[k]; });
    var wantItems = Object.keys(state.targetAssets).map(function(k){ return state.targetAssets[k]; });
    el.offerPile.innerHTML = pileSlotsHtml(offerItems, 'REM0VE FR0M 0FFER');
    el.offerCount.textContent = offerItems.length + ' / ' + OFFER_MAX + ' ASSETS SELECTED';
    el.wantPile.innerHTML = pileSlotsHtml(wantItems, 'REM0VE FR0M 0FFER');
    el.wantCount.textContent = wantItems.length + ' / ' + OFFER_MAX + ' ASSETS SELECTED';
    el.completeTradeBtn.disabled = offerItems.length === 0 || wantItems.length === 0;
    updateScopeLabels();
  }

  el.offerPile.addEventListener('click', function(e){
    var slot = e.target.closest('.ob-slot');
    if (!slot) return;
    if (slot.classList.contains('filled')){
      var nftId = slot.getAttribute('data-nftid');
      delete state.offerAssets[nftId];
      renderTradeBuilder();
      refreshCardSelectionStates();
      return;
    }
    // Empty OFFER slot — browse your own wallet to fill it. If a target
    // wallet is already being browsed for WANT, save/restore its picks
    // around the scope change, since browseOwnerCollection always starts
    // a fresh targetAssets for whatever wallet it's pointed at (correct
    // for its normal job — entering a brand new wallet — but not what we
    // want here, where OFFER and WANT are meant to stay independent).
    if (!MY_WALLET){
      alert('C0NNECT Σκύλλα F!RST (SEE MY P!GE0NS) T0 ADD Y0UR P!GE0NS.');
      return;
    }
    if (!isOwnWalletScope()){
      var keepWant = state.targetAssets;
      browseOwnerCollection(MY_WALLET, 'Y0U');
      state.targetAssets = keepWant;
    }
    renderTradeBuilder();
    showScreen('browse');
  });

  el.wantPile.addEventListener('click', function(e){
    var slot = e.target.closest('.ob-slot');
    if (!slot) return;
    if (slot.classList.contains('filled')){
      var nftId = slot.getAttribute('data-nftid');
      delete state.targetAssets[nftId];
      renderTradeBuilder();
      refreshCardSelectionStates();
      return;
    }
    // Empty WANT/FOR slot — picking itself happens via ADD on a Pigeon
    // card below (see handleSelect), not here. An offer has to exist
    // first, since there's nothing to trade for otherwise.
    if (offerCount() === 0){
      alert('PLEASE SELECT A P!GE0N T0 0FFER F0R.');
      return;
    }
    if (isOwnWalletScope()){
      // Currently browsing your own wallet — step back to the full
      // collection so a target Pigeon (and its owner) can be picked,
      // without clearing either pile.
      state.scope = null;
      state.scopeAllItems = [];
      state.traitFilters = [];
      renderTraitRows();
      el.nodeHeaderPanel.style.display = 'none';
      el.searchPanelTitle.textContent = 'P!GE0N DATABASE';
      el.searchInput.value = '';
      startCollectionBrowse();
    }
    el.resultsArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function showSwapReview(){
    var offerItems = Object.keys(state.offerAssets).map(function(k){ return state.offerAssets[k]; });
    var wantItems = Object.keys(state.targetAssets).map(function(k){ return state.targetAssets[k]; });
    el.reviewOfferPile.innerHTML = pileSlotsHtml(offerItems, '');
    el.reviewOfferCount.textContent = offerItems.length + ' / ' + OFFER_MAX + ' ASSETS';
    el.reviewWantPile.innerHTML = pileSlotsHtml(wantItems, '');
    el.reviewWantCount.textContent = wantItems.length + ' / ' + OFFER_MAX + ' ASSETS';
    el.reviewResult.style.display = 'none';
    el.reviewResult.innerHTML = '';
    showScreen('swapreview');
  }
  el.completeTradeBtn.addEventListener('click', function(){
    if (offerCount() === 0 || targetCount() === 0) return;
    showSwapReview();
  });
  el.reviewBackBtn.addEventListener('click', function(){ showScreen('browse'); });

  // ---- Real settlement, 1-for-1 only for now (first live test) — builds
  // and sends ONLY the offerer's own NFTokenCreateOffer, the "send the
  // offer" half. Reuses the exact same Xaman signing infra (prepare ->
  // confirm -> payload -> poll status) as LIST/BUY/DELIST, just against
  // new swap-offer-* endpoints; nothing about those existing flows is
  // touched. Structured to expand to 2-4 per side later (swapOfferState
  // and the poll/confirm functions don't assume 1 item, only this button's
  // guard does). ----
  var swapOfferState = null; // { nftId, toWallet, uuid, wantNftId | swapId }
  var swapOfferPollTimer = null;

  // Shared by both entry points: the original offerer (from SWAP REVIEW,
  // wantNftId starting a brand-new pair) and the counterparty reciprocating
  // an existing pair from the SWAP OFFERS tab (swapId attaching onto it).
  function startSwapOffer(nftId, toWallet, extra){
    swapOfferState = Object.assign({ nftId: nftId, toWallet: toWallet, uuid: null }, extra);
    el.swapConfirmStatus.textContent = 'VAL!DAT!NG...';
    el.swapOfferOpenXamanBtn.disabled = true;
    showScreen('swapofferconfirm');
    fetch('/api/swap-offer-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: nftId, toWallet: toWallet })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        el.swapConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        el.swapOfferOpenXamanBtn.disabled = true;
        return;
      }
      showSwapOfferConfirm(res.data.txjson);
    }).catch(function(){
      el.swapConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
      el.swapOfferOpenXamanBtn.disabled = true;
    });
  }

  el.reviewCreateBtn.addEventListener('click', function(){
    var offerIds = Object.keys(state.offerAssets);
    var wantIds = Object.keys(state.targetAssets);
    if (offerIds.length !== 1 || wantIds.length !== 1){
      alert('F0R N0W, REAL SWAPS ARE L!M!TED T0 1 P!GE0N EACH S!DE F0R TEST!NG — REM0VE EXTRA P!GE0NS T0 C0NT!NUE. (2-4 PER S!DE C0MES NEXT, 0NCE 1-F0R-1 !S C0NF!RMED W0RK!NG.)');
      return;
    }
    if (!state.scope || !state.scope.wallet){
      alert('N0 TARGET WALLET !DENT!F!ED — G0 BACK AND P!CK A WANT P!GE0N AGA!N.');
      return;
    }
    startSwapOffer(offerIds[0], state.scope.wallet, { wantNftId: wantIds[0] });
  });

  function showSwapOfferConfirm(txjson){
    el.swapConfTxType.textContent = txjson.TransactionType;
    el.swapConfAccount.textContent = txjson.Account;
    el.swapConfNftId.textContent = txjson.NFTokenID;
    el.swapConfAmount.textContent = txjson.Amount + ' DR0PS (:: 0 XRP — FREE TRANSFER 0FFER)';
    el.swapConfDestination.textContent = txjson.Destination;
    el.swapConfFlags.textContent = String(txjson.Flags);
    el.swapConfirmStatus.textContent = '';
    el.swapOfferOpenXamanBtn.disabled = false;
    el.swapOfferOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
  }
  el.swapOfferConfirmBackBtn.addEventListener('click', function(){
    showScreen(swapOfferState && swapOfferState.swapId ? 'swapoffers' : 'swapreview');
  });

  el.swapOfferOpenXamanBtn.addEventListener('click', function(){
    if (!swapOfferState) return;
    el.swapOfferOpenXamanBtn.disabled = true;
    el.swapOfferOpenXamanBtn.textContent = '[ REQUEST!NG... ]';
    el.swapConfirmStatus.textContent = '';
    // Opening the tab HERE, synchronously inside the click handler, and
    // only pointing it at the real URL once the fetch resolves — opening
    // it inside the .then() callback instead (as the async response
    // arrives) is exactly what browsers treat as an untrusted popup and
    // silently block, since it's no longer directly tied to the click.
    // Confirmed live: swapOfferState.uuid was set (payload really was
    // created), but nothing ever opened. 'noopener' deliberately dropped
    // here too — confirmed live it makes window.open() return null in
    // some browsers, which broke this exact "navigate it later" trick
    // (the tab opened but stayed on about:blank forever). Not needed for
    // safety anyway since the destination is our own trusted API response,
    // not user-supplied content.
    var xamanTab = window.open('', '_blank');
    fetch('/api/swap-offer-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: swapOfferState.nftId, toWallet: swapOfferState.toWallet })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        if (xamanTab) xamanTab.close();
        el.swapOfferOpenXamanBtn.disabled = false;
        el.swapOfferOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
        el.swapConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      swapOfferState.uuid = res.data.uuid;
      if (xamanTab) xamanTab.location.href = res.data.next.always;
      else window.open(res.data.next.always, '_blank');
      el.swapOfferOpenXamanBtn.textContent = '[ WA!T!NG F0R S!GNATURE... ]';
      el.swapConfirmStatus.textContent = 'S!GN !N XAMAN, THEN RETURN HERE.';
      pollSwapOfferStatus();
    }).catch(function(){
      if (xamanTab) xamanTab.close();
      el.swapOfferOpenXamanBtn.disabled = false;
      el.swapOfferOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
      el.swapConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });

  function pollSwapOfferStatus(){
    if (swapOfferPollTimer) clearTimeout(swapOfferPollTimer);
    if (!swapOfferState || !swapOfferState.uuid) return;
    var qs = 'uuid=' + encodeURIComponent(swapOfferState.uuid) +
      '&nftId=' + encodeURIComponent(swapOfferState.nftId) +
      '&toWallet=' + encodeURIComponent(swapOfferState.toWallet);
    if (swapOfferState.swapId) qs += '&swapId=' + encodeURIComponent(swapOfferState.swapId);
    else if (swapOfferState.wantNftId) qs += '&wantNftId=' + encodeURIComponent(swapOfferState.wantNftId);
    fetch('/api/swap-offer-status?' + qs)
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'offer_created'){
          showSwapOfferResult(data);
          return;
        }
        if (data.status === 'rejected'){
          el.swapConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.swapOfferOpenXamanBtn.disabled = false;
          el.swapOfferOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        if (data.status === 'expired'){
          el.swapConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.swapOfferOpenXamanBtn.disabled = false;
          el.swapOfferOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        if (data.status === 'failed'){
          el.swapConfirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.swapOfferOpenXamanBtn.disabled = false;
          el.swapOfferOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        // 'pending' or 'signed_pending_ledger' — keep polling.
        swapOfferPollTimer = setTimeout(pollSwapOfferStatus, 2000);
      }).catch(function(){
        swapOfferPollTimer = setTimeout(pollSwapOfferStatus, 3000);
      });
  }

  function showSwapOfferResult(data){
    el.swapResultNftId.textContent = swapOfferState.nftId;
    el.swapResultToWallet.textContent = swapOfferState.toWallet;
    el.swapResultStatus.textContent = 'YOUR 0FFER !S 0N-LEDGER';
    el.swapResultOfferId.textContent = data.offerId || '—';
    if (data.txHash){
      el.swapResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.swapResultTxLink.textContent = data.txHash;
    } else {
      el.swapResultTxLink.removeAttribute('href');
      el.swapResultTxLink.textContent = '—';
    }
    showScreen('swapofferresult');
  }
  el.swapResultDoneBtn.addEventListener('click', function(){
    if (swapOfferState && swapOfferState.swapId){
      showTab('swapoffers');
      loadSwapOffersMine();
    } else {
      showScreen('browse');
    }
  });

  // ---- SWAP OFFERS tab — every pending pair involving MY_WALLET, on
  // either side. Discovering an incoming offer, reciprocating it (reuses
  // startSwapOffer above unchanged), and accepting both live here. ----
  var swapOffersData = null;
  function swapOfferRowHtml(row){
    var myImg = row.myImage ? '<img src="' + escapeHtml(row.myImage) + '" alt="">' : '[ IMAGE ]';
    var otherImg = row.otherImage ? '<img src="' + escapeHtml(row.otherImage) + '" alt="">' : '[ IMAGE ]';
    var actionHtml;
    if (row.action === 'need_to_offer'){
      actionHtml = '<button class="bar-btn swap-offer-reciprocate-btn" data-swapid="' + escapeHtml(row.swapId) + '" style="width:100%; margin-top:0.5rem;">[ CREATE MATCH!NG 0FFER ]</button>';
    } else if (row.action === 'waiting_for_other_offer'){
      actionHtml = '<div class="index-line" style="margin-top:0.5rem;">WA!T!NG F0R THE 0THER WALLET T0 0FFER</div>';
    } else if (row.action === 'ready_to_accept'){
      actionHtml = '<button class="bar-btn swap-offer-accept-btn" data-swapid="' + escapeHtml(row.swapId) + '" style="width:100%; margin-top:0.5rem;">[ ACCEPT SWAP ]</button>';
    } else {
      actionHtml = '<div class="index-line" style="margin-top:0.5rem;">WA!T!NG F0R THE 0THER WALLET T0 ACCEPT</div>';
    }
    return '<div class="result-card" style="display:flex; gap:0.75rem; padding:0.75rem; align-items:center;">' +
      '<div class="pigeon-img-box" style="width:64px; height:64px; flex:0 0 auto;">' + myImg + '</div>' +
      '<div style="flex:0 0 auto; font-size:16px; color:var(--magenta);">⇄</div>' +
      '<div class="pigeon-img-box" style="width:64px; height:64px; flex:0 0 auto;">' + otherImg + '</div>' +
      '<div style="flex:1; min-width:0;">' +
        '<div class="index-line" style="margin:0;">Y0U 0FFER #' + (row.myNumber !== null && row.myNumber !== undefined ? row.myNumber : '????') +
        ' :: THEY 0FFER #' + (row.otherNumber !== null && row.otherNumber !== undefined ? row.otherNumber : '????') + '</div>' +
        '<div class="index-line" style="margin:0.25rem 0 0;">WALLET :: ' + escapeHtml(row.otherWallet) + '</div>' +
        actionHtml +
      '</div>' +
    '</div>';
  }
  function renderSwapOffersList(){
    if (swapOffersData === null){
      el.swapOffersList.innerHTML = '<div class="th-empty">L0AD!NG...</div>';
      return;
    }
    if (!swapOffersData.length){
      el.swapOffersList.innerHTML = '<div class="th-empty">N0 PEND!NG SWAP 0FFERS.</div>';
      return;
    }
    el.swapOffersList.innerHTML = swapOffersData.map(swapOfferRowHtml).join('');
  }
  function loadSwapOffersMine(){
    swapOffersData = null;
    renderSwapOffersList();
    fetch('/api/swap-offers-mine')
      .then(function(r){ return r.json(); })
      .then(function(data){
        swapOffersData = (data && data.offers) || [];
        renderSwapOffersList();
      }).catch(function(){
        swapOffersData = [];
        el.swapOffersList.innerHTML = '<div class="th-empty">// S!GNAL_L0ST — C0ULD N0T L0AD SWAP 0FFERS.</div>';
      });
  }
  el.swapOffersList.addEventListener('click', function(e){
    var reciprocateBtn = e.target.closest('.swap-offer-reciprocate-btn');
    if (reciprocateBtn){
      var swapId = reciprocateBtn.getAttribute('data-swapid');
      var row = (swapOffersData || []).filter(function(r){ return r.swapId === swapId; })[0];
      if (row) startSwapOffer(row.myNftId, row.otherWallet, { swapId: swapId });
      return;
    }
    var acceptBtn = e.target.closest('.swap-offer-accept-btn');
    if (acceptBtn){
      var acceptSwapId = acceptBtn.getAttribute('data-swapid');
      openSwapAcceptConfirm(acceptSwapId);
    }
  });

  // ---- ACCEPT SWAP — accepts the OTHER side's offer. Same prepare ->
  // confirm -> payload -> poll-status shape as everything else here, but
  // keyed by swapId only (the server looks up which offer that means). ----
  var swapAcceptState = null; // { swapId, uuid }
  function openSwapAcceptConfirm(swapId){
    swapAcceptState = { swapId: swapId, uuid: null };
    el.acceptConfirmStatus.textContent = 'VAL!DAT!NG...';
    el.swapAcceptOpenXamanBtn.disabled = true;
    showScreen('swapacceptconfirm');
    fetch('/api/swap-accept-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swapId: swapId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        el.acceptConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        el.swapAcceptOpenXamanBtn.disabled = true;
        return;
      }
      var txjson = res.data.txjson;
      el.acceptConfTxType.textContent = txjson.TransactionType;
      el.acceptConfAccount.textContent = txjson.Account;
      el.acceptConfOfferId.textContent = txjson.NFTokenSellOffer;
      el.acceptConfNftId.textContent = res.data.display && res.data.display.nftId;
      el.acceptConfFromWallet.textContent = res.data.display && res.data.display.fromWallet;
      el.acceptConfirmStatus.textContent = '';
      el.swapAcceptOpenXamanBtn.disabled = false;
      el.swapAcceptOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
    }).catch(function(){
      el.acceptConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
      el.swapAcceptOpenXamanBtn.disabled = true;
    });
  }
  el.swapAcceptConfirmBackBtn.addEventListener('click', function(){ showScreen('swapoffers'); });

  el.swapAcceptOpenXamanBtn.addEventListener('click', function(){
    if (!swapAcceptState) return;
    el.swapAcceptOpenXamanBtn.disabled = true;
    el.swapAcceptOpenXamanBtn.textContent = '[ REQUEST!NG... ]';
    el.acceptConfirmStatus.textContent = '';
    var xamanTab = window.open('', '_blank');
    fetch('/api/swap-accept-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swapId: swapAcceptState.swapId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        if (xamanTab) xamanTab.close();
        el.swapAcceptOpenXamanBtn.disabled = false;
        el.swapAcceptOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
        el.acceptConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      swapAcceptState.uuid = res.data.uuid;
      if (xamanTab) xamanTab.location.href = res.data.next.always;
      else window.open(res.data.next.always, '_blank');
      el.swapAcceptOpenXamanBtn.textContent = '[ WA!T!NG F0R S!GNATURE... ]';
      el.acceptConfirmStatus.textContent = 'S!GN !N XAMAN, THEN RETURN HERE.';
      pollSwapAcceptStatus();
    }).catch(function(){
      if (xamanTab) xamanTab.close();
      el.swapAcceptOpenXamanBtn.disabled = false;
      el.swapAcceptOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
      el.acceptConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });

  var swapAcceptPollTimer = null;
  function pollSwapAcceptStatus(){
    if (swapAcceptPollTimer) clearTimeout(swapAcceptPollTimer);
    if (!swapAcceptState || !swapAcceptState.uuid) return;
    var qs = 'uuid=' + encodeURIComponent(swapAcceptState.uuid) + '&swapId=' + encodeURIComponent(swapAcceptState.swapId);
    fetch('/api/swap-accept-status?' + qs)
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'settled'){
          el.acceptResultNftId.textContent = data.nftReceived || '—';
          el.acceptResultStatus.textContent = data.swapComplete ? 'SWAP C0MPLETE — B0TH S!DES SETTLED' : 'ACCEPTED — WA!T!NG 0N THE 0THER S!DE T0 ACCEPT Y0URS';
          if (data.txHash){
            el.acceptResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
            el.acceptResultTxLink.textContent = data.txHash;
          } else {
            el.acceptResultTxLink.removeAttribute('href');
            el.acceptResultTxLink.textContent = '—';
          }
          showScreen('swapacceptresult');
          return;
        }
        if (data.status === 'rejected'){
          el.acceptConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.swapAcceptOpenXamanBtn.disabled = false;
          el.swapAcceptOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        if (data.status === 'expired'){
          el.acceptConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.swapAcceptOpenXamanBtn.disabled = false;
          el.swapAcceptOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        if (data.status === 'failed'){
          el.acceptConfirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.swapAcceptOpenXamanBtn.disabled = false;
          el.swapAcceptOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        swapAcceptPollTimer = setTimeout(pollSwapAcceptStatus, 2000);
      }).catch(function(){
        swapAcceptPollTimer = setTimeout(pollSwapAcceptStatus, 3000);
      });
  }
  el.acceptResultDoneBtn.addEventListener('click', function(){
    showTab('swapoffers');
    loadSwapOffersMine();
  });

  function refreshCardSelectionStates(){
    document.querySelectorAll('.result-card').forEach(function(card){
      var id = card.getAttribute('data-nftid');
      var offerCtx = isOwnWalletScope();
      var inTarget = offerCtx ? !!state.offerAssets[id] : !!state.targetAssets[id];
      card.classList.toggle('in-target', inTarget);
      var btn = card.querySelector('.select-btn');
      if (btn){ btn.classList.toggle('selected', inTarget); btn.textContent = inTarget ? '[ SELECTED ]' : '[ SELECT ]'; }
      var toggle = card.querySelector('.card-select-toggle');
      if (toggle){
        toggle.classList.toggle('selected', inTarget);
        toggle.textContent = inTarget ? '✓' : '+';
        var atCapNow = offerCtx
          ? (!inTarget && offerCount() >= OFFER_MAX)
          : (!inTarget && targetCount() >= OFFER_MAX);
        toggle.classList.toggle('at-cap', atCapNow);
      }
    });
    if (el.detailSelectBtn && state.currentDetail && state.scope){
      var d = isOwnWalletScope() ? !!state.offerAssets[state.currentDetail.nftId] : !!state.targetAssets[state.currentDetail.nftId];
      el.detailSelectBtn.classList.toggle('selected', d);
      el.detailSelectBtn.textContent = d ? '[ SELECTED ]' : '[ SELECT ]';
    }
  }

  // ---- SELECT/ADD behaviour: your own wallet in scope fills OFFER;
  // anything else fills WANT/FOR (an offer must exist first), and the
  // first WANT pick auto-identifies + browses that Pigeon's owner via the
  // pre-existing enterOwnerScope/browseOwnerCollection. ----
  function handleSelect(p){
    if (isOwnWalletScope()){
      toggleOfferAsset(p);
      return;
    }
    if (offerCount() === 0){
      alert('PLEASE SELECT A P!GE0N T0 0FFER F0R.');
      return;
    }
    // A trade needs two different wallets — a Pigeon you already own can't
    // go on the WANT side (mirrors the same "not your own" rule BUY
    // enforces server-side for the $PIGEONS marketplace).
    if (MY_WALLET && p.owner === MY_WALLET){
      alert('THAT\\'S ALREADY Y0UR P!GE0N — P!CK 0NE FR0M AN0THER WALLET F0R THE TRADE.');
      return;
    }
    if (!state.scope){
      enterOwnerScope(p);
    } else {
      toggleTargetAsset(p);
    }
  }

  // Shared by SELECT (auto-enters owner scope + auto-targets the pigeon
  // that got you there) and the plain "view this wallet's collection" click
  // on an owner address (no auto-targeting).
  // targetPigeon is optional — set only when arriving here via SELECT on
  // a specific Pigeon (owner-links, top holders, MY PIGEONS etc. browse a
  // wallet directly with no "target" pigeon that led here).
  function browseOwnerCollection(wallet, ownerShort, targetPigeon){
    state.scope = { wallet: wallet, ownerShort: ownerShort || wallet };
    state.targetAssets = {};
    state.traitFilters = [];
    renderTraitRows();
    el.searchInput.value = '';
    el.nodeHeaderPanel.style.display = '';
    el.nodeAddr.textContent = state.scope.ownerShort;
    el.searchPanelTitle.textContent = 'H0LDER P!GE0N DATABASE';
    if (targetPigeon){
      el.targetPigeonCard.style.display = '';
      el.targetPigeonImg.innerHTML = targetPigeon.image ? '<img src="' + escapeHtml(targetPigeon.image) + '" alt="">' : '[ IMAGE ]';
      el.targetPigeonNum.textContent = targetPigeon.number !== null ? 'P!GE0N #' + targetPigeon.number : 'P!GE0N ...';
      el.targetPigeonOwner.textContent = state.scope.ownerShort;
    } else {
      el.targetPigeonCard.style.display = 'none';
    }
    el.resultsArea.innerHTML = '<div class="loading-note">L0AD!NG H0LDER\\'S REAL P!GE0NS...</div>';
    // Force the DATABASE tab regardless of which tab we were on (a wallet
    // click from Top 10 / Sales Data should always land here) — and mark it
    // loaded first so opening it doesn't ALSO kick off a full-collection
    // fetch that would race this wallet-scoped one.
    state.databaseLoaded = true;
    showTab('database');
    renderTradeBuilder();
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
    browseOwnerCollection(targetPigeon.owner, targetPigeon.ownerShort, targetPigeon);
    state.targetAssets[targetPigeon.nftId] = { nftId: targetPigeon.nftId, number: targetPigeon.number, image: targetPigeon.image };
    renderTradeBuilder();
    refreshCardSelectionStates();
  }

  el.backToFullCollectionLink.addEventListener('click', function(e){
    e.preventDefault();
    // Exiting a scope never touches either pile — OFFER and WANT are
    // independent of whatever's currently being browsed, so you can freely
    // step back to the full collection without losing progress on either
    // side.
    state.scope = null;
    state.scopeAllItems = [];
    state.traitFilters = [];
    renderTraitRows();
    el.nodeHeaderPanel.style.display = 'none';
    el.searchPanelTitle.textContent = 'P!GE0N DATABASE';
    el.searchInput.value = '';
    renderTradeBuilder();
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
  function listingBlockHtml(marketLabel, listing){
    var hasPrice = listing && listing.priceXrp !== null && listing.priceXrp !== undefined;
    var priceHtml = hasPrice
      ? '<div class="cl-price">' + listing.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP</div>'
      : '<div class="cl-price cl-none">N0 L!ST!NG</div>';
    var inner = '<div class="cl-market">' + marketLabel + '</div>' + priceHtml;
    // The whole box is the buy link when there's a real listing — no
    // separate [ BUY ] button, just a colored/clickable box.
    return (hasPrice && listing.buyUrl)
      ? '<a class="cl-block cl-block-buy" href="' + escapeHtml(listing.buyUrl) + '" target="_blank" rel="noopener" title="BUY 0N ' + escapeHtml(marketLabel) + '">' + inner + '</a>'
      : '<div class="cl-block">' + inner + '</div>';
  }
  // DATABASE cards: a wide row (thumbnail/number/rarity on the left,
  // every other detail on the right) instead of a grid tile — reuses
  // .result-card for all the existing selection-state/click-handling
  // hooks (in-target, .pigeon-img-box, .card-select-toggle) unchanged;
  // .result-row is purely the new visual layout on top of that, so MY
  // PIGEONS' own tile cards (myPigeonCardHtml, .result-card only, no
  // .result-row) are completely unaffected.
  function cardTraitsHtml(p){
    if (!p.attributes || !p.attributes.length) return '';
    return '<div class="card-traits">' + p.attributes.map(function(a){
      return '<span class="card-trait-chip"><b>' + escapeHtml(a.trait_type) + '</b>' + escapeHtml(a.value) + '</span>';
    }).join('') + '</div>';
  }
  function resultCardHtml(p){
    var rarityLine = p.rarityRank ? '<div class="result-rarity-line">RAR!TY ' + p.rarityRank + '/' + (p.rarityTotal || 3015) + '</div>' : '';
    var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : '[ IMAGE ]';
    var num = p.number !== null ? '#' + p.number : '#????';
    var offerCtxCard = isOwnWalletScope();
    var inTarget = offerCtxCard ? !!state.offerAssets[p.nftId] : !!state.targetAssets[p.nftId];
    var atCap = offerCtxCard
      ? (!inTarget && offerCount() >= OFFER_MAX)
      : (!inTarget && targetCount() >= OFFER_MAX);
    // Order: marketplace listings, then the $PIGEONS listing (styled like
    // a currency — coin icon + amount), then traits, then a history toggle
    // that swaps this whole box for the sales-history list.
    var listingsHtml = p.listings
      ? '<div class="card-listings">' + listingBlockHtml('XRP.CAFE', p.listings.xrpCafe) + listingBlockHtml('DEEPT!DE', p.listings.deeptide) + '</div>'
      : '';
    var canBuyScylla = p.scyllaListing && p.owner !== MY_WALLET;
    var scyllaListedHtml = p.scyllaListing
      ? '<div class="card-scylla-row">' +
          '<span class="card-scylla-coin-wrap"><img class="card-scylla-coin" src="/api/ipfs-image?src=https%3A%2F%2Fipfs.io%2Fipfs%2FQmRbNvemLYjHuRZcpYRRSq5vqqozzjoy3aDR6eSzSoTFUs" alt="$P!GE0NS"><span class="card-scylla-price">' + escapeHtml(p.scyllaListing.price) + ' $P!GE0NS</span></span>' +
          (canBuyScylla ? '<button class="card-buy-scylla-btn buy-scylla-btn" data-nftid="' + escapeHtml(p.nftId) + '">[ BUY ]</button>' : '') +
        '</div>'
      : '';
    var traitsHtml = cardTraitsHtml(p);
    var hasHigh = p.highSaleXrp !== null && p.highSaleXrp !== undefined;
    var hasAvg = p.avgSaleXrp !== null && p.avgSaleXrp !== undefined;
    var saleStatsHtml = (hasHigh || hasAvg)
      ? '<div class="card-sale-stats">' +
          (hasHigh ? '<span class="css-item"><span class="css-label">H!GHEST REC0RDED</span>' + fmtXrp(p.highSaleXrp) + ' XRP</span>' : '') +
          (hasAvg ? '<span class="css-item"><span class="css-label">AVG SALE</span>' + fmtXrp(p.avgSaleXrp) + ' XRP</span>' : '') +
        '</div>'
      : '';
    return '<div class="result-card result-row' + (inTarget ? ' in-target' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '">' +
      '<div class="result-row-left">' +
        '<div class="pigeon-img-box" data-nftid="' + escapeHtml(p.nftId) + '">' +
          img +
          '<button class="card-select-toggle' + (inTarget ? ' selected' : '') + (atCap ? ' at-cap' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '" title="SELECT">' + (inTarget ? '✓' : '+') + '</button>' +
        '</div>' +
        '<div class="result-num">P!GE0N ' + num + '</div>' +
        rarityLine +
      '</div>' +
      '<div class="result-row-right">' +
        '<div class="result-row-right-body">' +
          listingsHtml +
          scyllaListedHtml +
          traitsHtml +
          saleStatsHtml +
          '<button class="card-history-toggle" data-nftid="' + escapeHtml(p.nftId) + '">[ SALES H!ST0RY ▼ ]</button>' +
        '</div>' +
        '<div class="card-history-box" data-nftid="' + escapeHtml(p.nftId) + '" style="display:none;">' +
          '<button class="card-history-back">[ ← BACK ]</button>' +
          '<div class="card-history-list"><div class="th-empty">L0AD!NG...</div></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function appendResults(newItems){
    if (!newItems.length) return;
    var list = el.resultsArea.querySelector('.result-list');
    if (!list){
      el.resultsArea.innerHTML = '<div class="result-list"></div>';
      list = el.resultsArea.querySelector('.result-list');
    }
    list.insertAdjacentHTML('beforeend', newItems.map(resultCardHtml).join(''));
  }
  function renderResultsReplace(items){
    el.resultsArea.innerHTML = items.length ? '<div class="result-list">' + items.map(resultCardHtml).join('') + '</div>' : '';
  }

  // Per-card sales history is never bulk-fetched (that's 20-36 extra
  // Deeptide calls just for cards the user may never expand) — fetched
  // once on first expand and cached here so re-opening the same card is
  // instant and never re-hits the API.
  var cardHistoryCache = {};
  function loadCardHistoryInto(nftId, listEl){
    if (cardHistoryCache[nftId]){
      listEl.innerHTML = cardHistoryCache[nftId];
      return;
    }
    listEl.innerHTML = '<div class="th-empty">L0AD!NG...</div>';
    api({ history: nftId }).then(function(data){
      var events = data.events || [];
      var html = events.length ? events.map(historyRowHtml).join('') : '<div class="th-empty">N0 H!ST0RY YET.</div>';
      cardHistoryCache[nftId] = html;
      listEl.innerHTML = html;
    }).catch(function(){
      listEl.innerHTML = '<div class="th-empty">C0ULD N0T L0AD H!ST0RY.</div>';
    });
  }
  function wireResultClicks(container, source){
    container.addEventListener('click', function(e){
      var historyToggle = e.target.closest('.card-history-toggle');
      if (historyToggle){
        var card = historyToggle.closest('.result-card');
        var body = card.querySelector('.result-row-right-body');
        var box = card.querySelector('.card-history-box');
        body.style.display = 'none';
        box.style.display = '';
        loadCardHistoryInto(historyToggle.getAttribute('data-nftid'), box.querySelector('.card-history-list'));
        return;
      }
      var historyBack = e.target.closest('.card-history-back');
      if (historyBack){
        var card2 = historyBack.closest('.result-card');
        card2.querySelector('.result-row-right-body').style.display = '';
        card2.querySelector('.card-history-box').style.display = 'none';
        return;
      }
      var buyBtn = e.target.closest('.buy-scylla-btn');
      if (buyBtn){
        var bp = source().filter(function(x){ return x.nftId === buyBtn.getAttribute('data-nftid'); })[0];
        if (bp) openBuyConfirm(bp);
        return;
      }
      var toggle = e.target.closest('.card-select-toggle');
      if (toggle){
        var tp = source().filter(function(x){ return x.nftId === toggle.getAttribute('data-nftid'); })[0];
        if (tp) handleSelect(tp);
        return;
      }
      // MY PIGEONS' own toggle — always adds to the OFFER pile directly,
      // never through handleSelect's scope-based branching (this list is
      // never "scoped" the way the DATABASE grid is, so that branching
      // would misfire here).
      var myToggle = e.target.closest('.my-pigeon-offer-toggle');
      if (myToggle){
        var mp = source().filter(function(x){ return x.nftId === myToggle.getAttribute('data-nftid'); })[0];
        if (mp) toggleOfferAsset(mp);
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
    var isSalesSort = state.sort === 'HIGHEST_SALE' || state.sort === 'SALES_LOW' || state.sort === 'AVG_SALE_ASC';
    var isNumericSort = state.sort === 'NAME_ASC' || state.sort === 'NAME_DESC';
    var isCrossListing = state.sort === 'PRICE_ASC' || state.sort === 'PRICE_DESC';
    var reqParams;
    if (state.scyllaListedOnly){
      // Only Pigeons actually listed through Scylla itself, sorted by real
      // $PIGEONS price — server re-verifies each item against real
      // nft_sell_offers, so a stale/cancelled listing can't linger here.
      reqParams = { skip: state.skip, limit: PAGE_SIZE, scyllaListed: 1, dir: state.sort === 'SCYLLA_PRICE_DESC' ? 'desc' : 'asc' };
    } else if (isSalesSort){
      reqParams = {
        skip: state.skip, limit: PAGE_SIZE, highestSale: 1,
        dir: (state.sort === 'SALES_LOW' || state.sort === 'AVG_SALE_ASC') ? 'asc' : 'desc',
        metric: state.sort === 'AVG_SALE_ASC' ? 'avg' : 'max'
      };
    } else if (isCrossListing){
      // Real lowest/highest across BOTH Deeptide and xrp.cafe, not just
      // whichever platform happens to have the cheaper API.
      reqParams = { skip: state.skip, limit: 20, crossListing: state.sort === 'PRICE_ASC' ? 'asc' : 'desc' };
    } else if (isEdition && isNumericSort){
      // Direct slice of the number map restricted to this range — no scan needed.
      reqParams = { skip: state.skip, limit: PAGE_SIZE, numberRange: state.edition === 'LOW' ? 'low' : 'high', numericOrder: state.sort === 'NAME_DESC' ? 'desc' : 'asc' };
    } else if (isEdition){
      reqParams = { rawSkip: state.editionRawSkip, limit: PAGE_SIZE, numberRange: state.edition === 'LOW' ? 'low' : 'high', sort: state.sort };
    } else if (isNumericSort){
      // True numeric Pigeon-number order (1,2,3...), not Deeptide's own
      // "name-asc" which sorts the string "PIGEONS10" before "PIGEONS2".
      reqParams = { skip: state.skip, limit: PAGE_SIZE, numericOrder: state.sort === 'NAME_DESC' ? 'desc' : 'asc' };
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
        if (state.scyllaListedOnly){
          el.resultsArea.innerHTML = emptyStateHtml('// N0 ACT!VE L!ST!NGS', ['N0THING !S CURRENTLY L!STED THR0UGH SCYLLA.', 'BE THE F!RST — L!ST A P!GE0N FR0M MY P!GE0NS.'], false);
        } else {
          el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0N MATCH', filters.length ? ['N0 P!GE0NS MATCH ALL SELECTED TRA!TS.'] : ['TRY AGA!N.'], filters.length > 0);
        }
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
      // Once a value's actually picked (whichever way — the manual chips
      // below, or the TRAITS hover flyout), collapse straight down to a
      // compact applied tag — not the value list again.
      if (row.category && row.value){
        return '<div class="trait-row trait-row-tag" data-id="' + row.id + '">' +
          '<span class="trait-tag-label">' + escapeHtml(row.category.toUpperCase()) + ' :: ' + escapeHtml(row.value.toUpperCase()) + '</span>' +
          '<button class="trait-row-remove" data-id="' + row.id + '">&times;</button>' +
        '</div>';
      }
      var catOptions = cats.map(function(c){
        return '<option value="' + escapeHtml(c) + '"' + (row.category === c ? ' selected' : '') + '>' + escapeHtml(c.toUpperCase()) + '</option>';
      }).join('');
      var vals = ((row.category && state.traitCategories[row.category]) || []).slice().sort(function(a, b){
        return (a.percent || 0) - (b.percent || 0);
      });
      var chips = vals.map(function(v){
        var pct = v.percent !== null && v.percent !== undefined ? ' (' + v.percent.toFixed(3) + '%)' : '';
        return '<button type="button" class="trait-chip' + (row.value === v.value ? ' selected' : '') + '" data-id="' + row.id + '" data-value="' + escapeHtml(v.value) + '">' + escapeHtml(v.value.toUpperCase()) + pct + '</button>';
      }).join('');
      return '<div class="trait-row" data-id="' + row.id + '">' +
        '<select class="trait-cat-select" data-id="' + row.id + '"><option value="">[ CATEG0RY ▼ ]</option>' + catOptions + '</select>' +
        '<button class="trait-row-remove" data-id="' + row.id + '">&times;</button>' +
        (row.category ? '<div class="trait-value-chips" data-id="' + row.id + '">' + chips + '</div>' : '') +
      '</div>';
    }).join('');
  }
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

  // ---- TRAITS hover flyout — a faster path to the same traitFilters
  // state renderTraitRows()/runQuery() above already drive: hover the
  // category, see every value with its real count + %, click one to
  // apply it immediately (adds a filter row exactly like the manual
  // add-row -> pick category -> pick chip flow, just collapsed into one
  // hover + click). ----
  function renderTraitsFlyoutCats(){
    var cats = state.traitCategories ? Object.keys(state.traitCategories).sort(function(a, b){ return a.localeCompare(b); }) : [];
    el.traitsFlyoutCats.innerHTML = cats.map(function(c){
      return '<button type="button" class="traits-flyout-cat" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c.toUpperCase()) + '</button>';
    }).join('');
  }
  function renderTraitsFlyoutVals(category){
    el.traitsFlyoutCats.querySelectorAll('.traits-flyout-cat').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-cat') === category);
    });
    var vals = ((category && state.traitCategories[category]) || []).slice().sort(function(a, b){
      return (a.percent || 0) - (b.percent || 0);
    });
    el.traitsFlyoutVals.innerHTML = vals.map(function(v){
      var pct = v.percent !== null && v.percent !== undefined ? v.percent.toFixed(3) + '%' : '—';
      var count = v.count !== null && v.count !== undefined ? v.count : '—';
      return '<button type="button" class="traits-flyout-val" data-cat="' + escapeHtml(category) + '" data-value="' + escapeHtml(v.value) + '">' +
        '<span>' + escapeHtml(v.value.toUpperCase()) + '</span>' +
        '<span class="tfv-count">' + count + ' :: ' + pct + '</span>' +
      '</button>';
    }).join('');
  }
  function openTraitsFlyout(){
    ensureTraitsLoaded().then(function(){
      renderTraitsFlyoutCats();
      el.traitsFlyoutVals.innerHTML = '<div class="th-empty">H0VER A CATEG0RY</div>';
      el.traitsFlyout.style.display = 'flex';
      el.traitsHoverWrap.classList.add('open');
    });
  }
  function closeTraitsFlyout(){
    el.traitsFlyout.style.display = 'none';
    el.traitsHoverWrap.classList.remove('open');
  }
  el.traitsHoverWrap.addEventListener('mouseenter', openTraitsFlyout);
  el.traitsHoverWrap.addEventListener('mouseleave', closeTraitsFlyout);
  el.traitsHoverLabel.addEventListener('click', function(){
    // Touch devices have no hover — tap toggles the same flyout.
    if (el.traitsFlyout.style.display === 'flex') closeTraitsFlyout();
    else openTraitsFlyout();
  });
  el.traitsFlyoutCats.addEventListener('mouseover', function(e){
    var catBtn = e.target.closest('.traits-flyout-cat');
    if (catBtn) renderTraitsFlyoutVals(catBtn.getAttribute('data-cat'));
  });
  el.traitsFlyoutCats.addEventListener('click', function(e){
    var catBtn = e.target.closest('.traits-flyout-cat');
    if (catBtn) renderTraitsFlyoutVals(catBtn.getAttribute('data-cat'));
  });
  el.traitsFlyoutVals.addEventListener('click', function(e){
    var valBtn = e.target.closest('.traits-flyout-val');
    if (!valBtn) return;
    var category = valBtn.getAttribute('data-cat');
    var value = valBtn.getAttribute('data-value');
    // Reuse an existing empty row if one's sitting there unused, same as
    // clicking [+ ADD TRAIT] would give you — otherwise add a fresh one.
    var target = state.traitFilters.filter(function(r){ return !r.category; })[0];
    if (!target){
      target = { id: state.nextTraitRowId++, category: '', value: '' };
      state.traitFilters.push(target);
    }
    target.category = category;
    target.value = value;
    renderTraitRows();
    closeTraitsFlyout();
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
    } else if (state.sort === 'HIGHEST_SALE' || state.sort === 'SALES_LOW'){
      list = list.slice().sort(function(a, b){
        var av = a.highSaleXrp === null || a.highSaleXrp === undefined ? -1 : a.highSaleXrp, bv = b.highSaleXrp === null || b.highSaleXrp === undefined ? -1 : b.highSaleXrp;
        return state.sort === 'SALES_LOW' ? av - bv : bv - av;
      });
    } else if (state.sort === 'AVG_SALE_ASC'){
      list = list.slice().sort(function(a, b){
        var av = a.avgSaleXrp === null || a.avgSaleXrp === undefined ? Infinity : a.avgSaleXrp, bv = b.avgSaleXrp === null || b.avgSaleXrp === undefined ? Infinity : b.avgSaleXrp;
        return av - bv;
      });
    } else if (state.sort === 'PRICE_ASC' || state.sort === 'PRICE_DESC'){
      list = list.slice().sort(function(a, b){
        var ap = a.priceXrp === null || a.priceXrp === undefined ? Infinity : a.priceXrp, bp = b.priceXrp === null || b.priceXrp === undefined ? Infinity : b.priceXrp;
        return state.sort === 'PRICE_DESC' ? bp - ap : ap - bp;
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
  // Number-only search box — trait filtering already has its own dedicated
  // UI (the TRAITS stack), so this just resolves "1842" -> that one Pigeon
  // via the number->NFTokenID index.
  function runSearchBox(){
    var q = el.searchInput.value.trim();
    if (!q){ runQuery(); return; }
    var isNumber = /^#?\\d+$/.test(q);
    if (!isNumber){
      el.statusLine.innerHTML = 'RESULTS :: <span class="hi">0</span>';
      el.resultsArea.innerHTML = emptyStateHtml('// !NVAL!D QUERY', ['ENTER A P!GE0N NUMBER (E.G. 1842).'], true);
      wireClearSearch();
      return;
    }
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
      renderTopHoldersList();
    }).catch(function(){ topHoldersData = []; renderTopHoldersList(); });
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
  el.topHoldersList.addEventListener('click', function(e){
    var row = e.target.closest('.th-row');
    if (!row) return;
    browseOwnerCollection(row.getAttribute('data-wallet'), row.getAttribute('data-short'));
  });

  // ---- MY PIGEONS — CONNECT SCYLLA reuses the exact same XummPkce login
  // /board already uses (same API key, same /api/connect, same
  // pigeon_session cookie) rather than a second wallet-connect system. ----
  var myPigeonsData = null; // null = not fetched yet
  var myListedData = {};    // nftId -> { price, currency, offerId } — real on-ledger sell offers, not a stored flag
  function myPigeonCardHtml(p){
    var rarityLine = p.rarityRank ? '<div class="result-rarity-line">RAR!TY ' + p.rarityRank + '/' + (p.rarityTotal || 3015) + '</div>' : '';
    var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : '[ IMAGE ]';
    var num = p.number !== null ? '#' + p.number : '#????';
    var listedInfo = myListedData[p.nftId];
    var actionHtml = listedInfo
      ? '<div class="index-line" style="margin-top:0.5rem; color:var(--magenta); text-shadow:0 0 5px var(--magenta-glow);">L!STED :: ' + escapeHtml(listedInfo.price) + ' $P!GE0NS</div>' +
        '<button class="bar-btn delist-pigeon-btn" data-nftid="' + escapeHtml(p.nftId) + '" style="width:100%; margin-top:0.4rem;">[ DEL!ST ]</button>'
      : '<button class="bar-btn list-pigeon-btn" data-nftid="' + escapeHtml(p.nftId) + '" style="width:100%; margin-top:0.5rem;">[ L!ST ]</button>';
    // Own, separate toggle class from the DATABASE grid's .card-select-toggle
    // (same look, via shared CSS selectors) — deliberately NOT the same
    // class, so wireResultClicks' generic handler (which routes through
    // handleSelect's scope-based branching, wrong for this always-unscoped
    // list) never sees this click; toggleOfferAsset is called directly.
    var inOffer = !!state.offerAssets[p.nftId];
    var atCap = !inOffer && offerCount() >= OFFER_MAX;
    var offerToggleHtml = SWAP_BUILDER_ENABLED
      ? '<button class="my-pigeon-offer-toggle' + (inOffer ? ' selected' : '') + (atCap ? ' at-cap' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '" title="ADD T0 SWAP 0FFER">' + (inOffer ? '✓' : '+') + '</button>'
      : '';
    return '<div class="result-card' + (inOffer ? ' in-target' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '">' +
      '<div class="result-num">P!GE0N ' + num + '</div>' +
      '<div class="pigeon-img-box" data-nftid="' + escapeHtml(p.nftId) + '">' +
        img +
        offerToggleHtml +
      '</div>' +
      '<div class="result-card-body">' + rarityLine + actionHtml + '</div>' +
    '</div>';
  }
  // ---- MY PIGEONS ordering: pigeons you've listed through Scylla always
  // come first, highest $PIGEONS price to lowest — the sort dropdown only
  // governs the rest, same rarity/A-Z options DATABASE offers. ----
  var myPigeonsSort = 'RARITY_ASC';
  function sortedMyPigeons(){
    var listed = [], rest = [];
    (myPigeonsData || []).forEach(function(p){
      if (myListedData[p.nftId]) listed.push(p); else rest.push(p);
    });
    listed.sort(function(a, b){
      var av = parseFloat(myListedData[a.nftId].price) || 0;
      var bv = parseFloat(myListedData[b.nftId].price) || 0;
      return bv - av;
    });
    rest.sort(function(a, b){
      if (myPigeonsSort === 'RARITY_DESC') return (b.rarityRank || 0) - (a.rarityRank || 0);
      if (myPigeonsSort === 'NAME_ASC') return (a.number || 0) - (b.number || 0);
      if (myPigeonsSort === 'NAME_DESC') return (b.number || 0) - (a.number || 0);
      return (a.rarityRank || 999999) - (b.rarityRank || 999999); // RARITY_ASC default
    });
    return listed.concat(rest);
  }
  function renderMyPigeonsList(){
    el.myPigeonsPanelTitle.textContent = 'MY P!GE0NS' + (myPigeonsData !== null ? ' :: ' + myPigeonsData.length : '');
    if (myPigeonsData === null){ el.myPigeonsList.innerHTML = '<div class="th-empty">L0AD!NG...</div>'; return; }
    if (!myPigeonsData.length){ el.myPigeonsSortRow.style.display = 'none'; el.myPigeonsList.innerHTML = '<div class="th-empty">Y0U D0N\\'T H0LD ANY P!GE0NS YET.</div>'; return; }
    el.myPigeonsSortRow.style.display = '';
    el.myPigeonsList.innerHTML = '<div class="result-grid my-pigeons-grid">' + sortedMyPigeons().map(myPigeonCardHtml).join('') + '</div>';
  }
  el.myPigeonsSortSelect.addEventListener('change', function(){
    myPigeonsSort = el.myPigeonsSortSelect.value;
    renderMyPigeonsList();
  });
  function loadMyPigeons(){
    if (!MY_WALLET){
      el.myPigeonsConnect.style.display = '';
      el.myWalletInfo.style.display = 'none';
      el.myPigeonsSortRow.style.display = 'none';
      el.myPigeonsPanelTitle.textContent = 'MY P!GE0NS';
      el.myPigeonsList.innerHTML = '';
      return;
    }
    el.myPigeonsConnect.style.display = 'none';
    el.myWalletInfo.style.display = '';
    el.myWalletAddr.textContent = MY_WALLET;
    renderMyPigeonsList();
    api({ wallet: MY_WALLET }).then(function(data){
      myPigeonsData = data.items || [];
      el.myWalletCount.textContent = 'P!GE0NS :: ' + myPigeonsData.length;
      renderMyPigeonsList();
      return fetch('/api/swap-listing-owned?wallet=' + encodeURIComponent(MY_WALLET)).then(function(r){ return r.json(); });
    }).then(function(listedRes){
      myListedData = (listedRes && listedRes.listed) || {};
      renderMyPigeonsList();
    }).catch(function(){});
  }
  wireResultClicks(el.myPigeonsList, function(){ return myPigeonsData || []; });
  el.myPigeonsList.addEventListener('click', function(e){
    var listBtn = e.target.closest('.list-pigeon-btn');
    if (listBtn){
      var nftId = listBtn.getAttribute('data-nftid');
      var p = (myPigeonsData || []).filter(function(x){ return x.nftId === nftId; })[0];
      if (p) openListForm(p);
      return;
    }
    var delistBtn = e.target.closest('.delist-pigeon-btn');
    if (delistBtn){
      var dNftId = delistBtn.getAttribute('data-nftid');
      var dp = (myPigeonsData || []).filter(function(x){ return x.nftId === dNftId; })[0];
      if (dp) openDelistConfirm(dp);
    }
  });

  // ---- CONNECT SCYLLA — same XummPkce OAuth login /board uses, redirected
  // back to /swap instead. ----
  var xummAuth = null;
  function getXummAuth(){
    if (!xummAuth){
      xummAuth = new XummPkce(XAMAN_API_KEY, {
        implicit: true,
        rememberJwt: false,
        redirectUrl: window.location.origin + '/swap'
      });
      xummAuth.on('error', function(){
        el.connectStatus.textContent = 'ERR://L0G!N AB0RTED';
        el.connectScyllaBtn.disabled = false;
      });
      xummAuth.on('success', function(){
        xummAuth.state().then(function(authState){
          var jwt = authState && authState.jwt;
          if (!jwt){
            el.connectStatus.textContent = 'ERR://N0 WALLET DATA';
            el.connectScyllaBtn.disabled = false;
            return;
          }
          fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jwt: jwt })
          }).then(function(r){ return r.json(); }).then(function(data){
            if (data.ok){
              window.location.href = '/swap?connected=1';
            } else {
              el.connectStatus.textContent = 'ERR://C0NNECT!0N FA!LED';
              el.connectScyllaBtn.disabled = false;
            }
          }).catch(function(){
            el.connectStatus.textContent = 'ERR://S!GNAL_L0ST';
            el.connectScyllaBtn.disabled = false;
          });
        });
      });
    }
    return xummAuth;
  }
  if (el.connectScyllaBtn){
    getXummAuth(); // picks up a pending mobile return-from-Xaman redirect automatically
    el.connectScyllaBtn.addEventListener('click', function(){
      el.connectScyllaBtn.disabled = true;
      el.connectStatus.textContent = '';
      getXummAuth().authorize();
    });
  }

  // ---- LIST A PIGEON — first real Σκύλλα listing test: create-offer
  // only. No buyer/acceptance flow, no Σκύλλα fee yet (see HANDOFF.md). ----
  var listingTarget = null; // { nftId, number, image, priceValue } — the pigeon currently being listed
  var listingUuid = null;
  var listingPollTimer = null;

  function listingErrorMessage(code){
    var messages = {
      not_configured: '$P!GE0NS L!ST!NGS ARE N0T C0NF!GURED YET.',
      xaman_not_configured: 'XAMAN S!GN!NG !S N0T C0NF!GURED YET.',
      not_owned: 'TH!S WALLET D0ES N0T 0WN TH!S P!GE0N.',
      not_transferable: 'TH!S P!GE0N !S N0T TRANSFERABLE.',
      not_a_pigeon: 'N0T A VAL!D P!GE0N NFT.',
      invalid_price: 'ENTER A VAL!D PR!CE GREATER THAN 0.',
      no_session: 'C0NNECT Y0UR WALLET F!RST.',
      invalid_session: 'S!GNAL EXP!RED — REC0NNECT Y0UR WALLET.',
      not_listed: 'TH!S P!GE0N !S N0T CURRENTLY L!STED.',
      cannot_buy_own_listing: 'Y0U CAN\\'T BUY Y0UR 0WN L!ST!NG.',
      not_listed_by_you: 'TH!S P!GE0N !SN\\'T L!STED BY Y0UR WALLET.',
      lookup_failed: 'S!GNAL !NTERFERENCE — C0ULDN\\'T VER!FY THE L!ST!NG. TRY AGA!N.',
      invalid_to_wallet: 'TARGET WALLET ADDRESS !S!NVAL!D.',
      cannot_swap_with_self: 'Y0U CAN\\'T SWAP W!TH Y0UR 0WN WALLET.',
      xaman_request_failed: 'C0ULDN\\'T REACH XAMAN — TRY AGA!N.'
    };
    return (code && messages[code]) || 'ERR://C0ULD N0T PREPARE THE TRANSACT!0N.';
  }

  function openListForm(p){
    listingTarget = p;
    el.listFormPigeonNum.textContent = 'P!GE0N #' + (p.number !== null ? p.number : '????');
    el.listFormImg.innerHTML = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="">' : '[ IMAGE ]';
    el.listPriceInput.value = '';
    el.listFormError.style.display = 'none';
    el.listFormSubmitBtn.disabled = false;
    el.listFormSubmitBtn.textContent = '[ CREATE L!ST!NG ]';
    showScreen('listform');
  }
  el.listFormBackBtn.addEventListener('click', function(){ showScreen('browse'); });

  el.listFormSubmitBtn.addEventListener('click', function(){
    if (!listingTarget) return;
    var priceValue = el.listPriceInput.value.trim();
    if (!priceValue || isNaN(Number(priceValue)) || Number(priceValue) <= 0){
      el.listFormError.textContent = 'ENTER A VAL!D PR!CE GREATER THAN 0.';
      el.listFormError.style.display = '';
      return;
    }
    el.listFormError.style.display = 'none';
    el.listFormSubmitBtn.disabled = true;
    el.listFormSubmitBtn.textContent = '[ VAL!DAT!NG... ]';
    fetch('/api/swap-listing-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: listingTarget.nftId, priceValue: priceValue })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      el.listFormSubmitBtn.disabled = false;
      el.listFormSubmitBtn.textContent = '[ CREATE L!ST!NG ]';
      if (!res.ok || !res.data.ok){
        el.listFormError.textContent = listingErrorMessage(res.data && res.data.error);
        el.listFormError.style.display = '';
        return;
      }
      listingTarget.priceValue = priceValue;
      showListingConfirm(res.data.txjson);
    }).catch(function(){
      el.listFormSubmitBtn.disabled = false;
      el.listFormSubmitBtn.textContent = '[ CREATE L!ST!NG ]';
      el.listFormError.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
      el.listFormError.style.display = '';
    });
  });

  function showListingConfirm(txjson){
    el.confTxType.textContent = txjson.TransactionType;
    el.confAccount.textContent = txjson.Account;
    el.confNftId.textContent = txjson.NFTokenID;
    el.confCurrency.textContent = txjson.Amount.currency;
    el.confIssuer.textContent = txjson.Amount.issuer;
    el.confValue.textContent = txjson.Amount.value;
    el.confFlags.textContent = String(txjson.Flags);
    el.confirmStatus.textContent = '';
    el.openXamanBtn.disabled = false;
    el.openXamanBtn.textContent = '[ 0PEN XAMAN ]';
    showScreen('listconfirm');
  }
  el.listConfirmBackBtn.addEventListener('click', function(){ showScreen('listform'); });

  el.openXamanBtn.addEventListener('click', function(){
    if (!listingTarget) return;
    el.openXamanBtn.disabled = true;
    el.openXamanBtn.textContent = '[ REQUEST!NG... ]';
    el.confirmStatus.textContent = '';
    fetch('/api/swap-listing-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: listingTarget.nftId, priceValue: listingTarget.priceValue })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        el.openXamanBtn.disabled = false;
        el.openXamanBtn.textContent = '[ 0PEN XAMAN ]';
        el.confirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      listingUuid = res.data.uuid;
      window.open(res.data.next.always, '_blank', 'noopener');
      el.openXamanBtn.textContent = '[ WA!T!NG F0R S!GNATURE... ]';
      el.confirmStatus.textContent = 'S!GN !N XAMAN, THEN RETURN HERE.';
      pollListingStatus();
    }).catch(function(){
      el.openXamanBtn.disabled = false;
      el.openXamanBtn.textContent = '[ 0PEN XAMAN ]';
      el.confirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });

  function pollListingStatus(){
    if (listingPollTimer) clearTimeout(listingPollTimer);
    if (!listingUuid || !listingTarget) return;
    fetch('/api/swap-listing-status?uuid=' + encodeURIComponent(listingUuid) + '&nftId=' + encodeURIComponent(listingTarget.nftId))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'listed'){
          myListedData[listingTarget.nftId] = { price: data.price, currency: data.currency, offerId: data.offerId };
          showListingResult(data);
          return;
        }
        if (data.status === 'rejected'){
          el.confirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.openXamanBtn.disabled = false;
          el.openXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        if (data.status === 'expired'){
          el.confirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.openXamanBtn.disabled = false;
          el.openXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        if (data.status === 'failed'){
          el.confirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.openXamanBtn.disabled = false;
          el.openXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        // 'pending' or 'signed_pending_ledger' — keep polling.
        listingPollTimer = setTimeout(pollListingStatus, 2000);
      }).catch(function(){
        listingPollTimer = setTimeout(pollListingStatus, 3000);
      });
  }

  function showListingResult(data){
    el.listResultPigeonNum.textContent = 'P!GE0N #' + (listingTarget.number !== null ? listingTarget.number : '????');
    el.listResultPrice.textContent = data.price + ' $P!GE0NS';
    el.listResultStatus.textContent = 'L!STED';
    el.listResultOfferId.textContent = data.offerId || '—';
    if (data.txHash){
      el.listResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.listResultTxLink.textContent = data.txHash;
    } else {
      el.listResultTxLink.removeAttribute('href');
      el.listResultTxLink.textContent = '—';
    }
    showScreen('listresult');
  }
  el.listResultDoneBtn.addEventListener('click', function(){
    listingTarget = null;
    listingUuid = null;
    if (listingPollTimer) clearTimeout(listingPollTimer);
    renderMyPigeonsList();
    state.activeTab = 'mypigeons';
    showScreen('browse');
  });

  // ---- BUY — Σκύλλα SWAP phase 2: NFTokenAcceptOffer against a real,
  // live sell offer. No fee, no negotiation — LIST -> BUY -> SETTLE only. ----
  var buyTarget = null; // { nftId, number, image } — the pigeon currently being bought
  var buyUuid = null;
  var buyPollTimer = null;

  function openBuyConfirm(p, retriesLeft){
    buyTarget = p;
    if (retriesLeft === undefined) retriesLeft = 1;
    fetch('/api/swap-buy-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: p.nftId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      // lookup_failed means the XRPL check itself couldn't complete
      // (e.g. rate-limited) — genuinely retryable, unlike "not listed"
      // which is a real answer. One silent client-side retry before
      // bothering the user.
      if (!res.ok && res.data && res.data.error === 'lookup_failed' && retriesLeft > 0){
        setTimeout(function(){ openBuyConfirm(p, retriesLeft - 1); }, 500);
        return;
      }
      if (!res.ok || !res.data.ok){
        var rawCode = (res.data && res.data.error) || 'n0_b0dy';
        alert(listingErrorMessage(res.data && res.data.error) + '\\n\\n[ D!AGN0ST!C :: HTTP ' + (res.ok ? 200 : 'ERR') + ' :: ' + rawCode + ' ]');
        buyTarget = null;
        return;
      }
      var txjson = res.data.txjson;
      var display = res.data.display;
      el.buyConfTxType.textContent = txjson.TransactionType;
      el.buyConfAccount.textContent = txjson.Account;
      el.buyConfOfferId.textContent = txjson.NFTokenSellOffer;
      el.buyConfPigeon.textContent = 'P!GE0N #' + (p.number !== null ? p.number : '????');
      el.buyConfSeller.textContent = display.seller;
      el.buyConfPrice.textContent = display.price + ' $P!GE0NS';
      el.buyConfirmStatus.textContent = '';
      el.buyOpenXamanBtn.disabled = false;
      el.buyOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
      showScreen('buyconfirm');
    }).catch(function(e){
      alert('ERR://S!GNAL_L0ST — TRY AGA!N.\\n\\n[ D!AGN0ST!C :: ' + (e && e.message ? e.message : String(e)) + ' ]');
      buyTarget = null;
    });
  }
  el.buyConfirmBackBtn.addEventListener('click', function(){
    buyTarget = null;
    showScreen('browse');
  });

  function submitBuyPayload(retriesLeft){
    if (retriesLeft === undefined) retriesLeft = 1;
    fetch('/api/swap-buy-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: buyTarget.nftId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok && res.data && res.data.error === 'lookup_failed' && retriesLeft > 0){
        setTimeout(function(){ submitBuyPayload(retriesLeft - 1); }, 500);
        return;
      }
      if (!res.ok || !res.data.ok){
        el.buyOpenXamanBtn.disabled = false;
        el.buyOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
        var rawCode2 = (res.data && res.data.error) || 'n0_b0dy';
        el.buyConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error) + ' [ ' + rawCode2 + ' ]';
        return;
      }
      buyUuid = res.data.uuid;
      window.open(res.data.next.always, '_blank', 'noopener');
      el.buyOpenXamanBtn.textContent = '[ WA!T!NG F0R S!GNATURE... ]';
      el.buyConfirmStatus.textContent = 'S!GN !N XAMAN, THEN RETURN HERE.';
      pollBuyStatus();
    }).catch(function(e){
      el.buyOpenXamanBtn.disabled = false;
      el.buyOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
      el.buyConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N. [ ' + (e && e.message ? e.message : String(e)) + ' ]';
    });
  }
  el.buyOpenXamanBtn.addEventListener('click', function(){
    if (!buyTarget) return;
    el.buyOpenXamanBtn.disabled = true;
    el.buyOpenXamanBtn.textContent = '[ REQUEST!NG... ]';
    el.buyConfirmStatus.textContent = '';
    submitBuyPayload();
  });

  function pollBuyStatus(){
    if (buyPollTimer) clearTimeout(buyPollTimer);
    if (!buyUuid || !buyTarget) return;
    fetch('/api/swap-buy-status?uuid=' + encodeURIComponent(buyUuid) + '&nftId=' + encodeURIComponent(buyTarget.nftId))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'settled'){ showBuyResult(data); return; }
        if (data.status === 'rejected'){
          el.buyConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.buyOpenXamanBtn.disabled = false;
          el.buyOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        if (data.status === 'expired'){
          el.buyConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.buyOpenXamanBtn.disabled = false;
          el.buyOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        if (data.status === 'failed'){
          el.buyConfirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.buyOpenXamanBtn.disabled = false;
          el.buyOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        buyPollTimer = setTimeout(pollBuyStatus, 2000);
      }).catch(function(){
        buyPollTimer = setTimeout(pollBuyStatus, 3000);
      });
  }

  function showBuyResult(data){
    el.buyResultPigeonNum.textContent = 'P!GE0N #' + (buyTarget.number !== null ? buyTarget.number : '????');
    el.buyResultPrice.textContent = el.buyConfPrice.textContent;
    el.buyResultStatus.textContent = 'SETTLED';
    if (data.txHash){
      el.buyResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.buyResultTxLink.textContent = data.txHash;
    } else {
      el.buyResultTxLink.removeAttribute('href');
      el.buyResultTxLink.textContent = '—';
    }
    showScreen('buyresult');
  }
  el.buyResultDoneBtn.addEventListener('click', function(){
    buyTarget = null;
    buyUuid = null;
    if (buyPollTimer) clearTimeout(buyPollTimer);
    state.activeTab = 'database';
    showScreen('browse');
    runQuery(); // refreshes the LISTED grid so the now-sold Pigeon disappears
  });

  // ---- DELIST — Σκύλλα SWAP phase 2: NFTokenCancelOffer for the seller's
  // own active offer. ----
  var delistTarget = null; // { nftId, number, image }
  var delistUuid = null;
  var delistPollTimer = null;

  function openDelistConfirm(p){
    delistTarget = p;
    fetch('/api/swap-delist-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: p.nftId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        alert(listingErrorMessage(res.data && res.data.error));
        delistTarget = null;
        return;
      }
      var txjson = res.data.txjson;
      el.delistConfTxType.textContent = txjson.TransactionType;
      el.delistConfAccount.textContent = txjson.Account;
      el.delistConfOfferId.textContent = txjson.NFTokenOffers.join(', ');
      el.delistConfPigeon.textContent = 'P!GE0N #' + (p.number !== null ? p.number : '????');
      el.delistConfirmStatus.textContent = '';
      el.delistOpenXamanBtn.disabled = false;
      el.delistOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
      showScreen('delistconfirm');
    }).catch(function(){
      alert('ERR://S!GNAL_L0ST — TRY AGA!N.');
      delistTarget = null;
    });
  }
  el.delistConfirmBackBtn.addEventListener('click', function(){
    delistTarget = null;
    showScreen('browse');
  });

  el.delistOpenXamanBtn.addEventListener('click', function(){
    if (!delistTarget) return;
    el.delistOpenXamanBtn.disabled = true;
    el.delistOpenXamanBtn.textContent = '[ REQUEST!NG... ]';
    el.delistConfirmStatus.textContent = '';
    fetch('/api/swap-delist-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: delistTarget.nftId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        el.delistOpenXamanBtn.disabled = false;
        el.delistOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
        el.delistConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      delistUuid = res.data.uuid;
      window.open(res.data.next.always, '_blank', 'noopener');
      el.delistOpenXamanBtn.textContent = '[ WA!T!NG F0R S!GNATURE... ]';
      el.delistConfirmStatus.textContent = 'S!GN !N XAMAN, THEN RETURN HERE.';
      pollDelistStatus();
    }).catch(function(){
      el.delistOpenXamanBtn.disabled = false;
      el.delistOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
      el.delistConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });

  function pollDelistStatus(){
    if (delistPollTimer) clearTimeout(delistPollTimer);
    if (!delistUuid || !delistTarget) return;
    fetch('/api/swap-delist-status?uuid=' + encodeURIComponent(delistUuid) + '&nftId=' + encodeURIComponent(delistTarget.nftId))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'delisted'){ showDelistResult(data); return; }
        if (data.status === 'rejected'){
          el.delistConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.delistOpenXamanBtn.disabled = false;
          el.delistOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        if (data.status === 'expired'){
          el.delistConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.delistOpenXamanBtn.disabled = false;
          el.delistOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        if (data.status === 'failed'){
          el.delistConfirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.delistOpenXamanBtn.disabled = false;
          el.delistOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
          return;
        }
        delistPollTimer = setTimeout(pollDelistStatus, 2000);
      }).catch(function(){
        delistPollTimer = setTimeout(pollDelistStatus, 3000);
      });
  }

  function showDelistResult(data){
    el.delistResultPigeonNum.textContent = 'P!GE0N #' + (delistTarget.number !== null ? delistTarget.number : '????');
    el.delistResultStatus.textContent = 'DEL!STED';
    if (data.txHash){
      el.delistResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.delistResultTxLink.textContent = data.txHash;
    } else {
      el.delistResultTxLink.removeAttribute('href');
      el.delistResultTxLink.textContent = '—';
    }
    showScreen('delistresult');
  }
  el.delistResultDoneBtn.addEventListener('click', function(){
    if (delistTarget) delete myListedData[delistTarget.nftId];
    delistTarget = null;
    delistUuid = null;
    if (delistPollTimer) clearTimeout(delistPollTimer);
    renderMyPigeonsList();
    state.activeTab = 'mypigeons';
    showScreen('browse');
  });

  // ---- DATABASE selector — multi-collection groundwork; only PIGEONS is
  // live, FUZZY/PHNIX are inert placeholders. ----
  el.dbSelectToggle.addEventListener('click', function(){
    el.dbSelectMenu.style.display = el.dbSelectMenu.style.display === 'none' ? '' : 'none';
  });
  el.dbSelectMenu.addEventListener('click', function(){
    el.dbSelectMenu.style.display = 'none';
  });

  // Copy-to-clipboard, not a real TrustSet flow — this prototype doesn't
  // connect a wallet or sign anything yet (same pattern already used for
  // the CRWN trustline address elsewhere on the site).
  el.copyIssuerBtn.addEventListener('click', function(){
    var addr = el.ciIssuerAddr ? el.ciIssuerAddr.textContent : '';
    var done = function(){
      var original = el.copyIssuerBtn.textContent;
      el.copyIssuerBtn.textContent = '[ C0P!ED ]';
      setTimeout(function(){ el.copyIssuerBtn.textContent = original; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr).then(done, done);
    else done();
  });

  // ---- Sales history (real, collection-wide, infinite scroll) ----
  function saleRowHtml(s){
    var thumb = s.image ? '<img src="' + escapeHtml(s.image) + '" alt="" loading="lazy">' : '';
    var num = s.number !== null ? '#' + s.number : '#????';
    var price = s.currency === 'PIGEONS'
      ? (s.pigeonsPrice !== null && s.pigeonsPrice !== undefined ? s.pigeonsPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' $P!GE0NS' : '?')
      : (s.priceXrp !== null ? s.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP' : '?');
    var via = s.via === 'scylla' ? 'Σ SWAP' : (s.via === 'deeptide' ? 'DEEPT!DE' : '');
    var when = s.createdAt ? new Date(s.createdAt).toLocaleString() : '';
    return '<div class="sale-row">' +
      '<div class="sale-thumb-wrap">' +
        '<div class="sale-num-box" data-nftid="' + escapeHtml(s.nftId) + '">P!GE0N ' + num + '</div>' +
        '<div class="sale-thumb" data-nftid="' + escapeHtml(s.nftId) + '">' + thumb + '</div>' +
      '</div>' +
      '<div class="sale-info">' +
        '<div class="sale-price">' + price + (via ? ' <span class="sale-via">· ' + via + '</span>' : '') + '</div>' +
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
  // Rooted at the scrollbox itself (not the viewport) so it fires on
  // scrolling *within* the box, not the page.
  var salesScrollObserver = new IntersectionObserver(function(entries){
    if (entries[0].isIntersecting) loadMoreSales();
  }, { root: el.salesScrollBox, rootMargin: '200px' });
  salesScrollObserver.observe(el.salesScrollSentinel);

  el.searchBtn.addEventListener('click', runSearchBox);
  el.searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') runSearchBox(); });
  // ---- SORT — same two-level hover flyout as TRAITS: hover a category
  // (Alphabetical / Listings / Sales / Rarity), scroll its value list,
  // click one to sort by it. Single pick, same as the original dropdown —
  // just presented the same way TRAITS is instead of a native <select>.
  var SORT_CATEGORIES = {
    'ALPHABET!CAL': [
      { value: 'NAME_ASC', label: 'A → Z' },
      { value: 'NAME_DESC', label: 'Z → A' }
    ],
    'L!ST!NGS': [
      { value: 'PRICE_ASC', label: 'L0WEST' },
      { value: 'PRICE_DESC', label: 'H!GHEST' },
      { value: 'SCYLLA_PRICE_ASC', label: '$P!GE0NS L0WEST' },
      { value: 'SCYLLA_PRICE_DESC', label: '$P!GE0NS H!GHEST' }
    ],
    'H!ST0R!CAL SALES': [
      { value: 'HIGHEST_SALE', label: 'H!GHEST REC0RDED SALES' },
      { value: 'AVG_SALE_ASC', label: 'L0WEST (AVERAGE)' }
    ],
    'RAR!TY': [
      { value: 'RARITY_ASC', label: 'H!GHEST' },
      { value: 'RARITY_DESC', label: 'L0WEST' }
    ]
  };
  function sortCategoryOf(value){
    for (var cat in SORT_CATEGORIES){
      if (SORT_CATEGORIES[cat].some(function(o){ return o.value === value; })) return cat;
    }
    return null;
  }
  function sortLabelOf(value){
    var cat = sortCategoryOf(value);
    if (!cat) return value;
    var found = SORT_CATEGORIES[cat].filter(function(o){ return o.value === value; })[0];
    return cat + ' :: ' + (found ? found.label : value);
  }
  function renderSortDropLabel(){
    el.sortDropLabel.textContent = 'S0RT :: ' + sortLabelOf(state.sort) + ' ▾';
  }
  function renderSortFlyoutCats(){
    el.sortFlyoutCats.innerHTML = Object.keys(SORT_CATEGORIES).map(function(c){
      return '<button type="button" class="traits-flyout-cat" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c) + '</button>';
    }).join('');
  }
  function renderSortFlyoutVals(category){
    el.sortFlyoutCats.querySelectorAll('.traits-flyout-cat').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-cat') === category);
    });
    var opts = SORT_CATEGORIES[category] || [];
    el.sortFlyoutVals.innerHTML = opts.map(function(o){
      return '<button type="button" class="traits-flyout-val' + (state.sort === o.value ? ' selected' : '') + '" data-value="' + o.value + '">' +
        '<span>' + escapeHtml(o.label) + '</span>' +
      '</button>';
    }).join('');
  }
  function openSortFlyout(){
    renderSortFlyoutCats();
    renderSortFlyoutVals(sortCategoryOf(state.sort) || Object.keys(SORT_CATEGORIES)[0]);
    el.sortFlyout.style.display = 'flex';
    el.sortDropWrap.classList.add('open');
  }
  function closeSortFlyout(){
    el.sortFlyout.style.display = 'none';
    el.sortDropWrap.classList.remove('open');
  }
  function applySort(value){
    state.sort = value;
    renderSortDropLabel();
    var isScyllaSort = value === 'SCYLLA_PRICE_ASC' || value === 'SCYLLA_PRICE_DESC';
    if (isScyllaSort){
      setScyllaListedOnly(true); // also runs the query
      return;
    }
    if (state.scyllaListedOnly){
      setScyllaListedOnly(false); // also runs the query
      return;
    }
    runQuery();
  }
  el.sortDropWrap.addEventListener('mouseenter', openSortFlyout);
  el.sortDropWrap.addEventListener('mouseleave', closeSortFlyout);
  el.sortDropLabel.addEventListener('click', function(){
    if (el.sortFlyout.style.display === 'flex') closeSortFlyout();
    else openSortFlyout();
  });
  el.sortFlyoutCats.addEventListener('mouseover', function(e){
    var catBtn = e.target.closest('.traits-flyout-cat');
    if (catBtn) renderSortFlyoutVals(catBtn.getAttribute('data-cat'));
  });
  el.sortFlyoutCats.addEventListener('click', function(e){
    var catBtn = e.target.closest('.traits-flyout-cat');
    if (catBtn) renderSortFlyoutVals(catBtn.getAttribute('data-cat'));
  });
  el.sortFlyoutVals.addEventListener('click', function(e){
    var valBtn = e.target.closest('.traits-flyout-val');
    if (!valBtn) return;
    applySort(valBtn.getAttribute('data-value'));
    closeSortFlyout();
  });
  renderSortDropLabel();
  el.editionSelect.addEventListener('click', function(e){
    var btn = e.target.closest('.edition-btn');
    if (!btn) return;
    state.edition = btn.getAttribute('data-value');
    el.editionSelect.querySelectorAll('.edition-btn').forEach(function(b){
      b.classList.toggle('active', b === btn);
    });
    runQuery();
  });

  // ---- Inspect / detail ----
  function traitCellHtml(a){
    var sub = (a.percent !== null && a.percent !== undefined)
      ? '<div class="tc-sub">' + (typeof a.percent === 'number' ? a.percent.toFixed(3) : a.percent) + '%' + (a.count !== null && a.count !== undefined ? '<br>(' + a.count + ')' : '') + '</div>'
      : '';
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
    if (p && p.avgSaleXrp !== null && p.avgSaleXrp !== undefined){
      el.detailAvgSaleRow.style.display = '';
      el.detailAvgSale.textContent = p.avgSaleXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP' + (p.saleCount ? ' (' + p.saleCount + ' SALES)' : '');
    } else {
      el.detailAvgSaleRow.style.display = 'none';
    }
  }
  // The real $PIGEONS-denominated Σκύλλα marketplace listing (separate
  // from the DEEPTIDE/XRP.CAFE rows above, which are always XRP) — never
  // buyable via a plain link, so this is a button into the same
  // openBuyConfirm flow the DATABASE cards' [ BUY ] button uses.
  el.detailScyllaBuyBtn.addEventListener('click', function(){
    if (state.currentDetail) openBuyConfirm(state.currentDetail);
  });
  function updateScyllaListing(p){
    var listing = p && p.scyllaListing;
    if (listing && listing.price !== null && listing.price !== undefined){
      el.detailScyllaPrice.textContent = listing.price + ' $P!GE0NS';
      el.detailScyllaBuyBtn.style.display = p.owner !== MY_WALLET ? '' : 'none';
    } else {
      el.detailScyllaPrice.textContent = 'N0T L!STED';
      el.detailScyllaBuyBtn.style.display = 'none';
    }
  }
  // Same DEEPTIDE/XRP.CAFE clickable-box component the DATABASE cards use
  // (listingBlockHtml), side by side directly under the big image —
  // instead of the old stacked market/price/buy-link rows.
  function updateDetailListings(listings){
    el.detailListingsRow.innerHTML = listingBlockHtml('XRP.CAFE', listings && listings.xrpCafe) + listingBlockHtml('DEEPT!DE', listings && listings.deeptide);
  }
  function findKnown(nftId){
    return state.items.filter(function(p){ return p.nftId === nftId; })[0] ||
      state.scopeAllItems.filter(function(p){ return p.nftId === nftId; })[0];
  }
  // ---- Per-Pigeon history (mint/transfer/sale events, real, straight from
  // Deeptide's per-token history endpoint) ----
  function walletLinkHtml(full, short){
    if (!full) return '';
    return '<a data-wallet="' + escapeHtml(full) + '" data-short="' + escapeHtml(short || full) + '">' + escapeHtml(short || full) + '</a>';
  }
  // Reads as a plain sentence per event — SOLD FOR x XRP TO wallet,
  // TRANSFERRED TO wallet, MINTED BY wallet — instead of a cramped data
  // table. Deeptide's history is newest-first, so MINTED BY naturally
  // lands last without any re-sorting.
  function historyRowHtml(e){
    var line;
    if (e.type === 'sale'){
      var price = e.priceXrp !== null && e.priceXrp !== undefined
        ? '<span class="dh-price">' + e.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP</span>' : '?';
      line = '<span class="dh-verb">S0LD</span> F0R ' + price + (e.buyer ? ' T0 ' + walletLinkHtml(e.buyer, e.buyerShort) : '');
    } else if (e.type === 'mint'){
      line = '<span class="dh-verb">M!NTED</span> BY ' + (e.account ? walletLinkHtml(e.account, e.accountShort) : '?');
    } else {
      line = '<span class="dh-verb">TRANSFERRED</span> T0 ' + (e.receiver ? walletLinkHtml(e.receiver, e.receiverShort) : '?');
    }
    var when = e.date ? new Date(e.date).toLocaleDateString() : '';
    var txLink = e.txUrl ? '<a class="dh-tx" href="' + escapeHtml(e.txUrl) + '" target="_blank" rel="noopener">[ TXN ]</a>' : '';
    return '<div class="dh-row">' +
      '<div class="dh-line">' + line + '</div>' +
      '<div class="dh-meta"><span class="dh-time">' + escapeHtml(when) + '</span>' + txLink + '</div>' +
    '</div>';
  }
  function loadDetailHistory(nftId){
    api({ history: nftId }).then(function(data){
      if (state.currentDetail && state.currentDetail.nftId !== nftId) return; // navigated away already
      var events = data.events || [];
      el.detailHistoryList.innerHTML = events.length
        ? events.map(historyRowHtml).join('')
        : '<div class="th-empty">N0 H!ST0RY YET.</div>';
    }).catch(function(){
      el.detailHistoryList.innerHTML = '<div class="th-empty">C0ULD N0T L0AD H!ST0RY.</div>';
    });
  }
  el.detailHistoryList.addEventListener('click', function(e){
    var walletLink = e.target.closest('.dh-parties a[data-wallet]');
    if (walletLink) browseOwnerCollection(walletLink.getAttribute('data-wallet'), walletLink.getAttribute('data-short'));
  });

  function openDetail(nftId){
    var known = findKnown(nftId);
    el.detailNum.textContent = known && known.number !== null ? 'P!GE0N #' + known.number : 'P!GE0N ...';
    el.detailImgBox.innerHTML = known && known.image ? '<img src="' + escapeHtml(known.image) + '" alt="">' : '[ IMAGE ]';
    if (known && known.owner) renderOwnerLink(known.ownerShort, known.owner);
    else { el.detailOwner.textContent = '...'; el.detailOwner.classList.remove('not-indexed'); }
    el.detailTraits.innerHTML = known ? known.attributes.map(traitCellHtml).join('') : '';
    el.viewDeeptideLink.href = 'https://deeptide.co/nft/' + nftId;
    el.viewXrpCafeLink.href = 'https://xrp.cafe/nft/' + nftId;
    el.viewBithompLink.href = 'https://bithomp.com/explorer/' + nftId;
    el.detailHistoryList.innerHTML = '<div class="th-empty">L0AD!NG...</div>';
    updateDetailRarity(known);
    updateDetailPrice(known);
    updateDetailListings(known && known.listings);
    updateScyllaListing(known);
    state.currentDetail = known || { nftId: nftId, number: null, owner: null, ownerShort: null, attributes: [] };
    showScreen('detail');
    refreshCardSelectionStates();
    loadDetailHistory(nftId);

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
      updateDetailListings(p.listings);
      updateScyllaListing(p);
      renderOwnerLink(p.ownerShort, p.owner);
      refreshCardSelectionStates();
    }).catch(function(){
      renderOwnerLink(null, null);
    });
  }
  // Sales history now swaps out the whole panel (SCREEN 2b) instead of
  // expanding inline underneath the traits — detailHistoryList itself
  // already lives inside screenHistory and is populated by openDetail's
  // eager loadDetailHistory() call, so there's nothing left to fetch here.
  el.detailHistoryToggle.addEventListener('click', function(){
    el.historyNum.textContent = el.detailNum.textContent;
    showScreen('history');
  });
  el.backToDetailBtn.addEventListener('click', function(){ showScreen('detail'); });
  el.backToBrowseBtn.addEventListener('click', function(){ showScreen('browse'); });
  el.detailSelectBtn.addEventListener('click', function(){
    if (state.currentDetail) handleSelect(state.currentDetail);
  });

  // ---- Collection-wide stats strip (items/holders real from our own
  // ledger scan; floor from BOTH marketplaces separately since each has
  // its own liquidity; volume/listed% from xrp.cafe's own stats API) ----
  function fmtXrp(n){ return n === null || n === undefined ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 }); }
  function loadCollectionStats(){
    api({ stats: 1 }).then(function(data){
      el.statItems.textContent = data.items !== null && data.items !== undefined ? data.items.toLocaleString() : '—';
      el.statHolders.textContent = data.holders !== null && data.holders !== undefined ? data.holders.toLocaleString() : '—';
      el.statVolume.textContent = data.totalVolumeXrp !== null && data.totalVolumeXrp !== undefined ? fmtXrp(data.totalVolumeXrp) + ' XRP' : '—';
      el.statListed.textContent = data.listedPercent !== null && data.listedPercent !== undefined ? data.listedPercent + '%' : '—';
      el.statFloorDeeptide.textContent = data.deeptideFloorXrp !== null && data.deeptideFloorXrp !== undefined ? fmtXrp(data.deeptideFloorXrp) + ' XRP' : '—';
      el.statFloorXrpCafe.textContent = data.xrpCafeFloorXrp !== null && data.xrpCafeFloorXrp !== undefined ? fmtXrp(data.xrpCafeFloorXrp) + ' XRP' : '—';
      if (data.deeptideBuyUrl) el.statFloorDeeptideTile.href = data.deeptideBuyUrl;
      if (data.xrpCafeUrl) el.statFloorXrpCafeTile.href = data.xrpCafeUrl;
      el.statScyllaListedCount.textContent = data.scyllaListedCount !== null && data.scyllaListedCount !== undefined ? data.scyllaListedCount.toLocaleString() : '—';
    }).catch(function(){});
  }

  // ---- Σκύλλα LISTED filter — toggled from the stat tile, or implicitly
  // by picking a $PIGEONS sort option (the only sort that means anything
  // in this view). Whole-collection only, per its own scope — exits any
  // target-wallet scope first. ----
  function setScyllaListedOnly(on){
    state.scyllaListedOnly = on;
    el.statScyllaListedTile.classList.toggle('scylla-active', on);
    if (on){
      if (state.sort !== 'SCYLLA_PRICE_ASC' && state.sort !== 'SCYLLA_PRICE_DESC'){
        // Highest-first is the default entry into LISTED — the main
        // attraction of the site, not a niche filter.
        state.sort = 'SCYLLA_PRICE_DESC';
        renderSortDropLabel();
      }
      if (state.scope){
        state.scope = null;
        state.scopeAllItems = [];
        state.targetAssets = {};
        el.nodeHeaderPanel.style.display = 'none';
        el.searchPanelTitle.textContent = 'P!GE0N DATABASE';
        renderTradeBuilder();
      }
    } else if (state.sort === 'SCYLLA_PRICE_ASC' || state.sort === 'SCYLLA_PRICE_DESC'){
      state.sort = 'RARITY_ASC';
      renderSortDropLabel();
    }
    runQuery();
  }
  el.statScyllaListedTile.addEventListener('click', function(){
    setScyllaListedOnly(!state.scyllaListedOnly);
  });

  // ---- Initial load ----
  // The trade builder's 4+4 empty slots are only ever drawn by
  // renderTradeBuilder(), which every other call site reaches through a
  // state change (adding/removing a Pigeon, entering/exiting a scope) —
  // on a fresh page load none of those have fired yet, so without this
  // call the piles start out completely empty instead of showing slots.
  renderTradeBuilder();

  if (!SWAP_BUILDER_ENABLED){
    el.tradeBuilderPanel.style.display = 'none';
    el.swapOffersTabBtn.style.display = 'none';
  }

  // Nothing loads until a tab is chosen — see showTab() — except a return
  // from the CONNECT SCYLLA redirect, which should land back on MY PIGEONS.
  if (window.location.search.indexOf('connected=1') !== -1){
    showTab('mypigeons');
  }

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
