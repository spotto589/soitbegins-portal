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
  .traits-block-title{
    font-size:11px;
    letter-spacing:0.2em;
    color:var(--grey);
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
    flex-wrap:wrap;
    align-content:flex-start;
    gap:0.4rem;
    width:100%;
    margin-top:0.5rem;
    max-height:190px;
    overflow-y:auto;
    padding:0.5rem;
    border:1px dashed var(--border-dim);
  }
  .trait-chip{
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:0.05em;
    padding:0.5em 0.75em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .trait-chip:hover{ border-color:var(--cyan-dim); color:var(--white); }
  .trait-chip.selected{ background:var(--cyan-faint); color:var(--cyan); border-color:var(--cyan); text-shadow:0 0 5px var(--cyan-glow); }
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
    border:1px solid var(--magenta-dim);
    color:var(--magenta);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.6em 1.1em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:background 0.15s ease;
  }
  .clear-traits-btn:hover{ background:var(--magenta-faint); }

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
  .card-select-toggle{
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
  .card-select-toggle:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  .card-select-toggle.selected{ background:var(--magenta); color:#08090b; border-color:var(--magenta); animation:flicker-in 0.3s ease-out; }

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
  .result-card-body{ padding:0.55rem 0.4rem; }
  .result-num{
    font-size:16px;
    font-weight:700;
    letter-spacing:0.03em;
    color:var(--white);
    text-align:center;
    padding:0.5rem 0.3rem;
    border-bottom:1px solid var(--border-dim);
    transition:color 0.15s ease;
  }
  .result-rarity-line{ font-size:13px; letter-spacing:0.03em; color:var(--grey); text-align:center; }
  .card-listings{ display:flex; gap:0.35rem; margin-top:0.4rem; }
  .cl-block{ flex:1; min-width:0; border:1px solid var(--border-dim); padding:0.4rem 0.25rem; text-align:center; }
  .cl-market{ font-size:8px; letter-spacing:0.08em; color:var(--grey-dim); text-transform:uppercase; margin-bottom:0.3rem; }
  .cl-price{ font-size:10px; letter-spacing:0.02em; color:var(--white); }
  .cl-price.cl-none{ color:var(--grey-disabled); font-size:9px; text-transform:uppercase; }
  .cl-buy{
    display:block;
    margin-top:0.35rem;
    font-size:9px;
    letter-spacing:0.08em;
    border:1px solid var(--border-mid);
    color:var(--grey);
    padding:0.3em 0;
    text-decoration:none;
    text-transform:uppercase;
    cursor:pointer;
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .cl-buy:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  .card-select-toggle{ width:1.9em; height:1.9em; line-height:1.9em; font-size:16px; }

  @media (max-width:700px){
    body{ padding:4vh 2.5vw 6vh; }
    .sw-panel{ padding:1rem 0.75rem; }
    /* 2-wide on mobile, not the desktop 6 — plenty of room per card now,
       so rarity stays visible instead of being dropped. */
    .result-grid{ grid-template-columns:repeat(2, 1fr); gap:0.6rem; }
    .result-card-body{ padding:0.5rem 0.4rem; }
    .result-num{ font-size:15px; padding:0.45rem 0.3rem; }
    .card-select-toggle{ width:1.7em; height:1.7em; line-height:1.7em; font-size:14px; }
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
  .detail-img-large{ width:100%; max-width:300px; margin:0 auto 1.25rem; border:1px solid var(--border-mid); }
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

      <div class="sw-panel sw-panel-target" id="nodeHeaderPanel" style="display:none;">
        <div class="node-eyebrow">// TARGET N0DE !DENT!F!ED</div>

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
          <div class="wallet-box-title">TARGET WALLET<br><span class="wallet-box-sub">// H0LDER N0DE</span></div>
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
          <select class="sort-select" id="editionSelect">
            <option value="ALL" selected>ALL (1-3015)</option>
            <option value="LOW">1ST ED!T!0N (1-1515)</option>
            <option value="HIGH">2ND ED!T!0N (1516-3015)</option>
          </select>
          <select class="sort-select" id="sortSelect">
            <option value="NAME_ASC">A → Z</option>
            <option value="PRICE_ASC">L0WEST L!ST!NG</option>
            <option value="PRICE_DESC">H!GHEST L!ST!NG</option>
            <option value="RARITY_ASC" selected>RAR!TY H!GH</option>
            <option value="RARITY_DESC">RAR!TY L0W</option>
            <option value="HIGHEST_SALE">SALES (H!GHEST)</option>
            <option value="SALES_LOW">SALES (L0WEST)</option>
            <option value="SCYLLA_PRICE_ASC">$P!GE0NS L0W → H!GH</option>
            <option value="SCYLLA_PRICE_DESC">$P!GE0NS H!GH → L0W</option>
            <option value="NAME_DESC">Z → A</option>
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
      <div class="detail-field" id="detailHighSaleRow" style="display:none;"><span class="df-label">REC0RD SALE</span><span class="df-value price" id="detailHighSale"></span></div>
      <div class="listings-block">
        <div class="tech-meta-title">L!ST!NGS</div>
        <div class="listing-row"><span class="listing-market">DEEPT!DE</span><span class="listing-price" id="listingDeeptidePrice">N0T L!STED</span><a class="listing-buy" id="listingDeeptideBuy" style="display:none;" target="_blank" rel="noopener">[ BUY ]</a></div>
        <div class="listing-row"><span class="listing-market">XRP.CAFE</span><span class="listing-price" id="listingXrpCafePrice">N0T L!STED</span><a class="listing-buy" id="listingXrpCafeBuy" style="display:none;" target="_blank" rel="noopener">[ BUY ]</a></div>
      </div>
      <div class="detail-traits-title">TRA!TS</div>
      <div class="trait-grid" id="detailTraits"></div>
      <div class="detail-history">
        <button class="th-toggle" id="detailHistoryToggle">[ P!GE0N H!ST0RY ▼ ]</button>
        <div class="th-list" id="detailHistoryList" style="display:none;"></div>
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
    scyllaListedOnly: false   // whole-collection LISTED filter — Pigeons listed through Scylla itself
  };

  var el = {};
  ['searchInput','searchBtn','editionSelect','sortSelect',
   'dbSelectToggle','dbSelectMenu','copyIssuerBtn','ciIssuerAddr',
   'topTabs','myPigeonsPanel','myPigeonsPanelTitle','myPigeonsList',
   'topHoldersPanelWrap','topHoldersList',
   'salesPanelWrap',
   'statItems','statHolders','statVolume','statListed','statFloorDeeptide','statFloorXrpCafe','statFloorDeeptideTile','statFloorXrpCafeTile',
   'statScyllaListedTile','statScyllaListedCount',
   'indexLine','traitRows','addTraitBtn','clearTraitsBtn',
   'statusLine','resultsArea','scrollSentinel','loadMoreNote','endOfCollectionNote',
   'salesScrollBox','salesArea','salesScrollSentinel','salesLoadMoreNote','salesEndNote',
   'nodeHeaderPanel','nodeAddr','nodeCount','backToFullCollectionLink','searchPanelTitle',
   'targetPigeonCard','targetPigeonImg','targetPigeonNum','targetPigeonOwner',
   'screenBrowse','screenDetail','screenSummary',
   'detailNum','detailImgBox','detailOwner','detailRarityRow','detailRarity','detailPriceRow','detailPrice','detailHighSaleRow','detailHighSale','detailBuyBtn','detailTraits',
   'detailHistoryToggle','detailHistoryList','viewDeeptideLink','viewXrpCafeLink','viewBithompLink',
   'listingDeeptidePrice','listingDeeptideBuy','listingXrpCafePrice','listingXrpCafeBuy',
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
    var buttons = el.topTabs.querySelectorAll('.tab-btn');
    for (var i = 0; i < buttons.length; i++){
      buttons[i].classList.toggle('active', buttons[i].getAttribute('data-tab') === tab);
    }
    // Nothing fetches until its tab is actually opened for the first time.
    // Σ SCYLLA LISTED, highest price first, is the default landing view —
    // the main attraction of the site, not the full 3015-item browse.
    if (tab === 'database' && !state.databaseLoaded){
      state.databaseLoaded = true;
      ensureTraitsLoaded();
      loadCollectionStats();
      setScyllaListedOnly(true);
    } else if (tab === 'mypigeons' && myPigeonsData === null){
      loadMyPigeons();
    } else if (tab === 'topholders' && topHoldersData === null){
      loadTopHolders();
    } else if (tab === 'sales' && !state.salesLoaded){
      state.salesLoaded = true;
      loadMoreSales();
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
    }
    el.screenDetail.style.display = name === 'detail' ? '' : 'none';
    el.screenSummary.style.display = name === 'summary' ? '' : 'none';
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
    browseOwnerCollection(targetPigeon.owner, targetPigeon.ownerShort, targetPigeon);
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
  function listingBlockHtml(marketLabel, listing){
    var hasPrice = listing && listing.priceXrp !== null && listing.priceXrp !== undefined;
    var priceHtml = hasPrice
      ? '<div class="cl-price">' + listing.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP</div>'
      : '<div class="cl-price cl-none">N0 L!ST!NG</div>';
    var buyHtml = hasPrice && listing.buyUrl
      ? '<a class="cl-buy" href="' + escapeHtml(listing.buyUrl) + '" target="_blank" rel="noopener">[ BUY ]</a>'
      : '';
    return '<div class="cl-block"><div class="cl-market">' + marketLabel + '</div>' + priceHtml + buyHtml + '</div>';
  }
  function resultCardHtml(p){
    var rarityLine = p.rarityRank ? '<div class="result-rarity-line">RAR!TY ' + p.rarityRank + '/' + (p.rarityTotal || 3015) + '</div>' : '';
    var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : '[ IMAGE ]';
    var num = p.number !== null ? '#' + p.number : '#????';
    var inTarget = !!state.targetAssets[p.nftId];
    var listingsHtml = p.listings
      ? '<div class="card-listings">' + listingBlockHtml('XRP.CAFE', p.listings.xrpCafe) + listingBlockHtml('DEEPT!DE', p.listings.deeptide) + '</div>'
      : '';
    var scyllaListedHtml = p.scyllaListing
      ? '<div class="card-scylla-listed">Σ L!STED :: ' + escapeHtml(p.scyllaListing.price) + ' $P!GE0NS</div>'
      : '';
    // BUY only in the LISTED view itself, and never for your own listing —
    // server enforces the real "not your own" check regardless.
    var buyHtml = (state.scyllaListedOnly && p.scyllaListing && p.owner !== MY_WALLET)
      ? '<button class="bar-btn buy-scylla-btn" data-nftid="' + escapeHtml(p.nftId) + '" style="width:100%; margin-top:0.4rem;">[ BUY ]</button>'
      : '';
    return '<div class="result-card' + (inTarget ? ' in-target' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '">' +
      '<div class="result-num">P!GE0N ' + num + '</div>' +
      '<div class="pigeon-img-box" data-nftid="' + escapeHtml(p.nftId) + '">' +
        img +
        '<button class="card-select-toggle' + (inTarget ? ' selected' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '" title="SELECT">' + (inTarget ? '✓' : '+') + '</button>' +
      '</div>' +
      '<div class="result-card-body">' +
        rarityLine +
        scyllaListedHtml +
        buyHtml +
        listingsHtml +
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
    var isSalesSort = state.sort === 'HIGHEST_SALE' || state.sort === 'SALES_LOW';
    var isNumericSort = state.sort === 'NAME_ASC' || state.sort === 'NAME_DESC';
    var isCrossListing = state.sort === 'PRICE_ASC' || state.sort === 'PRICE_DESC';
    var reqParams;
    if (state.scyllaListedOnly){
      // Only Pigeons actually listed through Scylla itself, sorted by real
      // $PIGEONS price — server re-verifies each item against real
      // nft_sell_offers, so a stale/cancelled listing can't linger here.
      reqParams = { skip: state.skip, limit: PAGE_SIZE, scyllaListed: 1, dir: state.sort === 'SCYLLA_PRICE_DESC' ? 'desc' : 'asc' };
    } else if (isSalesSort){
      reqParams = { skip: state.skip, limit: PAGE_SIZE, highestSale: 1, dir: state.sort === 'SALES_LOW' ? 'asc' : 'desc' };
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
    } else if (state.sort === 'HIGHEST_SALE' || state.sort === 'SALES_LOW'){
      list = list.slice().sort(function(a, b){
        var av = a.highSaleXrp === null || a.highSaleXrp === undefined ? -1 : a.highSaleXrp, bv = b.highSaleXrp === null || b.highSaleXrp === undefined ? -1 : b.highSaleXrp;
        return state.sort === 'SALES_LOW' ? av - bv : bv - av;
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
    return '<div class="result-card" data-nftid="' + escapeHtml(p.nftId) + '">' +
      '<div class="result-num">P!GE0N ' + num + '</div>' +
      '<div class="pigeon-img-box" data-nftid="' + escapeHtml(p.nftId) + '">' + img + '</div>' +
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
      not_listed_by_you: 'TH!S P!GE0N !SN\\'T L!STED BY Y0UR WALLET.'
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

  function openBuyConfirm(p){
    buyTarget = p;
    fetch('/api/swap-buy-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: p.nftId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        alert(listingErrorMessage(res.data && res.data.error));
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
    }).catch(function(){
      alert('ERR://S!GNAL_L0ST — TRY AGA!N.');
      buyTarget = null;
    });
  }
  el.buyConfirmBackBtn.addEventListener('click', function(){
    buyTarget = null;
    showScreen('browse');
  });

  el.buyOpenXamanBtn.addEventListener('click', function(){
    if (!buyTarget) return;
    el.buyOpenXamanBtn.disabled = true;
    el.buyOpenXamanBtn.textContent = '[ REQUEST!NG... ]';
    el.buyConfirmStatus.textContent = '';
    fetch('/api/swap-buy-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: buyTarget.nftId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        el.buyOpenXamanBtn.disabled = false;
        el.buyOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
        el.buyConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      buyUuid = res.data.uuid;
      window.open(res.data.next.always, '_blank', 'noopener');
      el.buyOpenXamanBtn.textContent = '[ WA!T!NG F0R S!GNATURE... ]';
      el.buyConfirmStatus.textContent = 'S!GN !N XAMAN, THEN RETURN HERE.';
      pollBuyStatus();
    }).catch(function(){
      el.buyOpenXamanBtn.disabled = false;
      el.buyOpenXamanBtn.textContent = '[ 0PEN XAMAN ]';
      el.buyConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
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
  // Rooted at the scrollbox itself (not the viewport) so it fires on
  // scrolling *within* the box, not the page.
  var salesScrollObserver = new IntersectionObserver(function(entries){
    if (entries[0].isIntersecting) loadMoreSales();
  }, { root: el.salesScrollBox, rootMargin: '200px' });
  salesScrollObserver.observe(el.salesScrollSentinel);

  el.searchBtn.addEventListener('click', runSearchBox);
  el.searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') runSearchBox(); });
  el.sortSelect.addEventListener('change', function(){
    var value = el.sortSelect.value;
    var isScyllaSort = value === 'SCYLLA_PRICE_ASC' || value === 'SCYLLA_PRICE_DESC';
    if (isScyllaSort){
      state.sort = value;
      setScyllaListedOnly(true); // also runs the query
      return;
    }
    state.sort = value;
    if (state.scyllaListedOnly){
      setScyllaListedOnly(false); // also runs the query
      return;
    }
    runQuery();
  });
  el.editionSelect.addEventListener('change', function(){
    state.edition = el.editionSelect.value;
    runQuery();
  });

  // ---- Inspect / detail ----
  function traitCellHtml(a){
    var sub = (a.percent !== null && a.percent !== undefined)
      ? '<div class="tc-sub">' + a.percent + '%' + (a.count !== null && a.count !== undefined ? '<br>(' + a.count + ')' : '') + '</div>'
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
  }
  function updateDetailListing(priceEl, buyEl, listing){
    if (listing && listing.priceXrp !== null && listing.priceXrp !== undefined){
      priceEl.textContent = listing.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP';
      buyEl.style.display = '';
      buyEl.href = listing.buyUrl;
    } else {
      priceEl.textContent = 'N0T L!STED';
      buyEl.style.display = 'none';
    }
  }
  function updateDetailListings(listings){
    updateDetailListing(el.listingDeeptidePrice, el.listingDeeptideBuy, listings && listings.deeptide);
    updateDetailListing(el.listingXrpCafePrice, el.listingXrpCafeBuy, listings && listings.xrpCafe);
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
      renderOwnerLink(p.ownerShort, p.owner);
      refreshCardSelectionStates();
    }).catch(function(){
      renderOwnerLink(null, null);
    });
  }
  el.detailHistoryToggle.addEventListener('click', function(){
    var opening = el.detailHistoryList.style.display === 'none';
    el.detailHistoryList.style.display = opening ? '' : 'none';
    el.detailHistoryToggle.textContent = opening ? '[ P!GE0N H!ST0RY ▲ ]' : '[ P!GE0N H!ST0RY ▼ ]';
  });
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
        el.sortSelect.value = 'SCYLLA_PRICE_DESC';
      }
      if (state.scope){
        state.scope = null;
        state.scopeAllItems = [];
        state.targetAssets = {};
        el.nodeHeaderPanel.style.display = 'none';
        el.searchPanelTitle.textContent = 'P!GE0N DATABASE';
        renderTargetBar();
      }
    } else if (state.sort === 'SCYLLA_PRICE_ASC' || state.sort === 'SCYLLA_PRICE_DESC'){
      state.sort = 'RARITY_ASC';
      el.sortSelect.value = 'RARITY_ASC';
    }
    runQuery();
  }
  el.statScyllaListedTile.addEventListener('click', function(){
    setScyllaListedOnly(!state.scyllaListedOnly);
  });

  // ---- Initial load ----
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
