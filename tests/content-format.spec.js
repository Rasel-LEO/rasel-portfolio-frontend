// Author: Rasel Al Mamun
// The content format of 1.7.0: the card limits of the validator, the figure markers, the Gallery
// that is gone, and the hidden page staying out of the menu, the sitemap and the export.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { buildSite, loadContent, loadPostBodies } from '../tools/content.mjs';
import { renderMarkdown } from '../tools/markdown.mjs';
import { contentWarnings, validateContent } from '../tools/validate-content.mjs';

const fresh = () => structuredClone(loadContent());
const bodies = () => loadPostBodies(loadContent().blog);
const large = (content) => content.projects.find((project) => project.featured_large);
const small = (content) => content.projects.find((project) => !project.featured_large);
const problems = (content, texts = bodies()) => validateContent(content, texts).join('\n');
const withFigures = (content) => content.projects.find((project) => project.detail?.figures);

test('the trial content is valid', () => {
  expect(validateContent(fresh(), bodies())).toEqual([]);
});

test('card limits: titles, descriptions and role lines fail past their hard limit', () => {
  const checks = [
    [large, 'short_title', 56, /large card title is 56 characters \(max 55\)/],
    [small, 'short_title', 41, /small card title is 41 characters \(max 40\)/],
    [large, 'card_description', 141, /large card description is 141 characters \(max 140\)/],
    [small, 'card_description', 101, /small card description is 101 characters \(max 100\)/],
    [large, 'role_line', 51, /role line is 51 characters \(max 50\)/],
  ];
  for (const [pick, key, length, expected] of checks) {
    const content = fresh();
    pick(content)[key] = 'x'.repeat(length);
    expect(problems(content), key).toMatch(expected);
    const edge = fresh();
    pick(edge)[key] = 'x'.repeat(length - 1);
    expect(problems(edge), key).not.toMatch(expected);
  }
  const post = fresh();
  post.blog[0].title = 'x'.repeat(81);
  post.blog[0].card_description = 'x'.repeat(111);
  expect(problems(post)).toMatch(/title is 81 characters \(max 80\)/);
  expect(problems(post)).toMatch(/card description is 111 characters \(max 110\)/);
});

test('card tags: exactly three, all from the labels', () => {
  for (const tags of [
    ['IoT', 'Poultry'],
    ['IoT', 'Poultry', 'Sensors', 'Control systems'],
  ]) {
    const content = fresh();
    small(content).card_tags = tags;
    expect(problems(content)).toContain('card_tags');
  }
  const content = fresh();
  small(content).card_tags = ['IoT', 'Poultry', 'Not a label'];
  expect(problems(content)).toMatch(/card_tags not in tags: Not a label/);
});

test('every image needs alt text and a card image is 1600 × 900', () => {
  const noAlt = fresh();
  noAlt.projects[0].card_image.alt = '';
  expect(problems(noAlt)).toContain('card_image');
  const wrongSize = fresh();
  wrongSize.blog[0].card_image.height = 800;
  expect(problems(wrongSize)).toContain('card_image');
  const figure = fresh();
  figure.blog[0].figures[0].alt = '';
  expect(problems(figure)).toContain('figures');
});

test('figures: a caption is required and markers and entries match both ways', () => {
  const caption = fresh();
  delete caption.blog[0].figures[0].caption;
  expect(problems(caption)).toContain('figures');

  const noEntry = fresh();
  const slug = noEntry.blog[0].slug;
  const texts = { ...bodies(), [slug]: `${bodies()[slug]}\n\n[Figure 9]\n` };
  expect(problems(noEntry, texts)).toMatch(/\[Figure 9\] has no figure entry/);

  const noMarker = fresh();
  noMarker.blog[0].figures.push({ ...noMarker.blog[0].figures[0], n: 7 });
  expect(problems(noMarker)).toMatch(/figure 7 has no \[Figure 7\] marker/);

  const project = fresh();
  withFigures(project).detail.methods += '\n\n[Figure 5]';
  expect(problems(project)).toMatch(/\[Figure 5\] has no figure entry/);

  const order = fresh();
  const { detail } = withFigures(order);
  detail.figures.reverse();
  for (const key of ['overview', 'methods', 'results_text']) {
    detail[key] = detail[key]?.replace('[Figure 1]', '[Figure 3]');
  }
  expect(problems(order)).toMatch(/must run 1, 2, 3/);
});

