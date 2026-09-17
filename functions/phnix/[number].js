// Alias of /phnixs/<number> (see ../phnixs/[number].js) — same PHN!X
// collection key under the singular spelling, same reasoning as
// ../phnix.js aliasing ../phnixs.js at the collection level.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'phnixs', context.params.number);
}
