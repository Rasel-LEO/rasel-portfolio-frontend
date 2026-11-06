// Author: Rasel Al Mamun
// Release 1.6.0 (FD-147 … FD-153): the final site-basics content word for word (Phase 1), the
// download icon on every CV link, Web of Science, the Portfolio introduction and three roles, the
// Home field list and its link targets, the person structured data, the AI-portrait flag and the
// keyboard-scrollable formula, table and code boxes. Reads the built files; a few checks open a
// page. (The editable slots with empty, long and any-length values are tests/slots.spec.js.)
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { buildSite, loadContent } from '../tools/content.mjs';
import { pages, pagePath } from './pages.js';

const html = (file) => readFileSync(`dist/${file}`, 'utf8').replaceAll('&nbsp;', ' ');
const content = loadContent();
const site = buildSite();
const DOWNLOAD = 'M12 4v11M7 11l5 5 5-5M5 20h14';
const PHASE_1 = 'Founder, Ideatrium · Research Assistant, Bangladesh Agricultural University';

test.describe('final content, word for word', () => {
  test('profile', () => {
    const p = content.profile;
    expect(p.full_name).toBe('Md. Rasel Al Mamun');
    expect(p.position).toBe('Research Assistant');
    expect(p.second_role).toBe('Founder, Ideatrium');
    expect(p.eyebrow).toBe(PHASE_1);
    expect(p.eyebrow_short).toBe('Founder, Ideatrium · Research Assistant, BAU');
    expect(p.role_line).toBe('Agricultural engineer · Researcher · Software developer');
    expect(p.statement).toBe(
      'I am an engineer and developer who turns ideas into working systems: microcontroller and IoT hardware, edge AI, robotics, mobile apps, software and websites. I design the hardware, write the code and test it in real conditions, in agriculture and beyond.',
    );
    expect(p.summary).toBe(
      'Portfolio of Rasel Al Mamun, agricultural engineer and software developer: publications, projects, awards, experience and skills.',
    );
    expect(p.location_line).toBe('Farm Power and Machinery · Mymensingh, Bangladesh');
    expect(p.author_line).toBe(PHASE_1);
    expect([p.email, p.secondary_email]).toEqual([
      'hello@ideatrium.com',
      'mr.raselalmamun@gmail.com',
    ]);
  });

  test('links: Web of Science is fourth; Google Scholar has no &hl=en', () => {
    expect(content.links.map((l) => l.id)).toEqual([
      'orcid',
      'scholar',
      'scopus',
      'wos',
      'researchgate',
      'linkedin',
      'github',
    ]);
    expect(content.links[1].url).toBe('https://scholar.google.com/citations?user=mNjYDB0AAAAJ');
    expect(content.links[3]).toEqual({
      id: 'wos',
      label: 'Web of Science',
      handle: 'RKQ-3766-2026',
      url: 'https://www.webofscience.com/wos/author/record/RKQ-3766-2026',
    });
    expect(content.footer.research_profiles).toEqual([
      'orcid',
      'scholar',
      'scopus',
      'wos',
      'researchgate',
    ]);
    expect(content.footer.connect_profiles).toEqual(['linkedin', 'github']);
  });

  test('Home, Portfolio, Hire me, Contact, Blog, Projects texts', () => {
    expect(content.home.ctas[2]).toMatchObject({ label: 'Download CV (PDF)' });
    expect(content.home.screen2.pillars[1].href).toBe('hire.html');
    expect(content.fields.map((f) => [f.label, f.target, f.icon])).toEqual([
      ['IoT & edge AI', 'portfolio.html#research', 'network'],
      ['Embedded systems', 'portfolio.html#expertise', 'chip'],
      ['Software & web', 'hire.html', 'code'],
      ['Robotics & automation', 'portfolio.html#expertise', 'gear'],
      ['Precision agriculture', 'portfolio.html#research', 'sprout'],
      ['Publications', 'portfolio.html#publications', 'document'],
    ]);
    const pf = content.portfolio;
    expect(pf.profile.eyebrow).toBe(PHASE_1);
    expect(pf.profile.summary_line).toBe(
      'Agricultural engineer and software developer building IoT, edge AI, embedded and web systems, for agriculture and beyond.',
    );
    expect(pf.profile.summary_line).toHaveLength(121);
    expect(pf.publications.intro).toBe('First-author papers in IoT and agricultural engineering.');
    expect(pf.projects.heading).toBe('Selected projects');
    expect(pf.projects.intro).toBe(
      'Research and software projects: IoT, edge AI, automation and applications.',
    );
    expect(pf.projects.cta).toBe('View all {count} projects');
    expect(pf.awards.items[2].title).toBe('Master’s Fellowship');
    expect(content.awards.map((a) => a.title)).toContain('Master’s Fellowship');
    expect(pf.expertise.groups.map((g) => [g.title, g.items])).toEqual([
      ['Embedded & IoT', ['Microcontroller programming', 'IoT & edge AI', 'Robotics & automation']],
      ['AI & data', ['Machine vision', 'Data analysis', 'Python', 'R', 'Tableau']],
      [
        'Software development',
        ['Python', 'C++', 'C#', 'Flutter (Dart) mobile apps', 'JavaScript', 'PHP', 'PostgreSQL'],
      ],
      ['Engineering tools', ['AutoCAD', 'Proteus', 'Fusion 360']],
    ]);
    expect(content.hire.availability).toBe(
      'Available for new projects and research collaborations.',
    );
    expect(content.hire.services[2].evidence).toEqual({
      label: 'View projects',
      href: 'portfolio.html#research',
    });
    expect(content.contact.intro).toBe(
      'Have an idea or a problem to solve? Email me directly or use the form.',
    );
    expect(content.contact.audiences).toEqual([
      'Research collaborators',
      'Employers and recruiters',
      'Clients for IoT, software and web projects',
      'Students and companies needing project support',
    ]);
    expect(content.contact.subjects).toEqual([
      'Research collaboration',
      'Job opportunity',
      'Project or consulting',
      'Speaking or teaching',
      'Other',
    ]);
    expect(content.blogPage.intro).toBe(
      'Notes on IoT, software, applied AI and agricultural engineering.',
    );
    expect(content.researchArchive.heading).toBe('Projects');
    expect(content.researchArchive.intro).toBe(pf.projects.intro);
    expect(site.portfolioView.researchDescription).toBe(
      `${content.projects.length} projects by Rasel Al Mamun: research and software, from IoT and edge AI to automation and applications.`,
    );
  });

  test('the three experience roles, in order', () => {
    expect(
      content.portfolio.experience.roles.map((r) => [r.title, r.period, r.unit, r.institution]),
    ).toEqual([
      ['Founder', '2026 – present', '', 'Ideatrium'],
      [
        'Research Assistant',
        'Jan 2024 – present',
        'Farm Power and Machinery',
        'Bangladesh Agricultural University',
      ],
      [
        'Undergraduate researcher',
        'Jan 2022 – Apr 2023',
        'Farm Power and Machinery',
        'Bangladesh Agricultural University',
      ],
    ]);
    expect(content.portfolio.experience.roles[0].bullets).toEqual([
      'Web, app and embedded software',
      'Research support and technical consulting',
    ]);
  });

  test('skills, certifications, training', () => {
    expect(content.skills.map((s) => s.group)).toEqual([
      'Programming',
      'Embedded, IoT & AI',
      'Data & databases',
      'Design & tools',
    ]);
    expect(content.skills[3].items).toContain('MS Office');
    expect(content.certifications.map((c) => c.title).slice(0, 3)).toEqual([
      'Google Data Analytics Professional Certificate',
      'IBM Data Science Professional Certificate',
      'Python for Everybody Specialization',
    ]);
  });
});

