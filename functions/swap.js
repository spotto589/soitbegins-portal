// ─────────────────────────────────────────────────────────────────────────
// Σκύλλα SWAP — prototype UI only.
//
// Nothing on this page moves, approves, signs, escrows, lists, sells or
// transfers an NFT. There is no wallet connection, no Xaman call, and no
// XRPL transaction construction anywhere in this file.
//
// FUTURE ARCHITECTURE NOTE:
// This file intentionally keeps the swap UI's rendering/markup separate
// from any future protocol logic. When the real Σκύλλα Swap protocol is
// ready, it will plug in as its own module (wallet connect, counterparty
// selection, swap-request generation, dual-signing, Batch-transaction
// assembly with ALLORNOTHING, submission, and tx-hash display) behind the
// `SwapProtocolStub` object below, without needing to rewrite this markup.
// ─────────────────────────────────────────────────────────────────────────

// Placeholder surface for the future real protocol module. Every method is
// a stub that does nothing — none of them are called from this prototype.
// This exists purely so the eventual XRPL integration has a known seam to
// slot into (selectOffer/selectRequest/generateSwapRequest/sign/submit),
// instead of being wired directly into DOM handlers later.
const SWAP_PROTOCOL_STUB_JS = `
const SwapProtocolStub = {
  connectWallet(){ throw new Error('not implemented — prototype only'); },
  setCounterparty(_walletAddress){ throw new Error('not implemented — prototype only'); },
  setOfferedNfts(_nftIds){ throw new Error('not implemented — prototype only'); },
  setRequestedNfts(_nftIds){ throw new Error('not implemented — prototype only'); },
  generateSwapRequest(){ throw new Error('not implemented — prototype only'); },
  signSwapRequest(_request){ throw new Error('not implemented — prototype only'); },
  submitBatchTransaction(_signedRequest){ throw new Error('not implemented — prototype only'); },
};
`;

// Fake, clearly-fictional sample data for the prototype cards only.
// Not tied to any real wallet, account, or on-chain lookup.
const SAMPLE_YOUR_PIGEONS = [
  { num: '0142', trait: 'CR0WN :: N0NE' },
  { num: '0871', trait: 'CR0WN :: N0NE' },
  { num: '1203', trait: 'CR0WN :: N0NE' },
  { num: '0056', trait: 'CR0WN :: N0NE' },
];

const SAMPLE_THEIR_PIGEONS = [
  { num: '2210', trait: 'CR0WN :: N0NE' },
  { num: '2211', trait: 'CR0WN :: N0NE' },
  { num: '2214', trait: 'CR0WN :: N0NE' },
  { num: '2298', trait: 'CR0WN :: N0NE' },
];

function pigeonCardHtml(p, side) {
  const selectable = side === 'your';
  return `
    <div class="swap-pigeon-card${selectable ? ' selectable' : ''}" data-side="${side}" data-num="${p.num}">
      <div class="swap-pigeon-img">[ IMAGE ]</div>
      <div class="swap-pigeon-num">P!GE0N :: #${p.num}</div>
      <div class="swap-pigeon-trait">${p.trait}</div>
      <div class="swap-pigeon-status">STATUS :: ${selectable ? 'OWNED' : 'REQUESTED'}</div>
    </div>`;
}

