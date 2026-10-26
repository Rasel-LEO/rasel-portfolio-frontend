# Handover — mounting the frontend in Django

Author: Rasel Al Mamun

This document describes how the static frontend (v1.0.0) becomes the templates and static
files of the Django site. The frontend stays the reference: the Django pages should render
the same HTML as `dist/` for the same content, apart from the template tags listed here.
Decision ids (FD-xx) refer to `docs/decisions.md`.

## 1. Architecture and build

- Vite 8 multi-page build. Pages are Handlebars templates in `src/pages/`, partials in
  `src/partials/{shell,components,sections,icons}/`, rendered at build time with the content
  of `src/content/*.json` as the context (`vite.config.js`, `tools/content.mjs`). The built
  HTML in `dist/` contains no template syntax.
- Styles: Sass with Bootstrap 5.3 (`src/scss/main.scss`) compiled to one hashed CSS file.
  Design tokens: `src/design/tokens.json` → `src/scss/base/_tokens.scss` (`npm run tokens`).
- Scripts: ES modules in `src/js/`; `main.js` loads the shell modules, then the page module
  chosen by `<body data-page="…">`, then site-wide motion when the OS allows motion. GSAP +
  ScrollTrigger and Lenis load with dynamic `import()` only where used (FD-52).
- `public/js/theme-init.js` is a classic script copied as-is; it must stay the first element
  in `<head>`, synchronous, not bundled (FD-12).
- Derived values (counts, orders, featured cards, short citations, reading time, tables of
  contents, prev/next projects, JSON-LD) are computed in `tools/content.mjs`; each needs a
  Django equivalent (model method, template tag or view context).

