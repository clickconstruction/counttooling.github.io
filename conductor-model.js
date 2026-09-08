/*
 * conductor-model.js - the pure electrical raceway / conductor model behind
 * "Conductors on the run" (Electrical, First-Class S3). No state, no DOM: a
 * classic <script src> loaded after line-metrics.js, top-level declarations in
 * the shared global lexical scope (canvas-draw.js reads tickLayout /
 * conductorsForLine by bare name; features/conductors.js reads the same surface
 * as window.ConductorModel); the guarded CommonJS footer lets
 * conductor-model.test.js require() it under node --test.
 *
 * The model in one paragraph: a line type may carry `raceway: { kind, size }`
 * and `conductors: [{ n, gauge, insul, role }]` (role 'hot' | 'neutral' |
 * 'ground'); a single line may override the conductor list with its own
 * `conductors`. At tally time every run yields its conduit row as today PLUS
 * derived rows: WIRE per gauge (feet × n, rolled up across line types) when
 * the raceway is a conduit, or ONE CABLE row ("MC 12/2 w/G") when the raceway
 * is a cable — MC / AC / NM carry their conductors inside, so a wire row for
 * them would be wrong, not incomplete. A counter may carry `cablePerCount:
 * { ft, name }` (a data drop = 150 ft of Cat6) and emits a cable row per
 * placement. Wire is derived, never a mark: it can never drift from the runs.
 */

// Raceway kinds the trade prices. `cable: true` = conductors are integral.
const RACEWAY_KINDS = [
  { kind: 'EMT', label: 'EMT' }, { kind: 'IMC', label: 'IMC' }, { kind: 'RMC', label: 'Rigid (RMC)' },
  { kind: 'PVC', label: 'PVC' }, { kind: 'ENT', label: 'ENT (smurf)' }, { kind: 'FMC', label: 'Flex (FMC)' },
  { kind: 'LFMC', label: 'Liquidtight' }, { kind: 'MC', label: 'MC cable', cable: true },
  { kind: 'AC', label: 'AC cable', cable: true }, { kind: 'NM', label: 'NM (Romex)', cable: true },
  { kind: 'Tray', label: 'Cable tray' }, { kind: 'Open', label: 'Open wiring' }
];
const RACEWAY_SIZES = ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '3-1/2"', '4"'];
const CABLE_KINDS = new Set(['MC', 'AC', 'NM']);
const isCableRaceway = (kind) => CABLE_KINDS.has(String(kind || '').toUpperCase());
const racewayLabel = (rw) => rw && rw.kind ? [rw.size, rw.kind].filter(Boolean).join(' ') : '';

