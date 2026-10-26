// Author: Rasel Al Mamun
// Home: the document without motion — section order, data, screen 2 (FD-84), Fork,
// Selected work, Latest posts (FD-45), Contact band, no-JS contract and the handoff §5 budgets.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { buildSite, loadContent } from '../tools/content.mjs';
import { phonePortrait, venueLine } from './pages.js';

const content = loadContent();
const site = buildSite(content, { showDrafts: true });
const screen2 = content.home.screen2;

// WCAG relative luminance and contrast of two computed rgb() colours.
const luminance = (rgb) => {
  const [r, g, b] = rgb
    .match(/[\d.]+/g)
    .slice(0, 3)
    .map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

async function rects(page, selector) {
  return page
    .locator(selector)
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
}

test.describe('Home document', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/index.html');
  });

  test('sections come in order, with the stage hooks and landmarks', async ({ page }) => {
    const order = await page
      .locator(
        'main [data-stage], main [data-stage-hero], main [data-stage-statement], main [data-stage-fork], main [data-home]',
      )
      .evaluateAll((els) =>
        els.map((el) =>
          el.dataset.home
            ? el.dataset.home
            : Object.keys(el.dataset).find((key) => key.startsWith('stage')),
        ),
      );
    expect(order).toEqual([
      'stage',
      'stageHero',
      'stageStatement',
      'stageFork',
      'hire',
      'selected',
      'publications',
      'latest',
      'contact',
    ]);
    await expect(page.locator('[data-stage] [data-stage-figure]')).toHaveCount(1);
    await expect(page.locator('[data-fork-col="portfolio"]')).toHaveCount(1);
    await expect(page.locator('[data-fork-col="blog"]')).toHaveCount(1);

    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    await expect(page.getByRole('list', { name: screen2.areas_label })).toHaveCount(1);
    for (const name of [
      content.home.fork.heading,
      content.hire.heading,
      content.home.selected.heading,
      content.home.publications.heading,
      content.home.contact_band.heading,
    ]) {
      await expect(page.getByRole('region', { name })).toHaveCount(1);
    }
  });

  test('one h1, the name; eyebrow and role line come from the data', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      content.profile.name,
    );
    await expect(h1.locator('.hero-line')).toHaveText(content.home.hero_name_lines);
    // Desktop Chrome is 1280 px wide: the full eyebrow (the short one is display: none).
    await expect(page.locator('.hero-eyebrow span:visible')).toHaveText(content.profile.eyebrow);
    await expect(page.locator('.hero-role')).toHaveText(content.profile.role_line);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      content.meta.home,
    );
  });

  test('hero CTAs: Hire me, Portfolio and the shared CV action', async ({ page }) => {
    const ctas = page.locator('.hero-ctas a');
    await expect(ctas).toHaveCount(3);
    await expect(ctas.nth(0)).toHaveAttribute('href', '/hire.html');
    await expect(ctas.nth(0)).toHaveClass(/btn-primary/);
    await expect(ctas.nth(1)).toHaveAttribute('href', '/portfolio.html');
    await expect(ctas.nth(1)).toHaveClass(/btn-secondary/);
    // FD-34: Request CV by email while profile.cv is null.
    expect(content.profile.cv).toBeNull();
    await expect(ctas.nth(2)).toHaveText('Request CV');
    await expect(ctas.nth(2)).toHaveAttribute('href', /^mailto:/);
    await expect(ctas.nth(2)).toHaveClass(/btn-sm/);
  });

  test('the hero figure is the decorative, eagerly loaded LCP image', async ({ page }) => {
    const figure = page.locator('[data-stage-figure]');
    await expect(figure).toHaveAttribute('aria-hidden', 'true');
    const img = figure.locator('img');
    await expect(img).toHaveAttribute('alt', '');
    await expect(img).toHaveAttribute('fetchpriority', 'high');
    await expect(img).toHaveAttribute('loading', 'eager');
    await expect(img).toHaveAttribute('width', '720');
    await expect(img).toHaveAttribute('height', '1300');
    // One original for every width (FD-86): no phone crop.
    await expect(figure.locator('source[media]')).toHaveCount(0);
    // The preload from 768 px only (FD-73).
    const preloads = page.locator('link[rel="preload"][as="image"][href*="/P5-"]');
    await expect(preloads).toHaveCount(1);
    await expect(preloads).toHaveAttribute('media', '(min-width: 768px)');
    const types = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((els) => els.map((el) => JSON.parse(el.textContent)['@type']));
    expect(types).toEqual(['Person', 'WebSite']);
  });

  // FD-84: screen 2's copy is the data's, exactly.
  test('screen 2: eyebrow, headline with its highlight, supporting line', async ({ page }) => {
    const layer = page.locator('[data-stage-statement]');
    await expect(layer.locator('.screen2-eyebrow')).toHaveText(screen2.eyebrow);
    const headline = layer.getByRole('heading', { level: 2 });
    await expect(headline).toHaveCount(1);
    await expect(headline).toHaveClass(/screen2-headline/);
    const lines = [...screen2.headline_lines];
    lines[lines.length - 1] += ` ${screen2.headline_highlight}`;
    await expect(headline.locator('.screen2-line')).toHaveText(lines);
    await expect(headline).toHaveAccessibleName(lines.join(' '));
    await expect(headline.locator('.screen2-highlight')).toHaveText(screen2.headline_highlight);
    await expect(layer.locator('.screen2-support')).toHaveText(screen2.support);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await layer.locator('.statement, [data-field-rail]').count()).toBe(0);
  });

  test('screen 2: the two pillars link where the data says, with a sentence for a name', async ({
    page,
  }) => {
    const pillars = page.locator('.screen2-pillars .pillar');
    await expect(pillars).toHaveCount(screen2.pillars.length);
    for (const [i, pillar] of screen2.pillars.entries()) {
      const link = pillars.nth(i);
      await expect(link).toHaveAttribute('href', `/${pillar.href}`);
      await expect(link.locator('.pillar-label')).toHaveText(pillar.label);
      await expect(link.locator('.pillar-line')).toHaveText(pillar.lines);
      await expect(link.locator('svg')).toHaveAttribute('aria-hidden', 'true');
      await expect(link.locator('.pillar-rule')).toHaveAttribute('aria-hidden', 'true');
      const lines = pillar.lines.reduce(
        (text, line) => (text ? `${text}${line.startsWith('&') ? '' : ','} ${line}` : line),
        '',
      );
      await expect(link).toHaveAccessibleName(`${pillar.label}: ${lines}`);
    }
    await expect(pillars.first()).toHaveAccessibleName(
      'Research: Peer-reviewed papers, Working prototypes',
    );
    await expect(pillars.nth(1)).toHaveAccessibleName(
      'Development: Dependable web, apps & software',
    );
    // FD-87: Research → the publications, Development → the research projects, both with the
    // same → arrow (real section ids on the Portfolio page).
    await expect(pillars.first()).toHaveAttribute('href', '/portfolio.html#publications');
    await expect(pillars.nth(1)).toHaveAttribute('href', '/portfolio.html#research');
    const arrows = await pillars
      .locator('svg.pillar-arrow')
      .evaluateAll((els) => els.map((el) => el.innerHTML.replace(/\s+/g, ' ').trim()));
    expect(arrows).toHaveLength(2);
    expect(arrows[0]).toBe(arrows[1]);
    expect(arrows[0]).toContain('M5 12h14');
  });

  test('screen 2 pillar targets exist on the Portfolio page (FD-87)', async ({ page }) => {
    for (const pillar of screen2.pillars) {
      await page.goto(`/${pillar.href}`);
      const id = pillar.href.split('#')[1];
      await expect(page.locator(`[id="${id}"]`), pillar.href).toHaveCount(1);
    }
  });

  test('screen 2: Areas of work — six plain items with icon and label (FD-87, FD-99)', async ({
    page,
  }) => {
    const list = page.getByRole('list', { name: screen2.areas_label });
    await expect(page.locator('.screen2-areas-title')).toHaveText(screen2.areas_label);
    // Not links, not tabs, not buttons; nothing in the block takes focus or a click handler.
    const areas = page.locator('.screen2-areas');
    await expect(areas.locator('a, button, [role="tab"], [tabindex], [onclick]')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: screen2.areas_label })).toHaveCount(0);
    const items = list.getByRole('listitem');
    await expect(items).toHaveCount(content.fields.length);
    for (const [i, field] of content.fields.entries()) {
      await expect(items.nth(i).locator('.area-label')).toHaveText(field.label);
      // FD-99: no 01–06 index; the item reads as its label alone.
      await expect(items.nth(i).locator('.area-index')).toHaveCount(0);
      await expect(items.nth(i)).toHaveText(field.label);
      const icon = items.nth(i).locator('svg.area-icon');
      await expect(icon).toHaveAttribute('aria-hidden', 'true');
      // Each field draws its own icon (the data's name picks it).
      expect(await icon.locator('path, circle').count(), field.icon).toBeGreaterThan(0);
    }
    const icons = await areas
      .locator('svg.area-icon')
      .evaluateAll((els) => els.map((el) => el.innerHTML.replace(/\s+/g, ' ').trim()));
    expect(new Set(icons).size).toBe(content.fields.length);
    // No interactive styling: hovering an item changes nothing, the pointer stays the arrow.
    const item = items.first();
    const before = await item.evaluate((el) => [
      getComputedStyle(el.querySelector('.area-label')).color,
      getComputedStyle(el.querySelector('.area-icon')).color,
      getComputedStyle(el).cursor,
    ]);
    await item.hover();
    const after = await item.evaluate((el) => [
      getComputedStyle(el.querySelector('.area-label')).color,
      getComputedStyle(el.querySelector('.area-icon')).color,
      getComputedStyle(el).cursor,
    ]);
    expect(after).toEqual(before);
    expect(after[2]).toBe('auto');
  });

  test('screen 2: "Connected." is the accent and AA as large text in both themes', async ({
    page,
  }) => {
    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      const colours = await page.evaluate(() => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--accent)';
        document.body.append(probe);
        const accent = getComputedStyle(probe).color;
        probe.remove();
        const highlight = document.querySelector('.screen2-highlight');
        return {
          accent,
          highlight: getComputedStyle(highlight).color,
          size: parseFloat(getComputedStyle(highlight).fontSize),
          bg: getComputedStyle(document.body).backgroundColor,
        };
      });
      expect(colours.highlight, theme).toBe(colours.accent);
      // Large text (≥ 24 px) needs 3:1; it passes the 4.5:1 of body text as well.
      expect(colours.size).toBeGreaterThanOrEqual(24);
      expect(contrast(colours.highlight, colours.bg), theme).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('FD-102: Selected work — the large card is featured_large, then the others in featured_order, with the data', async ({
    page,
  }) => {
    const featured = content.projects
      .filter((p) => p.featured)
      .toSorted((a, b) => a.featured_order - b.featured_order);
    const large = featured.find((p) => p.featured_large);
    const small = featured.filter((p) => !p.featured_large);
    expect(large.id).toBe('poultry-aiot-edge');
    expect(small.map((p) => p.id)).toEqual(['biofloc-iot', 'solar-irrigation']);
    const section = page.locator('[data-home="selected"]');
    await expect(section.locator('.eyebrow')).toHaveText(content.home.selected.eyebrow);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(
      content.home.selected.heading,
    );
    await expect(section.locator('.section-intro')).toHaveText(content.home.selected.intro);
    const cards = section.locator('[data-featured-project] .work-card');
    await expect(cards).toHaveCount(3);
    // The large card first: amber "Featured project", the role line, title, summary, period,
    // tags and status.
    const first = cards.nth(0);
    await expect(first).toHaveClass(/work-card-large/);
    await expect(first.locator('.work-eyebrow')).toHaveText(content.home.selected.large_eyebrow);
    await expect(first.locator('.work-role-line')).toHaveText(large.featured_role_line);
    await expect(first.locator('.work-period')).toHaveText(large.period);
    await expect(first.locator('.card-status')).toHaveText('In progress');
    for (const [i, project] of [large, ...small].entries()) {
      const card = cards.nth(i);
      await expect(card.getByRole('heading', { level: 3 })).toHaveText(project.short_title);
      await expect(card.locator('.work-summary')).toHaveText(project.short_summary);
      if (i > 0) await expect(card.locator('.work-role')).toHaveText(project.role);
      await expect(card.locator('.work-period')).toHaveCount(project.period ? 1 : 0);
      // The design-specification tags (featured_tags); the project page keeps all of them.
      await expect(card.locator('.pill-row li.pill')).toHaveText(project.featured_tags);
      await expect(card.locator('.card-status')).toHaveCount(project.status ? 1 : 0);
      const link = card.getByRole('link');
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAccessibleName(`View project: ${project.short_title}`);
      await expect(link).toHaveAttribute('href', `/project-${project.id}.html`);
      // The project page exists.
      const response = await page.request.get(`/project-${project.id}.html`);
      expect(response.status(), project.id).toBe(200);
    }
    expect(Object.fromEntries([large, ...small].map((p) => [p.id, p.featured_tags]))).toEqual({
      'poultry-aiot-edge': ['IoT', 'Edge AI', 'Control systems'],
      // FD-108: "Automation" added.
      'biofloc-iot': ['IoT', 'Aquaculture', 'Automation'],
      'solar-irrigation': ['IoT', 'Solar energy', 'Irrigation'],
    });
    await page.goto(`/project-${large.id}.html`);
    for (const tag of large.tags) {
      await expect(page.locator('.pill', { hasText: tag }).first()).toBeVisible();
    }
    await page.goto('/index.html');
    // One "Full portfolio" for each layout, both to the Portfolio page; one exposed at a time.
    const more = section.locator('.home-more a');
    await expect(more).toHaveCount(2);
    for (const href of await more.evaluateAll((els) => els.map((el) => el.getAttribute('href'))))
      expect(href).toBe('/portfolio.html');
    await expect(section.getByRole('link', { name: content.home.selected.cta })).toHaveCount(1);
    // No papers here any more (FD-91: their own section).
    await expect(section.locator('.pub, [data-first-author]')).toHaveCount(0);
  });

  test('FD-103: Latest posts shows the three seed posts now, with their standfirsts, no Draft chip', async ({
    page,
  }) => {
    expect(content.blog.every((post) => post.status === 'draft')).toBe(true);
    const section = page.locator('[data-home="latest"]');
    await expect(section).toHaveCount(1);
    await expect(section.locator('.eyebrow')).toHaveText(content.home.latest.eyebrow);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(
      content.home.latest.heading,
    );
    await expect(section.locator('.section-intro')).toHaveText(content.home.latest.intro);
    const cards = section.locator('.latest-card');
    await expect(cards).toHaveCount(3);
    for (const [i, post] of content.blog.entries()) {
      const card = cards.nth(i);
      const label = content.blogPage.categories.find((c) => c.id === post.category).label;
      await expect(card.locator('.latest-category')).toHaveText(label);
      await expect(card.getByRole('heading', { level: 3 })).toHaveText(post.title);
      // The written excerpt (FD-103), not a [bracketed] placeholder.
      await expect(card.locator('.latest-excerpt')).toHaveText(post.standfirst);
      expect(post.standfirst).not.toMatch(/^\[/);
      const link = card.getByRole('link');
      await expect(link).toHaveAccessibleName(`${content.home.latest.item_cta}: ${post.title}`);
      await expect(link).toHaveAttribute('href', `/post-${post.slug}.html`);
      expect((await page.request.get(`/post-${post.slug}.html`)).status(), post.slug).toBe(200);
    }
    await expect(section.locator('.chip-draft, .draft-chip')).toHaveCount(0);
    await expect(section.getByText('Draft', { exact: true })).toHaveCount(0);
    await expect(section.locator('.home-more a')).toHaveAttribute('href', '/blog.html');
  });

  test('Contact band: heading, text, email link and the one Contact action (FD-93)', async ({
    page,
  }) => {
    const band = page.locator('[data-home="contact"]');
    await expect(band.getByRole('heading', { level: 2 })).toHaveText(
      content.home.contact_band.heading,
    );
    await expect(band.locator('.band-text')).toHaveText(content.home.contact_band.text);
    expect(content.home.contact_band.text).toBe(
      'Research collaborations, software projects and technical questions.',
    );
    await expect(band.getByRole('link', { name: content.profile.email })).toHaveAttribute(
      'href',
      `mailto:${content.profile.email}`,
    );
    await expect(
      band.getByRole('link', { name: content.home.contact_band.primary }),
    ).toHaveAttribute('href', '/contact.html');
    // Only Contact: no Hire me here (the header and the services section have it).
    await expect(band.locator('.band-actions a')).toHaveCount(1);
    await expect(band.getByRole('link', { name: /Hire me/ })).toHaveCount(0);
    expect('secondary' in content.home.contact_band).toBe(false);
  });
});

