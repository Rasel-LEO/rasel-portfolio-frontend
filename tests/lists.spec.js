// Author: Rasel Al Mamun
// Release 1.6.0 round 3 (FD-154 … FD-161): lists that grow — the pagination component and the
// server-rendered states of the projects archive, the Blog and the Publications page (page, topic,
// category, no result), with and without JavaScript; the topic icon set and the cover fallback;
// the two-email group; the hero and the small layout fixes.
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { buildSite, loadContent } from '../tools/content.mjs';
import {
  PAGE_SIZE,
  blogState,
  countLine,
  pagerView,
  paginate,
  publicationsState,
  researchState,
  resolveState,
} from '../tools/lists.mjs';
import { TOPIC_ICONS, validateContent } from '../tools/validate-content.mjs';
import { buildFixture, serveBuild } from './fixture-site.js';
import { isDjango, pagePath } from './pages.js';

test.skip(isDjango, 'the static preview states of FD-154 have no Django counterpart');

const site = buildSite();
const html = (file) => readFileSync(`dist/${file}`, 'utf8');

// ---- the pure functions ---------------------------------------------------------------------

test.describe('pagination model (tools/lists.mjs)', () => {
  test('paginate clamps, counts and slices', () => {
    const list = Array.from({ length: 15 }, (_, i) => i + 1);
    expect(paginate(list, 1, 9)).toMatchObject({ page: 1, pages: 2, from: 1, to: 9, total: 15 });
    expect(paginate(list, 2, 9)).toMatchObject({ page: 2, from: 10, to: 15 });
    expect(paginate(list, 2, 9).items).toEqual([10, 11, 12, 13, 14, 15]);
    // A page beyond the last is the last; nonsense is page 1; an empty list is one empty page.
    expect(paginate(list, 99, 9).page).toBe(2);
    expect(paginate(list, 'x', 9).page).toBe(1);
    expect(paginate(list, -3, 9).page).toBe(1);
    expect(paginate([], 1, 9)).toMatchObject({ pages: 1, from: 0, to: 0, total: 0 });
  });

  test('the count line', () => {
    expect(countLine(paginate(Array(15).fill(0), 1, 9), 'projects', 'project')).toBe(
      'Showing 1–9 of 15 projects',
    );
    expect(countLine(paginate(Array(3).fill(0), 1, 9), 'projects', 'project')).toBe(
      'Showing 1–3 of 3 projects',
    );
    expect(countLine(paginate([0], 1, 9), 'projects', 'project')).toBe('Showing 1 of 1 project');
    expect(countLine(paginate([], 1, 9), 'projects', 'project')).toBe(
      'No projects match your search.',
    );
  });

  test('the pager: none for one page; first, last, current ± 1 with gaps; prev / next', () => {
    const href = (n) => `/p${n}`;
    expect(pagerView(paginate(Array(9).fill(0), 1, 9), href)).toBeNull();
    const many = (page) => pagerView(paginate(Array(90).fill(0), page, 9), href);
    expect(many(1).items.map((i) => i.n ?? '…')).toEqual([1, 2, '…', 10]);
    expect(many(5).items.map((i) => i.n ?? '…')).toEqual([1, '…', 4, 5, 6, '…', 10]);
    expect(many(10).items.map((i) => i.n ?? '…')).toEqual([1, '…', 9, 10]);
    expect(many(1).prev).toBeNull();
    expect(many(1).next.href).toBe('/p2');
    expect(many(10).next).toBeNull();
    expect(
      many(5)
        .items.filter((i) => i.current)
        .map((i) => i.n),
    ).toEqual([5]);
  });

  test('a query maps to the state file (the preview server)', () => {
    const map = (file, query) => resolveState(file, new URLSearchParams(query), site);
    expect(map('research.html', '')).toBe('research.html');
    expect(map('research.html', 'page=2')).toBe('research-page-2.html');
    expect(map('research.html', 'page=99')).toBe('research-page-2.html');
    expect(map('research.html', 'topic=poultry')).toBe('research-topic-poultry.html');
    expect(map('research.html', 'topic=poultry&page=2')).toBe('research-topic-poultry.html');
    expect(map('research.html', 'topic=nope')).toBe('research.html');
    expect(map('research.html', 'q=blockchain')).toBe('research-empty.html');
    expect(map('research.html', 'q=biofloc')).toBe('research.html');
    expect(map('blog.html', 'category=education')).toBe('blog-category-education.html');
    expect(map('blog.html', 'category=nope&page=3')).toBe('blog.html');
    expect(map('publications.html', 'page=2')).toBe('publications.html');
    expect(map('hire.html', 'page=2')).toBe('hire.html');
  });
});

