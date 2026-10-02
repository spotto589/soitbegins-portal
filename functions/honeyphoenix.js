// Pretty link: soitbegins.xyz/honeyphoenix — the H0NEYP0T database switched to
// PH0EN!X. See renderSwap in ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'honeyphoenix');
}
