/*
 * features/hotkey-peek.js - hold Cmd (or Alt) ~1.5s to peek every hotkey.
 *
 * Discovery layer over the existing hotkeys: holding the Meta key (Cmd on
 * macOS; Alt is the Windows/Linux-friendly alias) for HOLD_MS without
 * pressing anything else sets `body.hotkey-peek`, which reveals a small
 * <kbd> badge on every visible control that has a hotkey. Releasing the
 * key — or any focus loss (blur / tab switch), since Cmd+Tab never
 * delivers the keyup — hides them. A second key pressed during the hold
 * (a Cmd+S-style combo) cancels the pending peek: the user is issuing a
 * shortcut, not asking a question.
 *
 * The badges are STAMPED FROM `App.HOTKEYS` (the hotkeys.js single source
 * the keydown handler executes and build:macros renders from), so a new
 * hotkey grows its badge automatically and the overlay can never drift
 * from reality. Non-bespoke entries map btnId -> badge; runner entries go
 * through RUNNER_BADGE_TARGETS. Each target also stamps its `<id>Sidebar`
 * twin when one exists. Stamping is lazy (first peek) so boot pays nothing.
 *
 * This file only ever ADDS a visual layer — it never handles or consumes
 * the hotkeys themselves (that stays in app.js's keydown handler).
 * Boundary rule: read shared deps from App.* at call time, never captured
 * at load. See ARCHITECTURE.md "Feature files / window.App registry".
 */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  const HOLD_MS = 1500;
  // Runner-based HOTKEYS entries carry no btnId; these are their buttons.
  const RUNNER_BADGE_TARGETS = { moveReset: 'moveBtn', toggleSnap: 'lineTypeSnapToHVHeaderBtn', rotatePage: 'rotatePage' };

  let holdTimer = null;
  let peeking = false;
  let stamped = false;

  function stampBadges() {
    if (stamped) return;
    stamped = true;
    (App.HOTKEYS || []).forEach((h) => {
      if (h.bespoke || !h.key) return;
      const id = h.btnId || RUNNER_BADGE_TARGETS[h.runner];
      if (!id) return;
      [id, id + 'Sidebar'].forEach((targetId) => {
        const el = document.getElementById(targetId);
        if (!el || el.querySelector('.hk-badge')) return;
        const kbd = document.createElement('kbd');
        kbd.className = 'hk-badge';
        kbd.textContent = h.key.toUpperCase();
        el.classList.add('hk-host');
        el.appendChild(kbd);
      });
    });
  }

  function startPeek() {
    stampBadges();
    peeking = true;
    document.body.classList.add('hotkey-peek');
  }

  function cancelHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }

  function endPeek() {
    cancelHold();
    if (!peeking) return;
    peeking = false;
    document.body.classList.remove('hotkey-peek');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Meta' || e.key === 'Alt') {
      if (!holdTimer && !peeking) holdTimer = setTimeout(() => { holdTimer = null; startPeek(); }, HOLD_MS);
      return;
    }
    // Any other key during the hold = a real shortcut combo, not a peek.
    cancelHold();
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Meta' || e.key === 'Alt') endPeek();
  });
  // Cmd+Tab (and any focus loss) never delivers the Meta keyup — clean up.
  window.addEventListener('blur', endPeek);
  document.addEventListener('visibilitychange', () => { if (document.hidden) endPeek(); });

  // Spec seam: chain.spec-style tests drive the timer without a 1.5s wait.
  App.__hotkeyPeekState = () => ({ pending: !!holdTimer, peeking });
})();
