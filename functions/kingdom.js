import {
  KINGDOM_COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findAllKingNfts, getTopKingRarity,
  KINGDOM_CLAIM_CONFIG
} from './_shared.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderLocked() {
  return `
    <div class="kd-actions">
      <button class="connect-btn" id="kdConnectBtn"><span class="cb-label"><span class="caution">⚠</span> C0NNECT WALLET <span class="caution">⚠</span></span><span class="cb-binary" aria-hidden="true">01001011 01001001 01001110 01000111 01000100 01001111 01001101</span></button>
      <div class="kd-status" id="kdConnectStatus"></div>
    </div>`;
}

function renderNoKing() {
  return `
    <div class="kd-denied">
      <div class="kd-denied-title">⚠️ ACCESS DEN!ED ⚠️</div>
      <div class="kd-denied-sub">N0 K!NG DETECTED</div>
      <div class="kd-denied-body">TH!S WALLET H0LDS N0 EL!G!BLE K!NG NFT. THE C0UNC!L D0ES N0T KN0W Y0U.</div>
      <button class="signout-btn" id="kdSignOutBtn">TRY D!FFERENT KEY</button>
    </div>`;
}

function renderClaimCard(kind, config, held) {
  const eligible = held.length > 0;
  const statusLine = !config.configured
    ? 'C0M!NG S00N'
    : (eligible ? 'READY' : 'N0T EL!G!BLE');
  return `
    <div class="kd-claim-card ${eligible ? 'kd-eligible' : 'kd-ineligible'}">
      <div class="kd-claim-label">${escapeHtml(config.label)}</div>
      <div class="kd-claim-category">${escapeHtml(config.category)}</div>
      <button class="kd-claim-btn" data-kind="${kind}" ${eligible && config.configured ? '' : 'disabled'}>CLA!M ${escapeHtml(config.label)}</button>
      <div class="kd-claim-status">${statusLine}</div>
    </div>`;
}

function renderRarity(topRarity) {
  if (!topRarity) return '';
  const avatar = topRarity.image
    ? `<img class="kd-rarity-thumb" src="${escapeHtml(topRarity.image)}" alt="" loading="lazy">`
    : `<div class="kd-rarity-thumb kd-rarity-thumb-blank"></div>`;
  const rankLine = topRarity.rarityTotal
    ? `RANK ${topRarity.rarityRank} / ${topRarity.rarityTotal}`
    : `RANK ${topRarity.rarityRank}`;
  return `
    <div class="kd-rarity">
      ${avatar}
      <div class="kd-rarity-body">
        <div class="kd-rarity-label">T0P RAR!TY</div>
        <div class="kd-rarity-name">${escapeHtml(topRarity.name || 'K!NG')}</div>
        <div class="kd-rarity-rank">${escapeHtml(rankLine)}</div>
      </div>
    </div>`;
}

function renderKingdom({ claimHolds, topRarity }) {
  const claimCards = Object.entries(KINGDOM_CLAIM_CONFIG)
    .map(([kind, config]) => renderClaimCard(kind, config, claimHolds[kind]))
    .join('');

  return `
    <div class="kd-king-detected">
      <div class="kd-king-detected-title">K!NG DETECTED</div>
      <div class="kd-king-detected-sub">Y0UR CLA!M HAS BEEN REC0GN!SED</div>
    </div>
    ${renderRarity(topRarity)}
    <details class="kd-chamber" open>
      <summary class="kd-chamber-summary">ENTER THE K!NGD0M</summary>
      <div class="kd-chamber-body">
        <details class="kd-claiming">
          <summary>// START CLA!M!NG</summary>
          <div class="kd-claim-grid">${claimCards}</div>
          <div class="kd-claim-status-global" id="kdClaimStatus"></div>
        </details>
      </div>
    </details>`;
}

// Paused — not deleted. /kingdom never really launched and isn't one of
// the 4 pages actually in use (main, /board, /swap, /redeem's key login),
// so this is switched off at the door rather than kept live and pulling
// on KV for something nobody's using. Flip this back to false to restore
// it exactly as it was; nothing below this gate was touched.
const KINGDOM_PAGE_PAUSED = true;

