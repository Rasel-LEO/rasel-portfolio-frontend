// Author: Rasel Al Mamun
// Portfolio (FD-107 … FD-111): the six profile sections, content from src/content/
// (portfolio.json and the shared records), layouts per the design specification; project pages.
import { expect, test } from './fixtures.js';
import { buildSite } from '../tools/content.mjs';
import { isDjango, pagePath, revealAll, useTheme, venueLine } from './pages.js';

const site = buildSite();
const pf = site.portfolio;
const DESKTOP = { width: 1440, height: 900 };

const box = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      left: Math.round(r.left),
      right: Math.round(r.right),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      width: Math.round(r.width),
    };
  });

const tops = (locator) =>
  locator.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));

test.describe('item 2: Profile', () => {
  test('content equals the data: eyebrow, name, portrait, summary, location, counts', async ({
    page,
  }) => {
    await page.goto('/portfolio.html');
    const profile = page.locator('.pf-profile');
    await expect(profile.locator('.eyebrow').first()).toHaveText('Portfolio');
    await expect(page.locator('h1')).toHaveText(site.profile.name);
    const img = profile.locator('.pf-avatar img');
    await expect(img).toHaveAttribute('src', /\/avatar-512[\w-]*\.webp$/);
    await expect(img).toHaveAttribute('alt', `Portrait of ${site.profile.name}`);
    await expect(profile.locator('.pf-role')).toHaveText(pf.profile.eyebrow);
    await expect(profile.locator('.pf-summary')).toHaveText(pf.profile.summary_line);
    await expect(profile.locator('.pf-location')).toHaveText(pf.profile.location_line);
    await expect(profile.locator('.pf-location svg[aria-hidden="true"]')).toHaveCount(1);
    // Counts from the data (8 · 15 · 6), the number above its label.
    const counts = profile.locator('.pf-count');
    await expect(counts).toHaveCount(3);
    expect(site.counts).toMatchObject({ publications: 8, projects: 15, awards: 6 });
    const expected = [
      ['publications', 'Publications'],
      ['projects', 'Research projects'],
      ['awards', 'Awards'],
    ];
    for (const [i, [key, label]] of expected.entries()) {
      await expect(counts.nth(i).locator('dt')).toHaveText(label);
      await expect(counts.nth(i).locator('dd')).toHaveText(String(site.counts[key]));
      const num = await box(counts.nth(i).locator('dd'));
      const text = await box(counts.nth(i).locator('dt'));
      expect(num.bottom).toBeLessThanOrEqual(text.top + 1);
    }
  });

  test('Request CV (primary, mail icon first) and Hire me (secondary, →)', async ({ page }) => {
    await page.goto('/portfolio.html');
    const cv = page.locator('.pf-actions a').first();
    await expect(cv).toHaveText('Request CV');
    await expect(cv).toHaveClass(/btn-primary/);
    await expect(cv).toHaveAttribute('href', `mailto:${site.profile.email}?subject=CV%20request`);
    expect(await cv.evaluate((el) => el.firstElementChild.tagName)).toBe('svg');
    const hire = page.locator('.pf-actions a').nth(1);
    await expect(hire).toHaveText('Hire me');
    await expect(hire).toHaveClass(/btn-secondary/);
    await expect(hire).toHaveAttribute('href', pagePath('hire.html'));
    await expect(hire.locator('.icon-arrow')).toHaveCount(1);
  });

  test('six profile links with icons open in a new tab', async ({ page }) => {
    await page.goto('/portfolio.html');
    const links = page
      .getByRole('list', { name: 'Research and social profiles' })
      .getByRole('link');
    await expect(links).toHaveCount(6);
    for (const [i, link] of site.links.entries()) {
      const a = links.nth(i);
      await expect(a).toHaveAttribute('href', link.url);
      await expect(a).toHaveAttribute('target', '_blank');
      await expect(a).toHaveAttribute('rel', /noopener/);
      await expect(a).toHaveAccessibleName(`${link.label} (opens in a new tab)`);
      // The service's icon and the ↗, both decorative.
      await expect(a.locator('svg[aria-hidden="true"]')).toHaveCount(2);
    }
    // ORCID, LinkedIn and GitHub are their official (filled) marks.
    for (const i of [0, 4, 5]) {
      const fill = await links
        .nth(i)
        .locator('svg')
        .first()
        .evaluate((el) => getComputedStyle(el).fill);
      expect(fill, site.links[i].id).not.toBe('none');
    }
  });

  test('section nav: five links to the section ids, in the data order', async ({ page }) => {
    await page.goto('/portfolio.html');
    const nav = page.getByRole('navigation', { name: 'Portfolio sections' });
    const links = nav.getByRole('link');
    await expect(links).toHaveText(pf.profile.section_nav.map((item) => item.label));
    const hrefs = await links.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(hrefs).toEqual(['#publications', '#research', '#awards', '#experience', '#expertise']);
  });

  test('1440: portrait left of the text, one row of links, centred nav', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/portfolio.html');
    const avatar = await box(page.locator('.pf-avatar img'));
    const text = await box(page.locator('.pf-intro-text'));
    expect(avatar.right).toBeLessThan(text.left);
    expect(new Set(await tops(page.locator('.pf-links li'))).size).toBe(1);
    const nav = await box(page.locator('.pf-nav ul'));
    const first = await box(page.locator('.pf-nav li').first());
    const last = await box(page.locator('.pf-nav li').last());
    expect(Math.abs(first.left - nav.left - (nav.right - last.right))).toBeLessThanOrEqual(2);
  });

  for (const width of [320, 390]) {
    test(`${width}: portrait centred, links in two columns (one under 360), nav 3 + 2`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/portfolio.html');
      const avatar = await box(page.locator('.pf-avatar img'));
      expect(Math.abs(avatar.left + avatar.width / 2 - width / 2)).toBeLessThanOrEqual(2);
      const text = await box(page.locator('.pf-intro-text'));
      expect(text.top).toBeGreaterThan(avatar.bottom);
      const [a, b] = await tops(page.locator('.pf-links li'));
      if (width >= 360) expect(b).toBe(a);
      else expect(b).toBeGreaterThan(a);
      const rows = await tops(page.locator('.pf-nav li'));
      expect(new Set(rows.slice(0, 3)).size).toBe(1);
      expect(rows[3]).toBeGreaterThan(rows[0]);
      expect(rows[4]).toBe(rows[3]);
      // A wrapped row never starts with a divider.
      await expect(page.locator('.pf-nav li').nth(3)).toHaveCSS('border-left-width', '0px');
    });
  }
});

