// Author: Rasel Al Mamun
// Content gates (FD-19, FD-23): tools/validate-content.mjs and tools/check-privacy.mjs
// catch every case they promise to. Node-only; no browser page is opened.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { scanText } from '../tools/check-privacy.mjs';
import { buildSite, loadContent } from '../tools/content.mjs';
import { missingImages, validateContent } from '../tools/validate-content.mjs';

// Invented numbers in the shape of real ones; none of them belongs to anybody.
const leaks = {
  'international phone': 'Call +880 1700-000000 any time',
  'local mobile': 'Mobile 01700000000',
  'local mobile with spaces': 'Mobile 01900 000 000',
  'long digit run': 'Ref 1234 5678 90',
  'tel: link': '<a href="tel:0000">Call</a>',
  'date of birth label': 'Date of birth: 1 January 2000',
  'dob key': '{ "dob": "2000-01-01" }',
  'father label': "Father's name: [name]",
  'mother label': '<dt>Mother</dt><dd>[name]</dd>',
  'religion label': '| Religion | [x] |',
  'blood group key': '{ "blood_group": "[x]" }',
  'marital status label': 'Marital status: [x]',
  'cgpa label': 'CGPA: 0.00',
  'gpa key': "{ 'gpa': 0 }",
  'referee label': 'Referee: [name]',
  'reference contact label': 'Reference contact: [x]',
  'permanent address label': '<th>Permanent address</th>',
};

for (const [name, text] of Object.entries(leaks)) {
  test(`check-privacy catches a ${name}`, () => {
    expect(scanText(text, [])).not.toEqual([]);
  });
}

test('check-privacy passes DOIs, profile ids and prose about the rule', () => {
  const allowed = ['0009-0007-7826-710X', '59354503700'];
  const fine = [
    'https://doi.org/10.1016/j.atech.2025.100773',
    'https://orcid.org/0009-0007-7826-710X',
    'https://www.scopus.com/authid/detail.uri?authorId=59354503700',
    'Never publish phone numbers, date of birth, religion, blood group or referees.',
    'References available on request.',
    'January 2022 – April 2023',
  ];
  for (const text of fine) expect(scanText(text, allowed), text).toEqual([]);
});

test('the real content is valid', () => {
  expect(validateContent(loadContent())).toEqual([]);
});

test('validate-content accepts optional project images and rejects bad ones', () => {
  const content = structuredClone(loadContent());
  const image = { src: '/images/projects/x.webp', alt: '[alt]', width: 1200, height: 800 };
  content.projects[0].image = { ...image, avif: '/images/projects/x.avif' };
  content.projects[0].gallery = [image, image];
  expect(validateContent(content)).toEqual([]);

  content.projects[1].image = { src: 'https://example.com/x.jpg', alt: '', width: 0 };
  content.projects[3].image = { ...image, src: '/images/../secret.webp' };
  content.projects[2].gallery = [];
  // The files do not exist, so the build check reports them (src and avif, twice in gallery).
  expect(missingImages(content).length).toBeGreaterThan(0);
  expect(missingImages(loadContent())).toEqual([]);

  const problems = validateContent(content).join('\n');
  expect(problems).toContain('projects[1]: invalid "image"');
  expect(problems).toContain('projects[2]: invalid "gallery"');
  expect(problems).toContain('projects[3]: invalid "image"');
});

test('validate-content catches broken records', () => {
  const content = structuredClone(loadContent());
  const [first, second] = content.publications;
  first.doi = 'doi:10.1/x';
  first.year = '2026';
  first.type = 'poster';
  first.project = 'no-such-project';
  second.authors.forEach((author) => delete author.me);
  content.projects[1].id = content.projects[0].id;
  delete content.awards[0].title;

  const problems = validateContent(content).join('\n');
  expect(problems).toContain('invalid "doi"');
  expect(problems).toContain('invalid "year"');
  expect(problems).toContain('invalid "type"');
  expect(problems).toContain('missing "title"');

  // Reference and author checks run once every record has the right shape.
  const shaped = structuredClone(loadContent());
  shaped.publications[0].project = 'no-such-project';
  shaped.publications[1].authors.forEach((author) => delete author.me);
  shaped.projects[1].id = shaped.projects[0].id;
  const refs = validateContent(shaped).join('\n');
  expect(refs).toContain('unknown project "no-such-project"');
  expect(refs).toContain('0 authors with "me": true');
  expect(refs).toContain(`duplicate id "${shaped.projects[0].id}"`);
});

