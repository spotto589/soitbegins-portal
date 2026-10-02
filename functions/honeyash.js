// Pretty link: soitbegins.xyz/honeyash — the H0NEYP0T database switched to
// ASH. See renderSwap in ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'honeyash');
}
