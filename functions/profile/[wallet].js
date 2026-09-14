// Pretty link: soitbegins.xyz/profile/<wallet> — same SWAP page as
// /static, just pre-opened straight to that wallet's PR0F!LE screen
// instead of the DATABASE picker. See renderProfile in ../static.js.
import { renderProfile } from '../static.js';

export async function onRequestGet(context) {
  return renderProfile(context, context.params.wallet);
}
