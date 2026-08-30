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
const CACHE_VERSION = '44843b5bc8ac';
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
  // head pure-modules (load order)
  '/icons.js',
  '/icons-custom.js',
  '/icon-render.js',
  '/geometry.js',
  '/line-metrics.js',
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
  '/features/drop-peek.js',
  '/features/highlight-labels.js',
  '/features/hotkey-peek.js',
  '/features/child-counts.js',
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
  '/app/': '69217f9c1374579b270afe5145a4f7f348bc8f674698670fe92161b692ec0a03',
  '/app/index.html': '69217f9c1374579b270afe5145a4f7f348bc8f674698670fe92161b692ec0a03',
  '/config.js': '455a751857efe37a6c08d3922448bca7f57767b923e39826239a6f187608b05a',
  '/styles.css': '9fe1e702fffd424206cee26b85ab3e0a4d760cab0020d90b84beb42bbc73b07b',
  '/manifest.webmanifest': '91c2a30960da9245e4472fb4b3c2ba818a505179d0c4cd58a35e53ae3c0722df',
  '/icons.js': 'bb3c3506a859d25685287d0c1d3afb3231601754555aea403505e7ca8d68779b',
  '/icons-custom.js': 'f764721b21760d0138c3f4f5bd67427201e5f7e85a76e72501fb2c3a3852390e',
  '/icon-render.js': '5d1908bb487beec11db3b198b8314155497ad554389448ac6b69ecf4e10cf16e',
  '/geometry.js': '53252a22d0abcb6d4fc2141c7d7127e7e7b420a0c6f25a89a967006fdbde4171',
  '/line-metrics.js': '5d4b0d85794dd694cb8cffb8fe125b8dce64c270c34e6c5fe2dbf9677d4f333d',
  '/canvas-draw.js': '4db0d77145896746087c7638d07d07f991a983a1230df92080581dc6185305bf',
  '/render-service.js': '077e7474ba588a262ca7fe01183271af85d8a9a105e4c90cb1ebd5ed7d8ab0da',
  '/render-worker.js': '97409f02a7150a5f9b5e456769083b49dca0c7baaae0263a34e2fc7a1d23a54d',
  '/constants.js': '8400e88511718883173329bab3ad8921df64ee8d7e0896670bfbfd1846959beb',
  '/zoom-ladder.js': 'c8396a9b8610ce94c703b575e3180ad3152d17a5b23c9e576c8d45b980005ba3',
  '/hotkeys.js': '481ef7e17f26b8463bda701a46932eba606b1178db909e4042ef0133716bf3d3',
  '/recent-colors.js': '8f201f7c7e067580483aab71948653274ce8c97facfb0a25f56f51517e5c5f84',
  '/recent-drops.js': '3b04d7b96c6260858a3ce9de59a9e862fa88ddf3e563de3ef46d354020358b7b',
  '/idb.js': '9049553ce54d58b56dc33d8e166721ba26602cfd65b82098a6a51c59956c75da',
  '/format.js': 'c8958ee9c4f87c854deebc128f2db5b7e1c25b33dfe5d2f68334ac947b844ea5',
  '/save-utils.js': '3ba2623bcd4981c6289555e2172805a9592ba4c789ea180fc7623f6aa27c9c25',
  '/annotation-model.js': 'd1796a650a5cce82e6e1650d54954cb8fb900c1b7e9e6e54bedd1972b90d24e3',
  '/undo-stack.js': 'd8cf087ca14582810073d684950e5d7b699ee83ada8e9b38af029c608165f958',
  '/save-engine.js': '0dd72fb689f22d5f3b4e171ecf9a13d579cbb7c3957c22ebb2d15a7713628f82',
  '/pdf-tile-cache.js': 'cd2631a09682e5b5216e805f4d44c5a75c5bbc01fbbb6237d2bf62bf021e5ade',
  '/app.js': '43036dd3830f2ec2816107abdd179693525c1cfd85a370f515f0e6813a479abd',
  '/features/canvas-repair.js': 'd07714d342ca087e382424751718f1d827754c35f82da63a923ac8ce5781ce15',
  '/features/view-only.js': '71c606962b3d12944aba1151b26f1b859bd4a2e1c0c30ca35f4190bc8082ca03',
  '/features/save-project.js': 'f97a6e7abbb63388a22c5cf05fd69b0f7a700f051d9e10fba77758febf0c59c2',
  '/features/pdf-intake.js': '1837bbb6ce20599528cbf70616617172749ef96db83639f4113ea3550ea3cff5',
  '/features/line-color.js': '2fd4c7594f1a3686fd9323b7bc4d97f5b9c151b32475d5a4428062a075378ecb',
  '/features/custom-icon-upload.js': 'be658684a030a35c972d942c68c1c25389377495018b835a6ea42e69be56777f',
  '/features/note.js': 'b7cc88aa00ac8a2450c59299959108ae3bd5b18b0e420fd61264533c23347d6b',
  '/features/zoom.js': 'cceb56f7ae4c91124aa17b246b276b9796463dc27ce93835a849f5a3d31f31fc',
  '/features/zoom-rail.js': '6f7ba9773c77b3c5d28977d087525fec3de534387a669344b5bdc7d04538e60d',
  '/features/manage-icons.js': '9c079b1b0e0b67d3d1f9c1078a283fc4ed5e71f2f28c3d316974bf06ca2cdad1',
  '/features/multiply-zone-settings.js': 'e808757a5758d7c0ba64d989ef3f6e051266b40a26ff01ae9ea8187b7b834dee',
  '/features/export-pdfs.js': '78b87c4447cdabf313f6bb0d3d69283d0ed34189a6d466f8b3892f4f5aa35746',
  '/features/legend-settings.js': 'e795075ea58b5d7019b6daf67ae298cb088ca0f35a9d2538de04415ceb12ec09',
  '/features/page-settings.js': '2e9b961016930ea467a50e9a426cf8aa3a901f10dd2fb2fbe11a9186c7020e40',
  '/features/counter-settings.js': 'da999dfd845d5ac65957af1ef422c70b501aa9640f097be642e773bf936601d4',
  '/features/line-type-settings.js': '91bcfa06e0f4d29360effb6b1178d869020cbb5aa427f2e2550eb3b1fa48ed60',
  '/features/choose-create-line-type.js': '7dffa9677ad53b10eabc18fde7c7041b1f84ac94e6df15c254386083a2a7f516',
  '/features/scale.js': '3f070bb33968971e0d79d8454a45d47f6e890bd8cbf48c9fb9ecc2a3b062f858',
  '/features/scale-zone-settings.js': '67a8a802e7aeaf629a235dbd0e4d9c42ea5c746412ae6749b90ecf35be7a9c9f',
  '/features/groups.js': '58d955386b5f5c10d40444646a9852a962eca0aff418cfa9ae1366dde08d8a8d',
  '/features/grid.js': 'e8819e7a36df6e8911090ca3eb03946c53bb36dc97b5dbeac6fb5c00520719d3',
  '/features/quick-line.js': 'cef59db53a32bf198bb42b2aae35f41de5dc8e4cd2f1baf92e5b799f222f7d30',
  '/features/counter.js': 'f1ffbf89d463866892aa4e18702bc37d3c3413e7bbc4e012883a35587ae5e1bb',
  '/features/save-status.js': 'bf601563da95998a4bfa9d8957306368b65d599fc3f3bccb729b7f42c17d585a',
  '/features/status-bar.js': '13c0930cd47698992549e8c3756970fe90d6b172f89f48ba266d50faad8e582f',
  '/features/turn-in.js': '72210800834f658a0878d70fe1664d0675a3868aada9d655ed4cab13a76bf0d4',
  '/features/manage-projects.js': 'c010b8f2b84ba5715ca33a6e907baf3de488fad439b9651d966d795674fe257c',
  '/features/user-admin.js': 'e4065ca14f9a9188f92373587d2afebf58b2ae89ad059729ebed31557e042a15',
  '/features/load-project.js': '3815f8745ef65c0014b7db9b965342e40573647456b22e51a653013f49cddd27',
  '/features/bid-board.js': '420ccca9099f38262ec25d635d86cd1bad0f092a2ae254759ecd2b58213e18f0',
  '/features/review-flow.js': '293f332c7f9733d2eb4fd869f7413cb1af79b586aa722ac70a6ca167f5f88e4b',
  '/features/copy-project.js': 'd8ada1451aa982b207180e03fb0707b274eddd6af2c521856bce32a77c94a7c3',
  '/features/prepare-pdf.js': 'ca3a04c39e3cf4be32ed1b99a916d25392dede073620eebca565501fa08c3220',
  '/features/quick-modals.js': '41e4b0f8e18266283b4cd2bdaf1b58d242a4670e38869f77c11039bc928c1c96',
  '/features/pdf-bundle.js': '23ef04083b78bd2e496e615b3f8123a9f70fa16f096fa3840dd308a8238e42e6',
  '/features/item-details.js': '2d14500dfd1657db1350abcc1a8e752720a68b237685220920f1e0fdea6b04a5',
  '/features/output.js': '8f3c9caf0d12a6aac434586953d68d6b7ee792ebb63aec60030061d98c406306',
  '/features/rfi-flags.js': '40681e1143dc5bc64374c4e6a0bf9e2f30c246f8c4c34d81bc5635e38ce64949',
  '/features/share-links.js': '7d711b9c88404ff4923c81e9bb3da81e2b40b388848207326ec502b51ecd2724',
  '/features/import-clear.js': '3cfa037be5fd059da84a8899a0433106745a7f1819a0f529f0494fdda0191f28',
  '/features/zone-modals.js': 'cd99684ccb9e20ed537cf3f832c170f7607d515102e99fd2cf6d7b7829f5c58a',
  '/features/restore-last-session.js': '8fe45df7b5a896b177246d1d21c55de0a007c7030ab02dcfbfc0501112a96f55',
  '/features/summary-detail.js': 'dc82451da2877e4cc06438f84f5133c10f134cbd7cdb83ad161650b87331bd91',
  '/features/room-sizer.js': '0db5f7780cb591fdfff151a930cf959337c7828b025a52a846f515194bb78df8',
  '/features/burger-menu.js': 'a479d4e3dfb43888d1dc39f16d7657cf194f61130180945e13981d5ae9a0d126',
  '/features/header-more.js': 'c2023a933dc628ae3a5f77a4caba415be287140a91f9fb143ec8bd411003a997',
  '/features/canvas-layers.js': '70e4624b94af4a178bebc998bfa521eac07a4a519510aff81f55837673e4e06b',
  '/features/ghost.js': '30c28ea6ee106cc520244660c5d7aff3cabc44b986b503fe57276e98ba1a01e7',
  '/features/canvas-switcher.js': '3fc5c3743603a92ceb082499805c9a59c4c790208fa895e3f0043447b2949637',
  '/features/summary-list.js': '24369f746fc954d1f4e15322a4b6c660e8d0a918f532dc5e793ac94262e1e959',
  '/features/my-settings.js': '1cab2c975110185083e0b6c269464894483bc58cff880e66e122c1da806c8d70',
  '/features/palette-insights.js': '90b3434032f8ba887e14de28c359924b22a8e7b16f32352b3543df811fcc8b13',
  '/features/user-activity.js': 'f88508d8555a48fbf47a882b97ea2bbc218dcf19d496bd4a47da3b0d0eda78c5',
  '/features/user-activity-overview.js': '9f66e3102126507c2b1c7bb252c000a61c643dbc95627fcb36378bb9562cfc7d',
  '/features/tool-context-menu.js': 'b188d4f9da3823fd020442ac6372dfd89b7d74fe459e6fb193a5fe961de1a3a5',
  '/features/lines-list.js': '77f2e61df196cda4fb3f476d8d48d8ed7348ab20b1d71a7cfbe7e126a0fc279c',
  '/features/pages-list.js': 'faa3aa0fb6e168add717068b412067fa20c022735e169d84e038ae97fb6971bc',
  '/features/sidebar-lists.js': '4f4ba78b104b68f3dcf6e34eb8ad349922e43537cccf2cedeac93af822ebfbf8',
  '/features/quick-keys.js': 'df1540eb417c11006f1340c77a9b51b92e3a3c9ac6a5c307cc7ce0c9574d9af6',
  '/features/keyboard-map.js': 'adb5bc7bd0558467b919d29f5232167f994ed21e1d6b2cfe6e23164d6b9aa178',
  '/features/chain.js': 'e747c2f5f83432a3e3af3a669331b752d9d4ecccce11f3687d1f7dd0e3cd614b',
  '/features/drop-mode.js': '72b38bebd6a78bf9287c770f8dce1d262171ed5aa1634b0f095ddae7b91eedda',
  '/features/drop-peek.js': 'faca62c1552782dd849c6732a42068b2bc770c1e765408d912672c93e83a5ee0',
  '/features/highlight-labels.js': '662740b54bdab6ab283400bd30a1071e7b8c8c703e7be1588498d217caacaf7f',
  '/features/hotkey-peek.js': '6f8453b22b2a5ee1b84d5760c00b47dc45f94a435ff59f7d9c991b88b6f30820',
  '/features/child-counts.js': 'fd265b35eaa72e8dfa01a931a38ede166427a0d9ec6340b33a68272781d5f8ac',
  '/features/twin-badge.js': '2b3f7def0ce1691fd9468af9a01aab67a74eb17dd764130bdc00d5464bce010b',
  '/features/auth-magic-link.js': 'eef794efd0a4f6040f2bf04e4bcda7500a2839d28ee72dbe5beecfd5f14aefe6',
  '/report.js': '97ca529dbd4ddee55129ecf2206debb3534f744f24e3e5ff6af292c720cbf3ba',
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
