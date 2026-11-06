// Author: Rasel Al Mamun
// FD-148 … FD-153 (release 1.6.0): the texts and lists Django will make editable ("Django-owned
// texts", docs/handover-django.md). Each slot must work empty (its block hides, nothing else
// breaks), at its documented maximum length, and a list at 0, 1 and many items — at 320, 390 and
// 1440 px, in both themes: no horizontal overflow, nothing clipped, nothing overlapping.
//
// The static build takes sample content through CONTENT_FIXTURE (vite.config.js); each variant
// is built into .slots/<name>/ and served from a tiny static server of this file. Nothing here
// touches dist/.
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { loadContent } from '../tools/content.mjs';

const root = resolve(import.meta.dirname, '..');
const slotsDir = join(root, '.slots');

// The documented maxima (characters) — the same table as docs/handover-django.md.
export const MAX = {
  second_role: 40,
  eyebrow: 100,
  eyebrow_short: 48,
  role_line: 70,
  statement: 300,
  summary_line: 140,
  portfolio_eyebrow: 100,
  location_line: 60,
  author_line: 100,
  availability: 100,
  email: 40,
  link_label: 28,
  area_label: 28,
  service_title: 40,
  service_summary: 90,
  service_item: 50,
  evidence_label: 28,
  role_title: 40,
  role_period: 30,
  role_unit: 40,
  role_institution: 50,
  role_text: 160,
  role_bullet: 60,
  contact_intro: 120,
  audience: 60,
  subject: 30,
  form_kind: 40,
};
// The most items a list is tested with.
export const MANY = {
  areas: 8,
  services: 4,
  roles: 5,
  links: 9,
  footerLinks: 8,
  options: 8,
  audiences: 6,
};

const WORDS = 'research hardware software sensors robotics analysis systems field data edge'.split(
  ' ',
);
// Sentence-like text of exactly `n` characters.
const text = (n, seed = 0) => {
  let out = '';
  for (let i = seed; out.length < n; i += 1) out += `${WORDS[i % WORDS.length]} `;
  return out.slice(0, n).trimEnd().padEnd(n, 'x');
};
const email = (n) => `${'long.address.name'.padEnd(n - '@example.org'.length, 'x')}@example.org`;

const PAGES = ['index', 'portfolio', 'hire', 'contact', 'blog-post', 'privacy'];
const SIZES = [
  { width: 320, height: 700 },
  { width: 390, height: 800 },
  { width: 1440, height: 900 },
];
const THEMES = ['dark', 'light'];

