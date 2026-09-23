// Builds a collection's TRAIT SNAPSHOT straight from the public record —
// no Deeptide, no soitbegins.xyz server involved:
//
//   1. XRP Ledger (Ripple's public Clio server, `nfts_by_issuer`) lists
//      every NFT the collection's issuer ever minted under its taxon,
//      each with its own on-ledger metadata URI.
//   2. Each URI points at a JSON file on IPFS (content-addressed: the
//      address IS a fingerprint of the file, so no gateway can alter it
//      without the address changing). Its `attributes` are the traits.
//
// Output (committed to the repo, served publicly by the site):
//   assets/rarity-data/<collection>-traits.json         the snapshot
//   assets/rarity-data/<collection>-traits.json.sha256  its SHA-256 seal
//
// The site's RARITY SCORE is computed from this exact file. Anyone can
// re-run this script, or check the file with verify.mjs, and get the
// same result.
//
// Usage:  node scripts/rarity-data/build-snapshot.mjs pigeons

import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COLLECTIONS = {
  pigeons: {
    issuer: 'rpigeoNwEPTN5JGWGQ8MCoa7SpQpz1537v',
    taxon: 1,
    // Metadata names look like "PIGEONS1875".
    numberFromName: name => { const m = String(name || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : null; },
  },
};

const CLIO = 'https://s2-clio.ripple.com';
// ipfs.io / dweb.link now refuse scripted requests (HTTP 429), so these
// are tried in turn. Any honest gateway returns identical bytes for the
// same IPFS address.
const GATEWAYS = [
  'https://ipfs.filebase.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://w3s.link/ipfs/',
  'https://4everland.io/ipfs/',
];
const CONCURRENCY = 8;

const key = process.argv[2];
const cfg = COLLECTIONS[key];
if (!cfg) {
  console.error('Unknown collection. Known: ' + Object.keys(COLLECTIONS).join(', '));
  process.exit(1);
}

async function listNfts() {
  const nfts = [];
  let marker, ledgerIndex = null;
  do {
    const params = { issuer: cfg.issuer, nft_taxon: cfg.taxon, limit: 100 };
    if (marker) params.marker = marker;
    if (ledgerIndex) params.ledger_index = ledgerIndex; // every page from the SAME ledger
    let result;
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(CLIO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'nfts_by_issuer', params: [params] }) });
        result = (await res.json()).result;
        if (result && !result.error) break;
        throw new Error(JSON.stringify(result && result.error));
      } catch (e) {
        if (attempt >= 5) throw new Error('Clio page failed: ' + e.message);
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    if (!ledgerIndex) ledgerIndex = result.ledger_index;
    for (const n of result.nfts || []) if (!n.is_burned) nfts.push(n);
    marker = result.marker;
    process.stdout.write('\rledger ' + ledgerIndex + ': ' + nfts.length + ' NFTs listed');
  } while (marker);
  process.stdout.write('\n');
  return { nfts, ledgerIndex };
}

async function fetchMetadata(uri) {
  const path = uri.replace(/^ipfs:\/\//, '');
  let lastErr;
  for (let round = 0; round < 3; round++) {
    for (const g of GATEWAYS) {
      try {
        const res = await fetch(g + path, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(g + ' HTTP ' + res.status);
        return await res.json();
      } catch (e) { lastErr = e; }
    }
    await new Promise(r => setTimeout(r, 2000 * (round + 1)));
  }
  throw new Error('metadata unreachable for ' + uri + ' (' + (lastErr && lastErr.message) + ')');
}

const { nfts, ledgerIndex } = await listNfts();
const items = [];
let done = 0, next = 0;
async function worker() {
  while (next < nfts.length) {
    const n = nfts[next++];
    const uri = Buffer.from(n.uri || '', 'hex').toString('utf8');
    const meta = await fetchMetadata(uri);
    items.push({
      nftId: n.nft_id,
      number: cfg.numberFromName(meta.name),
      uri,
      // Exactly as published in the metadata — no renaming, no trimming.
      attributes: (meta.attributes || []).map(a => ({ trait_type: a.trait_type, value: a.value })),
    });
    done++;
    if (done % 50 === 0 || done === nfts.length) process.stdout.write('\rmetadata ' + done + '/' + nfts.length);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
process.stdout.write('\n');

// Deterministic order so the same data always produces the same bytes
// (and therefore the same seal).
items.sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9) || a.nftId.localeCompare(b.nftId));

const header = {
  collection: key,
  issuer: cfg.issuer,
  taxon: cfg.taxon,
  ledgerIndex,
  source: 'XRP Ledger nfts_by_issuer (' + CLIO + ') + each NFT\'s own IPFS metadata',
  count: items.length,
};
// One item per line: readable, and a git diff shows exactly which NFT changed.
const body = JSON.stringify(header).slice(0, -1) + ',"items":[\n' + items.map(i => JSON.stringify(i)).join(',\n') + '\n]}\n';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'rarity-data');
mkdirSync(outDir, { recursive: true });
const file = key + '-traits.json';
writeFileSync(join(outDir, file), body);
const hash = createHash('sha256').update(body).digest('hex');
writeFileSync(join(outDir, file + '.sha256'), hash + '  ' + file + '\n');
console.log('wrote assets/rarity-data/' + file + ' (' + items.length + ' NFTs, ledger ' + ledgerIndex + ')');
console.log('sha256 ' + hash);
