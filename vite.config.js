// Author: Rasel Al Mamun
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, normalizePath } from 'vite';
import handlebars from 'vite-plugin-handlebars';
import { buildSite, contentDir, doiUrl, loadContent, postsDir } from './tools/content.mjs';
import { escapeHtml, isBracketed } from './tools/markdown.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(root, 'src/pages');
const pages = new Set(readdirSync(pagesDir).filter((file) => file.endsWith('.html')));

// Site content (FD-19), loaded once; every page gets it as its Handlebars context.
// SHOW_DRAFTS (FD-36, default true) decides whether draft posts are built.
// Tests only: CONTENT_FIXTURE names a JSON file whose top-level keys replace those of
// src/content (tests/home.spec.js builds Home with a published post, FD-45).
const fixture = process.env.CONTENT_FIXTURE;
const site = buildSite(
  fixture ? { ...loadContent(), ...JSON.parse(readFileSync(fixture, 'utf8')) } : undefined,
);

// FD-94: the footer's copyright year is the year of the build.
const buildYear = new Date().getFullYear();

// FD-22: no domain yet. With SITE_URL empty, no canonical and no absolute OG URLs.
const siteUrl = (process.env.SITE_URL ?? '').trim().replace(/\/+$/, '');

// One page per research project, rendered from the portfolio-entry.html template and
// emitted at the dist/ root as project-<id>.html (Django: /portfolio/<slug>/).
const entryTemplate = resolve(pagesDir, 'portfolio-entry.html');
const projectPages = new Map(site.projectList.map((project) => [project.file, project]));
const templateProject = site.projectById['poultry-aiot-edge'];

// One page per visible blog post from blog-post.html, emitted as post-<slug>.html
// (Django: /blog/<slug>/). The template page itself shows the first post, or a bracketed
// sample when no post is visible, so a release build never leaks a draft.
const postTemplate = resolve(pagesDir, 'blog-post.html');
const postPages = new Map(site.postList.map((post) => [post.file, post]));
const templatePost = site.postList[0] ?? site.samplePost;

// Generated page → the template it is rendered from.
const generated = new Map([
  ...[...projectPages.keys()].map((file) => [file, entryTemplate]),
  ...[...postPages.keys()].map((file) => [file, postTemplate]),
]);

// Detail pages mark their section with aria-current="true" (not "page": the link is not this page).
const pageNav = {
  'index.html': { nav: 'home', current: 'page' },
  'portfolio.html': { nav: 'portfolio', current: 'page' },
  'portfolio-entry.html': { nav: 'portfolio', current: 'true' },
  // FD-109: the "View all" pages sit under Portfolio.
  'publications.html': { nav: 'portfolio', current: 'true' },
  'research.html': { nav: 'portfolio', current: 'true' },
  'blog.html': { nav: 'blog', current: 'page' },
  'blog-post.html': { nav: 'blog', current: 'true' },
  'hire.html': { nav: 'hire', current: 'page' },
  'contact.html': { nav: 'contact', current: 'page' },
};

// FD-131: the template pages repeat a generated page's content; they are built for review and
// the Django mapping, never indexed and not in the sitemap.
const templateOnly = new Set(['portfolio-entry.html', 'blog-post.html']);

function pageContext(pagePath) {
  const file = basename(pagePath);
  const project = projectPages.get(file);
  const post = postPages.get(file);
  const noindex = templateOnly.has(file);
  const context = { ...site, siteUrl, buildYear, pageFile: file, noindex };
  if (project) return { ...context, ...pageNav['portfolio-entry.html'], project };
  if (file === 'portfolio-entry.html')
    return { ...context, ...pageNav[file], project: templateProject };
  if (post) return { ...context, ...pageNav['blog-post.html'], post };
  if (file === 'blog-post.html') return { ...context, ...pageNav[file], post: templatePost };
  return { ...context, ...pageNav[file] };
}

