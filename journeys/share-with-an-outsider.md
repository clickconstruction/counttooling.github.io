# J14 — A view link end-to-end: sender and recipient

Personas: V P · Status: ● walked (Phase 2, 2026-08-02; independently re-walked and reverified 2026-08-09 — cloud calls stubbed locally, see Walk notes)

> Seeded from the Phase-1 cross-index workflow (2026-08-02). Phase 2 walk done against the
> real app served locally; every Supabase call was fulfilled or aborted by a local Playwright
> route (NO production cloud touched). Sender-side signed-in state was simulated in-page.
> The 2026-08-09 re-walk repeated the naive attempt, both sender paths, the recipient happy
> path, all four failure variants, the viewer-scale share-back (success + failure), the
> offline cached reopen, and the mobile pass — every finding below reconfirmed on today's
> build; refinements from the re-walk are marked "(re-walk)". All 8 screenshots regenerated.

## Entry points

- **header** — #headerShareBtn — Share button (title "Share"). REALITY CHECK: it does NOT open the Share modal; it copies/mints the view link (`copyOrCreateViewLinkToClipboard`), and it is only ever visible for a *signed-in viewer on mobile* (`.in-view-mode`, ≤768px). Desktop CSS hides it unconditionally.
- **header** — #copyViewLinkBtn — "Copy view link" icon; visible signed-in + cloud project open + not a view-link session, desktop only (hidden ≤768px). One click = mint-or-reuse + clipboard.
- **sidebar** — #sidebarLogoShare — Share opener on the sidebar logo row; same gating, but not visible in the resting desktop layout (logo-row icons are hover/flyout-scoped) — walked via direct invocation.
- **modal** — #settingsShareProject — "Share" button inside Project Settings (gear) — confirmed present signed-in.
- **modal** — #shareViewLinksHeader — collapsible "View links" section inside #shareProjectModal (▶ **collapsed by default**; "Create view link" invisible until expanded) → per-row "Copy URL" / "Access log" / "Revoke".
- **footer** — Copy to PipeTooling export appends a view link (same mint path). Not walked to the end (shared surface, J8).
- **landing** — Recipient: /app/?t=TOKEN → #viewLinkEmailModal email gate ("View Plans" / "Continue") — gate shows *before* the token is validated.
- **header** — #hideMarksBtn — eye toggle for recipients; desktop header. On phone width it moves into the burger menu ("Hide marks").
- **hotkey** — Viewer-allowed keys D/S/M/J/R confirmed working (D failure in one probe was a test-focus artifact); Escape cancels the email prompt.

## Current route (walked 2026-08-02; re-walked 2026-08-09)

Sender fast path — 2 steps, 0 decisions (signed-in, project open, desktop):

1. Click the header link icon ("Copy view link") — flushes any pending save, reuses the project's existing link or mints one, copies the URL, toast "View link copied to clipboard", icon flashes green. ([img/share-with-an-outsider-02.png](img/share-with-an-outsider-02.png))
2. Paste into a text/email to the GC (outside the app).

Sender modal path — 4 steps, 1 decision (needed for access log / revoke / naming nothing — the modal is also the only place to see existing links):

1. Gear → Project Settings → "Share" (or the sidebar-logo Share icon) → "Share Project" modal opens, **leading with teammates** ("Add users by email… Select a user…").
2. Expand the collapsed "View links ▶" section (decision: nothing on screen says the GC path lives here).
3. Click "Create view link" — creates AND copies ("View link created and copied to clipboard"), row appears: "View link · date · Copy URL / Access log / Revoke". ([img/share-with-an-outsider-03.png](img/share-with-an-outsider-03.png))
4. Send the URL outside the app.

Recipient — 3 steps, 0 decisions:

1. Open the link → "View Plans / Enter your email to view these plans." gate (placeholder `you@clickplumbing.com`). ([img/share-with-an-outsider-01.png](img/share-with-an-outsider-01.png))
2. Type email, Continue (Enter works). No account, no password.
3. The live takeoff opens (re-walk: ~160 ms after Continue with a local stub; network-bound in production): marks, sidebar tallies, legend. Read-only: mark-making tools are gone from the toolbar; Move/Measure/Room/Grid remain — and (re-walk) the Set Scale ruler button ALSO shows in the viewer toolbar, but only while the current page has no scale; it disappears once calibrated. Recipient can Measure (D → two clicks → "Distance: 25'-0\""), toggle Hide marks (remembered per link), page/zoom/layers, and download the marked PDF (print icon "Download current page as marked PDF" or sidebar "Export PDFs" — both produced real PDFs in the walk). ([img/share-with-an-outsider-04.png](img/share-with-an-outsider-04.png))

