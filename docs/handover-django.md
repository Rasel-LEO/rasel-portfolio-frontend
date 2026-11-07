# Handover — mounting the frontend in Django

Author: Rasel Al Mamun

This document describes how the static frontend (v1.6.0) becomes the templates and static
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

Recommended route: keep this repository as the source of the CSS and JS bundles, and
translate the Handlebars pages and partials into Django templates once.

Two build targets (FD-133, since 1.0.1):

| Command                | Output         | Base                | Manifest | Use                                     |
| ---------------------- | -------------- | ------------------- | -------- | --------------------------------------- |
| `npm run build`        | `dist/`        | `/`                 | no       | the static site (unchanged since 1.0.0) |
| `npm run build:django` | `dist-django/` | `/static/frontend/` | yes      | the files Django serves                 |

`npm run build:django` runs `vite build --mode django` (after the same token and content
steps as `npm run build`) with the same pages, content mode (default, non-RELEASE), chunking
and CSP rules; only the base differs, plus `.vite/manifest.json` and `.vite/asset-map.json`.
Its HTML is the markup reference for the Django parity tests: each page equals the
`dist/` page once `/static/frontend/` is replaced by `/` (the five chunks that embed the base
— `main`, `motion`, `stage`, `stage-desktop`, `home-motion` — get different hashes).
`tools/check-django-build.mjs` (part of `npm test` and CI) proves it, and that every asset
URL in the HTML and CSS exists and resolves from the manifest or the asset map.

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
| `privacy.html` (1.5.0, FD-143)                              | `privacy.html`                | `/privacy/`                | the `privacy` copy block                                                                              |
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

