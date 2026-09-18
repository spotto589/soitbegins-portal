// Pretty link: soitbegins.xyz/whiterabbit — same SWAP page as /static, just
// pre-selected to WH!TE RABB!T. See renderSwap in ./static.js and
// pigeons.js's own comment — one shared page/database across every
// collection route.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'whiterabbit');
}