test.describe('Home layout', () => {
  // The layout at rest: the document without JS or under
  // reduced motion (tests/stage.spec.js checks the two are identical); with motion the stage
  // reveals and pins it, which tests/stage.spec.js covers.
  test.use({ reducedMotion: 'reduce' });

  test('below 768px the eyebrow is the short form, also for screen readers', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    const short = `${content.profile.position} · ${content.profile.institution}`;
    const eyebrow = page.locator('.hero-eyebrow');
    await expect(eyebrow.locator('span:visible')).toHaveText(short);
    // The accessibility tree holds only the visible text.
    await expect(page.locator('[data-stage-hero]')).toMatchAriaSnapshot(`- paragraph: ${short}`);
    await expect(eyebrow.locator('span:visible')).toHaveCount(1);
  });

  // No rail reservation; section content shares the Fork's right edge.
  for (const width of [1440, 1920]) {
    test(`section content is aligned with the Fork's right edge at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      const edges = await page.evaluate(() =>
        Object.fromEntries(
          [
            ['fork', '.fork-row > :last-child .fork-card'],
            ['services', '.home-services > :last-child .service'],
            ['selected', '[data-featured-project]:last-child .card'],
            ['contact', '[data-home="contact"] .container'],
          ].map(([key, selector]) => {
            const el = document.querySelector(selector);
            const box = el.getBoundingClientRect();
            const pad = key === 'contact' ? parseFloat(getComputedStyle(el).paddingRight) : 0;
            return [key, box.right - pad];
          }),
        ),
      );
      for (const [key, right] of Object.entries(edges)) {
        expect(Math.abs(right - edges.fork), key).toBeLessThanOrEqual(1);
      }
    });
  }

  for (const width of [768, 1024, 1440]) {
    test(`Fork cards have the same size side by side at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      await page.evaluate(() => document.fonts.ready);
      const [a, b] = await rects(page, '[data-fork-col]');
      expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(a.top - b.top)).toBeLessThanOrEqual(1);
      expect(b.left).toBeGreaterThan(a.right);
      await expect(page.locator('.fork-seam')).toBeVisible({ visible: width >= 992 });
    });
  }

  test('Fork cards stack below 768px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    const [a, b] = await rects(page, '[data-fork-col]');
    expect(b.top).toBeGreaterThanOrEqual(a.bottom);
  });

  // FD-73, FD-86: on phones the text comes first — in the DOM too — then the whole portrait,
  // centred, then screen 2; 768–991 px: text left, photo right.
  for (const width of [320, 390, 767]) {
    test(`below 768px: name, CTAs, the whole portrait centred, screen 2 (${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/index.html');
      await page.locator('[data-stage-figure] img').evaluate((img) => img.decode());
      const [ctas] = await rects(page, '.hero-ctas');
      const [figure] = await rects(page, '[data-stage-figure]');
      const [statement] = await rects(page, '[data-stage-statement]');
      const shape = await phonePortrait(page);
      // The original image, its proportions kept; the window clips only transparent margin.
      expect(shape.src).toContain('P5-desktop-720x1300');
      expect(shape.img.width / shape.img.height).toBeCloseTo(720 / 1300, 2);
      expect(shape.window.width / shape.window.height).toBeCloseTo(490 / 920, 2);
      expect(shape.content.top).toBeGreaterThanOrEqual(shape.window.top);
      expect(shape.content.left).toBeGreaterThanOrEqual(shape.window.left - 0.5);
      expect(shape.content.right).toBeLessThanOrEqual(shape.window.right);
      // Shoes and chair legs in.
      expect(shape.content.bottom).toBeLessThanOrEqual(shape.window.bottom);
      // Centred under the buttons, clear of them and of screen 2 (with the parallax's room).
      const centre = (shape.content.left + shape.content.right) / 2;
      expect(Math.abs(centre - width / 2)).toBeLessThanOrEqual(width * 0.03);
      expect(figure.top).toBeGreaterThanOrEqual(ctas.bottom + 26);
      expect(statement.top).toBeGreaterThanOrEqual(figure.bottom + 16);
      // Large enough to read as the figure (40 % of a phone's width or more), within 60 svh.
      if (width <= 430) expect(shape.window.width).toBeGreaterThanOrEqual(width * 0.4 - 1);
      expect(figure.height).toBeLessThanOrEqual(844 * 0.6 + 1);
      const order = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        const figureEl = document.querySelector('[data-stage-figure]');
        return Boolean(h1.compareDocumentPosition(figureEl) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(order).toBe(true);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  }

  test('768–991px: text left, photo right, static', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1000 });
    await page.goto('/index.html');
    const [figure] = await rects(page, '[data-stage-figure]');
    const [name] = await rects(page, 'h1');
    expect(figure.left).toBeGreaterThanOrEqual(name.right - 1);
    expect(figure.top).toBeLessThan(name.bottom);
    await expect(page.locator('[data-stage]')).not.toHaveClass(/is-staged/);
  });

  test('from 992px the figure is beside the hero text (columns 1–7 | 8–12)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/index.html');
    const [figure] = await rects(page, '[data-stage-figure]');
    const [name] = await rects(page, 'h1');
    expect(figure.left).toBeGreaterThan(name.left);
    expect(figure.top).toBeLessThan(name.bottom);
  });

  // FD-84: the headline keeps its two lines from 992 px, and screen 2 stays left of the photo.
  for (const [width, height] of [
    [992, 800],
    [1024, 768],
    [1200, 900],
    [1280, 720],
    [1440, 900],
    [1920, 1080],
  ]) {
    test(`screen 2: two headline lines, clear of the photo at ${width}×${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/index.html');
      await page.evaluate(() => document.fonts.ready);
      // Rendered lines per data line: distinct tops of its text's line boxes.
      const lines = await page.locator('.screen2-line').evaluateAll((els) =>
        els.map((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        }),
      );
      expect(lines).toEqual([1, 1]);
      const right = await page
        .locator('[data-stage-statement] *')
        .evaluateAll((els) => Math.max(...els.map((el) => el.getBoundingClientRect().right)));
      const [photo] = await rects(page, '[data-stage-figure] img');
      expect(right).toBeLessThan(photo.left);
    });
  }

  // FD-84: the Areas-of-work grid has 3 columns from 992 px, 2 below, 1 under 360 px.
  for (const [width, columns] of [
    [1440, 3],
    [992, 3],
    [768, 2],
    [390, 2],
    [340, 1],
  ]) {
    // The pillars follow the grid under 360 px.
    const pillars = width < 360 ? 1 : 2;
    test(`Areas of work: ${columns} column(s) at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      const lefts = await page
        .locator('.screen2-grid > li')
        .evaluateAll((els) => new Set(els.map((el) => Math.round(el.offsetLeft))).size);
      expect(lefts).toBe(columns);
      const pillarLefts = await page
        .locator('.screen2-pillars > li')
        .evaluateAll((els) => new Set(els.map((el) => Math.round(el.offsetLeft))).size);
      expect(pillarLefts).toBe(pillars);
      for (const box of await rects(page, '.screen2-grid .area, .pillar')) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    });
  }

  test('the hero fits at 320px and the name stays at 44px or more', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/index.html');
    await page.evaluate(() => document.fonts.ready);
    const fontSize = await page
      .locator('h1')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(44);
    const overflow = await page
      .locator('[data-stage] *')
      .evaluateAll(
        (els) =>
          els.filter(
            (el) => el.getBoundingClientRect().right > document.documentElement.clientWidth,
          ).length,
      );
    expect(overflow).toBe(0);
  });

  // FD-93: phones show the whole original P6 — chair and shoes — centred under the action
  // (lazy, so not before the band nears).
  for (const width of [320, 390, 767]) {
    test(`P6 in the Contact band at ${width}px: whole, centred, under the action`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/index.html');
      const img = page.locator('.contact-band-figure img');
      await img.scrollIntoViewIfNeeded();
      await expect(img).toBeVisible();
      await img.evaluate((el) => el.decode());
      const shape = await phonePortrait(page, '[data-contact-figure]', 'P6');
      const [actions] = await rects(page, '[data-home="contact"] .band-actions');
      expect(shape.src).toContain('P6-desktop-720x1300');
      expect(shape.img.width / shape.img.height).toBeCloseTo(720 / 1300, 2);
      expect(shape.content.top).toBeGreaterThanOrEqual(shape.window.top);
      expect(shape.content.bottom).toBeLessThanOrEqual(shape.window.bottom);
      expect(shape.content.left).toBeGreaterThanOrEqual(shape.window.left - 0.5);
      expect(shape.content.right).toBeLessThanOrEqual(shape.window.right + 0.5);
      expect(shape.window.top).toBeGreaterThanOrEqual(actions.bottom);
      const centre = (shape.content.left + shape.content.right) / 2;
      expect(Math.abs(centre - width / 2)).toBeLessThanOrEqual(width * 0.03);
      if (width <= 430) expect(shape.window.width).toBeGreaterThanOrEqual(width * 0.4 - 1);
    });
  }

  // FD-72: from 768 px as tall as the text block beside it (360–420 px), never upscaled.
  for (const width of [1024, 1280, 1440, 1920]) {
    test(`P6 in the Contact band at ${width}px: 360–420px, near the text block`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      const img = page.locator('.contact-band-figure img');
      await img.scrollIntoViewIfNeeded();
      await expect(img).toBeVisible();
      await expect
        .poll(() => img.evaluate((el) => el.complete && el.naturalWidth))
        .toBeGreaterThan(0);
      const height = await img.evaluate((el) => el.offsetHeight);
      const text = await page
        .locator('.contact-band-row > :first-child')
        .evaluate((el) => el.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(360);
      expect(height).toBeLessThanOrEqual(Math.min(420, 1300));
      // FD-93's one-line text and single action made the text block ~285–300 px, under
      // FD-72's 360 px floor for the photo: the photo keeps its approved size, so it may now be
      // up to a third taller than the text.
      expect(Math.abs(height - text) / text).toBeLessThan(0.34);
    });
  }
});

// FD-102 (design specification, Selected work desktop / mobile): one large card left (about 7/12)
// and two smaller ones stacked right from 992 px, an amber "Full portfolio →" text link top
// right; phones: large, then the two, then a full-width "Full portfolio →" button.
test.describe('Selected work layout (FD-102)', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const width of [992, 1280, 1440, 1920]) {
    test(`FD-102: large card left, two stacked right, amber link top right at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      await page.evaluate(() => document.fonts.ready);
      const [large, a, b] = await rects(page, '[data-home="selected"] .work-card');
      const [list] = await rects(page, '[data-home="selected"] .work-cards');
      expect(large.width / list.width).toBeGreaterThan(7 / 12 - 0.03);
      expect(large.width / list.width).toBeLessThan(7 / 12 + 0.03);
      for (const small of [a, b]) {
        expect(small.left).toBeGreaterThan(large.right);
        expect(Math.abs(small.right - list.right)).toBeLessThanOrEqual(1);
      }
      expect(b.top).toBeGreaterThan(a.bottom);
      expect(Math.abs(large.top - a.top)).toBeLessThanOrEqual(1);
      expect(Math.abs(large.bottom - b.bottom)).toBeLessThanOrEqual(1);
      // The large card's title is the larger one.
      const sizes = await page
        .locator('[data-home="selected"] .card-title')
        .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
      expect(sizes[0]).toBeGreaterThan(sizes[1]);
      // Its title on two lines, "Poultry farm monitoring / with edge AI", as in the design specification.
      const firstLine = await page.locator('.work-card-large .card-title').evaluate((h) => {
        const range = document.createRange();
        range.selectNodeContents(h);
        const rects = [...range.getClientRects()];
        return {
          lines: new Set(rects.map((r) => Math.round(r.top))).size,
          words: h.textContent.trim().split(' ').slice(0, 3).join(' '),
        };
      });
      expect(firstLine.lines).toBe(2);
      expect(firstLine.words).toBe('Poultry farm monitoring');
      // "Full portfolio →": the amber text link, top right, level with the heading; the phone
      // button is not shown.
      const link = page.locator('[data-home="selected"] .more-link');
      await expect(link).toBeVisible();
      await expect(page.locator('[data-home="selected"] .home-more .btn')).toBeHidden();
      const [more] = await rects(page, '[data-home="selected"] .more-link');
      const [title] = await rects(page, '#selected-title');
      expect(more.bottom).toBeLessThanOrEqual(large.top);
      expect(Math.abs(more.right - list.right)).toBeLessThanOrEqual(1);
      expect(more.top).toBeLessThan(title.bottom);
      expect(more.height).toBeGreaterThanOrEqual(44);
      const accent = await page.evaluate(() => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--accent)';
        document.body.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      });
      await expect(link).toHaveCSS('color', accent);
      if (width === 1440) {
        await page
          .locator('[data-home="selected"]')
          .screenshot({ path: 'tests/screenshots/home/selected-work-1440-dark.png' });
      }
    });
  }

  for (const width of [320, 390, 768]) {
    test(`FD-102: phones — large, then the two, then a full-width "Full portfolio" at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/index.html');
      const cards = await rects(page, '[data-home="selected"] .work-card');
      for (let i = 1; i < cards.length; i += 1) {
        expect(cards[i].top).toBeGreaterThanOrEqual(cards[i - 1].bottom);
        expect(Math.abs(cards[i].width - cards[0].width)).toBeLessThanOrEqual(1);
      }
      await expect(page.locator('[data-home="selected"] .work-card').first()).toHaveClass(
        /work-card-large/,
      );
      await expect(page.locator('[data-home="selected"] .more-link')).toBeHidden();
      const [more] = await rects(page, '[data-home="selected"] .home-more .btn');
      expect(more.top).toBeGreaterThanOrEqual(cards[2].bottom);
      expect(Math.abs(more.width - cards[2].width)).toBeLessThanOrEqual(1);
      expect(more.height).toBeGreaterThanOrEqual(44);
      if (width === 390) {
        await page
          .locator('[data-home="selected"]')
          .screenshot({ path: 'tests/screenshots/home/selected-work-390-dark.png' });
      }
    });
  }
});

// FD-105 (early part of FD-76): Home's text actions per the design specification — an
// --accent 1 px underline at rest, --accent text on a 2 px underline on hover and keyboard
// focus; "Read article" without an underline, --accent on hover.
test.describe('Home link styles (FD-105)', () => {
  test.use({ reducedMotion: 'reduce' });
  const look = (locator) =>
    locator.evaluate((label) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--accent)';
      document.body.append(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      const cs = getComputedStyle(label);
      return {
        accentLine: cs.backgroundImage.includes(accent),
        size: cs.backgroundSize,
        image: cs.backgroundImage,
        accentText: cs.color === accent,
      };
    });

  for (const [name, link, label] of [
    ['View project', '[data-home="selected"] .work-link', '.link'],
    ['services actions', '[data-home="hire"] .service-evidence', '.link'],
    ['DOI', '[data-home="publications"] .home-pub-action >> nth=0', '.home-pub-label'],
    ['Project', '[data-home="publications"] .home-pub-action >> nth=1', '.home-pub-label'],
  ]) {
    test(`FD-105: ${name} — accent underline 1 px, accent text and 2 px on hover and focus (1440px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/index.html');
      const links = page.locator(link);
      const count =
        name.startsWith('View') || name.startsWith('services') ? await links.count() : 1;
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i += 1) {
        const a = count > 1 ? links.nth(i) : links.first();
        await a.scrollIntoViewIfNeeded();
        let s = await look(a.locator(label));
        expect([s.accentLine, s.size, s.accentText], `${name} ${i} at rest`).toEqual([
          true,
          '100% 1px',
          false,
        ]);
        await a.locator(label).hover();
        await expect.poll(async () => (await look(a.locator(label))).size).toBe('100% 2px');
        s = await look(a.locator(label));
        expect(s.accentText, `${name} ${i} hover`).toBe(true);
        await page.mouse.move(5, 5);
        await a.evaluate((el) => el.focus({ focusVisible: true }));
        await expect.poll(async () => (await look(a.locator(label))).size).toBe('100% 2px');
        await a.evaluate((el) => el.blur());
      }
    });
  }

  test('FD-105: Read article — no underline, accent on hover (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    const a = page.locator('[data-home="latest"] .work-link').first();
    await a.scrollIntoViewIfNeeded();
    let s = await look(a.locator('.link'));
    expect([s.image, s.accentText]).toEqual(['none', false]);
    await a.locator('.link').hover();
    await expect.poll(async () => (await look(a.locator('.link'))).accentText).toBe(true);
    s = await look(a.locator('.link'));
    expect(s.image).toBe('none');
  });

  // FD-119 makes FD-76 site-wide: Hire me's service links now match Home's.
  test('FD-119: Hire me service links have the same --accent underline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hire.html');
    const s = await look(page.locator('.service-evidence .link').first());
    expect(s.size).toBe('100% 1px');
  });
});

