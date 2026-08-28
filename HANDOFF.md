# Σκύλλα SWAP — handoff note (updated, supersedes any earlier version)

This file is stale the moment nobody updates it after a session — if you're
picking this up, skim it, then check `git log -30 --oneline` for what's
actually landed since it was last edited. The session that wrote this one
touched almost nothing but `functions/static.js` (~14 commits) plus one
backend file (`functions/api/pigeons.js`) and one new standalone deployable
(`cron-worker/`) — read the commit messages themselves for the fine detail;
this file is the map, not the territory. Primary focus was a full mobile
pass on the DATABASE tab, plus browse-only support for two new NFT
collections (PHN!X/TEDDY).

## Repo

The LIVE repo (deploys to soitbegins.xyz via Cloudflare Pages on push to
`main`): `C:\Users\Admin\OneDrive\Desktop\soitbegins-portal-clone`
GitHub: `github.com/spotto589/soitbegins-portal`

⚠️ There is ALSO a stale, no-git-history folder at
`C:\Users\Admin\OneDrive\Desktop\Soitbegins.xyz` — don't confuse them. All real
work happens in `soitbegins-portal-clone`.

The main swap/DATABASE page is `functions/static.js`, routed at `/static`.

Other uncommitted changes have been sitting in this working tree across
many sessions now (`functions/api/redeem-verify-card.js`,
`functions/api/scylla-mock-redeem.js`, `functions/redeem.js`, `index.html`)
— every session so far has deliberately left these alone and committed only
the specific files each change actually touched. Don't assume they're
yours to commit; check with the user before touching them.

⚠️ **Another session (or the user directly) pushed to `main` in parallel
with this one, mid-session** — a real merge (not a force-push) was needed,
see the "Merge" note under Gotchas below. This repo is evidently being
worked on by more than one session at times — always `git fetch && git log
--oneline HEAD..origin/main` before pushing, not just before starting.

There's also a second real service in this repo: **`xaman-proxy/`**
(deployed separately on Render), and the standalone **`cron-worker/`**
(see its own section below). Both untouched this session except
`cron-worker/`'s own initial build.

## ⚠️ Cloudflare KV free-tier write quota — still a live constraint

The KV namespace backing `env.coin` is on Cloudflare's free tier: 1,000
writes/day, account-wide. `safeKvPut` in `_shared.js` swallows quota
failures silently — every write (listings, offers, sales log, signals)
fails silently once exhausted, with nothing in the logs beyond a generic
catch. If "my real on-ledger action isn't showing up" and the XRPL data
checks out, check the quota before assuming a code bug (`wrangler kv key
put ... --remote` failing the same way confirms it). This was discussed at
length with the user this session (see "D1 migration" conversation) but
**nothing was changed** — the whole listings/sales/offers KV architecture
is still exactly as fragile as before. If a future session picks up the D1
migration, start with `listings` (the one with the proven concurrent-write
data-loss bug, already documented below in gotcha 5a).

## This session's real bug fixes (not just UI)

1. **FILTER BY TRAITS was completely unusable on mobile — a real tap
   registered as a text selection instead of a click.** `.trait-row-label`
   (the tappable `<span>` shared by SORT BY / FILTER BY TRAITS / the
   DATABASE collection picker — all three) never set `user-select:none`.
   Confirmed live with the browser tool's own click (not just a synthetic
   dispatch): the label's text highlighted blue and no click handler fired
   at all. Fixed once, on the shared class, so it covered all three
   triggers. **If you ever add a new plain `<span>`/`<div>` as a tap
   target anywhere on this page, give it `user-select:none` +
   `-webkit-tap-highlight-color:transparent` up front** — this bug class
   is easy to reintroduce and easy to miss without testing an actual touch
   tap (a synthetic `dispatchEvent('click')` does NOT reproduce it).
