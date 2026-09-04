// ─────────────────────────────────────────────────────────────────────────
// Σκύλλα SWAP — collection explorer + target-selection flow.
//
// Real data throughout: real NFTokenIDs, real owners, real trait
// attributes, real rarity (via Deeptide, falling back to IPFS) — pulled
// through /api/pigeons (functions/api/pigeons.js) and the data-access
// layer in functions/_shared.js. No mock data anywhere in this file.
//
// Flow: DISCOVER -> SEARCH -> FILTER -> INSPECT -> SELECT TARGET ->
// IDENTIFY OWNER -> BROWSE OWNER COLLECTION -> SELECT TARGET ASSETS.
// Nothing past this connects a wallet, calls Xaman, signs anything, or
// moves any asset — "CONTINUE TO OFFER" only reaches a placeholder;
// building the real offer/XRP/signing stage is explicitly the next phase.
//
// MY PIGEONS reuses the same wallet-identity mechanism as /board — the
// `pigeon_session` cookie, set once a wallet has signed the connect
// message there — rather than building a second, separate login flow. No
// signature exists here to create one; /static only ever reads the cookie.
// ─────────────────────────────────────────────────────────────────────────

import { BOARD_COOKIE_NAME, getCookie, verifyToken } from './_shared.js';

const SWAP_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>Σκύλλα</title>
<!-- Browser-tab title above, and og:title/twitter:title below for the
     shareable-link preview (Discord/X/iMessage etc unfurl these, not the
     <title> tag) — both just "Σκύλλα", not "Σκύλλα :: SWAP". -->
<meta property="og:title" content="Σκύλλα">
<meta property="og:site_name" content="Σκύλλα">
<meta name="twitter:title" content="Σκύλλα">
<!-- Home-screen icon when saved as an app on mobile — previously had no
     icon/manifest tags at all, so iOS/Android fell back to a screenshot
     thumbnail of whatever was on screen. apple-touch-icon covers iOS
     directly (iOS "Add to Home Screen" doesn't reliably read the web
     manifest for this); the manifest link covers Android/Chrome. -->
<link rel="icon" href="/assets/icons/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#000000">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Σκύλλα">
<meta name="apple-mobile-web-app-status-bar-style" content="black">

<style>
    @import url('https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');

  /* ==========================================================================
     Σκύλλα SWAP — colour + type system, v4: "corrupted industrial system,"
     not cyberpunk (see the Σκύλλα Mainframe identity pitch this was
     approved from). Neutrals: dirty warm near-black/off-white/muted-steel,
     sharp corners (--radius:0), Anton display face. TWO accents, matching
     the identity pitch: magenta is the primary/selected/CTA signal, cyan
     is the secondary/hover signal — the site briefly collapsed to magenta
     only, which is exactly what made everything read as "too much pink";
     restoring the split is what most of the hundreds of existing
     var(--cyan) references (borders, hover states, the scrollbar) were
     written assuming all along.
     MAGENTA = active / selected / SCYLLA / target / CTA / warning
     CYAN = hover / secondary interaction, never a resting/idle colour
     WHITE = primary data, headings
     GREY = secondary data, metadata, disabled
     BLACK = depth (panels sit above the static as dark glass)
     ========================================================================== */
  :root{
    --bg:#0b0b09;
    --panel-bg:rgba(19,18,15,0.64);
    --panel-bg-solid:#100f0c;
    --panel-texture:rgba(230,225,211,0.025);
    --border-dim:rgba(230,225,211,0.1);
    --border-mid:rgba(230,225,211,0.2);

    /* A real colour again — see this stylesheet's own header comment. */
    --cyan:#3df3ec;
    --cyan-dim:rgba(61,243,236,0.28);
    --cyan-faint:rgba(61,243,236,0.1);
    --cyan-glow:rgba(61,243,236,0.4);

    --magenta:#ff33cc;
    --magenta-dim:rgba(255,51,204,0.4);
    --magenta-faint:rgba(255,51,204,0.12);
    --magenta-glow:rgba(255,51,204,0.4);

    /* Aliases, not real colours of their own — see this stylesheet's own
       header comment. */
    /* A real colour again, not an alias — the one deliberate second
       colour alongside pink/black/white/grey. Semantic, not a competing
       brand accent: important numbers (balance, prices, real values —
       .pigeons-green-num/greenNum()) and the buy/available/real-money
       actions that already leaned on the same "this is real and
       positive" meaning before this session's palette work. */
    --green:#34ff85;
    --green-glow:rgba(52,255,133,0.45);
    /* A real colour too, not an alias — reserved for destructive/negative
       actions (cancel, delist) so they read distinctly from the pink
       brand accent. */
    --red:#e8384f;
    --red-dim:rgba(232,56,79,0.4);
    --red-faint:rgba(232,56,79,0.12);
    --red-glow:rgba(232,56,79,0.4);
    --pigeon-purple:var(--cyan);
    --pigeon-purple-dim:var(--cyan-dim);
    --pigeon-purple-faint:var(--cyan-faint);
    --pigeon-purple-glow:var(--cyan-glow);

    /* The ONE deliberate exception to the four-colour rule above: the
       trustline banner at the very top of the page is explicitly meant to
       carry the CURRENT collection's own real colour (sampled from its
       coin/mint artwork), same as it always did, not the site's universal
       accent — see body.collection-phnixs/-teddybg below, which only
       ever redefine this one variable and nothing else. Real purple for
       $PIGEONS (its actual coin colour), not an alias. */
    --collection-accent:#8848f8;
    --collection-accent-rgb:136,72,248;
    --collection-accent-dim:rgba(136,72,248,0.4);
    --collection-accent-glow:rgba(136,72,248,0.4);
    --collection-accent-2-rgb:120,72,216;

    /* Dirty off-white and warm-tinted greys — was a clean, cool white
       (#f3f4f6) and blue-tinted greys, which read as polished/cyberpunk.
       Same rgb (230,225,211, --paper from the identity pitch) underneath
       every grey step below, just at different alpha, so they still form
       one consistent family. */
    --white:#e6e1d3;
    --grey:rgba(230,225,211,0.56);
    --grey-dim:rgba(230,225,211,0.34);
    --grey-disabled:rgba(230,225,211,0.22);

    --font-display:'Anton',Impact,'Arial Narrow',sans-serif;
    --font-mono:'JetBrains Mono',ui-monospace,'SF Mono',Consolas,monospace;
    --font-body:'JetBrains Mono',ui-monospace,'SF Mono',Consolas,monospace;

    /* Sharp corners, not soft ones — every rounded box on the site pulls
       from this one value. */
    --radius:0px;

    /* Shared width every DATABASE config control (ADD TRA!TS, SORT BY,
       VIEW, each C0LLECT!0N edition button, SEARCH) is pinned to, so the
       whole config area reads as one row of uniform boxes instead of
       each control sizing to its own content. */
    --ctrl-w:190px;
  }
  /* PHN!X/TEDDY used to swap in two entirely different UNIVERSAL palettes
     here (every cyan/magenta on the page, not just the banner) — that was
     the actual "random colours everywhere" problem, and stays gone. The
     top trustline banner is the one deliberate exception (see
     --collection-accent's own comment at its :root definition): it's
     still meant to carry each collection's own real colour, so these two
     blocks come back scoped to ONLY that one variable. */
  body.collection-phnixs{
    --collection-accent:#ff5a1f;
    --collection-accent-rgb:255,90,31;
    --collection-accent-dim:rgba(255,90,31,0.4);
    --collection-accent-glow:rgba(255,90,31,0.4);
    --collection-accent-2-rgb:216,74,21;
  }
  body.collection-teddybg{
    --collection-accent:#2f9e44;
    --collection-accent-rgb:47,158,68;
    --collection-accent-dim:rgba(47,158,68,0.4);
    --collection-accent-glow:rgba(47,158,68,0.4);
    --collection-accent-2-rgb:35,122,53;
  }
  /* EDITION (1-1515/1516-3015) and the # 0R WALLET search box both depend
     on the $PIGEONS-only number-map crawl (search resolves a number via
     that map; EDITION is a hardcoded $PIGEONS mint-era number range) —
     neither has an equivalent for a browse-only collection, so both are
     just not offered rather than sitting there silently broken. */
  body.collection-browse-only .edition-toggle,
  body.collection-browse-only .search-row{ display:none; }

  *{ margin:0; padding:0; box-sizing:border-box; }
  /* Site-wide scrollbar — every scrollable box (the page itself, popups,
     the trait dropdown, anywhere overflow:auto/scroll shows up) instead
     of each browser's own default light-grey bar, which reads jarringly
     out of place against this dark neon theme. var(--cyan) is the
     collection's own accent (swaps per theme — see the root variable
     blocks above), so this stays in sync automatically. Firefox uses
     scrollbar-width/-color; Chrome/Safari/Edge use the ::-webkit-
     scrollbar pseudo-elements below — both cover the same ground.
     Deliberately-hidden scrollbars elsewhere (e.g. #traitsFlyoutCats'
     own horizontal strip, scrolled via its PREV/NEXT arrows instead)
     keep working — their own scrollbar-width:none/::-webkit-scrollbar{
     display:none} rules are scoped to a specific element, which beats
     this unscoped, universal one regardless of source order. */
  *{ scrollbar-width:thin; scrollbar-color:var(--cyan-dim) rgba(255,255,255,0.04); }
  ::-webkit-scrollbar{ width:10px; height:10px; }
  ::-webkit-scrollbar-track{ background:rgba(255,255,255,0.04); }
  ::-webkit-scrollbar-thumb{ background:var(--cyan-dim); border-radius:6px; border:2px solid transparent; background-clip:padding-box; }
  ::-webkit-scrollbar-thumb:hover{ background:var(--cyan); }
  ::-webkit-scrollbar-corner{ background:transparent; }
  /* overflow-x:hidden on BOTH html and body — body alone isn't enough on
     mobile Safari, which scrolls the viewport based on the html element,
     not body; something on the page (a fixed-width control, an
     overflow-x:auto strip that still contributes to layout width, etc)
     was making the whole page pan left/right on a phone even though
     nothing was ever meant to. */
  html, body{ min-height:100%; background:var(--bg); overflow-x:hidden; }
  body{
    font-family:var(--font-mono);
    color:var(--white);
    display:flex;
    justify-content:center;
    padding:8vh 3vw 10vh;
    position:relative;
    /* A fresh query clears and repopulates #resultsArea, and images below
       the fold keep resizing their boxes as they decode — the browser's
       own scroll anchoring kept "helpfully" yanking scrollY back to
       compensate for that shifting content, fighting (and outright
       overriding) any of our own smooth scrollTo calls. Our own explicit
       scrolls (scrollTabStripIntoView, scrollResultsIntoView, etc.)
       should be the only thing moving the page. */
    overflow-anchor:none;
  }
  /* Pigeon detail opens as its own full-viewport box (see #screenDetail) —
     the underlying page must stop scrolling while it's up, or you'd be
     able to drag the page behind it around while the fixed box sits still. */
  body.detail-open{ overflow:hidden; }
  canvas#staticBg{
    position:fixed;
    inset:0;
    width:100%;
    height:100%;
    z-index:0;
    opacity:0.2;
    filter:brightness(0.7) contrast(1.3);
    mix-blend-mode:screen;
    animation:static-shake 0.4s steps(2) infinite;
  }
  @keyframes static-shake{
    0%{ transform:translate(0,0); }
    10%{ transform:translate(-1px,1px); }
    20%{ transform:translate(1px,-1px); }
    30%{ transform:translate(-1px,-1px); }
    40%{ transform:translate(1px,1px); }
    50%{ transform:translate(-1px,0); }
    60%{ transform:translate(1px,0); }
    70%{ transform:translate(0,-1px); }
    80%{ transform:translate(0,1px); }
    90%{ transform:translate(-1px,1px); }
    100%{ transform:translate(0,0); }
  }
  /* faint fixed scanline texture, sitting above the static, below the UI —
     static, not animated; the CRT surface itself, not a live effect */
  body::before{
    content:'';
    position:fixed;
    inset:0;
    z-index:0;
    pointer-events:none;
    background:repeating-linear-gradient(
      to bottom,
      rgba(255,255,255,0.018) 0px,
      rgba(255,255,255,0.018) 1px,
      transparent 1px,
      transparent 3px
    );
    mix-blend-mode:overlay;
  }
  @keyframes flicker-in{
    0%{ opacity:0.4; }
    35%{ opacity:1; }
    45%{ opacity:0.55; }
    100%{ opacity:1; }
  }
  @media (prefers-reduced-motion: reduce){
    canvas#staticBg{ animation:none; }
    *{ animation-duration:0.001ms !important; animation-iteration-count:1 !important; transition-duration:0.001ms !important; }
  }
  .page{ max-width:1500px; width:100%; position:relative; z-index:1; }
  a.back-link{
    display:inline-block;
    font-family:var(--font-body);
    font-size:10.5px;
    letter-spacing:0.1em;
    color:var(--grey);
    text-decoration:none;
    margin-bottom:2.5rem;
    text-transform:uppercase;
    transition:color 0.15s ease;
  }
  a.back-link:hover{ color:var(--cyan); }

  /* The hero is the thesis (see the Σκύλλα Mainframe identity pitch) —
     was a small, centered, single-scale line; now genuinely oversized and
     left-set instead of centered, breaking the "everything centered"
     pattern the rest of the page still uses. Two rows read at different
     scales on purpose (S!GNAL as the real headline, MA!NFRAME as a
     smaller subtitle line underneath it via .h1-sub) instead of one flat
     block of equal-weight text. */
  h1{
    font-family:var(--font-display);
    font-weight:700;
    /* 40px used to be a hard floor regardless of viewport — fine down to
       roughly tablet width, but on an actual phone (~375px) 9vw only
       computes to ~34px, so the clamp pinned it back up to 40px anyway:
       "Σκύλλα://S!GNAL" at a fixed 40px ran edge-to-edge with no
       breathing room, reported live as not fitting properly. 28px lets
       it actually keep shrinking with the viewport below that point. */
    font-size:clamp(28px,9vw,104px);
    line-height:0.94;
    letter-spacing:0.01em;
    color:var(--white);
    /* Cyan/magenta chromatic-aberration split, restored now that cyan is
       a real colour again — the two-colour glitch (not a plain dark
       double-strike) is what the identity pitch this whole system is
       based on actually uses. */
    text-shadow:
      -2px 0 var(--cyan-dim),
      2px 0 var(--magenta-dim);
    margin-bottom:0.6rem;
    text-align:left;
    text-transform:none;
    text-wrap:balance;
  }
  .h1-sub{
    display:block;
    font-size:0.42em;
    letter-spacing:0.14em;
    color:var(--grey);
    -webkit-text-stroke:0;
    text-shadow:none;
    margin-top:0.3em;
  }
  .title-online{ color:var(--green); text-shadow:0 0 6px var(--green-glow); }
  /* $PIGEONS numbers — same green as the header's ONLINE, wherever a real
     $PIGEONS-denominated figure is shown (NFT count, balance, rate,
     calculator, floor). */
  .pigeons-green-num{ color:var(--green); text-shadow:0 0 6px var(--green-glow); }
  .sw-panel{
    position:relative;
    border:1px solid var(--border-dim);
    background:var(--panel-bg);
    backdrop-filter:blur(7px);
    -webkit-backdrop-filter:blur(7px);
    box-shadow:inset 0 0 34px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.015);
    border-radius:var(--radius);
    padding:1.5rem;
    margin-bottom:1.75rem;
  }
  .sw-panel::before{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    background:repeating-linear-gradient(
      to bottom,
      var(--panel-texture) 0px,
      var(--panel-texture) 1px,
      transparent 1px,
      transparent 4px
    );
    opacity:0.5;
  }
  .panel-title{
    text-align:center;
    font-size:12.5px;
    font-weight:500;
    letter-spacing:0.24em;
    color:var(--white);
    margin-bottom:1rem;
    text-transform:uppercase;
  }
  /* Σκύλλα is her own entity, own theme — she's the security/login layer,
     the one who brokers swaps, not just another DATABASE-style screen.
     Redefining the cyan custom properties inside her own panel cascades
     that neon pink through every shared component that lives in here
     (buttons, result cards, hover/selected states) without having to
     rewrite each one individually. */
  #myPigeonsPanel{
    --cyan:var(--magenta);
    --cyan-dim:var(--magenta-dim);
    --cyan-faint:var(--magenta-faint);
    --cyan-glow:var(--magenta-glow);
  }
  /* connectScyllaBtn's own look now lives entirely in .connect-panel-btn
     (see the CONNECT panel block below) — var(--cyan) already resolves to
     her real neon pink in here via the --cyan override just above, so
     that one class is enough on its own. */
  /* Way bigger than a regular panel-title — this is the headline of the
     whole DATABASE screen, not a section label. */
  .search-panel-title{ font-size:24px; font-weight:700; margin-bottom:0.4rem; text-shadow:0 0 10px var(--cyan-glow); }
  /* SH0W!NG Y0UR P!GE0NS :: N — the FL0CK-scoped version of this title —
     reads as YOUR real count, worth calling out in the same live cyan as
     every other real number on this page (MY P!GE0NS ::, P!GE0NS HELD ::)
     instead of just plain white text. */
  .search-panel-title-flock{ color:var(--cyan); }
  .search-panel-subtitle{
    text-align:center;
    font-size:12px;
    letter-spacing:0.15em;
    color:var(--cyan);
    text-shadow:0 0 6px var(--cyan-glow);
    text-transform:uppercase;
    margin-bottom:1rem;
  }

  /* Was a real image texture (the circuit-glitch reference picture,
     heavily scrimmed) behind these two panels — dropped in favour of a
     plain solid fill. Direct instruction: the whole site should read as
     simple and easy to read first, decorative texture second; a busy
     image behind text, however faint, was working against that even at
     low opacity. */
  .sw-panel-signal{ background-color:rgba(8,9,11,0.85); }
  .sw-panel-target{ background-color:rgba(8,9,11,0.82); }

  /* ---- database (multi-collection) selector — now inline inside the
     DATABASE tab button itself (see .tab-db-select above). COLLECTION ::
     is the same hover-flyout component as SORTING BY — hover to reveal,
     not a click-toggle full-width menu. ---- */
  #dbSelectWrap{ font-size:13px; }
  .db-select-flyout{
    display:block;
    width:220px;
    max-height:none;
  }
  .db-select-menu{
    margin:0.75rem auto 0;
    max-width:260px;
    border:1px solid var(--border-mid);
    background:var(--panel-bg-solid);
    border-radius:var(--radius);
  }
  .db-option{
    padding:0.65em 1em;
    font-size:12px;
    letter-spacing:0.1em;
    text-transform:uppercase;
    border-bottom:1px solid var(--border-dim);
    display:flex;
    align-items:center;
    justify-content:center;
    gap:0.5em;
  }
  .db-option:last-child{ border-bottom:none; }
  /* Used to give each collection its own theme colour in this list
     (Pigeons purple/violet, Fuzzy brown, Phoenix red-orange, Teddy gold)
     — one of the "random colours everywhere" spots. Just the active one
     highlighted in cyan now, same as everywhere else; the rest read as
     plain white/default list text. Still cursor:not-allowed/default per
     active-vs-disabled, via .db-option-disabled. */
  .db-option-active{ color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); cursor:default; }
  .db-option-disabled{ cursor:not-allowed; opacity:0.75; }
  .db-soon{ font-size:9px; letter-spacing:0.1em; border:1px solid var(--border-mid); color:var(--grey-dim); padding:0.2em 0.4em; }

  /* ---- FL0CK account-page boxes — a stack of separate .sw-panel cards
     (same terminal/glitch panel look as everything else on the site, not
     a new style) instead of one combined view. MY FL0CK is the only one
     that expands/collapses; the rest are either real destinations
     (BUY $PIGEONS) or plain clickable placeholders with nowhere to go
     yet — no C0M!NG S00N tag on those specifically, just inert for now. */
  /* A grid of menu tiles instead of a thin stacked list — signed-in
     Σκύλλα reads as a real hub of destinations (MY FL0CK, MESSAGE
     !NB0X, 0FFERS, BUY $P!GE0NS, ...) at a glance, same "boxed options,
     not a vertical strip" idea as the mobile tab hub above. */
  #flockAccountBoxes{ display:grid; grid-template-columns:repeat(2, 1fr); gap:0.7rem; }
  @media (max-width:480px){ #flockAccountBoxes{ grid-template-columns:1fr; } }
  .flock-account-box{ padding:1.4rem 1.25rem; min-height:5rem; display:flex; align-items:center; }
  .flock-account-box-row{ display:flex; align-items:center; justify-content:center; gap:1rem; width:100%; text-align:center; }
  .flock-account-box-label{ font-size:14px; letter-spacing:0.18em; text-transform:uppercase; color:#fff; }
  .flock-account-box-arrow{ font-size:16px; color:var(--pigeon-purple); text-shadow:0 0 5px var(--pigeon-purple-glow); flex:0 0 auto; }
  .flock-account-box-clickable{ cursor:pointer; transition:border-color 0.15s ease; }
  .flock-account-box-clickable:hover{ border-color:var(--pigeon-purple); }
  .flock-account-box-soon{ opacity:0.6; cursor:not-allowed; }
  .flock-account-box-soon .flock-account-box-label{ color:var(--grey-dim); }
  /* A real, visible "still counting" state — the underscore alone reads as
     dead/broken otherwise. */
  @keyframes flock-count-pulse{ 0%,100%{ opacity:1; } 50%{ opacity:0.35; } }
  .flock-count-loading{ animation:flock-count-pulse 1.1s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce){ .flock-count-loading{ animation:none; opacity:0.6; } }
  /* A real failed state, not the loading pulse left running forever —
     see loadMyOwnPigeonsCache's own comment. Red (this site's
     destructive/negative colour), no animation, so it visibly reads as
     "stopped, needs a tap" instead of "still working". */
  .flock-count-failed{ color:var(--red); animation:none; }
  /* MY P!GE0NS — full-width (spans both grid columns) since it's the one
     box on this tab actually about YOU. Real --collection-accent purple
     (the current collection's own colour, same gradient the trustline
     banner/FL00R tile already use) instead of the plain neutral panel
     every other box here gets, and centered text like the rest of the
     grid — was left-aligned from an earlier, wider padlock-background
     version of this box that no longer applies. */
  #flockMyFlockBox{
    grid-column:1 / -1;
    background:linear-gradient(160deg, rgba(var(--collection-accent-rgb),0.55), rgba(var(--collection-accent-2-rgb),0.65));
    border-color:var(--collection-accent);
  }
  #flockMyFlockBox:hover{ border-color:var(--collection-accent); background:linear-gradient(160deg, rgba(var(--collection-accent-rgb),0.7), rgba(var(--collection-accent-2-rgb),0.8)); }
  #flockMyFlockBox .flock-account-box-label{ text-shadow:0 1px 4px rgba(0,0,0,0.6); }

  /* Your own connected wallet address — the WHOLE box is the copy button
     now (reported live as wanting "one big cyan box thats clickable"),
     not a plain row with a small button tacked on the side. Sits above
     the account boxes. */
  .flock-wallet-box{
    display:flex; align-items:center; justify-content:space-between; gap:1rem;
    padding:1em 1.1em; margin-bottom:0.75rem;
    background-color:var(--cyan-faint);
    border:1px solid var(--cyan);
    border-radius:var(--radius);
    cursor:pointer;
    transition:background-color 0.15s ease, box-shadow 0.15s ease;
  }
  .flock-wallet-box:hover{ background-color:var(--cyan-dim); box-shadow:0 0 18px var(--cyan-glow); }
  .flock-wallet-addr{
    flex:1 1 auto;
    text-align:center;
    font-family:var(--mono, monospace);
    font-size:14px; font-weight:700; color:var(--cyan);
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
    letter-spacing:0.02em;
  }
  .flock-wallet-copy-hint{
    flex:0 0 auto;
    color:var(--cyan);
    font-size:11px; font-weight:700; letter-spacing:0.08em;
    text-transform:uppercase;
    white-space:nowrap;
  }
  .flock-wallet-box.flock-wallet-copy-done{
    background-color:var(--green); border-color:var(--green);
  }
  .flock-wallet-box.flock-wallet-copy-done .flock-wallet-addr,
  .flock-wallet-box.flock-wallet-copy-done .flock-wallet-copy-hint{ color:#000; }

  /* ---- Σκύλλα (signed-in FL0CK) tab theme — the same faint circuit-
     glitch texture .sw-panel-signal/-target already use elsewhere on the
     page (real static, non-repeating, heavily scrimmed so it reads as
     atmosphere, never competing with the text on top), plus real hover
     motion so this whole tab feels alive rather than a static list of
     boxes. MY P!GE0NS keeps its own distinct padlock treatment above —
     this covers the REST of the account boxes and the P!GE0NS grid
     underneath, so the tab reads as one themed page, not two looks stapled
     together. */
  /* Was the same circuit-glitch image texture as .sw-panel-signal/-target
     above — removed for the same reason (site-wide: simple and easy to
     read comes first). Plain fill, keeps the hover motion below. */
  .flock-account-box:not(#flockMyFlockBox){
    background-color:rgba(8,9,11,0.9);
    transition:border-color 0.15s ease, box-shadow 0.25s ease, transform 0.15s ease;
  }
  .flock-account-box-clickable:not(#flockMyFlockBox):hover{
    border-color:var(--cyan);
    box-shadow:0 0 22px var(--cyan-glow);
    transform:translateY(-2px);
  }
  /* A quick flicker on hover — one shot, not a loop, so it reads as a
     glitchy "system responding to you" beat rather than ambient noise
     someone has to stare at while deciding what to click. */
  @keyframes flock-box-glitch{
    0%, 100%{ text-shadow:none; }
    20%{ text-shadow:-1px 0 var(--magenta), 1px 0 var(--cyan); }
    40%{ text-shadow:1px 0 var(--magenta), -1px 0 var(--cyan); }
    60%{ text-shadow:none; }
  }
  .flock-account-box-clickable:not(#flockMyFlockBox):hover .flock-account-box-label{
    animation:flock-box-glitch 0.35s steps(2, end);
  }
  #flockGridPanel{ background-color:rgba(8,9,11,0.92); }
  /* Ties SH0W!NG Y0UR P!GE0NS :: N (see .search-panel-title-flock above)
     to the rest of the theme — a live cyan underline instead of just
     coloured text sitting on its own. */
  .search-panel-title-flock{ position:relative; padding-bottom:0.5rem; }
  .search-panel-title-flock::after{
    content:''; position:absolute; left:50%; bottom:0; transform:translateX(-50%);
    width:64px; height:2px; background:linear-gradient(90deg, transparent, var(--cyan), transparent);
    box-shadow:0 0 8px var(--cyan-glow);
  }
  @media (prefers-reduced-motion: reduce){
    .flock-account-box-clickable:not(#flockMyFlockBox):hover{ transform:none; }
    .flock-account-box-clickable:not(#flockMyFlockBox):hover .flock-account-box-label{ animation:none; }
  }

  /* ---- collection details: token/issuer info ---- */
  .collection-info{ max-width:620px; margin:0 auto 1.25rem; text-align:center; }
  .ci-label{ font-size:10px; letter-spacing:0.15em; color:var(--grey-dim); text-transform:uppercase; margin-bottom:0.6rem; }
  .ci-addr-row{ display:flex; align-items:center; justify-content:center; gap:1rem; flex-wrap:wrap; }
  .ci-value{ color:var(--white); word-break:break-all; }
  .ci-value-big{ font-size:14px; letter-spacing:0.02em; }
  .ci-copy-btn{ font-size:12px; padding:0.65em 1.1em; flex:0 0 auto; }
  .pigeons-bar-identity-actions{ display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap; justify-content:center; }
  /* SH0W MY P!GE0NS reuses BUY $P!GE0NS's own styling (same juicy green
     treatment) — its margin-top was meant for sitting under the balance
     value in that other context, not needed (and visually misaligning
     against S!GN 0UT) in this already-centered flex row. */
  .pigeons-bar-identity-actions .pigeons-bar-balance-buy{ margin-top:0; }

  .my-pigeons-grid{ margin-top:1rem; }

  /* ---- collection stats strip (global system data — cyan accent) ----
     Flex, not grid — a grid with a fixed 4-column template still
     reserves an empty trailing track for a 3-tile page, so those tiles
     read as stuck to the left instead of centered. Flex-basis expressed
     as a % of the row (minus proportional gap) gives every tile the
     exact same width a 4-column grid would, in any tile count, and
     justify-content:center centers the actual row of tiles as a group. */
  .stats-strip{
    display:flex;
    flex-wrap:wrap;
    justify-content:center;
    gap:0.75rem;
  }
  .stats-strip .stat-tile{ flex:0 0 calc(25% - 0.5625rem); }
  /* Mobile: collapse the whole paged carousel (FLOOR / ITEMS-HOLDERS-
     VOLUME-LISTED / 24H ACTIVITY, swiped one page at a time) into one
     flat, small, horizontally-scrollable strip instead — all ten stats
     side by side, condensed pills, no arrows/dots/paging. JS's
     auto-rotate timer (see the stats-carousel IIFE) keeps toggling
     .stats-page-active/-prev/etc and re-writing the viewport's inline
     height underneath this completely unchanged — every property that
     would fight it here is !important so none of that has any visible
     effect any more, without needing to touch the JS itself. */
  @media (max-width:700px){
    /* !important on every property below that also has a later,
       unconditional same-specificity rule elsewhere in this file
       (.stats-carousel-dots/.stats-page's own base rules, both declared
       AFTER this block) — without it, source order lets those base rules
       silently win regardless of viewport width, since a media query
       alone doesn't outrank equal specificity. Confirmed live: dots stayed
       visible and every .stats-page got forced to the base rule's
       width:100% instead of shrinking to its own content, which broke the
       whole "compact side-by-side strip" this block exists for — pages
       ballooned to full viewport width and spilled the next one half
       off-screen instead of sitting flush next to it. Same bug shape
       already fixed once this session for the tab strip's own mobile grid
       override. */
    .stats-carousel-arrow, .stats-carousel-dots{ display:none !important; }
    .stats-carousel-row{ gap:0; }
    .stats-carousel-viewport{
      display:flex;
      gap:0.4rem;
      overflow-x:auto !important;
      overflow-y:hidden !important;
      height:auto !important;
      min-height:0 !important;
    }
    .stats-page{
      position:static !important;
      transform:none !important;
      opacity:1 !important;
      pointer-events:auto !important;
      transition:none !important;
      width:auto !important;
      flex:0 0 auto !important;
    }
    .stats-strip{ flex-wrap:nowrap; gap:0.4rem; }
    .stats-strip .stat-tile{
      flex:0 0 auto !important;
      min-width:70px;
      padding:0.4rem 0.5rem;
    }
    /* !important on font-size here too — same shape of bug this block's
       own comment already describes for .stats-carousel-dots/.stats-page
       (a later, unconditional .stat-value{font-size:16px} rule further
       down this file, same specificity, silently won on source order
       regardless of viewport). Confirmed live: the carousel's flex/
       overflow layout collapsed to the compact strip correctly, but
       $P!GE0NS FL00R's own number stayed at the full 16px+ desktop size
       and ran off the right edge of its own tile, clipped by the
       viewport. */
    .stat-label{ font-size:8px !important; margin-bottom:0.15rem; white-space:nowrap; }
    .stat-value{ font-size:11px !important; white-space:nowrap; }
  }
  /* Prev/next arrows flank the viewport; the row itself is the flex
     container that lays out [arrow][viewport][arrow]. */
  /* Attached to the top of #flockGridPanel now (not its own separate
     panel) — a divider + spacing below it is what actually separates it
     from SEARCH!NG $P!GE0NS DATABASE underneath. */
  #collectionDetailsPanel{ margin-bottom:1.25rem; padding-bottom:1.25rem; border-bottom:1px solid var(--border-dim); }
  .stats-carousel-row{ display:flex; align-items:center; gap:0.5rem; }
  /* Darker purple fill (not transparent) so these read as real buttons
     against the panel's own mid-purple gradient background, instead of
     nearly disappearing into it. */
  .stats-carousel-arrow{
    flex:0 0 auto;
    background:rgba(15,16,20,0.75);
    border:1px solid rgba(255,255,255,0.4);
    color:#fff;
    font-size:18px;
    line-height:1;
    width:2.2em;
    height:2.2em;
    cursor:pointer;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
  }
  .stats-carousel-arrow:hover{ border-color:#fff; background:rgba(20,21,26,0.9); transform:scale(1.06); }
  .stats-carousel-arrow:active{ transform:scale(0.96); }
  /* Viewport clips the slide; height is fixed to the tallest page's real
     height (the FLOOR page, which carries a coin thumbnail the other
     two don't) so nothing resizes as pages swap. Every .stats-page is
     absolutely positioned inside it and slides via transform — a real
     swipe, not an instant cut. Genuinely bidirectional: .stats-page-prev
     exits left (forward nav), .stats-page-exit-right exits right
     (backward nav), .stats-page-park-left instantly repositions a page
     off-screen left with no transition, right before it's animated in
     from that side. */
  /* Height is synced to whichever page is actually showing (see
     syncStatsViewportHeight) instead of a fixed guess sized to the
     tallest page — the shorter ITEMS/HOLDERS/24H ACTIVITY pages were
     leaving a dead-space gap between the tiles and the dots below when
     a fixed height assumed FLOOR's own (taller) content. min-height here
     is only a same-paint-frame fallback before JS runs. */
  .stats-carousel-viewport{ position:relative; min-height:72px; overflow:hidden; flex:1; min-width:0; transition:height 0.3s ease; }
  .stats-page{
    position:absolute;
    top:0; left:0; width:100%;
    transform:translateX(100%);
    opacity:0;
    pointer-events:none;
    transition:transform 0.45s cubic-bezier(0.4,0,0.2,1), opacity 0.45s ease;
  }
  .stats-page.stats-page-active{ transform:translateX(0); opacity:1; pointer-events:auto; }
  .stats-page.stats-page-prev{ transform:translateX(-100%); opacity:0; }
  .stats-page.stats-page-exit-right{ transform:translateX(100%); opacity:0; }
  .stats-page.stats-page-park-left{ transition:none; transform:translateX(-100%); opacity:0; }
  @media (prefers-reduced-motion: reduce){
    .stats-page{ transition:opacity 0.3s ease; }
    .stats-page:not(.stats-page-active){ transform:none; }
  }
  /* Dots under the auto-rotating strip, so it reads as a carousel rather
     than a bar that mysteriously changes. */
  .stats-carousel-dots{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:0.4rem;
    margin-top:0.65rem;
  }
  .stats-dot{
    width:6px;
    height:6px;
    border-radius:50%;
    background:var(--border-mid);
    transition:background 0.2s ease, transform 0.2s ease;
  }
  .stats-dot.active{ background:var(--cyan); box-shadow:0 0 6px var(--cyan-glow); transform:scale(1.3); }
  /* Same grey box treatment as the DATABASE panel (.sw-panel's own
     --panel-bg + --border-dim) — reads as a distinct card against the
     purple gradient behind it instead of nearly disappearing into it.
     The FLOOR page's own tiles (.stat-tile-pigeons/-xrpcafe/-deeptide)
     override this with their own colours below, untouched. */
  .stat-tile{
    border:1px solid var(--border-dim);
    background:var(--panel-bg);
    padding:0.85rem 0.5rem;
    text-align:center;
    border-radius:var(--radius);
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
  }
  .stat-tile-link{ width:100%; text-decoration:none; cursor:pointer; font:inherit; transition:border-color 0.15s ease, background 0.15s ease; }
  .stat-tile-link:hover{ background:var(--cyan-faint); border-color:var(--cyan-dim); }
  .stat-label{ font-size:11.5px; letter-spacing:0.1em; color:var(--grey-dim); margin-bottom:0.5rem; text-transform:uppercase; }
  .stat-value{ font-size:16px; letter-spacing:0.03em; color:var(--white); }
  .stat-tile-link .stat-value{ color:var(--grey); }
  .stat-tile-link:hover .stat-value{ color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); }
  /* Σκύλλα-native listings — magenta, matching the SCYLLA/target colour language */
  .stat-tile-link.scylla-active{ border-color:var(--magenta); background:var(--magenta-faint); }
  .stat-tile-link.scylla-active:hover{ background:var(--magenta-faint); border-color:var(--magenta); }
  .stat-tile-link.scylla-active .stat-value{ color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); }
  /* $PIGEONS FLOOR — flat --collection-accent (the collection's own real
     colour, same as the trustline banner above it), no artwork/
     thumbnail — a plain currency-colored tile, not a mini poster. */
  .stat-tile-pigeons{
    border-color:var(--collection-accent);
    background:linear-gradient(160deg, rgba(var(--collection-accent-rgb),0.55), rgba(var(--collection-accent-2-rgb),0.65));
  }
  .stat-tile-pigeons:hover{ background:linear-gradient(160deg, rgba(var(--collection-accent-rgb),0.7), rgba(var(--collection-accent-2-rgb),0.8)); border-color:var(--collection-accent); }
  .stat-tile-pigeons .stat-label{ color:#fff; opacity:0.9; }
  .stat-tile-pigeons .stat-value{ color:#fff !important; text-shadow:0 1px 4px rgba(0,0,0,0.8); font-weight:700; }
  /* Marketplace floor tiles — used two different shades of blue (their
     own brand-ish colours) so FL00R :: XRP.CAFE and FL00R :: DEEPT!DE
     read as distinct sources; now distinguished with the site's own two
     accent colours instead — XRP.CAFE cyan, DEEPT!DE magenta. */
  .stat-tile-xrpcafe{
    border-color:var(--cyan-dim);
    background:linear-gradient(160deg, var(--cyan-faint), rgba(8,9,11,0.8));
  }
  .stat-tile-xrpcafe:hover{ background:linear-gradient(160deg, var(--cyan-faint), rgba(8,9,11,0.9)); border-color:var(--cyan); }
  .stat-tile-xrpcafe .stat-label{ color:#fff; opacity:0.9; }
  .stat-tile-xrpcafe .stat-value{ color:#fff !important; text-shadow:0 1px 4px rgba(0,0,0,0.6); font-weight:700; }
  .stat-tile-deeptide{
    border-color:var(--magenta-dim);
    background:linear-gradient(160deg, var(--magenta-faint), rgba(8,9,11,0.8));
  }
  .stat-tile-deeptide:hover{ background:linear-gradient(160deg, var(--magenta-faint), rgba(8,9,11,0.9)); border-color:var(--magenta); }
  .stat-tile-deeptide .stat-label{ color:#fff; opacity:0.9; }
  .stat-tile-deeptide .stat-value{ color:#fff !important; text-shadow:0 1px 4px rgba(0,0,0,0.6); font-weight:700; }
  /* Deliberate placeholder tile/link, real tracking is a later system */
  .stat-tile-soon{ opacity:0.55; border-style:dashed; }
  .stat-tile-soon:hover{ opacity:0.85; }
  .stat-tile-soon .stat-value{ letter-spacing:0.1em; }
  /* BURNT count — folded into the ITEMS tile instead of its own tile; the
     burn list itself doesn't exist yet (later system), so this is a
     placeholder link, styled quieter than the number it sits next to. */
  .stat-burnt-link{
    background:transparent;
    border:none;
    font:inherit;
    font-size:11px;
    letter-spacing:0.03em;
    color:var(--grey-dim);
    cursor:pointer;
    text-decoration:none;
    padding:0;
  }
  .stat-burnt-link:hover{ color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); }
  .card-scylla-listed{ margin-top:0.4rem; font-size:10px; letter-spacing:0.05em; color:var(--magenta); text-shadow:0 0 5px var(--magenta-glow); text-align:center; text-transform:uppercase; }

  /* ---- top 10 holders (expandable) ---- */
  .th-toggle{
    display:block;
    width:100%;
    text-align:center;
    background:transparent;
    border:none;
    font-family:var(--font-mono);
    font-size:12px;
    letter-spacing:0.18em;
    color:var(--cyan);
    text-shadow:0 0 5px var(--cyan-glow);
    text-transform:uppercase;
    cursor:pointer;
    padding:0;
  }
  .th-list{ margin-top:1rem; border-top:1px dashed var(--border-dim); padding-top:0.5rem; }

  /* ---- horizontal top tabs (DATABASE / MY PIGEONS / TOP 10 / SALES HISTORY)
     — sits directly under #collectionDetailsPanel (that info box lives
     right above it in the DOM, shown/hidden by showTab() same as any
     other tab's panel), and stays the one always-visible element that
     switches between every tab, including on tabs with no info box. ---- */
  /* Wrap exists purely to pin the left/right scroll-hint fades to the
     visible edge of the tab strip regardless of scroll position — a
     pseudo-element living inside #topTabs itself would scroll away with
     the content since #topTabs is the overflow-x:auto element. Fades are
     hidden by default (JS toggles .has-more-left/.has-more-right on the
     wrap once it can measure real overflow) so they never flash on a
     screen wide enough to show every tab at once. */
  /* overflow:hidden isn't for clipping here (the fades never extend past
     these bounds) — it's to stop #topTabs' own margin-top/bottom from
     collapsing straight through this wrap, which would otherwise leave
     the wrap's rendered box shorter than the actual visible tab strip and
     throw off where top:0/bottom:1.75rem below land. */
  .top-tabs-wrap{ position:relative; overflow:hidden; }
  .top-tabs-wrap::before, .top-tabs-wrap::after{
    content:'';
    position:absolute;
    top:0;
    bottom:1.75rem; /* stop above the tab strip's own margin-bottom, not the page below it */
    width:28px;
    pointer-events:none;
    opacity:0;
    transition:opacity 0.15s ease;
    z-index:1;
  }
  .top-tabs-wrap::before{ left:0; background:linear-gradient(to right, var(--bg), transparent); }
  .top-tabs-wrap::after{ right:0; background:linear-gradient(to left, var(--bg), transparent); }
  .top-tabs-wrap.has-more-left::before{ opacity:1; }
  .top-tabs-wrap.has-more-right::after{ opacity:1; }
  .top-tabs{
    display:flex;
    overflow-x:auto;
    gap:0.4rem;
    margin-top:1.25rem;
    margin-bottom:1.75rem;
    border-bottom:1px solid var(--border-dim);
  }
  .tab-btn{
    flex:1 1 auto;
    white-space:nowrap;
    background:transparent;
    border:none;
    border-bottom:2px solid transparent;
    font-family:var(--font-mono);
    font-size:15px;
    font-weight:700;
    letter-spacing:0.08em;
    color:var(--grey-dim);
    text-transform:uppercase;
    cursor:pointer;
    padding:0.85em 0.5em;
    transition:color 0.15s ease;
  }
  .tab-btn:hover{ color:var(--grey); }
  .tab-btn.active{ color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); border-bottom-color:var(--cyan); }
  /* FL0CK tab doubles as the login entry point (see topTabs' click
     handler — clicking it with no session goes straight into a real
     Σκύλλα/Xaman login) — logged-out state spells that out directly on
     the tab instead of making you click in to discover a CONNECT
     button. Logged-in state instead shows pigeon/offer counts, same
     magenta Σκύλλα theme either way. */
  .flock-tab-login{ color:var(--magenta); }
  /* Σκύλλα itself always reads as the brand's own magenta/pink, active tab
     or not — was falling back to the plain .tab-btn colour (grey, or cyan
     only while this tab happened to be active), which made the count next
     to it (also grey) blur into one flat, lifeless line. */
  .flock-tab-brand{ color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); }
  .flock-tab-count{ color:var(--cyan); text-shadow:0 0 6px var(--cyan-glow); }
  /* Small notification-dot badge, not a second joined text phrase (see
     updateFlockTabLabel's own comment on why that wrapped badly on
     mobile) — a real count, just compact enough to never itself need to
     wrap. */
  .flock-tab-offer-dot{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-width:1.3em;
    height:1.3em;
    margin-left:0.35em;
    padding:0 0.3em;
    border-radius:999px;
    background:var(--magenta);
    color:#000;
    font-size:0.65em;
    font-weight:700;
    text-shadow:none;
    vertical-align:middle;
  }
  /* DATABASE carries the collection picker inline now, instead of that
     living as its own row above the whole tab strip. */
  .tab-btn-database{ display:inline-flex; align-items:center; justify-content:center; gap:0.5rem; }
  /* Mobile: a boxed grid "hub" instead of a horizontally-scrolling strip —
     every tab visible and tappable at once up top, nothing to swipe
     through or guess is off-screen. DATABASE spans the full width of its
     own row since it also carries the collection picker (P!GE0NS ▾) and
     needs the room; the rest fall into a 2-across grid below it. Has to
     come AFTER the base .tab-btn/.tab-btn.active/.tab-btn-database rules
     above (not before, where it originally sat) — same specificity, so
     source order decides the tie and an earlier copy just gets silently
     overridden by the later base rule regardless of the media query.
     updateTopTabsFade's has-more-left/-right math (maxScroll =
     scrollWidth - clientWidth) needs no JS change for this — a grid with
     nothing to horizontally scroll always measures maxScroll <= 0, so
     those fade classes simply never get added any more. */
  @media (max-width:700px){
    .top-tabs-wrap::before, .top-tabs-wrap::after{ display:none; }
    .top-tabs{
      display:grid;
      grid-template-columns:repeat(2, 1fr);
      overflow-x:visible;
      gap:0.6rem;
      border-bottom:none;
    }
    .tab-btn{
      flex:none;
      white-space:normal;
      font-size:13px;
      letter-spacing:0.05em;
      border:1px solid var(--border-mid);
      border-radius:var(--radius);
      background:rgba(255,255,255,0.03);
      padding:1em 0.6em;
    }
    .tab-btn.active{
      border-color:var(--cyan);
      background:var(--cyan-faint);
    }
    .tab-btn-database{ grid-column:1 / -1; }
  }
  .tab-db-select{ font-size:13px; }
  /* Plain text, no boxed-dropdown look — just the label itself, coloured
     to match whichever collection is actually selected (same colours as
     the flyout's own .db-option-active/-fuzzy/-phnix). */
  #dbSelectWrap{ border:none !important; background:none !important; }
  .tab-db-select .trait-row-label{ padding:0.3em 0.2em; font-size:13px; letter-spacing:0.05em; color:var(--pigeon-purple); text-shadow:0 0 5px var(--pigeon-purple-glow); }
  /* !important: the generic .traits-hover-wrap:hover/.open rule (shared
     with SORT/ADD TRAITS) comes later in the cascade and would otherwise
     override this back to plain cyan on hover — this stays the
     collection's own colour regardless of hover/open state. */
  .tab-db-select.open .trait-row-label,
  .tab-db-select:hover .trait-row-label{ color:var(--pigeon-purple) !important; text-shadow:0 0 6px var(--pigeon-purple-glow) !important; }
  /* Flyout options are plain text, not links/buttons, so a click on them
     still bubbles up and switches to DATABASE (harmless — that's the tab
     you were already interacting with either way). */
  .tab-db-select .traits-flyout{ text-align:left; }
  /* This trigger lives inside a DATABASE tab button, inside #topTabs,
     which is overflow-x:auto for horizontal tab-bar scrolling — that
     implicitly clips the y-axis too (any non-"visible" overflow-x forces
     overflow-y to "auto" as well, per the real CSS overflow spec — an
     explicit overflow-y:visible on #topTabs does NOT override this,
     confirmed live: the computed value stayed "auto" regardless).
     position:absolute (the base .traits-flyout rule) is still a
     descendant of that clipping box no matter which direction it opens,
     so PHN!X/TEDDY were rendering but invisible, painted over by the
     trustline banner underneath. position:fixed escapes ALL ancestor
     overflow clipping since it's placed relative to the viewport instead
     — openDbSelectFlyout() sets its own top/left from the trigger's real
     on-screen position every time it opens, since fixed positioning has
     no CSS-only way to anchor to a specific element. */
  /* width:220px here too, not just on .db-select-flyout above — that rule
     and the generic .traits-flyout{ width:min(620px,90vw) } rule below
     (shared with the much wider SORT BY/FILTER BY TRAITS panels) are equal
     specificity (one class each), so the later one in the cascade was
     winning and silently blowing this compact 3-4-item picker out to 90vw
     (337px on a 375px phone) — confirmed live, that's what pushed its
     right edge off-screen. Two classes here outranks both. */
  .tab-db-select .db-select-flyout{ position:fixed; top:0; left:0; width:220px; }
  /* Grid, not flex — RANK and COUNT sit in equal (1fr) side columns, so
     the middle WALLET column always lands on the row's true center
     regardless of how wide the rank/count text on either side happens to
     be (a fixed-width rank column next to an auto-width count column,
     the old flex setup, only centered the wallet within its own leftover
     space — not the same thing once count's text got wider than rank's). */
  .th-row{
    display:grid;
    grid-template-columns:1fr auto 1fr;
    align-items:center;
    gap:0.75rem;
    padding:0.9em 0.6em;
    border-bottom:1px solid var(--border-dim);
    cursor:pointer;
    font-size:17px;
    letter-spacing:0.03em;
    transition:background 0.15s ease;
  }
  .th-row:last-child{ border-bottom:none; }
  .th-row:hover{ background:var(--cyan-faint); }
  /* Top 15 read as a cut above the rest of the list — same layout, just
     a step up in size. */
  .th-row-top{ font-size:19px; padding:1.1em 0.6em; }
  .th-rank{ color:var(--cyan); text-align:right; display:flex; align-items:center; justify-content:flex-end; gap:0.5rem; }
  /* Rarest-held-Pigeon thumbnail, top 15 rows only. */
  .th-thumb{ width:34px; height:34px; border-radius:var(--radius); object-fit:cover; flex:0 0 auto; border:1px solid var(--border-mid); }
  .th-wallet{ min-width:0; color:var(--white); word-break:break-all; text-align:center; }
  .th-count{ color:var(--white); text-transform:uppercase; text-align:left; }
  .th-empty{ text-align:center; font-size:11px; letter-spacing:0.08em; color:var(--grey-dim); padding:0.5rem 0; text-transform:uppercase; }

  /* Every address-display spot site-wide (walletTagHtml/setWalletText) —
     starts as plain short-address text, an avatar/username silently slots
     in ahead of it the moment that wallet's profile resolves. */
  .wallet-tag{ display:inline-flex; align-items:center; gap:0.35em; vertical-align:middle; }
  .wallet-avatar{ width:1.3em; height:1.3em; min-width:1.3em; border-radius:50%; object-fit:cover; flex:0 0 auto; border:1px solid var(--border-mid); }
  /* PR0F!LE panel — current username/avatar, big and unmissable at the
     top, same reasoning as the highest-offer box elsewhere. */
  .profile-current-row{ display:flex; align-items:center; gap:1rem; justify-content:center; margin-bottom:1rem; }
  .profile-current-avatar{ width:64px; height:64px; border-radius:50%; overflow:hidden; background:#000; border:1px solid var(--border-mid); flex:0 0 auto; }
  .profile-current-avatar img{ width:100%; height:100%; object-fit:cover; display:block; }
  .profile-current-username{ font-family:var(--font-display); font-size:22px; font-weight:700; color:var(--green); }
  .profile-current-wallet{ font-size:12px; letter-spacing:0.03em; color:var(--grey-dim); text-transform:uppercase; word-break:break-all; }
  /* Currently-selected pfp in the picker grid — same green highlight the
     rest of the app uses for "this is the real/active one" (see
     .highest-offer-price). */
  .simple-picker-card-selected{ border-color:var(--green); box-shadow:0 0 0 1px var(--green); }
  /* ---- MY C0!NS (PR0F!LE) — one clean row per collection, real balance/
     trustline for anything with a token, C0M!NG S00N for anything without
     one yet. Own colour per row via --card-accent (same r,g,b convention
     COLLECTION_META's own trustline-banner theming already uses), so this
     reads as "the same coins from MAINFRAME" rather than a plain list. ---- */
  .profile-coins-list{ display:flex; flex-direction:column; gap:0.6rem; margin-bottom:1.5rem; }
  .profile-coin-row{
    display:flex;
    align-items:center;
    gap:1rem;
    padding:0.75rem 1rem;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    background:linear-gradient(90deg, rgba(var(--card-accent, 61,243,236),0.08), transparent 60%);
  }
  .profile-coin-thumb{
    width:44px; height:44px; flex:0 0 auto;
    border-radius:var(--radius);
    border:1px solid rgba(var(--card-accent, 61,243,236), 0.4);
    background-size:cover; background-position:center;
    background-color:rgba(var(--card-accent, 61,243,236), 0.18);
  }
  .profile-coin-info{ flex:1 1 auto; min-width:0; text-align:left; }
  .profile-coin-label{ font-family:var(--font-display); font-size:16px; font-weight:700; color:#fff; }
  .profile-coin-balance{ font-family:var(--font-mono); font-size:12px; letter-spacing:0.03em; color:var(--grey); margin-top:0.15rem; }
  .profile-coin-balance .hi{ color:var(--green); font-weight:600; }
  .profile-coin-balance.profile-coin-warn{ color:var(--red); }
  .profile-coin-action{
    flex:0 0 auto;
    background:var(--green);
    border:1px solid var(--green);
    color:#000;
    font-family:var(--font-mono);
    font-weight:700;
    font-size:12px;
    letter-spacing:0.03em;
    text-transform:uppercase;
    padding:0.6em 0.9em;
    border-radius:var(--radius);
    cursor:pointer;
    white-space:nowrap;
  }
  .profile-coin-action:hover{ background:#000; color:var(--green); }
  .profile-coin-action.profile-coin-action-soon{
    background:transparent; color:var(--grey-dim); border-color:var(--border-mid); cursor:default;
  }
  .profile-coin-action.profile-coin-action-soon:hover{ background:transparent; color:var(--grey-dim); }

  /* ---- sales history ---- */
  /* XRP / $P!GE0NS — each its own independent feed/pagination (see the
     currency branches in pigeons.js), not a client-side filter over one
     merged list. Big, obvious, only two choices — same "clean, glanceable"
     treatment the rows themselves now get below. */
  .sale-currency-toggle{ display:flex; gap:0.6rem; justify-content:center; margin:0.75rem 0 0.25rem; }
  .sale-currency-btn{
    flex:0 0 auto;
    min-width:140px;
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:16px;
    font-weight:700;
    letter-spacing:0.05em;
    padding:0.7em 1.4em;
    border-radius:var(--radius);
    cursor:pointer;
    transition:background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .sale-currency-btn:hover{ border-color:var(--cyan); color:var(--cyan); }
  .sale-currency-btn-active{ border-color:var(--green); color:var(--green); background:rgba(0,255,140,0.08); }
  /* No max-height/overflow of its own any more — reported live as not
     needing "two scroll bars" (this box scrolling internally, inside the
     whole page also scrolling). Now just flows as part of the normal
     page, with the infinite-scroll trigger (salesScrollObserver in the
     JS) rooted at the page viewport instead of this element. */
  .sales-scrollbox{
    margin-top:1rem;
    border-top:1px dashed var(--border-dim);
    padding-top:0.5rem;
  }
  /* Grid, not flex-wrap — same reasoning as .th-row's own comment (T0P
     123 H0LDERS): fixed columns are what actually keep every row's
     fields lined up under each other down the whole list, which a
     wrapping flex row can't guarantee once content lengths differ row to
     row. Reported live as "doesn't look clean" / "make everything line
     up". Pigeon number lives right next to the thumbnail (its own
     .sale-thumb-wrap group, back after briefly being its own column on
     the far side — reported live as reading too far from the thumbnail
     out there, and crowding the time column next to it). Addresses get
     the true middle column, centered. */
  .sale-row{
    display:grid;
    grid-template-columns:200px 150px 1fr 140px;
    align-items:center;
    gap:1rem;
    padding:1.1rem 0.6rem;
    border-bottom:1px solid var(--border-dim);
    font-size:16px;
    letter-spacing:0.03em;
    cursor:pointer;
    transition:background 0.15s ease;
  }
  .sale-row:hover{ background:var(--cyan-faint); }
  .sale-row:last-child{ border-bottom:none; }
  .sale-thumb-wrap{ display:flex; align-items:center; gap:0.6rem; min-width:0; }
  .sale-thumb{ flex:0 0 auto; width:72px; height:72px; border:1px solid var(--border-dim); }
  .sale-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
  .sale-num-box{
    font-size:16px;
    letter-spacing:0.05em;
    color:var(--white);
    border:1px solid var(--border-mid);
    padding:0.35em 0.7em;
    white-space:nowrap;
    border-radius:var(--radius);
  }
  .sale-price-cell{ display:flex; flex-direction:column; gap:0.2rem; min-width:0; }
  /* Bigger and bolder than the rest of the row on purpose (this is the
     one number every sale is really "about"), with a soft glow behind
     it — reported live as small green text being hard to read; the glow
     is what actually fixes that at small sizes, not just going bigger. */
  .sale-price{ font-family:var(--font-display); font-size:28px; font-weight:700; color:var(--green); text-shadow:0 0 10px rgba(0,255,140,0.45); white-space:nowrap; }
  .sale-via{ font-family:var(--font-body); font-size:13px; letter-spacing:0.08em; color:var(--white); text-transform:uppercase; }
  .sale-parties{ font-family:var(--font-body); font-size:18px; color:var(--white); text-transform:none; text-align:center; min-width:0; overflow-wrap:anywhere; }
  .sale-parties a{ color:var(--white); text-decoration:underline; cursor:pointer; }
  .sale-parties a:hover{ color:var(--cyan); }
  .sale-time{ font-family:var(--font-body); color:var(--white); text-transform:uppercase; font-size:15px; text-align:right; }
  /* Icon-left/details-right list layout, not a full stack — a plain
     top-to-bottom stack (the previous version) read as an unrelated pile
     of text lines rather than one grouped row, especially once the tall
     thumbnail towered over the much shorter number badge next to it.
     The thumbnail+number column spans every text row beside it here, so
     there's always a clear left anchor tying the whole row together. */
  @media (max-width:820px){
    .sale-row{
      grid-template-columns:84px 1fr;
      grid-template-areas:"thumb price" "thumb parties" "thumb time";
      row-gap:0.4rem;
      column-gap:0.9rem;
      align-items:start;
    }
    .sale-thumb-wrap{ grid-area:thumb; flex-direction:column; align-items:flex-start; gap:0.4rem; align-self:start; }
    .sale-num-box{ font-size:13px; padding:0.3em 0.5em; }
    .sale-price-cell{ grid-area:price; align-self:end; }
    .sale-parties{ grid-area:parties; text-align:left; }
    .sale-time{ grid-area:time; text-align:left; }
  }

  /* ---- target node header (owner-scope) — SCYLLA / MAGENTA system ---- */
  .node-eyebrow{
    text-align:center;
    font-size:11px;
    letter-spacing:0.2em;
    color:var(--magenta);
    text-shadow:0 0 7px var(--magenta-glow);
    margin-bottom:1.25rem;
    text-transform:uppercase;
  }
  .target-pigeon-card{
    border:1px solid var(--magenta-dim);
    background:var(--magenta-faint);
    border-radius:var(--radius);
    padding:1rem;
    margin:0 auto 1.25rem;
    max-width:420px;
  }
  .tp-label{
    text-align:center;
    font-size:10px;
    letter-spacing:0.2em;
    color:var(--grey);
    margin-bottom:0.75rem;
    text-transform:uppercase;
  }
  .tp-body{ display:flex; align-items:center; gap:1rem; }
  .tp-img{ flex:0 0 76px; width:76px; height:76px; border:1px solid var(--magenta-dim); }
  .tp-info{ flex:1; min-width:0; }
  .tp-num{ font-size:16px; color:var(--white); margin-bottom:0.5rem; }
  .tp-owner-label{ font-size:9px; letter-spacing:0.15em; color:var(--grey-dim); text-transform:uppercase; }
  .tp-owner{ font-size:12px; color:var(--grey); word-break:break-all; }
  .wallet-box{
    position:relative;
    text-align:center;
    border:1px solid var(--magenta);
    background:var(--magenta-faint);
    box-shadow:0 0 22px var(--magenta-faint) inset, 0 0 14px rgba(255,63,208,0.18);
    border-radius:var(--radius);
    padding:1.5rem 1rem;
    margin-bottom:1.25rem;
    animation:flicker-in 0.5s ease-out;
  }
  .wallet-box-title{
    font-size:14px;
    font-weight:700;
    letter-spacing:0.18em;
    color:var(--magenta);
    text-shadow:0 0 9px var(--magenta-glow);
    margin-bottom:0.75rem;
    text-transform:uppercase;
  }
  .wallet-box-sub{ font-size:10px; letter-spacing:0.2em; color:var(--grey-dim); font-weight:400; }
  .wallet-box-addr{ font-size:16px; color:var(--white); margin-bottom:0.6rem; word-break:break-all; letter-spacing:0.02em; }
  .wallet-box-count{ font-size:12.5px; letter-spacing:0.1em; color:var(--grey); text-transform:uppercase; }

  /* ---- search / sort bar — VIEW and SORTING BY now sit right in this
     row next to SEARCH, and everything here (input, GO, VIEW, SORT,
     RESET, edition buttons) shares one bigger size and the same
     border/hover/active colour language as the ALL / 1ST EDITION /
     2ND EDITION buttons. ---- */
  .search-row{
    display:flex;
    align-items:center;
    gap:0.75rem;
    flex-wrap:wrap;
    margin-bottom:0.75rem;
  }
  .sort-stack-row{
    display:flex;
    align-items:flex-start;
    gap:0.6rem;
    flex-wrap:wrap;
    margin-bottom:0.75rem;
  }
  /* ADD TRAITS now lives in its own db-config-group box, directly under
     the COLLECTION box — left-aligned (not centered like COLLECTION) so
     its content starts flush with the search bar above it. */
  .db-config-traits-group{ text-align:left; }
  /* Real visible feedback for whichever S0RT/TRA!TS are actually applied —
     #sortRows/#traitRows/#clearTraitsBtn's own trigger boxes moved into
     #dbControlsSticky (display:none, see its own HTML comment), so this
     row needs its own copy of the same flex/wrap/gap layout
     .db-config-traits-section used to provide them for free. */
  .applied-filters-row{
    display:flex;
    flex-direction:row;
    flex-wrap:wrap;
    justify-content:flex-start;
    align-items:center;
    gap:0.5rem;
    margin-bottom:0.75rem;
  }
  @media (max-width:700px){
    .applied-filters-row{ justify-content:center; }
  }
  .db-config-traits-section{
    display:flex;
    /* Row, not column — selected trait chips (#traitRows) list to the
       right of the fixed-width ADD TRA!TS box instead of stacking
       underneath it, wrapping to a new line only once they run out of
       room. ADD TRA!TS itself never resizes since its width is pinned
       (see #traitsHoverWrap) and #traitRows is a separate sibling. */
    flex-direction:row;
    flex-wrap:wrap;
    justify-content:flex-start;
    align-items:center;
    gap:0.5rem;
  }
  /* Left-aligned (to line up with the search bar above) makes sense on
     desktop, but on a phone the search bar above it is itself centered
     (see .results-header-row's own max-width:700px override) — left-
     aligning just this box underneath it reads as randomly off-center.
     Center SORT BY / FILTER BY TRAITS (and their applied-tag rows) to
     match everything else in this column on narrow screens. */
  @media (max-width:700px){
    .db-config-traits-group{ text-align:center; }
    .db-config-traits-section{ justify-content:center; }
    /* #sortRows has no CSS of its own elsewhere (it's a plain block div —
       #traitRows is the one with display:flex, at line 1003) — its single
       .trait-row child is itself display:flex (block-level), so the
       ancestor's text-align:center above does nothing for it without
       becoming a flex container in its own right here too. */
    #sortRows{ display:flex; justify-content:center; }
    #traitRows{ justify-content:center; }
  }
  /* justify-content:center + wrap so this stays centered as a group
     whether it fits on one line or (narrower widths) the label and the
     dropdown box wrap to their own lines — previously only the whole
     .sort-field-inline group was centered within the results-header-row
     grid, not its own two pieces relative to each other once wrapped. */
  .sort-field{ display:flex; align-items:center; justify-content:center; gap:0.6rem; flex-wrap:wrap; }
  .sort-field-label{
    font-size:12px;
    letter-spacing:0.1em;
    color:var(--white);
    text-transform:uppercase;
    white-space:nowrap;
  }
  input.search-input{
    flex:0 1 150px;
    background:#000;
    border:1px solid var(--border-mid);
    color:var(--white);
    font-family:var(--font-mono);
    font-size:13px;
    letter-spacing:0.05em;
    padding:0.75em 0.8em;
    border-radius:var(--radius);
    transition:border-color 0.15s ease;
  }
  input.search-input:focus{ outline:none; border-color:var(--cyan); box-shadow:0 0 0 1px var(--cyan-dim); }
  input.search-input::placeholder{ color:var(--grey-disabled); text-transform:uppercase; }
  .search-row .bar-btn{ padding:0.75em 1em; font-size:12px; }
  /* Same fixed width as every other config control (var(--ctrl-w)) —
     shorter placeholder below so it still reads at this width instead of
     clipping mid-word. */
  #searchInput{ flex:0 0 auto; width:var(--ctrl-w); }
  /* GO button for the combined pigeon-number/wallet search — purple,
     matching the collection's own theme colour, not the neutral grey
     .bar-btn default. */
  #searchBtn{ border-color:var(--pigeon-purple-dim); color:var(--pigeon-purple); }
  #searchBtn:hover{ border-color:var(--pigeon-purple); background:var(--pigeon-purple-faint); color:var(--pigeon-purple); }
  .bar-btn{
    flex:0 0 auto;
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:15px;
    font-weight:700;
    letter-spacing:0.04em;
    padding:0.95em 1.3em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  .bar-btn:hover{ border-color:var(--cyan); color:var(--cyan); background:var(--cyan-faint); }
  /* C0UNTER (myPigeonOffersHtml) — clearly unavailable, not just a
     plain button that happens to do nothing, same treatment
     .action-btn:disabled already gets elsewhere. */
  .bar-btn:disabled{ opacity:0.4; cursor:not-allowed; }
  .bar-btn:disabled:hover{ border-color:var(--border-mid); color:var(--grey); background:transparent; }
  /* CANCEL/DEL!ST — red, not the neutral grey .bar-btn default, since
     this is the one action here that actually removes something real.
     Shared by both card variants (.delist-pigeon-btn) and the detail
     screen's own copy (#detailScyllaDelistBtn). Same font-size/padding
     as BUY N0W/0FFER (.thumb-buy-btn/.offer-open-modal-btn) below,
     not .bar-btn's smaller 13px/tighter default — so every action
     button on a card is the same size regardless of which ones a given
     card happens to show, and a grid of them lines up cleanly. */
  .delist-pigeon-btn, #detailScyllaDelistBtn, .list-open-modal-btn, .transfer-open-modal-btn{
    font-size:15px;
    padding:0.85em 0.7em;
    font-weight:700;
    letter-spacing:0.05em;
  }
  /* L!ST/TRANSFER specifically — reported live as reading grey/washed-out
     against CANCEL's own deliberate red; white matches the rest of the
     card's real (non-muted) text instead of looking disabled. */
  .list-open-modal-btn, .transfer-open-modal-btn{ color:var(--white); }
  .delist-pigeon-btn, #detailScyllaDelistBtn{ border-color:var(--red); color:var(--red); text-shadow:0 0 6px var(--red-glow); }
  /* ownedPigeonActionHtml's own CANCEL/L!ST + TRANSFER pair — side by
     side, not each stacked full-width, so a listed Pigeon (CANCEL +
     TRANSFER) and an unlisted one (L!ST + TRANSFER) take up the exact
     same one-row shape instead of the listed state ending up visibly
     taller than its neighbor. */
  /* width:100% — .thumb-offer (the purple box) is itself display:flex
     now (centers its content both ways so every state is the same
     height regardless of what's inside), which makes THIS row a flex
     ITEM of that box instead of an ordinary block child. A flex item
     shrink-wraps to its own content's width along the main axis by
     default instead of stretching to fill it — harmless with two
     buttons (their combined content is already nearly box-width) but a
     single button (CANCEL, or 0FFER alone) shrank to a tiny pill
     centered in the middle of the box with huge purple margin on both
     sides instead of actually filling it. Confirmed live: a lone
     CANCEL's row measured 54px wide inside a 143px box. width:100% here
     is what makes flex:1 1 0 below have real room to fill (or split
     evenly, for two) in the first place. */
  .owned-action-row{ display:flex; gap:0.4rem; width:100%; }
  /* L!ST/TRANSFER (and CANCEL/TRANSFER) as two full-width stacked bars
     instead of squeezed side by side — reported live as wanting this
     specific pair "two horizontal bars stacked". Both buttons already
     default to width:auto/flex:1 1 auto from their own shared rule
     above, which is exactly what a column flex parent needs to make
     each one a full-width bar. */
  .owned-stack-row{ display:flex; flex-direction:column; gap:0.4rem; width:100%; }
  /* A slim strip, not a tall block — two buttons genuinely fit side by
     side in a 5-across thumbnail card at this size, the 17px/1em default
     every one of these buttons normally uses on its own full-width line
     is too big once it's sharing a row. Was shrunk all the way to 11px
     here to force-fit "BUY N0W" onto one line — turned out the actual
     cause of it wrapping was a hardcoded <br> in the markup (see
     ownedPigeonActionHtml/pigeonsActionBoxHtml's own BUY N0W button),
     nothing to do with available width at all; now that that's gone,
     13px is plenty and reads far less cramped. */
  .owned-action-row .bar-btn,
  .owned-action-row .thumb-buy-btn,
  .owned-action-row .offer-open-modal-btn{
    flex:1 1 0;
    min-width:0;
    width:auto;
    margin-bottom:0;
    font-size:13px;
    letter-spacing:0.02em;
    padding:0.75em 0.4em;
    /* One line, always — BUY N0W wrapping while 0FFER stayed one made
       the two states in this row look like different components
       entirely, not just different labels. Ellipsis is just a safety
       net for an extreme-narrow viewport, not the normal case. */
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .delist-pigeon-btn:hover, #detailScyllaDelistBtn:hover{ border-color:var(--red); background:var(--red); color:#000; text-shadow:none; }
  /* Red, same accent as CLEAR TRAITS — resetting every filter is a
     destructive-feeling action, worth calling out differently from the
     neutral GO/RESET-adjacent buttons around it. */
  .reset-db-btn{ border-color:var(--red-dim); color:var(--red); text-shadow:0 0 5px var(--red-dim); }
  .reset-db-btn:hover{ border-color:var(--red); color:var(--red); background:var(--red-faint); }
  /* VIEW, then COLLECTION SELECTION, then SORTING BY + RESET — grouped
     together in one bordered box, each its own row, with a fixed-width
     label column so every selection control lines up under the next. */
  .db-config-group{
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    padding:1.1rem 1.25rem;
    margin-bottom:0.75rem;
  }
  /* S0RT BY/F!LTER BY TRA!TS' old in-page trigger boxes are display:none
     now (see the HTML's own comment on #dbControlsSticky) — real buttons
     for both live in the fixed #bottomControlsBar instead (further down
     this file). A brief sticky-row version of this lived here before that
     (position:sticky, a shadow once stuck) but was retired just as
     quickly once "at the bottom, not partway down the page" turned out to
     be the actual want. */
  .db-config-row{ margin-bottom:1rem; flex-wrap:wrap; row-gap:0.5rem; }
  .db-config-row:last-child{ margin-bottom:0; }
  .db-config-row .sort-field-label{ flex:0 0 175px; }
  /* SORT row — dropdown box, then RESET on its own line underneath it. */
  .db-config-row-stacked{ display:flex; flex-direction:column; align-items:flex-start; gap:0.6rem; }
  select.sort-select{
    flex:0 0 auto;
    background:#000;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:15px;
    letter-spacing:0.03em;
    padding:0.85em 1em;
    text-transform:uppercase;
    cursor:pointer;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  select.sort-select:hover{ border-color:var(--cyan); color:var(--cyan); background:var(--cyan-faint); }
  select.sort-select:focus{ outline:none; border-color:var(--cyan); }
  select.sort-select option{ background:var(--panel-bg-solid); color:var(--white); }
  /* Same fixed width as ADD TRA!TS (var(--ctrl-w)) so every config
     control reads as one uniform row of boxes. */
  #sortDropWrap{ padding:0; width:var(--ctrl-w); flex:0 0 auto; }
  #sortDropWrap .trait-row-label{ padding:0.85em 1em; font-size:15px; width:100%; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  #dbViewSelect{ width:var(--ctrl-w); text-align:center; text-align-last:center; }
  .edition-toggle{
    flex:0 0 auto;
    display:flex;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    overflow:hidden;
  }
  .edition-btn{
    background:transparent;
    border:none;
    border-right:1px solid var(--border-mid);
    color:var(--white);
    font-family:var(--font-mono);
    font-size:15px;
    letter-spacing:0.03em;
    padding:0.85em 1.1em;
    text-transform:uppercase;
    cursor:pointer;
    transition:border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
    /* Same width as ADD TRA!TS/SORT BY/VIEW/SEARCH — the longer edition
       labels wrap to a second line at this width rather than forcing the
       button wider. */
    width:var(--ctrl-w);
    text-align:center;
    white-space:normal;
  }
  .edition-btn:last-child{ border-right:none; }
  .edition-btn:hover{ color:var(--cyan); background:var(--cyan-faint); }
  /* Purple, not magenta — this reflects the currently-viewed collection's
     own theme colour (Pigeons = purple), same as the thumb/trustline
     strip/FLOOR tile elsewhere. Magenta stays reserved for the site's own
     static UI (SCYLLA/target/selection), cyan for general hover/active
     chrome — collection-specific controls like this one and SORTING BY
     (#sortDropWrap below) use the collection's colour instead. */
  .edition-btn.active{ background:var(--pigeon-purple-faint); color:var(--pigeon-purple); text-shadow:0 0 6px var(--pigeon-purple-glow); }
  /* Three buttons at the fixed var(--ctrl-w) (190px) each never wrapped
     (.edition-toggle is flex:0 0 auto with no wrap) — ~572px total,
     forcing the whole page to scroll horizontally on any phone-width
     screen. Below 700px they share the available width equally instead;
     white-space:normal (already set above) lets the longer labels wrap
     to a second line rather than forcing the button wider. */
  @media (max-width:700px){
    /* .edition-toggle itself was still flex:0 0 auto (sized to its own
       content) at this width — its buttons' own flex:1 1 0 only divides
       whatever width the CONTAINER actually has, so with no definite
       width on the container itself, the whole row just sized to its
       three buttons' combined content width and ran off both edges of
       the screen (confirmed live: "ALL (1-3015)" cut off on the left,
       "2ND ED!T!0N (1516-3015)" cut off on the right). width:100% here
       is what makes flex:1 1 0 below mean anything. */
    .edition-toggle{ width:100%; }
    .edition-btn{ width:auto; flex:1 1 0; padding:0.7em 0.3em; font-size:11px; }
    /* SORT BY/ADD TRAITS centering on mobile lives with
       .db-config-traits-group's own definition above (near line 828), not
       here — two sessions independently fixed the same issue and this
       duplicate copy (identical selectors/values, just missing the
       #sortRows/#traitRows follow-up the other copy has) got merged in
       alongside it; removed rather than left as dead duplication. */
  }
  .index-line{
    text-align:center;
    font-family:var(--font-body);
    font-size:9.5px;
    letter-spacing:0.06em;
    color:var(--grey-dim);
    margin-top:0.5rem;
    text-transform:uppercase;
  }
  /* A real, always-tappable fallback for every "WA!T!NG F0R S!GNATURE"
     status — window.open()-based auto-launch (openXamanPopup/
     navigateXamanPopup) has too many mobile browser/embedded-webview
     edge cases where it silently fails with no error at all (reported
     live repeatedly: BUY, MAKE 0FFER — stuck on "waiting" with nothing
     to do next). A plain anchor tap is never blocked the way
     window.open can be, so this is the guaranteed way forward
     regardless of what the automatic attempt did. Own size/weight —
     .index-line's own 9.5px default would bury this as fine print, and
     this needs to be the obvious next thing to try. */
  .xaman-manual-link{
    display:inline-block;
    margin-top:0.5rem;
    font-size:13px;
    letter-spacing:0.03em;
    color:var(--cyan);
    text-decoration:underline;
    text-transform:none;
  }
  .xaman-manual-link:hover{ color:var(--white); }
  /* MY PIGEONS' own "CONNECTING TO Σκύλλα..." status — big and centered,
     not the plain small .index-line every other status message uses,
     since this is the whole tab's content while Xaman loads. */
  /* Σκύλλα's own "S!GNAL" line — reused any time something is actively
     happening on her page (connecting, loading), not just the initial
     Xaman handshake, so it reads as "she's doing this" every time. Same
     glitch dual-shadow treatment as the site's own <h1>, just her colour
     (neon pink/magenta) instead of cyan-dominant. */
  .skylla-signal{
    font-family:var(--font-display);
    font-weight:700;
    font-size:clamp(20px, 4vw, 30px);
    letter-spacing:0.05em;
    color:var(--white);
    text-shadow:
      -1.5px 0 var(--cyan-dim),
      1.5px 0 var(--magenta-glow),
      0 0 12px var(--magenta-glow);
    text-align:center;
    margin-top:1.25rem;
    text-transform:none;
  }
  /* ---- CONNECT panel — the whole logged-out state of the Σκύλλα tab,
     one real card instead of a bare button plus a wall of status text
     all run together on one line ("WA!T!NG F0R S!GNATURE... TAP HERE"
     reported live as reading gross). One container, one state at a time
     (IDLE/CONNECT!NG/WA!T!NG/ERR0R) swapped by renderConnectPanel — see
     its own comment further down. Lives inside #myPigeonsPanel, so
     var(--cyan) here already resolves to her real neon pink (see that
     panel's own --cyan override above) — no separate colour to maintain. */
  .connect-panel{
    max-width:420px;
    margin:2.5rem auto 1rem;
    padding:2.25rem 1.5rem 2rem;
    border:1px solid var(--cyan-dim);
    border-radius:var(--radius);
    background:linear-gradient(160deg, var(--cyan-faint), transparent 65%);
    text-align:center;
  }
  /* Signal-strength bars — low and dim at rest (IDLE/ERR0R), climbing in
     a staggered pulse once a real sign request is in flight
     (.connect-panel-active), so "something is happening" reads at a
     glance even before you read the title underneath. */
  .connect-panel-icon{
    display:flex; justify-content:center; align-items:flex-end; gap:5px;
    height:34px; margin-bottom:1.4rem;
  }
  .connect-panel-icon span{
    display:block; width:6px; border-radius:2px;
    background:var(--cyan); box-shadow:0 0 8px var(--cyan-glow);
    opacity:0.3; transform:scaleY(0.45); transform-origin:bottom;
    transition:opacity 0.3s, transform 0.3s, background 0.3s;
  }
  .connect-panel-icon span:nth-child(1){ height:45%; }
  .connect-panel-icon span:nth-child(2){ height:70%; }
  .connect-panel-icon span:nth-child(3){ height:100%; }
  .connect-panel-icon span:nth-child(4){ height:65%; }
  .connect-panel-icon span:nth-child(5){ height:85%; }
  @keyframes connect-signal-bar{
    0%, 100%{ opacity:0.35; transform:scaleY(0.4); }
    50%{ opacity:1; transform:scaleY(1); }
  }
  .connect-panel-active .connect-panel-icon span{ animation:connect-signal-bar 1.1s ease-in-out infinite; }
  .connect-panel-active .connect-panel-icon span:nth-child(1){ animation-delay:0s; }
  .connect-panel-active .connect-panel-icon span:nth-child(2){ animation-delay:0.11s; }
  .connect-panel-active .connect-panel-icon span:nth-child(3){ animation-delay:0.22s; }
  .connect-panel-active .connect-panel-icon span:nth-child(4){ animation-delay:0.33s; }
  .connect-panel-active .connect-panel-icon span:nth-child(5){ animation-delay:0.44s; }
  .connect-panel-error .connect-panel-icon span{ background:var(--red); box-shadow:0 0 8px var(--red-glow); opacity:0.5; transform:scaleY(0.3); }
  @media (prefers-reduced-motion: reduce){
    .connect-panel-active .connect-panel-icon span{ animation:none; opacity:0.9; transform:scaleY(0.8); }
  }
  .connect-panel-title{
    font-family:var(--font-display); font-weight:700;
    font-size:clamp(19px, 3.6vw, 26px); letter-spacing:0.04em;
    color:var(--white); text-shadow:0 0 12px var(--cyan-glow);
  }
  .connect-panel-error .connect-panel-title{ color:var(--red); text-shadow:0 0 10px var(--red-glow); }
  .connect-panel-sub{
    font-family:var(--font-body); font-size:12px; letter-spacing:0.03em;
    color:var(--grey); margin-top:0.6rem; line-height:1.5;
  }
  .connect-panel-actions{ margin-top:1.5rem; display:flex; flex-direction:column; align-items:center; gap:0.6rem; }
  .connect-panel-btn{
    display:inline-block; font-family:var(--font-body); font-weight:600;
    font-size:13px; letter-spacing:0.05em; text-transform:uppercase;
    text-decoration:none; color:#000; background:var(--cyan);
    border:1px solid var(--cyan); border-radius:var(--radius);
    padding:0.85em 1.75em; cursor:pointer;
    box-shadow:0 0 14px var(--cyan-glow);
    transition:transform 0.15s, box-shadow 0.15s;
  }
  .connect-panel-btn:hover{ transform:translateY(-2px); box-shadow:0 0 20px var(--cyan-glow); }
  .connect-panel-btn:disabled{ opacity:0.45; cursor:not-allowed; transform:none; box-shadow:none; }
  /* The always-tappable Xaman fallback (see the .xaman-manual-link
     comment further down for why this can never just be the automatic
     window.open attempt alone) — same button treatment as CONNECT/TRY
     AGAIN so it reads as the obvious next real step, not fine print. */
  .connect-panel-btn-outline{ background:transparent; color:var(--cyan); box-shadow:none; }
  .connect-panel-btn-outline:hover{ background:var(--cyan-faint); box-shadow:0 0 14px var(--cyan-glow); }

  /* ---- trait stack filter panel (active filter = cyan) ---- */
  .traits-block{
    border-top:1px dashed var(--border-dim);
    margin-top:1rem;
    padding-top:1rem;
  }
  .results-block{
    border-top:1px dashed var(--border-dim);
    margin-top:1.25rem;
    padding-top:1.25rem;
  }
  /* A fresh query clears #resultsArea synchronously before the new page's
     results arrive (see startCollectionBrowse) — with no min-height, the
     whole page collapses for that gap and snaps back once results land,
     which threw off any scroll-into-view (e.g. picking a trait) and just
     generally felt like nothing lined up flush. Reserving roughly a page
     of results' worth of height keeps the document height stable through
     that gap instead. */
  #resultsArea{ min-height:70vh; }
  /* Applied trait filters as a horizontal, wrapping list of chips —
     not stacked one per line. */
  #traitRows{ display:flex; flex-wrap:wrap; gap:0.5rem; }
  .trait-row{
    display:flex;
    align-items:center;
    gap:0.5rem;
    flex-wrap:wrap;
  }
  .trait-row-label{
    font-size:13px;
    letter-spacing:0.2em;
    color:var(--grey);
    text-transform:uppercase;
    flex:0 0 auto;
    /* This is the actual tap target for SORT BY / FILTER BY TRAITS / the
       DATABASE collection picker (all three share this class) — it's a
       plain <span>, not a real <button>, so it has none of a button's
       default protection against a tap being interpreted as a text
       selection instead of a click. Confirmed live on a real touch tap
       (not just a synthetic dispatch): the label's text highlighted blue
       and no click handler fired at all — this is what "F!LTER BY
       TRA!TS is broken, can't be used" on mobile actually was. */
    -webkit-user-select:none;
    user-select:none;
    -webkit-tap-highlight-color:transparent;
  }
  .traits-hover-wrap{ position:relative; display:inline-flex; }
  .traits-hover-wrap .trait-row-label{ cursor:pointer; padding:0.75em 1em; font-size:15px; }
  /* ADD TRA!TS matches the collection's own purple (same as ALL (1-3015)
     and the GO button) instead of the generic cyan every other hover
     dropdown uses — always-on, not just hover/open, same reasoning as
     .tab-db-select above. */
  #traitsHoverLabel{ color:var(--pigeon-purple); text-shadow:0 0 5px var(--pigeon-purple-glow); letter-spacing:0.1em; font-size:13px; }
  /* S0RT BY matches F!LTER BY TRA!TS' own always-on purple, not the
     generic cyan hover every other dropdown gets — same collection-colour
     reasoning as ADD TRA!TS above. */
  #sortDropLabel{ color:var(--pigeon-purple); text-shadow:0 0 5px var(--pigeon-purple-glow); }
  /* Bigger than the surrounding text, not just inline with it — the
     clickable ▾ was easy to miss at the same size as the label. em-based
     so it scales with #traitsHoverLabel's own font-size above rather
     than needing its own fixed px value kept in sync. */
  .thl-arrow{ display:inline-block; font-size:1.5em; line-height:1; vertical-align:middle; margin-left:0.1em; }
  /* Fixed width (var(--ctrl-w)) so this box never resizes when traits get
     selected — #traitRows renders as a separate sibling to its right
     (see .db-config-traits-section below), not inside this wrap. */
  #traitsHoverWrap{ width:var(--ctrl-w); flex:0 0 auto; }
  #traitsHoverWrap .trait-row-label{ padding:0.9em 1.3em; width:100%; text-align:center; }
  /* SORT, ADD TRAITS, and C0LLECT!0N SELECT!0N (the top P!GE0NS ▾ picker)
     all get the same bordered-box treatment and cyan-on-hover/open text —
     plain until you actually interact with it, not permanently filled —
     same size text throughout too (see the shared font-size above). */
  #sortDropWrap, #traitsHoverWrap, #dbSelectWrap{ border:1px solid var(--border-mid); border-radius:var(--radius); transition:border-color 0.15s ease, background 0.15s ease; }
  #sortDropWrap:hover, #sortDropWrap.open,
  #traitsHoverWrap:hover, #traitsHoverWrap.open,
  #dbSelectWrap:hover, #dbSelectWrap.open{ border-color:var(--cyan-dim); }
  .traits-hover-wrap:hover .trait-row-label,
  .traits-hover-wrap.open .trait-row-label{ color:var(--cyan); text-shadow:0 0 5px var(--cyan-glow); }
  /* !important: same reasoning as .tab-db-select above — ADD TRA!TS stays
     purple regardless of hover/open state instead of the generic cyan the
     shared rule directly above would otherwise apply. */
  #traitsHoverWrap:hover .trait-row-label,
  #traitsHoverWrap.open .trait-row-label{ color:var(--pigeon-purple) !important; text-shadow:0 0 5px var(--pigeon-purple-glow) !important; }
  #sortDropWrap:hover .trait-row-label,
  #sortDropWrap.open .trait-row-label{ color:var(--pigeon-purple) !important; text-shadow:0 0 5px var(--pigeon-purple-glow) !important; }
  .traits-flyout{
    position:absolute;
    /* Opens sideways to the right of whatever triggered it (S0RT BY,
       F!LTER BY TRA!TS), not straight down underneath — top:0 keeps it
       level with the trigger's own top edge instead of dropping below it. */
    top:0;
    left:calc(100% + 0.5rem);
    z-index:60;
    /* NOT display:flex — .traits-flyout-vals below is position:absolute
       and needs its top offset measured from this element's own padding
       box; a flex container was overriding that offset (a real, observed
       browser quirk with abs-positioned flex children, not just a stray
       rule) so plain block flow is used instead. .traits-flyout-cats
       gets an explicit width instead of a flex-basis to match. */
    width:min(620px, 90vw);
    max-height:420px;
    background:var(--panel-bg-solid);
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    box-shadow:0 10px 30px rgba(0,0,0,0.6);
  }
  /* S0RT BY only (see #sortFlyout's own class in the HTML) — it has no
     categories any more (just one flat list of every option, built by
     renderSortFlyoutList), so it never needs the cats+vals split below.
     Mobile: a compact single-column popup, narrower than the two-pane
     layout since there's no second column to leave room for (this width
     is later widened by .flyout-flat's own desktop rule further down —
     kept here, not inside the max-width:700px block, so it's the
     fallback for anything between that and the min-width:701px desktop
     rule, though in practice those two breakpoints are contiguous). */
  .traits-flyout.flyout-flat{ width:260px; }
  .flyout-flat .traits-flyout-vals{ position:static; width:100%; max-height:380px; overflow-y:auto; padding:0.4rem; }
  /* Desktop only: S0RT BY becomes a permanently-visible horizontal strip
     of every option (all directly clickable, no extra navigation step)
     instead of a click-to-open popup — PREV/NEXT (#sortScrollPrevBtn/
     -NextBtn, see .hscroll-arrow below) scroll it if there are more
     options than fit. !important on display since openSortFlyout()/
     closeSortFlyout() still toggle a plain inline display:block/none
     (harmless now — clicking the S0RT BY label still runs that JS, it
     just has no visible effect here since this always wins). Scoped to
     min-width:701px specifically (not left as the unscoped base rule)
     so its higher selector specificity — #sortFlyout.flyout-flat beats
     the plain #sortFlyout the mobile block above uses — can't leak into
     and override mobile's click-to-open list. */
  /* Retired: S0RT BY/F!LTER BY TRA!TS's old desktop treatment — a
     permanently-visible strip in the page flow instead of a click-to-open
     popup. Reported live as wanting real clickable buttons that pop the
     options up centered on the page instead, same as mobile already got
     for the traits VALUES step (see .flyout-popup further down, which now
     covers both controls at every width) — so this block is disabled
     (impossible min-width) rather than deleted, in case any of its
     layout math is worth referencing later. */
  @media (min-width:99999px){
    /* Flex items default to min-width:auto, not 0 — meaning even with
       overflow-x:auto set, a flex child refuses to shrink below its
       CONTENT's own natural width, so it never actually clips/scrolls,
       it just keeps growing and pushes the whole page wider instead
       (confirmed live: docScrollWidth blew out to 2121px on a 1200px
       viewport). min-width:0 on every level of this flex chain is what
       actually lets the row stop growing and start scrolling instead —
       same underlying CSS gotcha as the earlier results-header-row grid
       overflow fix (minmax(0,1fr) there, min-width:0 here — same spec
       rule, two different display types). */
    #sortDropWrap{ width:100%; max-width:100%; display:flex; min-width:0; }
    /* The always-visible strip above already shows the current sort via
       .selected's own highlight (see renderSortFlyoutList) — the
       CATEG0RY :: VALUE tag underneath (renderSortTag, #sortRows) was
       built for when this same trigger opened/closed as a click-to-open
       dropdown (still true on mobile, kept there) and just duplicates
       the highlight now that the strip never closes. */
    #sortRows{ display:none; }
    /* The ▾ implied a click-to-open dropdown, which S0RT BY no longer is
       here — the strip next to it is permanently visible, nothing to
       expand. Still shown on mobile (kept there), where it's still a
       real toggle. */
    #sortDropLabel .thl-arrow{ display:none; }
    /* #sortDropWrap .trait-row-label's own width:100% (elsewhere in this
       file) was sized for the old fixed-190px pill, where a centered
       full-width label made sense — at this new full-row width it
       stretched to fill the ENTIRE row instead, squeezing the strip
       next to it down to nothing (confirmed live: the strip's own width
       measured 0). It only needs its natural size here. */
    #sortDropWrap .trait-row-label{ width:auto; flex:0 0 auto; }
    #sortFlyout.flyout-flat{
      display:flex !important;
      position:static;
      flex-direction:row;
      align-items:center;
      flex:1 1 auto;
      min-width:0;
      width:auto;
      max-height:none;
      background:transparent;
      border:none;
      box-shadow:none;
      padding:0;
      gap:0.4rem;
    }
    .flyout-flat .traits-flyout-vals{
      display:flex;
      flex-direction:row;
      flex-wrap:nowrap;
      overflow-x:auto;
      scroll-behavior:smooth;
      /* PREV/NEXT already cover scrolling — the native scrollbar was just
         visual clutter under the strip. */
      scrollbar-width:none;
      -ms-overflow-style:none;
      gap:0.4rem;
      max-height:none;
      padding:0.2rem;
      flex:1 1 auto;
      min-width:0;
      width:auto;
    }
    /* scrollbar-width/-ms-overflow-style above cover Firefox/legacy Edge —
       Chrome/Safari need this pseudo-element instead, no shared property
       for it. */
    .flyout-flat .traits-flyout-vals::-webkit-scrollbar{ display:none; }
    .flyout-flat .traits-flyout-val{
      width:auto;
      flex:0 0 auto;
      white-space:nowrap;
      margin-bottom:0;
      /* Cleaned up for the strip: a plain chip instead of the vertical
         list's justify-between row (no room for a value on its own line
         to spread its label/count apart sideways here) and a lighter
         border so eleven of these side by side doesn't look as busy as
         eleven full-width list rows did. */
      justify-content:center;
      gap:0.4em;
      padding:0.6em 0.9em;
      border-color:var(--border-dim);
    }
    /* F!LTER BY TRA!TS gets the same permanently-visible, in-page-flow
       treatment as S0RT BY above, instead of the unscoped .traits-flyout
       base rule further down this file (position:absolute, floating out
       to the right of the trigger — built for the mobile drilled-value
       overlay, not this). !important for the same reason as .flyout-flat's
       own display rule above — open/closeTraitsFlyout() still toggle a
       plain inline display:block/none on click, harmless now since this
       always wins at this width.
       No flex-wrap here — same as #sortDropWrap right above (it has none
       either). A first attempt used flex-wrap:wrap on this row so the
       label+flyout could drop to separate lines if they didn't fit, but
       that's exactly what broke it: the categories inside #traitsFlyout
       are wide (7 fixed-width chips, way more content than the row has
       room for), so the browser wrapped the ENTIRE flyout onto its own
       line below the label instead of shrinking it in place (confirmed
       live — measured flyout width came out ~equal to the whole row's
       width, sitting below the label, not beside it). Plain nowrap forces
       a single line no matter how wide the content wants to be; flex:1 1
       auto + min-width:0 on the flyout below is what actually lets it
       shrink to the real remaining space next to the label — the same
       two properties #sortFlyout.flyout-flat already relies on. */
    /* center — #traitsFlyout's vals row is position:absolute (see
       #traitsFlyout > .traits-flyout-vals below), so it no longer counts
       toward #traitsFlyout's in-flow height; the cats row is the only
       row left in flow, so centering this against it now lines the label
       up with the category chips beside it instead of sitting above
       them. */
    #traitsHoverWrap{ width:100%; max-width:100%; display:flex; align-items:center; min-width:0; }
    #traitsHoverWrap .trait-row-label{ width:auto; flex:0 0 auto; }
    /* The ▾ implied a click-to-open dropdown, same as S0RT BY's own arrow
       fix above — this box is permanently visible here too, nothing to
       expand. Still shown on mobile (kept there), where it's still a
       real toggle. */
    #traitsHoverLabel .thl-arrow{ display:none; }
    #traitsFlyout{
      display:flex !important;
      position:static;
      /* Column — exactly two rows stacked: .traits-flyout-cats-row (the
         prev-arrow/cats/next-arrow trio, wrapped in its own row in the
         HTML — see its own rule below) on top, .traits-flyout-vals
         underneath. Two flex-wrap attempts at THIS level both broke
         differently (a first pass made the arrows their own stacked rows
         when this was column; a second pass tried row+wrap directly on
         these 5 children, but flex-wrap's line-packing uses each item's
         un-shrunk CONTENT width to decide what fits a line, and cats'
         real content — 7 fixed-width chips — is far wider than available
         space, so it kept getting a line to itself and bumping the next
         arrow to a 3rd line entirely; confirmed live both times). Plain
         column stacking of exactly 2 already-self-contained rows sidesteps
         all of that — nothing here needs to make a wrapping decision. */
      flex-direction:column;
      align-items:stretch;
      flex:1 1 auto;
      min-width:0;
      width:auto;
      max-height:none;
      background:transparent;
      border:none;
      box-shadow:none;
      padding:0;
      gap:0.4rem;
      /* Anchors #traitsFlyoutVals' own position:absolute below — the
         values panel is a real dropdown now (floats over the page,
         doesn't push #traitRows/results down), not a second row stacked
         in this column's own flow. */
      position:relative;
      /* The unscoped .traits-flyout base rule (further down this file,
         built for the mobile drilled-value popup) sets top:0 and
         left:calc(100% + 0.5rem) — those apply to position:relative
         same as position:absolute (only position:static ignores top/
         left entirely), so switching this to relative without resetting
         them shoved the whole thing ~1100px off-screen to the right
         (confirmed live: #traitsFlyout's own computed left came back as
         1102px). Cancel both back out explicitly. */
      top:auto;
      left:0;
    }
    /* Nowrap, same trick as #traitsHoverWrap's own label+flyout row —
       cats shrinks (flex:1 1 auto + min-width:0) to whatever's left after
       the two fixed-size arrow buttons, instead of flex-wrap trying (and
       failing, see #traitsFlyout's own comment) to decide whether all
       three fit on one line based on cats' full unshrunk content width. */
    .traits-flyout-cats-row{ display:flex; flex-direction:row; flex-wrap:nowrap; align-items:center; gap:0.4rem; width:100%; min-width:0; }
    /* Targets the #id, not just the class, so this actually outranks the
       plain #traitsFlyoutCats{flex:0 0 var(--ctrl-w)} rule further down
       this file (id vs id+class — a bare extra class here would lose to
       a plain id selector, id specificity always sorts first). */
    .traits-flyout-cats-row #traitsFlyoutCats{ flex:1 1 auto; min-width:0; width:auto; border-bottom:none; }
    /* A real dropdown — floats below the category strip instead of
       sitting inline in #traitsFlyout's own column flow (which used to
       push #traitRows/#clearTraitsBtn/the actual results further down
       the page every time a category was opened). Own background/
       border/shadow since it's no longer visually part of the
       (transparent, borderless) strip above it — same panel treatment
       #sortFlyout/#traitsFlyout's own MOBILE popup already uses (see the
       unscoped .traits-flyout base rule), just anchored under the strip
       instead of centered over the whole page. */
    #traitsFlyout > .traits-flyout-vals{
      position:absolute;
      top:100%;
      left:0;
      margin-top:0.5rem;
      z-index:70;
      width:min(360px, 100%);
      max-height:360px;
      overflow-y:auto;
      padding:0.75rem;
      background:var(--panel-bg-solid);
      border:1px solid var(--border-mid);
      border-radius:var(--radius);
      box-shadow:0 10px 30px rgba(0,0,0,0.6);
    }
    .hscroll-arrow{
      flex:0 0 auto;
      display:flex;
      align-items:center;
      justify-content:center;
      width:2em;
      height:2em;
      background:rgba(15,16,20,0.75);
      border:1px solid var(--border-mid);
      border-radius:50%;
      color:var(--white);
      font-size:14px;
      cursor:pointer;
      transition:border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
    }
    .hscroll-arrow:hover{ border-color:var(--cyan-dim); background:rgba(20,21,26,0.9); transform:scale(1.06); }
    .hscroll-arrow:active{ transform:scale(0.96); }
  }
  /* Hidden on desktop — only shown (see the max-width:700px block below)
     once a category's been tapped on mobile, to get back to the category
     list. F!LTER BY TRA!TS only (see traitsFlyoutBack) — S0RT BY has no
     categories to drill from any more, see .flyout-flat above. Always in
     the markup so it doesn't need building/tearing down on resize. */
  .flyout-back-btn{
    display:none;
    width:100%;
    text-align:left;
    background:transparent;
    border:none;
    border-bottom:1px solid var(--border-dim);
    color:var(--cyan);
    font-family:var(--font-mono);
    font-size:13px;
    letter-spacing:0.06em;
    padding:0.9em 1em;
    cursor:pointer;
    text-transform:uppercase;
  }
  .flyout-back-btn:hover{ background:var(--cyan-faint); }
  /* ---- S0RT BY / F!LTER BY TRA!TS — real clickable buttons that pop
     their options up centered on the page, with a dimmed backdrop behind
     them, at every screen width (not just mobile's old drilled-value
     step — see .flyout-popup below, added by openSortFlyout/
     openTraitsFlyout to whichever of #sortFlyout/#traitsFlyout is
     opening). !important throughout: beats both the old desktop
     always-visible-strip rules above (now disabled, kept only for
     reference) and the plain .traits-flyout/.flyout-flat base rules
     without having to edit either. ---- */
  .flyout-popup-backdrop{
    display:none;
    position:fixed; inset:0;
    background:rgba(4,4,6,0.72);
    z-index:1900;
  }
  .flyout-popup-backdrop.open{ display:block; }
  /* S0RT BY / F!LTER BY TRA!TS — a real fixed bar pinned to the bottom of
     the viewport (display toggled in showTab(), matching #screenBrowse's
     own DATABASE/PλWS-only visibility), so both stay reachable regardless
     of scroll position while the rest of the page scrolls normally
     underneath — no position:sticky/shadow trickery, just genuinely
     always there. z-index sits above ordinary page content but below the
     popup + its backdrop (1900/1950 above), so opening either still
     covers this bar the same way it covers everything else. */
  .bottom-controls-bar{
    position:fixed;
    left:0; right:0; bottom:0;
    z-index:500;
    display:flex;
    border-top:1px solid var(--border-mid);
    background:rgba(9,9,7,0.96);
    backdrop-filter:blur(6px);
  }
  .bottom-controls-btn{
    flex:1 1 0;
    min-width:0;
    background:transparent;
    border:none;
    border-left:1px solid var(--border-dim);
    color:var(--cyan);
    font-family:var(--font-mono);
    font-weight:700;
    font-size:14px;
    letter-spacing:0.06em;
    text-transform:uppercase;
    padding:1em 0.5em;
    cursor:pointer;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .bottom-controls-btn:first-child{ border-left:none; }
  .bottom-controls-btn:hover, .bottom-controls-btn.open{ background:var(--cyan-faint); text-shadow:0 0 5px var(--cyan-glow); }
  /* Own bottom padding on the page's actual scrollable content so the
     last row of result cards never sits underneath this fixed bar with
     no way to see it — #screenBrowse is the shared DATABASE/PλWS grid
     container this bar is always paired with (see showTab, which toggles
     body.has-bottom-bar in lockstep with the bar's own visibility). */
  body.has-bottom-bar #screenBrowse{ padding-bottom:4rem; }
  .traits-flyout.flyout-popup{
    display:block !important;
    position:fixed !important;
    top:50% !important;
    left:50% !important;
    transform:translate(-50%, -50%) !important;
    width:min(380px, 92vw) !important;
    max-width:none !important;
    max-height:75vh !important;
    overflow-y:auto;
    margin:0 !important;
    z-index:1950;
    background:var(--panel-bg-solid);
    border:1px solid var(--cyan-dim);
    box-shadow:0 20px 50px rgba(0,0,0,0.7);
  }
  .traits-flyout.flyout-popup .traits-flyout-cats-row{ flex-direction:column !important; }
  .traits-flyout.flyout-popup .traits-flyout-cats{ display:flex !important; flex-direction:column !important; overflow-x:visible !important; border-right:none !important; border-bottom:none !important; width:100% !important; }
  .traits-flyout.flyout-popup .traits-flyout-cats .traits-flyout-cat{ width:100% !important; text-align:center !important; white-space:normal !important; flex:0 0 auto; }
  .traits-flyout.flyout-popup .traits-flyout-vals{
    position:static !important;
    display:block !important;
    width:100% !important;
    max-height:none !important;
    padding:0.6rem !important;
  }
  .traits-flyout.flyout-popup .traits-flyout-vals .traits-flyout-val{ width:100% !important; white-space:normal !important; margin-bottom:0.4rem; }
  .traits-flyout.flyout-popup .hscroll-arrow{ display:none !important; }
  /* F!LTER BY TRA!TS' own two-step drill (categories, then one category's
     values) still happens inside this same centered popup — categories
     first, .flyout-drilled swaps to the values + a BACK button once one's
     picked. :not(.flyout-flat) excludes S0RT BY (#sortFlyout), which has
     no categories/back-button of its own and should just always show its
     one flat value list — same distinction the old mobile-only rules
     already drew. */
  .traits-flyout.flyout-popup .flyout-back-btn{ display:none; }
  .traits-flyout.flyout-popup:not(.flyout-flat):not(.flyout-drilled) .traits-flyout-vals{ display:none !important; }
  .traits-flyout.flyout-popup.flyout-drilled .traits-flyout-cats-row{ display:none !important; }
  .traits-flyout.flyout-popup.flyout-drilled .flyout-back-btn{ display:block !important; }
  /* A visible X reads clearer than "tap the dimmed backdrop" on desktop,
     where there's no established "tap outside a sheet to close it"
     convention the way there is on mobile — the backdrop still closes it
     too (see its own click handler), this is just the obvious affordance. */
  .flyout-popup-close-btn{
    display:none;
    position:absolute; top:0.5rem; right:0.6rem;
    background:none; border:none; color:var(--grey);
    font-size:20px; line-height:1; cursor:pointer; padding:0.35em;
  }
  .traits-flyout.flyout-popup .flyout-popup-close-btn{ display:block; }
  .flyout-popup-close-btn:hover{ color:var(--cyan); }
  @media (max-width:700px){
    /* S0RT BY's flat list, and F!LTER BY TRA!TS' own category list, both
       list down inline below their trigger now instead of floating as an
       overlay popup on top of the page — a plain accordion instead of a
       box fighting for room on a phone screen. #sortDropWrap/
       #traitsHoverWrap switch from their fixed 190px pill to full width
       and column layout so the label sits above the expanded list rather
       than squeezed beside it; the existing shared border on those two
       wraps (see their base rule) naturally grows to frame the open list
       too, reading as one control. F!LTER BY TRA!TS' VALUES step is the
       one exception — see #traitsFlyout.flyout-drilled below, which pops
       up as a real centered overlay instead, since a full value list
       (with photo previews on many entries) is too long to want sitting
       inline in the page flow. */
    #sortDropWrap, #traitsHoverWrap{ display:flex; flex-direction:column; width:100%; }
    #sortFlyout, #traitsFlyout{ position:static; width:100%; max-height:none; box-shadow:none; margin-top:0.4rem; }
    /* flex-direction:column, not the desktop base rule's row — categories
       stay a vertical list here (this IS the "list down" accordion), not
       the horizontal strip desktop gets. The base rule's display:flex/
       row would otherwise leak through unchanged at this width too,
       since nothing here previously reset it back (confirmed live). */
    /* !important on display/flex-direction — .traits-flyout-cats' own
       desktop base rule (elsewhere in this file, equal specificity)
       is declared LATER in the file than this media query block, so
       without !important it silently wins here regardless of viewport
       (confirmed live — same shape of bug as #traitsFlyoutCats
       .traits-flyout-cat's own !important above). */
    .traits-flyout-cats{ display:flex !important; flex-direction:column !important; overflow-x:visible; width:100%; border-right:none; border-bottom:none; }
    /* #traitsFlyoutCats .traits-flyout-cat's own width:var(--ctrl-w) (a
       fixed 190px, elsewhere in this file) left a gap of empty space to
       the right of every category in this vertical list at mobile
       widths — full width instead, same as every other mobile list item
       on this page. .traits-flyout-cat's own base rule also switched to
       width:auto/nowrap for desktop's horizontal chips; back to a plain
       block row here. */
    /* !important on width/text-align — #traitsFlyoutCats .traits-flyout-
       cat's OTHER, unrelated rule (its ADD TRAITS colour override,
       elsewhere in this file — same id+class, so equal specificity) sets
       width:var(--ctrl-w)/text-align:center and is declared later in the
       file than this block, so without !important it would silently win
       here regardless of this media query (confirmed live — this exact
       shape of bug already bit the SORT BY row above, see its own
       !important). */
    /* Same boxed-pill treatment SORT BY's own mobile list already gets
       for free from .traits-flyout-val's base rule (border, radius,
       margin-bottom) — this list used the much plainer .traits-flyout-cat
       class instead (a flat divider-line row, no border/radius/margin at
       all), which read as off/uncentered sitting right next to SORT BY's
       own boxed list in the same accordion. */
    #traitsFlyoutCats .traits-flyout-cat{ width:100% !important; text-align:center !important; flex:0 0 auto; white-space:normal; border:1px solid var(--border-dim); border-radius:var(--radius); margin-bottom:0.4rem; }
    #traitsFlyoutCats .traits-flyout-cat:last-child{ margin-bottom:0; }
    .traits-flyout-vals{ position:static; width:100%; padding:0.6rem 0.9rem; }
    /* :not(.flyout-flat) — S0RT BY (see the class above) has no category
       list of its own, so its single flat list must stay visible by
       default here instead of starting hidden like F!LTER BY TRA!TS' vals
       pane does before a category's been tapped. */
    .traits-flyout:not(.flyout-flat):not(.flyout-drilled) .traits-flyout-vals{ display:none; }
    /* !important — needed to beat .traits-flyout-cats' own !important a
       few lines up (that one exists to beat the desktop base rule, see
       its comment; !important vs !important, higher specificity wins,
       and this selector has three classes to that rule's one). */
    .traits-flyout.flyout-drilled .traits-flyout-cats{ display:none !important; }
    .traits-flyout.flyout-drilled .flyout-back-btn{ display:block; }
    /* The actual "pops up" — not anchored to the trigger's own position
       at all (unlike the inline category list above, which is a normal
       document-flow child), so no JS positioning is needed here: fixed +
       centered is the whole story. */
    #traitsFlyout.flyout-drilled{
      position:fixed;
      top:50%;
      left:50%;
      transform:translate(-50%, -50%);
      width:min(340px, 90vw);
      max-height:70vh;
      overflow-y:auto;
      box-shadow:0 10px 30px rgba(0,0,0,0.6);
      z-index:1000;
      margin-top:0;
    }
    /* Desktop-only scroll arrows (see the new desktop block below) —
       mobile keeps the existing click-to-open dropdowns, no scrolling
       strip to flank here. */
    .hscroll-arrow{ display:none; }
  }
  .traits-flyout-cats{
    display:flex;
    flex-direction:row;
    flex-wrap:nowrap;
    overflow-x:auto;
    scroll-behavior:smooth;
    width:100%;
    border-right:none;
    border-bottom:1px solid var(--border-dim);
  }
  /* Sits below the horizontal category row above now, not to its right —
     categories used to be a vertical column (hovering one positioned this
     pane absolutely, level with wherever the mouse was, via
     positionFlyoutVals()); now they're a horizontal strip, so there's no
     "vertical position of the hovered category" left to align to. Plain
     static flow underneath instead. positionFlyoutVals() is still called
     (harmless — it just sets an unused inline top on an element that
     ignores top while position:static). */
  .traits-flyout-vals{
    position:static;
    width:100%;
    max-height:320px;
    overflow-y:auto;
    padding:0.6rem;
    box-sizing:border-box;
  }
  /* ---- ONE consistent colour language across SORT BY + FILTER BY
     TRAITS (previously three different, partly self-contradicting
     schemes stacked on the same shared classes — plain grey text here,
     forced cyan there, a header comment claiming "filled pink when
     selected" that the actual .selected rule directly contradicted two
     lines below it): white text at rest (readable against the new
     cyan-glow panel backgrounds, unlike the old cyan-on-cyan idle text),
     magenta/pink is the one "this is chosen" signal everywhere — a
     category, a sort option, a trait value — and cyan stays reserved for
     the passive hover border glow every other box on the page already
     uses, never as body text. ---- */
  /* 15px, matching F!LTER BY TRA!TS/S0RT BY's own label pill (see
     .traits-hover-wrap .trait-row-label) — these options were 13px,
     smaller than the label sitting right next to them, which put more
     visual weight on the row's caption than on the actual clickable
     content. Letter-spacing eased off too: tight tracking on all-caps
     mono reads dense at speed even before size is the problem. */
  .traits-flyout-cat{
    display:block;
    width:auto;
    flex:0 0 auto;
    white-space:nowrap;
    text-align:left;
    background:transparent;
    border:none;
    border-right:1px solid var(--border-dim);
    color:var(--white);
    font-family:var(--font-mono);
    font-size:15px;
    letter-spacing:0.03em;
    padding:0.9em 1.1em;
    cursor:pointer;
    text-transform:uppercase;
    transition:background 0.15s ease, color 0.15s ease;
  }
  .traits-flyout-cat:hover{ background:var(--cyan-faint); color:var(--white); }
  .traits-flyout-cat.active{ background:var(--magenta-faint); color:var(--magenta); text-shadow:0 0 5px var(--magenta-glow); }
  .traits-flyout-val{
    position:relative;
    display:flex;
    align-items:center;
    justify-content:space-between;
    width:100%;
    gap:0.5rem;
    background:transparent;
    border:1px solid var(--border-dim);
    color:var(--white);
    font-family:var(--font-mono);
    font-size:15px;
    letter-spacing:0.02em;
    padding:0.8em 1em;
    margin-bottom:0.4rem;
    cursor:pointer;
    text-align:left;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  .traits-flyout-val:hover{ border-color:var(--cyan-dim); color:var(--white); }
  .traits-flyout-val.selected{ background:var(--magenta-faint); border-color:var(--magenta); color:var(--magenta); text-shadow:0 0 5px var(--magenta-glow); }
  .traits-flyout-val .tfv-count{ color:var(--grey-dim); font-size:13px; flex:0 0 auto; }
  /* Not-yet-built sort options — same disabled/"C0M!NG S00N" treatment as
     FUZZY/PHN!X in the C0LLECT!0N SELECT!0N list (.db-option-disabled/
     .db-soon), just on a .traits-flyout-val instead of a .db-option. */
  .traits-flyout-val.tfv-disabled{ cursor:not-allowed; opacity:0.6; }
  .traits-flyout-val.tfv-disabled:hover{ border-color:var(--border-dim); color:var(--grey); }

  /* ADD TRA!TS' own categories/values now just inherit the shared white/
     magenta scheme above — no separate cyan-idle override any more (see
     this block's own history if that's ever needed again). */
  #traitsFlyoutVals .th-empty{ font-size:16px; color:var(--white); }
  #traitsFlyoutCats .traits-flyout-cat{ box-shadow:inset 0 0 0 1px transparent; }
  #traitsFlyoutCats .traits-flyout-cat:hover{ box-shadow:inset 0 0 0 1px var(--cyan-dim); }
  #traitsFlyoutVals .traits-flyout-val{ font-size:16px; }
  #traitsFlyoutVals .tfv-count{ font-size:15px; }
  /* A real Pigeon preview as the button's own background (see
     renderTraitsFlyoutVals — the dark gradient is baked into the same
     inline background-image so it always covers the actual photo
     underneath). Own color/border rules so the plain :hover/.selected
     rules above — which use the background shorthand and would erase
     the inline image — never apply to these. */
  #traitsFlyoutVals .traits-flyout-val.has-preview{
    background-size:cover;
    /* Pigeon portraits are head/beak-heavy near the top of the frame —
       centering the crop cut off too much of it; biasing toward the top
       keeps the beak in view. */
    background-position:center 20%;
    color:#fff;
    text-shadow:0 1px 3px rgba(0,0,0,0.9);
  }
  #traitsFlyoutVals .traits-flyout-val.has-preview .tfv-count{ color:#fff; font-size:16px; }
  /* Static solid box behind the value + count together — the crop
     underneath is often busy/light enough that text-shadow alone still
     clashed and was hard to read at a glance. */
  #traitsFlyoutVals .traits-flyout-val.has-preview .tfv-text{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.5rem;
    width:100%;
    background:rgba(8,9,11,0.68);
    border-radius:calc(var(--radius) - 2px);
    padding:0.4rem 0.6rem;
  }
  #traitsFlyoutVals .traits-flyout-val.has-preview:hover{ border-color:var(--cyan); color:#fff; }
  /* ADD TRA!TS category buttons match the ADD TRA!TS button's own width
     instead of stretching to fill a 42%-of-620px column — scoped by id
     so SORT's flyout (shares the same .traits-flyout-cats/-cat classes)
     keeps its own wider, left-aligned list untouched. */
  #traitsFlyoutCats{ flex:0 0 var(--ctrl-w); }
  #traitsFlyoutCats .traits-flyout-cat{ width:var(--ctrl-w); text-align:center; }
  /* Desktop only: the value list becomes a wrapped grid of small chips
     instead of the mobile-style full-width stacked rows above — those
     were still every value's own width:100% (a leftover from before the
     panel went horizontal), which stretched has-preview's real Pigeon
     photo across the entire, now much wider, row: a small source
     thumbnail smeared into a thin wide band, reading as blurry. A
     roughly chip-sized box lets the same photo actually read as a photo.
     Declared after the shared base rules above (not inside the earlier
     desktop media block with the row/column layout fix) so normal
     cascade order — not !important — is enough to win over them. */
  @media (min-width:701px){
    /* Category chips match S0RT BY's own strip (.flyout-flat .traits-
       flyout-val) — rounded, gapped pills, not the divider-line list this
       shares with mobile's vertical accordion by default. */
    #traitsFlyoutCats{
      /* The actual flex-basis override now lives on .traits-flyout-cats-
         row .traits-flyout-cats (higher specificity, beats #traitsFlyoutCats's
         own unscoped flex:0 0 var(--ctrl-w) further down this file) — this
         rule just covers the rest of the chip-row styling. */
      align-items:center;
      gap:0.35em;
      /* PREV/NEXT (.hscroll-arrow) already cover scrolling when there
         really isn't room for every category — the native scrollbar
         underneath the strip was just visual clutter on top of that,
         same reasoning S0RT BY's own flat strip already uses. */
      scrollbar-width:none;
      -ms-overflow-style:none;
    }
    #traitsFlyoutCats::-webkit-scrollbar{ display:none; }
    /* width:auto + smaller text, not the unscoped rule's fixed
       width:var(--ctrl-w) (~190px, sized for the old narrow sidebar
       list) — every category chip only as wide as its own label now, so
       as many as possible fit in view before PREV/NEXT are ever needed. */
    #traitsFlyoutCats .traits-flyout-cat{
      /* flex:1 1 0, not the base class's flex:0 0 auto — every chip
         grows equally to fill the full width of the bar (matching how
         wide S0RT BY's own strip reads, just distributed across fewer,
         bigger buttons here) instead of packing left with empty space
         trailing after the last one. min-width:0 lets that shrink work
         at all — same flex-item gotcha as everywhere else in this file
         (flex items default to min-width:auto, which refuses to shrink
         below content size otherwise). */
      flex:1 1 0;
      min-width:0;
      width:auto;
      border:1px solid var(--border-dim);
      border-radius:var(--radius);
      text-align:center;
      /* Same 15px S0RT BY's own strip uses (.traits-flyout-val's base
         font-size, never overridden there) — this id+class override was
         still hardcoding the old 13px after the base class was bumped,
         so F!LTER BY TRA!TS' own chips silently stayed smaller than
         S0RT BY's right next to them. */
      font-size:15px;
      padding:0.6em 0.9em;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    /* A plain vertical list — one trait value per row, not the grid of
       chips this used to be. */
    #traitsFlyoutVals{
      display:flex;
      flex-direction:column;
      gap:0.4rem;
      max-height:none;
      padding:0.3rem 0 0;
      width:100%;
    }
    /* No placeholder text any more (openTraitsFlyout/the initial HTML
       both just leave this empty until a category's actually clicked) —
       collapse the box itself too, so there's no empty padded gap
       sitting under the category row before that click happens. */
    #traitsFlyoutVals:empty{ display:none; padding:0; }
    #traitsFlyoutVals .traits-flyout-val{ width:100%; margin-bottom:0; }
    #traitsFlyoutVals .traits-flyout-val.has-preview{
      /* A full list-row height, not the old grid-tile's 120px square —
         at this width (up to 700px, see #traitsFlyoutVals' own parent)
         a tall box would stretch the photo into a very wide, short crop.
         Still tall enough to read as a real photo, just proportioned
         for a row instead of a tile. */
      height:64px;
      /* Base .traits-flyout-val's own padding is content-box by default —
         without this, the fixed height above would just add on top of it,
         missing the point of pinning a consistent, non-stretched box for
         the photo. */
      box-sizing:border-box;
    }
  }
  #traitsFlyoutVals .traits-flyout-val.has-preview.selected{
    border-color:var(--magenta);
    box-shadow:inset 0 0 0 2px var(--magenta);
    color:#fff;
    text-shadow:0 0 6px var(--magenta-glow), 0 1px 3px rgba(0,0,0,0.9);
  }
  /* Same corner checkmark badge a selected Pigeon thumbnail gets
     (.card-select-toggle.selected) — same size, same magenta fill, same
     position — so a selected photo-backed trait reads identically. */
  .tfv-select-badge{
    position:absolute;
    top:0.3rem;
    right:0.3rem;
    z-index:2;
    width:1.6em;
    height:1.6em;
    line-height:1.6em;
    background:var(--magenta);
    color:#08090b;
    border:1px solid var(--magenta);
    font-size:13px;
    text-align:center;
    border-radius:var(--radius);
    animation:flicker-in 0.3s ease-out;
  }
  select.trait-cat-select{
    background:#000;
    border:1px solid var(--border-mid);
    color:var(--white);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.55em 0.7em;
    text-transform:uppercase;
    cursor:pointer;
    border-radius:var(--radius);
  }
  select.trait-cat-select option{ background:var(--panel-bg-solid); color:var(--white); }
  .trait-value-chips{
    display:flex;
    flex-direction:column;
    gap:0.35rem;
    width:100%;
    margin-top:0.5rem;
    max-height:220px;
    overflow-y:auto;
    padding:0.5rem;
    border:1px dashed var(--border-dim);
  }
  .trait-chip{
    display:flex;
    align-items:center;
    justify-content:space-between;
    width:100%;
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.05em;
    padding:0.55em 0.8em;
    cursor:pointer;
    text-align:left;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .trait-chip:hover{ border-color:var(--cyan-dim); color:var(--white); }
  .trait-chip.selected{ background:var(--cyan-faint); color:var(--cyan); border-color:var(--cyan); text-shadow:0 0 5px var(--cyan-glow); }
  /* Same box treatment as F!LTER BY TRA!TS (#traitsHoverWrap) — width
     (var(--ctrl-w)), border, radius, padding all matched, so an applied
     filter reads as the same kind of control instead of a smaller,
     differently-styled one-off tag. Text is green — a selected/active
     filter, not just another neutral option. */
  .trait-row-tag{
    width:var(--ctrl-w);
    box-sizing:border-box;
    /* Override .trait-row's flex-wrap:wrap — with it on, the label and
       the remove button wrap onto separate lines the moment they don't
       both fit unshrunk, making this box roughly double the height of
       F!LTER BY TRA!TS instead of matching it. nowrap forces them onto
       one line so the label's own ellipsis (not a line wrap) absorbs
       the overflow. */
    flex-wrap:nowrap;
    justify-content:space-between;
    background:transparent;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    /* Same 13px font-size #traitsHoverWrap's own label uses — its em
       padding is computed against that 13px, not this box's inherited
       16px body size, so without matching it here the two boxes' padding
       (and therefore height) don't actually come out equal despite using
       the same em values. */
    font-size:13px;
    padding:0.9em 1.3em;
    transition:border-color 0.15s ease;
  }
  .trait-row-tag:hover{ border-color:var(--green); }
  .trait-tag-label{
    color:var(--green);
    font-family:var(--font-mono);
    font-size:13px;
    letter-spacing:0.04em;
    text-shadow:0 0 5px var(--green-glow);
    /* A long CATEGORY :: VALUE combo shouldn't blow out the fixed box
       width — clip with an ellipsis instead. */
    min-width:0;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
  }
  .trait-row-remove{
    background:transparent;
    border:1px solid var(--magenta-dim);
    color:var(--magenta);
    font-family:var(--font-mono);
    font-size:12px;
    width:2em;
    height:2em;
    cursor:pointer;
    border-radius:var(--radius);
    transition:background 0.15s ease;
  }
  .trait-row-remove:hover{ background:var(--magenta-faint); }
  /* Inside an applied tag (.trait-row-tag — traits AND stacked sort
     criteria alike), the default 2em/24px button is taller than the
     label's own line box, which was stretching the tag noticeably past
     F!LTER BY TRA!TS'/S0RT BY's own trigger-box height despite matching
     padding/font-size everywhere else. Sized to the label's actual line
     height instead so the two match. */
  .trait-row-tag .trait-row-remove{ width:19px; height:19px; }
  /* Same box dimensions/text size as ADD TRAITS (#traitsHoverWrap) — and
     always pinned to the right edge of the row (margin-left:auto), even
     once trait chips (#traitRows, which now sits before it in the DOM)
     have pushed it further along the line — never drifts back to sitting
     in the middle between ADD TRAITS and the chips. */
  .clear-traits-btn{
    background:transparent;
    border:1px solid var(--red-dim);
    color:var(--red);
    text-shadow:0 0 5px var(--red-dim);
    font-family:var(--font-mono);
    font-size:15px;
    font-weight:700;
    letter-spacing:0.1em;
    padding:0.75em 1em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:background 0.15s ease;
    margin-left:auto;
  }
  .clear-traits-btn:hover{ background:var(--red-faint); }

  /* One single bar: SEARCH + GO + VIEW on the left, the results status
     text taking up the middle, SORT BY + RESET on the right — all one
     row, bordered as one unit, instead of stacked/separate pieces. */
  /* RESET on its own, between the COLLECTION/ADD TRAITS box above and
     the results status line below. */
  .results-reset-row{ text-align:center; margin-bottom:0.85rem; }
  /* One line: SEARCH (left), SORT BY (dead centre — a 3-column grid so
     it's truly centred regardless of how wide SEARCH/VIEW end up, not
     just flex-centred in whatever space happens to be left over), VIEW
     (right). */
  .results-header-row{
    display:grid;
    /* minmax(0, 1fr), not bare 1fr — a bare 1fr track still sizes to fit
       non-shrinking content (e.g. .search-row's flex-wrap:nowrap below),
       which was blowing this row wider than the viewport on mobile and
       dragging the VIEW field (justify-self:end) off the right edge,
       forcing the whole page to scroll horizontally. minmax(0, ...)
       caps the track at the container width no matter what's inside. */
    grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);
    align-items:center;
    gap:0.9rem 1.25rem;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    padding:0.85em 1em;
    margin-bottom:0.85rem;
  }
  .results-header-row .search-row{ margin-bottom:0; justify-self:start; flex-wrap:nowrap; }
  .results-header-row .sort-field-inline{ justify-self:center; }
  .results-header-row .sort-field:last-child{ justify-self:end; }
  @media (max-width:700px){
    .results-header-row{ grid-template-columns:minmax(0,1fr); justify-items:center; }
    .results-header-row .search-row{ justify-self:center; flex-wrap:wrap; }
    .results-header-row .sort-field:last-child{ justify-self:center; }
  }
  /* ---- results status line — its own line, directly above the pigeons
     list. ---- */
  .status-line-standalone-row{ text-align:center; margin-bottom:0.85rem; }
  .status-line{
    display:inline-block;
    text-align:center;
    font-family:var(--font-body);
    font-size:11px;
    letter-spacing:0.08em;
    color:var(--grey-dim);
    text-transform:uppercase;
  }
  .status-line .hi{ color:var(--cyan); text-shadow:0 0 5px var(--cyan-glow); }
  /* Bigger, more prominent than the plain RESULTS :: N line — this is the
     headline of the search, not a status footnote. */
  .results-trait-note{
    font-size:16px;
    font-weight:700;
    letter-spacing:0.04em;
    color:var(--white);
  }
  .results-trait-note .hi{ font-size:20px; }

  /* ---- empty state (attention = magenta) ---- */
  /* Fills the results area (see #resultsArea's own min-height) instead of
     just sitting as a couple of small lines at the top of a lot of empty
     space — a zero-result query should be unmistakable, not something
     you have to notice. */
  .empty-state{ text-align:center; min-height:60vh; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:2rem 1rem; }
  .empty-state .es-title{
    font-size:22px;
    letter-spacing:0.12em;
    color:var(--magenta);
    text-shadow:0 0 8px var(--magenta-glow);
    margin-bottom:1rem;
    text-transform:uppercase;
  }
  .empty-state .es-line{
    font-family:var(--font-body);
    font-size:15px;
    letter-spacing:0.03em;
    color:var(--grey);
    margin-bottom:0.5rem;
    text-transform:none;
  }

  /* ---- pigeon image box ---- */
  .pigeon-img-box{
    aspect-ratio:1;
    position:relative;
    cursor:pointer;
    display:flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    background:repeating-linear-gradient(45deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 6px, transparent 6px, transparent 12px);
    border:1px dashed var(--border-dim);
    font-size:10px;
    letter-spacing:0.1em;
    color:var(--grey-disabled);
  }
  .pigeon-img-box img{ width:100%; height:100%; object-fit:cover; display:block; transition:transform 0.25s ease; }
  /* Hidden for now, not removed — the multi-select/TARGET BAR feature
     this "+" belongs to is coming back later; CSS-only so the JS
     wiring (card-select-toggle click handler, state.target, etc.) stays
     intact and this is a one-line revert when that's ready. */
  .card-select-toggle{ display:none; }
  .card-select-toggle, .my-pigeon-offer-toggle{
    position:absolute;
    top:0.3rem;
    right:0.3rem;
    z-index:2;
    width:1.6em;
    height:1.6em;
    line-height:1.6em;
    padding:0;
    background:rgba(8,9,11,0.8);
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-size:13px;
    cursor:pointer;
    text-align:center;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .card-select-toggle:hover, .my-pigeon-offer-toggle:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  .card-select-toggle.selected, .my-pigeon-offer-toggle.selected{ background:var(--magenta); color:#08090b; border-color:var(--magenta); animation:flicker-in 0.3s ease-out; }
  .my-pigeon-offer-toggle.at-cap{ opacity:0.35; cursor:not-allowed; }
  /* Listing price — moved here (bottom-right corner of the picture
     itself) off the purple action box below, which used to carry this
     text and grow/shrink depending on whether a Pigeon was listed. Same
     dark semi-transparent badge treatment as .card-select-toggle's own
     top-right corner, just sized for a price string instead of a single
     glyph. Green border/glow for a real listing — reported live as the
     price "not showing clearly" / a listed card "not feeling enticing to
     buy"; green ties this number to BUY N0W's own colour language (same
     green, same glow) instead of the old neutral purple, so the price
     reads as "you can buy this right now" at a glance, not just
     reference info. Cyan stays for YOUR OWN listing (this site's
     established "this is yours" colour, same as FL0CK/SH0W MY P!GE0NS
     elsewhere) — the border colour alone is what used to be a separate
     "Y0UR L!ST!NG ::" label. */
  .thumb-listing-badge{
    position:absolute;
    bottom:0.3rem;
    right:0.3rem;
    z-index:2;
    max-width:calc(100% - 0.6rem);
    background:rgba(8,9,11,0.9);
    border:1px solid var(--green);
    color:#fff;
    font-weight:700;
    font-size:16px;
    letter-spacing:0.02em;
    padding:0.4em 0.6em;
    border-radius:var(--radius);
    text-shadow:0 0 6px var(--green-glow);
    box-shadow:0 0 10px var(--green-glow);
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .thumb-listing-badge-own{ border-color:var(--cyan); text-shadow:0 0 4px var(--cyan-glow); box-shadow:0 0 10px var(--cyan-glow); }
  /* OWNED sticker — top-left corner (the price badge, when there's a
     real listing, already owns the bottom-right), shown on a Pigeon you
     hold but haven't listed, while browsing the general collection. Was
     a plain "!N Y0UR FL0CK" text label filling the whole action box
     below instead — replaced by this small marker on the picture itself
     plus a real L!ST button in that box now (see pigeonsActionBoxHtml).*/
  .thumb-owned-badge{
    position:absolute;
    top:0.3rem;
    left:0.3rem;
    z-index:2;
    background:rgba(8,9,11,0.85);
    border:1px solid var(--cyan);
    color:var(--cyan);
    text-shadow:0 0 4px var(--cyan-glow);
    font-weight:700;
    font-size:12px;
    letter-spacing:0.06em;
    padding:0.3em 0.5em;
    border-radius:var(--radius);
    text-transform:uppercase;
  }

  /* ---- DATABASE results: two wide rows side by side, not a 6-up grid
     of tiles — a much bigger thumbnail/number/rarity on the left, every
     other detail (both marketplaces' listings, highest/average sale)
     laid out on the right where there's actually room for it. ---- */
  .result-list{
    display:grid;
    grid-template-columns:repeat(2, 1fr);
    gap:0.9rem;
  }
  /* THUMBNAILS view — 5 across, reuses the compact .result-card tile
     (image + number + rarity only) instead of the wide detail row. */
  .result-list.view-thumbnails{
    grid-template-columns:repeat(5, 1fr);
    gap:0.7rem;
  }
  .result-row{
    display:flex;
    align-items:stretch;
    gap:1.2rem;
    padding:1rem;
  }
  .result-row-left{
    flex:0 0 auto;
    width:280px;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:0.5rem;
  }
  .result-row-left .pigeon-img-box{ width:100%; }
  .result-row-left .result-num{ border-bottom:none; padding:0; font-size:20px; }
  /* Full-width strip below the thumbnail — the AMOUNT field is always
     visible and typeable, no click-to-reveal step. Same strip in both
     the boxed and THUMBNAILS card layouts. */
  /* Pink as the box's own resting colour, cyan reserved for the actual
     click/selection feedback on the button(s) inside (BUY N0W/0FFER
     already use var(--green), aliased to cyan) — not the collection's own
     purple/--collection-accent, which stays scoped to the trustline
     banner up top specifically. */
  /* Plain neutral container, not a coloured call-to-action of its own —
     it just holds whichever real buttons the card needs (BUY N0W green,
     0FFER green, CANCEL red), and painting the whole box hot pink
     regardless of what's inside it drowned those out and read as "too
     much pink" everywhere a card had any action at all. */
  .thumb-offer{
    width:100%;
    margin-top:0.5rem;
    background:var(--panel-bg-solid);
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    /* Tight — the button(s) inside should read as filling this box, not
       floating in the middle of it with visible purple margin down each
       side. */
    padding:0.5em 0.35em;
    /* One row of content now — button(s), or the !N Y0UR FL0CK label —
       never the price/countdown stack this used to also carry (moved to
       .thumb-listing-badge on the picture itself). Every purple box is
       now naturally the exact same height with no min-height needed to
       cover a taller state. */
    box-sizing:border-box;
    display:flex;
    align-items:center;
    justify-content:center;
  }
  /* BUY N0W — solid filled green, not just an outline: this is the one
     truly one-click "spend real money right now" action on the card, so
     it should read as the obvious thing to press, not blend in at the
     same visual weight as 0FFER (a slower, non-committal path). Full
     width, sitting above the offer row within the same box. Only
     rendered when the Pigeon actually carries a real Σκύλλα listing. */
  .thumb-buy-btn{
    width:100%;
    background:var(--green);
    border:1px solid var(--green);
    color:#000;
    font-family:var(--font-mono);
    font-weight:700;
    letter-spacing:0.03em;
    padding:0.7em 0.8em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    margin-bottom:0.5rem;
    box-shadow:0 0 14px var(--green-glow);
    transition:background 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:0.1rem;
    line-height:1.15;
  }
  .thumb-buy-btn:hover{ background:#000; color:var(--green); box-shadow:0 0 20px var(--green-glow); transform:translateY(-1px); }
  /* The real price, right on the button — reported live as BUY N0W not
     feeling "enticing" with the price only ever a small corner badge on
     the picture, easy to miss entirely at the actual moment of deciding
     to buy. Bigger and bolder than the "BUY N0W" label above it, same
     "the number is the point" treatment SALES H!ST0RY's own price gets. */
  .thumb-buy-label{ font-size:13px; letter-spacing:0.08em; opacity:0.85; }
  .thumb-buy-price{ font-family:var(--font-display); font-size:19px; font-weight:800; letter-spacing:0.01em; }
  /* 0FFER — solid green now (reported live as wanting it "fully green"),
     same fill BUY N0W already uses, just without that button's own
     glow/pulse: BUY N0W is the real, immediate action here (a live
     listing, one click to buy); 0FFER is a slower secondary path (submit
     a price, wait for the owner), so it stays a plain flat fill rather
     than competing for the same urgent attention. */
  .offer-open-modal-btn{
    width:100%;
    background:var(--green);
    border:1px solid var(--green);
    color:#000;
    font-family:var(--font-mono);
    font-weight:700;
    font-size:17px;
    letter-spacing:0.03em;
    padding:1em 0.8em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:background 0.15s ease, color 0.15s ease;
  }
  .offer-open-modal-btn:hover{ background:#000; color:var(--green); }
  /* L!ST — same box size as a lone 0FFER button (17px, full width),
     not the smaller shared .list-open-modal-btn default (15px, used
     when it's paired with TRANSFER in the scoped MY PIGEONS view) —
     this one stands alone in the box, replacing the old "!N Y0UR
     FL0CK" text label. Cyan, matching this site's "this is yours"
     colour language (see thumb-owned-badge on the thumbnail itself). */
  .thumb-list-btn{
    width:100%;
    background:transparent;
    border:1px solid var(--cyan);
    color:var(--cyan);
    font-family:var(--font-mono);
    font-weight:700;
    font-size:17px;
    letter-spacing:0.03em;
    padding:1em 0.8em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:background 0.15s ease, color 0.15s ease;
  }
  .thumb-list-btn:hover{ background:var(--cyan); color:#000; }
  /* A Pigeon that's YOUR OWN active Σκύλλα listing, seen while browsing
     the general/unscoped collection (e.g. sorted by FL00R $P!GE0NS
     alongside everyone else's listings) — no BUY N0W (can't buy your
     own) and no MAKE 0FFER (offering to yourself doesn't mean anything),
     just a plain readout so the box isn't blank. */
  .thumb-offer-own{ text-align:center; }
  /* Same box size/shape as a lone 0FFER button (border, padding, 17px) —
     was plain unboxed 13px text, so a card that's already yours looked
     like a different, smaller kind of thing than every other card's
     action box instead of just a neutral readout in the same spot. */
  .own-listing-note{
    display:block;
    width:100%;
    box-sizing:border-box;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    padding:1em 0.8em;
    color:#fff;
    font-family:var(--font-mono);
    font-weight:700;
    font-size:17px;
    letter-spacing:0.03em;
    text-transform:uppercase;
  }
  /* Real XRPL NFTokenCreateOffer Expiration countdown (see
     listingCountdownText) — fine print under the price, not competing
     with it, same fine-print grey used for the issuer address/trustline
     status elsewhere. */
  .listing-countdown{ color:var(--grey-dim); font-size:10px; letter-spacing:0.08em; text-transform:uppercase; margin-top:0.15rem; }
  .thumb-offer-row{ display:flex; flex-wrap:wrap; gap:0.4rem; width:100%; }
  /* NFT 0FFERED T0 Y0U (FL0CK) — purple like every other real TRANSFER
     surface on this site, since it IS the recipient half of that same
     feature. A plain horizontal row, not a full grid card — this list is
     almost always 0-1 items long. */
  #incomingTransfersBox{ margin-bottom:1.25rem; }
  .incoming-transfer-row{
    display:flex;
    align-items:center;
    gap:0.75rem;
    padding:0.65em 0.9em;
    border:1px solid var(--pigeon-purple);
    border-radius:var(--radius);
    background:linear-gradient(160deg, rgba(61,243,236,0.14), var(--panel-bg-solid) 60%);
    margin-bottom:0.6rem;
  }
  .incoming-transfer-thumb{ width:52px; height:52px; border-radius:6px; object-fit:cover; flex:0 0 auto; background:rgba(255,255,255,0.06); }
  .incoming-transfer-info{ flex:1 1 auto; min-width:0; }
  .incoming-transfer-num{ font-family:var(--font-display); font-weight:700; font-size:15px; color:#fff; }
  .incoming-transfer-from{ font-size:11px; color:var(--grey-dim); letter-spacing:0.05em; margin-top:0.2rem; text-transform:uppercase; }
  .incoming-transfer-accept-btn{ flex:0 0 auto; background:var(--pigeon-purple); border-color:var(--pigeon-purple); color:#fff; text-shadow:none; }
  .incoming-transfer-accept-btn:hover{ background:var(--magenta); border-color:var(--magenta); }
  /* L!ST duration — same collection-purple active state as .edition-btn,
     just a compact 4-across row sized for the amount-entry popup rather
     than .edition-btn's own fixed var(--ctrl-w) (built for the full-page
     3-button toggle, too wide to fit four of these here). */
  .list-duration-row{ display:flex; gap:0.4rem; width:100%; margin:0.5rem 0; }
  .list-duration-btn{
    flex:1 1 0;
    min-width:0;
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:12px;
    font-weight:700;
    letter-spacing:0.05em;
    padding:0.6em 0.3em;
    text-transform:uppercase;
    cursor:pointer;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
  }
  .list-duration-btn:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  .list-duration-btn.active{ background:var(--pigeon-purple-faint); border-color:var(--pigeon-purple); color:var(--pigeon-purple); text-shadow:0 0 5px var(--pigeon-purple-glow); }
  /* Bigger than the other four — a bare ∞ glyph at the same 12px as
     "30 DAYS" reads as an afterthought/typo next to real words, not a
     deliberate FOREVER option. */
  .list-duration-forever{ font-size:26px; padding:0.3em 0.3em; }
  /* $PIGEONS coin sits inside the input itself (not just the placeholder)
     so it stays put once you start typing a number, instead of
     disappearing along with the placeholder text. */
  .make-offer-input-wrap{ position:relative; flex:1 1 auto; min-width:0; display:flex; align-items:center; }
  .make-offer-input-coin{
    position:absolute;
    left:0.6em;
    top:50%;
    transform:translateY(-50%);
    width:38px;
    height:38px;
    border-radius:50%;
    object-fit:cover;
    border:1px solid rgba(255,255,255,0.6);
    pointer-events:none;
    transition:left 0.12s ease;
  }
  /* Small × clear button on every text input you can type a number
     into (search, offer amount, list price, the two XRP calculator
     inputs) — shown only once there's actually something to clear via
     :placeholder-shown (a live CSS state, not JS-managed), so this
     works automatically for every current and future input matching
     the pattern without extra wiring. Must sit as the input's own next
     sibling in markup for the selector below to match; the click itself
     is handled by one delegated document-level listener (see
     el.body/document click handler further down), not per-instance. */
  .input-clear-btn{
    flex:0 0 auto;
    background:transparent;
    border:none;
    color:var(--grey-dim);
    font-family:var(--font-mono);
    font-size:18px;
    line-height:1;
    padding:0 0.3em;
    cursor:pointer;
    transition:color 0.15s ease;
  }
  .input-clear-btn:hover{ color:var(--magenta); }
  input:placeholder-shown + .input-clear-btn{ display:none; }
  /* Lighter default color for inputs sitting on the trustline banner's
     purple gradient, where the plain grey-dim default would be nearly
     invisible. */
  .input-clear-btn-light{ color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); }
  .input-clear-btn-light:hover{ color:#fff; }
  /* A quick coin-flip bump every time the typed number changes (see
     repositionOfferCoin), so the coin reads as "attached" to the number,
     not just a static icon — the point being to make this feel like
     real currency moving, not a plain text field. */
  @keyframes offerCoinPulse{
    0%{ transform:translateY(-50%) scale(1) rotate(0deg); }
    45%{ transform:translateY(-50%) scale(1.4) rotate(10deg); }
    100%{ transform:translateY(-50%) scale(1) rotate(0deg); }
  }
  .make-offer-input-coin.pulse{ animation:offerCoinPulse 0.32s ease; }
  /* Green flash on the field itself each time the number changes —
     "juicy," not just a static grey box. */
  @keyframes offerValuePulse{
    0%{ box-shadow:0 0 0 rgba(52,255,133,0); border-color:rgba(255,255,255,0.6); }
    35%{ box-shadow:0 0 16px 2px var(--green-glow); border-color:var(--green); }
    100%{ box-shadow:0 0 0 rgba(52,255,133,0); border-color:rgba(255,255,255,0.6); }
  }
  .make-offer-input.pulse, .list-price-input.pulse{ animation:offerValuePulse 0.4s ease; }
  /* Bigger, clearer numbers — was a fairly small 20px field for the one
     number you're actually there to type, reported live as wanting it
     "way bigger... clear numbers... slick and clean." A brighter resting
     border (not just on the .pulse flash) gives it some presence even
     before you've typed anything. */
  /* Green, not white — this is a real number (a price, an offer amount),
     same "important numbers are green" language as greenNum()/
     .pigeons-green-num everywhere else on the site, not just plain text. */
  /* Left/right padding matched (both 3.3em) — was 0.75em/3.3em, so
     text-align:center centered the typed number inside a CONTENT area
     that itself sat well right of the box's true visual middle, thanks
     to the coin icon's own left-side padding having no matching padding
     on the right. Reported live as wanting the number "centred more" —
     this is what actually fixes that, not the text-align itself (which
     was already correct for whatever content area it had). */
  .make-offer-input, .list-price-input{
    width:100%;
    background:rgba(8,9,11,0.6);
    border:1px solid rgba(255,255,255,0.75);
    color:var(--green);
    font-family:var(--font-mono);
    font-size:28px;
    font-weight:700;
    text-align:center;
    padding:0.6em 3.3em;
    border-radius:var(--radius);
    box-shadow:0 0 12px rgba(255,255,255,0.08);
    transition:border-color 0.15s ease, box-shadow 0.15s ease;
  }
  .make-offer-input:focus, .list-price-input:focus{ outline:none; border-color:#fff; box-shadow:0 0 16px rgba(255,255,255,0.18); }
  .make-offer-input::placeholder, .list-price-input::placeholder{ color:rgba(255,255,255,0.5); }
  /* Bigger again above the mobile breakpoint specifically — desktop has
     the room, reported live as wanting "everything in list... bigger on
     desktop, the numbers etc." Kept at the mobile-safe 28px below 700px
     rather than risking the same overflow class of bug already fixed
     elsewhere in this file for other controls. */
  @media (min-width:701px){
    .make-offer-input, .list-price-input{ font-size:36px; padding:0.6em 3.6em; }
    .make-offer-input-coin{ width:46px; height:46px; }
    .make-offer-send, .list-inline-btn{ font-size:17px; padding:0.85em 0.85em; }
    .list-duration-btn{ font-size:14px; padding:0.75em 0.4em; }
    .list-duration-forever{ font-size:32px; }
  }
  .make-offer-send, .list-inline-btn{
    flex:1 1 auto;
    background:rgba(0,0,0,0.18);
    border:1px solid rgba(255,255,255,0.6);
    color:#fff;
    font-family:var(--font-mono);
    font-weight:700;
    font-size:15px;
    letter-spacing:0.04em;
    padding:0.75em 0.75em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, background 0.15s ease;
  }
  .make-offer-send:hover, .list-inline-btn:hover{ border-color:#fff; background:rgba(0,0,0,0.3); }
  /* L!ST specifically (by id, not the shared .list-inline-btn class —
     that class is also reused for TRANSFER's own submit, which stays
     the plain neutral treatment) — solid filled green instead of a
     plain dark outline: this is the one real "put your Pigeon up for
     real money" action here, so it should read as the obvious,
     enticing thing to press, same "juicy" filled-CTA language BUY N0W
     already uses elsewhere on the site instead of blending in. */
  #amountEntryListBtn{
    background:var(--green);
    border-color:var(--green);
    color:#000;
    box-shadow:0 0 14px var(--green-glow);
  }
  #amountEntryListBtn:hover{ background:#000; color:var(--green); border-color:var(--green); box-shadow:0 0 20px var(--green-glow); }
  /* Offers received, embedded directly on the pigeon's own card (see
     myPigeonOffersHtml) — sits above the LIST/DELIST action box. */
  .my-pigeon-offers{ display:flex; flex-direction:column; gap:0.4rem; margin-top:0.5rem; }
  /* The single highest offer, big and unmissable — was a stacked list of
     every offer in small text; reported live as wanting "HIGHEST OFFER /
     ____ $PIGEONS / ACCEPT DECLINE COUNTER... clean buttons... simple
     but big and easy to see." */
  .highest-offer-box{
    border:1px solid var(--magenta);
    border-radius:var(--radius);
    background:var(--panel-bg-solid);
    padding:0.9rem 0.8rem;
    text-align:center;
  }
  .highest-offer-label{ font-size:11px; letter-spacing:0.14em; color:var(--grey); text-transform:uppercase; }
  .highest-offer-price{ font-family:var(--font-display); font-size:26px; font-weight:700; color:var(--green); margin:0.25rem 0; }
  .highest-offer-buyer{ font-size:12px; letter-spacing:0.04em; color:var(--grey-dim); text-transform:uppercase; margin-bottom:0.7rem; }
  .highest-offer-actions{ display:flex; gap:0.4rem; }
  .highest-offer-btn{
    flex:1 1 0;
    min-width:0;
    font-family:var(--font-mono);
    font-size:14px;
    font-weight:700;
    letter-spacing:0.03em;
    padding:0.8em 0.4em;
    border-radius:var(--radius);
    cursor:pointer;
    text-transform:uppercase;
    background:transparent;
    transition:background 0.15s ease, color 0.15s ease;
  }
  .highest-offer-accept{ background:var(--green); border:1px solid var(--green); color:#000; }
  .highest-offer-accept:hover{ background:#000; color:var(--green); }
  .highest-offer-decline{ border:1px solid var(--red); color:var(--red); }
  .highest-offer-decline:hover{ background:var(--red); color:#000; }
  .highest-offer-counter{ border:1px solid var(--border-dim); color:var(--grey-dim); opacity:0.5; cursor:not-allowed; }
  /* 0FFERS RECE!VED (renderMyOffersList) — one horizontal row per listed
     Pigeon with a real offer: thumbnail, number/buyer, price, then the
     same ACCEPT/DECL!NE/C0UNTER trio the card's own highest-offer box
     uses, just laid out in a row instead of stacked.
     Grid, not flex — reported live as wanting the price/number truly
     centred in the middle of the row (not just sitting between whatever
     widths the thumbnail block and the buttons happened to take up) and
     ACCEPT/DECL!NE/C0UNTER sitting horizontal on the right, not stacked.
     Left and right columns both 1fr — equal width either side keeps the
     middle (price) column visually centred on the row regardless of how
     wide the thumbnail+info block or the button row actually are. */
  .my-offer-row{
    display:grid;
    grid-template-columns:1fr auto 1fr;
    align-items:center;
    gap:1.25rem;
    padding:1.4rem 1rem;
    border-bottom:1px solid var(--border-dim);
  }
  .my-offer-row:last-child{ border-bottom:none; }
  /* Groups the thumbnail+number/buyer block into the row's own left grid
     column (see .my-offer-row's own comment on why left/right need to
     both be 1fr for the price column to actually land centred). */
  .my-offer-row-left{ display:flex; align-items:center; gap:1.25rem; min-width:0; }
  /* Reported live as wanting to "clearly see all the information" —
     every piece of this row (thumbnail, number, buyer, price, buttons)
     scaled up from the original compact version. */
  .my-offer-row-img{ width:96px; height:96px; flex:0 0 auto; border-radius:var(--radius); overflow:hidden; }
  .my-offer-row-img img{ width:100%; height:100%; object-fit:cover; }
  .my-offer-row-info{ flex:1 1 auto; min-width:0; }
  .my-offer-row-num{ font-size:28px; font-weight:700; color:var(--white); }
  /* Reported live as wanting OFFERS RECE!VED/0UTG0!NG 0FFERS text white
     and bigger — this was grey-dim (hard to read, same complaint already
     fixed elsewhere on the site), now full white and a size up. */
  .my-offer-row-buyer{ font-size:18px; letter-spacing:0.03em; color:var(--white); text-transform:uppercase; margin-top:0.3rem; }
  .my-offer-row-price{ font-family:var(--font-display); font-size:38px; font-weight:700; color:var(--green); text-align:center; white-space:nowrap; }
  .my-offer-row-actions{ display:flex; flex-direction:row; gap:0.5rem; justify-self:end; }
  .my-offer-row-actions .highest-offer-btn{ flex:0 0 auto; padding:0.85em 1.2em; font-size:16px; }
  @media (max-width:700px){
    .my-offer-row{ grid-template-columns:1fr; row-gap:0.75rem; padding:1.2rem 0.6rem; }
    .my-offer-row-img{ width:72px; height:72px; }
    .my-offer-row-num{ font-size:20px; }
    .my-offer-row-price{ text-align:left; font-size:26px; }
    .my-offer-row-actions{ justify-self:start; width:100%; }
    .my-offer-row-actions .highest-offer-btn{ flex:1 1 0; }
  }
  .outgoing-offers-title{ margin-top:1.5rem; padding-top:1.5rem; border-top:1px dashed var(--border-dim); }
  /* CANCEL — same red treatment DELIST already uses for a listing (see
     .delist-pigeon-btn:hover) rather than the row's own accept/decline
     colours, since this is the one destructive action here. */
  .my-offer-row-actions .cancel-my-offer-btn{ border:1px solid var(--red); color:var(--red); background:transparent; }
  .my-offer-row-actions .cancel-my-offer-btn:hover{ background:var(--red); color:#000; }
  .result-row-right{
    flex:1;
    min-width:0;
    display:flex;
    flex-direction:column;
    justify-content:flex-start;
    gap:0.5rem;
  }
  .result-row-right .card-listings{ margin-top:0; }
  /* Full-width bars stacked below the thumbnail/traits row — RARITY,
     sale stats, the SALES HISTORY link, and (when unlisted) NO LISTINGS
     all share this same horizontal-bar layout instead of being squeezed
     as stacked lines into the narrow right column. */
  .card-bottom-bar{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:1.5rem;
    flex-wrap:wrap;
    border-top:1px dashed var(--border-dim);
    padding:0.55em 1rem;
  }
  /* RARITY / RARITY SCORE, visible above the traits carousel without a
     NEXT click — same horizontal-bar look as .card-bottom-bar, just
     sitting above the content instead of below it. */
  .card-rarity-summary{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:1.5rem;
    flex-wrap:wrap;
    border-bottom:1px dashed var(--border-dim);
    padding:0.55em 1rem;
  }
  /* Flick-through pages — TRAITS, then sale stats, then the sales
     history itself — one visible at a time instead of every section
     stacked as its own bar. */
  .card-pages{ margin-top:0.5rem; }
  .card-page-sales{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:1.5rem;
    flex-wrap:wrap;
    min-height:80px;
  }
  /* Sales history renders right in this page (not a link to another
     screen) — scrolls internally so a long history doesn't blow out the
     card's height. */
  .card-page-history{ min-height:80px; max-height:220px; overflow-y:auto; }
  .card-page-next{
    display:block;
    width:100%;
    margin-top:0.5rem;
    background:transparent;
    border:1px dashed var(--border-dim);
    border-radius:var(--radius);
    color:var(--cyan-dim);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:0.12em;
    text-transform:uppercase;
    cursor:pointer;
    text-align:center;
    padding:0.4em 0.6em;
  }
  .card-page-next:hover{ color:var(--cyan); border-color:var(--cyan-dim); }
  @media (max-width:1100px){
    .result-list{ grid-template-columns:1fr; }
    .result-list.view-thumbnails{ grid-template-columns:repeat(3, 1fr); }
  }
  @media (max-width:700px){
    .result-row{ flex-direction:column; align-items:center; text-align:center; }
    .result-row-left{ width:100%; max-width:200px; }
    .result-list.view-thumbnails{ grid-template-columns:repeat(2, 1fr); gap:0.5rem; }
    /* CANCEL/L!ST + TRANSFER side by side get tight in a narrow 2-across
       mobile card at the full 15px size — same shrink other card
       controls already get at this breakpoint. */
    .owned-action-row .bar-btn{ font-size:11px; padding:0.7em 0.4em; }
    /* Smaller than the desktop 13px default (see that rule's own comment),
       not bigger — confirmed live on an actual 2-across mobile card:
       "BUY N0W" sharing a row with 0FFER truncated to "BUY …" at 13px,
       read as broken/cut off rather than just small. 11px/tighter
       padding is what actually fits both labels on one line without
       ellipsis kicking in. Most cards only show 0FFER alone (BUY N0W
       only renders on a real listing), where this fills the full box
       width via flex:1 1 0 either way, so this only really matters for
       the two-button state. */
    .owned-action-row .thumb-buy-btn,
    .owned-action-row .offer-open-modal-btn{ font-size:11px; letter-spacing:0.01em; padding:0.7em 0.3em; }
  }

  /* ---- old grid-tile card, still used by MY PIGEONS (myPigeonCardHtml) ---- */
  .result-grid{
    display:grid;
    grid-template-columns:repeat(5, 1fr);
    gap:0.7rem;
  }
  .result-card{
    position:relative;
    border:1px solid var(--border-dim);
    background:rgba(255,255,255,0.012);
    border-radius:var(--radius);
    overflow:hidden;
    transition:border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    /* Grid items already stretch to the tallest card in their row
       (.result-grid's own display:grid default) — flex column here (+
       .result-card-body/.card-action-box below) is what actually uses
       that extra height, instead of just leaving blank space under a
       shorter card's content while its neighbor's buttons sit lower. */
    display:flex;
    flex-direction:column;
  }
  /* Hard offset duplicate instead of a soft blurred glow — a print/
     sticker-style shadow, not a neon halo, matching the rest of the
     brutalist pass. Cyan (hover role), not magenta — magenta is reserved
     for a genuinely selected/active card (.in-target, right below), and
     using it here too made everything look selected/pink all the time. */
  .result-card:hover{ border-color:var(--cyan); box-shadow:4px 4px 0 var(--cyan); transform:translate(-2px,-2px); }
  .result-card:hover .pigeon-img-box img{ transform:scale(1.04); }
  .result-card:hover .result-num{ color:var(--cyan); text-shadow:none; }
  .result-card .pigeon-img-box{ border:none; }
  .result-card.in-target{ border-color:var(--magenta); box-shadow:0 0 0 1px var(--magenta-dim) inset, 0 0 14px rgba(255,63,208,0.22); }
  .result-card.in-target .result-num{ color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); }
  .result-card-body{ padding:0.6rem 0.45rem; flex:1 1 auto; display:flex; flex-direction:column; }
  /* Wraps whatever pigeonsActionBoxHtml/ownedPigeonActionHtml actually
     returned (BUY N0W+0FFER, just 0FFER, Y0UR L!ST!NG+CANCEL, !N Y0UR
     FL0CK, L!ST+TRANSFER, offers-received+L!STED+CANCEL+TRANSFER — every
     card in a row can be a different one of these) — margin-top:auto
     pins it flush to the bottom of the card every time, so every
     button/tag in a row lands on the same line regardless of how much
     (or how little) sits above it. */
  .card-action-box{ margin-top:auto; }
  .result-num{
    /* Bumped up from the old 15px (matched to button text) — direct
       instruction: text on the Pigeon cards themselves reads too small,
       make all of it bigger. */
    font-size:18px;
    font-weight:700;
    letter-spacing:0.03em;
    color:var(--white);
    text-align:center;
    padding:0.55rem 0.35rem;
    border-bottom:1px solid var(--border-dim);
    transition:color 0.15s ease;
  }
  .result-rarity-line{ font-size:17px; letter-spacing:0.03em; color:var(--white); text-align:center; }
  /* AVG SALE PR!CE / COND!T!ON label above its own value, not side by
     side on one line — same stacked shape as .stat-label/.stat-value
     elsewhere on the page, just sized down to fit a thumbnail card. */
  .result-stat-stack{ display:flex; flex-direction:column; align-items:center; gap:0.1rem; }
  .result-stat-stack .stat-label{ font-size:11px; margin-bottom:0; color:var(--white); }
  .result-stat-stack .stat-value{ font-size:16px; color:var(--white); }
  .card-listings{ display:flex; gap:0.4rem; margin-top:0.45rem; }
  /* Neither marketplace has a real listing — one shared full-width bar
     naming both markets, instead of two separate washed-out boxes. */
  .card-no-listings .css-item{ color:var(--cyan-dim); }
  .card-no-listings .css-label{ color:var(--grey-dim); }
  /* Real marketplace listing on the bottom bar — a clickable buy link,
     styled to stand out like the other bottom-bar css-items but green
     to signal "this one's live and buyable". */
  a.css-item.css-item-link{
    color:var(--green);
    text-shadow:0 0 6px var(--green-glow);
    text-decoration:none;
    cursor:pointer;
  }
  a.css-item.css-item-link:hover{ text-decoration:underline; }
  .cl-block{
    display:block;
    flex:1;
    min-width:0;
    border:1px solid var(--border-dim);
    padding:0.45rem 0.3rem;
    text-align:center;
    text-decoration:none;
  }
  .cl-market{ font-size:9px; letter-spacing:0.08em; color:var(--grey-dim); text-transform:uppercase; margin-bottom:0.35rem; }
  .cl-price{ font-size:12px; font-weight:700; letter-spacing:0.02em; color:var(--green); text-shadow:0 0 6px var(--green-glow); }
  .cl-price.cl-none{ color:var(--grey-disabled); font-size:10px; font-weight:400; text-shadow:none; text-transform:uppercase; }
  /* The whole box IS the buy action when a real listing exists — filled
     green, not just a border, so it reads as clickable at a glance. */
  .cl-block-buy{
    cursor:pointer;
    background:var(--green-glow);
    border-color:var(--green);
    transition:background 0.15s ease, box-shadow 0.15s ease;
  }
  .cl-block-buy:hover{ background:rgba(52,255,133,0.28); box-shadow:0 0 14px var(--green-glow); }
  .cl-block-buy .cl-price{ color:var(--bg); text-shadow:none; }
  .cl-block-buy .cl-market{ color:rgba(8,9,11,0.65); }
  .css-item{ font-size:13px; letter-spacing:0.02em; color:var(--white); text-align:center; font-weight:600; }
  .css-label{ display:inline-block; min-width:110px; color:var(--grey-dim); text-transform:uppercase; letter-spacing:0.05em; margin-right:0.4em; font-size:10px; font-weight:400; }

  /* ---- Universal $PIGEONS statement bar — a big bold purple bar with
     the collection coin icon, for any "here's the real $PIGEONS number"
     moment (currently: the LIST confirmation summary). One shared class
     instead of a bespoke style per screen. ---- */
  .pigeons-bar{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:0.75rem;
    padding:0.7em 1.25rem;
    border:1px solid var(--magenta);
    border-radius:var(--radius);
    background:linear-gradient(90deg, rgba(255,51,204,0.85), rgba(180,30,150,0.85));
    box-shadow:0 0 16px var(--magenta-glow);
  }
  .pigeons-bar-coin{ width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid rgba(255,255,255,0.6); flex:0 0 auto; }
  .pigeons-bar-text{ font-size:16px; font-weight:700; letter-spacing:0.02em; color:#fff; text-shadow:0 1px 4px rgba(0,0,0,0.5); text-align:center; text-transform:uppercase; }
  @media (max-width:500px){
    .pigeons-bar-text{ font-size:13px; }
  }
  /* Trustline banner (.pigeons-merged-panel) — sitting above the
     DATABASE/MY PIGEONS/etc tabs: the identity row (thumb + SET
     TRUSTLINE/address/COPY), then a bottom row (VIEW ON DEXSCREENER /
     rate / calculator). The stats carousel that used to merge into the
     top of this same box now lives on its own, DATABASE-only, right
     above SEARCH!NG $P!GE0NS DATABASE (see #collectionDetailsPanel). */
  .pigeons-merged-panel{
    border:1px solid var(--pigeon-purple);
    border-radius:var(--radius);
    box-shadow:0 0 16px var(--pigeon-purple-glow);
    margin-bottom:1.25rem;
    overflow:hidden;
  }
  /* FL0CK used to show a slimmed-down version of this banner (carousel/
     SH0W MY P!GE0NS/BUY $P!GE0NS/calculator all dropped) — now shows the
     exact same full banner as DATABASE, no .paws-view overrides left. */
  /* This page only ever shows your own Pigeons — no searching for anyone
     else's from here (see updateSearchPanelTitleForPaws). The search box
     (# 0R WALLET) is DATABASE-only functionality once scoped this way —
     EXCEPT while picking 0FFER F0R (.picking-theirs, see
     enterTheirsPickMode), which is exactly the one moment a real search
     across the whole collection is the point. */
  body.paws-view:not(.picking-theirs) .results-header-row .search-row{
    display:none !important;
  }
  .pigeons-bar-issuer{
    position:relative;
    border:none;
    border-radius:0;
    box-shadow:none;
    margin-bottom:0;
    /* The collection's own real colour (--collection-accent), sampled
       from its coin artwork — not the site's universal cyan/magenta,
       and swaps per collection (see that variable's own comment). */
    background:linear-gradient(90deg, rgba(var(--collection-accent-rgb),0.85), rgba(var(--collection-accent-2-rgb),0.85));
    flex-direction:column;
    align-items:center;
  }
  /* Thumb + SET TRUSTLINE/address/COPY, centered as one group — big,
     clear thumbnail right next to the address block, not pinned to a
     far edge. */
  /* Nudged left of dead-center — the bottom row's rate line isn't quite
     centered either (VIEW ON DEXSCREENER is narrower than the calculator
     beside it, pulling the rate line's true center left), so this lines
     up with it instead of the panel's literal midpoint. */
  /* The banner's real content row — LEFT (login/identity, compact) |
     BALANCE (the main feature, centered and biggest) | EXCHANGE RATE
     calculator (right). Rate line + DEXSCREENER link now live up in the
     carousel instead (see the RATE page there), which is what frees this
     row up to make BALANCE the thing people actually look at. */
  /* A 3-column grid with equal-width flanking tracks (1fr / auto / 1fr),
     not flex — two flex attempts at "center BALANCE in this row" were
     both tried and both looked off (see .pigeons-bar-balance's own
     comment below for the raw-midpoint attempt; flex:1-fills-leftover-
     space was the fix after that, and is what's replaced here): with
     unequal-width left/right columns (SH0W MY NFTs+S!GN 0UT vs just
     EXCHANGE CALCULAT0R), pinning BALANCE to the row's raw midpoint left
     it looking shoved toward the narrower side, and centering it in
     "whatever space is left over" after those two columns left it
     shoved toward the WIDER side instead — same bug, opposite direction,
     because neither actually guarantees equal real estate on both
     flanks. A grid with two same-size 1fr tracks does: whatever's in
     column 1 is justify-self:start against a track exactly as wide as
     column 3's justify-self:end, so the auto-sized centre column is
     genuinely centred on the row regardless of how uneven the left/right
     content actually is. */
  .pigeons-bar-main-row{ display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:1.25rem; width:100%; }
  .pigeons-bar-left{ grid-column:1; justify-self:start; display:flex; flex-direction:column; align-items:flex-start; gap:0.6rem; min-width:0; }
  /* Way bigger — this is the collection's own artwork, the one thing
     that actually says which collection you're looking at, so it needs
     to read clearly at a glance, not as a small decorative icon. */
  .pigeons-bar-thumb{
    flex:0 0 auto;
    width:120px;
    height:120px;
    border-radius:var(--radius);
    border:1px solid rgba(255,255,255,0.5);
    background-image:linear-gradient(160deg, rgba(var(--collection-accent-rgb),0.35), rgba(var(--collection-accent-2-rgb),0.45)), url("/api/ipfs-image?src=https%3A%2F%2Fipfs.io%2Fipfs%2FQmRbNvemLYjHuRZcpYRRSq5vqqozzjoy3aDR6eSzSoTFUs");
    background-size:cover;
    background-position:center;
  }
  .pigeons-bar-left-body{ display:flex; flex-direction:column; align-items:flex-start; gap:0.35rem; text-align:left; }
  /* Logged-out row: the two text lines stacked on the left, COPY sitting
     to their right, vertically centred against both lines together. */
  .pigeons-bar-left-body-row{ flex-direction:row; align-items:center; gap:0.9rem; }
  .pigeons-bar-left-lines{ display:flex; flex-direction:column; gap:0.2rem; align-items:flex-start; }
  /* Small help box under the issuer line — the onboarding section itself
     doesn't exist yet (same "real link, not-yet-built destination"
     pattern as BURNT), so this stays simple and low-key rather than
     competing with SET TRUSTLINE/BALANCE for attention. */
  .pigeons-bar-help-box{
    display:inline-flex;
    align-items:center;
    gap:0.4rem;
    background:rgba(0,0,0,0.15);
    border:1px dashed rgba(255,255,255,0.35);
    border-radius:var(--radius);
    padding:0.3em 0.6em;
    color:rgba(255,255,255,0.7);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.01em;
    text-transform:none;
    cursor:pointer;
    text-align:left;
    transition:color 0.15s ease, border-color 0.15s ease;
  }
  .pigeons-bar-help-box:hover{ color:#fff; border-color:rgba(255,255,255,0.7); }
  .pigeons-bar-help-mark{
    flex:0 0 auto;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:1.3em;
    height:1.3em;
    border-radius:50%;
    border:1px solid currentColor;
    font-size:10px;
    font-weight:700;
  }
  .pigeons-bar-sublabel{ font-size:12px; letter-spacing:0.15em; color:rgba(255,255,255,0.8); text-transform:uppercase; }
  .pigeons-bar-issuer .bar-btn{ border-color:rgba(255,255,255,0.6); color:#fff; background:rgba(0,0,0,0.18); }
  .pigeons-bar-issuer .bar-btn:hover{ border-color:#fff; background:rgba(0,0,0,0.3); color:#fff; }
  .pigeons-bar-issuer .pigeons-bar-text{ font-size:14px; text-align:left; }
  /* SET TRUSTLINE TO TRADE — the real headline of the logged-out left
     column, so it (and its COPY button) get bumped noticeably bigger
     than the plain .pigeons-bar-text default. */
  .pigeons-bar-issuer .pigeons-bar-text-lg{ font-size:18px; }
  /* Small inline COPY button sitting right next to SET TRUSTLINE TO
     TRADE — the actual issuer address is now just plain reference text
     underneath (.pigeons-bar-sublabel), not the click target itself. */
  /* Plain outline, no glow — a small COPY button sitting right on the
     trustline banner doesn't need its own text-shadow bloom, and it's
     the kind of ambient pink glow the brutalist pass was supposed to be
     quiet about. */
  .pigeons-bar-copy-btn{
    display:inline-block;
    background:transparent;
    border:1px solid rgba(255,255,255,0.6);
    border-radius:var(--radius);
    padding:0.15em 0.6em;
    margin-left:0.3rem;
    color:#fff;
    font-family:var(--font-mono);
    font-size:13px;
    letter-spacing:0.05em;
    text-transform:uppercase;
    cursor:pointer;
    vertical-align:middle;
  }
  .pigeons-bar-copy-btn:hover{ background:rgba(255,255,255,0.15); }
  /* SIGN OUT — a real, destructive-feeling action (ends the session), so
     it gets the real --red token instead of the plain white every other
     bar-btn in this box uses (was pointing at magenta, not actually red,
     despite the comment always saying red). */
  #swapSignOutBtn{ color:var(--red); border-color:var(--red); }
  #swapSignOutBtn:hover{ background:var(--red); color:#000; }
  /* LOGIN — green (the real, positive action here) instead of plain
     white like every other .bar-btn in this box. */
  #pigeonsLoginBtn{ color:var(--green); border-color:var(--green); text-shadow:0 0 6px var(--green-glow); }
  #pigeonsLoginBtn:hover{ background:var(--green); color:#000; text-shadow:none; }
  /* BALANCE — the main feature of the whole banner, thumbnail beside it
     as the other half. Biggest, boldest, dead centre: either a real
     $PIGEONS number to be proud of, or a BUY link in the exact same spot
     if it's empty — either way, the token itself is what this banner is
     actually about. */
  /* grid-column:2 of .pigeons-bar-main-row's own 1fr/auto/1fr track set
     (see that rule's comment) — genuinely centred regardless of how wide
     the left/calc columns are, unlike either of the two things tried
     before this (raw row midpoint, then flex:1-fills-leftover-space). */
  .pigeons-bar-balance{
    grid-column:2;
    min-width:220px;
    display:flex;
    flex-direction:row;
    align-items:center;
    justify-content:center;
    gap:1rem;
  }
  /* Centered, not left-aligned — BUY $P!GE0NS is narrower than the
     balance number above it, and flex-start left both edges flush
     instead of the button actually sitting centered underneath it. */
  .pigeons-bar-balance-info{ display:flex; flex-direction:column; align-items:center; gap:0.3rem; text-align:center; }
  .pigeons-bar-balance-label{ font-size:13px; letter-spacing:0.25em; color:rgba(255,255,255,0.8); text-transform:uppercase; }
  .pigeons-bar-balance-value{ font-size:28px; font-weight:700; color:#fff; text-shadow:0 1px 4px rgba(0,0,0,0.5); text-transform:uppercase; letter-spacing:0.02em; }
  /* Bigger, filled (not just outlined) and gently pulsing at rest — this
     is the site's actual real-money call-to-action, worth standing out
     rather than blending in with every other plain outline .bar-btn. */
  /* Was a soft ambient glow, breathing on a loop forever — the brutalist
     pass is deliberately quiet at rest and only reacts when actually
     touched (see the identity pitch's own "no ambient loop" note), so
     this button now sits flat until hovered instead of glowing at you
     the whole time you're on the page. */
  .pigeons-bar-balance-buy{
    display:inline-block;
    margin-top:0.4rem;
    padding:0.85em 1.8em;
    border:1px solid var(--green);
    border-radius:var(--radius);
    background:var(--green-faint, rgba(52,255,133,0.12));
    color:var(--green);
    text-shadow:none;
    font-family:var(--font-mono);
    font-size:17px;
    font-weight:700;
    letter-spacing:0.05em;
    text-decoration:none;
    transition:background 0.15s ease, color 0.15s ease;
    /* Now a <button> (used to be an <a> straight out to DexScreener) —
       opens the in-site swap panel instead. Reset button-only defaults so
       it renders identically to the old link. */
    appearance:none;
    cursor:pointer;
  }
  /* Simple fill-on-hover, no offset shadow/transform — the harder
     brutalist hover (translate + hard drop shadow) read as messy on a
     small button rather than deliberate, so this stays plain: same
     recipe as .thumb-buy-btn's own hover. */
  .pigeons-bar-balance-buy:hover{ background:var(--green); color:#000; text-shadow:none; }
  /* XRP <-> $PIGEONS calculator — title, DEXSCREENER link, and the live
     price all sit on one line above the calculator itself; the calculator
     row underneath is deliberately bare — two type-in boxes and a swap
     arrow between them, no unit labels or "=" sign cluttering it up. */
  .pigeons-bar-calc-col{ grid-column:3; justify-self:end; display:flex; flex-direction:column; align-items:center; gap:0.4rem; min-width:0; }
  /* Collapsed to a single button by default — used to be the calculator
     itself sitting permanently open in the banner, eating space next to
     BALANCE even for anyone who never touches it. Click opens the popover
     below; the label doubles as a live summary once something's typed
     (see updateCalcToggleLabel), so the button alone answers "what's the
     rate right now" without opening anything. */
  .pigeons-calc-toggle-btn{
    display:inline-flex;
    align-items:center;
    gap:0.4rem;
    background:rgba(0,0,0,0.18);
    border:1px solid rgba(255,255,255,0.6);
    border-radius:var(--radius);
    padding:0.55em 1em;
    color:#fff;
    font-family:var(--font-mono);
    font-size:13px;
    font-weight:700;
    letter-spacing:0.08em;
    text-transform:uppercase;
    white-space:nowrap;
    cursor:pointer;
    appearance:none;
    transition:border-color 0.15s ease, background 0.15s ease;
  }
  .pigeons-calc-toggle-btn:hover, .pigeons-calc-toggle-btn.open{ border-color:#fff; background:rgba(0,0,0,0.3); }
  .pigeons-calc-toggle-arrow{ font-size:11px; opacity:0.8; }
  /* A real centered popup now, same purple/exciting overlay treatment as
     0FFER/BUY $P!GE0NS's own confirm modals (#offerConfirmModal etc. —
     see that shared selector group's own comment) instead of a small
     dropdown anchored under the toggle button. */
  #pigeonsCalcModal{ display:none; position:fixed; inset:0; z-index:1000; background:rgba(5,5,6,0.88); align-items:center; justify-content:center; padding:2rem 1rem; }
  .pigeons-calc-panel{
    width:min(440px, 100%);
    text-align:center;
    background:var(--panel-bg-solid);
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    box-shadow:0 10px 30px rgba(0,0,0,0.6);
    padding:1.75rem 1.5rem;
    animation:offer-confirm-pop 0.2s ease;
  }
  .pigeons-calc-panel .node-eyebrow{ color:var(--grey); margin-bottom:1.25rem; }
  .pigeons-calc-panel .pigeons-bar-rate-row{ justify-content:center; margin-bottom:1.1rem; }
  .pigeons-calc-panel .pigeons-bar-rate-value{ font-size:15px; }
  .pigeons-calc-panel .pigeons-bar-calc{ padding:1.1em 1.1em; }
  .pigeons-calc-panel .pigeons-bar-calc-input{ font-size:22px; }
  /* VIEW 0N DEX — a real second action underneath the calculator itself,
     not just the small icon-link next to the rate above (kept as-is, a
     quick glance rather than a deliberate click). Same treatment as
     .offer-confirm-xaman-btn's own purple call-to-action elsewhere. */
  .pigeons-calc-dex-btn{
    display:block;
    width:100%;
    margin-top:1.25rem;
    background:var(--pigeon-purple);
    border:1px solid var(--pigeon-purple);
    border-radius:var(--radius);
    padding:0.85em 1em;
    color:#fff;
    font-family:var(--font-mono);
    font-size:14px;
    font-weight:700;
    letter-spacing:0.08em;
    text-transform:uppercase;
    text-decoration:none;
    text-align:center;
    cursor:pointer;
    transition:background 0.15s ease, border-color 0.15s ease;
  }
  .pigeons-calc-dex-btn:hover{ background:var(--magenta); border-color:var(--magenta); }
  .pigeons-calc-close-btn{
    display:block;
    width:100%;
    margin-top:0.6rem;
    background:transparent;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    padding:0.7em 1em;
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:13px;
    letter-spacing:0.06em;
    text-transform:uppercase;
    cursor:pointer;
  }
  .pigeons-calc-close-btn:hover{ border-color:#fff; color:#fff; }
  @media (max-width:500px){
    .pigeons-calc-panel .pigeons-bar-calc{ flex-wrap:wrap; justify-content:center; }
    .pigeons-calc-panel .pigeons-bar-calc-input{ font-size:18px; }
  }
  .pigeons-bar-rate-row{ display:flex; align-items:center; gap:0.5rem; }
  .pigeons-bar-rate-value{ font-family:var(--font-mono); font-size:12px; font-weight:700; color:var(--green); text-shadow:0 0 6px var(--green-glow); white-space:nowrap; }
  .pigeons-bar-dex-btn{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    width:24px;
    height:24px;
    padding:2px;
    border:1px solid rgba(255,255,255,0.6);
    border-radius:var(--radius);
    background:#000;
    flex:0 0 auto;
  }
  .pigeons-bar-dex-btn:hover{ border-color:#fff; }
  .pigeons-bar-calc{
    display:flex;
    align-items:center;
    gap:0.5rem;
    background:rgba(0,0,0,0.18);
    border:1px solid rgba(255,255,255,0.6);
    border-radius:var(--radius);
    padding:0.6em 0.9em;
  }
  .pigeons-bar-calc-input{
    /* Base/minimum width — grown dynamically via updatePigeonsCalc's
       resizeCalcInput as you type (ch units, monospace font, so 1ch really
       is one typed character's width). Centered text + the whole box
       being centered in its flex:1 slot means it grows evenly from both
       sides, not anchored to one edge. */
    width:10ch;
    min-width:10ch;
    background:transparent;
    border:none;
    color:#fff;
    font-family:var(--font-mono);
    font-size:17px;
    text-align:center;
    padding:0.2em 0;
    transition:width 0.1s ease;
  }
  .pigeons-bar-calc-input:focus{ outline:none; }
  /* $P!GE0NS side of the calculator — same input, just a wider base/
     minimum width so a typed number doesn't clip. */
  .pigeons-bar-calc-input-wide{ width:14ch; min-width:14ch; }
  .pigeons-bar-calc-input::placeholder{ color:rgba(255,255,255,0.6); text-transform:uppercase; }
  .pigeons-bar-calc-arrow{ color:rgba(255,255,255,0.7); font-size:18px; }
  /* DEXSCREENER icon inside its stat-tile up in the carousel now (see
     the RATE page) — sizing only, the tile/link styling comes from
     .stat-tile/.stat-tile-link. */
  .pigeons-bar-dex-icon{ width:22px; height:22px; border-radius:4px; flex:0 0 auto; }
  @media (max-width:700px){
    /* Single column now (was the grid's own 1fr/auto/1fr row track set) —
       every child stacks full-width in DOM/order sequence instead of
       sitting in its own side-by-side track. */
    .pigeons-bar-main-row{ display:flex; flex-direction:column; text-align:center; }
    .pigeons-bar-left{ flex-direction:column; text-align:center; }
    .pigeons-bar-left-body{ align-items:center; text-align:center; }
    .pigeons-bar-left-body-row{ flex-direction:column; }
    .pigeons-bar-left-lines{ align-items:center; }
    /* No longer position:absolute (see the base rule's own comment) — just
       stacks the thumb+info+buy column above the rest, same as before. */
    .pigeons-bar-balance{ flex-direction:column; margin:0.75rem 0; order:-1; }
    .pigeons-bar-balance-info{ align-items:center; text-align:center; }
  }

  /* ---- DATABASE row card: traits, and an in-card sales-history toggle
     that replaces the whole right-hand box while open ---- */
  /* 3 across, sized to roughly match the (now bigger, 280px) thumbnail's
     own footprint — 2 rows fit in that same vertical space, anything past
     that scrolls inside the grid instead of growing the card taller than
     its own thumbnail. */
  .card-trait-grid{
    display:grid;
    grid-template-columns:repeat(3, 1fr);
    gap:0.5rem;
    margin-top:0.5rem;
    max-height:330px;
    overflow-y:auto;
    padding-right:2px;
  }
  .card-trait-cell{ background:rgba(61,243,236,0.05); border:1px solid var(--cyan-dim); border-radius:var(--radius); padding:0.85rem 0.5rem; text-align:center; cursor:pointer; transition:background 0.15s ease, border-color 0.15s ease; }
  .card-trait-cell:hover{ background:rgba(61,243,236,0.14); border-color:var(--cyan); }
  .card-tc-label{ font-size:10px; font-weight:700; letter-spacing:0.1em; color:var(--cyan); text-shadow:0 0 4px var(--cyan-glow); text-transform:uppercase; margin-bottom:0.3rem; }
  .card-tc-value{ font-size:14px; font-weight:700; letter-spacing:0.02em; color:var(--white); }
  /* The percent is the important number here — same visual weight as the
     value itself, not a tiny grey afterthought. */
  .card-tc-pct{ font-size:17px; font-weight:800; letter-spacing:0.02em; color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); margin-top:0.45rem; padding-top:0.45rem; border-top:1px dashed var(--border-dim); }
  .card-tc-count{ display:block; font-size:10px; font-weight:400; letter-spacing:0.06em; color:var(--grey); margin-top:0.15rem; text-transform:uppercase; }
  @media (max-width:500px){
    .card-trait-grid{ grid-template-columns:repeat(2, 1fr); }
  }
  .card-select-toggle, .my-pigeon-offer-toggle{ width:1.9em; height:1.9em; line-height:1.9em; font-size:16px; }

  @media (max-width:900px){
    .result-grid{ grid-template-columns:repeat(3, 1fr); }
  }
  @media (max-width:700px){
    body{ padding:4vh 2.5vw 6vh; }
    .sw-panel{ padding:1rem 0.75rem; }
    /* 2-wide on mobile, still bigger than the old cramped tiles. */
    .result-grid{ grid-template-columns:repeat(2, 1fr); gap:0.7rem; }
    .result-card-body{ padding:0.6rem 0.5rem; }
    .result-num{ padding:0.5rem 0.35rem; }
    .card-select-toggle, .my-pigeon-offer-toggle{ width:1.7em; height:1.7em; line-height:1.7em; font-size:14px; }
  }

  /* ---- infinite scroll ---- */
  .scroll-sentinel{ height:1px; }
  .load-more-note{
    text-align:center;
    font-size:11px;
    letter-spacing:0.1em;
    color:var(--cyan-dim);
    padding:1.5rem 0;
    text-transform:uppercase;
  }
  .end-of-collection-note{
    text-align:center;
    font-family:var(--font-body);
    font-size:10px;
    letter-spacing:0.06em;
    color:var(--grey-disabled);
    padding:1.5rem 0;
    text-transform:uppercase;
  }

  /* ---- pagination (kept for detail-only contexts; browse now uses
     infinite scroll instead) ---- */
  .pagination-row{ display:flex; justify-content:center; gap:0.75rem; margin-top:1.5rem; }
  .page-btn{
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:11px;
    letter-spacing:0.1em;
    padding:0.65em 1.3em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .page-btn:hover:not(:disabled){ border-color:var(--cyan-dim); color:var(--cyan); }
  .page-btn:disabled{ opacity:0.3; cursor:not-allowed; }
  /* Same "unmistakable, fills the space" treatment as .empty-state just
     below — a sort/filter/search result swap used to just blank this
     area with a barely-there 11px note easy to miss entirely, especially
     on mobile where there's no surrounding grid to signal "something is
     about to happen here." min-height matches .empty-state's own 60vh so
     there's no layout jump between the loading state and whichever of
     .result-list / .empty-state replaces it once the fetch settles. */
  .loading-note{
    text-align:center;
    min-height:60vh;
    display:flex;
    align-items:center;
    justify-content:center;
    font-size:22px;
    letter-spacing:0.12em;
    color:var(--cyan);
    text-shadow:0 0 8px var(--cyan-glow);
    text-transform:uppercase;
    padding:2rem 1rem;
    animation:loadingNotePulse 1.4s ease-in-out infinite;
  }
  @keyframes loadingNotePulse{
    0%, 100%{ opacity:1; }
    50%{ opacity:0.5; }
  }
  @media (max-width:760px){
    .loading-note{ font-size:16px; min-height:40vh; padding:1.5rem 1rem; }
  }

  /* ---- detail screen — picture sized to fit its own (now bigger) column
     on the left, with the marketplace listings and the $PIGEONS listing/
     offer box directly underneath it; number/traits/sale fields on the
     right in a fixed 3-across trait grid, sized down a little from the
     first pass so the picture reads as the bigger of the two. Scoped to
     #screenDetail specifically — .detail-field/.trait-grid/.df-label etc
     are shared with several other narrow centered confirm/result screens
     elsewhere in this file, which must stay exactly as they are. ---- */
  /* Clicking into a Pigeon now opens its own full-viewport box instead of
     just being another panel in the scrolling page — fixed, edge to edge,
     with body.detail-open (see body{} above) freezing the page underneath
     it. Sized and padded tight enough (see the compacted spacing
     throughout this screen below) that a typical Pigeon's full detail —
     image, traits, listings, sales, BACK — fits one screen with nothing
     to scroll; only a Pigeon at the collection's max trait count (7), on
     a short viewport, still needs to scroll this box internally. */
  #screenDetail{
    position:fixed;
    inset:0;
    z-index:70;
    margin:0;
    border-radius:0;
    overflow-y:auto;
    /* Was unset (defaults to visible) — #screenDetail is its own fixed,
       self-scrolling box (overflow-y:auto above), entirely separate from
       body's own overflow-x:hidden, so anything inside wider than the
       viewport could pan the whole detail page sideways regardless of
       the site-wide fix. Reported live as "shouldn't be able to scroll
       across on the detail page". */
    overflow-x:hidden;
    -webkit-overflow-scrolling:touch;
    /* .sw-panel's own background+blur (background:var(--panel-bg),
       backdrop-filter:blur(7px)) is tuned for a small card floating over
       the page — stretched edge to edge here at a low enough alpha to
       let anything show through, it just revealed whatever page content
       sat behind it (the real page is still there, only display:none'd
       screens are actually removed) rather than reading as its own
       background. Opaque instead, with its own TV-static canvas + CRT
       scanline layer below (#detailStaticBg / ::before) — an exact copy
       of the page's own recipe (canvas#staticBg / body::before), not a
       window into it. */
    background:var(--bg);
    backdrop-filter:none;
    -webkit-backdrop-filter:none;
    padding:clamp(0.5rem, 1.8vh, 1.25rem) clamp(1rem, 4vw, 3rem);
  }
  #screenDetail::before{
    content:'';
    position:fixed;
    inset:0;
    z-index:-1;
    pointer-events:none;
    background:repeating-linear-gradient(
      to bottom,
      rgba(255,255,255,0.018) 0px,
      rgba(255,255,255,0.018) 1px,
      transparent 1px,
      transparent 3px
    );
    mix-blend-mode:overlay;
  }
  /* PREV/NEXT — fixed to the screen's own left/right edges (position:fixed,
     same containing block as #screenDetail itself since that's also
     fixed), vertically centered, so they stay put regardless of scroll
     position or how tall this particular Pigeon's content happens to be. */
  .detail-nav-btn{
    position:fixed;
    top:50%;
    transform:translateY(-50%);
    z-index:75;
    width:44px;
    height:44px;
    display:flex;
    align-items:center;
    justify-content:center;
    background:rgba(8,9,11,0.7);
    border:1px solid var(--cyan-dim);
    border-radius:50%;
    color:var(--cyan);
    font-size:20px;
    text-shadow:0 0 6px var(--cyan-glow);
    cursor:pointer;
    transition:border-color 0.15s ease, color 0.15s ease, background 0.15s ease, opacity 0.15s ease;
  }
  .detail-nav-btn:hover:not(:disabled){ border-color:var(--cyan); background:var(--cyan-faint); }
  .detail-nav-btn:disabled{ opacity:0.25; cursor:not-allowed; }
  .detail-nav-prev{ left:clamp(0.5rem, 2vw, 1.5rem); }
  .detail-nav-next{ right:clamp(0.5rem, 2vw, 1.5rem); }
  @media (max-width:760px){
    /* Same edges as the two-column layout's own mobile breakpoint —
       small screens are tight enough that a 44px circle overlapping the
       picture is more in-the-way than useful; shrink and pull to the
       very edge instead of removing them outright. */
    .detail-nav-btn{ width:36px; height:36px; font-size:16px; }
    .detail-nav-prev{ left:0.25rem; }
    .detail-nav-next{ right:0.25rem; }
  }
  /* Lightbox only (see #detailLightbox's own comment above) — re-anchored
     from vertically-centered-on-the-side-edges to a row below the
     picture: still position:fixed like the base rule, just measured from
     the bottom of the viewport and offset left/right of dead-center
     instead of top/left-right, so the two buttons land side by side
     under the image without needing any wrapper element. left:50% + a
     margin (36px button + 8px gap) is simpler and more reliable here
     than trying to get flex/grid to group two position:fixed elements
     that already live outside the lightbox's own flex flow. */
  @media (max-width:760px){
    #detailLightbox .detail-nav-btn{ top:auto; bottom:1rem; transform:none; left:50%; right:auto; }
    #detailLightbox .detail-nav-prev{ margin-left:-44px; }
    #detailLightbox .detail-nav-next{ margin-left:8px; }
  }
  /* Second BACK entry point — shares a row with P!GE0N #N now (see
     .detail-num-row), not floating position:fixed independent of it any
     more (used to sit at the top-left corner of the whole screen,
     unrelated to the number's own — centered — position, so the two
     ended up visually colliding/misaligned depending on scroll position;
     confirmed live). position:absolute within that row instead, pinned
     to its left edge and vertically centered against whatever height the
     row's own content (the number) actually needs — the row itself sits
     at the very top of .detail-two-col (grid-area:num), so this reads as
     "moved upward" compared to where it used to float. Loses the old
     "stays put while you scroll the page" behavior in exchange — the
     full-width BACK strip at the bottom of the traits/listings column is
     still there as the persistent option. */
  .detail-num-row{ position:relative; }
  .detail-back-btn-top{
    position:absolute;
    left:0;
    top:50%;
    transform:translateY(-50%);
    z-index:2;
    padding:0.5em 1em;
    font-family:var(--font-mono);
    font-size:14px;
    font-weight:700;
    letter-spacing:0.08em;
    color:var(--cyan);
    background:transparent;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    cursor:pointer;
    appearance:none;
    transition:border-color 0.15s ease, background 0.15s ease;
  }
  .detail-back-btn-top:hover{ background:var(--cyan-faint); border-color:var(--cyan-dim); }
  .detail-share-btn{
    position:absolute;
    right:0;
    top:50%;
    transform:translateY(-50%);
    z-index:2;
    padding:0.5em 1em;
    font-family:var(--font-mono);
    font-size:14px;
    font-weight:700;
    letter-spacing:0.08em;
    color:var(--green);
    background:transparent;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    cursor:pointer;
    appearance:none;
    transition:border-color 0.15s ease, background 0.15s ease;
  }
  .detail-share-btn:hover{ background:rgba(52,255,133,0.1); border-color:var(--green); }
  @media (max-width:760px){
    .detail-back-btn-top{ font-size:12px; padding:0.4em 0.7em; }
    .detail-share-btn{ font-size:12px; padding:0.4em 0.7em; }
  }
  /* Local copy of canvas#staticBg's own look (see the drawStatic loop —
     both canvases run the identical draw function) — negative z-index so
     it paints behind the screen's real (non-positioned, normal-flow)
     content automatically, same layering canvas#staticBg gets from
     sitting behind the whole page. */
  .local-static-bg{
    position:fixed;
    inset:0;
    z-index:-1;
    width:100%;
    height:100%;
    opacity:0.2;
    filter:brightness(0.7) contrast(1.3);
    mix-blend-mode:screen;
    pointer-events:none;
  }
  @media (prefers-reduced-motion: reduce){
    .local-static-bg{ display:none; }
  }
  /* Named grid areas so PIGEON #N sits in its own row above just the
     picture's column, while RARITY/RARITY SCORE (the right column's first
     row) starts level with the picture's own top — not pushed down by
     the number, since the right column never occupies the "num" row at
     all. RARITY/RARITY SCORE spread across the full column width, then
     the trait grid packs directly underneath — with a Pigeon that has
     exactly a full 3x3 of traits, that grid's own bottom edge lands
     flush with the picture's bottom (see .trait-cell sizing below, tuned
     against the picture's own typical height for that 3-row case). */
  .detail-two-col{
    display:grid;
    /* Bigger picture, explicitly requested over the earlier compaction
       pass's smaller cap — the right column (1fr) automatically gets
       pushed across/narrower as this grows, no separate change needed
       there, and everything under the picture (.detail-under-pic-box,
       the RARITY row, the $PIGEONS listing block) is already max-width:
       100% of this column, so it all scales up with it for free. */
    grid-template-columns:minmax(340px, 560px) 1fr;
    grid-template-areas:
      "num  owner"
      "left right";
    gap:0.5rem 2rem;
    align-items:start;
  }
  /* grid-area:num moved to the row wrapper (.detail-num-row) now that
     BACK shares it — .detail-num itself is just the centered text inside
     that row, same as before. */
  #screenDetail .detail-two-col > .detail-num-row{ grid-area:num; }
  #screenDetail .detail-num-row .detail-num{ text-align:center; margin:0; }
  .detail-col-left{ grid-area:left; }
  .detail-col-right{ grid-area:right; }
  /* Owner address sits flush with P!GE0N #N — same row, same text weight —
     instead of buried as a small label further down the right column. */
  .detail-owner-top{ grid-area:owner; text-align:center; font-family:var(--font-display); font-weight:700; font-size:22px; letter-spacing:0.04em; margin:0; }
  #screenDetail .detail-owner-top{ font-size:28px; }
  .detail-owner-top .owner-link{ color:var(--cyan); text-decoration:none; }
  .detail-owner-top .owner-link:hover{ text-decoration:underline; }
  .detail-owner-top .owner-message-link{
    color:var(--green); font-family:var(--font-mono); font-weight:400; font-size:12px;
    letter-spacing:0.08em; text-decoration:none; border:1px solid var(--green); border-radius:3px;
    padding:0.15em 0.5em; vertical-align:middle; margin-left:0.5em;
  }
  .detail-owner-top .owner-message-link:hover{ background:var(--green); color:var(--bg); }
  /* Small label above the address itself — otherwise a bare wallet
     string up top read as an ID, not an ownership statement. */
  .detail-owner-top .do-label{ display:block; font-family:var(--font-mono); font-weight:400; font-size:11px; letter-spacing:0.18em; color:var(--grey-dim); text-transform:uppercase; margin-bottom:0.3rem; }
  @media (max-width:760px){
    .detail-two-col{ grid-template-columns:1fr; grid-template-areas:"num" "owner" "left" "right"; gap:0.75rem; }
  }
  #screenDetail .detail-col-left .detail-img-large{ width:100%; max-width:100%; margin:0 0 0.75rem; cursor:zoom-in; }
  /* Plain wrapper for RAR!TY/RAR!TY SC0RE + the $PIGEONS LISTING block,
     sitting directly underneath the picture — no decorative frame, just
     spacing between the two. */
  .detail-under-pic-box{ margin-top:0.5rem; }
  #screenDetail .detail-listings-row{ max-width:100%; margin:0 0 0.6rem; }
  /* Plain neutral panel, not pink — same fix as .thumb-offer on the
     DATABASE card grid (see that rule's own comment): this is just a
     container for whichever real buttons/inputs it holds (BUY N0W
     green, CANCEL red, the OFFER AMOUNT field), painting it solid pink
     regardless of what's inside drowned all of that out. */
  #screenDetail .scylla-listing-block{
    max-width:100%;
    margin:0;
    background:var(--panel-bg-solid);
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    padding:0.9rem 1rem;
  }
  #screenDetail .scylla-listing-block .tech-meta-title{ color:#fff; opacity:0.9; }
  #screenDetail .scylla-listing-price{ font-size:17px; color:#fff; text-shadow:0 1px 4px rgba(0,0,0,0.5); }
  #screenDetail #detailMakeOfferRow{ margin-top:0.75rem; }
  #screenDetail .detail-num{ font-size:28px; }
  #screenDetail .trait-grid{ max-width:100%; margin:0.4rem 0 0; grid-template-columns:repeat(3, 1fr); gap:0.4rem; }
  @media (max-width:520px){
    #screenDetail .trait-grid{ grid-template-columns:repeat(2, 1fr); }
  }
  /* Compact enough that a full 3-row grid (7 traits, the collection's max)
     doesn't push the whole detail screen into needing to scroll — this
     was the single tallest section on the page at the old, roomier
     padding. */
  #screenDetail .trait-cell{ padding:0.45rem 0.6rem; }
  #screenDetail .trait-cell .tc-label{ font-size:14px; }
  #screenDetail .trait-cell .tc-value{ font-size:19px; }
  #screenDetail .trait-cell .tc-sub{ font-size:14px; }
  /* Real trait cells (not RARITY/RARITY SCORE, which keeps label-then-
     value) now render value-then-label — .tc-label's own margin-bottom
     (spacing meant for when it came first) would leave no gap here, so
     flip it to margin-top instead, scoped to just .trait-grid's own
     cells. */
  #screenDetail .trait-grid .tc-label{ margin-bottom:0; margin-top:0.35rem; }
  /* The category name (e.g. "FEATHERS") reads as a caption under the
     actual value — italic sets it apart from the value itself without
     changing its size/weight, which would throw off the trait grid's
     flush-with-the-picture bottom edge (see the sizing note above). */
  #screenDetail .trait-grid .tc-label{ font-style:italic; }
  /* Real Pigeon-photo background (see traitCellHtml) — bright white reads
     far more reliably over a busy photo than the site's default grey/cyan
     text, same font-size as plain cells (again, the flush-bottom sizing)
     except the percent/count line, which stays bigger as its own thing. */
  #screenDetail .trait-cell.has-preview{ background-size:cover; background-position:center 20%; }
  #screenDetail .trait-cell.has-preview .tc-label{ color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.9); }
  #screenDetail .trait-cell.has-preview .tc-value{ color:#fff; text-shadow:0 1px 3px rgba(0,0,0,0.9); }
  #screenDetail .trait-cell.has-preview .tc-sub{ color:#fff; font-size:16px; text-shadow:0 1px 3px rgba(0,0,0,0.9); }
  /* Static solid box behind value/label/sub together — text-shadow alone
     still clashed against a busy/light crop, this reads reliably over
     any of them. */
  #screenDetail .trait-cell.has-preview .tc-text{ background:rgba(8,9,11,0.68); border-radius:calc(var(--radius) - 2px); padding:0.5rem 0.4rem; }
  #screenDetail .trait-cell.has-preview:hover{ border-color:var(--cyan); }
  /* Constrained instead of stretching the field's label/value across the
     whole (wide) right column — that gap made label and value feel
     unrelated, like you had to hunt across the screen to match them up. */
  #screenDetail .detail-field{ max-width:320px; margin:0 0 0.6rem; font-size:15px; }
  /* RARITY and RARITY SCORE, above the trait grid (not among the real
     trait cells below), same box treatment (label above value) — the
     actual score isn't computed yet, so that box just reads COMING SOON.
     Neither is clickable. Spread across the full column width with a
     wider gap than the trait grid's own — reads as its own row, not just
     the first two cells of a 3-across grid. */
  #screenDetail .detail-rarity-row{ display:grid; grid-template-columns:repeat(2, 1fr); gap:1rem; margin:0 0 0.6rem; max-width:100%; }
  #screenDetail .detail-rarity-row .trait-cell{ cursor:default; text-align:center; min-width:0; }
  #screenDetail .detail-rarity-row .trait-cell:hover{ background:transparent; border-color:var(--border-dim); }
  /* PRICE / RECORD SALE / RECENT SALE / AVERAGE SALE — stacked directly
     underneath the trait grid (including its own BACK cell), inside the
     right column, not off in a separate full-width section — keeps the
     traits themselves the ones flush with the picture's bottom, this
     just extends the column further down below that. Bigger + a real
     label/value size split (not identical sizes) so it reads cleaner. */
  #screenDetail .detail-sales-section{
    display:flex;
    flex-direction:column;
    gap:0.5rem;
    width:100%;
    max-width:100%;
    margin:0.6rem 0 0;
    padding-top:0.6rem;
    border-top:1px dashed var(--border-dim);
  }
  /* The listings row already carries its own bottom margin for the DATABASE
     card context it's shared with — inside this flex column the gap above
     already spaces it from what follows, so that margin would just double
     up the same gap twice. */
  #screenDetail .detail-sales-section .detail-listings-row{ margin:0; }
  /* Centered, label above value — easier to read at a glance than a
     left/right split row, especially now they're stacked one after
     another rather than spread across a wider area. */
  #screenDetail .detail-sales-section .detail-field{ display:flex; flex-direction:column; align-items:center; gap:0.2rem; margin:0; max-width:100%; font-size:17px; text-align:center; }
  #screenDetail .detail-sales-section .df-label{ font-size:12px; }
  #screenDetail .detail-sales-section .df-value{ font-weight:700; text-align:center; }
  #screenDetail .detail-history{ margin-top:0.75rem; max-width:100%; }
  #screenDetail .detail-history .th-toggle{ font-size:14px; }
  /* RECORD SALE / AVERAGE SALE stacked, same label/value row style as
     every other .detail-field (OWNER, PRICE, etc). */
  #screenDetail .tech-meta-title{ font-size:12px; }
  /* Fullscreen picture lightbox — same opaque bg + local static-canvas
     layer as #screenDetail (see above), instead of near-solid black. */
  #detailLightbox{
    display:none;
    position:fixed;
    inset:0;
    z-index:1000;
    background:var(--bg);
    align-items:center;
    justify-content:center;
    /* Small, not 2rem — object-fit:contain already keeps the picture's
       real aspect ratio (never crops it), so the actual limiting factor
       for "fill the browser" is almost always the viewport's own
       dimensions, not this padding — but every pixel of padding is still
       a pixel the picture can't use, and 2rem (32px per side, 64px total)
       was taking a real bite out of it for no reason. */
    padding:0.75rem;
    cursor:zoom-out;
  }
  #detailLightbox::before{
    content:'';
    position:fixed;
    inset:0;
    z-index:-1;
    pointer-events:none;
    background:repeating-linear-gradient(
      to bottom,
      rgba(255,255,255,0.018) 0px,
      rgba(255,255,255,0.018) 1px,
      transparent 1px,
      transparent 3px
    );
    mix-blend-mode:overlay;
  }
  #detailLightbox img{ max-width:100%; max-height:100%; object-fit:contain; }
  /* Mobile: the 2rem padding above plus PREV/NEXT floating over the
     picture's own left/right edges (see .detail-nav-btn below) both ate
     into how big the "fullscreen" zoom actually looked on a phone —
     confirmed live, it read as barely bigger than the detail screen's
     own inline picture, not a real zoom in. Shrink the padding down to
     almost nothing so the picture genuinely fills the screen, and move
     PREV/NEXT off the picture's edges to a row underneath it instead —
     both still position:fixed (unchanged from desktop), just re-anchored
     to the bottom-center instead of vertically centered on the sides, so
     no wrapper markup is needed to group them into one row. */
  @media (max-width:760px){
    #detailLightbox{ padding:0.5rem 0.5rem 4.5rem; }
  }
  /* Lightbox's own PREV/NEXT reuse .detail-nav-btn's look — bumped above
     the lightbox's own z-index:1000 (the base .detail-nav-btn z-index:75
     is only enough to sit above #screenDetail) and given cursor:pointer
     since the lightbox itself sets cursor:zoom-out. */
  #detailLightbox .detail-nav-btn{ z-index:1001; cursor:pointer; }
  .detail-eyebrow{
    text-align:center;
    font-size:11px;
    letter-spacing:0.2em;
    color:var(--cyan);
    text-shadow:0 0 6px var(--cyan-glow);
    margin-bottom:0.75rem;
    text-transform:uppercase;
  }
  .detail-num{ text-align:center; font-family:var(--font-display); font-weight:700; font-size:22px; letter-spacing:0.04em; color:var(--white); margin-bottom:1.25rem; }
  .detail-img-large{ width:100%; max-width:460px; margin:0 auto 0.75rem; border:1px solid var(--border-mid); }
  .detail-listings-row{ max-width:460px; margin:0 auto 1.25rem; }
  .detail-listings-row .cl-block{ padding:0.65rem 0.5rem; }
  .detail-listings-row .cl-market{ font-size:10px; margin-bottom:0.45rem; }
  .detail-listings-row .cl-price{ font-size:14px; }
  .detail-field{
    display:flex;
    justify-content:space-between;
    max-width:460px;
    margin:0 auto 0.7rem;
    font-size:12px;
    letter-spacing:0.05em;
  }
  .df-label{ color:var(--grey-dim); text-transform:uppercase; }
  .df-value{ color:var(--white); text-align:right; word-break:break-all; }
  .df-value.not-indexed, .detail-owner-top.not-indexed{ color:var(--magenta); text-shadow:0 0 4px var(--magenta-glow); }
  .df-value.rarity{ color:var(--white); }
  .df-value.price{ color:var(--white); }
  /* A settled/confirmed status reads as unambiguously good — green, not
     plain white like every other field. */
  .df-value.status-ok{ color:var(--green); text-shadow:0 0 6px var(--green-glow); font-weight:700; }
  /* The real, final, after-every-deduction number (what a seller actually
     receives) — reported live as easy to miss/misread among a row of
     same-size fields when it's the one number that actually matters most.
     Bigger and green (same "this is the good outcome" language status-ok
     already uses) so it can't be confused with an intermediate figure. */
  .detail-field.final-amount-row{ margin-top:0.9rem; padding-top:0.7rem; border-top:1px solid var(--border-mid); }
  .detail-field.final-amount-row .df-label{ font-size:13px; }
  .df-value.final-amount{ color:var(--green); text-shadow:0 0 6px var(--green-glow); font-weight:700; font-size:20px; }
  /* BUY N0W/ACCEPT 0FFER/CANCEL's waiting-for-signature line — reported
     live as reading cluttered (a wall of plain grey text sitting flush
     against the price above it), so this gets real breathing room and a
     pulse (same flock-count-pulse keyframe the trustline banner's own
     loading state already uses) instead of sitting static the whole time
     it's genuinely waiting on Xaman. The pulse is only ever toggled on for
     the live "waiting" state (see waitingStatusPulse in static.js) — a
     final error/success line stays still, since it's no longer waiting
     on anything.
  */
  .waiting-status-line{ margin-top:1.4rem; }
  .waiting-status-line.pulsing{ animation:flock-count-pulse 1.4s ease-in-out infinite; }
  .df-value a.owner-link{ color:var(--grey); text-decoration:underline; }
  .df-value a.owner-link:hover{ color:var(--cyan); }
  /* ---- "Receipt" result screen — LIST result's own big/clean layout
     (screenListResult), a deliberately different shape from the compact
     .detail-field row-list every other confirm/result screen uses. One
     glance, three things: which Pigeon, that it went through, what it
     cost — nothing else competing for attention. Large by design, not
     just a bigger font on the same cramped layout. */
  .result-receipt{
    max-width:420px;
    margin:0 auto;
    text-align:center;
    padding-top:2rem;
    padding-bottom:2rem;
  }
  .receipt-badge{
    width:64px;
    height:64px;
    margin:0 auto 1.25rem;
    display:flex;
    align-items:center;
    justify-content:center;
    border:2px solid var(--green);
    border-radius:50%;
    color:var(--green);
    font-size:32px;
    text-shadow:0 0 10px var(--green-glow);
    box-shadow:0 0 22px var(--green-glow);
  }
  .receipt-pigeon-num{
    font-family:var(--font-display);
    font-weight:700;
    font-size:32px;
    letter-spacing:0.03em;
    color:var(--white);
  }
  .receipt-status-line{
    margin-top:0.4rem;
    font-size:13px;
    letter-spacing:0.2em;
    color:var(--green);
    text-shadow:0 0 6px var(--green-glow);
    text-transform:uppercase;
  }
  .receipt-price-row{
    margin:2rem 0;
    padding:1.25rem 1rem;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    background:rgba(255,255,255,0.03);
  }
  .receipt-price-label{ font-size:11px; letter-spacing:0.2em; color:var(--grey-dim); text-transform:uppercase; margin-bottom:0.5rem; }
  .receipt-price-value{ font-family:var(--font-display); font-weight:700; font-size:34px; letter-spacing:0.02em; color:var(--white); }
  .result-receipt .detail-actions{ margin-top:0.5rem; justify-content:center; }
  /* Real proof, one click away — small and out of the way instead of a
     raw hash competing with the price for attention. */
  .receipt-tx-link{
    display:inline-block;
    margin-top:1rem;
    font-size:11px;
    letter-spacing:0.1em;
    color:var(--grey-dim);
    text-decoration:underline;
    text-transform:uppercase;
  }
  .receipt-tx-link:hover{ color:var(--cyan); }
  @media (max-width:480px){
    .receipt-pigeon-num{ font-size:26px; }
    .receipt-price-value{ font-size:28px; }
  }
  /* ---- Clean confirm-screen layout — same "big, clean, only what
     matters" spirit as .result-receipt above, adapted for a confirm
     screen (still needs BACK/0PEN XAMAN + a signing-status line) rather
     than a final result. No raw txjson fields (tx-type badge, hex
     NFTokenID/Amount.currency/Amount.issuer) — just plain-English
     label/value pairs, each large enough to read at a glance. Shared by
     TRANSFER and 0FFER's own confirm screens. ---- */
  .confirm-clean{ max-width:440px; margin:0 auto; text-align:center; }
  .confirm-clean .node-eyebrow{ font-size:15px; margin-bottom:1.75rem; }
  .confirm-field-label{ font-size:11px; letter-spacing:0.2em; color:var(--grey-dim); text-transform:uppercase; margin-bottom:0.5rem; }
  .confirm-field-value{
    font-family:var(--font-mono);
    font-weight:700;
    font-size:16px;
    letter-spacing:0.02em;
    color:var(--white);
    word-break:break-all;
    margin-bottom:1.75rem;
  }
  .confirm-pigeon-num{
    font-family:var(--font-display);
    font-weight:700;
    font-size:30px;
    letter-spacing:0.03em;
    color:var(--white);
    margin-bottom:1.75rem;
  }
  @media (max-width:480px){
    .confirm-pigeon-num{ font-size:24px; }
    .confirm-field-value{ font-size:14px; }
  }
  /* ΣΚΥΛΛΑ://S!GNAL's own prompt body — was previously built entirely out
     of .index-line (9.5px, uppercase, meant for a single line of fine
     print elsewhere), which read as cramped/hard to read for what's
     actually a real decision (spending real XRP) explained across three
     sentences. Not text-transform:uppercase here — a real paragraph
     stays readable in sentence case; individual key terms are bolded
     with <strong> instead of the whole block shouting. */
  .signal-heading{
    font-family:var(--font-display);
    font-weight:700;
    font-size:16px;
    letter-spacing:0.04em;
    color:var(--white);
    text-transform:uppercase;
    margin-bottom:0.6rem;
  }
  .signal-body{
    font-family:var(--font-body);
    font-size:14px;
    line-height:1.5;
    letter-spacing:0.01em;
    color:var(--grey);
  }
  .signal-body strong{ color:var(--white); font-weight:700; }
  .signal-body-dim{ color:var(--grey-dim); font-size:13px; }
  /* 0FFER CONFIRMATION's own big amount line + real clickable picture —
     "___ $PIGEONS / FOR / [picture] / PIGEON #N", nothing else. */
  .confirm-field-value-big{ font-family:var(--font-display); font-size:26px; font-weight:700; }
  .confirm-pigeon-thumb{
    display:block;
    width:140px;
    height:140px;
    object-fit:cover;
    border-radius:var(--radius);
    margin:0 auto 0.75rem;
    cursor:pointer;
    border:1px solid var(--border-mid);
  }
  .confirm-pigeon-num-clickable{ cursor:pointer; }
  .confirm-pigeon-num-clickable:hover{ text-decoration:underline; }
  /* ---- 0FFER CONFIRMATION — a real second popup (stacked on top of the
     amount-entry one, see showOfferConfirm), not a showScreen navigation
     away from the grid. Same plain dark panel every other popup on this
     page uses now (.amount-entry-panel's own treatment) — was a purple
     gradient/glow "exciting moment" panel, reported live as "shiny",
     out of step with the rest of the site and every other, plainer
     popup right next to it. ---- */
  @keyframes offer-confirm-pop{
    from{ transform:scale(0.9); opacity:0; }
    to{ transform:scale(1); opacity:1; }
  }
  #offerConfirmModal, #transferConfirmModal, #acceptTransferConfirmModal, #buySwapModal, #buyConfirmModal, #delistConfirmModal, #acceptOfferConfirmModal{
    display:none;
    position:fixed;
    inset:0;
    z-index:1000;
    background:rgba(5,5,6,0.88);
    align-items:center;
    justify-content:center;
    padding:2rem 1rem;
  }
  /* #buySwapModal now also opens straight from MAINFRAME's BUY buttons
     (see mainframeGrid's click handler), and #screenMainframe sits at
     z-index:2000 — above this modal's shared z-index:1000 — so without
     its own higher stacking the popup would render but be painted over
     by MAINFRAME itself. */
  #buySwapModal{ z-index:2100; }
  .offer-confirm-panel{
    width:min(440px, 100%);
    text-align:center;
    background:var(--panel-bg-solid);
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    box-shadow:0 10px 30px rgba(0,0,0,0.6);
    padding:1.75rem 1.5rem;
    animation:offer-confirm-pop 0.2s ease;
  }
  .offer-confirm-panel .node-eyebrow{ color:var(--grey); font-size:15px; margin-bottom:1.5rem; }
  .offer-confirm-panel .confirm-pigeon-num{ color:var(--white); }
  /* Combined selector, not .offer-confirm-xaman-btn alone — needs to
     out-specificity .action-btn's own background/border/color, which is
     declared later in the file and would otherwise win on source order
     despite equal specificity. */
  /* Black text on the filled colour, not white — white-on-bright-cyan
     was genuinely hard to read (both pale/high-lightness), reported live
     as "i cannot read these buttons". Same black-on-fill pattern every
     other solid CTA on the site already uses (BUY N0W, CANCEL/OFFER
     hover, etc). */
  .action-btn.offer-confirm-xaman-btn{ background:var(--pigeon-purple); border-color:var(--pigeon-purple); color:#000; }
  .action-btn.offer-confirm-xaman-btn:hover{ background:var(--magenta); border-color:var(--magenta); color:#000; }
  /* ---- BUY $P!GE0NS swap panel — a transaction window, not a generic
     trading widget: same purple $PIGEONS theme as the trustline banner/
     detail-screen listing box, same .sw-panel card + .detail-field/
     .node-eyebrow conventions every other confirm screen already uses. */
  /* BUY $P!GE0NS popup's own panel — a bit wider than the default
     .offer-confirm-panel (440px) since it carries a real quote's worth of
     fields, not just a one-line amount. */
  .buyswap-modal-panel{ width:min(540px, 100%); padding:2.25rem 2rem; text-align:left; }
  .buyswap-modal-panel .node-eyebrow{ text-align:center; }
  .buyswap-modal-panel .receipt-badge,
  .buyswap-modal-panel .receipt-status-line{ text-align:center; }
  .buyswap-modal-panel .tx-review-title{ text-align:center; }
  .buyswap-modal-panel .detail-actions{ justify-content:center; }
  .buyswap-modal-panel .receipt-price-row{ text-align:center; }
  /* RESULT state — the exciting "you just bought $PIGEONS" receipt, not a
     dense field list. Big green number (matches every other real $PIGEONS
     amount on the site — greenNum), a plain-english unit underneath it
     instead of baked into the same line, and V!EW TRANSACT!0N as its own
     small dark-blue link instead of a raw 64-char tx hash. */
  .buyswap-received-value{ font-size:40px; }
  .buyswap-received-unit{ display:block; font-size:13px; font-weight:400; letter-spacing:0.15em; color:var(--grey-dim); text-transform:uppercase; margin-top:0.35rem; }
  .buyswap-tx-link{
    display:block;
    text-align:center;
    margin-top:1.25rem;
    font-size:12px;
    letter-spacing:0.1em;
    color:var(--cyan);
    text-decoration:underline;
    text-transform:uppercase;
  }
  .buyswap-tx-link:hover{ color:var(--white); }
  .buyswap-row{ max-width:100%; margin:0 auto; }
  .buyswap-label{ display:block; text-align:center; font-size:11px; letter-spacing:0.2em; color:var(--grey-dim); text-transform:uppercase; margin-bottom:0.5rem; }
  .buyswap-input-wrap{
    display:flex;
    align-items:center;
    justify-content:center;
    gap:0.6rem;
    background:#000;
    border:1px solid var(--pigeon-purple-dim);
    border-radius:var(--radius);
    padding:0.9rem 1rem;
  }
  .buyswap-input{
    flex:1 1 auto;
    min-width:0;
    background:transparent;
    border:none;
    outline:none;
    color:var(--white);
    font-family:var(--font-mono);
    font-size:22px;
    font-weight:700;
    letter-spacing:0.02em;
    text-align:center;
  }
  .buyswap-input::placeholder{ color:var(--grey-disabled); }
  .buyswap-input-wrap:focus-within{ border-color:var(--pigeon-purple); box-shadow:0 0 0 1px var(--pigeon-purple-dim); }
  .buyswap-unit{ flex:0 0 auto; font-size:13px; letter-spacing:0.08em; color:var(--grey-dim); text-transform:uppercase; }
  .buyswap-max-line{ text-align:center; font-size:11px; letter-spacing:0.05em; color:var(--grey-dim); margin-top:0.5rem; text-transform:uppercase; }
  .buyswap-input-error{ text-align:center; font-size:11px; letter-spacing:0.03em; color:var(--magenta); text-shadow:0 0 5px var(--magenta-glow); margin-top:0.5rem; }
  .buyswap-arrow{ text-align:center; font-size:22px; color:var(--pigeon-purple); text-shadow:0 0 6px var(--pigeon-purple-glow); margin:0.9rem 0; }
  .buyswap-receive-wrap{ border-color:var(--border-mid); }
  .buyswap-receive-value{ flex:1 1 auto; min-width:0; font-family:var(--font-mono); font-size:22px; font-weight:700; letter-spacing:0.02em; color:var(--grey-dim); text-align:center; }
  .buyswap-divider{ border-top:1px dashed var(--border-dim); margin:1.25rem 0; }
  /* ---- transaction-review title + plain-English summary — every
     confirm screen shows the raw XRPL TransactionType up top now
     (.tx-type-badge under the existing descriptive eyebrow, or as the
     full title on BUY $P!GE0NS's own review screen), so what's about to
     be signed is legible before Xaman ever opens. */
  .tx-type-badge{
    text-align:center;
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:0.15em;
    color:var(--grey-dim);
    text-transform:uppercase;
    margin:-0.9rem 0 1.1rem;
  }
  .tx-review-title{
    text-align:center;
    font-family:var(--font-display);
    font-weight:700;
    font-size:19px;
    letter-spacing:0.05em;
    color:var(--white);
    text-shadow:0 0 8px var(--pigeon-purple-glow);
    margin-bottom:1.4rem;
    text-transform:uppercase;
  }
  .tx-summary{
    font-family:var(--font-body);
    font-size:14px;
    line-height:1.75;
    letter-spacing:0.01em;
    color:var(--grey);
    text-align:center;
    text-transform:none;
    max-width:420px;
    margin:0 auto 1.4rem;
  }
  .tx-summary .tx-val{
    color:var(--white);
    font-weight:700;
  }
  .tx-summary .tx-val-addr{
    font-family:var(--font-mono);
    font-size:12px;
    font-weight:400;
    word-break:break-all;
  }
  /* Trustline gate (STAGE 4) — reuses the trustline banner's own issuer+
     COPY treatment (.pigeons-bar-sublabel/.pigeons-bar-copy-btn), just
     recentered for this card instead of the banner's own left-aligned
     row, plus a magenta alert title since this is blocking, not neutral
     info. */
  .buyswap-trustline-warning{
    border:1px solid var(--magenta-dim);
    border-radius:var(--radius);
    background:var(--magenta-faint);
    padding:1rem;
    margin-bottom:1.25rem;
    text-align:center;
  }
  .buyswap-trustline-warning-title{ font-size:13px; letter-spacing:0.1em; color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); text-transform:uppercase; margin-bottom:0.6rem; }
  .buyswap-trustline-issuer-row{ justify-content:center; gap:0; }
  .detail-traits-title{
    text-align:center;
    font-size:11px;
    letter-spacing:0.2em;
    color:var(--grey);
    margin:1.25rem 0 0.75rem;
    text-transform:uppercase;
  }
  .trait-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));
    gap:0.6rem;
    max-width:560px;
    margin:0 auto 0.5rem;
  }
  .trait-cell{ border:1px solid var(--border-dim); padding:0.6rem 0.75rem; text-align:center; cursor:pointer; border-radius:var(--radius); transition:border-color 0.15s ease, background 0.15s ease; }
  .trait-cell:hover{ background:var(--cyan-faint); border-color:var(--cyan-dim); }
  .trait-cell .tc-label{ font-size:9px; letter-spacing:0.15em; color:var(--grey-dim); margin-bottom:0.35rem; text-transform:uppercase; }
  .trait-cell .tc-value{ font-size:13px; letter-spacing:0.03em; color:var(--white); }
  .trait-cell .tc-sub{ font-size:9px; letter-spacing:0.06em; color:var(--grey); margin-top:0.3rem; text-transform:uppercase; }
  .tech-meta-title{ text-align:center; font-size:10px; letter-spacing:0.2em; color:var(--grey-dim); margin-bottom:0.6rem; text-transform:uppercase; }
  .listings-block{ max-width:460px; margin:1.25rem auto 0; }
  .listing-row{
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:0.6rem;
    padding:0.5em 0.6em;
    border:1px solid var(--border-mid);
    margin-bottom:0.5rem;
    font-size:12px;
    letter-spacing:0.03em;
    border-radius:var(--radius);
  }
  .listing-market{ color:var(--grey-dim); text-transform:uppercase; letter-spacing:0.1em; font-size:10px; }
  .listing-price{ color:var(--white); }
  .offer-fee-breakdown{ font-size:9.5px; letter-spacing:0.05em; color:var(--grey-dim); text-transform:uppercase; }
  .listing-buy{
    background:transparent;
    border:1px solid var(--cyan-dim);
    color:var(--cyan);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:0.1em;
    padding:0.35em 0.7em;
    cursor:pointer;
    text-transform:uppercase;
    text-decoration:none;
    border-radius:var(--radius);
    transition:background 0.15s ease;
  }
  .listing-buy:hover{ background:var(--cyan-faint); }
  /* $PIGEONS marketplace listing — a clean stacked block (price on its
     own line, then a big real BUY action below it) instead of a cramped
     icon+price+small-button row. No coin thumbnail here — the price text
     itself already reads as a $PIGEONS amount (fmtPigeons appends the
     unit), the icon was just visual noise crowding the price. */
  .scylla-listing-block{ max-width:460px; margin:1.25rem auto 0; }
  .scylla-listing-row{
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:0.6rem;
    padding:0.75em 0.6em;
    border:1px solid var(--magenta-dim);
    margin-bottom:0.5rem;
    border-radius:var(--radius);
    background:rgba(255,63,208,0.05);
  }
  /* Not-listed state has no price/buy-button pairing to justify the
     boxed currency-amount look — just plain centred text instead. */
  .scylla-listing-row.not-listed{ border:none; background:none; padding:0.5em 0.6em; }
  .scylla-listing-price{ font-size:15px; font-weight:700; letter-spacing:0.02em; color:var(--magenta); text-shadow:0 0 5px var(--magenta-glow); }
  /* Same green "real, clickable buy action" language + size as the
     DATABASE grid's own .thumb-buy-btn — this is the real $PIGEONS
     purchase, it should read like the most important thing in the box,
     not a small outline pill next to the price. */
  .scylla-buy-btn{
    width:100%;
    background:rgba(0,0,0,0.25);
    border:1px solid var(--green);
    color:var(--green);
    text-shadow:0 0 5px var(--green-glow);
    font-family:var(--font-mono);
    font-weight:700;
    font-size:16px;
    letter-spacing:0.05em;
    padding:0.95em 0.8em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:background 0.15s ease, color 0.15s ease;
  }
  .scylla-buy-btn:hover{ background:var(--green); color:#000; text-shadow:none; }
  /* Same box, YOUR OWN listing — CANCEL takes over BUY N0W's slot, so it
     should fill the row the same way instead of shrink-wrapping to a
     small centred pill. */
  .scylla-listing-row #detailScyllaDelistBtn{ width:100%; }
  .detail-history{ max-width:560px; margin:1.25rem auto 0; border-top:1px dashed var(--border-dim); padding-top:1rem; }
  .dh-row{
    padding:0.7em 0.3em;
    border-bottom:1px solid var(--border-dim);
  }
  .dh-row:last-child{ border-bottom:none; }
  .dh-line{ font-size:12px; letter-spacing:0.02em; color:var(--grey); margin-bottom:0.35em; }
  .dh-verb{ color:var(--cyan); text-shadow:0 0 4px var(--cyan-glow); text-transform:uppercase; font-weight:700; }
  .dh-price{ color:var(--white); }
  .dh-line a{ color:var(--white); text-decoration:underline; }
  .dh-line a:hover{ color:var(--cyan); }
  .dh-meta{ display:flex; align-items:center; justify-content:space-between; gap:0.6rem; }
  .dh-time{ color:var(--grey-dim); font-size:10px; letter-spacing:0.05em; text-transform:uppercase; }
  .dh-tx{ color:var(--grey-dim); font-size:10px; letter-spacing:0.06em; text-decoration:none; text-transform:uppercase; }
  .dh-tx:hover{ color:var(--cyan); text-decoration:underline; }
  .detail-actions{ display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap; margin-top:1.5rem; }
  .secondary-btn{
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-family:var(--font-mono);
    font-size:12px;
    letter-spacing:0.1em;
    padding:0.75em 1.4em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .secondary-btn:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  /* Detail screen's own BACK — a full-width strip, the very last thing on
     the page, not a trait-grid cell any more. Full width of the same
     content column the $PIGEONS L!ST!NG/N0T L!STED box sits in, so its
     left/right edges line up with that box's instead of just filling
     whatever room a trait grid cell left over. */
  #screenDetail .detail-back-btn{
    display:flex;
    align-items:center;
    justify-content:center;
    width:100%;
    margin:0.85rem 0 0;
    padding:0.75em 1.4em;
    font-family:var(--font-mono);
    font-size:16px;
    font-weight:700;
    letter-spacing:0.08em;
    color:var(--cyan);
    background:transparent;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    cursor:pointer;
    appearance:none;
    transition:border-color 0.15s ease, background 0.15s ease;
  }
  #screenDetail .detail-back-btn:hover{ background:var(--cyan-faint); border-color:var(--cyan-dim); }
  .action-btn{
    background:transparent;
    border:1px solid var(--cyan-dim);
    color:var(--cyan);
    font-family:var(--font-mono);
    font-weight:700;
    font-size:15px;
    letter-spacing:0.04em;
    padding:0.85em 1.4em;
    cursor:pointer;
    text-transform:uppercase;
    border-radius:var(--radius);
    transition:background 0.15s ease, border-color 0.15s ease;
  }
  .action-btn:hover{ background:var(--cyan-faint); border-color:var(--cyan); }
  .action-btn.selected{ background:var(--magenta-faint); color:var(--magenta); border-color:var(--magenta); text-shadow:0 0 7px var(--magenta-glow); animation:flicker-in 0.3s ease-out; }
  /* Clearly unavailable, not just a plain button that happens to do
     nothing — dimmed, no hover reaction, no-drop cursor. */
  .action-btn:disabled{ opacity:0.4; cursor:not-allowed; text-shadow:none; }
  .action-btn:disabled:hover{ background:transparent; border-color:var(--cyan-dim); }

  /* ---- target assets sticky bar — SCYLLA / MAGENTA ---- */
  .target-bar{
    position:fixed;
    left:50%;
    bottom:0;
    transform:translateX(-50%);
    z-index:40;
    width:min(960px, 100%);
    background:var(--panel-bg-solid);
    border-top:1px solid var(--magenta);
    box-shadow:0 -4px 20px rgba(0,0,0,0.55), 0 -1px 14px rgba(255,63,208,0.15);
    padding:0.75rem 1.25rem;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:1rem;
    cursor:pointer;
  }
  .target-bar .tb-label{ font-size:12px; letter-spacing:0.1em; color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); text-transform:uppercase; }
  .target-bar .tb-toggle{ font-size:11px; color:var(--grey); text-transform:uppercase; }

  /* ---- YOUR OFFER bundle builder — compact, lives inside the existing
     wallet-identity panel rather than as its own large panel ---- */
  .offer-builder-bar{
    margin-top:1.1rem;
    padding-top:1.1rem;
    border-top:1px dashed var(--border-mid);
    text-align:center;
  }
  .ob-eyebrow{ font-size:11px; letter-spacing:0.2em; color:var(--magenta); text-shadow:0 0 6px var(--magenta-glow); text-transform:uppercase; margin-bottom:0.75rem; }
  .ob-pile{ display:flex; justify-content:center; align-items:center; }
  .ob-slot{
    position:relative;
    width:3.4em;
    height:3.4em;
    border-radius:var(--radius);
    overflow:hidden;
    flex-shrink:0;
    box-shadow:0 2px 8px rgba(0,0,0,0.5);
    transition:transform 0.15s ease, z-index 0s;
  }
  .ob-slot + .ob-slot{ margin-left:-1.1em; }
  .ob-pile:hover .ob-slot{ transform:translateX(0); }
  .ob-slot img{ width:100%; height:100%; object-fit:cover; display:block; }
  .ob-slot.filled{ border:2px solid var(--magenta); cursor:pointer; }
  .ob-slot.filled:hover{ transform:translateY(-0.25em); z-index:5; box-shadow:0 6px 14px rgba(0,0,0,0.6), 0 0 12px rgba(255,63,208,0.3); }
  .ob-slot.filled:hover .ob-slot-remove{ opacity:1; }
  .ob-slot-remove{
    position:absolute;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    background:rgba(8,9,11,0.72);
    color:var(--white);
    font-size:18px;
    opacity:0;
    transition:opacity 0.15s ease;
  }
  .ob-slot.empty{
    border:1px dashed var(--border-mid);
    background:rgba(255,255,255,0.02);
    display:flex;
    align-items:center;
    justify-content:center;
    color:var(--grey-dim);
    font-size:16px;
    cursor:pointer;
  }
  .ob-slot.empty:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  .ob-count{ margin-top:0.75rem; font-size:11px; letter-spacing:0.15em; color:var(--grey); text-transform:uppercase; }
  .ob-submit{ margin-top:0.9rem; }
  .ob-submit:disabled{ opacity:0.35; cursor:not-allowed; }
  .ob-submit:disabled:hover{ background:transparent; border-color:var(--cyan-dim); }
  .card-select-toggle.at-cap{ opacity:0.35; cursor:not-allowed; }

  /* ---- CREATE AN OFFER — persistent trade builder on DATABASE ---- */
  .trade-box{ text-align:center; padding:0.9rem 0; }
  .trade-box + .swap-review-divider{ margin:0; }

  /* ---- SWAP REVIEW — both sides, reusing the same pile look ---- */
  .swap-review-side{ max-width:420px; margin:1.1rem auto 0; text-align:center; }
  .swap-review-side .ob-pile{ margin-top:0.75rem; }
  .swap-review-divider{ text-align:center; font-size:20px; color:var(--magenta); text-shadow:0 0 8px var(--magenta-glow); margin:0.6rem 0; }
  .review-pile .ob-slot{ cursor:default; }
  .review-pile .ob-slot.filled:hover{ transform:none; box-shadow:0 2px 8px rgba(0,0,0,0.5); }
  .review-pile .ob-slot-remove{ display:none; }

  /* ---- CREATE OFFER (V1, PλWS tab) — single-slot version of the
     trade-box/ob-eyebrow look above, own markup since a real thumbnail +
     number needs more room than the small stacked .ob-slot circles were
     built for. ---- */
  .simple-offer-row{ display:flex; align-items:center; justify-content:center; gap:1.25rem; flex-wrap:wrap; }
  .simple-offer-box{ flex:0 0 auto; width:150px; padding:0; }
  .simple-offer-select-btn{
    width:100%;
    aspect-ratio:1;
    background:rgba(255,255,255,0.02);
    border:1px dashed var(--border-mid);
    border-radius:var(--radius);
    color:var(--grey-dim);
    font-family:var(--font-mono);
    font-size:13px;
    letter-spacing:0.05em;
    cursor:pointer;
    transition:border-color 0.15s ease, color 0.15s ease;
  }
  .simple-offer-select-btn:hover{ border-color:var(--cyan-dim); color:var(--cyan); }
  .simple-offer-filled{
    position:relative;
    cursor:pointer;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    overflow:hidden;
    transition:border-color 0.15s ease;
  }
  .simple-offer-filled:hover{ border-color:var(--magenta-dim); }
  .simple-offer-thumb{ aspect-ratio:1; background:#000; }
  .simple-offer-thumb img{ width:100%; height:100%; object-fit:cover; display:block; }
  .simple-offer-num{
    padding:0.5em 0.3em;
    font-size:11px;
    letter-spacing:0.04em;
    color:var(--white);
    text-align:center;
    background:var(--panel-bg-solid);
  }
  .simple-offer-clear{
    position:absolute;
    top:0.35em;
    right:0.35em;
    width:1.7em;
    height:1.7em;
    line-height:1.7em;
    padding:0;
    background:rgba(8,9,11,0.75);
    border:1px solid var(--magenta-dim);
    color:var(--magenta);
    font-size:13px;
    border-radius:var(--radius);
    cursor:pointer;
  }
  .simple-offer-clear:hover{ background:var(--magenta-faint); }
  .simple-offer-actions{ text-align:center; margin-top:1.25rem; }
  #simpleOfferPanel .index-line{ margin-top:0.6rem; }

  /* ---- CREATE OFFER's Pigeon picker modal — same fixed/inset overlay
     pattern as #detailLightbox, with a bordered content panel + thumbnail
     grid instead of a single fullscreen image. ---- */
  #simpleOfferPickerModal{
    display:none;
    position:fixed;
    inset:0;
    z-index:1000;
    background:rgba(5,5,6,0.88);
    align-items:center;
    justify-content:center;
    padding:2rem 1rem;
  }
  .simple-picker-panel{
    width:min(800px, 100%);
    max-height:88vh;
    display:flex;
    flex-direction:column;
    background:var(--panel-bg-solid);
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    box-shadow:0 10px 30px rgba(0,0,0,0.6);
    padding:1.25rem;
  }
  .simple-picker-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:1rem; }
  .simple-picker-title{ font-size:13px; letter-spacing:0.15em; color:var(--white); text-transform:uppercase; }
  .simple-picker-close{
    width:2em;
    height:2em;
    background:transparent;
    border:1px solid var(--border-mid);
    color:var(--grey);
    font-size:16px;
    border-radius:var(--radius);
    cursor:pointer;
  }
  .simple-picker-close:hover{ border-color:var(--magenta-dim); color:var(--magenta); }

  /* ---- Shared L!ST/0FFER/TRANSFER popup — same overlay/panel pattern
     as #simpleOfferPickerModal above, just a single input+button instead
     of a thumbnail grid. One instance, re-labelled per use (see
     openAmountEntryModal) instead of three separate inline forms — the
     inline number/wallet boxes that used to sit directly on every card
     are gone; this is the one place that number now gets typed. ---- */
  #amountEntryModal{
    display:none;
    position:fixed;
    inset:0;
    z-index:1000;
    background:rgba(5,5,6,0.88);
    align-items:center;
    justify-content:center;
    padding:2rem 1rem;
  }
  .amount-entry-panel{
    width:min(540px, 100%);
    background:var(--panel-bg-solid);
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    box-shadow:0 10px 30px rgba(0,0,0,0.6);
    padding:2.25rem;
    font-size:1.08em;
  }
  /* .thumb-offer.amount-entry-mode — this shares the .thumb-offer class
     with the DATABASE card's own purple action box, which an earlier fix
     made a row-direction flex container (centers BUY N0W/0FFER together
     regardless of state — see its own comment). That same change turned
     THIS popup into a horizontal row too, squeezing the pigeon thumb,
     balance line, amount input, submit button, and duration row all onto
     one line — confirmed live, exactly the "all horizontal" complaint.
     .amount-entry-mode is already a second class applied everywhere this
     needs to actually stack vertically instead, so scoping the override
     to the combination fixes the popup without touching the card. */
  .thumb-offer.amount-entry-mode{ display:block; }
  .amount-entry-mode .thumb-offer-row{ align-items:stretch; }
  .amount-entry-mode .make-offer-input-wrap{ margin-bottom:0; }
  /* Which Pigeon 0FFER AM0UNT is actually for, and the wallet's own live
     $PIGEONS balance — both easy to lose track of once the card underneath
     the popup isn't visible any more, so both are big, not fine print. */
  /* Bigger, and stacked (image above the number) rather than a small
     thumb sitting beside small text — this is the one thing that shows
     you what you're actually about to offer real money on, so it needs
     to actually be visible, not a 56px afterthought next to the title. */
  .amount-entry-pigeon-row{ display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.6rem; margin-bottom:1.5rem; }
  .amount-entry-pigeon-thumb{ width:140px; height:140px; border-radius:var(--radius); border:1px solid var(--border-mid); object-fit:cover; flex:0 0 auto; }
  .amount-entry-pigeon-num{ font-family:var(--font-display); font-weight:700; font-size:36px; color:#fff; }
  .make-offer-balance-line{
    text-align:center;
    font-family:var(--font-mono);
    font-size:13px;
    letter-spacing:0.08em;
    color:var(--grey-dim);
    text-transform:uppercase;
    margin-bottom:1.25rem;
    line-height:1.6;
  }
  .make-offer-balance-line .pigeons-green-num{ font-size:24px; font-weight:700; }
  .transfer-wallet-input{
    flex:1 1 auto;
    min-width:0;
    background:rgba(8,9,11,0.6);
    border:1px solid rgba(255,255,255,0.6);
    color:var(--white);
    font-family:var(--font-mono);
    font-size:13px;
    font-weight:700;
    padding:0.65em 0.75em;
    border-radius:var(--radius);
  }
  .transfer-wallet-input:focus{ outline:none; border-color:#fff; }
  .transfer-wallet-input::placeholder{ color:rgba(255,255,255,0.5); }
  /* Fixed scroll height (not just overflow:auto with no bound) — 4 across,
     tall enough to read each thumbnail clearly, scrolling down through
     the rest rather than the whole modal growing past the viewport. */
  .simple-picker-grid{
    overflow-y:auto;
    max-height:min(58vh, 640px);
    display:grid;
    grid-template-columns:repeat(4, 1fr);
    gap:1rem;
    padding-right:0.4rem;
  }
  @media (max-width:640px){ .simple-picker-grid{ grid-template-columns:repeat(2, 1fr); } }
  .simple-picker-card{
    background:transparent;
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    overflow:hidden;
    padding:0;
    text-align:center;
    transition:border-color 0.15s ease;
  }
  .simple-picker-card:hover{ border-color:var(--cyan-dim); }
  .simple-picker-card-img{ aspect-ratio:1; background:#000; cursor:pointer; }
  .simple-picker-card-img img{ width:100%; height:100%; object-fit:cover; display:block; }
  .simple-picker-card-num{ padding:0.5em 0.2em 0.3em; font-size:12px; letter-spacing:0.03em; color:var(--white); }
  .simple-picker-view-btn{
    display:block;
    width:100%;
    background:transparent;
    border:none;
    border-top:1px solid var(--border-dim);
    color:var(--grey-dim);
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:0.08em;
    padding:0.5em 0;
    cursor:pointer;
    transition:color 0.15s ease, background 0.15s ease;
  }
  .simple-picker-view-btn:hover{ color:var(--cyan); background:var(--cyan-faint); }
  /* PR0F!LE's own pfp picker reuses .simple-picker-grid's card styling but
     isn't inside a fixed-height modal (like OFFER F0R's own picker, which
     .simple-picker-grid's overflow-y/max-height above exist for) — it's
     just part of the normal page. Reported live as "two scroll wheels" —
     this box scrolling on its own, inside the whole page also scrolling.
     Drops the internal scroll entirely so the grid just grows with the
     page like everything else on PR0F!LE. */
  #profilePfpGrid{ overflow-y:visible; max-height:none; }
  /* Reported live as wanting PR0F!LE to "feel interactive" — a stronger
     hover lift/glow (not just a border colour swap) and an immediate
     picking state the instant you click, rather than the grid just
     sitting still until the save request happens to finish. */
  #profilePfpGrid .simple-picker-card{ cursor:pointer; transition:border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease; }
  #profilePfpGrid .simple-picker-card:hover{ border-color:var(--green); transform:translateY(-3px); box-shadow:0 0 14px var(--green-glow); }
  #profilePfpGrid .simple-picker-card-selected{ border-color:var(--green); box-shadow:0 0 0 2px var(--green), 0 0 16px var(--green-glow); }
  #profilePfpGrid .simple-picker-card-picking{ opacity:0.6; pointer-events:none; }
  #profilePfpGrid .simple-picker-card-picking .simple-picker-card-num::after{ content:' :: SETT!NG...'; color:var(--green); }
  .swap-nonatomic-note{
    max-width:520px;
    margin:0 auto 1.25rem;
    padding:0.75em 1em;
    border:1px dashed var(--magenta-dim);
    background:var(--magenta-faint);
    color:var(--magenta);
    text-shadow:none;
    font-size:11px;
    line-height:1.6;
    text-transform:none;
  }

  /* ---- target summary / offer placeholder ---- */
  .target-summary-block{ max-width:480px; margin:0 auto; text-align:center; }
  .ts-label{ font-size:10px; letter-spacing:0.2em; color:var(--grey-dim); margin:1.1rem 0 0.4rem; text-transform:uppercase; }
  .ts-label:first-child{ margin-top:0; }
  .ts-value{ font-family:var(--font-body); font-size:13px; color:var(--white); line-height:1.7; }
  .ts-count{
    margin-top:1rem;
    font-size:12px;
    letter-spacing:0.15em;
    color:var(--magenta);
    text-shadow:0 0 6px var(--magenta-glow);
    text-transform:uppercase;
  }
  .placeholder-card{
    border:1px dashed var(--border-mid);
    border-radius:var(--radius);
    padding:1.75rem;
    text-align:center;
    max-width:440px;
    margin:1.5rem auto 0;
  }
  .placeholder-card .pc-title{ font-size:12px; letter-spacing:0.2em; color:var(--grey); margin-bottom:0.75rem; text-transform:uppercase; }
  .placeholder-card .pc-body{ font-family:var(--font-body); font-size:11.5px; letter-spacing:0.01em; color:var(--grey); line-height:1.7; text-transform:none; }

  /* MA!NFRAME — a real landing page shown before DATABASE, pick a
     collection to enter. Full-screen overlay (same z-index/position
     pattern every confirm modal on this page already uses) rather than a
     showTab name, since it sits BEFORE any tab exists to switch to. The
     h1's own "STAT!C :: MA!NFRAME" sub-label (see #mainframeReopenLabel)
     is the way back in, matching the site's existing branding instead of
     adding new chrome for it. */
  /* One static screen, genuinely never scrolls (reported live as wanting
     this) — height:100dvh + overflow:hidden, flex column so the header
     takes only what it needs and the carousel absorbs whatever's left,
     regardless of viewport height. 100dvh over 100vh: on mobile Safari/
     Chrome, 100vh includes the space the address bar temporarily covers,
     which would make this taller than the ACTUAL visible viewport and
     force exactly the scroll this is meant to never have; 100dvh tracks
     the real visible area. display is toggled to 'flex' (not 'block') in
     the script wherever this shows. */
  #screenMainframe{
    display:none;
    position:fixed;
    inset:0;
    z-index:2000;
    /* Opaque (var(--bg)), same as #screenDetail's own identical situation
       (see its own comment) — plain transparent here doesn't reveal just
       #staticBg, it reveals the ENTIRE real page sitting behind this
       screen (the DATABASE view, trustline banner, tabs — all of it, just
       display:none's own children stay hidden, the page itself doesn't),
       confirmed live as a ghosted double-exposure of both screens at
       once. Opaque instead, with its own local TV-static canvas
       (#mainframeStaticBg, .local-static-bg) + scanline layer
       (::after below) — an exact copy of the page's own recipe, not a
       window into it, same reasoning #screenDetail/#detailLightbox
       already settled on. */
    background:var(--bg);
    overflow:hidden;
    height:100vh;
    height:100dvh;
    padding:2rem 1.5rem;
    flex-direction:column;
  }
  /* A faint, slow-drifting glow behind everything — the same trick as
     .pigeons-bar-thumb's own accent gradient, just huge and centred
     instead of boxed, so the very first screen anyone lands on reads as
     alive rather than a flat black page with three boxes on it. Pure
     decoration: fixed behind the grid, never intercepts clicks. Negative
     z-index — paints above the opaque background + local static canvas
     (both z-index:-1 too) but still behind the screen's real content. */
  #screenMainframe::before{
    content:'';
    position:fixed;
    inset:0;
    z-index:-1;
    pointer-events:none;
    background:
      radial-gradient(ellipse 900px 500px at 20% -10%, rgba(136,72,248,0.16), transparent 60%),
      radial-gradient(ellipse 900px 500px at 85% 10%, rgba(52,255,133,0.10), transparent 60%);
  }
  /* CRT scanline layer — exact copy of body::before's own recipe, see
     #screenDetail::before for the same pattern already established. */
  #screenMainframe::after{
    content:'';
    position:fixed;
    inset:0;
    z-index:-1;
    pointer-events:none;
    background:repeating-linear-gradient(
      to bottom,
      rgba(255,255,255,0.018) 0px,
      rgba(255,255,255,0.018) 1px,
      transparent 1px,
      transparent 3px
    );
    mix-blend-mode:overlay;
  }
  #screenMainframe > .local-static-bg{ z-index:-1; }
  #screenMainframe > *:not(.local-static-bg):not(.mainframe-profile-btn){ position:relative; z-index:1; }
  /* Header shrinks to its own content — flex:0 0 auto keeps it from
     eating into the carousel's space, and its own H1 is capped much
     smaller than the persistent page's (up to 104px there) specifically
     here, so the whole screen reliably fits with zero scroll on a short
     window too, not just a tall one. */
  #screenMainframe > h1{ flex:0 0 auto; font-size:clamp(30px, 6.5vw, 78px); margin-bottom:0.2rem; }
  .mainframe-subtitle{
    position:relative;
    flex:0 0 auto;
    text-align:center;
    font-size:12px;
    letter-spacing:0.25em;
    color:var(--grey);
    text-transform:uppercase;
    margin:0.75rem 0 1.25rem;
    padding-bottom:0.75rem;
  }
  /* Same glowing-underline device as SH0W!NG Y0UR P!GE0NS' own title
     (.search-panel-title-flock) — ties this landing screen visually to
     the rest of the site's language instead of inventing a new one. */
  .mainframe-subtitle::after{
    content:''; position:absolute; left:50%; bottom:0; transform:translateX(-50%);
    width:64px; height:2px; background:linear-gradient(90deg, transparent, var(--cyan), transparent);
    box-shadow:0 0 8px var(--cyan-glow);
  }
  /* ---- All 6 cards fit on one screen at once now (no carousel/arrows
     for now — see mainframeArrowPrev/Next's display:none below) — a real
     3-column x 2-row grid instead of a horizontally-scrolling row, so
     every card is visible without scrolling or clicking through. flex:1 1
     auto + min-height:0 is what actually lets this fill "whatever's left"
     of the screen's own height instead of pushing it taller than the
     viewport (min-height:0 is the same flex-child shrink gotcha this file
     already documents elsewhere — a flex item defaults to min-height:auto,
     which refuses to shrink below its content's natural size no matter
     what flex:1 says). ---- */
  .mainframe-carousel-wrap{
    position:relative;
    flex:1 1 auto;
    min-height:0;
    display:flex;
    align-items:stretch;
  }
  .mainframe-grid{
    display:grid;
    grid-template-columns:repeat(3, 1fr);
    grid-template-rows:repeat(2, 1fr);
    gap:1.25rem;
    width:100%;
    height:100%;
    padding:0 1rem;
  }
  .mainframe-card{
    min-width:0;
    min-height:0;
    height:100%;
    display:flex;
    flex-direction:column;
    background:var(--panel-bg-solid);
    border:1px solid var(--border-mid);
    border-radius:var(--radius);
    padding:0;
    overflow:hidden;
    text-align:center;
    cursor:pointer;
    transition:border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  }
  @media (max-width:760px){
    /* 2 columns x 3 rows on narrow screens — 3 columns of real cards
       never fit legibly at phone width, and this still shows all 6 with
       no scrolling/arrows needed, same as desktop. */
    .mainframe-grid{ grid-template-columns:repeat(2, 1fr); grid-template-rows:repeat(3, 1fr); gap:0.75rem; padding:0 0.5rem; }
  }
  /* --card-accent (set per card in the HTML, e.g. "136,72,248" for
     $PIGEONS' real purple) drives the art overlay + hover glow — same
     r,g,b-triplet convention --collection-accent-rgb already uses
     elsewhere, so a future collection just needs its own accent here,
     nothing structural changes. */
  .mainframe-card:hover{
    border-color:rgba(var(--card-accent, 61,243,236), 0.8);
    transform:translateY(-4px);
    box-shadow:0 12px 32px rgba(0,0,0,0.5), 0 0 24px rgba(var(--card-accent, 61,243,236), 0.35);
  }
  /* The collection's own artwork — a real photo/logo dropped in under
     /assets/mainframe/ (see mainframe-card-art's background-image,
     per-card in the HTML), with a bottom gradient in that same accent
     colour so the label/tag underneath stay readable over any image
     without a separate dark strip breaking the art. Until real art is in
     place for a card, the gradient alone still reads fine as a coloured
     tile — never a blank/broken-image box. flex:1 1 auto (not a fixed
     height like this used to be) — the art fills however much vertical
     room the card actually has now that cards are as tall as the whole
     carousel, not a fixed small thumbnail strip. */
  .mainframe-card-art{
    flex:1 1 auto;
    min-height:60px;
    background-size:cover;
    /* Cards are much shorter now (3x2 grid, not a full-height carousel
       card) — plain center crops most character art around the torso/
       logo text instead of the face, so default to the top of the image
       (where each collection's mascot head sits) unless a collection
       needs its own tuned offset, same as $P!GE0NS' own override below. */
    background-position:center top;
    background-color:rgba(var(--card-accent, 61,243,236), 0.14);
    background-image:linear-gradient(180deg, rgba(var(--card-accent, 61,243,236),0.08) 0%, rgba(6,6,7,0.92) 100%), var(--card-art, none);
    border-bottom:1px solid rgba(var(--card-accent, 61,243,236), 0.35);
    transition:transform 0.4s ease;
  }
  .mainframe-card:hover .mainframe-card-art{ transform:scale(1.05); }
  /* Per-collection crop offsets, tuned live against each card's actual
     art so only the character's head shows (not the text logo above it
     or the shoulders/body below) — same idea as $SEAL/$TEDDY below,
     confirmed live as the reference "perfect" crop to match. */
  .mainframe-card[data-collection="pigeons"] .mainframe-card-art{ background-position:center 40%; }
  .mainframe-card[data-collection="phnixs"] .mainframe-card-art{ background-position:center 38%; }
  .mainframe-card-teddy .mainframe-card-art{ background-position:center 30%; }
  /* $SEAL's own art is a square image with the face sitting roughly
     mid-height (starry sky above it) — plain top crop showed almost
     nothing but sky. Confirmed live as the reference "perfect" crop. */
  .mainframe-card-seal .mainframe-card-art{ background-position:center 40%; }
  .mainframe-card-fuzzy .mainframe-card-art{ background-position:center 45%; }
  .mainframe-card-conspiracy .mainframe-card-art{ background-position:center 45%; }
  /* Cards are much shorter now (3x2 grid, not a full-height carousel
     card) — body padding/spacing tightened throughout so the art above
     it keeps a real, visible chunk of the card instead of getting
     squeezed to a sliver by six lines of body content. */
  .mainframe-card-body{ flex:0 0 auto; padding:0.65rem 1rem 0.85rem; }
  .mainframe-card-label{ font-family:var(--font-display); font-size:clamp(18px, 1.8vw, 24px); font-weight:700; color:#fff; letter-spacing:0.02em; }
  /* Real, live numbers (items/holders/volume — see the stats fetch loop),
     not decorative — the whole point of showing them right here is
     proving "this is a real, active market" before you've even picked a
     collection. Blank (not a placeholder like "…") until they land, and
     silently stays blank on a failed fetch — never worth blocking or
     erroring the very first screen of the app over a stats tile. */
  .mainframe-card-stats{
    font-family:var(--font-mono);
    font-size:10px;
    letter-spacing:0.05em;
    color:var(--grey);
    margin-top:0.3rem;
  }
  .mainframe-card-stats .hi{ color:#fff; font-weight:600; }
  .mainframe-card-tag{
    display:inline-block;
    font-size:11px;
    letter-spacing:0.12em;
    color:var(--green);
    text-transform:uppercase;
    margin-top:0.4rem;
    padding:0.3em 0.8em;
    border:1px solid rgba(52,255,133,0.4);
    border-radius:var(--radius);
    background:rgba(52,255,133,0.08);
  }
  /* A real, solid button — same treatment BUY N0W already uses on a card
     in the real DATABASE, so "buy the token" reads as the same kind of
     action there and here. display:block/width:100% — its own full-width
     row underneath the TRAD!NG L!VE tag, not squeezed inline beside it. */
  .mainframe-card-buy{
    display:block;
    width:100%;
    margin-top:0.5rem;
    background:var(--green);
    border:1px solid var(--green);
    color:#000;
    font-family:var(--font-mono);
    font-weight:700;
    font-size:14px;
    letter-spacing:0.04em;
    text-transform:uppercase;
    padding:0.55em 0.6em;
    border-radius:var(--radius);
    cursor:pointer;
    box-shadow:0 0 12px var(--green-glow);
    transition:background 0.15s ease, color 0.15s ease;
  }
  .mainframe-card-buy:hover{ background:#000; color:var(--green); }
  .mainframe-card-soon{ opacity:0.6; cursor:default; }
  .mainframe-card-soon:hover{ border-color:var(--border-mid); transform:none; box-shadow:none; }
  .mainframe-card-soon:hover .mainframe-card-art{ transform:none; }
  .mainframe-card-soon .mainframe-card-tag{ color:var(--grey-dim); border-color:var(--border-mid); background:transparent; }
  /* PREV/NEXT — not needed for now (all 6 cards fit on one screen at
     once, see .mainframe-grid's own comment), hidden rather than removed
     so they're a one-line revert if the grid ever goes back to a
     horizontally-scrolling carousel. */
  .mainframe-arrow{
    display:none;
    position:absolute;
    top:50%;
    transform:translateY(-50%);
    z-index:5;
    width:2.75em;
    height:2.75em;
    border-radius:50%;
    background:rgba(15,16,20,0.85);
    border:1px solid var(--border-mid);
    color:#fff;
    font-size:18px;
    cursor:pointer;
    align-items:center;
    justify-content:center;
    transition:border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
  }
  .mainframe-arrow:hover{ border-color:var(--cyan-dim); background:rgba(20,21,26,0.95); transform:translateY(-50%) scale(1.08); }
  .mainframe-arrow-prev{ left:0.25rem; }
  .mainframe-arrow-next{ right:0.25rem; }
  #mainframeReopenLabel{ cursor:pointer; }
  .mainframe-profile-btn{
    position:absolute;
    top:2rem; right:1.5rem;
    z-index:2;
    background:transparent;
    border:1px solid var(--magenta);
    color:var(--magenta);
    font-family:var(--font-mono);
    font-weight:700;
    font-size:16px;
    letter-spacing:0.05em;
    text-transform:uppercase;
    padding:0.9em 1.6em;
    border-radius:var(--radius);
    cursor:pointer;
    white-space:nowrap;
    text-shadow:0 0 5px var(--magenta-glow);
    box-shadow:0 0 14px var(--magenta-dim);
  }
  .mainframe-profile-btn:hover{ background:var(--magenta); color:#000; text-shadow:none; }
  @media (max-width:600px){
    .mainframe-profile-btn{ position:static; display:block; margin:0 auto 0.5rem; width:fit-content; }
  }
</style>
</head>
<body>

  <canvas id="staticBg"></canvas>

  <!-- MA!NFRAME — landing page, shown first on a plain fresh load; pick a
       collection to enter DATABASE scoped to it (see enterMainframeCollection
       in static.js). TEDDY stays browse-only (matches its own tradeable:false
       in COLLECTION_META) — clicking it still enters DATABASE, just without
       BUY N0W/0FFER/trustline available once there, same as clicking it from
       the DATABASE dropdown already does today. -->
  <div id="screenMainframe">
    <canvas class="local-static-bg" id="mainframeStaticBg"></canvas>
    <!-- MY PR0F!LE — the entry point into login + the real multi-coin
         balance view (see #profileCoinsList/renderProfileCoins), reported
         live as wanting "a place where we can login and view our
         profile" reachable right from here, not buried inside DATABASE. -->
    <button type="button" class="mainframe-profile-btn" id="mainframeProfileBtn">
      <span style="text-transform:none;">Σκύλλα</span> · MY PR0F!LE
    </button>
    <h1>Σκύλλα://S!GNAL :: <span class="title-online">0NL!NE</span><span class="h1-sub">STAT!C :: MA!NFRAME</span></h1>
    <div class="mainframe-subtitle">SELECT A C0LLECT!0N</div>
    <div class="mainframe-carousel-wrap">
      <button type="button" class="mainframe-arrow mainframe-arrow-prev" id="mainframeArrowPrev" aria-label="PREV!0US">◂</button>
      <div class="mainframe-grid" id="mainframeGrid">
        <!-- Each card's own real artwork lives at /assets/mainframe/<name>.jpeg
             (mainframe-card-art's background-image below). ?v=2 on each
             URL is a plain cache-buster — these files get overwritten
             in place at the same path/filename when art is updated
             (confirmed live: a straight overwrite left visitors with
             the OLD image for up to 4h, this asset's own real
             Cache-Control max-age, even on a fresh tab/hard navigate,
             since HTTP caching happens below any of that). Bump this
             number the next time any of these six files changes. Also
             a plain coloured tile in that same accent until a file
             genuinely doesn't exist yet, never a blank/broken-image
             box (see .mainframe-card-art's own CSS).
             A plain div, not a <button> — it needs to contain a REAL button
             of its own (mainframe-card-buy) below, and a <button> can never
             validly contain another <button> (browsers silently hoist the
             inner one out, breaking the DOM). role="button"/tabindex keep it
             keyboard/screen-reader operable the way a real button is; see
             mainframeGrid's own click+keydown handlers in the script.
             BUY $T0KEN is a real button, not just part of the tag row —
             reported live as wanting a direct path to buying each token
             right from here; for now it enters the collection the same as
             clicking the card itself, the actual straight-to-buy flow is
             the next pass. stopPropagation keeps it from also double-firing
             the card's own click. -->
        <div class="mainframe-card" data-collection="pigeons" role="button" tabindex="0" style="--card-accent:136,72,248; --card-art:url('/assets/mainframe/pigeons.jpeg?v=2');">
          <div class="mainframe-card-art"></div>
          <div class="mainframe-card-body">
            <div class="mainframe-card-label">$P!GE0NS</div>
            <div class="mainframe-card-stats" id="mainframeStatsPigeons"></div>
            <div class="mainframe-card-tag">TRAD!NG L!VE</div>
            <button type="button" class="mainframe-card-buy" data-collection="pigeons">BUY $P!GE0NS</button>
          </div>
        </div>
        <!-- TEDDY/SEAL/FUZZY/C0NSP!RACY are all C0M!NG S00N and no longer
             clickable (no data-collection — mainframeGrid's own click
             handler below only matches [data-collection]). PHN!X is now a
             real tradeable collection (see COLLECTION_META.phnixs) so it
             gets the same active card treatment as Pigeons. -->
        <div class="mainframe-card" data-collection="phnixs" role="button" tabindex="0" style="--card-accent:255,90,31; --card-art:url('/assets/mainframe/phnix.jpeg?v=2');">
          <div class="mainframe-card-art"></div>
          <div class="mainframe-card-body">
            <div class="mainframe-card-label">$PHN!X</div>
            <div class="mainframe-card-stats" id="mainframeStatsPhnixs"></div>
            <div class="mainframe-card-tag">TRAD!NG L!VE</div>
            <button type="button" class="mainframe-card-buy" data-collection="phnixs">BUY $PHN!X</button>
          </div>
        </div>
        <div class="mainframe-card mainframe-card-soon mainframe-card-teddy" style="--card-accent:47,158,68; --card-art:url('/assets/mainframe/teddy.jpeg?v=2');">
          <div class="mainframe-card-art"></div>
          <div class="mainframe-card-body">
            <div class="mainframe-card-label">$TEDDY</div>
            <div class="mainframe-card-tag">C0M!NG S00N</div>
          </div>
        </div>
        <div class="mainframe-card mainframe-card-soon mainframe-card-seal" style="--card-accent:61,178,243; --card-art:url('/assets/mainframe/seal.jpeg?v=2');">
          <div class="mainframe-card-art"></div>
          <div class="mainframe-card-body">
            <div class="mainframe-card-label">$SEAL</div>
            <div class="mainframe-card-tag">C0M!NG S00N</div>
          </div>
        </div>
        <div class="mainframe-card mainframe-card-soon mainframe-card-fuzzy" style="--card-accent:255,51,204; --card-art:url('/assets/mainframe/fuzzy.jpeg?v=2');">
          <div class="mainframe-card-art"></div>
          <div class="mainframe-card-body">
            <div class="mainframe-card-label">$FUZZY</div>
            <div class="mainframe-card-tag">C0M!NG S00N</div>
          </div>
        </div>
        <div class="mainframe-card mainframe-card-soon mainframe-card-conspiracy" style="--card-accent:168,50,255; --card-art:url('/assets/mainframe/conspiracy.jpeg?v=2');">
          <div class="mainframe-card-art"></div>
          <div class="mainframe-card-body">
            <div class="mainframe-card-label">$C0NSP!RACY</div>
            <div class="mainframe-card-tag">C0M!NG S00N</div>
          </div>
        </div>
      </div>
      <button type="button" class="mainframe-arrow mainframe-arrow-next" id="mainframeArrowNext" aria-label="NEXT">▸</button>
    </div>
  </div>

  <!-- S0RT BY / F!LTER BY TRA!TS — real clickable buttons fixed to the
       bottom of the viewport (not sticky-in-flow any more — reported live
       as not wanting these "in their own tab" partway down the page, just
       two buttons always reachable at the bottom while the rest of the
       page scrolls normally underneath). Sitting here, a sibling of
       #screenMainframe rather than nested inside any tab panel, is
       deliberate: #flockGridPanel (an ancestor of the DATABASE grid these
       used to live inside) has backdrop-filter:blur(...) on it, which per
       the CSS Containing Block spec would hijack position:fixed's own
       anchor from the real viewport to that blurred ancestor instead (see
       openSortFlyout/openTraitsFlyout's own comment on this same issue —
       confirmed live there already). Visibility is toggled in showTab()
       to match #screenBrowse's own DATABASE/PλWS-only condition, not CSS,
       since there's no ancestor display:none left here to hide behind. -->
  <div class="flyout-popup-backdrop" id="flyoutPopupBackdrop"></div>
  <div class="bottom-controls-bar" id="bottomControlsBar" style="display:none;">
    <button type="button" class="bottom-controls-btn" id="bottomSortBtn">S0RT BY ▾</button>
    <button type="button" class="bottom-controls-btn" id="bottomTraitsBtn">F!LTER BY TRA!TS ▾</button>
  </div>

  <div class="page">
    <h1>Σκύλλα://S!GNAL :: <span class="title-online">0NL!NE</span><span class="h1-sub" id="mainframeReopenLabel">STAT!C :: MA!NFRAME</span></h1>

    <!-- DATABASE/MY PIGEONS/TOP 100/SALES HISTORY/SWAP OFFERS — the real
         top bar of the page; the trustline banner + whatever tab is
         active both sit below it. DATABASE itself now carries the
         collection picker (see .tab-db-select / dbSelectWrap) instead of
         that living as its own separate row above the strip. -->
    <div class="top-tabs-wrap" id="topTabsWrap">
    <div class="top-tabs" id="topTabs">
      <button class="tab-btn tab-btn-database" data-tab="database">
        DATABASE ::
        <div class="traits-hover-wrap tab-db-select" id="dbSelectWrap">
          <span class="trait-row-label" id="dbSelectLabel">P!GE0NS ▾</span>
          <div class="traits-flyout db-select-flyout" id="dbSelectFlyout" style="display:none;">
            <div class="db-option db-option-active" data-collection="pigeons">P!GE0NS</div>
            <!-- PHN!X/TEDDY pulled back to C0M!NG S00N (matching FUZZY's own
                 disabled pattern — no data-collection, so neither the flyout
                 click handler nor switchCollection's own querySelectorAll
                 above can ever select them) while Pigeons gets hardened
                 into the real template first — see COLLECTION_META/
                 TRADEABLE_COLLECTIONS' own comments on why. -->
            <div class="db-option db-option-disabled db-option-phnix">PHN!X <span class="db-soon">C0M!NG S00N</span></div>
            <div class="db-option db-option-disabled db-option-teddy">TEDDY <span class="db-soon">C0M!NG S00N</span></div>
            <div class="db-option db-option-disabled db-option-fuzzy">FUZZY <span class="db-soon">C0M!NG S00N</span></div>
          </div>
        </div>
      </button>
      <button class="tab-btn" data-tab="mypigeons"><span style="text-transform:none;" id="flockTabLabel">Σκύλλα</span></button>
      <button class="tab-btn" data-tab="topholders">T0P 123 H0LDERS</button>
      <button class="tab-btn" data-tab="sales">SALES H!ST0RY</button>
      <button class="tab-btn" data-tab="crown">CR0WN</button>
      <button class="tab-btn" id="swapOffersTabBtn" data-tab="swapoffers">SWAP 0FFERS</button>
    </div>
    </div>

    <!-- Trustline banner, on its own now — the stats carousel that used to
         merge into this same box moved to DATABASE itself, right above
         SEARCH!NG $P!GE0NS DATABASE (see #collectionDetailsPanel further
         down), since the carousel's own FL00R/!TEMS/H0LDERS/24H stats are
         DATABASE-specific numbers, not something every tab needs above it. -->
    <div class="pigeons-merged-panel" id="pigeonsMergedPanel">

    <div class="pigeons-bar pigeons-bar-issuer">
      <div class="pigeons-bar-main-row">
        <div class="pigeons-bar-left" id="pigeonsBarLoggedOut">
          <div class="pigeons-bar-left-body pigeons-bar-left-body-row">
            <div class="pigeons-bar-left-lines">
              <span class="pigeons-bar-text pigeons-bar-text-lg" id="trustlineTitleLabel">SET $P!GE0NS TRUSTL!NE</span>
              <!-- Shortened for display only — the copy handler reads
                   data-full, never this shortened text, so the clipboard
                   always gets the real address regardless. Not worth
                   spelling out in full: anyone who needs it just clicks
                   COPY, right there next to it. -->
              <span class="pigeons-bar-sublabel pigeons-bar-text-lg">!SSUER :: <span id="ciIssuerAddr" data-full="rfQVVT7X5FynwK87EczgP2T8RQXmQcQSf">rfQVV...QSf</span></span>
            </div>
            <button class="pigeons-bar-copy-btn" id="copyIssuerBtn" title="C0PY !SSUER ADDRESS"><span id="copyIssuerLabel">C0PY</span></button>
          </div>
          <button class="pigeons-bar-help-box" id="onboardLink"><span class="pigeons-bar-help-mark">?</span> New to the XRPL, NFTs, memes? Click here.</button>
        </div>
        <!-- Shown instead of the block above once MY_WALLET is set (real
             server-verified session, see onRequestGet/__SWAP_WALLET__) —
             real held-Pigeons count + $PIGEONS balance/trustline status
             from account_lines (fetchPigeonsAccountLine), never
             fabricated placeholders. -->
        <div class="pigeons-bar-left" id="pigeonsBarLoggedIn" style="display:none;">
          <div class="pigeons-bar-left-body">
            <span class="pigeons-bar-text" id="pigeonsLoggedInWallet"></span>
            <span class="pigeons-bar-sublabel" id="pigeonsLoggedInTrustline"></span>
            <div class="pigeons-bar-identity-actions">
              <button class="pigeons-bar-balance-buy" id="showMyPigeonsBtn">SH0W MY NFTs<span id="showMyPigeonsCount"></span></button>
              <button class="bar-btn ci-copy-btn" id="swapSignOutBtn">S!GN 0UT</button>
            </div>
          </div>
        </div>

        <!-- BALANCE — the main feature of the whole banner, along with the
             thumbnail: the real $PIGEONS token balance, front and centre,
             so this reads as "come trade the token" rather than a
             wallet-status readout. -->
        <div class="pigeons-bar-balance">
          <div class="pigeons-bar-thumb" id="pigeonsBarThumb" title="$P!GE0NS"></div>
          <div class="pigeons-bar-balance-info">
            <div class="pigeons-bar-balance-label">BALANCE:</div>
            <div class="pigeons-bar-balance-value" id="pigeonsBalanceValue" style="display:none;">…</div>
            <div class="pigeons-bar-balance-login" id="pigeonsBalanceLoginWrap">
              <button class="bar-btn ci-copy-btn" id="pigeonsLoginBtn">L0G!N T0 V!EW BALANCE</button>
            </div>
            <button class="pigeons-bar-balance-buy" id="pigeonsBalanceBuyBtn" style="display:none;">BUY $P!GE0NS</button>
          </div>
        </div>

        <div class="pigeons-bar-calc-col" id="pigeonsBarCalc" style="display:none;">
          <button type="button" class="pigeons-calc-toggle-btn" id="pigeonsCalcToggleBtn">
            <span id="pigeonsCalcToggleLabel">EXCHANGE CALCULAT0R</span> <span class="pigeons-calc-toggle-arrow">▾</span>
          </button>
        </div>
      </div>
    </div>

    <!-- EXCHANGE CALCULAT0R — a real centered popup (#pigeonsCalcModal),
         same purple/exciting treatment as 0FFER/BUY $P!GE0NS's own confirm
         modals, instead of a small dropdown anchored under the toggle
         button. Lives outside .pigeons-merged-panel entirely now — a
         position:fixed overlay doesn't need to escape that panel's own
         overflow:hidden the way the old anchored popover did. -->
    <div id="pigeonsCalcModal" style="display:none;">
      <div class="pigeons-calc-panel">
        <div class="node-eyebrow">// XRP :: $P!GE0NS EXCHANGE</div>
        <div class="pigeons-bar-rate-row">
          <a class="pigeons-bar-dex-btn" id="pigeonsDexLink" href="https://dexscreener.com/xrpl/504947454f4e5300000000000000000000000000.rfqvvt7x5fynwk87eczgp2t8rqxmqcqsf_xrp" target="_blank" rel="noopener" title="V!EW 0N DEXSCREENER" style="display:none;">
            <img class="pigeons-bar-dex-icon" src="https://dexscreener.com/favicon.ico" alt="">
          </a>
          <span class="pigeons-bar-rate-value" id="pigeonsBarRateValue" style="display:none;"></span>
        </div>
        <div class="pigeons-bar-calc">
          <input class="pigeons-bar-calc-input" id="pigeonsCalcXrpInput" type="text" inputmode="decimal" placeholder="XRP">
          <button class="input-clear-btn input-clear-btn-light" type="button" tabindex="-1" title="CLEAR">×</button>
          <span class="pigeons-bar-calc-arrow">⇄</span>
          <input class="pigeons-bar-calc-input pigeons-bar-calc-input-wide" id="pigeonsCalcPigeonsInput" type="text" inputmode="decimal" placeholder="$P!GE0NS">
          <button class="input-clear-btn input-clear-btn-light" type="button" tabindex="-1" title="CLEAR">×</button>
        </div>
        <a class="pigeons-calc-dex-btn" id="pigeonsCalcDexBtn" href="https://dexscreener.com/xrpl/504947454f4e5300000000000000000000000000.rfqvvt7x5fynwk87eczgp2t8rqxmqcqsf_xrp" target="_blank" rel="noopener">V!EW 0N DEX</a>
        <button type="button" class="pigeons-calc-close-btn" id="pigeonsCalcCloseBtn">CL0SE</button>
      </div>
    </div>
    </div>

    <div class="sw-panel" id="swapOffersPanelWrap" style="display:none;">
      <div class="panel-title">SWAP 0FFERS</div>
      <div class="swap-nonatomic-note">EACH R0W !S 0NE PEND!NG SWAP. B0TH S!DES MUST 0FFER, THEN B0TH S!DES MUST ACCEPT — N0TH!NG M0VES UNT!L B0TH ACCEPTS ARE D0NE.</div>
      <div id="swapOffersList"></div>
    </div>

    <div class="sw-panel" id="myPigeonsPanel" style="display:none;">
      <div class="connect-panel" id="connectPanel">
        <div class="connect-panel-icon"><span></span><span></span><span></span><span></span><span></span></div>
        <div class="connect-panel-title" id="connectPanelTitle">CONNECT <span style="text-transform:none;">Σκύλλα</span></div>
        <div class="connect-panel-sub" id="connectPanelSub">S!GN !N W!TH XAMAN T0 TRADE, L!ST, AND TRACK Y0UR FL0CK.</div>
        <div class="connect-panel-actions" id="connectPanelActions">
          <button type="button" class="connect-panel-btn" id="connectScyllaBtn">CONNECT <span style="text-transform:none;">Σκύλλα</span></button>
        </div>
      </div>
      <!-- No separate "WALLET CONNECTED" box here any more — the trustline
           banner above already shows the connected wallet/balance; this
           tab is just your pigeons, sort, and offers. -->

      <!-- CREATE OFFER — real, working, wired to the real swap-offer-*
           backend (startSwapOffer) — gated behind CREATE_OFFER_ENABLED
           (currently false) rather than removed, same pattern as
           SWAP_BUILDER_ENABLED above: paused for launch since a real
           NFT-for-NFT swap has no atomic guarantee on XRPL yet (whoever's
           offer gets accepted first is trusting the other side to
           reciprocate — see CREATE_OFFER_ENABLED's own comment for the
           planned brokered-escrow fix). Reuses the trade-box/ob-eyebrow
           look from the (also hidden) multi-item trade builder above,
           single-slot instead of a pile, and its own state
           (state.simpleOffer) — kept separate from offerAssets/
           targetAssets so it doesn't interfere with that system either. -->
      <div class="sw-panel-target simple-offer-panel" id="simpleOfferPanel">
        <div class="panel-title">SWAP NFT TRADE DETA!LS</div>
        <div id="simpleOfferComingSoon" style="display:none;">
          <div class="index-line" style="margin-top:0.5rem;">C0M!NG S00N — REAL NFT-F0R-NFT SWAPP!NG !S BE!NG BU!LT PR0PERLY BEF0RE LAUNCH.</div>
        </div>
        <div id="simpleOfferLive">
          <div class="simple-offer-row">
            <div class="trade-box simple-offer-box">
              <div class="ob-eyebrow">Y0UR P!GE0N</div>
              <div id="simpleOfferMineSlot"></div>
            </div>
            <div class="swap-review-divider">F0R</div>
            <div class="trade-box simple-offer-box">
              <div class="ob-eyebrow">0FFER F0R</div>
              <div id="simpleOfferTheirsSlot"></div>
            </div>
          </div>
          <div class="simple-offer-actions">
            <button type="button" class="action-btn" id="simpleOfferCreateBtn" disabled>CREATE 0FFER</button>
          </div>
          <div class="index-line" id="simpleOfferStatus"></div>
        </div>
      </div>
      <!-- No more "N0 0FFERS"/"0FFERS RECE!VED (N)" summary line here —
           that job now belongs to the FL0CK tab label itself (see
           updateFlockTabLabel). Offers still render per-card exactly as
           before (myPigeonOffersHtml), this just drops the redundant
           header line above the grid. -->
      <!-- NFT 0FFERED T0 Y0U — real TRANSFER sell-offers sent to this
           wallet, sitting on a Pigeon someone ELSE still owns (see
           swap-incoming-transfers.js's own comment for why MY PIGEONS'
           usual "look at what I own" approach can't find these). Its own
           box, above the grid, not mixed into it — the Pigeon shown here
           isn't actually yours yet. -->
      <div id="incomingTransfersBox" style="display:none;">
        <div class="panel-title" style="font-size:13px;">NFT 0FFERED T0 Y0U</div>
        <div id="incomingTransfersList"></div>
      </div>
      <div class="search-row" id="myPigeonsSortRow" style="display:none; justify-content:center;">
        <select class="sort-select" id="myPigeonsSortSelect">
          <option value="RARITY_ASC" selected>RAR!TY H!GH</option>
          <option value="RARITY_DESC">RAR!TY L0W</option>
          <option value="NAME_ASC">A → Z</option>
          <option value="NAME_DESC">Z → A</option>
        </select>
      </div>
      <div id="myPigeonsList"></div>
    </div>

    <!-- 0FFERS RECE!VED — every real buy-offer sitting on a Pigeon you
         currently have listed, one horizontal row per Pigeon (thumbnail +
         number + buyer + price + ACCEPT/DECL!NE/C0UNTER), reached via the
         Σκύλλα tab's own 0FFERS box (see flockOffersBox's click handler)
         instead of that box doing nothing, which it used to. -->
    <div class="sw-panel" id="myOffersPanelWrap" style="display:none;">
      <div class="panel-title">0FFERS RECE!VED</div>
      <div id="myOffersList"></div>
      <!-- Every real $PIGEONS buy-offer THIS wallet has made on someone
           else's Pigeon, with a real CANCEL — reported live as important
           to get right specifically so cancelling actually works, rather
           than only being discoverable by revisiting each Pigeon one at
           a time. Same row layout as 0FFERS RECE!VED above. -->
      <div class="panel-title outgoing-offers-title">0UTG0!NG 0FFERS</div>
      <div id="outgoingOffersList"></div>
    </div>

    <div class="sw-panel" id="topHoldersPanelWrap" style="display:none;">
      <div class="panel-title">T0P 123 H0LDERS</div>
      <div id="topHoldersList"></div>
    </div>

    <div class="sw-panel" id="salesPanelWrap" style="display:none;">
      <div class="panel-title">SALES H!ST0RY</div>
      <div class="sale-currency-toggle" id="salesCurrencyToggle">
        <button class="sale-currency-btn sale-currency-btn-active" data-currency="XRP">XRP</button>
        <button class="sale-currency-btn" data-currency="PIGEONS" id="salesCurrencyPigeonsBtn">$P!GE0NS</button>
      </div>
      <div class="sales-scrollbox" id="salesScrollBox">
        <div id="salesArea"></div>
        <div class="scroll-sentinel" id="salesScrollSentinel"></div>
        <div class="load-more-note" id="salesLoadMoreNote" style="display:none;">L0AD!NG M0RE SALES...</div>
        <div class="end-of-collection-note" id="salesEndNote" style="display:none;">// END 0F SALES H!ST0RY</div>
      </div>
    </div>

    <!-- CR0WN — real $PIGEONS trading profit/loss leaderboard, realized
         only (see crown-leaderboard.js's own comment). Read-only for now —
         "eventually give out rewards for weekly and monthly winners" is a
         later phase, not built yet. -->
    <div class="sw-panel" id="crownPanelWrap" style="display:none;">
      <div class="panel-title">CR0WN</div>
      <div class="index-line" style="text-align:center; margin-bottom:0.75rem;">REAL $P!GE0NS TRAD!NG PR0F!T/L0SS — REAL!ZED 0NLY, TH!S S!TE 0NLY.</div>
      <div class="search-row" style="justify-content:center;">
        <select class="sort-select" id="crownPeriodSelect">
          <option value="week" selected>TH!S WEEK</option>
          <option value="month">TH!S M0NTH</option>
        </select>
      </div>
      <div id="crownLeaderboardList"></div>
    </div>

    <!-- PR0F!LE — a wallet's own chosen username + profile picture (one of
         its own Pigeons), shown everywhere an address used to just print
         its own short form (see walletTagHtml/setWalletText). -->
    <div class="sw-panel" id="profilePanelWrap" style="display:none;">
      <div class="panel-title">PR0F!LE</div>
      <div class="profile-current-row">
        <div class="profile-current-avatar" id="profileCurrentAvatar"></div>
        <div class="profile-current-info">
          <div class="profile-current-username" id="profileCurrentUsername">N0 USERNAME SET</div>
          <div class="profile-current-wallet" id="profileCurrentWallet"></div>
        </div>
      </div>
      <!-- MY C0!NS — real balance + trustline status for every collection
           with a real token (see COLLECTION_META's own tokenIssuer),
           reported live as wanting one place to see every coin at a
           glance. $P!GE0NS is the only one with a working BUY/T0P UP
           right now (COLLECTION_META.hasAmm) — everything else still
           shows its own real balance/trustline, just with a C0M!NG S00N
           action instead of a live BUY, same treatment those collections
           already get everywhere else on the site. Built by
           renderProfileCoins() below, not static — it has to iterate
           COLLECTION_META itself so a future collection just needs its
           own entry there, nothing here changes. -->
      <div class="panel-title outgoing-offers-title" style="font-size:13px;">MY C0!NS</div>
      <div class="profile-coins-list" id="profileCoinsList"></div>
      <div class="search-row" style="justify-content:center;">
        <input class="transfer-wallet-input" id="profileUsernameInput" type="text" placeholder="CH00SE A USERNAME (LETTERS/NUMBERS/_/EM0J!, UP T0 20)">
        <button class="bar-btn" id="profileUsernameSaveBtn">SAVE</button>
      </div>
      <div class="index-line" id="profileUsernameStatus" style="text-align:center; margin-top:0.5rem;"></div>
      <div class="panel-title outgoing-offers-title" style="font-size:13px;">CH00SE PR0F!LE P!CTURE FR0M Y0UR P!GE0NS</div>
      <div id="profilePfpStatus" class="th-empty" style="display:none;"></div>
      <div class="simple-picker-grid" id="profilePfpGrid"></div>
    </div>

    <!-- SCREEN 1: COLLECTION BROWSER (whole collection OR one owner's, per scope) -->
    <div id="screenBrowse" style="display:none;">
      <!-- Persistent trade builder, always visible on DATABASE — this is
           the single place that starts/continues a trade now (no more
           separate stage-screens). Clicking an empty OFFER slot browses
           your own wallet (below); clicking ADD on a card either fills
           OFFER (browsing your own wallet) or fills FOR/WANT (browsing
           anyone else's, or the full collection), which for the very
           first want pick also auto-identifies that pigeon's owner as the
           target wallet via the existing enterOwnerScope. Neither box
           touches the other's contents. -->
      <div class="sw-panel sw-panel-target" id="tradeBuilderPanel">
        <div class="panel-title">CREATE AN 0FFER</div>
        <div class="trade-box" id="offerBox">
          <div class="ob-eyebrow">Y0UR 0FFER</div>
          <div class="ob-pile" id="offerPile"></div>
          <div class="ob-count" id="offerCount">0 / 4 ASSETS SELECTED</div>
        </div>
        <div class="swap-review-divider">F0R</div>
        <div class="trade-box" id="wantBox">
          <div class="ob-eyebrow">THE!R 0FFER</div>
          <div class="ob-pile" id="wantPile"></div>
          <div class="ob-count" id="wantCount">0 / 4 ASSETS SELECTED</div>
        </div>
        <div style="text-align:center; margin-top:1rem;">
          <button class="action-btn" id="completeTradeBtn" disabled>C0MPLETE TRADE 0FFER</button>
        </div>
      </div>

      <div class="sw-panel sw-panel-target" id="nodeHeaderPanel" style="display:none;">
        <div class="node-eyebrow" id="nodeEyebrowText">// TARGET N0DE !DENT!F!ED</div>

        <div class="target-pigeon-card" id="targetPigeonCard" style="display:none;">
          <div class="tp-label">TARGET P!GE0N</div>
          <div class="tp-body">
            <div class="pigeon-img-box tp-img" id="targetPigeonImg">IMAGE</div>
            <div class="tp-info">
              <div class="tp-num" id="targetPigeonNum"></div>
              <div class="tp-owner-label">OWNER</div>
              <div class="tp-owner" id="targetPigeonOwner"></div>
            </div>
          </div>
        </div>

        <div class="wallet-box">
          <div class="wallet-box-title"><span id="walletBoxTitleMain">TARGET WALLET</span><br><span class="wallet-box-sub" id="walletBoxTitleSub">// H0LDER N0DE</span></div>
          <div class="wallet-box-addr" id="nodeAddr"></div>
          <div class="wallet-box-count" id="nodeCount"></div>
        </div>

        <div style="text-align:center;">
          <a class="back-link" href="#" id="backToFullCollectionLink" style="margin:0;">← EX!T TARGET WALLET :: BACK T0 FULL C0LLECT!0N</a>
        </div>
      </div>

      <!-- Your own connected wallet address, with a real one-tap copy —
           reported live as wanting "a way to copy our own address when
           we're in Σκύλλα", then "one big cyan box thats clickable" —
           the whole box is the button now, not a small one tacked on the
           side. Same visibility rule as flockAccountBoxes below (only on
           FL0CK, scoped to your own wallet). -->
      <div class="sw-panel flock-wallet-box" id="flockWalletBox" style="display:none;" role="button" tabindex="0">
        <span class="flock-wallet-addr" id="flockWalletAddr"></span>
        <span class="flock-wallet-copy-hint" id="flockWalletCopyHint">CL!CK T0 C0PY</span>
      </div>

      <!-- FL0CK's own account-page layout — separate stacked boxes, not a
           dropdown-in-a-title (see flockAccountBoxes' own comment). Only
           ever shown on FL0CK, scoped to your own wallet (see
           updateSearchPanelTitleForPaws). -->
      <div id="flockAccountBoxes" style="display:none;">
        <div class="sw-panel flock-account-box flock-account-box-clickable" id="flockMyFlockBox">
          <div class="flock-account-box-row"><span class="flock-account-box-label flock-count-loading" id="flockMyFlockLabel">MY P!GE0NS :: L0AD!NG...</span></div>
        </div>
        <!-- Paused (MESSAGES_DB was never bound in production, see the
             swap-buy-prepare.js/HANDOFF.md history — messaging is fully
             built and worked in local dev, but every real request in prod
             500s) — same inert "not yet" treatment as TRANSACTION
             H!ST0RY/$CRWN REWARDS below, not a real destination right now. -->
        <div class="sw-panel flock-account-box flock-account-box-soon">
          <div class="flock-account-box-row"><span class="flock-account-box-label">MESSAGE !NB0X</span><span class="db-soon">C0M!NG S00N</span></div>
        </div>
        <div class="sw-panel flock-account-box flock-account-box-clickable" id="flockOffersBox">
          <div class="flock-account-box-row"><span class="flock-account-box-label">0FFERS<span class="flock-tab-offer-dot" id="flockOffersCount" style="display:none;"></span></span></div>
        </div>
        <!-- Username + pfp, set from one of your own Pigeons — lives here
             inside Σκύλλα (reported live as wanting it here, not as its
             own separate top-level tab) rather than as a sibling of
             DATABASE/FL0CK/T0P H0LDERS/etc. -->
        <div class="sw-panel flock-account-box flock-account-box-clickable" id="flockProfileBox">
          <div class="flock-account-box-row"><span class="flock-account-box-label">PR0F!LE</span></div>
        </div>
        <div class="sw-panel flock-account-box flock-account-box-clickable" id="flockBuyPigeonsBox">
          <div class="flock-account-box-row"><span class="flock-account-box-label">BUY $P!GE0NS</span></div>
        </div>
        <div class="sw-panel flock-account-box flock-account-box-clickable" id="flockChangeCollectionBox">
          <div class="flock-account-box-row"><span class="flock-account-box-label">CHANGE C0LLECT!0N</span></div>
        </div>
        <div class="sw-panel flock-account-box flock-account-box-soon">
          <div class="flock-account-box-row"><span class="flock-account-box-label">TRANSACT!0N H!ST0RY</span><span class="db-soon">C0M!NG S00N</span></div>
        </div>
        <div class="sw-panel flock-account-box flock-account-box-soon">
          <div class="flock-account-box-row"><span class="flock-account-box-label">CR0WN REWARDS</span><span class="db-soon">C0M!NG S00N</span></div>
        </div>
      </div>

      <div class="sw-panel" id="flockGridPanel">
        <!-- DATABASE-only stats carousel, attached to the top of this same
             box (not its own separate panel) — these FL00R/!TEMS/H0LDERS/
             24H numbers are DATABASE-specific, not relevant chrome on
             FL0CK/T0P H0LDERS/SALES/CR0WN, so it's hidden there via
             showTab()'s own dbOnly condition (same id, same JS, just
             nested here now instead of sitting above as a sibling). -->
        <div id="collectionDetailsPanel" style="display:none;">
          <!-- Auto-rotating strip — one page visible at a time, cycling on
               a timer instead of three stacked bars, to keep this area
               compact. -->
          <div class="stats-carousel" id="statsCarousel">
          <div class="stats-carousel-row">
          <button class="stats-carousel-arrow" id="statsPrevBtn" aria-label="PREV!0US">◂</button>
          <div class="stats-carousel-viewport">
          <div class="stats-strip stats-strip-floor stats-page stats-page-active" id="statsStripFloor">
            <a class="stat-tile stat-tile-link stat-tile-xrpcafe" id="statFloorXrpCafeTile" target="_blank" rel="noopener"><div class="stat-label">FL00R :: XRP.CAFE</div><div class="stat-value" id="statFloorXrpCafe">…</div></a>
            <button class="stat-tile stat-tile-link stat-tile-pigeons" id="statScyllaListedTile" title="SH0W 0NLY L!STED THR0UGH SCYLLA"><div class="stat-label" id="statScyllaListedLabel">$P!GE0NS FL00R</div><div class="stat-value" id="statScyllaListedCount">…</div></button>
            <a class="stat-tile stat-tile-link stat-tile-deeptide" id="statFloorDeeptideTile" target="_blank" rel="noopener"><div class="stat-label">FL00R :: DEEPT!DE</div><div class="stat-value" id="statFloorDeeptide">…</div></a>
          </div>
          <div class="stats-strip stats-strip-main stats-page" id="statsStrip">
            <div class="stat-tile"><div class="stat-label">!TEMS</div><div class="stat-value"><span id="statItems">…</span> <button class="stat-burnt-link" id="statBurntLink" title="V!EW BURN L!ST">(15 BURNT)</button></div></div>
            <div class="stat-tile"><div class="stat-label">H0LDERS</div><div class="stat-value" id="statHolders">…</div></div>
            <div class="stat-tile"><div class="stat-label">T0TAL V0LUME</div><div class="stat-value" id="statVolume">…</div></div>
            <div class="stat-tile"><div class="stat-label">L!STED</div><div class="stat-value" id="statListed">…</div></div>
          </div>
          <div class="stats-strip stats-strip-activity stats-page" id="statsStripActivity">
            <div class="stat-tile"><div class="stat-label">24H NFTS TRADED</div><div class="stat-value" id="statTraded24h">…</div></div>
            <div class="stat-tile"><div class="stat-label">24H V0LUME</div><div class="stat-value" id="statVolume24h">…</div></div>
            <button class="stat-tile stat-tile-link" id="statSalesTile" title="G0 T0 SALES H!ST0RY"><div class="stat-label">24H SALES</div><div class="stat-value" id="statSales24h">…</div></button>
          </div>
          </div>
          <button class="stats-carousel-arrow" id="statsNextBtn" aria-label="NEXT">▸</button>
          </div>
          <div class="stats-carousel-dots" id="statsCarouselDots">
            <span class="stats-dot active"></span>
            <span class="stats-dot"></span>
            <span class="stats-dot"></span>
          </div>
          </div>
        </div>
        <div class="panel-title search-panel-title" id="searchPanelTitle">SEARCH!NG $P!GE0NS DATABASE</div>
        <div class="search-panel-subtitle" id="searchPanelSubtitle" style="display:none;"></div>
        <div class="results-block" id="resultsBlock">
          <!-- One line: SEARCH (left), SORT BY (middle), VIEW (right). -->
          <div class="results-header-row">
            <div class="search-row">
              <input class="search-input" id="searchInput" placeholder="# 0R WALLET">
              <button class="input-clear-btn" type="button" tabindex="-1" title="CLEAR">×</button>
              <button class="bar-btn" id="searchBtn">GO</button>
            </div>
            <!-- COLLECTION sits where S0RT BY used to (centered, top row)
                 — swapped with it, see below. -->
            <div class="sort-field sort-field-inline">
              <div class="edition-toggle" id="editionSelect">
                <button type="button" class="edition-btn active" data-value="ALL">ALL (1-3015)</button>
                <button type="button" class="edition-btn" data-value="LOW">1ST ED!T!0N (1-1515)</button>
                <button type="button" class="edition-btn" data-value="HIGH">2ND ED!T!0N (1516-3015)</button>
              </div>
            </div>
            <div class="sort-field">
              <span class="sort-field-label">V!EW ::</span>
              <select class="sort-select" id="dbViewSelect">
                <option value="thumbnails" selected>THUMBNA!LS</option>
                <option value="boxed" disabled>B0XED V!EW (C0M!NG S00N)</option>
              </select>
            </div>
          </div>

          <!-- S0RT BY / F!LTER BY TRA!TS' own trigger boxes — no longer
               shown here at all (reported live as not wanting these "in
               their own tab" partway down the page); real buttons for
               both now live in the fixed #bottomControlsBar (see
               #screenMainframe's own sibling further up). This whole
               block stays in the DOM purely as the machinery
               renderSortFlyoutList/renderTraitsFlyoutCats/openSortFlyout/
               openTraitsFlyout already write into and reparent from (the
               popup itself, #sortFlyoutVals, #traitsFlyoutCats, etc.) —
               changing every one of those to build fresh markup instead
               would be a much bigger, riskier rewrite for the exact same
               end result. -->
          <div class="db-controls-sticky" id="dbControlsSticky" style="display:none;">
          <!-- S0RT BY sits directly underneath now, in COLLECTION's old
               spot — same static-label + stacked-applied-tag treatment as
               F!LTER BY TRA!TS below it (#sortRows is #traitRows' own
               pattern, just always exactly one tag — picking a new value
               replaces it instead of adding a second one). -->
          <div class="db-config-group db-config-traits-group">
            <div class="db-config-traits-section">
              <div class="traits-hover-wrap" id="sortDropWrap">
                <span class="trait-row-label" id="sortDropLabel">S0RT BY <span class="thl-arrow">▾</span></span>
                <div class="traits-flyout flyout-flat" id="sortFlyout" style="display:none;">
                  <!-- flyout-flat's own permanently-visible desktop strip
                       is retired (see its CSS) — S0RT BY now opens as the
                       same centered popup at every width, so these two
                       PREV/NEXT arrows are effectively dead (kept, not
                       removed, in case the strip layout is ever wanted
                       back for a wide value list). -->
                  <button type="button" class="flyout-popup-close-btn" id="sortFlyoutClose" aria-label="CL0SE">✕</button>
                  <button type="button" class="hscroll-arrow hscroll-arrow-prev" id="sortScrollPrevBtn" aria-label="PREV!0US">◂</button>
                  <div class="traits-flyout-vals" id="sortFlyoutVals"></div>
                  <button type="button" class="hscroll-arrow hscroll-arrow-next" id="sortScrollNextBtn" aria-label="NEXT">▸</button>
                </div>
              </div>
            </div>
          </div>

          <!-- ADD TRAITS — its own box underneath S0RT BY, left-aligned
               to line up with the search bar above (#searchInput). -->
          <div class="db-config-group db-config-traits-group">
            <div class="db-config-traits-section">
              <div class="traits-hover-wrap" id="traitsHoverWrap">
                <span class="trait-row-label" id="traitsHoverLabel">F!LTER BY TRA!TS <span class="thl-arrow">▾</span></span>
                <div class="traits-flyout" id="traitsFlyout" style="display:none;">
                  <button type="button" class="flyout-popup-close-btn" id="traitsFlyoutClose" aria-label="CL0SE">✕</button>
                  <button type="button" class="flyout-back-btn" id="traitsFlyoutBack">◂ CATEG0R!ES</button>
                  <!-- Desktop only (see .traits-flyout-cats' own CSS) — a
                       horizontal row of every trait category (Background,
                       Eyewear, ...) instead of the vertical list mobile
                       still uses, with these flanking it to scroll along
                       if there are more categories than fit. Wrapped in
                       their own row (not direct children of #traitsFlyout)
                       so this trio can be a plain nowrap flex row on
                       desktop — #traitsFlyout itself just stacks THIS row
                       above the values row, two children, no ambiguity
                       about which one wraps. -->
                  <div class="traits-flyout-cats-row" id="traitsFlyoutCatsRow">
                    <button type="button" class="hscroll-arrow hscroll-arrow-prev cats-scroll-arrow" id="traitsCatsScrollPrevBtn" aria-label="PREV!0US">◂</button>
                    <div class="traits-flyout-cats" id="traitsFlyoutCats"></div>
                    <button type="button" class="hscroll-arrow hscroll-arrow-next cats-scroll-arrow" id="traitsCatsScrollNextBtn" aria-label="NEXT">▸</button>
                  </div>
                  <div class="traits-flyout-vals" id="traitsFlyoutVals"></div>
                </div>
              </div>
            </div>
          </div>
          </div>

          <!-- Real visible feedback for whichever S0RT/TRA!TS are actually
               applied right now — #sortRows/#traitRows/#clearTraitsBtn
               used to live inside #dbControlsSticky itself, which is
               display:none now that its own trigger buttons moved to the
               fixed bottom bar (see that div's own comment). Reported live
               as "filter by traits isn't working" — it WAS applying (the
               real query/grid updated fine), there was just no longer any
               visible sign it had: no applied-trait chip, no CLEAR button,
               nothing. Pulled out into their own always-visible row so
               that feedback exists again regardless of where the trigger
               buttons themselves live. -->
          <div class="applied-filters-row" id="appliedFiltersRow">
            <div id="sortRows"></div>
            <div id="traitRows"></div>
            <button class="clear-traits-btn" id="clearTraitsBtn" style="display:none;">CLEAR</button>
          </div>

          <!-- RESET sits between the applied-filters row above and the
               results status line below — its own row, not bundled into
               either. -->
          <div class="results-reset-row">
            <button class="bar-btn reset-db-btn" id="resetDbBtn" title="ALL ED!T!0NS, RAR!TY H!GHEST, THUMBNA!LS V!EW, N0 TRA!TS">RESET</button>
          </div>

          <!-- SHOWING RESULTS FOR — its own line, directly above the
               pigeons list itself. -->
          <div class="status-line-standalone-row">
            <div class="status-line" id="statusLine"></div>
          </div>
          <div id="resultsArea"></div>
          <div class="scroll-sentinel" id="scrollSentinel"></div>
          <div class="load-more-note" id="loadMoreNote" style="display:none;">L0AD!NG M0RE P!GE0NS...</div>
          <div class="end-of-collection-note" id="endOfCollectionNote" style="display:none;">// END 0F C0LLECT!0N</div>
        </div>
      </div>
    </div>

    <!-- SCREEN 2: DETAIL -->
    <div class="sw-panel" id="screenDetail" style="display:none;">
      <canvas class="local-static-bg" id="detailStaticBg"></canvas>
      <!-- PREV/NEXT — walks the exact list this Pigeon was opened from
           (state.items for the whole-collection browse, state.scopeAllItems
           for a wallet scope), in whatever order it was sorted/filtered at
           the time — not a fixed collection-wide sequence. -->
      <button class="detail-nav-btn detail-nav-prev" id="detailPrevBtn" title="PREV!0US P!GE0N (◂)">◂</button>
      <button class="detail-nav-btn detail-nav-next" id="detailNextBtn" title="NEXT P!GE0N (▸)">▸</button>
      <div class="detail-two-col">
        <div class="detail-num-row">
          <!-- Same goBackFromDetail() as the full-width BACK strip at the
               bottom — just a second, closer-to-hand entry point at the
               top so you do not have to scroll back down past the
               traits/listings to leave. Shares a row with P!GE0N #N now
               (used to float position:fixed at the top-left corner,
               independent of it — moved down here and paired on purpose,
               centered together instead of two unrelated-looking
               elements landing near each other by coincidence). -->
          <button class="detail-back-btn-top" id="backToBrowseBtnTop">← BACK</button>
          <div class="detail-num" id="detailNum"></div>
          <button class="detail-share-btn" id="detailShareBtn" title="C0PY A SHAREABLE L!NK T0 TH!S P!GE0N">SHARE</button>
        </div>
        <div class="detail-owner-top" id="detailOwner"></div>
        <div class="detail-col-left">
          <div class="detail-img-large pigeon-img-box" id="detailImgBox" title="VIEW FULLSCREEN">IMAGE</div>
          <div class="detail-under-pic-box">
            <div class="detail-rarity-row" id="detailRarityRow" style="display:none;">
              <div class="trait-cell">
                <div class="tc-label">RAR!TY</div>
                <div class="tc-value" id="detailRarity"></div>
              </div>
              <div class="trait-cell">
                <div class="tc-label">RAR!TY SC0RE</div>
                <div class="tc-value">C0M!NG S00N</div>
              </div>
            </div>
            <div class="scylla-listing-block">
              <div class="scylla-listing-row" id="detailScyllaListingRow">
                <span class="scylla-listing-price" id="detailScyllaPrice">N0 L!ST!NG</span>
                <button class="scylla-buy-btn" id="detailScyllaBuyBtn" style="display:none;">BUY N0W</button>
                <button class="bar-btn" id="detailScyllaDelistBtn" style="display:none;">CANCEL</button>
              </div>
              <div class="listing-countdown" id="detailScyllaCountdown" style="display:none;"></div>
              <!-- Owned + unlisted — real L!ST/TRANSFER buttons side by
                   side now instead of the plain "!N Y0UR FL0CK" text
                   label (see updateScyllaListing). -->
              <div class="owned-action-row" id="detailScyllaOwnedRow" style="display:none;">
                <button class="bar-btn" id="detailScyllaListBtn">L!ST</button>
                <button class="bar-btn" id="detailScyllaTransferBtn">TRANSFER</button>
              </div>
              <div class="thumb-offer-row" id="detailMakeOfferRow" style="display:none;">
                <div class="make-offer-input-wrap">
                  <img class="make-offer-input-coin" src="/api/ipfs-image?src=https%3A%2F%2Fipfs.io%2Fipfs%2FQmRbNvemLYjHuRZcpYRRSq5vqqozzjoy3aDR6eSzSoTFUs" alt="">
                  <input class="make-offer-input" id="detailMakeOfferInput" type="text" inputmode="decimal" placeholder="0FFER AM0UNT">
                  <button class="input-clear-btn" type="button" tabindex="-1" title="CLEAR">×</button>
                </div>
                <button class="make-offer-send" id="detailMakeOfferSend">SUBM!T</button>
                <!-- Same duration row/reasoning as amountEntryOfferDuration. -->
                <div class="list-duration-row" id="detailMakeOfferDuration">
                  <button type="button" class="list-duration-btn" data-days="1">1 DAY</button>
                  <button type="button" class="list-duration-btn" data-days="3">3 DAYS</button>
                  <button type="button" class="list-duration-btn" data-days="7">7 DAYS</button>
                  <button type="button" class="list-duration-btn" data-days="30">30 DAYS</button>
                  <button type="button" class="list-duration-btn list-duration-forever active" data-days="0" title="F0REVER — never expires">∞</button>
                </div>
              </div>
            </div>
            <!-- Real buy-offers received on YOUR OWN Pigeon, same
                 myPigeonOffersHtml markup/ACCEPT-DECLINE handling the
                 DATABASE/MY PIGEONS card grid already uses — was only
                 ever rendered on the card itself, never here, so an offer
                 that showed up as a real "N 0FFERS" count on the tab
                 strip had nowhere to actually act on it once you opened
                 the Pigeon's own detail screen. See updateScyllaListing. -->
            <div id="detailOffersReceived"></div>
          </div>
        </div>
        <div class="detail-col-right">
          <div class="trait-grid" id="detailTraits"></div>
          <div class="detail-sales-section">
            <div class="card-listings detail-listings-row" id="detailListingsRow"></div>
            <div class="detail-field" id="detailPriceRow" style="display:none;"><span class="df-label">PR!CE</span><span class="df-value price" id="detailPrice"></span></div>
            <div class="detail-field" id="detailHighSaleRow"><span class="df-label">REC0RD SALE</span><span class="df-value price" id="detailHighSale"></span></div>
            <div class="detail-field" id="detailRecentSaleRow"><span class="df-label">RECENT SALE</span><span class="df-value price" id="detailRecentSale"></span></div>
            <div class="detail-field" id="detailAvgSaleRow" style="display:none;"><span class="df-label">AVERAGE SALE</span><span class="df-value price" id="detailAvgSale"></span></div>
          </div>
          <div class="detail-history">
            <button class="th-toggle" id="detailHistoryToggle">TRANSACT!0N H!ST0RY</button>
          </div>
        </div>
      </div>
      <button class="detail-back-btn" id="backToBrowseBtn">← BACK</button>
    </div>

    <!-- Fullscreen picture lightbox — click the detail picture to open,
         click anywhere to close back to the detail screen underneath. -->
    <div id="detailLightbox" style="display:none;">
      <canvas class="local-static-bg" id="lightboxStaticBg"></canvas>
      <button class="detail-nav-btn detail-nav-prev" id="lightboxPrevBtn" title="PREV!0US P!GE0N (◂)">◂</button>
      <img id="detailLightboxImg" src="" alt="">
      <button class="detail-nav-btn detail-nav-next" id="lightboxNextBtn" title="NEXT P!GE0N (▸)">▸</button>
    </div>

    <!-- CREATE OFFER's Y0UR P!GE0N picker — myPigeonsData already loaded
         for the PλWS tab. 0FFER F0R picks directly off the real, full
         DATABASE instead now (see enterTheirsPickMode), not this modal —
         it only ever handles this one side. Click the dimmed backdrop or
         ✕ to close without picking. -->
    <div id="simpleOfferPickerModal" style="display:none;">
      <div class="simple-picker-panel">
        <div class="simple-picker-header">
          <div class="simple-picker-title">SELECT Y0UR P!GE0N</div>
          <button type="button" class="simple-picker-close" id="simpleOfferPickerClose" title="CL0SE">&times;</button>
        </div>
        <div class="simple-picker-grid" id="simpleOfferPickerGrid"></div>
      </div>
    </div>

    <!-- Shared L!ST/0FFER/TRANSFER popup — one instance, re-labelled per
         use (openAmountEntryModal). Cards across DATABASE only ever show
         a button now (L!ST/0FFER/TRANSFER); this is the one
         place left to actually type a number or wallet address. Each
         mode reuses the exact input/button classes its own existing
         submit logic already expects (list-price-input/list-inline-btn
         for L!ST, make-offer-input/make-offer-send for 0FFER), so
         submitInlineListing/submitMakeOffer work completely unchanged. -->
    <div id="amountEntryModal" style="display:none;">
      <div class="amount-entry-panel">
        <div class="simple-picker-header">
          <span class="simple-picker-title" id="amountEntryTitle"></span>
          <button type="button" class="simple-picker-close" id="amountEntryClose" title="CL0SE">&times;</button>
        </div>
        <div class="thumb-offer amount-entry-mode" id="amountEntryListMode" style="display:none;">
          <div class="thumb-offer-row">
            <div class="make-offer-input-wrap">
              <img class="make-offer-input-coin" src="/api/ipfs-image?src=https%3A%2F%2Fipfs.io%2Fipfs%2FQmRbNvemLYjHuRZcpYRRSq5vqqozzjoy3aDR6eSzSoTFUs" alt="">
              <input class="list-price-input" id="amountEntryListInput" type="text" inputmode="decimal" placeholder="ENTER AM0UNT">
            </div>
            <button class="list-inline-btn" id="amountEntryListBtn">L!ST</button>
          </div>
          <!-- Real XRPL NFTokenCreateOffer Expiration, not app-side
               enforcement — see listingExpirationRippleSeconds in
               _shared.js. Single pick, F0REVER default (was 7D) — most
               people listing a Pigeon aren't thinking about a deadline,
               per explicit request. -->
          <div class="list-duration-row" id="amountEntryListDuration">
            <button type="button" class="list-duration-btn" data-days="1">1 DAY</button>
            <button type="button" class="list-duration-btn" data-days="3">3 DAYS</button>
            <button type="button" class="list-duration-btn" data-days="7">7 DAYS</button>
            <button type="button" class="list-duration-btn" data-days="30">30 DAYS</button>
            <button type="button" class="list-duration-btn list-duration-forever active" data-days="0" title="F0REVER — never expires">∞</button>
          </div>
          <div class="index-line list-inline-status" id="amountEntryListStatus" style="display:none;"></div>
        </div>
        <div class="thumb-offer amount-entry-mode" id="amountEntryOfferMode" style="display:none;">
          <div class="amount-entry-pigeon-row" id="amountEntryOfferPigeonRow" style="display:none;">
            <img class="amount-entry-pigeon-thumb" id="amountEntryOfferPigeonImg" src="" alt="">
            <div class="amount-entry-pigeon-num" id="amountEntryOfferPigeonNum"></div>
          </div>
          <div class="make-offer-balance-line" id="amountEntryOfferBalanceLine" style="display:none;"></div>
          <div class="thumb-offer-row">
            <div class="make-offer-input-wrap">
              <input class="make-offer-input" id="amountEntryOfferInput" type="text" inputmode="decimal" placeholder="0FFER AM0UNT">
            </div>
            <button class="make-offer-send" id="amountEntryOfferBtn">SUBM!T</button>
          </div>
          <!-- Real XRPL NFTokenCreateOffer Expiration, same as LIST's own
               duration row — reported live as wanting an offer to
               eventually clear itself when ignored (XRPL has no
               "rejected" state to detect) instead of sitting live
               forever with no real answer either way. -->
          <div class="list-duration-row" id="amountEntryOfferDuration">
            <button type="button" class="list-duration-btn" data-days="1">1 DAY</button>
            <button type="button" class="list-duration-btn" data-days="3">3 DAYS</button>
            <button type="button" class="list-duration-btn" data-days="7">7 DAYS</button>
            <button type="button" class="list-duration-btn" data-days="30">30 DAYS</button>
            <button type="button" class="list-duration-btn list-duration-forever active" data-days="0" title="F0REVER — never expires">∞</button>
          </div>
        </div>
        <div class="thumb-offer amount-entry-mode" id="amountEntryTransferMode" style="display:none;">
          <div class="thumb-offer-row">
            <input class="transfer-wallet-input" id="amountEntryTransferInput" type="text" placeholder="DEST!NAT!0N WALLET (r...)">
            <button class="list-inline-btn" id="amountEntryTransferBtn">TRANSFER</button>
          </div>
          <div class="index-line" id="amountEntryTransferStatus" style="display:none;"></div>
        </div>
      </div>
    </div>

    <!-- SCREEN 2b: TRANSACTION HISTORY — a full swap of the DETAIL box, not an
         inline expand, so the history list gets the whole panel to itself -->
    <div class="sw-panel" id="screenHistory" style="display:none;">
      <div class="detail-eyebrow">// TRANSACT!0N H!ST0RY</div>
      <div class="detail-num" id="historyNum"></div>
      <div class="th-list" id="detailHistoryList"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="backToDetailBtn">← BACK</button>
      </div>
    </div>

    <!-- SCREEN 3: TARGET SUMMARY -->
    <div class="sw-panel" id="screenSummary" style="display:none;">
      <div class="detail-eyebrow">SCYLLA TARGET</div>
      <div class="target-summary-block">
        <div class="ts-label">OWNER</div>
        <div class="ts-value" id="summaryOwner"></div>
        <div class="ts-label">REQUEST!NG</div>
        <div class="ts-value" id="summaryList"></div>
        <div class="ts-count" id="summaryCount"></div>
      </div>
      <div class="placeholder-card" id="offerPlaceholder" style="display:none;">
        <div class="pc-title">// SCYLLA 0FFER BU!LDER</div>
        <div class="pc-body">TH!S PR0T0TYPE ST0PS HERE.<br>N0 0FFER HAS BEEN CREATED.<br>N0 WALLET C0NNECTED. N0 ASSETS M0VED.<br>NEXT PHASE :: SELECT Y0UR P!GE0NS + XRP.</div>
      </div>
      <div class="detail-actions">
        <button class="secondary-btn" id="backFromSummaryBtn">← BACK</button>
        <button class="action-btn" id="continueToOfferBtn">C0NT!NUE T0 0FFER</button>
      </div>
    </div>

    <!-- SCREEN: SWAP REVIEW — both sides of the bundle, side by side. Still
         no XRPL/settlement logic: CREATE SWAP OFFER only prints a test
         summary, nothing is signed or sent. -->
    <div class="sw-panel" id="screenSwapReview" style="display:none;">
      <div class="detail-eyebrow">SWAP REV!EW</div>
      <div class="swap-review-side">
        <div class="ob-eyebrow">Y0U 0FFER</div>
        <div class="ob-pile review-pile" id="reviewOfferPile"></div>
        <div class="ob-count" id="reviewOfferCount"></div>
      </div>
      <div class="swap-review-divider">⇅</div>
      <div class="swap-review-side">
        <div class="ob-eyebrow">Y0U WANT</div>
        <div class="ob-pile review-pile" id="reviewWantPile"></div>
        <div class="ob-count" id="reviewWantCount"></div>
      </div>
      <div class="index-line" id="reviewResult" style="display:none; margin-top:1.25rem;"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="reviewBackBtn">← BACK</button>
        <button class="action-btn" id="reviewCreateBtn">CREATE SWAP 0FFER</button>
      </div>
    </div>

    <!-- SCREEN: SWAP OFFER CONFIRMATION — the exact NFTokenCreateOffer
         txjson for YOUR half of the trade, before Xaman ever opens. XRPL
         has no NFT-for-NFT offer, so this is a free (Amount "0") offer
         restricted to the target wallet via Destination — NOT an atomic
         swap. The target wallet still has to create + both sides still
         have to accept each other's offers separately; that warning stays
         visible through both this screen and the result screen. -->
    <div class="sw-panel" id="screenSwapOfferConfirm" style="display:none;">
      <div class="node-eyebrow">// SWAP 0FFER C0NF!RMAT!0N</div>
      <div class="tx-type-badge" id="swapConfTxType"></div>
      <div class="index-line swap-nonatomic-note">⚠ N0N-AT0M!C :: TH!S 0NLY SENDS Y0UR P!GE0N'S 0FFER. THE 0THER WALLET MUST SEPARATELY 0FFER THE!RS, THEN B0TH S!DES ACCEPT.</div>
      <div class="detail-field"><span class="df-label">Account</span><span class="df-value" id="swapConfAccount"></span></div>
      <div class="detail-field"><span class="df-label">NFTokenID</span><span class="df-value" id="swapConfNftId"></span></div>
      <div class="detail-field"><span class="df-label">Amount</span><span class="df-value" id="swapConfAmount"></span></div>
      <div class="detail-field"><span class="df-label">Destination</span><span class="df-value" id="swapConfDestination"></span></div>
      <div class="detail-field"><span class="df-label">Flags</span><span class="df-value" id="swapConfFlags"></span></div>
      <div class="index-line" id="swapConfirmStatus" style="margin-top:1rem;"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="swapOfferConfirmBackBtn">← BACK</button>
        <button class="action-btn" id="swapOfferOpenXamanBtn">0PEN XAMAN</button>
      </div>
    </div>

    <!-- SCREEN: SWAP OFFER RESULT — verified against real on-ledger state
         (nft_sell_offers), not just Xaman's word. -->
    <div class="sw-panel" id="screenSwapOfferResult" style="display:none;">
      <div class="detail-eyebrow">// 0FFER SENT</div>
      <div class="index-line swap-nonatomic-note">TH!S !S 0NLY Y0UR HALF 0F THE TRADE. THE 0THER WALLET ST!LL NEEDS T0 CREATE THE!R 0WN 0FFER F0R THE!R P!GE0N, THEN B0TH S!DES ACCEPT EACH 0THER'S 0FFERS.</div>
      <div class="detail-field"><span class="df-label">P!GE0N 0FFERED</span><span class="df-value" id="swapResultNftId"></span></div>
      <div class="detail-field"><span class="df-label">T0 WALLET</span><span class="df-value" id="swapResultToWallet"></span></div>
      <div class="detail-field"><span class="df-label">STATUS</span><span class="df-value" id="swapResultStatus"></span></div>
      <div class="detail-field"><span class="df-label">0FFER !D</span><span class="df-value" id="swapResultOfferId"></span></div>
      <div class="detail-field"><span class="df-label">TRANSACT!0N</span><span class="df-value"><a id="swapResultTxLink" target="_blank" rel="noopener"></a></span></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="swapResultDoneBtn">← BACK T0 DATABASE</button>
      </div>
    </div>

    <!-- SCREEN: ACCEPT SWAP CONFIRMATION — the exact NFTokenAcceptOffer
         txjson for accepting the OTHER side's offer, before Xaman ever
         opens. Accepting this really transfers their Pigeon to you and
         yours to them completes only once BOTH sides have each accepted
         the other's offer. -->
    <div class="sw-panel" id="screenSwapAcceptConfirm" style="display:none;">
      <div class="node-eyebrow">// ACCEPT SWAP C0NF!RMAT!0N</div>
      <div class="tx-type-badge" id="acceptConfTxType"></div>
      <div class="index-line swap-nonatomic-note">TH!S ACCEPTS THE!R 0FFER T0 Y0U. Y0UR 0WN P!GE0N 0NLY M0VES !F THEY (0R Y0U ALREADY D!D) SEPARATELY ACCEPT Y0UR 0FFER T00.</div>
      <div class="detail-field"><span class="df-label">Account</span><span class="df-value" id="acceptConfAccount"></span></div>
      <div class="detail-field"><span class="df-label">NFTokenSellOffer</span><span class="df-value" id="acceptConfOfferId"></span></div>
      <div class="detail-field"><span class="df-label">P!GE0N</span><span class="df-value" id="acceptConfNftId"></span></div>
      <div class="detail-field"><span class="df-label">FR0M WALLET</span><span class="df-value" id="acceptConfFromWallet"></span></div>
      <div class="index-line" id="acceptConfirmStatus" style="margin-top:1rem;"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="swapAcceptConfirmBackBtn">← BACK</button>
        <button class="action-btn" id="swapAcceptOpenXamanBtn">0PEN XAMAN</button>
      </div>
    </div>

    <!-- SCREEN: ACCEPT SWAP RESULT — verified against real on-ledger state
         (the Pigeon now in your account_nfts, the offer gone). -->
    <div class="sw-panel" id="screenSwapAcceptResult" style="display:none;">
      <div class="detail-eyebrow">// ACCEPTED</div>
      <div class="detail-field"><span class="df-label">P!GE0N RECE!VED</span><span class="df-value" id="acceptResultNftId"></span></div>
      <div class="detail-field"><span class="df-label">STATUS</span><span class="df-value" id="acceptResultStatus"></span></div>
      <div class="detail-field"><span class="df-label">TRANSACT!0N</span><span class="df-value"><a id="acceptResultTxLink" target="_blank" rel="noopener"></a></span></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="acceptResultDoneBtn">← BACK T0 SWAP 0FFERS</button>
      </div>
    </div>

    <!-- SCREEN: LISTING RESULT — verified against real on-ledger state, not
         a stored flag. Big, clean, receipt-style — one glance tells you
         which Pigeon, that it's real, and what it's listed for; the raw
         tx hash is still there (real proof, one click away) but doesn't
         compete with the three things that actually matter. -->
    <div class="sw-panel result-receipt" id="screenListResult" style="display:none;">
      <div class="receipt-badge">✓</div>
      <div class="receipt-pigeon-num" id="listResultPigeonNum"></div>
      <div class="receipt-status-line">TRANSACT!0N C0NF!RMED</div>
      <div class="receipt-price-row">
        <div class="receipt-price-label">L!STED PR!CE</div>
        <div class="receipt-price-value" id="listResultPrice"></div>
      </div>
      <div class="detail-actions">
        <button class="action-btn" id="listResultDoneBtn">← BACK T0 MY P!GE0NS</button>
      </div>
      <a class="receipt-tx-link" id="listResultTxLink" target="_blank" rel="noopener">V!EW TRANSACT!0N</a>
    </div>

    <!-- BUY N0W — a real centered popup (#buyConfirmModal), same treatment
         as 0FFER/BUY $P!GE0NS's own confirm modals, not a showScreen
         navigation away from the grid (reported live as "feels like going
         to another page"). Two static sub-states (confirm, then result)
         toggled by display, same pattern buySwapModal's own three states
         use — the actual confirm/result logic below is untouched, only
         the container changed. -->
    <!-- No confirm-first step any more — BUY N0W opens Xaman immediately
         (see openBuyConfirm in static.js), same change already made for
         CANCEL/DELIST and ACCEPT OFFER; this is now purely the waiting-
         for-signature state, PIGEON/SELLER/PR!CE filling in a moment
         after Xaman's already open. -->
    <div id="buyConfirmModal" style="display:none;">
      <div class="offer-confirm-panel" id="screenBuyConfirm">
        <div class="node-eyebrow">// BUY!NG</div>
        <div class="detail-num" id="buyConfPigeon"></div>
        <div class="detail-field"><span class="df-label">SELLER</span><span class="df-value" id="buyConfSeller"></span></div>
        <div class="detail-field final-amount-row"><span class="df-label">PR!CE</span><span class="df-value final-amount" id="buyConfPrice"></span></div>
        <div class="index-line waiting-status-line" id="buyConfirmStatus"></div>
        <div class="detail-actions">
          <button class="secondary-btn" id="buyConfirmBackBtn">← BACK</button>
        </div>
      </div>

      <div class="offer-confirm-panel" id="screenBuyResult" style="display:none;">
        <div class="detail-eyebrow">// SETTLED</div>
        <div class="detail-num" id="buyResultPigeonNum"></div>
        <div class="detail-field final-amount-row"><span class="df-label">PR!CE</span><span class="df-value final-amount" id="buyResultPrice"></span></div>
        <div class="detail-field"><span class="df-label">STATUS</span><span class="df-value status-ok" id="buyResultStatus"></span></div>
        <div class="detail-field"><span class="df-label">TRANSACT!0N</span><span class="df-value"><a id="buyResultTxLink" target="_blank" rel="noopener"></a></span></div>
        <div class="detail-actions">
          <button class="secondary-btn" id="buyResultDoneBtn">← BACK T0 L!STED</button>
        </div>
      </div>
    </div>

    <!-- BUY $P!GE0NS — a real popup now (#buySwapModal), same purple/clean
         treatment as OFFER CONFIRMATION, not a showScreen navigation away
         from the grid. Three static sub-states toggled by display (never
         an innerHTML rebuild — see openAcceptTransferConfirm's own comment
         for why), same underlying quote/trustline/sign logic as before,
         untouched — only the container changed. STAGE 4: real live quote
         PLUS a real live trustline check before the input is even usable —
         a wallet that can't receive $PIGEONS yet gets the SAME issuer+COPY
         setup UI the trustline banner already uses (this app has no real
         TrustSet-signing flow built anywhere yet — see copyIssuerBtn's own
         comment — so this reuses that exact existing pattern). -->
    <div id="buySwapModal" style="display:none;">
      <div class="offer-confirm-panel buyswap-modal-panel">
        <div id="buySwapEntryState">
          <div class="node-eyebrow" id="buySwapTitle">// BUY $P!GE0NS</div>
          <div class="buyswap-trustline-warning" id="buySwapTrustlineWarning" style="display:none;">
            <div class="buyswap-trustline-warning-title" id="buySwapTrustlineWarningTitle"></div>
            <div class="pigeons-bar-left-body-row buyswap-trustline-issuer-row">
              <span class="pigeons-bar-sublabel">!SSUER :: <span id="buySwapIssuerAddr" data-full="rfQVVT7X5FynwK87EczgP2T8RQXmQcQSf">rfQVV...QSf</span></span>
              <button class="pigeons-bar-copy-btn" id="buySwapCopyIssuerBtn" title="C0PY !SSUER ADDRESS"><span id="buySwapCopyIssuerLabel">C0PY</span></button>
            </div>
          </div>
          <div class="buyswap-row" id="buySwapPayRow">
            <span class="buyswap-label">Y0U PAY</span>
            <div class="buyswap-input-wrap">
              <input class="buyswap-input" id="buySwapXrpInput" type="text" inputmode="decimal" placeholder="0.00" autocomplete="off">
              <button class="input-clear-btn" type="button" tabindex="-1" title="CLEAR">×</button>
              <span class="buyswap-unit">XRP</span>
            </div>
            <div class="buyswap-max-line" id="buySwapMaxLine" style="display:none;"></div>
            <div class="buyswap-input-error" id="buySwapInputError" style="display:none;"></div>
          </div>
          <div class="buyswap-arrow" aria-hidden="true">↓</div>
          <div class="buyswap-row">
            <span class="buyswap-label">Y0U RECE!VE</span>
            <div class="buyswap-input-wrap buyswap-receive-wrap">
              <span class="buyswap-receive-value" id="buySwapReceiveValue">—</span>
              <span class="buyswap-unit" id="buySwapReceiveUnit">P!GE0NS</span>
            </div>
          </div>
          <div class="buyswap-divider"></div>
          <div class="detail-field"><span class="df-label">RATE</span><span class="df-value" id="buySwapRate">—</span></div>
          <div class="detail-field"><span class="df-label">M!N!MUM RECE!VED</span><span class="df-value" id="buySwapMinReceived">—</span></div>
          <div class="detail-field"><span class="df-label">SL!PPAGE</span><span class="df-value" id="buySwapSlippage">0.5%</span></div>
          <div class="buyswap-divider"></div>
          <div class="index-line" id="buySwapStatus">QU0TE C0M!NG S00N — SWAP N0T YET L!VE.</div>
          <div class="detail-actions">
            <button class="secondary-btn" id="buySwapBackBtn">← BACK</button>
            <button class="action-btn" id="buySwapSignBtn" disabled title="QU0TE N0T YET AVA!LABLE">S!GN & BUY</button>
          </div>
        </div>

        <!-- REVIEW — the exact prepared Payment txjson (buyswap-prepare.js/
             buyswap-payload.js, same shared buildBuySwapTxjson), re-derived
             server-side from a fresh quote/trustline/balance check, for
             inspection before Xaman ever opens. -->
        <div id="buySwapConfirmState" style="display:none;">
          <div class="tx-review-title" id="buySwapConfTxType"></div>
          <p class="tx-summary">
            Account <span class="tx-val tx-val-addr" id="buySwapConfAccount"></span> is spending
            <span class="tx-val" id="buySwapConfSendMax"></span> to receive a minimum of
            <span class="tx-val" id="buySwapConfAmount"></span>.
          </p>
          <!-- No DEST!NAT!0N row here — this swap's txjson always sets
               Destination to the buyer's own Account (see buildBuySwapTxjson
               in _shared.js), so it's the exact same address already shown
               in the sentence above. Showing it twice was just noise. -->
          <div class="buyswap-divider"></div>
          <div class="detail-field"><span class="df-label">EST!MATED RECE!VE</span><span class="df-value" id="buySwapConfEstimate"></span></div>
          <div class="detail-field"><span class="df-label">EXCHANGE RATE</span><span class="df-value" id="buySwapConfRate"></span></div>
          <div class="detail-field"><span class="df-label">L!QU!D!TY S0URCE</span><span class="df-value" id="buySwapConfSource"></span></div>
          <div class="index-line" id="buySwapConfirmStatus" style="margin-top:1rem;"></div>
          <div class="detail-actions">
            <button class="secondary-btn" id="buySwapConfirmBackBtn">← BACK</button>
            <button class="action-btn offer-confirm-xaman-btn" id="buySwapOpenXamanBtn">0PEN XAMAN</button>
          </div>
        </div>

        <!-- RESULT — never shown just because Xaman accepted the signing
             request; buyswap-status.js only reports 'settled' after a
             real, independently-validated on-ledger transaction result
             (fetchValidatedTxResult), and RECE!VED below is the
             transaction's own real delivered_amount, never the earlier
             estimate. -->
        <div id="buySwapResultState" style="display:none;">
          <div class="receipt-badge">✓</div>
          <div class="receipt-status-line">$P!GE0NS ACQU!RED</div>
          <div class="receipt-price-row">
            <div class="receipt-price-label">RECE!VED</div>
            <div class="receipt-price-value buyswap-received-value" id="buySwapResultReceived"></div>
          </div>
          <div class="detail-actions">
            <button class="action-btn" id="buySwapResultDoneBtn">D0NE</button>
          </div>
          <a class="buyswap-tx-link" id="buySwapResultTxLink" target="_blank" rel="noopener">V!EW TRANSACT!0N</a>
        </div>
      </div>
    </div>

    <!-- DEL!ST — a real centered popup (#delistConfirmModal), same
         treatment as BUY N0W's own confirm modal (converted earlier the
         same way — see #buyConfirmModal's own comment) instead of a
         showScreen navigation away from the grid. No "are you sure"
         question any more either — CANCEL now opens Xaman immediately
         (see openDelistConfirm), reported live as not wanting a
         confirmation step at all for this one. This panel is now purely
         the waiting-for-signature status + a BACK 0UT while it's pending,
         same shape LIST/BUY's own waiting states already use elsewhere. -->
    <div id="delistConfirmModal" style="display:none;">
      <div class="offer-confirm-panel" id="screenDelistConfirm">
        <div class="node-eyebrow">// DEL!ST!NG</div>
        <div class="confirm-pigeon-num" id="delistConfPigeon"></div>
        <div class="index-line waiting-status-line" id="delistConfirmStatus"></div>
        <div class="detail-actions">
          <button class="secondary-btn" id="delistConfirmBackBtn">← BACK</button>
        </div>
      </div>

      <div class="offer-confirm-panel" id="screenDelistResult" style="display:none;">
        <div class="detail-eyebrow">// DEL!STED</div>
        <div class="detail-num" id="delistResultPigeonNum"></div>
        <div class="detail-actions">
          <a class="secondary-btn" id="delistResultWalletLink" target="_blank" rel="noopener">V!EW Y0UR WALLET ACT!V!TY</a>
          <button class="secondary-btn" id="delistResultDoneBtn">← BACK T0 MY P!GE0NS</button>
        </div>
      </div>
    </div>

    <!-- 0FFER CONFIRMATION — a real NFTokenCreateOffer BUY-offer (the
         reverse of LIST, which only the current owner can accept),
         entered via the shared amount-entry popup's 0FFER mode or the
         detail screen's own copy — the exact txjson, before Xaman ever
         opens. A second popup stacked right on top of the amount-entry
         one (closeAmountEntryModal fires the instant this opens) rather
         than navigating away from the grid to a whole different screen
         — same reasoning the amount-entry popup itself was built on.
         Purple, not the neutral dark every other confirm screen uses —
         this is Σκύλλα's own $PIGEONS colour (same as the trustline
         banner/SORT BY/ADD TRAITS), meant to feel like a real, exciting
         moment, not just another form. -->
    <!-- OFFER CONFIRMATION — two static sub-states toggled by display
         (never an innerHTML rebuild, same reasoning acceptTransferConfirm-
         Modal's own comment gives), not a showScreen navigation away from
         the grid. Submitting keeps this exact same popup open and just
         swaps to the receipt state instead of jumping to a separate full
         page. -->
    <div id="offerConfirmModal" style="display:none;">
      <div class="offer-confirm-panel">
        <div id="offerConfirmForm">
          <div class="node-eyebrow">// 0FFER C0NF!RMAT!0N</div>
          <div class="confirm-field-label">Y0U ARE 0FFER!NG</div>
          <div class="confirm-field-value confirm-field-value-big" id="offerConfValue"></div>
          <div class="confirm-field-label">F0R</div>
          <!-- Real picture, clickable straight into the full detail view —
               closes this popup first (openDetail is a showScreen
               navigation, not another stacked popup, see gotcha #10 in
               HANDOFF.md). -->
          <img class="confirm-pigeon-thumb" id="offerConfPigeonImg" src="" alt="" title="V!EW P!GE0N">
          <div class="confirm-pigeon-num confirm-pigeon-num-clickable" id="offerConfPigeonNum"></div>
          <div class="index-line" id="offerConfirmStatus" style="margin-top:1rem;"></div>
          <div class="detail-actions">
            <button class="secondary-btn" id="offerConfirmBackBtn">← BACK</button>
            <button class="action-btn offer-confirm-xaman-btn" id="offerOpenXamanBtn">C0NF!RM W!TH <span style="text-transform:none;">Σκύλλα</span></button>
          </div>
        </div>
        <!-- Verified against real on-ledger state (nft_buy_offers), not
             just Xaman's word. -->
        <div id="offerConfirmReceipt" style="display:none;">
          <div class="receipt-badge">✓</div>
          <div class="receipt-status-line">0FFER SENT</div>
          <div class="receipt-pigeon-num" id="offerReceiptPigeonNum"></div>
          <div class="receipt-price-row">
            <div class="receipt-price-label">Y0UR 0FFER</div>
            <div class="receipt-price-value" id="offerReceiptPrice"></div>
          </div>
          <div class="detail-actions">
            <button class="action-btn" id="offerResultDoneBtn">D0NE</button>
          </div>
          <a class="receipt-tx-link" id="offerResultTxLink" target="_blank" rel="noopener">V!EW TRANSACT!0N</a>
          <div class="index-line swap-nonatomic-note" style="margin-top:1.25rem; margin-bottom:0;">THE 0WNER ST!LL NEEDS T0 ACCEPT TH!S 0FFER F0R THE TRADE T0 SETTLE.</div>
        </div>
        <!-- ΣΚΥΛΛΑ://S!GNAL — an OPTIONAL 123-drop XRP payment offered only
             when swap-signal-check.js reports the recipient has no
             existing activity on the site (see checkAndMaybeShowSignal).
             Never sent automatically — SEND S!GNAL is the only thing that
             ever triggers the real payment (submitOfferSignal). Same
             third-sub-state pattern as offerConfirmForm/-Receipt above,
             with its own two inner toggled views (ask / sent). -->
        <div id="offerSignalState" style="display:none;">
          <div id="offerSignalPrompt">
            <!-- text-transform:none span — see HANDOFF.md gotcha #3, the
                 ancestor .node-eyebrow forces uppercase (and the literal
                 Greek text below used to be typed ΣΚΥΛΛΑ, the all-caps
                 form, rather than escaping it) which renders Σκύλλα's
                 name wrong everywhere else it appears mixed-case. -->
            <div class="node-eyebrow">// <span style="text-transform:none;">Σκύλλα</span>://S!GNAL</div>
            <div class="confirm-field-value" id="offerSignalWallet" style="font-family:var(--font-mono); margin-bottom:1rem;"></div>
            <div class="signal-heading">N0 ACT!V!TY DETECTED</div>
            <div class="signal-body">TH!S WALLET HAS N0 REC0RDED ACT!V!TY 0N <strong>S0!TBEG!NS.XYZ</strong>.</div>
            <div class="signal-body" style="margin-top:0.85rem;">SEND A <strong>123-DR0P S!GNAL</strong> T0 N0T!FY THE WALLET 0WNER?</div>
            <div class="signal-body signal-body-dim" style="margin-top:0.6rem;">A <strong>123-DR0P XRP PAYMENT</strong> W!LL BE SENT T0 TH!S WALLET W!TH A UN!QUE MEM0 !DENT!FY!NG TH!S 0FFER.</div>
            <div class="receipt-price-row" style="margin-top:1rem;">
              <div class="receipt-price-label">C0ST</div>
              <div class="receipt-price-value" style="font-size:20px;">0.000123 XRP</div>
            </div>
            <div class="index-line" id="offerSignalStatus" style="margin-top:0.75rem;"></div>
            <div class="detail-actions">
              <button class="secondary-btn" id="offerSignalSkipBtn">CANCEL</button>
              <button class="action-btn offer-confirm-xaman-btn" id="offerSignalSendBtn">SEND S!GNAL</button>
            </div>
          </div>
          <div id="offerSignalSentConfirm" style="display:none;">
            <div class="receipt-badge">✓</div>
            <div class="receipt-status-line"><span style="text-transform:none;">Σκύλλα</span>://S!GNAL :: SENT</div>
            <div class="index-line" style="margin-top:0.5rem;">123 DR0PS DEL!VERED</div>
            <a class="receipt-tx-link" id="offerSignalTxLink" target="_blank" rel="noopener">V!EW TRANSACT!0N</a>
            <div class="detail-actions">
              <button class="action-btn" id="offerSignalDoneBtn">D0NE</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TRANSFER CONFIRMATION — a real free (Amount "0") NFTokenCreateOffer
         restricted to the destination wallet, entered via the shared
         amount-entry popup's TRANSFER mode — the exact txjson, before
         Xaman ever opens. Same real second-popup + purple treatment as
         0FFER's own confirm screen (see #offerConfirmModal's own comment)
         instead of a showScreen navigation away from the grid. -->
    <div id="transferConfirmModal" style="display:none;">
      <div class="offer-confirm-panel">
        <div class="node-eyebrow">// TRANSFER C0NF!RMAT!0N</div>
        <div class="confirm-field-label">TRANSFERR!NG FR0M</div>
        <div class="confirm-field-value" id="transferConfAccount"></div>
        <div class="confirm-pigeon-num" id="transferConfPigeonNum"></div>
        <div class="confirm-field-label">DEST!NAT!0N</div>
        <div class="confirm-field-value" id="transferConfDestination"></div>
        <div class="index-line swap-nonatomic-note">TH!S 0NLY CREATES THE 0FFER — THE REC!P!ENT ST!LL NEEDS T0 ACCEPT !T (E.G. FR0M THE!R 0WN XAMAN WALLET) BEF0RE THE P!GE0N ACTUALLY M0VES.</div>
        <div class="index-line" id="transferConfirmStatus" style="margin-top:1rem;"></div>
        <div class="detail-actions">
          <button class="secondary-btn" id="transferConfirmBackBtn">← BACK</button>
          <button class="action-btn offer-confirm-xaman-btn" id="transferOpenXamanBtn">C0NF!RM W!TH <span style="text-transform:none;">Σκύλλα</span></button>
        </div>
      </div>
    </div>

    <!-- SCREEN: TRANSFER RESULT — verified against real on-ledger state (nft_sell_offers), not just Xaman's word.
         Receipt-style like LIST/DELIST's own result screens (see .result-receipt) — one glance tells you which
         Pigeon and where it's headed; the non-atomic warning is real but secondary, so it sits at the bottom
         instead of stealing the top of the screen. -->
    <div class="sw-panel result-receipt" id="screenTransferResult" style="display:none;">
      <div class="receipt-badge">✓</div>
      <div class="receipt-pigeon-num" id="transferResultPigeonNum"></div>
      <div class="receipt-status-line">TRANSFER 0FFER SENT</div>
      <div class="receipt-price-row">
        <div class="receipt-price-label">TRANSFERR!NG T0</div>
        <div class="receipt-price-value" id="transferResultDestination" style="font-family:var(--font-mono); font-size:16px; word-break:break-all;"></div>
      </div>
      <div class="detail-actions">
        <button class="secondary-btn" id="transferResultDoneBtn">← BACK T0 MY FL0CK</button>
      </div>
      <a class="receipt-tx-link" id="transferResultTxLink" target="_blank" rel="noopener">V!EW TRANSACT!0N</a>
      <div class="index-line swap-nonatomic-note" style="margin-top:1.25rem; margin-bottom:0;">THE REC!P!ENT ST!LL NEEDS T0 ACCEPT TH!S 0FFER F0R THE P!GE0N T0 M0VE.</div>
    </div>

    <!-- ACCEPT!NG AN !NC0M!NG TRANSFER (recipient side) — real second popup,
         same purple/exciting treatment as 0FFER/TRANSFER's own confirm
         screens (see #offerConfirmModal's own comment). Swaps its own inner
         content to a small receipt in place on success instead of
         navigating anywhere — this box isn't part of the DATABASE grid's
         showScreen chain, it lives entirely inside FL0CK. -->
    <div id="acceptTransferConfirmModal" style="display:none;">
      <div class="offer-confirm-panel" id="acceptTransferConfirmPanel">
        <!-- Two static sub-states toggled by display (not an innerHTML
             rebuild) — same reasoning every other confirm/result pair on
             this page already follows: fixed element ids, populated in
             place, never re-created. -->
        <div id="acceptTransferConfirmForm">
          <div class="node-eyebrow">// ACCEPT TRANSFER</div>
          <div class="confirm-field-label">P!GE0N</div>
          <div class="confirm-pigeon-num" id="acceptTransferConfPigeonNum"></div>
          <div class="confirm-field-label">FR0M</div>
          <div class="confirm-field-value" id="acceptTransferConfFrom"></div>
          <div class="index-line" id="acceptTransferConfirmStatus" style="margin-top:1rem;"></div>
          <div class="detail-actions">
            <button class="secondary-btn" id="acceptTransferConfirmBackBtn">← BACK</button>
            <button class="action-btn offer-confirm-xaman-btn" id="acceptTransferOpenXamanBtn">C0NF!RM W!TH <span style="text-transform:none;">Σκύλλα</span></button>
          </div>
        </div>
        <div id="acceptTransferConfirmReceipt" style="display:none;">
          <div class="receipt-badge">✓</div>
          <div class="receipt-pigeon-num" id="acceptTransferReceiptPigeonNum"></div>
          <div class="receipt-status-line">!S N0W Y0URS</div>
          <div class="detail-actions">
            <button class="action-btn" id="acceptTransferResultDoneBtn">D0NE</button>
          </div>
        </div>
      </div>
    </div>

    <!-- SCREEN: ACCEPT!NG — no confirm-first step any more (see
         openAcceptOfferConfirm in static.js), ACCEPT opens Xaman
         immediately; this is now purely the waiting-for-signature state,
         its fields filling in a moment after Xaman's already open. -->
  </div>

  <!-- ACCEPT 0FFER — a real centered popup (#acceptOfferConfirmModal), same
       treatment as BUY N0W's own confirm modal (#buyConfirmModal), not a
       showScreen navigation away from the grid — reported live as wanting
       "a pop up instead of a new screen". Also now shows the actual pigeon
       thumbnail (was text-only), same .amount-entry-pigeon-row/-thumb
       pattern the L!ST/0FFER/TRANSFER popup already uses. -->
  <div id="acceptOfferConfirmModal" style="display:none;">
    <div class="offer-confirm-panel" id="screenAcceptOfferConfirm">
      <div class="node-eyebrow">// ACCEPT!NG 0FFER</div>
      <div class="amount-entry-pigeon-row">
        <img class="amount-entry-pigeon-thumb" id="acceptOfferConfThumb" alt="">
        <div class="detail-num" id="acceptOfferConfPigeon"></div>
      </div>
      <div class="detail-field"><span class="df-label">BUYER</span><span class="df-value" id="acceptOfferConfBuyer"></span></div>
      <div class="detail-field"><span class="df-label">0FFER</span><span class="df-value" id="acceptOfferConfPrice"></span></div>
      <div class="detail-field"><span class="df-label">MARKETPLACE FEE (1.023%)</span><span class="df-value" id="acceptOfferConfFee"></span></div>
      <!-- Hidden when royaltyPercent is 0 — most tokens on the ledger
           carry no royalty at all, only shown when this NFT actually has
           one (see applyNftRoyalty in _shared.js). -->
      <div class="detail-field" id="acceptOfferConfRoyaltyRow" style="display:none;"><span class="df-label" id="acceptOfferConfRoyaltyLabel">NFT R0YALTY</span><span class="df-value" id="acceptOfferConfRoyalty"></span></div>
      <div class="detail-field final-amount-row"><span class="df-label">Y0U RECE!VE</span><span class="df-value final-amount" id="acceptOfferConfSellerAmount"></span></div>
      <div class="index-line waiting-status-line" id="acceptOfferConfirmStatus"></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="acceptOfferConfirmBackBtn">← BACK</button>
      </div>
    </div>

    <!-- ACCEPT OFFER RESULT — verified against real on-ledger state (offer gone, NFT no longer owner's) -->
    <div class="offer-confirm-panel" id="screenAcceptOfferResult" style="display:none;">
      <div class="detail-eyebrow">// SETTLED</div>
      <div class="amount-entry-pigeon-row">
        <img class="amount-entry-pigeon-thumb" id="acceptOfferResultThumb" alt="">
        <div class="detail-num" id="acceptOfferResultPigeonNum"></div>
      </div>
      <div class="detail-field"><span class="df-label">PR!CE</span><span class="df-value" id="acceptOfferResultPrice"></span></div>
      <div class="detail-field"><span class="df-label">MARKETPLACE FEE (1.023%)</span><span class="df-value" id="acceptOfferResultFee"></span></div>
      <div class="detail-field" id="acceptOfferResultRoyaltyRow" style="display:none;"><span class="df-label" id="acceptOfferResultRoyaltyLabel">NFT R0YALTY</span><span class="df-value" id="acceptOfferResultRoyalty"></span></div>
      <div class="detail-field final-amount-row"><span class="df-label">SELLER RECE!VED</span><span class="df-value final-amount" id="acceptOfferResultSellerAmount"></span></div>
      <div class="detail-field"><span class="df-label">STATUS</span><span class="df-value status-ok" id="acceptOfferResultStatus"></span></div>
      <div class="detail-field"><span class="df-label">TRANSACT!0N</span><span class="df-value"><a id="acceptOfferResultTxLink" target="_blank" rel="noopener"></a></span></div>
      <div class="detail-actions">
        <button class="secondary-btn" id="acceptOfferResultDoneBtn">← BACK T0 MY P!GE0NS</button>
      </div>
    </div>
  </div>

  <div class="target-bar" id="targetBar" style="display:none;">
    <span class="tb-label" id="targetBarLabel">TARGET ASSETS :: 0</span>
    <span class="tb-toggle">V!EW ▲</span>
  </div>

<script>
(function(){

  // The browser's own scroll-restoration silently restored whatever
  // scrollY a previous visit/reload happened to be at — landing wherever
  // that was, not the top, on every plain refresh. Combined with content
  // whose height depends on what's finished loading (images, async trait/
  // pigeon data), the restored offset frequently pointed at the wrong
  // thing entirely. Manual + an explicit top-of-page jump makes every
  // fresh load of this page start from the same place, every time.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  // Wallet of whoever is currently signed in via the shared pigeon_session
  // cookie (set by /board's connect flow, or by the CONNECT SCYLLA button
  // below reusing the exact same login) — read server-side, null if no
  // signature is on file.
  var MY_WALLET = "__SWAP_WALLET__";

  // BETA — the NFT-for-NFT swap builder (CREATE AN OFFER box, MY PIGEONS'
  // + toggle, SWAP OFFERS tab) is fully built and working, just hidden for
  // now. Nothing behind it was removed or changed — flip this back to
  // true to bring it all back exactly as it was. This is the ONLY switch;
  // every entry point below checks it.
  var SWAP_BUILDER_ENABLED = false;

  // V1 CREATE OFFER (the PλWS "SWAP NFT TRADE DETAILS" box, real
  // startSwapOffer wiring, and the SWAP OFFERS tab that goes with it) is
  // ALSO fully built and working — wired to the same real swap-offer-*
  // backend as SWAP_BUILDER_ENABLED above, tested end-to-end once on the
  // real ledger. Paused deliberately for launch: a real NFT-for-NFT swap
  // has no atomic guarantee on XRPL (no Batch amendment live on mainnet —
  // see the swap builder's own gotcha notes), so whoever's offer gets
  // accepted first is trusting the other side to reciprocate. The
  // intended fix is a brokered escrow version (both offers destination-
  // restricted to a broker wallet instead of each other, broker forwards
  // both once it holds both) — not yet built, needs its own careful
  // design (recovery path if the broker ends up holding one NFT and the
  // second leg fails) before this goes live for real users. Flip this
  // back to true once that's ready, or to resume testing sooner. Nothing
  // behind it was removed — same "one switch, every entry point checks
  // it" pattern as SWAP_BUILDER_ENABLED above.
  var CREATE_OFFER_ENABLED = false;

  // ---- Client-side state ----
  var PAGE_SIZE = 36;
  var state = {
    collection: 'pigeons',     // 'pigeons' | 'phnixs' | 'teddybg' — see COLLECTION SELECTION (dbSelectFlyout) and switchCollection()
    scope: null,              // null (whole collection) or { wallet, ownerShort }
    flockCollapsed: true,     // MY FL0CK account-box starts minimised on FL0CK — click toggles (see updateSearchPanelTitleForPaws)
    skip: 0,                  // how many items already loaded, for infinite scroll
    editionRawSkip: 0,        // position in the underlying sorted collection, for edition LOW/HIGH scans
    hasMore: true,
    loading: false,
    // Bumped every time startCollectionBrowse() begins a fresh query —
    // loadMoreCollection() captures this at request time and checks it
    // again when the response lands, discarding anything that's since
    // been superseded instead of rendering a stale, wrong-sort/wrong-
    // filter response into a grid that's already moved on. See both
    // functions' own comments for the race this fixes.
    queryToken: 0,
    total: null,
    items: [],                // everything loaded so far in the current browse/search mode
    // Real object from the start (also reset by startCollectionBrowse on
    // every fresh query) — the scroll-triggered infinite-load observer can
    // fire loadMoreCollection() before any browse has actually begun (e.g.
    // while MAINFRAME still covers DATABASE), and used to crash reading
    // off this when it was still undefined at that point.
    seenNftIds: {},
    scopeAllItems: [],         // full resolved list for the current wallet scope (client-side filtered)
    mode: 'browse',            // 'browse' | 'search' | 'scoped'
    // Default landing sort is FL00R $P!GE0NS (lowest listed price first),
    // not RAR!TY — see scyllaListedOnly below and loadMoreCollection's own
    // chain-to-average-sale-price once the floor listings run out.
    // RESET still goes back to RARITY_ASC specifically (its own hardcoded
    // value, not this one) — this only governs the very first page load.
    sort: 'SCYLLA_PRICE_ASC',
    edition: 'ALL',            // 'ALL' | 'LOW' (1-1515) | 'HIGH' (1516-3015)
    activeTab: null,           // null | 'database' | 'mypigeons' | 'topholders' | 'sales'
    databaseLoaded: false,
    statsLoaded: false,       // universal info box — loads once, on the first tab opened, regardless of which
    salesLoaded: false,
    traitFilters: [],         // [{ id, category, value }]
    nextTraitRowId: 1,
    traitCategories: null,     // [name, name, ...] — cheap, loaded once
    traitValuesCache: {},      // category -> [{value, count, percent}], fetched lazily per category
    collectionSizeApprox: 3015,
    currentDetail: null,
    targetAssets: {},         // nftId -> { nftId, number, image } — only while scope is a wallet
    sales: { skip: 0, hasMore: true, loading: false, opened: false, currency: 'XRP' },
    scyllaListedOnly: true,   // whole-collection LISTED filter — Pigeons listed through Scylla itself; starts true to match the default FL00R $P!GE0NS landing sort above
    offerAssets: {},          // nftId -> { nftId, number, image } — up to 4, YOUR pigeons in the persistent trade builder
    dbView: 'thumbnails',     // 'boxed' (full detail row) | 'thumbnails' (5-across, # + rarity only, default) — DATABASE grid only
    simpleOffer: { mine: null, theirs: null }, // V1 CREATE OFFER (PλWS tab) — { nftId, number, image, owner } or null per side, single pick each, separate from offerAssets/targetAssets above
    simpleOfferPickingTheirs: false // true while 0FFER F0R is being picked directly off the real, full DATABASE — see enterTheirsPickMode
  };

  // Per-collection config driving everything collection-aware on this page
  // (card labels, price-currency suffixes, the trustline banner, DATABASE's
  // own title, etc. — see switchCollection/updateTrustlineBannerChrome
  // further down). Declared THIS early, right next to state, on purpose —
  // it used to live much further down the file, but loadTrustlineLoginState
  // calls renderTrustlineSummary() unconditionally as part of this script's
  // own bootstrap (a few hundred lines down) whenever a signed-in wallet
  // cookie is present, and that function reads COLLECTION_META[state.collection].
  // A var declared later is still undefined at that point in top-level
  // execution — confirmed live as a hard crash on EVERY page load for a
  // signed-in wallet (worked fine signed out, since that early-return path
  // never reaches renderTrustlineSummary) that took the whole app down,
  // not just the trustline banner, since the thrown error aborted the rest
  // of this script's top-level setup too.
  // tokenLabel is what fmtPigeons/fmtPigeonsCompact append to every price
  // shown anywhere on the site (BUY N0W, offers, sales history, etc.) — one
  // field here fixes the currency name everywhere at once instead of
  // hunting down every hardcoded "$P!GE0NS" string. tokenIssuer/hasAmm
  // drive the trustline banner: tokenIssuer is the real on-ledger token
  // issuer shown next to !SSUER :: /COPY, hasAmm gates the EXCHANGE
  // CALCULAT0R + BUY $TOKEN-with-XRP panel, which only exists for
  // $P!GE0NS today (real DexScreener pair + AMM pool — see
  // quotePigeonsForXrpDrops/fetchPigeonsXrpRate in _shared.js). A
  // collection without those hides that part of the banner entirely rather
  // than showing a broken/mislabeled calculator — same graceful-
  // degradation pattern TEDDY's browse-only mode already uses.
  var COLLECTION_META = {
    pigeons: { label: 'P!GE0NS', itemLabel: 'P!GE0N', tradeable: true, tokenLabel: '$P!GE0NS', tokenIssuer: 'rfQVVT7X5FynwK87EczgP2T8RQXmQcQSf', hasAmm: true },
    phnixs: { label: 'PHN!X', itemLabel: 'PHN!X', tradeable: true, tokenLabel: '$PHN!X', tokenIssuer: 'rDFXbW2ZZCG5WgPtqwNiA2xZokLMm9ivmN', hasAmm: false },
    teddybg: { label: 'TEDDY', itemLabel: 'TEDDY', tradeable: false, tokenLabel: '$TEDDY', tokenIssuer: null, hasAmm: false }
  };

  var el = {};
  ['searchInput','searchBtn','editionSelect','dbViewSelect','resetDbBtn','sortDropWrap','sortDropLabel','sortRows','sortFlyout','sortFlyoutVals','sortScrollPrevBtn','sortScrollNextBtn',
   'dbControlsSticky','flyoutPopupBackdrop','sortFlyoutClose','traitsFlyoutClose','bottomControlsBar','bottomSortBtn','bottomTraitsBtn',
   'dbSelectWrap','dbSelectLabel','dbSelectFlyout','copyIssuerBtn','copyIssuerLabel','pigeonsLoginBtn','ciIssuerAddr','onboardLink','trustlineTitleLabel','salesCurrencyPigeonsBtn',
   'pigeonsBarLoggedOut','pigeonsBarLoggedIn','pigeonsLoggedInWallet','pigeonsLoggedInTrustline','showMyPigeonsBtn','showMyPigeonsCount','swapSignOutBtn',
   'pigeonsBalanceValue','pigeonsBalanceBuyBtn','pigeonsBalanceLoginWrap','pigeonsBarThumb',
   'pigeonsBarCalc','pigeonsCalcToggleBtn','pigeonsCalcToggleLabel','pigeonsCalcModal','pigeonsCalcCloseBtn','pigeonsCalcDexBtn','pigeonsBarRateValue','pigeonsCalcXrpInput','pigeonsCalcPigeonsInput','pigeonsDexLink',
   'screenMainframe','mainframeGrid','mainframeReopenLabel','mainframeStatsPigeons','mainframeStatsPhnixs','mainframeArrowPrev','mainframeArrowNext','mainframeProfileBtn',
   'topTabs','topTabsWrap','flockTabLabel','myPigeonsPanel','myPigeonsList','pigeonsMergedPanel',
   'myOffersPanelWrap','myOffersList','outgoingOffersList',
   'topHoldersPanelWrap','topHoldersList',
   'crownPanelWrap','crownPeriodSelect','crownLeaderboardList',
   'profilePanelWrap','profileCurrentAvatar','profileCurrentUsername','profileCurrentWallet',
   'profileUsernameInput','profileUsernameSaveBtn','profileUsernameStatus','profilePfpStatus','profilePfpGrid','profileCoinsList',
   'salesPanelWrap',
   'swapOffersPanelWrap','swapOffersList',
   'statItems','statHolders','statVolume','statListed','statFloorDeeptide','statFloorXrpCafe','statFloorDeeptideTile','statFloorXrpCafeTile',
   'statScyllaListedTile','statScyllaListedCount','statScyllaListedLabel',
   'statsCarousel','statsCarouselDots','statsPrevBtn','statsNextBtn',
   'statTraded24h','statVolume24h','statSalesTile','statSales24h','statBurntLink',
   'traitRows','clearTraitsBtn',
   'traitsHoverWrap','traitsHoverLabel','traitsFlyout','traitsFlyoutCats','traitsFlyoutVals','traitsFlyoutBack','traitsCatsScrollPrevBtn','traitsCatsScrollNextBtn',
   'statusLine','resultsBlock','resultsArea','scrollSentinel','loadMoreNote','endOfCollectionNote',
   'salesScrollBox','salesArea','salesScrollSentinel','salesLoadMoreNote','salesEndNote','salesCurrencyToggle',
   'nodeHeaderPanel','nodeAddr','nodeCount','backToFullCollectionLink','searchPanelTitle','searchPanelSubtitle',
   'flockWalletBox','flockWalletAddr','flockWalletCopyHint',
   'flockAccountBoxes','flockMyFlockBox','flockMyFlockLabel','flockBuyPigeonsBox','flockChangeCollectionBox','flockGridPanel','flockOffersBox','flockOffersCount','flockProfileBox',
   'nodeEyebrowText','walletBoxTitleMain','walletBoxTitleSub',
   'targetPigeonCard','targetPigeonImg','targetPigeonNum','targetPigeonOwner',
   'tradeBuilderPanel','offerPile','offerCount','wantPile','wantCount','completeTradeBtn','swapOffersTabBtn',
   'simpleOfferPanel','simpleOfferComingSoon','simpleOfferLive','simpleOfferMineSlot','simpleOfferTheirsSlot','simpleOfferCreateBtn','simpleOfferStatus',
   'simpleOfferPickerModal','simpleOfferPickerClose','simpleOfferPickerGrid',
   'screenSwapReview','reviewOfferPile','reviewOfferCount','reviewWantPile','reviewWantCount','reviewBackBtn','reviewCreateBtn','reviewResult',
   'screenSwapOfferConfirm','swapConfTxType','swapConfAccount','swapConfNftId','swapConfAmount','swapConfDestination','swapConfFlags','swapConfirmStatus','swapOfferConfirmBackBtn','swapOfferOpenXamanBtn',
   'screenSwapOfferResult','swapResultNftId','swapResultToWallet','swapResultStatus','swapResultOfferId','swapResultTxLink','swapResultDoneBtn',
   'screenSwapAcceptConfirm','acceptConfTxType','acceptConfAccount','acceptConfOfferId','acceptConfFromWallet','acceptConfNftId','acceptConfirmStatus','swapAcceptConfirmBackBtn','swapAcceptOpenXamanBtn',
   'screenSwapAcceptResult','acceptResultNftId','acceptResultStatus','acceptResultTxLink','acceptResultDoneBtn',
   'collectionDetailsPanel','screenBrowse','screenDetail','screenSummary','screenHistory','detailPrevBtn','detailNextBtn','backToBrowseBtnTop',
   'detailNum','detailShareBtn','detailImgBox','detailOwner','detailRarityRow','detailRarity','detailPriceRow','detailPrice','detailHighSaleRow','detailHighSale','detailRecentSaleRow','detailRecentSale','detailAvgSaleRow','detailAvgSale','detailTraits',
   'detailScyllaPrice','detailScyllaBuyBtn','detailScyllaDelistBtn','detailScyllaOwnedRow','detailScyllaListBtn','detailScyllaTransferBtn','detailScyllaCountdown','detailScyllaListingRow','detailListingsRow','detailMakeOfferRow','detailMakeOfferInput','detailMakeOfferSend','detailMakeOfferDuration','detailOffersReceived','detailLightbox','detailLightboxImg','lightboxPrevBtn','lightboxNextBtn',
   'detailHistoryToggle','detailHistoryList','historyNum','backToDetailBtn',
   'backToBrowseBtn',
   'summaryOwner','summaryList','summaryCount','offerPlaceholder','backFromSummaryBtn','continueToOfferBtn',
   'targetBar','targetBarLabel',
   'connectPanel','connectPanelTitle','connectPanelSub','connectPanelActions',
   'myPigeonsSortRow','myPigeonsSortSelect',
   'screenListResult','listResultPigeonNum','listResultPrice','listResultTxLink','listResultDoneBtn',
   'buyConfirmModal','screenBuyConfirm','buyConfPigeon','buyConfSeller','buyConfPrice','buyConfirmStatus','buyConfirmBackBtn',
   'screenBuyResult','buyResultPigeonNum','buyResultPrice','buyResultStatus','buyResultTxLink','buyResultDoneBtn',
   'buySwapModal','buySwapEntryState','buySwapTitle','buySwapXrpInput','buySwapMaxLine','buySwapInputError','buySwapReceiveValue','buySwapReceiveUnit','buySwapRate','buySwapMinReceived','buySwapSlippage','buySwapStatus','buySwapBackBtn','buySwapSignBtn',
   'buySwapTrustlineWarning','buySwapTrustlineWarningTitle','buySwapIssuerAddr','buySwapCopyIssuerBtn','buySwapCopyIssuerLabel','buySwapPayRow',
   'buySwapConfirmState','buySwapConfTxType','buySwapConfAccount','buySwapConfSendMax','buySwapConfAmount','buySwapConfEstimate','buySwapConfRate','buySwapConfSource','buySwapConfirmStatus','buySwapConfirmBackBtn','buySwapOpenXamanBtn',
   'buySwapResultState','buySwapResultReceived','buySwapResultTxLink','buySwapResultDoneBtn',
   'delistConfirmModal','screenDelistConfirm','delistConfPigeon','delistConfirmStatus','delistConfirmBackBtn',
   'screenDelistResult','delistResultPigeonNum','delistResultWalletLink','delistResultDoneBtn',
   'offerConfirmModal','offerConfPigeonImg','offerConfPigeonNum','offerConfValue','offerConfirmStatus','offerConfirmBackBtn','offerOpenXamanBtn',
   'offerConfirmForm','offerConfirmReceipt','offerReceiptPigeonNum','offerReceiptPrice','offerResultTxLink','offerResultDoneBtn',
   'offerSignalState','offerSignalPrompt','offerSignalWallet','offerSignalStatus','offerSignalSkipBtn','offerSignalSendBtn',
   'offerSignalSentConfirm','offerSignalTxLink','offerSignalDoneBtn',
   'transferConfirmModal','transferConfAccount','transferConfPigeonNum','transferConfDestination','transferConfirmStatus','transferConfirmBackBtn','transferOpenXamanBtn',
   'incomingTransfersBox','incomingTransfersList','acceptTransferConfirmModal','acceptTransferConfirmForm','acceptTransferConfPigeonNum','acceptTransferConfFrom','acceptTransferConfirmStatus','acceptTransferConfirmBackBtn','acceptTransferOpenXamanBtn',
   'acceptTransferConfirmReceipt','acceptTransferReceiptPigeonNum','acceptTransferResultDoneBtn',
   'screenTransferResult','transferResultPigeonNum','transferResultDestination','transferResultTxLink','transferResultDoneBtn',
   'amountEntryModal','amountEntryTitle','amountEntryClose','amountEntryListMode','amountEntryListInput','amountEntryListBtn','amountEntryListStatus','amountEntryListDuration',
   'amountEntryOfferMode','amountEntryOfferPigeonRow','amountEntryOfferPigeonImg','amountEntryOfferPigeonNum','amountEntryOfferBalanceLine','amountEntryOfferInput','amountEntryOfferBtn','amountEntryOfferDuration',
   'amountEntryTransferMode','amountEntryTransferInput','amountEntryTransferBtn','amountEntryTransferStatus',
   'acceptOfferConfirmModal','screenAcceptOfferConfirm','acceptOfferConfThumb','acceptOfferConfPigeon','acceptOfferConfBuyer','acceptOfferConfPrice','acceptOfferConfFee','acceptOfferConfRoyaltyRow','acceptOfferConfRoyaltyLabel','acceptOfferConfRoyalty','acceptOfferConfSellerAmount','acceptOfferConfirmStatus','acceptOfferConfirmBackBtn',
   'screenAcceptOfferResult','acceptOfferResultThumb','acceptOfferResultPigeonNum','acceptOfferResultPrice','acceptOfferResultFee','acceptOfferResultRoyaltyRow','acceptOfferResultRoyaltyLabel','acceptOfferResultRoyalty','acceptOfferResultSellerAmount','acceptOfferResultStatus','acceptOfferResultTxLink','acceptOfferResultDoneBtn'
  ].forEach(function(id){ el[id] = document.getElementById(id); });

  // #buySwapModal is now openable directly from MAINFRAME's BUY buttons
  // (previously only ever opened from inside DATABASE). It lived nested
  // inside div.page, a stacking context of its own (z-index:1) — so no
  // z-index on the modal itself could ever place it above #screenMainframe
  // (z-index:2000, a direct child of <body>), since the WHOLE of div.page
  // gets compared at body level using page's own z-index:1. Reparenting it
  // to <body> escapes that trapped stacking context so its own z-index
  // (2100) is finally compared against #screenMainframe's directly.
  document.body.appendChild(el.buySwapModal);

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  // Shared by the S0RT BY and F!LTER BY TRA!TS flyouts (both use the same
  // .traits-flyout-cats/.traits-flyout-vals structure).
  //
  // Desktop (min-width:701px, see #traitsFlyout > .traits-flyout-vals'
  // own CSS): the value pane is a real dropdown anchored top:100% under
  // the whole category strip, not a sibling row in the vertical mobile
  // list — so it needs a horizontal offset instead, lining its left edge
  // up under the clicked category chip ("come up straight under that
  // selection") rather than always the strip's own left edge. Setting an
  // inline top style here would win over that CSS top:100% (inline style
  // always beats a stylesheet rule) and render the pane back at the
  // strip's own top edge, overlapping the categories instead of sitting
  // below them — confirmed live, that's exactly what an unconditional
  // catBtn.offsetTop assignment used to do. So top is left untouched at
  // this width, and any earlier inline value is cleared.
  //
  // Below 701px, .traits-flyout-vals is position:static (categories list
  // vertically, values expand inline as an accordion) — left has no
  // effect there, so instead this aligns the pane's top with the
  // hovered/clicked category's own position, same reasoning, just on the
  // vertical axis: the mouse travels straight sideways into it instead of
  // diagonally up-and-right to reach a pane pinned at the top of a tall
  // panel. Both offsets are clamped so a category near the end of its
  // list still keeps the value pane fully inside the flyout instead of
  // running off past its edge.
  function positionFlyoutVals(flyoutEl, valsEl, catBtn){
    if (window.innerWidth > 700){
      valsEl.style.top = '';
      if (!catBtn){ valsEl.style.left = '0px'; return; }
      var maxLeft = Math.max(0, flyoutEl.clientWidth - valsEl.offsetWidth);
      valsEl.style.left = Math.min(catBtn.offsetLeft, maxLeft) + 'px';
      return;
    }
    valsEl.style.left = '';
    if (!catBtn){ valsEl.style.top = '0px'; return; }
    var maxTop = Math.max(0, flyoutEl.clientHeight - valsEl.scrollHeight);
    valsEl.style.top = Math.min(catBtn.offsetTop, maxTop) + 'px';
  }
  // "V!EW!NG WALLET <short>" reads oddly for your own wallet (ownerShort
  // is literally 'Y0U' there, from SH0W MY P!GE0NS' own
  // browseOwnerCollection(MY_WALLET, 'Y0U') call) — "Y0UR WALLET" instead
  // of "WALLET Y0U" for that one case only; every other wallet keeps the
  // plain "WALLET <short>" form.
  function walletViewingLabel(ownerShort){
    return ownerShort === 'Y0U' ? 'Y0UR WALLET' : 'WALLET ' + escapeHtml(ownerShort);
  }

  // Wraps just a bare number in the same green the header's ONLINE uses
  // (.pigeons-green-num) — used for Pigeon numbers and rarity RANKS
  // specifically (never the rarity TOTAL, e.g. RARITY 330/3015 only
  // greens the 330). Callers build the surrounding text (prefixes, #,
  // fallback strings for a null number) themselves.
  function greenNum(n){
    return '<span class="pigeons-green-num">' + n + '</span>';
  }

  // XRP amount <-> exact integer drops, via string splitting/BigInt only —
  // never a float multiplication (0.1 * 1000000 style drift is exactly
  // what XRP's own 6-decimal-place drops unit exists to avoid). Used by
  // the BUY $PIGEONS panel's YOU PAY input. Returns null for anything that
  // isn't a plain non-negative decimal with at most 6 fractional digits.
  function dropsFromXrpString(str){
    if (typeof str !== 'string') return null;
    var s = str.trim();
    if (!/^\\d+(\\.\\d{1,6})?$/.test(s) && !/^\\.\\d{1,6}$/.test(s)) return null;
    var parts = s.split('.');
    var intPart = parts[0] || '0';
    var fracPart = (parts[1] || '').padEnd(6, '0');
    try { return BigInt(intPart) * 1000000n + BigInt(fracPart); } catch (e) { return null; }
  }
  function dropsToXrpString(drops){
    var neg = drops < 0n;
    var abs = neg ? -drops : drops;
    var s = abs.toString().padStart(7, '0');
    var intPart = s.slice(0, -6);
    var fracPart = s.slice(-6).replace(/0+$/, '');
    return (neg ? '-' : '') + intPart + (fracPart ? '.' + fracPart : '');
  }

  // Live thousands-separator formatting for a plain-number input (1000
  // becomes 1,000 as you type, not just once submitted) — strips
  // anything that isn't a digit or the first decimal point, re-inserts
  // commas, and repositions the cursor by counting digits rather than
  // raw characters so typing mid-string doesn't jump the caret to the
  // end. Callers reading the value back out for submission (e.g.
  // submitMakeOffer) still need to strip commas themselves — this only
  // affects what's shown in the field.
  function formatThousandsInput(input){
    // Shorthand — a trailing k/m (case-insensitive) multiplies whatever
    // number came before it by a thousand/million: "123k" -> "123000",
    // "1.5m" -> "1500000" — then falls straight through to the normal
    // comma-formatting below exactly as if that expanded number had
    // been typed directly. Checked first since the plain digit-only
    // cleanup below would otherwise just silently discard the letter
    // and leave the number un-expanded.
    var shorthandMatch = input.value.match(/^([0-9]*\\.?[0-9]+)\\s*([kKmM])$/);
    if (shorthandMatch){
      var multiplier = shorthandMatch[2].toLowerCase() === 'k' ? 1000 : 1000000;
      input.value = String(Math.round(parseFloat(shorthandMatch[1]) * multiplier));
    }
    var raw = input.value;
    var cursorPos = input.selectionStart === null ? raw.length : input.selectionStart;
    var digitsBeforeCursor = raw.slice(0, cursorPos).replace(/[^0-9]/g, '').length;
    var cleaned = raw.replace(/[^0-9.]/g, '');
    var firstDot = cleaned.indexOf('.');
    if (firstDot !== -1){
      cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\\./g, '');
    }
    var parts = cleaned.split('.');
    var intPart = parts[0].replace(/^0+(?=\\d)/, '');
    intPart = intPart.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
    var formatted = parts.length > 1 ? intPart + '.' + parts[1] : intPart;
    input.value = formatted;
    animateOfferCoin(input);
    if (digitsBeforeCursor === 0){
      input.setSelectionRange(0, 0);
      return;
    }
    var count = 0, newPos = formatted.length;
    for (var i = 0; i < formatted.length; i++){
      if (/[0-9]/.test(formatted[i])) count++;
      if (count === digitsBeforeCursor){ newPos = i + 1; break; }
    }
    input.setSelectionRange(newPos, newPos);
  }

  // Repositions the $PIGEONS coin so it sits right against the left edge
  // of the (centered) typed number — like it's physically stuck to the
  // digits, not a fixed decoration — and gives both the coin and the
  // field a quick pulse each time the number actually changes, so typing
  // a real offer feels alive instead of just filling a plain box.
  var offerAmountMeasureCanvas = null;
  function measureTextWidth(text, font){
    if (!offerAmountMeasureCanvas) offerAmountMeasureCanvas = document.createElement('canvas');
    var ctx = offerAmountMeasureCanvas.getContext('2d');
    ctx.font = font;
    return ctx.measureText(text).width;
  }
  function animateOfferCoin(input){
    var wrap = input.closest('.make-offer-input-wrap');
    var coin = wrap && wrap.querySelector('.make-offer-input-coin');
    if (!coin) return;
    var display = input.value || input.placeholder || '';
    var style = window.getComputedStyle(input);
    var font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    var textWidth = measureTextWidth(display, font);
    var paddingLeft = parseFloat(style.paddingLeft) || 0;
    var paddingRight = parseFloat(style.paddingRight) || 0;
    var contentWidth = input.clientWidth - paddingLeft - paddingRight;
    var textLeft = paddingLeft + Math.max(0, (contentWidth - textWidth) / 2);
    var coinWidth = coin.offsetWidth || 26;
    coin.style.left = Math.max(6, textLeft - coinWidth - 6) + 'px';
    if (!input.value) return;
    coin.classList.remove('pulse');
    input.classList.remove('pulse');
    void coin.offsetWidth; // restart the animation even if it's already mid-run
    coin.classList.add('pulse');
    input.classList.add('pulse');
    setTimeout(function(){ coin.classList.remove('pulse'); input.classList.remove('pulse'); }, 420);
  }

  // ---- Top tab bar (DATABASE / MY PIGEONS / TOP 10 / SALES HISTORY) ----
  // A peer navigation axis to the detail/summary screens below: only one
  // of the four tab panels is ever visible, and only while on the browse
  // screen (INSPECT/target-summary hide all four regardless of tab).
  // Scrolls to bring the DATABASE/MY PIGEONS/etc tab strip flush with the
  // top of the viewport — not literal page position 0, which sits above
  // the trustline banner/stats carousel and left you having to scroll
  // back down manually every time a tab or screen opened. Smooth, not an
  // instant jump. Shared by showTab (clicking DATABASE/MY PIGEONS/etc
  // directly) and showScreen (detail/confirm/result screens).
  function scrollTabStripIntoView(){
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // Clicking a tab on the row (DATABASE/MY PIGEONS/TOP 100/SALES
  // HISTORY/SWAP OFFERS), or opening a detail/confirm screen, should land
  // you at the top of the page — literal scrollY 0, not a computed offset
  // to wherever the target panel's own getBoundingClientRect() happened to
  // measure. That used to be relative (window.scrollY + panel top), taken
  // one rAF tick after the tab switch — good enough for the synchronous
  // display:none toggles that just happened, but the trustline banner
  // above every panel keeps changing height as its own async data lands
  // (pigeon count, thumbnail, CONNECT!NG status resolving), same async-
  // reflow class of bug the body's own overflow-anchor:none comment
  // already describes for images loading below the fold. Depending on how
  // much of that had finished within that one tick, the target position
  // measured differently every time — landing somewhere different on
  // every click, not reliably at the top of anything. A fixed 0 can't be
  // invalidated by anything loading later, so it's the only version of
  // this that's actually predictable.
  function scrollActiveTabPanelIntoView(tab){
    // MY PIGEONS specifically lands right at its own "SH0W!NG Y0UR
    // P!GE0NS :: N" title instead of literal page top — reported live
    // (with a screenshot showing that exact line pinned to the very top
    // of the viewport) as wanting the screen to "start here", not
    // scrolled all the way up past the hero/trustline banner/tab strip
    // first every time you open it.
    if (tab === 'mypigeons'){
      el.searchPanelTitle.scrollIntoView({ block: 'start', behavior: 'auto' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  // Same flush-to-top feel as scrollTabStripIntoView, but for the results
  // list itself — picking a trait should feel like you've actually
  // selected something, not just silently re-filter a list you have to
  // scroll down to see.
  function scrollResultsIntoView(){
    window.scrollTo({ top: window.scrollY + el.resultsBlock.getBoundingClientRect().top, behavior: 'smooth' });
  }
  // Set right before a trait click's runQuery() — a fresh collection query
  // clears #resultsArea synchronously (see startCollectionBrowse), which
  // collapses the page height and would race/cancel a scroll started
  // immediately. Consumed once results actually land (loadMoreCollection's
  // first page, or runScopedQuery's synchronous filter) instead.
  var pendingTraitScroll = false;
  // skipScroll: the top tab strip's own Σκύλλα button opens PλWS just
  // like clicking it always has, but shouldn't ALSO jump the page down to
  // "SH0W!NG Y0UR P!GE0NS" — reported live as only wanting that jump from
  // the "MY P!GE0NS :: N" box itself (which still scrolls there directly,
  // see el.flockMyFlockBox's own click handler), not from opening the tab
  // in the first place.
  function showTab(tab, skipScroll){
    // 0FFER F0R picking mode (enterTheirsPickMode) legitimately visits
    // DATABASE mid-search, and comes back to PλWS itself once a pick is
    // made — cancel it only when heading somewhere unrelated (T0P 123,
    // SALES, etc.), so it doesn't keep hijacking pigeon-card clicks on a
    // tab that has nothing to do with CREATE OFFER any more.
    if (state.simpleOfferPickingTheirs && tab !== 'database' && tab !== 'mypigeons'){
      state.simpleOfferPickingTheirs = false;
      document.body.classList.remove('picking-theirs');
    }
    // PλWS shows the exact same DATABASE grid/detail view — not a
    // separate look — just scoped to your own wallet. Delegates straight
    // to browseOwnerCollection (same call SH0W MY P!GE0NS already makes),
    // which sets state.scope then calls back into showTab('mypigeons')
    // itself once scoped — guarded by the isOwnWalletScope() check below
    // so that second call falls through to the normal body instead of
    // looping back here again.
    if (tab === 'mypigeons' && MY_WALLET && !isOwnWalletScope()){
      // No separate loadMyPigeons() call here any more — browseOwner-
      // Collection's own fetch below is the exact same data (your own
      // wallet's Pigeons) and mirrors it into myPigeonsData itself once
      // it lands (see its isSelf branches). A second independent fetch
      // racing it was what made this feel slow/glitchy on open.
      browseOwnerCollection(MY_WALLET, 'Y0U', undefined, 'mypigeons');
      return;
    }
    state.activeTab = tab;
    // .paws-view still exists purely to hide the # 0R WALLET search box
    // on PλWS (this page only ever shows your own Pigeons, see the
    // .paws-view CSS rule near the top of the file). A body class, not a
    // per-element JS toggle, so it can't be fought by anything else's own
    // async display writes running after this.
    document.body.classList.toggle('paws-view', tab === 'mypigeons');
    // Trustline banner — DATABASE only now. Was shown on every tab
    // (deliberately, per an earlier decision — "no more slimmed-down
    // version") but reported live as belonging only on the collection
    // page; login is still reachable from the Σκύλλα tab's own
    // .flock-tab-login label either way, so this loses no real entry
    // point.
    el.pigeonsMergedPanel.style.display = tab === 'database' ? '' : 'none';
    // Covers every path that can leave/re-enter PλWS, including the
    // DATABASE tab click while scoped (exitWalletScope + startCollection-
    // Browse never call browseOwnerCollection, so its own call to this
    // wouldn't fire) — this title must never stay stuck once you're
    // actually looking at real DATABASE again.
    updateSearchPanelTitleForPaws();
    // DATABASE-only now — these FL00R/!TEMS/H0LDERS/24H numbers used to
    // sit above the trustline banner on every tab; moved to just above
    // SEARCH!NG $P!GE0NS DATABASE, so only DATABASE itself shows it.
    el.collectionDetailsPanel.style.display = tab === 'database' ? '' : 'none';
    // screenBrowse (search/sort/filter row, results grid, detail overlay)
    // is shared by DATABASE and PλWS now — only shown for 'mypigeons' once
    // actually scoped to your own wallet; before that (no session yet,
    // still connecting), staying hidden avoids briefly showing a stale/
    // unrelated grid underneath the CONNECTING status.
    var showBrowseChrome = tab === 'database' || (tab === 'mypigeons' && isOwnWalletScope());
    el.screenBrowse.style.display = showBrowseChrome ? '' : 'none';
    // S0RT BY / F!LTER BY TRA!TS' fixed bottom bar — same visibility rule
    // as screenBrowse itself, since there's nothing to sort/filter
    // without a grid showing. body.has-bottom-bar drives that grid's own
    // bottom padding (see .bottom-controls-bar's CSS) so the last row of
    // cards never sits hidden underneath this bar.
    el.bottomControlsBar.style.display = showBrowseChrome ? 'flex' : 'none';
    document.body.classList.toggle('has-bottom-bar', showBrowseChrome);
    if (!showBrowseChrome){ closeSortFlyout(); closeTraitsFlyout(); }
    // myPigeonsPanel only has real content left (connect status, CONNECT
    // button) while not yet scoped — title/offers-summary/pigeon-grid all
    // moved out (see renderMyPigeonsList/showTab history), so leaving it
    // visible once actually scoped left a genuinely empty bordered box
    // sitting above screenBrowse. Hidden the instant screenBrowse itself
    // takes over, same condition as its own visibility above.
    el.myPigeonsPanel.style.display = (tab === 'mypigeons' && !isOwnWalletScope()) ? '' : 'none';
    el.myOffersPanelWrap.style.display = tab === 'myoffers' ? '' : 'none';
    if (tab === 'myoffers'){ renderMyOffersList(); renderOutgoingOffersList(); }
    el.topHoldersPanelWrap.style.display = tab === 'topholders' ? '' : 'none';
    el.salesPanelWrap.style.display = tab === 'sales' ? '' : 'none';
    el.crownPanelWrap.style.display = tab === 'crown' ? '' : 'none';
    el.profilePanelWrap.style.display = tab === 'profile' ? '' : 'none';
    if (tab === 'profile') loadProfilePanel();
    el.swapOffersPanelWrap.style.display = tab === 'swapoffers' ? '' : 'none';
    // The trustline banner itself stays up across every tab, but the
    // $PIGEONS thumbnail is DATABASE-only — it's collection artwork, not
    // relevant chrome on Σκύλλα/TOP 100/SALES/SWAP OFFERS.
    el.pigeonsBarThumb.style.display = tab === 'database' ? '' : 'none';
    // A tab click can happen while the pigeon DETAIL (or its TRANSACTION
    // HISTORY) screen is open — those are normally only ever hidden by
    // showScreen, which a direct tab click bypasses, so without this the
    // detail screen stayed stuck visible underneath whatever tab you just
    // switched to instead of actually closing. Also has to clear the
    // body's own 'detail-open' class (overflow:hidden while the detail
    // screen is up) for the exact same reason — showScreen('detail')
    // is what sets it, and a tab click bypasses that too. Confirmed live:
    // clicking a wallet link from the detail/traits view (browseOwner-
    // Collection -> showTab, never touching showScreen) left the class
    // stuck forever, permanently scroll-locking the whole page.
    el.screenDetail.style.display = 'none';
    el.screenHistory.style.display = 'none';
    document.body.classList.remove('detail-open');
    var buttons = el.topTabs.querySelectorAll('.tab-btn');
    for (var i = 0; i < buttons.length; i++){
      var isActiveBtn = buttons[i].getAttribute('data-tab') === tab;
      buttons[i].classList.toggle('active', isActiveBtn);
      // On mobile the tab strip itself scrolls horizontally (see
      // .top-tabs-wrap's fade hints below) — without this, switching to a
      // tab that happens to sit off-screen leaves its own newly-active
      // underline invisible until the user thinks to swipe first.
      // inline:'nearest' keeps this from also dragging the whole PAGE
      // vertically, which a plain scrollIntoView() would do.
      if (isActiveBtn) buttons[i].scrollIntoView({ behavior:'smooth', inline:'nearest', block:'nearest' });
    }
    // The universal info box loads once, the very first time any tab is
    // opened — not gated to DATABASE any more, since it's visible on all
    // of them now.
    if (!state.statsLoaded){
      state.statsLoaded = true;
      loadCollectionStats();
    }
    // Nothing else fetches until its own tab is actually opened for the
    // first time. Default landing view is the full collection, rarity-
    // high first (state.sort's own default) — not the Σ SCYLLA LISTED filter.
    if (tab === 'database' && !state.databaseLoaded){
      state.databaseLoaded = true;
      ensureTraitsLoaded();
      runQuery();
    } else if (tab === 'mypigeons' && !MY_WALLET){
      // Only reached with no session (the delegation above only fires
      // with MY_WALLET set) — resets the panel to its logged-out state,
      // no fetch of its own.
      loadMyPigeons();
    }
    if (tab === 'mypigeons'){
      // Always refetches, not gated like myPigeonsData above — an incoming
      // offer can arrive at any time, so a stale cached view would hide a
      // real pending offer.
      loadOffersReceived();
      loadOutgoingOffers();
      loadIncomingTransfers();
    }
    if (tab === 'topholders' && topHoldersData === null){
      loadTopHolders();
    } else if (tab === 'sales' && !state.salesLoaded){
      state.salesLoaded = true;
      loadMoreSales();
    } else if (tab === 'crown' && crownData === null){
      loadCrownLeaderboard();
    } else if (tab === 'swapoffers'){
      // Always refetches (no "loaded once" guard like the others) — this
      // list changes as soon as the other side of a pending swap acts, so
      // a stale cached view would hide real progress.
      loadSwapOffersMine();
    }
    if (!skipScroll) scrollActiveTabPanelIntoView(tab);
  }
  el.topTabs.addEventListener('click', function(e){
    var btn = e.target.closest('.tab-btn');
    if (!btn) return;
    var tab = btn.getAttribute('data-tab');
    // MY PIGEONS with no active session goes straight into the real
    // Σκύλλα/Xaman login instead of requiring a second click on a CONNECT
    // button — but the tab itself still opens right away (no longer also
    // flush-scrolled down to SH0W!NG Y0UR P!GE0NS — see showTab's own
    // skipScroll comment) showing a real "connecting" status, instead
    // of the screen just sitting there doing nothing while Xaman loads.
    if (tab === 'mypigeons' && !MY_WALLET){
      showTab('mypigeons', true);
      // startAuthorize() itself renders the CONNECT!NG state immediately.
      startAuthorize();
      return;
    }
    // With the node-header BACK link hidden (SH0W MY P!GE0NS' own scope —
    // see browseOwnerCollection's hideNodeHeader), clicking DATABASE again
    // is the only way back to the full collection — make that work.
    if (tab === 'database' && state.scope){
      exitWalletScope();
      // Scoping can now happen from PλWS too (own-wallet scope, see
      // showTab), not just from already being on DATABASE — activeTab/
      // the tab-button highlight/panel visibility need an explicit
      // showTab here now, not just the data-side startCollectionBrowse.
      // databaseLoaded is already true by this point (set the first time
      // any scope was entered), so this only updates tab chrome, never
      // re-triggers a redundant full-collection fetch of its own.
      showTab('database');
      startCollectionBrowse();
      scrollActiveTabPanelIntoView('database');
      return;
    }
    // Returning to DATABASE from another tab should show the real default
    // landing state (listed Pigeons, cheapest first) again, not wherever
    // browsing happened to drift to — reported live as listed Pigeons not
    // coming up first when navigating back in. showTab's own "only fetch
    // the first time" guard (state.databaseLoaded) means a plain tab
    // switch back normally does nothing but toggle visibility, so a sort
    // change from earlier (a manual pick, or loadMoreCollection's own
    // auto-fallback once floor listings ran out — see its own comment)
    // would otherwise just sit there instead of resetting. Only refetches
    // when something has actually drifted, not on every return.
    if (tab === 'database' && state.activeTab !== 'database' && !state.scope &&
        (state.sort !== 'SCYLLA_PRICE_ASC' || !state.scyllaListedOnly)){
      state.sort = 'SCYLLA_PRICE_ASC';
      state.scyllaListedOnly = true;
      renderSortTag();
      el.statScyllaListedTile.classList.toggle('scylla-active', true);
      showTab('database');
      startCollectionBrowse();
      scrollActiveTabPanelIntoView('database');
      return;
    }
    showTab(tab, tab === 'mypigeons');
  });

  // Tab strip scroll-hint fades (see .top-tabs-wrap CSS) — measured
  // against real scrollWidth/clientWidth rather than assumed, since
  // whether it overflows at all depends on viewport width and which tabs
  // are even in the DOM (SWAP 0FFERS is flag-gated, see SWAP_BUILDER_ENABLED).
  function updateTopTabsFade(){
    var maxScroll = el.topTabs.scrollWidth - el.topTabs.clientWidth;
    el.topTabsWrap.classList.toggle('has-more-left', el.topTabs.scrollLeft > 2);
    el.topTabsWrap.classList.toggle('has-more-right', el.topTabs.scrollLeft < maxScroll - 2);
  }
  el.topTabs.addEventListener('scroll', updateTopTabsFade);
  window.addEventListener('resize', updateTopTabsFade);
  updateTopTabsFade();

  // Same "hide when there's nothing to scroll to" reasoning as
  // updateTopTabsFade above, for the desktop-only PREV/NEXT pairs
  // flanking S0RT BY's strip and F!LTER BY TRA!TS' category row (both
  // .hscroll-arrow, hidden entirely on mobile via CSS already — this only
  // ever runs their visibility on desktop). Those buttons used to render
  // unconditionally regardless of whether every item already fit on
  // screen, showing a scroll affordance for a list with nothing left to
  // scroll to. display:none/'' directly (not a class toggle) since these
  // buttons carry no other state-driven styling to preserve.
  function updateHscrollArrows(scroller, prevBtn, nextBtn){
    if (!scroller || !prevBtn || !nextBtn) return;
    var maxScroll = scroller.scrollWidth - scroller.clientWidth;
    var canScroll = maxScroll > 2;
    prevBtn.style.display = canScroll && scroller.scrollLeft > 2 ? '' : 'none';
    nextBtn.style.display = canScroll && scroller.scrollLeft < maxScroll - 2 ? '' : 'none';
  }
  function updateSortHscrollArrows(){ updateHscrollArrows(el.sortFlyoutVals, el.sortScrollPrevBtn, el.sortScrollNextBtn); }
  function updateTraitsCatsHscrollArrows(){ updateHscrollArrows(el.traitsFlyoutCats, el.traitsCatsScrollPrevBtn, el.traitsCatsScrollNextBtn); }
  el.sortFlyoutVals.addEventListener('scroll', updateSortHscrollArrows);
  el.traitsFlyoutCats.addEventListener('scroll', updateTraitsCatsHscrollArrows);
  window.addEventListener('resize', updateSortHscrollArrows);
  window.addEventListener('resize', updateTraitsCatsHscrollArrows);
  // Both lists are still empty at this point (SORT BY/categories render
  // lazily) — re-checked once real content lands, see renderSortFlyoutList
  // and the trait-categories loader below.
  // Reported live as the PREV/NEXT arrows "glitching" — not wrong forever,
  // just wrong until the next scroll/resize event happened to fire. Root
  // cause: renderSortFlyoutList's own updateSortHscrollArrows() call runs
  // the moment the strip's HTML is set, which can be BEFORE the page's own
  // web fonts finish loading — scrollWidth measured against the fallback
  // font's (different) metrics doesn't match the real font's width once it
  // swaps in, so a strip that turns out to overflow could still show no
  // arrows at all until something else happened to re-trigger the check.
  // document.fonts.ready is the direct fix — re-checks the instant the
  // real fonts are actually in place, not on a guess about which other
  // event might coincidentally follow.
  if (window.document && document.fonts && document.fonts.ready){
    document.fonts.ready.then(function(){
      updateSortHscrollArrows();
      updateTraitsCatsHscrollArrows();
    });
  }
  // Also covers layout shifts the plain window 'resize' listener above
  // can't see — sibling content (trustline banner, stats carousel, etc.)
  // finishing its own async load can change #sortDropWrap's own width
  // without the WINDOW ever resizing.
  if (window.ResizeObserver){
    new ResizeObserver(updateSortHscrollArrows).observe(el.sortFlyoutVals);
    new ResizeObserver(updateTraitsCatsHscrollArrows).observe(el.traitsFlyoutCats);
  }

  function showScreen(name){
    if (name === 'browse'){
      showTab(state.activeTab);
    } else {
      el.screenBrowse.style.display = 'none';
      el.myPigeonsPanel.style.display = 'none';
      el.myOffersPanelWrap.style.display = 'none';
      el.topHoldersPanelWrap.style.display = 'none';
      el.salesPanelWrap.style.display = 'none';
      el.swapOffersPanelWrap.style.display = 'none';
      // Nothing to sort/filter on a single-item screen (DETAIL/HIST0RY/
      // SUMMARY) — same reasoning as showTab's own bottom-bar toggle.
      el.bottomControlsBar.style.display = 'none';
      document.body.classList.remove('has-bottom-bar');
      closeSortFlyout();
      closeTraitsFlyout();
    }
    el.screenDetail.style.display = name === 'detail' ? '' : 'none';
    document.body.classList.toggle('detail-open', name === 'detail');
    el.screenHistory.style.display = name === 'history' ? '' : 'none';
    el.screenSummary.style.display = name === 'summary' ? '' : 'none';
    el.screenSwapReview.style.display = name === 'swapreview' ? '' : 'none';
    el.screenSwapOfferConfirm.style.display = name === 'swapofferconfirm' ? '' : 'none';
    el.screenSwapOfferResult.style.display = name === 'swapofferresult' ? '' : 'none';
    el.screenSwapAcceptConfirm.style.display = name === 'swapacceptconfirm' ? '' : 'none';
    el.screenSwapAcceptResult.style.display = name === 'swapacceptresult' ? '' : 'none';
    el.screenListResult.style.display = name === 'listresult' ? '' : 'none';
    // BUY $P!GE0NS (screenBuySwap/-Confirm/-Result) is a real popup now
    // (#buySwapModal), not part of this showScreen chain — see
    // openBuySwapPanel/showBuySwapState, which fully own those three
    // sub-divs' display instead. BUY N0W's own confirm/result pair
    // (screenBuyConfirm/screenBuyResult) is the same story now, inside
    // #buyConfirmModal — see openBuyConfirm/closeBuyConfirmModal. DEL!ST's
    // own pair (screenDelistConfirm/screenDelistResult) too, inside
    // #delistConfirmModal — see openDelistConfirm/closeDelistConfirmModal.
    // 0FFER's own result is a receipt sub-state inside #offerConfirmModal
    // now (see showOfferResult), not a showScreen name.
    el.screenTransferResult.style.display = name === 'transferresult' ? '' : 'none';
    // ACCEPT OFFER's own confirm/result pair are sub-states inside
    // #acceptOfferConfirmModal now (see openAcceptOfferConfirm/
    // showAcceptOfferResult/closeAcceptOfferConfirmModal), not showScreen
    // names — same change already made for BUY N0W's own modal.
    scrollTabStripIntoView();
  }

  // collection merged in here once (state.collection defaults to
  // 'pigeons') rather than added to every individual call site across the
  // file — api()/apiWithRetry() below are the only two places any
  // /api/pigeons request actually goes out.
  function api(params){
    params = Object.assign({ collection: state.collection }, params);
    var qs = Object.keys(params)
      .filter(function(k){ return params[k] !== undefined && params[k] !== null; })
      .map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    return fetch('/api/pigeons?' + qs).then(function(r){ return r.json(); });
  }
  // The wallet-list lookup (fetchAllAccountNfts -> real XRPL pagination,
  // no caching by design) genuinely takes several seconds for a wallet
  // holding a lot of NFTs, and under that load a transient failure on one
  // of the underlying calls (XRPL node, Deeptide) is a real, observed
  // possibility — silently swallowed by a plain .catch(), it left that
  // one piece of UI stuck forever while an unrelated, faster call (e.g.
  // the balance lookup running in parallel) succeeded fine, reading as
  // "sometimes one shows and not the other." One retry before giving up.
  // No timeout here used to mean a slow backend call (a big wallet's full
  // account_nfts pagination + per-item resolveOwnerCollectionLive fan-out,
  // see swap-buy-prepare.js's own comments on how slow that genuinely can
  // be) just left the fetch hanging indefinitely — "L0AD!NG WALLET..."
  // sitting there with nothing to fail or retry, which is exactly what
  // made SH0W MY NFTs feel like it "never comes up" until a manual page
  // refresh. A real timeout turns that into an actual failure this
  // function can retry on, instead of silence.
  // Bumped from 15s to 25s — directly measured the real wallet= lookup
  // taking 12-18s for a large-holder wallet even after the server-side
  // speed fixes (raised XRPL scan concurrency, longer discovery cache).
  // At 15s the client could abort a request that was about to succeed,
  // then retry straight into the same slow response again — reported
  // live as MY P!GE0NS "still getting stuck" even after those fixes.
  var API_TIMEOUT_MS = 25000;
  function apiWithRetry(params, retriesLeft){
    if (retriesLeft === undefined) retriesLeft = 2;
    params = Object.assign({ collection: state.collection }, params);
    var qs = Object.keys(params)
      .filter(function(k){ return params[k] !== undefined && params[k] !== null; })
      .map(function(k){ return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); })
      .join('&');
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, API_TIMEOUT_MS);
    return fetch('/api/pigeons?' + qs, { signal: controller.signal }).then(function(r){
      clearTimeout(timer);
      if (!r.ok) throw new Error('http_' + r.status);
      return r.json();
    }).catch(function(err){
      clearTimeout(timer);
      if (retriesLeft > 0){
        return new Promise(function(resolve){ setTimeout(resolve, 700); }).then(function(){
          return apiWithRetry(params, retriesLeft - 1);
        });
      }
      throw err;
    });
  }

  // ---- CREATE AN OFFER — persistent trade builder, always visible on
  // DATABASE. Two independent piles: offerAssets (yours) and targetAssets
  // (theirs — the SAME bucket the pre-existing target-select machinery
  // already wrote to; enterOwnerScope/browseOwnerCollection are reused
  // completely unchanged for identifying + browsing the target wallet).
  // Which pile a card's + button fills is derived purely from what wallet
  // is currently in scope, not from a separate mode flag: your own wallet
  // fills OFFER, anything else fills WANT/FOR. Neither pile is ever
  // touched just by browsing — only by explicitly adding/removing a
  // Pigeon — so switching between boxes never loses progress. ----
  var OFFER_MAX = 4;
  function offerCount(){ return Object.keys(state.offerAssets).length; }
  function targetCount(){ return Object.keys(state.targetAssets).length; }
  function isOwnWalletScope(){ return !!(state.scope && MY_WALLET && state.scope.wallet === MY_WALLET); }

  function toggleOfferAsset(p){
    if (state.offerAssets[p.nftId]){
      delete state.offerAssets[p.nftId];
    } else {
      if (offerCount() >= OFFER_MAX) return;
      state.offerAssets[p.nftId] = { nftId: p.nftId, number: p.number, image: p.image };
    }
    renderTradeBuilder();
    refreshCardSelectionStates();
    // MY PIGEONS renders its own toggle state from scratch each time
    // (cheap — a wallet's own collection, not the full 3015-item
    // database) rather than patching it into refreshCardSelectionStates,
    // which only knows about .card-select-toggle. No-ops harmlessly if
    // MY PIGEONS was never opened (myPigeonsData still null).
    if (myPigeonsData !== null) renderMyPigeonsList();
  }
  function toggleTargetAsset(p){
    if (state.targetAssets[p.nftId]){
      delete state.targetAssets[p.nftId];
    } else {
      if (targetCount() >= OFFER_MAX) return;
      state.targetAssets[p.nftId] = { nftId: p.nftId, number: p.number, image: p.image };
    }
    renderTradeBuilder();
    refreshCardSelectionStates();
  }

  function pileSlotsHtml(items, removeTitle){
    var html = items.map(function(p){
      var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="">' : '';
      return '<div class="ob-slot filled" data-nftid="' + escapeHtml(p.nftId) + '" title="' + removeTitle + '">' + img + '<span class="ob-slot-remove">×</span></div>';
    }).join('');
    for (var i = items.length; i < OFFER_MAX; i++){
      html += '<div class="ob-slot empty" title="ADD A P!GE0N">+</div>';
    }
    return html;
  }
  function updateScopeLabels(){
    if (!state.scope) return;
    if (isOwnWalletScope()){
      el.nodeEyebrowText.textContent = '// Y0UR WALLET !DENT!F!ED';
      el.walletBoxTitleMain.textContent = 'Y0UR WALLET';
      el.walletBoxTitleSub.textContent = '// BU!LD!NG Y0UR 0FFER';
      el.backToFullCollectionLink.textContent = '← BACK T0 FULL C0LLECT!0N';
    } else {
      el.nodeEyebrowText.textContent = '// TARGET N0DE !DENT!F!ED';
      el.walletBoxTitleMain.textContent = 'TARGET WALLET';
      el.walletBoxTitleSub.textContent = '// H0LDER N0DE';
      el.backToFullCollectionLink.textContent = '← EX!T TARGET WALLET :: BACK T0 FULL C0LLECT!0N';
    }
  }
  function renderTradeBuilder(){
    var offerItems = Object.keys(state.offerAssets).map(function(k){ return state.offerAssets[k]; });
    var wantItems = Object.keys(state.targetAssets).map(function(k){ return state.targetAssets[k]; });
    el.offerPile.innerHTML = pileSlotsHtml(offerItems, 'REM0VE FR0M 0FFER');
    el.offerCount.textContent = offerItems.length + ' / ' + OFFER_MAX + ' ASSETS SELECTED';
    el.wantPile.innerHTML = pileSlotsHtml(wantItems, 'REM0VE FR0M 0FFER');
    el.wantCount.textContent = wantItems.length + ' / ' + OFFER_MAX + ' ASSETS SELECTED';
    el.completeTradeBtn.disabled = offerItems.length === 0 || wantItems.length === 0;
    updateScopeLabels();
  }

  el.offerPile.addEventListener('click', function(e){
    var slot = e.target.closest('.ob-slot');
    if (!slot) return;
    if (slot.classList.contains('filled')){
      var nftId = slot.getAttribute('data-nftid');
      delete state.offerAssets[nftId];
      renderTradeBuilder();
      refreshCardSelectionStates();
      return;
    }
    // Empty OFFER slot — browse your own wallet to fill it. If a target
    // wallet is already being browsed for WANT, save/restore its picks
    // around the scope change, since browseOwnerCollection always starts
    // a fresh targetAssets for whatever wallet it's pointed at (correct
    // for its normal job — entering a brand new wallet — but not what we
    // want here, where OFFER and WANT are meant to stay independent).
    if (!MY_WALLET){
      alert('C0NNECT Σκύλλα F!RST (SEE MY P!GE0NS) T0 ADD Y0UR P!GE0NS.');
      return;
    }
    if (!isOwnWalletScope()){
      var keepWant = state.targetAssets;
      browseOwnerCollection(MY_WALLET, 'Y0U');
      state.targetAssets = keepWant;
    }
    renderTradeBuilder();
    showScreen('browse');
  });

  el.wantPile.addEventListener('click', function(e){
    var slot = e.target.closest('.ob-slot');
    if (!slot) return;
    if (slot.classList.contains('filled')){
      var nftId = slot.getAttribute('data-nftid');
      delete state.targetAssets[nftId];
      renderTradeBuilder();
      refreshCardSelectionStates();
      return;
    }
    // Empty WANT/FOR slot — picking itself happens via ADD on a Pigeon
    // card below (see handleSelect), not here. An offer has to exist
    // first, since there's nothing to trade for otherwise.
    if (offerCount() === 0){
      alert('PLEASE SELECT A P!GE0N T0 0FFER F0R.');
      return;
    }
    if (isOwnWalletScope()){
      // Currently browsing your own wallet — step back to the full
      // collection so a target Pigeon (and its owner) can be picked,
      // without clearing either pile.
      state.scope = null;
      state.scopeAllItems = [];
      state.traitFilters = [];
      renderTraitRows();
      el.nodeHeaderPanel.style.display = 'none';
      refreshSearchPanelSubtitle();
      el.searchInput.value = '';
      startCollectionBrowse();
    }
    el.resultsArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function showSwapReview(){
    var offerItems = Object.keys(state.offerAssets).map(function(k){ return state.offerAssets[k]; });
    var wantItems = Object.keys(state.targetAssets).map(function(k){ return state.targetAssets[k]; });
    el.reviewOfferPile.innerHTML = pileSlotsHtml(offerItems, '');
    el.reviewOfferCount.textContent = offerItems.length + ' / ' + OFFER_MAX + ' ASSETS';
    el.reviewWantPile.innerHTML = pileSlotsHtml(wantItems, '');
    el.reviewWantCount.textContent = wantItems.length + ' / ' + OFFER_MAX + ' ASSETS';
    el.reviewResult.style.display = 'none';
    el.reviewResult.innerHTML = '';
    showScreen('swapreview');
  }
  el.completeTradeBtn.addEventListener('click', function(){
    if (offerCount() === 0 || targetCount() === 0) return;
    showSwapReview();
  });
  el.reviewBackBtn.addEventListener('click', function(){ showScreen('browse'); });

  // ---- Real settlement, 1-for-1 only for now (first live test) — builds
  // and sends ONLY the offerer's own NFTokenCreateOffer, the "send the
  // offer" half. Reuses the exact same Xaman signing infra (prepare ->
  // confirm -> payload -> poll status) as LIST/BUY/DELIST, just against
  // new swap-offer-* endpoints; nothing about those existing flows is
  // touched. Structured to expand to 2-4 per side later (swapOfferState
  // and the poll/confirm functions don't assume 1 item, only this button's
  // guard does). ----
  var swapOfferState = null; // { nftId, toWallet, uuid, wantNftId | swapId }
  var swapOfferPollTimer = null;

  // Shared by both entry points: the original offerer (from SWAP REVIEW,
  // wantNftId starting a brand-new pair) and the counterparty reciprocating
  // an existing pair from the SWAP OFFERS tab (swapId attaching onto it).
  function startSwapOffer(nftId, toWallet, extra){
    swapOfferState = Object.assign({ nftId: nftId, toWallet: toWallet, uuid: null }, extra);
    el.swapConfirmStatus.textContent = 'VAL!DAT!NG...';
    el.swapOfferOpenXamanBtn.disabled = true;
    showScreen('swapofferconfirm');
    fetch('/api/swap-offer-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: nftId, toWallet: toWallet })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        el.swapConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        el.swapOfferOpenXamanBtn.disabled = true;
        return;
      }
      showSwapOfferConfirm(res.data.txjson);
    }).catch(function(){
      el.swapConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
      el.swapOfferOpenXamanBtn.disabled = true;
    });
  }

  el.reviewCreateBtn.addEventListener('click', function(){
    var offerIds = Object.keys(state.offerAssets);
    var wantIds = Object.keys(state.targetAssets);
    if (offerIds.length !== 1 || wantIds.length !== 1){
      alert('F0R N0W, REAL SWAPS ARE L!M!TED T0 1 P!GE0N EACH S!DE F0R TEST!NG — REM0VE EXTRA P!GE0NS T0 C0NT!NUE. (2-4 PER S!DE C0MES NEXT, 0NCE 1-F0R-1 !S C0NF!RMED W0RK!NG.)');
      return;
    }
    if (!state.scope || !state.scope.wallet){
      alert('N0 TARGET WALLET !DENT!F!ED — G0 BACK AND P!CK A WANT P!GE0N AGA!N.');
      return;
    }
    startSwapOffer(offerIds[0], state.scope.wallet, { wantNftId: wantIds[0] });
  });

  function showSwapOfferConfirm(txjson){
    el.swapConfTxType.textContent = txjson.TransactionType;
    el.swapConfAccount.textContent = txjson.Account;
    el.swapConfNftId.textContent = txjson.NFTokenID;
    el.swapConfAmount.textContent = txjson.Amount + ' DR0PS (:: 0 XRP — FREE TRANSFER 0FFER)';
    el.swapConfDestination.textContent = txjson.Destination;
    el.swapConfFlags.textContent = String(txjson.Flags);
    el.swapConfirmStatus.textContent = '';
    el.swapOfferOpenXamanBtn.disabled = false;
    el.swapOfferOpenXamanBtn.textContent = '0PEN XAMAN';
  }
  el.swapOfferConfirmBackBtn.addEventListener('click', function(){
    showScreen(swapOfferState && swapOfferState.swapId ? 'swapoffers' : 'swapreview');
  });

  el.swapOfferOpenXamanBtn.addEventListener('click', function(){
    if (!swapOfferState) return;
    el.swapOfferOpenXamanBtn.disabled = true;
    el.swapOfferOpenXamanBtn.textContent = 'REQUEST!NG...';
    el.swapConfirmStatus.textContent = '';
    // Opening the tab HERE, synchronously inside the click handler, and
    // only pointing it at the real URL once the fetch resolves — opening
    // it inside the .then() callback instead (as the async response
    // arrives) is exactly what browsers treat as an untrusted popup and
    // silently block, since it's no longer directly tied to the click.
    // Confirmed live: swapOfferState.uuid was set (payload really was
    // created), but nothing ever opened. 'noopener' deliberately dropped
    // here too — confirmed live it makes window.open() return null in
    // some browsers, which broke this exact "navigate it later" trick
    // (the tab opened but stayed on about:blank forever). Not needed for
    // safety anyway since the destination is our own trusted API response,
    // not user-supplied content.
    var xamanTab = openXamanPopup();
    fetch('/api/swap-offer-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: swapOfferState.nftId, toWallet: swapOfferState.toWallet })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        if (xamanTab) xamanTab.close();
        el.swapOfferOpenXamanBtn.disabled = false;
        el.swapOfferOpenXamanBtn.textContent = '0PEN XAMAN';
        el.swapConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      swapOfferState.uuid = res.data.uuid;
      navigateXamanPopup(xamanTab, res.data.next.always);
      el.swapOfferOpenXamanBtn.textContent = 'WA!T!NG F0R S!GNATURE...';
      el.swapConfirmStatus.innerHTML = 'S!GN !N W!TH <span style="text-transform:none;">Σκύλλα</span>, THEN RETURN HERE.<br><a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>';
      pollSwapOfferStatus();
    }).catch(function(){
      if (xamanTab) xamanTab.close();
      el.swapOfferOpenXamanBtn.disabled = false;
      el.swapOfferOpenXamanBtn.textContent = '0PEN XAMAN';
      el.swapConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });

  function pollSwapOfferStatus(){
    if (swapOfferPollTimer) clearTimeout(swapOfferPollTimer);
    if (!swapOfferState || !swapOfferState.uuid) return;
    var qs = 'uuid=' + encodeURIComponent(swapOfferState.uuid) +
      '&nftId=' + encodeURIComponent(swapOfferState.nftId) +
      '&toWallet=' + encodeURIComponent(swapOfferState.toWallet);
    if (swapOfferState.swapId) qs += '&swapId=' + encodeURIComponent(swapOfferState.swapId);
    else if (swapOfferState.wantNftId) qs += '&wantNftId=' + encodeURIComponent(swapOfferState.wantNftId);
    fetch('/api/swap-offer-status?' + qs)
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'offer_created'){
          showSwapOfferResult(data);
          return;
        }
        if (data.status === 'rejected'){
          el.swapConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.swapOfferOpenXamanBtn.disabled = false;
          el.swapOfferOpenXamanBtn.textContent = '0PEN XAMAN';
          return;
        }
        if (data.status === 'expired'){
          el.swapConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.swapOfferOpenXamanBtn.disabled = false;
          el.swapOfferOpenXamanBtn.textContent = '0PEN XAMAN';
          return;
        }
        if (data.status === 'failed'){
          el.swapConfirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.swapOfferOpenXamanBtn.disabled = false;
          el.swapOfferOpenXamanBtn.textContent = '0PEN XAMAN';
          return;
        }
        // 'pending' or 'signed_pending_ledger' — keep polling.
        swapOfferPollTimer = setTimeout(pollSwapOfferStatus, 2000);
      }).catch(function(){
        swapOfferPollTimer = setTimeout(pollSwapOfferStatus, 3000);
      });
  }

  function showSwapOfferResult(data){
    // Harmless no-op for the OLD SWAP REVIEW/reciprocate entry points
    // (already null there) — clears CREATE OFFER's (V1) own box once its
    // real offer actually lands on-ledger, since that Pigeon pair now
    // lives in the SWAP OFFERS tab instead.
    state.simpleOffer = { mine: null, theirs: null };
    renderSimpleOffer();
    el.swapResultNftId.textContent = swapOfferState.nftId;
    el.swapResultToWallet.textContent = swapOfferState.toWallet;
    el.swapResultStatus.textContent = 'YOUR 0FFER !S 0N-LEDGER';
    el.swapResultOfferId.textContent = data.offerId || '—';
    if (data.txHash){
      el.swapResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.swapResultTxLink.textContent = data.txHash;
    } else {
      el.swapResultTxLink.removeAttribute('href');
      el.swapResultTxLink.textContent = '—';
    }
    showScreen('swapofferresult');
  }
  el.swapResultDoneBtn.addEventListener('click', function(){
    if (swapOfferState && swapOfferState.swapId){
      showTab('swapoffers');
      loadSwapOffersMine();
    } else {
      showScreen('browse');
    }
  });

  // ---- SWAP OFFERS tab — every pending pair involving MY_WALLET, on
  // either side. Discovering an incoming offer, reciprocating it (reuses
  // startSwapOffer above unchanged), and accepting both live here. ----
  var swapOffersData = null;
  function swapOfferRowHtml(row){
    var myImg = row.myImage ? '<img src="' + escapeHtml(row.myImage) + '" alt="">' : 'IMAGE';
    var otherImg = row.otherImage ? '<img src="' + escapeHtml(row.otherImage) + '" alt="">' : 'IMAGE';
    var actionHtml;
    if (row.action === 'need_to_offer'){
      actionHtml = '<button class="bar-btn swap-offer-reciprocate-btn" data-swapid="' + escapeHtml(row.swapId) + '" style="width:100%; margin-top:0.5rem;">CREATE MATCH!NG 0FFER</button>';
    } else if (row.action === 'waiting_for_other_offer'){
      actionHtml = '<div class="index-line" style="margin-top:0.5rem;">WA!T!NG F0R THE 0THER WALLET T0 0FFER</div>';
    } else if (row.action === 'ready_to_accept'){
      actionHtml = '<button class="bar-btn swap-offer-accept-btn" data-swapid="' + escapeHtml(row.swapId) + '" style="width:100%; margin-top:0.5rem;">ACCEPT SWAP</button>';
    } else {
      actionHtml = '<div class="index-line" style="margin-top:0.5rem;">WA!T!NG F0R THE 0THER WALLET T0 ACCEPT</div>';
    }
    return '<div class="result-card" style="display:flex; gap:0.75rem; padding:0.75rem; align-items:center;">' +
      '<div class="pigeon-img-box" style="width:64px; height:64px; flex:0 0 auto;">' + myImg + '</div>' +
      '<div style="flex:0 0 auto; font-size:16px; color:var(--magenta);">⇄</div>' +
      '<div class="pigeon-img-box" style="width:64px; height:64px; flex:0 0 auto;">' + otherImg + '</div>' +
      '<div style="flex:1; min-width:0;">' +
        '<div class="index-line" style="margin:0;">Y0U 0FFER #' + (row.myNumber !== null && row.myNumber !== undefined ? row.myNumber : '????') +
        ' :: THEY 0FFER #' + (row.otherNumber !== null && row.otherNumber !== undefined ? row.otherNumber : '????') + '</div>' +
        '<div class="index-line" style="margin:0.25rem 0 0;">WALLET :: ' + escapeHtml(row.otherWallet) + '</div>' +
        actionHtml +
      '</div>' +
    '</div>';
  }
  function renderSwapOffersList(){
    if (swapOffersData === null){
      el.swapOffersList.innerHTML = '<div class="th-empty">L0AD!NG...</div>';
      return;
    }
    if (!swapOffersData.length){
      el.swapOffersList.innerHTML = '<div class="th-empty">N0 PEND!NG SWAP 0FFERS.</div>';
      return;
    }
    el.swapOffersList.innerHTML = swapOffersData.map(swapOfferRowHtml).join('');
  }
  function loadSwapOffersMine(){
    swapOffersData = null;
    renderSwapOffersList();
    fetch('/api/swap-offers-mine')
      .then(function(r){ return r.json(); })
      .then(function(data){
        swapOffersData = (data && data.offers) || [];
        renderSwapOffersList();
      }).catch(function(){
        swapOffersData = [];
        el.swapOffersList.innerHTML = '<div class="th-empty">// S!GNAL_L0ST — C0ULD N0T L0AD SWAP 0FFERS.</div>';
      });
  }
  el.swapOffersList.addEventListener('click', function(e){
    var reciprocateBtn = e.target.closest('.swap-offer-reciprocate-btn');
    if (reciprocateBtn){
      var swapId = reciprocateBtn.getAttribute('data-swapid');
      var row = (swapOffersData || []).filter(function(r){ return r.swapId === swapId; })[0];
      if (row) startSwapOffer(row.myNftId, row.otherWallet, { swapId: swapId });
      return;
    }
    var acceptBtn = e.target.closest('.swap-offer-accept-btn');
    if (acceptBtn){
      var acceptSwapId = acceptBtn.getAttribute('data-swapid');
      openSwapAcceptConfirm(acceptSwapId);
    }
  });

  // ---- ACCEPT SWAP — accepts the OTHER side's offer. Same prepare ->
  // confirm -> payload -> poll-status shape as everything else here, but
  // keyed by swapId only (the server looks up which offer that means). ----
  var swapAcceptState = null; // { swapId, uuid }
  function openSwapAcceptConfirm(swapId){
    swapAcceptState = { swapId: swapId, uuid: null };
    el.acceptConfirmStatus.textContent = 'VAL!DAT!NG...';
    el.swapAcceptOpenXamanBtn.disabled = true;
    showScreen('swapacceptconfirm');
    fetch('/api/swap-accept-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swapId: swapId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        el.acceptConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        el.swapAcceptOpenXamanBtn.disabled = true;
        return;
      }
      var txjson = res.data.txjson;
      el.acceptConfTxType.textContent = txjson.TransactionType;
      el.acceptConfAccount.textContent = txjson.Account;
      el.acceptConfOfferId.textContent = txjson.NFTokenSellOffer;
      el.acceptConfNftId.textContent = res.data.display && res.data.display.nftId;
      el.acceptConfFromWallet.textContent = res.data.display && res.data.display.fromWallet;
      el.acceptConfirmStatus.textContent = '';
      el.swapAcceptOpenXamanBtn.disabled = false;
      el.swapAcceptOpenXamanBtn.textContent = '0PEN XAMAN';
    }).catch(function(){
      el.acceptConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
      el.swapAcceptOpenXamanBtn.disabled = true;
    });
  }
  el.swapAcceptConfirmBackBtn.addEventListener('click', function(){ showScreen('swapoffers'); });

  el.swapAcceptOpenXamanBtn.addEventListener('click', function(){
    if (!swapAcceptState) return;
    el.swapAcceptOpenXamanBtn.disabled = true;
    el.swapAcceptOpenXamanBtn.textContent = 'REQUEST!NG...';
    el.acceptConfirmStatus.textContent = '';
    var xamanTab = openXamanPopup();
    fetch('/api/swap-accept-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swapId: swapAcceptState.swapId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        if (xamanTab) xamanTab.close();
        el.swapAcceptOpenXamanBtn.disabled = false;
        el.swapAcceptOpenXamanBtn.textContent = '0PEN XAMAN';
        el.acceptConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      swapAcceptState.uuid = res.data.uuid;
      navigateXamanPopup(xamanTab, res.data.next.always);
      el.swapAcceptOpenXamanBtn.textContent = 'WA!T!NG F0R S!GNATURE...';
      el.acceptConfirmStatus.innerHTML = 'S!GN !N W!TH <span style="text-transform:none;">Σκύλλα</span>, THEN RETURN HERE.<br><a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>';
      pollSwapAcceptStatus();
    }).catch(function(){
      if (xamanTab) xamanTab.close();
      el.swapAcceptOpenXamanBtn.disabled = false;
      el.swapAcceptOpenXamanBtn.textContent = '0PEN XAMAN';
      el.acceptConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });

  var swapAcceptPollTimer = null;
  function pollSwapAcceptStatus(){
    if (swapAcceptPollTimer) clearTimeout(swapAcceptPollTimer);
    if (!swapAcceptState || !swapAcceptState.uuid) return;
    var qs = 'uuid=' + encodeURIComponent(swapAcceptState.uuid) + '&swapId=' + encodeURIComponent(swapAcceptState.swapId);
    fetch('/api/swap-accept-status?' + qs)
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'settled'){
          el.acceptResultNftId.textContent = data.nftReceived || '—';
          el.acceptResultStatus.textContent = data.swapComplete ? 'SWAP C0MPLETE — B0TH S!DES SETTLED' : 'ACCEPTED — WA!T!NG 0N THE 0THER S!DE T0 ACCEPT Y0URS';
          if (data.txHash){
            el.acceptResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
            el.acceptResultTxLink.textContent = data.txHash;
          } else {
            el.acceptResultTxLink.removeAttribute('href');
            el.acceptResultTxLink.textContent = '—';
          }
          showScreen('swapacceptresult');
          return;
        }
        if (data.status === 'rejected'){
          el.acceptConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.swapAcceptOpenXamanBtn.disabled = false;
          el.swapAcceptOpenXamanBtn.textContent = '0PEN XAMAN';
          return;
        }
        if (data.status === 'expired'){
          el.acceptConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.swapAcceptOpenXamanBtn.disabled = false;
          el.swapAcceptOpenXamanBtn.textContent = '0PEN XAMAN';
          return;
        }
        if (data.status === 'failed'){
          el.acceptConfirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.swapAcceptOpenXamanBtn.disabled = false;
          el.swapAcceptOpenXamanBtn.textContent = '0PEN XAMAN';
          return;
        }
        swapAcceptPollTimer = setTimeout(pollSwapAcceptStatus, 2000);
      }).catch(function(){
        swapAcceptPollTimer = setTimeout(pollSwapAcceptStatus, 3000);
      });
  }
  el.acceptResultDoneBtn.addEventListener('click', function(){
    showTab('swapoffers');
    loadSwapOffersMine();
  });

  function refreshCardSelectionStates(){
    document.querySelectorAll('.result-card').forEach(function(card){
      var id = card.getAttribute('data-nftid');
      var offerCtx = isOwnWalletScope();
      var inTarget = offerCtx ? !!state.offerAssets[id] : !!state.targetAssets[id];
      card.classList.toggle('in-target', inTarget);
      var btn = card.querySelector('.select-btn');
      if (btn){ btn.classList.toggle('selected', inTarget); btn.textContent = inTarget ? 'SELECTED' : 'SELECT'; }
      var toggle = card.querySelector('.card-select-toggle');
      if (toggle){
        toggle.classList.toggle('selected', inTarget);
        toggle.textContent = inTarget ? '✓' : '+';
        var atCapNow = offerCtx
          ? (!inTarget && offerCount() >= OFFER_MAX)
          : (!inTarget && targetCount() >= OFFER_MAX);
        toggle.classList.toggle('at-cap', atCapNow);
      }
    });
  }

  // ---- SELECT/ADD behaviour: your own wallet in scope fills OFFER;
  // anything else fills WANT/FOR (an offer must exist first), and the
  // first WANT pick auto-identifies + browses that Pigeon's owner via the
  // pre-existing enterOwnerScope/browseOwnerCollection. ----
  function handleSelect(p){
    if (isOwnWalletScope()){
      toggleOfferAsset(p);
      return;
    }
    if (offerCount() === 0){
      alert('PLEASE SELECT A P!GE0N T0 0FFER F0R.');
      return;
    }
    // A trade needs two different wallets — a Pigeon you already own can't
    // go on the WANT side (mirrors the same "not your own" rule BUY
    // enforces server-side for the $PIGEONS marketplace).
    if (MY_WALLET && p.owner === MY_WALLET){
      alert('THAT\\'S ALREADY Y0UR P!GE0N — P!CK 0NE FR0M AN0THER WALLET F0R THE TRADE.');
      return;
    }
    if (!state.scope){
      enterOwnerScope(p);
    } else {
      toggleTargetAsset(p);
    }
  }

  // Title stays constant ("SEARCHING $PIGEONS DATABASE") regardless of
  // scope — this subtitle underneath only shows up when actually scoped to
  // a wallet ("DATABASE VIEW" as the default-state label was redundant
  // noise and got dropped).
  function refreshSearchPanelSubtitle(){
    // Redundant with the "V!EW!NG WALLET ..." status line and the node
    // header's own wallet address below — never shown now.
    el.searchPanelSubtitle.style.display = 'none';
    el.searchPanelSubtitle.textContent = '';
  }
  // PλWS reuses this same panel/grid (see showTab) but only ever shows
  // your own Pigeons, search box hidden entirely (.paws-view CSS) — the
  // static "SEARCH!NG $P!GE0NS DATABASE" title reads wrong there, so it
  // becomes a real held-count instead whenever actually on that tab,
  // scoped to yourself. Reverts the instant any other tab (or DATABASE
  // itself) is active — this must never bleed into the real DATABASE view.
  function updateSearchPanelTitleForPaws(){
    var onFlock = state.activeTab === 'mypigeons' && isOwnWalletScope();
    el.searchPanelTitle.textContent = onFlock
      ? 'SH0W!NG Y0UR ' + collectionItemLabel() + 'S :: ' + state.scopeAllItems.length
      : 'SEARCH!NG ' + COLLECTION_META[state.collection].tokenLabel + ' DATABASE';
    el.searchPanelTitle.classList.toggle('search-panel-title-flock', onFlock);
    el.flockAccountBoxes.style.display = onFlock ? '' : 'none';
    el.flockWalletBox.style.display = onFlock ? '' : 'none';
    if (onFlock && el.flockWalletAddr.textContent !== MY_WALLET){
      el.flockWalletAddr.textContent = MY_WALLET;
    }
    if (onFlock){
      // myOwnPigeonsCache stays null until the real held-Pigeons fetch
      // actually resolves (see loadTrustlineLoginState) — state.scopeAllItems
      // defaults to [] the whole time, so reading its .length here used to
      // show "MY P!GE0NS :: 0" the instant this tab opened, indistinguishable
      // from a genuinely empty wallet. The underscore is a real loading
      // state, not a fake zero.
      // myOwnPigeonsCacheFailed distinguishes "still loading" from "gave
      // up" — a real XRPL account_nfts lookup for a big wallet can take
      // long enough that apiWithRetry exhausts its own retries, and this
      // used to just silently swallow that (a bare .catch(function(){}))
      // and leave the underscore pulsing forever with no way to tell it
      // had actually already failed for good, reported live as "it just
      // shows MY P!GE0NS :: _ ... glitching". A real failed state now,
      // with a tap-to-retry instead of a dead end.
      // The underscore itself read as broken/glitchy rather than "in
      // progress" — a real word, still pulsing via .flock-count-loading,
      // actually reads as a loading state instead of cryptic leftover
      // text.
      el.flockMyFlockLabel.classList.toggle('flock-count-loading', myOwnPigeonsCache === null && !myOwnPigeonsCacheFailed);
      el.flockMyFlockLabel.classList.toggle('flock-count-failed', myOwnPigeonsCacheFailed);
      el.flockMyFlockLabel.textContent = 'MY P!GE0NS :: ' + (myOwnPigeonsCacheFailed ? 'TAP T0 RETRY' : myOwnPigeonsCache === null ? 'L0AD!NG...' : state.scopeAllItems.length);
    }
    // DATABASE's own grid panel never collapses — only MY FL0CK's copy of
    // it does, and only while actually on FL0CK.
    // Reverted a bad fix here: #flockGridPanel is NOT vestigial — it
    // directly wraps resultsBlock/resultsArea (the real grid), so this
    // line alone already correctly hides it while flockCollapsed. An
    // earlier attempt additionally hid el.screenBrowse itself, which
    // ALSO contains flockWalletBox/flockAccountBoxes as siblings inside
    // it — that bricked the whole Σκύλλα tab (wallet box, account boxes,
    // everything) with nothing left visible to click to undo it. Confirmed
    // live as "not loading Σκύλλα at all when logged in" — never do that
    // again; only flockGridPanel should ever collapse here.
    el.flockGridPanel.style.display = (onFlock && state.flockCollapsed) ? 'none' : '';
  }
  // Shared by SELECT (auto-enters owner scope + auto-targets the pigeon
  // that got you there) and the plain "view this wallet's collection" click
  // on an owner address (no auto-targeting).
  // targetPigeon is optional — set only when arriving here via SELECT on
  // a specific Pigeon (owner-links, top holders, MY PIGEONS etc. browse a
  // wallet directly with no "target" pigeon that led here).
  function browseOwnerCollection(wallet, ownerShort, targetPigeon, landOnTab){
    state.scope = { wallet: wallet, ownerShort: ownerShort || wallet };
    state.targetAssets = {};
    state.traitFilters = [];
    // A trait click just before this (setting pendingTraitScroll, see its
    // own declaration) could otherwise survive to hijack THIS view's own
    // top-of-page scroll (scrollActiveTabPanelIntoView below, via
    // showTab) — runScopedQuery's own pendingTraitScroll check doesn't
    // know this is a different navigation, so a stale true here scrolled
    // straight to the results block instead, cutting off the hero/tabs/
    // banner above it (reported live as "should show from the top").
    pendingTraitScroll = false;
    renderTraitRows();
    el.searchInput.value = '';
    // The "WALLET !DENT!F!ED"/TARGET WALLET node-header chrome belongs to
    // the trade-target-selection system (SWAP_BUILDER_ENABLED, currently
    // off) — never shown any more regardless of how this wallet got
    // browsed to. The DATABASE tab itself is the way back to the full
    // collection (see exitWalletScope / the topTabs click handler), same
    // as SH0W MY P!GE0NS already worked.
    el.nodeHeaderPanel.style.display = 'none';
    el.nodeAddr.textContent = state.scope.ownerShort;
    refreshSearchPanelSubtitle();
    if (targetPigeon){
      el.targetPigeonCard.style.display = '';
      el.targetPigeonImg.innerHTML = targetPigeon.image ? '<img src="' + escapeHtml(targetPigeon.image) + '" alt="">' : 'IMAGE';
      el.targetPigeonNum.innerHTML = targetPigeon.number !== null ? collectionItemLabel() + ' #' +greenNum(targetPigeon.number) : collectionItemLabel() + ' ...';
      el.targetPigeonOwner.textContent = state.scope.ownerShort;
    } else {
      el.targetPigeonCard.style.display = 'none';
    }
    // SH0W MY P!GE0NS reuses the exact list already fetched once at login
    // (see loadTrustlineLoginState's myOwnPigeonsCache) — paints instantly
    // from memory instead of waiting on a second identical fetch. Still
    // kicks off a fresh fetch below regardless, to self-heal against
    // anything that changed since login (bought/sold/received a pigeon).
    var isSelf = MY_WALLET && wallet === MY_WALLET;
    if (isSelf && myOwnPigeonsCache !== null){
      state.scopeAllItems = myOwnPigeonsCache;
      el.nodeCount.textContent = 'P!GE0NS HELD :: ' + state.scopeAllItems.length;
      // Mirrors into myPigeonsData (CREATE OFFER's Y0UR P!GE0N picker
      // source) instead of that picker triggering its own separate
      // apiWithRetry({wallet}) fetch — this scoped fetch is already the
      // exact same data. A second independent fetch of the same slow,
      // uncached, real-XRPL-backed wallet-NFT lookup (see loadMyPigeons'
      // own comment on how slow this genuinely is for a big wallet) was
      // what made opening PλWS feel like it was "glitching": two fetches
      // racing, two separate re-renders landing at different times.
      myPigeonsData = state.scopeAllItems;
      renderMyPigeonsList();
      if (state.scopeAllItems.length){
        runScopedQuery();
      } else {
        el.statusLine.innerHTML = '<div class="results-trait-note">V!EW!NG ' + walletViewingLabel(state.scope.ownerShort) + ' (<span class="hi">0</span> P!GE0NS)</div>';
        el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0NS F0UND', ['TH!S WALLET 0WNS N0 P!GE0NS.'], false);
      }
    } else {
      // Old status line (still showing whatever query was active before this
      // click, e.g. "SH0W!NG RESULTS F0R :: 3015 P!GE0NS") stayed up
      // through the whole fetch — looked like nothing had happened yet.
      // Now replaced immediately so it's clear a wallet lookup is in
      // flight, not just a slow re-render of the same list.
      el.statusLine.innerHTML = '<div class="results-trait-note">' + (isSelf ? 'L0AD!NG Y0UR P!GE0NS...' : 'L0AD!NG WALLET ' + escapeHtml(state.scope.ownerShort) + '...') + '</div>';
      // Same reasoning for the grid itself — this covers both "someone
      // else's wallet" and "your own, but the first fetch this session
      // hasn't landed yet" (myOwnPigeonsCache still null). Without this,
      // #resultsArea just sat on whatever it last showed (often empty)
      // until the fetch below resolved — reported live as "flashes and
      // shows empty space".
      el.resultsArea.innerHTML = '<div class="loading-note">L0AD!NG P!GE0NS...</div>';
    }
    // Force the DATABASE tab regardless of which tab we were on (a wallet
    // click from Top 10 / Sales Data should always land here) — and mark it
    // loaded first so opening it doesn't ALSO kick off a full-collection
    // fetch that would race this wallet-scoped one.
    state.databaseLoaded = true;
    // showTab's own "if (tab === 'database' && !state.databaseLoaded)"
    // branch is what normally fires ensureTraitsLoaded() — with
    // databaseLoaded already forced true just above, that branch never
    // runs, which (since PλWS/SH0W MY P!GE0NS can now be the very first
    // scope entered in a session — see showTab) left state.traitExamples
    // permanently empty and every detail-screen trait cell's real Pigeon-
    // photo background (traitCellHtml's has-preview) silently missing for
    // the rest of the session. Called directly here instead so it fires
    // regardless of entry path; harmless/no-op if it already loaded.
    ensureTraitsLoaded();
    showTab(landOnTab || 'database');
    // state.activeTab (set by showTab just above) is what this checks —
    // must run after, not before, or it'd still see the previous tab.
    updateSearchPanelTitleForPaws();
    renderTradeBuilder();
    // isSelf shares loadMyOwnPigeonsCache's own in-flight/cached request
    // (see its own comment) instead of firing a second, identical
    // apiWithRetry({wallet}) call — that duplicate was the real reason
    // the tab label (fed by the eager login-time fetch) could show a
    // real count while this grid was still separately, redundantly
    // loading.
    (isSelf ? loadMyOwnPigeonsCache() : apiWithRetry({ wallet: wallet })).then(function(data){
      state.scopeAllItems = isSelf ? myOwnPigeonsCache : (data.items || []);
      if (isSelf){
        myPigeonsData = state.scopeAllItems;
        renderMyPigeonsList();
      }
      el.nodeCount.textContent = 'P!GE0NS HELD :: ' + state.scopeAllItems.length;
      updateSearchPanelTitleForPaws();
      if (!state.scopeAllItems.length){
        el.statusLine.innerHTML = '<div class="results-trait-note">V!EW!NG ' + walletViewingLabel(state.scope.ownerShort) + ' (<span class="hi">0</span> P!GE0NS)</div>';
        el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0NS F0UND', ['TH!S WALLET 0WNS N0 P!GE0NS.'], false);
        return;
      }
      runScopedQuery();
      // isSelf already merges pendingIds in via loadMyOwnPigeonsCache
      // itself — this covers browsing someone ELSE's wallet, same fast-
      // phase-then-merge reasoning.
      if (!isSelf && data.pendingIds && data.pendingIds.length){
        resolvePendingWalletItems(wallet, data.pendingIds, function(extra){
          // Guard against having since exited this scope (a different
          // wallet, or back to the full collection) by the time this
          // slower follow-up lands.
          if (!state.scope || state.scope.wallet !== wallet) return;
          state.scopeAllItems = state.scopeAllItems.concat(extra).sort(function(a, b){ return (a.number || 0) - (b.number || 0); });
          el.nodeCount.textContent = 'P!GE0NS HELD :: ' + state.scopeAllItems.length;
          runScopedQuery();
        });
      }
    }).catch(function(){
      if (!isSelf || myOwnPigeonsCache === null){
        // A real retry button, not just inert "TRY AGA!N." text — this
        // used to leave a genuine dead end here: apiWithRetry had already
        // exhausted its own retries by the time this catch runs, and
        // nothing on screen could do anything about it short of a full
        // page refresh (confirmed as exactly what SH0W MY NFTs' own
        // "never comes up" reports meant in practice). Re-running the
        // exact same call is enough — nothing about scope/targetPigeon/
        // landOnTab needs to change for a plain retry.
        el.resultsArea.innerHTML = emptyStateHtml('// S!GNAL_L0ST', ['C0ULD N0T LOAD TH!S WALLET.'], true, 'TRY AGA!N');
        var retryBtn = document.getElementById('clearSearchBtn');
        if (retryBtn) retryBtn.addEventListener('click', function(){
          browseOwnerCollection(wallet, ownerShort, targetPigeon, landOnTab);
        });
      }
    });
    // Scoped to your own wallet — ownedPigeonActionHtml (via
    // pigeonsActionBoxHtml) needs the same real listing/offers data the MY
    // PIGEONS tab fetches, so it can show L!STED+DEL!ST or a real received
    // offer instead of always defaulting to "unlisted". Re-renders the
    // scoped grid once each lands (guarded against having since exited
    // this scope).
    if (isSelf){
      fetch('/api/swap-listing-owned?wallet=' + encodeURIComponent(wallet) + '&collection=' + encodeURIComponent(state.collection)).then(function(r){ return r.json(); }).then(function(listedRes){
        myListedData = (listedRes && listedRes.listed) || {};
        if (isOwnWalletScope()) runScopedQuery();
      }).catch(function(){});
      loadOffersReceived();
      loadOutgoingOffers();
      loadIncomingTransfers();
    }
  }

  function enterOwnerScope(targetPigeon){
    if (!targetPigeon.owner){
      alert('OWNER N0T !NDEXED F0R TH!S P!GE0N YET — TRY ANOTHER, OR !NSPECT !T AGA!N SH0RTLY.');
      return;
    }
    browseOwnerCollection(targetPigeon.owner, targetPigeon.ownerShort, targetPigeon);
    state.targetAssets[targetPigeon.nftId] = { nftId: targetPigeon.nftId, number: targetPigeon.number, image: targetPigeon.image };
    renderTradeBuilder();
    refreshCardSelectionStates();
  }

  // Exiting a scope never touches either pile — OFFER and WANT are
  // independent of whatever's currently being browsed, so you can freely
  // step back to the full collection without losing progress on either
  // side.
  function exitWalletScope(){
    state.scope = null;
    state.scopeAllItems = [];
    state.traitFilters = [];
    renderTraitRows();
    el.nodeHeaderPanel.style.display = 'none';
    refreshSearchPanelSubtitle();
    el.searchInput.value = '';
    renderTradeBuilder();
  }
  el.backToFullCollectionLink.addEventListener('click', function(e){
    e.preventDefault();
    exitWalletScope();
    startCollectionBrowse();
  });

  function emptyStateHtml(title, lines, showClear, clearLabel){
    return '<div class="empty-state">' +
      '<div class="es-title">' + escapeHtml(title) + '</div>' +
      lines.map(function(l){ return '<div class="es-line">' + escapeHtml(l) + '</div>'; }).join('') +
      (showClear ? '<button class="bar-btn" id="clearSearchBtn" style="margin-top:1.25rem;">' + escapeHtml(clearLabel || 'CLEAR SEARCH') + '</button>' : '') +
    '</div>';
  }

  // ---- Card rendering (minimal chrome: image + number + rarity + a
  // corner select toggle — 6 columns doesn't leave room for more; tap the
  // image to INSPECT for the full trait set). ----
  function listingBlockHtml(marketLabel, listing){
    var hasPrice = listing && listing.priceXrp !== null && listing.priceXrp !== undefined;
    var priceHtml = hasPrice
      ? '<div class="cl-price">' + listing.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP</div>'
      : '<div class="cl-price cl-none">N0 L!ST!NG</div>';
    var inner = '<div class="cl-market">' + marketLabel + '</div>' + priceHtml;
    // The whole box is the buy link when there's a real listing — no
    // separate BUY button, just a colored/clickable box.
    return (hasPrice && listing.buyUrl)
      ? '<a class="cl-block cl-block-buy" href="' + escapeHtml(listing.buyUrl) + '" target="_blank" rel="noopener" title="BUY 0N ' + escapeHtml(marketLabel) + '">' + inner + '</a>'
      : '<div class="cl-block">' + inner + '</div>';
  }
  // DATABASE cards: a wide row (thumbnail/number/rarity on the left,
  // every other detail on the right) instead of a grid tile — reuses
  // .result-card for all the existing selection-state/click-handling
  // hooks (in-target, .pigeon-img-box, .card-select-toggle) unchanged;
  // .result-row is purely the new visual layout on top of that, so MY
  // PIGEONS' own tile cards (myPigeonCardHtml, .result-card only, no
  // .result-row) are completely unaffected.
  // Percent/count aren't part of the bulk /api/pigeons item shape (only the
  // single-item "detail" fetch merges those in server-side) — looked up
  // here from state.traitCategories instead, the same collection-wide
  // trait-card data the TRAITS flyout already fetches once and caches, so
  // this costs zero extra requests even across thousands of cards.
  // trait_type/value on each cell so a click can filter the browse view
  // down to exactly that trait (see wireResultClicks' .card-trait-cell
  // handler) — same real percent/count lookup as before.
  function cardTraitsHtml(p){
    if (!p.attributes || !p.attributes.length) return '';
    return '<div class="card-trait-grid">' + p.attributes.map(function(a){
      var catValues = state.traitCategories && state.traitCategories[a.trait_type];
      var match = catValues ? catValues.filter(function(v){ return v.value === a.value; })[0] : null;
      // Percent is the whole point of browsing traits — it gets equal
      // billing with the value itself, not a tiny afterthought line.
      var pctHtml = match
        ? '<div class="card-tc-pct">' + match.percent.toFixed(3) + '%' + (match.count !== null && match.count !== undefined ? '<span class="card-tc-count">(' + match.count + ')</span>' : '') + '</div>'
        : '';
      return '<div class="card-trait-cell" data-trait="' + escapeHtml(a.trait_type) + '" data-value="' + escapeHtml(a.value) + '" title="SH0W 0NLY P!GE0NS W!TH TH!S TRA!T, RAREST F!RST"><div class="card-tc-label">' + escapeHtml(a.trait_type) + '</div><div class="card-tc-value">' + escapeHtml(a.value) + '</div>' + pctHtml + '</div>';
    }).join('') + '</div>';
  }
  // Full-width OFFER $PIGEONS strip, shared by both the boxed and
  // THUMBNAILS card layouts — the collection's own coin icon (not the
  // individual Pigeon's thumbnail), amount input always visible, no
  // click-to-reveal step. Handlers key off the shared .result-card
  // ancestor, so this works identically in both views.
  // One unified action box, buttons only now — the price used to live in
  // here too (a plain line above BUY N0W, or "Y0UR L!ST!NG :: 444K" for
  // your own), which meant the box grew/shrank by state and never read as
  // one consistent control. Real price now lives on the picture itself
  // instead (.thumb-listing-badge, bottom-right corner — see
  // thumbnailCardHtml), so this box is always exactly the same shape
  // regardless of state: two buttons (BUY N0W + 0FFER) if it's a real
  // listing you can buy, one button (CANCEL) if it's your own listing,
  // one button (0FFER) if it's neither, or a plain label (!N Y0UR FL0CK)
  // if it's yours and unlisted — never a variable-height stack of price/
  // countdown/button lines.
  function pigeonsActionBoxHtml(p){
    // Browse only for PHN!X/TEDDY (see COLLECTION_META/switchCollection) —
    // BUY N0W/0FFER/CANCEL all call $PIGEONS-specific endpoints
    // (swap-makeoffer-*, swap-buy-*) that assume PIGEON_ISSUER/TAXON, no
    // login/trustline is wired up for these collections either. No box at
    // all rather than buttons that would silently fail against the wrong
    // collection.
    if (!COLLECTION_META[state.collection].tradeable) return '';
    if (p.owner === MY_WALLET){
      // Full unscoped DATABASE browsing doesn't have myListedData/
      // offersByNftId loaded (only the SH0W MY P!GE0NS scope explicitly
      // fetches both, see browseOwnerCollection), so the real LIST/
      // DELIST/OFFERS box isn't available here — but a Pigeon that
      // carries a real Σκύλλα listing (e.g. showing up while browsing
      // FL00R $P!GE0NS, sorted alongside everyone else's real listings)
      // still needs SOMETHING here, not a blank box where the action
      // area is for every other card — confirmed live, that read as a
      // broken/empty card rather than "this one's yours."
      if (isOwnWalletScope()) return ownedPigeonActionHtml(p);
      if (p.scyllaListing){
        // Same .delist-pigeon-btn class/handling ownedPigeonActionHtml's
        // own DELIST button uses (wireResultClicks' delegated listener
        // already covers el.resultsArea too) — no separate wiring needed.
        return '<div class="thumb-offer thumb-offer-own" data-nftid="' + escapeHtml(p.nftId) + '">' +
          '<div class="owned-action-row">' +
            '<button class="bar-btn delist-pigeon-btn" data-nftid="' + escapeHtml(p.nftId) + '">CANCEL</button>' +
          '</div>' +
        '</div>';
      }
      // A real L!ST button now, same box/size as a lone 0FFER button —
      // was a plain "!N Y0UR FL0CK" text label (see the OWNED sticker on
      // the thumbnail itself, thumb-owned-badge, for that same "this is
      // yours" signal now). Reuses .list-open-modal-btn/openAmountEntry-
      // Modal exactly as ownedPigeonActionHtml's own L!ST button does —
      // only needs p itself, not myListedData (see this function's own
      // comment on why that isn't loaded here).
      return '<div class="thumb-offer thumb-offer-own" data-nftid="' + escapeHtml(p.nftId) + '">' +
        '<button class="bar-btn list-open-modal-btn thumb-list-btn" data-nftid="' + escapeHtml(p.nftId) + '">L!ST</button>' +
      '</div>';
    }
    var canBuy = !!p.scyllaListing && p.owner !== MY_WALLET;
    // No inline OFFER AMOUNT input on the card any more — just a button
    // that opens the shared amount-entry popup (see openAmountEntryModal
    // and .offer-open-modal-btn in wireResultClicks) to actually type
    // the number.
    // BUY N0W + 0FFER sit side by side (.owned-action-row, same pairing
    // CANCEL/TRANSFER already uses) instead of stacked — when there's no
    // real listing (canBuy false) 0FFER is still wrapped in the same row
    // alone, so its width behaves identically either way.
    return '<div class="thumb-offer" data-nftid="' + escapeHtml(p.nftId) + '">' +
      '<div class="owned-action-row">' +
        (canBuy ? '<button class="buy-scylla-btn thumb-buy-btn" data-nftid="' + escapeHtml(p.nftId) + '">' +
          '<span class="thumb-buy-label">BUY N0W</span>' +
          '<span class="thumb-buy-price">' + escapeHtml(fmtPigeonsCompact(p.scyllaListing.price)) + '</span>' +
        '</button>' : '') +
        '<button class="bar-btn offer-open-modal-btn" data-nftid="' + escapeHtml(p.nftId) + '">0FFER</button>' +
      '</div>' +
    '</div>';
  }
  function resultCardHtml(p){
    var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : 'IMAGE';
    var num = p.number !== null ? '#' + greenNum(p.number) : '#????';
    var offerCtxCard = isOwnWalletScope();
    var inTarget = offerCtxCard ? !!state.offerAssets[p.nftId] : !!state.targetAssets[p.nftId];
    var atCap = offerCtxCard
      ? (!inTarget && offerCount() >= OFFER_MAX)
      : (!inTarget && targetCount() >= OFFER_MAX);
    // Order: marketplace listings, then the $PIGEONS listing (styled like
    // a currency — coin icon + amount), then traits, then a rarity-score
    // placeholder, then a link through to the full sales history page,
    // then (if unlisted) the NO LISTINGS strip pushed to the bottom.
    var xcListing = p.listings && p.listings.xrpCafe;
    var dtListing = p.listings && p.listings.deeptide;
    var hasXcListing = xcListing && xcListing.priceXrp !== null && xcListing.priceXrp !== undefined;
    var hasDtListing = dtListing && dtListing.priceXrp !== null && dtListing.priceXrp !== undefined;
    var hasAnyListing = hasXcListing || hasDtListing;
    // Marketplace listings live in one shared strip at the BOTTOM of the
    // card (real price + buy link when listed, "NOT LISTED" otherwise) —
    // not competing with traits/rarity up top.
    var xcBottomHtml = hasXcListing
      ? '<a class="css-item css-item-link" href="' + escapeHtml(xcListing.buyUrl || '#') + '" target="_blank" rel="noopener"><span class="css-label">XRP.CAFE</span>' + xcListing.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP</a>'
      : '<span class="css-item"><span class="css-label">XRP.CAFE</span>N0T L!STED</span>';
    var dtBottomHtml = hasDtListing
      ? '<a class="css-item css-item-link" href="' + escapeHtml(dtListing.buyUrl || '#') + '" target="_blank" rel="noopener"><span class="css-label">DEEPT!DE</span>' + dtListing.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP</a>'
      : '<span class="css-item"><span class="css-label">DEEPT!DE</span>N0T L!STED</span>';
    var bottomListingsHtml = p.listings
      ? '<div class="card-bottom-bar card-listings-bottom' + (hasAnyListing ? '' : ' card-no-listings') + '">' + xcBottomHtml + dtBottomHtml + '</div>'
      : '';
    // RARITY SCORE isn't computed yet — deliberately left as a placeholder
    // (real rank/total already exist, the score itself is a later system).
    var rarityLine = p.rarityRank ? greenNum(p.rarityRank) + '/' + (p.rarityTotal || 3015) : null;
    // Flick-through pages in the right column — TRAITS, then sale stats,
    // then the sales history itself (fetched lazily once this page is
    // reached — see the .card-page-next handler) — one at a time instead
    // of every section stacked as its own bar. RARITY isn't a page here
    // any more — it's the always-visible summary above the traits box.
    var hasHigh = p.highSaleXrp !== null && p.highSaleXrp !== undefined;
    var hasAvg = p.avgSaleXrp !== null && p.avgSaleXrp !== undefined;
    var hasSaleCount = p.saleCount !== null && p.saleCount !== undefined;
    var hasRecent = p.recentSaleXrp !== null && p.recentSaleXrp !== undefined;
    var salesPageHtml = '<div class="card-page card-page-sales" style="display:none;">' +
      ((hasHigh || hasAvg || hasSaleCount || hasRecent)
        ? (hasHigh ? '<span class="css-item"><span class="css-label">H!GHEST REC0RDED</span>' + fmtXrp(p.highSaleXrp) + ' XRP / ' + fmtPigeons(p.highSalePigeons) + '</span>' : '') +
          (hasAvg ? '<span class="css-item"><span class="css-label">AVG SALE</span>' + fmtXrp(p.avgSaleXrp) + ' XRP / ' + fmtPigeons(p.avgSalePigeons) + '</span>' : '') +
          (hasRecent ? '<span class="css-item"><span class="css-label">RECENT SALE</span>' + fmtXrp(p.recentSaleXrp) + ' XRP</span>' : '') +
          (hasSaleCount ? '<span class="css-item"><span class="css-label">T0TAL SALES</span>' + p.saleCount.toLocaleString() + '</span>' : '')
        : '<div class="th-empty">N0 SALES YET</div>') +
      '</div>';
    var historyPageHtml = '<div class="card-page card-page-history" style="display:none;">' +
        '<div class="card-history-list" data-nftid="' + escapeHtml(p.nftId) + '"><div class="th-empty">N0 H!ST0RY YET.</div></div>' +
      '</div>';
    var carouselHtml =
      '<div class="card-pages" data-page="0">' +
        '<div class="card-page card-page-traits">' + cardTraitsHtml(p) + '</div>' +
        salesPageHtml +
        historyPageHtml +
      '</div>' +
      '<button class="card-page-next" data-nftid="' + escapeHtml(p.nftId) + '">NEXT ▸</button>';
    var pigeonsActionHtml = pigeonsActionBoxHtml(p);
    // Above the traits boxes (not inside the carousel's own rarity page,
    // which stays as-is for the flick-through) — rarity is visible
    // immediately without a NEXT click.
    var rarityAboveTraitsHtml = rarityLine
      ? '<div class="card-rarity-summary"><span class="css-item"><span class="css-label">RAR!TY</span>' + rarityLine + '</span><span class="css-item"><span class="css-label">RAR!TY SC0RE</span>C0M!NG S00N</span></div>'
      : '';
    return '<div class="result-card' + (inTarget ? ' in-target' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '">' +
      '<div class="result-row">' +
        '<div class="result-row-left">' +
          '<div class="result-num">' + collectionItemLabel() + ' ' + num + '</div>' +
          '<div class="pigeon-img-box" data-nftid="' + escapeHtml(p.nftId) + '">' +
            img +
            '<button class="card-select-toggle' + (inTarget ? ' selected' : '') + (atCap ? ' at-cap' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '" title="SELECT">' + (inTarget ? '✓' : '+') + '</button>' +
          '</div>' +
          pigeonsActionHtml +
        '</div>' +
        '<div class="result-row-right">' +
          rarityAboveTraitsHtml +
          carouselHtml +
        '</div>' +
      '</div>' +
      bottomListingsHtml +
    '</div>';
  }

  // THUMBNAILS view — 5-across, image + Pigeon # + rarity only, same
  // select-toggle/detail-open hooks as the boxed view (.card-select-toggle,
  // .pigeon-img-box) so wireResultClicks needs no view-specific branching.
  function thumbnailCardHtml(p){
    var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : 'IMAGE';
    var num = p.number !== null ? '#' + greenNum(p.number) : '#????';
    var rarityLine = p.rarityRank ? '<div class="result-rarity-line">RAR!TY ' + greenNum(p.rarityRank) + '/' + (p.rarityTotal || 3015) + '</div>' : '';
    // Real XRP sale history (highSaleEntry, see toItem in api/pigeons.js)
    // is null (not 0) when a Pigeon genuinely has no recorded sale, distinct
    // from an actual free/near-free past sale — that's the "never resold
    // since mint" case, shown as COND!T!ON :: M!NT instead of a blank line
    // (per explicit confirmation — no separate "mint" data field exists,
    // this reuses the exact same avgSaleXrp null-check already driving
    // whether AVG SALE PR!CE shows at all). Both lines render label/value
    // stacked (.result-stat-stack), not side by side on one line.
    // No sale-history crawl exists for a browse-only collection at all
    // (see COLLECTION_META) — avgSaleXrp is always null for one, which
    // would otherwise show every single card as COND!T!ON :: M!NT
    // regardless of its real history. Blank instead of a guaranteed-wrong
    // label.
    var hasAvgSale = p.avgSaleXrp !== null && p.avgSaleXrp !== undefined;
    var avgSaleLine = !COLLECTION_META[state.collection].tradeable ? '' : hasAvgSale
      ? '<div class="result-rarity-line result-stat-stack"><span class="stat-label">AVG SALE PR!CE ::</span><span class="stat-value">' + greenNum(fmtXrp(p.avgSaleXrp)) + ' XRP</span></div>'
      : '<div class="result-rarity-line result-stat-stack"><span class="stat-label">COND!T!ON ::</span><span class="stat-value">' + greenNum('M!NT') + '</span></div>';
    // Real cross-market floor price (see PRICE_ASC/crossListing in
    // startCollectionBrowse) — only set on items returned by that sort,
    // so this stays blank for every other sort instead of guessing.
    // Boxed view (resultCardHtml, which already shows both marketplaces'
    // prices via bottomListingsHtml) is disabled/coming soon, so THUMBNAILS
    // is the only card ever rendered right now — without this line,
    // L0WEST (XRP) sorted the results correctly but never actually showed
    // the price being sorted on.
    var hasBestListing = p.bestListingXrp !== null && p.bestListingXrp !== undefined;
    var bestListingSourceLabel = p.bestListingSource === 'xrpCafe' ? 'XRP.CAFE' : 'DEEPT!DE';
    var bestListingUrl = hasBestListing
      ? (p.bestListingSource === 'xrpCafe' ? (p.listings && p.listings.xrpCafe && p.listings.xrpCafe.buyUrl) : (p.listings && p.listings.deeptide && p.listings.deeptide.buyUrl))
      : null;
    var bestListingLine = hasBestListing
      ? '<a class="result-rarity-line result-stat-stack" href="' + escapeHtml(bestListingUrl || '#') + '" target="_blank" rel="noopener" title="BUY 0N ' + escapeHtml(bestListingSourceLabel) + '"><span class="stat-label">L!STED :: ' + escapeHtml(bestListingSourceLabel) + '</span><span class="stat-value">' + greenNum(fmtXrp(p.bestListingXrp)) + ' XRP</span></a>'
      : '';
    var offerCtxCard = isOwnWalletScope();
    var inTarget = offerCtxCard ? !!state.offerAssets[p.nftId] : !!state.targetAssets[p.nftId];
    var atCap = offerCtxCard
      ? (!inTarget && offerCount() >= OFFER_MAX)
      : (!inTarget && targetCount() >= OFFER_MAX);
    var pigeonsActionHtml = pigeonsActionBoxHtml(p);
    // Listing price now lives here, on the picture itself (bottom-right
    // corner, see .thumb-listing-badge), not inside the purple action box
    // below — that box is buttons only now, always the same size
    // regardless of state. Own-vs-others'-listing is just a border/glow
    // colour difference (cyan vs purple, this site's established "this
    // is yours" language) on the exact same badge, not separate markup.
    var listingBadge = p.scyllaListing
      ? '<div class="thumb-listing-badge' + (p.owner === MY_WALLET ? ' thumb-listing-badge-own' : '') + '">' + escapeHtml(fmtPigeonsCompact(p.scyllaListing.price)) + '</div>'
      : '';
    var ownedBadge = (p.owner === MY_WALLET && !p.scyllaListing) ? '<div class="thumb-owned-badge">0WNED</div>' : '';
    return '<div class="result-card' + (inTarget ? ' in-target' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '">' +
      '<div class="result-num">' + collectionItemLabel() + ' ' + num + '</div>' +
      '<div class="pigeon-img-box" data-nftid="' + escapeHtml(p.nftId) + '">' +
        img +
        '<button class="card-select-toggle' + (inTarget ? ' selected' : '') + (atCap ? ' at-cap' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '" title="SELECT">' + (inTarget ? '✓' : '+') + '</button>' +
        listingBadge +
        ownedBadge +
      '</div>' +
      '<div class="result-card-body">' + rarityLine + bestListingLine + avgSaleLine + '<div class="card-action-box">' + pigeonsActionHtml + '</div></div>' +
    '</div>';
  }
  function cardHtmlForView(p){
    return state.dbView === 'thumbnails' ? thumbnailCardHtml(p) : resultCardHtml(p);
  }
  function appendResults(newItems){
    if (!newItems.length) return;
    var list = el.resultsArea.querySelector('.result-list');
    if (!list){
      el.resultsArea.innerHTML = '<div class="result-list' + (state.dbView === 'thumbnails' ? ' view-thumbnails' : '') + '"></div>';
      list = el.resultsArea.querySelector('.result-list');
    }
    list.insertAdjacentHTML('beforeend', newItems.map(cardHtmlForView).join(''));
  }
  function renderResultsReplace(items){
    el.resultsArea.innerHTML = items.length ? '<div class="result-list' + (state.dbView === 'thumbnails' ? ' view-thumbnails' : '') + '">' + items.map(cardHtmlForView).join('') + '</div>' : '';
  }

  // ---- Shared L!ST/0FFER/TRANSFER popup (#amountEntryModal) — cards
  // across DATABASE only ever show a button now; this is the one place
  // that still asks for a typed number/wallet. Each mode is its own
  // fully-formed mini strip inside the modal (see the HTML), reusing the
  // exact classes submitInlineListing/submitMakeOffer already look for
  // (.list-price-input/.list-inline-btn, .make-offer-input/.make-offer-
  // send) so neither function needed to change — only TRANSFER is new
  // (see submitTransfer below). ----
  var amountEntryPigeon = null; // the Pigeon the currently-open popup is acting on
  var amountEntryListDurationDays = 0; // real NFTokenCreateOffer Expiration — see listingExpirationRippleSeconds in _shared.js. 0 = F0REVER, the default now (was 7)
  var amountEntryOfferDurationDays = 0; // same real Expiration, for MAKE OFFER's own duration row
  function openAmountEntryModal(mode, p){
    amountEntryPigeon = p;
    el.amountEntryListMode.style.display = mode === 'list' ? '' : 'none';
    el.amountEntryOfferMode.style.display = mode === 'offer' ? '' : 'none';
    el.amountEntryTransferMode.style.display = mode === 'transfer' ? '' : 'none';
    if (mode === 'list'){
      // No header text — the input's own "ENTER AM0UNT" placeholder and
      // the L!ST button already say what this is; reported live as
      // redundant.
      el.amountEntryTitle.textContent = '';
      el.amountEntryListInput.value = '';
      el.amountEntryListBtn.disabled = false;
      el.amountEntryListBtn.textContent = 'L!ST';
      el.amountEntryListStatus.style.display = 'none';
      el.amountEntryListStatus.textContent = '';
      amountEntryListDurationDays = 0;
      el.amountEntryListDuration.querySelectorAll('.list-duration-btn').forEach(function(b){
        b.classList.toggle('active', b.getAttribute('data-days') === '0');
      });
    } else if (mode === 'offer'){
      el.amountEntryTitle.textContent = '0FFER AM0UNT';
      el.amountEntryOfferInput.value = '';
      el.amountEntryOfferBtn.disabled = false;
      el.amountEntryOfferBtn.textContent = 'SUBM!T';
      amountEntryOfferDurationDays = 0;
      el.amountEntryOfferDuration.querySelectorAll('.list-duration-btn').forEach(function(b){
        b.classList.toggle('active', b.getAttribute('data-days') === '0');
      });
      // Which Pigeon this offer is actually for — easy to lose track of
      // once the popup is open and the card underneath isn't visible.
      if (p && p.number !== null){
        el.amountEntryOfferPigeonImg.src = p.image || '';
        el.amountEntryOfferPigeonImg.style.display = p.image ? '' : 'none';
        el.amountEntryOfferPigeonNum.innerHTML = collectionItemLabel() + ' #' +greenNum(p.number);
        el.amountEntryOfferPigeonRow.style.display = '';
      } else {
        el.amountEntryOfferPigeonRow.style.display = 'none';
      }
      // trustlineBalanceNum is the same live $PIGEONS balance the
      // trustline banner itself shows (loadTrustlineLoginState) — null
      // means it hasn't loaded yet (or there's no session), in which case
      // this stays hidden rather than showing a stale/wrong 0.
      if (trustlineBalanceNum !== null){
        el.amountEntryOfferBalanceLine.innerHTML = 'Y0UR BALANCE<br>' + greenNum(trustlineBalanceNum.toLocaleString(undefined, { maximumFractionDigits: 2 })) + ' ' + COLLECTION_META[state.collection].tokenLabel;
        el.amountEntryOfferBalanceLine.style.display = '';
      } else {
        el.amountEntryOfferBalanceLine.style.display = 'none';
      }
    } else {
      el.amountEntryTitle.textContent = 'TRANSFER T0 WALLET';
      el.amountEntryTransferInput.value = '';
      el.amountEntryTransferBtn.disabled = false;
      el.amountEntryTransferBtn.textContent = 'TRANSFER';
      el.amountEntryTransferStatus.style.display = 'none';
      el.amountEntryTransferStatus.textContent = '';
    }
    el.amountEntryModal.style.display = 'flex';
    (mode === 'list' ? el.amountEntryListInput : mode === 'offer' ? el.amountEntryOfferInput : el.amountEntryTransferInput).focus();
  }
  function closeAmountEntryModal(){
    el.amountEntryModal.style.display = 'none';
    amountEntryPigeon = null;
  }
  el.amountEntryClose.addEventListener('click', closeAmountEntryModal);
  el.amountEntryModal.addEventListener('click', function(e){ if (e.target === el.amountEntryModal) closeAmountEntryModal(); });
  el.amountEntryListDuration.addEventListener('click', function(e){
    var btn = e.target.closest('.list-duration-btn');
    if (!btn) return;
    amountEntryListDurationDays = parseInt(btn.getAttribute('data-days'), 10);
    el.amountEntryListDuration.querySelectorAll('.list-duration-btn').forEach(function(b){
      b.classList.toggle('active', b === btn);
    });
  });
  el.amountEntryOfferDuration.addEventListener('click', function(e){
    var btn = e.target.closest('.list-duration-btn');
    if (!btn) return;
    amountEntryOfferDurationDays = parseInt(btn.getAttribute('data-days'), 10);
    el.amountEntryOfferDuration.querySelectorAll('.list-duration-btn').forEach(function(b){
      b.classList.toggle('active', b === btn);
    });
  });
  el.amountEntryListBtn.addEventListener('click', function(){
    if (amountEntryPigeon) submitInlineListing(amountEntryPigeon, el.amountEntryListInput.value.trim().replace(/,/g, ''), el.amountEntryListMode, amountEntryListDurationDays);
  });
  el.amountEntryOfferBtn.addEventListener('click', function(){
    if (amountEntryPigeon) submitMakeOffer(amountEntryPigeon, el.amountEntryOfferInput.value.trim().replace(/,/g, ''), el.amountEntryOfferMode, amountEntryOfferDurationDays);
  });
  el.amountEntryTransferBtn.addEventListener('click', function(){
    if (amountEntryPigeon) submitTransfer(amountEntryPigeon, el.amountEntryTransferInput.value.trim(), el.amountEntryTransferMode);
  });
  el.amountEntryModal.addEventListener('keydown', function(e){
    if (e.key !== 'Enter') return;
    if (e.target === el.amountEntryListInput) el.amountEntryListBtn.click();
    else if (e.target === el.amountEntryOfferInput) el.amountEntryOfferBtn.click();
    else if (e.target === el.amountEntryTransferInput) el.amountEntryTransferBtn.click();
  });
  // Live thousands-separator formatting as you type, same helper the
  // other amount inputs use.
  el.amountEntryModal.addEventListener('input', function(e){
    if (e.target === el.amountEntryListInput || e.target === el.amountEntryOfferInput) formatThousandsInput(e.target);
  });

  function wireResultClicks(container, source){
    container.addEventListener('click', function(e){
      // 0FFER F0R picking mode (see enterTheirsPickMode) — a click on the
      // image or the "+" toggle selects that Pigeon straight into CREATE
      // OFFER instead of opening the detail screen or the old trade
      // builder. Trait-cell clicks below still filter normally, so you
      // can narrow down the collection while picking.
      if (state.simpleOfferPickingTheirs){
        var pickTarget = e.target.closest('.pigeon-img-box') || e.target.closest('.card-select-toggle');
        if (pickTarget){
          var pickedNftId = pickTarget.getAttribute('data-nftid');
          var pickedP = source().filter(function(x){ return x.nftId === pickedNftId; })[0];
          if (pickedP){
            if (MY_WALLET && pickedP.owner === MY_WALLET){
              alert('THAT S Y0UR 0WN P!GE0N — P!CK 0NE FR0M AN0THER WALLET F0R THE SWAP.');
            } else {
              state.simpleOffer.theirs = { nftId: pickedP.nftId, number: pickedP.number, image: pickedP.image, owner: pickedP.owner || null };
              renderSimpleOffer();
              exitTheirsPickMode();
            }
          }
          return;
        }
      }
      var traitCell = e.target.closest('.card-trait-cell');
      if (traitCell){
        var trait = traitCell.getAttribute('data-trait');
        var value = traitCell.getAttribute('data-value');
        ensureTraitsLoaded().then(function(){
          state.traitFilters = [{ id: state.nextTraitRowId++, category: trait, value: value }];
          renderTraitRows();
          state.sort = 'RARITY_ASC';
          renderSortTag();
          el.searchInput.value = '';
          showScreen('browse');
          runQuery();
        });
        return;
      }
      var nextBtn = e.target.closest('.card-page-next');
      if (nextBtn){
        var cardEl = nextBtn.closest('.result-card');
        var pagesEl = cardEl.querySelector('.card-pages');
        var pages = pagesEl.querySelectorAll('.card-page');
        var current = parseInt(pagesEl.getAttribute('data-page'), 10) || 0;
        pages[current].style.display = 'none';
        current = (current + 1) % pages.length;
        var newPage = pages[current];
        newPage.style.display = '';
        pagesEl.setAttribute('data-page', String(current));
        // Sales history is fetched lazily, once this page is actually
        // reached — not for every card in the list up front.
        var historyList = newPage.querySelector('.card-history-list');
        if (historyList && !historyList.getAttribute('data-loaded')){
          historyList.setAttribute('data-loaded', '1');
          var histNftId = historyList.getAttribute('data-nftid');
          api({ history: histNftId }).then(function(data){
            var events = data.events || [];
            historyList.innerHTML = events.length
              ? events.map(historyRowHtml).join('')
              : '<div class="th-empty">N0 H!ST0RY YET.</div>';
          }).catch(function(){
            historyList.innerHTML = '<div class="th-empty">C0ULD N0T L0AD H!ST0RY.</div>';
          });
        }
        return;
      }
      var histWalletLink = e.target.closest('.card-history-list a[data-wallet]');
      if (histWalletLink){
        browseOwnerCollection(histWalletLink.getAttribute('data-wallet'), histWalletLink.getAttribute('data-short'));
        return;
      }
      // 0FFER — just a button now, no inline amount input on the card
      // (see pigeonsActionBoxHtml) — opens the shared amount-entry popup
      // to actually type it.
      var offerOpenBtn = e.target.closest('.offer-open-modal-btn');
      if (offerOpenBtn){
        var op2 = source().filter(function(x){ return x.nftId === offerOpenBtn.getAttribute('data-nftid'); })[0];
        if (op2) openAmountEntryModal('offer', op2);
        return;
      }
      var buyBtn = e.target.closest('.buy-scylla-btn');
      if (buyBtn){
        var bp = source().filter(function(x){ return x.nftId === buyBtn.getAttribute('data-nftid'); })[0];
        if (bp) openBuyConfirm(bp);
        return;
      }
      var toggle = e.target.closest('.card-select-toggle');
      if (toggle){
        var tp = source().filter(function(x){ return x.nftId === toggle.getAttribute('data-nftid'); })[0];
        if (tp){
          if (SWAP_BUILDER_ENABLED){
            handleSelect(tp);
          } else if (CREATE_OFFER_ENABLED){
            // The old multi-item trade builder this toggle used to feed is
            // hidden (SWAP_BUILDER_ENABLED false) — its own panel is
            // display:none, so handleSelect's alerts/state changes would
            // land nowhere visible. Routes to CREATE OFFER (V1) on PλWS
            // instead, with this Pigeon pre-filled as 0FFER F0R.
            window.location.href = '/static?tab=mypigeons&offerFor=' + encodeURIComponent(tp.nftId) +
              '&offerForNum=' + encodeURIComponent(tp.number) +
              '&offerForImg=' + encodeURIComponent(tp.image || '') +
              '&offerForOwner=' + encodeURIComponent(tp.owner || '');
          } else {
            alert('SWAP TRAD!NG :: C0M!NG S00N.');
          }
        }
        return;
      }
      // MY PIGEONS' own toggle — always adds to the OFFER pile directly,
      // never through handleSelect's scope-based branching (this list is
      // never "scoped" the way the DATABASE grid is, so that branching
      // would misfire here).
      var myToggle = e.target.closest('.my-pigeon-offer-toggle');
      if (myToggle){
        var mp = source().filter(function(x){ return x.nftId === myToggle.getAttribute('data-nftid'); })[0];
        if (mp) toggleOfferAsset(mp);
        return;
      }
      var imgBox = e.target.closest('.pigeon-img-box');
      if (imgBox){ openDetail(imgBox.getAttribute('data-nftid')); return; }
      // LIST/TRANSFER/DELIST/ACCEPT OFFER — rendered by ownedPigeonAction-
      // Html (own-wallet scope, shared by pigeonsActionBoxHtml/DATABASE
      // and the FL0CK tab so both containers behave identically). LIST
      // and TRANSFER are just buttons now, no inline input on the card —
      // both open the shared amount-entry popup to actually type the
      // number/wallet.
      var listOpenBtn = e.target.closest('.list-open-modal-btn');
      if (listOpenBtn){
        var lp = source().filter(function(x){ return x.nftId === listOpenBtn.getAttribute('data-nftid'); })[0];
        if (lp) openAmountEntryModal('list', lp);
        return;
      }
      var transferOpenBtn = e.target.closest('.transfer-open-modal-btn');
      if (transferOpenBtn){
        var trp = source().filter(function(x){ return x.nftId === transferOpenBtn.getAttribute('data-nftid'); })[0];
        if (trp) openAmountEntryModal('transfer', trp);
        return;
      }
      var delistBtn = e.target.closest('.delist-pigeon-btn');
      if (delistBtn){
        var dp = source().filter(function(x){ return x.nftId === delistBtn.getAttribute('data-nftid'); })[0];
        if (dp) openDelistConfirm(dp);
        return;
      }
      var acceptBtn = e.target.closest('.accept-offer-btn');
      if (acceptBtn){
        acceptOfferTarget = {
          nftId: acceptBtn.getAttribute('data-nftid'),
          offerId: acceptBtn.getAttribute('data-offerid'),
          price: acceptBtn.getAttribute('data-price'),
          buyer: acceptBtn.getAttribute('data-buyer'),
          number: acceptBtn.getAttribute('data-num') ? parseInt(acceptBtn.getAttribute('data-num'), 10) : null,
          image: acceptBtn.getAttribute('data-image') || null
        };
        openAcceptOfferConfirm();
        return;
      }
      // Persisted local dismiss (see declinedOfferIds) — nothing
      // on-ledger to cancel from the seller's side, just hides it from
      // this view, on this browser, from now on. Re-runs the current
      // scoped query so the card re-renders without the declined offer
      // immediately.
      var declineBtn = e.target.closest('.decline-offer-btn');
      if (declineBtn){
        declinedOfferIds[declineBtn.getAttribute('data-offerid')] = true;
        persistDeclinedOfferIds();
        if (isOwnWalletScope()) runScopedQuery();
        if (el.screenDetail.style.display !== 'none') updateScyllaListing(state.currentDetail);
        if (el.myOffersPanelWrap.style.display !== 'none') renderMyOffersList();
        return;
      }
    });
    // No more inline MAKE AN OFFER/LIST PRICE inputs living directly on a
    // card (see openAmountEntryModal) — their own Enter-to-submit and
    // live thousands-formatting now live with the popup itself (see the
    // el.amountEntryModal keydown/input listeners near its own wiring).
  }
  wireResultClicks(el.resultsArea, function(){ return state.items; });
  // #detailOffersReceived's ACCEPT/DECL!NE buttons (myPigeonOffersHtml) —
  // #screenDetail isn't el.resultsArea/el.myPigeonsList, so the delegated
  // listener above never saw them; the source() here only ever needs to
  // resolve the one Pigeon currently open.
  // Scoped to #detailOffersReceived specifically, NOT the whole
  // #screenDetail — confirmed live this was NOT the harmless no-op the
  // comment here used to claim: #detailImgBox also carries the
  // .pigeon-img-box class (it's the big picture you click to open the
  // fullscreen lightbox), so wiring the whole screen made every click on
  // it ALSO match wireResultClicks' own imgBox branch and call
  // openDetail(null) (no data-nftid on that element) — which wipes
  // #detailLightboxImg.src back to '' via openDetail's own "keep the
  // lightbox in sync if it's open" logic, since the lightbox had *just*
  // been opened by that same click. Broke the fullscreen view (blank
  // image) and — since navigateDetail's own PREV/NEXT relies on the
  // same sync logic — its "click through to other Pigeons" path too.
  wireResultClicks(el.detailOffersReceived, function(){ return state.currentDetail ? [state.currentDetail] : []; });

  // ---- Trait data: fetched once, real categories/values/percentages
  // straight from Deeptide's collection-wide trait-card counts (exact, not
  // sampled) — no more lazy per-category round trips needed. ----
  function ensureTraitsLoaded(){
    if (state.traitCategories) return Promise.resolve(state.traitCategories);
    return api({ traits: 1 }).then(function(data){
      state.traitCategories = data.categories || {};
      state.traitExamples = data.examples || {};
      state.collectionSizeApprox = data.collectionSizeApprox || state.collectionSizeApprox;
      // ensureTraitsLoaded() and runQuery() fire concurrently on first
      // DATABASE open (see showTab) — cards can finish rendering before
      // this resolves, which would silently leave every trait cell's
      // percent blank forever (cardTraitsHtml reads state.traitCategories
      // synchronously). Re-render whatever's already on screen once real
      // trait data arrives so the percent actually shows up.
      if (state.items && state.items.length) renderResultsReplace(state.items);
      return state.traitCategories;
    });
  }
  // ---- Infinite-scroll collection browse (real, live, always complete —
  // Deeptide's own listings endpoint, no KV involved) ----
  function startCollectionBrowse(){
    state.mode = 'collection';
    state.skip = 0;
    state.editionRawSkip = 0;
    state.items = [];
    state.hasMore = true;
    state.total = null;
    // A fresh query supersedes whatever's currently in flight — bump the
    // token (see its own declaration) and force the loading guard clear
    // so loadMoreCollection() below actually fires a new request instead
    // of silently no-op'ing because the OLD one hadn't resolved yet.
    // Confirmed live as the real cause of a sort sometimes "just not
    // loading" until clicked again: picking a new sort/filter while the
    // previous query was still in flight used to hit loadMoreCollection's
    // own loading-guard (state.loading check just below) and do nothing
    // at all, then the stale old response would land afterward and
    // render into this now-reset grid with the WRONG sort/filter applied.
    state.queryToken++;
    state.loading = false;
    // Tracks every nftId already rendered this query, across whichever
    // auto-fallback stage produced it (see loadMoreCollection's own
    // stage-2/-3 handoff below) — the different fallback endpoints each
    // paginate their own bounded set from skip 0, so the same Pigeon can
    // legitimately turn up again once browsing moves from "listed" to
    // "sold before" to "everything else"; without this it would render
    // twice.
    state.seenNftIds = {};
    el.endOfCollectionNote.style.display = 'none';
    // Every sort/filter/edition change routes through here (see runQuery)
    // and used to just blank the results area while the new page fetched
    // — same "did my click even register" dead air the search box already
    // solved for itself (see runSearchBox's own SEARCH!NG... note) but
    // never got applied here.
    el.resultsArea.innerHTML = '<div class="loading-note">L0AD!NG P!GE0NS...</div>';
    // RESET and the STAT!C://QUERY line both used to sit there showing
    // the PREVIOUS query's stale count right next to a "loading" message
    // for the NEW one — confusing, and RESET in particular reads as an
    // action you could still take on a query that's already gone. Both
    // come back once real results (or the empty-state) land, see below.
    el.statusLine.innerHTML = '';
    el.resetDbBtn.style.display = 'none';
    loadMoreCollection();
  }
  function loadMoreCollection(onDone){
    // onDone (optional) — used by detail-screen NEXT to continue past the
    // currently-loaded page: fires once this call's own fetch settles
    // (success or failure) either way, never left hanging.
    if (state.loading || !state.hasMore || state.scope){ if (onDone) onDone(); return; }
    state.loading = true;
    // Captured now, checked again once the response lands (see below) —
    // if a newer query has since started (startCollectionBrowse bumps
    // this), this response is for a sort/filter the user has already
    // moved on from and must be discarded, not rendered.
    var myQueryToken = state.queryToken;
    el.loadMoreNote.style.display = '';
    var filters = activeFilters();
    var isEdition = state.edition === 'LOW' || state.edition === 'HIGH';
    var isSalesSort = state.sort === 'HIGHEST_SALE' || state.sort === 'SALES_LOW' || state.sort === 'AVG_SALE_XRP_ASC' || state.sort === 'AVG_SALE_XRP_DESC' || state.sort === 'AVG_SALE_PIGEONS_ASC';
    var isNumericSort = state.sort === 'NAME_ASC' || state.sort === 'NAME_DESC';
    var isCrossListing = state.sort === 'PRICE_ASC' || state.sort === 'PRICE_DESC';
    var reqParams;
    if (state.scyllaListedOnly){
      // Only Pigeons actually listed through Scylla itself, sorted by real
      // $PIGEONS price — server re-verifies each item against real
      // nft_sell_offers, so a stale/cancelled listing can't linger here.
      // filters was previously dropped here too — picking a trait while
      // FL00R $P!GE0NS was active silently showed every listed Pigeon
      // instead of restricting to ones that actually carry that trait
      // (or nothing at all, if none of the current listings do). Same bug
      // existed for 1ST/2ND ED!T!0N (numberRange) — picking an edition
      // alongside any of these three sort modes silently showed the whole
      // collection instead of just that edition's slice, since only the
      // two dedicated edition branches further down ever sent it.
      reqParams = { skip: state.skip, limit: PAGE_SIZE, scyllaListed: 1, dir: state.sort === 'SCYLLA_PRICE_DESC' ? 'desc' : 'asc', filters: filters.length ? JSON.stringify(filters) : undefined, numberRange: isEdition ? (state.edition === 'LOW' ? 'low' : 'high') : undefined };
    } else if (isSalesSort){
      // filters was previously dropped here — picking a trait while a
      // H!ST0R!CAL SALES sort was active silently showed every Pigeon's
      // sale data instead of just the filtered ones (see filters below).
      reqParams = {
        skip: state.skip, limit: PAGE_SIZE, highestSale: 1,
        dir: (state.sort === 'SALES_LOW' || state.sort === 'AVG_SALE_XRP_ASC' || state.sort === 'AVG_SALE_PIGEONS_ASC') ? 'asc' : 'desc',
        metric: state.sort === 'AVG_SALE_PIGEONS_ASC' ? 'avg_pigeons' : ((state.sort === 'AVG_SALE_XRP_ASC' || state.sort === 'AVG_SALE_XRP_DESC') ? 'avg' : 'max'),
        filters: filters.length ? JSON.stringify(filters) : undefined,
        numberRange: isEdition ? (state.edition === 'LOW' ? 'low' : 'high') : undefined
      };
    } else if (isCrossListing){
      // Real lowest/highest across BOTH Deeptide and xrp.cafe, not just
      // whichever platform happens to have the cheaper API.
      reqParams = { skip: state.skip, limit: 20, crossListing: state.sort === 'PRICE_ASC' ? 'asc' : 'desc', filters: filters.length ? JSON.stringify(filters) : undefined, numberRange: isEdition ? (state.edition === 'LOW' ? 'low' : 'high') : undefined };
    } else if (isEdition && isNumericSort){
      // Direct slice of the number map restricted to this range — no scan needed.
      reqParams = { skip: state.skip, limit: PAGE_SIZE, numberRange: state.edition === 'LOW' ? 'low' : 'high', numericOrder: state.sort === 'NAME_DESC' ? 'desc' : 'asc', filters: filters.length ? JSON.stringify(filters) : undefined };
    } else if (isEdition){
      reqParams = { rawSkip: state.editionRawSkip, limit: PAGE_SIZE, numberRange: state.edition === 'LOW' ? 'low' : 'high', sort: state.sort, filters: filters.length ? JSON.stringify(filters) : undefined };
    } else if (isNumericSort){
      // True numeric Pigeon-number order (1,2,3...), not Deeptide's own
      // "name-asc" which sorts the string "PIGEONS10" before "PIGEONS2".
      // filters was previously dropped here too — this was the exact bug
      // reported: A-Z/Z-A ignored whatever trait was picked.
      reqParams = { skip: state.skip, limit: PAGE_SIZE, numericOrder: state.sort === 'NAME_DESC' ? 'desc' : 'asc', filters: filters.length ? JSON.stringify(filters) : undefined };
    } else {
      reqParams = { skip: state.skip, limit: PAGE_SIZE, sort: state.sort, filters: filters.length ? JSON.stringify(filters) : undefined };
    }
    api(reqParams).then(function(data){
      // A newer query has since started (see startCollectionBrowse's own
      // comment on the race this fixes) — this response is for a sort/
      // filter the user has already moved on from. Never render it, and
      // never touch state.loading here: a NEWER loadMoreCollection call
      // already owns that flag for its own still-in-flight request by
      // the time a stale response like this one arrives.
      if (myQueryToken !== state.queryToken){ if (onDone) onDone(); return; }
      state.loading = false;
      el.loadMoreNote.style.display = 'none';
      el.resetDbBtn.style.display = '';
      var rawItems = data.items || [];
      // Each auto-fallback stage below (listed -> sold-before -> full
      // collection) re-paginates its own bounded set from skip 0, so the
      // same Pigeon can legitimately come back around once browsing moves
      // to the next stage — drop anything already rendered instead of
      // showing it twice.
      var newItems = rawItems.filter(function(it){
        if (state.seenNftIds[it.nftId]) return false;
        state.seenNftIds[it.nftId] = true;
        return true;
      });
      state.items = state.items.concat(newItems);
      state.skip += rawItems.length;
      if (isEdition && typeof data.rawSkip === 'number') state.editionRawSkip = data.rawSkip;
      state.total = typeof data.total === 'number' ? data.total : state.total;
      state.hasMore = !!data.hasMore && rawItems.length > 0;
      appendResults(newItems);
      // Floor listings exhausted — seamlessly continue the same infinite
      // scroll sorted by lowest average sale price in XRP instead of just
      // stopping (whatever floor items already showed above stay put;
      // this appends more underneath). Only ever fires once per landing
      // here: the recursive call below runs with scyllaListedOnly false,
      // so this exact condition can't refire on it.
      if (state.scyllaListedOnly && !state.hasMore){
        state.scyllaListedOnly = false;
        state.sort = 'AVG_SALE_XRP_ASC';
        renderSortTag();
        el.statScyllaListedTile.classList.remove('scylla-active');
        state.skip = 0;
        state.hasMore = true;
        loadMoreCollection(onDone);
        return;
      }
      // Sold-before sort ALSO exhausted (only every Pigeon with real sale
      // history matched the filter, but not the complete real set — a
      // Pigeon that's neither currently listed nor ever sold was silently
      // never shown; confirmed live for FEATHERS::EAGLE + EYEWEAR::
      // GRADUATION — Deeptide's own unrestricted feed has 2 real matches,
      // this stage only ever found 1). Scoped to filters.length, not a
      // stage counter: an EARLIER version gated this on
      // autoFallbackStage === 1 (only set by the scyllaListedOnly branch
      // right above), which desyncs the moment a query starts ALREADY in
      // sales-sort mode — e.g. a previous unfiltered browse's own
      // fallback had already left state.sort on AVG_SALE_XRP_ASC, then
      // picking a NEW trait filter goes straight to the sales-sort
      // branch on its very first request, autoFallbackStage freshly
      // reset to 0 by startCollectionBrowse — so this never fired at all
      // (confirmed live: exactly the bug report reproduced above). Firing
      // off filters.length instead means it applies to every trait
      // search regardless of how the session arrived at sales-sort mode,
      // while still leaving deliberate, UNFILTERED H!GHEST SALE browsing
      // alone (filters.length is 0 there) — that's a real intentional
      // choice and should stop at its own end, not jump to a different
      // sort under the user. Final stage: the same unrestricted, complete,
      // rarity-sorted browse every plain (no sort picked) query already
      // uses — a superset of both earlier stages, so this alone is
      // guaranteed to eventually surface every real match. state.sort
      // check stops this from re-firing on itself once already here.
      if (filters.length && isSalesSort && state.sort !== 'RARITY_ASC' && !state.hasMore){
        state.sort = 'RARITY_ASC';
        renderSortTag();
        state.skip = 0;
        state.hasMore = true;
        loadMoreCollection(onDone);
        return;
      }
      var resultCount = state.total !== null ? state.total : state.items.length;
      // Zero results: the empty-state box below (emptyStateHtml) is the
      // one place that says so — this line stays blank instead of saying
      // the exact same "0 C0MB!NAT!0NS 0F THESE TRA!TS EX!ST" thing twice.
      if (!state.items.length){
        el.statusLine.innerHTML = '';
      } else if (filters.length === 0){
        el.statusLine.innerHTML = '<div class="results-trait-note">STAT!C://QUERY :: <span class="hi">' + resultCount + '</span> P!GE0NS F0UND</div>';
      } else if (filters.length === 1){
        el.statusLine.innerHTML = '<div class="results-trait-note">SH0W!NG RESULTS F0R <span class="hi">' + resultCount + '</span> ' +
          escapeHtml(filters[0].trait.toUpperCase()) + ': ' + escapeHtml(filters[0].value.toUpperCase()) + '</div>';
      } else if (filters.every(function(f){ return f.trait === filters[0].trait; })){
        // Multiple VALUES of the SAME trait (e.g. Background: Yellow +
        // Background: Blue) — not a cross-trait combination, just a wider
        // net over one trait, so the "combinations exist" wording (below)
        // would be misleading here.
        el.statusLine.innerHTML = '<div class="results-trait-note">SH0W!NG RESULTS F0R <span class="hi">' + resultCount + '</span> !TEMS</div>';
      } else {
        el.statusLine.innerHTML = '<div class="results-trait-note"><span class="hi">' + resultCount + '</span> C0MB!NAT!0NS 0F THESE TRA!TS EX!ST</div>';
      }
      if (!state.items.length){
        if (state.scyllaListedOnly){
          el.resultsArea.innerHTML = emptyStateHtml('// N0 ACT!VE L!ST!NGS', ['N0THING !S CURRENTLY L!STED THR0UGH SCYLLA.', 'BE THE F!RST — L!ST A P!GE0N FR0M MY P!GE0NS.'], false);
        } else if (filters.length && state.edition !== 'ALL'){
          // A trait can be real for the full collection but genuinely
          // absent from just the 1ST/2ND EDITION slice currently selected
          // — say so specifically instead of the generic "no match".
          el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0N MATCH', ['TRA!T D0ES N0T EX!ST !N TH!S C0LLECT!0N.'], true);
        } else {
          el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0N MATCH', filters.length ? ['0 C0MB!NAT!0NS 0F THESE TRA!TS EX!ST.'] : ['TRY AGA!N.'], filters.length > 0, 'RESET');
        }
      } else if (!state.hasMore){
        el.endOfCollectionNote.style.display = '';
      }
      if (pendingTraitScroll){ pendingTraitScroll = false; scrollResultsIntoView(); }
      if (onDone) onDone();
    }).catch(function(){
      // Same stale-response guard as the success branch above — a failed
      // request for an already-abandoned query must not clobber a newer
      // one's loading state or paint an error over its results.
      if (myQueryToken !== state.queryToken){ if (onDone) onDone(); return; }
      state.loading = false;
      el.loadMoreNote.style.display = 'none';
      el.resetDbBtn.style.display = '';
      if (!state.items.length) el.resultsArea.innerHTML = emptyStateHtml('// S!GNAL_L0ST', ['C0ULD N0T REACH THE C0LLECT!0N. TRY AGA!N.'], false);
      pendingTraitScroll = false;
      if (onDone) onDone();
    });
  }
  var scrollObserver = new IntersectionObserver(function(entries){
    if (entries[0].isIntersecting) loadMoreCollection();
  }, { rootMargin: '600px' });
  scrollObserver.observe(el.scrollSentinel);

  // ---- Trait stack (stackable AND filters) ----
  // Pick a category from the dropdown; every value for that category then
  // appears as a row of clickable chips (sorted rarest/highest % first, not
  // A-Z) rather than a second dropdown — click one to filter, click again to
  // clear it.
  function renderTraitRows(){
    // Category list: A-Z, so the (native, already-scrollable) dropdown is
    // predictable to scan. Values within a chosen category: rarest first
    // (lowest %), not alphabetical — that's the whole point of showing %.
    var cats = state.traitCategories ? Object.keys(state.traitCategories).sort(function(a, b){ return a.localeCompare(b); }) : [];
    el.traitRows.innerHTML = state.traitFilters.map(function(row){
      // Once a value's actually picked (whichever way — the manual chips
      // below, or the TRAITS hover flyout), collapse straight down to a
      // compact applied tag — not the value list again.
      if (row.category && row.value){
        return '<div class="trait-row trait-row-tag" data-id="' + row.id + '">' +
          '<span class="trait-tag-label">' + escapeHtml(row.category.toUpperCase()) + ' :: ' + escapeHtml(row.value.toUpperCase()) + '</span>' +
          '<button class="trait-row-remove" data-id="' + row.id + '">&times;</button>' +
        '</div>';
      }
      var catOptions = cats.map(function(c){
        return '<option value="' + escapeHtml(c) + '"' + (row.category === c ? ' selected' : '') + '>' + escapeHtml(c.toUpperCase()) + '</option>';
      }).join('');
      var vals = ((row.category && state.traitCategories[row.category]) || []).slice().sort(function(a, b){
        return (a.percent || 0) - (b.percent || 0);
      });
      var chips = vals.map(function(v){
        var pct = v.percent !== null && v.percent !== undefined ? ' (' + v.percent.toFixed(3) + '%)' : '';
        return '<button type="button" class="trait-chip' + (row.value === v.value ? ' selected' : '') + '" data-id="' + row.id + '" data-value="' + escapeHtml(v.value) + '">' + escapeHtml(v.value.toUpperCase()) + pct + '</button>';
      }).join('');
      return '<div class="trait-row" data-id="' + row.id + '">' +
        '<select class="trait-cat-select" data-id="' + row.id + '"><option value="">CATEG0RY ▼</option>' + catOptions + '</select>' +
        '<button class="trait-row-remove" data-id="' + row.id + '">&times;</button>' +
        (row.category ? '<div class="trait-value-chips" data-id="' + row.id + '">' + chips + '</div>' : '') +
      '</div>';
    }).join('');
    el.clearTraitsBtn.style.display = state.traitFilters.length ? '' : 'none';
  }
  el.clearTraitsBtn.addEventListener('click', function(){
    state.traitFilters = [];
    renderTraitRows();
    runQuery();
  });
  el.traitRows.addEventListener('change', function(e){
    var id = parseInt(e.target.getAttribute('data-id'), 10);
    var row = state.traitFilters.filter(function(r){ return r.id === id; })[0];
    if (!row) return;
    if (e.target.classList.contains('trait-cat-select')){ row.category = e.target.value; row.value = ''; }
    renderTraitRows();
    runQuery();
  });
  el.traitRows.addEventListener('click', function(e){
    var removeBtn = e.target.closest('.trait-row-remove');
    if (removeBtn){
      var rid = parseInt(removeBtn.getAttribute('data-id'), 10);
      state.traitFilters = state.traitFilters.filter(function(r){ return r.id !== rid; });
      renderTraitRows();
      runQuery();
      return;
    }
    var chip = e.target.closest('.trait-chip');
    if (chip){
      var cid = parseInt(chip.getAttribute('data-id'), 10);
      var row = state.traitFilters.filter(function(r){ return r.id === cid; })[0];
      if (!row) return;
      var value = chip.getAttribute('data-value');
      row.value = row.value === value ? '' : value;
      renderTraitRows();
      runQuery();
    }
  });

  // ---- TRAITS hover flyout — a faster path to the same traitFilters
  // state renderTraitRows()/runQuery() above already drive: hover the
  // category, see every value with its real count + %, click one to
  // apply it immediately (adds a filter row exactly like the manual
  // add-row -> pick category -> pick chip flow, just collapsed into one
  // hover + click). ----
  function renderTraitsFlyoutCats(){
    var cats = state.traitCategories ? Object.keys(state.traitCategories).sort(function(a, b){ return a.localeCompare(b); }) : [];
    el.traitsFlyoutCats.innerHTML = cats.map(function(c){
      return '<button type="button" class="traits-flyout-cat" data-cat="' + escapeHtml(c) + '">' + escapeHtml(c.toUpperCase()) + '</button>';
    }).join('');
    updateTraitsCatsHscrollArrows();
  }
  // Different trait categories sit at different heights (or, for
  // Background, need a totally different crop strategy) on the portrait —
  // one fixed crop doesn't work for all of them. Default (20% from top,
  // via CSS) suits head/beak-level traits; per-category overrides below
  // for ones that read wrong at that default. Background gets a real
  // zoomed-in corner crop of the ACTUAL artwork (guaranteed background-
  // only — the Pigeon character is always centered, corners never are)
  // instead of a synthetic colour guess, per explicit correction: it must
  // be the exact background from the real image, not an approximation.
  // Positions + sizes verified against real renders, not guessed: three
  // reference images downloaded and cropped locally with the exact same
  // background-size/background-position math the browser uses (including
  // that a bare percentage on background-size scales BOTH axes off the
  // box's WIDTH, so a wide-short trait-cell box amplifies the effective
  // vertical zoom well past the raw percentage — missed on the first
  // pass, which is why the numbers here look larger than you'd expect
  // from the percentage alone), then eyeballed to confirm each one
  // actually lands on the right trait. Every Pigeon shares the same
  // head-and-shoulders composition, so these hold across the whole
  // collection regardless of which specific trait value is showing.
  var TRAIT_PREVIEW_POSITION = {
    // Between the beak/mouth (~50-60%) and the clothing collar
    // (~63%+) — feather colour+texture visible with the least other-
    // trait overlap of any band on the portrait.
    Eyewear: 'center 38%',
    Feathers: 'center 40%',
    // Aura is a glow/halo effect around the whole character — the very
    // top edge of the frame, not the head-biased default.
    Aura: 'center top',
    // Low enough to fill the box with the mouth/teeth, not just catch
    // the very top of the beak with teeth cut off at the bottom edge.
    Beak: 'center 62%',
    Headwear: 'center 15%',
    // Bottom-anchored — chest-level clothing pattern, not the collar/
    // neckline that a mid-value position mostly showed instead.
    Clothing: 'center 100%'
  };
  // Every category zoomed in tight enough that the box reads as "a crop
  // of exactly this trait", not "a whole tiny Pigeon photo, which trait
  // is that again". Left at plain cover (no zoom), a crop still shows
  // the whole character — zoomed sizes tuned per category below, same
  // treatment Background/Feathers already got.
  var TRAIT_PREVIEW_SIZE = {
    Background: '350%',
    Feathers: '280%',
    Eyewear: '280%',
    Beak: '280%',
    Headwear: '220%',
    Clothing: '200%',
    Aura: '200%'
  };
  var TRAIT_PREVIEW_CORNER_POSITION = {
    Background: 'top left'
  };
  function renderTraitsFlyoutVals(category){
    el.traitsFlyoutCats.querySelectorAll('.traits-flyout-cat').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-cat') === category);
    });
    var vals = ((category && state.traitCategories[category]) || []).slice().sort(function(a, b){
      return (a.percent || 0) - (b.percent || 0);
    });
    var exampleImages = (state.traitExamples && state.traitExamples[category]) || {};
    el.traitsFlyoutVals.innerHTML = vals.map(function(v){
      var exampleImg = exampleImages[v.value];
      // Photo-backed boxes get their numbers greened (see .has-preview CSS
      // for the cyan label colour) — only the digits, not the % or the
      // surrounding "::" — plain boxes keep the original plain-grey count.
      var pct = v.percent !== null && v.percent !== undefined
        ? (exampleImg ? greenNum(v.percent.toFixed(3)) + '%' : v.percent.toFixed(3) + '%')
        : '—';
      var count = v.count !== null && v.count !== undefined
        ? (exampleImg ? greenNum(v.count) : v.count)
        : '—';
      var previewPos = TRAIT_PREVIEW_CORNER_POSITION[category] || TRAIT_PREVIEW_POSITION[category];
      var previewSize = TRAIT_PREVIEW_SIZE[category];
      // A zoomed background-only corner crop is already a plain patch of
      // colour — needs a lighter overlay than a full busy character photo
      // to still read as "the real colour", not just "dark".
      var overlay = previewSize
        ? 'rgba(8,9,11,0.3),rgba(8,9,11,0.45)'
        : 'rgba(8,9,11,0.55),rgba(8,9,11,0.8)';
      // Dark gradient layered UNDER the image (declared first, painted on
      // top) so the label/count text stays readable over any photo.
      var style = exampleImg
        ? ' style="background-image:linear-gradient(' + overlay + '),url(&quot;' + escapeHtml(exampleImg) + '&quot;);' +
          (previewSize ? 'background-size:' + previewSize + ';' : '') +
          (previewPos ? 'background-position:' + previewPos + ';' : '') + '"'
        : '';
      var isSelected = isTraitSelected(category, v.value);
      // Photo-backed cells get the exact same corner checkmark badge a
      // selected Pigeon thumbnail does (.card-select-toggle.selected) —
      // plain-text cells keep the inline ✓ prefix since there's no photo
      // corner to badge.
      // Photo-backed values get their label+count wrapped in a solid
      // static box (.tfv-text) instead of just a text-shadow floating
      // over the crop — the crop underneath is often busy/light enough
      // that shadow alone still clashed and was hard to read.
      var textOpen = exampleImg ? '<span class="tfv-text">' : '';
      var textClose = exampleImg ? '</span>' : '';
      return '<button type="button" class="traits-flyout-val' + (exampleImg ? ' has-preview' : '') + (isSelected ? ' selected' : '') + '" data-cat="' + escapeHtml(category) + '" data-value="' + escapeHtml(v.value) + '"' + style + '>' +
        (exampleImg && isSelected ? '<span class="tfv-select-badge">✓</span>' : '') +
        textOpen +
        '<span>' + (!exampleImg && isSelected ? '✓ ' : '') + escapeHtml(v.value.toUpperCase()) + '</span>' +
        '<span class="tfv-count">' + count + ' :: ' + pct + '</span>' +
        textClose +
      '</button>';
    }).join('');
  }
  // Whether a trait value is currently an active filter — drives the
  // ✓/selected state in the flyout so ticked traits stay visibly ticked
  // while you keep browsing other categories in the same open menu.
  function isTraitSelected(category, value){
    return state.traitFilters.some(function(r){ return r.category === category && r.value === value; });
  }
  // S0RT BY / F!LTER BY TRAITS now both pop up as a real fixed, centered
  // overlay at every width (see .flyout-popup's own CSS) instead of a
  // dropdown anchored to the trigger — reported live as wanting real
  // clickable buttons whose options "pop up in the middle of the page".
  // position:fixed is supposed to anchor to the viewport regardless of
  // where in the DOM it lives, but #flockGridPanel (an ancestor of
  // #traitsHoverWrap/#sortDropWrap) has backdrop-filter:blur(...) on it —
  // per the CSS Containing Block spec, transform/filter/backdrop-filter/
  // perspective on an ancestor makes THAT element the containing block
  // for a position:fixed descendant instead of the viewport (confirmed
  // live: top:50% resolved against the document's full scroll height, not
  // the actual screen). Reparenting to a direct child of <body> while open
  // sidesteps this entirely; restore*Flyout moves it back afterward so it
  // sits in its normal spot in the DOM again once closed (harmless either
  // way now that position is always fixed+centered while open, but keeps
  // the DOM tidy / avoids two flyouts silently piling up as siblings of
  // <body> over a long session).
  function showFlyoutBackdrop(){ el.flyoutPopupBackdrop.classList.add('open'); }
  function hideFlyoutBackdrop(){ el.flyoutPopupBackdrop.classList.remove('open'); }
  function restoreTraitsFlyout(){
    if (el.traitsFlyout.parentElement !== el.traitsHoverWrap) el.traitsHoverWrap.appendChild(el.traitsFlyout);
  }
  function openTraitsFlyout(){
    ensureTraitsLoaded().then(function(){
      closeSortFlyout();
      document.body.appendChild(el.traitsFlyout);
      renderTraitsFlyoutCats();
      el.traitsFlyoutVals.innerHTML = '';
      el.traitsFlyout.style.display = 'block';
      el.traitsFlyout.classList.add('flyout-popup');
      el.traitsHoverWrap.classList.add('open');
      showFlyoutBackdrop();
      // Always reopens on the category list, never mid-drill from
      // wherever it was left last time.
      el.traitsFlyout.classList.remove('flyout-drilled');
    });
  }
  function closeTraitsFlyout(){
    el.traitsFlyout.style.display = 'none';
    el.traitsFlyout.classList.remove('flyout-popup', 'flyout-drilled');
    el.traitsHoverWrap.classList.remove('open');
    el.bottomTraitsBtn.classList.remove('open');
    restoreTraitsFlyout();
    if (el.sortFlyout.style.display !== 'block') hideFlyoutBackdrop();
  }
  // Click to open/close (not hover) — closes on an outside click (the
  // backdrop itself — see its own listener further down) or the panel's
  // own ✕. Also closes itself on a trait pick (see traitsFlyoutVals'
  // click handler below).
  el.traitsHoverLabel.addEventListener('click', function(){
    if (el.traitsFlyout.style.display === 'block') closeTraitsFlyout();
    else openTraitsFlyout();
  });
  el.traitsFlyoutClose.addEventListener('click', closeTraitsFlyout);
  // The real, visible trigger now — el.traitsHoverLabel above still
  // exists (and still works) purely because it's what openTraitsFlyout's
  // whole cats/vals/back-button machinery already targets; no reason to
  // rewire all of that just because the clickable label itself moved.
  el.bottomTraitsBtn.addEventListener('click', function(e){
    // Without this, the click that just opened the popup keeps bubbling
    // after this handler returns, reaches the document-level outside-
    // click closer further down, and — since bottomTraitsBtn's own
    // composedPath never includes traitsHoverWrap/traitsFlyout, it lives
    // in a completely different part of the DOM — that closer reads it as
    // an outside click and immediately closes what was just opened, all
    // within the same click. Confirmed live: the popup would flash open
    // and instantly shut.
    e.stopPropagation();
    el.bottomTraitsBtn.classList.toggle('open', el.traitsFlyout.style.display !== 'block');
    el.traitsHoverLabel.click();
  });
  // Click only, not hover — an earlier version also opened a category's
  // values on mouseover, which meant just moving the mouse across the
  // strip (e.g. scrolling past it, or clicking somewhere else nearby)
  // could pop values open unintentionally. A real click is a deliberate
  // action; this is the only trigger now.
  el.traitsFlyoutCats.addEventListener('click', function(e){
    var catBtn = e.target.closest('.traits-flyout-cat');
    if (catBtn){
      renderTraitsFlyoutVals(catBtn.getAttribute('data-cat'));
      // Drills to the values step, still inside the same centered popup —
      // see .flyout-popup.flyout-drilled's own CSS for what this swaps.
      // scrollTop reset: the popup itself scrolls (overflow-y:auto), so
      // without this a long category list scrolled down would leave the
      // values step opening already scrolled past its own top.
      el.traitsFlyout.classList.add('flyout-drilled');
      el.traitsFlyout.scrollTop = 0;
    }
  });
  el.traitsFlyoutBack.addEventListener('click', function(){
    el.traitsFlyout.classList.remove('flyout-drilled');
    el.traitsFlyout.scrollTop = 0;
  });
  // Desktop's horizontal category row (see .traits-flyout-cats' own CSS,
  // min-width:701px) — scroll it along if there are more categories than
  // fit. No-op on mobile (the row's vertical there, arrows hidden).
  // Explicitly refreshed here too, not just left to the 'scroll' listener
  // above — same reasoning as the SORT BY arrows' own click handlers.
  el.traitsCatsScrollPrevBtn.addEventListener('click', function(){
    el.traitsFlyoutCats.scrollBy({ left: -180, behavior: 'smooth' });
    setTimeout(updateTraitsCatsHscrollArrows, 400);
  });
  el.traitsCatsScrollNextBtn.addEventListener('click', function(){
    el.traitsFlyoutCats.scrollBy({ left: 180, behavior: 'smooth' });
    setTimeout(updateTraitsCatsHscrollArrows, 400);
  });
  // Desktop's horizontal category strip (min-width:701px, see #traitsFlyout's
  // own CSS) is always visible now, not click-to-open — same reasoning as
  // S0RT BY's own unconditional renderSortFlyoutList() call. Without this,
  // #traitsFlyoutCats stayed empty (renderTraitsFlyoutCats() only ever ran
  // inside openTraitsFlyout(), which only fires on a real click) even
  // though the box around it was already forced visible — confirmed live:
  // categories didn't show at all until F!LTER BY TRA!TS was clicked once,
  // and the vals pane's static "H0VER A CATEG0RY" placeholder sat there
  // the whole time with no categories to actually hover. Harmless on
  // mobile too (the box stays display:none there until opened).
  ensureTraitsLoaded().then(renderTraitsFlyoutCats);
  el.traitsFlyoutVals.addEventListener('click', function(e){
    var valBtn = e.target.closest('.traits-flyout-val');
    if (!valBtn) return;
    var category = valBtn.getAttribute('data-cat');
    var value = valBtn.getAttribute('data-value');
    // Ticking a value that's already selected removes it (toggle).
    if (isTraitSelected(category, value)){
      state.traitFilters = state.traitFilters.filter(function(r){ return !(r.category === category && r.value === value); });
    } else {
      // Reuse an existing empty row if one's sitting there unused, same as
      // clicking [+ ADD TRAIT] would give you — otherwise add a fresh one.
      var target = state.traitFilters.filter(function(r){ return !r.category; })[0];
      if (!target){
        target = { id: state.nextTraitRowId++, category: '', value: '' };
        state.traitFilters.push(target);
      }
      target.category = category;
      target.value = value;
    }
    renderTraitRows();
    renderTraitsFlyoutVals(category);
    pendingTraitScroll = true;
    // Reported live as wanting the picker to close on pick regardless of
    // screen size — it should just show the trait as selected and show
    // the matching Pigeons, not stay open blocking the results that are
    // already loading behind it. Was mobile-only before (desktop's own
    // strip used to stay open on purpose); now closes everywhere.
    closeTraitsFlyout();
    runQuery();
  });

  function activeFilters(){
    return state.traitFilters.filter(function(r){ return r.category && r.value; }).map(function(r){ return { trait: r.category, value: r.value }; });
  }

  // ---- Unified query dispatch: wallet-scope filters client-side over the
  // full holder list (already loaded whole); whole-collection scope always
  // goes through the real, live, paginated collection endpoint. ----
  function runQuery(){
    if (state.scope) runScopedQuery();
    else startCollectionBrowse();
  }

  function runScopedQuery(){
    var q = el.searchInput.value.trim().toLowerCase();
    var filters = activeFilters();
    var list = state.scopeAllItems.filter(function(p){
      if (filters.length && !filters.every(function(f){
        return p.attributes.some(function(a){ return a.trait_type === f.trait && a.value === f.value; });
      })) return false;
      if (state.edition === 'LOW' && !(p.number !== null && p.number <= 1515)) return false;
      if (state.edition === 'HIGH' && !(p.number !== null && p.number > 1515)) return false;
      if (q){
        var numMatch = p.number !== null && String(p.number).indexOf(q.replace('#','')) !== -1;
        var traitMatch = p.attributes.some(function(a){ return a.value.toLowerCase().indexOf(q) !== -1 || a.trait_type.toLowerCase().indexOf(q) !== -1; });
        if (!numMatch && !traitMatch) return false;
      }
      return true;
    });
    // Whole list is already in memory here (a wallet scope) — a single
    // client-side comparator is all that's needed (see sortComparatorFor).
    var cmp = sortComparatorFor(state.sort);
    if (cmp) list = list.slice().sort(cmp);
    state.items = list;
    el.statusLine.innerHTML = '<div class="results-trait-note">V!EW!NG ' + walletViewingLabel(state.scope.ownerShort) + ' (<span class="hi">' + list.length + '</span> P!GE0NS)' +
      (list.length === 1 ? '<br>P!GE0N #' + list[0].number : '') + '</div>';
    if (!list.length){
      // "QUERY :: (traits)" — a debug-looking placeholder used to show
      // here whenever the empty result came from trait filters alone (no
      // typed search text, q empty), reported live as not something that
      // should ever be user-facing. Only show the real typed query now;
      // a filters-only miss gets the same "no combination of these
      // traits exists" wording the general (non-wallet-scoped) browse
      // view already uses.
      el.resultsArea.innerHTML = emptyStateHtml('// N0 P!GE0N MATCH', q ? ['QUERY :: "' + q + '"'] : ['0 C0MB!NAT!0NS 0F THESE TRA!TS EX!ST.'], true);
      wireClearSearch();
    } else {
      renderResultsReplace(list);
    }
    if (pendingTraitScroll){ pendingTraitScroll = false; scrollResultsIntoView(); }
  }

  // Number search is exact and direct via the number->NFTokenID map; any
  // other typed text is treated as a trait-value guess (matched against the
  // already-loaded real trait data, no extra round trips) and applied as a
  // filter through the same AND-filter mechanism as the TRAITS stack.
  // One combined search box — a value that looks like an XRPL wallet
  // address (starts with "r", right length) resolves via the same
  // browseOwnerCollection path a Top 10/sales-history wallet click
  // already uses (a wallet with zero Pigeons is a valid, real result,
  // handled inside browseOwnerCollection with an explicit "owns no
  // Pigeons" message, not the generic no-match state below); otherwise
  // it's treated as a Pigeon number and resolved via the number->NFTokenID
  // index. Trait filtering already has its own dedicated UI (the TRAITS
  // stack), so this box only ever does one of these two lookups.
  function runSearchBox(){
    var q = el.searchInput.value.trim();
    if (!q){ runQuery(); return; }
    if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(q)){
      browseOwnerCollection(q, q.slice(0, 9) + '...' + q.slice(-4));
      return;
    }
    var isNumber = /^#?\\d+$/.test(q);
    if (!isNumber){
      el.statusLine.innerHTML = 'RESULTS :: <span class="hi">0</span>';
      el.resultsArea.innerHTML = emptyStateHtml('// !NVAL!D QUERY', ['ENTER A P!GE0N NUMBER (E.G. 1842) 0R A WALLET ADDRESS.'], true);
      wireClearSearch();
      return;
    }
    el.resultsArea.innerHTML = '<div class="loading-note">SEARCH!NG...</div>';
    el.statusLine.textContent = '';
    api({ number: q.replace('#', '') }).then(function(data){
      state.items = data.items || [];
      if (!state.items.length){
        el.statusLine.innerHTML = 'RESULTS :: <span class="hi">0</span>';
        el.resultsArea.innerHTML = data.notIndexed
          ? emptyStateHtml('// N0T YET !NDEXED', ['QUERY :: "' + q + '"', 'TH!S P!GE0N HAS N0T BEEN SEEN BY THE NUMBER !NDEX YET.', 'TRY AGA!N SH0RTLY — !T CRAWLS THE C0LLECT!0N !N THE BACKGR0UND.'], true)
          : emptyStateHtml('// N0 P!GE0N MATCH', ['QUERY :: "' + q + '"'], true);
        wireClearSearch();
        return;
      }
      el.statusLine.innerHTML = 'RESULTS :: <span class="hi">1</span><br>P!GE0N #' + state.items[0].number;
      renderResultsReplace(state.items);
    }).catch(function(){
      el.resultsArea.innerHTML = emptyStateHtml('// S!GNAL_L0ST', ['SEARCH FA!LED. TRY AGA!N.'], false);
    });
  }

  function wireClearSearch(){
    var btn = document.getElementById('clearSearchBtn');
    if (btn) btn.addEventListener('click', function(){
      el.searchInput.value = '';
      state.traitFilters = [];
      renderTraitRows();
      if (state.scope) runScopedQuery(); else startCollectionBrowse();
    });
  }

  // ---- Top 10 holders (network-wide, cached snapshot) — an expandable
  // panel at the top of the page; clicking a wallet browses their real
  // collection the same way the owner-link on INSPECT does. ----
  var topHoldersData = null;
  function loadTopHolders(){
    api({ topHolders: 1 }).then(function(data){
      topHoldersData = data.holders || [];
      renderTopHoldersList();
    }).catch(function(){ topHoldersData = []; renderTopHoldersList(); });
  }
  function renderTopHoldersList(){
    if (topHoldersData === null){
      el.topHoldersList.innerHTML = '<div class="th-empty">L0AD!NG...</div>';
      return;
    }
    if (!topHoldersData.length){
      el.topHoldersList.innerHTML = '<div class="th-empty">N0T READY YET — TRY AGA!N SH0RTLY.</div>';
      return;
    }
    el.topHoldersList.innerHTML = topHoldersData.map(function(h, i){
      var percentStr = h.percent !== null && h.percent !== undefined
        ? h.percent.toLocaleString(undefined, { maximumFractionDigits: h.percent < 1 ? 2 : 1 })
        : null;
      // Rarest-held-Pigeon thumbnail — only ever populated for the top 15
      // (see doRecomputeCrownHolder in _shared.js), computed once during
      // the periodic background Crown recompute, not per page load.
      var thumb = (i < 15 && h.rarestPigeon && h.rarestPigeon.image)
        ? '<img class="th-thumb" src="' + escapeHtml(h.rarestPigeon.image) + '" alt="" loading="lazy" title="RAREST P!GE0N HELD :: RAR!TY #' + escapeHtml(h.rarestPigeon.rarityRank) + '">'
        : '';
      return '<div class="th-row' + (i < 15 ? ' th-row-top' : '') + '" data-wallet="' + escapeHtml(h.wallet) + '" data-short="' + escapeHtml(h.ownerShort) + '">' +
        '<span class="th-rank">' + thumb + '<span>#' + greenNum(i + 1) + '</span></span>' +
        '<span class="th-wallet">' + walletTagHtml(h.wallet, h.ownerShort) + '</span>' +
        '<span class="th-count">' + greenNum(h.count) + ' P!GE0NS' + (percentStr ? '  ::  ' + greenNum(percentStr + '%') : '') + '</span>' +
      '</div>';
    }).join('');
  }
  el.topHoldersList.addEventListener('click', function(e){
    var row = e.target.closest('.th-row');
    if (!row) return;
    browseOwnerCollection(row.getAttribute('data-wallet'), row.getAttribute('data-short'));
  });

  // ---- CR0WN — real $PIGEONS trading profit/loss leaderboard (realized
  // only, see crown-leaderboard.js's own comment). Same .th-row/.th-rank/
  // .th-wallet/.th-count classes T0P H0LDERS already uses — one wallet per
  // row is the exact same shape, just ranked by net $PIGEONS flow instead
  // of Pigeon count. ----
  var crownData = null; // null = not fetched yet
  function loadCrownLeaderboard(){
    crownData = null;
    renderCrownLeaderboard();
    var period = el.crownPeriodSelect.value === 'month' ? 'month' : 'week';
    fetch('/api/crown-leaderboard?period=' + period).then(function(r){ return r.json(); }).then(function(data){
      crownData = data.items || [];
      renderCrownLeaderboard();
    }).catch(function(){ crownData = []; renderCrownLeaderboard(); });
  }
  function renderCrownLeaderboard(){
    if (crownData === null){
      el.crownLeaderboardList.innerHTML = '<div class="th-empty">L0AD!NG...</div>';
      return;
    }
    if (!crownData.length){
      el.crownLeaderboardList.innerHTML = '<div class="th-empty">N0 SETTLED $P!GE0NS TRADES TH!S PER!0D YET.</div>';
      return;
    }
    el.crownLeaderboardList.innerHTML = crownData.map(function(w, i){
      var isProfit = w.netProfit >= 0;
      var profitStr = (isProfit ? '+' : '−') + Math.abs(w.netProfit).toLocaleString(undefined, { maximumFractionDigits: 2 });
      return '<div class="th-row" data-wallet="' + escapeHtml(w.wallet) + '" data-short="' + escapeHtml(w.walletShort) + '">' +
        '<span class="th-rank"><span>#' + greenNum(i + 1) + '</span></span>' +
        '<span class="th-wallet">' + escapeHtml(w.walletShort) + '</span>' +
        '<span class="th-count" style="color:' + (isProfit ? 'var(--green)' : 'var(--magenta)') + '; text-shadow:none;">' + escapeHtml(profitStr) + ' $P!GE0NS</span>' +
      '</div>';
    }).join('');
  }
  el.crownLeaderboardList.addEventListener('click', function(e){
    var row = e.target.closest('.th-row');
    if (!row) return;
    browseOwnerCollection(row.getAttribute('data-wallet'), row.getAttribute('data-short'));
  });
  el.crownPeriodSelect.addEventListener('change', loadCrownLeaderboard);

  // ---- MY PIGEONS — CONNECT SCYLLA (see startAuthorize's own comment
  // further down for the real Xaman SignIn payload this uses). ----
  var myPigeonsData = null; // null = not fetched yet
  var myListedData = {};    // nftId -> { price, currency, offerId, expiration } — real on-ledger sell offers, not a stored flag
  var offersByNftId = {};   // nftId -> [{ offerId, buyer, buyerShort, price, createdAt }] — real on-ledger buy offers received
  // DECL!NE — XRPL has no seller-side "reject" for an incoming NFT buy
  // offer (only the buyer can cancel their own), so this hides the offer
  // from view here without touching anything on-ledger — the real offer
  // is still live, the buyer could still in theory get it accepted some
  // other way. Persisted to localStorage (offerId -> true) so it actually
  // stays gone across a refresh — reported live as coming back every
  // time, which a plain in-memory object (the original version of this)
  // always would once the page reloaded and re-fetched the same still-
  // live offer. Per-browser only, not server-side — declining on one
  // device won't hide it on another.
  var DECLINED_OFFERS_STORAGE_KEY = 'pswap:declinedOfferIds:v1';
  var declinedOfferIds = {};
  try { declinedOfferIds = JSON.parse(localStorage.getItem(DECLINED_OFFERS_STORAGE_KEY) || '{}') || {}; } catch (e) { declinedOfferIds = {}; }
  function persistDeclinedOfferIds(){
    try { localStorage.setItem(DECLINED_OFFERS_STORAGE_KEY, JSON.stringify(declinedOfferIds)); } catch (e) {}
  }
  // Offers received on THIS pigeon, shown directly on its own card — same
  // ACCEPT OFFER button/fee breakdown the old combined offersReceivedList
  // used, just embedded per-card instead of in one separate block (see
  // myPigeonCardHtml). Most recent offer first.
  // Just the single highest offer now, big and unmissable, instead of a
  // full list of every offer stacked in tiny rows — reported live as
  // wanting "HIGHEST OFFER / ____ $PIGEONS / ACCEPT DECLINE COUNTER...
  // clean buttons... simple but big and easy to see." Lower offers still
  // exist on-ledger and still count toward the tab's own "N 0FFERS"
  // badge — this just surfaces the one actually worth acting on.
  function myPigeonOffersHtml(p, offers){
    // Excludes any offer THIS wallet placed on its own Pigeon — never
    // acceptable server-side (cannot_accept_own_offer, see
    // swap-acceptoffer-payload.js), so it never belongs in the real
    // ACCEPT/DECLINE box below. No separate "own offer" box for it either
    // any more — reported live as not needing that, it already shows (and
    // can be cancelled) in OUTGOING OFFERS like every other offer this
    // wallet has made.
    var real = offers.filter(function(o){ return !declinedOfferIds[o.offerId] && o.buyer !== MY_WALLET; });
    if (!real.length) return '';
    var top = real.slice().sort(function(a, b){ return Number(b.price) - Number(a.price); })[0];
    return '<div class="my-pigeon-offers">' +
      '<div class="highest-offer-box">' +
        '<div class="highest-offer-label">H!GHEST 0FFER</div>' +
        '<div class="highest-offer-price">' + escapeHtml(fmtPigeonsCompact(top.price)) + '</div>' +
        '<div class="highest-offer-buyer">FR0M ' + walletTagHtml(top.buyer, top.buyerShort) + '</div>' +
        '<div class="highest-offer-actions">' +
          '<button class="highest-offer-btn highest-offer-accept accept-offer-btn" data-nftid="' + escapeHtml(p.nftId) + '" data-offerid="' + escapeHtml(top.offerId) + '" data-price="' + escapeHtml(top.price) + '" data-buyer="' + escapeHtml(top.buyer) + '" data-num="' + (p.number !== null ? p.number : '') + '" data-image="' + escapeHtml(p.image || '') + '">ACCEPT</button>' +
          '<button class="highest-offer-btn highest-offer-decline decline-offer-btn" data-offerid="' + escapeHtml(top.offerId) + '">DECL!NE</button>' +
          '<button class="highest-offer-btn highest-offer-counter" disabled title="C0M!NG S00N">C0UNTER</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  // The LIST/DELIST/OFFERS-RECEIVED box for a pigeon YOU own — shared by
  // myPigeonCardHtml (MY PIGEONS tab) and pigeonsActionBoxHtml (DATABASE,
  // when scoped to your own wallet via SH0W MY P!GE0NS) so both render
  // identically instead of DATABASE showing nothing for your own pigeons.
  function ownedPigeonActionHtml(p){
    var listedInfo = myListedData[p.nftId];
    var offers = offersByNftId[p.nftId] || [];
    var offersHtml = offers.length ? myPigeonOffersHtml(p, offers) : '';
    // LIST/TRANSFER both just open the shared amount-entry popup now
    // (see openAmountEntryModal and .list-open-modal-btn/.transfer-open-
    // modal-btn in wireResultClicks) instead of an inline price input
    // sitting directly on the card — same popup submitInlineListing/
    // submitTransfer both submit through.
    // Stacked full-width bars now, not side by side (.owned-stack-row,
    // not .owned-action-row) — reported live as wanting L!ST/TRANSFER
    // (and CANCEL/TRANSFER) as "two horizontal bars stacked" instead of
    // squeezed into half-width each.
    // The price line (L!STED :: 123.1K $P!GE0NS) is gone — it already
    // shows on the thumbnail itself (.thumb-listing-badge), repeating it
    // here was redundant. The expiry countdown isn't shown anywhere else
    // though, so that stays.
    var ownedListingCountdown = listedInfo ? listingCountdownText(listedInfo.expiration) : '';
    var listedNote = ownedListingCountdown
      ? '<div class="listing-countdown" style="text-align:center; margin-bottom:0.5rem;">' + escapeHtml(ownedListingCountdown) + '</div>'
      : '';
    var primaryBtn = listedInfo
      ? '<button class="bar-btn delist-pigeon-btn" data-nftid="' + escapeHtml(p.nftId) + '">CANCEL</button>'
      : '<button class="bar-btn list-open-modal-btn" data-nftid="' + escapeHtml(p.nftId) + '">L!ST</button>';
    var transferBtn = '<button class="bar-btn transfer-open-modal-btn" data-nftid="' + escapeHtml(p.nftId) + '">TRANSFER</button>';
    return offersHtml + listedNote + '<div class="owned-stack-row">' + primaryBtn + transferBtn + '</div>';
  }
  // 0FFERS RECE!VED — reached via the Σκύλλα tab's own 0FFERS box (see
  // el.flockOffersBox's click handler), which used to do nothing at all
  // when clicked. One horizontal row per listed Pigeon with a real
  // offer, thumbnail + number + buyer + price + ACCEPT/DECL!NE/C0UNTER —
  // "set it horizontally showing all the details of the offer" per the
  // explicit request. Just the highest offer per Pigeon, same as the
  // card's own myPigeonOffersHtml.
  function renderMyOffersList(){
    if (offersReceivedData === null){
      el.myOffersList.innerHTML = '<div class="th-empty">L0AD!NG...</div>';
      return;
    }
    // An offer THIS wallet placed on its own Pigeon is excluded here
    // entirely — can never be ACCEPTed (cannot_accept_own_offer) — no
    // separate "own offer" section for it either any more, reported live
    // as not needing that; it already shows (and can be cancelled) in
    // OUTGOING OFFERS below like every other offer this wallet has made.
    var rows = offersReceivedData.map(function(item){
      var real = item.offers.filter(function(o){ return !declinedOfferIds[o.offerId] && o.buyer !== MY_WALLET; });
      if (!real.length) return null;
      var top = real.slice().sort(function(a, b){ return Number(b.price) - Number(a.price); })[0];
      var img = item.image ? '<img src="' + escapeHtml(item.image) + '" alt="" loading="lazy">' : 'IMAGE';
      return { item: item, top: top, img: img };
    }).filter(Boolean);
    if (!rows.length){
      el.myOffersList.innerHTML = '<div class="th-empty">N0 0FFERS RECE!VED R!GHT N0W.</div>';
      return;
    }
    el.myOffersList.innerHTML = rows.map(function(row){
      var item = row.item, top = row.top;
      return '<div class="my-offer-row">' +
        '<div class="my-offer-row-left">' +
          '<div class="pigeon-img-box my-offer-row-img" data-nftid="' + escapeHtml(item.nftId) + '">' + row.img + '</div>' +
          '<div class="my-offer-row-info">' +
            '<div class="my-offer-row-num">P!GE0N #' + (item.number !== null ? greenNum(item.number) : '????') + '</div>' +
            '<div class="my-offer-row-buyer">FR0M ' + walletTagHtml(top.buyer, top.buyerShort) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="my-offer-row-price">' + escapeHtml(fmtPigeonsCompact(top.price)) + '</div>' +
        '<div class="my-offer-row-actions">' +
          '<button class="highest-offer-btn highest-offer-accept accept-offer-btn" data-nftid="' + escapeHtml(item.nftId) + '" data-offerid="' + escapeHtml(top.offerId) + '" data-price="' + escapeHtml(top.price) + '" data-buyer="' + escapeHtml(top.buyer) + '" data-num="' + (item.number !== null ? item.number : '') + '" data-image="' + escapeHtml(item.image || '') + '">ACCEPT</button>' +
          '<button class="highest-offer-btn highest-offer-decline decline-offer-btn" data-offerid="' + escapeHtml(top.offerId) + '">DECL!NE</button>' +
          '<button class="highest-offer-btn highest-offer-counter" disabled title="C0M!NG S00N">C0UNTER</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  // The actual pigeon grid for PλWS is the shared DATABASE view itself
  // (screenBrowse, scoped to your own wallet via browseOwnerCollection —
  // see showTab) now, not a separate look. myPigeonsSortRow/myPigeonsList
  // stay in the markup but permanently empty/hidden. No more panel-title
  // count to keep current here — the FL0CK tab label owns that now (see
  // updateFlockTabLabel).
  function renderMyPigeonsList(){
    el.myPigeonsSortRow.style.display = 'none';
    el.myPigeonsList.innerHTML = '';
    // The Y0UR P!GE0N picker (openSimpleOfferPicker) shows nothing rather
    // than a "L0AD!NG..." message while myPigeonsData is still in flight —
    // this is what actually fills it in the instant real data lands, if
    // it's still open (it only ever handles this one side now).
    if (myPigeonsData !== null && el.simpleOfferPickerModal.style.display === 'flex'){
      simpleOfferPickerItems = myPigeonsData;
      renderSimpleOfferPickerGrid('Y0U D0N T 0WN ANY P!GE0NS YET.');
    }
  }
  // Only ever called with no session now (see showTab) — the logged-in
  // case used to also fetch here independently, racing browseOwner-
  // Collection's own identical wallet-NFT fetch (which now mirrors its
  // result into myPigeonsData/myListedData itself, isSelf branches) and
  // making PλWS feel slow/glitchy on open from two fetches landing at
  // different times. Resets the panel to its logged-out state only.
  function loadMyPigeons(){
    // The CONNECT box itself stays hidden here now — auto-login already
    // fires from the topTabs click handler, so there's nothing for a
    // manual CONNECT button to add on a normal open. It only reappears
    // if that login attempt actually fails (see startAuthorize's error
    // paths below), as a manual retry.
  }
  // LIST/DELIST/ACCEPT OFFER click + input handling for this container is
  // shared with the DATABASE grid inside wireResultClicks now (own-wallet
  // DATABASE scope shows the exact same action box — see
  // pigeonsActionBoxHtml/ownedPigeonActionHtml) — nothing container-
  // specific left to wire here.
  wireResultClicks(el.myPigeonsList, function(){ return myPigeonsData || []; });
  // 0FFERS RECE!VED's own ACCEPT/DECL!NE/thumbnail clicks (renderMyOffersList) —
  // offersReceivedData items already carry nftId/number/image, same shape
  // every other source() here expects.
  wireResultClicks(el.myOffersList, function(){ return offersReceivedData || []; });

  // ---- CREATE OFFER (V1) — UI/selection only. No XRPL offer/swap
  // transaction is built or submitted here; CREATE 0FFER just confirms
  // both sides are picked. Picking reuses existing data sources only:
  // myPigeonsData (already fetched for this tab's own list) for Y0UR
  // P!GE0N, and the same wallet-address/Pigeon-# two-mode lookup
  // runSearchBox already does (hitting /api/pigeons directly) for
  // 0FFER F0R. ----
  function simpleOfferSlotHtml(item, side){
    if (!item){
      return '<button type="button" class="simple-offer-select-btn" data-side="' + side + '">+ SELECT</button>';
    }
    var img = item.image ? '<img src="' + escapeHtml(item.image) + '" alt="" loading="lazy">' : 'IMAGE';
    var num = item.number !== null && item.number !== undefined ? '#' + greenNum(item.number) : '#????';
    return '<div class="simple-offer-filled" data-side="' + side + '">' +
        '<div class="simple-offer-thumb">' + img + '</div>' +
        '<div class="simple-offer-num">P!GE0N ' + num + '</div>' +
        '<button type="button" class="simple-offer-clear" data-side="' + side + '" title="CLEAR">&times;</button>' +
      '</div>';
  }
  function renderSimpleOffer(){
    el.simpleOfferMineSlot.innerHTML = simpleOfferSlotHtml(state.simpleOffer.mine, 'mine');
    el.simpleOfferTheirsSlot.innerHTML = simpleOfferSlotHtml(state.simpleOffer.theirs, 'theirs');
    el.simpleOfferCreateBtn.disabled = !(state.simpleOffer.mine && state.simpleOffer.theirs);
    el.simpleOfferStatus.textContent = '';
  }
  // Each card is a plain div (not a button — it holds a real nested
  // button, VIEW, so it can't be one itself) with two separate click
  // targets: the thumbnail selects the Pigeon into CREATE OFFER, VIEW
  // opens the exact same full detail screen DATABASE uses (openDetail) —
  // real trait backgrounds, sales history, everything, not a re-built
  // summary.
  function simplePickerCardHtml(p){
    var img = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : 'IMAGE';
    var num = p.number !== null && p.number !== undefined ? '#' + greenNum(p.number) : '#????';
    return '<div class="simple-picker-card" data-nftid="' + escapeHtml(p.nftId) + '">' +
        '<div class="simple-picker-card-img" data-nftid="' + escapeHtml(p.nftId) + '">' + img + '</div>' +
        '<div class="simple-picker-card-num">P!GE0N ' + num + '</div>' +
        '<button type="button" class="simple-picker-view-btn" data-nftid="' + escapeHtml(p.nftId) + '">VIEW</button>' +
      '</div>';
  }
  // Y0UR P!GE0N only now — 0FFER F0R picks directly off the real, full
  // DATABASE instead (see enterTheirsPickMode below), search bar and all,
  // rather than this modal's own separate, narrower wallet/# search.
  var simpleOfferPickerItems = [];
  function renderSimpleOfferPickerGrid(emptyMsg){
    el.simpleOfferPickerGrid.innerHTML = simpleOfferPickerItems.length
      ? simpleOfferPickerItems.map(simplePickerCardHtml).join('')
      : '<div class="th-empty">' + (emptyMsg || 'N0 P!GE0NS F0UND.') + '</div>';
  }
  function openSimpleOfferPicker(){
    if (!MY_WALLET){
      simpleOfferPickerItems = [];
      renderSimpleOfferPickerGrid('C0NNECT Σκύλλα F!RST — SEE THE TRUSTL!NE BANNER AB0VE.');
    } else if (myPigeonsData !== null){
      simpleOfferPickerItems = myPigeonsData;
      renderSimpleOfferPickerGrid('Y0U D0N T 0WN ANY P!GE0NS YET.');
    } else {
      // No "L0AD!NG..." placeholder text — myPigeonsData is already
      // being fetched (kicked off the moment this tab opened), so this
      // is normally empty for a moment at most; renderMyPigeonsList
      // (called once that fetch resolves) fills the grid in for real
      // the instant it's ready, same as everywhere else on this page.
      simpleOfferPickerItems = [];
      el.simpleOfferPickerGrid.innerHTML = '';
    }
    el.simpleOfferPickerModal.style.display = 'flex';
  }
  function closeSimpleOfferPicker(){
    el.simpleOfferPickerModal.style.display = 'none';
  }
  el.simpleOfferPickerGrid.addEventListener('click', function(e){
    var viewBtn = e.target.closest('.simple-picker-view-btn');
    if (viewBtn){
      closeSimpleOfferPicker();
      openDetail(viewBtn.getAttribute('data-nftid'));
      return;
    }
    var card = e.target.closest('.simple-picker-card');
    if (!card) return;
    var nftId = card.getAttribute('data-nftid');
    var p = simpleOfferPickerItems.filter(function(x){ return x.nftId === nftId; })[0];
    if (!p) return;
    state.simpleOffer.mine = { nftId: p.nftId, number: p.number, image: p.image, owner: p.owner || null };
    renderSimpleOffer();
    closeSimpleOfferPicker();
  });
  el.simpleOfferPickerClose.addEventListener('click', closeSimpleOfferPicker);
  el.simpleOfferPickerModal.addEventListener('click', function(e){
    if (e.target === el.simpleOfferPickerModal) closeSimpleOfferPicker();
  });
  // ---- 0FFER F0R picking mode — exits your own scope and shows the
  // real, full DATABASE (search bar included, wallet-or-# search works
  // exactly as it always does there) instead of a separate modal.
  // Clicking a card selects it into the RIGHT slot and returns straight
  // back to PλWS's own self-scoped view. ----
  function enterTheirsPickMode(){
    state.simpleOfferPickingTheirs = true;
    document.body.classList.add('picking-theirs');
    el.searchPanelTitle.textContent = 'P!CK A P!GE0N T0 0FFER F0R';
    if (state.scope) exitWalletScope();
    startCollectionBrowse();
    scrollActiveTabPanelIntoView('mypigeons');
  }
  function exitTheirsPickMode(){
    state.simpleOfferPickingTheirs = false;
    document.body.classList.remove('picking-theirs');
    // Back to PλWS's own self-scoped view regardless of which wallet was
    // being searched when the pick happened.
    browseOwnerCollection(MY_WALLET, 'Y0U', undefined, 'mypigeons');
  }
  el.simpleOfferPanel.addEventListener('click', function(e){
    var clearBtn = e.target.closest('.simple-offer-clear');
    if (clearBtn){
      state.simpleOffer[clearBtn.getAttribute('data-side')] = null;
      renderSimpleOffer();
      return;
    }
    var selectBtn = e.target.closest('.simple-offer-select-btn');
    var filled = e.target.closest('.simple-offer-filled');
    var target = selectBtn || filled;
    if (!target) return;
    if (target.getAttribute('data-side') === 'mine') openSimpleOfferPicker();
    else enterTheirsPickMode();
  });
  el.simpleOfferCreateBtn.addEventListener('click', function(){
    if (!state.simpleOffer.mine || !state.simpleOffer.theirs) return;
    if (!state.simpleOffer.theirs.owner){
      el.simpleOfferStatus.textContent = 'OWNER N0T !NDEXED F0R TH!S P!GE0N YET — P!CK !T AGA!N, 0R TRY ANOTHER.';
      return;
    }
    if (MY_WALLET && state.simpleOffer.theirs.owner === MY_WALLET){
      el.simpleOfferStatus.textContent = 'THAT S ALREADY Y0UR P!GE0N — P!CK 0NE FR0M AN0THER WALLET F0R THE SWAP.';
      return;
    }
    // Reuses the exact same real signing flow (startSwapOffer, prepare ->
    // Xaman -> payload -> poll status -> result) that the old SWAP REVIEW
    // screen and the SWAP OFFERS tab's own reciprocate button already
    // use — sends YOUR offer (real NFTokenCreateOffer). The other wallet
    // then reciprocates and either side accepts from the SWAP OFFERS tab.
    startSwapOffer(state.simpleOffer.mine.nftId, state.simpleOffer.theirs.owner, { wantNftId: state.simpleOffer.theirs.nftId });
  });
  renderSimpleOffer();

  // ---- CONNECT SCYLLA — a real Xaman SignIn payload, not the old XummPkce
  // OAuth login. Several entry points share this one flow (the MY PIGEONS
  // tab's own CONNECT Σκύλλα button, the trustline banner's LOGIN button,
  // an unauthenticated SEND on DATABASE) — signing in always lands on MY
  // PIGEONS afterward, since that's where your pigeons AND your received
  // offers are.
  //
  // Reported live as wanting login to work like xrp.cafe's, where even
  // the FIRST action on desktop pushes straight to the phone: OAuth never
  // touches the payload/webhook pipeline at all (see xaman-webhook.js's
  // own comment), so a wallet's push token could only ever get earned
  // starting from its SECOND transaction through this app — never login,
  // and never the first offer/buy/list either. A real SignIn payload
  // resolves through that exact same webhook, so THIS is what earns the
  // token immediately — the one-time QR/tab moment here is what makes
  // every real action afterward, including the very first one, able to
  // push straight to the phone instead of needing its own QR/tab. ----
  var signinXamanTab = null;
  var signinUuid = null;
  var signinPollTimer = null;
  // One real panel, one state at a time — replaces the old bare button +
  // a single line of status text that kept growing ("Σκύλλα://S!GNAL ::
  // WA!T!NG F0R S!GNATURE... Σκύλλα D!DN T 0PEN? TAP HERE." all run
  // together) as more got appended to it. IDLE is the only state with a
  // CONNECT button; ERR0R always gets its own real TRY AGA!N button
  // rather than expecting a second click on a button that's still there
  // from before. Mode drives .connect-panel's own class (see its CSS) for
  // the signal-bars animation + colour.
  function renderConnectPanel(mode, opts){
    opts = opts || {};
    el.connectPanel.className = 'connect-panel' + (mode === 'error' ? ' connect-panel-error' : (mode === 'idle' ? '' : ' connect-panel-active'));
    if (mode === 'idle'){
      el.connectPanelTitle.innerHTML = 'CONNECT <span style="text-transform:none;">Σκύλλα</span>';
      el.connectPanelSub.textContent = 'S!GN !N W!TH XAMAN T0 TRADE, L!ST, AND TRACK Y0UR FL0CK.';
      el.connectPanelActions.innerHTML = '<button type="button" class="connect-panel-btn" id="connectScyllaBtn">CONNECT <span style="text-transform:none;">Σκύλλα</span></button>';
    } else if (mode === 'connecting'){
      el.connectPanelTitle.textContent = 'Σκύλλα://S!GNAL';
      el.connectPanelSub.textContent = 'C0NNECT!NG...';
      el.connectPanelActions.innerHTML = '';
    } else if (mode === 'waiting'){
      el.connectPanelTitle.textContent = 'WA!T!NG F0R S!GNATURE';
      el.connectPanelSub.innerHTML = 'CHECK Y0UR PH0NE F0R THE <span style="text-transform:none;">Σκύλλα</span> REQUEST !N XAMAN.';
      el.connectPanelActions.innerHTML = '<a href="' + escapeHtml(opts.url) + '" target="_blank" rel="noopener" class="connect-panel-btn connect-panel-btn-outline xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE</a>';
    } else if (mode === 'error'){
      el.connectPanelTitle.textContent = opts.title || 'ERR://C0NNECT!0N FA!LED';
      el.connectPanelSub.textContent = opts.sub || 'S0METH!NG BR0KE ON THE WAY T0 XAMAN.';
      el.connectPanelActions.innerHTML = '<button type="button" class="connect-panel-btn" id="connectScyllaBtn">TRY AGA!N</button>';
    }
  }
  // Delegated once — connectScyllaBtn is a fresh element every render
  // (see renderConnectPanel above), so a listener bound directly to it
  // would silently stop working the moment IDLE/ERR0R swap it back in.
  el.connectPanelActions.addEventListener('click', function(e){
    var btn = e.target.closest('#connectScyllaBtn');
    if (!btn) return;
    btn.disabled = true;
    startAuthorize();
  });
  function resetLoginButtons(mode, opts){
    el.pigeonsLoginBtn.disabled = false;
    el.pigeonsLoginBtn.textContent = 'L0G!N';
    // Every caller of this is a login failure — pop the real error state
    // (with its own TRY AGA!N) back into the panel, but only if this tab
    // is still the one actually showing it (see loadMyPigeons — it stays
    // hidden entirely once a session exists).
    if (!MY_WALLET) renderConnectPanel(mode || 'error', opts);
  }
  // A real timeout backstop so CONNECT!NG can never sit stuck forever
  // with no way to retry short of a full reload, regardless of which
  // specific way the sign request stalls — same reasoning as every other
  // Xaman flow in this app.
  var AUTHORIZE_TIMEOUT_MS = 25000;
  var authorizeTimeoutTimer = null;
  function clearAuthorizeTimeout(){
    clearTimeout(authorizeTimeoutTimer);
    authorizeTimeoutTimer = null;
  }
  function startAuthorize(){
    clearAuthorizeTimeout();
    renderConnectPanel('connecting');
    authorizeTimeoutTimer = setTimeout(function(){
      resetLoginButtons('error', { title: 'ERR://T!MED 0UT', sub: 'THE S!GN REQUEST T00K T00 L0NG — TRY AGA!N.' });
    }, AUTHORIZE_TIMEOUT_MS);
    // Opened synchronously in the original click handler (a real user
    // gesture) so it's never popup-blocked — same pattern every other
    // Xaman sign flow in this app already uses.
    signinXamanTab = openXamanPopup();
    fetch('/api/xaman-signin-prepare', { method: 'POST' })
      .then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
      .then(function(res){
        if (!res.ok || !res.data.ok){
          clearAuthorizeTimeout();
          closeXamanTabAndFocus(signinXamanTab);
          signinXamanTab = null;
          resetLoginButtons('error', { title: 'ERR://C0NNECT!0N FA!LED', sub: 'C0ULDN T REACH THE SERVER — TRY AGA!N.' });
          return;
        }
        signinUuid = res.data.uuid;
        navigateXamanPopup(signinXamanTab, res.data.next.always);
        renderConnectPanel('waiting', { url: res.data.next.always });
        pollSigninStatus();
      }).catch(function(){
        clearAuthorizeTimeout();
        closeXamanTabAndFocus(signinXamanTab);
        signinXamanTab = null;
        resetLoginButtons('error', { title: 'ERR://S!GNAL_L0ST', sub: 'TRY AGA!N.' });
      });
  }
  function pollSigninStatus(){
    if (signinPollTimer) clearTimeout(signinPollTimer);
    if (!signinUuid) return;
    fetch('/api/xaman-signin-status?uuid=' + encodeURIComponent(signinUuid))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'signed'){
          clearAuthorizeTimeout();
          closeXamanTabAndFocus(signinXamanTab);
          signinXamanTab = null;
          window.location.href = '/static?connected=1&tab=mypigeons';
          return;
        }
        if (data.status === 'rejected'){
          clearAuthorizeTimeout();
          resetLoginButtons('error', { title: 'S!GNATURE REJECTED', sub: 'REJECTED !N XAMAN — TRY AGA!N WHEN Y0U RE READY.' });
          return;
        }
        if (data.status === 'expired'){
          clearAuthorizeTimeout();
          resetLoginButtons('error', { title: 'ERR://REQUEST EXP!RED', sub: 'TRY AGA!N.' });
          return;
        }
        signinPollTimer = setTimeout(pollSigninStatus, 2000);
      }).catch(function(){
        signinPollTimer = setTimeout(pollSigninStatus, 3000);
      });
  }
  el.pigeonsLoginBtn.addEventListener('click', function(){
    el.pigeonsLoginBtn.disabled = true;
    el.pigeonsLoginBtn.textContent = 'C0NNECT!NG...';
    startAuthorize();
  });
  el.swapSignOutBtn.addEventListener('click', function(){
    el.swapSignOutBtn.disabled = true;
    el.swapSignOutBtn.textContent = 'S!GN!NG 0UT...';
    fetch('/api/disconnect', { method: 'POST' }).then(function(){
      window.location.href = '/static';
    }).catch(function(){
      window.location.href = '/static';
    });
  });

  // ---- Trustline banner LOGIN state — real held-Pigeons count + real
  // $PIGEONS trustline/balance from account_lines (fetchPigeonsAccountLine
  // via pigeonsAccountLine=1), shown in place of SET TRUSTLINE/COPY
  // ADDRESS/LOGIN once MY_WALLET is a real server-verified session. ----
  // Own-wallet pigeon list, cached the moment it's first fetched (right
  // here at login) so SH0W MY P!GE0NS can paint instantly from memory
  // instead of waiting on a second identical fetch — see browseOwnerCollection.
  // null = not fetched yet.
  var myOwnPigeonsCache = null;
  var myOwnPigeonsCacheFailed = false; // true once apiWithRetry has genuinely given up, not just still trying
  // The in-flight request, while there is one — lets browseOwnerCollection
  // (SH0W MY P!GE0NS/the FL0CK tab) chain onto THIS same request instead
  // of firing its own separate, identical apiWithRetry({wallet}) call
  // whenever you navigate there before this eager login-time fetch has
  // landed. That duplicate call is exactly why "Σκύλλα will show 61 [the
  // tab label, from this fetch]... but my pigeons takes a long time [the
  // actual grid]" could happen: two concurrent requests for the same
  // slow, real XRPL account_nfts lookup, racing each other, with the
  // grid's own loading state tied to whichever happened to be slower.
  var myOwnPigeonsCachePromise = null;
  // Own function (not just inlined in loadTrustlineLoginState) so a
  // failed attempt can be retried from the MY P!GE0NS box's own click
  // handler without re-running everything else loadTrustlineLoginState
  // does (wallet label, trustline balance, etc), and so
  // browseOwnerCollection can share its in-flight promise instead of
  // duplicating the request.
  // Follow-up resolve for whichever nftIds the fast phase (see wallet=
  // in pigeons.js/resolveOwnerCollectionFast in _shared.js) couldn't
  // cover from Deeptide's own bulk index — a real XRPL wallet lookup
  // used to block the ENTIRE page on however many slow, uncached,
  // individual per-item metadata fetches (fetchPigeonFullMeta) that
  // took, reported live as "my pigeons takes way too long". Now those
  // few items just merge in whenever this smaller follow-up lands,
  // instead of holding up everything else that was ready immediately.
  // Silent on failure — those specific items just stay missing rather
  // than breaking the ones that already loaded fine.
  function resolvePendingWalletItems(wallet, pendingIds, onMerged){
    if (!pendingIds || !pendingIds.length) return;
    apiWithRetry({ wallet: wallet, resolveIds: pendingIds.join(',') }).then(function(data){
      if (data.items && data.items.length) onMerged(data.items);
    }).catch(function(){});
  }
  function loadMyOwnPigeonsCache(){
    if (myOwnPigeonsCachePromise) return myOwnPigeonsCachePromise;
    myOwnPigeonsCacheFailed = false;
    updateSearchPanelTitleForPaws();
    myOwnPigeonsCachePromise = apiWithRetry({ wallet: MY_WALLET }).then(function(data){
      myOwnPigeonsCache = data.items || [];
      // The real total the instant the fast phase lands, not just
      // however many happened to resolve immediately — items.length
      // alone would undercount while anything's still in pendingIds.
      trustlinePigeonCount = myOwnPigeonsCache.length + (data.pendingIds ? data.pendingIds.length : 0);
      renderTrustlineSummary();
      updateSearchPanelTitleForPaws();
      myOwnPigeonsCachePromise = null;
      resolvePendingWalletItems(MY_WALLET, data.pendingIds, function(extra){
        myOwnPigeonsCache = myOwnPigeonsCache.concat(extra).sort(function(a, b){ return (a.number || 0) - (b.number || 0); });
        trustlinePigeonCount = myOwnPigeonsCache.length;
        renderTrustlineSummary();
        // Only touch the live grid/count if this wallet's own scope is
        // still what's actually showing — this can land well after the
        // fast phase, by which point the user may have navigated
        // elsewhere entirely.
        if (isOwnWalletScope()){
          state.scopeAllItems = myOwnPigeonsCache;
          myPigeonsData = myOwnPigeonsCache;
          el.nodeCount.textContent = 'P!GE0NS HELD :: ' + state.scopeAllItems.length;
          updateSearchPanelTitleForPaws();
          runScopedQuery();
        }
      });
      return myOwnPigeonsCache;
    }).catch(function(err){
      myOwnPigeonsCacheFailed = true;
      updateSearchPanelTitleForPaws();
      myOwnPigeonsCachePromise = null;
      throw err;
    });
    return myOwnPigeonsCachePromise;
  }
  // Count and balance are fetched in parallel (independent endpoints) and
  // can resolve in either order — each just updates its own piece of state
  // and calls this shared render, instead of one write clobbering the
  // other's already-painted result.
  var trustlinePigeonCount = null; // null = not loaded yet
  var trustlineBalanceNum = null; // null = not loaded yet
  // BALANCE is the banner's main feature — the big centered $PIGEONS
  // number people should actually look at. BUY $P!GE0NS now shows
  // underneath it regardless of the balance's value (was previously
  // hidden once you held any amount, on the assumption an empty balance
  // was the only time anyone would want to buy — real feedback: someone
  // already holding a real balance still wants a quick way to buy more).
  function renderTrustlineSummary(){
    // The pigeon count only ever shows once now, inside SH0W MY FL0CK
    // itself — used to also have its own standalone "58" line right
    // above it (pigeonsLoggedInCount), showing the exact same number
    // twice in the same small identity block. Left blank rather
    // than showing a placeholder while still loading, since the button
    // reads fine on its own either way ("SH0W MY FL0CK").
    el.showMyPigeonsCount.textContent = trustlinePigeonCount === null ? '' : ' :: ' + trustlinePigeonCount.toLocaleString();
    var meta = COLLECTION_META[state.collection];
    if (trustlineBalanceNum === null){
      el.pigeonsBalanceValue.innerHTML = '…';
      el.pigeonsBalanceBuyBtn.style.display = 'none';
    } else {
      el.pigeonsBalanceValue.innerHTML = greenNum(trustlineBalanceNum.toLocaleString(undefined, { maximumFractionDigits: 2 })) + ' ' + meta.tokenLabel;
      // BUY $TOKEN opens the XRP<->token AMM swap panel — only meaningful
      // for a collection with real pool data (see COLLECTION_META.hasAmm).
      el.pigeonsBalanceBuyBtn.style.display = meta.hasAmm ? '' : 'none';
    }
    updateFlockTabLabel();
  }
  // FL0CK doubles as the login entry point (see topTabs' click handler) —
  // logged-out state spells that out right on the tab itself instead of
  // making you click in to discover a CONNECT button. Logged-in state
  // shows the same real pigeon count as the trustline banner's own "N
  // P!GE0NS 0WNED" (trustlinePigeonCount, already fetched eagerly at
  // login — see loadTrustlineLoginState below) plus a real pending-offer
  // count (offersReceivedTotal, also now fetched eagerly — see
  // loadOffersReceived's own call near the bottom of this script) in red
  // whenever it's above zero. null counts (still loading) are simply
  // left out rather than shown as a misleading 0.
  function updateFlockTabLabel(){
    if (!MY_WALLET){
      // The tab itself is now named Σκύλλα (see terminal — the site's
      // whole verification system, not just the /scylla page), so the
      // logged-out sub-label just needs "L0G !N", not "W!TH Σκύλλα" again.
      el.flockTabLabel.innerHTML = '<span class="flock-tab-brand">Σκύλλα</span> <span class="flock-tab-login">L0G !N</span>';
      return;
    }
    // Was three separate " :: "-joined text segments ("Σκύλλα :: 60
    // P!GE0NS :: 3 0FFERS") — confirmed live this wrapped to 2-3 broken
    // lines inside the mobile tab's own boxed grid (not enough room for
    // that much joined text at any reasonable size), splitting mid-
    // phrase ("60" / "P!GE0NS" on separate lines). Down to one real
    // segment (brand :: count) plus a small notification-dot badge for
    // pending offers instead of a second joined phrase — same
    // information, far less text to actually wrap.
    var offersDot = offersReceivedTotal > 0 ? '<span class="flock-tab-offer-dot" title="' + offersReceivedTotal + ' 0FFER' + (offersReceivedTotal === 1 ? '' : 'S') + ' RECE!VED">' + offersReceivedTotal + '</span>' : '';
    var parts = ['<span class="flock-tab-brand">Σκύλλα' + offersDot + '</span>'];
    if (trustlinePigeonCount !== null) parts.push('<span class="flock-tab-count">' + trustlinePigeonCount + ' P!GE0NS</span>');
    el.flockTabLabel.innerHTML = parts.join(' :: ');
  }
  function loadTrustlineLoginState(){
    if (!MY_WALLET){
      el.pigeonsBarLoggedOut.style.display = '';
      el.pigeonsBarLoggedIn.style.display = 'none';
      el.pigeonsBalanceLoginWrap.style.display = '';
      el.pigeonsBalanceValue.style.display = 'none';
      updateFlockTabLabel();
      return;
    }
    el.pigeonsBarLoggedOut.style.display = 'none';
    el.pigeonsBarLoggedIn.style.display = '';
    el.pigeonsBalanceLoginWrap.style.display = 'none';
    el.pigeonsBalanceValue.style.display = '';
    el.pigeonsLoggedInWallet.textContent = 'S!GNED !N AS :: ' + MY_WALLET.slice(0, 9) + '...' + MY_WALLET.slice(-4);
    trustlinePigeonCount = null;
    trustlineBalanceNum = null;
    renderTrustlineSummary();
    el.pigeonsLoggedInTrustline.textContent = '';
    // Both fetches are independent (item count vs. account_line balance) —
    // run them in parallel instead of one waiting on the other, so each
    // paints as soon as it's ready instead of the slower of the two
    // gating both.
    loadMyOwnPigeonsCache();
    apiWithRetry({ pigeonsAccountLine: 1, wallet: MY_WALLET }).then(function(line){
      trustlineBalanceNum = (line && line.hasTrustline) ? (line.balance || 0) : 0;
      renderTrustlineSummary();
      // Redundant to spell out "TRUSTLINE SET" — owning pigeons or holding
      // a real $PIGEONS balance already proves that. Only worth surfacing
      // when it's NOT set, since that's the one case actually actionable.
      el.pigeonsLoggedInTrustline.textContent = (line && line.hasTrustline === false) ? 'TRUSTL!NE N0T SET' : '';
    }).catch(function(){});
  }
  loadTrustlineLoginState();
  // Fetched eagerly (not just on FL0CK tab open, see showTab) so a real
  // pending offer shows up on the tab itself the moment the page loads —
  // see updateFlockTabLabel above. loadOffersReceived already no-ops
  // with no session.
  loadOffersReceived();
  loadOutgoingOffers();
  loadIncomingTransfers();
  // Lands on FL0CK now (was: DATABASE, self-scoped) — "SH0W MY FL0CK"
  // should actually take you to the FL0CK tab, not just filter DATABASE
  // down to your own wallet while leaving you on it.
  el.showMyPigeonsBtn.addEventListener('click', function(){
    if (MY_WALLET) browseOwnerCollection(MY_WALLET, 'Y0U', undefined, 'mypigeons');
  });

  // ---- LIST A PIGEON — first real Σκύλλα listing test: create-offer
  // only. No buyer/acceptance flow, no Σκύλλα fee yet (see HANDOFF.md). ----
  var listingTarget = null; // { nftId, number, image, priceValue } — the pigeon currently being listed
  var listingUuid = null;
  var listingPollTimer = null;
  var listingXamanTab = null;

  // A real sized popup window (chrome-less: no menubar/toolbar/address
  // bar) instead of a full new browser tab — reads as an actual app
  // dialog for the Xaman handoff instead of a stray abandoned tab. Same
  // named target ('xamanSign') every time, so a second sign request
  // reuses/replaces the same popup rather than spawning more of them.
  // Note: the popup itself still shows a blank moment while xumm.app's
  // own hosted sign page loads — that load time is Xaman's, not
  // something this site controls; this only changes the window's shape.
  var XAMAN_POPUP_FEATURES = 'width=420,height=760,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes';
  // No popup at all on mobile — see navigateXamanPopup's own comment for
  // why. Only relevant above the mobile breakpoint now.
  function openXamanPopup(){
    return window.innerWidth <= 700 ? null : window.open('', 'xamanSign', XAMAN_POPUP_FEATURES);
  }
  // The real, remaining cause of "doesn't open Xaman" on mobile, even
  // after the null-tabRef popup fallback below was fixed: the URL XUMM
  // returns (next.always, e.g. https://xumm.app/sign/<uuid>) is a
  // Universal Link/App Link — iOS/Android intercept a real top-level
  // navigation to it and hand off straight to the installed Xaman app
  // without ever loading the web page at all. That interception is
  // unreliable-to-nonexistent from inside a window.open()'d tab (popup
  // or plain new-tab alike) on mobile — confirmed as the actual
  // remaining gap after the previous "sized popup returns a dead
  // Window reference instead of null" fix still left BUY/MAKE 0FFER
  // stuck on "WA!T!NG F0R S!GNATURE..." with the tab genuinely opening
  // but never actually switching to the app. Below the mobile
  // breakpoint this now navigates the CURRENT tab directly instead of
  // opening any tab at all — a real top-level navigation, which is
  // exactly what Universal Links are designed to be triggered by. The
  // existing "S!GN !N W!TH Σκύλλα, THEN RETURN HERE" messaging and the
  // status-poll loop already assume you leave and come back, so this
  // matches the intended flow rather than fighting it.
  function navigateXamanPopup(tabRef, url){
    if (window.innerWidth <= 700){ window.location.href = url; return; }
    // Desktop only past this point (mobile already returned above) — a
    // real popup-blocker denial is the only way tabRef comes back null
    // here now that openXamanPopup() itself only ever attempts a popup
    // on desktop. Not XAMAN_POPUP_FEATURES again — a plain window.open
    // is enough for this rare fallback case.
    if (tabRef) tabRef.location.href = url;
    else window.open(url, '_blank');
  }

  // Every .xaman-manual-link ("Σκύλλα D!DN T 0PEN? TAP HERE.") is marked
  // up with target="_blank" for desktop (opening the sign page in a new
  // tab is the right call there) — but on mobile that's exactly the
  // "inside a window.open()'d tab" context Universal Links don't reliably
  // interrupt (see navigateXamanPopup's own comment). A real top-level
  // navigation, which is what an unmodified same-tab link tap already
  // is, gives this manual fallback the best real chance of actually
  // switching into the Xaman app instead of just loading xumm.app's web
  // page. One delegated listener covers all eleven sign flows.
  document.addEventListener('click', function(e){
    if (window.innerWidth > 700) return;
    var link = e.target.closest('.xaman-manual-link');
    if (!link) return;
    e.preventDefault();
    window.location.href = link.href;
  });
  // Once a poll confirms a sign request actually settled, the Xaman tab
  // has done its job — close it and bring focus back to this tab instead
  // of leaving the user staring at Xaman's own "signed" page.
  function closeXamanTabAndFocus(tabRef){
    if (tabRef){ try { tabRef.close(); } catch (e){} }
    window.focus();
  }

  function listingErrorMessage(code){
    var messages = {
      not_configured: COLLECTION_META[state.collection].tokenLabel + ' L!ST!NGS ARE N0T C0NF!GURED YET.',
      xaman_not_configured: 'XAMAN S!GN!NG !S N0T C0NF!GURED YET.',
      not_owned: 'TH!S WALLET D0ES N0T 0WN TH!S P!GE0N.',
      not_transferable: 'TH!S P!GE0N !S N0T TRANSFERABLE.',
      not_a_pigeon: 'N0T A VAL!D P!GE0N NFT.',
      invalid_price: 'ENTER A VAL!D PR!CE GREATER THAN 0.',
      no_session: 'C0NNECT Y0UR WALLET F!RST.',
      invalid_session: 'S!GNAL EXP!RED — REC0NNECT Y0UR WALLET.',
      not_listed: 'TH!S P!GE0N !S N0T CURRENTLY L!STED.',
      cannot_buy_own_listing: 'Y0U CAN\\'T BUY Y0UR 0WN L!ST!NG.',
      not_listed_by_you: 'TH!S P!GE0N !SN\\'T L!STED BY Y0UR WALLET.',
      lookup_failed: 'S!GNAL !NTERFERENCE — C0ULDN\\'T VER!FY THE L!ST!NG. TRY AGA!N.',
      invalid_to_wallet: 'TARGET WALLET ADDRESS !S!NVAL!D.',
      cannot_swap_with_self: 'Y0U CAN\\'T SWAP W!TH Y0UR 0WN WALLET.',
      xaman_request_failed: 'C0ULDN\\'T REACH XAMAN — TRY AGA!N.',
      not_indexed: 'C0ULDN\\'T L00K UP TH!S P!GE0N — TRY AGA!N.',
      cannot_offer_own_pigeon: 'Y0U CAN\\'T MAKE AN 0FFER 0N Y0UR 0WN P!GE0N.',
      offer_not_found: 'TH!S 0FFER N0 L0NGER EX!STS 0N-LEDGER.',
      listing_price_unavailable: 'PR!CE !S ST!LL SYNC!NG — TRY AGA!N !N A M0MENT.',
      already_processing: 'TH!S L!ST!NG !S ALREADY BE!NG PURCHASED BY S0MEONE ELSE R!GHT N0W.',
      cannot_accept_own_offer: 'Y0U CAN\\'T ACCEPT AN 0FFER FR0M Y0UR 0WN WALLET.',
      unexpected_offer_currency: 'TH!S 0FFER !SN\\'T !N REAL ' + COLLECTION_META[state.collection].tokenLabel + ' — REFUS!NG T0 ACCEPT !T.',
      invalid_offer_amount: 'TH!S 0FFER AM0UNT !S!NVAL!D.',
      invalid_username: 'USERNAME MUST BE LETTERS, NUMBERS, UNDERSC0RES 0R EM0J!, UP T0 20 CHARACTERS.',
      pfp_unavailable: 'C0ULDN\\'T L0AD TH!S P!GE0N S !MAGE — TRY AGA!N.',
      nothing_to_update: 'N0TH!NG T0 SAVE.'
    };
    return (code && messages[code]) || 'ERR://C0ULD N0T PREPARE THE TRANSACT!0N.';
  }

  // Fast inline LIST — price input + button live directly on the pigeon's
  // own card (myPigeonCardHtml), same as DATABASE's OFFER AMOUNT box.
  // Clicking LIST goes straight to Xaman: swap-listing-payload.js already
  // re-derives and re-validates the whole txjson from just nftId+priceValue
  // (never trusts a client txjson), so there's nothing a separate prepare/
  // confirm screen would add here except an extra click. The final result
  // still gets the full screenListResult screen (tx hash link etc).
  var listingBtnEl = null;
  var listingStatusEl = null;
  function submitInlineListing(p, priceValue, cardEl, durationDays){
    if (!priceValue || isNaN(Number(priceValue)) || Number(priceValue) <= 0){
      alert('ENTER A VAL!D PR!CE GREATER THAN 0.');
      return;
    }
    listingTarget = p;
    listingTarget.priceValue = priceValue;
    listingBtnEl = cardEl.querySelector('.list-inline-btn');
    listingStatusEl = cardEl.querySelector('.list-inline-status');
    listingBtnEl.disabled = true;
    listingBtnEl.textContent = 'L!ST!NG...';
    if (listingStatusEl){ listingStatusEl.style.display = 'none'; listingStatusEl.textContent = ''; }
    // Open a blank tab synchronously in this click handler, then navigate
    // it once the fetch resolves — window.open() called inside the async
    // .then() below gets silently popup-blocked in most browsers.
    listingXamanTab = openXamanPopup();
    fetch('/api/swap-listing-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: p.nftId, priceValue: priceValue, durationDays: durationDays, collection: state.collection })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        closeXamanTabAndFocus(listingXamanTab);
        listingXamanTab = null;
        listingBtnEl.disabled = false;
        listingBtnEl.textContent = 'L!ST';
        if (listingStatusEl){ listingStatusEl.style.display = ''; listingStatusEl.textContent = listingErrorMessage(res.data && res.data.error); }
        return;
      }
      listingUuid = res.data.uuid;
      navigateXamanPopup(listingXamanTab, res.data.next.always);
      listingBtnEl.textContent = 'WA!T!NG F0R S!GNATURE...';
      if (listingStatusEl){ listingStatusEl.style.display = ''; listingStatusEl.innerHTML = 'S!GN !N W!TH <span style="text-transform:none;">Σκύλλα</span>, THEN RETURN HERE.<br><a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>'; }
      pollListingStatus();
    }).catch(function(){
      closeXamanTabAndFocus(listingXamanTab);
      listingXamanTab = null;
      listingBtnEl.disabled = false;
      listingBtnEl.textContent = 'L!ST';
      if (listingStatusEl){ listingStatusEl.style.display = ''; listingStatusEl.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.'; }
    });
  }

  function pollListingStatus(){
    if (listingPollTimer) clearTimeout(listingPollTimer);
    if (!listingUuid || !listingTarget) return;
    fetch('/api/swap-listing-status?uuid=' + encodeURIComponent(listingUuid) + '&nftId=' + encodeURIComponent(listingTarget.nftId) + '&collection=' + encodeURIComponent(state.collection))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'listed'){
          myListedData[listingTarget.nftId] = { price: data.price, currency: data.currency, offerId: data.offerId, expiration: data.expiration || null };
          closeXamanTabAndFocus(listingXamanTab);
          listingXamanTab = null;
          showListingResult(data);
          return;
        }
        if (data.status === 'rejected'){
          if (listingStatusEl){ listingStatusEl.style.display = ''; listingStatusEl.textContent = 'S!GNATURE REJECTED !N XAMAN.'; }
          if (listingBtnEl){ listingBtnEl.disabled = false; listingBtnEl.textContent = 'L!ST'; }
          return;
        }
        if (data.status === 'expired'){
          if (listingStatusEl){ listingStatusEl.style.display = ''; listingStatusEl.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.'; }
          if (listingBtnEl){ listingBtnEl.disabled = false; listingBtnEl.textContent = 'L!ST'; }
          return;
        }
        if (data.status === 'failed'){
          if (listingStatusEl){ listingStatusEl.style.display = ''; listingStatusEl.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').'; }
          if (listingBtnEl){ listingBtnEl.disabled = false; listingBtnEl.textContent = 'L!ST'; }
          return;
        }
        // 'pending' or 'signed_pending_ledger' — keep polling.
        listingPollTimer = setTimeout(pollListingStatus, 2000);
      }).catch(function(){
        listingPollTimer = setTimeout(pollListingStatus, 3000);
      });
  }

  function showListingResult(data){
    // Every LIST now enters through the amount-entry popup (see
    // openAmountEntryModal) — close it here, the moment the full LISTED
    // result screen takes over, rather than leaving it sitting on top.
    closeAmountEntryModal();
    el.listResultPigeonNum.innerHTML = collectionItemLabel() + ' #' +(listingTarget.number !== null ? greenNum(listingTarget.number) : '????');
    // Compact (123M), same as BUY N0W/the own-listing readouts elsewhere —
    // this is the one big number on the receipt, not a small field value,
    // so it gets the same treatment as everywhere else a price needs to
    // read at a glance instead of being counted out digit by digit.
    el.listResultPrice.textContent = fmtPigeonsCompact(data.price);
    if (data.txHash){
      el.listResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.listResultTxLink.style.display = '';
    } else {
      el.listResultTxLink.removeAttribute('href');
      el.listResultTxLink.style.display = 'none';
    }
    showScreen('listresult');
  }
  el.listResultDoneBtn.addEventListener('click', function(){
    listingTarget = null;
    listingUuid = null;
    listingBtnEl = null;
    listingStatusEl = null;
    if (listingPollTimer) clearTimeout(listingPollTimer);
    renderMyPigeonsList();
    state.activeTab = 'mypigeons';
    showScreen('browse');
  });

  // ---- BUY — Σκύλλα SWAP phase 2: NFTokenAcceptOffer against a real,
  // live sell offer. No fee, no negotiation — LIST -> BUY -> SETTLE only. ----
  var buyTarget = null; // { nftId, number, image } — the pigeon currently being bought
  var buyUuid = null;
  var buyPollTimer = null;
  var buyXamanTab = null;
  // Clicking BUY N0W while logged out used to just alert("C0NNECT Y0UR
  // WALLET F!RST.") and stop dead — a native blocking alert() that reads
  // as "nothing happens" on mobile in particular (reported live as "i
  // cant buy now on mobile"), and even once dismissed, left you back
  // where you started with no path forward except finding the login
  // button yourself and re-finding this same Pigeon after. Now it kicks
  // off the real Σκύλλα login instead, remembers which Pigeon you were
  // trying to buy across the login redirect (a real page navigation —
  // see pollSigninStatus's own success handler — so in-memory state
  // doesn't survive it, only sessionStorage does), and resumes straight into
  // this same confirm flow once you're back. See the resumePendingBuy()
  // call near the bottom of this script for the other half.
  var PENDING_BUY_STORAGE_KEY = 'skyllaPendingBuyNftId';
  // No confirm-first step any more — BUY N0W opens Xaman immediately
  // (reported live as not wanting a confirmation step, same change
  // already made for CANCEL/DELIST and ACCEPT OFFER — see
  // openDelistConfirm's own comment). PIGEON/SELLER/PR!CE still populate,
  // just a moment later once submitBuyPayload's own response lands (it
  // now returns the same seller/totalValue the old prepare-first screen
  // used to show up front) instead of gating Xaman behind them.
  function openBuyConfirm(p){
    if (!MY_WALLET){
      try { sessionStorage.setItem(PENDING_BUY_STORAGE_KEY, p.nftId); } catch (e){}
      startAuthorize();
      return;
    }
    buyTarget = p;
    el.buyConfPigeon.innerHTML = collectionItemLabel() + ' #' +(p.number !== null ? greenNum(p.number) : '????');
    el.buyConfSeller.textContent = '';
    el.buyConfPrice.textContent = '';
    el.buyConfirmStatus.textContent = 'REQUEST!NG...';
    setWaitingPulse(el.buyConfirmStatus, true);
    el.screenBuyResult.style.display = 'none';
    el.screenBuyConfirm.style.display = '';
    el.buyConfirmModal.style.display = 'flex';
    // Opened here, synchronously inside the real click — see
    // navigateXamanPopup's own comment; the window.open(realUrl, ...) call
    // used to happen from inside submitBuyPayload's own async
    // fetch().then() instead, which mobile browsers in particular treat
    // as no longer a trusted user gesture and silently refuse.
    buyXamanTab = openXamanPopup();
    submitBuyPayload();
  }
  // Shared by the BACK button, a backdrop click, and browser-back (see
  // closeTopmostOverlayForBack) — same pattern every other confirm popup
  // on this page uses (closeOfferConfirmModal etc).
  function closeBuyConfirmModal(){
    buyTarget = null;
    el.buyConfirmModal.style.display = 'none';
  }
  el.buyConfirmBackBtn.addEventListener('click', closeBuyConfirmModal);
  el.buyConfirmModal.addEventListener('click', function(e){ if (e.target === el.buyConfirmModal) closeBuyConfirmModal(); });

  // ---- BUY $P!GE0NS swap panel (trustline banner's BUY $P!GE0NS button —
  // was a plain external DexScreener link). STAGE 3: real live quote,
  // walking the actual XRPL order book (quotePigeonsForXrpDrops in
  // _shared.js) — still no txjson, no Xaman, SIGN & BUY stays disabled
  // through this stage regardless of quote validity (nothing built yet to
  // actually submit). ----
  // Which collection this open panel session is buying — set by
  // openBuySwapPanel(collectionKey) below, read by every fetch/display
  // call in this whole block instead of assuming $PIGEONS or the
  // ambient state.collection (this panel is reachable straight from
  // MAINFRAME now, where state.collection may not match whichever BUY
  // button was actually clicked).
  var buySwapCollection = 'pigeons';
  var buySwapMaxDrops = null; // null = no cap known yet (not logged in, or balance fetch pending/failed)
  // Fallback only — the real reserve (base + one owner-reserve increment
  // per owned ledger object: trustlines, NFT pages, offers, etc.) comes
  // back from the xrpBalance API as reserveDrops (see accountReserveDrops
  // in _shared.js). This flat guess is used only if that field is ever
  // missing, so a wallet holding a lot of NFTs/objects doesn't silently
  // fall back to under-reserving. Server-side buildBuySwapTxjson re-checks
  // the real reserve again before ever signing anything either way.
  var BUYSWAP_RESERVE_BUFFER_DROPS = 2000000n;
  function updateBuySwapMaxLine(){
    if (buySwapMaxDrops === null){
      el.buySwapMaxLine.style.display = 'none';
      return;
    }
    el.buySwapMaxLine.style.display = '';
    el.buySwapMaxLine.textContent = 'MAX :: ' + dropsToXrpString(buySwapMaxDrops) + ' XRP AVA!LABLE';
  }
  function showBuySwapInputError(msg){
    el.buySwapInputError.textContent = msg;
    el.buySwapInputError.style.display = '';
  }
  function clearBuySwapInputError(){
    el.buySwapInputError.textContent = '';
    el.buySwapInputError.style.display = 'none';
  }
  // Returns the entered amount as exact integer drops (BigInt), or null if
  // the field is empty/invalid/negative/zero/over the known max — never
  // trusts parseFloat for anything that could end up in a transaction
  // later.
  function validateBuySwapInput(){
    var raw = el.buySwapXrpInput.value.trim();
    if (!raw){ clearBuySwapInputError(); return null; }
    var drops = dropsFromXrpString(raw);
    if (drops === null){
      showBuySwapInputError('ENTER A VAL!D XRP AM0UNT (UP T0 6 DEC!MAL PLACES, N0 NEGAT!VES).');
      return null;
    }
    if (drops <= 0n){
      showBuySwapInputError('ENTER AN AM0UNT GREATER THAN 0.');
      return null;
    }
    if (buySwapMaxDrops !== null && drops > buySwapMaxDrops){
      showBuySwapInputError('EXCEEDS YOUR AVA!LABLE XRP BALANCE.');
      return null;
    }
    clearBuySwapInputError();
    return drops;
  }

  // 0.5% — matches the SL!PPAGE figure shown in the panel itself. Applied
  // to the live quote's estimated PIGEONS to compute M!N!MUM RECE!VED;
  // basis-point integer math, not a float multiply.
  var BUYSWAP_SLIPPAGE_BPS = 50;
  var buySwapQuote = null;        // last successful quote's raw result, or null
  var buySwapQuoteForRaw = null;  // the exact input string that quote was for
  var buySwapReqId = 0;           // ignore a stale in-flight response that resolves after the input changed again
  var buySwapDebounceTimer = null;
  var buySwapRefreshInterval = null;
  var buySwapAgeInterval = null;
  var BUYSWAP_DEBOUNCE_MS = 450;
  var BUYSWAP_REFRESH_MS = 20000; // re-quote periodically so an open panel never sits on a stale price for long

  function stopBuySwapTimers(){
    if (buySwapDebounceTimer){ clearTimeout(buySwapDebounceTimer); buySwapDebounceTimer = null; }
    if (buySwapRefreshInterval){ clearInterval(buySwapRefreshInterval); buySwapRefreshInterval = null; }
    if (buySwapAgeInterval){ clearInterval(buySwapAgeInterval); buySwapAgeInterval = null; }
  }
  function clearBuySwapQuote(statusText){
    buySwapQuote = null;
    buySwapQuoteForRaw = null;
    el.buySwapReceiveValue.textContent = '—';
    el.buySwapRate.textContent = '—';
    el.buySwapMinReceived.textContent = '—';
    el.buySwapSignBtn.disabled = true;
    el.buySwapSignBtn.title = 'QU0TE N0T YET AVA!LABLE';
    if (buySwapAgeInterval){ clearInterval(buySwapAgeInterval); buySwapAgeInterval = null; }
    el.buySwapStatus.textContent = statusText || 'ENTER AN AM0UNT T0 GET A L!VE QU0TE.';
  }
  function startBuySwapAgeTicker(){
    if (buySwapAgeInterval) clearInterval(buySwapAgeInterval);
    var startedAt = Date.now();
    function tick(){
      var secs = Math.floor((Date.now() - startedAt) / 1000);
      el.buySwapStatus.textContent = secs < 2 ? 'QU0TE UPDATED :: JUST N0W' : 'QU0TE UPDATED :: ' + secs + 'S AG0';
    }
    tick();
    buySwapAgeInterval = setInterval(tick, 1000);
  }
  // Fires on input (debounced) and on the periodic refresh timer alike —
  // always re-validates against the CURRENT input value rather than
  // trusting whatever drops amount it was originally scheduled for, so a
  // fast edit right before a debounce/refresh fires can't apply an old
  // quote to a since-changed amount.
  function fetchBuySwapQuote(){
    // Defense in depth — the input is already disabled whenever this isn't
    // true (applyBuySwapGate), so a user can't normally get here, but the
    // periodic refresh timer calls this directly too.
    if (buySwapHasTrustline !== true) return;
    var drops = validateBuySwapInput();
    if (drops === null){ clearBuySwapQuote(); return; }
    var raw = el.buySwapXrpInput.value.trim();
    var myReq = ++buySwapReqId;
    el.buySwapSignBtn.disabled = true;
    el.buySwapStatus.textContent = 'GETT!NG QU0TE...';
    apiWithRetry({ pigeonsQuote: 1, xrpDrops: drops.toString(), collection: buySwapCollection }).then(function(data){
      if (myReq !== buySwapReqId) return; // superseded by a newer request
      if (el.buySwapXrpInput.value.trim() !== raw) return; // input changed while this was in flight
      if (!data || !data.ok){
        buySwapQuote = null;
        buySwapQuoteForRaw = null;
        el.buySwapReceiveValue.textContent = '—';
        el.buySwapRate.textContent = '—';
        el.buySwapMinReceived.textContent = '—';
        el.buySwapSignBtn.disabled = true;
        if (buySwapAgeInterval){ clearInterval(buySwapAgeInterval); buySwapAgeInterval = null; }
        el.buySwapStatus.textContent = (data && data.insufficientLiquidity)
          ? 'N0T EN0UGH L!QU!D!TY 0N THE B00K F0R TH!S AM0UNT — TRY A SMALLER AM0UNT.'
          : 'QU0TE UNAVA!LABLE — TRY AGA!N.';
        return;
      }
      buySwapQuote = data;
      buySwapQuoteForRaw = raw;
      var quoteTokenLabel = COLLECTION_META[buySwapCollection].tokenLabel;
      el.buySwapReceiveValue.textContent = data.receivePigeons.toLocaleString(undefined, { maximumFractionDigits: 2 });
      el.buySwapRate.textContent = data.rate.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + quoteTokenLabel + ' / XRP';
      var minReceived = data.receivePigeons * (10000 - BUYSWAP_SLIPPAGE_BPS) / 10000;
      el.buySwapMinReceived.textContent = minReceived.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + quoteTokenLabel;
      // STAGE 5: a valid, live, trustline-confirmed quote is finally
      // enough to let SIGN & BUY actually be clicked — but clicking it
      // only opens the REVIEW screen (buyswap-prepare.js re-derives
      // everything from scratch server-side); it still doesn't sign or
      // call Xaman anywhere.
      el.buySwapSignBtn.disabled = false;
      el.buySwapSignBtn.title = 'REV!EW THE EXACT TRANSACT!0N BEF0RE ANYTH!NG !S S!GNED';
      startBuySwapAgeTicker();
    }).catch(function(){
      if (myReq !== buySwapReqId) return;
      buySwapQuote = null;
      buySwapQuoteForRaw = null;
      el.buySwapSignBtn.disabled = true;
      if (buySwapAgeInterval){ clearInterval(buySwapAgeInterval); buySwapAgeInterval = null; }
      el.buySwapStatus.textContent = 'QU0TE UNAVA!LABLE — TRY AGA!N.';
    });
  }
  function scheduleBuySwapQuote(){
    if (buySwapHasTrustline !== true) return;
    if (buySwapDebounceTimer) clearTimeout(buySwapDebounceTimer);
    var drops = validateBuySwapInput();
    if (drops === null){
      clearBuySwapQuote();
      return;
    }
    el.buySwapStatus.textContent = 'GETT!NG QU0TE...';
    buySwapDebounceTimer = setTimeout(fetchBuySwapQuote, BUYSWAP_DEBOUNCE_MS);
  }

  // ---- STAGE 4: real live trustline check, before the input is even
  // usable. null = not checked yet this time the panel was opened
  // (fails closed — input stays disabled until we positively confirm
  // true, never assumed true by default or on a failed check). ----
  var buySwapHasTrustline = null;
  function applyBuySwapGate(){
    var gateTokenLabel = COLLECTION_META[buySwapCollection].tokenLabel;
    if (!MY_WALLET){
      el.buySwapPayRow.style.display = 'none';
      el.buySwapTrustlineWarning.style.display = 'none';
      el.buySwapXrpInput.disabled = true;
      clearBuySwapQuote('L0G !N T0 BUY ' + gateTokenLabel + '.');
      return;
    }
    if (buySwapHasTrustline === null){
      el.buySwapPayRow.style.display = 'none';
      el.buySwapTrustlineWarning.style.display = 'none';
      el.buySwapXrpInput.disabled = true;
      clearBuySwapQuote('CHECK!NG Y0UR ' + gateTokenLabel + ' TRUSTL!NE...');
      return;
    }
    if (buySwapHasTrustline === false){
      el.buySwapPayRow.style.display = 'none';
      el.buySwapTrustlineWarningTitle.textContent = '⚠ TRUSTL!NE REQU!RED';
      el.buySwapTrustlineWarning.style.display = '';
      el.buySwapXrpInput.disabled = true;
      clearBuySwapQuote('Y0UR WALLET CAN\\'T RECE!VE ' + gateTokenLabel + ' YET — SET THE TRUSTL!NE AB0VE F!RST.');
      return;
    }
    el.buySwapPayRow.style.display = '';
    el.buySwapTrustlineWarning.style.display = 'none';
    el.buySwapXrpInput.disabled = false;
    // Without this, the status line just kept showing whichever message
    // the null/false branches above last left it on (usually "CHECK!NG
    // Y0UR $P!GE0NS TRUSTL!NE..." forever) even once the trustline was
    // actually confirmed — nothing updated it until the user typed an
    // amount and triggered a quote fetch.
    clearBuySwapQuote('TRUSTL!NE SET ✓');
  }
  // Three static sub-states inside #buySwapModal, exactly one visible at a
  // time — same pattern as acceptTransferConfirmModal's own form/receipt
  // toggle, just three states instead of two.
  function showBuySwapState(name){
    el.buySwapEntryState.style.display = name === 'entry' ? '' : 'none';
    el.buySwapConfirmState.style.display = name === 'confirm' ? '' : 'none';
    el.buySwapResultState.style.display = name === 'result' ? '' : 'none';
  }
  function closeBuySwapModal(){
    el.buySwapModal.style.display = 'none';
    stopBuySwapTimers();
  }
  el.buySwapModal.addEventListener('click', function(e){ if (e.target === el.buySwapModal) closeBuySwapModal(); });
  // collectionKey: which token this session buys — defaults to 'pigeons'
  // so every existing caller (the trustline banner's own BUY button,
  // FL0CK's BUY box) keeps working unchanged; MAINFRAME's own BUY
  // buttons (see mainframeGrid's click handler) pass their own card's
  // collection explicitly instead of relying on state.collection, since
  // MAINFRAME can open this panel for a collection that isn't the one
  // currently active in DATABASE.
  function openBuySwapPanel(collectionKey){
    buySwapCollection = collectionKey || 'pigeons';
    var meta = COLLECTION_META[buySwapCollection];
    el.buySwapTitle.textContent = '// BUY ' + meta.tokenLabel;
    el.buySwapReceiveUnit.textContent = meta.tokenLabel.replace(/^\\$/, '');
    if (meta.tokenIssuer){
      el.buySwapIssuerAddr.setAttribute('data-full', meta.tokenIssuer);
      el.buySwapIssuerAddr.textContent = meta.tokenIssuer.slice(0, 5) + '...' + meta.tokenIssuer.slice(-3);
    }
    el.buySwapXrpInput.value = '';
    clearBuySwapInputError();
    stopBuySwapTimers();
    buySwapMaxDrops = null;
    updateBuySwapMaxLine();
    buySwapHasTrustline = null;
    applyBuySwapGate();
    showBuySwapState('entry');
    el.buySwapModal.style.display = 'flex';
    if (MY_WALLET){
      apiWithRetry({ xrpBalance: 1, wallet: MY_WALLET, collection: buySwapCollection }).then(function(data){
        if (!data || typeof data.drops !== 'string' || !/^\\d+$/.test(data.drops)) return;
        var bal = BigInt(data.drops);
        var reserve = (typeof data.reserveDrops === 'string' && /^\\d+$/.test(data.reserveDrops))
          ? BigInt(data.reserveDrops)
          : BUYSWAP_RESERVE_BUFFER_DROPS;
        var max = bal - reserve;
        buySwapMaxDrops = max > 0n ? max : 0n;
        updateBuySwapMaxLine();
        validateBuySwapInput();
      }).catch(function(){});
      // Real live account_lines check, same source the trustline banner's
      // own LOGIN state uses (fetchPigeonsAccountLine) — never assumed
      // from cached state, this panel can open right after a fresh login
      // before that banner state has even settled.
      apiWithRetry({ pigeonsAccountLine: 1, wallet: MY_WALLET, collection: buySwapCollection }).then(function(data){
        buySwapHasTrustline = !!(data && data.hasTrustline);
        applyBuySwapGate();
      }).catch(function(){
        // Lookup failed — fail closed, never let an unknown result read as
        // "trustline confirmed present."
        buySwapHasTrustline = false;
        applyBuySwapGate();
      });
    }
    // Keeps an open panel's quote from sitting stale for minutes — only
    // re-quotes when there's actually a valid amount entered AND the
    // trustline is confirmed (see fetchBuySwapQuote's own guard too).
    buySwapRefreshInterval = setInterval(function(){
      if (buySwapHasTrustline === true && validateBuySwapInput() !== null) fetchBuySwapQuote();
    }, BUYSWAP_REFRESH_MS);
  }
  el.pigeonsBalanceBuyBtn.addEventListener('click', function(){ openBuySwapPanel(state.collection); });
  el.flockBuyPigeonsBox.addEventListener('click', function(){ openBuySwapPanel(state.collection); });
  // navigator.clipboard needs a secure context (https, which this site
  // always is), but its own permission can still be denied even when the
  // API itself exists (confirmed live: some embedded/in-app browser
  // contexts reject writeText with a real permission error) — falling
  // back to the execCommand trick only when the API is missing entirely
  // silently left the button dead with zero feedback in exactly that case.
  // Now the fallback runs on ANY writeText failure, not just its absence.
  var flockWalletCopyResetTimer = null;
  function copyToClipboardFallback(text){
    var tmp = document.createElement('textarea');
    tmp.value = text;
    tmp.style.position = 'fixed';
    tmp.style.opacity = '0';
    document.body.appendChild(tmp);
    tmp.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(tmp);
    return ok;
  }
  function handleFlockWalletCopy(){
    if (!MY_WALLET) return;
    function showCopied(){
      el.flockWalletCopyHint.textContent = 'C0P!ED!';
      el.flockWalletBox.classList.add('flock-wallet-copy-done');
      clearTimeout(flockWalletCopyResetTimer);
      flockWalletCopyResetTimer = setTimeout(function(){
        el.flockWalletCopyHint.textContent = 'CL!CK T0 C0PY';
        el.flockWalletBox.classList.remove('flock-wallet-copy-done');
      }, 1500);
    }
    function showFailed(){
      el.flockWalletCopyHint.textContent = 'C0PY FA!LED';
      clearTimeout(flockWalletCopyResetTimer);
      flockWalletCopyResetTimer = setTimeout(function(){
        el.flockWalletCopyHint.textContent = 'CL!CK T0 C0PY';
      }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(MY_WALLET).then(showCopied).catch(function(){
        if (copyToClipboardFallback(MY_WALLET)) showCopied(); else showFailed();
      });
      return;
    }
    if (copyToClipboardFallback(MY_WALLET)) showCopied(); else showFailed();
  }
  el.flockWalletBox.addEventListener('click', handleFlockWalletCopy);
  // role="button"/tabindex on the box (see its own markup comment) needs
  // its own Enter/Space handling — a real <button> gets this for free,
  // a plain <div> acting as one doesn't.
  el.flockWalletBox.addEventListener('keydown', function(e){
    if (e.key === 'Enter' || e.key === ' '){
      e.preventDefault();
      handleFlockWalletCopy();
    }
  });
  el.flockMyFlockBox.addEventListener('click', function(){
    // A previous attempt genuinely failed (see loadMyOwnPigeonsCache) —
    // retry that instead of toggling collapse, which would otherwise
    // just expand/collapse a grid that has no real data to show either
    // way.
    if (myOwnPigeonsCacheFailed){ loadMyOwnPigeonsCache(); return; }
    state.flockCollapsed = !state.flockCollapsed;
    updateSearchPanelTitleForPaws();
    // Expanding (not collapsing) should actually bring the real grid
    // into view — was just an in-place expand with no scroll at all, so
    // on a page already scrolled down (or on a short viewport) it could
    // expand entirely off-screen with nothing visible to suggest
    // anything happened. Same landing spot scrollActiveTabPanelIntoView
    // uses for every other way into MY PIGEONS (the SH0W MY NFTs button,
    // the Σκύλλα top tab) — "SH0W!NG Y0UR P!GE0NS :: N" pinned to the
    // top of the screen, not just centered on the grid below it.
    if (!state.flockCollapsed) el.searchPanelTitle.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  el.flockChangeCollectionBox.addEventListener('click', function(){
    showTab('database');
    openDbSelectFlyout();
  });
  // Used to do nothing at all when clicked — reported live, now goes to
  // the real 0FFERS RECE!VED view (renderMyOffersList).
  el.flockOffersBox.addEventListener('click', function(){
    showTab('myoffers');
  });
  el.flockProfileBox.addEventListener('click', function(){
    showTab('profile');
  });
  // Messaging paused — see the MESSAGE !NB0X box's own HTML comment.
  // Nothing to wire up here any more (no click handler, no unread-badge
  // fetch against an endpoint that only ever 500s in prod).
  // BUY $P!GE0NS is the one entry point everywhere now (FL0CK shows the
  // exact same banner as DATABASE, no more BALANCE-amount-as-buy-button
  // substitution — that only existed while FL0CK's banner was slimmed).
  el.buySwapXrpInput.addEventListener('input', scheduleBuySwapQuote);
  el.buySwapCopyIssuerBtn.addEventListener('click', function(){
    var addr = el.buySwapIssuerAddr ? el.buySwapIssuerAddr.getAttribute('data-full') : '';
    var done = function(){
      el.buySwapCopyIssuerLabel.textContent = 'C0P!ED';
      setTimeout(function(){ el.buySwapCopyIssuerLabel.textContent = 'C0PY'; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr).then(done, done);
    else done();
  });
  el.buySwapBackBtn.addEventListener('click', closeBuySwapModal);

  // SIGN & BUY opens the REVIEW screen — the actual prepare call
  // re-derives the quote/trustline/balance from scratch server-side
  // (buyswap-prepare.js), same "never trust the client's own numbers"
  // rule every other transaction-prep endpoint in this app follows. No
  // Xaman payload is created here yet.
  var buySwapReviewDrops = null; // the exact drops string OPEN XAMAN will request a payload for
  var buySwapUuid = null;
  var buySwapXamanTab = null;
  var buySwapPollTimer = null;
  el.buySwapSignBtn.addEventListener('click', function(){
    if (el.buySwapSignBtn.disabled) return;
    var raw = el.buySwapXrpInput.value.trim();
    var drops = dropsFromXrpString(raw);
    if (drops === null) return; // shouldn't happen — button is only enabled after a valid quote
    el.buySwapSignBtn.disabled = true;
    el.buySwapSignBtn.textContent = 'PREPAR!NG...';
    fetch('/api/buyswap-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xrpDrops: drops.toString(), collection: buySwapCollection })
    }).then(function(r){ return r.json().then(function(data){ return { status: r.status, data: data }; }); }).then(function(res){
      el.buySwapSignBtn.disabled = false;
      el.buySwapSignBtn.textContent = 'S!GN & BUY';
      if (res.status !== 200 || !res.data || !res.data.ok){
        var msg = (res.data && res.data.error) || 'unknown_error';
        alert('C0ULD N0T PREPARE THE SWAP — ' + msg + '. TRY AGA!N.');
        // The exact state that failed (quote moved, trustline lost, balance
        // changed) may no longer be valid — re-run the live checks instead
        // of leaving a stale enabled button up.
        validateBuySwapInput();
        fetchBuySwapQuote();
        return;
      }
      var txjson = res.data.txjson;
      var display = res.data.display;
      var confTokenLabel = COLLECTION_META[buySwapCollection].tokenLabel;
      buySwapReviewDrops = drops.toString();
      el.buySwapConfTxType.textContent = txjson.TransactionType;
      el.buySwapConfAccount.textContent = txjson.Account;
      el.buySwapConfSendMax.textContent = dropsToXrpString(BigInt(txjson.SendMax)) + ' XRP';
      // Formatted the same way EST!MATED RECE!VE below it is (locale
      // thousands separator, 2 decimals) — used to show the raw
      // txjson.Amount.value string instead (e.g. "5086.089804"), reading
      // as a different, less-trustworthy number right next to a properly
      // formatted one for the same currency.
      el.buySwapConfAmount.textContent = Number(txjson.Amount.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + confTokenLabel;
      el.buySwapConfEstimate.textContent = display.estimateReceivePigeons.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + confTokenLabel;
      el.buySwapConfRate.textContent = display.rate.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + confTokenLabel + ' / XRP';
      el.buySwapConfSource.textContent = display.source === 'amm' ? 'AMM P00L' : '0RDER B00K';
      el.buySwapConfirmStatus.textContent = '';
      el.buySwapOpenXamanBtn.disabled = false;
      el.buySwapOpenXamanBtn.innerHTML = '0PEN XAMAN';
      showBuySwapState('confirm');
    }).catch(function(){
      el.buySwapSignBtn.disabled = false;
      el.buySwapSignBtn.textContent = 'S!GN & BUY';
      alert('C0ULD N0T REACH THE SERVER — TRY AGA!N.');
    });
  });
  el.buySwapConfirmBackBtn.addEventListener('click', function(){
    if (buySwapPollTimer){ clearTimeout(buySwapPollTimer); buySwapPollTimer = null; }
    showBuySwapState('entry');
  });

  // STAGE 6: the tab is opened HERE, synchronously inside the click
  // handler, and only pointed at the real Xaman URL once the fetch
  // resolves — opening it inside the .then() callback instead is what
  // browsers treat as an untrusted popup and silently block (see the
  // identical pattern/comment on the swap-offer OPEN XAMAN handler above).
  el.buySwapOpenXamanBtn.addEventListener('click', function(){
    if (!buySwapReviewDrops) return;
    el.buySwapOpenXamanBtn.disabled = true;
    el.buySwapOpenXamanBtn.textContent = 'REQUEST!NG...';
    el.buySwapConfirmStatus.textContent = '';
    var xamanTab = openXamanPopup();
    fetch('/api/buyswap-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ xrpDrops: buySwapReviewDrops, collection: buySwapCollection })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        if (xamanTab) xamanTab.close();
        el.buySwapOpenXamanBtn.disabled = false;
        el.buySwapOpenXamanBtn.textContent = '0PEN XAMAN';
        el.buySwapConfirmStatus.textContent = 'C0ULD N0T PREPARE THE S!GN REQUEST — ' + ((res.data && res.data.error) || 'unknown_error') + '. TRY AGA!N.';
        return;
      }
      buySwapUuid = res.data.uuid;
      navigateXamanPopup(xamanTab, res.data.next.always);
      buySwapXamanTab = xamanTab;
      el.buySwapOpenXamanBtn.textContent = 'WA!T!NG F0R S!GNATURE...';
      el.buySwapConfirmStatus.innerHTML = 'S!GN !N W!TH <span style="text-transform:none;">Σκύλλα</span>, THEN RETURN HERE.<br><a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>';
      pollBuySwapStatus();
    }).catch(function(){
      if (xamanTab) xamanTab.close();
      el.buySwapOpenXamanBtn.disabled = false;
      el.buySwapOpenXamanBtn.textContent = '0PEN XAMAN';
      el.buySwapConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });

  // Never reports success on Xaman's word alone — buyswap-status.js only
  // returns 'settled' after independently verifying the transaction is a
  // real, validated, tesSUCCESS result on-ledger (fetchValidatedTxResult
  // in _shared.js). 'signed_pending_ledger' means Xaman confirmed signing
  // but that hasn't shown up as validated yet — keep polling, not success.
  function pollBuySwapStatus(){
    if (buySwapPollTimer) clearTimeout(buySwapPollTimer);
    if (!buySwapUuid) return;
    fetch('/api/buyswap-status?uuid=' + encodeURIComponent(buySwapUuid) + '&collection=' + encodeURIComponent(buySwapCollection))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'settled'){
          closeXamanTabAndFocus(buySwapXamanTab);
          buySwapXamanTab = null;
          showBuySwapResult(data);
          return;
        }
        if (data.status === 'rejected'){
          el.buySwapConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.buySwapOpenXamanBtn.disabled = false;
          el.buySwapOpenXamanBtn.textContent = '0PEN XAMAN';
          return;
        }
        if (data.status === 'expired'){
          el.buySwapConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.buySwapOpenXamanBtn.disabled = false;
          el.buySwapOpenXamanBtn.textContent = '0PEN XAMAN';
          return;
        }
        if (data.status === 'failed'){
          el.buySwapConfirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.buySwapOpenXamanBtn.disabled = false;
          el.buySwapOpenXamanBtn.textContent = '0PEN XAMAN';
          return;
        }
        buySwapPollTimer = setTimeout(pollBuySwapStatus, 2000);
      }).catch(function(){
        buySwapPollTimer = setTimeout(pollBuySwapStatus, 3000);
      });
  }

  function showBuySwapResult(data){
    var resultTokenLabel = COLLECTION_META[buySwapCollection].tokenLabel;
    el.buySwapResultReceived.innerHTML = data.receivedPigeons !== null && data.receivedPigeons !== undefined
      ? greenNum(Number(data.receivedPigeons).toLocaleString(undefined, { maximumFractionDigits: 6 })) + ' <span class="buyswap-received-unit">' + resultTokenLabel + '</span>'
      : 'EXACT AM0UNT UNAVA!LABLE';
    if (data.txHash){
      el.buySwapResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.buySwapResultTxLink.style.display = '';
    } else {
      el.buySwapResultTxLink.removeAttribute('href');
      el.buySwapResultTxLink.style.display = 'none';
    }
    showBuySwapState('result');
  }
  el.buySwapResultDoneBtn.addEventListener('click', function(){
    buySwapUuid = null;
    buySwapReviewDrops = null;
    if (buySwapPollTimer){ clearTimeout(buySwapPollTimer); buySwapPollTimer = null; }
    closeBuySwapModal();
    loadTrustlineLoginState(); // refreshes the trustline banner's $PIGEONS balance now that it just changed
  });

  function submitBuyPayload(retriesLeft){
    if (retriesLeft === undefined) retriesLeft = 1;
    fetch('/api/swap-buy-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: buyTarget.nftId, collection: state.collection })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok && res.data && res.data.error === 'lookup_failed' && retriesLeft > 0){
        setTimeout(function(){ submitBuyPayload(retriesLeft - 1); }, 500);
        return;
      }
      if (!res.ok || !res.data.ok){
        closeXamanTabAndFocus(buyXamanTab);
        buyXamanTab = null;
        setWaitingPulse(el.buyConfirmStatus, false);
        var rawCode2 = (res.data && res.data.error) || 'n0_b0dy';
        el.buyConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error) + ' ' + rawCode2;
        return;
      }
      buyUuid = res.data.uuid;
      navigateXamanPopup(buyXamanTab, res.data.next.always);
      if (res.data.display){
        setWalletText(el.buyConfSeller, res.data.display.seller, shortAddr(res.data.display.seller));
        el.buyConfPrice.textContent = fmtPigeons(res.data.display.totalValue);
      }
      el.buyConfirmStatus.innerHTML = 'S!GN !N W!TH <span style="text-transform:none;">Σκύλλα</span>, THEN RETURN HERE.<br><a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>';
      pollBuyStatus();
    }).catch(function(e){
      closeXamanTabAndFocus(buyXamanTab);
      buyXamanTab = null;
      setWaitingPulse(el.buyConfirmStatus, false);
      el.buyConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N. ' + (e && e.message ? e.message : String(e));
    });
  }

  function pollBuyStatus(){
    if (buyPollTimer) clearTimeout(buyPollTimer);
    if (!buyUuid || !buyTarget) return;
    fetch('/api/swap-buy-status?uuid=' + encodeURIComponent(buyUuid) + '&nftId=' + encodeURIComponent(buyTarget.nftId) + '&collection=' + encodeURIComponent(state.collection))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'settled'){
          closeXamanTabAndFocus(buyXamanTab);
          buyXamanTab = null;
          showBuyResult(data);
          return;
        }
        // No button to reset any more (see openBuyConfirm — BUY N0W opens
        // Xaman immediately now, no separate confirm step) — just leave
        // the reason showing; BACK (still available) closes this, and
        // clicking BUY N0W again on the grid starts a fresh attempt.
        if (data.status === 'rejected'){
          setWaitingPulse(el.buyConfirmStatus, false);
          el.buyConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          return;
        }
        if (data.status === 'expired'){
          setWaitingPulse(el.buyConfirmStatus, false);
          el.buyConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          return;
        }
        if (data.status === 'failed' || data.status === 'sell_offer_gone'){
          setWaitingPulse(el.buyConfirmStatus, false);
          var buyReason = data.status === 'sell_offer_gone' ? 'TH!S L!ST!NG WAS CANCELLED 0R S0LD BEF0RE Y0UR PURCHASE C0ULD SETTLE.'
            : 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.buyConfirmStatus.textContent = buyReason;
          return;
        }
        // 'signed_pending_ledger' (buyer's offer not yet visible) and
        // 'brokering_in_progress' (offer confirmed, broker wallet is now
        // building/submitting the actual brokered accept) both just keep
        // polling with a status line that reflects which stage this
        // actually is — same pattern as ACCEPT OFFER's identical poll.
        if (data.status === 'brokering_in_progress'){
          el.buyConfirmStatus.textContent = 'OFFER C0NF!RMED — SETTL!NG SALE...';
        } else if (data.status === 'signed_pending_ledger'){
          el.buyConfirmStatus.textContent = 'S!GNED — WA!T!NG F0R LEDGER C0NF!RMAT!0N...';
        }
        buyPollTimer = setTimeout(pollBuyStatus, 2000);
      }).catch(function(){
        buyPollTimer = setTimeout(pollBuyStatus, 3000);
      });
  }

  function showBuyResult(data){
    el.buyResultPigeonNum.innerHTML = collectionItemLabel() + ' #' +(buyTarget.number !== null ? greenNum(buyTarget.number) : '????');
    el.buyResultPrice.textContent = el.buyConfPrice.textContent;
    el.buyResultStatus.textContent = 'SETTLED';
    if (data.txHash){
      el.buyResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.buyResultTxLink.textContent = shortHash(data.txHash);
    } else {
      el.buyResultTxLink.removeAttribute('href');
      el.buyResultTxLink.textContent = '—';
    }
    el.screenBuyConfirm.style.display = 'none';
    el.screenBuyResult.style.display = '';
  }
  el.buyResultDoneBtn.addEventListener('click', function(){
    buyUuid = null;
    if (buyPollTimer) clearTimeout(buyPollTimer);
    state.activeTab = 'database';
    showScreen('browse');
    closeBuyConfirmModal();
    runQuery(); // refreshes the LISTED grid so the now-sold Pigeon disappears
  });

  // ---- DELIST — Σκύλλα SWAP phase 2: NFTokenCancelOffer for the seller's
  // own active offer. ----
  var delistTarget = null; // { nftId, number, image }
  var delistUuid = null;
  var delistPollTimer = null;
  var delistXamanTab = null;

  // No "are you sure" step any more — CANCEL opens Xaman immediately,
  // reported live as not wanting a confirmation for this one. Merges what
  // used to be two clicks (open the "are you sure" modal, then its own
  // DEL!ST W!TH Σκύλλα button) into this one function, called directly
  // from the CANCEL button's own click handler.
  function openDelistConfirm(p){
    delistTarget = p;
    el.delistConfPigeon.innerHTML = collectionItemLabel() + ' #' +(p.number !== null ? greenNum(p.number) : '????');
    el.delistConfirmStatus.textContent = 'REQUEST!NG...';
    setWaitingPulse(el.delistConfirmStatus, true);
    el.screenDelistResult.style.display = 'none';
    el.screenDelistConfirm.style.display = '';
    el.delistConfirmModal.style.display = 'flex';
    // Opened here, synchronously inside the real click — see
    // navigateXamanPopup's own comment; the window.open(realUrl, ...)
    // call below used to happen from inside the async fetch().then()
    // instead, which mobile browsers in particular treat as no longer a
    // trusted user gesture and silently refuse.
    delistXamanTab = openXamanPopup();
    fetch('/api/swap-delist-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: p.nftId, collection: state.collection })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        closeXamanTabAndFocus(delistXamanTab);
        delistXamanTab = null;
        setWaitingPulse(el.delistConfirmStatus, false);
        el.delistConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      delistUuid = res.data.uuid;
      navigateXamanPopup(delistXamanTab, res.data.next.always);
      el.delistConfirmStatus.innerHTML = 'S!GN !N W!TH <span style="text-transform:none;">Σκύλλα</span>, THEN RETURN HERE.<br><a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>';
      pollDelistStatus();
    }).catch(function(){
      closeXamanTabAndFocus(delistXamanTab);
      delistXamanTab = null;
      setWaitingPulse(el.delistConfirmStatus, false);
      el.delistConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  }
  // Shared by the BACK button, a backdrop click, and browser-back — same
  // pattern every other confirm popup on this page uses.
  function closeDelistConfirmModal(){
    delistTarget = null;
    el.delistConfirmModal.style.display = 'none';
  }
  el.delistConfirmBackBtn.addEventListener('click', closeDelistConfirmModal);
  el.delistConfirmModal.addEventListener('click', function(e){ if (e.target === el.delistConfirmModal) closeDelistConfirmModal(); });

  function pollDelistStatus(){
    if (delistPollTimer) clearTimeout(delistPollTimer);
    if (!delistUuid || !delistTarget) return;
    fetch('/api/swap-delist-status?uuid=' + encodeURIComponent(delistUuid) + '&nftId=' + encodeURIComponent(delistTarget.nftId) + '&collection=' + encodeURIComponent(state.collection))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'delisted'){
          closeXamanTabAndFocus(delistXamanTab);
          delistXamanTab = null;
          showDelistResult(data);
          return;
        }
        // No button to reset any more (see openDelistConfirm — CANCEL
        // opens Xaman immediately now, no separate confirm step) — just
        // leave the reason showing; BACK (still available) closes this,
        // and clicking CANCEL again on the grid starts a fresh attempt.
        if (data.status === 'rejected'){
          setWaitingPulse(el.delistConfirmStatus, false);
          el.delistConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          return;
        }
        if (data.status === 'expired'){
          setWaitingPulse(el.delistConfirmStatus, false);
          el.delistConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          return;
        }
        if (data.status === 'failed'){
          setWaitingPulse(el.delistConfirmStatus, false);
          el.delistConfirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          return;
        }
        delistPollTimer = setTimeout(pollDelistStatus, 2000);
      }).catch(function(){
        delistPollTimer = setTimeout(pollDelistStatus, 3000);
      });
  }

  function showDelistResult(data){
    el.delistResultPigeonNum.innerHTML = collectionItemLabel() + ' #' +(delistTarget.number !== null ? greenNum(delistTarget.number) : '????') + ' WAS DEL!STED.';
    // Wallet activity, not the raw tx hash — MY_WALLET is the seller who
    // just delisted, same account this whole flow ran as.
    if (MY_WALLET) el.delistResultWalletLink.href = 'https://bithomp.com/explorer/' + MY_WALLET;
    el.screenDelistConfirm.style.display = 'none';
    el.screenDelistResult.style.display = '';
    // Reflect the real delisted state the instant it's confirmed, not only
    // once BACK T0 MY P!GE0NS is later clicked — reported live as feeling
    // like nothing had happened, since the card grid underneath never
    // actually updated on its own (renderMyPigeonsList only ever refreshes
    // the unrelated Y0UR P!GE0N offer-picker, not a real browse grid — see
    // its own comment). Patches every in-memory copy of this Pigeon
    // directly instead of a slow full wallet re-fetch — the server already
    // confirmed the real on-ledger delist, nothing left to verify.
    if (delistTarget){
      var nftId = delistTarget.nftId;
      delete myListedData[nftId];
      [state.items, state.scopeAllItems, myOwnPigeonsCache].forEach(function(list){
        if (!list) return;
        var it = list.filter(function(p){ return p.nftId === nftId; })[0];
        if (it) it.scyllaListing = null;
      });
      if (state.scope) runScopedQuery();
      else if (state.items && state.items.length) renderResultsReplace(state.items);
    }
  }
  el.delistResultDoneBtn.addEventListener('click', function(){
    delistUuid = null;
    if (delistPollTimer) clearTimeout(delistPollTimer);
    renderMyPigeonsList();
    state.activeTab = 'mypigeons';
    showScreen('browse');
    closeDelistConfirmModal();
  });

  // ---- MAKE AN OFFER — the reverse of LIST: a real NFTokenCreateOffer
  // BUY-offer (no tfSellNFToken flag), which only the Pigeon's current
  // owner can accept. Same prepare -> confirm -> Xaman -> poll shape as
  // LIST, just Account = offerer instead of seller. ----
  var offerTarget = null; // { nftId, number, image }
  var offerUuid = null;
  var offerPollTimer = null;
  var offerXamanTab = null;

  // Entered right in the DATABASE card's own MAKE AN OFFER strip (see
  // wireResultClicks' .make-offer-send handler) — no separate form screen,
  // straight from the inline number to the confirm screen below.
  function submitMakeOffer(p, priceValue, stripEl, durationDays){
    // The server-side prepare endpoint requires a real logged-in session
    // (it derives the offering wallet from the pigeon_session cookie) —
    // rather than let that fail with a confusing auth error, send an
    // unauthenticated SEND straight into the real Σκύλλα login flow.
    if (!MY_WALLET){
      startAuthorize();
      return;
    }
    if (!priceValue || isNaN(Number(priceValue)) || Number(priceValue) <= 0){
      alert('ENTER A VAL!D PR!CE GREATER THAN 0.');
      return;
    }
    // Same live balance the popup's own BALANCE line (and the trustline
    // banner) reads — null means it hasn't loaded, in which case this
    // can't block (fails open rather than wrongly refusing a real offer
    // just because the balance fetch hasn't settled yet); the real prepare
    // endpoint has no balance check of its own since a $PIGEONS buy-offer
    // doesn't require the offerer to hold anything until it's accepted —
    // this is purely a "don't let you promise more than you have" UI guard.
    if (trustlineBalanceNum !== null && Number(priceValue) > trustlineBalanceNum){
      alert('Y0U D0N\\'T HAVE EN0UGH ' + COLLECTION_META[state.collection].tokenLabel + ' F0R TH!S 0FFER — BALANCE :: ' + trustlineBalanceNum.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + COLLECTION_META[state.collection].tokenLabel + '.');
      return;
    }
    var sendBtn = stripEl.querySelector('.make-offer-send');
    sendBtn.disabled = true;
    sendBtn.textContent = 'VAL!DAT!NG...';
    // Opened synchronously in THIS click handler (a real user gesture) so
    // it's not popup-blocked — startOfferSign() below reuses this exact
    // tab instead of trying to open its own from inside a .then(), which
    // browsers silently block. Desktop only (openXamanPopup returns null
    // on mobile — see its own comment; mobile navigates same-tab instead).
    offerXamanTab = openXamanPopup();
    fetch('/api/swap-makeoffer-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: p.nftId, priceValue: priceValue, durationDays: durationDays, collection: state.collection })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      sendBtn.disabled = false;
      sendBtn.textContent = 'SUBM!T';
      if (!res.ok || !res.data.ok){
        // The tab opened above has nowhere to go now — close it rather
        // than leave a blank tab sitting open after a failed validation.
        closeXamanTabAndFocus(offerXamanTab);
        offerXamanTab = null;
        alert(listingErrorMessage(res.data && res.data.error));
        return;
      }
      offerTarget = p;
      offerTarget.priceValue = priceValue;
      offerTarget.durationDays = durationDays;
      showOfferConfirm(res.data.txjson);
      // Straight into the real Xaman request the instant the offer is
      // valid — reported live as not wanting a separate review screen
      // requiring its own click first ("we dont need two screens...
      // click submit, this should open the qr code / auto-open your
      // wallet"). showOfferConfirm above still populates the modal (so
      // the pigeon/price/status area has something to show while this
      // request is in flight) and startOfferSign is still the exact
      // function el.offerOpenXamanBtn's own click retries through after
      // a rejection — this just fires it immediately too instead of
      // waiting on a first manual click.
      startOfferSign();
    }).catch(function(){
      closeXamanTabAndFocus(offerXamanTab);
      offerXamanTab = null;
      sendBtn.disabled = false;
      sendBtn.textContent = 'SUBM!T';
      alert('ERR://S!GNAL_L0ST — TRY AGA!N.');
    });
  }

  // Resting-state markup for offerOpenXamanBtn — restored via innerHTML
  // (never plain textContent, needs the Σκύλλα span) at every point this
  // button resets after an attempt.
  var OFFER_CONFIRM_BTN_HTML = 'C0NF!RM W!TH <span style="text-transform:none;">Σκύλλα</span>';
  function showOfferConfirm(txjson){
    // 0FFER can now start from the amount-entry popup on a card thumbnail
    // (see openAmountEntryModal) as well as the detail screen's own copy
    // — close it here unconditionally (a harmless no-op when it was
    // never open, e.g. the detail-screen path) the instant this second
    // popup takes over. A real second popup stacked on top, not a
    // showScreen navigation away from the grid — see #offerConfirmModal.
    closeAmountEntryModal();
    // No raw tx-type badge/NFTokenID/Amount.currency/Amount.issuer hex —
    // just the plain-English sentence: who, how much, for which Pigeon,
    // owned by whom. The real txjson (still exactly what gets signed,
    // re-derived server-side in swap-makeoffer-payload.js, never trusted
    // from the client) doesn't need to be spelled out on screen for that
    // to be true.
    // Recipient of the actual offer (the Pigeon's current owner) — needed
    // later for the optional ΣΚΥΛΛΑ://S!GNAL step (checkAndMaybeShowSignal),
    // not shown anywhere in this form itself any more (see the redesign
    // that dropped the 0WNED BY line).
    offerTarget.recipientWallet = txjson.Owner;
    el.offerConfPigeonNum.innerHTML = collectionItemLabel() + ' #' +(offerTarget.number !== null ? greenNum(offerTarget.number) : '????');
    el.offerConfPigeonImg.src = offerTarget.image || '';
    el.offerConfPigeonImg.style.display = offerTarget.image ? '' : 'none';
    el.offerConfValue.textContent = fmtPigeons(txjson.Amount.value);
    el.offerConfirmStatus.textContent = '';
    el.offerOpenXamanBtn.disabled = false;
    el.offerOpenXamanBtn.innerHTML = OFFER_CONFIRM_BTN_HTML;
    el.offerConfirmForm.style.display = '';
    el.offerConfirmReceipt.style.display = 'none';
    el.offerSignalState.style.display = 'none';
    el.offerConfirmModal.style.display = 'flex';
  }
  function closeOfferConfirmModal(){
    el.offerConfirmModal.style.display = 'none';
    offerTarget = null;
    if (offerSignalPollTimer) clearTimeout(offerSignalPollTimer);
    offerSignalUuid = null;
  }
  el.offerConfirmBackBtn.addEventListener('click', closeOfferConfirmModal);
  el.offerConfirmModal.addEventListener('click', function(e){ if (e.target === el.offerConfirmModal) closeOfferConfirmModal(); });
  // Picture/number both jump straight into the real detail view — this
  // closes the popup first (openDetail is a showScreen navigation, not
  // another stacked popup — see gotcha #10 in HANDOFF.md, popups don't
  // nest CSS-wise) rather than leaving it open underneath.
  function openOfferConfirmPigeonDetail(){
    if (!offerTarget) return;
    var nftId = offerTarget.nftId;
    closeOfferConfirmModal();
    openDetail(nftId);
  }
  el.offerConfPigeonImg.addEventListener('click', openOfferConfirmPigeonDetail);
  el.offerConfPigeonNum.addEventListener('click', openOfferConfirmPigeonDetail);

  // Extracted so submitMakeOffer can fire this immediately once the offer
  // validates (see its own comment), not just on el.offerOpenXamanBtn's
  // own click — that button still exists purely as the retry path after a
  // rejection/failure (see pollOfferStatus/the catch below re-enabling it).
  function startOfferSign(){
    if (!offerTarget) return;
    el.offerOpenXamanBtn.disabled = true;
    el.offerOpenXamanBtn.textContent = 'REQUEST!NG...';
    el.offerConfirmStatus.textContent = '';
    // Reuses a tab already opened synchronously by the caller's own click
    // handler (submitMakeOffer does this now) if there is one; opens its
    // own otherwise — the retry-after-rejection click on this button IS
    // itself a real user gesture, so opening fresh here is still safe
    // from popup-blocking in that case.
    if (!offerXamanTab) offerXamanTab = openXamanPopup();
    fetch('/api/swap-makeoffer-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: offerTarget.nftId, priceValue: offerTarget.priceValue, durationDays: offerTarget.durationDays, collection: state.collection })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        closeXamanTabAndFocus(offerXamanTab);
        offerXamanTab = null;
        el.offerOpenXamanBtn.disabled = false;
        el.offerOpenXamanBtn.innerHTML = OFFER_CONFIRM_BTN_HTML;
        el.offerConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      offerUuid = res.data.uuid;
      navigateXamanPopup(offerXamanTab, res.data.next.always);
      el.offerOpenXamanBtn.textContent = 'WA!T!NG F0R S!GNATURE...';
      el.offerConfirmStatus.innerHTML = '<a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>';
      pollOfferStatus();
    }).catch(function(){
      closeXamanTabAndFocus(offerXamanTab);
      offerXamanTab = null;
      el.offerOpenXamanBtn.disabled = false;
      el.offerOpenXamanBtn.innerHTML = OFFER_CONFIRM_BTN_HTML;
      el.offerConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  }
  el.offerOpenXamanBtn.addEventListener('click', startOfferSign);

  function pollOfferStatus(){
    if (offerPollTimer) clearTimeout(offerPollTimer);
    if (!offerUuid || !offerTarget) return;
    fetch('/api/swap-makeoffer-status?uuid=' + encodeURIComponent(offerUuid) + '&nftId=' + encodeURIComponent(offerTarget.nftId) + '&priceValue=' + encodeURIComponent(offerTarget.priceValue) + '&collection=' + encodeURIComponent(state.collection))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'offered'){
          closeXamanTabAndFocus(offerXamanTab);
          offerXamanTab = null;
          showOfferResult(data);
          return;
        }
        if (data.status === 'rejected'){
          el.offerConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.offerOpenXamanBtn.disabled = false;
          el.offerOpenXamanBtn.innerHTML = OFFER_CONFIRM_BTN_HTML;
          return;
        }
        if (data.status === 'expired'){
          el.offerConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.offerOpenXamanBtn.disabled = false;
          el.offerOpenXamanBtn.innerHTML = OFFER_CONFIRM_BTN_HTML;
          return;
        }
        if (data.status === 'failed'){
          el.offerConfirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.offerOpenXamanBtn.disabled = false;
          el.offerOpenXamanBtn.innerHTML = OFFER_CONFIRM_BTN_HTML;
          return;
        }
        offerPollTimer = setTimeout(pollOfferStatus, 2000);
      }).catch(function(){
        offerPollTimer = setTimeout(pollOfferStatus, 3000);
      });
  }

  function showOfferResult(data){
    // Same popup, not a screen navigation — swap to the receipt sub-state
    // in place (offerTarget stays set, still needs .number below).
    offerTarget.offerId = data.offerId;
    el.offerReceiptPigeonNum.innerHTML = collectionItemLabel() + ' #' +(offerTarget.number !== null ? greenNum(offerTarget.number) : '????');
    el.offerReceiptPrice.textContent = fmtPigeons(data.price);
    if (data.txHash){
      el.offerResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.offerResultTxLink.style.display = '';
    } else {
      el.offerResultTxLink.removeAttribute('href');
      el.offerResultTxLink.style.display = 'none';
    }
    el.offerConfirmForm.style.display = 'none';
    el.offerConfirmReceipt.style.display = '';
    checkAndMaybeShowSignal();
  }
  el.offerResultDoneBtn.addEventListener('click', function(){
    closeOfferConfirmModal();
    if (isOwnWalletScope()) runScopedQuery();
  });

  // ---- ΣΚΥΛΛΑ://S!GNAL — optional 123-drop XRP payment offered right
  // after a real OFFER SENT, only when the recipient (the Pigeon's owner)
  // has no existing activity on the site at all (swap-signal-check.js).
  // Entirely separate from the NFTokenCreateOffer itself — skipping this
  // leaves the real offer completely untouched either way. ----
  var offerSignalUuid = null;
  var offerSignalPollTimer = null;
  function checkAndMaybeShowSignal(){
    var target = offerTarget; // captured now — offerTarget could change if the popup closes before this resolves
    if (!target || !target.recipientWallet) return;
    fetch('/api/swap-signal-check?wallet=' + encodeURIComponent(target.recipientWallet))
      .then(function(r){ return r.json(); })
      .then(function(data){
        // The popup may have been closed (or a new offer started) by the
        // time this resolves — only act if it's still showing the exact
        // same offer's receipt.
        if (offerTarget !== target || el.offerConfirmModal.style.display === 'none') return;
        if (!data || data.hasActivity !== false) return; // has activity, or the check itself failed — stay quiet either way
        el.offerSignalWallet.textContent = data.walletShort || target.recipientWallet;
        el.offerSignalStatus.textContent = '';
        el.offerSignalSkipBtn.disabled = false;
        el.offerSignalSendBtn.disabled = false;
        el.offerSignalSendBtn.innerHTML = 'SEND S!GNAL';
        el.offerSignalPrompt.style.display = '';
        el.offerSignalSentConfirm.style.display = 'none';
        el.offerConfirmReceipt.style.display = 'none';
        el.offerSignalState.style.display = '';
      }).catch(function(){}); // silent — a failed check just means no S!GNAL offer this time, never blocks the real offer
  }
  el.offerSignalSkipBtn.addEventListener('click', function(){
    // Leaves the real offer completely untouched — this only ever
    // controls the separate notification payment.
    closeOfferConfirmModal();
    if (isOwnWalletScope()) runScopedQuery();
  });
  el.offerSignalSendBtn.addEventListener('click', function(){
    if (!offerTarget) return;
    var target = offerTarget;
    el.offerSignalSkipBtn.disabled = true;
    el.offerSignalSendBtn.disabled = true;
    el.offerSignalSendBtn.textContent = 'REQUEST!NG...';
    el.offerSignalStatus.textContent = '';
    var signalXamanTab = openXamanPopup();
    fetch('/api/swap-signal-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: target.nftId, offerId: target.offerId, toWallet: target.recipientWallet, pigeonNumber: target.number })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        closeXamanTabAndFocus(signalXamanTab);
        el.offerSignalSkipBtn.disabled = false;
        el.offerSignalSendBtn.disabled = false;
        el.offerSignalSendBtn.innerHTML = 'SEND S!GNAL';
        el.offerSignalStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      offerSignalUuid = res.data.uuid;
      navigateXamanPopup(signalXamanTab, res.data.next.always);
      el.offerSignalSendBtn.textContent = 'WA!T!NG F0R S!GNATURE...';
      el.offerSignalStatus.innerHTML = '<a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>';
      pollOfferSignalStatus(target, signalXamanTab);
    }).catch(function(){
      closeXamanTabAndFocus(signalXamanTab);
      el.offerSignalSkipBtn.disabled = false;
      el.offerSignalSendBtn.disabled = false;
      el.offerSignalSendBtn.innerHTML = 'SEND S!GNAL';
      el.offerSignalStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });
  function pollOfferSignalStatus(target, signalXamanTab){
    if (offerSignalPollTimer) clearTimeout(offerSignalPollTimer);
    if (!offerSignalUuid || !target || !target.offerId) return;
    fetch('/api/swap-signal-status?uuid=' + encodeURIComponent(offerSignalUuid) + '&offerId=' + encodeURIComponent(target.offerId))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'sent'){
          closeXamanTabAndFocus(signalXamanTab);
          offerSignalUuid = null;
          if (data.txHash){
            el.offerSignalTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
            el.offerSignalTxLink.style.display = '';
          } else {
            el.offerSignalTxLink.removeAttribute('href');
            el.offerSignalTxLink.style.display = 'none';
          }
          el.offerSignalPrompt.style.display = 'none';
          el.offerSignalSentConfirm.style.display = '';
          return;
        }
        // rejected/expired/failed — never marked as sent (see swap-signal-
        // status.js's own comment); re-enable SEND S!GNAL/SK!P so the user
        // can retry or back out, same as every other Xaman flow's own
        // failure handling on this site.
        if (data.status === 'rejected' || data.status === 'expired' || data.status === 'failed'){
          closeXamanTabAndFocus(signalXamanTab);
          offerSignalUuid = null;
          el.offerSignalSkipBtn.disabled = false;
          el.offerSignalSendBtn.disabled = false;
          el.offerSignalSendBtn.innerHTML = 'SEND S!GNAL';
          el.offerSignalStatus.textContent = data.status === 'rejected' ? 'S!GNATURE REJECTED !N XAMAN.'
            : data.status === 'expired' ? 'S!GN REQUEST EXP!RED. TRY AGA!N.'
            : 'TRANSACT!0N FA!LED 0N-LEDGER.';
          return;
        }
        offerSignalPollTimer = setTimeout(function(){ pollOfferSignalStatus(target, signalXamanTab); }, 2000);
      }).catch(function(){
        offerSignalPollTimer = setTimeout(function(){ pollOfferSignalStatus(target, signalXamanTab); }, 3000);
      });
  }
  el.offerSignalDoneBtn.addEventListener('click', function(){
    if (offerSignalPollTimer) clearTimeout(offerSignalPollTimer);
    offerSignalUuid = null;
    closeOfferConfirmModal();
    if (isOwnWalletScope()) runScopedQuery();
  });

  // ---- TRANSFER — give one of your own Pigeons directly to another
  // wallet, no payment involved. Reuses the exact same real backend as
  // the (currently paused) NFT-for-NFT swap builder's own single-leg
  // offer (swap-offer-prepare/-payload/-status: a free, Amount "0"
  // NFTokenCreateOffer restricted to Destination) — nftId + toWallet
  // only, no wantNftId/swapId, so nothing gets written into the swap-
  // offer-pairs index this creates. Entered via the shared amount-entry
  // popup's TRANSFER mode (see openAmountEntryModal), same confirm-
  // screen-before-signing pattern as 0FFER/DELIST/ACCEPT 0FFER. The
  // recipient still has to separately accept the real offer this
  // creates (from their own wallet app) before the Pigeon actually
  // moves — nothing here is atomic or reversible-by-us once accepted.
  var transferTarget = null; // { nftId, number, image, toWallet }
  var transferUuid = null;
  var transferPollTimer = null;
  var transferXamanTab = null;
  var XRPL_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

  function submitTransfer(p, toWallet, formEl){
    if (!toWallet || !XRPL_ADDRESS_RE.test(toWallet)){
      alert('ENTER A VAL!D XRPL WALLET ADDRESS (STARTS W!TH r).');
      return;
    }
    if (MY_WALLET && toWallet === MY_WALLET){
      alert('CAN N0T TRANSFER T0 Y0UR 0WN WALLET.');
      return;
    }
    // No native confirm() dialog here any more — the real popup this
    // leads to (showTransferConfirm) already shows exactly this same
    // info (destination wallet, which Pigeon) before Xaman ever opens,
    // making a second "are you sure" redundant.
    var sendBtn = el.amountEntryTransferBtn;
    var statusEl = el.amountEntryTransferStatus;
    sendBtn.disabled = true;
    sendBtn.textContent = 'VAL!DAT!NG...';
    if (statusEl){ statusEl.style.display = 'none'; statusEl.textContent = ''; }
    fetch('/api/swap-offer-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: p.nftId, toWallet: toWallet })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      sendBtn.disabled = false;
      sendBtn.textContent = 'TRANSFER';
      if (!res.ok || !res.data.ok){
        if (statusEl){ statusEl.style.display = ''; statusEl.textContent = listingErrorMessage(res.data && res.data.error); }
        else alert(listingErrorMessage(res.data && res.data.error));
        return;
      }
      transferTarget = p;
      transferTarget.toWallet = toWallet;
      showTransferConfirm(res.data.txjson);
    }).catch(function(){
      sendBtn.disabled = false;
      sendBtn.textContent = 'TRANSFER';
      if (statusEl){ statusEl.style.display = ''; statusEl.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.'; }
    });
  }

  // Resting-state markup for transferOpenXamanBtn — same as 0FFER's own
  // OFFER_CONFIRM_BTN_HTML, restored via innerHTML (needs the Σκύλλα
  // span) at every point this button resets after an attempt.
  var TRANSFER_CONFIRM_BTN_HTML = 'C0NF!RM W!TH <span style="text-transform:none;">Σκύλλα</span>';
  function showTransferConfirm(txjson){
    // TRANSFER only ever starts from the amount-entry popup — close it
    // the instant this second popup takes over (#transferConfirmModal,
    // same real-popup-not-a-page-navigation treatment as 0FFER's own
    // confirm screen).
    closeAmountEntryModal();
    // No raw tx-type badge/NFTokenID hex here — just the three things
    // that actually matter at a glance: whose wallet, which Pigeon,
    // where it's going. The real txjson (still exactly what gets signed,
    // re-derived server-side in swap-offer-payload.js, never trusted
    // from the client) doesn't need to be spelled out on screen for that
    // to be true.
    el.transferConfAccount.textContent = txjson.Account;
    el.transferConfPigeonNum.innerHTML = collectionItemLabel() + ' #' +(transferTarget.number !== null ? greenNum(transferTarget.number) : '????');
    el.transferConfDestination.textContent = txjson.Destination;
    el.transferConfirmStatus.textContent = '';
    el.transferOpenXamanBtn.disabled = false;
    el.transferOpenXamanBtn.innerHTML = TRANSFER_CONFIRM_BTN_HTML;
    el.transferConfirmModal.style.display = 'flex';
  }
  function closeTransferConfirmModal(){
    el.transferConfirmModal.style.display = 'none';
    transferTarget = null;
  }
  el.transferConfirmBackBtn.addEventListener('click', closeTransferConfirmModal);
  el.transferConfirmModal.addEventListener('click', function(e){ if (e.target === el.transferConfirmModal) closeTransferConfirmModal(); });

  el.transferOpenXamanBtn.addEventListener('click', function(){
    if (!transferTarget) return;
    el.transferOpenXamanBtn.disabled = true;
    el.transferOpenXamanBtn.textContent = 'REQUEST!NG...';
    el.transferConfirmStatus.textContent = '';
    transferXamanTab = openXamanPopup();
    fetch('/api/swap-offer-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: transferTarget.nftId, toWallet: transferTarget.toWallet })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        closeXamanTabAndFocus(transferXamanTab);
        transferXamanTab = null;
        el.transferOpenXamanBtn.disabled = false;
        el.transferOpenXamanBtn.innerHTML = TRANSFER_CONFIRM_BTN_HTML;
        el.transferConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      transferUuid = res.data.uuid;
      navigateXamanPopup(transferXamanTab, res.data.next.always);
      el.transferOpenXamanBtn.textContent = 'WA!T!NG F0R S!GNATURE...';
      el.transferConfirmStatus.innerHTML = 'S!GN !N W!TH <span style="text-transform:none;">Σκύλλα</span>, THEN RETURN HERE.<br><a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>';
      pollTransferStatus();
    }).catch(function(){
      closeXamanTabAndFocus(transferXamanTab);
      transferXamanTab = null;
      el.transferOpenXamanBtn.disabled = false;
      el.transferOpenXamanBtn.innerHTML = TRANSFER_CONFIRM_BTN_HTML;
      el.transferConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });

  function pollTransferStatus(){
    if (transferPollTimer) clearTimeout(transferPollTimer);
    if (!transferUuid || !transferTarget) return;
    fetch('/api/swap-offer-status?uuid=' + encodeURIComponent(transferUuid) + '&nftId=' + encodeURIComponent(transferTarget.nftId) + '&toWallet=' + encodeURIComponent(transferTarget.toWallet))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'offer_created'){
          closeXamanTabAndFocus(transferXamanTab);
          transferXamanTab = null;
          showTransferResult(data);
          return;
        }
        if (data.status === 'rejected'){
          el.transferConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.transferOpenXamanBtn.disabled = false;
          el.transferOpenXamanBtn.innerHTML = TRANSFER_CONFIRM_BTN_HTML;
          return;
        }
        if (data.status === 'expired'){
          el.transferConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.transferOpenXamanBtn.disabled = false;
          el.transferOpenXamanBtn.innerHTML = TRANSFER_CONFIRM_BTN_HTML;
          return;
        }
        if (data.status === 'failed'){
          el.transferConfirmStatus.textContent = 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.transferOpenXamanBtn.disabled = false;
          el.transferOpenXamanBtn.innerHTML = TRANSFER_CONFIRM_BTN_HTML;
          return;
        }
        transferPollTimer = setTimeout(pollTransferStatus, 2000);
      }).catch(function(){
        transferPollTimer = setTimeout(pollTransferStatus, 3000);
      });
  }

  function showTransferResult(data){
    // Popup closes the instant the real full-screen result takes over —
    // transferTarget itself stays set (not closeTransferConfirmModal,
    // which also clears it) since this still needs .number/.toWallet
    // below.
    el.transferConfirmModal.style.display = 'none';
    el.transferResultPigeonNum.innerHTML = collectionItemLabel() + ' #' +(transferTarget.number !== null ? greenNum(transferTarget.number) : '????');
    el.transferResultDestination.textContent = transferTarget.toWallet;
    if (data.txHash){
      el.transferResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.transferResultTxLink.textContent = data.txHash;
    } else {
      el.transferResultTxLink.removeAttribute('href');
      el.transferResultTxLink.textContent = '—';
    }
    showScreen('transferresult');
  }
  el.transferResultDoneBtn.addEventListener('click', function(){
    transferTarget = null;
    transferUuid = null;
    if (transferPollTimer) clearTimeout(transferPollTimer);
    state.activeTab = 'mypigeons';
    showScreen('browse');
  });

  // ---- OFFERS RECEIVED (owner side) — every real $PIGEONS buy-offer
  // sitting on a Pigeon this wallet currently owns, with a real
  // NFTokenAcceptOffer to settle one. ----
  var offersReceivedData = null;
  var offersReceivedTotal = 0; // mirrors the sum of offersReceivedData's own offers.length — read by updateFlockTabLabel
  var acceptOfferTarget = null; // { nftId, offerId, number, image, price, buyer }
  var acceptOfferUuid = null;
  var acceptOfferPollTimer = null;
  var acceptOfferXamanTab = null;

  // Offers received now render directly on each pigeon's own card (see
  // myPigeonOffersHtml + the accept-offer-btn branch in el.myPigeonsList's
  // click listener) — this just fetches the data, builds offersByNftId for
  // sortedMyPigeons/myPigeonCardHtml, and updates offersReceivedTotal —
  // read by updateFlockTabLabel, which is now the only place a pending-
  // offer count shows (the "N0 0FFERS"/"0FFERS RECE!VED (N)" summary line
  // that used to sit above the grid is gone, redundant with that).
  // In-flight request, while there is one — see myOwnPigeonsCachePromise's
  // own comment, exact same problem, just for offers received. Every
  // entry into MY PIGEONS called this at least twice at once
  // (browseOwnerCollection called it directly AND, via its own
  // showTab('mypigeons') call, a second time from showTab's own
  // tab==='mypigeons' branch) — two overlapping live requests, each with
  // its own real timing variance, landing out of order and each
  // triggering its own re-render. Reported live as offers "coming up,
  // then going away, then coming up again" — that flicker was two (or
  // more) different snapshots of the same live data racing to be the
  // one shown last, not a single reliable answer arriving once.
  var offersReceivedPromise = null;
  function loadOffersReceived(){
    if (!MY_WALLET) return; // the endpoint requires a real session anyway
    if (offersReceivedPromise) return offersReceivedPromise;
    offersReceivedPromise = fetch('/api/swap-offers-received?collection=' + encodeURIComponent(state.collection)).then(function(r){ return r.json(); }).then(function(data){
      offersReceivedData = data.items || [];
      offersByNftId = {};
      var totalOffers = 0;
      offersReceivedData.forEach(function(item){
        offersByNftId[item.nftId] = item.offers;
        totalOffers += item.offers.length;
      });
      offersReceivedTotal = totalOffers;
      updateFlockTabLabel();
      renderMyPigeonsList();
      // The Σκύλλα tab's own 0FFERS box — a real count next to it now
      // instead of a plain unlabelled "0FFERS" (reported live as wanting
      // this), hidden entirely rather than showing "0FFERS :: 0" when
      // there's genuinely nothing pending.
      el.flockOffersCount.textContent = totalOffers || '';
      el.flockOffersCount.style.display = totalOffers > 0 ? '' : 'none';
      // Also refresh the DATABASE grid when SH0W MY P!GE0NS is what's
      // showing (ownedPigeonActionHtml reads offersByNftId there too), and
      // the dedicated 0FFERS RECE!VED view if that's what's open.
      if (isOwnWalletScope()) runScopedQuery();
      if (el.myOffersPanelWrap.style.display !== 'none') renderMyOffersList();
      offersReceivedPromise = null;
    }).catch(function(){
      offersReceivedPromise = null;
    });
    return offersReceivedPromise;
  }

  // ---- 0UTG0!NG 0FFERS — every real $PIGEONS buy-offer THIS wallet has
  // made on someone ELSE's Pigeon, with a real CANCEL. Reported live as
  // important to get right specifically so cancelling actually works —
  // sits directly underneath 0FFERS RECE!VED (see myOffersPanelWrap's own
  // markup comment), same row layout, loaded/rendered the same way. ----
  var outgoingOffersData = null;
  var cancelOfferTarget = null; // { nftId, offerId, number, image, price }
  var cancelOfferUuid = null;
  var cancelOfferPollTimer = null;
  var cancelOfferXamanTab = null;
  // Same in-flight-promise guard as loadOffersReceived's own — this has
  // the identical multiple-call-sites shape (the tab-open branch AND the
  // post-cancel refresh) that made offers received flicker before that
  // fix, so this starts with the guard already in place instead of
  // needing the same bug reported twice.
  var outgoingOffersPromise = null;
  function loadOutgoingOffers(){
    if (!MY_WALLET) return;
    if (outgoingOffersPromise) return outgoingOffersPromise;
    outgoingOffersPromise = fetch('/api/swap-offers-made?collection=' + encodeURIComponent(state.collection)).then(function(r){ return r.json(); }).then(function(data){
      outgoingOffersData = data.items || [];
      if (el.myOffersPanelWrap.style.display !== 'none') renderOutgoingOffersList();
      outgoingOffersPromise = null;
    }).catch(function(){
      outgoingOffersPromise = null;
    });
    return outgoingOffersPromise;
  }
  function renderOutgoingOffersList(){
    if (outgoingOffersData === null){
      el.outgoingOffersList.innerHTML = '<div class="th-empty">L0AD!NG...</div>';
      return;
    }
    // An offer on YOUR OWN Pigeon shows here too, same as any other
    // outgoing offer — no separate "own offer" section any more (reported
    // live as not needing one); swap-offers-made.js already returns every
    // offer this wallet made regardless of target ownership.
    if (!outgoingOffersData.length){
      el.outgoingOffersList.innerHTML = '<div class="th-empty">N0 0UTG0!NG 0FFERS R!GHT N0W.</div>';
      return;
    }
    el.outgoingOffersList.innerHTML = outgoingOffersData.map(function(item){
      var img = item.image ? '<img src="' + escapeHtml(item.image) + '" alt="" loading="lazy">' : 'IMAGE';
      var countdown = listingCountdownText(item.expiration);
      return '<div class="my-offer-row">' +
        '<div class="my-offer-row-left">' +
          '<div class="pigeon-img-box my-offer-row-img" data-nftid="' + escapeHtml(item.nftId) + '">' + img + '</div>' +
          '<div class="my-offer-row-info">' +
            '<div class="my-offer-row-num">P!GE0N #' + (item.number !== null ? greenNum(item.number) : '????') + '</div>' +
            '<div class="my-offer-row-buyer">T0 ' + walletTagHtml(item.ownerWallet, item.ownerShort) + (countdown ? ' :: ' + escapeHtml(countdown) : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="my-offer-row-price">' + escapeHtml(fmtPigeonsCompact(item.price)) + '</div>' +
        '<div class="my-offer-row-actions">' +
          '<button class="highest-offer-btn cancel-my-offer-btn cancel-outgoing-offer-btn" data-nftid="' + escapeHtml(item.nftId) + '" data-offerid="' + escapeHtml(item.offerId) + '" data-num="' + (item.number !== null ? item.number : '') + '" data-image="' + escapeHtml(item.image || '') + '" data-price="' + escapeHtml(item.price) + '">CANCEL</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  el.outgoingOffersList.addEventListener('click', function(e){
    var btn = e.target.closest('.cancel-outgoing-offer-btn');
    if (!btn || btn.disabled) return;
    cancelOfferTarget = {
      nftId: btn.getAttribute('data-nftid'),
      offerId: btn.getAttribute('data-offerid'),
      number: btn.getAttribute('data-num') !== '' ? Number(btn.getAttribute('data-num')) : null,
      image: btn.getAttribute('data-image'),
      price: btn.getAttribute('data-price')
    };
    startCancelOfferSign(btn);
  });
  // Straight into the real Xaman request on click, same "no separate
  // review screen" reasoning as MAKE OFFER's own submitMakeOffer — CANCEL
  // is already the confirming action, an outgoing buy-offer isn't a
  // reversible listing decision the way DELIST's own confirm screen guards
  // against fat-fingering (DELIST also removes something priced/visible to
  // buyers; a CANCEL here just withdraws an offer you made).
  function startCancelOfferSign(btn){
    if (!cancelOfferTarget) return;
    btn.disabled = true;
    btn.textContent = 'REQUEST!NG...';
    // Opened synchronously in this click handler (a real user gesture) so
    // it's never popup-blocked — same pattern every other Xaman sign flow
    // in this app already uses.
    cancelOfferXamanTab = openXamanPopup();
    fetch('/api/swap-canceloffer-prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: cancelOfferTarget.nftId, collection: state.collection })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        closeXamanTabAndFocus(cancelOfferXamanTab);
        cancelOfferXamanTab = null;
        btn.disabled = false;
        btn.textContent = 'CANCEL';
        alert(listingErrorMessage(res.data && res.data.error));
        return;
      }
      return fetch('/api/swap-canceloffer-payload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nftId: cancelOfferTarget.nftId, collection: state.collection })
      }).then(function(r2){ return r2.json().then(function(data2){ return { ok: r2.ok, data: data2 }; }); })
      .then(function(res2){
        if (!res2.ok || !res2.data.ok){
          closeXamanTabAndFocus(cancelOfferXamanTab);
          cancelOfferXamanTab = null;
          btn.disabled = false;
          btn.textContent = 'CANCEL';
          alert(listingErrorMessage(res2.data && res2.data.error));
          return;
        }
        cancelOfferUuid = res2.data.uuid;
        navigateXamanPopup(cancelOfferXamanTab, res2.data.next.always);
        btn.textContent = 'WA!T!NG...';
        pollCancelOfferStatus(btn);
      });
    }).catch(function(){
      closeXamanTabAndFocus(cancelOfferXamanTab);
      cancelOfferXamanTab = null;
      btn.disabled = false;
      btn.textContent = 'CANCEL';
      alert('ERR://S!GNAL_L0ST — TRY AGA!N.');
    });
  }
  function pollCancelOfferStatus(btn){
    if (cancelOfferPollTimer) clearTimeout(cancelOfferPollTimer);
    if (!cancelOfferUuid || !cancelOfferTarget) return;
    fetch('/api/swap-canceloffer-status?uuid=' + encodeURIComponent(cancelOfferUuid) + '&nftId=' + encodeURIComponent(cancelOfferTarget.nftId) + '&collection=' + encodeURIComponent(state.collection))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'cancelled'){
          closeXamanTabAndFocus(cancelOfferXamanTab);
          cancelOfferXamanTab = null;
          // Drop it from the list immediately rather than waiting on a
          // full reload — same "the response you just got is the real
          // answer" reasoning as DELIST's own success handling.
          outgoingOffersData = (outgoingOffersData || []).filter(function(it){ return it.nftId !== cancelOfferTarget.nftId; });
          renderOutgoingOffersList();
          // Also keeps offersReceivedData in sync (a self-placed offer on
          // your own Pigeon shows up there too) and refreshes whichever
          // views could be showing it — same reasoning as DECL!NE's own
          // refresh above.
          if (offersReceivedData){
            offersReceivedData.forEach(function(it){
              if (it.nftId === cancelOfferTarget.nftId){
                it.offers = it.offers.filter(function(o){ return o.offerId !== cancelOfferTarget.offerId; });
              }
            });
          }
          if (el.myOffersPanelWrap.style.display !== 'none') renderMyOffersList();
          if (isOwnWalletScope()) runScopedQuery();
          if (el.screenDetail.style.display !== 'none') updateScyllaListing(state.currentDetail);
          cancelOfferTarget = null;
          return;
        }
        if (data.status === 'rejected'){
          btn.textContent = 'CANCEL';
          btn.disabled = false;
          alert('CANCELLAT!0N REJECTED !N XAMAN.');
          return;
        }
        if (data.status === 'expired'){
          btn.textContent = 'CANCEL';
          btn.disabled = false;
          alert('S!GN REQUEST EXP!RED. TRY AGA!N.');
          return;
        }
        if (data.status === 'failed'){
          btn.textContent = 'CANCEL';
          btn.disabled = false;
          alert('XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').');
          return;
        }
        cancelOfferPollTimer = setTimeout(function(){ pollCancelOfferStatus(btn); }, 2000);
      }).catch(function(){
        cancelOfferPollTimer = setTimeout(function(){ pollCancelOfferStatus(btn); }, 3000);
      });
  }

  // ---- NFT 0FFERED T0 Y0U (FL0CK) — real TRANSFER sell-offers sent to
  // this wallet. See swap-incoming-transfers.js's own comment for why this
  // needs its own tracked KV index instead of just looking at what the
  // wallet owns (the Pigeon shown here isn't owned by this wallet yet). ----
  var incomingTransfersData = [];
  var acceptTransferTarget = null; // { nftId, offerId, number, image, fromWallet, fromWalletShort }
  var acceptTransferUuid = null;
  var acceptTransferPollTimer = null;
  var acceptTransferXamanTab = null;

  // Same shape as loadOffersReceived's own in-flight guard, same reason —
  // this has the identical three call sites (the eager page-load call,
  // browseOwnerCollection's own direct call, and showTab's
  // tab==='mypigeons' branch) that made offers received flicker.
  var incomingTransfersPromise = null;
  function loadIncomingTransfers(){
    if (!MY_WALLET){ el.incomingTransfersBox.style.display = 'none'; return; }
    if (incomingTransfersPromise) return incomingTransfersPromise;
    incomingTransfersPromise = fetch('/api/swap-incoming-transfers').then(function(r){ return r.json(); }).then(function(data){
      incomingTransfersData = data.items || [];
      renderIncomingTransfers();
      incomingTransfersPromise = null;
    }).catch(function(){
      incomingTransfersPromise = null;
    });
    return incomingTransfersPromise;
  }
  function renderIncomingTransfers(){
    if (!incomingTransfersData.length){
      el.incomingTransfersBox.style.display = 'none';
      return;
    }
    el.incomingTransfersBox.style.display = '';
    el.incomingTransfersList.innerHTML = incomingTransfersData.map(function(t){
      return '<div class="incoming-transfer-row">' +
        (t.image ? '<img class="incoming-transfer-thumb" src="' + escapeHtml(t.image) + '" alt="" loading="lazy">' : '<div class="incoming-transfer-thumb"></div>') +
        '<div class="incoming-transfer-info">' +
          '<div class="incoming-transfer-num">P!GE0N #' + (t.number !== null ? greenNum(t.number) : '????') + '</div>' +
          '<div class="incoming-transfer-from">FR0M :: ' + escapeHtml(t.fromWalletShort || t.fromWallet) + '</div>' +
        '</div>' +
        '<button class="action-btn incoming-transfer-accept-btn" data-nftid="' + escapeHtml(t.nftId) + '" data-offerid="' + escapeHtml(t.offerId) + '">ACCEPT</button>' +
      '</div>';
    }).join('');
  }
  el.incomingTransfersList.addEventListener('click', function(e){
    var btn = e.target.closest('.incoming-transfer-accept-btn');
    if (!btn) return;
    var nftId = btn.getAttribute('data-nftid');
    var entry = incomingTransfersData.find(function(t){ return t.nftId === nftId; });
    if (!entry) return;
    openAcceptTransferConfirm(entry);
  });
  function openAcceptTransferConfirm(entry){
    acceptTransferTarget = entry;
    el.acceptTransferConfPigeonNum.innerHTML = collectionItemLabel() + ' #' +(entry.number !== null ? greenNum(entry.number) : '????');
    el.acceptTransferConfFrom.textContent = entry.fromWallet;
    el.acceptTransferConfirmStatus.textContent = '';
    el.acceptTransferOpenXamanBtn.disabled = false;
    el.acceptTransferOpenXamanBtn.innerHTML = 'C0NF!RM W!TH <span style="text-transform:none;">Σκύλλα</span>';
    el.acceptTransferConfirmForm.style.display = '';
    el.acceptTransferConfirmReceipt.style.display = 'none';
    el.acceptTransferConfirmModal.style.display = 'flex';
  }
  function closeAcceptTransferConfirm(){
    el.acceptTransferConfirmModal.style.display = 'none';
    acceptTransferTarget = null;
    acceptTransferUuid = null;
    if (acceptTransferPollTimer) clearTimeout(acceptTransferPollTimer);
  }
  el.acceptTransferConfirmModal.addEventListener('click', function(e){ if (e.target === el.acceptTransferConfirmModal) closeAcceptTransferConfirm(); });
  el.acceptTransferConfirmBackBtn.addEventListener('click', closeAcceptTransferConfirm);
  el.acceptTransferOpenXamanBtn.addEventListener('click', submitAcceptTransfer);
  function submitAcceptTransfer(){
    if (!acceptTransferTarget) return;
    el.acceptTransferOpenXamanBtn.disabled = true;
    el.acceptTransferOpenXamanBtn.textContent = 'REQUEST!NG...';
    el.acceptTransferConfirmStatus.textContent = '';
    acceptTransferXamanTab = openXamanPopup();
    fetch('/api/swap-transfer-accept-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: acceptTransferTarget.nftId, offerId: acceptTransferTarget.offerId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        closeXamanTabAndFocus(acceptTransferXamanTab);
        acceptTransferXamanTab = null;
        el.acceptTransferOpenXamanBtn.disabled = false;
        el.acceptTransferOpenXamanBtn.textContent = 'C0NF!RM W!TH Σκύλλα';
        el.acceptTransferConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      acceptTransferUuid = res.data.uuid;
      navigateXamanPopup(acceptTransferXamanTab, res.data.next.always);
      el.acceptTransferOpenXamanBtn.textContent = 'WA!T!NG F0R S!GNATURE...';
      el.acceptTransferConfirmStatus.innerHTML = 'S!GN !N W!TH <span style="text-transform:none;">Σκύλλα</span>, THEN RETURN HERE.<br><a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>';
      pollAcceptTransferStatus();
    }).catch(function(){
      closeXamanTabAndFocus(acceptTransferXamanTab);
      acceptTransferXamanTab = null;
      el.acceptTransferOpenXamanBtn.disabled = false;
      el.acceptTransferOpenXamanBtn.textContent = 'C0NF!RM W!TH Σκύλλα';
      el.acceptTransferConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  }
  function pollAcceptTransferStatus(){
    if (acceptTransferPollTimer) clearTimeout(acceptTransferPollTimer);
    if (!acceptTransferUuid || !acceptTransferTarget) return;
    fetch('/api/swap-transfer-accept-status?uuid=' + encodeURIComponent(acceptTransferUuid) + '&nftId=' + encodeURIComponent(acceptTransferTarget.nftId) + '&offerId=' + encodeURIComponent(acceptTransferTarget.offerId))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'settled'){
          closeXamanTabAndFocus(acceptTransferXamanTab);
          acceptTransferXamanTab = null;
          showAcceptTransferResult();
          return;
        }
        if (data.status === 'rejected'){
          el.acceptTransferConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          el.acceptTransferOpenXamanBtn.disabled = false;
          el.acceptTransferOpenXamanBtn.textContent = 'C0NF!RM W!TH Σκύλλα';
          return;
        }
        if (data.status === 'expired'){
          el.acceptTransferConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          el.acceptTransferOpenXamanBtn.disabled = false;
          el.acceptTransferOpenXamanBtn.textContent = 'C0NF!RM W!TH Σκύλλα';
          return;
        }
        if (data.status === 'failed'){
          el.acceptTransferConfirmStatus.textContent = 'TRANSACT!0N FA!LED 0N-LEDGER.';
          el.acceptTransferOpenXamanBtn.disabled = false;
          el.acceptTransferOpenXamanBtn.textContent = 'C0NF!RM W!TH Σκύλλα';
          return;
        }
        acceptTransferPollTimer = setTimeout(pollAcceptTransferStatus, 2000);
      }).catch(function(){
        acceptTransferPollTimer = setTimeout(pollAcceptTransferStatus, 2000);
      });
  }
  // Swaps the popup to its static receipt sub-state in place — this flow
  // lives entirely inside FL0CK, not the DATABASE grid's showScreen chain,
  // so there's no separate result screen to navigate to.
  function showAcceptTransferResult(){
    var num = acceptTransferTarget && acceptTransferTarget.number !== null ? greenNum(acceptTransferTarget.number) : '????';
    el.acceptTransferReceiptPigeonNum.innerHTML = collectionItemLabel() + ' #' +num;
    el.acceptTransferConfirmForm.style.display = 'none';
    el.acceptTransferConfirmReceipt.style.display = '';
  }
  el.acceptTransferResultDoneBtn.addEventListener('click', function(){
    closeAcceptTransferConfirm();
    loadIncomingTransfers();
    loadOffersReceived();
    loadOutgoingOffers();
    renderMyPigeonsList();
    if (isOwnWalletScope()) runScopedQuery();
  });

  // A real popup now (#acceptOfferConfirmModal), not a showScreen
  // navigation away from the grid — reported live as wanting "a pop up
  // instead of a new screen", same treatment BUY N0W's own modal already
  // got. Just closes and clears the target; whatever page was showing
  // underneath stays showing, same as closeBuyConfirmModal's own
  // reasoning.
  function closeAcceptOfferConfirmModal(){
    acceptOfferTarget = null;
    el.acceptOfferConfirmModal.style.display = 'none';
  }
  el.acceptOfferConfirmBackBtn.addEventListener('click', closeAcceptOfferConfirmModal);
  el.acceptOfferConfirmModal.addEventListener('click', function(e){ if (e.target === el.acceptOfferConfirmModal) closeAcceptOfferConfirmModal(); });

  // No confirm-first click any more — ACCEPT opens Xaman immediately
  // (reported live as not wanting a confirmation step, same change already
  // made for CANCEL/DELIST — see openDelistConfirm's own comment). The
  // PIGEON/BUYER/0FFER/FEE/R0YALTY/RECE!VE fields still populate, just a
  // moment later once swap-acceptoffer-payload.js's own response lands
  // (it now returns the same display breakdown the old prepare-first
  // screen used to show up front) instead of gating Xaman behind them.
  function openAcceptOfferConfirm(){
    // Real pigeon thumbnail now, not text-only — reported live as wanting
    // to actually see which Pigeon this is, same .amount-entry-pigeon-
    // thumb treatment the L!ST/0FFER/TRANSFER popup already shows.
    el.acceptOfferConfThumb.style.display = acceptOfferTarget.image ? '' : 'none';
    el.acceptOfferConfThumb.src = acceptOfferTarget.image || '';
    el.acceptOfferConfPigeon.innerHTML = collectionItemLabel() + ' ' +(acceptOfferTarget.number !== null ? '#' + greenNum(acceptOfferTarget.number) : '#????');
    setWalletText(el.acceptOfferConfBuyer, acceptOfferTarget.buyer, shortAddr(acceptOfferTarget.buyer));
    el.acceptOfferConfPrice.textContent = acceptOfferTarget.price ? fmtPigeons(acceptOfferTarget.price) : '';
    el.acceptOfferConfFee.textContent = '';
    el.acceptOfferConfRoyaltyRow.style.display = 'none';
    el.acceptOfferConfSellerAmount.textContent = '';
    el.acceptOfferConfirmStatus.textContent = 'REQUEST!NG...';
    setWaitingPulse(el.acceptOfferConfirmStatus, true);
    el.screenAcceptOfferResult.style.display = 'none';
    el.screenAcceptOfferConfirm.style.display = '';
    el.acceptOfferConfirmModal.style.display = 'flex';
    // Opened here, synchronously inside the real click — see
    // navigateXamanPopup's own comment; the window.open(realUrl, ...) call
    // below used to happen from inside the async fetch().then() instead,
    // which mobile browsers in particular treat as no longer a trusted
    // user gesture and silently refuse.
    acceptOfferXamanTab = openXamanPopup();
    fetch('/api/swap-acceptoffer-payload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nftId: acceptOfferTarget.nftId, offerId: acceptOfferTarget.offerId, collection: state.collection })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (!res.ok || !res.data.ok){
        closeXamanTabAndFocus(acceptOfferXamanTab);
        acceptOfferXamanTab = null;
        setWaitingPulse(el.acceptOfferConfirmStatus, false);
        el.acceptOfferConfirmStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      acceptOfferUuid = res.data.uuid;
      navigateXamanPopup(acceptOfferXamanTab, res.data.next.always);
      if (res.data.display){
        setWalletText(el.acceptOfferConfBuyer, res.data.display.buyer, shortAddr(res.data.display.buyer));
        el.acceptOfferConfPrice.textContent = fmtPigeons(res.data.display.totalValue);
        el.acceptOfferConfFee.textContent = fmtPigeons(res.data.display.feeValue);
        showRoyaltyRow(el.acceptOfferConfRoyaltyRow, el.acceptOfferConfRoyaltyLabel, el.acceptOfferConfRoyalty, res.data.display.royaltyValue, res.data.display.royaltyPercent);
        el.acceptOfferConfSellerAmount.textContent = fmtPigeons(res.data.display.sellerValue);
      }
      el.acceptOfferConfirmStatus.innerHTML = 'S!GN !N W!TH <span style="text-transform:none;">Σκύλλα</span>, THEN RETURN HERE.<br><a href="' + escapeHtml(res.data.next.always) + '" target="_blank" rel="noopener" class="xaman-manual-link"><span style="text-transform:none;">Σκύλλα</span> D!DN T 0PEN? TAP HERE.</a>';
      pollAcceptOfferStatus();
    }).catch(function(){
      closeXamanTabAndFocus(acceptOfferXamanTab);
      acceptOfferXamanTab = null;
      setWaitingPulse(el.acceptOfferConfirmStatus, false);
      el.acceptOfferConfirmStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  }

  function pollAcceptOfferStatus(){
    if (acceptOfferPollTimer) clearTimeout(acceptOfferPollTimer);
    if (!acceptOfferUuid || !acceptOfferTarget) return;
    fetch('/api/swap-acceptoffer-status?uuid=' + encodeURIComponent(acceptOfferUuid) + '&nftId=' + encodeURIComponent(acceptOfferTarget.nftId) + '&offerId=' + encodeURIComponent(acceptOfferTarget.offerId) + '&collection=' + encodeURIComponent(state.collection))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.status === 'settled'){
          closeXamanTabAndFocus(acceptOfferXamanTab);
          acceptOfferXamanTab = null;
          showAcceptOfferResult(data);
          return;
        }
        // No button to reset any more (see openAcceptOfferConfirm — ACCEPT
        // opens Xaman immediately now, no separate confirm step) — just
        // leave the reason showing; BACK (still available) closes this,
        // and clicking ACCEPT again on the grid starts a fresh attempt.
        if (data.status === 'rejected'){
          setWaitingPulse(el.acceptOfferConfirmStatus, false);
          el.acceptOfferConfirmStatus.textContent = 'S!GNATURE REJECTED !N XAMAN.';
          return;
        }
        if (data.status === 'expired'){
          setWaitingPulse(el.acceptOfferConfirmStatus, false);
          el.acceptOfferConfirmStatus.textContent = 'S!GN REQUEST EXP!RED. TRY AGA!N.';
          return;
        }
        if (data.status === 'failed' || data.status === 'buy_offer_gone' || data.status === 'offer_amount_mismatch'){
          setWaitingPulse(el.acceptOfferConfirmStatus, false);
          var reason = data.status === 'buy_offer_gone' ? 'BUYER\\'S 0FFER N0 L0NGER EX!STS (CANCELLED 0R ALREADY ACCEPTED).'
            : data.status === 'offer_amount_mismatch' ? 'OFFER AM0UNT CHANGED — TRY AGA!N.'
            : 'XRPL REJECTED THE TRANSACT!0N (' + (data.result || 'UNKN0WN') + ').';
          el.acceptOfferConfirmStatus.textContent = reason;
          return;
        }
        // 'signed_pending_ledger' (seller's sell offer not yet visible) and
        // 'brokering_in_progress' (sell offer confirmed, broker wallet is
        // now building/submitting the actual brokered accept) both just
        // keep polling with a status line that reflects which stage this
        // actually is, instead of a generic "waiting".
        if (data.status === 'brokering_in_progress'){
          el.acceptOfferConfirmStatus.textContent = 'SELL 0FFER C0NF!RMED — SETTL!NG BR0KERED SALE...';
        } else if (data.status === 'signed_pending_ledger'){
          el.acceptOfferConfirmStatus.textContent = 'S!GNED — WA!T!NG F0R LEDGER C0NF!RMAT!0N...';
        }
        acceptOfferPollTimer = setTimeout(pollAcceptOfferStatus, 2000);
      }).catch(function(){
        acceptOfferPollTimer = setTimeout(pollAcceptOfferStatus, 3000);
      });
  }

  function showAcceptOfferResult(data){
    el.acceptOfferResultThumb.style.display = acceptOfferTarget.image ? '' : 'none';
    el.acceptOfferResultThumb.src = acceptOfferTarget.image || '';
    el.acceptOfferResultPigeonNum.innerHTML = collectionItemLabel() + ' ' +(acceptOfferTarget.number !== null ? '#' + greenNum(acceptOfferTarget.number) : '#????');
    el.acceptOfferResultPrice.textContent = fmtPigeons(data.totalValue !== undefined ? data.totalValue : acceptOfferTarget.price);
    el.acceptOfferResultFee.textContent = data.feeValue !== undefined ? fmtPigeons(data.feeValue) : '—';
    showRoyaltyRow(el.acceptOfferResultRoyaltyRow, el.acceptOfferResultRoyaltyLabel, el.acceptOfferResultRoyalty, data.royaltyValue, data.royaltyPercent);
    el.acceptOfferResultSellerAmount.textContent = data.sellerValue !== undefined ? fmtPigeons(data.sellerValue) : '—';
    el.acceptOfferResultStatus.textContent = 'SETTLED';
    if (data.txHash){
      el.acceptOfferResultTxLink.href = 'https://bithomp.com/explorer/' + data.txHash;
      el.acceptOfferResultTxLink.textContent = shortHash(data.txHash);
    } else {
      el.acceptOfferResultTxLink.removeAttribute('href');
      el.acceptOfferResultTxLink.textContent = '—';
    }
    el.screenAcceptOfferConfirm.style.display = 'none';
    el.screenAcceptOfferResult.style.display = '';
  }
  el.acceptOfferResultDoneBtn.addEventListener('click', function(){
    acceptOfferUuid = null;
    if (acceptOfferPollTimer) clearTimeout(acceptOfferPollTimer);
    closeAcceptOfferConfirmModal();
    loadOffersReceived();
    loadOutgoingOffers();
    renderMyPigeonsList();
    if (isOwnWalletScope()) runScopedQuery();
  });

  // ---- DATABASE selector — multi-collection groundwork; only PIGEONS is
  // live, FUZZY/PHNIX are inert placeholders. Click-to-open now (not
  // hover) since it lives inline inside the DATABASE tab button itself —
  // clicking the collection name opens the picker; clicking anywhere
  // else on the button still does the normal DATABASE tab switch. Every
  // handler here stops propagation so picking/opening/closing the
  // dropdown never also fires that tab switch. ----
  function openDbSelectFlyout(){
    // position:fixed (see its own CSS comment for why) has no CSS-only way
    // to anchor to the trigger — computed fresh every open from its real
    // on-screen position instead, same as any other JS-positioned overlay.
    var rect = el.dbSelectWrap.getBoundingClientRect();
    var flyoutW = el.dbSelectFlyout.getBoundingClientRect().width || 220;
    // Clamp so the flyout can never be anchored past the right edge of a
    // narrow (phone-width) viewport — confirmed live on a 375px screen the
    // unclamped left (== trigger's own left, ~123px) plus the flyout's
    // width pushed its right edge to ~460px, off-screen with no way to
    // reach FUZZY/PHN!X/TEDDY below the fold of the viewport itself.
    var left = Math.min(rect.left, window.innerWidth - flyoutW - 8);
    el.dbSelectFlyout.style.top = rect.bottom + 'px';
    el.dbSelectFlyout.style.left = Math.max(8, left) + 'px';
    el.dbSelectFlyout.style.display = 'block';
    el.dbSelectWrap.classList.add('open');
  }
  function closeDbSelectFlyout(){
    el.dbSelectFlyout.style.display = 'none';
    el.dbSelectWrap.classList.remove('open');
  }
  el.dbSelectLabel.addEventListener('click', function(e){
    e.stopPropagation();
    if (el.dbSelectFlyout.style.display === 'block') closeDbSelectFlyout();
    else openDbSelectFlyout();
  });
  // COLLECTION SELECTION — real for P!GE0NS/PHN!X/TEDDY now (FUZZY stays
  // .db-option-disabled, no shopSlug for it yet). Browse only for the two
  // new ones: no BUY N0W/0FFER/trustline/login, matching the explicit
  // scope this shipped with — see COLLECTION_META's own tradeable flag,
  // which everything else in this function keys off. COLLECTION_META
  // itself now lives up near state (see its own comment there) — it has
  // to exist before loadTrustlineLoginState's bootstrap call further up
  // the file can safely read it for a signed-in wallet.
  // Real per-collection artwork for the trustline banner's big thumbnail —
  // fetched once per collection (first item off the real DATABASE, rarest-
  // first) and cached, rather than a second hardcoded image URL living
  // alongside COLLECTION_META that'd need updating by hand for every new
  // collection. null while not yet fetched/unavailable — the CSS gradient
  // alone still reads fine as a placeholder.
  var collectionThumbCache = {};
  function updateTrustlineThumb(collectionKey){
    if (collectionThumbCache[collectionKey]){
      el.pigeonsBarThumb.style.backgroundImage = 'linear-gradient(160deg, rgba(var(--collection-accent-rgb),0.35), rgba(var(--collection-accent-2-rgb),0.45)), url("' + collectionThumbCache[collectionKey] + '")';
      return;
    }
    apiWithRetry({ collection: collectionKey, skip: 0, limit: 1, sort: 'RARITY_ASC' }, 0).then(function(data){
      var img = data && data.items && data.items[0] && data.items[0].image;
      if (!img) return;
      collectionThumbCache[collectionKey] = img;
      if (state.collection === collectionKey){
        el.pigeonsBarThumb.style.backgroundImage = 'linear-gradient(160deg, rgba(var(--collection-accent-rgb),0.35), rgba(var(--collection-accent-2-rgb),0.45)), url("' + img + '")';
      }
    }).catch(function(){});
  }
  // Everything in the trustline banner that isn't already driven by
  // fmtPigeons/collectionItemLabel — title text, issuer address + COPY,
  // thumbnail, BUY button label, and the EXCHANGE CALCULAT0R's visibility.
  // Called on every switchCollection so "phnix should be everywhere" stays
  // true no matter which collection you're on, and adding a future
  // collection only ever means one more COLLECTION_META entry.
  function updateTrustlineBannerChrome(collectionKey){
    var meta = COLLECTION_META[collectionKey];
    el.trustlineTitleLabel.textContent = 'SET ' + meta.tokenLabel + ' TRUSTL!NE';
    el.pigeonsBarThumb.title = meta.tokenLabel;
    if (meta.tokenIssuer){
      el.ciIssuerAddr.setAttribute('data-full', meta.tokenIssuer);
      el.ciIssuerAddr.textContent = meta.tokenIssuer.slice(0, 5) + '...' + meta.tokenIssuer.slice(-3);
    } else {
      el.ciIssuerAddr.setAttribute('data-full', '');
      el.ciIssuerAddr.textContent = 'N/A';
    }
    el.pigeonsBalanceBuyBtn.textContent = 'BUY ' + meta.tokenLabel;
    el.salesCurrencyPigeonsBtn.textContent = meta.tokenLabel;
    el.statScyllaListedLabel.textContent = meta.tokenLabel + ' FL00R';
    updateTrustlineThumb(collectionKey);
    // AMM-backed BUY-with-XRP + EXCHANGE CALCULAT0R only exist for
    // collections with real pool/DEX data (see COLLECTION_META's own
    // comment) — hidden outright for everything else instead of showing a
    // calculator quoting the wrong token.
    if (!meta.hasAmm){
      el.pigeonsBarCalc.style.display = 'none';
      el.pigeonsDexLink.style.display = 'none';
      el.pigeonsCalcModal.style.display = 'none';
    } else {
      refreshTrustlineRate();
    }
  }
  // Card headers ("P!GE0N #1921") were hardcoded to say P!GE0N regardless
  // of collection — harmless-looking but wrong once PHN!X/TEDDY actually
  // load real items.
  function collectionItemLabel(){
    return COLLECTION_META[state.collection].itemLabel;
  }
  function switchCollection(newCollection){
    closeDbSelectFlyout();
    var meta = COLLECTION_META[newCollection];
    if (!meta || newCollection === state.collection) return;
    state.collection = newCollection;
    el.dbSelectLabel.textContent = meta.label + ' ▾';
    el.dbSelectFlyout.querySelectorAll('.db-option[data-collection]').forEach(function(opt){
      opt.classList.toggle('db-option-active', opt.getAttribute('data-collection') === newCollection);
    });
    // Theme colours (--collection-accent, the trustline banner's own real
    // per-collection colour) swap via this class — see the :root override
    // block in the CSS. Cleared first so switching PHN!X -> TEDDY (or
    // either -> P!GE0NS) never leaves the wrong one applied. Gated on
    // !== 'pigeons' (P!GE0NS uses the plain :root purple, no class needed)
    // — used to be gated on !meta.tradeable instead, which happened to be
    // equivalent back when PHN!X was still browse-only, but silently broke
    // once PHN!X flipped to tradeable: meta.tradeable became true, so this
    // class never got added and the trustline banner stayed purple instead
    // of PHN!X's own real orange/red (#ff5a1f) — confirmed live.
    document.body.classList.remove('collection-phnixs', 'collection-teddybg');
    if (newCollection !== 'pigeons') document.body.classList.add('collection-' + newCollection);
    document.body.classList.toggle('collection-browse-only', !meta.tradeable);
    // FL00R (real Scylla listings sorted by real price) only makes sense
    // as the DEFAULT landing view for P!GE0NS specifically — it has an
    // established market with real listings to actually show. A newly
    // tradeable collection (PHN!X today, more later) starts with zero real
    // listings, so defaulting to "0NLY SH0W L!STED" the same way showed a
    // completely empty grid — reported live as "the collection has
    // completely gone" when it hadn't, the default filter was just too
    // narrow for a market with nothing listed yet. Every OTHER tradeable
    // collection defaults to plain rarity browse instead (BUY N0W/0FFER
    // still work per-card regardless) — the L!STED stat tile is still
    // right there to opt into once it actually has real listings.
    state.sort = (meta.tradeable && newCollection === 'pigeons') ? 'SCYLLA_PRICE_ASC' : 'RARITY_ASC';
    state.scyllaListedOnly = meta.tradeable && newCollection === 'pigeons';
    el.statScyllaListedTile.classList.toggle('scylla-active', state.scyllaListedOnly);
    updateSortLabelsForCollection();
    updateTrustlineBannerChrome(newCollection);
    if (MY_WALLET){
      // myOwnPigeonsCache is a single flat cache, not keyed by collection —
      // without clearing it here, switching collection while logged in
      // would keep showing the PREVIOUS collection's held-NFT list/count
      // (SH0W MY NFTs, FL0CK tab) since loadMyOwnPigeonsCache's own
      // promise-cache guard would just hand back the stale result instead
      // of re-fetching scoped to the new collection.
      myOwnPigeonsCache = null;
      myOwnPigeonsCacheFailed = false;
      myOwnPigeonsCachePromise = null;
      loadTrustlineLoginState();
    }
    state.edition = 'ALL';
    state.traitFilters = [];
    state.traitCategories = null;
    state.traitValuesCache = {};
    state.scope = null;
    renderTraitRows();
    renderSortTag();
    updateSearchPanelTitleForPaws();
    state.statsLoaded = false;
    loadCollectionStats();
    ensureTraitsLoaded();
    runQuery();
  }
  // MA!NFRAME — landing page shown before DATABASE (see #screenMainframe
  // in the HTML). Picking a card either switches collection (PHN!X/TEDDY)
  // or, for P!GE0NS (already the default), just proceeds straight in —
  // switchCollection's own no-op guard for "already this collection"
  // means enterMainframeCollection has to drive showTab itself either way.
  function hideMainframe(){
    el.screenMainframe.style.display = 'none';
  }
  function enterMainframeCollection(key){
    if (key !== state.collection){
      // switchCollection's own end-of-function calls (ensureTraitsLoaded +
      // runQuery) already do the first real fetch for the new collection —
      // setting databaseLoaded here just stops showTab's OWN first-open
      // bootstrap from firing a redundant second one right behind it.
      switchCollection(key);
      state.databaseLoaded = true;
    } else if (!state.databaseLoaded){
      // Picking the collection ALREADY active (P!GE0NS, the default) never
      // calls switchCollection at all (its own no-op guard for "already
      // this collection") — setting databaseLoaded unconditionally used to
      // skip BOTH that call's bootstrap AND showTab's own fallback one,
      // so the very first MAINFRAME -> P!GE0NS entry never fetched
      // anything: state.seenNftIds (only ever set inside
      // startCollectionBrowse) stayed undefined, and the scroll-triggered
      // infinite-load observer crashed the instant it fired, leaving
      // DATABASE stuck on SIGNAL_LOST — confirmed live as exactly the
      // "everything's crashed" report. Doing the real bootstrap here
      // instead of just flipping the flag is the fix.
      state.databaseLoaded = true;
      ensureTraitsLoaded();
      runQuery();
    }
    hideMainframe();
    showTab('database');
  }
  // Drag-to-scroll (mouse) — trackpad/touch already scroll #mainframeGrid
  // natively via its own overflow-x:auto, this is just the desktop-mouse
  // equivalent ("drag and scroll through", reported live). Tracks total
  // movement so a genuine drag (past mainframeDragThreshold) suppresses
  // the click that would otherwise fire on mouseup and open whatever
  // card the cursor happened to land on — a real drag is a navigation
  // gesture, not a pick.
  var mainframeDragThreshold = 6;
  var mainframeDragState = null; // { startX, startScrollLeft, moved }
  el.mainframeGrid.addEventListener('mousedown', function(e){
    mainframeDragState = { startX: e.pageX, startScrollLeft: el.mainframeGrid.scrollLeft, moved: false };
    el.mainframeGrid.classList.add('dragging');
  });
  window.addEventListener('mousemove', function(e){
    if (!mainframeDragState) return;
    var dx = e.pageX - mainframeDragState.startX;
    if (Math.abs(dx) > mainframeDragThreshold) mainframeDragState.moved = true;
    if (mainframeDragState.moved){
      e.preventDefault();
      el.mainframeGrid.scrollLeft = mainframeDragState.startScrollLeft - dx;
    }
  });
  window.addEventListener('mouseup', function(){
    if (mainframeDragState) el.mainframeGrid.classList.remove('dragging');
    // Left set (not cleared) until the next click's own capture-phase
    // check below reads it — clearing here would race the click event
    // that's about to fire from this same mouseup.
  });
  // Capture phase, ahead of the plain click handler below — stops a
  // just-finished drag's own mouseup-triggered click from reaching it at
  // all, rather than trying to distinguish "drag" from "pick" inside that
  // handler itself.
  el.mainframeGrid.addEventListener('click', function(e){
    if (mainframeDragState && mainframeDragState.moved){
      // stopImmediatePropagation, not just stopPropagation — this and the
      // real pick/buy handler right below are two SEPARATE listeners on
      // this SAME element, and plain stopPropagation only ever stops an
      // event moving to the NEXT node in the DOM, not sibling listeners
      // already registered on the node it's currently at.
      e.stopImmediatePropagation();
      e.preventDefault();
    }
    mainframeDragState = null;
  }, true);
  el.mainframeGrid.addEventListener('click', function(e){
    var buyBtn = e.target.closest('.mainframe-card-buy');
    if (buyBtn){
      e.stopPropagation();
      openBuySwapPanel(buyBtn.getAttribute('data-collection'));
      return;
    }
    var card = e.target.closest('.mainframe-card[data-collection]');
    if (card) enterMainframeCollection(card.getAttribute('data-collection'));
  });
  // Keyboard equivalent for the card itself (role="button"/tabindex, see
  // the HTML's own comment on why this can't be a real <button> any
  // more) — Enter/Space activate it the same way a real button would.
  el.mainframeGrid.addEventListener('keydown', function(e){
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest('.mainframe-card[data-collection]');
    if (!card) return;
    e.preventDefault();
    enterMainframeCollection(card.getAttribute('data-collection'));
  });
  // PREV/NEXT — THREE card-widths (+ gaps) per click, same distance
  // regardless of which card happens to be first, so this always lands
  // exactly on a card's own scroll-snap point three cards over.
  function mainframeCardStep(){
    var card = el.mainframeGrid.querySelector('.mainframe-card');
    if (!card) return 960;
    var gap = parseFloat(getComputedStyle(el.mainframeGrid).columnGap) || 0;
    return (card.getBoundingClientRect().width + gap) * 3;
  }
  el.mainframeArrowPrev.addEventListener('click', function(){
    el.mainframeGrid.scrollBy({ left: -mainframeCardStep(), behavior: 'smooth' });
  });
  el.mainframeArrowNext.addEventListener('click', function(){
    el.mainframeGrid.scrollBy({ left: mainframeCardStep(), behavior: 'smooth' });
  });
  el.mainframeReopenLabel.addEventListener('click', function(){
    el.screenMainframe.style.display = 'flex';
  });
  // Logged in already -> straight to PR0F!LE (the real multi-coin balance
  // view). Not logged in -> the same auto-login FL0CK already triggers
  // from topTabs' own click handler; PR0F!LE itself has no interactive
  // CONNECT flow of its own (its "not logged in" state is just static
  // text), so this reuses that existing real flow rather than building a
  // second one — MY C0!NS/username/pfp are all one click away on FL0CK's
  // own PR0F!LE box once signed in.
  el.mainframeProfileBtn.addEventListener('click', function(){
    hideMainframe();
    if (!MY_WALLET){
      showTab('mypigeons', true);
      startAuthorize();
    } else {
      showTab('profile');
    }
  });
  // Real, live numbers on every TRAD!NG L!VE card (see .mainframe-card-stats'
  // own comment in the CSS) — same three fields, same order, on every
  // tradeable collection, so the bottom-of-card line reads identically
  // everywhere instead of only ever existing on P!GE0NS. C0M!NG S00N cards
  // have nothing live to show (no real trading data behind them yet).
  // Fires once, at load, regardless of whether MAINFRAME is the visible
  // screen right now — cheap, and means the numbers are already there the
  // instant you land back on it (STAT!C :: MA!NFRAME, top-left).
  [
    { collection: 'pigeons', target: 'mainframeStatsPigeons' },
    { collection: 'phnixs', target: 'mainframeStatsPhnixs' }
  ].forEach(function(cfg){
    api({ stats: 1, collection: cfg.collection }).then(function(data){
      if (data.items == null && data.holders == null && data.totalVolumeXrp == null) return;
      var parts = [];
      if (data.items != null) parts.push('<span class="hi">' + data.items.toLocaleString() + '</span> !TEMS');
      if (data.holders != null) parts.push('<span class="hi">' + data.holders.toLocaleString() + '</span> H0LDERS');
      if (data.totalVolumeXrp != null) parts.push('<span class="hi">' + Math.round(data.totalVolumeXrp).toLocaleString() + '</span> XRP V0L');
      el[cfg.target].innerHTML = parts.join(' :: ');
    }).catch(function(){});
  });
  el.dbSelectFlyout.addEventListener('click', function(e){
    e.stopPropagation();
    var opt = e.target.closest('.db-option[data-collection]');
    if (opt) switchCollection(opt.getAttribute('data-collection'));
    else closeDbSelectFlyout();
  });


  // Copy-to-clipboard, not a real TrustSet flow — this prototype doesn't
  // connect a wallet or sign anything yet (same pattern already used for
  // the CRWN trustline address elsewhere on the site).
  el.copyIssuerBtn.addEventListener('click', function(){
    // The visible address is shortened for display — always copy the
    // real one from data-full, never the shortened text.
    var addr = el.ciIssuerAddr ? el.ciIssuerAddr.getAttribute('data-full') : '';
    var done = function(){
      // Swap just the label, not the whole button — el.ciIssuerAddr is a
      // real child element (registered separately), and overwriting the
      // button's own textContent would silently destroy that node.
      el.copyIssuerLabel.textContent = 'C0P!ED';
      setTimeout(function(){ el.copyIssuerLabel.textContent = 'C0PY'; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(addr).then(done, done);
    else done();
  });

  // XRP <-> $PIGEONS EXCHANGE CALCULAT0R, driven by fetchPigeonsXrpRate
  // (DexScreener's real trade-derived price, same number dexscreener.com's
  // own UI shows, falling back to the XRPL order book's best live offer
  // only if DexScreener is unreachable). Re-fetched on the same 60s
  // cadence as the server's own KV cache TTL (PIGEONS_RATE_CACHE_TTL_SECONDS
  // in _shared.js) so a tab left open never keeps showing a stale rate.
  // The rate readout is now just the raw per-1-$PIGEON XRP price (e.g.
  // "0.00024"), inline on the title row next to the DEXSCREENER link —
  // not a spelled-out "1 XRP = N $PIGEONS" sentence any more.
  var trustlineXrpPerPigeon = null;
  function refreshTrustlineRate(){
    api({ pigeonsRate: 1 }).then(function(data){
      trustlineXrpPerPigeon = (data && typeof data.xrpPerPigeon === 'number') ? data.xrpPerPigeon : null;
      if (trustlineXrpPerPigeon !== null){
        el.pigeonsBarRateValue.textContent = trustlineXrpPerPigeon.toLocaleString(undefined, { maximumFractionDigits: 6 }) + ' XRP';
        el.pigeonsBarRateValue.style.display = '';
        el.pigeonsBarCalc.style.display = '';
        // Re-derive whichever side the rate refresh shouldn't silently
        // overwrite what's mid-typing — XRP wins ties (matches its
        // longstanding role as the "primary" side), unless only the
        // $P!GE0NS side actually has something in it.
        if (el.pigeonsCalcPigeonsInput.value.trim() && !el.pigeonsCalcXrpInput.value.trim()){
          updateXrpCalcFromPigeons();
        } else {
          updatePigeonsCalcFromXrp();
        }
      }
      if (data && data.dexUrl){
        el.pigeonsDexLink.href = data.dexUrl;
        el.pigeonsCalcDexBtn.href = data.dexUrl;
      }
      el.pigeonsDexLink.style.display = '';
    }).catch(function(){});
  }
  refreshTrustlineRate();
  setInterval(refreshTrustlineRate, 60000);
  // Grows an input to fit what's typed (ch units against the monospace
  // font) instead of staying a fixed width — since the whole calc box is
  // centered in its flex:1 slot (see .pigeons-bar-calc-col), this reads as
  // growing outward from the center in both directions, not anchored left.
  function resizeCalcInput(inputEl, baseCh){
    var len = inputEl.value.length;
    inputEl.style.width = Math.max(baseCh, len + 2) + 'ch';
  }
  // Hard cap on the XRP side — matches whatever's actually reasonable to
  // type into a quick calculator, and doubles as the ceiling every
  // computed (pigeons -> XRP) result gets clamped to as well, so the box
  // never shows something bigger than you could've typed directly.
  var CALC_MAX_XRP = 100000;
  // Past this many $PIGEONS, the box shows a rounded-down "Nk" instead of
  // the full digit string (234596 -> "234k") — same threshold a k-shorthand
  // entry naturally lands on too, see formatPigeonsCalcValue below.
  var CALC_PIGEONS_COMPACT_THRESHOLD = 100000;
  // $PIGEONS side accepts k/m shorthand, each handled differently:
  // trailing k/K expands to the full comma-grouped number ("123k" ->
  // "123,000") exactly like formatThousandsInput elsewhere on this page;
  // trailing m/M stays typed as-is ("123m" never expands — spelling out
  // a nine-digit number doesn't make a $PIGEONS amount easier to read).
  // Whatever the box currently shows, this pulls out the real underlying
  // number for the XRP conversion — including re-parsing a "Nk" the box
  // itself put there via the compacting rule below.
  function parsePigeonsCalcValue(raw){
    var s = raw.trim();
    var shorthand = s.match(/^([0-9]*\.?[0-9]+)[kKmM]$/);
    if (shorthand){
      var mult = /[mM]$/.test(s) ? 1000000 : 1000;
      return parseFloat(shorthand[1]) * mult;
    }
    return Number(s.replace(/,/g, ''));
  }
  // Reformats the $PIGEONS box in place: k always expands, m always stays
  // put, and any plain number past CALC_PIGEONS_COMPACT_THRESHOLD collapses
  // to a rounded-down "Nk" instead of a long digit string. A k-shorthand
  // entry that itself expands past the threshold (e.g. "123k" -> 123,000)
  // immediately re-collapses to the same "123k" it started as — stable,
  // not a back-and-forth toggle — since floor(123000 / 1000) is exactly 123.
  function formatPigeonsCalcValue(raw){
    var s = raw.trim();
    var mMatch = s.match(/^([0-9]*\.?[0-9]+)[mM]$/);
    if (mMatch) return mMatch[1] + 'm';
    var kMatch = s.match(/^([0-9]*\.?[0-9]+)[kK]$/);
    var value = kMatch ? parseFloat(kMatch[1]) * 1000 : Number(s.replace(/,/g, ''));
    if (!isFinite(value)) value = 0;
    if (value > CALC_PIGEONS_COMPACT_THRESHOLD) return Math.floor(value / 1000) + 'k';
    // A k-shorthand entry under the threshold expands to the real
    // multiplied number ("5k" -> "5,000"), not the raw typed text.
    if (kMatch) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    // Plain typed digits — comma-group the raw string in place (not a
    // round-trip through Number/toLocaleString) so an in-progress decimal
    // like "123." isn't mangled mid-type.
    var cleaned = s.replace(/[^0-9.]/g, '');
    var firstDot = cleaned.indexOf('.');
    if (firstDot !== -1) cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
    var parts = cleaned.split('.');
    var intPart = parts[0].replace(/^0+(?=\d)/, '');
    intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.length > 1 ? intPart + '.' + parts[1] : intPart;
  }
  // Two-way: typing XRP fills in $P!GE0NS, typing $P!GE0NS fills in XRP.
  // Setting .value programmatically (as both functions below do to the
  // OTHER field) never fires that field's own 'input' listener, so there's
  // no risk of these two calling each other back and forth — no sync flag
  // needed.
  // Kept as a plain, fixed title always — was rewriting itself into a
  // live "____ XRP <> ___ $PIGEONS" summary once both sides had a value,
  // which read as the button breaking/glitching once you actually typed
  // in it rather than a useful summary.
  function updateCalcToggleLabel(){
    el.pigeonsCalcToggleLabel.textContent = 'EXCHANGE CALCULAT0R';
  }
  function updatePigeonsCalcFromXrp(){
    var xrpValue = Number(el.pigeonsCalcXrpInput.value.replace(/,/g, ''));
    if (isFinite(xrpValue) && xrpValue > CALC_MAX_XRP){
      xrpValue = CALC_MAX_XRP;
      el.pigeonsCalcXrpInput.value = CALC_MAX_XRP.toLocaleString();
    }
    resizeCalcInput(el.pigeonsCalcXrpInput, 10);
    if (trustlineXrpPerPigeon === null || !el.pigeonsCalcXrpInput.value.trim() || !isFinite(xrpValue) || xrpValue <= 0){
      el.pigeonsCalcPigeonsInput.value = '';
      resizeCalcInput(el.pigeonsCalcPigeonsInput, 14);
      updateCalcToggleLabel();
      return;
    }
    var pigeonsOut = xrpValue / trustlineXrpPerPigeon;
    el.pigeonsCalcPigeonsInput.value = pigeonsOut > CALC_PIGEONS_COMPACT_THRESHOLD
      ? Math.floor(pigeonsOut / 1000) + 'k'
      : pigeonsOut.toLocaleString(undefined, { maximumFractionDigits: 2 });
    resizeCalcInput(el.pigeonsCalcPigeonsInput, 14);
    updateCalcToggleLabel();
  }
  function updateXrpCalcFromPigeons(){
    el.pigeonsCalcPigeonsInput.value = formatPigeonsCalcValue(el.pigeonsCalcPigeonsInput.value);
    resizeCalcInput(el.pigeonsCalcPigeonsInput, 14);
    var pigeonsValue = parsePigeonsCalcValue(el.pigeonsCalcPigeonsInput.value);
    if (trustlineXrpPerPigeon === null || !el.pigeonsCalcPigeonsInput.value.trim() || !isFinite(pigeonsValue) || pigeonsValue <= 0){
      el.pigeonsCalcXrpInput.value = '';
      resizeCalcInput(el.pigeonsCalcXrpInput, 10);
      updateCalcToggleLabel();
      return;
    }
    var xrpOut = Math.min(CALC_MAX_XRP, pigeonsValue * trustlineXrpPerPigeon);
    el.pigeonsCalcXrpInput.value = xrpOut.toLocaleString(undefined, { maximumFractionDigits: 2 });
    resizeCalcInput(el.pigeonsCalcXrpInput, 10);
    updateCalcToggleLabel();
  }
  el.pigeonsCalcXrpInput.addEventListener('input', updatePigeonsCalcFromXrp);
  el.pigeonsCalcPigeonsInput.addEventListener('input', updateXrpCalcFromPigeons);
  function openCalcPopover(){
    el.pigeonsCalcModal.style.display = 'flex';
    el.pigeonsCalcToggleBtn.classList.add('open');
  }
  function closeCalcPopover(){
    el.pigeonsCalcModal.style.display = 'none';
    el.pigeonsCalcToggleBtn.classList.remove('open');
  }
  el.pigeonsCalcToggleBtn.addEventListener('click', function(e){
    e.stopPropagation();
    openCalcPopover();
  });
  el.pigeonsCalcCloseBtn.addEventListener('click', closeCalcPopover);
  // Click the dark overlay itself (not the panel) to close — same pattern
  // as #offerConfirmModal/#buySwapModal's own overlay click handlers.
  el.pigeonsCalcModal.addEventListener('click', function(e){
    if (e.target === el.pigeonsCalcModal) closeCalcPopover();
  });
  // Real link, destination doesn't exist yet — same "coming soon"
  // pattern as the BURNT link, honest about what's actually built.
  el.onboardLink.addEventListener('click', function(){
    alert('0NB0ARD!NG SECT!0N C0M!NG S00N.');
  });

  // ---- Sales history (real, collection-wide, infinite scroll) ----
  // "How long ago" instead of a plain date/time stamp — reported live as
  // wanting it in hours under a day, then days once it's past 24 hours,
  // then weeks once it's past 13 days (the coarser unit only kicking in
  // once the finer one would otherwise show an unwieldy number).
  function relativeTimeText(dateStr){
    var ms = Date.now() - new Date(dateStr).getTime();
    if (!isFinite(ms) || ms < 0) ms = 0;
    var hours = Math.floor(ms / 3600000);
    if (hours < 1) return 'JUST N0W';
    if (hours < 24) return hours + ' H0UR' + (hours === 1 ? '' : 'S') + ' AG0';
    var days = Math.floor(hours / 24);
    if (days <= 13) return days + ' DAY' + (days === 1 ? '' : 'S') + ' AG0';
    var weeks = Math.floor(days / 7);
    return weeks + ' WEEK' + (weeks === 1 ? '' : 'S') + ' AG0';
  }
  function saleRowHtml(s){
    var thumb = s.image ? '<img src="' + escapeHtml(s.image) + '" alt="" loading="lazy">' : '';
    var num = s.number !== null ? '#' + greenNum(s.number) : '#????';
    // s.currency is 'XRP' for a Deeptide-feed sale, or the active
    // collection's real token currency (e.g. 'PHNIX') for one of Σκύλλα's
    // own — never the literal string 'PIGEONS' any more now that the
    // backend reports each collection's real currency (see pigeons.js's
    // own tokenCurrency), so this checks !== 'XRP' rather than === a
    // collection-specific value that would silently stop matching on
    // anything but $PIGEONS.
    var price = s.currency !== 'XRP'
      ? (s.pigeonsPrice !== null && s.pigeonsPrice !== undefined ? s.pigeonsPrice.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + COLLECTION_META[state.collection].tokenLabel : '?')
      : (s.priceXrp !== null ? s.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP' : '?');
    var via = s.via === 'scylla' ? 'Σ SWAP' : (s.via === 'xrpcafe' ? 'XRP.CAFE' : (s.via === 'deeptide' ? 'DEEPT!DE' : ''));
    var when = s.createdAt ? relativeTimeText(s.createdAt) : '';
    return '<div class="sale-row" data-nftid="' + escapeHtml(s.nftId) + '">' +
      '<div class="sale-thumb-wrap">' +
        '<div class="sale-thumb" data-nftid="' + escapeHtml(s.nftId) + '">' + thumb + '</div>' +
        '<div class="sale-num-box" data-nftid="' + escapeHtml(s.nftId) + '">P!GE0N ' + num + '</div>' +
      '</div>' +
      '<div class="sale-price-cell">' +
        '<div class="sale-price">' + price + '</div>' +
        (via ? '<div class="sale-via">' + via + '</div>' : '') +
      '</div>' +
      '<div class="sale-parties">' +
        (s.seller ? '<a data-wallet="' + escapeHtml(s.seller) + '" data-short="' + escapeHtml(s.sellerShort || s.seller) + '">' + walletTagHtml(s.seller, s.sellerShort) + '</a>' : '?') +
        ' → ' +
        (s.buyer ? '<a data-wallet="' + escapeHtml(s.buyer) + '" data-short="' + escapeHtml(s.buyerShort || s.buyer) + '">' + walletTagHtml(s.buyer, s.buyerShort) + '</a>' : '?') +
      '</div>' +
      '<div class="sale-time">' + escapeHtml(when) + '</div>' +
    '</div>';
  }
  function loadMoreSales(){
    if (state.sales.loading || !state.sales.hasMore) return;
    state.sales.loading = true;
    el.salesLoadMoreNote.style.display = '';
    api({ sales: 1, skip: state.sales.skip, limit: 10, currency: state.sales.currency }).then(function(data){
      state.sales.loading = false;
      el.salesLoadMoreNote.style.display = 'none';
      var items = data.items || [];
      state.sales.skip += items.length;
      state.sales.hasMore = !!data.hasMore && items.length > 0;
      if (items.length) el.salesArea.insertAdjacentHTML('beforeend', items.map(saleRowHtml).join(''));
      else if (state.sales.skip === 0) el.salesArea.innerHTML = '<div class="th-empty">N0 SALES YET.</div>';
      if (!state.sales.hasMore) el.salesEndNote.style.display = '';
    }).catch(function(){
      state.sales.loading = false;
      el.salesLoadMoreNote.style.display = 'none';
    });
  }
  // XRP/$P!GE0NS toggle — each side is its own independent paginated feed
  // (see the currency param branches in pigeons.js), so switching resets
  // the scroll state from scratch rather than trying to filter whatever
  // rows happen to already be loaded.
  el.salesCurrencyToggle.addEventListener('click', function(e){
    var btn = e.target.closest('.sale-currency-btn');
    if (!btn) return;
    var currency = btn.getAttribute('data-currency');
    if (currency === state.sales.currency) return;
    var buttons = el.salesCurrencyToggle.querySelectorAll('.sale-currency-btn');
    for (var i = 0; i < buttons.length; i++){
      buttons[i].classList.toggle('sale-currency-btn-active', buttons[i] === btn);
    }
    state.sales = { skip: 0, hasMore: true, loading: false, opened: false, currency: currency };
    el.salesArea.innerHTML = '';
    el.salesEndNote.style.display = 'none';
    loadMoreSales();
  });
  // The whole row opens the real pigeon detail now, not just the
  // thumbnail/number — reported live as wanting a quick way into "the
  // big detailed version" straight from a sale. A wallet link inside the
  // row still takes priority (browses that wallet instead).
  el.salesArea.addEventListener('click', function(e){
    var walletLink = e.target.closest('.sale-parties a');
    if (walletLink){ browseOwnerCollection(walletLink.getAttribute('data-wallet'), walletLink.getAttribute('data-short')); return; }
    var row = e.target.closest('.sale-row');
    if (row) openDetail(row.getAttribute('data-nftid'));
  });
  // Rooted at the page viewport (root:null), not the scrollbox — the
  // scrollbox no longer scrolls on its own (see .sales-scrollbox's own
  // comment, "doesn't need two scroll bars"), so this now fires on
  // scrolling the whole page instead.
  var salesScrollObserver = new IntersectionObserver(function(entries){
    if (entries[0].isIntersecting) loadMoreSales();
  }, { root: null, rootMargin: '200px' });
  salesScrollObserver.observe(el.salesScrollSentinel);

  el.searchBtn.addEventListener('click', runSearchBox);
  el.searchInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') runSearchBox(); });
  // ---- SORT — same two-level hover flyout as TRAITS: hover a category
  // (Alphabetical / Listings / Sales / Rarity), scroll its value list,
  // click one to sort by it. Single pick, same as the original dropdown —
  // just presented the same way TRAITS is instead of a native <select>.
  var SORT_CATEGORIES = {
    'PR!CE': [
      { value: 'SCYLLA_PRICE_ASC', label: 'L0WEST $P!GE0NS' },
      { value: 'SCYLLA_PRICE_DESC', label: 'H!GHEST $P!GE0NS' },
      { value: 'AVG_SALE_XRP_ASC', label: 'L0WEST AVG SALE PR!CE XRP' },
      { value: 'AVG_SALE_XRP_DESC', label: 'H!GHEST AVG SALE PR!CE XRP' },
      { value: 'AVG_SALE_PIGEONS_ASC', label: 'L0WEST AVG SALE PR!CE $P!GE0NS' },
      { value: 'PRICE_ASC', label: 'L0WEST (XRP)' }
    ],
    'RAR!TY': [
      { value: 'RARITY_ASC', label: 'H!GHEST' },
      { value: 'RARITY_DESC', label: 'L0WEST' }
    ],
    'ALPHABET!CAL': [
      { value: 'NAME_ASC', label: 'A-Z' },
      { value: 'NAME_DESC', label: 'Z-A' }
    ],
    'H!ST0R!CAL SALES': [
      { value: 'HIGHEST_SALE', label: 'H!GHEST REC0RDED SALES' }
    ]
  };
  // The 3 PR!CE labels that name the token directly ("L0WEST $P!GE0NS"
  // etc.) are mutated in place here rather than built as a function each
  // render — sortLabelOf/renderSortFlyoutList both just read o.label
  // straight off SORT_CATEGORIES already, so patching the 3 strings once
  // per switchCollection is enough for both to pick up the right token
  // with no other changes.
  function updateSortLabelsForCollection(){
    var tokenLabel = COLLECTION_META[state.collection].tokenLabel;
    SORT_CATEGORIES['PR!CE'].forEach(function(o){
      if (o.value === 'SCYLLA_PRICE_ASC') o.label = 'L0WEST ' + tokenLabel;
      else if (o.value === 'SCYLLA_PRICE_DESC') o.label = 'H!GHEST ' + tokenLabel;
      else if (o.value === 'AVG_SALE_PIGEONS_ASC') o.label = 'L0WEST AVG SALE PR!CE ' + tokenLabel;
    });
  }
  function sortCategoryOf(value){
    for (var cat in SORT_CATEGORIES){
      if (SORT_CATEGORIES[cat].some(function(o){ return o.value === value; })) return cat;
    }
    return null;
  }
  function sortLabelOf(value){
    var cat = sortCategoryOf(value);
    if (!cat) return value;
    var found = SORT_CATEGORIES[cat].filter(function(o){ return o.value === value; })[0];
    // Same "CATEG0RY :: VALUE" shape as an applied trait tag, since this
    // is now shown as one (see renderSortTag).
    return cat + ' :: ' + (found ? found.label : value);
  }
  // Single-key comparator for one sort value — used for the client-side
  // wallet-scope sort (whole list already in memory). Every enabled
  // SORT_CATEGORIES option has one; returns null for anything else.
  function sortComparatorFor(value){
    if (value === 'RARITY_ASC' || value === 'RARITY_DESC'){
      return function(a, b){
        var ar = a.rarityRank === null || a.rarityRank === undefined ? Infinity : a.rarityRank;
        var br = b.rarityRank === null || b.rarityRank === undefined ? Infinity : b.rarityRank;
        return value === 'RARITY_DESC' ? br - ar : ar - br;
      };
    }
    if (value === 'NAME_ASC' || value === 'NAME_DESC'){
      return function(a, b){ return value === 'NAME_DESC' ? (b.number || 0) - (a.number || 0) : (a.number || 0) - (b.number || 0); };
    }
    if (value === 'HIGHEST_SALE' || value === 'SALES_LOW'){
      return function(a, b){
        var av = a.highSaleXrp === null || a.highSaleXrp === undefined ? -1 : a.highSaleXrp;
        var bv = b.highSaleXrp === null || b.highSaleXrp === undefined ? -1 : b.highSaleXrp;
        return value === 'SALES_LOW' ? av - bv : bv - av;
      };
    }
    if (value === 'AVG_SALE_XRP_ASC' || value === 'AVG_SALE_XRP_DESC'){
      return function(a, b){
        var av = a.avgSaleXrp === null || a.avgSaleXrp === undefined ? Infinity : a.avgSaleXrp;
        var bv = b.avgSaleXrp === null || b.avgSaleXrp === undefined ? Infinity : b.avgSaleXrp;
        return value === 'AVG_SALE_XRP_DESC' ? bv - av : av - bv;
      };
    }
    if (value === 'AVG_SALE_PIGEONS_ASC'){
      return function(a, b){
        var av = !a.avgSalePigeons ? Infinity : a.avgSalePigeons;
        var bv = !b.avgSalePigeons ? Infinity : b.avgSalePigeons;
        return av - bv;
      };
    }
    if (value === 'PRICE_ASC' || value === 'PRICE_DESC'){
      return function(a, b){
        var ap = a.priceXrp === null || a.priceXrp === undefined ? Infinity : a.priceXrp;
        var bp = b.priceXrp === null || b.priceXrp === undefined ? Infinity : b.priceXrp;
        return value === 'PRICE_DESC' ? bp - ap : ap - bp;
      };
    }
    if (value === 'SCYLLA_PRICE_ASC' || value === 'SCYLLA_PRICE_DESC'){
      return function(a, b){
        var ap = a.scyllaListing && a.scyllaListing.price !== null && a.scyllaListing.price !== undefined ? parseFloat(a.scyllaListing.price) : Infinity;
        var bp = b.scyllaListing && b.scyllaListing.price !== null && b.scyllaListing.price !== undefined ? parseFloat(b.scyllaListing.price) : Infinity;
        return value === 'SCYLLA_PRICE_DESC' ? bp - ap : ap - bp;
      };
    }
    return null;
  }
  // S0RT BY's own label stays static now (see the HTML) — this renders
  // the current pick as a single applied tag underneath it instead,
  // #traitRows' own pattern (trait-row-tag/trait-tag-label), just always
  // exactly one: picking a new sort replaces state.sort outright (see
  // applySort), so there's never a previous tag to remove first.
  function renderSortTag(){
    el.sortRows.innerHTML = '<div class="trait-row trait-row-tag"><span class="trait-tag-label">' + escapeHtml(sortLabelOf(state.sort).toUpperCase()) + '</span></div>';
  }
  // SORT BY used to be a two-level category -> values flyout (same shape
  // as F!LTER BY TRA!TS), but with only 4 categories and ~10 options total
  // that extra navigation step was pure overhead — one flat list of every
  // option (still labelled "CATEG0RY :: VALUE" via sortLabelOf so context
  // isn't lost without the category heading) is simpler to scan and pick
  // from directly. See #sortFlyout's own "flyout-flat" class in the CSS
  // for the single-column layout this renders into.
  function renderSortFlyoutList(){
    // PR!CE (Scylla/$PIGEONS listings + AVG SALE) and H!ST0R!CAL SALES
    // both read from KV maps that are empty for a browse-only collection
    // (see COLLECTION_META) — RAR!TY/ALPHABET!CAL are the only categories
    // that're just a plain Deeptide sort, so those are all that's offered.
    var tradeable = COLLECTION_META[state.collection].tradeable;
    var rows = [];
    var placed = {};
    // L0WEST $P!GE0NS then H!GHEST RAR!TY lead the whole list — reported
    // live as wanting these two specific options first and second, not
    // just each first within its own category further down.
    (tradeable ? ['SCYLLA_PRICE_ASC', 'RARITY_ASC'] : ['RARITY_ASC']).forEach(function(value){
      var cat = sortCategoryOf(value);
      var found = cat && SORT_CATEGORIES[cat].filter(function(o){ return o.value === value; })[0];
      if (!found) return;
      rows.push({ cat: cat, value: found.value, label: found.label, disabled: found.disabled });
      placed[value] = true;
    });
    Object.keys(SORT_CATEGORIES).forEach(function(cat){
      if (!tradeable && cat !== 'RAR!TY' && cat !== 'ALPHABET!CAL') return;
      SORT_CATEGORIES[cat].forEach(function(o){
        if (placed[o.value]) return;
        rows.push({ cat: cat, value: o.value, label: o.label, disabled: o.disabled });
      });
    });
    el.sortFlyoutVals.innerHTML = rows.map(function(o){
      return '<button type="button" class="traits-flyout-val' + (state.sort === o.value ? ' selected' : '') + (o.disabled ? ' tfv-disabled' : '') + '" data-value="' + o.value + '"' + (o.disabled ? ' disabled' : '') + '>' +
        '<span>' + escapeHtml(o.cat + ' :: ' + o.label) + '</span>' +
        (o.disabled ? '<span class="db-soon">C0M!NG S00N</span>' : '') +
      '</button>';
    }).join('');
    updateSortHscrollArrows();
  }
  // Reparented to <body> for the same reason #traitsFlyout is — see that
  // function's own comment on the backdrop-filter containing-block issue.
  function restoreSortFlyout(){
    if (el.sortFlyout.parentElement !== el.sortDropWrap) el.sortDropWrap.appendChild(el.sortFlyout);
  }
  function openSortFlyout(){
    closeTraitsFlyout();
    renderSortFlyoutList();
    document.body.appendChild(el.sortFlyout);
    el.sortFlyout.style.display = 'block';
    el.sortFlyout.classList.add('flyout-popup');
    el.sortDropWrap.classList.add('open');
    showFlyoutBackdrop();
  }
  function closeSortFlyout(){
    el.sortFlyout.style.display = 'none';
    el.sortFlyout.classList.remove('flyout-popup');
    el.sortDropWrap.classList.remove('open');
    el.bottomSortBtn.classList.remove('open');
    restoreSortFlyout();
    if (el.traitsFlyout.style.display !== 'block') hideFlyoutBackdrop();
  }
  function applySort(value){
    state.sort = value;
    renderSortTag();
    // Desktop's strip (#sortFlyoutVals) is always visible, not just
    // shown while the flyout is open — its .selected class only ever got
    // set by openSortFlyout()'s own renderSortFlyoutList() call, so on
    // desktop (where open/close doesn't really apply) picking a new sort
    // left the OLD option still visually highlighted even though the tag
    // above it, and the actual applied sort, had both already changed.
    renderSortFlyoutList();
    var isScyllaSort = value === 'SCYLLA_PRICE_ASC' || value === 'SCYLLA_PRICE_DESC';
    if (isScyllaSort){
      setScyllaListedOnly(true); // also runs the query
    } else if (state.scyllaListedOnly){
      setScyllaListedOnly(false); // also runs the query
    } else {
      runQuery();
    }
    // Whichever branch above ran, startCollectionBrowse() has by now
    // synchronously swapped #resultsArea to the L0AD!NG P!GE0NS note (see
    // its own comment) — scrolling right here, not waiting for the fetch
    // to land, is what actually puts that note (not last query's now-
    // stale results) in view the moment you pick a sort, instead of
    // leaving you stranded up at SORT BY looking at nothing happening.
    scrollResultsIntoView();
  }
  // Click to open/close (not hover) — closes on an outside click, see
  // the shared document-level listener further down.
  el.sortDropLabel.addEventListener('click', function(){
    if (el.sortFlyout.style.display === 'block') closeSortFlyout();
    else openSortFlyout();
  });
  el.sortFlyoutClose.addEventListener('click', closeSortFlyout);
  // Real, visible trigger — see bottomTraitsBtn's own comment above for
  // why el.sortDropLabel itself stays as the thing actually clicked, and
  // why stopPropagation() here is load-bearing, not defensive.
  el.bottomSortBtn.addEventListener('click', function(e){
    e.stopPropagation();
    el.bottomSortBtn.classList.toggle('open', el.sortFlyout.style.display !== 'block');
    el.sortDropLabel.click();
  });
  el.sortFlyoutVals.addEventListener('click', function(e){
    var valBtn = e.target.closest('.traits-flyout-val');
    if (!valBtn || valBtn.hasAttribute('disabled')) return;
    applySort(valBtn.getAttribute('data-value'));
    closeSortFlyout();
  });
  // Desktop's horizontal strip (see #sortFlyout.flyout-flat's own CSS,
  // min-width:701px) is always visible, not click-to-open — the list has
  // to actually be in the DOM from page load for that to show anything,
  // not just whenever openSortFlyout() has been called. Harmless on
  // mobile too (the strip stays display:none there until opened).
  renderSortFlyoutList();
  // Used to jump straight to 0/scrollWidth on a single click — with 11
  // real options (once L0WEST (XRP) was enabled) that skipped over every
  // option in between, reported live as "click the arrow, it goes past"
  // the ones in the middle. Same fixed-pixel nudge as the TRAITS category
  // row's own arrows (see traitsCatsScrollPrevBtn/NextBtn above) instead —
  // one screenful at a time, not all the way to either end.
  // Instant, not 'smooth' — reported live as the animated scroll feeling
  // slow, especially clicking again before the previous animation had
  // finished (each click restarted a fresh ~300-500ms animation fighting
  // the last one). The scroll listener above already keeps the arrows in
  // sync in real time, so no setTimeout re-check is needed here any more
  // either — it only ever existed to wait out that same animation.
  el.sortScrollPrevBtn.addEventListener('click', function(){
    el.sortFlyoutVals.scrollBy({ left: -180 });
  });
  el.sortScrollNextBtn.addEventListener('click', function(){
    el.sortFlyoutVals.scrollBy({ left: 180 });
  });
  renderSortTag();
  // Reflects the default scyllaListedOnly:true landing state — every
  // other place this class gets toggled goes through setScyllaListedOnly
  // itself, but that's never actually called for the initial default.
  el.statScyllaListedTile.classList.toggle('scylla-active', state.scyllaListedOnly);
  // One delegated handler for every .input-clear-btn on the page (search,
  // offer amount, list price, both XRP calculator inputs) — see its own
  // CSS comment for why it must sit as the input's next sibling in
  // markup. Clears the value, refocuses the input, and dispatches a real
  // 'input' event so whatever that specific input's own listener already
  // does (re-validate, re-query, reformat, recompute a quote) fires
  // exactly as if the user had deleted the text themselves — no
  // per-input clear logic needed anywhere else.
  document.addEventListener('click', function(e){
    var clearBtn = e.target.closest('.input-clear-btn');
    if (!clearBtn) return;
    var input = clearBtn.previousElementSibling;
    if (!input || (input.tagName !== 'INPUT' && input.tagName !== 'TEXTAREA')) return;
    input.value = '';
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // #searchInput has no 'input' listener of its own (only Enter/GO) —
    // an empty query needs the same reset-to-unfiltered-browse behavior
    // GO already gives it, not just a visually-cleared box that's still
    // silently filtering on the old query underneath.
    if (input === el.searchInput) runSearchBox();
  });
  // SORTING BY / ADD TRAITS are click-to-open now (not hover) — close
  // whichever is open on a click anywhere outside its own box.
  document.addEventListener('click', function(e){
    // composedPath(), and checking el.sortFlyout itself alongside
    // sortDropWrap — same reasoning as the traits check right below:
    // #sortFlyout is now reparented to <body> for its entire time open
    // (see openSortFlyout), so a plain e.target/.contains(sortDropWrap)
    // check would read every click INSIDE the popup as "outside" and
    // close it before a pick could ever register. This also doubles as
    // the backdrop's own close-on-click — .flyout-popup-backdrop is
    // never inside either flyout, so a click on it always counts as
    // outside both.
    var sortClickPath = e.composedPath();
    if (el.sortFlyout.style.display === 'block' && !sortClickPath.includes(el.sortDropWrap) && !sortClickPath.includes(el.sortFlyout)) closeSortFlyout();
    // e.composedPath() instead of e.target — picking a trait VALUE
    // rebuilds #traitsFlyoutVals' innerHTML (renderTraitsFlyoutVals,
    // called synchronously inside that click's own handler, which runs
    // and fires BEFORE this bubbles up here) — the actual clicked button
    // is a detached node by the time this check runs, so any .contains()
    // check keyed off e.target goes stale and reads as "outside" even
    // though the click plainly wasn't.
    // composedPath() is captured at dispatch time, before any of that
    // mutation, so it still lists the real ancestor chain. Also checking
    // el.traitsFlyout itself, not just traitsHoverWrap — the mobile popup
    // step (.flyout-drilled) reparents #traitsFlyout to <body> (see
    // restoreTraitsFlyout's comment), so a click inside the popup is no
    // longer inside traitsHoverWrap at all once that's happened.
    var clickPath = e.composedPath();
    if (el.traitsFlyout.style.display === 'block' && !clickPath.includes(el.traitsHoverWrap) && !clickPath.includes(el.traitsFlyout)) closeTraitsFlyout();
    // Desktop's VALUES panel is a real dropdown now (#traitsFlyoutVals,
    // position:absolute — see its own CSS), separate from the always-
    // visible category strip above it, which never closes. This is that
    // dropdown's own close-on-outside-click, independent of the check
    // right above (that one only ever fires on mobile in practice — see
    // its own comment, style.display only actually reaches 'block' via
    // openTraitsFlyout(), which desktop's always-on strip never calls).
    // Same composedPath() reasoning as above: picking a value rebuilds
    // #traitsFlyoutVals' own children, detaching the clicked button
    // before this handler runs.
    if (window.innerWidth > 700 && el.traitsFlyoutVals.childElementCount && !clickPath.includes(el.traitsFlyout)){
      el.traitsFlyoutVals.innerHTML = '';
    }
    if (el.dbSelectFlyout.style.display === 'block' && !el.dbSelectWrap.contains(e.target)) closeDbSelectFlyout();
    // Same pattern for the pigeon DETAIL screen itself — a click anywhere
    // outside it (a different tab, the trustline banner, anywhere) closes
    // it back to the grid, instead of it staying stuck open underneath
    // whatever else you clicked. The lightbox is a sibling overlay, not a
    // child of screenDetail, so it needs its own explicit exclusion —
    // otherwise opening/closing it would also trigger this and exit the
    // detail screen entirely. A click on a .pigeon-img-box is also
    // excluded — that's the same click that just opened (or is opening)
    // this screen via wireResultClicks' own delegated handler earlier in
    // the same bubble phase, so treating it as "outside" would instantly
    // close the screen it was supposed to open. Same reasoning for the
    // CREATE OFFER picker's own VIEW button — it also opens this
    // screen (closing the picker modal first), from a click that started
    // outside #screenDetail by definition since the screen didn't exist
    // yet when the click landed.
    if (el.screenDetail.style.display !== 'none' && !el.screenDetail.contains(e.target) && !el.detailLightbox.contains(e.target) && !e.target.closest('.pigeon-img-box') && !e.target.closest('.simple-picker-view-btn')){
      goBackFromDetail();
    }
  });
  el.editionSelect.addEventListener('click', function(e){
    var btn = e.target.closest('.edition-btn');
    if (!btn) return;
    state.edition = btn.getAttribute('data-value');
    el.editionSelect.querySelectorAll('.edition-btn').forEach(function(b){
      b.classList.toggle('active', b === btn);
    });
    runQuery();
  });
  // Pure re-render, no refetch — swapping views doesn't change the result
  // set, just how each card in it is drawn.
  el.dbViewSelect.addEventListener('change', function(){
    state.dbView = el.dbViewSelect.value;
    if (state.items && state.items.length) renderResultsReplace(state.items);
  });
  // ALL editions, LOWEST LISTED $P!GE0NS, THUMBNAILS view, no traits — one
  // click back to the default landing state (matches the initial page-load
  // state at the top of this file: sort SCYLLA_PRICE_ASC, scyllaListedOnly
  // true).
  el.resetDbBtn.addEventListener('click', function(){
    state.edition = 'ALL';
    el.editionSelect.querySelectorAll('.edition-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-value') === 'ALL');
    });
    el.dbViewSelect.value = 'thumbnails';
    state.dbView = 'thumbnails';
    state.traitFilters = [];
    renderTraitRows();
    state.sort = 'SCYLLA_PRICE_ASC';
    renderSortTag();
    if (state.activeTab === 'mypigeons'){
      // FL0CK only ever shows your own Pigeons, no exceptions — RESET
      // here must never exit that scope into the full collection (the
      // DATABASE-only branch below does exactly that on purpose), only
      // clear sort/traits/edition within it.
      runScopedQuery();
    } else {
      // A wallet search (or a Top 100/sales-history wallet click) scopes
      // the whole DATABASE view to that wallet — RESET should drop back
      // to the full collection too, not just reset sort/traits within
      // that scope.
      var wasScoped = !!state.scope;
      if (wasScoped) exitWalletScope();
      if (!state.scyllaListedOnly) setScyllaListedOnly(true); // also runs the query, forces sort to a SCYLLA_PRICE_* value (already ASC from above) and clears any scope
      else if (wasScoped) startCollectionBrowse();
      else runQuery();
    }
    // RESET can get clicked after scrolling deep into the results list —
    // land back at the search panel's own title (SEARCH!NG $P!GE0NS
    // DATABASE / SH0W!NG Y0UR P!GE0NS), not the literal page top past the
    // hero/trustline banner. Reported live (with a screenshot) as wanting
    // this to land right above SORT BY/FILTER BY TRAITS, same target
    // scrollActiveTabPanelIntoView already uses for MY PIGEONS — DATABASE
    // gets that same treatment here specifically for RESET, without
    // changing what a plain DATABASE tab click still does (full page top).
    el.searchPanelTitle.scrollIntoView({ block: 'start', behavior: 'smooth' });
  });

  // ---- Inspect / detail ----
  // Rarest trait (lowest real-collection percent) first — a.percent is
  // only ever missing before ensureTraitsLoaded() has resolved once, in
  // which case original attribute order is kept (no comparison possible
  // yet), same as the un-sorted state before this existed.
  function sortTraitsByRarity(attrs){
    return attrs.slice().sort(function(a, b){
      var ap = (a.percent === null || a.percent === undefined) ? null : a.percent;
      var bp = (b.percent === null || b.percent === undefined) ? null : b.percent;
      if (ap === null && bp === null) return 0;
      if (ap === null) return 1;
      if (bp === null) return -1;
      return ap - bp;
    });
  }
  function traitCellHtml(a){
    var sub = (a.percent !== null && a.percent !== undefined)
      ? '<div class="tc-sub">' + greenNum(typeof a.percent === 'number' ? a.percent.toFixed(3) : a.percent) + '%' + (a.count !== null && a.count !== undefined ? '<br>(' + greenNum(a.count) + ')' : '') + '</div>'
      : '';
    // Same real-photo-as-background treatment as the ADD TRAITS flyout's
    // own trait boxes (renderTraitsFlyoutVals) — same example image
    // source, same per-category crop position/size/overlay.
    var exampleImg = (state.traitExamples && state.traitExamples[a.trait_type] && state.traitExamples[a.trait_type][a.value]) || null;
    var previewPos = TRAIT_PREVIEW_CORNER_POSITION[a.trait_type] || TRAIT_PREVIEW_POSITION[a.trait_type];
    var previewSize = TRAIT_PREVIEW_SIZE[a.trait_type];
    var overlay = previewSize
      ? 'rgba(8,9,11,0.3),rgba(8,9,11,0.45)'
      : 'rgba(8,9,11,0.55),rgba(8,9,11,0.8)';
    var style = exampleImg
      ? ' style="background-image:linear-gradient(' + overlay + '),url(&quot;' + escapeHtml(exampleImg) + '&quot;);' +
        (previewSize ? 'background-size:' + previewSize + ';' : '') +
        (previewPos ? 'background-position:' + previewPos + ';' : '') + '"'
      : '';
    // Photo-backed cells wrap value/label/sub in a static box (.tc-text)
    // instead of relying on text-shadow alone — a busy/light crop still
    // clashed with plain shadowed text.
    var textOpen = exampleImg ? '<div class="tc-text">' : '';
    var textClose = exampleImg ? '</div>' : '';
    return '<div class="trait-cell' + (exampleImg ? ' has-preview' : '') + '" data-trait="' + escapeHtml(a.trait_type) + '" data-value="' + escapeHtml(a.value) + '"' + style +
      ' title="V!EW ALL P!GE0NS W!TH TH!S TRA!T">' +
      textOpen +
      // Value first, category second — "G0LDEN FEATHERS" reads as one
      // phrase describing the trait, not a label/value form field.
      '<div class="tc-value">' + escapeHtml(a.value) + '</div><div class="tc-label">' + escapeHtml(a.trait_type) + '</div>' + sub +
      textClose +
    '</div>';
  }
  // Clicking a trait cell on the INSPECT screen filters the browse view down
  // to every Pigeon sharing that exact trait/value.
  el.detailTraits.addEventListener('click', function(e){
    var cell = e.target.closest('.trait-cell');
    if (!cell) return;
    var trait = cell.getAttribute('data-trait');
    var value = cell.getAttribute('data-value');
    if (!trait || !value) return;
    ensureTraitsLoaded().then(function(){
      state.traitFilters = [{ id: state.nextTraitRowId++, category: trait, value: value }];
      renderTraitRows();
      el.searchInput.value = '';
      showScreen('browse');
      runQuery();
    });
  });
  function renderOwnerLink(short, full){
    if (!full){ el.detailOwner.textContent = 'N0T !NDEXED'; el.detailOwner.classList.add('not-indexed'); return; }
    el.detailOwner.classList.remove('not-indexed');
    // MESSAGE link removed — messaging is paused (MESSAGES_DB was never
    // bound in production, see the MESSAGE !NB0X account box's own
    // comment), so this would only ever dead-end at a broken page.
    el.detailOwner.innerHTML = '<span class="do-label">0WNED BY</span><a class="owner-link" href="#" data-wallet="' + escapeHtml(full) + '" data-short="' + escapeHtml(short || full) + '" title="V!EW TH!S WALLET\\'S FULL P!GE0N C0LLECT!0N">' + walletTagHtml(full, short) + '</a>';
  }
  // Clicking the owner address on INSPECT jumps straight into that wallet's
  // full real Pigeon collection (same browse UI as SELECT), not an external
  // explorer.
  el.detailOwner.addEventListener('click', function(e){
    var link = e.target.closest('.owner-link');
    if (!link) return;
    e.preventDefault();
    browseOwnerCollection(link.getAttribute('data-wallet'), link.getAttribute('data-short'));
  });
  function updateDetailRarity(p){
    if (p && p.rarityRank){ el.detailRarityRow.style.display = ''; el.detailRarity.innerHTML = greenNum(p.rarityRank) + (p.rarityTotal ? ' / ' + p.rarityTotal : ''); }
    else el.detailRarityRow.style.display = 'none';
  }
  function updateDetailPrice(p){
    if (p && p.priceXrp !== null && p.priceXrp !== undefined){
      el.detailPriceRow.style.display = '';
      el.detailPrice.textContent = p.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP';
    } else {
      el.detailPriceRow.style.display = 'none';
    }
    // REC0RD SALE / RECENT SALE always show a value now, never hide the
    // row — a Pigeon that's never changed hands isn't "missing sale
    // data", it just has none yet, so it says so instead of leaving a
    // gap where those two fields would otherwise be.
    if (p && p.highSaleXrp !== null && p.highSaleXrp !== undefined){
      var hsText = p.highSaleXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP';
      el.detailHighSale.innerHTML = p.highSaleTxUrl
        ? '<a class="owner-link" href="' + escapeHtml(p.highSaleTxUrl) + '" target="_blank" rel="noopener">' + escapeHtml(hsText) + '</a>'
        : escapeHtml(hsText);
    } else {
      el.detailHighSale.textContent = 'M!NT C0ND!T!0N';
    }
    if (p && p.recentSaleXrp !== null && p.recentSaleXrp !== undefined){
      var rsText = p.recentSaleXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP';
      el.detailRecentSale.innerHTML = p.recentSaleTxUrl
        ? '<a class="owner-link" href="' + escapeHtml(p.recentSaleTxUrl) + '" target="_blank" rel="noopener">' + escapeHtml(rsText) + '</a>'
        : escapeHtml(rsText);
    } else {
      el.detailRecentSale.textContent = 'M!NT C0ND!T!0N';
    }
    if (p && p.avgSaleXrp !== null && p.avgSaleXrp !== undefined){
      el.detailAvgSaleRow.style.display = '';
      el.detailAvgSale.innerHTML = greenNum(p.avgSaleXrp.toLocaleString(undefined, { maximumFractionDigits: 2 })) + ' XRP' + (p.saleCount ? ' (' + p.saleCount + ' SALES)' : '');
    } else {
      el.detailAvgSaleRow.style.display = 'none';
    }
  }
  // The real $PIGEONS-denominated Σκύλλα marketplace listing (separate
  // from the DEEPTIDE/XRP.CAFE rows above, which are always XRP) — never
  // buyable via a plain link, so this is a button into the same
  // openBuyConfirm flow the DATABASE cards' BUY button uses.
  el.detailScyllaBuyBtn.addEventListener('click', function(){
    if (state.currentDetail) openBuyConfirm(state.currentDetail);
  });
  // Same openDelistConfirm the card grid's own CANCEL/DELIST buttons
  // use (see wireResultClicks' .delist-pigeon-btn handler) — wired
  // directly here since this button lives outside el.resultsArea/
  // el.myPigeonsList, same reasoning as detailMakeOfferSend above.
  el.detailScyllaDelistBtn.addEventListener('click', function(){
    if (state.currentDetail) openDelistConfirm(state.currentDetail);
  });
  // Same reasoning as detailScyllaDelistBtn above — detailScyllaOwnedRow
  // lives outside el.resultsArea/el.myPigeonsList, so wireResultClicks'
  // own .list-open-modal-btn/.transfer-open-modal-btn handling never
  // sees these.
  el.detailScyllaListBtn.addEventListener('click', function(){
    if (state.currentDetail) openAmountEntryModal('list', state.currentDetail);
  });
  el.detailScyllaTransferBtn.addEventListener('click', function(){
    if (state.currentDetail) openAmountEntryModal('transfer', state.currentDetail);
  });
  function updateScyllaListing(p){
    var listing = p && p.scyllaListing;
    var notOwn = !!(p && p.owner && p.owner !== MY_WALLET);
    var isOwn = !!(p && p.owner) && !notOwn;
    if (listing && listing.price !== null && listing.price !== undefined){
      // Same "Y0UR L!ST!NG :: 444K" compact note (+ CANCEL button) as the
      // card grid's own pigeonsActionBoxHtml on your own listed Pigeon —
      // never the raw fmtPigeons price there, since there's no BUY button
      // next to it to buy your own listing anyway.
      // Plain white (#screenDetail .scylla-listing-price's own default) —
      // the CANCEL button next to it is what's red now, not this text.
      el.detailScyllaPrice.textContent = isOwn ? 'Y0UR L!ST!NG :: ' + compactPigeonsNumber(listing.price) : fmtPigeons(listing.price);
      el.detailScyllaBuyBtn.style.display = notOwn ? '' : 'none';
      el.detailScyllaDelistBtn.style.display = isOwn ? '' : 'none';
      el.detailScyllaOwnedRow.style.display = 'none';
      el.detailScyllaListingRow.classList.remove('not-listed');
      var detailCountdown = listingCountdownText(listing.expiration);
      el.detailScyllaCountdown.textContent = detailCountdown;
      el.detailScyllaCountdown.style.display = detailCountdown ? '' : 'none';
    } else {
      // Owned + unlisted — real L!ST/TRANSFER buttons (detailScyllaOwnedRow)
      // instead of the plain "!N Y0UR FL0CK" text label this used to be.
      el.detailScyllaPrice.textContent = isOwn ? 'N0T L!STED' : 'N0 L!ST!NG';
      el.detailScyllaBuyBtn.style.display = 'none';
      el.detailScyllaDelistBtn.style.display = 'none';
      el.detailScyllaOwnedRow.style.display = isOwn ? '' : 'none';
      el.detailScyllaListingRow.classList.add('not-listed');
      el.detailScyllaCountdown.style.display = 'none';
    }
    // MAKE OFFER — same option the DATABASE grid's own OFFER AMOUNT box
    // offers (submitMakeOffer), available regardless of whether it's
    // actively listed, just not on your own Pigeon.
    el.detailMakeOfferRow.style.display = notOwn ? '' : 'none';
    if (notOwn){
      el.detailMakeOfferInput.value = '';
      detailMakeOfferDurationDays = 0;
      el.detailMakeOfferDuration.querySelectorAll('.list-duration-btn').forEach(function(b){
        b.classList.toggle('active', b.getAttribute('data-days') === '0');
      });
    }
    // OFFERS RECEIVED — same myPigeonOffersHtml the card grid's own
    // ownedPigeonActionHtml already renders per-card; this was the only
    // gap (see the container's own comment above, in the markup).
    var offers = isOwn ? (offersByNftId[p.nftId] || []) : [];
    el.detailOffersReceived.innerHTML = offers.length ? myPigeonOffersHtml(p, offers) : '';
  }
  // detailMakeOfferRow isn't inside el.resultsArea/el.myPigeonsList, so
  // wireResultClicks' delegated .make-offer-send/-input handling never
  // sees it — wired directly here instead, same submitMakeOffer/
  // formatThousandsInput helpers everywhere else uses.
  var detailMakeOfferDurationDays = 0; // same real Expiration as amountEntryOfferDurationDays, for the detail screen's own copy of MAKE OFFER
  function sendDetailMakeOffer(){
    if (!state.currentDetail) return;
    var priceValue = el.detailMakeOfferInput.value.trim().replace(/,/g, '');
    submitMakeOffer(state.currentDetail, priceValue, el.detailMakeOfferRow, detailMakeOfferDurationDays);
  }
  el.detailMakeOfferSend.addEventListener('click', sendDetailMakeOffer);
  el.detailMakeOfferInput.addEventListener('input', function(){ formatThousandsInput(el.detailMakeOfferInput); });
  el.detailMakeOfferInput.addEventListener('keydown', function(e){ if (e.key === 'Enter') sendDetailMakeOffer(); });
  el.detailMakeOfferDuration.addEventListener('click', function(e){
    var btn = e.target.closest('.list-duration-btn');
    if (!btn) return;
    detailMakeOfferDurationDays = parseInt(btn.getAttribute('data-days'), 10);
    el.detailMakeOfferDuration.querySelectorAll('.list-duration-btn').forEach(function(b){
      b.classList.toggle('active', b === btn);
    });
  });
  // Same DEEPTIDE/XRP.CAFE clickable-box component the DATABASE cards use
  // (listingBlockHtml), side by side directly under the big image —
  // instead of the old stacked market/price/buy-link rows.
  function updateDetailListings(listings){
    el.detailListingsRow.innerHTML = listingBlockHtml('XRP.CAFE', listings && listings.xrpCafe) + listingBlockHtml('DEEPT!DE', listings && listings.deeptide);
  }
  function findKnown(nftId){
    return state.items.filter(function(p){ return p.nftId === nftId; })[0] ||
      state.scopeAllItems.filter(function(p){ return p.nftId === nftId; })[0];
  }
  // ---- Per-Pigeon history (mint/transfer/sale events, real, straight from
  // Deeptide's per-token history endpoint) ----
  function walletLinkHtml(full, short){
    if (!full) return '';
    return '<a data-wallet="' + escapeHtml(full) + '" data-short="' + escapeHtml(short || full) + '">' + walletTagHtml(full, short) + '</a>';
  }
  // Reads as a plain sentence per event — SOLD FOR x XRP TO wallet,
  // TRANSFERRED TO wallet, MINTED BY wallet — instead of a cramped data
  // table. Deeptide's history is newest-first, so MINTED BY naturally
  // lands last without any re-sorting.
  function historyRowHtml(e){
    var line;
    if (e.type === 'sale'){
      var price = e.priceXrp !== null && e.priceXrp !== undefined
        ? '<span class="dh-price">' + e.priceXrp.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' XRP</span>' : '?';
      line = '<span class="dh-verb">S0LD</span> F0R ' + price + (e.buyer ? ' T0 ' + walletLinkHtml(e.buyer, e.buyerShort) : '');
    } else if (e.type === 'mint'){
      line = '<span class="dh-verb">M!NTED</span> BY ' + (e.account ? walletLinkHtml(e.account, e.accountShort) : '?');
    } else {
      line = '<span class="dh-verb">TRANSFERRED</span> T0 ' + (e.receiver ? walletLinkHtml(e.receiver, e.receiverShort) : '?');
    }
    var when = e.date ? new Date(e.date).toLocaleDateString() : '';
    var txLink = e.txUrl ? '<a class="dh-tx" href="' + escapeHtml(e.txUrl) + '" target="_blank" rel="noopener">TXN</a>' : '';
    return '<div class="dh-row">' +
      '<div class="dh-line">' + line + '</div>' +
      '<div class="dh-meta"><span class="dh-time">' + escapeHtml(when) + '</span>' + txLink + '</div>' +
    '</div>';
  }
  function loadDetailHistory(nftId){
    api({ history: nftId }).then(function(data){
      if (state.currentDetail && state.currentDetail.nftId !== nftId) return; // navigated away already
      var events = data.events || [];
      el.detailHistoryList.innerHTML = events.length
        ? events.map(historyRowHtml).join('')
        : '<div class="th-empty">N0 H!ST0RY YET.</div>';
    }).catch(function(){
      el.detailHistoryList.innerHTML = '<div class="th-empty">C0ULD N0T L0AD H!ST0RY.</div>';
    });
  }
  el.detailHistoryList.addEventListener('click', function(e){
    var walletLink = e.target.closest('.dh-parties a[data-wallet]');
    if (walletLink) browseOwnerCollection(walletLink.getAttribute('data-wallet'), walletLink.getAttribute('data-short'));
  });

  // Where the grid was scrolled to right before opening a Pigeon's detail
  // screen — restored on BACK so you land back on the exact card you
  // clicked, not the top of the whole list.
  var scrollBeforeDetail = null;
  function openDetail(nftId){
    scrollBeforeDetail = window.scrollY;
    var known = findKnown(nftId);
    el.detailNum.innerHTML = known && known.number !== null ? collectionItemLabel() + ' #' +greenNum(known.number) : collectionItemLabel() + ' ...';
    el.detailImgBox.innerHTML = known && known.image ? '<img src="' + escapeHtml(known.image) + '" alt="">' : 'IMAGE';
    // Keep the fullscreen lightbox's own picture in sync when PREV/NEXT is
    // used from inside it (see navigateDetail's lightbox branch below) —
    // it has its own <img>, independent of #detailImgBox's.
    if (el.detailLightbox.style.display !== 'none'){
      el.detailLightboxImg.src = known && known.image ? known.image : '';
    }
    if (known && known.owner) renderOwnerLink(known.ownerShort, known.owner);
    else { el.detailOwner.textContent = '...'; el.detailOwner.classList.remove('not-indexed'); }
    el.detailTraits.innerHTML = known ? sortTraitsByRarity(known.attributes).map(traitCellHtml).join('') : '';
    el.detailHistoryList.innerHTML = '<div class="th-empty">L0AD!NG...</div>';
    updateDetailRarity(known);
    updateDetailPrice(known);
    updateDetailListings(known && known.listings);
    updateScyllaListing(known);
    state.currentDetail = known || { nftId: nftId, number: null, owner: null, ownerShort: null, attributes: [] };
    // showScreen itself smooth-scrolls the tab strip back into view (see
    // its own comment) — a thumbnail click deep in a long (up to
    // 3015-item) grid would otherwise leave the detail screen opening
    // wherever the page happened to be scrolled.
    showScreen('detail');
    refreshCardSelectionStates();
    loadDetailHistory(nftId);
    updateDetailNavButtons();

    api({ detail: nftId }).then(function(data){
      if (!data.item){
        state.currentDetail = known || { nftId: nftId, number: null, owner: null, ownerShort: null, attributes: [] };
        renderOwnerLink(null, null);
        return;
      }
      var p = data.item;
      state.currentDetail = p;
      el.detailNum.innerHTML = p.number !== null ? collectionItemLabel() + ' #' +greenNum(p.number) : collectionItemLabel() + ' ...';
      el.detailImgBox.innerHTML = p.image ? '<img src="' + escapeHtml(p.image) + '" alt="">' : 'IMAGE';
      el.detailTraits.innerHTML = sortTraitsByRarity(p.attributes).map(traitCellHtml).join('');
      updateDetailRarity(p);
      updateDetailPrice(p);
      updateDetailListings(p.listings);
      updateScyllaListing(p);
      renderOwnerLink(p.ownerShort, p.owner);
      refreshCardSelectionStates();
    }).catch(function(){
      renderOwnerLink(null, null);
    });
  }

  // ---- PREV/NEXT — walks whichever list this Pigeon was opened from, in
  // whatever order/filter it currently has: the whole-collection
  // infinite-scroll browse (state.items) normally, or a wallet's full
  // held collection (state.scopeAllItems) when scoped to one (SH0W MY
  // P!GE0NS, a search-box wallet hit, a Top 100/owner-link click) — never
  // a separate, fixed collection-wide sequence of its own. ----
  function currentBrowseList(){
    return (state.scope ? state.scopeAllItems : state.items) || [];
  }
  function updateDetailNavButtons(){
    var list = currentBrowseList();
    var currentId = state.currentDetail && state.currentDetail.nftId;
    var idx = list.findIndex(function(p){ return p.nftId === currentId; });
    el.detailPrevBtn.disabled = idx <= 0;
    // Wallet scopes are always fully loaded already; the whole-collection
    // browse is paginated, so "is there a next one" also has to account
    // for a next PAGE that just hasn't loaded yet, not only what's
    // already in memory.
    var hasNext = idx !== -1 && (idx < list.length - 1 || (!state.scope && state.hasMore));
    el.detailNextBtn.disabled = idx === -1 || !hasNext;
    // Lightbox has its own PREV/NEXT pair (separate elements, same list) —
    // keep them in lockstep with the detail screen's own.
    el.lightboxPrevBtn.disabled = el.detailPrevBtn.disabled;
    el.lightboxNextBtn.disabled = el.detailNextBtn.disabled;
  }
  function navigateDetail(direction){
    var list = currentBrowseList();
    var currentId = state.currentDetail && state.currentDetail.nftId;
    var idx = list.findIndex(function(p){ return p.nftId === currentId; });
    if (idx === -1) return;
    var targetIdx = idx + direction;
    if (targetIdx < 0) return;
    if (targetIdx < list.length){
      openDetail(list[targetIdx].nftId);
      return;
    }
    // Ran off the end of what's currently loaded — only the unscoped
    // infinite-scroll browse can still have more to fetch; a wallet scope
    // reaching its own end really is the end.
    if (direction > 0 && !state.scope && state.hasMore && !state.loading){
      el.detailNextBtn.disabled = true;
      el.lightboxNextBtn.disabled = true;
      loadMoreCollection(function(){
        var freshList = currentBrowseList();
        if (targetIdx < freshList.length) openDetail(freshList[targetIdx].nftId);
        else updateDetailNavButtons();
      });
    }
  }
  el.detailPrevBtn.addEventListener('click', function(){ navigateDetail(-1); });
  el.detailNextBtn.addEventListener('click', function(){ navigateDetail(1); });
  // Left/Right arrow keys as a shortcut for the same click — ignored
  // while actually typing in a field (the detail screen's own MAKE
  // OFFER input included) so this never hijacks normal text editing.
  document.addEventListener('keydown', function(e){
    if (el.screenDetail.style.display === 'none') return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key === 'ArrowLeft') navigateDetail(-1);
    else if (e.key === 'ArrowRight') navigateDetail(1);
  });

  // ---- Browser/mouse BACK button — this page never called
  // history.pushState anywhere, so there was nothing app-aware for a back
  // press to step through: clicking back (or a mouse's dedicated back
  // button, same popstate event) left the whole site entirely instead of
  // closing whatever was actually open — a Pigeon's detail view, a
  // confirm popup, a wallet scope, a non-DATABASE tab. Reported live as
  // "back goes to a separate web page." One synthetic history entry is
  // pushed on load and re-pushed every time a back press closes exactly
  // one of these (checked in the order someone would expect to unwind
  // them — modals before the detail screen, detail before wallet scope,
  // wallet scope before the tab itself); once nothing here is left open,
  // the next back press finally leaves the page for real, since nothing
  // gets pushed again at that point. ----
  function closeTopmostOverlayForBack(){
    if (el.acceptTransferConfirmModal.style.display !== 'none'){ closeAcceptTransferConfirm(); return true; }
    if (el.transferConfirmModal.style.display !== 'none'){ closeTransferConfirmModal(); return true; }
    if (el.offerConfirmModal.style.display !== 'none'){ closeOfferConfirmModal(); return true; }
    if (el.buySwapModal.style.display !== 'none'){ closeBuySwapModal(); return true; }
    if (el.buyConfirmModal.style.display !== 'none'){ closeBuyConfirmModal(); return true; }
    if (el.acceptOfferConfirmModal.style.display !== 'none'){ closeAcceptOfferConfirmModal(); return true; }
    if (el.delistConfirmModal.style.display !== 'none'){ closeDelistConfirmModal(); return true; }
    if (el.pigeonsCalcModal.style.display !== 'none'){ closeCalcPopover(); return true; }
    if (el.amountEntryModal.style.display !== 'none'){ closeAmountEntryModal(); return true; }
    if (el.screenHistory.style.display !== 'none' || el.screenDetail.style.display !== 'none'){ goBackFromDetail(); return true; }
    if (state.scope){ exitWalletScope(); startCollectionBrowse(); return true; }
    if (state.activeTab && state.activeTab !== 'database'){ showTab('database'); return true; }
    return false;
  }
  window.addEventListener('popstate', function(){
    if (closeTopmostOverlayForBack()) history.pushState({ skyllaNav: true }, '', location.href);
  });
  history.pushState({ skyllaNav: true }, '', location.href);

  // Sales history now swaps out the whole panel (SCREEN 2b) instead of
  // expanding inline underneath the traits — detailHistoryList itself
  // already lives inside screenHistory and is populated by openDetail's
  // eager loadDetailHistory() call, so there's nothing left to fetch here.
  el.detailHistoryToggle.addEventListener('click', function(){
    el.historyNum.innerHTML = el.detailNum.innerHTML;
    showScreen('history');
  });
  el.backToDetailBtn.addEventListener('click', function(){ showScreen('detail'); });
  function goBackFromDetail(){
    showScreen('browse');
    // Overrides showScreen's own tab-strip-aligned scroll with the exact
    // card position remembered in openDetail — going back should land you
    // back on the specific Pigeon you clicked, not just near the top.
    if (scrollBeforeDetail !== null){
      window.scrollTo({ top: scrollBeforeDetail, behavior: 'smooth' });
      scrollBeforeDetail = null;
    }
  }
  el.backToBrowseBtn.addEventListener('click', goBackFromDetail);
  el.backToBrowseBtnTop.addEventListener('click', goBackFromDetail);
  // Copies a real, working ?pigeon=N link (see the deep-link handler near
  // the bottom of this script) — the number, not the NFT ID, since that's
  // what anyone sharing/reading it actually recognizes.
  el.detailShareBtn.addEventListener('click', function(){
    var num = state.currentDetail && state.currentDetail.number;
    if (!num) return;
    var url = window.location.origin + '/static?pigeon=' + num;
    var showCopied = function(){
      el.detailShareBtn.textContent = 'C0P!ED';
      setTimeout(function(){ el.detailShareBtn.textContent = 'SHARE'; }, 1500);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(showCopied, showCopied);
    else showCopied();
  });
  // Picture click opens a fullscreen lightbox (see #detailLightbox) —
  // click it again (anywhere) to close back to the detail screen.
  el.detailImgBox.addEventListener('click', function(){
    var img = el.detailImgBox.querySelector('img');
    if (!img) return;
    el.detailLightboxImg.src = img.src;
    el.detailLightbox.style.display = 'flex';
  });
  el.detailLightbox.addEventListener('click', function(){
    el.detailLightbox.style.display = 'none';
    el.detailLightboxImg.src = '';
  });
  // Lightbox's own PREV/NEXT — same navigateDetail walk as the detail
  // screen's buttons, just stopped from bubbling up to the lightbox's own
  // click-anywhere-to-close handler above.
  el.lightboxPrevBtn.addEventListener('click', function(e){ e.stopPropagation(); navigateDetail(-1); });
  el.lightboxNextBtn.addEventListener('click', function(e){ e.stopPropagation(); navigateDetail(1); });
  // ---- Collection-wide stats strip (items/holders real from our own
  // ledger scan; floor from BOTH marketplaces separately since each has
  // its own liquidity; volume/listed% from xrp.cafe's own stats API) ----
  function fmtXrp(n){ return n === null || n === undefined ? '—' : n.toLocaleString(undefined, { maximumFractionDigits: n < 100 ? 2 : 0 }); }
  // Real $PIGEONS sale figures default to 0 (never hidden) — a Pigeon that
  // has never sold through Σκύλλα's own marketplace genuinely has a 0
  // $PIGEONS sale history, distinct from "no data available." Accepts a
  // string too (listing/offer prices come back from the API as issued-
  // currency value strings, not numbers) so every $PIGEONS amount in the
  // app gets the same comma-grouped formatting, not just the sale stats.
  function fmtPigeons(n){
    var num = typeof n === 'string' ? Number(n) : n;
    return (num || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + COLLECTION_META[state.collection].tokenLabel;
  }
  // Same r...XXXX shortening already used elsewhere (S!GNED !N AS, wallet
  // search) — a raw 34-char address sitting next to a clean price row was
  // reported live as reading cluttered on BUY N0W's own waiting screen.
  function shortAddr(addr){
    return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : '';
  }
  // ---- PR0F!LES — a wallet's own chosen username/pfp, resolved and
  // patched in everywhere a short address used to be the final answer
  // (top holders, offers, sales history, pigeon owner, buy/accept
  // confirm screens…). Every one of those already renders instantly with
  // the short address as normal (walletTagHtml's own fallback) — this
  // only ever upgrades it in place a moment later if a profile exists,
  // never blocks or delays anything on the resolve.
  var profileCache = {};       // wallet -> {username, pfpImage} | null once resolved
  var profilePendingSet = {};  // wallet -> true, batched up until the next flush
  var profileResolveTimer = null;
  function queueProfileResolve(address){
    if (!address || Object.prototype.hasOwnProperty.call(profileCache, address) || profilePendingSet[address]) return;
    profilePendingSet[address] = true;
    if (profileResolveTimer) clearTimeout(profileResolveTimer);
    profileResolveTimer = setTimeout(flushProfileResolve, 150);
  }
  function flushProfileResolve(){
    profileResolveTimer = null;
    var wallets = Object.keys(profilePendingSet);
    profilePendingSet = {};
    if (!wallets.length) return;
    fetch('/api/profiles-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallets: wallets })
    }).then(function(r){ return r.json(); }).then(function(data){
      var profiles = data.profiles || {};
      wallets.forEach(function(w){ profileCache[w] = profiles[w] || null; });
      applyResolvedProfiles(wallets);
    }).catch(function(){
      // Left out of profileCache entirely (not even cached as null) — a
      // later queueProfileResolve for the same wallet retries instead of
      // permanently sticking with the short-address fallback over one
      // transient network blip.
    });
  }
  // .wallet-tag elements everywhere carrying this exact address get their
  // visible text/avatar patched in place — every render site shares the
  // same data-wallet value, so one resolve covers every place that same
  // wallet happens to show up on screen at once (a seller showing up in
  // both a card's HIGHEST OFFER box and SALES H!ST0RY, say).
  function applyResolvedProfiles(wallets){
    wallets.forEach(function(w){
      var profile = profileCache[w];
      if (!profile || !profile.username) return;
      var nodes = document.querySelectorAll('.wallet-tag[data-wallet="' + w + '"]');
      nodes.forEach(function(node){
        node.textContent = profile.username;
        if (profile.pfpImage && !node.querySelector('.wallet-avatar')){
          var img = document.createElement('img');
          img.className = 'wallet-avatar';
          img.src = profile.pfpImage;
          img.alt = '';
          node.insertBefore(img, node.firstChild);
        }
      });
    });
  }
  // The one function every address-display spot in the app should build
  // its visible text through from now on — HTML string form, for anywhere
  // building up a bigger innerHTML blob (card rows, list rows, history
  // lines). See setWalletText below for the handful of spots that instead
  // set a single dedicated element's content directly.
  function walletTagHtml(address, fallbackShort){
    if (!address) return '';
    queueProfileResolve(address);
    var cached = profileCache[address];
    var label = (cached && cached.username) ? cached.username : (fallbackShort || shortAddr(address));
    var avatarHtml = (cached && cached.pfpImage) ? '<img class="wallet-avatar" src="' + escapeHtml(cached.pfpImage) + '" alt="">' : '';
    return '<span class="wallet-tag" data-wallet="' + escapeHtml(address) + '">' + avatarHtml + escapeHtml(label) + '</span>';
  }
  // For the handful of spots that assign a dedicated element's content
  // directly instead of building an HTML string (BUY N0W/ACCEPT 0FFER's
  // own confirm screens) — same fallback-now/upgrade-later behaviour as
  // walletTagHtml, just applied to one specific element.
  function setWalletText(el2, address, fallbackShort){
    el2.classList.add('wallet-tag');
    if (!address){ el2.removeAttribute('data-wallet'); el2.textContent = fallbackShort || ''; return; }
    el2.setAttribute('data-wallet', address);
    queueProfileResolve(address);
    var cached = profileCache[address];
    el2.textContent = '';
    if (cached && cached.pfpImage){
      var img = document.createElement('img');
      img.className = 'wallet-avatar';
      img.src = cached.pfpImage;
      img.alt = '';
      el2.appendChild(img);
    }
    el2.appendChild(document.createTextNode((cached && cached.username) ? cached.username : (fallbackShort || shortAddr(address))));
  }
  // ---- PR0F!LE panel — set your own username + pick a pfp from your own
  // Pigeons. pfp picking reuses the exact same .simple-picker-grid/card
  // markup OFFER F0R's own picker already uses (openSimpleOfferPicker),
  // just a different grid element and no view-detail button. ----
  var profileSelectedPfpNftId = null;
  // r,g,b triplets — same values MAINFRAME's own --card-accent uses per
  // collection (see its own cards' inline style) — kept here too rather
  // than read off COLLECTION_META, which doesn't carry a display accent
  // of its own. A future collection just needs one more entry here for
  // its MY C0!NS row to pick up its real colour instead of the fallback.
  var PROFILE_COIN_ACCENTS = { pigeons: '136,72,248', phnixs: '255,90,31', teddybg: '47,158,68' };
  function renderProfileCoins(){
    if (!MY_WALLET){ el.profileCoinsList.innerHTML = ''; return; }
    var keys = Object.keys(COLLECTION_META);
    el.profileCoinsList.innerHTML = keys.map(function(key){
      var meta = COLLECTION_META[key];
      var accent = PROFILE_COIN_ACCENTS[key] || '61,243,236';
      // BUY only for $P!GE0NS right now (the only collection with a real
      // AMM/DEX pool behind it, same COLLECTION_META.hasAmm gate the
      // trustline banner's own BUY button already uses) — everything else
      // still shows its own real balance/trustline below, just with
      // C0M!NG S00N here instead of a live action, matching how every
      // other collection reads everywhere else on the site right now.
      var actionHtml = meta.hasAmm
        ? '<button type="button" class="profile-coin-action" data-action="buy" data-collection="' + key + '">BUY ' + escapeHtml(meta.tokenLabel) + '</button>'
        : '<button type="button" class="profile-coin-action profile-coin-action-soon" disabled>C0M!NG S00N</button>';
      return '<div class="profile-coin-row" style="--card-accent:' + accent + ';" data-collection="' + key + '">' +
        '<div class="profile-coin-thumb" id="profileCoinThumb-' + key + '"></div>' +
        '<div class="profile-coin-info">' +
          '<div class="profile-coin-label">' + escapeHtml(meta.tokenLabel) + '</div>' +
          '<div class="profile-coin-balance" id="profileCoinBalance-' + key + '">' + (meta.tokenIssuer ? 'L0AD!NG...' : 'N0 T0KEN YET') + '</div>' +
        '</div>' +
        actionHtml +
      '</div>';
    }).join('');
    // Real per-collection art — same live-fetched-and-cached trick the
    // trustline banner's own thumbnail already uses (collectionThumbCache),
    // reused here instead of a second cache so switching DATABASE
    // collections and opening PR0F!LE never both fetch the same image
    // twice.
    keys.forEach(function(key){
      var thumbEl = document.getElementById('profileCoinThumb-' + key);
      if (!thumbEl) return;
      if (collectionThumbCache[key]){
        thumbEl.style.backgroundImage = 'url("' + collectionThumbCache[key] + '")';
        return;
      }
      apiWithRetry({ collection: key, skip: 0, limit: 1, sort: 'RARITY_ASC' }, 0).then(function(data){
        var img = data && data.items && data.items[0] && data.items[0].image;
        if (!img) return;
        collectionThumbCache[key] = img;
        var stillThere = document.getElementById('profileCoinThumb-' + key);
        if (stillThere) stillThere.style.backgroundImage = 'url("' + img + '")';
      }).catch(function(){});
    });
    // Real balance/trustline per collection — pigeonsAccountLine already
    // resolves whichever collection's real token config via getTradeConfig
    // server-side (see pigeons.js), so this is just the same call every
    // other trustline check on the site makes, once per coin that
    // actually has one.
    keys.forEach(function(key){
      var meta = COLLECTION_META[key];
      if (!meta.tokenIssuer) return;
      apiWithRetry({ pigeonsAccountLine: 1, wallet: MY_WALLET, collection: key }).then(function(line){
        var balEl = document.getElementById('profileCoinBalance-' + key);
        if (!balEl) return;
        if (line && line.hasTrustline === false){
          balEl.textContent = 'TRUSTL!NE N0T SET';
          balEl.classList.add('profile-coin-warn');
        } else if (line && line.hasTrustline){
          balEl.innerHTML = '<span class="hi">' + (line.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 2 }) + '</span> ' + escapeHtml(meta.tokenLabel);
          balEl.classList.remove('profile-coin-warn');
        } else {
          balEl.textContent = 'ERR://C0ULDN T CHECK BALANCE';
          balEl.classList.add('profile-coin-warn');
        }
      }).catch(function(){
        var balEl = document.getElementById('profileCoinBalance-' + key);
        if (balEl){ balEl.textContent = 'ERR://C0ULDN T CHECK BALANCE'; balEl.classList.add('profile-coin-warn'); }
      });
    });
  }
  // BUY opens the real swap panel; clicking anywhere else on a row jumps
  // to that collection's own DATABASE view — but only for P!GE0NS right
  // now. Every other collection is deliberately not reachable through the
  // UI anywhere else on the site yet (MAINFRAME/the DATABASE dropdown both
  // keep them inert) — a live link straight out of PR0F!LE would quietly
  // reopen that door from a third place. Revisit this gate together with
  // MAINFRAME's own once a second collection is actually re-enabled.
  el.profileCoinsList.addEventListener('click', function(e){
    var buyBtn = e.target.closest('.profile-coin-action[data-action="buy"]');
    if (buyBtn){
      e.stopPropagation();
      openBuySwapPanel();
      return;
    }
    var row = e.target.closest('.profile-coin-row');
    if (!row) return;
    var key = row.getAttribute('data-collection');
    if (key !== 'pigeons') return;
    if (key !== state.collection) switchCollection(key);
    showTab('database');
  });
  function loadProfilePanel(){
    renderProfileCoins();
    if (!MY_WALLET){
      el.profileCurrentWallet.textContent = '';
      el.profileCurrentUsername.textContent = 'C0NNECT Y0UR WALLET F!RST.';
      el.profileCurrentAvatar.innerHTML = '';
      el.profileUsernameInput.disabled = true;
      el.profileUsernameSaveBtn.disabled = true;
      el.profilePfpGrid.innerHTML = '';
      el.profilePfpStatus.style.display = '';
      el.profilePfpStatus.textContent = 'C0NNECT Y0UR WALLET F!RST.';
      return;
    }
    el.profileCurrentWallet.textContent = shortAddr(MY_WALLET);
    el.profileUsernameInput.disabled = false;
    el.profileUsernameSaveBtn.disabled = false;
    fetch('/api/profiles-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallets: [MY_WALLET] })
    }).then(function(r){ return r.json(); }).then(function(data){
      var profile = (data.profiles && data.profiles[MY_WALLET]) || null;
      profileCache[MY_WALLET] = profile;
      renderProfileCurrent(profile);
    }).catch(function(){});
    // myOwnPigeonsCache (see loadMyOwnPigeonsCache) is the same real
    // owned-Pigeons list the FL0CK tab and OFFER F0R's own picker already
    // use — reused here rather than a separate fetch, but PR0F!LE can be
    // the very first tab opened this session, so this still has to kick
    // the fetch off itself rather than assuming it's already in flight.
    if (myOwnPigeonsCache !== null){
      renderProfilePfpGrid(myOwnPigeonsCache);
    } else {
      el.profilePfpGrid.innerHTML = '';
      el.profilePfpStatus.style.display = '';
      el.profilePfpStatus.textContent = 'L0AD!NG Y0UR P!GE0NS...';
      loadMyOwnPigeonsCache().then(function(items){
        if (el.profilePanelWrap.style.display !== 'none') renderProfilePfpGrid(items);
      });
    }
  }
  function renderProfileCurrent(profile){
    el.profileCurrentAvatar.innerHTML = (profile && profile.pfpImage) ? '<img src="' + escapeHtml(profile.pfpImage) + '" alt="">' : '';
    el.profileCurrentUsername.textContent = (profile && profile.username) ? profile.username : 'N0 USERNAME SET';
    profileSelectedPfpNftId = (profile && profile.pfpNftId) || null;
    highlightSelectedPfpCard();
  }
  function renderProfilePfpGrid(items){
    if (!items.length){
      el.profilePfpStatus.style.display = '';
      el.profilePfpStatus.textContent = 'Y0U D0N T 0WN ANY P!GE0NS YET.';
      el.profilePfpGrid.innerHTML = '';
      return;
    }
    el.profilePfpStatus.style.display = 'none';
    el.profilePfpGrid.innerHTML = items.map(function(p){
      return '<div class="simple-picker-card' + (p.nftId === profileSelectedPfpNftId ? ' simple-picker-card-selected' : '') + '" data-nftid="' + escapeHtml(p.nftId) + '">' +
        '<div class="simple-picker-card-img profile-pfp-pick" data-nftid="' + escapeHtml(p.nftId) + '">' + (p.image ? '<img src="' + escapeHtml(p.image) + '" alt="" loading="lazy">' : '') + '</div>' +
        '<div class="simple-picker-card-num">P!GE0N #' + (p.number !== null ? greenNum(p.number) : '????') + '</div>' +
      '</div>';
    }).join('');
  }
  function highlightSelectedPfpCard(){
    var cards = el.profilePfpGrid.querySelectorAll('.simple-picker-card');
    cards.forEach(function(card){
      card.classList.toggle('simple-picker-card-selected', card.getAttribute('data-nftid') === profileSelectedPfpNftId);
    });
  }
  el.profilePfpGrid.addEventListener('click', function(e){
    var pick = e.target.closest('.profile-pfp-pick');
    if (!pick) return;
    var nftId = pick.getAttribute('data-nftid');
    if (nftId === profileSelectedPfpNftId) return;
    // Instant feedback the moment you click — a "picking" state right on
    // that card (dimmed + :: SETT!NG..., see the CSS) — instead of the
    // grid just sitting there unchanged until the save request happens to
    // come back.
    var card = el.profilePfpGrid.querySelector('.simple-picker-card[data-nftid="' + nftId + '"]');
    if (card) card.classList.add('simple-picker-card-picking');
    el.profilePfpStatus.style.display = '';
    el.profilePfpStatus.textContent = 'SETT!NG PR0F!LE P!C...';
    fetch('/api/profile-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pfpNftId: nftId })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      if (card) card.classList.remove('simple-picker-card-picking');
      if (!res.ok || !res.data.ok){
        el.profilePfpStatus.style.display = '';
        el.profilePfpStatus.textContent = listingErrorMessage(res.data && res.data.error);
        return;
      }
      el.profilePfpStatus.style.display = 'none';
      renderProfileCurrent(res.data.profile);
      // Every .wallet-tag already on screen showing THIS wallet's old
      // avatar (or none) needs the new one right away, not just the
      // profile panel itself — same live-patch resolver every other
      // address display already goes through.
      profileCache[MY_WALLET] = { username: res.data.profile.username || null, pfpImage: res.data.profile.pfpImage || null };
      applyResolvedProfiles([MY_WALLET]);
    }).catch(function(){
      if (card) card.classList.remove('simple-picker-card-picking');
      el.profilePfpStatus.style.display = '';
      el.profilePfpStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });
  el.profileUsernameSaveBtn.addEventListener('click', function(){
    var username = el.profileUsernameInput.value.trim();
    var usernamePattern = /^[A-Za-z0-9_\\p{Extended_Pictographic}\\u{1F1E6}-\\u{1F1FF}\\u{1F3FB}-\\u{1F3FF}\\u200D\\uFE0F]+$/u;
    if (!usernamePattern.test(username) || [...username].length > 20){
      el.profileUsernameStatus.textContent = 'USERNAME MUST BE LETTERS, NUMBERS, UNDERSC0RES 0R EM0J!, UP T0 20 CHARACTERS.';
      return;
    }
    el.profileUsernameSaveBtn.disabled = true;
    el.profileUsernameSaveBtn.textContent = 'SAV!NG...';
    el.profileUsernameStatus.textContent = '';
    fetch('/api/profile-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username })
    }).then(function(r){ return r.json().then(function(data){ return { ok: r.ok, data: data }; }); })
    .then(function(res){
      el.profileUsernameSaveBtn.disabled = false;
      el.profileUsernameSaveBtn.textContent = 'SAVE';
      if (!res.ok || !res.data.ok){
        el.profileUsernameStatus.textContent = (res.data && res.data.error === 'username_taken')
          ? 'TH!S USERNAME !S ALREADY TAKEN.'
          : listingErrorMessage(res.data && res.data.error);
        return;
      }
      el.profileUsernameInput.value = '';
      el.profileUsernameStatus.textContent = 'SAVED.';
      renderProfileCurrent(res.data.profile);
      profileCache[MY_WALLET] = { username: res.data.profile.username || null, pfpImage: res.data.profile.pfpImage || null };
      applyResolvedProfiles([MY_WALLET]);
    }).catch(function(){
      el.profileUsernameSaveBtn.disabled = false;
      el.profileUsernameSaveBtn.textContent = 'SAVE';
      el.profileUsernameStatus.textContent = 'ERR://S!GNAL_L0ST — TRY AGA!N.';
    });
  });
  // Same reasoning as shortAddr, for a 64-char tx hash — reported live as
  // making the SETTLED receipt read as cluttered/too small. The full hash
  // is still there, just as the real link target (bithomp), not spelled
  // out in the visible text.
  function shortHash(hash){
    return hash ? hash.slice(0, 10) + '...' + hash.slice(-6) : '—';
  }
  // Toggles the pulse (see .waiting-status-line.pulsing in the CSS) on
  // BUY N0W/ACCEPT 0FFER/CANCEL's own waiting-for-signature line — only
  // ever on while genuinely still waiting on something; a final error or
  // "SETTLED" line stops pulsing since there's nothing left to wait on.
  function setWaitingPulse(lineEl, on){
    lineEl.classList.toggle('pulsing', !!on);
  }
  // Shared by ACCEPT OFFER's confirm + result screens — a real, on-ledger,
  // per-NFT royalty (see applyNftRoyalty in _shared.js), separate from
  // Σκύλλα's own marketplace fee. Most tokens carry none at all, so this
  // row only shows up when royaltyPercent is actually nonzero, right above
  // whichever "you receive"/"seller received" row is the real final
  // number.
  function showRoyaltyRow(rowEl, labelEl, valueEl, royaltyValue, royaltyPercent){
    var percent = Number(royaltyPercent) || 0;
    if (!percent){
      rowEl.style.display = 'none';
      return;
    }
    labelEl.textContent = 'NFT R0YALTY (' + percent + '%)';
    valueEl.textContent = fmtPigeons(royaltyValue);
    rowEl.style.display = '';
  }
  // Bare K/M-compacted number, no unit — shared by fmtPigeonsCompact below
  // (BUY N0W) and the "L!ST!NG :: 444K" own-listing labels (pigeonsAction-
  // BoxHtml/updateScyllaListing), which don't want the "$P!GE0NS" suffix
  // repeated since those boxes are already purple-themed as $PIGEONS.
  function compactPigeonsNumber(n){
    var num = typeof n === 'string' ? Number(n) : n;
    num = num || 0;
    var abs = Math.abs(num);
    if (abs >= 1000000) return (num / 1000000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' M!LL!0N';
    if (abs >= 1000) return (num / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K';
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  // Real XRPL NFTokenCreateOffer Expiration (ripple-epoch seconds, see
  // listingExpirationRippleSeconds in _shared.js) rendered as a plain
  // countdown — computed fresh at render time (card HTML is rebuilt on
  // every query/scroll-append anyway), not a live per-card ticking
  // timer. '' for a listing with no expiration (shouldn't happen for
  // anything listed through this flow any more, but old pre-this-
  // feature listings can still be missing one).
  var RIPPLE_EPOCH_OFFSET_SECONDS = 946684800;
  function listingCountdownText(expiration){
    if (!expiration) return '';
    var msLeft = (expiration + RIPPLE_EPOCH_OFFSET_SECONDS) * 1000 - Date.now();
    if (msLeft <= 0) return 'EXP!RED';
    var days = Math.floor(msLeft / 86400000);
    if (days > 0) return 'EXP!RES !N ' + days + 'D ' + Math.floor((msLeft % 86400000) / 3600000) + 'H';
    var hours = Math.floor(msLeft / 3600000);
    if (hours > 0) return 'EXP!RES !N ' + hours + 'H ' + Math.floor((msLeft % 3600000) / 60000) + 'M';
    return 'EXP!RES !N ' + Math.max(1, Math.floor(msLeft / 60000)) + 'M';
  }
  // Compact K/M form, BUY N0W button only — every OTHER $PIGEONS amount
  // on the site (confirm/result screens, fee breakdowns, sale stats)
  // still needs its exact full value via fmtPigeons above; this is
  // purely a display cleanup for the one place a long comma-grouped
  // number was cluttering a small button ("BUY N0W :: 123K $P!GE0NS").
  function fmtPigeonsCompact(n){
    return compactPigeonsNumber(n) + ' ' + COLLECTION_META[state.collection].tokenLabel;
  }
  // Display-only mirror of computeMarketplaceFee() in _shared.js (1.023%)
  // — no active caller right now (myPigeonOffersHtml's own fee-breakdown
  // line was dropped, "for now" per an explicit request — the real
  // ACCEPT 0FFER confirm screen still shows this exact math right before
  // signing, via the server's own computeMarketplaceFee independently,
  // not this function). Left in place rather than deleted in case the
  // per-card line comes back. Never authoritative even when used: the
  // server independently recomputes this from the real on-ledger offer
  // amount before building any transaction, and rejects anything that
  // doesn't match. This mirrors ACCEPT 0FFER's own reduction-style math
  // specifically (buyer's amount fixed, seller's cut reduced) — LIST/BUY
  // N0W now work the opposite way (seller's price untouched, buyer pays a
  // markup instead), computed server-side only, no client mirror exists
  // for that direction.
  function clientMarketplaceFee(totalValueStr){
    var total = Number(totalValueStr);
    if (!isFinite(total) || total <= 0) return null;
    var feeValue = Math.floor(total * 1e6 * 1023 / 100000) / 1e6;
    return { totalValue: total, feeValue: feeValue, sellerValue: total - feeValue };
  }
  function loadCollectionStats(){
    api({ stats: 1 }).then(function(data){
      el.statItems.textContent = data.items !== null && data.items !== undefined ? data.items.toLocaleString() : '—';
      el.statHolders.textContent = data.holders !== null && data.holders !== undefined ? data.holders.toLocaleString() : '—';
      el.statVolume.textContent = data.totalVolumeXrp !== null && data.totalVolumeXrp !== undefined ? fmtXrp(data.totalVolumeXrp) + ' XRP' : '—';
      el.statListed.textContent = data.listedPercent !== null && data.listedPercent !== undefined ? data.listedPercent + '%' : '—';
      el.statFloorDeeptide.textContent = data.deeptideFloorXrp !== null && data.deeptideFloorXrp !== undefined ? fmtXrp(data.deeptideFloorXrp) + ' XRP' : '—';
      el.statFloorXrpCafe.textContent = data.xrpCafeFloorXrp !== null && data.xrpCafeFloorXrp !== undefined ? fmtXrp(data.xrpCafeFloorXrp) + ' XRP' : '—';
      if (data.deeptideBuyUrl) el.statFloorDeeptideTile.href = data.deeptideBuyUrl;
      if (data.xrpCafeUrl) el.statFloorXrpCafeTile.href = data.xrpCafeUrl;
      el.statScyllaListedCount.innerHTML = data.scyllaFloorPigeons !== null && data.scyllaFloorPigeons !== undefined ? greenNum(data.scyllaFloorPigeons.toLocaleString()) + ' ' + COLLECTION_META[state.collection].tokenLabel : 'N0T L!STED';
      el.statTraded24h.textContent = data.traded24hCount !== null && data.traded24hCount !== undefined ? data.traded24hCount.toLocaleString() : '—';
      el.statVolume24h.textContent = data.volume24hXrp !== null && data.volume24hXrp !== undefined ? fmtXrp(data.volume24hXrp) + ' XRP' : '—';
      el.statSales24h.textContent = data.sales24hCount !== null && data.sales24hCount !== undefined ? data.sales24hCount.toLocaleString() : '—';
      // Real numbers can wrap/size slightly differently than the "…"
      // placeholders — resync the viewport height (see
      // syncStatsViewportHeight in the carousel IIFE below) now that the
      // active page's real content is in.
      var activeStatsPage = el.statsCarousel.querySelector('.stats-page-active');
      var statsViewportEl = el.statsCarousel.querySelector('.stats-carousel-viewport');
      if (activeStatsPage && statsViewportEl) statsViewportEl.style.height = activeStatsPage.scrollHeight + 'px';
    }).catch(function(){});
  }
  // Auto-rotating stats strip — FLOOR PRICES, then ITEMS/HOLDERS/VOLUME/
  // LISTED, then 24H ACTIVITY, cycling on a timer so this area stays one
  // compact strip instead of three stacked bars. Real slide transition
  // (not an instant display swap), and now genuinely bidirectional — the
  // ◂ / ▸ arrows step manually in either direction, sliding from the
  // correct side, and reset the auto-rotate timer so a manual click
  // isn't immediately undone by the next tick.
  (function(){
    var pages = el.statsCarousel.querySelectorAll('.stats-page');
    var dots = el.statsCarouselDots.querySelectorAll('.stats-dot');
    var viewport = el.statsCarousel.querySelector('.stats-carousel-viewport');
    var current = 0;
    var autoTimer = null;
    // Sized to whatever page is actually active, not a fixed guess — no
    // dead space between the tiles and the dots on the shorter pages.
    function syncStatsViewportHeight(){
      viewport.style.height = pages[current].scrollHeight + 'px';
    }
    syncStatsViewportHeight();
    window.addEventListener('resize', syncStatsViewportHeight);
    function gotoStatsPage(newIndex, direction){
      if (newIndex === current) return;
      var outgoing = pages[current];
      var incoming = pages[newIndex];
      dots[current].classList.remove('active');
      dots[newIndex].classList.add('active');
      if (direction === -1){
        // Instantly park the incoming page off to the left (no transition)
        // before animating it in, so it enters from the correct side.
        incoming.classList.add('stats-page-park-left');
        void incoming.offsetWidth; // force reflow so the park actually applies before it's removed
        incoming.classList.remove('stats-page-park-left');
      }
      outgoing.classList.remove('stats-page-active');
      outgoing.classList.add(direction === 1 ? 'stats-page-prev' : 'stats-page-exit-right');
      incoming.classList.add('stats-page-active');
      current = newIndex;
      syncStatsViewportHeight();
      setTimeout(function(){
        outgoing.classList.remove('stats-page-prev', 'stats-page-exit-right');
      }, 500);
    }
    function startAutoRotate(){
      autoTimer = setInterval(function(){ gotoStatsPage((current + 1) % pages.length, 1); }, 10000);
    }
    el.statsNextBtn.addEventListener('click', function(){
      gotoStatsPage((current + 1) % pages.length, 1);
      clearInterval(autoTimer);
      startAutoRotate();
    });
    el.statsPrevBtn.addEventListener('click', function(){
      gotoStatsPage((current - 1 + pages.length) % pages.length, -1);
      clearInterval(autoTimer);
      startAutoRotate();
    });
    startAutoRotate();
  })();
  el.statSalesTile.addEventListener('click', function(){
    state.activeTab = 'sales';
    showScreen('browse');
  });
  // BURNS aren't live-tracked anywhere in this codebase yet — the count
  // shown is a manually-set figure, not a real crawl. The burn LIST this
  // links to doesn't exist yet either (a later system) — this click note
  // makes that honest instead of implying a broken link.
  el.statBurntLink.addEventListener('click', function(){
    alert('BURN L!ST C0M!NG S00N — C0UNT !S MANUALLY SET F0R N0W.');
  });

  // ---- Σκύλλα LISTED filter — toggled from the stat tile, or implicitly
  // by picking a $PIGEONS sort option (the only sort that means anything
  // in this view). Whole-collection only, per its own scope — exits any
  // target-wallet scope first. ----
  function setScyllaListedOnly(on){
    // FL0CK only ever shows your own Pigeons, no exceptions — this is a
    // whole-COLLECTION filter (see the comment above), reachable from
    // FL0CK too now that the stats carousel/SORT BY panel are shown on
    // every tab. Land on DATABASE first instead of quietly leaking the
    // full collection into what's still nominally the FL0CK tab.
    if (on && state.activeTab === 'mypigeons') showTab('database');
    state.scyllaListedOnly = on;
    el.statScyllaListedTile.classList.toggle('scylla-active', on);
    if (on){
      if (state.sort !== 'SCYLLA_PRICE_ASC' && state.sort !== 'SCYLLA_PRICE_DESC'){
        // Highest-first is the default entry into LISTED — the main
        // attraction of the site, not a niche filter.
        state.sort = 'SCYLLA_PRICE_DESC';
        renderSortTag();
      }
      if (state.scope){
        state.scope = null;
        state.scopeAllItems = [];
        state.targetAssets = {};
        el.nodeHeaderPanel.style.display = 'none';
        refreshSearchPanelSubtitle();
        renderTradeBuilder();
      }
    } else if (state.sort === 'SCYLLA_PRICE_ASC' || state.sort === 'SCYLLA_PRICE_DESC'){
      state.sort = 'RARITY_ASC';
      renderSortTag();
    }
    runQuery();
  }
  el.statScyllaListedTile.addEventListener('click', function(){
    setScyllaListedOnly(!state.scyllaListedOnly);
  });

  // ---- Initial load ----
  // The trade builder's 4+4 empty slots are only ever drawn by
  // renderTradeBuilder(), which every other call site reaches through a
  // state change (adding/removing a Pigeon, entering/exiting a scope) —
  // on a fresh page load none of those have fired yet, so without this
  // call the piles start out completely empty instead of showing slots.
  renderTradeBuilder();

  if (!SWAP_BUILDER_ENABLED){
    el.tradeBuilderPanel.style.display = 'none';
  }
  // SWAP NFT TRADE DETAILS (V1 CREATE OFFER) — real, working, wired to
  // the real swap-offer-* backend, paused for launch — see
  // CREATE_OFFER_ENABLED's own comment for why. SWAP OFFERS is this
  // feature's own tab (reciprocate/accept a real pending swap), so it's
  // gated the same way, separately from SWAP_BUILDER_ENABLED's own
  // tradeBuilderPanel/per-card offer-toggle above.
  if (!CREATE_OFFER_ENABLED){
    // Whole box hidden now (was: stay visible showing a C0M!NG S00N
    // message) — same full-hide treatment as SWAP_BUILDER_ENABLED's own
    // tradeBuilderPanel above. Nothing removed, just gated; flip
    // CREATE_OFFER_ENABLED back to true to bring the real box back
    // exactly as it was (simpleOfferLive/simpleOfferComingSoon still both
    // exist and still work, this just stops showing either one).
    el.simpleOfferPanel.style.display = 'none';
    el.swapOffersTabBtn.style.display = 'none';
  }
  // Re-measure now that SWAP 0FFERS may have just been hidden above —
  // the very first updateTopTabsFade() call (right after the tab strip's
  // own click handler is wired) runs before this gate, so it could over-
  // count real overflow while that tab was still in the layout.
  updateTopTabsFade();

  // DATABASE's own + toggle (SWAP_BUILDER_ENABLED false) redirects here
  // with ?offerFor=<nftId>&offerForNum=&offerForImg=&offerForOwner= —
  // pre-fill CREATE OFFER's 0FFER F0R slot with that Pigeon before MY
  // PIGEONS/PλWS is shown, same simple regex param read as the
  // connected=1 check below (no URLSearchParams elsewhere in this file,
  // kept consistent).
  var offerForMatch = window.location.search.match(/[?&]offerFor=([^&]+)/);
  if (offerForMatch){
    var offerForNumMatch = window.location.search.match(/[?&]offerForNum=([^&]+)/);
    var offerForImgMatch = window.location.search.match(/[?&]offerForImg=([^&]+)/);
    var offerForOwnerMatch = window.location.search.match(/[?&]offerForOwner=([^&]+)/);
    state.simpleOffer.theirs = {
      nftId: decodeURIComponent(offerForMatch[1]),
      number: offerForNumMatch ? parseInt(decodeURIComponent(offerForNumMatch[1]), 10) : null,
      image: offerForImgMatch && offerForImgMatch[1] ? decodeURIComponent(offerForImgMatch[1]) : null,
      owner: offerForOwnerMatch && offerForOwnerMatch[1] ? decodeURIComponent(offerForOwnerMatch[1]) : null
    };
    renderSimpleOffer();
  }

  // A return from the CONNECT SCYLLA redirect always lands on MY PIGEONS —
  // that's where your pigeons and any received offers actually are; any
  // other fresh page load (a plain refresh) shows MA!NFRAME instead of
  // jumping straight into DATABASE — a mid-flow return (Xaman login, a
  // pending BUY) means the user's already committed to a specific
  // collection/action, so those two skip the landing page entirely.
  if (window.location.search.indexOf('connected=1') !== -1 || offerForMatch){
    showTab('mypigeons');
    // Strip the query param right after using it once — otherwise it
    // stays in the address bar and every later refresh keeps landing on
    // this same tab (or re-applying a stale 0FFER F0R pick) instead of
    // the real default.
    window.history.replaceState({}, '', window.location.pathname);
  } else {
    el.screenMainframe.style.display = 'flex';
  }

  // The other half of openBuyConfirm's own "not logged in" redirect (see
  // its own comment) — a real MY_WALLET here means this load is either
  // fresh or a return from that same login, so it's safe to just always
  // check: harmless no-op whenever nothing's pending. Fetches the real
  // Pigeon (same api({detail}) call openDetail uses — nothing in
  // state.items/scopeAllItems is guaranteed to hold it yet on a fresh
  // load) rather than trusting anything cached from before the redirect.
  (function resumePendingBuy(){
    var pendingNftId = null;
    try { pendingNftId = sessionStorage.getItem(PENDING_BUY_STORAGE_KEY); } catch (e){}
    if (!pendingNftId) return;
    try { sessionStorage.removeItem(PENDING_BUY_STORAGE_KEY); } catch (e){}
    if (!MY_WALLET) return;
    api({ detail: pendingNftId }).then(function(data){
      if (data && data.item) openBuyConfirm(data.item);
    }).catch(function(){});
  })();

  // TV static background, purely atmospheric — matches the rest of the
  // site. Same draw loop run three times: the permanent page-level
  // canvas, plus one each for the detail screen and fullscreen lightbox
  // (see .local-static-bg) — those two are their own opaque full-
  // viewport boxes now, so each needs this drawn locally rather than
  // relying on seeing the page's own copy through transparency (that
  // just revealed the real page underneath, not a background texture).
  // isVisible is skipped (and the pixel buffer work with it) while that
  // screen is hidden — checked live against the real element each frame
  // rather than cached, since display gets toggled from many places.
  function startStaticCanvas(canvas, isVisible){
    var ctx = canvas.getContext('2d');
    function resize(){
      canvas.width = Math.max(1, Math.floor(window.innerWidth / 3));
      canvas.height = Math.max(1, Math.floor(window.innerHeight / 3));
    }
    resize();
    window.addEventListener('resize', resize);
    function drawStatic(){
      var w = canvas.width, h = canvas.height;
      var imageData = ctx.createImageData(w, h);
      var buffer = imageData.data;
      for (var i = 0; i < buffer.length; i += 4){
        var shade = Math.random() * 255;
        buffer[i] = shade; buffer[i+1] = shade; buffer[i+2] = shade; buffer[i+3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
    }
    function loop(){
      if (!isVisible || isVisible()) drawStatic();
      requestAnimationFrame(loop);
    }
    loop();
  }
  // Shareable Pigeon link — ?pigeon=<number> jumps straight to that
  // Pigeon's detail screen on load, instead of requiring whoever clicks a
  // shared link to search for it themselves. Runs after everything else
  // above (openDetail, api, showScreen) is already defined. Silently
  // no-ops on a bad/unindexed number rather than showing an error page —
  // worst case the visitor just lands on the normal DATABASE view.
  (function(){
    var num = parseInt(new URLSearchParams(window.location.search).get('pigeon'), 10);
    if (!num || num < 1) return;
    api({ number: num }).then(function(data){
      var item = data.items && data.items[0];
      if (item) openDetail(item.nftId);
    }).catch(function(){});
  })();
  startStaticCanvas(document.getElementById('staticBg'));
  startStaticCanvas(document.getElementById('detailStaticBg'), function(){
    return document.getElementById('screenDetail').style.display !== 'none';
  });
  startStaticCanvas(document.getElementById('lightboxStaticBg'), function(){
    return document.getElementById('detailLightbox').style.display !== 'none';
  });
  startStaticCanvas(document.getElementById('mainframeStaticBg'), function(){
    return document.getElementById('screenMainframe').style.display !== 'none';
  });

})();
</script>
</body>
</html>`;

export async function onRequestGet(context) {
  const { request, env } = context;
  let wallet = null;
  if (env.Σκύλλα) {
    const token = getCookie(request, BOARD_COOKIE_NAME);
    if (token) {
      const payload = await verifyToken(token, env.Σκύλλα);
      if (payload && payload.acct) wallet = payload.acct;
    }
  }
  const html = SWAP_HTML.replace('"__SWAP_WALLET__"', JSON.stringify(wallet));
  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
