import { requireUser, requireAdmin } from '../_shared/adminGuard.ts'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { reassignProjects } from '../_shared/reassignProjects.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const ctx = await requireUser(req)
    if (ctx instanceof Response) return ctx
    const denied = await requireAdmin(ctx)
    if (denied) return denied
    const { user, adminClient } = ctx
    const { targetUserId, reassignToUserId } = await req.json()
    if (!targetUserId) return jsonRes(400, { error: 'targetUserId required' })
    if (targetUserId === user.id) return jsonRes(400, { error: 'Cannot delete yourself' })
    // Optional: reassign the target's projects to another user before deleting them.
    // Done first; if it throws we fall to the catch and the user is NOT deleted (retryable).
    let reassigned = 0
    if (reassignToUserId) {
      if (reassignToUserId === targetUserId) return jsonRes(400, { error: 'Cannot reassign to the user being deleted' })
      const { data: tgt, error: tgtErr } = await adminClient.auth.admin.getUserById(reassignToUserId)
      if (tgtErr || !tgt?.user) return jsonRes(400, { error: 'Reassign target not found' })
      const result = await reassignProjects(adminClient, targetUserId, reassignToUserId)
      reassigned = result.reassigned
    }
    const { error } = await adminClient.auth.admin.deleteUser(targetUserId)
    if (error) return jsonRes(400, { error: error.message })
    return jsonRes(200, { ok: true, reassigned })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
