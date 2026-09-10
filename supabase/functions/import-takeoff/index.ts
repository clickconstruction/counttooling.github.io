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
// Rulebook (2026-09-10): a per-ft rule may carry `intervalIn` (inches — wins over the
// whole-foot ftInterval; the rulebook's unit for hanger spacing) and `ruleId`, the
// counttooling.com/rules/rules.json id the row was taken from (the § chip in the app).
type ChildRule = { name: string; qty: number; per: 'count' | 'run' | 'ft'; ftInterval?: number; intervalIn?: number; ruleId?: string }
const RULE_ID_RE = /^[a-z][a-z0-9]*(\.[a-z0-9-]+)+$/
// S3 conductors: a line type's raceway + conductor list (wire tallies by gauge from every
// run; MC / AC / NM tally as cable), a line's own list, a counter's cable per placement.
type Conductor = { n: number; gauge: string; insul: string; role: 'hot' | 'neutral' | 'ground' }
type Raceway = { kind: string; size?: string }
type TakeoffPage = {
  index: number
  label?: string
  scale?: { pixelsPerUnit: number; unit: string } | null
  rotation?: number
  counterMarkers?: Record<string, Array<Pt & { group?: string }>>
  quickLines?: Array<{ x1: number; y1: number; x2: number; y2: number; lineTypeId: string; group?: string; startDrop?: number; endDrop?: number; conductors?: Conductor[]; homerun?: boolean }>
  polylines?: Array<{ points: Pt[]; lineTypeId: string; group?: string; startDrop?: number; endDrop?: number; conductors?: Conductor[]; homerun?: boolean }>
  notes?: Array<{ x: number; y: number; text: string; detail?: string }>
  multiplyZones?: Array<{ x1: number; y1: number; x2: number; y2: number; multiplier: number }>
  scaleZones?: Array<{ x1: number; y1: number; x2: number; y2: number; scale: { pixelsPerUnit: number; unit: string } }>
}
type TakeoffJson = {
  version: 1 | 2
  trade?: 'plumbing' | 'electrical' | 'hvac'
  ceilingHeightFt?: number   // v2 (S2): the project's ceiling — with a counter mountHeightIn, the app's Chain tool writes the vertical
  makeUpFt?: number          // v2 (S2): make-up added to every default vertical (the app defaults to 1)
  bidCheck?: { manual?: Record<string, boolean>; loadAmps?: number; volts?: number }   // v2 (S5): manual ticks + the voltage-drop defaults
  groups?: Array<{ id: string; name: string; color?: string; panel?: string; circuit?: string; loadAmps?: number }>   // S4: panel + circuit make the group a circuit
  counters: Array<{ id: string; name: string; icon?: string; color?: string; canvas?: string; childCounts?: ChildRule[]; mountHeightIn?: number; cablePerCount?: { ft: number; name?: string }; panelName?: string; poles?: number; tag?: string }>
  lineTypes: Array<{ id: string; name: string; color?: string; canvas?: string; childCounts?: ChildRule[]; raceway?: Raceway; conductors?: Conductor[]; tickMarks?: boolean; homerun?: boolean }>
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
      if (r?.intervalIn != null) {
        const ii = Number(r.intervalIn)
        if (!num(ii) || ii <= 0 || ii > 1200) return { error: bad(where, 'childCounts.intervalIn must be a positive number of inches (≤ 1200)') }
        rule.intervalIn = ii
      } else {
        const iv = Number(r?.ftInterval ?? 10)
        if (!num(iv) || iv <= 0) return { error: bad(where, 'childCounts.ftInterval must be a positive number of feet') }
        rule.ftInterval = iv
      }
    }
    if (r?.ruleId != null) {
      const rid = String(r.ruleId).trim()
      if (!RULE_ID_RE.test(rid) || rid.length > 80) return { error: bad(where, 'childCounts.ruleId must be a rulebook id like plumb.hanger.pex (see counttooling.com/rules/rules.json)') }
      rule.ruleId = rid
    }
    out.push(rule)
  }
  return { ok: out }
}

