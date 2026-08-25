# Σκύλλα SWAP — handoff note (updated, supersedes any earlier version)

This file is stale the moment nobody updates it after a session — if you're
picking this up, skim it, then check `git log -40 --oneline` for what's
actually landed since it was last edited. The session that wrote this one
touched almost nothing but `functions/swap.js` (plus a handful of small,
surgical backend files) across ~30 commits — read the commit messages
themselves for the fine detail; this file is the map, not the territory.

## Repo

The LIVE repo (deploys to soitbegins.xyz via Cloudflare Pages on push to
`main`): `C:\Users\Admin\OneDrive\Desktop\soitbegins-portal-clone`
GitHub: `github.com/spotto589/soitbegins-portal`

⚠️ There is ALSO a stale, no-git-history folder at
`C:\Users\Admin\OneDrive\Desktop\Soitbegins.xyz` — don't confuse them. All real
work happens in `soitbegins-portal-clone`. The default working directory a
fresh session lands in is often the STALE one — `cd`/read into
`soitbegins-portal-clone` explicitly before touching anything.

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

## Current status, at a glance (this session)

This was a very long, iterative session almost entirely about the
**Σκύλλα :: FL0CK** tab (own-wallet view, formerly PλWS then $WλP) and the
**DATABASE** card grid it shares — plus a genuinely new feature (real
NFT TRANSFER) and a real production bug fix (DELIST). Rough chronological
groups:

### 1. FL0CK renamed and made genuinely exclusive
- Tab is now just **FL0CK** (dropped the "Σκύλλα::" prefix everywhere),
  doubles as the login entry point — logged out, it reads
  `FL0CK [ L0G !N W!TH Σκύλλα ]`; logged in, `FL0CK :: N P!GE0NS` plus a
  red pending-offer count when there is one.
- **Two real exclusivity leaks fixed**: RESET (on the shared search/sort
  panel) used to always `exitWalletScope()`, dumping you into the full
  unscoped collection — now only does that on DATABASE; on FL0CK it just
  resets sort/traits within your own scope. The Σ SCYLLA LISTED
  collection-wide filter (stat tile click, or picking a FL00R/CE!L!NG
  $P!GE0NS sort) explicitly cleared `state.scope` when turning on — now
  switches to DATABASE first instead of silently leaking the whole
  collection into what's still nominally the FL0CK tab. Both were reachable
  because a recent change made the shared stats carousel/sort panel visible
  on every tab, not just DATABASE — watch for the same class of bug if any
  more DATABASE-only UI gets promoted to "every tab."
- Redundant panel header ("Σκύλλα://FL0CK" title, "N0 0FFERS" summary line)
  removed — that info now lives only on the tab label itself.

### 2. Real TRANSFER feature (new)
Own Pigeons on FL0CK get a `[ TRANSFER ]` button next to LIST/DELIST — a
real, free (Amount "0") `NFTokenCreateOffer` restricted to a destination
wallet, reusing the exact same backend the (still-paused,
`CREATE_OFFER_ENABLED = false`) NFT-for-NFT swap builder already had
(`swap-offer-prepare/-payload/-status.js`) — called with just
`nftId`+`toWallet`, no `wantNftId`/`swapId`, so nothing writes into the
swap-offer-pairs index. **The recipient side is NOT built** — they accept
the resulting real on-ledger offer from their own wallet app (Xaman shows
incoming NFT offers); there is no in-app "you have an incoming transfer"
UI. If that's ever wanted, it needs the same kind of tracked index the
swap-offer-pairs system already uses for the 2-sided trade builder.

### 3. Card grid cleanup (BUY N0W / 0FFER / LIST / TRANSFER / CANCEL)
- Every inline "type a number directly on the card" input is gone
  (LIST PRICE, OFFER AMOUNT, the old TRANSFER wallet field never existed
  inline to begin with). Cards now only ever show buttons; typing happens
  in one shared popup, **`#amountEntryModal`** (`openAmountEntryModal(mode,
  p)`, mode is `'list'|'offer'|'transfer'`) — re-labelled per use, reuses
  the exact classes `submitInlineListing`/`submitMakeOffer` already look
  for (`.list-price-input`/`.list-inline-btn`, `.make-offer-input`/
  `.make-offer-send`) so neither of those functions needed to change.
  `submitTransfer` is new.