test.describe('item 3: Selected publications', () => {
  test('rows equal the data: type, title, short authors, venue · details, DOI, Project', async ({
    page,
  }) => {
    await page.goto('/portfolio.html');
    const section = page.locator('#publications');
    await expect(section.locator('.eyebrow')).toHaveText(pf.publications.eyebrow);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(pf.publications.heading);
    await expect(section.locator('.section-intro')).toHaveText(pf.publications.intro);
    const rows = section.locator('[data-pub-row]');
    await expect(rows).toHaveCount(pf.publications.order.length);
    for (const [i, id] of pf.publications.order.entries()) {
      const pub = site.publications.find((p) => p.id === id);
      const row = rows.nth(i);
      await expect(row).toHaveAttribute('data-type', pub.type);
      await expect(row.locator('.pf-pub-type')).toHaveText(
        pub.type === 'journal' ? 'Journal' : 'Conference',
      );
      await expect(row.getByRole('heading', { level: 3 })).toHaveText(pub.title);
      await expect(row.locator('.pf-pub-authors')).toHaveText('Al Mamun, M. R., et al.');
      await expect(row.locator('.pf-pub-venue')).toHaveText(venueLine(pub, ' · '));
      const doi = row.getByRole('link', { name: /^DOI/ });
      await expect(doi).toHaveAttribute('href', `https://doi.org/${pub.doi}`);
      await expect(doi).toHaveAttribute('target', '_blank');
      await expect(doi).toHaveAccessibleName(`DOI: ${pub.title} (opens in a new tab)`);
      await expect(doi).toHaveClass(/btn-secondary/);
      const project = row.getByRole('link', { name: /^Project/ });
      await expect(project).toHaveAttribute('href', pagePath(`project-${pub.project}.html`));
      await expect(project).toHaveAccessibleName(`Project: ${site.projectById[pub.project].title}`);
      await expect(project).toHaveClass(/btn-accent-outline/);
    }
    const more = section.getByRole('link', { name: 'View all 8 publications' });
    await expect(more).toHaveAttribute('href', pagePath('publications.html'));
    await expect(more).toHaveClass(/btn-accent-outline/);
  });

  test('bg-1 surface after the bg-0 profile', async ({ page }) => {
    await page.goto('/portfolio.html');
    const bg = (sel) => page.locator(sel).evaluate((el) => getComputedStyle(el).backgroundColor);
    const token = (name) =>
      page.evaluate((n) => {
        const probe = document.createElement('div');
        probe.style.background = `var(${n})`;
        document.body.append(probe);
        const value = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return value;
      }, name);
    expect(await bg('#publications')).toBe(await token('--bg-1'));
    expect(await bg('.pf-profile')).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  });

  test('tabs filter the rows, say how many, and move the amber underline', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/portfolio.html');
    const group = page.getByRole('group', { name: 'Filter publications by type' });
    await expect(group).toBeVisible();
    const rows = page.locator('#publications [data-pub-row]');
    const visible = page.locator('#publications [data-pub-row]:visible');
    const live = page.locator('[data-pub-count]');
    await expect(live).toHaveAttribute('aria-live', 'polite');
    const selected = site.portfolioView.publications;
    const cases = [
      ['Journal', 'journal', 'journal article', 'journal articles'],
      ['Conference', 'conference', 'conference paper', 'conference papers'],
    ];
    for (const [name, type, one, many] of cases) {
      const button = group.getByRole('button', { name, exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(group.locator('[aria-pressed="true"]')).toHaveCount(1);
      const n = selected.filter((pub) => pub.type === type).length;
      await expect(visible).toHaveCount(n);
      await expect(live).toHaveText(`${n} ${n === 1 ? one : many}`);
      for (const row of await visible.all()) await expect(row).toHaveAttribute('data-type', type);
      // The underline sits under the pressed tab.
      await expect
        .poll(async () => {
          const ink = await box(group.locator('.pf-tab-ink'));
          const tab = await box(button);
          return Math.abs(ink.left - tab.left) + Math.abs(ink.width - tab.width);
        })
        .toBeLessThanOrEqual(2);
    }
    await group.getByRole('button', { name: 'All', exact: true }).click();
    await expect(visible).toHaveCount(await rows.count());
    await expect(live).toHaveText(`${selected.length} publications`);
  });

  test('1440: type left, citation, DOI and Project right', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/portfolio.html');
    const row = page.locator('#publications [data-pub-row]').first();
    const type = await box(row.locator('.pf-pub-type'));
    const body = await box(row.locator('.pf-pub-body'));
    const doi = await box(row.getByRole('link', { name: /^DOI/ }));
    const project = await box(row.getByRole('link', { name: /^Project/ }));
    expect(type.right).toBeLessThan(body.left);
    expect(body.right).toBeLessThan(doi.left);
    expect(doi.right).toBeLessThan(project.left);
    expect(doi.top).toBe(project.top);
  });

  test('390: type above the title, two full-width buttons under the citation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/portfolio.html');
    const row = page.locator('#publications [data-pub-row]').first();
    const type = await box(row.locator('.pf-pub-type'));
    const body = await box(row.locator('.pf-pub-body'));
    const doi = await box(row.getByRole('link', { name: /^DOI/ }));
    const project = await box(row.getByRole('link', { name: /^Project/ }));
    expect(type.bottom).toBeLessThanOrEqual(body.top);
    expect(doi.top).toBeGreaterThan(body.bottom);
    expect(doi.top).toBe(project.top);
    expect(Math.abs(doi.width - project.width)).toBeLessThanOrEqual(1);
    expect(project.right - doi.left).toBeGreaterThan(330);
    const more = await box(page.getByRole('link', { name: 'View all 8 publications' }));
    expect(more.width).toBeGreaterThan(350);
  });
});

