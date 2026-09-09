// Pretty link: soitbegins.xyz/smoki — same SWAP page as /static, just
// pre-selected to SM0K!. See renderSwap in ./static.js and pigeons.js's
// own comment — one shared page/database across every collection route.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'smoki');
}
