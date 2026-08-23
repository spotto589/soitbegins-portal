# Σκύλλα SWAP — handoff note (updated, supersedes any earlier version)

This file is stale the moment nobody updates it after a session — if you're
picking this up, skim it, then check `git log -30 --oneline` for what's
actually landed since it was last edited. Real money/assets move through
this page now, AND (new this session) a real marketplace fee + a second
service (`xaman-proxy`) now holds a live signing seed. Read the new
"Brokered accept-offer" section below before touching any of that.

## Repo
The LIVE repo (deploys to soitbegins.xyz via Cloudflare Pages on push to `main`):
`C:\Users\Admin\OneDrive\Desktop\soitbegins-portal-clone`
GitHub: `github.com/spotto589/soitbegins-portal`

⚠️ There is ALSO a stale, no-git-history folder at
`C:\Users\Admin\OneDrive\Desktop\Soitbegins.xyz` — don't confuse them. All real
work happens in `soitbegins-portal-clone`.

Other uncommitted changes sit in this working tree from earlier sessions
(`kingdom.js`, `redeem.js`, `scylla.js`, `index.html`, some `api/*.js` files) —
untouched by the /swap work below. Don't assume they're yours to commit;
check with the user before touching them.

There's also a second real service in this repo now: **`xaman-proxy/`**
(deployed separately on Render, `https://xaman-proxy.onrender.com`) — a
plain Node.js app, not a Cloudflare Worker. It originally existed just to
relay Xaman payload API calls (see "Xaman signing" below); this session it
grew a second job (see "Brokered accept-offer" below) and now **holds a
real XRPL wallet seed** as an env var (`BROKER_WALLET_SEED`) and the `xrpl`
npm package. Treat that env var like a password to real funds — never log
it, never echo it back in any response.

## Current status, at a glance

- **The $PIGEONS marketplace (LIST / BUY / DELIST) is real and live**, and
  unchanged this session — see its own section below.
- **Accepting a received MAKE AN OFFER buy-offer now goes through XRPL
  BROKERED `NFTokenAcceptOffer`** (built this session) — takes a real
  0.589% marketplace fee atomically in the same transaction, then fires a
  $CRWN reward (test-phase, flat amount) to both sides as a separate
  follow-up Payment. **Not yet confirmed working end-to-end** — the one
  live test so far actually executed a stale pre-brokered direct accept
  (confirmed via the real tx on-ledger), not the new brokered path. A
  clean retest is the next thing anyone picking this up should do. See
  "Brokered accept-offer" below in full before touching this again.
- **Xaman push notifications** (built this session, alongside the above) —
  infrastructure is in place (webhook receiver, per-wallet token storage,
  every `*-payload.js` endpoint wired to use a stored token when present)
  but **needs the webhook URL set in the Xaman Developer Console**
  (`https://soitbegins.xyz/api/xaman-webhook`) before any of it does
  anything — nothing registers that automatically. The webhook body field
  names were written from memory of Xaman's documented format, not
  verified against a live event — the handler logs the raw body
  (truncated) so the first real one can confirm/correct them.
- **A second feature — NFT-for-NFT swaps (barter, no $PIGEONS involved) — is
  fully built and working, but currently HIDDEN.** See "The swap builder"
  section below before assuming it doesn't exist just because you don't see
  it on the page.
- Xaman signing for **everything a user signs** goes through the
  off-Cloudflare relay (`xaman-proxy/`), not directly from the Cloudflare
  Worker to xumm.app — see "Xaman signing" below. This is load-bearing
  infrastructure; don't "simplify" it back to a direct fetch.
- **DATABASE tab's trustline banner was substantially redesigned this
  session** — see "Current page structure" below, the old description no
  longer matches.

## Brokered accept-offer (0.589% marketplace fee + $CRWN reward) — NEW, UNCONFIRMED

