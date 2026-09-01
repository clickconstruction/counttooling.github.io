/* eslint-disable no-undef */
// Temporary (untracked) config for THIS session: like playwright.worktree.config.js
// but on its own port — :3456 is held by another session's server, and
// reuseExistingServer would silently run the specs against that other tree.
const base = require('./playwright.worktree.config.js');
module.exports = {
  ...base,
  use: { ...base.use, baseURL: 'http://localhost:4571' },
  webServer: {
    ...base.webServer,
    command: 'npx serve -l 4571',
    url: 'http://localhost:4571',
  },
};
