// Friendly alias for /teddybg (the real collection key, see
// COLLECTION_META in static.js) — "teddy" is the name people actually
// type/say. See pigeons.js's own comment for why this is a thin wrapper.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'teddybg');
}
