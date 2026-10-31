// Author: Rasel Al Mamun
// Checks the Django build target (FD-133) against the static build: every asset URL sits under
// /static/frontend/, exists in dist-django/ and resolves by a source key from the Vite manifest
// or the asset map; js/theme-init.js is present; and each page's HTML equals the static page
// once the base is replaced by '/' and the hashes of the chunks that embed the base are removed.
// The root files of .vite/root-files.json (FD-139) are checked as well.
// Reads dist/ and dist-django/ (npm test builds both first).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const django = join(root, 'dist-django');
const base = '/static/frontend/';

for (const [dir, command] of [
  [dist, 'npm run build'],
  [django, 'npm run build:django'],
]) {
  if (!existsSync(dir)) {
    console.error(`check-django-build: ${relative(root, dir)}/ not found; run \`${command}\`.`);
    process.exit(1);
  }
}

const problems = [];
const filesIn = (dir, ext) =>
  readdirSync(dir, { recursive: true })
    .map((file) => file.split('\\').join('/'))
    .filter((file) => file.endsWith(ext))
    .sort();
const read = (dir, file) => readFileSync(join(dir, file), 'utf8');
const readJson = (file) => (existsSync(join(django, file)) ? JSON.parse(read(django, file)) : {});

const manifest = readJson('.vite/manifest.json');
const assetMap = readJson('.vite/asset-map.json');
if (!Object.keys(manifest).length) problems.push('.vite/manifest.json missing or empty');
if (!existsSync(join(django, 'js/theme-init.js'))) problems.push('js/theme-init.js missing');

// Built path → the source keys that resolve it. Manifest keys starting with "_" name a chunk by
// its hashed file, not by a source path, so they do not count.
const sources = new Map();
const addSource = (file, key) => sources.set(file, [...(sources.get(file) ?? []), key]);
for (const [key, record] of Object.entries(manifest)) {
  if (key.startsWith('_')) continue;
  addSource(record.file, key);
  for (const css of record.css ?? []) addSource(css, key);
}
for (const [key, file] of Object.entries(assetMap)) addSource(file, `asset-map:${key}`);

// Source keys are paths in src/ (public/ for files copied as-is).
for (const key of [...Object.keys(manifest), ...Object.keys(assetMap)]) {
  if (key.startsWith('_')) continue;
  if (![join(root, 'src', key), join(root, 'public', key)].some(existsSync))
    problems.push(`source key ${key}: no such file in src/ or public/`);
}

const htmlFiles = filesIn(django, '.html');
const cssFiles = filesIn(join(django, 'assets'), '.css').map((file) => `assets/${file}`);
const urls = new Map();
for (const file of [...htmlFiles, ...cssFiles]) {
  const text = read(django, file);
  for (const match of text.matchAll(/(?<!\/static\/frontend)\/assets\//g))
    problems.push(`${file}: /assets/ outside ${base} at ${match.index}`);
  for (const [url] of text.matchAll(/\/static\/frontend\/[^"'\s),]+/g)) {
    const path = url.slice(base.length).replace(/[?#].*$/, '');
    urls.set(path, [...(urls.get(path) ?? []), file]);
  }
}
for (const [path, files] of urls) {
  if (!existsSync(join(django, path))) problems.push(`${path} (in ${files[0]}): file missing`);
  if (!sources.has(path)) problems.push(`${path} (in ${files[0]}): no source key`);
}

// FD-139: the root files (icons, manifest) Django serves at the site root as well. Each one listed
// in .vite/root-files.json sits at the build root, equals its public/ file and has an asset-map
// key; every icon or manifest link of the pages and every icon of the manifest is one of them.
const rootFiles = readJson('.vite/root-files.json');
if (!Array.isArray(rootFiles) || !rootFiles.length) problems.push('.vite/root-files.json missing');
const rootList = Array.isArray(rootFiles) ? rootFiles : [];
for (const file of rootList) {
  if (file.includes('/')) problems.push(`root file ${file}: not at the root`);
  else if (!existsSync(join(django, file))) problems.push(`root file ${file}: missing`);
  else if (!readFileSync(join(django, file)).equals(readFileSync(join(root, 'public', file))))
    problems.push(`root file ${file}: differs from public/${file}`);
  if (assetMap[file] !== file) problems.push(`root file ${file}: no asset-map key`);
}
for (const file of htmlFiles) {
  const links = read(django, file).matchAll(
    /<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g,
  );
  for (const [, href] of links) {
    if (!rootList.includes(href.replace(base, '')))
      problems.push(`${file}: ${href} is not a listed root file`);
  }
}
if (rootList.includes('site.webmanifest') && existsSync(join(django, 'site.webmanifest'))) {
  for (const icon of JSON.parse(read(django, 'site.webmanifest')).icons ?? []) {
    if (!icon.src.startsWith('/') || !rootList.includes(icon.src.slice(1)))
      problems.push(`site.webmanifest: icon ${icon.src} is not a listed root file`);
  }
}

// The two targets differ only in their base.
const unhash = (text) => text.replace(/(\/assets\/[\w.-]+?)-[\w-]{8}\.(js|css)\b/g, '$1.$2');
const staticHtml = filesIn(dist, '.html');
if (staticHtml.join() !== htmlFiles.join()) problems.push('dist/ and dist-django/ pages differ');
for (const file of htmlFiles.filter((file) => staticHtml.includes(file))) {
  if (unhash(read(django, file).replaceAll(base, '/')) !== unhash(read(dist, file)))
    problems.push(`${file}: differs from dist/${file} beyond the base`);
}

for (const problem of problems) console.error(`check-django-build: ${problem}`);
console.log(
  `check-django-build: ${htmlFiles.length} pages, ${urls.size} asset URLs, ` +
    `${Object.keys(manifest).length} manifest keys, ${Object.keys(assetMap).length} asset-map keys` +
    ` — ${problems.length ? `${problems.length} problems` : 'clean'}`,
);
if (problems.length) process.exit(1);