test.describe('item 4: Selected research projects', () => {
  test('three cards in the data order: role line, status, title, summary, pills, link', async ({
    page,
    request,
  }) => {
    await page.goto('/portfolio.html');
    const section = page.locator('#research');
    await expect(section.locator('.eyebrow')).toHaveText(pf.projects.eyebrow);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(pf.projects.heading);
    await expect(section.locator('.section-intro')).toHaveText(pf.projects.intro);
    const cards = section.locator('[data-project-card]');
    await expect(cards).toHaveCount(3);
    for (const [i, id] of pf.projects.order.entries()) {
      const project = site.projectById[id];
      const card = cards.nth(i);
      await expect(card.locator('.pf-card-role')).toHaveText(pf.projects.role_lines[id]);
      await expect(card.getByRole('heading', { level: 3 })).toHaveText(project.short_title);
      await expect(card.locator('.pf-card-summary')).toHaveText(project.short_summary);
      await expect(card.locator('.pill')).toHaveText(project.featured_tags);
      await expect(card.locator('.pf-card-status')).toHaveCount(project.status ? 1 : 0);
      const link = card.getByRole('link');
      await expect(link).toHaveAccessibleName(`View project: ${project.short_title}`);
      await expect(link).toHaveAttribute('href', pagePath(project.file));
      expect((await request.get(pagePath(project.file))).status()).toBe(200);
    }
    // The poultry project is in progress (FD-110: shown with the --info dot).
    await expect(cards.first().locator('.pf-card-status')).toContainText('In progress');
    const more = section.getByRole('link', { name: 'View all 15 research projects' });
    await expect(more).toHaveAttribute('href', pagePath('research.html'));
    await expect(more).toHaveClass(/btn-accent-outline/);
  });

  test('bg-0 surface; the link is amber', async ({ page }) => {
    await page.goto('/portfolio.html');
    await expect(page.locator('#research')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    );
    const color = await page
      .locator('#research .pf-card-link')
      .first()
      .evaluate((el) => getComputedStyle(el).color);
    const probe = await page.evaluate((value) => {
      const el = document.createElement('i');
      el.style.color = value;
      document.body.append(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    }, accent);
    expect(color).toBe(probe);
  });

  test('1440: three equal cards side by side; 390: one column', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/portfolio.html');
    const cards = page.locator('#research .pf-card');
    const boxes = await Promise.all([0, 1, 2].map((i) => box(cards.nth(i))));
    expect(new Set(boxes.map((b) => b.top)).size).toBe(1);
    expect(new Set(boxes.map((b) => b.width)).size).toBe(1);
    const heights = await cards.evaluateAll((els) => els.map((el) => el.offsetHeight));
    expect(new Set(heights).size).toBe(1);
    // Rows line up across the cards (projects-desktop): a card without a status keeps the row.
    for (const part of ['.pf-card-title', '.pill-row', '.pf-card-link']) {
      expect(new Set(await tops(cards.locator(part))).size, part).toBe(1);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    const narrow = await Promise.all([0, 1, 2].map((i) => box(cards.nth(i))));
    expect(narrow[1].top).toBeGreaterThan(narrow[0].bottom);
    expect(narrow[2].top).toBeGreaterThan(narrow[1].bottom);
    const more = await box(page.getByRole('link', { name: 'View all 15 research projects' }));
    expect(more.width).toBeGreaterThan(350);
  });
});

test.describe('item 5: Awards & honours', () => {
  test('three rows from the data: icon, title, kind, year · organiser, highlight', async ({
    page,
  }) => {
    await page.goto('/portfolio.html');
    const section = page.locator('#awards');
    await expect(section.locator('.eyebrow')).toHaveText(pf.awards.eyebrow);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(pf.awards.heading);
    await expect(section.locator('.section-intro')).toHaveText(pf.awards.intro);
    const rows = section.locator('.pf-award');
    await expect(rows).toHaveCount(3);
    for (const [i, item] of pf.awards.items.entries()) {
      const row = rows.nth(i);
      await expect(row.getByRole('heading', { level: 3 })).toHaveText(item.title);
      await expect(row.locator('.pf-award-kind')).toHaveText(item.kind);
      await expect(row.locator('.pf-award-meta')).toHaveText(`${item.year} · ${item.by}`);
      await expect(row.locator('.pf-award-icon svg[aria-hidden="true"]')).toHaveCount(1);
      if (item.highlight)
        await expect(row.locator('.pf-award-highlight')).toHaveText(item.highlight);
      else await expect(row.locator('.pf-award-highlight')).toHaveCount(0);
    }
    await expect(rows.first().getByRole('heading')).toHaveText(
      'Agricultural Machinery Talent Hunt Award',
    );
    await expect(section.locator('.pf-note')).toHaveText(pf.awards.note);
    const cv = section.getByRole('link', { name: 'Request CV' });
    await expect(cv).toHaveClass(/btn-primary/);
    await expect(cv).toHaveAttribute('href', /^mailto:/);
    expect(await cv.evaluate((el) => el.firstElementChild.tagName)).toBe('svg');
    await expect(cv.locator('.icon-arrow')).toHaveCount(1);
  });

  test('1440: highlight right; 390: highlight under the text', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/portfolio.html');
    const row = page.locator('#awards .pf-award').first();
    let body = await box(row.locator('.pf-award-body'));
    let mark = await box(row.locator('.pf-award-highlight'));
    expect(mark.left).toBeGreaterThan(body.right);
    expect(mark.right).toBeGreaterThan((await box(row)).right - 2);

    await page.setViewportSize({ width: 390, height: 844 });
    body = await box(row.locator('.pf-award-body'));
    mark = await box(row.locator('.pf-award-highlight'));
    expect(mark.top).toBeGreaterThanOrEqual(body.bottom);
    expect(mark.left).toBe(body.left);
  });

  test('bg-1 surface', async ({ page }) => {
    await page.goto('/portfolio.html');
    const [awards, pubs] = await Promise.all(
      ['#awards', '#publications'].map((s) =>
        page.locator(s).evaluate((el) => getComputedStyle(el).backgroundColor),
      ),
    );
    expect(awards).toBe(pubs);
    expect(awards).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('item 6: Experience & education', () => {
  test('role and degrees from the data, column heads with icons, CV note and link', async ({
    page,
  }) => {
    await page.goto('/portfolio.html');
    const section = page.locator('#experience');
    const xp = pf.experience;
    await expect(section.locator('.eyebrow')).toHaveText(xp.eyebrow);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(xp.heading);
    await expect(section.locator('.section-intro')).toHaveText(xp.intro);
    await expect(section.getByRole('heading', { level: 3 })).toHaveText([
      'Research experience',
      'Education',
    ]);
    await expect(section.locator('.pf-column-head svg[aria-hidden="true"]')).toHaveCount(2);
    const columns = section.locator('.pf-column');
    const role = columns.nth(0).locator('.pf-entry');
    await expect(role).toHaveCount(xp.roles.length);
    const [r] = xp.roles;
    await expect(role.getByRole('heading', { level: 4 })).toHaveText(r.title);
    await expect(role.locator('.pf-entry-date')).toHaveText(r.period);
    await expect(role.locator('.pf-entry-sub span')).toHaveText([r.unit, r.institution]);
    await expect(role.locator('.pf-entry-text')).toHaveText(r.text);
    await expect(role.locator('.pf-bullets li')).toHaveText(r.bullets);
    const degrees = columns.nth(1).locator('.pf-entry');
    await expect(degrees).toHaveCount(xp.education.length);
    for (const [i, d] of xp.education.entries()) {
      await expect(degrees.nth(i).getByRole('heading', { level: 4 })).toHaveText(d.degree);
      await expect(degrees.nth(i).locator('.pf-entry-date')).toHaveText(d.year);
      await expect(degrees.nth(i).locator('.pf-entry-sub')).toHaveText(d.institution);
    }
    await expect(section.locator('.pf-note')).toContainText(xp.note);
    const cv = section.getByRole('link', { name: 'Request CV' });
    await expect(cv).toHaveAttribute('href', `mailto:${site.profile.email}?subject=CV%20request`);
    await expect(cv.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  });

  test('1440: two columns with a divider; 390: stacked', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/portfolio.html');
    const columns = page.locator('#experience .pf-column');
    let a = await box(columns.nth(0));
    let b = await box(columns.nth(1));
    expect(b.top).toBe(a.top);
    expect(b.left).toBeGreaterThan(a.right - 1);
    await expect(columns.nth(1)).toHaveCSS('border-left-width', '1px');

    await page.setViewportSize({ width: 390, height: 844 });
    a = await box(columns.nth(0));
    b = await box(columns.nth(1));
    expect(b.top).toBeGreaterThan(a.bottom);
    expect(b.left).toBe(a.left);
    await expect(columns.nth(1)).toHaveCSS('border-left-width', '0px');
  });
});

test.describe('item 7: Technical expertise', () => {
  test('four groups and the training from the data, with icons and the note', async ({ page }) => {
    await page.goto('/portfolio.html');
    const section = page.locator('#expertise');
    const ex = pf.expertise;
    await expect(section.locator('.eyebrow')).toHaveText(ex.eyebrow);
    await expect(section.getByRole('heading', { level: 2 })).toHaveText(ex.heading);
    await expect(section.locator('.section-intro')).toHaveText(ex.intro);
    const groups = section.locator('.pf-group');
    await expect(groups).toHaveCount(4);
    for (const [i, group] of ex.groups.entries()) {
      await expect(groups.nth(i).getByRole('heading', { level: 3 })).toHaveText(group.title);
      await expect(groups.nth(i).locator('.pf-group-items li')).toHaveText(group.items);
      await expect(groups.nth(i).locator('.pf-group-icon svg[aria-hidden="true"]')).toHaveCount(1);
    }
    await expect(section.locator('.pf-training-title')).toHaveText(ex.training_heading);
    const certs = section.locator('.pf-cert');
    await expect(certs).toHaveCount(ex.training.length);
    for (const [i, item] of ex.training.entries()) {
      await expect(certs.nth(i).locator('.pf-cert-title')).toHaveText(item.title);
      await expect(certs.nth(i).locator('.pf-cert-by')).toHaveText(item.by);
      await expect(certs.nth(i).locator('svg[aria-hidden="true"]')).toHaveCount(1);
    }
    await expect(section.locator('.pf-training-note')).toHaveText(ex.note);
    // FD-108: Tableau and Fusion 360 in, MATLAB and LaTeX out.
    await expect(section).toContainText('Tableau');
    await expect(section).toContainText('Fusion 360');
    await expect(section).not.toContainText(/MATLAB|LaTeX/);
  });

  const layout = (page) =>
    page.locator('#expertise .pf-group').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const icon = el.querySelector('.pf-group-icon').getBoundingClientRect();
        const title = el.querySelector('h3').getBoundingClientRect();
        const items = [...el.querySelectorAll('.pf-group-items li')].map((li) =>
          Math.round(li.getBoundingClientRect().top),
        );
        return {
          top: Math.round(r.top),
          left: Math.round(r.left),
          iconLeftOfTitle: icon.right <= title.left,
          itemRows: new Set(items).size,
        };
      }),
    );

  test('≥ 992: four columns side by side, items listed down', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/portfolio.html');
    const groups = await layout(page);
    expect(new Set(groups.map((g) => g.top)).size).toBe(1);
    expect(groups.every((g) => !g.iconLeftOfTitle && g.itemRows === 3)).toBe(true);
    for (const i of [1, 2, 3]) {
      await expect(page.locator('#expertise .pf-group').nth(i)).toHaveCSS(
        'border-left-width',
        '1px',
      );
    }
    // Training side by side.
    const [a, b] = await tops(page.locator('#expertise .pf-cert'));
    expect(b).toBe(a);
  });

  test('768–991 (expertise-tablet-2x2): two by two with dividers', async ({ page }) => {
    for (const width of [768, 991]) {
      await page.setViewportSize({ width, height: 1024 });
      await page.goto('/portfolio.html');
      const g = await layout(page);
      expect(g[1].top).toBe(g[0].top);
      expect(g[3].top).toBe(g[2].top);
      expect(g[2].top).toBeGreaterThan(g[0].top);
      expect(g[2].left).toBe(g[0].left);
      const groups = page.locator('#expertise .pf-group');
      await expect(groups.nth(1)).toHaveCSS('border-left-width', '1px');
      await expect(groups.nth(2)).toHaveCSS('border-top-width', '1px');
    }
  });

  test('< 768 (expertise-mobile): one column, icon left, items on one line with ·', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/portfolio.html');
    const g = await layout(page);
    expect(new Set(g.map((x) => x.left)).size).toBe(1);
    expect(g.every((x, i) => i === 0 || x.top > g[i - 1].top)).toBe(true);
    expect(g.every((x) => x.iconLeftOfTitle)).toBe(true);
    // "Engineering tools" fits one line at 390.
    expect(g[3].itemRows).toBe(1);
    const sep = await page
      .locator('#expertise .pf-group-items li')
      .first()
      .evaluate((el) => getComputedStyle(el, '::after').content);
    expect(sep).toContain('·');
    // Training stacked.
    const [a, b] = await tops(page.locator('#expertise .pf-cert'));
    expect(b).toBeGreaterThan(a);
  });

  test('backgrounds alternate bg-0 / bg-1 through the six sections', async ({ page }) => {
    await page.goto('/portfolio.html');
    const colours = await page
      .locator('main > section')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    expect(colours).toHaveLength(6);
    const [bg0, bg1] = colours;
    expect(colours).toEqual([bg0, bg1, bg0, bg1, bg0, bg1]);
    expect(bg0).not.toBe(bg1);
  });
});

