/*
 * tag-model.js - the pure text-layer reading model behind "Read the tags"
 * (Electrical, First-Class S6). No state, no DOM, no pdf.js: a classic
 * <script src> loaded after bid-check-model.js, top-level declarations in the
 * shared global lexical scope (features/tag-reader.js reads the same surface
 * as window.TagModel); the guarded CommonJS footer lets tag-model.test.js
 * require() it.
 *
 * Lighting is counted by a letter beside the symbol ("A", "B", "EM", "X"),
 * and that letter is in the PDF's text layer with coordinates. The reader
 * converts pdf.js text items into app PDF-space boxes (features/tag-reader.js
 * does the viewport math); this module answers the two questions on that
 * list: which tag is nearest a point, and which rows of a fixture schedule
 * are "tag + description". Regex over text, no model — honest about scanned
 * sheets: no text layer, no suggestion.
 */

// A fixture tag: 1–3 letters with an optional 1–2 digit suffix ("A", "B1",
// "EM", "X", "WP2"); a bare letter+digits token like "A1" counts too. Words,
// numbers alone and room numbers ("104") do not.
const TAG_RE = /^[A-Z]{1,3}\d{0,2}$/;
function isTagToken(str) {
  const s = String(str || '').trim();
  if (!TAG_RE.test(s)) return false;
  // three-letter tokens that are common drawing words, not tags
  return !['THE', 'AND', 'FOR', 'NEW', 'TYP', 'REF', 'SEE', 'MIN', 'MAX', 'AFF', 'NTS', 'UNO', 'GFI', 'WP'].includes(s) || s === 'GFI' || s === 'WP';
}

// The counter a tag belongs to: an explicit `tag`, else a name that IS a tag
// ("B"), else "Type B" / "Fixture B" / "Fixture Type B" / "B — 2x4 troffer".
function tagOfCounter(counter) {
  if (!counter) return null;
  if (counter.tag) return String(counter.tag).trim().toUpperCase();
  const name = String(counter.name || '').trim();
  if (isTagToken(name.toUpperCase())) return name.toUpperCase();
  const m = name.match(/^(?:fixture\s+)?(?:type\s+)?([A-Za-z]{1,3}\d{0,2})(?:\s*[—–:-]|\s*$)/i);
  if (m && isTagToken(m[1].toUpperCase())) return m[1].toUpperCase();
  return null;
}

// items: [{ str, x, y, w, h }] in app PDF-space (y down; x,y = top-left of the
// text box). Returns the nearest tag token within `radius` of `pt`, measured
// to the box's center — { str, x, y, w, h, dist } — or null.
function nearestTag(items, pt, radius) {
  const r = typeof radius === 'number' && radius > 0 ? radius : 40;
  let best = null;
  (items || []).forEach((it) => {
    const s = String(it.str || '').trim().toUpperCase();
    if (!isTagToken(s)) return;
    const cx = it.x + (it.w || 0) / 2, cy = it.y + (it.h || 0) / 2;
    const d = Math.hypot(cx - pt.x, cy - pt.y);
    if (d <= r && (!best || d < best.dist)) best = { ...it, str: s, dist: d };
  });
  return best;
}

// Items inside a box → rows (clustered by baseline within half a text height,
// left to right) → [{ y, text, tokens: [str] }].
function rowsInBox(items, box) {
  const x1 = Math.min(box.x1, box.x2), x2 = Math.max(box.x1, box.x2);
  const y1 = Math.min(box.y1, box.y2), y2 = Math.max(box.y1, box.y2);
  const inside = (items || []).filter((it) => {
    const cx = it.x + (it.w || 0) / 2, cy = it.y + (it.h || 0) / 2;
    return cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2 && String(it.str || '').trim();
  }).sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  inside.forEach((it) => {
    const cy = it.y + (it.h || 0) / 2;
    const tol = Math.max(2, (it.h || 8) * 0.6);
    let row = rows.find((r) => Math.abs(r.cy - cy) <= tol);
    if (!row) { row = { cy, items: [] }; rows.push(row); }
    row.items.push(it);
  });
  return rows.sort((a, b) => a.cy - b.cy).map((r) => {
    const items2 = r.items.sort((a, b) => a.x - b.x);
    const tokens = items2.map((it) => String(it.str).trim()).filter(Boolean);
    return { y: r.cy, tokens, text: tokens.join(' ') };
  });
}

// Schedule rows → proposed counters: the first token is a tag and the rest is
// a description with letters in it. A header row ("TYPE DESCRIPTION …") and
// notes are skipped; a tag repeated keeps its first description.
function parseScheduleRows(rows) {
  const out = [];
  const seen = new Set();
  (rows || []).forEach((row) => {
    const tokens = row.tokens || String(row.text || '').split(/\s+/);
    if (tokens.length < 2) return;
    const tag = String(tokens[0]).trim().toUpperCase();
    if (!isTagToken(tag)) return;
    const desc = tokens.slice(1).join(' ').replace(/\s+/g, ' ').trim();
    if (!/[A-Za-z]{3,}/.test(desc)) return;
    if (/^(TYPE|TAG|MARK|SYMBOL)$/i.test(tag) || /^DESCRIPTION/i.test(desc)) return;
    if (seen.has(tag)) return;
    seen.add(tag);
    out.push({ tag, description: desc.slice(0, 120) });
  });
  return out;
}

const TAG_MODEL_API = { isTagToken, tagOfCounter, nearestTag, rowsInBox, parseScheduleRows };
if (typeof window !== 'undefined') window.TagModel = TAG_MODEL_API;
// Node test harness only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = TAG_MODEL_API;
