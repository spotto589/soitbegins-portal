import { BOARD_COOKIE_NAME, getCookie, verifyToken, TRADEABLE_COLLECTIONS } from './_shared.js';

// Σκύλλα://HELP — the beginners guide (2026-09-28), reached from the
// trustline banner's "NEW HERE? START HERE". Written so a 12-year-old can
// follow it: every word explained, then one step at a time from "get
// Xaman" to "buy your first NFT". Headings keep the site's !/0 style, the
// explanations stay plain English. Trustline buttons are plain links to
// /api/trustline, which opens the sign request in Xaman.

// Coins that can get a trustline from here, in the order people meet them.
// Label/thumb match COLLECTION_META in static.js; issuer + currency always
// come from TRADEABLE_COLLECTIONS so there's one source of truth.
const HELP_TOKENS = [
  { key: 'pigeons', label: '$P!GE0NS', thumb: '/assets/mainframe/pigeons-coin.webp', accent: '136,72,248' },
  { key: 'phnixs', label: '$PHN!X', thumb: '/assets/mainframe/phnix.jpeg?v=2', accent: '255,90,31' },
  { key: 'conspiracy', label: '$CNS', thumb: '/assets/mainframe/conspiracy.jpeg?v=2', accent: '240,0,228' },
  { key: 'teddybg', label: '$TEDDY', thumb: '/assets/mainframe/teddy.jpeg?v=2', accent: '166,99,46' },
  { key: 'seal', label: '$SEAL', thumb: '/assets/mainframe/seal.jpeg?v=2', accent: '45,140,168' },
  { key: 'fuzzy', label: '$FUZZY', thumb: '/assets/mainframe/fuzzy.jpeg?v=2', accent: '122,66,26' },
  { key: 'thirdeye', label: '$3RDEYE', thumb: '/assets/mainframe/thirdeye.webp?v=1', accent: '255,79,163' },
  { key: 'bear', label: '$BEAR', thumb: '/assets/mainframe/bear.webp?v=3', accent: '245,197,24' },
  { key: 'cult', label: '$CULT', thumb: '/assets/mainframe/cult.webp?v=1', accent: '34,197,94' },
  { key: 'smoki', label: '$SM0K!', thumb: '/assets/mainframe/smoki.webp?v=1', accent: '79,209,249' }
];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function tokenRowsHtml() {
  return HELP_TOKENS.map(t => {
    const cfg = TRADEABLE_COLLECTIONS[t.key];
    const tc = cfg && cfg.tokenConfig;
    if (!tc || !tc.configured || !tc.issuer) return '';
    const short = tc.issuer.slice(0, 6) + '…' + tc.issuer.slice(-4);
    return `<div class="tl-row" style="--acc:${t.accent}">
        <img class="tl-thumb" src="${esc(t.thumb)}" alt="" loading="lazy">
        <div class="tl-info">
          <div class="tl-name">${esc(t.label)}</div>
          <div class="tl-issuer">!SSUER <span class="mono">${esc(short)}</span></div>
        </div>
        <a class="btn btn-go tl-btn" href="/api/trustline?c=${encodeURIComponent(t.key)}" rel="nofollow">SET TRUSTL!NE</a>
      </div>`;
  }).join('');
}

