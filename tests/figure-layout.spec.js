// Author: Rasel Al Mamun
// 1.7.0 reading column: on the project pages, the post pages and the hidden formatting page, every
// figure image (and, from 768 px, the page-top image) sits inside the text column (1 px tolerance)
// and is no taller than its limit: 520 px from 768 px, 60vh on phones.
import { existsSync } from 'node:fs';
import { expect, test } from './fixtures.js';
import { buildSite } from '../tools/content.mjs';
import { isDjango } from './pages.js';

test.skip(isDjango, 'static build only');

const site = buildSite();
const files = [
  ...site.projectList.filter((p) => p.detail).map((p) => p.file),
  ...site.postList.map((p) => p.file),
  ...(existsSync('src/pages/format-test.html') ? ['format-test.html'] : []),
];
const sizes = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

for (const file of files) {
  for (const { width, height } of sizes) {
    for (const theme of ['light', 'dark']) {
      test(`${file} · ${width} · ${theme}: figures and page-top image stay in the text column`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto(`/${file}`);
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
        await page.evaluate(() =>
          Promise.all(
            [...document.images].map((img) => {
              img.loading = 'eager';
              return img.decode().catch(() => {});
            }),
          ),
        );
        const m = await page.evaluate(() => {
          const rect = (el) => {
            const r = el.getBoundingClientRect();
            return { left: r.left, right: r.right, width: r.width, height: r.height };
          };
          const column = rect(document.querySelector('.prose'));
          const figures = [...document.querySelectorAll('figure.fig img')].map((img) => ({
            ...rect(img),
            column: rect(img.closest('.prose')),
          }));
          const cover = document.querySelector('.blog-cover img');
          return {
            column,
            figures,
            cover: cover && { ...rect(cover), frame: rect(cover.parentElement.parentElement) },
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });
        const limit = width >= 768 ? 520 : height * 0.6;
        expect(m.overflow).toBeLessThanOrEqual(0);
        expect(m.figures.length).toBeGreaterThan(0);
        for (const fig of m.figures) {
          expect(fig.left).toBeGreaterThanOrEqual(fig.column.left - 1);
          expect(fig.right).toBeLessThanOrEqual(fig.column.right + 1);
          expect(fig.height).toBeLessThanOrEqual(limit + 1);
        }
        if (m.cover) {
          if (width >= 768) {
            expect(Math.abs(m.cover.left - m.column.left)).toBeLessThanOrEqual(1);
            expect(Math.abs(m.cover.right - m.column.right)).toBeLessThanOrEqual(1);
          }
          expect(Math.abs(m.cover.width / m.cover.height - 16 / 9)).toBeLessThan(0.02);
        }
        console.log(
          `MEASURE ${file} ${width} ${theme} column=${m.column.width.toFixed(0)} maxFig=${Math.max(
            ...m.figures.map((f) => f.height),
          ).toFixed(0)}`,
        );
      });
    }
  }
}