// FD-91: Home "Selected publications" — the first-author papers with short authors.
test.describe('Selected publications (FD-91)', () => {
  test.use({ reducedMotion: 'reduce' });
  const papers = content.publications.filter((pub) => pub.first_author);

  test('rows from the data: index, type, title, short authors, venue · details, actions', async ({
    page,
  }) => {
    await page.goto('/index.html');
    const section = page.locator('[data-home="publications"]');
    await expect(section.locator('.eyebrow')).toHaveText(content.home.publications.eyebrow);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(
      content.home.publications.heading,
    );
    await expect(section.locator('.section-intro')).toHaveText(content.home.publications.intro);
    const rows = section.locator('.home-pub');
    expect(papers).toHaveLength(3);
    await expect(rows).toHaveCount(papers.length);
    for (const [i, pub] of papers.entries()) {
      const row = rows.nth(i);
      // The site author is always the first author in this list.
      expect(pub.authors[0].me, pub.id).toBe(true);
      expect(pub.authors[0].name).toBe('Al Mamun, M. R.');
      await expect(row.locator('.home-pub-index')).toHaveText(String(i + 1).padStart(2, '0'));
      await expect(row.locator('.home-pub-type')).toHaveText(
        pub.type === 'journal' ? 'Journal' : 'Conference',
      );
      await expect(row.getByRole('heading', { level: 3 })).toHaveText(pub.title);
      await expect(row.locator('.home-pub-authors')).toHaveText('Al Mamun, M. R., et al.');
      await expect(row.locator('.home-pub-venue em')).toHaveText(pub.venue);
      await expect(row.locator('.home-pub-venue')).toHaveText(venueLine(pub, ' · '));
      const doi = row.getByRole('link', { name: /^DOI/ });
      await expect(doi).toHaveAttribute('href', `https://doi.org/${pub.doi}`);
      await expect(doi).toHaveAttribute('target', '_blank');
      await expect(doi).toHaveAttribute('rel', 'noopener noreferrer');
      await expect(doi).toHaveAccessibleName(`DOI: ${pub.title} (opens in a new tab)`);
      const project = row.getByRole('link', { name: /^Project/ });
      await expect(project).toHaveAttribute('href', `/project-${pub.project}.html`);
    }
    // The full author lists stay on Portfolio, not here.
    await expect(section.getByText(papers[0].authors[1].name)).toHaveCount(0);
    await expect(
      section.getByRole('link', { name: content.home.publications.cta }),
    ).toHaveAttribute('href', '/portfolio.html');
  });

  for (const width of [992, 1440, 1920]) {
    test(`from 992px the actions sit right, with a divider (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      const rows = await page.locator('.home-pub').evaluateAll((els) =>
        els.map((el) => {
          const body = el.querySelector('.home-pub-body').getBoundingClientRect();
          const [doi, project] = [...el.querySelectorAll('.home-pub-action')].map((a) => ({
            box: a.getBoundingClientRect().toJSON(),
            divider: getComputedStyle(a).borderLeftWidth,
          }));
          return {
            row: el.getBoundingClientRect().toJSON(),
            body: body.toJSON(),
            doi,
            project,
            separator: getComputedStyle(el).borderTopWidth,
          };
        }),
      );
      const [list] = await rects(page, '.home-pubs');
      for (const [i, r] of rows.entries()) {
        expect(r.doi.box.left).toBeGreaterThanOrEqual(r.body.right);
        expect(r.project.box.left).toBeGreaterThan(r.doi.box.right - 1);
        expect(Math.abs(r.doi.box.top - r.project.box.top)).toBeLessThanOrEqual(1);
        expect(r.project.box.right).toBeLessThanOrEqual(list.right + 0.5);
        expect(list.right - r.project.box.right).toBeLessThanOrEqual(32);
        expect(r.project.divider).toBe('1px');
        // Separators between rows.
        expect(r.separator).toBe(i === 0 ? '0px' : '1px');
        expect(r.doi.box.height).toBeGreaterThanOrEqual(24);
      }
    });
  }

  for (const width of [320, 390]) {
    test(`phones: two buttons under each citation (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/index.html');
      const rows = await page.locator('.home-pub').evaluateAll((els) =>
        els.map((el) => ({
          body: el.querySelector('.home-pub-body').getBoundingClientRect().toJSON(),
          actions: [...el.querySelectorAll('.home-pub-action')].map((a) => ({
            ...a.getBoundingClientRect().toJSON(),
            border: getComputedStyle(a).borderTopWidth,
          })),
        })),
      );
      for (const row of rows) {
        expect(row.actions).toHaveLength(2);
        for (const action of row.actions) {
          expect(action.top).toBeGreaterThanOrEqual(row.body.bottom);
          expect(action.height).toBeGreaterThanOrEqual(44);
          expect(action.right).toBeLessThanOrEqual(width);
          expect(action.border).toBe('1px');
        }
      }
      const [more] = await rects(page, '[data-home="publications"] .home-more .btn');
      const [list] = await rects(page, '.home-pubs');
      expect(more.top).toBeGreaterThanOrEqual(list.bottom);
      expect(Math.abs(more.width - list.width)).toBeLessThanOrEqual(1);
    });
  }
});

