// Pretty link: soitbegins.xyz/panther/<number> — same SWAP page as /static,
// pre-opened straight to that PANTHER's detail screen. See renderNft in
// ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'panther', context.params.number);
}
