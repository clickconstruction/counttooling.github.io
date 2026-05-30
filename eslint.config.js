// ESLint flat config. Scope: the extracted browser modules (geometry.js,
// constants.js, icons.js, report.js) and the Node tooling (tests, Playwright
// specs, scripts, config files). The inline <script> in index.html is NOT
// linted here - that needs an HTML processor (e.g. @html-eslint) and is left
// for a later pass.
//
// Run with: npm run lint

const js = require('@eslint/js');
const globals = require('globals');

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
    files: ['geometry.js', 'constants.js', 'icons.js'],
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
];
