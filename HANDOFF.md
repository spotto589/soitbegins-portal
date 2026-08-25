# Σκύλλα SWAP — handoff note (updated, supersedes any earlier version)

This file is stale the moment nobody updates it after a session — if you're
picking this up, skim it, then check `git log -30 --oneline` for what's
actually landed since it was last edited.

## Repo

The LIVE repo (deploys to soitbegins.xyz via Cloudflare Pages on push to `main`):
`C:\Users\Admin\OneDrive\Desktop\soitbegins-portal-clone`
GitHub: `github.com/spotto589/soitbegins-portal`

⚠️ There is ALSO a stale, no-git-history folder at
`C:\Users\Admin\OneDrive\Desktop\Soitbegins.xyz` — don't confuse them. All real
work happens in `soitbegins-portal-clone`.

Other uncommitted changes have been sitting in this working tree across
several sessions now (`functions/api/redeem-verify-card.js`,
`functions/api/scylla-mock-redeem.js`, `functions/redeem.js`, `index.html`)
— every session so far has deliberately left these alone and committed only
`functions/swap.js` (and once `functions/_shared.js`, see below). Don't
assume they're yours to commit; check with the user before touching them.

There's also a second real service in this repo: **`xaman-proxy/`**
(deployed separately on Render, `https://xaman-proxy.onrender.com`) — a
plain Node.js app, not a Cloudflare Worker, that relays Xaman payload API
calls AND holds a real XRPL wallet seed (`BROKER_WALLET_SEED`) for the
brokered $PIGEONS marketplace fee (see its own section below). Untouched
this session.

## Current status, at a glance (this session)

This session's work was almost entirely about **Σκύλλα :: $WλP** (formerly
labeled PλWS — renamed this session), the `mypigeons` tab:

- **PλWS now reuses the real DATABASE grid/detail screen, scoped to your own
  wallet**, instead of its own separate (and visually different, and
  buggier) card list. See "PλWS/DATABASE unification" below — this was the
  single biggest architectural change and several other fixes this session
  exist because of it.
- **A real, working V1 "SWAP NFT TRADE DETAILS" box** (`state.simpleOffer`,
  `CREATE_OFFER_ENABLED`) lets you pick one of your own Pigeons + a target
  Pigeon and actually send a real `NFTokenCreateOffer` via the existing
  swap-offer-\* backend (the same one `SWAP_BUILDER_ENABLED`'s old trade
  builder already used) — tested once, successfully, end-to-end on the real
  ledger with the user.
- **Deliberately paused for launch, right after that successful test.**
  `CREATE_OFFER_ENABLED = false` (new flag, top of `functions/swap.js`,
  same one-switch pattern as `SWAP_BUILDER_ENABLED`). The box now shows
  "C0M!NG S00N" instead of the real picker, and the SWAP OFFERS tab is
  hidden again. Reasoning below — **read this before flipping it back on**.
  Nothing was removed; flipping the flag brings the whole real flow back
  exactly as tested.

### Why CREATE_OFFER_ENABLED got turned back off

