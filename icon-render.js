/*
 * icon-render.js - Pure icon geometry / render-rule helpers for ClickCount,
 * extracted from the main app.js IIFE.
 *
 * Loaded as a classic <script src="icon-render.js"> in <head>, AFTER icons.js
 * (whose CUSTOM_ICONS / VB_384_512_PATHS / FA_PATHS globals it reads by bare
 * name) and BEFORE app.js. These top-level declarations live in the shared
 * global lexical scope.
 *
 * Boundary rule: this module depends ONLY on icons.js globals + its arguments.
 * The runtime user-icon cache (customIconsCache / getEffectiveCustomIcons) and
 * the published window.renderIconHtml API stay in app.js as same-named thin
 * wrappers that supply the live effective-icons list and resolved viewBox to
 * the pure *FromList / *Rule / iconSvgHtml primitives exported here (same
 * pure-primitives + thin-wrappers split as idb.js). No build step.
 */

  // Built-in custom-icon metadata table (center + max viewBox dimension),
  // derived once from the bundled CUSTOM_ICONS. Pure given icons.js. The
  // typeof guard keeps module load side-effect-free where CUSTOM_ICONS is not
  // yet a global (Node `require` for eslint's export enumeration); the browser
  // (icons.js loaded first) and the unit test (globalThis assign before require)
  // both supply the real array.
  const CUSTOM_ICON_META = Object.fromEntries(((typeof CUSTOM_ICONS !== 'undefined' ? CUSTOM_ICONS : [])).map(ic => {
    const parts = ic.viewBox.split(/\s+/);
    const w = Number(parts[2]) || 640, h = Number(parts[3]) || 640;
    return [ic.value, { center: { x: w / 2, y: h / 2 }, vb: Math.max(w, h) }];
  }));

  // Resolve a path's {center, vb} from the built-in table, else from a supplied
  // effective-icons list (built-in + user). Pure: the caller injects `icons`.
  function iconMetaFromList(path, icons) {
    if (CUSTOM_ICON_META[path]) return CUSTOM_ICON_META[path];
    const ic = (icons || []).find(i => i.value === path);
    if (!ic) return null;
    const parts = (ic.viewBox || '0 0 24 24').split(/\s+/);
    const minX = Number(parts[0]) || 0, minY = Number(parts[1]) || 0, w = Number(parts[2]) || 24, h = Number(parts[3]) || 24;
    return { center: { x: minX + w / 2, y: minY + h / 2 }, vb: Math.max(w, h) };
  }

  // Resolve a path's raw viewBox string from a supplied effective-icons list.
  function iconViewBoxFromList(path, icons) {
    const ic = (icons || []).find(i => i.value === path);
    return ic ? ic.viewBox : null;
  }

  // Shared icon-render rules (single source of truth for viewBox/center fallbacks).
  function iconRenderVbRule(meta, path) {
    return meta?.vb || (VB_384_512_PATHS.includes(path) ? 512 : (FA_PATHS.includes(path) ? 512 : 640));
  }
  function iconRenderCenterRule(meta, path) {
    return meta?.center || (VB_384_512_PATHS.includes(path) ? { x: 192, y: 256 } : { x: (FA_PATHS.includes(path) ? 512 : 640) / 2, y: (FA_PATHS.includes(path) ? 512 : 640) / 2 });
  }
  function iconViewBoxStringRule(viewBox, path) {
    return viewBox || (VB_384_512_PATHS.includes(path) ? '0 0 384 512' : FA_PATHS.includes(path) ? '0 0 512 512' : '0 0 640 640');
  }

  // Build a 24x24 SVG markup string for an icon path, given its resolved viewBox.
  function iconSvgHtml(iconValue, color, viewBoxString) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + viewBoxString + '" width="24" height="24"><path fill="' + (color || '#e8c547') + '" d="' + iconValue + '"/></svg>';
  }

  // Icon-picker grid cells: the single source for the cell markup that was
  // copy-pasted across counter.js / item-details.js / quick-modals.js /
  // custom-icon-upload.js. Pure string builders — callers wire the clicks
  // (each picker's selection-clearing pairs and pick callbacks differ).
  const ICON_UPLOAD_CELL_HTML = '<div class="icon-cell icon-cell-upload" data-upload="1" title="Upload SVG">+</div>';
  function iconCellHtml(pathValue, viewBox, selected) {
    return '<div class="icon-cell' + (selected ? ' selected' : '') + '" data-path="' + pathValue + '"><svg viewBox="' + viewBox + '" width="24" height="24"><path fill="currentColor" d="' + pathValue + '"/></svg></div>';
  }
  // Built-in grid: vbFor(value) resolves the viewBox (the caller injects the
  // cache-coupled App.iconVbFor); isSelected(ic, i) marks the selected cell.
  function iconGridCellsHtml(icons, vbFor, isSelected) {
    return icons.map((ic, i) => iconCellHtml(ic.value, vbFor(ic.value), !!(isSelected && isSelected(ic, i)))).join('');
  }
  // Custom grid: always leads with the upload cell; each custom icon carries
  // its own viewBox. selectedValue (optional) marks the matching cell.
  function customIconCellsHtml(effectiveCustom, selectedValue) {
    return ICON_UPLOAD_CELL_HTML + effectiveCustom.map((ic) => iconCellHtml(ic.value, ic.viewBox, ic.value === selectedValue)).join('');
  }


