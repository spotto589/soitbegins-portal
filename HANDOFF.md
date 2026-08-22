# Σκύλλα SWAP — handoff note (updated, supersedes any earlier version)

This file is stale the moment nobody updates it after a session — if you're
picking this up, skim it, then check `git log -30 --oneline` for what's
actually landed since it was last edited. The previous version of this file
described a read-only prototype with no real transactions at all — that is
**no longer true**. Real money/assets move through this page now.

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

## Current status, at a glance

- **The $PIGEONS marketplace (LIST / BUY / DELIST) is real and live.** Real
  `NFTokenCreateOffer` / `NFTokenAcceptOffer` / `NFTokenCancelOffer`
  transactions, signed via real Xaman sign requests, verified against real
  on-ledger state before ever declaring success. This is not a prototype.
- **A second feature — NFT-for-NFT swaps (barter, no $PIGEONS involved) — is
  fully built and working, but currently HIDDEN.** See "The swap builder"
  section below before assuming it doesn't exist just because you don't see
  it on the page.
- Xaman signing for **everything** goes through an off-Cloudflare relay
  (`xaman-proxy/`, deployed separately on Render), not directly from the
  Cloudflare Worker to xumm.app — see "Xaman signing" below. This is load-
  bearing infrastructure; don't "simplify" it back to a direct fetch.

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
DELIST):
- `functions/api/swap-offer-prepare.js` / `-payload.js` / `-status.js` —
  builds/signs/confirms one side's `NFTokenCreateOffer`, and on confirmed
  success records/updates the pair in KV (`pswap:offerpairs:v1`, via
  `getSwapOfferPairs`/`recordSwapOfferPair`/`removeSwapOfferPair` in
  `_shared.js`).
- `functions/api/swap-offers-mine.js` — lists every pending pair involving
  the signed-in wallet (either side), enriched with real image/number for
  both NFTs, and a computed `action` field (`need_to_offer` /
  `waiting_for_other_offer` / `ready_to_accept` / `waiting_for_other_accept`).
- `functions/api/swap-accept-prepare.js` / `-payload.js` / `-status.js` —
  builds/signs/confirms `NFTokenAcceptOffer` against the OTHER side's live
  offer (re-verified against real `nft_sell_offers`, never trusting the
  cached KV offerId blindly), mirrors `swap-buy-status.js`'s double check
  (NFT now owned + offer gone) before declaring settled.
- `_shared.js`: `findSwapOffer(offers, owner, destination)` — matches the
  `Amount: "0"` string shape, separate from `findPigeonsOffer` (which
  matches the $PIGEONS issued-currency object shape). Never conflate the two.

**Tested live, once, successfully:** one side creating their offer
(`NFTokenCreateOffer`) and the destination wallet accepting it manually via
Bithomp (proving the on-ledger mechanics work). **Not yet tested live:**
the in-app reciprocate flow (SWAP OFFERS tab → CREATE MATCHING OFFER) or the
in-app accept flow (ACCEPT SWAP button) — those were built and pass the
static verification pipeline, but no real end-to-end run through the actual
UI has happened yet. If you re-enable this, that's the first thing to
verify with the user, the same careful way BUY was debugged (exact txjson
shown before signing, watch `wrangler pages deployment tail` live).

