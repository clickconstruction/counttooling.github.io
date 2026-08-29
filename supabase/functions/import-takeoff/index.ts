import { requireUser } from '../_shared/adminGuard.ts'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'

// import-takeoff — Wave 3.3 of PipeTooling's estimator-twin pipeline
// (docs/TAKEOFF_IMPORT.md is the payload contract). The headless door for agent takeoffs:
// instead of robot-mousing the canvas, an agent computes placements and POSTs a
// takeoff.json; the marks land as a NORMAL project it owns, in the exact save-engine data
// shape, fully reviewable in the app (Bid Board review lane included). Deliberate limits:
//   * TWIN-ONLY (profiles.is_digital_twin) — humans have a canvas;
//   * always the caller's OWN project (own-project rule mirrors PT's fence);
//   * canvas-only (no PDF) — a human attaches/copies the plan set when reviewing;
//   * idempotent by (owner, name): re-import REPLACES that project's data, never
//     duplicates (the resumed-agent rule). Rejections are loud and name the field.
// Provenance: data.agentImport {imported_at, source, note} + every imported project name
// is visibly the agent's own (it owns it; twin badges already mark the account).

type Pt = { x: number; y: number }
type TakeoffPage = {
  index: number
  label?: string
  scale?: { pixelsPerUnit: number; unit: string } | null
  counterMarkers?: Record<string, Pt[]>
  quickLines?: Array<{ x1: number; y1: number; x2: number; y2: number; lineTypeId: string }>
  polylines?: Array<{ points: Pt[]; lineTypeId: string }>
  notes?: Array<{ x: number; y: number; text: string }>
}
type TakeoffJson = {
  version: 1
  counters: Array<{ id: string; name: string; icon?: string; color?: string }>
  lineTypes: Array<{ id: string; name: string; color?: string }>
  pages: TakeoffPage[]
}

