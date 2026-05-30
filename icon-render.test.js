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
Object.assign(globalThis, icons);
const ir = require('./icon-render.js');

test('CUSTOM_ICON_META: derives center + max-dimension vb for a bundled icon', () => {
  const first = icons.CUSTOM_ICONS[0];
  const parts = first.viewBox.split(/\s+/);
  const w = Number(parts[2]), h = Number(parts[3]);
  const meta = ir.CUSTOM_ICON_META[first.value];
  assert.ok(meta, 'expected a metadata entry for the first bundled icon');
  assert.deepStrictEqual(meta.center, { x: w / 2, y: h / 2 });
  assert.strictEqual(meta.vb, Math.max(w, h));
});

test('iconMetaFromList: CUSTOM_ICON_META fast path wins', () => {
  const first = icons.CUSTOM_ICONS[0];
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
