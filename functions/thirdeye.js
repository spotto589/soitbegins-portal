// Pretty link: soitbegins.xyz/thirdeye — same SWAP page as /static, just
// pre-selected to 3RD EYE. See renderSwap in ./static.js and pigeons.js's
// own comment — one shared page/database across every collection route.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'thirdeye');
}
