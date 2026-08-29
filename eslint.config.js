// ESLint flat config. Scope: the extracted browser modules (geometry.js,
// constants.js, icons.js, report.js) and the Node tooling (tests, Playwright
// specs, scripts, config files). The inline <script> in index.html is NOT
// linted here - that needs an HTML processor (e.g. @html-eslint) and is left
// for a later pass.
//
// Run with: npm run lint

const js = require('@eslint/js');
const globals = require('globals');

// app.js (the former inline IIFE) consumes every name the sibling classic
// scripts declare; derive those from the modules' export footers so the lint
// globals stay in sync automatically as exports change.
const moduleGlobals = Object.fromEntries(
  []
    .concat(
      Object.keys(require('./geometry.js')),
      Object.keys(require('./constants.js')),
      Object.keys(require('./zoom-ladder.js')),
      Object.keys(require('./hotkeys.js')),
      Object.keys(require('./recent-colors.js')),
      Object.keys(require('./recent-drops.js')),
      Object.keys(require('./save-utils.js')),
      Object.keys(require('./save-engine.js')),
      Object.keys(require('./annotation-model.js')),
      Object.keys(require('./undo-stack.js')),
      Object.keys(require('./pdf-tile-cache.js')),
      Object.keys(require('./icons.js')),
      Object.keys(require('./icons-custom.js')),
      Object.keys(require('./idb.js')),
      Object.keys(require('./format.js')),
      Object.keys(require('./icon-render.js')),
      Object.keys(require('./line-metrics.js')),
      Object.keys(require('./canvas-draw.js')),
      Object.keys(require('./render-service.js')),
    )
    .map((k) => [k, 'readonly']),
);

// idb.js / format.js only reach for the store-name / cap / TZ constants by bare
// name; they must NOT receive their own exported function names as globals
// (no-redeclare would flag the local function declarations), so derive a
// constants-only set for them.
const constantsGlobals = Object.fromEntries(
  []
    .concat(Object.keys(require('./constants.js')), Object.keys(require('./zoom-ladder.js')), Object.keys(require('./hotkeys.js')), Object.keys(require('./recent-colors.js')))
    .map((k) => [k, 'readonly']),
);

// icon-render.js reaches for the icon-data globals (CUSTOM_ICONS,
// VB_384_512_PATHS, FA_PATHS) by bare name; same no-redeclare reasoning, so give
// it an icons-only global set (not its own exports).
// save-engine.js reaches for the constants (GLOBAL_RELOAD_* / CHECKOUT_* /
// SAVE_STATUS_LOG_*), the pure save-utils helpers (serializeSaveError), and the
// idb.js storage primitives (idbTakeoffBackup*, pdfCacheGet, takeoffBackupDelete,
// BACKUP_PDF_TO_INDEXEDDB) by bare name; same no-redeclare reasoning, so give it
// those modules' export sets (not its own).
const saveEngineGlobals = Object.fromEntries(
  []
    .concat(Object.keys(require('./constants.js')), Object.keys(require('./zoom-ladder.js')), Object.keys(require('./save-utils.js')), Object.keys(require('./idb.js')), Object.keys(require('./geometry.js')), Object.keys(require('./icons.js')), Object.keys(require('./icons-custom.js')))
    .map((k) => [k, 'readonly']),
);

const iconsGlobals = Object.fromEntries(
  Object.keys(require('./icons.js')).concat(Object.keys(require('./icons-custom.js'))).map((k) => [k, 'readonly']),
);

// line-metrics.js reaches for the pure geometry helpers (ptDist,
// polylineDistance, the bezier helpers, getScaleZoneForLine,
// getMultiplyZoneForLine) by bare name; same no-redeclare reasoning, so give it a
// geometry-only global set (not its own exports).
const geometryGlobals = Object.fromEntries(
  Object.keys(require('./geometry.js')).map((k) => [k, 'readonly']),
);

// app.js is a ~16k-line legacy file. We only want no-undef as an error (the
// high-value typo/missing-global guard); the rest of the recommended ruleset is
// surfaced as warnings to triage over time. Downgrade the whole recommended set
// to warn, then re-raise no-undef below.
const recommendedAsWarn = Object.fromEntries(
  Object.entries(js.configs.recommended.rules).map(([k]) => [k, 'warn']),
);