| Partial                                                                                          | Used by                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shell/head`                                                                                     | every page (title, description, OG/Twitter, preloads, JSON-LD, the two scripts)                                                                                                       |
| `shell/page-wipe`, `shell/header`, `shell/drawer`, `shell/footer`, `shell/back-to-top`           | every page                                                                                                                                                                            |
| `components/cv-button`                                                                           | Home, Portfolio, Hire me, drawer                                                                                                                                                      |
| `components/field`                                                                               | Hire me, Contact (label, control, hint, error region)                                                                                                                                 |
| `components/pf-tabs`                                                                             | Portfolio, publications                                                                                                                                                               |
| `components/status-chip`, `components/tag-pills`                                                 | project cards, archive cards, project page                                                                                                                                            |
| `components/card-image`                                                                          | project and post cards, page-top image (1.7.0)                                                                                                                                        |
| `components/draft-chip`                                                                          | post page (draft builds only)                                                                                                                                                         |
| `sections/work-card`, `sections/home-pub`, `sections/latest-card`, `sections/service`            | Home (service also Hire me)                                                                                                                                                           |
| `sections/pf-card`, `sections/pf-pub`, `sections/articles-ld`                                    | Portfolio (pf-pub and articles-ld also publications)                                                                                                                                  |
| `sections/archive-card`                                                                          | research                                                                                                                                                                              |
| `sections/related-pub`                                                                           | project page                                                                                                                                                                          |
| `sections/blog-card`, `sections/blog-empty`                                                      | Blog                                                                                                                                                                                  |
| `samples/rich-post`, `samples/rich-overview`                                                     | the two template pages only (FD-142): Django's own rich-content output, the parity reference; no Django include                                                                       |
| `icons/area-icon`, `icons/line-icon`, `icons/pf-icon`, `icons/footer-icon`, `icons/illustration` | inline SVG icons by name; in Django one include per icon set with an `{% if name == … %}` chain, or a template tag                                                                    |
| `icons/logo-symbols` (in `shell/header`), `icons/logo`, `icons/logo-mark`                        | every page: the Ideatrium logo geometry once per page as `<symbol>`s, drawn by `<use>` in the header, drawer and footer (FD-139); keep the fixed `width` / `height` and `aria-hidden` |

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

| Model                  | Fields                                                                                                                                                                                                                                                                                  | Source                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `Profile` (single)     | name, full_name, citation_names (list), position, second_role, department, institution, location, location_line, affiliation_short, eyebrow, eyebrow_short, role_line, author_line, statement, summary, email, secondary_email, languages (list), cv (file*), research_interests (list) | `profile.json`                                               |
| `Link`                 | key (`id`), label, handle, url, order                                                                                                                                                                                                                                                   | `links.json`                                                 |
| `Publication`          | key, year, type (journal / conference), first_author (bool), title, venue, details, display_details*, doi, project (FK Project*)                                                                                                                                                        | `publications.json`                                          |
| `PublicationAuthor`    | publication (FK), name, is_me (bool), order                                                                                                                                                                                                                                             | `publications.json` `authors`                                |
| `Project`              | slug (`id`), title, short_title, card_description, role_line, card_tags (3, from tags), card_image (1600 × 900, alt), meta_description* (≤ 160, 1.7.4), role, period, status, topic (FK Topic), contribution, featured (bool), featured_order*, featured_large*, tags (M2M Tag)         | `projects.json`                                              |
| `ProjectDetail`        | project (1:1), summary_line, facts (role, institution, unit, technology, output), overview, methods, results_text, limitations (Markdown with `[Figure n]`), figures (image, n, caption, size), system_note, context; contribution items (ordered list)                                 | `projects.json` `detail`                                     |
| `ProjectBlock`         | project (FK), kind (system / result), icon, title, text, order                                                                                                                                                                                                                          | `detail.system`, `detail.results`                            |
| `Topic`                | key, label, icon                                                                                                                                                                                                                                                                        | `research-archive.json` `topics`                             |
| `Award`                | year, title, by; Portfolio card: kind, highlight, icon                                                                                                                                                                                                                                  | `awards.json`, `portfolio.json` `awards.items`               |
| `Education`            | year, degree, institution, thesis                                                                                                                                                                                                                                                       | `education.json`, `portfolio.json` `experience.education`    |
| `Role` (experience)    | title, period, unit, institution, text, bullets (list), order                                                                                                                                                                                                                           | `portfolio.json` `experience.roles`                          |
| `Certification`        | title, by                                                                                                                                                                                                                                                                               | `certifications.json`, `portfolio.json` `expertise.training` |
| `SkillGroup`           | group, icon*, items (list), order                                                                                                                                                                                                                                                       | `skills.json`, `portfolio.json` `expertise.groups`           |
| `Post`                 | slug, title, short_title, standfirst, card_description, card_image (1600 × 900, alt), figures*, meta_description* (≤ 160, 1.7.4), category (FK Category), status (draft / published), date* (published), body (Markdown)                                                                | `blog.json`, `posts/<slug>.md`                               |
| `Category`             | key, label, order                                                                                                                                                                                                                                                                       | `blog-page.json` `categories`                                |
| `Service`              | number, title, summary, items (list), evidence label + url                                                                                                                                                                                                                              | `hire.json` `services`                                       |
| `Field` (area of work) | label, target, icon, order                                                                                                                                                                                                                                                              | `fields.json`                                                |
| Page copy              | one settings-style model (or a JSON field) per block: home, portfolio, blog page, post sidebar, research archive, hire, contact, footer, meta descriptions, memberships, activities                                                                                                     | the remaining files                                          |

**CV download (1.5.2, FD-146): Django must serve `/cv/Rasel_Al_Mamun_CV.pdf`.** Every CV action
(`components/cv-button`: Home, Portfolio, Hire me, drawer) is a plain link "Download CV (PDF)" to
that site-root URL (`Profile.cv.href`; not under `/static/frontend/`), without a `download`
attribute so the PDF opens in the browser. Serve the real file there with
`Content-Type: application/pdf`; until it exists the link 404s. The PDF is not in the frontend
repository: `dist/` carries a placeholder only for the frontend's own preview and tests, and
`dist-django/` and the public export never contain a PDF. The old CV-request `mailto:` is gone.

New field in 1.5.1 (FD-145): `Profile.secondary_email` (`mr.raselalmamun@gmail.com`), shown after
`email` as its own `mailto:` link named "Email <address>" in `shell/footer` (every page), the
Home contact band (`index`) (the Contact and Hire me "Direct" card and the Copy button were removed in 1.6.0, round 5). The form's static mailto, the Person JSON-LD and the Privacy Policy use
`email` only.

New copy keys in 1.4.0 (FD-139, FD-140, FD-141): `footer.signature_by` ("by Rasel Al Mamun",
the text beside the footer logo), `footer.ai_portrait_note` (the AI-portrait disclosure under
the copyright on every page; any descriptive alt text of the P5 / P6 figures must end with
"(AI-generated from my own photo)"), `contact.privacy_notice` and `hire.privacy_notice` (the
owner-approved privacy notice under each form; the same text in both).

**Copy keys in 1.5.0** (FD-140 amended, FD-143): the new file `privacy.json` holds every word of
the Privacy Policy page and of the line under the forms — `version` (the content version, now
"1.1", the final text), `title`, `short_title`, `description`, `link_label` ("Privacy Policy", the footer
and form link), `form_line`, `updated_label`, `updated` (ISO date, the `<time datetime>`),
`updated_text`, `intro` (paragraphs), `sections` (each `id`, `heading` and any of
`paragraphs`, `list` of `label` + `text`, `table` of `columns` + `rows`,
`paragraphs_after`). Email addresses in the paragraphs become `mailto:` links (the `mailLinks`
helper: escape the text, then link each address). **Removed:** `contact.privacy_notice` and
`hire.privacy_notice`. The owner's decision keeps this text in the site copy in Git (not the
admin), so a wording change is a small reviewed commit with a dated record.

Validation that `tools/validate-content.mjs` runs before every build must move into model
validation or a management command: unique ids/slugs, publication → project references, DOI
format, ISO dates, a published post has a date and a written standfirst, a Markdown body per
post, featured cards and their order, `card_tags` (three) a subset of `tags`, no
`[bracketed]` placeholder anywhere in published content, and (1.7.4, FD-186) every limit of
`tools/limits.mjs`: page titles, 160-character descriptions, the § 14.1 slots and list counts. `tools/check-privacy.mjs` (no phone numbers,
no private CV fields, FD-23) should run on rendered pages in the Django test suite.

Post bodies are Markdown rendered at build time with the rules of FD-37 / FD-41
(`tools/markdown.mjs`): raw HTML escaped, only http(s), mailto and relative links, `h2`
ids for the table of contents, code blocks as focusable scroll regions, `[Figure: …]`
paragraphs as labelled placeholders. Port the same rules (for example `markdown-it` or
`Python-Markdown` with a sanitiser and the same output classes). **1.5.0:** each Markdown table
region is named by its number in the post, `aria-label="Table 1"`, `"Table 2"`, … (was
"Table" for all); Django's Markdown renderer (`prose-table`) should number them the same way.

**Rich content (FD-142, 1.5.0).** The frontend stylesheet now styles Django's rich-text output
with Django's class names, on the design tokens in both themes. After the pin, Django can drop
the stopgap public rules of its `richtext-content.css` (its `.rt-content` palette rules stay
for the staff previews and the editor):

| Django output (unchanged)                                                                                     | Where                            | Frontend rule                                            |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------------------------------------------- |
| `div.rt-content` (HTML post body)                                                                             | inside `.prose` on the post page | `_rich.scss`: grid flow, lists, quote, `hr`, `mark`      |
| `div.rt-table-scroll[role=region][tabindex=0][aria-label="Table N"]`                                          | post body                        | shared with `.prose-table` (`_pages.scss`)               |
| `pre.rt-code[tabindex=0] > code.language-* > span.tok-*`, plain `pre > code`                                  | post body                        | shared with `.prose-code`; token colours in `_rich.scss` |
| `div.rt-math-display[tabindex=0] > math[display=block]`, inline `math[display=inline]`                        | post body, Overview              | scrolls in its wrapper; `fg-0`                           |
| `figure.rt-figure` (+ `rt-figure-wide` / `-narrow`, `rt-align-center`, `rt-figure-decorative`) with `picture` | post body                        | `_rich.scss`                                             |
| `rt-align-*`, `rt-size-*`, `rt-color-*` (orange and purple use the tokens `text-orange` and `text-purple`)    | post body                        | `_rich.scss`                                             |
| `div.project-text.project-rich` (E-4B Overview)                                                               | project page, Overview           | `_rich.scss`: lists, inline code, flow                   |

The template pages `blog-post.html` and `portfolio-entry.html` show one sample of each, generated
with the Django renderer itself (`src/partials/samples/`); the parity test can compare Django's
render of the same stored HTML with those bytes (only the image URLs differ). Links in rich
text keep the site's inline-link rule; Django's contract drops `target`, so they open in the same
tab. **The FD-76 new-tab rule does not apply to post and project text** (owner decision, fix round).

## 5. Static files

- Run `npm run build:django` and copy from `dist-django/` into the app's
  `static/frontend/` (FD-133):
  - `assets/` (hashed CSS, JS chunks, fonts, images);
  - `.vite/manifest.json` (Vite manifest: source path → hashed file);
  - `.vite/asset-map.json` (the supplementary map below);
  - `.vite/root-files.json` (the root files, below; FD-139);
  - `js/theme-init.js` (classic script, as-is);
  - the brand files, as-is: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`,
    `icon-192.png`, `icon-512.png`, `site.webmanifest` and
    `images/brand/share-image-1200x630.png` (FD-139).

  The HTML files are not copied; they are the reference for the templates.

- Resolve URLs by source key (paths relative to `src/`; `public/` for `js/theme-init.js`),
  never by hashed name: `{% static 'frontend/' %}` + the built path. Manifest keys that start
  with `_` name shared chunks by their hashed file and change with every build; templates do
  not use them (the lazy chunks are loaded by `main.js` itself).
- Asset map (`.vite/asset-map.json`, written by the `django-target` plugin in
  `vite.config.js`): the files Vite's manifest does not key by source path.

  | Key                | Built file               | Why not in the manifest                                  |
  | ------------------ | ------------------------ | -------------------------------------------------------- |
  | `js/main.js`       | `assets/main-<hash>.js`  | shared by every page, so a chunk with a hashed key       |
  | `scss/main.scss`   | `assets/main-<hash>.css` | the stylesheet of that chunk (its `css` in the manifest) |
  | `js/theme-init.js` | `js/theme-init.js`       | a `public/` file, copied unhashed                        |
  | the brand files    | the same path            | `public/` files, copied unhashed (FD-139)                |

