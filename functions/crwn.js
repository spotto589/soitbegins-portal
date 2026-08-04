import {
  COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, hasAccessKey, findKingNft
} from './_shared.js';

const CRWN_PER_DAY = 1; // placeholder rate — adjust to the real $CRWN emission rate

// XRPL has no fast way to look up "when did this wallet acquire this NFT" —
// the only method is scanning tx history, which is too slow for a live page
// (tested: 35s+ and still inconclusive on an active wallet). Instead we track
// our own "first seen holding it" timestamp in KV, keyed per wallet+NFT, and
// count from there. Returning visitors keep accumulating; the clock doesn't
// retroactively credit time held before their first visit here.
async function getOrStartTimer(kv, account, nftokenId) {
  const key = `${account}:${nftokenId}`;
  let firstSeen = await kv.get(key);
  if (!firstSeen) {
    firstSeen = String(Math.floor(Date.now() / 1000));
    await kv.put(key, firstSeen);
  }
  return parseInt(firstSeen, 10);
}

function renderPage({ granted, daysHeld, claimable, denyReason }) {
  const body = granted
    ? `
    <div class="eyebrow">THR0NE R00M</div>
    <h1>SPEAK TO THE K!NG</h1>
    <p class="intro">Time is the only tribute I actually count.</p>

    <div class="stat-row">
      <div class="stat">
        <div class="stat-label">TRACKED S!NCE F!RST AUD!ENCE</div>
        <div class="stat-value">${daysHeld.toFixed(2)} DAYS</div>
      </div>
      <div class="stat">
        <div class="stat-label">$CRWN CLA!MABLE</div>
        <div class="stat-value">${claimable.toFixed(2)}</div>
      </div>
    </div>

    <button class="claim-btn" id="claimBtn">CLA!M $CRWN</button>
    <div class="claim-status" id="claimStatus"></div>
    <p class="note">Rate: ${CRWN_PER_DAY} $CRWN / day held. Claims are logged, not yet paid out automatically.</p>
    `
    : `
    <div class="eyebrow">THR0NE R00M</div>
    <h1>N0 AUD!ENCE GRANTED</h1>
    <p class="intro">${denyReason}</p>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SPEAK TO THE K!NG</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#08080a; }
  body{
    font-family:'JetBrains Mono','Courier New',monospace;
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
    font-size:clamp(22px,4vw,36px);
    letter-spacing:0.08em;
    color:#fff;
    text-shadow:0 0 10px rgba(57,255,20,0.25);
    margin-bottom:1.5rem;
  }
  .intro{
    font-size:14px;
    line-height:1.7;
    color:rgba(232,232,232,0.75);
    font-style:italic;
    margin-bottom:2.5rem;
  }
  .stat-row{
    display:flex;
    gap:1.5rem;
    justify-content:center;
    margin-bottom:2.5rem;
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
  .claim-btn{
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
${granted ? `<script>
  const btn = document.getElementById('claimBtn');
  const status = document.getElementById('claimStatus');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    status.textContent = 'SUBMITTING CLA!M...';
    try {
      const res = await fetch('/api/claim', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        status.textContent = 'CLA!M L0GGED :: THE K!NG HAS NOTED YOUR PRESENCE';
      } else {
        status.textContent = 'ERR://CLA!M REJECTED';
        btn.disabled = false;
      }
    } catch (e) {
      status.textContent = 'ERR://SIGNAL_LOST';
      btn.disabled = false;
    }
  });
</script>` : ''}
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.COIN) {
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
  if (!kingNft) {
    return new Response(
      renderPage({ granted: false, denyReason: 'N0 K!NG NFT DETECTED ON THIS WALLET' }),
      { headers: { 'Content-Type': 'text/html' } }
    );
  }

  const firstSeen = await getOrStartTimer(env.COIN, payload.acct, kingNft.NFTokenID);
  const daysHeld = Math.max(0, (Date.now() / 1000 - firstSeen) / 86400);
  const claimable = daysHeld * CRWN_PER_DAY;

  return new Response(
    renderPage({ granted: true, daysHeld, claimable }),
    { headers: { 'Content-Type': 'text/html' } }
  );
}
