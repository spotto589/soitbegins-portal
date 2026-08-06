const MAINFRAME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>UNKN0WN ACCESS P0!NT</title>
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
    position:fixed;
    inset:0;
    width:100%;
    height:100%;
    z-index:0;
    opacity:0.18;
    filter:brightness(0.6) contrast(1.3);
    mix-blend-mode:screen;
  }
  .scanlines{
    position:fixed;
    inset:0;
    z-index:1;
    pointer-events:none;
    background:repeating-linear-gradient(
      to bottom,
      rgba(255,255,255,0.04) 0px,
      rgba(255,255,255,0.04) 1px,
      transparent 1px,
      transparent 3px
    );
  }
  .page{ max-width:560px; width:100%; position:relative; z-index:2; text-align:center; }
  .eyebrow{
    font-size:11px;
    letter-spacing:0.3em;
    color:rgba(232,232,232,0.4);
    text-transform:uppercase;
    margin-bottom:1rem;
  }
  h1{
    font-size:clamp(20px,4vw,30px);
    letter-spacing:0.1em;
    color:#fff;
    text-shadow:0 0 10px rgba(232,232,232,0.2);
    margin-bottom:1.5rem;
    line-height:1.3;
  }
  .intro{
    font-size:13px;
    line-height:1.8;
    color:rgba(232,232,232,0.55);
    margin-bottom:2.5rem;
  }
  .scan-btn{
    background:transparent;
    border:1px solid rgba(232,232,232,0.35);
    color:rgba(232,232,232,0.85);
    font-family:inherit;
    font-size:13px;
    letter-spacing:0.15em;
    padding:0.9em 1.8em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .scan-btn:hover{ background:rgba(232,232,232,0.08); }
  .scan-btn:disabled{ opacity:0.4; cursor:default; }
  .scan-status{
    margin-top:1.25rem;
    font-size:12px;
    min-height:1.4em;
    color:rgba(232,232,232,0.6);
  }
  .scan-status.denied{ color:#ff003c; text-shadow:0 0 6px rgba(255,0,60,0.4); }
  .retry-line{
    margin-top:1.25rem;
    font-size:11px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.4);
  }

  .scan-overlay{
    position:fixed;
    inset:0;
    z-index:50;
    background:#050506;
    display:none;
    align-items:center;
    justify-content:center;
    text-align:center;
  }
  .scan-overlay.active{ display:flex; }
  .scan-overlay-inner{ max-width:480px; padding:6vw; }
  .scan-title{
    font-size:clamp(16px,3.4vw,24px);
    letter-spacing:0.12em;
    color:rgba(232,232,232,0.9);
    margin-bottom:2rem;
  }
  .scan-cursor{
    display:inline-block;
    width:8px;
    height:1em;
    background:#e8e8e8;
    vertical-align:-2px;
    margin-left:4px;
    animation:blink 0.6s step-end infinite;
  }
  @keyframes blink{
    0%, 50%{ opacity:1; }
    51%, 100%{ opacity:0; }
  }
  .scan-line{
    font-size:13px;
    letter-spacing:0.08em;
    color:rgba(232,232,232,0.4);
    margin-bottom:0.75rem;
    opacity:0;
    transition:opacity 0.3s ease;
  }
  .scan-line.show{ opacity:1; color:rgba(232,232,232,0.75); }
  .scan-result{
    margin-top:1.5rem;
    font-size:14px;
    letter-spacing:0.1em;
    min-height:1.6em;
  }
  .scan-result.granted{ color:#39ff14; text-shadow:0 0 8px rgba(57,255,20,0.6); }
  .scan-result.denied{ color:#ff003c; text-shadow:0 0 8px rgba(255,0,60,0.6); }
  .scan-result-sub{
    margin-top:0.5rem;
    font-size:11px;
    letter-spacing:0.08em;
    color:rgba(232,232,232,0.5);
  }

  .mainframe-content{
    position:relative;
    z-index:2;
    max-width:640px;
    width:100%;
    margin-top:2rem;
  }
  .mf-flicker{
    font-size:12px;
    letter-spacing:0.3em;
    color:#39ff14;
    text-shadow:0 0 8px rgba(57,255,20,0.6);
    margin-bottom:0.75rem;
    text-align:center;
    animation:mf-flicker 2.4s steps(1) infinite;
  }
  @keyframes mf-flicker{
    0%, 91%, 100%{ opacity:1; }
    92%{ opacity:0.3; }
    94%{ opacity:1; }
    96%{ opacity:0.2; }
    98%{ opacity:1; }
  }
  .mf-title{
    font-size:clamp(20px,4.2vw,30px);
    letter-spacing:0.1em;
    color:#fff;
    text-align:center;
    text-shadow:0 0 12px rgba(57,255,20,0.25);
    margin-bottom:3rem;
  }
  .mf-section{
    margin-bottom:3rem;
    opacity:0;
    animation:mf-reveal 0.6s ease forwards;
  }
  .mf-section:nth-of-type(1){ animation-delay:0.1s; }
  .mf-section:nth-of-type(2){ animation-delay:0.9s; }
  @keyframes mf-reveal{
    from{ opacity:0; transform:translateY(8px); }
    to{ opacity:1; transform:translateY(0); }
  }
  .mf-label{
    font-size:11px;
    letter-spacing:0.25em;
    color:rgba(0,255,242,0.8);
    text-shadow:0 0 6px rgba(0,255,242,0.4);
    margin-bottom:0.5rem;
  }
  .mf-heading{
    font-size:clamp(18px,3.6vw,24px);
    letter-spacing:0.1em;
    color:#fff;
    margin-bottom:1.5rem;
  }
  .mf-king{
    border:1px solid rgba(232,232,232,0.15);
    padding:1.25rem;
    margin-bottom:1rem;
    text-align:left;
  }
  .mf-king-tag{
    display:inline-block;
    font-size:10px;
    letter-spacing:0.2em;
    padding:0.3em 0.7em;
    margin-bottom:0.6rem;
    border:1px solid;
  }
  .mf-king-tag.false{ color:#ff003c; border-color:rgba(255,0,60,0.4); }
  .mf-king-tag.true{ color:#39ff14; border-color:rgba(57,255,20,0.4); }
  .mf-king-img{
    width:100%;
    max-width:280px;
    display:block;
    margin-bottom:1rem;
    border-radius:4px;
  }
  .mf-king.false .mf-king-img{ border:2px solid rgba(255,0,60,0.4); }
  .mf-king.true .mf-king-img{ border:2px solid rgba(57,255,20,0.4); }
  .mf-king-name{
    font-size:16px;
    letter-spacing:0.08em;
    color:#e8e8e8;
    margin-bottom:0.75rem;
  }
  .mf-list{
    list-style:none;
    margin-bottom:1rem;
  }
  .mf-list li{
    font-size:12px;
    line-height:1.8;
    color:rgba(232,232,232,0.55);
    padding-left:1em;
    position:relative;
  }
  .mf-list li::before{
    content:"::";
    position:absolute;
    left:0;
    color:rgba(232,232,232,0.3);
  }
  .mf-link{
    display:inline-block;
    font-size:12px;
    letter-spacing:0.1em;
    color:#00fff2;
    text-decoration:none;
    text-shadow:0 0 6px rgba(0,255,242,0.4);
  }
  .mf-link:hover{ text-decoration:underline; }
  .mf-crwn-box{
    border:1px dashed rgba(57,255,20,0.4);
    padding:1.25rem;
    margin-bottom:1.25rem;
    text-align:center;
  }
  .mf-crwn-row{
    font-size:11px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.5);
    margin-bottom:0.5rem;
  }
  .mf-crwn-address{
    font-size:13px;
    word-break:break-all;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
    margin-bottom:0.75rem;
  }
  .mf-copy-btn{
    background:transparent;
    border:1px solid rgba(57,255,20,0.5);
    color:#39ff14;
    font-family:inherit;
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.5em 1.1em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .mf-copy-btn:hover{ background:rgba(57,255,20,0.1); }
</style>
</head>
<body>

  <canvas id="staticBg"></canvas>
  <div class="scanlines"></div>

  <div class="page" id="page">
    <div class="eyebrow">UNKN0WN ACCESS P0!NT</div>
    <h1>A S!GNAL EX!STS HERE</h1>
    <p class="intro">Present your ledger for verification. The system will determine whether you belong.</p>
    <button class="scan-btn" id="scanBtn">!N!T!ATE SCAN</button>
    <div class="scan-status" id="scanStatus"></div>
  </div>

  <div class="scan-overlay" id="scanOverlay">
    <div class="scan-overlay-inner">
      <div class="scan-title">HACK_MA!NFRAME.exe<span class="scan-cursor"></span></div>
      <div class="scan-line" id="line1">!N!T!AL!Z!NG...</div>
      <div class="scan-line" id="line2">C0NNECT!NG T0 LEDGER...</div>
      <div class="scan-line" id="line3">SEARCH!NG S!GNAL...</div>
      <div class="scan-line" id="line4">VER!FY!NG ACCESS...</div>
      <div class="scan-result" id="scanResult"></div>
      <div class="scan-result-sub" id="scanResultSub"></div>
    </div>
  </div>

  <div class="mainframe-content" id="mainframeContent" style="display:none;">
    <div class="mf-flicker">GL!TCH KEY VER!F!ED</div>
    <div class="mf-title">WELC0ME T0 THE MA!NFRAME</div>

    <div class="mf-section">
      <div class="mf-label">H!DDEN ARCH!VE :: DEC0DED</div>
      <div class="mf-heading">THE TW0 K!NGS</div>

      <div class="mf-king false">
        <img class="mf-king-img" src="https://ipfs.io/ipfs/bafybeib2kykxegfu3wllvngmbjl7igzyt5f5pnqi4k54lbwwlpryeermp4/297.png" alt="The False King" loading="lazy">
        <div class="mf-king-tag false">K!NG 0NE</div>
        <div class="mf-king-name">THE FALSE K!NG</div>
        <ul class="mf-list">
          <li>c0rrupted arch!ve</li>
          <li>0ld rec0rds</li>
          <li>!llus!0n</li>
        </ul>
        <a class="mf-link" href="https://xrp.cafe/collection/king" target="_blank" rel="noopener">V!EW C0LLECT!0N →</a>
      </div>

      <div class="mf-king true">
        <img class="mf-king-img" src="https://ipfs.io/ipfs/bafybeib2kykxegfu3wllvngmbjl7igzyt5f5pnqi4k54lbwwlpryeermp4/2394.png" alt="The True King" loading="lazy">
        <div class="mf-king-tag true">K!NG TW0</div>
        <div class="mf-king-name">THE TRUE K!NG</div>
        <ul class="mf-list">
          <li>h!dden s!gnal</li>
          <li>ver!f!ed ledger</li>
          <li>the real path</li>
        </ul>
        <a class="mf-link" href="https://deeptide.co/king-thwncy" target="_blank" rel="noopener">BEC0ME THE S!GNAL →</a>
      </div>
    </div>

    <div class="mf-section">
      <div class="mf-label">S!GNAL F0UND...</div>
      <div class="mf-heading">CRWN NETW0RK DETECTED</div>
      <div class="mf-crwn-box">
        <div class="mf-crwn-row">TRUSTL!NE ::</div>
        <div class="mf-crwn-address" id="crwnAddress">r99LZRNxxss7eSJqKTSEvp1Xd48JGh5Vp5</div>
        <button class="mf-copy-btn" id="copyCrwnBtn">C0PY ADDRESS</button>
      </div>
      <a class="mf-link" href="/crwn">ENTER THR0NE R00M →</a>
    </div>
  </div>

<script src="https://xumm.app/assets/cdn/xumm-oauth2-pkce.min.js"></script>
<script>
  const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

  // Background static, purely atmospheric
  (function(){
    const canvas = document.getElementById('staticBg');
    const ctx = canvas.getContext('2d');
    function resize(){
      canvas.width = window.innerWidth / 3;
      canvas.height = window.innerHeight / 3;
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

  const copyCrwnBtn = document.getElementById('copyCrwnBtn');
  if (copyCrwnBtn) {
    copyCrwnBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(document.getElementById('crwnAddress').textContent.trim());
        copyCrwnBtn.textContent = 'C0P!ED';
        setTimeout(()=>{ copyCrwnBtn.textContent = 'C0PY ADDRESS'; }, 1500);
      } catch(e) {}
    });
  }

  const scanBtn = document.getElementById('scanBtn');
  const scanStatus = document.getElementById('scanStatus');
  const overlay = document.getElementById('scanOverlay');
  const page = document.getElementById('page');
  const mainframeContent = document.getElementById('mainframeContent');

  function setStatus(text, cls){
    scanStatus.textContent = text;
    scanStatus.className = 'scan-status' + (cls ? ' ' + cls : '');
  }

  function runBootSequence(){
    return new Promise(resolve => {
      overlay.classList.add('active');
      const lines = ['line1','line2','line3','line4'].map(id => document.getElementById(id));
      lines.forEach((el, i) => {
        setTimeout(()=>{ el.classList.add('show'); }, 400 + i * 550);
      });
      setTimeout(resolve, 400 + lines.length * 550 + 300);
    });
  }

  async function verifyAccess(jwt){
    const res = await fetch('/api/mainframe-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jwt })
    });
    if(!res.ok) throw new Error('verify_failed_' + res.status);
    return res.json();
  }

  function showResult(granted){
    const result = document.getElementById('scanResult');
    const sub = document.getElementById('scanResultSub');
    if (granted) {
      result.textContent = 'ACCESS GRANTED';
      result.className = 'scan-result granted';
      sub.textContent = 'AUTH0R!ZED KEY DETECTED';
    } else {
      result.textContent = 'ACCESS DEN!ED';
      result.className = 'scan-result denied';
      sub.textContent = 'N0 VAL!D S!GNAL DETECTED';
    }
  }

  let xummAuth = null;
  function getAuth(){
    if(!xummAuth){
      xummAuth = new XummPkce(XAMAN_API_KEY, {
        implicit: true,
        rememberJwt: false,
        redirectUrl: 'https://soitbegins.xyz/mainframe'
      });
      xummAuth.on('error', (err)=>{
        overlay.classList.remove('active');
        setStatus('ERR://LOGIN_ABORTED', 'denied');
        scanBtn.disabled = false;
      });
      xummAuth.on('success', async ()=>{
        try{
          const state = await xummAuth.state();
          const jwt = state && state.jwt;
          if(!jwt){
            overlay.classList.remove('active');
            setStatus('ERR://NO_WALLET_DATA', 'denied');
            scanBtn.disabled = false;
            return;
          }
          const [data] = await Promise.all([ verifyAccess(jwt), runBootSequence() ]);
          showResult(data.granted);
          if (data.granted) {
            setTimeout(()=>{
              overlay.classList.remove('active');
              page.style.display = 'none';
              mainframeContent.style.display = 'block';
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 1600);
          } else {
            setTimeout(()=>{
              overlay.classList.remove('active');
              setStatus('N0 VAL!D S!GNAL DETECTED', 'denied');
              scanBtn.disabled = false;
            }, 1600);
          }
        } catch(e){
          overlay.classList.remove('active');
          setStatus('ERR://SIGNAL_LOST', 'denied');
          scanBtn.disabled = false;
        }
      });
    }
    return xummAuth;
  }
  // Instantiate on load, not just on click, so a mobile return-from-Xaman
  // page load picks up the pending auth state automatically.
  getAuth();

  scanBtn.addEventListener('click', ()=>{
    scanBtn.disabled = true;
    setStatus('');
    getAuth().authorize();
  });
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(MAINFRAME_HTML, { headers: { 'Content-Type': 'text/html' } });
}
