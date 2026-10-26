// Author: Rasel Al Mamun
// Blog and post pages (FD-36, FD-37): list, category filter with and without JS,
// generated post pages, Markdown rendering, and the SHOW_DRAFTS=false release build.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { buildSite, loadContent } from '../tools/content.mjs';
import { readingMinutes, renderMarkdown } from '../tools/markdown.mjs';
import { postPages } from './pages.js';

const site = buildSite(loadContent(), { showDrafts: true });
const posts = site.postList;

test.describe('Blog list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog.html');
  });

  test('lists the three posts as image cards with category and Draft labels', async ({ page }) => {
    const items = page.locator('[data-post-category]');
    await expect(items).toHaveCount(3);
    for (const [i, post] of posts.entries()) {
      const item = items.nth(i);
      await expect(item.locator('.blog-card-category')).toHaveText(post.categoryLabel);
      await expect(item.locator('[data-draft-label]')).toHaveText('Draft');
      const link = item.getByRole('link', { name: post.title });
      await expect(link).toHaveAttribute('href', `/${post.file}`);
      await expect(item.locator('.blog-card-excerpt')).toHaveText(post.standfirst);
    }
    await expect(page.locator('[data-blog-empty]')).toBeHidden();
  });

  test('the category filter shows one category and announces the count', async ({ page }) => {
    const group = page.getByRole('group', { name: 'Filter posts by category' });
    await expect(group).toBeVisible();
    const count = page.locator('[data-category-count]');
    await expect(count).toHaveAttribute('aria-live', 'polite');
    await expect(count).toHaveText('3 drafts');

    for (const category of site.categories) {
      const button = group.getByRole('button', { name: category.label });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(group.getByRole('button', { name: 'All' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await expect(count).toHaveText(`1 draft in ${category.label}`);
      const visible = page.locator('[data-post-category]:visible');
      await expect(visible).toHaveCount(1);
      await expect(visible).toHaveAttribute('data-post-category', category.id);
    }
    await group.getByRole('button', { name: 'All' }).click();
    await expect(page.locator('[data-post-category]:visible')).toHaveCount(3);
    await expect(count).toHaveText('3 drafts');
  });

  test('a category without posts shows the empty state', async ({ page }) => {
    // The data has one post per category, so take one out of the page for this check.
    await page.locator('[data-post-category="education"]').evaluate((el) => el.remove());
    await page.getByRole('button', { name: 'Education' }).click();
    const empty = page.locator('[data-blog-empty]');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText(site.blogPage.empty_category);
    await page.getByRole('button', { name: 'All' }).click();
    await expect(empty).toBeHidden();
  });
});

test.describe('Blog without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every post is listed with its category label; no filter buttons', async ({ page }) => {
    await page.goto('/blog.html');
    await expect(page.locator('[data-category-filter]')).toBeHidden();
    await expect(page.locator('[data-post-category]:visible')).toHaveCount(3);
    for (const post of posts) {
      await expect(page.getByRole('link', { name: post.title })).toBeVisible();
    }
  });
});

test.describe('Post pages', () => {
  test('one page per post', () => {
    expect(postPages).toEqual(posts.map((post) => post.file).sort());
  });

  for (const post of posts) {
    test(`${post.file} shows the post`, async ({ page }) => {
      const response = await page.goto(`/${post.file}`);
      expect(response.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(post.title);

      const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
      await expect(crumbs.getByRole('link', { name: 'Blog' })).toHaveAttribute(
        'href',
        '/blog.html',
      );
      await expect(crumbs).toContainText(post.categoryLabel);
      await expect(page.locator('.entry-meta')).toHaveText(`${post.minutes} min read`);
      await expect(page.locator('.page-head .chip-draft')).toHaveText('Draft');
      await expect(page.locator('.prose .standfirst')).toHaveText(post.standfirst);
      await expect(page.locator('.prose h2')).toHaveCount(2);
      await expect(page.locator('.prose pre.prose-code code')).toHaveCount(1);
      await expect(page.locator('.prose figure .media-ph-caption')).toHaveText(/^\[Figure: .+\]$/);
      await expect(page.getByRole('link', { name: 'Back to the blog' })).toHaveAttribute(
        'href',
        '/blog.html',
      );

      // FD-114: the sidebar's More posts replaces the previous / next pager.
      const more = page.getByRole('navigation', { name: 'More posts' });
      await expect(more.getByRole('link')).toHaveCount(posts.length - 1);
      await expect(page.locator('[rel="prev"], [rel="next"]')).toHaveCount(0);

      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
      // FD-39: the standfirst once written (FD-103), else a generic line.
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        post.standfirst.startsWith('[')
          ? `${post.title} — a post by ${site.profile.name}`
          : post.standfirst,
      );
      const ld = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent)));
      const postings = ld.filter((item) => item['@type'] === 'BlogPosting');
      expect(postings).toHaveLength(1);
      expect(postings[0]).toMatchObject({
        headline: post.title,
        inLanguage: 'en',
        articleSection: post.categoryLabel,
        author: { '@type': 'Person', name: site.profile.name },
      });
    });
  }

  test('code scrolls inside the measure at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/${posts[0].file}`);
    const { page: pageOverflow, code } = await page.evaluate(() => {
      const pre = document.querySelector('.prose-code');
      return {
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        code: getComputedStyle(pre).overflowX,
      };
    });
    expect(pageOverflow).toBeLessThanOrEqual(0);
    expect(code).toBe('auto');
    await expect(page.locator('.prose-code')).toHaveCSS('font-family', /JetBrains Mono/);
  });
});

