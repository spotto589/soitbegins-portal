// soitbegins.xyz/honeypot — nothing to browse here yet, so it goes straight
// to the burn list. See ./honeypot/burns.js.
export async function onRequestGet(context) {
  return Response.redirect(new URL('/honeypot/burns', context.request.url).toString(), 302);
}
