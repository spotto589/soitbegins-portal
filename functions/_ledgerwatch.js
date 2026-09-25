import {
  fetchXrplClusterJson, getPigeonNumberMap, TRADEABLE_COLLECTIONS, safeKvPut,
  mapWithConcurrency, floorEntryForNft, patchFloorIndex
} from './_shared.js';

// ─────────────────────────────────────────────────────────────────────────
// LEDGER WATCHER (2026-09-25) — runs every minute from cron-worker/.
// Reads every new validated XRPL ledger, picks out NFT activity for the
// site's collections, and:
//   - records it as events (listing, delist, sale, transfer, mint, burn,
//     offer, offer_cancel) per collection — the feed notifications read;
//   - re-checks the XRP floor for any Pigeon whose sell offers changed and
//     patches the floor index at once (minute-fresh listings, instead of
//     waiting for the slow full crawl).
// KV writes happen only when something changed, plus one cursor write
// per tick.
// ─────────────────────────────────────────────────────────────────────────
const LW_CURSOR_KEY = 'pswap:lw:cursor:v1';
const LW_LOCK_KEY = 'pswap:lw:lock:v1';
const LW_EVENTS_PREFIX = 'pswap:events:v1:';
const LW_EVENTS_MAX = 300;
const LW_MAX_LEDGERS_PER_TICK = 40; // ~2.5 min of ledgers; a minute is ~15-20
const LW_MAX_BACKLOG = 200;         // further behind than this (an outage): skip ahead
const LW_CONCURRENCY = 5;
const LW_LOCK_SECONDS = 55;
const RIPPLE_EPOCH = 946684800;
const TF_SELL = 1;

export function eventsKey(collectionKey) { return LW_EVENTS_PREFIX + collectionKey; }
export async function getCollectionEvents(kv, collectionKey) {
  const raw = await kv.get(eventsKey(collectionKey));
  return raw ? JSON.parse(raw) : [];
}

// NFTokenID layout: flags(4 hex) fee(4) issuer(40) scrambled taxon(8) seq(8).
export function nftIssuerHex(id) { return id.slice(8, 48).toUpperCase(); }
export function nftTaxon(id) {
  const seq = parseInt(id.slice(56, 64), 16) >>> 0;
  const scrambled = parseInt(id.slice(48, 56), 16) >>> 0;
  return (scrambled ^ ((Math.imul(384160001, seq) + 2459) >>> 0)) >>> 0;
}

// nftId -> collection, plus issuer+taxon signatures (so brand-new mints,
// not yet in any number map, are recognised too). Cached per isolate.
let collectionIndexCache = null;
async function collectionIndex(kv) {
  if (collectionIndexCache && Date.now() - collectionIndexCache.at < 10 * 60 * 1000) return collectionIndexCache;
  const byId = {};
  const sigs = {};
  const numbers = {};
  for (const key of Object.keys(TRADEABLE_COLLECTIONS)) {
    const map = await getPigeonNumberMap(kv, key).catch(() => ({}));
    Object.keys(map).forEach(n => {
      const id = String(map[n]).toUpperCase();
      byId[id] = key;
      numbers[id] = Number(n);
      sigs[nftIssuerHex(id) + ':' + nftTaxon(id)] = key;
    });
  }
  collectionIndexCache = { byId, sigs, numbers, at: Date.now() };
  return collectionIndexCache;
}
function collectionOf(idx, nftId) {
  if (!nftId) return null;
  const id = nftId.toUpperCase();
  return idx.byId[id] || idx.sigs[nftIssuerHex(id) + ':' + nftTaxon(id)] || null;
}

