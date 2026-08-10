# J15 — Install it, lose signal, keep working

Personas: F · Status: ● walked (Phase 2, mobile 375x812 + 768x1024, offline simulated)

> Seeded from the Phase-1 cross-index workflow (2026-08-02). Phase-2 walk done with the
> real app driven headlessly (touch emulation, all non-local network blocked = basement
> signal). Cloud steps stayed unwalked per the no-cloud rule — walls recorded below.

## Entry points

- **landing** — Browser install: iOS Safari Share sheet > "Add to Home Screen"; Android/desktop Chrome address-bar install icon or menu "Install CountTooling" (no in-app install button/beforeinstallprompt UI documented) (tap)
- **landing** — Home-screen app icon (standalone launch via manifest.webmanifest, display: standalone) (tap)
- **header** — #hamburger (aria-label "Menu") — left slide-in sidebar drawer + #sidebarBackdrop (tap)
- **header** — #headerBurger (aria-label "More actions") — right slide-in drawer #rightMenu/#rightMenuBackdrop; mobile (<=768px) folds Hide-marks/Share/Download-current-page/Export in; also triggers on desktop header overflow (body.header-collapsed) (tap)
- **header** — #saveStatusBtnHeader (Save status bell, compact/mobile header) — opens #saveStatusModal (tap) — *walked note: display:none on mobile AND for signed-out sessions; the burger drawer row is the only mobile surface, and only with a cloud project*
- **status bar** — #saveStatusBtn (Save status bell) — opens #saveStatusModal (tap) — *walked note: hidden for signed-out sessions*
- **footer** — #zoomPct (footer zoom %) — toggles the #zoomRail floating slider; rail gear #zoomRailSettings opens #zoomModal (the modal's only entry point) (tap)
- **status bar** — #statusWarmup ("Preparing pages N/M") — indicator only (single-page sample never showed it)
- **canvas** — canvas (touch-action: none) (single-finger pan; pinch-to-zoom; long-press 500ms for mark context menu; press-and-hold 280ms with a placing tool active enters the aim loupe (slide to aim, release to place))
- **header** — the mobile header tool strip (.header-tools-scroll) — *walked addition:* the tool buttons themselves are a horizontally scrollable strip on <=768px (scrollbar hidden, no affordance); the last tool scrolls under #headerBurger
- **background** — sw.js registration at top of init(); navigator.storage.persist() requested after auth — both automatic, no UI (none)

## Current route (walked 2026-08-02)

Steps 1–4 (install + sign in online) are OS/cloud surfaces — not walkable here; steps 5–10
verified on-device at 375x812 and 768x1024. Real happy path from launch to first counts,
signed out: **7 actions, 2 decisions** (upload → hamburger → Counter → Create tab → name →
Create Counter → tap the plan (first tap only closes the drawer) → tap-tap-tap).

1. *(not walked — OS surface)* Open CountTooling in the device browser and install: iOS Share > "Add to Home Screen"; Android/desktop Chrome "Install CountTooling".
2. *(not walked)* Launch from the home screen — standalone, chrome-free.
3. *(not walked — cloud)* While online, sign in and open your takeoff once in the installed app (iOS keeps separate storage for the installed app). **Walk finding: this step is load-bearing far beyond iOS — a signed-OUT session that relaunches gets an empty shell with no way back to its marks (F1). The docs sell sign-in as an iOS caveat; it is actually the only relaunch-survival path.**
4. Load a plan: big "Upload PDF" button in the header (the only header control besides Menu/Move/Measure before a PDF exists). Verified.
5. Work offline: with the service worker in control, a plain (non-installed) tab reloads and runs with zero network — the shell boots, tools work. Verified by killing the server + navigator offline. **But** signed out, the relaunch shows an empty "Upload PDF" shell — no "Project from Last Session" prompt (that prompt is signed-in-only), and re-picking the same PDF does NOT re-attach marks, even though the local IndexedDB backup demonstrably holds the full PDF blob + every mark (verified by reading the `local` backup record).
6. Navigate by touch: one finger pans, pinch zooms (0.41 → 1.28 in one gesture, smooth transform preview). Verified.
7. Tap the zoom % in the footer to open the zoom rail; drag the thumb, or use its +/− and the gear (Zoom Settings). Verified — and the rail auto-fades to display:none after ~5s idle; a paused adjustment means re-tapping the %.
8. With a placing tool active, press-and-hold (~280ms): the aim loupe appears with a crosshair 44 logical px ABOVE your finger; slide to aim, release to place, land a second finger to cancel without placing. Verified: commit lands on the crosshair, not the fingertip — see F4 for the first-use surprise.
9. Long-press (500ms) any mark **with Move active** for its context menu — "Assign to group / Delete / Water Closet". Verified. While a placing tool is armed the loupe suppresses this long-press entirely (switch to Move first).
10. Drawers: left "Menu" hamburger = Set Scale + the full labeled tool grid + Pages + Counters; right "More actions" burger = Hide marks / Download (Print Current Page (Current Canvas)) / Export (Canvas / PDF / Both). Backdrop tap closes both. Verified.
11. *(not walkable signed out)* Watch the Save status indicator — **wall: for signed-out sessions both bells are display:none; the status bar's only cloud affordance is "Sign In", which opens the auth modal ("Sign In / Email / Password / Cancel / Sign In"). Work autosaves to IndexedDB silently with no indicator at all.**
12. *(not walked — cloud)* Reconnect sync.

