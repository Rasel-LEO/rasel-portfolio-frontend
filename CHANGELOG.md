# Changelog

Author: Rasel Al Mamun

All notable changes to this project. Versions 0.1 – 0.9 are the development milestones before
the first public release (1.0.0). Decision ids (FD-xx) refer to `docs/decisions.md`.

## 1.4.0 — 2026-10-31

- Added: the **Ideatrium** brand (FD-139).
  - Header and drawer: the primary logo `[i] ideatrium`, 24 px tall, as inline SVG with a fixed
    size (no shift at the font swap); below 380 px the `[i]` mark. The header link is named
    "Ideatrium, home". The avatar mark and its preload are gone.
  - Footer: the signature form, the logo plus "by Rasel Al Mamun" as text, linking Home.
  - Tokens `logo-ink` (= `fg-0`) and `logo-accent` (`#9A6100` light, `#F0B23E` dark).
  - Titles `<short title> — Ideatrium`, Home `Rasel Al Mamun — Ideatrium`; `og:site_name`
    Ideatrium; the share image (1200 × 630) for Open Graph and Twitter
    (`summary_large_image`); `theme-color` for light and dark; a `WebSite` JSON-LD named
    Ideatrium with the Person as author. The author, the Person, the hero name and the meta
    descriptions keep the personal name.
  - Root files: `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`,
    `icon-512.png` and `site.webmanifest` (replace `data:,`). The Django build lists them in
    `.vite/root-files.json` and `check-django-build.mjs` checks them.
- Added: the privacy notice under the Contact and Hire me forms (FD-140); it replaces the
  short note under the Message / Brief field, which is removed.
- Changed: no shipped image carries provenance metadata (FD-139). The brand PNGs, the SVG
  favicon and the eight portraits in `src/images/` lost their C2PA blocks; the pixels are
  unchanged (decoded and compared). A release test scans every shipped image.
- Added: the AI-generated P5 / P6 portraits are disclosed (FD-141). The footer of every page
  says "Some portrait images on this site are AI-generated from my own photos."; a descriptive
  alt text for P5 / P6 must end with "(AI-generated from my own photo)" (today every use is
  decorative, `alt=""`). The real-photo avatar is not labelled.
- README: the new name, CI and licence badges, and a "Brand and content" section; `LICENSE`
  notes that the Ideatrium name and logo are not covered by MIT.
- The public export drops the private-repository clone line from `docs/setup.md`.
- Tests: the brand, icons, manifest, share image, header layout at the font swap, logo
  visibility at five widths, contrast in both themes and the privacy notice.

## 1.3.1 — 2026-10-29

- Fixed: three faults of the browser suite found on the real Django site (test-only; no
  shipped file changed, `docs/testing-django.md`):
  - `forms-live` sets the value of the form's existing hidden `started` field and adds one
    only when the page has none;
  - the `portfolio` screenshot tests set the header position through the CSSOM instead of an
    injected `<style>`, which `style-src 'self'` blocks;
  - every live-form test waits for the form script (`noValidate`) before it acts.
- The stand-in server `tools/serve-django-paths.mjs` sends the Django site's
  Content-Security-Policy on every response and writes the hidden `started` field into the
  Hire me and Contact forms, so these faults show up locally too.

## 1.3.0 — 2026-10-29

- Added: Django test target for the browser suite (test-only, FD-137). `npm run test:django`
  with `DJANGO_BASE_URL` runs the shell, accessibility, widths, motion, inner-pages, Home,
  stage, Portfolio, Blog, live-form and Django-only specs against a running Django site.
- One URL table in `tests/pages.js` (the same as the Django parity test) and a shared `test`
  in `tests/fixtures.js` that maps every `page.goto('/<file>.html')` to the Django URL.
- Django-only differences are skipped with a stated reason (draft posts are not public, the
  forms are live, there are no template pages); the default target is unchanged.
- `tools/serve-django-paths.mjs`: a stand-in server that serves `dist-django/` under the
  Django URLs, to prove the target switch without Django.

## 1.2.1 — 2026-10-29

