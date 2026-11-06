// Author: Rasel Al Mamun
// The inner pages (FD-112 … FD-119) — content, illustrations, Blog, post, research
// archive, project pages, Hire me, Contact, 404 and the site-wide link styles.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from './fixtures.js';
import { buildSite, loadContent } from '../tools/content.mjs';
import { validateContent } from '../tools/validate-content.mjs';
import { isDjango, pagePath } from './pages.js';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const inner = read('docs/content/inner-pages-content.json');
const site = buildSite();

test.describe('item 1: content', () => {
  test('src/content and public-content.json equal the approved content file', () => {
    const content = loadContent();
    const pub = read('docs/content/public-content.json');
    for (const blogPage of [content.blogPage, pub.blog_page]) {
      for (const key of ['eyebrow', 'heading', 'intro', 'count_label']) {
        expect(blogPage[key], key).toEqual(inner.blog_page[key]);
      }
    }
    expect(pub.blog_page).toEqual(content.blogPage);
    expect(content.postSidebar).toEqual(inner.post_sidebar);
    expect(pub.post_sidebar).toEqual(inner.post_sidebar);
    expect(content.researchArchive).toEqual(inner.research_archive);
    expect(pub.research_archive).toEqual(inner.research_archive);
    expect(pub.projects).toEqual(content.projects);
    for (const project of content.projects) {
      // Every field of the approved file is in the project, unchanged; nothing else was added.
      for (const [key, value] of Object.entries(inner.projects[project.id])) {
        expect(project[key], `${project.id}.${key}`).toEqual(value);
      }
    }
    expect(Object.keys(inner.projects).sort()).toEqual(content.projects.map((p) => p.id).sort());
  });

  test('every project has a topic and short forms; details only where verified', () => {
    const topics = new Set(site.researchArchive.topics.map((topic) => topic.id));
    for (const project of site.projectList) {
      expect(topics.has(project.topic), project.id).toBe(true);
      expect(project.short_title, project.id).toBeTruthy();
      expect(project.card_description, project.id).toBeTruthy();
    }
    expect(site.projectList.filter((p) => p.detail).map((p) => p.id)).toEqual([
      'biofloc-iot',
      'solar-irrigation',
    ]);
    expect(validateContent(loadContent())).toEqual([]);
  });

  test('validate-content checks topics, short titles and details', () => {
    const content = structuredClone(loadContent());
    const [first, second, third] = content.projects;
    first.topic = 'space';
    delete second.short_title;
    const biofloc = content.projects.find((p) => p.id === 'biofloc-iot');
    biofloc.detail.system = biofloc.detail.system.slice(0, 2);
    third.detail = { invented_fact: 'x' };
    const problems = validateContent(content).join('\n');
    expect(problems).toContain(`projects[1]: missing "short_title"`);
    expect(problems).toContain(`projects[2]: invalid "detail"`);
    expect(problems).toContain(`invalid "detail"`);

    const topic = structuredClone(loadContent());
    topic.projects[0].topic = 'space';
    const cross = validateContent(topic).join('\n');
    expect(cross).toContain(`projects "${topic.projects[0].id}": unknown topic "space"`);

    const cover = structuredClone(loadContent());
    cover.researchArchive.topics[0].icon = 'rocket';
    const shape = validateContent(cover).join('\n');
    expect(shape).toContain('researchArchive: invalid "topics"');

    const icon = structuredClone(loadContent());
    icon.projects.find((p) => p.id === 'solar-irrigation').detail.results[0].icon = 'rocket';
    expect(validateContent(icon).join('\n')).toContain('invalid "detail"');
  });
});

test.describe('item 2: illustrations and icons', () => {
  const partial = (name) => readFileSync(`src/partials/icons/${name}.hbs`, 'utf8');
  const branches = (source) => [...source.matchAll(/\(eq name "([\w-]+)"\)/g)].map((m) => m[1]);

  test('every cover, system and topic drawing named in the data exists', async () => {
    const { COVER_ILLUSTRATIONS, SYSTEM_ICONS, TOPIC_ICONS } =
      await import('../tools/validate-content.mjs');
    expect(branches(partial('illustration')).sort()).toEqual([...COVER_ILLUSTRATIONS].sort());
    // FD-159: "general" is the fallback branch ({{else}}), not a named one.
    expect(branches(partial('line-icon')).sort()).toEqual(
      [...SYSTEM_ICONS, ...TOPIC_ICONS].filter((key) => key !== 'general').sort(),
    );
    const used = [
      ...site.researchArchive.topics.map((topic) => topic.icon),
      ...site.projectList.flatMap((p) =>
        [...(p.detail?.system ?? []), ...(p.detail?.results ?? [])].map((step) => step.icon),
      ),
    ];
    for (const name of used) {
      expect([...COVER_ILLUSTRATIONS, ...SYSTEM_ICONS, ...TOPIC_ICONS]).toContain(name);
    }
  });

  test('line art takes its colours from the theme, never fixed values', () => {
    for (const name of ['illustration', 'line-icon']) {
      const source = partial(name);
      expect(source, name).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|\bstyle=|\bfill="(?!none)/i);
      expect(source, name).toContain('class="line-art');
    }
    // Covers are named by the content's alt text, otherwise hidden; icons always hidden.
    expect(partial('illustration')).toMatch(/role="img" aria-label="\{\{alt\}\}"/);
    expect(partial('line-icon')).toContain('aria-hidden="true"');
  });
});

