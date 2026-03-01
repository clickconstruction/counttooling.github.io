import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profile } = await adminClient.from('profiles').select('is_admin').eq('user_id', user.id).single()
    if (!profile?.is_admin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { projectId } = await req.json()
    if (!projectId) return new Response(JSON.stringify({ error: 'projectId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: project, error: fetchErr } = await adminClient.from('projects').select('pdf_path').eq('id', projectId).single()
    if (fetchErr || !project) return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (project.pdf_path) {
      await adminClient.storage.from('pdfs').remove([project.pdf_path])
    }
    const { error: deleteErr } = await adminClient.from('projects').delete().eq('id', projectId)
    if (deleteErr) return new Response(JSON.stringify({ error: deleteErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
