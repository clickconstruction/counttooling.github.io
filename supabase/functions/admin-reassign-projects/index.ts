import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { reassignProjects } from '../_shared/reassignProjects.ts'

// Standalone "Transfer ownership": move every project owned by fromUserId to toUserId
// (including the owner-scoped PDF storage objects) WITHOUT deleting either user.
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
    const { fromUserId, toUserId } = await req.json()
    if (!fromUserId || !toUserId) return new Response(JSON.stringify({ error: 'fromUserId and toUserId required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (fromUserId === toUserId) return new Response(JSON.stringify({ error: 'Source and target must differ' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: from, error: fromErr } = await adminClient.auth.admin.getUserById(fromUserId)
    if (fromErr || !from?.user) return new Response(JSON.stringify({ error: 'Source user not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: to, error: toErr } = await adminClient.auth.admin.getUserById(toUserId)
    if (toErr || !to?.user) return new Response(JSON.stringify({ error: 'Target user not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const result = await reassignProjects(adminClient, fromUserId, toUserId)
    return new Response(JSON.stringify({ ok: true, reassigned: result.reassigned }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
