// Every label the app shell can show as a control's name: its text, a title or an
// aria-label, read from app/index.html with scripts removed. Shared by teaching-labels.test.js
// (a tour's [[chip]] must be one of these) and scripts/persona-manifest.js (labels.json, the
// persona text pass's "the card names a control that is not there" check), 2026-09-25.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function shellLabels(root = ROOT) {
  const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
  const out = new Set();
  decode(html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '\n')).split('\n').forEach((s) => { const t = s.trim(); if (t) out.add(t); });
  for (const m of html.matchAll(/(?:title|aria-label)="([^"]*)"/g)) out.add(decode(m[1]).trim());
  return out;
}

module.exports = { shellLabels, decode };
