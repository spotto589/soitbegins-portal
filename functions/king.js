// Pretty link: soitbegins.xyz/king — same SWAP page as /static, just
// pre-selected to K!NG. See renderSwap in ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'king');
}
