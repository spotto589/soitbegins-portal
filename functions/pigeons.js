// Pretty link: soitbegins.xyz/pigeons — same SWAP page as /static, just
// pre-selected to P!GE0NS (also /static's own plain default, but this
// gives it a real, shareable, collection-scoped URL of its own). See
// renderSwap in ./static.js — no separate database, no separate page.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'pigeons');
}
