// The pure half of the persona harness's cheaper live pass (PERSONA-PROBER, 2026-09-25): no
// browser, no Playwright, so persona-harness.test.js pins it under `node --test`.
//
// - obsDiff: the "obsMode":"diff" answer, only the snapshot fields that changed since the last one
//   the caller was sent (the card text only when it changed).
// - isNoWork / actionLine: what an action was, in a line, and whether it could have done a step
//   (Next, Back, Skip, Show me where, wait, screenshot, scroll, giving up, or a click that never
//   landed cannot).
// - StepTracker: the no-work detector. It follows the steps an episode passes through and flags a
//   doing step that turned Done, or moved on, while the reader's actions since entering it were
//   none or only no-work ones: the false passes a cooperative reader never notices (K4 a returning
//   device's standing Water Closet ticking "Make a Water Closet counter", K5 the line type step Done
//   on arrival).
// - batchStop: when a list of actions stops early.

// The card's own buttons that move the tour or light a control but never do the step.
const CARD_NAV = ['next', 'finish', 'back', 'skip this step', 'skip', 'show me where', 'leave the tour'];
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();

// Could this action have done a step? `r` is the driver's result: { ok, clicked: { label, scope } }.
function isNoWork(action, r) {
  const a = action || {};
  if (a.wait != null || a.screenshot || a.scroll || a.giveUp != null) return true;
  if (r && r.ok === false) return true;   // not found, covered, ambiguous: nothing was pressed
  if (a.click != null) {
    const c = r && r.clicked;
    const label = norm(c ? c.label : a.click);
    const onCard = c ? c.scope === 'tour card' : true;
    return onCard && CARD_NAV.includes(label);
  }
  return false;
}
// The card button an action pressed, when it is one of the nav buttons ('next', 'back', 'skip').
function navOf(action, r) {
  const a = action || {};
  if (a.click == null || (r && r.ok === false)) return null;
  const c = r && r.clicked;
  if (c && c.scope !== 'tour card') return null;
  const l = norm(c ? c.label : a.click);
  if (l === 'next' || l === 'finish') return 'next';   // Finish is the last step's Next
  if (l === 'back') return 'back';
  if (l === 'skip this step' || l === 'skip') return 'skip';
  return null;
}

// One action as a short phrase: {click:"+ Add", within:"COUNTERS"} -> 'click "+ Add" within "COUNTERS"'.
function describeAction(action) {
  const a = action || {};
  const q = (s) => JSON.stringify(String(s));
  if (a.click != null) return 'click ' + q(a.click) + (a.within ? ' within ' + q(a.within) : '') + (a.nth ? ' nth ' + a.nth : '') + (a.preferLit ? ' preferLit' : '');
  if (a.clickZone != null) return 'clickZone ' + a.clickZone;
  if (a.dragZone != null) return 'dragZone ' + a.dragZone;
  if (a.clickAt) return 'clickAt ' + a.clickAt.join(',');
  if (a.drag) return 'drag ' + a.drag.map((p) => p.join(',')).join(' to ');
  if (a.fill) return 'fill ' + q(a.fill[0]) + ' = ' + q(a.fill[1]);
  if (a.select) return 'select ' + q(a.select[0]) + ' = ' + q(a.select[1]);
  if (a.type != null) return 'type ' + q(a.type);
  if (a.key != null) return 'key ' + a.key;
  if (a.scroll) return 'scroll ' + a.scroll.join(',');
  if (a.screenshot) return 'screenshot';
  if (a.wait != null) return 'wait ' + a.wait;
  if (a.giveUp != null) return 'giveUp';
  return JSON.stringify(a);
}
// The per-action line of a batch result: '3. fill "Name" = "Water Closet": ok · typed ... · step counter -> place'.
function actionLine(n, action, r) {
  const parts = [(r && r.ok) ? 'ok' : 'ERROR ' + ((r && r.error) || 'failed')];
  ((r && r.events) || []).forEach((e) => parts.push(e));
  return n + '. ' + describeAction(action) + ': ' + parts.join(' · ');
}

// The fields of `next` that differ from `prev` (JSON-equal counts as the same); a field `prev` had
// and `next` lacks comes back null. No prev: the whole snapshot. A snapshot gone (the set ended): null.
function obsDiff(prev, next) {
  if (next == null) return null;
  if (prev == null) return next;
  const out = {};
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  Object.keys(next).forEach((k) => { if (!same(prev[k], next[k])) out[k] = next[k]; });
  Object.keys(prev).forEach((k) => { if (!(k in next)) out[k] = null; });
  return out;
}

