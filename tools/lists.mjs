// Author: Rasel Al Mamun
// Lists that grow (release 1.6.0, round 3, FD-154): pagination, and the server-rendered states of
// the three list pages — the projects archive (research.html), the Blog and the Publications page.
// Django renders the same markup from `?q=…&topic=…&category=…&page=N`; the static build renders
// the states a reviewer needs as files (research-page-2.html, research-empty.html, …) and the
// preview server maps a query to one of them (`resolveState`). Pure functions; no I/O.

export const PAGE_SIZE = { projects: 9, posts: 9, publications: 20 };

// The slice of a list for one page, clamped to a real page.
export function paginate(list, page, size) {
  const pages = Math.max(1, Math.ceil(list.length / size));
  const asked = Number.parseInt(page, 10);
  const current = Math.min(Math.max(1, Number.isNaN(asked) ? 1 : asked), pages);
  const start = (current - 1) * size;
  return {
    items: list.slice(start, start + size),
    page: current,
    pages,
    total: list.length,
    from: list.length ? start + 1 : 0,
    to: Math.min(start + size, list.length),
  };
}

// "Showing 1–9 of 15 projects", "Showing 3 of 3 projects", "No projects match your search."
export function countLine(p, noun, nounOne) {
  if (!p.total) return `No ${noun} match your search.`;
  const range = p.from === p.to ? `${p.from}` : `${p.from}–${p.to}`;
  return `Showing ${range} of ${p.total} ${p.total === 1 ? nounOne : noun}`;
}

// The pager's view model: null with one page (the component renders nothing). The numbered list
// keeps the first and last page and one page either side of the current one, "…" between.
export function pagerView(p, hrefFor) {
  if (p.pages <= 1) return null;
  const shown = new Set(
    [1, p.pages, p.page - 1, p.page, p.page + 1].filter((n) => n >= 1 && n <= p.pages),
  );
  const items = [];
  let last = 0;
  for (const n of [...shown].sort((a, b) => a - b)) {
    if (n - last > 1) items.push({ gap: true });
    items.push({ n, href: hrefFor(n), current: n === p.page });
    last = n;
  }
  return {
    page: p.page,
    pages: p.pages,
    items,
    prev: p.page > 1 ? { href: hrefFor(p.page - 1) } : null,
    next: p.page < p.pages ? { href: hrefFor(p.page + 1) } : null,
  };
}

const withPage = (base, n) => (n > 1 ? `${base}-page-${n}.html` : `${base}.html`);

// ---- Projects archive -------------------------------------------------------------------------

export const researchFile = ({ topic = '', page = 1, empty = false } = {}) => {
  if (empty) return 'research-empty.html';
  return withPage(topic ? `research-topic-${topic}` : 'research', page);
};

// Cards matching the search (every word in the titles and tags) and the topic.
export function matchCards(cards, { q = '', topic = '' } = {}) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return cards.filter(
    (card) => (!topic || card.topic === topic) && words.every((word) => card.search.includes(word)),
  );
}

// The projects archive for one state (`q`, `topic`, `page`).
export function researchState(archive, state = {}) {
  const q = (state.q ?? '').trim();
  const topic = archive.topics.some((t) => t.id === state.topic) ? state.topic : '';
  const matched = matchCards(archive.cards, { q, topic });
  const p = paginate(matched, state.page, PAGE_SIZE.projects);
  const empty = matched.length === 0;
  const hrefFor = (n) => `/${researchFile({ topic, page: n })}`;
  const topicLabel = archive.topics.find((t) => t.id === topic)?.label;
  const title = [
    'Projects',
    topicLabel,
    empty ? 'search' : null,
    p.page > 1 ? `page ${p.page}` : null,
  ]
    .filter(Boolean)
    .join(' — ');
  return {
    ...archive,
    q,
    topic,
    cards: p.items,
    total: archive.cards.length,
    matched: matched.length,
    isEmpty: empty,
    countText: countLine(p, 'projects', 'project'),
    pager: pagerView(p, hrefFor),
    pageTitle: title,
    // rel="prev" / "next" (Django: the same query with ?page=N).
    relPrev: p.page > 1 ? hrefFor(p.page - 1) : null,
    relNext: p.page < p.pages ? hrefFor(p.page + 1) : null,
    // 1.7.4 (F05): a filtered state (a topic or a search) is noindex,follow with its canonical on the
    // list page, and never in the sitemap; the unfiltered pages are self-canonical.
    robots: topic || q ? 'noindex,follow' : null,
    canonical: topic || q ? 'research.html' : null,
    clearHref: '/research.html',
    file: researchFile({ topic, page: p.page, empty }),
  };
}

// The research states to build as files: page n of everything, page n of each topic, the empty one.
export function researchStates(archive) {
  const states = [];
  const add = (state) => {
    const view = researchState(archive, state);
    if (!states.some((s) => s.file === view.file)) states.push({ file: view.file, state });
  };
  const pagesOf = (topic) =>
    paginate(matchCards(archive.cards, { topic }), 1, PAGE_SIZE.projects).pages;
  for (let page = 1; page <= pagesOf(''); page += 1) add({ page });
  for (const { id } of archive.topics) {
    for (let page = 1; page <= pagesOf(id); page += 1) add({ topic: id, page });
  }
  add({ q: 'no-such-project' });
  return states;
}

