// Author: Rasel Al Mamun
// Validates src/content/*.json (FD-19) before every build: required fields per type,
// unique ids, publication → project references, DOI format, numeric years, publication
// type, exactly one `me: true` author per publication; blog posts (FD-36, FD-37): known
// category, draft/published status, unique slugs, a Markdown body per post; the Blog,
// Hire me, Contact, meta and Home blocks; the Portfolio block (FD-107, FD-108). Plain checks,
// no schema library. 1.7.4 (F03, F10): every documented limit of tools/limits.mjs — page titles,
// search descriptions, the § 14.1 slot maxima and list counts — and no [bracketed] placeholder
// anywhere in a published post's standfirst or body.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildSite, cardVariants, loadContent, loadPostBodies, postSource } from './content.mjs';
import {
  CARD_LIMITS as LIMITS,
  DESCRIPTION_MAX,
  LIST_MAX,
  MANY,
  MAX,
  TITLE_MAX,
  pageTitle,
  placeholders,
} from './limits.mjs';
import { FIGURE_SIZES, figureMarkers, isBracketed } from './markdown.mjs';

// The list maxima live in tools/limits.mjs (shared with tests/slots.spec.js).
export { LIST_MAX };

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const DOI = /^10\.\d{4,9}\/\S+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLICATION_TYPES = ['journal', 'conference'];
const PROJECT_STATUSES = [null, 'in-progress', 'done', 'planned'];
const POST_STATUSES = ['draft', 'published'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isTextList = (value) => Array.isArray(value) && value.length > 0 && value.every(isText);
// A list of records that each pass `check`.
const isListOf = (check) => (value) =>
  Array.isArray(value) && value.length > 0 && value.every((item) => item && check(item));
const isStep = (v) => /^\d{2}$/.test(v.n) && isText(v.title);
const CTA_VARIANTS = ['primary', 'secondary', 'secondary-small'];
// 1.7.1: the twelve icons added to the area, topic and expertise sets (not used by the content yet).
export const ADDED_ICONS = [
  'briefcase',
  'handshake',
  'government',
  'chart-up',
  'team',
  'graduation',
  'book',
  'globe',
  'bulb',
  'megaphone',
  'shield',
  'heart',
];
// The in-house line icons of the Areas-of-work grid (FD-84, src/partials/icons/area-icon.hbs).
export const AREA_ICONS = [
  'sprout',
  'network',
  'camera',
  'tractor',
  'code',
  'document',
  'chip',
  'gear',
  ...ADDED_ICONS,
];
const isPillar = (v) => isText(v?.label) && isTextList(v.lines) && isText(v.href);

// Portfolio (FD-107, FD-108): in-house line icons (src/partials/icons/pf-icon.hbs), the section ids
// the profile's section nav may link to, and the counts the profile may show.
// 1.7.1: star and certificate join the award set, the twelve added icons the expertise set.
export const AWARD_ICONS = ['trophy', 'medal', 'ribbon', 'star', 'certificate'];
export const EXPERTISE_ICONS = ['chip', 'network', 'code', 'gear', ...ADDED_ICONS];
const PORTFOLIO_SECTIONS = ['#publications', '#research', '#awards', '#experience', '#expertise'];
const PORTFOLIO_COUNTS = ['publications', 'projects', 'awards'];
// FD-108: removed from the site; never shown again.
const REMOVED_TERMS = /\b(?:MATLAB|LaTeX|Makeathon)\b/i;
// FD-113, FD-115, FD-116: the in-house line drawings of src/partials/icons/illustration.hbs
// (post covers) and src/partials/icons/line-icon.hbs (system steps, results, topics).
export const COVER_ILLUSTRATIONS = [
  'sensor-node',
  'two-boards',
  'notebook-journal',
  'disconnected-node',
];
export const SYSTEM_ICONS = [
  'tank',
  'dashboard',
  'relay',
  'soil',
  'pump',
  'monitor',
  'gear',
  'sun',
];
// FD-159: the project-topic icon keys Django offers (the last one, "general", is also the fallback).
export const TOPIC_ICONS = [
  'hen',
  'fish',
  'sun-water',
  'tractor',
  'leaf',
  'greenhouse',
  'software',
  'web',
  'mobile',
  'ai',
  'robotics',
  'data',
  'cloud',
  'security',
  'energy',
  'water',
  'environment',
  'health',
  'education',
  'research',
  'hardware',
  'automation',
  'iot',
  // 1.7.1: the twelve added keys.
  ...ADDED_ICONS,
  'general',
];
// A real photograph (FD-35): WebP under /images/, optional AVIF twin, alt text, intrinsic size,
// optional caption (a figure). The files must exist: see missingImages().
const IMAGE_PATH = /^\/images\/(?:[\w-]+\/)*[\w-]+(?:\.[\w-]+)*\.(?:webp|avif)$/;
const isImage = (v) =>
  v !== null &&
  typeof v === 'object' &&
  IMAGE_PATH.test(v.src) &&
  v.src.endsWith('.webp') &&
  (v.avif === undefined || (IMAGE_PATH.test(v.avif) && v.avif.endsWith('.avif'))) &&
  isText(v.alt) &&
  Number.isInteger(v.width) &&
  v.width > 0 &&
  Number.isInteger(v.height) &&
  v.height > 0 &&
  (v.caption === undefined || isText(v.caption)) &&
  // FD-160: responsive candidates of an uploaded cover ("url 480w, url 960w").
  (v.srcset === undefined || isText(v.srcset)) &&
  (v.avif_srcset === undefined || isText(v.avif_srcset));

// 1.7.0: the card image of a project or post is 1600 × 900 (16:9), with alt text; Home cards, lists
// and the page top crop it with object-fit: cover, so the subject sits in the centre band.
const isCardImage = (v) => isImage(v) && v.width === 1600 && v.height === 900;
// A figure in the text: an image with its number on the page, a caption (required) and a size.
const isFigure = (v) =>
  isImage(v) &&
  Number.isInteger(v.n) &&
  v.n > 0 &&
  isText(v.caption) &&
  FIGURE_SIZES.includes(v.size);

// A project's detail (FD-116): every block optional — a page shows only the blocks that exist —
// but each one well-formed when present.
const isIconStep = (v) => SYSTEM_ICONS.includes(v?.icon) && isText(v.title) && isText(v.text);
const DETAIL = {
  // 1.7.0: Overview, Methods, Results and Limitations are Markdown; a line "[Figure n]" puts figure
  // n of `figures` there (checked in checkFigures).
  'methods*': isText,
  'results_text*': isText,
  'limitations*': isText,
  'figures*': (v) => Array.isArray(v) && v.length > 0 && v.every(isFigure),
  'summary_line*': isText,
  'facts*': (v) =>
    v !== null &&
    typeof v === 'object' &&
    Object.keys(v).length > 0 &&
    Object.entries(v).every(
      ([key, value]) =>
        ['role', 'institution', 'unit', 'technology', 'output'].includes(key) && isText(value),
    ),
  'system*': (v) => isListOf(isIconStep)(v) && v.length === 3,
  'system_note*': isText,
  'overview*': isText,
  'contribution*': isTextList,
  'results*': isListOf(isIconStep),
  'context*': (v) => v === null || isText(v),
};
const isDetail = (v) =>
  v !== null &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length > 0 &&
  Object.keys(v).every((key) => `${key}*` in DETAIL) &&
  Object.entries(v).every(([key, value]) => DETAIL[`${key}*`](value)) &&
  // The note belongs to the diagram.
  (!('system_note' in v) || 'system' in v);
const isHead = (v) => isText(v?.eyebrow) && isText(v.heading) && isText(v.intro);
const isViewAll = (v) => isText(v) && v.includes('{count}');

// The soft limits: a warning, not a failure (fewer words than this reads as thin).
const MIN_WORDS = {
  title: { large: 4, small: 3 },
  description: { large: 15, small: 10 },
  blogTitle: 8,
  blogDescription: 10,
};
// Fields of earlier releases that no longer exist; content that still has them fails, so no
// Gallery, cover drawing or per-list role line quietly comes back.
const REMOVED_PROJECT_FIELDS = [
  'gallery',
  'cover',
  'image',
  'short_summary',
  'featured_tags',
  'featured_role_line',
];
const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;

// Markdown bodies missing from src/content/posts/ (FD-37).
function missingPosts(content) {
  return content.blog
    .filter((post) => !existsSync(postSource(post.slug)))
    .map((post) => `blog "${post.slug}": src/content/posts/${post.slug}.md not found`);
}

// Image files named in projects.json and blog.json that are not in src/images/ (Vite would only warn).
export function missingImages(content, srcDir = join(root, 'src')) {
  const files = (owner, where, images) =>
    images
      .filter(Boolean)
      .flatMap((image) => [image.src, image.avif].filter(Boolean))
      .filter((path) => !existsSync(join(srcDir, path)))
      .map((path) => `${where} "${owner}": image file not found: src${path}`);
  return [
    ...content.projects.flatMap((project) =>
      files(project.id, 'projects', [project.card_image, ...(project.detail?.figures ?? [])]),
    ),
    ...content.blog.flatMap((post) =>
      files(post.slug, 'blog', [post.card_image, ...(post.figures ?? [])]),
    ),
  ];
}

// The figure markers of the text blocks (in page order) against the figure entries: every
// "[Figure n]" has its entry and every entry its marker, once each, and the markers run 1, 2, 3 … in
// the order they appear (the page numbers figures by position, so the numbers agree).
function checkFigures(problems, where, texts, figures, [min, max]) {
  const markers = texts.flatMap((text) => figureMarkers(text ?? ''));
  const numbers = figures.map((fig) => fig.n);
  for (const n of markers) {
    if (!numbers.includes(n)) problems.push(`${where}: [Figure ${n}] has no figure entry`);
  }
  for (const n of numbers) {
    if (!markers.includes(n)) problems.push(`${where}: figure ${n} has no [Figure ${n}] marker`);
  }
  if (new Set(numbers).size !== numbers.length) problems.push(`${where}: duplicate figure number`);
  if (new Set(markers).size !== markers.length)
    problems.push(`${where}: a [Figure n] is used twice`);
  if (markers.some((n, i) => n !== i + 1)) {
    problems.push(`${where}: [Figure n] markers must run 1, 2, 3 … in the order they appear`);
  }
  return figures.length >= min && figures.length <= max
    ? []
    : [`${where}: ${figures.length} figures (usually ${min}–${max})`];
}

// Soft limits (1.7.0): warnings that do not fail the build. Returns a list of messages.
export function contentWarnings(content, bodies = {}) {
  const warnings = [];
  for (const project of content.projects) {
    const size = project.featured_large ? 'large' : 'small';
    const where = `projects "${project.id}"`;
    if (words(project.short_title) < MIN_WORDS.title[size]) {
      warnings.push(`${where}: card title under ${MIN_WORDS.title[size]} words`);
    }
    if (words(project.card_description) < MIN_WORDS.description[size]) {
      warnings.push(`${where}: card description under ${MIN_WORDS.description[size]} words`);
    }
    // 1.7.4 (F02, F07): the search description falls back to the summary line or card description.
    if (!project.meta_description) warnings.push(`${where}: no meta_description`);
    if (project.detail) {
      const figures = project.detail.figures ?? [];
      const texts = ['overview', 'methods', 'results_text', 'limitations'].map(
        (key) => project.detail[key],
      );
      checkFigures([], where, texts, figures, [2, 4]).forEach((message) => warnings.push(message));
    }
  }
  for (const post of content.blog) {
    const where = `blog "${post.slug}"`;
    if (words(post.title) < MIN_WORDS.blogTitle) {
      warnings.push(`${where}: title under ${MIN_WORDS.blogTitle} words`);
    }
    if (words(post.card_description) < MIN_WORDS.blogDescription) {
      warnings.push(`${where}: card description under ${MIN_WORDS.blogDescription} words`);
    }
    // 1.7.4 (F02): the search description falls back to the standfirst, cut at a sentence.
    if (!post.meta_description) warnings.push(`${where}: no meta_description`);
    const figures = post.figures ?? [];
    if (post.slug in bodies) {
      checkFigures([], where, [bodies[post.slug]], figures, [1, 3]).forEach((message) =>
        warnings.push(message),
      );
    }
  }
  // 1.7.4 (F14): a card image without its 480 and 960 px copies is served at 1600 px only.
  for (const [where, image] of [
    ...content.projects.map((p) => [`projects "${p.id}"`, p.card_image]),
    ...content.blog.map((p) => [`blog "${p.slug}"`, p.card_image]),
  ]) {
    if (image?.src && !cardVariants(image)) {
      warnings.push(`${where}: card image has no 480 / 960 px copies (served at 1600 px only)`);
    }
  }
  return warnings;
}

// field → check; `?` after a field name means the key must exist but may be null,
// `*` means the key may be absent (when present it must pass the check).
const shapes = {
  profile: {
    name: isText,
    full_name: isText,
    citation_names: isTextList,
    position: isText,
    department: isText,
    institution: isText,
    location: isText,
    affiliation_short: isText,
    // FD-148: Django-owned texts (admin data), with Phase 1 sample values here: the second role,
    // the hero eyebrow (desktop and mobile), the Portfolio location line and the post author line.
    second_role: isText,
    eyebrow: isText,
    eyebrow_short: isText,
    role_line: isText,
    statement: isText,
    summary: isText,
    location_line: isText,
    author_line: isText,
    email: (v) => isText(v) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    secondary_email: (v) => isText(v) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    languages: isTextList,
    'cv?': (v) => isText(v.href) && v.href.startsWith('/cv/') && v.href.endsWith('.pdf'),
    research_interests: isTextList,
  },
  links: {
    id: (v) => SLUG.test(v),
    label: isText,
    handle: isText,
    url: (v) => isText(v) && v.startsWith('https://'),
  },
  publications: {
    id: (v) => SLUG.test(v),
    year: Number.isInteger,
    type: (v) => PUBLICATION_TYPES.includes(v),
    first_author: (v) => typeof v === 'boolean',
    authors: (v) => Array.isArray(v) && v.length > 0 && v.every((a) => isText(a.name)),
    title: isText,
    venue: isText,
    details: isText,
    // FD-109: what pages show instead of details; may be empty (venue only).
    'display_details*': (v) => typeof v === 'string',
    doi: (v) => DOI.test(v),
    'project?': (v) => SLUG.test(v),
  },
  projects: {
    id: (v) => SLUG.test(v),
    title: isText,
    role: isText,
    'period?': isText,
    status: (v) => PROJECT_STATUSES.includes(v),
    featured: (v) => typeof v === 'boolean',
    contribution: isText,
    tags: isTextList,
    // FD-90, FD-115: the short forms of the cards (Home, Portfolio, the research archive).
    // 1.7.0: the card title, the card description (separate from the summary), the role line
    // (one line, on every card), exactly three card tags from `tags`, and the card image.
    short_title: isText,
    card_description: isText,
    role_line: isText,
    card_tags: (v) => isTextList(v) && v.length === 3,
    card_image: isCardImage,
    // FD-115: one of research-archive.json's topics (checked in validateContent).
    topic: (v) => SLUG.test(v),
    // FD-116: the project page's detail blocks, only where verified.
    'detail*': isDetail,
    'featured_order*': (v) => Number.isInteger(v) && v > 0,
    // FD-102: the one large Home card.
    'featured_large*': (v) => v === true,
    // 1.7.4 (F02, F07): the search description (at most 160 characters, checked below).
    'meta_description*': isText,
  },
  awards: { year: Number.isInteger, title: isText, by: isText },
  education: { year: isText, degree: isText, institution: isText, thesis: isText },
  certifications: { title: isText, by: isText },
  skills: { group: isText, items: isTextList },
  fields: { label: isText, target: isText, icon: (v) => AREA_ICONS.includes(v) },
  blog: {
    slug: (v) => SLUG.test(v),
    category: (v) => SLUG.test(v),
    title: isText,
    // FD-128, FD-139: the page <title> is short_title + ' — Ideatrium', at most 60 characters.
    short_title: isText,
    standfirst: isText,
    // 1.7.0: the card description (Blog list and Latest posts show it, not the standfirst), the
    // card image (1600 × 900, alt text) and the figures of the body.
    card_description: isText,
    card_image: isCardImage,
    'figures*': (v) => Array.isArray(v) && v.length > 0 && v.every(isFigure),
    status: (v) => POST_STATUSES.includes(v),
    'date*': (v) => ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)),
    // 1.7.4 (F02): the search description (at most 160 characters, checked below).
    'meta_description*': isText,
  },
  blogPage: {
    // B1, B2 (1.6.0): the eyebrow, and the count line (plural / singular).
    eyebrow: isText,
    heading: isText,
    intro: isText,
    categories: isListOf((v) => SLUG.test(v.id) && isText(v.label)),
    empty: isText,
    // A filtered category without posts.
    empty_category: isText,
    count_label: (v) => isText(v) && v.includes('{count}'),
    count_label_one: (v) => isText(v) && v.includes('{count}'),
  },
  // FD-114: the post sidebar's headings.
  postSidebar: { toc_heading: isText, author_heading: isText, more_heading: isText },
  // FD-115: the research archive.
  researchArchive: {
    back_label: isText,
    heading: isText,
    intro: isText,
    search_label: isText,
    search_placeholder: isText,
    topic_label: isText,
    topic_all: isText,
    // FD-154: the search button, the results heading (focus target after a change) and the
    // empty state's "Clear filters" link.
    search_button: isText,
    results_heading: isText,
    clear_label: isText,
    empty: isText,
    topics: isListOf((v) => SLUG.test(v.id) && isText(v.label) && TOPIC_ICONS.includes(v.icon)),
  },
  hire: {
    heading: isText,
    availability: isText,
    // FD-153: the yes / no state of the availability dot.
    available: (v) => typeof v === 'boolean',
    services: isListOf(
      (v) =>
        isStep(v) &&
        isText(v.summary) &&
        isTextList(v.items) &&
        isText(v.evidence?.label) &&
        isText(v.evidence?.href),
    ),
    process: isListOf((v) => isStep(v) && isText(v.text)),
    form_kinds: isTextList,
  },
  contact: {
    heading: isText,
    intro: isText,
    audiences: isTextList,
    subjects: isTextList,
    // F3, C1 (1.6.0): the "What to expect" card (Hire me and Contact); sample content, Page text in Django.
    expect: (v) =>
      isText(v?.heading) && isListOf((item) => isText(item.label) && isText(item.value))(v.items),
  },
  meta: { 404: isText, blog: isText, hire: isText, contact: isText, home: isText },
  home: {
    hero_name_lines: isTextList,
    ctas: isListOf((v) => isText(v.label) && isText(v.href) && CTA_VARIANTS.includes(v.variant)),
    selected: (v) =>
      isText(v?.eyebrow) &&
      isText(v.heading) &&
      isText(v.intro) &&
      isText(v.cta) &&
      isText(v.large_eyebrow),
    latest: (v) =>
      isText(v?.eyebrow) &&
      isText(v.heading) &&
      isText(v.intro) &&
      isText(v.cta) &&
      isText(v.item_cta),
    // FD-91: the Home "Selected publications" section.
    publications: (v) =>
      isText(v?.eyebrow) && isText(v.heading) && isText(v.intro) && isText(v.cta),
    // FD-93: one action only (Contact).
    contact_band: (v) =>
      isText(v?.heading) && isText(v.text) && isText(v.primary) && !('secondary' in v),
    screen2: (v) =>
      isText(v?.eyebrow) &&
      isTextList(v.headline_lines) &&
      isText(v.headline_highlight) &&
      isText(v.support) &&
      Array.isArray(v.pillars) &&
      v.pillars.length === 2 &&
      v.pillars.every(isPillar) &&
      isText(v.areas_label) &&
      // FD-87: the Areas of work are plain text, never links; FD-99: icon + label, the
      // index shown only when asked for.
      v.areas_interactive === false &&
      typeof v.areas_show_index === 'boolean',
  },
  // FD-143: the Privacy Policy page and the line under both forms; a text update is a copy-only
  // change to src/content/privacy.json.
  privacy: {
    version: isText,
    title: isText,
    short_title: isText,
    description: isText,
    link_label: isText,
    form_line: isText,
    updated_label: isText,
    updated: (v) => ISO_DATE.test(v),
    updated_text: isText,
    intro: isTextList,
    sections: isListOf(
      (v) =>
        SLUG.test(v.id) &&
        isText(v.heading) &&
        (v.paragraphs === undefined || isTextList(v.paragraphs)) &&
        (v.list === undefined ||
          isListOf((item) => isText(item.label) && isText(item.text))(v.list)) &&
        (v.table === undefined ||
          (isTextList(v.table.columns) &&
            isListOf((row) => isTextList(row) && row.length === v.table.columns.length)(
              v.table.rows,
            ))) &&
        (v.paragraphs_after === undefined || isTextList(v.paragraphs_after)) &&
        Boolean(v.paragraphs || v.list || v.table),
    ),
  },
  // Footer (FD-94): the brand line, three group names, which profile links each group shows.
  footer: {
    signature_by: isText,
    groups: (v) => isText(v?.explore) && isText(v.research) && isText(v.connect),
    research_profiles: isTextList,
    connect_profiles: isTextList,
    copyright_name: isText,
  },
  portfolio: {
    profile: (v) =>
      isText(v?.eyebrow) &&
      isText(v.summary_line) &&
      isText(v.location_line) &&
      isTextList(v.counts) &&
      v.counts.every((key) => PORTFOLIO_COUNTS.includes(key)) &&
      isListOf((item) => isText(item.label) && PORTFOLIO_SECTIONS.includes(item.href))(
        v.section_nav,
      ),
    publications: (v) =>
      isHead(v) && v.selection === 'first_author' && isTextList(v.order) && isViewAll(v.cta),
    projects: (v) => isHead(v) && isTextList(v.order) && isViewAll(v.cta),
    awards: (v) =>
      isHead(v) &&
      isListOf(
        (item) =>
          AWARD_ICONS.includes(item.icon) &&
          isText(item.title) &&
          isText(item.kind) &&
          (item.highlight === null || isText(item.highlight)) &&
          Number.isInteger(item.year) &&
          isText(item.by),
      )(v.items),
    experience: (v) =>
      isHead(v) &&
      isListOf(
        (role) =>
          isText(role.title) &&
          isText(role.period) &&
          // FD-149: the unit may be empty (Ideatrium has none).
          typeof role.unit === 'string' &&
          isText(role.institution) &&
          isText(role.text) &&
          isTextList(role.bullets),
      )(v.roles) &&
      isListOf((item) => isText(item.degree) && isText(item.institution) && isText(item.year))(
        v.education,
      ),
    expertise: (v) =>
      isHead(v) &&
      isText(v.note) &&
      isText(v.training_heading) &&
      isListOf(
        (group) =>
          EXPERTISE_ICONS.includes(group.icon) && isText(group.title) && isTextList(group.items),
      )(v.groups) &&
      isListOf((item) => isText(item.title) && isText(item.by))(v.training),
  },
};
// Single records; every other shape is a list of records.
const objects = [
  'profile',
  'blogPage',
  'hire',
  'contact',
  'meta',
  'home',
  'footer',
  'portfolio',
  'postSidebar',
  'researchArchive',
  'privacy',
];
const stringLists = ['memberships', 'activities'];

