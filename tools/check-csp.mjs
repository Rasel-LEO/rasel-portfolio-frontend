// Author: Rasel Al Mamun
// Fails if anything built into dist/ would break the production CSP (docs/security.md)
// or the Django mount: inline <script>/<style>, on*= handlers, style= attributes,
// javascript: URLs, resources loaded from other origins (HTML and CSS), or leftover
// template syntax in the HTML.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('check-csp: dist/ not found; run `npm run build` first.');
  process.exit(1);
}

function filesIn(dir, extensions) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(path, extensions);
    return extensions.some((ext) => entry.name.endsWith(ext)) ? [path] : [];
  });
}

// A tag's attribute list; quoted values may contain ">".
const attrs = String.raw`(?:[^>"']|"[^"]*"|'[^']*')*`;
const external = String.raw`["']?\s*(?:https?:)?//`;
const tag = (source) => new RegExp(source, 'gi');

const markupChecks = [
  [
    'inline <script> without src',
    tag(
      String.raw`<script\b(?![^>]*[\s/]src\s*=)(?![^>]*type\s*=\s*["']?application/ld\+json)${attrs}>`,
    ),
  ],
  ['inline <style> element', /<style\b[^>]*>/gi],
  ['on* event handler attribute', tag(String.raw`<[a-z]${attrs}[\s/]on[a-z]+\s*=`)],
  ['style= attribute', tag(String.raw`<[a-z]${attrs}[\s/]style\s*=`)],
  ['javascript: URL', /[\s/](?:href|src|action|formaction|xlink:href)\s*=\s*["']?\s*javascript:/gi],
  ['data: script', /<script\b[^>]*[\s/]src\s*=\s*["']?\s*data:/gi],
  [
    'external script/media/frame/form URL',
    tag(
      String.raw`<(?:script|img|source|iframe|video|audio|track|embed|object|form)\b${attrs}[\s/](?:src|srcset|data|action|poster)\s*=\s*${external}`,
    ),
  ],
  [
    'external <link> resource',
    tag(
      String.raw`<link\b(?![^>]*rel\s*=\s*["']?(?:canonical|alternate|me|author)\b)${attrs}[\s/]href\s*=\s*${external}`,
    ),
  ],
];
const htmlOnlyChecks = [['template syntax', /\{\{|\{%|\{#/g]];
const cssChecks = [
  ['CSS @import', /@import\b/gi],
  ['external CSS url()', /url\(\s*["']?\s*(?:https?:)?\/\//gi],
];

const groups = [
  [filesIn(dist, ['.html']), [...markupChecks, ...htmlOnlyChecks]],
  [filesIn(dist, ['.svg']), markupChecks],
  [filesIn(dist, ['.css']), cssChecks],
];

const problems = [];
let count = 0;

// The one classic script (FD-12) is external, so script-src 'self' allows it. It must stay
// tiny and free of eval-like code, and every page must load it first in <head>.
const themeInit = join(dist, 'js', 'theme-init.js');
if (!existsSync(themeInit)) {
  problems.push('dist/js/theme-init.js missing');
} else {
  const source = readFileSync(themeInit, 'utf8');
  if (Buffer.byteLength(source) > 1024) problems.push('dist/js/theme-init.js is over 1 KB');
  if (/\beval\s*\(|new\s+Function\b|\bimport\s*[({]/.test(source)) {
    problems.push('dist/js/theme-init.js uses eval, Function or import');
  }
}
for (const file of filesIn(dist, ['.html'])) {
  const head = readFileSync(file, 'utf8').match(/<head>\s*(<[^>]*>)/i)?.[1] ?? '';
  // Any URL prefix is allowed so Django's {% static %} path still passes.
  if (!/^<script\s+src="[^"]*\/js\/theme-init\.js"\s*>$/.test(head)) {
    problems.push(`${relative(root, file)}: theme-init.js is not the first element in <head>`);
  }
}
for (const [files, checks] of groups) {
  for (const file of files) {
    count += 1;
    const text = readFileSync(file, 'utf8');
    for (const [label, pattern] of checks) {
      for (const match of text.matchAll(pattern)) {
        const line = text.slice(0, match.index).split('\n').length;
        problems.push(`${relative(root, file)}:${line} ${label}: ${match[0].slice(0, 80)}`);
      }
    }
  }
}

if (problems.length) {
  console.error(`check-csp: ${problems.length} problem(s)\n${problems.join('\n')}`);
  process.exit(1);
}
console.log(`check-csp: ${count} HTML/SVG/CSS files clean`);
