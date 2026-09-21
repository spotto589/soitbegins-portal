import {
  BOARD_COOKIE_NAME, getCookie, verifyToken,
  getCrownBalance, getBlackjackRound, getCrownMaxBet, publicBlackjackRound
} from '../_shared.js';

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
  // Same shape blackjack-action.js returns, so the client's resume path can
  // reuse the exact same render function as a live action response —
  // resolved rounds are always cleared server-side, so round is only ever
  // null or an in-progress ('active') one here.
  const publicRound = round && round.status === 'active' ? publicBlackjackRound(round, balance) : null;

  return new Response(JSON.stringify({
    ok: true,
    balance,
    maxBet: getCrownMaxBet(),
    round: publicRound
  }), { headers: { 'Content-Type': 'application/json' } });
}
