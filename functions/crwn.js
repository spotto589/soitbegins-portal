import {
  COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, hasAccessKey, findKingNft, findAllKingNfts, findHoneypot,
  getBestCrownTier, CROWN_TIERS
} from './_shared.js';

const CRWN_PER_DAY = 1; // placeholder rate — adjust to the real $CRWN emission rate
const HONEY_PER_DAY = 2; // placeholder rate — adjust to the real $HONEY emission rate (eventually scales with # of Honeypots held)
const BOTH_MULTIPLIER = 3; // $CRWN-only bonus for holding King + Honeypot together (does not affect $HONEY)

// XRPL has no fast way to look up "when did this wallet acquire this NFT" —
// the only method is scanning tx history, which is too slow for a live page
// (tested: 35s+ and still inconclusive on an active wallet). Instead we track
// our own "first seen" timestamps in KV and count from there. Returning
// visitors keep accumulating; the clock doesn't retroactively credit time
// held before their first visit here.
async function getOrStartTimer(kv, key) {
  let firstSeen = await kv.get(key);
  if (!firstSeen) {
    firstSeen = String(Math.floor(Date.now() / 1000));
    await kv.put(key, firstSeen);
  }
  return parseInt(firstSeen, 10);
}

function statBlock(label, value, sub) {
  return `
      <div class="stat">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${value}</div>
        ${sub ? `<div class="stat-sub">${sub}</div>` : ''}
      </div>`;
}

function glitchify(text) {
  return text.toUpperCase().replace(/I/g, '!').replace(/O/g, '0');
}

function renderCrownStatusList(crownTier) {
  const rows = CROWN_TIERS.map((t, i) => ({
    label: glitchify(t.display),
    multiplier: t.multiplier,
    achieved: crownTier.index === i
  }));
  rows.push({
    label: 'K!NG',
    multiplier: 1,
    achieved: crownTier.index === -1
  });

  const items = rows.map(r => `
      <div class="crown-row${r.achieved ? ' achieved' : ''}">
        <span>${r.achieved ? '▸ ' : '&nbsp;&nbsp;'}${r.label}</span>
        <span>×${r.multiplier}</span>
      </div>`).join('');

  return `
    <div class="crown-status">
      <div class="crown-status-label">CR0WN STATUS:</div>
      ${items}
    </div>`;
}

