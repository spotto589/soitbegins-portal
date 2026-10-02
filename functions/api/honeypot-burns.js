// GET /api/honeypot-burns — every H0NEYP0T-taxon burn, oldest first, with
// each burned NFT's name/traits/image and where it sits in the
// Honeypot -> Ash -> Phoenix -> Phase 2 -> Phase 3 chain, plus what's still
// owed (burned but its next stage not minted yet).
// Starts from assets/honeypot/snapshot.json (scripts/honeypot-snapshot.mjs)
// and reads only the issuer's ledger history after snapshot.lastLedger, so
// new mints and burns show up within a minute without any KV writes.
import { fetchXrplClusterJson, fetchIpfs, proxyIpfsImage } from '../_shared.js';
import { HONEYPOT_ISSUER, HONEYPOT_ISSUER_HEX, HONEYPOT_TAXON, HONEYPOT_TO_ASH, HONEYPOT_SPECIAL, ASH_TO_HONEYPOT, toRoman, honeypotKind, canonicalIpfs } from '../_honeypot.js';

const RIPPLE_EPOCH = 946684800;
const CACHE_SECONDS = 60;

function hexToUtf8(hex) {
  const bytes = new Uint8Array((hex || '').match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || []);
  return new TextDecoder().decode(bytes);
}

// NFTokenID = flags(4) fee(4) issuer(40) scrambledTaxon(8) sequence(8)
function taxonOf(id) {
  const seq = parseInt(id.slice(56, 64), 16);
  const scrambled = parseInt(id.slice(48, 56), 16);
  return (scrambled ^ ((Math.imul(384160001, seq) + 2459) >>> 0)) >>> 0;
}
function isOurs(id) {
  return typeof id === 'string' && id.length === 64 && id.slice(8, 48).toUpperCase() === HONEYPOT_ISSUER_HEX && taxonOf(id) === HONEYPOT_TAXON;
}

// Mints and burns since the snapshot. Gives up quietly (returns what it has)
// if the ledger is unreachable — the snapshot alone is still a full answer
// up to its own ledger.
async function readNewTxs(fromLedger) {
  const mints = [], burns = [];
  let marker, pages = 0, lastLedger = fromLedger - 1;
  do {
    const params = { account: HONEYPOT_ISSUER, ledger_index_min: fromLedger, ledger_index_max: -1, forward: true, limit: 200 };
    if (marker) params.marker = marker;
    const data = await fetchXrplClusterJson({ method: 'account_tx', params: [params] }).catch(() => null);
    const res = data && data.result;
    if (!res || !Array.isArray(res.transactions)) break;
    for (const t of res.transactions) {
      const tx = t.tx || t.tx_json || {};
      const ledger = tx.ledger_index || t.ledger_index;
      if (ledger > lastLedger) lastLedger = ledger;
      if (!t.meta || t.meta.TransactionResult !== 'tesSUCCESS') continue;
      if (tx.TransactionType === 'NFTokenMint' && t.meta.nftoken_id && isOurs(t.meta.nftoken_id)) {
        mints.push({ id: t.meta.nftoken_id, uri: canonicalIpfs(hexToUtf8(tx.URI)) });
      } else if (tx.TransactionType === 'NFTokenBurn' && isOurs(tx.NFTokenID)) {
        burns.push({ id: tx.NFTokenID, ledger, t: tx.date + RIPPLE_EPOCH, hash: tx.hash || t.hash, by: tx.Account });
      }
    }
    marker = res.marker;
  } while (marker && ++pages < 10);
  return { mints, burns, lastLedger };
}

async function fetchMeta(uri) {
  try {
    const res = await fetchIpfs(uri, { timeoutMs: 6000 });
    if (!res.ok) return null;
    const j = await res.json();
    return { name: j.name || '', attributes: Array.isArray(j.attributes) ? j.attributes.map(a => [a.trait_type, a.value]) : [], image: canonicalIpfs(j.image || '') };
  } catch (e) {
    return null;
  }
}

