# Architecture

Author: Rasel Al Mamun

## Stack (exact pins in `package.json`)

| Concern  | Package                                                                                                                                              | Role                                                                                                            | Licence                               |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Build    | `vite` 8.3.5 (Rolldown)                                                                                                                              | multi-page dev server and build, hashing, Sass                                                                  | MIT                                   |
| Includes | `vite-plugin-handlebars` 2.0.3 (FD-03)                                                                                                               | partials and data at build time; no runtime templating                                                          | MIT                                   |
| Markdown | `marked` 18.1.2 (FD-37)                                                                                                                              | post bodies rendered at build time; raw HTML escaped; dev only                                                  | MIT                                   |
| Styles   | `sass` 1.106.1 (dart-sass), `bootstrap` 5.3.8 (Sass source)                                                                                          | grid, utilities, offcanvas; overridden by the design tokens (form fields use their own `.field-control` styles) | MIT                                   |
| Motion   | `gsap` 3.15.0 incl. ScrollTrigger                                                                                                                    | Home stage timeline, Home motion, `matchMedia` for reduced motion                                               | GSAP standard licence (free, not OSI) |
| Scroll   | `lenis` 1.3.27                                                                                                                                       | smooth scrolling on fine-pointer desktops only                                                                  | MIT                                   |
| Fonts    | `@fontsource-variable/bricolage-grotesque` 5.3.0, `@fontsource/jetbrains-mono` 5.3.0                                                                 | woff2 files subset into `src/fonts/` by `subset-font` 2.9.0 (FD-130, one-time) with their licence files         | OFL-1.1                               |
| Lint     | `eslint` 10.13.0 + `@eslint/js` 10.0.1 + `globals` 17.13.0 (FD-10), `stylelint` 17.16.0 + `stylelint-config-standard-scss` 17.0.0, `prettier` 3.9.10 | code quality gates                                                                                              | MIT                                   |
| Tests    | `@playwright/test` 1.64.1, `@axe-core/playwright` 4.14.0                                                                                             | page, width, motion and accessibility checks                                                                    | Apache-2.0 / MPL-2.0                  |
| Quality  | `@lhci/cli` 0.15.1 (FD-129)                                                                                                                          | Lighthouse budgets on five pages, mobile preset                                                                 | Apache-2.0                            |

No React, Vue or Next: the site is content pages plus one animated stage, and the
destination is Django templates. No jQuery. No icon font: icons are inline SVG partials.

## Folder layout (FD-125)

The complete tree, with the purpose of every folder and file, is in `docs/structure.md`. The
module layout:

```
src/
  pages/        index.html portfolio.html publications.html research.html
                portfolio-entry.html blog.html blog-post.html hire.html contact.html 404.html
                + project-<id>.html, generated from portfolio-entry.html per project
                + post-<slug>.html, generated from blog-post.html per post
  content/      activities awards blog blog-page certifications contact education fields
                footer hire home links memberships meta portfolio post-sidebar profile
                projects publications research-archive skills (.json; FD-19)
                posts/<slug>.md (post bodies, Markdown; FD-37)
  partials/
    shell/        head header drawer footer back-to-top page-wipe
    components/   cv-button draft-chip email-box field pf-tabs project-image status-chip
                  tag-pills
    sections/     archive-card articles-ld blog-card blog-empty home-pub latest-card pf-card
                  pf-pub profile-links related-pub service work-card
    icons/        area-icon footer-icon illustration line-icon pf-icon; logo, logo-mark
                  and logo-symbols (the Ideatrium logo, FD-139)
  scss/
    base/         _tokens (generated from src/design/tokens.json by tools/tokens.mjs),
                  _bootstrap (variable overrides + selective imports), _base (theme-aware
                  --bs-* mapping, gutters, focus ring, inline links), _type (fonts, type
                  scale, .t-* utilities), _motion (reveals, tilt, magnetic buttons, cursor
                  follower, entrance, Lenis, seam wipe)
    layout/       _shell (skip link, header, drawer, footer, back-to-top)
    components/   _components (buttons, links, chips, cards, media placeholder, profile links)
    pages/        _pages (project pages, Blog, posts, Hire me, Contact, forms, 404),
                  _portfolio (Portfolio and the two "View all" pages), _home (Home as a
                  document), _stage (pinned Home stage, FD-66)
    main.scss     imports in cascade order
  js/
    main.js       entry: shell modules, then the page module by <body data-page>, then
                  site-wide motion once the OS allows it
    core/         theme drawer back-to-top page-wipe scroll (shared scrollToY / jumpTo and
                  the Lenis registry) tab-ink toggle-group
    motion/       motion (reveals, tilt, magnetic, Lenis), motion-tokens (token reader and
                  easing), cursor, stage (picks desktop / mobile / reduced), stage-desktop
                  (pinned stage, GSAP + ScrollTrigger), screen2 (played entrance, FD-85),
                  home-motion (photo parallax FD-73, Contact band settle FD-72)
    pages/        portfolio research blog post forms
  design/       tokens.json (colour, type, spacing, radius, motion; read by tools/tokens.mjs)
  images/       avatar/ figure/ arrow.svg placeholder.svg
  fonts/
public/         robots.txt, js/theme-init.js (classic script, first in <head>, FD-12);
                the brand root files favicon.ico, favicon.svg, apple-touch-icon.png,
                icon-192.png, icon-512.png, site.webmanifest and the share image
                images/brand/share-image-1200x630.png (FD-139), copied as supplied
tools/          build: tokens.mjs, content.mjs (loads src/content, derives counts, order,
                pages), markdown.mjs (post bodies, FD-37), validate-content.mjs (prebuild),
                subset-fonts.mjs (one-time, FD-130)
                checks: check-csp.mjs, check-privacy.mjs (FD-23), check-django-build.mjs
                (FD-133), check-audit.mjs + audit-allowlist.json (FD-134), check-links.mjs
                (FD-131)
                runners: test-linux.mjs, test-django.mjs and serve-django-paths.mjs
                (FD-137), lhci.mjs (FD-129); the public export (FD-132, FD-138)
tests/          Playwright specs; pages.js holds the page list, the Django URL table and
                helpers; fixtures.js maps page URLs on the Django target (FD-137)
```