## Naive attempt

Booted at 375x812 as a first-timer. Eye lands on the yellow "Upload PDF"; loading the plan
is instant. Counting: nothing in the icon-only header says "count", so tap the left
hamburger — the labeled tool grid makes Counter obvious (row 7 of 8, below the fold-ish).
Counter → modal ("Add a counter first using Create Counter.") → Create tab, which is
genuinely good: "e.g. Water Closet" placeholder, toilet icon preselected. Created — then
stumbled: the drawer stays open covering ~60% of the screen; my first three taps aimed at
fixtures landed on drawer buttons underneath (one opened the Set Scale modal). Recovered
by tapping the visible plan sliver — that tap is swallowed to close the drawer (good: no
stray mark) — then tap-tap-tap placed 3 counts, legend ticked "Water Closet [3]". ~10
actions including the wrong turns. Press-hold loupe surprised me: holding ON the fixture
and lifting placed the mark ~9 plan-feet up in the wrong room (crosshair offset). Zoom
rail found only by experimentally tapping the "41%" readout.

## Friction findings

| # | severity | what happens | why it hurts | verdict |
|---|----------|--------------|--------------|---------|
| F1 | blocker | Signed-out relaunch (tab kill, PWA swipe-away, reboot — exactly the offline-basement case, where signing in is impossible) boots to an empty "Upload PDF" shell. The `local` IndexedDB backup provably contains the PDF blob + all marks, but the "Project from Last Session — Keep and Open" prompt only runs inside the signed-in boot branch (app.js ~6470), and re-picking the same PDF restores the counter palette only, zero marks. | The journey's headline promise ("lose signal, keep working") silently fails at the first app restart: a morning of counts is gone from the user's view while sitting safely on disk. | CONFIRMED — independently reproduced end-to-end (backup record held pdfBlob 37,971 B + 3 marks; relaunch showed no prompt, empty shell; re-upload restored 1 counter, 0 marks). Code: prompt gated inside `state.supabaseSession?.user` branch; boot applies backup before pages exist so `pages[i]` guard drops all annotations; post-upload hash-match is cloud-only. |
| F2 | stumble | After "Create Counter" (and after picking any tool) the left drawer stays open, covering ~60% of a phone screen; the armed tool can't reach the plan. First tap on the sliver closes the drawer instead of placing. Same behavior at 768. | Every tool pick costs an extra dismiss-tap; worse, fixtures hidden under the drawer invite taps that hit drawer buttons (mine opened Set Scale — a real wrong turn). | CONFIRMED — reproduced: drawer measures 220px = 59% of 375 and stays open with tool armed (tool=COUNTER) after Create Counter; elementFromPoint over covered plan returned `scaleZoneBtnSidebar`; a tap there opened the Set Scale modal (the exact wrong turn); sliver tap closed the drawer with 0 marks placed. Code: no tool handler removes `sidebar-open`; the 768 media query includes 768 exactly. |
| F3 | stumble | Header tool strip vs the "More actions" burger: at exactly 768px all 14 tools render but Quick Line (x710–762) sits UNDER the burger (x712–756) — elementFromPoint returns the burger, and with no scroll slack it is untappable. At 375 the strip scrolls (hidden scrollbar, no affordance) and mid-scroll any tool can sit half-behind the burger (Scale Zone at rest). | A core tool looks present but taps open the drawer; half-clipped icons read as broken UI. | CONFIRMED, one detail corrected — reproduced the overlap at 768 (Quick Line x710 w52, burger x712 w44, elementFromPoint at Quick Line's center = `headerBurger`). But "no scroll slack" is wrong: the strip has scrollWidth 698 vs clientWidth 632 (66px of scroll), and at max scroll Quick Line moves to x644 and takes the tap. Severity stands — the scrollbar is hidden and nothing affords the scroll, so a naive tap on the visible tool still opens the drawer. |
| F4 | stumble | Aim loupe commits at the crosshair 44px above the finger. First-time press directly ON a fixture + lift = mark lands ~9 plan-feet away (wrong room at fit zoom). Nothing on screen says "slide the crosshair onto the target". | Quick tap and press-hold place at different spots; the first hold plants a confident-looking wrong mark that then needs Move + long-press + Delete. | CONFIRMED — code-verified: `AIM_OFFSET_LOGICAL_PX = 44` (app.js:4793) and touchend commits at `state.aimPoint` (the crosshair), while a sub-280ms tap dispatches a synthetic click at the fingertip (app.js ~5624) — two different landing spots, and I reproduced the quick-tap-at-fingertip half live. Loupe drive itself not re-driven (covered by aim-loupe-phase2.spec.js). Exact feet-off figure varies with zoom/scale (~9–12 ft at fit); the mechanism is real. |
| F5 | papercut | Zoom rail auto-fades to display:none after ~5s idle; a field pause (glance at the drawing, gloves) loses it mid-adjustment; only re-tapping the % readout brings it back. Also nothing marks the "41%" readout as tappable — its only hint is a hover title ("Click to adjust zoom settings") that touch never shows. | Re-summoning interrupts fine zooming; the rail is invisible to anyone who hasn't tapped the number on a hunch. | CONFIRMED — code: `IDLE_HIDE_MS = 5000` in features/zoom-rail.js; #zoomPct's only affordance is the hover `title`. |
| F6 | papercut | Desktop/mouse language across the touch UI: status bar "Click to place marker", Set Scale modal "Click Select on PDF, then click two points…", tab "Quick ⇧Q" (keyboard chord on a keyboardless device), sidebar tooltips "right-click for settings" on five tools. | Field tech on a tablet is told to click and right-click — vocabulary from a machine they don't have in hand. | CONFIRMED — every quoted string found in source: features/status-bar.js:173, features/scale.js:152, the ⇧Q tab chips in app/index.html (x2), and 5+ "right-click for settings" titles in app/index.html. |
| F7 | papercut | Signed-out sessions have no save indicator anywhere (both bells display:none); autosave-to-device is completely silent. | The person most at risk (F1) gets zero signal that anything is or isn't being kept. | CONFIRMED — CSS gates both bells on supabase/cloud-project state (styles.css:137 hides the header bell on mobile outright; :232–233 require `supabase-enabled` + `has-project`), and my signed-out runs showed the silent IndexedDB autosave writing with zero UI signal. |

## Proposals

- **rework (F1)** — Offer the existing "Project from Last Session — Keep and Open / Discard" prompt to signed-out boots too: the `local` backup record already has everything the restore path needs (PDF blob + data verified). Spirit: (1) fewer steps — total-loss → zero-step recovery; (2) trade language — reuses the prompt's plain wording, no new words; (3) removes the "sign in online first or lose your work" rule and any future recover-my-work support tooling; (4) findable — it appears on its own at launch. **spiritPass: yes** [verified — I re-read the record my own run wrote: pdfBlob + full marks present, and `openLastSessionRestorePrompt({ proj, cachedBlob })` already accepts exactly this shape; only the `user_id: uid` field in `projForRestore` assumes a session]
- **polish (F2)** — Picking a tool or finishing Create Counter on a phone closes the left drawer (the next action is always on the plan). Spirit: (1) −1 tap every tool switch and kills the wrong-turn taps; (2) no new words; (3) removes the swallowed-tap dance and the drawer-covers-fixtures state; (4) automatic — nothing to find. **spiritPass: yes** [verified — reproduced the wrong turn it kills; after every tool pick the next action is on the plan, so auto-close removes a step with no new surface]
- **polish (F3)** — Give the mobile header strip right padding so its last tool clears the burger (and let 768 scroll the 50px it lacks). Spirit: (1) makes the visible tap work first time; (2) none; (3) removes a phantom-tap failure mode; (4) the tool the user can already see becomes tappable. **spiritPass: yes** [verified with correction — 768 already scrolls (66px of slack, measured); the parenthetical is based on a false premise. The real fix is the first clause alone: right padding ≥ the burger's width so no tool can REST under it at any scroll position, at 375 and 768 alike]
- **teach (F4)** — The crosshair-above-finger offset is correct design (the finger must not cover the target) and the loupe already shows it live; the takeoff-on-a-tablet guide already says "slide to aim, release to place". Fails the spirit test as a UI change (an on-canvas coach mark adds chrome, removes nothing) — keep behavior, let the guide carry it. **spiritPass: no (hence teach)** [verified — correct call; the offset is deliberate (finger occlusion) and any coach mark fails the simplicity budget]
- **polish (F5)** — Keep the zoom rail up until dismissed (tap % again / tap the plan) instead of the ~5s fade, or double the idle window. Spirit: (1) no re-summon mid-adjustment; (2) none; (3) removes a timer users can't see; (4) rail stays where the user put it. **spiritPass: yes** [verified — the "keep until dismissed" variant genuinely removes the invisible timer; the "double the window" fallback merely retunes it and should not count as the fix]
- **polish (F6)** — Coarse-pointer copy swap: "Tap to place marker", "Tap two points on the drawing", hide the "⇧Q" chip and the "right-click" tooltip suffixes on touch. Spirit: (1) no step change but fewer decode-decisions; (2) exactly this — tap is the trade's word on a tablet; (3) removes desktop vocabulary from a device that has none; (4) n/a, it's the same surface reading right. **spiritPass: yes** [verified — all quoted strings confirmed in source; this is the program's trade-language test applied literally, and it removes words rather than adding UI]
- **gap (F7)** — Signed-out sessions could reuse the status-bar dot they already have with "Saved on this device" wording; today silence is the indicator. Recorded as a gap alongside the F1 rework (which is the real fix — restore what was saved). **spiritPass: yes (as part of F1)** [verified as a gap record only — on its own it ADDS an indicator, so its simplicity budget is borrowed from F1; correct to keep it subordinate rather than a standalone proposal]
- **keep** — Tap-outside-the-drawer is swallowed (closes the drawer, never places a stray mark). Exactly right on touch. **spiritPass: yes** [verified — reproduced: sliver tap closed the drawer, 0 marks placed]
- **keep** — Counter Create tab: "e.g. Water Closet" placeholder, plumbing icons first with the toilet preselected, big color swatches. A plumber needs zero guidance here. **spiritPass: yes** [verified — placeholder confirmed live; Create Counter worked with zero typing]
- **keep** — Long-press context menu ("Assign to group / Delete / Water Closet"): big touch targets, trade words, mirrors desktop right-click. **spiritPass: yes** [verified — per walker's run + screenshot 06; not re-driven]
- **keep** — Two-finger touch cancels an in-progress aim (press-hold → second finger → no mark, verified) and doubles as pinch. Natural and safe. **spiritPass: yes** [verified — code: touchcancel/second-touch path calls cancelAiming(); walker drove it live]
- **keep** — "Set Scale ⚖ first to use Measure." toast (3s, self-dismissing) when a scale-needing tool is tapped early — with the Set Scale button glowing yellow in the header. The error path teaches the fix. **spiritPass: yes** [verified — showSetScaleFirstToast guards Measure/Quick Line/Polyline in app.js; wording confirmed in source]

## Demo moment

Phone flat on a pipe rack: tap Counter, type nothing (placeholder already says Water
Closet), Create — now tap-tap-tap across the restroom and the on-plan legend ticks
"Water Closet [3]" live while the status bar counts [3 | 0]. Then press-and-hold: a
magnifier balloons over the lav row with a crosshair, slide a hair, lift — the mark drops
exactly on the fixture. Under ten seconds, and it all just ran with the network dead.

## Evidence

- **Telemetry visibility:** Instrumented on this route: session_start (once per browser session, at sign-in — requires Supabase session + connectivity), project_open (opening the cloud takeoff while signed in, non-viewer), and once offline the route CALLS counter_marker_added / line_added (throttled) and project_save — but logUserEvent is a fire-and-forget Supabase RPC with no offline queue (app.js:2732-2745), so events emitted with no signal are dropped silently and never backfilled. export_canvas and export_pdf do not fire on this journey. Net: the journey's defining stretch (working offline) is telemetry-blind; only the online bookends (session_start, project_open, and any post-reconnect saves/placements) are visible. Anonymous/view-link and devAuth sessions log nothing at all (early return without a Supabase user). *Walk confirmation: the signed-out walk produced zero telemetry calls (early return), matching the analysis.*
- **Guide coverage:** [working-offline-and-installing.md](/guides/working-offline-and-installing/) — The journey's core: install steps per platform (iOS Share > Add to Home Screen; Chrome Install), offline behavior (counting/measuring/marking work, auto-save locally every few seconds with backups, sync on reconnect), Save status indicator, the iOS separate-storage caveat (sign in + open takeoff once while online), and a short tablet-gestures section.; [takeoff-on-a-tablet.md](/guides/takeoff-on-a-tablet/) — Touch gestures (one-finger pan, pinch zoom, long-press context menu), the aim loupe (press-and-hold with placing tool, slide, release), the zoom rail (tap zoom % in footer, log-scale slider with labeled ticks), phone-size header folding into a "menu drawer" + left slide-in sidebar, install pointer, offline recap incl. iOS note, field workflow (desktop-to-tablet sync, Measure on site, view links).; [how-your-work-is-saved.md](/guides/how-your-work-is-saved/) — Offline save semantics: dim indicator = offline/saving locally/sync on reconnect; restore-last-session Keep/Discard prompt works from local backup when offline.; [fixing-mistakes.md](/guides/fixing-mistakes/) — Long-press on touch as the equivalent of right-click for the mark context menu.; [sharing-and-view-links.md](/guides/sharing-and-view-links/) — One paragraph: auto-save every few seconds with local backups; installed app keeps working without a connection and syncs on reconnect.; [browser-based-vs-desktop-takeoff.md](/guides/browser-based-vs-desktop-takeoff/) — Positioning only: the browser-based offline-capable model, field use where signal dies.
- **Specs:** pwa.spec.js (manifest/meta/SW + offline-render headline; local only, not CI), mobile-burger-menu.spec.js, header-overflow.spec.js, zoom-rail.spec.js (includes mobile-viewport tap behavior), zoom-no-updateui-during-gesture.spec.js, aim-loupe-desktop.spec.js, aim-loupe-phase2.spec.js, measure-loupe.spec.js, save-status.spec.js, restore-last-session.spec.js, pyramid-persist.spec.js (persisted zoom rungs survive reload), doc-warmup.spec.js (#statusWarmup hint), indexeddb-backup.spec.js (local backups)
- **Modals:** `saveStatusModal`, `zoomModal`, `keyboardMapModal` — *walked additions:* `counterModal` (Choose/Create/Quick), `setScaleFirstModal` (toast), `authModal`, `lastSessionRestoreModal` (signed-in only), `scaleModal`
- **Hotkeys:** None specific to this touch journey — the HOTKEYS table (hotkeys.js) is keyboard/desktop; Space (toggle sidebar) is explicitly "desktop" in its Macros row. On a phone/tablet the Macros modal's "See Keyboard" opens #keyboardMapModal (working-faster-with-the-keyboard.md), but no hotkey drives this journey.
- **Features touched:** Installable app (PWA), Full offline mode, Touch-first tablet support, Aim loupe (mobile), Instant zoom & pan (wheel, pinch, zoom rail), Offline-grade caching of rendered pages, Save Status bell, Context menus (right-click / long-press)

## Guide gaps (doc-derived)

- What is inside the mobile burger drawer — takeoff-on-a-tablet says the header "folds its secondary actions into a menu drawer" but never lists them (Hide marks / Share / Download current page / Export) or names the control (aria-label is "More actions").
- The desktop header-overflow compact mode (narrow window folds the same actions into the same #headerBurger drawer) is undocumented in any guide.
- Storage persistence/eviction: navigator.storage.persist() after auth and the risk of browser eviction of the offline corpus (IndexedDB PDF cache + backups) appear only in ARCHITECTURE.md, no guide.
- Cold-start fully offline: guides only promise offline "once a takeoff is loaded"; no guide says what launching the installed app with zero signal and no session shows. **Walked answer: SW-cached shell, empty "Upload PDF" state, no restore offer when signed out.**
- What does NOT work offline is never enumerated (sign-in, loading a different cloud project, share/view links, cloud PDF fetch). **Walk adds: relaunch recovery of a signed-out session.**
- Offline-grade caching of rendered pages (warm reopen from the persisted zoom-rung cache; the #statusWarmup "Preparing pages N/M" hint) has no guide coverage.
- Zoom rail details undocumented: the +/- buttons, the gear opening Zoom Settings, the ~5s idle auto-fade, and dismissal (re-tap zoom %, outside tap, Escape).
- Aim loupe specifics: which tools are "placing tools", and how to cancel a press-and-hold without placing, are not documented. **Walked answer now in Open questions Q4.**
- App updates in the field: the SW version-stamped cache and the one-time mixed-shell auto-reload after a deploy are undocumented for users.
- Guides give no offline story for the Save Status modal's "Edit session expired" callout (checkout expiring while offline) — how-your-work-is-saved covers expiry generally but not the offline case.

## Terminology on screen (recorded, not judged)

- "Add to Home Screen" (guide quotes iOS Safari's OS wording; no in-app equivalent)
- "Install CountTooling" (guide quotes Chrome's menu wording)
- "Save status" (button title/aria-label on #saveStatusBtn/#saveStatusBtnHeader); guides variously call it the "Save status indicator" and the "Save & sync status indicator"
- "aim loupe" — a guide/docs term only; the on-screen feature has no visible label (pure gesture)
- "zoom rail" — guide term; on screen it is just the zoom % (#zoomPct, title "Click to adjust zoom settings") and an unlabeled slider
- "menu drawer" (guide wording) vs aria-label "More actions" (#headerBurger) vs docs' "burger drawer"
- "Menu" (aria-label on #hamburger, the left sidebar toggle)
- "Preparing pages N/M" (#statusWarmup text; title "Rendering every sheet in the background so page jumps are instant")
- "Canvas" and "PDF" as the two sync-indicator rows in #saveStatusModal (circle = canvas sync, square = PDF sync)
- "Edit session expired" / "Your edits are safe locally but won't sync until you re-check out." (#saveStatusExpiredCallout)
- "Re-check out and save" (#saveStatusExpiredRecheckout button)

*Walked additions (software-language on a touch screen, quoted as rendered):*

- "Click to place marker" (status bar, counter armed, finger device)
- "Click Select on PDF, then click two points on the drawing to define a scale line." (Set Scale modal)
- "Quick ⇧Q" (counter modal tab — keyboard chord on a keyboardless tablet)
- "Counter (right-click for settings)" / "Multiply Zone (right-click for settings)" / "Summary legend (right-click for settings)" / "Grid overlay (right-click for settings)" / "Quick Line (right-click for Line Type settings)" (sidebar tooltips on touch)
- "Print Current Page (Current Canvas)" / "Export Canvas" / "Export Both" (More-actions drawer rows — "Canvas" is app vocabulary)
- "Scale Zone (region-specific scale)" (sidebar tooltip)
- "Polyline" (sidebar tool label)
- "Add a counter first using Create Counter." (counter modal empty state — decent, though the tab it points at is labeled just "Create")
- "Project from Last Session" / "You have a project from your last session. What would you like to do?" / "Keep and Open" / "Discard" (restore prompt — good plain wording; signed-in only)

## Duplicate-surface moments (walked)

- **Header tool strip vs left sidebar tool grid** — the same tools twice; header is icon-only (unlabeled, hidden-scroll strip whose last tool dives under the burger), the sidebar is labeled and complete. They also disagree at 375: header shows 6 tools + burger, the sidebar shows 13.
- **Two identical burger icons, opposite corners** — #hamburger "Menu" (tools/pages/counters) vs #headerBurger "More actions" (hide marks/download/export). Same glyph, different worlds; nothing but position distinguishes them.
- **Four zoom surfaces** — pinch, footer % readout, the zoom rail (thumb + its own +/−), and the Zoom Settings modal behind the rail's gear. The rail is the only route to the modal.
- **Counter creation** — sidebar "Counter" tool button and the COUNTERS section "+ Add" both open the same #counterModal.
- **Save status (from spec, cloud-gated)** — header bell, status-bar bell, and a burger-drawer row are three surfaces for one modal; on mobile CSS hides the header bell so the drawer row is the only mobile surface — and signed out, all three vanish.

## Open questions for the Phase-2 walk

- Cold offline launch: what does the installed app actually show when opened with zero signal and no loaded session — the restore-last-session Keep/Discard prompt from local backup, or an empty shell? **-> Walked (non-installed tab + SW, server killed, navigator offline): the shell boots fine offline, but signed out it is an EMPTY shell — "Upload PDF", 0/0 pages, status "Ready". The Keep/Discard prompt never fires (it lives inside the signed-in boot branch, app.js ~6470), even though the `local` IndexedDB backup holds the full PDF blob + marks (verified by reading the record). See F1.**
- How fast and how visibly does the save indicator go "dim" on signal loss, and does anything else in the UI announce offline? **-> Walk-blocked (cloud): signed out there is no indicator at all — both bells are display:none, nothing announces offline. Signed-in dimming unverifiable without Supabase.**
- Does the NON-installed browser tab behave identically offline (SW covers both)? **-> Yes. This entire walk was a plain tab; after first load the SW controlled it and a zero-network reload booted and worked. Guides oversell install as the offline prerequisite outside iOS.**
- Which tools exactly trigger the aim loupe, and how do you cancel without placing? **-> From code (isAimingTool) + spot-verified: Measure, Set Scale point-picking, Line, Counter, Highlight, Multiply Zone, Scale Zone, Delete area, Room, Note, Polyline (only mid-draw), grid-origin pick. Cancel = land a second finger (verified aiming→false, no mark placed); it flows straight into pinch.**
- iPad in practice: at 768px+ does it get the desktop or mobile header? **-> Exactly 768 gets the MOBILE rules (hamburger, tool strip, #headerBurger visible). All 14 strip tools fit — but Quick Line renders under the burger and elementFromPoint gives the burger the tap, with no scroll slack to free it (F3). The sidebar stays an overlay drawer.**
- Does navigator.storage.persist() surface a visible browser prompt? **-> Walk-blocked: it is only requested after auth (cloud), and a headless Chromium grant proves nothing about Android UI.**
- Zoom rail on touch: does the thumb track a live pinch, and does the auto-fade interrupt a slow field adjustment? **-> Thumb tracks (after a pinch to 84%, opening the rail showed the thumb at 84%; syncZoomIndicators drives it per frame). Auto-fade: display:none after ~5s idle — yes, a paused adjustment loses the rail (F5). Rail drag itself could not be exercised with synthetic events (pointer-capture path); +/− and open/close verified, drag covered by zoom-rail.spec.js.**
- Reconnect behavior: is sync automatic, what latency, does #saveStatusExpiredCallout appear? **-> Walk-blocked (cloud). Wall: signed-out reconnect has nothing to sync and no UI changes.**
- Deploy-while-in-the-field mixed-shell auto-reload? **-> Walk-blocked (needs a real deploy + dirty cloud project).**
- Are offline-placed marks' telemetry RPCs dropped with a console error, and does anything user-visible leak? **-> Signed out: logUserEvent early-returns before any network call — zero errors, zero Save Status noise (verified silent). Signed-in offline drop unverifiable here.**
- Does long-press context menu vs aim loupe vs pan ever conflict on a placing tool? **-> No conflict: with a placing tool the 280ms aim timer fires first and explicitly suppresses the 500ms menu long-press. Corollary worth knowing: you cannot long-press a mark's menu while any placing tool is armed — switch to Move first (documented in step 9).**

## Guide actions

*(Phase 5)*

## Walk notes

**Not walked (with walls):**
- Install to home screen (steps 1–2) — OS chrome, unreachable headlessly.
- Sign-in / cloud open (step 3) — cloud forbidden. Wall as seen: status bar "Sign In" → #authModal: "Sign In / Email / Password / Cancel / Sign In". Submission would call production Supabase — not attempted.
- Save-status bell states, dim-on-offline, reconnect sync, edit-session expiry (steps 11–12) — all require a signed-in cloud project; signed out, every save-status surface is display:none (verified) so there is nothing to observe.
- Zoom-rail thumb drag — real-pointer path (setPointerCapture) not reproducible with synthesized events; covered by zoom-rail.spec.js.
- storage.persist() prompt, deploy mixed-shell reload, #statusWarmup (single-page sample plan never warms).

**Environment quirks:**
- Harness: Playwright Chromium, isMobile+hasTouch, viewports 375x812 and 768x1024, static server on 127.0.0.1:4115 serving the repo; ALL non-local requests aborted (stands in for the dead basement signal — also guarantees the no-cloud rule). Offline relaunch = server closed + context.setOffline(true) after the SW took control.
- Marks/loupe/pinch driven with synthesized TouchEvents (the aim-loupe-phase2.spec.js recipe); taps via Playwright touchscreen (real hit-testing — which is how F2's drawer-eats-taps was caught honestly).
- Every boot logs one console 404 (a shell asset probe; harmless locally).
- Sidebar tool labels differ slightly from ids ("Multiply" on screen vs "Multiply Zone" tooltip; "Room" vs "Room Sizer"; "Line" vs "Quick Line").

**Screenshot index:**
- [img/field-tablet-offline-01.png](img/field-tablet-offline-01.png) — 375x812 first load: icon-only header strip, plan fitted at 41%.
- [img/field-tablet-offline-02.png](img/field-tablet-offline-02.png) — Counter modal Create tab: "e.g. Water Closet", toilet icon preselected.
- [img/field-tablet-offline-03.png](img/field-tablet-offline-03.png) — friction (F2): drawer still open after Create Counter, plan reduced to a sliver.
- [img/field-tablet-offline-04.png](img/field-tablet-offline-04.png) — demo: three taps, legend "Water Closet [3]", status [3 | 0].
- [img/field-tablet-offline-05.png](img/field-tablet-offline-05.png) — demo: aim loupe mid-hold, crosshair on the lav row.
- [img/field-tablet-offline-06.png](img/field-tablet-offline-06.png) — long-press context menu: Assign to group / Delete.
- [img/field-tablet-offline-07.png](img/field-tablet-offline-07.png) — friction (F1): offline relaunch signed out — empty "Upload PDF" shell, no restore offer.
- [img/field-tablet-offline-08.png](img/field-tablet-offline-08.png) — 768x1024: zoom rail open (log ticks 25–400%, thumb 84%), full header strip with Quick Line under the burger.

## Verification (2026-08-02)

Adversarial re-drive by an independent verifier: same recipe (throwaway node script, static
server on 127.0.0.1:4315 serving the repo root, Playwright Chromium with isMobile+hasTouch at
375x812 and 768x1024, all non-local requests aborted), plus source reads of app.js,
annotation-model.js, save-engine.js, features/*, styles.css.

**Reproduced first-hand:**

- **F1 (blocker) — full repro.** Uploaded the sample plan signed out, created a counter through
  the real modal, got 3 marks into state, waited out the backup debounce, and read the `local`
  IndexedDB record in-page: `{hasBlob: true, blobSize: 37971, counters: 1, marks: 3}`. Reload:
  no `#lastSessionRestoreModal`, 0 pages, "Upload PDF" shell (counters: 1 — the palette comes
  back because `applyTakeoffBackupToState` runs at boot, but `pages[i]` is undefined so every
  annotation array is silently skipped). Re-picking the same PDF: 1 counter, **0 marks**. The
  three code gates all check out: the restore prompt sits inside
  `if (SUPABASE_ENABLED && … state.supabaseSession?.user)` (app.js ~6470), the boot-time backup
  apply predates page objects, and the post-upload annotation match (`promptLoadAnnotations`,
  features/pdf-intake.js) queries only cloud projects. Blocker severity is earned.
- **F2 (stumble) — full repro.** Drawer = 220px = 59% of a 375 screen. After Create Counter the
  modal closes, tool = COUNTER, `sidebar-open` still set. `elementFromPoint` over drawer-covered
  plan returned `scaleZoneBtnSidebar`; tapping the covered area opened the Set Scale modal —
  the walker's wrong turn, re-hit independently. Sliver tap: drawer closed, no mark (the good
  swallow). No tool handler in app.js removes `sidebar-open`; the `max-width: 768px` media query
  includes 768 exactly, so the claim generalizes.
- **F3 (stumble) — repro with one correction.** At 768: Quick Line x710 w52, burger x712 w44,
  `elementFromPoint` at Quick Line's center = `headerBurger`. **However** the walker's "no scroll
  slack" is false: `.header-tools-scroll` has scrollWidth 698 vs clientWidth 632, and after a
  max scroll Quick Line sits at x644 and receives the tap. The finding stands at stumble (hidden
  scrollbar, zero affordance — a naive tap on the visible tool still opens the drawer), but the
  proposal's "give 768 the scroll it lacks" clause was rewritten: pad the strip instead.
- **F4 (partial) —** quick tap places at the fingertip, verified live (synthetic click from the
  sub-280ms touchend path); the 44px commit-at-crosshair is code-fact (`AIM_OFFSET_LOGICAL_PX`,
  commit uses `state.aimPoint` on lift). The loupe gesture itself was not re-driven here;
  aim-loupe-phase2.spec.js covers it. The two-placement-points surprise is real.

**Verified from source (not re-driven):** F5 (`IDLE_HIDE_MS = 5000`, features/zoom-rail.js), F6
(every quoted string found: features/status-bar.js:173, features/scale.js:152, two ⇧Q chips and
five "right-click for settings" titles in app/index.html), F7 (styles.css:137 and :232–233 gate
both bells on mobile/supabase/has-project state).

**Verifier notes:**

- One walk-harness gotcha worth recording: at 375x812 the landscape sheet fitted-to-width
  occupies only y≈52–294; taps below that band land on dead wrapper and place nothing. My first
  run's "taps place no marks" scare was aim error, not an app bug — the walker's tap-tap-tap
  account is accurate when the taps are on the sheet.
- All 7 findings survive; zero killed, zero severity changes. The single factual correction
  (F3's scroll slack) does not move its severity but does change the right fix.
- The walker's restraint is credible: the five keep verdicts and the teach on F4 all held up
  under an adversarial pass, and the F1 blocker is the genuine headline — reproducible in under
  a minute and squarely on the journey's stated promise.
