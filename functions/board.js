import {
  COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findPigeon
} from './_shared.js';

const BOARD_KEY = 'board_messages';

function textToBinary(str) {
  return str.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderMessageRow(msg, canDecode) {
  const binary = escapeHtml(textToBinary(msg.text));
  const signer = escapeHtml(msg.acct ? msg.acct.slice(0, 6) + '...' + msg.acct.slice(-4) : 'UNKN0WN');
  return `
    <div class="msg-row">
      <div class="msg-binary">${binary}</div>
      ${canDecode ? `<div class="msg-plain">${escapeHtml(msg.text)}</div>` : ''}
      <div class="msg-meta">S!GNED :: ${signer}</div>
    </div>`;
}

function renderPage({ messages, isPigeon, hasSession }) {
  const messageRows = messages.length
    ? messages.map(m => renderMessageRow(m, isPigeon)).join('')
    : `<div class="empty">N0 MESSAGES YET.</div>`;

  const writeSection = isPigeon ? `
    <div class="write-box">
      <div class="write-label">WR!TE A MESSAGE (P!GE0N S!GNATURE REQU!RED)</div>
      <textarea id="msgInput" maxlength="240" placeholder="Type in English — it gets signed in binary."></textarea>
      <div class="binary-preview" id="binaryPreview"></div>
      <button class="post-btn" id="postBtn">S!GN & P0ST</button>
      <div class="post-status" id="postStatus"></div>
    </div>
  ` : (hasSession
    ? `<div class="gate-note">N0 P!GE0N DETECTED :: B!NARY 0NLY. Y0U CANN0T DEC0DE 0R WR!TE HERE.</div>`
    : `<button class="connect-btn" id="connectBtn">C0NNECT WALLET</button><div class="connect-status" id="connectStatus"></div>`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🕊 THE MESSAGE B0ARD</title>
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
  }
  .page{ max-width:640px; width:100%; }
  .eyebrow{
    font-size:12px;
    letter-spacing:0.3em;
    color:#39ff14;
    text-transform:uppercase;
    opacity:0.8;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
    margin-bottom:0.75rem;
    text-align:center;
  }
  h1{
    font-size:clamp(22px,4vw,32px);
    letter-spacing:0.08em;
    color:#fff;
    text-shadow:0 0 10px rgba(57,255,20,0.25);
    margin-bottom:2rem;
    text-align:center;
  }
  .msg-row{
    border:1px solid rgba(57,255,20,0.25);
    padding:1rem 1.25rem;
    margin-bottom:1rem;
  }
  .msg-binary{
    font-size:11px;
    line-height:1.7;
    color:rgba(57,255,20,0.6);
    word-break:break-all;
  }
  .msg-plain{
    margin-top:0.6rem;
    font-size:14px;
    color:#e8e8e8;
  }
  .msg-meta{
    margin-top:0.6rem;
    font-size:10px;
    letter-spacing:0.05em;
    color:rgba(232,232,232,0.4);
  }
  .empty{
    text-align:center;
    color:rgba(232,232,232,0.4);
    font-size:13px;
    padding:2rem 0;
  }
  .write-box{
    margin-top:2rem;
    border:1px dashed rgba(57,255,20,0.4);
    padding:1.25rem;
  }
  .write-label{
    font-size:11px;
    letter-spacing:0.1em;
    color:#39ff14;
    margin-bottom:0.75rem;
  }
  textarea{
    width:100%;
    background:#000;
    border:1px solid rgba(57,255,20,0.3);
    color:#e8e8e8;
    font-family:inherit;
    font-size:13px;
    padding:0.75em;
    resize:vertical;
    min-height:4em;
  }
  .binary-preview{
    margin-top:0.6rem;
    font-size:10px;
    line-height:1.6;
    color:rgba(57,255,20,0.5);
    word-break:break-all;
    min-height:1.4em;
  }
  .post-btn, .connect-btn{
    margin-top:0.9rem;
    background:transparent;
    border:1px solid rgba(57,255,20,0.6);
    color:#39ff14;
    font-family:inherit;
    font-size:13px;
    letter-spacing:0.12em;
    padding:0.7em 1.4em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .post-btn:hover, .connect-btn:hover{ background:rgba(57,255,20,0.1); }
  .post-btn:disabled, .connect-btn:disabled{ opacity:0.5; cursor:default; }
  .post-status, .connect-status{
    margin-top:0.6rem;
    font-size:12px;
    min-height:1.4em;
    color:#39ff14;
  }
  .gate-note{
    margin-top:2rem;
    text-align:center;
    font-size:12px;
    letter-spacing:0.05em;
    color:rgba(255,0,60,0.75);
  }
</style>
</head>
<body>
  <div class="page">
    <div class="eyebrow">🕊 THE MESSAGE B0ARD</div>
    <h1>SIGNAL FEED</h1>
    ${messageRows}
    ${writeSection}
  </div>

<script src="https://xumm.app/assets/cdn/xumm-oauth2-pkce.min.js"></script>
<script>
  const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

  ${isPigeon ? `
  const input = document.getElementById('msgInput');
  const preview = document.getElementById('binaryPreview');
  input.addEventListener('input', () => {
    preview.textContent = input.value.split('').map(c => c.charCodeAt(0).toString(2).padStart(8,'0')).join(' ');
  });

  document.getElementById('postBtn').addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    const btn = document.getElementById('postBtn');
    const status = document.getElementById('postStatus');
    btn.disabled = true;
    status.textContent = 'S!GN!NG...';
    try {
      const res = await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.ok) {
        status.textContent = 'P0STED :: REFRESH!NG...';
        setTimeout(() => location.reload(), 800);
      } else {
        status.textContent = 'ERR://P0ST REJECTED';
        btn.disabled = false;
      }
    } catch (e) {
      status.textContent = 'ERR://SIGNAL_LOST';
      btn.disabled = false;
    }
  });
  ` : (!hasSession ? `
  let xummAuth = null;
  function getAuth(){
    if(!xummAuth){
      xummAuth = new XummPkce(XAMAN_API_KEY, {
        implicit: true,
        rememberJwt: false,
        redirectUrl: 'https://soitbegins.xyz/'
      });
      xummAuth.on('error', (err)=>{
        document.getElementById('connectStatus').textContent = 'ERR://LOGIN_ABORTED';
        document.getElementById('connectBtn').disabled = false;
      });
      xummAuth.on('success', async ()=>{
        const state = await xummAuth.state();
        const jwt = state && state.jwt;
        if(!jwt){ document.getElementById('connectStatus').textContent = 'ERR://NO_WALLET_DATA'; return; }
        document.getElementById('connectStatus').textContent = 'VER!FY!NG...';
        const res = await fetch('/api/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jwt })
        });
        const data = await res.json();
        if (data.granted) {
          location.reload();
        } else {
          document.getElementById('connectStatus').textContent = 'N0 ACCESS KEY 0N TH!S WALLET';
        }
      });
    }
    return xummAuth;
  }
  document.getElementById('connectBtn').addEventListener('click', ()=>{
    document.getElementById('connectBtn').disabled = true;
    document.getElementById('connectStatus').textContent = 'OPEN!NG SECURE CHANNEL...';
    getAuth().authorize();
  });
  ` : '')}
</script>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
    return new Response('server misconfigured', { status: 500 });
  }

  const raw = await env.coin.get(BOARD_KEY);
  const messages = raw ? JSON.parse(raw) : [];

  const token = getCookie(request, COOKIE_NAME);
  let isPigeon = false;
  let hasSession = false;

  if (token) {
    const payload = await verifyToken(token, env.Σκύλλα);
    if (payload && payload.acct) {
      hasSession = true;
      const nfts = await fetchAllAccountNfts(payload.acct);
      isPigeon = !!findPigeon(nfts);
    }
  }

  return new Response(
    renderPage({ messages: messages.slice(-50).reverse(), isPigeon, hasSession }),
    { headers: { 'Content-Type': 'text/html' } }
  );
}
