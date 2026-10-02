// Pretty link: soitbegins.xyz/honeypotall — same as /honeypot (ALL view).
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'honeypotall');
}