- **Root files** (FD-139). `.vite/root-files.json` lists the files Django must also serve at
  the **site root**: `/favicon.ico`, `/favicon.svg`, `/apple-touch-icon.png`,
  `/icon-192.png`, `/icon-512.png` and `/site.webmanifest`. Browsers ask for
  `/favicon.ico` and `/apple-touch-icon.png` there on their own, and the manifest names its
  icons by root path. Serve them from `static/frontend/` through one small view or URL
  pattern each (or the web server), with their types (`image/x-icon`, `image/svg+xml`,
  `image/png`, `application/manifest+json`). The pages link them under the static URL
  (`{% static 'frontend/favicon.ico' %}`, …), which works as well; `check-django-build.mjs`
  checks the list, the files and the links, and `tests/django.spec.js` asks for each one at
  the root.

- Keys per page (`shell/head` and the page bodies):

  | Page       | In `<head>`                                                                                                                                                                                                                                            | In the body (manifest)                                                                                                    |
  | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
  | every page | `js/theme-init.js` (first, classic), `js/main.js` (`type="module" crossorigin`), `scss/main.scss` (`rel="stylesheet" crossorigin`), `og:image` / `twitter:image` `images/brand/share-image-1200x630.png`, the icon links and the manifest (root files) | `images/figure/P5-desktop-720x1300.{avif,webp}` (back to top); the header, drawer and footer logo is inline SVG (no file) |
  | Home, 404  | as above                                                                                                                                                                                                                                               | also `images/figure/P6-desktop-720x1300.{avif,webp}`                                                                      |
  | Portfolio  | as above                                                                                                                                                                                                                                               | also `images/avatar/avatar-512.avif`                                                                                      |

  Preload keys: every page `fonts/bricolage-grotesque-latin-standard-normal.woff2`
  (`as="font" type="font/woff2" crossorigin`); Home also `images/figure/P5-desktop-720x1300.avif` (`as="image"`, with
  `imagesrcset`, `media="(min-width: 768px)"`, `fetchpriority="high"`).
  The stylesheet refers to `fonts/jetbrains-mono-latin-{400,500}-normal.woff2`,
  `images/arrow.svg` and `images/placeholder.svg` by URL under `/static/frontend/assets/`, so
  the `assets/` folder must keep its layout.

- Run `collectstatic` on deploy. Vite's hashes already make the files immutable: serve
  `static/frontend/assets/` with `Cache-Control: public, max-age=31536000, immutable`
  (`ManifestStaticFilesStorage` is not needed for them).
- Fonts are subset woff2 files (FD-130); keep the `<link rel="preload" as="font" … crossorigin>`
  for the Bricolage file and the Home hero image preload from `shell/head`.
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

- Under each form (FD-140, amended in 1.5.0): `<p class="form-notice">` right after `</form>`
  with `privacy.form_line` ("Your details are used only to reply and are processed in the EU and US."), a space,
  and the link to `/privacy/` labelled `privacy.link_label` (a plain link, no JavaScript). The
  full notice — retention, the IP sentence, the processors — is on the Privacy Policy page
  (FD-143). Its promises must stay true of the Django side: messages deleted automatically after
  365 days, no IP address stored with a message (only a one-way code for the rate limit), sent to
  the owner's mailbox through Resend.
- The forms are `<form method="post">`. `src/js/pages/forms.js` validates on submit
  (messages in that file), marks fields with `aria-invalid` and `aria-describedby` and moves
  focus to the first error (FD-38). Without JavaScript the browser's native checks run
  (FD-40). The mode depends on the `action` attribute (FD-135):
  - **Static** (no `action`, the static site): a valid submit is stopped and the status shows
    a prefilled `mailto:` link.
  - **Live** (non-empty `action`, FD-135, FD-136): a submit with errors is stopped and shows
    the inline errors; a valid submit is sent in the background with `fetch` (below) and the
    JSON answer is shown in place, with no page reload. No `mailto:` status.
- Django: set `action` to the view URL (`{% url … %}`); live mode then posts. Add
  `{% csrf_token %}`, validate server-side with the same rules and messages, send by email
  (SMTP) and add spam protection without third-party scripts (honeypot field, rate limit).
  Redirect after a successful POST (PRG).
- **Background send (live mode, FD-136).** The view answers one URL, the form's `action`,
  in two ways: JSON when the request has `Accept: application/json`, the normal HTML or
  redirect otherwise (the fallback below).
  - **Request.** `POST` to `form.action`, `credentials: 'same-origin'`, header
    `Accept: application/json`, body `new FormData(form)` (`multipart/form-data`). It
    carries every field of the form: the visible fields, `csrfmiddlewaretoken`, the
    hidden start-time input and the honeypot. The start-time input is
    `<input type="hidden" name="started">`; the client writes the `started` value of an
    answer into the input with that name.
  - **Response body** (JSON, `Content-Type: application/json`):
    `{ "ok": bool, "status": string, "errors": { fieldName: message }, "started": string? }`.
    `errors` keys are the field `name`s (`name`, `email`, `kind` / `subject`,
    `organisation`, `brief` / `message`); keys that match no field are ignored. `started`
    is a fresh start-time value, optional.

    | Status                                                                                                                                       | Body                                  | Client behaviour                                                                                                                                                                                                                                                                                                                                        |
    | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | `200`                                                                                                                                        | `ok: true`                            | Resets the form (values, errors). Writes `started` into the hidden start-time input when present. Shows `status` in `[data-form-status]` and moves focus there (`tabindex="-1"`). Re-enables the button.                                                                                                                                                |
    | `422`                                                                                                                                        | `ok: false`, `errors`                 | Renders each `errors` entry into its field's error region exactly like a client-side error (`aria-invalid="true"`, `aria-describedby`, the region without `hidden`); fields not in `errors` are cleared. Shows `status`. Updates `started` when present. Focuses the first invalid field, otherwise the status. Re-enables the button. Values are kept. |
    | `429`                                                                                                                                        | `ok: false`, `errors` (usually empty) | Same as `422`: shows `status` (for example "Too many messages. Please try again later."), keeps the values, re-enables the button.                                                                                                                                                                                                                      |
    | `413`                                                                                                                                        | `ok: false`, `errors` (empty)         | The body is over the server's limit (64 KB). Shows `status`, keeps the values, focuses the status and re-enables the button. No fallback: a normal post would send the same oversized body again. A `413` that is not this JSON falls back like any other reply.                                                                                        |
    | `403`                                                                                                                                        | any (not parsed)                      | Shows the fixed client text "The form expired. Please reload the page and send it again." Keeps the values and re-enables the button. Django's CSRF failure answers `403`; the client does not read its body.                                                                                                                                           |
    | a network error, or any other status or a body that is not this JSON (for example `500` HTML, `200` with `ok: false`, `422` with `ok: true`) | —                                     | The client calls `HTMLFormElement.submit()`: a normal post with `Accept: text/html`, so the server's full-page answer (redirect with `?sent=` or the re-render with errors) is shown and no message is lost.                                                                                                                                            |

  - While the request runs the button has `disabled` and `aria-disabled="true"`, the form
    has `aria-busy="true"`, and a second submit is ignored. Both are removed when the
    answer arrives (and when a page returns from the back/forward cache).
  - The server must therefore validate and answer **both** ways from the same view, with
    the same rules and messages, and must keep the honeypot and rate limit for both.
- **After a normal reload** (the fallback, or no JavaScript): the status rendered in
  `[data-form-status]` is brought into view and receives focus when no field is invalid.
  The client does it after the page load, the font swap and two frames, through Lenis's
  `scrollTo` when it runs, without smooth scrolling under `prefers-reduced-motion: reduce`.
  Nothing is needed from the server beyond the rendered status text.