// FD-89: one service partial, Home and Hire me.
test.describe('Services (FD-89)', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const file of ['index.html', 'hire.html']) {
    test(`${file}: the data's copy and one action per card`, async ({ page }) => {
      await page.goto(`/${file}`);
      const cards = page.locator('.service');
      await expect(cards).toHaveCount(content.hire.services.length);
      for (const [i, service] of content.hire.services.entries()) {
        const card = cards.nth(i);
        await expect(card.locator('.service-number')).toHaveText(service.n);
        await expect(card.locator('.service-title')).toHaveText(service.title);
        await expect(card.locator('.service-summary')).toHaveText(service.summary);
        await expect(card.locator('.service-items li')).toHaveText(service.items);
        const links = card.getByRole('link');
        await expect(links).toHaveCount(1);
        const external = service.evidence.href.startsWith('https://');
        // FD-76: another site opens in a new tab and says so.
        await expect(links).toHaveAccessibleName(
          external ? `${service.evidence.label} (opens in a new tab)` : service.evidence.label,
        );
        await expect(links).toHaveAttribute(
          'href',
          external ? service.evidence.href : `/${service.evidence.href}`,
        );
        // → for this site, ↗ for another.
        await expect(links.locator('svg path')).toHaveAttribute(
          'd',
          external ? 'M7 17L17 7M9 7h8v8' : 'M5 12h14M13 6l6 6-6 6',
        );
      }
    });

    for (const width of [992, 1024, 1199, 1280, 1440, 1920]) {
      test(`${file}: equal cards, headings, and aligned actions at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${file}`);
        await page.evaluate(() => document.fonts.ready);
        const cards = await page.locator('.service').evaluateAll((els) =>
          els.map((el) => {
            const top = (s) => el.querySelector(s).getBoundingClientRect().top;
            const r = el.getBoundingClientRect();
            const action = el.querySelector('.service-evidence').getBoundingClientRect();
            return {
              top: r.top,
              height: r.height,
              size: getComputedStyle(el.querySelector('.service-title')).fontSize,
              summary: top('.service-summary'),
              items: top('.service-items'),
              action: action.top,
              gap: r.bottom - action.bottom,
            };
          }),
        );
        for (const key of ['top', 'height', 'summary', 'items', 'action', 'gap']) {
          const values = cards.map((card) => card[key]);
          expect(Math.max(...values) - Math.min(...values), key).toBeLessThanOrEqual(1);
        }
        expect(new Set(cards.map((card) => card.size)).size).toBe(1);
        // The action sits on the card's bottom (its padding only).
        expect(cards[0].gap).toBeLessThanOrEqual(25);
      });
    }
  }

  test('Home head at 1440px: heading left; intro, Hire me and Request CV right', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    const band = page.locator('[data-home="hire"]');
    await expect(band.locator('.band-text')).toHaveText([content.home.hire_intro]);
    await expect(band.getByText(content.hire.availability)).toHaveCount(0);
    const actions = band.locator('.band-actions a');
    await expect(actions).toHaveText([/Hire me/, /Request CV/]);
    const [heading] = await rects(page, '#hire-title');
    const [intro] = await rects(page, '[data-home="hire"] .band-text');
    const [buttons] = await rects(page, '[data-home="hire"] .band-actions');
    expect(intro.left).toBeGreaterThan(heading.right);
    expect(buttons.left).toBeGreaterThan(heading.right);
    expect(buttons.top).toBeGreaterThan(intro.top);
  });

  test('phones: the cards stack, without empty space in them', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    const cards = await page.locator('.home-services .service').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const items = el.querySelector('.service-items').getBoundingClientRect();
        const action = el.querySelector('.service-evidence').getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, gap: action.top - items.bottom };
      }),
    );
    for (const [i, card] of cards.entries()) {
      if (i) expect(card.top).toBeGreaterThanOrEqual(cards[i - 1].bottom);
      // The list and the action are one row gap (+ the action's margin) apart.
      expect(card.gap).toBeLessThanOrEqual(24);
    }
  });
});

