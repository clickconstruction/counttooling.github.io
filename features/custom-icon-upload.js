(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Custom icon upload (registry split #37) -- extracted from app.js: the
  // SVG parser (path/rect/circle/ellipse/line -> normalized path icon) and
  // the #customIconUploadInput handler that refreshes the three custom icon
  // grids (Create Counter, Quick Count, Details) after an upload.
  // The pure shape->path core lives in icon-render.js (svgShapeToPath,
  // node-tested); this file owns only the DOMParser walk and the DOM refresh.

  function parseUploadedSvg(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        try {
          const doc = new DOMParser().parseFromString(r.result, 'image/svg+xml');
          const svg = doc.querySelector('svg');
          if (!svg) { reject(new Error('Invalid SVG')); return; }
          const vb = svg.getAttribute('viewBox') || svg.getAttribute('viewbox') || '0 0 24 24';
          const paths = [];
          doc.querySelectorAll('path, rect, circle, ellipse, line').forEach(el => {
            const d = App.svgShapeToPath((el.tagName || '').toLowerCase(), (n) => el.getAttribute(n));
            if (d) paths.push(d);
          });
          const value = paths.join(' ');
          if (!value.trim()) { reject(new Error('SVG must contain at least one path, rect, circle, ellipse, or line.')); return; }
          const name = (file.name || 'icon').replace(/\.svg$/i, '') || 'Icon';
          resolve({ value, name, viewBox: vb });
        } catch (e) { reject(e); }
      };
      r.onerror = () => reject(new Error('Failed to read file'));
      r.readAsText(file);
    });
  }

  // One refresh for the paired built-in/custom grid pattern (previously three
  // near-verbatim blocks): rebuild the custom grid's cells, wire clicks
  // (upload cell re-opens the file picker; a pick clears BOTH grids'
  // selections before selecting), and optionally select the just-uploaded
  // icon. onPick(cell) runs after selection for surface-specific behavior.
  function refreshCustomGrid(gridEl, pairedGridSel, html, onPick) {
    gridEl.innerHTML = html;
    gridEl.querySelectorAll('.icon-cell').forEach(c => {
      c.onclick = () => {
        if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
        document.querySelectorAll(pairedGridSel + ' .icon-cell').forEach(x => x.classList.remove('selected'));
        gridEl.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
        c.classList.add('selected');
        if (onPick) onPick(c);
      };
    });
  }
  function selectUploadedIcon(gridEl, pairedGridSel, iconValue) {
    const cell = Array.from(gridEl.querySelectorAll('.icon-cell[data-path]')).find(c => c.dataset.path === iconValue);
    if (!cell) return null;
    document.querySelectorAll(pairedGridSel + ' .icon-cell').forEach(x => x.classList.remove('selected'));
    gridEl.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
    cell.classList.add('selected');
    return cell;
  }

  document.getElementById('customIconUploadInput').onchange = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    parseUploadedSvg(f).then((icon) => {
      const userIcons = App.getUserCustomIcons();
      userIcons.push(icon);
      App.saveUserCustomIcons(userIcons);
      App.markProjectDirty();
      const customGrid = document.getElementById('counterIconGridCustom');
      const detailsCustomGrid = document.getElementById('counterLineTypeDetailsIconGridCustom');
      const effectiveCustom = App.getEffectiveCustomIcons();
      const customCells = App.customIconCellsHtml(effectiveCustom);
      if (customGrid) {
        refreshCustomGrid(customGrid, '#counterIconGrid', customCells, (c) => {
          const path = c.dataset.path;
          if (path) {
            const nameEl = document.getElementById('counterName');
            if (!nameEl.value.trim()) nameEl.value = App.getIconName(path);
          }
        });
        if (selectUploadedIcon(customGrid, '#counterIconGrid', icon.value)) {
          const nameEl = document.getElementById('counterName');
          if (!nameEl.value.trim()) nameEl.value = icon.name;
        }
      }
      const counterQuickCountCustomGrid = document.getElementById('counterQuickCountIconGridCustom');
      if (counterQuickCountCustomGrid) {
        refreshCustomGrid(counterQuickCountCustomGrid, '#counterQuickCountIconGrid', customCells, () => {
          App.updateCounterQuickCountNamePreview();
        });
        if (selectUploadedIcon(counterQuickCountCustomGrid, '#counterQuickCountIconGrid', icon.value)) {
          App.updateCounterQuickCountNamePreview();
        }
      }
      if (detailsCustomGrid) {
        const item = App.getCounterLineTypeDetailsItem ? App.getCounterLineTypeDetailsItem() : null;
        const currentIcon = item?.icon || '';
        refreshCustomGrid(detailsCustomGrid, '#counterLineTypeDetailsIconGrid', App.customIconCellsHtml(effectiveCustom, currentIcon), (c) => {
          if (item) {
            App.pushUndoSnapshot();
            item.icon = c.dataset.path;
            App.markProjectDirty();
            App.updateUI();
            App.renderAnnotations();
          }
        });
        if (item && selectUploadedIcon(detailsCustomGrid, '#counterLineTypeDetailsIconGrid', icon.value)) {
          App.pushUndoSnapshot();
          item.icon = icon.value;
          App.markProjectDirty();
          App.updateUI();
          App.renderAnnotations();
        }
      }
      App.updateUI();
    }).catch((err) => {
      alert(err && err.message ? err.message : 'Invalid SVG. SVG must contain at least one path, rect, circle, ellipse, or line.');
    });
  };
})();
