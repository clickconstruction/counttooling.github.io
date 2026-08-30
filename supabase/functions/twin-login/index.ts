import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Digital twin sign-in mint (PipeTooling docs/DIGITAL_TWINS_PLAN.md, Phase E1 — the
// CountTooling half). A cloud-hosted agent harness POSTs here and gets a magic-link
// action_link; navigating a headless browser to it yields a signed-in session on the
// deployed app, no passwords anywhere. Two credential paths (robot-ready train CT-4):
//   * X-Twin-Token — the PER-TWIN fleet token, verified against twin_credentials
//     (sha256 hashes mirrored from PipeTooling at issue time). The token IS the
//     identity: the email must belong to that credential's account. Revoking the
//     row severs this one twin on this app, independent of PT.
//   * X-Twin-Login-Secret — the shared fleet secret (legacy/master path; rotating it
//     is the fleet-wide kill switch).
// Hard guards on both paths: fleet email pattern (estimator-only program) and
// profiles.is_digital_twin — a leaked credential can only ever mint a twin session.

const twinCors = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': corsHeaders['Access-Control-Allow-Headers'] + ', x-twin-login-secret, x-twin-token',
}

const TWIN_EMAIL_RE = /^twin-estimator-\d+@twins\.counttooling\.local$/

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: twinCors })
  try {
    const supabaseUrlPre = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKeyPre = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKeyPre) return jsonRes(500, { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })
    const preClient = createClient(supabaseUrlPre, serviceRoleKeyPre, { auth: { autoRefreshToken: false, persistSession: false } })

    const twinToken = req.headers.get('X-Twin-Token')?.trim()
    let credentialUserId: string | null = null
    if (twinToken) {
      const hash = await sha256Hex(twinToken)
      const { data: cred } = await preClient.from('twin_credentials').select('user_id, revoked_at').eq('token_hash', hash).maybeSingle()
      if (!cred || cred.revoked_at) return jsonRes(401, { error: 'Unknown or revoked twin token' })
      credentialUserId = cred.user_id as string
    } else {
      const secret = req.headers.get('X-Twin-Login-Secret')
      const expected = Deno.env.get('TWIN_LOGIN_SECRET')
      if (!expected || secret !== expected) return jsonRes(401, { error: 'Unauthorized - invalid or missing twin credential' })
    }

    const { email, redirectTo, run } = (await req.json()) as { email?: string; redirectTo?: string; run?: string }
    const cleanEmail = (email ?? '').trim().toLowerCase()
    if (!TWIN_EMAIL_RE.test(cleanEmail)) return jsonRes(400, { error: 'Not a twin account email' })

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return jsonRes(500, { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: listed, error: listErr } = await adminClient.auth.admin.listUsers()
    if (listErr) return jsonRes(500, { error: `User lookup failed: ${listErr.message}` })
    const user = listed.users.find((u) => (u.email ?? '').toLowerCase() === cleanEmail)
    if (!user) return jsonRes(404, { error: 'Twin account not found' })
    // Per-twin path: the token is the identity — it can only mint ITS OWN twin.
    if (credentialUserId && credentialUserId !== user.id) {
      return jsonRes(403, { error: 'Twin token does not belong to that account' })
    }

    const { data: profile, error: profErr } = await adminClient
      .from('profiles')
      .select('is_digital_twin')
      .eq('user_id', user.id)
      .maybeSingle()
    if (profErr) return jsonRes(500, { error: `Profile lookup failed: ${profErr.message}` })
    if (profile?.is_digital_twin !== true) return jsonRes(403, { error: 'Account is not flagged as a digital twin' })

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
      options: { redirectTo: redirectTo || undefined },
    })
    if (linkError || !linkData) return jsonRes(500, { error: `Failed to generate magic link: ${linkError?.message || 'unknown error'}` })

    console.log(`twin-login mint: ${cleanEmail} run=${run ?? '-'} redirect=${redirectTo ?? '-'}`)
    return jsonRes(200, { success: true, action_link: linkData.properties.action_link })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
