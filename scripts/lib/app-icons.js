'use strict';
// Shared extraction of a toolbar element's inline SVG from app/index.html —
// the byte-identical regex pair previously duplicated in build-macros.js and
// build-guides.js (DECOMPOSITION_MAP Tier-4 #18). The close tag
// backreferences the open tag, so a button's inner <span>s can't end the
// match early (no element here nests its own type inside itself).
// Returns null when the element is missing, { attrs, svg: null } when it has
// no <svg> — callers decide whether that's a hard error (build-macros) or a
// warn-and-skip (build-guides).
function extractAppIcon(html, id) {
  const m = new RegExp(`<(button|span)\\b([^>]*\\bid="${id}"[^>]*)>([\\s\\S]*?)</\\1>`).exec(html);
  if (!m) return null;
  const svg = /<svg[^>]*\bviewBox="([^"]*)"[^>]*>([\s\S]*?)<\/svg>/.exec(m[3]);
  if (!svg) return { attrs: m[2], svg: null };
  return { attrs: m[2], svg: { viewBox: svg[1], inner: svg[2].trim() } };
}
module.exports = { extractAppIcon };
