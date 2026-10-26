// Author: Rasel Al Mamun
import { expect, test } from '@playwright/test';
import { revealAll, templatePages, themes, useTheme, widths } from './pages.js';

const shots = 'tests/screenshots/widths';
// The full project page (Biofloc, Solar irrigation) and a reduced one (egg incubator).
const pages = [
  ...templatePages,
  'project-biofloc-iot.html',
  'project-solar-irrigation.html',
  'project-egg-incubator.html',
  'post-edge-ai-poultry-farm.html',
];

async function expectNoOverflow(page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

// FD-94, phones: the brand block, then Explore | Research profiles side by side (stacked under
// 360 px), then Connect, then the rule with Theme and the copyright — all left-aligned.
async function expectFooterColumn(page, width) {
  const box = (selector) =>
    page.locator(selector).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top), bottom: Math.round(r.bottom) };
    });
  const brand = await box('.footer-brand');
  const explore = await box('[aria-labelledby="footer-explore"]');
  const research = await box('[aria-labelledby="footer-research"]');
  const connect = await box('.footer-connect');
  const bottom = await box('.site-footer-bottom');
  expect(explore.top).toBeGreaterThanOrEqual(brand.bottom);
  if (width >= 360) {
    expect(research.top).toBe(explore.top);
    expect(research.left).toBeGreaterThan(explore.left);
  } else {
    expect(research.top).toBeGreaterThanOrEqual(explore.bottom);
    expect(research.left).toBe(explore.left);
  }
  expect(connect.top).toBeGreaterThanOrEqual(Math.max(explore.bottom, research.bottom));
  expect(bottom.top).toBeGreaterThanOrEqual(connect.bottom);
  // Left edges of the text (the columns carry the gutter).
  const lefts = await page
    .locator('.footer-name, #footer-explore, #footer-connect, .site-footer-bottom')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
  expect(new Set(lefts).size).toBe(1);
}

for (const theme of themes) {
  for (const page of pages) {
    for (const width of widths) {
      test(`${page} at ${width}px (${theme}) has no horizontal overflow`, async ({
        page: browserPage,
      }) => {
        await useTheme(browserPage, theme);
        await browserPage.setViewportSize({ width, height: 900 });
        await browserPage.goto(`/${page}`);
        await browserPage.evaluate(() => document.fonts.ready);
        await revealAll(browserPage);
        // The Home Contact band photo (md and up) is lazy: load it so it is in the screenshot,
        // not a blank box.
        const lazyFigure =
          page === 'index.html' && width >= 768 ? '.contact-band-figure img' : null;
        if (lazyFigure) {
          const img = browserPage.locator(lazyFigure);
          await img.scrollIntoViewIfNeeded();
          await expect
            .poll(() => img.evaluate((el) => el.complete && el.naturalWidth))
            .toBeGreaterThan(0);
          await browserPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        }

        await expectNoOverflow(browserPage);
        // Home hero (Phase 4 §2.2): the name never drops below 44 px and nothing in the
        // stage runs past the viewport. From 992 px the photo's box may, by its transparent
        // right third (clipped by the stage); its visible outline is tested in stage.spec.js
        // (FD-83).
        if (page === 'index.html') {
          const hero = await browserPage.evaluate(() => ({
            name: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize),
            wide: [...document.querySelectorAll('[data-stage] *')]
              .filter((el) => window.innerWidth < 992 || !el.closest('[data-stage-figure]'))
              .filter(
                (el) => el.getBoundingClientRect().right > document.documentElement.clientWidth,
              )
              .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''}`),
          }));
          expect(hero.name).toBeGreaterThanOrEqual(44);
          expect(hero.wide).toEqual([]);
        }
        if (width <= 390) await expectFooterColumn(browserPage, width);
        await browserPage.screenshot({
          path: `${shots}/${page.replace(/\.html$/, '')}-${width}-${theme}.png`,
          fullPage: true,
        });
      });
    }
  }

  for (const width of [320, 390]) {
    test(`drawer open at ${width}px (${theme})`, async ({ page: browserPage }) => {
      await useTheme(browserPage, theme);
      await browserPage.setViewportSize({ width, height: 844 });
      await browserPage.goto('/index.html');
      await browserPage.evaluate(() => document.fonts.ready);
      await browserPage.locator('[data-menu-button]').click();
      const drawer = browserPage.locator('#drawer');
      await expect(drawer).toHaveClass(/\bshow\b/);
      await expect(drawer).not.toHaveClass(/showing/);

      const overflow = await drawer.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await browserPage.screenshot({ path: `${shots}/drawer-${width}-${theme}.png` });
    });
  }
}
