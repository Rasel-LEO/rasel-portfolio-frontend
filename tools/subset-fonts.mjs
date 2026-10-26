// Author: Rasel Al Mamun
// One-time font subsetting (FD-130). Reads the latin woff2 files of the pinned @fontsource
// packages and writes woff2 files to src/fonts/ that keep only the characters the site uses:
// every character of the built pages (dist/, so run `npm run build` first), of the content
// sources and scripts (messages set at runtime), printable ASCII, common Latin-1 symbols,
// typographic punctuation and arrows. All variation axes,
// OpenType layout features and metrics are kept, so the rendering does not change.
// Usage: npm run build && node tools/subset-fonts.mjs. The output is committed; run again
// only when new text needs a character the subset lacks (tests/content.spec.js checks it).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const packageFiles = (name) => join(dirname(require.resolve(`${name}/package.json`)), 'files');
export const subsetList = 'src/fonts/subset.json';

const fonts = [
  {
    source: join(
      packageFiles('@fontsource-variable/bricolage-grotesque'),
      'bricolage-grotesque-latin-standard-normal.woff2',
    ),
    target: 'src/fonts/bricolage-grotesque-latin-standard-normal.woff2',
  },
  {
    source: join(
      packageFiles('@fontsource/jetbrains-mono'),
      'jetbrains-mono-latin-400-normal.woff2',
    ),
    target: 'src/fonts/jetbrains-mono-latin-400-normal.woff2',
  },
  {
    source: join(
      packageFiles('@fontsource/jetbrains-mono'),
      'jetbrains-mono-latin-500-normal.woff2',
    ),
    target: 'src/fonts/jetbrains-mono-latin-500-normal.woff2',
  },
];

// Every file below a folder whose name passes the filter.
function files(dir, keep) {
  return readdirSync(dir, { recursive: true })
    .map((file) => join(dir, String(file)))
    .filter((file) => statSync(file).isFile() && keep(file));
}

const range = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)).join('');

// The characters every subset keeps, whatever the current text uses.
export const baseCharacters = [
  range(0x20, 0x7e), // printable ASCII
  ' ©®°±·×÷§¶', // no-break space and common Latin-1 symbols
  '‐‑–—‘’‚“”„†•…‰′″‹›€™−', // punctuation and symbols
  '←↑→↓↗↘', // arrows
].join('');

// Every character the site's text uses (dist/ must be built).
export function siteCharacters() {
  const sources = [
    ...files(resolve(root, 'dist'), (file) => /\.(html|css|js)$/.test(file)),
    ...files(resolve(root, 'src/content'), (file) => /\.(json|md)$/.test(file)),
    ...files(resolve(root, 'src/js'), (file) => file.endsWith('.js')),
    ...files(resolve(root, 'src/partials'), (file) => file.endsWith('.hbs')),
    ...files(resolve(root, 'src/pages'), (file) => file.endsWith('.html')),
  ];
  const characters = new Set();
  for (const file of sources) {
    for (const character of readFileSync(file, 'utf8')) {
      if (character.codePointAt(0) >= 0x20) characters.add(character);
    }
  }
  return characters;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const characters = [...new Set([...baseCharacters, ...siteCharacters()])].sort(
    (a, b) => a.codePointAt(0) - b.codePointAt(0),
  );
  for (const { source, target } of fonts) {
    const input = readFileSync(source);
    const output = await subsetFont(input, characters.join(''), { targetFormat: 'woff2' });
    writeFileSync(resolve(root, target), output);
    console.log(
      `subset-fonts: ${target} ${(input.length / 1000).toFixed(1)} KB → ${(output.length / 1000).toFixed(1)} KB`,
    );
  }
  // The kept characters, for the coverage test (code points: digits would read as a number).
  const list = { codePoints: characters.map((character) => character.codePointAt(0)) };
  writeFileSync(resolve(root, subsetList), `${JSON.stringify(list)}\n`);
  console.log(`subset-fonts: ${characters.length} characters listed in ${subsetList}`);
}
