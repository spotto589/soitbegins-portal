import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  getCrownBalance, setCrownBalance, getCrownMaxBet,
  acquireCrownLock, releaseCrownLock,
  getBlackjackRound, saveBlackjackRound, clearBlackjackRound,
  freshBlackjackShoe, blackjackHandValue, isBlackjackHand, blackjackDealerPlay,
  blackjackCardRank, publicBlackjackRound,
  evaluateCrownPairBonus, evaluateCrownPokerBonus
} from '../_shared.js';

function respond(round, balance, sideBets) {
  return new Response(JSON.stringify({ ok: true, balance, round: publicBlackjackRound(round, balance), sideBets: sideBets || null }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Parses an optional side-bet amount from the deal request body — 0/absent
// is always valid (side bets are optional), anything else must be a
// positive integer within the same per-bet cap as the main bet.
function parseSideBet(raw, maxBet) {
  if (raw === undefined || raw === null || raw === 0 || raw === '0' || raw === '') return { ok: true, amount: 0 };
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 0 || n > maxBet) return { ok: false };
  return { ok: true, amount: n };
}

function payoutFor(hand) {
  if (hand.result === 'blackjack') return Math.floor(hand.bet * 2.5); // 3:2 + original bet back
  if (hand.result === 'win') return hand.bet * 2; // 1:1 + original bet back
  if (hand.result === 'push') return hand.bet; // bet returned
  return 0; // lose — bet was already deducted when placed
}

// Resolves every hand against the dealer's FINAL hand. `drawDealer` is
// false only for the natural-blackjack-at-deal path, where the dealer's
// own 2 starting cards are already final (a real dealer never draws more
// just because the player had blackjack). A hand that already has a
// `result` (set by the natural-blackjack deal path) is left alone here —
// every other hand gets its outcome decided against the dealer's total.
async function settleRound(kv, wallet, round, balance, drawDealer) {
  if (drawDealer) blackjackDealerPlay(round.shoe, round.dealer);
  const dealerValue = blackjackHandValue(round.dealer);
  const dealerBust = dealerValue > 21;
  let totalPayout = 0;
  for (const hand of round.hands) {
    if (!hand.result) {
      if (hand.status === 'bust') {
        hand.result = 'lose';
      } else {
        const playerValue = blackjackHandValue(hand.cards);
        if (dealerBust || playerValue > dealerValue) hand.result = 'win';
        else if (playerValue === dealerValue) hand.result = 'push';
        else hand.result = 'lose';
      }
    }
    totalPayout += payoutFor(hand);
  }
  round.status = 'resolved';
  const newBalance = totalPayout > 0 ? await setCrownBalance(kv, wallet, balance + totalPayout) : balance;
  await clearBlackjackRound(kv, wallet);
  return newBalance;
}

function findNextActiveHand(hands, afterIndex) {
  for (let i = afterIndex + 1; i < hands.length; i++) {
    if (hands[i].status === 'active') return i;
  }
  return -1;
}

// Called after a hand stops being playable (stood, bust, or forced-done by
// a double) — moves to the next hand still in play (the split-hand case),
// or settles the whole round against the dealer once none are left.
async function advanceOrSettle(kv, wallet, round, balance) {
  const next = findNextActiveHand(round.hands, round.activeHandIndex);
  if (next !== -1) {
    round.activeHandIndex = next;
    await saveBlackjackRound(kv, wallet, round);
    return balance;
  }
  return await settleRound(kv, wallet, round, balance, true);
}

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
  const wallet = payload.acct;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400 });
  }
  const action = body && body.action;
  if (!['deal', 'hit', 'stand', 'double', 'split'].includes(action)) {
    return new Response(JSON.stringify({ error: 'bad_action' }), { status: 400 });
  }

  const kv = env.coin;
  const gotLock = await acquireCrownLock(kv, wallet);
  if (!gotLock) {
    return new Response(JSON.stringify({ error: 'action_in_progress' }), { status: 409 });
  }

  try {
    if (action === 'deal') {
      const existing = await getBlackjackRound(kv, wallet);
      if (existing && existing.status === 'active') {
        return new Response(JSON.stringify({ error: 'round_in_progress' }), { status: 409 });
      }

      const bet = Math.floor(Number(body.bet));
      const maxBet = getCrownMaxBet();
      if (!Number.isFinite(bet) || bet < 1 || bet > maxBet) {
        return new Response(JSON.stringify({ error: 'bad_bet', maxBet }), { status: 400 });
      }
      const pairBetParsed = parseSideBet(body.pairBet, maxBet);
      const pokerBetParsed = parseSideBet(body.pokerBet, maxBet);
      if (!pairBetParsed.ok || !pokerBetParsed.ok) {
        return new Response(JSON.stringify({ error: 'bad_side_bet', maxBet }), { status: 400 });
      }
      const pairBet = pairBetParsed.amount;
      const pokerBet = pokerBetParsed.amount;
      const totalStake = bet + pairBet + pokerBet;

      let balance = await getCrownBalance(kv, wallet);
      if (totalStake > balance) {
        return new Response(JSON.stringify({ error: 'insufficient_balance', balance }), { status: 400 });
      }
      balance = await setCrownBalance(kv, wallet, balance - totalStake);

      const shoe = freshBlackjackShoe();
      const player = [shoe.pop(), shoe.pop()];
      const dealer = [shoe.pop(), shoe.pop()];

      // Side bets are fully determined by these 3 cards alone (player's 2 +
      // dealer's up card) and never affected by how the hand is later
      // played, so they settle right here — "pays X:1" means total return
      // (already includes the original stake) is bet*(mult+1), same
      // convention blackjack's own 3:2 payout uses below.
      let sideBets = null;
      let sidePayout = 0;
      if (pairBet > 0 || pokerBet > 0) {
        sideBets = { pair: null, poker: null };
        if (pairBet > 0) {
          const hit = evaluateCrownPairBonus(player[0], player[1]);
          const payout = hit ? pairBet * (hit.mult + 1) : 0;
          sideBets.pair = { bet: pairBet, tier: hit ? hit.tier : null, mult: hit ? hit.mult : 0, payout };
          sidePayout += payout;
        }
        if (pokerBet > 0) {
          const hit = evaluateCrownPokerBonus(player[0], player[1], dealer[0]);
          const payout = hit ? pokerBet * (hit.mult + 1) : 0;
          sideBets.poker = { bet: pokerBet, tier: hit ? hit.tier : null, mult: hit ? hit.mult : 0, payout };
          sidePayout += payout;
        }
        if (sidePayout > 0) balance = await setCrownBalance(kv, wallet, balance + sidePayout);
      }

      const hand = { cards: player, bet, status: 'active', result: null, fromSplit: false, fromSplitAces: false };
      const round = { shoe, dealer, hands: [hand], activeHandIndex: 0, status: 'active' };

      const playerBJ = isBlackjackHand(player);
      const dealerBJ = isBlackjackHand(dealer);
      if (playerBJ || dealerBJ) {
        hand.status = 'stood';
        hand.result = playerBJ && dealerBJ ? 'push' : (playerBJ ? 'blackjack' : 'lose');
        balance = await settleRound(kv, wallet, round, balance, false);
      } else {
        await saveBlackjackRound(kv, wallet, round);
      }
      return respond(round, balance, sideBets);
    }

    const round = await getBlackjackRound(kv, wallet);
    if (!round || round.status !== 'active') {
      return new Response(JSON.stringify({ error: 'no_active_round' }), { status: 400 });
    }
    let balance = await getCrownBalance(kv, wallet);
    const hand = round.hands[round.activeHandIndex];
    if (!hand || hand.status !== 'active') {
      return new Response(JSON.stringify({ error: 'no_active_hand' }), { status: 400 });
    }

    if (action === 'hit') {
      hand.cards.push(round.shoe.pop());
      if (blackjackHandValue(hand.cards) > 21) hand.status = 'bust';
      if (hand.status === 'active') {
        await saveBlackjackRound(kv, wallet, round);
      } else {
        balance = await advanceOrSettle(kv, wallet, round, balance);
      }
      return respond(round, balance);
    }

    if (action === 'stand') {
      hand.status = 'stood';
      balance = await advanceOrSettle(kv, wallet, round, balance);
      return respond(round, balance);
    }

    if (action === 'double') {
      if (hand.cards.length !== 2 || hand.fromSplitAces) {
        return new Response(JSON.stringify({ error: 'cannot_double' }), { status: 400 });
      }
      if (balance < hand.bet) {
        return new Response(JSON.stringify({ error: 'insufficient_balance', balance }), { status: 400 });
      }
      balance = await setCrownBalance(kv, wallet, balance - hand.bet);
      hand.bet *= 2;
      hand.cards.push(round.shoe.pop());
      hand.status = blackjackHandValue(hand.cards) > 21 ? 'bust' : 'stood';
      balance = await advanceOrSettle(kv, wallet, round, balance);
      return respond(round, balance);
    }

    // action === 'split'
    if (round.hands.length !== 1 || hand.cards.length !== 2 ||
        blackjackCardRank(hand.cards[0]) !== blackjackCardRank(hand.cards[1])) {
      return new Response(JSON.stringify({ error: 'cannot_split' }), { status: 400 });
    }
    if (balance < hand.bet) {
      return new Response(JSON.stringify({ error: 'insufficient_balance', balance }), { status: 400 });
    }
    balance = await setCrownBalance(kv, wallet, balance - hand.bet);
    const isAces = blackjackCardRank(hand.cards[0]) === 'A';
    const handA = { cards: [hand.cards[0], round.shoe.pop()], bet: hand.bet, status: 'active', result: null, fromSplit: true, fromSplitAces: isAces };
    const handB = { cards: [hand.cards[1], round.shoe.pop()], bet: hand.bet, status: 'active', result: null, fromSplit: true, fromSplitAces: isAces };
    // Split Aces is the one standard exception: one card each, no further
    // action on either hand — both are done acting the instant they're dealt.
    if (isAces) { handA.status = 'stood'; handB.status = 'stood'; }
    round.hands = [handA, handB];
    round.activeHandIndex = -1;
    balance = await advanceOrSettle(kv, wallet, round, balance);
    return respond(round, balance);
  } finally {
    await releaseCrownLock(kv, wallet);
  }
}