test('validate-content checks blog posts (FD-36, FD-37)', () => {
  const content = structuredClone(loadContent());
  content.blog[0].category = 'no-such-category';
  content.blog[1].status = 'published';
  content.blog[2].status = 'review';
  const problems = validateContent(content).join('\n');
  expect(problems).toContain('invalid "status"');

  const shaped = structuredClone(loadContent());
  shaped.blog[0].category = 'no-such-category';
  shaped.blog[1].status = 'published';
  shaped.blog[1].standfirst = '[Standfirst — to be written]';
  shaped.blog[2].slug = shaped.blog[0].slug;
  const refs = validateContent(shaped).join('\n');
  expect(refs).toContain('unknown category "no-such-category"');
  expect(refs).toContain('published without a "date"');
  expect(refs).toContain('published with a [bracketed] standfirst');
  expect(refs).toContain(`duplicate slug "${shaped.blog[0].slug}"`);

  const ready = structuredClone(loadContent());
  Object.assign(ready.blog[1], { status: 'published', date: '2026-11-01', standfirst: 'Text.' });
  expect(validateContent(ready)).toEqual([]);
});

test('validate-content checks the Home block (FD-44)', () => {
  const content = structuredClone(loadContent());
  content.home.ctas[0].variant = 'tertiary';
  delete content.home.fork.blog.tags;
  content.meta.home = '';
  const problems = validateContent(content).join('\n');
  expect(problems).toContain('home: invalid "ctas"');
  expect(problems).toContain('home: invalid "fork"');
  expect(problems).toContain('meta: invalid "home"');

  const renamed = structuredClone(loadContent());
  renamed.home.hero_name_lines = ['Rasel', 'Mamun'];
  expect(validateContent(renamed)).toContain('home: "hero_name_lines" do not spell profile.name');
});

test('validate-content checks the Home short forms and order of featured work (FD-90)', () => {
  const content = structuredClone(loadContent());
  const featured = content.projects.filter((project) => project.featured);
  delete featured[0].featured_order;
  featured[1].featured_order = featured[2].featured_order;
  const problems = validateContent(content).join('\n');
  expect(problems).toContain(`projects "${featured[0].id}": featured without "featured_order"`);
  expect(problems).toContain('projects: featured_order must be 1 … 3');

  // FD-115: every project, featured or not, has its short forms.
  const short = structuredClone(loadContent());
  delete short.projects[0].short_title;
  expect(validateContent(short)).toContain('projects[0]: missing "short_title"');

  const wrong = structuredClone(loadContent());
  wrong.projects.find((project) => project.featured).short_summary = '';
  expect(validateContent(wrong).join('\n')).toContain('invalid "short_summary"');
});

test('validate-content keeps featured_tags a subset of the tags', () => {
  const content = structuredClone(loadContent());
  const project = content.projects.find((p) => p.featured_tags);
  project.featured_tags = [...project.featured_tags, 'Invented'];
  expect(validateContent(content)).toContain(
    `projects "${project.id}": featured_tags not in tags: Invented`,
  );
  const unfeatured = structuredClone(loadContent());
  const other = unfeatured.projects.find((p) => !p.featured);
  other.featured_tags = [other.tags[0]];
  expect(validateContent(unfeatured)).toContain(
    `projects "${other.id}": featured_tags but not featured`,
  );
});

test('validate-content requires one large featured card with its role line (FD-102)', () => {
  const content = structuredClone(loadContent());
  expect(validateContent(content)).toEqual([]);
  const large = content.projects.find((project) => project.featured_large);
  delete large.featured_role_line;
  expect(validateContent(content)).toContain(
    `projects "${large.id}": featured_large without "featured_role_line"`,
  );
  const two = structuredClone(loadContent());
  two.projects.find((project) => project.featured && !project.featured_large).featured_large = true;
  expect(validateContent(two).join('\n')).toContain(
    'exactly one featured project must be featured_large, got 2',
  );
  const noEyebrow = structuredClone(loadContent());
  delete noEyebrow.home.selected.large_eyebrow;
  expect(validateContent(noEyebrow).join('\n')).toContain('home: invalid "selected"');
});