function checkShape(problems, where, record, shape) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    problems.push(`${where}: expected an object`);
    return;
  }
  for (const [key, check] of Object.entries(shape)) {
    const nullable = key.endsWith('?');
    const optional = key.endsWith('*');
    const name = nullable || optional ? key.slice(0, -1) : key;
    if (optional && !(name in record)) continue;
    if (!(name in record)) {
      problems.push(`${where}: missing "${name}"`);
    } else if (!(nullable && record[name] === null) && !check(record[name])) {
      problems.push(`${where}: invalid "${name}": ${JSON.stringify(record[name])}`);
    }
  }
}

function checkUnique(problems, file, records, key) {
  const seen = new Set();
  for (const record of records) {
    if (seen.has(record[key])) problems.push(`${file}: duplicate ${key} "${record[key]}"`);
    seen.add(record[key]);
  }
}

export function validateContent(content, bodies) {
  const problems = [];

  for (const [file, shape] of Object.entries(shapes)) {
    const data = content[file];
    if (objects.includes(file)) {
      checkShape(problems, file, data, shape);
    } else if (!Array.isArray(data)) {
      problems.push(`${file}: expected an array`);
    } else {
      data.forEach((record, i) => checkShape(problems, `${file}[${i}]`, record, shape));
    }
  }
  for (const file of stringLists) {
    if (!isTextList(content[file])) problems.push(`${file}: expected a list of strings`);
  }
  if (problems.length) return problems;

  checkUnique(problems, 'links', content.links, 'id');
  checkUnique(problems, 'publications', content.publications, 'id');
  checkUnique(problems, 'publications', content.publications, 'doi');
  checkUnique(problems, 'projects', content.projects, 'id');
  checkUnique(problems, 'blog', content.blog, 'slug');
  checkUnique(problems, 'blogPage.categories', content.blogPage.categories, 'id');
  checkUnique(problems, 'researchArchive.topics', content.researchArchive.topics, 'id');

  // FD-115: every project has one of the topics.
  const topicIds = new Set(content.researchArchive.topics.map((topic) => topic.id));
  for (const project of content.projects) {
    if (!topicIds.has(project.topic)) {
      problems.push(`projects "${project.id}": unknown topic "${project.topic}"`);
    }
  }

  const categoryIds = new Set(content.blogPage.categories.map((category) => category.id));
  for (const post of content.blog) {
    if (!categoryIds.has(post.category)) {
      problems.push(`blog "${post.slug}": unknown category "${post.category}"`);
    }
    // FD-36 release path: a published post has a date and a written standfirst.
    if (post.status === 'published' && !post.date) {
      problems.push(`blog "${post.slug}": published without a "date"`);
    }
    // 1.7.4 (F10): no placeholder anywhere in a published post's standfirst or body.
    if (post.status === 'published') {
      const left = [
        ...placeholders(post.standfirst),
        ...(bodies && post.slug in bodies ? placeholders(bodies[post.slug]) : []),
      ];
      if (isBracketed(post.standfirst) || left.length) {
        const sample = left.slice(0, 3).join(', ') || post.standfirst.slice(0, 40);
        problems.push(`blog "${post.slug}": published with a [bracketed] placeholder: ${sample}`);
      }
    }
    // 1.7.0: hard limits of the Blog card, and the body's [Figure n] markers against the figures.
    const where = `blog "${post.slug}"`;
    if (post.title.length > LIMITS.blogTitle) {
      problems.push(`${where}: title is ${post.title.length} characters (max ${LIMITS.blogTitle})`);
    }
    if (post.card_description.length > LIMITS.blogDescription) {
      problems.push(
        `${where}: card description is ${post.card_description.length} characters (max ${LIMITS.blogDescription})`,
      );
    }
    if (bodies && post.slug in bodies) {
      checkFigures(problems, where, [bodies[post.slug]], post.figures ?? [], [0, 99]);
    }
  }
  // 1.7.0: the card fields of each project, and its figures against the markers in its text.
  for (const project of content.projects) {
    const where = `projects "${project.id}"`;
    const size = project.featured_large ? 'large' : 'small';
    for (const key of REMOVED_PROJECT_FIELDS) {
      if (key in project) problems.push(`${where}: "${key}" no longer exists (1.7.0)`);
    }
    if (project.short_title.length > LIMITS.title[size]) {
      problems.push(
        `${where}: ${size} card title is ${project.short_title.length} characters (max ${LIMITS.title[size]})`,
      );
    }
    if (project.card_description.length > LIMITS.description[size]) {
      problems.push(
        `${where}: ${size} card description is ${project.card_description.length} characters (max ${LIMITS.description[size]})`,
      );
    }
    if (project.role_line.length > LIMITS.roleLine) {
      problems.push(
        `${where}: role line is ${project.role_line.length} characters (max ${LIMITS.roleLine})`,
      );
    }
    const extra = project.card_tags.filter((tag) => !project.tags.includes(tag));
    if (extra.length) problems.push(`${where}: card_tags not in tags: ${extra.join(', ')}`);
    if (new Set(project.card_tags).size !== project.card_tags.length) {
      problems.push(`${where}: duplicate card tag`);
    }
    if (project.detail) {
      const { detail } = project;
      checkFigures(
        problems,
        where,
        [detail.overview, detail.methods, detail.results_text, detail.limitations],
        detail.figures ?? [],
        [0, 99],
      );
    }
  }

  // FD-44: the hero name lines are the profile name, split over lines.
  if (content.home.hero_name_lines.join(' ') !== content.profile.name) {
    problems.push('home: "hero_name_lines" do not spell profile.name');
  }

  // FD-94: the footer groups name existing profile links; the affiliation splits in two.
  const linkIds = new Set(content.links.map((link) => link.id));
  for (const key of ['research_profiles', 'connect_profiles']) {
    for (const id of content.footer[key]) {
      if (!linkIds.has(id)) problems.push(`footer: ${key} names unknown link "${id}"`);
    }
  }
  if (!content.profile.affiliation_short.endsWith(`, ${content.profile.institution}`)) {
    problems.push('profile: "affiliation_short" does not end with ", <institution>"');
  }

  // FD-90: every featured project has its Home short forms and a distinct place 1 … n.
  const featured = content.projects.filter((project) => project.featured);
  for (const project of featured) {
    if (!('featured_order' in project)) {
      problems.push(`projects "${project.id}": featured without "featured_order"`);
    }
  }
  const places = featured.map((project) => project.featured_order).toSorted((a, b) => a - b);
  if (places.some((place, i) => place !== i + 1)) {
    problems.push(`projects: featured_order must be 1 … ${featured.length}, got ${places}`);
  }
  // FD-102: exactly one featured project is the large card.
  const large = content.projects.filter((project) => project.featured_large);
  if (large.length !== 1 || !large[0].featured) {
    problems.push(
      `projects: exactly one featured project must be featured_large, got ${large.length}`,
    );
  }

  const projectIds = new Set(content.projects.map((project) => project.id));
  problems.push(...checkPortfolio(content, projectIds));
  problems.push(...checkLimits(content, bodies));
  for (const pub of content.publications) {
    const where = `publications "${pub.id}"`;
    if (pub.project && !projectIds.has(pub.project)) {
      problems.push(`${where}: unknown project "${pub.project}"`);
    }
    const mine = pub.authors.filter((author) => author.me === true);
    if (mine.length !== 1) problems.push(`${where}: ${mine.length} authors with "me": true`);
    if (pub.first_author !== (pub.authors[0].me === true)) {
      problems.push(`${where}: "first_author" disagrees with the author order`);
    }
  }
  return problems;
}

