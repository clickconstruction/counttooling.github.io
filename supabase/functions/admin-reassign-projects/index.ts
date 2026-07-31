import { requireUser, requireAdmin } from '../_shared/adminGuard.ts'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { reassignProjects } from '../_shared/reassignProjects.ts'

// Standalone "Transfer ownership": move every project owned by fromUserId to toUserId
// (including the owner-scoped PDF storage objects) WITHOUT deleting either user.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const ctx = await requireUser(req)
    if (ctx instanceof Response) return ctx
    const denied = await requireAdmin(ctx)
    if (denied) return denied
    const { adminClient } = ctx
    const { fromUserId, toUserId } = await req.json()
    if (!fromUserId || !toUserId) return jsonRes(400, { error: 'fromUserId and toUserId required' })
    if (fromUserId === toUserId) return jsonRes(400, { error: 'Source and target must differ' })
    const { data: from, error: fromErr } = await adminClient.auth.admin.getUserById(fromUserId)
    if (fromErr || !from?.user) return jsonRes(400, { error: 'Source user not found' })
    const { data: to, error: toErr } = await adminClient.auth.admin.getUserById(toUserId)
    if (toErr || !to?.user) return jsonRes(400, { error: 'Target user not found' })
    const result = await reassignProjects(adminClient, fromUserId, toUserId)
    return jsonRes(200, { ok: true, reassigned: result.reassigned })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
