# Testing the Django site with the browser suite (FD-137)

The Playwright suite runs against a running Django site as well as against the static build.
The default target is unchanged: `npm test` builds `dist/` and `dist-django/`, starts
`vite preview` and runs the full suite.

## Running it

1. In the Django repository, start the site with the frontend mounted (the same version as
   `dist-django/`), for example `python manage.py runserver 8001`.
2. Here, from a built `dist-django/` of the version Django mounts (`npm run build:django`; the
   tests read build sizes from it):

   ```text
   DJANGO_BASE_URL=http://127.0.0.1:8001 npm run test:django
   DJANGO_BASE_URL=http://127.0.0.1:8001 npm run test:django -- tests/shell.spec.js -g drawer
   ```

   On Windows PowerShell: `$env:DJANGO_BASE_URL='http://127.0.0.1:8001'; npm run test:django`.

With `TEST_TARGET=django` (set by `npm run test:django`) Playwright uses `DJANGO_BASE_URL`, starts
no web server and builds nothing. Arguments after `--` replace the default list of spec files.

## How the target works

- `playwright.config.js` switches the base URL and drops the `webServer` entry.
- `tests/pages.js` holds the one URL table (the same table as the Django parity test):
  `index.html` → `/`, `portfolio.html` → `/portfolio/`, `publications.html` →
  `/portfolio/publications/`, `research.html` → `/portfolio/research/`, `project-<id>.html` →
  `/portfolio/<id>/`, `blog.html` → `/blog/`, `post-<slug>.html` → `/blog/<slug>/`, `hire.html` →
  `/hire/`, `contact.html` → `/contact/`, `404.html` → `/no-such-page/` (any unknown path).
  `pagePath(file)` gives the path, `pageEnd(file)` a URL pattern, `staticBase` the asset prefix
  (`/static/frontend`) and `buildDir` the build read from disk (`dist-django`).
- `tests/fixtures.js` is the `test` the specs import. On the Django target it maps every
  `page.goto('/<file>.html')` to the page's Django URL, so the specs are shared. On the static
  target it is Playwright's own `test`, unchanged.
- The page list is fixed, not read from `dist/`: the eight template pages with a Django URL plus
  the 15 projects of `src/content/projects.json`, and no post page.
- Expected hrefs in the specs go through `pagePath()`, so they are the Django URLs.

## Test sets (`npm run test:django`)

`shell` (header, drawer, skip link, focus, back-to-top, footer), `a11y` (axe), `widths` (the seven
widths, both themes, every page type), `motion` (including reduced motion), `inner-pages`,
`home`, `stage` (the Home stage), `portfolio`, `blog`, `forms-live`, and `django` (Django only: the
URL table answers 200, the Blog empty state, draft post URLs and unknown paths answer 404 with the
404 page). The widths set covers 320, 390, 768, 1024, 1280, 1440 and 1920 for the home, portfolio,
project, blog, hire, contact and 404 pages.

Not run on Django: `content`, `release` and `pages` (they read or build `dist/` and `src/`, and
need no server) and `forms` (the static-mode `mailto:` behaviour; the Django forms are live).

`forms-live` keeps its request interception. It fulfils the page document with an action added and
answers the form's POST itself, so no real POST reaches Django.

## Harness fixes found on the real site (release 1.3.1)

The first run against the real Django site found three faults in the suite itself (test-only; no
shipped file changed):

- `forms-live` made its own hidden `started` field, and the Django form already has one. The
  test now sets the value of the existing field and adds one only when the page has none.
- The `portfolio` screenshot tests injected a `<style>` element, which the site's
  `style-src 'self'` blocks. They now set the header position through the CSSOM, which the
  policy allows.
- A click before the form script had initialised the form, under load, was a plain submit. Every
  live-form test now waits for the form's `noValidate` flag before it acts.

The stand-in server now also sends the public Content-Security-Policy of the Django site on every
page and asset, and writes the hidden `started` field into the Hire and Contact forms, so these
faults show up here too.

## Skipped on Django, with the reason

Draft posts are not public in Django: the Blog shows its empty state, Latest posts on Home is
absent and no post page exists. These tests assume the three seed drafts and are skipped
(`test.skip(isDjango, …)`; the reason is shown in the run).

| Spec        | Test                                                                                                                  | Reason                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| blog        | Blog list: lists the three posts as image cards; the category filter; a category without posts shows the empty state  | drafts are not public                                                                    |
| blog        | Blog without JavaScript: every post is listed                                                                         | drafts are not public                                                                    |
| blog        | Post pages: one page per post; each `post-<slug>.html` shows the post; code scrolls inside the measure at 320 px      | no post page exists                                                                      |
| home        | FD-103: Latest posts shows the three seed posts; FD-105 Read article link styles; Latest posts layout (1440 and 390)  | Latest posts is absent without published posts                                           |
| home        | FD-101 section spacing, blog.html at 390                                                                              | the empty Blog leaves 160 px above the footer, over the 112 px limit; see "Open finding" |
| inner-pages | Blog: draft preview, cards, 3 / 2 / 1 columns                                                                         | drafts are not public                                                                    |
| inner-pages | Blog without JavaScript: every card links to its post                                                                 | drafts are not public                                                                    |
| inner-pages | post page: cover and sidebar, sticky sidebar, phones                                                                  | no post page exists                                                                      |
| inner-pages | 404 and site-wide links: text links underline (reads a post page)                                                     | no post page exists                                                                      |
| inner-pages | 320 px Blog tabs; reduced-motion tab ink; pressed tab scrolled into view (320, 390); 768 tabs; an empty Blog category | the tabs exist only when posts exist                                                     |
| inner-pages | post figure placeholder; post sidebar scrolls on its own                                                              | no post page exists                                                                      |
| portfolio   | project pages: the template shows the featured poultry project                                                        | there is no `portfolio-entry.html` template page                                         |

Two tests adapt instead of skipping: the Home section order and the Home keyboard walk expect no
`latest` section on Django.

## Open finding

On Django, `blog.html` at 390 px has 160 px between the empty state and the footer (the
FD-101 limit is 112 px). The static build never shows that state. It is a layout question for an
owner design decision, not a test fault, so the one case is skipped until it is decided.

## Self-check in this repository

There is no Django server here. `tools/serve-django-paths.mjs` stands in for it: a tiny static
server that serves a Django build under the Django URLs of `tests/pages.js`, its assets under
`/static/frontend/`, rewrites the page links in the HTML to the Django URLs (as the Django
templates write them) and answers any other path with the 404 page and status 404.

```text
npm run build:django
node tools/serve-django-paths.mjs dist-django 8001
DJANGO_BASE_URL=http://127.0.0.1:8001 npm run test:django
```

It proves the target switch, the URL table, the asset base and the shared specs. It cannot prove
Django behaviour (forms, CSRF, drafts): it serves what it is given. `dist-django/` holds the
default content mode, with the three draft posts; Django does not show drafts, so for the Blog
empty state and the rest of the draft-dependent tests build a release-mode Django build,
which replaces `dist-django/` (the Django target always writes there), and restore it afterwards:

```text
RELEASE=true npm run build:django
node tools/serve-django-paths.mjs dist-django 8001
DJANGO_BASE_URL=http://127.0.0.1:8001 npm run test:django
npm run build:django
```
