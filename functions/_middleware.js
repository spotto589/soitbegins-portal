// ─────────────────────────────────────────────────────────────────────────
// Site-wide security layer — runs in front of every request (pages, API
// and static files alike).
//
// 1. Blocks repo files that were never meant to be public. Cloudflare
//    Pages serves the whole repo root as static files, so without this
//    anyone could read HANDOFF.md, wrangler.toml, xaman-proxy/server.js,
//    cron-worker/, d1/schema.sql, etc. straight off soitbegins.xyz.
//    scripts/rarity-data/ stays public on purpose: /rarity tells people
//    to use build-snapshot.mjs and verify.mjs to check the trait seals.
//
// 2. Adds security headers to every response. The CSP here is
//    deliberately narrow (no script-src/connect-src allowlist): the pages
//    rely heavily on inline scripts and a long list of XRPL/IPFS hosts,
//    and a strict policy would break them. What it does lock down:
//    the site can't be framed (clickjacking on signing flows), no
//    <base> hijacking, no plugins, and plain-http subresources are
//    upgraded. Cross-Origin-Opener-Policy is left unset on purpose — the
//    Xaman sign-in popup relies on window.open().
// ─────────────────────────────────────────────────────────────────────────

const BLOCKED_PREFIXES = [
  '/xaman-proxy/',
  '/cron-worker/',
  '/d1/',
  '/functions/',
  '/node_modules/',
  '/.wrangler/',
  '/.claude/',
  '/.git/',
];

const BLOCKED_FILES = new Set([
  '/handoff.md',
  '/wrangler.toml',
  '/.gitignore',
  '/.gitattributes',
  '/.dev.vars',
  '/package.json',
  '/package-lock.json',
]);

// Public exception inside an otherwise blocked folder.
const PUBLIC_SCRIPTS_PREFIX = '/scripts/rarity-data/';

const BLOCKED_EXTENSIONS = /\.(md|toml|sql|py|env|vars|log|bak|orig|swp)$/;

function isBlocked(pathname) {
  let p;
  try { p = decodeURIComponent(pathname); } catch (e) { return true; }
  p = p.toLowerCase().replace(/\/{2,}/g, '/');
  if (p.includes('/../') || p.endsWith('/..')) return true;
  if (BLOCKED_FILES.has(p)) return true;
  if (p.startsWith('/scripts/') && !p.startsWith(PUBLIC_SCRIPTS_PREFIX)) return true;
  for (const prefix of BLOCKED_PREFIXES) {
    if (p.startsWith(prefix) || p === prefix.slice(0, -1)) return true;
  }
  // Any dotfile/dot-folder anywhere (.env, .git, .dev.vars, …).
  if (/\/\.[^/]/.test(p) && !p.startsWith('/.well-known/')) return true;
  return BLOCKED_EXTENSIONS.test(p);
}

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Content-Security-Policy':
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; upgrade-insecure-requests",
};

export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (isBlocked(url.pathname)) {
    const blocked = new Response('Not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) blocked.headers.set(k, v);
    return blocked;
  }

  const res = await context.next();

  // WebSocket upgrades and other 1xx responses can't be rebuilt.
  if (res.status === 101 || res.webSocket) return res;

  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    // Don't override a stricter/different policy a route already set.
    if (!out.headers.has(k)) out.headers.set(k, v);
  }
  return out;
}
