// Pretty link: soitbegins.xyz/panther — same SWAP page as /static, just
// pre-selected to SH!TTY PANTHERS. See renderSwap in ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'panther');
}
