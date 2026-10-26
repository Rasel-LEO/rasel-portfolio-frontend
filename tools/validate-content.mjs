// Author: Rasel Al Mamun
// Validates src/content/*.json (FD-19) before every build: required fields per type,
// unique ids, publication → project references, DOI format, numeric years, publication
// type, exactly one `me: true` author per publication; blog posts (FD-36, FD-37): known
// category, draft/published status, unique slugs, a Markdown body per post; the Blog,
// Hire me, Contact, meta and Home blocks; the Portfolio block (FD-107, FD-108). Plain checks,
// no schema library.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadContent, postSource } from './content.mjs';
import { isBracketed } from './markdown.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const DOI = /^10\.\d{4,9}\/\S+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PUBLICATION_TYPES = ['journal', 'conference'];
const PROJECT_STATUSES = [null, 'in-progress', 'done'];
const POST_STATUSES = ['draft', 'published'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isTextList = (value) => Array.isArray(value) && value.length > 0 && value.every(isText);
// A list of records that each pass `check`.
const isListOf = (check) => (value) =>
  Array.isArray(value) && value.length > 0 && value.every((item) => item && check(item));
const isStep = (v) => /^\d{2}$/.test(v.n) && isText(v.title);
// A Home Fork card (FD-44): title, text, tag chips, button label and a page link.
const isForkCard = (v) =>
  isText(v?.title) && isText(v.text) && isTextList(v.tags) && isText(v.cta) && isText(v.href);
const CTA_VARIANTS = ['primary', 'secondary', 'secondary-small'];
// The in-house line icons of the Areas-of-work grid (FD-84, src/partials/icons/area-icon.hbs).
const AREA_ICONS = ['sprout', 'network', 'camera', 'tractor', 'code', 'document'];
const isPillar = (v) => isText(v?.label) && isTextList(v.lines) && isText(v.href);

// Portfolio (FD-107, FD-108): in-house line icons (src/partials/icons/pf-icon.hbs), the section ids
// the profile's section nav may link to, and the counts the profile may show.
const AWARD_ICONS = ['trophy', 'medal', 'ribbon'];
const EXPERTISE_ICONS = ['chip', 'network', 'code', 'gear'];
const PORTFOLIO_SECTIONS = ['#publications', '#research', '#awards', '#experience', '#expertise'];
const PORTFOLIO_COUNTS = ['publications', 'projects', 'awards'];
// FD-108: removed from the site; never shown again.
const REMOVED_TERMS = /\b(?:MATLAB|LaTeX|Makeathon)\b/i;
// FD-113, FD-115, FD-116: the in-house line drawings of src/partials/icons/illustration.hbs
// (post covers) and src/partials/icons/line-icon.hbs (system steps, results, topics).
export const COVER_ILLUSTRATIONS = ['sensor-node', 'two-boards', 'notebook-journal'];
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
export const TOPIC_ICONS = ['hen', 'fish', 'sun-water', 'tractor', 'leaf', 'greenhouse'];
// A project's detail (FD-116): every block optional — a page shows only the blocks that exist —
// but each one well-formed when present.
const isIconStep = (v) => SYSTEM_ICONS.includes(v?.icon) && isText(v.title) && isText(v.text);
const DETAIL = {
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

// A real photograph (FD-35): WebP under /images/, optional AVIF twin, alt text, intrinsic size,
// optional caption (gallery). The files must exist: see missingImages().
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
  (v.caption === undefined || isText(v.caption));

// Markdown bodies missing from src/content/posts/ (FD-37).
function missingPosts(content) {
  return content.blog
    .filter((post) => !existsSync(postSource(post.slug)))
    .map((post) => `blog "${post.slug}": src/content/posts/${post.slug}.md not found`);
}

// Image files named in projects.json that are not in src/images/ (Vite would only warn).
export function missingImages(content, srcDir = join(root, 'src')) {
  return content.projects.flatMap((project) =>
    [project.image, ...(project.gallery ?? [])]
      .filter(Boolean)
      .flatMap((image) => [image.src, image.avif].filter(Boolean))
      .filter((path) => !existsSync(join(srcDir, path)))
      .map((path) => `projects "${project.id}": image file not found: src${path}`),
  );
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
    eyebrow: isText,
    role_line: isText,
    statement: isText,
    summary: isText,
    email: (v) => isText(v) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    languages: isTextList,
    'cv?': (v) => isText(v.href) && isText(v.size),
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
    'image*': isImage,
    'gallery*': (v) => Array.isArray(v) && v.length > 0 && v.every(isImage),
    // FD-90, FD-115: the short forms of the cards (Home, Portfolio, the research archive).
    short_title: isText,
    short_summary: isText,
    // FD-115: one of research-archive.json's topics (checked in validateContent).
    topic: (v) => SLUG.test(v),
    // FD-116: the project page's detail blocks, only where verified.
    'detail*': isDetail,
    'featured_order*': (v) => Number.isInteger(v) && v > 0,
    // FD-102: the one large Home card and its role line.
    'featured_large*': (v) => v === true,
    'featured_role_line*': isText,
    // The Home card's tags as in the design specification (a subset of tags).
    'featured_tags*': isTextList,
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
    // FD-128: the page <title> (with ' — Rasel Al Mamun', at most 60 characters).
    short_title: isText,
    standfirst: isText,
    status: (v) => POST_STATUSES.includes(v),
    'date*': (v) => ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)),
  },
  blogPage: {
    // FD-112: the eyebrow and count while drafts are shown.
    eyebrow_draft: isText,
    heading: isText,
    intro: isText,
    categories: isListOf((v) => SLUG.test(v.id) && isText(v.label)),
    empty: isText,
    // A filtered category without posts.
    empty_category: isText,
    count_label_draft: (v) => isText(v) && v.includes('{count}'),
    // FD-113: a cover per post slug (checked in validateContent): a known drawing and alt text,
    // or later a real photo (same frame, no layout change).
    covers: (v) =>
      v !== null &&
      typeof v === 'object' &&
      Object.values(v).every(
        (cover) =>
          (COVER_ILLUSTRATIONS.includes(cover?.illustration) && isText(cover.alt)) ||
          isImage(cover),
      ),
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
    count_label: (v) => isText(v) && v.includes('{shown}') && v.includes('{total}'),
    empty: isText,
    topics: isListOf((v) => SLUG.test(v.id) && isText(v.label) && TOPIC_ICONS.includes(v.icon)),
  },
  hire: {
    heading: isText,
    availability: isText,
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
    privacy_note: isText,
  },
  meta: { 404: isText, blog: isText, hire: isText, contact: isText, home: isText },
  home: {
    hero_name_lines: isTextList,
    ctas: isListOf((v) => isText(v.label) && isText(v.href) && CTA_VARIANTS.includes(v.variant)),
    fork: (v) => isText(v?.heading) && isForkCard(v.portfolio) && isForkCard(v.blog),
    hire_intro: isText,
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
  // Footer (FD-94): the brand line, three group names, which profile links each group shows.
  footer: {
    role_line: isText,
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
    projects: (v) =>
      isHead(v) &&
      isTextList(v.order) &&
      v.order.every((id) => isText(v.role_lines?.[id])) &&
      isViewAll(v.cta),
    awards: (v) =>
      isHead(v) &&
      isText(v.note) &&
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
      isText(v.note) &&
      isListOf(
        (role) =>
          isText(role.title) &&
          isText(role.period) &&
          isText(role.unit) &&
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

export function validateContent(content) {
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

  // FD-113: covers belong to posts; FD-115: every project has one of the topics.
  const slugs = new Set(content.blog.map((post) => post.slug));
  for (const slug of Object.keys(content.blogPage.covers)) {
    if (!slugs.has(slug)) problems.push(`blogPage.covers: unknown post "${slug}"`);
  }
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
    if (post.status === 'published' && isBracketed(post.standfirst)) {
      problems.push(`blog "${post.slug}": published with a [bracketed] standfirst`);
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
    for (const key of ['short_title', 'short_summary', 'featured_order']) {
      if (!(key in project)) problems.push(`projects "${project.id}": featured without "${key}"`);
    }
  }
  const places = featured.map((project) => project.featured_order).toSorted((a, b) => a - b);
  if (places.some((place, i) => place !== i + 1)) {
    problems.push(`projects: featured_order must be 1 … ${featured.length}, got ${places}`);
  }
  // The Home card's tags are some of the project's own tags.
  for (const project of content.projects.filter((p) => 'featured_tags' in p)) {
    const extra = (project.featured_tags ?? []).filter((tag) => !project.tags.includes(tag));
    if (!project.featured)
      problems.push(`projects "${project.id}": featured_tags but not featured`);
    if (extra.length) {
      problems.push(`projects "${project.id}": featured_tags not in tags: ${extra.join(', ')}`);
    }
  }
  // FD-102: exactly one featured project is the large card, with its role line.
  const large = content.projects.filter((project) => project.featured_large);
  if (large.length !== 1 || !large[0].featured) {
    problems.push(
      `projects: exactly one featured project must be featured_large, got ${large.length}`,
    );
  } else if (!('featured_role_line' in large[0])) {
    problems.push(`projects "${large[0].id}": featured_large without "featured_role_line"`);
  }

  const projectIds = new Set(content.projects.map((project) => project.id));
  problems.push(...checkPortfolio(content, projectIds));
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
      problems.push(`portfolio.projects: "${id}" has no short_title / short_summary`);
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
  const removed = JSON.stringify(content).match(REMOVED_TERMS);
  if (removed) problems.push(`content: "${removed[0]}" was removed from the site (FD-108)`);
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const content = loadContent();
  const problems = validateContent(content);
  if (!problems.length) problems.push(...missingImages(content), ...missingPosts(content));
  if (problems.length) {
    console.error(`validate-content: ${problems.length} problem(s)\n${problems.join('\n')}`);
    process.exit(1);
  }
  console.log(
    `validate-content: ${content.publications.length} publications, ${content.projects.length} projects, ${content.awards.length} awards, ${content.blog.length} posts valid`,
  );
}