- LIST PRICE/OFFER AMOUNT inputs accept **k/m shorthand** — `123k` →
  `123,000`, `1.5m` → `1,500,000` — via `formatThousandsInput`, so it
  applies everywhere that function already runs (the popup, and the
  detail screen's own inline OFFER AMOUNT input, which was NOT converted
  to the popup pattern — still inline, deliberately out of scope, see
  "the thumbnail of the nft" framing in the request that started this).
- BUY N0W: price is now its own plain line above the button (was baked
  into the label), compact (`fmtPigeonsCompact` — `123K`, and `123.3
  M!LL!0N` spelled out for the millions case specifically, NOT `123.3M`
  — K stays as `K`).
- Every action button (BUY N0W/0FFER/CANCEL/L!ST/TRANSFER) is the same
  15px size now — CANCEL/L!ST/TRANSFER used to be on `.bar-btn`'s smaller
  13px default. 0FFER is bright green with a gentle pulse (same recipe as
  the trustline banner's own BUY $P!GE0NS), meant to actually invite a
  click.
- **Card heights now line up row-to-row**: `.result-card` is a flex
  column, the real action content is wrapped in `.card-action-box` with
  `margin-top:auto`, pinning it flush to the bottom of every card
  regardless of what sits above it (rarity line, average-sale line,
  offers-received block — all wildly different per card). On FL0CK
  specifically, CANCEL/L!ST is now paired side-by-side with TRANSFER in
  one row (`.owned-action-row`) instead of stacked, so a listed and
  unlisted Pigeon take up the identical shape next to each other.
- Own-listing readouts ("Y0UR L!ST!NG"/"L!STED") are plain white text now
  (was red for a session, then reverted) — the **CANCEL button itself is
  red** instead, since that's the actually-actionable element.
- **AVERAGE SALE PRICE** now shows on every single card (was $PIGEONS-only
  and hidden when absent) — real XRP sale history, `N0 SALES` when there
  genuinely isn't any (the underlying field is `null`, not `0`, for "never
  sold" — don't conflate the two if you touch this).
- **Real listing duration**: LIST now has a 1D/3D/7D/30D picker
  (`.list-duration-row` inside the popup, 7D default), a REAL XRPL
  `NFTokenCreateOffer.Expiration` (`listingExpirationRippleSeconds` in
  `_shared.js`, re-derived independently server-side in both
  `swap-listing-prepare.js` and `-payload.js`, never trusted from the
  client) — the ledger itself prunes an expired offer, no cron needed.
  `listingCountdownText()` renders it as fine print ("EXP!RES !N 2D 14H")
  wherever a listing price shows; computed fresh at render time, not a
  live per-card ticking timer. Old pre-this-feature listings have no
  expiration and just show no countdown. The expiration field had to be
  threaded through FOUR places to reach the frontend: `swap-listing-
  status.js` (captures it off the real offer into the KV record),
  `swap-listing-owned.js` (same, for FL0CK's own listed-badge lookup),
  `api/pigeons.js`'s `toItem()` (`p.scyllaListing.expiration`), and the
  frontend rendering itself — if a future change to the listing shape
  needs a new field, expect to touch the same four spots.

### 4. Confirm screens redesigned — 0FFER and TRANSFER, both real popups now
Both used to `showScreen()` navigate away from the grid to a whole
separate screen showing raw txjson fields (tx-type badge, hex NFTokenID,
hex currency code, etc.). Both are now:
- **A real second popup** (`#offerConfirmModal` / `#transferConfirmModal`)
  stacked directly on top of the amount-entry popup — `closeAmountEntryModal()`
  fires the instant either opens. BACK and a backdrop click just close the
  popup now (`closeOfferConfirmModal`/`closeTransferConfirmModal`) — there's
  nothing to navigate back to, since opening it never left the page.
- **Purple** (`.offer-confirm-panel`, shared by both) — border/glow/gradient
  background/the big P!GE0N # readout all in `--pigeon-purple`, small
  pop-in animation. This is deliberately louder than every other confirm
  screen on the site (which stay plain dark) — that was an explicit ask
  ("it should look exciting").
- **Plain-English content**, no raw txjson: 0FFER reads "Y0U / wallet / ARE
  0FFER!NG / amount / F0R / P!GE0N #N / 0WNED BY / wallet". TRANSFER reads
  "TRANSFERR!NG FR0M / wallet / P!GE0N #N / DEST!NAT!0N / wallet". Both
  button labels read `[ C0NF!RM W!TH Σκύλλα ]` (was `[ 0PEN XAMAN ]`) —
  same real Xaman payload underneath, wording only. Both share the
  `.confirm-clean`/`.confirm-field-label`/`.confirm-field-value`/
  `.confirm-pigeon-num` classes — if a THIRD confirm screen ever needs
  this treatment (DELIST/BUY/ACCEPT OFFER currently still use the old
  plain `.detail-field` row-list style), reuse these, don't invent a
  fourth variant.
- The native `window.confirm()` "are you sure" dialog `submitTransfer` used
  to show before even reaching this screen is gone — redundant now that
  the popup itself shows the same info before Xaman opens.
- **LIST and DELIST results were also redesigned** into a big "receipt"
  layout (`.result-receipt`/`.receipt-badge`/`.receipt-pigeon-num`/
  `.receipt-price-row`/`.receipt-tx-link`) — checkmark, big Pigeon #,
  "TRANSACT!0N C0NF!RMED", one boxed compact price, a small out-of-the-way
  tx-hash link. These stayed full-page results (not popups) — only the
  CONFIRM step was the complaint, not the final result. BUY/ACCEPT
  OFFER/SWAP OFFER results were NOT touched — still the old dense
  row-list, would need the same treatment if asked.

### 5. Real production bug fixed: DELIST false failures
Root cause: `swap-delist-prepare.js` called `fetchNftSellOffers(nftId)`,
which silently turns a genuine RPC/network **lookup failure**
(xrplcluster.com rate-limited, timeout) into an **empty array** — so a
transient failure looked identical to "this Pigeon genuinely has no live
offers," and got reported as `not_listed_by_you` instead of a retryable
error. Same class of false-negative the `scyllaListed` background-verify
code elsewhere in this file already explicitly guards against — if you
see ANY other caller of the tolerant `fetchNftSellOffers`/
`fetchNftBuyOffersOrNull`-style "empty on failure" helpers making a
go/no-go safety decision (not just a display choice), it likely has the
same latent bug. Fixed by switching to `fetchNftSellOffersOrNull`
directly and returning a new `lookup_failed` error (mapped client-side to
"S!GNAL !NTERFERENCE — TRY AGA!N") on a real failure.

### 6. Trait filtering fixed across every sort mode
Picking a trait while a non-default sort was active (FL00R $P!GE0NS,
H!ST0R!CAL SALES, A-Z/Z-A, 1ST/2ND EDITION) used to silently ignore the
filter — each of those sort branches in `loadMoreCollection` built its
own `reqParams` and several forgot to include `filters`. Now all of them
do, and the backend endpoints that didn't support filters at all
(`highestSale`, `numericOrder`, `scyllaListed`) got a new
`scanFilteredCandidates()` helper in `api/pigeons.js` — scans Deeptide's
own trait-filtered listings feed (bounded to 600 items) to learn which
nftIds actually match, then intersects against whichever index the sort
is using. **Honest limitation**: a trait combo with more real matches
than 600 won't get a perfectly complete sort — same trade-off already
accepted elsewhere in this file for the cross-marketplace price sort.

### 7. SORT BY redesigned to match FILTER BY TRAITS
The trigger box used to show the current selection as its own label text
("RAR!TY H!GHEST ▾"); now it's static ("S0RT BY ▾", `renderSortDropLabel`
renamed to `renderSortTag`) and the actual pick shows as a single applied
tag underneath (`#sortRows`), same visual language as `#traitRows` — just
always exactly one tag, replaced not added-to on a new pick.

### 8. Default DATABASE landing sort changed
Was RARITY H!GHEST, now **FL00R $P!GE0NS ascending** (`state.sort =
'SCYLLA_PRICE_ASC'`, `state.scyllaListedOnly = true` by default). Once
the floor-listed items run out, `loadMoreCollection` auto-chains to
**L0WEST AVERAGE SALE PR!CE $P!GE0NS** (`AVG_SALE_PIGEONS_ASC`,
previously disabled, now a real enabled sort) and keeps scrolling through
the rest of the collection — one-shot, can't re-trigger since the chained
call runs with `scyllaListedOnly` false. RESET still goes back to
RARITY_ASC specifically (hardcoded there, unrelated to this default).

## PλWS/DATABASE unification — background, unchanged this session

(Kept from an earlier handoff — still true, just re-confirming FL0CK is
the same tab, renamed again since.) `showTab('mypigeons')` delegates to
`browseOwnerCollection(MY_WALLET, 'Y0U', undefined, 'mypigeons')` — the
same DATABASE grid/detail view, scoped. Click a Pigeon on FL0CK and you
get the exact real `screenDetail` screen, not a separate thinner view.

## The swap builder / CREATE OFFER (V1) — still paused, unchanged this session

`SWAP_BUILDER_ENABLED = false` and `CREATE_OFFER_ENABLED = false`, both
still off — the OLDER multi-item NFT-for-NFT trade builder and the V1
single-item "SWAP NFT TRADE DETAILS" box are both still hidden entirely
(not just showing a "coming soon" message — genuinely `display:none` now,
see this session's own earlier commit). **Don't flip either back on
without being asked** — the non-atomicity reasoning from prior handoffs
still applies unchanged: two independent `NFTokenCreateOffer`s + two
independent `NFTokenAcceptOffer`s, never atomic, "whoever accepts first is
exposed" risk. The new TRANSFER feature reuses the SAME backend
(`swap-offer-prepare/-payload/-status.js`) but is a one-way gift, not a
swap — there's no "who goes first" risk since only one side ever moves
anything, so it was fine to ship despite the swap builder itself staying
paused.

## KV write cap, Brokered accept-offer, Xaman push notifications, Xaman signing pattern, Theme, Data sources — all unchanged this session

See prior handoff content in git history (`git log -p -- HANDOFF.md` if
truly needed) — nothing about these areas was touched. Quick reminders
that stay load-bearing:
- `_shared.js`'s `fetchAllAccountNfts`/`fetchNftSellOffersOrNull`-family
  functions have real retry logic (5 attempts, backoff) but callers must
  pick the right variant for whether a lookup failure should degrade
  silently (display-only) or must be distinguished from a real empty
  result (any go/no-go decision) — see section 5 above, this was the
  exact bug.
- `window.open()` for Xaman must be called synchronously inside the click
  handler (`openXamanPopup()`), before the fetch resolves — unchanged,
  every new OPEN-XAMAN-equivalent button this session (0FFER/TRANSFER's
  now-renamed CONFIRM button) still follows this.
- Cyan/magenta/purple "digital glitch" theme unchanged — purple
  (`--pigeon-purple`) is specifically the collection's own colour now
  used even louder than before (0FFER/TRANSFER confirm popups).

## Gotchas — read before touching swap.js again

1. **Never write a literal backtick anywhere inside the `SWAP_HTML`
   template literal** — not even in a comment. `node --check` on the outer
   file will NOT catch this reliably. Run the full render-and-check-the-
   inner-script pipeline below before every push.
2. **Escape sequences inside the client script need to survive TWO rounds**
   of interpretation — any backslash meant to reach the browser as a real
   escape must be written **doubled** in the source (`\\d`, `\\'`). Avoid
   apostrophes/contractions in new user-facing strings entirely rather
   than escaping.

   **Run this before every push that touches swap.js**:
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
   Also run this after any HTML restructuring (checks for duplicate ids
   and `el.*` references with no matching registration):
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
   "getBoundingClientRect"]` is a known false positive, safe to ignore.)

   Clean up temp files after: `rm -f rendered.html rendered_inner.js
   rendered_inner_bundled.js`. Before every push: also scan the diff for
   anything secret-looking (`git diff <file> | grep -iE
   "secret|api_key|apikey|seed"`) and confirm `git fetch && git log
   --oneline HEAD..origin/main` is empty.
3. `Σκύλλα` must render mixed-case everywhere — check `text-transform` on
   every ancestor, not just the string casing. When it needs to appear
   inside plain uppercase text (e.g. a button label), wrap it in its own
   `<span style="text-transform:none;">Σκύλλα</span>` and use `.innerHTML`,
   never `.textContent`, at every reset point for that element — this
   session hit the "forgot one of six reset points" version of this bug
   twice (0FFER and TRANSFER's own confirm buttons) before catching it
   with a `replace_all` across every occurrence.
4. Cloudflare's per-request subrequest budget is real and hard — do the
   arithmetic before adding any new per-item enrichment call.
   `scanFilteredCandidates` (section 6 above) is bounded to 600 items for
   exactly this reason.
5. KV cache keys are versioned (`pswap:highsale:v3`, etc.) — bump the
   suffix again if you ever change a cached value's shape.
5a. Cloudflare's free-tier KV cap is 1,000 writes/day — has needed its TTL
   raised multiple times before. Not touched this session, but if it
   recurs again, stop raising the number and redesign the caching
   strategy instead.
6. `NEVER trust a txjson the client sends back` — every `*-prepare.js` and
   `*-payload.js` endpoint re-derives the transaction from scratch
   server-side. This extends to preferences too now, not just security-
   critical fields — `durationDays` (LIST) is client input but still
   clamped server-side to one of 4 allowed values before use.
7. `swap-offers-received.js` blind-scans every OTHER Pigeon the seller owns
   (bounded, `OFFERS_RECEIVED_SCAN_CAP=45`) as a backfill — a wallet
   holding more than ~45 untracked Pigeons could still miss a real offer.
8. `xaman-proxy` signs real transactions autonomously as the broker wallet
   (`/broker-submit`, allowlisted to `NFTokenAcceptOffer`/`Payment` only).
   Don't widen that allowlist without a specific reason.
9. **When adding a new way to open `#screenDetail` from inside an overlay/
   modal**, check the global "click outside closes detail" listener — it
   excludes specific click targets by name (`.pigeon-img-box`,
   `#detailLightbox`, `.simple-picker-view-btn`), not by any general "was
   this inside an overlay" logic. A new entry point needs its own explicit
   exclusion.
10. **Popups stack, they don't nest CSS-wise** — `#amountEntryModal`,
    `#offerConfirmModal`, `#transferConfirmModal`, `#simpleOfferPickerModal`,
    `#detailLightbox` are all independent `position:fixed; inset:0;
    z-index:1000` overlays, not children of each other. When one hands off
    to the next (e.g. amount-entry → confirm), the FIRST must be explicitly
    closed (`closeAmountEntryModal()`) — nothing does that automatically
    just because a second one opened on top.
11. **A shared function/variable used across sibling flows can't assume
    it's only ever called from one of them** — `formatThousandsInput`
    (k/m shorthand) is called from the popup's own input listener AND the
    detail screen's separate inline input; `listingCountdownText`/
    `compactPigeonsNumber` are called from three+ separate render points.
    When changing one of these, grep every call site, don't assume there's
    only the one you're looking at.

## Deploy

`git push origin main` from `soitbegins-portal-clone` → live on
soitbegins.xyz, usually within ~1-2 minutes via Cloudflare Pages, no build
step for the rest of the site (swap.js's bundling by esbuild is the one
exception — see gotcha #1-2). To watch live server-side logs while
testing: `npx wrangler pages deployment tail --project-name
soitbegins-portal`.

Local preview: `.claude/launch.json` (in the STALE `Soitbegins.xyz` folder,
not this repo — that's where the browser preview tool actually looks) has
a `soitbegins-local` config that `cd`s into this repo and runs
`wrangler pages dev` with the real `Σκύλλα`/`coin` KV bindings on port
8799 — use this to verify UI changes live before pushing, same as this
session did for every non-trivial change (duration picker, confirm
popups, card alignment, etc.).

`xaman-proxy` deploys separately on **Render** — a git push to `main`
alone does NOT redeploy it. Untouched this session.
