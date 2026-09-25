// The named devices a persona (and a spec) runs on, PERSONA-PLAN build item 6 (2026-09-25).
// One fixture for both: tutorial.spec.js's "returning estimator's device" tests and
// scripts/persona-harness.js seed the same palette and the same search words, so a stall the
// harness reproduces on 'returning' is the one the spec pins.
//
// A device is { viewport, hasTouch, isMobile, seed(page) }. The first three go to
// browser.newContext(); seed(page) runs after the app has booted (App.bootSettled) and before a
// tour starts, because a tour snapshots the palette it found (standingIds) and clears the
// sidebar searches as it starts. It writes the app's own state the way the Artboard and a
// reload would leave it, never a click.

// A returning estimator: the Artboard brought a standing palette whose names are the tours'
// own (a Water Closet, a Duplex Receptacle with a mount height, a Gas 1in line type), and the
// last bid left words typed in the sidebar searches (FD in COUNTERS, PEX in LINE TYPES). Found
// by hand 2026-09-25: the standing Water Closet ticked "Make a Water Closet counter" before the
// reader had done anything, and a search word hid the counter the tour had them make.
async function seedReturning(page) {
  await page.evaluate(() => {
    const s = window.state, A = window.App, icon = A.getOrderedIcons()[0].value;
    s.counters.push({ id: 'st-wc', name: 'Water Closet', icon, color: '#4a9eff' }, { id: 'st-dup', name: 'Duplex Receptacle', icon, color: '#e85447', mountHeightIn: 18 });
    s.lineTypes.push({ id: 'st-gas', name: 'Gas 1in', color: '#e8c547', curveStyle: 'straight' });
    [['counterSearch', 'counterSearchInput', 'FD'], ['lineTypeSearch', 'lineTypeSearchInput', 'PEX']].forEach(([f, id, v]) => { s[f] = v; localStorage.setItem(f, v); document.getElementById(id).value = v; });
    A.updateUI();
  });
}

// A first-timer: a clean context, nothing to seed (a fresh browser context has no storage).
async function seedNothing() {}

const DEVICES = {
  'first-timer': { viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false, seed: seedNothing },
  returning: { viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false, seed: seedReturning },
  laptop: { viewport: { width: 1280, height: 720 }, hasTouch: false, isMobile: false, seed: seedReturning },
  // An iPad in portrait: 768 is the app's own narrow breakpoint (inclusive), so the sidebar is a
  // drawer behind the hamburger and the header strip scrolls.
  tablet: { viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true, seed: seedReturning },
};

function device(name) {
  const d = DEVICES[name];
  if (!d) throw new Error('unknown device "' + name + '" (one of ' + Object.keys(DEVICES).join(', ') + ')');
  return d;
}

module.exports = { DEVICES, device, seedReturning };