Accepting a received $PIGEONS buy-offer (OFFERS RECEIVED → ACCEPT OFFER)
used to be a plain direct `NFTokenAcceptOffer` (seller signs, no fee). It's
now XRPL **brokered** mode, so the marketplace fee is taken atomically in
the SAME settling transaction as the NFT transfer — never a second
Payment for the fee itself.

**The broker/developer wallet**: `rpigEoNV9KYjK6P9kzFmTqesbpqv7dpnzK` —
`MARKETPLACE_BROKER_WALLET` in `_shared.js`. Its seed lives ONLY as
`BROKER_WALLET_SEED` on the `xaman-proxy` Render service's env vars —
never in this repo.

**Fee math** — `computeMarketplaceFee(totalValueStr)` in `_shared.js`.
0.589% = 589/100000, done in integer "micro-unit" (6-decimal) arithmetic
so `feeValue + sellerValue` always sums to exactly `totalValue` — no
floating-point drift. Verified directly: `computeMarketplaceFee('100')` →
`{ totalValue: '100', feeValue: '0.589', sellerValue: '99.411' }`.

**The flow** (all three files: `swap-acceptoffer-prepare.js`,
`-payload.js`, `-status.js`):
1. Seller clicks ACCEPT OFFER → prepare/payload build the SELLER's own
   `NFTokenCreateOffer` (a real sell offer, `Destination` restricted to
   the broker wallet, `Amount` = the buy-offer total minus the fee) — the
   seller signs THIS via Xaman, not the final accept. Fee is computed
   server-side from the REAL on-ledger buy-offer amount, never trusted
   from the client.
2. `swap-acceptoffer-status.js` polls the seller's signature same as
   before. Once their sell offer is confirmed via a real
   `fetchNftSellOffers` read (never trusting Xaman's `dispatched_result`
   alone), THIS endpoint — not the browser — builds the actual brokered
   `NFTokenAcceptOffer` (`NFTokenBuyOffer` + `NFTokenSellOffer` +
   `NFTokenBrokerFee` + memos) and submits it via the broker wallet
   itself, through `xaman-proxy`'s new `/broker-submit` route (the
   marketplace is a party to this transaction, so it signs for itself —
   no Xaman involved for this leg at all).
3. `takePendingBrokerAccept` (single-consume KV read, `_shared.js`) means
   only the FIRST status poll to see the sell offer confirmed actually
   submits the broker transaction; a concurrent/retried poll instead
   re-reads real ledger state instead of resubmitting.
4. After the brokered accept validates, `verifyBrokerFeeFromMeta`
   (`_shared.js`) parses the settling transaction's OWN metadata (a
   RippleState/trust-line delta on the broker's own $PIGEONS line) to
   confirm the exact fee actually landed — not just trusting a
   `tesSUCCESS` result.
5. `payBrokerReward` then fires two separate broker-signed Payments (one
   to buyer, one to seller) of `SWAP_REWARD_TEST_AMOUNT` (currently a
   flat `'1'`) in `$CRWN` (`SWAP_REWARD_TOKEN_CONFIG`, currency `CRWN`,
   issuer `r99LZRNxxss7eSJqKTSEvp1Xd48JGh5Vp5` — confirmed real by the
   user, distinct from the unrelated `KINGDOM_CLAIM_CONFIG.crwn` entry
   used by the Kingdom King-holder claim feature, which stays untouched).
   **XRPL has no field for a third-party token payout inside
   `NFTokenAcceptOffer`** — this is a deliberate, acknowledged
   non-atomic follow-up, the closest practical approximation to "at the
   same time." Reward math is explicitly TEST-PHASE ("we'll run some
   maths later" — the user's words) — don't treat the flat `'1'` as a
   real production number.

**Double-accept protection**: `acquireBrokerAcceptLock`/
`releaseBrokerAcceptLock` (KV, per offerId) plus the single-consume
pending-state pattern above. Not a true atomic lock (Cloudflare KV has no
compare-and-swap) — the real backstop is the ledger itself, since
accepting a buy offer consumes it; a second brokered accept against the
same offer simply can't succeed regardless.

