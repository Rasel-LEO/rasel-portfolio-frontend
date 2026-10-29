// Author: Rasel Al Mamun
// A tiny static server that stands in for the Django site when proving the Django test target
// (FD-137, docs/testing-django.md): it serves a Django build (default dist-django/) under the
// Django URLs of tests/pages.js, its assets under /static/frontend/, and the 404 page with status
// 404 for any other path, with the page links rewritten to the Django URLs as the Django templates
// write them. It is not Django: it has no forms backend, and it serves no post page.
//
//   node tools/serve-django-paths.mjs [dir] [port]      (default: dist-django 8001)
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

process.env.TEST_TARGET = 'django';
const { pagePath, pages } = await import('../tests/pages.js');

const dir = resolve(process.argv[2] ?? 'dist-django');
const port = Number(process.argv[3] ?? 8001);
const base = '/static/frontend/';

// Django URL → the built page. The 404 page is not a URL, and neither are the post pages (the
// posts are drafts, which Django does not publish).
const byPath = new Map(
  pages.filter((file) => file !== '404.html').map((file) => [pagePath(file), file]),
);

// The Django templates write the Django URLs: the static build's page links are rewritten the same
// way, so link and navigation tests see what they would see on the real site.
const djangoLinks = (html) =>
  html.replace(/href="\/([a-z0-9-]+\.html)([?#][^"]*)?"/g, (link, file, rest = '') => {
    try {
      return `href="${pagePath(file)}${rest}"`;
    } catch {
      return link;
    }
  });
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
};

function send(response, status, file, headers = {}) {
  response.writeHead(status, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    ...headers,
  });
  const body = readFileSync(file);
  response.end(extname(file) === '.html' ? djangoLinks(body.toString('utf8')) : body);
}

createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith(base)) {
    const file = normalize(join(dir, url.pathname.slice(base.length)));
    if (file.startsWith(dir) && existsSync(file)) return send(response, 200, file);
    return send(response, 404, join(dir, '404.html'));
  }
  const withSlash = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
  if (request.method === 'GET' && withSlash !== url.pathname && byPath.has(withSlash)) {
    response.writeHead(301, { Location: withSlash + url.search });
    return response.end();
  }
  const file = request.method === 'GET' && byPath.get(url.pathname);
  if (file) return send(response, 200, join(dir, file));
  return send(response, 404, join(dir, '404.html'));
}).listen(port, '127.0.0.1', () => {
  console.log(`serving ${dir} under the Django URLs at http://127.0.0.1:${port}`);
});