// The cards' rows: how many distinct top edges (one per row).
const rowsOf = (locator) =>
  locator.evaluateAll(
    (els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().top))).size,
  );

// A production build into a temporary folder with extra environment (release builds).
function buildInto(env) {
  const outDir = mkdtempSync(join(tmpdir(), 'inner-pages-'));
  const result = spawnSync(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', outDir, '--logLevel', 'error'],
    { env: { ...process.env, ...env }, encoding: 'utf8' },
  );
  expect(result.status, result.stderr).toBe(0);
  return outDir;
}

test.describe('item 3: Blog (FD-112, FD-113)', () => {
  test('draft preview: eyebrow, heading, intro, count, tabs with the sliding underline', async ({
    page,
  }) => {
    test.skip(
      isDjango,
      'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/blog.html');
    await expect(page.locator('[data-blog-eyebrow]')).toHaveText(site.blogPage.eyebrow);
    await expect(page.locator('h1')).toHaveText(site.blogPage.heading);
    await expect(page.locator('.page-intro')).toHaveText(site.blogPage.intro);
    await expect(page.locator('.blog-count')).toHaveText('3 articles');
    const group = page.getByRole('navigation', { name: 'Blog categories' });
    await expect(group.getByRole('link')).toHaveText([
      'All',
      ...site.categories.map((c) => c.label),
    ]);
    const ink = group.locator('.pf-tab-ink');
    const under = async (name) => {
      const tab = await group.getByRole('link', { name }).boundingBox();
      const line = await ink.boundingBox();
      if (!tab || !line) return false;
      return Math.abs(tab.x - line.x) < 1 && Math.abs(tab.width - line.width) < 1;
    };
    await expect.poll(() => under('All')).toBe(true);
    await group.getByRole('link', { name: 'Tech review' }).click();
    await expect.poll(() => under('Tech review')).toBe(true);
  });

  test('cards: decorative card image, label, title, description, Read article', async ({
    page,
  }) => {
    test.skip(
      isDjango,
      'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
    );
    await page.goto('/blog.html');
    for (const post of site.postList) {
      const card = page.locator(`[data-post-category="${post.category}"] .blog-card`);
      // Decorative on the card, which its link names; named on the post.
      const cover = card.locator('.blog-cover img');
      await expect(cover).toHaveAttribute('alt', '');
      await expect(cover).toHaveAttribute('width', '1600');
      await expect(cover).toHaveAttribute('height', '900');
      const ratio = await card
        .locator('.blog-cover')
        .evaluate((el) => el.clientWidth / el.clientHeight);
      expect(ratio).toBeCloseTo(16 / 9, 1);
      await expect(card.locator('.blog-card-category')).toHaveText(post.categoryLabel);
      await expect(card.locator('.blog-card-title')).toHaveText(post.title);
      const link = card.getByRole('link', {
        name: `Read article: ${post.title}${post.draft ? ' (draft)' : ''}`,
        exact: true,
      });
      await expect(link).toHaveAttribute('href', pagePath(post.file));
    }
  });

  for (const [width, columns] of [
    [1440, 3],
    [768, 2],
    [390, 1],
  ]) {
    test(`${columns} column(s) at ${width} px`, async ({ page }) => {
      test.skip(
        isDjango,
        'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
      );
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/blog.html');
      expect(await rowsOf(page.locator('.blog-card'))).toBe(Math.ceil(3 / columns));
    });
  }

  test('release build: no Draft preview, no drafts count, no Draft label', () => {
    test.setTimeout(180_000);
    // One published post (a fixture), RELEASE=true: drafts are not built.
    const dir = mkdtempSync(join(tmpdir(), 'inner-pages-fixture-'));
    const fixture = join(dir, 'content.json');
    const blog = structuredClone(loadContent().blog);
    blog[1] = { ...blog[1], status: 'published', date: '2026-10-26' };
    writeFileSync(fixture, JSON.stringify({ blog }));
    const outDirs = [];
    try {
      const release = buildInto({ RELEASE: 'true', CONTENT_FIXTURE: fixture });
      outDirs.push(release);
      const html = readFileSync(join(release, 'blog.html'), 'utf8');
      expect(html).not.toContain('data-draft-label');
      expect(html).not.toMatch(/\bdrafts?\b/);
      expect(html).toContain(site.blogPage.eyebrow.replace('&', '&amp;'));
      expect(html).toMatch(/data-results-status>\s*1 article\s*</);
      expect(html).toContain(blog[1].title);
      expect(html).not.toContain(blog[0].title);
    } finally {
      for (const out of [...outDirs, dir]) rmSync(out, { recursive: true, force: true });
    }
  });
});