test('validate-content keeps the Areas of work plain text (FD-87)', () => {
  const content = structuredClone(loadContent());
  content.home.screen2.areas_interactive = true;
  expect(validateContent(content)).toContain(
    `home: invalid "screen2": ${JSON.stringify(content.home.screen2)}`,
  );
});

test('validate-content requires the Areas-of-work index flag (FD-99)', () => {
  const content = structuredClone(loadContent());
  expect(content.home.screen2.areas_show_index).toBe(false);
  delete content.home.screen2.areas_show_index;
  expect(validateContent(content)).toContain(
    `home: invalid "screen2": ${JSON.stringify(content.home.screen2)}`,
  );
});

// FD-109: pages show display_details; details stays for Django.
test('FD-109: display_details on the two ASABE papers, details kept, files agree', () => {
  const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
  const content = loadContent();
  expect(content.publications).toEqual(read('docs/content/public-content.json').publications);
  const short = content.publications.filter((pub) => 'display_details' in pub);
  expect(short.map((pub) => [pub.id, pub.display_details])).toEqual([
    ['aim-2026-poultry-aiot', ''],
    ['aim-2026-solar-pump-ai', ''],
  ]);
  for (const pub of short) expect(pub.details).toMatch(/^p\. 1\. American Society/);
  const bad = structuredClone(content);
  bad.publications[0].display_details = 3;
  expect(validateContent(bad).join('\n')).toContain('invalid "display_details"');
});

// The Portfolio block (FD-107, FD-108).
test.describe('FD-108: Portfolio content', () => {
  const read = (path) => JSON.parse(readFileSync(path, 'utf8'));

  test('src/content equals the approved content and public-content.json', () => {
    const approved = read('docs/content/portfolio-content.json');
    const content = loadContent();
    expect(content.portfolio).toEqual(approved.portfolio);
    expect(read('docs/content/public-content.json').portfolio).toEqual(approved.portfolio);
    // Biofloc gains the "Automation" tag, shown on its cards.
    for (const projects of [content.projects, read('docs/content/public-content.json').projects]) {
      const biofloc = projects.find((p) => p.id === 'biofloc-iot');
      expect(biofloc.tags).toContain('Automation');
      expect(biofloc.featured_tags).toEqual(
        approved.project_tag_updates['biofloc-iot'].featured_tags,
      );
    }
    // The rest of public-content.json is src/content, file by file.
    const pub = read('docs/content/public-content.json');
    expect(content.projects).toEqual(pub.projects);
    expect(content.awards).toEqual(pub.awards);
    expect(content.skills).toEqual(pub.skills);
  });

  test('the award title, the counts and the "View all" labels come from the data', () => {
    const site = buildSite();
    expect(site.portfolio.awards.items[0].title).toBe('Agricultural Machinery Talent Hunt Award');
    expect(site.portfolioView.counts.map((c) => [c.key, c.value])).toEqual([
      ['publications', 8],
      ['projects', 15],
      ['awards', 6],
    ]);
    expect(site.portfolioView.publicationsCta).toBe('View all 8 publications');
    expect(site.portfolioView.projectsCta).toBe('View all 15 research projects');
    expect(site.portfolioView.publications.map((p) => p.id)).toEqual(
      site.portfolio.publications.order,
    );
    expect(site.portfolioView.projects.map((p) => p.id)).toEqual(site.portfolio.projects.order);
    expect(site.portfolioView.allProjects).toHaveLength(15);
  });

  test('no MATLAB, LaTeX or Makeathon in the content or the built pages', () => {
    const removed = /\b(?:MATLAB|LaTeX|Makeathon)\b/i;
    const files = [
      ...readdirSync('src/content')
        .filter((f) => f.endsWith('.json'))
        .map((f) => `src/content/${f}`),
      'docs/content/public-content.json',
      ...readdirSync('dist')
        .filter((f) => f.endsWith('.html'))
        .map((f) => `dist/${f}`),
    ];
    for (const file of files) expect(readFileSync(file, 'utf8'), file).not.toMatch(removed);
  });

  test('validate-content checks the Portfolio block', () => {
    const content = structuredClone(loadContent());
    expect(validateContent(content)).toEqual([]);
    const { portfolio } = content;
    portfolio.publications.order = ['das-2025-fish-feed', 'no-such-paper'];
    portfolio.projects.order.push('no-such-project');
    portfolio.projects.role_lines['no-such-project'] = 'Team';
    portfolio.awards.items[0].title = 'Agricultural Machinery Makeathon Award';
    const problems = validateContent(content).join('\n');
    expect(problems).toContain('"das-2025-fish-feed" is not a first-author paper');
    expect(problems).toContain('unknown publication "no-such-paper"');
    expect(problems).toContain('unknown project "no-such-project"');
    expect(problems).toContain('is not in awards.json');
    expect(problems).toContain('"Makeathon" was removed from the site');

    const shaped = structuredClone(loadContent());
    shaped.portfolio.expertise.groups[0].icon = 'rocket';
    shaped.portfolio.profile.section_nav[0].href = '#nowhere';
    shaped.portfolio.publications.cta = 'View all publications';
    const shape = validateContent(shaped).join('\n');
    expect(shape).toContain('portfolio: invalid "expertise"');
    expect(shape).toContain('portfolio: invalid "profile"');
    expect(shape).toContain('portfolio: invalid "publications"');

    const skill = structuredClone(loadContent());
    skill.skills[0].items.push('MATLAB');
    expect(validateContent(skill).join('\n')).toContain('"MATLAB" was removed');
  });
});

