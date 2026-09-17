// Alias of /teddybg/<number> (see ../teddybg/[number].js) — same TEDDY
// collection key under the shorter spelling, same reasoning as
// ../teddy.js aliasing ../teddybg.js at the collection level.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'teddybg', context.params.number);
}
