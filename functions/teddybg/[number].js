// Pretty link: soitbegins.xyz/teddybg/<number> — same SWAP page as
// /static, just pre-opened straight to that TEDDY's detail screen
// instead of the DATABASE picker. See renderNft in ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'teddybg', context.params.number);
}