// ---- the projects archive (the built states) ------------------------------------------------

test.describe('projects archive: server-rendered states', () => {
  test('page 1: 9 cards, the count line, the pager, no sort menu', async ({ page }) => {
    await page.goto('/research.html');
    await expect(page.locator('[data-project-card]')).toHaveCount(PAGE_SIZE.projects);
    await expect(page.locator('[data-results-status]')).toHaveText('Showing 1–9 of 15 projects');
    const pager = page.getByRole('navigation', { name: 'Projects pages' });
    await expect(pager).toBeVisible();
    await expect(pager.locator('[aria-current="page"]')).toHaveText('1');
    await expect(pager.locator('[aria-current="page"]')).toHaveAttribute('aria-label', 'Page 1');
    await expect(pager.getByRole('link', { name: 'Previous' })).toHaveCount(0);
    await expect(pager.locator('[aria-disabled="true"]')).toHaveText('Previous');
    await expect(pager.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/research-page-2.html',
    );
    await expect(pager.getByRole('link', { name: 'Next' })).toHaveAttribute('rel', 'next');
    // No sort menu: one combobox, the topic.
    await expect(page.getByRole('combobox')).toHaveCount(1);
    // Page 1 has no rel=prev; rel=next points to page 2.
    expect(html('research.html')).toContain('<link rel="next" href="/research-page-2.html" />');
    expect(html('research.html')).not.toContain('rel="prev"');
  });

  test('page 2: its own title, rel prev, 6 cards, last page', async ({ page }) => {
    await page.goto('/research-page-2.html');
    await expect(page).toHaveTitle('Projects — page 2 — Ideatrium');
    expect(html('research-page-2.html')).toContain('<link rel="prev" href="/research.html" />');
    expect(html('research-page-2.html')).not.toContain('rel="next"');
    await expect(page.locator('[data-project-card]')).toHaveCount(6);
    await expect(page.locator('[data-results-status]')).toHaveText('Showing 10–15 of 15 projects');
    const pager = page.getByRole('navigation', { name: 'Projects pages' });
    await expect(pager.locator('[aria-current="page"]')).toHaveText('2');
    await expect(pager.getByRole('link', { name: 'Previous' })).toHaveAttribute(
      'href',
      '/research.html',
    );
    await expect(pager.getByRole('link', { name: 'Next' })).toHaveCount(0);
    await expect(pager.locator('[aria-disabled="true"]')).toHaveText('Next');
    // The two pages together are every project once, in the data's order.
    const first = site.projectList.slice(0, 9).map((p) => p.short_title);
    const second = site.projectList.slice(9).map((p) => p.short_title);
    await expect(page.locator('[data-project-card] h3')).toHaveText(second);
    await page.goto('/research.html');
    await expect(page.locator('[data-project-card] h3')).toHaveText(first);
  });

  test('a topic and a search with no result', async ({ page }) => {
    const poultry = researchState(site.archive, { topic: 'poultry' });
    await page.goto('/research-topic-poultry.html');
    await expect(page).toHaveTitle('Projects — Poultry systems — Ideatrium');
    await expect(page.locator('[data-project-card]')).toHaveCount(poultry.matched);
    await expect(page.locator('[data-results-status]')).toHaveText(poultry.countText);
    await expect(page.getByRole('navigation', { name: 'Projects pages' })).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveValue('poultry');

    await page.goto('/research-empty.html');
    await expect(page).toHaveTitle('Projects — search — Ideatrium');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expect(page.locator('[data-project-card]')).toHaveCount(0);
    await expect(page.locator('[data-results-status]')).toHaveText(
      'No projects match your search.',
    );
    const empty = page.locator('.empty-state');
    await expect(empty).toContainText('No projects match your search.');
    await expect(empty.getByRole('link', { name: 'Clear filters' })).toHaveAttribute(
      'href',
      '/research.html',
    );
    await expect(page.getByRole('navigation', { name: 'Projects pages' })).toHaveCount(0);
  });
});

