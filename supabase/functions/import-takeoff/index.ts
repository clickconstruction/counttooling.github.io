import { requireUser } from '../_shared/adminGuard.ts'
import { jsonRes } from '../_shared/json.ts'
import { corsHeaders } from '../_shared/cors.ts'

// import-takeoff — Wave 3.3 of PipeTooling's estimator-twin pipeline
// (TAKEOFF_IMPORT.md is the payload contract). The headless door for agent takeoffs:
// instead of robot-mousing the canvas, an agent computes placements and POSTs a
// takeoff.json; the marks land as a NORMAL project it owns, in the exact save-engine data
// shape, fully reviewable in the app (Bid Board review lane included). Deliberate limits:
//   * TWIN-ONLY (profiles.is_digital_twin) — humans have a canvas;
//   * always the caller's OWN project (own-project rule mirrors PT's fence);
//   * idempotent by (owner, name): re-import REPLACES that project's data, never
//     duplicates (the resumed-agent rule). Rejections are loud and name the field.
// PDF leg (robot-pdf-intake): optional pdf_url — fetched server-side (pdf_headers ride
// along, e.g. an X-Twin-Token for PipeTooling's plan-fetch), page-counted with pdf-lib,
// stored at the app's exact path (<uid>/<project>/document.pdf, pdfs bucket, upsert) and
// stamped as projects.pdf_path — so a twin's project arrives WITH the plans under the
// marks instead of "Canvas only". A failed PDF leg never destroys the imported marks:
// the response's pdf.ok/pdf.error says loudly what happened.
// Provenance: data.agentImport {imported_at, source, note} + every imported project name
// is visibly the agent's own (it owns it; twin badges already mark the account).

type Pt = { x: number; y: number }
// v2 (2026-09-07, the electrical fleet): marks and lines may carry `group` (a circuit /
// panel / area — one of takeoff.groups), lines may carry startDrop / endDrop (feet of
// vertical at either end), palette items may carry childCounts (the per-count / per-run
// / per-N-ft rules that tally boxes, couplings and straps), pages may carry multiply
// and scale zones, and the takeoff may name its trade. v1 payloads are unchanged.
type ChildRule = { name: string; qty: number; per: 'count' | 'run' | 'ft'; ftInterval?: number }
type TakeoffPage = {
  index: number
  label?: string
  scale?: { pixelsPerUnit: number; unit: string } | null
  rotation?: number
  counterMarkers?: Record<string, Array<Pt & { group?: string }>>
  quickLines?: Array<{ x1: number; y1: number; x2: number; y2: number; lineTypeId: string; group?: string; startDrop?: number; endDrop?: number }>
  polylines?: Array<{ points: Pt[]; lineTypeId: string; group?: string; startDrop?: number; endDrop?: number }>
  notes?: Array<{ x: number; y: number; text: string; detail?: string }>
  multiplyZones?: Array<{ x1: number; y1: number; x2: number; y2: number; multiplier: number }>
  scaleZones?: Array<{ x1: number; y1: number; x2: number; y2: number; scale: { pixelsPerUnit: number; unit: string } }>
}
type TakeoffJson = {
  version: 1 | 2
  trade?: 'plumbing' | 'electrical' | 'hvac'
  groups?: Array<{ id: string; name: string; color?: string }>
  counters: Array<{ id: string; name: string; icon?: string; color?: string; canvas?: string; childCounts?: ChildRule[] }>
  lineTypes: Array<{ id: string; name: string; color?: string; canvas?: string; childCounts?: ChildRule[] }>
  pages: TakeoffPage[]
}
const TRADES = ['plumbing', 'electrical', 'hvac']
const PALETTE_COLORS = ['#e85447', '#4a9eff', '#e8c547', '#47c88e', '#a47fff', '#ff7a47', '#47d4d4', '#ff47b0']
function validChildRules(rules: unknown, where: string): { ok: ChildRule[] } | { error: Response } {
  if (rules == null) return { ok: [] }
  if (!Array.isArray(rules)) return { error: bad(where, 'childCounts must be an array') }
  const out: ChildRule[] = []
  for (const r of rules as Record<string, unknown>[]) {
    const name = String(r?.name ?? '').trim().slice(0, 120)
    const qty = Number(r?.qty)
    const per = String(r?.per ?? 'count')
    if (!name || !num(qty) || qty <= 0) return { error: bad(where, 'each childCounts rule needs name + positive qty') }
    if (!['count', 'run', 'ft'].includes(per)) return { error: bad(where, "childCounts.per must be 'count', 'run' or 'ft'") }
    const rule: ChildRule = { name, qty, per: per as ChildRule['per'] }
    if (per === 'ft') {
      const iv = Number(r?.ftInterval ?? 10)
      if (!num(iv) || iv <= 0) return { error: bad(where, 'childCounts.ftInterval must be a positive number of feet') }
      rule.ftInterval = iv
    }
    out.push(rule)
  }
  return { ok: out }
}

