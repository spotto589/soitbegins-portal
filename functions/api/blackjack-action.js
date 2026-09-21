import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  getCrownBalance, setCrownBalance, getCrownMaxBet,
  acquireCrownLock, releaseCrownLock,
  getBlackjackRound, saveBlackjackRound, clearBlackjackRound,
  freshBlackjackShoe, blackjackHandValue, isBlackjackHand, blackjackDealerPlay
} from '../_shared.js';

// Everything a client sees about an in-progress round: the dealer's hole
// card is never included until the round resolves — a client could
// otherwise read it straight out of the response.
function publicRound(round) {
  const playerValue = blackjackHandValue(round.player);
  if (round.status === 'active') {
    return {
      status: 'active',
      player: round.player,
      playerValue,
      dealerUp: round.dealer[0],
      dealer: null,
      dealerValue: null,
      bet: round.bet,
      result: null
    };
  }
  return {
    status: 'resolved',
    player: round.player,
    playerValue,
    dealerUp: round.dealer[0],
    dealer: round.dealer,
    dealerValue: blackjackHandValue(round.dealer),
    bet: round.bet,
    result: round.result
  };
}

// Settles a resolved round's payout against the balance, then clears the
// round from KV. `outcome` is 'win' | 'blackjack' | 'push' | 'lose'.
async function resolve(kv, wallet, round, outcome, balance) {
  round.status = 'resolved';
  round.result = outcome;
  let payout = 0;
  if (outcome === 'blackjack') payout = Math.floor(round.bet * 2.5); // 3:2 + original bet back
  else if (outcome === 'win') payout = round.bet * 2; // 1:1 + original bet back
  else if (outcome === 'push') payout = round.bet; // bet returned
  // 'lose' pays nothing — the bet was already deducted at deal time.
  const newBalance = payout > 0 ? await setCrownBalance(kv, wallet, balance + payout) : balance;
  await clearBlackjackRound(kv, wallet);
  return newBalance;
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
  if (!['deal', 'hit', 'stand'].includes(action)) {
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

      let balance = await getCrownBalance(kv, wallet);
      if (bet > balance) {
        return new Response(JSON.stringify({ error: 'insufficient_balance', balance }), { status: 400 });
      }
      balance = await setCrownBalance(kv, wallet, balance - bet);

      const shoe = freshBlackjackShoe();
      const player = [shoe.pop(), shoe.pop()];
      const dealer = [shoe.pop(), shoe.pop()];
      let round = { shoe, player, dealer, bet, status: 'active', result: null };

      const playerBJ = isBlackjackHand(player);
      const dealerBJ = isBlackjackHand(dealer);
      if (playerBJ || dealerBJ) {
        const outcome = playerBJ && dealerBJ ? 'push' : (playerBJ ? 'blackjack' : 'lose');
        balance = await resolve(kv, wallet, round, outcome, balance);
      } else {
        await saveBlackjackRound(kv, wallet, round);
      }

      return new Response(JSON.stringify({ ok: true, balance, round: publicRound(round) }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const round = await getBlackjackRound(kv, wallet);
    if (!round || round.status !== 'active') {
      return new Response(JSON.stringify({ error: 'no_active_round' }), { status: 400 });
    }
    let balance = await getCrownBalance(kv, wallet);

    if (action === 'hit') {
      round.player.push(round.shoe.pop());
      if (blackjackHandValue(round.player) > 21) {
        balance = await resolve(kv, wallet, round, 'lose', balance);
      } else {
        await saveBlackjackRound(kv, wallet, round);
      }
      return new Response(JSON.stringify({ ok: true, balance, round: publicRound(round) }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // action === 'stand'
    blackjackDealerPlay(round.shoe, round.dealer);
    const playerValue = blackjackHandValue(round.player);
    const dealerValue = blackjackHandValue(round.dealer);
    let outcome;
    if (dealerValue > 21 || playerValue > dealerValue) outcome = 'win';
    else if (playerValue === dealerValue) outcome = 'push';
    else outcome = 'lose';
    balance = await resolve(kv, wallet, round, outcome, balance);

    return new Response(JSON.stringify({ ok: true, balance, round: publicRound(round) }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    await releaseCrownLock(kv, wallet);
  }
}
