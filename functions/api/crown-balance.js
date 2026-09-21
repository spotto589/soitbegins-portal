import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  getCrownBalance, getBlackjackRound, getCrownMaxBet, blackjackHandValue
} from '../_shared.js';

function publicRound(round) {
  if (!round) return null;
  if (round.status === 'active') {
    return {
      status: 'active',
      player: round.player,
      playerValue: blackjackHandValue(round.player),
      dealerUp: round.dealer[0],
      bet: round.bet
    };
  }
  return null; // resolved rounds are cleared server-side, nothing to resume
}

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

  const kv = env.coin;
  const balance = await getCrownBalance(kv, payload.acct);
  const round = await getBlackjackRound(kv, payload.acct);

  return new Response(JSON.stringify({
    ok: true,
    balance,
    maxBet: getCrownMaxBet(),
    round: publicRound(round)
  }), { headers: { 'Content-Type': 'application/json' } });
}
