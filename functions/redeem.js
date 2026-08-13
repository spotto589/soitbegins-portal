import {
  COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findStaticVanityKey, getStaticVanityKeyInfo
} from './_shared.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// STAT!C Key redemption terminal. Gated by the same glitch_access session
// the front page's Signal Assessment already establishes (see
// /api/verify.js), then re-checked here against actual on-chain possession
// of a STAT!C Vanity Collector's Key (Deeptide "king" shop, taxon 13) — a
// distinct collection from Kingdom's King NFTs.
//
// The "authorization" for redemption itself is still the Phase 1 mock
// condition tested via /api/scylla-mock-redeem (untouched). The client
// re-verifies card possession via /api/redeem-verify-card immediately
// before calling it, so PROCEED isn't just trusting the page-load state.
function renderNoKeyBody() {
  return `
    <div class="rd-denied">
      <div class="rd-denied-title">⚠ SIGNAL UNCONFIRMED ⚠</div>
      <div class="rd-denied-sub">N0 STAT!C KEY DETECTED</div>
      <div class="rd-denied-body">TH!S WALLET H0LDS N0 STAT!C VAN!TY C0LLECT0R'S KEY. Σκύλλα D0ES N0T REC0GN!SE Y0U.</div>
    </div>`;
}

function renderConfirmedBody(keyNumber, keyAddress) {
  const safeNumber = keyNumber !== null ? escapeHtml(String(keyNumber)) : '????';
  const safeAddress = escapeHtml(keyAddress || 'UNKN0WN');
  return `
    <div class="rd-status-block">
      <div class="rd-signal-confirmed">SIGNAL CONFIRMED</div>
      <div class="rd-possession-label">YOU ARE IN POSSESSION OF:</div>
      <div class="rd-key-box">
        <div class="rd-key-label">STAT!C KEY #${safeNumber}</div>
        <div class="rd-key-addr">${safeAddress}</div>
      </div>
    </div>

    <div class="rd-section">
      <p class="rd-verify-line">
        THE SIGNAL HAS BEEN VERIFIED.<br>
        <strong>ARE YOU HERE TO REDEEM YOUR KEY?</strong>
      </p>
      <p class="rd-irreversible-note">
        This action is irreversible. Once the key is redeemed, the secret key will be released once
        and the redemption will be permanently consumed.
      </p>
    </div>

    <div class="rd-section">
      <div class="rd-heading">BEFORE YOU PROCEED</div>
      <ul class="rd-steps">
        <li>The secret key will be revealed.</li>
        <li>Be prepared to securely import the secret key into an XRPL wallet.</li>
        <li>Once the account is accessible, establish a Regular Key for the account.</li>
        <li>Verify that the Regular Key provides the intended access.</li>
        <li>Disable the master-key capability only after the Regular Key has been successfully established and verified.</li>
        <li>The Regular Key can then be used as the account's ongoing access method.</li>
      </ul>
    </div>

    <div class="rd-section">
      <div class="rd-warning">
        <p>The secret key is the private credential that provides control of the XRPL account. Treat it as highly sensitive information. Anyone who obtains it may be able to control the account.</p>
        <p>The secret key must never be entered into the STAT!C website, submitted to Σκύλλα, or shared with anyone.</p>
      </div>
    </div>

    <div class="rd-confirm" id="rdConfirm">
      <div class="rd-confirm-title">⚠ IRREVERSIBLE ACTION</div>
      <div class="rd-confirm-checkline">
        <input type="checkbox" id="rdUnderstandCheck">
        <label for="rdUnderstandCheck">I UNDERSTAND THAT REDEEMING THIS KEY WILL RELEASE THE SECRET KEY AND CONSUME THIS REDEMPTION.</label>
      </div>
      <div class="rd-confirm-btns">
        <button class="rd-proceed-btn" id="rdProceedBtn" disabled>PROCEED TO REDEMPTION</button>
        <button class="rd-abort-btn" id="rdAbortBtn">ABORT</button>
      </div>
      <div class="rd-confirm-status" id="rdConfirmStatus"></div>
    </div>

    <div class="rd-reveal" id="rdReveal">
      <div class="rd-reveal-ok">VAN!TY KEY 0K</div>
      <div class="rd-reveal-title">MASTER SIGNAL RELEASED</div>
      <div class="rd-reveal-panel">
        <div class="rd-reveal-secret" id="rdRevealSecret"></div>
      </div>
      <button class="rd-copy-btn" id="rdCopyBtn">COPY</button>
      <div class="rd-reveal-footnote">MOCK REDEMPTION :: TEST MASTER, NOT A REAL XRPL SECRET.</div>
    </div>`;
}

