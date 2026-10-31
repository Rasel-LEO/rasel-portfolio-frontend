// Author: Rasel Al Mamun
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { buildSite, loadContent } from '../tools/content.mjs';
import { pages, revealAll, templatePages } from './pages.js';

// The default build: SHOW_DRAFTS unset, so the draft posts are built (FD-36).
const site = buildSite(loadContent(), { showDrafts: true });

test('dist/ holds the template pages plus one page per project and per post', () => {
  const sources = readdirSync('src/pages').filter((file) => file.endsWith('.html'));
  expect([...templatePages].sort()).toEqual(sources.sort());
  const generated = [
    ...loadContent().projects.map((project) => `project-${project.id}.html`),
    ...site.postList.map((post) => post.file),
  ];
  expect(pages).toEqual([...sources, ...generated].sort());
});

// FD-128, FD-139: every tab title is short (at most 60 characters), unique and ends with the site
// name; Home is "Rasel Al Mamun — Ideatrium"; detail pages use their short title, the formal title
// stays in the h1.
test('every page has a unique <title> of at most 60 characters', async ({ page }) => {
  const titles = new Map();
  for (const file of pages) {
    await page.goto(`/${file}`);
    const title = await page.title();
    expect(title, file).toMatch(/ — Ideatrium$/);
    expect(title.length, `${file}: ${title}`).toBeLessThanOrEqual(60);
    titles.set(file, title);
  }
  expect(titles.get('index.html')).toBe('Rasel Al Mamun — Ideatrium');
  expect(titles.get('blog.html')).toBe('Blog — Ideatrium');
  // The two templates repeat a generated page's title by design (noindex, FD-131).
  const unique = [...titles].filter(
    ([file]) => !['portfolio-entry.html', 'blog-post.html'].includes(file),
  );
  expect(new Set(unique.map(([, title]) => title)).size).toBe(unique.length);
});

// Every page has its own meta description (no [bracketed] placeholder), mirrored in OG/Twitter.
test('every page has a specific meta description', async ({ page }) => {
  const seen = new Map();
  for (const file of pages) {
    await page.goto(`/${file}`);
    const description = await page.locator('meta[name="description"]').getAttribute('content');
    expect(description, file).toMatch(/^[^[].{20,}/);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
      'content',
      description,
    );
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      'content',
      description,
    );
    seen.set(file, description);
  }
  const { meta } = loadContent();
  expect(seen.get('index.html')).toBe(meta.home);
  expect(seen.get('blog.html')).toBe(meta.blog);
  expect(seen.get('hire.html')).toBe(meta.hire);
  expect(seen.get('contact.html')).toBe(meta.contact);
  expect(seen.get('404.html')).toBe(meta['404']);
});

