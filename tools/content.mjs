// Author: Rasel Al Mamun
// Loads the site content (FD-19) from src/content/*.json and derives everything the
// templates show: counts, publication year groups, project order, prev/next links, and
// the blog posts (FD-36, FD-37) with their rendered Markdown bodies.
// Used by vite.config.js, tools/validate-content.mjs and the tests.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBracketed, readingMinutes, renderMarkdown } from './markdown.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const contentDir = join(root, 'src/content');
export const postsDir = join(contentDir, 'posts');

const contentFiles = [
  'profile',
  'links',
  'publications',
  'projects',
  'awards',
  'education',
  'certifications',
  'memberships',
  'skills',
  'activities',
  'fields',
  'blog',
  'blog-page',
  'hire',
  'contact',
  'meta',
  'home',
  'footer',
  'portfolio',
  'post-sidebar',
  'research-archive',
];

// blog-page.json → content.blogPage
const contentKey = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

export function loadContent() {
  return Object.fromEntries(
    contentFiles.map((name) => [
      contentKey(name),
      JSON.parse(readFileSync(join(contentDir, `${name}.json`), 'utf8')),
    ]),
  );
}

export const postSource = (slug) => join(postsDir, `${slug}.md`);

// The Markdown body of each post, by slug (missing files are reported by validate-content).
function loadPostBodies(blog) {
  return Object.fromEntries(
    blog
      .filter((post) => existsSync(postSource(post.slug)))
      .map((post) => [post.slug, readFileSync(postSource(post.slug), 'utf8')]),
  );
}

// The bracketed body skeleton of src/content/posts/*.md, for the sample post that
// blog-post.html shows when no post is built (keeps the prose styles in the template).
const SAMPLE_BODY = [
  '[Opening paragraph]',
  '## [First section heading]',
  '[First section text]',
  '```text\n[Code sample]\n```',
  '[Figure: image and caption]',
  '## [Second section heading]',
  '[Second section text]',
].join('\n\n');

// FD-36: drafts are built while SHOW_DRAFTS is true (the default until release).
const showDraftsFromEnv = (value = process.env.SHOW_DRAFTS) =>
  !['false', '0', 'no'].includes(
    String(value ?? '')
      .trim()
      .toLowerCase(),
  );

// FD-103: the release build (RELEASE true; default false while the site is designed) shows only
// published posts on Home and hides Latest posts when there is none.
const releaseFromEnv = (value = process.env.RELEASE) =>
  ['true', '1', 'yes'].includes(
    String(value ?? '')
      .trim()
      .toLowerCase(),
  );

export const doiUrl = (doi) => `https://doi.org/${doi}`;
export const projectFile = (id) => `project-${id}.html`;
const postFile = (slug) => `post-${slug}.html`;
const pad2 = (n) => String(n).padStart(2, '0');

// A featured project as its Home card: the card's tags.
const homeCard = (project) =>
  project && { ...project, cardTags: project.featured_tags ?? project.tags };

// A publication as a short row (Home FD-91, Portfolio FD-107): the first author and "et al.".
const shortCitation = (pub) => ({
  ...pub,
  leadAuthor: pub.authors[0].name,
  etAl: pub.authors.length > 1,
});

// Labels of the Portfolio profile counts (FD-107), keyed as in portfolio.profile.counts.
const COUNT_LABELS = {
  publications: 'Publications',
  projects: 'Research projects',
  awards: 'Awards',
};