- **Server-rendered state** (re-render after an invalid POST, or the page after the
  redirect). On load, `forms.js` changes none of it:
  - Invalid field: `aria-invalid="true"` on the control, `aria-describedby` listing
    `<id>-error` (then `<id>-hint` where the field has a hint), and the error region
    `#<id>-error` without `hidden`, the message in its `[data-error-text]`. Keep the entered
    values. The message clears when the visitor fixes the field, as for a client-side error.
  - Status: text rendered inside `[data-form-status]` (`role="status"`) is never cleared on
    load. After an invalid POST render an error summary there (for example "Please correct
    the errors below."); the first invalid field then gets focus. Invalid fields without a
    status keep their messages but take no focus. After the redirect render the success
    message there with no invalid fields.
  - Tests: `tests/forms-live.spec.js` (live mode on the built pages with an action added: the
    background send, every response in the table, the fallbacks, the status after reload)
    and `tests/forms.spec.js` (static mode).

## 9. Drafts and the release build

- Posts have `status` `draft` or `published`. `SHOW_DRAFTS` (default true while designing)
  builds drafts with a "Draft" chip; `RELEASE=true` hides drafts unless `SHOW_DRAFTS` says
  otherwise: the Blog shows its empty state, Home has no Latest posts section, no draft post
  page is built (FD-36, FD-45, FD-103, FD-131).
- Django: a `Post.objects.published()` manager for every public view; drafts only in the
  admin preview (and marked `noindex`).

## 10. Search engines

- `<title>`: the page's short title + " — Ideatrium", at most 60 characters (FD-128,
  FD-139); Home is "Rasel Al Mamun — Ideatrium". The formal title stays in the `h1` and in the
  Open Graph / Twitter titles (also " — Ideatrium"). `og:site_name` is Ideatrium; `meta
author` and the `Person` stay Rasel Al Mamun.
- Social cards: `og:image` / `twitter:image` the share image
  (`images/brand/share-image-1200x630.png`, 1200 × 630, `image/png`, alt "Ideatrium — by
  Rasel Al Mamun"), `twitter:card` `summary_large_image`. Icons and manifest: the root files
  (section 5); `theme-color` per colour scheme, the `bg-0` token of each theme.
- One meta description per page, at most 160 characters (`meta.json`; a project's or post's
  `meta_description`, 1.7.4 — see § 19).
- JSON-LD: `Person` on every page, `WebSite` on Home (name Ideatrium, `url` the site root
  when `SITE_URL` is set, `author` the Person; FD-139), `ScholarlyArticle` per publication on
  Portfolio and publications, `BlogPosting` on posts (`tools/content.mjs`).
- `SITE_URL` (no domain yet, FD-22): when set, canonical links, `og:url` and absolute
  `og:image` / `twitter:image` URLs, `sitemap.xml` and the `Sitemap:` line in `robots.txt`
  (FD-131). Django: `django.contrib.sitemaps` with the same pages (Home, Portfolio,
  publications, research, Blog, Hire me, Contact, every project and published post) and
  `request.build_absolute_uri` for canonical URLs. **1.5.0:** the Privacy Policy (`/privacy/`) is
  indexable and in the sitemap.

**The `/privacy/` route (FD-143, the Django pin of 1.5.0).** Add the URL name `privacy` for
`privacy.html` (a simple page view with the `privacy` copy block as context, nav key `privacy`
so the footer link gets `aria-current="page"`), the footer link on every page (`shell/footer`:
`<p class="footer-privacy">` in `.footer-legal`), the sitemap entry, and the Django test table
entry `privacy.html` → `/privacy/` (already in `tests/pages.js`).

- `noindex` on the two template pages; in Django it applies only to draft previews. 1.7.4: the
  404 page and every filtered list state are `noindex` too (§ 19).

## 11. Accessibility and motion contracts

Templates must keep, unchanged:

- Landmarks (`header`, `nav` with labels, `main#main`, `footer`), the skip link as the first
  focusable element, one `h1` per page, visible focus (2 px `--focus` ring).
- The drawer below 992 px (Bootstrap offcanvas: `aria-controls`, `aria-expanded`, focus
  trap, Escape), the theme button (its accessible name "Theme: dark" / "Theme: light" carries the state, no `aria-pressed`, FD-17; visible label from 992 px), the
  back-to-top button on every page after the first screen (FD-05, FD-13).
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
- **1.5.0 small items.** Blog cards: a visually hidden `", "` between the category and "Draft"
  (`<span class="visually-hidden">, </span>` before `.blog-card-draft`), and the card link's
  name ends with " (draft)" for a draft. **Error page (Django's static 500 page):** in
  forced-colours mode the system drops backgrounds, so its pill link needs a real border, for
  example `border: 1px solid transparent` on the link in `static/site/error.css` (the
  frontend's 404 buttons keep Bootstrap's 1 px border; `tests/inner-pages.spec.js` checks it).
- Motion is always on (FD-04); the OS `prefers-reduced-motion` setting is respected through
  `gsap.matchMedia()` and CSS media queries. No motion switch.

## 12. Tests to port

`npm test` runs: `tools/check-csp.mjs` (CSP-safe markup), `tools/check-privacy.mjs`,
`html-validate` over the built HTML, and the Playwright suite (`tests/*.spec.js`: content,
pages, accessibility with axe, shell, Portfolio, Blog, forms (static and live), Home, stage, motion, inner
pages, release: noindex, sitemap, 400 % zoom), plus `npm run test:widths` (seven widths, both themes) and `npm run lhci`
(Lighthouse budgets, FD-129). Since 1.3.0 the browser specs also run against the Django
site itself: `npm run test:django` with `DJANGO_BASE_URL` switches `playwright.config.js`
to that base URL, starts no server and maps every page through the URL table in
`tests/pages.js` (FD-137; test sets, skips and the stand-in server in
`docs/testing-django.md`). The Node-only content tests (`content`, `pages`, `release`)
read `src/` and `dist/`; their Django equivalents are model and view tests.

## 13. Owner content to supply

Updated for 1.7.x. The owner's real content is loaded locally and never committed; the repository
builds with the trial content.

- Blog posts: final text, dates, card images and `status: published` (the trial posts are drafts).
  A published post may not keep any `[bracketed]` placeholder (the validator fails, FD-186).
- `meta_description` for each project and post (at most 160 characters, FD-185); without one the
  fallbacks apply and the validator warns.
- Card images (1600 × 900, WebP and AVIF) for each project and post; for the static preview also
  their 480 and 960 px copies (`<name>-480.webp`, …), which Django makes itself (FD-187).
- The public CV PDF, served at `/cv/Rasel_Al_Mamun_CV.pdf` (`profile.cv.href` is that path, FD-146).
- A larger original hero photograph (the hero stays 720 px wide until then, FD-130).
- The domain (`SITE_URL`): canonical URLs, absolute social images, sitemap.

## 14. Release 1.6.0: dynamic slots, two phases, final content

Release 1.6.0 applies the final site-basics content (Phase 1) and prepares every text Django
will make editable. Decisions FD-147 … FD-153 (`docs/decisions.md`). The sample values are in
`src/content/*.json` and mirrored in `docs/content/public-content.json`; the Django step copies
the profile data from there.

### 14.1 Django-owned texts

Every row is a **slot**: it renders from one value, **hides cleanly when the value is empty** and
holds its **maximum length** at 320, 390 and 1440 px in both themes, without overflow, clipping or
overlap. Lengths are characters; `tests/slots.spec.js` builds the site with empty, one-item and
maximum samples (the constants `MAX` and `MANY` in that file are this table; 1.7.1 adds 768 and
1024 px, and the Portfolio list maxima, which `tools/validate-content.mjs` `LIST_MAX` enforces). Words, not unbroken
strings, are assumed except for emails and URLs, which break anywhere.

| Key (JSON path)                                                                                        | Slot                                                        | Page(s)                             | Max length                                                                               | Empty →                                                                        |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `profile.second_role`                                                                                  | second role; Person `worksFor` (not shown)                  | structured data, every page         | 40                                                                                       | no `worksFor`                                                                  |
| `profile.eyebrow`                                                                                      | hero eyebrow, desktop (≥ 768 px)                            | Home                                | 100                                                                                      | whole eyebrow line hidden                                                      |
| `profile.eyebrow_short`                                                                                | hero eyebrow, mobile (< 768 px)                             | Home                                | 48                                                                                       | falls back to `eyebrow`                                                        |
| `profile.role_line`                                                                                    | hero role line **and** footer role line (one value, FD-148) | Home, footer (every page)           | 70                                                                                       | both lines hidden                                                              |
| `profile.statement`                                                                                    | introduction                                                | Portfolio top                       | 300                                                                                      | paragraph hidden                                                               |
| `portfolio.profile.summary_line`                                                                       | summary line                                                | Portfolio top                       | 140                                                                                      | line hidden                                                                    |
| `profile.summary`                                                                                      | search description                                          | Portfolio `<meta>`                  | 160                                                                                      | empty description                                                              |
| `portfolio.profile.eyebrow`                                                                            | Portfolio eyebrow                                           | Portfolio top                       | 100                                                                                      | line hidden                                                                    |
| `portfolio.profile.location_line`                                                                      | location line                                               | Portfolio top                       | 60                                                                                       | line (and pin) hidden                                                          |
| `profile.author_line`                                                                                  | post author line                                            | post page, author card              | 100                                                                                      | line hidden                                                                    |
| `hire.availability`                                                                                    | availability line                                           | Hire me                             | 100                                                                                      | line hidden                                                                    |
| `hire.available` (bool)                                                                                | availability dot: filled green = yes, hollow = no           | Hire me                             | —                                                                                        | no dot without the line                                                        |
| `profile.email`, `profile.secondary_email`                                                             | both emails (each its own `mailto:`)                        | footer, Home band, Contact, Hire me | 40 each                                                                                  | that address (and, for the first, the Copy button) hidden                      |
| `links[]` label, url, id                                                                               | profile links                                               | Portfolio top, Contact "Elsewhere"  | label 28; 0 / 1 / 9 links                                                                | block hidden at 0 links                                                        |
| `footer.research_profiles`, `footer.connect_profiles` (link ids)                                       | footer groups                                               | footer (every page)                 | 0 / 1 / 8 links each                                                                     | group hidden at 0 links                                                        |
| `fields[]` label, target, icon, order                                                                  | Areas of work                                               | Home screen 2                       | label 28; 0 / 1 / 8 areas                                                                | block hidden at 0 areas                                                        |
| `hire.services[]` number, title, summary, items, evidence label and link                               | Hire me services                                            | Hire me, Home band                  | title 40, summary 90, item 50 (4 items), label 28; 0 / 1 / 4 services                    | block hidden at 0; the evidence link hides if its label or link is empty       |
| `portfolio.experience.roles[]` title, period, unit, institution, text, bullets                         | experience roles                                            | Portfolio                           | title 40, period 30, unit 40, institution 50, text 160, 3 bullets of 60; 0 / 1 / 5 roles | column hidden at 0; an empty `unit` hides the unit line                        |
| `contact.subjects[]`, `hire.form_kinds[]`                                                              | form options                                                | Contact, Hire me                    | 30 / 40 each; 0 / 1 / 8 options                                                          | the select is omitted at 0                                                     |
| `contact.intro`, `contact.audiences[]`                                                                 | Contact intro and audiences                                 | Contact                             | intro 120; audience 60 each; 0 / 1 / 6 audiences                                         | intro or list hidden                                                           |
| `portfolio.awards.items[]` (shown awards)                                                              | Awards & honours                                            | Portfolio                           | 0 / 1 / 9 awards (1.7.1; 3 or 4 read best)                                               | —                                                                              |
| `portfolio.experience.education[]`                                                                     | education rows                                              | Portfolio                           | 0 / 1 / 4 rows (1.7.1; 2–3 read best)                                                    | column hidden at 0                                                             |
| `portfolio.expertise.groups[]`, `items[]`                                                              | expertise groups and their items                            | Portfolio                           | 0 / 1 / 4 groups (one full row of four from 992 px); 12 items per group (5 read best)    | —                                                                              |
| `portfolio.expertise.training[]` (shown certifications)                                                | Selected training                                           | Portfolio                           | 0 / 1 / 2 certificates (one row of two from 992 px)                                      | —                                                                              |
| `portfolio.experience.roles[].bullets[]`                                                               | role bullets                                                | Portfolio                           | 3 bullets per role (1.7.1; 2 read best)                                                  | list hidden at 0                                                               |
| page `<title>` and search descriptions (`meta.*`, `profile.summary`, the projects archive description) | `<head>`                                                    | every page                          | title ≤ 60, description ≤ 160                                                            | —                                                                              |
| `footer.ai_portrait_shown` (bool)                                                                      | AI-portrait note                                            | footer (every page)                 | —                                                                                        | note hidden when false (true now; false once no AI-generated portrait is left) |
| `profile.cv.href`                                                                                      | "Download CV (PDF)" links, with a download icon             | Home, Portfolio, Hire me, drawer    | —                                                                                        | every CV link hidden when empty                                                |

Fixed (changing it needs a release): brand, layout, Home screen 2 (headline, highlight, pillars),
the working process, headings and interface labels. The Home field list's link targets are data,
but the list itself stays plain text (FD-87); the targets (`portfolio.html#research`,
`#expertise`, `#publications`, `hire.html`) are real anchors and a test checks each one.

Profile link icons: a link type without its own icon (an id other than `orcid`, `scholar`,
`scopus`, `wos`, `researchgate`, `linkedin`, `github`) shows the generic **link** icon
(`icons/footer-icon.hbs`, `icons/pf-icon.hbs`); Web of Science (`wos`) has its own. Footer groups
take any number of links.

### 14.2 Two phases (the frontend shows Phase 1 only)

The frontend builds **Phase 1** (until 12 December 2026). There is no date switch. The Phase 2
values below must be admin-editable in Django, so the change on 12 December 2026 is an edit of
text, not a release. "Research Assistant" must not appear anywhere after that date.

| Text                                   | Phase 1 (now → 12 Dec 2026)                                                                                                                                                                             | Phase 2 (from 12 Dec 2026)                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Hero eyebrow, desktop (`eyebrow`)      | Founder, Ideatrium · Research Assistant, Bangladesh Agricultural University                                                                                                                             | Founder, Ideatrium · Agricultural engineer and software developer                                                                   |
| Hero eyebrow, mobile (`eyebrow_short`) | Founder, Ideatrium · Research Assistant, BAU                                                                                                                                                            | Founder, Ideatrium · Engineer and developer                                                                                         |
| Portfolio eyebrow                      | Founder, Ideatrium · Research Assistant, Bangladesh Agricultural University                                                                                                                             | Founder, Ideatrium · Agricultural engineer and software developer                                                                   |
| Location line (`location_line`)        | Farm Power and Machinery · Mymensingh, Bangladesh                                                                                                                                                       | Mymensingh, Bangladesh                                                                                                              |
| Post author line (`author_line`)       | Founder, Ideatrium · Research Assistant, Bangladesh Agricultural University                                                                                                                             | Founder, Ideatrium · Agricultural engineer and software developer                                                                   |
| Main position (`position`)             | Research Assistant (second role: Founder, Ideatrium)                                                                                                                                                    | Founder, Ideatrium (no longer joined to BAU)                                                                                        |
| Research Assistant period and tense    | "Jan 2024 – present"; "I develop an IoT-based monitoring and control system with AI-edge computing for poultry farm management."                                                                        | "Jan 2024 – Dec 2026"; "I developed an IoT-based monitoring and control system with AI-edge computing for poultry farm management." |
| Person structured data                 | `jobTitle` "Research Assistant"; `affiliation` Bangladesh Agricultural University; Ideatrium a separate Organization the person founded (`worksFor` → Organization "Ideatrium", `founder` → the person) | `jobTitle` "Founder, Ideatrium"; no BAU affiliation; Ideatrium as in Phase 1                                                        |

Never put Ideatrium under BAU in the structured data. Unchanged in both phases: `role_line`,
`statement`, `summary`, both emails; the department and institution stay for education only after
Phase 1.

### 14.3 Other notes for Django

- **Contact subjects.** The frontend form's subjects are now Research collaboration · Job
  opportunity · Project or consulting · Speaking or teaching · Other. Django's inquiry subject
  choices (the model choices and the form field) must match these five, in this order.
- **Scroll boxes (Safari).** Wide formulas, tables and code blocks in post and project text are
  keyboard-scrollable: `tabindex="0"`, `role="region"` and an accessible name, with the site's
  focus ring. **Django's rich-text renderer must emit the same attributes**: `div.rt-math-display`
  → `tabindex="0" role="region" aria-label="Formula N, scrollable"`; `pre.rt-code` and a plain `pre`
  → `tabindex="0" role="region" aria-label="Code block N, scrollable"`; `div.rt-table-scroll` (and
  Markdown tables) → `role="region" tabindex="0" aria-label="Table N, scrollable"` (N counted per
  post). `src/partials/samples/rich-post.hbs` carries the attributes, edited by hand to match this
  contract; regenerate it from the Django renderer once that emits them.
- **Footer role line** is `profile.role_line` (one value with the hero); `footer.role_line` is gone.
- **Introduction** (`profile.statement`) shows on the Portfolio top only, not on Home.
- **CV link** target stays `/cv/Rasel_Al_Mamun_CV.pdf`; the PDF itself is not part of this release.
- **Web of Science** (`wos`, RKQ-3766-2026) is the fourth link; Google Scholar's URL has no
  `&hl=en`; all seven links are in `sameAs`.

## 15. 1.6.0 round 3

Decisions FD-154 … FD-161 (`docs/decisions.md`). What Django must mirror, component by component.

### 15.1 Pagination and the list pages

**Component** `src/partials/components/pagination.hbs` (Django `components/pagination.html`). Context
`pager` (nothing is rendered when it is `null`, that is with one page) and an optional `label`:

```
pager = { page, pages, prev: {href}|null, next: {href}|null,
          items: [ {n, href, current} | {gap: true} ] }
```

Markup: `nav.pager[aria-label][data-pager] > ul.pager-list > li.pager-step (Previous) · li.pager-num
(a.pager-link[aria-label="Page N"], the current one also `.is-current`and`aria-current="page"`) ·
li.pager-num.pager-gap ("…") · li.pager-status ("Page 2 of 5", shown below 576 px instead of the
numbers) · li.pager-step (Next)`. Previous / Next are links with `rel="prev"` / `rel="next"`; at the
ends they are `span.pager-link.is-disabled[aria-disabled="true"]`. The numbers show page 1, the last
page, the current page and one either side, with a gap between. `tools/lists.mjs` (`pagerView`) is
the reference for that rule. Every target is at least 44 px; it works at 320 px.

**Sizes:** projects 9 per page, posts 9, publications 20 (pagination only above 20 items).
**Count line** (`p.archive-count[data-results-status]`): "Showing 1–9 of 15 projects", "Showing 3 of 3
projects", "No projects match your search." (`countLine` in `tools/lists.mjs`).

**URLs (Django):**

| Page         | Query                             | Notes                                                              |
| ------------ | --------------------------------- | ------------------------------------------------------------------ |
| Projects     | `?q=…&topic=<topic key>&page=N`   | a GET form; no sort menu (featured first, then the admin priority) |
| Blog         | `?category=<category key>&page=N` | the category tabs are links                                        |
| Publications | `?page=N`                         | only when there are more than 20 items                             |

Changing the search or the topic drops `page` (back to page 1). An unknown `topic` / `category` is
ignored; a page beyond the last is the last. Each page has its own `<title>`: "Projects — page 2 —
Ideatrium", "Projects — Poultry systems — Ideatrium", "Blog — Education — Ideatrium", a **self-canonical**
link (the same URL with the same query), `<link rel="prev">` / `<link rel="next">` (the neighbouring
page URLs), and `noindex` on a search with no result. The `head` partial takes `relPrev`, `relNext`
and `noindexPage`.

**Projects page markup:** `form.archive-filter[role=search][method=get][data-list-form]` (the search
`input[name=q]`, the `select[name=topic][data-list-auto]`, a visible "Search" button, so it works
without JavaScript), then `div.archive-results[data-list-results]` with `h2#results-title[tabindex=-1]
[data-results-heading]` (visually hidden), the count line, the cards (`h3` titles) or
`div.empty-state` ("No projects match your search." and a "Clear filters" link to the unfiltered page),
then the pager; after it `p.visually-hidden[role=status][data-list-announce]`.
**Blog:** the same `div.blog-results[data-list-results]`: `nav.pf-tabs[data-category-filter]` of
`a.pf-tab` (`aria-current="page"` on the current category, "false" on the others), the count line, the
cards, the empty category state ("Show all posts" link), the pager.

**JavaScript (enhancement only, `src/js/pages/list-nav.js`):** a form submit, a topic change, a
category tab, a page link or "Clear filters" fetches the same URL, swaps the content of
`[data-list-results]` for the response's, updates the form values, the `<title>` and the prev / next /
canonical links, pushes the URL, moves focus to the results heading and announces the count in
`[data-list-announce]`. Any error falls back to a normal navigation; Back works. Django answers the
fetch with the normal full page.

**Static preview (this repository only):** `research.html`, `research-page-2.html`,
`research-topic-<key>.html`, `research-empty.html`, `blog.html`, `blog-category-<key>.html`,
`publications.html` (and `-page-N` when a list has more pages) are built from the same templates;
`vite preview` and `vite dev` map a query to the matching file (`resolveState`); free-text search is
not run in the preview (a search with no match shows the empty state, any other shows page 1).
`dist-django/` carries them too, so a pin can compare Django's HTML to them.

### 15.2 Project-topic icons

`src/partials/icons/line-icon.hbs`, 36 keys; Django offers exactly this list as the topic icon choice:
`hen`, `fish`, `sun-water`, `tractor`, `leaf`, `greenhouse` (the agriculture set), `software`, `web`,
`mobile`, `ai`, `robotics`, `data`, `cloud`, `security`, `energy`, `water`, `environment`, `health`,
`education`, `research`, `hardware`, `automation`, `iot`, the twelve keys added in 1.7.1
(`briefcase`, `handshake`, `government`, `chart-up`, `team`, `graduation`, `book`, `globe`, `bulb`,
`megaphone`, `shield`, `heart`), and `general`, the fallback (any other name draws it). 48 px grid,
1.5 px strokes, accent parts as `.la`. Near twins (offer the clearer one): `shield` / `security`,
`heart` / `health`, `graduation` / `education`.

### 15.2a Area, expertise and award icons (1.7.1)

The icon choice Django offers per list is exactly the validator's list (`tools/validate-content.mjs`):

- **Areas of work** (`fields[].icon`, `icons/area-icon.hbs`, 24 px): `sprout`, `network`, `camera`,
  `tractor`, `code`, `document`, `chip`, `gear`, and the twelve 1.7.1 keys above.
- **Expertise groups** (`portfolio.expertise.groups[].icon`, `icons/pf-icon.hbs`): `chip`,
  `network`, `code`, `gear`, and the twelve 1.7.1 keys (`graduation` draws the `mortarboard`
  drawing, `briefcase` the existing Experience icon).
- **Awards** (`portfolio.awards.items[].icon`, `icons/pf-icon.hbs`): `trophy`, `medal`, `ribbon`,
  `star`, `certificate`.

`tools/preview/icon-sheet.mjs` (working repository only, never built or exported) renders every
icon of each set, named, at its real size and at 3×, in both themes.

### 15.3 Covers

A post's cover is an uploaded image when `cover.src` is set: `<picture>` with an AVIF `source` (optional)
and the WebP `img` (`srcset` / `sizes` from `cover.srcset` / `cover.avif_srcset`), width and height,
alt text on the post page (decorative `alt=""` on the card, whose link names the post), inside the
16:9 `.blog-cover` frame, `object-fit: cover`. With no image the line drawing (`cover.illustration`)
is the fallback. Project cards have no image slot; none was added.

### 15.4 Small components

- **Two emails, one group** (footer, Contact and Hire me "Direct"): one envelope icon, hello@ first;
  `.footer-emails` / `.email-group` > `ul` of the two mailto links. In "Direct" each address is followed
  by `button.copy-btn[data-copy-email][aria-label="Copy <address>"]` (JS only); one
  `p.copy-status[role=status][data-copy-status]` says "Copied <address>" (visible and announced); the
  button shows a tick for 2 s.
- **Expertise** items are `li.pill` in `ul.pf-group-items` (flex wrap), one tag per item.
- **Role lines and eyebrows** use `dots`: every " · " becomes a no-break space and "· " (Django: a
  template filter doing `text.replace(" · ", " · ")`), so no line starts with "·"; `text-wrap:
balance` on phones; one line from 1200 px (hero eyebrow, hero role line, footer role line).
- **Hero buttons on phones:** `.hero-ctas` is a two-column grid (Hire me, Portfolio) with the CV link
  full width below; desktop unchanged.
- **Back to top:** `button.back-to-top[data-back-to-top]` with an up-arrow icon, 48 px, round, 24 px from the
  edges; the footer keeps room under its last line. The portrait is gone, so is the Home stage hand-off.
- **Portfolio:** counts label "Projects"; profile links one column below 600 px, two from 600 px; the
  section menu `nav.pf-nav` is one sideways-scrolling row below 768 px with a fade at the right edge.
- **Menu sub-lines:** Home "Overview", Contact "Email · Form".
- **Contact** audiences are a bulleted list (`ul.plain-list`).
- **Hire me:** the top button is "Start a brief" (`a[href="#brief"][data-start-brief]`, JS moves focus to
  `#hire-name`); the right block is centred on the heading from lg; the availability line follows the
  heading on phones.
- **Project status** on every card: "In progress", "Done", "Planned" (a hollow dot) or, while the
  admin has not set one, the visible placeholder "[Status]". The role line is 15 px, `--fg-1`.
- **Home motion starts on the first scroll** (FD-162): `src/js/core/first-input.js`. Until then every layer shows (no hidden reveal state, no pinned stage); a Django page needs only the same scripts and markup.
- **Project status:** no badge when the project has no status (no placeholder).

## 16. 1.6.0 round 4

For Django, in the order of the pages. Decisions FD-163 … FD-169.

- **Home:** no "Two sides of this site" (drop `home.fork` from Page text). The desktop stage is shorter and ends at the hand-off; the markup is the same `data-stage*` hooks without `data-stage-fork`. The back-to-top button is the seated photo again (the markup of `back-to-top.hbs`). "Selected work" `All projects` links to the Projects page, `All publications` to the Publications page. `home.hire_intro` is gone: the Hire me band is the heading and one button. The Contact band has no email lines; its photo is hidden below 768 px (`d-none d-md-flex`).
- **Project cover:** add an optional cover image field to the project model (WebP, optional AVIF, `srcset`, width, height, alt). The large Home card shows it in the Blog card's 16:9 frame (`object-fit: cover`); with none, the sensor-node drawing. Sample: `cover` in `projects.json`.
- **Footer:** the AI portrait note and `footer.ai_portrait_shown` are removed. On phones the bottom row is the copyright over "Privacy Policy" on the left and the Theme button (`components/theme-button.hbs`) on the right. The menu uses the same button with `state=true` (its label is "Dark" / "Light", kept by `theme.js` through `[data-theme-state]`).
- **Header Hire me (S4):** on /hire the link has `aria-current="page"`; CSS makes it outlined (`.hire-cta[aria-current]`). Every other page: the filled button.
- **Back links (S5):** `components/back-link.hbs` ("← Portfolio" on Projects and Publications, "← Projects" on a project); the post page has "← Blog / Category", the category linking to `?category=ID`.
- **Blog and posts:** `blog_page.eyebrow` ("Blog / Articles & notes"), `count_label` / `count_label_one` ("{count} articles" / "{count} article"), counted over published posts only. A post says `Published <d Month yyyy> · <n> min read` (no date: no "Published"); the Draft badge only in the private preview of an unpublished post. The mobile "On this page" is a `<details>` (closed) under the cover with three or more headings; the sidebar list is unchanged. Previous / Next article (title and category, a side absent when there is none) sit above the footer; "← Back to all articles" ends the article.
- **Projects:** status labels "In progress", "Completed" (data value `done`), "Planned"; no status: no badge, never "[Status]".
- **Publications:** each row has DOI always and Project only when linked, in a fixed-width right column (16.5 rem from lg); the actions go under the title below lg.
- **Hire me and Contact:** the form line is `privacy.form_line` ("Your details are used only to reply to your inquiry and are never sold or used for marketing.") + the Privacy Policy link. Hire me's header keeps the availability line and "Start a brief" (scrolls to the form, focuses the Name field via `data-focus`); no CV button there. The Direct card (and Contact's Elsewhere card) are removed; no email appears on either page (the footer has them). **What to expect** (`contact.expect`: heading and `{label, value}` lines — response time, location, languages) is sample content: make its lines admin-editable (Page text). Right column order: Hire me — What to expect, CV, Also; Contact — What to expect, Who I'd like to hear from. The cards start level with the Name field (a two-row grid on Hire me).
- **404:** centred; a large "404", "Page not found", one line, the `disconnected-node` drawing (blog-cover style), links Home, Projects, Blog, Contact; no portrait.
- **Portfolio:** the profile keeps Download CV (PDF); Awards and Experience & education have no CV button or link (1.6.0 round 7).
- **Privacy:** below 600 px the "Who else handles your data" table is one stacked block per row; every value carries its column's name in `data-label` (from the header row). Django's rich-text table renderer sets the same `data-label` at render time and `data-stack` on the table; the CSS is `.prose-table table[data-stack]`.

## 17. 1.6.0 round 5

Decisions FD-170 … FD-172.

- **Navbar (FD-171):** the primary nav is Portfolio · Blog · **Projects** · Contact (`<li><a href="{% url 'projects' %}" {% if nav == 'projects' %}aria-current="{{ current }}"{% endif %}>Projects</a></li>`, after Blog). Nav key `projects`: the Projects archive and its states (`aria-current="page"`) and every project page (`aria-current="true"`); Portfolio is current only on the Portfolio page and Publications (`"true"`). The phone menu has the same item after Blog with the sub-line "Research · Software" (`drawer-sub`). The nav labels are fixed-width (`_shell.scss`, `.site-nav li:nth-child(n)`), so a fifth item needs its own width.
- **Home markup:** `work-card.hbs`: the large card's title is a `t-h3` and its summary has no `t-body-l` (the same sizes as the small cards); the cover stays `div.blog-cover.work-cover`. Nothing else changes for Django.
- **Removed (nothing used them):** the partials `components/email-box` and `sections/profile-links`, and the copy-button script. Django does not need either.
- **Motion:** only `stage-desktop.js` changed (the hand-off condition). Django mounts the same script.

## 18. 1.6.0 round 6

Decisions FD-173 … FD-176.

- **What to expect (FD-175):** the card has no visible label; `components/expect-box` renders `contact.expect.heading` in a visually hidden `h2` (it names the card for screen readers). Hire me's header (FD-176): `p.eyebrow`, then the availability `p.availability.t-small` (still hidden when empty; `data-available` sets the dot), then `div.hire-head-row` with the `h1` and the Start a brief link (`.band-actions`). The classes `band-head` and `band-aside` are gone.
- **Motion:** only `stage-desktop.js` (the glide) and one CSS rule (`.back-to-top.is-gliding`) changed; Django mounts the same script and styles.

## 19. 1.7.4 changes for Django

Decisions FD-184 … FD-190 (`docs/decisions.md`), from the QA audit of v1.7.3. Everything Django
must mirror:

- **`meta_description`** (FD-185): a new optional field on `Project` and `Post`, at most 160
  characters (model validation; a missing one is a warning in the admin, not an error). It is the
  page's `<meta name="description">`, `og:description` and `twitter:description`. Without it: a
  project uses `ProjectDetail.summary_line`, else its `card_description` — never the contribution
  text; a post uses its standfirst cut at the last full sentence within 160 characters (if there is
  none, at the last word with "…"). A post whose standfirst is still a placeholder uses
  "<title> — a post by <name>".
- **Filtered lists** (FD-185): `/portfolio/research/?topic=…`, `?q=…` and `/blog/?category=…` render
  `<meta name="robots" content="noindex,follow">`, and their `<link rel="canonical">` and `og:url`
  are the unfiltered list (`/portfolio/research/`, `/blog/`); they are never in the sitemap. The
  unfiltered lists and their `?page=N` stay indexable and self-canonical.
- **404** (FD-185): `<meta name="robots" content="noindex">`, no canonical and no `og:url`
  (`shell/head` takes `robots` and `noCanonical`; the 404 template passes both).
- **`BlogPosting`** (FD-185): add `image` (the post's share image, absolute), `url` and
  `mainEntityOfPage` (`{"@type": "WebPage", "@id": <canonical>}`), `datePublished`, `dateModified`
  (the last edit when later than the publication date, else the publication date), `author` (the
  Person with its `url`, the site root, and `sameAs`) and `publisher` (the same Person).
- **Used-only filter options** (FD-187): the topic select and the category tabs list only topics
  and categories with at least one published item. A query naming an unused one shows the
  unfiltered list.
- **First card eager** (FD-187; 1.7.5 extends it to the whole first row, § 20): on the projects archive and the Blog (every state and page), the
  first card's `<img>` has `loading="eager"` and `fetchpriority="high"`; every other card stays
  `loading="lazy"` (`sections/archive-card` and `sections/blog-card` take `eager`, which they pass to
  `components/card-image`).
- **Card `srcset`** (FD-187): every card image (lists, Home, the page top) is
  `<source type="image/avif" srcset="…480 480w, …960 960w, …1600 1600w" sizes="…">` and
  `<img src="…1600" srcset="…480 480w, …960 960w, …1600 1600w" sizes="…">`, with the `sizes`
  each partial already passes. Django makes the 480 / 960 / 1600 renditions it already makes.
- **Form `maxlength`** (FD-187): `name` 120, `email` 254, `organisation` 160, `message` / `brief`
  5000 on the Contact and Hire me fields — the same limits as Django's form fields. The static
  mailto fallback (frontend only) shortens a long message; the live form is unaffected.
- **CSS** (FD-184, arrives with the asset sync): the light theme's primary-button hover and focus
  fill (mixed with white, ≥ 4.5:1), and the footer email links' 8 px block padding up to 667 px
  (44 px targets). No template change.
- **Scripts** (FD-187, FD-190, arrive with the asset sync): `list-nav.js` (latest request wins),
  the shared `core/media.js`, `theme.js` and `tab-ink.js` robustness. No `data-*` hook changed;
  motion behaviour is unchanged.
- **Content limits** (FD-186): `tools/limits.mjs` is the one table of § 14.1 plus the page-title
  rule (short title + " — Ideatrium" ≤ 60) and the 160-character descriptions; Django's model
  validation should enforce the same numbers.

## 20. 1.7.5 changes for Django

Decision FD-191 (`docs/decisions.md`). Everything Django must mirror:

- **Eager first row** (replaces the "First card eager" item of § 19): on the projects archive and
  the Blog (every state and page) the first **three** cards' `<img>` have `loading="eager"`; only
  the first card's also has `fetchpriority="high"`; every later card stays `loading="lazy"`.
  `sections/archive-card` and `sections/blog-card` take `eager` and `priority` and pass both to
  `components/card-image`, which writes `fetchpriority="high"` only for `priority`. In the Django
  loop: `eager` = `forloop.counter <= 3`, `priority` = `forloop.first`. The project and post page
  tops pass `eager=true priority=true` (markup unchanged).
- **Period wording**: a project period is "Month YYYY to Month YYYY", "Month YYYY to present" or
  "YYYY to YYYY" (no dash); Django renders the same text, the frontend prints it as given.
- **Script** (arrives with the asset sync): `tab-ink.js` waits for the tabs' fonts before it first
  measures a tab row and re-measures when a tab changes size. No template or `data-*` hook changed.
