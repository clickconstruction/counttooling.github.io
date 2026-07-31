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
    const { projectId } = await req.json()
    if (!projectId) return jsonRes(400, { error: 'projectId required' })
    const { data: project, error: fetchErr } = await adminClient.from('projects').select('pdf_path').eq('id', projectId).single()
    if (fetchErr || !project) return jsonRes(404, { error: 'Project not found' })
    if (project.pdf_path) {
      await adminClient.storage.from('pdfs').remove([project.pdf_path])
    }
    const { error: deleteErr } = await adminClient.from('projects').delete().eq('id', projectId)
    if (deleteErr) return jsonRes(400, { error: deleteErr.message })
    return jsonRes(200, { ok: true })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