test.describe('item 8: View-all pages', () => {
  test('publications.html: all papers by year, same rows, tabs, breadcrumb, nav, meta', async ({
    page,
  }) => {
    await page.goto('/publications.html');
    await expect(page).toHaveTitle('Publications — Rasel Al Mamun');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      site.portfolioView.publicationsDescription,
    );
    await expect(page.locator('h1')).toHaveText('Publications');
    const crumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(crumb.getByRole('link', { name: 'Portfolio' })).toHaveAttribute(
      'href',
      pagePath('portfolio.html'),
    );
    await expect(crumb).toContainText(/Portfolio\s*\/?\s*Publications/);
    await expect(
      page.locator(`.site-header nav a[href="${pagePath('portfolio.html')}"]`),
    ).toHaveAttribute('aria-current', 'true');
    // Year groups newest first; every publication once, in the data's order within a year.
    const years = (await page.locator('.pf-year-title').allTextContents()).map(Number);
    expect(years).toEqual(site.publicationYears.map((g) => g.year));
    const ids = site.publicationYears.flatMap((g) => g.items.map((p) => p.title));
    await expect(page.locator('[data-pub-row] h3')).toHaveText(ids);
    for (const pub of site.publications) {
      const row = page.locator('[data-pub-row]', { hasText: pub.title });
      await expect(row.getByRole('link', { name: /^DOI/ })).toHaveAttribute(
        'href',
        `https://doi.org/${pub.doi}`,
      );
      await expect(row.getByRole('link', { name: /^Project/ })).toHaveCount(pub.project ? 1 : 0);
      // FD-109: every author on every row, the site author in bold.
      await expect(row.locator('.pf-pub-authors')).toHaveText(
        pub.authors.map((a) => a.name).join(', '),
      );
      const bold = await row.locator('.pf-pub-authors strong').allTextContents();
      expect(bold).toHaveLength(1);
      expect(site.profile.citation_names).toContain(bold[0]);
      await expect(row.locator('.pf-pub-venue')).toHaveText(venueLine(pub, ' · '));
    }
    // Conference: only the 2026 group remains.
    const group = page.getByRole('group', { name: 'Filter publications by type' });
    await group.getByRole('button', { name: 'Conference' }).click();
    await expect(page.locator('[data-pub-row]:visible')).toHaveCount(site.counts.conference);
    await expect(page.locator('[data-pub-year]:visible')).toHaveCount(1);
    await expect(page.locator('[data-pub-count]')).toHaveText(
      `${site.counts.conference} conference papers`,
    );
    await group.getByRole('button', { name: 'All' }).click();
    await expect(page.locator('[data-pub-row]:visible')).toHaveCount(site.counts.publications);
  });

  test('research.html: all 15 cards, two pills, status where set, 3 / 2 / 1 columns', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/research.html');
    await expect(page).toHaveTitle('Research projects — Rasel Al Mamun');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      site.portfolioView.researchDescription,
    );
    await expect(page.locator('h1')).toHaveText('Research projects');
    // FD-115: a back link instead of the breadcrumb.
    await expect(page.getByRole('link', { name: 'Back to Portfolio' })).toHaveAttribute(
      'href',
      pagePath('portfolio.html'),
    );
    await expect(
      page.locator(`.site-header nav a[href="${pagePath('portfolio.html')}"]`),
    ).toHaveAttribute('aria-current', 'true');
    const cards = page.locator('[data-project-card]');
    await expect(cards).toHaveCount(15);
    for (const [i, project] of site.projectList.entries()) {
      const card = cards.nth(i);
      // FD-115: short title, two pills, the status where set.
      await expect(card.getByRole('heading', { level: 2 })).toHaveText(project.short_title);
      await expect(card.locator('.pill')).toHaveText(
        (project.featured_tags ?? project.tags).slice(0, 2),
      );
      await expect(card.locator('.archive-status')).toHaveCount(project.status ? 1 : 0);
      await expect(card.getByRole('link')).toHaveAttribute('href', pagePath(project.file));
    }
    for (const [width, columns] of [
      [1440, 3],
      [768, 2],
      [390, 1],
    ]) {
      await page.setViewportSize({ width, height: 900 });
      const rows = await tops(page.locator('[data-project-card]').locator('.pf-card'));
      expect(rows.filter((top) => top === rows[0]).length, `${width}px`).toBe(columns);
    }
  });

  test('flat dist output and links from Portfolio', async ({ page, request }) => {
    for (const file of ['publications.html', 'research.html']) {
      expect((await request.get(pagePath(file))).status()).toBe(200);
    }
    await page.goto('/portfolio.html');
    await page.getByRole('link', { name: 'View all 8 publications' }).click();
    await page.waitForURL(`**${pagePath('publications.html')}`);
    await page.goto('/portfolio.html');
    await page.getByRole('link', { name: 'View all 15 research projects' }).click();
    await page.waitForURL(`**${pagePath('research.html')}`);
  });
});

