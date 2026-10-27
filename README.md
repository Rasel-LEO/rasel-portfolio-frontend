# rasel-portfolio-frontend

Frontend of the portfolio and blog website of **Md Rasel Al Mamun**, agricultural engineer,
researcher and developer. Static, multi-page and responsive, with a pinned 3D Home stage and
site-wide motion. It is built as plain HTML, SCSS and ES modules, and is designed to be
mounted into a Django site that serves it under a strict Content Security Policy.

Author: Rasel Al Mamun

## Stack

| Concern    | Tool                                                                |
| ---------- | ------------------------------------------------------------------- |
| Build      | Vite 8 (multi-page), Handlebars partials at build time              |
| Styles     | Sass, Bootstrap 5.3 (grid, utilities, offcanvas) with design tokens |
| Motion     | GSAP 3 with ScrollTrigger, Lenis smooth scrolling                   |
| Content    | JSON data files and Markdown post bodies, rendered at build time    |
| Quality    | ESLint, Stylelint, Prettier, html-validate                          |
| Tests      | Playwright, axe-core                                                |
| Runtime JS | No framework, no runtime templating, no third-party requests        |

Exact versions and licences: `package.json`, `docs/architecture.md`, `docs/security.md`.

## Pages

| Page                          | Source                                    | Built as            |
| ----------------------------- | ----------------------------------------- | ------------------- |
| Home                          | `src/pages/index.html`                    | `index.html`        |
| Portfolio                     | `src/pages/portfolio.html`                | `portfolio.html`    |
| All publications              | `src/pages/publications.html`             | `publications.html` |
| All research projects         | `src/pages/research.html`                 | `research.html`     |
| Research project (one per id) | `src/pages/portfolio-entry.html` template | `project-<id>.html` |
| Blog                          | `src/pages/blog.html`                     | `blog.html`         |
| Blog post (one per post)      | `src/pages/blog-post.html` template       | `post-<slug>.html`  |
| Hire me                       | `src/pages/hire.html`                     | `hire.html`         |
| Contact                       | `src/pages/contact.html`                  | `contact.html`      |
| Not found                     | `src/pages/404.html`                      | `404.html`          |

## Structure

```
src/
  pages/            one HTML file per page (Handlebars templates)
  partials/
    shell/          head, header, drawer, footer, back-to-top, page wipe
    components/     buttons, chips, pills, form field, tabs, images
    sections/       cards and rows of page sections, JSON-LD
    icons/          in-house line icons and illustrations
  scss/
    base/           tokens (generated), Bootstrap, base, type, motion
    layout/         shell (header, drawer, footer, back-to-top)
    components/     buttons, links, chips, cards
    pages/          Home, stage, Portfolio, inner pages
    main.scss
  js/
    core/           theme, drawer, back-to-top, page wipe, scrolling, tabs
    motion/         site-wide motion, Home stage, cursor follower
    pages/          Portfolio, research, Blog, post, forms
    main.js         entry point
  design/           tokens.json, the design tokens (source of _tokens.scss)
  content/          site content (*.json) and post bodies (posts/*.md)
  images/           WebP + AVIF images
  fonts/            self-hosted woff2 files and their licences
public/             robots.txt and the theme script copied as-is
tools/              build helpers and checks (tokens, content, CSP, privacy, Linux run)
tests/              Playwright specs
docs/               architecture, decisions, security, setup, content sources
```

## Commands

Node 24 LTS (`.nvmrc`).

```powershell
npm ci                  # install exactly what package-lock.json lists
npm run dev             # dev server, http://localhost:5173
npm run build           # tokens, content validation, then the build into dist/
npm run preview         # serve dist/ locally
npm run lint            # ESLint, Stylelint, Prettier check
npm run format          # Prettier, write
npm test                # build, CSP, privacy and HTML checks, full Playwright suite
npm run test:widths     # screenshots at the seven widths in both themes
npm run test:linux      # the full suite inside the Playwright Linux image (needs Docker)
npm run validate:html   # html-validate over the built pages (part of npm test)
npm run lhci            # Lighthouse budgets on five pages (build, mobile preset, FD-129)
npm run check:audit     # npm audit gate with the allow-list tools/audit-allowlist.json (FD-134)
```

Test widths: 320, 390, 768, 1024, 1280, 1440 and 1920 px.

## Editing content

All copy lives in `src/content/*.json`; pages never hard-code it. Counts and orders are
computed from the data. `npm run content:check` (also run before every build) validates the
files, and `npm run privacy:check` refuses private data such as phone numbers.

- Blog posts: an entry in `src/content/blog.json` plus its body in
  `src/content/posts/<slug>.md` (rules in `src/content/posts/README.md`).
- Research projects: `src/content/projects.json`; each project gets its own page.
- Placeholder copy stays in visible `[brackets]` until the final text is supplied.

## Release build

```powershell
$env:RELEASE = 'true'; $env:SITE_URL = 'https://example.org'
npm run build
Remove-Item Env:RELEASE, Env:SITE_URL   # a later npm test expects the default build
```

- `RELEASE=true` builds only published posts (unless `SHOW_DRAFTS` says otherwise): the Blog
  shows its empty state and Home hides Latest posts while there is none. `SHOW_DRAFTS=false`
  alone leaves drafts out of any build.
- `SITE_URL` (no trailing slash) adds canonical links, absolute Open Graph image URLs,
  `sitemap.xml` and the `Sitemap:` line in `robots.txt`; without it neither file mentions a
  domain (FD-22, FD-131).
- The two template pages (`portfolio-entry.html`, `blog-post.html`) carry `noindex` and are
  not in the sitemap.
- `npm run check:links` (after a build; needs the network, not in CI) prints the status of
  every external link; sites that refuse automated requests are listed to open by hand.

`dist/` is static: every page works without JavaScript, and nothing is loaded from another
origin.

## Licence

Code: MIT (`LICENSE`). Photographs, portraits and written content: © Md Rasel Al Mamun, all
rights reserved; they are not covered by the MIT licence. Fonts: SIL Open Font License 1.1
(`src/fonts/`).