test.describe('projects archive without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('a GET form with its own Search button; a search and a page work as plain navigation', async ({
    page,
  }) => {
    await page.goto('/research.html');
    const form = page.getByRole('search', { name: 'Filter projects' });
    await expect(form).toBeVisible();
    await expect(form).toHaveAttribute('method', 'get');
    await expect(form).toHaveAttribute('action', '/research.html');
    await form.getByRole('searchbox').fill('blockchain');
    await form.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/research\.html\?q=blockchain(&topic=)?$/);
    await expect(page.locator('.empty-state')).toContainText('No projects match your search.');
    await page.getByRole('link', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/research\.html$/);
    await page.getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\/research-page-2\.html$/);
    await expect(page.locator('[data-project-card]')).toHaveCount(6);
    // The topic select applies with the button.
    await page.goto('/research.html');
    await page.getByRole('combobox').selectOption('machinery');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page).toHaveURL(/\/research\.html\?(q=&)?topic=machinery$/);
    await expect(page).toHaveTitle('Projects — Farm machinery — Ideatrium');
  });
});

test.describe('projects archive with JavaScript: enhancement', () => {
  test('Next swaps the results in place, moves focus to the heading and announces the count', async ({
    page,
  }) => {
    await page.goto('/research.html');
    await page.evaluate(() => {
      window.__noReload = true;
    });
    await page
      .getByRole('navigation', { name: 'Projects pages' })
      .getByRole('link', { name: 'Next' })
      .click();
    await expect(page).toHaveURL(/research-page-2\.html$/);
    await expect(page.locator('[data-project-card]')).toHaveCount(6);
    await expect(page).toHaveTitle('Projects — page 2 — Ideatrium');
    expect(await page.evaluate(() => window.__noReload)).toBe(true);
    await expect(page.locator('#results-title')).toBeFocused();
    await expect(page.locator('[data-list-announce]')).toHaveText('Showing 10–15 of 15 projects');
    await expect(page.locator('[data-list-announce]')).toHaveAttribute('role', 'status');
    // Back restores page 1.
    await page.goBack();
    await expect(page.locator('[data-project-card]')).toHaveCount(9);
    await expect(page).toHaveTitle('Projects — Ideatrium');
  });

  test('a topic change and a search with no result, then "Clear filters"', async ({ page }) => {
    await page.goto('/research.html');
    await page.getByRole('combobox').selectOption('poultry');
    await expect(page).toHaveURL(/\?topic=poultry$/);
    const poultry = researchState(site.archive, { topic: 'poultry' });
    await expect(page.locator('[data-project-card]')).toHaveCount(poultry.matched);
    await expect(page.locator('[data-list-announce]')).toHaveText(poultry.countText);
    await expect(page.locator('#results-title')).toBeFocused();
    await page.getByRole('searchbox').fill('blockchain');
    await page.getByRole('combobox').selectOption('');
    await expect(page.locator('.empty-state')).toContainText('No projects match your search.');
    await expect(page.locator('[data-list-announce]')).toHaveText('No projects match your search.');
    // The box keeps what was typed.
    await expect(page.getByRole('searchbox')).toHaveValue('blockchain');
    await page.getByRole('link', { name: 'Clear filters' }).click();
    await expect(page.locator('[data-project-card]')).toHaveCount(9);
    await expect(page.getByRole('searchbox')).toHaveValue('');
  });
});