Recommended route: keep this repository as the source of the CSS and JS bundles (run
`npm run build`, copy `dist/assets/` into the Django app's `static/`), and translate the
Handlebars pages and partials into Django templates once. A Vite manifest
(`build.manifest: true`) can map entry names to hashed files if the copy is automated.

## 2. Pages, templates and URLs

| Static page (`src/pages/`)                                  | Django template               | URL                        | View context                                                                                          |
| ----------------------------------------------------------- | ----------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `index.html`                                                | `home.html`                   | `/`                        | profile, home, featured projects, first-author publications, latest published posts, fields, services |
| `portfolio.html`                                            | `portfolio/index.html`        | `/portfolio/`              | profile, links, portfolio block, publications, projects, awards, education, certifications, skills    |
| `publications.html`                                         | `portfolio/publications.html` | `/portfolio/publications/` | all publications by year and type                                                                     |
| `research.html`                                             | `portfolio/research.html`     | `/portfolio/research/`     | all projects, research-archive labels, topics                                                         |
| `portfolio-entry.html` → `project-<id>.html` (15 generated) | `portfolio/detail.html`       | `/portfolio/<slug>/`       | one project, related publication, prev/next                                                           |
| `blog.html`                                                 | `blog/index.html`             | `/blog/`                   | published posts, categories, blog-page labels                                                         |
| `blog-post.html` → `post-<slug>.html` (one per post)        | `blog/post.html`              | `/blog/<slug>/`            | one post, its table of contents, more posts                                                           |
| `hire.html`                                                 | `hire.html`                   | `/hire/`                   | hire block, services, process, form                                                                   |
| `contact.html`                                              | `contact.html`                | `/contact/`                | contact block, links, form                                                                            |
| `404.html`                                                  | `404.html`                    | handler404                 | `meta.404` line                                                                                       |

Generated project pages today: `project-poultry-aiot-edge`, `-poultry-iot-undergrad`,
`-biofloc-iot`, `-machinery-tracking`, `-solar-irrigation`, `-fish-feed-spreader`,
`-potato-grading-nn`, `-power-tiller-ergonomics`, `-biofloc-winter`, `-egg-incubator`,
`-hydroponics-led`, `-multi-nozzle-sprayer`, `-rice-germination`, `-solar-irrigation-ai`,
`-ice-storage-boxes` (the slug is the project `id`). Post pages: one per post in
`blog.json` (`post-<slug>.html`); with `RELEASE=true` only published posts.

Internal links in the static build point at the flat files (`portfolio.html`,
`project-<id>.html`, `post-<slug>.html`, `portfolio.html#publications`); in Django they
become `{% url %}` tags (`portfolio.html#publications` → `{% url 'portfolio' %}#publications`).

Navigation state: `vite.config.js` (`pageNav`) gives each page a nav key; the `ariaCurrent`
helper writes `aria-current="page"` on the current section's link in the header, drawer and
footer, and `aria-current="true"` on detail pages (project, post, publications, research).
In Django: a `nav` value in the view context and a small template tag or `{% if %}`.

## 3. Partials → includes

Partial groups map to template folders: `{{> shell/header}}` → `{% include "shell/header.html" %}`;
parameters become `with` arguments (`{{> components/field id="hire-name" …}}` →
`{% include "components/field.html" with id="hire-name" … %}`).

| Partial                                                                                          | Used by                                                                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `shell/head`                                                                                     | every page (title, description, OG/Twitter, preloads, JSON-LD, the two scripts)                                    |
| `shell/page-wipe`, `shell/header`, `shell/drawer`, `shell/footer`, `shell/back-to-top`           | every page                                                                                                         |
| `components/cv-button`                                                                           | Home, Portfolio, Hire me, drawer                                                                                   |
| `components/field`                                                                               | Hire me, Contact (label, control, hint, error region)                                                              |
| `components/email-box`                                                                           | Hire me, Contact (email + Copy button)                                                                             |
| `components/pf-tabs`                                                                             | Portfolio, publications                                                                                            |
| `components/status-chip`, `components/tag-pills`                                                 | project cards, archive cards, project page                                                                         |
| `components/project-image`                                                                       | project page                                                                                                       |
| `components/draft-chip`                                                                          | post page (draft builds only)                                                                                      |
| `sections/work-card`, `sections/home-pub`, `sections/latest-card`, `sections/service`            | Home (service also Hire me)                                                                                        |
| `sections/pf-card`, `sections/pf-pub`, `sections/articles-ld`                                    | Portfolio (pf-pub and articles-ld also publications)                                                               |
| `sections/archive-card`                                                                          | research                                                                                                           |
| `sections/related-pub`                                                                           | project page                                                                                                       |
| `sections/blog-card`, `sections/blog-empty`                                                      | Blog                                                                                                               |
| `sections/profile-links`                                                                         | Contact                                                                                                            |
| `icons/area-icon`, `icons/line-icon`, `icons/pf-icon`, `icons/footer-icon`, `icons/illustration` | inline SVG icons by name; in Django one include per icon set with an `{% if name == … %}` chain, or a template tag |

Handlebars helpers and their Django equivalents: `eq`/`and`/`or`/`not` → `{% if %}`;
`ordinal` → `{{ forloop.counter|stringformat:"02d" }}`; `count` → `|length`; `doiUrl` →
`https://doi.org/{{ doi }}`; `isPlaceholder` (text in `[brackets]` gets `.is-placeholder`) →
a filter; `isExternal` → a filter (external links open in a new tab with ↗ and the hidden
text "(opens in a new tab)", FD-76); `authors` (the site author in `<strong>`) → a filter;
`phrase` → a filter; `jsonLd` → `json_script`-style escaping of `<`, `>` and `&` inside
`<script type="application/ld+json">`.

## 4. Content → models

`src/content/*.json` is the content model. Proposed Django models (fields as in the JSON;
`*` optional):

| Model                  | Fields                                                                                                                                                                                                                 | Source                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Profile` (single)     | name, full_name, citation_names (list), position, department, institution, location, affiliation_short, eyebrow, role_line, statement, summary, email, languages (list), cv (file*), research_interests (list)         | `profile.json`                                               |
| `Link`                 | key (`id`), label, handle, url, order                                                                                                                                                                                  | `links.json`                                                 |
| `Publication`          | key, year, type (journal / conference), first_author (bool), title, venue, details, display_details*, doi, project (FK Project*)                                                                                       | `publications.json`                                          |
| `PublicationAuthor`    | publication (FK), name, is_me (bool), order                                                                                                                                                                            | `publications.json` `authors`                                |
| `Project`              | slug (`id`), title, short_title, short_summary, role, period, status, topic (FK Topic), contribution, featured (bool), featured_order*, featured_large*, featured_role_line*, tags (M2M Tag), featured_tags (M2M Tag*) | `projects.json`                                              |
| `ProjectDetail`        | project (1:1), summary_line, facts (role, institution, unit, technology, output), system_note, overview, context; contribution items (ordered list)                                                                    | `projects.json` `detail`                                     |
| `ProjectBlock`         | project (FK), kind (system / result), icon, title, text, order                                                                                                                                                         | `detail.system`, `detail.results`                            |
| `Topic`                | key, label, icon                                                                                                                                                                                                       | `research-archive.json` `topics`                             |
| `Award`                | year, title, by; Portfolio card: kind, highlight, icon                                                                                                                                                                 | `awards.json`, `portfolio.json` `awards.items`               |
| `Education`            | year, degree, institution, thesis                                                                                                                                                                                      | `education.json`, `portfolio.json` `experience.education`    |
| `Role` (experience)    | title, period, unit, institution, text, bullets (list), order                                                                                                                                                          | `portfolio.json` `experience.roles`                          |
| `Certification`        | title, by                                                                                                                                                                                                              | `certifications.json`, `portfolio.json` `expertise.training` |
| `SkillGroup`           | group, icon*, items (list), order                                                                                                                                                                                      | `skills.json`, `portfolio.json` `expertise.groups`           |
| `Post`                 | slug, title, short_title, standfirst, category (FK Category), status (draft / published), date* (published), body (Markdown), cover (illustration key + alt, later an image)                                           | `blog.json`, `posts/<slug>.md`, `blog-page.json` `covers`    |
| `Category`             | key, label, order                                                                                                                                                                                                      | `blog-page.json` `categories`                                |
| `Service`              | number, title, summary, items (list), evidence label + url                                                                                                                                                             | `hire.json` `services`                                       |
| `Field` (area of work) | label, target, icon, order                                                                                                                                                                                             | `fields.json`                                                |
| Page copy              | one settings-style model (or a JSON field) per block: home, portfolio, blog page, post sidebar, research archive, hire, contact, footer, meta descriptions, memberships, activities                                    | the remaining files                                          |

Validation that `tools/validate-content.mjs` runs before every build must move into model
validation or a management command: unique ids/slugs, publication → project references, DOI
format, ISO dates, a published post has a date and a written standfirst, a Markdown body per
post, featured cards and their order, `featured_tags` a subset of `tags`, no
`[bracketed]` placeholder on published content. `tools/check-privacy.mjs` (no phone numbers,
no private CV fields, FD-23) should run on rendered pages in the Django test suite.

Post bodies are Markdown rendered at build time with the rules of FD-37 / FD-41
(`tools/markdown.mjs`): raw HTML escaped, only http(s), mailto and relative links, `h2`
ids for the table of contents, code blocks as focusable scroll regions, `[Figure: …]`
paragraphs as labelled placeholders. Port the same rules (for example `markdown-it` or
`Python-Markdown` with a sanitiser and the same output classes).

## 5. Static files

- Copy `dist/assets/*` (hashed CSS, JS chunks, fonts, images) to the app's `static/`, and
  `dist/js/theme-init.js` as-is. In templates, every `/assets/…` and `/js/…` URL becomes
  `{% static '…' %}`; run `collectstatic` on deploy.
- Use `ManifestStaticFilesStorage` (or keep Vite's hashes and serve with long cache
  headers: `Cache-Control: public, max-age=31536000, immutable` for hashed files).
- Fonts are subset woff2 files (FD-130); keep the `<link rel="preload" as="font" … crossorigin>`
  for the Bricolage file and the avatar / Home hero image preloads from `shell/head`.
- Images: `<picture>` with AVIF + WebP, explicit `width` / `height`, `loading="lazy"` below
  the first screen (FD-130). Owner photographs are not licensed for reuse.

## 6. Content Security Policy

Send this header on every response (`django-csp` or middleware); the markup needs nothing
else:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Templates must keep: no inline `<script>` except the `application/ld+json` data blocks, no
`on*=` attributes, no `style=` attributes, no third-party origins. Port
`tools/check-csp.mjs` as a test over rendered pages.

## 7. Theme

Dark is the default (`:root`); light applies with `data-theme="light"` on `<html>`. The
choice is stored in the cookie `theme` (`dark` / `light`, path `/`, `SameSite=Lax`, one year,
`Secure` on HTTPS) and in `localStorage` (FD-12). Django reads the cookie and renders
`<html lang="en" data-theme="light">` when it is `light`, so the first paint is already right;
`theme-init.js` stays as the fallback for cached pages. It also adds the `js` class to `<html>`
(`.js-only` controls depend on it, FD-121), so Django must not render `class="js"` itself;
and when both are set, `localStorage` wins over the cookie.

## 8. Forms

| Form    | Fields (name: rule)                                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Hire me | `name`: required; `email`: required, email; `kind`: one of `hire.form_kinds`; `organisation`: optional; `brief`: required       |
| Contact | `name`: required; `email`: required, email; `subject`: one of `contact.subjects`; `organisation`: optional; `message`: required |

- Today the forms are `<form method="post">` without sending: `src/js/pages/forms.js`
  validates (messages in that file), marks fields with `aria-invalid` and
  `aria-describedby`, moves focus to the first error and shows a status message with a
  prefilled `mailto:` link (FD-38, FD-40). Without JavaScript the browser's native checks run.
- Django: set `action` to the view URL, add `{% csrf_token %}`, validate server-side with
  the same rules and messages, render errors into the existing error regions
  (`#<id>-error`, `[data-error-text]`, `hidden` removed) with `aria-invalid="true"`, and the
  result into the `role="status"` region (`[data-form-status]`). Send by email (SMTP) and
  add spam protection without third-party scripts (honeypot field, rate limit). Redirect
  after a successful POST (PRG) and keep the entered values on errors.

## 9. Drafts and the release build

- Posts have `status` `draft` or `published`. `SHOW_DRAFTS` (default true while designing)
  builds drafts with a "Draft" chip; `RELEASE=true` hides drafts unless `SHOW_DRAFTS` says
  otherwise: the Blog shows its empty state, Home has no Latest posts section, no draft post
  page is built (FD-36, FD-45, FD-103, FD-131).
- Django: a `Post.objects.published()` manager for every public view; drafts only in the
  admin preview (and marked `noindex`).

## 10. Search engines

- `<title>`: the page's short title + " — Rasel Al Mamun", at most 60 characters (FD-128);
  the formal title stays in the `h1` and in Open Graph / Twitter titles.
- One meta description per page (`meta.json`, the project contribution, the post standfirst).
- JSON-LD: `Person` on every page, `WebSite` on Home, `ScholarlyArticle` per publication on
  Portfolio and publications, `BlogPosting` on posts (`tools/content.mjs`).
- `SITE_URL` (no domain yet, FD-22): when set, canonical links, `og:url` and absolute
  `og:image` / `twitter:image` URLs, `sitemap.xml` and the `Sitemap:` line in `robots.txt`
  (FD-131). Django: `django.contrib.sitemaps` with the same pages (Home, Portfolio,
  publications, research, Blog, Hire me, Contact, every project and published post) and
  `request.build_absolute_uri` for canonical URLs.
- `noindex` on the two template pages; in Django it applies only to draft previews.

## 11. Accessibility and motion contracts

Templates must keep, unchanged:

- Landmarks (`header`, `nav` with labels, `main#main`, `footer`), the skip link as the first
  focusable element, one `h1` per page, visible focus (2 px `--focus` ring).
- The drawer below 992 px (Bootstrap offcanvas: `aria-controls`, `aria-expanded`, focus
  trap, Escape), the theme button (its accessible name "Theme: dark" / "Theme: light" carries the state, no `aria-pressed`, FD-17; visible label from 992 px), the
  back-to-top button on every page after the first screen (DD-17, FD-13).
- Tabs and filters as button groups with `aria-pressed`; result counts in `role="status"`;
  hidden controls only for JS-only features (`.js-only`).
- Decorative figures `aria-hidden="true"` with `alt=""`; external links with the hidden
  "(opens in a new tab)".
- Every `data-*` attribute in the templates is a hook for a script or a style: keep them all,
  with their names and values. Among them: `data-page` on `<body>` (selects the page module),
  `data-reveal` (reveals; never on content on screen at load), `data-stage*`, `data-home`,
  `data-screen`, `data-fork-col`, `data-contact-figure` (Home motion), `data-page-wipe`,
  `data-brand`, `data-menu-button`, `data-back-to-top`, `data-back-to-top-sentinel`,
  `data-theme-toggle`, `data-theme-state` (shell), `data-section-nav`, `data-pub-*`,
  `data-type` (Portfolio and publications), `data-blog-empty`, `data-empty-*`, `data-category*`,
  `data-draft-label`, `data-post-*` (Blog and posts), `data-archive-*`, `data-project-card`,
  `data-count*` (research), `data-form*`, `data-error-text`, `data-email`, `data-copy-*`
  (forms), `data-pf-*` (Portfolio styles). Renaming one breaks the matching module in
  `src/js/` or its styles.
- Motion is always on (DD-16); the OS `prefers-reduced-motion` setting is respected through
  `gsap.matchMedia()` and CSS media queries. No motion switch.

## 12. Tests to port

`npm test` runs: `tools/check-csp.mjs` (CSP-safe markup), `tools/check-privacy.mjs`,
`html-validate` over the built HTML, and the Playwright suite (`tests/*.spec.js`: content,
pages, accessibility with axe, shell, Portfolio, Blog, forms, Home, stage, motion, inner
pages, release: noindex, sitemap, 400 % zoom), plus `npm run test:widths` (seven widths, both themes) and `npm run lhci`
(Lighthouse budgets, FD-129). The Playwright specs drive the browser through URLs and
selectors, so most of them run against the Django server after two changes: the
`baseURL` / `webServer` in `playwright.config.js`, and the page list in `tests/pages.js`
(flat file names → Django URLs). The Node-only content tests become Django model and view
tests.

## 13. Owner content still pending

- Blog posts: the three posts are drafts with `[bracketed]` bodies; final text, dates and
  `status: published`.
- The public CV PDF (`docs/content/web-cv.md` is its text; `profile.cv` is `null`).
- Final project photographs (`[Photo: …]` placeholders stay until supplied) and a larger
  original hero photograph (the hero stays 720 px wide until then, FD-130).
- Poultry AIoT project details: the M.S. thesis project (in progress) has no `detail` block yet,
  so its page shows the summary fields only.
- The domain (`SITE_URL`): canonical URLs, absolute social images, sitemap.
