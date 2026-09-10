/*
 * features/rules.js - the rulebook in the app: the § chip and its popover
 * (rulebook slice 2, 2026-09-09).
 *
 * The rulebook's source is content/rules/*.md; `npm run build:rules` renders it
 * to /rules/ (pages) and /rules/rules.json (the same list for software — id,
 * kind, status, values as when/value/unit, source + section + editions,
 * amendments, used_by, url; no prose). This file fetches rules.json once at boot
 * (precached by the service worker, so chips work offline) and gives every
 * surface that DERIVES a number from a rule one gesture: a small chip that
 * names the citation ("§ NEC Chapter 9", "§ IPC 308.5", or "convention" for a
 * working figure), and on click a popover that states the value AS THE APP
 * APPLIES IT, the section it comes from, the editions it was checked against,
 * what in the app uses it, and a link to the rule page. Never the code's text.
 *
 * Chips go on derived rows only — a Bid Check auto row, the Chain palette's
 * vertical, the Duct Schedule's gauge / lb-per-ft / seam & waste, the make-up
 * field in Project Settings. Counts the estimator clicked never carry one.
 *
 * Markup: `App.ruleChipHtml(id)` -> <button class="rule-chip" data-rule="…">;
 * static chips in app/index.html are the same element with an empty label and
 * are filled by syncChips() when the list arrives. One popover element
 * (#rulePopover, static in app/index.html) is repositioned per open via
 * App.placeFixedMenu; it closes on Escape (a capture-phase listener, so the
 * app's Esc ladder never sees the key while it is open), on an outside click,
 * and on its × button.
 *
 * Registrations: getRule(id), ruleChipHtml(id, opts), ruleChipLabel(rule),
 * openRulePopover(id, anchorEl), closeRulePopover(), isRulePopoverOpen(),
 * rulesReady() (a promise), rulesCount(). Slice 4 adds App.getProjectCodes,
 * which the popover reads at call time for the "this project" line.
 *
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});
  const RULES_URL = '/rules/rules.json';
  const KIND_LABEL = { code: 'Code', standard: 'Standard', recommendation: 'Recommendation', convention: 'Convention' };
  const USED_BY_LABEL = { bidCheck: 'Bid Check', childCount: 'Child counts', chain: 'Chain tool', ductSchedule: 'Duct Schedule', roomSizer: 'Room Sizer', quickCreate: 'Quick creator' };

  let rules = null;          // Map id -> rule, once loaded (empty Map on failure)
  let loading = null;
  let openId = null;
  let anchor = null;

  const esc = (s) => (App.escapeHtml ? App.escapeHtml(String(s)) : String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const el = (id) => document.getElementById(id);

  function rulesReady() {
    if (loading) return loading;
    loading = fetch(RULES_URL).then((r) => (r.ok ? r.json() : null)).then((j) => {
      rules = new Map(((j && j.rules) || []).map((r) => [r.id, r]));
      syncChips();
      App.onRulesLoaded && App.onRulesLoaded();
      return rules;
    }).catch(() => { rules = new Map(); return rules; });
    return loading;
  }
  function getRule(id) { return rules ? rules.get(id) || null : null; }

  // The chip's text: the citation for a code, standard, or recommendation; the
  // word "convention" for a working figure (no section to cite).
  function shortSection(section) { return String(section || '').split(/[,;(]/)[0].trim(); }
  function ruleChipLabel(rule) {
    if (!rule) return '';
    if (rule.kind === 'convention') return 'convention';
    const s = shortSection(rule.source && rule.source.section);
    return '§ ' + (rule.source ? rule.source.code : '') + (s && s.length <= 16 ? ' ' + s : '');
  }
  function ruleChipHtml(id, opts) {
    const rule = getRule(id);
    const label = ruleChipLabel(rule);
    const title = rule ? rule.title + ' — as the app applies it' : 'Rule';
    return '<button type="button" class="rule-chip' + (opts && opts.cls ? ' ' + opts.cls : '') + '" data-rule="' + esc(id) + '" title="' + esc(title) + '"' + (label ? '' : ' hidden') + '>' + esc(label) + '</button>';
  }
  // Static chips (app/index.html) and any rendered before the list arrived.
  function syncChips() {
    document.querySelectorAll('.rule-chip[data-rule]').forEach((b) => {
      const rule = getRule(b.getAttribute('data-rule'));
      const label = ruleChipLabel(rule);
      b.textContent = label;
      b.hidden = !label;
      if (rule) b.title = rule.title + ' — as the app applies it';
    });
  }

  // --- the popover ---------------------------------------------------------------
  function valueRows(rule) {
    return rule.values.map((v) => '<tr><td>' + esc(v.when) + (v.note ? '<div class="rule-pop-note">' + esc(v.note) + '</div>' : '') + '</td><td class="rule-pop-val"><span class="rule-pop-num">' + esc(v.value) + '</span>' + (v.unit ? ' <span class="rule-pop-unit">' + esc(v.unit) + '</span>' : '') + '</td></tr>').join('');
  }
  // "This project": the edition the project follows for the rule's trade and the
  // jurisdiction, with the two honest warnings — the rule was not checked against
  // that edition, or the project follows a different code family (UPC vs IPC).
  function projectLine(rule) {
    const codes = App.getProjectCodes ? App.getProjectCodes() : null;
    if (!codes) return '';
    const edition = codes[rule.trade] || null;
    const jurisdiction = codes.jurisdiction || '';
    if (!edition && !jurisdiction) return '';
    const family = edition ? String(edition).split(/\s+/)[0] : '';
    const year = edition ? String(edition).replace(/\D+/g, '') : '';
    const cited = rule.source && rule.source.code;
    const checked = ((rule.source && rule.source.editions) || []).map(String);
    let warn = '';
    if (family && cited && ['IPC', 'UPC', 'NEC', 'SMACNA'].includes(cited) && ['IPC', 'UPC', 'NEC', 'SMACNA'].includes(family) && family !== cited) warn = 'cited from the ' + esc(cited) + ' — this project follows ' + esc(edition) + '; read that section there';
    else if (year && checked.length && !checked.includes(year)) warn = 'not checked against ' + esc(edition);
    return '<div class="rule-pop-project"><span class="rule-pop-k">This project</span> ' + esc([edition, jurisdiction].filter(Boolean).join(' · ') || '—')
      + (warn ? ' <span class="rule-pop-warn">' + warn + '</span>' : '') + '</div>';
  }
  function amendmentsFor(rule) {
    const all = rule.amendments || [];
    const codes = App.getProjectCodes ? App.getProjectCodes() : null;
    const j = codes && codes.jurisdiction ? String(codes.jurisdiction).toLowerCase() : '';
    const mine = j ? all.filter((a) => j.includes(String(a.jurisdiction || '').toLowerCase())) : all;
    if (mine.length) return '<ul class="rule-pop-amend">' + mine.map((a) => '<li><b>' + esc(a.jurisdiction) + '</b> — ' + esc(a.note) + '</li>').join('') + '</ul>';
    return '<span class="rule-pop-muted">no state or local amendment on file' + (j ? ' for ' + esc(codes.jurisdiction) : '') + '</span>';
  }
  function render(rule) {
    const editions = ((rule.source && rule.source.editions) || []).map(String).join(' · ');
    const used = (rule.used_by || []).map((u) => '<span class="rule-pop-chip">' + esc(USED_BY_LABEL[u] || u) + '</span>').join(' ');
    const amend = amendmentsFor(rule);
    return '<div class="rule-pop-head"><span class="rule-pop-kind rule-pop-kind-' + esc(rule.kind) + '">' + esc(KIND_LABEL[rule.kind] || rule.kind) + '</span>'
      + (rule.status === 'draft' ? '<span class="rule-pop-draft">not applied yet</span>' : '')
      + '<code class="rule-pop-id">' + esc(rule.id) + '</code><button type="button" class="rule-pop-close" id="rulePopoverClose" aria-label="Close">×</button></div>'
      + '<div class="rule-pop-title">' + esc(rule.title) + '</div>'
      + '<table class="rule-pop-values"><thead><tr><th>When</th><th>The app uses</th></tr></thead><tbody>' + valueRows(rule) + '</tbody></table>'
      + '<div class="rule-pop-facts">'
      + '<div><span class="rule-pop-k">Source</span> ' + esc(rule.source.code) + ' · ' + esc(rule.source.section) + '</div>'
      + (editions ? '<div><span class="rule-pop-k">Checked against</span> ' + esc(editions) + '</div>' : '')
      + projectLine(rule)
      + (used ? '<div><span class="rule-pop-k">Used by</span> ' + used + '</div>' : '')
      + '<div><span class="rule-pop-k">Amendments</span> ' + amend + '</div>'
      + '</div>'
      + '<div class="rule-pop-foot"><a href="' + esc(rule.url) + '" target="_blank" rel="noopener">Open the rule page ↗</a><span class="rule-pop-muted">Shop practice differs? That override lives with pricing.</span></div>';
  }
  function place() {
    const pop = el('rulePopover');
    if (!pop || !anchor || !anchor.isConnected) return;
    const r = anchor.getBoundingClientRect();
    if (App.placeFixedMenu) App.placeFixedMenu(pop, r.left, r.bottom + 6);
    else { pop.style.left = r.left + 'px'; pop.style.top = (r.bottom + 6) + 'px'; }
  }
  function openRulePopover(id, anchorEl) {
    const rule = getRule(id);
    const pop = el('rulePopover');
    if (!rule || !pop) return false;
    openId = id; anchor = anchorEl || null;
    pop.innerHTML = render(rule);
    pop.classList.add('visible');
    pop.setAttribute('aria-hidden', 'false');
    place();
    App.logUserEvent && App.logUserEvent('rule_open', App.state && App.state.currentProjectId || null, { rule: id });
    return true;
  }
  function closeRulePopover() {
    const pop = el('rulePopover');
    if (!pop || !openId) return;
    openId = null; anchor = null;
    pop.classList.remove('visible');
    pop.setAttribute('aria-hidden', 'true');
  }
  const isRulePopoverOpen = () => !!openId;

  // --- wiring ------------------------------------------------------------------------
  document.addEventListener('click', (e) => {
    const chip = e.target.closest && e.target.closest('.rule-chip[data-rule]');
    if (chip) {
      e.preventDefault(); e.stopPropagation();
      const id = chip.getAttribute('data-rule');
      if (openId === id) closeRulePopover(); else openRulePopover(id, chip);
      return;
    }
    if (openId) {
      const pop = el('rulePopover');
      if (pop && !pop.contains(e.target)) closeRulePopover();
      else if (e.target.closest && e.target.closest('#rulePopoverClose')) closeRulePopover();
    }
  });
  // Escape closes the popover before the app's Esc ladder can act on the key.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openId) { e.preventDefault(); e.stopPropagation(); closeRulePopover(); }
  }, true);
  window.addEventListener('resize', () => { if (openId) place(); });
  window.addEventListener('scroll', () => { if (openId) place(); }, true);

  App.getRule = getRule;
  App.ruleChipHtml = ruleChipHtml;
  App.ruleChipLabel = ruleChipLabel;
  App.openRulePopover = openRulePopover;
  App.closeRulePopover = closeRulePopover;
  App.isRulePopoverOpen = isRulePopoverOpen;
  App.rulesReady = rulesReady;
  App.rulesCount = () => (rules ? rules.size : 0);
  App.syncRuleChips = syncChips;
  rulesReady();
})();