test.describe('the pager at 320 and 1440 px', () => {
  test('320: "Previous · Page 1 of 2 · Next" with 44 px targets; 1440: the numbers', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/research.html');
    const pager = page.getByRole('navigation', { name: 'Projects pages' });
    await expect(pager.locator('.pager-status')).toBeVisible();
    await expect(pager.locator('.pager-status')).toHaveText('Page 1 of 2');
    await expect(pager.locator('.pager-num').first()).toBeHidden();
    for (const link of await pager.locator('.pager-step .pager-link').all()) {
      expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(pager.locator('.pager-status')).toBeHidden();
    await expect(pager.locator('.pager-num')).toHaveCount(2);
    await expect(pager.locator('.pager-num').first()).toBeVisible();
    // Keyboard: the links are in the tab order.
    await pager.getByRole('link', { name: 'Next' }).focus();
    await expect(pager.getByRole('link', { name: 'Next' })).toBeFocused();
  });
});

// ---- many items: Blog, Publications, topic icons, covers ------------------------------------

function manyContent() {
  const c = structuredClone(loadContent());
  const [post] = c.blog;
  c.blog = Array.from({ length: 20 }, (_, i) => ({
    ...post,
    slug: `sample-post-${i + 1}`,
    title: `Sample post ${i + 1}`,
    short_title: `Sample post ${i + 1}`,
    category: i < 12 ? 'tech-review' : 'education',
  }));
  const [pub] = c.publications;
  const extra = Array.from({ length: 33 }, (_, i) => ({
    ...pub,
    id: `sample-pub-${i + 1}`,
    year: 2010 + (i % 12),
    doi: `10.1234/sample.${i + 1}`,
    title: `Sample paper ${i + 1}`,
    project: undefined,
  }));
  c.publications = [...c.publications, ...extra];
  c.projects[0] = { ...c.projects[0], status: 'planned' };
  // 1.7.0: every post has a card image and no figures (the sample posts share one body).
  c.blog.forEach((entry, i) => {
    entry.figures = undefined;
    entry.card_image = { ...post.card_image, alt: `Sample card image ${i + 1}` };
  });
  return c;
}