for (const page of pages) {
  test(`${page} loads cleanly`, async ({ page: browserPage, request, baseURL }) => {
    const errors = [];
    browserPage.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    browserPage.on('pageerror', (error) => errors.push(error.message));

    const response = await browserPage.goto(`/${page}`);
    expect(response.status()).toBe(200);
    await expect(browserPage.locator('h1')).toHaveCount(1);

    const urls = await browserPage.evaluate(() =>
      [...document.querySelectorAll('[href], [src]')].map((el) =>
        el.getAttribute(el.hasAttribute('href') ? 'href' : 'src'),
      ),
    );
    const origin = new URL(baseURL).origin;
    const internal = [
      ...new Set(
        urls
          .map((url) => new URL(url, `${origin}/${page}`))
          .filter((url) => url.origin === origin)
          .map((url) => url.pathname),
      ),
    ];
    for (const path of internal) {
      const linked = await request.get(path);
      expect(linked.status(), path).toBe(200);
    }

    await browserPage.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}

// FD-22: a schema.org Person on every page; ScholarlyArticle blocks for the papers listed;
// one BlogPosting on each post page and on the blog-post.html template; WebSite (Ideatrium, by
// the Person, FD-139) and the hero image preload only on Home (from 768 px, FD-73); the font
// preload on every page (FD-65), no image preload for the header (its logo is inline SVG).
for (const page of pages) {
  test(`${page} has valid JSON-LD`, async ({ page: browserPage }) => {
    await browserPage.goto(`/${page}`);
    const blocks = await browserPage
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((el) => el.textContent));
    const data = blocks.map((text) => JSON.parse(text));
    const types = data.map((item) => item['@type']);
    expect(types.filter((type) => type === 'Person')).toHaveLength(1);
    const person = data.find((item) => item['@type'] === 'Person');
    expect(person.name).toBe('Rasel Al Mamun');
    const { profile } = loadContent();
    expect(person.sameAs).toHaveLength(loadContent().links.length);
    expect(person.knowsAbout).toEqual([...profile.research_interests, 'Software & web']);
    const articles = types.filter((type) => type === 'ScholarlyArticle').length;
    // Portfolio: the selected papers it lists (FD-107); publications.html: all (FD-109).
    const listed = {
      'portfolio.html': loadContent().portfolio.publications.order.length,
      'publications.html': loadContent().publications.length,
    };
    expect(articles).toBe(listed[page] ?? 0);
    const postings = types.filter((type) => type === 'BlogPosting').length;
    expect(postings).toBe(page.startsWith('post-') || page === 'blog-post.html' ? 1 : 0);
    const home = page === 'index.html';
    expect(types.filter((type) => type === 'WebSite')).toHaveLength(home ? 1 : 0);
    if (home) {
      expect(data.find((item) => item['@type'] === 'WebSite')).toEqual({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Ideatrium',
        author: { '@type': 'Person', name: person.name, sameAs: person.sameAs },
      });
    }
    // The author stays the person (FD-139).
    await expect(browserPage.locator('meta[name="author"]')).toHaveAttribute(
      'content',
      'Rasel Al Mamun',
    );
    await expect(browserPage.locator('link[rel="preload"][as="image"][href*="/P5-"]')).toHaveCount(
      home ? 1 : 0,
    );
    // FD-65: the Bricolage woff2 (hashed, the file the stylesheet uses).
    const font = browserPage.locator('link[rel="preload"][as="font"]');
    await expect(font).toHaveCount(1);
    await expect(font).toHaveAttribute('type', 'font/woff2');
    await expect(font).toHaveAttribute('crossorigin', '');
    await expect(font).toHaveAttribute('href', /^\/assets\/bricolage-grotesque-[\w-]+\.woff2$/);
    await expect(
      browserPage.locator('link[rel="preload"][as="image"][href*="/avatar-96"]'),
    ).toHaveCount(0);
  });
}

// No request leaves the site at runtime (CSP connect-src / img-src / font-src 'self'): every
// page at a desktop width, scrolled through so lazy images and the motion chunks load too.
test('no page requests another origin', async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const origin = new URL(baseURL).origin;
  const external = [];
  let seen = 0;
  page.on('request', (request) => {
    const url = request.url();
    seen += 1;
    if (!url.startsWith(`${origin}/`) && !url.startsWith('data:')) external.push(url);
  });
  for (const file of pages) {
    await page.goto(`/${file}`);
    await revealAll(page);
  }
  expect(external).toEqual([]);
  // Documents, styles, scripts, fonts and images of every page were observed.
  expect(seen).toBeGreaterThan(pages.length * 4);
});

// FD-130 image audit: every image has its intrinsic width and height; only the images of the
// first screen load eagerly (Home hero, Portfolio avatar, 404 figure), every
// other image is lazy. Each <picture> source has one candidate, so no `sizes` is needed.
test('FD-130: images carry dimensions and load lazily below the first screen', () => {
  const eager = (file, img) =>
    (file === 'index.html' && img.includes('fetchpriority="high"')) ||
    (file === 'portfolio.html' && img.includes('avatar-512')) ||
    (file === '404.html' && img.includes('P6-desktop'));
  for (const file of pages) {
    const html = readFileSync(`dist/${file}`, 'utf8');
    for (const [img] of html.matchAll(/<img\b[\s\S]*?>/g)) {
      expect(img, file).toMatch(/\swidth="\d+"/);
      expect(img, file).toMatch(/\sheight="\d+"/);
      if (eager(file, img)) expect(img, file).not.toContain('loading="lazy"');
      else expect(img, file).toContain('loading="lazy"');
    }
    for (const [source] of html.matchAll(/<source\b[^>]*>/g)) {
      expect(source, file).not.toMatch(/srcset="[^"]*,/);
    }
  }
});

