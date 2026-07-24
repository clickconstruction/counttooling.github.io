// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  // CI runs the suite on ubuntu; render-pixels compares raw canvas bytes
  // (maxDiffPixels: 0) against committed baselines that are machine-rasterized
  // on darwin — a linux runner has no baseline files and text rendering differs
  // anyway, so that one spec stays local-only. Cloud/dev-auth specs need no
  // ignore: they self-skip when config carries no DEV_AUTH_* creds.
  testIgnore: process.env.CI ? ['**/render-pixels.spec.js'] : [],
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
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});
