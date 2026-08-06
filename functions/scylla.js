const SCYLLA_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Σκύλλα :: SCAN</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ height:100%; background:#08080a; overflow:hidden; }
  body{
    font-family:'JetBrains Mono','Courier New',monospace;
    color:#e8e8e8;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
  }
  .page{ max-width:520px; width:100%; padding:6vw; }
  .eyebrow{
    font-size:12px;
    letter-spacing:0.3em;
    color:#39ff14;
    text-transform:uppercase;
    opacity:0.8;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
    margin-bottom:0.75rem;
  }
  h1{
    font-size:clamp(24px,4.5vw,38px);
    letter-spacing:0.08em;
    color:#fff;
    text-shadow:0 0 10px rgba(57,255,20,0.25);
    margin-bottom:1.5rem;
    line-height:1.2;
  }
  .intro{
    font-size:14px;
    line-height:1.7;
    color:rgba(232,232,232,0.7);
    margin-bottom:2.5rem;
  }
  .scan-btn{
    background:transparent;
    border:1px solid rgba(57,255,20,0.6);
    color:#39ff14;
    font-family:inherit;
    font-size:14px;
    letter-spacing:0.15em;
    padding:0.9em 1.8em;
    cursor:pointer;
    text-transform:uppercase;
    text-shadow:0 0 6px rgba(57,255,20,0.6);
  }
  .scan-btn:hover{ background:rgba(57,255,20,0.12); }
  .scan-btn:disabled{ opacity:0.5; cursor:default; }
  .scan-status{
    margin-top:1.25rem;
    font-size:13px;
    min-height:1.4em;
    color:#39ff14;
  }
  .scan-status.denied{ color:#ff003c; }
  .mf-entry-link{
    display:inline-block;
    margin-top:2.5rem;
    font-size:10px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.25);
    text-decoration:none;
  }
  .mf-entry-link:hover{ color:rgba(232,232,232,0.5); }

  .scan-overlay{
    position:fixed;
    inset:0;
    z-index:50;
    background:#08080a;
    display:none;
    align-items:center;
    justify-content:center;
    text-align:center;
  }
  .scan-overlay.active{ display:flex; }
  .scan-overlay-inner{ max-width:480px; padding:6vw; }
  .scan-title{
    font-size:clamp(20px,4vw,32px);
    letter-spacing:0.12em;
    color:#39ff14;
    text-shadow:0 0 14px rgba(57,255,20,0.5);
    margin-bottom:2rem;
  }
  .scan-line{
    font-size:14px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.5);
    margin-bottom:0.9rem;
    opacity:0;
    transition:opacity 0.3s ease;
  }
  .scan-line.show{ opacity:1; }
  .scan-line .result{ color:#39ff14; }
  .scan-cursor{
    display:inline-block;
    width:8px;
    height:1em;
    background:#39ff14;
    vertical-align:-2px;
    margin-left:4px;
    animation:blink 0.6s step-end infinite;
  }
  @keyframes blink{
    0%, 50%{ opacity:1; }
    51%, 100%{ opacity:0; }
  }
</style>
</head>
<body>

  <div class="page" id="page">
    <div class="eyebrow">SCYLLA :: SECURITY LAYER</div>
    <h1>SCAN YOUR WALLET</h1>
    <p class="intro">Present a GL!TCH key or Σκύλλα card to begin.</p>
    <button class="scan-btn" id="scanBtn">BEG!N SCAN</button>
    <div class="scan-status" id="scanStatus"></div>
    <a class="mf-entry-link" href="/mainframe">[ DEEP SCAN PR0T0C0L ]</a>
  </div>

  <div class="scan-overlay" id="scanOverlay">
    <div class="scan-overlay-inner">
      <div class="scan-title">SCANN!NG WALLET<span class="scan-cursor"></span></div>
      <div class="scan-line" id="line1">K!NG S!GNATURE........<span class="result" id="r1"></span></div>
      <div class="scan-line" id="line2">H0NEYP0T........<span class="result" id="r2"></span></div>
      <div class="scan-line" id="line3">C0MP!L!NG RESULTS...</div>
    </div>
  </div>

<script src="https://xumm.app/assets/cdn/xumm-oauth2-pkce.min.js"></script>
<script>
  const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';
  const scanBtn = document.getElementById('scanBtn');
  const scanStatus = document.getElementById('scanStatus');
  const overlay = document.getElementById('scanOverlay');

  function setStatus(text, cls){
    scanStatus.textContent = text;
    scanStatus.className = 'scan-status' + (cls ? ' ' + cls : '');
  }

  async function verifyAccess(jwt){
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jwt })
    });
    if(!res.ok) throw new Error('verify_failed_' + res.status);
    return res.json();
  }

  function runScanAnimation(){
    return new Promise(resolve => {
      overlay.classList.add('active');
      const l1 = document.getElementById('line1');
      const l2 = document.getElementById('line2');
      const l3 = document.getElementById('line3');
      const r1 = document.getElementById('r1');
      const r2 = document.getElementById('r2');
      setTimeout(()=>{ l1.classList.add('show'); r1.textContent = 'CHECK1NG'; }, 300);
      setTimeout(()=>{ r1.textContent = '...'; }, 900);
      setTimeout(()=>{ l2.classList.add('show'); r2.textContent = 'CHECK1NG'; }, 1300);
      setTimeout(()=>{ r2.textContent = '...'; }, 1900);
      setTimeout(()=>{ l3.classList.add('show'); }, 2300);
      setTimeout(resolve, 3200);
    });
  }

  let xummAuth = null;
  function getAuth(){
    if(!xummAuth){
      xummAuth = new XummPkce(XAMAN_API_KEY, {
        implicit: true,
        rememberJwt: false,
        redirectUrl: 'https://soitbegins.xyz/scylla'
      });
      xummAuth.on('error', (err)=>{
        console.error('Xaman auth error', err);
        setStatus('ERR://LOGIN_ABORTED — TRY AGAIN', 'denied');
        scanBtn.disabled = false;
      });
      xummAuth.on('success', async ()=>{
        try{
          const state = await xummAuth.state();
          const jwt = state && state.jwt;
          const account = state && state.me && state.me.account;
          if(!jwt){
            setStatus('ERR://NO_WALLET_DATA', 'denied');
            scanBtn.disabled = false;
            return;
          }
          setStatus('WALLET LINKED...', '');
          const result = await verifyAccess(jwt);
          if(result.granted){
            await runScanAnimation();
            window.location.href = '/crwn';
          } else {
            setStatus('N0 S!GNATURES F0UND — RED!RECT!NG...', '');
            setTimeout(()=>{ window.location.href = '/begin?addr=' + encodeURIComponent(account || ''); }, 800);
          }
        } catch(e){
          console.error(e);
          setStatus('ERR://SIGNAL_LOST — TRY AGAIN', 'denied');
          scanBtn.disabled = false;
        }
      });
    }
    return xummAuth;
  }
  // Instantiate immediately so a page load that's actually a mobile
  // return-from-Xaman redirect gets its pending auth state picked up
  // automatically, instead of sitting inert until a second click.
  getAuth();

  scanBtn.addEventListener('click', ()=>{
    scanBtn.disabled = true;
    setStatus('OPENING SECURE CHANNEL :: SIGN IN WITH XAMAN...', '');
    getAuth().authorize();
  });
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(SCYLLA_HTML, { headers: { 'Content-Type': 'text/html' } });
}
