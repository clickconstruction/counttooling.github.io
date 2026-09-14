/*
 * CountTooling service worker — installable PWA + offline app shell.
 *
 * Strategy (two-tier, same-origin only):
 *   - Navigations / HTML  → network-first (fresh shell when online), cache fallback offline.
 *   - Other static assets → cache-first against a version-stamped precache installed
 *     atomically, so the offline shell is always a coherent single version.
 * Cross-origin (Supabase REST/auth/realtime/storage range-requests/TUS/functions) and
 * all non-GET requests are passed straight through to the network, untouched.
 *
 * CACHE_VERSION and PRECACHE_SHA256 below are GENERATED — do not edit by hand. Both are
 * stamped by `npm run build:sw` (and verified by `npm run build:sw -- --check` in CI):
 * CACHE_VERSION is a joint content hash of every file in PRECACHE_URLS (change any
 * precached asset and the browser installs a fresh SW, precaches the new asset set, and
 * purges the old cache on activate — no manual bump to forget), and PRECACHE_SHA256 maps
 * each URL to its own sha256 so the install can VERIFY every fetched asset before caching
 * it. GitHub Pages deploys propagate non-atomically (per-file CDN caches, ~10 min): a
 * visit mid-deploy can fetch a mixed shell, and without verification the install would
 * poison the cache with it PERMANENTLY (cacheFirst never revalidates). A hash mismatch
 * aborts the install instead — the old SW stays, and the browser retries on a later
 * visit once the CDN has settled. The app's admin "global force reload" clears caches
 * as a backstop.
 */
const CACHE_VERSION = 'ca1653201925';
const CACHE_NAME = `counttooling-shell-${CACHE_VERSION}`;

