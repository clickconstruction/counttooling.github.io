/*
 * bid-check-model.js - the pure rule table behind **Bid Check** (Electrical,
 * First-Class S5). No state, no DOM: a classic <script src> loaded after
 * circuit-model.js, top-level declarations in the shared global lexical scope
 * (features/bid-check.js reads the same surface as window.BidCheckModel); the
 * guarded CommonJS footer lets bid-check-model.test.js require() it.
 *
 * The panel is trade-skinnable by design: AUTO rows are rule functions the app
 * can compute from its own tallies and show their work ("10 #12 THHN in 1/2"
 * EMT · 44% ⚠ · 3/4" EMT 25% ✓"); MANUAL rows are the judgment calls it cannot
 * know, ticked per project. The electrical rows here are the NEC arithmetic
 * every estimator does beside the app on bid day; the figures are the
 * published table values (Chapter 9 Tables 1, 4, 5, 8) and should be checked
 * against the edition the shop bids under before they appear in a verdict.
 */

// Chapter 9 Table 4 — total internal area (in²) by raceway kind and trade size.
const RACEWAY_AREA_IN2 = {
  EMT: { '1/2"': 0.304, '3/4"': 0.533, '1"': 0.864, '1-1/4"': 1.496, '1-1/2"': 2.036, '2"': 3.356, '2-1/2"': 5.858, '3"': 8.846, '3-1/2"': 11.545, '4"': 14.753 },
  IMC: { '1/2"': 0.342, '3/4"': 0.586, '1"': 0.959, '1-1/4"': 1.647, '1-1/2"': 2.225, '2"': 3.630, '2-1/2"': 5.135, '3"': 7.922, '3-1/2"': 10.584, '4"': 13.631 },
  RMC: { '1/2"': 0.314, '3/4"': 0.549, '1"': 0.887, '1-1/4"': 1.526, '1-1/2"': 2.071, '2"': 3.408, '2-1/2"': 4.866, '3"': 7.499, '3-1/2"': 10.010, '4"': 12.882 },
  PVC: { '1/2"': 0.285, '3/4"': 0.508, '1"': 0.832, '1-1/4"': 1.453, '1-1/2"': 1.986, '2"': 3.291, '2-1/2"': 4.695, '3"': 7.268, '3-1/2"': 9.737, '4"': 12.554 },   // Schedule 40
  ENT: { '1/2"': 0.285, '3/4"': 0.508, '1"': 0.832, '1-1/4"': 1.453, '1-1/2"': 1.986, '2"': 3.291 },
  FMC: { '1/2"': 0.317, '3/4"': 0.533, '1"': 0.817, '1-1/4"': 1.277, '1-1/2"': 1.858, '2"': 3.269, '2-1/2"': 4.909, '3"': 7.069, '3-1/2"': 9.621, '4"': 12.566 },
  LFMC: { '1/2"': 0.314, '3/4"': 0.541, '1"': 0.873, '1-1/4"': 1.528, '1-1/2"': 1.981, '2"': 3.246, '2-1/2"': 4.881, '3"': 7.475, '3-1/2"': 9.731, '4"': 12.692 },
};
const RACEWAY_SIZE_ORDER = ['1/2"', '3/4"', '1"', '1-1/4"', '1-1/2"', '2"', '2-1/2"', '3"', '3-1/2"', '4"'];
// Chapter 9 Table 5 — conductor area (in²) by insulation family and gauge.
const CONDUCTOR_AREA_IN2 = {
  THHN: { '#14': 0.0097, '#12': 0.0133, '#10': 0.0211, '#8': 0.0366, '#6': 0.0507, '#4': 0.0824, '#3': 0.0973, '#2': 0.1158, '#1': 0.1562, '1/0': 0.1855, '2/0': 0.2223, '3/0': 0.2679, '4/0': 0.3237, '250 kcmil': 0.3970, '300 kcmil': 0.4608, '350 kcmil': 0.5242, '400 kcmil': 0.5863, '500 kcmil': 0.7073 },
  XHHW: { '#14': 0.0139, '#12': 0.0181, '#10': 0.0243, '#8': 0.0437, '#6': 0.0590, '#4': 0.0814, '#3': 0.0962, '#2': 0.1146, '#1': 0.1534, '1/0': 0.1825, '2/0': 0.2190, '3/0': 0.2642, '4/0': 0.3197, '250 kcmil': 0.3904, '300 kcmil': 0.4536, '350 kcmil': 0.5166, '400 kcmil': 0.5782, '500 kcmil': 0.6984 },
  THW: { '#14': 0.0139, '#12': 0.0181, '#10': 0.0243, '#8': 0.0437, '#6': 0.0726, '#4': 0.0973, '#3': 0.1134, '#2': 0.1333, '#1': 0.1901, '1/0': 0.2223, '2/0': 0.2624, '3/0': 0.3117, '4/0': 0.3718, '250 kcmil': 0.4596, '300 kcmil': 0.5281, '350 kcmil': 0.5958, '400 kcmil': 0.6619, '500 kcmil': 0.7901 },
};
const INSUL_FAMILY = { THHN: 'THHN', THWN: 'THHN', 'THWN-2': 'THHN', THHW: 'THW', THW: 'THW', 'THW-2': 'THW', XHHW: 'XHHW', 'XHHW-2': 'XHHW', RHW: 'THW', USE: 'XHHW' };
// Chapter 9 Table 8 — circular mils, copper.
const GAUGE_CMIL = { '#18': 1620, '#16': 2580, '#14': 4110, '#12': 6530, '#10': 10380, '#8': 16510, '#6': 26240, '#4': 41740, '#3': 52620, '#2': 66360, '#1': 83690, '1/0': 105600, '2/0': 133100, '3/0': 167800, '4/0': 211600, '250 kcmil': 250000, '300 kcmil': 300000, '350 kcmil': 350000, '400 kcmil': 400000, '500 kcmil': 500000 };
const GAUGE_ORDER = ['#18', '#16', '#14', '#12', '#10', '#8', '#6', '#4', '#3', '#2', '#1', '1/0', '2/0', '3/0', '4/0', '250 kcmil', '300 kcmil', '350 kcmil', '400 kcmil', '500 kcmil'];
// Chapter 9 Table 1 — fill limits by conductor count.
const fillLimitFor = (count) => (count <= 1 ? 0.53 : count === 2 ? 0.31 : 0.40);
const VD_K = { copper: 12.9, aluminum: 21.2 };
// Branch-circuit voltage-drop limit the checks use by default (NEC 210.19(A)
// Informational Note — a recommendation, not a requirement). Rulebook:
// content/rules/electrical/voltage-drop-limit.md.
const VD_LIMIT_PCT_DEFAULT = 3;

