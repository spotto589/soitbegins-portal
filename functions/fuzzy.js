// Pretty link: soitbegins.xyz/fuzzy — same SWAP page as /static, just
// pre-selected to FUZZY. See renderSwap in ./static.js and pigeons.js's
// own comment — one shared page/database across every collection route.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'fuzzy');
}
