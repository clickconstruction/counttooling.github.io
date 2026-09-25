/*
 * scripts/lib/project-map.js — the facts under DECOMPOSITION_MAP.md, measured
 * instead of read.
 *
 * The 2026-07-30 decomposition map was written by agents reading every file to
 * count and cross-reference things a parser can count for free, and it went
 * stale within weeks (it said 44 feature files; there are 97). This module
 * measures the structural facts a decomposition decision rests on, so a person
 * or an agent reads only the code the facts point at:
 *
 *   - every first-party file: kind, line count, load order in the shell
 *   - the window.App registry as a graph: who registers each name, who reads
 *     it, which reads are guarded (optional hooks) and which run at LOAD time
 *   - which `state.*` fields each file reads and writes
 *   - which DOM ids each file binds, and the app/index.html modal that owns them
 *   - every named function over a size floor, with its app.js SECTION
 *   - which specs and node tests pin each file
 *   - churn since a baseline commit (default: the HEAD the last
 *     DECOMPOSITION_MAP.md was read at, so "what changed since the last map")
 *   - near-duplicate blocks across the browser code and the scripts
 *
 * Pure analysis over the working tree + git; no network, no browser. Parsing
 * uses espree (eslint's parser, already a devDependency through eslint).
 * scripts/build-projectmap.js is the CLI; its --check runs `invariants()`.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
let espree = null;
function parser() {
  if (!espree) espree = require(require.resolve('espree', { paths: [path.dirname(require.resolve('eslint/package.json'))] }));
  return espree;
}

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
function countLines(s) { let n = 0; for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) n++; return n; }
function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ' failed: ' + r.stderr);
  return r.stdout;
}

// ---------------------------------------------------------------- inventory

// The shell's script order: every first-party <script src> in app/index.html.
function shellScripts() {
  const html = read('app/index.html');
  const out = [];
  const re = /<script\b[^>]*\bsrc="\/([^"?]+)"/g;
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function listFiles() {
  const tracked = git(['ls-files']).split('\n').filter(Boolean);
  const onDisk = tracked.filter(exists);
  const js = onDisk.filter((f) => /\.js$/.test(f)
    && !f.startsWith('vendor/') && !f.startsWith('node_modules/') && !f.startsWith('guides/')
    && !f.startsWith('rules/') && !f.includes('/node_modules/'));
  const other = ['app/index.html', 'index.html', 'styles.css', 'marketing.css'].filter(exists);
  const edge = onDisk.filter((f) => f.startsWith('supabase/functions/') && /\.ts$/.test(f));
  return { js, other, edge };
}

function kindOf(file, shell) {
  const base = path.basename(file);
  if (file.startsWith('features/')) return 'feature';
  if (file === 'app.js') return 'core';
  if (file === 'report.js') return 'report';
  if (file === 'sw.js') return 'service-worker';
  if (file === 'render-worker.js') return 'worker';
  if (/\.spec\.js$/.test(base)) return 'spec';
  if (/\.test\.js$/.test(base)) return 'test';
  if (file.startsWith('scripts/')) return 'tooling';
  if (file.startsWith('supabase/')) return 'edge';
  if (/^(config|config\.example|config\.local)\.js$/.test(base)) return 'config';
  if (/(eslint|playwright)[^/]*\.config\.js$/.test(base)) return 'tooling';
  if (shell.includes(file)) {
    const src = read(file);
    return /\bfunction create[A-Z]\w*\s*\(/.test(src) ? 'seam-module' : 'pure-module';
  }
  if (!file.includes('/')) return 'helper';   // spec helpers, cloud-test-helpers.js, takeoff-eval.js
  return 'other';
}

// ---------------------------------------------------------------- AST walk

function parse(src, file) {
  const opts = { ecmaVersion: 'latest', loc: true, range: true, comment: false };
  try { return parser().parse(src, Object.assign({ sourceType: 'script' }, opts)); } catch (e1) {
    try { return parser().parse(src, Object.assign({ sourceType: 'module' }, opts)); } catch (e2) {
      throw new Error(file + ': ' + e1.message);
    }
  }
}

function walk(node, visit, parent, stack) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent, stack);
  stack.push(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const v = node[key];
    if (Array.isArray(v)) { for (const c of v) if (c && typeof c.type === 'string') walk(c, visit, node, stack); }
    else if (v && typeof v.type === 'string') walk(v, visit, node, stack);
  }
  stack.pop();
}

const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const MUTATORS = new Set(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'set', 'delete', 'clear', 'add', 'fill']);

// Is `e` the App registry object? `App`, `window.App`, or a local alias the
// file under analysis declared (`const A = window.App;`), collected per file
// into appAliases before the walk.
let appAliases = new Set();
function isApp(e) {
  if (!e) return false;
  if (e.type === 'Identifier' && (e.name === 'App' || appAliases.has(e.name))) return true;
  // `(window.App = window.App || {}).x = …` — the self-bootstrapping publish.
  if (e.type === 'AssignmentExpression' && isApp(e.left)) return true;
  return e.type === 'MemberExpression' && !e.computed && e.object.type === 'Identifier'
    && e.object.name === 'window' && e.property.name === 'App';
}
// Is `e` the state object? `state`, `App.state`, a seam module's
// `ctx.getState()`, or a file's own alias of one of those: `const st = App.state`
// (an identifier alias) or `const S = () => App.state` (a getter, used as `S()`).
function isStateBase(e) {
  if (!e) return false;
  if (e.type === 'MemberExpression' && !e.computed && isApp(e.object) && e.property.name === 'state') return true;
  return e.type === 'CallExpression' && !e.arguments.length && e.callee.type === 'MemberExpression' && !e.callee.computed
    && e.callee.object.type === 'Identifier' && e.callee.object.name === 'ctx' && e.callee.property.name === 'getState';
}
function stateAliases(ast) {
  const names = new Set(['state']);
  const getters = new Set();
  walk(ast, (node) => {
    if (node.type !== 'VariableDeclarator' || node.id.type !== 'Identifier' || !node.init) return;
    if (isStateBase(node.init)) names.add(node.id.name);
    else if (node.init.type === 'ArrowFunctionExpression' && !node.init.params.length && isStateBase(node.init.body)) getters.add(node.id.name);
  }, null, []);
  return { names, getters };
}
function isState(e, aliases) {
  if (!e) return false;
  if (e.type === 'Identifier') return aliases ? aliases.names.has(e.name) : e.name === 'state';
  if (isStateBase(e)) return true;
  return !!aliases && e.type === 'CallExpression' && !e.arguments.length && e.callee.type === 'Identifier' && aliases.getters.has(e.callee.name);
}

// Nearest ancestor chain root: walk up through member/call chains and see
// whether the chain is written (assignment LHS, ++/--, delete, or a mutator call).
function isWriteChain(node, stack) {
  let cur = node;
  for (let i = stack.length - 1; i >= 0; i--) {
    const p = stack[i];
    if (p.type === 'MemberExpression' && p.object === cur) { cur = p; continue; }
    if (p.type === 'ChainExpression') { cur = p; continue; }
    if (p.type === 'AssignmentExpression' && p.left === cur) return true;
    if (p.type === 'UpdateExpression') return true;
    if (p.type === 'UnaryExpression' && p.operator === 'delete') return true;
    if (p.type === 'CallExpression' && p.callee === cur && cur !== node && cur.type === 'MemberExpression'
      && !cur.computed && MUTATORS.has(cur.property.name)) return true;
    return false;
  }
  return false;
}

// Does `expr` contain a read of App.<name>?
function mentionsApp(expr, name) {
  let hit = false;
  walk(expr, (n) => { if (!hit && n.type === 'MemberExpression' && !n.computed && n.property.name === name && isApp(n.object)) hit = true; }, null, []);
  return hit;
}
// Is this App.X read guarded (an optional hook)? `App.x && …`, `if (App.x)`,
// `App.x ? … : …`, `typeof App.x`, `App.x?.()`, `App.x || fallback`, and the
// call under such a test: `A && A.x && A.x()`, `if (App.x) App.x()`.
function isGuarded(node, parent, stack) {
  if (!parent) return false;
  const name = node.property.name;
  for (let i = stack.length - 1; i >= 0; i--) {
    const a = stack[i];
    const child = stack[i + 1] || node;
    if (a.type === 'LogicalExpression' && (a.left === child || (a.operator === '&&' && mentionsApp(a.left, name)))) return true;
    if ((a.type === 'IfStatement' || a.type === 'ConditionalExpression') && (a.test === child || (a.test !== child && mentionsApp(a.test, name)))) return true;
    if (FN_TYPES.has(a.type)) break;
  }
  if (parent.type === 'LogicalExpression' && parent.left === node) return true;
  if ((parent.type === 'IfStatement' || parent.type === 'ConditionalExpression') && parent.test === node) return true;
  if (parent.type === 'UnaryExpression' && (parent.operator === 'typeof' || parent.operator === '!')) return true;
  if (parent.type === 'CallExpression' && parent.callee === node && parent.optional) return true;
  if (parent.type === 'MemberExpression' && parent.object === node && parent.optional) return true;
  return false;
}

// Function depth: how many enclosing functions. A feature file / app.js is one
// IIFE, so depth <= 1 there is module-load time; a bare classic script is depth 0.
function fnDepth(stack) { let d = 0; for (const n of stack) if (FN_TYPES.has(n.type)) d++; return d; }
function isIifeFile(ast) {
  const body = ast.body.filter((s) => !(s.type === 'ExpressionStatement' && s.directive));
  if (body.length !== 1 || body[0].type !== 'ExpressionStatement') return false;
  let e = body[0].expression;
  if (e.type === 'UnaryExpression') e = e.argument;
  return e.type === 'CallExpression' && FN_TYPES.has(e.callee.type);
}

// A readable name for an expression used as a handler's target:
// `el` -> el, `a.b` -> b, `document.getElementById('x')` -> #x.
function targetName(obj) {
  if (!obj) return '?';
  if (obj.type === 'Identifier') return obj.name;
  if (obj.type === 'ThisExpression') return 'this';
  if (obj.type === 'MemberExpression' && !obj.computed) return obj.property.name;
  if (obj.type === 'ChainExpression') return targetName(obj.expression);
  if (obj.type === 'LogicalExpression') return targetName(obj.left);   // (cWrapper || pdfCanvas)
  if (obj.type === 'CallExpression' && obj.arguments[0] && obj.arguments[0].type === 'Literal') {
    const a = String(obj.arguments[0].value);
    const c = obj.callee.type === 'MemberExpression' && !obj.callee.computed ? obj.callee.property.name : (obj.callee.type === 'Identifier' ? obj.callee.name : '');
    if (c === 'getElementById' || c === 'el') return '#' + a;
    if (c === 'querySelector') return a;
  }
  return '?';
}
function fnName(node, parent) {
  if (node.id && node.id.name) return node.id.name;
  if (!parent) return null;
  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') return parent.id.name;
  if (parent.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression' && !parent.left.computed) {
    return targetName(parent.left.object) + '.' + parent.left.property.name;
  }
  // el.addEventListener('keydown', () => { … }) -> "document:keydown"; the
  // input layer's biggest handlers are anonymous listeners like this.
  if (parent.type === 'CallExpression' && parent.arguments.includes(node) && parent.callee.type === 'MemberExpression'
    && !parent.callee.computed && parent.callee.property.name === 'addEventListener'
    && parent.arguments[0] && parent.arguments[0].type === 'Literal') {
    return targetName(parent.callee.object) + ':' + parent.arguments[0].value;
  }
  if (parent.type === 'Property' && !parent.computed && parent.key) return parent.key.name || parent.key.value || null;
  if (parent.type === 'MethodDefinition' && parent.key) return parent.key.name || null;
  return null;
}

function analyzeJs(file, src, fnFloor) {
  const ast = parse(src, file);
  appAliases = new Set();
  walk(ast, (node) => {
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name !== 'App' && isApp(node.init)) appAliases.add(node.id.name);
  }, null, []);
  const iife = isIifeFile(ast);
  const aliases = stateAliases(ast);
  const loadDepth = iife ? 1 : 0;
  const registers = new Map();      // name -> first line
  const reads = new Map();          // name -> { n, guarded, loadTime:boolean, lines:[] }
  const stateReads = new Map();
  const stateWrites = new Map();
  const domIds = new Map();
  const functions = [];
  const bump = (m, k, line) => { const v = m.get(k) || { n: 0, lines: [] }; v.n++; if (v.lines.length < 3) v.lines.push(line); m.set(k, v); };

  walk(ast, (node, parent, stack) => {
    const line = node.loc.start.line;
    if (FN_TYPES.has(node.type)) {
      const name = fnName(node, parent);
      const span = node.loc.end.line - node.loc.start.line + 1;
      if (name && span >= fnFloor) functions.push({ name, start: node.loc.start.line, end: node.loc.end.line, lines: span, depth: fnDepth(stack) });
      return;
    }
    // Object.assign(App, { a, b })
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed
      && node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object'
      && node.callee.property.name === 'assign' && isApp(node.arguments[0])) {
      for (const a of node.arguments.slice(1)) if (a.type === 'ObjectExpression') {
        for (const p of a.properties) if (p.type === 'Property' && !p.computed && p.key) registers.set(p.key.name || p.key.value, line);
      }
    }
    // const { a, b } = App
    if (node.type === 'VariableDeclarator' && isApp(node.init) && node.id.type === 'ObjectPattern') {
      const loadTime = fnDepth(stack) <= loadDepth;
      for (const p of node.id.properties) if (p.type === 'Property' && !p.computed && p.key) {
        const k = p.key.name;
        const v = reads.get(k) || { n: 0, guarded: false, loadTime: false, lines: [] };
        v.n++; v.loadTime = v.loadTime || loadTime; if (v.lines.length < 3) v.lines.push(line); reads.set(k, v);
      }
    }
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
      if (isApp(node.object)) {
        const k = node.property.name;
        if (parent && parent.type === 'AssignmentExpression' && parent.left === node) {
          // `App.x = null` resets a slot someone else owns; it registers nothing.
          const nullish = parent.right.type === 'Literal' && parent.right.value === null
            || parent.right.type === 'Identifier' && parent.right.name === 'undefined';
          if (!nullish && !registers.has(k)) registers.set(k, line);
        } else if (k !== 'state' || !(parent && parent.type === 'MemberExpression' && parent.object === node)) {
          const v = reads.get(k) || { n: 0, guarded: false, loadTime: false, lines: [] };
          v.n++;
          if (isGuarded(node, parent, stack)) v.guarded = true;
          if (fnDepth(stack) <= loadDepth) v.loadTime = true;
          if (v.lines.length < 3) v.lines.push(line);
          reads.set(k, v);
        }
      }
      if (isState(node.object, aliases)) {
        const k = node.property.name;
        bump(isWriteChain(node, stack) ? stateWrites : stateReads, k, line);
      }
    }
    if (node.type === 'CallExpression' && node.arguments.length && node.arguments[0].type === 'Literal'
      && typeof node.arguments[0].value === 'string') {
      const c = node.callee;
      const arg = node.arguments[0].value;
      const cname = c.type === 'MemberExpression' && !c.computed ? c.property.name : (c.type === 'Identifier' ? c.name : '');
      if (cname === 'getElementById' || cname === 'el' || cname === '$id') bump(domIds, arg, line);
      else if ((cname === 'querySelector' || cname === 'querySelectorAll') && /^#[\w-]+/.test(arg)) bump(domIds, arg.match(/^#([\w-]+)/)[1], line);
    }
  }, null, []);

  const obj = (m) => Object.fromEntries([...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
  return {
    iife,
    registers: obj(registers),
    reads: obj(reads),
    stateReads: obj(new Map([...stateReads].map(([k, v]) => [k, v.n]))),
    stateWrites: obj(new Map([...stateWrites].map(([k, v]) => [k, v.n]))),
    domIds: obj(new Map([...domIds].map(([k, v]) => [k, v.n]))),
    functions: functions.sort((a, b) => a.start - b.start),
  };
}

// ---------------------------------------------------------------- app.js sections

function sections(src) {
  const lines = src.split('\n');
  const out = [];
  lines.forEach((l, i) => {
    const m = l.match(/^\s*\/\/ SECTION:\s*(.+)$/);
    if (m) out.push({ name: m[1].trim(), start: i + 1 });
  });
  out.forEach((s, i) => { s.end = i + 1 < out.length ? out[i + 1].start - 1 : lines.length; s.lines = s.end - s.start + 1; });
  return out;
}

// ---------------------------------------------------------------- shell modals

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'use', 'stop']);
function shellModals(html) {
  // Blank out comments and script bodies, keeping newlines so lines stay true.
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const clean = html.replace(/<!--[\s\S]*?-->/g, blank).replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g, (m, a, b, c) => a + blank(b) + c);
  const lineAt = (() => { const starts = [0]; for (let i = 0; i < clean.length; i++) if (clean[i] === '\n') starts.push(i + 1); return (idx) => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= idx) lo = mid; else hi = mid - 1; } return lo + 1; }; })();
  const stack = [];
  const modals = {};
  const idOwner = {};
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = re.exec(clean))) {
    const [, close, tagRaw, attrs] = m;
    const tag = tagRaw.toLowerCase();
    const line = lineAt(m.index);
    if (close) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          const [el] = stack.splice(i);
          if (el.modal) modals[el.modal].end = line;
          break;
        }
      }
      continue;
    }
    const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
    const cls = (attrs.match(/\bclass="([^"]+)"/) || [])[1] || '';
    const isModal = id && /(^|\s)modal-overlay(\s|$)/.test(cls);
    const owner = [...stack].reverse().find((e) => e.modal);
    if (id) idOwner[id] = owner ? owner.modal : null;
    if (isModal) modals[id] = { start: line, end: null, ids: [] };
    if (id && owner) modals[owner.modal].ids.push(id);
    const selfClose = /\/\s*$/.test(attrs) || VOID.has(tag);
    if (!selfClose) stack.push({ tag, modal: isModal ? id : null });
  }
  for (const k of Object.keys(modals)) modals[k].lines = modals[k].end ? modals[k].end - modals[k].start + 1 : null;
  return { modals, idOwner };
}

// ---------------------------------------------------------------- CSS

function cssByModal(css, modalIds) {
  // Count the lines of each rule whose selector names #<modalId>.
  // A block stack: each `{` opens a block whose selector is the text since the
  // last `{`, `}` or `;`; `}` closes it into a span. @media blocks become spans
  // too, but their selector never names an id, so they never count.
  const out = {};
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  const lines = noComments.split('\n');
  const open = [];
  const ruleSpans = [];
  let buf = '';
  for (let i = 0; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { open.push({ sel: buf.trim(), start: i + 1 }); buf = ''; }
      else if (ch === '}') { const b = open.pop(); if (b) ruleSpans.push({ sel: b.sel, start: b.start, end: i + 1 }); buf = ''; }
      else if (ch === ';') buf = '';
      else buf += ch;
    }
    buf += '\n';
  }
  for (const id of modalIds) {
    const re = new RegExp('#' + id + '(?![\\w-])');
    let n = 0;
    for (const r of ruleSpans) if (re.test(r.sel)) n += r.end - r.start + 1;
    if (n) out[id] = n;
  }
  return out;
}

function cssBanners(css) {
  const out = [];
  css.split('\n').forEach((l, i) => {
    const m = l.match(/^\/\* -{2,}\s*(.+?)\s*-{2,}/) || l.match(/^\/\* ={2,}\s*(.+?)\s*={0,}\s*\*\//);
    if (m) out.push({ name: m[1], start: i + 1 });
  });
  const total = countLines(css);
  out.forEach((b, i) => { b.end = i + 1 < out.length ? out[i + 1].start - 1 : total; b.lines = b.end - b.start + 1; });
  return out;
}

// ---------------------------------------------------------------- duplicates

// Near-duplicate blocks: normalize (drop blanks, comments, lone punctuation,
// collapse whitespace), hash windows of W normalized lines, then extend each
// shared window pair along its diagonal into a maximal run. Windows shared by
// more than MAX_OCC places are boilerplate and skipped (and counted).
function duplicates(filesSrc, { W = 6, MIN = 8, MAX_OCC = 6 } = {}) {
  const norm = {};
  for (const [file, src] of Object.entries(filesSrc)) {
    const rows = [];
    let inBlock = false;
    src.split('\n').forEach((raw, i) => {
      let l = raw.trim();
      if (inBlock) { if (l.includes('*/')) inBlock = false; return; }
      if (l.startsWith('/*')) { if (!l.includes('*/')) inBlock = true; return; }
      if (!l || l.startsWith('//') || l.startsWith('*')) return;
      if (/^[\s{}()[\];,]*$/.test(l)) return;
      // Copies that differ only in how they reach the state object are the
      // same code: App.state.x / ctx.getState().x / S().x all read as state.x.
      l = l.replace(/\s+/g, ' ').replace(/\b(?:App\.state|ctx\.getState\(\)|S\(\))\./g, 'state.');
      rows.push({ t: l, line: i + 1 });
    });
    norm[file] = rows;
  }
  const idx = new Map();
  for (const [file, rows] of Object.entries(norm)) {
    for (let i = 0; i + W <= rows.length; i++) {
      const key = rows.slice(i, i + W).map((r) => r.t).join('\n');
      if (key.length < 120) continue;   // a window of tiny lines is not worth a finding
      const arr = idx.get(key) || [];
      arr.push([file, i]);
      idx.set(key, arr);
    }
  }
  let boilerplate = 0;
  const pairs = new Set();
  const runs = [];
  for (const occ of idx.values()) {
    if (occ.length < 2) continue;
    if (occ.length > MAX_OCC) { boilerplate++; continue; }
    for (let a = 0; a < occ.length; a++) for (let b = a + 1; b < occ.length; b++) {
      let [fa, ia] = occ[a], [fb, ib] = occ[b];
      if (fa === fb && Math.abs(ia - ib) < W) continue;    // overlapping self-match
      // Walk back to the run's start so each run is found once.
      while (ia > 0 && ib > 0 && norm[fa][ia - 1].t === norm[fb][ib - 1].t && !(fa === fb && ia - 1 === ib)) { ia--; ib--; }
      const key = fa + ':' + ia + '|' + fb + ':' + ib;
      if (pairs.has(key)) continue;
      pairs.add(key);
      let len = 0;
      while (ia + len < norm[fa].length && ib + len < norm[fb].length && norm[fa][ia + len].t === norm[fb][ib + len].t
        && !(fa === fb && ia + len === ib)) len++;
      if (len < MIN) continue;
      runs.push({
        normLines: len,
        a: { file: fa, start: norm[fa][ia].line, end: norm[fa][ia + len - 1].line },
        b: { file: fb, start: norm[fb][ib].line, end: norm[fb][ib + len - 1].line },
        sample: norm[fa].slice(ia, ia + 3).map((r) => r.t).join(' ⏎ ').slice(0, 160),
      });
    }
  }
  runs.sort((x, y) => y.normLines - x.normLines || (x.a.file < y.a.file ? -1 : 1));
  return { runs, boilerplateWindows: boilerplate, window: W, minLines: MIN };
}

