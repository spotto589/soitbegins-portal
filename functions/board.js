import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findPigeon, findAllPigeons, getBestPigeonWordLimit, getPigeonThumbnails,
  getPigeonCountTier, getPigeonTierClass, getPigeonAccessLevel,
  getCachedCrownHolder, recomputeCrownHolder, isCrownWallet, CROWN_SNAPSHOT_MAX_AGE_SECONDS,
  proxyIpfsImage
} from './_shared.js';

function textToBinary(str) {
  return str.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// A long message's plaintext sits next to a fixed-size (150-220px) avatar
// square via flexbox — at the default 14px it can grow taller than the
// avatar and spill past it, looking broken. Scale the font down as the
// message gets longer so it stays roughly avatar-height instead. Mirrors
// the same min/max-size-by-length shape already used for the composer's
// live binary preview (see MIN_BINARY_SIZE/MAX_BINARY_SIZE client-side).
const PLAIN_MAX_SIZE = 14;
const PLAIN_MIN_SIZE = 9;
const PLAIN_SCALE_CHARS = 220;
function plainFontSize(text) {
  const ratio = Math.min(text.length / PLAIN_SCALE_CHARS, 1);
  return (PLAIN_MAX_SIZE - ratio * (PLAIN_MAX_SIZE - PLAIN_MIN_SIZE)).toFixed(1);
}

// Access Level decorative overlays — one distinct network-identity motif
// per level, not a shared "sparkle" reused with different emoji. See the
// :root tier variables and each .msg-row.tier-* block for the matching
// border/animation half of each identity.
const CORE_SPARKLES = `<div class="tier-sparkles" aria-hidden="true"><span>👑</span><span>👑</span><span>👑</span><span>👑</span><span>👑</span></div>`;
const ROOT_SPARKLES = `<div class="tier-sparkles" aria-hidden="true"><span>⚠️</span><span>⚠️</span><span>⚠️</span><span>⚠️</span><span>⚠️</span></div><div class="gold-stripe-bottom" aria-hidden="true"></div><div class="root-badge" aria-hidden="true">R00T</div>`;
const NETWORK_NODES = `<div class="network-nodes" aria-hidden="true"><span></span><span></span><span></span><span></span></div>`;
const SYSTEM_NODES = `<div class="system-nodes" aria-hidden="true"><span></span><span></span><span></span></div>`;
const ENCRYPTED_FRAGMENTS = `<div class="tier-sparkles encrypted-fragments" aria-hidden="true"><span>0xF3</span><span>A1C</span><span>#7D</span><span>E2#</span><span>9xB</span></div>`;
const TIER_OVERLAY = {
  'tier-pink': NETWORK_NODES,
  'tier-red': ENCRYPTED_FRAGMENTS,
  'tier-purple': SYSTEM_NODES,
  'tier-gold': ROOT_SPARKLES,
  'tier-diamond': CORE_SPARKLES,
};

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

// Minimum Pigeon count for each non-Crown access level, matching the
// brackets in getPigeonCountTier (_shared.js) — used to tell a locked
// viewer exactly how many Pigeons the level they're missing requires.
// Level 15 has no count of its own: it's Crown-only, so it's called out
// separately in levelRequirementText below.
const LEVEL_MIN_PIGEONS = { 1: 1, 3: 5, 6: 16, 9: 50, 12: 100 };

// Each level's network-identity name — TERMINAL/NETWORK/ENCRYPTED/SYSTEM/
// ROOT/CORE — shown alongside the numeric level everywhere it appears so
// the level reads as a distinct identity, not just a rank number.
const LEVEL_NAMES = { 0: 'N0 S!GNAL', 1: 'TERM!NAL', 3: 'NETW0RK', 6: 'ENCRYPTED', 9: 'SYSTEM', 12: 'R00T', 15: 'C0RE' };

function levelRequirementText(level) {
  if (level === 15) return 'CR0WN REQU!RED';
  const min = LEVEL_MIN_PIGEONS[level];
  return `${min}+ P!GE0NS REQU!RED`;
}

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
  const signer = msg.name ? `${escapeHtml(msg.name)} · ${wallet}` : wallet;
  const avatar = msg.image
    ? (msg.nftId
        ? `<a class="msg-avatar" href="https://deeptide.co/nft/${escapeHtml(msg.nftId)}" target="_blank" rel="noopener"><img class="msg-avatar-img" src="${escapeHtml(proxyIpfsImage(msg.image))}" alt="" loading="lazy"></a>`
        : `<img class="msg-avatar" src="${escapeHtml(proxyIpfsImage(msg.image))}" alt="" loading="lazy">`)
    : `<div class="msg-avatar msg-avatar-blank"></div>`;
  const isGlitch = isGlitchWallet(msg.acct) && msg.ts === glitchTs;
  const tierClass = isGlitch ? 'tier-glitch' : getPigeonTierClass(msg.pigeonCount, isCrownSignature);
  const plain = canDecode
    ? `<div class="msg-plain ${tierClass}" style="font-size:${plainFontSize(msg.text)}px">${escapeHtml(msg.text)}</div>`
    : `<div class="msg-plain msg-locked">
        <div class="msg-locked-front">
          <div class="msg-locked-head"><span>⚠️</span><span>[ ENCRYPTED S!GNAL ]</span><span>⚠️</span></div>
          <div class="msg-locked-bar" aria-hidden="true">${'█'.repeat(40)}</div>
          <div class="msg-locked-note">P!GE0NS REQU!RED T0 DEC0DE</div>
          <button class="msg-inspect-btn" type="button">// !NSPECT S!GNAL</button>
        </div>
        <div class="msg-lock-detail" hidden>
          <div class="ld-title">// S!GNAL L0CKED</div>
          <div class="ld-line">ACCESS LEVEL REQU!RED :: <span class="ld-num">${signalLevelLabel}</span> (${LEVEL_NAMES[signalLevel] || ''})</div>
          <div class="ld-line">Y0UR ACCESS LEVEL :: <span class="ld-num">${String(viewerAccessLevel || 0).padStart(2, '0')}</span> (${LEVEL_NAMES[viewerAccessLevel || 0] || ''})</div>
          <div class="ld-line ld-req">${levelRequirementText(signalLevel)}</div>
          <div class="ld-timer">RETURN!NG !N <span class="ld-timer-count">13</span><span class="ld-timer-unit">s</span></div>
        </div>
      </div>`;
  const binary = canDecode
    ? `<div class="msg-binary">${escapeHtml(textToBinary(msg.text))}</div>`
    : `<div class="msg-binary msg-binary-locked">
        <div class="mb-stripe"></div>
        ${escapeHtml(LOCKED_SIGNAL_BINARY)}
        <div class="mb-stripe bottom"></div>
      </div>`;
  const ts = msg.ts ? `<span class="msg-ts" data-ts="${msg.ts}"></span>` : '';
  const sparkles = TIER_OVERLAY[tierClass] || (isGlitch ? GLITCH_BADGE : '');
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
      <div class="msg-meta"><span class="msg-meta-left"><span class="msg-signed-label">S!GNED ::</span> <span class="msg-signer ${tierClass}">${signer}</span></span>${ts ? `<span class="msg-meta-right">${ts}</span>` : ''}</div>
      ${orderLevelLine}
      <div class="msg-top">
        ${avatar}
        <div class="msg-plain-wrap">${plain}</div>
      </div>
      ${binary}
    </div>`;
}

const TOTAL_PIGEONS = 3015;

function renderPage({ messages, signedCount, leaderboard, isPigeon, hasSession, wordLimit, pigeonThumbs, acctDisplay, pigeonCount, usedPigeonNfts, keystoneTs, accessLevel, isCurrentCrown, crownHolderCount }) {
  // accessLevel arrives already verified from onRequestGet (server-side:
  // wallet -> Pigeon ownership -> tier -> level, via getPigeonAccessLevel
  // in _shared.js). Never recomputed or trusted from anywhere else here.
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
  // A viewer can only decode signals at or below their own access level
  // (the Crown's level 15 clears every comparison, matching "the Crown
  // reads the entire board" from the access-level legend).
  const messageRows = messages.length
    ? messages.map(m => {
        const msgSignalLevel = getPigeonAccessLevel(m.pigeonCount, m.rank === 'CROWN');
        const canDecode = isPigeon && accessLevel >= msgSignalLevel;
        return renderMessageRow(m, canDecode, glitchTs, accessLevel);
      }).join('')
    : `<div class="empty">N0 MESSAGES YET.</div>`;

  const LB_MEDAL_CLASS = { 1: 'medal-gold', 2: 'medal-silver', 3: 'medal-bronze' };
  const leaderboardRows = (leaderboard || []).map((entry, i) => {
    const rank = i + 1;
    const medalClass = LB_MEDAL_CLASS[rank] || '';
    const lbTier = getPigeonCountTier(entry.pigeonCount || 1);
    const acct = escapeHtml(entry.acct);
    return `<div class="lb-row ${lbTier}">
      <span class="lb-rank ${medalClass}">#${rank}</span>
      <span class="lb-count">${entry.count} S!GN${entry.count === 1 ? '' : 'S'}</span>
      <a class="lb-wallet ${medalClass}" href="https://bithomp.com/explorer/${acct}" target="_blank" rel="noopener">${acct}</a>
    </div>`;
  }).join('');

  const signedPct = Math.min(100, Math.round((signedCount / TOTAL_PIGEONS) * 1000) / 10);

  const usedSet = new Set(usedPigeonNfts || []);
  const availableThumbs = (pigeonThumbs || []).filter(p => !usedSet.has(p.nftId));
  const allPigeonsUsed = isPigeon && !!(pigeonThumbs && pigeonThumbs.length) && availableThumbs.length === 0;
  const firstAvailableNftId = availableThumbs.length ? availableThumbs[0].nftId : null;

  const thumbPicker = (isPigeon && pigeonThumbs && pigeonThumbs.length) ? `
      <details class="pigeon-picker-wrap" id="pigeonPickerWrap"${allPigeonsUsed ? ' open' : ''}>
        <summary class="pigeon-picker-btn">CHANGE P!GE0N <span class="ppb-arrow" aria-hidden="true">▾</span></summary>
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
      </details>
  ` : '';

  const sessionControls = hasSession ? `
    <div class="session-controls">
      <button class="signout-btn" id="signOutBtn">S!GN 0UT / CHANGE KEY</button>
    </div>
  ` : '';

  const hasAvailableThumbs = availableThumbs.length > 0;
  const initialAvatarSrc = hasAvailableThumbs ? escapeHtml(proxyIpfsImage(availableThumbs[0].image)) : '';
  const previewTierClass = getPigeonCountTier(pigeonCount || 1);
  const previewSparkles = TIER_OVERLAY[previewTierClass] || '';

  const bottomSection = isPigeon ? `
    <div class="write-box" id="pigeonWalletBoard">
      <div class="write-label">WR!TE A MESSAGE (P!GE0N S!GNATURE REQU!RED :: MAX ${wordLimit} W0RDS)</div>
      <textarea id="msgInput" maxlength="1500" placeholder="Type your message here"></textarea>
      <div class="word-count" id="wordCount"></div>
      <input id="nameInput" maxlength="15" placeholder="..." />
      <div class="sig-label-below">S!GNATURE ¿ (OPT!ONAL, max 15)</div>
      ${thumbPicker}
      <div class="preview-label">PREV!EW</div>
      <div class="msg-row ${previewTierClass}" id="previewRow">
        ${previewSparkles}
        <div class="msg-meta"><span class="msg-meta-left"><span class="msg-signed-label">S!GNED ::</span> <span class="msg-signer ${previewTierClass}"><span id="previewName"></span>${acctDisplay || 'Y0U'}</span></span></div>
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

  const crownBadge = isCurrentCrown
    ? `<div class="ag-crown">👑 CR0WN H0LDER :: T0P PIGE0N HOLDINGS${crownHolderCount ? ` (${crownHolderCount})` : ''}</div>`
    : '';

  const accessGateSection = isPigeon ? `
    <div class="access-gate access-gate-granted" id="accessGate">
      <div class="ag-scan ag-scan-active">// S!GNAL DETECTED</div>
      ${crownBadge}
      <div class="ag-level-box">
        <div class="ag-level-box-label">ACCESS LEVEL</div>
        <div class="ag-level-box-value ag-level-granted">${accessLevelLabel}</div>
      </div>
      <div class="ag-readout">
        <div class="ag-row"><span class="ag-row-label">STATUS:</span><span class="ag-row-value ag-good">✅ C0NNECTED</span></div>
        <div class="ag-row"><span class="ag-row-label">S!GNALS AVA!LABLE</span><span class="ag-row-value ag-signals ag-signals-big">${signalsAvailable}</span></div>
      </div>
    </div>
  ` : (hasSession ? `
    <div class="access-gate access-gate-denied" id="accessGate">
      <div class="ag-scan ag-scan-none">// N0 S!GNAL DETECTED</div>
      <div class="ag-level-box">
        <div class="ag-level-box-label">ACCESS LEVEL</div>
        <div class="ag-level-box-value ag-level-denied">${accessLevelLabel}</div>
      </div>
      <div class="ag-readout">
        <div class="ag-row"><span class="ag-row-label">STATUS:</span><span class="ag-row-value ag-bad">P!GE0N REQU!RED</span></div>
      </div>
      <div class="retry-line">TRY D!FFERENT KEY?</div>
      ${connectBtnHtml}
    </div>
  ` : `
    <div class="access-gate access-gate-denied" id="accessGate">
      <div class="ag-scan ag-scan-none">// N0 S!GNAL DETECTED</div>
      <div class="ag-level-box">
        <div class="ag-level-box-label">ACCESS LEVEL</div>
        <div class="ag-level-box-value ag-level-denied">${accessLevelLabel}</div>
      </div>
      <div class="ag-readout">
        <div class="ag-row"><span class="ag-row-label">STATUS:</span><span class="ag-row-value ag-bad">⛔ N0T C0NNECTED</span></div>
      </div>
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
  /* Single source of truth for the P!GE0N Access Level system. Each level
     is its own network-penetration identity — TERMINAL (01), NETWORK
     (03), ENCRYPTED (06), SYSTEM (09), ROOT (12), CORE/CROWN (15) — not
     a bronze/silver/gold rarity ladder. Every surface that shows a tier
     (legend swatches, message borders, leaderboard) reads its color from
     these variables, so a level's identity only needs to change in one
     place to change everywhere. */
  :root{
    --tier-terminal: 57,255,20;    /* 01 — phosphor green CRT */
    --tier-network: 30,144,255;    /* 03 — electric blue */
    --tier-encrypted: 139,60,255;  /* 06 — deep violet cipher */
    --tier-system: 0,229,255;      /* 09 — cool cyan telemetry */
    --tier-root: 255,23,23;        /* 12 — red alert / privileged */
    --tier-core-1: 255,54,224;
    --tier-core-2: 255,233,63;
    --tier-core-3: 54,230,255;
    --tier-core-soft: 255,142,240;
  }
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
    .ld-req{ animation:none; }
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
    font-size:clamp(12px,3.4vw,16px);
    letter-spacing:0.08em;
    color:#ff003c;
    text-shadow:0 0 6px rgba(255,0,60,0.5);
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
    font-size:0.85em;
    color:#ff003c;
    text-shadow:0 0 6px rgba(255,0,60,0.5);
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
  .cb-label-become{
    font-size:1.3em;
    font-weight:900;
    letter-spacing:0.05em;
  }
  .cb-market-row{
    display:flex;
    gap:0.6em;
    margin-top:0.7em;
  }
  .cb-market-link{
    flex:1;
    text-align:center;
    padding:0.45em 0.4em;
    background:#000;
    color:#ffee00;
    border:2px solid #000;
    font-family:inherit;
    font-weight:700;
    font-size:0.72em;
    letter-spacing:0.04em;
    text-decoration:none;
    transition:background 0.12s ease;
  }
  .cb-market-link:hover{ background:#2a2a2a; }
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
  .important-notice-arrow{
    font-size:14px;
    color:#ff003c;
    text-shadow:0 0 4px rgba(255,0,60,0.5);
    transition:transform 0.2s ease;
  }
  .important-notice[open] .important-notice-arrow{ transform:rotate(180deg); }
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
    color:#39ff14;
    font-size:11px;
    line-height:1.6;
    letter-spacing:0.03em;
    text-shadow:0 0 3px rgba(57,255,20,0.35);
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
    flex:1 1 auto;
    flex-wrap:nowrap;
    align-items:center;
    gap:0.4em;
    min-width:0;
    white-space:nowrap;
    font-size:clamp(10px, 3.2vw, 13px);
  }
  .legend-emoji{
    font-size:1.6em;
    text-shadow:none;
    flex:0 0 auto;
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
    flex-wrap:wrap;
    align-items:center;
    gap:0.4rem 0.75rem;
    padding:0.55rem 0.9rem;
    border:1px solid rgba(255,0,60,0.25);
    background:#08080a;
    font-size:12px;
  }
  .lb-rank{
    flex:0 0 auto;
    color:#ff003c;
    text-shadow:0 0 4px rgba(255,0,60,0.4);
    font-weight:700;
    min-width:2em;
  }
  .lb-wallet{
    flex:1 1 100%;
    order:3;
    min-width:0;
    color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.4);
    text-decoration:underline;
    text-underline-offset:0.15em;
    overflow-wrap:anywhere;
    word-break:break-all;
  }
  .lb-wallet:hover{ opacity:0.8; }
  /* Compound selectors so a medal class reliably beats each element's own
     base color rule regardless of stylesheet order. */
  .lb-rank.medal-gold, .lb-wallet.medal-gold{ color:#ffd700; text-shadow:0 0 6px rgba(255,215,0,0.6); }
  .lb-rank.medal-silver, .lb-wallet.medal-silver{ color:#c0c0c0; text-shadow:0 0 6px rgba(192,192,192,0.6); }
  .lb-rank.medal-bronze, .lb-wallet.medal-bronze{ color:#cd7f32; text-shadow:0 0 6px rgba(205,127,50,0.6); }
  .lb-count{
    flex:0 0 auto;
    margin-left:auto;
    order:2;
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
  /* Same border treatment (width, glow-pulse, sweep overlay, animated
     gradient) as the matching .msg-row.tier-* signature borders, so a
     leaderboard entry's box actually reads as that wallet's tier instead
     of just a thicker line. */
  .lb-row.tier-green{ border-width:1px; border-color:rgba(var(--tier-terminal),0.25); background:linear-gradient(rgba(var(--tier-terminal),0.06), rgba(var(--tier-terminal),0.06)), #08080a; }
  .lb-row.tier-pink{ border-width:1px; border-color:rgba(var(--tier-network),0.6); background:linear-gradient(rgba(var(--tier-network),0.22), rgba(var(--tier-network),0.22)), #08080a; }
  .lb-row.tier-red{ border-width:2px; border-color:rgba(var(--tier-encrypted),0.65); background:linear-gradient(rgba(var(--tier-encrypted),0.22), rgba(var(--tier-encrypted),0.22)), #08080a; }
  .lb-row.tier-purple{
    position:relative;
    overflow:hidden;
    border-width:2.5px;
    border-color:rgba(var(--tier-system),0.6);
    background:linear-gradient(rgba(var(--tier-system),0.24), rgba(var(--tier-system),0.24)), #08080a;
    animation:system-pulse 2.4s ease-in-out infinite;
  }
  .lb-row.tier-purple::after{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:1;
    background:linear-gradient(100deg, transparent 46%, rgba(var(--tier-system),0.7) 49%, rgba(var(--tier-system),0.9) 50%, rgba(var(--tier-system),0.7) 51%, transparent 54%);
    background-size:340% 340%;
    animation:system-scan 3.2s linear infinite;
    mix-blend-mode:screen;
  }
  .lb-row.tier-gold{
    position:relative;
    overflow:hidden;
    border-width:4px;
    border-color:rgba(var(--tier-root),0.9);
    background:linear-gradient(rgba(var(--tier-root),0.32), rgba(var(--tier-root),0.32)), #08080a;
    animation:root-alert-pulse 2.2s ease-in-out infinite;
  }
  .lb-row.tier-gold::after{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:1;
    background:linear-gradient(115deg, transparent 30%, rgba(var(--tier-root),0.3) 46%, rgba(255,220,220,0.6) 50%, rgba(var(--tier-root),0.3) 54%, transparent 70%);
    background-size:300% 300%;
    animation:root-sweep 3s linear infinite;
    mix-blend-mode:screen;
  }
  .lb-row.tier-diamond{
    position:relative;
    overflow:hidden;
    border-style:solid;
    border-width:4px;
    border-color:rgba(var(--tier-core-1),0.7);
    border-image:linear-gradient(90deg, rgb(var(--tier-core-1)), rgb(var(--tier-core-2)), rgb(var(--tier-core-3)), rgb(var(--tier-core-1))) 1;
    background:linear-gradient(135deg, rgba(var(--tier-core-1),0.08), rgba(var(--tier-core-3),0.08), rgba(var(--tier-core-2),0.08)), #08080a;
    animation:diamond-glow-pulse 2.2s ease-in-out infinite;
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
  }
  .collection-link-logo-wrap{
    position:relative;
    flex:0 0 150px;
    width:150px;
    aspect-ratio:1;
    box-sizing:border-box;
    background:radial-gradient(circle, rgba(255,238,0,0.18) 0%, #000 72%);
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
    gap:0.6em;
    padding:0.8em 1em;
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
    border:1px solid rgba(57,255,20,0.4);
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
  /* Same striped-box treatment as .construction-notice / .important-notice,
     so every locked signal's binary placeholder reads as part of the same
     warning-box visual language as the rest of the page. */
  .msg-row.msg-locked-row .msg-binary.msg-binary-locked{
    position:relative;
    overflow:hidden;
    border:1px solid rgba(255,0,60,0.4);
    background:rgba(255,0,60,0.04);
    color:rgba(255,0,60,0.55);
    padding:1rem 0.9rem;
  }
  .mb-stripe{
    height:6px;
    margin:-1rem -0.9rem 0.7rem;
    background:repeating-linear-gradient(45deg, #ff003c 0px, #ff003c 10px, #08080a 10px, #08080a 20px);
    opacity:0.7;
  }
  .mb-stripe.bottom{ margin:0.7rem -0.9rem -1rem; }
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
    color:rgba(57,255,20,0.75);
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
    padding:1.1rem 1.25rem;
    border:1px dashed rgba(255,0,60,0.4);
    background:#000;
    font-size:13px;
    line-height:1.7;
    text-align:left;
    cursor:pointer;
    white-space:normal;
  }
  .ld-title{
    color:#ff003c;
    font-weight:700;
    font-size:14px;
    letter-spacing:0.1em;
    margin-bottom:0.7rem;
    padding-bottom:0.5rem;
    border-bottom:1px dashed rgba(255,0,60,0.3);
    text-shadow:0 0 6px rgba(255,0,60,0.5);
  }
  .ld-line{
    color:#39ff14;
    letter-spacing:0.05em;
    margin-bottom:0.3rem;
  }
  .ld-num{
    color:#ff003c;
    font-weight:700;
    text-shadow:0 0 5px rgba(255,0,60,0.7);
  }
  .ld-req{
    color:#ff003c;
    font-weight:700;
    animation:ld-req-flash 1s step-start infinite;
  }
  @keyframes ld-req-flash{
    0%, 49%{ opacity:1; }
    50%, 100%{ opacity:0.25; }
  }
  .ld-timer{
    margin-top:0.6rem;
    padding-top:0.5rem;
    border-top:1px dashed rgba(255,0,60,0.3);
    font-size:11px;
    letter-spacing:0.08em;
    color:#ff003c;
    text-transform:uppercase;
  }
  .ld-timer-count, .ld-timer-unit{
    color:#ff003c;
    font-weight:700;
    text-shadow:0 0 5px rgba(255,0,60,0.6);
  }
  .msg-inspect-btn:disabled{
    opacity:0.5;
    cursor:default;
  }
  .msg-plain.tier-green{
    color:rgb(var(--tier-terminal));
    text-shadow:0 0 4px rgba(var(--tier-terminal),0.35);
  }
  .msg-plain.tier-pink{
    color:rgb(var(--tier-network));
    text-shadow:0 0 7px rgba(var(--tier-network),0.75);
  }
  .msg-plain.tier-red{
    color:rgb(var(--tier-encrypted));
    text-shadow:0 0 7px rgba(var(--tier-encrypted),0.75);
  }
  .msg-plain.tier-purple{
    color:rgb(var(--tier-system));
    text-shadow:0 0 6px rgba(var(--tier-system),0.5);
    animation:system-telemetry 2.4s ease-in-out infinite;
  }
  @keyframes system-telemetry{
    0%, 100%{ text-shadow:0 0 6px rgba(var(--tier-system),0.5); }
    50%{ text-shadow:0 0 13px rgba(var(--tier-system),0.95), 0 0 22px rgba(var(--tier-system),0.5); }
  }
  .msg-plain.tier-gold{
    color:rgb(var(--tier-root));
    text-shadow:0 0 8px rgba(var(--tier-root),0.7);
    animation:golden-pulse 2.2s ease-in-out infinite;
  }
  @keyframes golden-pulse{
    0%, 100%{ text-shadow:0 0 8px rgba(var(--tier-root),0.7); }
    50%{ text-shadow:0 0 16px rgba(var(--tier-root),1), 0 0 30px rgba(var(--tier-root),0.6); }
  }
  .msg-plain.tier-diamond{
    background:linear-gradient(90deg, rgb(var(--tier-core-1)) 0%, rgb(var(--tier-core-2)) 22%, rgb(var(--tier-core-3)) 45%, rgb(var(--tier-core-1)) 68%, rgb(var(--tier-core-2)) 88%, rgb(var(--tier-core-3)) 100%);
    background-size:300% 100%;
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
    font-weight:800;
    letter-spacing:0.04em;
    filter:drop-shadow(0 0 6px rgba(var(--tier-core-1),0.6));
    animation:diamond-text-shimmer 1.8s linear infinite;
  }
  @keyframes diamond-text-shimmer{
    0%{ background-position:0% 50%; }
    100%{ background-position:300% 50%; }
  }
  /* Level 01 — TERMINAL: basic CRT entry point. Faint horizontal
     scanlines sit over the row and the whole card flickers once in a
     while, like an old phosphor monitor — deliberately the plainest,
     lowest-effort treatment in the ladder. */
  .msg-row.tier-green{
    position:relative;
    overflow:hidden;
    background:linear-gradient(rgba(var(--tier-terminal),0.06), rgba(var(--tier-terminal),0.06)), #08080a;
    animation:terminal-flicker 7s infinite;
  }
  .msg-row.tier-green::after{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:1;
    background:repeating-linear-gradient(0deg, rgba(var(--tier-terminal),0.07) 0px, rgba(var(--tier-terminal),0.07) 1px, transparent 1px, transparent 3px);
  }
  @keyframes terminal-flicker{
    0%, 96%, 100%{ opacity:1; }
    97%{ opacity:0.82; }
    98%{ opacity:1; }
    99%{ opacity:0.88; }
  }
  /* Level 03 — NETWORK: electric blue connectivity. A packet-like light
     sweeps across the row and four corner nodes light up in sequence
     (TL→TR→BR→BL) like a signal travelling the perimeter — reads as
     "connected to something," distinct from level 01's plain terminal. */
  .msg-row.tier-pink{
    position:relative;
    overflow:hidden;
    border-width:1.5px;
    border-color:rgba(var(--tier-network),0.8);
    box-shadow:0 0 8px rgba(var(--tier-network),0.35);
    background:linear-gradient(rgba(var(--tier-network),0.22), rgba(var(--tier-network),0.22)), #08080a;
  }
  .msg-row.tier-pink::after{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:1;
    background:linear-gradient(90deg, transparent 0%, rgba(var(--tier-network),0.85) 4%, transparent 9%);
    background-size:220% 100%;
    animation:network-packet 2.4s linear infinite;
    mix-blend-mode:screen;
  }
  @keyframes network-packet{
    0%{ background-position:-120% 0%; }
    100%{ background-position:220% 0%; }
  }
  .network-nodes span{
    position:absolute;
    width:6px;
    height:6px;
    border-radius:50%;
    background:rgb(var(--tier-network));
    box-shadow:0 0 5px rgba(var(--tier-network),0.9);
    animation:network-node-pulse 2.4s ease-in-out infinite;
    z-index:2;
  }
  .network-nodes span:nth-child(1){ top:-3px; left:-3px; animation-delay:0s; }
  .network-nodes span:nth-child(2){ top:-3px; right:-3px; animation-delay:0.6s; }
  .network-nodes span:nth-child(3){ bottom:-3px; right:-3px; animation-delay:1.2s; }
  .network-nodes span:nth-child(4){ bottom:-3px; left:-3px; animation-delay:1.8s; }
  @keyframes network-node-pulse{
    0%, 70%, 100%{ opacity:0.3; transform:scale(0.8); }
    15%{ opacity:1; transform:scale(1.3); }
  }
  .msg-row.tier-pink .msg-binary{ border-width:1px; border-color:rgba(var(--tier-network),0.45); }
  .msg-row.tier-pink .msg-meta{ border-bottom-color:rgba(var(--tier-network),0.4); }
  .msg-row.tier-pink .msg-avatar{ border-width:1px; border-color:rgba(var(--tier-network),0.45); }
  /* Level 06 — ENCRYPTED: deep violet cipher layer. The row itself
     briefly glitches/fragments on a long random-feeling cycle (mirrors
     the existing glitch-wallet treatment but themed violet, not red),
     and tiny hex/cipher fragments hang around the border like leaked
     ciphertext instead of decorative sparkles. */
  .msg-row.tier-red{
    position:relative;
    overflow:hidden;
    border-width:2px;
    border-color:rgba(var(--tier-encrypted),0.7);
    background:linear-gradient(rgba(var(--tier-encrypted),0.22), rgba(var(--tier-encrypted),0.22)), #08080a;
    animation:encrypted-glitch 5s infinite;
  }
  @keyframes encrypted-glitch{
    0%, 92%, 100%{ transform:translate(0,0); filter:none; }
    93%{ transform:translate(-2px,1px); filter:hue-rotate(20deg); }
    94%{ transform:translate(2px,-1px); filter:none; }
    95%{ transform:translate(-1px,0); filter:hue-rotate(-15deg); }
    96%{ transform:translate(0,0); filter:none; }
  }
  .msg-row.tier-red .msg-binary{ border-width:2px; border-color:rgba(var(--tier-encrypted),0.45); }
  .msg-row.tier-red .msg-meta{ border-bottom-color:rgba(var(--tier-encrypted),0.35); }
  .msg-row.tier-red .msg-avatar{ border-width:2px; border-color:rgba(var(--tier-encrypted),0.45); }
  .encrypted-fragments span{
    font-size:9px;
    font-family:'JetBrains Mono', monospace;
    font-weight:700;
    color:rgba(var(--tier-encrypted),0.85);
    text-shadow:0 0 4px rgba(var(--tier-encrypted),0.9);
    filter:none;
  }
  /* Level 09 — SYSTEM: cool cyan diagnostic telemetry. A narrow scan-line
     sweeps the row (not a soft metallic shine) and two indicator dots
     blink out of phase like status LEDs, so it reads as "inside the
     operating system" rather than a shinier version of level 06. */
  .msg-row.tier-purple{
    position:relative;
    overflow:hidden;
    border-width:2.5px;
    border-color:rgba(var(--tier-system),0.6);
    background:linear-gradient(rgba(var(--tier-system),0.24), rgba(var(--tier-system),0.24)), #08080a;
    animation:system-pulse 2.4s ease-in-out infinite;
  }
  @keyframes system-pulse{
    0%, 100%{ box-shadow:0 0 6px rgba(var(--tier-system),0.25), inset 0 0 10px rgba(var(--tier-system),0.05); }
    50%{ box-shadow:0 0 16px rgba(var(--tier-system),0.55), inset 0 0 18px rgba(var(--tier-system),0.12); }
  }
  .msg-row.tier-purple::after{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:1;
    background:linear-gradient(100deg, transparent 46%, rgba(var(--tier-system),0.7) 49%, rgba(var(--tier-system),0.9) 50%, rgba(var(--tier-system),0.7) 51%, transparent 54%);
    background-size:340% 340%;
    animation:system-scan 3.2s linear infinite;
    mix-blend-mode:screen;
  }
  @keyframes system-scan{
    0%{ background-position:0% 0%; }
    100%{ background-position:100% 100%; }
  }
  .system-nodes{
    position:absolute;
    top:6px;
    right:8px;
    z-index:2;
    display:flex;
    gap:5px;
  }
  .system-nodes span{
    width:5px;
    height:5px;
    border-radius:50%;
    background:rgb(var(--tier-system));
    box-shadow:0 0 4px rgba(var(--tier-system),0.9);
    animation:system-blink 1.6s ease-in-out infinite;
  }
  .system-nodes span:nth-child(2){ animation-delay:0.5s; }
  .system-nodes span:nth-child(3){ animation-delay:1s; }
  @keyframes system-blink{
    0%, 40%, 100%{ opacity:0.25; }
    20%{ opacity:1; }
  }
  .msg-row.tier-purple .msg-binary{ border-width:2.5px; border-color:rgba(var(--tier-system),0.4); }
  .msg-row.tier-purple .msg-meta{ border-bottom-color:rgba(var(--tier-system),0.35); }
  .msg-row.tier-purple .msg-avatar{ border-width:2.5px; border-color:rgba(var(--tier-system),0.4); }
  /* Level 12 — ROOT: privileged/administrative red alert, not a "prize"
     tier. Heavy border, alert-stripe banner top and bottom, a hot sweep,
     and an occasional harder glitch-shake than level 06's — this is the
     loudest, most imposing normal level. */
  .msg-row.tier-gold{
    position:relative;
    overflow:hidden;
    border-width:4px;
    border-color:rgba(var(--tier-root),0.9);
    background:linear-gradient(rgba(var(--tier-root),0.32), rgba(var(--tier-root),0.32)), #08080a;
    animation:root-alert-pulse 2.2s ease-in-out infinite, root-glitch 4s infinite;
  }
  @keyframes root-alert-pulse{
    0%, 100%{ box-shadow:0 0 14px rgba(var(--tier-root),0.5), inset 0 0 16px rgba(var(--tier-root),0.1); }
    50%{ box-shadow:0 0 30px rgba(var(--tier-root),0.85), inset 0 0 30px rgba(var(--tier-root),0.2); }
  }
  @keyframes root-glitch{
    0%, 90%, 100%{ transform:translate(0,0); }
    91%{ transform:translate(-3px,1px); }
    92%{ transform:translate(3px,-2px); }
    93%{ transform:translate(-2px,2px); }
    94%{ transform:translate(0,0); }
  }
  .msg-row.tier-gold::before{
    content:'';
    position:absolute;
    top:0; left:0; right:0;
    height:6px;
    z-index:2;
    background:repeating-linear-gradient(45deg, rgb(var(--tier-root)) 0px, rgb(var(--tier-root)) 10px, #08080a 10px, #08080a 20px);
  }
  .gold-stripe-bottom{
    position:absolute;
    bottom:0; left:0; right:0;
    height:6px;
    z-index:2;
    background:repeating-linear-gradient(45deg, rgb(var(--tier-root)) 0px, rgb(var(--tier-root)) 10px, #08080a 10px, #08080a 20px);
  }
  .msg-row.tier-gold::after{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:1;
    background:linear-gradient(115deg, transparent 30%, rgba(var(--tier-root),0.3) 46%, rgba(255,220,220,0.6) 50%, rgba(var(--tier-root),0.3) 54%, transparent 70%);
    background-size:300% 300%;
    animation:root-sweep 3s linear infinite;
    mix-blend-mode:screen;
  }
  @keyframes root-sweep{
    0%{ background-position:0% 0%; }
    100%{ background-position:100% 100%; }
  }
  .root-badge{
    position:absolute;
    top:10px;
    right:10px;
    z-index:3;
    padding:0.15em 0.5em;
    background:#000;
    border:1px solid rgb(var(--tier-root));
    color:rgb(var(--tier-root));
    font-size:9px;
    font-weight:700;
    letter-spacing:0.08em;
    text-shadow:0 0 4px rgba(var(--tier-root),0.8);
  }
  .msg-row.tier-gold .msg-binary{ border-width:4px; border-color:rgba(var(--tier-root),0.5); }
  .msg-row.tier-gold .msg-meta{ border-bottom-color:rgba(var(--tier-root),0.4); }
  .msg-row.tier-gold .msg-avatar{ border-width:4px; border-color:rgba(var(--tier-root),0.5); }
  .msg-row.tier-diamond{
    position:relative;
    overflow:hidden;
    border-style:solid;
    border-width:4px;
    border-color:rgba(var(--tier-core-soft),1);
    border-image:linear-gradient(90deg, rgb(var(--tier-core-1)), rgb(var(--tier-core-2)), rgb(var(--tier-core-3)), rgb(var(--tier-core-1))) 1;
    background:linear-gradient(135deg, rgba(var(--tier-core-1),0.08), rgba(var(--tier-core-3),0.08), rgba(var(--tier-core-2),0.08)), #08080a;
    animation:diamond-glow-pulse 2.2s ease-in-out infinite;
  }
  .msg-row.tier-diamond .msg-binary{
    border-style:solid;
    border-width:4px;
    border-color:rgba(var(--tier-core-soft),0.5);
    border-image:linear-gradient(90deg, rgb(var(--tier-core-1)), rgb(var(--tier-core-2)), rgb(var(--tier-core-3)), rgb(var(--tier-core-1))) 1;
  }
  .msg-row.tier-diamond .msg-meta{ border-bottom-color:rgba(var(--tier-core-soft),0.4); }
  .msg-row.tier-diamond .msg-avatar{
    border-style:solid;
    border-width:4px;
    border-color:rgba(var(--tier-core-soft),0.5);
    border-image:linear-gradient(135deg, rgb(var(--tier-core-1)), rgb(var(--tier-core-2)), rgb(var(--tier-core-3)), rgb(var(--tier-core-1))) 1;
  }
  @keyframes diamond-glow-pulse{
    0%, 100%{ box-shadow:0 0 18px rgba(var(--tier-core-1),0.4), 0 0 34px rgba(var(--tier-core-3),0.22), inset 0 0 24px rgba(var(--tier-core-1),0.08); }
    50%{ box-shadow:0 0 28px rgba(var(--tier-core-1),0.65), 0 0 52px rgba(var(--tier-core-3),0.38), inset 0 0 32px rgba(var(--tier-core-1),0.15); }
  }
  .tier-sparkles{
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:2;
  }
  .tier-sparkles span{
    position:absolute;
    font-size:13px;
    filter:drop-shadow(0 0 5px rgba(255,255,255,0.9));
    animation:diamond-sparkle-twinkle 1.6s ease-in-out infinite;
  }
  .tier-sparkles span:nth-child(1){ top:12%; left:10%; animation-delay:0s; }
  .tier-sparkles span:nth-child(2){ top:10%; left:82%; animation-delay:0.3s; }
  .tier-sparkles span:nth-child(3){ top:74%; left:58%; animation-delay:0.6s; }
  .tier-sparkles span:nth-child(4){ top:80%; left:20%; animation-delay:0.9s; }
  .tier-sparkles span:nth-child(5){ top:56%; left:90%; animation-delay:1.2s; }
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
    color:#ff003c;
    text-shadow:0 0 4px rgba(255,0,60,0.4);
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
  .msg-signed-label{
    color:#ff003c;
    text-shadow:0 0 4px rgba(255,0,60,0.5);
  }
  .msg-signer{
    color:#ffd700;
    text-shadow:0 0 4px rgba(255,215,0,0.4);
  }
  .msg-signer.tier-green{ color:rgb(var(--tier-terminal)); text-shadow:0 0 4px rgba(var(--tier-terminal),0.4); }
  .msg-signer.tier-pink{ color:rgb(var(--tier-network)); text-shadow:0 0 6px rgba(var(--tier-network),0.6); }
  .msg-signer.tier-red{ color:rgb(var(--tier-encrypted)); text-shadow:0 0 6px rgba(var(--tier-encrypted),0.6); }
  .msg-signer.tier-purple{ color:rgb(var(--tier-system)); text-shadow:0 0 5px rgba(var(--tier-system),0.45); }
  .msg-signer.tier-gold{ color:rgb(var(--tier-root)); text-shadow:0 0 6px rgba(var(--tier-root),0.6); }
  .msg-signer.tier-diamond{
    background:linear-gradient(90deg, rgb(var(--tier-core-1)) 0%, rgb(var(--tier-core-2)) 22%, rgb(var(--tier-core-3)) 45%, rgb(var(--tier-core-1)) 68%, rgb(var(--tier-core-2)) 88%, rgb(var(--tier-core-3)) 100%);
    background-size:300% 100%;
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
    animation:diamond-text-shimmer 1.8s linear infinite;
  }
  .wallet-link{
    color:inherit;
    text-shadow:inherit;
    text-decoration:underline;
    text-underline-offset:0.15em;
  }
  .wallet-link:hover{ opacity:0.8; }
  .msg-ts{
    color:#ff003c;
    text-shadow:0 0 4px rgba(255,0,60,0.5);
    font-variant-numeric:tabular-nums;
  }
  .msg-avatar{
    flex:0 0 150px;
    width:150px;
    aspect-ratio:1;
    height:auto;
    object-fit:contain;
    background:radial-gradient(circle, rgba(255,238,0,0.12) 0%, #08080a 72%);
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
  .pigeon-picker-wrap{
    margin:0 0 1rem;
    text-align:left;
  }
  .pigeon-picker-btn{
    cursor:pointer;
    list-style:none;
    display:flex;
    align-items:center;
    justify-content:center;
    gap:0.6em;
    width:100%;
    box-sizing:border-box;
    padding:1em 1.2em;
    border:2px solid rgba(255,0,60,0.7);
    background:rgba(255,0,60,0.08);
    color:#ff003c;
    font-family:inherit;
    font-size:14px;
    font-weight:700;
    letter-spacing:0.12em;
    text-transform:uppercase;
    text-shadow:0 0 8px rgba(255,0,60,0.6);
    box-shadow:0 0 10px rgba(255,0,60,0.25);
    -webkit-tap-highlight-color:transparent;
    transition:background 0.15s ease;
  }
  .pigeon-picker-btn:hover{ background:rgba(255,0,60,0.18); }
  .pigeon-picker-btn::-webkit-details-marker{ display:none; }
  .ppb-arrow{ font-size:16px; transition:transform 0.2s ease; }
  .pigeon-picker-wrap[open] .ppb-arrow{ transform:rotate(180deg); }
  .pigeon-picker-wrap[open] .pigeon-picker-btn{
    border-bottom-left-radius:0;
    border-bottom-right-radius:0;
  }
  .pigeon-picker-wrap .pigeon-picker{
    margin:0;
    padding:0.9rem;
    border:2px solid rgba(255,0,60,0.4);
    border-top:none;
  }
  .pigeon-picker{
    display:grid;
    grid-template-columns:repeat(6, 1fr);
    gap:0.5rem;
    margin-bottom:1rem;
    background:#08080a;
  }
  .pigeon-thumb{
    width:100%;
    aspect-ratio:1;
    height:auto;
    object-fit:contain;
    background:radial-gradient(circle, rgba(255,238,0,0.12) 0%, #08080a 72%);
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
    margin-top:1.6rem;
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
    pointer-events:none;
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
    font-size:clamp(13px, 4vw, 16px);
    letter-spacing:0.2em;
    text-transform:uppercase;
    color:rgba(232,232,232,0.4);
    margin-bottom:0.9rem;
  }
  .ag-scan-none, .ag-scan-active{
    color:#39ff14;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
  }
  .ag-level-granted{ color:#ff003c; text-shadow:0 0 12px rgba(255,0,60,0.6); }
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
  .ag-good{ color:#39ff14; }
  .ag-bad{ color:#ff003c; }
  .ag-signals{ color:#ff003c; text-shadow:0 0 6px rgba(255,0,60,0.5); }
  .ag-signals-big{ font-size:1.6em; }
  .ag-level-box{
    margin-top:0.9rem;
    padding:0.9rem 1rem;
    border:1px dashed rgba(57,255,20,0.35);
    background:#000;
    text-align:center;
  }
  .ag-level-box-label{
    font-size:11px;
    letter-spacing:0.15em;
    color:rgba(57,255,20,0.75);
    text-transform:uppercase;
    margin-bottom:0.5rem;
  }
  .ag-level-box-value{
    font-size:clamp(24px, 7vw, 36px);
    font-weight:700;
    letter-spacing:0.1em;
  }
  /* Terminal-style readout for the granted access panel — left-aligned
     label::value rows in a bordered box, instead of centered stacked
     lines of varying sizes. */
  .ag-readout{
    margin-top:0.9rem;
    border:1px dashed rgba(57,255,20,0.35);
    background:#000;
    padding:0.85rem 1rem;
    text-align:left;
  }
  .ag-row{
    display:flex;
    align-items:baseline;
    justify-content:space-between;
    gap:1em;
    font-size:12px;
    letter-spacing:0.06em;
    padding:0.4rem 0;
    border-bottom:1px dashed rgba(57,255,20,0.15);
  }
  .ag-row:last-child{ border-bottom:none; }
  .ag-row-label{
    color:rgba(57,255,20,0.75);
    white-space:nowrap;
  }
  .ag-row-value{
    font-weight:700;
    white-space:nowrap;
    text-align:right;
    text-shadow:0 0 6px currentColor;
  }
  .ag-row-value.ag-good{
    font-size:1.6em;
    text-shadow:0 0 2px rgba(57,255,20,0.3);
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
  /* Access Level login sequence — plays once, right after a fresh wallet
     connect, themed to the level the viewer actually holds. Deliberately
     short (line-reveal only, ~1.5-2s total): a system authenticating you,
     not a cinematic. See TIER_OVERLAY / :root vars for the identity this
     mirrors on the board itself. */
  .level-login-overlay{
    position:fixed;
    inset:0;
    z-index:60;
    background:#08080a;
    display:none;
    align-items:center;
    justify-content:center;
    text-align:center;
  }
  .level-login-overlay.active{ display:flex; }
  .level-login-inner{
    max-width:480px;
    padding:6vw;
    font-size:clamp(14px,3.4vw,19px);
    letter-spacing:0.1em;
    font-weight:700;
  }
  .ll-line{
    margin-bottom:0.9rem;
    opacity:0;
    transform:translateY(4px);
    transition:opacity 0.25s ease, transform 0.25s ease;
  }
  .ll-line.show{ opacity:1; transform:translateY(0); }
  .ll-terminal .ll-line{ color:#39ff14; text-shadow:0 0 10px rgba(57,255,20,0.5); }
  .ll-terminal{ animation:terminal-flicker 1.4s infinite; }
  .ll-network .ll-line{ color:rgb(var(--tier-network)); text-shadow:0 0 10px rgba(var(--tier-network),0.6); }
  .ll-network .ll-line.show::after{
    content:'';
    display:inline-block;
    width:6px; height:6px;
    border-radius:50%;
    background:rgb(var(--tier-network));
    box-shadow:0 0 6px rgba(var(--tier-network),0.9);
    margin-left:8px;
    vertical-align:middle;
    animation:network-node-pulse 1s ease-in-out infinite;
  }
  .ll-encrypted .ll-line{ color:rgb(var(--tier-encrypted)); text-shadow:0 0 10px rgba(var(--tier-encrypted),0.6); }
  .ll-encrypted{ animation:encrypted-glitch 1.1s infinite; }
  .ll-system{ position:relative; overflow:hidden; }
  .ll-system .ll-line{ color:rgb(var(--tier-system)); text-shadow:0 0 10px rgba(var(--tier-system),0.6); }
  .ll-system::before{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    background:linear-gradient(100deg, transparent 46%, rgba(var(--tier-system),0.45) 50%, transparent 54%);
    background-size:340% 340%;
    animation:system-scan 0.9s linear infinite;
    mix-blend-mode:screen;
  }
  .ll-root .ll-line{ color:rgb(var(--tier-root)); text-shadow:0 0 12px rgba(var(--tier-root),0.75); }
  .ll-root{ animation:root-glitch 1s infinite; }
  .ll-core .ll-line{
    background:linear-gradient(90deg, rgb(var(--tier-core-1)) 0%, rgb(var(--tier-core-2)) 33%, rgb(var(--tier-core-3)) 66%, rgb(var(--tier-core-1)) 100%);
    background-size:300% 100%;
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
    animation:diamond-text-shimmer 0.9s linear infinite;
    font-weight:800;
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
      <div class="cn-title"><span>🚧⚠️</span><span>NETW0RK UNDER C0NSTRUCTION</span><span>⚠️🚧</span></div>
      <div class="cn-body${accessLevel === 0 ? ' cn-body-binary' : ''}">
        ${cnBody}
      </div>
      <div class="cn-footer"><span>🚧⚠️</span><span>NETW0RK UNDER C0NSTRUCTION</span><span>⚠️🚧</span></div>
      <div class="cn-stripe bottom"></div>
    </div>
    <div class="collection-link-wrap">
      <div class="collection-link">
        <span class="collection-link-logo-wrap" aria-hidden="true"><img class="collection-link-logo" src="${proxyIpfsImage('https://ipfs.io/ipfs/QmRbNvemLYjHuRZcpYRRSq5vqqozzjoy3aDR6eSzSoTFUs')}" alt="P!GE0N NFT"></span>
        <span class="collection-link-body">
          <span class="cb-label cb-label-become" style="animation-delay:0.6s">BEC0ME THE S!GNAL</span>
          <span class="cb-binary" aria-hidden="true" style="animation-delay:0.6s">01010011 01001001 01000111 01001110 01000001 01001100</span>
          <span class="cb-market-row">
            <a class="cb-market-link" href="https://deeptide.co/xrpigeons" target="_blank" rel="noopener">DEEPT!DE →</a>
            <a class="cb-market-link" href="https://xrp.cafe/collection/xrpigeons" target="_blank" rel="noopener">XRP CAFE →</a>
          </span>
        </span>
      </div>
    </div>
    <details class="important-notice">
      <summary class="important-notice-summary"><span class="important-notice-arrow" aria-hidden="true">▾</span><span>⚠️</span><span>!MP0RTANT</span><span>⚠️</span><span class="important-notice-arrow" aria-hidden="true">▾</span></summary>
      <div class="important-notice-body">
        <div class="important-notice-stripe"></div>
        <div class="important-notice-item">This is a fan-made utility project and has no affiliation, endorsement, or connection with $PIGEONS or their creators.</div>
        <div class="important-notice-item">This S!GNAL_RELAY exists solely as part of this community-built project, created to give $PIGE0NS holders an additional way to participate and add utility to their NFTs.</div>
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
        <summary><span class="legend-title">// ACCESS LEVELS <span class="legend-emoji">⚠️</span></span></summary>
        <div class="tier-legend-body">
          <div class="msg-row tl-row tier-green"><div class="msg-plain tl-text tier-green">1-4 P!GE0NS :: LEVEL 01 :: TERM!NAL</div></div>
          <div class="msg-row tl-row tier-pink">${NETWORK_NODES}<div class="msg-plain tl-text tier-pink">5-15 P!GE0NS :: LEVEL 03 :: NETW0RK</div></div>
          <div class="msg-row tl-row tier-red">${ENCRYPTED_FRAGMENTS}<div class="msg-plain tl-text tier-red">16-49 P!GE0NS :: LEVEL 06 :: ENCRYPTED</div></div>
          <div class="msg-row tl-row tier-purple">${SYSTEM_NODES}<div class="msg-plain tl-text tier-purple">50-99 P!GE0NS :: LEVEL 09 :: SYSTEM</div></div>
          <div class="msg-row tl-row tier-gold">${ROOT_SPARKLES}<div class="msg-plain tl-text tier-gold">100+ P!GE0NS :: LEVEL 12 :: R00T</div></div>
          <div class="msg-row tl-row tier-diamond">${CORE_SPARKLES}<div class="msg-plain tl-text tier-diamond">CR0WN H0LDER :: LEVEL 15 :: C0RE</div></div>

          <div class="rules-body">Your ACCESS LEVEL determines your signature border and which signals you can read.</div>
          <div class="rules-body">You can read your ACCESS LEVEL and all levels below it.</div>

          <div class="rules-subhead">👑 CR0WN — LEVEL 15</div>
          <div class="rules-body">The CR0WN belongs to the wallet holding the most P!GE0NS across the network.</div>
          <div class="rules-body">THE CR0WN !S THE 0NLY ACCESS LEVEL THAT CAN READ THE ENT!RE B0ARD.</div>
          <div class="rules-body">The CR0WN has access to ALL S!GNAL LEVELS — 01, 03, 06, 09, 12 and 15.</div>
          <div class="rules-body">When the CR0WN changes hands, the previous holder loses full-board access. Their historical signatures remain permanently recorded with the ACCESS LEVEL they held when they signed.</div>
        </div>
      </details>
      <details class="tier-legend protocol-panel">
        <summary><span class="legend-title">// S!GNATURE PR0T0C0L <span class="legend-emoji">⚠️</span></span></summary>
        <div class="tier-legend-body">
          <div class="rules-subhead">0NE P!GE0N. 0NE S!GNATURE. 0NE ADDRESS.</div>
          <div class="rules-rule"><span class="rules-num">01 //</span><span>Each P!GE0N can be used to sign the B0ard once — and only by the wallet currently holding it.</span></div>
          <div class="rules-rule"><span class="rules-num">02 //</span><span>Once a P!GE0N is used, it becomes UNAVA!LABLE and is permanently greyed out on the B0ard.</span></div>
          <div class="rules-rule"><span class="rules-num">03 //</span><span>The signature records the wallet address, P!GE0N, ACCESS LEVEL and timestamp at the exact moment it is created.</span></div>
          <div class="rules-rule"><span class="rules-num">04 //</span><span>Your ACCESS LEVEL at signing determines the signature border and is permanently preserved with that signature.</span></div>
          <div class="rules-rule"><span class="rules-num">05 //</span><span>Your signature never changes. Transferring or acquiring P!GE0Ns later has no effect on signatures already made.</span></div>
          <div class="rules-rule"><span class="rules-num">06 //</span><span>A P!GE0N cannot be used again, even if it is transferred to another wallet.</span></div>
        </div>
      </details>
      <details class="tier-legend leaderboard">
        <summary><span class="legend-title">// T0P S!GNERS <span class="legend-emoji">❗</span></span></summary>
        <div class="tier-legend-body">
          ${leaderboardRows || `<div class="lb-empty">N0 S!GNATURES YET.</div>`}
        </div>
      </details>
    </div>
    ${accessGateSection}
    ${bottomSection}
    ${sessionWatermark}
    ${sessionControls}
    ${messageRows}
  </div>

  <div class="scan-overlay" id="scanOverlay">
    <div class="scan-overlay-inner">
      <div class="scan-title">C0NNECT!NG<span class="scan-cursor"></span></div>
      <div class="scan-line" id="scanLine1">P!GE0N S!GNATURE........<span class="scan-result" id="scanResult1"></span></div>
      <div class="scan-line" id="scanLine2">0PEN!NG RELAY...</div>
    </div>
  </div>

  <div class="level-login-overlay" id="levelLoginOverlay">
    <div class="level-login-inner" id="levelLoginInner"></div>
  </div>

<script src="https://xumm.app/assets/cdn/xumm-oauth2-pkce.min.js"></script>
<script>
  const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

  // Access Level login sequence — plays once, right after a fresh wallet
  // connect (the OAuth redirect below lands on ?connected=1), now that
  // the server actually knows the viewer's real access level. The URL
  // param is stripped immediately either way so a manual refresh never
  // replays it, and a sessionStorage flag guards it a second time.
  (function(){
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') !== '1') return;
    const ACCESS_LEVEL = ${accessLevel};
    const IS_PIGEON = ${isPigeon ? 'true' : 'false'};
    history.replaceState(null, '', window.location.pathname + window.location.hash);
    if (!IS_PIGEON || !ACCESS_LEVEL) return;
    const playedKey = 'pigeonLoginPlayed:' + ACCESS_LEVEL;
    if (sessionStorage.getItem(playedKey) === '1') return;
    sessionStorage.setItem(playedKey, '1');

    const SEQUENCES = {
      1: { cls: 'll-terminal', lines: ['// S!GNAL DETECTED', 'ACCESS LEVEL :: 01', 'TERM!NAL ACCESS :: GRANTED'] },
      3: { cls: 'll-network', lines: ['// S!GNAL DETECTED', 'ACCESS LEVEL :: 03', 'NETW0RK ACCESS :: GRANTED'] },
      6: { cls: 'll-encrypted', lines: ['// S!GNAL DETECTED', 'ACCESS LEVEL :: 06', 'ENCRYPTED ACCESS :: GRANTED'] },
      9: { cls: 'll-system', lines: ['// S!GNAL DETECTED', 'ACCESS LEVEL :: 09', 'SYSTEM ACCESS :: GRANTED'] },
      12: { cls: 'll-root', lines: ['// S!GNAL DETECTED', 'ACCESS LEVEL :: 12', 'R00T AUTHENT!CAT!0N', 'R00T ACCESS :: GRANTED'] },
      15: { cls: 'll-core', lines: ['// S!GNAL DETECTED', 'CR0WN H0LDER', 'ACCESS LEVEL :: 15', 'C0RE ACCESS :: GRANTED'] },
    };
    const seq = SEQUENCES[ACCESS_LEVEL];
    if (!seq) return;

    const overlay = document.getElementById('levelLoginOverlay');
    const inner = document.getElementById('levelLoginInner');
    inner.className = 'level-login-inner ' + seq.cls;
    inner.innerHTML = seq.lines.map(function(t){ return '<div class="ll-line">' + t + '</div>'; }).join('');
    overlay.classList.add('active');

    const lineEls = inner.querySelectorAll('.ll-line');
    const STEP = 380;
    lineEls.forEach(function(el, i){
      setTimeout(function(){ el.classList.add('show'); }, 150 + i * STEP);
    });
    setTimeout(function(){ overlay.classList.remove('active'); }, 150 + lineEls.length * STEP + 500);
  })();

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
  const PLAIN_MAX_SIZE = ${PLAIN_MAX_SIZE};
  const PLAIN_MIN_SIZE = ${PLAIN_MIN_SIZE};
  const PLAIN_SCALE_CHARS = ${PLAIN_SCALE_CHARS};
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
    const plainRatio = Math.min(input.value.length / PLAIN_SCALE_CHARS, 1);
    plainPreview.style.fontSize = (PLAIN_MAX_SIZE - plainRatio * (PLAIN_MAX_SIZE - PLAIN_MIN_SIZE)).toFixed(1) + 'px';
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
