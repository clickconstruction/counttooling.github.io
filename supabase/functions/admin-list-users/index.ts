import { requireUser, requireAdmin } from '../_shared/adminGuard.ts'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const ctx = await requireUser(req)
    if (ctx instanceof Response) return ctx
    const denied = await requireAdmin(ctx)
    if (denied) return denied
    const { adminClient } = ctx
    const { data: { users: authUsers }, error } = await adminClient.auth.admin.listUsers({ perPage: 100 })
    if (error) return jsonRes(500, { error: error.message })
    const userIds = authUsers.map((u) => u.id)
    const { data: profiles } = await adminClient.from('profiles').select('user_id, is_admin, is_digital_twin, is_overseer').in('user_id', userIds)
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]))
    const users = authUsers.map((u) => {
      const flags = profileMap.get(u.id)
      return {
        id: u.id,
        email: u.email ?? '',
        role: flags?.is_admin ? 'Admin' : flags?.is_overseer ? 'Overseer' : 'User',
        last_sign_in_at: u.last_sign_in_at ?? null,
        // Mirrors list_users_for_admin() - this is the fallback path for the same list.
        is_digital_twin: flags?.is_digital_twin === true,
        is_overseer: flags?.is_overseer === true
      }
    })
    return jsonRes(200, { users })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
