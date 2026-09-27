/**
 * The Learn guide's glossary as data (LEARN-WORDS, 2026-09-27). The guide's "Words the
 * cards use" section (content/guides/learning-the-app.md) is the ONE list of the words the
 * courses, tours and lessons explain; build-guides.js turns it into guides/words.json
 * through this file, and the app's Words search (features/learn-words.js) reads that. So a
 * word is added or reworded in the guide's Markdown and nowhere else.
 *
 * The section runs from its heading to the next ## or ### heading; a #### heading inside
 * it names a group; an entry is a list item that opens with a bold term:
 *   - **Title block.** The box at the edge of a sheet with its name, its number and its scale.
 * becomes { term: 'Title block', text: 'The box at the edge of a sheet with ...' }. The
 * text is plain: bold and code marks are dropped, a Markdown link reads as its words.
 */
const HEADING = 'Words the cards use';
const SOURCE = { file: 'content/guides/learning-the-app.md', url: '/guides/learning-the-app/' };

const plain = (s) => String(s)
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

/** The glossary's groups, in the guide's order: [{ name, words: [{ term, text }] }]; null when the section is missing. */
function guideWords(md, heading = HEADING) {
  const lines = String(md).split('\n');
  const start = lines.findIndex((l) => /^#{2,3}\s/.test(l) && l.replace(/^#+\s*/, '').trim() === heading);
  if (start < 0) return null;
  const groups = [];
  let group = null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^#{1,3}\s/.test(line)) break;
    const h = /^####\s+(.*)$/.exec(line);
    if (h) { group = { name: plain(h[1]), words: [] }; groups.push(group); continue; }
    const m = /^\s*[-*]\s+\*\*([^*]+)\*\*\s*(.*)$/.exec(line);
    if (!m) continue;
    if (!group) { group = { name: '', words: [] }; groups.push(group); }
    group.words.push({ term: m[1].trim().replace(/[.:]$/, '').trim(), text: plain(m[2]) });
  }
  return groups.filter((g) => g.words.length);
}

/** guides/words.json, byte for byte (build-guides.js writes it and --check compares it). */
function wordsJson(md) {
  const groups = guideWords(md);
  if (!groups) throw new Error(`${SOURCE.file}: no "${HEADING}" section, so guides/words.json has nothing to hold`);
  const bad = groups.flatMap((g) => g.words).filter((w) => !w.term || !w.text);
  if (bad.length) throw new Error(`${SOURCE.file}: a word under "${HEADING}" has no meaning after its bold term: ${bad.map((w) => w.term || '(no term)').join(', ')}`);
  return JSON.stringify({ source: SOURCE.url, heading: HEADING, count: groups.reduce((n, g) => n + g.words.length, 0), groups }, null, 1) + '\n';
}

module.exports = { HEADING, SOURCE, guideWords, wordsJson };
