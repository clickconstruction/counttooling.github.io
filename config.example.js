// Copy this file to config.js and add your Supabase credentials.
// NOTE: config.js is COMMITTED in this repo (static deploy; the anon key is a
// public, RLS-gated credential — never put a service-role key or password in
// it). Dev-only overrides (DEV_AUTH_*, debug flags) belong in config.local.js,
// which IS gitignored and loaded on localhost only.
// Add <script src="config.js"></script> in index.html head, before the pdf.js script, to enable Supabase.

window.SUPABASE_URL = 'https://your-project.supabase.co';
window.SUPABASE_ANON_KEY = 'your-anon-key';
// Optional: allowed domains for view links (default: clickplumbing.com); Edge Function env overrides
// window.VIEW_LINK_ALLOWED_DOMAINS = 'clickplumbing.com';
// Optional: dev-only auth bypass (localhost only); create a test user in Supabase first
// window.DEV_AUTH_EMAIL = 'test@clickplumbing.com';
// window.DEV_AUTH_PASSWORD = 'your-test-password';
// Optional: verbose [SaveDebug] console logs for cloud save / auto-save troubleshooting (same flag in production config.js)
// window.CLICKCOUNT_DEBUG_SAVE = true;
