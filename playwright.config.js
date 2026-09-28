// @ts-check
const path = require('path');
const crypto = require('crypto');
const { defineConfig, devices } = require('@playwright/test');

// Which tree this config belongs to, and so which .claude/ to hide and which port to serve on
// (punch row WORKTREE-SPECS, 2026-09-27). A Claude Code worktree is a full repo copy living at
// <primary>/.claude/worktrees/<name>/, so it has this same config file.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Only THIS tree's own .claude/, anchored at the start of the absolute path. Playwright tests a
// RegExp against the file's native absolute path (backslashes on Windows, hence path.sep); a
// string glob would not do, because Playwright prefixes `**/` to it and '**/.claude/**' then
// matched a worktree's own path and hid every spec in it.
const OWN_CLAUDE_DIR = new RegExp('^' + escapeRe(path.join(__dirname, '.claude') + path.sep));
const IN_WORKTREE = (__dirname + path.sep).includes(
  path.sep + path.join('.claude', 'worktrees') + path.sep,
);
// A stable port per worktree, 3500 to 3999, hashed from its path: seven sessions each testing
// their own tree on :3456 would each reuse whichever server got there first.
const worktreePort = (dir) =>
  3500 + (crypto.createHash('sha1').update(dir).digest().readUInt32BE(0) % 500);
const PORT = Number(process.env.PW_PORT) || (IN_WORKTREE ? worktreePort(__dirname) : 3456);

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
  // Never discover specs inside this tree's .claude/ — Claude Code worktrees
  // are full repo copies living under .claude/worktrees/, so without this a
  // run from the primary checkout collects every sibling worktree's specs.
  // Anchored to this config's directory (OWN_CLAUDE_DIR above), so a run from
  // inside a worktree still finds that worktree's own specs. CI clones clean
  // and is unaffected.
  testIgnore: [OWN_CLAUDE_DIR],
  // Per-FILE parallelism only (fullyParallel stays false, so tests within a
  // spec keep their in-file ordering). Each test gets an isolated browser
  // context (own storage/IndexedDB) against the shared static server, so
  // files are independent; measured locally 2026-07-30: 4 workers ran the
  // full suite in 2.1m vs 6.7m serial, twice, with zero flakes — including
  // the timing-sensitive perf specs. CI runners have fewer cores; 2 there.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // One retry on CI (punch row CI-MAIN, 2026-09-27): at two, a failing 180 s course chapter ran
  // three times. One still absorbs a lone flake; a real failure fails once more and stops.
  retries: process.env.CI ? 1 : 0,
  // Two workers per CI runner. CI splits the suite four ways by FILE (ci.yml, --shard=N/4), each
  // shard on its own runner; tutorial.spec.js (about 558 s) is the floor a shard cannot go under.
  workers: process.env.CI ? 2 : 4,
  // A test's budget is 90 s on CI, 30 s locally (punch row CI-NETWORKIDLE, 2026-09-22). The
  // runner has two cores for two workers rendering PDFs, and a boot that settles in 2 s on a
  // laptop, 6 s with eight booting at once, took the whole 30 s there: on PR #161's five runs
  // all 19 flaky errors and the one hard failure were the boot's quiet-network wait timing out,
  // and the two specs that never flaked, tutorial and lessons, are the two that set 90 s.
  // The server was not it (a bare Node static server booted no faster than `serve`), and
  // neither was the service worker (blocked below, the same wait still timed out 27 times).
  // A retry costs a whole test; a longer budget costs nothing when the test is quick.
  timeout: process.env.CI ? 90000 : 30000,
  expect: { timeout: process.env.CI ? 15000 : 5000 },
  reporter: 'list',
  use: {
    // BASE_URL wins (a server you run yourself); else PW_PORT; else 3456, or a worktree's own port.
    baseURL: process.env.BASE_URL || `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    // The service worker is BLOCKED in every spec by default (2026-09-22). Every fresh
    // context used to install it and precache the whole shell, about 155 files, in a worker
    // process beside the test; nothing but pwa.spec.js and the rulebook precache test in
    // rules-chip.spec.js reads it, and they opt back in with
    // `test.use({ serviceWorkers: 'allow' })`. This was first tried as THE fix for the CI
    // flake and was not (see `timeout` above); it stays because a spec should not install
    // something it does not test, and a starved runner is better off without the work.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npx serve -l ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Reuse a locally running dev server, but never on CI — a stray process
    // on :3456 there would silently serve the wrong tree — and never from a
    // worktree, where a server already on the port belongs to another tree (a
    // hash collision then fails loudly on the busy port: set PW_PORT).
    reuseExistingServer: !process.env.CI && !IN_WORKTREE,
    timeout: 120 * 1000,
  },
});
