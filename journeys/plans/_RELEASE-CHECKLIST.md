# Tier-1 release checklist — 2026-08-10

The deploy that ships T1-01…T1-12 (9 plans + side fixes). Rollback SHA (pre-stack origin/main): **6f3d75e**.

## Pre-push (orchestrator)
- [ ] All 9 queue branches merged to local main, each gated (suite + check green at merge time)
- [ ] Side-fix branches merged (T1-03 Set Scale clamp, T1-10 rooms-only export, band color) — same gate
- [ ] FINAL INTEGRATION GATE on merged main itself: `npm run check` + full `npm test` green
- [ ] Migrations applied to production IN FILENAME ORDER via MCP `apply_migration` (each re-creates
      `log_user_event`; the chain design means later files include earlier events):
      20260810120000_user_activity_restore_events → 130000_copy_summary_events →
      140000_scale_set_events → 150000_artboard_load → 160000_view_link_dead (also fixes the
      long-dropped `render_worker_fallback`)
- [ ] Migrations applied BEFORE the app push (old app ignores them; new app needs them)

## Will's 15-minute hand-walk (local main, `npx serve -l 3456`, /app/, fresh profile + real project)
- [ ] Signed-out: upload PDF, 3 marks, close, reopen → restore prompt; wait 10s, Keep → all marks (T1-01)
- [ ] Discard path clears; re-upload same PDF re-applies marks with toast (T1-01/J4)
- [ ] Open project + upload addendum → project name UNCHANGED, "Added N sheets" toast (T1-08)
- [ ] Arc line vs straight same clicks → arc reads ≥ chord (T1-06); expect existing arc totals ~+5%
- [ ] Unscaled page: footer/Summary show px separately, never "ft"; Copy Summary blocks/gates (T1-05)
- [ ] Corrected preset apply → verify hand-off appears; Esc keeps scale (T1-04)
- [ ] Zone preset on corrected page → inherits correction, dialog says "as if printed on…" (T1-07)
- [ ] Load-from-Cloud on a marked project → confirm shows real numbers; tallies survive (T1-09)
- [ ] /app/?t=garbage → full-screen honest message, not empty editor (T1-12)
- [ ] Counter modal Choose tab badges match sidebar counts (T1-11)
- [ ] Ten minutes of normal takeoff on your heaviest real project — feel check
- [ ] Sanity-check one PipeTooling paste: a mixed scaled/unscaled line type now emits TWO rows (ft + px)

## Push
- [ ] Quiet hour; users told: "curved-run totals now read slightly higher — we fixed an under-measurement bug"
- [ ] `git push origin main` (root checkout)

## Post-push verify (live site)
- [ ] `curl https://counttooling.com/sw.js` CACHE_VERSION matches local sw.js
- [ ] New/changed shell files 200 (spot: /features/view-only.js, /geometry.js, /save-engine.js)
- [ ] Load /app/ in a browser: zero console errors, registry present, returning tab auto-heals once
- [ ] Next day: admin User Activity — `client_error` flat; new events (`restore_prompt_shown`,
      `scale_set`, `copy_summary`, `artboard_load`) appearing = fixes reaching users
- [ ] Rollback if needed: push 6f3d75e, then admin global force reload (yanks all tabs)