// FD-139: the brand files. PNG size from its IHDR chunk; ICO sizes from its directory.
const pngSize = (buffer) => [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
const icoSizes = (buffer) =>
  Array.from({ length: buffer.readUInt16LE(4) }, (_, i) => {
    const [w, h] = [buffer[6 + i * 16], buffer[7 + i * 16]];
    return `${w || 256}x${h || 256}`;
  });
const fromDist = (url) => readFileSync(`dist${url}`);

test('FD-139: every icon link and the manifest point to existing root files', () => {
  for (const file of pages) {
    const html = readFileSync(`dist/${file}`, 'utf8');
    expect(html, file).not.toContain('href="data:,"');
    const links = [...html.matchAll(/<link rel="(icon|apple-touch-icon|manifest)"([^>]*)>/g)].map(
      ([, rel, attrs]) => [rel, attrs.match(/href="([^"]+)"/)[1], attrs],
    );
    expect(
      links.map(([rel, href]) => `${rel} ${href}`),
      file,
    ).toEqual([
      'icon /favicon.ico',
      'icon /favicon.svg',
      'apple-touch-icon /apple-touch-icon.png',
      'manifest /site.webmanifest',
    ]);
    for (const [, href] of links) expect(existsSync(`dist${href}`), href).toBe(true);
    expect(links[0][2]).toContain('sizes="32x32"');
    expect(links[1][2]).toContain('type="image/svg+xml"');
    // Theme colour per colour scheme: the page background of each theme.
    for (const [scheme, colour] of [
      ['light', '#f4f2ec'],
      ['dark', '#121417'],
    ]) {
      expect(html, file).toContain(
        `<meta name="theme-color" content="${colour}" media="(prefers-color-scheme: ${scheme})" />`,
      );
    }
  }
  expect(icoSizes(fromDist('/favicon.ico'))).toContain('32x32');
  expect(pngSize(fromDist('/apple-touch-icon.png'))).toEqual([180, 180]);
  const svg = readFileSync('dist/favicon.svg', 'utf8');
  expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 16 16"/);
  expect(svg).not.toMatch(/<script|<image|href="http/);
});

test('FD-139: the manifest parses; its icons exist with the stated sizes', () => {
  const manifest = JSON.parse(readFileSync('dist/site.webmanifest', 'utf8'));
  const tokens = JSON.parse(readFileSync('src/design/tokens.json', 'utf8'));
  const bg = tokens.color.tokens.find((token) => token.name === 'bg-0').value.dark;
  expect(manifest).toMatchObject({
    name: 'Ideatrium',
    short_name: 'Ideatrium',
    start_url: '/',
    display: 'browser',
    background_color: bg,
    theme_color: bg,
  });
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(['192x192', '512x512']);
  for (const icon of manifest.icons) {
    expect(icon.type).toBe('image/png');
    // The 512 icon's corners reach past the maskable safe zone, so "any" only (FD-139).
    expect(icon.purpose).toBe('any');
    expect(pngSize(fromDist(icon.src)).join('x'), icon.src).toBe(icon.sizes);
  }
});

test('FD-139: Open Graph and Twitter cards use the share image at its real size', () => {
  for (const file of pages) {
    const html = readFileSync(`dist/${file}`, 'utf8');
    const meta = (key) =>
      html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];
    expect(meta('og:site_name'), file).toBe('Ideatrium');
    expect(meta('og:title'), file).toMatch(/ — Ideatrium$/);
    expect(meta('twitter:title'), file).toBe(meta('og:title'));
    expect(meta('og:image'), file).toBe('/images/brand/share-image-1200x630.png');
    expect(meta('twitter:image'), file).toBe(meta('og:image'));
    expect(meta('og:image:type'), file).toBe('image/png');
    expect(meta('og:image:alt'), file).toBe('Ideatrium — by Rasel Al Mamun');
    expect(meta('twitter:card'), file).toBe('summary_large_image');
    const [width, height] = pngSize(fromDist(meta('og:image')));
    expect([meta('og:image:width'), meta('og:image:height')], file).toEqual([
      String(width),
      String(height),
    ]);
  }
  expect(pngSize(fromDist('/images/brand/share-image-1200x630.png'))).toEqual([1200, 630]);
});

// FD-141: the P5 / P6 portraits are AI-generated from the owner's photos. Every page's footer
// says so; where a P5 / P6 image has a descriptive alt it ends with "(AI-generated from my own
// photo)", where it is decorative (alt="", inside an aria-hidden figure or a named button) the
// footer note covers it. The real-photo avatar carries no such label.
const AI_SUFFIX = '(AI-generated from my own photo)';

test('FD-141: the AI-portrait note is in the footer of every page', () => {
  const { footer } = loadContent();
  expect(footer.ai_portrait_note).toBe(
    'Some portrait images on this site are AI-generated from my own photos.',
  );
  for (const file of pages) {
    const html = readFileSync(`dist/${file}`, 'utf8');
    const inFooter = html.slice(html.indexOf('<footer class="site-footer">'));
    expect(inFooter, file).toContain(
      `<p class="footer-ai-note mb-0">${footer.ai_portrait_note}</p>`,
    );
  }
});

test('FD-141: P5 / P6 alt text is disclosed where descriptive; the avatar is not labelled', async ({
  page,
}) => {
  let figures = 0;
  for (const file of templatePages) {
    await page.goto(`/${file}`);
    const images = await page.locator('img').evaluateAll((imgs) =>
      imgs.map((img) => ({
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt'),
        hidden: Boolean(img.closest('[aria-hidden="true"]')),
        inNamedButton: Boolean(img.closest('button[aria-label]')),
      })),
    );
    for (const image of images) {
      const where = `${file}: ${image.src}`;
      if (/\/P[56]-/.test(image.src)) {
        figures += 1;
        if (image.alt === '') expect(image.hidden || image.inNamedButton, where).toBe(true);
        else expect(image.alt.endsWith(` ${AI_SUFFIX}`), where).toBe(true);
      } else {
        expect(image.alt ?? '', where).not.toContain('AI-generated');
      }
    }
  }
  // Home (hero, Contact band), 404 and the back-to-top button on every page.
  expect(figures).toBeGreaterThanOrEqual(templatePages.length + 3);
});