Viewer-set scale (uncalibrated sheet) — walked: S (or the ruler button, visible while uncalibrated) → presets tab → tap a preset → "Scale set for everyone viewing this plan" (share-back stub 200; re-walk note: there is one toast slot, so when the share succeeds quickly this message is the one you see). With the share-back failing: "Couldn't share the scale — it applies only on this device for now" and the sidebar scale shows "… · temp" (re-walk verified: "1 ft = 3.4 px · temp", stored in `view:scale:<token>`), persisted per token and restored on reload.

Owner follow-ups — walked (owner state simulated): "Scale changed by a viewer" must-clear notice with page, label, px/ft, viewer email and time; "Got it" clears the stamp ([img/share-with-an-outsider-08.png](img/share-with-an-outsider-08.png)). Access log = browser alert ("Access log:\n\nemail — date…"). Revoke = confirm("Revoke this view link? It will stop working immediately.") → row gone, "No view links yet."

Return visit: gate is skipped (email remembered per token per device); with the network fully dead the cached snapshot + PDF loaded in ~1.4 s (re-walk: ~1.7 s) with zero cloud traffic, and a viewer temp scale survives the offline reopen.

## Naive attempt

As a signed-out estimator with the plan open: scanned the header (tools, gear "Project Settings", export, download icons), the gear (re-walk correction: it IS clickable signed-out — it opens the bare Sign In modal, Email/Password, with no hint that sharing lives behind it), the Export dropdown (Export PDF / Import Canvas) and the sidebar. **Zero share affordances exist signed-out** — all five share controls are display:none; nothing hints that sharing exists behind "Sign In". Dead end after ~6 probes. As the GC with a bad token: the email gate appeared instantly (before any validation), I entered an email, hit Continue — a 5-second toast "Failed to load: Failed to fetch" and then I was sitting in the full empty estimating editor (Upload PDF, tool icons, "Sign In") with no idea what went wrong. Re-run 2026-08-09: identical on both sides — zero share affordances signed-out (all five share controls display:none; exactly one aborted network attempt confirmed the flow would have called the cloud only after the email submit).

## Friction findings