export async function onRequestGet(context) {
  const { request, env } = context;

  if (KINGDOM_PAGE_PAUSED) {
    return new Response('THE K!NGD0M !S CURRENTLY 0FFL!NE.', { status: 503 });
  }

  if (!env.Σκύλλα) {
    return new Response('server misconfigured', { status: 500 });
  }

  const token = getCookie(request, KINGDOM_COOKIE_NAME);
  let hasSession = false;
  let bodyHtml = renderLocked();

  if (token) {
    const payload = await verifyToken(token, env.Σκύλλα);
    if (payload && payload.acct) {
      hasSession = true;
      const nfts = await fetchAllAccountNfts(payload.acct);
      const kingNfts = findAllKingNfts(nfts);

      if (!kingNfts.length) {
        bodyHtml = renderNoKing();
      } else {
        const topRarity = await getTopKingRarity(payload.acct, kingNfts.map(n => n.NFTokenID));

        const claimHolds = {
          honey: kingNfts,
          crwn: kingNfts,
        };

        bodyHtml = renderKingdom({ claimHolds, topRarity });
      }
    }
  }

  return new Response(renderPage(bodyHtml, hasSession), { headers: { 'Content-Type': 'text/html' } });
}

function renderPage(bodyHtml, hasSession) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>THE K!NGD0M</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#08080a; }
  body{
    font-family:'Chakra Petch',sans-serif;
    color:#e8e8e8;
    display:flex;
    justify-content:center;
    padding:8vh 6vw 10vh;
    position:relative;
    overflow-x:hidden;
  }
  canvas#staticBg{
    position:fixed; inset:0; width:100%; height:100%; z-index:0;
    opacity:0.22; filter:brightness(0.7) contrast(1.3); mix-blend-mode:screen;
  }
  .page{ max-width:720px; width:100%; position:relative; z-index:1; }
  h1{
    font-size:clamp(18px,4.6vw,30px);
    letter-spacing:0.08em; color:#ffd700; text-shadow:0 0 10px rgba(255,215,0,0.4);
    margin-bottom:2rem; text-align:center; word-break:break-word; overflow-wrap:anywhere;
  }
  .kd-actions{ text-align:center; }
  .kd-status{ margin-top:0.8rem; font-size:12px; min-height:1.4em; color:#39ff14; }
  .connect-btn{
    position:relative; display:inline-flex; flex-wrap:wrap; align-items:center; justify-content:center;
    gap:0.5em; background:#ffee00; border:2px solid #000; color:#000; font-family:inherit; font-weight:700;
    font-size:clamp(12px,3.6vw,15px); letter-spacing:0.1em; padding:0.9em 1.4em; text-align:center;
    cursor:pointer; text-transform:uppercase; overflow:hidden; transition:transform 0.12s ease, background 0.12s ease;
  }
  .connect-btn:hover{ background:#fff65c; transform:translateY(-1px); }
  .connect-btn:disabled{ opacity:0.5; cursor:default; }
  .caution{ font-size:1.15em; }
  .cb-label{ display:inline-flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:0.5em; animation:cb-label-flicker 1.8s infinite; }
  .cb-binary{
    position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:#000;
    color:#39ff14; font-size:11px; letter-spacing:0.05em; text-shadow:0 0 8px rgba(57,255,20,0.8);
    white-space:nowrap; overflow:hidden; opacity:0; animation:cb-binary-flicker 1.8s infinite;
  }
  @keyframes cb-label-flicker{
    0%,84%,100%{opacity:1;} 86%{opacity:0;} 88%{opacity:1;} 90%{opacity:0;} 92%{opacity:1;} 94%{opacity:0.2;} 96%{opacity:1;}
  }
  @keyframes cb-binary-flicker{
    0%,84%,100%{opacity:0;} 86%{opacity:1;} 88%{opacity:0;} 90%{opacity:1;} 92%{opacity:0;} 94%{opacity:0.9;} 96%{opacity:0;}
  }
  .kd-denied{ text-align:center; border:1px solid rgba(255,0,60,0.4); background:rgba(255,0,60,0.04); padding:2rem 1.5rem; }
  .kd-denied-title{ font-size:16px; letter-spacing:0.08em; color:#ff003c; text-shadow:0 0 8px rgba(255,0,60,0.6); font-weight:700; margin-bottom:0.5rem; }
  .kd-denied-sub{ font-size:20px; letter-spacing:0.06em; color:#ff003c; font-weight:700; margin-bottom:1rem; }
  .kd-denied-body{ font-size:12px; color:rgba(232,232,232,0.7); line-height:1.7; margin-bottom:1.5rem; }
  .signout-btn{
    background:transparent; border:1px solid rgba(232,232,232,0.3); color:rgba(232,232,232,0.7);
    font-family:inherit; font-size:11px; letter-spacing:0.1em; padding:0.7em 1.4em; cursor:pointer; text-transform:uppercase;
  }
  .signout-btn:hover{ background:rgba(232,232,232,0.08); color:#e8e8e8; }
  .kd-king-detected{ text-align:center; border:1px solid rgba(255,215,0,0.5); background:rgba(255,215,0,0.04); padding:1.25rem; margin-bottom:1.5rem; }
  .kd-king-detected-title{ font-size:18px; font-weight:700; letter-spacing:0.08em; color:#ffd700; text-shadow:0 0 8px rgba(255,215,0,0.5); }
  .kd-king-detected-sub{ font-size:12px; letter-spacing:0.05em; color:#39ff14; margin-top:0.4rem; }
  .kd-chamber{ border:1px solid rgba(57,255,20,0.3); background:rgba(57,255,20,0.02); }
  .kd-chamber-summary{
    cursor:pointer; list-style:none; padding:0.9rem 1.1rem; text-align:center; font-size:13px;
    letter-spacing:0.1em; color:#39ff14; text-shadow:0 0 6px rgba(57,255,20,0.4); text-transform:uppercase;
  }
  .kd-chamber-summary::-webkit-details-marker{ display:none; }
  .kd-chamber-body{ padding:0 1.1rem 1.25rem; border-top:1px solid rgba(57,255,20,0.15); padding-top:1.25rem; }
  .kd-rarity{ display:flex; align-items:center; gap:0.9rem; border:1px solid rgba(255,215,0,0.4); background:rgba(255,215,0,0.03); padding:1rem 1.1rem; margin-bottom:1.5rem; }
  .kd-rarity-thumb{ flex:0 0 64px; width:64px; height:64px; object-fit:cover; border:1px solid rgba(255,215,0,0.4); }
  .kd-rarity-thumb-blank{ background:repeating-linear-gradient(45deg, rgba(255,215,0,0.08) 0px, rgba(255,215,0,0.08) 4px, transparent 4px, transparent 8px); }
  .kd-rarity-body{ flex:1; min-width:0; }
  .kd-rarity-label{ font-size:10px; letter-spacing:0.15em; color:rgba(232,232,232,0.5); margin-bottom:0.3rem; }
  .kd-rarity-name{ font-size:14px; font-weight:700; letter-spacing:0.06em; color:#ffd700; text-shadow:0 0 6px rgba(255,215,0,0.4); }
  .kd-rarity-rank{ font-size:12px; letter-spacing:0.05em; color:#39ff14; margin-top:0.2rem; }
  .kd-claiming{ border-top:1px solid rgba(57,255,20,0.15); padding-top:1rem; }
  .kd-claiming summary{ cursor:pointer; list-style:none; font-size:12px; letter-spacing:0.08em; color:#ffd500; text-shadow:0 0 6px rgba(255,213,0,0.4); text-transform:uppercase; margin-bottom:1rem; }
  .kd-claiming summary::-webkit-details-marker{ display:none; }
  .kd-claim-grid{ display:grid; grid-template-columns:1fr; gap:0.75rem; }
  @media (min-width:641px){ .kd-claim-grid{ grid-template-columns:1fr 1fr; } }
  .kd-claim-card{ border:1px solid rgba(57,255,20,0.2); background:#08080a; padding:0.9rem; text-align:center; }
  .kd-claim-card.kd-ineligible{ opacity:0.5; }
  .kd-claim-label{ font-size:13px; font-weight:700; letter-spacing:0.05em; color:#e8e8e8; }
  .kd-claim-category{ font-size:9px; letter-spacing:0.1em; color:rgba(232,232,232,0.45); margin:0.3rem 0 0.7rem; }
  .kd-claim-btn{
    width:100%; background:transparent; border:1px solid rgba(57,255,20,0.5); color:#39ff14; font-family:inherit;
    font-size:10px; letter-spacing:0.06em; padding:0.65em; cursor:pointer; text-transform:uppercase;
  }
  .kd-claim-btn:hover:not(:disabled){ background:rgba(57,255,20,0.1); }
  .kd-claim-btn:disabled{ opacity:0.4; cursor:default; }
  .kd-claim-status{ font-size:9px; letter-spacing:0.08em; color:rgba(232,232,232,0.5); margin-top:0.6rem; }
  .kd-claim-status-global{ text-align:center; font-size:11px; min-height:1.4em; color:#39ff14; margin-top:1rem; }
  .test-vanity-wrap{ text-align:center; margin-top:2rem; }
  .test-vanity-btn{
    background:#ff0000; border:2px solid #000; color:#fff; font-family:inherit; font-weight:700;
    font-size:clamp(12px,3.6vw,15px); letter-spacing:0.12em; padding:0.8em 1.4em;
    cursor:pointer; text-transform:uppercase; text-shadow:0 0 6px rgba(0,0,0,0.5);
  }
  .test-vanity-btn:hover{ background:#ff3333; }
  .test-vanity-btn:disabled{ opacity:0.5; cursor:default; }
  .test-vanity-status{ margin-top:0.7rem; font-size:12px; min-height:1.4em; color:#ff5555; }
</style>
</head>
<body>
  <canvas id="staticBg"></canvas>
  <div class="page">
    <h1>THE K!NGD0M</h1>
    ${bodyHtml}
    <div class="test-vanity-wrap">
      <button class="test-vanity-btn" id="testVanityBtn">TEST VANITY</button>
      <div class="test-vanity-status" id="testVanityStatus"></div>
    </div>
  </div>

<script src="https://xumm.app/assets/cdn/xumm-oauth2-pkce.min.js"></script>
<script>
  const XAMAN_API_KEY = 'c418ff7d-673f-4a7a-b797-3bb0413653f1';

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

  const signOutBtn = document.getElementById('kdSignOutBtn');
  if (signOutBtn) {
    signOutBtn.addEventListener('click', async () => {
      signOutBtn.disabled = true;
      try { await fetch('/api/kingdom-disconnect', { method: 'POST' }); } catch (e) {}
      window.location.href = window.location.pathname;
    });
  }

  // Single shared Xaman/Scylla login flow for this page. The underlying SDK
  // persists PKCE state under fixed storage keys (not per-instance — see
  // xumm-oauth2-pkce's internal use of the literal keys "pkce_code_verifier"
  // / "pkce_state"), so two separate XummPkce objects on the same
  // page silently clobber each other's in-flight login. CONNECT WALLET and
  // TEST VANITY now share one instance; PENDING_ACTION_KEY (our own storage
  // key, unrelated to the SDK's) remembers which button was pressed across
  // the redirect/reload so the single success handler knows which flow to run.
  const PENDING_ACTION_KEY = 'kdPendingAuthAction';
  let xummAuth = null;
  function getAuth(){
    if(!xummAuth){
      xummAuth = new XummPkce(XAMAN_API_KEY, {
        implicit: true,
        rememberJwt: false,
        redirectUrl: 'https://soitbegins.xyz/kingdom'
      });
      xummAuth.on('error', (err)=>{
        const action = localStorage.getItem(PENDING_ACTION_KEY);
        localStorage.removeItem(PENDING_ACTION_KEY);
        if (action === 'vanity') {
          const btn = document.getElementById('testVanityBtn');
          document.getElementById('testVanityStatus').textContent = 'ERR://LOGIN_ABORTED';
          if (btn) btn.disabled = false;
        } else {
          const btn = document.getElementById('kdConnectBtn');
          const status = document.getElementById('kdConnectStatus');
          if (status) status.textContent = 'ERR://LOGIN_ABORTED';
          if (btn) btn.disabled = false;
        }
      });
      xummAuth.on('success', async ()=>{
        const action = localStorage.getItem(PENDING_ACTION_KEY);
        localStorage.removeItem(PENDING_ACTION_KEY);
        const state = await xummAuth.state();
        const jwt = state && state.jwt;

        if (action === 'vanity') {
          const btn = document.getElementById('testVanityBtn');
          const status = document.getElementById('testVanityStatus');
          if(!jwt){
            status.textContent = 'ERR://NO_WALLET_DATA';
            if (btn) btn.disabled = false;
            return;
          }
          status.textContent = 'CHECK!NG VAN!TY KEY...';
          try {
            const res = await fetch('/api/scylla-mock-redeem', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mockWalletHasStatic: true })
            });
            const data = await res.json();
            status.textContent = data.granted ? 'VAN!TY KEY 0K :: ' + data.master : 'VAN!TY KEY DEN!ED';
          } catch(e) {
            status.textContent = 'ERR://SIGNAL_LOST';
          }
          if (btn) btn.disabled = false;
          return;
        }

        const btn = document.getElementById('kdConnectBtn');
        const status = document.getElementById('kdConnectStatus');
        if (!btn || !status) return;
        if(!jwt){
          status.textContent = 'ERR://NO_WALLET_DATA';
          btn.disabled = false;
          return;
        }
        try {
          const res = await fetch('/api/kingdom-connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jwt })
          });
          const data = await res.json();
          if (data.ok) {
            window.location.reload();
          } else {
            status.textContent = 'ERR://C0NNECT!0N FA!LED';
            btn.disabled = false;
          }
        } catch(e) {
          status.textContent = 'ERR://SIGNAL_LOST';
          btn.disabled = false;
        }
      });
    }
    return xummAuth;
  }
  getAuth();

  const testVanityBtn = document.getElementById('testVanityBtn');
  if (testVanityBtn) {
    testVanityBtn.addEventListener('click', ()=>{
      testVanityBtn.disabled = true;
      document.getElementById('testVanityStatus').textContent = 'OPENING SECURE CHANNEL...';
      localStorage.setItem(PENDING_ACTION_KEY, 'vanity');
      getAuth().authorize();
    });
  }

  const kdConnectBtn = document.getElementById('kdConnectBtn');
  if (kdConnectBtn) {
    kdConnectBtn.addEventListener('click', ()=>{
      kdConnectBtn.disabled = true;
      document.getElementById('kdConnectStatus').textContent = 'OPENING SECURE CHANNEL...';
      localStorage.setItem(PENDING_ACTION_KEY, 'connect');
      getAuth().authorize();
    });
  }

  ${hasSession ? `
  document.querySelectorAll('.kd-claim-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const kind = btn.dataset.kind;
      const status = document.getElementById('kdClaimStatus');
      btn.disabled = true;
      status.textContent = 'SUBM!TT!NG CLA!M...';
      try {
        const res = await fetch('/api/kingdom-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind })
        });
        const data = await res.json();
        if (data.ok) {
          status.textContent = 'CLA!M REQUEST REC0RDED';
        } else if (data.error === 'not_configured') {
          status.textContent = 'ERR://CLA!M N0T C0NF!GURED YET';
        } else {
          status.textContent = 'ERR://CLA!M REJECTED';
          btn.disabled = false;
        }
      } catch (e) {
        status.textContent = 'ERR://SIGNAL_LOST';
        btn.disabled = false;
      }
    });
  });
  ` : ''}
</script>
</body>
</html>`;
}