async function buildBurns(context) {
  const { env, request } = context;
  const snapRes = await env.ASSETS.fetch(new URL('/assets/honeypot/snapshot.json', request.url));
  const snap = await snapRes.json();
  const nfts = snap.nfts;
  const meta = snap.meta;
  const burns = snap.burns.slice();

  const fresh = await readNewTxs(snap.lastLedger + 1);
  for (const m of fresh.mints) if (!(m.id in nfts)) nfts[m.id] = m.uri;
  const seen = new Set(burns.map(b => b.hash));
  for (const b of fresh.burns) if (!seen.has(b.hash)) burns.push(b);

  // Metadata for anything minted since the snapshot (a handful at most).
  // Not the snapshot's own gaps — those files are gone from IPFS and would
  // just burn 6s of timeouts on every rebuild.
  const missing = [...new Set(fresh.mints.map(m => m.uri).filter(u => u && !meta[u]))].slice(0, 12);
  await Promise.all(missing.map(async u => { const m = await fetchMeta(u); if (m) meta[u] = m; }));

  const burnedIds = new Set(burns.map(b => b.id));
  // Find any stage of the chain by its number.
  const byKey = {};
  for (const [id, uri] of Object.entries(nfts)) {
    const m = meta[uri];
    if (!m) continue;
    const k = honeypotKind(m.name);
    if (k.kind !== 'other') byKey[k.kind + ':' + k.num] = { id, name: m.name, burned: burnedIds.has(id) };
  }
  const state = (key) => byKey[key] ? (byKey[key].burned ? 'burned' : 'live') : null;

  // The whole chain an NFT belongs to, as a list of stages.
  function chainFor(kind, num) {
    let hp = kind === 'ash' ? ASH_TO_HONEYPOT[num] : (kind === 'honeypot' || kind === 'phoenix' ? num : null);
    if (hp == null && kind !== 'ash') return null;
    const ash = kind === 'ash' ? num : HONEYPOT_TO_ASH[hp];
    const special = hp != null ? HONEYPOT_SPECIAL[hp] : null;
    const hpState = hp != null ? state('honeypot:' + hp) : null;
    const ashState = ash != null ? state('ash:' + ash) : null;
    const phxState = hp != null ? state('phoenix:' + hp) : null;
    const stages = [];
    stages.push({ stage: 'honeypot', label: hp != null ? 'Honeypot #' + hp : 'Honeypot (not on the list)', num: hp, status: hpState || 'unknown' });
    if (special) {
      stages.push({ stage: 'special', label: special, status: 'live' });
      return stages;
    }
    stages.push({ stage: 'ash', label: ash != null ? 'Ash #' + ash : 'Ash', num: ash, status: ashState || (hpState === 'burned' ? 'owed' : 'waiting') });
    stages.push({ stage: 'phoenix', label: hp != null ? 'Phoenix | ' + toRoman(hp) : 'Phoenix', num: hp, status: phxState || (ashState === 'burned' ? 'owed' : 'waiting') });
    stages.push({ stage: 'phase2', label: 'Phase 2 Phoenix', status: phxState === 'burned' ? 'owed' : 'waiting' });
    stages.push({ stage: 'phase3', label: 'Phase 3 Phoenix', status: 'waiting' });
    return stages;
  }

  const items = burns.map((b, i) => {
    const uri = nfts[b.id] || '';
    const m = meta[uri] || null;
    const k = honeypotKind(m && m.name);
    return {
      n: i + 1,
      t: b.t,
      ledger: b.ledger,
      hash: b.hash,
      by: b.by,
      id: b.id,
      name: m ? m.name : '',
      kind: m ? k.kind : 'unknown',
      num: k.num,
      traits: m ? m.attributes : [],
      image: m && m.image ? proxyIpfsImage(m.image) : null,
      chain: m ? chainFor(k.kind, k.num) : null
    };
  });

  // Owed = burned, but the next stage hasn't been minted yet.
  const owed = { ash: [], phoenix: [], phase2: [] };
  for (const it of items) {
    if (!it.chain) continue;
    const stage = it.chain.find(s => s.stage === (it.kind === 'honeypot' ? 'ash' : it.kind === 'ash' ? 'phoenix' : it.kind === 'phoenix' ? 'phase2' : ''));
    if (stage && stage.status === 'owed') owed[it.kind === 'honeypot' ? 'ash' : it.kind === 'ash' ? 'phoenix' : 'phase2'].push({ n: it.n, name: it.name, next: stage.label });
  }

  const counts = { total: items.length, honeypot: 0, ash: 0, phoenix: 0, other: 0 };
  for (const it of items) counts[it.kind in counts ? it.kind : 'other']++;

  return { updatedLedger: Math.max(snap.lastLedger, fresh.lastLedger), issuer: HONEYPOT_ISSUER, taxon: HONEYPOT_TAXON, counts, owed, items };
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/honeypot-burns?v=1', context.request.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  let body;
  try {
    body = await buildBurns(context);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'C0ULDN\'T READ THE BURNS RIGHT N0W' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
  const res = new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } });
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