test.describe('item 9: pills site-wide (FD-110)', () => {
  const style = (page, selector) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => {
        const c = getComputedStyle(el);
        const probe = document.createElement('i');
        probe.style.background = 'var(--bg-2)';
        document.body.append(probe);
        const bg2 = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return {
          bg: c.backgroundColor,
          bg2,
          border: c.borderTopWidth,
          radius: c.borderTopLeftRadius,
          size: c.fontSize,
          family: c.fontFamily,
          transform: c.textTransform,
        };
      });

  for (const [file, selector] of [
    ['portfolio.html', '#research .pill'],
    ['research.html', '.pill'],
    ['project-biofloc-iot.html', 'main .pill'],
    ['index.html', '[data-featured-project] .pill'],
  ]) {
    test(`${file}: tags are the one pill component`, async ({ page }) => {
      await page.goto(`/${file}`);
      const s = await style(page, selector);
      expect(s.bg).toBe(s.bg2);
      expect(s.border).toBe('0px');
      expect(s.radius).toBe('8px');
      expect(s.size).toBe('14px');
      expect(s.family).toMatch(/Bricolage/);
      expect(s.transform).toBe('none');
      // No tag is an old chip any more.
      await expect(page.locator('main .chip-row li.chip')).toHaveCount(
        file === 'index.html' ? await page.locator('[data-fork-col] li.chip').count() : 0,
      );
    });
  }

  test('status: "In progress" is an --info dot with text, "Done" a --success tick', async ({
    page,
  }) => {
    await page.goto('/research.html');
    const colour = (name) =>
      page.evaluate((n) => {
        const probe = document.createElement('i');
        probe.style.color = `var(${n})`;
        document.body.append(probe);
        const c = getComputedStyle(probe).color;
        probe.remove();
        return c;
      }, name);
    const progress = page.locator('.status-progress').first();
    await expect(progress).toHaveText('In progress');
    expect(
      await progress.locator('.dot').evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe(await colour('--info'));
    await expect(progress).toHaveCSS('border-top-width', '0px');
    const done = page.locator('.status-done').first();
    await expect(done).toHaveText('Done');
    expect(await done.locator('svg').evaluate((el) => getComputedStyle(el).stroke)).toBe(
      await colour('--success'),
    );
  });
});