test('soft limits warn and do not fail', () => {
  const content = fresh();
  small(content).short_title = 'Two words';
  small(content).card_description = 'Too short.';
  const warnings = contentWarnings(content, bodies()).join('\n');
  expect(warnings).toContain('card title under 3 words');
  expect(warnings).toContain('card description under 10 words');
  expect(problems(content)).toBe('');
});

test('the Gallery and the old card fields are gone', () => {
  for (const key of [
    'gallery',
    'cover',
    'image',
    'short_summary',
    'featured_tags',
    'featured_role_line',
  ]) {
    const content = fresh();
    content.projects[0][key] = key === 'gallery' ? [] : 'x';
    expect(problems(content), key).toContain(`"${key}" no longer exists`);
  }
  expect(readFileSync('src/scss/pages/_pages.scss', 'utf8')).not.toContain('.gallery');
  expect(readFileSync('src/pages/portfolio-entry.html', 'utf8')).not.toMatch(/gallery/i);
  for (const file of readdirSync('dist').filter((name) => name.startsWith('project-'))) {
    expect(readFileSync(join('dist', file), 'utf8'), file).not.toMatch(/gallery/i);
  }
});

test('Markdown figures: numbered by position, whole image, caption, three sizes', () => {
  const figures = ['narrow', 'normal', 'wide'].map((size, i) => ({
    n: i + 1,
    src: `/images/x${i}.webp`,
    avif: `/images/x${i}.avif`,
    alt: `Alt ${i + 1}`,
    width: 1200,
    height: 600,
    caption: `Caption <${i + 1}>`,
    size,
  }));
  const html = renderMarkdown('Text.\n\n[Figure 2]\n\nMore.\n\n[Figure 1]\n\n[Figure 3]\n', {
    figures,
  });
  // Numbered by position on the page, not by the marker; the caption is escaped.
  expect(html).toContain('<span class="fig-label">Figure 1.</span> Caption &lt;2&gt;');
  expect(html).toContain('<span class="fig-label">Figure 2.</span> Caption &lt;1&gt;');
  expect(html).toContain('class="fig fig-wide"');
  expect(html).toContain('class="fig fig-narrow"');
  expect(html).toContain('width="1200" height="600" loading="lazy"');
  expect(html).not.toContain('View full size');
  expect(() => renderMarkdown('[Figure 4]', { figures })).toThrow(/no figure entry/);
});

test('a project page numbers its figures through Overview, Methods and Results', () => {
  const project = buildSite().projectList.find((entry) => entry.detail?.figures);
  const all = Object.values(project.text).join('');
  const numbers = [...all.matchAll(/Figure (\d+)\.<\/span>/g)].map((m) => Number(m[1]));
  expect(numbers).toEqual(project.detail.figures.map((_, i) => i + 1));
});

test('the share image is named for its page; the hidden page is in no menu, sitemap or export', () => {
  const site = buildSite();
  const [project] = site.projectList;
  const [post] = site.postList;
  expect(project.shareImage).toBe(`/images/share/project-${project.id}.jpg`);
  expect(post.shareImage).toBe(`/images/share/post-${post.slug}.jpg`);
  expect(existsSync(join('dist', project.shareImage.slice(1)))).toBe(true);
  const config = readFileSync('vite.config.js', 'utf8');
  expect(config).toContain("hiddenPages = new Set(['format-test.html'])");
  expect(config).toMatch(/!hiddenPages\.has\(file\)/);
  for (const partial of ['header', 'drawer', 'footer']) {
    expect(readFileSync(`src/partials/shell/${partial}.hbs`, 'utf8')).not.toContain('format-test');
  }
  // The export leaves the page and its test out (the script is not in the public copy).
  const exportTool = join('tools', ['export', 'public'].join('-') + '.mjs');
  test.skip(!existsSync(exportTool), 'the export script is not part of the public copy');
  const exporter = readFileSync(exportTool, 'utf8');
  expect(exporter).toContain("'src/pages/format-test.html'");
  expect(exporter).toContain("'tests/format-test.spec.js'");
});