// Cross-file names report.js reads but does not declare. They are defined
// either by the main IIFE in index.html (loaded after report.js) or by the
// sibling data/constants modules / CDN libraries. Listed as readonly so
// no-undef passes while documenting the contract; assigning to one is flagged.
const projectGlobals = {
  // index.html IIFE state + helpers consumed by report.js
  state: 'readonly',
  makeAnnotations: 'readonly',
  ptDist: 'readonly',
  polylineDistance: 'readonly',
  formatDist: 'readonly',
  renderIconHtml: 'readonly',
  quickLineLength: 'readonly',
  getLineLengthPdfPts: 'readonly',
  getLineLengthForTotals: 'readonly',
  getLineLengthFeetForTotals: 'readonly',
  getLineLengthSplitForTotals: 'readonly',
  getLineRealWorldLength: 'readonly',
  getMultiplyZoneForLine: 'readonly',
  getMultiplyZoneForPoint: 'readonly',
  getMergedAnnotationsForPage: 'readonly',
  // shared constants / icon data (own modules, loaded before report.js)
  TOOL: 'readonly',
  COLORS: 'readonly',
  SCALE_PRESETS: 'readonly',
  CUSTOM_ICONS: 'readonly',
  ICONS: 'readonly',
  // CDN libraries loaded via <script> in index.html
  pdfjsLib: 'readonly',
  jspdf: 'readonly',
  html2canvas: 'readonly',
  supabase: 'readonly',
  PDFLib: 'readonly',
};

// One shape for every extracted classic-script module group: browser globals
// + the group's cross-file dependency globals (NEVER a module's own exports —
// no-redeclare would flag the local declarations) + `module` for the dual-env
// CommonJS footers; no-unused-vars off (the declarations exist to be consumed
// cross-file), no-undef stays an error from the recommended set. Collapses
// what were 8 verbatim-identical blocks (DECOMPOSITION_MAP Tier-4 #19); the
// per-group rationale stays as a comment at each call site.
function browserModule(files, extraGlobals) {
  return {
    files,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...(extraGlobals || {}),
        module: 'readonly',
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'off',
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
    },
  };
}

