// Node tests for the user-activity event allowlist (R2): every event type the
// client sends through logUserEvent must be accepted by the newest
// public.log_user_event migration, and that migration must carry every type an
// earlier one allowed (the migration-chain rule: a re-creation copies the latest
// body, or it silently un-allowlists what later branches shipped). Reads the
// sources as text; no database, no browser.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

// The client files that call logUserEvent / reportClientError.
function clientSources() {
  const files = ['app.js', 'save-engine.js', 'report.js']
    .concat(fs.readdirSync(path.join(ROOT, 'features')).filter((f) => f.endsWith('.js')).map((f) => path.join('features', f)));
  return files.map((f) => ({ file: f, text: fs.readFileSync(path.join(ROOT, f), 'utf8') }));
}

// Every literal event type the client sends: logUserEvent('x', …) plus the
// reportClientError('x', …) kinds, which app.js mirrors to the feed under the same
// name. A non-literal first argument is a hole in this check, so it is asserted
// to be exactly the one known pass-through (reportClientError's `kind`).
function clientEventTypes() {
  const types = new Map();
  const dynamic = [];
  for (const { file, text } of clientSources()) {
    for (const m of text.matchAll(/\blogUserEvent\(\s*'([a-z_]+)'/g)) types.set(m[1], file);
    for (const m of text.matchAll(/\breportClientError\(\s*'([a-z_]+)'/g)) types.set(m[1], file);
    for (const m of text.matchAll(/\blogUserEvent\(\s*([^'\s)][^,)]*)/g)) {
      if (!/^\s*function\b/.test(text.slice(Math.max(0, m.index - 12), m.index))) dynamic.push(file + ': ' + m[1].trim());
    }
  }
  return { types, dynamic };
}

// The migrations that (re)create the function, oldest first, each with its allowlist.
function allowlistMigrations() {
  return fs.readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ file: f, text: fs.readFileSync(path.join(MIGRATIONS, f), 'utf8') }))
    .filter((m) => /create or replace function public\.log_user_event\(/i.test(m.text))
    .map((m) => {
      const block = m.text.match(/if p_event_type not in \(([\s\S]*?)\) then/i);
      assert.ok(block, m.file + ': no `not in (…)` allowlist found');
      const list = [...block[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
      return { file: m.file, list };
    });
}

test('the newest log_user_event migration accepts every event type the client sends', () => {
  const migrations = allowlistMigrations();
  assert.ok(migrations.length >= 1, 'no migration defines public.log_user_event');
  const newest = migrations[migrations.length - 1];
  const allow = new Set(newest.list);
  const { types, dynamic } = clientEventTypes();
  assert.ok(types.size >= 30, 'expected the client to send at least 30 event types, found ' + types.size);
  const missing = [...types.entries()].filter(([t]) => !allow.has(t)).map(([t, f]) => t + ' (' + f + ')');
  assert.deepStrictEqual(missing, [], 'client event types the deployed allowlist would reject (add them to a new migration that copies ' + newest.file + '):\n  ' + missing.join('\n  '));
  // The only non-literal call is reportClientError's pass-through of its `kind`;
  // anything else would be invisible to this test.
  assert.deepStrictEqual(dynamic, ['app.js: kind'], 'a logUserEvent call with a non-literal event type: ' + JSON.stringify(dynamic));
});

test('the allowlist chain only grows: each re-creation carries every earlier type, with no duplicates', () => {
  const migrations = allowlistMigrations();
  for (let i = 1; i < migrations.length; i++) {
    const prev = migrations[i - 1], cur = migrations[i];
    const dropped = prev.list.filter((t) => !cur.list.includes(t));
    assert.deepStrictEqual(dropped, [], cur.file + ' drops types that ' + prev.file + ' allowed (copied an older body?): ' + dropped.join(', '));
  }
  for (const m of migrations) {
    const dupes = m.list.filter((t, i) => m.list.indexOf(t) !== i);
    assert.deepStrictEqual(dupes, [], m.file + ' lists a type twice: ' + dupes.join(', '));
  }
});

test('the newest migration is the R2 catch-up and carries the fifteen types it was written for', () => {
  const migrations = allowlistMigrations();
  const newest = migrations[migrations.length - 1];
  const r2 = [
    'bid_check_row_state', 'ceiling_set', 'child_count_from_rule', 'codes_set', 'drop_set',
    'ghost_placed', 'ghost_stamped', 'project_close', 'restore_prompt_deferred', 'rule_open',
    'tag_suggestion_accepted', 'tour_step', 'trade_set',
    'client_error', 'client_unhandled_rejection',
  ];
  for (const t of r2) assert.ok(newest.list.includes(t), newest.file + ' lacks ' + t);
});
