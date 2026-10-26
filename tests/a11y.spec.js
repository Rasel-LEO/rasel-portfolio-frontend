// Author: Rasel Al Mamun
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { revealAll, templatePages, themes, useTheme } from './pages.js';

// The template pages plus two generated project pages (one with a publication, one without)
// and one generated post page.
const scanned = [
  ...templatePages,
  'project-biofloc-iot.html',
  'project-ice-storage-boxes.html',
  // The other full detail page and a reduced one.
  'project-solar-irrigation.html',
  'project-egg-incubator.html',
  'post-edge-ai-poultry-farm.html',
];

// Scanned with every reveal run: axe skips the contrast of hidden elements and
// would misjudge half-faded ones, so the whole page is shown first.
const scan = async (page) => {
  await revealAll(page);
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
};

for (const theme of themes) {
  for (const page of scanned) {
    test(`${page} (${theme}) has no axe violations`, async ({ page: browserPage }) => {
      await useTheme(browserPage, theme);
      await browserPage.goto(`/${page}`);
      const applied = await browserPage.evaluate(
        () => document.documentElement.dataset.theme ?? 'dark',
      );
      expect(applied).toBe(theme);
      expect((await scan(browserPage)).violations).toEqual([]);
    });
  }

  // Forms in their error state (FD-38): every required field invalid, focus on the first.
  for (const page of ['hire.html', 'contact.html']) {
    test(`${page} form errors (${theme}) have no axe violations`, async ({ page: browserPage }) => {
      await useTheme(browserPage, theme);
      await browserPage.goto(`/${page}`);
      await browserPage.locator('form[data-form] button[type="submit"]').click();
      await expect(browserPage.locator('form [aria-invalid="true"]')).toHaveCount(3);
      expect((await scan(browserPage)).violations).toEqual([]);
    });
  }

  test(`drawer open at 390px (${theme}) has no axe violations`, async ({ page }) => {
    await useTheme(page, theme);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/blog.html');
    await page.locator('[data-menu-button]').click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    // Wait for the slide-in to finish so axe sees final colours.
    await expect(page.locator('#drawer.showing')).toHaveCount(0);
    expect((await scan(page)).violations).toEqual([]);
  });
}
