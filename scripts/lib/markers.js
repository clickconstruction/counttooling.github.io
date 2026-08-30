'use strict';
// Shared BEGIN/END generated-region splice for the committed-artifact
// generators (build-toc, build-macros — DECOMPOSITION_MAP Tier-4 #18):
// replace everything from the BEGIN marker through the END marker with
// `block` (the caller includes the markers in `block`). Returns null when
// either marker is missing or out of order — callers own the error message.
function spliceMarkedRegion(src, begin, end, block) {
  const start = src.indexOf(begin);
  const stop = src.indexOf(end);
  if (start === -1 || stop === -1 || stop < start) return null;
  return src.slice(0, start) + block + src.slice(stop + end.length);
}

// Git leaves conflict markers at column 0: '<<<<<<< ours', '=======',
// '>>>>>>> theirs'. Returns the 1-based line number of the first such line, or
// 0 when the text is clean. Pure — assertNoConflictMarkers owns the exit.
function findConflictMarkerLine(text) {
  const re = /^(?:<{7} |={7}|>{7} )/;
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i + 1;
  }
  return 0;
}

// Stamping guard for every committed-artifact generator: an orchestrator twice
// re-ran a generator while sw.js still held unresolved conflict markers,
// producing a stamped-but-broken file that PASSED the --check (the hash matched
// the broken bytes on disk) and only failed later at lint. Refuse to read or
// splice a conflicted file at all.
function assertNoConflictMarkers(text, label) {
  const line = findConflictMarkerLine(text);
  if (!line) return;
  console.error(`${label}:${line} contains an unresolved git conflict marker (<<<<<<</=======/>>>>>>>).`);
  console.error('Resolve merge conflicts before stamping.');
  process.exit(1);
}

module.exports = { spliceMarkedRegion, findConflictMarkerLine, assertNoConflictMarkers };
