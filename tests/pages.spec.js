// Author: Rasel Al Mamun
import { readdirSync, readFileSync } from 'node:fs';
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

// FD-128: every tab title is short (at most 60 characters) and unique; detail pages use their
// short title, the formal title stays in the h1.
test('every page has a unique <title> of at most 60 characters', async ({ page }) => {
  const titles = new Map();
  for (const file of pages) {
    await page.goto(`/${file}`);
    const title = await page.title();
    expect(title, file).toMatch(/ — Rasel Al Mamun$/);
    expect(title.length, `${file}: ${title}`).toBeLessThanOrEqual(60);
    titles.set(file, title);
  }
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
// one BlogPosting on each post page and on the blog-post.html template; WebSite and the hero
// image preload only on Home (from 768 px, FD-73); the font and avatar preloads on
// every page (FD-65).
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
    await expect(browserPage.locator('link[rel="preload"][as="image"][href*="/P5-"]')).toHaveCount(
      home ? 1 : 0,
    );
    // FD-65: the Bricolage woff2 (hashed, the file the stylesheet uses) and the header avatar.
    const font = browserPage.locator('link[rel="preload"][as="font"]');
    await expect(font).toHaveCount(1);
    await expect(font).toHaveAttribute('type', 'font/woff2');
    await expect(font).toHaveAttribute('crossorigin', '');
    await expect(font).toHaveAttribute('href', /^\/assets\/bricolage-grotesque-[\w-]+\.woff2$/);
    await expect(
      browserPage.locator('link[rel="preload"][as="image"][href*="/avatar-96"]'),
    ).toHaveCount(1);
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
// first screen load eagerly (header avatar, Home hero, Portfolio avatar, 404 figure), every
// other image is lazy. Each <picture> source has one candidate, so no `sizes` is needed.
test('FD-130: images carry dimensions and load lazily below the first screen', () => {
  const eager = (file, img) =>
    /width="28" height="28"/.test(img) ||
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
