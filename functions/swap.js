// ─────────────────────────────────────────────────────────────────────────
// Σκύλλα SWAP — interactive prototype UI, all data and state local/mock.
//
// Nothing on this page connects a wallet, calls Xaman, signs anything, or
// submits any transaction. Every "wallet", "Pigeon", and "swap request" on
// this page is fabricated client-side. See the seam functions below.
//
// FUTURE ARCHITECTURE NOTE — two distinct kinds of function live here:
//
//  1. getWalletPigeons / getTop15Holders / getNFTMetadata — these ARE the
//     live implementation the UI calls today, just backed by mock data
//     instead of the XRPL. When the real protocol is ready, only these
//     three need to start doing real ledger lookups; every UI function
//     that reads Pigeon data already goes through them, never touching a
//     mock array directly.
//
//  2. SwapProtocolStub.{connectWallet, createSwapRequest, signSwap,
//     combineSignatures, submitBatch} — these are NOT implemented and NOT
//     called anywhere in this file. They exist purely as the documented
//     seam for the next development phase (real wallet connect, dual
//     signing, XRPL Batch submission with ALLORNOTHING). Wiring these up
//     is explicitly out of scope for this prototype.
// ─────────────────────────────────────────────────────────────────────────

const TOTAL_PIGEONS_MOCK = 3015;
const YOUR_MOCK_WALLET = 'rMOCKPROTOTYPE0000000000000000WNR';
const YOUR_MOCK_PIGEON_COUNT = 13;

// Clearly-fake mock leaderboard. Every address is stamped with MOCK right
// after the leading "r" so it reads as fabricated even once shortened.
const TOP15_HOLDERS_MOCK = [
  { addr: 'rMOCKA9f3K7dE2pQ8xL4vB6nH1sT0yR5c', count: 487 },
  { addr: 'rMOCKB7e1L8fG3qR9yM5wC7oI2tU1zS6d', count: 391 },
  { addr: 'rMOCKC5d0M9gH4rS0zN6xD8pJ3uV2aT7e', count: 302 },
  { addr: 'rMOCKD3c8N0hI5sT1aO7yE9qK4vW3bU8f', count: 276 },
  { addr: 'rMOCKE1b7O1iJ6tU2bP8zF0rL5wX4cV9g', count: 254 },
  { addr: 'rMOCKF9a6P2jK7uV3cQ9aG1sM6xY5dW0h', count: 229 },
  { addr: 'rMOCKG7z5Q3kL8vW4dR0bH2tN7yZ6eX1i', count: 201 },
  { addr: 'rMOCKH5y4R4lM9wX5eS1cI3uO8zA7fY2j', count: 188 },
  { addr: 'rMOCKI3x3S5mN0xY6fT2dJ4vP9aB8gZ3k', count: 172 },
  { addr: 'rMOCKJ1w2T6nO1yZ7gU3eK5wQ0bC9hA4l', count: 159 },
  { addr: 'rMOCKK9v1U7oP2zA8hV4fL6xR1cD0iB5m', count: 143 },
  { addr: 'rMOCKL7u0V8pQ3aB9iW5gM7yS2dE1jC6n', count: 131 },
  { addr: 'rMOCKM5t9W9qR4bC0jX6hN8zT3eF2kD7o', count: 122 },
  { addr: 'rMOCKN3s8X0rS5cD1kY7iO9aU4fG3lE8p', count: 111 },
  { addr: 'rMOCKO1r7Y1sT6dE2lZ8jP0bV5gH4mF9q', count: 103 },
];