**Xaman-proxy side** (`xaman-proxy/server.js`, `package.json`): added the
`xrpl` npm dependency and a new `/broker-submit` route, allowlisted to
only ever sign `NFTokenAcceptOffer` or `Payment` (never an arbitrary
txjson) as the broker wallet. `BROKER_WALLET_SEED` must be set on Render
and the service redeployed to pick up `xrpl` — confirmed done this
session (user reported "its live").

**⚠️ Status: the one real test so far did NOT exercise this new code.**
The transaction hash the user checked
(`262AB38A91A48DD0CB5D2C82C53CCB2D3E773CF5547DA88AA64AFC75A46EEE06`) was
confirmed via direct ledger lookup (`tx` RPC method) to be a plain direct
`NFTokenAcceptOffer` — only `NFTokenBuyOffer`, no `NFTokenSellOffer`, no
`NFTokenBrokerFee` — almost certainly a stale Xaman request signed
directly through the Xaman app (found "hidden in Requests, N/A") rather
than through the site's own OPEN XAMAN button, likely from the small
window before this session's deploy had fully propagated. **A clean
retest through the site's own ACCEPT OFFER → OPEN XAMAN flow is the very
next thing to do** — watch `wrangler pages deployment tail` live while it
runs, and independently verify the resulting tx hash on Bithomp shows the
`NFTokenBrokerFee` field and a real balance change on the broker wallet.

## Xaman push notifications — NEW, NEEDS WEBHOOK URL SET

New `functions/api/xaman-webhook.js` — receives Xaman's server-to-server
callback when a payload created with `push:true` resolves and the user's
app grants push. It re-fetches the full payload via the already-existing
`getXamanPayloadStatus()` to reliably learn which wallet resolved it
(`response.account`) rather than trusting the webhook body's own claim,
then stores that wallet's reusable push token via
`getXamanUserToken`/`storeXamanUserToken`/`clearXamanUserToken` in
`_shared.js` (KV, durable, no TTL).

