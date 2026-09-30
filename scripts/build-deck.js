#!/usr/bin/env node
/**
 * Builds deck/index.html — the pitch deck served at counttooling.com/deck/ — from
 * deck/deck.json (the slide order) and deck/slides/<id>.html (one slide each).
 *
 * The slide files are the Slides-artifact format the deck was authored in at
 * claude.ai: one <section id="<id>"> per file on a 1920×1080 canvas, every style
 * inline, and an <aside> of speaker notes as the section's last child. A slide
 * edited in the artifact is pasted back here verbatim; a slide can also be edited
 * here by hand, and may hold <video> tags (deck/README.md says how).
 *
 * What the build changes on the way in:
 *   - `/_blob/<id>` image sources (files the artifact hosts) become the site's own
 *     files through BLOBS below — an unmapped id fails the build;
 *   - `<x-shape kind="arrow-right">` (the artifact's arrow element) becomes an
 *     inline SVG of the same size and color.
 * Everything else is copied through, wrapped in the viewer: a stage scaled to the
 * window, arrow keys / click / swipe navigation, `#<n>` deep links, N for the
 * notes, F for full screen, and videos that play only on the slide showing them.
 *
 *   node scripts/build-deck.js            # writes deck/index.html
 *   node scripts/build-deck.js --check    # exits 1 when deck/index.html is stale
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DECK = path.join(ROOT, 'deck');
const OUT = path.join(DECK, 'index.html');

// Artifact blob id → path the site serves. The three heroes and the plumbing report
// are the landing page's own files under /img/; the rest live in deck/assets/.
const BLOBS = {
  '7f055267e7ef914966f0a8ab12916ab0': 'assets/counttooling-icon.png',
  aea04db1ac19a341b2442556507ddcba: 'assets/takeofftooling-icon.png',
  ca179af46197ff16dc4bf14080304d1d: 'assets/clicktooling-icon.png',
  f6a5f22f0665978ebe348ca437b03e8e: '/img/hero-plumbing.png',
  db4720f5aae8b7c44b7c3387bb2e4ba9: '/img/hero-electrical.png',
  '04b16088b69beefa5b24535ea1758d79': '/img/hero-hvac.png',
  '15150989940b2d261c1e7786156eb6dc': '/img/hero-plumbing-report.jpg',
  b0aba048854df0210fb21fa765ee5e23: 'assets/clicktooling-dark.jpg',
  '6c6e101ce28c8e0ff37bab4fb6d183ad': 'assets/takeofftooling-dark.jpg',
  '09822a6064ad0bead22293c8be9d4563': 'assets/tools/counter.svg',
  d40c01cfc4861fa4bd6dbf20b9bbc51a: 'assets/tools/quick-line.svg',
  '844d2c36bc6626886fc5b0938f8f2b27': 'assets/tools/polyline.svg',
  '0555fd445f31ec12bff5f3490acb6c7e': 'assets/tools/chain.svg',
  ff0a970bb8317c9e8350c9aba18be4f6: 'assets/tools/set-scale.svg',
  ad1a3fc07ce5de4c4d54d0668a754f8f: 'assets/tools/scale-zone.svg',
  '593c41149a7d2fd74da98fec03425414': 'assets/tools/multiply-zone.svg',
  '45f33e22ce9a704c45f9e877985a232b': 'assets/tools/duct-run.svg',
  '6a3470e40f9ba88aabddedd9de52bfc4': 'assets/tools/measure.svg',
  '8247ec4ed76eeced39e08458569790a4': 'assets/tools/room-sizer.svg',
};

function styleProp(style, name) {
  const m = new RegExp('(?:^|;)\\s*' + name + '\\s*:\\s*([^;]+)').exec(style || '');
  return m ? m[1].trim() : null;
}

// <x-shape kind="arrow-right" style="width:56px;height:28px;background:#9A7A12"></x-shape>
// → an SVG arrow filling the same box. Only the kinds the deck uses are drawn; a new
// kind fails the build so it is added here on purpose rather than dropped silently.
function shapeToSvg(kind, attrs) {
  const style = (/style="([^"]*)"/.exec(attrs) || [])[1] || '';
  const width = styleProp(style, 'width') || '56px';
  const height = styleProp(style, 'height') || '28px';
  const fill = styleProp(style, 'background') || styleProp(style, 'background-color') || '#000';
  const paths = {
    'arrow-right': 'M0 15 H60 V0 L100 25 L60 50 V35 H0 Z',
    'arrow-left': 'M100 15 H40 V0 L0 25 L40 50 V35 H100 Z',
  };
  if (!paths[kind]) throw new Error('build-deck: <x-shape kind="' + kind + '"> is not drawn yet — add it to shapeToSvg');
  return (
    '<svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true" style="flex:none;width:' +
    width + ';height:' + height + '"><path d="' + paths[kind] + '" fill="' + fill + '"/></svg>'
  );
}

function convertSlide(id, html) {
  const section = /<section\b[\s\S]*<\/section>/.exec(html);
  if (!section) throw new Error('build-deck: deck/slides/' + id + '.html holds no <section>');
  let out = section[0];
  out = out.replace(/\/_blob\/([0-9a-f]{32})/g, (m, blob) => {
    if (!BLOBS[blob]) throw new Error('build-deck: slide "' + id + '" uses /_blob/' + blob + ' which BLOBS does not map');
    return BLOBS[blob];
  });
  out = out.replace(/<x-shape kind="([a-z-]+)"([^>]*)><\/x-shape>/g, (m, kind, attrs) => shapeToSvg(kind, attrs));
  if (/<x-[a-z]/.test(out)) throw new Error('build-deck: slide "' + id + '" holds an <x-…> element the build does not draw');
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function build() {
  const deck = JSON.parse(fs.readFileSync(path.join(DECK, 'deck.json'), 'utf8'));
  const slides = deck.order.map((id) => {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('build-deck: bad slide id ' + JSON.stringify(id));
    return convertSlide(id, fs.readFileSync(path.join(DECK, 'slides', id + '.html'), 'utf8'));
  });
  const title = escapeHtml(deck.title || 'Deck');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#15171C">
<title>${title}</title>
<!-- GENERATED by scripts/build-deck.js from deck/deck.json + deck/slides/*.html — edit those, then rebuild. -->
<style>
@font-face{font-family:'Oswald';src:url(fonts/oswald-variable-latin.woff2) format('woff2');font-weight:200 700;font-display:swap}
@font-face{font-family:'Public Sans';src:url(fonts/publicsans-variable-latin.woff2) format('woff2');font-weight:100 900;font-display:swap}
:root{--s:1;--top:50%}
html,body{margin:0;height:100%;background:#0B0C0F;overflow:hidden;-webkit-text-size-adjust:100%}
#stage{position:absolute;left:50%;top:var(--top);width:1920px;height:1080px;transform:translate(-50%,-50%) scale(var(--s));transform-origin:center;cursor:default;user-select:none}
#stage>section{position:absolute;left:0;top:0;width:1920px;height:1080px;box-sizing:border-box;overflow:hidden;opacity:0;visibility:hidden;transition:opacity .4s ease,visibility 0s linear .4s;font-family:'Public Sans',Arial,sans-serif;color:#F6F4EE}
#stage>section.active{opacity:1;visibility:visible;transition:opacity .4s ease}
#stage section *{box-sizing:border-box}
#stage section h1,#stage section h2,#stage section h3,#stage section p,#stage section ul,#stage section ol,#stage section table,#stage section hr{margin:0}
#stage section ul,#stage section ol{padding-left:1.1em}
#stage section img,#stage section video{display:block}
#stage section table{border-collapse:collapse;width:100%}
#stage section th{text-align:left}
#stage section a{color:inherit}
#stage section aside{display:none}
#counter{position:fixed;right:14px;bottom:10px;font:14px/1 'Public Sans',Arial,sans-serif;color:#8E929B;opacity:.7;letter-spacing:1px;pointer-events:none}
#hint{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);padding:8px 14px;border-radius:8px;background:rgba(20,22,28,.85);color:#C9CBD1;font:14px/1.4 'Public Sans',Arial,sans-serif;opacity:0;transition:opacity .6s;pointer-events:none;white-space:nowrap}
#hint.show{opacity:1}
#notes{position:fixed;left:0;right:0;bottom:0;max-height:38vh;overflow:auto;padding:14px 24px 18px;background:rgba(20,22,28,.96);color:#E6E6E6;font:17px/1.5 'Public Sans',Arial,sans-serif;border-top:1px solid #2E3138;display:none;white-space:pre-wrap}
#notes b{color:#E8C547;display:block;margin-bottom:4px;font-size:12px;letter-spacing:2px;text-transform:uppercase}
body.notes #notes{display:block}
</style>
</head>
<body>
<main id="stage" aria-live="polite">
${slides.join('\n')}
</main>
<div id="counter"></div>
<div id="hint">← → move · N notes · F full screen</div>
<div id="notes"><b>Speaker notes</b><span id="notes-text"></span></div>
<noscript><style>#stage>section{position:static;opacity:1;visibility:visible;margin-bottom:8px}#stage{position:static;transform:none;height:auto}html,body{overflow:auto}</style></noscript>
<script>
(function () {
  var stage = document.getElementById('stage');
  var slides = Array.prototype.slice.call(stage.children).filter(function (el) { return el.tagName === 'SECTION'; });
  var counter = document.getElementById('counter');
  var hint = document.getElementById('hint');
  var notes = document.getElementById('notes');
  var notesText = document.getElementById('notes-text');
  var cur = -1;

  function fit() {
    var h = window.innerHeight - (document.body.classList.contains('notes') ? notes.offsetHeight : 0);
    var s = Math.min(window.innerWidth / 1920, h / 1080);
    document.documentElement.style.setProperty('--s', s);
    document.documentElement.style.setProperty('--top', (h / 2) + 'px');
  }

  function media(section, on) {
    var vids = section.querySelectorAll('video');
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i];
      if (on) {
        if (v.hasAttribute('autoplay') || v.hasAttribute('data-autoplay')) {
          try { v.currentTime = 0; } catch (e) { /* not yet loaded */ }
          var p = v.play();
          if (p && p.catch) p.catch(function () {});
        }
      } else {
        v.pause();
      }
    }
  }

  function indexFromHash() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (!h) return 0;
    var n = parseInt(h, 10);
    if (!isNaN(n)) return Math.min(Math.max(n - 1, 0), slides.length - 1);
    for (var i = 0; i < slides.length; i++) if (slides[i].id === h) return i;
    return 0;
  }

  function show(i) {
    i = Math.min(Math.max(i, 0), slides.length - 1);
    if (i === cur) return;
    if (cur >= 0) { slides[cur].classList.remove('active'); media(slides[cur], false); }
    cur = i;
    slides[i].classList.add('active');
    media(slides[i], true);
    counter.textContent = (i + 1) + ' / ' + slides.length;
    var aside = null;
    for (var c = slides[i].children.length - 1; c >= 0; c--) {
      if (slides[i].children[c].tagName === 'ASIDE') { aside = slides[i].children[c]; break; }
    }
    notesText.textContent = aside ? aside.textContent.trim() : '(no notes on this slide)';
    if (location.hash !== '#' + (i + 1)) history.replaceState(null, '', '#' + (i + 1));
  }

  function next() { show(cur + 1); }
  function prev() { show(cur - 1); }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': prev(); break;
      case 'Home': show(0); break;
      case 'End': show(slides.length - 1); break;
      case 'f': case 'F':
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
        break;
      case 'n': case 'N': document.body.classList.toggle('notes'); fit(); break;
      case 'Escape': document.body.classList.remove('notes'); fit(); break;
      default: return;
    }
    e.preventDefault();
  });

  stage.addEventListener('click', function (e) {
    var t = e.target;
    while (t && t !== stage) {
      if (t.tagName === 'A' || t.tagName === 'VIDEO' || t.tagName === 'BUTTON') return;
      t = t.parentNode;
    }
    if (e.clientX < window.innerWidth / 4) prev(); else next();
  });

  var touchX = null;
  document.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (dx < -50) next(); else if (dx > 50) prev();
  }, { passive: true });

  window.addEventListener('hashchange', function () { show(indexFromHash()); });
  window.addEventListener('resize', fit);

  var allVids = stage.querySelectorAll('video');
  for (var v = 0; v < allVids.length; v++) allVids[v].pause();

  fit();
  show(indexFromHash());
  hint.classList.add('show');
  setTimeout(function () { hint.classList.remove('show'); }, 5000);
})();
</script>
</body>
</html>
`;
}

const html = build();
if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== html) {
    console.error('deck/index.html is stale — run: node scripts/build-deck.js');
    process.exit(1);
  }
  console.log('deck/index.html is up to date');
} else {
  fs.writeFileSync(OUT, html);
  console.log('wrote deck/index.html (' + (html.length / 1024).toFixed(0) + ' KB)');
}
