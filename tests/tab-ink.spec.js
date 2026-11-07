// Author: Rasel Al Mamun
// FD-191 (1.7.5): the tab underline is measured once the tabs' fonts are in, and again whenever a
// tab changes size. The Blog category row at 390 px must end exactly as it does without a delay:
// the underline under the pressed tab and the row scrolled only when that tab is hidden at the
// start. The race is forced: the web font arrives 1.5 s late and `document.fonts.ready` is the
// promise of the moment before the browser began the font load (already resolved) — what a page
// sees when its script reads it before the first layout. v1.7.4 then measured the row with the
// fallback widths, pre-scrolled "Agricultural engineering" and never undid it (fails there).
import { expect, test } from './fixtures.js';
import { buildSite } from '../tools/content.mjs';
import { isDjango } from './pages.js';

const site = buildSite();

// The settled state of a tab row: underline vs pressed tab, and the scroll it should have.
const state = (group) =>
  group.evaluate((row) => {
    const pressed = row.querySelector('[aria-pressed="true"], [aria-current="page"]');
    const ink = row.querySelector('.pf-tab-ink');
    const max = row.scrollWidth - row.clientWidth;
    return {
      set: row.classList.contains('is-set'),
      inkX: parseFloat(ink.style.getPropertyValue('--ink-x')),
      inkW: parseFloat(ink.style.getPropertyValue('--ink-w')),
      tabX: pressed.offsetLeft,
      tabW: pressed.offsetWidth,
      scroll: Math.round(row.scrollLeft),
      // tab-ink.js scrolls only a tab hidden at the start, to the tab's start (a snap point).
      expected:
        pressed.offsetLeft + pressed.offsetWidth > row.clientWidth
          ? Math.round(Math.min(pressed.offsetLeft, max))
          : 0,
      inView:
        pressed.offsetLeft >= row.scrollLeft - 1 &&
        pressed.offsetLeft + pressed.offsetWidth <= row.scrollLeft + row.clientWidth + 1,
    };
  });

test.describe('tab underline after a late web font (FD-191)', () => {
  test.skip(isDjango, 'Django: the seed posts are drafts and Django does not publish drafts');

  const cases = [
    ['no delay', 0, false],
    ['font 1500 ms late', 1500, false],
    ['font 1500 ms late, fonts.ready read before the load', 1500, true],
  ];
  for (const [name, delay, early] of cases) {
    for (const category of site.categories) {
      test(`390: Blog category "${category.label}", ${name}`, async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        if (early) {
          await page.addInitScript(() => {
            const before = document.fonts.ready;
            Object.defineProperty(document.fonts, 'ready', { get: () => before });
          });
        }
        if (delay) {
          await page.route(/bricolage[^/]*\.woff2$/, async (route) => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            await route.continue();
          });
        }
        await page.goto(`/blog-category-${category.id}.html`);
        await page.waitForFunction(
          () =>
            document.fonts.check('600 16px "Bricolage Grotesque"') &&
            document.fonts.status === 'loaded',
        );
        const group = page.getByRole('navigation', { name: 'Blog categories' });
        await expect
          .poll(async () => {
            const s = await state(group);
            return (
              s.set &&
              Math.abs(s.inkX - s.tabX) < 0.5 &&
              Math.abs(s.inkW - s.tabW) < 0.5 &&
              s.inView &&
              Math.abs(s.scroll - s.expected) <= 1
            );
          })
          .toBe(true);
        // Stable: nothing moves after the font is in.
        const before = await state(group);
        await page.waitForTimeout(400);
        expect(await state(group)).toEqual(before);
      });
    }
  }
});
