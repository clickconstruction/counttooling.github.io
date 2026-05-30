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
      Object.keys(require('./save-utils.js')),
      Object.keys(require('./icons.js')),
      Object.keys(require('./idb.js')),
      Object.keys(require('./format.js')),
      Object.keys(require('./icon-render.js')),
    )
    .map((k) => [k, 'readonly']),
);

// idb.js / format.js only reach for the store-name / cap / TZ constants by bare
// name; they must NOT receive their own exported function names as globals
// (no-redeclare would flag the local function declarations), so derive a
// constants-only set for them.
const constantsGlobals = Object.fromEntries(
  Object.keys(require('./constants.js')).map((k) => [k, 'readonly']),
);

// icon-render.js reaches for the icon-data globals (CUSTOM_ICONS,
// VB_384_512_PATHS, FA_PATHS) by bare name; same no-redeclare reasoning, so give
// it an icons-only global set (not its own exports).
const iconsGlobals = Object.fromEntries(
  Object.keys(require('./icons.js')).map((k) => [k, 'readonly']),
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

module.exports = [
  {
    ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'config*.js', 'eslint.config.js'],
  },
  js.configs.recommended,
  {
    // Definition modules: classic scripts whose top-level declarations exist
    // solely to be consumed cross-file by the index.html IIFE / report.js, so
    // no-unused-vars is pure noise here. `module` covers the dual-env footers.
    files: ['geometry.js', 'constants.js', 'icons.js', 'save-utils.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        module: 'readonly',
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'off',
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
    },
  },
  {
    // idb.js / format.js: pure modules extracted from app.js. Classic <script>s
    // loaded after constants.js, so they reference constants (store names / caps,
    // USER_ACTIVITY_TZ) by bare name (provided via constantsGlobals). Their
    // exported functions are consumed cross-file by app.js, so no-unused-vars is
    // noise here. no-undef stays an error (inherited from recommended) to catch
    // typo'd constants. They must NOT receive their own export names as globals
    // (no-redeclare would flag the local declarations), hence constants-only.
    files: ['idb.js', 'format.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...constantsGlobals,
        module: 'readonly',
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'off',
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
    },
  },
  {
    // icon-render.js: pure icon geometry / render-rule helpers extracted from
    // app.js. Classic <script> loaded after icons.js, so it reads the icon-data
    // globals (CUSTOM_ICONS / VB_384_512_PATHS / FA_PATHS) by bare name (provided
    // via iconsGlobals). Its exports are consumed cross-file by app.js, so
    // no-unused-vars is noise; no-undef stays an error. Like the constants-only
    // group, it must NOT receive its own export names as globals (no-redeclare).
    files: ['icon-render.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...iconsGlobals,
        module: 'readonly',
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'off',
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
    },
  },
  {
    // features/*.js: incremental splits of the app.js IIFE (window.App registry
    // pilot). Each is its own classic-script IIFE loaded AFTER app.js; it reads
    // shared state/helpers from the local `App` it declares (window.App) at call
    // time and registers its public entry points back onto it. no-undef stays an
    // error to catch typos / missing browser globals; no-unused-vars is off
    // (these files exist to publish onto App, not to be self-contained).
    files: ['features/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        module: 'readonly',
      },
    },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-unused-vars': 'off',
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
    files: ['*.test.js', '*.spec.js', 'cloud-test-helpers.js', 'scripts/**/*.js', 'playwright.config.js'],
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
        // IIFE-internal helpers that are reachable everywhere at runtime but
        // which eslint-scope cannot see from every call site, so they read as
        // no-undef. closePreparePdfModal is assigned to window (resolves via
        // the global object); hydrateProjectFromCloudRow and
        // resetAutoRecheckoutCounter are sloppy-mode function declarations
        // inside the `if (SUPABASE_ENABLED) {...}` block, hoisted to the IIFE
        // scope at runtime (Annex B.3.3) and only ever called on Supabase paths.
        closePreparePdfModal: 'readonly',
        hydrateProjectFromCloudRow: 'readonly',
        resetAutoRecheckoutCounter: 'readonly',
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