// Sample content: the real content with the slots changed.
function variantContent(name) {
  const c = structuredClone(loadContent());
  const empty = name === 'empty';
  const max = name === 'max';
  const one = name === 'one';
  const pick = (list, n) => list.slice(0, n);

  const t = (key, value) => (empty ? '' : max ? text(MAX[key]) : value);
  c.profile.second_role = t('second_role', c.profile.second_role);
  c.profile.eyebrow = t('eyebrow', c.profile.eyebrow);
  c.profile.eyebrow_short = t('eyebrow_short', c.profile.eyebrow_short);
  c.profile.role_line = t('role_line', c.profile.role_line);
  c.profile.statement = t('statement', c.profile.statement);
  c.profile.author_line = t('author_line', c.profile.author_line);
  c.profile.location_line = t('location_line', c.profile.location_line);
  if (empty) {
    c.profile.email = '';
    c.profile.secondary_email = '';
    c.profile.cv = { href: '' };
  } else if (max) {
    c.profile.email = email(MAX.email);
    c.profile.secondary_email = email(MAX.email);
  }
  const pp = c.portfolio.profile;
  pp.eyebrow = t('portfolio_eyebrow', pp.eyebrow);
  pp.summary_line = t('summary_line', pp.summary_line);
  pp.location_line = t('location_line', pp.location_line);
  c.hire.availability = t('availability', c.hire.availability);
  c.hire.available = !empty && !one ? true : false;

  // Lists: 0, 1 or many.
  const link = (i) => ({
    id: i < 7 ? c.links[i].id : `extra-${i}`,
    label: max ? text(MAX.link_label, i) : `Link ${i}`,
    handle: `handle-${i}`,
    url: `https://example.org/profile/${i}`,
  });
  if (empty) c.links = [];
  else if (one) c.links = pick(c.links, 1);
  else if (max) c.links = Array.from({ length: MANY.links }, (_, i) => link(i));
  const ids = (n) => c.links.slice(0, n).map((l) => l.id);
  c.footer.research_profiles = empty ? [] : one ? ids(1) : max ? ids(MANY.footerLinks) : ids(4);
  c.footer.connect_profiles = empty ? [] : one ? ids(1) : max ? ids(MANY.footerLinks) : ids(2);

  const area = (i) => ({
    label: text(MAX.area_label, i),
    target: 'portfolio.html#research',
    icon: ['sprout', 'network', 'camera', 'tractor', 'code', 'document', 'chip', 'gear'][i % 8],
  });
  if (empty) c.fields = [];
  else if (one) c.fields = pick(c.fields, 1);
  else if (max) c.fields = Array.from({ length: MANY.areas }, (_, i) => area(i));

  const service = (i) => ({
    n: String(i + 1).padStart(2, '0'),
    title: text(MAX.service_title, i),
    summary: text(MAX.service_summary, i),
    items: Array.from({ length: 4 }, (_, k) => text(MAX.service_item, i + k)),
    evidence: { label: text(MAX.evidence_label, i), href: 'portfolio.html#research' },
  });
  if (empty) c.hire.services = [];
  else if (one) c.hire.services = pick(c.hire.services, 1);
  else if (max) c.hire.services = Array.from({ length: MANY.services }, (_, i) => service(i));
  c.hire.form_kinds = empty
    ? []
    : one
      ? ['One option']
      : max
        ? Array.from({ length: MANY.options }, (_, i) => text(MAX.form_kind, i))
        : c.hire.form_kinds;

  const role = (i) => ({
    title: text(MAX.role_title, i),
    period: text(MAX.role_period, i),
    unit: text(MAX.role_unit, i),
    institution: text(MAX.role_institution, i),
    text: text(MAX.role_text, i),
    bullets: Array.from({ length: 3 }, (_, k) => text(MAX.role_bullet, i + k)),
  });
  const xp = c.portfolio.experience;
  if (empty) xp.roles = [];
  else if (one) xp.roles = pick(xp.roles, 1);
  else if (max) xp.roles = Array.from({ length: MANY.roles }, (_, i) => role(i));

  c.contact.intro = t('contact_intro', c.contact.intro);
  c.contact.audiences = empty
    ? []
    : one
      ? ['One audience']
      : max
        ? Array.from({ length: MANY.audiences }, (_, i) => text(MAX.audience, i))
        : c.contact.audiences;
  c.contact.subjects = empty
    ? []
    : one
      ? ['One subject']
      : max
        ? Array.from({ length: MANY.options }, (_, i) => text(MAX.subject, i))
        : c.contact.subjects;
  return c;
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

function buildVariant(name) {
  const out = join(slotsDir, name);
  mkdirSync(slotsDir, { recursive: true });
  const fixture = join(slotsDir, `${name}.json`);
  writeFileSync(fixture, JSON.stringify(variantContent(name)));
  rmSync(out, { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', out, '--emptyOutDir'],
    { cwd: root, env: { ...process.env, CONTENT_FIXTURE: fixture }, stdio: 'pipe' },
  );
  return out;
}

function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(req.url.split('?')[0]);
    const file = join(dir, path === '/' ? 'index.html' : path);
    if (!file.startsWith(dir) || !existsSync(file)) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(res);
  });
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () =>
      done({ server, url: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}

// In-page scan of one loaded page: overflow, clipping, overlapping list items.
const scan = () => {
  const problems = [];
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) {
    problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
  }
  const home = document.body.dataset.page === 'home';
  // A scroll box (a rich-text region, the phone section menu) may hold content beyond the edge.
  const inScroller = (el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(node).overflowX)) return node;
    }
    return null;
  };
  const label = (el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`;
  for (const el of document.querySelectorAll('main *, footer *, header *')) {
    if (!el.getClientRects().length || inScroller(el)) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    // The pinned Home stage lays its screens out off the first screen on purpose.
    if (hasText && !(home && vw >= 992)) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) problems.push(`outside the viewport: ${label(el)}`);
    }
    if (hasText && style.overflow !== 'visible' && !el.matches('.visually-hidden')) {
      if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
        problems.push(`clipped: ${label(el)}`);
      }
    }
    if (style.webkitLineClamp && style.webkitLineClamp !== 'none') {
      problems.push(`line-clamped: ${label(el)}`);
    }
  }
  // The pinned Home stage: its slots stay inside the text column, clear of the figure beside it.
  if (home && vw >= 992) {
    const column = document.querySelector('.stage-text').getBoundingClientRect();
    for (const el of document.querySelectorAll(
      '.hero-eyebrow, .hero-role, .hero-ctas, .screen2-areas, .screen2-grid .area',
    )) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > column.right + 1)
        problems.push(`outside the text column: ${label(el)}`);
    }
  }
  // Items of one list never overlap.
  for (const list of document.querySelectorAll('main ul, main ol, footer ul')) {
    const rects = [...list.children]
      .filter((li) => li.getClientRects().length && getComputedStyle(li).display !== 'inline')
      .map((li) => li.getBoundingClientRect());
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i];
        const b = rects[j];
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 2 && h > 2) problems.push(`list items overlap: ${label(list)} ${i}/${j}`);
      }
    }
  }
  return problems;
};

const names = ['empty', 'one', 'max'];
for (const name of names) {
  test.describe(`slots: ${name}`, () => {
    test.describe.configure({ mode: 'serial' });
    let site;
    test.beforeAll(async () => {
      test.setTimeout(120_000);
      site = await serve(buildVariant(name));
    });
    test.afterAll(() => site?.server.close());

    for (const theme of THEMES) {
      for (const size of SIZES) {
        test(`${theme} ${size.width}px: no overflow, clipping or overlap on any page`, async ({
          page,
        }) => {
          await page.setViewportSize(size);
          await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
          for (const file of PAGES) {
            await page.goto(`${site.url}/${file}.html`);
            await page.evaluate(() => document.fonts.ready);
            expect(await page.evaluate(scan), `${file}.html`).toEqual([]);
          }
        });
      }
    }

    test('the slots follow their values', async ({ page }) => {
      const content = variantContent(name);
      await page.setViewportSize({ width: 390, height: 800 });
      const count = async (file, selector) => {
        await page.goto(`${site.url}/${file}.html`);
        return page.locator(selector).count();
      };
      const expectCount = async (file, selector, n) =>
        expect(await count(file, selector), `${file} ${selector}`).toBe(n);
      const shown = name === 'empty' ? 0 : 1;
      // Text slots: hidden when empty, shown otherwise.
      await expectCount('index', '.hero-eyebrow', shown);
      await expectCount('index', '.hero-role', shown);
      await expectCount('portfolio', '.pf-role', shown);
      await expectCount('portfolio', '.pf-summary', shown);
      await expectCount('portfolio', '.pf-statement', shown);
      await expectCount('portfolio', '.pf-location', shown);
      await expectCount('hire', '.availability', shown);
      await expectCount('blog-post', '.author-role', shown);
      await expectCount('contact', '.page-intro', shown);
      // The footer: role line, emails and the CV link.
      await expectCount('index', '.footer-role', shown);
      await expectCount('index', '.footer-email', name === 'empty' ? 0 : 2);
      await expectCount('index', 'a[href$=".pdf"]', name === 'empty' ? 0 : 2);
      // Lists: 0, 1 or many items.
      const many = name === 'max';
      const size = (key) => (many ? MANY[key] : name === 'empty' ? 0 : 1);
      await expectCount('index', '.screen2-grid .area', size('areas'));
      await expectCount('hire', 'ul.services .service', size('services'));
      await expectCount(
        'portfolio',
        '#experience article.pf-entry',
        name === 'empty' ? 0 : many ? MANY.roles : 1,
      );
      await expectCount('portfolio', '.pf-links li', size('links'));
      await expectCount('index', 'nav[aria-labelledby="footer-research"] li', size('footerLinks'));
      await expectCount('index', 'nav[aria-labelledby="footer-connect"] li', size('footerLinks'));
      await expectCount('contact', '#contact-subject option', size('options'));
      await expectCount('hire', '#hire-kind option', size('options'));
      await expectCount('contact', '.form-aside ul.plain-list li', size('audiences'));
      // The availability dot repeats the yes / no state.
      if (name !== 'empty') {
        await page.goto(`${site.url}/hire.html`);
        await expect(page.locator('.availability')).toHaveAttribute(
          'data-available',
          content.hire.available ? 'yes' : 'no',
        );
      }
    });
  });
}
