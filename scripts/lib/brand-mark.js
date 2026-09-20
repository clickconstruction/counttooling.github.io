/**
 * scripts/lib/brand-mark.js — the CountTooling mark, in one place.
 *
 * The mark is a takeoff reticle whose ring is opened on the right so it also
 * reads as a "C": three ticks (top, bottom, left), an open ring, and a center
 * dot, dark on the brand yellow. Every rendering of it (the header logo in
 * index.html / 404.html / scripts/lib/site.js, the PWA + home-screen icons and
 * the tab favicon from build-pwa-icons.js, the share card from
 * build-og-image.js) comes from these functions so the geometry can't drift.
 *
 * Geometry is on a 512x512 viewBox and stays inside the central ~80% so
 * platform maskable shapes never clip it. Stroke weights are tuned for the
 * 16-32px tab sizes (the old logo's 30-unit strokes vanished at 16px).
 */
const YELLOW = '#e8c547';
const DARK = '#161617';

const CX = 256;
const RING_R = 130;
const GAP_DEG = 95;       // total angular opening, centered on the right
const STROKE = 52;
const DOT_R = 52;
const TICK = [60, 150];   // tick from the edge of the safe zone to just outside the ring

function fmt(n) { return String(Math.round(n * 100) / 100); }

// The open ring: a single arc from the top edge of the gap around to the bottom edge.
function ringPath() {
  const a = (GAP_DEG / 2) * Math.PI / 180;
  const x1 = CX + RING_R * Math.cos(a), y1 = CX - RING_R * Math.sin(a);
  const x2 = CX + RING_R * Math.cos(-a), y2 = CX - RING_R * Math.sin(-a);
  return `M${fmt(x1)} ${fmt(y1)} A${RING_R} ${RING_R} 0 1 0 ${fmt(x2)} ${fmt(y2)}`;
}

/**
 * The glyph alone (no background). `color` is the ink; `stroke` and `dot`
 * override the weights for decorative uses (the 404 page's large mark).
 */
function glyph(color = DARK, { stroke = STROKE, dot = DOT_R } = {}) {
  const [t0, t1] = TICK;
  return `<g fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round">` +
    `<path d="${ringPath()}"/>` +
    `<line x1="${CX}" y1="${t0}" x2="${CX}" y2="${t1}"/>` +
    `<line x1="${CX}" y1="${512 - t1}" x2="${CX}" y2="${512 - t0}"/>` +
    `<line x1="${t0}" y1="${CX}" x2="${t1}" y2="${CX}"/>` +
    `</g><circle cx="${CX}" cy="${CX}" r="${dot}" fill="${color}"/>`;
}

/**
 * The full mark on its yellow tile.
 *   variant: 'rounded' (rounded square, transparent corners — logo, favicon,
 *            manifest "any" icons) or 'bleed' (full square to the edges —
 *            maskable + apple-touch icons, which the OS rounds itself).
 *   attrs:   extra attributes on the <svg> (e.g. aria-hidden, width/height).
 */
function mark(variant = 'rounded', attrs = '') {
  const bg = variant === 'bleed'
    ? `<rect width="512" height="512" fill="${YELLOW}"/>`
    : `<rect width="512" height="512" rx="112" fill="${YELLOW}"/>`;
  const a = attrs ? ' ' + attrs.trim() : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"${a}>${bg}${glyph()}</svg>`;
}

/** The inline header-logo markup used next to the wordmark. */
const LOGO_SVG = mark('rounded', 'aria-hidden="true"');

/** The <link rel="icon"> lines every page head carries (ICO for Safari + legacy, SVG for the rest). */
const FAVICON_LINKS = `  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">`;

module.exports = { YELLOW, DARK, glyph, mark, LOGO_SVG, FAVICON_LINKS };
