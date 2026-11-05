// Author: Rasel Al Mamun
// FD-142: the rich-content styles. The two template pages carry one sample of each rich element
// in Django's exact output (src/partials/samples/): the markup is checked byte for byte against
// the build, the elements render in both themes, the code tokens and the math meet AA contrast,
// and wide formulas and tables scroll inside their own region at 320 and 390 px, never the page.
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures.js';
import { isDjango, pages, revealAll, themes, useTheme } from './pages.js';

test.skip(isDjango, 'Django: the template pages have no Django URL (FD-137)');

const samples = {
  'blog-post.html': 'src/partials/samples/rich-post.hbs',
  'portfolio-entry.html': 'src/partials/samples/rich-overview.hbs',
};

// The sample as the partial holds it: Django's bytes after the Handlebars comment.
const sampleMarkup = (file) =>
  readFileSync(file, 'utf8')
    .replace(/^(?:\{\{!--[\s\S]*?--\}\}\n)+/, '')
    .trimEnd();

test('the samples are in the two template pages exactly as Django renders them', () => {
  for (const [page, partial] of Object.entries(samples)) {
    const markup = sampleMarkup(partial);
    expect(markup).not.toContain('{{');
    // Vite hashes the image URLs; everything else is byte for byte.
    const pattern = markup
      .split(/\/images\/avatar\/avatar-(\d+)\.webp/)
      .map((part, i) =>
        i % 2
          ? `/assets/avatar-${part}-[\\w-]+\\.webp`
          : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('');
    expect(readFileSync(`dist/${page}`, 'utf8'), page).toMatch(new RegExp(pattern));
  }
  // The full contract's constructs are all in the post sample.
  const post = sampleMarkup(samples['blog-post.html']);
  for (const construct of [
    '<div class="rt-content">',
    '<math display="inline">',
    '<div class="rt-math-display" tabindex="0" role="region" aria-label="Formula 1, scrollable"><math display="block">',
    '<pre class="rt-code" tabindex="0" role="region" aria-label="Code block 1, scrollable"><code class="language-python"><span class="tok-k">',
    '<pre tabindex="0" role="region" aria-label="Code block 2, scrollable"><code>',
    '<div class="rt-table-scroll" role="region" tabindex="0" aria-label="Table 1, scrollable"><table>',
    '<blockquote>',
    '<hr>',
    '<mark>',
    '<sub>',
    '<sup>',
    '<figure class="rt-figure rt-figure-wide"><picture>',
    '<figure class="rt-figure rt-figure-narrow rt-align-center"><picture>',
    '<figure class="rt-figure rt-figure-decorative"><picture>',
    '<p class="rt-align-center">',
    '<span class="rt-color-accent">',
    '<span class="rt-size-xl">',
  ]) {
    expect(post, construct).toContain(construct);
  }
  const overview = sampleMarkup(samples['portfolio-entry.html']);
  expect(overview.startsWith('<div class="project-text project-rich"><p>')).toBe(true);
  for (const construct of ['<ul>', '<ol>', '<code>', '<math display="inline">', '<br>', '<a ']) {
    expect(overview, construct).toContain(construct);
  }
});

test('the samples appear on the template pages only', () => {
  for (const file of pages.filter((name) => !Object.keys(samples).includes(name))) {
    const html = readFileSync(`dist/${file}`, 'utf8');
    expect(html, file).not.toContain('rt-content');
    expect(html, file).not.toContain('project-rich');
  }
});

// WCAG contrast of an opaque text colour on an opaque background (both "rgb(…)").
const ratio = (fg, bg) => {
  const lum = (rgb) => {
    const [r, g, b] = rgb.match(/[\d.]+/g).map((v) => Number(v) / 255);
    const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// The colour of the nearest opaque background behind an element.
const backgroundOf = (locator) =>
  locator.evaluate((el) => {
    for (let node = el; node; node = node.parentElement) {
      const bg = getComputedStyle(node).backgroundColor;
      if (!/rgba\(.*, 0\)$|transparent/.test(bg)) return bg;
    }
    return getComputedStyle(document.body).backgroundColor;
  });

for (const theme of themes) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await useTheme(page, theme);
    });

    test('post sample: every element renders with the design tokens', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/blog-post.html');
      await revealAll(page);
      const rich = page.locator('.prose .rt-content');
      await expect(rich).toHaveCount(1);
      const token = (name) =>
        page.evaluate(
          (n) => getComputedStyle(document.documentElement).getPropertyValue(`--${n}`).trim(),
          name,
        );
      const rgb = (hex) =>
        page.evaluate((value) => {
          const probe = document.createElement('span');
          probe.style.color = value;
          document.body.append(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        }, hex);
      const color = (selector) =>
        rich
          .locator(selector)
          .first()
          .evaluate((el) => getComputedStyle(el).color);
      // Code tokens on the design-system colours.
      expect(await color('.tok-k')).toBe(await rgb(await token('accent')));
      expect(await color('.tok-sd')).toBe(await rgb(await token('success')));
      expect(await color('.tok-mf')).toBe(await rgb(await token('error')));
      expect(await color('.tok-nf')).toBe(await rgb(await token('info')));
      expect(await color('.tok-c1')).toBe(await rgb(await token('fg-2')));
      // The code block on the raised surface; inline code on the elevated one.
      const pre = rich.locator('pre.rt-code');
      expect(await pre.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
        await rgb(await token('bg-1')),
      );
      expect(await pre.evaluate((el) => getComputedStyle(el).fontFamily)).toContain(
        'JetBrains Mono',
      );
      expect(
        await rich.locator('p > code').evaluate((el) => getComputedStyle(el).backgroundColor),
      ).toBe(await rgb(await token('bg-2')));
      // Math in primary text, drawn in the browser's math font (so the site's subset fonts need
      // none of its characters, tools/subset-fonts.mjs); the quotation's rule in the accent.
      expect(await color('math')).toBe(await rgb(await token('fg-0')));
      for (const math of await rich.locator('math').all()) {
        expect(await math.evaluate((el) => getComputedStyle(el).fontFamily)).toBe('math');
      }
      expect(
        await rich.locator('blockquote').evaluate((el) => getComputedStyle(el).borderLeftColor),
      ).toBe(await rgb(await token('accent')));
      // Nested lists cycle their markers.
      expect(await rich.locator('ul ul').evaluate((el) => getComputedStyle(el).listStyleType)).toBe(
        'circle',
      );
      // Figures: the images load; wide fills the column; narrow is at most 24rem and centred.
      const figures = rich.locator('figure.rt-figure');
      await expect(figures).toHaveCount(3);
      for (const img of await figures.locator('img').all()) {
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeTruthy();
      }
      const box = (locator) => locator.evaluate((el) => el.getBoundingClientRect().toJSON());
      const wide = await box(rich.locator('.rt-figure-wide img'));
      const column = await box(rich);
      expect(Math.round(wide.width)).toBe(Math.round(column.width));
      const narrow = await box(rich.locator('.rt-figure-narrow'));
      expect(narrow.width).toBeLessThanOrEqual(384);
      expect(Math.abs(narrow.left - column.left - (column.right - narrow.right))).toBeLessThan(2);
      expect(
        await rich
          .locator('.rt-figure-narrow figcaption')
          .evaluate((el) => getComputedStyle(el).textAlign),
      ).toBe('center');
      await expect(rich.locator('.rt-figure-decorative img')).toHaveAttribute('alt', '');
      // The text vocabulary.
      expect(await color('.rt-color-red')).toBe(await rgb(await token('error')));
      // FD-144: orange and purple have their own tokens.
      expect(await color('.rt-color-orange')).toBe(await rgb(await token('text-orange')));
      expect(await color('.rt-color-purple')).toBe(await rgb(await token('text-purple')));
      expect(
        await rich.locator('p.rt-align-center').evaluate((el) => getComputedStyle(el).textAlign),
      ).toBe('center');
    });

    test('project sample: the rich Overview renders with the design tokens', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/portfolio-entry.html');
      await revealAll(page);
      const rich = page.locator('.project-text.project-rich');
      await expect(rich).toHaveCount(1);
      await expect(page.locator('#overview-title')).toHaveText('Overview');
      const code = await rich
        .locator('code')
        .evaluate((el) => [getComputedStyle(el).fontFamily, getComputedStyle(el).backgroundColor]);
      expect(code[0]).toContain('JetBrains Mono');
      expect(code[1]).not.toMatch(/rgba\(0, 0, 0, 0\)/);
      expect(
        await rich
          .locator('ul')
          .first()
          .evaluate((el) => getComputedStyle(el).paddingLeft),
      ).not.toBe('0px');
      await expect(rich.locator('math')).toHaveCount(1);
    });

    test('code tokens and math meet AA contrast (computed and axe)', async ({ page }) => {
      await page.goto('/blog-post.html');
      await revealAll(page);
      const pre = page.locator('pre.rt-code');
      const surface = await backgroundOf(pre);
      const tokens = await pre
        .locator('[class^="tok-"]')
        .evaluateAll((spans) =>
          spans
            .filter((span) => span.textContent.trim())
            .map((span) => [span.className, getComputedStyle(span).color]),
        );
      expect(tokens.length).toBeGreaterThan(10);
      for (const [name, fg] of tokens) {
        expect(ratio(fg, surface), `${name} ${fg} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const file of ['blog-post.html', 'portfolio-entry.html']) {
        await page.goto(`/${file}`);
        await revealAll(page);
        for (const math of await page.locator('math').all()) {
          const fg = await math.evaluate((el) => getComputedStyle(el).color);
          expect(ratio(fg, await backgroundOf(math)), file).toBeGreaterThanOrEqual(4.5);
        }
        const results = await new AxeBuilder({ page })
          .include(file === 'blog-post.html' ? '.rt-content' : '.project-rich')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(results.violations, file).toEqual([]);
      }
    });

    for (const width of [320, 390]) {
      test(`${width}px: wide math and tables scroll inside their region, not the page`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto('/blog-post.html');
        await revealAll(page);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        for (const selector of ['.rt-math-display', '.rt-table-scroll', 'pre.rt-code']) {
          const region = page.locator(selector);
          const sizes = await region.evaluate((el) => ({
            scroll: el.scrollWidth,
            client: el.clientWidth,
            overflowX: getComputedStyle(el).overflowX,
            right: el.getBoundingClientRect().right,
          }));
          expect(['auto', 'scroll'], selector).toContain(sizes.overflowX);
          expect(sizes.right, selector).toBeLessThanOrEqual(width);
          // Focusable, so a keyboard user can scroll it.
          await expect(region).toHaveAttribute('tabindex', '0');
          if (selector === '.rt-math-display') {
            // The sample formula is wider than a phone: it scrolls inside its wrapper.
            expect(sizes.scroll, selector).toBeGreaterThan(sizes.client);
          }
        }
        await page.goto('/portfolio-entry.html');
        await revealAll(page);
        const projectOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(projectOverflow).toBeLessThanOrEqual(0);
      });
    }
  });
}
