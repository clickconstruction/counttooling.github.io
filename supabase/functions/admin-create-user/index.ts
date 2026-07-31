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
    const { email, password } = await req.json()
    if (!email || !password) return jsonRes(400, { error: 'Email and password required' })
    const { data: newUser, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true })
    if (error) return jsonRes(400, { error: error.message })
    await adminClient.from('profiles').insert({ user_id: newUser.user.id, is_admin: false })
    return jsonRes(200, { id: newUser.user.id, email: newUser.user.email })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