const SWAP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>Σκύλλα SWAP :: PR0T0TYPE</title>
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
  .page{ max-width:900px; width:100%; position:relative; z-index:1; }
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
    margin-bottom:1.5rem;
    text-transform:uppercase;
  }
  .sw-status-lines{
    text-align:center;
    font-size:11px;
    letter-spacing:0.1em;
    line-height:1.9;
    color:rgba(232,232,232,0.45);
    margin-bottom:2.5rem;
    text-transform:uppercase;
  }
  .sw-status-lines .offline{
    color:#ff003c;
    text-shadow:0 0 6px rgba(255,0,60,0.4);
  }

  .sw-panel{
    border:1px solid rgba(57,255,20,0.25);
    background:#08080a;
    padding:1.5rem;
    margin-bottom:1.75rem;
  }
  .sw-panel-title{
    font-size:11px;
    letter-spacing:0.25em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    text-align:center;
    margin-bottom:0.25rem;
    text-transform:uppercase;
  }
  .sw-panel-sub{
    font-size:10px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.3);
    text-align:center;
    margin-bottom:1.25rem;
    text-transform:uppercase;
  }
  .mock-note{
    text-align:center;
    font-size:9px;
    letter-spacing:0.1em;
    color:rgba(0,255,242,0.55);
    margin-bottom:1rem;
    text-transform:uppercase;
  }

  /* ---- Target node input ---- */
  .target-input-row{
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:0.75rem;
  }
  input.wallet-input{
    width:100%;
    max-width:520px;
    background:#000;
    border:1px solid rgba(57,255,20,0.35);
    color:#e8e8e8;
    font-family:inherit;
    font-size:12px;
    letter-spacing:0.05em;
    padding:0.75em 0.9em;
    text-transform:none;
  }
  input.wallet-input::placeholder{ color:rgba(232,232,232,0.3); text-transform:uppercase; }
  .or-divider{
    font-size:10px;
    letter-spacing:0.3em;
    color:rgba(232,232,232,0.3);
    margin:0.35rem 0;
  }
  select.mono-select{
    width:100%;
    max-width:520px;
    background:#000;
    border:1px solid rgba(0,255,242,0.35);
    color:#00fff2;
    font-family:inherit;
    font-size:12px;
    letter-spacing:0.05em;
    padding:0.7em 0.9em;
    text-transform:uppercase;
    cursor:pointer;
  }
  select.mono-select option{ background:#08080a; color:#e8e8e8; }

  /* ---- Collection headers ---- */
  .node-header{
    text-align:center;
    margin-bottom:1.1rem;
  }
  .node-header .nh-label{
    font-size:11px;
    letter-spacing:0.25em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    margin-bottom:0.4rem;
    text-transform:uppercase;
  }
  .swap-side.theirs .node-header .nh-label,
  #targetSection .node-header .nh-label{ color:#00fff2; text-shadow:0 0 6px rgba(0,255,242,0.4); }
  .node-header .nh-addr{
    font-size:13px;
    letter-spacing:0.03em;
    color:#e8e8e8;
    margin-bottom:0.3rem;
    word-break:break-all;
  }
  .node-header .nh-count{
    font-size:11px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.5);
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

  /* ---- Search / filter / sort controls ---- */
  .browse-controls{
    display:flex;
    flex-wrap:wrap;
    gap:0.6rem;
    margin-bottom:1.1rem;
  }
  input.search-input{
    flex:1 1 200px;
    background:#000;
    border:1px solid rgba(57,255,20,0.3);
    color:#e8e8e8;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.6em 0.8em;
  }
  input.search-input::placeholder{ color:rgba(232,232,232,0.3); text-transform:uppercase; }
  select.filter-select, select.sort-select{
    flex:0 0 auto;
    background:#000;
    border:1px solid rgba(57,255,20,0.3);
    color:#39ff14;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.6em 0.8em;
    text-transform:uppercase;
    cursor:pointer;
  }
  select.filter-select option, select.sort-select option{ background:#08080a; color:#e8e8e8; }

  /* ---- Pigeon card grid ---- */
  .swap-pigeon-list{
    display:grid;
    grid-template-columns:repeat(auto-fill, minmax(120px, 1fr));
    gap:0.75rem;
    margin-bottom:1rem;
  }
  .swap-pigeon-card{
    border:1px solid rgba(57,255,20,0.25);
    padding:0.6rem;
    text-align:center;
    cursor:pointer;
    transition:border-color 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  }
  #targetSection .swap-pigeon-card{ border-color:rgba(0,255,242,0.25); }
  .swap-pigeon-card.selected{
    border-color:#39ff14;
    box-shadow:0 0 12px rgba(57,255,20,0.3) inset;
  }
  #targetSection .swap-pigeon-card.selected{
    border-color:#00fff2;
    box-shadow:0 0 12px rgba(0,255,242,0.3) inset;
  }
  .swap-pigeon-img{
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
    font-size:9px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.3);
    margin-bottom:0.5rem;
    position:relative;
  }
  .swap-pigeon-card.selected .swap-pigeon-img::after{
    content:'✓ SELECTED';
    position:absolute;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    background:rgba(57,255,20,0.15);
    color:#39ff14;
    font-size:9px;
    letter-spacing:0.08em;
    font-weight:700;
  }
  #targetSection .swap-pigeon-card.selected .swap-pigeon-img::after{
    background:rgba(0,255,242,0.15);
    color:#00fff2;
  }
  .swap-pigeon-num{
    font-size:11px;
    letter-spacing:0.05em;
    color:#e8e8e8;
    margin-bottom:0.25rem;
    text-transform:uppercase;
  }
  .swap-pigeon-trait{
    font-size:9px;
    letter-spacing:0.05em;
    color:rgba(232,232,232,0.4);
    margin-bottom:0.3rem;
    text-transform:uppercase;
  }
  .swap-pigeon-status{
    font-size:9px;
    letter-spacing:0.1em;
    color:rgba(57,255,20,0.6);
    text-transform:uppercase;
  }
  #targetSection .swap-pigeon-status{ color:rgba(0,255,242,0.6); }
  .selection-count{
    text-align:center;
    font-size:11px;
    letter-spacing:0.12em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    text-transform:uppercase;
  }
  #targetSection .selection-count{ color:#00fff2; text-shadow:0 0 6px rgba(0,255,242,0.4); }
  .empty-grid-note{
    text-align:center;
    font-size:11px;
    letter-spacing:0.08em;
    color:rgba(232,232,232,0.35);
    padding:1.5rem 0;
    text-transform:uppercase;
  }

  /* ---- Your node wallet-connect stub ---- */
  .your-node-connect{
    text-align:center;
    margin-bottom:1.25rem;
  }
  .connect-btn-disabled{
    display:inline-block;
    background:transparent;
    border:1px solid rgba(57,255,20,0.25);
    color:rgba(232,232,232,0.3);
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.12em;
    padding:0.6em 1.3em;
    text-transform:uppercase;
    cursor:not-allowed;
    user-select:none;
  }

  /* ---- Exchange visual ---- */
  .exchange-panel{
    text-align:center;
  }
  .exchange-side-label{
    font-size:11px;
    letter-spacing:0.2em;
    margin-bottom:0.6rem;
    text-transform:uppercase;
  }
  .exchange-side-label.offer{ color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.4); }
  .exchange-side-label.receive{ color:#00fff2; text-shadow:0 0 6px rgba(0,255,242,0.4); }
  .exchange-chip-row{
    display:flex;
    flex-wrap:wrap;
    justify-content:center;
    gap:0.5rem;
    min-height:2.2em;
    margin-bottom:1.25rem;
  }
  .exchange-chip{
    border:1px solid rgba(232,232,232,0.25);
    padding:0.4em 0.75em;
    font-size:11px;
    letter-spacing:0.05em;
    color:#e8e8e8;
    text-transform:uppercase;
  }
  .exchange-chip.empty{
    color:rgba(232,232,232,0.3);
    border-style:dashed;
    border-color:rgba(232,232,232,0.2);
  }
  .exchange-indicator{
    font-size:26px;
    letter-spacing:0.15em;
    color:#fff;
    text-shadow:0 0 12px rgba(57,255,20,0.35), 0 0 12px rgba(0,255,242,0.35);
    margin:0.5rem 0 1rem;
    text-transform:none;
  }
  .exchange-indicator .ei-word{
    display:block;
    font-size:11px;
    letter-spacing:0.3em;
    margin-top:0.35rem;
    color:rgba(232,232,232,0.5);
    text-transform:none;
  }

  /* ---- XRP adjustment ---- */
  .xrp-toggle-row{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:0.9rem;
    margin-bottom:1rem;
  }
  .xrp-toggle-label{
    font-size:11px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.5);
    text-transform:uppercase;
  }
  .xrp-toggle-btn{
    background:transparent;
    border:1px solid rgba(57,255,20,0.4);
    color:rgba(232,232,232,0.5);
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.15em;
    padding:0.5em 1.1em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .xrp-toggle-btn.on{
    color:#39ff14;
    border-color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
  }
  .xrp-off-note, .xrp-on-block{ text-align:center; }
  .xrp-off-note{
    font-size:12px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.35);
    text-transform:uppercase;
  }
  .xrp-amount-label{
    font-size:10px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.4);
    margin-bottom:0.5rem;
    text-transform:uppercase;
  }
  input.xrp-amount-input{
    width:100%;
    max-width:220px;
    background:#000;
    border:1px solid rgba(57,255,20,0.35);
    color:#39ff14;
    text-align:center;
    font-family:inherit;
    font-size:15px;
    letter-spacing:0.05em;
    padding:0.6em;
    margin-bottom:1rem;
  }
  .xrp-direction-row{
    display:flex;
    justify-content:center;
    gap:0.6rem;
  }
  .xrp-dir-btn{
    background:transparent;
    border:1px solid rgba(232,232,232,0.3);
    color:rgba(232,232,232,0.5);
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.6em 1.1em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .xrp-dir-btn.active-pay{
    color:#ff003c;
    border-color:#ff003c;
    text-shadow:0 0 6px rgba(255,0,60,0.4);
  }
  .xrp-dir-btn.active-receive{
    color:#39ff14;
    border-color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
  }

  /* ---- Live summary ---- */
  .summary-box{
    border:1px dashed rgba(57,255,20,0.4);
    padding:1.5rem;
    text-align:center;
    margin-bottom:1.75rem;
  }
  .summary-title{
    font-size:12px;
    letter-spacing:0.25em;
    color:#fff;
    margin-bottom:0.3rem;
    text-transform:none;
  }
  .summary-subtitle{
    font-size:11px;
    letter-spacing:0.2em;
    color:rgba(232,232,232,0.45);
    margin-bottom:1.25rem;
    text-transform:uppercase;
  }
  .summary-col-label{
    font-size:10px;
    letter-spacing:0.2em;
    margin-bottom:0.5rem;
    text-transform:uppercase;
  }
  .summary-col-label.give{ color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.4); }
  .summary-col-label.receive{ color:#00fff2; text-shadow:0 0 6px rgba(0,255,242,0.4); }
  .summary-list{
    font-size:12px;
    line-height:1.9;
    color:#e8e8e8;
    margin-bottom:1.1rem;
    min-height:1.9em;
  }
  .summary-list .empty-line{ color:rgba(232,232,232,0.3); }
  .summary-xrp-line{ color:#ffd700; text-shadow:0 0 5px rgba(255,215,0,0.4); }
  .summary-row{
    display:flex;
    justify-content:space-between;
    max-width:340px;
    margin:0 auto 0.65rem;
    font-size:11px;
    letter-spacing:0.1em;
    text-transform:uppercase;
  }
  .summary-row .label{ color:rgba(232,232,232,0.4); }
  .summary-row .value{ color:#e8e8e8; }
  .summary-row .value.offline{ color:#ff003c; text-shadow:0 0 6px rgba(255,0,60,0.4); }
  .summary-row .value.atomic{ color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.4); }

  /* ---- Generate / confirmation ---- */
  .generate-wrap{ text-align:center; margin-bottom:1.5rem; }
  .generate-btn{
    background:transparent;
    border:1px solid rgba(57,255,20,0.6);
    color:#39ff14;
    font-family:inherit;
    font-size:13px;
    letter-spacing:0.15em;
    padding:0.9em 1.8em;
    cursor:pointer;
    text-transform:uppercase;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
  }
  .generate-btn:hover:not(:disabled){ background:rgba(57,255,20,0.1); }
  .generate-btn:disabled{ opacity:0.35; cursor:not-allowed; }

  .confirm-panel{
    border:1px solid rgba(57,255,20,0.5);
    background:#000;
    padding:1.5rem;
    margin-bottom:1.75rem;
  }
  .confirm-title{
    text-align:center;
    font-size:12px;
    letter-spacing:0.15em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
    margin-bottom:1.1rem;
    text-transform:uppercase;
  }
  .confirm-row{
    display:flex;
    justify-content:space-between;
    max-width:420px;
    margin:0 auto 0.6rem;
    font-size:12px;
    letter-spacing:0.05em;
  }
  .confirm-row .label{ color:rgba(232,232,232,0.45); text-transform:uppercase; }
  .confirm-row .value{ color:#e8e8e8; word-break:break-all; text-align:right; }
  .confirm-row .value.status{ color:#ffd700; text-shadow:0 0 5px rgba(255,215,0,0.4); text-transform:uppercase; }
  .confirm-actions{
    display:flex;
    justify-content:center;
    gap:0.75rem;
    margin-top:1.25rem;
  }
  .confirm-btn{
    background:transparent;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.6em 1.2em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .confirm-btn.cancel{ border:1px solid rgba(255,0,60,0.5); color:#ff003c; }
  .confirm-btn.cancel:hover{ background:rgba(255,0,60,0.08); }
  .confirm-btn.copy{ border:1px solid rgba(0,255,242,0.5); color:#00fff2; }
  .confirm-btn.copy:hover{ background:rgba(0,255,242,0.08); }
  .copy-feedback{
    text-align:center;
    font-size:10px;
    letter-spacing:0.1em;
    color:#00fff2;
    margin-top:0.6rem;
    min-height:1.4em;
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

  @media (min-width:700px){
    .grid-2col{ display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  }
</style>
</head>
<body>

  <canvas id="staticBg"></canvas>

  <div class="page">
    <a class="back-link" href="/board">&larr; RETURN T0 S!GNAL_RELAY</a>

    <h1>Σκύλλα</h1>
    <div class="sw-subtitle">SWAP PR0T0C0L</div>
    <div class="sw-status-lines">
      // TRUSTLESS ASSET EXCHANGE<br>
      // PR0T0C0L STATUS :: <span class="offline">0FFL!NE (PR0T0TYPE M0DE)</span>
    </div>

    <!-- TARGET NODE input -->
    <div class="sw-panel" id="targetInputPanel">
      <div class="sw-panel-title">// TARGET N0DE</div>
      <div class="target-input-row">
        <input class="wallet-input" id="targetWalletInput" maxlength="60" placeholder="ENTER WALLET ADDRESS...">
        <div class="or-divider">0R</div>
        <select class="mono-select" id="top15Select">
          <option value="">[ T0P 15 P!GE0N H0LDERS ▼ ]</option>
        </select>
      </div>
    </div>

    <!-- TARGET PIGEON COLLECTION -->
    <div class="sw-panel" id="targetSection">
      <div class="node-header">
        <div class="nh-label">TARGET N0DE</div>
        <div class="nh-addr" id="targetAddrLine">// AWA!T!NG !NPUT</div>
        <div class="nh-count" id="targetCountLine"></div>
      </div>
      <div id="targetBrowseArea" style="display:none;">
        <div class="mock-note">// M0CK DATA — S!MULATED H0LD!NGS, N0T A L!VE XRPL QUERY</div>
        <div class="browse-controls">
          <input class="search-input" id="targetSearchInput" placeholder="SEARCH P!GE0NS...">
          <select class="filter-select" id="targetFilterSelect">
            <option value="ALL">[ ALL ▼ ]</option>
            <option value="SELECTED">SELECTED</option>
            <option value="UNSELECTED">UNSELECTED</option>
          </select>
          <select class="sort-select" id="targetSortSelect">
            <option value="NUM_ASC">[ S0RT ▼ ] NUMBER ▲</option>
            <option value="NUM_DESC">NUMBER ▼</option>
            <option value="STATIC_ASC">STAT!C ▲</option>
            <option value="STATIC_DESC">STAT!C ▼</option>
          </select>
        </div>
        <div class="swap-pigeon-list" id="targetGrid"></div>
        <div class="selection-count" id="targetSelectionCount">SELECTED :: 0 P!GE0NS</div>
      </div>
      <div class="placeholder-note" id="targetPlaceholder">ENTER A WALLET 0R SELECT A T0P 15 H0LDER T0 BEGIN</div>
    </div>

    <!-- YOUR PIGEONS -->
    <div class="sw-panel" id="yourSection">
      <div class="node-header">
        <div class="nh-label">Y0UR N0DE</div>
        <div class="nh-addr">WALLET :: PR0T0TYPE</div>
        <div class="nh-count">P!GE0NS HELD :: ${YOUR_MOCK_PIGEON_COUNT}</div>
      </div>
      <div class="your-node-connect">
        <button class="connect-btn-disabled" disabled aria-disabled="true" title="PR0T0C0L 0FFL!NE :: N0T YET ACT!VE">[ C0NNECT WALLET ]</button>
      </div>
      <div class="mock-note">// M0CK DATA — WALLET N0T C0NNECTED</div>
      <div class="swap-pigeon-list" id="yourGrid"></div>
      <div class="selection-count" id="yourSelectionCount">0FFER!NG :: 0 P!GE0NS</div>
    </div>

    <!-- EXCHANGE VISUAL -->
    <div class="sw-panel exchange-panel">
      <div class="exchange-side-label offer">Y0U 0FFER</div>
      <div class="exchange-chip-row" id="offerChipRow"></div>
      <div class="exchange-indicator">⇅<span class="ei-word">Σκύλλα EXCHANGE</span></div>
      <div class="exchange-side-label receive">Y0U RECE!VE</div>
      <div class="exchange-chip-row" id="receiveChipRow"></div>
    </div>

    <!-- XRP ADJUSTMENT -->
    <div class="sw-panel">
      <div class="sw-panel-title">XRP ADJUSTMENT</div>
      <div class="xrp-toggle-row">
        <span class="xrp-toggle-label">!NCLUDE XRP</span>
        <button class="xrp-toggle-btn" id="xrpToggleBtn">0FF</button>
      </div>
      <div id="xrpOffNote" class="xrp-off-note">XRP :: N0T !NCLUDED</div>
      <div id="xrpOnBlock" class="xrp-on-block" style="display:none;">
        <div class="xrp-amount-label">AM0UNT</div>
        <input class="xrp-amount-input" id="xrpAmountInput" type="number" min="0" step="0.01" value="0.00">
        <div class="xrp-direction-row">
          <button class="xrp-dir-btn" id="xrpPayBtn">[ Y0U PAY ]</button>
          <button class="xrp-dir-btn" id="xrpReceiveBtn">[ Y0U RECE!VE ]</button>
        </div>
      </div>
    </div>

    <!-- LIVE SWAP SUMMARY -->
    <div class="summary-box">
      <div class="summary-title">Σκύλλα</div>
      <div class="summary-subtitle">SWAP PR0P0SAL</div>
      <div class="grid-2col">
        <div>
          <div class="summary-col-label give">Y0U G!VE</div>
          <div class="summary-list" id="summaryGiveList"></div>
        </div>
        <div>
          <div class="summary-col-label receive">Y0U RECE!VE</div>
          <div class="summary-list" id="summaryReceiveList"></div>
        </div>
      </div>
      <div class="summary-row"><span class="label">AT0M!C!TY</span><span class="value atomic">ALL 0R N0TH!NG</span></div>
      <div class="summary-row"><span class="label">PR0T0C0L</span><span class="value">SCYLLA SWAP</span></div>
      <div class="summary-row"><span class="label">STATUS</span><span class="value offline">PR0T0TYPE</span></div>
    </div>

    <div class="generate-wrap">
      <button class="generate-btn" id="generateBtn" disabled>[ GENERATE SWAP REQUEST ]</button>
    </div>

    <div class="confirm-panel" id="confirmPanel" style="display:none;">
      <div class="confirm-title">// SCYLLA SWAP REQUEST GENERATED</div>
      <div class="confirm-row"><span class="label">SWAP !D</span><span class="value" id="confirmSwapId"></span></div>
      <div class="confirm-row"><span class="label">C0UNTERPARTY</span><span class="value" id="confirmCounterparty"></span></div>
      <div class="confirm-row"><span class="label">ASSETS</span><span class="value" id="confirmAssets"></span></div>
      <div class="confirm-row"><span class="label">XRP</span><span class="value" id="confirmXrp"></span></div>
      <div class="confirm-row"><span class="label">STATUS</span><span class="value status" id="confirmStatus"></span></div>
      <div class="confirm-actions">
        <button class="confirm-btn cancel" id="cancelSwapBtn">[ CANCEL ]</button>
        <button class="confirm-btn copy" id="copySwapIdBtn">[ C0PY SWAP !D ]</button>
      </div>
      <div class="copy-feedback" id="copyFeedback"></div>
    </div>

    <div class="protocol-footer">TH!S !S A PR0T0TYPE !NTERFACE. N0 ASSETS CAN BE M0VED, S!GNED, 0R TRANSFERRED.</div>
  </div>

<script>
(function(){

  // ---- Deterministic mock RNG so the same wallet always shows the same
  // Pigeons within a session, instead of reshuffling on every render. ----
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
  var YOUR_MOCK_WALLET = ${JSON.stringify(YOUR_MOCK_WALLET)};
  var TOP15_HOLDERS_MOCK = ${JSON.stringify(TOP15_HOLDERS_MOCK)};

  // ---- Live (mock-backed) data functions — the real integration seam.
  // Everything in the UI reads Pigeon/holder data through these three,
  // never a raw array, so swapping in real XRPL calls later only touches
  // this block. ----
  function getNFTMetadata(nftId){
    var rnd = mulberry32(hashStr(nftId));
    return { id: nftId, staticLevel: 1 + Math.floor(rnd() * 15) };
  }
  function getWalletPigeons(wallet, count){
    var rnd = mulberry32(hashStr(wallet));
    var seen = {};
    var pigeons = [];
    var guard = 0;
    while (pigeons.length < count && guard < count * 20){
      guard++;
      var num = 1 + Math.floor(rnd() * TOTAL_PIGEONS_MOCK);
      var key = String(num).padStart(4, '0');
      if (seen[key]) continue;
      seen[key] = true;
      var id = wallet + ':' + key;
      var meta = getNFTMetadata(id);
      pigeons.push({ id: id, number: key, staticLevel: meta.staticLevel });
    }
    return pigeons;
  }
  function getTop15Holders(){
    return TOP15_HOLDERS_MOCK;
  }

  // ---- True future seams — intentionally unimplemented and unused here.
  // The real wallet-connect / dual-sign / Batch-submit flow plugs in here
  // in the next development phase, not this one. ----
  var SwapProtocolStub = {
    connectWallet: function(){ throw new Error('not implemented — prototype only'); },
    createSwapRequest: function(_proposal){ throw new Error('not implemented — prototype only'); },
    signSwap: function(_request){ throw new Error('not implemented — prototype only'); },
    combineSignatures: function(_a, _b){ throw new Error('not implemented — prototype only'); },
    submitBatch: function(_combined){ throw new Error('not implemented — prototype only'); },
  };

  function shortenAddr(addr){
    return addr.slice(0, 9) + '...' + addr.slice(-4);
  }

  // ---- Client-side state ----
  var state = {
    targetWallet: null,
    targetLabel: '',
    targetPigeons: [],
    targetSelected: {},
    targetSearch: '',
    targetFilter: 'ALL',
    targetSort: 'NUM_ASC',
    yourPigeons: getWalletPigeons(YOUR_MOCK_WALLET, ${YOUR_MOCK_PIGEON_COUNT}),
    yourSelected: {},
    xrpEnabled: false,
    xrpAmount: 0,
    xrpDirection: 'PAY',
    swapRequest: null
  };

  // ---- DOM refs ----
  var el = {
    targetWalletInput: document.getElementById('targetWalletInput'),
    top15Select: document.getElementById('top15Select'),
    targetAddrLine: document.getElementById('targetAddrLine'),
    targetCountLine: document.getElementById('targetCountLine'),
    targetBrowseArea: document.getElementById('targetBrowseArea'),
    targetPlaceholder: document.getElementById('targetPlaceholder'),
    targetSearchInput: document.getElementById('targetSearchInput'),
    targetFilterSelect: document.getElementById('targetFilterSelect'),
    targetSortSelect: document.getElementById('targetSortSelect'),
    targetGrid: document.getElementById('targetGrid'),
    targetSelectionCount: document.getElementById('targetSelectionCount'),
    yourGrid: document.getElementById('yourGrid'),
    yourSelectionCount: document.getElementById('yourSelectionCount'),
    offerChipRow: document.getElementById('offerChipRow'),
    receiveChipRow: document.getElementById('receiveChipRow'),
    xrpToggleBtn: document.getElementById('xrpToggleBtn'),
    xrpOffNote: document.getElementById('xrpOffNote'),
    xrpOnBlock: document.getElementById('xrpOnBlock'),
    xrpAmountInput: document.getElementById('xrpAmountInput'),
    xrpPayBtn: document.getElementById('xrpPayBtn'),
    xrpReceiveBtn: document.getElementById('xrpReceiveBtn'),
    summaryGiveList: document.getElementById('summaryGiveList'),
    summaryReceiveList: document.getElementById('summaryReceiveList'),
    generateBtn: document.getElementById('generateBtn'),
    confirmPanel: document.getElementById('confirmPanel'),
    confirmSwapId: document.getElementById('confirmSwapId'),
    confirmCounterparty: document.getElementById('confirmCounterparty'),
    confirmAssets: document.getElementById('confirmAssets'),
    confirmXrp: document.getElementById('confirmXrp'),
    confirmStatus: document.getElementById('confirmStatus'),
    cancelSwapBtn: document.getElementById('cancelSwapBtn'),
    copySwapIdBtn: document.getElementById('copySwapIdBtn'),
    copyFeedback: document.getElementById('copyFeedback')
  };

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function pigeonCardHtml(p, selected){
    return '<div class="swap-pigeon-card' + (selected ? ' selected' : '') + '" data-id="' + escapeHtml(p.id) + '">' +
      '<div class="swap-pigeon-img">[ IMAGE ]</div>' +
      '<div class="swap-pigeon-num">P!GE0N #' + escapeHtml(p.number) + '</div>' +
      '<div class="swap-pigeon-trait">STAT!C :: ' + String(p.staticLevel).padStart(2, '0') + '</div>' +
      '<div class="swap-pigeon-status">STATUS :: HELD</div>' +
    '</div>';
  }

  // ---- TOP 15 dropdown population ----
  getTop15Holders().forEach(function(h, i){
    var opt = document.createElement('option');
    opt.value = h.addr;
    opt.textContent = String(i + 1).padStart(2, '0') + '  ' + shortenAddr(h.addr) + '    ' + h.count + ' P!GE0NS';
    el.top15Select.appendChild(opt);
  });

  // ---- Target node loading ----
  function loadTargetWallet(wallet, knownCount){
    if (!wallet) return;
    state.targetWallet = wallet;
    state.targetLabel = shortenAddr(wallet);
    var count = knownCount || (20 + Math.floor(mulberry32(hashStr(wallet + ':count'))() * 130));
    state.targetPigeons = getWalletPigeons(wallet, count);
    state.targetSelected = {};
    state.targetSearch = '';
    el.targetSearchInput.value = '';
    state.targetFilter = 'ALL';
    el.targetFilterSelect.value = 'ALL';
    el.targetAddrLine.textContent = state.targetLabel;
    el.targetCountLine.textContent = 'P!GE0NS HELD :: ' + count;
    el.targetBrowseArea.style.display = '';
    el.targetPlaceholder.style.display = 'none';
    renderTargetGrid();
    renderExchange();
  }

  function filteredSortedTarget(){
    var list = state.targetPigeons.slice();
    var q = state.targetSearch.trim();
    if (q){ list = list.filter(function(p){ return p.number.indexOf(q) !== -1; }); }
    if (state.targetFilter === 'SELECTED'){ list = list.filter(function(p){ return !!state.targetSelected[p.id]; }); }
    if (state.targetFilter === 'UNSELECTED'){ list = list.filter(function(p){ return !state.targetSelected[p.id]; }); }
    list.sort(function(a, b){
      if (state.targetSort === 'NUM_ASC') return a.number.localeCompare(b.number);
      if (state.targetSort === 'NUM_DESC') return b.number.localeCompare(a.number);
      if (state.targetSort === 'STATIC_ASC') return a.staticLevel - b.staticLevel;
      if (state.targetSort === 'STATIC_DESC') return b.staticLevel - a.staticLevel;
      return 0;
    });
    return list;
  }

  function renderTargetGrid(){
    var list = filteredSortedTarget();
    if (!list.length){
      el.targetGrid.innerHTML = '<div class="empty-grid-note" style="grid-column:1/-1;">N0 P!GE0NS MATCH TH!S QUERY</div>';
    } else {
      el.targetGrid.innerHTML = list.map(function(p){ return pigeonCardHtml(p, !!state.targetSelected[p.id]); }).join('');
    }
    var selCount = Object.keys(state.targetSelected).length;
    el.targetSelectionCount.textContent = 'SELECTED :: ' + selCount + ' P!GE0N' + (selCount === 1 ? '' : 'S');
  }

  function renderYourGrid(){
    el.yourGrid.innerHTML = state.yourPigeons.map(function(p){ return pigeonCardHtml(p, !!state.yourSelected[p.id]); }).join('');
    var selCount = Object.keys(state.yourSelected).length;
    el.yourSelectionCount.textContent = '0FFER!NG :: ' + selCount + ' P!GE0N' + (selCount === 1 ? '' : 'S');
  }

  function chipRowHtml(pigeons){
    if (!pigeons.length) return '<span class="exchange-chip empty">N0NE SELECTED</span>';
    return pigeons.map(function(p){ return '<span class="exchange-chip">#' + escapeHtml(p.number) + '</span>'; }).join('');
  }

  function selectedPigeons(source, selectedMap){
    return source.filter(function(p){ return !!selectedMap[p.id]; });
  }

  function renderExchange(){
    var yours = selectedPigeons(state.yourPigeons, state.yourSelected);
    var theirs = selectedPigeons(state.targetPigeons, state.targetSelected);
    el.offerChipRow.innerHTML = chipRowHtml(yours);
    el.receiveChipRow.innerHTML = chipRowHtml(theirs);
    renderSummary(yours, theirs);
  }

  function renderSummary(yours, theirs){
    var giveLines = yours.map(function(p){ return '\\uD83D\\uDC26 P!GE0N #' + escapeHtml(p.number); });
    var receiveLines = theirs.map(function(p){ return '\\uD83D\\uDC26 P!GE0N #' + escapeHtml(p.number); });

    if (state.xrpEnabled && state.xrpAmount > 0){
      var xrpLine = '<span class="summary-xrp-line">+ ' + state.xrpAmount.toFixed(2) + ' XRP</span>';
      if (state.xrpDirection === 'PAY') giveLines.push(xrpLine);
      else receiveLines.push(xrpLine);
    }

    el.summaryGiveList.innerHTML = giveLines.length ? giveLines.join('<br>') : '<span class="empty-line">N0TH!NG SELECTED</span>';
    el.summaryReceiveList.innerHTML = receiveLines.length ? receiveLines.join('<br>') : '<span class="empty-line">N0TH!NG SELECTED</span>';

    var totalAssets = yours.length + theirs.length;
    var hasXrp = state.xrpEnabled && state.xrpAmount > 0;
    el.generateBtn.disabled = !state.targetWallet || (totalAssets === 0 && !hasXrp);
  }

  // ---- Event wiring: target wallet input / top15 select ----
  el.targetWalletInput.addEventListener('keydown', function(e){
    if (e.key === 'Enter'){
      var val = el.targetWalletInput.value.trim();
      if (val){ el.top15Select.value = ''; loadTargetWallet(val, null); }
    }
  });
  el.targetWalletInput.addEventListener('blur', function(){
    var val = el.targetWalletInput.value.trim();
    if (val && val !== state.targetWallet){ el.top15Select.value = ''; loadTargetWallet(val, null); }
  });
  el.top15Select.addEventListener('change', function(){
    var val = el.top15Select.value;
    if (!val) return;
    var holder = TOP15_HOLDERS_MOCK.filter(function(h){ return h.addr === val; })[0];
    el.targetWalletInput.value = val;
    loadTargetWallet(val, holder ? holder.count : null);
  });

  // ---- Event wiring: target browse controls ----
  el.targetSearchInput.addEventListener('input', function(){
    state.targetSearch = el.targetSearchInput.value;
    renderTargetGrid();
  });
  el.targetFilterSelect.addEventListener('change', function(){
    state.targetFilter = el.targetFilterSelect.value;
    renderTargetGrid();
  });
  el.targetSortSelect.addEventListener('change', function(){
    state.targetSort = el.targetSortSelect.value;
    renderTargetGrid();
  });
  el.targetGrid.addEventListener('click', function(e){
    var card = e.target.closest('.swap-pigeon-card');
    if (!card) return;
    var id = card.getAttribute('data-id');
    if (state.targetSelected[id]) delete state.targetSelected[id];
    else state.targetSelected[id] = true;
    renderTargetGrid();
    renderExchange();
  });

  // ---- Event wiring: your pigeons grid ----
  el.yourGrid.addEventListener('click', function(e){
    var card = e.target.closest('.swap-pigeon-card');
    if (!card) return;
    var id = card.getAttribute('data-id');
    if (state.yourSelected[id]) delete state.yourSelected[id];
    else state.yourSelected[id] = true;
    renderYourGrid();
    renderExchange();
  });

  // ---- Event wiring: XRP adjustment ----
  el.xrpToggleBtn.addEventListener('click', function(){
    state.xrpEnabled = !state.xrpEnabled;
    el.xrpToggleBtn.textContent = state.xrpEnabled ? 'ON' : '0FF';
    el.xrpToggleBtn.classList.toggle('on', state.xrpEnabled);
    el.xrpOffNote.style.display = state.xrpEnabled ? 'none' : '';
    el.xrpOnBlock.style.display = state.xrpEnabled ? '' : 'none';
    renderExchange();
  });
  el.xrpAmountInput.addEventListener('input', function(){
    var v = parseFloat(el.xrpAmountInput.value);
    state.xrpAmount = isNaN(v) || v < 0 ? 0 : v;
    renderExchange();
  });
  function setXrpDirection(dir){
    state.xrpDirection = dir;
    el.xrpPayBtn.classList.toggle('active-pay', dir === 'PAY');
    el.xrpReceiveBtn.classList.toggle('active-receive', dir === 'RECEIVE');
    renderExchange();
  }
  el.xrpPayBtn.addEventListener('click', function(){ setXrpDirection('PAY'); });
  el.xrpReceiveBtn.addEventListener('click', function(){ setXrpDirection('RECEIVE'); });
  setXrpDirection('PAY');

  // ---- Generate / cancel / copy (all local/mock) ----
  function mockSwapId(){
    var chars = '0123456789ABCDEF';
    var out = '';
    for (var i = 0; i < 6; i++){ out += chars[Math.floor(Math.random() * chars.length)]; }
    return 'MOCK-' + out;
  }

  el.generateBtn.addEventListener('click', function(){
    var yours = selectedPigeons(state.yourPigeons, state.yourSelected);
    var theirs = selectedPigeons(state.targetPigeons, state.targetSelected);
    var xrp = (state.xrpEnabled && state.xrpAmount > 0) ? state.xrpAmount : 0;
    state.swapRequest = {
      id: mockSwapId(),
      counterparty: state.targetLabel || 'UNKN0WN',
      assets: yours.length + theirs.length,
      xrp: xrp,
      status: 'AWA!T!NG C0UNTERPARTY'
    };
    el.confirmSwapId.textContent = state.swapRequest.id;
    el.confirmCounterparty.textContent = state.swapRequest.counterparty;
    el.confirmAssets.textContent = state.swapRequest.assets;
    el.confirmXrp.textContent = state.swapRequest.xrp.toFixed(2);
    el.confirmStatus.textContent = state.swapRequest.status;
    el.confirmPanel.style.display = '';
    el.generateBtn.disabled = true;
    el.copyFeedback.textContent = '';
  });

  el.cancelSwapBtn.addEventListener('click', function(){
    state.swapRequest = null;
    el.confirmPanel.style.display = 'none';
    el.copyFeedback.textContent = '';
    renderExchange();
  });

  el.copySwapIdBtn.addEventListener('click', function(){
    if (!state.swapRequest) return;
    var id = state.swapRequest.id;
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(id).then(function(){
        el.copyFeedback.textContent = 'C0P!ED :: ' + id;
      }).catch(function(){
        el.copyFeedback.textContent = 'ERR:// C0PY FA!LED';
      });
    } else {
      el.copyFeedback.textContent = 'ERR:// CL!PB0ARD UNAVA!LABLE';
    }
  });

  // ---- Initial paint ----
  renderYourGrid();
  renderExchange();

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
