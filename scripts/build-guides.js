#!/usr/bin/env node
/**
 * Generates the evergreen Help/Guides section (/guides/) from Markdown sources, and
 * regenerates sitemap.xml. Mirrors the committed-artifact pattern of build-toc.js /
 * build-og-image.js — run it manually, commit the output; CI's --check fails if the
 * committed HTML is stale.
 *
 * Authoring: drop content/guides/<slug>.md with front-matter, then:
 *   npm run build:guides            # write guides/** + sitemap.xml
 *   npm run build:guides -- --check # exit non-zero if anything is stale (CI)
 *
 * Front-matter (between two --- lines), e.g.:
 *   ---
 *   title: How to do a takeoff from a PDF
 *   description: Upload a plan, set scale, count, measure, and export — in your browser.
 *   updated: 2026-06-09
 *   order: 1
 *   category: Getting started
 *   ---
 *   ## Markdown body...
 */
const fs = require('fs');
const path = require('path');
const { extractAppIcon } = require('./lib/app-icons');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://counttooling.com';
const CONTENT_DIR = path.join(ROOT, 'content', 'guides');
const OUT_DIR = path.join(ROOT, 'guides');
const OG_IMAGE = SITE + '/og-image.png';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RETICLE = `<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#e8c547"/><g fill="none" stroke="#161617" stroke-width="30" stroke-linecap="round"><circle cx="256" cy="256" r="118"/><line x1="256" y1="78" x2="256" y2="170"/><line x1="256" y1="342" x2="256" y2="434"/><line x1="78" y1="256" x2="170" y2="256"/><line x1="342" y1="256" x2="434" y2="256"/></g><circle cx="256" cy="256" r="34" fill="#161617"/></svg>`;

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
  if (!m) return String(iso || '');
  return `${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[1]}`;
}

// Minimal front-matter splitter: a leading `---\n ... \n---` block of `key: value` lines.
function parseFrontMatter(raw) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (kv) meta[kv[1].trim()] = kv[2].trim().replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2] };
}

// Inline button icons. Authors write [[set-scale]] etc. in Markdown; we expand it to an
// inline button-chip <span> containing the app's real toolbar SVG (extracted from
// app/index.html so the icons always match what the user sees).
const APP_HTML = path.join(ROOT, 'app', 'index.html');
const ICON_BTN = {
  move: 'moveBtn', 'set-scale': 'setScale', measure: 'measureBtn', highlight: 'highlightBtn',
  'multiply-zone': 'multiplyZoneBtn', 'scale-zone': 'scaleZoneBtn', 'delete-area': 'deleteZoneBtn',
  note: 'noteBtn', legend: 'legendBtn', grid: 'gridBtn', counter: 'counterBtn',
  line: 'quickLine', polyline: 'polylineBtn', 'hide-marks': 'hideMarksBtn', room: 'roomBtn',
  'save-status': 'saveStatusBtnHeader', share: 'headerShareBtn', 'drop-sizes': 'dropSizesBtn',
  // keys: the keypad glyph's ink spans 96..640 inside a 0 0 640 640 viewBox
  // (whitespace baked into the drawing), which rendered off-center in the
  // square icon chips — the vb override crops the viewBox to the ink.
  keys: { id: 'statusBarQuickKeys', vb: '96 96 544 544' }, macros: 'statusBarMacros',
  layers: 'canvasLayersBtn', undo: 'undoBtn',
  rotate: 'preparePdfRotate',
  // The header cloud control's button holds two svgs; the first is the
  // cloud-UPLOAD glyph (shown when no pages are loaded), which is the one the
  // regex extracts — but its title says "Export project", so override it.
  upload: { id: 'exportDropdownBtn', title: 'Upload PDF' },
};
function loadIcons() {
  const html = fs.readFileSync(APP_HTML, 'utf8');
  const icons = {};
  for (const [name, entry] of Object.entries(ICON_BTN)) {
    // Buttons carry id first; the status-bar links are <span>s with class before
    // id — extractAppIcon (scripts/lib/app-icons.js) accepts either element
    // with the id anywhere in the tag. An entry may be {id, title, vb} to
    // override the element's title attribute (chip label) and/or its svg
    // viewBox (recenter a glyph whose ink is offset inside its box).
    const { id, title, vb } = typeof entry === 'string' ? { id: entry, title: null, vb: null } : entry;
    const ic = extractAppIcon(html, id);
    if (!ic) { console.warn(`icon: element #${id} not found in app/index.html`); continue; }
    if (!ic.svg) { console.warn(`icon: svg for #${id} not found`); continue; }
    const titleM = /\btitle="([^"]*)"/.exec(ic.attrs);
    icons[name] = { title: (title || (titleM ? titleM[1] : name)).split('(')[0].trim(), viewBox: vb || ic.svg.viewBox, inner: ic.svg.inner };
  }
  return icons;
}

