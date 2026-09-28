// Pins playwright.config.js's per-tree behaviour (punch rows WORKTREE-SPECS and CI-MAIN,
// 2026-09-27): which .claude/ it hides, which port it serves on, whether it may reuse a server,
// and the CI retry count. The config is compiled as if it lived in a made-up directory, so one
// run covers the primary checkout, a worktree and a path full of RegExp characters.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const SOURCE = fs.readFileSync(path.join(__dirname, 'playwright.config.js'), 'utf8');
const ENV_KEYS = ['CI', 'PW_PORT', 'BASE_URL'];

function loadConfigAt(dir, env = {}) {
  const file = path.join(dir, 'playwright.config.js');
  const saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    const m = new Module(file, module);
    m.filename = file;
    m.paths = module.paths; // resolve @playwright/test from this repo
    m._compile(SOURCE, file);
    return m.exports;
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const ignored = (config, file) => config.testIgnore.some((re) => re.test(file));
const PRIMARY = path.resolve('/work/counttooling.github.io');
const WORKTREE = path.join(PRIMARY, '.claude', 'worktrees', 'agent-x');

test('primary checkout: hides every sibling worktree, keeps its own specs', () => {
  const c = loadConfigAt(PRIMARY);
  assert.ok(c.testIgnore.every((re) => re instanceof RegExp), 'a RegExp, not a glob');
  assert.ok(ignored(c, path.join(WORKTREE, 'pdf-upload.spec.js')));
  assert.ok(ignored(c, path.join(PRIMARY, '.claude', 'worktrees', 'other', 'features', 'a.spec.js')));
  assert.ok(!ignored(c, path.join(PRIMARY, 'pdf-upload.spec.js')));
  assert.ok(!ignored(c, path.join(PRIMARY, 'sub', '.claude', 'a.spec.js')), 'only its own .claude/');
});

test('worktree: finds its own specs, hides only its own .claude/', () => {
  const c = loadConfigAt(WORKTREE);
  assert.ok(!ignored(c, path.join(WORKTREE, 'pdf-upload.spec.js')));
  assert.ok(!ignored(c, path.join(WORKTREE, 'features', 'a.spec.js')));
  assert.ok(ignored(c, path.join(WORKTREE, '.claude', 'worktrees', 'nested', 'a.spec.js')));
});

test('RegExp characters in the path are escaped', () => {
  const dir = path.resolve('/work/repo.io (1)+[x]');
  const c = loadConfigAt(dir);
  assert.ok(ignored(c, path.join(dir, '.claude', 'a.spec.js')));
  assert.ok(!ignored(c, path.join(path.resolve('/work/repoXio (1)+[x]'), '.claude', 'a.spec.js')));
});

test('port: 3456 in the primary checkout, and a server there may be reused locally', () => {
  const c = loadConfigAt(PRIMARY);
  assert.strictEqual(c.use.baseURL, 'http://localhost:3456');
  assert.strictEqual(c.webServer.command, 'npx serve -l 3456');
  assert.strictEqual(c.webServer.url, 'http://localhost:3456');
  assert.strictEqual(c.webServer.reuseExistingServer, true);
  assert.strictEqual(loadConfigAt(PRIMARY, { CI: '1' }).webServer.reuseExistingServer, false);
});

test('port: a worktree gets a stable port of its own and never reuses a server', () => {
  const a = loadConfigAt(WORKTREE);
  const port = Number(new URL(a.use.baseURL).port);
  assert.ok(port >= 3500 && port <= 3999, `port ${port} in 3500-3999`);
  assert.strictEqual(a.webServer.command, `npx serve -l ${port}`);
  assert.strictEqual(a.webServer.url, `http://localhost:${port}`);
  assert.strictEqual(a.webServer.reuseExistingServer, false);
  assert.strictEqual(loadConfigAt(WORKTREE).use.baseURL, a.use.baseURL, 'same path, same port');
});

test('PW_PORT sets the port everywhere; BASE_URL still wins for the URL', () => {
  for (const dir of [PRIMARY, WORKTREE]) {
    const c = loadConfigAt(dir, { PW_PORT: '4012' });
    assert.strictEqual(c.use.baseURL, 'http://localhost:4012');
    assert.strictEqual(c.webServer.command, 'npx serve -l 4012');
    assert.strictEqual(c.webServer.url, 'http://localhost:4012');
  }
  const b = loadConfigAt(PRIMARY, { PW_PORT: '4012', BASE_URL: 'http://localhost:9999' });
  assert.strictEqual(b.use.baseURL, 'http://localhost:9999');
});

test('CI retries once (CI-MAIN), never locally', () => {
  assert.strictEqual(loadConfigAt(PRIMARY, { CI: '1' }).retries, 1);
  assert.strictEqual(loadConfigAt(PRIMARY).retries, 0);
});
