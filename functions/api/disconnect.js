import { BOARD_COOKIE_NAME } from '../_shared.js';

export async function onRequestPost() {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append(
    'Set-Cookie',
    `${BOARD_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
  );
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
