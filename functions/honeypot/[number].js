// Pretty link: soitbegins.xyz/honeypot/<number> — that Honeypot's detail
// screen. See renderNft in ../static.js.
import { renderNft } from '../static.js';

export async function onRequestGet(context) {
  return renderNft(context, 'honeypot', context.params.number);
}
