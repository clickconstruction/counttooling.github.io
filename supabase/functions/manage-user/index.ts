import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'

// CT↔PT user bridge — the CountTooling half (see PipeTooling docs; built 2026-08-28).
// PipeTooling is the single system of record for people, and this function is the
// COMMANDED path for provisioning, flagging, retiring, and renaming CountTooling
// accounts. It is called exclusively by PipeTooling's `ct-bridge` edge function
// (server → server), never by a browser. CT's own User Admin doors stay open as the
// manual escape hatch (settled 2026-08-28): admin-create-user (off-the-record creation
// — the panel says so; PT's weekly roster audit catches the drift), admin-delete-user
// (true deletion + project reassignment — deliberately NOT a bridge verb; PT can only
// ban), and admin-set-password (the bridge never touches credentials).
//
// Auth: X-Bridge-Secret must match CT_MANAGE_USER_SECRET (compared as SHA-256 digests —
// constant-time in effect). Rotating the secret severs the bridge.
//
// Design notes (locked decisions):
//   * One-directional: PT commands, CT obeys. No verb here reads PT.
//   * "Inactive" on CT = Supabase auth ban (banned_until far-future) — profiles has no
//     active column and we are not inventing one.
//   * `create` is idempotent: an existing email returns the existing uuid, so PT can
//     retry freely (fail-soft on the PT side).
//   * `roster` exists for PT's weekly drift audit — drift is caught, not prevented.

const bridgeCors = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': corsHeaders['Access-Control-Allow-Headers'] + ', x-bridge-secret',
}

const BAN_FOREVER = '876000h' // ~100 years
const BAN_NONE = 'none'

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

type AdminUser = { id: string; email?: string | null; banned_until?: string | null; user_metadata?: Record<string, unknown> }

function isActive(u: AdminUser): boolean {
  if (!u.banned_until) return true
  return Date.parse(u.banned_until) <= Date.now()
}

async function listAllUsers(admin: ReturnType<typeof createClient>): Promise<AdminUser[]> {
  const all: AdminUser[] = []
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    all.push(...(data.users as AdminUser[]))
    if (data.users.length < 1000) break
  }
  return all
}