`createXamanPayload(env, txjson, options, userToken, attempt)` — now
takes a `userToken` 4th param (shifted `attempt` to 5th — check for any
NEW call site that might still be passing `attempt` positionally as the
4th arg, there shouldn't be any as of this write-up but verify). When a
stored token exists for the signing wallet, the payload is created with
`push:true` and `user_token` forwarded so Xaman can push straight to
their phone; wired into **every** `*-payload.js` endpoint (LIST, BUY,
MAKE OFFER, ACCEPT OFFER, DELIST, ACCEPT, the swap builder's OFFER) —
each now does `const pushToken = await getXamanUserToken(env.coin, <wallet var>);`
right before `createXamanPayload`.

**Needs before this does anything**: the webhook/callback URL
(`https://soitbegins.xyz/api/xaman-webhook`) must be set in the **Xaman
Developer Console** (apps.xumm.dev) for this app — nothing registers it
automatically, and as of this write-up it's unconfirmed whether the user
has done this yet.

**Honest caveat**: the exact webhook body field names
(`body.userToken.user_token` vs `body.user_token`, `body.meta.payload_uuidv4`
vs `body.payloadResponse.payload_uuidv4` vs top-level `body.payload_uuidv4`)
were written from memory of Xaman's documented format, not verified
against a live event. The handler logs the raw body (truncated to 1000
chars) via `console.log('xaman-webhook received:', ...)` — check
`wrangler pages deployment tail` (or the Cloudflare Pages Functions log
viewer) after the first real webhook fires, and adjust the extraction in
`xaman-webhook.js` if the real shape differs from the guess.

## The swap builder (NFT-for-NFT, non-atomic, currently hidden)

XRPL has no native NFT-for-NFT offer — `NFTokenCreateOffer`'s `Amount` is
always XRP or an issued currency, never another NFT. So this is built as two
independent `NFTokenCreateOffer`s (each `Amount: "0"`, `Destination`-
restricted to the counterparty), tracked as a linked "pair" in KV, plus two
independent `NFTokenAcceptOffer`s once both sides have offered. **This is
never atomic** — nothing stops one side from accepting and the other never
following through. That's a real, permanent XRPL limitation, not a bug to
fix later.

**Everything is gated behind one flag** in `functions/swap.js`, near the top
of the client script (search for `SWAP_BUILDER_ENABLED`):

```js
var SWAP_BUILDER_ENABLED = false;
```

Flip it to `true` to bring back:
- The **CREATE AN OFFER** box on DATABASE (persistent, always visible when on)
- MY PIGEONS' own `+` "add to offer" toggle on each card
- The **SWAP OFFERS** tab (discover/reciprocate/accept pending pairs)

Nothing behind the flag was removed — it's a pure display gate (three
`display:none` / conditional-render sites, all reading the same flag).
Server-side endpoints, KV data, and everything else keep working regardless
of the flag's state.

Server files for this feature (all additive, none of them touch BUY/LIST/
DELIST): `swap-offer-prepare/-payload/-status.js`, `swap-offers-mine.js`,
`swap-accept-prepare/-payload/-status.js` (this is a DIFFERENT
`swap-accept-*` set than the brokered `swap-acceptoffer-*` above — don't
confuse the two; `swap-accept-*` is the swap builder's own free-transfer
NFT-for-NFT accept, `swap-acceptoffer-*` is the $PIGEONS buy-offer
brokered accept). `_shared.js`: `findSwapOffer(offers, owner, destination)`
matches the `Amount: "0"` string shape, separate from `findPigeonsOffer`
(issued-currency object shape) — never conflate the two.

**Tested live, once, successfully:** one side creating their offer
(`NFTokenCreateOffer`) and the destination wallet accepting it manually via
Bithomp (proving the on-ledger mechanics work). **Not yet tested live:**
the in-app reciprocate flow (SWAP OFFERS tab → CREATE MATCHING OFFER) or the
in-app accept flow (ACCEPT SWAP button).

Explicitly out of scope until asked: expanding past 1-for-1, fees,
negotiation, a true atomic mechanism (would require the XRPL Batch
amendment, not live on mainnet — see "XRPL Batch" note below).

## The $PIGEONS marketplace (LIST / BUY / DELIST) — real, not gated

Listing a Pigeon for $PIGEONS, buying a listed one, and delisting are all
real XRPL transactions, live on the page at all times (not behind any flag),
unchanged this session.
- `PIGEONS_TOKEN_CONFIG` in `_shared.js`: `currency: 'PIGEONS'`,
  `issuer: 'rfQVVT7X5FynwK87EczgP2T8RQXmQcQSf'` — verified on-ledger.
- `findPigeonsOffer(offers, owner)` in `_shared.js` — the ONLY correct way
  to find "the $PIGEONS offer" among an NFT's real sell offers. Never use
  `offers[0]` or match on owner alone.
- Server files: `swap-listing-prepare/payload/status.js` (LIST),
  `swap-buy-prepare/payload/status.js` (BUY), `swap-delist-prepare/payload/
  status.js` (DELIST). Every one re-derives and re-validates its txjson
  server-side from just an nftId (never trusts a txjson the client sends
  back), and every status endpoint re-verifies on real ledger state before
  declaring success.
- BUY sales get recorded into `pswap:saleslog:v1` (`recordSwapSale`) and
  merged into the SALES HISTORY tab alongside Deeptide's own feed.
- **Every real `NFTokenCreateOffer` this app builds** (LIST, MAKE OFFER,
  the swap builder's OFFER, and the brokered accept's seller sell-offer)
  now carries `swapOfferSourceMemo()` — a hex-encoded XRPL Memo
  identifying `https://soitbegins.xyz/swap` as the source, visible on any
  block explorer.

**Do not modify these three flows without explicit instruction** — they
were built with heavy back-and-forth verification against official XRPL
docs and real live testing; the exact txjson shapes are load-bearing.

## Xaman signing — goes through an off-Cloudflare relay (now also does broker signing)

`createXamanPayload(env, txjson, options, userToken, attempt)` /
`getXamanPayloadStatus(env, uuid)` in `_shared.js` call
`env.XAMAN_PROXY_URL` + `env.XAMAN_PROXY_SHARED_SECRET` — **not** xumm.app
directly. This exists because Cloudflare Workers calling xumm.app directly
gets silently blocked (confirmed live: status 400, empty body, missing
`cf-ray`/`server: cloudflare` headers — a Cloudflare-to-Cloudflare
network-path failure, not an application-level rejection). The proxy
(`xaman-proxy/`, deployed separately on Render) re-homes that one outbound
call elsewhere. The real Xaman API key/secret live ONLY in the proxy's own
env; this side authenticates with `XAMAN_PROXY_SHARED_SECRET`.

**New this session**: the same proxy ALSO now holds `BROKER_WALLET_SEED`
and uses the `xrpl` npm package to sign+submit the marketplace's OWN
transactions (brokered accept, $CRWN rewards) via `/broker-submit` — a
completely separate code path from the Xaman relay (`submitAsBroker` in
`_shared.js`, not `createXamanPayload`). If Xaman-signed flows (LIST/BUY/
MAKE OFFER/etc) suddenly break, check the proxy is up; if only the
BROKERED accept step fails, check `BROKER_WALLET_SEED` is actually set and
the proxy redeployed with the `xrpl` dependency before assuming a code
regression.

Also: `window.open()` for the Xaman tab must be called **synchronously**
inside the click handler (open a blank tab immediately, set `.location.href`
once the async fetch resolves) — doing it inside the `.then()` callback gets
silently popup-blocked by the browser. Every "OPEN XAMAN" button in this
file follows this pattern now; copy it exactly for any new one.

## Theme

Cyan/magenta/purple "digital glitch" system. Cyan = general site
static/hover chrome not tied to a specific collection, magenta = Scylla/
target/selection/warning, green = a real, clickable buy action
specifically, **purple (`--pigeon-purple`, `#8848f8`) = the currently-
viewed collection's own theme colour** (Pigeons specifically — sampled
live from the coin artwork). This session extended the "collection gets
its own colour" idea to the COLLECTION :: picker list itself: PIGEONS
purple, FUZZY dark brown, PHNIX red-orange (all placeholders except
Pigeons, but each now visually distinct instead of a shared cyan-active/
grey-disabled palette).