test.describe('many posts and publications (a sample build)', () => {
  test.describe.configure({ mode: 'serial' });
  let served;
  const content = manyContent();
  test.beforeAll(async () => {
    test.setTimeout(120_000);
    served = await serveBuild(buildFixture('lists-many', content), content);
  });
  test.afterAll(() => served?.server.close());

  test('Blog: 9 per page, three pages, the category kept, an empty category', async ({ page }) => {
    await page.goto(`${served.url}/blog.html`);
    await expect(page.locator('.blog-card')).toHaveCount(9);
    await expect(page.locator('[data-results-status]')).toHaveText('Showing 1–9 of 20 posts');
    const pager = page.getByRole('navigation', { name: 'Blog pages' });
    await expect(pager.locator('.pager-num a')).toHaveText(['1', '2', '3']);
    await page.goto(`${served.url}/blog.html?page=3`);
    await expect(page.locator('.blog-card')).toHaveCount(2);
    await expect(page).toHaveTitle('Blog — page 3 — Ideatrium');
    await expect(
      page.getByRole('navigation', { name: 'Blog pages' }).locator('[aria-disabled]'),
    ).toHaveText('Next');
    // The category tab stays in the URL and in the pager: 12 posts, two pages.
    await page.goto(`${served.url}/blog.html?category=tech-review`);
    const tabs = page.getByRole('navigation', { name: 'Blog categories' });
    await expect(tabs.getByRole('link', { name: 'Tech review' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.locator('.blog-card')).toHaveCount(9);
    await expect(page.getByRole('link', { name: 'Next' })).toHaveAttribute(
      'href',
      '/blog-category-tech-review-page-2.html',
    );
    await page.getByRole('link', { name: 'Next' }).click();
    await expect(page.locator('.blog-card')).toHaveCount(3);
    await expect(page).toHaveTitle('Blog — Tech review — page 2 — Ideatrium');
    // A category without posts: the empty state with a way back; no pager.
    await page.goto(`${served.url}/blog.html?category=agricultural-engineering`);
    await expect(page.locator('.empty-state')).toContainText(content.blogPage.empty_category);
    await expect(
      page.locator('.empty-state').getByRole('link', { name: 'Show all posts' }),
    ).toHaveAttribute('href', '/blog.html');
    await expect(page.getByRole('navigation', { name: 'Blog pages' })).toHaveCount(0);
    // One page: no pagination (the category with 8 posts).
    await page.goto(`${served.url}/blog.html?category=education`);
    await expect(page.locator('.blog-card')).toHaveCount(8);
    await expect(page.getByRole('navigation', { name: 'Blog pages' })).toHaveCount(0);
  });

  test('Blog card images: on every card, 16:9, centred cover; named on the post page', async ({
    page,
  }) => {
    await page.goto(`${served.url}/blog.html`);
    const first = page.locator('.blog-card').first();
    const img = first.locator('.blog-cover img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('alt', '');
    await expect(first.locator('.blog-cover svg')).toHaveCount(0);
    const ratio = await first
      .locator('.blog-cover')
      .evaluate((el) => el.getBoundingClientRect().width / el.getBoundingClientRect().height);
    expect(ratio).toBeCloseTo(16 / 9, 1);
    await expect(img).toHaveCSS('object-fit', 'cover');
    const second = page.locator('.blog-card').nth(1);
    await expect(second.locator('.blog-cover img')).toHaveCount(1);
    // The post page names the image.
    await page.goto(`${served.url}/post-sample-post-1.html`);
    await expect(page.locator('.post-cover img')).toHaveAttribute('alt', 'Sample card image 1');
    await page.goto(`${served.url}/post-sample-post-2.html`);
    await expect(page.locator('.post-cover img')).toHaveAttribute('alt', 'Sample card image 2');
  });

  test('Publications: 20 per page above 20 items, grouped by year, a pager', async ({ page }) => {
    await page.goto(`${served.url}/publications.html`);
    await expect(page.locator('[data-pub-year] h2')).not.toHaveCount(0);
    const rows = page.locator('[data-pub-row]');
    await expect(rows).toHaveCount(20);
    const pager = page.getByRole('navigation', { name: 'Publications pages' });
    await expect(pager.locator('.pager-num a')).toHaveText(['1', '2', '3']);
    await page.goto(`${served.url}/publications.html?page=2`);
    await expect(rows).toHaveCount(20);
    await expect(page).toHaveTitle('Publications — page 2 — Ideatrium');
    await page.goto(`${served.url}/publications.html?page=3`);
    await expect(rows).toHaveCount(1);
    const years = await page.locator('[data-pub-year] h2').allTextContents();
    expect(years).toEqual([...years].sort((a, b) => Number(b) - Number(a)));
  });

  test('a project card shows "Planned" with a hollow dot; a card without a status shows no badge', async ({
    page,
  }) => {
    await page.goto(`${served.url}/research.html`);
    const first = page.locator('[data-project-card]').first().locator('.archive-status');
    await expect(first).toHaveText('Planned');
    await expect(first.locator('.status-planned .dot')).toHaveCount(1);
    // Every badge is a real status; the cards without one have none.
    for (const status of await page.locator('.archive-status .status').all()) {
      expect(['In progress', 'Completed', 'Planned']).toContain(
        (await status.textContent()).trim(),
      );
    }
    const cards = await page.locator('[data-project-card]').count();
    const badges = await page.locator('.archive-status').count();
    expect(badges).toBeLessThan(cards);
  });

  test('no horizontal overflow on the paged lists at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    for (const path of ['/blog.html?page=2', '/publications.html', '/research.html?page=2']) {
      await page.goto(`${served.url}${path}`);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        path,
      ).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('topic icons', () => {
  // 1.7.1: 24 keys plus the twelve added ones.
  test('36 keys; every named one has a drawing, "general" is the fallback', () => {
    const required = [
      'software',
      'web',
      'mobile',
      'ai',
      'robotics',
      'data',
      'cloud',
      'security',
      'energy',
      'water',
      'environment',
      'health',
      'education',
      'research',
      'hardware',
      'automation',
      'general',
    ];
    expect(TOPIC_ICONS).toHaveLength(36);
    for (const key of ['hen', 'fish', 'sun-water', 'tractor', 'leaf', 'greenhouse', ...required]) {
      expect(TOPIC_ICONS, key).toContain(key);
    }
    const partial = readFileSync('src/partials/icons/line-icon.hbs', 'utf8');
    for (const key of TOPIC_ICONS.filter((k) => k !== 'general')) {
      expect(partial, key).toContain(`(eq name "${key}")`);
    }
    expect(partial).toMatch(/\{\{else\}\}\s*<path d="M24,5L40,14V34L24,43L8,34V14Z"/);
    // The validator offers exactly this list.
    const bad = structuredClone(loadContent());
    bad.researchArchive.topics[0].icon = 'unicorn';
    expect(validateContent(bad).join('\n')).toContain('researchArchive');
    const planned = structuredClone(loadContent());
    planned.projects[0].status = 'planned';
    expect(validateContent(planned)).toEqual([]);
  });

  test('every icon draws, in both themes, inside its box (a sample page)', async ({ page }) => {
    // Every key rendered through a sample build of the archive: topics = all 36 keys.
    const content = structuredClone(loadContent());
    content.researchArchive.topics = TOPIC_ICONS.map((icon) => ({
      id: `t-${icon}`,
      label: `Topic ${icon}`,
      icon,
    }));
    content.projects = content.projects.map((project, i) => ({
      ...project,
      topic: `t-${TOPIC_ICONS[i]}`,
    }));
    const dir = buildFixture('lists-icons', content);
    const icons = await serveBuild(dir, content);
    try {
      await page.goto(`${icons.url}/research.html`);
      const svgs = page.locator('.archive-topic svg');
      await expect(svgs).toHaveCount(9);
      for (const svg of await svgs.all()) {
        expect(await svg.locator('path, circle, rect, ellipse').count()).toBeGreaterThan(0);
      }
    } finally {
      icons.server.close();
    }
  });
});

// ---- the small components -----------------------------------------------------------------

test.describe('two emails, one group', () => {
  test('footer: one envelope icon, both addresses, hello@ first, 12 px or less between', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/contact.html');
    const group = page.locator('.footer-emails');
    await expect(group.locator('svg')).toHaveCount(1);
    const links = group.getByRole('link');
    await expect(links).toHaveText([site.profile.email, site.profile.secondary_email]);
    const [a, b] = await Promise.all([links.nth(0).boundingBox(), links.nth(1).boundingBox()]);
    expect(b.y - (a.y + a.height)).toBeLessThanOrEqual(12);
    expect(b.y).toBeGreaterThan(a.y);
  });

  // F3, C1 (1.6.0): the Direct card is gone from Contact and Hire me (the footer has the group).
  for (const file of ['contact.html', 'hire.html']) {
    test(`${file}: no Direct card, no address`, async ({ page }) => {
      await page.goto(`/${file}`);
      await expect(page.locator('aside .aside-box', { hasText: 'Direct' })).toHaveCount(0);
      await expect(page.locator('main')).not.toContainText(site.profile.email);
      await expect(page.locator('main')).not.toContainText(site.profile.secondary_email);
    });
  }
});

test.describe('hero, role lines and the small layout fixes', () => {
  const lines = (locator) =>
    locator.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
      return tops.size;
    });

  for (const width of [1200, 1280, 1440, 1920]) {
    test(`${width}: the hero eyebrow and role line are one line, the footer role line too`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      expect(await lines(page.locator('.hero-eyebrow span:visible'))).toBe(1);
      expect(await lines(page.locator('.hero-role'))).toBe(1);
      expect(await lines(page.locator('.footer-role'))).toBe(1);
    });
  }

  for (const width of [320, 390]) {
    test(`${width}: buttons side by side, CV full width; role lines balanced, never a "·" first`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/index.html');
      const [hire, portfolio, cv] = await Promise.all(
        ['.hero-ctas a:nth-child(1)', '.hero-ctas a:nth-child(2)', '.hero-ctas a:nth-child(3)'].map(
          (s) => page.locator(s).boundingBox(),
        ),
      );
      expect(Math.abs(hire.y - portfolio.y)).toBeLessThan(2);
      expect(portfolio.x).toBeGreaterThan(hire.x + hire.width - 1);
      expect(cv.y).toBeGreaterThan(hire.y + hire.height - 1);
      const column = await page.locator('.hero-ctas').boundingBox();
      expect(Math.abs(cv.width - column.width)).toBeLessThan(2);
      // No single word alone on the last line of a role line.
      for (const selector of ['.hero-role', '.footer-role']) {
        const last = await page.locator(selector).evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const rects = [...range.getClientRects()];
          const bottom = Math.max(...rects.map((r) => Math.round(r.top)));
          const text = el.textContent.replace(/\s+/g, ' ');
          // Words whose box starts on the last line.
          const words = [];
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            for (const m of node.data.matchAll(/\S+/g)) {
              const r = document.createRange();
              r.setStart(node, m.index);
              r.setEnd(node, m.index + m[0].length);
              if (Math.round(r.getBoundingClientRect().top) === bottom && m[0] !== '·')
                words.push(m[0]);
            }
          }
          return { words: words.length, text };
        });
        expect(last.words, `${selector} at ${width}px`).toBeGreaterThanOrEqual(2);
      }
    });
  }
});

