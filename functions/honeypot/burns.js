// Σκύλλα://BURNS — every H0NEYP0T-collection burn in order (2026-10-02).
// Filter by Honeypot / Ash / Phoenix, search by number, tap any burn to see
// its picture, traits, burn transaction and where it sits in the
// Honeypot -> Ash -> Phoenix -> Phase 2 -> Phase 3 chain. Data comes from
// /api/honeypot-burns (live off the ledger, 60s cache).
// Client script lives in a template literal: no backticks in it, and no
// backslashes (they'd need doubling).

function renderBurnsPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Σκύλλα://BURNS</title>
<meta name="description" content="Every burn in the Honeypot collection, in order: Honeypots, Ashes and Phoenixes, read straight off the XRP Ledger.">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  :root{
    --honey:255,176,0; --green:52,255,133; --cyan:61,243,236; --pink:255,63,208;
    --text:#fff; --dim:rgba(255,255,255,0.72); --faint:rgba(255,255,255,0.45);
    --bar:52px;
  }
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ background:#000; }
  body{ font-family:'Chakra Petch',sans-serif; color:var(--text); min-height:100vh; font-size:15px; line-height:1.5; -webkit-text-size-adjust:100%; }
  body.modal-open{ overflow:hidden; }
  canvas#staticCanvas{ position:fixed; inset:0; width:100%; height:100%; z-index:0; opacity:0.45; pointer-events:none; }
  a{ color:rgb(var(--cyan)); }
  button{ font-family:inherit; }
  .mono{ font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:0.9em; }

  .topbar{ position:sticky; top:0; z-index:5; height:var(--bar); background:rgba(0,0,0,0.92); border-bottom:1px solid rgba(var(--honey),0.4); box-shadow:0 0 14px rgba(var(--honey),0.18); }
  .topbar-in{ max-width:980px; height:100%; margin:0 auto; padding:0 16px; display:flex; align-items:center; gap:0.9rem; }
  .back{ color:#fff; text-decoration:none; font-size:13px; letter-spacing:0.08em; border:1px solid rgba(255,255,255,0.5); border-radius:8px; padding:0.35em 0.8em; white-space:nowrap; }
  .back:hover{ background:rgba(255,255,255,0.12); }
  .topbar-title{ font-size:13px; letter-spacing:0.2em; color:rgb(var(--honey)); text-shadow:0 0 8px rgba(var(--honey),0.5); }
  .topbar-live{ margin-left:auto; font-size:11px; letter-spacing:0.12em; color:var(--faint); white-space:nowrap; }
  .topbar-live b{ color:rgb(var(--green)); font-weight:600; }

  .page{ position:relative; z-index:1; max-width:980px; margin:0 auto; padding:2rem 16px 5rem; }
  .eyebrow{ font-size:12px; letter-spacing:0.3em; color:rgb(var(--honey)); text-shadow:0 0 8px rgba(var(--honey),0.55); margin-bottom:0.5rem; }
  h1{ font-size:clamp(30px,6vw,50px); line-height:1.08; letter-spacing:0.03em; margin-bottom:0.7rem; text-shadow:0 0 18px rgba(var(--honey),0.3); }
  .lead{ color:var(--dim); max-width:640px; }

  .flow{ display:flex; flex-wrap:wrap; align-items:center; gap:0.35rem; margin:1.1rem 0 1.6rem; font-size:12px; letter-spacing:0.12em; }
  .flow span{ border:1px solid rgba(var(--honey),0.55); background:#000; border-radius:999px; padding:0.25em 0.75em; }
  .flow i{ font-style:normal; color:rgb(var(--honey)); }

  .box{ background:#000; border:1px solid rgba(var(--honey),0.5); border-radius:14px; box-shadow:0 0 12px rgba(var(--honey),0.14); }
  .stats{ display:grid; grid-template-columns:repeat(4,1fr); gap:0.6rem; }
  .stat{ padding:0.8rem 0.9rem; }
  .stat .k{ display:block; font-size:11px; letter-spacing:0.18em; color:var(--faint); }
  .stat .v{ display:block; font-size:28px; font-weight:700; line-height:1.15; }
  .owedgrid{ display:grid; grid-template-columns:repeat(3,1fr); gap:0.6rem; margin-top:0.6rem; }
  .owedgrid button{ text-align:left; color:#fff; cursor:pointer; padding:0.8rem 0.9rem; border-color:rgba(var(--honey),0.75); transition:background 0.15s, box-shadow 0.15s; }
  .owedgrid button:hover, .owedgrid button.on{ background:rgba(var(--honey),0.12); box-shadow:0 0 18px rgba(var(--honey),0.35); }
  .owedgrid .k{ display:block; font-size:11px; letter-spacing:0.18em; color:rgb(var(--honey)); }
  .owedgrid .v{ display:block; font-size:28px; font-weight:700; line-height:1.15; }
  .owedgrid .s{ display:block; font-size:12px; color:var(--faint); }

  .controls{ position:sticky; top:var(--bar); z-index:4; margin:1.6rem -16px 0.8rem; padding:0.7rem 16px; background:#000; border-bottom:1px solid rgba(255,255,255,0.12); display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center; }
  .chips{ display:flex; flex-wrap:wrap; gap:0.4rem; }
  .chip{ color:#fff; background:#000; border:1px solid rgba(255,255,255,0.35); border-radius:999px; padding:0.35em 0.85em; font-size:12px; letter-spacing:0.1em; cursor:pointer; }
  .chip b{ color:var(--faint); font-weight:500; margin-left:0.3em; }
  .chip.on{ border-color:rgb(var(--honey)); background:rgba(var(--honey),0.16); box-shadow:0 0 10px rgba(var(--honey),0.35); }
  .chip.on b{ color:rgb(var(--honey)); }
  .search{ flex:1; min-width:160px; background:#000; color:#fff; border:1px solid rgba(255,255,255,0.35); border-radius:10px; padding:0.45em 0.8em; font:inherit; font-size:14px; }
  .search:focus{ outline:none; border-color:rgb(var(--honey)); box-shadow:0 0 10px rgba(var(--honey),0.35); }
  .sort{ color:#fff; background:#000; border:1px solid rgba(255,255,255,0.35); border-radius:10px; padding:0.45em 0.8em; font-size:12px; letter-spacing:0.1em; cursor:pointer; white-space:nowrap; }
  .shown{ width:100%; font-size:12px; letter-spacing:0.1em; color:var(--faint); }
  .shown b{ color:#fff; font-weight:600; }

  .list{ display:flex; flex-direction:column; gap:0.45rem; }
  .row{ display:grid; grid-template-columns:3.2rem 52px 1fr auto; align-items:center; gap:0.75rem; width:100%; text-align:left; color:#fff; background:#000; border:1px solid rgba(var(--honey),0.3); border-radius:12px; padding:0.5rem 0.75rem; cursor:pointer; transition:border-color 0.15s, box-shadow 0.15s; }
  .row:hover{ border-color:rgba(var(--honey),0.85); box-shadow:0 0 14px rgba(var(--honey),0.25); }
  .row .no{ font-size:12px; letter-spacing:0.08em; color:var(--faint); }
  .thumb{ width:52px; height:52px; border-radius:8px; background:#111; object-fit:cover; display:block; }
  .thumb.none{ display:flex; align-items:center; justify-content:center; color:var(--faint); font-size:20px; }
  .row .nm{ font-size:16px; font-weight:600; letter-spacing:0.02em; line-height:1.2; }
  .row .sub{ font-size:12px; color:var(--faint); margin-top:0.15rem; display:flex; flex-wrap:wrap; gap:0.25rem 0.6rem; align-items:center; }
  .tag{ font-size:10.5px; letter-spacing:0.12em; border-radius:999px; padding:0.1em 0.6em; border:1px solid rgba(255,255,255,0.35); color:#fff; }
  .tag.k-honeypot{ border-color:rgba(var(--honey),0.8); color:rgb(var(--honey)); }
  .tag.k-ash{ border-color:rgba(255,255,255,0.6); color:#ddd; }
  .tag.k-phoenix{ border-color:rgba(var(--pink),0.8); color:rgb(var(--pink)); }
  .dots{ display:flex; gap:4px; }
  .dot{ width:10px; height:10px; border-radius:50%; border:1px solid rgba(255,255,255,0.3); }
  .dot.burned{ background:rgb(var(--pink)); border-color:rgb(var(--pink)); }
  .dot.live{ background:rgb(var(--green)); border-color:rgb(var(--green)); }
  .dot.owed{ background:rgb(var(--honey)); border-color:rgb(var(--honey)); box-shadow:0 0 6px rgba(var(--honey),0.8); }
  .empty, .loading{ text-align:center; color:var(--faint); padding:2.5rem 0; letter-spacing:0.12em; }
  .legend{ display:flex; flex-wrap:wrap; gap:0.4rem 1rem; font-size:12px; color:var(--faint); margin:0.2rem 0 0.8rem; }
  .legend span{ display:inline-flex; align-items:center; gap:0.35rem; }

  /* Pop-up: starts below the top bar and fits the screen. */
  .modal{ position:fixed; left:0; right:0; bottom:0; top:var(--bar); z-index:10; display:none; align-items:flex-start; justify-content:center; padding:1rem 16px; background:rgba(0,0,0,0.75); overflow-y:auto; }
  .modal.open{ display:flex; }
  .card{ position:relative; width:100%; max-width:720px; padding:1.1rem; border-color:rgba(var(--honey),0.8); box-shadow:0 0 24px rgba(var(--honey),0.3); }
  .close{ position:absolute; top:0.6rem; right:0.6rem; color:#fff; background:#000; border:1px solid rgba(255,255,255,0.5); border-radius:8px; padding:0.25em 0.7em; cursor:pointer; font-size:13px; letter-spacing:0.08em; }
  .card-top{ display:grid; grid-template-columns:200px 1fr; gap:1rem; }
  .big{ width:200px; height:200px; border-radius:12px; background:#111; object-fit:cover; display:block; }
  .big.none{ display:flex; align-items:center; justify-content:center; color:var(--faint); font-size:13px; text-align:center; padding:1rem; }
  .card h2{ font-size:24px; letter-spacing:0.03em; line-height:1.15; margin:0.1rem 2.5rem 0.3rem 0; }
  .facts{ display:grid; grid-template-columns:auto 1fr; gap:0.2rem 0.8rem; font-size:13.5px; margin-top:0.5rem; }
  .facts dt{ color:var(--faint); letter-spacing:0.1em; font-size:11.5px; padding-top:0.15em; }
  .facts dd{ word-break:break-all; }
  .traits{ display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:0.4rem; margin-top:1rem; }
  .trait{ border:1px solid rgba(255,255,255,0.25); border-radius:10px; padding:0.4rem 0.6rem; }
  .trait .k{ display:block; font-size:10.5px; letter-spacing:0.14em; color:var(--faint); }
  .trait .v{ display:block; font-size:14px; font-weight:600; }
  .sec{ font-size:11.5px; letter-spacing:0.2em; color:rgb(var(--honey)); margin:1.2rem 0 0.5rem; }
  .chain{ display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:0.4rem; }
  .stage{ border:1px solid rgba(255,255,255,0.25); border-radius:10px; padding:0.5rem 0.55rem; background:#000; color:#fff; text-align:left; font-size:13px; line-height:1.25; }
  .stage .st{ display:block; font-size:10px; letter-spacing:0.14em; color:var(--faint); margin-bottom:0.2rem; }
  .stage .pill{ display:inline-block; white-space:nowrap; margin-top:0.35rem; font-size:10px; letter-spacing:0.12em; border-radius:999px; padding:0.1em 0.55em; border:1px solid rgba(255,255,255,0.3); color:var(--faint); }
  .stage.burned{ border-color:rgba(var(--pink),0.7); }
  .stage.burned .pill{ border-color:rgb(var(--pink)); color:rgb(var(--pink)); }
  .stage.live{ border-color:rgba(var(--green),0.7); }
  .stage.live .pill{ border-color:rgb(var(--green)); color:rgb(var(--green)); }
  .stage.owed{ border-color:rgb(var(--honey)); box-shadow:0 0 10px rgba(var(--honey),0.3); }
  .stage.owed .pill{ border-color:rgb(var(--honey)); color:#000; background:rgb(var(--honey)); }
  .stage.here{ outline:2px solid #fff; outline-offset:1px; }
  .stage.link{ cursor:pointer; }
  .stage.link:hover{ background:rgba(255,255,255,0.08); }
  .btns{ display:flex; flex-wrap:wrap; gap:0.5rem; margin-top:1rem; }
  .btn{ display:inline-block; color:#fff; text-decoration:none; background:#000; border:1px solid rgba(var(--honey),0.8); border-radius:10px; padding:0.45em 0.9em; font-size:12.5px; letter-spacing:0.1em; cursor:pointer; }
  .btn:hover{ background:rgba(var(--honey),0.14); }

  @media (max-width:700px){
    .stats{ grid-template-columns:repeat(2,1fr); }
    .owedgrid{ grid-template-columns:1fr; }
    .row{ grid-template-columns:44px 1fr auto; }
    .row .no{ display:none; }
    .thumb{ width:44px; height:44px; }
    .card-top{ grid-template-columns:1fr; }
    .big{ width:100%; height:auto; aspect-ratio:1; max-width:320px; }
    .chain{ grid-template-columns:repeat(2,minmax(0,1fr)); }
    .topbar-live{ display:none; }
  }
</style>
</head>
<body>
<canvas id="staticCanvas"></canvas>
<div class="topbar"><div class="topbar-in">
  <a class="back" href="/static">← Σκύλλα</a>
  <span class="topbar-title">B U R N S</span>
  <span class="topbar-live" id="liveNote">READ!NG THE LEDGER…</span>
</div></div>

<main class="page">
  <div class="eyebrow">Σκύλλα://BURNS</div>
  <h1>H0NEYP0T BURNS</h1>
  <p class="lead">Every burn in the Honeypot collection, oldest first, read straight off the XRP Ledger. Tap any burn to see what it was and where it is in the chain.</p>
  <div class="flow"><span>H0NEYP0T</span><i>→</i><span>ASH</span><i>→</i><span>PH0EN!X</span><i>→</i><span>PHASE 2</span><i>→</i><span>PHASE 3</span></div>

  <div class="stats">
    <div class="box stat"><span class="k">T0TAL BURNS</span><span class="v" id="cTotal">–</span></div>
    <div class="box stat"><span class="k">H0NEYP0TS</span><span class="v" id="cHoneypot">–</span></div>
    <div class="box stat"><span class="k">ASH</span><span class="v" id="cAsh">–</span></div>
    <div class="box stat"><span class="k">PH0EN!X</span><span class="v" id="cPhoenix">–</span></div>
  </div>
  <div class="owedgrid">
    <button class="box" data-owed="ash"><span class="k">ASH T0 M!NT</span><span class="v" id="oAsh">–</span><span class="s">Honeypots burned, Ash not minted yet</span></button>
    <button class="box" data-owed="phoenix"><span class="k">PH0EN!X T0 M!NT</span><span class="v" id="oPhoenix">–</span><span class="s">Ashes burned, Phoenix not minted yet</span></button>
    <button class="box" data-owed="phase2"><span class="k">PHASE 2 T0 M!NT</span><span class="v" id="oPhase2">–</span><span class="s">Phoenixes burned, Phase 2 not minted yet</span></button>
  </div>

  <div class="controls">
    <div class="chips" id="chips">
      <button class="chip on" data-kind="all">ALL<b id="nAll"></b></button>
      <button class="chip" data-kind="honeypot">H0NEYP0T<b id="nHoneypot"></b></button>
      <button class="chip" data-kind="ash">ASH<b id="nAsh"></b></button>
      <button class="chip" data-kind="phoenix">PH0EN!X<b id="nPhoenix"></b></button>
      <button class="chip" data-kind="other">0THER<b id="nOther"></b></button>
    </div>
    <input class="search" id="q" type="search" placeholder="Search a number, name or wallet" autocomplete="off">
    <button class="sort" id="sort">0LDEST F!RST</button>
    <div class="shown" id="shown"></div>
  </div>
  <div class="legend">
    <span><i class="dot burned"></i>BURNED</span><span><i class="dot live"></i>L!VE</span><span><i class="dot owed"></i>T0 M!NT</span><span><i class="dot"></i>N0T YET</span>
    <span>Dots = H0NEYP0T · ASH · PH0EN!X · PHASE 2 · PHASE 3</span>
  </div>
  <div class="list" id="list"><div class="loading">READ!NG THE LEDGER…</div></div>
</main>

<div class="modal" id="modal" role="dialog" aria-modal="true"><div class="box card" id="card"></div></div>

<script>
(function(){
  var c = document.getElementById('staticCanvas');
  if (c && c.getContext){
    var ctx = c.getContext('2d');
    var size = function(){ c.width = window.innerWidth; c.height = window.innerHeight; };
    size();
    window.addEventListener('resize', size);
    var last = 0;
    var frame = function(t){
      if (t - last > 70){
        last = t;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, c.width, c.height);
        var flecks = Math.floor((c.width * c.height) / 9000);
        for (var i = 0; i < flecks; i++){
          ctx.fillStyle = Math.random() < 0.5 ? 'rgba(61,243,236,0.55)' : 'rgba(255,63,208,0.5)';
          ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 1, 1);
        }
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  var data = null;
  var kind = 'all', owedFilter = null, query = '', newestFirst = false;
  var STATUS = { burned: 'BURNED', live: 'L!VE', owed: 'T0 M!NT', waiting: 'N0T YET', unknown: '?' };
  var STAGE = { honeypot: 'H0NEYP0T', ash: 'ASH', phoenix: 'PH0EN!X', phase2: 'PHASE 2', phase3: 'PHASE 3', special: 'SWEET H0NEY' };
  var KIND = { honeypot: 'H0NEYP0T', ash: 'ASH', phoenix: 'PH0EN!X', other: '0THER', unknown: 'UNKN0WN' };

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(ch){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); }
  function $(id){ return document.getElementById(id); }
  function when(t){ return new Date(t * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }
  function day(t){ var d = new Date(t * 1000); return d.getUTCDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
  function shortAddr(a){ return a ? a.slice(0, 6) + '…' + a.slice(-4) : ''; }
  function displayName(it){ return it.name || 'Unknown NFT'; }
  function kindOf(it){ return it.kind === 'unknown' ? 'other' : it.kind; }
  // The "Type" trait (GREEN, BOILING POINT 0.99, ...) as a tag, if there's one worth showing.
  function typeTag(it){
    for (var i = 0; i < it.traits.length; i++){
      var k = it.traits[i][0], v = String(it.traits[i][1]);
      if (k === 'Type' && v !== 'Standard' && v !== 'Ash') return v.toUpperCase();
      if (k === 'Static Phase') return v.toUpperCase();
    }
    return '';
  }

  var owedSets = { ash: {}, phoenix: {}, phase2: {} };
  function buildOwedSets(){
    ['ash', 'phoenix', 'phase2'].forEach(function(k){ data.owed[k].forEach(function(o){ owedSets[k][o.n] = true; }); });
  }

  function matches(it){
    if (owedFilter) return !!owedSets[owedFilter][it.n];
    if (kind !== 'all' && kindOf(it) !== kind) return false;
    if (!query) return true;
    var q = query.toLowerCase();
    if (/^[0-9]+$/.test(q)){
      if (it.num != null && String(it.num) === q) return true;
      if (it.chain) for (var i = 0; i < it.chain.length; i++) if (it.chain[i].num != null && String(it.chain[i].num) === q) return true;
      return false;
    }
    var hay = (displayName(it) + ' ' + it.by + ' ' + it.id + ' ' + it.hash + ' ' + it.traits.map(function(t){ return t[1]; }).join(' ')).toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderList(){
    var items = data.items.filter(matches);
    if (newestFirst) items = items.slice().reverse();
    $('shown').innerHTML = 'SH0W!NG <b>' + items.length + '</b> 0F ' + data.items.length + ' BURNS' + (owedFilter ? ' · ' + { ash: 'ASH T0 M!NT', phoenix: 'PH0EN!X T0 M!NT', phase2: 'PHASE 2 T0 M!NT' }[owedFilter] : '');
    if (!items.length){ $('list').innerHTML = '<div class="empty">N0 BURNS MATCH</div>'; return; }
    $('list').innerHTML = items.map(function(it){
      var img = it.image ? '<img class="thumb" loading="lazy" alt="" src="' + esc(it.image) + '">' : '<div class="thumb none">?</div>';
      var tag = typeTag(it);
      var dots = it.chain ? '<div class="dots" title="Honeypot · Ash · Phoenix · Phase 2 · Phase 3">' + it.chain.filter(function(s){ return s.stage !== 'special'; }).map(function(s){ return '<i class="dot ' + s.status + '"></i>'; }).join('') + '</div>' : '';
      return '<button class="row" data-n="' + it.n + '">' +
        '<span class="no">#' + it.n + '</span>' + img +
        '<span><span class="nm">' + esc(displayName(it)) + '</span>' +
        '<span class="sub"><span class="tag k-' + kindOf(it) + '">' + KIND[it.kind] + '</span>' + (tag ? '<span class="tag">' + esc(tag) + '</span>' : '') + '<span>' + day(it.t) + '</span></span></span>' +
        dots + '</button>';
    }).join('');
  }

  function findBurn(stage, num){
    if (num == null) return null;
    for (var i = 0; i < data.items.length; i++){
      var it = data.items[i];
      if (it.kind === stage && it.num === num) return it;
    }
    return null;
  }

  function openBurn(n){
    var it = data.items[n - 1];
    if (!it) return;
    var img = it.image ? '<img class="big" alt="" src="' + esc(it.image) + '">' : '<div class="big none">N0 P!CTURE — this NFT&#39;s metadata is no longer online</div>';
    var tag = typeTag(it);
    var html = '<button class="close" id="closeModal">✕ CL0SE</button>' +
      '<div class="card-top">' + img + '<div>' +
      '<div class="eyebrow">BURN #' + it.n + ' 0F ' + data.items.length + '</div>' +
      '<h2>' + esc(displayName(it)) + '</h2>' +
      '<div class="sub" style="display:flex;gap:0.4rem;flex-wrap:wrap"><span class="tag k-' + kindOf(it) + '">' + KIND[it.kind] + '</span>' + (tag ? '<span class="tag">' + esc(tag) + '</span>' : '') + '</div>' +
      '<dl class="facts">' +
      '<dt>BURNED</dt><dd>' + when(it.t) + '</dd>' +
      '<dt>BURNED BY</dt><dd class="mono" title="' + esc(it.by) + '">' + esc(it.by) + '</dd>' +
      '<dt>NFT !D</dt><dd class="mono">' + esc(it.id) + '</dd>' +
      '<dt>LEDGER</dt><dd>' + it.ledger + '</dd>' +
      '</dl></div></div>';
    if (it.traits.length){
      html += '<div class="sec">TRA!TS</div><div class="traits">' + it.traits.map(function(t){ return '<div class="trait"><span class="k">' + esc(String(t[0]).toUpperCase()) + '</span><span class="v">' + esc(t[1]) + '</span></div>'; }).join('') + '</div>';
    }
    if (it.chain){
      html += '<div class="sec">THE CHA!N</div><div class="chain">' + it.chain.map(function(s){
        var target = s.status === 'burned' ? findBurn(s.stage, s.num) : null;
        var here = target && target.n === it.n;
        return '<div class="stage ' + s.status + (here ? ' here' : '') + (target && !here ? ' link' : '') + '"' + (target && !here ? ' data-open="' + target.n + '"' : '') + '>' +
          '<span class="st">' + STAGE[s.stage] + '</span>' + esc(s.label) + '<br><span class="pill">' + (here ? 'TH!S 0NE' : STATUS[s.status]) + '</span></div>';
      }).join('') + '</div>';
    }
    html += '<div class="btns"><a class="btn" href="https://livenet.xrpl.org/transactions/' + esc(it.hash) + '" target="_blank" rel="noopener">V!EW BURN TX ↗</a>' +
      '<button class="btn" data-copy="' + esc(it.id) + '">C0PY NFT !D</button></div>';
    $('card').innerHTML = html;
    $('modal').classList.add('open');
    document.body.classList.add('modal-open');
    $('modal').scrollTop = 0;
    if (location.hash !== '#burn-' + it.n) history.replaceState(null, '', '#burn-' + it.n);
  }
  function closeModal(){
    $('modal').classList.remove('open');
    document.body.classList.remove('modal-open');
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  document.addEventListener('click', function(e){
    var row = e.target.closest('.row');
    if (row){ openBurn(+row.getAttribute('data-n')); return; }
    var open = e.target.closest('[data-open]');
    if (open){ openBurn(+open.getAttribute('data-open')); return; }
    if (e.target.id === 'closeModal' || e.target.id === 'modal'){ closeModal(); return; }
    var cp = e.target.closest('[data-copy]');
    if (cp){
      try { navigator.clipboard.writeText(cp.getAttribute('data-copy')); cp.textContent = '✓ C0P!ED'; } catch (err){}
      return;
    }
    var chip = e.target.closest('.chip');
    if (chip && data){
      kind = chip.getAttribute('data-kind');
      owedFilter = null;
      paintFilters();
      renderList();
      return;
    }
    var ob = e.target.closest('[data-owed]');
    if (ob && data){
      var k = ob.getAttribute('data-owed');
      owedFilter = owedFilter === k ? null : k;
      if (owedFilter) kind = 'all';
      paintFilters();
      renderList();
    }
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeModal(); });
  $('q').addEventListener('input', function(){ query = this.value.trim(); if (data) renderList(); });
  $('sort').addEventListener('click', function(){
    newestFirst = !newestFirst;
    this.textContent = newestFirst ? 'NEWEST F!RST' : '0LDEST F!RST';
    if (data) renderList();
  });

  function paintFilters(){
    Array.prototype.forEach.call(document.querySelectorAll('.chip'), function(ch){ ch.classList.toggle('on', !owedFilter && ch.getAttribute('data-kind') === kind); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-owed]'), function(b){ b.classList.toggle('on', b.getAttribute('data-owed') === owedFilter); });
  }

  fetch('/api/honeypot-burns').then(function(r){ return r.json(); }).then(function(d){
    if (!d || !d.items) throw new Error(d && d.error || 'no data');
    data = d;
    buildOwedSets();
    $('cTotal').textContent = d.counts.total;
    $('cHoneypot').textContent = d.counts.honeypot;
    $('cAsh').textContent = d.counts.ash;
    $('cPhoenix').textContent = d.counts.phoenix;
    $('oAsh').textContent = d.owed.ash.length;
    $('oPhoenix').textContent = d.owed.phoenix.length;
    $('oPhase2').textContent = d.owed.phase2.length;
    $('nAll').textContent = d.counts.total;
    $('nHoneypot').textContent = d.counts.honeypot;
    $('nAsh').textContent = d.counts.ash;
    $('nPhoenix').textContent = d.counts.phoenix;
    $('nOther').textContent = d.counts.other;
    $('liveNote').innerHTML = '<b>●</b> L!VE · LEDGER ' + d.updatedLedger;
    renderList();
    var m = /^#burn-([0-9]+)$/.exec(location.hash);
    if (m) openBurn(+m[1]);
  }).catch(function(){
    $('list').innerHTML = '<div class="empty">C0ULDN&#39;T READ THE BURNS RIGHT N0W — try again in a minute.</div>';
    $('liveNote').textContent = '';
  });
})();
</script>
</body>
</html>`;
}

export async function onRequestGet() {
  return new Response(renderBurnsPage(), { headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } });
}