// The SVG-shape -> path-data converter behind custom icon upload
// (features/custom-icon-upload.js walks the uploaded document with DOMParser
// and feeds each shape element here). Pure: `attr` is a lookup function
// (name -> string|null), so Node tests need no DOM. Returns null for
// unsupported tags / a path with no data.
function svgShapeToPath(tag, attr) {
  if (tag === 'path' && attr('d')) return attr('d');
  if (tag === 'rect') {
    const x = Number(attr('x')) || 0, y = Number(attr('y')) || 0, w = Number(attr('width')) || 0, h = Number(attr('height')) || 0;
    return 'M' + x + ' ' + y + ' L' + (x + w) + ' ' + y + ' L' + (x + w) + ' ' + (y + h) + ' L' + x + ' ' + (y + h) + ' Z';
  }
  if (tag === 'circle') {
    const cx = Number(attr('cx')) || 0, cy = Number(attr('cy')) || 0, r = Number(attr('r')) || 0;
    return 'M' + cx + ' ' + cy + ' m -' + r + ' 0 a ' + r + ' ' + r + ' 0 1 1 0 ' + (2 * r) + ' a ' + r + ' ' + r + ' 0 1 1 0 -' + (2 * r);
  }
  if (tag === 'ellipse') {
    const cx = Number(attr('cx')) || 0, cy = Number(attr('cy')) || 0, rx = Number(attr('rx')) || 0, ry = Number(attr('ry')) || 0;
    return 'M' + cx + ' ' + cy + ' m -' + rx + ' 0 a ' + rx + ' ' + ry + ' 0 1 1 0 ' + (2 * ry) + ' a ' + rx + ' ' + ry + ' 0 1 1 0 -' + (2 * ry);
  }
  if (tag === 'line') {
    const x1 = Number(attr('x1')) || 0, y1 = Number(attr('y1')) || 0, x2 = Number(attr('x2')) || 0, y2 = Number(attr('y2')) || 0;
    return 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2;
  }
  return null;
}


  // Node test harness only: in a classic browser <script> `module` is undefined,
  // so this is a no-op there and the declarations above stay plain globals.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      CUSTOM_ICON_META,
      iconMetaFromList,
      iconViewBoxFromList,
      iconRenderVbRule,
      iconRenderCenterRule,
      iconViewBoxStringRule,
      iconSvgHtml,
      ICON_UPLOAD_CELL_HTML,
      iconCellHtml,
      iconGridCellsHtml,
      customIconCellsHtml,
      svgShapeToPath,
    };
  }
