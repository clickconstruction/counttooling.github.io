import { requireUser, requireAdmin } from '../_shared/adminGuard.ts'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'

// Admin sets/resets an existing user's password. Auth via the shared guard:
// validate caller -> require profiles.is_admin -> act with the service role.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const ctx = await requireUser(req)
    if (ctx instanceof Response) return ctx
    const denied = await requireAdmin(ctx)
    if (denied) return denied
    const { adminClient } = ctx
    const { targetUserId, newPassword } = await req.json()
    if (!targetUserId || !newPassword) return jsonRes(400, { error: 'targetUserId and newPassword required' })
    if (String(newPassword).length < 6) return jsonRes(400, { error: 'Password must be at least 6 characters' })
    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, { password: newPassword })
    if (error) return jsonRes(400, { error: error.message })
    return jsonRes(200, { ok: true })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
