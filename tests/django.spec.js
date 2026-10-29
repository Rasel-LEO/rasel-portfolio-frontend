// Author: Rasel Al Mamun
// Checks that exist only on the Django target (FD-137): the URL table answers, the Blog shows its
// empty state (the posts are drafts, which Django does not publish) and an unknown path gets the
// 404 page with status 404. Skipped on the static target.
import { expect, test } from './fixtures.js';
import { buildSite, loadContent } from '../tools/content.mjs';
import { isDjango, pagePath, pages, templatePages } from './pages.js';

test.skip(!isDjango, 'Django target only (TEST_TARGET=django)');

const site = buildSite(loadContent());

test.describe('URL table', () => {
  for (const file of pages.filter((name) => name !== '404.html')) {
    test(`${pagePath(file)} answers 200 with one h1`, async ({ page }) => {
      const response = await page.goto(pagePath(file));
      expect(response.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  }

  test('the pages are the ten templates minus the two without a Django URL, plus the projects', () => {
    expect(templatePages).not.toContain('portfolio-entry.html');
    expect(templatePages).not.toContain('blog-post.html');
    expect(pages.filter((name) => name.startsWith('project-'))).toHaveLength(
      site.projectList.length,
    );
    expect(pages.filter((name) => name.startsWith('post-'))).toEqual([]);
  });
});

test.describe('Blog empty state', () => {
  test('no draft is public: no post card, the empty state shows', async ({ page }) => {
    await page.goto(pagePath('blog.html'));
    await expect(page.locator('[data-post-category]')).toHaveCount(0);
    await expect(page.locator('[data-blog-empty]')).toBeVisible();
    await expect(page.locator('[data-empty-all]')).toHaveText(site.blogPage.empty);
  });

  test('a draft post URL answers 404', async ({ page }) => {
    for (const post of site.postList) {
      const response = await page.goto(`/blog/${post.slug}/`);
      expect(response.status(), post.slug).toBe(404);
    }
  });
});

test.describe('404 page', () => {
  test('an unknown path answers 404 with the 404 page', async ({ page }) => {
    const response = await page.goto(pagePath('404.html'));
    expect(response.status()).toBe(404);
    await expect(page.locator('main .eyebrow')).toHaveText('404');
    await expect(page.locator('h1')).toHaveText('Page not found');
    await expect(page.locator('.not-found-actions a')).toHaveText(['Home', 'Portfolio', 'Blog']);
  });

  test('a mistyped project URL answers 404', async ({ page }) => {
    const response = await page.goto('/portfolio/no-such-project/');
    expect(response.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Page not found');
  });
});
