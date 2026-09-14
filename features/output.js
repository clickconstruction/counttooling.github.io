/*
 * features/output.js - the output-actions cluster, extracted from the app.js
 * IIFE as the twenty-sixth feature-file split under the window.App registry
 * pattern. Three related surfaces move together (the "Output" features in
 * ARCHITECTURE.md): Copy to PipeTooling (`#forPipeTooling` dropdown +
 * doCopyPipeTooling with the view-link footer + the prefetched export
 * view-link cache), Copy Summary (`#copySummaryText` dropdown +
 * doCopyEmailSummary), and Download current page (`#downloadCurrentPageBtn` +
 * its mode menu + downloadCurrentPageAsPdf).
 *
 * Tier-3 B3 (J11/J13): the two copy scope drop-ups anchor to their buttons
 * (`right:auto`) and close each other; both copy buttons skip the scope
 * chooser at 1 page / 1 canvas (like Download); clipboard failure speaks
 * plain words; and the pre-copy scale gate's "Set scale" detour arms a
 * one-tap "Copy again" resume toast (#copyAgainModal, fired via the
 * App.onScaleApplied callback that features/scale.js invokes on every
 * scale commit).
 *
 * Loaded as a classic <script src="/features/output.js"> AFTER app.js. Its own
 * IIFE: it reaches the cross-cutting state + helpers through the shared
 * window.App registry that app.js populates during its own load, and binds the
 * three dropdown toggles + their option rows at load. The mobile burger menu
 * keeps working untouched: updateBurgerMenu() dispatches clicks on the same
 * `.download-page-option` / `.export-dropdown-option` DOM elements, and the
 * handlers move with the elements.
 *
 * The export view-link cache (exportViewLinkUrl / exportViewLinkProjectId)
 * lives here as private `let`s; revoking a link in the Share modal clears it
 * through the registered App.onViewLinkRevoked() callback (the Groups
 * pattern). The shared view-link minting (getOrCreateViewLinkUrl /
 * buildViewLinkUrl) STAYS in app.js (the header Share button uses it too) and
 * is reached via App.getOrCreateViewLinkUrl; likewise the shared download
 * helpers (sanitizeForFilename / downloadPdfBuffer / downloadProjectPdf) and
 * the header export/report dropdowns stay in app.js.
 * Boundary rule: read shared deps from App.* at call time, never captured at
 * load. See ARCHITECTURE.md "Feature files / window.App registry". No build step.
 */