// Stop a list of actions after this one? At the first error, and at a step change (the caller
// reads the new card first) unless `through`. A give-up always stops.
function batchStop(r, before, after, through) {
  if (!r || !r.ok) return 'error';
  if (r.gaveUp) return 'gave up';
  if (through) return null;
  if (before && !after) return 'the set ended';
  if (before && after && before.id !== after.id) return 'step changed';
  return null;
}

// The no-work detector. Feed it every snapshot it sees, in order, with the action between them.
//   const t = new StepTracker(firstObs);
//   t.before(obsBeforeAction)          // a change between calls (an auto-advance) is seen here
//   t.after(action, driverResult, obsAfter) -> [flags this action raised]
// A flag: { step, i, why, actions } where actions are the reader's actions on that step (their
// describeAction phrases); `why` is 'done on arrival' | 'turned done' | 'moved on' |
// 'done with no action' (idle: the /episode beat).
class StepTracker {
  constructor(obs) { this.flags = []; this.cur = null; this._enter(obs, 'start'); }
  _enter(obs, how) {
    this.cur = obs ? { id: obs.id, i: obs.i, kind: obs.kind, work: false, actions: [], done: !!obs.done, flagged: false } : null;
    // a doing step Done the moment it came up, reached by the reader's move (a start is the
    // fast-forward's: the harness gives it its beat before it judges, see openEpisode)
    if (this.cur && how !== 'start' && obs.kind === 'do' && obs.done) return this._flag('done on arrival');
    return null;
  }
  _flag(why) {
    const c = this.cur;
    if (!c || c.flagged || c.kind !== 'do' || c.work) return null;
    c.flagged = true;
    const f = { step: c.id, i: c.i, why, actions: c.actions.slice() };
    this.flags.push(f);
    return f;
  }
  // A snapshot seen with no action behind it (before an action, or after a wait at /episode).
  // Returns the flags it raised.
  before(obs) {
    const out = [];
    if (!this.cur) { if (obs) this._enter(obs, 'start'); return out; }
    if (!obs) return out;
    if (obs.id !== this.cur.id) {
      // it moved on with no action: the engine advanced a step that was Done
      const f = obs.i > this.cur.i ? this._flag('moved on') : null;
      if (f) out.push(f);
      const g = this._enter(obs, 'moved');
      if (g) out.push(g);
    } else if (obs.done && !this.cur.done) {
      const f = this._flag('turned done');
      if (f) out.push(f);
      this.cur.done = true;
    }
    return out;
  }
  // The snapshot after a beat with no action at all (the harness waits ~1.5 s after the
  // fast-forward lands): a doing step that is Done now, or has moved on, passed with nothing done.
  idle(obs) {
    if (!this.cur || !obs) return [];
    if (obs.id !== this.cur.id) return this.before(obs);
    const out = [];
    if (obs.done) { const f = this._flag('done with no action'); if (f) out.push(f); }
    this.cur.done = !!obs.done;
    return out;
  }
  after(action, r, obs) {
    const out = [];
    const c = this.cur;
    if (!c) return out;
    c.actions.push(describeAction(action));
    if (!isNoWork(action, r)) c.work = true;
    const nav = navOf(action, r);
    if (!obs) {
      // the set ended on this action: the last step passed (Finish on a doing step)
      if (nav !== 'skip' && nav !== 'back' && !(nav === 'next' && !c.done)) { const f = this._flag('moved on'); if (f) out.push(f); }
      this.cur = null;
      return out;
    }
    if (obs.id === c.id) {
      if (obs.done && !c.done) { const f = this._flag('turned done'); if (f) out.push(f); }
      c.done = !!obs.done;
      return out;
    }
    // the step changed on this action. Skip and Back are the reader leaving, not a pass; Next on
    // a step that was not Done is the reader skipping by another button.
    const forward = obs.i > c.i;
    if (forward && nav !== 'skip' && nav !== 'back' && !(nav === 'next' && !c.done)) { const f = this._flag('moved on'); if (f) out.push(f); }
    const g = this._enter(obs, 'moved');
    if (g) out.push(g);
    return out;
  }
}

module.exports = { CARD_NAV, isNoWork, navOf, describeAction, actionLine, obsDiff, batchStop, StepTracker };