const RACEWAY_KINDS = ['EMT', 'IMC', 'RMC', 'PVC', 'ENT', 'FMC', 'LFMC', 'MC', 'AC', 'NM', 'Tray', 'Open']
function validConductors(list: unknown, where: string): { ok: Conductor[] } | { error: Response } {
  if (list == null) return { ok: [] }
  if (!Array.isArray(list) || list.length > 40) return { error: bad(where, 'conductors must be an array of up to 40 entries') }
  const out: Conductor[] = []
  for (const c of list as Record<string, unknown>[]) {
    const n = Number(c?.n)
    const gauge = String(c?.gauge ?? '').trim().slice(0, 16)
    const insul = String(c?.insul ?? 'THHN').trim().toUpperCase().slice(0, 12) || 'THHN'
    const role = String(c?.role ?? 'hot')
    if (!num(n) || n <= 0 || n > 200 || !Number.isInteger(n)) return { error: bad(where, 'each conductor needs a positive integer n') }
    if (!/^(#\d+|\d+\/0|\d+ kcmil)$/.test(gauge)) return { error: bad(where, "conductor gauge must read like '#12', '1/0' or '250 kcmil'") }
    if (!['hot', 'neutral', 'ground'].includes(role)) return { error: bad(where, "conductor role must be 'hot', 'neutral' or 'ground'") }
    out.push({ n, gauge, insul, role: role as Conductor['role'] })
  }
  return { ok: out }
}
function validRaceway(raw: unknown, where: string): { ok: Raceway | null } | { error: Response } {
  if (raw == null) return { ok: null }
  const r = raw as Record<string, unknown>
  const kind = String(r?.kind ?? '').trim()
  if (!RACEWAY_KINDS.includes(kind)) return { error: bad(where, `raceway.kind must be one of ${RACEWAY_KINDS.join(', ')}`) }
  const size = r?.size == null ? '' : String(r.size).trim().slice(0, 12)
  return { ok: size ? { kind, size } : { kind } }
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
    const groupsOut: Array<{ id: string; name: string; color: string; panel?: string; circuit?: string; loadAmps?: number }> = []
    if (v2 && t.groups != null) {
      if (!Array.isArray(t.groups) || t.groups.length > 200) return bad('groups', 'must be an array (max 200)')
      for (const g of t.groups) {
        const id = String(g?.id ?? '').trim()
        const gname = String(g?.name ?? '').trim().slice(0, 80)
        if (!id || !gname) return bad('groups', 'each needs id + name')
        if (groupIds.has(id)) return bad('groups', `duplicate id ${id}`)
        groupIds.add(id)
        const out: { id: string; name: string; color: string; panel?: string; circuit?: string; loadAmps?: number } = { id, name: gname, color: typeof g.color === 'string' && g.color ? g.color : PALETTE_COLORS[groupsOut.length % PALETTE_COLORS.length] }
        // S4: panel + circuit make the group a circuit; loadAmps feeds the voltage-drop check
        const panel = String(g.panel ?? '').trim().slice(0, 24)
        const circuit = String(g.circuit ?? '').trim().slice(0, 24)
        if (panel) out.panel = panel
        if (circuit) out.circuit = circuit
        if (g.loadAmps != null) {
          const amps = Number(g.loadAmps)
          if (!num(amps) || amps <= 0 || amps > 6000) return bad(`groups[${id}].loadAmps`, 'must be amps between 0 and 6000')
          if (panel || circuit) out.loadAmps = Math.round(amps * 10) / 10
        }
        groupsOut.push(out)
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
    // S1/S2 (v2, additive): per-counter mount height + the project ceiling /
    // make-up. Stored only — the door never derives drops from them (a twin
    // sends startDrop/endDrop explicitly); they let the app's Chain tool and
    // the Quick creator carry the same facts a human would have set.
    const mountByCounter = new Map<string, number>()
    for (const c of t.counters) {
      if (c.mountHeightIn == null) continue
      if (!v2) return bad('counters.mountHeightIn', 'is a version-2 field — send version: 2')
      const n = Number(c.mountHeightIn)
      if (!num(n) || n < 0 || n > 480) return bad(`counters[${c.id}].mountHeightIn`, 'must be inches AFF between 0 and 480')
      mountByCounter.set(c.id, Math.round(n * 4) / 4)
    }
    let ceilingHeightFt: number | null = null
    let makeUpFt: number | null = null
    if (t.ceilingHeightFt != null) {
      if (!v2) return bad('ceilingHeightFt', 'is a version-2 field — send version: 2')
      const n = Number(t.ceilingHeightFt)
      if (!num(n) || n <= 0 || n > 200) return bad('ceilingHeightFt', 'must be feet between 0 and 200')
      ceilingHeightFt = Math.round(n * 100) / 100
    }
    if (t.makeUpFt != null) {
      if (!v2) return bad('makeUpFt', 'is a version-2 field — send version: 2')
      const n = Number(t.makeUpFt)
      if (!num(n) || n < 0 || n > 50) return bad('makeUpFt', 'must be feet between 0 and 50')
      makeUpFt = Math.round(n * 100) / 100
    }
    // S3 (v2, additive): conductors on line types / lines, raceway, tick marks, cable per count.
    const racewayByLineType = new Map<string, Raceway>()
    const conductorsByLineType = new Map<string, Conductor[]>()
    const ticksOffByLineType = new Set<string>()
    for (const lt of t.lineTypes) {
      if (lt.raceway != null) {
        if (!v2) return bad('lineTypes.raceway', 'is a version-2 field — send version: 2')
        const r = validRaceway(lt.raceway, `lineTypes[${lt.id}].raceway`)
        if ('error' in r) return r.error
        if (r.ok) racewayByLineType.set(lt.id, r.ok)
      }
      if (lt.conductors != null) {
        if (!v2) return bad('lineTypes.conductors', 'is a version-2 field — send version: 2')
        const r = validConductors(lt.conductors, `lineTypes[${lt.id}].conductors`)
        if ('error' in r) return r.error
        if (r.ok.length) conductorsByLineType.set(lt.id, r.ok)
      }
      if (lt.tickMarks === false) ticksOffByLineType.add(lt.id)
    }
    const panelByCounter = new Map<string, { panelName: string; poles?: number }>()
    for (const c of t.counters) {
      if (c.panelName == null && c.poles == null) continue
      if (!v2) return bad('counters.panelName', 'is a version-2 field — send version: 2')
      const name = String(c.panelName ?? '').trim().slice(0, 24)
      if (!name) return bad(`counters[${c.id}].poles`, 'needs panelName')
      const entry: { panelName: string; poles?: number } = { panelName: name }
      if (c.poles != null) {
        const poles = Number(c.poles)
        if (!num(poles) || !Number.isInteger(poles) || poles <= 0 || poles > 400) return bad(`counters[${c.id}].poles`, 'must be a whole number of poles (1..400)')
        entry.poles = poles
      }
      panelByCounter.set(c.id, entry)
    }
    const tagByCounter = new Map<string, string>()   // S6: the fixture tag the plan writes beside the device
    for (const c of t.counters) {
      if (c.tag == null) continue
      if (!v2) return bad('counters.tag', 'is a version-2 field — send version: 2')
      const tag = String(c.tag).trim().toUpperCase().slice(0, 5)
      if (!/^[A-Z]{1,3}\d{0,2}$/.test(tag)) return bad(`counters[${c.id}].tag`, "must read like a fixture tag — 'A', 'B1', 'EM'")
      tagByCounter.set(c.id, tag)
    }
    const homerunLineTypes = new Set<string>()
    for (const lt of t.lineTypes) if (lt.homerun === true) { if (!v2) return bad('lineTypes.homerun', 'is a version-2 field — send version: 2'); homerunLineTypes.add(lt.id) }
    const cableByCounter = new Map<string, { ft: number; name: string }>()
    for (const c of t.counters) {
      if (c.cablePerCount == null) continue
      if (!v2) return bad('counters.cablePerCount', 'is a version-2 field — send version: 2')
      const ft = Number(c.cablePerCount.ft)
      if (!num(ft) || ft <= 0 || ft > 10000) return bad(`counters[${c.id}].cablePerCount`, 'needs ft between 0 and 10000')
      cableByCounter.set(c.id, { ft: Math.round(ft * 100) / 100, name: String(c.cablePerCount.name ?? 'Cable').trim().slice(0, 60) || 'Cable' })
    }
    const lineConductors = new WeakMap<object, Conductor[]>()   // validated per-line overrides, by source object
    const lineConductorsOf = (raw: unknown, where: string): { ok: Conductor[] | null } | { error: Response } => {
      if (raw == null) return { ok: null }
      if (!v2) return { error: bad(where, 'conductors is a version-2 field — send version: 2') }
      const r = validConductors(raw, where)
      if ('error' in r) return r
      return { ok: r.ok.length ? r.ok : null }
    }
    // S5 (v2, additive): Bid Check manual ticks + the voltage-drop defaults.
    let bidCheck: { manual: Record<string, boolean>; loadAmps?: number; volts?: number } | null = null
    if (t.bidCheck != null) {
      if (!v2) return bad('bidCheck', 'is a version-2 field — send version: 2')
      if (typeof t.bidCheck !== 'object') return bad('bidCheck', 'must be an object')
      const manual: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(t.bidCheck.manual ?? {})) {
        if (!/^[a-z0-9-]{1,40}$/.test(k)) return bad('bidCheck.manual', `bad row id ${k}`)
        if (v === true) manual[k] = true
      }
      bidCheck = { manual }
      if (t.bidCheck.loadAmps != null) { const n = Number(t.bidCheck.loadAmps); if (!num(n) || n <= 0 || n > 6000) return bad('bidCheck.loadAmps', 'must be amps between 0 and 6000'); bidCheck.loadAmps = n }
      if (t.bidCheck.volts != null) { const n = Number(t.bidCheck.volts); if (!num(n) || n <= 0 || n > 1000) return bad('bidCheck.volts', 'must be volts between 0 and 1000'); bidCheck.volts = n }
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
        const lc = lineConductorsOf(q.conductors, `pages[${p.index}].quickLines.conductors`)
        if ('error' in lc) return lc.error
        if (lc.ok) lineConductors.set(q as object, lc.ok)
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
        const lc = lineConductorsOf(pl.conductors, `pages[${p.index}].polylines.conductors`)
        if ('error' in lc) return lc.error
        if (lc.ok) lineConductors.set(pl as object, lc.ok)
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
      const conductorsOf = (l: object) => (lineConductors.has(l) ? { conductors: lineConductors.get(l) } : {})
      const homerunOf = (l: { homerun?: boolean }) => (v2 && l.homerun === true ? { homerun: true } : {})
      for (const q of p?.quickLines ?? []) {
        annFor(canvasOf.get(`l:${q.lineTypeId}`)!).quickLines.push({ x1: q.x1, y1: q.y1, x2: q.x2, y2: q.y2, lineTypeId: q.lineTypeId, id: `q_${uid()}`, color: null, group: q.group ?? null, ...drops(q), ...conductorsOf(q), ...homerunOf(q) })
      }
      for (const pl of p?.polylines ?? []) {
        annFor(canvasOf.get(`l:${pl.lineTypeId}`)!).polylines.push({ points: pl.points, lineTypeId: pl.lineTypeId, id: `pl_${uid()}`, color: null, group: pl.group ?? null, ...drops(pl), ...conductorsOf(pl), ...homerunOf(pl) })
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
      counters: t.counters.map((c) => ({ id: c.id, name: c.name, icon: c.icon ?? 'M96 96h448v448H96z', color: c.color ?? '#e8c547', ...(childRulesByCounter.has(c.id) ? { childCounts: childRulesByCounter.get(c.id) } : {}), ...(mountByCounter.has(c.id) ? { mountHeightIn: mountByCounter.get(c.id) } : {}), ...(cableByCounter.has(c.id) ? { cablePerCount: cableByCounter.get(c.id) } : {}), ...(panelByCounter.has(c.id) ? panelByCounter.get(c.id) : {}), ...(tagByCounter.has(c.id) ? { tag: tagByCounter.get(c.id) } : {}) })),
      lineTypes: t.lineTypes.map((lt) => ({ id: lt.id, name: lt.name, color: lt.color ?? '#4a9eff', curveStyle: 'straight', ...(childRulesByLineType.has(lt.id) ? { childCounts: childRulesByLineType.get(lt.id) } : {}), ...(racewayByLineType.has(lt.id) ? { raceway: racewayByLineType.get(lt.id) } : {}), ...(conductorsByLineType.has(lt.id) ? { conductors: conductorsByLineType.get(lt.id) } : {}), ...(ticksOffByLineType.has(lt.id) ? { tickMarks: false } : {}), ...(homerunLineTypes.has(lt.id) ? { homerun: true } : {}) })),
      iconNames: {}, iconOrder: null, customIconPaths: [],
      groups: groupsOut, groupsEnabled: groupsOut.length > 0, rooms: [],
      ...(trade ? { trade } : {}),
      ...(ceilingHeightFt != null ? { ceilingHeightFt } : {}),
      ...(makeUpFt != null ? { makeUpFt } : {}),
      ...(bidCheck ? { bidCheck } : {}),
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
