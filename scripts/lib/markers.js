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
module.exports = { spliceMarkedRegion };
