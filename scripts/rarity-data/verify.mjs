// Check soitbegins.xyz's RARITY SCORE for yourself — no trust needed.
//
// 1. Download the snapshot and its seal from the site (or build your own
//    with build-snapshot.mjs, straight from the XRP Ledger + IPFS):
//      https://soitbegins.xyz/assets/rarity-data/pigeons-traits.json
//      https://soitbegins.xyz/assets/rarity-data/pigeons-traits.json.sha256
// 2. Run:  node verify.mjs pigeons-traits.json [pigeon number]
//
// It checks the file against its seal, then recomputes every RARITY
// SCORE from scratch with the same rule the site uses:
//
//   for every trait category:  score += 100 ÷ (% of the collection with
//                              this Pigeon's value)
//   (a missing category counts as its own "no trait" value)
//
// and prints the ranking. Compare it with the site.

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const file = process.argv[2];
const lookup = process.argv[3] ? parseInt(process.argv[3], 10) : null;
if (!file) { console.error('usage: node verify.mjs <collection>-traits.json [number]'); process.exit(1); }

const bytes = readFileSync(file);
const hash = createHash('sha256').update(bytes).digest('hex');
console.log('sha256 ' + hash);
if (existsSync(file + '.sha256')) {
  const sealed = readFileSync(file + '.sha256', 'utf8').trim().split(/\s+/)[0];
  console.log(sealed === hash ? 'SEAL OK — file is unchanged' : 'SEAL MISMATCH — file differs from its published seal');
}

const snap = JSON.parse(bytes);
const items = snap.items;
const size = items.length;
const NONE = '__no_trait__';

const categories = new Set();
for (const it of items) for (const a of it.attributes) categories.add(a.trait_type);
const count = {};
for (const it of items) {
  for (const c of categories) {
    const a = it.attributes.find(x => x.trait_type === c);
    const v = a ? a.value : NONE;
    count[c] = count[c] || {};
    count[c][v] = (count[c][v] || 0) + 1;
  }
}

const scored = items.map(it => {
  let score = 0;
  const rows = [];
  for (const c of categories) {
    const a = it.attributes.find(x => x.trait_type === c);
    const v = a ? a.value : NONE;
    const pct = count[c][v] / size * 100;
    score += 100 / pct;
    rows.push([c, v === NONE ? 'NONE' : v, pct, 100 / pct]);
  }
  return { number: it.number, nftId: it.nftId, score, rows };
});
// Highest score = rarest. Ties: lower number first.
scored.sort((a, b) => b.score - a.score || (a.number ?? 1e9) - (b.number ?? 1e9));
scored.forEach((s, i) => { s.rank = i + 1; });

console.log(snap.collection + ': ' + size + ' NFTs, XRP Ledger ' + snap.ledgerIndex);
if (lookup !== null) {
  const s = scored.find(x => x.number === lookup);
  if (!s) { console.log('#' + lookup + ' not found'); process.exit(1); }
  console.log('\n#' + s.number + '  rank ' + s.rank + ' / ' + size + '  score ' + s.score.toFixed(3));
  for (const [c, v, pct, pts] of s.rows.sort((a, b) => a[2] - b[2])) {
    console.log('  ' + c + ': ' + v + '  ' + pct.toFixed(3) + '%  -> 100 / ' + pct.toFixed(3) + ' = ' + pts.toFixed(2));
  }
} else {
  console.log('\nrank  number  score');
  for (const s of scored.slice(0, 25)) console.log(String(s.rank).padStart(4) + '  #' + String(s.number).padEnd(6) + s.score.toFixed(3));
}
