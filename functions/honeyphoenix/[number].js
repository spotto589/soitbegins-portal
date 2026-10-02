// Pretty link: soitbegins.xyz/honeyphoenix/<number> — that PH0EN!X's detail screen.
// See renderNft in ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'honeyphoenix', context.params.number);
}