## Current page structure — SUBSTANTIALLY REWORKED this session, old
descriptions of this area no longer apply

Top to bottom, in DOM/visual order:
1. `<h1>Σκύλλα :: SWAP</h1>`.
2. **`.db-select-wrap`** — "STAT!C DATABASE" static label, then
   `.db-collection-row`: `C0LLECT!0N ::` + the `#dbSelectWrap` hover
   flyout (PIGEONS/FUZZY/PHNIX, each its own colour per Theme above) +
   the **"New to the XRPL..." onboard link**, pinned to this row's own
   right edge (moved out of the trustline box entirely this session —
   restyled for the plain page background: grey text, cyan hover,
   instead of its old white-on-purple treatment).
3. **`.pigeons-merged-panel`** — the trustline banner and the stats info
   box are ONE unified purple box now (not two separate elements with a
   gap), containing, top to bottom:
   - **`#collectionDetailsPanel`** (the stats carousel) — same purple
     gradient theme as the rest of the panel now (not its own dark
     digital-glitch background). **3 pages, FLOOR shown FIRST**: FLOOR::
     XRP.CAFE, **$PIGEONS FLOOR in the MIDDLE**, FLOOR::DEEPTIDE, then
     auto-rotates to ITEMS/HOLDERS/VOLUME/LISTED, then 24H ACTIVITY.
     Prev/next arrows (`#statsPrevBtn`/`#statsNextBtn`) are a solid
     darker-purple fill with white icons now (were transparent/cyan-dim
     — read as real buttons against the purple background). `.stat-label`
     text bumped 9px → 11.5px across every stat tile for readability.
   - **`.pigeons-bar-identity-row`** — big (140px) thumbnail next to SET
     TRUSTLINE TO $PIGEONS / ISSUER ADDRESS / address / **`[ C0PY
     ADDRESS ]` + `[ L0G!N ]` side by side** (`.pigeons-bar-identity-actions`).
     LOGIN reuses the EXACT SAME `XummPkce` OAuth flow the MY PIGEONS
     tab's own CONNECT SCYLLA button uses (`loginRedirectTab` tracks
     which button triggered it, so it lands back on DATABASE vs MY
     PIGEONS afterward). Once `MY_WALLET` is a real server-verified
     session, this whole block is replaced by `#pigeonsBarLoggedIn`:
     wallet address, real held-Pigeons count, real $PIGEONS
     balance/trustline status (new `fetchPigeonsAccountLine()` —
     `account_lines` XRPL call, peer-filtered to the PIGEONS issuer,
     comparing the raw HEX currency code since `account_lines` never
     returns the decoded ASCII), and a **`[ SH0W MY P!GE0NS ]`** button
     that reuses the existing `browseOwnerCollection(MY_WALLET, 'Y0U')`
     path to switch DATABASE to the user's own held Pigeons.
   - **`.pigeons-bar-bottom-row`** — `VIEW ON DEXSCREENER` far left
     (real pair URL + favicon icon, black background), **"1 XRP = N
     $PIGEONS"** centered (flipped this session from "1 PIGEONS = X
     XRP" — same underlying rate, `fetchPigeonsXrpRate`/DexScreener's
     trade-derived price, `refreshTrustlineRate()` polls every 60s),
     the **calculator** on the right with its own "EXCHANGE RATE" title
     above it (XRP in → $PIGEONS out, live coin icon that tracks the
     typed number's position and pulses on change —
     `animateOfferCoin`/`formatThousandsInput` pattern, see below).
