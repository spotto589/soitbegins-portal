# Σκύλλα SWAP — handoff note (updated, supersedes any earlier version)

This file is stale the moment nobody updates it after a session — if you're
picking this up, skim it, then check `git log -50 --oneline` for what's
actually landed since it was last edited. The session that wrote this one
touched almost nothing but `functions/static.js` (formerly `swap.js` — see
the route rename below) plus a handful of small, surgical backend files
across ~26 commits — read the commit messages themselves for the fine
detail; this file is the map, not the territory.

## Repo

The LIVE repo (deploys to soitbegins.xyz via Cloudflare Pages on push to
`main`): `C:\Users\Admin\OneDrive\Desktop\soitbegins-portal-clone`
GitHub: `github.com/spotto589/soitbegins-portal`

⚠️ There is ALSO a stale, no-git-history folder at
`C:\Users\Admin\OneDrive\Desktop\Soitbegins.xyz` — don't confuse them. All real
work happens in `soitbegins-portal-clone`. The default working directory a
fresh session lands in is often the STALE one — `cd`/read into
`soitbegins-portal-clone` explicitly before touching anything.

**The main swap page is `functions/static.js` now, not `functions/swap.js`**
— this session renamed the route from `/swap` to `/static` (file renamed to
match, since Cloudflare Pages Functions route by filename). Every internal
self-redirect (Xaman OAuth `redirectUrl`, post-login redirect, sign-out
redirect, the offer-deep-link) and the on-chain `Source` memo attached to
every real offer now point at `/static` too. ⚠️ If Xaman/XUMM login stops
working after a fresh deploy, check whether the OAuth app's redirect-URL
allowlist (in the Xaman developer console, not in this repo) still says
`/swap` — that was flagged as a real risk when the rename shipped and was
never independently confirmed fixed on Xaman's side.

Other uncommitted changes have been sitting in this working tree across
many sessions now (`functions/api/redeem-verify-card.js`,
`functions/api/scylla-mock-redeem.js`, `functions/redeem.js`, `index.html`)
— every session so far has deliberately left these alone and committed only
the specific files each change actually touched. Don't assume they're
yours to commit; check with the user before touching them.

There's also a second real service in this repo: **`xaman-proxy/`**
(deployed separately on Render, `https://xaman-proxy.onrender.com`) — a
plain Node.js app, not a Cloudflare Worker, that relays Xaman payload API
calls AND holds a real XRPL wallet seed (`BROKER_WALLET_SEED`) for the
brokered $PIGEONS marketplace fee. Untouched this session.

## ⚠️ Cloudflare KV free-tier write quota — hit it live this session

The KV namespace backing `env.coin` is on Cloudflare's free tier: **1,000
writes/day, account-wide, across every key**. This session hit that limit
mid-debugging (confirmed via `wrangler kv key put` itself failing with
`code: 10048 — your account has reached the free usage limit for this
operation for today`). `safeKvPut` in `_shared.js` already anticipates this
and swallows the error silently ("Quota exhaustion or any other transient
KV failure — not fatal") — which means **every** write on the site (new
listings, offers, sales log, incoming transfers, signals — everything)
fails completely silently once the quota is exhausted for the day, with
zero user-facing error and nothing in the logs beyond a generic catch. If a
future session sees "my real on-ledger action isn't showing up anywhere on
the site" and the data/logic all checks out against a direct XRPL query,
**check whether the quota is exhausted before assuming it's a code bug** —
`wrangler kv key put ... --remote` failing the same way is the fastest way
to confirm. Resets daily (UTC midnight). If this becomes a recurring
problem, the real fix is upgrading the KV namespace to a paid plan or
seriously cutting write volume — not chasing more app-level workarounds.

## This session's real bug fixes (not just UI)

1. **Listings silently disappearing from L!STED/FL00R $P!GE0NS.** Root
   cause: `swap-listing-owned.js`'s discovery scan checks up to 5 Pigeons
   *concurrently* (`mapWithConcurrency`), and each match previously called
   `recordSwapListing` separately — a bare read-modify-write against the
   same `pswap:listings:v1` KV key. When more than one Pigeon in the same
   pass turned out to be genuinely listed, the concurrent writes raced:
   whichever one finished last "won," silently dropping every other
   listing discovered in that same request. Fixed by collecting every
   discovered entry into one object and writing it via a new
   `recordSwapListingsBatch` (single read-modify-write) at the end of the
   request instead. If you ever add another concurrent-scan-that-writes
   pattern anywhere in this codebase, this is the exact bug class to avoid
   — collect, then write once.