2. **MAKE AN OFFER (and 5 other Xaman sign flows) silently never
   confirmed on mobile.** `openXamanPopup()` pre-opens a blank popup
   synchronously in the click handler (correct — avoids `window.open()`
   from an async callback getting blocked), then `navigateXamanPopup()`
   points that tab at the real sign URL once it's known. Six flows (MAKE
   AN OFFER, LIST, SIGNAL, TRANSFER, ACCEPT TRANSFER, ACCEPT OFFER) had
   inlined a bare `if (tabRef) tabRef.location.href = url` with **no
   fallback** instead of going through `navigateXamanPopup`. Mobile
   Safari/Chrome frequently return `null` from `window.open('', name,
   <fixed-size popup features>)` even when called synchronously (no real
   windowed-popup concept on mobile) — on those devices Xaman never
   opened, the button sat on "WAITING FOR SIGNATURE" forever, no error
   shown. BUY/DELIST had a different flavor of the same root issue
   (`window.open(realUrl, ...)` called directly inside their own async
   `fetch().then()`, the exact anti-pattern already documented in this
   file). All 8 flows now go through `navigateXamanPopup` consistently,
   and its own fallback retries as a plain `window.open(url, '_blank')`
   instead of reusing the fixed-size popup features (plausibly what got
   the original call refused in the first place).
3. **A CSS containing-block bug hijacked a mobile popup's positioning.**
   `#flockGridPanel` has `backdrop-filter:blur(...)` on it — per the CSS
   Containing Block spec, `transform`/`filter`/`backdrop-filter`/
   `perspective` on an ancestor makes THAT element the containing block
   for a `position:fixed` descendant instead of the viewport. Confirmed
   live: `top:50%` was resolving against the document's full scroll
   height (landing past 4000px down), not the actual screen, for
   FILTER BY TRAITS' mobile popup. Fixed by reparenting the popup to a
   direct child of `<body>` while open (`restoreTraitsFlyout` moves it
   back afterward so desktop's `position:absolute`, anchored to the
   trigger, keeps working). **If you ever see a `position:fixed` element
   behaving like `position:absolute` relative to some ancestor, check
   that ancestor chain for `transform`/`filter`/`backdrop-filter` before
   assuming the positioning math itself is wrong.**
4. **The same popup then self-closed the instant you picked a value
   inside it.** `renderTraitsFlyoutVals()` rebuilds `#traitsFlyoutVals`'
   `innerHTML` synchronously inside the click handler for picking a trait
   value — the actual clicked button is a **detached node** by the time
   the event finishes bubbling to the document-level "click outside
   closes this" listener, so `el.X.contains(e.target)`-style checks read
   as "outside" even though the click plainly wasn't. Fixed with
   `e.composedPath()` (captured at dispatch time, before the mutation)
   instead of `e.target`-based containment checks. **Any "click outside
   this element closes it" listener needs `composedPath()`, not
   `e.target`, if the element's own click handler might rebuild its
   `innerHTML` before the event finishes bubbling.**