// ---- Blog -------------------------------------------------------------------------------------

export const blogFile = ({ category = '', page = 1 } = {}) =>
  withPage(category ? `blog-category-${category}` : 'blog', page);

// The Blog for one state (`category`, `page`). `categories` are those of buildSite (with the
// per-category count text).
export function blogState({ postList, categories, blogView, blogPage }, state = {}) {
  const category = categories.some((c) => c.id === state.category) ? state.category : '';
  const matched = category ? postList.filter((post) => post.category === category) : postList;
  const p = paginate(matched, state.page, PAGE_SIZE.posts);
  const hrefFor = (n) => `/${blogFile({ category, page: n })}`;
  const current = categories.find((c) => c.id === category);
  const title = ['Blog', current?.label, p.page > 1 ? `page ${p.page}` : null]
    .filter(Boolean)
    .join(' — ');
  return {
    category,
    posts: p.items,
    // The tabs are links to the first page of each category.
    tabs: [
      {
        id: '',
        label: 'All',
        href: `/${blogFile()}`,
        current: !category,
        countText: blogView.countText,
      },
      ...categories.map((c) => ({
        id: c.id,
        label: c.label,
        href: `/${blogFile({ category: c.id })}`,
        current: c.id === category,
        countText: c.countText,
      })),
    ],
    countText:
      p.pages > 1 ? countLine(p, 'posts', 'post') : (current?.countText ?? blogView.countText),
    emptyCategory: Boolean(category) && matched.length === 0,
    empty: matched.length === 0,
    pager: pagerView(p, hrefFor),
    pageTitle: title,
    relPrev: p.page > 1 ? hrefFor(p.page - 1) : null,
    relNext: p.page < p.pages ? hrefFor(p.page + 1) : null,
    // 1.7.4 (F05): a category is noindex,follow with its canonical on the Blog.
    robots: category ? 'noindex,follow' : null,
    canonical: category ? 'blog.html' : null,
    file: blogFile({ category, page: p.page }),
    blogPage,
  };
}

export function blogStates(site) {
  const states = [];
  const add = (state) => {
    const view = blogState(site, state);
    if (!states.some((s) => s.file === view.file)) states.push({ file: view.file, state });
  };
  const count = (category) =>
    paginate(
      category ? site.postList.filter((p) => p.category === category) : site.postList,
      1,
      PAGE_SIZE.posts,
    ).pages;
  for (let page = 1; page <= count(''); page += 1) add({ page });
  for (const { id } of site.categories) {
    for (let page = 1; page <= count(id); page += 1) add({ category: id, page });
  }
  return states;
}

// ---- Publications -----------------------------------------------------------------------------

export const publicationsFile = (page = 1) => withPage('publications', page);

// The Publications page for one page: the rows grouped by year (newest first) as before; split
// into pages of 20 only when there are more than 20 (never with today's eight).
export function publicationsState(publicationRows, state = {}) {
  const flat = publicationRows.flatMap((group) =>
    group.items.map((item) => ({ year: group.year, item })),
  );
  const p = paginate(flat, state.page, PAGE_SIZE.publications);
  const rows = [];
  for (const { year, item } of p.items) {
    const last = rows.at(-1);
    if (last?.year === year) last.items.push(item);
    else rows.push({ year, items: [item] });
  }
  const hrefFor = (n) => `/${publicationsFile(n)}`;
  return {
    rows,
    pager: pagerView(p, hrefFor),
    countText: p.pages > 1 ? countLine(p, 'publications', 'publication') : '',
    pageTitle: p.page > 1 ? `Publications — page ${p.page}` : 'Publications',
    relPrev: p.page > 1 ? hrefFor(p.page - 1) : null,
    relNext: p.page < p.pages ? hrefFor(p.page + 1) : null,
    file: publicationsFile(p.page),
    pages: p.pages,
  };
}

export function publicationsStates(publicationRows) {
  const { pages } = publicationsState(publicationRows, { page: 1 });
  return Array.from({ length: pages }, (_, i) => ({
    file: publicationsFile(i + 1),
    state: { page: i + 1 },
  }));
}

// ---- Preview server ---------------------------------------------------------------------------

// The file that answers `/<file>?<query>` in the static preview (Django answers the query itself):
// a topic, a category or a page maps to its state file; a search with no match to the empty
// state; any other search to the unfiltered page (the preview does not search free text).
export function resolveState(file, params, site) {
  const query = params instanceof URLSearchParams ? params : new URLSearchParams(params);
  const page = Number.parseInt(query.get('page') ?? '1', 10) || 1;
  if (file === 'research.html') {
    const view = researchState(site.archive, {
      q: query.get('q') ?? '',
      topic: query.get('topic') ?? '',
      page,
    });
    return view.file;
  }
  if (file === 'blog.html') {
    return blogState(site, { category: query.get('category') ?? '', page }).file;
  }
  if (file === 'publications.html') {
    return publicationsState(site.publicationRows, { page }).file;
  }
  return file;
}