2. **Page permanently unable to scroll** after clicking a wallet link from
   the pigeon detail/traits screen. `showTab()` hides `#screenDetail`
   directly (bypassing `showScreen()`, which is the only place that used to
   clear `body.detail-open` — the class that sets `overflow:hidden` while
   the detail screen is up). A tab switch triggered from inside the detail
   screen (e.g. `browseOwnerCollection` via a wallet click) left that class
   stuck forever. Fixed by having `showTab()` clear it too.
3. **DATABASE collection picker (P!GE0NS/FUZZY/PHN!X/TEDDY dropdown)
   rendering half cut off.** `#dbSelectWrap` lives inside a DATABASE tab
   button, inside `#topTabs`, which is `overflow-x:auto` for horizontal
   tab-bar scrolling. Per the real CSS Overflow spec, a non-"visible"
   overflow-x with no explicit overflow-y computes overflow-y to "auto"
   too — **an explicit `overflow-y:visible` on the ancestor does NOT
   override this**, confirmed live (computed value stayed "auto"
   regardless). This clips ANY descendant that visually extends past the
   tab bar's own height, including a `position:absolute` flyout, no matter
   which direction it opens. Entries past PHN!X were being painted but
   invisible — confirmed via `document.elementFromPoint`, which returned
   the trustline banner's own issuer-address text at the exact coordinates
   PHN!X should have shown. Fixed by switching `#dbSelectFlyout` to
   `position:fixed` (escapes all ancestor overflow clipping since it's
   relative to the viewport), with its `top`/`left` computed fresh from
   `#dbSelectWrap.getBoundingClientRect()` every time it opens (see
   `openDbSelectFlyout`) — `position:fixed` has no CSS-only way to anchor
   to a specific element, so this has to be JS. **If any other dropdown
   ever gets nested inside `#topTabs` in the future, it needs the same
   treatment, not a plain `position:absolute` flyout.**
4. **Duplicate "0 COMBINATIONS OF THESE TRAITS EXIST"** — used to render
   both in the results-count status line AND in the empty-state box below
   it when a 2+-trait filter matched nothing. `statusLine` now stays blank
   on zero results; the empty-state box is the only place that says so.

## Major features built this session

### 1. TRANSFER's recipient side (FL0CK "NFT 0FFERED T0 Y0U")
TRANSFER creates a real free (Amount "0") `NFTokenCreateOffer` on an NFT
the *sender* still owns — invisible to the recipient with no way to
discover it just by looking at their own `account_nfts`. Added a tracked
KV index (`pswap:incomingtransfers:v1`, written the moment the sender's own
offer confirms in `swap-offer-status.js` — specifically when neither
`wantNftId` nor `swapId` is present, i.e. a pure one-way transfer, not the
still-paused NFT-for-NFT swap builder), self-healed against live
`nft_sell_offers` on read (`swap-incoming-transfers.js`), plus a real
accept flow (`swap-transfer-accept-prepare/-payload/-status.js`). Surfaced
as a new box above the FL0CK grid. **Known gap:** only tracks transfers
sent *after* this shipped — anything sent earlier isn't retroactively
indexed.

### 2. CR0WN tab — real $PIGEONS trading P&L leaderboard
New top-level tab next to SALES H!ST0RY. Realized net flow only (seller
proceeds minus buyer spend, from the real settled sales log
`pswap:saleslog:v1`) — deliberately does NOT value Pigeons a wallet still
holds. Weekly/monthly toggle. Read-only — no reward payout logic, per
explicit scope agreement with the user (asked via AskUserQuestion before
building). **Known limitation:** the sales log itself is capped at 300
entries (pre-existing, not new) — a busy month could lose its oldest
entries before "this month" ever sees them.