async function findByEmail(admin: ReturnType<typeof createClient>, email: string): Promise<AdminUser | null> {
  const users = await listAllUsers(admin)
  return users.find((u) => (u.email ?? '').toLowerCase() === email) ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: bridgeCors })
  if (req.method !== 'POST') return jsonRes(405, { error: 'POST only' })
  try {
    const expected = Deno.env.get('CT_MANAGE_USER_SECRET')
    const got = req.headers.get('X-Bridge-Secret')
    if (!expected || !got || (await sha256Hex(got)) !== (await sha256Hex(expected))) {
      return jsonRes(403, { error: 'Forbidden' })
    }

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body.verb !== 'string') return jsonRes(400, { error: 'Missing verb' })
    const verb = body.verb

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceRoleKey) return jsonRes(500, { error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    switch (verb) {
      case 'create': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email || !email.includes('@')) return jsonRes(400, { error: 'Valid email required' })
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const isTwin = body.is_digital_twin === true
        const existing = await findByEmail(admin, email)
        if (existing) {
          // Idempotent: make sure the twin flag matches what PT asked for, return the uuid.
          if (isTwin) {
            await admin.from('profiles').upsert({ user_id: existing.id, is_digital_twin: true }, { onConflict: 'user_id' })
          }
          return jsonRes(200, { ct_user_id: existing.id, email, existed: true })
        }
        const password = crypto.randomUUID() + crypto.randomUUID() // random, never used or shown
        const { data: created, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: name ? { name } : undefined,
        })
        if (error || !created?.user) return jsonRes(500, { error: `createUser failed: ${error?.message ?? 'unknown'}` })
        // handle_new_user auto-inserts the profiles row; upsert to set the twin flag either way.
        const { error: profErr } = await admin
          .from('profiles')
          .upsert({ user_id: created.user.id, is_admin: false, is_digital_twin: isTwin }, { onConflict: 'user_id' })
        if (profErr) return jsonRes(500, { error: `Profile write failed: ${profErr.message}`, ct_user_id: created.user.id })
        console.log(`manage-user create: ${email} → ${created.user.id} twin=${isTwin}`)
        return jsonRes(200, { ct_user_id: created.user.id, email, existed: false })
      }
      case 'deactivate':
      case 'reactivate': {
        const id = String(body.ct_user_id ?? '')
        if (!id) return jsonRes(400, { error: 'ct_user_id required' })
        const { error } = await admin.auth.admin.updateUserById(id, {
          ban_duration: verb === 'deactivate' ? BAN_FOREVER : BAN_NONE,
        })
        if (error) return jsonRes(500, { error: `${verb} failed: ${error.message}` })
        console.log(`manage-user ${verb}: ${id}`)
        return jsonRes(200, { ct_user_id: id, active: verb === 'reactivate' })
      }
      case 'set_twin_flag': {
        const id = String(body.ct_user_id ?? '')
        if (!id) return jsonRes(400, { error: 'ct_user_id required' })
        const flag = body.is_digital_twin === true
        const { error } = await admin.from('profiles').upsert({ user_id: id, is_digital_twin: flag }, { onConflict: 'user_id' })
        if (error) return jsonRes(500, { error: `set_twin_flag failed: ${error.message}` })
        return jsonRes(200, { ct_user_id: id, is_digital_twin: flag })
      }
      case 'update_email': {
        const id = String(body.ct_user_id ?? '')
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!id || !email.includes('@')) return jsonRes(400, { error: 'ct_user_id and valid email required' })
        const { error } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true })
        if (error) return jsonRes(500, { error: `update_email failed: ${error.message}` })
        console.log(`manage-user update_email: ${id} → ${email}`)
        return jsonRes(200, { ct_user_id: id, email })
      }
      case 'lookup': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email) return jsonRes(400, { error: 'email required' })
        const u = await findByEmail(admin, email)
        if (!u) return jsonRes(200, { found: false })
        return jsonRes(200, { found: true, ct_user_id: u.id, email: u.email, active: isActive(u) })
      }
      case 'roster': {
        const users = await listAllUsers(admin)
        const { data: profiles, error } = await admin.from('profiles').select('user_id, is_admin, is_digital_twin')
        if (error) return jsonRes(500, { error: `profiles read failed: ${error.message}` })
        const profById = new Map((profiles ?? []).map((p) => [p.user_id as string, p]))
        const roster = users.map((u) => ({
          ct_user_id: u.id,
          email: u.email ?? null,
          is_digital_twin: profById.get(u.id)?.is_digital_twin === true,
          is_admin: profById.get(u.id)?.is_admin === true,
          active: isActive(u),
        }))
        return jsonRes(200, { roster, count: roster.length })
      }
      case 'twin_projects': {
        // Robot-ready train CT-3: PT's get_work_state surfaces the twin's CT takeoff
        // projects (review status + note included) so a sent-back takeoff is a
        // resumable fact the agent reads, not a surprise a human relays.
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!email) return jsonRes(400, { error: 'email required' })
        const u = await findByEmail(admin, email)
        if (!u) return jsonRes(200, { found: false, projects: [] })
        const { data: prof } = await admin.from('profiles').select('is_digital_twin').eq('user_id', u.id).maybeSingle()
        if (prof?.is_digital_twin !== true) return jsonRes(400, { error: 'twin_projects is twin-scoped — not a twin account' })
        const { data: projects, error } = await admin.from('projects')
          .select('id, name, updated_at, counter_count, line_count, pdf_path, review_status, review_note, review_requested_at, reviewed_at')
          .eq('user_id', u.id)
          .order('updated_at', { ascending: false })
          .limit(20)
        if (error) return jsonRes(500, { error: `projects read failed: ${error.message}` })
        return jsonRes(200, {
          found: true,
          projects: (projects ?? []).map((p) => ({
            id: p.id, name: p.name, updated_at: p.updated_at,
            counter_count: p.counter_count, line_count: p.line_count,
            has_pdf: !!p.pdf_path,
            review_status: p.review_status, review_note: p.review_note,
            review_requested_at: p.review_requested_at, reviewed_at: p.reviewed_at,
          })),
        })
      }
      case 'twin_rfis': {
        // Notes-ledger loop (2026-08-30): PT's get_work_state surfaces the note
        // ledger of one twin project — every note with its RFI kind, resolved
        // state, and the reviewer's answer — so an answered RFI is a fact the
        // agent reads on its next turn, not something a human has to relay.
        const email = String(body.email ?? '').trim().toLowerCase()
        const projectId = String(body.project_id ?? '').trim()
        if (!email || !projectId) return jsonRes(400, { error: 'email + project_id required' })
        const u = await findByEmail(admin, email)
        if (!u) return jsonRes(404, { error: 'no such CT user' })
        const { data: prof } = await admin.from('profiles').select('is_digital_twin').eq('user_id', u.id).maybeSingle()
        if (prof?.is_digital_twin !== true) return jsonRes(400, { error: 'twin_rfis is twin-scoped — not a twin account' })
        const { data: proj, error } = await admin.from('projects')
          .select('id, name, data')
          .eq('user_id', u.id)
          .eq('id', projectId)
          .maybeSingle()
        if (error) return jsonRes(500, { error: `project read failed: ${error.message}` })
        if (!proj) return jsonRes(404, { error: 'no such project for that twin' })
        const RFI_RE = /^\s*RFI\s*:/i
        const notes: Array<Record<string, unknown>> = []
        let num = 0
        const pages = (proj.data as { pages?: Array<{ name?: string; canvases?: Array<{ name?: string; annotations?: { notes?: Array<Record<string, unknown>> } }> }> })?.pages ?? []
        pages.forEach((pg, pi) => {
          const canvases = pg?.canvases ?? []
          canvases.forEach((cv) => {
            for (const n of cv?.annotations?.notes ?? []) {
              const text = String(n?.text ?? '').trim()
              if (!text) continue
              num += 1
              if (notes.length >= 100) continue
              notes.push({
                num,
                page: pi + 1,
                page_name: pg?.name ?? '',
                canvas: canvases.length > 1 ? (cv?.name ?? '') : '',
                kind: RFI_RE.test(text) ? 'rfi' : 'note',
                text,
                detail: typeof n?.detail === 'string' ? n.detail : undefined,
                resolved: n?.resolved === true,
                answer: typeof n?.answer === 'string' ? n.answer : undefined,
              })
            }
          })
        })
        const rfis = notes.filter((x) => x.kind === 'rfi')
        return jsonRes(200, {
          project_id: proj.id,
          name: proj.name,
          total_notes: num,
          open_rfis: rfis.filter((x) => !x.resolved).length,
          answered_rfis: rfis.filter((x) => typeof x.answer === 'string').length,
          notes,
        })
      }
      case 'set_twin_credential': {
        // Robot-ready train CT-4: per-twin credential parity. PT issues one token per
        // twin; its sha256 hash is mirrored here so CT's twin-login can verify the
        // SAME token locally instead of trusting the shared fleet secret alone.
        const email = String(body.email ?? '').trim().toLowerCase()
        const tokenHash = String(body.token_hash ?? '').trim().toLowerCase()
        if (!email || !/^[0-9a-f]{64}$/.test(tokenHash)) return jsonRes(400, { error: 'email + token_hash (sha256 hex) required' })
        const u = await findByEmail(admin, email)
        if (!u) return jsonRes(404, { error: 'no such CT user' })
        const { data: prof } = await admin.from('profiles').select('is_digital_twin').eq('user_id', u.id).maybeSingle()
        if (prof?.is_digital_twin !== true) return jsonRes(400, { error: 'credentials are twin-only' })
        const { error } = await admin.from('twin_credentials').insert({ user_id: u.id, token_hash: tokenHash })
        if (error && !/duplicate key/.test(error.message)) return jsonRes(500, { error: `credential insert failed: ${error.message}` })
        console.log(`manage-user set_twin_credential: ${u.id}`)
        return jsonRes(200, { ok: true, existed: !!error })
      }
      case 'revoke_twin_credential': {
        const tokenHash = String(body.token_hash ?? '').trim().toLowerCase()
        if (!/^[0-9a-f]{64}$/.test(tokenHash)) return jsonRes(400, { error: 'token_hash (sha256 hex) required' })
        const { error } = await admin.from('twin_credentials').update({ revoked_at: new Date().toISOString() }).eq('token_hash', tokenHash).is('revoked_at', null)
        if (error) return jsonRes(500, { error: `revoke failed: ${error.message}` })
        console.log('manage-user revoke_twin_credential')
        return jsonRes(200, { ok: true })
      }
      default:
        return jsonRes(400, { error: `Unknown verb: ${verb}` })
    }
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
