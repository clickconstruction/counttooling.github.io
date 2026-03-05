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

    const { project_id, email, role } = await req.json()
    if (!project_id || !email || !role) {
      return new Response(JSON.stringify({ error: 'project_id, email, and role required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    if (role !== 'viewer' && role !== 'editor') {
      return new Response(JSON.stringify({ error: 'role must be viewer or editor' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Caller must be owner or in project_shares
    const { data: proj } = await adminClient.from('projects').select('id, user_id').eq('id', project_id).single()
    if (!proj) return new Response(JSON.stringify({ error: 'Project not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: existingShare } = await adminClient.from('project_shares').select('user_id').eq('project_id', project_id).eq('user_id', user.id).maybeSingle()
    const isOwner = proj.user_id === user.id
    const isMember = !!existingShare
    if (!isOwner && !isMember) {
      return new Response(JSON.stringify({ error: 'No permission to add share' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Look up user by email via admin API
    const { data: { users } } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
    const targetUser = users?.find((u: { email?: string }) => u.email?.toLowerCase() === String(email).toLowerCase())
    if (!targetUser) return new Response(JSON.stringify({ error: 'User not found with that email' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    if (targetUser.id === proj.user_id) {
      return new Response(JSON.stringify({ error: 'Cannot share with project owner' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { error } = await adminClient.from('project_shares').upsert(
      { project_id, user_id: targetUser.id, role, invited_by: user.id },
      { onConflict: 'project_id,user_id' }
    )
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    return new Response(JSON.stringify({ ok: true, user_id: targetUser.id, email: targetUser.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
