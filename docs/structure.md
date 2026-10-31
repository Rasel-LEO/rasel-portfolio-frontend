# Structure

Author: Rasel Al Mamun

The folder and file tree of the repository at v1.3.1, three levels deep, with the purpose of
each part. Generated folders (`node_modules/`, `dist/`, `dist-django/`, `playwright-report/`,
`test-results/`, `tests/screenshots/`, `.lighthouseci/`) are ignored by Git and not shown.
Module-level detail: `docs/architecture.md`.

## Tree

```text
.
├── .github/
│   ├── ISSUE_TEMPLATE/bug.md        bug report form
│   ├── pull_request_template.md     checklist for every pull request
│   └── workflows/ci.yml             CI: audits, lint, both builds, Django-build check, tests, Lighthouse
├── .vscode/extensions.json          recommended editor extensions (ESLint, Stylelint, Prettier, Playwright)
├── docs/
│   ├── architecture.md              stack, module layout, build and test targets, Django mapping, motion map
│   ├── content/                     approved content sources; the tests compare src/content with them
│   │   ├── public-content.json      every public content block in one file
│   │   ├── portfolio-content.json   approved Portfolio content
│   │   ├── inner-pages-content.json approved inner-page content
│   │   └── web-cv.md                text of the public CV PDF (FD-23)
│   ├── decisions.md                 frontend decisions FD-01 … FD-140
│   ├── handover-django.md           how Django mounts the templates and static files
│   ├── security.md                  CSP, privacy, dependency policy, licence register
│   ├── setup.md                     Windows setup, everyday Git work, troubleshooting
│   ├── structure.md                 this file
│   └── testing-django.md            the browser suite against a Django site (FD-137)
├── public/                         copied unhashed; served at the site root (FD-139)
│   ├── apple-touch-icon.png         Ideatrium icon, 180 × 180, for iOS home screens
│   ├── favicon.ico                  Ideatrium favicon, 16 / 32 / 48 px
│   ├── favicon.svg                  Ideatrium favicon for modern browsers
│   ├── icon-192.png, icon-512.png   web app manifest icons
│   ├── images/brand/                the share image (Open Graph, Twitter), 1200 × 630
│   ├── js/theme-init.js             classic script, first in <head>: theme before first paint (FD-12)
│   ├── robots.txt                   crawler rules; the Sitemap line is added when SITE_URL is set
│   └── site.webmanifest             web app manifest: name, icons, colours
├── src/
│   ├── content/                     all site copy as JSON (FD-19)
│   │   ├── *.json                   one file per block: profile, home, portfolio, projects, blog, …
│   │   └── posts/                   Markdown bodies of the blog posts, one per slug (FD-37)
│   ├── design/tokens.json           design tokens: colour, type, spacing, radius, motion
│   ├── fonts/                       self-hosted, subset woff2 files with their licences (FD-130)
│   │   ├── *.woff2                  Bricolage Grotesque; JetBrains Mono 400 and 500
│   │   ├── LICENSE-*.txt            SIL OFL 1.1 texts
│   │   ├── README.md                provenance of the font files
│   │   └── subset.json              the character set of the subset
│   ├── images/                      the owner's portraits (AVIF + WebP) and in-house SVGs
│   │   ├── avatar/                  avatar at 96 and 512 px
│   │   ├── figure/                  P5 and P6 portrait cut-outs, 720 × 1300
│   │   ├── arrow.svg                link arrow
│   │   ├── placeholder.svg          media placeholder
│   │   └── README.md                provenance and licence of the images
│   ├── js/                          ES modules (no framework)
│   │   ├── main.js                  entry: shell modules, page module by <body data-page>, motion
│   │   ├── core/                    theme, drawer, back-to-top, page wipe, scrolling, tabs, toggle groups
│   │   ├── motion/                  reveals, tilt, cursor, Lenis, the Home stage, screen 2, Home motion
│   │   └── pages/                   Portfolio, research archive, Blog, post, forms
│   ├── pages/                       one Handlebars page per route (10); two are templates
│   │   ├── index.html               Home
│   │   ├── portfolio.html           Portfolio
│   │   ├── publications.html        all publications
│   │   ├── research.html            all research projects
│   │   ├── portfolio-entry.html     template of every project-<id>.html
│   │   ├── blog.html                Blog
│   │   ├── blog-post.html           template of every post-<slug>.html
│   │   ├── hire.html                Hire me
│   │   ├── contact.html             Contact
│   │   └── 404.html                 not found
│   ├── partials/                    build-time Handlebars partials
│   │   ├── shell/                   head, header, drawer, footer, back-to-top, page wipe
│   │   ├── components/              buttons, chips, pills, form field, tabs, images
│   │   ├── sections/                cards and rows of page sections, JSON-LD
│   │   └── icons/                   in-house line icons and illustrations
│   └── scss/
│       ├── main.scss                imports in cascade order
│       ├── base/                    tokens (generated), Bootstrap overrides, base, type, motion
│       ├── layout/                  shell: skip link, header, drawer, footer, back-to-top
│       ├── components/              buttons, links, chips, cards
│       └── pages/                   Home, stage, Portfolio, inner pages
├── tests/                           Playwright specs (one file per area) and shared helpers
│   ├── *.spec.js                    a11y, blog, content, django, forms, forms-live, home, inner-pages,
│   │                                motion, pages, portfolio, release, shell, stage, widths
│   ├── fixtures.js                  the shared test; maps page URLs on the Django target
│   └── pages.js                     page lists, the Django URL table, build paths
├── tools/                           Node scripts for the build, checks and test runners
│   ├── audit-allowlist.json         accepted development advisories with expiry (FD-134)
│   ├── check-audit.mjs              npm audit gate with the allow-list
│   ├── check-csp.mjs                CSP scan of the built pages
│   ├── check-django-build.mjs       compares dist-django with dist, resolves every asset URL
│   ├── check-links.mjs              external link status (opt-in, needs the network)
│   ├── check-privacy.mjs            refuses phone numbers and private CV fields
│   ├── content.mjs                  loads src/content and derives counts, orders and pages
│   ├── lhci.mjs                     Lighthouse CI with Playwright's Chromium
│   ├── markdown.mjs                 post bodies, Markdown to HTML at build time
│   ├── serve-django-paths.mjs       stand-in server: dist-django under the Django URLs
│   ├── subset-fonts.mjs             one-time font subsetting
│   ├── test-django.mjs              runs the browser suite against DJANGO_BASE_URL
│   ├── test-linux.mjs               runs the suite in the Playwright Linux image (Docker)
│   ├── tokens.mjs                   writes src/scss/base/_tokens.scss from the tokens
│   └── validate-content.mjs         content validation before every build
├── .editorconfig                    UTF-8, LF, two-space indentation
├── .gitattributes                   line endings and binary files
├── .gitignore                       generated output, environment files, machine-local settings
├── .htmlvalidate.mjs                html-validate rules for the built pages
├── .npmrc                           exact versions on install, engine check
├── .nvmrc                           Node 24
├── .prettierignore                  files Prettier leaves alone
├── .prettierrc                      Prettier options
├── .stylelintrc.json                Stylelint options
├── CHANGELOG.md                     releases 0.1.0 … 1.3.1
├── LICENSE                          MIT for the code; photographs and copy reserved
├── README.md                        overview, scripts, build and test targets, release
├── eslint.config.js                 ESLint flat config
├── lighthouserc.json                Lighthouse budgets and pages (FD-129)
├── package.json                     scripts and exact dependency pins
├── package-lock.json                locked dependency tree
├── playwright.config.js             test runner: static target or Django target (FD-137)
└── vite.config.js                   multi-page build, Handlebars data, Django target, sitemap
```

## Where to change what

| Change                    | Files                                                                      |
| ------------------------- | -------------------------------------------------------------------------- |
| Copy, projects, posts     | `src/content/*.json`, `src/content/posts/<slug>.md`                        |
| A colour, size or timing  | `src/design/tokens.json`, then `npm run tokens`                            |
| Markup of a page          | `src/pages/<page>.html` and the partials it includes                       |
| Styles                    | `src/scss/` (layer by layer, see above)                                    |
| Behaviour                 | `src/js/core/`, `src/js/motion/`, `src/js/pages/`                          |
| Build, routes and sitemap | `vite.config.js`, `tools/content.mjs`                                      |
| Tests                     | `tests/*.spec.js`; page lists and the Django URL table in `tests/pages.js` |