// --- the conductor spec shorthand ------------------------------------------
// "3 #12 THHN + 1 #12 G", "2#12, 1#12 GND", "3 x 10 THWN + 1 10 green",
// "3 #1/0 XHHW + 1 #6 G", "4 250 kcmil". Segments split on + , ; or a newline.
// Each segment: <count> [#|x|×] <gauge> [insulation] [role]. The gauge is an
// AWG number (14 … 1), 1/0 … 4/0, or N kcmil; insulation defaults to THHN;
// role G/GND/GRD/GREEN/GROUND → ground, N/NEU/NEUTRAL → neutral, else hot.
const SEG_RE = /^(\d+)\s*(?:[#x×]\s*)?#?\s*(\d+\/0|\d+(?:\.\d+)?)\s*(kcmil|mcm)?\s*([A-Za-z][A-Za-z0-9-]*)?\s*([A-Za-z]+)?$/i;
const ROLE_WORDS = { g: 'ground', gnd: 'ground', grd: 'ground', green: 'ground', ground: 'ground', egc: 'ground', n: 'neutral', neu: 'neutral', neutral: 'neutral', white: 'neutral', h: 'hot', hot: 'hot' };
function normalizeGauge(raw, kcmil) {
  const s = String(raw || '').trim();
  if (kcmil) return s + ' kcmil';
  if (/^\d+\/0$/.test(s)) return s;
  const n = parseFloat(s);
  if (n >= 250) return n + ' kcmil';   // "250 THHN" — the trade drops "kcmil"
  return '#' + s;
}
function parseConductorSpec(text) {
  const segs = String(text || '').split(/[+,;\n]/).map((s) => s.trim()).filter(Boolean);
  const conductors = [];
  const bad = [];
  segs.forEach((seg) => {
    const m = seg.match(SEG_RE);
    if (!m) { bad.push(seg); return; }
    const n = parseInt(m[1], 10);
    if (!(n > 0)) { bad.push(seg); return; }
    let insul = m[4] || '';
    let roleWord = m[5] || '';
    // "1 #12 G" parses the G as insulation when no role word follows; swap.
    if (!roleWord && insul && ROLE_WORDS[insul.toLowerCase()]) { roleWord = insul; insul = ''; }
    const role = ROLE_WORDS[roleWord.toLowerCase()] || 'hot';
    conductors.push({ n, gauge: normalizeGauge(m[2], m[3]), insul: (insul || 'THHN').toUpperCase(), role });
  });
  return { conductors, bad };
}
function formatConductorSpec(list) {
  return (list || []).map((c) => c.n + ' ' + c.gauge + ' ' + c.insul + (c.role === 'ground' ? ' G' : c.role === 'neutral' ? ' N' : '')).join(' + ');
}
const conductorCount = (list) => (list || []).reduce((s, c) => s + (c.n || 0), 0);

// The conductor list a line tallies with: its own override, else its type's.
function conductorsForLine(line, lineType) {
  if (line && Array.isArray(line.conductors) && line.conductors.length) return line.conductors;
  if (lineType && Array.isArray(lineType.conductors) && lineType.conductors.length) return lineType.conductors;
  return null;
}

// --- derived rows ----------------------------------------------------------
// Wire rows roll hots + neutrals of one gauge/insulation into one row and
// keep the ground its own row ("#12 THHN green"): that is how it is bought.
function wireRowName(c) {
  return c.gauge + ' ' + c.insul + (c.role === 'ground' ? ' green' : '');
}
function wireRowKey(c) {
  return (c.gauge + '|' + c.insul + '|' + (c.role === 'ground' ? 'g' : 'h')).toLowerCase();
}
// feet of run → { key: { name, gauge, insul, ground, feet } }
function wireRowsFor(feet, conductors) {
  const out = {};
  if (!(feet > 0)) return out;
  (conductors || []).forEach((c) => {
    const k = wireRowKey(c);
    if (!out[k]) out[k] = { name: wireRowName(c), gauge: c.gauge, insul: c.insul, ground: c.role === 'ground', feet: 0 };
    out[k].feet += feet * (c.n || 0);
  });
  return out;
}
// "MC 12/2 w/G": kind, then <gauge>/<current-carrying count>, then the ground.
function cableNameFor(raceway, conductors) {
  const kind = String(raceway && raceway.kind || 'Cable').toUpperCase();
  const list = conductors || [];
  if (!list.length) return kind;
  const current = list.filter((c) => c.role !== 'ground');
  const grounds = list.filter((c) => c.role === 'ground');
  const gauge = String((current[0] || list[0]).gauge).replace(/^#/, '');
  const count = conductorCount(current);
  return kind + ' ' + gauge + '/' + count + (grounds.length ? ' w/G' : '');
}

// --- tick marks ------------------------------------------------------------
// Drafting convention: one hash per conductor across the run — hots plain,
// the neutral longer, the ground dashed (or dotted). Order: hots, neutral,
// grounds. Returns [{ role, len (× base), dashed }].
function tickLayout(conductors) {
  const ticks = [];
  const push = (c, role) => { for (let i = 0; i < (c.n || 0); i++) ticks.push({ role, len: role === 'neutral' ? 1.5 : 1, dashed: role === 'ground' }); };
  (conductors || []).filter((c) => c.role === 'hot').forEach((c) => push(c, 'hot'));
  (conductors || []).filter((c) => c.role === 'neutral').forEach((c) => push(c, 'neutral'));
  (conductors || []).filter((c) => c.role === 'ground').forEach((c) => push(c, 'ground'));
  return ticks.slice(0, 12);   // a feeder with 12+ conductors is a bundle, not a picket fence
}

// The names above are top-level declarations in the shared global lexical scope
// (canvas-draw.js reads tickLayout / conductorsForLine by bare name, like the
// geometry.js helpers); window.ConductorModel is the same surface as one object
// for the feature files. Keep the export list and this object in sync.
const CONDUCTOR_MODEL_API = { RACEWAY_KINDS, RACEWAY_SIZES, isCableRaceway, racewayLabel, parseConductorSpec, formatConductorSpec, conductorCount, conductorsForLine, wireRowName, wireRowKey, wireRowsFor, cableNameFor, tickLayout };
if (typeof window !== 'undefined') window.ConductorModel = CONDUCTOR_MODEL_API;
// Node test harness only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = CONDUCTOR_MODEL_API;
