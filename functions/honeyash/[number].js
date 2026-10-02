// Pretty link: soitbegins.xyz/honeyash/<number> — that ASH's detail screen.
// See renderNft in ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'honeyash', context.params.number);
}
