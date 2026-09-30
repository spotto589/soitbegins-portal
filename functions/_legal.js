// /support, /privacy and /terms (2026-09-30) — added for Xaman's push
// notification API review, which requires a site to link Support, Privacy
// Policy and Terms of Service. One shared page shell; each route file just
// picks its content. Headings keep the site's !/0 style, the body text
// stays plain English so it reads as a real policy.
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

// The "never share your secret" warning, shown on all three pages.
const SEED_WARNING = `<div class="warn"><b>Σκύλλα will never ask for your secret key, family seed, secret numbers or recovery words.</b> Every transaction is signed inside the Xaman app on your own phone. Anyone who asks you for these — on this site, in a DM, or claiming to be support — is trying to steal your wallet.</div>`;

const PAGES = {
  support: {
    title: 'SUPP0RT',
    desc: 'How to get help with soitbegins.xyz and Σκύλλα.',
    body: () => `
<p class="lead">Stuck, found a bug, or something on the ledger isn't showing up? Get in touch.</p>
${SEED_WARNING}
<h2>C0NTACT</h2>
<ul>
  <li><b>Email:</b> ${MAIL} — we aim to reply within a few days.</li>
  ${xLine()}
</ul>
<p>To help us sort it out fast, include your <b>public</b> wallet address (starts with <span class="mono">r</span>), the page you were on, and the transaction hash if there is one. Never send your secret key or recovery words.</p>

<h2>BEF0RE Y0U ASK</h2>
<ul>
  <li><b>New to XRP, NFTs or trustlines?</b> The <a href="/help">beginners guide</a> walks through everything step by step.</li>
  <li><b>A purchase or listing isn't showing?</b> Check the transaction in Xaman first. If it succeeded there, it's on the ledger — the site can take a minute to catch up.</li>
  <li><b>Signing in keeps failing?</b> Make sure Xaman is up to date, then try again from a regular browser tab.</li>
</ul>

<h2>WHAT WE CAN'T D0</h2>
<p>XRP Ledger transactions are final. We can't reverse a purchase, recover a lost wallet, or move anything out of your wallet — we never have access to it.</p>
<p>Privacy requests (see what we store, correct it, or delete it) go to the same email — see the <a href="/privacy">Privacy Policy</a>.</p>`
  },

  privacy: {
    title: 'PR!VACY P0L!CY',
    desc: 'What soitbegins.xyz collects, why, and how to have it deleted.',
    body: () => `
<p class="lead">soitbegins.xyz ("Σκύλλα", "we") keeps as little about you as it can. No ads, no tracking scripts, and we never sell your data.</p>
${SEED_WARNING}

<h2>WHAT WE C0LLECT</h2>
<ul>
  <li><b>Your public wallet address.</b> When you sign in with Xaman, Xaman tells us which XRP Ledger address you signed in with. We never receive your secret key.</li>
  <li><b>A sign-in cookie.</b> One secure, http-only cookie keeps you signed in (up to 90 days, or until you sign out). Short-lived cookies (30 minutes) are used for a few gated pages. No tracking or advertising cookies.</li>
  <li><b>Your profile, if you set one up.</b> Username, profile picture and banner (chosen from NFTs you own), bio quote, X handle, theme, showcase NFTs, and whether your profile is public or private. All optional.</li>
  <li><b>Messages.</b> Direct messages, group chats and saved contacts (with any nicknames you give them) are stored so they can be delivered. You can delete messages you've sent.</li>
  <li><b>Notification settings.</b> If you turn on notifications we store your device's push address, which collections and alerts you picked, and your wallet address if you're signed in.</li>
  <li><b>Marketplace records.</b> Listings, offers, sales and signals made through the site, so they can be shown and settled. These mirror transactions that are already public on the XRP Ledger.</li>
  <li><b>Achievements and game balances.</b> Progress and play-balance totals tied to your wallet.</li>
  <li><b>Temporary cart backups.</b> If you sign in mid-purchase, your cart is saved for up to one day so it survives the trip to Xaman and back.</li>
  <li><b>On your own device.</b> Some settings, your cart and guide progress are kept in your browser's local storage and never leave it.</li>
</ul>

<h2>THE BL0CKCHA!N !S PUBL!C</h2>
<p>Everything you do on the XRP Ledger — balances, NFTs you hold, trades, trustlines — is public and permanent, visible to anyone. We read it to run the site, but we don't control it and can't delete it.</p>

<h2>WH0 ELSE SEES !T</h2>
<p>We don't sell or rent your data. We use these services to run the site, and they only get what they need:</p>
<ul>
  <li><b>Xaman (XRPL Labs)</b> — sign-in and transaction signing.</li>
  <li><b>Cloudflare</b> — hosting, storage and delivery. Like any website host, Cloudflare processes your IP address and browser details to serve pages.</li>
  <li><b>Push services</b> (Apple, Google, Mozilla) — deliver notifications you turned on.</li>
  <li><b>Public XRP Ledger nodes, xrpl.to, DexScreener, GeckoTerminal</b> — ledger and price data. Your wallet address may be included when we look up its holdings.</li>
  <li><b>IPFS gateways and NFT image hosts</b> — load NFT artwork.</li>
  <li><b>Google Fonts</b> — loads the site's font, which means Google sees your IP address.</li>
</ul>
<p>We may share information if the law requires it.</p>

<h2>H0W L0NG WE KEEP !T</h2>
<p>We keep your data while you use the site. Cart backups expire after a day. Notification sign-ups are removed when you turn them off or your device stops accepting them. Ask us and we'll delete your profile, messages and settings.</p>

<h2>Y0UR R!GHTS</h2>
<p>You can ask to see, correct or delete the information we hold about your wallet. Email ${MAIL} from any address, tell us your public wallet address, and we may ask you to prove it's yours (for example by signing a message in Xaman). We handle personal information in line with the Australian Privacy Principles. If you're unhappy with our response you can complain to the Office of the Australian Information Commissioner (oaic.gov.au).</p>

<h2>CHANGES</h2>
<p>If this policy changes, we'll update it here and change the date at the top.</p>`
  },

  terms: {
    title: 'TERMS 0F SERV!CE',
    desc: 'The rules for using soitbegins.xyz and the Σκύλλα marketplace.',
    body: () => `
<p class="lead">By using soitbegins.xyz ("Σκύλλα", "we", "the site") you agree to these terms. If you don't agree, please don't use the site.</p>
${SEED_WARNING}

<h2>WHAT TH!S S!TE !S</h2>
<p>Σκύλλα is an interface for viewing and trading NFTs and tokens on the XRP Ledger. It is <b>non-custodial</b>: we never hold your XRP, tokens, NFTs or keys. Every transaction is created as a request you review and sign yourself in the Xaman app, and nothing happens without your signature.</p>

<h2>WH0 CAN USE !T</h2>
<p>You must be at least 18 (or the age of majority where you live) and legally allowed to use crypto-assets where you are. You're responsible for keeping your wallet and its secret key safe.</p>

<h2>FEES</h2>
<p>Marketplace purchases through the site include a Σκύλλα fee (currently 1.23% when paying in XRP, 1.023% when paying in a token), shown in the total before you sign. NFT creators may also set a royalty, and every ledger transaction costs a small network fee. You pay any taxes that apply to your trades.</p>

<h2>R!SKS — PLEASE READ</h2>
<ul>
  <li>Crypto-assets, NFTs and meme coins are highly volatile and can lose all their value. Only spend what you can afford to lose.</li>
  <li>XRP Ledger transactions are <b>final</b>. We cannot reverse, cancel or refund them.</li>
  <li>Prices, safety badges, rarity scores and other information on the site come from the ledger and third parties. They may be wrong, delayed or incomplete, and are not financial advice.</li>
  <li>Tokens and NFTs listed on the site are created by third parties. Listing them is not an endorsement.</li>
  <li>Games on the site use a play balance with no cash value. It can't be bought, sold or withdrawn.</li>
</ul>

<h2>Y0UR C0NDUCT</h2>
<p>Don't use the site to break the law, scam or impersonate anyone, harass other users (including through messages), manipulate markets, or attack or overload the site. We may hide content, disable features or refuse service to wallets that do.</p>

<h2>THE S!TE !TSELF</h2>
<p>The site is provided "as is" and may change, break or go offline without notice. The site's design and original content belong to soitbegins.xyz. NFT artwork belongs to its creators and owners.</p>

<h2>L!AB!L!TY</h2>
<p>To the fullest extent the law allows, we aren't liable for losses from price movements, your own mistakes, lost keys, third-party services (including Xaman and the XRP Ledger), or the site being unavailable. Nothing in these terms excludes rights you have under the Australian Consumer Law that can't be excluded.</p>

<h2>G0VERN!NG LAW</h2>
<p>These terms are governed by the laws of Australia.</p>

<h2>CHANGES &amp; C0NTACT</h2>
<p>We may update these terms and will change the date at the top when we do. Questions: ${MAIL}. See also the <a href="/privacy">Privacy Policy</a> and <a href="/support">Support</a>.</p>`
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
  .lead{ font-size:18px; color:var(--dim); margin-bottom:1.2rem; }
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
  <a class="home" href="/">← S0!TBEG!NS</a>
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
