# J12 — Autosave trust, the bell, coming back tomorrow

Personas: P F · Status: ● walked 2026-08-02 (signed-out scope; cloud legs walk-blocked) · re-verified 2026-08-09 (third independent pass; every load-bearing claim reproduced) · **adversarially verified 2026-08-09 (independent re-drive, port 4312 — 9/9 findings confirmed, 0 killed; see Verification below)**

> Seeded from the Phase-1 cross-index workflow (2026-08-02). Phase-2 walk done signed-out
> per the no-cloud rule; every step that needs a session is recorded as a wall in
> Walk notes. Persona: an estimator who needs to trust that work never vanishes.

## Entry points

- **header** — Save Status bell #saveStatusBtnHeader (title "Save status") (click → opens #saveStatusModal)
- **modal** — Bell #saveStatusBtn inside the Project Settings menu (next to the Save button, row 1678 of app/index.html) (click → opens #saveStatusModal)
- **burger** — "Save status" item in the mobile #headerBurger drawer (features/burger-menu.js; mobile CSS hides the header bell) (tap)
- **header** — #saveProjectBtn "Name / Upload / Save Project to Cloud" and #loadProjectBtn "Load Project from Cloud" — class replaced-by-status-bar, display gated on login; other controls proxy clicks through #saveProjectBtn (click)
- **sidebar** — #saveProjectBtnSidebar / #loadProjectBtnSidebar (same labels; forward to the header buttons / App.openLoadProjectModalOrPromptSave) (click)
- **modal** — Project Settings menu: #settingsSaveProject (label switches to "Save Changes" when the project already has a cloud PDF) and #settingsLoadProject "Load Project from Cloud" (click)
- **modal** — #lastSessionRestoreModal "Project from Last Session" — auto-shown at boot when a last-session candidate exists (App.openLastSessionRestorePrompt from app.js init) (automatic on app open — **walked: signed-in only; never fires signed-out**)
- **status bar** — #syncPausedBanner "Cloud sync paused - your work is saved locally. Reconnecting..." with #syncPausedBannerRetry "Retry now" — auto-shown above the status bar area (automatic; click Retry now)
- **status bar** — #canvasOnlyNeedsPdfBanner "This project has saved annotations but no PDF. Choose a PDF to view them." with "Choose PDF" button; companion modal #canvasOnlyNeedsPdfModal ("Choose PDF..." / "Skip for now") — auto after loading a canvas-only project (automatic; click Choose PDF)
- **modal** — #saveBeforeLoadModal "Unsaved Changes" (Cancel / Don't Save / Save now) — interposed by openLoadProjectModalOrPromptSave when loading with unsaved changes (automatic gate before Load modal)
- **modal** — Load Project rows: click a row to load; row actions "Canvas only" badge (downloads canvas .json), "Copy to new" (opens #copyProjectModal), trash icon delete (owner only); admin-only "Advanced" toggle #loadProjectAdvancedToggle reveals per-row "Who has access" (click row / click row-action buttons)
- **status bar** — #statusBarDot (canvas) and #statusBarSquare (PDF) sync indicators with labels — state display; no click handler found in code (glance (display-only — **confirmed by clicking: nothing opens**))
- **header** — export dropdown #exportDropdownBtn (cloud icon): Export Canvas / Export PDF / Export Both / Import Canvas — **the only Save/Load surface a signed-out desktop user ever sees** (walked; options are contextual, see route)

## Current route (walked 2026-08-02)

The documented 10-step route assumes a signed-in cloud session. Signed out — the state this
journey was scoped to — the route that actually exists is this (7 steps, 2 decisions):

1. Mark up the plan as usual. Work IS auto-saved on-device: an IndexedDB backup (marks +
   the PDF itself) lands ~1s after each change and every 5s after (verified by dumping
   IndexedDB: `{projectId:'local', pdfBlob:37KB, marks:[3]}`). Nothing on screen says so.
2. Glance for a save signal: there is no bell signed-out (it is gated on a cloud session).
   The status bar shows a green dot (tooltip "Canvas sync: Local only") and
   `sample-plan - —` — a permanent dash where a saved-time should be ([img](img/save-load-return-02.png)).
   The dot is not clickable; the Save Status panel is unreachable signed-out.
3. **Decision:** trust the (invisible) autosave, or make your own save. The only visible
   affordance is the header cloud icon → "Export Canvas", which downloads `sample-plan.json`
   (1.3 KB) ([img](img/save-load-return-04.png)). The gear icon — the other place you'd look — is a
   Sign In wall ([img](img/save-load-return-03.png)). The menu is contextual three ways
   (re-verified): marks present → Export Canvas / Export PDF / Export Both; empty canvas →
   Export PDF / Import Canvas; no plan loaded at all → just "Import PDF".
4. Close the tab at end of day. (The on-device backup is complete and healthy at this moment.)
5. Reopen the app next morning. **No restore prompt appears.** Your counter names silently
   reappear in the sidebar at 0; the plan is gone; the canvas says "Upload PDF to start"
   ([img](img/save-load-return-05.png)). ~5 seconds after boot, the 5-second backup interval
   overwrites yesterday's backup with this near-empty session — the marks and the PDF blob
   are destroyed while you look at the screen (timed: intact at t+4.4s, gone at t+8.4s).
6. Re-upload the same PDF. The marks do NOT come back (verified: totals stay `[0 | 0]`).
7. **Decision:** if you did step 3, Import Canvas (same cloud-icon menu — the option only
   exists while the canvas is empty) restores every count exactly (`[3 | 0]`). If you
   didn't, you recount the job.

The bitter part: the restore machinery is fine. Driving the same "Project from Last
Session" prompt the signed-in path uses ([img](img/save-load-return-07.png)) against the
signed-out local backup restores the PDF **and all 3 marks in about a second, fully
offline** ([img](img/save-load-return-08.png)) — provided Keep is clicked inside the 5-second
window before the interval clobbers the backup. The prompt is simply never offered
signed-out (`app.js` boot: `openLastSessionRestorePrompt` sits inside
`if (SUPABASE_ENABLED && supabase && state.supabaseSession?.user)`).

## Naive attempt

Booted the app cold as the persona. Upload PDF was obvious (header button + empty-state
prompt); counter + 3 marks took 6 actions. Then went looking for "is this saved?": the
status bar's `sample-plan - —` reads as "never saved"; the gear (most save-shaped icon)
opened a Sign In wall; the cloud icon offered Export Canvas/PDF/Both — so I concluded my
save is a downloaded file. Closed the browser; reopened: no prompt, my counter listed at 0,
plan gone. As a signed-out estimator I would call that "the app lost my work" and either
export-to-file religiously or stop trusting it. ~10 actions to the point of giving up.

A second independent naive run (fresh profile, same day) landed in the identical place:
no visible save signal anywhere after marking (`sample-plan - —`, dot tooltip "Canvas sync:
Local only"), settings menu empty of save affordances signed-out, reload → counter listed
at 0, plan gone, no prompt; re-upload of the same PDF restored nothing (`[0 | 0]`).

## Friction findings

| # | severity | what happens | why it hurts | verdict |
|---|----------|--------------|--------------|---------|
| 1 | blocker | Signed-out, closing and returning loses all marks: the restore prompt is signed-in-gated, so the complete on-device backup (marks + PDF blob, verified in IndexedDB) is never offered; re-uploading the same PDF restores nothing. | The journey's whole promise — "work never vanishes" — is false for exactly the user who has no cloud copy. Sidebar shows the counter names at 0, which reads as the app *remembering it forgot*. | **CONFIRMED** (adversarial pass) — independently re-driven from scratch (port 4312, fresh persistent profile, true browser restart, ALL non-localhost requests aborted — guard logged 0 attempts): return boot showed zero visible modals, backup still intact `{markers:3, pdfBlob:37,971B, projectName:'sample-plan'}`, sidebar "Water Closet 0", `state.pages` 0; re-upload of the same PDF → 1 page, 0 marks. Gate re-read in code: the local-backup offer sits inside `if (SUPABASE_ENABLED && supabase && state.supabaseSession?.user)` (app.js:6472, offer at :6488). |
| 2 | blocker | ~5s after reopening, the unconditional `setInterval(writeTakeoffStateBackup, 5000)` (app.js:5939) overwrites yesterday's backup with the new empty session (guard passes because the palette was silently restored). Timed: backup intact t+4.4s, destroyed t+8.4s. | Recovery data is not just unoffered — it is destroyed by merely opening the app. Also poisons the signed-in local-restore: clicking "Keep and Open" more than ~5s after boot restored the PDF with **zero marks** in testing (the Keep handler re-reads the now-clobbered backup because its `lastModifiedAt` is newer). | **CONFIRMED** (adversarial pass) — clobber re-timed on my drive: intact at boot, `{markers:0, pdfBlob:0, projectName:null}` by t+5.3s from navigation; the clobbering record's `lastModifiedAt` was newer than the held one, so the stale-skip passed (verified from the dumped timestamps). Re-upload refinement also reproduced: ~1.4s after re-upload the backup was rewritten `{markers:0, pdfBlob:37,971B}` — blob back, marks permanently gone. **Keep-poisoning reproduced as a hard result, not just code-plausible**: held the boot-time backup (3 markers), waited 9s, drove the real prompt from it → "Keep and Open" rebuilt the PDF with **0 marks** (`takeoffBackupGet` re-read preferred the clobbered record; restore-last-session.js:62-63). Storage mechanism verified: `idbTakeoffBackupPut` replaces the record wholesale, `entry.pdfBlob` only set `if (pdfBlob)` (idb.js:219-221); writer guard passes because boot silently restored the counters (save-engine.js:264). Clobber timing varies across passes (3.5-5.3s) — the window is never dependable. |
| 3 | stumble | Nothing on screen ever confirms a save signed-out: status line shows `sample-plan - —` forever, dot tooltip says "Canvas sync: Local only" (often without the `Local: <time>` line — it goes stale), and the Save Status panel reports "No save activity in the last 5 minutes" while backups are in fact landing every second. | The estimator has no way to build the trust this journey is about; the truthful good news (a full local backup exists) is hidden everywhere it could be shown. | **CONFIRMED** (adversarial pass) — re-driven: with the backup verified landed (`{markers:3, pdfBlob:37,971B}`), status bar read `sample-plan - — (0, 0) [3 | 0] keys | macros | Sign In`, dot title "Canvas sync: Local only" (no Local: stamp in my run either), panel said "Not signed in to cloud" + "No save activity in the last 5 minutes." One wording nit: backups land 1s after each edit and on the 5s tick — "every second" only holds while actively editing. Stumble stands. |
| 4 | stumble | The Save Status panel is unreachable signed-out: no bell, dot/label not clickable. Opened programmatically it shows grey "CANVAS | Not signed in to cloud" and an empty PDF row ([img](img/save-load-return-06.png)). | The panel built to answer "am I safe?" answers only "you're not a cloud user." | **CONFIRMED** (adversarial pass), mechanism refined — re-driven: `#saveStatusBtnHeader` computed display none; clicking `#statusBarDot` opens nothing. Refinement: the bell is actually gated on `body.supabase-enabled` AND `body.has-project` (`state.currentProjectId`; styles.css:232-233, class set app.js:2145-2146) — i.e. a **cloud project**, not a session per se. Same outcome for the signed-out persona (never has `currentProjectId`), and it additionally means a signed-in user working on a not-yet-saved local plan has no bell either. |
| 5 | stumble | "Import Canvas" (the only signed-out load) vanishes from the menu the moment any mark exists — no disabled row, no hint. With one stray mark you cannot load your exported file. | The load affordance disappears exactly when a user is mid-recovery; looks like the feature was removed. | **CONFIRMED** (adversarial pass) — re-driven both states on my own drive: 3 marks → `import-canvas` display none, canvas/pdf/both all block; empty canvas after re-upload → `import-canvas` block, canvas/both none. Code: `showImportCanvas = !shieldImportMode && !state.isViewer && !hasCanvasMarkupForExport` (app.js:2371-2375). |
| 6 | papercut | Feeding Import Canvas a bad file fires a native browser `alert('Invalid import file')`. | Jarring OS dialog, software language, no pointer to what a valid file is (an Export Canvas .json). | **CONFIRMED** (adversarial pass, code-level) — `alert('Invalid import file')` sits in the catch of the import reader (features/import-clear.js:74, re-read this pass); the walker's dialog-listener evidence stands. Papercut is the right severity. |
| 7 | papercut | Esc closes ~30 modals via the Esc ladder but not the Save Status panel (must click × / Close). | Inconsistent muscle memory on the exact panel anxious users open. | **CONFIRMED** (adversarial pass) — re-driven: Esc left `#saveStatusModal` visible (Phase A) and `#lastSessionRestoreModal` visible (Phase C). Grep of the ladder (app.js:5775+) lists neither id, and neither features/save-status.js nor features/restore-last-session.js binds any Escape/keydown handler. |
| 8 | papercut | Sidebar "Export PDFs" (batch export dialog) vs dropdown "Export PDF" (direct download) — near-identical labels, different jobs, both on screen at once. | Users can't predict which one makes the file pricing asked for. | **CONFIRMED** (adversarial pass, DOM-level) — both labels re-verified in the served shell: `#specificPages` "Export PDFs" (app/index.html:358) and dropdown option "Export PDF" (:167), coexisting with a plan loaded. Papercut, no higher — the walker's teach verdict on the rename is right. |
| 9 | papercut | After "Keep and Open" the Pages sidebar renames the restored sheet **document.pdf** (the backup blob loses the original filename) while the status line still reads `sample-plan` (img 08). | Two names for the same sheet minutes after a data-loss scare; "document.pdf" whispers "this isn't really your file." | **CONFIRMED** (adversarial pass) — re-driven: after Keep and Open, `state.pages[0].label` === "document.pdf" while the backup record it restored from carries `projectName: 'sample-plan'`. Hardcoded, not lost data: `const label = numPages > 1 ? ('document.pdf — p' + (i + 1)) : 'document.pdf'` (features/restore-last-session.js:102). |

## Proposals

- **rework** — Offer the "Project from Last Session" prompt signed-out too (drop the session gate around `openLastSessionRestorePrompt`; the local branch already carries the PDF blob and needs zero cloud). (1) Fewer steps: return-tomorrow becomes 1 click instead of re-upload + recount. (2) Trade language: "You have a local session from your last visit: sample-plan" already reads fine. (3) Removes: the export-to-file ritual, the re-upload dead end, and the need to explain any of this in a guide. (4) Findable: it's automatic. **spiritPass: true** [verified — I drove the real handler against a real backup after a true browser restart: the prompt copy is already trade-plain, Keep restored PDF + all 3 marks in well under 1s fully offline (zero network); all four spirit answers hold and the simplicity budget is concrete, not rhetorical. Adversarial re-drive agrees: real prompt ("You have a local session from your last visit: sample-plan."), Keep → 1 page + 3/3 marks in 0.26s, zero network]
- **rework** — Never let the 5s interval overwrite a backup that hasn't been restored or discarded this session (e.g. skip interval writes while `state.pages` is empty, or key the boot backup aside until Keep/Discard). (1) Fewer steps: none added — it deletes a silent data loss. (2) No new words on screen. (3) Removes: the 5-second race that can void even the signed-in "Keep and Open". (4) Nothing to find. **spiritPass: true** [verified — race reproduced independently at t+3.5s (tighter than 5s: the interval starts at script eval); the "skip while state.pages is empty" guard matches the existing writer guard shape in save-engine.js:264 and removes a real loss, adds nothing visible. Adversarial caveat: the pages-empty skip would also stop backing up a counter palette built *before* any PDF is uploaded — prefer the key-aside-until-Keep/Discard variant, which protects that case too]
- **polish** — Status bar signed-out: replace the permanent `—` with the local stamp it already tracks — "Saved on this device · 4:42 PM". (1) Zero added steps. (2) "Saved on this device" is trade-plain. (3) Removes the "did it save?" doubt and support questions. (4) It's in the line estimators already read. **spiritPass: true** [verified — the engine already exposes the stamp (`getLastLocalBackupAt`, save-engine.js); the permanent dash reproduced with fresh backups landing, so this replaces a false signal rather than adding UI; passes all four]
- **polish** — Make the status dot/label clickable to open Save Status everywhere, and make the signed-out panel tell the truth: "Saved on this device 4:42 PM. Sign in to sync across devices." instead of "Not signed in to cloud" + "No save activity". (1) One click to the answer. (2) Plain words. (3) Removes the hidden-panel state and the false "no activity" message. (4) The dot is the thing you already stare at. **spiritPass: true (truthful-copy half only)** [verified for the truthful panel copy — unreachability and the false "No save activity" text both reproduced on the adversarial re-drive, and rewording an existing panel invents no UI; **rejected: clickable-dot half** — fails spirit test (4): an invisible affordance on an element that has never signaled clickability is not findable by a plumber who never read a guide, and it's new interaction surface rather than a removal. Keep the copy fix; the status-line stamp (previous proposal) is the primary answer]
- **keep** — Export Canvas / Import Canvas round-trip: 2 KB file named after the plan, restores counts exactly, fully offline. Genuinely good; leave it alone. **spiritPass: true** [verified — export/import gating and file behavior re-driven; keep]
- **keep** — The restore machinery itself ("Keep and Open"): rebuilt PDF + marks in ~1s from IndexedDB with no network in testing (re-verified: 0.9s, all 3 marks). Keep — it just needs to be reachable (proposal 1) and protected (proposal 2). **spiritPass: true** [verified — third independent run: real handler, true restart, offline, 3/3 marks back in under 1s]
- **polish** — Carry the original filename through the backup so a restored sheet stays "sample-plan", not "document.pdf" (finding 9). (1) No steps added. (2) The plan's own name is the trade language. (3) Removes a "is this really my file?" doubt right after a scare. (4) Nothing to find — it's automatic. **spiritPass: true** [verified — but the framing in finding 9 is slightly off: the filename isn't "lost by the blob", it's hardcoded (`'document.pdf'`, restore-last-session.js:103) while `projectName` ("sample-plan") is sitting right there in the same backup record; the fix is a one-line label choice, not a data-model change]
- **polish** — Show Import Canvas greyed with "(canvas has marks — clear or undo first)" instead of removing it, and swap the native alert for the in-app toast: "That file isn't a saved canvas (.json). Export Canvas makes one." (1) Same steps. (2) Trade words. (3) Removes a dead-end and an OS dialog. (4) Stays where the user already found it. **spiritPass: true** [verified — vanishing row and native alert both reproduced; the disabled-row-with-reason keeps the affordance where it was found, and the toast text names the fix in trade words]
- **teach** — Esc-close for Save Status: add `saveStatusModal` to the Esc ladder. Too small to spirit-test as UX; it's a consistency fix, so filing under teach/engineering note rather than a flow change. **spiritPass: false** (fails "fewer steps on the happy path" — it's parity, not reduction) [verified — correct call; Esc-stays-open reproduced on both modals, and teach is the right verdict for a consistency fix]
- **teach** — "Export PDFs" vs "Export PDF": document the split (batch dialog vs quick download) in the produce-deliverables guide rather than renaming mid-flight for 7 daily users; revisit naming only with other label changes. **spiritPass: false** (a rename passes language but removes nothing; teach first) [verified — both labels confirmed on screen at once (app/index.html:167 and :358); agreed that renaming under 7 daily users' muscle memory costs more than it buys]

## Demo moment

Close the browser mid-count with three fixtures marked. Reopen. "Project from Last Session —
**sample-plan** — Keep and Open." One click and the plan, the counter, and all three marks are
back in about a second — no account, no internet, nothing typed. I watched it work
(screenshots 07→08). Today that ten-second wow is locked behind sign-in and a 5-second
self-destruct timer; unlocking it IS the journey.

## Evidence

- **Telemetry visibility:** Three of the seven events fire on this route: session_start (once per browser session, on auth init - sessionStorage-deduped, app.js maybeLogSessionStartOnce); project_open (whenever hydrateProjectFromCloudRow runs, i.e. Load Project row click AND restore-prompt Keep - features/copy-project.js line 75; skipped for viewers); project_save (ONLY from the autosave success path in save-engine.js line 2651, throttled to once per project per 5 minutes via ACTIVITY_PROJECT_SAVE_MS - the manual performSaveProjectToCloud path does not call it directly). Blind: bell opens, Save Status modal usage, Copy/Export logs, Verbose toggle, restore Discard, sync-paused banner appearances and Retry clicks, save-before-load choices, canvas-only Choose/Skip, Load-modal filter/search usage, and row-action deletes/downloads. line_added, counter_marker_added, export_canvas, export_pdf are out of scope for this route. **Walk addendum: the entire signed-out lifecycle (local backup writes, silent palette restore, backup clobber, Import/Export Canvas) is telemetry-blind.**
- **Guide coverage:** [how-your-work-is-saved.md](/guides/how-your-work-is-saved/) — The journey's spine: autosave 'every few seconds', on-device backups, bell states gray/yellow/dim, Save Status panel with Verbose mode/Copy logs/Export logs (annotated screenshot), sync-paused banner + Retry, edit-session-expired recovery options, and the restore prompt Keep/Discard; [working-offline-and-installing.md](/guides/working-offline-and-installing/) — Auto-save locally every few seconds with backups when offline; the Save status indicator in the top bar as the 'never guessing' signal; [sharing-and-view-links.md](/guides/sharing-and-view-links/) — One-paragraph cross-reference: auto-saves every few seconds with local backups, offline keeps working, links to How your work is saved for indicator meanings and session expiry; [admin-handbook.md](/guides/admin-handbook/) — Admins see all projects in Load Project; the admin-only Advanced toggle showing who has access per row; [canvas-layers.md](/guides/canvas-layers/) — One line: undo/redo and auto-save cover layer operations like everything else
- **Specs:** save-status.spec.js, save-project.spec.js, upload-then-save.spec.js, indexeddb-backup.spec.js, save-engine-smoke.spec.js, load-project.spec.js, load-project-delete.spec.js, load-project-empty-pdf.spec.js, restore-last-session.spec.js, copy-project.spec.js, mobile-burger-menu.spec.js
- **Modals:** `saveStatusModal`, `saveProjectModal`, `loadProjectModal`, `lastSessionRestoreModal`, `saveBeforeLoadModal`, `canvasOnlyNeedsPdfModal`, `copyProjectModal`, `checkoutExpiredRecoveryModal`
- **Hotkeys:** (none dedicated) - hotkeys.js has no save/load/bell binding; 's' is Set Scale, Esc - close modal / cancel (generic bespoke handler, applies to all journey modals) — **walk correction: the Esc ladder (app.js:5762) does NOT include saveStatusModal or lastSessionRestoreModal; Esc leaves both open (verified)**
- **Features touched:** Auto-save every 5 seconds + local backups, Save Status bell, Full offline mode, Offline-grade caching of rendered pages, Check-out / turn-in (one editor at a time), Works without the cloud

## Guide gaps (doc-derived)

- Save Project modal is undocumented: project name field, Contents list (Canvas 'included'), the Include PDF toggle with live MB size, the 'Canvas only. Upload a PDF first to include it in saves.' state, and the save-progress checklist
- Load Project modal is undocumented for non-admins: search box, Filters (All/Mine/Shared with me; role Owner/Editor/Viewer/Admin), row badges ('You're editing', 'Locked by <email>', 'Available', 'Shared', counts 'N cnt · N ln'), and row actions (Canvas only download, Copy to new, Delete from cloud)
- The canvas-only-needs-PDF flow (banner 'This project has saved annotations but no PDF...' and modal with Choose PDF... / Skip for now) appears in no guide; the Load modal intro's 'Legacy projects: upload your PDF first, then load.' is the only in-app hint
- The save-before-load 'Unsaved Changes' gate (Cancel / Don't Save / Save now) is undocumented
- Guide button wording drift: guide says 'Keep' restores; the UI button is 'Keep and Open' and the modal title is 'Project from Last Session'
- Cadence drift: FEATURES.md says 'every 5 seconds'; the guide says 'every few seconds' (engine also has a 1s dirty->backup debounce) - no doc states the actual numbers — **walk confirmation: observed 1s post-edit debounce + 5s interval to IndexedDB**
- Status-bar dot (Canvas) and square (PDF) indicators are mentioned only in passing ('the indicators in the status bar'); their two-track Canvas/PDF meaning is never explained
- The settings-menu label variant 'Save Changes' (vs 'Name / Upload / Save Project to Cloud') is undocumented
- **(walk) The guides describe autosave/backup as if universal, but every visible trust surface (bell, restore prompt, saved-time) requires sign-in; no guide states what a signed-out user gets (answer today: silent local backups that are never offered back).**

## Terminology on screen (recorded, not judged)

- "Name / Upload / Save Project to Cloud" - triple-verb button label; becomes "Save Changes" once the project has a cloud PDF *(drift 2026-08-17, B18: triple-verb label retired — now "Save Project to Cloud" everywhere, still "Save Changes" once cloud-saved)*
- "Keep and Open" / "Discard" on the "Project from Last Session" modal (guide calls it just 'Keep')
- "Canvas" vs "PDF" as the two sync tracks in the Save Status summary blocks and status bar (dot = Canvas, square = PDF)
- "Canvas only" - used both as a Load-modal row badge (which is secretly a download button, title 'Download canvas (.json)') and in "Canvas only. Upload a PDF first to include it in saves."
- "Cloud sync paused - your work is saved locally. Reconnecting..." + "Retry now"
- "Locked by <email>" / "You're editing" / "Available" checkout badges in Load Project rows
- "Copy to new" row action (tooltip: 'Open a local copy. Save to cloud from Project Settings when ready.')
- "Verbose mode", "Copy logs", "Export logs", "Activity (last 5 minutes)" in the Save Status modal
- "Legacy projects: upload your PDF first, then load." - Load modal intro line
- "Edit session expired" callout in the Save Status modal: 'Your edits are safe locally but won't sync until you re-check out.' with 'Re-check out and save' / 'Export local backup'
- "Don't Save" vs "Discard" - the unsaved-changes gate uses 'Don't Save' while the restore prompt uses 'Discard'
- **(walked, signed-out)** "Canvas sync: Local only" (green-dot tooltip); "CANVAS | Not signed in to cloud" (Save Status summary); "No save activity in the last 5 minutes." (while local backups run); "Invalid import file" (native alert); "Upload PDF to start" (empty-state title on the export/cloud icon); "Export Canvas" / "Import Canvas" — 'Canvas' meaning "your marks" throughout

## Open questions for the Phase-2 walk

- Do the header #saveProjectBtn/#loadProjectBtn (class replaced-by-status-bar) ever render at any breakpoint, or are they permanently hidden click-proxies - and where do Save/Load actually live on desktop vs mobile chrome? → **Answered: permanently hidden on desktop (`styles.css:474 .header .replaced-by-status-bar { display:none !important }` plus supabase-only gating); the sidebar clones sit in `.sidebar-header-buttons`, a container that is display:none on desktop (mobile drawer only). Signed-out desktop Save/Load = the header export dropdown, nothing else.**
- Are the status-bar dot/square indicators clickable anywhere (no handler found in code), and does 'dim' visibly differ from 'gray' on the bell in both themes and on mobile? → **Half-answered: dot and mode-line clicks open nothing (verified empirically). Bell dim-vs-gray: walk-blocked (bell requires a session).**
- Restore-prompt timing: does it appear before or after auth resolves; what does Keep show during a long cloud fetch/big-PDF load; what happens when the last-session project is inaccessible or the user is offline with no IDB backup? → **Signed-out: it never appears at all (gated inside the signed-in boot branch, app.js:~6457-6494); the local backup is instead part-applied silently (palette only) and then overwritten by the 5s interval. Cloud timing/inaccessible-project variants: walk-blocked.**
- Load Project empty states: verify 'No projects yet...' vs 'No projects match filters.' → **Walk-blocked (modal requires a session; opening it fires a Supabase list call).**
- Does the sync-paused banner and the canvas-only banner ever stack? → **Walk-blocked (both cloud states).**
- What steps does the Save Project progress checklist actually show, and what errors surface in #saveProjectError? → **Walk-blocked (cloud save).**
- Does the settings 'Save Changes' variant open the modal prefilled or save silently? → **Walk-blocked (needs a cloud project).**
- Actual autosave cadence a user can observe: → **Answered for signed-out: IndexedDB backup ~1s after an edit + a 5s interval, and the user can observe NONE of it — status line stays `sample-plan - —`, Activity log stays "No save activity in the last 5 minutes". Signed-in Activity cadence: walk-blocked.**
- Does Discard on the restore prompt affect anything cloud-side or only clear local state? → **Answered (local candidate): local-only and instant — deletes the IndexedDB takeoff backup + cached PDF and clears `clickcount-last-project`; no confirm step, no cloud call (verified: takeoff_backup store empty after Discard). No data-loss warning beyond the red button color.**
- Mobile variant → **Not walked; journey Mobile field = no.**
- What does the bell look like mid-save? → **Walk-blocked (bell requires a session).**
- **NEW (walk-blocked, for the cloud walk): reproduce the Keep-after-5s race signed-in — boot with a local (not-yet-cloud) session, wait >5s on the restore prompt, click "Keep and Open", and check whether marks survive. Signed-out simulation restored the PDF with zero marks because the 5s interval had already clobbered the backup the Keep handler re-reads (`useIdbBackup` prefers it by timestamp).**
- **NEW (walk-blocked): does the signed-in variant of the takeoff-backup user-mismatch check (`takeoffBackupGet` deletes entries whose userId differs) eat a signed-out backup when the user later signs in on the restore prompt?**

## Guide actions

*(Phase 5)*

## Walk notes

**Environment:** real app served from the repo root (throwaway static server, port 4112),
Playwright Chromium with a persistent profile so IndexedDB/localStorage survive true
browser restarts; `samples/sample-plan.pdf`; production `config.js` untouched; zero cloud
calls made (no sign-in, no Supabase traffic). Restore prompt + "Keep and Open" were
exercised by invoking `App.openLastSessionRestorePrompt` with the same `{proj, cachedBlob}`
shape the signed-in boot builds from the identical local backup — the handler itself ran
the real production code path, fully offline.

**Not walked (cloud walls, exact on-screen text):**
- Sign-in itself. Wall: Project Settings gear (signed-out) → modal "Sign In / Email
  [you@example.com] / Password [Password] / Cancel / Sign In" (img 03). This wall fronts
  every other item below.
- Save Status bell states (gray/yellow/dim, offline/attention variants), bell mid-save.
- "Name / Upload / Save Project to Cloud" modal, progress checklist, Include PDF toggle.
- "Load Project from Cloud" modal (rows, filters, badges, empty states, row actions).
- "Unsaved Changes" save-before-load gate; canvas-only-needs-PDF banner/modal;
  "Cloud sync paused..." banner + Retry; checkout-expired recovery; cloud variant of the
  restore prompt ("You have a project from your last session: <name>").
- Mobile pass (journey Mobile: no).

**Re-walk 2026-08-02 (second pass, same day):** every load-bearing claim reproduced from a
clean profile on port 4112, zero network calls off-localhost (request guard logged none):
backup after 3 real clicks = `{markers:3, pdfBlob:37,971B, projectName:'sample-plan'}`;
after reload the backup was intact at t+3.0s and clobbered (`markers:0, pdfBlob:0`) by
t+4.5s from domcontentloaded — the 5s-interval race is real and even tighter than first
timed; re-upload after that leaves totals `[0 | 0]`; simulated local restore prompt shows
"You have a local session from your last visit: sample-plan." and Keep and Open rebuilt
PDF + 3 marks in 0.9s offline; Esc closes neither #saveStatusModal nor
#lastSessionRestoreModal (pressed, both stayed open); Discard leaves the takeoff_backup
store empty with no confirm; garbage .json into Import Canvas fires the native
`alert("Invalid import file")`; good .json restores `[3 | 0]` exactly. Code anchors
re-confirmed: `setInterval(...5000)` app.js:5939, session-gated restore offer
app.js:6456-6491, alert features/import-clear.js:74, Esc ladder app.js:5762+ contains
neither modal.

**Re-walk 2026-08-09 (third independent pass, fresh profiles, port 4112, zero cloud
request attempts — a route guard logged 0 supabase.co hits):** all nine findings reproduced
end to end, plus two refinements.
- Fresh naive run (before re-reading this dossier) landed exactly where the recorded naive
  attempt did: no save signal after 3 marks (`sample-plan - —`, dot title "Canvas sync:
  Local only\nLocal: 1:47 PM (Just now)" — note the Local stamp WAS present this time
  while the session stayed open; it is the status **line**, not the tooltip, that never
  shows it), gear → Sign In wall, return → no prompt, "Water Closet" at 0, plan gone.
- **Refinement to finding 2:** the clobber is not only the 5s interval. Re-uploading a PDF
  fires `markProjectDirty()` (features/pdf-intake.js:342) → the 1s debounce overwrites the
  backup too. Timed this pass: backup `{markers:3, pdfBlob:37,971B}` intact at t+1.4s from
  navigation, `{markers:0, pdfBlob:0}` at t+5.4s (interval); after a re-upload the
  overwrite lands ~1s later regardless. Line drift: the interval is now app.js:5952
  (was :5939); the session-gated restore offer now sits at app.js:6480-6504.
- Keep-poisoning reproduced as a hard result, not just timing: boot-time read of the
  backup held `{markers:3}`, waited 9s, drove the real prompt from the boot-time
  `{proj, cachedBlob}` → "Keep and Open" rebuilt the PDF (from the held blob) with
  **0 marks** — the handler's `takeoffBackupGet` re-read preferred the clobbered record.
- Happy restore re-timed: Keep and Open → 1 page + all 3 marks in **0.16s**, offline.
  Pages sidebar "1 document.pdf" vs status line "sample-plan - —" (finding 9) reproduced.
- Round trip re-verified: Export Canvas → `sample-plan.json` (2,106 B); garbage file →
  native `alert("Invalid import file")` (dialog listener caught it); good file after
  re-upload → `[3 | 0]`, 3 markers. Esc left both #saveStatusModal and
  #lastSessionRestoreModal open. Discard → takeoff backup null, no confirm. Save Status
  signed-out verbatim: "CANVAS | Not signed in to cloud | PDF | Activity (last 5 minutes) |
  No save activity in the last 5 minutes."
- Export-menu gating re-checked at the DOM: marks present → Export Canvas / Export PDF /
  Export Both visible, Import Canvas `[hidden]`; no plan → all four rows hidden.

**Environment quirks:** the `alert('Invalid import file')` dialog is auto-dismissed by
headless Playwright, so it logs as "no feedback" in automation; confirmed in code
(features/import-clear.js:74) that a native alert does fire for users. Naive-run automation
initially clicked the counter modal's "Create" *tab* instead of the "Create Counter"
button — operator error, not app friction; corrected before recording findings.

**Screenshot index:**
- [img/save-load-return-01.png](img/save-load-return-01.png) — first boot, empty app: where does an estimator look for "save"?
- [img/save-load-return-02.png](img/save-load-return-02.png) — 3 marks placed; status bar reads `sample-plan - —` (no saved-time, signed out)
- [img/save-load-return-03.png](img/save-load-return-03.png) — the wall: settings gear → Sign In modal (friction)
- [img/save-load-return-04.png](img/save-load-return-04.png) — header cloud icon menu: Export Canvas / Export PDF / Export Both (the signed-out "save")
- [img/save-load-return-05.png](img/save-load-return-05.png) — return next morning: no prompt, counter back at 0, plan gone (friction/blocker)
- [img/save-load-return-06.png](img/save-load-return-06.png) — Save Status opened programmatically signed-out: "Not signed in to cloud" / "No save activity" (friction)
- [img/save-load-return-07.png](img/save-load-return-07.png) — "Project from Last Session" prompt (simulated signed-out from the real local backup) (demo)
- [img/save-load-return-08.png](img/save-load-return-08.png) — after "Keep and Open": PDF + all 3 marks restored offline in ~1s (demo)

## Verification (2026-08-02)

*Adversarial pass, run 2026-08-09. Goal was to refute; nothing died.* **Result: 9/9
findings CONFIRMED, 0 downgraded, 0 killed. Proposals: 9 stand as marked; the
clickable-dot half of the fourth proposal is rejected (invisible affordance — fails
findability), its truthful-panel-copy half stands.**

**Method.** Independent throwaway script (scratchpad, not committed), own port 4312,
static server over the repo root, Playwright Chromium `launchPersistentContext` with
two fresh profiles. Hard no-cloud guard: every request not aimed at
`http://127.0.0.1:4312` was aborted and logged — **0 requests were ever attempted**
(the app makes no Supabase calls signed-out, so the guard never even fired). Marks
seeded via the build-screenshots.js recipe (state + `markProjectDirty()`), everything
else driven through the real handlers/DOM. Four phases:

- **A (day 1):** upload `samples/sample-plan.pdf`, counter + 3 marks → backup landed
  `{markers:3, pdfBlob:37,971B, projectName:'sample-plan'}`; status line
  `sample-plan - — (0, 0) [3 | 0]`; bell display none; dot click inert; Import Canvas
  hidden with marks present; Save Status panel "Not signed in to cloud" + "No save
  activity in the last 5 minutes"; Esc left the panel open.
- **B (day 2, true restart):** no restore prompt (zero visible overlays), backup still
  intact at boot, sidebar "Water Closet 0"; backup clobbered to
  `{markers:0, pdfBlob:0}` at **t+5.3s** from navigation (walker timed 3.5-4.5s on
  other passes — the window varies, which is itself the point); re-upload of the same
  PDF → 0 marks, and ~1.4s later the backup was rewritten with the fresh blob and 0
  marks. Findings 1 and 2 reproduce end to end.
- **C (happy restore):** rebuilt the backup, restarted, drove the real
  `openLastSessionRestorePrompt` from the real record inside the window → Esc left the
  prompt open (finding 7); Keep and Open → 1 page + 3/3 marks in **0.26s**, page label
  "document.pdf" (finding 9).
- **D (poisoned Keep):** held the boot-time backup (3 markers), waited 9s, drove the
  prompt from the held copy → Keep restored the PDF with **0 marks**. The
  finding-2 refinement is a hard result, not an inference.

**Code anchors re-read this pass** (current line numbers): session gate app.js:6472
(offer :6488); `setInterval(...5000)` app.js:5952; writer guard save-engine.js:264;
wholesale record replace + `if (pdfBlob)` idb.js:219-221; backup-preferred-by-timestamp
restore-last-session.js:62-63; hardcoded "document.pdf" restore-last-session.js:102;
`alert('Invalid import file')` features/import-clear.js:74; Import Canvas gating
app.js:2371-2375; Esc ladder app.js:5775+ (neither modal, no feature-level Escape
binding); labels app/index.html:167/:358.

**What the walker missed (small, none change a verdict):**
- Finding 4's mechanism is `body.has-project` (`state.currentProjectId`,
  styles.css:232-233), not the session directly — so a *signed-in* user on a
  not-yet-saved local plan has no bell either. Slightly widens the finding.
- The dossier's "backups land every second" (finding 3) overstates: 1s after an edit
  plus the 5s tick; only "every second" during continuous editing.
- Proposal 2's example guard ("skip while `state.pages` is empty") would also skip
  backing up a counter palette built before any PDF upload; the key-aside variant in
  the same proposal avoids that and should be the one implemented.
- Automation trap for future passes: `textContent` dumps of #saveStatusModal include
  the display:none "Edit session expired" callout — it is NOT visible signed-out; do
  not report it as one.