function conductorAreaIn2(c) {
  const fam = INSUL_FAMILY[String(c.insul || 'THHN').toUpperCase()] || 'THHN';
  const table = CONDUCTOR_AREA_IN2[fam] || CONDUCTOR_AREA_IN2.THHN;
  return table[c.gauge] ?? null;
}
const gaugeIndex = (g) => GAUGE_ORDER.indexOf(g);
function smallestGauge(gauges) {
  let best = null;
  (gauges || []).forEach((g) => { const i = gaugeIndex(g); if (i >= 0 && (best == null || i < gaugeIndex(best))) best = g; });
  return best;
}
const nextGaugeUp = (g) => { const i = gaugeIndex(g); return i >= 0 && i + 1 < GAUGE_ORDER.length ? GAUGE_ORDER[i + 1] : null; };

// Conduit fill: { pct, limit, conductorIn2, areaIn2, count, ok, upsize } —
// upsize is the smallest trade size of the same kind that passes, when the
// run fails. null when the raceway is unknown / a cable / has no size.
function conduitFill(raceway, conductors) {
  if (!raceway || !raceway.kind || !raceway.size) return null;
  const kindAreas = RACEWAY_AREA_IN2[String(raceway.kind).toUpperCase()];
  if (!kindAreas) return null;
  const areaIn2 = kindAreas[raceway.size];
  if (!areaIn2) return null;
  let conductorIn2 = 0, count = 0, unknown = 0;
  (conductors || []).forEach((c) => {
    const a = conductorAreaIn2(c);
    if (a == null) { unknown += c.n || 0; return; }
    conductorIn2 += a * (c.n || 0); count += c.n || 0;
  });
  if (!count) return null;
  const limit = fillLimitFor(count);
  const pct = conductorIn2 / areaIn2;
  const ok = pct <= limit;
  let upsize = null;
  if (!ok) {
    for (const size of RACEWAY_SIZE_ORDER) {
      const a = kindAreas[size];
      if (a && conductorIn2 / a <= limit) { upsize = { size, pct: conductorIn2 / a }; break; }
    }
  }
  return { pct, limit, conductorIn2, areaIn2, count, unknownConductors: unknown, ok, upsize };
}

