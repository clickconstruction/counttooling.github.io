#!/usr/bin/env node
/**
 * Builds the CUSTOM_ICONS array from SVG files in my-counters/ (or --dir) and
 * writes it as the complete classic-script module icons-custom.js (loaded by
 * app/index.html between icons.js and icon-render.js). No paste step: rerun
 * and commit. See CUSTOM_ICONS.md.
 *
 * Usage: node scripts/build-custom-icons.js [--dir path/to/svgs] [--out file.js] [--stdout]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let dir = path.join(__dirname, '..', 'my-counters');
let outFile = path.join(__dirname, '..', 'icons-custom.js');
let toStdout = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' && args[i + 1]) {
    dir = args[i + 1];
    i++;
  } else if (args[i] === '--out' && args[i + 1]) {
    outFile = args[i + 1];
    i++;
  } else if (args[i] === '--stdout') {
    toStdout = true;
  }
}

function getAttr(tag, name) {
  const m = tag.match(new RegExp(name + '\\s*=\\s*["\']([^"\']*)["\']', 'i'));
  return m ? Number(m[1]) || 0 : 0;
}

function toPathFromTag(tag, tagName) {
  const t = (tagName || '').toLowerCase();
  if (t === 'path') {
    const d = tag.match(/d\s*=\s*["']([^"']+)["']/i);
    return d ? d[1] : null;
  }
  if (t === 'rect') {
    const x = getAttr(tag, 'x'), y = getAttr(tag, 'y');
    const w = getAttr(tag, 'width'), h = getAttr(tag, 'height');
    return 'M' + x + ' ' + y + ' L' + (x + w) + ' ' + y + ' L' + (x + w) + ' ' + (y + h) + ' L' + x + ' ' + (y + h) + ' Z';
  }
  if (t === 'circle') {
    const cx = getAttr(tag, 'cx'), cy = getAttr(tag, 'cy'), r = getAttr(tag, 'r');
    return 'M' + cx + ' ' + cy + ' m -' + r + ' 0 a ' + r + ' ' + r + ' 0 1 1 0 ' + (2 * r) + ' a ' + r + ' ' + r + ' 0 1 1 0 -' + (2 * r);
  }
  if (t === 'ellipse') {
    const cx = getAttr(tag, 'cx'), cy = getAttr(tag, 'cy');
    const rx = getAttr(tag, 'rx'), ry = getAttr(tag, 'ry');
    return 'M' + cx + ' ' + cy + ' m -' + rx + ' 0 a ' + rx + ' ' + ry + ' 0 1 1 0 ' + (2 * ry) + ' a ' + rx + ' ' + ry + ' 0 1 1 0 -' + (2 * ry);
  }
  if (t === 'line') {
    const x1 = getAttr(tag, 'x1'), y1 = getAttr(tag, 'y1');
    const x2 = getAttr(tag, 'x2'), y2 = getAttr(tag, 'y2');
    return 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2;
  }
  return null;
}

function parseSvg(content) {
  const vbMatch = content.match(/viewBox\s*=\s*["']([^"']+)["']/i) || content.match(/viewbox\s*=\s*["']([^"']+)["']/i);
  const viewBox = vbMatch ? vbMatch[1] : '0 0 24 24';
  const paths = [];
  const tagRegex = /<(path|rect|circle|ellipse|line)\s[^>]*\/?>/gi;
  let m;
  while ((m = tagRegex.exec(content)) !== null) {
    const d = toPathFromTag(m[0], m[1]);
    if (d) paths.push(d);
  }
  const value = paths.join(' ');
  return { viewBox, value };
}

function filenameToName(filename) {
  const base = filename.replace(/\.svg$/i, '').trim() || 'Icon';
  return base.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error('Directory not found:', dir);
  process.exit(1);
}

const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.svg')).sort();
const icons = [];

for (const file of files) {
  const filePath = path.join(dir, file);
  const content = fs.readFileSync(filePath, 'utf8');
  const { viewBox, value } = parseSvg(content);
  if (!value.trim()) {
    console.error('Skipping', file, '(no path/rect/circle/ellipse/line found)');
    continue;
  }
  const name = filenameToName(file);
  icons.push({ value, viewBox, name });
}

const arrayLiteral = JSON.stringify(icons, null, 2).replace(/"([^"]+)":/g, '$1:').replace(/\n/g, '\n  ');
const HEADER = [
  '/*',
  ' * icons-custom.js - the GENERATED bundled custom-icon data (CUSTOM_ICONS).',
  ' * Do not edit by hand: regenerate with `npm run build:icons`',
  ' * (scripts/build-custom-icons.js, sourced from my-counters/*.svg — see',
  ' * CUSTOM_ICONS.md). Splitting this out of icons.js means regenerations no',
  ' * longer churn a 246KB file: the generator overwrites THIS file wholesale.',
  ' *',
  ' * Classic <script src> loaded between icons.js and icon-render.js (which',
  ' * builds CUSTOM_ICON_META from CUSTOM_ICONS at parse time). The guarded',
  ' * CommonJS footer (inert in the browser) lets the Node tests and',
  ' * eslint.config.js derive CUSTOM_ICONS as a readonly global.',
  ' */',
].join('\n');
const FOOTER = [
  '',
  '  // Node test/tooling harness only (see icons.js footer for the pattern).',
  "  if (typeof module !== 'undefined' && module.exports) {",
  '    module.exports = { CUSTOM_ICONS };',
  '  }',
  '',
].join('\n');
const output = HEADER + '\n  const CUSTOM_ICONS = ' + arrayLiteral + ';\n' + FOOTER;

if (!toStdout) {
  const outPath = path.isAbsolute(outFile) ? outFile : path.join(process.cwd(), outFile);
  fs.writeFileSync(outPath, output, 'utf8');
  console.log('Wrote', icons.length, 'icons to', outPath);
} else {
  console.log(output);
}