// --- learning paths -----------------------------------------------------------
// Ordered walks through existing articles. Each becomes a landing page at
// /guides/path/<slug>/, a card in the index's "Start here" section, and
// step-navigation on member articles. Steps reference article slugs; the build
// throws if one doesn't exist, so a renamed article can't silently break a path.
const PATHS = [
  {
    slug: 'basics', title: 'The Basics', icon: 'measure',
    blurb: 'Everything a first takeoff needs — upload to export, in order.',
    outcome: 'By the end you can take a plan PDF from upload to a priced-ready export: scale set and verified, fixtures counted, runs measured, mistakes fixed, and the numbers delivered.',
    steps: ['how-to-do-a-pdf-takeoff', 'preparing-a-plan-set', 'setting-the-scale', 'verifying-your-scale', 'counting-with-counters', 'measuring-runs-lines-and-polylines', 'fixing-mistakes', 'reports-and-exports'],
  },
  {
    slug: 'plumbing', title: 'Plumbing track', icon: 'polyline', prereq: 'basics',
    blurb: 'Fixture counting and pipe measuring, the plumbing way.',
    outcome: 'Build a plumbing palette fast, make the plan read like your trade, handle mixed-scale sheets, and run a full plumbing takeoff.',
    steps: ['quick-creators', 'custom-icons', 'scale-zones-and-multiply-zones', 'plumbing-takeoff'],
  },
  {
    slug: 'electrical', title: 'Electrical track', icon: 'counter', prereq: 'basics',
    blurb: 'Device counts, conduit runs, and typical floors.',
    outcome: 'Organize device counts by panel, multiply typical floors instead of recounting them, and keep both hands moving through a full electrical takeoff.',
    steps: ['organizing-a-busy-sheet', 'scale-zones-and-multiply-zones', 'electrical-takeoff', 'working-faster-with-the-keyboard'],
  },
  {
    slug: 'hvac', title: 'HVAC track', icon: 'room', prereq: 'basics',
    blurb: 'Room volumes first — then equipment and duct runs.',
    outcome: 'Turn rooms into areas and air volumes for sizing, then count equipment and measure duct runs across mixed-scale sheets.',
    steps: ['measuring-room-volumes', 'hvac-takeoff', 'scale-zones-and-multiply-zones'],
  },
  {
    slug: 'working-faster', title: 'Working faster', icon: 'keys', prereq: 'basics',
    blurb: 'The keyboard, quick creators, and a palette that follows you.',
    outcome: 'Set up the shortcuts, the number row, and a cloud palette so every new bid starts at full speed.',
    steps: ['working-faster-with-the-keyboard', 'quick-creators', 'artboard-and-palette-insights'],
  },
  {
    slug: 'field-and-team', title: 'On the job site & with your team', icon: 'share', prereq: 'basics',
    blurb: 'Offline, on a tablet, and shared without stepping on each other.',
    outcome: 'Install the app, work with no signal, mark up on a tablet, share projects safely, and know exactly how your work is saved.',
    steps: ['working-offline-and-installing', 'takeoff-on-a-tablet', 'sharing-and-view-links', 'how-your-work-is-saved'],
  },
];
// Render an extracted icon as a labeled chip/badge <span> with the given class.
function iconSpan(ic, cls) {
  return `<span class="${cls}" role="img" aria-label="${escAttr(ic.title)}" title="${escAttr(ic.title)}"><svg viewBox="${ic.viewBox}" aria-hidden="true">${ic.inner}</svg></span>`;
}
function applyIcons(md, icons) {
  return md.replace(/\[\[([a-z-]+)\]\]/g, (full, name) => {
    const ic = icons[name];
    if (!ic) { console.warn(`unknown icon shortcode [[${name}]]`); return full; }
    return iconSpan(ic, 'ico');
  });
}

