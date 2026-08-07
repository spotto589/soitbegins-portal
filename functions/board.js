import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findPigeon, findAllPigeons, getBestPigeonWordLimit, getPigeonThumbnails
} from './_shared.js';

function textToBinary(str) {
  return str.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const DIAMOND_SPARKLES = `<div class="diamond-sparkles" aria-hidden="true"><span>⚠️</span><span>⚠️</span><span>⚠️</span><span>⚠️</span><span>⚠️</span></div>`;

function getPigeonCountTier(count) {
  if (count >= 99) return 'tier-diamond';
  if (count >= 50) return 'tier-gold';
  if (count >= 33) return 'tier-purple';
  if (count >= 13) return 'tier-red';
  if (count >= 5) return 'tier-pink';
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
    : `<div class="msg-plain msg-locked"><span>⚠️</span><span>[ ENCRYPTED ]</span><span>⚠️</span></div>`;
  const ts = msg.ts ? `<span class="msg-ts" data-ts="${msg.ts}"></span>` : '';
  const sparkles = tierClass === 'tier-diamond' ? DIAMOND_SPARKLES : '';
  return `
    <div class="msg-row ${tierClass}">
      ${sparkles}
      <div class="msg-meta"><span class="msg-meta-left">S!GNED :: <span class="msg-signer">${signer}</span></span>${ts ? `<span class="msg-meta-right">${ts}</span>` : ''}</div>
      <div class="msg-top">
        ${avatar}
        <div class="msg-plain-wrap">${plain}</div>
      </div>
      <div class="msg-binary">${binary}</div>
    </div>`;
}

function renderPage({ messages, isPigeon, hasSession, wordLimit, pigeonThumbs, acctDisplay, pigeonCount, usedPigeonNfts, keystoneTs }) {
  const messageRows = messages.length
    ? messages.map(m => renderMessageRow(m, isPigeon)).join('')
    : `<div class="empty">N0 MESSAGES YET.</div>`;

  const usedSet = new Set(usedPigeonNfts || []);
  const availableThumbs = (pigeonThumbs || []).filter(p => !usedSet.has(p.nftId));
  const allPigeonsUsed = isPigeon && !!(pigeonThumbs && pigeonThumbs.length) && availableThumbs.length === 0;
  const firstAvailableNftId = availableThumbs.length ? availableThumbs[0].nftId : null;

  const thumbPicker = (isPigeon && pigeonThumbs && pigeonThumbs.length) ? `
      <div class="sig-label">ATTACH A P!GE0N</div>
      <div class="pigeon-picker" id="pigeonPicker">
        ${pigeonThumbs.map((p) => {
          const used = usedSet.has(p.nftId);
          const selected = !used && p.nftId === firstAvailableNftId;
          return `<img class="pigeon-thumb${used ? ' used' : ''}${selected ? ' selected' : ''}" src="${escapeHtml(p.image)}" data-nft="${escapeHtml(p.nftId)}" data-used="${used ? '1' : '0'}" alt="">`;
        }).join('')}
      </div>
      ${allPigeonsUsed ? `
        <div class="all-used-note">ALL Y0UR P!GE0NS HAVE ALREADY S!GNED TH!S B0ARD :: 0NE P0ST PER P!GE0N (ALPHA)</div>
        <div class="mainframe-teaser">T0 ACCESS THE STAT!C S!GNAL_N0DE MA!NFRAMΞ, S!GN W!TH 50 P!GE0NS.</div>
        ${keystoneTs ? `<div class="keystone-note">KEYST0NE :: <span id="keystoneTime" data-ts="${keystoneTs}"></span></div>` : ''}
      ` : ''}
  ` : '';

  const connectSection = !hasSession ? `
    <div class="connect-wrap">
      <button class="connect-btn" id="connectBtn"><span class="cb-label"><span class="caution">⚠</span> C0NNECT T0 P!GE0N NETW0RK <span class="caution">⚠</span></span><span class="cb-binary" aria-hidden="true">01000011 01001111 01001110 01001110 01000101 01000011 01010100</span></button>
      <div class="connect-status" id="connectStatus"></div>
    </div>
  ` : '';

  const sessionControls = hasSession ? `
    <div class="session-controls">
      <button class="signout-btn" id="signOutBtn">S!GN 0UT / CHANGE KEY</button>
    </div>
  ` : '';

  const hasAvailableThumbs = availableThumbs.length > 0;
  const initialAvatarSrc = hasAvailableThumbs ? escapeHtml(availableThumbs[0].image) : '';
  const previewTierClass = getPigeonCountTier(pigeonCount || 1);
  const previewSparkles = previewTierClass === 'tier-diamond' ? DIAMOND_SPARKLES : '';

  const bottomSection = isPigeon ? `
    <div class="write-box" id="pigeonWalletBoard">
      <div class="write-label">WR!TE A MESSAGE (P!GE0N S!GNATURE REQU!RED :: MAX ${wordLimit} W0RDS)</div>
      ${thumbPicker}
      <textarea id="msgInput" maxlength="1500" placeholder="Type your message here"></textarea>
      <div class="word-count" id="wordCount"></div>
      <input id="nameInput" maxlength="15" placeholder="..." />
      <div class="sig-label-below">S!GNATURE ¿ (OPT!ONAL, max 15)</div>
      <div class="preview-label">PREV!EW</div>
      <div class="msg-row ${previewTierClass}" id="previewRow">
        ${previewSparkles}
        <div class="msg-meta"><span class="msg-meta-left">S!GNED :: <span class="msg-signer"><span id="previewName"></span>${acctDisplay || 'Y0U'}</span></span></div>
        <div class="msg-top">
          <img class="msg-avatar" id="previewAvatarImg" src="${initialAvatarSrc}" alt="" style="${hasAvailableThumbs ? '' : 'display:none;'}">
          <div class="msg-avatar msg-avatar-blank" id="previewAvatarBlank" style="${hasAvailableThumbs ? 'display:none;' : ''}"></div>
          <div class="msg-plain-wrap"><div class="msg-plain ${previewTierClass}" id="plainPreview"></div></div>
        </div>
        <div class="msg-binary" id="binaryPreview"></div>
      </div>
      <button class="post-btn" id="postBtn"${allPigeonsUsed ? ' disabled' : ''}>S!GN & P0ST</button>
      <div class="post-status" id="postStatus"></div>
    </div>
  ` : (hasSession
    ? `<div class="gate-note" id="pigeonWalletBoard">
        N0 P!GE0N DETECTED :: B!NARY 0NLY. Y0U CANN0T DEC0DE 0R WR!TE HERE.
        <div class="retry-line">TRY D!FFERENT KEY?</div>
        <button class="connect-btn" id="connectBtn"><span class="cb-label"><span class="caution">⚠</span> C0NNECT T0 P!GE0N NETW0RK <span class="caution">⚠</span></span><span class="cb-binary" aria-hidden="true">01000011 01001111 01001110 01001110 01000101 01000011 01010100</span></button>
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
    font-size:clamp(16px,4vw,28px);
    font-weight:700;
    letter-spacing:0.14em;
    color:#39ff14;
    text-shadow:0 0 8px rgba(57,255,20,0.7), 0 0 18px rgba(57,255,20,0.35);
    margin-bottom:1.25rem;
    text-align:center;
    word-break:break-word;
    overflow-wrap:anywhere;
  }
  h1 .title-rule{
    display:block;
    width:min(220px, 60%);
    height:1px;
    margin:0.9rem auto 0;
    background:linear-gradient(90deg, transparent, rgba(57,255,20,0.6), transparent);
  }
  .construction-notice{
    margin-bottom:2rem;
    border:1px solid rgba(255,0,60,0.4);
    background:rgba(255,0,60,0.04);
    padding:1.1rem 1.25rem;
    text-align:center;
    position:relative;
    overflow:hidden;
  }
  .cn-stripe{
    height:6px;
    margin:-1.1rem -1.25rem 0.9rem;
    background:repeating-linear-gradient(45deg, #ff003c 0px, #ff003c 10px, #08080a 10px, #08080a 20px);
    opacity:0.7;
  }
  .cn-stripe.bottom{ margin:0.9rem -1.25rem -1.1rem; }
  .cn-title{
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    justify-content:center;
    gap:0.4em;
    font-size:clamp(12px,3.4vw,16px);
    letter-spacing:0.1em;
    color:#ff003c;
    text-shadow:0 0 8px rgba(255,0,60,0.6);
    font-weight:700;
    margin-bottom:0.85rem;
    animation:cn-flicker 2.4s ease-in-out infinite;
  }
  .cn-title span{ white-space:nowrap; }
  @keyframes cn-flicker{
    0%, 100%{ opacity:1; }
    50%{ opacity:0.7; }
  }
  .cn-body{
    font-size:12px;
    line-height:1.8;
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.35);
    letter-spacing:0.04em;
    text-transform:uppercase;
    margin-bottom:0.9rem;
  }
  .cn-footer{
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    justify-content:center;
    gap:0.4em;
    font-size:11px;
    letter-spacing:0.08em;
    color:#ffd700;
    text-shadow:0 0 6px rgba(255,215,0,0.5);
  }
  .cn-footer span{ white-space:nowrap; }
  .signal-panel{
    margin-bottom:1.5rem;
    border:1px solid rgba(255,213,0,0.35);
    background:rgba(255,213,0,0.03);
    overflow:hidden;
  }
  .btn-group{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:0.9rem;
    margin-bottom:1.5rem;
  }
  .collection-link-wrap{
    text-align:center;
  }
  .connect-wrap{
    margin-bottom:0;
    text-align:center;
  }
  .btn-group .connect-btn{ margin-top:0; }
  .tier-legend{
    border:none;
    background:transparent;
  }
  .tier-legend summary{
    cursor:pointer;
    list-style:none;
    padding:0.75rem 1rem;
    font-size:11px;
    letter-spacing:0.1em;
    color:#ffd500;
    text-shadow:0 0 6px rgba(255,213,0,0.4);
    text-transform:uppercase;
    display:flex;
    align-items:center;
    justify-content:space-between;
    -webkit-tap-highlight-color:transparent;
  }
  .tier-legend summary::-webkit-details-marker{ display:none; }
  .tier-legend summary::after{
    content:'▾';
    font-size:10px;
    transition:transform 0.2s ease;
  }
  .tier-legend[open] summary::after{ transform:rotate(180deg); }
  .tier-legend-body{
    padding:0.25rem 1rem 1rem;
    display:flex;
    flex-direction:column;
    gap:0.5rem;
  }
  .tl-row{
    padding:0.7rem 0.9rem;
    margin-bottom:0;
    display:flex;
    align-items:center;
    justify-content:center;
  }
  .tl-text{ font-size:13px; }
  .collection-link{
    position:relative;
    display:inline-flex;
    flex-wrap:wrap;
    align-items:center;
    justify-content:center;
    background:#ffd500;
    border:2px solid #000;
    color:#000;
    font-family:inherit;
    font-weight:700;
    font-size:clamp(12px, 3.6vw, 15px);
    letter-spacing:0.1em;
    padding:0.9em 1.4em;
    text-align:center;
    text-transform:uppercase;
    text-decoration:none;
    transition:transform 0.12s ease, background 0.12s ease;
    overflow:hidden;
  }
  .collection-link:hover{
    background:#ffe14d;
    transform:translateY(-1px);
  }
  .msg-row{
    background:#08080a;
    border:1px solid rgba(57,255,20,0.25);
    margin-bottom:1rem;
    overflow:hidden;
  }
  .msg-top{
    position:relative;
    display:flex;
    align-items:flex-start;
    min-height:150px;
  }
  .msg-plain-wrap{
    position:relative;
    flex:1;
    min-width:0;
    align-self:stretch;
    display:flex;
    align-items:center;
    justify-content:center;
    text-align:center;
    padding:0.85rem 1.1rem;
  }
  .msg-binary{
    margin:0.8rem 1.1rem;
    padding:0.7rem 0.9rem;
    border:1px solid rgba(57,255,20,0.15);
    font-size:11px;
    line-height:1.7;
    color:rgba(57,255,20,0.6);
    word-break:break-all;
  }
  .msg-binary a{
    color:inherit;
    text-decoration:none;
    pointer-events:none;
    cursor:default;
  }
  .msg-plain{
    font-size:14px;
    white-space:pre-wrap;
    overflow-wrap:anywhere;
  }
  .msg-plain.msg-locked{
    position:absolute;
    left:50%;
    top:50%;
    transform:translate(-50%,-50%);
    width:100%;
    box-sizing:border-box;
    padding:0 0.75rem;
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    justify-content:center;
    gap:0.3em;
    color:#ff003c;
    font-weight:700;
    font-style:normal;
    font-size:clamp(11px, 3.4vw, 18px);
    letter-spacing:0.06em;
    text-shadow:0 0 10px rgba(255,0,60,0.6);
    pointer-events:none;
    z-index:2;
  }
  .msg-plain.msg-locked span{ white-space:nowrap; }
  .msg-plain.tier-green{
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.35);
  }
  .msg-plain.tier-pink{
    color:#ff6ec7;
    text-shadow:0 0 5px rgba(255,110,199,0.5);
  }
  .msg-plain.tier-red{
    color:#ff3b3b;
    text-shadow:0 0 5px rgba(255,59,59,0.5);
  }
  .msg-plain.tier-purple{
    color:#c77dff;
    text-shadow:0 0 6px rgba(199,125,255,0.55);
  }
  .msg-plain.tier-gold{
    color:#ffd700;
    text-shadow:0 0 8px rgba(255,215,0,0.6);
    animation:golden-pulse 2.2s ease-in-out infinite;
  }
  @keyframes golden-pulse{
    0%, 100%{ text-shadow:0 0 8px rgba(255,215,0,0.6); }
    50%{ text-shadow:0 0 16px rgba(255,215,0,0.9), 0 0 30px rgba(255,215,0,0.5); }
  }
  .msg-plain.tier-diamond{
    background:linear-gradient(90deg, #ff36e0 0%, #ffe93f 22%, #36e6ff 45%, #ff36e0 68%, #ffe93f 88%, #36e6ff 100%);
    background-size:300% 100%;
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
    font-weight:800;
    letter-spacing:0.04em;
    filter:drop-shadow(0 0 6px rgba(255,54,224,0.6));
    animation:diamond-text-shimmer 1.8s linear infinite;
  }
  @keyframes diamond-text-shimmer{
    0%{ background-position:0% 50%; }
    100%{ background-position:300% 50%; }
  }
  .msg-row.tier-pink{ border-width:1px; border-color:rgba(255,110,199,0.4); }
  .msg-row.tier-pink .msg-binary{ border-width:1px; border-color:rgba(255,110,199,0.3); }
  .msg-row.tier-pink .msg-meta{ border-bottom-color:rgba(255,110,199,0.25); }
  .msg-row.tier-pink .msg-avatar{ border-width:1px; border-color:rgba(255,110,199,0.3); }
  .msg-row.tier-red{ border-width:2px; border-color:rgba(255,59,59,0.45); }
  .msg-row.tier-red .msg-binary{ border-width:2px; border-color:rgba(255,59,59,0.3); }
  .msg-row.tier-red .msg-meta{ border-bottom-color:rgba(255,59,59,0.25); }
  .msg-row.tier-red .msg-avatar{ border-width:2px; border-color:rgba(255,59,59,0.3); }
  .msg-row.tier-purple{ border-width:2.5px; border-color:rgba(199,125,255,0.45); }
  .msg-row.tier-purple .msg-binary{ border-width:2.5px; border-color:rgba(199,125,255,0.3); }
  .msg-row.tier-purple .msg-meta{ border-bottom-color:rgba(199,125,255,0.25); }
  .msg-row.tier-purple .msg-avatar{ border-width:2.5px; border-color:rgba(199,125,255,0.3); }
  .msg-row.tier-gold{
    position:relative;
    overflow:hidden;
    border-width:3px;
    border-color:rgba(255,215,0,0.7);
    animation:gold-glow-pulse 2.6s ease-in-out infinite;
  }
  @keyframes gold-glow-pulse{
    0%, 100%{ box-shadow:0 0 10px rgba(255,215,0,0.3), inset 0 0 14px rgba(255,215,0,0.05); }
    50%{ box-shadow:0 0 20px rgba(255,215,0,0.55), inset 0 0 22px rgba(255,215,0,0.12); }
  }
  .msg-row.tier-gold::after{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:1;
    background:linear-gradient(115deg, transparent 30%, rgba(255,215,0,0.22) 46%, rgba(255,246,200,0.55) 50%, rgba(255,215,0,0.22) 54%, transparent 70%);
    background-size:300% 300%;
    animation:gold-sweep 3.4s linear infinite;
    mix-blend-mode:screen;
  }
  @keyframes gold-sweep{
    0%{ background-position:0% 0%; }
    100%{ background-position:100% 100%; }
  }
  .msg-row.tier-gold .msg-binary{ border-width:3px; border-color:rgba(255,215,0,0.4); }
  .msg-row.tier-gold .msg-meta{ border-bottom-color:rgba(255,215,0,0.35); }
  .msg-row.tier-gold .msg-avatar{ border-width:3px; border-color:rgba(255,215,0,0.4); }
  .msg-row.tier-diamond{
    position:relative;
    overflow:hidden;
    border-width:4px;
    border-color:#ff8ef0;
    animation:diamond-glow-pulse 2.2s ease-in-out infinite;
  }
  .msg-row.tier-diamond .msg-binary{ border-width:4px; border-color:rgba(255,142,240,0.5); }
  .msg-row.tier-diamond .msg-meta{ border-bottom-color:rgba(255,142,240,0.4); }
  .msg-row.tier-diamond .msg-avatar{ border-width:4px; border-color:rgba(255,142,240,0.5); }
  @keyframes diamond-glow-pulse{
    0%, 100%{ box-shadow:0 0 18px rgba(255,54,224,0.4), 0 0 34px rgba(54,230,255,0.22), inset 0 0 24px rgba(255,54,224,0.08); }
    50%{ box-shadow:0 0 28px rgba(255,54,224,0.65), 0 0 52px rgba(54,230,255,0.38), inset 0 0 32px rgba(255,54,224,0.15); }
  }
  .diamond-sparkles{
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:2;
  }
  .diamond-sparkles span{
    position:absolute;
    font-size:13px;
    filter:drop-shadow(0 0 5px rgba(255,255,255,0.9));
    animation:diamond-sparkle-twinkle 1.6s ease-in-out infinite;
  }
  .diamond-sparkles span:nth-child(1){ top:12%; left:10%; animation-delay:0s; }
  .diamond-sparkles span:nth-child(2){ top:10%; left:82%; animation-delay:0.3s; }
  .diamond-sparkles span:nth-child(3){ top:74%; left:58%; animation-delay:0.6s; }
  .diamond-sparkles span:nth-child(4){ top:80%; left:20%; animation-delay:0.9s; }
  .diamond-sparkles span:nth-child(5){ top:56%; left:90%; animation-delay:1.2s; }
  @keyframes diamond-sparkle-twinkle{
    0%, 100%{ opacity:0.15; transform:scale(0.65) rotate(-10deg); }
    50%{ opacity:1; transform:scale(1.2) rotate(10deg); }
  }
  .msg-row.tier-diamond::after{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:1;
    background:linear-gradient(115deg, transparent 30%, rgba(255,111,235,0.14) 44%, rgba(255,255,255,0.32) 50%, rgba(111,230,255,0.14) 56%, transparent 70%);
    background-size:300% 300%;
    animation:diamond-sweep 2.8s linear infinite;
    mix-blend-mode:screen;
  }
  @keyframes diamond-sweep{
    0%{ background-position:0% 0%; }
    100%{ background-position:100% 100%; }
  }
  .msg-meta{
    display:flex;
    flex-direction:column;
    align-items:center;
    text-align:center;
    row-gap:0.35rem;
    padding:0.85rem 1.1rem 0.6rem;
    border-bottom:1px solid rgba(57,255,20,0.1);
    font-size:12px;
    letter-spacing:0.05em;
    color:#ff003c;
    text-shadow:0 0 4px rgba(255,0,60,0.4);
  }
  .msg-meta-left{
    min-width:0;
    max-width:100%;
    overflow-wrap:break-word;
  }
  .msg-meta-right{
    flex:0 0 auto;
    font-size:10px;
  }
  @media (min-width:641px){
    .msg-meta{
      flex-direction:row;
      flex-wrap:wrap;
      align-items:baseline;
      justify-content:space-between;
      column-gap:0.75rem;
      text-align:left;
    }
    .msg-meta-left{
      flex:1 1 auto;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    .msg-meta-right{ font-size:12px; }
  }
  .msg-signer{
    color:#ffd700;
    text-shadow:0 0 4px rgba(255,215,0,0.4);
  }
  .msg-ts{
    color:rgba(255,0,60,0.7);
    font-variant-numeric:tabular-nums;
  }
  .msg-avatar{
    flex:0 0 150px;
    width:150px;
    aspect-ratio:1;
    height:auto;
    object-fit:contain;
    background:#08080a;
    border:1px solid rgba(57,255,20,0.25);
  }
  @media (min-width:641px){
    .msg-top{ min-height:220px; }
    .msg-avatar{
      flex:0 0 220px;
      width:220px;
    }
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
    display:grid;
    grid-template-columns:repeat(6, 1fr);
    gap:0.5rem;
    margin-bottom:1rem;
  }
  .pigeon-thumb{
    width:100%;
    aspect-ratio:1;
    height:auto;
    object-fit:contain;
    background:#08080a;
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
  .pigeon-thumb.used{
    filter:grayscale(1);
    opacity:0.25;
    cursor:not-allowed;
  }
  .pigeon-thumb.used:hover{ opacity:0.25; }
  .all-used-note{
    margin-top:0.75rem;
    font-size:11px;
    letter-spacing:0.05em;
    color:rgba(255,0,60,0.75);
    text-align:center;
  }
  .mainframe-teaser{
    margin-top:0.5rem;
    font-size:11px;
    letter-spacing:0.08em;
    color:#00fff2;
    text-shadow:0 0 8px rgba(0,255,242,0.5);
    text-align:center;
    font-style:italic;
  }
  .keystone-note{
    margin-top:0.6rem;
    font-size:10px;
    letter-spacing:0.08em;
    color:rgba(232,232,232,0.45);
    text-align:center;
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
  .post-btn{
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
  .post-btn:hover{ background:rgba(57,255,20,0.1); }
  .post-btn:disabled{ opacity:0.5; cursor:default; }
  .connect-btn{
    position:relative;
    margin-top:0.9rem;
    display:inline-flex;
    flex-wrap:wrap;
    align-items:center;
    justify-content:center;
    gap:0.5em;
    background:#ffd500;
    border:2px solid #000;
    color:#000;
    font-family:inherit;
    font-weight:700;
    font-size:clamp(12px, 3.6vw, 15px);
    letter-spacing:0.1em;
    padding:0.9em 1.4em;
    text-align:center;
    cursor:pointer;
    text-transform:uppercase;
    transition:transform 0.12s ease, background 0.12s ease;
    overflow:hidden;
  }
  .connect-btn:hover{ background:#ffe14d; transform:translateY(-1px); }
  .connect-btn:disabled{ opacity:0.5; cursor:default; transform:none; }
  .connect-btn .caution{ font-size:1.15em; }
  .cb-label{
    display:inline-flex;
    flex-wrap:wrap;
    align-items:center;
    justify-content:center;
    gap:0.5em;
    animation:cb-label-flicker 1.8s infinite;
  }
  .cb-binary{
    position:absolute;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    background:#000;
    color:#39ff14;
    font-size:11px;
    letter-spacing:0.05em;
    text-shadow:0 0 8px rgba(57,255,20,0.8);
    white-space:nowrap;
    overflow:hidden;
    opacity:0;
    animation:cb-binary-flicker 1.8s infinite;
  }
  @keyframes cb-label-flicker{
    0%, 84%, 100%{ opacity:1; }
    86%{ opacity:0; }
    88%{ opacity:1; }
    90%{ opacity:0; }
    92%{ opacity:1; }
    94%{ opacity:0.2; }
    96%{ opacity:1; }
  }
  @keyframes cb-binary-flicker{
    0%, 84%, 100%{ opacity:0; }
    86%{ opacity:1; }
    88%{ opacity:0; }
    90%{ opacity:1; }
    92%{ opacity:0; }
    94%{ opacity:0.9; }
    96%{ opacity:0; }
  }
  .post-status, .connect-status{
    margin-top:0.6rem;
    font-size:12px;
    min-height:1.4em;
    color:#39ff14;
  }
  .gate-note{
    margin-top:2rem;
    text-align:center;
    font-size:clamp(18px, 5vw, 26px);
    font-weight:700;
    letter-spacing:0.06em;
    line-height:1.4;
    color:#ff003c;
    text-shadow:0 0 10px rgba(255,0,60,0.5);
  }
  .retry-line{
    margin-top:1.25rem;
    font-size:13px;
    letter-spacing:0.1em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
  }
  .gate-note .connect-btn{
    margin-top:0.75rem;
  }
  .session-controls{
    text-align:center;
    margin-bottom:1.5rem;
  }
  .signout-btn{
    background:transparent;
    border:1px solid rgba(232,232,232,0.25);
    color:rgba(232,232,232,0.55);
    font-family:inherit;
    font-size:10px;
    letter-spacing:0.1em;
    padding:0.5em 1em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .signout-btn:hover{ background:rgba(232,232,232,0.08); color:#e8e8e8; }
  .signout-btn:disabled{ opacity:0.5; cursor:default; }
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
  <div class="page">
    <h1>S!GNAL_NODE:://P!GΞON_RELAY<span class="title-rule"></span></h1>
    <div class="construction-notice">
      <div class="cn-stripe"></div>
      <div class="cn-title"><span>⚠️</span><span>UNDER CONSTRUCTION</span><span>⚠️</span></div>
      <div class="cn-body">
        The path may change.<br>
        The board may shift.<br>
        But the moment you arrived...<br>
        can never be rewritten.
      </div>
      <div class="cn-footer"><span>🚧⚠️</span><span>THE CROWN IS STILL BUILDING</span><span>⚠️🚧</span></div>
      <div class="cn-stripe bottom"></div>
    </div>
    <div class="btn-group">
      ${connectSection}
      <div class="collection-link-wrap">
        <a class="collection-link" href="https://deeptide.co/xrpigeons" target="_blank" rel="noopener"><span class="cb-label" style="animation-delay:0.6s">BEC0ME THE S!GNAL →</span><span class="cb-binary" aria-hidden="true" style="animation-delay:0.6s">01010011 01001001 01000111 01001110 01000001 01001100</span></a>
      </div>
    </div>
    <div class="signal-panel">
      <details class="tier-legend">
        <summary>// CHANGE S!GNATURE C0L0UR</summary>
        <div class="tier-legend-body">
          <div class="msg-row tl-row tier-green"><div class="msg-plain tl-text tier-green">1-4 P!GE0NS</div></div>
          <div class="msg-row tl-row tier-pink"><div class="msg-plain tl-text tier-pink">5-12 P!GE0NS</div></div>
          <div class="msg-row tl-row tier-red"><div class="msg-plain tl-text tier-red">13-32 P!GE0NS</div></div>
          <div class="msg-row tl-row tier-purple"><div class="msg-plain tl-text tier-purple">33-49 P!GE0NS</div></div>
          <div class="msg-row tl-row tier-gold"><div class="msg-plain tl-text tier-gold">50-98 P!GE0NS</div></div>
          <div class="msg-row tl-row tier-diamond"><div class="msg-plain tl-text tier-diamond">99+ P!GE0NS</div></div>
        </div>
      </details>
    </div>
    ${sessionControls}
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

  // All timestamps on the board are shown in South Australia time (the
  // site's home timezone) regardless of the visitor's own device/locale,
  // so everyone sees the same signing time.
  const ADELAIDE_TZ = 'Australia/Adelaide';
  function formatAdelaideDateTime(ts) {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: ADELAIDE_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: true
    }).formatToParts(new Date(ts * 1000));
    const get = (type) => parts.find(p => p.type === type).value;
    const ampm = get('dayPeriod').toUpperCase();
    return get('year') + '.' + get('month') + '.' + get('day') + ' :: ' + get('hour') + ':' + get('minute') + ':' + get('second') + ' ' + ampm + ' KST';
  }

  const keystoneEl = document.getElementById('keystoneTime');
  if (keystoneEl) {
    const ts = parseInt(keystoneEl.dataset.ts, 10);
    if (ts) {
      keystoneEl.textContent = formatAdelaideDateTime(ts);
    }
  }

  document.querySelectorAll('.msg-ts').forEach(el => {
    const ts = parseInt(el.dataset.ts, 10);
    if (!ts) return;
    el.textContent = formatAdelaideDateTime(ts);
  });

  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      signOutBtn.disabled = true;
      try {
        await fetch('/api/disconnect', { method: 'POST' });
      } catch (e) {}
      window.location.href = window.location.pathname;
    });
  }

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
        if (el.dataset.used === '1') return;
        picker.querySelectorAll('.pigeon-thumb').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        selectedNftId = el.dataset.nft || '';
        previewAvatarImg.src = el.src;
        previewAvatarImg.style.display = '';
        previewAvatarBlank.style.display = 'none';
        input.dispatchEvent(new Event('input'));
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
    postBtn.disabled = over || words === 0 || !selectedNftId;

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
    if (!text || countWords(text) > WORD_LIMIT || !selectedNftId) return;
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
      } else if (data.error === 'pigeon_already_posted') {
        status.textContent = 'ERR://TH!S P!GE0N ALREADY S!GNED :: P!CK AN0THER';
        btn.disabled = false;
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

  const list = await env.coin.list({ prefix: 'pigeonpost:' });
  const messageValues = await Promise.all(list.keys.map(k => env.coin.get(k.name)));
  const messages = messageValues
    .filter(v => v !== null)
    .map(v => JSON.parse(v))
    .sort((a, b) => a.ts - b.ts);

  const token = getCookie(request, BOARD_COOKIE_NAME);
  let isPigeon = false;
  let hasSession = false;
  let wordLimit = 0;
  let pigeonThumbs = [];
  let acctDisplay = '';
  let pigeonCount = 0;
  let usedPigeonNfts = [];
  let keystoneTs = null;

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
        const usedChecks = await Promise.all(
          pigeonThumbs.map(p => env.coin.get(`pigeonpost:${p.nftId}`))
        );
        usedPigeonNfts = pigeonThumbs
          .filter((p, i) => usedChecks[i] !== null)
          .map(p => p.nftId);
        if (pigeonThumbs.length && usedPigeonNfts.length === pigeonThumbs.length) {
          keystoneTs = await env.coin.get(`keystone:${payload.acct}`);
        }
      }
    }
  }

  return new Response(
    renderPage({ messages: messages.slice(-50).reverse(), isPigeon, hasSession, wordLimit, pigeonThumbs, acctDisplay, pigeonCount, usedPigeonNfts, keystoneTs }),
    { headers: { 'Content-Type': 'text/html' } }
  );
}
