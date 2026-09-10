/**
 * scripts/lib/site.js — the static-site chrome shared by the generators that
 * write marketing pages (build-guides.js → /guides/, build-rules.js → /rules/):
 * the <head> block (SEO meta + JSON-LD), the site header/footer, the page
 * layout, breadcrumbs, the minimal front-matter splitter, date formatting,
 * escaping, and the sitemap serializer. One copy, so the nav and the meta
 * can never drift between sections. No deps.
 */
const SITE = 'https://counttooling.com';
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
// (Rules use the richer subset in lib/rules.js; guides only need scalars.)
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
  const ld = (jsonLd || []).map((o) => `  <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n  </script>`).join('\n');
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
        <a href="/rules/">Rules</a>
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
        <a href="/rules/">Rules</a>
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

// sitemap.xml from root-relative URL paths ('/' gets priority 1.0).
function sitemapXml(urls) {
  const body = urls.map((u) => `  <url>\n    <loc>${SITE}${u}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${u === '/' ? '1.0' : '0.7'}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

module.exports = { SITE, OG_IMAGE, RETICLE, escAttr, escHtml, fmtDate, parseFrontMatter, head, header, footer, layout, breadcrumb, breadcrumbLd, sitemapXml };