test.describe('built pages', () => {
  test('every CV link is "Download CV (PDF)" with the download icon, no mail icon', () => {
    for (const file of pages) {
      const source = html(file);
      const links = [
        ...source.matchAll(/<a[^>]*href="\/cv\/Rasel_Al_Mamun_CV\.pdf"[^>]*>([\s\S]*?)<\/a>/g),
      ];
      for (const [, inner] of links) {
        expect(inner, file).toContain('Download CV (PDF)');
        expect(inner, `${file}: download icon`).toContain(DOWNLOAD);
        expect(inner, `${file}: no envelope`).not.toContain('M3 6h18v12H3z');
      }
    }
    expect(html('index.html')).toContain('Download CV (PDF)');
  });

  test('Web of Science: footer, Portfolio, Contact and the structured data', () => {
    const wos = 'https://www.webofscience.com/wos/author/record/RKQ-3766-2026';
    for (const file of ['index.html', 'portfolio.html', 'contact.html']) {
      expect(html(file), file).toContain(`href="${wos}"`);
    }
    // Footer: five research profiles in order.
    const footer = html('index.html');
    const group = footer.slice(
      footer.indexOf('id="footer-research"'),
      footer.indexOf('id="footer-connect"'),
    );
    expect([...group.matchAll(/<span class="link">([^<]+)<\/span>/g)].map((m) => m[1])).toEqual([
      'ORCID',
      'Google Scholar',
      'Scopus',
      'Web of Science',
      'ResearchGate',
    ]);
    expect(site.person.sameAs).toContain(wos);
    expect(site.person.sameAs).toHaveLength(7);
  });

  test('Person: Research Assistant at BAU; Ideatrium a separate organisation the person founded', () => {
    const { person } = site;
    expect(person.jobTitle).toBe('Research Assistant');
    expect(person.affiliation.name).toBe('Bangladesh Agricultural University');
    expect(JSON.stringify(person.affiliation)).not.toContain('Ideatrium');
    expect(person.worksFor).toEqual({
      '@type': 'Organization',
      name: 'Ideatrium',
      founder: { '@type': 'Person', name: 'Rasel Al Mamun' },
    });
    expect(html('index.html')).toContain('"worksFor":{"@type":"Organization","name":"Ideatrium"');
  });

  test('hero eyebrow (desktop and mobile), role line, footer role line', () => {
    const home = html('index.html');
    expect(home).toMatch(/d-md-none"\s*>Founder, Ideatrium · Research Assistant, BAU<\/span/);
    expect(home).toContain(`>${PHASE_1}</span>`);
    expect(home).toContain('Agricultural engineer · Researcher · Software developer</p>');
    expect(home.split('Agricultural engineer · Researcher · Software developer')).toHaveLength(3);
    expect(html('blog-post.html')).toContain(`<p class="author-role mb-0">${PHASE_1}</p>`);
  });

  test('drawer, projects archive and project page labels', () => {
    for (const file of pages) {
      expect(html(file), file).toContain('Agri engineering · Tech review · Education');
    }
    expect(html('research.html')).toMatch(/<title>Projects — Ideatrium<\/title>/);
    expect(html('research.html')).toContain('<h1 class="mb-0">Projects</h1>');
    expect(html('portfolio-entry.html')).toContain('aria-label="More projects"');
    expect(html('portfolio-entry.html')).not.toContain('More research projects');
  });

  test('no footer AI-portrait note, and no flag for one (S1)', () => {
    expect(content.footer.ai_portrait_shown).toBeUndefined();
    for (const file of pages) expect(html(file), file).not.toContain('footer-ai-note');
  });

  test('every Home field target is a real page or anchor', () => {
    for (const field of content.fields) {
      const [file, hash] = field.target.split('#');
      const target = html(file);
      if (hash) expect(target, field.target).toMatch(new RegExp(`id="${hash}"`));
    }
  });
});

test.describe('browser', () => {
  test('Portfolio top: statement under the summary line, whole, at 320, 390 and 1440 px', async ({
    page,
  }) => {
    for (const width of [320, 390, 1440]) {
      for (const scheme of ['dark', 'light']) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.addInitScript((theme) => localStorage.setItem('theme', theme), scheme);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(pagePath('portfolio.html'));
        const statement = page.locator('.pf-statement');
        await expect(statement).toHaveText(content.profile.statement);
        const summary = page.locator('.pf-summary');
        const [s, t] = await Promise.all([summary.boundingBox(), statement.boundingBox()]);
        expect(t.y, `${width}px ${scheme}`).toBeGreaterThan(s.y + s.height - 1);
        // Neither text is clamped or clipped.
        for (const locator of [summary, statement]) {
          const fits = await locator.evaluate(
            (el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1,
          );
          expect(fits, `${width}px`).toBe(true);
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        ).toBeLessThanOrEqual(0);
      }
    }
  });

  test('Portfolio: three roles in order, the sub-heading "Experience"', async ({ page }) => {
    await page.goto(pagePath('portfolio.html'));
    const section = page.locator('#experience');
    await expect(section.getByRole('heading', { level: 3 })).toHaveText([
      'Experience',
      'Education',
    ]);
    await expect(section.locator('article.pf-entry h4')).toHaveText([
      'Founder',
      'Research Assistant',
      'Undergraduate researcher',
    ]);
    // Ideatrium has no unit line: only the institution.
    await expect(
      section.locator('article.pf-entry').first().locator('.pf-entry-sub span'),
    ).toHaveText(['Ideatrium']);
  });

  test('the Home field list: six areas with their icons', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(pagePath('index.html'));
    await expect(page.locator('.screen2-grid .area-label')).toHaveText(
      content.fields.map((f) => f.label),
    );
    await expect(page.locator('.screen2-grid .area svg')).toHaveCount(6);
  });

  test('formula, table and code boxes are keyboard-scrollable, named, with a visible focus ring', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(pagePath('blog-post.html'));
    const boxes = page.locator(
      '.rt-math-display, .rt-table-scroll, .rt-content pre, .prose-code, .prose-table',
    );
    const count = await boxes.count();
    expect(count).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < count; i += 1) {
      const box = boxes.nth(i);
      await expect(box).toHaveAttribute('tabindex', '0');
      await expect(box).toHaveAttribute('role', 'region');
      await expect(box).toHaveAttribute(
        'aria-label',
        /^(Formula|Code block|Table) \d+, scrollable$/,
      );
    }
    await expect(page.locator('.rt-math-display')).toHaveAttribute(
      'aria-label',
      'Formula 1, scrollable',
    );
    await expect(page.locator('.rt-table-scroll')).toHaveAttribute(
      'aria-label',
      'Table 1, scrollable',
    );
    // Keyboard focus draws the ring.
    const first = boxes.first();
    await first.scrollIntoViewIfNeeded();
    await page.keyboard.press('Tab');
    await first.focus();
    await expect(first).toBeFocused();
    const outline = await first.evaluate((el) => {
      const cs = getComputedStyle(el);
      return [cs.outlineStyle, parseFloat(cs.outlineWidth)];
    });
    expect(outline[0]).not.toBe('none');
    expect(outline[1]).toBeGreaterThanOrEqual(2);
  });
});

test('no line of a role line, eyebrow or author line starts with "·" (320 and 390 px)', async ({
  page,
}) => {
  for (const [file, selector] of [
    ['index.html', '.hero-role'],
    ['index.html', '.hero-eyebrow span:visible'],
    ['index.html', '.footer-role'],
    ['portfolio.html', '.pf-role'],
    ['portfolio.html', '.pf-location span'],
    ['blog-post.html', '.author-role'],
  ]) {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(pagePath(file));
      const starts = await page
        .locator(selector)
        .first()
        .evaluate((el) => {
          const box = el.getBoundingClientRect();
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let bad = 0;
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            [...node.data].forEach((ch, i) => {
              if (ch !== '·') return;
              const range = document.createRange();
              range.setStart(node, i);
              range.setEnd(node, i + 1);
              if (range.getBoundingClientRect().left < box.left + 6) bad += 1;
            });
          }
          return bad;
        });
      expect(starts, `${file} ${selector} at ${width}px`).toBe(0);
    }
  }
});