test.describe('Hire me, Contact, menu and cards', () => {
  test('Hire me: "Start a brief" moves focus to the form; the heading block is aligned', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hire.html');
    const head = page.locator('.hire-head');
    await expect(head.getByRole('link', { name: 'Hire me' })).toHaveCount(0);
    // F2 (1.6.0): no CV button in the head.
    await expect(head.getByRole('link', { name: 'Download CV (PDF)' })).toHaveCount(0);
    await head.getByRole('link', { name: 'Start a brief' }).click();
    await expect(page.locator('#hire-name')).toBeFocused();
    // The button is centred on the title (within a few pixels; round 6, FD-176).
    await page.goto('/hire.html');
    const [left, right] = await Promise.all([
      page.locator('.hire-head h1').boundingBox(),
      page.locator('.hire-head .band-actions').boundingBox(),
    ]);
    expect(Math.abs(left.y + left.height / 2 - (right.y + right.height / 2))).toBeLessThan(6);
    // Phones: the availability line comes before the heading (round 6, FD-176).
    await page.setViewportSize({ width: 390, height: 844 });
    const h1 = await page.locator('.hire-head h1').boundingBox();
    const line = await page.locator('.hire-head .availability').boundingBox();
    expect(h1.y).toBeGreaterThan(line.y + line.height - 1);
  });

  test('menu: every item has a description; no 01 / 05', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    const items = page.locator('.drawer-links li');
    await expect(items).toHaveCount(6);
    await expect(items.locator('.drawer-sub')).toHaveText([
      'Overview',
      'Publications · Projects · Awards',
      'Agri engineering · Tech review · Education',
      'Research · Software',
      'Services',
      'Email · Form',
    ]);
    expect(html('index.html')).not.toMatch(/drawer-sub[^>]*>\s*0[15]\s*</);
  });

  test('Contact: the audiences are a bulleted list', async ({ page }) => {
    await page.goto('/contact.html');
    const list = page.locator('ul.plain-list');
    await expect(list.locator('li')).toHaveCount(site.contact.audiences.length);
    await expect(list).toHaveCSS('list-style-type', 'disc');
    await expect(page.locator('ol')).toHaveCount(0);
  });

  test('Portfolio: the counts label says "Projects"; the section menu scrolls on a phone', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/portfolio.html');
    await expect(page.locator('.pf-count dt')).toHaveText(['Publications', 'Projects', 'Awards']);
    const nav = page.locator('.pf-nav ul');
    expect(await nav.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await expect(nav).toHaveCSS('scrollbar-width', 'thin');
    expect(await nav.evaluate((el) => getComputedStyle(el).maskImage)).toContain('linear-gradient');
    // Not sticky: after scrolling past it, it is gone from the window.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    expect(
      await page.locator('.pf-nav').evaluate((el) => el.getBoundingClientRect().bottom),
    ).toBeLessThan(0);
  });

  test('project cards: status and a larger role line with AA contrast, both themes', async ({
    page,
  }) => {
    for (const theme of ['dark', 'light']) {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await page.goto('/research.html');
      const result = await page
        .locator('.archive-card')
        .first()
        .evaluate((card) => {
          const role = card.querySelector('.archive-card-role');
          const parse = (c) =>
            c
              .match(/[\d.]+/g)
              .slice(0, 3)
              .map(Number);
          const lum = ([r, g, b]) => {
            const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          let bg = card;
          while (bg && /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(bg).backgroundColor))
            bg = bg.parentElement;
          const fg = lum(parse(getComputedStyle(role).color));
          const back = lum(parse(getComputedStyle(bg).backgroundColor));
          return {
            size: parseFloat(getComputedStyle(role).fontSize),
            ratio: (Math.max(fg, back) + 0.05) / (Math.min(fg, back) + 0.05),
          };
        });
      expect(result.size, theme).toBeGreaterThanOrEqual(15);
      expect(result.ratio, theme).toBeGreaterThanOrEqual(4.5);
    }
  });
});

