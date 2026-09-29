// Pretty link: soitbegins.xyz/yzzuf/<number> — same SWAP page as
// /static, pre-opened straight to that item's detail screen. See
// renderNft in ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'yzzuf', context.params.number);
}
