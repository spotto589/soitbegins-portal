// Pretty link: soitbegins.xyz/fuzzybars — same SWAP page as /static, just
// pre-selected to FUZZY BARS. See renderSwap in ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'fuzzybars');
}