test('no "[Status]" placeholder anywhere: a project without a status has no badge', () => {
  const pagesWithCards = ['research.html', 'research-page-2.html', 'portfolio.html', 'index.html'];
  for (const file of pagesWithCards) {
    expect(html(file), file).not.toContain('[Status]');
    expect(html(file), file).not.toContain('status-unset');
  }
  // research.html: 9 cards, badges only on the two projects that have a status.
  const withStatus = site.projectList.slice(0, 9).filter((project) => project.status).length;
  expect([...html('research.html').matchAll(/class="archive-status/g)]).toHaveLength(withStatus);
});

test('the build holds every state the preview needs', () => {
  for (const file of [
    'research.html',
    'research-page-2.html',
    'research-empty.html',
    'blog.html',
    'blog-category-education.html',
    'publications.html',
  ]) {
    expect(() => html(file), file).not.toThrow();
  }
  // Blog and Publications are one page today: no pager, no page 2.
  expect(blogState(site, { page: 1 }).pager).toBeNull();
  expect(publicationsState(site.publicationRows, { page: 1 }).pager).toBeNull();
  // Exactly 20 items: no pager; 21: a pager.
  const rows = (n) => [{ year: 2026, items: Array.from({ length: n }, (_, i) => ({ id: i })) }];
  expect(PAGE_SIZE.publications).toBe(20);
  expect(publicationsState(rows(20), { page: 1 }).pager).toBeNull();
  expect(publicationsState(rows(21), { page: 1 }).pager).not.toBeNull();
  expect(pagePath('research.html')).toBe('/research.html');
});