function amountOf(a) {
  if (a === undefined || a === null) return null;
  if (typeof a === 'string') return { xrp: parseInt(a, 10) / 1e6 };
  return { value: a.value, currency: a.currency, issuer: a.issuer };
}
function isZero(a) { return a === '0' || (a && typeof a === 'object' && Number(a.value) === 0); }
function nodesOf(meta, kind, type) {
  return ((meta && meta.AffectedNodes) || []).map(n => n[kind]).filter(n => n && n.LedgerEntryType === type);
}
// NFTs that appeared in an NFTokenPage (mints): FinalFields/NewFields minus PreviousFields.
function nftsAddedToPages(meta) {
  const out = [];
  ((meta && meta.AffectedNodes) || []).forEach(n => {
    const node = n.CreatedNode || n.ModifiedNode;
    if (!node || node.LedgerEntryType !== 'NFTokenPage') return;
    const after = ((node.FinalFields || node.NewFields || {}).NFTokens || []).map(t => t.NFToken.NFTokenID);
    const before = new Set(((node.PreviousFields || {}).NFTokens || []).map(t => t.NFToken.NFTokenID));
    if (n.ModifiedNode && !node.PreviousFields) return; // page touched but token list unchanged
    after.forEach(id => { if (!before.has(id)) out.push(id); });
  });
  return out;
}

// One transaction -> zero or more raw events (collection resolved later).
export function classifyNftTx(tx, meta) {
  if (!meta || meta.TransactionResult !== 'tesSUCCESS') return [];
  const t = tx.TransactionType;
  const base = { hash: tx.hash, account: tx.Account };
  if (t === 'NFTokenCreateOffer') {
    const sell = (tx.Flags & TF_SELL) === TF_SELL;
    if (sell && isZero(tx.Amount)) return [{ ...base, type: 'transfer_offer', nftId: tx.NFTokenID, from: tx.Account, to: tx.Destination || null }];
    return [{ ...base, type: sell ? 'listing' : 'offer', nftId: tx.NFTokenID, price: amountOf(tx.Amount),
      from: sell ? tx.Account : (tx.Owner || null), to: sell ? (tx.Destination || null) : tx.Account, destination: tx.Destination || null }];
  }
  if (t === 'NFTokenCancelOffer') {
    return nodesOf(meta, 'DeletedNode', 'NFTokenOffer').map(n => {
      const f = n.FinalFields || {};
      const sell = (f.Flags & TF_SELL) === TF_SELL;
      return { ...base, type: sell ? 'delist' : 'offer_cancel', nftId: f.NFTokenID, price: amountOf(f.Amount), from: f.Owner };
    });
  }
  if (t === 'NFTokenAcceptOffer') {
    const offers = nodesOf(meta, 'DeletedNode', 'NFTokenOffer').map(n => n.FinalFields || {});
    const sellO = offers.find(f => (f.Flags & TF_SELL) === TF_SELL);
    const buyO = offers.find(f => (f.Flags & TF_SELL) !== TF_SELL);
    const nftId = (meta.nftoken_id) || (sellO && sellO.NFTokenID) || (buyO && buyO.NFTokenID);
    const seller = sellO ? sellO.Owner : tx.Account;
    const buyer = buyO ? buyO.Owner : tx.Account;
    const paid = buyO ? buyO.Amount : (sellO ? sellO.Amount : null);
    if (paid === null || isZero(paid)) return [{ ...base, type: 'transfer', nftId, from: seller, to: buyer }];
    return [{ ...base, type: 'sale', nftId, price: amountOf(paid), from: seller, to: buyer, broker: sellO && buyO ? tx.Account : null }];
  }
  if (t === 'NFTokenMint') {
    const ids = meta.nftoken_id ? [meta.nftoken_id] : nftsAddedToPages(meta);
    return ids.map(nftId => ({ ...base, type: 'mint', nftId, to: tx.Owner || tx.Account }));
  }
  if (t === 'NFTokenBurn') return [{ ...base, type: 'burn', nftId: tx.NFTokenID, from: tx.Owner || tx.Account }];
  return [];
}

async function validatedLedgerIndex() {
  const d = await fetchXrplClusterJson({ method: 'ledger', params: [{ ledger_index: 'validated' }] });
  const i = d && d.result && (d.result.ledger_index || (d.result.ledger && d.result.ledger.ledger_index));
  return i ? Number(i) : null;
}
async function ledgerTxs(index) {
  const d = await fetchXrplClusterJson({ method: 'ledger', params: [{ ledger_index: index, transactions: true, expand: true }] });
  const l = d && d.result && d.result.ledger;
  if (!l) return null;
  const time = l.close_time ? (Number(l.close_time) + RIPPLE_EPOCH) : Math.floor(Date.now() / 1000);
  return { index, time, txs: (l.transactions || []).map(tx => ({ tx, meta: tx.metaData || tx.meta })) };
}

