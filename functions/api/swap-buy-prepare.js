import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, fetchNftSellOffersOrNull, findPigeonsOffer,
  PIGEONS_TOKEN_CONFIG, encodeCurrencyCode, swapOfferSourceMemo, computeMarketplaceMarkup,
  MARKETPLACE_BROKER_WALLET
} from '../_shared.js';

// Σκύλλα SWAP — BUY NOW. Builds and returns a txjson for the confirmation
// screen. Everything comes from a FRESH nft_sell_offers lookup — the live
// offer is the sole source of truth for the offer ID, seller, and
// on-ledger amount, which (since LIST no longer reduces it — see
// swap-listing-prepare.js) is now also directly the real listed price, no
// separate index needed just to recover it.
//
// A LIST-time sell offer is Destination-restricted to the broker wallet —
// so a direct NFTokenAcceptOffer by the buyer is no longer possible
// (Destination blocks it) and would skip the fee even if it were. Instead
// the buyer creates a matching real $PIGEONS BUY offer for the listed
// price PLUS the marketplace's markup; once that lands on-ledger,
// swap-buy-status.js automatically submits the brokered accept that
// settles both sides atomically and routes the fee (NFTokenBrokerFee) —
// mirroring the exact pattern already proven by MAKE OFFER + ACCEPT OFFER,
// just with the seller's leg already sitting on-ledger from LIST time
// instead of being signed live. Net effect for the buyer: still just one
// signature.
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.Σκύλλα) {
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

  const nftId = body && body.nftId;
  if (!nftId || typeof nftId !== 'string' || !/^[0-9A-Fa-f]{64}$/.test(nftId)) {
    return new Response(JSON.stringify({ error: 'invalid_nft_id' }), { status: 400 });
  }

  // null (lookup itself failed, e.g. xrplcluster.com rate-limited) must
  // never be reported as "not listed" — confirmed live, that intermittent
  // mislabeling is exactly what made a genuinely-listed Pigeon randomly
  // fail to open. lookup_failed is retryable; not_listed is not.
  const offers = await fetchNftSellOffersOrNull(nftId);
  if (offers === null) {
    return new Response(JSON.stringify({ error: 'lookup_failed' }), { status: 503 });
  }
  // The Σκύλλα $PIGEONS offer specifically, excluding any offer the buyer
  // themselves created — a Pigeon can carry other currencies' sell offers
  // simultaneously (e.g. a separate XRP listing on Deeptide), and XRPL
  // never auto-cancels a seller's old sell offer just because the NFT
  // later changed hands, so a buyer who once listed (and sold) this exact
  // Pigeon could still have their own dead offer sitting on-ledger. Without
  // excludeOwner here, that stale self-offer could sort ahead of the real
  // seller's and get picked as "the" offer instead — confirmed live as the
  // cause of BUY NOW wrongly reporting cannot_buy_own_listing on someone
  // else's real, current listing.
  const offer = findPigeonsOffer(offers, undefined, buyer);
  if (!offer) {
    return new Response(JSON.stringify({ error: 'not_listed' }), { status: 404 });
  }

  const pigeonsCurrency = encodeCurrencyCode(PIGEONS_TOKEN_CONFIG.currency);

  // A listing predating the marketplace-fee rollout has no Destination
  // restriction and its on-ledger amount already IS the full price — stays
  // a plain, fee-less direct accept exactly like before, so an existing
  // live listing never breaks out from under a seller mid-flight. Every
  // NEW listing goes through the fee-bearing branch below.
  if (offer.destination !== MARKETPLACE_BROKER_WALLET) {
    const txjson = {
      TransactionType: 'NFTokenAcceptOffer',
      Account: buyer,
      NFTokenSellOffer: offer.nft_offer_index
    };
    return new Response(JSON.stringify({
      ok: true,
      legacy: true,
      txjson,
      display: {
        nftId,
        seller: offer.owner,
        totalValue: offer.amount.value,
        feeValue: '0',
        sellerValue: offer.amount.value,
        currency: offer.amount.currency,
        issuer: offer.amount.issuer
      }
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // The live sell offer's own Amount IS the real listed price now — the
  // buyer's total is just that plus the marketplace's markup, computed
  // fresh here rather than from any cached index. Honest transitional
  // note: any listing still live from before this rollout already has its
  // on-ledger Amount reduced under the OLD model, and there's no way to
  // tell that apart from a real full-price listing here — it'll get a new
  // markup added on top of its already-reduced number instead of its
  // seller's real original typed price. Not unsafe (the seller still gets
  // exactly what their own signed offer says either way), just a one-time
  // price drift for any straggler until it's re-listed or sells.
  const fee = computeMarketplaceMarkup(offer.amount.value);
  if (!fee) {
    return new Response(JSON.stringify({ error: 'listing_price_unavailable' }), { status: 409 });
  }

  const txjson = {
    TransactionType: 'NFTokenCreateOffer',
    Account: buyer,
    Owner: offer.owner,
    NFTokenID: nftId,
    Amount: {
      currency: pigeonsCurrency,
      issuer: PIGEONS_TOKEN_CONFIG.issuer,
      value: fee.totalValue
    },
    Memos: swapOfferSourceMemo()
  };

  return new Response(JSON.stringify({
    ok: true,
    txjson,
    display: {
      nftId,
      seller: offer.owner,
      totalValue: fee.totalValue,
      feeValue: fee.feeValue,
      sellerValue: fee.sellerValue,
      currency: pigeonsCurrency,
      issuer: PIGEONS_TOKEN_CONFIG.issuer,
      sellOfferId: offer.nft_offer_index
    }
  }), { headers: { 'Content-Type': 'application/json' } });
}
