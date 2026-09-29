// Pretty link: soitbegins.xyz/fuzzyall — same SWAP page as /static, just
// pre-selected to FUZZY (ALL — Fuzzybears + yzzuf). See renderSwap in ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'fuzzyall');
}
