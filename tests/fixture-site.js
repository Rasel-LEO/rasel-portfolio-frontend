// Author: Rasel Al Mamun
// A static build of sample content (CONTENT_FIXTURE, vite.config.js) served by a tiny server that
// answers `/<list page>.html?<query>` like the preview does (tools/lists.mjs resolveState): the
// tests of the list pages with many items (tests/lists.spec.js). Built into .slots/<name>/.
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { buildSite } from '../tools/content.mjs';
import { resolveState } from '../tools/lists.mjs';

const root = resolve(import.meta.dirname, '..');
const slotsDir = join(root, '.slots');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

export function buildFixture(name, content) {
  const out = join(slotsDir, name);
  mkdirSync(slotsDir, { recursive: true });
  const fixture = join(slotsDir, `${name}.json`);
  writeFileSync(fixture, JSON.stringify(content));
  rmSync(out, { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out, '--emptyOutDir'],
    { cwd: root, env: { ...process.env, CONTENT_FIXTURE: fixture }, stdio: 'pipe' },
  );
  return out;
}

export function serveBuild(dir, content) {
  const site = buildSite(content);
  const server = createServer((req, res) => {
    const [rawPath, query = ''] = req.url.split('?');
    let path = decodeURIComponent(rawPath);
    if (query) path = `/${resolveState(path.slice(1), new URLSearchParams(query), site)}`;
    const file = join(dir, path === '/' ? 'index.html' : path);
    if (!file.startsWith(dir) || !existsSync(file)) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  });
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () =>
      done({ server, site, url: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}