| # | severity | what happens | why it hurts | verdict |
|---|----------|--------------|--------------|---------|
| 1 | blocker | Dead/revoked/unreachable link: recipient fills the gate, then gets a transient toast ("Failed to load: View link not found" / "…: Failed to fetch") and is left in the **full empty estimating editor** — Upload PDF button, tool icons, Sign In ([img/share-with-an-outsider-06.png](img/share-with-an-outsider-06.png)) | The one failure a GC will actually hit (link revoked/expired/typo'd). After the toast fades there is zero explanation, no retry, no "ask the sender" — the GC concludes the app is broken, or worse, starts uploading their own PDF into a tool they were never meant to drive | CONFIRMED — independently reproduced (404 stub → toast → after fade, full empty editor with Upload PDF/tools/Sign In, zero error surface anywhere in visible DOM); source: app.js:6391 toast is the *only* failure handling |
| 2 | stumble | Share modal leads with the teammates block ("Add users by email… Select a user…" — a dropdown of existing app users only); the outsider path is a **collapsed "View links ▶"** section; "Create view link" is invisible until expanded | First-time sender looks for the GC in the user dropdown, doesn't find them, and can conclude outsiders can't be added. The actual J14 path is hidden one fold below | CONFIRMED — independently reproduced (simulated session, modal open: `#shareViewLinksContent.collapsed`, Create button 0-height); `class="collapsed"` is hardcoded in app/index.html |
| 3 | stumble | Domain copy is hardcoded and contradicts the journey: Share modal says "Recipients enter their email (clickplumbing.com) to view.", gate placeholder is `you@clickplumbing.com`, rejection reads "Access restricted to clickplumbing.com" ([img/share-with-an-outsider-05.png](img/share-with-an-outsider-05.png)) | A sender can't tell from the UI whether an outside GC's own email will work; an outside GC reading the placeholder may type an email that isn't theirs. If the domain restriction is on server-side, "share with an outsider" is simply impossible and nothing tells the sender that up front | CONFIRMED — source: app/index.html:2249 + :2370 hardcode the domain in copy and placeholder. Nuance the walk missed: view-only.js:193 already reads a `window.VIEW_LINK_ALLOWED_DOMAINS` config for the *rejection* fallback — the config hook half-exists, only the static copy ignores it |
| 4 | stumble | Escape or Cancel at the email gate silently drops the recipient into the empty signed-out editor; only a browser reload brings the gate back | An accidental Escape looks like the link died; the recovery (reload) is nowhere suggested | CONFIRMED — independently reproduced (Escape at gate → modal gone, `state.isViewer` false, 0 pages, editor exposed); source: app.js:5839 cancel path + view-only.js:190 `if (!email) return;` |
| 5 | stumble | Viewer export dropdown offers "Export Canvas" and "Export Both"; "Export Both" downloads a `.json` file and toasts "No PDF available to download." (viewer sessions have no pdfBuffer) — while the *working* marked-PDF exports live elsewhere (print icon, sidebar "Export PDFs") | The GC's one export need (marked PDF) is the one option missing from the Export menu; what's offered is internal-format software language that half-fails | CONFIRMED — independently reproduced (viewer session: visible options exactly ["canvas","both"], Export Both → `Sample_Plan.json` download + "No PDF available to download." toast); source: view-only.js:284 nulls pdfBuffer, output.js:487 |
| 6 | papercut | Room Sizer button stays visible in the viewer toolbar (desktop + mobile). Re-walk detail: on a calibrated page clicks are silently swallowed (tool guard, no feedback); on an UNcalibrated page it toasts "Set Scale first to use Room Sizer." — but for a viewer the tool never activates even after the scale is set | Dead button in a 4-button toolbar; the no-scale toast makes a promise the viewer session can't keep, so the GC calibrates and taps again for nothing | CONFIRMED — independently reproduced both halves (uncalibrated: toast "Set Scale first to use Room Sizer."; after scale set: click leaves `state.tool` at NONE, no feedback); source: app.js:3103-3105 guard fires before any viewer check, app.js:2097 resets viewer tools |
| 7 | papercut | Recipient's Pages list shows "document.pdf" instead of the plan/project name (status bar does say "Sample Plan") | Software placeholder where the one label a GC recognizes (the plan name) should be | CONFIRMED — independently reproduced (viewer Pages list item reads "document.pdf"); source: view-only.js:274 hardcodes the label |
| 8 | papercut | Measure on an uncalibrated sheet reports "[… \| 226 px]" in the status bar, no nudge toward Set Scale. Re-walk detail: the Set Scale ruler button IS in the viewer toolbar while the page is uncalibrated — but nothing links the meaningless px readout to it | Pixels mean nothing in the field; the escape hatch is on screen but unlabeled (an icon glyph), and the px readout never points at it | CONFIRMED — source: geometry.js:251-252 (`if (!scale) return Math.round(pdfPts) + ' px'`) is the unconditional no-scale fallback for the Distance readout (app.js:4514); no nudge exists anywhere in that path |
| 9 | papercut | Access log renders as a raw browser `alert()`; anonymous viewer's mobile burger lists "Save status" | Crude but working; "Save status" is a cloud concept irrelevant to an anonymous GC | CONFIRMED — source: share-links.js:142 raw `alert('Access log:…')`; burger-menu.js:72 gates the "Save status" row on `SUPABASE_ENABLED && state.currentProjectId` only, and a view-link session *sets* currentProjectId, so the anonymous viewer gets the row |

## Proposals

- **rework** — Failure landing for a bad/revoked/offline-no-cache link: replace toast-over-empty-editor with a plain full-screen message and nothing else: "This plan link isn't active anymore. Ask the person who sent it for a new one." (+ a Retry for network failures). Spirit: (1) removes every wrong decision on the failure path; (2) "plan link", "ask the person who sent it" — no "fetch"; (3) removes the entire misleading empty-editor surface from this path; (4) automatic — nothing to find. PASS. [verified — failure reproduced end-to-end; simplicity budget is real (the whole empty-editor surface leaves this path)]
- **polish** — Make the view-link block the first thing in the Share modal and leave it expanded ("Create view link" visible on open); teammates below. Spirit: (1) −1 click, −1 discovery decision on the common outsider case; (2) could retitle section "Send a look-only link"; (3) removes the collapsed fold; (4) button visible the moment the modal opens. PASS. [verified — the load-bearing half is *expand by default* (collapse reproduced; removes the fold). The *reorder above teammates* half rests on an unproven claim that the outsider case is the more common share — no usage data either way; ship the expand, treat the reorder as optional]
- **polish** — Replace the hardcoded "(clickplumbing.com)" sentence and placeholder with the deployment's actual policy ("any email" vs "yourcompany.com emails only"), so the sender knows before sending whether an outside GC can get in. Spirit: (1) prevents a send-then-blocked round trip; (2) plain words; (3) removes a contradiction, adds nothing; (4) it's in the same sentence they already read. PASS. [verified — and cheaper than the walk implies: `window.VIEW_LINK_ALLOWED_DOMAINS` (view-only.js:193) already exists for the rejection fallback; the fix is wiring the two static strings to the same config]
- **polish** — Escape/Cancel at the gate: re-show the gate (or a "This plan needs your email to view — reload to try again" card) instead of revealing the editor. Spirit: (1) removes the reload-hunt; (2) trade words; (3) removes a dead-end state; (4) automatic. PASS. [verified — strand reproduced; a recipient who truly wants out closes the tab, so re-showing the gate traps nobody]
- **hide** — In view-link sessions, drop "Export Canvas"/"Export Both" from the Export dropdown (viewers keep the print icon and Export PDFs, both verified working). Spirit: (1) fewer choices; (2) removes "Canvas"/"Both" software words from the GC's menu; (3) removes two half-broken buttons; (4) the surviving PDF paths are already findable. PASS. [verified — half-failure reproduced; bonus: app.js:2378-79 already hides the Export dropdown when it has zero rows, so this one change removes the *entire* dropdown from viewer sessions for free]
- **hide** — Hide the Room Sizer button for viewers (its clicks are already blocked, and on uncalibrated pages it currently shows a "Set Scale first to use Room Sizer." toast that can't be honored in a view session). Spirit: (1) one less dead tap and one less false promise; (3) removes an inert control and its misleading toast; (4) n/a. PASS. [verified — both the false toast and the silent post-calibration swallow reproduced]
- **polish** — Recipient Pages list: label pages with the plan name ("Sample Plan — p1") instead of "document.pdf". Spirit: trivially passes all four. PASS. [verified — one-line fix at view-only.js:274; the plan name is already in the payload]
- **keep** — The one-click header "Copy view link" (flush → mint-or-reuse → clipboard → toast + green flash). 1 action, 0 decisions; this is the demo. ([img/share-with-an-outsider-02.png](img/share-with-an-outsider-02.png)) [verified]
- **keep** — The email gate: one field, Continue, no account; remembered per device per link; wrong-domain rejection is inline, plain, and retryable in place. [verified — gate and remembered-email path re-driven]
- **keep** — The viewer toolset and its language: "Distance: 25'-0\"", "Scale set for everyone viewing this plan", "Couldn't share the scale — it applies only on this device for now", the owner's "Scale changed by a viewer … Got it" notice, Hide marks remembered per link, offline reopen from cache (~1.4 s, zero network). [verified]
- **keep** — Revoke: plain confirm ("It will stop working immediately"), immediate row removal; view-links section stays expanded across modal reopens within the session. [verified — confirm string at share-links.js:146]
- **teach** — Signed-out sender wall: sharing (like all cloud features) simply doesn't exist until Sign In, with no breadcrumb. Adding signed-out share chrome would violate the simplicity budget; the guides/landing should carry "sharing needs a (free) sign-in" instead. Fails spirit (3) as a UI change → teach. [verified — re-drove the naive attempt: all four share controls display:none signed-out; teach is the right call]
- **teach** — Measure-in-px before scale: the escape hatch is already on screen (the ruler button appears in the viewer toolbar whenever the page is uncalibrated, and S is viewer-allowed); a "Set the scale to read feet (S)" hint in the guide covers the connection. Kept out of the UI to protect the status bar. (Borderline polish; smallest possible inline nudge would also pass.) [verified — correct restraint; the px fallback is a two-line formatter (geometry.js:251), and any inline nudge would touch the status bar every walker fought to keep quiet]

## Guide actions

*(Phase 5)*

## Demo moment

Estimator: one click on the header link icon — "View link copied to clipboard" — text it to the GC. GC (phone or desktop): tap the link, type your email, Continue — the live marked-up plan is on screen in seconds, tallies and legend included, no account, nothing to install; tap the ruler, two taps on a run — "Distance: 25'-0\"". The whole round trip is under 10 seconds of UI. ([img/share-with-an-outsider-02.png](img/share-with-an-outsider-02.png) → [img/share-with-an-outsider-04.png](img/share-with-an-outsider-04.png))

## Open questions for the Phase-2 walk

- What a recipient sees on a revoked or malformed ?t=TOKEN (error copy? blank canvas? redirect?) → **Answered (simulated 404):** the email gate shows FIRST (token unvalidated), then after Continue a 5 s toast "Failed to load: <server message>" (network failure: "Failed to load: Failed to fetch") over the empty signed-out editor. No redirect, no persistent error. Finding #1.
- Exact rejection experience for a wrong-domain email at the gate → **Answered:** gate stays up, red inline "#viewLinkEmailError" shows the server message (fallback "Access restricted to clickplumbing.com"), the typed email is kept, retry in place works ([img/share-with-an-outsider-05.png](img/share-with-an-outsider-05.png)).
- When #copyViewLinkBtn becomes visible and how it coexists with #headerShareBtn on mobile → **Answered:** #copyViewLinkBtn = signed-in + project + not-view-link, desktop only (CSS hides ≤768px). #headerShareBtn = mobile-only, and only `.in-view-mode` (signed-in user inside a view-link session); it copies the link rather than opening the modal (dossier Phase-1 entry was wrong). They can never be visible together.
- Offline reopen of a view link → **Answered:** gate does NOT reappear (view:allowed:<token> remembered); with every supabase route dead the cached snapshot + PDF rendered in ~1.4 s, no error shown.
- updatedAt revalidation timing → **Partially (source):** every open refetches; cache is only used when the fetch fails. Visible freshness against a real owner re-save: walk-blocked (needs production).
- Whether a viewer temp scale retries sharing back when connectivity returns → **Answered (source):** no auto-retry; it only shares on the next explicit scale apply. The temp scale is restored per device and only for pages the server has no scale for.
- Whether the viewerScaleNotice fires for a checked-out editor who is not the owner → **Answered (source + simulated):** no — `isOwner` requires projectOwnerId === session user; owner only.
- Access-log alert readability on phone-size screens → **Partially:** it is a native `alert()` with "email — date" lines, empty state "No access yet"; functional but unstyled. True phone rendering: walk-blocked (needs signed-in mobile sender).
- User-visible latency of "Creating..." and the pending-save flush → **Walk-blocked:** stubs made both ~instant; real latency is network-bound. The flush is best-effort (sharing proceeds even when the save fails — verified with aborted PATCHes).
- Escape-cancel of the email gate: what state is the page left in? → **Answered:** modal hides, recipient sits in the empty signed-out editor (Upload PDF etc.); only reload restores the gate. Finding #4.
- Whether the view-links section remembers its collapsed state across modal opens → **Answered:** yes within the session (DOM class survives close/reopen); resets to collapsed on page reload. Not persisted.

## Evidence

- **Telemetry visibility:** Effectively blind. logUserEvent (app.js ~2732) requires SUPABASE_ENABLED + a signed-in supabase session, so the anonymous view-link recipient emits NONE of the 7 events — no session_start, no project_open (which is additionally gated on !state.isViewer), and Measure/Set Scale/Hide marks in view mode log nothing. On the sender side, session_start/project_open/project_save fire as part of the owner's ordinary session, but creating, copying, revoking a view link and the viewer scale share-back emit no instrumented event. Recipient visibility exists only via the separate view_link_access_log table (Share dialog → Access log), which is outside the 7-event telemetry.
- **Guide coverage:** [sharing-and-view-links.md](/guides/sharing-and-view-links/) — Primary guide: creating the link from the Share dialog's view-links section, header Share copies the link directly, recipient email gate (domain-gated, no account), access log, revoke anytime, viewer toolset (live marks/tallies/legend, pan/zoom/pages/layers, Hide marks remembered per link, Measure in view mode, Set Scale sharing back with a notice to the owner); [annotating-and-reviewing.md](/guides/annotating-and-reviewing/) — Hide marks eye — view-link recipients get the same toggle, choice remembered per link; [canvas-layers.md](/guides/canvas-layers/) — Viewers on a view link can browse layers; browsing doesn't modify the project; [takeoff-on-a-tablet.md](/guides/takeoff-on-a-tablet/) — Recipient on mobile: pan, zoom, layers, Hide marks, and setting a page scale that shares back; [admin-handbook.md](/guides/admin-handbook/) — View links are email-domain-gated, every access logged (Share dialog → Access log), revocable anytime; inherited view links move with project transfer; [reports-and-exports.md](/guides/reports-and-exports/) — Copy to PipeTooling appends a view link back to the source takeoff; [how-to-do-a-pdf-takeoff.md](/guides/how-to-do-a-pdf-takeoff/) — Pointer only: send a view link when someone needs to see the live takeoff; [browser-based-vs-desktop-takeoff.md](/guides/browser-based-vs-desktop-takeoff/) — Positioning mention: view links show a takeoff to a GC or inspector with no account
- **Specs:** share-links.spec.js, view-only.spec.js, viewer-scale.spec.js, rotation-share-roundtrip.spec.js, hide-marks.spec.js, copy-tooling-feet.spec.js, hotkeys.spec.js
- **Modals:** `shareProjectModal`, `viewLinkEmailModal`, `viewerScaleNoticeModal`
- **Hotkeys:** D — Measure Distance (viewerAllowed), S — Set Scale (viewerAllowed), M — Move mode (viewerAllowed), J — Toggle snap to 45° angles (viewerAllowed), R — Rotate page (viewerAllowed), Escape — cancels the view-link email prompt (bespoke, App.cancelViewLinkEmailPrompt)
- **Features touched:** View links (no sign-in), Viewer scale sharing, Project sharing (viewer/editor roles), Measure tool (D), Hide marks (eye toggle), Canvas layers (multiple canvases per page), Per-page scale (two-point, presets, or custom), Full offline mode, Copy to PipeTooling

## Guide gaps (doc-derived)

- Temp-scale fallback: guides say a viewer scale "shares back" but never document the failure path — offline/rejected share leaves a temporary local scale labeled "… · temp", stored per link in localStorage (view:scale:<token>) and restored only for pages the server has no scale for
- updatedAt revalidation: no guide documents that reopening a view link revalidates against the server (reusing the cached PDF blob by hash) so the viewer isn't pinned to a stale copy after the owner re-saves
- Offline view cache: working-offline-and-installing.md covers the installed app for signed-in users only; nothing documents that a view-link session falls back to a cached snapshot offline (verified working)
- The allowed email domain is hard-worded in-app ("Recipients enter their email (clickplumbing.com) to view."); guides say "gated to your allowed domain" with no doc of how the domain is set or what a rejected email sees (rejection walked: inline red message, retry allowed)
- Owner-side notice behavior undocumented in guides: the "Scale changed by a viewer" modal re-appears on every landing on a page whose scale carries viewerSet until "Got it" deletes the stamp and persists
- Revoke details undocumented: the confirm wording ("It will stop working immediately") and that revoking clears the Copy to PipeTooling export's prefetch cache
- The dedicated header "Copy view link" button (#copyViewLinkBtn) is not distinguished in any guide from the Share button (guide says the header Share button copies the link — on desktop the visible control is #copyViewLinkBtn; #headerShareBtn exists only for signed-in mobile viewers)
- Access log presentation undocumented: rendered as a browser alert, empty state "No access yet"
- The bakeFrame orientation check on loaded view pages (misaligned share surfaced, not rendered wrong) appears only in ARCHITECTURE.md, no guide
- NEW (walked): nothing documents what a recipient sees on a dead link (toast + empty editor), that Escape/Cancel strands the recipient in the editor, or that the viewer's Export dropdown items ("Export Canvas"/"Export Both") don't produce the marked PDF — the print icon / "Export PDFs" do

## Terminology on screen (recorded, not judged)

- "Create view link" (button in Share modal view-links section)
- "Share a view-only link. Recipients enter their email (clickplumbing.com) to view." (section copy — hardcoded domain)
- "Copy URL", "Access log", "Revoke" (per-link row buttons)
- "Revoke this view link? It will stop working immediately." (confirm dialog)
- "View Plans" / "Enter your email to view these plans." / "Continue" (recipient email-gate modal)
- "Access restricted to clickplumbing.com" (gate rejection, server-worded)
- "Failed to load: View link not found" / "Failed to load: Failed to fetch" (dead-link toasts)
- "Scale changed by a viewer" / "Got it" (owner notice modal)
- "Hide marks" (eye button title; also a burger item on phones)
- "Copy view link" (header button title) / "View link copied to clipboard" (toast)
- "View link created and copied to clipboard" (create toast)
- "… · temp" (suffix on scale labels for an unshared viewer scale)
- "Viewers can view only; editors can check out to edit." (Share modal role copy — 'viewer' role vs view-link 'viewer' overloading; "check out" is software language)
- "document.pdf" / "document.pdf — pN" (recipient's Pages-list label)
- "Export Canvas" / "Export Both" / "No PDF available to download." (viewer Export dropdown + its failure toast)
- "Print Current Page (Current Canvas)" / "Save status" (anonymous viewer's mobile burger)
- "Distance: 25'-0\"" (measure toast — trade-format, the good kind)
- "Scale set for everyone viewing this plan" / "Couldn't share the scale — it applies only on this device for now"
- "Set Scale first to use Room Sizer." (viewer taps Room Sizer on an uncalibrated page — re-walk; the promise is false in a view session)
- "Add users by email. Viewers can view only; editors can check out to edit." (Share modal lead copy, reconfirmed on screen 2026-08-09)

## Walk notes

**Environment:** real app served from the repo root on 127.0.0.1:4114 (zero-dep static server from scripts/build-screenshots.js), Playwright Chromium 1380×900 @2x, mobile pass at 375×812. `samples/sample-plan.pdf`. Every request to `*.supabase.co` was intercepted: `get-view-project` / `set-view-scale` / share RPCs fulfilled locally with the view-only.spec.js payload recipe; everything else aborted. Sender signed-in state was simulated by writing `state.supabaseSession` / `currentProjectId` in-page. **No production cloud call left the machine.**

**Re-walk 2026-08-09 (same recipe, same port):** every route/finding above re-verified end-to-end on the current build — sender fast path (toast + URL on clipboard), Share modal (View links collapsed ▶ on first open; stays expanded across reopens within the session), Create ("View link created and copied to clipboard" + row), Access log alert ("Access log:\n\ngc@bigbuildgc.com — date"), Revoke confirm → "No view links yet.", recipient gate → viewer in ~160 ms (stub), Measure "Distance: 25'-0\"", Hide marks → `view:hideMarks:<token>`=1, Export Both → `Sample_Plan.json` + "No PDF available to download.", domain rejection inline + retry-in-place OK, dead link toast "Failed to load: View link not found" fading to the bare editor, Escape AND Cancel both stranding in the editor, viewer-scale share-back success/failure with "· temp" + localStorage restore, offline cached reopen ~1.7 s without the gate, mobile burger = "Hide marks / Save status / DOWNLOAD Print Current Page (Current Canvas) / EXPORT Export Canvas / Export Both". New nuances from the re-walk: viewer Set Scale ruler button visible only while the page is uncalibrated; Room Sizer's no-scale click shows the (unfulfillable) "Set Scale first to use Room Sizer." toast. Aborted-only outbound attempts observed: `PATCH/GET rest/v1/projects…` from the simulated sender session (the known quirk) and the single `POST functions/v1/get-view-project` from the naive fake-token probe. All 8 screenshots regenerated on 2026-08-09.

**Not walked (cloud walls / out of local reach):**
- Real link mint/list/revoke and access log against production (create_view_link etc.) — RPCs stubbed. Real "Creating…" latency unknown.
- The real Edge Function's error body for a revoked vs expired vs malformed token (simulated 404 `{message:"View link not found"}`; client shows whatever `message` says in the same toast pattern).
- Whether production enforces the clickplumbing.com domain for outside GCs (client copy implies yes; enforcement is server-side — determines whether this journey is even possible for a true outsider).
- The teammates half of the modal (invite-to-project) — needs real users; also J13 territory.
- #headerShareBtn `.in-view-mode` (signed-in user opening someone's view link on a phone) — needs a real session.
- updatedAt revalidation freshness after a real owner re-save; multi-page/canvas-layers browsing on the recipient side (payload was 1 page/1 canvas).
- Signed-out sender wall (naive attempt): there is no wall *text* — the share controls simply don't exist; the cloud affordances on screen are the status-bar "Sign In" and the header gear, which signed-out opens the same bare Sign In modal ("Sign In / Email / Password / Cancel / Sign In") without mentioning sharing.

**Environment quirks:** the stubbed sender session makes the save engine PATCH the fake project id (aborted, harmless — status bar briefly shows "Canvas Uploading…"); the "[Turn In]" header button in sender shots comes from the simulated session, not this journey. One early probe reported the D hotkey inert; retest with clean focus showed D works (test artifact, not a finding).

**Screenshot index:**
- [img/share-with-an-outsider-01.png](img/share-with-an-outsider-01.png) — recipient email gate over the (empty) editor chrome
- [img/share-with-an-outsider-02.png](img/share-with-an-outsider-02.png) — DEMO: one-click header copy, "View link copied to clipboard"
- [img/share-with-an-outsider-03.png](img/share-with-an-outsider-03.png) — Share Project modal, View links expanded, link row (Copy URL / Access log / Revoke)
- [img/share-with-an-outsider-04.png](img/share-with-an-outsider-04.png) — DEMO: recipient viewing the live takeoff, "Distance: 25'-0\"" measure
- [img/share-with-an-outsider-05.png](img/share-with-an-outsider-05.png) — FRICTION: wrong-domain rejection at the gate
- [img/share-with-an-outsider-06.png](img/share-with-an-outsider-06.png) — FRICTION (blocker): dead link → toast over the empty editor
- [img/share-with-an-outsider-07.png](img/share-with-an-outsider-07.png) — mobile recipient (375×812), live takeoff + viewer toolbar
- [img/share-with-an-outsider-08.png](img/share-with-an-outsider-08.png) — owner's "Scale changed by a viewer" notice

## Verification (2026-08-02)

Adversarial re-drive, independent of the walker's scripts: real app served from the repo root on **127.0.0.1:4314** (same zero-dep static server + Playwright Chromium recipe as scripts/build-screenshots.js), all `*.supabase.co` traffic intercepted (stub or abort — no cloud). Seven probes, written from the findings table alone before reading the walk notes' detail:

1. **Dead link (finding 1)** — `?t=deadtoken`, get-view-project stubbed 404 `{message:"View link not found"}`. Reproduced exactly: gate → email → Continue → toast "Failed to load: View link not found" → after the fade, the full empty estimating editor (Upload PDF, complete tool row, gear, Sign In) with no visible error text anywhere in the DOM. Blocker stands.
2. **Escape at gate (finding 4)** — Escape → gate gone, `state.isViewer` false, 0 pages, editor exposed. Reproduced.
3. **Share modal (finding 2)** — simulated session + stubbed share RPCs; on open: teammates block first, `#shareViewLinksContent` carries class `collapsed`, "Create view link" has zero rendered height. Reproduced; the collapse is hardcoded in app/index.html.
4. **Viewer Export dropdown (finding 5)** — stubbed viewer session: visible options exactly `["canvas","both"]` (no PDF row — view-only.js:284 nulls pdfBuffer); clicking Export Both produced `Sample_Plan.json` AND the "No PDF available to download." toast. Reproduced.
5. **Room Sizer (finding 6)** — uncalibrated viewer page: button visible, click → "Set Scale first to use Room Sizer." toast; after setting a scale, click leaves `state.tool` unchanged with zero feedback. Both halves reproduced.
6. **Naive attempt** — signed-out with plan open: #headerShareBtn, #copyViewLinkBtn, #sidebarLogoShare, #settingsShareProject all invisible. Reproduced.
7. **Pages label (finding 7)** — viewer Pages list renders "document.pdf". Reproduced.

Findings 3, 8, 9 verified at source rather than re-driven (all decisive): the hardcoded domain strings (app/index.html:2249, :2370), the px fallback with no nudge (geometry.js:251 feeding app.js:4514), the raw `alert()` access log (share-links.js:142) and the burger's "Save status" gating that can't exclude anonymous viewers (burger-menu.js:72).

**Result: 9/9 findings CONFIRMED at walked severity — no downgrades, no kills.** The severities are, if anything, conservative (finding 1's reproduction is ugly enough to justify blocker twice over). All 7 change proposals pass the spirit test with real simplicity budgets; both teach verdicts are correctly restrained.

Things the walker missed (all strengthen, none contradict):
- `window.VIEW_LINK_ALLOWED_DOMAINS` (view-only.js:193) already exists as a config hook for the rejection message — finding 3's fix is wiring two static strings to it, not building config.
- app.js:2378-79 auto-hides the Export dropdown when it has no visible rows — so the "drop Export Canvas/Both for viewers" hide removes the whole dropdown from view sessions with a single gating change.
- The Room Sizer no-scale guard (app.js:3103) runs before any viewer check, which is *why* the toast fires in a session that can never honor it — the proposed viewer-hide fixes both symptoms at once.

## Stage-5 cloud-interior walk addendum (2026-08-31)

Scoped live walk on production with the dev-auth test account (`test@clickplumbing.com`)
— never a customer identity. Full J14 round trip verified end-to-end:

- **Mint → open → log → revoke, all green.** Create view link from the Share dialog;
  recipient email gate (Continue) → live viewer with plan-name page labels (B6 fix
  confirmed — no "document.pdf"); viewer chrome correctly trimmed (edit tools, save,
  Save Status bell hidden; "Viewing only" banner shown); the access log records the
  gate entry (email + timestamp, verified via `get_view_link_access_log`); Revoke →
  the branded "This link isn't active anymore" card (PR #66), never the empty editor,
  and revocation beats the device's earlier access.
- **Viewer scale share-back verified server-side**: a viewer-set page scale landed in
  the project row with the `viewerSet { email, at }` stamp via `set-view-scale`.
- **NEW papercut — access log is a native `alert()`** (features/share-links.js:142):
  the one surface on the sharing path still outside the T2-04 toast/modal system.
  Queue with the X8 alert sweep.
- **NEW check-later**: `#hideMarksBtn` computed `display:none` for the viewer at an
  ~800px-wide viewport — possibly intended consolidation; verify the visibility
  matrix across widths before calling it a bug.
- **Not walked**: nothing left in J14's viewer path; the sending-side telemetry
  question (107 links / 56 accesses) is NOT a logging bug — the log records opens
  correctly, so under-conversion is real recipient behavior.

## Check-later resolved: viewer `#hideMarksBtn` visibility matrix (2026-08-31)

**NOT a bug — intended consolidation.** Live view-link viewer session walked
across 375/700/768/769/800/900/1000/1400 px: the eye is visible at ≥769px and
hidden at ≤768px, where `#headerBurger` appears and its first item ("Hide
marks"/"Show marks", eye icon) mirrors the button — verified working at 768px
with the per-link persistence key (`view:hideMarks:<token>`=1) written. No
dead zone at any width. The JS `header-collapsed` overflow mode (the other
path that hides `.consolidated-mobile`) never fires for the viewer's trimmed
header, and its drawer carries the same item anyway. The original ~800px
`display:none` sighting was almost certainly an `innerWidth` that had dipped
to ≤768 CSS px (window chrome / scrollbar accounting) — the media boundary,
not a distinct bug.
