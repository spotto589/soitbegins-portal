// Rebuilds assets/honeypot/snapshot.json: every NFT the Honeypot issuer has
// minted in its taxon, every burn of one (oldest first), and each NFT's
// metadata. /api/honeypot-burns starts from this file and only reads the
// ledger AFTER snapshot.lastLedger, so rerun it now and then to keep that
// live read short:   node scripts/honeypot-snapshot.mjs
// Metadata is cached in scripts/.honeypot-meta-cache.json between runs.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { HONEYPOT_ISSUER, HONEYPOT_TAXON, canonicalIpfs } from '../functions/_honeypot.js';

const ENDPOINTS = ['https://xrplcluster.com/', 'https://s1.ripple.com:51234/', 'https://s2.ripple.com:51234/'];
const GATEWAYS = ['https://ipfs.filebase.io/ipfs/', 'https://gateway.pinata.cloud/ipfs/', 'https://dweb.link/ipfs/'];
const RIPPLE_EPOCH = 946684800;
const cacheFile = new URL('./.honeypot-meta-cache.json', import.meta.url);
const cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf8')) : {};

async function rpc(method, params) {
  for (let i = 0; i < 8; i++) {
    try {
      const r = await fetch(ENDPOINTS[i % ENDPOINTS.length], { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method, params: [params] }) });
      const j = await r.json();
      if (j.result && j.result.status === 'success') return j.result;
    } catch {}
    await new Promise(res => setTimeout(res, 1000 * (i + 1)));
  }
  throw new Error(method + ' failed');
}

async function meta(uri) {
  const url = canonicalIpfs(uri);
  if (!url) return null;
  if (cache[url]) return cache[url];
  const path = url.replace('https://ipfs.io/ipfs/', '');
  const targets = url.startsWith('https://ipfs.io/ipfs/') ? GATEWAYS.map(g => g + path) : [url];
  for (const t of targets) {
    try {
      const r = await fetch(t, { signal: AbortSignal.timeout(20000) });
      if (r.ok) { const j = await r.json(); return (cache[url] = { name: j.name || '', attributes: Array.isArray(j.attributes) ? j.attributes.map(a => [a.trait_type, a.value]) : [], image: canonicalIpfs(j.image || '') }); }
    } catch {}
  }
  return null;
}

// Every NFT in the taxon, live or burned.
const nfts = {};
let marker;
do {
  const res = await rpc('nfts_by_issuer', { issuer: HONEYPOT_ISSUER, nft_taxon: HONEYPOT_TAXON, limit: 400, ...(marker ? { marker } : {}) });
  for (const n of res.nfts) nfts[n.nft_id] = canonicalIpfs(n.uri ? Buffer.from(n.uri, 'hex').toString('utf8') : '');
  marker = res.marker;
} while (marker);

// Every burn of one, oldest first. Holder burns touch the issuer's account
// too (its BurnedNFTokens counter), so the issuer's history has them all.
const burns = [];
let lastLedger = 0;
marker = undefined;
do {
  const res = await rpc('account_tx', { account: HONEYPOT_ISSUER, ledger_index_min: -1, ledger_index_max: -1, forward: true, limit: 400, ...(marker ? { marker } : {}) });
  for (const t of res.transactions) {
    const tx = t.tx || t.tx_json;
    lastLedger = Math.max(lastLedger, tx.ledger_index || t.ledger_index || 0);
    if (tx.TransactionType !== 'NFTokenBurn' || t.meta.TransactionResult !== 'tesSUCCESS') continue;
    if (!(tx.NFTokenID in nfts)) continue; // another issuer's NFT, or another taxon
    burns.push({ id: tx.NFTokenID, ledger: tx.ledger_index || t.ledger_index, t: tx.date + RIPPLE_EPOCH, hash: tx.hash || t.hash, by: tx.Account });
  }
  marker = res.marker;
} while (marker);

const metaOut = {};
const uris = [...new Set(Object.values(nfts).filter(Boolean))];
for (let i = 0; i < uris.length; i += 3) {
  await Promise.all(uris.slice(i, i + 3).map(async u => { const m = await meta(u); if (m) metaOut[u] = m; }));
  process.stdout.write(`\rmetadata ${Math.min(i + 3, uris.length)}/${uris.length}   `);
}
process.stdout.write('\n');
writeFileSync(cacheFile, JSON.stringify(cache));

const out = { lastLedger, built: new Date().toISOString(), nfts, burns, meta: metaOut };
mkdirSync(new URL('../assets/honeypot/', import.meta.url), { recursive: true });
writeFileSync(new URL('../assets/honeypot/snapshot.json', import.meta.url), JSON.stringify(out));
const issuerInfo = await rpc('account_info', { account: HONEYPOT_ISSUER, ledger_index: 'validated' });
console.log(`${Object.keys(nfts).length} NFTs, ${burns.length} burns in taxon (issuer's ledger counter, all taxons: ${issuerInfo.account_data.BurnedNFTokens}), ${uris.length - Object.keys(metaOut).length} without metadata, up to ledger ${lastLedger}`);
