// Author: Rasel Al Mamun
// Release 1.7.4, the QA audit fixes: the content limits of tools/limits.mjs in the validator
// (F03, F10), the search descriptions (F02, F07), the used-only filter options (F08), the list
// pages' first card and the card image widths (F13, F14) and the form field limits (F16).
import { expect, test } from './fixtures.js';
import { buildSite, cardVariants, loadContent } from '../tools/content.mjs';
import { cutAtSentence, DESCRIPTION_MAX, MANY, MAX, placeholders } from '../tools/limits.mjs';
import { contentWarnings, validateContent } from '../tools/validate-content.mjs';
import { isDjango, pagePath } from './pages.js';

const content = loadContent();
const site = buildSite(content, { showDrafts: true });
const failures = (change) => {
  const c = structuredClone(content);
  change(c);
  return validateContent(c).join(' | ');
};

test.describe('the validator enforces every documented limit (F03, F10)', () => {
  test('the trial content passes', () => {
    expect(validateContent(content)).toEqual([]);
  });

  test('page titles: short title + " — Ideatrium" at most 60 characters', () => {
    expect(failures((c) => (c.projects[0].short_title = 'x'.repeat(49)))).toContain('page title');
    expect(failures((c) => (c.projects[0].short_title = 'x'.repeat(48)))).not.toContain(
      'page title',
    );
    expect(failures((c) => (c.blog[0].short_title = 'x'.repeat(49)))).toContain('page title');
    expect(failures((c) => (c.privacy.short_title = 'x'.repeat(49)))).toContain('page title');
  });

  test('search descriptions: at most 160 characters', () => {
    const long = 'x'.repeat(DESCRIPTION_MAX + 1);
    expect(failures((c) => (c.meta.home = long))).toContain('meta.home');
    expect(failures((c) => (c.profile.summary = long))).toContain('profile.summary');
    expect(failures((c) => (c.projects[0].meta_description = long))).toContain('meta_description');
    expect(failures((c) => (c.blog[0].meta_description = long))).toContain('meta_description');
    expect(
      failures((c) => (c.blog[0].meta_description = 'x'.repeat(DESCRIPTION_MAX))),
    ).not.toContain('meta_description');
  });

  test('the § 14.1 text slots, one character over', () => {
    const over = (n) => 'x'.repeat(n + 1);
    expect(failures((c) => (c.profile.eyebrow = over(MAX.eyebrow)))).toContain('profile.eyebrow');
    expect(failures((c) => (c.profile.statement = over(MAX.statement)))).toContain(
      'profile.statement',
    );
    expect(failures((c) => (c.links[0].label = over(MAX.link_label)))).toContain('label');
    expect(failures((c) => (c.hire.services[0].items[0] = over(MAX.service_item)))).toContain(
      'item 1',
    );
    expect(failures((c) => (c.portfolio.experience.roles[0].text = over(MAX.role_text)))).toContain(
      'text',
    );
    expect(failures((c) => (c.contact.subjects[0] = over(MAX.subject)))).toContain(
      'contact.subjects[0]',
    );
  });

  test('the list slots, one item over', () => {
    const more = (list, n) => Array.from({ length: n + 1 }, (_, i) => list[i % list.length]);
    expect(failures((c) => (c.fields = more(c.fields, MANY.areas)))).toContain('fields:');
    expect(failures((c) => (c.hire.services = more(c.hire.services, MANY.services)))).toContain(
      'hire.services:',
    );
    expect(
      failures((c) => (c.contact.audiences = more(c.contact.audiences, MANY.audiences))),
    ).toContain('contact.audiences');
    expect(
      failures(
        (c) => (c.footer.connect_profiles = more(c.footer.connect_profiles, MANY.footerLinks)),
      ),
    ).toContain('footer.connect_profiles');
  });

  test('a published post has no [bracketed] placeholder in its standfirst or body', () => {
    const publish = (c, standfirst) => {
      Object.assign(c.blog[0], { status: 'published', date: '2026-11-07', standfirst });
    };
    const c = structuredClone(content);
    publish(c, 'A written standfirst with a [placeholder] inside.');
    expect(validateContent(c).join(' | ')).toContain('[placeholder]');
    const body = 'Text.\n\n[Figure 1]\n\nA [link](https://example.org) and `a[0]`.\n';
    const clean = structuredClone(content);
    publish(clean, 'A written standfirst.');
    const figure = content.projects.find((p) => p.detail?.figures).detail.figures[0];
    clean.blog[0].figures = [{ ...figure, n: 1 }];
    expect(validateContent(clean, { [clean.blog[0].slug]: body })).toEqual([]);
    expect(
      validateContent(clean, { [clean.blog[0].slug]: `${body}\n[Second section text]\n` }).join(),
    ).toContain('[Second section text]');
    expect(placeholders('```\n[not one]\n```\n[one]')).toEqual(['[one]']);
  });

  test('a missing meta_description is a warning, not a failure', () => {
    const c = structuredClone(content);
    delete c.projects[0].meta_description;
    expect(validateContent(c)).toEqual([]);
    expect(contentWarnings(c).join()).toContain(`"${c.projects[0].id}": no meta_description`);
  });
});