test.describe('item 3: Blog without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every card is shown and links to its post; the category tabs are links', async ({
    page,
  }) => {
    test.skip(
      isDjango,
      'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
    );
    await page.goto('/blog.html');
    await expect(page.getByRole('navigation', { name: 'Blog categories' })).toBeVisible();
    await expect(page.locator('.blog-card:visible')).toHaveCount(site.postList.length);
    await expect(page.locator('.blog-count')).toHaveText('3 articles');
  });
});

test.describe('item 4: post page (FD-114)', () => {
  const post = site.postList[0];

  test('cover, sidebar: On this page, author card, More posts (same category first)', async ({
    page,
  }) => {
    test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${post.file}`);
    // 1.7.0: the card image is the page-top image, 16:9, with its alt text.
    const cover = page.locator('.post-cover img');
    await expect(cover).toHaveAttribute('alt', post.card_image.alt);
    const toc = page.getByRole('navigation', { name: site.postSidebar.toc_heading });
    await expect(toc.getByRole('link')).toHaveText(post.toc.map((item) => item.label));
    for (const item of post.toc) {
      await expect(toc.getByRole('link', { name: item.label })).toHaveAttribute(
        'href',
        `#${item.id}`,
      );
      await expect(page.locator(`.prose h2#${item.id}`)).toHaveCount(1);
    }
    const author = page.getByRole('region', { name: site.postSidebar.author_heading });
    await expect(author).toContainText(site.profile.name);
    await expect(author.getByRole('link', { name: 'Portfolio' })).toHaveAttribute(
      'href',
      pagePath('portfolio.html'),
    );
    await expect(author.getByRole('link', { name: 'Contact' })).toHaveAttribute(
      'href',
      pagePath('contact.html'),
    );
    const more = page.getByRole('navigation', { name: site.postSidebar.more_heading });
    await expect(more.locator('.post-more-title')).toHaveText(post.more.map((p) => p.title));
  });

  test('More posts lists the same category first', () => {
    const content = structuredClone(loadContent());
    content.blog[2].category = content.blog[0].category;
    const [first] = buildSite(content, { showDrafts: true }).postList;
    expect(first.more.map((p) => p.title)).toEqual([content.blog[2].title, content.blog[1].title]);
  });

  test('sticky sidebar from lg marks the section being read', async ({ page }) => {
    test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto(`/${post.file}`);
    const toc = page.locator('[data-post-toc]');
    const links = toc.getByRole('link');
    await expect(links.first()).not.toHaveAttribute('aria-current');
    const scrollTo = (id) =>
      page.evaluate((target) => {
        const top = document.getElementById(target).getBoundingClientRect().top + scrollY;
        window.scrollTo({ top: top - 100, behavior: 'instant' });
      }, id);
    await scrollTo(post.toc[0].id);
    await expect(links.first()).toHaveAttribute('aria-current', 'true');
    // The sidebar stays in view, under the header, while the article scrolls.
    const box = await page.locator('.post-aside-inner').boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeLessThan(200);
    await scrollTo(post.toc.at(-1).id);
    await expect(links.last()).toHaveAttribute('aria-current', 'true');
    await expect(links.first()).not.toHaveAttribute('aria-current');
  });

  test('phones: author card and More posts after the article; no section list', async ({
    page,
  }) => {
    test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${post.file}`);
    await expect(page.locator('[data-post-toc]')).toBeHidden();
    const author = await page.locator('.author-card').boundingBox();
    const more = await page.locator('.post-more').boundingBox();
    const article = await page.locator('article.post').boundingBox();
    expect(author.y).toBeGreaterThanOrEqual(article.y + article.height);
    expect(more.y).toBeGreaterThan(author.y);
    expect(author.width).toBeGreaterThan(300);
  });
});

test.describe('item 6: project detail template (FD-116)', () => {
  for (const project of site.projectList) {
    test(`${project.file}: blocks from the data only; facts equal the content file`, async ({
      page,
    }) => {
      const detail = inner.projects[project.id].detail;
      await page.goto(`/${project.file}`);
      // S5 (1.6.0): one back link at the top, "← Projects".
      const back = page.getByRole('navigation', { name: 'Back' });
      await expect(back.getByRole('link')).toHaveText('Projects');
      await expect(back.getByRole('link')).toHaveAttribute('href', pagePath('research.html'));
      await expect(page.locator('h1')).toHaveText(project.title);

      // Facts: role always; period and status where set; the detail facts where given.
      const facts = [
        ['Role', detail?.facts?.role ?? project.role],
        ...(project.period ? [['Period', project.period]] : []),
        ...(project.status
          ? [['Status', project.status === 'done' ? 'Completed' : 'In progress']]
          : []),
        ...(detail?.facts?.institution
          ? [['Institution', `${detail.facts.institution}${detail.facts.unit ?? ''}`]]
          : []),
        ...(detail?.facts?.technology ? [['Technology', detail.facts.technology]] : []),
        ...(detail?.facts?.output ? [['Research output', detail.facts.output]] : []),
      ];
      await expect(page.locator('.fact-label')).toHaveText(facts.map(([label]) => label));
      await expect(page.locator('.fact-value')).toHaveText(facts.map(([, value]) => value));

      const summary = page.locator('.project-summary');
      const system = page.locator('.system');
      const results = page.locator('.result');
      const context = page.locator('.study-context');
      if (detail) {
        await expect(summary).toHaveText(detail.summary_line);
        await expect(system.locator('.system-step-title')).toHaveText(
          detail.system.map((step) => step.title),
        );
        await expect(system.locator('.system-step-text')).toHaveText(
          detail.system.map((step) => step.text),
        );
        await expect(system.locator('.system-step .line-icon')).toHaveCount(3);
        await expect(system.locator('.system-note')).toHaveText(detail.system_note);
        // 1.7.0: Overview, Methods, Results and Limitations are Markdown text blocks.
        const blocks = {
          overview: detail.overview,
          methods: detail.methods,
          results: detail.results_text,
          limitations: detail.limitations,
        };
        for (const [key, text] of Object.entries(blocks)) {
          await expect(page.locator(`#${key}-title`), key).toHaveCount(text ? 1 : 0);
        }
        await expect(page.locator('.project-prose').first()).toContainText(
          detail.overview.split('\n')[0],
        );
        await expect(page.locator('figure.fig')).toHaveCount(detail.figures?.length ?? 0);
        await expect(page.locator('.contribution-list li')).toHaveText(detail.contribution);
        await expect(results.locator('.result-title')).toHaveText(
          detail.results.map((r) => r.title),
        );
        await expect(results.locator('.result-text')).toHaveText(detail.results.map((r) => r.text));
        await expect(context).toHaveCount(detail.context ? 1 : 0);
        if (detail.context) await expect(context).toHaveText(detail.context);
      } else {
        // Reduced page: title, role, contribution, topics and paper; no detail block.
        for (const block of [
          summary,
          system,
          results,
          context,
          page.locator('.contribution-list'),
        ]) {
          await expect(block).toHaveCount(0);
        }
        await expect(page.locator('.detail-text')).toHaveText(project.contribution);
      }
      await expect(page.locator('.project-article .pill')).toHaveText(project.tags);

      // Related publication: full citation, DOI and Read publication in a new tab.
      const pubs = page.locator('.related-pub');
      await expect(pubs).toHaveCount(project.publications.length);
      for (const [i, pub] of project.publications.entries()) {
        const card = pubs.nth(i);
        await expect(card.locator('.related-pub-title')).toHaveText(pub.title);
        await expect(card.locator('.related-pub-citation strong')).toHaveText(
          pub.authors.find((a) => a.me).name,
        );
        await expect(card.locator('.related-pub-citation')).toContainText(
          pub.authors.map((a) => a.name).join(', '),
        );
        for (const link of await card.getByRole('link').all()) {
          await expect(link).toHaveAttribute('href', `https://doi.org/${pub.doi}`);
          await expect(link).toHaveAttribute('target', '_blank');
          await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
          await expect(link).toContainText('(opens in a new tab)');
        }
      }

      await expect(page.getByRole('link', { name: 'Back to Projects' })).toHaveAttribute(
        'href',
        pagePath('research.html'),
      );
      const pager = page.getByRole('navigation', { name: 'More projects' });
      for (const [rel, other] of [
        ['prev', project.prev],
        ['next', project.next],
      ]) {
        const link = pager.locator(`a[rel="${rel}"]`);
        await expect(link).toHaveCount(other ? 1 : 0);
        if (other) {
          await expect(link).toHaveAttribute('href', pagePath(other.file));
          await expect(link.locator('.project-pager-title')).toHaveText(other.shortTitle);
        }
      }
    });
  }

  test('no field outside the content file reaches the page (Biofloc text check)', async ({
    page,
  }) => {
    await page.goto('/project-biofloc-iot.html');
    const text = await page.locator('main').innerText();
    for (const word of ['Nile tilapia', 'Blynk', 'ESP32']) expect(text).toContain(word);
    // The demo's wording differs from the approved content; the approved one is shown.
    expect(text).not.toContain('System development and integration');
    expect(text).toContain('System development');
  });

  test('phones: facts, steps, columns and pager stack', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/project-solar-irrigation.html');
    const steps = page.locator('.system-step');
    const tops = await steps.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
    expect(tops[1]).toBeGreaterThan(tops[0]);
    expect(tops[2]).toBeGreaterThan(tops[1]);
    const prev = await page.locator('a[rel="prev"]').boundingBox();
    const next = await page.locator('a[rel="next"]').boundingBox();
    expect(next.y).toBeGreaterThan(prev.y);
  });
});

