function renderBeginHtml(addr) {
  const safeAddr = addr ? addr.replace(/[^a-zA-Z0-9]/g, '') : 'UNKN0WN';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>THE 0UTSK!RTS</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ min-height:100%; background:#0a0a0a; }
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
    letter-spacing:0.3em;
    color:#9a9a9a;
    text-transform:uppercase;
    opacity:0.85;
    text-shadow:0 0 6px rgba(154,154,154,0.4);
    margin-bottom:0.75rem;
  }
  h1{
    font-size:clamp(22px,4vw,34px);
    letter-spacing:0.08em;
    color:#fff;
    text-shadow:0 0 10px rgba(154,154,154,0.25);
    margin-bottom:1.5rem;
  }
  .status-line{
    font-size:13px;
    letter-spacing:0.2em;
    color:#9a9a9a;
    text-shadow:0 0 6px rgba(154,154,154,0.4);
    margin-bottom:1.25rem;
  }
  .addr{
    font-size:13px;
    letter-spacing:0.05em;
    color:rgba(154,154,154,0.9);
    word-break:break-all;
    border:1px solid rgba(154,154,154,0.3);
    padding:0.9em 1.2em;
    margin-bottom:2.5rem;
  }
  .intro{
    font-size:14px;
    line-height:1.7;
    color:rgba(232,232,232,0.7);
    margin-bottom:2.5rem;
  }
  .cta{
    display:block;
    border:1px solid rgba(57,255,20,0.5);
    color:#39ff14;
    text-decoration:none;
    padding:1.1em 1.4em;
    margin-bottom:1.25rem;
    letter-spacing:0.12em;
    text-transform:uppercase;
    font-size:14px;
    text-shadow:0 0 6px rgba(57,255,20,0.5);
    transition:background 0.15s ease;
  }
  .cta:hover{ background:rgba(57,255,20,0.1); }
  .cta.honey{
    border-color:rgba(255,176,0,0.55);
    color:#ffb000;
    text-shadow:0 0 6px rgba(255,176,0,0.5);
  }
  .cta.honey:hover{ background:rgba(255,176,0,0.1); }
  .cta .sub{
    display:block;
    margin-top:0.4em;
    font-size:11px;
    letter-spacing:0.05em;
    color:rgba(232,232,232,0.5);
    text-transform:none;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="eyebrow">THE 0UTSK!RTS</div>
    <div class="status-line">STATUS: UNCLA!MED</div>
    <h1>C0NNECT!0N ACCEPTED</h1>
    <div class="addr">${safeAddr}</div>
    <p class="intro">No signatures found on this wallet yet. Nothing lives here — but nothing is not nowhere. Choose a district to belong to.</p>

    <a class="cta" href="https://xrp.cafe/collection/KING" target="_blank" rel="noopener">
      👑 BECOME A K!NG.
      <span class="sub">Acquire a King NFT → THR0NE R00M</span>
    </a>

    <a class="cta honey" href="https://xrp.cafe/collection/soitbegins" target="_blank" rel="noopener">
      🍯 HARVEST H0NEY F0R THE CRWN
      <span class="sub">Acquire a Honeypot NFT → FARMER'S MARKET</span>
    </a>
  </div>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { request } = context;
  const addr = new URL(request.url).searchParams.get('addr');
  return new Response(renderBeginHtml(addr), { headers: { 'Content-Type': 'text/html' } });
}
