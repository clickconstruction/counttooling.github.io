#!/usr/bin/env node
/**
 * Generates the rulebook (/rules/) from content/rules/<trade>/<slug>.md — one page
 * per rule, a searchable index, and rules/rules.json (the same list for software:
 * the app's rule chips and any AI read that, never the pages). Committed-artifact
 * generator like build-guides.js; sitemap.xml is written by build-guides.js, which
 * lists the rule pages too.
 *
 *   npm run build:rules            # write rules/**
 *   npm run build:rules -- --check # exit non-zero if the output is stale OR a value
 *                                  # in code no longer equals its rule (the drift check)
 *
 * Authoring: content/rules/README.md.
 */
const fs = require('fs');
const path = require('path');
const { escAttr, escHtml, fmtDate, layout, breadcrumb, breadcrumbLd } = require('./lib/site');
const { loadRules, driftCheck, toJson, TRADES } = require('./lib/rules');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'rules');
const TRADE_LABEL = { electrical: 'Electrical', hvac: 'HVAC', plumbing: 'Plumbing' };
const KIND_LABEL = { code: 'Code', standard: 'Standard', recommendation: 'Recommendation', convention: 'Convention' };
const KIND_BLURB = {
  code: 'A model code the authority having jurisdiction adopts.',
  standard: 'An industry standard the trade builds to.',
  recommendation: 'In the code, but advisory — an informational note, not a requirement.',
  convention: 'A working figure the trade uses and the app defaults to. Shops override these most.',
};
const USED_BY_LABEL = { bidCheck: 'Bid Check', childCount: 'Child counts', chain: 'Chain tool', ductSchedule: 'Duct Schedule', roomSizer: 'Room Sizer', quickCreate: 'Quick creator' };

function valueCell(v) {
  const val = typeof v.value === 'number' ? String(v.value) : escHtml(v.value);
  return `<span class="rule-value">${val}</span>${v.unit ? ` <span class="rule-unit">${escHtml(v.unit)}</span>` : ''}`;
}
function valuesTable(r) {
  const rows = r.values.map((v) => `        <tr><td>${escHtml(v.when)}${v.note ? `<div class="rule-note">${escHtml(v.note)}</div>` : ''}</td><td class="rule-value-cell">${valueCell(v)}</td></tr>`).join('\n');
  return `      <table class="rule-values">\n        <thead><tr><th>When</th><th>The app uses</th></tr></thead>\n        <tbody>\n${rows}\n        </tbody>\n      </table>`;
}
function usedBy(r) {
  if (!r.used_by.length) return '<span class="rule-unused">not applied by the app yet</span>';
  return r.used_by.map((u) => `<span class="rule-chip">${escHtml(USED_BY_LABEL[u] || u)}</span>`).join(' ');
}
function statusBadge(r) {
  return r.status === 'applied'
    ? '<span class="rule-status rule-status-applied">Applied by the app</span>'
    : '<span class="rule-status rule-status-draft">Draft — written, not yet applied</span>';
}
function editions(r) {
  const e = r.source.editions || [];
  return e.length ? e.map(String).join(' · ') : '—';
}
function amendments(r) {
  const a = r.amendments || [];
  if (!a.length) return '<p class="rule-amend">No state or local amendment to this rule is on file. Not on file means the model code as written — check your jurisdiction.</p>';
  return '<ul class="rule-amend-list">' + a.map((x) => `<li><strong>${escHtml(x.jurisdiction)}</strong> — ${escHtml(x.note)}</li>`).join('') + '</ul>';
}