const SWAP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>Σκύλλα SWAP :: PR0T0C0L 0FFL!NE</title>
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
    opacity:0.26;
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
    word-break:break-word;
    overflow-wrap:anywhere;
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
    margin-bottom:3rem;
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
    margin-bottom:2rem;
  }
  .sw-panel-title{
    font-size:12px;
    letter-spacing:0.2em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    text-align:center;
    margin-bottom:0.25rem;
    text-transform:none;
  }
  .sw-panel-sub{
    font-size:10px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.35);
    text-align:center;
    margin-bottom:1.5rem;
    text-transform:uppercase;
  }

  /* wallet section */
  .wallet-box{
    text-align:center;
  }
  .wallet-row{
    font-size:11px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.45);
    margin-bottom:0.5rem;
    text-transform:uppercase;
  }
  .wallet-state{
    font-size:14px;
    letter-spacing:0.08em;
    color:#ff003c;
    text-shadow:0 0 6px rgba(255,0,60,0.4);
    margin-bottom:1.25rem;
    text-transform:uppercase;
  }
  .connect-btn-disabled{
    display:inline-block;
    background:transparent;
    border:1px solid rgba(57,255,20,0.25);
    color:rgba(232,232,232,0.3);
    font-family:inherit;
    font-size:13px;
    letter-spacing:0.15em;
    padding:0.8em 1.6em;
    text-transform:uppercase;
    cursor:not-allowed;
    user-select:none;
  }
  .wallet-footnote{
    margin-top:1.25rem;
    font-size:10px;
    letter-spacing:0.1em;
    color:rgba(255,0,60,0.6);
    text-transform:uppercase;
  }

  /* swap grid */
  .swap-grid{
    display:grid;
    grid-template-columns:1fr auto 1fr;
    gap:1.25rem;
    align-items:start;
  }
  @media (max-width:640px){
    .swap-grid{ grid-template-columns:1fr; }
    .swap-arrow{ transform:rotate(90deg); margin:0.5rem auto; }
  }
  .swap-side{
    border:1px solid rgba(57,255,20,0.2);
    padding:1.1rem;
  }
  .swap-side-label{
    font-size:11px;
    letter-spacing:0.2em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    text-align:center;
    margin-bottom:0.25rem;
    text-transform:uppercase;
  }
  .swap-side.theirs .swap-side-label{
    color:#00fff2;
    text-shadow:0 0 6px rgba(0,255,242,0.4);
  }
  .swap-side-sub{
    font-size:9px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.3);
    text-align:center;
    margin-bottom:1rem;
    text-transform:uppercase;
  }
  .swap-arrow{
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:22px;
    color:rgba(232,232,232,0.35);
    padding-top:2.5rem;
  }
  .swap-pigeon-list{
    display:grid;
    grid-template-columns:repeat(2, 1fr);
    gap:0.75rem;
  }
  .swap-pigeon-card{
    border:1px solid rgba(57,255,20,0.2);
    padding:0.6rem;
    text-align:center;
    transition:border-color 0.15s ease, opacity 0.15s ease;
  }
  .swap-pigeon-card.selectable{ cursor:pointer; }
  .swap-pigeon-card.selected{
    border-color:#39ff14;
    box-shadow:0 0 10px rgba(57,255,20,0.25) inset;
  }
  .swap-pigeon-card:not(.selectable){ opacity:0.75; border-color:rgba(0,255,242,0.2); }
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
    font-size:10px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.3);
    margin-bottom:0.5rem;
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
    margin-bottom:0.35rem;
    text-transform:uppercase;
  }
  .swap-pigeon-status{
    font-size:9px;
    letter-spacing:0.1em;
    color:rgba(57,255,20,0.6);
    text-transform:uppercase;
  }
  .swap-side.theirs .swap-pigeon-status{ color:rgba(0,255,242,0.6); }

  /* summary */
  .summary-box{
    border:1px dashed rgba(57,255,20,0.35);
    padding:1.5rem;
    text-align:center;
    margin-bottom:2rem;
  }
  .summary-title{
    font-size:12px;
    letter-spacing:0.25em;
    color:#fff;
    margin-bottom:1.25rem;
    text-transform:none;
  }
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
    <div class="sw-status-lines">
      // TRUSTLESS ASSET EXCHANGE<br>
      // PR0T0C0L STATUS :: <span class="offline">0FFL!NE</span>
    </div>

    <div class="sw-panel wallet-box">
      <div class="sw-panel-title">PART!C!PANT</div>
      <div class="wallet-row">WALLET</div>
      <div class="wallet-state">N0T C0NNECTED</div>
      <button class="connect-btn-disabled" id="connectWalletBtn" disabled aria-disabled="true" title="PR0T0C0L 0FFL!NE">[ C0NNECT WALLET ]</button>
      <div class="wallet-footnote">PR0T0C0L STATUS :: 0FFL!NE</div>
    </div>

    <div class="sw-panel">
      <div class="sw-panel-title">Σκύλλα SWAP</div>
      <div class="sw-panel-sub">SECURE ASSET EXCHANGE :: PR0T0TYPE</div>

      <div class="swap-grid">
        <div class="swap-side yours">
          <div class="swap-side-label">Y0UR 0FFER</div>
          <div class="swap-side-sub">P!GE0NS :: SELECT T0 0FFER (DEM0 0NLY)</div>
          <div class="swap-pigeon-list" id="yourList">
            ${SAMPLE_YOUR_PIGEONS.map(p => pigeonCardHtml(p, 'your')).join('')}
          </div>
        </div>

        <div class="swap-arrow">⇄</div>

        <div class="swap-side theirs">
          <div class="swap-side-label">THE!R 0FFER</div>
          <div class="swap-side-sub">P!GE0NS :: REQUESTED (SAMPLE)</div>
          <div class="swap-pigeon-list" id="theirList">
            ${SAMPLE_THEIR_PIGEONS.map(p => pigeonCardHtml(p, 'their')).join('')}
          </div>
        </div>
      </div>
    </div>

    <div class="summary-box">
      <div class="summary-title">Σκύλλα SWAP</div>
      <div class="summary-row"><span class="label">0FFER</span><span class="value" id="offerCount">0 P!GE0NS</span></div>
      <div class="summary-row"><span class="label">REQUEST</span><span class="value" id="requestCount">${SAMPLE_THEIR_PIGEONS.length} P!GE0NS</span></div>
      <div class="summary-row"><span class="label">AT0M!C!TY</span><span class="value atomic">ALL 0R N0TH!NG</span></div>
      <div class="summary-row"><span class="label">STATUS</span><span class="value offline">PR0T0C0L 0FFL!NE</span></div>
    </div>

    <div class="protocol-footer">TH!S !S A PR0T0TYPE !NTERFACE. N0 ASSETS CAN BE M0VED, S!GNED, 0R TRANSFERRED.</div>
  </div>