test.describe('item 10: motion (FD-111)', () => {
  test('profile entrance: six parts in reading order, done by 0.6 s after the wipe lead', async ({
    page,
  }) => {
    await page.goto('/portfolio.html');
    const parts = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.effect?.target?.matches?.('[data-pf-enter]'))
        .map((a) => {
          const t = a.effect.getComputedTiming();
          return {
            name: a.animationName,
            target: a.effect.target.className || a.effect.target.tagName,
            delay: a.effect.getTiming().delay,
            end: t.endTime,
          };
        }),
    );
    expect(parts).toHaveLength(6);
    expect(parts.find((p) => /pf-avatar/.test(p.target)).name).toBe('enter-portrait');
    expect(parts.filter((p) => p.name === 'enter-rise')).toHaveLength(5);
    const delays = parts.map((p) => p.delay);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    const lead = delays[0];
    expect(Math.max(...parts.map((p) => p.end)) - lead).toBeLessThanOrEqual(600);
    // The main fade of the other pages is not used here.
    expect(
      await page.evaluate(() =>
        document.getAnimations().some((a) => a.animationName === 'enter-fade'),
      ),
    ).toBe(false);
  });

  test('tabs: the underline slides over 200 ms and the rows re-enter 30 ms apart', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/portfolio.html');
    const group = page.getByRole('group', { name: 'Filter publications by type' });
    await expect(group).toHaveClass(/is-ready/);
    await page.locator('#publications').scrollIntoViewIfNeeded();
    await group.getByRole('button', { name: 'Journal' }).click();
    const { ink, rows } = await page.evaluate(() => ({
      ink: document
        .querySelector('.pf-tab-ink')
        .getAnimations()
        .map((a) => [a.transitionProperty, a.effect.getTiming().duration]),
      rows: [...document.querySelectorAll('#publications [data-pub-row]:not([hidden])')].map(
        (row) =>
          row
            .getAnimations()
            .filter((a) => !a.transitionProperty)
            .map((a) => [a.effect.getTiming().delay, a.effect.getTiming().duration]),
      ),
    }));
    expect(ink).toContainEqual(['transform', 200]);
    expect(rows.map((r) => r[0])).toEqual([
      [0, 200],
      [30, 200],
    ]);
  });

  test('section nav marks the section in view', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/portfolio.html');
    const nav = page.locator('[data-section-nav]');
    await expect(nav.locator('[aria-current]')).toHaveCount(0);
    for (const [id, label] of [
      ['publications', 'Publications'],
      ['awards', 'Awards'],
      ['expertise', 'Expertise'],
    ]) {
      await page.locator(`#${id}`).evaluate((el) => {
        const r = el.getBoundingClientRect();
        window.scrollTo({ top: scrollY + r.top + 40 - innerHeight / 2, behavior: 'instant' });
      });
      await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'true');
      await expect(nav.locator('[aria-current]')).toHaveCount(1);
    }
  });
});