(function() {
  const App = (window.App = window.App || {});

  // Cached view-link URL for the "Copy to /Tooling" export. Prefetched when the
  // dropdown opens so the clipboard write can stay inside the user gesture
  // (Safari/Firefox revoke clipboard permission across an await).
  let exportViewLinkUrl = null;
  let exportViewLinkProjectId = null;
  function canExportViewLink() {
    const state = App.state;
    const sb = App.getSupabase ? App.getSupabase() : null;
    return !!(App.SUPABASE_ENABLED && sb && state.currentProjectId && state.supabaseSession?.user && !state.loadedViaViewLink);
  }
  function prefetchExportViewLink() {
    const state = App.state;
    if (!canExportViewLink()) { exportViewLinkUrl = null; exportViewLinkProjectId = null; return; }
    if (exportViewLinkUrl && exportViewLinkProjectId === state.currentProjectId) return;
    const pid = state.currentProjectId;
    App.getOrCreateViewLinkUrl().then((url) => {
      if (App.state.currentProjectId === pid) { exportViewLinkUrl = url; exportViewLinkProjectId = pid; }
    }).catch(() => { /* best-effort; doCopyPipeTooling retries inline */ });
  }

  // Second line of #pipeToolingCopiedModal ("29 counts (1,122 ea) · 6 line types
  // (444.74 ft)"); '' hides it. Cleared by the Copy Summary path so a stale
  // split never rides along with an email-summary copy.
  function setCopiedDetail(text) {
    const el = document.getElementById('pipeToolingCopiedDetail');
    if (!el) return;
    el.textContent = text || '';
    el.style.display = text ? '' : 'none';
  }

  // Plain-words clipboard failure (B3/J11): say what happened and what to do —
  // no raw DOMException text. The error itself still goes to the console.
  function showCopyFailed(err) {
    console.error('[copy]', err);
    App.showToast('Nothing was copied. The browser blocked clipboard access. Click the copy button again, and allow clipboard access if the browser asks.', 6000);
  }

  async function doCopyPipeTooling(getAnnFn, pageIndices, mode, layers) {
    const state = App.state;
    const opts = {};
    if (getAnnFn) opts.getAnnotations = getAnnFn;
    if (pageIndices != null) opts.pageIndices = pageIndices;
    opts.scope = { mode: mode || 'all', layers: layers || null, everyLayer: everyLayerFlag(mode) };   // D25: the paste header names the scope + layers
    let text = typeof window.getPipeToolingSummary === 'function' ? window.getPipeToolingSummary(opts) : '';
    if (!text) {
      App.showToast('No items to summarize. Add counters or line types first.', 3000);
      return;
    }
    // Append a project view link so importing tools (PipeTooling / TakeoffTooling)
    // can link the bid back to the source takeoff. Importers detect it by scanning
    // the pasted text for a counttooling URL with a ?t=<token>.
    let noLinkToast = null;
    if (App.SUPABASE_ENABLED) {
      if (canExportViewLink()) {
        let url = (exportViewLinkUrl && exportViewLinkProjectId === state.currentProjectId) ? exportViewLinkUrl : null;
        if (!url) {
          try {
            url = await App.getOrCreateViewLinkUrl();
            exportViewLinkUrl = url;
            exportViewLinkProjectId = state.currentProjectId;
          } catch (_) {
            noLinkToast = 'Counts copied, but the view link could not be created.';
          }
        }
        if (url) text += '\n\nView link:\t' + url;
      } else if (state.loadedViaViewLink) {
        // B3 (J11/J13): loadedViaViewLink FIRST — a view-link session has a
        // project id and usually no supabase session, so behind the sign-in
        // check this accurate branch was dead ("Sign in to include a view
        // link" — a lie: signing in wouldn't help a view-only session).
        noLinkToast = 'Counts copied. View-only sessions cannot create a share link.';
      } else if (!state.currentProjectId) {
        noLinkToast = 'Counts copied. Save the project to the cloud to include a view link.';
      } else if (!state.supabaseSession?.user) {
        noLinkToast = 'Counts copied. Sign in to include a view link.';
      }
    }
    // What went on the clipboard, by unit — the same split PipeTooling's import
    // toast reports, so the two ends reconcile (counts vs line feet, never summed).
    const splitText = (typeof window.summarizeToolingExport === 'function' && typeof window.formatToolingExportSummary === 'function')
      ? window.formatToolingExportSummary(window.summarizeToolingExport(text))
      : '';
    try {
      await navigator.clipboard.writeText(text);
      App.logUserEvent('copy_summary', state.currentProjectId || null, { surface: 'pipe-tooling', mode: mode || 'all', layers: layers ? layers.length : null });
      if (noLinkToast) {
        App.showToast(splitText ? noLinkToast + ' ' + splitText + '.' : noLinkToast);
      } else {
        setCopiedDetail(splitText);
        App.showModal('pipeToolingCopiedModal');
        setTimeout(() => App.hideModal('pipeToolingCopiedModal'), splitText ? 2600 : 1500);
      }
    } catch (err) {
      showCopyFailed(err);
    }
  }

  // --- Open in TakeoffTooling (the electrical estimator's next door) ---
  // Hands the takeoff to TakeoffTooling as its `#import=` payload v2
  // (getTakeoffToolingPayload: units, groups, pages, children, project name)
  // plus the plans link, so nothing is retyped or re-inferred there. The
  // tab is opened synchronously inside the click (popup blockers), and its
  // URL lands once the cloud-gated view link has resolved. Runs behind the
  // same pre-copy scale gate as Copy to /Tooling — px rows do travel (flagged
  // there too), but the estimator is asked first.
  const TAKEOFF_TOOLING_ORIGIN = 'https://takeofftooling.com/';
  function encodeHandoffPayload(obj) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  }
  async function doOpenTakeoffTooling(getAnnFn, pageIndices, mode, layers) {
    const state = App.state;
    const opts = {};
    if (getAnnFn) opts.getAnnotations = getAnnFn;
    if (pageIndices != null) opts.pageIndices = pageIndices;
    opts.scope = { mode: mode || 'all', layers: layers || null, everyLayer: everyLayerFlag(mode) };   // D25: the paste header names the scope + layers
    const payload = typeof window.getTakeoffToolingPayload === 'function' ? window.getTakeoffToolingPayload(opts) : null;
    if (!payload || !payload.items.length) {
      App.showToast('Nothing to hand off. Add counters or line types first.');
      return;
    }
    const win = window.open('', '_blank');
    let plansUrl = '';
    if (canExportViewLink()) {
      try {
        plansUrl = (exportViewLinkUrl && exportViewLinkProjectId === state.currentProjectId) ? exportViewLinkUrl : await App.getOrCreateViewLinkUrl();
        exportViewLinkUrl = plansUrl;
        exportViewLinkProjectId = state.currentProjectId;
      } catch (_) { plansUrl = ''; }
    }
    if (plansUrl) payload.project.plansUrl = plansUrl;
    const url = TAKEOFF_TOOLING_ORIGIN + '#import=' + encodeHandoffPayload(payload);
    if (win) win.location.href = url;
    else window.open(url, '_blank');
    App.logUserEvent('copy_summary', state.currentProjectId || null, { surface: 'takeoff-tooling', mode: mode || 'visible', items: payload.items.length, plansLink: !!plansUrl });
    const n = payload.items.length;
    App.showToast(`Opened TakeoffTooling with ${n} row${n === 1 ? '' : 's'}${plansUrl ? ' and the plans link' : ''}.`);
  }

  // --- Pre-copy scale check (#toolingScaleCheckModal), both copy surfaces ---
  // Copying with unscaled lines exports pixel lengths (as separate `px of`
  // rows since T1-05). Before the copy — Copy to /Tooling AND Copy Summary —
  // walk exactly the pages/annotations the chosen mode will export and flag
  // pages where a summarized line (known lineTypeId — the
  // getPipeToolingHasData rule) has no effective scale (page scale or its
  // scale zone's). Pages without line marks never flag. On a hit, a confirm
  // modal offers Set scale (jump + open the Set Scale modal), Export anyway,
  // or Cancel. Counters need no scale, so counter-only pages pass untouched.
  let pendingToolingExport = null;   // { getAnnFn, pageIndices, firstIdx, doCopy, surface, mode } awaiting the modal's verdict

  // B3 (J11): resume after the Set-scale detour. "Set scale" stashes the
  // interrupted copy here (plus the project id as a staleness guard); every
  // scale apply — page or zone; features/scale.js calls App.onScaleApplied
  // after each commit — offers a one-tap "Copy again" toast (a T2-04
  // .toast-interactive card, T2-06's 6s gate-toast duration). Its click
  // re-runs the SAME gated copy inside the user gesture, so
  // collectUnscaledLinePages re-walks and the clipboard write stays
  // permitted. Any fresh copy attempt supersedes the stash.
  let resumeToolingExport = null;
  let copyAgainToastTimer = null;

  function collectUnscaledLinePages(getAnnFn, pageIndices) {
    const state = App.state;
    const indices = pageIndices != null ? pageIndices : state.pages.map((_, i) => i);
    const lineTypeIds = new Set((state.lineTypes || []).map(lt => lt.id));
    const getAnn = getAnnFn
      || ((page, i) => (typeof window.getAnnotationsForReport === 'function' ? window.getAnnotationsForReport(page, i) : page?.annotations) || App.makeAnnotations());
    const flagged = [];
    indices.forEach(i => {
      const page = state.pages[i];
      if (!page) return;
      const ann = getAnn(page, i) || App.makeAnnotations();
      const unscaled = (line, isPoly) => {
        if (!lineTypeIds.has(line.lineTypeId)) return false;
        const eff = App.getEffectiveScaleForLine(ann, line, isPoly, i);
        return !(eff && eff.pixelsPerUnit);   // the same test the length math uses for its px fallback
      };
      if ((ann.quickLines || []).some(l => unscaled(l, false)) || (ann.polylines || []).some(l => unscaled(l, true))) flagged.push(i);
    });
    return flagged;
  }

  // T1-05: the one pre-copy scale gate, generalized to carry the copy function
  // so BOTH copy surfaces (Copy to /Tooling and Copy Summary) run the same
  // check. On a hit it stashes { …, doCopy } and opens the modal; on a clean
  // walk it copies straight away (zero added steps on the happy path).
  // D5: `collectFlagged` (optional, default = the line walk) lets another copy
  // surface bring its own unscaled-page collector — the Duct Schedule copy
  // (features/duct-schedule.js) flags pages with unscaled DUCT runs instead,
  // since its numbers ride duct geometry, not line types. The collector is
  // stashed with the pending/resume state so Export-anyway and the
  // "Copy again" resume re-walk the SAME rule. Published as App.runGatedCopy.
  // D9: on the /Tooling surfaces the copy also runs the Bid Check gate
  // (features/duct-bidcheck.js App.runDuctBidGate — the "Review · Export
  // anyway" toast, only with duct present and rows unresolved; proceed() is
  // synchronous otherwise so the clipboard gesture survives). Wrapped HERE so
  // the scale gate's Export-anyway and the Copy-again resume run it too.
  async function runGatedCopy(getAnnFn, pageIndices, doCopyRaw, surface, mode, collectFlagged, layers) {
    resumeToolingExport = null;   // a fresh copy attempt supersedes any pending Copy-again resume
    const bidGate = App.runDuctBidGate;
    const doCopy = bidGate && (surface === 'pipe-tooling' || surface === 'takeoff-tooling')
      ? (a, b, c, d) => bidGate(() => doCopyRaw(a, b, c, d), surface)
      : doCopyRaw;
    const collect = collectFlagged || collectUnscaledLinePages;
    const flagged = collect(getAnnFn, pageIndices);
    if (flagged.length) {
      pendingToolingExport = { getAnnFn, pageIndices, firstIdx: flagged[0], doCopy, surface, mode, collectFlagged: collect, layers };
      App.logUserEvent('unscaled_ft_block', App.state.currentProjectId || null,
        { surface, flaggedPages: flagged.length });
      const listEl = document.getElementById('toolingScaleCheckList');
      if (listEl) {
        listEl.innerHTML = '';
        flagged.forEach(i => {
          const li = document.createElement('li');
          li.textContent = App.state.pages[i]?.label || 'Page ' + (i + 1);
          listEl.appendChild(li);
        });
      }
      App.showModal('toolingScaleCheckModal');
      return;
    }
    await doCopy(getAnnFn, pageIndices, mode, layers);
    App.showBidCheckAdvisory && App.showBidCheckAdvisory(surface);   // S5: advisory, never a block
  }

  const toolingScaleCheckCancel = document.getElementById('toolingScaleCheckCancel');
  const toolingScaleCheckExport = document.getElementById('toolingScaleCheckExport');
  const toolingScaleCheckGoSet = document.getElementById('toolingScaleCheckGoSet');
  if (toolingScaleCheckCancel) toolingScaleCheckCancel.onclick = () => App.hideModal('toolingScaleCheckModal');
  if (toolingScaleCheckExport) {
    toolingScaleCheckExport.onclick = async () => {
      const pending = pendingToolingExport;
      App.hideModal('toolingScaleCheckModal');
      // The click itself is the user gesture, so the clipboard write inside
      // the stashed doCopy stays permitted (same constraint as the dropdown).
      if (pending) await pending.doCopy(pending.getAnnFn, pending.pageIndices, pending.mode, pending.layers);
    };
  }
  if (toolingScaleCheckGoSet) {
    toolingScaleCheckGoSet.onclick = () => {
      const pending = pendingToolingExport;
      App.hideModal('toolingScaleCheckModal');
      if (!pending) return;
      // Arm the one-tap resume: the next scale apply offers "Copy again" (B3).
      resumeToolingExport = { ...pending, projectId: App.state.currentProjectId };
      if (pending.firstIdx !== App.state.currentPage) {
        App.state.currentPage = pending.firstIdx;
        App.fitZoom();
      }
      App.openScaleModal();
    };
  }
  // Core-function -> feature callback: any hide path (buttons, Escape) drops
  // the stashed export so a later reopen can't fire a stale copy.
  App.onToolingScaleCheckHidden = () => { pendingToolingExport = null; };

  // Feature-to-feature callback (registry pattern): features/scale.js invokes
  // this after every scale commit (page or zone). While a Set-scale detour is
  // armed, surface the "Copy again" resume toast; otherwise a no-op.
  App.onScaleApplied = () => {
    if (!resumeToolingExport) return;
    if (resumeToolingExport.projectId !== App.state.currentProjectId) { resumeToolingExport = null; return; }
    if (copyAgainToastTimer) clearTimeout(copyAgainToastTimer);
    App.showModal('copyAgainModal');
    copyAgainToastTimer = setTimeout(() => { App.hideModal('copyAgainModal'); copyAgainToastTimer = null; }, 6000);
  };
  const copyAgainLink = document.getElementById('copyAgainLink');
  if (copyAgainLink) {
    copyAgainLink.onclick = async () => {
      if (copyAgainToastTimer) { clearTimeout(copyAgainToastTimer); copyAgainToastTimer = null; }
      App.hideModal('copyAgainModal');
      const resume = resumeToolingExport;
      resumeToolingExport = null;
      if (!resume || resume.projectId !== App.state.currentProjectId) return;
      // The click is the user gesture: the gate re-walks synchronously and the
      // clipboard write inside the stashed doCopy stays permitted.
      await runGatedCopy(resume.getAnnFn, resume.pageIndices, resume.doCopy, resume.surface, resume.mode, resume.collectFlagged, resume.layers);
    };
  }
  // The gate is the shared machinery — Copy Schedule (features/duct-schedule.js)
  // runs through it with its own collector (registry pattern).
  App.runGatedCopy = runGatedCopy;

  const forPipeToolingBtn = document.getElementById('forPipeTooling');
  const forPipeToolingMenu = document.getElementById('forPipeToolingMenu');
  const forPipeToolingDropdown = document.getElementById('forPipeToolingDropdown');
  const copySummaryTextBtn = document.getElementById('copySummaryText');
  const copySummaryTextMenu = document.getElementById('copySummaryTextMenu');
  const copySummaryTextDropdown = document.getElementById('copySummaryTextDropdown');

  // Shared close for the two copy scope menus: hide + re-parent back into the
  // dropdown (mobile body-appends them). Both buttons stopPropagation, so the
  // app.js document click-away never sees the OTHER menu open — the menus
  // close each other here instead (B3/J11).
  function closeScopeMenu(menu, dropdown) {
    if (!menu) return;
    menu.classList.remove('visible');
    if (dropdown && menu.parentElement !== dropdown) dropdown.appendChild(menu);
  }
  // B3 (J13): at 1 page / 1 canvas every scope option is the same set — skip
  // the chooser and copy directly, like the Download button already does.
  // D25 (X6 option D): "every sheet" used to copy the ACTIVE layer per page —
  // marks the show-all peek put on screen were excluded (J11: 11 showed, 6
  // copied). The scopes are now This sheet / Everything, and when a page in
  // scope has 2+ layers a picker lists the layer NAMES in scope, pre-checked
  // to what is on screen at copy time (each page's active layer + its peek
  // set). The number then matches the screen AND is explicit: the paste
  // header names the layers, so it is reproducible and never silently
  // depends on a view toggle. The active layer is always included (the
  // peek's own rule), so its name is checked and locked.
  function pagesInScope(mode) {
    const state = App.state;
    return mode === 'this-canvas' ? [state.currentPage] : state.pages.map((_, i) => i);
  }
  function layerNameOf(c) { return (c && c.name) || 'Main'; }
  function visibleCanvasIds(pageIdx) {
    const state = App.state;
    const page = state.pages[pageIdx];
    const canvases = page ? App.getPageCanvases(page) : [];
    const active = App.getActiveCanvas ? App.getActiveCanvas(page) : null;
    const ids = new Set(active ? [active.id] : []);
    if (state.showAllCanvases && canvases.length > 1) {
      const peek = (state.peekCanvasIdsByPage || {})[pageIdx];
      (peek ? canvases.filter((c) => peek.includes(c.id)) : canvases).forEach((c) => ids.add(c.id));
    }
    return ids;
  }
  function layerPickerModel(mode) {
    const state = App.state;
    const names = new Map();   // name -> { checked, locked }
    let multi = false;
    pagesInScope(mode).forEach((pi) => {
      const page = state.pages[pi];
      const canvases = page ? App.getPageCanvases(page) : [];
      if (canvases.length > 1) multi = true;
      const vis = visibleCanvasIds(pi);
      const active = App.getActiveCanvas ? App.getActiveCanvas(page) : null;
      canvases.forEach((c) => {
        const n = layerNameOf(c);
        const e = names.get(n) || { name: n, checked: false, locked: false };
        if (vis.has(c.id)) e.checked = true;
        if (active && active.id === c.id) { e.checked = true; e.locked = true; }
        names.set(n, e);
      });
    });
    // Everything (2026-09-14, Will: "everything be every layer on every page")
    // is every layer on every sheet, full stop: the picker shows them all
    // ticked and locked so the menu says what the copy holds, and nothing on
    // screen can narrow it. This sheet keeps the on-screen default + the picker.
    const layers = [...names.values()];
    if (mode === 'all') layers.forEach((l) => { l.checked = true; l.locked = true; });
    return { show: multi, layers };
  }
  function everyLayerFlag(mode) { return mode === 'all' && layerPickerModel('all').show; }
  function renderLayerPicker(pickerEl, mode, force) {
    if (!pickerEl) return;
    if (!force && pickerEl.dataset.mode === mode) return;   // same scope: keep the estimator's ticks
    // This sheet's ticks survive a hover across Everything (whose rows are all
    // locked, so it has no ticks of its own to carry); a fresh open (force)
    // starts from what is on screen — "pre-checked to what is visible at copy time".
    if (force) delete pickerEl.dataset.sheetTicks;
    else if (pickerEl.dataset.mode === 'this-canvas') pickerEl.dataset.sheetTicks = JSON.stringify(pickedLayers(pickerEl) || []);
    const carry = (!force && mode === 'this-canvas' && pickerEl.dataset.sheetTicks) ? new Set(JSON.parse(pickerEl.dataset.sheetTicks)) : null;
    pickerEl.dataset.mode = mode;
    const model = layerPickerModel(mode);
    if (carry) model.layers.forEach((l) => { if (!l.locked) l.checked = carry.has(l.name); });
    pickerEl.hidden = !model.show;
    pickerEl.innerHTML = '';
    if (!model.show) return;
    const title = document.createElement('div');
    title.className = 'copy-layer-picker-title';
    title.textContent = mode === 'all' ? 'Every layer' : 'Layers';
    pickerEl.appendChild(title);
    model.layers.forEach((l) => {
      const lab = document.createElement('label');
      lab.className = l.locked ? 'locked' : '';
      lab.title = l.locked ? (mode === 'all' ? 'Everything includes every layer on every sheet' : 'The active layer is always included') : '';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = l.checked; cb.disabled = l.locked; cb.dataset.layerName = l.name;
      cb.onclick = (e) => e.stopPropagation();   // the menu's outside-click must not close on a tick
      lab.onclick = (e) => e.stopPropagation();
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(l.name));
      pickerEl.appendChild(lab);
    });
  }
  // The checked names → a per-page annotation getter (merged over that page's
  // canvases whose name is checked; the active canvas always rides along —
  // getMergedAnnotationsForPage's own rule) and the scope the header names.
  function pickedLayers(pickerEl) {
    if (!pickerEl || pickerEl.hidden) return null;
    return [...pickerEl.querySelectorAll('input[type="checkbox"]')].filter((cb) => cb.checked).map((cb) => cb.dataset.layerName);
  }
  // A copy fired without the menu ever rendering its picker (a keyboard route,
  // a spec driving the option directly) must still copy WHAT IS ON SCREEN —
  // the option-D default — never fall back to merging every layer.
  function layersFor(pickerEl, mode) {
    if (mode === 'all') return null;   // Everything = every layer; the getter is the full merge, the header says so
    if (pickerEl && pickerEl.dataset.mode === mode) return pickedLayers(pickerEl);
    const model = layerPickerModel(mode);
    return model.show ? model.layers.filter((l) => l.checked).map((l) => l.name) : null;
  }
  // Layers are picked by NAME, but the locked row means "each page's active
  // layer" — never "every canvas that happens to share its name". So a page
  // contributes its active canvas plus the canvases whose name was ticked as
  // an UNLOCKED row; a non-active twin named like the active layer is not
  // swept in by the lock. (getMergedAnnotationsForPage adds the active canvas
  // itself; the ids here are the extras.)
  function annGetterFor(layers, lockedNames) {
    if (!layers) return null;
    const locked = new Set(lockedNames || []);
    const extra = new Set(layers.filter((n) => !locked.has(n)));
    return (page) => window.getMergedAnnotationsForPage(page, App.getPageCanvases(page).filter((c) => extra.has(layerNameOf(c))).map((c) => c.id));
  }
  function lockedLayerNames(mode) { return layerPickerModel(mode).layers.filter((l) => l.locked).map((l) => l.name); }
  App.copyLayerPickerModel = layerPickerModel;   // spec seam

  function bindPickerScopeHover(menuEl, pickerId, optionClass) {
    if (!menuEl) return;
    menuEl.querySelectorAll('.' + optionClass).forEach((opt) => {
      opt.addEventListener('mouseenter', () => renderLayerPicker(document.getElementById(pickerId), opt.dataset.mode === 'this-canvas' ? 'this-canvas' : 'all'));
    });
  }
  function isSingleScope() {
    const state = App.state;
    const page = state.pages[state.currentPage];
    const canvases = page ? App.getPageCanvases(page) : [];
    return state.pages.length <= 1 && canvases.length <= 1;
  }

  if (forPipeToolingBtn && forPipeToolingMenu) {
    forPipeToolingBtn.onclick = (e) => {
      e.stopPropagation();
      if (isSingleScope()) {
        closeScopeMenu(forPipeToolingMenu, forPipeToolingDropdown);
        runGatedCopy(null, [App.state.currentPage], doCopyPipeTooling, 'pipe-tooling', 'this-canvas');
        return;
      }
      if (forPipeToolingMenu.classList.contains('visible')) {
        closeScopeMenu(forPipeToolingMenu, forPipeToolingDropdown);
      } else {
        closeScopeMenu(copySummaryTextMenu, copySummaryTextDropdown);
        closeScopeMenu(forTakeoffToolingMenu, forTakeoffToolingDropdown);
        prefetchExportViewLink();
        forPipeToolingMenu.style.left = '-9999px';
        // 'auto' (not '') — the stylesheet's `right:0` otherwise pins the
        // fixed-position menu to the viewport edge and stretches it into a
        // full-window band (J11 friction #8). Anchor to the button instead.
        forPipeToolingMenu.style.right = 'auto';
        renderLayerPicker(document.getElementById('pipeToolingLayerPicker'), 'all', true);   // D25: fresh from the screen on every open; This sheet re-renders on hover
        forPipeToolingMenu.classList.add('visible');
        const btnRect = forPipeToolingBtn.getBoundingClientRect();
        forPipeToolingMenu.style.position = 'fixed';
        forPipeToolingMenu.style.minWidth = Math.max(btnRect.width, 280) + 'px';
        // Drop-up anchored to the button, measured (not estimated) height,
        // viewport-clamped via the shared helper.
        App.placeFixedMenu(forPipeToolingMenu, btnRect.left, btnRect.top - forPipeToolingMenu.offsetHeight - 4);
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && forPipeToolingMenu.parentElement !== document.body) document.body.appendChild(forPipeToolingMenu);
      }
    };
  }
  document.querySelectorAll('.pipe-tooling-option').forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      closeScopeMenu(forPipeToolingMenu, forPipeToolingDropdown);
      // D25: the picker's checked layers (null when it is hidden — every page
      // in scope has one layer, so active == everything and no header is needed).
      const layers = layersFor(document.getElementById('pipeToolingLayerPicker'), mode);
      if (mode === 'this-canvas') await runGatedCopy(annGetterFor(layers, lockedLayerNames(mode)), [App.state.currentPage], doCopyPipeTooling, 'pipe-tooling', mode, null, layers);
      else if (mode === 'all') await runGatedCopy(window.getMergedAnnotationsForPage, null, doCopyPipeTooling, 'pipe-tooling', mode, null, layers);   // every layer on every sheet
    };
  });

  const forTakeoffToolingBtn = document.getElementById('forTakeoffTooling');
  const forTakeoffToolingMenu = document.getElementById('forTakeoffToolingMenu');
  const forTakeoffToolingDropdown = document.getElementById('forTakeoffToolingDropdown');
  if (forTakeoffToolingBtn && forTakeoffToolingMenu) {
    forTakeoffToolingBtn.onclick = (e) => {
      e.stopPropagation();
      if (isSingleScope()) {
        closeScopeMenu(forTakeoffToolingMenu, forTakeoffToolingDropdown);
        runGatedCopy(null, [App.state.currentPage], doOpenTakeoffTooling, 'takeoff-tooling', 'this-canvas');
        return;
      }
      if (forTakeoffToolingMenu.classList.contains('visible')) {
        closeScopeMenu(forTakeoffToolingMenu, forTakeoffToolingDropdown);
      } else {
        closeScopeMenu(forPipeToolingMenu, forPipeToolingDropdown);
        closeScopeMenu(copySummaryTextMenu, copySummaryTextDropdown);
        prefetchExportViewLink();
        forTakeoffToolingMenu.style.left = '-9999px';
        forTakeoffToolingMenu.style.right = 'auto';
        renderLayerPicker(document.getElementById('takeoffToolingLayerPicker'), 'all', true);   // D25: fresh from the screen on every open; This sheet re-renders on hover
        forTakeoffToolingMenu.classList.add('visible');
        const btnRect = forTakeoffToolingBtn.getBoundingClientRect();
        forTakeoffToolingMenu.style.position = 'fixed';
        forTakeoffToolingMenu.style.minWidth = Math.max(btnRect.width, 280) + 'px';
        App.placeFixedMenu(forTakeoffToolingMenu, btnRect.left, btnRect.top - forTakeoffToolingMenu.offsetHeight - 4);
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && forTakeoffToolingMenu.parentElement !== document.body) document.body.appendChild(forTakeoffToolingMenu);
      }
    };
  }
  document.querySelectorAll('.takeoff-tooling-option').forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      closeScopeMenu(forTakeoffToolingMenu, forTakeoffToolingDropdown);
      // D25: the picker's checked layers (null when it is hidden — every page
      // in scope has one layer, so active == everything and no header is needed).
      const layers = layersFor(document.getElementById('takeoffToolingLayerPicker'), mode);
      if (mode === 'this-canvas') await runGatedCopy(annGetterFor(layers, lockedLayerNames(mode)), [App.state.currentPage], doOpenTakeoffTooling, 'takeoff-tooling', mode, null, layers);
      else if (mode === 'all') await runGatedCopy(window.getMergedAnnotationsForPage, null, doOpenTakeoffTooling, 'takeoff-tooling', mode, null, layers);   // every layer on every sheet
    };
  });

  if (copySummaryTextBtn && copySummaryTextMenu) {
    copySummaryTextBtn.onclick = (e) => {
      e.stopPropagation();
      if (isSingleScope()) {
        closeScopeMenu(copySummaryTextMenu, copySummaryTextDropdown);
        runGatedCopy(null, [App.state.currentPage], doCopyEmailSummary, 'email-summary', 'this-canvas');
        return;
      }
      if (copySummaryTextMenu.classList.contains('visible')) {
        closeScopeMenu(copySummaryTextMenu, copySummaryTextDropdown);
      } else {
        closeScopeMenu(forPipeToolingMenu, forPipeToolingDropdown);
        closeScopeMenu(forTakeoffToolingMenu, forTakeoffToolingDropdown);
        copySummaryTextMenu.style.left = '-9999px';
        // Same `right:auto` anchor as the /Tooling drop-up (J11 friction #8).
        copySummaryTextMenu.style.right = 'auto';
        renderLayerPicker(document.getElementById('copySummaryLayerPicker'), 'all', true);   // D25: fresh from the screen on every open; This sheet re-renders on hover
        copySummaryTextMenu.classList.add('visible');
        const btnRect = copySummaryTextBtn.getBoundingClientRect();
        copySummaryTextMenu.style.position = 'fixed';
        copySummaryTextMenu.style.minWidth = Math.max(btnRect.width, 280) + 'px';
        // Below the button when it fits (measured, not estimated), else above;
        // either way viewport-clamped via the shared helper.
        const menuHeight = copySummaryTextMenu.offsetHeight;
        const spaceBelow = window.innerHeight - (btnRect.bottom + 4);
        const top = spaceBelow < menuHeight
          ? btnRect.top - menuHeight - 4
          : (btnRect.bottom + 4);
        App.placeFixedMenu(copySummaryTextMenu, btnRect.left, top);
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        if (isMobile && copySummaryTextMenu.parentElement !== document.body) document.body.appendChild(copySummaryTextMenu);
      }
    };
  }
  async function doCopyEmailSummary(getAnnFn, pageIndices, mode, layers) {
    const opts = {};
    if (getAnnFn) opts.getAnnotations = getAnnFn;
    if (pageIndices != null) opts.pageIndices = pageIndices;
    opts.scope = { mode: mode || 'all', layers: layers || null, everyLayer: everyLayerFlag(mode) };   // D25: the paste header names the scope + layers
    const text = typeof window.getEmailTextSummary === 'function' ? window.getEmailTextSummary(opts) : '';
    if (!text) {
      App.showToast('No items to summarize. Add counters or line types first.', 3000);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      App.logUserEvent('copy_summary', App.state.currentProjectId || null, { surface: 'email-summary', mode: mode || 'all', layers: layers ? layers.length : null });
      setCopiedDetail('');
      App.showModal('pipeToolingCopiedModal');
      setTimeout(() => App.hideModal('pipeToolingCopiedModal'), 1500);
    } catch (err) {
      showCopyFailed(err);
    }
  }
  document.querySelectorAll('.copy-summary-option').forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      closeScopeMenu(copySummaryTextMenu, copySummaryTextDropdown);
      // T1-05: Copy Summary runs the same pre-copy scale gate as Copy to
      // /Tooling (previously a direct, ungated call).
      // D25: the picker's checked layers (null when it is hidden — every page
      // in scope has one layer, so active == everything and no header is needed).
      const layers = layersFor(document.getElementById('copySummaryLayerPicker'), mode);
      if (mode === 'this-canvas') await runGatedCopy(annGetterFor(layers, lockedLayerNames(mode)), [App.state.currentPage], doCopyEmailSummary, 'email-summary', mode, null, layers);
      else if (mode === 'all') await runGatedCopy(window.getMergedAnnotationsForPage, null, doCopyEmailSummary, 'email-summary', mode, null, layers);   // every layer on every sheet
    };
  });

  async function downloadCurrentPageAsPdf(mode) {
    const state = App.state;
    const page = state.pages[state.currentPage];
    const isAllPages = mode === 'all-pages' || mode === 'all-pages-canvases';
    if (!isAllPages && !page?.pdfPage) return;
    if (!isAllPages) App.ensureActiveCanvas(page);
    const jsPDFLib = window.jspdf;
    if (!jsPDFLib?.jsPDF) { App.showToast('Download requires jsPDF. Please refresh the page.', 4000); return; }
    const EXPORT_SCALE = 4;
    const PT_TO_MM = 25.4 / 72;
    const exportOverrides = { markerScale: state.exportSettings?.markerScale ?? 0.75, lineScale: state.exportSettings?.lineScale ?? 0.75 };
    const btn = document.getElementById('downloadCurrentPageBtn');
    const origText = btn?.title || '';
    if (btn) { btn.disabled = true; btn.title = 'Downloading…'; }
    const baseName = App.sanitizeForFilename(state.currentProjectName);
    const pageNum = state.currentPage + 1;
    try {
      if (mode === 'all-canvases') {
        const canvases = App.getPageCanvases(page);
        if (canvases.length === 0) { if (btn) { btn.disabled = false; btn.title = origText; } return; }
        let doc = null;
        for (let i = 0; i < canvases.length; i++) {
          const c = canvases[i];
          const viewport = page.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation ?? 0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
          App.renderAnnotationsToContext(ctx, page, EXPORT_SCALE, exportOverrides, c.annotations || App.makeAnnotations());
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
          const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
          const caption = c.name || 'Main';
          const captionTop = 10;
          const imageTop = 14;
          const pdfPageW = Math.max(210, wMm + 28);
          const pdfPageH = imageTop + hMm + 14 + 20;
          if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [pdfPageW, pdfPageH], orientation: pdfPageW > pdfPageH ? 'l' : 'p' });
          else doc.addPage([pdfPageW, pdfPageH], pdfPageW > pdfPageH ? 'l' : 'p');
          doc.setFontSize(9);
          doc.text(caption, 14, captionTop);
          doc.addImage(imgData, 'JPEG', 14, imageTop, wMm, hMm);
        }
        if (doc) doc.save('takeoff-page' + pageNum + '_all-canvases_' + baseName + '.pdf');
      } else if (mode === 'all-pages') {
        if (state.pages.length === 0) { if (btn) { btn.disabled = false; btn.title = origText; } return; }
        let doc = null;
        for (let i = 0; i < state.pages.length; i++) {
          if (btn) btn.title = 'Exporting plan ' + (i + 1) + '/' + state.pages.length + '…';
          const p = state.pages[i];
          App.ensureActiveCanvas(p);
          const viewport = p.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: p.rotation ?? 0 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await p.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
          App.renderAnnotationsToContext(ctx, p, EXPORT_SCALE, exportOverrides);
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
          const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
          if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
          else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
          doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
        }
        if (doc) doc.save('takeoff-all-pages_' + baseName + '.pdf');
      } else if (mode === 'all-pages-canvases') {
        if (state.pages.length === 0) { if (btn) { btn.disabled = false; btn.title = origText; } return; }
        let doc = null;
        for (let pageIdx = 0; pageIdx < state.pages.length; pageIdx++) {
          const p = state.pages[pageIdx];
          App.ensureActiveCanvas(p);
          const canvases = App.getPageCanvases(p);
          if (canvases.length === 0) continue;
          for (let ci = 0; ci < canvases.length; ci++) {
            if (btn) btn.title = 'Exporting page ' + (pageIdx + 1) + '/' + state.pages.length + '…';
            const c = canvases[ci];
            const viewport = p.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: p.rotation ?? 0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await p.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
            App.renderAnnotationsToContext(ctx, p, EXPORT_SCALE, exportOverrides, c.annotations || App.makeAnnotations());
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
            const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
            if (canvases.length === 1) {
              if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
              else doc.addPage([wMm, hMm], wMm > hMm ? 'l' : 'p');
              doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
            } else {
              const caption = c.name || 'Main';
              const captionTop = 10;
              const imageTop = 14;
              const pdfPageW = Math.max(210, wMm + 28);
              const pdfPageH = imageTop + hMm + 14 + 20;
              if (!doc) doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [pdfPageW, pdfPageH], orientation: pdfPageW > pdfPageH ? 'l' : 'p' });
              else doc.addPage([pdfPageW, pdfPageH], pdfPageW > pdfPageH ? 'l' : 'p');
              doc.setFontSize(9);
              doc.text(caption, 14, captionTop);
              doc.addImage(imgData, 'JPEG', 14, imageTop, wMm, hMm);
            }
          }
        }
        if (doc) doc.save('takeoff-all-pages-canvases_' + baseName + '.pdf');
      } else {
        const viewport = page.pdfPage.getViewport({ scale: EXPORT_SCALE, rotation: page.rotation ?? 0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.pdfPage.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
        App.renderAnnotationsToContext(ctx, page, EXPORT_SCALE, exportOverrides);
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const wMm = (viewport.width / EXPORT_SCALE) * PT_TO_MM;
        const hMm = (viewport.height / EXPORT_SCALE) * PT_TO_MM;
        const doc = new jsPDFLib.jsPDF({ unit: 'mm', format: [wMm, hMm], orientation: wMm > hMm ? 'l' : 'p' });
        doc.addImage(imgData, 'JPEG', 0, 0, wMm, hMm);
        doc.save('takeoff-page' + pageNum + '_' + baseName + '.pdf');
      }
      App.logUserEvent('export_pdf', state.currentProjectId, { source: 'download-current-page', mode: mode || 'this-canvas' });
    } catch (err) {
      console.error(err);
      App.showToast('Download failed: ' + (err?.message || err), 5000);
    }
    if (btn) { btn.disabled = false; btn.title = origText; }
  }
  const downloadCurrentPageBtn = document.getElementById('downloadCurrentPageBtn');
  const downloadCurrentPageMenu = document.getElementById('downloadCurrentPageMenu');
  if (downloadCurrentPageBtn) {
    downloadCurrentPageBtn.onclick = (e) => {
      e.stopPropagation();
      const state = App.state;
      const page = state.pages[state.currentPage];
      const canvases = page ? App.getPageCanvases(page) : [];
      const multiPage = state.pages.length > 1;
      if (!multiPage && canvases.length <= 1) {
        downloadCurrentPageAsPdf('this-canvas');
      } else if (downloadCurrentPageMenu) {
        if (downloadCurrentPageMenu.classList.contains('visible')) {
          downloadCurrentPageMenu.classList.remove('visible');
        } else {
          downloadCurrentPageMenu.style.left = '-9999px';
          downloadCurrentPageMenu.style.right = '';
          downloadCurrentPageMenu.classList.add('visible');
          const btnRect = downloadCurrentPageBtn.getBoundingClientRect();
          downloadCurrentPageMenu.style.position = 'fixed';
          // Right-aligned to the button (measured width), viewport-clamped.
          App.placeFixedMenu(downloadCurrentPageMenu, btnRect.right - downloadCurrentPageMenu.offsetWidth, btnRect.bottom + 4);
        }
      }
    };
  }
  document.querySelectorAll('.download-page-option').forEach(opt => {
    opt.onclick = (e) => {
      e.stopPropagation();
      const mode = opt.dataset.mode;
      if (downloadCurrentPageMenu) downloadCurrentPageMenu.classList.remove('visible');
      if (mode) downloadCurrentPageAsPdf(mode);
    };
  });

  // Share-modal revoke clears the export view-link cache so a revoked token is
  // never handed out (core-function -> feature callback).
  App.onViewLinkRevoked = () => { exportViewLinkUrl = null; exportViewLinkProjectId = null; };

  // --- Shared PDF download helpers (split #37, moved from app.js) ----------
  function sanitizeForFilename(s) {
    const raw = (s || 'Untitled').replace(/\.pdf$/i, '').trim();
    const cleaned = raw.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_').trim();
    return cleaned || 'Untitled';
  }
  function downloadPdfBuffer(buffer, filename) {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.pdf') ? filename : filename + '.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }
  async function downloadProjectPdf() {
    let buf = null;
    if (App.state.pdfBuffer && App.state.pdfBuffer.byteLength > 0) {
      buf = App.state.pdfBuffer;
    } else if (App.state.pdfStoragePath && App.SUPABASE_ENABLED && App.getSupabase()) {
      try {
        const cachedBlob = App.state.currentProjectId && App.state.pdfHash ? await pdfCacheGet(App.state.currentProjectId, App.state.pdfHash) : null;
        if (cachedBlob && cachedBlob.size > 0) {
          buf = await cachedBlob.arrayBuffer();
        }
        if (!buf || buf.byteLength === 0) {
          const { data: blob, error: dlErr } = await App.getSupabase().storage.from('pdfs').download(App.state.pdfStoragePath);
          if (dlErr || !blob || blob.size === 0) {
            App.showToast('Failed to download PDF: ' + (dlErr?.message || 'PDF not found'), 4000);
            return;
          }
          buf = await blob.arrayBuffer();
        }
      } catch (e) {
        console.error('[Download PDF]', e);
        App.showToast('Failed to download PDF: ' + (e?.message || 'Unknown error'), 4000);
        return;
      }
    }
    if (!buf || buf.byteLength === 0) {
      App.showToast('No PDF available to download.', 3000);
      return;
    }
    downloadPdfBuffer(buf, sanitizeForFilename(App.state.currentProjectName) + '.pdf');
    App.logUserEvent('export_pdf', App.state.currentProjectId, { source: 'project-pdf' });
  }
  App.doOpenTakeoffTooling = doOpenTakeoffTooling;
  App.sanitizeForFilename = sanitizeForFilename;
  App.downloadPdfBuffer = downloadPdfBuffer;
  App.downloadProjectPdf = downloadProjectPdf;
  // D25: the picker follows the option under the pointer (This sheet vs Everything).
  bindPickerScopeHover(document.getElementById('forPipeToolingMenu'), 'pipeToolingLayerPicker', 'pipe-tooling-option');
  bindPickerScopeHover(document.getElementById('forTakeoffToolingMenu'), 'takeoffToolingLayerPicker', 'takeoff-tooling-option');
  bindPickerScopeHover(document.getElementById('copySummaryTextMenu'), 'copySummaryLayerPicker', 'copy-summary-option');
})();