const topsOf = (locator) =>
  locator.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));

test.describe('item 7: Hire me (FD-117)', () => {
  test('1440: heading left, availability and Start a brief right; one-row process; form beside the aside', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/hire.html');
    const h1 = await page.locator('h1').boundingBox();
    const aside = await page.locator('.hire-head-row .band-actions').boundingBox();
    expect(aside.x).toBeGreaterThan(h1.x + h1.width - 1);
    await expect(page.locator('.hire-head .availability')).toHaveText(site.hire.availability);
    // F2 (1.6.0): the availability line and "Start a brief" — no CV button in the head.
    const actions = page.locator('.hire-head .band-actions a');
    await expect(actions).toHaveCount(1);
    await expect(actions.first()).toHaveAttribute('href', '#brief');
    await expect(page.locator('.service')).toHaveCount(site.hire.services.length);
    expect(new Set(await topsOf(page.locator('.step'))).size).toBe(1);
    const form = await page.locator('form[data-form="hire"]').boundingBox();
    const box = await page.locator('.form-aside').boundingBox();
    expect(box.x).toBeGreaterThan(form.x + form.width - 1);
    await actions.first().click();
    await expect(page).toHaveURL(/#brief$/);
  });

  test('390: stacked, the head action full width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/hire.html');
    const main = await page.locator('.hire-head .band-actions').boundingBox();
    for (const action of await page.locator('.hire-head .band-actions a').all()) {
      const b = await action.boundingBox();
      expect(Math.round(b.width)).toBe(Math.round(main.width));
    }
    const form = await page.locator('form[data-form="hire"]').boundingBox();
    const box = await page.locator('.form-aside').boundingBox();
    expect(box.y).toBeGreaterThan(form.y + form.height - 1);
  });
});

