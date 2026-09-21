/*
 * sheet-title-model.js - the pure model that reads a sheet's NUMBER and TITLE
 * off its title block's text layer (punch row SHEET-TITLE), so a page's default
 * label is "P-101 · Plumbing Plan" instead of "bid-set.pdf, p24". No state, no
 * DOM, no pdf.js: a classic <script src> loaded after tag-model.js, top-level
 * declarations in the shared global lexical scope (features/pdf-intake.js reads
 * the same surface as window.SheetTitleModel); the guarded CommonJS footer lets
 * sheet-title-model.test.js require() it.
 *
 * Input is the text-layer primitive's item list, [{ str, x, y, w, h }] in app
 * PDF-space (features/tag-reader.js textItemsFromContent), plus the page size.
 * Regex and geometry over text, no model, and conservative on purpose: a label
 * nobody typed must be right or absent. No text layer (a scan), no title block,
 * no sheet number in it: null, and the intake keeps its file-name default.
 *
 *   The NUMBER is a whole text item shaped like a sheet number ("A-101",
 *   "M2.01", "FP-101", "E001") inside the title-block zone (the bottom band or
 *   the right-hand strip of the sheet). Title blocks print it larger than
 *   anything around it, so the tallest wins; a "SHEET" / "DWG NO" label close
 *   by and the bottom-right corner break ties.
 *   The TITLE is the line in the same zone that a "TITLE" label points at, or
 *   one that names a kind of drawing (PLAN, ELEVATIONS, SCHEDULES, ...), nearest
 *   the number. Two or three stacked lines of one title are joined. With no
 *   title the label is the number alone.
 */

// "A-101", "P-101", "FP-101", "M2.01", "A1.1", "E001", "A-101A". One to three
// letters, an optional dash or dot, one to four digits, an optional .NN, an
// optional revision letter. Two digits at least unless a dash or dot separates
// (so "A-1" reads and the panel tag "A1" does not).
const SHEET_NUMBER_RE = /^([A-Z]{1,3})([-.]?)(\d{1,4})(?:\.(\d{1,2}))?([A-Z]?)$/;
function isSheetNumber(str) {
  const s = String(str || '').trim().toUpperCase();
  const m = SHEET_NUMBER_RE.exec(s);
  if (!m) return false;
  if (!m[2] && !m[4] && m[3].length < 2) return false;
  return true;
}

