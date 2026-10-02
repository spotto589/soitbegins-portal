// ─────────────────────────────────────────────────────────────────────────
// STAT!C://H0ME — soitbegins.xyz/home, the front page.
//
// The whole XRPL at a glance (every NFT collection and meme coin, not just
// the site's own — see functions/api/home.js for where each number comes
// from), the site's own collections with their real art and stats, the
// top 10 NFT collections and meme coins, and a live feed of the site's
// own collections off the ledger watcher.
//
// Its own page, deliberately: DATABASE (functions/static.js) is untouched
// and every card/row here just links into it. Same look as DATABASE
// (static canvas, scanlines, sharp panels, Chakra Petch, the MAINFRAME
// card treatment) so moving between the two reads as one site.
//
// Real data only. A number that can't be loaded shows a dash, never a
// placeholder figure.
// ─────────────────────────────────────────────────────────────────────────

const HOME_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>Σκύλλα :: STAT!C://H0ME</title>
<meta name="description" content="Every NFT collection and meme coin on the XRP Ledger in one place: live volume, sales, mints, burns, top 10s and more.">
<meta property="og:title" content="Σκύλλα :: STAT!C://H0ME">
<meta property="og:site_name" content="Σκύλλα">
<meta property="og:description" content="Every NFT collection and meme coin on the XRP Ledger in one place.">
<meta property="og:image" content="https://soitbegins.xyz/assets/icons/icon-512.png">
<link rel="icon" href="/assets/icons/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Σκύλλα">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<link rel="preload" href="/assets/fonts/chakra-petch.woff2" as="font" type="font/woff2" crossorigin>
<style>
  /* Same self-hosted faces as DATABASE (static.js): Chakra Petch for
     everything, Jura for the Greek in Σκύλλα. */
  @font-face{ font-family:'Chakra Petch'; src:url('/assets/fonts/chakra-petch.woff2') format('woff2'); font-weight:400 800; font-style:normal; font-display:swap; }
  @font-face{ font-family:'Jura'; src:url('/assets/fonts/jura-700-greek.woff2') format('woff2'); unicode-range:U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF; font-weight:700; font-style:normal; font-display:swap; }
  /* Same palette/type as DATABASE (static.js :root) — kept to the tokens
     this page actually uses. */
  :root{
    --bg:#0b0b09;
    --panel-bg-solid:#100f0c;
    --panel-hi:#16150f;
    --border-dim:rgba(230,225,211,0.1);
    --border-mid:rgba(230,225,211,0.2);
    --cyan:#3df3ec;
    --cyan-dim:rgba(61,243,236,0.28);
    --cyan-faint:rgba(61,243,236,0.1);
    --cyan-glow:rgba(61,243,236,0.4);
    --magenta:#ff33cc;
    --magenta-dim:rgba(255,51,204,0.4);
    --magenta-faint:rgba(255,51,204,0.12);
    --magenta-glow:rgba(255,51,204,0.4);
    --green:#34ff85;
    --green-glow:rgba(52,255,133,0.45);
    --red:#e8384f;
    --yellow:#f5c518;
    --white:#e6e1d3;
    --grey:rgba(230,225,211,0.56);
    --grey-dim:rgba(230,225,211,0.34);
    --font:'Chakra Petch','Jura','JetBrains Mono',ui-monospace,'SF Mono',Consolas,monospace;
    --bar-h:62px;
    color-scheme:dark;
  }
  *{ box-sizing:border-box; }
  html, body{ margin:0; min-height:100%; background:var(--bg); overflow-x:hidden; }
  body{ font-family:var(--font); color:var(--white); font-size:15px; line-height:1.45; }
  a{ color:inherit; }
  button, input{ font-family:inherit; }
  :focus-visible{ outline:2px solid var(--cyan); outline-offset:2px; }
  .num{ font-variant-numeric:tabular-nums; }
  .green{ color:var(--green); text-shadow:0 0 6px var(--green-glow); }
  .up{ color:var(--green); }
  .down{ color:var(--red); }
  .flat{ color:var(--grey-dim); }

  /* The page's own static + scanlines (DATABASE's canvas#staticBg recipe). */
  canvas#staticBg{ position:fixed; inset:0; width:100%; height:100%; z-index:0; opacity:0.2; filter:brightness(0.7) contrast(1.3); mix-blend-mode:screen; pointer-events:none; }
  body::before{ content:''; position:fixed; inset:0; z-index:0; pointer-events:none; background:repeating-linear-gradient(to bottom, rgba(255,255,255,0.018) 0px, rgba(255,255,255,0.018) 1px, transparent 1px, transparent 3px); mix-blend-mode:overlay; }

  /* ---- top bar ---- */
  #topBar{ position:fixed; top:0; left:0; right:0; z-index:50; background:var(--bg); border-bottom:1px solid var(--border-mid); padding-top:env(safe-area-inset-top, 0px); }
  #topBar .row{ display:flex; align-items:stretch; max-width:1400px; margin:0 auto; padding-inline:16px; min-height:var(--bar-h); gap:4px; }
  .top-link{ display:flex; align-items:center; gap:0.35em; white-space:nowrap; text-decoration:none; font-weight:700; letter-spacing:0.06em; font-size:clamp(14px, 1.7vw, 22px); color:var(--grey-dim); padding:0 0.7em; border-bottom:2px solid transparent; transition:color 0.15s; }
  .top-link:hover{ color:var(--grey); }
  .top-link.active{ color:var(--white); border-bottom-color:var(--cyan); }
  .top-link.active .accent{ color:var(--cyan); text-shadow:0 0 8px var(--cyan-glow); }
  .top-link .dim{ color:var(--grey-dim); }
  .top-spacer{ flex:1; }
  .login-btn{ align-self:center; white-space:nowrap; text-decoration:none; font-weight:700; font-size:13px; letter-spacing:0.14em; color:var(--magenta); border:1px solid var(--magenta); padding:0.5em 1em; text-shadow:0 0 6px var(--magenta-glow); }
  .login-btn:hover{ background:var(--magenta-faint); }
  .top-scroll{ display:flex; overflow-x:auto; scrollbar-width:none; min-width:0; }
  .top-scroll::-webkit-scrollbar{ display:none; }
  @media (max-width:640px){ .login-btn{ display:none; } .top-link{ padding:0 0.55em; } }

  .page{ position:relative; z-index:1; max-width:1400px; margin:0 auto; padding:calc(var(--bar-h) + env(safe-area-inset-top, 0px) + 28px) 16px 64px; }

  /* ---- masthead ---- */
  .mast{ display:grid; grid-template-columns:minmax(0,1fr) auto; gap:20px 36px; align-items:end; }
  .eyebrow{ margin:0 0 10px; font-size:12px; font-weight:600; letter-spacing:0.22em; color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); }
  .mast h1{ margin:0; font-size:clamp(28px, 4.4vw, 52px); line-height:1.02; font-weight:700; letter-spacing:0.03em; text-wrap:balance; max-width:18ch; text-shadow:-1px 0 var(--cyan-dim), 1px 0 var(--magenta-dim); }
  .mast p{ margin:12px 0 0; color:var(--grey); max-width:60ch; letter-spacing:0.02em; }
  .ledger-box{ border:1px solid var(--border-mid); background:var(--panel-bg-solid); padding:14px 18px; min-width:260px; display:flex; flex-direction:column; gap:3px; }
  .ledger-box .k{ font-size:11px; letter-spacing:0.18em; font-weight:600; color:var(--grey-dim); display:flex; align-items:center; gap:8px; }
  .live-dot{ width:7px; height:7px; border-radius:50%; background:var(--grey-dim); flex:none; }
  .live-dot.on{ background:var(--green); box-shadow:0 0 8px var(--green); }
  .ledger-box .idx{ font-size:28px; font-weight:700; letter-spacing:0.03em; transition:color 0.6s; }
  .ledger-box.tick .idx{ color:var(--green); }
  .ledger-box .meta{ font-size:12px; color:var(--grey); }
  @media (max-width:760px){ .mast{ grid-template-columns:1fr; } .ledger-box{ min-width:0; } }

  /* ---- search ---- */
  .search{ display:flex; margin-top:24px; border:1px solid var(--border-mid); background:var(--panel-bg-solid); }
  .search:focus-within{ border-color:var(--cyan); box-shadow:0 0 0 3px var(--cyan-faint); }
  .search label{ display:grid; place-items:center; padding-inline:16px; color:var(--cyan); font-size:13px; font-weight:700; letter-spacing:0.14em; border-right:1px solid var(--border-dim); white-space:nowrap; }
  .search input{ flex:1; min-width:0; background:none; border:0; color:var(--white); font-size:15px; padding:14px 16px; letter-spacing:0.02em; }
  .search input::placeholder{ color:var(--grey-dim); }
  .search input:focus{ outline:none; }
  .search button{ background:var(--cyan-faint); color:var(--cyan); border:0; border-left:1px solid var(--cyan); padding:0 22px; font-weight:700; letter-spacing:0.14em; font-size:13px; cursor:pointer; text-shadow:0 0 6px var(--cyan-glow); }
  .search button:hover{ background:var(--cyan-dim); }
  .search-msg{ min-height:1.4em; margin-top:8px; font-size:12.5px; color:var(--grey); letter-spacing:0.04em; }
  @media (max-width:560px){ .search label{ display:none; } .search button{ padding:0 14px; } }

  /* ---- section heads ---- */
  .sec-head{ display:flex; justify-content:space-between; align-items:flex-end; gap:12px 20px; flex-wrap:wrap; margin:40px 0 14px; }
  .sec-head h2{ margin:0; font-size:clamp(18px, 2vw, 24px); font-weight:700; letter-spacing:0.14em; color:#fff; }
  .sec-head p{ margin:4px 0 0; color:var(--grey); font-size:13.5px; letter-spacing:0.02em; }
  .src{ font-size:12px; color:var(--grey-dim); letter-spacing:0.06em; }
  .src a{ color:var(--grey); }

  /* ---- segmented switches ---- */
  .seg{ display:inline-flex; border:1px solid var(--border-mid); flex-wrap:wrap; }
  .seg button{ background:none; border:0; color:var(--grey); padding:7px 12px; font-size:12.5px; font-weight:700; letter-spacing:0.1em; cursor:pointer; }
  .seg button + button{ border-left:1px solid var(--border-mid); }
  .seg button:hover{ color:var(--white); background:rgba(230,225,211,0.04); }
  .seg button[aria-pressed="true"]{ background:var(--cyan-faint); color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); }
  .seg.pink button[aria-pressed="true"]{ background:var(--magenta-faint); color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); }

  /* ---- panels ---- */
  .panel{ border:1px solid var(--border-mid); background:var(--panel-bg-solid); min-width:0; display:flex; flex-direction:column; }
  .panel-head{ display:flex; justify-content:space-between; align-items:center; gap:10px 14px; flex-wrap:wrap; padding:14px 18px; border-bottom:1px solid var(--border-dim); }
  .panel-head h3{ margin:0; font-size:15px; font-weight:700; letter-spacing:0.16em; display:flex; align-items:center; gap:10px; color:#fff; }
  .panel-head h3 .sq{ width:9px; height:9px; flex:none; }
  .panel-head .note{ font-size:11.5px; color:var(--grey-dim); letter-spacing:0.08em; }
  .panel-foot{ margin-top:auto; padding:10px 18px; border-top:1px solid var(--border-dim); display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; font-size:12px; color:var(--grey-dim); letter-spacing:0.04em; }
  .outline-btn{ text-decoration:none; background:none; border:1px solid var(--border-mid); color:var(--white); padding:7px 12px; font-size:12px; font-weight:700; letter-spacing:0.12em; cursor:pointer; white-space:nowrap; }
  .outline-btn:hover{ border-color:var(--cyan); color:var(--cyan); }

  /* ---- glance ---- */
  .glance{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:18px; }
  @media (max-width:1100px){ .glance{ grid-template-columns:minmax(0,1fr) minmax(0,1fr); } .glance .ledger-panel{ grid-column:1 / -1; } }
  @media (max-width:760px){ .glance{ grid-template-columns:1fr; } }
  .hero-stat{ padding:18px 18px 14px; display:flex; flex-direction:column; gap:2px; }
  .hero-stat .k{ font-size:12px; letter-spacing:0.14em; font-weight:600; color:var(--grey); }
  .hero-stat .v{ font-size:clamp(30px, 3.2vw, 42px); font-weight:700; line-height:1.1; letter-spacing:0.02em; }
  .hero-stat .v small{ font-size:0.42em; color:var(--grey); margin-left:6px; letter-spacing:0.1em; }
  .hero-stat .chg{ font-size:13px; letter-spacing:0.04em; }
  .fields{ display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); border-top:1px solid var(--border-dim); }
  .field{ padding:11px 16px 12px; border-bottom:1px solid var(--border-dim); display:flex; flex-direction:column; gap:1px; min-width:0; }
  .field:nth-child(odd){ border-right:1px solid var(--border-dim); }
  .field .v{ font-size:19px; font-weight:700; letter-spacing:0.02em; }
  .field .d{ font-size:12px; color:var(--grey); line-height:1.3; letter-spacing:0.02em; }
  .share{ padding:14px 18px 16px; margin-top:auto; }
  .share .k{ font-size:11px; letter-spacing:0.14em; color:var(--grey); font-weight:600; margin-bottom:8px; }
  .share-bar{ display:flex; height:12px; gap:2px; background:rgba(230,225,211,0.05); }
  .share-bar span{ display:block; min-width:3px; }
  .share-legend{ display:flex; flex-wrap:wrap; gap:6px 14px; margin-top:9px; font-size:12px; color:var(--grey); }
  .share-legend b{ font-weight:600; color:var(--white); margin-left:4px; }
  .share-legend i{ display:inline-block; width:8px; height:8px; margin-right:6px; }
  .ledger-list{ display:flex; flex-direction:column; }
  .ledger-list .row{ display:flex; justify-content:space-between; align-items:baseline; gap:12px; padding:11px 18px; border-bottom:1px solid var(--border-dim); }
  .ledger-list .row:last-child{ border-bottom:0; }
  .ledger-list .row span{ color:var(--grey); font-size:13px; letter-spacing:0.03em; }
  .ledger-list .row b{ font-size:16px; font-weight:700; letter-spacing:0.02em; text-align:right; }

  /* ---- our collections (DATABASE's MAINFRAME card treatment) ---- */
  .cards{ display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:14px; }
  @media (max-width:520px){ .cards{ grid-template-columns:repeat(2, minmax(0,1fr)); gap:10px; } }
  .card{ position:relative; display:flex; flex-direction:column; background:var(--panel-bg-solid); border:1px solid var(--border-mid); overflow:hidden; text-align:center; text-decoration:none; color:inherit; transition:border-color 0.2s, transform 0.2s, box-shadow 0.2s; }
  a.card:hover{ border-color:rgba(var(--card-accent), 0.8); transform:translateY(-4px); box-shadow:0 12px 32px rgba(0,0,0,0.5), 0 0 24px rgba(var(--card-accent), 0.35); }
  .card-art{ position:relative; aspect-ratio:16 / 10; background-size:cover; background-position:center var(--art-y, 40%); background-color:rgba(var(--card-accent), 0.14); background-image:linear-gradient(180deg, rgba(var(--card-accent),0.08) 0%, rgba(6,6,7,0.92) 100%), var(--card-art); border-bottom:1px solid rgba(var(--card-accent), 0.35); overflow:hidden; }
  .card-soon .card-art{ filter:grayscale(0.55) brightness(0.8); }
  .soon-tape{ position:absolute; top:50%; left:-10%; width:120%; transform:translateY(-50%) rotate(-8deg); background:repeating-linear-gradient(45deg, #1a1a1a, #1a1a1a 12px, #f5c518 12px, #f5c518 24px); border-top:2px solid #0a0a0a; border-bottom:2px solid #0a0a0a; height:24px; }
  .card-body{ padding:10px 12px 12px; display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; }
  .card-label{ font-size:clamp(17px, 1.6vw, 22px); font-weight:700; color:#fff; letter-spacing:0.06em; line-height:1.2; text-shadow:0 0 14px rgba(var(--card-accent), 0.65); }
  .card-soon .card-label{ color:var(--grey); text-shadow:none; }
  .pill{ display:inline-block; font-size:10px; font-weight:600; letter-spacing:0.14em; padding:0.3em 0.8em; }
  .pill.live{ color:var(--green); border:1px solid rgba(52,255,133,0.4); background:rgba(52,255,133,0.08); }
  .pill.soon{ color:var(--yellow); border:1px solid rgba(245,197,24,0.45); background:rgba(245,197,24,0.08); }
  .card-stats{ width:100%; display:grid; grid-template-columns:1fr 1fr; gap:4px 8px; margin-top:4px; font-size:11px; letter-spacing:0.06em; color:var(--grey); text-align:left; }
  .card-stats div{ display:flex; flex-direction:column; min-width:0; }
  .card-stats b{ color:#fff; font-size:14px; font-weight:700; letter-spacing:0.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .card-cta{ margin-top:auto; width:100%; padding:0.5em; font-size:12px; font-weight:700; letter-spacing:0.08em; color:rgb(var(--card-accent)); border:1px solid rgb(var(--card-accent)); background:rgba(var(--card-accent), 0.12); text-shadow:0 0 6px rgba(var(--card-accent), 0.5); }
  .card-soon .card-cta{ color:var(--grey-dim); border-color:var(--border-mid); background:none; text-shadow:none; }

  /* ---- top 10 + feed ---- */
  .lower{ display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:18px; align-items:start; }
  .feed-panel{ grid-column:1 / -1; }
  @media (max-width:980px){ .lower{ grid-template-columns:1fr; } }
  .table-wrap{ overflow-x:auto; }
  table.rank{ width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; }
  table.rank th{ text-align:right; font-size:10.5px; letter-spacing:0.16em; font-weight:600; color:var(--grey-dim); padding:9px 10px; border-bottom:1px solid var(--border-dim); white-space:nowrap; }
  table.rank th:nth-child(-n+2){ text-align:left; }
  table.rank td{ padding:8px 10px; border-bottom:1px solid var(--border-dim); text-align:right; font-size:13.5px; white-space:nowrap; }
  table.rank tr:last-child td{ border-bottom:0; }
  table.rank tbody tr{ cursor:pointer; transition:background 0.12s; }
  table.rank tbody tr:hover, table.rank tbody tr:focus-visible{ background:var(--panel-hi); outline:none; }
  table.rank .rk{ text-align:left; color:var(--grey-dim); width:28px; font-weight:600; }
  table.rank .rk.top{ color:#fff; }
  table.rank .nm{ text-align:left; max-width:220px; }
  .nm-inner{ display:flex; align-items:center; gap:10px; min-width:0; }
  .thumb{ width:34px; height:34px; flex:none; background:rgba(230,225,211,0.06) center / cover no-repeat; border:1px solid var(--border-dim); display:grid; place-items:center; font-size:11px; font-weight:700; color:var(--grey); overflow:hidden; }
  .thumb.round{ border-radius:50%; }
  .thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
  .nm-text{ display:flex; flex-direction:column; min-width:0; }
  .nm-text strong{ font-size:14px; font-weight:700; letter-spacing:0.03em; overflow:hidden; text-overflow:ellipsis; }
  .nm-text span{ font-size:11px; color:var(--grey-dim); letter-spacing:0.06em; }
  .ours-tag{ color:var(--cyan) !important; }
  .empty{ padding:26px 18px; text-align:center; color:var(--grey); font-size:13px; letter-spacing:0.04em; }
  @media (max-width:560px){ table.rank .hide-sm{ display:none; } table.rank td, table.rank th{ padding:8px 6px; } table.rank .nm{ max-width:150px; } }

  .feed{ list-style:none; margin:0; padding:0; max-height:460px; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); align-content:start; }
  @media (max-width:520px){ .feed{ grid-template-columns:1fr; } }
  .feed li{ display:grid; grid-template-columns:34px minmax(0,1fr) auto; gap:10px; align-items:center; padding:9px 14px; border-bottom:1px solid var(--border-dim); font-size:13px; }
  .feed li a{ text-decoration:none; }
  .feed li.new{ animation:flash 1.6s ease-out; }
  @keyframes flash{ from{ background:rgba(61,243,236,0.1); } to{ background:transparent; } }
  .feed .what{ min-width:0; display:flex; flex-direction:column; }
  .feed .what strong{ font-weight:700; letter-spacing:0.03em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .feed .what span{ font-size:12px; color:var(--grey); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .feed .when{ font-size:11px; color:var(--grey-dim); text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:3px; }
  .ev{ font-size:10px; font-weight:700; letter-spacing:0.1em; padding:1px 6px; border:1px solid currentColor; }
  .ev.sale{ color:var(--green); }
  .ev.listing{ color:var(--cyan); }
  .ev.mint{ color:var(--magenta); }
  .ev.burn{ color:var(--red); }
  .ev.offer{ color:var(--yellow); }

  .attrib{ margin-top:36px; font-size:12px; color:var(--grey-dim); letter-spacing:0.04em; display:flex; flex-wrap:wrap; gap:6px 18px; }
  .attrib a{ color:var(--grey); }

  @media (prefers-reduced-motion:reduce){ *{ transition:none !important; animation:none !important; } }
</style>
</head>
<body>
<canvas id="staticBg" aria-hidden="true"></canvas>

<header id="topBar">
  <div class="row">
    <nav class="top-scroll" aria-label="Main">
      <a class="top-link active" href="/home" aria-current="page">STAT!C://<span class="accent">H0ME</span></a>
      <a class="top-link" href="/static">DATABASE</a>
      <a class="top-link" href="/static?static=coins">C0!NS</a>
    </nav>
    <div class="top-spacer"></div>
    <a class="login-btn" href="/static">Σκύλλα://L0G !N</a>
  </div>
</header>

<main class="page">
  <section class="mast">
    <div>
      <p class="eyebrow">STAT!C://XRPL :: NFTS + MEME C0!NS</p>
      <h1>EVERY NFT AND MEME C0!N ON THE XRPL, !N 0NE PLACE.</h1>
      <p>Live numbers for the whole XRP Ledger: what's being traded, minted, burned and launched. Tap any collection or coin to open it.</p>
    </div>
    <div class="ledger-box" id="ledgerBox">
      <span class="k"><span class="live-dot" id="ledgerDot"></span>LATEST XRPL LEDGER</span>
      <span class="idx num" id="ledgerIdx">—</span>
      <span class="meta num" id="ledgerMeta">connecting…</span>
    </div>
  </section>

  <form class="search" id="searchForm" role="search">
    <label for="q">SEARCH</label>
    <input id="q" type="search" placeholder="Wallet address (r…) or collection name" autocomplete="off" spellcheck="false">
    <button type="submit">G0</button>
  </form>
  <div class="search-msg" id="searchMsg" role="status" aria-live="polite"></div>

  <div class="sec-head">
    <div>
      <h2>XRPL AT A GLANCE</h2>
      <p>The whole ledger, not just our collections.</p>
    </div>
    <div class="seg" role="group" aria-label="NFT time range" id="glanceRange">
      <button type="button" data-v="24h" aria-pressed="true">24H</button><button type="button" data-v="7d" aria-pressed="false">7D</button><button type="button" data-v="30d" aria-pressed="false">30D</button><button type="button" data-v="all" aria-pressed="false">ALL</button>
    </div>
  </div>

  <section class="glance">
    <article class="panel">
      <div class="panel-head"><h3><span class="sq" style="background:var(--cyan)"></span>NFTS</h3><span class="note" id="nftNote">ALL XRPL COLLECTIONS</span></div>
      <div class="hero-stat">
        <span class="k" id="nftHeroK">NFT TRADING V0LUME · 24H</span>
        <span class="v num" id="nftHeroV">—</span>
        <span class="chg num" id="nftHeroC"></span>
      </div>
      <div class="fields" id="nftFields"></div>
      <div class="share">
        <div class="k" id="nftShareK">WHERE THE V0LUME WENT</div>
        <div class="share-bar" id="nftShare"></div>
        <div class="share-legend" id="nftLegend"></div>
      </div>
    </article>

    <article class="panel">
      <div class="panel-head"><h3><span class="sq" style="background:var(--magenta)"></span>MEME C0!NS</h3><span class="note">LAST 24H · ALL XRPL MEMES</span></div>
      <div class="hero-stat">
        <span class="k">MEME C0!N TRADING V0LUME · 24H</span>
        <span class="v num" id="memeHeroV">—</span>
        <span class="chg num" id="memeHeroC"></span>
      </div>
      <div class="fields" id="memeFields"></div>
      <div class="share">
        <div class="k">WHERE THE V0LUME WENT</div>
        <div class="share-bar" id="memeShare"></div>
        <div class="share-legend" id="memeLegend"></div>
      </div>
    </article>

    <article class="panel ledger-panel">
      <div class="panel-head"><h3><span class="sq" style="background:var(--green)"></span>THE LEDGER</h3><span class="note">LAST 24H</span></div>
      <div class="ledger-list" id="ledgerList"></div>
    </article>
  </section>

  <div class="sec-head">
    <div>
      <h2>0UR C0LLECT!0NS</h2>
      <p>Every collection with a Σκύλλα database. Tap one to open it.</p>
    </div>
    <a class="outline-btn" href="/static">0PEN DATABASE →</a>
  </div>
  <section class="cards" id="cards"></section>

  <div class="sec-head">
    <div>
      <h2>T0P 10 0N THE XRPL</h2>
      <p>Ranked across every collection and meme coin on the ledger. <span class="ours-tag">Σκύλλα</span> marks ours.</p>
    </div>
  </div>

  <section class="lower">
    <article class="panel">
      <div class="panel-head">
        <h3><span class="sq" style="background:var(--cyan)"></span>NFT C0LLECT!0NS</h3>
        <div class="seg" role="group" aria-label="NFT ranking range" id="nftRange">
          <button type="button" data-v="24h" aria-pressed="true">24H</button><button type="button" data-v="7d" aria-pressed="false">7D</button><button type="button" data-v="30d" aria-pressed="false">30D</button><button type="button" data-v="all" aria-pressed="false">ALL</button>
        </div>
      </div>
      <div class="table-wrap"><table class="rank">
        <thead><tr><th>#</th><th>C0LLECT!0N</th><th>V0LUME</th><th class="hide-sm">SALES</th><th>FL00R</th><th class="hide-sm">0WNERS</th></tr></thead>
        <tbody id="nftRows"><tr><td colspan="6" class="empty">L0AD!NG…</td></tr></tbody>
      </table></div>
      <div class="panel-foot"><span id="nftRankSub">By volume, last 24 hours · XRP</span></div>
    </article>

    <article class="panel">
      <div class="panel-head">
        <h3><span class="sq" style="background:var(--magenta)"></span>MEME C0!NS</h3>
        <div class="seg pink" role="group" aria-label="Coin ranking" id="coinRange">
          <button type="button" data-v="vol24h" aria-pressed="true">24H V0L</button><button type="button" data-v="vol7d" aria-pressed="false">7D V0L</button><button type="button" data-v="marketcap" aria-pressed="false">MARKET CAP</button>
        </div>
      </div>
      <div class="table-wrap"><table class="rank">
        <thead><tr><th>#</th><th>C0!N</th><th class="hide-sm">PR!CE</th><th id="coinChgHead">24H</th><th id="coinMainHead">V0LUME</th><th class="hide-sm">H0LDERS</th></tr></thead>
        <tbody id="coinRows"><tr><td colspan="6" class="empty">L0AD!NG…</td></tr></tbody>
      </table></div>
      <div class="panel-foot"><span id="coinRankSub">By volume, last 24 hours · XRP</span><a class="outline-btn" href="/static?static=coins">C0!NS PAGE →</a></div>
    </article>

    <aside class="panel feed-panel" aria-label="Live activity in our collections">
      <div class="panel-head"><h3><span class="live-dot" id="feedDot"></span>L!VE !N 0UR C0LLECT!0NS</h3></div>
      <ol class="feed" id="feed"><li><span></span><span class="what"><span>L0AD!NG…</span></span><span></span></li></ol>
      <div class="panel-foot"><span>Sales, listings, mints, burns and offers, straight off the ledger.</span></div>
    </aside>
  </section>

  <footer class="attrib">
    <span>XRPL-wide NFT, meme coin and ledger figures: <a href="https://xrpl.to" target="_blank" rel="noopener">Data by xrpl.to</a></span>
    <span>Our collections: Σκύλλa's own ledger watcher, Deeptide and xrp.cafe</span>
    <span id="updatedAt"></span>
  </footer>
</main>

<script>
(function(){
  'use strict';

  // ---- our collections (same set/order/art as DATABASE's MAINFRAME) ----
  // live: has a walk-in DATABASE today (MAINFRAME's own L!VE DATABASE tag).
  // stats: has a real Deeptide shop slug, so /api/pigeons?stats=1 answers.
  var CARDS = [
    { key:'pigeons', href:'/pigeons', label:'$P!GE0NS', art:'/assets/mainframe/pigeons.jpeg?v=2', accent:'136,72,248', y:'48%', live:true, stats:true },
    { key:'king', href:'/king', label:'K!NG', art:'/assets/cards/king.png', accent:'242,183,5', y:'48%', live:true, stats:true },
    { key:'panther', href:'/panther', label:'SH!TTY PANTHERS', art:'/assets/mainframe/panther.webp?v=1', accent:'255,45,155', y:'35%', live:true, stats:true },
    { key:'honeypotall', href:'/honeypot', label:'H0NEYP0T', art:'/assets/mainframe/honeypot.webp?v=1', accent:'255,176,0', y:'50%', live:true, stats:true },
    { key:'phnixs', label:'$PHN!X', art:'/assets/mainframe/phnix.jpeg?v=2', accent:'255,90,31', y:'12%', live:false, stats:true },
    { key:'teddybg', label:'$TEDDY', art:'/assets/mainframe/teddy.jpeg?v=2', accent:'166,99,46', y:'30%', live:false, stats:true },
    { key:'sealall', href:'/sealall', label:'$SEAL', art:'/assets/mainframe/seal.jpeg?v=2', accent:'45,140,168', y:'40%', live:true, stats:true },
    { key:'fuzzyall', href:'/fuzzyall', label:'$FUZZY', art:'/assets/mainframe/fuzzy.jpeg?v=2', accent:'122,66,26', y:'55%', live:true, stats:true },
    { key:'conspiracy', href:'/conspiracy', label:'$CNS', art:'/assets/mainframe/conspiracy.jpeg?v=2', accent:'240,0,228', y:'45%', live:true, stats:true },
    { key:'thirdeye', label:'$3RD EYE', art:'/assets/mainframe/thirdeye.webp?v=1', accent:'255,79,163', y:'50%', live:false, stats:false },
    { key:'bear', label:'$BEAR', art:'/assets/mainframe/bear.webp?v=3', accent:'245,197,24', y:'50%', live:false, stats:true },
    { key:'cult', label:'$CULT', art:'/assets/mainframe/cult.webp?v=1', accent:'34,197,94', y:'50%', live:false, stats:true },
    { key:'smoki', label:'$SM0K!', art:'/assets/mainframe/smoki.webp?v=1', accent:'79,209,249', y:'50%', live:false, stats:false }
  ];
  // Every collection key the server can name (top-10 matches, feed events),
  // including a group's sister collections.
  var OURS = {
    pigeons:{ label:'P!GE0NS', item:'P!GE0N', art:'/assets/mainframe/pigeons.jpeg?v=2', href:'/pigeons', token:'$P!GE0NS', issuer:'rfQVVT7X5FynwK87EczgP2T8RQXmQcQSf' },
    king:{ label:'K!NG', item:'K!NG', art:'/assets/cards/king.png', href:'/king' },
    panther:{ label:'SH!TTY PANTHERS', item:'PANTHER', art:'/assets/mainframe/panther.webp?v=1', href:'/panther' },
    honeypot:{ label:'H0NEYP0T', item:'H0NEYP0T', art:'/assets/mainframe/honeypot.webp?v=1', href:'/honeypot' },
    honeyash:{ label:'H0NEYP0T ASH', item:'ASH', art:'/assets/mainframe/honeypot.webp?v=1', href:'/honeyash' },
    honeyphoenix:{ label:'H0NEYP0T PH0EN!X', item:'PH0EN!X', art:'/assets/mainframe/honeypot.webp?v=1', href:'/honeyphoenix' },
    phnixs:{ label:'PHN!X', item:'PHN!X', art:'/assets/mainframe/phnix.jpeg?v=2', href:null, token:'$PHN!X', issuer:'rDFXbW2ZZCG5WgPtqwNiA2xZokLMm9ivmN' },
    teddybg:{ label:'TEDDY', item:'TEDDY', art:'/assets/mainframe/teddy.jpeg?v=2', href:null, token:'$TEDDY', issuer:'r9Qk4VGodriw2xKLG9sRbTXWgknkz9TkDd' },
    seal:{ label:'SEAL', item:'SEAL', art:'/assets/mainframe/seal.jpeg?v=2', href:'/seal', token:'$SEAL', issuer:'r4pXXQzJ8soYSX4QKeeW4BzRQS1PCtVYLJ' },
    sealscrolls:{ label:'SEAL SCR0LLS', item:'SCR0LL', art:'/assets/mainframe/seal.jpeg?v=2', href:'/sealscrolls', token:'$SEAL', issuer:'r4pXXQzJ8soYSX4QKeeW4BzRQS1PCtVYLJ' },
    fuzzy:{ label:'FUZZY', item:'FUZZYBEAR', art:'/assets/mainframe/fuzzy.jpeg?v=2', href:'/fuzzy', token:'$FUZZY', issuer:'rhCAT4hRdi2Y9puNdkpMzxrdKa5wkppR62' },
    yzzuf:{ label:'YZZUF', item:'RAEBYZZUF', art:'/assets/mainframe/fuzzy.jpeg?v=2', href:'/yzzuf' },
    fuzzybars:{ label:'FUZZY BARS', item:'FUZZY BAR', art:'/assets/mainframe/fuzzy.jpeg?v=2', href:'/fuzzybars', token:'$FUZZY', issuer:'rhCAT4hRdi2Y9puNdkpMzxrdKa5wkppR62' },
    conspiracy:{ label:'C0NSP!RACY AREA 589', item:'C0NSP!RACY', art:'/assets/mainframe/conspiracy.jpeg?v=2', href:'/conspiracy', token:'$CNS', issuer:'r4tQnePn6NDdfcCYEbKhPu97jUQsyTSWBB' },
    whiterabbit:{ label:'WH!TE RABB!T', item:'WH!TE RABB!T', art:'/assets/mainframe/whiterabbit.png?v=1', href:'/whiterabbit', token:'$CNS', issuer:'r4tQnePn6NDdfcCYEbKhPu97jUQsyTSWBB' },
    thirdeye:{ label:'3RD EYE', item:'3RD EYE', art:'/assets/mainframe/thirdeye.webp?v=1', href:null, token:'$3RDEYE', issuer:'rHjyBqFM5oQvXu1soWtATC4r1V6GBnhCQQ' },
    bear:{ label:'BEAR', item:'BEAR', art:'/assets/mainframe/bear.webp?v=3', href:null, token:'$BEAR', issuer:'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW' },
    cult:{ label:'CULT', item:'CULT', art:'/assets/mainframe/cult.webp?v=1', href:null, token:'$CULT', issuer:'rCULtAKrKbQjk1Tpmg5hkw4dpcf9S9KCs' },
    smoki:{ label:'SM0K!', item:'SM0K!', art:'/assets/mainframe/smoki.webp?v=1', href:null, token:'$SM0K!', issuer:'rpHyEYhaL9edeXWr7spsGUbo8n13ivzzty' }
  };
  // Collections with a per-item page (functions/<key>/[number].js).
  var ITEM_ROUTES = { pigeons:1, king:1, panther:1, honeypot:1, honeyash:1, honeyphoenix:1, seal:1, sealscrolls:1, fuzzy:1, yzzuf:1, fuzzybars:1, conspiracy:1, whiterabbit:1 };
  var TOKEN_LABEL_BY_ISSUER = {};
  Object.keys(OURS).forEach(function(k){ if (OURS[k].issuer) TOKEN_LABEL_BY_ISSUER[OURS[k].issuer] = OURS[k].token; });

  var RANGE_LABEL = { '24h':'last 24 hours', '7d':'last 7 days', '30d':'last 30 days', 'all':'all time' };
  var RANGE_SHORT = { '24h':'24H', '7d':'7D', '30d':'30D', 'all':'ALL T!ME' };
  var SHARE_COLORS = ['#3df3ec', '#ff33cc', '#f5c518', '#34ff85', '#8848f8'];

  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function isNum(n){ return typeof n === 'number' && isFinite(n); }
  function full(n){ return isNum(n) ? Math.round(n).toLocaleString('en-US') : '—'; }
  function compact(n){
    if (!isNum(n)) return '—';
    var a = Math.abs(n);
    if (a >= 1e9) return (n/1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n/1e6).toFixed(2) + 'M';
    if (a >= 1e4) return (n/1e3).toFixed(1) + 'K';
    if (a >= 100) return Math.round(n).toLocaleString('en-US');
    if (a >= 1) return n.toFixed(2).replace(/\\.?0+$/, '');
    return n.toPrecision(3);
  }
  function xrp(n){ return isNum(n) ? compact(n) + ' XRP' : '—'; }
  function usd(n){ return isNum(n) ? '$' + compact(n) : '—'; }
  function price(n){
    if (!isNum(n)) return '—';
    if (n >= 1) return '$' + n.toFixed(2);
    if (n >= 0.01) return '$' + n.toFixed(4);
    return '$' + n.toPrecision(3);
  }
  function chg(n, suffix){
    if (!isNum(n)) return '<span class="flat">—</span>';
    var c = n > 0.05 ? 'up' : n < -0.05 ? 'down' : 'flat';
    var arrow = n > 0.05 ? '▲ ' : n < -0.05 ? '▼ ' : '';
    return '<span class="' + c + '">' + arrow + Math.abs(n).toFixed(1) + '%</span>' + (suffix ? ' <span class="flat">' + suffix + '</span>' : '');
  }
  function ago(sec){
    if (!isNum(sec)) return '';
    var s = Math.max(0, Math.floor(Date.now()/1000 - sec));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    if (s < 86400) return Math.floor(s/3600) + 'h ago';
    return Math.floor(s/86400) + 'd ago';
  }
  function initials(s){ return esc(String(s || '?').replace(/[^A-Za-z0-9!$]/g, '').slice(0, 2).toUpperCase()); }
  function thumbHtml(src, name, round){
    var inner = src ? '<img src="' + esc(src) + '" alt="" loading="lazy" onerror="this.parentNode.textContent=this.parentNode.dataset.i">' : initials(name);
    return '<span class="thumb' + (round ? ' round' : '') + '" data-i="' + initials(name) + '">' + inner + '</span>';
  }
  function decodeCurrency(c){
    if (!c || c.length !== 40) return c || '';
    var s = '';
    for (var i = 0; i < 40; i += 2){ var code = parseInt(c.slice(i, i+2), 16); if (code) s += String.fromCharCode(code); }
    return s || c;
  }
  function field(v, d, cls){ return '<div class="field"><span class="v num' + (cls ? ' ' + cls : '') + '">' + v + '</span><span class="d">' + d + '</span></div>'; }
  function share(barEl, legEl, items, total){
    if (!isNum(total) || total <= 0 || !items.length){ barEl.innerHTML = ''; legEl.innerHTML = '<span>—</span>'; return; }
    var used = 0, parts = [];
    items.slice(0, 5).forEach(function(it, i){
      if (!isNum(it.v) || it.v <= 0) return;
      used += it.v;
      parts.push({ name:it.name, v:it.v, color:SHARE_COLORS[i % SHARE_COLORS.length] });
    });
    var rest = Math.max(0, total - used);
    if (rest > 0) parts.push({ name:'Everything else', v:rest, color:'rgba(230,225,211,0.25)' });
    barEl.innerHTML = parts.map(function(p){ return '<span style="flex:' + p.v + ';background:' + p.color + '" title="' + esc(p.name) + '"></span>'; }).join('');
    legEl.innerHTML = parts.map(function(p){ return '<span><i style="background:' + p.color + '"></i>' + esc(p.name) + '<b>' + Math.max(0, Math.round(p.v / total * 100)) + '%</b></span>'; }).join('');
  }

  // ---- XRPL at a glance ----
  var data = null;
  var glanceRange = '24h', nftRange = '24h', coinRange = 'vol24h';

  function renderGlance(){
    var n = data && data.nft, r = n && n.ranges ? n.ranges[glanceRange] : null;
    var label = RANGE_SHORT[glanceRange];
    $('nftHeroK').textContent = 'NFT TRAD!NG V0LUME · ' + label;
    $('nftHeroV').innerHTML = r && isNum(r.volumeXrp) ? compact(r.volumeXrp) + '<small>XRP</small>' : '—';
    $('nftHeroC').innerHTML = r && isNum(r.volumeChangePct) ? chg(r.volumeChangePct, 'vs the ' + (glanceRange === '24h' ? 'day' : 'period') + ' before') : '';
    $('nftFields').innerHTML = r ? [
      field(full(r.sales), 'NFTs sold'),
      field(isNum(r.volumeXrp) && r.sales ? xrp(r.volumeXrp / r.sales) : '—', 'average sale'),
      field(full(r.mints), 'NFTs minted'),
      field(full(r.burns), 'NFTs burned'),
      field(full(r.traders), glanceRange === 'all' ? 'wallets that ever traded' : 'wallets trading'),
      field(full(r.collections), glanceRange === 'all' ? 'collections on XRPL' : 'collections traded')
    ].join('') : field('—', 'NFT data unavailable right now');
    var top = data && data.topNfts ? data.topNfts[glanceRange] : null;
    $('nftShareK').textContent = 'WHERE THE V0LUME WENT · ' + label;
    share($('nftShare'), $('nftLegend'), (top || []).map(function(c){ return { name:c.ours && OURS[c.ours] ? OURS[c.ours].label : c.name, v:c.volumeXrp }; }), r ? r.volumeXrp : null);
  }

  function renderMemes(){
    var m = data && data.meme;
    $('memeHeroV').innerHTML = m && isNum(m.volume24hXrp) ? compact(m.volume24hXrp) + '<small>XRP</small>' : '—';
    $('memeHeroC').innerHTML = m && isNum(m.volumeChangePct) ? chg(m.volumeChangePct, 'vs the day before') : '';
    $('memeFields').innerHTML = m ? [
      field(full(m.count), 'meme coins on XRPL'),
      field(usd(m.marketCapUsd), 'combined market cap'),
      field(xrp(m.liquidityXrp), 'in AMM pools'),
      field(isNum(m.gainers24h) && isNum(m.losers24h) ? '<span class="up">' + full(m.gainers24h) + '</span> / <span class="down">' + full(m.losers24h) + '</span>' : '—', 'coins up / down today')
    ].join('') : field('—', 'Meme coin data unavailable right now');
    var top = data && data.topCoins ? data.topCoins.vol24h : null;
    share($('memeShare'), $('memeLegend'), (top || []).map(function(c){ return { name:c.name, v:c.volume24hXrp }; }), m ? m.volume24hXrp : null);
  }

  function renderLedgerStats(){
    var l = data && data.ledger;
    function row(k, v){ return '<div class="row"><span>' + k + '</span><b class="num">' + v + '</b></div>'; }
    $('ledgerList').innerHTML = l ? [
      row('Transactions', full(l.transactions24h) + (isNum(l.transactionsChangePct) ? ' <small>' + chg(l.transactionsChangePct) + '</small>' : '')),
      row('Active wallets', full(l.activeAddresses24h)),
      row('DEX volume (all tokens)', xrp(l.dexVolume24hXrp)),
      row('Wallets trading tokens', full(l.uniqueTraders24h)),
      row('Tokens traded', full(l.tokensTraded24h)),
      row('New AMM pools', full(l.ammPoolsCreated24h)),
      row('Accounts on XRPL', '<span class="green">' + full(l.totalAccounts) + '</span>'),
      row('Trustlines on XRPL', full(l.totalTrustLines))
    ].join('') : row('Ledger data', 'unavailable right now');
  }

  // ---- top 10s ----
  function nftHref(c){
    var o = c.ours && OURS[c.ours];
    if (o && o.href) return { href:o.href, external:false };
    return { href:'https://xrpl.to/nfts/' + encodeURIComponent(c.slug), external:true };
  }
  function renderNftRows(){
    var list = data && data.topNfts ? data.topNfts[nftRange] : null;
    $('nftRankSub').textContent = 'By volume, ' + RANGE_LABEL[nftRange] + ' · XRP';
    if (!list || !list.length){ $('nftRows').innerHTML = '<tr><td colspan="6" class="empty">Couldn\\u2019t load the NFT rankings. Try again in a minute.</td></tr>'; return; }
    $('nftRows').innerHTML = list.map(function(c, i){
      var o = c.ours && OURS[c.ours];
      var img = o ? o.art : (c.hasLogo ? '/api/home?img=nft&slug=' + encodeURIComponent(c.slug) : null);
      var link = nftHref(c);
      var sub = o ? '<span class="ours-tag">Σκύλλα' + (o.href ? ' DATABASE' : '') + '</span>' : '<span>' + (isNum(c.items) ? full(c.items) + ' items' : '') + '</span>';
      return '<tr tabindex="0" data-href="' + esc(link.href) + '"' + (link.external ? ' data-ext="1"' : '') + '>' +
        '<td class="rk' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</td>' +
        '<td class="nm"><div class="nm-inner">' + thumbHtml(img, c.name) + '<div class="nm-text"><strong>' + esc(c.name.trim()) + '</strong>' + sub + '</div></div></td>' +
        '<td class="green">' + compact(c.volumeXrp) + '</td>' +
        '<td class="hide-sm">' + full(c.sales) + '</td>' +
        '<td>' + compact(c.floorXrp) + (isNum(c.floorChangePct) ? '<br><small>' + chg(c.floorChangePct) + '</small>' : '') + '</td>' +
        '<td class="hide-sm">' + full(c.owners) + '</td></tr>';
    }).join('');
  }
  function coinHref(c){
    var o = c.ours && OURS[c.ours];
    if (o && o.href) return { href:o.href, external:false };
    if (c.popular) return { href:'/static?static=coins', external:false };
    return { href:'https://xrpl.to/token/' + encodeURIComponent(c.slug), external:true };
  }
  function renderCoinRows(){
    var list = data && data.topCoins ? data.topCoins[coinRange] : null;
    var is7 = coinRange === 'vol7d', isMcap = coinRange === 'marketcap';
    $('coinChgHead').textContent = is7 ? '7D' : '24H';
    $('coinMainHead').textContent = isMcap ? 'MARKET CAP' : 'V0LUME';
    $('coinRankSub').textContent = isMcap ? 'By market cap · USD' : 'By volume, ' + (is7 ? 'last 7 days' : 'last 24 hours') + ' · XRP';
    if (!list || !list.length){ $('coinRows').innerHTML = '<tr><td colspan="6" class="empty">Couldn\\u2019t load the coin rankings. Try again in a minute.</td></tr>'; return; }
    $('coinRows').innerHTML = list.map(function(c, i){
      var o = c.ours && OURS[c.ours];
      var img = o ? o.art : '/api/home?img=token&currency=' + encodeURIComponent(c.currency) + '&issuer=' + encodeURIComponent(c.issuer) + '&md5=' + encodeURIComponent(c.md5);
      var link = coinHref(c);
      var main = isMcap ? usd(c.marketCapUsd) : compact(is7 ? c.volume7dXrp : c.volume24hXrp);
      var sub = o ? '<span class="ours-tag">Σκύλλα</span>' : (c.popular ? '<span class="ours-tag">ON 0UR C0!NS PAGE</span>' : '<span>' + esc(c.issuer.slice(0, 6) + '…' + c.issuer.slice(-4)) + '</span>');
      return '<tr tabindex="0" data-href="' + esc(link.href) + '"' + (link.external ? ' data-ext="1"' : '') + '>' +
        '<td class="rk' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</td>' +
        '<td class="nm"><div class="nm-inner">' + thumbHtml(img, c.name, true) + '<div class="nm-text"><strong>$' + esc(String(c.name).trim()) + '</strong>' + sub + '</div></div></td>' +
        '<td class="hide-sm">' + price(c.priceUsd) + '</td>' +
        '<td>' + chg(is7 ? c.change7dPct : c.change24hPct) + '</td>' +
        '<td class="green">' + main + '</td>' +
        '<td class="hide-sm">' + full(c.holders) + '</td></tr>';
    }).join('');
  }

  function renderAll(){
    renderGlance(); renderMemes(); renderLedgerStats(); renderNftRows(); renderCoinRows();
    if (data && data.updatedAt) $('updatedAt').textContent = 'Updated ' + new Date(data.updatedAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
  }

  function loadOverview(){
    fetch('/api/home').then(function(r){ return r.json(); }).then(function(d){ data = d; renderAll(); })
      .catch(function(){ if (!data) renderAll(); });
  }

  // ---- our collections ----
  function renderCards(){
    $('cards').innerHTML = CARDS.map(function(c){
      var tag = c.live ? 'a' : 'div';
      return '<' + tag + (c.live ? ' href="' + c.href + '"' : '') + ' class="card' + (c.live ? '' : ' card-soon') + '" style="--card-accent:' + c.accent + ';--card-art:url(\\'' + c.art + '\\');--art-y:' + c.y + '">' +
        '<div class="card-art">' + (c.live ? '' : '<div class="soon-tape"></div>') + '</div>' +
        '<div class="card-body">' +
          '<div class="card-label">' + esc(c.label) + '</div>' +
          (c.live ? '<span class="pill live">● L!VE DATABASE</span>' : '<span class="pill soon">C0M!NG S00N</span>') +
          '<div class="card-stats" id="cs-' + c.key + '">' +
            '<div>H0LDERS<b>—</b></div><div>MARKET CAP<b>—</b></div><div>24H V0LUME<b>—</b></div><div>FL00R<b>—</b></div>' +
          '</div>' +
          '<span class="card-cta">' + (c.live ? '0PEN DATABASE' : 'DATABASE C0M!NG S00N') + '</span>' +
        '</div></' + tag + '>';
    }).join('');
  }
  function loadCardStats(){
    CARDS.forEach(function(c){
      Promise.all([
        c.stats ? fetch('/api/pigeons?stats=1&collection=' + c.key).then(function(r){ return r.json(); }).catch(function(){ return {}; }) : Promise.resolve({}),
        fetch('/api/pigeons?pigeonsRate=1&collection=' + c.key).then(function(r){ return r.json(); }).catch(function(){ return {}; })
      ]).then(function(res){
        var s = res[0] || {}, rate = res[1] || {};
        var el = $('cs-' + c.key);
        if (!el) return;
        var floor = [s.xrpFloorXrp, s.xrpCafeFloorXrp, s.deeptideFloorXrp].filter(function(v){ return isNum(v) && v > 0; });
        el.innerHTML =
          '<div>H0LDERS<b>' + (isNum(s.holders) ? full(s.holders) : '—') + '</b></div>' +
          '<div>MARKET CAP<b>' + (isNum(rate.marketCapUsd) ? usd(rate.marketCapUsd) : '—') + '</b></div>' +
          '<div>24H V0LUME<b>' + (isNum(s.volume24hXrp) ? xrp(s.volume24hXrp) : '—') + '</b></div>' +
          '<div>FL00R<b>' + (floor.length ? xrp(Math.min.apply(null, floor)) : '—') + '</b></div>';
      });
    });
  }

  // ---- live feed (our collections) ----
  var feedSeen = {}, feedFirst = true;
  var EV_LABEL = { sale:'S0LD', listing:'L!STED', mint:'M!NTED', burn:'BURNED', offer:'0FFER' };
  function priceText(p){
    if (!p) return '';
    if (isNum(p.xrp)) return xrp(p.xrp);
    var v = parseFloat(p.value);
    var label = TOKEN_LABEL_BY_ISSUER[p.issuer] || ('$' + decodeCurrency(p.currency));
    return isNum(v) ? compact(v) + ' ' + label : '';
  }
  function renderFeed(items){
    if (!items || !items.length){ $('feed').innerHTML = '<li><span></span><span class="what"><span>No activity in our collections yet. New sales, listings and mints show up here as they happen.</span></span><span></span></li>'; return; }
    $('feed').innerHTML = items.map(function(e){
      var o = OURS[e.collection] || { label:e.collection, item:e.collection, art:null, href:null };
      var id = e.hash + ':' + e.type + ':' + e.nftId;
      var isNew = !feedFirst && !feedSeen[id];
      feedSeen[id] = 1;
      var title = o.item + (e.number ? ' #' + e.number : '');
      var p = priceText(e.price);
      var href = o.href ? (e.number && ITEM_ROUTES[e.collection] ? o.href + '/' + e.number : o.href) : null;
      var body = '<span class="what"><strong>' + esc(title) + '</strong><span>' + esc(o.label) + (p ? ' · ' + esc(p) : '') + '</span></span>';
      return '<li' + (isNew ? ' class="new"' : '') + '>' + thumbHtml(o.art, o.label) +
        (href ? '<a href="' + esc(href) + '" style="min-width:0">' + body + '</a>' : body) +
        '<span class="when"><span class="ev ' + e.type + '">' + (EV_LABEL[e.type] || e.type.toUpperCase()) + '</span><span data-t="' + (e.time || '') + '">' + ago(e.time) + '</span></span></li>';
    }).join('');
    feedFirst = false;
  }
  function loadFeed(){
    fetch('/api/home?feed=1').then(function(r){ return r.json(); }).then(function(d){
      $('feedDot').classList.add('on');
      renderFeed(d.items || []);
    }).catch(function(){ $('feedDot').classList.remove('on'); if (feedFirst) renderFeed([]); });
  }
  setInterval(function(){
    document.querySelectorAll('#feed [data-t]').forEach(function(s){ var t = Number(s.dataset.t); if (t) s.textContent = ago(t); });
  }, 15000);

  // ---- live ledger (straight from the XRPL, no server in between) ----
  var WS_URLS = ['wss://xrplcluster.com/', 'wss://s1.ripple.com/', 'wss://s2.ripple.com/'];
  var wsIdx = 0, wsRetry = 1000, lastClose = 0;
  function showLedger(index, txns, closeTime){
    if (!isNum(index)) return;
    $('ledgerIdx').textContent = '#' + index.toLocaleString('en-US');
    lastClose = isNum(closeTime) ? (closeTime + 946684800) * 1000 : Date.now();
    $('ledgerMeta').dataset.tx = isNum(txns) ? txns : '';
    $('ledgerDot').classList.add('on');
    var box = $('ledgerBox'); box.classList.add('tick'); setTimeout(function(){ box.classList.remove('tick'); }, 700);
    tickLedgerMeta();
  }
  function tickLedgerMeta(){
    if (!lastClose) return;
    var s = Math.max(0, Math.round((Date.now() - lastClose) / 1000));
    var tx = $('ledgerMeta').dataset.tx;
    $('ledgerMeta').textContent = 'closed ' + s + 's ago' + (tx !== '' && tx !== undefined ? ' · ' + tx + ' transactions' : '');
  }
  setInterval(tickLedgerMeta, 1000);
  function connectLedger(){
    if (!('WebSocket' in window)) { $('ledgerMeta').textContent = 'live ledger unavailable'; return; }
    var ws;
    try { ws = new WebSocket(WS_URLS[wsIdx % WS_URLS.length]); } catch (e) { return retry(); }
    ws.onopen = function(){ wsRetry = 1000; ws.send(JSON.stringify({ id:1, command:'subscribe', streams:['ledger'] })); };
    ws.onmessage = function(m){
      var d; try { d = JSON.parse(m.data); } catch (e) { return; }
      if (d.type === 'ledgerClosed') showLedger(d.ledger_index, d.txn_count, d.ledger_time);
      else if (d.id === 1 && d.result) showLedger(d.result.ledger_index, null, d.result.ledger_time);
    };
    ws.onclose = function(){ $('ledgerDot').classList.remove('on'); retry(); };
    ws.onerror = function(){ try { ws.close(); } catch (e) {} };
    function retry(){ wsIdx++; setTimeout(connectLedger, wsRetry); wsRetry = Math.min(wsRetry * 2, 30000); }
  }

  // ---- search ----
  var SEARCH_NAMES = [];
  Object.keys(OURS).forEach(function(k){ if (OURS[k].href) SEARCH_NAMES.push({ k:k, names:[OURS[k].label, OURS[k].item, k, OURS[k].token || ''] }); });
  function norm(s){ return String(s || '').toLowerCase().replace(/!/g, 'i').replace(/0/g, 'o').replace(/[^a-z0-9]/g, ''); }
  $('searchForm').addEventListener('submit', function(e){
    e.preventDefault();
    var q = $('q').value.trim(), msg = $('searchMsg');
    if (!q){ msg.textContent = 'Type a wallet address or a collection name.'; return; }
    if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(q)){ window.location.href = '/profile/' + q; return; }
    var nq = norm(q);
    var hit = SEARCH_NAMES.filter(function(s){ return s.names.some(function(n){ var nn = norm(n); return nn && (nn === nq || nn.indexOf(nq) === 0); }); })[0];
    if (hit){ window.location.href = OURS[hit.k].href; return; }
    var soon = Object.keys(OURS).filter(function(k){ return !OURS[k].href && norm(OURS[k].label).indexOf(nq) === 0; })[0];
    if (soon){ msg.textContent = OURS[soon].label + '\\u2019s database is coming soon.'; return; }
    msg.textContent = 'No collection called \\u201c' + q + '\\u201d in our database yet. Try a wallet address, or a name like P!GE0NS or SEAL.';
  });

  // ---- switches + row clicks ----
  function wireSeg(id, fn){
    $(id).addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      this.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      fn(b.dataset.v);
    });
  }
  wireSeg('glanceRange', function(v){ glanceRange = v; renderGlance(); });
  wireSeg('nftRange', function(v){ nftRange = v; renderNftRows(); });
  wireSeg('coinRange', function(v){ coinRange = v; renderCoinRows(); });
  function openRow(tr){
    var href = tr.dataset.href; if (!href) return;
    if (tr.dataset.ext) window.open(href, '_blank', 'noopener'); else window.location.href = href;
  }
  document.addEventListener('click', function(e){ var tr = e.target.closest('tr[data-href]'); if (tr) openRow(tr); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-href]')) openRow(e.target); });

  // ---- static background (DATABASE's startStaticCanvas, plain mode) ----
  (function(){
    var canvas = $('staticBg'), ctx = canvas.getContext('2d');
    function resize(){ canvas.width = Math.max(1, Math.floor(window.innerWidth / 3)); canvas.height = Math.max(1, Math.floor(window.innerHeight / 3)); }
    function draw(){
      var img = ctx.createImageData(canvas.width, canvas.height), b = img.data;
      for (var i = 0; i < b.length; i += 4){ var s = Math.random() * 255; b[i] = s; b[i+1] = s; b[i+2] = s; b[i+3] = 255; }
      ctx.putImageData(img, 0, 0);
    }
    resize(); window.addEventListener('resize', resize); draw();
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var frame = 0;
    (function loop(){ if (!document.hidden && (frame++ % 3 === 0)) draw(); requestAnimationFrame(loop); })();
  })();

  renderCards();
  renderAll();
  loadOverview();
  loadCardStats();
  loadFeed();
  connectLedger();
  setInterval(loadOverview, 120000);
  setInterval(loadFeed, 30000);
})();
</script>
</body>
</html>`;

export async function onRequestGet() {
  return new Response(HOME_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
