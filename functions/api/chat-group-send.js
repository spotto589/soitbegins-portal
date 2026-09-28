import { json, chatSession, isMember, MESSAGE_MAX } from '../_chat.js';

// Same flood guard as messages-send.js (per sender, across all groups).
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_SECONDS = 60;

export async function onRequestPost(context) {
  const { request, env } = context;
  const s = await chatSession(request, env);
  if (s.error) return s.error;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const groupId = Number(body && body.groupId);
  if (!groupId || !Number.isInteger(groupId)) return json({ error: 'invalid_group' }, 400);
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) return json({ error: 'empty_message' }, 400);
  if (text.length > MESSAGE_MAX) return json({ error: 'message_too_long', maxLength: MESSAGE_MAX }, 400);
  const db = env.MESSAGES_DB;
  if (!(await isMember(env, groupId, s.me))) return json({ error: 'not_found' }, 404);

  const now = Math.floor(Date.now() / 1000);
  const recent = await db.prepare(
    'SELECT COUNT(*) AS n FROM chat_group_messages WHERE sender = ?1 AND created_at > ?2'
  ).bind(s.me, now - RATE_LIMIT_WINDOW_SECONDS).first('n');
  if (recent >= RATE_LIMIT_MAX) return json({ error: 'rate_limited' }, 429);

  const ins = await db.prepare(
    'INSERT INTO chat_group_messages (group_id, sender, body, created_at) VALUES (?1, ?2, ?3, ?4)'
  ).bind(groupId, s.me, text, now).run();
  const id = ins.meta && ins.meta.last_row_id;
  // Your own message counts as read.
  context.waitUntil(db.prepare(
    'UPDATE chat_group_members SET last_read_id = ?1 WHERE group_id = ?2 AND wallet = ?3 AND last_read_id < ?1'
  ).bind(id, groupId, s.me).run().catch(() => {}));
  return json({ ok: true, id, createdAt: now });
}