Explicitly out of scope until asked: expanding past 1-for-1 to 2-4 NFTs per
side (the pair/offer/accept mechanism was written generically enough to
extend, but the UI enforces exactly 1-for-1 for now — see the
`offerIds.length !== 1` guard in `reviewCreateBtn`'s handler), fees,
negotiation, a true atomic mechanism (would require the XRPL Batch
amendment, which is not live on mainnet — see "XRPL Batch" note below).

## The $PIGEONS marketplace (LIST / BUY / DELIST) — real, not gated

Listing a Pigeon for $PIGEONS, buying a listed one, and delisting are all
real XRPL transactions, live on the page at all times (not behind any flag).
- `PIGEONS_TOKEN_CONFIG` in `_shared.js`: `currency: 'PIGEONS'`,
  `issuer: 'rfQVVT7X5FynwK87EczgP2T8RQXmQcQSf'` — verified on-ledger
  (`account_lines` shows real trust lines for the hex-encoded currency).
  This is the real, confirmed issuer — the earlier version of this note's
  warning about an unverified address no longer applies.
- `findPigeonsOffer(offers, owner)` in `_shared.js` — the ONLY correct way
  to find "the $PIGEONS offer" among an NFT's real sell offers. A single
  Pigeon can carry simultaneous offers in different currencies (confirmed
  live) — never use `offers[0]` or match on owner alone.
- Server files: `swap-listing-prepare/payload/status.js` (LIST),
  `swap-buy-prepare/payload/status.js` (BUY), `swap-delist-prepare/payload/
  status.js` (DELIST). Every one re-derives and re-validates its txjson
  server-side from just an nftId (never trusts a txjson the client sends
  back), and every status endpoint re-verifies on real ledger state before
  declaring success.
- BUY sales get recorded into `pswap:saleslog:v1` (`recordSwapSale`) and
  merged into the SALES DATA tab alongside Deeptide's own feed.

**Do not modify these three flows without explicit instruction** — they
were built with heavy back-and-forth verification against official XRPL
docs and real live testing; the exact txjson shapes are load-bearing.

## Xaman signing — goes through an off-Cloudflare proxy

`createXamanPayload(env, txjson, options)` / `getXamanPayloadStatus(env, uuid)`
in `_shared.js` call `env.XAMAN_PROXY_URL` + `env.XAMAN_PROXY_SHARED_SECRET`
— **not** xumm.app directly. This exists because Cloudflare Workers calling
xumm.app directly gets silently blocked (confirmed live: status 400, empty
body, missing `cf-ray`/`server: cloudflare` headers — a Cloudflare-to-
Cloudflare network-path failure, not an application-level rejection, and not
fixable by retrying from the same Worker). The proxy (`xaman-proxy/`
subfolder, deployed separately — check with the user for where, likely
Render) re-homes just that one outbound call elsewhere. The real Xaman API
key/secret live ONLY in the proxy's own env; this side authenticates with
`XAMAN_PROXY_SHARED_SECRET` instead.

If Xaman signing suddenly breaks again, check the proxy is actually up
before assuming it's a code regression here.

Also: `window.open()` for the Xaman tab must be called **synchronously**
inside the click handler (open a blank tab immediately, set `.location.href`
once the async fetch resolves) — doing it inside the `.then()` callback gets
silently popup-blocked by the browser. Every "OPEN XAMAN" button in this
file follows this pattern now; copy it exactly for any new one.

## Theme

Cyan/magenta "digital glitch" system — **not** the old caution-yellow/
matrix-green scheme this note used to describe (that was retheme'd earlier
in the swap.js history). Search the `<style>` block's `:root` for `--cyan`,
`--magenta`, `--green` (added for listing prices / buy-boxes). Cyan =
signal/active/your-own-stuff, magenta = Scylla/target/selection/warning,
green = a real, clickable buy action specifically.

## Current page structure (DATABASE tab)

Top to bottom: collection info + stats strip, the CREATE AN OFFER box (only
if `SWAP_BUILDER_ENABLED`), search row (search box, GO, SORT drop-box,
edition ALL/1st/2nd toggle), TRAITS drop-box, then the results themselves —
**a two-column list of wide rows** (`result-list` / `result-row`), NOT a
grid of tiles. Each row: thumbnail/number/rarity fixed on the left (220px),
everything else (XRP.CAFE + DEEPTIDE listing boxes — the whole box is the
buy link when a real listing exists, filled green — plus highest recorded
sale and average sale) on the right. MY PIGEONS still uses the OLD grid-tile
layout (`myPigeonCardHtml`, `.result-card` only, no `.result-row`) —
deliberately different, don't try to unify them without being asked.

**SORT** and **TRAITS** are both the same custom hover-flyout component
(`.traits-hover-wrap` / `.traits-flyout`, shared CSS): hover the label,
hover a category on the left, click a value on the right. SORT categories:
Alphabetical, Listings, Historical Sales (Highest Recorded / Lowest-
Average — the average option, `AVG_SALE_ASC`, uses `totalDrops`/`count`
tracked alongside the max in the highest-sale KV index, see below), Rarity.
This fully replaced an earlier native `<select>` and a later drag-to-
reorder "stack" concept — both superseded, don't resurrect either.

## Data sources — the two real marketplaces

**Deeptide** (`api.deeptide.co`) is the primary source:
- `GET /api/mint/listings/xrpigeons?skip=&limit=&sort=&traits=` — real,
  paginated (max `limit=60`), sortable, AND-filterable by trait.
  **`price-asc`/`price-desc` only has a real price for a small handful of
  items** (confirmed live: 12, in one snapshot) before falling back to
  null-priced items in no particular order — naively paginating this sort
  produces wrong cross-page ordering. The `crossListing` branch in
  `pigeons.js` now pulls one bounded batch, drops the null-priced noise,
  and returns a single non-paginated (small, honest) result instead — see
  the comment there before "fixing" it back to paginated.
- `GET /api/mint/nft/{nftTokenId}` — single-token detail.
- `GET /api/mint/nft/{id}/history` — per-token mint/transfer/sale log.
- `GET /api/sales/recent?shopSlug=&skip=&limit=&sort=&address=` — shop-wide
  sales feed, merged with Σκύλλα's own recorded BUY sales for SALES DATA.
- `GET /api/mint/owned?address=` — one wallet's full holdings.
- `GET .../listings/xrpigeons/trait-cards?skip=&limit=` — trait counts,
  percentages now computed to **3 decimal places** (was 1) —
  `getTraitCategoriesWithPercent` in `_shared.js`.

**xrp.cafe** (`api.xrp.cafe`) — a second, independent marketplace:
- `GET /api/collection/xrpigeons` — floor/volume/holders/listed%. Cached
  5 min in KV.
- `GET /api/nft/{nftTokenId}` — `amount` is in **drops, not XRP**. Only
  trust it when `offerowner === actualowner`. `fetchXrpCafeNftListing` now
  retries once on failure/rate-limit (mirrors the xrplcluster.com pattern)
  — a failed lookup must never look identical to "confirmed not listed."
  There is still **no bulk "sorted by price" endpoint** on xrp.cafe (tried
  several plausible routes, all 404/500) — this is why the cross-market
  sort can't be a true global sort, see above.
- `LISTINGS_ENRICH_CAP_LOW` in `pigeons.js` (branches that already spend a
  per-item Deeptide detail fetch) was raised from 10 to 36 — most of a page
  was silently getting NO xrp.cafe check at all, not "confirmed unlisted."
  `swap-listing-owned.js` already safely fires up to 45 concurrent XRPL
  calls elsewhere in this app, so there's real headroom above the old 10.

## What KV is used for (all wrapped in `safeKvPut`, silently no-ops on quota
exhaustion so browsing never breaks even if the daily write cap is hit)
- **Number search index** (`pswap:numbermap:v1`) — complete (3015/3015).
- **Highest/average-sale index** (`pswap:highsale:v3` — bumped from v2).
  Same self-resuming crawl over `/api/sales/recent`, now stores
  `{drops, txHash, totalDrops, count}` per token instead of just
  `{drops, txHash}` — `totalDrops/count` gives a real average sale price
  from the exact same crawl, no second index needed. If you ever change
  this shape again, bump the key suffix again (v4) or old entries will
  silently serve mismatched data.
