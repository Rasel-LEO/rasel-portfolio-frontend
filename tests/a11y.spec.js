// Author: Rasel Al Mamun
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures.js';
import { isDjango, revealAll, templatePages, themes, useTheme } from './pages.js';

// The template pages plus two generated project pages (one with a publication, one without)
// and one generated post page (none on Django, which publishes no post).
const scanned = [
  ...templatePages,
  'project-biofloc-iot.html',
  'project-ice-storage-boxes.html',
  // The other full detail page and a reduced one.
  'project-solar-irrigation.html',
  'project-egg-incubator.html',
  // Django publishes no post (FD-137).
  ...(isDjango ? [] : ['post-edge-ai-poultry-farm.html']),
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

// FD-139: the axe contrast rule on the new brand parts — header, footer signature and the form
// notice — in both themes, and the logo colours against the page background (the brand's ratios:
// logo amber 4.6:1 light, lamp amber 9.8:1 dark; ink and bone as fg-0).
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const theme of themes) {
  for (const width of [390, 1440]) {
    test(`brand contrast (${theme}, ${width}px): header, footer, notice`, async ({ page }) => {
      await useTheme(page, theme);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/contact.html');
      await revealAll(page);
      const results = await new AxeBuilder({ page })
        .include('.site-header')
        .include('.site-footer')
        .include('.form-notice')
        .withRules(['color-contrast'])
        .analyze();
      expect(results.violations).toEqual([]);
      expect(results.passes.length).toBeGreaterThan(0);
    });
  }
}

test('logo colours meet the brand ratios on the page background', () => {
  const tokens = JSON.parse(readFileSync('src/design/tokens.json', 'utf8')).color.tokens;
  const value = (name, theme) => {
    const raw = tokens.find((token) => token.name === name).value[theme];
    return raw.startsWith('{') ? value(raw.slice(1, -1), theme) : raw;
  };
  for (const theme of themes) {
    const bg = value('bg-0', theme);
    expect(ratio(value('logo-accent', theme), bg), theme).toBeGreaterThanOrEqual(4.5);
    expect(ratio(value('logo-ink', theme), bg), theme).toBeGreaterThanOrEqual(7);
  }
  expect(value('logo-accent', 'light')).toBe('#9a6100');
  expect(value('logo-accent', 'dark')).toBe('#f0b23e');
  expect(value('logo-ink', 'light')).toBe('#15171b');
  expect(value('logo-ink', 'dark')).toBe('#eceae4');
});