// 1.7.4 (F03, F10): the documented limits of tools/limits.mjs (docs/handover-django.md § 14.1).
function checkLimits(content, bodies) {
  const problems = [];
  const { profile, portfolio, hire, contact } = content;
  // Page titles: the short title and " — Ideatrium", at most 60 characters.
  const titles = [
    ['home', profile.name],
    ['privacy', content.privacy.short_title],
    ...content.projects.map((p) => [`projects "${p.id}"`, p.short_title]),
    ...content.blog.map((p) => [`blog "${p.slug}"`, p.short_title]),
    ...content.researchArchive.topics.map((t) => [`topic "${t.id}"`, `Projects — ${t.label}`]),
    ...content.blogPage.categories.map((c) => [`category "${c.id}"`, `Blog — ${c.label}`]),
  ];
  for (const [where, short] of titles) {
    const title = pageTitle(short);
    if (title.length > TITLE_MAX) {
      problems.push(
        `${where}: page title "${title}" is ${title.length} characters (max ${TITLE_MAX})`,
      );
    }
  }
  // Search descriptions: every one a page can carry, at most 160 characters.
  // The derived ones come from the site build (a broken figure marker throws there; it is reported
  // by the figure check instead).
  let site = { portfolioView: {}, projectList: [], postList: [] };
  try {
    site = buildSite(content, { bodies: bodies ?? {}, showDrafts: true, release: false });
  } catch {
    // Reported by checkFigures.
  }
  const descriptions = [
    ...Object.entries(content.meta).map(([key, text]) => [`meta.${key}`, text]),
    ['profile.summary', profile.summary],
    ['privacy.description', content.privacy.description],
    ...content.projects
      .filter((p) => p.meta_description)
      .map((p) => [`projects "${p.id}" meta_description`, p.meta_description]),
    ...content.blog
      .filter((p) => p.meta_description)
      .map((p) => [`blog "${p.slug}" meta_description`, p.meta_description]),
    ['the projects archive description', site.portfolioView.researchDescription],
    ['the publications description', site.portfolioView.publicationsDescription],
    ...site.projectList.map((p) => [`projects "${p.id}" description`, p.description]),
    ...site.postList.map((p) => [`blog "${p.slug}" description`, p.description]),
  ];
  for (const [where, text] of descriptions) {
    if (String(text ?? '').length > DESCRIPTION_MAX) {
      problems.push(`${where}: ${text.length} characters (max ${DESCRIPTION_MAX})`);
    }
  }
  // The § 14.1 text slots.
  const role = (r, key) => `portfolio.experience.roles "${r.title}" ${key}`;
  const service = (s, key) => `hire.services "${s.n}" ${key}`;
  const slots = [
    ['profile.second_role', profile.second_role, MAX.second_role],
    ['profile.eyebrow', profile.eyebrow, MAX.eyebrow],
    ['profile.eyebrow_short', profile.eyebrow_short, MAX.eyebrow_short],
    ['profile.role_line', profile.role_line, MAX.role_line],
    ['profile.statement', profile.statement, MAX.statement],
    ['profile.location_line', profile.location_line, MAX.location_line],
    ['profile.author_line', profile.author_line, MAX.author_line],
    ['profile.email', profile.email, MAX.email],
    ['profile.secondary_email', profile.secondary_email, MAX.email],
    ['portfolio.profile.summary_line', portfolio.profile.summary_line, MAX.summary_line],
    ['portfolio.profile.eyebrow', portfolio.profile.eyebrow, MAX.portfolio_eyebrow],
    ['portfolio.profile.location_line', portfolio.profile.location_line, MAX.location_line],
    ['hire.availability', hire.availability, MAX.availability],
    ['contact.intro', contact.intro, MAX.contact_intro],
    ...content.links.map((l) => [`links "${l.id}" label`, l.label, MAX.link_label]),
    ...content.fields.map((f, i) => [`fields[${i}] label`, f.label, MAX.area_label]),
    ...hire.services.flatMap((s) => [
      [service(s, 'title'), s.title, MAX.service_title],
      [service(s, 'summary'), s.summary, MAX.service_summary],
      [service(s, 'evidence label'), s.evidence.label, MAX.evidence_label],
      ...s.items.map((item, i) => [service(s, `item ${i + 1}`), item, MAX.service_item]),
    ]),
    ...portfolio.experience.roles.flatMap((r) => [
      [role(r, 'title'), r.title, MAX.role_title],
      [role(r, 'period'), r.period, MAX.role_period],
      [role(r, 'unit'), r.unit, MAX.role_unit],
      [role(r, 'institution'), r.institution, MAX.role_institution],
      [role(r, 'text'), r.text, MAX.role_text],
      ...r.bullets.map((b, i) => [role(r, `bullet ${i + 1}`), b, MAX.role_bullet]),
    ]),
    ...contact.audiences.map((a, i) => [`contact.audiences[${i}]`, a, MAX.audience]),
    ...contact.subjects.map((a, i) => [`contact.subjects[${i}]`, a, MAX.subject]),
    ...hire.form_kinds.map((a, i) => [`hire.form_kinds[${i}]`, a, MAX.form_kind]),
  ];
  for (const [where, text, most] of slots) {
    if (String(text ?? '').length > most) {
      problems.push(`${where}: ${text.length} characters (max ${most})`);
    }
  }
  // The list slots.
  const lists = [
    ['links', content.links, MANY.links],
    ['footer.research_profiles', content.footer.research_profiles, MANY.footerLinks],
    ['footer.connect_profiles', content.footer.connect_profiles, MANY.footerLinks],
    ['fields', content.fields, MANY.areas],
    ['hire.services', hire.services, MANY.services],
    ...hire.services.map((s) => [service(s, 'items'), s.items, MANY.serviceItems]),
    ['portfolio.experience.roles', portfolio.experience.roles, MANY.roles],
    ['contact.subjects', contact.subjects, MANY.options],
    ['hire.form_kinds', hire.form_kinds, MANY.options],
    ['contact.audiences', contact.audiences, MANY.audiences],
  ];
  for (const [where, list, most] of lists) {
    if (list.length > most) problems.push(`${where}: ${list.length} items (max ${most})`);
  }
  return problems;
}