test.describe('item 10: reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('static and complete: no entrance, no slide, no re-entry, every row shown', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/portfolio.html');
    const running = () =>
      page.evaluate(() =>
        document
          .getAnimations()
          .map((a) => a.animationName ?? a.transitionProperty ?? 'script')
          // Colour changes (hover, pressed tab) are not motion.
          .filter((n) => n && !/color$/.test(n)),
      );
    expect(await running()).toEqual([]);
    await expect(page.locator('main [data-reveal].is-pre')).toHaveCount(0);
    const group = page.getByRole('group', { name: 'Filter publications by type' });
    await group.getByRole('button', { name: 'Conference' }).click();
    expect(await running()).toEqual([]);
    await expect(page.locator('#publications [data-pub-row]:visible')).toHaveCount(1);
    for (const id of ['publications', 'research', 'awards', 'experience', 'expertise']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
  });
});

test.describe('item 11: back-to-top and shell', () => {
  for (const file of ['portfolio.html', 'publications.html', 'research.html']) {
    for (const size of [DESKTOP, { width: 390, height: 844 }]) {
      test(`${file} (${size.width}px): hidden on the first screen, then shown and clickable`, async ({
        page,
      }) => {
        await page.setViewportSize(size);
        await page.goto(`/${file}`);
        const button = page.getByRole('button', { name: 'Back to top' });
        await expect(button).toBeHidden();
        await page.evaluate(() =>
          window.scrollTo({ top: window.innerHeight * 1.5, behavior: 'instant' }),
        );
        await expect(button).toBeVisible();
        // Nothing covers it: the hit point at its centre is the button.
        await expect
          .poll(() =>
            button.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return el.contains(
                document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2),
              );
            }),
          )
          .toBe(true);
        await button.click();
        await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBe(0);
      });
    }
  }

  test('drawer: the Portfolio sub-line names the sections', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/research.html');
    await page.locator('[data-menu-button]').click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    const link = drawer.getByRole('link', { name: /^Portfolio/ });
    await expect(link.locator('.drawer-sub')).toHaveText('Publications · Projects · Awards');
    // A "View all" page marks Portfolio as its section.
    await expect(link).toHaveAttribute('aria-current', 'true');
  });
});

