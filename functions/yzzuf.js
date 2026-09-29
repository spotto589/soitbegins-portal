// Pretty link: soitbegins.xyz/yzzuf — same SWAP page as /static, just
// pre-selected to YZZUF (sraebyzzuF). See renderSwap in ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'yzzuf');
}
