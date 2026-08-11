import {
  KINGDOM_COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findAllKingNfts, getKingThumbnails,
  findAllHoneypots, findAllGreenNfts, findAllYellowNfts,
  KINGDOM_CLAIM_CONFIG, KINGDOM_CLAIMANTS
} from './_shared.js';

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderLocked() {
  return `
    <div class="kd-story">
      <p>THE K!NG HAS LEFT TO SEEK THE CR0WN.</p>
      <p>A FALSE K!NGD0M CLA!MS T0 BE #1.</p>
      <p>THE KN!GHTS REFUSE TO REC0GN!SE !T.</p>
      <p>THE C0UNC!L MUST DEC!DE WH0 THE TRUE K!NG !S.</p>
    </div>
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
  const statusLine = !eligible
    ? 'N0T EL!G!BLE'
    : (config.configured ? 'READY' : 'N0T C0NF!GURED YET');
  return `
    <div class="kd-claim-card ${eligible ? 'kd-eligible' : 'kd-ineligible'}">
      <div class="kd-claim-label">${escapeHtml(config.label)}</div>
      <div class="kd-claim-category">${escapeHtml(config.category)}</div>
      <button class="kd-claim-btn" data-kind="${kind}" ${eligible && config.configured ? '' : 'disabled'}>CLA!M ${escapeHtml(config.label)}</button>
      <div class="kd-claim-status">${statusLine}</div>
    </div>`;
}

function renderKingdom({ kingThumbs, votes, claimHolds }) {
  const claimantCards = Object.values(KINGDOM_CLAIMANTS).map(c => `
    <div class="kd-claimant-card">
      <div class="kd-claimant-status">CLA!MANT</div>
      <div class="kd-claimant-name">${escapeHtml(c.name)}</div>
      <div class="kd-claimant-market">MARKETPLACE :: ${escapeHtml(c.marketplace)}</div>
      <a class="kd-claimant-link" href="${escapeHtml(c.url)}" target="_blank" rel="noopener">V!EW L!ST!NG →</a>
    </div>`).join('');

  const voteRows = kingThumbs.map(k => {
    const v = votes[k.nftId];
    const avatar = k.image
      ? `<img class="kd-king-thumb" src="${escapeHtml(k.image)}" alt="" loading="lazy">`
      : `<div class="kd-king-thumb kd-king-thumb-blank"></div>`;
    if (v) {
      const claimant = KINGDOM_CLAIMANTS[v.candidate];
      return `
        <div class="kd-vote-row">
          ${avatar}
          <div class="kd-vote-body">
            <div class="kd-vote-id">${escapeHtml(k.label)}</div>
            <div class="kd-verdict">Y0UR VERD!CT HAS BEEN REC0RDED</div>
            <div class="kd-verdict-sub">VOTED :: ${escapeHtml(claimant ? claimant.name : v.candidate)} :: CANN0T BE CHANGED</div>
          </div>
        </div>`;
    }
    return `
      <div class="kd-vote-row">
        ${avatar}
        <div class="kd-vote-body">
          <div class="kd-vote-id">${escapeHtml(k.label)}</div>
          <div class="kd-vote-btns">
            <button class="kd-vote-btn" data-nft="${escapeHtml(k.nftId)}" data-candidate="invisible">THE !NV!S!BLE K!NG</button>
            <button class="kd-vote-btn" data-nft="${escapeHtml(k.nftId)}" data-candidate="knight">THE KN!GHT K!NG</button>
          </div>
        </div>
      </div>`;
  }).join('');

  const claimCards = Object.entries(KINGDOM_CLAIM_CONFIG)
    .map(([kind, config]) => renderClaimCard(kind, config, claimHolds[kind]))
    .join('');

  return `
    <div class="kd-king-detected">
      <div class="kd-king-detected-title">K!NG DETECTED</div>
      <div class="kd-king-detected-sub">Y0UR CLA!M HAS BEEN REC0GN!SED</div>
    </div>
    <details class="kd-chamber" open>
      <summary class="kd-chamber-summary">ENTER THE K!NGD0M</summary>
      <div class="kd-chamber-body">
        <div class="kd-story kd-story-chamber">
          <p>THE K!NG HAS LEFT TO SEEK THE CR0WN.</p>
          <p>THE FALSE K!NGD0M CLA!MS #1.</p>
          <p>THE KN!GHTS REFUSE TO REC0GN!SE !T.</p>
          <p>THE C0UNC!L MUST DEC!DE WH0 !S THE TRUE K!NG.</p>
        </div>
        <div class="kd-claimants">${claimantCards}</div>
        <div class="kd-vote-section">
          <div class="kd-vote-heading">WH0 !S THE TRUE K!NG?</div>
          ${voteRows}
        </div>
        <div class="kd-vote-status" id="kdVoteStatus"></div>
        <details class="kd-claiming">
          <summary>// START CLA!M!NG</summary>
          <div class="kd-claim-grid">${claimCards}</div>
          <div class="kd-claim-status-global" id="kdClaimStatus"></div>
        </details>
      </div>
    </details>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
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
        const kingThumbs = await getKingThumbnails(env.coin, kingNfts);
        const voteEntries = await Promise.all(
          kingThumbs.map(async (k) => {
            const raw = await env.coin.get(`vote:${k.nftId}`);
            return [k.nftId, raw ? JSON.parse(raw) : null];
          })
        );
        const votes = Object.fromEntries(voteEntries.filter(([, v]) => v !== null));

        const claimHolds = {
          honey: findAllHoneypots(nfts),
          beta: findAllGreenNfts(nfts),
          rlusd: findAllYellowNfts(nfts),
          crwn: kingNfts,
        };

        bodyHtml = renderKingdom({ kingThumbs, votes, claimHolds });
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
    position:fixed; inset:0; width:100%; height:100%; z-index:0;
    opacity:0.22; filter:brightness(0.7) contrast(1.3); mix-blend-mode:screen;
  }
  .page{ max-width:720px; width:100%; position:relative; z-index:1; }
  h1{
    font-size:clamp(18px,4.6vw,30px);
    letter-spacing:0.08em; color:#ffd700; text-shadow:0 0 10px rgba(255,215,0,0.4);
    margin-bottom:2rem; text-align:center; word-break:break-word; overflow-wrap:anywhere;
  }
  .kd-story{ text-align:center; margin-bottom:2rem; }
  .kd-story p{
    font-size:13px; letter-spacing:0.04em; line-height:1.9; color:#39ff14;
    text-shadow:0 0 4px rgba(57,255,20,0.35);
  }
  .kd-story-chamber{ margin-bottom:1.75rem; }
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
  .kd-claimants{ display:grid; grid-template-columns:1fr; gap:1rem; margin-bottom:1.75rem; }
  @media (min-width:641px){ .kd-claimants{ grid-template-columns:1fr 1fr; } }
  .kd-claimant-card{ border:1px solid rgba(255,215,0,0.4); background:#08080a; padding:1.1rem; text-align:center; }
  .kd-claimant-status{ font-size:10px; letter-spacing:0.12em; color:#ff003c; margin-bottom:0.5rem; }
  .kd-claimant-name{ font-size:14px; font-weight:700; letter-spacing:0.06em; color:#ffd700; text-shadow:0 0 6px rgba(255,215,0,0.4); margin-bottom:0.4rem; }
  .kd-claimant-market{ font-size:10px; letter-spacing:0.05em; color:rgba(232,232,232,0.55); margin-bottom:0.8rem; }
  .kd-claimant-link{ display:inline-block; font-size:11px; letter-spacing:0.06em; color:#00fff2; text-shadow:0 0 6px rgba(0,255,242,0.4); text-decoration:none; border-bottom:1px solid rgba(0,255,242,0.4); }
  .kd-claimant-link:hover{ color:#7fffef; border-color:#7fffef; }
  .kd-vote-heading{ text-align:center; font-size:14px; font-weight:700; letter-spacing:0.06em; color:#e8e8e8; margin-bottom:1rem; }
  .kd-vote-row{ display:flex; align-items:center; gap:0.9rem; border:1px solid rgba(57,255,20,0.2); background:#08080a; padding:0.75rem; margin-bottom:0.6rem; }
  .kd-king-thumb{ flex:0 0 56px; width:56px; height:56px; object-fit:cover; border:1px solid rgba(255,215,0,0.4); }
  .kd-king-thumb-blank{ background:repeating-linear-gradient(45deg, rgba(57,255,20,0.06) 0px, rgba(57,255,20,0.06) 4px, transparent 4px, transparent 8px); }
  .kd-vote-body{ flex:1; min-width:0; }
  .kd-vote-id{ font-size:11px; letter-spacing:0.06em; color:#ffd700; margin-bottom:0.5rem; }
  .kd-vote-btns{ display:flex; flex-wrap:wrap; gap:0.5rem; }
  .kd-vote-btn{
    background:transparent; border:1px solid rgba(57,255,20,0.5); color:#39ff14; font-family:inherit;
    font-size:10px; letter-spacing:0.06em; padding:0.6em 0.9em; cursor:pointer; text-transform:uppercase;
  }
  .kd-vote-btn:hover{ background:rgba(57,255,20,0.1); }
  .kd-vote-btn:disabled{ opacity:0.5; cursor:default; }
  .kd-verdict{ font-size:11px; letter-spacing:0.05em; color:#ff003c; text-shadow:0 0 4px rgba(255,0,60,0.4); }
  .kd-verdict-sub{ font-size:10px; letter-spacing:0.04em; color:rgba(232,232,232,0.55); margin-top:0.2rem; }
  .kd-vote-status{ text-align:center; font-size:11px; min-height:1.4em; color:#39ff14; margin:0.5rem 0 1.5rem; }
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
</style>
</head>
<body>
  <canvas id="staticBg"></canvas>
  <div class="page">
    <h1>THE K!NGD0M</h1>
    ${bodyHtml}
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

  ${!hasSession ? `
  let xummAuth = null;
  function getAuth(){
    if(!xummAuth){
      xummAuth = new XummPkce(XAMAN_API_KEY, {
        implicit: true,
        rememberJwt: false,
        redirectUrl: 'https://soitbegins.xyz/kingdom'
      });
      xummAuth.on('error', (err)=>{
        document.getElementById('kdConnectStatus').textContent = 'ERR://LOGIN_ABORTED';
        document.getElementById('kdConnectBtn').disabled = false;
      });
      xummAuth.on('success', async ()=>{
        const state = await xummAuth.state();
        const jwt = state && state.jwt;
        if(!jwt){
          document.getElementById('kdConnectStatus').textContent = 'ERR://NO_WALLET_DATA';
          document.getElementById('kdConnectBtn').disabled = false;
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
            document.getElementById('kdConnectStatus').textContent = 'ERR://C0NNECT!0N FA!LED';
            document.getElementById('kdConnectBtn').disabled = false;
          }
        } catch(e) {
          document.getElementById('kdConnectStatus').textContent = 'ERR://SIGNAL_LOST';
          document.getElementById('kdConnectBtn').disabled = false;
        }
      });
    }
    return xummAuth;
  }
  getAuth();
  document.getElementById('kdConnectBtn').addEventListener('click', ()=>{
    document.getElementById('kdConnectBtn').disabled = true;
    document.getElementById('kdConnectStatus').textContent = 'OPENING SECURE CHANNEL...';
    getAuth().authorize();
  });
  ` : `
  document.querySelectorAll('.kd-vote-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nftId = btn.dataset.nft;
      const candidate = btn.dataset.candidate;
      const status = document.getElementById('kdVoteStatus');
      document.querySelectorAll('.kd-vote-btn[data-nft="' + nftId + '"]').forEach(b => b.disabled = true);
      status.textContent = 'REC0RD!NG VERD!CT...';
      try {
        const res = await fetch('/api/kingdom-vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nftId, candidate })
        });
        const data = await res.json();
        if (data.ok) {
          status.textContent = 'Y0UR VERD!CT HAS BEEN REC0RDED';
          setTimeout(() => location.reload(), 700);
        } else {
          status.textContent = 'ERR://VOTE REJECTED';
          document.querySelectorAll('.kd-vote-btn[data-nft="' + nftId + '"]').forEach(b => b.disabled = false);
        }
      } catch (e) {
        status.textContent = 'ERR://SIGNAL_LOST';
        document.querySelectorAll('.kd-vote-btn[data-nft="' + nftId + '"]').forEach(b => b.disabled = false);
      }
    });
  });

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
  `}
</script>
</body>
</html>`;
}
