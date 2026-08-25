import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, getIncomingTransfersMap, removeIncomingTransfer,
  fetchNftSellOffersOrNull, fetchDeeptideNftDetail
} from '../_shared.js';

function shortenAddr(addr) {
  return addr ? addr.slice(0, 9) + '...' + addr.slice(-4) : null;
}

// FL0CK's "NFT 0FFERED T0 Y0U" box — every real TRANSFER sell-offer
// (Amount "0", Destination-restricted) sent to the signed-in wallet that's
// still genuinely live. The tracked index (addIncomingTransfer, written by
// swap-offer-status.js the moment the sender's offer confirms) only ever
// says "worth checking" — same self-healing pattern as the listings/
// buy-offers maps: a live nft_sell_offers lookup per candidate is what's
// actually trusted, so an offer the recipient already accepted (or the
// sender cancelled) silently drops out here and gets pruned from the
// index, instead of showing a dead ACCEPT button.
export async function onRequestGet(context) {
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
  const recipient = payload.acct;

  const map = await getIncomingTransfersMap(env.coin);
  const candidates = map[recipient] || [];

  const results = await Promise.all(candidates.map(async entry => {
    // null (lookup itself failed) must never be read as "gone" — the exact
    // false-negative class of bug the DELIST fix elsewhere in this file
    // guards against; treating a transient rate-limit as "no longer
    // pending" would silently hide a real incoming transfer.
    const offers = await fetchNftSellOffersOrNull(entry.nftId);
    if (offers === null) return { entry, live: null };
    const stillLive = offers.some(o => o.nft_offer_index === entry.offerId && o.destination === recipient && o.amount === '0');
    if (!stillLive) {
      context.waitUntil(removeIncomingTransfer(env.coin, recipient, entry.offerId));
      return { entry, live: false };
    }
    return { entry, live: true };
  }));

  const liveEntries = results.filter(r => r.live).map(r => r.entry);
  const items = await Promise.all(liveEntries.map(async entry => {
    const item = await fetchDeeptideNftDetail(entry.nftId);
    return {
      nftId: entry.nftId,
      offerId: entry.offerId,
      fromWallet: entry.fromWallet,
      fromWalletShort: shortenAddr(entry.fromWallet),
      createdAt: entry.createdAt || null,
      number: item ? item.number : null,
      image: item ? item.image : null
    };
  }));

  return new Response(JSON.stringify({ items }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
