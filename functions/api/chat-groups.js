import {
  json, chatSession, isPremium, cleanRule, meetsRule, holderOptions, ruleFromRow, isMember,
  XRPL_ADDRESS_RE, GROUP_NAME_MAX, GROUP_MEMBERS_MAX, GROUPS_PER_WALLET_MAX
} from '../_chat.js';

// GR0UP CHATS (2026-09-28). Who can be in one is set by its rule — see
// functions/_chat.js.
// GET                    -> { premium, items: [my groups, newest activity first, with unread] }
// GET ?options=1         -> { premium, collections: [{ key, label, count, traits }] } for the builder
// POST { action:'create', name, rule, members:[wallets] }
// POST { action:'add', groupId, wallets:[...] }
// POST { action:'leave', groupId }
// POST { action:'rename', groupId, name }        (creator only)
// POST { action:'check', rule, wallets:[...] }   -> who would pass the rule, before creating
const REASON_TEXT = { no_holding: 'no_holding', no_trait: 'no_trait', check_failed: 'check_failed', premium_only: 'premium_only' };

function cleanName(n) {
  return typeof n === 'string' ? n.trim().replace(/\s+/g, ' ').slice(0, GROUP_NAME_MAX) : '';
}
function cleanWallets(list, me) {
  if (!Array.isArray(list)) return [];
  const seen = {};
  return list.filter(w => typeof w === 'string' && XRPL_ADDRESS_RE.test(w) && w !== me && !seen[w] && (seen[w] = true)).slice(0, GROUP_MEMBERS_MAX);
}
// Checks each wallet against the rule, a few at a time.
async function checkAll(context, wallets, rule, adderPremium) {
  const out = [];
  for (let i = 0; i < wallets.length; i += 5) {
    const chunk = wallets.slice(i, i + 5);
    const res = await Promise.all(chunk.map(w => meetsRule(context, w, rule, adderPremium).catch(() => ({ ok: false, reason: 'check_failed' }))));
    chunk.forEach((w, j) => out.push({ wallet: w, ok: res[j].ok, reason: res[j].ok ? null : REASON_TEXT[res[j].reason] || 'check_failed' }));
  }
  return out;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const s = await chatSession(request, env);
  if (s.error) return s.error;
  const premium = await isPremium(env, s.me);
  const url = new URL(request.url);
  if (url.searchParams.get('options') === '1') {
    return json({ premium, collections: await holderOptions(context, s.me) });
  }
  const { results } = await env.MESSAGES_DB.prepare(`
    SELECT g.id, g.name, g.owner, g.rule, g.collection, g.trait_type, g.trait_value, g.created_at,
      (SELECT COUNT(*) FROM chat_group_members m2 WHERE m2.group_id = g.id) AS member_count,
      (SELECT COUNT(*) FROM chat_group_messages x WHERE x.group_id = g.id AND x.id > m.last_read_id AND x.sender != ?1) AS unread,
      lm.body AS last_body, lm.sender AS last_sender, lm.created_at AS last_at
    FROM chat_group_members m
    JOIN chat_groups g ON g.id = m.group_id
    LEFT JOIN chat_group_messages lm ON lm.id = (SELECT MAX(id) FROM chat_group_messages y WHERE y.group_id = g.id)
    WHERE m.wallet = ?1
    ORDER BY COALESCE(lm.created_at, g.created_at) DESC
  `).bind(s.me).all();
  return json({
    premium,
    items: (results || []).map(r => ({
      id: r.id, name: r.name, owner: r.owner, rule: ruleFromRow(r), memberCount: r.member_count,
      unreadCount: r.unread, lastMessage: r.last_body || null, lastSender: r.last_sender || null,
      lastFromMe: r.last_sender === s.me, lastAt: r.last_at || r.created_at
    }))
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const s = await chatSession(request, env);
  if (s.error) return s.error;
  const db = env.MESSAGES_DB;
  let body;
  try { body = await request.json(); } catch (e) { return json({ error: 'bad_request' }, 400); }
  const action = body && body.action;
  const now = Math.floor(Date.now() / 1000);
  const premium = await isPremium(env, s.me);

  if (action === 'check') {
    const rule = cleanRule(body.rule);
    if (!rule) return json({ error: 'bad_rule' }, 400);
    return json({ ok: true, results: await checkAll(context, cleanWallets(body.wallets, s.me), rule, premium) });
  }

  if (action === 'create') {
    const name = cleanName(body.name);
    if (!name) return json({ error: 'name_required' }, 400);
    const rule = cleanRule(body.rule);
    if (!rule) return json({ error: 'bad_rule' }, 400);
    if (rule.kind === 'open' && !premium) return json({ error: 'premium_only' }, 403);
    // The creator has to pass their own group's rule too.
    const mine = await meetsRule(context, s.me, rule, premium);
    if (!mine.ok) return json({ error: 'you_' + mine.reason }, 403);
    const owned = await db.prepare('SELECT COUNT(*) AS n FROM chat_groups WHERE owner = ?1').bind(s.me).first('n');
    if (owned >= GROUPS_PER_WALLET_MAX) return json({ error: 'too_many_groups' }, 400);
    const checked = await checkAll(context, cleanWallets(body.members, s.me).slice(0, GROUP_MEMBERS_MAX - 1), rule, premium);
    const passed = checked.filter(c => c.ok).map(c => c.wallet);
    if (!passed.length) return json({ error: 'no_eligible_members', results: checked }, 400);
    const ins = await db.prepare(
      'INSERT INTO chat_groups (name, owner, rule, collection, trait_type, trait_value, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
    ).bind(name, s.me, rule.kind, rule.collection || null, rule.traitType || null, rule.traitValue || null, now).run();
    const groupId = ins.meta && ins.meta.last_row_id;
    await db.batch([s.me].concat(passed).map(w =>
      db.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, wallet, joined_at) VALUES (?1, ?2, ?3)').bind(groupId, w, now)
    ));
    return json({ ok: true, groupId, results: checked });
  }

  const groupId = Number(body && body.groupId);
  if (!groupId || !Number.isInteger(groupId)) return json({ error: 'invalid_group' }, 400);
  const group = await db.prepare('SELECT * FROM chat_groups WHERE id = ?1').bind(groupId).first();
  if (!group || !(await isMember(env, groupId, s.me))) return json({ error: 'not_found' }, 404);

  if (action === 'add') {
    const rule = ruleFromRow(group);
    const count = await db.prepare('SELECT COUNT(*) AS n FROM chat_group_members WHERE group_id = ?1').bind(groupId).first('n');
    const room = GROUP_MEMBERS_MAX - count;
    if (room <= 0) return json({ error: 'group_full' }, 400);
    const checked = await checkAll(context, cleanWallets(body.wallets, s.me).slice(0, room), rule, premium);
    const passed = checked.filter(c => c.ok).map(c => c.wallet);
    if (passed.length) {
      await db.batch(passed.map(w =>
        db.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, wallet, joined_at, last_read_id) VALUES (?1, ?2, ?3, 0)').bind(groupId, w, now)
      ));
    }
    return json({ ok: true, results: checked });
  }

  if (action === 'leave') {
    await db.prepare('DELETE FROM chat_group_members WHERE group_id = ?1 AND wallet = ?2').bind(groupId, s.me).run();
    const next = await db.prepare('SELECT wallet FROM chat_group_members WHERE group_id = ?1 ORDER BY joined_at ASC LIMIT 1').bind(groupId).first();
    if (!next) {
      // Last one out: the group and its messages go.
      await db.batch([
        db.prepare('DELETE FROM chat_group_messages WHERE group_id = ?1').bind(groupId),
        db.prepare('DELETE FROM chat_groups WHERE id = ?1').bind(groupId)
      ]);
    } else if (group.owner === s.me) {
      await db.prepare('UPDATE chat_groups SET owner = ?1 WHERE id = ?2').bind(next.wallet, groupId).run();
    }
    return json({ ok: true });
  }

  if (action === 'rename') {
    if (group.owner !== s.me) return json({ error: 'owner_only' }, 403);
    const name = cleanName(body.name);
    if (!name) return json({ error: 'name_required' }, 400);
    await db.prepare('UPDATE chat_groups SET name = ?1 WHERE id = ?2').bind(name, groupId).run();
    return json({ ok: true });
  }

  return json({ error: 'bad_action' }, 400);
}
