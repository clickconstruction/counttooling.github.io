/*
 * features/learn-taps.js - the glossed words as tap targets on the cards (LEARN-TAPS,
 * 2026-09-27, journeys/plans/LEARN-START-HERE.md). A card says what a word means the first
 * time its course uses it; on a LATER card the word wears a dotted underline, and a tap
 * shows its entry from the Learn guide's glossary under the card's text. The inline gloss
 * stays where it is: the first card that uses a word is never underlined for it.
 *
 * The words are the guide's one list, /guides/words.json (features/learn-words.js loads
 * it: App.learnWordsReady / App.learnWordGroups). Which card comes "later" is read off the
 * tours themselves (App.tutorialBodies, features/tutorial.js), in the order the language
 * check reads them (scripts/score-courses.js): a course is its chapters in order, the
 * lessons are one run in the Learn menu's order, and each tour stands alone.
 *
 * Restraint, because a card is for doing: at most CAP words a card, the ones the course
 * uses least first (the ones a reader has most likely forgotten); a word is underlined
 * once a card, where it first appears; an acronym matches in its own case only ("GC", never
 * "gc"); a name under three letters is skipped ("A", the amp); and PLAIN holds the words
 * left alone, the everyday ones that are also verbs ("set the scale", "run the pipe") and
 * the parts of the screen every card names. All of them stay in the Words search.
 *
 * The pure core (wordNames, entryOf, pickTaps, decorate) is exported through the guarded
 * CommonJS footer for learn-taps.test.js.
 *
 * Registrations: cardWordTaps(tourId, stepIdx) (the engine's bodyHtml asks for the card's
 * decorator, a function of one run of plain text, or null), onTourStepChanged() (the engine's
 * goTo and stop: the open entry closes).
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 */
(function () {
  'use strict';
  const CAP = 4;
  const PLAIN = new Set(['set', 'run', 'count', 'check', 'mark', 'move', 'note', 'drop', 'tap', 'main', 'supply', 'waste', 'vent',
    'system', 'trade', 'tag', 'load', 'trace', 'chain', 'snap', 'group', 'detail', 'section', 'labor', 'cloud', 'zone', 'gear', 'chip',
    'palette', 'layer', 'armed', 'box', 'return', 'service', 'branch', 'export', 'summary', 'panel',
    'sheet', 'bid', 'scale', 'header', 'sidebar', 'footer', 'counter', 'takeoff']);

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // scripts/score-courses.js termRe: a whole word, a space in the name matching a space or a
  // hyphen, a plural s / es (ies for a name in y). An acronym keeps its case.
  function nameRe(name, exactCase) {
    let body = escRe(name).replace(/\s+/g, '[\\s-]+');
    body = /[^aeiou]y$/i.test(name) ? body.slice(0, -1) + '(?:y|ies)' : body + '(?:e?s)?';
    return new RegExp('(?<![A-Za-z0-9-])' + body + '(?![A-Za-z0-9]|-[A-Za-z])', exactCase ? '' : 'i');
  }
  // Every name a reader might meet, from the glossary's groups: a term's parenthesis holds
  // its other names ("GC (general contractor)" is two). [{ name, term, text, group, re }]
  function wordNames(groups) {
    const out = [];
    (groups || []).forEach((g) => (g.words || []).forEach((w) => {
      const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(w.term);
      (m ? [m[1]].concat(m[2].split(/,\s*/)) : [w.term]).forEach((raw) => {
        const name = String(raw).trim().replace(/^(?:a|an|the)\s+/i, '');
        if (!name || PLAIN.has(name.toLowerCase())) return;
        const acronym = /[A-Z]/.test(name) && !/[a-z]/.test(name);
        if (acronym ? name.replace(/[^A-Z0-9]/g, '').length < 2 : name.length < 3) return;
        out.push({ name, term: w.term, text: w.text, group: g.name, re: nameRe(name, acronym) });
      });
    }));
    return out;
  }
  // A tour's run of cards: a course's chapters, the lessons, or the tour alone. The prefix its
  // tours share, or the id itself.
  function entryOf(tourId) {
    const id = String(tourId || '');
    const course = /^course:[^:]+:/.exec(id);
    if (course) return course[0];
    return /^lesson:/.test(id) ? 'lesson:' : id;
  }
  // The text a word is looked for in: the controls' labels out (a button's name is no trade
  // word), a link read as its words.
  const proseOf = (t) => String(t || '').replace(/\[\[[^\]]+\]\]/g, ' ').replace(/\[([^[\]]+)\]\([^)]*\)/g, '$1');
  // The words card `index` underlines, given every card of its run in order (their texts):
  // the ones an EARLIER card used, the least used in the run first, CAP at most.
  // [{ term, text, group }]
  function pickTaps(cards, index, names, cap) {
    const prose = (cards || []).map(proseOf);
    const here = prose[index];
    if (!here) return [];
    const found = new Map();   // term -> where it first appears on this card
    (names || []).forEach((n) => { const at = here.search(n.re); if (at >= 0 && (!found.has(n.term) || at < found.get(n.term).at)) found.set(n.term, { at, n }); });
    const picks = [];
    found.forEach(({ at, n }, term) => {
      const mine = names.filter((x) => x.term === term);
      const usedAt = (text) => mine.some((x) => x.re.test(text));
      if (!prose.slice(0, index).some(usedAt)) return;   // this card is its first use: the gloss is on it
      picks.push({ term, text: n.text, group: n.group, at, uses: prose.filter(usedAt).length });
    });
    return picks.sort((a, b) => a.uses - b.uses || a.at - b.at).slice(0, cap == null ? CAP : cap).map((p) => ({ term: p.term, text: p.text, group: p.group }));
  }
  // One run of plain text as HTML, each picked word's first appearance wrapped as a tap target.
  // `done` is the card's own set of terms already wrapped, so a word is underlined once a card.
  function decorate(text, picks, names, esc, done) {
    const spans = [];
    (picks || []).forEach((p) => {
      if (done.has(p.term)) return;
      let best = null;
      names.forEach((n) => { if (n.term !== p.term) return; const m = n.re.exec(text); if (m && (!best || m.index < best.at)) best = { at: m.index, len: m[0].length }; });
      if (best) spans.push({ at: best.at, end: best.at + best.len, term: p.term });
    });
    spans.sort((a, b) => a.at - b.at);
    let out = '', pos = 0;
    spans.forEach((s) => {
      if (s.at < pos) return;   // inside a longer name already wrapped ("scale" in "scale zone")
      done.add(s.term);
      out += esc(text.slice(pos, s.at)) + '<span class="tour-word" role="button" tabindex="0" data-word="' + esc(s.term).replace(/"/g, '&quot;') + '">' + esc(text.slice(s.at, s.end)) + '</span>';
      pos = s.end;
    });
    return out + esc(text.slice(pos));
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const App = (window.App = window.App || {});
    const el = (id) => document.getElementById(id);
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    let names = null;          // the glossary's names, once loaded; [] when it could not be, or on an engine without lookbehind
    let asked = false;
    const runs = new Map();    // entry -> [{ tour, step, text }] every card of the run, in order
    const picked = new Map();  // 'tour#step' -> picks
    function ready() {
      if (names || asked || !App.learnWordsReady) return;
      asked = true;
      App.learnWordsReady().then((groups) => {
        try { names = wordNames(groups); } catch (_) { names = []; }
        picked.clear();
        if (App.onTutorialTick) App.onTutorialTick();
      });
    }
    function runOf(tourId) {
      const key = entryOf(tourId);
      if (runs.has(key)) return runs.get(key);
      const ids = (App.tutorialIds ? App.tutorialIds() : []).filter((id) => (key.endsWith(':') ? id.startsWith(key) : id === key));
      const cards = [];
      ids.forEach((id) => (App.tutorialBodies(id) || []).forEach((text, step) => cards.push({ tour: id, step, text })));
      runs.set(key, cards);
      return cards;
    }
    function picksFor(tourId, stepIdx) {
      const k = tourId + '#' + stepIdx;
      if (picked.has(k)) return picked.get(k);
      let out = [];
      try {
        const cards = runOf(tourId);
        const at = cards.findIndex((c) => c.tour === tourId && c.step === stepIdx);
        if (at >= 0) out = pickTaps(cards.map((c) => c.text), at, names, CAP);
      } catch (_) { out = []; }
      picked.set(k, out);
      return out;
    }
    // The decorator for one render of one card, or null when there is nothing to underline.
    App.cardWordTaps = (tourId, stepIdx) => {
      ready();
      if (!names || !names.length || !App.tutorialBodies) return null;
      const picks = picksFor(tourId, stepIdx);
      if (!picks.length) return null;
      const done = new Set();
      return (text) => decorate(String(text), picks, names, esc, done);
    };

    // ----- the entry under the card's text -------------------------------------------------
    let open = null;
    function show(term) {
      const box = el('tourWord');
      if (!box) return;
      const n = term && (names || []).find((x) => x.term === term);
      open = n ? term : null;
      box.hidden = !n;
      box.innerHTML = n ? '<button type="button" class="tour-word-close" id="tourWordClose" aria-label="Close">×</button><span class="tour-word-term">' + esc(n.term) + '.</span> ' + esc(n.text) : '';
      if (App.onTutorialTick) App.onTutorialTick();   // the card is taller or shorter: it takes its place again
    }
    const body = el('tourBody');
    if (body) {
      const from = (e) => (e.target && e.target.closest ? e.target.closest('.tour-word') : null);
      body.addEventListener('click', (e) => { const w = from(e); if (!w) return; const t = w.getAttribute('data-word'); show(open === t ? null : t); });
      body.addEventListener('keydown', (e) => { const w = from(e); if (!w || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); e.stopPropagation(); const t = w.getAttribute('data-word'); show(open === t ? null : t); });
    }
    const box = el('tourWord');
    if (box) box.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#tourWordClose')) show(null); });
    App.onTourStepChanged = () => { if (open || (box && !box.hidden)) show(null); };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { CAP, PLAIN, wordNames, entryOf, pickTaps, decorate };
})();