test.describe('search descriptions (F02, F07)', () => {
  test('cut at the last full sentence within 160 characters', () => {
    const a = 'First sentence is here. ';
    const text = `${a.repeat(6)}And a last one that goes past the limit by a fair way.`;
    const cut = cutAtSentence(text);
    expect(cut.length).toBeLessThanOrEqual(160);
    expect(cut.endsWith('here.')).toBe(true);
    expect(cutAtSentence('Short.')).toBe('Short.');
    const words = cutAtSentence('word '.repeat(60));
    expect(words.length).toBeLessThanOrEqual(160);
    expect(words.endsWith('…')).toBe(true);
  });

  test('projects: meta_description, else the summary line, else the card description', () => {
    const c = structuredClone(content);
    const [a, b, d] = [
      c.projects[0],
      c.projects.find((p) => p.detail?.summary_line),
      c.projects[1],
    ];
    delete b.meta_description;
    delete d.meta_description;
    delete d.detail;
    const built = buildSite(c, { bodies: {} });
    const byId = (id) => built.projectList.find((p) => p.id === id);
    expect(byId(a.id).description).toBe(a.meta_description);
    expect(byId(b.id).description).toBe(b.detail.summary_line);
    expect(byId(d.id).description).toBe(d.card_description);
    for (const project of built.projectList) {
      expect(project.description).not.toBe(project.contribution);
      expect(project.description.length).toBeLessThanOrEqual(160);
    }
  });

  test('posts: meta_description, else the standfirst cut at a sentence', () => {
    const c = structuredClone(content);
    delete c.blog[0].meta_description;
    c.blog[0].standfirst = `${'A complete sentence here. '.repeat(8)}Tail`;
    const post = buildSite(c, { bodies: {} }).postList[0];
    expect(post.description.length).toBeLessThanOrEqual(160);
    expect(post.description.endsWith('here.')).toBe(true);
  });

  test('project pages carry their description, never the contribution list', async ({ page }) => {
    test.skip(isDjango, 'Django renders the project pages from its own data');
    const project = site.projectList[0];
    await page.goto(pagePath(project.file));
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ]) {
      await expect(page.locator(selector)).toHaveAttribute('content', project.description);
    }
  });
});

test.describe('filter options with results only (F08)', () => {
  test('every topic and category offered has at least one item', () => {
    for (const topic of site.archive.topics) {
      expect(
        site.projectList.some((p) => p.topic === topic.id),
        topic.id,
      ).toBe(true);
    }
    for (const category of site.categories) expect(category.count, category.id).toBeGreaterThan(0);
    // An unused topic or category is left out.
    const c = structuredClone(content);
    c.researchArchive.topics.push({ id: 'unused', label: 'Unused', icon: 'general' });
    c.blogPage.categories.push({ id: 'unused', label: 'Unused' });
    const built = buildSite(c, { bodies: {} });
    expect(built.archive.topics.map((t) => t.id)).not.toContain('unused');
    expect(built.categories.map((cat) => cat.id)).not.toContain('unused');
  });

  test('the research topic select lists the used topics only', async ({ page }) => {
    test.skip(isDjango, 'Django builds its own options');
    await page.goto(pagePath('research.html'));
    const options = await page.locator('#archive-topic option').allTextContents();
    expect(options.slice(1)).toEqual(site.archive.topics.map((t) => t.label));
  });
});

