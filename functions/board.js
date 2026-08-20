import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findPigeon, findAllPigeons, getBestPigeonWordLimit, getPigeonThumbnails,
  getPigeonCountTier, getPigeonTierClass, getPigeonAccessLevel, getRewardRates,
  getCachedCrownHolder, recomputeCrownHolder, isCrownWallet, CROWN_SNAPSHOT_MAX_AGE_SECONDS,
  proxyIpfsImage
} from './_shared.js';

function textToBinary(str) {
  return str.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const DIAMOND_SPARKLES = `<div class="diamond-sparkles" aria-hidden="true"><span>⚠️</span><span>⚠️</span><span>⚠️</span><span>⚠️</span><span>⚠️</span></div>`;

const GLITCH_BADGE = `<div class="glitch-badge" aria-hidden="true">⚠ GL!TCH</div>`;

function isGlitchWallet(acct) {
  return !!acct && acct.slice(0, 6) === 'rJhJRk' && acct.slice(-4) === '1r9D';
}

// Fixed placeholder shown for every locked signal's binary line — same
// static text everywhere, at the user's request, rather than per-signal
// noise. Never derived from msg.text: this is what actually fixed the
// earlier bug, where a locked signal showed textToBinary(msg.text)
// verbatim and was trivially reversible back to the real message — CSS/JS
// never hid it, the real content was just sitting in the HTML. Locked
// rows must never touch msg.text at all.
const LOCKED_SIGNAL_BINARY = '01111011 00001101 101000001 00001101 01111011 00001101 101000001';

function renderMessageRow(msg, canDecode, glitchTs, viewerAccessLevel) {
  // RANK AT SIGNING — permanently captured at post time (see
  // functions/api/board.js), never recomputed here. A wallet that has
  // since lost the Crown still keeps this on every signature it made
  // while wearing it; that's the whole point. Both the border tier and
  // the numeric access level fold this in via the same Crown-overrides-
  // count rule as the live viewer computation, so a Crown signature and
  // "ACCESS LEVEL :: 15" never disagree.
  const isCrownSignature = msg.rank === 'CROWN';
  const signalLevel = getPigeonAccessLevel(msg.pigeonCount, isCrownSignature);
  const signalLevelLabel = String(signalLevel).padStart(2, '0');
  const walletText = escapeHtml(msg.acct ? msg.acct.slice(0, 6) + '...' + msg.acct.slice(-4) : 'UNKN0WN');
  const wallet = msg.acct
    ? `<a class="wallet-link" href="https://bithomp.com/explorer/${escapeHtml(msg.acct)}" target="_blank" rel="noopener">${walletText}</a>`
    : walletText;
  const walletWithLevel = `${wallet} <span class="msg-lvl-inline">(LVL: ${signalLevelLabel})</span>`;
  const signer = msg.name ? `${escapeHtml(msg.name)} · ${walletWithLevel}` : walletWithLevel;
  const avatar = msg.image
    ? (msg.nftId
        ? `<a class="msg-avatar" href="https://deeptide.co/nft/${escapeHtml(msg.nftId)}" target="_blank" rel="noopener"><img class="msg-avatar-img" src="${escapeHtml(proxyIpfsImage(msg.image))}" alt="" loading="lazy"></a>`
        : `<img class="msg-avatar" src="${escapeHtml(proxyIpfsImage(msg.image))}" alt="" loading="lazy">`)
    : `<div class="msg-avatar msg-avatar-blank"></div>`;
  const isGlitch = isGlitchWallet(msg.acct) && msg.ts === glitchTs;
  const tierClass = isGlitch ? 'tier-glitch' : getPigeonTierClass(msg.pigeonCount, isCrownSignature);
  const plain = canDecode
    ? `<div class="msg-plain ${tierClass}">${escapeHtml(msg.text)}</div>`
    : `<div class="msg-plain msg-locked">
        <div class="msg-locked-front">
          <div class="msg-locked-head"><span>⚠️</span><span>[ ENCRYPTED S!GNAL ]</span><span>⚠️</span></div>
          <div class="msg-locked-bar" aria-hidden="true">${'█'.repeat(40)}</div>
          <div class="msg-locked-note">P!GE0N REQU!RED T0 DEC0DE</div>
          <button class="msg-inspect-btn" type="button">// !NSPECT S!GNAL</button>
        </div>
        <div class="msg-lock-detail" hidden>
          <div class="ld-title">// S!GNAL L0CKED</div>
          <div class="ld-line">ACCESS LEVEL REQU!RED :: ${signalLevelLabel}</div>
          <div class="ld-line">Y0UR ACCESS LEVEL :: ${String(viewerAccessLevel || 0).padStart(2, '0')}</div>
          <div class="ld-line ld-req">P!GE0N REQU!RED</div>
          <div class="ld-timer">RETURN!NG !N <span class="ld-timer-count">13</span>s</div>
        </div>
      </div>`;
  const binary = canDecode
    ? escapeHtml(textToBinary(msg.text))
    : escapeHtml(LOCKED_SIGNAL_BINARY);
  const ts = msg.ts ? `<span class="msg-ts" data-ts="${msg.ts}"></span>` : '';
  const sparkles = tierClass === 'tier-diamond' ? DIAMOND_SPARKLES : (isGlitch ? GLITCH_BADGE : '');
  const crownRankBadge = isCrownSignature
    ? `<div class="msg-crown-badge" aria-hidden="true">👑 CR0WN S!GNATURE</div>`
    : '';
  const orderLevelLine = `
    <div class="msg-order-level">
      ${msg.order ? `<span class="msg-order-part">${msg.order}/${TOTAL_PIGEONS}</span>` : ''}
      ${isCrownSignature ? `<span class="msg-rank-part">RANK AT S!GN!NG :: CR0WN</span>` : ''}
    </div>`;
  return `
    <div class="msg-row ${tierClass}${canDecode ? '' : ' msg-locked-row'}${isCrownSignature ? ' msg-crown-row' : ''}">
      ${sparkles}
      ${crownRankBadge}
      <div class="msg-meta"><span class="msg-meta-left">S!GNED :: <span class="msg-signer">${signer}</span></span>${ts ? `<span class="msg-meta-right">${ts}</span>` : ''}</div>
      ${orderLevelLine}
      <div class="msg-top">
        ${avatar}
        <div class="msg-plain-wrap">${plain}</div>
      </div>
      <div class="msg-binary">${binary}</div>
    </div>`;
}

const TOTAL_PIGEONS = 3016;

function renderPage({ messages, signedCount, leaderboard, isPigeon, hasSession, wordLimit, pigeonThumbs, acctDisplay, pigeonCount, usedPigeonNfts, keystoneTs, accessLevel, isCurrentCrown, crownHolderCount }) {
  // accessLevel arrives already verified from onRequestGet (server-side:
  // wallet -> Pigeon ownership -> tier -> level, via getPigeonAccessLevel
  // in _shared.js). Never recomputed or trusted from anywhere else here —
  // decode access is still the same isPigeon check it always was (this
  // level is informational/display-only until per-level filtering is
  // built on top of it).
  const accessLevelLabel = String(accessLevel).padStart(2, '0');

  // At Level 0 the site's own flavour text reads as a locked signal too —
  // not sensitive content, so a reversible binary encoding is just the
  // right aesthetic here, not a security concern the way it was for real
  // signals. Fully plain English once accessLevel is above 0.
  const CN_BODY_LINES = [
    'The path may change.',
    'The board may shift.',
    'But the moment you arrived...',
    'can never be rewritten.',
  ];
  const cnBody = accessLevel === 0
    ? CN_BODY_LINES.map(line => escapeHtml(textToBinary(line))).join('<br>')
    : CN_BODY_LINES.map(line => escapeHtml(line)).join('<br>');

  const glitchWalletTs = messages.filter(m => isGlitchWallet(m.acct)).map(m => m.ts);
  const glitchTs = glitchWalletTs.length ? Math.max(...glitchWalletTs) : null;
  // The board itself — every signal, decoded or locked — is always
  // rendered for every visitor, holder or not. Only the actual plaintext
  // (and its real binary encoding) is withheld per-row via `canDecode`;
  // see renderMessageRow for how a locked row avoids leaking msg.text.
  const messageRows = messages.length
    ? messages.map(m => renderMessageRow(m, isPigeon, glitchTs, accessLevel)).join('')
    : `<div class="empty">N0 MESSAGES YET.</div>`;

  const leaderboardRows = (leaderboard || []).map((entry, i) => {
    const w = escapeHtml(entry.acct.slice(0, 6) + '...' + entry.acct.slice(-4));
    const lbTier = getPigeonCountTier(entry.pigeonCount || 1);
    return `<div class="lb-row ${lbTier}"><span class="lb-rank">#${i + 1}</span><span class="lb-wallet">${w}</span><span class="lb-count">${entry.count} S!GN${entry.count === 1 ? '' : 'S'}</span></div>`;
  }).join('');

  const signedPct = Math.min(100, Math.round((signedCount / TOTAL_PIGEONS) * 1000) / 10);

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
          return `<img class="pigeon-thumb${used ? ' used' : ''}${selected ? ' selected' : ''}" src="${escapeHtml(proxyIpfsImage(p.image))}" data-nft="${escapeHtml(p.nftId)}" data-used="${used ? '1' : '0'}" alt="">`;
        }).join('')}
      </div>
      ${allPigeonsUsed ? `
        <div class="all-used-note">ALL Y0UR P!GE0NS HAVE ALREADY S!GNED TH!S B0ARD :: 0NE P0ST PER P!GE0N (ALPHA)</div>
        <div class="mainframe-teaser">T0 ACCESS THE STAT!C S!GNAL_N0DE MA!NFRAMΞ, S!GN W!TH 50 P!GE0NS.</div>
        ${keystoneTs ? `<div class="keystone-note">KEYST0NE :: <span id="keystoneTime" data-ts="${keystoneTs}"></span></div>` : ''}
      ` : ''}
  ` : '';

  const sessionControls = hasSession ? `
    <div class="session-controls">
      <button class="signout-btn" id="signOutBtn">S!GN 0UT / CHANGE KEY</button>
    </div>
  ` : '';

  const hasAvailableThumbs = availableThumbs.length > 0;
  const initialAvatarSrc = hasAvailableThumbs ? escapeHtml(proxyIpfsImage(availableThumbs[0].image)) : '';
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
  ` : '';

  // Access Gate status panel — always visible, from the very first load,
  // as an immediate readout of the viewer's own standing (Level 00 until
  // proven otherwise), not a wall in front of the board (the board above
  // is public; see messageRows). "S!GNALS AVA!LABLE" reuses the exact
  // unused-Pigeon count the write box picker already computes.
  const signalsAvailable = availableThumbs.length;
  const connectBtnHtml = `<button class="connect-btn" id="connectBtn"><span class="cb-label"><span class="caution">⚠</span> C0NNECT T0 P!GE0N NETW0RK <span class="caution">⚠</span></span><span class="cb-binary" aria-hidden="true">01000011 01001111 01001110 01001110 01000101 01000011 01010100</span></button>
      <div class="connect-status" id="connectStatus"></div>`;

  // Phase 4 — display only. Rates come straight from the trusted
  // accessLevel above via getRewardRates in _shared.js; nothing here
  // tracks or pays out an actual reward, it's just showing the holder
  // what their tier is worth under the current (placeholder) rate table.
  const { multiplier, crwnRate, pigeonRate } = getRewardRates(accessLevel);

  const crownBadge = isCurrentCrown
    ? `<div class="ag-crown">👑 CR0WN H0LDER :: T0P PIGE0N HOLDINGS${crownHolderCount ? ` (${crownHolderCount})` : ''}</div>`
    : '';

  const accessGateSection = isPigeon ? `
    <div class="access-gate access-gate-granted" id="accessGate">
      <div class="ag-scan">// S!GNAL DETECTED</div>
      ${crownBadge}
      <div class="ag-level ag-level-granted">ACCESS LEVEL :: ${accessLevelLabel}</div>
      <div class="ag-line ag-good">P!GE0N NETW0RK :: C0NNECTED</div>
      <div class="ag-line ag-signals">S!GNALS AVA!LABLE :: ${signalsAvailable}</div>
      <div class="ag-reward-block">
        <div class="ag-line ag-reward">REWARD MULT!PLIER :: ${multiplier.toFixed(1)}×</div>
        <div class="ag-line ag-reward">CRWN RATE :: ${crwnRate.toFixed(1)} / S!GNAL</div>
        <div class="ag-line ag-reward">P!GE0N RATE :: ${pigeonRate.toFixed(1)} / S!GNAL</div>
      </div>
    </div>
  ` : (hasSession ? `
    <div class="access-gate access-gate-denied" id="accessGate">
      <div class="ag-scan ag-scan-none">// N0 S!GNAL DETECTED</div>
      <div class="ag-level ag-level-denied">ACCESS LEVEL :: ${accessLevelLabel}</div>
      <div class="ag-line ag-bad">P!GE0N REQU!RED</div>
      <div class="retry-line">TRY D!FFERENT KEY?</div>
      ${connectBtnHtml}
    </div>
  ` : `
    <div class="access-gate access-gate-denied" id="accessGate">
      <div class="ag-scan ag-scan-none">// N0 S!GNAL DETECTED</div>
      <div class="ag-level ag-level-denied">ACCESS LEVEL :: ${accessLevelLabel}</div>
      <div class="ag-line ag-bad">N0 WALLET C0NNECTED</div>
      ${connectBtnHtml}
    </div>
  `);

  // Subtle authenticated-session marker — only rendered for a verified
  // Pigeon holder (reuses the same acctDisplay already computed for the
  // write box), low-opacity and fixed in the corner so it never competes
  // with the board itself.
  const sessionWatermark = isPigeon
    ? `<div class="session-watermark" aria-hidden="true">S!GNAL N0DE // ${escapeHtml(acctDisplay)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>STAT!C_N0DE:://S!GNAL_RELAY</title>
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
    .connect-btn{ animation:none; }
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
  .signed-counter{
    margin-bottom:0;
    border:1px solid rgba(255,0,60,0.4);
    border-bottom:none;
    background:#08080a;
    overflow:hidden;
  }
  .signed-counter-header{
    padding:0.9rem 1.5rem;
    text-align:center;
  }
  .cn-body.cn-body-binary{
    font-size:10px;
    letter-spacing:0.02em;
    text-transform:none;
    word-break:break-all;
    color:rgba(57,255,20,0.5);
  }
  .signed-counter-label{
    font-size:10px;
    letter-spacing:0.12em;
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.4);
    margin-bottom:0.4rem;
  }
  .signed-counter-value{
    font-size:clamp(18px, 5vw, 24px);
    font-weight:700;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
    margin-bottom:0.6rem;
  }
  .signed-counter-total{
    font-size:0.6em;
    color:rgba(57,255,20,0.6);
    text-shadow:none;
  }
  .signed-counter-bar{
    height:6px;
    background:rgba(57,255,20,0.08);
    border:1px solid rgba(57,255,20,0.2);
    overflow:hidden;
  }
  .signed-counter-fill{
    height:100%;
    background:linear-gradient(90deg, #1a7d0a, #39ff14);
    box-shadow:0 0 8px rgba(57,255,20,0.6);
    transition:width 0.3s ease;
  }
  .rules-item{
    padding:0.7rem 0.9rem;
    border:1px solid rgba(255,0,60,0.3);
    background:#08080a;
    font-size:11px;
    line-height:1.6;
    letter-spacing:0.03em;
    color:#e8e8e8;
  }
  .rules-item.disclaimer{
    color:#ff003c;
    border-color:rgba(255,0,60,0.3);
    text-shadow:0 0 4px rgba(255,0,60,0.3);
  }
  .rules-heading{
    font-size:15px;
    font-weight:700;
    letter-spacing:0.1em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
    margin-bottom:0.2rem;
  }
  .rules-subhead{
    display:flex;
    align-items:center;
    gap:0.4em;
    font-size:14px;
    font-weight:700;
    letter-spacing:0.08em;
    color:#ff003c;
    text-shadow:0 0 6px rgba(255,0,60,0.5);
    margin-top:0.5rem;
  }
  .rules-subhead::before, .rules-subhead::after{
    content:'⚠️';
    font-size:0.8em;
    flex:0 0 auto;
  }
  .rules-body{
    font-size:13px;
    line-height:1.6;
    color:#39ff14;
    text-shadow:0 0 3px rgba(57,255,20,0.3);
  }
  .rules-rule{
    display:flex;
    gap:0.6em;
    font-size:13px;
    line-height:1.5;
    color:#ff003c;
    text-shadow:0 0 3px rgba(255,0,60,0.3);
  }
  .rules-num{
    flex:0 0 auto;
    color:#ff003c;
    font-weight:700;
  }
  .collection-link-wrap{
    text-align:center;
    margin-bottom:0;
  }
  .collection-link-wrap .collection-link{ margin:0 auto; }
  .important-notice{
    margin-bottom:1.5rem;
    border:1px solid rgba(255,0,60,0.4);
    border-top:none;
    background:rgba(255,0,60,0.04);
    overflow:hidden;
  }
  .important-notice-summary{
    cursor:pointer;
    list-style:none;
    padding:0.7rem 0.9rem;
    display:flex;
    align-items:center;
    justify-content:center;
    gap:0.5em;
    border:1px solid rgba(255,0,60,0.3);
    background:#08080a;
    color:#ff003c;
    font-size:11px;
    font-weight:700;
    letter-spacing:0.12em;
    text-transform:uppercase;
    text-shadow:0 0 3px rgba(255,0,60,0.3);
    -webkit-tap-highlight-color:transparent;
    transition:background 0.15s ease;
  }
  .important-notice-summary:hover{ background:rgba(255,0,60,0.12); }
  .important-notice-summary::-webkit-details-marker{ display:none; }
  .important-notice-stripe{
    height:6px;
    margin:-0.9rem -1rem 0.9rem;
    background:repeating-linear-gradient(45deg, #ff003c 0px, #ff003c 10px, #08080a 10px, #08080a 20px);
    opacity:0.7;
  }
  .important-notice-stripe.bottom{ margin:0.9rem -1rem -0.9rem; }
  .important-notice-body{
    padding:0.9rem 1rem;
    display:flex;
    flex-direction:column;
    gap:0.6rem;
  }
  .important-notice-item{
    padding:0.7rem 0.9rem;
    border:1px solid rgba(255,0,60,0.3);
    background:#08080a;
    color:#ff003c;
    font-size:11px;
    line-height:1.6;
    letter-spacing:0.03em;
    text-shadow:0 0 3px rgba(255,0,60,0.3);
  }
  .tier-legend{
    border:none;
    border-top:1px solid rgba(255,0,60,0.25);
    background:#08080a;
  }
  .tier-legend summary{
    cursor:pointer;
    list-style:none;
    padding:0.75rem 1rem;
    font-size:13px;
    letter-spacing:0.1em;
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.4);
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
  .legend-title{
    display:flex;
    flex-wrap:nowrap;
    align-items:center;
    gap:0.4em;
  }
  .legend-emoji{
    font-size:1.6em;
    text-shadow:none;
  }
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
  .leaderboard{ border-top:1px solid rgba(255,0,60,0.25); }
  .leaderboard summary{ color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.4); }
  .lb-row{
    display:flex;
    align-items:center;
    gap:0.75rem;
    padding:0.55rem 0.9rem;
    border:1px solid rgba(255,0,60,0.25);
    background:#08080a;
    font-size:12px;
  }
  .lb-rank{
    flex:0 0 auto;
    color:#ffd700;
    font-weight:700;
    min-width:2em;
  }
  .lb-wallet{
    flex:1 1 auto;
    color:#e8e8e8;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .lb-count{
    flex:0 0 auto;
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.4);
    font-size:11px;
  }
  .lb-empty{
    text-align:center;
    color:rgba(232,232,232,0.4);
    font-size:12px;
    padding:0.5rem 0;
  }
  .lb-row.tier-green{ border-width:1px; border-color:rgba(57,255,20,0.25); }
  .lb-row.tier-pink{ border-width:1px; border-color:rgba(26,228,255,0.6); }
  .lb-row.tier-red{ border-width:2px; border-color:rgba(255,20,20,0.65); }
  .lb-row.tier-purple{ border-width:2.5px; border-color:rgba(219,228,234,0.55); }
  .lb-row.tier-gold{ border-width:3px; border-color:rgba(255,215,0,0.7); }
  .lb-row.tier-diamond{
    border-style:solid;
    border-width:4px;
    border-color:#ff8ef0;
    border-image:linear-gradient(90deg, #ff36e0, #ffe93f, #36e6ff, #ff36e0) 1;
  }
  .collection-link{
    position:relative;
    display:flex;
    flex-direction:row;
    align-items:stretch;
    width:100%;
    background:#ffee00;
    border:2px solid #000;
    color:#000;
    font-family:inherit;
    text-align:left;
    text-decoration:none;
    overflow:hidden;
    box-shadow:4px 4px 0 #000;
    transition:transform 0.12s ease, box-shadow 0.12s ease, background 0.12s ease;
  }
  .collection-link:hover{
    background:#fff65c;
    transform:translate(-2px,-2px);
    box-shadow:6px 6px 0 #000;
  }
  .collection-link-logo-wrap{
    position:relative;
    flex:0 0 150px;
    width:150px;
    aspect-ratio:1;
    box-sizing:border-box;
    background:#000;
    border-right:2px solid #000;
    overflow:hidden;
  }
  .collection-link-logo-wrap::before{
    content:'01010000 01001001 01000111 01000101 01001111 01001110';
    position:absolute;
    inset:0;
    display:flex;
    flex-wrap:wrap;
    align-content:center;
    justify-content:center;
    font-size:5px;
    line-height:1.3;
    letter-spacing:0.02em;
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.9);
    padding:2px;
    word-break:break-all;
    animation:logo-binary-pulse 1.8s ease-in-out infinite;
    opacity:0.25;
  }
  @keyframes logo-binary-pulse{
    0%, 100%{ opacity:0.15; }
    50%{ opacity:0.4; }
  }
  .collection-link-logo{
    position:relative;
    z-index:1;
    width:100%;
    height:100%;
    object-fit:cover;
  }
  .collection-link-body{
    position:relative;
    flex:1;
    min-width:0;
    display:flex;
    flex-direction:column;
    justify-content:center;
    padding:0.6em 1em;
  }
  @media (min-width:641px){
    .collection-link-logo-wrap{
      flex:0 0 220px;
      width:220px;
    }
  }
  .msg-row{
    position:relative;
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
    position:relative;
    width:100%;
    box-sizing:border-box;
    padding:0.5rem 0.5rem;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:0.5em;
    text-align:center;
    white-space:normal;
  }
  .msg-locked-front{
    display:flex;
    flex-direction:column;
    align-items:stretch;
    width:100%;
    gap:0.5em;
  }
  .msg-locked-front[hidden]{
    display:none;
  }
  .msg-locked-head{
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    justify-content:center;
    gap:0.3em;
    color:#ff003c;
    font-weight:700;
    font-size:clamp(11px, 3.4vw, 16px);
    letter-spacing:0.06em;
    text-shadow:0 0 10px rgba(255,0,60,0.6);
  }
  .msg-locked-head span{ white-space:nowrap; }
  .msg-locked-bar{
    font-size:9px;
    line-height:1.2;
    letter-spacing:0.03em;
    color:rgba(255,0,60,0.35);
    word-break:break-all;
    max-width:100%;
    overflow:hidden;
  }
  .msg-locked-note{
    font-size:10px;
    letter-spacing:0.08em;
    color:rgba(232,232,232,0.5);
    text-transform:uppercase;
  }
  .msg-inspect-btn{
    background:transparent;
    border:1px solid rgba(255,0,60,0.4);
    color:#ff003c;
    font-family:inherit;
    font-size:10px;
    letter-spacing:0.08em;
    padding:0.4em 0.8em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .msg-inspect-btn:hover{ background:rgba(255,0,60,0.1); }
  .msg-lock-detail{
    width:100%;
    box-sizing:border-box;
    padding:0.6rem 0.75rem;
    border:1px dashed rgba(255,0,60,0.4);
    background:#000;
    font-size:11px;
    text-align:left;
    cursor:pointer;
    white-space:normal;
  }
  .ld-title{
    color:#ff003c;
    font-weight:700;
    letter-spacing:0.08em;
    margin-bottom:0.4rem;
  }
  .ld-line{
    color:rgba(232,232,232,0.7);
    letter-spacing:0.05em;
    margin-bottom:0.2rem;
  }
  .ld-req{ color:#ff003c; }
  .ld-timer{
    margin-top:0.5rem;
    padding-top:0.4rem;
    border-top:1px dashed rgba(255,0,60,0.3);
    font-size:10px;
    letter-spacing:0.08em;
    color:rgba(232,232,232,0.5);
    text-transform:uppercase;
  }
  .ld-timer-count{
    color:#39ff14;
    font-weight:700;
  }
  .msg-inspect-btn:disabled{
    opacity:0.5;
    cursor:default;
  }
  .msg-plain.tier-green{
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.35);
  }
  .msg-plain.tier-pink{
    color:#1ae4ff;
    text-shadow:0 0 7px rgba(26,228,255,0.75);
  }
  .msg-plain.tier-red{
    color:#ff1414;
    text-shadow:0 0 7px rgba(255,20,20,0.75);
  }
  .msg-plain.tier-purple{
    color:#dbe4ea;
    text-shadow:0 0 6px rgba(219,228,234,0.5);
    animation:silver-shine 2.8s ease-in-out infinite;
  }
  @keyframes silver-shine{
    0%, 100%{ text-shadow:0 0 6px rgba(219,228,234,0.5); }
    50%{ text-shadow:0 0 12px rgba(255,255,255,0.8), 0 0 20px rgba(219,228,234,0.4); }
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
  .msg-row.tier-pink{ border-width:1px; border-color:rgba(26,228,255,0.6); }
  .msg-row.tier-pink .msg-binary{ border-width:1px; border-color:rgba(26,228,255,0.45); }
  .msg-row.tier-pink .msg-meta{ border-bottom-color:rgba(26,228,255,0.4); }
  .msg-row.tier-pink .msg-avatar{ border-width:1px; border-color:rgba(26,228,255,0.45); }
  .msg-row.tier-red{ border-width:2px; border-color:rgba(255,20,20,0.65); }
  .msg-row.tier-red .msg-binary{ border-width:2px; border-color:rgba(255,20,20,0.45); }
  .msg-row.tier-red .msg-meta{ border-bottom-color:rgba(255,20,20,0.35); }
  .msg-row.tier-red .msg-avatar{ border-width:2px; border-color:rgba(255,20,20,0.45); }
  .msg-row.tier-purple{
    position:relative;
    overflow:hidden;
    border-width:2.5px;
    border-color:rgba(219,228,234,0.55);
    animation:silver-glow-pulse 2.8s ease-in-out infinite;
  }
  @keyframes silver-glow-pulse{
    0%, 100%{ box-shadow:0 0 6px rgba(219,228,234,0.2); }
    50%{ box-shadow:0 0 14px rgba(255,255,255,0.4); }
  }
  .msg-row.tier-purple::after{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:1;
    background:linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.14) 48%, rgba(255,255,255,0.32) 50%, rgba(255,255,255,0.14) 52%, transparent 65%);
    background-size:300% 300%;
    animation:silver-sweep 4.2s linear infinite;
    mix-blend-mode:screen;
  }
  @keyframes silver-sweep{
    0%{ background-position:0% 0%; }
    100%{ background-position:100% 100%; }
  }
  .msg-row.tier-purple .msg-binary{ border-width:2.5px; border-color:rgba(219,228,234,0.4); }
  .msg-row.tier-purple .msg-meta{ border-bottom-color:rgba(219,228,234,0.35); }
  .msg-row.tier-purple .msg-avatar{ border-width:2.5px; border-color:rgba(219,228,234,0.4); }
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
    border-style:solid;
    border-width:4px;
    border-color:#ff8ef0;
    border-image:linear-gradient(90deg, #ff36e0, #ffe93f, #36e6ff, #ff36e0) 1;
    animation:diamond-glow-pulse 2.2s ease-in-out infinite;
  }
  .msg-row.tier-diamond .msg-binary{
    border-style:solid;
    border-width:4px;
    border-color:rgba(255,142,240,0.5);
    border-image:linear-gradient(90deg, #ff36e0, #ffe93f, #36e6ff, #ff36e0) 1;
  }
  .msg-row.tier-diamond .msg-meta{ border-bottom-color:rgba(255,142,240,0.4); }
  .msg-row.tier-diamond .msg-avatar{
    border-style:solid;
    border-width:4px;
    border-color:rgba(255,142,240,0.5);
    border-image:linear-gradient(135deg, #ff36e0, #ffe93f, #36e6ff, #ff36e0) 1;
  }
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
  .msg-row.tier-glitch{
    position:relative;
    overflow:hidden;
    border-width:2px;
    border-style:dashed;
    border-color:#ff0033;
    background:#0a0005;
    animation:glitch-shake 3.6s infinite;
  }
  @keyframes glitch-shake{
    0%, 90%, 100%{ transform:translate(0,0); filter:none; }
    91%{ transform:translate(-3px,1px); filter:hue-rotate(25deg); }
    92%{ transform:translate(3px,-1px); filter:hue-rotate(-25deg); }
    93%{ transform:translate(-2px,-2px); filter:none; }
    94%{ transform:translate(2px,2px); filter:hue-rotate(15deg); }
    95%{ transform:translate(0,0); filter:none; }
  }
  .msg-row.tier-glitch .msg-plain{
    color:#ff0033;
    font-weight:700;
    text-shadow:0 0 8px rgba(255,0,51,0.6);
    animation:glitch-text 3.6s infinite;
  }
  .msg-row.tier-glitch .msg-plain.msg-locked{ color:#ff0033; }
  @keyframes glitch-text{
    0%, 90%, 100%{ text-shadow:0 0 8px rgba(255,0,51,0.6); }
    91%{ text-shadow:-2px 0 #0ff, 2px 0 #f0f, 0 0 8px rgba(255,0,51,0.6); }
    93%{ text-shadow:2px 0 #0ff, -2px 0 #f0f, 0 0 8px rgba(255,0,51,0.6); }
    95%{ text-shadow:0 0 8px rgba(255,0,51,0.6); }
  }
  .msg-row.tier-glitch .msg-binary{
    border-width:2px;
    border-style:dashed;
    border-color:rgba(255,0,51,0.4);
    color:rgba(255,0,51,0.75);
  }
  .msg-row.tier-glitch .msg-meta{
    border-bottom:2px dashed rgba(255,0,51,0.35);
    color:#ff0033;
    text-shadow:0 0 4px rgba(255,0,51,0.5);
  }
  .msg-row.tier-glitch .msg-signer{ color:#ff0033; }
  .msg-row.tier-glitch .msg-avatar{
    border-width:2px;
    border-style:dashed;
    border-color:rgba(255,0,51,0.4);
    filter:contrast(1.15) saturate(0.5) grayscale(0.3);
  }
  .msg-row.tier-glitch::after{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:1;
    background:repeating-linear-gradient(0deg, rgba(255,0,51,0.07) 0px, rgba(255,0,51,0.07) 1px, transparent 1px, transparent 3px);
    animation:glitch-scan 5s linear infinite;
    mix-blend-mode:screen;
  }
  @keyframes glitch-scan{
    0%{ opacity:0.4; }
    50%{ opacity:0.1; }
    100%{ opacity:0.4; }
  }
  .glitch-badge{
    position:absolute;
    top:0.5rem;
    right:0.5rem;
    z-index:2;
    font-size:9px;
    letter-spacing:0.08em;
    color:#ff0033;
    background:#0a0005;
    border:1px solid rgba(255,0,51,0.6);
    padding:0.2em 0.5em;
    text-shadow:0 0 4px rgba(255,0,51,0.6);
    animation:glitch-badge-flicker 1.4s steps(2) infinite;
  }
  @keyframes glitch-badge-flicker{
    0%, 100%{ opacity:1; }
    50%{ opacity:0.5; }
  }
  .msg-crown-badge{
    position:absolute;
    top:0.5rem;
    left:0.5rem;
    z-index:2;
    font-size:9px;
    letter-spacing:0.08em;
    color:#000;
    background:#ffd700;
    border:1px solid #000;
    padding:0.2em 0.5em;
    font-weight:700;
  }
  .msg-row.msg-crown-row{ border-color:rgba(255,215,0,0.6); }
  .msg-rank-part{
    color:#ffd700;
    text-shadow:0 0 4px rgba(255,215,0,0.5);
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
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.4);
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
  .msg-order-level{
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    justify-content:center;
    column-gap:0.8em;
    row-gap:0.2em;
    text-align:center;
    font-size:10px;
    letter-spacing:0.06em;
    padding:0.4rem 1.1rem;
    border-bottom:1px solid rgba(57,255,20,0.1);
  }
  .msg-order-part{
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.4);
  }
  .msg-row.msg-locked-row{ border-color:rgba(255,0,60,0.35); }
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
  .wallet-link{
    color:inherit;
    text-shadow:inherit;
    text-decoration:underline;
    text-underline-offset:0.15em;
  }
  .wallet-link:hover{ opacity:0.8; }
  .msg-lvl-inline{
    color:#00fff2;
    text-shadow:0 0 4px rgba(0,255,242,0.4);
    font-size:0.9em;
  }
  .msg-ts{
    color:rgba(57,255,20,0.7);
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
    display:block;
  }
  .msg-avatar-img{
    width:100%;
    height:100%;
    object-fit:contain;
    display:block;
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
    background:#ffee00;
    border:3px solid #000;
    color:#000;
    font-family:inherit;
    font-weight:700;
    font-size:clamp(14px, 4.4vw, 18px);
    letter-spacing:0.1em;
    padding:1.15em 2em;
    text-align:center;
    cursor:pointer;
    text-transform:uppercase;
    box-shadow:0 0 0 rgba(255,238,0,0.6), 4px 4px 0 #000;
    animation:connect-btn-pulse 2.2s ease-in-out infinite;
    transition:transform 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
    overflow:hidden;
  }
  .connect-btn:hover{
    background:#fff65c;
    transform:translate(-2px,-2px) scale(1.03);
    box-shadow:0 0 0 rgba(255,238,0,0.6), 6px 6px 0 #000;
  }
  .connect-btn:disabled{ opacity:0.5; cursor:default; transform:none; animation:none; }
  @keyframes connect-btn-pulse{
    0%, 100%{ box-shadow:0 0 0 rgba(255,238,0,0.55), 4px 4px 0 #000; }
    50%{ box-shadow:0 0 22px 4px rgba(255,238,0,0.55), 4px 4px 0 #000; }
  }
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
  .access-gate{
    position:relative;
    margin-top:0;
    margin-bottom:2rem;
    padding:1.75rem 1.25rem;
    text-align:center;
    background:#08080a;
    overflow:hidden;
  }
  .access-gate-granted{ border:1px dashed rgba(57,255,20,0.5); }
  .access-gate-denied{ border:1px dashed rgba(255,0,60,0.5); }
  .ag-scan{
    font-size:10px;
    letter-spacing:0.2em;
    text-transform:uppercase;
    color:rgba(232,232,232,0.4);
    margin-bottom:0.9rem;
  }
  .ag-scan-none{
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
  }
  .ag-level{
    font-size:clamp(20px, 6vw, 32px);
    font-weight:700;
    letter-spacing:0.1em;
    margin-bottom:0.6rem;
  }
  .ag-level-granted{ color:#39ff14; text-shadow:0 0 12px rgba(57,255,20,0.6); }
  .ag-level-denied{ color:#ff003c; text-shadow:0 0 12px rgba(255,0,60,0.6); }
  .ag-crown{
    display:inline-block;
    margin-bottom:0.9rem;
    padding:0.4em 1em;
    background:#ffd700;
    border:2px solid #000;
    color:#000;
    font-weight:700;
    font-size:11px;
    letter-spacing:0.08em;
    text-transform:uppercase;
    box-shadow:3px 3px 0 #000;
  }
  .ag-line{
    font-size:13px;
    letter-spacing:0.08em;
    margin-bottom:0.4rem;
  }
  .ag-good{ color:#39ff14; }
  .ag-bad{ color:#ff003c; }
  .ag-signals{
    color:#00fff2;
    text-shadow:0 0 6px rgba(0,255,242,0.4);
    margin-bottom:1rem;
  }
  .ag-reward-block{
    margin-top:0.75rem;
    padding-top:0.75rem;
    border-top:1px dashed rgba(255,215,0,0.3);
  }
  .ag-reward{
    color:#ffd700;
    text-shadow:0 0 6px rgba(255,215,0,0.4);
    font-size:11px;
  }
  .session-watermark{
    position:fixed;
    bottom:0.6rem;
    right:0.8rem;
    font-size:9px;
    letter-spacing:0.08em;
    color:rgba(57,255,20,0.25);
    pointer-events:none;
    z-index:2;
    white-space:nowrap;
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
    <h1>STAT!C_N0DE:://S!GNAL_RELAY<span class="title-rule"></span></h1>
    <div class="construction-notice">
      <div class="cn-stripe"></div>
      <div class="cn-title"><span>⚠️</span><span>UNDER CONSTRUCTION</span><span>⚠️</span></div>
      <div class="cn-body${accessLevel === 0 ? ' cn-body-binary' : ''}">
        ${cnBody}
      </div>
      <div class="cn-footer"><span>🚧⚠️</span><span>THE CROWN IS STILL BUILDING</span><span>⚠️🚧</span></div>
      <div class="cn-stripe bottom"></div>
    </div>
    <div class="collection-link-wrap">
      <a class="collection-link" href="https://deeptide.co/xrpigeons" target="_blank" rel="noopener">
        <span class="collection-link-logo-wrap" aria-hidden="true"><img class="collection-link-logo" src="${proxyIpfsImage('https://ipfs.io/ipfs/QmRbNvemLYjHuRZcpYRRSq5vqqozzjoy3aDR6eSzSoTFUs')}" alt="P!GE0N NFT"></span>
        <span class="collection-link-body">
          <span class="cb-label" style="animation-delay:0.6s">BEC0ME THE S!GNAL →</span>
          <span class="cb-binary" aria-hidden="true" style="animation-delay:0.6s">01010011 01001001 01000111 01001110 01000001 01001100</span>
        </span>
      </a>
    </div>
    <details class="important-notice">
      <summary class="important-notice-summary"><span>⚠️</span><span>!MP0RTANT</span><span>⚠️</span></summary>
      <div class="important-notice-body">
        <div class="important-notice-stripe"></div>
        <div class="important-notice-item">This is a fan-made utility project and has no affiliation, endorsement, or connection with $PIGEONS or their creators.</div>
        <div class="important-notice-item">P!GE0N S!GNATURES exist solely as part of this community-built project, created to give $PIGE0NS holders an additional way to participate and add utility to their NFTs.</div>
        <div class="important-notice-stripe bottom"></div>
      </div>
    </details>
    <div class="signed-counter">
      <div class="signed-counter-header">
        <div class="signed-counter-label">P!GE0NS S!GNED</div>
        <div class="signed-counter-value">${signedCount} <span class="signed-counter-total">/ ${TOTAL_PIGEONS}</span></div>
        <div class="signed-counter-bar"><div class="signed-counter-fill" style="width:${signedPct}%"></div></div>
      </div>
      <details class="tier-legend rules-panel">
        <summary><span class="legend-title"><span class="legend-emoji">⚠️</span> // ACCESS LEVELS <span class="legend-emoji">⚠️</span></span></summary>
        <div class="tier-legend-body">
          <div class="msg-row tl-row tier-green"><div class="msg-plain tl-text tier-green">1-4 P!GE0NS :: LEVEL 01</div></div>
          <div class="msg-row tl-row tier-pink"><div class="msg-plain tl-text tier-pink">5-15 P!GE0NS :: LEVEL 03</div></div>
          <div class="msg-row tl-row tier-red"><div class="msg-plain tl-text tier-red">16-49 P!GE0NS :: LEVEL 06</div></div>
          <div class="msg-row tl-row tier-purple"><div class="msg-plain tl-text tier-purple">50-99 P!GE0NS :: LEVEL 09</div></div>
          <div class="msg-row tl-row tier-gold"><div class="msg-plain tl-text tier-gold">100+ P!GE0NS :: LEVEL 12</div></div>
          <div class="msg-row tl-row tier-diamond"><div class="msg-plain tl-text tier-diamond">CR0WN H0LDER :: LEVEL 15</div></div>

          <div class="rules-body">Your Access Level determines your signature border and which signals you can read.</div>
          <div class="rules-body">You can read your Access Level and all levels below it.</div>

          <div class="rules-subhead">👑 CR0WN — LEVEL 15</div>
          <div class="rules-body">The CR0WN belongs to the wallet holding the most P!GE0NS across the network.</div>
          <div class="rules-body">THE CR0WN !S THE 0NLY ACCESS LEVEL THAT CAN READ THE ENT!RE B0ARD.</div>
          <div class="rules-body">The CR0WN has access to ALL S!GNAL LEVELS — 01, 03, 06, 09, 12 and 15.</div>
          <div class="rules-body">When the CR0WN changes hands, the previous holder loses full-board access. Their historical signatures remain permanently recorded with the Access Level they held when they signed.</div>
        </div>
      </details>
      <details class="tier-legend protocol-panel">
        <summary><span class="legend-title"><span class="legend-emoji">⚠️</span> // P!GE0N S!GNATURE PR0T0C0L <span class="legend-emoji">⚠️</span></span></summary>
        <div class="tier-legend-body">
          <div class="rules-subhead">0NE P!GE0N. 0NE S!GNATURE. 0NE ADDRESS.</div>
          <div class="rules-rule"><span class="rules-num">01 //</span><span>Each P!GE0N can be used to sign the B0ard once — and only by the wallet currently holding it.</span></div>
          <div class="rules-rule"><span class="rules-num">02 //</span><span>Once a P!GE0N is used, it becomes UNAVA!LABLE and is permanently greyed out on the B0ard.</span></div>
          <div class="rules-rule"><span class="rules-num">03 //</span><span>The signature records the wallet address, P!GE0N, Access Level and timestamp at the exact moment it is created.</span></div>
          <div class="rules-rule"><span class="rules-num">04 //</span><span>Your Access Level at signing determines the signature border and is permanently preserved with that signature.</span></div>
          <div class="rules-rule"><span class="rules-num">05 //</span><span>Your signature never changes. Transferring or acquiring P!GE0Ns later has no effect on signatures already made.</span></div>
          <div class="rules-rule"><span class="rules-num">06 //</span><span>A P!GE0N cannot be used again, even if it is transferred to another wallet.</span></div>
        </div>
      </details>
      <details class="tier-legend leaderboard">
        <summary><span class="legend-title"><span class="legend-emoji">❗</span> // T0P S!GNERS <span class="legend-emoji">❗</span></span></summary>
        <div class="tier-legend-body">
          ${leaderboardRows || `<div class="lb-empty">N0 S!GNATURES YET.</div>`}
        </div>
      </details>
    </div>
    ${accessGateSection}
    ${sessionWatermark}
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
      // Guard against a zero-size canvas (e.g. the page rendering into a
      // not-yet-laid-out or zero-width viewport) — createImageData throws
      // on a 0 dimension, and since this whole page is one inline
      // <script>, an uncaught error here would silently abort every
      // statement after it, including the inspect-signal handlers further
      // down.
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

  // Locked-signal "// !NSPECT S!GNAL" toggle — swaps the whole locked
  // notice (warning + bar + note + button) out for the "// S!GNAL
  // L0CKED" detail box entirely, with a visible countdown, for
  // LOCK_DETAIL_SECONDS. Auto-reverts back to the encrypted view when it
  // hits zero (clicking the detail box early does the same thing
  // immediately). Once back on the encrypted view, the inspect button
  // goes on its own visible cooldown for LOCK_COOLDOWN_SECONDS before it
  // can be clicked again — regardless of whether the return was via the
  // timer or a manual click, so there's no way to spam the toggle. Runs
  // for every visitor (locked rows can appear whether or not they're
  // connected), so this sits outside the isPigeon branch below.
  const LOCK_DETAIL_SECONDS = 13;
  const LOCK_COOLDOWN_SECONDS = 13;
  const INSPECT_LABEL = '// !NSPECT S!GNAL';
  document.querySelectorAll('.msg-locked').forEach(row => {
    const front = row.querySelector('.msg-locked-front');
    const detail = row.querySelector('.msg-lock-detail');
    if (!front || !detail) return;
    const btn = front.querySelector('.msg-inspect-btn');
    const timerCount = detail.querySelector('.ld-timer-count');
    let tick = null;

    const showFront = () => {
      if (tick) { clearInterval(tick); tick = null; }
      detail.hidden = true;
      front.hidden = false;
      if (!btn) return;
      let remaining = LOCK_COOLDOWN_SECONDS;
      btn.disabled = true;
      btn.textContent = INSPECT_LABEL + ' (' + remaining + 's)';
      tick = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(tick);
          tick = null;
          btn.disabled = false;
          btn.textContent = INSPECT_LABEL;
        } else {
          btn.textContent = INSPECT_LABEL + ' (' + remaining + 's)';
        }
      }, 1000);
    };

    const showDetail = () => {
      front.hidden = true;
      detail.hidden = false;
      let remaining = LOCK_DETAIL_SECONDS;
      if (timerCount) timerCount.textContent = remaining;
      if (tick) clearInterval(tick);
      tick = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          showFront();
        } else if (timerCount) {
          timerCount.textContent = remaining;
        }
      }, 1000);
    };

    if (btn) btn.addEventListener('click', showDetail);
    detail.addEventListener('click', showFront);
  });

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
        // Resolves to the current origin (localhost while testing here,
        // soitbegins.xyz in production) instead of a hardcoded prod URL,
        // so the OAuth round-trip can actually land back on whichever
        // environment you started it from.
        redirectUrl: window.location.origin + '/board'
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
            window.location.href = window.location.pathname + '?connected=1#accessGate';
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

  const walletCounts = new Map();
  const walletPigeonCounts = new Map();
  for (const m of messages) {
    if (!m.acct) continue;
    walletCounts.set(m.acct, (walletCounts.get(m.acct) || 0) + 1);
    walletPigeonCounts.set(m.acct, Math.max(walletPigeonCounts.get(m.acct) || 0, m.pigeonCount || 1));
  }
  const leaderboard = [...walletCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([acct, count]) => ({ acct, count, pigeonCount: walletPigeonCounts.get(acct) || 1 }));

  const token = getCookie(request, BOARD_COOKIE_NAME);
  let isPigeon = false;
  let hasSession = false;
  let wordLimit = 0;
  let pigeonThumbs = [];
  let acctDisplay = '';
  let pigeonCount = 0;
  let usedPigeonNfts = [];
  let keystoneTs = null;
  // Verified server-side, never trusted from the client: wallet -> Pigeon
  // ownership -> tier -> access level, via getPigeonAccessLevel in
  // _shared.js (see there for what it reuses and why). Stays 0 — "no
  // Pigeon / denied" — unless the isPigeon check below actually finds
  // real Pigeon NFTs on this wallet against live XRPL data. This is the
  // one place the level is computed for /board; renderPage below only
  // ever receives the already-verified result.
  let accessLevel = 0;
  let connectedAcct = null;
  let isCurrentCrown = false;

  // Crown (Phase 4.5) — cheap cached read only; the live full-collection
  // scan never runs inline on a page request (see _shared.js). If the
  // cache is missing or stale, kick off a recompute in the background via
  // waitUntil() so THIS response isn't slowed down — it just serves
  // whatever's cached (possibly null, if a recompute has never run) and
  // the next visitor gets the fresher result. Fetched before the session
  // check below because accessLevel now needs to know Crown status —
  // Crown is level 15 on the same scale, not a separate flag layered on
  // top of it.
  const crownSnapshot = await getCachedCrownHolder(env.coin);
  const crownStale = !crownSnapshot
    || (Math.floor(Date.now() / 1000) - crownSnapshot.computedAt) > CROWN_SNAPSHOT_MAX_AGE_SECONDS;
  if (crownStale) {
    context.waitUntil(recomputeCrownHolder(env.coin).catch(() => {}));
  }

  if (token) {
    const payload = await verifyToken(token, env.Σκύλλα);
    if (payload && payload.acct) {
      hasSession = true;
      connectedAcct = payload.acct;
      isCurrentCrown = isCrownWallet(crownSnapshot, payload.acct);
      acctDisplay = payload.acct.slice(0, 6) + '...' + payload.acct.slice(-4);
      const nfts = await fetchAllAccountNfts(payload.acct);
      isPigeon = !!findPigeon(nfts);
      if (isPigeon) {
        const pigeons = findAllPigeons(nfts);
        pigeonCount = pigeons.length;
        accessLevel = getPigeonAccessLevel(pigeonCount, isCurrentCrown);
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

  // The glitch wallet's pre-restriction double-post left two KV entries for
  // what is really one pigeon signing twice — dedupe it out of the count and
  // leave it out of the per-signature numbering too (the later of the two,
  // same one the glitch visual treatment applies to).
  const glitchWalletTsAll = messages.filter(m => isGlitchWallet(m.acct)).map(m => m.ts);
  const glitchDupTs = glitchWalletTsAll.length > 1 ? Math.max(...glitchWalletTsAll) : null;
  const glitchDuplicateCount = glitchWalletTsAll.length;
  const signedCount = messages.length - Math.max(0, glitchDuplicateCount - 1);

  let orderCounter = 0;
  messages.forEach((m) => {
    if (isGlitchWallet(m.acct) && m.ts === glitchDupTs) {
      m.order = null;
    } else {
      orderCounter++;
      m.order = orderCounter;
    }
  });

  return new Response(
    renderPage({ messages: messages.slice(-50).reverse(), signedCount, leaderboard, isPigeon, hasSession, wordLimit, pigeonThumbs, acctDisplay, pigeonCount, usedPigeonNfts, keystoneTs, accessLevel, isCurrentCrown, crownHolderCount: crownSnapshot ? crownSnapshot.count : null }),
    { headers: { 'Content-Type': 'text/html' } }
  );
}
