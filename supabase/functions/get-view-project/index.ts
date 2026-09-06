import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { getAllowedDomains, emailDomainAllowed } from '../_shared/viewLink.ts'
import { verifyViewGrant } from '../_shared/viewGrant.mjs'


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const token = body?.token
    let email = typeof body?.email === 'string' ? body.email.trim() : ''
    const grantRaw = typeof body?.grant === 'string' ? body.grant.trim() : ''

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'token_required', message: 'Token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Viewer grant (2026-09-06): PipeTooling vouches for a subcontractor opening plans
    // from their portal — a signed, short-lived, token-bound assertion in place of the
    // email gate (../_shared/viewGrant.mjs). A bad grant answers grant_invalid so the
    // client falls back to the gate; a request WITHOUT a grant is unchanged below.
    let grantViewer: { name: string; email: string | null; source: string } | null = null
    if (grantRaw) {
      const v = await verifyViewGrant({ grant: grantRaw, secret: Deno.env.get('PT_VIEW_GRANT_SECRET') || '', token: String(token) })
      if (!v.ok) {
        return new Response(
          JSON.stringify({ error: 'grant_invalid', reason: v.reason, message: 'This plans link needs a fresh open from your portal — or enter your email to view.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      grantViewer = { name: v.claims.name, email: v.claims.email, source: v.claims.via }
      email = v.claims.email || ''
    }

    if (!grantViewer) {
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
      .select('id, name, data, pdf_path, pdf_hash, updated_at, external_ref')
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

    // The log row names the viewer: the gate's email, or the grant's name + source.
    // `email` is NOT NULL on the table, so a grant without one writes a labelled
    // placeholder. If the viewer columns are not there yet (function deployed before
    // the migration), fall back to the old row shape so the visit is never lost.
    const logRow = {
      view_link_id: link.id,
      token,
      project_id: link.project_id,
      email: email || (grantViewer ? `${grantViewer.name} (via ${grantViewer.source})` : ''),
    }
    const { error: logErr } = await adminClient
      .from('view_link_access_log')
      .insert(grantViewer ? { ...logRow, viewer_name: grantViewer.name, source: grantViewer.source } : logRow)
    if (logErr && grantViewer) await adminClient.from('view_link_access_log').insert(logRow)

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
        updatedAt: proj.updated_at || null,
        externalRef: proj.external_ref || null,
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
