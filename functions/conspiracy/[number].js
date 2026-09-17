// Pretty link: soitbegins.xyz/conspiracy/<number> — same SWAP page as
// /static, just pre-opened straight to that C0NSP!RACY's detail screen
// instead of the DATABASE picker. See renderNft in ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'conspiracy', context.params.number);
}
