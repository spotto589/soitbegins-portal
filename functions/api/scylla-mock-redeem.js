// ============================================================================
// MOCK Scylla redemption endpoint — architecture test only.
//
// NOT connected to the real STAT!C NFT check or a real XRPL master. This
// exists purely to validate the encrypt-at-rest / decrypt-server-side-only
// flow before wiring it to real NFT ownership verification.
//
// Flow:
//   1. A fake AES-256-GCM encrypted master ("TEST_XRPL_MASTER_123456") is
//      stored right here as server-side data (IV + ciphertext, base64).
//      This file only ever runs on Cloudflare's servers — Pages Functions
//      source is never sent to the browser — so this is safe to keep here.
//   2. The AES-256 key that decrypts it is NOT in this file. It must be set
//      as a Cloudflare Pages secret named MOCK_SCYLLA_AES_KEY (base64,
//      32 raw bytes). See setup note at the bottom of this file.
//   3. Authorization is a MOCK condition (see isMockAuthorized) standing in
//      for the future "does this wallet hold the STAT!C NFT" check.
//   4. Only on success is the decrypted master included in the response.
//      On failure, nothing about the master (not even a hint) is returned.
//   5. Neither the AES key nor the decrypted plaintext is ever logged.
// ============================================================================

// Server-side-only "encrypted vault" for the fake master. Produced offline
// with the same key that must be set as the MOCK_SCYLLA_AES_KEY secret —
// regenerate both together if the mock master value ever changes.
const MOCK_MASTER_IV_B64 = 'PZr0u1O/3t83kd6d';
const MOCK_MASTER_CIPHERTEXT_B64 = '4RDdhMC75ktBhZIyLehZTnBzRHhizt7wrFUBWuJY9yuzm6wqjWB8';

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Stand-in for the eventual "wallet holds the STAT!C NFT" check. Body shape
// is deliberately simple so the two paths (authorized/denied) are easy to
// exercise by hand while testing the encryption flow in isolation.
function isMockAuthorized(body) {
  return !!(body && body.mockWalletHasStatic === true);
}

async function decryptMockMaster(aesKeyB64) {
  const keyBytes = fromBase64(aesKeyB64);
  const key = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
  );
  const iv = fromBase64(MOCK_MASTER_IV_B64);
  const ciphertext = fromBase64(MOCK_MASTER_CIPHERTEXT_B64);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plainBuf);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.MOCK_SCYLLA_AES_KEY) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'bad_request' }), { status: 400 });
  }

  if (!isMockAuthorized(body)) {
    return new Response(JSON.stringify({ granted: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let master;
  try {
    master = await decryptMockMaster(env.MOCK_SCYLLA_AES_KEY);
  } catch (e) {
    // Never log the key or any plaintext — decryption failures (e.g. a
    // misconfigured secret) surface only as an opaque error to the caller.
    return new Response(JSON.stringify({ error: 'decrypt_failed' }), { status: 500 });
  }

  return new Response(JSON.stringify({ granted: true, master }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ----------------------------------------------------------------------------
// Setup (one-time): set the AES key as a Cloudflare Pages secret. It must
// never be committed to source or pasted into frontend code.
//
//   npx wrangler pages secret put MOCK_SCYLLA_AES_KEY
//
// (or Cloudflare dashboard → Pages project → Settings → Environment
// variables → add MOCK_SCYLLA_AES_KEY as an encrypted/secret variable).
// The key value is provided separately, outside of this file.
// ----------------------------------------------------------------------------
