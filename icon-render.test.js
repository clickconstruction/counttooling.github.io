// Node unit tests for the pure icon-render helpers in icon-render.js.
// Run with: npm run test:unit  (uses the built-in node:test runner; no deps)
//
// icon-render.js references CUSTOM_ICONS / VB_384_512_PATHS / FA_PATHS by bare
// name (icons.js globals in the browser), so we copy icons.js onto the global
// object BEFORE requiring icon-render.js (so its CUSTOM_ICON_META table builds
// from the real bundled icons). Assertions reference the icon data via the
// `icons` handle to keep the test's own lint group free of those globals.
const test = require('node:test');
const assert = require('node:assert');
const icons = require('./icons.js');
const customIcons = require('./icons-custom.js');   // CUSTOM_ICONS (generated, split file)
Object.assign(globalThis, customIcons);
Object.assign(globalThis, icons);
const ir = require('./icon-render.js');

test('CUSTOM_ICON_META: derives center + max-dimension vb for a bundled icon', () => {
  const first = customIcons.CUSTOM_ICONS[0];
  const parts = first.viewBox.split(/\s+/);
  const w = Number(parts[2]), h = Number(parts[3]);
  const meta = ir.CUSTOM_ICON_META[first.value];
  assert.ok(meta, 'expected a metadata entry for the first bundled icon');
  assert.deepStrictEqual(meta.center, { x: w / 2, y: h / 2 });
  assert.strictEqual(meta.vb, Math.max(w, h));
});

test('iconMetaFromList: CUSTOM_ICON_META fast path wins', () => {
  const first = customIcons.CUSTOM_ICONS[0];
  // Even with an empty injected list, the built-in table resolves it.
  assert.deepStrictEqual(ir.iconMetaFromList(first.value, []), ir.CUSTOM_ICON_META[first.value]);
});

test('iconMetaFromList: parses an injected (user) icon viewBox with min offsets', () => {
  const list = [{ value: 'USER_PATH', viewBox: '10 20 100 200' }];
  // minX=10, minY=20, w=100, h=200 -> center {60,120}, vb 200
  assert.deepStrictEqual(ir.iconMetaFromList('USER_PATH', list), { center: { x: 60, y: 120 }, vb: 200 });
});

test('iconMetaFromList: unknown path -> null', () => {
  assert.strictEqual(ir.iconMetaFromList('NOPE', [{ value: 'OTHER', viewBox: '0 0 24 24' }]), null);
});

test('iconViewBoxFromList: found -> viewBox string, missing -> null', () => {
  const list = [{ value: 'USER_PATH', viewBox: '0 0 48 48' }];
  assert.strictEqual(ir.iconViewBoxFromList('USER_PATH', list), '0 0 48 48');
  assert.strictEqual(ir.iconViewBoxFromList('NOPE', list), null);
});

test('iconRenderVbRule: meta vb wins; FA/VB_384_512 -> 512; default -> 640', () => {
  assert.strictEqual(ir.iconRenderVbRule({ vb: 999 }, 'anything'), 999);
  assert.strictEqual(ir.iconRenderVbRule(null, icons.FA_PATHS[0]), 512);
  assert.strictEqual(ir.iconRenderVbRule(null, icons.VB_384_512_PATHS[0]), 512);
  assert.strictEqual(ir.iconRenderVbRule(null, 'M0 0'), 640);
});

test('iconRenderCenterRule: meta center wins; per-list fallbacks; default 320,320', () => {
  assert.deepStrictEqual(ir.iconRenderCenterRule({ center: { x: 1, y: 2 } }, 'anything'), { x: 1, y: 2 });
  assert.deepStrictEqual(ir.iconRenderCenterRule(null, icons.VB_384_512_PATHS[0]), { x: 192, y: 256 });
  assert.deepStrictEqual(ir.iconRenderCenterRule(null, icons.FA_PATHS[0]), { x: 256, y: 256 });
  assert.deepStrictEqual(ir.iconRenderCenterRule(null, 'M0 0'), { x: 320, y: 320 });
});

test('iconViewBoxStringRule: explicit viewBox wins; per-list + default fallbacks', () => {
  assert.strictEqual(ir.iconViewBoxStringRule('0 0 10 10', 'anything'), '0 0 10 10');
  assert.strictEqual(ir.iconViewBoxStringRule(null, icons.VB_384_512_PATHS[0]), '0 0 384 512');
  assert.strictEqual(ir.iconViewBoxStringRule(null, icons.FA_PATHS[0]), '0 0 512 512');
  assert.strictEqual(ir.iconViewBoxStringRule(null, 'M0 0'), '0 0 640 640');
});

