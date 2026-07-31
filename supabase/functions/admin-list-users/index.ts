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
    const { data: profiles } = await adminClient.from('profiles').select('user_id, is_admin').in('user_id', userIds)
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, !!p.is_admin]))
    const users = authUsers.map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: profileMap.get(u.id) ? 'Admin' : 'User',
      last_sign_in_at: u.last_sign_in_at ?? null
    }))
    return jsonRes(200, { users })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
