// Author: Rasel Al Mamun
// Release 1.6.0, round 4 (FD-163 … FD-169): the items that have no test of their own elsewhere —
// footer and menu (S2, S3), the header's Hire me (S4), post meta and mobile "On this page" (P1, P2),
// publication rows (U1, U2), project status (R1), Hire me (F2, F4), the privacy table (V1).
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures.js';
import { buildSite, loadContent } from '../tools/content.mjs';
import { isDjango, pagePath, pages, themes, useTheme } from './pages.js';

const content = loadContent();
const site = buildSite(content);

const box = (locator) => locator.boundingBox();

test.describe('footer bottom row (S2)', () => {
  test('390: the copyright with the Privacy Policy under it on the left, Theme on the right, centred', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    const row = page.locator('.site-footer-bottom');
    const legal = await box(row.locator('.footer-legal'));
    const copyright = await box(row.locator('.footer-copyright'));
    const privacy = await box(row.locator('.footer-privacy-link'));
    const theme = await box(row.locator('.theme-button'));
    expect(copyright.y).toBeLessThan(privacy.y);
    expect(Math.abs(copyright.x - privacy.x)).toBeLessThanOrEqual(2);
    expect(theme.x).toBeGreaterThan(legal.x + legal.width - 1);
    expect(Math.abs(theme.y + theme.height / 2 - (legal.y + legal.height / 2))).toBeLessThanOrEqual(
      2,
    );
    expect(theme.height).toBeGreaterThanOrEqual(44);
  });

  test('1440: one row as before — copyright and Privacy Policy left, Theme right', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    const legal = await box(page.locator('.footer-legal'));
    const theme = await box(page.locator('.site-footer .theme-button'));
    expect(theme.x).toBeGreaterThan(legal.x + legal.width);
    expect(Math.abs(theme.y + theme.height / 2 - (legal.y + legal.height / 2))).toBeLessThanOrEqual(
      30,
    );
  });
});

test.describe('menu Theme button (S3)', () => {
  test('the drawer button is the footer component, with an icon and the current state', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Menu' }).click();
    const drawer = page.locator('#drawer');
    const button = drawer.locator('.theme-button');
    await expect(button).toBeVisible();
    await expect(button).toHaveClass(/btn-secondary/);
    await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(2);
    await expect(button.locator('[data-theme-state]')).toHaveText('Dark');
    await expect(button).toHaveAccessibleName('Theme: dark');
    await button.click();
    await expect(button.locator('[data-theme-state]')).toHaveText('Light');
    await expect(button).toHaveAccessibleName('Theme: light');
    // The same component as the footer's: the same classes and the same two icons.
    const footerClass = await page.locator('.site-footer .theme-button').getAttribute('class');
    expect(footerClass).toContain('theme-button');
    await expect(page.locator('.site-footer .theme-button svg')).toHaveCount(2);
  });
});

test.describe('header Hire me on /hire (S4)', () => {
  test('outlined with aria-current="page" on /hire; filled elsewhere', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hire.html');
    const cta = page.locator('.site-header .hire-cta');
    await expect(cta).toHaveAttribute('aria-current', 'page');
    const look = () =>
      cta.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, border: cs.borderTopColor, color: cs.color };
      });
    const outlined = await look();
    expect(outlined.bg).toBe('rgba(0, 0, 0, 0)');
    expect(outlined.border).toBe(outlined.color);
    await page.goto('/index.html');
    await expect(cta).not.toHaveAttribute('aria-current', /.*/);
    const filled = await look();
    expect(filled.bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  for (const theme of themes) {
    test(`contrast is AA in the ${theme} theme`, async ({ page }) => {
      await useTheme(page, theme);
      await page.goto('/hire.html');
      const result = await new AxeBuilder({ page })
        .include('.site-header')
        .withRules(['color-contrast'])
        .analyze();
      expect(result.violations).toEqual([]);
    });
  }
});

