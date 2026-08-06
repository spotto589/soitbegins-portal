// Temporary one-time migration: the pre-Aug-6 board stored every message
// under one shared 'board_messages' key. That storage pattern had a race
// condition (fixed in commit 99048e7) and was replaced with one KV key per
// pigeon post, but the old messages were left behind under the old key
// rather than migrated. This copies them across into the current
// pigeonpost:<key> format so they show up on the board again, skipping the
// one message that should stay dropped ("gherh" / ehrheh). Old NFT ids
// weren't recorded on these entries, so synthetic legacy-N keys are used
// instead — same effect the original fix already accepted for pre-fix
// posts (their pigeons show as available to post again). Remove this file
// once run.
export async function onRequestGet(context) {
  const { env } = context;
  if (!env.coin) {
    return new Response('server misconfigured', { status: 500 });
  }

  const raw = await env.coin.get('board_messages');
  const messages = raw ? JSON.parse(raw) : [];

  const toKeep = messages.filter(m => !(m.text === 'gherh' && m.name === 'ehrheh'));

  const results = [];
  for (let i = 0; i < toKeep.length; i++) {
    const m = toKeep[i];
    const key = `pigeonpost:legacy-${i}`;
    await env.coin.put(key, JSON.stringify(m));
    results.push({ key, text: m.text });
  }

  return new Response(JSON.stringify({ migrated: results.length, results }, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}
