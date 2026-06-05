import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { reassignProjects } from '../_shared/reassignProjects.ts'

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
    const { targetUserId, reassignToUserId } = await req.json()
    if (!targetUserId) return new Response(JSON.stringify({ error: 'targetUserId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (targetUserId === user.id) return new Response(JSON.stringify({ error: 'Cannot delete yourself' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    // Optional: reassign the target's projects to another user before deleting them.
    // Done first; if it throws we fall to the catch and the user is NOT deleted (retryable).
    let reassigned = 0
    if (reassignToUserId) {
      if (reassignToUserId === targetUserId) return new Response(JSON.stringify({ error: 'Cannot reassign to the user being deleted' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const { data: tgt, error: tgtErr } = await adminClient.auth.admin.getUserById(reassignToUserId)
      if (tgtErr || !tgt?.user) return new Response(JSON.stringify({ error: 'Reassign target not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const result = await reassignProjects(adminClient, targetUserId, reassignToUserId)
      reassigned = result.reassigned
    }
    const { error } = await adminClient.auth.admin.deleteUser(targetUserId)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify({ ok: true, reassigned }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