// The words a title block prints as field LABELS, never as the title itself.
const SHEET_TITLE_BLOCK_LABELS = new Set(['SHEET', 'SHEET NO', 'SHEET NO.', 'SHEET NUMBER', 'SHEET TITLE', 'TITLE', 'DRAWING TITLE', 'DWG NO', 'DWG NO.', 'DWG', 'DRAWING NO', 'DRAWING NO.', 'DRAWING NUMBER', 'PROJECT', 'PROJECT NO', 'PROJECT NO.', 'PROJECT NAME', 'PROJECT NUMBER', 'JOB NO', 'JOB NO.', 'SCALE', 'DATE', 'DRAWN', 'DRAWN BY', 'CHECKED', 'CHECKED BY', 'APPROVED', 'APPROVED BY', 'REVISIONS', 'REVISION', 'REV', 'NO.', 'DESCRIPTION', 'ISSUE', 'ISSUED', 'ISSUED FOR', 'CLIENT', 'OWNER', 'ARCHITECT', 'ENGINEER', 'CONSULTANT', 'SEAL', 'STAMP', 'KEY PLAN', 'NORTH', 'OF']);
const SHEET_NUMBER_LABEL_RE = /^(SHEET|SHEET\s+(NO\.?|NUMBER)|DWG\.?(\s+NO\.?)?|DRAWING\s+(NO\.?|NUMBER))\s*:?$/i;
const SHEET_TITLE_LABEL_RE = /^((SHEET|DRAWING|DWG\.?)\s+)?TITLE\s*:?$/i;
const SHEET_OWNER_LABEL_RE = /^(PROJECT(\s+NAME)?|CLIENT|OWNER|ARCHITECT|ENGINEER|CONSULTANT)\s*:?$/i;
// The kinds of drawing a title names. A line without one is only taken as the
// title when a TITLE label points at it.
const SHEET_TITLE_KEYWORD_RE = /\b(PLANS?|ELEVATIONS?|SECTIONS?|DETAILS?|SCHEDULES?|NOTES|LEGENDS?|DIAGRAMS?|ISOMETRICS?|RISERS?|ONE-LINE|SINGLE-LINE|COVER(\s+SHEET)?|INDEX|SPECIFICATIONS?|LAYOUT|CONTROLS|DEMOLITION)\b/i;
const sheetTitleChars = (s) => /^[A-Za-z0-9 &/,.'()#-]+$/.test(s) && /[A-Za-z]{3,}/.test(s);

// The title-block zone: the bottom 28% of the sheet or its right-hand 22%.
function inTitleBlockZone(it, pageW, pageH) {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2;
  return cy >= pageH * 0.72 || cx >= pageW * 0.78;
}
const sheetItemCentre = (it) => ({ x: it.x + it.w / 2, y: it.y + it.h / 2 });
const sheetItemGap = (a, b) => { const p = sheetItemCentre(a), q = sheetItemCentre(b); return Math.hypot(p.x - q.x, p.y - q.y); };
// `label` sits just above `it` (same column, within a line and a half) or just left of it
// (same row): how a title block pairs a field's caption with its value.
function sheetItemLabels(label, it) {
  const above = label.y + label.h <= it.y + it.h * 0.5 && it.y - (label.y + label.h) <= Math.max(14, it.h * 1.5) && label.x <= it.x + it.w && label.x + label.w >= it.x - 4;
  const left = label.x + label.w <= it.x + 4 && it.x - (label.x + label.w) <= 40 && Math.abs(sheetItemCentre(label).y - sheetItemCentre(it).y) <= Math.max(label.h, it.h);
  return above || left;
}

function findSheetNumber(zone, pageW, pageH) {
  const cands = zone.filter((it) => isSheetNumber(it.str));
  if (!cands.length) return null;
  const numLabels = zone.filter((it) => SHEET_NUMBER_LABEL_RE.test(it.str.trim()));
  const diag = Math.hypot(pageW, pageH) || 1;
  let best = null, bestScore = -Infinity;
  cands.forEach((it) => {
    const labelled = numLabels.some((l) => sheetItemLabels(l, it));
    const corner = Math.hypot(pageW - (it.x + it.w), pageH - (it.y + it.h)) / diag;   // 0 at the bottom-right corner
    const score = it.h + (labelled ? 12 : 0) - corner * 10;
    if (score > bestScore) { bestScore = score; best = it; }
  });
  return best;
}

// Stacked lines of one title: same left edge, same size, a line apart.
function joinTitleLines(first, pool) {
  const lines = [first];
  let last = first;
  for (let n = 0; n < 2; n++) {
    const next = pool.find((it) => !lines.includes(it) && Math.abs(it.x - last.x) <= 2 && Math.abs(it.h - last.h) <= 1.5 && it.y > last.y && it.y - (last.y + last.h) <= last.h * 0.9);
    if (!next) break;
    lines.push(next); last = next;
  }
  return lines;
}

function findSheetTitle(zone, number, pageW, pageH) {
  const titleLabels = zone.filter((it) => SHEET_TITLE_LABEL_RE.test(it.str.trim()));
  const ownerLabels = zone.filter((it) => SHEET_OWNER_LABEL_RE.test(it.str.trim()));
  const pool = zone.filter((it) => {
    const s = it.str.trim();
    if (it === number || s.length < 4 || s.length > 60) return false;
    if (!sheetTitleChars(s) || isSheetNumber(s)) return false;
    if (SHEET_TITLE_BLOCK_LABELS.has(s.toUpperCase().replace(/\s*:$/, ''))) return false;
    if (/^\d/.test(s) || /\d{2}[/.-]\d{2}/.test(s) || /=/.test(s) || /^(DRAWN|CHECKED|APPROVED|SCALE|DATE)\b/i.test(s)) return false;
    return true;
  });
  const diag = Math.hypot(pageW, pageH) || 1;
  let best = null, bestScore = -Infinity;
  pool.forEach((it) => {
    const labelled = titleLabels.some((l) => sheetItemLabels(l, it));
    const keyword = SHEET_TITLE_KEYWORD_RE.test(it.str);
    if (!labelled && !keyword) return;
    if (!labelled && ownerLabels.some((l) => sheetItemLabels(l, it))) return;   // the project's name, not the sheet's
    const score = (labelled ? 8 : 0) + (keyword ? 3 : 0) - (sheetItemGap(it, number) / diag) * 20;
    if (score > bestScore) { bestScore = score; best = it; }
  });
  if (!best) return null;
  // A keyword line may be the LAST line of a stacked title ("FIRST FLOOR" / "PLAN"): start
  // from the top line of its stack.
  let top = best;
  for (let n = 0; n < 2; n++) {
    const prev = pool.find((it) => it !== top && Math.abs(it.x - top.x) <= 2 && Math.abs(it.h - top.h) <= 1.5 && it.y < top.y && top.y - (it.y + it.h) <= top.h * 0.9);
    if (!prev) break;
    top = prev;
  }
  return joinTitleLines(top, pool).map((it) => it.str.trim()).join(' ').replace(/\s+/g, ' ');
}

// "FIRST FLOOR PLAN" → "First Floor Plan". Title blocks shout; the app's lists do not. Words
// that carry a digit or are short all-consonant abbreviations (HVAC, RCP, MEP) stay as printed.
const SHEET_TITLE_SMALL_WORDS = new Set(['and', 'of', 'the', 'for', 'to', 'at', 'in', 'on', 'or', 'with']);
function sheetTitleCase(str) {
  const s = String(str || '').trim();
  if (/[a-z]/.test(s)) return s;   // already mixed case: as printed
  return s.split(' ').map((w, i) => {
    const bare = w.replace(/[^A-Z]/g, '');
    if (/\d/.test(w) || (bare.length <= 4 && !/[AEIOUY]/.test(bare)) || /^(HVAC|MEP|ADA)$/.test(bare)) return w;
    const lower = w.toLowerCase();
    if (i > 0 && SHEET_TITLE_SMALL_WORDS.has(lower)) return lower;
    return lower.replace(/(^|[-/(])([a-z])/g, (m, p, c) => p + c.toUpperCase());
  }).join(' ');
}

// The reader. items: [{ str, x, y, w, h }]; returns { number, title, label } or null.
function readSheetTitle(items, pageW, pageH) {
  if (!Array.isArray(items) || !items.length || !(pageW > 0) || !(pageH > 0)) return null;
  const zone = items.filter((it) => it && typeof it.str === 'string' && it.str.trim() && inTitleBlockZone(it, pageW, pageH));
  const numberItem = findSheetNumber(zone, pageW, pageH);
  if (!numberItem) return null;
  const number = numberItem.str.trim().toUpperCase();
  const rawTitle = findSheetTitle(zone, numberItem, pageW, pageH);
  const title = rawTitle ? sheetTitleCase(rawTitle) : null;
  return { number, title, label: title ? number + ' · ' + title : number };
}

// The intake's own default label ("bid-set.pdf", "bid-set.pdf, p24", "Page 3"): the only
// labels a read title may replace. A name somebody typed is never touched.
function isDefaultPageLabel(label) {
  const l = String(label || '').trim();
  return !l || /^Page \d+$/i.test(l) || /\.pdf(, p\d+)?$/i.test(l) || /^Test PDF(, p\d+)?$/.test(l);
}

const SHEET_TITLE_MODEL_API = { isSheetNumber, readSheetTitle, sheetTitleCase, isDefaultPageLabel, inTitleBlockZone };
if (typeof window !== 'undefined') window.SheetTitleModel = SHEET_TITLE_MODEL_API;
// Node test harness only: in a classic browser <script> `module` is undefined.
if (typeof module !== 'undefined' && module.exports) module.exports = SHEET_TITLE_MODEL_API;
