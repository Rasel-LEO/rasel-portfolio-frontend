// Author: Rasel Al Mamun
// Search and the release build (FD-131): noindex on the template pages, the SITE_URL-gated
// sitemap and robots line, the RELEASE=true build with the current (all-draft) content, and
// the reveal elements at 400 % zoom; no shipped image carries provenance metadata (FD-139).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { loadContent } from '../tools/content.mjs';
import { pages, templatePages } from './pages.js';

const templateOnly = ['portfolio-entry.html', 'blog-post.html'];

// A production build into a temporary folder with extra environment.
function buildInto(env) {
  const outDir = mkdtempSync(join(tmpdir(), 'release-'));
  const result = spawnSync(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir, '--logLevel', 'error'],
    {
      env: { ...process.env, SHOW_DRAFTS: '', SITE_URL: '', RELEASE: '', ...env },
      encoding: 'utf8',
    },
  );
  expect(result.status, result.stderr).toBe(0);
  return outDir;
}

// FD-139: every shipped image (public/, src/images/ and both builds) is free of metadata that
// names the generating tool or its vendor: neither name appears in plain text, and there is no
// C2PA / JUMBF block, XMP packet or EXIF block. PNGs keep only the chunks that draw the image,
// WebPs only their image chunks, AVIFs no uuid box; SVGs have no <metadata>. The names are
// stored base64-encoded so this file does not itself contain them.
const toolNames = ['Y2xhdWRl', 'YW50aHJvcGlj'].map((name) =>
  Buffer.from(name, 'base64').toString(),
);
const metadataMarker = new RegExp(
  [
    ...toolNames,
    'c2pa',
    'caBX',
    'jumb',
    'jumd',
    'xmpmeta',
    'ns\\.adobe\\.com/xap',
    'Exif\\0\\0',
  ].join('|'),
  'i',
);
const imageFile = /\.(png|ico|svg|webp|avif|jpe?g|gif)$/i;
const shippedImages = () =>
  ['public', 'src/images', 'dist', 'dist-django']
    .filter((dir) => existsSync(dir))
    .flatMap((dir) =>
      readdirSync(dir, { recursive: true })
        .filter((file) => imageFile.test(file))
        .map((file) => join(dir, file)),
    );
const pngChunks = (buffer) => {
  const types = [];
  for (let p = 8; p < buffer.length;) {
    const length = buffer.readUInt32BE(p);
    types.push(buffer.toString('latin1', p + 4, p + 8));
    p += 12 + length;
  }
  return types;
};
const webpChunks = (buffer) => {
  const types = [];
  for (let p = 12; p < buffer.length;) {
    const length = buffer.readUInt32LE(p + 4);
    types.push(buffer.toString('latin1', p, p + 4));
    p += 8 + length + (length & 1);
  }
  return types;
};
const avifBoxes = (buffer) => {
  const types = [];
  for (let p = 0; p < buffer.length;) {
    const size = buffer.readUInt32BE(p);
    types.push(buffer.toString('latin1', p + 4, p + 8));
    if (size < 8) break;
    p += size;
  }
  return types;
};

test('FD-139: no shipped image carries tool names or provenance metadata', () => {
  const files = shippedImages();
  expect(files.length).toBeGreaterThan(20);
  const problems = [];
  for (const file of files) {
    const buffer = readFileSync(file);
    const match = buffer.toString('latin1').match(metadataMarker);
    if (match) problems.push(`${file}: "${match[0]}"`);
    if (/\.png$/i.test(file)) {
      const extra = pngChunks(buffer).filter(
        (type) => !['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND'].includes(type),
      );
      if (extra.length) problems.push(`${file}: PNG chunks ${extra.join(', ')}`);
    }
    if (/\.webp$/i.test(file)) {
      const extra = webpChunks(buffer).filter(
        (type) => !['VP8X', 'VP8 ', 'VP8L', 'ALPH', 'ICCP', 'ANIM', 'ANMF'].includes(type),
      );
      if (extra.length) problems.push(`${file}: WebP chunks ${extra.join(', ')}`);
    }
    if (/\.avif$/i.test(file) && avifBoxes(buffer).includes('uuid'))
      problems.push(`${file}: uuid box`);
    if (/\.svg$/i.test(file) && /<metadata|xmlns:(?!svg\b)\w+=/.test(buffer.toString('utf8')))
      problems.push(`${file}: SVG metadata or a foreign namespace`);
  }
  expect(problems).toEqual([]);
});

test('noindex on the two template pages only', () => {
  for (const file of pages) {
    const html = readFileSync(`dist/${file}`, 'utf8');
    const noindex = html.includes('<meta name="robots" content="noindex" />');
    expect(noindex, file).toBe(templateOnly.includes(file));
  }
});