const helpers = {
  // {{{ariaCurrent "blog"}}} → ` aria-current="page"` on the matching link, else nothing.
  ariaCurrent: (key, options) => {
    const { nav, current } = options.data.root;
    return key === nav ? ` aria-current="${current}"` : '';
  },
  eq: (a, b) => a === b,
  and: (a, b) => Boolean(a && b),
  or: (a, b) => Boolean(a || b),
  not: (a) => !a,
  // {{phrase lines}}: wrapped lines as one phrase — "a, b", but "a & b" where a line goes on
  // with "&" (the screen-2 pillars' accessible names, FD-84).
  phrase: (list) =>
    list.reduce(
      (text, line) => (text ? `${text}${line.startsWith('&') ? '' : ','} ${line}` : line),
      '',
    ),
  // {{ordinal @index}} → "01", "02", … (mono indexes, as in the Areas-of-work grid).
  ordinal: (index) => String(index + 1).padStart(2, '0'),
  count: (list) => (Array.isArray(list) ? list.length : 0),
  doiUrl,
  // Placeholder copy (FD-19 content in [brackets]) gets the .is-placeholder style.
  isPlaceholder: isBracketed,
  isExternal: (href) => /^https?:\/\//i.test(href),
  // {{{authors pub.authors}}}: escaped names, the site author's (me: true) in <strong>.
  authors: (list) =>
    list
      .map((author) =>
        author.me ? `<strong>${escapeHtml(author.name)}</strong>` : escapeHtml(author.name),
      )
      .join(', '),
  // {{{jsonLd value}}}: JSON for a <script type="application/ld+json"> data block.
  jsonLd: (value) =>
    JSON.stringify(value)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026'),
};

