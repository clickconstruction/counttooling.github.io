import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Digital twin sign-in mint (PipeTooling docs/DIGITAL_TWINS_PLAN.md, Phase E1 — the
// CountTooling half). A cloud-hosted agent harness POSTs here with a secret header and a
// twin email; it gets a magic-link action_link and navigates a headless browser to it —
// a signed-in session on the deployed app, no passwords anywhere. Three hard guards so a
// leaked TWIN_LOGIN_SECRET can only ever produce a twin session, never a real person's:
//   1. X-Twin-Login-Secret must match TWIN_LOGIN_SECRET (its own secret; rotating it is
//      the fleet-wide kill switch).
//   2. Email must match the estimator fleet pattern twin-estimator-<n>@twins.counttooling.local
//      (estimator-only program).
//   3. profiles.is_digital_twin must be true for that account.

const twinCors = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': corsHeaders['Access-Control-Allow-Headers'] + ', x-twin-login-secret',
}

const TWIN_EMAIL_RE = /^twin-estimator-\d+@twins\.counttooling\.local$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: twinCors })
  try {
    const secret = req.headers.get('X-Twin-Login-Secret')
    const expected = Deno.env.get('TWIN_LOGIN_SECRET')
    if (!expected || secret !== expected) return jsonRes(401, { error: 'Unauthorized - invalid or missing twin login secret' })

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