- **Σκύλλα listings index** (`pswap:listings:v1`) — real $PIGEONS listings,
  written by `swap-listing-status.js` the moment a LIST confirms on-ledger.
- **Swap-offer pairs** (`pswap:offerpairs:v1`) — see "The swap builder"
  above.
- **Sales log** (`pswap:saleslog:v1`) — Σκύλλα's own recorded BUY sales.
- Short-lived per-wallet Deeptide cache; xrp.cafe stats cache (5 min);
  trait-cards cache.
- Crown/top-holders snapshot — shared with `board.js`'s pre-existing Crown
  feature.

## XRPL Batch amendment — checked, not usable

The one XRPL feature that would make a true atomic NFT-for-NFT swap
possible (XLS-56/BatchV1_1) is **not live on mainnet**. The original design
had a signature-validation security bug found in Feb 2026, was blocked from
ever activating, and its replacement isn't live either as of this writing.
Don't assume it's available without checking current status first.

## Gotchas — read before touching swap.js again

1. **Never write a literal backtick anywhere inside the `SWAP_HTML` template
   literal** — not even in a comment. The whole file's HTML/CSS/JS lives
   inside one outer `` const SWAP_HTML = `...` `` string; a stray backtick
   closes it early. `node --check` on the outer file will NOT catch this
   reliably. Cloudflare's esbuild build does catch it, but only at deploy
   time, and a failed Pages Functions build means **Cloudflare silently
   keeps serving the previous successful deploy** — no error surfaces
   anywhere except the Pages dashboard's build log. If a push doesn't seem
   to take effect after ~2 minutes, check that first, don't just wait.

