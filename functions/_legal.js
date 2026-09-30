// /support, /privacy and /terms (2026-09-30) — added for Xaman's push
// notification API review, which requires a site to link Support, Privacy
// Policy and Terms of Service. One shared page shell; each route file just
// picks its content.
//
// SUPPORT_X_HANDLE: the site's own X account, without the @. Empty = the X
// line is left off /support entirely (a dead X link is one of the things
// the Xaman review flagged). Set it once the account exists, and use the
// same handle in the Xaman Developer Console.
export const SUPPORT_EMAIL = 'soitbegins@protonmail.com';
export const SUPPORT_X_HANDLE = '';
const UPDATED = '30 September 2026';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const MAIL = `<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`;

function xLine() {
  if (!SUPPORT_X_HANDLE) return '';
  const h = esc(SUPPORT_X_HANDLE);
  return `<li><b>X:</b> <a href="https://x.com/${encodeURIComponent(SUPPORT_X_HANDLE)}" target="_blank" rel="noopener">@${h}</a> — DMs open.</li>`;
}

const SEED_WARNING = `<div class="warn"><b>We will never ask for your secret key, family seed or recovery words.</b> Every transaction is signed by you in the Xaman app.</div>`;

// Kept deliberately short: only what the site actually does today.
const PAGES = {
  support: {
    title: 'SUPP0RT',
    desc: 'How to get help with soitbegins.xyz.',
    body: () => `
${SEED_WARNING}
<h2>C0NTACT</h2>
<ul>
  <li><b>Email:</b> ${MAIL}</li>
  ${xLine()}
</ul>
<p>Please include your public wallet address (starts with <span class="mono">r</span>) and, if there is one, the transaction hash.</p>
<p>New to XRP or NFTs? See the <a href="/help">beginners guide</a>.</p>`
  },

  privacy: {
    title: 'PR!VACY P0L!CY',
    desc: 'What soitbegins.xyz stores and why.',
    body: () => `
${SEED_WARNING}
<h2>WHAT WE ST0RE</h2>
<ul>
  <li>Your public wallet address, when you sign in with Xaman.</li>
  <li>A cookie that keeps you signed in.</li>
  <li>Profile details you choose to add.</li>
  <li>Your notification settings, if you turn notifications on.</li>
  <li>Listings, offers and sales made through the site.</li>
</ul>
<p>We don't sell your data and don't use advertising or tracking cookies.</p>
<h2>SERV!CES WE USE</h2>
<p>Xaman (sign-in and signing transactions) and Cloudflare (hosting).</p>
<h2>THE BL0CKCHA!N</h2>
<p>XRP Ledger transactions are public and permanent. We can't change or delete them.</p>
<h2>C0NTACT</h2>
<p>To see or delete what we store about your wallet, email ${MAIL}.</p>`
  },

  terms: {
    title: 'TERMS 0F SERV!CE',
    desc: 'The terms for using soitbegins.xyz.',
    body: () => `
${SEED_WARNING}
<p>By using soitbegins.xyz you agree to these terms.</p>
<h2>THE S!TE</h2>
<p>soitbegins.xyz lets you view and trade NFTs and tokens on the XRP Ledger. We never hold your funds, NFTs or keys — you sign every transaction yourself in Xaman.</p>
<h2>FEES</h2>
<p>Purchases include a marketplace fee (1.23% in XRP, 1.023% in a token), shown before you sign. NFT royalties and XRP Ledger network fees may also apply.</p>
<h2>R!SKS</h2>
<ul>
  <li>Crypto and NFT prices can go up or down, and can fall to zero.</li>
  <li>XRP Ledger transactions are final and can't be reversed.</li>
  <li>Information on the site may be delayed or wrong. Nothing here is financial advice.</li>
</ul>
<h2>L!AB!L!TY</h2>
<p>The site is provided as is. To the extent the law allows, we aren't responsible for losses from using it. These terms are governed by the laws of Australia.</p>
<h2>C0NTACT</h2>
<p>${MAIL}</p>`
  }
};