module.exports = [
  {
    ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'config*.js', 'eslint.config.js', 'vendor/', '.claude/'],
  },
  js.configs.recommended,
  // Definition modules: classic scripts whose top-level declarations exist
  // solely to be consumed cross-file by the index.html IIFE / report.js.
  browserModule(['geometry.js', 'constants.js', 'zoom-ladder.js', 'hotkeys.js', 'recent-colors.js', 'recent-drops.js', 'icons.js', 'icons-custom.js', 'save-utils.js']),
  // idb.js / format.js: classic <script>s loaded after constants.js, so they
  // reference constants (store names / caps, USER_ACTIVITY_TZ) by bare name.
  // Constants-only globals — NOT their own exports (no-redeclare).
  browserModule(['idb.js', 'format.js'], constantsGlobals),
  // icon-render.js: loaded after icons.js; reads the icon-data globals
  // (CUSTOM_ICONS / VB_384_512_PATHS / FA_PATHS) by bare name.
  browserModule(['icon-render.js'], iconsGlobals),
  // line-metrics.js: loaded after geometry.js; reads the geometry helpers
  // (ptDist / polylineDistance / bezier / zone locators) by bare name.
  browserModule(['line-metrics.js'], geometryGlobals),
  // canvas-draw.js: the annotation draw core (createCanvasDraw(deps));
  // loaded after geometry.js + icons.js, reads both by bare name; everything
  // state-coupled arrives via deps.
  browserModule(['canvas-draw.js'], { ...geometryGlobals, ...iconsGlobals }),
  // render-service.js: the raster seam (createRenderService(deps)) — browser
  // globals only (Worker, OffscreenCanvas, navigator); the rest arrives via deps.
  browserModule(['render-service.js']),
  {
    // render-worker.js: the dedicated pdf.js render worker. Worker global
    // scope (self/importScripts/OffscreenCanvas) + the pdfjsLib it imports.
    files: ['render-worker.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.worker,
        pdfjsLib: 'readonly',
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
    },
  },
  // save-engine.js + the other seam modules (createX(ctx)): loaded after
  // constants.js/save-utils.js/idb.js, read their exports by bare name
  // (saveEngineGlobals); everything state/closure-coupled arrives via ctx.
  // `tus` is the vendored resumable-upload lib (classic <script>).
  browserModule(['save-engine.js', 'annotation-model.js', 'undo-stack.js', 'pdf-tile-cache.js'], { ...saveEngineGlobals, tus: 'readonly' }),
  // features/*.js: incremental splits of the app.js IIFE (window.App registry).
  // Each is its own classic-script IIFE loaded AFTER app.js; reads shared
  // state/helpers from App at call time. Extra globals: the vendored libs
  // loaded before app.js, report.js's buildReportHtml (resolved at call time),
  // and the idb.js/constants classic-script globals some features read bare.
  browserModule(['features/*.js'], {
    pdfjsLib: 'readonly',
    jspdf: 'readonly',
    html2canvas: 'readonly',
    PDFLib: 'readonly',
    buildReportHtml: 'readonly',
    ...Object.fromEntries(Object.keys(require('./idb.js')).map((k) => [k, 'readonly'])),
    ...constantsGlobals,
  }),
  {
    // sw.js — the PWA service worker; its own ServiceWorkerGlobalScope (self,
    // caches, clients, skipWaiting, FetchEvent, ...), not the window globals.
    files: ['sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.serviceworker },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
    },
  },
  {
    // report.js consumes the cross-file project globals enumerated above.
    files: ['report.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...projectGlobals,
        module: 'readonly',
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
    },
  },
  {
    // Node CommonJS tooling: unit tests, Playwright specs + helpers, scripts,
    // configs. Playwright page.evaluate() callbacks run in the browser, so
    // browser globals are included alongside the Node ones, plus the handful
    // of app functions the specs reach for inside the page context.
    files: ['*.test.js', '*.spec.js', 'cloud-test-helpers.js', 'scripts/**/*.js', 'playwright.config.js', 'takeoff-eval.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.browser,
        // app functions exposed in the page, referenced inside page.evaluate()
        saveUserCustomIcons: 'readonly',
        getUserCustomIcons: 'readonly',
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
    },
  },
  {
    // app.js: the former inline index.html IIFE, now a classic <script src>.
    // Consumes the sibling modules' globals (auto-derived) + the CDN libs.
    // Only no-undef is an error; the rest of the recommended ruleset is warn.
    files: ['app.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...moduleGlobals,
        // CDN libraries loaded via <script> in index.html before app.js
        pdfjsLib: 'readonly',
        jspdf: 'readonly',
        html2canvas: 'readonly',
        supabase: 'readonly',
        PDFLib: 'readonly',
        tus: 'readonly',
        // IIFE-internal helpers that are reachable everywhere at runtime but
        // which eslint-scope cannot see from every call site, so they read as
        // no-undef. closePreparePdfModal is assigned to window (resolves via
        // the global object); hydrateProjectFromCloudRow and
        // updateSettingsCheckoutSection are sloppy-mode function declarations
        // inside the `if (SUPABASE_ENABLED) {...}` block, hoisted to the IIFE
        // scope at runtime (Annex B.3.3) and only ever called on Supabase paths
        // (updateSettingsCheckoutSection via the save-engine ctx).
        closePreparePdfModal: 'readonly',
        hydrateProjectFromCloudRow: 'readonly',
        updateSettingsCheckoutSection: 'readonly',
        openCheckoutExpiredRecoveryModal: 'readonly',
        // Sync block-scoped fn (Annex B.3.3 hoist), published at the tail
        // registry for features/load-project.js. The async block fns
        // (checkInCurrentProjectIfHeld / resolvePdfBufferForCloudProject /
        // buildPagesFromPdfArrayBufferAndProjectData) are NOT hoisted and are
        // published in-block instead, so they need no global here.
        openCopyProjectModalOrPromptSave: 'readonly',
      },
    },
    rules: {
      ...recommendedAsWarn,
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
    },
  },
];