// Voltage drop: VD = 2·K·I·L / CM (single-phase) or 1.732·K·I·L / CM
// (three-phase), L one-way feet, copper unless told. → { volts, pct, ok,
// upsize: { gauge, pct } } against `limitPct` (3% branch by default).
function voltageDrop(opts) {
  const o = opts || {};
  const cm = GAUGE_CMIL[o.gauge];
  if (!cm || !(o.feet > 0) || !(o.amps > 0)) return null;
  const volts = o.volts > 0 ? o.volts : 120;
  const k = VD_K[o.material || 'copper'] || VD_K.copper;
  const factor = o.phase === 'three' ? 1.732 : 2;
  const limit = o.limitPct > 0 ? o.limitPct : VD_LIMIT_PCT_DEFAULT;
  const drop = (factor * k * o.amps * o.feet) / cm;
  const pct = (drop / volts) * 100;
  const ok = pct <= limit;
  let upsize = null;
  if (!ok) {
    let g = o.gauge;
    for (let i = 0; i < 8 && (g = nextGaugeUp(g)); i++) {
      const p = ((factor * k * o.amps * o.feet) / GAUGE_CMIL[g] / volts) * 100;
      if (p <= limit) { upsize = { gauge: g, pct: p }; break; }
    }
  }
  return { volts: drop, pct, limit, ok, upsize };
}

// The manual rows — judgment calls the app cannot know. `trade` null = every
// project; ticks persist per project in state.bidCheck.manual[id].
const BID_CHECK_MANUAL_ROWS = [
  { id: 'scope-vs-drawings', label: 'Scope letter reconciled against the drawings', trade: null },
  { id: 'addenda', label: 'Addenda and RFIs reviewed', trade: null },
  { id: 'scale-verified', label: 'Scale verified on every counted sheet', trade: null },
  { id: 'fa-rated-corridors', label: 'Fire alarm devices at rated corridors and doors', trade: 'electrical' },
  { id: 'lighting-controls', label: 'Lighting controls meet the energy code', trade: 'electrical' },
  { id: 'equipment-connections', label: 'Equipment connections coordinated with HVAC and plumbing', trade: 'electrical' },
  { id: 'temp-power', label: 'Temporary power and lighting included', trade: 'electrical' },
  { id: 'pull-points', label: 'Pull points within 360° of bends on every run', trade: 'electrical' },
];

const pct1 = (p) => Math.round(p * 10) / 10;
const fmtPct = (p) => pct1(p) + '%';