function renderPage({ state, daysHeld, crwnClaimable, honeyClaimable, denyReason, crownTier }) {
  let body;
  let claimHoney = false;
  let claimCrwn = false;
  const crownLine = crownTier ? renderCrownStatusList(crownTier) : '';
  // Their "status" is their rarest crown, not just generic "King" — pick
  // the specific tier they've earned, falling back to plain K!NG only if
  // they hold no NFT with a recognized crown trait.
  const kingStatus = crownTier && crownTier.name ? glitchify(crownTier.name) : 'K!NG';

  if (state === 'both') {
    claimHoney = true;
    claimCrwn = true;
    const crwnTotalMult = BOTH_MULTIPLIER * crownTier.multiplier;
    body = `
    <div class="eyebrow">👑 THR0NE R00M</div>
    <div class="status-line">STATUS: ${kingStatus}</div>
    <h1>Y0U ARE A K!NG, TAKE Y0UR SHARE</h1>
    <p class="intro">King signature found. Honeypot signature found. $CRWN earnings multiplied ×${BOTH_MULTIPLIER}.</p>
    ${crownLine}
    <div class="stat-row">${statBlock('VER!F!ED F0R', daysHeld.toFixed(2) + ' DAYS')}</div>
    <div class="stat-row">
      ${statBlock('$HONEY CLA!MABLE', honeyClaimable.toFixed(2), '×1 (n0 b0nus)')}
      ${statBlock('$CRWN CLA!MABLE', crwnClaimable.toFixed(2), `×${crwnTotalMult} (×${BOTH_MULTIPLIER} b0th · ×${crownTier.multiplier} cr0wn)`)}
    </div>
    <button class="claim-btn" id="claimHoney">CLA!M $H0NEY</button>
    <button class="claim-btn" id="claimCrwn">CLA!M $CRWN</button>
    <div class="claim-status" id="claimStatus"></div>
    <p class="note">Rates: ${HONEY_PER_DAY} $HONEY/day, ${CRWN_PER_DAY} $CRWN/day ×${BOTH_MULTIPLIER} (both-signature bonus, $CRWN only). Claims are logged, not yet paid out automatically.</p>
    `;
  } else if (state === 'honeypotOnly') {
    claimHoney = true;
    body = `
    <div class="eyebrow">🍯 FARMER'S MARKET</div>
    <div class="status-line">STATUS: FARMER</div>
    <h1>CLA!M SHARE 0F H0NEY F0R PR0TECT!NG VESSEL/S F0R THE CR0WN</h1>
    <p class="intro">Honeypot signature found. No King signature — $CRWN stays locked until you carry both.</p>
    <div class="stat-row">${statBlock('H0LD!NG F0R', daysHeld.toFixed(2) + ' DAYS')}</div>
    <div class="stat-row">
      ${statBlock('$HONEY CLA!MABLE', honeyClaimable.toFixed(2), '×1 (n0 b0nus)')}
      ${statBlock('$CRWN', 'L0CKED')}
    </div>
    <button class="claim-btn" id="claimHoney">CLA!M $H0NEY</button>
    <div class="claim-status" id="claimStatus"></div>
    <p class="note">Rate: ${HONEY_PER_DAY} $HONEY/day held. Acquire a King NFT to unlock $CRWN too.</p>
    `;
  } else if (state === 'kingOnly') {
    claimCrwn = true;
    body = `
    <div class="eyebrow">👑 THR0NE R00M</div>
    <div class="status-line">STATUS: ${kingStatus}</div>
    <h1>EARN C0!NS F0R THE CT0 (CR0WN TAKE 0VER)</h1>
    <p class="intro">King signature found. No Honeypot signature — $HONEY stays locked until you carry both.</p>
    ${crownLine}
    <div class="stat-row">${statBlock('H0LD!NG F0R', daysHeld.toFixed(2) + ' DAYS')}</div>
    <div class="stat-row">
      ${statBlock('$CRWN CLA!MABLE', crwnClaimable.toFixed(2), `×${crownTier.multiplier} (cr0wn)`)}
      ${statBlock('$HONEY', 'L0CKED')}
    </div>
    <button class="claim-btn" id="claimCrwn">CLA!M $CRWN</button>
    <div class="claim-status" id="claimStatus"></div>
    <p class="note">Rate: ${CRWN_PER_DAY} $CRWN/day held. Acquire a Honeypot NFT to unlock $HONEY too.</p>
    `;
  } else {
    body = `
    <div class="eyebrow">THR0NE R00M</div>
    <h1>ACCESS DEN!ED</h1>
    <p class="intro">Reason: ${denyReason}</p>
    `;
  }

  const claimScript = (claimHoney || claimCrwn) ? `<script>
  const status = document.getElementById('claimStatus');
  async function claim(kind, btn){
    btn.disabled = true;
    status.textContent = 'SUBMITTING CLA!M...';
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind })
      });
      const data = await res.json();
      if (data.ok) {
        status.textContent = kind.toUpperCase() + ' CLA!M L0GGED :: THE K!NG HAS NOTED YOUR PRESENCE';
      } else {
        status.textContent = 'ERR://CLA!M REJECTED';
        btn.disabled = false;
      }
    } catch (e) {
      status.textContent = 'ERR://SIGNAL_LOST';
      btn.disabled = false;
    }
  }
  ${claimHoney ? "document.getElementById('claimHoney').addEventListener('click', (e) => claim('honey', e.target));" : ''}
  ${claimCrwn ? "document.getElementById('claimCrwn').addEventListener('click', (e) => claim('crwn', e.target));" : ''}
</script>` : '';

  const titles = {
    both: 'Y0U ARE A K!NG',
    honeypotOnly: 'H0NEYP0T DETECTED',
    kingOnly: 'K!NG S!GNATURE DETECTED',
    denied: 'ACCESS DEN!ED'
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titles[state]}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#08080a; }
  body{
    font-family:'Chakra Petch',sans-serif;
    color:#e8e8e8;
    display:flex;
    justify-content:center;
    padding:10vh 6vw;
    text-align:center;
  }
  .page{ max-width:520px; width:100%; }
  .eyebrow{
    font-size:12px;
    letter-spacing:0.35em;
    color:#39ff14;
    text-transform:uppercase;
    opacity:0.8;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
    margin-bottom:0.75rem;
  }
  h1{
    font-size:clamp(20px,3.6vw,32px);
    letter-spacing:0.06em;
    color:#fff;
    text-shadow:0 0 10px rgba(57,255,20,0.25);
    margin-bottom:1.5rem;
    line-height:1.3;
  }
  .intro{
    font-size:14px;
    line-height:1.7;
    color:rgba(232,232,232,0.75);
    font-style:italic;
    margin-bottom:1.25rem;
  }
  .crown-status{
    text-align:left;
    max-width:320px;
    margin:0 auto 2rem;
    border:1px solid rgba(255,176,0,0.25);
    padding:1rem 1.25rem;
  }
  .crown-status-label{
    font-size:11px;
    letter-spacing:0.15em;
    color:rgba(255,176,0,0.7);
    margin-bottom:0.6rem;
  }
  .crown-row{
    display:flex;
    justify-content:space-between;
    font-size:12px;
    letter-spacing:0.03em;
    color:rgba(232,232,232,0.4);
    padding:0.15rem 0;
  }
  .crown-row.achieved{
    color:#ffb000;
    text-shadow:0 0 6px rgba(255,176,0,0.5);
    font-weight:700;
  }
  .status-line{
    font-size:13px;
    letter-spacing:0.2em;
    color:#ffb000;
    text-shadow:0 0 6px rgba(255,176,0,0.5);
    margin-bottom:1rem;
  }
  .stat-row{
    display:flex;
    gap:1.5rem;
    justify-content:center;
    margin-bottom:1.5rem;
  }
  .stat{
    border:1px solid rgba(57,255,20,0.3);
    padding:1rem 1.4rem;
    flex:1;
  }
  .stat-label{
    font-size:11px;
    letter-spacing:0.15em;
    color:rgba(232,232,232,0.55);
    margin-bottom:0.5rem;
  }
  .stat-value{
    font-size:20px;
    color:#39ff14;
    text-shadow:0 0 8px rgba(57,255,20,0.5);
  }
  .stat-sub{
    margin-top:0.35rem;
    font-size:10px;
    letter-spacing:0.05em;
    color:rgba(255,176,0,0.7);
  }
  .claim-btn{
    background:transparent;
    border:1px solid rgba(57,255,20,0.6);
    color:#39ff14;
    font-family:inherit;
    font-size:13px;
    letter-spacing:0.12em;
    padding:0.8em 1.4em;
    cursor:pointer;
    text-transform:uppercase;
    text-shadow:0 0 6px rgba(57,255,20,0.6);
    margin:0.5rem 0.4rem 0;
  }
  .claim-btn:hover{ background:rgba(57,255,20,0.12); }
  .claim-btn:disabled{ opacity:0.5; cursor:default; }
  .claim-status{
    margin-top:1rem;
    font-size:13px;
    min-height:1.4em;
    color:#39ff14;
  }
  .note{
    margin-top:2rem;
    font-size:11px;
    letter-spacing:0.05em;
    color:rgba(232,232,232,0.4);
  }
</style>
</head>
<body>
  <div class="page">
    ${body}
  </div>
${claimScript}
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
    return new Response('server misconfigured', { status: 500 });
  }

  const token = getCookie(request, COOKIE_NAME);
  if (!token) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }

  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }

  const nfts = await fetchAllAccountNfts(payload.acct);
  if (!hasAccessKey(nfts)) {
    return Response.redirect(new URL('/', request.url).toString(), 302);
  }

  const kingNft = findKingNft(nfts);
  const honeypot = findHoneypot(nfts);

  if (!kingNft && !honeypot) {
    return new Response(
      renderPage({ state: 'denied', denyReason: 'R0YAL S!GNATURE M!SS!NG' }),
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (kingNft && honeypot) {
    const allKingNfts = findAllKingNfts(nfts);
    const crownTier = await getBestCrownTier(env.coin, allKingNfts);
    const firstSeen = await getOrStartTimer(env.coin, `${payload.acct}:verified`);
    const daysHeld = Math.max(0, (Date.now() / 1000 - firstSeen) / 86400);
    const honeyClaimable = daysHeld * HONEY_PER_DAY;
    const crwnClaimable = daysHeld * CRWN_PER_DAY * BOTH_MULTIPLIER * crownTier.multiplier;
    return new Response(
      renderPage({ state: 'both', daysHeld, crwnClaimable, honeyClaimable, crownTier }),
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  if (honeypot) {
    const firstSeen = await getOrStartTimer(env.coin, `${payload.acct}:honeypot`);
    const daysHeld = Math.max(0, (Date.now() / 1000 - firstSeen) / 86400);
    const honeyClaimable = daysHeld * HONEY_PER_DAY;
    return new Response(
      renderPage({ state: 'honeypotOnly', daysHeld, honeyClaimable }),
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  // kingNft only
  const allKingNfts = findAllKingNfts(nfts);
  const crownTier = await getBestCrownTier(env.coin, allKingNfts);
  const firstSeen = await getOrStartTimer(env.coin, `${payload.acct}:king`);
  const daysHeld = Math.max(0, (Date.now() / 1000 - firstSeen) / 86400);
  const crwnClaimable = daysHeld * CRWN_PER_DAY * crownTier.multiplier;
  return new Response(
    renderPage({ state: 'kingOnly', daysHeld, crwnClaimable, crownTier }),
    { headers: { 'Content-Type': 'text/html' } }
  );
}
