// Production Supabase config. This file IS committed on purpose: the site is
// a static deploy and the anon key is a public, RLS-gated credential (never
// put a service-role key here). Secrets and dev-only overrides belong in
// config.local.js (gitignored, loaded on localhost only) — see
// config.example.js. NOTE: `npm run test:cloud` regenerates this file from
// env vars; scripts/generate-config.js refuses to overwrite the tracked copy
// unless CONFIG_FORCE=1.

// Optional: set to false to disable full canvas+PDF backup to IndexedDB (default: true)
// window.BACKUP_PDF_TO_INDEXEDDB = false;

window.SUPABASE_URL = 'https://hrqxvfydmvtvwhvefmqc.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhycXh2ZnlkbXZ0dndodmVmbXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzODM0NTMsImV4cCI6MjA4Nzk1OTQ1M30.dqn8DwO-dc0z2GwunCfEo5VO8lPRUGaN6ruzAm33HSs';
// Dev-only auth bypass (localhost only); create a test user in Supabase first