function rulePage(r, marked) {
  const crumbs = [{ name: 'Rules', url: '/rules/' }, { name: TRADE_LABEL[r.trade], url: `/rules/#${r.trade}` }, { name: r.title, url: r.url }];
  const jsonLd = [
    breadcrumbLd(crumbs),
    { '@context': 'https://schema.org', '@type': 'TechArticle', headline: r.title, description: r.summary, dateModified: r.updated, url: 'https://counttooling.com' + r.url, publisher: { '@type': 'Organization', name: 'CountTooling' } },
  ];
  const body = `${breadcrumb(crumbs)}
    <article class="article rule-article">
      <p class="rule-kicker"><span class="rule-kind rule-kind-${r.kind}">${KIND_LABEL[r.kind]}</span> ${statusBadge(r)} <code class="rule-id">${escHtml(r.id)}</code></p>
      <h1>${escHtml(r.title)}</h1>
      <p class="rule-summary">${escHtml(r.summary)}</p>
      <section class="rule-card" aria-label="The rule as the app applies it">
        <div class="rule-card-head">The rule, as the app applies it</div>
${valuesTable(r)}
        <dl class="rule-facts">
          <div><dt>Source</dt><dd>${escHtml(r.source.code)} · ${escHtml(r.source.section)}${r.source.url ? ` · <a href="${escAttr(r.source.url)}" rel="noopener">read the public text</a>` : ''}</dd></div>
          <div><dt>Editions checked</dt><dd>${escHtml(editions(r))}</dd></div>
          <div><dt>Used by</dt><dd>${usedBy(r)}</dd></div>
          <div><dt>Amendments</dt><dd>${amendments(r)}</dd></div>
        </dl>
        <p class="rule-kind-blurb">${KIND_BLURB[r.kind]}</p>
      </section>
${marked.parse(r.body).trim()}
      <p class="rule-foot">Cited by section, not reprinted: the code text belongs to its publisher. Company practice is not a rule here — it lives with your pricing. <span class="meta">Updated ${escHtml(fmtDate(r.updated))}.</span></p>
    </article>`;
  return layout({ title: `${r.title} — CountTooling Rules`, description: r.summary, slug: r.url, ogType: 'article', jsonLd }, body);
}