A real NFT-for-NFT swap here is two independent `NFTokenCreateOffer`s (one
per side, `Amount:"0"`, `Destination` restricted to the counterparty) plus
two independent `NFTokenAcceptOffer`s — **never atomic**. XRPL has no native
"both or neither" primitive for this (Batch/XLS-56 isn't live on mainnet —
see "XRPL Batch amendment" below, unchanged from before). Concretely: once
both sides have created their offers, whichever side's offer gets **accepted
first** is exposed — the other side can just cancel their own still-open
offer afterward and keep both. Whoever accepts second is safe (they only act
once they've already received). This was walked through in detail with the
user; they understood and agreed it's real, not a bug to silently ship.

**The planned fix, not yet built:** a brokered escrow version. Both offers
get `Destination`-restricted to a broker wallet instead of each other
(reusing the SAME broker wallet + `xaman-proxy` `/broker-submit` signing
infrastructure the $PIGEONS marketplace fee already uses — see "Brokered
accept-offer" below). Once the server verifies (real ledger read) that both
offers exist, the broker accepts both — briefly holding both NFTs — then
immediately forwards each to the correct final owner via its own
`Destination`-restricted zero-cost offer, which each user then accepts (same
familiar "OPEN XAMAN → accept" pattern as everywhere else on the site).

This removes the "who goes first" risk (neither party ever deals directly
with the other), but shifts trust to the broker wallet/site operator
instead, and introduces a real custodial window: **if the broker
successfully takes NFT A but fails to take NFT B (crash, dead xaman-proxy,
a canceled offer, whatever), it's left holding one real NFT with no
automatic way out.** That needs deliberate state-machine + recovery logic
(detect stuck, retry, alert) designed on purpose before this goes live to
real users — not bolted on after the first time it happens. **Not started.**
User's own words: wants to test this pattern a lot before trusting it with
real users, and is deliberately deferring this "until I've perfected the
rest of the website" — i.e. this is intentionally NOT on the critical path
for the current launch push. Don't build the escrow version without the
user explicitly asking to pick this back up.

## PλWS/DATABASE unification (this session)

**The core change:** `showTab('mypigeons')` now delegates straight to
`browseOwnerCollection(MY_WALLET, 'Y0U', undefined, 'mypigeons')` — the
exact same function the trustline banner's own `[ SH0W MY P!GE0NS ]` button
already called — instead of rendering a separate `myPigeonCardHtml`/
`sortedMyPigeons` grid. `browseOwnerCollection` gained a 4th `landOnTab`
param (default `'database'`, unchanged for every other call site) so it can
land back on `mypigeons` instead. Guarded against infinite recursion via an
`isOwnWalletScope()` check — `browseOwnerCollection` calls `showTab`
internally too.

This means clicking into a Pigeon from PλWS now opens the exact real
`screenDetail` screen (real trait backgrounds, real sales history,
everything) instead of a separate, thinner view — this was a direct, explicit
user request ("it should be one database, built like this universal").

**What's gated behind `body.paws-view`** (class toggled in `showTab`, CSS
`!important` since `renderTrustlineSummary`'s own async writes run after and
know nothing about which tab is active):
- Trustline banner: stats carousel, `[ SH0W MY P!GE0NS ]` (redundant, already
  there), `[ BUY $P!GE0NS ]` button all hidden — the BALANCE amount itself
  becomes the buy entry point (underlined, same `openBuySwapPanel` click
  target).
- `#searchPanelTitle` reads "SH0W!NG Y0UR P!GE0NS `<count>`" instead of
  "SEARCH!NG $P!GE0NS DATABASE" (`updateSearchPanelTitleForPaws()`, called
  from both `showTab` and `browseOwnerCollection`'s two count-set points).
- The `# 0R WALLET` search box is hidden — this page only ever shows your
  own Pigeons, no searching anyone else's, **except** while actively picking
  0FFER F0R (see below), where it's the whole point.

**Old `myPigeonsData`/`myPigeonsList` system:** trimmed, not removed.
`myPigeonCardHtml`/`sortedMyPigeons`/the sort dropdown are deleted (genuinely
dead once the grid moved to DATABASE's own). `myPigeonsData` itself is kept
— it's what "SWAP NFT TRADE DETAILS"'s Y0UR P!GE0N picker reads — but it's
now just **mirrored** from `state.scopeAllItems` inside
`browseOwnerCollection`'s own `isSelf` branches (both the instant-cache path
and the async-resolved path), not independently fetched. `loadMyPigeons()`
is now only ever called with no session (resets the panel to logged-out
state) — see the redundant-fetch bug below for why.

### Bugs found and fixed along the way

1. **Missing trait-photo backgrounds on the detail screen.**
   `browseOwnerCollection` sets `state.databaseLoaded = true` before
   `showTab` runs — this is what stops `SH0W MY P!GE0NS` from ALSO kicking
   off a redundant full-collection fetch. But `showTab`'s own
   `if (tab==='database' && !state.databaseLoaded)` branch is what normally
   calls `ensureTraitsLoaded()` (populates `state.traitExamples`, which
   `traitCellHtml`'s `.has-preview` real-photo-background trait cells read).
   Since PλWS can now be the very first scope entered in a session,
   `state.traitExamples` stayed permanently empty. Fixed: `browseOwner-
   Collection` now calls `ensureTraitsLoaded()` directly (idempotent, safe
   to call from anywhere).

2. **PλWS felt slow/glitchy to open.** Up to 3 separate, redundant, real-
   XRPL-backed wallet-NFT fetches were firing in parallel on open (the old
   `loadMyPigeons()` called from two different points in `showTab`, PLUS
   `browseOwnerCollection`'s own identical fetch). Fixed by the mirroring
   described above — confirmed via a `fetch` spy that it's exactly 1 fetch
   now, was 2-3.

3. **Opening a Pigeon's detail screen from inside the Y0UR P!GE0N picker
   modal immediately closed it again.** A global "click outside closes
   `#screenDetail`" listener (`el.screenDetail.style.display !== 'none' &&
   !el.screenDetail.contains(e.target) && ...`) fired because the click that
   opened the detail screen (the picker's own `[ VIEW ]` button) originated
   outside `#screenDetail` by definition — same class of bug the existing
   `.pigeon-img-box` exclusion was already there to prevent, just for a new
   click target. Fixed by adding `.simple-picker-view-btn` to that
   exclusion list. **If you add any other new way to open the detail screen
   from an overlay/modal, check this listener.**

### 0FFER F0R picking — reuses the real DATABASE, not a modal

Originally built as a second, separate search-modal (own wallet/# input,
own thinner card renderer). Explicit user feedback: should show the real
DATABASE instead, search bar included. Now: clicking `[ + SELECT ]` on
0FFER F0R calls `enterTheirsPickMode()` — exits your own scope
(`exitWalletScope()`), shows the full collection (`startCollectionBrowse()`),
reveals the search box (`body.paws-view.picking-theirs` CSS override),
retitles the panel. A new early-branch in `wireResultClicks` (checked before
every other click type, so trait-cell filtering still works while picking)
intercepts a click on `.pigeon-img-box`/`.card-select-toggle` while
`state.simpleOfferPickingTheirs` is true, selects that Pigeon (captures
`owner` too — needed for the real `Destination` field), and calls
`exitTheirsPickMode()` (`browseOwnerCollection(MY_WALLET, 'Y0U', undefined,
'mypigeons')` — back to PλWS regardless of which wallet was being searched
when the pick happened). `showTab` also cancels picking mode if you navigate
to an unrelated tab (T0P 123, SALES, etc.) mid-search, so it can't keep
hijacking clicks somewhere that has nothing to do with CREATE OFFER.

The Y0UR P!GE0N side kept its modal (explicit user request — "this should
stay") but got upgraded: 4-across, bigger thumbnails, fixed scrollable
height, and every card now has a `[ VIEW ]` button opening the real detail
screen (see bug #3 above).

## KV write cap (fixed this session, `functions/_shared.js`)

User reported KV operations nearing the daily 1,000-write cap again.
Root cause (same one gotcha 5a below already flagged once):
`fetchXrpCafeNftListing`'s cache TTL was raised from 60s → 600s once
already, still weeks-out too short under real traffic (up to 40 items/page,
every page load, re-missing and rewriting every 10 minutes). Raised again to
`XRP_CAFE_NFT_CACHE_TTL_SECONDS = 3600` (1 hour). If this keeps recurring,
the real fix is probably batching or a longer-lived shared cache, not just
raising the number again.

## Brokered accept-offer (0.589% marketplace fee + $CRWN reward) — unchanged this session, still UNCONFIRMED

Accepting a received $PIGEONS buy-offer (OFFERS RECEIVED → ACCEPT OFFER)
is XRPL **brokered** mode — the marketplace fee is taken atomically in the
SAME settling transaction as the NFT transfer.

**The broker/developer wallet**: `rpigEoNV9KYjK6P9kzFmTqesbpqv7dpnzK` —
`MARKETPLACE_BROKER_WALLET` in `_shared.js`. Its seed lives ONLY as
`BROKER_WALLET_SEED` on the `xaman-proxy` Render service's env vars —
never in this repo. This is the SAME wallet/signing path the planned
NFT-for-NFT escrow swap above would reuse.

**Fee math** — `computeMarketplaceFee(totalValueStr)` in `_shared.js`.
0.589% = 589/100000, integer "micro-unit" arithmetic, no floating-point
drift. Verified: `computeMarketplaceFee('100')` → `{ totalValue: '100',
feeValue: '0.589', sellerValue: '99.411' }`.

**Status as of last real check:** the one live test so far did NOT exercise
the new brokered code path — it hit a stale pre-brokered direct accept
instead (confirmed via direct ledger lookup). A clean retest through the
site's own ACCEPT OFFER → OPEN XAMAN flow, watching
`wrangler pages deployment tail` live, is still the next thing anyone
picking this specific piece up should do. Nothing about this changed this
session.

## Xaman push notifications — unchanged this session, still NEEDS WEBHOOK URL SET

`functions/api/xaman-webhook.js` receives Xaman's server-to-server callback
when a payload created with `push:true` resolves. Re-fetches the full
payload via `getXamanPayloadStatus()` rather than trusting the webhook
body's own claim, then stores the wallet's reusable push token via
`getXamanUserToken`/`storeXamanUserToken`/`clearXamanUserToken` (KV,
durable, no TTL). Wired into every `*-payload.js` endpoint.

**Needs before this does anything**: the webhook/callback URL
(`https://soitbegins.xyz/api/xaman-webhook`) set in the **Xaman Developer
Console** (apps.xumm.dev) — nothing registers it automatically, unconfirmed
whether done yet. Webhook body field names were written from memory of
Xaman's documented format, not verified against a live event — check
`wrangler pages deployment tail` after the first real one fires.

## The swap builder (NFT-for-NFT, non-atomic, currently hidden) — unchanged this session

The OLDER multi-item (up to 4 per side) trade builder — `CREATE AN 0FFER`
box on DATABASE, MY PIGEONS' own per-card `+` toggle, SWAP OFFERS tab.
Gated behind `SWAP_BUILDER_ENABLED = false`, same as always. **This
session's V1 "SWAP NFT TRADE DETAILS" (`CREATE_OFFER_ENABLED`) reuses this
system's real backend** (`swap-offer-prepare/-payload/-status.js`,
`startSwapOffer` and friends) but is a separate, simpler, single-item-per-
side UI with its own state (`state.simpleOffer`) and its own flag — the two
systems don't interfere with each other, and the SWAP OFFERS tab is shared
by both (gated behind EITHER flag being on, see the "Initial load" section
near the bottom of `functions/swap.js`).

Same non-atomicity limitation applies to both — see "Why CREATE_OFFER_ENABLED
got turned back off" above, which is the fuller, more current writeup of
the same underlying XRPL limitation this section used to describe alone.

## The $PIGEONS marketplace (LIST / BUY / DELIST) — real, not gated, unchanged this session

Listing a Pigeon for $PIGEONS, buying a listed one, and delisting are all
real XRPL transactions, live on the page at all times.
- `PIGEONS_TOKEN_CONFIG` in `_shared.js`: `currency: 'PIGEONS'`, `issuer:
  'rfQVVT7X5FynwK87EczgP2T8RQXmQcQSf'` — verified on-ledger.
- `findPigeonsOffer(offers, owner)` — the ONLY correct way to find "the
  $PIGEONS offer" among an NFT's real sell offers.
- Every real `NFTokenCreateOffer` this app builds carries
  `swapOfferSourceMemo()` — a hex-encoded Memo identifying
  `https://soitbegins.xyz/swap` as the source, visible on any block
  explorer.

**Do not modify these three flows without explicit instruction** — heavy
back-and-forth verification against official XRPL docs and real live
testing; the exact txjson shapes are load-bearing.

## Xaman signing — off-Cloudflare relay, unchanged this session

`createXamanPayload`/`getXamanPayloadStatus` in `_shared.js` call
`env.XAMAN_PROXY_URL` + `env.XAMAN_PROXY_SHARED_SECRET` — not xumm.app
directly (Cloudflare-to-Cloudflare calls to xumm.app are silently blocked).
The proxy also signs the marketplace's own transactions via
`/broker-submit` (`submitAsBroker` in `_shared.js`) — a separate code path
from the Xaman relay.

`window.open()` for the Xaman tab must be called **synchronously** inside
the click handler, pointed at the real URL only once the fetch resolves —
every "OPEN XAMAN" button (including the new CREATE OFFER one this session)
follows this pattern; copy it exactly for any new one.

## Theme — unchanged this session

Cyan/magenta/purple "digital glitch" system. Cyan = general site chrome,
magenta = Scylla/target/selection/warning, green = a real clickable buy
action, purple (`--pigeon-purple`, `#8848f8`) = the currently-viewed
collection's own theme colour.

## Data sources — unchanged this session

**Deeptide** (`api.deeptide.co`): listings/detail/history/sales-recent/
owned/trait-cards. **xrp.cafe** (`api.xrp.cafe`): collection-stats + per-NFT
only, no bulk sorted-listings endpoint (re-confirmed, don't re-probe without
a new reason). `fetchXrpCafeNftListing` now caches 1 hour (was 10 min — see
"KV write cap" above).

## What KV is used for

All wrapped in `safeKvPut` (silently no-ops on quota exhaustion). Unchanged
list from before this session — number search index, highest/average-sale
index, Σκύλλα listings index, swap-offer pairs, sales log, Xaman push
tokens, brokered-accept pending state/lock, short-lived per-wallet/stats
caches. See gotcha 5a below — this is the recurring failure mode to watch.

## XRPL Batch amendment — checked, not usable, more relevant than ever

The one XRPL feature that would make a true atomic multi-transaction
settlement possible (XLS-56/BatchV1_1) is **not live on mainnet**. This is
now the direct reason `CREATE_OFFER_ENABLED` is off (see above), not just a
footnote about the $CRWN reward anymore. Don't assume Batch is available
without checking current status first — if it ever lands, it may be a much
cleaner fix for the swap-atomicity problem than the planned broker-escrow
version.

## Gotchas — read before touching swap.js again

1. **Never write a literal backtick anywhere inside the `SWAP_HTML` template
   literal** — not even in a comment. `node --check` on the outer file will
   NOT catch this reliably — it parses fine as an outer script, but the
   INNER client `<script>` silently corrupts (confirmed hit this exact
   mistake again this session, writing `` sets `top` `` in a comment —
   caught only by the render-and-check-the-inner-script step below, not by
   plain `node --check`). A failed Pages Functions build means **Cloudflare
   silently keeps serving the previous successful deploy** — no error
   surfaces anywhere except the Pages dashboard's build log.

2. **Escape sequences inside the client script need to survive TWO rounds**
   of interpretation. Any backslash meant to reach the browser as a real
   escape must be written **doubled** in the source (`\\d`, `\\'`). Simplest
   safe practice: just avoid apostrophes/contractions in any new user-facing
   string entirely ("D0N T", "!SN T") rather than escaping — every string
   added this session did this deliberately.

   **Run this before every push that touches swap.js**, not just
   `node --check functions/swap.js`:
   ```
   node --input-type=module -e "
   import { onRequestGet } from './functions/swap.js';
   import fs from 'fs';
   const res = await onRequestGet({ request: new Request('https://x/swap'), env: {} });
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
   Clean up temp files after (`rm -f rendered.html rendered_inner.js
   rendered_inner_bundled.js`).

   Also run this after any HTML restructuring:
   ```
   node -e "
   const fs = require('fs');
   const src = fs.readFileSync('functions/swap.js','utf8');
   const ids = [...src.matchAll(/id=\"([a-zA-Z0-9_]+)\"/g)].map(m=>m[1]);
   const counts = {}; ids.forEach(id => counts[id]=(counts[id]||0)+1);
   console.log('dup ids:', JSON.stringify(Object.entries(counts).filter(([k,v])=>v>1)));
   const listMatch = src.match(/var el = \{\};\s*\[([\s\S]*?)\]\.forEach/);
   const registered = [...listMatch[1].matchAll(/'([a-zA-Z0-9_]+)'/g)].map(m=>m[1]);
   const used = new Set([...src.matchAll(/el\.([a-zA-Z0-9_]+)/g)].map(m=>m[1]));
   console.log('missing:', JSON.stringify([...used].filter(u => !registered.includes(u))));
   const bt = (src.match(/\`/g) || []).length;
   console.log('backtick count:', bt);
   "
   ```
   Backtick count should be exactly 4. (`missing: ["body",
   "getBoundingClientRect"]` is a known false positive from the regex
   matching `el.body`/`el.getBoundingClientRect` usage patterns that aren't
   actual `el.*` element references — safe to ignore, confirmed harmless
   across this whole session.)

   Before every push: also scan the diff for anything secret-looking
   (`git diff <file> | grep -iE "secret|api_key|apikey|seed"`) and confirm
   `git fetch && git log --oneline HEAD..origin/main` is empty.

3. `Σκύλλα` must render mixed-case everywhere — check `text-transform` on
   every ancestor, not just the string casing. Site-wide recurring bug.

4. Cloudflare's per-request subrequest budget is real and hard — do the
   arithmetic before adding any new per-item enrichment call.

5. KV cache keys are versioned (`pswap:highsale:v3`, etc.) — bump the
   suffix again if you ever change a cached value's shape.

5a. **Cloudflare's free-tier KV cap is 1,000 writes/day and easy to blow
   through by accident** — hit this AGAIN this session (see "KV write cap"
   above), third time this specific cache has needed its TTL raised. If it
   recurs a fourth time, stop raising the number and actually redesign the
   caching strategy instead.

6. `NEVER trust a txjson the client sends back` — every `*-prepare.js` and
   `*-payload.js` endpoint re-derives the transaction from scratch
   server-side, re-checking ownership and live ledger state.

7. `swap-offers-received.js` blind-scans every OTHER Pigeon the seller owns
   (bounded, `OFFERS_RECEIVED_SCAN_CAP=45`) as a backfill in case a buyer
   closed their tab early — a wallet holding more than ~45 untracked
   Pigeons could still miss a real offer. First thing to check if offers
   ever don't show up.

8. `xaman-proxy` signs real transactions autonomously as the broker wallet
   now (`/broker-submit`, allowlisted to `NFTokenAcceptOffer`/`Payment`
   only). This wallet holds real funds — don't widen that allowlist without
   a specific reason. **This is the exact wallet/proxy the planned
   NFT-for-NFT escrow swap would also use** — any change here affects both
   features.

9. **NEW: when adding a new way to open `#screenDetail` from inside an
   overlay/modal** (a picker, a lightbox, anything layered on top), check
   the global "click outside closes detail" listener near the bottom of the
   click-wiring code — it excludes specific click targets
   (`.pigeon-img-box`, `#detailLightbox`, now `.simple-picker-view-btn`) by
   name, not by any general "was this inside an overlay" logic. A new entry
   point needs its own explicit exclusion or it'll open and instantly
   close itself (see bug #3 in the PλWS section above).

## Deploy

`git push origin main` from `soitbegins-portal-clone` → live on
soitbegins.xyz, **usually** within ~1-2 minutes via Cloudflare Pages, no
build step for the rest of the site (swap.js's bundling by esbuild is the
one exception — see gotcha #1). To watch live server-side logs while
testing: `npx wrangler pages deployment tail --project-name
soitbegins-portal` — reconnect it (Ctrl+C, rerun) after every new push.

`xaman-proxy` deploys separately on **Render** — a git push to `main` alone
does NOT redeploy it unless Render's auto-deploy is watching this
repo/subfolder; when `xaman-proxy/server.js` or `package.json` changes, a
Render redeploy needs to happen too (Render dashboard → the service →
Manual Deploy). Untouched this session.