test.describe('list pages: the first card row eager, every card in three widths (FD-191, F14)', () => {
  for (const file of ['research.html', 'blog.html']) {
    test(`${file}: first row eager, fetchpriority high on the first card only, the rest lazy`, async ({
      page,
    }) => {
      test.skip(isDjango && file === 'blog.html', 'Django publishes no post (FD-137)');
      await page.goto(pagePath(file));
      const imgs = page.locator('main [data-list-results] .blog-cover img');
      const n = await imgs.count();
      expect(n).toBeGreaterThan(1);
      // The whole first row of the widest layout (three cards from 992 px) loads eagerly.
      await expect(imgs.first()).toHaveAttribute('fetchpriority', 'high');
      for (let i = 0; i < n; i += 1) {
        await expect(imgs.nth(i)).toHaveAttribute('loading', i < 3 ? 'eager' : 'lazy');
        if (i > 0) await expect(imgs.nth(i)).not.toHaveAttribute('fetchpriority', /.*/);
      }
      // 480, 960 and 1600 w for the WebP and the AVIF, with sizes.
      const srcset = await imgs.first().getAttribute('srcset');
      expect(srcset).toMatch(/ 480w, .* 960w, .* 1600w$/);
      expect(await imgs.first().getAttribute('sizes')).toBeTruthy();
      const avif = await page
        .locator('main [data-list-results] .blog-cover source[type="image/avif"]')
        .first()
        .getAttribute('srcset');
      expect(avif).toMatch(/ 480w, .* 960w, .* 1600w$/);
    });
  }

  test('every trial card image has its 480 and 960 px copies', () => {
    for (const item of [...content.projects, ...content.blog]) {
      expect(cardVariants(item.card_image), item.id ?? item.slug).not.toBeNull();
    }
    // Without the copies, the image is served at 1600 px only (and the validator warns).
    expect(cardVariants({ src: '/images/none.webp' })).toBeNull();
  });

  test('the browser loads a smaller copy where the card is small', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(pagePath('research.html'));
    const img = page.locator('main [data-list-results] .blog-cover img').first();
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth)).toBeTruthy();
    const { natural, current } = await img.evaluate((el) => ({
      natural: [el.naturalWidth, el.naturalHeight],
      current: el.currentSrc,
    }));
    expect(current).toMatch(/-(480|960)-/);
    expect(natural[0] / natural[1]).toBeCloseTo(16 / 9, 1);
  });
});

test.describe('form field limits (F16)', () => {
  const LIMITS = { name: 120, email: 254, organisation: 160, message: 5000, brief: 5000 };
  for (const [file, text] of [
    ['contact.html', 'message'],
    ['hire.html', 'brief'],
  ]) {
    test(`${file}: maxlength as in Django`, async ({ page }) => {
      await page.goto(pagePath(file));
      const form = page.locator('form[data-form]');
      for (const name of ['name', 'email', 'organisation', text]) {
        await expect(form.locator(`[name="${name}"]`)).toHaveAttribute(
          'maxlength',
          String(LIMITS[name]),
        );
      }
    });
  }

  test('a long message: the mailto link is shortened, with a note', async ({ page }) => {
    test.skip(isDjango, 'the static mailto fallback only');
    await page.goto(pagePath('contact.html'));
    await page.locator('#contact-name').fill('Test Person');
    await page.locator('#contact-email').fill('name@example.com');
    await page.locator('#contact-message').fill('Long message text. '.repeat(260).slice(0, 4990));
    await page.getByRole('button', { name: 'Send' }).click();
    const href = await page.locator('[data-form-status] a[href^="mailto:"]').getAttribute('href');
    expect(href.length).toBeLessThanOrEqual(2000);
    const body = new URL(href).searchParams.get('body');
    expect(body).toContain('Shortened to fit an email link');
    expect(body).toContain('Test Person');
  });
});

// 1.7.4 (F17): the footer email links are 44 px touch targets up to 667 px, by padding only.
test.describe('footer email targets (F17)', () => {
  for (const width of [320, 390, 667, 668, 1440]) {
    test(`${width} px: each email link box is ${width <= 667 ? 'at least 44' : '36'} px tall`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(pagePath('index.html'));
      const links = await page.locator('.footer-email').evaluateAll((els) =>
        els.map((el) => {
          const cs = getComputedStyle(el);
          return {
            height: el.getBoundingClientRect().height,
            font: cs.fontSize,
            padding: cs.paddingTop,
          };
        }),
      );
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        if (width <= 667) expect(link.height).toBeGreaterThanOrEqual(44);
        else expect(link).toMatchObject({ height: 36, padding: '0px' });
        expect(link.font).toBe('14px');
      }
    });
  }
});
