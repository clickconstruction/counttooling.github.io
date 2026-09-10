/*
 * bid-basis-model.js — the pure model behind the "Bid basis" export
 * (features/bid-basis.js). Classic script exposed as window.BidBasisModel;
 * the guarded CommonJS footer lets bid-basis-model.test.js run it under Node.
 *
 * The bid basis is the marked-up plan set an estimator sends WITH a proposal
 * when the issued drawings are too rough to bid to. PipeTooling opens a
 * project's view link with `export=bid-basis&ref=<bid>`; this app answers with
 * the Export PDFs dialog preset to the sheets that carry marks, a deterministic
 * file name the estimator can search for later, and — after the download — a
 * postMessage back to the PipeTooling tab that opened it (the "manifest").
 *
 * Everything here is data in, data out: no DOM, no state.
 */
(function () {
  'use strict';

  /** postMessage envelope — PipeTooling's bidBasis.ts parses exactly this. */
  const BID_BASIS_MESSAGE_TYPE = 'counttooling:bid-basis-export';
  const BID_BASIS_MESSAGE_VERSION = 1;
  /** Posted as soon as the plan opens in bid-basis mode (carries the last-saved time). */
  const BID_BASIS_LOADED_MESSAGE_TYPE = 'counttooling:bid-basis-loaded';
  const BID_BASIS_URL_FLAG = 'bid-basis';

  /** The PipeTooling origins a manifest may be posted to (never '*'). */
  const PIPETOOLING_ORIGINS = Object.freeze([
    'https://clicktooling.com',
    'https://www.clicktooling.com',
    'https://pipetooling.com',
    'https://www.pipetooling.com',
  ]);
  /** Vite dev / preview ports PipeTooling runs on locally. */
  // Vite takes the next port when 5173 is busy (parallel sessions), so cover a small range.
  const PIPETOOLING_DEV_ORIGINS = Object.freeze([5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 4173, 3000]
    .flatMap((port) => ['http://localhost:' + port, 'http://127.0.0.1:' + port]));

  const MAX_REF_LENGTH = 40;

  function isLocalOrigin(origin) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || ''));
  }

  /**
   * Where the manifest goes. Production posts only to the PipeTooling hosts; a
   * CountTooling running on localhost (specs, local dev) also posts to the local
   * PipeTooling dev ports and to its own origin (so a same-origin opener page
   * can act as the PipeTooling stand-in in tests).
   */
  function bidBasisTargetOrigins(currentOrigin) {
    const out = PIPETOOLING_ORIGINS.slice();
    if (isLocalOrigin(currentOrigin)) {
      PIPETOOLING_DEV_ORIGINS.forEach((o) => { if (!out.includes(o)) out.push(o); });
      if (!out.includes(currentOrigin)) out.push(currentOrigin);
    }
    return out;
  }

  /** `?export=bid-basis&ref=b409` → { active, ref }. Anything malformed → inactive. */
  function parseBidBasisParams(search) {
    let params;
    try { params = new URLSearchParams(String(search || '')); } catch (_) { return { active: false, ref: null }; }
    if ((params.get('export') || '').trim() !== BID_BASIS_URL_FLAG) return { active: false, ref: null };
    const ref = sanitizeRef(params.get('ref'));
    return { active: true, ref };
  }

  /** A bid reference as the file name and message carry it: `b409`, `bp12`. */
  function sanitizeRef(raw) {
    const s = String(raw || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!s) return null;
    return s.slice(0, MAX_REF_LENGTH);
  }

  /** Project name → a short, search-friendly slug ("Livingston Steel Office TI" → "livingston-steel-office-ti"). */
  function slugForFilename(name, maxLength) {
    const max = maxLength || 40;
    const s = String(name || '').toLowerCase()
      .replace(/\.pdf$/i, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!s) return 'plans';
    if (s.length <= max) return s;
    const cut = s.slice(0, max);
    const lastDash = cut.lastIndexOf('-');
    return (lastDash > 10 ? cut.slice(0, lastDash) : cut).replace(/-+$/g, '') || 'plans';
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  /**
   * `bid-basis_<ref>_<project>_<YYYY-MM-DD>_<HHMM>.pdf` — the bid number first
   * so a Finder / Explorer search for "b409" finds every export for that bid;
   * the minute keeps two exports on one day apart. Local time, on purpose: it is
   * the clock on the wall when the estimator clicked Download.
   */
  function buildBidBasisFilename(opts) {
    const o = opts || {};
    const at = o.at instanceof Date ? o.at : new Date();
    const ref = sanitizeRef(o.ref) || 'bid';
    const stamp = at.getFullYear() + '-' + pad2(at.getMonth() + 1) + '-' + pad2(at.getDate())
      + '_' + pad2(at.getHours()) + pad2(at.getMinutes());
    return 'bid-basis_' + ref + '_' + slugForFilename(o.projectName) + '_' + stamp + '.pdf';
  }

  /**
   * The marks that make a sheet part of the bid basis: counters, runs, ducts,
   * rooms. Highlights and notes alone do not select a page (they ride along on
   * pages that are selected). Mirrors pageHasAnyAnnotations minus those two.
   */
  function pageHasBidMarks(page) {
    const canvases = (page && Array.isArray(page.canvases)) ? page.canvases : [];
    return canvases.some((c) => {
      const ann = (c && c.annotations) || {};
      return !!((ann.counterMarkers && Object.keys(ann.counterMarkers).length)
        || (ann.quickLines && ann.quickLines.length)
        || (ann.polylines && ann.polylines.length)
        || (ann.ductRuns && ann.ductRuns.length)
        || (ann.roomBoxes && ann.roomBoxes.length));
    });
  }

  /**
   * The Export PDFs selection for the preset: pages with bid marks → 'marked'
   * (current canvas), everything else → 'exclude'. Returns the same shape the
   * dialog keeps in its module-locals plus the list of included indexes.
   */
  function bidBasisPageSelections(pages) {
    const selections = {};
    const canvasMode = {};
    const included = [];
    (pages || []).forEach((p, i) => {
      const keep = pageHasBidMarks(p);
      selections[i] = keep ? 'marked' : 'exclude';
      canvasMode[i] = 'current';
      if (keep) included.push(i);
    });
    return { selections, canvasMode, included };
  }

  /** Counts on the ACTIVE canvas of each included page (what the export draws). */
  function summarizeIncludedPages(pages, included, getActiveAnnotations) {
    let counters = 0, runs = 0, notes = 0;
    (included || []).forEach((i) => {
      const page = pages[i];
      const ann = (getActiveAnnotations ? getActiveAnnotations(page) : null) || {};
      if (ann.counterMarkers) Object.keys(ann.counterMarkers).forEach((k) => { counters += (ann.counterMarkers[k] || []).length; });
      runs += (ann.quickLines || []).length + (ann.polylines || []).length + (ann.ductRuns || []).length;
      notes += (ann.notes || []).length;
    });
    return { counters, runs, notes };
  }

  /** The message PipeTooling receives. Keep it flat and JSON-safe. */
  function buildBidBasisManifest(input) {
    const o = input || {};
    const sheets = (o.sheets || []).map((s) => String(s));
    return {
      type: BID_BASIS_MESSAGE_TYPE,
      version: BID_BASIS_MESSAGE_VERSION,
      ref: sanitizeRef(o.ref),
      filename: String(o.filename || ''),
      saveMethod: o.saveMethod === 'confirmed' ? 'confirmed' : 'intended',
      fileSizeBytes: Number.isFinite(o.fileSizeBytes) ? Math.round(o.fileSizeBytes) : null,
      sheets,
      sheetCount: sheets.length,
      pageIndices: (o.pageIndices || []).map((n) => Number(n)),
      markTotals: {
        counters: Number(o.counters) || 0,
        runs: Number(o.runs) || 0,
      },
      notesCount: Number(o.notes) || 0,
      includeReport: !!o.includeReport,
      projectName: String(o.projectName || ''),
      projectId: o.projectId || null,
      viewToken: o.viewToken || null,
      pdfHash: o.pdfHash || null,
      ctUpdatedAt: o.ctUpdatedAt || null,
      exportedAt: o.exportedAt || new Date().toISOString(),
      canvasSnapshot: o.canvasSnapshot || null,
    };
  }

  /** The lighter notice PipeTooling uses for "takeoff changed since". */
  function buildBidBasisLoadedNotice(input) {
    const o = input || {};
    return {
      type: BID_BASIS_LOADED_MESSAGE_TYPE,
      version: BID_BASIS_MESSAGE_VERSION,
      ref: sanitizeRef(o.ref),
      projectId: o.projectId || null,
      projectName: String(o.projectName || ''),
      viewToken: o.viewToken || null,
      pdfHash: o.pdfHash || null,
      ctUpdatedAt: o.ctUpdatedAt || null,
    };
  }

  const API = {
    BID_BASIS_MESSAGE_TYPE,
    BID_BASIS_LOADED_MESSAGE_TYPE,
    BID_BASIS_MESSAGE_VERSION,
    BID_BASIS_URL_FLAG,
    PIPETOOLING_ORIGINS,
    bidBasisTargetOrigins,
    parseBidBasisParams,
    sanitizeRef,
    slugForFilename,
    buildBidBasisFilename,
    pageHasBidMarks,
    bidBasisPageSelections,
    summarizeIncludedPages,
    buildBidBasisManifest,
    buildBidBasisLoadedNotice,
  };
  if (typeof window !== 'undefined') window.BidBasisModel = API;
  // Node test harness only: in a classic browser <script> `module` is undefined.
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