test('iconSvgHtml: embeds viewBox + path d; default color when omitted', () => {
  const html = ir.iconSvgHtml('M1 2 L3 4', '#abcdef', '0 0 24 24');
  assert.ok(html.includes('viewBox="0 0 24 24"'));
  assert.ok(html.includes('d="M1 2 L3 4"'));
  assert.ok(html.includes('fill="#abcdef"'));
  assert.ok(ir.iconSvgHtml('M0 0', undefined, '0 0 640 640').includes('fill="#e8c547"'));
});

test('svgShapeToPath converts each supported shape and rejects the rest', () => {
  const attrs = (o) => (n) => (o[n] != null ? String(o[n]) : null);
  assert.strictEqual(ir.svgShapeToPath('path', attrs({ d: 'M0 0 L1 1' })), 'M0 0 L1 1');
  assert.strictEqual(ir.svgShapeToPath('path', attrs({})), null);
  assert.strictEqual(ir.svgShapeToPath('rect', attrs({ x: 1, y: 2, width: 3, height: 4 })), 'M1 2 L4 2 L4 6 L1 6 Z');
  assert.strictEqual(ir.svgShapeToPath('rect', attrs({})), 'M0 0 L0 0 L0 0 L0 0 Z');   // missing attrs coerce to 0
  assert.strictEqual(ir.svgShapeToPath('circle', attrs({ cx: 5, cy: 5, r: 2 })), 'M5 5 m -2 0 a 2 2 0 1 1 0 4 a 2 2 0 1 1 0 -4');
  assert.strictEqual(ir.svgShapeToPath('ellipse', attrs({ cx: 5, cy: 5, rx: 2, ry: 3 })), 'M5 5 m -2 0 a 2 3 0 1 1 0 6 a 2 3 0 1 1 0 -6');
  assert.strictEqual(ir.svgShapeToPath('line', attrs({ x1: 0, y1: 1, x2: 2, y2: 3 })), 'M0 1 L2 3');
  assert.strictEqual(ir.svgShapeToPath('polygon', attrs({ points: '0,0 1,1' })), null);
  assert.strictEqual(ir.svgShapeToPath('g', attrs({})), null);
});

test('iconCellHtml: cell markup with viewBox, path, and optional selection', () => {
  const html = ir.iconCellHtml('M0 0h24v24H0z', '0 0 24 24', false);
  assert.strictEqual(html, '<div class="icon-cell" data-path="M0 0h24v24H0z"><svg viewBox="0 0 24 24" width="24" height="24"><path fill="currentColor" d="M0 0h24v24H0z"/></svg></div>');
  assert.match(ir.iconCellHtml('M0 0', '0 0 24 24', true), /class="icon-cell selected"/);
});

test('iconGridCellsHtml: maps icons through vbFor and the isSelected predicate', () => {
  const iconsList = [{ value: 'A' }, { value: 'B' }];
  const html = ir.iconGridCellsHtml(iconsList, (v) => '0 0 ' + v.length + ' 10', (ic, i) => i === 1);
  assert.match(html, /data-path="A"/);
  assert.match(html, /viewBox="0 0 1 10"/);
  assert.strictEqual((html.match(/icon-cell selected/g) || []).length, 1);
  assert.match(html, /class="icon-cell selected" data-path="B"/);
  // No predicate -> nothing selected.
  assert.doesNotMatch(ir.iconGridCellsHtml(iconsList, () => '0 0 24 24'), /selected/);
});

test('customIconCellsHtml: leads with the upload cell; selects by value', () => {
  const custom = [{ value: 'C1', viewBox: '0 0 10 10' }, { value: 'C2', viewBox: '0 0 20 20' }];
  const html = ir.customIconCellsHtml(custom, 'C2');
  assert.ok(html.startsWith(ir.ICON_UPLOAD_CELL_HTML));
  assert.match(html, /class="icon-cell selected" data-path="C2"/);
  assert.match(html, /viewBox="0 0 20 20"/);
  // No selectedValue -> only the upload cell precedes unselected cells.
  assert.doesNotMatch(ir.customIconCellsHtml(custom), /icon-cell selected/);
});
