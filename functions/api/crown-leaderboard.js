import { getSwapSalesLog } from '../_shared.js';

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

// CR0WN — real $PIGEONS trading profit/loss, wallets ranked by net flow.
// "Profit" here is realized only: for each wallet, everything it took in
// as a SELLER minus everything it paid out as a BUYER, across real settled
// sales in the window (BUY N0W + ACCEPT 0FFER, both $PIGEONS-denominated —
// see recordSwapSale's own call sites). This deliberately does NOT value
// Pigeons a wallet still holds — a wallet that bought and hasn't sold yet
// shows as negative here even if what it holds is worth more now, since
// that gain/loss was never actually realized through a $PIGEONS trade.
// Source data is SWAP_SALES_LOG_KEY (functions/_shared.js), a capped
// (300-entry) newest-first log — good enough for a weekly view at current
// volume, but a month with more than 300 total site-wide sales would start
// losing its oldest entries off the back before this ever sees them. No
// leaderboard math beyond this file assumes otherwise; revisit the log's
// own cap (see its comment) if volume ever gets there.
const LEADERBOARD_MAX = 50;

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get('period') === 'month' ? 'month' : 'week';
  const windowMs = (period === 'month' ? 30 : 7) * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - windowMs;

  const log = await getSwapSalesLog(env.coin);
  const inWindow = log.filter(entry => {
    const t = entry.createdAt ? Date.parse(entry.createdAt) : NaN;
    return !isNaN(t) && t >= cutoff;
  });

  const byWallet = {};
  function walletRow(wallet) {
    return byWallet[wallet] || (byWallet[wallet] = { wallet, sellTotal: 0, buyTotal: 0, tradeCount: 0 });
  }
  inWindow.forEach(entry => {
    const value = parseFloat(entry.priceValue);
    if (!isFinite(value)) return;
    if (entry.seller) {
      const row = walletRow(entry.seller);
      row.sellTotal += value;
      row.tradeCount += 1;
    }
    if (entry.buyer) {
      const row = walletRow(entry.buyer);
      row.buyTotal += value;
      row.tradeCount += 1;
    }
  });

  const items = Object.values(byWallet)
    .map(row => ({
      wallet: row.wallet,
      walletShort: shortenAddr(row.wallet),
      netProfit: row.sellTotal - row.buyTotal,
      sellTotal: row.sellTotal,
      buyTotal: row.buyTotal,
      tradeCount: row.tradeCount
    }))
    .sort((a, b) => b.netProfit - a.netProfit)
    .slice(0, LEADERBOARD_MAX);

  return new Response(JSON.stringify({ period, items, generatedAt: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