// The full same-origin app shell. Source of truth = the <script>/<link> tags in
// app/index.html, plus the vendored libs/fonts/icons and the manifest. config.local.js is
// intentionally excluded (gitignored / localhost-only — would 404 the install). The app
// lives at /app/ (the marketing site at / is plain static HTML, outside the SW scope).
const PRECACHE_URLS = [
  '/app/',
  '/app/index.html',
  '/config.js',
  '/styles.css',
  '/manifest.webmanifest',
  '/rules/rules.json',
  // head pure-modules (load order)
  '/icons.js',
  '/icons-custom.js',
  '/icon-render.js',
  '/geometry.js',
  '/line-metrics.js',
  '/conductor-model.js',
  '/circuit-model.js',
  '/bid-check-model.js',
  '/tag-model.js',
  '/support-model.js',
  '/duct-model.js',
  '/bid-basis-model.js',
  '/canvas-draw.js',
  '/render-service.js',
  '/render-worker.js',
  '/constants.js',
  '/zoom-ladder.js',
  '/hotkeys.js',
  '/recent-colors.js',
  '/recent-drops.js',
  '/idb.js',
  '/format.js',
  '/save-utils.js',
  '/annotation-model.js',
  '/undo-stack.js',
  '/save-engine.js',
  '/pdf-tile-cache.js',
  // main app
  '/app.js',
  // feature-file splits (window.App registry)
  '/features/canvas-repair.js',
  '/features/view-only.js',
  '/features/save-project.js',
  '/features/pdf-intake.js',
  '/features/line-color.js',
  '/features/custom-icon-upload.js',
  '/features/note.js',
  '/features/zoom.js',
  '/features/zoom-rail.js',
  '/features/manage-icons.js',
  '/features/multiply-zone-settings.js',
  '/features/export-pdfs.js',
  '/features/bid-basis.js',
  '/features/legend-settings.js',
  '/features/page-settings.js',
  '/features/counter-settings.js',
  '/features/line-type-settings.js',
  '/features/choose-create-line-type.js',
  '/features/scale.js',
  '/features/scale-zone-settings.js',
  '/features/groups.js',
  '/features/grid.js',
  '/features/quick-line.js',
  '/features/counter.js',
  '/features/save-status.js',
  '/features/status-bar.js',
  '/features/turn-in.js',
  '/features/manage-projects.js',
  '/features/user-admin.js',
  '/features/load-project.js',
  '/features/bid-board.js',
  '/features/review-flow.js',
  '/features/copy-project.js',
  '/features/prepare-pdf.js',
  '/features/quick-modals.js',
  '/features/pdf-bundle.js',
  '/features/item-details.js',
  '/features/output.js',
  '/features/rfi-flags.js',
  '/features/notes-ledger.js',
  '/features/share-links.js',
  '/features/import-clear.js',
  '/features/zone-modals.js',
  '/features/restore-last-session.js',
  '/features/summary-detail.js',
  '/features/room-sizer.js',
  '/features/burger-menu.js',
  '/features/header-more.js',
  '/features/canvas-layers.js',
  '/features/ghost.js',
  '/features/canvas-switcher.js',
  '/features/summary-list.js',
  '/features/my-settings.js',
  '/features/palette-insights.js',
  '/features/user-activity.js',
  '/features/user-activity-overview.js',
  '/features/tool-context-menu.js',
  '/features/lines-list.js',
  '/features/pages-list.js',
  '/features/sidebar-lists.js',
  '/features/quick-keys.js',
  '/features/keyboard-map.js',
  '/features/chain.js',
  '/features/drop-mode.js',
  '/features/duct-tool.js',
  '/features/duct-size-popover.js',
  '/features/duct-fittings.js',
  '/features/duct-sidebar.js',
  '/features/duct-schedule.js',
  '/features/duct-suggest.js',
  '/features/duct-callouts.js',
  '/features/drop-peek.js',
  '/features/highlight-labels.js',
  '/features/hotkey-peek.js',
  '/features/child-counts.js',
  '/features/conductors.js',
  '/features/circuits.js',
  '/features/bid-check.js',
  '/features/duct-bidcheck.js',
  '/features/rules.js',
  '/features/tag-reader.js',
  '/features/tutorial.js',
  '/features/twin-badge.js',
  '/features/auth-magic-link.js',
  '/report.js',
  // vendored runtime libraries (incl. the lazily-fetched pdf.js worker — required for offline render)
  '/vendor/pdf.min-3.11.174.js',
  '/vendor/pdf.worker.min-3.11.174.js',
  '/vendor/pdf-lib-1.17.1.min.js',
  '/vendor/html2canvas-1.4.1.min.js',
  '/vendor/jspdf.umd-2.5.1.min.js',
  '/vendor/supabase-js-2.108.0.min.js',
  '/vendor/tus-js-client-4.3.1.min.js',
  // self-hosted fonts
  '/vendor/fonts/fonts.css',
  '/vendor/fonts/dmsans-300-normal-latin.woff2',
  '/vendor/fonts/dmsans-300-normal-latin-ext.woff2',
  '/vendor/fonts/dmsans-400-normal-latin.woff2',
  '/vendor/fonts/dmsans-400-normal-latin-ext.woff2',
  '/vendor/fonts/dmsans-500-normal-latin.woff2',
  '/vendor/fonts/dmsans-500-normal-latin-ext.woff2',
  '/vendor/fonts/dmsans-600-normal-latin.woff2',
  '/vendor/fonts/dmsans-600-normal-latin-ext.woff2',
  '/vendor/fonts/dmmono-400-normal-latin.woff2',
  '/vendor/fonts/dmmono-400-normal-latin-ext.woff2',
  '/vendor/fonts/dmmono-500-normal-latin.woff2',
  '/vendor/fonts/dmmono-500-normal-latin-ext.woff2',
  '/vendor/fonts/instrumentserif-400-normal-latin.woff2',
  '/vendor/fonts/instrumentserif-400-normal-latin-ext.woff2',
  '/vendor/fonts/instrumentserif-400-italic-latin.woff2',
  '/vendor/fonts/instrumentserif-400-italic-latin-ext.woff2',
  // PWA icons
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-180.png',
];

