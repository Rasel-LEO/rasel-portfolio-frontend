# Ideatrium — portfolio and blog of Rasel Al Mamun

[![CI](https://github.com/Rasel-LEO/rasel-portfolio-frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/Rasel-LEO/rasel-portfolio-frontend/actions/workflows/ci.yml)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](https://github.com/Rasel-LEO/rasel-portfolio-frontend/blob/main/LICENSE)

`rasel-portfolio-frontend`: the frontend of **Ideatrium**, the portfolio and blog website of
**Md Rasel Al Mamun**, agricultural engineer, researcher and developer. Static, multi-page and responsive, with a pinned 3D Home stage and
site-wide motion. It is built as plain HTML, SCSS and ES modules, and is mounted into a Django
site that serves it under a strict Content Security Policy.

Author: Rasel Al Mamun · Version 1.4.0 (`CHANGELOG.md`)

## Stack

| Concern    | Tool                                                                |
| ---------- | ------------------------------------------------------------------- |
| Build      | Vite 8 (multi-page), Handlebars partials at build time              |
| Styles     | Sass, Bootstrap 5.3 (grid, utilities, offcanvas) with design tokens |
| Motion     | GSAP 3 with ScrollTrigger, Lenis smooth scrolling                   |
| Content    | JSON data files and Markdown post bodies, rendered at build time    |
| Quality    | ESLint, Stylelint, Prettier, html-validate, Lighthouse CI           |
| Tests      | Playwright, axe-core                                                |
| Runtime JS | No framework, no runtime templating, no third-party requests        |

Exact versions and licences: `package.json`, `docs/architecture.md`, `docs/security.md`.

## Requirements

- Node 24 LTS (`.nvmrc`) and npm.
- Git, and the GitHub CLI for pull requests.
- Playwright's Chromium for the tests (`npx playwright install chromium`).
- Optional: Docker Desktop for `npm run test:linux`.

Windows and PowerShell 7 are the reference setup; every step is in `docs/setup.md`.

## Setup

```powershell
npm ci                            # install exactly what package-lock.json lists
npx playwright install chromium   # browser for the tests (one time)
npm run dev                       # http://localhost:5173
```

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

## npm scripts

| Script                  | What it does                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`           | Dev server on http://localhost:5173 (runs `tokens` first)                                  |
| `npm run build`         | Static site into `dist/` (runs `tokens` and `content:check` first)                         |
| `npm run build:django`  | Django target into `dist-django/` (same pre-steps; FD-133)                                 |
| `npm run preview`       | Serves `dist/` locally                                                                     |
| `npm run tokens`        | Writes `src/scss/base/_tokens.scss` from `src/design/tokens.json`                          |
| `npm run content:check` | Validates `src/content/*.json` (ids, references, required fields)                          |
| `npm run privacy:check` | Refuses phone numbers and private CV fields in `src/`, `docs/content/` and `dist/` (FD-23) |
| `npm run lint`          | ESLint, Stylelint and the Prettier check, zero warnings                                    |
| `npm run format`        | Prettier, write                                                                            |
| `npm test`              | Both builds, then CSP, privacy, Django-build and HTML checks and the full Playwright suite |
| `npm run test:widths`   | Screenshots at the seven widths in both themes (`tests/screenshots/`, not committed)       |
| `npm run test:linux`    | The suite inside the Playwright Linux image, as in CI (needs Docker)                       |
| `npm run test:django`   | The browser suite against a running Django site (`DJANGO_BASE_URL`; FD-137)                |
| `npm run validate:html` | html-validate over the built pages (part of `npm test`)                                    |
| `npm run lhci`          | Lighthouse budgets on five pages, mobile preset (builds first; FD-129)                     |
| `npm run check:links`   | Status of every external link of `dist/` (needs the network; not in CI; FD-131)            |
| `npm run check:audit`   | `npm audit` gate with the allow-list `tools/audit-allowlist.json` (FD-134)                 |

Test widths: 320, 390, 768, 1024, 1280, 1440 and 1920 px.

## Build targets

| Command                | Output         | Base                | Use                                                          |
| ---------------------- | -------------- | ------------------- | ------------------------------------------------------------ |
| `npm run build`        | `dist/`        | `/`                 | the static site                                              |
| `npm run build:django` | `dist-django/` | `/static/frontend/` | the files Django serves, with `.vite/manifest.json` (FD-133) |

Both use the same pages, content, chunking and CSP rules. `tools/check-django-build.mjs`
(part of `npm test`) proves that each Django page equals its static page apart from the base,
and that every asset URL resolves. How Django mounts the files: `docs/handover-django.md`.

## Testing

- `npm test` is the full gate, the same as CI: both builds, `tools/check-csp.mjs`,
  `tools/check-privacy.mjs`, `tools/check-django-build.mjs`, html-validate and every
  Playwright spec except the width screenshots.
- `npm run test:widths` for layout changes; `npm run test:linux` reproduces CI's Linux
  Chromium and fonts.
- **Django target.** `npm run test:django` runs the browser suite against a running Django
  site, mapped through the URL table in `tests/pages.js`. Without Django, the stand-in server
  `tools/serve-django-paths.mjs` serves `dist-django/` under the Django URLs:

  ```powershell
  npm run build:django
  node tools/serve-django-paths.mjs dist-django 8001          # in a second terminal
  $env:DJANGO_BASE_URL = 'http://127.0.0.1:8001'; npm run test:django
  ```

  Test sets, skips and their reasons: `docs/testing-django.md`.

## Editing content

All copy lives in `src/content/*.json`; pages never hard-code it. Counts and orders are
computed from the data. `npm run content:check` (also run before every build) validates the
files, and `npm run privacy:check` refuses private data such as phone numbers.

- Blog posts: an entry in `src/content/blog.json` plus its body in
  `src/content/posts/<slug>.md` (rules in `src/content/posts/README.md`).
- Research projects: `src/content/projects.json`; each project gets its own page.
- Placeholder copy stays in visible `[brackets]` until the final text is supplied.

## Release and export

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
- A release: version in `package.json` and `package-lock.json`, an entry in `CHANGELOG.md`,
  a decision record in `docs/decisions.md` where behaviour changes, `npm run lint` and
  `npm test` green, one pull request, squash merge.
- **Public copy.** The private working repository publishes each release as a public copy:
  the tracked files go to the sibling folder `../rasel-portfolio-frontend-public`, the
  export-only files (Dependabot configuration, `.github/dependabot.yml`) to their public
  paths, and the result is scanned. The exclusion and scan lists are machine-local
  (`tools/*.local.json`, never committed); without them the export refuses to run.

`dist/` is static: every page works without JavaScript, and nothing is loaded from another
origin.

## Structure

The folder and file tree, with the purpose of each part: [`docs/structure.md`](docs/structure.md).

| Document                                             | Contents                                                  |
| ---------------------------------------------------- | --------------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)       | stack, module layout, Django mapping, breakpoints, motion |
| [`docs/decisions.md`](docs/decisions.md)             | frontend decisions FD-01 … FD-140                         |
| [`docs/security.md`](docs/security.md)               | CSP, privacy, dependencies, licences                      |
| [`docs/setup.md`](docs/setup.md)                     | Windows setup, everyday Git work, troubleshooting         |
| [`docs/handover-django.md`](docs/handover-django.md) | mounting the frontend in Django                           |
| [`docs/testing-django.md`](docs/testing-django.md)   | the browser suite against Django                          |
| [`CHANGELOG.md`](CHANGELOG.md)                       | releases 0.1.0 … 1.4.0                                    |

## Licence

Code: MIT (`LICENSE`). Fonts: SIL Open Font License 1.1 (`src/fonts/`).

## Brand and content

The MIT licence covers the source code only. It does **not** cover:

- the **Ideatrium** name and logo (the inline logo in `src/partials/icons/`, the icons and the
  share image in `public/`);
- the photographs and portraits;
- the written content (`src/content/`, `docs/content/`).

All rights to these are reserved by Rasel Al Mamun. They may not be reused, in this or any
other project, without written permission.

## Author

Rasel Al Mamun — [github.com/Rasel-LEO](https://github.com/Rasel-LEO)
