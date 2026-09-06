/*
 * features/duct-size-popover.js — the Duct step-size popover (DUCT-PLAN.md
 * unit D2). Owned by D2; D6/D8/D9 EXTEND it — see the extension seam below.
 *
 * The surface: a small anchored (#ductSizePopover, position:fixed, clamped by
 * App.placeFixedMenu) popover opened while a duct trace is in progress by `S`,
 * a tap on the cursor size chip, or the finish-bar Size button. It shows the
 * current size and a stack of SECTIONS; picking a size routes through
 * App.applyDuctSizeStep (features/duct-tool.js — the popover never touches
 * the draft directly).
 *
 * EXTENSION SEAM — App.registerDuctPopoverSection(section):
 *   section = {
 *     id:     unique string ('step-grid', 'custom-size', …),
 *     order:  number — sections render into #ductSizeSections sorted ascending
 *             (D2 ships 'step-grid' @10 and 'custom-size' @20; suggested slots:
 *             D6 ductulator suggestion @5 — above the grid, it IS the answer;
 *             D8 rise/drop + round-first dual sizes @30; D9 depth line @40),
 *     render(container, ctx) — build the section's DOM into `container` (a
 *             fresh .duct-popover-section div). ctx = {
 *               currentSize,          // duct-model size object ({kind,…})
 *               draft,                // the live drawingDuct draft (read-only by convention)
 *               applySize(size),      // commit a step and close the popover
 *               close(),              // close without stepping
 *               requestRender(),      // re-render every section in place
 *             }. Return false to skip the section this open (e.g. D6 with no
 *             CFM data); anything else keeps it.
 *   }
 * Registration replaces an existing section with the same id (idempotent
 * feature-file reloads). Sections re-render on every open, so they can read
 * live draft state without their own sync hooks.
 *
 * Step-down candidates (D2 'derive sensible candidates'): rect reduces the
 * LARGER side by 2/4/6" and both sides by 2" (odd results rounded down to
 * even — shop sizes are even; floor 4"); round steps 2/4/6" down (floor 4").
 * Boundary rule: read shared deps from App.* at call time. See ARCHITECTURE.md
 * "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  let wired = false;
  let open = false;
  const sections = [];

  function registerDuctPopoverSection(section) {
    if (!section || !section.id || typeof section.render !== 'function') return;
    const i = sections.findIndex((s) => s.id === section.id);
    if (i >= 0) sections[i] = section;
    else sections.push(section);
    sections.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  // --- step-down candidates -------------------------------------------------

  function evenDown(v) { return v % 2 ? v - 1 : v; }

  function ductStepDownCandidates(size) {
    if (!size) return [];
    const out = [];
    const push = (s) => {
      if (!isDuctSize(s)) return;
      const key = formatDuctSize(s);
      if (key === formatDuctSize(size)) return;
      if (!out.some((o) => formatDuctSize(o) === key)) out.push(s);
    };
    if (size.kind === 'round') {
      [2, 4, 6].forEach((by) => { const d = evenDown(size.d - by); if (d >= 4) push(makeRoundSize(d)); });
    } else {
      const reduceLarger = (by) => {
        const w = size.w >= size.h ? evenDown(size.w - by) : size.w;
        const h = size.w >= size.h ? size.h : evenDown(size.h - by);
        if (Math.min(w, h) >= 4) push(makeRectSize(w, h));
      };
      [2, 4, 6].forEach(reduceLarger);
      const bw = evenDown(size.w - 2), bh = evenDown(size.h - 2);
      if (Math.min(bw, bh) >= 4) push(makeRectSize(bw, bh));
      const bw4 = evenDown(size.w - 4), bh4 = evenDown(size.h - 4);
      if (Math.min(bw4, bh4) >= 4) push(makeRectSize(bw4, bh4));
    }
    return out.slice(0, 6);
  }

  // --- base sections (D2) ---------------------------------------------------

  registerDuctPopoverSection({
    id: 'step-grid',
    order: 10,
    render(container, ctx) {
      const candidates = ductStepDownCandidates(ctx.currentSize);
      if (!candidates.length) return false;
      const label = document.createElement('div');
      label.className = 'duct-popover-section-label';
      label.textContent = 'Step down';
      container.appendChild(label);
      const grid = document.createElement('div');
      grid.className = 'duct-step-grid';
      candidates.forEach((size) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'duct-step-chip';
        b.textContent = formatDuctSize(size);
        b.onclick = () => ctx.applySize(size);
        grid.appendChild(b);
      });
      container.appendChild(grid);
    },
  });

  registerDuctPopoverSection({
    id: 'custom-size',
    order: 20,
    render(container, ctx) {
      let shape = ctx.currentSize && ctx.currentSize.kind === 'round' ? 'round' : 'rect';
      const label = document.createElement('div');
      label.className = 'duct-popover-section-label';
      label.textContent = 'Custom';
      container.appendChild(label);
      const toggle = document.createElement('div');
      toggle.className = 'duct-shape-toggle';
      const inputs = document.createElement('div');
      inputs.className = 'duct-size-inputs';
      const buildInputs = () => {
        inputs.innerHTML = '';
        if (shape === 'rect') {
          const w = document.createElement('input');
          w.type = 'number'; w.min = '2'; w.step = '1'; w.setAttribute('aria-label', 'Width (inches)');
          w.value = ctx.currentSize && ctx.currentSize.kind === 'rect' ? ctx.currentSize.w : 12;
          const x = document.createElement('span'); x.textContent = '×';
          const h = document.createElement('input');
          h.type = 'number'; h.min = '2'; h.step = '1'; h.setAttribute('aria-label', 'Depth (inches)');
          h.value = ctx.currentSize && ctx.currentSize.kind === 'rect' ? ctx.currentSize.h : 8;
          inputs.append(w, x, h);
          inputs._read = () => {
            const wv = parseFloat(w.value), hv = parseFloat(h.value);
            return wv > 0 && hv > 0 ? makeRectSize(wv, hv) : null;
          };
        } else {
          const o = document.createElement('span'); o.textContent = 'Ø';
          const d = document.createElement('input');
          d.type = 'number'; d.min = '4'; d.step = '1'; d.setAttribute('aria-label', 'Diameter (inches)');
          d.value = ctx.currentSize && ctx.currentSize.kind === 'round' ? ctx.currentSize.d : 10;
          inputs.append(o, d);
          inputs._read = () => {
            const dv = parseFloat(d.value);
            return dv > 0 ? makeRoundSize(dv) : null;
          };
        }
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.className = 'duct-custom-apply';
        apply.textContent = 'Apply';
        apply.onclick = () => {
          const size = inputs._read();
          if (!size) { App.showToast('Enter a size'); return; }
          ctx.applySize(size);
        };
        inputs.appendChild(apply);
      };
      [['rect', 'Rect'], ['round', 'Round']].forEach(([val, text]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.shape = val;
        b.textContent = text;
        b.classList.toggle('active', shape === val);
        b.onclick = () => {
          shape = val;
          toggle.querySelectorAll('button').forEach((tb) => tb.classList.toggle('active', tb.dataset.shape === shape));
          buildInputs();
        };
        toggle.appendChild(b);
      });
      buildInputs();
      container.append(toggle, inputs);
    },
  });

  // --- open/close/render ----------------------------------------------------

  function renderSections() {
    const host = document.getElementById('ductSizeSections');
    if (!host) return;
    const ctx = {
      currentSize: App.getCurrentDuctSize ? App.getCurrentDuctSize() : null,
      draft: App.state.drawingDuct || null,
      applySize: (size) => { App.applyDuctSizeStep(size); closeDuctSizePopover(); },
      close: closeDuctSizePopover,
      requestRender: renderSections,
    };
    host.innerHTML = '';
    sections.forEach((s) => {
      const div = document.createElement('div');
      div.className = 'duct-popover-section';
      div.dataset.sectionId = s.id;
      const keep = s.render(div, ctx);
      if (keep === false) return;
      host.appendChild(div);
    });
    const cur = document.getElementById('ductSizeCurrent');
    if (cur) cur.textContent = ctx.currentSize ? formatDuctSize(ctx.currentSize) : '';
  }

  function openDuctSizePopover() {
    const state = App.state;
    if (!state.drawingDuct || state.tool !== App.TOOL.DUCT) return;
    wire();
    const el = document.getElementById('ductSizePopover');
    if (!el) return;
    renderSections();
    el.style.display = '';
    open = true;
    // Anchor: below the cursor size chip when it is on screen, else near the
    // canvas center; placeFixedMenu clamps to the viewport either way.
    const anchor = App.getDuctChipClientAnchor && App.getDuctChipClientAnchor();
    let x, y;
    if (anchor) { x = anchor.x - 40; y = anchor.y + 8; }
    else {
      const c = document.getElementById('annCanvas');
      const r = c ? c.getBoundingClientRect() : { left: 100, top: 100, width: 400, height: 300 };
      x = r.left + r.width / 2 - 118;
      y = r.top + r.height / 3;
    }
    App.placeFixedMenu(el, x, y);
  }

  function closeDuctSizePopover() {
    const el = document.getElementById('ductSizePopover');
    if (el) el.style.display = 'none';
    open = false;
  }

  function toggleDuctSizePopover() {
    if (open) closeDuctSizePopover();
    else openDuctSizePopover();
  }

  function isDuctPopoverOpen() { return open; }

  function wire() {
    if (wired) return;
    wired = true;
    document.getElementById('ductSizePopoverClose').onclick = closeDuctSizePopover;
  }

  App.registerDuctPopoverSection = registerDuctPopoverSection;
  App.ductStepDownCandidates = ductStepDownCandidates;   // spec seam (duct-tool.spec.js)
  App.openDuctSizePopover = openDuctSizePopover;
  App.closeDuctSizePopover = closeDuctSizePopover;
  App.toggleDuctSizePopover = toggleDuctSizePopover;
  App.isDuctPopoverOpen = isDuctPopoverOpen;
})();