test.describe('Markdown (FD-37)', () => {
  test('raw HTML is escaped, headings get ids, external links get rel="noopener"', () => {
    const html = renderMarkdown(
      [
        '<script>alert(1)</script>',
        '',
        'Inline <b>bold</b> and [a link](https://example.com) and [inside](/blog.html).',
        '',
        '## Same title',
        '',
        '## Same title',
        '',
        '# Top level',
      ].join('\n'),
    );
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">a link<span class="visually-hidden"> (opens in a new tab)</span>',
    );
    expect(html).toContain('<a href="/blog.html">inside</a>');
    expect(html).toContain('<h2 id="same-title">');
    expect(html).toContain('<h2 id="same-title-2">');
    // The page <h1> is the post title; a body "#" heading becomes h2.
    expect(html).toContain('<h2 id="top-level">');
    expect(html).not.toContain('<h1');
  });

  test('only whole bracketed paragraphs are placeholders', () => {
    const html = renderMarkdown('[Placeholder copy]\n\n[ESP32](https://example.com) is a board.');
    expect(html).toContain('<p class="is-placeholder">[Placeholder copy]</p>');
    expect(html).toContain(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">ESP32<span',
    );
  });

  test('code and tables are named regions that scroll inside the measure', () => {
    const html = renderMarkdown('```js\nx\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |');
    expect(html).toContain(
      '<pre class="prose-code" tabindex="0" role="region" aria-label="Code sample (js)">',
    );
    expect(html).toContain(
      '<div class="prose-table" tabindex="0" role="region" aria-label="Table"><table>',
    );
    expect(html).toContain('</table></div>');
  });

  test('links other than http(s), mailto and site paths fail the build', () => {
    expect(() => renderMarkdown('[x](javascript:alert(1))')).toThrow(/not allowed/);
    expect(() => renderMarkdown('[x](data:text/html,hi)')).toThrow(/not allowed/);
    const ok = renderMarkdown('[a](mailto:a@b.co) [b](/blog.html) [c](#top) [d](post-x.html)');
    expect(ok.match(/<a /g)).toHaveLength(4);
  });

  test('images are refused until post images are supplied', () => {
    expect(() => renderMarkdown('![alt](/x.png)')).toThrow(/not supported/);
  });

  test('reading time is at least one minute and grows with the text', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('word '.repeat(1000))).toBe(5);
  });
});

test.describe('Drafts (FD-36)', () => {
  test('the data layer leaves drafts out when showDrafts is false', () => {
    const content = loadContent();
    const release = buildSite(content, { showDrafts: false });
    expect(release.postList).toEqual([]);
    expect(release.counts.posts).toBe(0);
    expect(release.categories.every((category) => category.count === 0)).toBe(true);

    const published = structuredClone(content);
    published.blog[1].status = 'published';
    const one = buildSite(published, { showDrafts: false });
    expect(one.postList.map((post) => post.slug)).toEqual([content.blog[1].slug]);
    expect(one.postList[0].draft).toBe(false);
    expect(one.postList[0].prev).toBeUndefined();
    expect(one.postList[0].next).toBeUndefined();
  });

  test('a SHOW_DRAFTS=false build has an empty Blog and no post pages', () => {
    test.setTimeout(120_000);
    const outDir = mkdtempSync(join(tmpdir(), 'blog-release-'));
    try {
      const result = spawnSync(
        process.execPath,
        ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir, '--logLevel', 'error'],
        { env: { ...process.env, SHOW_DRAFTS: 'false' }, encoding: 'utf8' },
      );
      expect(result.status, result.stderr).toBe(0);

      const files = readdirSync(outDir).filter((file) => file.endsWith('.html'));
      expect(files.filter((file) => file.startsWith('post-'))).toEqual([]);
      expect(files).toContain('blog-post.html');

      const blog = readFileSync(join(outDir, 'blog.html'), 'utf8');
      expect(blog).toContain(site.blogPage.empty);
      expect(blog).not.toMatch(/data-blog-empty\s+hidden/);
      expect(blog).not.toContain('data-category-filter');
      expect(blog).not.toContain('data-draft-label');
      expect(blog).not.toContain(site.blogPage.eyebrow_draft);

      // No draft title, page link or BlogPosting anywhere in the release build.
      for (const file of files) {
        const html = readFileSync(join(outDir, file), 'utf8');
        for (const post of posts) {
          expect(html, file).not.toContain(post.title);
          expect(html, file).not.toContain(post.file);
        }
        expect(html, file).not.toContain('"BlogPosting"');
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
