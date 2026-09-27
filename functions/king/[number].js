// Pretty link: soitbegins.xyz/king/<number> — same SWAP page as /static,
// pre-opened straight to that K!NG's detail screen. See renderNft in
// ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'king', context.params.number);
}