4. `#topTabs` — DATABASE / MY PIGEONS / TOP 10 / SALES H!ST0RY.
5. Whichever tab's own panel is active. **DATABASE tab** (`#screenBrowse`):
   - `.db-config-group` — VIEW (BOXED VIEW is now **disabled**, marked
     "(C0M!NG S00N)" — THUMBNAILS is the only selectable/default view;
     see the `project_boxed_view_paused` memory for exactly where to
     resume that later), `C0LLECT!0N SELECT!0N:` (edition toggle, now
     PURPLE when active, not magenta), `S0RT!NG BY:` — **reordered to
     RARITY → PRICE → ALPHABETICAL → HISTORICAL SALES**, and now
     **click-to-open, not hover** (see below), always shows the filled-
     purple "active pick" look.
   - `.sort-stack-row` — ADD TRAITS (bigger label/padding this session)
     is ALSO click-to-open now, not hover, and **ticking a value no
     longer closes the menu** — click adds a ✓/`.selected` state and
     keeps the flyout open so you can pick several traits across
     categories in one sitting; clicking an already-ticked value
     un-ticks it. Applied trait chips (`#traitRows`) render INLINE in
     this same row now (stacking horizontally next to ADD TRAITS),
     not in their own section below it. A shared `document`-level
     click-outside listener closes whichever of SORTING BY/ADD TRAITS
     is open (needed now that hover-to-close no longer applies).
   - `.results-header-row` — **one combined search box** (`#searchInput`,
     widened, purple GO button) that detects whether you typed a Pigeon
     number OR a wallet address and routes accordingly
     (`browseOwnerCollection` for a wallet match) — the old separate
     SEARCH WALLET ADDRESS box was removed/merged into this one.
     Wallet-scoped results show `"SH0W!NG RESULTS F0R :: WALLET: <short>
     :: N PIGEONS"` instead of the generic `"RESULTS :: N"` line.
   - Card layout: **`pigeonsActionBoxHtml(p)`** (`swap.js`) replaced the
     old separate `scyllaListedHtml`/`offerStripHtml` pair — BUY NOW
     (green, only if a real Σκύλλα listing exists) and the OFFER AMOUNT
     input+SEND now share ONE purple box, no more separate magenta BUY
     NOW bar. No coin thumbnail on the box itself any more (redundant
     once merged). The OFFER AMOUNT input: text centered, bigger/bolder
     (20px), live thousands-separator formatting as you type
     (`formatThousandsInput`), and the $PIGEONS coin icon inside the
     field dynamically tracks the typed number's rendered left edge
     (canvas `measureText` against the input's own computed font) with
     a quick "coin flip" + green glow pulse on every change
     (`animateOfferCoin`) — purely cosmetic, `submitMakeOffer`'s two
     call sites strip the commas back out before hitting the API.

## Data sources — the two real marketplaces

Unchanged this session — see prior notes on Deeptide/xrp.cafe if working
in that area; nothing here was touched.

**Deeptide** (`api.deeptide.co`): listings/detail/history/sales-recent/
owned/trait-cards, `crossListing` special-cased for `price-asc/desc`'s
sparse real pricing.

**xrp.cafe** (`api.xrp.cafe`): collection-stats + per-NFT only, no bulk
sorted-listings endpoint exists (re-confirmed, don't re-probe without a
new reason). `fetchXrpCafeNftListing` caches 10 min (was 60s — that
shorter TTL blew through Cloudflare's 1,000 writes/day KV cap once
already, see gotcha 5a).

## What KV is used for (all wrapped in `safeKvPut`, silently no-ops on quota
exhaustion so browsing never breaks even if the daily write cap is hit)
- **Number search index** (`pswap:numbermap:v1`).
- **Highest/average-sale index** (`pswap:highsale:v3`).
- **Σκύλλα listings index** (`pswap:listings:v1`).
- **Swap-offer pairs** (`pswap:offerpairs:v1`) — swap builder.
- **Sales log** (`pswap:saleslog:v1`).
- **NEW: Xaman push tokens** (`pswap:xamanusertoken:<wallet>`) — durable,
  no TTL, see "Xaman push notifications" above.
