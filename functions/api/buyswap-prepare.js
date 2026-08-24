import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, quotePigeonsForXrpDrops, fetchPigeonsAccountLine,
  fetchXrpBalanceDrops, encodeCurrencyCode, PIGEONS_TOKEN_CONFIG, swapOfferSourceMemo
} from '../_shared.js';

// BUY $PIGEONS swap — STAGE 5: builds and returns the exact Payment
// txjson, for the review screen to display and the user to inspect
// BEFORE anything ever reaches Xaman. No signing/submission here at all.
//
// Mechanism: a same-account "currency conversion" Payment (Account ===
// Destination === the buyer's own wallet) — XRPL's own documented pattern
// for converting one currency to another on-ledger, not an OfferCreate
// (which only rests/crosses an order, never guaranteed to execute fully
// or immediately) and not a hand-built Paths array (rippled's own default
// pathfinding already auto-routes through BOTH the order book and any
// AMM pool since the AMM amendment, without needing an explicit Paths
// field — the same combined liquidity quotePigeonsForXrpDrops already
// checks).
//
// Slippage protection is atomic, not a post-hoc check: Amount is set to
// the slippage-adjusted MINIMUM PIGEONS the user will accept (never the
// live estimate), SendMax is set to the EXACT XRP the user typed (never
// more), and tfPartialPayment is deliberately NOT set. Per XRPL's own
// Payment semantics, that combination means the transaction either
// delivers AT LEAST the full Amount for AT MOST SendMax, or fails
// atomically with no funds moved at all — there is no partial-fill case
// to worry about, and the user can never spend more than they entered.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα || !env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  const token = getCookie(request, BOARD_COOKIE_NAME);
  if (!token) {
    return new Response(JSON.stringify({ error: 'no_session' }), { status: 401 });
  }
  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return new Response(JSON.stringify({ error: 'invalid_session' }), { status: 401 });
  }
  const buyer = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  // The XRP amount is the only thing trusted from the client at all, and
  // even that only as a REQUEST — everything that actually goes into the
  // txjson (the quote, the trustline check, the balance check) is
  // re-derived fresh from real ledger/liquidity state below, never taken
  // on the client's word.
  const xrpDrops = body && body.xrpDrops;
  if (typeof xrpDrops !== 'string' || !/^[1-9][0-9]*$/.test(xrpDrops)) {
    return new Response(JSON.stringify({ error: 'bad_amount' }), { status: 400 });
  }

  // Real live trustline check — a client-side gate already exists (Stage
  // 4), but the server must never trust that the browser actually
  // enforced it. Delivering PIGEONS to a wallet with no trustline would
  // just fail on-ledger, but this catches it before ever asking the user
  // to sign anything.
  const line = await fetchPigeonsAccountLine(buyer);
  if (!line || line.hasTrustline !== true) {
    return new Response(JSON.stringify({ error: 'no_trustline' }), { status: 400 });
  }

  // Real live balance check — same 2 XRP reserve-buffer reasoning as the
  // client-side cap (Stage 2), re-verified server-side rather than
  // trusted from the browser.
  const balanceDrops = await fetchXrpBalanceDrops(buyer);
  if (balanceDrops === null) {
    return new Response(JSON.stringify({ error: 'balance_lookup_failed' }), { status: 503 });
  }
  const RESERVE_BUFFER_DROPS = 2000000n;
  let xrpDropsBig, balanceBig;
  try { xrpDropsBig = BigInt(xrpDrops); balanceBig = BigInt(balanceDrops); } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_amount' }), { status: 400 });
  }
  if (xrpDropsBig > balanceBig - RESERVE_BUFFER_DROPS) {
    return new Response(JSON.stringify({ error: 'exceeds_balance' }), { status: 400 });
  }

  // Fresh quote — the one shown on the panel a moment ago is never reused
  // here; liquidity moves between quote and prepare, and re-deriving from
  // scratch is the same "never trust a stale client-side number" rule
  // every other transaction-prep endpoint in this app already follows.
  const quote = await quotePigeonsForXrpDrops(xrpDrops);
  if (!quote.ok) {
    return new Response(JSON.stringify({ error: quote.insufficientLiquidity ? 'insufficient_liquidity' : 'quote_failed' }), { status: 400 });
  }

  const SLIPPAGE_BPS = 50; // 0.5% — matches the panel's own SL!PPAGE figure
  // Floor (never round up) — a minimum requirement must never come out
  // stricter than the true 99.5% floor by rounding error.
  const minReceivePigeons = Math.floor(quote.receivePigeons * (10000 - SLIPPAGE_BPS) / 10000 * 1e6) / 1e6;
  if (!(minReceivePigeons > 0)) {
    return new Response(JSON.stringify({ error: 'quote_failed' }), { status: 400 });
  }
  const minReceiveStr = minReceivePigeons.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');

  const txjson = {
    TransactionType: 'Payment',
    Account: buyer,
    Destination: buyer,
    Amount: {
      currency: encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency),
      issuer: PIGEONS_TOKEN_CONFIG.issuer,
      value: minReceiveStr
    },
    SendMax: xrpDrops,
    Memos: swapOfferSourceMemo()
  };

  return new Response(JSON.stringify({
    ok: true,
    txjson,
    display: {
      xrpDrops,
      minReceivePigeons: minReceiveStr,
      estimateReceivePigeons: quote.receivePigeons,
      rate: quote.rate,
      source: quote.source
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
