// Pretty link: soitbegins.xyz/fuzzy/<number> — same SWAP page as
// /static, just pre-opened straight to that FUZZY's detail screen
// instead of the DATABASE picker. See renderNft in ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'fuzzy', context.params.number);
}
