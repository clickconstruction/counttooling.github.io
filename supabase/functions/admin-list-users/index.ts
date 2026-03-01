import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No auth header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token)
    if (authErr) return new Response(JSON.stringify({ error: 'Invalid token: ' + authErr.message }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profile } = await adminClient.from('profiles').select('is_admin').eq('user_id', user.id).single()
    if (!profile?.is_admin) return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const { data: { users: authUsers }, error } = await adminClient.auth.admin.listUsers({ perPage: 100 })
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const userIds = authUsers.map((u) => u.id)
    const { data: profiles } = await adminClient.from('profiles').select('user_id, is_admin').in('user_id', userIds)
    const profileMap = new Map((profiles || []).map((p) => [p.user_id, !!p.is_admin]))
    const users = authUsers.map((u) => ({
      id: u.id,
      email: u.email ?? '',
      role: profileMap.get(u.id) ? 'Admin' : 'User',
      last_sign_in_at: u.last_sign_in_at ?? null
    }))
    return new Response(JSON.stringify({ users }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