### 3. ΣΚΥΛΛΑ://S!GNAL
After a real MAKE AN OFFER settles, checks whether the recipient (the
Pigeon's owner) has *any* activity on the site at all
(`hasWalletActivity` in `_shared.js` — checks sales log, listings, buy
offers, incoming transfers, and whether they've ever connected via Xaman
at all/have a stored push token). If none, offers an optional 123-drop XRP
payment with a memo identifying the offer — entirely separate from the
NFTokenCreateOffer itself, never sent automatically, SKIP leaves the real
offer completely untouched. New endpoints: `swap-signal-check.js`,
`swap-signal-payload.js`, `swap-signal-status.js`. Records are keyed by
offerId (`pswap:signals:v1`) with `crwnEligible`/`crwnCredited` fields
already in the shape for a *future* CRWN reward engine to query — nothing
credits or withdraws anything today; this was an explicit, spelled-out
constraint in the original request (no CRWN withdrawals, ever, until a
real reward engine exists).

### 4. FL0CK redesigned as an account page
Went through two iterations this session (first a small dropdown, then
corrected to the current layout per direct follow-up feedback — see the
commit history if you need the intermediate step). Current shape: a stack
of separate `.sw-panel` boxes. **MY FL0CK** is its own expand/collapse box
(starts *minimised* on landing — `state.flockCollapsed` defaults `true`)
holding the real pigeon grid; clicking it toggles `#flockGridPanel`'s
visibility directly, no re-fetch. Below it: MESSAGE !NB0X, 0FFERS, BUY
$P!GE0NS (wired to the real popup), TRANSACT!0N H!ST0RY (C0M!NG S00N),
$CRWN REWARDS (C0M!NG S00N) — MESSAGE !NB0X/0FFERS are inert placeholders
with no destination decided yet, not marked C0M!NG S00N specifically (the
user's own framing left them open). MY FL0CK's box was later stripped of
its arrow indicator so it renders pixel-identical to the BUY $PIGEONS box
next to it (same markup shape, only the label differs) — if you touch one
of these boxes' markup, check whether the "should look the same" intent
still holds before diverging them again.

### 5. Popup conversions — BUY $PIGEONS and OFFER CONFIRMATION
Both used to be `showScreen()` full-page navigations; both are now real
popups matching the `.offer-confirm-panel` purple treatment, using the
established multi-sub-state-toggled-by-display pattern (never an
innerHTML rebuild — that caused a real duplicate-id bug earlier this
session, since fixed). BUY $PIGEONS: entry/confirm/result as three
sub-states in `#buySwapModal`, underlying quote/trustline/sign logic
completely untouched, just the container. OFFER CONFIRMATION: now stays in
the same popup after submitting instead of jumping to a separate result
screen — swaps to a receipt sub-state in place, then (if the recipient has
no site activity) chains straight into the ΣΚΥΛΛΑ://S!GNAL sub-state, all
in the same `#offerConfirmModal`.

### 6. Exchange calculator overhaul
Dropped the standalone "1 XRP = N $PIGEONS" readout; title/DEXSCREENER
link/live price now collapse onto one line above the calculator itself.
The calculator row is two plain type-in boxes joined by a swap arrow (⇄),
no unit labels or "=" sign. Two-way (typing either side fills the other).
$PIGEONS side accepts k/m shorthand (k expands to the full comma-grouped
number, m stays literal — "123m" never expands, a $PIGEONS amount in the
hundreds of millions doesn't need spelling out) and auto-compacts past
100k to "Nk". XRP side capped at 100k, including computed results.

## Gotchas — read before touching static.js again

Everything from the prior handoff still applies; the two below are new or
newly-reinforced this session.

0. **A CSS clipping bug can look identical to a "the data just isn't
   there" bug.** Before assuming a dropdown/flyout is missing options or a
   feature "isn't showing" something, check whether it's actually a
   z-index/overflow clipping problem first — `document.elementFromPoint()`
   at the suspect coordinates is the fastest way to prove it (see gotcha
   #3 in the bug-fixes section above for the exact technique used this
   session).
0a. **`overflow-x:auto` with no `overflow-y` set clips vertically too, and
    an explicit `overflow-y:visible` on the same element does NOT undo
    that** — confirmed by direct testing, not assumption. If a dropdown
    needs to escape a horizontally-scrolling ancestor, use
    `position:fixed` with JS-computed coordinates, not a CSS-only fix.
1. **Never write a literal backtick anywhere inside the `SWAP_HTML`
   template literal** — not even in a comment. `node --check` on the outer
   file will NOT catch this reliably. Run the full render-and-check-the-
   inner-script pipeline below before every push.
2. **Escape sequences inside the client script need to survive TWO rounds**
   of interpretation — any backslash meant to reach the browser as a real
   escape must be written **doubled** in the source (`\\d`, `\\'`). Avoid
   apostrophes/contractions in new user-facing strings entirely rather
   than escaping. (Hit this again this session adding a temporary debug
   `window.addEventListener('error', ...)` line — a single `\n` in the
   outer source became a literal embedded newline in the served HTML,
   breaking the inner script's string literal. Doubled it, fixed.)

   **Run this before every push that touches static.js**:
   ```
   node --input-type=module -e "
   import { onRequestGet } from './functions/static.js';
   import fs from 'fs';
   const res = await onRequestGet({ request: new Request('https://x/static'), env: {} });
   const html = await res.text();
   fs.writeFileSync('rendered.html', html);
   "
   node -e "
   const fs = require('fs');
   const html = fs.readFileSync('rendered.html','utf8');
   const start = html.indexOf('<script>');
   const end = html.indexOf('</script>', start);
   fs.writeFileSync('rendered_inner.js', html.slice(start+8, end));
   "
   node --check rendered_inner.js
   npx --yes esbuild rendered_inner.js --outfile=rendered_inner_bundled.js
   ```
   Also run this after any HTML restructuring (checks for duplicate ids
   and `el.*` references with no matching registration, **plus a
   registered-id-with-no-matching-html-id check added this session** — this
   caught a real bug: a leftover `el.` registration + wiring block for a
   dropdown whose markup had already been deleted, which threw a null
   `.addEventListener` at page-load time):
   ```
   node -e "
   const fs = require('fs');
   const src = fs.readFileSync('functions/static.js','utf8');
   const ids = [...src.matchAll(/id=\"([a-zA-Z0-9_]+)\"/g)].map(m=>m[1]);
   const counts = {}; ids.forEach(id => counts[id]=(counts[id]||0)+1);
   console.log('dup ids:', JSON.stringify(Object.entries(counts).filter(([k,v])=>v>1)));
   const listMatch = src.match(/var el = \{\};\s*\[([\s\S]*?)\]\.forEach/);
   const registered = [...listMatch[1].matchAll(/'([a-zA-Z0-9_]+)'/g)].map(m=>m[1]);
   const used = new Set([...src.matchAll(/el\.([a-zA-Z0-9_]+)/g)].map(m=>m[1]));
   console.log('missing:', JSON.stringify([...used].filter(u => !registered.includes(u))));
   const missingDom = registered.filter(id => !src.includes('id=\"'+id+'\"'));
   console.log('registered-but-no-html-id:', JSON.stringify(missingDom));
   const bt = (src.match(/\`/g) || []).length;
   console.log('backtick count:', bt);
   "
   ```
   Backtick count should be exactly 4. (`missing: ["body",
   "getBoundingClientRect"]` is a known false positive, safe to ignore.)
   `dup ids` and `registered-but-no-html-id` should both be `[]`.

   Clean up temp files after: `rm -f rendered.html rendered_inner.js
   rendered_inner_bundled.js`. Before every push: also scan the diff for
   anything secret-looking (`git diff <file> | grep -iE
   "secret|api_key|apikey|seed"`) and confirm `git fetch && git log
   --oneline HEAD..origin/main` is empty.
3. `Σκύλλα` must render mixed-case everywhere — check `text-transform` on
   every ancestor, not just the string casing. When it needs to appear
   inside plain uppercase text (e.g. a button label), wrap it in its own
   `<span style="text-transform:none;">Σκύλλα</span>` and use `.innerHTML`,
   never `.textContent`, at every reset point for that element.
4. Cloudflare's per-request subrequest budget is real and hard — do the
   arithmetic before adding any new per-item enrichment call.
   `scanFilteredCandidates` is bounded to 600 items for exactly this
   reason.
5. KV cache keys are versioned (`pswap:highsale:v3`, etc.) — bump the
   suffix again if you ever change a cached value's shape.
5a. **Cloudflare's free-tier KV cap is 1,000 writes/day — hit it live this
    session** (see its own section above). If listings/offers/signals/etc.
    silently stop appearing again, check the quota before assuming a code
    regression.
6. `NEVER trust a txjson the client sends back` — every `*-prepare.js` and
   `*-payload.js` endpoint re-derives the transaction from scratch
   server-side.
7. `swap-offers-received.js` blind-scans every OTHER Pigeon the seller owns
   (bounded, `OFFERS_RECEIVED_SCAN_CAP=45`) as a backfill — a wallet
   holding more than ~45 untracked Pigeons could still miss a real offer.
   `swap-listing-owned.js`'s own discovery scan has the same
   `DISCOVERY_CAP=45` limitation, plus see bug fix #1 above for the
   concurrency issue that was layered on top of it.
8. `xaman-proxy` signs real transactions autonomously as the broker wallet
   (`/broker-submit`, allowlisted to `NFTokenAcceptOffer`/`Payment` only).
   Don't widen that allowlist without a specific reason.
9. **When adding a new way to open `#screenDetail` from inside an overlay/
   modal**, check the global "click outside closes detail" listener — it
   excludes specific click targets by name, not by any general "was this
   inside an overlay" logic. A new entry point needs its own explicit
   exclusion.
10. **Popups stack, they don't nest CSS-wise** — every `position:fixed;
    inset:0; z-index:1000` overlay on this page is independent, not a
    child of another. When one hands off to the next, the FIRST must be
    explicitly closed — nothing does that automatically just because a
    second one opened on top. When a flow needs a THIRD (or more)
    sequential state instead of a second popup, prefer adding another
    static sub-div toggled by `display` inside the SAME modal (the pattern
    `#offerConfirmModal` now uses for form → receipt → S!GNAL) over
    stacking a whole new overlay — simpler to reason about and avoids the
    close-the-previous-one bookkeeping entirely.
11. **A shared function/variable used across sibling flows can't assume
    it's only ever called from one of them** — grep every call site before
    changing one, don't assume there's only the one you're looking at.
12. **Multiple sub-states toggled by `display` inside one modal must reset
    ALL of them, not just the one being shown, every time the modal (re)opens**
    — otherwise reopening after a previous flow reached a later sub-state
    (e.g. a receipt) leaves stale state visible underneath the fresh one.

## Deploy

`git push origin main` from `soitbegins-portal-clone` → live on
soitbegins.xyz, usually within ~1-2 minutes via Cloudflare Pages, no build
step for the rest of the site (static.js's bundling by esbuild is the one
exception — see gotcha #1-2). To watch live server-side logs while
testing: `npx wrangler pages deployment tail --project-name
soitbegins-portal` (needs a deployment id — `npx wrangler pages deployment
list --project-name soitbegins-portal` first). `npx wrangler kv key get
"<key>" --namespace-id 9169a9a4d1ae42bd9c020a4077bc643c --remote` reads
production KV directly — useful for confirming whether something actually
persisted vs. got lost to a race/quota issue before assuming a code bug.

Local preview: `.claude/launch.json` (in the STALE `Soitbegins.xyz` folder,
not this repo — that's where the browser preview tool actually looks) has
a `soitbegins-local` config that `cd`s into this repo and runs
`wrangler pages dev` with the real `Σκύλλα`/`coin` KV bindings on port
8799 — use this to verify UI changes live before pushing. Note: this local
KV binding is the SAME production namespace (not a separate local-only
store) — writes made while testing locally count against the same daily
quota and are real.

`xaman-proxy` deploys separately on **Render** — a git push to `main`
alone does NOT redeploy it. Untouched this session.

## `cron-worker/` — third deployable in this repo, deploys separately too

New this session. A standalone Cloudflare Worker (not a Pages Function —
Pages can't run scheduled triggers), on a `*/15 * * * *` Cron Trigger,
bound to the SAME `coin` KV namespace as the Pages site
(`9169a9a4d1ae42bd9c020a4077bc643c`). It just calls
`maybeRefreshPigeonNumberMap`/`maybeRefreshHighSaleMap` from
`functions/_shared.js` (imported directly via a relative path — those two
functions are self-contained, no other env/bindings needed) on every tick.

**Why it exists**: those two refreshes used to only run as a side effect of
some visitor's own request noticing the cached data was stale — so
freshness depended on random traffic; a quiet period could sit stale past
the 6h window, and a pigeon number the crawl hadn't reached yet showed as
"not indexed" to whoever searched for it first. This worker keeps both
indexes warm independent of site traffic. The opportunistic refresh calls
still in `functions/api/pigeons.js` are now redundant in the common case
(the functions no-op if already fresh) but harmless — left in place, not
worth removing for the marginal edge case where the cron worker itself is
ever paused/deleted.

**Deploys independently** — `git push origin main` does NOT touch it. To
redeploy after editing `cron-worker/index.js`:
```
cd cron-worker
npx wrangler deploy
```
Live at `https://soitbegins-cron.connor-quinn.workers.dev` (the URL is
irrelevant — nothing calls it, it only runs on its own schedule). Check
`npx wrangler tail soitbegins-cron` to watch it fire live, or
`npx wrangler deployments list --name soitbegins-cron` for deploy history.

**If this repo ever migrates the listings/sales/etc. maps off KV onto D1**
(discussed but not started as of this session — see git log / conversation
history around "KV write races" if picking this up cold), this worker's KV
binding needs to become a D1 binding too, and the two refresh functions it
calls will need to be the D1-backed versions once those exist.