test.describe('item 8: Contact (FD-118)', () => {
  test('1440: form | What to expect, audiences', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/contact.html');
    const form = await page.locator('form[data-form="contact"]').boundingBox();
    const aside = page.locator('aside.form-aside');
    const box = await aside.boundingBox();
    expect(box.x).toBeGreaterThan(form.x + form.width - 1);
    expect(Math.abs(box.y - form.y)).toBeLessThan(80);
    // C1 (1.6.0): no Direct and no Elsewhere card, no email; What to expect, then the audiences.
    await expect(aside.getByRole('link')).toHaveCount(0);
    await expect(aside.locator('.aside-box h2')).toHaveText([
      site.contact.expect.heading,
      "Who I'd like to hear from",
    ]);
    await expect(aside.locator('.expect-item dt')).toHaveText(
      site.contact.expect.items.map((item) => item.label),
    );
    await expect(aside.locator('ul.plain-list li')).toHaveText(site.contact.audiences);
  });

  test('390: stacked — the form, then the aside, full width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/contact.html');
    const form = await page.locator('form[data-form="contact"]').boundingBox();
    const box = await page.locator('aside.form-aside .aside-box').first().boundingBox();
    expect(box.y).toBeGreaterThan(form.y + form.height - 1);
    expect(Math.abs(box.width - form.width)).toBeLessThan(2);
  });
});