test.describe('short conference venue (FD-109)', () => {
  const asabe = site.publications.filter((pub) => pub.display_details === '');

  test('the two ASABE papers show only the meeting name, on every page', async ({ page }) => {
    expect(asabe.map((pub) => pub.id)).toEqual(['aim-2026-poultry-aiot', 'aim-2026-solar-pump-ai']);
    const meeting = '2026 ASABE Annual International Meeting';
    const poultry = asabe[0];
    for (const [file, selector] of [
      ['index.html', '.home-pub-venue'],
      ['portfolio.html', '.pf-pub-venue'],
      ['publications.html', '.pf-pub-venue'],
      [`project-${poultry.project}.html`, '.related-pub-citation em'],
    ]) {
      await page.goto(`/${file}`);
      const venues = page.locator(selector).filter({ hasText: 'ASABE' });
      expect(await venues.count(), file).toBeGreaterThan(0);
      for (const text of await venues.allTextContents()) expect(text.trim(), file).toBe(meeting);
      await expect(page.locator('main'), file).not.toContainText('p. 1. American Society');
    }
    // Journal rows keep their details.
    await page.goto('/publications.html');
    const sat = site.publications.find((pub) => pub.id === 'sat-2025-solar-irrigation');
    await expect(page.locator('.pf-pub-venue', { hasText: sat.details })).toHaveText(
      `${sat.venue} · ${sat.details}`,
    );
  });
});

test.describe('item 3: without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every row is shown, the tabs are hidden, the section nav jumps', async ({ page }) => {
    await page.goto('/portfolio.html');
    await expect(page.locator('[data-pub-tabs]')).toBeHidden();
    await expect(page.locator('#publications [data-pub-row]:visible')).toHaveCount(
      pf.publications.order.length,
    );
    const nav = page.getByRole('navigation', { name: 'Portfolio sections' });
    await nav.getByRole('link', { name: 'Publications' }).click();
    await expect(page).toHaveURL(/#publications$/);
    await expect(page.locator('#publications h2')).toBeInViewport();
  });
});

// Screenshots for the PR (tests/screenshots/portfolio/, not committed): each section at 1440 and
// 390 (dark), the whole page at 1440 (light), the "View all" pages at 1440 and 390.
test.describe('Portfolio screenshots', () => {
  const shots = 'tests/screenshots/portfolio';
  // The sticky header would cover a section's head in its element screenshot.
  const ready = async (page) => {
    await page.evaluate(() => document.fonts.ready);
    await revealAll(page);
    await page.addStyleTag({ content: '.site-header { position: static; }' });
  };
  const sections = ['profile', 'publications', 'research', 'awards', 'experience', 'expertise'];

  for (const width of [1440, 390]) {
    test(`sections at ${width} (dark)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/portfolio.html');
      await ready(page);
      for (const name of sections) {
        await page
          .locator(`[data-pf-section="${name}"]`)
          .screenshot({ path: `${shots}/portfolio-${name}-${width}-dark.png` });
      }
    });

    test(`View-all pages at ${width} (dark)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const file of ['publications', 'research']) {
        await page.goto(`/${file}.html`);
        await ready(page);
        await page.screenshot({ path: `${shots}/${file}-${width}-dark.png`, fullPage: true });
      }
    });
  }

  test('whole page at 1440 (light)', async ({ page }) => {
    await useTheme(page, 'light');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/portfolio.html');
    await ready(page);
    await page.screenshot({ path: `${shots}/portfolio-1440-light.png`, fullPage: true });
  });
});

test.describe('project pages', () => {
  test('the template shows the featured poultry project', async ({ page }) => {
    test.skip(isDjango, 'Django: there is no portfolio-entry.html template page (FD-137)');
    await page.goto('/portfolio-entry.html');
    await expect(page.locator('h1')).toHaveText(site.projectById['poultry-aiot-edge'].title);
  });

  test('every project page has its own title, content and prev/next links', async ({ page }) => {
    const titles = new Set();
    for (const [i, project] of site.projectList.entries()) {
      await page.goto(`/${project.file}`);
      await expect(page.locator('h1')).toHaveText(project.title);
      await expect(page).toHaveTitle(`${project.short_title} — Rasel Al Mamun`);
      titles.add(await page.title());
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        project.contribution,
      );
      await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText(
        /Portfolio\s*Research project/,
      );
      // FD-116: the contribution as the detail's list where verified, else the paragraph.
      if (!project.detail) {
        await expect(page.locator('.detail-text')).toHaveText(project.contribution);
      }
      // No photo placeholder: blocks render only with data (FD-116); no gallery without images.
      await expect(page.locator('main .media-ph')).toHaveCount(0);
      await expect(page.locator('main .project-image')).toHaveCount(
        (project.image ? 1 : 0) + (project.gallery?.length ?? 0),
      );
      await expect(page.getByRole('heading', { name: 'Gallery' })).toHaveCount(
        project.gallery ? 1 : 0,
      );
      await expect(page.locator('main .related-pub')).toHaveCount(project.publications.length);
      await expect(page.locator('.status-progress, .status-done')).toHaveCount(
        project.status ? 1 : 0,
      );

      const prev = page.locator('a[rel="prev"]');
      const next = page.locator('a[rel="next"]');
      if (i === 0) await expect(prev).toHaveCount(0);
      else await expect(prev).toHaveAttribute('href', pagePath(site.projectList[i - 1].file));
      if (i === site.projectList.length - 1) await expect(next).toHaveCount(0);
      else await expect(next).toHaveAttribute('href', pagePath(site.projectList[i + 1].file));
      await expect(page.getByRole('link', { name: 'Hire me' }).last()).toHaveAttribute(
        'href',
        pagePath('hire.html'),
      );
    }
    expect(titles.size).toBe(site.projectList.length);
  });
});
