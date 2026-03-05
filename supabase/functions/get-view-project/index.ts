import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

function getAllowedDomains(): string[] {
  const raw = Deno.env.get('VIEW_LINK_ALLOWED_DOMAINS') || 'clickplumbing.com'
  return raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
}

function emailDomainAllowed(email: string, allowedDomains: string[]): boolean {
  const addr = String(email).trim().toLowerCase()
  const at = addr.lastIndexOf('@')
  if (at < 0) return false
  const domain = addr.slice(at + 1)
  return allowedDomains.some((d) => domain === d || domain.endsWith('.' + d))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const token = body?.token
    const email = typeof body?.email === 'string' ? body.email.trim() : ''

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'token_required', message: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email_required', message: 'Enter your email to view' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const allowedDomains = getAllowedDomains()
    if (!emailDomainAllowed(email, allowedDomains)) {
      const domainList = allowedDomains.join(', ')
      return new Response(
        JSON.stringify({
          error: 'domain_restricted',
          message: `Access restricted to ${domainList}. Please use your work email.`,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: link, error: linkErr } = await adminClient
      .from('project_view_links')
      .select('id, project_id, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (linkErr || !link) {
      return new Response(
        JSON.stringify({ error: 'invalid_token', message: 'Invalid or expired link' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'expired', message: 'This link has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: proj, error: projErr } = await adminClient
      .from('projects')
      .select('id, name, data, pdf_path, pdf_hash')
      .eq('id', link.project_id)
      .single()

    if (projErr || !proj) {
      return new Response(
        JSON.stringify({ error: 'project_not_found', message: 'Project not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!proj.pdf_path) {
      return new Response(
        JSON.stringify({ error: 'no_pdf', message: 'This project has no PDF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    await adminClient.from('view_link_access_log').insert({
      view_link_id: link.id,
      token,
      project_id: link.project_id,
      email,
    })

    const { data: signed, error: urlErr } = await adminClient.storage
      .from('pdfs')
      .createSignedUrl(proj.pdf_path, 86400)

    if (urlErr || !signed?.signedUrl) {
      return new Response(
        JSON.stringify({ error: 'storage_error', message: 'Failed to generate PDF URL' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        projectId: proj.id,
        name: proj.name || 'Untitled',
        data: proj.data || {},
        pdfSignedUrl: signed.signedUrl,
        pdfHash: proj.pdf_hash || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: 'server_error', message: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