5. **A CSS cascade-order trap bit repeatedly this session — document it
   well since it WILL happen again.** Several `@media (max-width:700px)`
   mobile-override blocks in this file are declared *before* the
   unscoped "desktop base" rule they're meant to override, in the file's
   source order. Per normal CSS cascade rules, when two rules have EQUAL
   specificity, the one **later in source order** wins — regardless of
   whether one is inside a media query. So an unscoped base rule added
   after an existing mobile block silently wins at mobile widths too,
   even though its media condition (implicitly "always") is broader.
   Confirmed live at least three separate times this session (results-
   header-row's grid overflow, `.traits-flyout-cats`' flex-direction,
   `#traitsFlyoutCats .traits-flyout-cat`'s width) — each time fixed with
   either `minmax(0, ...)` (the grid/flex sizing case) or `!important` on
   the mobile-scoped rule (the ordering case). **Before adding any new
   base/desktop rule to a selector that already has a `max-width:700px`
   override earlier in the file, either add `!important` to the existing
   mobile override, or move the new rule to before that override in
   source order — don't assume the media query alone protects it.**
6. **A CSS class shared across two different UI contexts broke one of
   them when the other was redesigned.** `.thumb-offer` is used both by
   the DATABASE card's purple action box AND by `#amountEntryModal`'s
   LIST/OFFER/TRANSFER popup content (via the second class
   `.amount-entry-mode`, always present together). Making the card a
   row-direction flex container (to center its button(s) regardless of
   state) silently turned the popup into a horizontal strip too — same
   root cause as gotcha 11 below (a shared thing can't assume it's only
   used in the one place you're looking at), just for a CSS class instead
   of a JS function. Fixed by scoping the row-flex behavior to
   `.thumb-offer.amount-entry-mode{ display:block; }`, reusing the
   `amount-entry-mode` class that was already there for exactly this kind
   of disambiguation. **Before changing a shared CSS class's `display`/
   `flex-direction`, grep every place that class is used in the HTML, not
   just the one card/component you're actively redesigning.**
7. **The purple action box wasn't actually filling itself even after
   #6 was "fixed" once.** `.owned-action-row` (the flex row holding
   BUY N0W/0FFER/CANCEL) is a flex ITEM of `.thumb-offer` once that
   became row-direction flex — flex items shrink-wrap to their own
   content's width along the main axis by default instead of stretching.
   Harmless with two buttons (their combined content is already close to
   the box's width) but a single button (CANCEL, or 0FFER alone) shrank
   to a small pill centered with big empty margin on both sides.
   Confirmed live: a lone CANCEL's row measured 54px inside a 143px box.
   `width:100%` on `.owned-action-row` is what actually gives `flex:1 1
   0` real room to fill (or split evenly for two buttons — confirmed
   63px/63px). This is the SAME underlying spec behavior as gotcha 5
   above (flex items don't auto-stretch along the main axis) just hitting
   a nested flex item instead of a grid track — if you see something
   centered-but-too-small inside a flex container, check this first.

## Major features/redesigns built this session

### 1. Full mobile pass on SORT BY / FILTER BY TRAITS / the DATABASE picker
Went through several iterations (see commit history for the intermediate
steps) before landing on the current shape, per direct user feedback each
time:
- **Mobile**: SORT BY is one flat list (`renderSortFlyoutList`, no
  category step — with only ~11 options total, the category drill-down
  added early in the session was more navigation than the option count
  needed) that lists down inline below its trigger, pushing the rest of
  the page down, instead of floating as an overlay. FILTER BY TRAITS
  keeps a real category step (many categories, many values each) but ALSO
  lists down inline for the category choice; tapping a category pops its
  values up as a real centered overlay instead (see bug fixes #3/#4
  above for what that took to get right).
- **Desktop** (`min-width:701px`): SORT BY is a permanently-visible
  horizontal strip of every option (no click-to-open step at all — all
  directly clickable) with PREV/NEXT arrows to scroll along since 11
  options don't fit on one line; native scrollbar hidden
  (`scrollbar-width:none` + the `::-webkit-scrollbar` pseudo-element).
  FILTER BY TRAITS' category list is a horizontal row instead of a
  vertical column, with its own scroll arrows; its values panel sits
  below the row now instead of beside it (no more "vertical position of
  the hovered category" to align a side panel to).
- The DATABASE collection picker (P!GE0NS/FUZZY/PHN!X/TEDDY) got a
  JS-clamped `position:fixed` popup fix early in the session (same
  `#topTabs` overflow-clipping class of bug as last session's handoff
  documented) before PHN!X/TEDDY became real options later on (see
  Feature 2 below).

### 2. Browse-only PHN!X/TEDDY collections
The DATABASE picker's PHN!X/TEDDY options (previously inert "COMING
SOON" placeholders) are real now — clicking one genuinely browses that
collection via Deeptide (`shopSlug` = `phnixs`/`teddybg`) and xrp.cafe
(`vanitySlug` = same), confirmed live against the real APIs (1,588 Phnix
items, 2,600 Teddy items). FUZZY stays disabled — no shopSlug picked for
it yet.

**Why this was smaller than it sounds**: `_shared.js`'s Deeptide/xrp.cafe
fetch functions were ALREADY `shopSlug`-parameterized before this session
touched anything (see that file's own comment on it) — plain browse,
trait-filtering, and floor price genuinely needed zero new crawl
infrastructure. What's new: `COLLECTIONS` config + `resolveCollection()`
in `functions/api/pigeons.js` (reads a `collection` query param), and
`state.collection` flowing through `api()`/`apiWithRetry()` in
`static.js` automatically (the two shared query-builders every
`/api/pigeons` call goes through — no other call site needed touching).
`switchCollection()` in the client resets browse/sort/trait state,
re-fetches, and toggles `body.collection-phnixs`/`-teddybg`, which
redeclare `--cyan`/`--magenta`/`--pigeon-purple` (every existing rule
already keyed off those, so the whole DATABASE UI re-themes — orange/red
for PHN!X, green/white for TEDDY — with zero per-rule changes elsewhere).

**Explicit scope cut, not an oversight** — browse only, no
login/trading, per the user's own request ("we don't need to add all the
scylla logins to it yet"):
- No BUY N0W/0FFER/CANCEL/trustline banner for these two collections —
  `pigeonsActionBoxHtml` returns `''` outright when
  `!COLLECTION_META[state.collection].tradeable`. Those endpoints
  (`swap-makeoffer-*`, `swap-buy-*`) assume `PIGEON_ISSUER`/`TAXON` and
  would silently fail against the wrong collection if called.
- No EDITION toggle, no `# 0R WALLET` search box (both depend on the
  `$PIGEONS`-only number-map KV crawl — no equivalent crawl exists for
  these collections) — hidden via `body.collection-browse-only`.
- No AVG SALE PRICE / COND!T!ON line on cards, no PRICE/HISTORICAL SALES
  sort options — no sale-history crawl exists for these collections
  either (would otherwise show every single card as `COND!T!ON :: M!NT`,
  which is guaranteed-wrong, not just missing).
- TOP 100 HOLDERS / SALES HISTORY / CR0WN tabs are untouched — NOT
  collection-aware, they still only ever show `$PIGEONS`' own data
  regardless of which collection is selected in the DATABASE picker. If
  a future session wants these working per-collection, that's real new
  work (a Clio holder-scan and a sales crawl per collection, neither of
  which exists yet for PHN!X/TEDDY).
- Card headers ("P!GE0N #N") are collection-aware
  (`collectionItemLabel()`), but the results-count status line, the
  "SEARCHING $PIGEONS DATABASE" panel title, and a few empty-state
  strings still hardcode "P!GE0NS" — known, deliberately left as
  cosmetic debt rather than chasing every string this session.

### 3. DATABASE card redesign — listing price + action box
Listing price (and "YOUR LISTING") moved off the purple action box onto
the picture itself — `.thumb-listing-badge`, bottom-right corner,
purple border for a real listing / cyan for your own (matches the site's
existing "this is yours" colour language). The purple box itself is
buttons/label only now, and — after the flex-related bugs in fixes #6/#7
above were actually found and fixed — is a genuinely uniform size across
every state: BUY N0W + 0FFER (exact 50/50 split, confirmed) if buyable,
CANCEL (fills the box) if it's your own listing, a plain `!N Y0UR FL0CK`
label if it's yours and unlisted, or just 0FFER (fills the box) otherwise.

### 4. Detail screen — BACK button + fullscreen lightbox
`#backToBrowseBtnTop` used to float `position:fixed` at the screen's
top-left corner, entirely independent of `P!GE0N #N`'s own (centered)
position — could visually collide or misalign depending on scroll
position. Now shares a row with it (`.detail-num-row`, `position:
absolute` within that row, vertically centered against it) — confirmed
aligned on both mobile and desktop. Lost the old "stays put while you
scroll" behavior in exchange (the full-width BACK strip at the bottom of
the traits/listings column is still there as the persistent option).

Fullscreen lightbox (`#detailLightbox`) padding cut from `2rem` to
`0.75rem` on all sizes (was already fixed to near-zero on mobile earlier
in the session) — `object-fit:contain` already preserves the real aspect
ratio, so padding was the only part of "doesn't fill the browser" still
fixable without cropping. Confirmed live: image grew to 876×876 in a
1200×900 viewport (was 836×836), the mathematical max for a square image
without cropping.

### 5. `cron-worker/` — new standalone deployable
A Cloudflare Worker (not a Pages Function — Pages can't run scheduled
triggers), on a `*/15 * * * *` Cron Trigger, bound to the same `coin` KV
namespace as the Pages site, calling `maybeRefreshPigeonNumberMap`/
`maybeRefreshHighSaleMap` on every tick — see its own section further
down for deploy details. Fixes the same class of bug as last session's
handoff documented for listings ("freshness depends on random traffic"),
just for the number/high-sale index crawl instead.

## Known open item — NOT fixed this session

**"BUY N0W says CAN'T BUY YOUR OWN LISTING on a pigeon that isn't mine."**
Reported by the user, could not be reproduced or root-caused this
session — no live Xaman wallet session available in this environment.
Traced the code path: `swap-buy-prepare.js` does a **fresh** XRPL
`nft_sell_offers` lookup and compares the real on-chain seller against
`payload.acct` from the session cookie (`offer.owner === buyer`) — this
is a real server-side check, not client-trusted data, and nothing in it
was touched this session. The client's `data-nftid` wiring
(`pigeonsActionBoxHtml`/`wireResultClicks`' `.buy-scylla-btn` handler)
also looks correct on inspection — each card's button carries its own
real `p.nftId`, no shared/stale reference found. Most likely explanations
if a future session picks this up: (a) the wallet actually connected via
Xaman (check the trustline banner) really did list that specific pigeon,
or (b) `state.currentDetail` going stale after PREV/NEXT navigation on
the detail screen before clicking its own BUY button — **the next debug
step should be checking `navigateDetail`'s handling of `state.
currentDetail` around lines ~10500-10600, and/or asking the user to
confirm which wallet shows as connected** before assuming client code is
at fault.

## Gotchas — read before touching static.js again

Everything from prior handoffs still applies (the `Σκύλλα` mixed-case
one, gotcha 3 below, was hit again this session — see bug fix pattern
above); the items below are new or newly-reinforced.

0. **A CSS clipping bug can look identical to a "the data just isn't
   there" bug** — `document.elementFromPoint()` is the fastest way to
   prove it, same technique as last session.
0a. **`overflow-x:auto` with no `overflow-y` set clips vertically too**,
    confirmed again this session for `#topTabs`.
0b. **A `position:fixed` element can behave like `position:absolute`
    relative to some ancestor if that ancestor has `transform`/`filter`/
    `backdrop-filter`/`perspective`** — see bug fix #3 above. Check the
    full ancestor chain (not just the immediate parent) before assuming
    fixed-positioning math is wrong.
0c. **CSS cascade order, not just specificity, matters when two rules
    tie on specificity** — see bug fix #5 above. A mobile override
    declared earlier in the file than an unscoped base rule loses to that
    base rule at ALL widths, media query notwithstanding, unless it uses
    `!important` or higher specificity.
0d. **A shared CSS class can silently break a second, unrelated UI
    context when you redesign the first one** — see bug fixes #6/#7
    above. Grep every usage of a class before changing its `display`/
    `flex-direction`.
1. **Never write a literal backtick anywhere inside the `SWAP_HTML`
   template literal** — not even in a comment (hit this again this
   session, inside a comment quoting a code snippet with backticks — use
   plain text instead of markdown-style code spans in comments). Run the
   full render-and-check pipeline below before every push.
2. **Escape sequences inside the client script need to survive TWO
   rounds of interpretation** — backslashes meant to reach the browser
   doubled in the source.

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
   Also run this after any HTML restructuring (dup ids, `el.*` references
   with no matching registration, registered-id-with-no-matching-html-id):
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
   "getBoundingClientRect"]` is a known false positive.) `dup ids` and
   `registered-but-no-html-id` should both be `[]`.

   Clean up temp files after: `rm -f rendered.html rendered_inner.js
   rendered_inner_bundled.js`. Before every push: scan the diff for
   anything secret-looking (`git diff <file> | grep -iE
   "secret|api_key|apikey|seed"`) and confirm `git fetch && git log
   --oneline HEAD..origin/main` is empty.
3. `Σκύλλα` must render mixed-case everywhere — wrap in
   `<span style="text-transform:none;">Σκύλλα</span>`, escape the literal
   source text too (don't type the all-caps Greek `ΣΚΥΛΛΑ` and rely on
   CSS alone — confirmed live this session both the CSS AND the literal
   source text were wrong in the S!GNAL prompt).
4. Cloudflare's per-request subrequest budget is real — do the
   arithmetic before adding any new per-item enrichment call.
5. KV cache keys are versioned — bump the suffix if a cached shape
   changes.
5a. **Cloudflare's free-tier KV cap is 1,000 writes/day, account-wide** —
    still true, still not fixed (see its own section above).
6. `NEVER trust a txjson the client sends back` — every `*-prepare.js`/
   `*-payload.js` endpoint re-derives it server-side.
7. `swap-offers-received.js`/`swap-listing-owned.js` blind-scan bounded
   at ~45 items as a backfill.
8. `xaman-proxy` signs real transactions autonomously as the broker
   wallet, allowlisted to `NFTokenAcceptOffer`/`Payment` only.
9. **A new way to open `#screenDetail` from inside an overlay** needs its
   own exclusion in the global "click outside closes detail" listener.
10. **Popups stack, they don't nest CSS-wise** — every `position:fixed;
    inset:0; z-index:1000` overlay is independent; the first must be
    explicitly closed when handing off to a second.
11. **A shared function/variable (or, per this session, CSS class) used
    across sibling flows can't assume it's only ever called from the one
    you're looking at** — grep every call site / every usage before
    changing one.
12. **Multiple sub-states toggled by `display` inside one modal must
    reset ALL of them, not just the one being shown, every time the
    modal (re)opens.**
13. **This browser-preview environment's screenshot tool frequently
    fails with "the Browser pane is not displayed"** — not a bug in the
    site, just whether the user has the pane open on their end at that
    moment. `getBoundingClientRect()`/`getComputedStyle()` via
    `javascript_tool` is the reliable fallback for verifying layout
    changes when screenshots aren't available — used throughout this
    session, works fine. Don't block real verification work on waiting
    for a screenshot; measure instead, screenshot opportunistically when
    it happens to work.
14. **`document.querySelector('.someClass')` can match a decoy/
    placeholder element that happens to share a class with the real
    thing** — burned once this session: `.pigeon-img-box` also matches
    `#targetPigeonImg` (an unrelated trade-builder placeholder that
    appears earlier in the DOM). Scope selectors to a real container
    (`#resultsArea .pigeon-img-box`) when testing/debugging, not just the
    bare class.

## Deploy

`git push origin main` from `soitbegins-portal-clone` → live on
soitbegins.xyz, usually within ~1-2 minutes via Cloudflare Pages. To
watch live server-side logs: `npx wrangler pages deployment tail
--project-name soitbegins-portal`. `npx wrangler kv key get "<key>"
--namespace-id 9169a9a4d1ae42bd9c020a4077bc643c --remote` reads
production KV directly.

Local preview: `.claude/launch.json` **in THIS repo** (not the stale
folder — that changed since the last handoff, this session added a
`soitbegins-local` entry directly here) has a config that runs `wrangler
pages dev . --port 8799` with the real `Σκύλλα`/`coin` KV bindings. Use
this to verify UI changes live before pushing — this session verified
essentially everything through it (real Deeptide API calls for PHN!X/
TEDDY, real DOM measurements for every CSS fix). Note: this local KV
binding is the SAME production namespace — writes made while testing
locally are real and count against the same daily quota.

`xaman-proxy` deploys separately on **Render** — untouched this session.

## `cron-worker/` — third deployable in this repo, deploys separately

A standalone Cloudflare Worker (Pages can't run scheduled triggers), on a
`*/15 * * * *` Cron Trigger, bound to the same `coin` KV namespace as the
Pages site (`9169a9a4d1ae42bd9c020a4077bc643c`). Calls
`maybeRefreshPigeonNumberMap`/`maybeRefreshHighSaleMap` from
`functions/_shared.js` on every tick, keeping both indexes warm
independent of site traffic (previously only refreshed as a side effect
of some visitor's own request noticing stale data).

**Deploys independently** — `git push origin main` does NOT touch it:
```
cd cron-worker
npx wrangler deploy
```
Live at `https://soitbegins-cron.connor-quinn.workers.dev` (URL
irrelevant, nothing calls it). `npx wrangler tail soitbegins-cron` to
watch it fire live.

**If this repo ever migrates the listings/sales/etc. maps off KV onto
D1** (discussed at length this session — see the "browse-only PHN!X/
TEDDY" conversation and the KV-race-condition discussion earlier in the
session history if picking this up cold — but NOT started, still exactly
as fragile as before), this worker's KV binding needs to become a D1
binding too.