function head({ title, description, slug, ogType, jsonLd }) {
  const url = SITE + slug;
  const ld = jsonLd.map((o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join('\n');
  return `  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escAttr(description)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="CountTooling">
  <meta property="og:title" content="${escAttr(title)}">
  <meta property="og:description" content="${escAttr(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escAttr(title)}">
  <meta name="twitter:description" content="${escAttr(description)}">
  <meta name="twitter:image" content="${OG_IMAGE}">
  <meta name="theme-color" content="#17171a">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect fill='%23e8c547' width='32' height='32' rx='4'/></svg>">
  <link rel="stylesheet" href="/vendor/fonts/fonts.css">
  <link rel="stylesheet" href="/marketing.css">
${ld}`;
}

const header = `  <header class="site-header">
    <div class="wrap site-header-wrap">
      <a class="logo" href="/">${RETICLE}<span>CountTooling</span></a>
      <nav class="site-nav">
        <a href="/guides/">Guides</a>
        <a class="btn" href="/app/"><span class="btn-label-full">Open the app</span><span class="btn-label-short">App</span></a>
      </nav>
    </div>
  </header>`;

const footer = `  <footer class="site-footer">
    <div class="wrap">
      <span>© 2026 CountTooling</span>
      <span class="fam">
        Part of the Tooling family:
        <a href="/guides/">Guides</a>
        <a href="https://pipetooling.com/" rel="noopener">PipeTooling</a>
        <a href="https://takeofftooling.com/" rel="noopener">TakeoffTooling</a>
        <a href="/app/">Open the app</a>
      </span>
    </div>
  </footer>`;

function layout(opts, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${head(opts)}
</head>
<body>
${header}
  <main class="wrap">
${bodyHtml}
  </main>
${footer}
</body>
</html>
`;
}

function breadcrumb(items) {
  const links = items.map((it, i) =>
    i === items.length - 1 ? `<span>${escHtml(it.name)}</span>` : `<a href="${it.url}">${escHtml(it.name)}</a>`
  ).join(' <span class="sep">›</span> ');
  return `    <nav class="breadcrumb" aria-label="Breadcrumb">${links}</nav>`;
}
function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.url })),
  };
}

// Step-navigation data for one article across every path that contains it.
// memberships: [{ path, step (1-based), total, prev: article|null, next: article|null }]
function pathNavData(memberships) {
  const byPath = {};
  for (const m of memberships) {
    byPath[m.path.slug] = {
      title: m.path.title,
      url: `/guides/path/${m.path.slug}/`,
      step: m.step, total: m.total,
      prev: m.prev ? { href: `/guides/${m.prev.slug}/?path=${m.path.slug}`, label: `← ${m.prev.title}` } : null,
      next: m.next ? { href: `/guides/${m.next.slug}/?path=${m.path.slug}`, label: `Next: ${m.next.title} →` } : null,
    };
  }
  return { primary: memberships[0].path.slug, byPath };
}

function articlePage(a, memberships) {
  const slug = `/guides/${a.slug}/`;
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Guides', url: '/guides/' }, { name: a.title, url: slug }];
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: a.title, description: a.description, image: OG_IMAGE,
      datePublished: a.updated, dateModified: a.updated,
      author: { '@type': 'Organization', name: 'CountTooling', url: SITE + '/' },
      publisher: { '@type': 'Organization', name: 'CountTooling', logo: { '@type': 'ImageObject', url: SITE + '/icons/icon-512.png' } },
      mainEntityOfPage: SITE + slug,
    },
    breadcrumbLd(crumbs),
  ];
  let pathBanner = '', pathNav = '', pathScript = '';
  if (memberships && memberships.length) {
    const nav = pathNavData(memberships);
    const p = nav.byPath[nav.primary];
    pathBanner = `    <div class="path-banner">Part of <a id="pathBannerLink" href="${p.url}">${escHtml(p.title)}</a><span id="pathBannerStep"> — step ${p.step} of ${p.total}</span></div>\n`;
    pathNav = `      <nav class="path-nav" aria-label="Learning path">
        <a class="path-nav-link" id="pathPrev"${p.prev ? ` href="${p.prev.href}"` : ' hidden'}>${p.prev ? escHtml(p.prev.label) : ''}</a>
        <a class="path-nav-all" id="pathAll" href="${p.url}">All steps</a>
        <a class="path-nav-link path-nav-next" id="pathNext"${p.next ? ` href="${p.next.href}"` : ' hidden'}>${p.next ? escHtml(p.next.label) : ''}</a>
      </nav>\n`;
    // Progressive enhancement: when the reader arrived from a non-primary path
    // (?path=<slug>), retarget the banner + prev/next to that path. Static
    // links (the primary path) remain correct without JS.
    pathScript = `      <script id="pathData" type="application/json">${JSON.stringify(nav)}</script>
      <script>(function () {
        var el = document.getElementById('pathData'); if (!el) return;
        var d; try { d = JSON.parse(el.textContent); } catch (_) { return; }
        var q = null; try { q = new URLSearchParams(location.search).get('path'); } catch (_) {}
        if (!q || q === d.primary || !d.byPath[q]) return;
        var m = d.byPath[q];
        var link = document.getElementById('pathBannerLink');
        if (link) { link.href = m.url; link.textContent = m.title; }
        var stepEl = document.getElementById('pathBannerStep');
        if (stepEl) stepEl.textContent = ' — step ' + m.step + ' of ' + m.total;
        var all = document.getElementById('pathAll'); if (all) all.href = m.url;
        function set(id, e) {
          var a = document.getElementById(id); if (!a) return;
          if (e) { a.hidden = false; a.href = e.href; a.textContent = e.label; }
          else { a.hidden = true; a.removeAttribute('href'); a.textContent = ''; }
        }
        set('pathPrev', m.prev); set('pathNext', m.next);
      })();</script>\n`;
  }
  const body = `${breadcrumb(crumbs)}
    <article class="article">
${pathBanner}      <h1>${escHtml(a.h1 || a.title)}</h1>
      <p class="article-meta">Last updated ${escHtml(fmtDate(a.updated))}</p>
      <div class="prose">
${a.bodyHtml}
      </div>
${pathNav}${pathScript}      <div class="article-foot">
        <a class="back-link" href="/guides/">← All guides</a>
        <a class="btn" href="/app/">Open the app</a>
      </div>
    </article>`;
  return layout({ title: `${a.title} — CountTooling`, description: a.description, slug, ogType: 'article', jsonLd: ld }, body);
}

function pathPage(p, stepArticles) {
  const slug = `/guides/path/${p.slug}/`;
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Guides', url: '/guides/' }, { name: p.title, url: slug }];
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `${p.title} — CountTooling learning path`, description: p.blurb,
      itemListElement: stepArticles.map((a, i) => ({ '@type': 'ListItem', position: i + 1, name: a.title, url: `${SITE}/guides/${a.slug}/` })),
    },
    breadcrumbLd(crumbs),
  ];
  const prereqP = PATHS.find((x) => x.slug === p.prereq);
  const prereqHtml = prereqP
    ? `      <p class="path-prereq">New here? Start with <a href="/guides/path/${prereqP.slug}/">${escHtml(prereqP.title)}</a> first — this track assumes it.</p>\n`
    : '';
  const steps = stepArticles.map((a, i) => `        <a class="path-step" href="/guides/${a.slug}/?path=${p.slug}">
          <span class="path-step-n">${i + 1}</span>
          <span class="path-step-body">
            <span class="path-step-head">${a.iconHtml}<span class="path-step-title">${escHtml(a.title)}</span></span>
            <span class="path-step-desc">${escHtml(a.description)}</span>
          </span>
        </a>`).join('\n');
  const body = `${breadcrumb(crumbs)}
    <section class="guides-hero">
      <h1>${escHtml(p.title)}</h1>
      <p>${escHtml(p.blurb)}</p>
    </section>
    <section class="path-page">
${prereqHtml}      <p class="path-outcome">${escHtml(p.outcome)}</p>
      <div class="path-steps">
${steps}
      </div>
      <div class="article-foot">
        <a class="back-link" href="/guides/">← All guides</a>
        <a class="btn" href="/guides/${stepArticles[0].slug}/?path=${p.slug}">Start step 1</a>
      </div>
    </section>`;
  return layout({ title: `${p.title} — CountTooling Guides`, description: p.blurb, slug, ogType: 'website', jsonLd: ld }, body);
}

function indexPage(articles, icons) {
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Guides', url: '/guides/' }];
  const pathCards = PATHS.map((p) => {
    const ic = icons[p.icon];
    const iconHtml = ic ? iconSpan(ic, 'guide-ico') : '';
    return `        <a class="guide-card path-card" href="/guides/path/${p.slug}/">
          <div class="guide-card-head">${iconHtml}<h3>${escHtml(p.title)}</h3></div>
          <p>${escHtml(p.blurb)}</p>
          <span class="guide-meta">${p.steps.length} steps</span>
        </a>`;
  }).join('\n');
  const cards = articles.map((a) => `        <a class="guide-card" href="/guides/${a.slug}/">
          <div class="guide-card-head">${a.iconHtml}<h2>${escHtml(a.title)}</h2></div>
          <p>${escHtml(a.description)}</p>
          <span class="guide-meta">Updated ${escHtml(fmtDate(a.updated))}</span>
        </a>`).join('\n');
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: 'CountTooling Guides', description: 'How-to guides and help for doing construction and plumbing takeoffs in CountTooling.',
      url: SITE + '/guides/',
    },
    breadcrumbLd(crumbs),
  ];
  const body = `${breadcrumb(crumbs)}
    <section class="guides-hero">
      <h1>Guides &amp; help</h1>
      <p>How to get the most out of CountTooling — from your first PDF takeoff to scale zones, reports, and exports.</p>
    </section>
    <section class="paths-section">
      <h2>Start here — pick a path</h2>
      <p class="paths-intro">New to CountTooling? Take <a href="/guides/path/basics/">The Basics</a>, then pick the track for your trade. Each path walks the guides below in order.</p>
      <div class="guides-list paths-list">
${pathCards}
      </div>
    </section>
    <h2 class="guides-all-heading">All guides</h2>
    <section class="guides-list">
${cards}
    </section>`;
  return layout({ title: 'Guides & Help — CountTooling', description: 'How-to guides and help for construction and plumbing takeoffs with CountTooling.', slug: '/guides/', ogType: 'website', jsonLd: ld }, body);
}

function sitemap(articles) {
  const urls = ['/', '/guides/', ...articles.map((a) => `/guides/${a.slug}/`), ...PATHS.map((p) => `/guides/path/${p.slug}/`)];
  const body = urls.map((u) => `  <url>\n    <loc>${SITE}${u}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${u === '/' ? '1.0' : '0.7'}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

(async () => {
  const check = process.argv.slice(2).includes('--check');
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });
  const icons = loadIcons();

  const files = fs.existsSync(CONTENT_DIR)
    ? fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    : [];
  const articles = files.map((file) => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const { meta, body } = parseFrontMatter(raw);
    if (!meta.title || !meta.description) throw new Error(`content/guides/${file}: front-matter needs "title" and "description"`);
    let iconHtml = '';
    if (meta.icon) {
      const ic = icons[meta.icon];
      if (ic) iconHtml = iconSpan(ic, 'guide-ico');
      else console.warn(`content/guides/${file}: unknown icon "${meta.icon}"`);
    }
    return {
      slug: file.replace(/\.md$/, ''),
      title: meta.title, h1: meta.h1, description: meta.description, iconHtml,
      updated: meta.updated || '', order: meta.order ? Number(meta.order) : 999,
      category: meta.category || '', bodyHtml: marked.parse(applyIcons(body, icons)).trim(),
    };
  }).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  // Resolve learning-path steps to articles (hard error on a dangling slug) and
  // index which paths each article belongs to, in PATHS order (first = primary).
  const bySlug = new Map(articles.map((a) => [a.slug, a]));
  const membershipsByArticle = new Map();
  for (const p of PATHS) {
    p.steps.forEach((slug, i) => {
      const a = bySlug.get(slug);
      if (!a) throw new Error(`PATHS: path "${p.slug}" step "${slug}" has no matching content/guides/${slug}.md`);
      if (!membershipsByArticle.has(slug)) membershipsByArticle.set(slug, []);
      membershipsByArticle.get(slug).push({
        path: p, step: i + 1, total: p.steps.length,
        prev: i > 0 ? bySlug.get(p.steps[i - 1]) : null,
        next: i < p.steps.length - 1 ? bySlug.get(p.steps[i + 1]) : null,
      });
    });
  }

  // Build the full set of expected files.
  const outputs = new Map();
  outputs.set(path.join(OUT_DIR, 'index.html'), indexPage(articles, icons));
  for (const a of articles) outputs.set(path.join(OUT_DIR, a.slug, 'index.html'), articlePage(a, membershipsByArticle.get(a.slug) || []));
  for (const p of PATHS) outputs.set(path.join(OUT_DIR, 'path', p.slug, 'index.html'), pathPage(p, p.steps.map((s) => bySlug.get(s))));
  outputs.set(path.join(ROOT, 'sitemap.xml'), sitemap(articles));

  if (check) {
    const stale = [];
    for (const [file, content] of outputs) {
      const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (cur !== content) stale.push(path.relative(ROOT, file));
    }
    if (stale.length) {
      console.error('Guides output is stale. Run `npm run build:guides` and commit:\n  - ' + stale.join('\n  - '));
      process.exit(1);
    }
    console.log(`Guides up to date (${articles.length} articles).`);
    return;
  }

  for (const [file, content] of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }
  console.log(`Wrote ${articles.length} guide article(s) + index + sitemap to ${path.relative(ROOT, OUT_DIR)}/.`);
})().catch((e) => { console.error(e); process.exit(1); });