test.describe('item 9: 404 and site-wide links (FD-119, FD-76)', () => {
  test('404: centred — a large 404, the approved line, a line drawing, four links, no portrait (N1)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/404.html');
    await expect(page.locator('.not-found-code')).toHaveText('404');
    await expect(page.locator('h1')).toHaveText('Page not found');
    await expect(page.locator('main .page-intro')).toHaveText(site.meta['404']);
    const actions = page.locator('.not-found-actions a');
    await expect(actions).toHaveText(['Home', 'Projects', 'Blog', 'Contact']);
    for (const [i, href] of [
      pagePath('index.html'),
      pagePath('research.html'),
      pagePath('blog.html'),
      pagePath('contact.html'),
    ].entries()) {
      await expect(actions.nth(i)).toHaveAttribute('href', href);
    }
    // The line drawing in the blog-cover frame; no photograph.
    await expect(page.locator('main .not-found-art svg.illustration')).toHaveCount(1);
    await expect(page.locator('main img')).toHaveCount(0);
    // Centred: the heading's middle is the window's middle.
    const h1 = await page.locator('h1').boundingBox();
    expect(Math.abs(h1.x + h1.width / 2 - 720)).toBeLessThan(2);
    // N2: the message sits high — the 404 starts within 140 px of the header.
    const code = await page.locator('.not-found-code').boundingBox();
    expect(code.y).toBeLessThan(64 + 140);
  });

  // 1.5.0 (the error-page note): in forced-colours mode the system drops backgrounds, so a pill
  // link needs a real border to stay visible. The 404 actions keep a solid border; Django's
  // static 500 page needs the same (docs/handover-django.md, section 11).
  test('404: the action buttons keep a visible border in forced-colours mode', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/404.html');
    const borders = await page
      .locator('.not-found-actions .btn')
      .evaluateAll((links) =>
        links.map((el) => [
          getComputedStyle(el).borderTopStyle,
          getComputedStyle(el).borderTopWidth,
        ]),
      );
    expect(borders).toHaveLength(4);
    for (const [style, width] of borders) {
      expect(style).toBe('solid');
      expect(parseFloat(width)).toBeGreaterThanOrEqual(1);
    }
  });

  test('404 at 390: actions full width, the drawing above them', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/404.html');
    const list = await page.locator('.not-found-actions').boundingBox();
    for (const action of await page.locator('.not-found-actions a').all()) {
      expect(Math.round((await action.boundingBox()).width)).toBe(Math.round(list.width));
    }
    const art = await page.locator('.not-found-art').boundingBox();
    expect(art.y + art.height).toBeLessThan(list.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });

  test('every external link on every page opens a new tab and says so', () => {
    const files = readdirSync('dist').filter((file) => file.endsWith('.html'));
    // FD-142: the rich-content samples on the two template pages are Django's exact output, whose
    // contract drops `target` from links (an open owner question); they are checked as Django
    // writes them in tests/rich.spec.js.
    const djangoSamples = new Set(
      ['rich-post', 'rich-overview'].flatMap((name) =>
        [
          ...readFileSync(`src/partials/samples/${name}.hbs`, 'utf8').matchAll(
            /<a\b[^>]*>[\s\S]*?<\/a>/g,
          ),
        ].map(([anchor]) => anchor),
      ),
    );
    expect(djangoSamples.size).toBeGreaterThan(0);
    let checked = 0;
    for (const file of files) {
      const html = readFileSync(join('dist', file), 'utf8');
      for (const [anchor] of html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/g)) {
        if (djangoSamples.has(anchor) && ['blog-post.html', 'portfolio-entry.html'].includes(file))
          continue;
        const href = anchor.match(/href="([^"]*)"/)?.[1] ?? '';
        if (/^https?:/.test(href)) {
          checked += 1;
          expect(anchor, file).toMatch(/target="_blank"/);
          expect(anchor, file).toMatch(/rel="[^"]*noopener noreferrer[^"]*"/);
          expect(anchor, file).toMatch(/opens in a new tab/);
        } else {
          // Internal links (and mailto:) stay in the same tab.
          expect(anchor, file).not.toMatch(/target="_blank"/);
        }
      }
    }
    expect(checked).toBeGreaterThan(files.length * 6);
  });

  test('text links: --accent underline at rest, --accent text on 2 px when hovered', async ({
    page,
  }) => {
    test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
    await page.goto(`/${site.postList[0].file}`);
    const accent = await page.evaluate(() => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--accent)';
      document.body.append(probe);
      const colour = getComputedStyle(probe).color;
      probe.remove();
      return colour;
    });
    const link = page.locator('.author-links .link').first();
    const style = () =>
      link.evaluate((el) => {
        const c = getComputedStyle(el);
        return { color: c.color, image: c.backgroundImage, size: c.backgroundSize };
      });
    const rest = await style();
    expect(rest.image).toContain(accent);
    expect(rest.size).toBe('100% 1px');
    expect(rest.color).not.toBe(accent);
    await link.hover();
    await expect.poll(async () => (await style()).size).toBe('100% 2px');
    await expect.poll(async () => (await style()).color).toBe(accent);
  });
});

const innerDetailPages = [
  'blog.html',
  ...(isDjango ? [] : [site.postList[0].file]),
  'research.html',
  'project-biofloc-iot.html',
  'project-solar-irrigation.html',
  'project-egg-incubator.html',
  'hire.html',
  'contact.html',
  '404.html',
];

