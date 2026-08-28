import {
  COOKIE_NAME, getCookie, verifyToken,
  fetchAllAccountNfts, findStaticVanityKey, getStaticVanityKeyInfo,
  isStaticKeyRedeemed, markStaticKeyRedeemed, notifyDiscordRedemption
} from '../_shared.js';

// ============================================================================
// Scylla redemption endpoint.
//
// The plaintext master returned here is still a MOCK value ("MY_SUPER_SECRET_123")
// standing in for a real XRPL secret while the encrypt-at-rest / decrypt-
// server-side-only architecture is validated — see the setup note at the
// bottom of this file. What's real: authorization is the caller's actual
// glitch_access session re-checked against on-chain STAT!C Vanity Key
// possession (not a client-supplied flag), and a successful redemption
// permanently marks that specific key consumed in KV so it can never be
// redeemed again, even by the same wallet.
//
// Flow:
//   1. A fake AES-256-GCM encrypted master ("MY_SUPER_SECRET_123") is
//      stored right here as server-side data (IV + ciphertext, base64).
//      This file only ever runs on Cloudflare's servers — Pages Functions
//      source is never sent to the browser — so this is safe to keep here.
//   2. The AES-256 key that decrypts it is NOT in this file. It must be set
//      as a Cloudflare Pages secret named vanitykey (base64,
//      32 raw bytes). See setup note at the bottom of this file.
//   3. Authorization requires the wallet's session to actually hold an
//      unredeemed STAT!C Vanity Key on-chain (findStaticVanityKey).
//   4. Only on success is the decrypted master included in the response.
//      On failure, nothing about the master (not even a hint) is returned.
//   5. Neither the AES key nor the decrypted plaintext is ever logged.
// ============================================================================

// Server-side-only "encrypted vault" for the fake master. Produced offline
// with the same key that must be set as the vanitykey secret —
// regenerate both together if the mock master value ever changes.
const MOCK_MASTER_IV_B64 = 'uCY3eDJo3na9ZxSu';
const MOCK_MASTER_CIPHERTEXT_B64 = '6v1x14tGRCc0uj1VzvnNy3O/rueuVovcvmb8fN3M+8crLL8=';

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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
  const { request, env, waitUntil } = context;

  if (!env.vanitykey || !env.Σκύλλα || !env.coin) {
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500 });
  }

  const token = getCookie(request, COOKIE_NAME);
  if (!token) {
    return new Response(JSON.stringify({ granted: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const payload = await verifyToken(token, env.Σκύλλα);
  if (!payload || !payload.acct) {
    return new Response(JSON.stringify({ granted: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const nfts = await fetchAllAccountNfts(payload.acct);
  const key = findStaticVanityKey(nfts);
  if (!key) {
    return new Response(JSON.stringify({ granted: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (await isStaticKeyRedeemed(env.coin, key.NFTokenID)) {
    return new Response(JSON.stringify({ granted: false, reason: 'already_redeemed' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let master;
  try {
    master = await decryptMockMaster(env.vanitykey);
  } catch (e) {
    // Never log the key or any plaintext — decryption failures (e.g. a
    // misconfigured secret) surface only as an opaque error to the caller.
    return new Response(JSON.stringify({ error: 'decrypt_failed' }), { status: 500 });
  }

  await markStaticKeyRedeemed(env.coin, key.NFTokenID, {
    acct: payload.acct,
    redeemedAt: Date.now()
  });

  const info = await getStaticVanityKeyInfo(key);
  const notify = notifyDiscordRedemption(env.DISCORD_REDEEM_WEBHOOK, {
    acct: payload.acct,
    nftId: key.NFTokenID,
    keyNumber: info.number
  });
  if (waitUntil) waitUntil(notify); else await notify;

  return new Response(JSON.stringify({ granted: true, master }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ----------------------------------------------------------------------------
// Setup (one-time): set the AES key as a Cloudflare Pages secret. It must
// never be committed to source or pasted into frontend code.
//
//   npx wrangler pages secret put vanitykey
//
// (or Cloudflare dashboard → Pages project → Settings → Environment
// variables → add vanitykey as an encrypted/secret variable).
// The key value is provided separately, outside of this file.
//
// Discord notification on redemption also requires a secret:
//
//   npx wrangler pages secret put DISCORD_REDEEM_WEBHOOK
//
// (a Discord channel webhook URL — Server Settings → Integrations →
// Webhooks). Redemption still succeeds if this is unset; the notification
// just silently doesn't fire.
// ----------------------------------------------------------------------------