test.describe('Home performance (handoff §5)', () => {
  test('HTML is at most 60 KB', () => {
    expect(statSync('dist/index.html').size).toBeLessThanOrEqual(60 * 1024);
  });

  for (const [width, height, budget, crop] of [
    [390, 844, 45, 'P5-desktop-720x1300'],
    [1440, 900, 110, 'P5-desktop-720x1300'],
  ]) {
    test(`at ${width}px the hero image is the LCP, within ${budget} KB, with no layout shift`, async ({
      page,
    }) => {
      const sizes = new Map();
      page.on('response', async (response) => {
        if (/\/assets\/P5-/.test(response.url())) {
          sizes.set(response.url(), (await response.body()).length);
        }
      });
      await page.setViewportSize({ width, height });
      await page.goto('/index.html', { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);

      const result = await page.evaluate(
        () =>
          new Promise((resolve) => {
            const out = { lcp: null, cls: 0, figureShifts: 0 };
            new PerformanceObserver((list) => {
              const last = list.getEntries().at(-1);
              out.lcp = {
                tag: last.element?.tagName,
                inFigure: Boolean(last.element?.closest('[data-stage-figure]')),
                url: last.url,
              };
            }).observe({ type: 'largest-contentful-paint', buffered: true });
            new PerformanceObserver((list) => {
              for (const entry of list.getEntries()) {
                if (entry.hadRecentInput) continue;
                out.cls += entry.value;
                for (const source of entry.sources ?? []) {
                  if (source.node?.closest?.('[data-stage-figure]')) out.figureShifts += 1;
                }
              }
            }).observe({ type: 'layout-shift', buffered: true });
            setTimeout(() => resolve(out), 200);
          }),
      );

      expect(result.lcp).toMatchObject({ tag: 'IMG', inFigure: true });
      expect(result.lcp.url).toContain(crop);
      expect(result.cls).toBeLessThanOrEqual(0.05);
      expect(result.figureShifts).toBe(0);

      const current = await page.locator('[data-stage-figure] img').evaluate((el) => el.currentSrc);
      expect(current).toContain(crop);
      await expect.poll(() => sizes.get(current)).toBeGreaterThan(0);
      expect(sizes.get(current)).toBeLessThanOrEqual(budget * 1024);
    });
  }
});

test.describe('Home without JavaScript (handoff §3)', () => {
  test.use({ javaScriptEnabled: false });

  test('every section is visible and every link works', async ({ page, request, baseURL }) => {
    await page.goto('/index.html');
    expect(await page.evaluate(() => document.documentElement.classList.contains('js'))).toBe(
      false,
    );
    for (const selector of [
      '[data-stage-figure] img',
      'h1',
      '.hero-ctas',
      '[data-stage-statement]',
      '.screen2-headline',
      '.screen2-pillars',
      '.screen2-areas',
      '[data-fork-col="portfolio"]',
      '[data-fork-col="blog"]',
      '[data-home="hire"]',
      '[data-home="selected"]',
      '[data-home="publications"]',
      '[data-home="contact"]',
    ]) {
      await page.locator(selector).first().scrollIntoViewIfNeeded();
      await expect(page.locator(selector).first(), selector).toBeVisible();
    }

    const origin = new URL(baseURL).origin;
    const hrefs = await page
      .locator('main a[href]')
      .evaluateAll((els) => [...new Set(els.map((el) => el.href))]);
    const internal = hrefs.filter((href) => href.startsWith(origin));
    expect(internal.length).toBeGreaterThanOrEqual(8);
    for (const href of internal) {
      const response = await request.get(href);
      expect(response.status(), href).toBe(200);
    }
    for (const href of hrefs.filter((h) => !h.startsWith(origin))) {
      expect(href).toMatch(/^(https:\/\/|mailto:)/);
    }
  });
});

test.describe('Latest posts with a published post (FD-45)', () => {
  test('FD-103: the data layer — the seed posts now; in the release build published only, newest first, up to three', () => {
    // Now (RELEASE unset): the built posts in the data's order.
    expect(site.release).toBe(false);
    expect(site.latestPosts.map((post) => post.slug)).toEqual(content.blog.map((p) => p.slug));
    expect(buildSite(content, { showDrafts: true, release: true }).latestPosts).toEqual([]);
    // The release build leaves drafts out everywhere unless SHOW_DRAFTS says otherwise.
    const saved = process.env.SHOW_DRAFTS;
    delete process.env.SHOW_DRAFTS;
    try {
      expect(buildSite(content, { release: true, bodies: {} }).postList).toEqual([]);
      expect(buildSite(content, { release: false, bodies: {} }).postList).toHaveLength(3);
    } finally {
      if (saved !== undefined) process.env.SHOW_DRAFTS = saved;
    }
    const published = structuredClone(content);
    const [a, b, c] = published.blog;
    Object.assign(a, { status: 'published', date: '2026-10-01' });
    Object.assign(b, { status: 'draft' });
    Object.assign(c, { status: 'published', date: '2026-11-15' });
    const latest = buildSite(published, { showDrafts: true, release: true }).latestPosts;
    expect(latest.map((post) => post.slug)).toEqual([c.slug, a.slug]);

    const many = structuredClone(content);
    many.blog.push(
      ...structuredClone(content.blog).map((post) => ({ ...post, slug: `${post.slug}-2` })),
    );
    many.blog.forEach((post, i) =>
      Object.assign(post, { status: 'published', date: `2026-11-0${i + 1}` }),
    );
    const four = buildSite(many, { showDrafts: true, release: true, bodies: {} }).latestPosts;
    expect(four.map((post) => post.date)).toEqual(['2026-11-06', '2026-11-05', '2026-11-04']);
  });
});

// FD-103 (design specification, Latest posts desktop / mobile): three cards from 992 px with "All
// posts →" top right; on phones stacked, then a full-width "All posts →".
test.describe('Latest posts layout (FD-103)', () => {
  test.use({ reducedMotion: 'reduce' });

  test('FD-103: three equal cards in a row, "All posts" top right (1440px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    await page.evaluate(() => document.fonts.ready);
    const cards = await rects(page, '[data-home="latest"] .latest-card');
    expect(cards).toHaveLength(3);
    for (const key of ['width', 'height', 'top']) {
      const values = cards.map((card) => card[key]);
      expect(Math.max(...values) - Math.min(...values), key).toBeLessThanOrEqual(1);
    }
    // "Read article" on each card's bottom, on one line.
    const links = await rects(page, '[data-home="latest"] .work-link');
    const tops = links.map((link) => link.top);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    const [more] = await rects(page, '[data-home="latest"] .home-more .btn');
    const [title] = await rects(page, '#latest-title');
    expect(more.bottom).toBeLessThanOrEqual(cards[0].top);
    expect(more.top).toBeLessThan(title.bottom);
    expect(Math.abs(more.right - cards[2].right)).toBeLessThanOrEqual(1);
    await page
      .locator('[data-home="latest"]')
      .screenshot({ path: 'tests/screenshots/home/latest-posts-1440-dark.png' });
  });

  test('FD-103: phones — stacked cards, then a full-width "All posts" (390px)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    const cards = await rects(page, '[data-home="latest"] .latest-card');
    expect(cards).toHaveLength(3);
    for (let i = 1; i < cards.length; i += 1) {
      expect(cards[i].top).toBeGreaterThanOrEqual(cards[i - 1].bottom);
    }
    const [more] = await rects(page, '[data-home="latest"] .home-more .btn');
    expect(more.top).toBeGreaterThanOrEqual(cards[2].bottom);
    expect(Math.abs(more.width - cards[2].width)).toBeLessThanOrEqual(1);
    expect(more.height).toBeGreaterThanOrEqual(44);
    await page
      .locator('[data-home="latest"]')
      .screenshot({ path: 'tests/screenshots/home/latest-posts-390-dark.png' });
  });
});