test.describe('posts (P1, P2)', () => {
  test('"Published d Month yyyy · n min read" once a post has a date; none without', () => {
    const dated = structuredClone(content);
    dated.blog[0] = { ...dated.blog[0], status: 'published', date: '2026-10-26' };
    const built = buildSite(dated, { showDrafts: true });
    expect(built.postList[0].dateLabel).toBe('26 October 2026');
    expect(built.postList[1].dateLabel).toBeNull();
    const template = readFileSync('src/pages/blog-post.html', 'utf8');
    expect(template).toMatch(
      /Published\s*<time datetime="\{\{post\.date\}\}">\{\{post\.dateLabel\}\}/,
    );
  });

  test('the Draft badge shows on an unpublished post only', async ({ page }) => {
    test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
    await page.goto(`/${site.postList[0].file}`);
    await expect(page.locator('.page-head .chip-draft')).toHaveCount(1);
    await expect(page.locator('.entry-meta')).not.toContainText('Published');
  });

  test('mobile "On this page": a closed <details>, only with three or more headings', () => {
    const body = (n) =>
      Array.from({ length: n }, (_, i) => `## Heading ${i + 1}\n\nText.`).join('\n\n');
    for (const [headings, expected] of [
      [2, false],
      [3, true],
      [4, true],
    ]) {
      const built = buildSite(content, {
        showDrafts: true,
        bodies: Object.fromEntries(content.blog.map((post) => [post.slug, body(headings)])),
      });
      expect(built.postList[0].toc, `${headings} headings`).toHaveLength(headings);
      expect(built.postList[0].tocLong, `${headings} headings`).toBe(expected);
    }
    const template = readFileSync('src/pages/blog-post.html', 'utf8');
    // A details element (works without JavaScript), closed by default, hidden from lg up.
    expect(template).toMatch(/<details class="post-toc-mobile d-lg-none">/);
    expect(template).not.toMatch(/<details[^>]*\sopen/);
    // The sample posts have two headings: no box on their pages.
  });

  test('the sample posts have no mobile box (two headings)', async ({ page }) => {
    test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${site.postList[0].file}`);
    await expect(page.locator('details.post-toc-mobile')).toHaveCount(0);
  });
});

test.describe('publication rows (U1, U2)', () => {
  test('1440: DOI on every row, Project only where linked, the actions in one fixed column', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/publications.html');
    const rows = page.locator('[data-pub-row]');
    const count = await rows.count();
    expect(count).toBe(site.publications.length);
    const columns = [];
    for (let i = 0; i < count; i += 1) {
      const row = rows.nth(i);
      const pub = site.publications[i];
      await expect(row.getByRole('link', { name: /^DOI/ })).toHaveCount(1);
      await expect(row.getByRole('link', { name: /^Project/ })).toHaveCount(pub.project ? 1 : 0);
      columns.push(await box(row.locator('.pf-pub-actions')));
    }
    const lefts = columns.map((c) => Math.round(c.x));
    const widths = columns.map((c) => Math.round(c.width));
    expect(new Set(lefts).size).toBe(1);
    expect(new Set(widths).size).toBe(1);
  });

  test('1440: a long title takes the width up to the actions column', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/publications.html');
    const body = await box(page.locator('.pf-pub-body').first());
    const actions = await box(page.locator('.pf-pub-actions').first());
    expect(actions.x - (body.x + body.width)).toBeLessThanOrEqual(40);
  });

  test('390: the actions move under the title', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/publications.html');
    const body = await box(page.locator('.pf-pub-body').first());
    const actions = await box(page.locator('.pf-pub-actions').first());
    expect(actions.y).toBeGreaterThanOrEqual(body.y + body.height - 1);
  });
});

test.describe('project status (R1)', () => {
  test('no page shows "[Status]"; the labels are In progress, Completed, Planned', () => {
    for (const file of pages) {
      const html = readFileSync(`dist/${file}`, 'utf8');
      expect(html, file).not.toContain('[Status]');
      expect(html, file).not.toMatch(/class="status[^>]*>[^<]*(<[^>]+>)*\s*Done\b/);
    }
    const chip = readFileSync('src/partials/components/status-chip.hbs', 'utf8');
    for (const label of ['In progress', 'Completed', 'Planned']) expect(chip).toContain(label);
    expect(chip).not.toMatch(/>Done</);
  });
});

test.describe('Hire me head and layout (F2, F4)', () => {
  test('1440: title left; the availability line and Start a brief right, no CV button', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hire.html');
    const h1 = await box(page.locator('.hire-head h1'));
    const aside = await box(page.locator('.hire-head-row .band-actions'));
    expect(aside.x).toBeGreaterThan(h1.x + h1.width - 1);
    await expect(page.locator('.hire-head .availability')).toContainText(site.hire.availability);
    await expect(
      page.locator('.hire-head').getByRole('link', { name: 'Start a brief' }),
    ).toBeVisible();
    await expect(page.locator('.hire-head').getByRole('link', { name: /Download CV/ })).toHaveCount(
      0,
    );
  });

  for (const width of [320, 390, 480]) {
    test(`${width}: the availability line, the title and Start a brief stack`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/hire.html');
      const h1 = await box(page.locator('.hire-head h1'));
      const line = await box(page.locator('.hire-head .availability'));
      const button = await box(
        page.locator('.hire-head').getByRole('link', { name: 'Start a brief' }),
      );
      // Round 6 (FD-176): HIRE ME, the availability line, the title, then the button.
      expect(h1.y).toBeGreaterThanOrEqual(line.y + line.height - 1);
      expect(button.y).toBeGreaterThanOrEqual(h1.y + h1.height - 1);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBeLessThanOrEqual(0);
    });
  }

  test('Start a brief scrolls to the form and focuses its first field', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hire.html');
    await page.locator('.hire-head').getByRole('link', { name: 'Start a brief' }).click();
    await expect(page.locator('#hire-name')).toBeFocused();
  });

  test('1440: the cards start level with the Name field and run What to expect, CV, Also', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hire.html');
    const field = await box(
      page.locator('#hire-name').locator('xpath=ancestor::*[contains(@class, "field")][1]'),
    );
    const aside = await box(page.locator('.form-aside'));
    expect(Math.abs(aside.y - field.y)).toBeLessThanOrEqual(2);
    await expect(page.locator('.form-aside .aside-box h2')).toHaveText([
      'What to expect',
      'CV',
      'Also',
    ]);
    await expect(page.locator('.expect-item')).toHaveCount(3);
    await expect(page.locator('.expect-box')).toContainText('Within 24–48 hours');
    await expect(page.locator('.expect-box')).toContainText('Mymensingh, Bangladesh (UTC+6)');
    await expect(page.locator('.expect-box')).toContainText('English, Bengali');
  });

  test('390: the cards go below the form', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hire.html');
    const form = await box(page.locator('form[data-form="hire"]'));
    const aside = await box(page.locator('.form-aside'));
    expect(aside.y).toBeGreaterThan(form.y + form.height - 1);
  });

  test('Contact: What to expect is level with the Name field', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/contact.html');
    const form = await box(page.locator('form[data-form="contact"]'));
    const aside = await box(page.locator('.form-aside'));
    expect(Math.abs(aside.y - form.y)).toBeLessThanOrEqual(2);
    await expect(page.locator('.form-aside .aside-box h2')).toHaveText([
      'What to expect',
      "Who I'd like to hear from",
    ]);
  });
});

test.describe('child-page back links (S5)', () => {
  for (const [file, label, href] of [
    ['research.html', 'Portfolio', '/portfolio.html'],
    ['publications.html', 'Portfolio', '/portfolio.html'],
    ['project-biofloc-iot.html', 'Projects', '/research.html'],
  ]) {
    test(`${file}: "← ${label}" at the top of the page`, async ({ page }) => {
      await page.goto(`/${file}`);
      const back = page.getByRole('navigation', { name: 'Back' });
      await expect(back).toHaveCount(1);
      await expect(back.getByRole('link')).toHaveText(label);
      await expect(back.getByRole('link')).toHaveAttribute('href', pagePath(href.slice(1)));
      const link = await box(back.getByRole('link'));
      const h1 = await box(page.locator('h1'));
      expect(link.y).toBeLessThan(h1.y);
      // No tab bar look: no ink line, no border under it.
      await expect(back.locator('.pf-tab-ink')).toHaveCount(0);
    });
  }
});

test.describe('privacy table on phones (V1)', () => {
  test('390: each row is a stacked block with its column labels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/privacy.html');
    const table = page.locator('table[data-stack]');
    await expect(table).toHaveCount(1);
    const columns = await table.locator('thead th').allTextContents();
    const cells = table.locator('tbody tr').first().locator('td');
    for (const [i, label] of columns.slice(1).entries()) {
      await expect(cells.nth(i)).toHaveAttribute('data-label', label);
      expect(await cells.nth(i).evaluate((el) => getComputedStyle(el, '::before').content)).toBe(
        `"${label}"`,
      );
    }
    expect(await cells.first().evaluate((el) => getComputedStyle(el).display)).toBe('block');
    // Readable: no horizontal scroll inside the table's box, none on the page.
    const wrap = table.locator('xpath=..');
    expect(await wrap.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });

  test('1000: the table is a table', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await page.goto('/privacy.html');
    const cell = page.locator('table[data-stack] tbody td').first();
    expect(await cell.evaluate((el) => getComputedStyle(el).display)).toBe('table-cell');
    expect(await cell.evaluate((el) => getComputedStyle(el, '::before').content)).toBe('none');
  });
});