<script>
  ${SWAP_PROTOCOL_STUB_JS}

  // TV static background, purely atmospheric — matches the rest of the site.
  (function(){
    const canvas = document.getElementById('staticBg');
    const ctx = canvas.getContext('2d');
    function resize(){
      canvas.width = Math.max(1, Math.floor(window.innerWidth / 3));
      canvas.height = Math.max(1, Math.floor(window.innerHeight / 3));
    }
    resize();
    window.addEventListener('resize', resize);
    function drawStatic(){
      const w = canvas.width, h = canvas.height;
      const imageData = ctx.createImageData(w, h);
      const buffer = imageData.data;
      for(let i=0; i<buffer.length; i+=4){
        const shade = Math.random() * 255;
        buffer[i] = shade; buffer[i+1] = shade; buffer[i+2] = shade; buffer[i+3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    function loop(){ drawStatic(); requestAnimationFrame(loop); }
    loop();
  })();

  // Local, client-side-only "selection" demo for the prototype cards.
  // Purely visual — does not touch any wallet, network, or XRPL state.
  const offerCountEl = document.getElementById('offerCount');
  document.querySelectorAll('#yourList .swap-pigeon-card.selectable').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
      const selected = document.querySelectorAll('#yourList .swap-pigeon-card.selected').length;
      offerCountEl.textContent = selected + ' P!GE0N' + (selected === 1 ? '' : 'S');
    });
  });
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(SWAP_HTML, { headers: { 'Content-Type': 'text/html' } });
}
