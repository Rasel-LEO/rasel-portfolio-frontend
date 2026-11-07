// Author: Rasel Al Mamun
// 1.7.4 (F01): text contrast in the hover and focus states of every interactive element (links,
// buttons, controls) on every page type, in both themes — the QA audit's state check, kept as a
// test. Each element is hovered, then focused by keyboard, and axe's colour-contrast rule judges
// that element alone (WCAG 1.4.3: 4.5:1, 3:1 for large text). Transitions are switched off in the
// test so each state is measured in its final colours.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures.js';
import { isDjango, pagePath, postPages, projectPages, themes, useTheme } from './pages.js';

const scanned = [
  'index.html',
  'portfolio.html',
  'publications.html',
  'research.html',
  'blog.html',
  'hire.html',
  'contact.html',
  'privacy.html',
  '404.html',
  ...projectPages.slice(0, 1),
  ...postPages.slice(0, 1),
];

const NO_TRANSITIONS = '*, *::before, *::after { transition: none !important; }';

// WCAG relative luminance and contrast of two computed colours: rgb() (0–255) or, for a
// color-mix() fill, color(srgb …) (0–1).
const luminance = (colour) => {
  const scale = colour.startsWith('color(srgb') ? 1 : 255;
  const [r, g, b] = colour
    .replace(/^color\(srgb/, '')
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map((v) => {
      const c = Number(v) / scale;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test.describe('hover and focus contrast (F01)', () => {
  test.use({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 240_000 });

  for (const theme of themes) {
    for (const file of scanned) {
      test(`${file} (${theme}): every link and button keeps its contrast in hover and focus`, async ({
        page,
      }) => {
        test.skip(isDjango && file.startsWith('post-'), 'Django publishes no post (FD-137)');
        await useTheme(page, theme);
        await page.goto(pagePath(file));
        await page.addStyleTag({ content: NO_TRANSITIONS });
        await page.evaluate(() => document.fonts.ready);
        const count = await page.evaluate(() => {
          const els = [
            ...document.querySelectorAll(
              'main a[href], main button, header a[href], header button, footer a[href], footer button, .btn',
            ),
          ].filter(
            (el) =>
              el.getClientRects().length &&
              getComputedStyle(el).visibility !== 'hidden' &&
              el.textContent.trim() &&
              !el.closest('[aria-hidden="true"], [hidden]'),
          );
          els.forEach((el, i) => el.setAttribute('data-contrast-state', String(i)));
          return els.length;
        });
        expect(count).toBeGreaterThan(0);
        const failures = [];
        let checked = 0;
        for (let i = 0; i < count; i += 1) {
          const el = page.locator(`[data-contrast-state="${i}"]`);
          for (const state of ['hover', 'focus']) {
            await el.scrollIntoViewIfNeeded();
            if (state === 'hover') {
              await el.hover({ force: true });
            } else {
              await page.mouse.move(0, 0);
              await el.focus();
              // A key press makes the focus keyboard focus (:focus-visible).
              await page.keyboard.press('Shift');
            }
            const { violations } = await new AxeBuilder({ page })
              .include(`[data-contrast-state="${i}"]`)
              .withRules(['color-contrast'])
              .analyze();
            checked += 1;
            for (const violation of violations) {
              for (const node of violation.nodes) {
                failures.push(`${state} ${node.html.slice(0, 80)}: ${node.any[0]?.message}`);
              }
            }
          }
        }
        console.log(`${file} (${theme}): ${checked} states checked`);
        expect(failures).toEqual([]);
      });
    }
  }

  // The finding itself, measured directly: the primary button's label on its hover / focus fill.
  for (const theme of themes) {
    test(`primary button (${theme}): label on the hover and focus fill is at least 4.5:1`, async ({
      page,
    }) => {
      await useTheme(page, theme);
      await page.goto(pagePath('contact.html'));
      await page.addStyleTag({ content: NO_TRANSITIONS });
      const button = page.locator('main .btn-primary').first();
      const colours = () =>
        button.evaluate((el) => {
          const cs = getComputedStyle(el);
          return [cs.color, cs.backgroundColor];
        });
      const rest = await colours();
      await button.hover();
      const hover = await colours();
      await page.mouse.move(0, 0);
      await button.focus();
      await page.keyboard.press('Shift');
      const focus = await colours();
      for (const [state, [fg, bg]] of Object.entries({ rest, hover, focus })) {
        expect(contrast(fg, bg), `${theme} ${state}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
      // Hover is a different fill from rest (the state stays visible).
      expect(hover[1]).not.toBe(rest[1]);
    });
  }
});
