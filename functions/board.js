import {
  COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findPigeon, findAllPigeons, getBestPigeonWordLimit, getPigeonThumbnails
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
  const wallet = escapeHtml(msg.acct ? msg.acct.slice(0, 6) + '...' + msg.acct.slice(-4) : 'UNKN0WN');
  const signer = msg.name ? `${escapeHtml(msg.name)} · ${wallet}` : wallet;
  const avatar = msg.image
    ? `<img class="msg-avatar" src="${escapeHtml(msg.image)}" alt="" loading="lazy">`
    : `<div class="msg-avatar msg-avatar-blank"></div>`;
  return `
    <div class="msg-row">
      ${avatar}
      <div class="msg-body">
        <div class="msg-binary">${binary}</div>
        ${canDecode ? `<div class="msg-plain">${escapeHtml(msg.text)}</div>` : ''}
        <div class="msg-meta">S!GNED :: ${signer}</div>
      </div>
    </div>`;
}

function renderPage({ messages, isPigeon, hasSession, wordLimit, pigeonThumbs }) {
  const messageRows = messages.length
    ? messages.map(m => renderMessageRow(m, isPigeon)).join('')
    : `<div class="empty">N0 MESSAGES YET.</div>`;

  const thumbPicker = (isPigeon && pigeonThumbs && pigeonThumbs.length) ? `
      <div class="sig-label">ATTACH A P!GE0N</div>
      <div class="pigeon-picker" id="pigeonPicker">
        ${pigeonThumbs.map((p, i) => `<img class="pigeon-thumb${i === 0 ? ' selected' : ''}" src="${escapeHtml(p.image)}" data-nft="${escapeHtml(p.nftId)}" alt="">`).join('')}
      </div>
  ` : '';

  const writeSection = isPigeon ? `
    <div class="write-box">
      <div class="write-label">WR!TE A MESSAGE (P!GE0N S!GNATURE REQU!RED :: MAX ${wordLimit} W0RDS)</div>
      ${thumbPicker}
      <div class="sig-label">S!GNATURE ¿ (OPT!ONAL, max 15)</div>
      <input id="nameInput" maxlength="15" placeholder="..." />
      <textarea id="msgInput" maxlength="1500" placeholder="Type, (01010100 01111001 01110000 01100101)"></textarea>
      <div class="binary-preview" id="binaryPreview"></div>
      <div class="word-count" id="wordCount"></div>
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
    display:flex;
    align-items:flex-start;
    gap:1rem;
    border:1px solid rgba(57,255,20,0.25);
    padding:1rem 1.25rem;
    margin-bottom:1rem;
  }
  .msg-body{
    flex:1;
    min-width:0;
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
    color:rgba(255,0,60,0.7);
  }
  .msg-avatar{
    flex-shrink:0;
    width:72px;
    height:72px;
    object-fit:cover;
    border:2px solid rgba(255,0,60,0.5);
    border-radius:3px;
  }
  .msg-avatar-blank{
    background:repeating-linear-gradient(
      45deg,
      rgba(57,255,20,0.04) 0px,
      rgba(57,255,20,0.04) 6px,
      transparent 6px,
      transparent 12px
    );
    border-color:rgba(57,255,20,0.15);
  }
  .pigeon-picker{
    display:flex;
    flex-wrap:wrap;
    gap:0.5rem;
    margin-bottom:1rem;
  }
  .pigeon-thumb{
    width:84px;
    height:84px;
    object-fit:cover;
    border:2px solid rgba(57,255,20,0.25);
    border-radius:4px;
    cursor:pointer;
    opacity:0.6;
    transition:opacity 0.15s ease, border-color 0.15s ease;
  }
  .pigeon-thumb:hover{ opacity:0.9; }
  .pigeon-thumb.selected{
    border-color:#39ff14;
    opacity:1;
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
  textarea, input#nameInput{
    width:100%;
    background:#000;
    border:1px solid rgba(57,255,20,0.3);
    color:#e8e8e8;
    font-family:inherit;
    font-size:13px;
    padding:0.75em;
  }
  textarea{
    resize:vertical;
    min-height:4em;
    margin-top:0.6rem;
  }
  .sig-label{
    font-size:11px;
    letter-spacing:0.1em;
    color:#ff003c;
    text-shadow:0 0 6px rgba(255,0,60,0.4);
    margin-bottom:0.5rem;
  }
  input#nameInput{
    border-color:rgba(255,0,60,0.4);
    color:#ff6b8a;
  }
  .word-count{
    margin-top:0.4rem;
    font-size:10px;
    letter-spacing:0.05em;
    color:rgba(232,232,232,0.4);
  }
  .word-count.over{ color:#ff003c; }
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
    <h1>S!GNAL FEED</h1>
    ${messageRows}
    ${writeSection}
  </div>

<script src="https://xumm.app/assets/cdn/xumm-oauth2-pkce.min.js"></script>
<script>
  const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

  ${isPigeon ? `
  const WORD_LIMIT = ${wordLimit};
  const input = document.getElementById('msgInput');
  const preview = document.getElementById('binaryPreview');
  const wordCountEl = document.getElementById('wordCount');
  const postBtn = document.getElementById('postBtn');
  let selectedNftId = '';

  const picker = document.getElementById('pigeonPicker');
  if (picker) {
    const preselected = picker.querySelector('.pigeon-thumb.selected');
    if (preselected) selectedNftId = preselected.dataset.nft || '';
    picker.querySelectorAll('.pigeon-thumb').forEach(el => {
      el.addEventListener('click', () => {
        picker.querySelectorAll('.pigeon-thumb').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        selectedNftId = el.dataset.nft || '';
      });
    });
  }

  function countWords(str){
    const trimmed = str.trim();
    return trimmed ? trimmed.split(/\\s+/).length : 0;
  }

  input.addEventListener('input', () => {
    preview.textContent = input.value.split('').map(c => c.charCodeAt(0).toString(2).padStart(8,'0')).join(' ');
    const words = countWords(input.value);
    const over = words > WORD_LIMIT;
    wordCountEl.textContent = words + ' / ' + WORD_LIMIT + ' W0RDS';
    wordCountEl.className = 'word-count' + (over ? ' over' : '');
    postBtn.disabled = over || words === 0;
  });

  document.getElementById('postBtn').addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text || countWords(text) > WORD_LIMIT) return;
    const name = document.getElementById('nameInput').value.trim().slice(0, 15);
    const btn = document.getElementById('postBtn');
    const status = document.getElementById('postStatus');
    btn.disabled = true;
    status.textContent = 'S!GN!NG...';
    try {
      const res = await fetch('/api/board', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, name, nftId: selectedNftId })
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
  let wordLimit = 0;
  let pigeonThumbs = [];

  if (token) {
    const payload = await verifyToken(token, env.Σκύλλα);
    if (payload && payload.acct) {
      hasSession = true;
      const nfts = await fetchAllAccountNfts(payload.acct);
      isPigeon = !!findPigeon(nfts);
      if (isPigeon) {
        const pigeons = findAllPigeons(nfts);
        wordLimit = await getBestPigeonWordLimit(env.coin, pigeons);
        pigeonThumbs = await getPigeonThumbnails(env.coin, pigeons);
      }
    }
  }

  return new Response(
    renderPage({ messages: messages.slice(-50).reverse(), isPigeon, hasSession, wordLimit, pigeonThumbs }),
    { headers: { 'Content-Type': 'text/html' } }
  );
}
