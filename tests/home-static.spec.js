// Author: Rasel Al Mamun
// Release 1.6.0, round 4 (FD-163): the motion is v1.5.1's again, so the "complete before the first
// scroll" checks of FD-162 are gone. What stays: screen 2 ("Hardware. Data. Software. Connected.",
// the pillars, Areas of work) and every section are fully visible and readable without JavaScript,
// with prefers-reduced-motion and in print. No empty band anywhere.
import { expect, test } from '@playwright/test';
import { loadContent } from '../tools/content.mjs';
import { isDjango } from './pages.js';

// 1.7.4 (F23): counts and strings from the content, not the trial data's numbers.
const content = loadContent();

test.skip(isDjango, 'static build behaviour (the Django pages carry the same markup and scripts)');

// What a visitor sees of an element: its own and its ancestors' opacity and visibility.
const probe = () => {
  const seen = (el) => {
    let opacity = 1;
    for (let node = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.visibility === 'hidden' || cs.display === 'none') return 0;
      opacity *= Number.parseFloat(cs.opacity);
    }
    return opacity;
  };
  const targets = [
    '.screen2-eyebrow',
    '.screen2-headline',
    '.screen2-support',
    '.screen2-pillars',
    '.screen2-grid',
    '[data-home="hire"]',
    '[data-home="contact"]',
  ];
  // The Contact photo is hidden below 768 px (H9).
  if (innerWidth >= 768) targets.push('[data-contact-figure]');
  const hidden = [];
  for (const selector of targets) {
    const el = document.querySelector(selector);
    if (!el) continue;
    if (seen(el) < 0.99) hidden.push(`${selector} (${seen(el)})`);
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) hidden.push(`${selector} has no box`);
  }
  // Every reveal and stage reveal is already in.
  for (const el of document.querySelectorAll('[data-reveal], .reveal, .stage-reveal')) {
    // (In print the class stays; the print rules show the element.)
    if ((!matchMedia('print').matches && el.classList.contains('is-pre')) || seen(el) < 0.99) {
      hidden.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
    }
  }
  // No empty band: between consecutive pieces of visible text or imagery in the page's content,
  // never more than 420 px (the biggest section padding is 192 px at both ends of a seam).
  const boxes = [...document.querySelectorAll('main *, .site-footer *')]
    .filter((el) => {
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      return (own || el.matches('img, svg')) && seen(el) > 0.5 && el.getClientRects().length;
    })
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => [r.top + scrollY, r.bottom + scrollY])
    .sort((a, b) => a[0] - b[0]);
  let reach = boxes[0]?.[1] ?? 0;
  let widest = 0;
  for (const [top, bottom] of boxes) {
    widest = Math.max(widest, top - reach);
    reach = Math.max(reach, bottom);
  }
  return { hidden, widest: Math.round(widest) };
};

const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  for (const size of WIDTHS) {
    test(`${size.width}px: screen 2 and every section are visible, no empty band`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto('/index.html');
      const result = await page.evaluate(`(${probe})()`);
      expect(result.hidden).toEqual([]);
      expect(result.widest).toBeLessThan(420);
      await expect(page.locator('.screen2-headline')).toContainText(
        content.home.screen2.headline_highlight,
      );
      await expect(page.locator('.screen2-grid .area')).toHaveCount(content.fields.length);
    });
  }
});

test.describe('with prefers-reduced-motion', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const size of WIDTHS) {
    test(`${size.width}px: complete without scrolling, and after scrolling the page through`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto('/index.html');
      await page.waitForTimeout(800);
      let result = await page.evaluate(`(${probe})()`);
      expect(result.hidden).toEqual([]);
      expect(result.widest).toBeLessThan(420);
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(500);
      result = await page.evaluate(`(${probe})()`);
      expect(result.hidden).toEqual([]);
      await expect(page.locator('[data-stage]')).not.toHaveClass(/is-staged/);
    });
  }
});

test.describe('in print', () => {
  for (const size of [WIDTHS[0], WIDTHS[2]]) {
    test(`${size.width}px: after the page has been scrolled, a printout shows every layer, unpinned`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto('/index.html');
      await page.waitForTimeout(800);
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(1200);
      await page.emulateMedia({ media: 'print' });
      await page.waitForTimeout(300);
      const result = await page.evaluate(`(${probe})()`);
      expect(result.hidden).toEqual([]);
      const stage = await page.locator('[data-stage]').evaluate((el) => ({
        position: getComputedStyle(el.firstElementChild).position,
        height: el.getBoundingClientRect().height,
      }));
      expect(stage.position).not.toBe('sticky');
      expect(stage.height).toBeLessThan(3000);
    });
  }
});