// Per-file integrity hashes for the verified install. GENERATED by
// `npm run build:sw` — do not edit by hand (see the header comment).
const PRECACHE_SHA256 = {
  '/app/': '288698f89d621e1e31a230cdaed527c682b0be84f7762ed089e52e0682b6a095',
  '/app/index.html': '288698f89d621e1e31a230cdaed527c682b0be84f7762ed089e52e0682b6a095',
  '/config.js': '455a751857efe37a6c08d3922448bca7f57767b923e39826239a6f187608b05a',
  '/styles.css': '3116f394977a2a2b81e685213ca75d4b21b05f629bcc66441c167045631bcada',
  '/manifest.webmanifest': '91c2a30960da9245e4472fb4b3c2ba818a505179d0c4cd58a35e53ae3c0722df',
  '/rules/rules.json': '4fad0716f98809c79c9a32bb6c9e3365b737119f8e1f9e3ac5001caa4a6791ab',
  '/icons.js': 'bb3c3506a859d25685287d0c1d3afb3231601754555aea403505e7ca8d68779b',
  '/icons-custom.js': 'efe6b960301031a5fb40abc2f54de18798e19f4b7b04e0eccb81b47f1e9cacad',
  '/icon-render.js': 'e4f3807d1ab13f61b3d0f33ec833455defa3b0d6795139ea2e61c94c1e1a9b47',
  '/geometry.js': '132ab8c676657d177634ddb9a29a27b554779d5a01dfa5e2d687dbaffb73f625',
  '/line-metrics.js': '79e7bdbc91c02ebd4c62be3a26ad33eb5822d11d7233d75eb67a8de72a5c2126',
  '/conductor-model.js': '2fdea89c54aefa85ff19260a1dd02a2d83a3d94477bda95be451fd309a6de01a',
  '/circuit-model.js': '19e0de705524e0390476d4f9346008ffdad190786c8b1720eb4a8dab64febc09',
  '/bid-check-model.js': '90eda910553f550c47f5be81b777b6b334ea76687421305da9a282f41faa0950',
  '/tag-model.js': '26bb52e7a00b42f2e5e7168f07323c899cdf0e2b594546fccabd60742de3102e',
  '/support-model.js': '3bdf6da1ecca431ecb25904ea944e2f3838a445c088fe4d7fb0d616982839c21',
  '/duct-model.js': 'e501012a1eacd189a5d9c51190c5e29c770116261526e1c6aaba959319201926',
  '/bid-basis-model.js': '825fc0a1cfd1a765dbb3bab5f06eb49c9780253d071def87784939e194a834f0',
  '/canvas-draw.js': 'd87959f14f59f60d72f0e25e98eca6b47af53b981e700c388676af6ba4872a81',
  '/render-service.js': '077e7474ba588a262ca7fe01183271af85d8a9a105e4c90cb1ebd5ed7d8ab0da',
  '/render-worker.js': '97409f02a7150a5f9b5e456769083b49dca0c7baaae0263a34e2fc7a1d23a54d',
  '/constants.js': '50d6c9dd6351965c230bc5cbbfbd1d654dc6ab6392440629d6551ceeefc290c0',
  '/zoom-ladder.js': 'c8396a9b8610ce94c703b575e3180ad3152d17a5b23c9e576c8d45b980005ba3',
  '/hotkeys.js': 'ed2e426116633f881d724af2f3fa4c9520172492271ed86bfce238ee3af41392',
  '/recent-colors.js': '01a7af7515a037ac51f0819601156c64035b903ce55a2739a5393988792285a7',
  '/recent-drops.js': '3b04d7b96c6260858a3ce9de59a9e862fa88ddf3e563de3ef46d354020358b7b',
  '/idb.js': '9049553ce54d58b56dc33d8e166721ba26602cfd65b82098a6a51c59956c75da',
  '/format.js': 'c8958ee9c4f87c854deebc128f2db5b7e1c25b33dfe5d2f68334ac947b844ea5',
  '/save-utils.js': '3ba2623bcd4981c6289555e2172805a9592ba4c789ea180fc7623f6aa27c9c25',
  '/annotation-model.js': '125705b50b82fb8b984617619cdd9d8df05569d79009dde8c2158b6484c31061',
  '/undo-stack.js': 'd8cf087ca14582810073d684950e5d7b699ee83ada8e9b38af029c608165f958',
  '/save-engine.js': '33f287117d08895f0320b25335aec56ca6add40c4566fc9c1c378e66d0a7c5ca',
  '/pdf-tile-cache.js': 'd9d520d6399480191df2b97038ce0b453803666d79f1b804a995484e98fc5772',
  '/app.js': '0f42118289add98434da74dbc5fb4f82e9c026d7411ae7f34c5642f7fab4badd',
  '/features/canvas-repair.js': 'd07714d342ca087e382424751718f1d827754c35f82da63a923ac8ce5781ce15',
  '/features/view-only.js': '9661cefd7251eb82a9459bb348f31320500c590cbd745bb7153f424e612b51f9',
  '/features/save-project.js': 'f97a6e7abbb63388a22c5cf05fd69b0f7a700f051d9e10fba77758febf0c59c2',
  '/features/pdf-intake.js': '5afb884a3916a754a672e0d3715aaabcdcd60966988f106cf8fc79e67326a90e',
  '/features/line-color.js': '2fd4c7594f1a3686fd9323b7bc4d97f5b9c151b32475d5a4428062a075378ecb',
  '/features/custom-icon-upload.js': '37de2928d10b860235e81f64c96cce7cbde292f9d8c921c82221fe91901eaa95',
  '/features/note.js': 'b7cc88aa00ac8a2450c59299959108ae3bd5b18b0e420fd61264533c23347d6b',
  '/features/zoom.js': 'cceb56f7ae4c91124aa17b246b276b9796463dc27ce93835a849f5a3d31f31fc',
  '/features/zoom-rail.js': 'd9fd46d047c55cac555c2c1cfac70f4d36b9f537302efc400a3e240d6edfbcc6',
  '/features/manage-icons.js': '05d99d299583073854b53f7fd67601b791357e19cb3c4c72f17fde645496ccc0',
  '/features/multiply-zone-settings.js': 'e808757a5758d7c0ba64d989ef3f6e051266b40a26ff01ae9ea8187b7b834dee',
  '/features/export-pdfs.js': '7c68308778223e080c709d035c8ab230a6cbcdb236a65c52b804843e5f649e36',
  '/features/bid-basis.js': 'e8b56590a3725bb169c5e60a2a48b007ead5104367d7ad0e920828e58200c060',
  '/features/legend-settings.js': '709631f3263de10397d4edba65d7b66c93574e7dd5ed27dc6761c1f1b173a63a',
  '/features/page-settings.js': '2e9b961016930ea467a50e9a426cf8aa3a901f10dd2fb2fbe11a9186c7020e40',
  '/features/counter-settings.js': '7ffa8f737269666f7de0efc1e4a83edd4539d0e43e9299a76c6e253534d1820a',
  '/features/line-type-settings.js': '91bcfa06e0f4d29360effb6b1178d869020cbb5aa427f2e2550eb3b1fa48ed60',
  '/features/choose-create-line-type.js': 'fd26611fd14483d91a3da3c823d2a0fd3331c665311653e11cc8a03cf7fdff81',
  '/features/scale.js': '5d64f691ba2aee5bfcf20e00d80b916daad08a0111415091b6c4659882c49e3a',
  '/features/scale-zone-settings.js': '67a8a802e7aeaf629a235dbd0e4d9c42ea5c746412ae6749b90ecf35be7a9c9f',
  '/features/groups.js': 'a6397bfbea34bfbd7b67b6eacee0c4f048c58bdd267a256b14fcde96696049c1',
  '/features/grid.js': 'e8819e7a36df6e8911090ca3eb03946c53bb36dc97b5dbeac6fb5c00520719d3',
  '/features/quick-line.js': 'e86ad2bf25f3cfd3da2455eff215f150551b30d6ac52116d0ea556f6ad0f9088',
  '/features/counter.js': '1e4a70cb23d65e7b940e2b508727beebee298e0d28d6460a5b5d36aee05202e2',
  '/features/save-status.js': 'd4af89c0258d6609d19b402ec5684198948d44fc75d7446592e79d29bf15d919',
  '/features/status-bar.js': '5360434f3988d7a72682aa81ad288e3893072f12fcd0d1979173d26e2648c768',
  '/features/turn-in.js': 'e3c2af69f1693f3819cb31733aeead36be659546f53d86c0da406dadee664944',
  '/features/manage-projects.js': '2b8bdb4ce00fbfa84097a651a76b07e2fc28e7dd483639ceb3d172122d0f076f',
  '/features/user-admin.js': '3857cff271dbb61e78c2c76bd2dee626d6327058243725c911c03736bdb5371a',
  '/features/load-project.js': 'd4ec1396f8e3b2def493bcc26522691c6a55ec6e5c5e03708d1bd0066737950f',
  '/features/bid-board.js': '81b907e0a0e93c832303af7df85367a5fa11736098adbc2083990ff9c487a770',
  '/features/review-flow.js': '7fe62b8120ac3ea327db6851365a4b17ef19e60fa8bf5646ccc3970d142f2405',
  '/features/copy-project.js': '688187dbaac951419221e45d9a97076eb693d98dc6c736e244d88bb7cb9bfe56',
  '/features/prepare-pdf.js': 'fa59aad964c2c0282cd1e85f38aca90a099ae38905376fe023c59d38cc39f76d',
  '/features/quick-modals.js': '349df679c17c2bfb466988ae23c9423398bd656b1f9301466ca399df240575cc',
  '/features/pdf-bundle.js': '9f08fe5a316ff8c82561c4655c6b2d4d4858268bb3ee2807fe6e61df0cc8351e',
  '/features/item-details.js': 'ace7fb2eb336e47ade33873e31997cc75b488bcaca42559564dc275228353822',
  '/features/output.js': '69f8d30c9fd15bbc47f29abb186846cd2c55966c68d72fe4a9dd11a565d453c7',
  '/features/rfi-flags.js': '40681e1143dc5bc64374c4e6a0bf9e2f30c246f8c4c34d81bc5635e38ce64949',
  '/features/notes-ledger.js': '4ec3842847eb36b1ed1e13128247c8421cda7af05a302fef6942a4de72bfe719',
  '/features/share-links.js': 'a9d0a7546b38fff5c7b0aa17adf583bd3edc20e3e71939d3c233ec24651ff2b5',
  '/features/import-clear.js': 'eeaf74f8ad012ebffc64170df37ec26a782995de31cca43e02d6c0ce4160c4d0',
  '/features/zone-modals.js': '48943280aa220ba4206c9d7a6abafdbcd989643c60203af0c071460fdf09dcae',
  '/features/restore-last-session.js': '2c4458520fa731613839dfe0bde7af14a708c2bdd9baa6d7a25fe147d69c76c8',
  '/features/summary-detail.js': 'dc82451da2877e4cc06438f84f5133c10f134cbd7cdb83ad161650b87331bd91',
  '/features/room-sizer.js': 'a77f48d992f75d25f9f5672c80157639a42b75bbe358a4cb0f46d898f94a8da7',
  '/features/burger-menu.js': 'defc53bc9189dc014ca34f7f6e679881b2f00dbd499592b07faec95edaa3cc9f',
  '/features/header-more.js': 'c82196d844c8524e513cc84d9706a5c8d26e4325dfed4b86515228ad7f0a0eb5',
  '/features/canvas-layers.js': '70e4624b94af4a178bebc998bfa521eac07a4a519510aff81f55837673e4e06b',
  '/features/ghost.js': '30c28ea6ee106cc520244660c5d7aff3cabc44b986b503fe57276e98ba1a01e7',
  '/features/canvas-switcher.js': 'c0ea8b7843663e5366d4a1d4340fe53fcae1851ab6ca43f09e81af80ddcfeadd',
  '/features/summary-list.js': '38a79e5f470e2f74fd3422de623ad239ea6642c0f0d2ad58bba08d8f7843bc6a',
  '/features/my-settings.js': 'ed1a9bfed5bbfed3d3e9e263ac998be257d0a8b8c34fabdfee2beb45daffd537',
  '/features/palette-insights.js': '2268e32a9ec178fe6b30f9cf3f8eb82c15c01758b61991aee7a36c78e3653c6f',
  '/features/user-activity.js': 'd3423479a75393cbb12b013e955d25868ba9dc00ea76c3a81d1fdba36e7f3cce',
  '/features/user-activity-overview.js': '9bd65128aea3d7f1f5f328607f746dc3dff9609f1bae5cf953a1772f467784ac',
  '/features/tool-context-menu.js': 'b3eaa212bea057c6497afddaba467cc9ce0a03f4f922559b49b914824fbe1266',
  '/features/lines-list.js': '77f2e61df196cda4fb3f476d8d48d8ed7348ab20b1d71a7cfbe7e126a0fc279c',
  '/features/pages-list.js': 'c1dc03b1e1d12e7c86b13f582099bd61c2e2bcfb80b7379fc84906287c630a06',
  '/features/sidebar-lists.js': 'b2acc65681ecab1e3838569e6f8a4d75a608b427e93316c4f109e8ae321dbf67',
  '/features/quick-keys.js': 'df1540eb417c11006f1340c77a9b51b92e3a3c9ac6a5c307cc7ce0c9574d9af6',
  '/features/keyboard-map.js': 'adb5bc7bd0558467b919d29f5232167f994ed21e1d6b2cfe6e23164d6b9aa178',
  '/features/chain.js': '205296a761350bf9b6e1ad134923f8338f4a162f04fdb79bd8b4fcbdb01fb565',
  '/features/drop-mode.js': '72b38bebd6a78bf9287c770f8dce1d262171ed5aa1634b0f095ddae7b91eedda',
  '/features/duct-tool.js': '37ac73e16334868d1c12e0505d6b711eed415b772a51427df2f8eb80ddc937b6',
  '/features/duct-size-popover.js': '7815b986d05160667c6bfafc7c974e6d3787b64f7b9ad2ce287fd2b06dbc3622',
  '/features/duct-fittings.js': '5f7928fb342f6f68361c2e1da2c9069ee71d2d35968f50a23ec6ce2f722587d7',
  '/features/duct-sidebar.js': 'a5ade321bfe1a04081050a90c430833c4280bc2f9719b682a84901362b173a06',
  '/features/duct-schedule.js': '3dbd98468c5d7c4ba01944bc6111e76dd98e751b1702ca0d97a9fcb711a5fb37',
  '/features/duct-suggest.js': '5c420072e6c7473e86bde8e94e27d7e98d20b728c2d35516963ebeabd04d8a3a',
  '/features/duct-callouts.js': '6b3419d89e4f4e405fa4281e9e5d8cf64f821e38fc5c92c6c63c81bd9fde1166',
  '/features/drop-peek.js': '07b8990e4b1cbed96b1b4416b440ac39f5f5b1c9fd5159b34867c34e502263dc',
  '/features/highlight-labels.js': '662740b54bdab6ab283400bd30a1071e7b8c8c703e7be1588498d217caacaf7f',
  '/features/hotkey-peek.js': '6f8453b22b2a5ee1b84d5760c00b47dc45f94a435ff59f7d9c991b88b6f30820',
  '/features/child-counts.js': '03ee7699cc6c4e57dcabeda86e38a1325c310b7153fa079a6799f33cc482437a',
  '/features/conductors.js': '7ac2a8e47b3d9c73e91805cc95261fee801c0d8469cdb6428f1a399a428e03ef',
  '/features/circuits.js': '47821b96a2682b9cda3e0289ceb611bbf74881e93fe9ebac4cba1e720e29fae3',
  '/features/bid-check.js': '5ee24eb11d685d52003d4c3e06f445813e7554a233cdce99d3b1f5019400796d',
  '/features/duct-bidcheck.js': '507f6546685a108e9d93769bf435396366fb8b721c77a9566ee3dc896034e49b',
  '/features/rules.js': '177417cff5a2eca101fc311e47451f12b7af01eafda05d86525527af44af3152',
  '/features/tag-reader.js': '615b9ca118081f756834d8aa6ba36a2712dd56396b66a58e85de2df38b86ac02',
  '/features/tutorial.js': 'da0126f5dd388665825e4ef697ff4ff1ea1e21cb9c2a6f1ed2a3dc0ada739ab9',
  '/features/twin-badge.js': '2b3f7def0ce1691fd9468af9a01aab67a74eb17dd764130bdc00d5464bce010b',
  '/features/auth-magic-link.js': '900d106a478f652c23210c28526db5c4a0929619b3fa54aef00647521d38f964',
  '/report.js': '2d19fdb5160da3c6203df204af77d1ba8678bc6fa9d21b804a62ca16320f11a5',
  '/vendor/pdf.min-3.11.174.js': '5b5799e6f8c680663207ac5b42ee14eed2a406fa7af48f50c154f0c0b1566946',
  '/vendor/pdf.worker.min-3.11.174.js': 'feabdf309770ed24bba31a5467836cdc8cf639c705af27d52b585b041bb8527b',
  '/vendor/pdf-lib-1.17.1.min.js': '0f9a5cad07941f0826586c94e089d89b918c46e5c17cf2d5a3c6f666e3bc694f',
  '/vendor/html2canvas-1.4.1.min.js': 'e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb',
  '/vendor/jspdf.umd-2.5.1.min.js': '98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875',
  '/vendor/supabase-js-2.108.0.min.js': '005a6b7d396160fbe924316baa98adf198dc6f99a63412e27edec9675c225270',
  '/vendor/tus-js-client-4.3.1.min.js': '8cbb1b63fccc3bba0ae73ad1deb160ce046c3750851d0c3e94921ae3ef070eb8',
  '/vendor/fonts/fonts.css': '752c6612ddc928ba5144c45b23d3e6266969c760b6cac410b14ca3f2eddf4afe',
  '/vendor/fonts/dmsans-300-normal-latin.woff2': '468d56b6b25b05b70190b6c233d773f6f1770e8579827ce022a57f03fa8002fb',
  '/vendor/fonts/dmsans-300-normal-latin-ext.woff2': '219b02c7d8884817d3d6ad4c8771f2c000ce4c5669a67ef4e2e5617ffa25c4cc',
  '/vendor/fonts/dmsans-400-normal-latin.woff2': '468d56b6b25b05b70190b6c233d773f6f1770e8579827ce022a57f03fa8002fb',
  '/vendor/fonts/dmsans-400-normal-latin-ext.woff2': '219b02c7d8884817d3d6ad4c8771f2c000ce4c5669a67ef4e2e5617ffa25c4cc',
  '/vendor/fonts/dmsans-500-normal-latin.woff2': '468d56b6b25b05b70190b6c233d773f6f1770e8579827ce022a57f03fa8002fb',
  '/vendor/fonts/dmsans-500-normal-latin-ext.woff2': '219b02c7d8884817d3d6ad4c8771f2c000ce4c5669a67ef4e2e5617ffa25c4cc',
  '/vendor/fonts/dmsans-600-normal-latin.woff2': '468d56b6b25b05b70190b6c233d773f6f1770e8579827ce022a57f03fa8002fb',
  '/vendor/fonts/dmsans-600-normal-latin-ext.woff2': '219b02c7d8884817d3d6ad4c8771f2c000ce4c5669a67ef4e2e5617ffa25c4cc',
  '/vendor/fonts/dmmono-400-normal-latin.woff2': 'fd7521f3531a5ccfc655b25c4f22e9871df3ec141ad79bb27fde20d0df347b6d',
  '/vendor/fonts/dmmono-400-normal-latin-ext.woff2': '7f8712cbbd64135f9e74a527475a97cd8c5a49d8e0a1de7a65f8e2c30c5214d9',
  '/vendor/fonts/dmmono-500-normal-latin.woff2': '0e263db52797086e763679c54f84ded8cc1249879bc27dca2bd5dd446f6d9f36',
  '/vendor/fonts/dmmono-500-normal-latin-ext.woff2': 'e284f2a17fc9cca89cc30f496945bd9a2903010944a9469fb357924da21b6f6c',
  '/vendor/fonts/instrumentserif-400-normal-latin.woff2': '60c06664b5a95c7de6cc3e00d1f9034d78bd1e40b564016b241674449a067d4d',
  '/vendor/fonts/instrumentserif-400-normal-latin-ext.woff2': 'a8c4bd7cd7073180e740d2d83a616b5cb0845579b73207eeafeae8532e70c901',
  '/vendor/fonts/instrumentserif-400-italic-latin.woff2': '6ee678c33f388dd7ba59700ebea635deb98821baafd817b09891f7927177f702',
  '/vendor/fonts/instrumentserif-400-italic-latin-ext.woff2': 'a04fc7ed18a8037149ce0bfda58076709d8e0840e136ed00abbdc196b7992443',
  '/icons/icon-192.png': '781e4ba8c61ce18e914cff050e88d61855349840a53b01b08ab04b7b8a869c30',
  '/icons/icon-512.png': '27f3008b99b2b5c2567ed340083562646f24f8286ed68bbaf447dfc8c5d48e43',
  '/icons/maskable-512.png': '0aa7e5e38b19d348ae3685086ae43c5a5029a2fda6aaf2a20ebccc61e70ffd49',
  '/icons/apple-touch-180.png': '0f30ff91a4ad2cabe5bd1f9c52b867731085f445f1cf2d1661e6c638493c9afe',
};

