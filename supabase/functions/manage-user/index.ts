import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'

// CT↔PT user bridge — the CountTooling half (see PipeTooling docs; built 2026-08-28).
// PipeTooling is the single system of record for people; this function is the ONLY way
// accounts are provisioned, flagged, retired, or renamed on CountTooling now. It is
// called exclusively by PipeTooling's `ct-bridge` edge function (server → server), never
// by a browser.
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
      default:
        return jsonRes(400, { error: `Unknown verb: ${verb}` })
    }
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
