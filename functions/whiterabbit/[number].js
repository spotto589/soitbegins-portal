// Pretty link: soitbegins.xyz/whiterabbit/<number> — same SWAP page as
// /static, just pre-opened straight to that WH!TE RABB!T's detail screen
// instead of the DATABASE picker. See renderNft in ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'whiterabbit', context.params.number);
}