test.describe('item 10: phones and tablets', () => {
  test('320 px: Blog tabs in one scrolling row, every tab a 44 px target', async ({ page }) => {
    test.skip(
      isDjango,
      'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
    );
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/blog.html');
    const group = page.locator('[data-category-filter]');
    const tops = await group
      .getByRole('link')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
    // The row scrolls inside itself; the page never does (no scrollbar shown).
    await expect(group).toHaveCSS('overflow-x', 'auto');
    await expect(group).toHaveCSS('flex-wrap', 'nowrap');
    // "x proximity", serialised without the default.
    await expect(group).toHaveCSS('scroll-snap-type', 'x');
    await expect(group).toHaveCSS('scrollbar-width', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    for (const tab of await page.locator('.pf-tab').all()) {
      const box = await tab.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('link', { name: 'Education' }).click();
    await expect(page.locator('.blog-card:visible')).toHaveCount(1);
  });

  for (const width of [320, 390, 768]) {
    test(`${width} px: the new controls are 44 px targets`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const selector = [
        '.pf-tab',
        '.blog-card-link',
        '.post-more-link',
        '.back-link',
        '.pf-card-link',
        '.project-pager-link',
        '.ext-link',
        '.profile-link',
        '.not-found-actions a',
        '.back-category',
        '.band-actions a',
        '.field-control',
      ].join(', ');
      for (const file of innerDetailPages) {
        await page.goto(`/${file}`);
        const small = await page.locator('main').evaluate(
          (main, sel) =>
            [...main.querySelectorAll(sel)]
              .filter((el) => el.getClientRects().length)
              .filter((el) => el.getBoundingClientRect().height < 44)
              .map((el) => `${el.className} ${Math.round(el.getBoundingClientRect().height)}`),
          selector,
        );
        expect(small, file).toEqual([]);
      }
    });
  }

  for (const size of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`back-to-top on every long page at ${size.width} px`, async ({ page }) => {
      await page.setViewportSize(size);
      for (const file of innerDetailPages) {
        await page.goto(`/${file}`);
        const long = await page.evaluate(
          () => document.documentElement.scrollHeight > window.innerHeight * 2,
        );
        if (!long) continue;
        const button = page.getByRole('button', { name: 'Back to top' });
        await expect(button, file).toBeHidden();
        await page.evaluate(() =>
          window.scrollTo({ top: window.innerHeight * 1.5, behavior: 'instant' }),
        );
        await expect(button, file).toBeVisible();
      }
    });
  }
});

test.describe('item 10: reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('every page is complete at once: nothing hidden, no tab ink transition', async ({
    page,
  }) => {
    test.skip(
      isDjango,
      'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
    );
    for (const file of innerDetailPages) {
      await page.goto(`/${file}`);
      await page.evaluate(() => window.scrollTo({ top: 99999, behavior: 'instant' }));
      const hidden = await page
        .locator('[data-reveal]')
        .evaluateAll((els) =>
          els.filter((el) => getComputedStyle(el).opacity !== '1').map((el) => el.className),
        );
      expect(hidden, file).toEqual([]);
    }
    await page.goto('/blog.html');
    await expect(page.locator('.pf-tab-ink')).toHaveCSS('transition-duration', '0s');
  });
});

