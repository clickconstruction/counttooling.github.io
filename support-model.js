/*
 * support-model.js - the pure pipe-support model (rulebook slice 3, 2026-09-09):
 * hanger spacing by material as the app applies it (IPC Table 308.5 — the
 * rulebook's plumb.hanger.* pages point at HANGER_SPACING, so a number here
 * cannot change without its rule), material and trade-size detection from a
 * line type's name, the Child counts suggestion a line type earns from it, the
 * interval helpers the per-ft child-count engine and its labels share, and the
 * Bid Check hanger-coverage row for plumbing projects.
 *
 * No state, no DOM: a classic <script src> loaded after line-metrics.js,
 * top-level declarations in the shared global lexical scope, exposed as
 * window.SupportModel (features read it at call time) with the guarded
 * CommonJS footer so support-model.test.js and the rulebook's drift check can
 * require() it.
 */

// DATA TABLE — horizontal spacing rows are tried in order: the first whose
// maxIn covers the pipe size wins. Values are what the app applies; the rule
// pages cite the section. `in` rows are inches on center, `ft` rows feet.
const HANGER_SPACING = {
  pex: { label: 'PEX', rule: 'plumb.hanger.pex', horizontal: [{ maxIn: 1, in: 32 }, { maxIn: Infinity, in: 48 }], verticalFt: 10 },
  copper: { label: 'copper', rule: 'plumb.hanger.copper', horizontal: [{ maxIn: 1.25, ft: 6 }, { maxIn: Infinity, ft: 10 }], verticalFt: 10 },
  pvc: { label: 'PVC', rule: 'plumb.hanger.pvc', horizontal: [{ maxIn: Infinity, ft: 4 }], verticalFt: 10 },
  'cast-iron': { label: 'cast iron', rule: 'plumb.hanger.cast-iron', horizontal: [{ maxIn: Infinity, ft: 5, note: '10 ft where 10-foot lengths are installed' }], verticalFt: 15 },
};
const SUPPORT_MATERIAL_ORDER = ['pex', 'copper', 'pvc', 'cast-iron'];

