import {
  BOARD_COOKIE_NAME, getCookie, verifyToken, TRADEABLE_COLLECTIONS,
  fetchAllAccountNftsCheckedCached, findAllCollectionNfts, resolveDetailsCached
} from './_shared.js';

// Shared by the chat endpoints (2026-09-28): contacts, group chats and the
// holder rules that decide who can be in a group.
//
// Group rules:
//   collection — every member holds at least one NFT from that collection
//   trait      — every member holds an NFT from that collection with that
//                exact trait (category + value)
//   open       — anyone; only a PREM!UM wallet can make one or add to one
// Checked when someone is added, not re-checked later.

export const XRPL_ADDRESS_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
export const GROUP_NAME_MAX = 32;
export const GROUP_MEMBERS_MAX = 50;
export const GROUPS_PER_WALLET_MAX = 20;
export const CONTACTS_MAX = 500;
export const MESSAGE_MAX = 1000;
export const PREMIUM_PREFIX = 'chat:premium:v1:';

export function json(body, status) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

// null + an error Response when there's no usable session or database.
export async function chatSession(request, env) {
  if (!env.Σκύλλα || !env.MESSAGES_DB) return { error: json({ error: 'server_misconfigured' }, 500) };
  const token = getCookie(request, BOARD_COOKIE_NAME);
  if (!token) return { error: json({ error: 'no_session' }, 401) };
  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) return { error: json({ error: 'invalid_session' }, 401) };
  return { me: payload.acct };
}

// PREM!UM — paid for with CR0WN rewards once that side of the site exists.
// Nothing sets this yet; the stored value is { until: <unix seconds> }.
export async function isPremium(env, wallet) {
  if (!env.coin || !wallet) return false;
  try {
    const raw = await env.coin.get(PREMIUM_PREFIX + wallet);
    const p = raw ? JSON.parse(raw) : null;
    return !!(p && p.until && p.until > Math.floor(Date.now() / 1000));
  } catch (e) { return false; }
}

// Collections a group can be tied to: ones with a real on-ledger NFT issuer.
export function holderCollections() {
  return Object.keys(TRADEABLE_COLLECTIONS).filter(k => TRADEABLE_COLLECTIONS[k].nftIssuer);
}

export function cleanRule(rule) {
  if (!rule || typeof rule !== 'object') return null;
  if (rule.kind === 'open') return { kind: 'open' };
  if (holderCollections().indexOf(rule.collection) === -1) return null;
  if (rule.kind === 'collection') return { kind: 'collection', collection: rule.collection };
  if (rule.kind === 'trait') {
    const t = String(rule.traitType || '').slice(0, 64), v = String(rule.traitValue || '').slice(0, 64);
    if (!t || !v || v === '__no_trait__') return null;
    return { kind: 'trait', collection: rule.collection, traitType: t, traitValue: v };
  }
  return null;
}

// The NFT ids this wallet holds in one collection. ok:false = the ledger
// scan didn't finish, which is "couldn't check", not "holds none".
async function heldIds(context, wallet, collection) {
  const { nfts, ok } = await fetchAllAccountNftsCheckedCached(context, wallet);
  return { ok, ids: findAllCollectionNfts(nfts, collection).map(n => n.NFTokenID) };
}

function hasTrait(detail, type, value) {
  return !!(detail && Array.isArray(detail.attributes) && detail.attributes.some(a => a && a.trait_type === type && String(a.value) === value));
}

// { ok: true } or { ok: false, reason: 'no_holding' | 'no_trait' | 'check_failed' | 'premium_only' }
export async function meetsRule(context, wallet, rule, adderIsPremium) {
  if (rule.kind === 'open') return adderIsPremium ? { ok: true } : { ok: false, reason: 'premium_only' };
  const held = await heldIds(context, wallet, rule.collection);
  if (!held.ids.length) return { ok: false, reason: held.ok ? 'no_holding' : 'check_failed' };
  if (rule.kind === 'collection') return { ok: true };
  const details = await resolveDetailsCached(context, rule.collection, held.ids);
  return details.some(d => hasTrait(d, rule.traitType, rule.traitValue)) ? { ok: true } : { ok: false, reason: 'no_trait' };
}

// What the group builder offers this wallet: each collection it holds, with
// the traits across its NFTs there (and how many of its NFTs carry each).
export async function holderOptions(context, wallet) {
  const { nfts } = await fetchAllAccountNftsCheckedCached(context, wallet);
  const out = [];
  for (const key of holderCollections()) {
    const ids = findAllCollectionNfts(nfts, key).map(n => n.NFTokenID);
    if (!ids.length) continue;
    const details = await resolveDetailsCached(context, key, ids).catch(() => []);
    const counts = {};
    details.forEach(d => (d && d.attributes || []).forEach(a => {
      if (!a || !a.trait_type || a.value === undefined || a.value === '__no_trait__') return;
      const k = a.trait_type + '\u0000' + a.value;
      counts[k] = (counts[k] || 0) + 1;
    }));
    const traits = Object.keys(counts).map(k => {
      const [type, value] = k.split('\u0000');
      return { type, value, count: counts[k] };
    }).sort((a, b) => a.type.localeCompare(b.type) || a.value.localeCompare(String(b.value)));
    out.push({ key, label: TRADEABLE_COLLECTIONS[key].label, count: ids.length, traits });
  }
  return out;
}

export function ruleFromRow(row) {
  if (row.rule === 'open') return { kind: 'open' };
  if (row.rule === 'trait') return { kind: 'trait', collection: row.collection, traitType: row.trait_type, traitValue: row.trait_value };
  return { kind: 'collection', collection: row.collection };
}

export async function isMember(env, groupId, wallet) {
  const row = await env.MESSAGES_DB.prepare('SELECT 1 AS m FROM chat_group_members WHERE group_id = ?1 AND wallet = ?2').bind(groupId, wallet).first();
  return !!row;
}