// FD-128: the design tokens live in src/design/tokens.json; the generated _tokens.scss
// carries every value from there, so the build needs no other design file.
test('FD-128: _tokens.scss is generated from src/design/tokens.json', () => {
  const tokens = JSON.parse(readFileSync('src/design/tokens.json', 'utf8'));
  const scss = readFileSync('src/scss/base/_tokens.scss', 'utf8');
  expect(readFileSync('tools/tokens.mjs', 'utf8')).toContain(
    "const source = 'src/design/tokens.json';",
  );
  expect(scss).toContain('// Generated by tools/tokens.mjs from src/design/tokens.json.');
  const cssValue = (value) => value.replace(/^\{([\w-]+)\}$/, 'var(--$1)');
  for (const token of [...tokens.color.tokens, ...tokens.shadow.tokens]) {
    expect(scss).toContain(`  --${token.name}: ${cssValue(token.value.dark)};`);
    expect(scss).toContain(`  --${token.name}: ${cssValue(token.value.light)};`);
  }
  for (const group of ['spacing', 'radius', 'duration', 'easing', 'motionscale']) {
    for (const token of tokens[group].tokens) {
      expect(scss).toContain(`  --${token.name}: ${token.value};`);
    }
  }
});

// FD-130: the subset fonts stay within the 160 KB budget (FD-14) and keep every character the
// built site uses; a new character means running tools/subset-fonts.mjs again.
test('FD-130: subset fonts within 160 KB and covering every character of the site', async () => {
  const { siteCharacters, subsetList } = await import('../tools/subset-fonts.mjs');
  const fonts = readdirSync('src/fonts').filter((file) => file.endsWith('.woff2'));
  expect(fonts.sort()).toEqual([
    'bricolage-grotesque-latin-standard-normal.woff2',
    'jetbrains-mono-latin-400-normal.woff2',
    'jetbrains-mono-latin-500-normal.woff2',
  ]);
  const total = fonts.reduce((sum, file) => sum + statSync(`src/fonts/${file}`).size, 0);
  expect(total).toBeLessThanOrEqual(160_000);
  const kept = new Set(JSON.parse(readFileSync(subsetList, 'utf8')).codePoints);
  const missing = [...siteCharacters()].filter((character) => !kept.has(character.codePointAt(0)));
  expect(missing).toEqual([]);
});
