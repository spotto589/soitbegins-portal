// Pretty link: soitbegins.xyz/thirdeye/<number> — same SWAP page as
// /static, just pre-opened straight to that 3RD EYE's detail screen
// instead of the DATABASE picker. See renderNft in ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'thirdeye', context.params.number);
}