// ---------------------------------------------------------------- git churn

// The baseline is the commit the last map READ, which DECOMPOSITION_MAP.md
// records as `<!-- project-map-head: <sha> -->`; a later typo fix to the map
// must not move it. Without the marker, the last commit that touched the map.
function baselineRef(explicit) {
  if (explicit) return git(['rev-parse', explicit]).trim();
  if (exists('DECOMPOSITION_MAP.md')) {
    const m = read('DECOMPOSITION_MAP.md').match(/<!-- project-map-head: ([0-9a-f]{7,40}) -->/);
    if (m) return git(['rev-parse', m[1]]).trim();
  }
  const sha = git(['log', '-1', '--format=%H', '--', 'DECOMPOSITION_MAP.md']).trim();
  return sha || null;
}
function churn(baseline) {
  if (!baseline) return {};
  const out = {};
  const numstat = git(['diff', '--numstat', '--no-renames', baseline, 'HEAD']);
  for (const l of numstat.split('\n')) {
    const m = l.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m) continue;
    out[m[3]] = { added: m[1] === '-' ? 0 : +m[1], deleted: m[2] === '-' ? 0 : +m[2], commits: 0 };
  }
  const log = git(['log', '--no-merges', '--no-renames', '--format=%x00', '--name-only', baseline + '..HEAD']);
  for (const block of log.split('\x00')) {
    for (const f of block.split('\n').map((s) => s.trim()).filter(Boolean)) {
      out[f] = out[f] || { added: 0, deleted: 0, commits: 0 };
      out[f].commits++;
    }
  }
  return out;
}

