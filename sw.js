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
const CACHE_VERSION = 'b0228582fb3f';
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
  '/sheet-title-model.js',
  '/support-model.js',
  '/fitting-model.js',
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
  '/recent-bids.js',
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
  '/features/bid-chip.js',
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
  '/features/bend-override.js',
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
  '/features/lessons.js',
  '/features/course-plumbing.js',
  '/features/course-electrical.js',
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
  // Tab favicon (SVG + ICO; see scripts/build-pwa-icons.js)
  '/icons/favicon.svg',
  '/favicon.ico',
];

// Per-file integrity hashes for the verified install. GENERATED by
// `npm run build:sw` — do not edit by hand (see the header comment).
const PRECACHE_SHA256 = {
  '/app/': 'ece009a9066ca2e751a69f42e3e66932edb53acbdf701f7935f50c3159a579b7',
  '/app/index.html': 'ece009a9066ca2e751a69f42e3e66932edb53acbdf701f7935f50c3159a579b7',
  '/config.js': '455a751857efe37a6c08d3922448bca7f57767b923e39826239a6f187608b05a',
  '/styles.css': 'd946383ee1448a456dd40d7f6169f6146e857a9e94e5bf3d44a94b52d5878176',
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
  '/tag-model.js': 'e9a3891f3ce6ba2ac5e9ecd3c16fa91d035d19f4aee201e553d419e0ee79f6e3',
  '/sheet-title-model.js': 'f4af651077942b4b14a4eec23effcbcf6099713125031270a868d3a21a2737cd',
  '/support-model.js': 'a1fba42dfd24cfc5dfd662e6dcb67bced82bb656f7589b828110f5d08088eb69',
  '/fitting-model.js': '60aef6daecbf4ea7205224b2656d3bdaca033fa9ce9f896885f56e5618b6b9b1',
  '/duct-model.js': 'a066ffbce168bb2fe369cb949ee6cbf9362092e53db4443042937bf4f9321842',
  '/bid-basis-model.js': '825fc0a1cfd1a765dbb3bab5f06eb49c9780253d071def87784939e194a834f0',
  '/canvas-draw.js': '3bfa02b2368b3656240d536a420c6a8873024c0484c73739fc1ab9cf5194c9aa',
  '/render-service.js': '077e7474ba588a262ca7fe01183271af85d8a9a105e4c90cb1ebd5ed7d8ab0da',
  '/render-worker.js': '97409f02a7150a5f9b5e456769083b49dca0c7baaae0263a34e2fc7a1d23a54d',
  '/constants.js': '64cd7f9d4a169cdc995f8166e161204b062816e13cfd4102485ffe536ae6f1be',
  '/zoom-ladder.js': 'c8396a9b8610ce94c703b575e3180ad3152d17a5b23c9e576c8d45b980005ba3',
  '/hotkeys.js': 'cd0eafcc9f24c885d3e4e10d0a5d2e493f54be34d2e8607f53dd456f44c49d23',
  '/recent-colors.js': '01a7af7515a037ac51f0819601156c64035b903ce55a2739a5393988792285a7',
  '/recent-drops.js': '3b04d7b96c6260858a3ce9de59a9e862fa88ddf3e563de3ef46d354020358b7b',
  '/recent-bids.js': '0c27598ee2b7013f553eef5456b257935bc1de5810db43660afd4b74975a89bb',
  '/idb.js': 'ae6bf34b5675883ed82c23229597911165036a2f12e7566dbbd949b86f316f05',
  '/format.js': '8957d41b6a883fe315b79aaf6b4b34f89cc0063970394f00aa16fcbd8a0339a2',
  '/save-utils.js': '3ba2623bcd4981c6289555e2172805a9592ba4c789ea180fc7623f6aa27c9c25',
  '/annotation-model.js': 'ee139c5248e8c059a15c3d54ee83a5aee21ba30489fc219169b915034c986414',
  '/undo-stack.js': '981aa3e990f7ab52b9ff93046f274aaf7e43b867ec4b6532005a5a24e9cd5711',
  '/save-engine.js': '31100c9114b2f9dd2112d83e33f8e3b191bf55fe0decf9b54038852fe0795128',
  '/pdf-tile-cache.js': 'd9d520d6399480191df2b97038ce0b453803666d79f1b804a995484e98fc5772',
  '/app.js': '8806a6e1a75a1aa6429896053b9d28276fe03e716365c4533e28a9c1ef4e25e9',
  '/features/canvas-repair.js': 'd07714d342ca087e382424751718f1d827754c35f82da63a923ac8ce5781ce15',
  '/features/view-only.js': 'e821262d3ffc7a9751a62c9d86f90c416d9a2d7a81ed72238649e76da2781cfb',
  '/features/save-project.js': 'f907072c269081c3a53fb8f72625df9fc4616b7ef27d8ffccb45d012da6282a5',
  '/features/pdf-intake.js': '3526f5de7120bfc750615061d8c3290cb73e5a208e0198aa72e149c71e20a4f2',
  '/features/line-color.js': '2fd4c7594f1a3686fd9323b7bc4d97f5b9c151b32475d5a4428062a075378ecb',
  '/features/custom-icon-upload.js': '24e2add3e3703bec15a947aaa4b8bc0b52f5a3d7c0927955aa0a980113a1e375',
  '/features/note.js': 'b7cc88aa00ac8a2450c59299959108ae3bd5b18b0e420fd61264533c23347d6b',
  '/features/zoom.js': 'cceb56f7ae4c91124aa17b246b276b9796463dc27ce93835a849f5a3d31f31fc',
  '/features/zoom-rail.js': 'd9fd46d047c55cac555c2c1cfac70f4d36b9f537302efc400a3e240d6edfbcc6',
  '/features/manage-icons.js': '05d99d299583073854b53f7fd67601b791357e19cb3c4c72f17fde645496ccc0',
  '/features/multiply-zone-settings.js': 'e808757a5758d7c0ba64d989ef3f6e051266b40a26ff01ae9ea8187b7b834dee',
  '/features/export-pdfs.js': 'f9a31d958067cd16c7162b6d26c6bb7818ef5dbde3f0ca69715b2df692504bb1',
  '/features/bid-basis.js': '1effb492871d0ec5fb3de46d4f9e72e25efedac4708cd9c86af1e735abbd352c',
  '/features/legend-settings.js': 'd9a749587acf289b31503bfb2bc764868f507296b272ef880938359f919a9976',
  '/features/page-settings.js': '2e9b961016930ea467a50e9a426cf8aa3a901f10dd2fb2fbe11a9186c7020e40',
  '/features/counter-settings.js': '7ffa8f737269666f7de0efc1e4a83edd4539d0e43e9299a76c6e253534d1820a',
  '/features/line-type-settings.js': '91bcfa06e0f4d29360effb6b1178d869020cbb5aa427f2e2550eb3b1fa48ed60',
  '/features/choose-create-line-type.js': 'fd26611fd14483d91a3da3c823d2a0fd3331c665311653e11cc8a03cf7fdff81',
  '/features/scale.js': 'ed1d36d899d3ad3bf69b36ce2d60b9becf69821bdc18fafb19ddffe41b54c104',
  '/features/scale-zone-settings.js': '67a8a802e7aeaf629a235dbd0e4d9c42ea5c746412ae6749b90ecf35be7a9c9f',
  '/features/groups.js': 'd2faa0432c4ba28ba50264227dc09dc21c96732a48347a0502b42f0d9e509d1d',
  '/features/grid.js': 'a0feb36ae0ac863f17dda7262e7feaa5bd8929f9bff01b926fd412518b069fa4',
  '/features/quick-line.js': 'a5d6570246ccf7e3b8bf508869b3216fa5e147831b537d5b89d3c36e08a864ad',
  '/features/counter.js': 'bd0c976dfc44b3708e4e0b1cb6197733d39a43243fc75663f19157f2684e7e0a',
  '/features/save-status.js': '154fefaaaa277f4912d476f26bd22f49beced717155504d62ac2901060490123',
  '/features/status-bar.js': '1a201810909cca54376247acdf44040eac4016378e895a407b3934539ae0bd56',
  '/features/turn-in.js': '1793d17cb9b5dd13082fa7df55d9736b7e2e43e5c82918a22a6115c5395a8667',
  '/features/manage-projects.js': '45d9d7418dd748b6a18089bb1ea9b6daa67a86ad8d3233945cb24a3a762f4a93',
  '/features/user-admin.js': 'f038517632e11bb24f6cc01254611534ead640264baa7fa6152de542791914ec',
  '/features/load-project.js': '7a4f4ef009c7228ba4c555ae413c1eecff2fac5101c46523760ffe1395bc7a21',
  '/features/bid-board.js': '9b566cfd9ea3346fff1f7d0e71637cf1508a3edbda6c6630a938aa680feea8bf',
  '/features/review-flow.js': 'c8fa38b8391329961e85310ec0f7860c094b450796d3599e125e23f66007acf5',
  '/features/copy-project.js': '1847f11f0c559cf4c01fc1972c1103b8c459df3273f3a9a5aa8b9ab65dd4e44d',
  '/features/prepare-pdf.js': '4a4f2b7465a4b6828dc068aae209cf73875865552cc6816eeac9d7033fc42204',
  '/features/quick-modals.js': '2d7e9a99fd074b9a04bbd87d517a8b21b49edc68bbd5cd9f50e26fed6c862fcc',
  '/features/pdf-bundle.js': '9f08fe5a316ff8c82561c4655c6b2d4d4858268bb3ee2807fe6e61df0cc8351e',
  '/features/item-details.js': '721ff89753d107156b8b9f28f341d0edb5f561b9fa1ae1c61bbb0c0c17b75798',
  '/features/output.js': 'e6a1c995702ddd6ec3c46400efa09da5fd257fd03d590b72409f45244dce0953',
  '/features/rfi-flags.js': 'c4165e15ca970b4352e05a9e77a3636211e8e22e77c379a21ddbdb919f408162',
  '/features/notes-ledger.js': '7238cc1f232aaa179bc7cb642f4c1a4fbb1f06ae61e09d14c6e83222d49420a2',
  '/features/share-links.js': '4f7fcaf5af80c431064081b1d3d3d7388943b48ef94983cb83fb1f2c3dab33a9',
  '/features/import-clear.js': '2a99d66d53a20c82784efd6574edf1fc4399bdbab45e93911a0c8534c6e5d804',
  '/features/zone-modals.js': 'f722f6af79ef54262e02e0afbf0d2ff4f3f28867f40bccd64fd6911daab344b2',
  '/features/restore-last-session.js': '770732c322ef8d9d8f6cac763eb5af524936acb5528222c1a056ddbe7638317e',
  '/features/summary-detail.js': '3ddb0f2ea207bc53a913aede32cfbdc10de8c1af1ea48bdbdd982ccf49bc27b3',
  '/features/room-sizer.js': '4375ad844004bca68c92030868c051fb8f4bfb99e36258ec62ecfbeb34887691',
  '/features/burger-menu.js': 'defc53bc9189dc014ca34f7f6e679881b2f00dbd499592b07faec95edaa3cc9f',
  '/features/bid-chip.js': 'fd7909891aa6565e2c3d5c8b56970430c48fe2e8540ff8057bbcababfe395ad0',
  '/features/header-more.js': '5b74e8f40464c9caf78ab4bda862ea8ef254e157cf6b5e6804574f8b8f85b41c',
  '/features/canvas-layers.js': '7a601d23210fa889ea10b8fc2407ed553d990b62bc37bb0e0b6e69fba6947d09',
  '/features/ghost.js': '998578dd2ef4bcc6bf9acec75fbee697a297a963ed9ec5aa27e30a83a142ba8f',
  '/features/canvas-switcher.js': '89970ea9ae56c8bffa8f3fd0360ea4ba3e901bec1a772972117dcebe5acc9393',
  '/features/summary-list.js': '38a79e5f470e2f74fd3422de623ad239ea6642c0f0d2ad58bba08d8f7843bc6a',
  '/features/my-settings.js': 'd365a70af9486756d537fdeac377dc2366f202b5e3902f992e0a28b03b4c0f9f',
  '/features/palette-insights.js': '295538e042d1cef9c0b12655b754c5b9ca26a02de010f684806c88e777085863',
  '/features/user-activity.js': '2548c3835c9870092c4e3ba6de191b1493b4a81b7739bd144d96dcf20fcb19eb',
  '/features/user-activity-overview.js': '70895b1093150ee2c4049540df9eb0a40f13af17868e482ad178dac7a7c02b10',
  '/features/tool-context-menu.js': 'b3eaa212bea057c6497afddaba467cc9ce0a03f4f922559b49b914824fbe1266',
  '/features/bend-override.js': '8de5e5c77f6cb8675a810c46c890f571165787be15f296f3f8846bcddf2541ee',
  '/features/lines-list.js': '77f2e61df196cda4fb3f476d8d48d8ed7348ab20b1d71a7cfbe7e126a0fc279c',
  '/features/pages-list.js': 'dda86248a882058fb9f1e981de6eeafa21476920689af794e2cb33ec34b85ca2',
  '/features/sidebar-lists.js': 'd73dc7a48da6e511f2265b1deaff1bf1520c3f22bd44b61d494ed38cb5b6b1a5',
  '/features/quick-keys.js': 'b7e42d61f4010da4f3db67407b5e5febd210882e1c5aca98a4ce280b674c2705',
  '/features/keyboard-map.js': '32253988b54563a25c1827faacceb13609a9b8e7d15735dc0df8cc00d2c2b278',
  '/features/chain.js': '13faf99fe78bf0bf5309839c4b6128b7c7251fc8bfb06f9368a9f71e3ed5a4dd',
  '/features/drop-mode.js': 'fe9f07baa5853475b2577896c970a8bd805efe597d063df16d96478ef6208d22',
  '/features/duct-tool.js': '7a3cd6062d7fe3b63ae84648a8a2dd0161b6c8d9d1200df72785401d1c49dbf8',
  '/features/duct-size-popover.js': '7815b986d05160667c6bfafc7c974e6d3787b64f7b9ad2ce287fd2b06dbc3622',
  '/features/duct-fittings.js': '5f7928fb342f6f68361c2e1da2c9069ee71d2d35968f50a23ec6ce2f722587d7',
  '/features/duct-sidebar.js': 'ad56f2f1004f96916ce7acc6ed5deb05dc5730ee69bf49e5f40d262da503b571',
  '/features/duct-schedule.js': '94a71c576c1d094b812cc174ca013f490989e2081818b8d213b6e62601aafacb',
  '/features/duct-suggest.js': 'e0961d484412ed6684439419752fc6ba9d68eda46575903c290a7bb30103209e',
  '/features/duct-callouts.js': 'db36b2ad7773a3cfe0f1c3d890ad0d24a70a8d058d156d272ec3cd149a2a4eaa',
  '/features/drop-peek.js': '07b8990e4b1cbed96b1b4416b440ac39f5f5b1c9fd5159b34867c34e502263dc',
  '/features/highlight-labels.js': '00d5ab84f963b1d5a03e78bcc5d133f04bd44c20c88e0847b6a6be86b9cdd0eb',
  '/features/hotkey-peek.js': '6f8453b22b2a5ee1b84d5760c00b47dc45f94a435ff59f7d9c991b88b6f30820',
  '/features/child-counts.js': '3bf33d9f6f99d422987d671a6f017048a3675a5ab94c1dab7b5e6bdb2d9be40a',
  '/features/conductors.js': '295503045514fcb5f88a6c5682e79e9487c6d9ce941e8cd937f11a8c6c590ace',
  '/features/circuits.js': '47821b96a2682b9cda3e0289ceb611bbf74881e93fe9ebac4cba1e720e29fae3',
  '/features/bid-check.js': '5be6f41badb6b3130ed55415e6e093d621bb57acfd87df88c88b4ced9bf3f7e6',
  '/features/duct-bidcheck.js': '793ca70d74a92aa4c6af035d60d90e87213247260c7e39ec832d61a8cd59c9a6',
  '/features/rules.js': '01e86c4f75ee125c375265b33566364603a9056780716841f487b4a323be8192',
  '/features/tag-reader.js': 'c74c1ca9508963670e3dd554838fe5018e3d285026c924fc7352f6217de509f0',
  '/features/tutorial.js': '71b735de368fa54c2309b3dd962a27dae41cef841b1e2ef37357ccbeedd17d04',
  '/features/lessons.js': '09ceb07f5c55f366e147adbb530b7a023a085f10e1bee89edab88b680e7a4a35',
  '/features/course-plumbing.js': '2aa90dca74cefa9f5cf2df2a0f7def4f16e8c1f349242d8943c077d36efde592',
  '/features/course-electrical.js': '9aa0371ec5fa06bd37fa0d3f90c687fccbef37f8c4752a6a0f271aff91927562',
  '/features/twin-badge.js': '714ef6850ba7f430ff181ec8c91795485553e9c27dae9c8ebd40ea75d63943bf',
  '/features/auth-magic-link.js': '56c0ffb89518846f1ac22c7ed458ffdc8d991e45838784e51203696689e5cdc5',
  '/report.js': '14b7fc5c9cf4084dde144d94e0bf8f915c81d07576d022261c078e7efac9b8ba',
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
  '/icons/icon-192.png': 'c807a7a2fda05dc5a74c60f16d7199bc1c617aa36948acc20e3712a412f943c2',
  '/icons/icon-512.png': '386919ae854bc73fd0c8fa39bcb8f16d2496ce0b487792ca17b0924d7a8eb137',
  '/icons/maskable-512.png': 'a5c54fa0ab699678992c5e5473721804d24257762a859f8c2183fb4049bfa164',
  '/icons/apple-touch-180.png': 'a3cc9422d951a7f34950c199e4f5520eff022c706cb08915be24cb3bdd723ac6',
  '/icons/favicon.svg': '5e4845129109e7312a2e0b538c99cad4121dec3ad210f9db6788b85faace59b5',
  '/favicon.ico': '245190b9033ded10d89660935858c3e9fe2046e24c1c9271c9f1067eced35ad4',
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
