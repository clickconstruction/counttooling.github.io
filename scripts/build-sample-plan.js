#!/usr/bin/env node
/**
 * Generates samples/sample-plan.pdf — a synthetic commercial floor plan used as the
 * backdrop for the guide screenshots (so they show a realistic takeoff, not a blank
 * sheet). No confidential data; fully reproducible. Renders an inline SVG to PDF via the
 * Chromium that ships with @playwright/test (no new deps).
 *
 * Run with: npm run build:sample-plan
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'samples', 'sample-plan.pdf');
const W = 1224; // 17in landscape @ 72dpi
const H = 792;  // 11in

// --- fixture symbols (architectural-ish, thin black linework) -----------------
function wc(x, y, rot = 0) { // toilet: tank + bowl
  return `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="#111" stroke-width="1.3">
    <rect x="-9" y="-6" width="18" height="9"/>
    <ellipse cx="0" cy="13" rx="9" ry="12"/>
  </g>`;
}
function lav(x, y, rot = 0) { // sink
  return `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="#111" stroke-width="1.3">
    <rect x="-11" y="-8" width="22" height="16" rx="2"/>
    <ellipse cx="0" cy="0" rx="7" ry="5"/>
  </g>`;
}
function door(x, y, size, rot = 0) { // leaf + swing arc
  return `<g transform="translate(${x},${y}) rotate(${rot})" fill="none" stroke="#111" stroke-width="1.2">
    <line x1="0" y1="0" x2="0" y2="${-size}"/>
    <path d="M0 ${-size} A ${size} ${size} 0 0 1 ${size} 0"/>
  </g>`;
}
function room(x, y, w, h, label, num) {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#111" stroke-width="2"/>
    <text x="${x + w / 2}" y="${y + h / 2 - 4}" text-anchor="middle" font-family="Helvetica, Arial" font-size="15" font-weight="bold" fill="#111">${label}</text>
    <text x="${x + w / 2}" y="${y + h / 2 + 14}" text-anchor="middle" font-family="Helvetica, Arial" font-size="12" fill="#444">${num}</text>
  </g>`;
}
function dim(x1, y, x2, label) { // horizontal dimension line with ticks
  return `<g stroke="#111" stroke-width="1" font-family="Helvetica, Arial" font-size="12" fill="#111">
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>
    <line x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}"/>
    <line x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}"/>
    <text x="${(x1 + x2) / 2}" y="${y - 6}" text-anchor="middle" stroke="none">${label}</text>
  </g>`;
}

// --- the plan -----------------------------------------------------------------
const PLAN = `
  <!-- building outer wall -->
  <rect x="150" y="120" width="780" height="470" fill="#fff" stroke="#111" stroke-width="5"/>
  <!-- interior partitions -->
  <line x1="150" y1="355" x2="930" y2="355" stroke="#111" stroke-width="3"/>
  <line x1="430" y1="120" x2="430" y2="355" stroke="#111" stroke-width="3"/>
  <line x1="690" y1="120" x2="690" y2="355" stroke="#111" stroke-width="3"/>
  <line x1="430" y1="355" x2="430" y2="590" stroke="#111" stroke-width="3"/>
  <line x1="620" y1="355" x2="620" y2="590" stroke="#111" stroke-width="3"/>

  ${room(150, 120, 280, 235, 'OFFICE', '101')}
  ${room(430, 120, 260, 235, 'BREAK ROOM', '102')}
  ${room(690, 120, 240, 235, 'CONFERENCE', '103')}
  ${room(150, 355, 280, 235, 'OPEN OFFICE', '104')}
  ${room(430, 355, 190, 235, 'MEN', '105')}
  ${room(620, 355, 310, 235, 'WOMEN', '106')}

  <!-- restroom fixtures -->
  ${wc(455, 380)} ${wc(490, 380)} ${wc(525, 380)}
  ${lav(450, 565, 180)} ${lav(485, 565, 180)} ${lav(520, 565, 180)}
  ${wc(650, 380)} ${wc(685, 380)} ${wc(720, 380)} ${wc(755, 380)}
  ${lav(645, 565, 180)} ${lav(680, 565, 180)} ${lav(715, 565, 180)} ${lav(750, 565, 180)}

  <!-- doors -->
  ${door(300, 355, 26, 0)}
  ${door(560, 355, 26, 180)}
  ${door(810, 355, 26, 0)}
  ${door(300, 355, 26, 180)}
  ${door(500, 355, 26, 0)}
  ${door(720, 355, 26, 0)}

  <!-- north arrow -->
  <g transform="translate(965,150)" stroke="#111" fill="#111" font-family="Helvetica, Arial">
    <line x1="0" y1="20" x2="0" y2="-20" stroke-width="1.5"/>
    <path d="M0 -24 L5 -12 L0 -16 L-5 -12 Z"/>
    <text x="0" y="-30" text-anchor="middle" font-size="13" stroke="none">N</text>
  </g>

  <!-- dimensions -->
  ${dim(150, 105, 930, '65\'-0"')}
  ${dim(150, 615, 430, '23\'-4"')}
  ${dim(430, 615, 690, '21\'-8"')}
  ${dim(690, 615, 930, '20\'-0"')}

  <!-- title block -->
  <g font-family="Helvetica, Arial">
    <rect x="820" y="650" width="380" height="120" fill="#fff" stroke="#111" stroke-width="2"/>
    <line x1="820" y1="690" x2="1200" y2="690" stroke="#111" stroke-width="1"/>
    <line x1="1060" y1="690" x2="1060" y2="770" stroke="#111" stroke-width="1"/>
    <text x="835" y="676" font-size="17" font-weight="bold" fill="#111">COUNTTOOLING — SAMPLE PLAN</text>
    <text x="835" y="714" font-size="11" fill="#444">SCALE</text>
    <text x="835" y="732" font-size="15" fill="#111">1/8" = 1'-0"</text>
    <text x="835" y="758" font-size="11" fill="#444">FIRST FLOOR PLAN</text>
    <text x="1075" y="714" font-size="11" fill="#444">SHEET</text>
    <text x="1075" y="740" font-size="22" font-weight="bold" fill="#111">A-101</text>
  </g>
`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#fff"/>
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" fill="none" stroke="#111" stroke-width="1.5"/>
  ${PLAN}
</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: ${W}px ${H}px; margin: 0; }
  html,body { margin: 0; padding: 0; }
  svg { display: block; }
</style></head><body>${svg}</body></html>`;

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.pdf({ path: OUT, width: `${W}px`, height: `${H}px`, printBackground: true, pageRanges: '1' });
  await browser.close();
  console.log('Wrote samples/sample-plan.pdf (' + W + 'x' + H + ').');
})().catch((e) => { console.error(e); process.exit(1); });
