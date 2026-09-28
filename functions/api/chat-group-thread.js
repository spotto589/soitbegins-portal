import { json, chatSession, isMember, ruleFromRow } from '../_chat.js';

// One group's messages (newest 200, oldest first) + its members. ?after=<id>
// returns only newer messages (the open chat polls with it). Marks
// everything returned as read for this member.
const THREAD_LIMIT = 200;

export async function onRequestGet(context) {
  const { request, env } = context;
  const s = await chatSession(request, env);
  if (s.error) return s.error;
  const url = new URL(request.url);
  const groupId = Number(url.searchParams.get('id'));
  const after = Math.max(0, Number(url.searchParams.get('after')) || 0);
  if (!groupId || !Number.isInteger(groupId)) return json({ error: 'invalid_group' }, 400);
  const db = env.MESSAGES_DB;
  if (!(await isMember(env, groupId, s.me))) return json({ error: 'not_found' }, 404);
  const group = await db.prepare('SELECT * FROM chat_groups WHERE id = ?1').bind(groupId).first();
  if (!group) return json({ error: 'not_found' }, 404);

  const { results } = await db.prepare(
    'SELECT id, sender, body, created_at FROM chat_group_messages WHERE group_id = ?1 AND id > ?2 ORDER BY id DESC LIMIT ?3'
  ).bind(groupId, after, THREAD_LIMIT).all();
  const rows = (results || []).reverse();
  const members = after ? null : ((await db.prepare(
    'SELECT wallet, joined_at FROM chat_group_members WHERE group_id = ?1 ORDER BY joined_at ASC'
  ).bind(groupId).all()).results || []).map(m => ({ wallet: m.wallet, joinedAt: m.joined_at }));

  if (rows.length) {
    const newest = rows[rows.length - 1].id;
    context.waitUntil(db.prepare(
      'UPDATE chat_group_members SET last_read_id = ?1 WHERE group_id = ?2 AND wallet = ?3 AND last_read_id < ?1'
    ).bind(newest, groupId, s.me).run().catch(() => {}));
  }

  return json({
    group: { id: group.id, name: group.name, owner: group.owner, rule: ruleFromRow(group), createdAt: group.created_at },
    members,
    items: rows.map(r => ({ id: r.id, sender: r.sender, fromMe: r.sender === s.me, body: r.body, createdAt: r.created_at }))
  });
}