2. **Escape sequences inside the client script need to survive TWO rounds**
   of interpretation: once when the outer template literal is evaluated,
   once when the browser parses the resulting `<script>` as JS. Any
   backslash meant to reach the browser as a real escape (regex `\d`, an
   escaped `'` inside a single-quoted string) must be written **doubled**
   in the source (`\\d`, `\\'`). A single backslash gets consumed by the
   outer template literal and the browser receives a bare, unescaped
   character — for an apostrophe this kills the *entire* client script with
   a cryptic `Unexpected identifier` error. `node --check` on the outer
   file **cannot catch this at all**.

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
   This renders the ACTUAL post-template-literal output and checks *that*,
   with the same tool (esbuild) Cloudflare's build uses. Clean up the temp
   files after (`rm -f rendered.html rendered_inner.js
   rendered_inner_bundled.js`).

   Also run this after any HTML restructuring (duplicate ids silently break
   `getElementById`; a JS reference to an `el.xxx` never registered in the
   `el = {}` list throws at first use):
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
   Backtick count should be exactly 4 (the template literal's own open/close
   plus two more inside the verification snippet's own quoting — if this
   number ever changes unexpectedly after an edit, stop and investigate
   before pushing).

   Before every push: also scan the diff for anything secret-looking
   (`git diff <file> | grep -iE "secret|api_key|apikey"`) and confirm
   `git fetch && git log --oneline HEAD..origin/main` is empty so you don't
   silently clobber a push from another session/window.

3. `Σκύλλα` must render mixed-case everywhere — check `text-transform` on
   every ancestor of any element containing it, not just the string casing.
   Site-wide recurring bug, not just /swap.

4. Cloudflare's per-request subrequest budget is real and hard — do the
   arithmetic before adding any new per-item enrichment call. See
   `LISTINGS_ENRICH_CAP` / `LISTINGS_ENRICH_CAP_LOW` in `pigeons.js` for the
   current numbers and reasoning.

5. KV cache keys are versioned (`pswap:highsale:v3`, `pswap:xrpcafestats:
   v1:`, etc.) — bump the suffix again if you ever change a cached value's
   shape, or old entries silently serve stale/mismatched data forever.

6. `NEVER trust a txjson the client sends back` — every `*-prepare.js` and
   `*-payload.js` endpoint in this codebase re-derives the transaction from
   scratch server-side (nftId/wallet/swapId only), re-checking ownership
   and live ledger state. This is deliberate, load-bearing defense — don't
   "simplify" any of these to accept a client-supplied txjson.

## Deploy

`git push origin main` from `soitbegins-portal-clone` → live on
soitbegins.xyz, **usually** within ~1-2 minutes via Cloudflare Pages, no
build step for the rest of the site (swap.js's bundling by esbuild is the
one exception — see gotcha #1). If it's taking noticeably longer, check the
Cloudflare Pages dashboard's Deployments tab for `soitbegins-portal` before
assuming it's still propagating. To watch live server-side logs while
testing: `npx wrangler pages deployment tail --project-name
soitbegins-portal` — reconnect it (Ctrl+C, rerun) after every new push, it
follows one specific deployment ID and doesn't auto-track new ones, and can
silently stop updating if left open a long time.
