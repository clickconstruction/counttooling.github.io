// The Playwright half of the persona pass (PERSONA-PLAN build item 5, 2026-09-25): boot the app
// on a named device, start a set (a tour, a lesson, a course chapter), fast-forward to a step
// through the specs' seam, read the text snapshot, and perform ONE persona action with real
// mouse and keyboard events. scripts/persona-harness.js serves it over HTTP and
// scripts/persona-manifest.js dumps the step manifests with it.
//
// The engine seams (App.tutorialIds / tutorialManifest / tutorialObserve) are built on their own
// branch, and the calibration run drives a commit from before any of them, so every call
// feature-detects and falls back to reading the DOM the way a person reads the card.
//
// A persona never gets the step's own button: `act` refuses nothing, but it has no action that
// calls App.tutorialDoStep, and the fast-forward (the seam) runs only up to the episode's step.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.join(__dirname, '..', '..');
const TRADE_TOURS = ['electrical', 'plumbing', 'hvac', 'blank'];

// ---------------------------------------------------------------- a static server for the repo
// Used when no --app is given: the same zero-dep server build-screenshots.js runs.
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };
function serveRepo(port = 0) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, url: 'http://127.0.0.1:' + server.address().port })));
}

// ---------------------------------------------------------------- in-page helpers
// Installed once per page as window.__persona. Self-contained: Playwright ships the function's
// source into the page, so it may not close over anything in this module.
function installHelpers() {
  if (window.__persona) return;
  const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
  const short = (s, n) => { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); const m = n || 60; return t.length > m ? t.slice(0, m - 1) + '…' : t; };
  const shown = (el) => {
    if (!el || !el.isConnected || !el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const ownText = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ');
  const FIELD = /^(INPUT|SELECT|TEXTAREA)$/;
  // the words a person reads as a field's name: its <label>, or the label heading its form group
  const fieldLabel = (el) => {
    if (el.labels && el.labels.length) return el.labels[0].innerText;
    const g = el.closest('.form-group, .setting-row, .field-unit, .range-label');
    if (g) { const l = g.querySelector('label, .setting-label'); if (l && !l.contains(el)) return l.innerText; }
    return '';
  };
  const labelOf = (el) => {
    if (!el) return '';
    const tag = el.tagName;
    if (el.id === 'annCanvas' || el.id === 'pdfCanvas' || tag === 'CANVAS') return 'the sheet';
    if (FIELD.test(tag)) {
      const t = (el.type || '').toLowerCase();
      if (tag === 'INPUT' && /^(button|submit|reset)$/.test(t)) return short(el.value);
      return short(el.getAttribute('aria-label') || fieldLabel(el) || el.placeholder || el.title || (el.id ? '#' + el.id : tag.toLowerCase()));
    }
    const text = short(el.innerText || '');
    return text || short(el.getAttribute('aria-label') || el.title || el.getAttribute('alt') || (el.id ? '#' + el.id : tag.toLowerCase()));
  };
  // every name an element answers to: its text, own text, aria-label, title (and the title's head
  // before " (" or ":", the way teaching-labels.test.js reads a chip), placeholder, value, field label
  const namesOf = (el) => {
    const out = [el.innerText, ownText(el), el.getAttribute('aria-label'), el.getAttribute('alt'), el.placeholder];
    const title = el.getAttribute('title');
    if (title) out.push(title, title.split(' (')[0], title.split(':')[0]);
    if (FIELD.test(el.tagName)) { out.push(fieldLabel(el)); if (/^(button|submit|reset)$/i.test(el.type || '')) out.push(el.value); }
    return out.filter((s) => s != null && String(s).trim()).map(norm);
  };
  const ACTIONABLE = 'button, a, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="radio"], [role="switch"], input, select, textarea, summary, label, [onclick], [tabindex]:not([tabindex="-1"]), .sidebar-item, .learn-row';
  const pointer = (el) => getComputedStyle(el).cursor === 'pointer';
  const actionable = (el) => el.matches(ACTIONABLE) || pointer(el);
  // The control an element belongs to: the nearest real control up the tree; else the element
  // that SET the pointer cursor (its children inherit it: an icon's <path> is not the control);
  // never an SVG part.
  const toActionable = (el) => {
    let base = el;
    while (base && base.closest && base.closest('svg') && base.parentElement) base = base.closest('svg').parentElement;
    for (let p = base, i = 0; p && p !== document.body && i < 6; p = p.parentElement, i++) if (p.matches(ACTIONABLE)) return p;
    if (!pointer(base)) return base;
    let top = base;
    for (let i = 0; i < 6 && top.parentElement && top.parentElement !== document.body && pointer(top.parentElement); i++) top = top.parentElement;
    return top;
  };
  // A chip in the card's body is the card NAMING a control, not the control.
  const excluded = (el) => { const body = document.getElementById('tourBody'); return !!body && body.contains(el) && !el.closest('a'); };
  const zOf = (el) => { const z = parseInt(getComputedStyle(el).zIndex, 10); return Number.isFinite(z) ? z : 0; };
  const topDialog = () => {
    const open = Array.from(document.querySelectorAll('.modal-overlay.visible')).filter(shown);
    if (!open.length) return null;
    return open.map((el, i) => ({ el, i, z: zOf(el) })).sort((a, b) => a.z - b.z || a.i - b.i).pop().el;
  };
  // a dialog's name: its heading, else its aria-label, else the tab it is on (the Counter dialog
  // has tabs and no heading), else its id
  const dialogTitle = (ov) => {
    const h = Array.from(ov.querySelectorAll('.modal-card-header h2, .modal-card-header h3, h2, h3')).find(shown);
    if (h && short(h.innerText)) return short(h.innerText, 60);
    const tab = Array.from(ov.querySelectorAll('.active[data-tab], [role="tab"][aria-selected="true"]')).find(shown);
    const tabName = tab ? (ownText(tab).trim() || tab.innerText) : '';   // "Quick", not "Quick⇧Q"
    return short(ov.getAttribute('aria-label') || (tabName ? tabName + ' tab' : '') || ov.id, 60);
  };
  // the floating tool palettes and popovers, shown beside the sheet
  const panels = () => Array.from(document.querySelectorAll('#chainPanel, #dropPanel, #highlightPanel, #waterSizePopover, #waterHintCard, #rulePopover, .popover')).filter((el) => shown(el) && !el.closest('.modal-overlay'));
  const scopes = () => {
    const out = [];
    const d = topDialog(); if (d) out.push({ name: 'dialog', els: [d] });
    const ps = panels(); if (ps.length) out.push({ name: 'panel', els: ps });
    const card = document.getElementById('tourCard');
    if (card && shown(card)) out.push({ name: 'tour card', els: Array.from(card.querySelectorAll('.tour-card-head, .tour-card-actions, .tour-card-nav, #tourBody')) });
    const header = document.querySelector('header.header'); if (header) out.push({ name: 'header', els: [header] });
    const side = document.querySelector('aside.sidebar'); if (side) out.push({ name: 'sidebar', els: [side] });
    out.push({ name: 'page', els: [document.body] });
    return out;
  };
  const near = (el) => {
    for (let p = el.parentElement, i = 0; p && i < 6; p = p.parentElement, i++) {
      const h = p.querySelector('h2, h3, h4, .section-rule b, label');
      if (h && !h.contains(el) && short(h.innerText, 30)) return short(h.innerText, 30);
    }
    return '';
  };
  // the element a real click at (x, y) lands on, and whether it is `el` (or inside it)
  const lands = (el, x, y) => {
    const hit = document.elementFromPoint(x, y);
    if (!hit) return { ok: false, hit: null };
    const lab = hit.closest('label');
    const ok = el === hit || el.contains(hit) || (!!lab && lab.control === el) || (el.tagName === 'CANVAS' && (hit.tagName === 'CANVAS' || hit.id === 'tourZones' || !!hit.closest('#tourZones')));
    return { ok, hit };
  };
  const coveredBy = (hit) => { if (!hit) return 'nothing (off screen)'; if (hit.closest('#tourCard')) return 'the tour card'; const ov = hit.closest('.modal-overlay'); if (ov) return 'the dialog "' + dialogTitle(ov) + '"'; return '"' + labelOf(toActionable(hit)) + '"'; };
  // A point of `el` a real click reaches: the centre, then four inner points. Scrolls it into
  // view first (a person scrolls a dialog to a row), and says so.
  const pointOf = (el) => {
    const tryPoints = () => {
      const r = el.getBoundingClientRect();
      const pts = [[0.5, 0.5], [0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]].map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy])
        .filter(([x, y]) => x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight);
      let firstHit = null;
      for (const [x, y] of pts) { const l = lands(el, x, y); if (l.ok) return { x: Math.round(x), y: Math.round(y) }; if (!firstHit) firstHit = l.hit; }
      return { firstHit };
    };
    let p = tryPoints();
    if (p.x != null) return { x: p.x, y: p.y, scrolled: false };
    // off screen, or scrolled out of a dialog's panel: a person scrolls to it, then looks again
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    p = tryPoints();
    if (p.x != null) return { x: p.x, y: p.y, scrolled: true };
    return { covered: coveredBy(p.firstHit), scrolled: true };
  };
  const spotTarget = () => {
    const spot = document.getElementById('tourSpot');
    if (!spot || !shown(spot)) return null;
    const r = spot.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const under = document.elementsFromPoint(cx, cy).find((e) => !e.closest('#tourOverlay'));
    // the lit control's box, clipped to the window (the sheet as a target is bigger than it)
    const x1 = Math.max(0, r.left + 6), y1 = Math.max(0, r.top + 6), x2 = Math.min(window.innerWidth, r.right - 6), y2 = Math.min(window.innerHeight, r.bottom - 6);
    return under ? { el: toActionable(under), box: [Math.round(x1), Math.round(y1), Math.round(x2 - x1), Math.round(y2 - y1)] } : null;
  };
  // The headings a person reads a section by: the sidebar's section titles, a dialog's heading, a
  // `.section-rule` group heading, a fieldset's legend. The "COUNTERS + Add" form splits only on one.
  const HEADINGS = 'h1, h2, h3, h4, legend, .section-rule b';
  const sectionOf = (h) => h.closest('.sidebar-section, fieldset, section, .modal-card, .form-group') || (h.parentElement && h.parentElement.parentElement) || h.parentElement;
  const headingSections = (words) => {
    const want = norm(words);
    return Array.from(document.querySelectorAll(HEADINGS)).filter((h) => shown(h) && !excluded(h) && !h.closest('#tourCard') && (norm(h.innerText) === want || norm(ownText(h)) === want)).map(sectionOf).filter(Boolean);
  };
  // Controls whose names share a word with the label, for a not-found answer to offer instead.
  const suggest = (label) => {
    const words = norm(label).split(' ').filter((w) => w.length > 2 && !/^(the|and|for|add)$/.test(w));
    if (!words.length) return [];
    const out = [], seen = new Set();
    scopes().forEach((sc) => sc.els.forEach((root) => root.querySelectorAll(ACTIONABLE).forEach((el) => {
      if (seen.has(el) || !shown(el) || excluded(el)) return;
      const names = namesOf(el).join(' ');
      const score = words.filter((w) => names.includes(w)).length;
      if (score) { seen.add(el); out.push({ score, label: labelOf(el), scope: sc.name, near: near(el) }); }
    })));
    return out.sort((a, b) => b.score - a.score).slice(0, 6).map(({ label: l, scope, near: n }) => ({ label: l, scope, near: n }));
  };
  // Resolve a label to ONE element: the first scope (dialog, panel, card, header, sidebar, page)
  // with a match wins; inside it, several matches are an error listing them (the lit one marked
  // `lit`) unless `within` (a section's words, "COUNTERS"), `nth`, or `preferLit` (take the lit
  // one) picks one. Never a guess: the confusion is what the persona pass is there to find.
  function find(label, opts) {
    const o = opts || {};
    const want = norm(label);
    const within = o.within ? norm(o.within) : '';
    const tryScopes = (test) => {
      for (const sc of scopes()) {
        const hits = [];
        sc.els.forEach((root) => {
          const all = [root].concat(Array.from(root.querySelectorAll('*')));
          all.forEach((el) => { if (!excluded(el) && shown(el) && test(el)) hits.push(toActionable(el)); });
        });
        let uniq = Array.from(new Set(hits)).filter((el) => shown(el) && !excluded(el));
        uniq = uniq.filter((el) => !uniq.some((o2) => o2 !== el && el.contains(o2)));   // innermost control
        if (o.field) uniq = uniq.filter((el) => FIELD.test(el.tagName));
        if (o.sections) uniq = uniq.filter((el) => o.sections.some((sec) => sec.contains(el)));
        if (within) {
          const depth = (el) => { for (let p = el.parentElement, i = 1; p && p !== document.body && i <= 6; p = p.parentElement, i++) if (norm(p.innerText).includes(within)) return i; return 99; };
          const ds = uniq.map(depth), best = Math.min(...ds);
          uniq = best === 99 ? [] : uniq.filter((el, i) => ds[i] === best);
        }
        if (uniq.length) return { scope: sc.name, els: uniq };
      }
      return null;
    };
    let found = tryScopes((el) => namesOf(el).includes(want)), how = 'exact';
    if (!found) { found = tryScopes((el) => actionable(el) && namesOf(el).some((n) => n.startsWith(want + ' ') || n.startsWith(want + ':') || n.startsWith(want + ' ('))); how = 'starts-with'; }
    // "COUNTERS + Add": a section heading's words, then the control's, and only when the leading
    // words ARE a heading on screen (else "Water Closet counter" would press the header's Counter)
    if (!found && !within && !o.field) {
      const words = String(label).trim().split(/\s+/);
      for (let k = 1; k < words.length; k++) {
        const lead = words.slice(0, k).join(' ');
        const sections = headingSections(lead);
        if (!sections.length) continue;
        const r = find(words.slice(k).join(' '), Object.assign({}, o, { within: lead, sections }));
        if (r.ok) return Object.assign(r, { how: 'split "' + lead + '" + "' + words.slice(k).join(' ') + '"' });
        if (r.candidates) return r;   // ambiguous inside the section: say so, do not try a shorter split
      }
    }
    if (!found) {
      const err = { ok: false, error: 'no control named "' + label + '"' + (within ? ' under "' + o.within + '"' : '') + ' is on screen' };
      const c = o.sections ? [] : suggest(label);
      if (c.length) err.candidates = c;
      return err;
    }
    let els = found.els, note = '';
    if (o.nth != null) {
      if (!els[o.nth - 1]) return { ok: false, error: 'only ' + els.length + ' controls named "' + label + '"' };
      els = [els[o.nth - 1]];
    } else if (els.length > 1) {
      const lit = spotTarget();
      const isLit = (el) => !!lit && (el === lit.el || el.contains(lit.el) || lit.el.contains(el));
      const litOne = els.filter(isLit);
      if (o.preferLit && litOne.length === 1) { els = litOne; note = found.els.length + ' in the ' + found.scope + ', took the lit one (preferLit)'; }
      else return { ok: false, error: 'ambiguous: ' + els.length + ' controls named "' + label + '" in the ' + found.scope + ' (add "within" or "nth"' + (litOne.length === 1 ? ', or "preferLit"' : '') + ')', candidates: els.slice(0, 6).map((el, i) => Object.assign({ nth: i + 1, label: labelOf(el), near: near(el) }, isLit(el) ? { lit: true } : {})) };
    }
    const el = els[0];
    const tag = 'p' + Math.random().toString(36).slice(2, 8);
    el.setAttribute('data-persona-target', tag);
    return { ok: true, tag, scope: found.scope, label: labelOf(el), how, note, isSelect: el.tagName === 'SELECT', isField: FIELD.test(el.tagName) };
  }
  // A field by the words beside it: its <label>, a label element whose text matches (then the
  // field it names or the first field in its group), placeholder, aria-label or title.
  function findField(label, opts) {
    const want = norm(label);
    const direct = find(label, Object.assign({}, opts, { field: true }));
    if (direct.ok) return direct;
    for (const sc of scopes()) {
      const labels = [];
      sc.els.forEach((root) => root.querySelectorAll('label, .setting-label, .form-group > div:first-child').forEach((l) => { if (shown(l) && !excluded(l) && (norm(l.innerText) === want || norm(ownText(l)) === want)) labels.push(l); }));
      const fields = Array.from(new Set(labels.map((l) => {
        if (l.control) return l.control;
        const g = l.closest('.form-group, .setting-row') || l.parentElement;
        return g && Array.from(g.querySelectorAll('input:not([type=hidden]), select, textarea')).find(shown);
      }).filter(Boolean)));
      if (fields.length === 1) { const tag = 'p' + Math.random().toString(36).slice(2, 8); fields[0].setAttribute('data-persona-target', tag); return { ok: true, tag, scope: sc.name, label: labelOf(fields[0]), how: 'label', isSelect: fields[0].tagName === 'SELECT', isField: true }; }
      if (fields.length > 1) return { ok: false, error: 'ambiguous: ' + fields.length + ' fields labelled "' + label + '" in the ' + sc.name };
    }
    return direct;
  }
  function point(tag) {
    const el = document.querySelector('[data-persona-target="' + tag + '"]');
    if (!el) return { covered: 'the control went away' };
    return pointOf(el);
  }
  function untag() { document.querySelectorAll('[data-persona-target]').forEach((el) => el.removeAttribute('data-persona-target')); }
  // What a real click at (x, y) lands on, for clickAt and the zones.
  function hitAt(x, y) { const hit = document.elementFromPoint(x, y); if (!hit) return { label: 'nothing (off screen)', card: false }; return { label: hit.closest('#tourCard') ? 'the tour card' : labelOf(toActionable(hit)), card: !!hit.closest('#tourCard'), sheet: hit.tagName === 'CANVAS' || !!hit.closest('#tourZones') }; }
  function toasts() { return Array.from(document.querySelectorAll('#toastRegion .toast-card.visible, #toastRegion .toast-card')).filter(shown).map((t) => short(t.innerText, 140)).filter(Boolean); }

  // The observation built from the card, for a commit without App.tutorialObserve. Same shape;
  // `code` is null (the reason codes live in the engine) and `stepPage` is unknown.
  function observe() {
    const A = window.App || {};
    if (!A.isTutorialActive || !A.isTutorialActive()) return null;
    const $ = (id) => document.getElementById(id);
    const info = (A.tutorialStepInfo && A.tutorialStepInfo()) || {};
    const no = String(($('tourStepNo') || {}).textContent || '').split('/').map((s) => parseInt(s, 10));
    const status = $('tourStatus');
    const next = $('tourNext');
    const card = $('tourCard');
    const buttons = card ? Array.from(card.querySelectorAll('button')).filter(shown).map((b) => (b.id === 'tourLeave' ? 'Leave the tour' : short(b.innerText, 40))) : [];
    const spot = spotTarget();
    const d = topDialog();
    const zs = A.tutorialZoneScreen ? A.tutorialZoneScreen() : [];
    const R = Math.round;
    const zones = zs.map((z, i) => {
      const o = { n: i + 1, kind: z.kind, done: !!z.done };
      if (z.kind === 'circle') { o.cx = R(z.cx); o.cy = R(z.cy); o.r = R(z.r); }
      else if (z.kind === 'box') o.box = [R(z.outer.x1), R(z.outer.y1), R(z.outer.x2 - z.outer.x1), R(z.outer.y2 - z.outer.y1)];
      else if (z.kind === 'span') o.box = [R(Math.min(z.a.x, z.b.x)), R(Math.min(z.a.y, z.b.y)), R(Math.abs(z.b.x - z.a.x)), R(Math.abs(z.b.y - z.a.y))];
      return o;
    });
    return {
      tour: A.tutorialId ? A.tutorialId() : null,
      i: Number.isFinite(no[0]) ? no[0] - 1 : null,
      n: Number.isFinite(no[1]) ? no[1] : null,
      id: info.id || (A.tutorialStepId && A.tutorialStepId()),
      kind: info.kind || null,
      title: short(($('tourTitle') || {}).textContent, 120),
      card: cardLines(false),
      status: short(status ? status.textContent : '', 200),
      miss: !!(status && status.classList.contains('tour-status-miss')),
      code: null,
      done: !!info.done,
      next: !!(next && !next.disabled),
      buttons,
      lit: spot ? { label: labelOf(spot.el), box: spot.box } : null,
      dialog: d ? { id: d.id, title: dialogTitle(d) } : null,
      zones,
      page: window.state ? window.state.currentPage : null,
      stepPage: null,
    };
  }
  // The card's body as lines, numbered the way the screen numbers them. raw: [[chips]] and
  // [links](/path) put back (the text walk's body) and a shown reveal left out; else the words a
  // person reads, the reveal included.
  function cardLines(raw) {
    const body = document.getElementById('tourBody');
    const lines = [];
    if (!body) return '';
    const text = (node) => { const c = node.cloneNode(true); if (raw) { c.querySelectorAll('.tour-ui').forEach((s) => s.replaceWith('[[' + s.textContent + ']]')); c.querySelectorAll('a.tour-link').forEach((a) => a.replaceWith('[' + a.textContent + '](' + a.getAttribute('href') + ')')); } return c.textContent.replace(/\s+/g, ' ').trim(); };
    const walk = (parent) => Array.from(parent.children).forEach((ch) => {
      if (ch.classList.contains('tour-reveal')) { if (!raw) { lines.push('Answer:'); walk(ch); } return; }
      if (ch.tagName === 'OL') { const start = parseInt(ch.getAttribute('start') || '1', 10); Array.from(ch.children).forEach((li, k) => lines.push((start + k) + '. ' + text(li))); }
      else lines.push(text(ch));
    });
    walk(body);
    return lines.join('\n');
  }
  // The card as the text walk reads it: the body back to its raw lines, [[chips]] kept.
  function readCard() {
    const A = window.App || {};
    const show = document.getElementById('tourShow');
    const reveal = document.getElementById('tourReveal');
    const info = (A.tutorialStepInfo && A.tutorialStepInfo()) || {};
    const spot = spotTarget();
    const no = String((document.getElementById('tourStepNo') || {}).textContent || '').split('/').map((s) => parseInt(s, 10));
    const handsOff = !!(show && shown(show) && show.textContent.trim() !== 'Show me where');
    return {
      i: no[0] - 1, id: info.id, kind: info.kind, last: no[0] === no[1],
      title: (document.getElementById('tourTitle') || {}).textContent || '',
      body: cardLines(true),
      reveal: !!(reveal && shown(reveal)),
      targets: spot ? [labelOf(spot.el)] : [],
      zones: A.tutorialZones ? A.tutorialZones().length : 0,
      action: !!info.hasAction,
      handsOff,
    };
  }
  // a shown reveal's answer, raw like the body
  function revealText() {
    const box = document.querySelector('#tourBody .tour-reveal');
    if (!box) return '';
    const c = box.cloneNode(true);
    c.querySelectorAll('.tour-ui').forEach((s) => s.replaceWith('[[' + s.textContent + ']]'));
    return Array.from(c.children).map((ch) => (ch.tagName === 'OL' ? Array.from(ch.children).map((li, k) => (k + 1) + '. ' + li.textContent.replace(/\s+/g, ' ').trim()).join('\n') : ch.textContent.replace(/\s+/g, ' ').trim())).join('\n');
  }
  // Every dialog's controls by name, for labels.json (PERSONA-PROBER item 4: the text pass's false
  // "control not on screen" leads were controls that live only in a dialog, several of them built
  // by script, like the Set Scale preset grid). shownOnly: the dialogs on screen now (a walk's
  // look); else every dialog in the DOM, hidden ones read by their text.
  function dialogControls(shownOnly) {
    const out = {};
    const txt = (el) => String(el.textContent || '').replace(/\s+/g, ' ').trim();
    Array.from(document.querySelectorAll('.modal-overlay')).forEach((ov) => {
      if (shownOnly && !(ov.classList.contains('visible') && shown(ov))) return;
      const h = ov.querySelector('.modal-card-header h2, .modal-card-header h3, h2, h3');
      const name = (h && txt(h)) || ov.getAttribute('aria-label') || ov.id || 'dialog';
      const labels = new Set();
      ov.querySelectorAll(ACTIONABLE).forEach((el) => {
        if (shownOnly && !shown(el)) return;
        if (FIELD.test(el.tagName)) {
          const t = (el.type || '').toLowerCase();
          if (t === 'hidden') return;
          const f = /^(button|submit|reset)$/.test(t) ? el.value : (el.getAttribute('aria-label') || fieldLabel(el) || el.placeholder);
          if (f && String(f).trim()) labels.add(String(f).replace(/\s+/g, ' ').trim());
          return;
        }
        [txt(el), el.getAttribute('aria-label'), el.getAttribute('title')].forEach((n) => { const v = String(n || '').trim(); if (v && v.length <= 60) labels.add(v); });
      });
      if (labels.size) out[name] = Array.from(new Set((out[name] || []).concat(Array.from(labels))));
    });
    return out;
  }
  window.__persona = { find, findField, point, untag, hitAt, toasts, observe, readCard, revealText, labelOf, dialogControls };
}

