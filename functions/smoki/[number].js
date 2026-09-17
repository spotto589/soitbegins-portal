// Pretty link: soitbegins.xyz/smoki/<number> — same SWAP page as
// /static, just pre-opened straight to that SM0K!'s detail screen
// instead of the DATABASE picker. See renderNft in ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'smoki', context.params.number);
}
