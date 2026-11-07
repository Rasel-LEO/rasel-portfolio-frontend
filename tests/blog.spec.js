// Author: Rasel Al Mamun
// Blog and post pages (FD-36, FD-37): list, category filter with and without JS,
// generated post pages, Markdown rendering, and the SHOW_DRAFTS=false release build.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from './fixtures.js';
import { buildSite, loadContent } from '../tools/content.mjs';
import { readingMinutes, renderMarkdown } from '../tools/markdown.mjs';
import { isDjango, pagePath, postPages } from './pages.js';

const site = buildSite(loadContent(), { showDrafts: true });
const posts = site.postList;
// 1.7.4 (F23): counts and labels from the content, not the trial data's numbers.
const allCount = site.blogView.countText;
const markdownOf = (post) => readFileSync(`src/content/posts/${post.slug}.md`, 'utf8');
const h2Count = (post) => (markdownOf(post).match(/^## /gm) ?? []).length;
const codeCount = (post) => (markdownOf(post).match(/^```/gm) ?? []).length / 2;

test.describe('Blog list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog.html');
  });

  test('lists every post as an image card with category and Draft labels', async ({ page }) => {
    test.skip(
      isDjango,
      'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
    );
    const items = page.locator('[data-post-category]');
    await expect(items).toHaveCount(Math.min(posts.length, 9));
    for (const [i, post] of posts.slice(0, 9).entries()) {
      const item = items.nth(i);
      await expect(item.locator('.blog-card-category')).toHaveText(post.categoryLabel);
      const draft = post.draft ? ', Draft' : '';
      if (post.draft) await expect(item.locator('[data-draft-label]')).toHaveText('Draft');
      // 1.5.0: the category and "Draft" read as two words ("…, Draft"), and the link name says
      // the post is a draft.
      await expect(item.locator('.blog-card-meta')).toHaveText(`${post.categoryLabel}${draft}`);
      await expect(item.locator('.blog-card-link')).toHaveAccessibleName(
        `Read article: ${post.title}${post.draft ? ' (draft)' : ''}`,
      );
      const link = item.getByRole('link', { name: post.title });
      await expect(link).toHaveAttribute('href', pagePath(post.file));
      await expect(item.locator('.blog-card-excerpt')).toHaveText(post.card_description);
    }
    await expect(page.locator('[data-blog-empty]')).toBeHidden();
  });

  test('the category filter shows one category and announces the count', async ({ page }) => {
    test.skip(
      isDjango,
      'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
    );
    const group = page.getByRole('navigation', { name: 'Blog categories' });
    await expect(group).toBeVisible();
    const count = page.locator('.blog-count');
    await expect(count).toHaveText(allCount);

    for (const category of site.categories) {
      const button = group.getByRole('link', { name: category.label });
      await button.click();
      await expect(button).toHaveAttribute('aria-current', 'page');
      await expect(group.getByRole('link', { name: 'All' })).not.toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(count).toHaveText(category.countText);
      const visible = page.locator('[data-post-category]:visible');
      await expect(visible).toHaveCount(Math.min(category.count, 9));
      for (const item of await visible.all()) {
        await expect(item).toHaveAttribute('data-post-category', category.id);
      }
    }
    await group.getByRole('link', { name: 'All' }).click();
    await expect(page.locator('[data-post-category]:visible')).toHaveCount(
      Math.min(posts.length, 9),
    );
    await expect(count).toHaveText(allCount);
  });
});

test.describe('Blog without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every post is listed with its category label; the tabs are links', async ({ page }) => {
    test.skip(
      isDjango,
      'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
    );
    await page.goto('/blog.html');
    await expect(page.getByRole('navigation', { name: 'Blog categories' })).toBeVisible();
    await expect(page.locator('[data-post-category]:visible')).toHaveCount(
      Math.min(posts.length, 9),
    );
    for (const post of posts.slice(0, 9)) {
      await expect(page.getByRole('link', { name: post.title })).toBeVisible();
    }
  });
});

test.describe('Post pages', () => {
  test('one page per post', () => {
    test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
    expect(postPages).toEqual(posts.map((post) => post.file).sort());
  });

  for (const post of posts) {
    test(`${post.file} shows the post`, async ({ page }) => {
      test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
      const response = await page.goto(`/${post.file}`);
      expect(response.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(post.title);

      // P4, S5 (1.6.0): "← Blog / Category" — the category opens the filtered Blog.
      const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
      await expect(crumbs.getByRole('link', { name: 'Blog' })).toHaveAttribute(
        'href',
        pagePath('blog.html'),
      );
      await expect(crumbs.getByRole('link', { name: post.categoryLabel })).toHaveAttribute(
        'href',
        pagePath(`blog-category-${post.category}.html`),
      );
      await expect(page.locator('.entry-meta')).toHaveText(`${post.minutes} min read`);
      if (post.draft) await expect(page.locator('.page-head .chip-draft')).toHaveText('Draft');
      await expect(page.locator('.prose .standfirst')).toHaveText(post.standfirst);
      await expect(page.locator('.prose h2')).toHaveCount(h2Count(post));
      await expect(page.locator('.prose pre.prose-code code')).toHaveCount(codeCount(post));
      await expect(page.locator('.prose figure.fig figcaption')).toHaveCount(
        post.figures?.length ?? 0,
      );
      if (post.figures?.length) {
        await expect(page.locator('.prose figure.fig .fig-label').first()).toHaveText('Figure 1.');
      }
      await expect(page.getByRole('link', { name: 'Back to all articles' })).toHaveAttribute(
        'href',
        pagePath('blog.html'),
      );

      // FD-114: the sidebar's More posts replaces the previous / next pager.
      const more = page.getByRole('navigation', { name: 'More posts' });
      await expect(more.getByRole('link')).toHaveCount(posts.length - 1);
      // P3 (1.6.0): Previous / Next article above the footer; a side is absent where there is none.
      const index = posts.indexOf(post);
      const pager = page.getByRole('navigation', { name: 'More articles' });
      await expect(page.locator('a[rel="prev"]')).toHaveCount(index > 0 ? 1 : 0);
      await expect(page.locator('a[rel="next"]')).toHaveCount(index < posts.length - 1 ? 1 : 0);
      if (index > 0) {
        await expect(pager.locator('a[rel="prev"]')).toContainText('Previous article');
        await expect(pager.locator('a[rel="prev"]')).toContainText(posts[index - 1].title);
        await expect(pager.locator('a[rel="prev"]')).toContainText(posts[index - 1].categoryLabel);
      }

      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
      // FD-39, 1.7.4 (F02): meta_description, else the standfirst cut at a sentence (≤ 160).
      for (const selector of [
        'meta[name="description"]',
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
      ]) {
        await expect(page.locator(selector)).toHaveAttribute('content', post.description);
      }
      expect(post.description.length).toBeLessThanOrEqual(160);
      const ld = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent)));
      const postings = ld.filter((item) => item['@type'] === 'BlogPosting');
      expect(postings).toHaveLength(1);
      expect(postings[0]).toMatchObject({
        headline: post.title,
        description: post.description,
        inLanguage: 'en',
        articleSection: post.categoryLabel,
        author: { '@type': 'Person', name: site.profile.name },
        publisher: { '@type': 'Person', name: site.profile.name },
        // 1.7.4 (F06): the share image (absolute once SITE_URL is set, tests/release.spec.js).
        image: post.shareImage,
      });
      if (post.date) {
        expect(postings[0]).toMatchObject({ datePublished: post.date, dateModified: post.date });
      }
    });
  }

  test('code scrolls inside the measure at 320 px', async ({ page }) => {
    test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
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
      '<pre class="prose-code" tabindex="0" role="region" aria-label="Code block 1, scrollable">',
    );
    expect(html).toContain(
      '<div class="prose-table" tabindex="0" role="region" aria-label="Table 1, scrollable"><table>',
    );
    expect(html).toContain('</table></div>');
    // 1.5.0: each table region has its own name, numbered in the post (no repeated "Table"); a
    // new post starts at 1 again.
    const table = '| a | b |\n|---|---|\n| 1 | 2 |';
    const two = renderMarkdown(`${table}\n\ntext\n\n${table}`);
    expect(two).toContain('aria-label="Table 1, scrollable"><table>');
    expect(two).toContain('aria-label="Table 2, scrollable"><table>');
    expect(two).not.toContain('aria-label="Table"');
    expect(two.match(/<\/table><\/div>/g)).toHaveLength(2);
    expect(renderMarkdown(table)).toContain('aria-label="Table 1, scrollable"');
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
    expect(one.postList[0].prev).toBeNull();
    expect(one.postList[0].next).toBeNull();
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
