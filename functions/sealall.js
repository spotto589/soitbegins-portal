// Pretty link: soitbegins.xyz/sealall — same SWAP page as /static, just
// pre-selected to SEAL (ALL — Seals + Scrolls). See renderSwap in ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'sealall');
}
