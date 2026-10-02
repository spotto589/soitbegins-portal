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
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COLLECTIONS = {
  pigeons: {
    issuer: 'rpigeoNwEPTN5JGWGQ8MCoa7SpQpz1537v',
    taxon: 1,
    // Metadata names look like "PIGEONS1875".
    numberFromName: name => { const m = String(name || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : null; },
  },
  king: {
    issuer: 'rKingAa11yp4eCuxVraesW2UAvz5THWNCy',
    taxon: 123,
    // Metadata names look like "KING #120".
    numberFromName: name => { const m = String(name || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : null; },
  },
  // FUZZY (2026-09-29). Names "Fuzzybear #2289", "raebyzzuF #56",
  // "Fuzzy Bar #2740". yzzuf's own metadata is written backwards
  // ("ruF", "dnuorgkcaB") and is stored exactly as published.
  fuzzy: {
    issuer: 'rw1R8cfHGMySmbj7gJ1HkiCqTY1xhLGYAs',
    taxon: 1,
    numberFromName: name => { const m = String(name || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : null; },
  },
  yzzuf: {
    issuer: 'r3NftTqH2hv3skuWAEDWKvqnxjtuqcFWYR',
    taxon: 0,
    numberFromName: name => { const m = String(name || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : null; },
  },
  fuzzybars: {
    issuer: 'rPK77tBNduykbofMU91uffeRSUvtEkadbx',
    taxon: 1,
    numberFromName: name => { const m = String(name || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : null; },
  },
  // Every other collection (2026-09-29). Issuer/taxon read straight out of
  // the collections' own NFT IDs (an NFTokenID encodes both).
  seal: { issuer: 'rst9Sq8mVxK8b7BbgFs4VmnVtfm7N2qN4j', taxon: 1 },
  sealscrolls: { issuer: 'rUSdvkwdGnU8qpfRR2sa1h7JExzBi7fUHr', taxon: 2 },
  phnixs: { issuer: 'rMiNJh6eQE5fSpgke5vrjUGiU9rXhrgoSA', taxon: 1 },
  teddybg: { issuer: 'rwYNpdWqnjB43doyurzezv2yRvgMMABDGy', taxon: 0 },
  conspiracy: { issuer: 'r447JrNyi61jstafY19bMsddhUxEhfJCSe', taxon: 2 },
  whiterabbit: { issuer: 'rLTjw8JXWZfVAXwAWy1SvvDTSjh2iG3icj', taxon: 1 },
  bear: { issuer: 'rBEARbo4Prn33894evmvYcAf9yAQjp4VJF', taxon: 0 },
  cult: { issuer: 'rwXtqbb49G4eDyikLv77JEHCx25eH3pCsx', taxon: 69 },
  // SHITTY PANTHER CLUB (2026-10-02). Names "Shitty Panther #123".
  panther: { issuer: 'rGnivxmi1yAu15Kou1nqt91ZxtXhkWB2iM', taxon: 0 },
};
// Default: the first run of digits in the NFT's own name ("SEAL 657").
for (const c of Object.values(COLLECTIONS)) {
  if (!c.numberFromName) c.numberFromName = name => { const m = String(name || '').match(/(\d+)/); return m ? parseInt(m[1], 10) : null; };
}

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

// Optional resume cache (RARITY_CACHE_DIR=some/folder): each fetched
// metadata file is kept there, so a run cut short by a gateway timeout
// picks up where it stopped. IPFS content never changes for an address,
// so a cached copy is exactly what a gateway would return again.
const CACHE_DIR = process.env.RARITY_CACHE_DIR || null;
if (CACHE_DIR) mkdirSync(CACHE_DIR, { recursive: true });
async function fetchMetadata(uri) {
  const path = uri.replace(/^ipfs:\/\//, '');
  const cacheFile = CACHE_DIR ? join(CACHE_DIR, path.replace(/[^A-Za-z0-9._-]/g, '_')) : null;
  if (cacheFile && existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'));
  let lastErr;
  for (let round = 0; round < 6; round++) {
    for (const g of GATEWAYS) {
      try {
        // Each path part URL-encoded — some file names have spaces or "#"
        // ("raebyzzuF #56.json"), which would otherwise cut the address.
        const res = await fetch(g + path.split('/').map(encodeURIComponent).join('/'), { signal: AbortSignal.timeout(30000) });
        if (!res.ok) throw new Error(g + ' HTTP ' + res.status);
        const text = await res.text();
        const json = JSON.parse(text);
        if (cacheFile) writeFileSync(cacheFile, text);
        return json;
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
