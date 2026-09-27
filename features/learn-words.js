/*
 * features/learn-words.js - the Words search at the top of Learn (LEARN-WORDS, 2026-09-27,
 * journeys/plans/LEARN-START-HERE.md). A box over the Learn guide's glossary, "Words the
 * cards use": type a word a card used, read what it means, without leaving the app.
 *
 * The guide is the one list. `npm run build:guides` turns that section of
 * content/guides/learning-the-app.md into /guides/words.json (scripts/lib/guide-words.js:
 * { count, groups: [{ name, words: [{ term, text }] }] }), and this file fetches it the first
 * time the box is used. It is precached (scripts/build-sw.js PRECACHE_EXTRA), so the search
 * works offline. A word is added or reworded in the guide's Markdown and nowhere else.
 *
 * While the box holds a query the Learn card shows the matches in place of the tours, the
 * lessons and the courses (`.learn-searching`); emptied, the menu is back. Matching is plain
 * text, case-insensitive, ranked: the term itself, a term that starts with the query, a
 * word inside the term that does, the term anywhere, then the meaning (`searchWords`, pure,
 * exported through the guarded CommonJS footer for learn-words.test.js).
 *
 * Registrations: onLearnMenuOpened() (features/lessons.js openLearnMenu calls it: the box
 * opens empty), learnWordsSearch(query) (spec seam: type a query and render).
 * Boundary rule: read shared deps from App.* at call time, never captured at load.
 */
(function () {
  'use strict';
  const WORDS_URL = '/guides/words.json';
  const GUIDE_URL = '/guides/learning-the-app/';
  const LIMIT = 12;

  const norm = (s) => String(s || '').toLowerCase().replace(/[‘’]/g, '\'').replace(/\s+/g, ' ').trim();
  // 0 the term itself, 1 a term that starts with the query, 2 a word inside the term that
  // does, 3 the term anywhere, 4 the meaning; -1 no match. A term's parenthesis holds its
  // other names ("GC (general contractor)"), so each is a word of the term.
  function rank(word, q) {
    const term = norm(word.term);
    if (term === q) return 0;
    if (term.startsWith(q)) return 1;
    if (term.split(/[\s(),/-]+/).some((w) => w.startsWith(q))) return 2;
    if (term.includes(q)) return 3;
    return norm(word.text).includes(q) ? 4 : -1;
  }
  // The matches for a query, best first, the guide's order within a rank:
  // [{ term, text, group }]. An empty query matches nothing.
  function searchWords(groups, query) {
    const q = norm(query);
    if (!q) return [];
    const hits = [];
    (groups || []).forEach((g) => (g.words || []).forEach((w) => {
      const r = rank(w, q);
      if (r >= 0) hits.push({ r, i: hits.length, term: w.term, text: w.text, group: g.name });
    }));
    return hits.sort((a, b) => a.r - b.r || a.i - b.i).map((h) => ({ term: h.term, text: h.text, group: h.group }));
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const App = (window.App = window.App || {});
    const el = (id) => document.getElementById(id);
    const esc = (s) => (App.escapeHtml ? App.escapeHtml(String(s)) : String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

    let groups = null;    // the glossary, once loaded ([] when it could not be)
    let loading = null;
    function wordsReady() {
      if (loading) return loading;
      loading = fetch(WORDS_URL).then((r) => (r.ok ? r.json() : null)).then((j) => { groups = (j && Array.isArray(j.groups)) ? j.groups : []; return groups; })
        .catch(() => { groups = []; loading = null; return groups; });   // offline with no cache yet: the next try fetches again
      return loading;
    }

    function render() {
      const input = el('learnWordsInput'), out = el('learnWordsResults'), card = document.querySelector('#learnModal .learn-card');
      if (!input || !out) return;
      const query = input.value;
      const searching = !!norm(query);
      if (card) card.classList.toggle('learn-searching', searching);
      out.hidden = !searching;
      if (!searching) { out.innerHTML = ''; return; }
      if (!groups) { out.innerHTML = '<p class="learn-words-note">Looking it up…</p>'; return; }
      const guide = '<a class="tour-link" href="' + GUIDE_URL + '" target="_blank" rel="noopener">the Learn guide</a>';
      if (!groups.length) { out.innerHTML = '<p class="learn-words-note">The word list could not be loaded. It is in ' + guide + ', under Words the cards use.</p>'; return; }
      const hits = searchWords(groups, query);
      if (!hits.length) { out.innerHTML = '<p class="learn-words-note">No word matches “' + esc(query.trim()) + '”. Every word the cards explain is in ' + guide + '.</p>'; return; }
      const shown = hits.slice(0, LIMIT);
      out.innerHTML = '<p class="learn-words-count">' + (hits.length === 1 ? '1 word' : hits.length + ' words') + (hits.length > shown.length ? ', the first ' + shown.length + ' shown. Type more to narrow it.' : '') + '</p>'
        + shown.map((h) => '<div class="learn-word"><div class="learn-word-head"><span class="learn-word-term">' + esc(h.term) + '</span><span class="learn-word-group">' + esc(h.group) + '</span></div><div class="learn-word-text">' + esc(h.text) + '</div></div>').join('');
    }
    function onInput() { render(); if (!groups) wordsReady().then(render); }

    const input = el('learnWordsInput');
    if (input) {
      input.addEventListener('input', onInput);
      input.addEventListener('focus', () => { wordsReady(); });   // loaded by the time the first letter lands
      // Esc empties a box that holds a query, and only then closes Learn
      input.addEventListener('keydown', (e) => { if (e.key === 'Escape' && input.value) { e.stopPropagation(); e.preventDefault(); input.value = ''; render(); } });
    }
    const clear = el('learnWordsClear');
    if (clear) clear.onclick = () => { if (input) { input.value = ''; render(); input.focus(); } };

    App.onLearnMenuOpened = () => { if (input) input.value = ''; render(); };
    App.learnWordsSearch = (query) => { if (input) input.value = String(query == null ? '' : query); onInput(); return wordsReady().then(() => { render(); return searchWords(groups, query); }); };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { searchWords };
})();