function renderPage(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>Σκύλλα :: SIGNAL ASSESSMENT</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#050506; }
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
    position:fixed; inset:0; width:100%; height:100%; z-index:0;
    opacity:0.16; filter:brightness(0.6) contrast(1.3); mix-blend-mode:screen;
  }
  .scanlines{
    position:fixed; inset:0; z-index:1; pointer-events:none;
    background:repeating-linear-gradient(to bottom, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 3px);
  }
  .page{ max-width:640px; width:100%; position:relative; z-index:2; }

  .rd-eyebrow{
    font-size:11px; letter-spacing:0.3em; color:rgba(0,255,242,0.75); text-transform:uppercase;
    text-align:center; margin-bottom:2.5rem; text-shadow:0 0 6px rgba(0,255,242,0.4);
  }

  .rd-denied{ text-align:center; border:1px solid rgba(255,0,60,0.4); background:rgba(255,0,60,0.04); padding:2rem 1.5rem; }
  .rd-denied-title{ font-size:16px; letter-spacing:0.08em; color:#ff003c; text-shadow:0 0 8px rgba(255,0,60,0.6); font-weight:700; margin-bottom:0.5rem; }
  .rd-denied-sub{ font-size:20px; letter-spacing:0.06em; color:#ff003c; font-weight:700; margin-bottom:1rem; }
  .rd-denied-body{ font-size:12px; color:rgba(232,232,232,0.7); line-height:1.7; }

  .rd-status-block{ text-align:center; margin-bottom:2.5rem; }
  .rd-signal-confirmed{
    font-size:clamp(18px,3.6vw,24px); font-weight:700; letter-spacing:0.1em; color:#39ff14;
    text-shadow:0 0 10px rgba(57,255,20,0.5); margin-bottom:1.5rem;
  }
  .rd-possession-label{ font-size:12px; letter-spacing:0.15em; color:rgba(232,232,232,0.55); margin-bottom:0.9rem; }
  .rd-key-box{
    display:inline-block; border:1px solid rgba(255,215,0,0.4); background:rgba(255,215,0,0.03);
    padding:1rem 1.4rem; text-align:left;
  }
  .rd-key-label{ font-size:11px; letter-spacing:0.2em; color:#ffd700; margin-bottom:0.5rem; }
  .rd-key-addr{ font-size:13px; letter-spacing:0.03em; color:#e8e8e8; word-break:break-all; }

  .rd-section{ margin-bottom:2.25rem; }
  .rd-verify-line{
    text-align:center; font-size:13px; letter-spacing:0.08em; line-height:1.9; color:rgba(232,232,232,0.8);
  }
  .rd-verify-line strong{ color:#e8e8e8; }
  .rd-irreversible-note{
    text-align:center; font-size:12px; letter-spacing:0.05em; color:#ff6b6b; margin-top:0.9rem; line-height:1.7;
  }

  .rd-heading{
    font-size:11px; letter-spacing:0.2em; color:rgba(232,232,232,0.5); text-transform:uppercase;
    margin-bottom:0.9rem;
  }
  .rd-steps{ list-style:none; }
  .rd-steps li{
    font-size:12.5px; line-height:1.9; color:rgba(232,232,232,0.75); padding-left:1.4em; position:relative;
  }
  .rd-steps li::before{ content:"→"; position:absolute; left:0; color:rgba(0,255,242,0.6); }

  .rd-warning{
    border:1px solid rgba(255,0,60,0.4); background:rgba(255,0,60,0.04); padding:1.25rem 1.4rem;
  }
  .rd-warning p{ font-size:12.5px; line-height:1.85; color:rgba(232,232,232,0.85); margin-bottom:0.9rem; }
  .rd-warning p:last-child{ margin-bottom:0; font-weight:700; color:#ff5a7a; }

  .rd-confirm{
    border:1px solid rgba(255,0,60,0.55); padding:1.5rem 1.4rem; text-align:center;
  }
  .rd-confirm-title{
    font-size:14px; font-weight:700; letter-spacing:0.15em; color:#ff003c;
    text-shadow:0 0 8px rgba(255,0,60,0.6); margin-bottom:1.1rem;
  }
  .rd-confirm-checkline{
    display:flex; align-items:flex-start; gap:0.7em; text-align:left; margin-bottom:1.4rem;
  }
  .rd-confirm-checkline input{ margin-top:0.2em; flex:0 0 auto; }
  .rd-confirm-checkline label{ font-size:12px; letter-spacing:0.04em; line-height:1.6; color:rgba(232,232,232,0.85); }
  .rd-confirm-btns{ display:flex; flex-wrap:wrap; gap:0.9rem; justify-content:center; }

  .rd-proceed-btn{
    background:#ff003c; border:2px solid #000; color:#fff; font-family:inherit; font-weight:700;
    font-size:13px; letter-spacing:0.14em; padding:1em 1.8em; cursor:pointer; text-transform:uppercase;
    text-shadow:0 0 6px rgba(0,0,0,0.5); box-shadow:0 0 0 1px rgba(255,0,60,0.5);
  }
  .rd-proceed-btn:hover:not(:disabled){ background:#ff2a5c; }
  .rd-proceed-btn:disabled{ opacity:0.35; cursor:default; box-shadow:none; }
  .rd-abort-btn{
    background:transparent; border:1px solid rgba(232,232,232,0.3); color:rgba(232,232,232,0.75);
    font-family:inherit; font-size:12px; letter-spacing:0.1em; padding:1em 1.6em; cursor:pointer; text-transform:uppercase;
  }
  .rd-abort-btn:hover{ background:rgba(232,232,232,0.08); color:#e8e8e8; }

  .rd-confirm-status{ margin-top:1.1rem; font-size:12px; min-height:1.4em; color:#39ff14; letter-spacing:0.06em; }
  .rd-confirm-status.denied{ color:#ff003c; }

  .rd-reveal{
    display:none; border:1px solid rgba(57,255,20,0.5); background:#08080a; padding:1.75rem 1.5rem; text-align:center;
  }
  .rd-reveal.show{ display:block; }
  .rd-reveal-ok{
    font-size:13px; letter-spacing:0.15em; color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.5); margin-bottom:0.5rem;
  }
  .rd-reveal-title{
    font-size:clamp(15px,3vw,19px); font-weight:700; letter-spacing:0.12em; color:#fff;
    text-shadow:0 0 10px rgba(255,255,255,0.2); margin-bottom:1.4rem;
  }
  .rd-reveal-panel{
    border:1px dashed rgba(57,255,20,0.5); background:rgba(57,255,20,0.03); padding:1.1rem 1.2rem; margin-bottom:1rem;
  }
  .rd-reveal-secret{
    font-size:15px; letter-spacing:0.04em; color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.5); word-break:break-all;
  }
  .rd-copy-btn{
    background:transparent; border:1px solid rgba(57,255,20,0.5); color:#39ff14; font-family:inherit;
    font-size:11px; letter-spacing:0.1em; padding:0.6em 1.2em; cursor:pointer; text-transform:uppercase;
  }
  .rd-copy-btn:hover{ background:rgba(57,255,20,0.1); }
  .rd-reveal-footnote{
    margin-top:1.1rem; font-size:10.5px; letter-spacing:0.04em; color:rgba(232,232,232,0.4); line-height:1.7;
  }
</style>
</head>
<body>
  <canvas id="staticBg"></canvas>
  <div class="scanlines"></div>

  <div class="page">
    <div class="rd-eyebrow">Σκύλλα // SIGNAL ASSESSMENT</div>
    ${bodyHtml}
  </div>

<script>
  (function(){
    const canvas = document.getElementById('staticBg');
    const ctx = canvas.getContext('2d');
    function resize(){ canvas.width = window.innerWidth / 3; canvas.height = window.innerHeight / 3; }
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

  const understandCheck = document.getElementById('rdUnderstandCheck');
  const proceedBtn = document.getElementById('rdProceedBtn');
  const abortBtn = document.getElementById('rdAbortBtn');

  if (proceedBtn) {
    const confirmStatus = document.getElementById('rdConfirmStatus');
    const confirmBlock = document.getElementById('rdConfirm');
    const reveal = document.getElementById('rdReveal');
    const revealSecret = document.getElementById('rdRevealSecret');
    const copyBtn = document.getElementById('rdCopyBtn');

    understandCheck.addEventListener('change', () => {
      proceedBtn.disabled = !understandCheck.checked;
    });

    abortBtn.addEventListener('click', () => {
      window.location.href = '/';
    });

    function setDenied(text){
      confirmStatus.className = 'rd-confirm-status denied';
      confirmStatus.textContent = text;
      proceedBtn.disabled = false;
      abortBtn.disabled = false;
      understandCheck.disabled = false;
    }

    proceedBtn.addEventListener('click', async () => {
      proceedBtn.disabled = true;
      abortBtn.disabled = true;
      understandCheck.disabled = true;
      confirmStatus.className = 'rd-confirm-status';
      confirmStatus.textContent = 'RE-CHECK!NG CARD...';
      try {
        const checkRes = await fetch('/api/redeem-verify-card', { method: 'POST' });
        const checkData = await checkRes.json();
        if (!checkData.ok) {
          setDenied('CARD N0 L0NGER DETECTED');
          return;
        }

        confirmStatus.textContent = 'CONTACT!NG Σκύλλα...';
        const res = await fetch('/api/scylla-mock-redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mockWalletHasStatic: true })
        });
        const data = await res.json();
        if (data.granted) {
          confirmStatus.textContent = '';
          confirmBlock.style.display = 'none';
          revealSecret.textContent = data.master;
          reveal.classList.add('show');
        } else {
          setDenied('VAN!TY KEY DEN!ED');
        }
      } catch (e) {
        setDenied('ERR://SIGNAL_LOST');
      }
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(revealSecret.textContent.trim());
        copyBtn.textContent = 'C0P!ED';
        setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1500);
      } catch (e) {}
    });
  }
</script>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
    return new Response('server misconfigured', { status: 500 });
  }

  const token = getCookie(request, COOKIE_NAME);
  if (!token) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }

  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }

  const nfts = await fetchAllAccountNfts(payload.acct);
  const key = findStaticVanityKey(nfts);

  let bodyHtml;
  if (key) {
    const info = await getStaticVanityKeyInfo(key);
    bodyHtml = renderConfirmedBody(info.number, info.address);
  } else {
    bodyHtml = renderNoKeyBody();
  }

  return new Response(renderPage(bodyHtml), { headers: { 'Content-Type': 'text/html' } });
}
