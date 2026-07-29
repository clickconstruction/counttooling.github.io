(function () {
  'use strict';
  const App = (window.App = window.App || {});

  // Custom icon upload (registry split #37) -- extracted from app.js: the
  // SVG parser (path/rect/circle/ellipse/line -> normalized path icon) and
  // the #customIconUploadInput handler that refreshes the four custom icon
  // grids (Create Counter, Plumbing, Quick Count, Details) after an upload.

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
          function toPath(el) {
            const tag = (el.tagName || '').toLowerCase();
            if (tag === 'path' && el.getAttribute('d')) return el.getAttribute('d');
            if (tag === 'rect') {
              const x = Number(el.getAttribute('x')) || 0, y = Number(el.getAttribute('y')) || 0, w = Number(el.getAttribute('width')) || 0, h = Number(el.getAttribute('height')) || 0;
              return 'M' + x + ' ' + y + ' L' + (x + w) + ' ' + y + ' L' + (x + w) + ' ' + (y + h) + ' L' + x + ' ' + (y + h) + ' Z';
            }
            if (tag === 'circle') {
              const cx = Number(el.getAttribute('cx')) || 0, cy = Number(el.getAttribute('cy')) || 0, r = Number(el.getAttribute('r')) || 0;
              return 'M' + cx + ' ' + cy + ' m -' + r + ' 0 a ' + r + ' ' + r + ' 0 1 1 0 ' + (2 * r) + ' a ' + r + ' ' + r + ' 0 1 1 0 -' + (2 * r);
            }
            if (tag === 'ellipse') {
              const cx = Number(el.getAttribute('cx')) || 0, cy = Number(el.getAttribute('cy')) || 0, rx = Number(el.getAttribute('rx')) || 0, ry = Number(el.getAttribute('ry')) || 0;
              return 'M' + cx + ' ' + cy + ' m -' + rx + ' 0 a ' + rx + ' ' + ry + ' 0 1 1 0 ' + (2 * ry) + ' a ' + rx + ' ' + ry + ' 0 1 1 0 -' + (2 * ry);
            }
            if (tag === 'line') {
              const x1 = Number(el.getAttribute('x1')) || 0, y1 = Number(el.getAttribute('y1')) || 0, x2 = Number(el.getAttribute('x2')) || 0, y2 = Number(el.getAttribute('y2')) || 0;
              return 'M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2;
            }
            return null;
          }
          doc.querySelectorAll('path, rect, circle, ellipse, line').forEach(el => {
            const d = toPath(el);
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
      const uploadCell = '<div class="icon-cell icon-cell-upload" data-upload="1" title="Upload SVG">+</div>';
      const iconCells = effectiveCustom.map((ic) => '<div class="icon-cell" data-path="' + ic.value + '"><svg viewBox="' + ic.viewBox + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>').join('');
      if (customGrid) {
        customGrid.innerHTML = uploadCell + iconCells;
        customGrid.querySelectorAll('.icon-cell').forEach(c => {
          c.onclick = () => {
            if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
            document.querySelectorAll('#counterIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
            customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
            c.classList.add('selected');
            const path = c.dataset.path;
            if (path) {
              const nameEl = document.getElementById('counterName');
              if (!nameEl.value.trim()) nameEl.value = App.getIconName(path);
            }
          };
        });
        const newIconCell = Array.from(customGrid.querySelectorAll('.icon-cell[data-path]')).find(c => c.dataset.path === icon.value);
        if (newIconCell) {
          document.querySelectorAll('#counterIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
          customGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          newIconCell.classList.add('selected');
          const nameEl = document.getElementById('counterName');
          if (!nameEl.value.trim()) nameEl.value = icon.name;
        }
      }
      const plumCustomGrid = document.getElementById('plumIconGridCustom');
      if (plumCustomGrid) {
        plumCustomGrid.innerHTML = uploadCell + iconCells;
        plumCustomGrid.querySelectorAll('.icon-cell').forEach(c => {
          c.onclick = () => {
            if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
            document.querySelectorAll('#plumIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
            plumCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
            c.classList.add('selected');
          };
        });
        const newIconCellPlum = Array.from(plumCustomGrid.querySelectorAll('.icon-cell[data-path]')).find(c => c.dataset.path === icon.value);
        if (newIconCellPlum) {
          document.querySelectorAll('#plumIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
          plumCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          newIconCellPlum.classList.add('selected');
        }
      }
      const counterQuickCountCustomGrid = document.getElementById('counterQuickCountIconGridCustom');
      if (counterQuickCountCustomGrid) {
        counterQuickCountCustomGrid.innerHTML = uploadCell + iconCells;
        counterQuickCountCustomGrid.querySelectorAll('.icon-cell').forEach(c => {
          c.onclick = () => {
            if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
            document.querySelectorAll('#counterQuickCountIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
            counterQuickCountCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
            c.classList.add('selected');
            App.updateCounterQuickCountNamePreview();
          };
        });
        const newIconCellQC = Array.from(counterQuickCountCustomGrid.querySelectorAll('.icon-cell[data-path]')).find(c => c.dataset.path === icon.value);
        if (newIconCellQC) {
          document.querySelectorAll('#counterQuickCountIconGrid .icon-cell').forEach(x => x.classList.remove('selected'));
          counterQuickCountCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          newIconCellQC.classList.add('selected');
          App.updateCounterQuickCountNamePreview();
        }
      }
      if (detailsCustomGrid) {
        const grid = document.getElementById('counterLineTypeDetailsIconGrid');
        const item = App.getCounterLineTypeDetailsItem ? App.getCounterLineTypeDetailsItem() : null;
        const currentIcon = item?.icon || '';
        const iconCellsDetails = effectiveCustom.map((ic) => {
          const sel = ic.value === currentIcon ? ' selected' : '';
          return '<div class="icon-cell' + sel + '" data-path="' + ic.value + '"><svg viewBox="' + ic.viewBox + '" width="24" height="24"><path fill="currentColor" d="' + ic.value + '"/></svg></div>';
        }).join('');
        detailsCustomGrid.innerHTML = uploadCell + iconCellsDetails;
        detailsCustomGrid.querySelectorAll('.icon-cell').forEach(c => {
          c.onclick = () => {
            if (c.dataset.upload) { document.getElementById('customIconUploadInput').click(); return; }
            if (grid) grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
            detailsCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
            c.classList.add('selected');
            if (item) {
              App.pushUndoSnapshot();
              item.icon = c.dataset.path;
              App.markProjectDirty();
              App.updateUI();
              App.renderAnnotations();
            }
          };
        });
        const newIconCellDetails = Array.from(detailsCustomGrid.querySelectorAll('.icon-cell[data-path]')).find(c => c.dataset.path === icon.value);
        if (newIconCellDetails && item) {
          if (grid) grid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          detailsCustomGrid.querySelectorAll('.icon-cell').forEach(x => x.classList.remove('selected'));
          newIconCellDetails.classList.add('selected');
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