- Fixed: a `413` JSON answer (the form body is over the server's limit) is shown in place like
  `422` and `429`; before, it fell back to a normal post that re-sent the oversized body. A
  `413` that is not JSON still falls back (FD-136).

## 1.2.0 — 2026-10-29

- Added: live forms send in the background (FD-136). A valid submit posts with `fetch`
  (`Accept: application/json`, the whole `FormData`, including the CSRF, start-time and
  honeypot fields) and shows the JSON answer in place: success resets the form, `422` and
  `429` render the field errors, `403` asks for a reload; a network error or any other answer
  falls back to a normal post, so no message is lost.
- After a normal reload, a server-rendered status is scrolled into view and focused.
  Static site unchanged.

## 1.1.0 — 2026-10-28

- Added: live form mode (forms with an action submit to the server). Static site unchanged.
  A Hire me or Contact form with a non-empty `action` posts after the client-side checks
  pass, with the submit button disabled against a double submit; server-rendered errors and
  status are kept on load (FD-135).

## 1.0.2 — 2026-10-27

- Security: development tooling updated; audit gate for development dependencies. No change
  to the static site or the Django build output. `html-validate` 11.17.0, `marked` 18.1.2;
  `overrides` for `tmp`, `uuid`, `basic-ftp` and `@puppeteer/browsers`; `npm run check:audit`
  with `tools/audit-allowlist.json` in CI (FD-134).

## 1.0.1 — 2026-10-27

- Added: Django build target with Vite manifest. No change to the static site.
  `npm run build:django` writes `dist-django/` under the base `/static/frontend/`, with
  `.vite/manifest.json` and the supplementary `.vite/asset-map.json`; checked in `npm test`
  and CI (FD-133).

## 1.0.0 — 2026-10-27 · First public release

- Design tokens in `src/design/tokens.json`, the single source of `_tokens.scss` (FD-128).
- Short tab titles (at most 60 characters); the formal title stays the page heading (FD-128).
- Lighthouse budgets on Home, Portfolio, Blog, Hire me and a project page, in CI
  (`npm run lhci`; Performance ≥ 90, Accessibility 100, Best practices ≥ 95, SEO ≥ 95;
  FD-129).
- Fonts subset to the characters the site uses and JetBrains Mono Medium added: 134.3 KB for
  three files (was 152.7 KB for two); image audit (FD-130).
- Release build: drafts hidden, `noindex` on the template pages, `sitemap.xml` and the
  robots `Sitemap:` line once `SITE_URL` is set, an opt-in external link check, reflow at
  400 % zoom tested (FD-131).
- Handover for the Django mount: `docs/handover-django.md` (FD-132).
- CI and pull request template for the public repository.

## 0.9.0 — 2026-10-26 · Cleanup and production readiness

- Unreferenced partials, images, styles, helpers and a test with no target removed.
- Partials grouped into `shell`, `components`, `sections`, `icons`; styles into `base`,
  `layout`, `components`, `pages`; scripts into `core`, `motion`, `pages` (FD-125).
- Comments rewritten as technical explanation; `Author: Rasel Al Mamun` headers, page
  `meta author` and `package.json` author (FD-123).
- README, architecture, security and setup documents rewritten; decision records name their
  approver; this changelog.
- Formatting, lint and built-HTML validation gates; security and privacy checks (FD-126).
- No visual or behavioural change: built HTML compared before and after.

## 0.8.0 — 2026-10-26 · Inner pages

- Blog with image cards, in-house line-drawing covers and category tabs; post page with
  sticky sidebar: "On this page", author card and "More posts" (FD-112 … FD-114).
- Research archive with search and topic filter; one data-driven project page template for
  every research project (FD-115, FD-116).
- Hire me, Contact and 404 polished; site-wide link styles (FD-117 … FD-119).
- Linux test run in the Playwright image (`npm run test:linux`); metric-matched mono
  fallbacks (FD-121, FD-127).

## 0.7.0 — 2026-10-26 · Portfolio

- Portfolio as six curated sections: profile, publications with tabs, research projects,
  awards, experience and expertise (FD-107, FD-108).
- "View all" pages for publications and research projects (FD-109).
- Tags as pills site-wide; status chips; profile entrance motion (FD-110, FD-111).

## 0.6.0 — 2026-10-26 · Motion

- Pinned 3D Home stage from 992 px with GSAP ScrollTrigger; stacked variant on phones and
  tablets; reduced motion respected through `gsap.matchMedia` (FD-51 … FD-54).
- Reveals, card tilt, magnetic buttons, cursor follower and Lenis smooth scrolling on
  fine-pointer desktops (FD-52, FD-82).
- Fonts without flash, staged first paint, hero entrance, seam wipe between pages
  (FD-65 … FD-67, FD-81).
- Home screen 2 and its played entrance; Areas of work; services, Selected work,
  publications and Latest posts refined (FD-84 … FD-105).

## 0.5.0 — 2026-10-24 · Home

- Home as a complete document without motion: hero with photo, statement, Fork cards,
  Hire me section, Selected work, Latest posts and Contact band (FD-44 … FD-50).

## 0.4.0 — 2026-10-24 · Blog, Hire me and Contact

- Blog with category filter (with and without JavaScript), draft posts and empty state;
  post pages from Markdown (FD-36, FD-37).
- Hire me with services, process and brief form; Contact with email, profile links and
  form; native validation without JavaScript (FD-38 … FD-43).

## 0.3.0 — 2026-10-24 · Content model and Portfolio

- Site content as data in `src/content/*.json`, validated before every build; privacy
  check (FD-19, FD-23).
- First Portfolio page with publications, research projects, awards, education and
  skills; project page template; JSON-LD and Open Graph (FD-20 … FD-35).

## 0.2.0 — 2026-10-24 · Shell

- Head, header, offcanvas drawer below 992 px, footer, theme switch (dark default, no
  flash), back-to-top photo button, skip link, 404 page (FD-11 … FD-18).

## 0.1.0 — 2026-10-24 · Scaffold

- Vite multi-page build with Handlebars partials, Bootstrap 5.3 Sass with design-token
  overrides, self-hosted fonts, ESLint, Stylelint, Prettier, Playwright with axe, and
  GitHub Actions CI (FD-01 … FD-10).
