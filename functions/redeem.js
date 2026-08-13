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
// before calling it, so REDEEM KEY isn't just trusting the page-load state.
function renderNoKeyBody() {
  return `
    <div class="rd-denied">
      <div class="rd-denied-title">ACCΞSS DΞN!ΞD — N0 KΣY F0UND</div>
      <div class="rd-denied-body">TH!S WALLET H0LDS N0 STAT!C VAN!TY C0LLECT0R'S KEY. Σκύλλα D0ES N0T REC0GN!SE Y0U.</div>
    </div>`;
}

function renderConfirmedBody(keyNumber, keyAddress) {
  const safeNumber = keyNumber !== null ? escapeHtml(String(keyNumber)) : '????';
  const safeAddress = escapeHtml(keyAddress || 'UNKN0WN');
  return `
    <div class="rd-banner">▓▒░ S!GNΛL RΣCΣ!VΣD ░▒▓</div>

    <div class="rd-status-block">
      <div class="rd-code-line">Σκύλλα :: S!GNΛL LOCKΣD</div>
      <div class="rd-code-line rd-key-line">STAT!C KΣY #${safeNumber}</div>
      <div class="rd-status-lines">
        <div class="rd-code-line">ΛDDRΣSS :: ${safeAddress}</div>
        <div class="rd-code-line">S!GNΛL :: VΣR!F!ΣD</div>
        <div class="rd-code-line">KΣY :: ΛUTHΣNT!C</div>
        <div class="rd-code-line">RΣDΣΣM :: ΛVΛ!LΛBLΣ</div>
      </div>
    </div>

    <div class="rd-divider"></div>

    <div class="rd-section">
      <div class="rd-warn-heading">⚠ WΛRN!NG // SΣCRΣT KΣY</div>
      <p class="rd-warn-strong">YOU ΛRΣ ΛBOUT TO RΣVΣΛL Λ SΣCRΣT KΣY.</p>
      <p>THΣ SΣCRΣT KΣY !S THΣ PR!VΛTΣ CRΣDΣNT!ΛL THΛT PROVIDΣS CONTROL OF THΣ ΛSSOC!ΛTΣD XRPL ΛCCOUNT.</p>
      <p class="rd-warn-strong">
        DO NOT SHΛRΣ !T.<br>
        DO NOT POST !T.<br>
        DO NOT SΣND !T TO ΛNYONΣ.
      </p>
      <p>ΛNYONΣ WHO OBTΛ!NS THΣ SΣCRΣT KΣY MΛY BΣ ΛBLΣ TO CONTROL THΣ ΛCCOUNT ΛND !TS ΛSSΣTS.</p>
      <p>Σκύλλα CΛNNOT RΣVOKΣ OR RΣCΛLL Λ SΣCRΣT KΣY ONCΣ !T HΛS BΣΣN RΣVΣΛLΣD.</p>
    </div>

    <div class="rd-divider"></div>

    <div class="rd-section">
      <div class="rd-warn-heading">⚠ PΣRMΛNΣNT RΣDΣMPT!ON</div>
      <p>RΣDΣΣM!NG TH!S KΣY W!LL:</p>
      <div class="rd-code-block">
        <div class="rd-code-line">// RΣVΣΛL THΣ SΣCRΣT KΣY ONCΣ</div>
        <div class="rd-code-line">// PΣRMΛNΣNTLY CONSUMΣ THΣ RΣDΣMPT!ON</div>
        <div class="rd-code-line">// CONSUMΣ THΣ ΛSSOC!ΛTΣD STAT!C KΣY</div>
        <div class="rd-code-line">// PRΣVΣNT TH!S KΣY FROM BΣ!NG RΣDΣΣMΣD ΛGΛ!N</div>
      </div>
      <p class="rd-warn-strong">THΣ RΣDΣMPT!ON CΛNNOT BΣ UNDONΣ.</p>
      <p>ONCΣ THΣ SΣCRΣT KΣY !S RΣVΣΛLΣD, THΣRΣ !S NO SΣCOND RΣVΣΛL.</p>
    </div>

    <div class="rd-divider"></div>

    <div class="rd-section">
      <div class="rd-heading2">ΛFTΣR RΣDΣMPT!ON</div>
      <p>SΣCURΣLY !MPORT THΣ SΣCRΣT KΣY !NTO ΛN XRPL-COMPΛT!BLΣ WΛLLΣT.</p>
      <p>THΣN:</p>
      <div class="rd-code-block">
        <div class="rd-code-line">01 :: ΣSTΛBL!SH RΣGULΛR KΣY</div>
        <div class="rd-code-line">02 :: VΣR!FY RΣGULΛR KΣY ΛCCΣSS</div>
        <div class="rd-code-line">03 :: ONLY ΛFTΣR VΣR!F!CΛT!ON, D!SΛBLΣ MΛSTΣR KΣY</div>
      </div>
      <p class="rd-warn-strong">NΣVΣR D!SΛBLΣ THΣ MΛSTΣR KΣY BΣFORΣ THΣ RΣGULΛR KΣY HΛS BΣΣN VΣR!F!ΣD.</p>
    </div>

    <div class="rd-divider"></div>

    <div class="rd-confirm" id="rdConfirm">
      <div class="rd-code-block rd-confirm-status-block">
        <div class="rd-code-line">S!GNΛL :: CLΣΛRΣD</div>
        <div class="rd-code-line">SΣCRΣT :: W!LL BΣ RΣVΣΛLΣD</div>
        <div class="rd-code-line">KΣY :: W!LL BΣ CONSUMΣD</div>
        <div class="rd-code-line">RΣDΣMPT!ON :: PΣRMΛNΣNT</div>
      </div>
      <div class="rd-final-warn">YOU ΛRΣ ΛBOUT TO RΣVΣΛL THΣ SΣCRΣT.</div>
      <div class="rd-confirm-btns">
        <button class="rd-proceed-btn" id="rdProceedBtn">[ RΣDΣΣM KΣY ]</button>
        <button class="rd-abort-btn" id="rdAbortBtn">[ ΛBORT ]</button>
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
      <div class="rd-timer" id="rdTimer" data-seconds="780">13:00</div>
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
<title>Σκύλλα :: KΣY ΛSSΣSSMΣNT</title>
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
    font-size:11px; letter-spacing:0.3em; color:rgba(0,255,242,0.75);
    text-align:center; margin-bottom:2.5rem; text-shadow:0 0 6px rgba(0,255,242,0.4);
  }

  .rd-denied{ text-align:center; border:1px solid rgba(255,0,60,0.4); background:rgba(255,0,60,0.04); padding:2rem 1.5rem; }
  .rd-denied-title{ font-size:16px; letter-spacing:0.08em; color:#ff003c; text-shadow:0 0 8px rgba(255,0,60,0.6); font-weight:700; margin-bottom:0.5rem; }
  .rd-denied-sub{ font-size:20px; letter-spacing:0.06em; color:#ff003c; font-weight:700; margin-bottom:1rem; }
  .rd-denied-body{ font-size:12px; color:rgba(232,232,232,0.7); line-height:1.7; }

  .rd-banner{
    text-align:center; font-size:13px; letter-spacing:0.15em; color:#39ff14;
    text-shadow:0 0 8px rgba(57,255,20,0.6); margin-bottom:1.75rem;
  }

  .rd-status-block{ text-align:center; margin-bottom:2rem; }
  .rd-code-line{
    font-size:12.5px; letter-spacing:0.06em; color:rgba(232,232,232,0.85); line-height:1.9;
  }
  .rd-key-line{
    font-size:15px; font-weight:700; letter-spacing:0.1em; color:#ffd700;
    text-shadow:0 0 8px rgba(255,215,0,0.5); margin:0.5rem 0 1rem;
  }
  .rd-status-lines{ margin-top:0.5rem; }
  .rd-status-lines .rd-code-line{ color:#39ff14; text-shadow:0 0 4px rgba(57,255,20,0.4); }

  .rd-divider{
    height:1px; background:rgba(232,232,232,0.15); margin:0 0 2rem;
  }

  .rd-section{ margin-bottom:0; }
  .rd-section p{ font-size:12.5px; line-height:1.85; letter-spacing:0.03em; color:rgba(232,232,232,0.85); margin-bottom:0.9rem; }
  .rd-section p:last-child{ margin-bottom:0; }

  .rd-warn-heading{
    font-size:13px; font-weight:700; letter-spacing:0.1em; color:#ff003c;
    text-shadow:0 0 8px rgba(255,0,60,0.6); margin-bottom:1rem;
  }
  .rd-warn-strong{ color:#ff5a7a; font-weight:700; }

  .rd-heading2{
    font-size:11px; letter-spacing:0.2em; color:rgba(232,232,232,0.5); text-transform:uppercase;
    margin-bottom:0.9rem;
  }

  .rd-code-block{
    border:1px dashed rgba(232,232,232,0.25); background:rgba(232,232,232,0.03);
    padding:0.9rem 1.1rem; margin:0.9rem 0;
  }
  .rd-code-block .rd-code-line{ color:rgba(0,255,242,0.85); }

  .rd-confirm{
    border:1px solid rgba(255,0,60,0.55); padding:1.75rem 1.4rem; text-align:center;
  }
  .rd-confirm-status-block{ text-align:left; }
  .rd-confirm-status-block .rd-code-line{ color:#ff5a7a; }
  .rd-final-warn{
    font-size:15px; font-weight:700; letter-spacing:0.08em; color:#ff003c;
    text-shadow:0 0 8px rgba(255,0,60,0.6); margin:1.4rem 0 0.5rem;
  }
  .rd-confirm-btns{ display:flex; flex-wrap:wrap; gap:0.9rem; justify-content:center; }

  .rd-proceed-btn{
    background:#ff003c; border:2px solid #000; color:#fff; font-family:inherit; font-weight:700;
    font-size:13px; letter-spacing:0.14em; padding:1em 1.8em; cursor:pointer;
    text-shadow:0 0 6px rgba(0,0,0,0.5); box-shadow:0 0 0 1px rgba(255,0,60,0.5);
  }
  .rd-proceed-btn:hover:not(:disabled){ background:#ff2a5c; }
  .rd-proceed-btn:disabled{ opacity:0.35; cursor:default; box-shadow:none; }
  .rd-abort-btn{
    background:transparent; border:1px solid rgba(232,232,232,0.3); color:rgba(232,232,232,0.75);
    font-family:inherit; font-size:12px; letter-spacing:0.1em; padding:1em 1.6em; cursor:pointer;
  }
  .rd-abort-btn:hover{ background:rgba(232,232,232,0.08); color:#e8e8e8; }

  .rd-confirm-status{ margin-top:1.1rem; font-size:12px; min-height:1.4em; color:#39ff14; letter-spacing:0.06em; }
  .rd-confirm-status.denied{ color:#ff003c; }

  .rd-reveal{
    display:none; border:1px solid rgba(57,255,20,0.5); background:#08080a; padding:1.75rem 1.5rem; text-align:center;
    margin-top:2rem;
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
  .rd-copy-btn:disabled{ opacity:0.35; cursor:default; }
  .rd-timer{
    margin-top:1.1rem; font-size:16px; font-weight:700; letter-spacing:0.1em; color:#ffd700;
    text-shadow:0 0 8px rgba(255,215,0,0.5);
  }
  .rd-timer.rd-timer-ready{ color:#ff003c; text-shadow:0 0 8px rgba(255,0,60,0.6); font-size:12px; }
  .rd-reveal-footnote{
    margin-top:1.1rem; font-size:10.5px; letter-spacing:0.04em; color:rgba(232,232,232,0.4); line-height:1.7;
  }
</style>
</head>
<body>
  <canvas id="staticBg"></canvas>
  <div class="scanlines"></div>

  <div class="page">
    <div class="rd-eyebrow">Σκύλλα // KΣY ΛSSΣSSMΣNT</div>
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

  const proceedBtn = document.getElementById('rdProceedBtn');
  const abortBtn = document.getElementById('rdAbortBtn');

  if (proceedBtn) {
    const confirmStatus = document.getElementById('rdConfirmStatus');
    const confirmBlock = document.getElementById('rdConfirm');
    const reveal = document.getElementById('rdReveal');
    const revealSecret = document.getElementById('rdRevealSecret');
    const copyBtn = document.getElementById('rdCopyBtn');
    const timerEl = document.getElementById('rdTimer');

    // 13-minute window after the secret is revealed — once it expires the
    // secret is cleared from the page and can no longer be copied.
    function startRevealTimer(){
      if (!timerEl) return;
      let secondsLeft = parseInt(timerEl.dataset.seconds, 10) || 0;
      function renderTimer(){
        const m = Math.floor(secondsLeft / 60);
        const s = secondsLeft % 60;
        timerEl.textContent = m + ':' + String(s).padStart(2, '0');
      }
      renderTimer();
      const timerInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft <= 0) {
          clearInterval(timerInterval);
          timerEl.textContent = 'W!ND0W ΞXP!RΞD';
          timerEl.classList.add('rd-timer-ready');
          revealSecret.textContent = 'ΞXP!RΞD';
          copyBtn.disabled = true;
        } else {
          renderTimer();
        }
      }, 1000);
    }

    abortBtn.addEventListener('click', () => {
      window.location.href = '/';
    });

    function setDenied(text){
      confirmStatus.className = 'rd-confirm-status denied';
      confirmStatus.textContent = text;
      proceedBtn.disabled = false;
      abortBtn.disabled = false;
    }

    proceedBtn.addEventListener('click', async () => {
      proceedBtn.disabled = true;
      abortBtn.disabled = true;
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
          startRevealTimer();
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