test.describe('item 10: layout stability', () => {
  for (const file of ['blog.html', 'research.html', 'project-biofloc-iot.html', 'hire.html']) {
    test(`${file}: no layout shift while loading (CLS 0)`, async ({ page }) => {
      // Every shift is recorded with its sources, so a failure (CI on Linux) names the element.
      await page.addInitScript(() => {
        window.__cls = 0;
        window.__shifts = [];
        const rect = (r) =>
          r && [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 100) / 100);
        const describe = (node) => {
          if (!node) return '(removed node)';
          if (node.nodeType !== 1) return `#text "${(node.textContent || '').trim().slice(0, 40)}"`;
          const cls =
            node.className && typeof node.className === 'string'
              ? `.${node.className.trim().split(/\s+/).join('.')}`
              : '';
          return `${node.tagName.toLowerCase()}${cls} "${(node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
        };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.hadRecentInput) continue;
            window.__cls += entry.value;
            window.__shifts.push({
              value: entry.value,
              startTime: Math.round(entry.startTime),
              sources: (entry.sources || []).map((s) => ({
                node: describe(s.node),
                previousRect: rect(s.previousRect),
                currentRect: rect(s.currentRect),
              })),
            });
          }
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`/${file}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(800);
      const { cls, shifts } = await page.evaluate(() => ({
        cls: window.__cls,
        shifts: window.__shifts,
      }));
      expect(cls, `layout shifts:\n${JSON.stringify(shifts, null, 2)}`).toBe(0);
    });
  }
});

test.describe('category tabs and empty states', () => {
  // Below 576 px one row that scrolls; the pressed tab comes into view and the
  // underline stays under it.
  for (const width of [320, 390]) {
    test(`${width}: the pressed tab is scrolled into view, the underline under it`, async ({
      page,
    }) => {
      test.skip(
        isDjango,
        'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
      );
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/blog.html');
      const group = page.getByRole('navigation', { name: 'Blog categories' });
      const ink = group.locator('.pf-tab-ink');
      const tabs = group.getByRole('link');
      const view = await group.boundingBox();
      for (const tab of [...(await tabs.all()), ...(await tabs.all()).reverse()]) {
        await tab.click();
        await expect
          .poll(async () => {
            const t = await tab.boundingBox();
            const i = await ink.boundingBox();
            if (!t || !i) return false;
            const inView = t.x >= view.x - 1 && t.x + t.width <= view.x + view.width + 1;
            const under = Math.abs(t.x - i.x) < 1 && Math.abs(t.width - i.width) < 1;
            return inView && under && Math.abs(t.y + t.height - (i.y + i.height)) < 2;
          })
          .toBe(true);
      }
    });
  }

  test('768: the Blog tabs keep their wrapped row and the underline', async ({ page }) => {
    test.skip(
      isDjango,
      'Django: the seed posts are drafts and Django does not publish drafts (FD-137)',
    );
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto('/blog.html');
    const group = page.getByRole('navigation', { name: 'Blog categories' });
    const ink = group.locator('.pf-tab-ink');
    await expect(group).toHaveCSS('overflow-x', 'visible');
    const tabs = group.getByRole('link');
    for (const tab of await tabs.all()) {
      await tab.click();
      await expect
        .poll(async () => {
          const t = await tab.boundingBox();
          const i = await ink.boundingBox();
          if (!t || !i) return false;
          return Math.abs(t.x - i.x) < 1 && Math.abs(t.y + t.height - (i.y + i.height)) < 2;
        })
        .toBe(true);
      const box = await tab.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
  });

  test('counts say "{n} articles" ("1 article") and the eyebrow is fixed (B1, B2)', () => {
    const content = structuredClone(loadContent());
    content.blog[0] = { ...content.blog[0], status: 'published', date: '2026-10-26' };
    const mixed = buildSite(content, { showDrafts: true });
    expect(mixed.blogView.eyebrow).toBe(content.blogPage.eyebrow);
    expect(mixed.blogView.countText).toBe('3 articles');
    const [first, second] = mixed.categories;
    expect(first.countText).toBe(`1 article in ${first.label}`);
    expect(second.countText).toBe(`1 article in ${second.label}`);
    expect(site.blogView.eyebrow).toBe('Blog / Articles & notes');
    expect(site.blogView.countText).toBe('3 articles');
  });

  test('footer links: no underline at rest, FD-76 underline on hover (FD-94)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/blog.html');
    const size = (locator) => locator.evaluate((el) => getComputedStyle(el).backgroundSize);
    const footer = page.locator('.site-footer');
    const portfolio = footer.locator(`a[href="${pagePath('portfolio.html')}"] .link`);
    expect(await size(portfolio)).toBe('0px 1px');
    expect(await size(footer.locator('a[href^="https://"] .link').first())).toBe('0px 1px');
    await portfolio.hover();
    await expect.poll(() => size(portfolio)).toBe('100% 2px');
    // The page you are on keeps its 2 px line; other links keep FD-76 at rest.
    expect(await size(footer.locator('a[aria-current] .link'))).toBe('100% 2px');
  });

  test('post figures: whole image, "Figure n." caption, a wide one stays in the text column', async ({
    page,
  }) => {
    test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${site.postList[0].file}`);
    const figures = page.locator('.prose figure.fig');
    await expect(figures).toHaveCount(site.postList[0].figures.length);
    const wide = await page.locator('.prose figure.fig-wide').boundingBox();
    const prose = await page.locator('.prose').boundingBox();
    expect(Math.abs(wide.width - prose.width)).toBeLessThanOrEqual(1);
    expect(wide.x).toBeGreaterThanOrEqual(prose.x - 1);
    await expect(figures.first().locator('img')).toHaveCSS('object-fit', 'contain');
  });

  test('the DOI link has the ↗ icon (FD-76)', async ({ page }) => {
    await page.goto('/project-biofloc-iot.html');
    await expect(page.locator('.related-pub-doi a svg')).toHaveCount(1);
  });

  test('post sidebar scrolls on its own when the screen is short', async ({ page }) => {
    test.skip(isDjango, 'Django: no post page exists, the posts are drafts (FD-137)');
    await page.setViewportSize({ width: 1366, height: 600 });
    await page.goto(`/${site.postList[0].file}`);
    const inner = page.locator('.post-aside-inner');
    await expect(inner).toHaveCSS('overflow-y', 'auto');
    // Once stuck under the header, all of it fits the screen.
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
    const box = await inner.boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(600 + 1);
  });
});