- **NEW: Brokered-accept pending state** (`pswap:pendingbrokeraccept:<uuid>`,
  15 min TTL) and **lock** (`pswap:brokeracceptlock:<offerId>`, 10 min TTL)
  — see "Brokered accept-offer" above.
- Short-lived per-wallet Deeptide cache; xrp.cafe stats cache (5 min);
  trait-cards cache; Crown/top-holders snapshot (shared with `board.js`).

## XRPL Batch amendment — checked, not usable

The one XRPL feature that would make a true atomic multi-transaction
settlement possible (XLS-56/BatchV1_1) is **not live on mainnet** — this
is also exactly why the $CRWN reward above is a separate follow-up
Payment instead of one atomic transaction alongside the brokered accept.
Don't assume Batch is available without checking current status first.

## Gotchas — read before touching swap.js again

1. **Never write a literal backtick anywhere inside the `SWAP_HTML` template
   literal** — not even in a comment. `node --check` on the outer file will
   NOT catch this reliably. A failed Pages Functions build means
   **Cloudflare silently keeps serving the previous successful deploy** —
   no error surfaces anywhere except the Pages dashboard's build log.

2. **Escape sequences inside the client script need to survive TWO rounds**
   of interpretation. Any backslash meant to reach the browser as a real
   escape (regex `\d`, an escaped `'` inside a single-quoted string) must
   be written **doubled** in the source (`\\d`, `\\'`).

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
   Backtick count should be exactly 4.

   Before every push: also scan the diff for anything secret-looking
   (`git diff <file> | grep -iE "secret|api_key|apikey|seed"`) and confirm
   `git fetch && git log --oneline HEAD..origin/main` is empty. **This
   matters even more now** — `_shared.js`/`xaman-proxy/server.js` reference
   `BROKER_WALLET_SEED` as an env-var NAME, never a real value, but
   double-check that stays true on every future diff involving those files.