## Build targets (FD-133)

| Command                | Output         | Base                | Manifest | Use                     |
| ---------------------- | -------------- | ------------------- | -------- | ----------------------- |
| `npm run build`        | `dist/`        | `/`                 | no       | the static site         |
| `npm run build:django` | `dist-django/` | `/static/frontend/` | yes      | the files Django serves |

Both run `npm run tokens` and `npm run content:check` first and share the pages, content
mode, chunking and CSP rules. The `django-target` plugin in `vite.config.js` adds
`.vite/asset-map.json` for the files the manifest does not key by source path.
`tools/check-django-build.mjs` compares the two outputs and resolves every asset URL.

## Test targets (FD-137)

| Target           | Started by                                | Server                                        |
| ---------------- | ----------------------------------------- | --------------------------------------------- |
| static (default) | `npm test`, `npm run test:widths`         | `vite preview` on port 4173 (Playwright)      |
| Django           | `npm run test:django` + `DJANGO_BASE_URL` | a running Django site, or the stand-in server |

`playwright.config.js` switches on `TEST_TARGET=django`; details in `docs/testing-django.md`.

Partials are called with their group: `{{> shell/header}}`, `{{> icons/pf-icon name="pin"}}`.

## Page → Django mapping

| Static page          | Django template               | URL                                 |
| -------------------- | ----------------------------- | ----------------------------------- |
| index.html           | `home.html`                   | `/`                                 |
| portfolio.html       | `portfolio/index.html`        | `/portfolio/`                       |
| publications.html    | `portfolio/publications.html` | `/portfolio/publications/` (FD-109) |
| research.html        | `portfolio/research.html`     | `/portfolio/research/` (FD-109)     |
| portfolio-entry.html | `portfolio/detail.html`       | `/portfolio/<slug>/`                |
| blog.html            | `blog/index.html`             | `/blog/`                            |
| blog-post.html       | `blog/post.html`              | `/blog/<slug>/`                     |
| hire.html            | `hire.html`                   | `/hire/`                            |
| contact.html         | `contact.html`                | `/contact/`                         |
| 404.html             | `404.html`                    | —                                   |

Partial groups map to template folders (`shell/header.hbs` → `{% include "shell/header.html" %}`);
asset URLs become `{% static %}`. Because the markup has no inline script or style, the CSP
header applies unchanged.

## Breakpoints (Bootstrap)

xs < 576 · sm ≥ 576 · md ≥ 768 · lg ≥ 992 · xl ≥ 1200 · xxl ≥ 1400.
Header nav, Hire me and theme label from `lg` (FD-11), drawer below; below 380 px the
Ideatrium mark replaces the full logo and the header theme button is hidden (FD-139). Pinned stage layout from `lg`; screen 2's Areas grid has
3 columns from `lg`, 2 below, 1 under 360 px; back-to-top at all sizes (76 × 96 px below `md`,
110 × 140 px from `md`, FD-13).

Navigation state: `vite.config.js` maps each page to a nav key; the `{{{ariaCurrent "key"}}}`
helper writes `aria-current="page"` (or `"true"` on detail pages) in the header, drawer and
footer. Django replaces it with a template tag.

## Motion map (FD-69, FD-85, FD-97, FD-98, FD-100; progress of the 360 svh pinned stage, scrub smoothing 0.8 s)

hero hold 0–8 % (scroll cue fades) → hero out 8–16 % → plane turns −9°, approaches 40 px,
scales 1.10 about the face 8–26 % → screen 2 16–65.8 %, **played, not scrubbed** (FD-85,
`screen2.js`): entering either way plays (FD-100) eyebrow + headline (250 ms, rise 8 px),
support (+40 ms, 200 ms), pillar rules `scaleX` + text (+80 ms, 220 ms), Areas rows (rise 6 px,
200 ms, from +300 ms, 30 ms apart) — complete in about 0.55 s; leaving either way fades the
layer out in 180 ms → hold to 46 % → pull-back 46–56 % → shrink into the back-to-top box
56–65 % (`--e-inout`, fast; screen 2 still stands, FD-98) → hand-off at 65 %: the figure and
the back-to-top button swap in one frame (FD-97, no cross-fade; the figure lands at the
button's rest opacity 0.7, its floor shadow faded) → the Fork comes in from 65.5 % (heading
and columns opaque within 2 %; the columns turn and settle and the seam draws to 77.5 %) and
screen 2 leaves once the Fork is half seen (65.8 %) — never an empty stage, never both at rest
(FD-98) → the Fork holds to 100 %. Each Fork card takes the pointer once ≥ 95 % opaque
(FD-96). Focus targets: hero 0 %, screen 2 41 % (shown at once), Fork 90 % (FD-60). Pointer
tilt ±6° / ±3° on fine pointers until the shrink. The staged p = 0 frame is CSS from the first
paint (FD-66). Back-to-top fades, jumps and fades in (FD-70). Phones (< 768 px): no pin; text,
then the photo band with a scrubbed parallax and gentle scale (FD-73), then screen 2 (its
entrance once in view, no exit) and the stacked Fork cards (reveals). 768–991 px: text left,
photo right, static, reveals only.