self.addEventListener('install', (event) => {
  event.waitUntil(precacheVerified().then(() => self.skipWaiting()));
});

// The verified replacement for cache.addAll: fetch every precache asset
// straight from the origin (cache: 'reload' — the HTTP cache could hand back a
// pre-deploy body that no longer matches the new sw.js's hashes), check its
// sha256 against PRECACHE_SHA256, and cache only verified bytes. ANY mismatch
// or failed fetch rejects the install: a mid-deploy CDN serving a mixed shell
// can no longer be captured into the version-stamped cache. Entries verified
// before the failure are already cache.put — harmless: they are byte-correct
// for THIS version, activate never runs on a failed install, and a later
// successful install re-puts everything. Browsers without crypto.subtle skip
// the check for that entry (yesterday's behavior).
async function precacheVerified() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(PRECACHE_URLS.map(async (url) => {
    const res = await fetch(new Request(url, { cache: 'reload' }));
    if (!res || !res.ok) throw new Error('precache fetch failed (' + (res && res.status) + '): ' + url);
    const expected = PRECACHE_SHA256[url];
    if (expected && self.crypto && self.crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', await res.clone().arrayBuffer());
      const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
      if (hex !== expected) throw new Error('precache hash mismatch (mid-deploy CDN?): ' + url);
    }
    await cache.put(url, res);
  }));
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('counttooling-shell-') && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Non-GET (Supabase writes, TUS PATCH/POST, etc.) → straight to network.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Cross-origin (Supabase REST/auth/realtime/storage range-requests/functions, etc.) → network.
  if (url.origin !== self.location.origin) return;

  // config.local.js is intentionally outside the precache (gitignored,
  // localhost-only) — never runtime-cache it either, or a dev's credential
  // edits get pinned to the first version cacheFirst ever saw.
  if (url.pathname === '/config.local.js') return;

  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  event.respondWith(isHtml ? networkFirst(req) : cacheFirst(req));
});

// Network-first for the entry document: always boot the freshest shell online, fall back
// to the precached HTML offline.
async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await withTimeout(fetch(req), 4000);
    if (fresh && fresh.ok) { cache.put(req, fresh.clone()).catch(() => {}); return fresh; }
    if (fresh) return fresh;
    throw new Error('no-response');
  } catch {
    return (await cache.match(req))
      || (await cache.match('/app/index.html'))
      || (await cache.match('/app/'))
      || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Cache-first against the version-stamped precache: guarantees a coherent shell version
// offline; only hits the network for a precache miss.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok && fresh.type === 'basic') cache.put(req, fresh.clone()).catch(() => {});
    return fresh;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}