// Generated project and post pages: virtual build inputs that load their template's
// source, and the same URLs on the dev server.
function generatedPages() {
  const isVirtual = (id) => generated.has(basename(id)) && dirname(id) === pagesDir;
  return {
    name: 'generated-pages',
    resolveId(id) {
      return isVirtual(resolve(id)) ? resolve(id) : null;
    },
    load(id) {
      return isVirtual(id) ? readFileSync(generated.get(basename(id)), 'utf8') : null;
    },
    configureServer(server) {
      // Content is read once at startup; a change restarts the server.
      server.watcher.add(contentDir);
      // A new or removed post body changes the page list, so listen for those too.
      for (const event of ['change', 'add', 'unlink']) {
        server.watcher.on(event, (file) => {
          if ([contentDir, postsDir].includes(dirname(file))) server.restart();
        });
      }
      server.middlewares.use(async (req, res, next) => {
        const file = req.url.split('?')[0].slice(1);
        if (!generated.has(file)) return next();
        try {
          const html = await server.transformIndexHtml(
            `/pages/${file}`,
            readFileSync(generated.get(file), 'utf8'),
            req.originalUrl,
          );
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

// Pages live in src/pages/ but are served and built at the site root
// (/index.html, /blog.html, …) so the URLs match the future Django routes.
// Only exact page file names are mapped; /blog/ or /blog are not (Django owns routing).
// Moving the HTML up one folder is safe because the base is absolute ('/', or
// '/static/frontend/' for the Django target), so asset URLs are absolute.
function flatPages() {
  return {
    name: 'flat-pages',
    enforce: 'post',
    configResolved(config) {
      if (!config.base.startsWith('/')) {
        throw new Error('flat-pages needs an absolute base; relative asset URLs would break.');
      }
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const [path, query] = req.url.split('?');
        const file = path === '/' ? 'index.html' : path.slice(1);
        if (pages.has(file)) req.url = `/pages/${file}${query ? `?${query}` : ''}`;
        next();
      });
    },
    generateBundle(_options, bundle) {
      for (const [key, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'asset' && /^pages\/[^/]+\.html$/.test(chunk.fileName)) {
          let source = String(chunk.source);
          // Open Graph images must be absolute; only possible once a domain exists.
          if (siteUrl) {
            source = source.replace(
              /(<meta\s+(?:property|name)="(?:og|twitter):image"\s+content=")\//g,
              `$1${siteUrl}/`,
            );
          }
          delete bundle[key];
          this.emitFile({ type: 'asset', fileName: chunk.fileName.slice('pages/'.length), source });
        }
      }
    },
  };
}

// FD-131: with SITE_URL set, sitemap.xml lists every indexable page and robots.txt (copied
// from public/) gets its Sitemap line. Without a domain neither is written.
function sitemap() {
  let outDir;
  return {
    name: 'sitemap',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    generateBundle() {
      if (!siteUrl) return;
      const files = [...pages, ...generated.keys()]
        .filter((file) => file !== '404.html' && !templateOnly.has(file))
        .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...files.map((file) => `  <url><loc>${escapeHtml(`${siteUrl}/${file}`)}</loc></url>`),
        '</urlset>',
        '',
      ].join('\n');
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: xml });
    },
    // robots.txt from public/ plus the Sitemap line, written whole so repeat builds stay right.
    closeBundle() {
      if (!siteUrl) return;
      const robots = readFileSync(resolve(root, 'public/robots.txt'), 'utf8');
      writeFileSync(resolve(outDir, 'robots.txt'), `${robots}Sitemap: ${siteUrl}/sitemap.xml\n`);
    },
  };
}

// FD-133: `vite build --mode django` (npm run build:django) is the Django build target: the same
// pages and bundles under the static URL /static/frontend/, with a Vite manifest, in dist-django/.
// The manifest keys fonts, images and lazy modules by source path, but the module script every
// page loads is a shared chunk under a hashed key, and public/ files are not in it. The asset
// map .vite/asset-map.json (source path → built path) adds those: js/main.js, its stylesheet
// scss/main.scss, and js/theme-init.js (public/).
function djangoTarget() {
  const entry = normalizePath(resolve(root, 'src/js/main.js'));
  let active = false;
  return {
    name: 'django-target',
    apply: 'build',
    enforce: 'post',
    config(_config, { mode }) {
      active = mode === 'django';
      if (!active) return null;
      return {
        base: '/static/frontend/',
        build: { outDir: resolve(root, 'dist-django'), manifest: true },
      };
    },
    generateBundle(_options, bundle) {
      if (!active) return;
      const main = Object.values(bundle).find(
        (chunk) => chunk.type === 'chunk' && chunk.moduleIds.map(normalizePath).includes(entry),
      );
      const css = [...(main?.viteMetadata?.importedCss ?? [])];
      if (!main || css.length !== 1) {
        throw new Error('django-target: expected one chunk for js/main.js with one stylesheet.');
      }
      const map = {
        'js/main.js': main.fileName,
        'scss/main.scss': css[0],
        'js/theme-init.js': 'js/theme-init.js',
      };
      this.emitFile({
        type: 'asset',
        fileName: '.vite/asset-map.json',
        source: `${JSON.stringify(map, null, 2)}\n`,
      });
    },
  };
}

export default defineConfig({
  root: resolve(root, 'src'),
  publicDir: resolve(root, 'public'),
  // Multi-page: unknown URLs get a real 404 instead of the SPA index.html fallback.
  appType: 'mpa',
  plugins: [
    djangoTarget(),
    generatedPages(),
    handlebars({
      partialDirectory: resolve(root, 'src/partials'),
      // Site content plus which navigation item each page marks as current.
      context: pageContext,
      helpers,
    }),
    flatPages(),
    sitemap(),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        // Vite 7+ always uses the modern Sass compiler API (the `api` option is gone).
        quietDeps: true,
        // Bootstrap 5.3 must be loaded with @import; this silences only the
        // `import` deprecation raised by our own @import rules.
        silenceDeprecations: ['import'],
      },
    },
  },
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    // No data: URIs for fonts or images (CSP font-src 'self').
    assetsInlineLimit: 0,
    // Vite 8 bundles with Rolldown; `rollupOptions` is a deprecated alias.
    // Generated project and post pages are virtual inputs (generated-pages plugin).
    rolldownOptions: {
      input: Object.fromEntries(
        [...pages, ...generated.keys()].map((file) => [
          file.replace(/\.html$/, ''),
          resolve(pagesDir, file),
        ]),
      ),
    },
  },
  preview: {
    port: 4173,
  },
});