// Content plus derived values; computed once per build.
export function buildSite(
  content = loadContent(),
  {
    release = releaseFromEnv(),
    // FD-36, FD-103: drafts are built unless SHOW_DRAFTS says no — or, when it is unset, in
    // the release build.
    showDrafts = (process.env.SHOW_DRAFTS ?? '').trim() === '' ? !release : showDraftsFromEnv(),
    bodies = loadPostBodies(content.blog),
  } = {},
) {
  const { profile, links, publications, projects, awards, fields, portfolio, researchArchive } =
    content;
  const topicById = Object.fromEntries(researchArchive.topics.map((topic) => [topic.id, topic]));

  // Featured projects first, otherwise in the order of projects.json.
  const ordered = [...projects.filter((p) => p.featured), ...projects.filter((p) => !p.featured)];
  const projectList = ordered.map((project, i) => ({
    ...project,
    number: pad2(i + 1),
    file: projectFile(project.id),
    // FD-115, FD-116: the project's topic (label and line icon) and the Portfolio role line.
    topicLabel: topicById[project.topic]?.label,
    topicIcon: topicById[project.topic]?.icon,
    roleLine: portfolio.projects.role_lines[project.id] ?? project.role,
    facts: projectFacts(project),
  }));
  projectList.forEach((project, i) => {
    const prev = projectList[i - 1];
    const next = projectList[i + 1];
    project.prev = prev && { title: prev.title, shortTitle: prev.short_title, file: prev.file };
    project.next = next && { title: next.title, shortTitle: next.short_title, file: next.file };
  });
  const projectById = Object.fromEntries(projectList.map((p) => [p.id, p]));

  const pubs = publications.map((pub) => ({
    ...pub,
    // FD-109: the details pages show; display_details (may be empty) wins over
    // details, which stays in the data for Django.
    shownDetails: pub.display_details ?? pub.details,
    projectFile: pub.project ? projectFile(pub.project) : null,
    projectTitle: pub.project ? projectById[pub.project]?.title : null,
  }));
  for (const project of projectList) {
    project.publications = pubs.filter((pub) => pub.project === project.id);
  }
  const years = [...new Set(pubs.map((pub) => pub.year))].sort((a, b) => b - a);
  const publicationYears = years.map((year) => ({
    year,
    items: pubs.filter((pub) => pub.year === year),
  }));

  const person = personLd(profile, links, fields);
  const postList = buildPosts(content, { showDrafts, bodies, person });
  // Home (FD-103): the built posts now, without a Draft chip; in the release build (FD-45) only
  // published ones. Newest first (undated in the data's order), up to three.
  const latestPosts = postList
    .filter((post) => !release || !post.draft)
    .toSorted((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 3);
  // FD-112: while drafts are shown, the Blog says so ("Blog / Draft preview"); a count says
  // "{n} drafts" only when every post it counts is a draft, otherwise "{n} posts".
  const drafts = postList.filter((post) => post.draft).length;
  const countText = (list) => {
    const n = list.length;
    return n && list.every((post) => post.draft)
      ? content.blogPage.count_label_draft
          .replace('{count}', String(n))
          .replace(/drafts$/, n === 1 ? 'draft' : 'drafts')
      : `${n} ${n === 1 ? 'post' : 'posts'}`;
  };
  const categories = content.blogPage.categories.map((category) => {
    const posts = postList.filter((post) => post.category === category.id);
    return {
      ...category,
      count: posts.length,
      countText: `${countText(posts)} in ${category.label}`,
    };
  });

  const counts = {
    publications: publications.length,
    firstAuthor: publications.filter((pub) => pub.first_author).length,
    journal: publications.filter((pub) => pub.type === 'journal').length,
    conference: publications.filter((pub) => pub.type === 'conference').length,
    projects: projects.length,
    awards: awards.length,
    posts: postList.length,
  };

  return {
    ...content,
    showDrafts,
    release,
    postList,
    blogView: {
      eyebrow: drafts ? content.blogPage.eyebrow_draft : 'Blog',
      drafts,
      countText: countText(postList),
    },
    postBySlug: Object.fromEntries(postList.map((post) => [post.slug, post])),
    // blog-post.html when no post is visible (SHOW_DRAFTS=false before the first release).
    samplePost: {
      title: '[Post title]',
      short_title: '[Post title]',
      categoryLabel: '[Category]',
      standfirst: '[Standfirst]',
      readingTime: '[n] min read',
      html: renderMarkdown(SAMPLE_BODY),
      description: `[Post title] — a post by ${profile.name}`,
    },
    categories,
    latestPosts,
    projectList,
    // Home "Selected work" (FD-102): the large card (featured_large) and the other featured
    // projects in featured_order; Home "Selected publications" (FD-91): first-author papers.
    // Their cards show featured_tags where given (design specification), else all tags.
    featuredLarge: homeCard(
      projectList.find((project) => project.featured && project.featured_large),
    ),
    featuredSmall: projectList
      .filter((project) => project.featured && !project.featured_large)
      .toSorted((a, b) => a.featured_order - b.featured_order)
      .map(homeCard),
    // FD-91: the first author (the site author) and "et al."; every author is in the JSON-LD.
    firstAuthorPublications: pubs.filter((pub) => pub.first_author).map(shortCitation),
    // Portfolio (FD-107 … FD-109): every publication as a short row, newest first by year,
    // and the curated sections in the curated order; counts and "View all {count}" from data.
    publicationRows: publicationYears.map((group) => ({
      year: group.year,
      items: group.items.map(shortCitation),
    })),
    portfolioView: portfolioView(portfolio, {
      pubs,
      projectById,
      projectList,
      counts,
      profileName: profile.name,
    }),
    projectById,
    // research.html (FD-115): the archive's cards, topics and count line.
    archive: archiveView(researchArchive, projectList),
    publicationYears,
    focus: fields.slice(0, 3).map((field) => field.label),
    counts,
    // Footer (FD-94): the profile links of each group, in the data's order, and the
    // affiliation on two lines (department, university) from affiliation_short.
    footerLinks: {
      research: content.footer.research_profiles.map((id) => links.find((l) => l.id === id)),
      connect: content.footer.connect_profiles.map((id) => links.find((l) => l.id === id)),
    },
    footerAffiliation: [
      profile.affiliation_short.replace(`, ${profile.institution}`, ''),
      profile.institution,
    ],
    person,
    website: { '@context': 'https://schema.org', '@type': 'WebSite', name: profile.name },
    articles: pubs.map(articleLd),
  };
}

// The Portfolio page's sections (FD-107): the curated rows and cards in the data's order, the
// counts row, and the "View all {count} …" labels.
function portfolioView(portfolio, { pubs, projectById, projectList, counts, profileName }) {
  const pubById = Object.fromEntries(pubs.map((pub) => [pub.id, pub]));
  const fill = (text, count) => text.replace('{count}', String(count));
  return {
    counts: portfolio.profile.counts.map((key) => ({
      key,
      value: counts[key],
      label: COUNT_LABELS[key],
    })),
    publications: portfolio.publications.order.map((id) => shortCitation(pubById[id])),
    // schema.org ScholarlyArticle for the papers this page lists (all on publications.html).
    articles: portfolio.publications.order.map((id) => articleLd(pubById[id])),
    publicationsCta: fill(portfolio.publications.cta, counts.publications),
    projects: portfolio.projects.order.map((id) => ({
      ...projectById[id],
      roleLine: portfolio.projects.role_lines[id],
      cardTitle: projectById[id].short_title,
      cardSummary: projectById[id].short_summary,
      cardTags: projectById[id].featured_tags ?? projectById[id].tags,
    })),
    projectsCta: fill(portfolio.projects.cta, counts.projects),
    // The "View all" pages' intro and meta description (FD-109), from the counts.
    publicationsIntro: `${counts.publications} publications: ${counts.journal} journal articles and ${counts.conference} conference papers, newest first.`,
    publicationsDescription: `${counts.publications} publications by ${profileName}: ${counts.journal} journal articles and ${counts.conference} conference papers, newest first.`,
    researchDescription: `${counts.projects} research projects by ${profileName} — ${portfolio.projects.intro}`,
    // research.html (FD-109): all projects as the same cards, full title and summary.
    allProjects: projectList.map((project) => ({
      ...project,
      roleLine: project.role,
      cardTitle: project.title,
      cardSummary: project.contribution,
      cardTags: project.tags,
    })),
  };
}

// The project page's facts row (FD-116): the role always; period and status where set; the
// verified detail facts (institution with its unit, technology, research output) where given.
function projectFacts(project) {
  const facts = project.detail?.facts ?? {};
  return [
    { label: 'Role', value: facts.role ?? project.role },
    project.period && { label: 'Period', value: project.period },
    project.status && { label: 'Status', status: project.status },
    facts.institution && { label: 'Institution', value: facts.institution, sub: facts.unit },
    facts.technology && { label: 'Technology', value: facts.technology },
    facts.output && { label: 'Research output', value: facts.output },
  ].filter(Boolean);
}

// The research archive (FD-115): one card per project — topic, status, short title, role line,
// short summary, two pills — with the words the search matches (titles and tags) and the
// count line for all projects. The filter's count is the same label with other numbers.
function archiveView(archive, projectList) {
  const total = projectList.length;
  return {
    ...archive,
    total,
    countText: archive.count_label
      .replace('{shown}', String(total))
      .replace('{total}', String(total)),
    cards: projectList.map((project) => ({
      ...project,
      cardTags: (project.featured_tags ?? project.tags).slice(0, 2),
      search: [project.title, project.short_title, ...project.tags].join(' ').toLowerCase(),
    })),
  };
}

// Blog posts in the order of blog.json, drafts left out unless showDrafts (FD-36).
function buildPosts({ blog, blogPage, profile }, { showDrafts, bodies, person }) {
  const labels = Object.fromEntries(blogPage.categories.map((c) => [c.id, c.label]));
  const visible = blog.filter((post) => showDrafts || post.status !== 'draft');
  const list = visible.map((post) => {
    const body = bodies[post.slug] ?? '';
    const minutes = readingMinutes(body);
    // FD-39 meta rule: the standfirst once written, otherwise a generic line.
    const description = isBracketed(post.standfirst)
      ? `${post.title} — a post by ${profile.name}`
      : post.standfirst;
    return {
      ...post,
      file: postFile(post.slug),
      draft: post.status === 'draft',
      categoryLabel: labels[post.category],
      // FD-113: the cover illustration (an in-house line drawing) and its alt text.
      cover: blogPage.covers?.[post.slug] ?? null,
      minutes,
      readingTime: `${minutes} min read`,
      html: renderMarkdown(body),
      description,
    };
  });
  list.forEach((post) => {
    // FD-114 sidebar: "On this page" lists the body's h2 headings (their inner HTML, tags
    // stripped, already escaped); "More posts" the other posts, same category first.
    post.toc = [...post.html.matchAll(/<h2 id="([^"]+)">(.*?)<\/h2>/g)].map(([, id, inner]) => ({
      id,
      label: inner
        .replace(/<span class="visually-hidden">.*?<\/span>/g, '')
        .replace(/<[^>]*>/g, ''),
    }));
    const others = list.filter((other) => other !== post);
    post.more = [
      ...others.filter((other) => other.category === post.category),
      ...others.filter((other) => other.category !== post.category),
    ].map(({ title, file, categoryLabel }) => ({ title, file, categoryLabel }));
    post.ld = postingLd(post, person);
  });
  return list;
}

