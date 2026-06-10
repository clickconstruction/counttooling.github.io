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
        <a class="btn" href="/app/">Open the app</a>
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

function articlePage(a) {
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
  const body = `${breadcrumb(crumbs)}
    <article class="article">
      <h1>${escHtml(a.h1 || a.title)}</h1>
      <p class="article-meta">Last updated ${escHtml(fmtDate(a.updated))}</p>
      <div class="prose">
${a.bodyHtml}
      </div>
      <div class="article-foot">
        <a class="back-link" href="/guides/">← All guides</a>
        <a class="btn" href="/app/">Open the app</a>
      </div>
    </article>`;
  return layout({ title: `${a.title} — CountTooling`, description: a.description, slug, ogType: 'article', jsonLd: ld }, body);
}

function indexPage(articles) {
  const crumbs = [{ name: 'Home', url: '/' }, { name: 'Guides', url: '/guides/' }];
  const cards = articles.map((a) => `        <a class="guide-card" href="/guides/${a.slug}/">
          <h2>${escHtml(a.title)}</h2>
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
    <section class="guides-list">
${cards}
    </section>`;
  return layout({ title: 'Guides & Help — CountTooling', description: 'How-to guides and help for construction and plumbing takeoffs with CountTooling.', slug: '/guides/', ogType: 'website', jsonLd: ld }, body);
}

function sitemap(articles) {
  const urls = ['/', '/guides/', ...articles.map((a) => `/guides/${a.slug}/`)];
  const body = urls.map((u) => `  <url>\n    <loc>${SITE}${u}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${u === '/' ? '1.0' : '0.7'}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

(async () => {
  const check = process.argv.slice(2).includes('--check');
  const { marked } = await import('marked');
  marked.setOptions({ gfm: true, breaks: false });

  const files = fs.existsSync(CONTENT_DIR)
    ? fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md')
    : [];
  const articles = files.map((file) => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
    const { meta, body } = parseFrontMatter(raw);
    if (!meta.title || !meta.description) throw new Error(`content/guides/${file}: front-matter needs "title" and "description"`);
    return {
      slug: file.replace(/\.md$/, ''),
      title: meta.title, h1: meta.h1, description: meta.description,
      updated: meta.updated || '', order: meta.order ? Number(meta.order) : 999,
      category: meta.category || '', bodyHtml: marked.parse(body).trim(),
    };
  }).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  // Build the full set of expected files.
  const outputs = new Map();
  outputs.set(path.join(OUT_DIR, 'index.html'), indexPage(articles));
  for (const a of articles) outputs.set(path.join(OUT_DIR, a.slug, 'index.html'), articlePage(a));
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
