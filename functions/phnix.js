// Friendly alias for /phnixs (the real collection key, see COLLECTION_META
// in static.js) — "phnix" is the name people actually type/say. See
// pigeons.js's own comment for why this is a thin wrapper, not a new page.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'phnixs');
}
