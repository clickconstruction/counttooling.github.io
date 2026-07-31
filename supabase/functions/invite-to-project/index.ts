import { requireUser } from '../_shared/adminGuard.ts'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // User half of the guard only: the gate below is owner-or-member-or-admin,
    // not admin-only.
    const ctx = await requireUser(req)
    if (ctx instanceof Response) return ctx
    const { user, adminClient } = ctx

    const { project_id, email, role } = await req.json()
    if (!project_id || !email || !role) {
      return jsonRes(400, { error: 'project_id, email, and role required' })
    }
    if (role !== 'viewer' && role !== 'editor') {
      return jsonRes(400, { error: 'role must be viewer or editor' })
    }

    // Caller must be owner or in project_shares
    const { data: proj } = await adminClient.from('projects').select('id, user_id').eq('id', project_id).single()
    if (!proj) return jsonRes(404, { error: 'Project not found' })

    const { data: existingShare } = await adminClient.from('project_shares').select('user_id').eq('project_id', project_id).eq('user_id', user.id).maybeSingle()
    const { data: callerProfile } = await adminClient.from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle()
    const isOwner = proj.user_id === user.id
    const isMember = !!existingShare
    const isAdmin = !!callerProfile?.is_admin
    if (!isOwner && !isMember && !isAdmin) {
      return jsonRes(403, { error: 'No permission to add share' })
    }

    // Look up user by email via admin API
    const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    const targetUser = users?.find((u: { email?: string }) => u.email?.toLowerCase() === String(email).toLowerCase())
    if (!targetUser) return jsonRes(404, { error: 'User not found with that email' })

    if (targetUser.id === proj.user_id) {
      return jsonRes(400, { error: 'Cannot share with project owner' })
    }

    const { error } = await adminClient.from('project_shares').upsert(
      { project_id, user_id: targetUser.id, role, invited_by: user.id },
      { onConflict: 'project_id,user_id' }
    )
    if (error) return jsonRes(400, { error: error.message })

    return jsonRes(200, { ok: true, user_id: targetUser.id, email: targetUser.email })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