function renderHelp(wallet) {
  const signedIn = !!wallet;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Σκύλλα://HELP</title>
<meta name="description" content="New to XRP, NFTs and meme coins? A step-by-step beginners guide: get Xaman, buy XRP, activate your wallet, set trustlines and buy your first NFT.">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  :root{
    --green:52,255,133; --cyan:61,243,236; --pink:255,63,208; --amber:255,176,0;
    --text:#fff; --dim:rgba(255,255,255,0.72); --faint:rgba(255,255,255,0.45);
  }
  *{ margin:0; padding:0; box-sizing:border-box; }
  html{ scroll-behavior:smooth; }
  html, body{ background:#000; }
  body{ font-family:'Chakra Petch',sans-serif; color:var(--text); min-height:100vh; font-size:16px; line-height:1.6; -webkit-text-size-adjust:100%; }
  canvas#staticCanvas{ position:fixed; inset:0; width:100%; height:100%; z-index:0; opacity:0.45; pointer-events:none; }
  a{ color:rgb(var(--cyan)); }
  .mono{ font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:0.92em; }

  /* Top bar: back link + progress, stays put while reading. */
  .topbar{ position:sticky; top:0; z-index:5; background:rgba(0,0,0,0.92); border-bottom:1px solid rgba(var(--cyan),0.35); box-shadow:0 0 14px rgba(var(--cyan),0.18); }
  .topbar-in{ max-width:820px; margin:0 auto; padding:0.6rem 16px; display:flex; align-items:center; gap:0.9rem; }
  .back{ color:#fff; text-decoration:none; font-size:13px; letter-spacing:0.08em; border:1px solid rgba(255,255,255,0.5); border-radius:8px; padding:0.35em 0.8em; white-space:nowrap; }
  .back:hover{ background:rgba(255,255,255,0.12); }
  .prog{ flex:1; min-width:0; }
  .prog-label{ font-size:11px; letter-spacing:0.14em; color:var(--dim); display:flex; justify-content:space-between; gap:0.5rem; }
  .prog-label b{ color:rgb(var(--green)); font-weight:600; }
  .prog-bar{ height:6px; border-radius:6px; background:rgba(255,255,255,0.12); margin-top:4px; overflow:hidden; }
  .prog-fill{ height:100%; width:0; background:rgb(var(--green)); box-shadow:0 0 10px rgba(var(--green),0.7); transition:width 0.35s ease; }

  .page{ position:relative; z-index:1; max-width:820px; margin:0 auto; padding:2.2rem 16px 5rem; }

  /* Hero */
  .eyebrow{ font-size:12px; letter-spacing:0.3em; color:rgb(var(--cyan)); text-shadow:0 0 8px rgba(var(--cyan),0.55); margin-bottom:0.6rem; }
  h1{ font-size:clamp(30px,6vw,52px); line-height:1.08; letter-spacing:0.03em; margin-bottom:0.9rem; text-shadow:0 0 18px rgba(var(--cyan),0.3); }
  .lead{ font-size:clamp(16px,2.4vw,19px); color:var(--dim); max-width:640px; }
  .chips{ display:flex; flex-wrap:wrap; gap:0.5rem; margin:1.2rem 0 1.6rem; }
  .chip{ font-size:12px; letter-spacing:0.08em; border:1px solid rgba(255,255,255,0.35); border-radius:999px; padding:0.3em 0.85em; background:#000; }
  .chip b{ color:rgb(var(--green)); font-weight:600; }

  /* Map of the page */
  .map{ display:grid; grid-template-columns:repeat(4,1fr); gap:0.6rem; }
  .map a{ display:block; text-decoration:none; color:#fff; background:#000; border:1px solid rgba(var(--cyan),0.55); border-radius:12px; padding:0.75rem 0.8rem; box-shadow:0 0 10px rgba(var(--cyan),0.15); transition:background 0.15s, box-shadow 0.15s; }
  .map a:hover{ background:rgba(var(--cyan),0.1); box-shadow:0 0 16px rgba(var(--cyan),0.35); }
  .map .n{ display:block; font-size:11px; letter-spacing:0.2em; color:rgb(var(--cyan)); }
  .map .t{ display:block; font-size:15px; font-weight:600; letter-spacing:0.04em; }
  .map .s{ display:block; font-size:12px; color:var(--faint); line-height:1.35; margin-top:0.15rem; }

  /* Sections */
  section{ margin-top:3.6rem; scroll-margin-top:70px; }
  .sec-head{ display:flex; align-items:baseline; gap:0.8rem; margin-bottom:0.4rem; }
  .sec-num{ font-size:13px; letter-spacing:0.2em; color:rgb(var(--cyan)); }
  h2{ font-size:clamp(24px,4.4vw,34px); letter-spacing:0.04em; line-height:1.15; }
  .sec-sub{ color:var(--dim); margin-bottom:1.3rem; max-width:640px; }

  /* Word cards */
  .words{ display:grid; grid-template-columns:repeat(2,1fr); gap:0.8rem; }
  .word{ background:#000; border:1px solid rgba(var(--cyan),0.45); border-radius:14px; padding:1rem 1.1rem; box-shadow:0 0 10px rgba(var(--cyan),0.12); }
  .word-top{ display:flex; align-items:center; gap:0.6rem; margin-bottom:0.35rem; }
  .word-ico{ font-size:24px; line-height:1; width:1.4em; text-align:center; flex:0 0 auto; }
  .word h3{ font-size:18px; letter-spacing:0.04em; }
  .word p{ color:var(--dim); font-size:15px; }
  .word .like{ margin-top:0.55rem; font-size:14px; color:#fff; border-left:3px solid rgba(var(--green),0.8); padding-left:0.6rem; }
  .word .like b{ color:rgb(var(--green)); font-weight:600; }
  .word.warn{ border-color:rgba(var(--pink),0.6); box-shadow:0 0 12px rgba(var(--pink),0.18); }
  .word.warn .like{ border-left-color:rgba(var(--pink),0.9); }
  .word.warn .like b{ color:rgb(var(--pink)); }

  /* Step cards */
  .steps{ display:flex; flex-direction:column; gap:1rem; }
  .step{ background:#000; border:1px solid rgba(255,255,255,0.28); border-radius:16px; padding:1.2rem 1.25rem 1.1rem; position:relative; scroll-margin-top:70px; transition:border-color 0.2s, box-shadow 0.2s; }
  .step.done{ border-color:rgba(var(--green),0.85); box-shadow:0 0 16px rgba(var(--green),0.22); }
  .step-head{ display:flex; align-items:center; gap:0.9rem; margin-bottom:0.7rem; }
  .step-num{ flex:0 0 auto; width:44px; height:44px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700; border:2px solid rgba(var(--cyan),0.8); color:rgb(var(--cyan)); box-shadow:0 0 12px rgba(var(--cyan),0.35); }
  .step.done .step-num{ border-color:rgb(var(--green)); background:rgb(var(--green)); color:#000; box-shadow:0 0 14px rgba(var(--green),0.6); }
  .step-title{ flex:1; min-width:0; }
  .step-title h3{ font-size:clamp(18px,3.2vw,22px); letter-spacing:0.04em; line-height:1.2; }
  .step-title .why{ font-size:14px; color:var(--faint); }
  .step ol, .step ul{ padding-left:1.35rem; margin:0.4rem 0 0.2rem; }
  .step li{ margin:0.35rem 0; color:var(--dim); }
  .step li b, .step p b{ color:#fff; font-weight:600; }
  .step p{ color:var(--dim); margin:0.4rem 0; }
  .note{ margin-top:0.8rem; border-radius:12px; padding:0.75rem 0.9rem; font-size:14.5px; background:#000; }
  .note .note-t{ display:block; font-size:12px; letter-spacing:0.16em; margin-bottom:0.2rem; font-weight:600; }
  .note.tip{ border:1px solid rgba(var(--green),0.6); }
  .note.tip .note-t{ color:rgb(var(--green)); }
  .note.stop{ border:1px solid rgba(var(--pink),0.7); box-shadow:0 0 12px rgba(var(--pink),0.15); }
  .note.stop .note-t{ color:rgb(var(--pink)); }
  .note.adult{ border:1px solid rgba(var(--amber),0.65); }
  .note.adult .note-t{ color:rgb(var(--amber)); }
  .step-foot{ display:flex; flex-wrap:wrap; align-items:center; gap:0.6rem; margin-top:1rem; }
  .btn{ display:inline-flex; align-items:center; justify-content:center; gap:0.4em; min-height:44px; padding:0 1.1em; border-radius:10px; font-family:inherit; font-size:14px; font-weight:600; letter-spacing:0.08em; text-decoration:none; cursor:pointer; background:#000; color:#fff; border:1px solid rgba(255,255,255,0.55); }
  .btn:hover{ background:rgba(255,255,255,0.1); }
  .btn-go{ border-color:rgba(var(--green),0.9); box-shadow:0 0 10px rgba(var(--green),0.3); }
  .btn-go:hover{ background:rgb(var(--green)); color:#000; }
  .done-btn{ margin-left:auto; border-color:rgba(255,255,255,0.35); color:var(--dim); }
  .step.done .done-btn{ border-color:rgb(var(--green)); color:rgb(var(--green)); }

  /* Secret numbers picture */
  .seed{ display:grid; grid-template-columns:repeat(4,1fr); gap:0.35rem; margin:0.7rem 0 0.2rem; max-width:420px; }
  .seed span{ font-family:ui-monospace,Menlo,Consolas,monospace; font-size:13px; text-align:center; border:1px dashed rgba(var(--pink),0.55); border-radius:6px; padding:0.25em 0; color:rgba(255,255,255,0.8); }
  .seed span i{ font-style:normal; color:rgb(var(--pink)); margin-right:0.25em; }

  /* Address example */
  .addr{ display:inline-block; font-family:ui-monospace,Menlo,Consolas,monospace; font-size:13.5px; border:1px solid rgba(var(--cyan),0.55); border-radius:8px; padding:0.25em 0.6em; margin:0.2rem 0; word-break:break-all; }
  .addr b{ color:rgb(var(--cyan)); }

  /* Reserve calculator */
  .calc{ margin-top:0.9rem; border:1px solid rgba(var(--cyan),0.55); border-radius:14px; padding:1rem; background:#000; }
  .calc-t{ font-size:12px; letter-spacing:0.18em; color:rgb(var(--cyan)); margin-bottom:0.6rem; }
  .calc-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:0.6rem; }
  .calc label{ display:block; font-size:13px; color:var(--dim); }
  .calc input{ width:100%; margin-top:0.25rem; background:#000; color:#fff; border:1px solid rgba(255,255,255,0.4); border-radius:8px; padding:0.55em 0.6em; font-family:inherit; font-size:17px; }
  .calc input:focus{ outline:none; border-color:rgb(var(--cyan)); box-shadow:0 0 8px rgba(var(--cyan),0.4); }
  .calc-out{ margin-top:0.9rem; display:flex; flex-wrap:wrap; align-items:baseline; gap:0.4rem 0.8rem; }
  .calc-big{ font-size:30px; font-weight:700; color:rgb(var(--green)); text-shadow:0 0 12px rgba(var(--green),0.5); }
  .calc-how{ font-size:13.5px; color:var(--faint); width:100%; }

  /* Reserve bar picture */
  .rbar{ display:flex; height:30px; border-radius:8px; overflow:hidden; margin:0.7rem 0 0.3rem; border:1px solid rgba(255,255,255,0.3); font-size:12px; font-weight:600; }
  .rbar div{ display:flex; align-items:center; justify-content:center; white-space:nowrap; overflow:hidden; }
  .rbar .rb-base{ flex:0 0 22%; background:rgba(var(--pink),0.35); }
  .rbar .rb-items{ flex:0 0 28%; background:rgba(var(--amber),0.3); }
  .rbar .rb-free{ flex:1; background:rgba(var(--green),0.25); }
  .rbar-key{ display:flex; flex-wrap:wrap; gap:0.3rem 1rem; font-size:13px; color:var(--faint); }

  /* Trustlines */
  .tl-list{ display:flex; flex-direction:column; gap:0.5rem; margin-top:0.8rem; }
  .tl-row{ display:flex; align-items:center; gap:0.8rem; background:#000; border:1px solid rgba(var(--acc),0.8); box-shadow:0 0 10px rgba(var(--acc),0.25); border-radius:12px; padding:0.55rem 0.7rem; }
  .tl-thumb{ width:44px; height:44px; border-radius:10px; object-fit:cover; flex:0 0 auto; background:#111; }
  .tl-info{ flex:1; min-width:0; }
  .tl-name{ font-size:16px; font-weight:600; letter-spacing:0.05em; }
  .tl-issuer{ font-size:12px; color:var(--faint); }
  .tl-btn{ flex:0 0 auto; min-height:40px; font-size:12.5px; }
  .flash{ margin-top:0.8rem; border-radius:12px; padding:0.75rem 0.9rem; font-weight:600; }
  .flash.ok{ border:1px solid rgb(var(--green)); color:rgb(var(--green)); }
  .flash.bad{ border:1px solid rgb(var(--pink)); color:rgb(var(--pink)); }

  /* Safety rules */
  .rules{ display:grid; grid-template-columns:repeat(2,1fr); gap:0.8rem; }
  .rule{ background:#000; border:1px solid rgba(var(--pink),0.6); border-radius:14px; padding:1rem 1.1rem; box-shadow:0 0 12px rgba(var(--pink),0.14); }
  .rule h3{ font-size:17px; letter-spacing:0.04em; margin-bottom:0.25rem; display:flex; gap:0.5rem; align-items:center; }
  .rule p{ color:var(--dim); font-size:15px; }

  /* Questions */
  .faq details{ background:#000; border:1px solid rgba(255,255,255,0.28); border-radius:12px; margin-bottom:0.55rem; }
  .faq details[open]{ border-color:rgba(var(--cyan),0.7); box-shadow:0 0 10px rgba(var(--cyan),0.18); }
  .faq summary{ cursor:pointer; list-style:none; padding:0.85rem 2.6rem 0.85rem 1rem; font-weight:600; letter-spacing:0.02em; position:relative; }
  .faq summary::-webkit-details-marker{ display:none; }
  .faq summary::after{ content:'+'; position:absolute; right:1rem; top:50%; transform:translateY(-50%); font-size:22px; color:rgb(var(--cyan)); }
  .faq details[open] summary::after{ content:'−'; }
  .faq .a{ padding:0 1rem 0.95rem; color:var(--dim); }

  .end{ margin-top:3.6rem; text-align:center; border:1px solid rgba(var(--green),0.7); border-radius:18px; padding:1.8rem 1rem; background:#000; box-shadow:0 0 18px rgba(var(--green),0.2); }
  .end h2{ margin-bottom:0.4rem; }
  .end p{ color:var(--dim); margin-bottom:1rem; }
  .fine{ margin-top:1.6rem; font-size:12.5px; color:var(--faint); text-align:center; }

  @media (max-width:640px){
    .page{ padding-top:1.6rem; }
    .map{ grid-template-columns:repeat(2,1fr); }
    .words, .rules{ grid-template-columns:1fr; }
    .calc-grid{ grid-template-columns:1fr; }
    .step{ padding:1rem 1rem 0.95rem; }
    .step-num{ width:38px; height:38px; font-size:17px; }
    .done-btn{ margin-left:0; width:100%; }
    .step-foot .btn-go{ width:100%; }
    .seed{ grid-template-columns:repeat(2,1fr); }
    .tl-issuer{ display:none; }
  }
</style>
</head>
<body>
<canvas id="staticCanvas"></canvas>

<div class="topbar"><div class="topbar-in">
  <a class="back" href="/static">&larr; Σκύλλα</a>
  <div class="prog">
    <div class="prog-label"><span>Y0UR PR0GRESS</span><span><b id="progCount">0</b> / <span id="progTotal">9</span> STEPS</span></div>
    <div class="prog-bar"><div class="prog-fill" id="progFill"></div></div>
  </div>
</div></div>

<main class="page">
  <div class="eyebrow">Σκύλλα://HELP · BEG!NNERS GU!DE</div>
  <h1>NEW HERE?<br>START HERE.</h1>
  <p class="lead">No experience needed. We explain every word first, then walk you through it one small step at a time — from getting a wallet to owning your first NFT. If you can use an app on a phone, you can do this.</p>
  <div class="chips">
    <span class="chip">⏱ ABOUT <b>20 M!NUTES</b></span>
    <span class="chip">📱 NEEDS A <b>PH0NE</b></span>
    <span class="chip">💧 START W!TH ABOUT <b>10+ XRP</b></span>
    ${signedIn ? '<span class="chip">✓ <b>S!GNED !N</b></span>' : ''}
  </div>

  <nav class="map">
    <a href="#words"><span class="n">PART 1</span><span class="t">THE W0RDS</span><span class="s">What NFTs, XRP, coins &amp; wallets are</span></a>
    <a href="#steps"><span class="n">PART 2</span><span class="t">STEP BY STEP</span><span class="s">Wallet → XRP → trustline → NFT</span></a>
    <a href="#safe"><span class="n">PART 3</span><span class="t">STAY SAFE</span><span class="s">6 rules that protect your stuff</span></a>
    <a href="#faq"><span class="n">PART 4</span><span class="t">QUEST!0NS</span><span class="s">Stuck? Look here</span></a>
  </nav>

  <!-- ============ PART 1 ============ -->
  <section id="words">
    <div class="sec-head"><span class="sec-num">PART 1</span></div>
    <h2>THE W0RDS Y0U'LL SEE</h2>
    <p class="sec-sub">Crypto has a lot of strange words. Here's what each one means, in plain English. You don't have to remember them all — come back here any time.</p>
    <div class="words">
      <div class="word">
        <div class="word-top"><span class="word-ico">🪙</span><h3>CRYPTO</h3></div>
        <p>Money that lives on the internet instead of in a bank. You keep it in an app on your phone and can send it to anyone in the world in seconds.</p>
        <div class="like"><b>Think of it like:</b> arcade tokens that work everywhere online.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">📒</span><h3>THE XRPL (XRP LEDGER)</h3></div>
        <p>A giant public notebook, copied onto thousands of computers around the world. Every payment and every NFT sale gets written in it, and nobody can rub anything out. Writing in it takes 3–5 seconds and costs a tiny fraction of a cent.</p>
        <div class="like"><b>Think of it like:</b> a class register everyone can read but nobody can cheat on.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">💧</span><h3>XRP</h3></div>
        <p>The main money of the XRP Ledger. You need a little XRP to do anything at all — it pays the tiny fees, and you use it to buy NFTs and coins.</p>
        <div class="like"><b>Think of it like:</b> the petrol that makes everything else move.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">👛</span><h3>WALLET + ADDRESS</h3></div>
        <p>A wallet is an app that holds your crypto and NFTs. It has an <b>address</b> — a long code starting with <span class="mono">r</span>. Your address is safe to share: people use it to send you things.</p>
        <div class="like"><b>Think of it like:</b> your address is your email address; your wallet is your inbox.</div>
      </div>
      <div class="word warn">
        <div class="word-top"><span class="word-ico">🔑</span><h3>SECRET NUMBERS</h3></div>
        <p>When you make a wallet you get a set of secret numbers (or words). They are the master key. <b>Anyone who has them can take everything</b> — and there's no bank to call to get it back.</p>
        <div class="like"><b>Rule:</b> write them on paper. Never type them into a website, never screenshot them, never tell anyone.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">📱</span><h3>XAMAN</h3></div>
        <p>The free wallet app this site uses, for iPhone and Android. (It used to be called XUMM.) Everything you do on Σκύλλα gets approved inside Xaman.</p>
        <div class="like"><b>Think of it like:</b> your bank card and PIN, but you're the bank.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">✍️</span><h3>S!GN!NG</h3></div>
        <p>Approving something in Xaman — you'll see what's about to happen, then slide to accept. <b>Nothing</b> leaves your wallet unless you sign. If something looks wrong, just press reject.</p>
        <div class="like"><b>Think of it like:</b> signing a permission slip. No signature, no trip.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">🖼️</span><h3>NFT</h3></div>
        <p>A one-of-a-kind digital item — usually a picture — with its own number. The ledger records who owns it, so it can't be copied or faked. You can collect, sell, or show it off.</p>
        <div class="like"><b>Think of it like:</b> a numbered trading card that lives in your wallet.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">🗂️</span><h3>COLLECT!0N + TRA!TS</h3></div>
        <p>A collection is a set of NFTs from the same creator, like P!GE0NS. Each one is made from different parts (hat, eyes, background…) called traits. Rare traits make an NFT rarer.</p>
        <div class="like"><b>Think of it like:</b> a sticker album where some stickers are shiny.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">🐸</span><h3>T0KENS + MEME C0!NS</h3></div>
        <p>Coins made by a community on the XRPL, like $P!GE0NS. Meme coins are for fun and community — their price can go up or down <b>a lot</b>, very fast. Collections here are bought and sold in their own coin or in XRP.</p>
        <div class="like"><b>Rule:</b> only ever use money you'd be okay losing.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">🤝</span><h3>TRUSTL!NE</h3></div>
        <p>Your wallet refuses every coin until you say "yes, I want to hold this one". That "yes" is a trustline. You set one per coin, once.</p>
        <div class="like"><b>Think of it like:</b> adding a new pocket to your backpack for one type of coin.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">🔒</span><h3>RESERVE</h3></div>
        <p>XRP the ledger keeps locked in your wallet as a small deposit: <b>1 XRP</b> to switch your wallet on, plus <b>0.2 XRP</b> for each extra thing it holds (each trustline, each page of NFTs, each open offer). You get the 0.2s back when you remove the thing.</p>
        <div class="like"><b>Think of it like:</b> the deposit on a locker — you get it back when you empty it.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">🏷️</span><h3>!SSUER</h3></div>
        <p>The wallet that created a coin. Fake coins copy popular names, so the issuer address is how you know it's the real one. The buttons on this page always use the real issuer.</p>
        <div class="like"><b>Think of it like:</b> the brand label that proves trainers aren't fake.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">📉</span><h3>FL00R, L!ST!NG, 0FFER</h3></div>
        <p>A <b>listing</b> is the seller's price tag. The <b>floor</b> is the cheapest listing in a collection. An <b>offer</b> is you suggesting your own price — the owner can accept it or ignore it.</p>
        <div class="like"><b>Think of it like:</b> a price tag vs. asking "would you take less?"</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">🔄</span><h3>SWAP</h3></div>
        <p>Trading one coin for another, right from your wallet — for example XRP for $P!GE0NS. The price comes from a shared pool of coins on the ledger.</p>
        <div class="like"><b>Think of it like:</b> a currency exchange booth at the airport.</div>
      </div>
      <div class="word">
        <div class="word-top"><span class="word-ico">🎒</span><h3>SATCHEL</h3></div>
        <p>Your shopping bag on Σκύλλα. Add as many NFTs as you like (buys and offers), then sign for them all in one go. You can fill it before you've even signed in.</p>
        <div class="like"><b>Think of it like:</b> a basket at the shops — you pay at the till.</div>
      </div>
    </div>
  </section>

  <!-- ============ PART 2 ============ -->
  <section id="steps">
    <div class="sec-head"><span class="sec-num">PART 2</span></div>
    <h2>STEP BY STEP</h2>
    <p class="sec-sub">Do these in order. Tap <b>I D!D TH!S</b> on each one as you go — your progress bar at the top fills up (it's saved on this device).</p>

    <div class="note adult" style="margin:0 0 1rem;"><span class="note-t">UNDER 18?</span>Buying crypto needs an adult — apps that sell XRP only allow over-18s. Do steps 1 and 2 yourself, then ask a parent or guardian to help with step 3.</div>

    <div class="steps">

      <div class="step" id="step-xaman" data-step="xaman">
        <div class="step-head"><div class="step-num">1</div><div class="step-title"><h3>GET THE XAMAN APP</h3><div class="why">Your wallet — where your XRP, coins and NFTs live.</div></div></div>
        <ol>
          <li>On your phone, open the <b>App Store</b> (iPhone) or <b>Google Play</b> (Android) and search <b>"Xaman"</b>. It's free. Check the maker is <b>XRPL Labs</b>.</li>
          <li>Open it and choose to <b>add an account</b>, then <b>create a new account</b> (the exact words can change a little between versions).</li>
          <li>Xaman shows your <b>secret numbers</b> — rows of numbers like the picture below. <b>Write every row on paper, in order.</b></li>
          <li>Xaman asks you to type some of them back to check you wrote them right.</li>
          <li>Pick a passcode (and Face ID / fingerprint if you like). Done — you have a wallet!</li>
        </ol>
        <div class="seed" aria-hidden="true">
          <span><i>A</i>••••••</span><span><i>B</i>••••••</span><span><i>C</i>••••••</span><span><i>D</i>••••••</span>
          <span><i>E</i>••••••</span><span><i>F</i>••••••</span><span><i>G</i>••••••</span><span><i>H</i>••••••</span>
        </div>
        <div class="note stop"><span class="note-t">⚠ NEVER SHARE THESE</span>Nobody from Σκύλλα or Xaman will <b>ever</b> ask for your secret numbers. Anyone who asks is trying to steal from you. Keep the paper somewhere safe — if you lose your phone <b>and</b> the paper, your wallet is gone forever.</div>
        <div class="step-foot">
          <a class="btn btn-go" href="https://xaman.app" target="_blank" rel="noopener">GET XAMAN ↗</a>
          <button type="button" class="btn done-btn" data-done="xaman">I D!D TH!S</button>
        </div>
      </div>

      <div class="step" id="step-address" data-step="address">
        <div class="step-head"><div class="step-num">2</div><div class="step-title"><h3>F!ND Y0UR ADDRESS</h3><div class="why">So XRP can be sent to you.</div></div></div>
        <ol>
          <li>In Xaman, go to the <b>Home</b> screen. Your account and its address are at the top.</li>
          <li>Tap <b>Request</b> (or <b>Receive</b>) to see your address as text and as a QR code.</li>
          <li>It looks something like this — always starts with <b>r</b>, about 34 letters and numbers:</li>
        </ol>
        <p><span class="addr"><b>r</b>YourAddressLooksLikeThis7kQ2mZp</span> <span style="font-size:13px;color:var(--faint);">(made-up example)</span></p>
        <div class="note tip"><span class="note-t">TIP</span>Never type your address by hand. Always copy and paste it, or scan the QR code — one wrong letter sends XRP to someone else.</div>
        <div class="step-foot"><button type="button" class="btn done-btn" data-done="address">I D!D TH!S</button></div>
      </div>

      <div class="step" id="step-buy" data-step="buy">
        <div class="step-head"><div class="step-num">3</div><div class="step-title"><h3>BUY S0ME XRP</h3><div class="why">You need XRP to switch your wallet on and to buy things.</div></div></div>
        <p><b>How much?</b> Start with at least <b>10 XRP</b>. That covers switching your wallet on (1 XRP), a couple of trustlines, and a little to spend. More if you want to buy an NFT straight away — check its price first.</p>
        <p><b>Option A — inside Xaman (easiest):</b></p>
        <ol>
          <li>In many countries you can buy XRP right inside Xaman with a card. Look for <b>Buy</b> on the Home screen or in the <b>xApps</b> section.</li>
          <li>Follow the steps. The XRP arrives straight in your wallet.</li>
        </ol>
        <p><b>Option B — from a crypto app that sells XRP:</b></p>
        <ol>
          <li>Buy XRP in that app.</li>
          <li>Choose <b>Send</b> or <b>Withdraw</b>, pick XRP, and paste <b>your Xaman address</b> from step 2.</li>
          <li>If it asks for a <b>destination tag</b>, leave it empty — your own Xaman wallet doesn't need one.</li>
          <li>Send a <b>small test amount first</b>. When it arrives, send the rest.</li>
        </ol>
        <div class="note tip"><span class="note-t">TIP</span>Some apps hold new purchases for a while before you're allowed to send them out. That's normal — just wait.</div>
        <div class="step-foot"><button type="button" class="btn done-btn" data-done="buy">I D!D TH!S</button></div>
      </div>

      <div class="step" id="step-activate" data-step="activate">
        <div class="step-head"><div class="step-num">4</div><div class="step-title"><h3>ACT!VATE Y0UR WALLET</h3><div class="why">A new wallet stays "off" until it gets its first XRP.</div></div></div>
        <ol>
          <li>Until XRP arrives, Xaman says your account is <b>not activated</b>. That's normal.</li>
          <li>The first time <b>1 XRP or more</b> lands in your wallet, it switches on automatically. You don't have to do anything.</li>
          <li>That first <b>1 XRP stays locked</b> as your wallet's deposit (the reserve). The rest is yours to spend.</li>
          <li>Check Xaman's Home screen — you should now see your XRP balance.</li>
        </ol>
        <div class="note tip"><span class="note-t">WHY?</span>The deposit stops people filling the ledger with millions of empty junk wallets. It's the same for everyone.</div>
        <div class="step-foot"><button type="button" class="btn done-btn" data-done="activate">I D!D TH!S</button></div>
      </div>

      <div class="step" id="step-reserve" data-step="reserve">
        <div class="step-head"><div class="step-num">5</div><div class="step-title"><h3>KNOW Y0UR RESERVE</h3><div class="why">Why some of your XRP is "locked", and how much to keep spare for NFTs.</div></div></div>
        <p>Your XRP is split into two parts: the <b>locked</b> part (the reserve) and the <b>spendable</b> part. You can only spend the spendable part.</p>
        <div class="rbar" aria-hidden="true"><div class="rb-base">1 XRP</div><div class="rb-items">+0.2 EACH</div><div class="rb-free">SPENDABLE</div></div>
        <div class="rbar-key"><span>🟥 Wallet switched on: 1 XRP</span><span>🟧 Each trustline / NFT page / open offer: 0.2 XRP</span><span>🟩 Yours to spend</span></div>
        <ul>
          <li><b>Each trustline</b> (each coin you can hold): 0.2 XRP.</li>
          <li><b>NFTs</b> are kept in "pages" of up to 32. Each page is 0.2 XRP. To be safe, plan <b>0.2 XRP for every 16 NFTs</b>.</li>
          <li><b>Each offer or listing</b> you have open: 0.2 XRP, given back when it's accepted or cancelled.</li>
        </ul>
        <div class="calc">
          <div class="calc-t">RESERVE CALCULAT0R</div>
          <div class="calc-grid">
            <label>Coins you'll hold<input type="number" inputmode="numeric" min="0" max="999" value="2" id="cCoins"></label>
            <label>NFTs you'll own<input type="number" inputmode="numeric" min="0" max="9999" value="5" id="cNfts"></label>
            <label>Open offers / listings<input type="number" inputmode="numeric" min="0" max="999" value="1" id="cOffers"></label>
          </div>
          <div class="calc-out"><span style="color:var(--dim);">Keep locked:</span><span class="calc-big" id="cTotal">2 XRP</span></div>
          <div class="calc-how" id="cHow"></div>
        </div>
        <div class="note tip"><span class="note-t">TIP</span>Always keep <b>1–2 XRP extra</b> on top of this. If an NFT buy or swap fails with "not enough XRP", this is almost always why.</div>
        <div class="step-foot"><button type="button" class="btn done-btn" data-done="reserve">I G0T !T</button></div>
      </div>

      <div class="step" id="step-signin" data-step="signin">
        <div class="step-head"><div class="step-num">6</div><div class="step-title"><h3>S!GN !N T0 Σκύλλα</h3><div class="why">Connects your wallet so the site can show your coins and NFTs.</div></div></div>
        <ol>
          <li>Open Σκύλλα and tap <b>L0G!N</b> (or <b>C0NNECT</b>).</li>
          <li><b>On a phone:</b> Xaman opens by itself. <b>On a computer:</b> a QR code appears — open Xaman, tap the scan button, and point your camera at it.</li>
          <li>Xaman shows a <b>sign in</b> request. Slide to accept.</li>
          <li>You're back on Σκύλλα, signed in. Your balance shows at the top.</li>
        </ol>
        <div class="note tip"><span class="note-t">GOOD TO KNOW</span>Signing in costs nothing and moves no money. It just proves the wallet is yours. Xaman asks you to sign in again once a day to keep you safe.</div>
        <div class="step-foot">
          <a class="btn btn-go" href="/static">${signedIn ? 'OPEN Σκύλλα' : 'S!GN !N ON Σκύλλα'}</a>
          <button type="button" class="btn done-btn" data-done="signin">I D!D TH!S</button>
        </div>
      </div>

      <div class="step" id="step-trust" data-step="trust">
        <div class="step-head"><div class="step-num">7</div><div class="step-title"><h3>SET A TRUSTL!NE</h3><div class="why">Lets your wallet hold a collection's coin (you need it to buy NFTs priced in that coin).</div></div></div>
        <ol>
          <li>Pick the coin below and tap <b>SET TRUSTL!NE</b>. On a phone Xaman opens; on a computer, scan the QR.</li>
          <li>Xaman shows a <b>TrustSet</b> request. Check the issuer starts with the same letters as the one shown here.</li>
          <li>Slide to accept. That's it — your wallet can now hold that coin. It locks 0.2 XRP.</li>
        </ol>
        <div id="trustFlash"></div>
        <div class="tl-list">${tokenRowsHtml()}</div>
        <div class="note tip"><span class="note-t">ONLY WANT XRP?</span>Some collections (like K!NG) are bought with XRP only — no trustline needed. You can also buy most NFTs with XRP instead of the coin.</div>
        <div class="step-foot"><button type="button" class="btn done-btn" data-done="trust">I D!D TH!S</button></div>
      </div>

      <div class="step" id="step-swap" data-step="swap">
        <div class="step-head"><div class="step-num">8</div><div class="step-title"><h3>GET S0ME C0!NS (SWAP)</h3><div class="why">Optional — only if you want to buy with a collection's coin.</div></div></div>
        <ol>
          <li>On Σκύλλα, open a collection (for example P!GE0NS).</li>
          <li>Tap the coin picture or <b>SWAP</b> at the top.</li>
          <li>Type how much XRP you want to spend. You'll see how many coins you'll get.</li>
          <li>Tap the button and sign in Xaman. The coins land in your wallet in a few seconds.</li>
        </ol>
        <div class="note stop"><span class="note-t">REMEMBER</span>Coin prices move up and down quickly. Don't swap more than you're happy to lose.</div>
        <div class="step-foot">
          <a class="btn btn-go" href="/pigeons">OPEN P!GE0NS</a>
          <button type="button" class="btn done-btn" data-done="swap">I D!D TH!S</button>
        </div>
      </div>

      <div class="step" id="step-nft" data-step="nft">
        <div class="step-head"><div class="step-num">9</div><div class="step-title"><h3>BUY Y0UR F!RST NFT</h3><div class="why">The fun part.</div></div></div>
        <ol>
          <li>Open a collection and browse. Use <b>S0RT BY</b> (cheapest first) and <b>F!LTER</b> (pick traits you like).</li>
          <li>Found one? You have three choices:
            <ul>
              <li><b>BUY N0W</b> — pay the price shown, it's yours straight away.</li>
              <li><b>🎒 ADD T0 SATCHEL</b> — collect a few, then sign for them all together.</li>
              <li><b>0FFER</b> — suggest your own price. The owner decides.</li>
            </ul>
          </li>
          <li>Sign in Xaman. When it's done, the NFT shows up under <b>MY NFTS</b> on Σκύλλα and in Xaman.</li>
        </ol>
        <div class="note tip"><span class="note-t">TIP</span>The price on BUY N0W plus a small Σκύλλα fee (1.23% in XRP, 1.023% in a coin) is everything you pay — the satchel shows the full total before you sign.</div>
        <div class="step-foot">
          <a class="btn btn-go" href="/static">BR0WSE C0LLECT!0NS</a>
          <button type="button" class="btn done-btn" data-done="nft">I D!D TH!S</button>
        </div>
      </div>

    </div>
  </section>

  <!-- ============ PART 3 ============ -->
  <section id="safe">
    <div class="sec-head"><span class="sec-num">PART 3</span></div>
    <h2>STAY SAFE — 6 RULES</h2>
    <p class="sec-sub">Crypto has no "undo" button and no bank to call. These rules keep your stuff yours.</p>
    <div class="rules">
      <div class="rule"><h3>🔑 SECRET = SECRET</h3><p>Never share your secret numbers. Not with friends, not with "support", not with Σκύλλα. Real helpers never need them.</p></div>
      <div class="rule"><h3>👀 READ BEFORE Y0U S!GN</h3><p>Xaman shows exactly what you're approving. If it's not what you expected, press reject. Nothing happens without your signature.</p></div>
      <div class="rule"><h3>🏷️ CHECK THE !SSUER</h3><p>Fake coins copy real names. Use the buttons on this page or Σκύλλα's own SET button — they always point at the real issuer.</p></div>
      <div class="rule"><h3>🚫 N0 FREE M0NEY</h3><p>"Send 10 XRP, get 20 back", surprise giveaways, strangers messaging you first to "help" — these are always scams.</p></div>
      <div class="rule"><h3>🎢 0NLY SPEND WHAT Y0U CAN L0SE</h3><p>NFT and meme coin prices can drop to almost nothing. Treat it like spending money on a game, not like a savings account.</p></div>
      <div class="rule"><h3>📝 BACK UP 0N PAPER</h3><p>Keep your secret numbers on paper somewhere safe at home. New phone? You'll use them to get your wallet back.</p></div>
    </div>
  </section>

  <!-- ============ PART 4 ============ -->
  <section id="faq" class="faq">
    <div class="sec-head"><span class="sec-num">PART 4</span></div>
    <h2>QUEST!0NS</h2>
    <p class="sec-sub">Tap a question to see the answer.</p>
    <details><summary>Why is some of my XRP "locked" and I can't spend it?</summary><div class="a">That's the reserve (step 5): 1 XRP to keep your wallet switched on, plus 0.2 XRP for every trustline, NFT page and open offer. It's still yours — you get the 0.2s back when you remove those things.</div></details>
    <details><summary>Can I get my reserve back?</summary><div class="a">Mostly, yes. Cancel an offer and its 0.2 XRP comes back. Remove a trustline (only possible when you hold 0 of that coin) and its 0.2 XRP comes back. Sell or send away NFTs and empty pages give theirs back. The first 1 XRP stays locked as long as the wallet exists.</div></details>
    <details><summary>Why do I need XRP if I'm buying with a coin like $P!GE0NS?</summary><div class="a">Every action on the ledger needs a tiny fee paid in XRP (far less than a cent), and your reserve is in XRP too. Always keep a couple of spare XRP.</div></details>
    <details><summary>I sent XRP from an app but it's not in Xaman.</summary><div class="a">First check you pasted the right address (starts with r). Some apps take a while to process withdrawals — check the app's history for a "completed" status. If your wallet is new, you needed to send at least 1 XRP for it to switch on.</div></details>
    <details><summary>I signed in Xaman but nothing happened on the site.</summary><div class="a">Wait about 10 seconds — the ledger needs a moment. If it still looks stuck, refresh the page. Your Xaman <b>Events</b> list shows whether the signature went through.</div></details>
    <details><summary>It says I don't have enough XRP, but I do.</summary><div class="a">Your spendable XRP is your balance minus the reserve (step 5). The reserve calculator shows how much is locked. Add a couple of XRP and try again.</div></details>
    <details><summary>What's the difference between BUY N0W and 0FFER?</summary><div class="a">BUY N0W pays the seller's price and the NFT is yours right away. 0FFER suggests your own price — the owner can accept it any time before it runs out, or ignore it. An open offer locks 0.2 XRP until it's accepted or cancelled.</div></details>
    <details><summary>Do I have to sign in to fill my satchel?</summary><div class="a">No. Add as many NFTs as you like while signed out. When you're ready, the satchel button says <b>S!GN !N T0 C0MPLETE S!GNATURES</b> — sign in and your satchel is waiting for you.</div></details>
    <details><summary>I lost my phone. Is my stuff gone?</summary><div class="a">Not if you have your secret numbers on paper. Install Xaman on a new phone, choose to <b>import an existing account</b>, and type in your secret numbers. Everything comes back — it lives on the ledger, not on the phone.</div></details>
    <details><summary>Is this financial advice?</summary><div class="a">No. This page explains how things work. What you buy, and how much, is always your own choice.</div></details>
  </section>

  <div class="end">
    <h2>Y0U'RE READY.</h2>
    <p>That's everything. Go have a look around — and come back here any time you're stuck.</p>
    <a class="btn btn-go" href="/static">ENTER Σκύλλα →</a>
  </div>
  <p class="fine">Nobody from Σκύλλα will ever message you first or ask for your secret numbers.</p>
</main>

<script>
(function(){
  // Same cyan/pink static as the rest of the site.
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

  // Progress: which steps are ticked, kept in this browser only.
  var KEY = 'scylla_help_done';
  var SIGNED_IN = ${signedIn ? 'true' : 'false'};
  var done = {};
  try { done = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e){ done = {}; }
  // Signed in means the wallet exists, has an address, has XRP and is on.
  if (SIGNED_IN){ ['xaman', 'address', 'buy', 'activate', 'signin'].forEach(function(k){ done[k] = true; }); }
  var steps = Array.prototype.slice.call(document.querySelectorAll('.step[data-step]'));
  document.getElementById('progTotal').textContent = steps.length;
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e){} }
  function paint(){
    var n = 0;
    steps.forEach(function(s){
      var k = s.getAttribute('data-step');
      var on = !!done[k];
      if (on) n++;
      s.classList.toggle('done', on);
      var b = s.querySelector('.done-btn');
      if (b) b.textContent = on ? '✓ D0NE' : (k === 'reserve' ? 'I G0T !T' : 'I D!D TH!S');
    });
    document.getElementById('progCount').textContent = n;
    document.getElementById('progFill').style.width = Math.round(n / steps.length * 100) + '%';
  }
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-done]');
    if (!b) return;
    var k = b.getAttribute('data-done');
    done[k] = !done[k];
    save();
    paint();
    if (done[k]){
      var i = steps.findIndex(function(s){ return s.getAttribute('data-step') === k; });
      var next = steps[i + 1];
      if (next && !done[next.getAttribute('data-step')]) next.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  paint();

  // Back from Xaman after SET TRUSTL!NE.
  var q = new URLSearchParams(location.search);
  var trust = q.get('trust');
  var flash = document.getElementById('trustFlash');
  if (trust === 'done'){
    flash.className = 'flash ok';
    flash.textContent = '✓ SENT T0 XAMAN — once you slid to accept, the trustline is set. You can check it in Xaman or on Σκύλλα.';
    done.trust = true; save(); paint();
  } else if (trust === 'failed'){
    flash.className = 'flash bad';
    flash.textContent = 'C0ULDN\\'T CREATE THE REQUEST — please try again in a moment.';
  }

  // Reserve calculator: 1 + 0.2 x (coins + NFT pages + offers), one page per 16 NFTs.
  var cc = document.getElementById('cCoins'), cn = document.getElementById('cNfts'), co = document.getElementById('cOffers');
  function num(el){ var v = parseInt(el.value, 10); return isFinite(v) && v > 0 ? Math.min(v, 99999) : 0; }
  function fmt(x){ return (Math.round(x * 10) / 10).toString(); }
  function calc(){
    var coins = num(cc), nfts = num(cn), offers = num(co);
    var pages = Math.ceil(nfts / 16);
    var total = 1 + 0.2 * (coins + pages + offers);
    document.getElementById('cTotal').textContent = fmt(total) + ' XRP';
    document.getElementById('cHow').textContent = '1 (wallet on) + 0.2 × ' + coins + ' coin' + (coins === 1 ? '' : 's') +
      ' + 0.2 × ' + pages + ' NFT page' + (pages === 1 ? '' : 's') + ' + 0.2 × ' + offers + ' offer' + (offers === 1 ? '' : 's') +
      '. Keep 1–2 XRP more on top for fees.';
  }
  [cc, cn, co].forEach(function(el){ el.addEventListener('input', calc); });
  calc();
})();
</script>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  let wallet = null;
  const token = getCookie(request, BOARD_COOKIE_NAME);
  if (token && env.Σκύλλα) {
    const payload = await verifyToken(token, env.Σκύλλα).catch(() => null);
    if (payload && payload.acct) wallet = payload.acct;
  }
  return new Response(renderHelp(wallet), { headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store' } });
}
