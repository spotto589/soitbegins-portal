// Pretty link: soitbegins.xyz/soitbegins — the S0 !T BEG!NS database, same
// as /honeypot (ALL view). See renderSwap in ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'honeypotall');
}