// ---------------------------------------------------------------- build

function build({ since, fnFloor = 20, skipDuplicates = false } = {}) {
  const shell = shellScripts();
  const { js, other, edge } = listFiles();
  const baseline = baselineRef(since);
  const ch = churn(baseline);
  const files = {};
  const srcs = {};
  for (const f of js) {
    const src = read(f);
    srcs[f] = src;
    const kind = kindOf(f, shell);
    const rec = { kind, lines: countLines(src), loadIndex: shell.indexOf(f) };
    if (!['spec', 'test', 'config'].includes(kind)) Object.assign(rec, analyzeJs(f, src, fnFloor));
    if (f === 'app.js') rec.sections = sections(src);
    files[f] = rec;
  }
  for (const f of other) { srcs[f] = read(f); files[f] = { kind: f.endsWith('.css') ? 'css' : 'html', lines: countLines(srcs[f]), loadIndex: -1 }; }
  for (const f of edge) files[f] = { kind: 'edge', lines: countLines(read(f)), loadIndex: -1 };
  for (const [f, rec] of Object.entries(files)) {
    const c = ch[f];
    rec.churn = c ? { commits: c.commits, added: c.added, deleted: c.deleted, linesAtBaseline: rec.lines - c.added + c.deleted } : { commits: 0, added: 0, deleted: 0, linesAtBaseline: rec.lines };
  }

  // Registry graph.
  const browser = Object.keys(files).filter((f) => ['core', 'feature', 'report', 'pure-module', 'seam-module'].includes(files[f].kind));
  const registry = {};
  const reg = (name) => (registry[name] = registry[name] || { registeredBy: [], readBy: {}, guardedEverywhere: true });
  for (const f of browser) {
    for (const name of Object.keys(files[f].registers || {})) reg(name).registeredBy.push(f);
    for (const [name, r] of Object.entries(files[f].reads || {})) {
      const e = reg(name);
      e.readBy[f] = r.n;
      if (!r.guarded) e.guardedEverywhere = false;
    }
  }
  // Who else reads each name: specs (spec seams are live, not dead) and the
  // Node drivers under scripts/ (build-screenshots, build-hero-video).
  const nameReaders = (kind) => {
    const out = {};
    for (const f of Object.keys(files).filter((x) => files[x].kind === kind)) {
      const re = /\bApp\.([A-Za-z_$][\w$]*)/g;
      let mm;
      const seen = new Set();
      while ((mm = re.exec(srcs[f]))) seen.add(mm[1]);
      for (const n of seen) (out[n] = out[n] || []).push(f);
    }
    return out;
  };
  const specReaders = nameReaders('spec');
  const toolReaders = nameReaders('tooling');
  for (const [name, e] of Object.entries(registry)) {
    e.specReaders = (specReaders[name] || []).length;
    e.toolReaders = (toolReaders[name] || []).length;
    const others = Object.keys(e.readBy).filter((r) => !e.registeredBy.includes(r));
    e.unread = e.registeredBy.length > 0 && !others.length && !e.specReaders && !e.toolReaders;
  }
  const edges = {};
  for (const [name, e] of Object.entries(registry)) {
    for (const reader of Object.keys(e.readBy)) for (const owner of e.registeredBy) {
      if (owner === reader) continue;
      const k = reader + ' -> ' + owner;
      (edges[k] = edges[k] || []).push(name);
    }
  }
  const edgeList = Object.entries(edges).map(([k, names]) => { const [from, to] = k.split(' -> '); return { from, to, n: names.length, names: names.sort() }; })
    .sort((a, b) => b.n - a.n || (a.from < b.from ? -1 : 1));

  // Per-file coupling summary.
  for (const f of browser) {
    const r = files[f];
    r.fanOut = edgeList.filter((e) => e.from === f).map((e) => ({ to: e.to, n: e.n }));
    r.fanIn = edgeList.filter((e) => e.to === f).map((e) => ({ from: e.from, n: e.n }));
  }

  // Shell modals -> the files that bind their ids.
  const { modals, idOwner } = shellModals(srcs['app/index.html']);
  const css = srcs['styles.css'] || '';
  const cssLines = cssByModal(css, Object.keys(modals));
  for (const [id, mdl] of Object.entries(modals)) {
    const binders = {};
    const want = new Set([id, ...mdl.ids]);
    for (const f of browser) {
      const ids = files[f].domIds || {};
      let n = 0;
      for (const k of Object.keys(ids)) if (want.has(k)) n += ids[k];
      if (n) binders[f] = n;
    }
    mdl.boundBy = binders;
    mdl.cssLines = cssLines[id] || 0;
    mdl.idCount = mdl.ids.length;
    delete mdl.ids;
  }
  for (const f of browser) {
    const owned = {};
    const own = srcs[f];
    for (const k of Object.keys(files[f].domIds || {})) {
      const madeHere = own.includes('id="' + k + '"') || own.includes("id='" + k + "'") || own.includes(".id = '" + k + "'") || own.includes('.id = "' + k + '"');
      const o = k in idOwner ? (idOwner[k] || '(shell chrome)') : (modals[k] ? k : (madeHere ? '(created at runtime)' : '(not in shell: ' + k + ')'));
      owned[o] = (owned[o] || 0) + 1;
    }
    files[f].domByModal = owned;
  }

  // Specs + node tests that pin each source file.
  const specs = Object.keys(files).filter((f) => files[f].kind === 'spec');
  const tests = Object.keys(files).filter((f) => files[f].kind === 'test');
  const specSrc = Object.fromEntries(specs.map((s) => [s, srcs[s]]));
  const testSrc = Object.fromEntries(tests.map((s) => [s, srcs[s]]));
  for (const f of browser.concat(Object.keys(files).filter((f) => files[f].kind === 'tooling'))) {
    const base = path.basename(f, '.js');
    const names = Object.keys(files[f].registers || {}).filter((n) => n.length > 5 && !n.startsWith('on'));
    const pins = [];
    for (const [s, src] of Object.entries(specSrc)) {
      const byName = path.basename(s) === base + '.spec.js';
      const byPath = src.includes(f);
      const hits = names.filter((n) => src.includes('App.' + n)).length;
      if (byName || byPath || hits >= 2) pins.push({ spec: s, byName, byPath, apiHits: hits });
    }
    files[f].specs = pins.sort((a, b) => (b.byName - a.byName) || (b.apiHits - a.apiHits));
    files[f].tests = Object.entries(testSrc).filter(([, src]) => src.includes("'./" + f + "'") || src.includes('"./' + f + '"') || src.includes("'../" + f + "'") || src.includes("require('./" + base + "')")).map(([t]) => t);
  }

  // Duplicates across browser code + tooling (specs/tests excluded: their
  // shared setup is deliberate and would drown the signal).
  const dupSrc = {};
  for (const f of Object.keys(files)) if (['core', 'feature', 'report', 'pure-module', 'seam-module', 'worker', 'tooling'].includes(files[f].kind)
    && !['icons.js', 'icons-custom.js'].includes(f)) dupSrc[f] = srcs[f];
  const dups = skipDuplicates ? { runs: [], boilerplateWindows: 0, window: 0, minLines: 0, skipped: true } : duplicates(dupSrc);

  return {
    schema: 'clickcount-project-map/v1',
    head: git(['rev-parse', 'HEAD']).trim(),
    baseline,
    shellOrder: shell,
    files,
    registry,
    edges: edgeList,
    modals,
    cssBanners: cssBanners(css),
    duplicates: dups,
  };
}

