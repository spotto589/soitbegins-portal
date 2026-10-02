// Pretty link: soitbegins.xyz/honeypot — the H0NEYP0T database (ALL view:
// Honeypots, Ash and Phoenixes together; switch to one kind at the top).
// /honeypot/burns is the burn list (./honeypot/burns.js). See renderSwap in
// ./static.js.
import { renderSwap } from './static.js';

export async function onRequestGet(context) {
  return renderSwap(context, 'honeypotall');
}
