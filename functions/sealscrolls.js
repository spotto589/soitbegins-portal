// Pretty link: soitbegins.xyz/sealscrolls — same SWAP page as /static, just
// pre-selected to SEAL SCR0LLS. See renderSwap in ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'sealscrolls');
}