test('without SITE_URL: no sitemap, no Sitemap line, no canonical', () => {
  expect(existsSync('dist/sitemap.xml')).toBe(false);
  expect(readFileSync('dist/robots.txt', 'utf8')).not.toContain('Sitemap:');
  for (const file of pages) {
    expect(readFileSync(`dist/${file}`, 'utf8'), file).not.toContain('rel="canonical"');
  }
});

test.describe('release build', () => {
  test.describe.configure({ mode: 'serial' });
  const siteUrl = 'https://example.org';
  let out;
  test.beforeAll(() => {
    out = buildInto({ RELEASE: 'true', SITE_URL: siteUrl });
  });
  test.afterAll(() => {
    if (out) rmSync(out, { recursive: true, force: true });
  });
  const html = (file) => readFileSync(join(out, file), 'utf8');

  test('RELEASE=true: drafts hidden — Blog empty state, no post pages, no Latest posts', () => {
    const { blog } = loadContent();
    expect(blog.every((post) => post.status === 'draft')).toBe(true);
    const files = readdirSync(out).filter((file) => file.endsWith('.html'));
    expect(files.filter((file) => file.startsWith('post-'))).toEqual([]);
    const blogPage = html('blog.html');
    expect(blogPage).toMatch(/<div class="empty-state" data-blog-empty>/);
    for (const post of blog) expect(blogPage).not.toContain(post.title);
    expect(html('index.html')).not.toContain('data-home="latest"');
    // The post template shows the bracketed sample, never a draft, and is not indexed.
    const template = html('blog-post.html');
    for (const post of blog) expect(template).not.toContain(post.title);
    expect(template).toContain('<meta name="robots" content="noindex" />');
  });

  test('SITE_URL: absolute share image and the WebSite url (FD-139)', () => {
    const home = html('index.html');
    for (const key of ['property="og:image"', 'name="twitter:image"']) {
      expect(home).toContain(
        `<meta ${key} content="${siteUrl}/images/brand/share-image-1200x630.png" />`,
      );
    }
    const website = [...home.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)]
      .map(([, json]) => JSON.parse(json))
      .find((item) => item['@type'] === 'WebSite');
    expect(website).toMatchObject({ name: 'Ideatrium', url: `${siteUrl}/` });
    expect(website.author).toMatchObject({ '@type': 'Person', name: 'Rasel Al Mamun' });
    // The icons stay root paths.
    expect(home).toContain('<link rel="icon" href="/favicon.ico" sizes="32x32" />');
  });

  test('SITE_URL: sitemap of the indexable pages, robots Sitemap line, canonical links', () => {
    const files = readdirSync(out).filter((file) => file.endsWith('.html'));
    const indexable = files.filter((file) => file !== '404.html' && !templateOnly.includes(file));
    const sitemap = html('sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc);
    expect(locs[0]).toBe(`${siteUrl}/index.html`);
    expect([...locs].sort()).toEqual(indexable.map((file) => `${siteUrl}/${file}`).sort());
    expect(locs.some((loc) => loc.includes('/project-'))).toBe(true);
    expect(html('robots.txt')).toBe(`User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
    expect(html('hire.html')).toContain(`<link rel="canonical" href="${siteUrl}/hire.html" />`);
  });
});

// WCAG 1.4.10 reflow: 400 % zoom of a 1280 × 1024 window is a 320 × 256 CSS px viewport. Every
// reveal element must still come in (its 15 % threshold is reachable however tall it is) and
// nothing scrolls sideways.
test.describe('400 % zoom', () => {
  test.use({ viewport: { width: 320, height: 256 } });

  for (const file of templatePages) {
    test(`${file}: every reveal element ends visible, no horizontal scroll`, async ({ page }) => {
      await page.goto(`/${file}`);
      await page.evaluate(async () => {
        const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
        const height = () => document.documentElement.scrollHeight;
        for (let y = 0; y < height(); y += window.innerHeight * 0.5) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await frame();
          await frame();
        }
      });
      await expect
        .poll(() => page.locator('[data-reveal].is-pre').count(), { timeout: 5000 })
        .toBe(0);
      // Reveals still running settle within --d-scene + 200 ms.
      const faded = () =>
        page.evaluate(() =>
          [...document.querySelectorAll('[data-reveal]')]
            .filter((el) => el.getClientRects().length)
            .filter((el) => Number(getComputedStyle(el).opacity) < 1)
            .map((el) => el.className),
        );
      await expect.poll(faded, { timeout: 3000 }).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
