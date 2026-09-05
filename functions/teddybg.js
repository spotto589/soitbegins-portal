// Pretty link: soitbegins.xyz/teddybg — same SWAP page as /static, just
// pre-selected to TEDDY. See renderSwap in ./static.js and pigeons.js's
// own comment — one shared page/database across every collection route.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'teddybg');
}