// ---------------------------------------------------------------- sessions
async function launch(opts) {
  const { chromium } = require('@playwright/test');
  return chromium.launch({ headless: !(opts && opts.headed) });
}
async function newSession(browser, dev) {
  const context = await browser.newContext({ viewport: dev.viewport, hasTouch: !!dev.hasTouch, isMobile: !!dev.isMobile, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { context, page, errors };
}
const helpers = (page) => page.evaluate(installHelpers);
async function boot(page, app) {
  await page.goto(app.replace(/\/$/, '') + '/app/');
  await page.waitForFunction(() => window.App && window.App.bootSettled === true && typeof window.App.startTutorial === 'function', null, { timeout: 60000 });   // a loaded machine boots slowly
  // the last session's sheets come back as a "restore" offer on a poll; a reader declines it
  await page.waitForTimeout(900);
  if (await page.locator('#lastSessionRestoreModal.visible').count()) { await page.click('#lastSessionRestoreDiscard'); await page.waitForTimeout(300); }
  await helpers(page);
}

// Every set id: the engine's list when it has one, else the doors the feature files register.
async function setIds(page) {
  return page.evaluate(() => {
    const A = window.App;
    if (typeof A.tutorialIds === 'function') return A.tutorialIds();
    const out = ['electrical', 'plumbing', 'hvac', 'blank'];
    (A.lessonIds ? A.lessonIds() : []).forEach((id) => out.push('lesson:' + id));
    [['plumbing', A.courseChapterIds], ['electrical', A.courseElectricalIds], ['hvac', A.courseHvacIds]].forEach(([c, fn]) => { if (typeof fn === 'function') fn().forEach((id) => out.push('course:' + c + ':' + id)); });
    return out;
  });
}

// Start a set the way its own door does. Returns false when the app refused. A tour id the app
// does not know is refused here: App.startTutorial falls back to the electrical tour for one and
// still says yes, so a typo would work the wrong tour under the name it asked for.
async function startRaw(page, set) {
  return page.evaluate(([s, trades]) => {
    const A = window.App;
    const cap = (w) => w[0].toUpperCase() + w.slice(1);
    if (s.startsWith('lesson:')) return !!A.startLesson(s.slice(7));
    if (s.startsWith('course:')) {
      const [, course, ch] = s.split(':');
      const fn = course === 'plumbing' ? A.startChapter : (A['startChapter' + cap(course)] || null);
      return typeof fn === 'function' ? !!fn(ch) : false;
    }
    const known = typeof A.tutorialIds === 'function' ? A.tutorialIds() : trades;
    if (!known.includes(s)) return false;
    if (!A.startTutorial(s)) return false;
    return !A.tutorialId || A.tutorialId() === s;
  }, [set, TRADE_TOURS]);
}
// A set id this app does not have, as an error that lists the ones it does; null when it is fine.
async function unknownSet(page, set) {
  const ids = await setIds(page);
  return ids.includes(set) ? null : 'no set "' + set + '" (the sets: ' + ids.join(', ') + ')';
}
const nextIfStill = (page, was) => page.evaluate((w) => { if (window.App.tutorialStepId() !== w) return true; const b = document.getElementById('tourNext'); if (b && !b.disabled) { b.click(); return true; } return false; }, was);
const stepId = (page) => page.evaluate(() => (window.App.tutorialStepId ? window.App.tutorialStepId() : null));
const stepInfo = (page) => page.evaluate(() => (window.App.tutorialStepInfo ? window.App.tutorialStepInfo() : null));
// The first step of every set is `handsOff` (open the sample sheets, a blank sheet): the card's
// own button does it, then Trim your set's Open when the lesson leaves that to the reader.
async function clearOpening(page) {
  const first = await stepId(page);
  const btn = page.locator('#tourShow');
  if (!(await btn.isVisible()) || (await btn.textContent()).trim() === 'Show me where') return;
  await btn.click({ timeout: 5000 }).catch(() => page.evaluate(() => document.getElementById('tourShow').click()));
  const until = Date.now() + 40000;
  while (Date.now() < until) {
    if ((await stepId(page)) !== first) break;
    if (await page.locator('#preparePdfDone:visible').count()) { await page.click('#preparePdfDone', { timeout: 3000 }).catch(() => {}); }
    const info = await stepInfo(page);
    // Next only if it is STILL this step, in one move inside the page: a click from outside
    // races the auto-advance and lands on the next step's disabled Next (tutorial.spec.js doAndGo)
    if (info && info.done) { await page.waitForTimeout(1200); await nextIfStill(page, first); }
    await page.waitForTimeout(250);
  }
  if ((await stepId(page)) === first) throw new Error('the opening step "' + first + '" did not finish');
  await page.waitForTimeout(600);
}
// `target` (a step id or index): an episode AT the opening step keeps it for the persona.
async function startSet(page, set, target) {
  if (!(await startRaw(page, set))) throw new Error('the app would not start "' + set + '"');
  await page.waitForFunction(() => window.App.tutorialStepId && window.App.tutorialStepId(), null, { timeout: 10000 });
  if (target === 0 || (target != null && target === (await stepId(page)))) return;
  await clearOpening(page);
}

// Fast-forward to a step by id (or by index, a number), through the specs' seam
// (course-plumbing.spec.js): an undone doing step with an action runs App.tutorialDoStep; then
// Next, pressed inside the page so it cannot race the auto-advance; a held step needs Next; a
// doing step the seam cannot finish is skipped (and reported).
async function fastForward(page, target) {
  const skipped = [];
  const at = async () => page.evaluate(() => { const no = String(document.getElementById('tourStepNo').textContent).split('/'); return { id: window.App.tutorialStepId(), i: parseInt(no[0], 10) - 1 }; });
  const hit = (cur) => (typeof target === 'number' ? cur.i === target : cur.id === target);
  for (let k = 0; k < 120; k++) {
    const cur = await at();
    if (!cur.id) throw new Error('the set ended before step "' + target + '"');
    // `landed`: the step as the fast-forward found it, before the beat (a step that is Done on
    // arrival moves itself on inside that beat, and the harness's no-work check needs to know)
    if (hit(cur)) { const landed = Object.assign({ id: cur.id, i: cur.i }, await stepInfo(page)); await page.waitForTimeout(700); return { skipped, landed }; }
    if (typeof target === 'number' && cur.i > target) throw new Error('step ' + target + ' was passed (the set is at ' + cur.i + ')');
    const info = await stepInfo(page);
    if (info && info.kind === 'do' && !info.done && info.hasAction) {
      await page.evaluate(() => window.App.tutorialDoStep());
      await page.waitForFunction((was) => window.App.tutorialStepId() !== was || (window.App.tutorialStepInfo() || {}).done, cur.id, { timeout: 25000 }).catch(() => {});
    }
    if ((await stepId(page)) === cur.id) {
      const moved = await page.evaluate((was) => { if (window.App.tutorialStepId() !== was) return true; const b = document.getElementById('tourNext'); if (b && !b.disabled && b.textContent !== 'Finish') { b.click(); return true; } return false; }, cur.id);
      if (!moved) {
        const last = await page.evaluate(() => document.getElementById('tourNext').textContent === 'Finish');
        if (last) throw new Error('no step "' + target + '" in this set');
        skipped.push(cur.id);
        await page.evaluate((w) => { if (window.App.tutorialStepId() === w) document.getElementById('tourSkip').click(); }, cur.id);
      }
    }
    await page.waitForTimeout(200);
  }
  throw new Error('step "' + target + '" not reached in 120 moves');
}

// The text snapshot: the engine's when it has one, else the card read from the DOM.
async function observe(page) {
  await helpers(page);
  return page.evaluate(() => (typeof window.App.tutorialObserve === 'function' ? window.App.tutorialObserve() : window.__persona.observe()));
}

// ---------------------------------------------------------------- the manifest
const MANIFEST_KEYS = ['i', 'id', 'kind', 'title', 'body', 'reveal', 'targets', 'zones', 'page', 'hint', 'progress', 'action', 'handsOff', 'hold', 'rules', 'rulesExempt'];
// One step in the stable key order, the omission rule the engine's manifestOf keeps: i, id, kind,
// title, body, targets (an array) and zones (a number) are always there; reveal and page only when
// the step has them; the flags only when true; rules only when not empty.
function compactStep(st) {
  const out = {};
  const always = ['i', 'id', 'kind', 'title', 'body'];
  MANIFEST_KEYS.forEach((k) => {
    let v = st[k];
    if (k === 'targets') v = Array.isArray(v) ? v : [];
    if (k === 'zones') v = Number.isFinite(v) ? v : 0;
    if (v === undefined || v === null) return;
    if (!always.includes(k) && k !== 'targets' && k !== 'zones' && (v === false || v === '' || (Array.isArray(v) && !v.length))) return;
    out[k] = v;
  });
  // anything the engine adds beyond the contract rides at the end, in its own order
  Object.keys(st).forEach((k) => { if (!(k in out) && !MANIFEST_KEYS.includes(k) && st[k] != null && st[k] !== false) out[k] = st[k]; });
  return out;
}
// Walk a set with the card's Skip / Next, reading the card at each step, for a commit without
// App.tutorialManifest. Marked source: 'walk': the body is read back from the rendered card, a
// step's targets are only the control it lit, and hint / progress / hold cannot be seen.
async function walkManifest(page, set) {
  if (!(await startRaw(page, set))) throw new Error('the app would not start "' + set + '"');
  await page.waitForFunction(() => window.App.tutorialStepId && window.App.tutorialStepId(), null, { timeout: 10000 });
  await helpers(page);
  const steps = [];
  const seen = { dialogs: {}, card: new Set() };   // what the walk saw on screen, for labels.json
  const look = async () => {
    const r = await page.evaluate(() => ({ d: window.__persona.dialogControls(true), o: window.__persona.observe() })).catch(() => null);
    if (!r) return;
    Object.entries(r.d).forEach(([name, ls]) => { seen.dialogs[name] = Array.from(new Set((seen.dialogs[name] || []).concat(ls))); });
    ((r.o && r.o.buttons) || []).forEach((b) => seen.card.add(b));
  };
  for (let k = 0; k < 120; k++) {
    await page.waitForTimeout(250);
    await look();
    const c = await page.evaluate(() => window.__persona.readCard());
    const last = c.last;
    delete c.last;
    // a reveal step asks before it tells: the walk presses its button to read the answer
    if (c.reveal) { await page.evaluate(() => document.getElementById('tourReveal').click()); await page.waitForTimeout(150); c.reveal = (await page.evaluate(() => window.__persona.revealText())) || true; }
    steps.push(compactStep(c));
    if (last) break;
    const was = c.i;
    if (k === 0 && c.handsOff) await clearOpening(page);
    // the walk is not a persona: it moves with the card's own buttons, pressed inside the page so
    // a step that moves itself on (or a dialog a step opened) cannot make the press miss
    else await page.evaluate((w) => { if (window.App.tutorialStepId() !== w) return; const skip = document.getElementById('tourSkip'); if (skip && skip.style.display !== 'none') skip.click(); else document.getElementById('tourNext').click(); }, c.id);
    await page.waitForFunction((w) => parseInt(String(document.getElementById('tourStepNo').textContent).split('/')[0], 10) - 1 !== w || !window.App.isTutorialActive(), was, { timeout: 8000 }).catch(() => {});
    if (!(await page.evaluate(() => window.App.isTutorialActive()))) break;
  }
  await page.evaluate(() => window.App.stopTutorial && window.App.stopTutorial(false));
  return { id: set, source: 'walk', steps, seen: { dialogs: seen.dialogs, card: Array.from(seen.card) } };
}
// Every dialog's controls in the booted page, hidden ones included, plus the Set Scale presets,
// which the dialog builds only when its tab shows (the calibration's C11: "1/8\" = 1'" was not
// on any list).
async function dialogLabels(page) {
  await helpers(page);
  return page.evaluate(() => {
    const out = window.__persona.dialogControls(false);
    const presets = (window.App.SCALE_PRESETS || []).map((p) => p.label).filter(Boolean);
    if (presets.length) { const k = Object.keys(out).find((n) => /set scale/i.test(n)) || 'Set Scale'; out[k] = Array.from(new Set((out[k] || []).concat(presets))); }
    return out;
  });
}
// The tour card's buttons as each set's first step shows them (an opening step's button is named
// by the step: "Open the sample plan"), for an engine manifest, which a walk reads by itself.
// Starts each set and stops it; the page is left with no tour running.
async function cardLabels(page, sets) {
  await helpers(page);
  // the buttons every doing / reading step can show, named the way observe() names them
  const out = new Set(['Show me where', 'Skip this step', 'Back', 'Next', 'Finish', 'Leave the tour']);
  for (const set of sets) {
    try {
      if (!(await startRaw(page, set))) continue;
      await page.waitForFunction(() => window.App.tutorialStepId && window.App.tutorialStepId(), null, { timeout: 5000 });
      await page.waitForTimeout(120);
      const bs = await page.evaluate(() => { const o = typeof window.App.tutorialObserve === 'function' ? window.App.tutorialObserve() : window.__persona.observe(); return (o && o.buttons) || []; });
      bs.forEach((b) => out.add(b));
    } catch (_) { /* a set that will not start here is the walk's to report */ }
    await page.evaluate(() => window.App.stopTutorial && window.App.stopTutorial(false)).catch(() => {});
  }
  return Array.from(out);
}
async function manifestOf(page, set) {
  const engine = await page.evaluate((s) => (typeof window.App.tutorialManifest === 'function' ? window.App.tutorialManifest(s) : null), set);
  if (engine) return Object.assign({ id: set, source: 'engine' }, engine, { steps: (engine.steps || []).map(compactStep) });
  return walkManifest(page, set);
}

// ---------------------------------------------------------------- one persona action
const short = (s, n) => { const t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return t.length > (n || 80) ? t.slice(0, (n || 80) - 1) + '…' : t; };
const normKey = (k) => String(k).split('+').map((p) => ({ ctrl: 'ControlOrMeta', control: 'ControlOrMeta', cmd: 'ControlOrMeta', meta: 'ControlOrMeta', esc: 'Escape', del: 'Delete', return: 'Enter', space: ' ' }[p.toLowerCase()] || (p.length === 1 ? p : p[0].toUpperCase() + p.slice(1)))).join('+');

async function realClick(page, tag) {
  const pt = await page.evaluate((t) => window.__persona.point(t), tag);
  if (pt.covered) return { ok: false, error: 'covered by ' + pt.covered };
  await page.mouse.move(pt.x, pt.y, { steps: 4 });
  await page.mouse.click(pt.x, pt.y);
  return { ok: true, at: [pt.x, pt.y], scrolled: pt.scrolled };
}
async function zoneScreen(page) { return page.evaluate(() => (window.App.tutorialZoneScreen ? window.App.tutorialZoneScreen() : [])); }
async function dragBetween(page, a, b) {
  await page.mouse.move(a[0], a[1]);
  await page.mouse.down();
  await page.mouse.move(b[0], b[1], { steps: 10 });
  await page.mouse.up();
}

// Perform one action. Returns { ok, error?, events: [short strings] }.
async function act(page, action, ctx) {
  await helpers(page);
  const events = [];
  const a = action || {};
  const res = await (async () => {
    if (a.click != null) {
      const r = await page.evaluate(([l, o]) => window.__persona.find(l, o), [String(a.click), { within: a.within, nth: a.nth, preferLit: !!a.preferLit }]);
      if (!r.ok) return { ok: false, error: r.error, candidates: r.candidates };
      const c = await realClick(page, r.tag);
      await page.evaluate(() => window.__persona.untag());
      if (!c.ok) return { ok: false, error: '"' + r.label + '" (' + r.scope + ') is ' + c.error };
      events.push('clicked "' + r.label + '" in the ' + r.scope + (r.how !== 'exact' ? ' (' + r.how + ')' : '') + (r.note ? ', ' + r.note : '') + (c.scrolled ? ', scrolled into view' : ''));
      return { ok: true, clicked: { label: r.label, scope: r.scope } };   // the no-work detector reads which button it was
    }
    if (a.fill || a.select) {
      const [label, value] = a.fill || a.select;
      const r = await page.evaluate(([l, o]) => window.__persona.findField(l, o), [String(label), { within: a.within, nth: a.nth }]);
      if (!r.ok) return { ok: false, error: r.error, candidates: r.candidates };
      if (a.select) {
        if (!r.isSelect) { await page.evaluate(() => window.__persona.untag()); return { ok: false, error: '"' + label + '" is not a dropdown' }; }
        const loc = page.locator('[data-persona-target="' + r.tag + '"]');
        const opts = await loc.evaluate((s) => Array.from(s.options).map((o) => o.textContent.trim()));
        const want = String(value).trim().toLowerCase();
        const pick = opts.find((o) => o.toLowerCase() === want) || opts.find((o) => o.toLowerCase().startsWith(want));
        if (!pick) { await page.evaluate(() => window.__persona.untag()); return { ok: false, error: 'no option "' + value + '" in "' + r.label + '" (' + opts.slice(0, 12).join(' | ') + ')' }; }
        const c = await realClick(page, r.tag);   // a person clicks the dropdown open first
        if (!c.ok) { await page.evaluate(() => window.__persona.untag()); return { ok: false, error: '"' + r.label + '" is ' + c.error }; }
        await loc.selectOption({ label: pick });
        await page.evaluate(() => window.__persona.untag());
        events.push('chose "' + pick + '" in "' + r.label + '"');
        return { ok: true };
      }
      const c = await realClick(page, r.tag);
      await page.evaluate(() => window.__persona.untag());
      if (!c.ok) return { ok: false, error: '"' + r.label + '" is ' + c.error };
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(String(value), { delay: 15 });
      events.push('typed "' + short(value, 40) + '" into "' + r.label + '"');
      return { ok: true };
    }
    if (a.clickZone != null || a.dragZone != null) {
      const n = a.clickZone != null ? a.clickZone : a.dragZone;
      const zs = await zoneScreen(page);
      const z = zs[n - 1];
      if (!z) return { ok: false, error: 'no zone ' + n + ' (the step has ' + zs.length + ')' };
      if (a.clickZone != null) {
        if (z.kind !== 'circle') return { ok: false, error: 'zone ' + n + ' is a ' + z.kind + ': drag it (dragZone)' };
        const hit = await page.evaluate(([x, y]) => window.__persona.hitAt(x, y), [z.cx, z.cy]);
        if (hit.card) return { ok: false, error: 'the tour card covers zone ' + n };
        await page.mouse.move(z.cx, z.cy, { steps: 4 });
        await page.mouse.click(z.cx, z.cy);
        events.push('clicked zone ' + n + (hit.sheet ? '' : ' (landed on "' + hit.label + '")'));
        return { ok: true };
      }
      if (z.kind !== 'box') return { ok: false, error: 'zone ' + n + ' is a ' + z.kind + ': click it (clickZone)' };
      const p1 = [(z.outer.x1 + z.inner.x1) / 2, (z.outer.y1 + z.inner.y1) / 2], p2 = [(z.outer.x2 + z.inner.x2) / 2, (z.outer.y2 + z.inner.y2) / 2];
      const hit = await page.evaluate(([x, y]) => window.__persona.hitAt(x, y), p1);
      if (hit.card) return { ok: false, error: 'the tour card covers the corner of zone ' + n };
      await dragBetween(page, p1, p2);
      events.push('dragged across zone ' + n);
      return { ok: true };
    }
    if (a.clickAt) {
      const [x, y] = a.clickAt;
      const hit = await page.evaluate(([px, py]) => window.__persona.hitAt(px, py), [x, y]);
      await page.mouse.move(x, y, { steps: 4 });
      await page.mouse.click(x, y);
      events.push('clicked at ' + x + ',' + y + ' on "' + hit.label + '"');
      return { ok: true };
    }
    if (a.drag) { await dragBetween(page, a.drag[0], a.drag[1]); events.push('dragged ' + a.drag[0].join(',') + ' to ' + a.drag[1].join(',')); return { ok: true }; }
    if (a.type != null) {
      const focus = await page.evaluate(() => { const e = document.activeElement; return e && e !== document.body ? window.__persona.labelOf(e) : null; });
      await page.keyboard.type(String(a.type), { delay: 15 });
      events.push('typed "' + short(a.type, 40) + '"' + (focus ? ' into "' + focus + '"' : ' with nothing focused'));
      return { ok: true };
    }
    if (a.key != null) { await page.keyboard.press(normKey(a.key)); events.push('pressed ' + a.key); return { ok: true }; }
    if (a.scroll) { const [x, y, dy] = a.scroll; await page.mouse.move(x, y); await page.mouse.wheel(0, dy); events.push('scrolled ' + dy + ' at ' + x + ',' + y); return { ok: true }; }
    if (a.screenshot) {
      const file = path.join(ctx.outDir, ctx.id + '-' + String(ctx.n).padStart(3, '0') + '.png');
      await page.screenshot({ path: file });
      events.push('screenshot ' + file);
      return { ok: true, screenshot: file };
    }
    if (a.wait != null) { await page.waitForTimeout(Math.max(0, Math.min(10000, +a.wait || 0))); return { ok: true }; }
    if (a.giveUp != null) { events.push('gave up: ' + short(a.giveUp, 120)); return { ok: true, gaveUp: true }; }
    return { ok: false, error: 'unknown action ' + JSON.stringify(a) + ' (click, clickZone, dragZone, clickAt, drag, type, fill, select, key, scroll, screenshot, wait, giveUp)' };
  })();
  return Object.assign(res, { events });
}

// After an action: give the step its beat. The engine re-reads every 400 ms and moves a done
// doing-step on about 900 ms later, so wait for that before reading.
async function settle(page, before) {
  await page.waitForTimeout(500);
  const until = Date.now() + 2200;
  while (Date.now() < until) {
    const s = await page.evaluate(() => ({ id: window.App.tutorialStepId ? window.App.tutorialStepId() : null, info: window.App.tutorialStepInfo ? window.App.tutorialStepInfo() : null }));
    if (!s.id || s.id !== before || !(s.info && s.info.done && s.info.kind === 'do')) break;
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(150);
}

module.exports = { serveRepo, launch, newSession, boot, setIds, unknownSet, startSet, startRaw, clearOpening, fastForward, observe, manifestOf, walkManifest, dialogLabels, cardLabels, compactStep, act, settle, stepId, installHelpers, TRADE_TOURS };
