/* eslint-disable no-undef */
// Temporary (untracked) config for running specs FROM a .claude/ worktree:
// the base config's testIgnore ['**/.claude/**'] matches the worktree's own
// absolute path and hides every spec. Same config minus that ignore.
const base = require('./playwright.config.js');
module.exports = { ...base, testIgnore: [] };
