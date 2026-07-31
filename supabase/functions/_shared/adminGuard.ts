// The shared auth prologue for the admin/member Edge Functions. Split in two
// deliberately: invite-to-project needs only the user half (its gate is
// owner-or-member-or-admin, checked in its own body), while the six admin
// functions chain both. Seven functions carried near-identical inline copies
// before this — and admin-list-users' copy had already drifted (different 401
// message, a token .trim(), surfaced authErr), which is the drift this file
// exists to end.
//
// Gateway note: these functions run with verify_jwt = false (config.toml) —
// the gateway does NOT check the JWT; getUser() here is the real check.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonRes } from './json.ts'

export interface AuthedContext {
  user: any
  adminClient: any
}

// Validates the caller's JWT and builds the service-role client.
// Returns a Response (401) to short-circuit with, or the authed context.
export async function requireUser(req: Request): Promise<AuthedContext | Response> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonRes(401, { error: 'Unauthorized' })
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
  if (!user) return jsonRes(401, { error: 'Unauthorized' })
  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  return { user, adminClient }
}

// Requires profiles.is_admin for the already-authed user.
// Returns a Response (403) to short-circuit with, or null when allowed.
export async function requireAdmin(ctx: AuthedContext): Promise<Response | null> {
  const { data: profile } = await ctx.adminClient.from('profiles').select('is_admin').eq('user_id', ctx.user.id).single()
  if (!profile?.is_admin) return jsonRes(403, { error: 'Forbidden' })
  return null
}