function bad(field: string, why: string): Response {
  return jsonRes(400, { error: `takeoff.${field}: ${why}` })
}

const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)

const PDF_MAX_BYTES = 50 * 1024 * 1024 // the app's own storage cap (SUPABASE_SETUP.md)

// Fetch the plan set for the PDF leg. Returns bytes + page count, or a loud error string.
async function fetchPdf(url: string, headers: Record<string, string>): Promise<{ bytes: Uint8Array; pageCount: number } | { error: string }> {
  let res: Response
  try {
    res = await fetch(url, { headers })
  } catch (e) {
    return { error: `pdf_url fetch failed: ${String(e instanceof Error ? e.message : e)}` }
  }
  if (!res.ok) return { error: `pdf_url fetch failed (${res.status})${res.status === 401 || res.status === 403 ? ' — is the auth header right?' : ''}` }
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > PDF_MAX_BYTES) return { error: `PDF is ${declared} bytes — over the ${PDF_MAX_BYTES} storage cap` }
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.length > PDF_MAX_BYTES) return { error: `PDF is ${bytes.length} bytes — over the ${PDF_MAX_BYTES} storage cap` }
  const magic = new TextDecoder().decode(bytes.slice(0, 5))
  if (magic !== '%PDF-') return { error: `pdf_url did not return a PDF (starts "${magic.replace(/[^ -~]/g, '?')}")` }
  try {
    const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1')
    const doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true })
    return { bytes, pageCount: doc.getPageCount() }
  } catch (e) {
    return { error: `PDF would not parse: ${String(e instanceof Error ? e.message : e)}` }
  }
}

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

    const body = await req.json().catch(() => null) as { name?: string; note?: string; external_ref?: string; takeoff?: TakeoffJson; pdf_url?: string; pdf_headers?: Record<string, string> } | null
    const name = String(body?.name ?? '').trim()
    const t = body?.takeoff
    if (!name) return jsonRes(400, { error: 'name required (the project name; re-import with the same name replaces it)' })
    if (!t || (t.version !== 1 && t.version !== 2)) return bad('version', 'must be 1 or 2')
    const v2 = t.version === 2
    if (!v2) {
      // v1 stays strict: none of the v2 fields is silently accepted under the old version.
      const stray = ['trade', 'groups'].filter((k) => (t as Record<string, unknown>)[k] != null)
      if (stray.length) return bad(stray[0], 'is a version-2 field — send version: 2')
    }
    const trade = t.trade == null ? null : String(t.trade)
    if (trade != null && !TRADES.includes(trade)) return bad('trade', `one of ${TRADES.join('/')} (or omit)`)
    // Optional bid stamp ("b409") — shown as a chip in project lists. Field present →
    // set on insert AND replace; absent → left untouched on re-import.
    const externalRef = body?.external_ref !== undefined ? String(body.external_ref ?? '').trim().slice(0, 40) || null : undefined

    // PDF leg: fetch first so the page count can validate the takeoff's page indexes.
    const pdfUrl = String(body?.pdf_url ?? '').trim()
    let pdf: { bytes: Uint8Array; pageCount: number } | { error: string } | null = null
    if (pdfUrl) {
      if (!/^https:\/\//.test(pdfUrl)) return jsonRes(400, { error: 'pdf_url must be https' })
      const rawHeaders = body?.pdf_headers ?? {}
      const entries = Object.entries(rawHeaders).slice(0, 4).filter(([k, v]) => typeof v === 'string' && k.length < 64 && v.length < 2048)
      pdf = await fetchPdf(pdfUrl, Object.fromEntries(entries))
    }
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
    // v2: groups (circuits / panels / areas) and child-count rules on palette items.
    const groupIds = new Set<string>()
    const groupsOut: Array<{ id: string; name: string; color: string }> = []
    if (v2 && t.groups != null) {
      if (!Array.isArray(t.groups) || t.groups.length > 200) return bad('groups', 'must be an array (max 200)')
      for (const g of t.groups) {
        const id = String(g?.id ?? '').trim()
        const gname = String(g?.name ?? '').trim().slice(0, 80)
        if (!id || !gname) return bad('groups', 'each needs id + name')
        if (groupIds.has(id)) return bad('groups', `duplicate id ${id}`)
        groupIds.add(id)
        groupsOut.push({ id, name: gname, color: typeof g.color === 'string' && g.color ? g.color : PALETTE_COLORS[groupsOut.length % PALETTE_COLORS.length] })
      }
    }
    const groupOf = (raw: unknown, where: string): { ok: string | null } | { error: Response } => {
      if (raw == null || raw === '') return { ok: null }
      if (!v2) return { error: bad(where, 'group is a version-2 field — send version: 2') }
      const id = String(raw)
      return groupIds.has(id) ? { ok: id } : { error: bad(where, `unknown group id ${id}`) }
    }
    const dropOf = (raw: unknown, where: string): { ok: number | null } | { error: Response } => {
      if (raw == null) return { ok: null }
      if (!v2) return { error: bad(where, 'drops are version-2 fields — send version: 2') }
      const n = Number(raw)
      return num(n) && n >= 0 ? { ok: n } : { error: bad(where, 'startDrop/endDrop must be non-negative feet') }
    }
    const childRulesByCounter = new Map<string, ChildRule[]>()
    for (const c of t.counters) {
      if (c.childCounts == null) continue
      if (!v2) return bad('counters.childCounts', 'is a version-2 field — send version: 2')
      const r = validChildRules(c.childCounts, `counters[${c.id}].childCounts`)
      if ('error' in r) return r.error
      childRulesByCounter.set(c.id, r.ok)
    }
    const childRulesByLineType = new Map<string, ChildRule[]>()
    for (const lt of t.lineTypes) {
      if (lt.childCounts == null) continue
      if (!v2) return bad('lineTypes.childCounts', 'is a version-2 field — send version: 2')
      const r = validChildRules(lt.childCounts, `lineTypes[${lt.id}].childCounts`)
      if ('error' in r) return r.error
      childRulesByLineType.set(lt.id, r.ok)
    }
    let markCount = 0
    let lineCount = 0
    let zoneCount = 0
    for (const p of t.pages) {
      if (!Number.isInteger(p?.index) || p.index < 0) return bad('pages[].index', 'non-negative integer required')
      if (p.scale != null && !(num(p.scale.pixelsPerUnit) && p.scale.pixelsPerUnit > 0)) {
        return bad(`pages[${p.index}].scale.pixelsPerUnit`, 'must be a positive number when scale is given')
      }
      // Reviewer orientation: rotated source sheets import with the view rotation set
      // so plans open right-side up. Pure view transform — coordinates stay base-frame.
      if (p.rotation != null && ![0, 90, 180, 270].includes(p.rotation)) {
        return bad(`pages[${p.index}].rotation`, 'must be 0, 90, 180, or 270')
      }
      for (const [cid, marks] of Object.entries(p.counterMarkers ?? {})) {
        if (!counterIds.has(cid)) return bad(`pages[${p.index}].counterMarkers`, `unknown counter id ${cid}`)
        if (!Array.isArray(marks)) return bad(`pages[${p.index}].counterMarkers.${cid}`, 'must be an array of {x,y}')
        for (const m of marks) {
          if (!num(m?.x) || !num(m?.y)) return bad(`pages[${p.index}].counterMarkers.${cid}`, 'each mark needs numeric x,y')
          const g = groupOf(m.group, `pages[${p.index}].counterMarkers.${cid}.group`)
          if ('error' in g) return g.error
        }
        markCount += marks.length
      }
      for (const q of p.quickLines ?? []) {
        if (!lineTypeIds.has(q?.lineTypeId)) return bad(`pages[${p.index}].quickLines`, `unknown lineTypeId ${q?.lineTypeId}`)
        if (![q.x1, q.y1, q.x2, q.y2].every(num)) return bad(`pages[${p.index}].quickLines`, 'x1,y1,x2,y2 must be numbers')
        const g = groupOf(q.group, `pages[${p.index}].quickLines.group`)
        if ('error' in g) return g.error
        for (const k of ['startDrop', 'endDrop'] as const) {
          const d = dropOf(q[k], `pages[${p.index}].quickLines.${k}`)
          if ('error' in d) return d.error
        }
        lineCount++
      }
      for (const pl of p.polylines ?? []) {
        if (!lineTypeIds.has(pl?.lineTypeId)) return bad(`pages[${p.index}].polylines`, `unknown lineTypeId ${pl?.lineTypeId}`)
        if (!Array.isArray(pl.points) || pl.points.length < 2) return bad(`pages[${p.index}].polylines`, 'points needs >= 2 {x,y}')
        for (const m of pl.points) if (!num(m?.x) || !num(m?.y)) return bad(`pages[${p.index}].polylines`, 'each point needs numeric x,y')
        const g = groupOf(pl.group, `pages[${p.index}].polylines.group`)
        if ('error' in g) return g.error
        for (const k of ['startDrop', 'endDrop'] as const) {
          const d = dropOf(pl[k], `pages[${p.index}].polylines.${k}`)
          if ('error' in d) return d.error
        }
        lineCount++
      }
      if (p.multiplyZones != null || p.scaleZones != null) {
        if (!v2) return bad(`pages[${p.index}].multiplyZones|scaleZones`, 'zones are version-2 fields — send version: 2')
        for (const z of p.multiplyZones ?? []) {
          if (![z?.x1, z?.y1, z?.x2, z?.y2].every(num)) return bad(`pages[${p.index}].multiplyZones`, 'x1,y1,x2,y2 must be numbers')
          if (!num(z.multiplier) || z.multiplier < 1 || !Number.isInteger(z.multiplier)) return bad(`pages[${p.index}].multiplyZones`, 'multiplier must be an integer >= 1')
          zoneCount++
        }
        for (const z of p.scaleZones ?? []) {
          if (![z?.x1, z?.y1, z?.x2, z?.y2].every(num)) return bad(`pages[${p.index}].scaleZones`, 'x1,y1,x2,y2 must be numbers')
          if (!(num(z?.scale?.pixelsPerUnit) && z.scale.pixelsPerUnit > 0)) return bad(`pages[${p.index}].scaleZones`, 'scale.pixelsPerUnit must be a positive number')
          zoneCount++
        }
      }
      for (const n of p.notes ?? []) {
        if (!num(n?.x) || !num(n?.y) || !String(n?.text ?? '').trim()) return bad(`pages[${p.index}].notes`, 'each note needs x,y,text')
        // Notes-ledger contract: keep the on-sheet text short; long provenance
        // rides in `detail` and shows in the ledger drawer, never on the sheet.
        if (n.detail != null && typeof n.detail !== 'string') return bad(`pages[${p.index}].notes`, 'detail must be a string')
        if (String(n.detail ?? '').length > 4000) return bad(`pages[${p.index}].notes`, 'detail over 4000 chars')
      }
    }

    // With a PDF in hand, page indexes must fit inside it — and the pages array must
    // cover EVERY PDF page so the app's page list and the document agree.
    const pdfPageCount = pdf && 'pageCount' in pdf ? pdf.pageCount : null
    if (pdfPageCount != null) {
      for (const p of t.pages) {
        if (p.index >= pdfPageCount) return bad(`pages[${p.index}].index`, `beyond the PDF's page count (${pdfPageCount})`)
      }
    }

    // Build the exact save-engine data shape (bakeFrame null; canvas-only when no PDF).
    // Layered canvases (robot-pdf-intake follow-up, 2026-08-30): each counter/lineType
    // may name a `canvas` — annotations group into per-page canvases by that name, so
    // the app's existing canvas switcher / show-all / hide-marks give reviewers
    // per-layer toggling (Fixtures / one per pipe system / Fittings) with no new UI.
    // Elements without a canvas land on "Main" (back-compat).
    const canvasOf = new Map<string, string>()
    for (const c of t.counters) canvasOf.set(`c:${c.id}`, String(c.canvas ?? '').trim() || 'Main')
    for (const lt of t.lineTypes) canvasOf.set(`l:${lt.id}`, String(lt.canvas ?? '').trim() || 'Main')
    const canvasOrder: string[] = []
    const seeCanvas = (name: string) => {
      if (!canvasOrder.includes(name)) canvasOrder.push(name)
    }
    for (const c of t.counters) seeCanvas(canvasOf.get(`c:${c.id}`)!)
    for (const lt of t.lineTypes) seeCanvas(canvasOf.get(`l:${lt.id}`)!)
    if (!canvasOrder.length) canvasOrder.push('Main')

    const maxIndex = Math.max(Math.max(...t.pages.map((p) => p.index)), (pdfPageCount ?? 0) - 1)
    const pageByIndex = new Map(t.pages.map((p) => [p.index, p]))
    const uid = () => crypto.randomUUID().slice(0, 8)
    type Annotations = { counterMarkers: Record<string, Array<Pt & { id: string; group: null }>>; polylines: unknown[]; quickLines: unknown[]; highlights: unknown[]; notes: unknown[]; multiplyZones: unknown[]; scaleZones: unknown[]; roomBoxes: unknown[]; ghosts: unknown[]; legend: null }
    const pages = Array.from({ length: maxIndex + 1 }, (_, i) => {
      const p = pageByIndex.get(i)
      const emptyAnn = (): Annotations => ({ counterMarkers: {}, polylines: [], quickLines: [], highlights: [], notes: [], multiplyZones: [], scaleZones: [], roomBoxes: [], ghosts: [], legend: null })
      const byCanvas = new Map<string, Annotations>()
      const annFor = (name: string): Annotations => {
        let a = byCanvas.get(name)
        if (!a) {
          a = emptyAnn()
          byCanvas.set(name, a)
        }
        return a
      }
      // drops ride the line ends in feet (the Drop tool's own shape: value + unit)
      const drops = (l: { startDrop?: number; endDrop?: number }) => ({
        ...(l.startDrop != null && l.startDrop > 0 ? { startDrop: l.startDrop, startDropUnit: 'ft' } : {}),
        ...(l.endDrop != null && l.endDrop > 0 ? { endDrop: l.endDrop, endDropUnit: 'ft' } : {}),
      })
      for (const q of p?.quickLines ?? []) {
        const { group, startDrop: _s, endDrop: _e, ...rest } = q
        annFor(canvasOf.get(`l:${q.lineTypeId}`)!).quickLines.push({ ...rest, id: `q_${uid()}`, color: null, group: group ?? null, ...drops(q) })
      }
      for (const pl of p?.polylines ?? []) {
        annFor(canvasOf.get(`l:${pl.lineTypeId}`)!).polylines.push({ points: pl.points, lineTypeId: pl.lineTypeId, id: `pl_${uid()}`, color: null, group: pl.group ?? null, ...drops(pl) })
      }
      for (const [cid, marks] of Object.entries(p?.counterMarkers ?? {})) {
        const ann = annFor(canvasOf.get(`c:${cid}`)!)
        ann.counterMarkers[cid] = marks.map((m) => ({ x: m.x, y: m.y, id: `m_${uid()}`, group: m.group ?? null }))
      }
      // zones apply per canvas (the zone lookup walks the canvas's own annotations), so a
      // page's zones are stamped onto every canvas that page ends up with.
      const pageZones = {
        multiply: (p?.multiplyZones ?? []).map((z) => ({ x1: z.x1, y1: z.y1, x2: z.x2, y2: z.y2, multiplier: z.multiplier })),
        scale: (p?.scaleZones ?? []).map((z) => ({ x1: z.x1, y1: z.y1, x2: z.x2, y2: z.y2, scale: { pixelsPerUnit: z.scale.pixelsPerUnit, unit: z.scale.unit || 'ft' } })),
      }
      const noteTarget = byCanvas.size ? (canvasOrder.find((n) => byCanvas.has(n)) ?? canvasOrder[0]!) : canvasOrder[0]!
      for (const n of p?.notes ?? []) {
        const detail = String(n.detail ?? '').trim()
        annFor(noteTarget).notes.push({ x: n.x, y: n.y, text: n.text, id: `n_${uid()}`, width: 180, fontSize: 14, ...(detail ? { detail } : {}) })
      }
      if (!byCanvas.size) byCanvas.set(canvasOrder[0]!, emptyAnn())
      if (pageZones.multiply.length || pageZones.scale.length) {
        for (const ann of byCanvas.values()) {
          for (const z of pageZones.multiply) ann.multiplyZones.push({ ...z, id: `mz_${uid()}` })
          for (const z of pageZones.scale) ann.scaleZones.push({ ...z, id: `sz_${uid()}` })
        }
      }
      const canvases = canvasOrder.filter((n) => byCanvas.has(n)).map((name) => ({ id: `c_${uid()}`, name, annotations: byCanvas.get(name)! }))
      return {
        index: i,
        label: p?.label,
        canvases,
        scale: p?.scale ?? undefined,
        rotation: p?.rotation ?? 0,
        bakeFrame: null,
      }
    })
    const data = {
      version: 1,
      counters: t.counters.map((c) => ({ id: c.id, name: c.name, icon: c.icon ?? 'M96 96h448v448H96z', color: c.color ?? '#e8c547', ...(childRulesByCounter.has(c.id) ? { childCounts: childRulesByCounter.get(c.id) } : {}) })),
      lineTypes: t.lineTypes.map((lt) => ({ id: lt.id, name: lt.name, color: lt.color ?? '#4a9eff', curveStyle: 'straight', ...(childRulesByLineType.has(lt.id) ? { childCounts: childRulesByLineType.get(lt.id) } : {}) })),
      iconNames: {}, iconOrder: null, customIconPaths: [],
      groups: groupsOut, groupsEnabled: groupsOut.length > 0, rooms: [],
      ...(trade ? { trade } : {}),
      pages,
      activeCanvasIdByPage: {},
      numberKeyBindings: {},
      agentImport: { imported_at: new Date().toISOString(), source: `takeoff.json v${t.version}`, note: String(body?.note ?? '').slice(0, 400) || null },
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
      ...(externalRef !== undefined ? { external_ref: externalRef } : {}),
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

    // PDF leg lands after the row exists (the storage path needs the project id). The
    // app's exact convention: <uid>/<project>/document.pdf in the private pdfs bucket.
    // A failure here never unwinds the imported marks — pdf.ok/pdf.error is the loud report.
    let pdfResult: { ok: boolean; path?: string; bytes?: number; page_count?: number; error?: string } | null = null
    if (pdf) {
      if ('error' in pdf) {
        pdfResult = { ok: false, error: pdf.error }
      } else {
        const storagePath = `${user.id}/${projectId}/document.pdf`
        const { error: upErr } = await adminClient.storage.from('pdfs').upload(storagePath, pdf.bytes, { contentType: 'application/pdf', upsert: true })
        if (upErr) {
          pdfResult = { ok: false, error: `storage upload failed: ${upErr.message}` }
        } else {
          const { error: pathErr } = await adminClient.from('projects').update({ pdf_path: storagePath }).eq('id', projectId)
          pdfResult = pathErr
            ? { ok: false, error: `pdf stored but pdf_path stamp failed: ${pathErr.message}` }
            : { ok: true, path: storagePath, bytes: pdf.bytes.length, page_count: pdf.pageCount }
        }
      }
    }

    console.log(`[import-takeoff] ${user.id} → project ${projectId} "${name}" marks=${markCount} lines=${lineCount} replaced=${!!existing?.id} pdf=${pdfResult ? (pdfResult.ok ? `${pdfResult.bytes}b/${pdfResult.page_count}p` : `FAIL ${pdfResult.error}`) : 'none'}`)
    return jsonRes(200, { success: true, project_id: projectId, replaced: !!existing?.id, counter_count: markCount, line_count: lineCount, group_count: groupsOut.length, zone_count: zoneCount, child_rules: childRulesByCounter.size + childRulesByLineType.size, trade, pdf: pdfResult })
  } catch (e) {
    return jsonRes(500, { error: String(e) })
  }
})