// FD-103 release guard (FD-45, FD-92): with RELEASE=true only published posts show. A release
// build with the test fixture (one published post) proves its place, data and layout; a release
// build of today's data (every post a draft) has no section at all. Served from those builds
// only, through page.route, never from dist/.
test.describe('Latest posts in a release build (FD-103)', () => {
  test.describe.configure({ mode: 'serial' });
  const origin = 'http://fixture.test';
  let dir;
  let outDir;
  let emptyDir;
  let blog;

  test.beforeAll(() => {
    test.setTimeout(120_000);
    dir = mkdtempSync(join(tmpdir(), 'home-latest-'));
    blog = structuredClone(content.blog);
    Object.assign(blog[0], { status: 'published', date: '2026-11-01', standfirst: 'Text.' });
    const fixture = join(dir, 'fixture.json');
    writeFileSync(fixture, JSON.stringify({ blog }));
    outDir = join(dir, 'dist');
    emptyDir = join(dir, 'dist-empty');
    const build = (out, env) =>
      spawnSync(
        process.execPath,
        ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--logLevel', 'error'],
        { env: { ...process.env, RELEASE: 'true', ...env }, encoding: 'utf8' },
      );
    let result = build(outDir, { CONTENT_FIXTURE: fixture });
    expect(result.status, result.stderr).toBe(0);
    result = build(emptyDir, {});
    expect(result.status, result.stderr).toBe(0);
  });

  test('FD-103: release build with every post a draft — no Latest posts section', () => {
    const html = readFileSync(join(emptyDir, 'index.html'), 'utf8');
    expect(html).not.toContain('data-home="latest"');
    expect(html).not.toContain(content.home.latest.heading);
  });

  test.afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  async function openFixture(page, width, height) {
    await page.route(`${origin}/**`, (route) => {
      const path = new URL(route.request().url()).pathname;
      route.fulfill({ path: join(outDir, path === '/' ? 'index.html' : path) });
    });
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}/index.html`);
    await page.evaluate(() => document.fonts.ready);
  }

  test('FD-103: release build — only the published post shows, between publications and Contact', () => {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    const section = html.slice(
      html.indexOf('data-home="latest"'),
      html.indexOf('data-home="contact"'),
    );
    expect(section).toContain(content.home.latest.heading);
    expect(section).toContain(content.home.latest.intro);
    expect(section).toContain(blog[0].title);
    expect(section).toContain(`href="/post-${blog[0].slug}.html"`);
    expect(section).toContain('href="/blog.html"');
    // In the release build drafts never appear on Home.
    for (const post of blog.slice(1)) expect(section).not.toContain(post.title);
    expect(section).not.toContain('chip-draft');
    // Order: Selected work, Selected publications, Latest posts, then the Contact band.
    const at = (key) => html.indexOf(`data-home="${key}"`);
    expect(at('selected')).toBeLessThan(at('publications'));
    expect(at('publications')).toBeLessThan(at('latest'));
    expect(at('latest')).toBeLessThan(at('contact'));
  });

  test('card: category in the accent mono, title, standfirst, Read article (1440px)', async ({
    page,
  }) => {
    await openFixture(page, 1440, 900);
    const section = page.locator('[data-home="latest"]');
    await expect(section.locator('.eyebrow')).toHaveText(content.home.latest.eyebrow);
    const cards = section.locator('.latest-card');
    await expect(cards).toHaveCount(1);
    const card = cards.first();
    const label = content.blogPage.categories.find((c) => c.id === blog[0].category).label;
    await expect(card.locator('.latest-category')).toHaveText(label);
    const style = await card.locator('.latest-category').evaluate((el) => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--accent)';
      document.body.append(probe);
      const accent = getComputedStyle(probe).color;
      probe.remove();
      const cs = getComputedStyle(el);
      return { color: cs.color, accent, font: cs.fontFamily };
    });
    expect(style.color).toBe(style.accent);
    expect(style.font).toMatch(/JetBrains Mono/);
    await expect(card.getByRole('heading', { level: 3 })).toHaveText(blog[0].title);
    await expect(card.locator('.latest-excerpt')).toHaveText(blog[0].standfirst);
    const link = card.getByRole('link');
    await expect(link).toHaveAccessibleName(`${content.home.latest.item_cta}: ${blog[0].title}`);
    await expect(link).toHaveAttribute('href', `/post-${blog[0].slug}.html`);
    // Three columns from lg; "All posts" top right.
    const [box] = await rects(page, '[data-home="latest"] .latest-card');
    const [list] = await rects(page, '[data-home="latest"] .latest-cards');
    expect(box.width).toBeLessThan(list.width / 3);
    const [more] = await rects(page, '[data-home="latest"] .home-more .btn');
    expect(more.bottom).toBeLessThanOrEqual(box.top);
    const inner = await page
      .locator('[data-home="latest"] .container')
      .evaluate(
        (el) => el.getBoundingClientRect().right - parseFloat(getComputedStyle(el).paddingRight),
      );
    expect(Math.abs(more.right - inner)).toBeLessThanOrEqual(1);
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({
      path: 'tests/screenshots/home/latest-posts-fixture-1440-dark.png',
    });
  });

  test('phones: the card, then a full-width "All posts" (390px)', async ({ page }) => {
    await openFixture(page, 390, 844);
    const [box] = await rects(page, '[data-home="latest"] .latest-card');
    const [more] = await rects(page, '[data-home="latest"] .home-more .btn');
    expect(more.top).toBeGreaterThanOrEqual(box.bottom);
    expect(Math.abs(more.width - box.width)).toBeLessThanOrEqual(1);
  });
});

// Keyboard walk: Tab through Home from the top — skip link, header, hero, pillars, Fork,
// services, Selected work, publications, Contact, footer, back-to-top — each stop with a visible
// focus indicator (its own outline, or the card's ring for a stretched card link).
test.describe('Home keyboard walk', () => {
  const groups = [
    ['skip', '.skip-link'],
    ['header', '.site-header, #drawer'],
    ['hero', '[data-stage-hero]'],
    ['pillars', '.screen2-pillars'],
    ['fork', '[data-stage-fork]'],
    ['services', '[data-home="hire"]'],
    ['selected', '[data-home="selected"]'],
    ['publications', '[data-home="publications"]'],
    ['latest', '[data-home="latest"]'],
    ['contact', '[data-home="contact"]'],
    ['footer', '.site-footer'],
    ['back-to-top', '[data-back-to-top]'],
  ];

  for (const [width, height, reducedMotion] of [
    [1440, 900, 'reduce'],
    [1440, 900, 'no-preference'],
    [390, 844, 'reduce'],
  ]) {
    test(`skip link → … → back-to-top, focus always visible (${width}px, ${reducedMotion})`, async ({
      browser,
    }) => {
      test.setTimeout(90_000);
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
      const page = await context.newPage();
      await page.goto('/index.html');
      await page.evaluate(() => document.fonts.ready);
      const order = [];
      for (let i = 0; i < 80; i += 1) {
        await page.keyboard.press('Tab');
        // The stage's focus jump and the back-to-top fade settle.
        await page.waitForTimeout(reducedMotion === 'reduce' ? 30 : 120);
        const stop = await page.evaluate((list) => {
          const el = document.activeElement;
          const group = list.find(([, selector]) => el.closest(selector))?.[0] ?? el.tagName;
          const ring = (node) => {
            const cs = getComputedStyle(node);
            return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
          };
          const visible = ring(el) || Boolean(el.closest('.card') && ring(el.closest('.card')));
          return { group, visible, name: (el.getAttribute('aria-label') || el.textContent).trim() };
        }, groups);
        if (stop.group === 'BODY') break;
        expect(stop.visible, `${stop.group}: ${stop.name}`).toBe(true);
        if (order.at(-1) !== stop.group) order.push(stop.group);
        if (stop.group === 'back-to-top') break;
      }
      expect(order).toEqual([
        'skip',
        'header',
        'hero',
        'pillars',
        'fork',
        'services',
        'selected',
        'publications',
        'latest',
        'contact',
        'footer',
        'back-to-top',
      ]);
      await context.close();
    });
  }
});

// FD-101 (less space between sections): --section-pad is clamp(40px, 5vw, 80px), so
// two sections are never more than 160 px apart (112 px on phones). The largest empty band
// between consecutive pieces of content — text, media, controls — in main and the footer, on
// Home and the inner pages. Reduced motion: the layout at rest, no reveal offsets.
test.describe('section spacing (FD-101)', () => {
  test.use({ reducedMotion: 'reduce' });
  const gaps = (page) =>
    page.evaluate(() => {
      // A card's or a box's edge is content too (its border), so its inner padding is no gap.
      const boxed = (el) =>
        parseFloat(getComputedStyle(el).borderTopWidth) > 0 &&
        !el.matches('section, .band, main, .site-footer');
      const leaves = [...document.querySelectorAll('main *, .site-footer *')].filter((el) => {
        if (el.closest('svg') && el.tagName !== 'svg') return false;
        const leaf =
          el.children.length === 0 ||
          boxed(el) ||
          /^(IMG|SVG|PICTURE|BUTTON|A|INPUT|TEXTAREA|SELECT)$/i.test(el.tagName);
        if (!leaf || el.closest('[aria-hidden="true"]:not(figure)')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      });
      const boxes = leaves
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            top: r.top + scrollY,
            bottom: r.bottom + scrollY,
            what: el.className || el.tagName,
          };
        })
        .sort((a, b) => a.top - b.top);
      let bottom = boxes[0].bottom;
      let last = boxes[0].what;
      let max = { gap: 0 };
      for (const box of boxes.slice(1)) {
        if (box.top - bottom > max.gap)
          max = { gap: Math.round(box.top - bottom), from: last, to: box.what };
        if (box.bottom > bottom) {
          bottom = box.bottom;
          last = box.what;
        }
      }
      return max;
    });

  for (const [width, limit] of [
    [1440, 160],
    [390, 112],
  ]) {
    for (const file of ['index.html', 'portfolio.html', 'blog.html', 'hire.html', 'contact.html']) {
      test(`FD-101: no gap above ${limit} px between content on ${file} (${width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${file}`);
        await page.evaluate(() => document.fonts.ready);
        const max = await gaps(page);
        expect(max.gap, `${max.from} → ${max.to}`).toBeLessThanOrEqual(limit);
      });
    }
  }

  test('FD-101: --section-pad is clamp(40px, 5vw, 80px)', async ({ page }) => {
    for (const [width, pad] of [
      [390, 40],
      [1024, 51.2],
      [1440, 72],
      [1920, 80],
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      const value = await page
        .locator('[data-home="selected"]')
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop));
      expect(value, `${width}px`).toBeCloseTo(pad, 1);
    }
  });
});