// Shared footer links, reused by other pages so they all point at the
// same three routes.
export const LEGAL_LINKS_HTML = '<a href="/support">SUPP0RT</a><a href="/privacy">PR!VACY</a><a href="/terms">TERMS</a>';

export function legalResponse(key) {
  const p = PAGES[key];
  const tabs = { support: 'SUPP0RT', privacy: 'PR!VACY', terms: 'TERMS' };
  const nav = Object.keys(tabs)
    .map(k => `<a href="/${k}"${k === key ? ' class="on" aria-current="page"' : ''}>${tabs[k]}</a>`).join('');
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Σκύλλα://${esc(p.title)}</title>
<meta name="description" content="${esc(p.desc)}">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&display=swap');
  :root{ --green:52,255,133; --cyan:61,243,236; --pink:255,63,208; --amber:255,176,0; --text:#fff; --dim:rgba(255,255,255,0.78); --faint:rgba(255,255,255,0.5); }
  *{ margin:0; padding:0; box-sizing:border-box; }
  html, body{ background:#000; }
  body{ font-family:'Chakra Petch',sans-serif; color:var(--text); min-height:100vh; font-size:16px; line-height:1.65; -webkit-text-size-adjust:100%; }
  a{ color:rgb(var(--cyan)); }
  .mono{ font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
  .topbar{ position:sticky; top:0; z-index:5; background:rgba(0,0,0,0.94); border-bottom:1px solid rgba(var(--cyan),0.35); }
  .topbar-in{ max-width:780px; margin:0 auto; padding:0.6rem 16px; display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; }
  .home{ color:#fff; text-decoration:none; font-size:13px; letter-spacing:0.08em; border:1px solid rgba(255,255,255,0.5); border-radius:8px; padding:0.3em 0.75em; margin-right:auto; }
  .tabs{ display:flex; gap:0.4rem; flex-wrap:wrap; }
  .tabs a{ font-size:12px; letter-spacing:0.08em; text-decoration:none; color:var(--dim); border:1px solid rgba(255,255,255,0.25); border-radius:999px; padding:0.25em 0.7em; }
  .tabs a.on{ color:#000; background:rgb(var(--cyan)); border-color:rgb(var(--cyan)); }
  main{ max-width:780px; margin:0 auto; padding:2rem 16px 3rem; }
  h1{ font-size:clamp(28px,6vw,44px); line-height:1.1; letter-spacing:0.03em; text-shadow:0 0 18px rgba(var(--cyan),0.3); }
  .updated{ font-size:12px; letter-spacing:0.12em; color:var(--faint); margin:0.4rem 0 1.4rem; }
  h2{ font-size:20px; letter-spacing:0.06em; color:rgb(var(--cyan)); margin:2rem 0 0.6rem; }
  p{ color:var(--dim); margin-bottom:0.8rem; }
  p b, li b{ color:#fff; }
  ul{ padding-left:1.2rem; margin-bottom:0.8rem; }
  li{ color:var(--dim); margin-bottom:0.5rem; }
  .warn{ border:1px solid rgba(var(--amber),0.7); background:rgba(var(--amber),0.08); border-radius:10px; padding:0.9rem 1rem; color:var(--dim); margin:1rem 0; }
  .warn b{ color:rgb(var(--amber)); }
  footer{ border-top:1px solid rgba(255,255,255,0.15); max-width:780px; margin:0 auto; padding:1.2rem 16px 2rem; font-size:13px; color:var(--faint); }
</style>
</head>
<body>
<div class="topbar"><div class="topbar-in">
  <a class="home" href="/static">← Σκύλλα</a>
  <nav class="tabs">${nav}</nav>
</div></div>
<main>
  <h1>${esc(p.title)}</h1>
  <div class="updated">LAST UPDATED ${UPDATED}</div>
  ${p.body()}
</main>
<footer>soitbegins.xyz · ${MAIL}</footer>
</body>
</html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'public, max-age=300' } });
}