// schema.org BlogPosting, one per post page.
function postingLd(post, person) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    articleSection: post.categoryLabel,
    inLanguage: 'en',
    ...(post.date ? { datePublished: post.date } : {}),
    author: { '@type': 'Person', name: person.name, sameAs: person.sameAs },
  };
}

// schema.org Person (FD-22), on every page.
function personLd(profile, links, fields) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    alternateName: profile.full_name,
    jobTitle: profile.position,
    affiliation: {
      '@type': 'Organization',
      name: profile.institution,
      department: { '@type': 'Organization', name: profile.department },
    },
    email: `mailto:${profile.email}`,
    sameAs: links.map((link) => link.url),
    // Research interests plus the one field label that is a skill area.
    knowsAbout: [
      ...profile.research_interests,
      ...fields.filter((field) => field.label === 'Software & web').map((field) => field.label),
    ],
  };
}

// schema.org ScholarlyArticle (FD-22), one per publication on Portfolio.
function articleLd(pub) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ScholarlyArticle',
    headline: pub.title,
    name: pub.title,
    author: pub.authors.map((author) => ({ '@type': 'Person', name: author.name })),
    datePublished: String(pub.year),
    isPartOf: {
      '@type': pub.type === 'journal' ? 'Periodical' : 'Event',
      name: pub.venue,
    },
    identifier: { '@type': 'PropertyValue', propertyID: 'DOI', value: pub.doi },
    url: doiUrl(pub.doi),
  };
}