// Pure part (tested in isolation): ledgers -> events grouped by collection.
export function eventsFromLedgers(ledgers, idx) {
  const byCollection = {};
  ledgers.forEach(l => {
    l.txs.forEach(({ tx, meta }) => {
      if (!tx || !String(tx.TransactionType || '').startsWith('NFToken')) return;
      classifyNftTx(tx, meta).forEach(ev => {
        const collection = collectionOf(idx, ev.nftId);
        if (!collection) return;
        const id = ev.nftId.toUpperCase();
        (byCollection[collection] = byCollection[collection] || []).push({
          ...ev, nftId: id, collection, number: idx.numbers[id] || null, ledger: l.index, time: l.time
        });
      });
    });
  });
  return byCollection;
}

export async function runLedgerWatch(kv, opts) {
  opts = opts || {};
  const now = Math.floor(Date.now() / 1000);
  const lock = await kv.get(LW_LOCK_KEY);
  if (lock && now - Number(lock) < LW_LOCK_SECONDS) return { skipped: 'locked' };
  await safeKvPut(kv, LW_LOCK_KEY, String(now), { expirationTtl: 120 });
  try {
    const current = await validatedLedgerIndex();
    if (!current) return { skipped: 'no_ledger' };
    let cursor = Number(await kv.get(LW_CURSOR_KEY)) || (current - 1);
    if (current - cursor > LW_MAX_BACKLOG) cursor = current - LW_MAX_LEDGERS_PER_TICK;
    const to = Math.min(current, cursor + LW_MAX_LEDGERS_PER_TICK);
    if (to <= cursor) return { skipped: 'up_to_date' };
    const indexes = [];
    for (let i = cursor + 1; i <= to; i++) indexes.push(i);
    const ledgers = await mapWithConcurrency(indexes, LW_CONCURRENCY, i => ledgerTxs(i));
    // Stop at the first ledger we couldn't read, so it's retried next tick.
    const got = [];
    for (const l of ledgers) { if (!l) break; got.push(l); }
    if (!got.length) return { skipped: 'fetch_failed' };

    const idx = await collectionIndex(kv);
    const byCollection = eventsFromLedgers(got, idx);

    for (const key of Object.keys(byCollection)) {
      const existing = await getCollectionEvents(kv, key);
      const seen = new Set(existing.map(e => e.hash + ':' + e.type + ':' + e.nftId));
      const fresh = byCollection[key].filter(e => !seen.has(e.hash + ':' + e.type + ':' + e.nftId));
      if (!fresh.length) continue;
      const list = fresh.reverse().concat(existing).slice(0, LW_EVENTS_MAX); // newest first
      await safeKvPut(kv, eventsKey(key), JSON.stringify(list));
    }

    // Minute-fresh XRP floor for Pigeons (the only collection with a floor index).
    const touched = new Set();
    (byCollection.pigeons || []).forEach(e => {
      if (['listing', 'delist', 'sale', 'transfer', 'burn'].indexOf(e.type) !== -1) touched.add(e.nftId);
    });
    if (touched.size && !opts.skipFloor) {
      const ids = Array.from(touched);
      const entries = {};
      const results = await mapWithConcurrency(ids, 4, id => floorEntryForNft(id, idx.numbers[id] || null).catch(() => undefined));
      ids.forEach((id, i) => { if (results[i] !== undefined) entries[id] = results[i]; });
      await patchFloorIndex(kv, entries);
    }

    await safeKvPut(kv, LW_CURSOR_KEY, String(got[got.length - 1].index));
    const counts = {};
    Object.keys(byCollection).forEach(k => { counts[k] = byCollection[k].length; });
    return { from: cursor + 1, to: got[got.length - 1].index, events: counts, floorPatched: touched.size };
  } finally {
    await kv.delete(LW_LOCK_KEY).catch(() => {});
  }
}
