import { json, chatSession, XRPL_ADDRESS_RE, CONTACTS_MAX } from '../_chat.js';

// C0NTACTS (2026-09-28) — each wallet's own saved address book.
// GET                                    -> { items: [{ wallet, nickname, createdAt }] }
// POST { action:'save', wallet, nickname } -> add, or rename an existing one
// POST { action:'remove', wallet }
export async function onRequestGet(context) {
  const { request, env } = context;
  const s = await chatSession(request, env);
  if (s.error) return s.error;
  const { results } = await env.MESSAGES_DB.prepare(
    'SELECT wallet, nickname, created_at FROM contacts WHERE owner = ?1 ORDER BY COALESCE(nickname, wallet) COLLATE NOCASE LIMIT ?2'
  ).bind(s.me, CONTACTS_MAX).all();
  return json({ items: (results || []).map(r => ({ wallet: r.wallet, nickname: r.nickname || null, createdAt: r.created_at })) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const s = await chatSession(request, env);
  if (s.error) return s.error;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const wallet = body && body.wallet;
  if (!wallet || typeof wallet !== 'string' || !XRPL_ADDRESS_RE.test(wallet)) return json({ error: 'invalid_wallet' }, 400);

  if (body.action === 'remove') {
    await env.MESSAGES_DB.prepare('DELETE FROM contacts WHERE owner = ?1 AND wallet = ?2').bind(s.me, wallet).run();
    return json({ ok: true });
  }
  if (body.action !== 'save') return json({ error: 'bad_action' }, 400);
  if (wallet === s.me) return json({ error: 'cannot_add_self' }, 400);
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, 32) : '';
  const existing = await env.MESSAGES_DB.prepare('SELECT 1 AS x FROM contacts WHERE owner = ?1 AND wallet = ?2').bind(s.me, wallet).first();
  if (!existing) {
    const n = await env.MESSAGES_DB.prepare('SELECT COUNT(*) AS n FROM contacts WHERE owner = ?1').bind(s.me).first('n');
    if (n >= CONTACTS_MAX) return json({ error: 'too_many_contacts' }, 400);
  }
  await env.MESSAGES_DB.prepare(
    'INSERT INTO contacts (owner, wallet, nickname, created_at) VALUES (?1, ?2, ?3, ?4) ' +
    'ON CONFLICT(owner, wallet) DO UPDATE SET nickname = excluded.nickname'
  ).bind(s.me, wallet, nickname || null, Math.floor(Date.now() / 1000)).run();
  return json({ ok: true });
}