// The Portfolio block (FD-107, FD-108) against the rest of the content.
function checkPortfolio(content, projectIds) {
  const problems = [];
  const { portfolio } = content;
  const pubs = Object.fromEntries(content.publications.map((pub) => [pub.id, pub]));
  for (const id of portfolio.publications.order) {
    if (!pubs[id]) problems.push(`portfolio.publications: unknown publication "${id}"`);
    else if (!pubs[id].first_author) {
      problems.push(`portfolio.publications: "${id}" is not a first-author paper`);
    }
  }
  for (const id of portfolio.projects.order) {
    if (!projectIds.has(id)) problems.push(`portfolio.projects: unknown project "${id}"`);
    else if (!content.projects.find((p) => p.id === id).short_title) {
      problems.push(`portfolio.projects: "${id}" has no short_title / card_description`);
    }
  }
  for (const key of ['publications', 'projects']) {
    const order = portfolio[key].order;
    if (new Set(order).size !== order.length) problems.push(`portfolio.${key}: duplicate id`);
  }
  // FD-108: every award shown is one of awards.json (same year, title at its start).
  const plain = (text) => text.replace(/['’]/g, '').toLowerCase();
  for (const item of portfolio.awards.items) {
    const record = content.awards.find(
      (award) => award.year === item.year && plain(award.title).startsWith(plain(item.title)),
    );
    if (!record) problems.push(`portfolio.awards: "${item.title}" is not in awards.json`);
  }
  // 1.7.1: the list maxima.
  const counts = [
    ['portfolio.awards.items', portfolio.awards.items, LIST_MAX.awards],
    ['portfolio.experience.education', portfolio.experience.education, LIST_MAX.education],
    ['portfolio.expertise.groups', portfolio.expertise.groups, LIST_MAX.expertiseGroups],
    ['portfolio.expertise.training', portfolio.expertise.training, LIST_MAX.certifications],
    ...portfolio.expertise.groups.map((group) => [
      `portfolio.expertise.groups "${group.title}" items`,
      group.items,
      LIST_MAX.expertiseItems,
    ]),
    ...portfolio.experience.roles.map((role) => [
      `portfolio.experience.roles "${role.title}" bullets`,
      role.bullets,
      LIST_MAX.bullets,
    ]),
  ];
  for (const [where, list, most] of counts) {
    if (list.length > most) problems.push(`${where}: ${list.length} items (max ${most})`);
  }
  const removed = JSON.stringify(content).match(REMOVED_TERMS);
  if (removed) problems.push(`content: "${removed[0]}" was removed from the site (FD-108)`);
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const content = loadContent();
  const bodies = loadPostBodies(content.blog);
  const problems = validateContent(content, bodies);
  if (!problems.length) problems.push(...missingImages(content), ...missingPosts(content));
  if (problems.length) {
    console.error(`validate-content: ${problems.length} problem(s)\n${problems.join('\n')}`);
    process.exit(1);
  }
  // 1.7.0: the soft limits only warn.
  const warnings = contentWarnings(content, bodies);
  if (warnings.length) {
    console.warn(`validate-content: ${warnings.length} warning(s)\n${warnings.join('\n')}`);
  }
  console.log(
    `validate-content: ${content.publications.length} publications, ${content.projects.length} projects, ${content.awards.length} awards, ${content.blog.length} posts valid`,
  );
}
