// set-view-scale: lets a view-link viewer set a page's scale FOR EVERYONE.
// Validates the same token + email-domain gate as get-view-project, sanity-checks
// the scale payload, then writes it into projects.data.pages[<index>].scale with a
// viewerSet stamp ({ email, at }) so the owner gets a must-clear notice next time
// they visit that page. Read-modify-write on the data JSON — same last-write-wins
// semantics as the app's own saves.
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

const UNITS = ['ft', 'in', 'm', 'cm', 'mm', 'yd']

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

// Rebuild the scale from the payload field-by-field — never store client JSON verbatim.
function sanitizeScale(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  if (!isFiniteNum(s.pixelsPerUnit) || s.pixelsPerUnit <= 0 || s.pixelsPerUnit > 1e6) return null
  if (typeof s.unit !== 'string' || !UNITS.includes(s.unit)) return null
  const out: Record<string, unknown> = { pixelsPerUnit: s.pixelsPerUnit, unit: s.unit, label: null }
  if (typeof s.label === 'string' && s.label.length <= 120) out.label = s.label
  const r = s.refLine as Record<string, unknown> | undefined
  if (r && typeof r === 'object' && isFiniteNum(r.x1) && isFiniteNum(r.y1) && isFiniteNum(r.x2) && isFiniteNum(r.y2)) {
    out.refLine = { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 }
  }
  if (typeof s.sheetSize === 'string' && s.sheetSize.length <= 32) out.sheetSize = s.sheetSize
  if (isFiniteNum(s.correctionFactor) && s.correctionFactor > 0 && s.correctionFactor < 100) out.correctionFactor = s.correctionFactor
  return out
}

function jsonRes(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  try {
    const body = await req.json().catch(() => ({}))
    const token = body?.token
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const pageIndex = body?.pageIndex

    if (!token) return jsonRes(400, { error: 'token_required', message: 'Token is required' })
    if (!email) return jsonRes(403, { error: 'email_required', message: 'Enter your email to view' })

    const allowedDomains = getAllowedDomains()
    if (!emailDomainAllowed(email, allowedDomains)) {
      return jsonRes(403, {
        error: 'domain_restricted',
        message: `Access restricted to ${allowedDomains.join(', ')}. Please use your work email.`,
      })
    }

    if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex > 5000) {
      return jsonRes(400, { error: 'bad_page', message: 'Invalid page index' })
    }
    const scale = sanitizeScale(body?.scale)
    if (!scale) return jsonRes(400, { error: 'bad_scale', message: 'Invalid scale' })

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: link, error: linkErr } = await adminClient
      .from('project_view_links')
      .select('id, project_id, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (linkErr || !link) return jsonRes(404, { error: 'invalid_token', message: 'Invalid or expired link' })
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return jsonRes(400, { error: 'expired', message: 'This link has expired' })
    }

    const { data: proj, error: projErr } = await adminClient
      .from('projects')
      .select('id, data')
      .eq('id', link.project_id)
      .single()

    if (projErr || !proj) return jsonRes(404, { error: 'project_not_found', message: 'Project not found' })

    const data = (proj.data && typeof proj.data === 'object') ? proj.data : {}
    if (!Array.isArray(data.pages)) data.pages = []
    // Entries carry an `index` field (the app's serializer writes them densely,
    // but find by field, not position, to be safe with older/sparse data).
    let entry = data.pages.find((p: Record<string, unknown>) => p && p.index === pageIndex)
    if (!entry) {
      entry = { index: pageIndex }
      data.pages.push(entry)
    }
    scale.viewerSet = { email: email.toLowerCase(), at: new Date().toISOString() }
    entry.scale = scale

    const { error: updErr } = await adminClient
      .from('projects')
      .update({ data, updated_at: new Date().toISOString() })
      .eq('id', link.project_id)

    if (updErr) return jsonRes(500, { error: 'update_failed', message: 'Failed to save the scale' })

    return jsonRes(200, { ok: true, scale })
  } catch (e) {
    return jsonRes(500, { error: 'server_error', message: String(e) })
  }
})