// The AUTO rows from the app's own tallies. inputs:
//   fillCases: [{ label, raceway, conductors, runs }]   distinct (raceway, conductors) on scaled runs
//   circuits:  the Circuit schedule's flat circuit list (with hotGauges, farthestFt, loadAmps, tag, group)
//   crossCheck: [{ panel, onPlan, scheduled, verdict }]
//   untaggedDevices: marks of non-panel counters with no group while circuits exist
//   offRunDevices:   Σ devicesOffRuns across circuits
//   defaults: { loadAmps, volts }
// → [{ id, kind: 'auto', label, verdict: 'ok' | 'warn' | 'na', detail }]
function bidCheckAutoRows(inputs) {
  const i = inputs || {};
  const d = Object.assign({ loadAmps: 12, volts: 120 }, i.defaults || {});
  const rows = [];
  // 1. Conduit fill ≤ 40% (Chapter 9 Table 1)
  const fills = (i.fillCases || []).map((f) => ({ f, r: conduitFill(f.raceway, f.conductors) })).filter((x) => x.r);
  if (fills.length) {
    const bad = fills.filter((x) => !x.r.ok);
    rows.push({
      id: 'conduit-fill', kind: 'auto', label: 'Conduit fill within the table limit', verdict: bad.length ? 'warn' : 'ok',
      detail: bad.length
        ? bad.map((x) => x.f.label + ' · ' + fmtPct(x.r.pct * 100) + ' ⚠' + (x.r.upsize ? ' → ' + x.r.upsize.size + ' ' + x.f.raceway.kind + ' ' + fmtPct(x.r.upsize.pct * 100) + ' ✓' : ' · no size of this kind fits')).join('; ')
        : fills.map((x) => x.f.label + ' · ' + fmtPct(x.r.pct * 100) + ' ✓').join('; '),
    });
  } else rows.push({ id: 'conduit-fill', kind: 'auto', label: 'Conduit fill within the table limit', verdict: 'na', detail: 'Give a line type a conduit size and conductors to check its fill.' });
  // 2. Voltage drop ≤ 3% on branch circuits
  const vds = (i.circuits || []).filter((c) => c.farthestFt > 0 && c.hotGauges && c.hotGauges.length).map((c) => {
    const gauge = smallestGauge(c.hotGauges);
    const amps = c.loadAmps > 0 ? c.loadAmps : d.loadAmps;
    return { c, gauge, amps, r: voltageDrop({ feet: c.farthestFt, amps, gauge, volts: d.volts }) };
  }).filter((x) => x.r);
  if (vds.length) {
    const bad = vds.filter((x) => !x.r.ok);
    const line = (x) => (x.c.tag || x.c.group) + ' · ' + Math.round(x.c.farthestFt) + ' ft · ' + x.amps + ' A · ' + x.gauge + ' ' + fmtPct(x.r.pct) + (x.r.ok ? ' ✓' : ' ⚠' + (x.r.upsize ? ' → ' + x.r.upsize.gauge + ' ' + fmtPct(x.r.upsize.pct) + ' ✓' : ''));
    rows.push({ id: 'voltage-drop', kind: 'auto', label: 'Voltage drop within 3% to the farthest device', verdict: bad.length ? 'warn' : 'ok', detail: (bad.length ? bad : vds).map(line).join('; ') + ' (at ' + d.volts + ' V)' });
  } else rows.push({ id: 'voltage-drop', kind: 'auto', label: 'Voltage drop within 3% to the farthest device', verdict: 'na', detail: 'Needs a circuit with a panel mark or a homerun, runs with conductors, and a device on the runs.' });
  // 3. Circuits on plan vs the panel schedule
  const cc = (i.crossCheck || []).filter((c) => c.scheduled != null);
  if (cc.length) {
    const bad = cc.filter((c) => c.verdict !== 'match');
    rows.push({ id: 'circuits-vs-panel', kind: 'auto', label: 'Circuits on plan match the panel schedule', verdict: bad.length ? 'warn' : 'ok', detail: cc.map((c) => c.panel + ' · ' + c.onPlan + ' on plan · ' + c.scheduled + ' scheduled ' + (c.verdict === 'match' ? '✓' : '⚠')).join('; ') });
  } else rows.push({ id: 'circuits-vs-panel', kind: 'auto', label: 'Circuits on plan match the panel schedule', verdict: 'na', detail: 'Name a panel counter and give it the schedule\'s pole count.' });
  // 4. Every device on a circuit and reached by a run
  if ((i.circuits || []).length) {
    const untagged = i.untaggedDevices || 0, off = i.offRunDevices || 0;
    const parts = [];
    if (untagged) parts.push(untagged + ' device' + (untagged === 1 ? '' : 's') + ' on no circuit');
    if (off) parts.push(off + ' device' + (off === 1 ? '' : 's') + ' not reached by a run');
    rows.push({ id: 'devices-on-circuits', kind: 'auto', label: 'Every device on a circuit and reached by a run', verdict: parts.length ? 'warn' : 'ok', detail: parts.length ? parts.join(' · ') : 'all devices reached' });
  } else rows.push({ id: 'devices-on-circuits', kind: 'auto', label: 'Every device on a circuit and reached by a run', verdict: 'na', detail: 'Tag a group with a panel and circuit to start checking.' });
  return rows;
}

// Open items: auto rows at ⚠ plus manual rows for the trade that are not ticked.
function bidCheckOpenCount(autoRows, manualState, trade) {
  const auto = (autoRows || []).filter((r) => r.verdict === 'warn').length;
  const manual = BID_CHECK_MANUAL_ROWS.filter((r) => !r.trade || r.trade === trade).filter((r) => !(manualState && manualState[r.id])).length;
  return { auto, manual, total: auto + manual };
}

const BID_CHECK_MODEL_API = { RACEWAY_AREA_IN2, CONDUCTOR_AREA_IN2, GAUGE_CMIL, GAUGE_ORDER, fillLimitFor, VD_K, VD_LIMIT_PCT_DEFAULT, conductorAreaIn2, smallestGauge, nextGaugeUp, conduitFill, voltageDrop, BID_CHECK_MANUAL_ROWS, bidCheckAutoRows, bidCheckOpenCount };
if (typeof window !== 'undefined') window.BidCheckModel = BID_CHECK_MODEL_API;
// Node test harness only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = BID_CHECK_MODEL_API;