// ---------------------------------------------------------------- invariants

// Structural rules that must hold on every commit. These are the checks, not
// the counts: the counts change with every edit and live in the generated map.
function invariants(map) {
  const problems = [];
  const arch = read('ARCHITECTURE.md');
  const rowFiles = new Set();
  for (const l of arch.split('\n')) {
    if (!l.startsWith('| ')) continue;
    const firstCell = l.split(' | ')[0];
    const re = /\]\(([^)]+)\)/g;
    let m;
    while ((m = re.exec(firstCell))) rowFiles.add(m[1]);
  }
  // 1. Every first-party shell script and feature file has a Files-table row.
  const shellFirstParty = map.shellOrder.filter((f) => !f.startsWith('vendor/') && !/^config(\.local)?\.js$/.test(f));
  for (const f of new Set(shellFirstParty.concat(Object.keys(map.files).filter((f) => map.files[f].kind === 'feature')))) {
    if (!rowFiles.has(f)) problems.push('ARCHITECTURE.md Files table has no row for ' + f + ' (a row whose first cell links [' + f + '](' + f + ')).');
  }
  // 2. A LOAD-time App read must be registered by a file that loads earlier
  //    (the D1 prepare-pdf bug: a destructure of names a later script registers).
  const order = map.shellOrder;
  for (const [f, rec] of Object.entries(map.files)) {
    if (rec.kind !== 'feature' && rec.kind !== 'core' && rec.kind !== 'report') continue;
    for (const [name, r] of Object.entries(rec.reads || {})) {
      if (!r.loadTime || r.guarded) continue;
      const owners = (map.registry[name] || {}).registeredBy || [];
      if (!owners.length) continue;   // rule 3's business
      const earliest = Math.min(...owners.map((o) => order.indexOf(o)).filter((i) => i >= 0));
      if (!(earliest < order.indexOf(f)) && !owners.includes(f)) {
        problems.push(f + ':' + r.lines[0] + ' reads App.' + name + ' at load time, but it is registered by ' + owners.join(', ') + ', which loads later. Read it inside the function that uses it.');
      }
    }
  }
  // 3. An unguarded App read names something some browser file registers.
  for (const [name, e] of Object.entries(map.registry)) {
    if (e.registeredBy.length || e.guardedEverywhere) continue;
    const where = Object.keys(e.readBy).map((f) => f + ':' + map.files[f].reads[name].lines[0]).join(', ');
    problems.push('App.' + name + ' is read unguarded (' + where + ') but nothing registers it.');
  }
  return problems;
}

module.exports = { build, invariants, analyzeJs, shellModals, duplicates, sections };
