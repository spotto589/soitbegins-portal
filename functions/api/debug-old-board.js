// Temporary read-only debug endpoint: checks whether the pre-fix shared
// 'board_messages' KV key still holds data left behind by the August 6
// data-loss-bug fix (see commit 99048e7). Never writes anything. Remove
// this file once checked.
export async function onRequestGet(context) {
  const { env } = context;
  if (!env.coin) {
    return new Response('server misconfigured', { status: 500 });
  }
  const raw = await env.coin.get('board_messages');
  return new Response(raw || 'null', { headers: { 'Content-Type': 'application/json' } });
}