function bad(field: string, why: string): Response {
  return jsonRes(400, { error: `takeoff.${field}: ${why}` })
}

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const ctx = await requireUser(req)
    if (ctx instanceof Response) return ctx
    const { user, adminClient } = ctx

    const { data: profile } = await adminClient.from('profiles').select('is_digital_twin').eq('user_id', user.id).maybeSingle()
    if (profile?.is_digital_twin !== true) {
      return jsonRes(403, { error: 'import-takeoff is the agent door — twin accounts only; people have a canvas.' })
    }

    const body = await req.json().catch(() => null) as { name?: string; note?: string; takeoff?: TakeoffJson } | null
    const name = String(body?.name ?? '').trim()
    const t = body?.takeoff
    if (!name) return jsonRes(400, { error: 'name required (the project name; re-import with the same name replaces it)' })
    if (!t || t.version !== 1) return bad('version', 'must be 1')
    if (!Array.isArray(t.counters) || !Array.isArray(t.lineTypes) || !Array.isArray(t.pages)) {
      return bad('counters|lineTypes|pages', 'must be arrays')
    }
    if (t.pages.length === 0 || t.pages.length > 200) return bad('pages', '1..200 pages')
    const counterIds = new Set<string>()
    for (const c of t.counters) {
      if (!c?.id || !String(c.name ?? '').trim()) return bad('counters', 'each needs id + name')
      counterIds.add(c.id)
    }
    const lineTypeIds = new Set<string>()
    for (const lt of t.lineTypes) {
      if (!lt?.id || !String(lt.name ?? '').trim()) return bad('lineTypes', 'each needs id + name')
      lineTypeIds.add(lt.id)
    }
    let markCount = 0
    let lineCount = 0
    for (const p of t.pages) {
      if (!Number.isInteger(p?.index) || p.index < 0) return bad('pages[].index', 'non-negative integer required')
      if (p.scale != null && !(num(p.scale.pixelsPerUnit) && p.scale.pixelsPerUnit > 0)) {
        return bad(`pages[${p.index}].scale.pixelsPerUnit`, 'must be a positive number when scale is given')
      }
      for (const [cid, marks] of Object.entries(p.counterMarkers ?? {})) {
        if (!counterIds.has(cid)) return bad(`pages[${p.index}].counterMarkers`, `unknown counter id ${cid}`)
        if (!Array.isArray(marks)) return bad(`pages[${p.index}].counterMarkers.${cid}`, 'must be an array of {x,y}')
        for (const m of marks) if (!num(m?.x) || !num(m?.y)) return bad(`pages[${p.index}].counterMarkers.${cid}`, 'each mark needs numeric x,y')
        markCount += marks.length
      }
      for (const q of p.quickLines ?? []) {
        if (!lineTypeIds.has(q?.lineTypeId)) return bad(`pages[${p.index}].quickLines`, `unknown lineTypeId ${q?.lineTypeId}`)
        if (![q.x1, q.y1, q.x2, q.y2].every(num)) return bad(`pages[${p.index}].quickLines`, 'x1,y1,x2,y2 must be numbers')
        lineCount++
      }
      for (const pl of p.polylines ?? []) {
        if (!lineTypeIds.has(pl?.lineTypeId)) return bad(`pages[${p.index}].polylines`, `unknown lineTypeId ${pl?.lineTypeId}`)
        if (!Array.isArray(pl.points) || pl.points.length < 2) return bad(`pages[${p.index}].polylines`, 'points needs >= 2 {x,y}')
        for (const m of pl.points) if (!num(m?.x) || !num(m?.y)) return bad(`pages[${p.index}].polylines`, 'each point needs numeric x,y')
        lineCount++
      }
      for (const n of p.notes ?? []) {
        if (!num(n?.x) || !num(n?.y) || !String(n?.text ?? '').trim()) return bad(`pages[${p.index}].notes`, 'each note needs x,y,text')
      }
    }

    // Build the exact save-engine data shape (canvas-only project: no PDF, bakeFrame null).
    const maxIndex = Math.max(...t.pages.map((p) => p.index))
    const pageByIndex = new Map(t.pages.map((p) => [p.index, p]))
    const uid = () => crypto.randomUUID().slice(0, 8)
    const pages = Array.from({ length: maxIndex + 1 }, (_, i) => {
      const p = pageByIndex.get(i)
      const quickLines = (p?.quickLines ?? []).map((q) => ({ ...q, id: `q_${uid()}`, color: null, group: null }))
      const polylines = (p?.polylines ?? []).map((pl) => ({ points: pl.points, lineTypeId: pl.lineTypeId, id: `pl_${uid()}`, color: null, group: null }))
      const counterMarkers: Record<string, Array<Pt & { id: string; group: null }>> = {}
      for (const [cid, marks] of Object.entries(p?.counterMarkers ?? {})) {
        counterMarkers[cid] = marks.map((m) => ({ x: m.x, y: m.y, id: `m_${uid()}`, group: null }))
      }
      const notes = (p?.notes ?? []).map((n) => ({ x: n.x, y: n.y, text: n.text, id: `n_${uid()}`, width: 180, fontSize: 14 }))
      return {
        index: i,
        label: p?.label,
        canvases: [{ id: `c_${uid()}`, name: 'Main', annotations: { counterMarkers, polylines, quickLines, highlights: [], notes, multiplyZones: [], scaleZones: [], roomBoxes: [], ghosts: [], legend: null } }],
        scale: p?.scale ?? undefined,
        rotation: 0,
        bakeFrame: null,
      }
    })
    const data = {
      version: 1,
      counters: t.counters.map((c) => ({ id: c.id, name: c.name, icon: c.icon ?? 'M96 96h448v448H96z', color: c.color ?? '#e8c547' })),
      lineTypes: t.lineTypes.map((lt) => ({ id: lt.id, name: lt.name, color: lt.color ?? '#4a9eff', curveStyle: 'straight' })),
      iconNames: {}, iconOrder: null, customIconPaths: [],
      groups: [], groupsEnabled: false, rooms: [],
      pages,
      activeCanvasIdByPage: {},
      numberKeyBindings: {},
      agentImport: { imported_at: new Date().toISOString(), source: 'takeoff.json v1', note: String(body?.note ?? '').slice(0, 400) || null },
    }
    const dataJson = JSON.stringify(data)

    // Idempotent by (owner, name): replace, never duplicate.
    const { data: existing } = await adminClient.from('projects').select('id').eq('user_id', user.id).eq('name', name).maybeSingle()
    const payload = {
      name,
      data,
      size_bytes: dataJson.length,
      counter_count: markCount,
      line_count: lineCount,
      updated_at: new Date().toISOString(),
    }
    let projectId: string
    if (existing?.id) {
      const { error } = await adminClient.from('projects').update(payload).eq('id', existing.id)
      if (error) return jsonRes(500, { error: `update failed: ${error.message}` })
      projectId = existing.id
    } else {
      const { data: ins, error } = await adminClient.from('projects').insert({ ...payload, user_id: user.id }).select('id').single()
      if (error || !ins) return jsonRes(500, { error: `insert failed: ${error?.message ?? 'unknown'}` })
      projectId = ins.id
    }
    console.log(`[import-takeoff] ${user.id} → project ${projectId} "${name}" marks=${markCount} lines=${lineCount} replaced=${!!existing?.id}`)
    return jsonRes(200, { success: true, project_id: projectId, replaced: !!existing?.id, counter_count: markCount, line_count: lineCount })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