3. `Σκύλλα` must render mixed-case everywhere — check `text-transform` on
   every ancestor, not just the string casing. Site-wide recurring bug.

4. Cloudflare's per-request subrequest budget is real and hard — do the
   arithmetic before adding any new per-item enrichment call
   (`LISTINGS_ENRICH_CAP`/`LISTINGS_ENRICH_CAP_LOW` in `pigeons.js`,
   `OFFERS_RECEIVED_SCAN_CAP=45` in the new blind-scan fallback in
   `swap-offers-received.js`, same reasoning).

5. KV cache keys are versioned (`pswap:highsale:v3`, etc.) — bump the
   suffix again if you ever change a cached value's shape.

5a. **Cloudflare's free-tier KV cap is 1,000 writes/day and easy to blow
   through by accident.** Do the arithmetic (fan-out × misses/hour) before
   picking a TTL, not after.

6. `NEVER trust a txjson the client sends back` — every `*-prepare.js` and
   `*-payload.js` endpoint re-derives the transaction from scratch
   server-side, re-checking ownership and live ledger state. This is
   deliberate, load-bearing defense.

7. **NEW: `swap-offers-received.js` only used to trust its own KV index**
   of tracked buy-offers (populated only once the BUYER's own MAKE OFFER
   confirm screen polls all the way through) — if a buyer closed their
   tab early, a real live offer could stay invisible to the seller
   forever. Fixed this session by also blind-scanning every OTHER Pigeon
   the seller owns (bounded, `OFFERS_RECEIVED_SCAN_CAP=45`) and
   backfilling the index — but if offers still don't show up, this
   scan-cap is the first thing to check (a wallet holding more than ~45
   untracked Pigeons could still miss one).

8. **NEW: `xaman-proxy` is no longer "just a relay."** It now signs real
   transactions autonomously as the broker wallet. Before touching
   `xaman-proxy/server.js`: the `/payload` and `/payload/:uuid` routes are
   the ORIGINAL Xaman relay (untouched); `/broker-submit` is the NEW
   self-signing route, allowlisted to `NFTokenAcceptOffer`/`Payment` only
   — don't widen that allowlist without a specific reason, this wallet
   holds real funds.

## Deploy

`git push origin main` from `soitbegins-portal-clone` → live on
soitbegins.xyz, **usually** within ~1-2 minutes via Cloudflare Pages, no
build step for the rest of the site (swap.js's bundling by esbuild is the
one exception — see gotcha #1). To watch live server-side logs while
testing: `npx wrangler pages deployment tail --project-name
soitbegins-portal` — reconnect it (Ctrl+C, rerun) after every new push.

`xaman-proxy` deploys separately on **Render** — a git push to `main`
alone does NOT redeploy it unless Render's auto-deploy is watching this
repo/subfolder; when `xaman-proxy/server.js` or `package.json` changes
(like this session's `xrpl` dependency + `/broker-submit` route), a
Render redeploy needs to happen too (Render dashboard → the service →
Manual Deploy, or confirm auto-deploy picked it up) — confirmed done once
this session ("its live" — `xaman-proxy listening on port 10000`), but
verify again on any FUTURE `xaman-proxy/` change.
