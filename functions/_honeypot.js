// H0NEYP0T burn chain (2026-10-02). One collection, one issuer, one taxon:
//   Honeypot #N  --burn-->  Ash #k  --burn-->  Phoenix | <N in Roman>
//   --burn--> Phase 2 Phoenix --burn--> Phase 3 Phoenix
// The Phoenix keeps its Honeypot's number (Honeypot #340 -> Phoenix | CCCXL),
// but Ash numbers are handed out by hand in burn order, so the
// Honeypot -> Ash link can't be read off the ledger. HONEYPOT_TO_ASH is the
// owner's own list — add a line here whenever a new Ash is minted.

export const HONEYPOT_ISSUER = 'raNypRjrVu98Rp3AYLRhQBDUeJKyyRRV92';
export const HONEYPOT_ISSUER_HEX = '397CCDAB554D69B034DBB4042C29C6B714F05045';
export const HONEYPOT_TAXON = 123589321;

export const HONEYPOT_TO_ASH = {
  180: 0, 200: 1, 557: 2, 247: 3, 486: 4, 62: 5, 231: 6, 326: 7, 421: 8, 564: 9,
  355: 10, 568: 11, 112: 12, 513: 13, 511: 14, 541: 15, 515: 16, 562: 17, 344: 18, 324: 19,
  551: 20, 340: 21, 28: 22, 524: 23, 244: 24, 431: 25, 78: 26, 529: 27, 472: 28, 131: 29,
  586: 30, 363: 31, 452: 32, 253: 33, 320: 34, 395: 35, 174: 36, 58: 37, 38: 38, 583: 39,
  181: 40, 35: 41, 561: 42, 229: 43, 214: 44, 553: 45, 495: 46, 182: 47, 46: 48, 148: 49,
  92: 50, 70: 51, 412: 52, 440: 53, 437: 54, 212: 55, 356: 56, 223: 57, 343: 58, 508: 59,
  383: 60, 427: 61, 220: 62, 14: 63, 272: 64, 121: 65, 482: 66, 10: 67, 203: 68, 68: 69,
  338: 70, 170: 71, 80: 72, 207: 73, 239: 74, 578: 75, 40: 76, 218: 77, 282: 78, 469: 79,
  49: 80, 27: 81, 179: 82, 51: 83, 23: 84, 157: 85, 278: 86, 438: 87, 526: 88, 335: 89,
  531: 90, 16: 91, 163: 92, 346: 93, 230: 94, 245: 95, 434: 96, 293: 97, 119: 98, 463: 99,
  19: 100, 99: 101, 428: 102, 187: 103, 368: 104, 555: 105
};

// Burned for something other than an Ash.
export const HONEYPOT_SPECIAL = { 575: 'Sweet Honey #1' };

const ROMAN = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function toRoman(n) {
  let s = '';
  for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; }
  return s;
}
export function fromRoman(s) {
  const v = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const a = v[s[i]], b = v[s[i + 1]] || 0;
    if (!a) return null;
    total += a < b ? -a : a;
  }
  return total;
}

// What an NFT is, from its metadata name.
export function honeypotKind(name) {
  let m;
  if ((m = /^Honeypot\s*#\s*(\d+)/i.exec(name || ''))) return { kind: 'honeypot', num: +m[1], hp: +m[1] };
  if ((m = /^Ash\s*#\s*(\d+)/i.exec(name || ''))) return { kind: 'ash', num: +m[1], hp: null };
  if ((m = /^Phoenix\s*\|\s*([IVXLCDM]+)/i.exec(name || ''))) { const n = fromRoman(m[1].toUpperCase()); return { kind: 'phoenix', num: n, hp: n }; }
  return { kind: 'other', num: null, hp: null };
}

export const ASH_TO_HONEYPOT = Object.fromEntries(Object.entries(HONEYPOT_TO_ASH).map(([hp, ash]) => [ash, +hp]));

// ipfs://x, ipfs//x (one live NFT has this typo) -> https://ipfs.io/ipfs/x
export function canonicalIpfs(uri) {
  if (!uri) return '';
  const m = /^ipfs:?\/\/(?:ipfs\/)?(.+)$/i.exec(uri.trim());
  return m ? 'https://ipfs.io/ipfs/' + m[1] : uri.trim();
}
