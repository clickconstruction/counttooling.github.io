// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  // render-pixels runs EVERYWHERE: per-platform baselines are committed
  // (*-chromium-darwin.png for local Macs, *-chromium-linux.png for CI —
  // generated in the official mcr.microsoft.com/playwright linux/amd64 image
  // and verified bit-exact across cold container runs; regenerate the same way
  // after an intentional draw change: docker run --rm --platform linux/amd64
  // -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v<ver>-noble
  // bash -lc "npx playwright test render-pixels.spec.js --update-snapshots").
  // Cloud/dev-auth specs need no ignore: they self-skip without DEV_AUTH_*.
  testIgnore: [],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3456',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx serve -l 3456',
    url: 'http://localhost:3456',
    // Reuse a locally running dev server, but never on CI — a stray process
    // on :3456 there would silently serve the wrong tree.
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
