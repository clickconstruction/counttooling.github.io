// Viewer grants — "PipeTooling vouches for the sub" (2026-09-06).
//
// A view link (/app/?t=<token>) opens with no account but behind the email
// domain gate: a subcontractor's Gmail is refused. PipeTooling already knows
// who the sub is (their portal link is the credential it trusts), so its
// sub-portal function mints a short-lived GRANT, signed with a secret both
// projects hold, and appends it to the plans link as `&g=`. get-view-project
// verifies the signature here, skips the gate, and logs the visit under the
// sub's name. Everything else — token lookup, expiry, revocation, the signed
// PDF URL — runs exactly as before.
//
// Wire format:  g = base64url(JSON claims) + "." + base64url(HMAC-SHA256(secret, claims-part))
// Claims:       { t, name, email?, person?, via, iat, exp }   (seconds since the epoch)
// Binding:      the grant is only good for the view token it names (claims.t === request token).
//
// Plain ESM with Web Crypto only, so the SAME file runs under Deno (the Edge
// Function imports it) and under Node's test runner (view-grant.test.js).
// PipeTooling keeps its own copy of the mint side against the same fixtures.
/* global TextEncoder, TextDecoder, btoa, atob, crypto */

export const VIEW_GRANT_MAX_AGE_SECONDS = 24 * 60 * 60
export const VIEW_GRANT_SOURCES = ['pipetooling-sub-portal', 'pipetooling-bid-basis']

const enc = new TextEncoder()

export function base64urlEncode(bytes) {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlDecode(s) {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return new Uint8Array(sig)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/**
 * Mint a grant. `claims.t` (the view token) and `claims.name` are required;
 * `exp` defaults to now + VIEW_GRANT_MAX_AGE_SECONDS. Returns the `g` string.
 */
export async function mintViewGrant(claims, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret) throw new Error('view grant secret missing')
  if (!claims || typeof claims.t !== 'string' || !claims.t) throw new Error('view grant needs the view token (t)')
  if (typeof claims.name !== 'string' || !claims.name.trim()) throw new Error('view grant needs a viewer name')
  const body = {
    t: claims.t,
    name: claims.name.trim(),
    email: typeof claims.email === 'string' && claims.email.trim() ? claims.email.trim().toLowerCase() : null,
    person: typeof claims.person === 'string' && claims.person ? claims.person : null,
    via: typeof claims.via === 'string' && claims.via ? claims.via : VIEW_GRANT_SOURCES[0],
    iat: nowSeconds,
    exp: typeof claims.exp === 'number' ? claims.exp : nowSeconds + VIEW_GRANT_MAX_AGE_SECONDS,
  }
  const part = base64urlEncode(enc.encode(JSON.stringify(body)))
  const sig = await hmac(secret, part)
  return part + '.' + base64urlEncode(sig)
}

/** Split and decode without verifying — for the client and for error messages. */
export function parseViewGrant(g) {
  if (typeof g !== 'string' || g.length < 8 || g.length > 4096) return null
  const dot = g.indexOf('.')
  if (dot <= 0 || dot === g.length - 1) return null
  try {
    const claims = JSON.parse(new TextDecoder().decode(base64urlDecode(g.slice(0, dot))))
    if (!claims || typeof claims !== 'object') return null
    return { part: g.slice(0, dot), sig: g.slice(dot + 1), claims }
  } catch {
    return null
  }
}

/**
 * Verify a grant against the secret, the request's view token and the clock.
 * Resolves { ok: true, claims } or { ok: false, reason } where reason is one of
 * malformed · bad_signature · expired · not_yet_valid · token_mismatch · unknown_source · no_secret.
 * Never throws.
 */
export async function verifyViewGrant({ grant, secret, token, nowSeconds = Math.floor(Date.now() / 1000) }) {
  if (!secret) return { ok: false, reason: 'no_secret' }
  const parsed = parseViewGrant(grant)
  if (!parsed) return { ok: false, reason: 'malformed' }
  let expected
  try {
    expected = await hmac(secret, parsed.part)
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  let given
  try {
    given = base64urlDecode(parsed.sig)
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (!timingSafeEqual(expected, given)) return { ok: false, reason: 'bad_signature' }
  const c = parsed.claims
  if (typeof c.t !== 'string' || typeof c.name !== 'string' || typeof c.exp !== 'number' || typeof c.iat !== 'number') return { ok: false, reason: 'malformed' }
  if (!VIEW_GRANT_SOURCES.includes(c.via)) return { ok: false, reason: 'unknown_source' }
  if (c.t !== token) return { ok: false, reason: 'token_mismatch' }
  if (c.exp <= nowSeconds) return { ok: false, reason: 'expired' }
  if (c.iat > nowSeconds + 300) return { ok: false, reason: 'not_yet_valid' }
  if (c.exp - c.iat > VIEW_GRANT_MAX_AGE_SECONDS + 60) return { ok: false, reason: 'expired' }
  return {
    ok: true,
    claims: {
      t: c.t,
      name: c.name.trim().slice(0, 120),
      email: typeof c.email === 'string' && c.email.trim() ? c.email.trim().toLowerCase().slice(0, 254) : null,
      person: typeof c.person === 'string' ? c.person.slice(0, 64) : null,
      via: c.via,
      iat: c.iat,
      exp: c.exp,
    },
  }
}
