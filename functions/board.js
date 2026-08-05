import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findPigeon, findAllPigeons, getBestPigeonWordLimit, getPigeonThumbnails
} from './_shared.js';

const BOARD_KEY = 'board_messages';

function textToBinary(str) {
  return str.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getPigeonCountTier(count) {
  if (count >= 100) return 'tier-glow';
  if (count >= 30) return 'tier-gold';
  if (count >= 10) return 'tier-silver';
  return 'tier-green';
}

function renderMessageRow(msg, canDecode) {
  const binary = escapeHtml(textToBinary(msg.text));
  const wallet = escapeHtml(msg.acct ? msg.acct.slice(0, 6) + '...' + msg.acct.slice(-4) : 'UNKN0WN');
  const signer = msg.name ? `${escapeHtml(msg.name)} · ${wallet}` : wallet;
  const avatar = msg.image
    ? `<img class="msg-avatar" src="${escapeHtml(msg.image)}" alt="" loading="lazy">`
    : `<div class="msg-avatar msg-avatar-blank"></div>`;
  const tierClass = getPigeonCountTier(msg.pigeonCount || 1);
  const plain = canDecode
    ? `<div class="msg-plain ${tierClass}">${escapeHtml(msg.text)}</div>`
    : `<div class="msg-plain msg-locked">[ ENCRYPTED ]</div>`;
  return `
    <div class="msg-row">
      <div class="msg-top">
        ${avatar}
        <div class="msg-plain-wrap">${plain}</div>
      </div>
      <div class="msg-binary">${binary}</div>
      <div class="msg-meta">S!GNED :: ${signer}</div>
    </div>`;
}

function renderPage({ messages, isPigeon, hasSession, wordLimit, pigeonThumbs, acctDisplay, pigeonCount }) {
  const messageRows = messages.length
    ? messages.map(m => renderMessageRow(m, isPigeon)).join('')
    : `<div class="empty">N0 MESSAGES YET.</div>`;

  const thumbPicker = (isPigeon && pigeonThumbs && pigeonThumbs.length) ? `
      <div class="sig-label">ATTACH A P!GE0N</div>
      <div class="pigeon-picker" id="pigeonPicker">
        ${pigeonThumbs.map((p, i) => `<img class="pigeon-thumb${i === 0 ? ' selected' : ''}" src="${escapeHtml(p.image)}" data-nft="${escapeHtml(p.nftId)}" alt="">`).join('')}
      </div>
  ` : '';

  const connectSection = !hasSession ? `
    <div class="connect-wrap">
      <button class="connect-btn" id="connectBtn">C0NNECT T0 P!GE0N NETW0RK</button>
      <div class="connect-status" id="connectStatus"></div>
    </div>
  ` : '';

  const hasThumbs = !!(pigeonThumbs && pigeonThumbs.length);
  const initialAvatarSrc = hasThumbs ? escapeHtml(pigeonThumbs[0].image) : '';
  const previewTierClass = getPigeonCountTier(pigeonCount || 1);

  const bottomSection = isPigeon ? `
    <div class="write-box" id="pigeonWalletBoard">
      <div class="write-label">WR!TE A MESSAGE (P!GE0N S!GNATURE REQU!RED :: MAX ${wordLimit} W0RDS)</div>
      ${thumbPicker}
      <textarea id="msgInput" maxlength="1500" placeholder="Type your message here"></textarea>
      <div class="word-count" id="wordCount"></div>
      <input id="nameInput" maxlength="15" placeholder="..." />
      <div class="sig-label-below">S!GNATURE ¿ (OPT!ONAL, max 15)</div>
      <div class="preview-label">PREV!EW</div>
      <div class="msg-row">
        <div class="msg-top">
          <img class="msg-avatar" id="previewAvatarImg" src="${initialAvatarSrc}" alt="" style="${hasThumbs ? '' : 'display:none;'}">
          <div class="msg-avatar msg-avatar-blank" id="previewAvatarBlank" style="${hasThumbs ? 'display:none;' : ''}"></div>
          <div class="msg-plain-wrap"><div class="msg-plain ${previewTierClass}" id="plainPreview"></div></div>
        </div>
        <div class="msg-binary" id="binaryPreview"></div>
        <div class="msg-meta">S!GNED :: <span id="previewName"></span>${acctDisplay || 'Y0U'}</div>
      </div>
      <button class="post-btn" id="postBtn">S!GN & P0ST</button>
      <div class="post-status" id="postStatus"></div>
    </div>
  ` : (hasSession
    ? `<div class="gate-note" id="pigeonWalletBoard">
        N0 P!GE0N DETECTED :: B!NARY 0NLY. Y0U CANN0T DEC0DE 0R WR!TE HERE.
        <div class="retry-line">TRY D!FFERENT KEY?</div>
        <button class="connect-btn" id="connectBtn">C0NNECT T0 P!GE0N NETW0RK</button>
        <div class="connect-status" id="connectStatus"></div>
      </div>`
    : ''
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>S!GNAL_NODE:://P!GΞON_RELAY</title>
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
  .page{ max-width:760px; width:100%; position:relative; z-index:1; }
  h1{
    font-size:clamp(15px,4.6vw,30px);
    letter-spacing:0.06em;
    color:#fff;
    text-shadow:0 0 10px rgba(57,255,20,0.25);
    margin-bottom:2rem;
    text-align:center;
    word-break:break-word;
    overflow-wrap:anywhere;
  }
  .msg-row{
    background:#08080a;
    border:1px solid rgba(57,255,20,0.25);
    margin-bottom:1rem;
    overflow:hidden;
  }
  .msg-top{
    display:flex;
    align-items:stretch;
    min-height:128px;
  }
  .msg-plain-wrap{
    flex:1;
    min-width:0;
    display:flex;
    align-items:center;
    padding:0.85rem 1.1rem;
  }
  .msg-binary{
    padding:0.8rem 1.1rem;
    border-top:1px solid rgba(57,255,20,0.15);
    font-size:11px;
    line-height:1.7;
    color:rgba(57,255,20,0.6);
    word-break:break-all;
  }
  .msg-plain{
    font-size:14px;
  }
  .msg-plain.msg-locked{
    color:rgba(232,232,232,0.3);
    font-style:italic;
    font-size:12px;
  }
  .msg-plain.tier-green{
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.35);
  }
  .msg-plain.tier-silver{
    color:#cdd6de;
    text-shadow:0 0 5px rgba(205,214,222,0.45);
  }
  .msg-plain.tier-gold{
    color:#ffd700;
    text-shadow:0 0 6px rgba(255,215,0,0.5);
  }
  .msg-plain.tier-glow{
    color:#ffd700;
    text-shadow:0 0 10px rgba(255,215,0,0.9), 0 0 22px rgba(255,215,0,0.6);
    animation:golden-pulse 2.2s ease-in-out infinite;
  }
  @keyframes golden-pulse{
    0%, 100%{ text-shadow:0 0 10px rgba(255,215,0,0.9), 0 0 22px rgba(255,215,0,0.6); }
    50%{ text-shadow:0 0 18px rgba(255,215,0,1), 0 0 36px rgba(255,215,0,0.85); }
  }
  .msg-meta{
    padding:0.6rem 1.1rem 0.85rem;
    border-top:1px solid rgba(57,255,20,0.1);
    font-size:10px;
    letter-spacing:0.05em;
    color:rgba(0,255,242,0.75);
  }
  .msg-avatar{
    flex:0 0 128px;
    width:128px;
    object-fit:cover;
    border:none;
    border-right:2px solid rgba(255,0,60,0.5);
  }
  @media (min-width:641px){
    .msg-avatar{
      flex:0 0 180px;
      width:180px;
      filter:url(#pigeon-sharpen);
    }
    .msg-top{ min-height:180px; }
  }
  .msg-avatar-blank{
    background:repeating-linear-gradient(
      45deg,
      rgba(57,255,20,0.04) 0px,
      rgba(57,255,20,0.04) 6px,
      transparent 6px,
      transparent 12px
    );
    border-right-color:rgba(57,255,20,0.15);
  }
  .pigeon-picker{
    display:grid;
    grid-template-columns:repeat(6, 1fr);
    gap:0.5rem;
    margin-bottom:1rem;
  }
  .pigeon-thumb{
    width:100%;
    aspect-ratio:1;
    height:auto;
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
    background:#08080a;
    margin-top:2rem;
    border:1px dashed rgba(57,255,20,0.4);
    padding:1.25rem;
    text-align:center;
  }
  .write-box textarea, .write-box input#nameInput{
    text-align:left;
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
  .sig-label-below{
    font-size:11px;
    letter-spacing:0.1em;
    color:#00fff2;
    text-shadow:0 0 6px rgba(0,255,242,0.4);
    margin-top:0.5rem;
  }
  input#nameInput{
    margin-top:0.75rem;
    border-color:rgba(0,255,242,0.4);
    color:#7fffef;
  }
  .word-count{
    margin-top:0.4rem;
    font-size:10px;
    letter-spacing:0.05em;
    color:rgba(232,232,232,0.4);
  }
  .word-count.over{ color:#ff003c; }
  .preview-label{
    font-size:11px;
    letter-spacing:0.1em;
    color:#39ff14;
    margin:1.25rem 0 0.6rem;
  }
  .write-box .msg-row{
    text-align:left;
    margin-top:0;
    margin-bottom:0;
  }
  .write-box .msg-binary{
    min-height:1.4em;
    transition:font-size 0.15s ease;
  }
  .write-box .msg-plain{
    min-height:1.2em;
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
  .retry-line{
    margin-top:1.25rem;
    font-size:11px;
    letter-spacing:0.1em;
    color:rgba(232,232,232,0.5);
  }
  .gate-note .connect-btn{
    margin-top:0.75rem;
  }
  .connect-wrap{
    margin-bottom:2.5rem;
    text-align:center;
  }
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
  .scan-result{ color:#39ff14; }
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
  <canvas id="staticBg"></canvas>
  <svg width="0" height="0" style="position:absolute;">
    <filter id="pigeon-sharpen">
      <feConvolveMatrix order="3" kernelMatrix="0 -0.5 0 -0.5 3 -0.5 0 -0.5 0" preserveAlpha="true" />
    </filter>
  </svg>
  <div class="page">
    <h1>S!GNAL_NODE:://P!GΞON_RELAY</h1>
    ${connectSection}
    ${messageRows}
    ${bottomSection}
  </div>

  <div class="scan-overlay" id="scanOverlay">
    <div class="scan-overlay-inner">
      <div class="scan-title">C0NNECT!NG<span class="scan-cursor"></span></div>
      <div class="scan-line" id="scanLine1">P!GE0N S!GNATURE........<span class="scan-result" id="scanResult1"></span></div>
      <div class="scan-line" id="scanLine2">0PEN!NG RELAY...</div>
    </div>
  </div>

<script src="https://xumm.app/assets/cdn/xumm-oauth2-pkce.min.js"></script>
<script>
  const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

  // TV static background, behind the page content
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
        buffer[i] = shade;
        buffer[i+1] = shade;
        buffer[i+2] = shade;
        buffer[i+3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    function staticLoop(){
      drawStatic();
      requestAnimationFrame(staticLoop);
    }
    staticLoop();
  })();

  ${isPigeon ? `
  const WORD_LIMIT = ${wordLimit};
  const MIN_BINARY_SIZE = 6.5;
  const MAX_BINARY_SIZE = 11;
  const input = document.getElementById('msgInput');
  const preview = document.getElementById('binaryPreview');
  const plainPreview = document.getElementById('plainPreview');
  const previewName = document.getElementById('previewName');
  const previewAvatarImg = document.getElementById('previewAvatarImg');
  const previewAvatarBlank = document.getElementById('previewAvatarBlank');
  const nameInput = document.getElementById('nameInput');
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
        previewAvatarImg.src = el.src;
        previewAvatarImg.style.display = '';
        previewAvatarBlank.style.display = 'none';
      });
    });
  }

  function countWords(str){
    const trimmed = str.trim();
    return trimmed ? trimmed.split(/\\s+/).length : 0;
  }

  input.addEventListener('input', () => {
    preview.textContent = input.value.split('').map(c => c.charCodeAt(0).toString(2).padStart(8,'0')).join(' ');
    plainPreview.textContent = input.value;
    const words = countWords(input.value);
    const over = words > WORD_LIMIT;
    wordCountEl.textContent = words + ' / ' + WORD_LIMIT + ' W0RDS';
    wordCountEl.className = 'word-count' + (over ? ' over' : '');
    postBtn.disabled = over || words === 0;

    const ratio = Math.min(words / WORD_LIMIT, 1);
    const size = MAX_BINARY_SIZE - ratio * (MAX_BINARY_SIZE - MIN_BINARY_SIZE);
    preview.style.fontSize = size.toFixed(1) + 'px';
  });

  nameInput.addEventListener('input', () => {
    const name = nameInput.value.trim().slice(0, 15);
    previewName.textContent = name ? name + ' · ' : '';
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
  ` : (!isPigeon ? `
  const overlay = document.getElementById('scanOverlay');
  function runScanAnimation(){
    return new Promise(resolve => {
      overlay.classList.add('active');
      const l1 = document.getElementById('scanLine1');
      const l2 = document.getElementById('scanLine2');
      const r1 = document.getElementById('scanResult1');
      setTimeout(()=>{ l1.classList.add('show'); r1.textContent = 'CHECK1NG'; }, 200);
      setTimeout(()=>{ r1.textContent = 'FOUND'; }, 700);
      setTimeout(()=>{ l2.classList.add('show'); }, 1000);
      setTimeout(resolve, 1600);
    });
  }

  let xummAuth = null;
  function getAuth(){
    if(!xummAuth){
      xummAuth = new XummPkce(XAMAN_API_KEY, {
        implicit: true,
        rememberJwt: false,
        redirectUrl: 'https://soitbegins.xyz/board'
      });
      xummAuth.on('error', (err)=>{
        overlay.classList.remove('active');
        document.getElementById('connectStatus').textContent = 'ERR://LOGIN_ABORTED';
        document.getElementById('connectBtn').disabled = false;
      });
      xummAuth.on('success', async ()=>{
        const state = await xummAuth.state();
        const jwt = state && state.jwt;
        if(!jwt){
          overlay.classList.remove('active');
          document.getElementById('connectStatus').textContent = 'ERR://NO_WALLET_DATA';
          document.getElementById('connectBtn').disabled = false;
          return;
        }
        try {
          const res = await fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jwt })
          });
          const data = await res.json();
          if (data.ok) {
            await runScanAnimation();
            window.location.href = window.location.pathname + '?connected=1#pigeonWalletBoard';
          } else {
            overlay.classList.remove('active');
            document.getElementById('connectStatus').textContent = 'ERR://C0NNECT!0N FA!LED';
            document.getElementById('connectBtn').disabled = false;
          }
        } catch(e) {
          overlay.classList.remove('active');
          document.getElementById('connectStatus').textContent = 'ERR://SIGNAL_LOST';
          document.getElementById('connectBtn').disabled = false;
        }
      });
    }
    return xummAuth;
  }
  // Instantiate immediately (not just on click) so a page load that's
  // actually a mobile return-from-Xaman redirect gets its pending auth
  // state picked up automatically, instead of sitting inert until the
  // user clicks connect a second time.
  getAuth();
  document.getElementById('connectBtn').addEventListener('click', ()=>{
    document.getElementById('connectBtn').disabled = true;
    document.getElementById('connectStatus').textContent = '';
    overlay.classList.add('active');
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

  const token = getCookie(request, BOARD_COOKIE_NAME);
  let isPigeon = false;
  let hasSession = false;
  let wordLimit = 0;
  let pigeonThumbs = [];
  let acctDisplay = '';
  let pigeonCount = 0;

  if (token) {
    const payload = await verifyToken(token, env.Σκύλλα);
    if (payload && payload.acct) {
      hasSession = true;
      acctDisplay = payload.acct.slice(0, 6) + '...' + payload.acct.slice(-4);
      const nfts = await fetchAllAccountNfts(payload.acct);
      isPigeon = !!findPigeon(nfts);
      if (isPigeon) {
        const pigeons = findAllPigeons(nfts);
        pigeonCount = pigeons.length;
        wordLimit = await getBestPigeonWordLimit(env.coin, pigeons);
        pigeonThumbs = await getPigeonThumbnails(env.coin, pigeons);
      }
    }
  }

  return new Response(
    renderPage({ messages: messages.slice(-50).reverse(), isPigeon, hasSession, wordLimit, pigeonThumbs, acctDisplay, pigeonCount }),
    { headers: { 'Content-Type': 'text/html' } }
  );
}