// The material a line type's name declares, or null. Word-bounded so "CPVC"
// is not PVC and "Cu" inside a longer word is not copper. ABS/DWV read as PVC
// (the same row of the table).
function supportMaterialFromName(name) {
  const n = ' ' + String(name || '').toLowerCase().replace(/[_/,()]+/g, ' ') + ' ';
  if (/\bpex(-al-pex)?\b/.test(n)) return 'pex';
  if (/\b(copper|cu|type\s?[klm])\b/.test(n)) return 'copper';
  if (/\b(cast[\s-]?iron|c\.?i\.?|hubless|no[\s-]?hub|service\s?weight)\b/.test(n)) return 'cast-iron';
  if (/(?<!c)\b(pvc|abs|dwv)\b/.test(n)) return 'pvc';
  return null;
}
// The trade size in inches a line type's name declares ("1in PEX", '3/4" Cu',
// "1-1/4 in copper", "2" PVC"), or null when the name carries none.
function supportSizeInFromName(name) {
  const s = String(name || '');
  const m = /(\d+\s*-\s*\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*(?:in\b|inch(?:es)?\b|"|″|”)/i.exec(s);
  if (!m) return null;
  const t = m[1].replace(/\s+/g, '');
  let v;
  if (/^\d+-\d+\/\d+$/.test(t)) { const [w, f] = t.split('-'); const [a, b] = f.split('/'); v = Number(w) + Number(a) / Number(b); }
  else if (/^\d+\/\d+$/.test(t)) { const [a, b] = t.split('/'); v = Number(a) / Number(b); }
  else v = Number(t);
  return Number.isFinite(v) && v > 0 ? v : null;
}
function formatSizeIn(v) {
  if (v == null) return '';
  const whole = Math.floor(v), frac = v - whole;
  const FR = { 0.25: '1/4', 0.5: '1/2', 0.75: '3/4', 0.125: '1/8', 0.375: '3/8', 0.625: '5/8', 0.875: '7/8' };
  const f = FR[Math.round(frac * 1000) / 1000];
  if (!frac) return whole + ' in';
  if (f) return (whole ? whole + '-' : '') + f + ' in';
  return (Math.round(v * 100) / 100) + ' in';
}
// The interval a per-ft child count counts by, in feet. `intervalIn` (inches,
// the rulebook's unit for small spacings) wins over the whole-foot `ftInterval`.
function childIntervalFeet(ch) {
  if (ch && Number(ch.intervalIn) > 0) return Number(ch.intervalIn) / 12;
  return (ch && Number(ch.ftInterval) > 0) ? Number(ch.ftInterval) : 10;
}
function childIntervalLabel(ch) {
  if (ch && Number(ch.intervalIn) > 0) { const i = Number(ch.intervalIn); return i % 12 === 0 ? (i / 12) + ' ft' : i + ' in'; }
  return ((ch && Number(ch.ftInterval) > 0) ? Number(ch.ftInterval) : 10) + ' ft';
}
// The Child counts suggestion a line type earns: one hanger per the table's
// horizontal spacing for its material and size. Size not in the name → the
// smallest-size row (the tighter spacing — never fewer hangers than the code).
function hangerSuggestionsFor(name) {
  const material = supportMaterialFromName(name);
  if (!material) return [];
  const t = HANGER_SPACING[material];
  const sizeIn = supportSizeInFromName(name);
  const row = t.horizontal.find((r) => sizeIn == null || sizeIn <= r.maxIn) || t.horizontal[t.horizontal.length - 1];
  const intervalIn = row.in != null ? row.in : row.ft * 12;
  const sizeText = sizeIn == null ? 'size not in the name — the smallest-size spacing' : formatSizeIn(sizeIn);
  return [{
    name: 'Hanger', qty: 1, per: 'ft', intervalIn, ruleId: t.rule,
    match: t.label + ' · horizontal · ' + sizeText,
    note: row.note || '',
  }];
}
// Does a line type already count its hangers? A child count stamped with a
// hanger rule, or a per-ft one whose name says so.
function lineTypeCountsHangers(lt) {
  return ((lt && lt.childCounts) || []).some((ch) => (ch.ruleId && /^plumb\.hanger\./.test(ch.ruleId)) || (ch.per === 'ft' && /hanger|strap|clamp|support/i.test(ch.name || '')));
}
// The Bid Check row: every line type whose name declares a supported material
// should carry a hanger count. Returns null when no line type declares one.
function hangerCoverage(lineTypes) {
  const supported = [], missing = [];
  (lineTypes || []).forEach((lt) => {
    const material = supportMaterialFromName(lt.name);
    if (!material) return;
    supported.push({ lt, material });
    if (!lineTypeCountsHangers(lt)) missing.push({ lt, material });
  });
  if (!supported.length) return null;
  const rule = HANGER_SPACING[(missing[0] || supported[0]).material].rule;
  const names = (xs) => xs.map((x) => x.lt.name || 'Line').join(', ');
  return {
    id: 'hangers', kind: 'auto', rule, label: 'Hangers on every supported run',
    verdict: missing.length ? 'warn' : 'ok',
    detail: missing.length
      ? names(missing) + (missing.length === 1 ? ' has' : ' have') + ' no hanger count — the type\'s details offer it from the rulebook.'
      : names(supported) + (supported.length === 1 ? ' counts its hangers' : ' count their hangers') + ' from the rulebook spacing.',
    supported: supported.length, missing: missing.length,
  };
}

const SUPPORT_MODEL_API = { HANGER_SPACING, SUPPORT_MATERIAL_ORDER, supportMaterialFromName, supportSizeInFromName, formatSizeIn, childIntervalFeet, childIntervalLabel, hangerSuggestionsFor, lineTypeCountsHangers, hangerCoverage };
if (typeof window !== 'undefined') window.SupportModel = SUPPORT_MODEL_API;
// Node test harness only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = SUPPORT_MODEL_API;