function indexPage(rules) {
  const byTrade = TRADES.map((t) => ({ trade: t, label: TRADE_LABEL[t], rules: rules.filter((r) => r.trade === t) })).filter((g) => g.rules.length);
  const groups = byTrade.map((g) => `      <section class="rules-group" id="${g.trade}" data-trade="${g.trade}">
        <h2>${escHtml(g.label)}</h2>
        <div class="rules-list">
${g.rules.map((r) => `          <a class="rule-row" href="${r.url}" data-trade="${r.trade}" data-kind="${r.kind}" data-status="${r.status}" data-used="${escAttr(r.used_by.join(' '))}" data-text="${escAttr((r.title + ' ' + r.summary + ' ' + r.id + ' ' + r.source.code + ' ' + r.source.section + ' ' + r.values.map((v) => v.when).join(' ')).toLowerCase())}">
            <div class="rule-row-main"><div class="rule-row-title">${escHtml(r.title)}</div><div class="rule-row-summary">${escHtml(r.summary)}</div></div>
            <div class="rule-row-meta"><span class="rule-kind rule-kind-${r.kind}">${KIND_LABEL[r.kind]}</span><span class="rule-row-source">${escHtml(r.source.code)} · ${escHtml(r.source.section.split(/[,;(]/)[0].trim())}</span>${r.status === 'draft' ? '<span class="rule-status rule-status-draft">Draft</span>' : ''}</div>
          </a>`).join('\n')}
        </div>
      </section>`).join('\n');
  const jsonLd = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'CountTooling Rules', description: 'Every public trade rule the app applies, as it applies it, with the section it comes from.', url: 'https://counttooling.com/rules/' }];
  const body = `    <header class="section-head rules-head">
      <h1>The rulebook</h1>
      <p>Every public trade rule the app applies, in the words it applies it — with the section it comes from. ${rules.length} rules across ${byTrade.length} trades. Company practice is not here; that lives with your pricing.</p>
    </header>
    <div class="rules-tools" role="search">
      <input type="search" id="rulesSearch" class="rules-search" placeholder="Search rules — hanger, fill, gauge…" aria-label="Search rules" autocomplete="off">
      <div class="rules-filters" id="rulesFilters" role="group" aria-label="Filter by trade">
        <button type="button" class="rules-filter active" data-filter="">All</button>
${byTrade.map((g) => `        <button type="button" class="rules-filter" data-filter="${g.trade}">${escHtml(g.label)}</button>`).join('\n')}
      </div>
    </div>
${groups}
    <p class="rules-empty" id="rulesEmpty" hidden>No rule matches. Try a material, a code section, or a number.</p>
    <p class="rules-foot">Same list, for software: <a href="/rules/rules.json"><code>/rules/rules.json</code></a>. Every value here is checked against the app's own tables on every build — a number cannot change in one place without the other.</p>
    <script>
      (function () {
        var q = document.getElementById('rulesSearch'), filters = document.getElementById('rulesFilters'), empty = document.getElementById('rulesEmpty');
        var rows = Array.prototype.slice.call(document.querySelectorAll('.rule-row'));
        var groups = Array.prototype.slice.call(document.querySelectorAll('.rules-group'));
        var trade = '';
        function apply() {
          var needle = (q.value || '').trim().toLowerCase();
          var shown = 0;
          rows.forEach(function (r) {
            var ok = (!trade || r.getAttribute('data-trade') === trade) && (!needle || r.getAttribute('data-text').indexOf(needle) !== -1);
            r.hidden = !ok; if (ok) shown++;
          });
          groups.forEach(function (g) { g.hidden = !g.querySelector('.rule-row:not([hidden])'); });
          empty.hidden = shown > 0;
        }
        q.addEventListener('input', apply);
        filters.addEventListener('click', function (e) {
          var b = e.target.closest('.rules-filter'); if (!b) return;
          trade = b.getAttribute('data-filter') || '';
          Array.prototype.forEach.call(filters.querySelectorAll('.rules-filter'), function (x) { x.classList.toggle('active', x === b); });
          apply();
        });
        if (location.hash && document.getElementById(location.hash.slice(1))) { trade = location.hash.slice(1); Array.prototype.forEach.call(filters.querySelectorAll('.rules-filter'), function (x) { x.classList.toggle('active', x.getAttribute('data-filter') === trade); }); apply(); }
      })();
    </script>`;
  return layout({ title: 'Rules — the public trade rules CountTooling applies', description: 'Every public trade rule the app applies, as it applies it, with the section it comes from — NEC, IPC, SMACNA — and which part of the app uses it.', slug: '/rules/', ogType: 'website', jsonLd }, body);
}

(async () => {
  const check = process.argv.slice(2).includes('--check');
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });
  const rules = loadRules();

  // The drift check runs in both modes: a rule and the code it points at must agree.
  const drift = driftCheck(rules);
  if (drift.problems.length) {
    console.error('Rulebook drift — a value in code no longer equals its rule (fix one or the other in the same commit):\n  - ' + drift.problems.join('\n  - '));
    process.exit(1);
  }

  const outputs = new Map();
  outputs.set(path.join(OUT_DIR, 'index.html'), indexPage(rules));
  for (const r of rules) outputs.set(path.join(OUT_DIR, r.trade, r.slug, 'index.html'), rulePage(r, marked));
  outputs.set(path.join(OUT_DIR, 'rules.json'), JSON.stringify({ generated: 'npm run build:rules', site: 'https://counttooling.com', rules: toJson(rules) }, null, 2) + '\n');

  if (check) {
    const stale = [];
    for (const [file, content] of outputs) {
      const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (cur !== content) stale.push(path.relative(ROOT, file));
    }
    if (stale.length) {
      console.error('Rules output is stale. Run `npm run build:rules` and commit:\n  - ' + stale.join('\n  - '));
      process.exit(1);
    }
    console.log(`Rules up to date (${rules.length} rules, ${drift.checked} values checked against code).`);
    return;
  }
  for (const [file, content] of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }
  console.log(`Wrote ${rules.length} rule page(s) + index + rules.json to ${path.relative(ROOT, OUT_DIR)}/ (${drift.checked} values checked against code).`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
