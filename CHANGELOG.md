# Changelog

Author: Rasel Al Mamun

All notable changes to this project. Versions 0.1 – 0.9 are the development milestones before
the first public release (1.0.0). Decision ids (FD-xx) refer to `docs/decisions.md`.

## 1.7.4 — 2026-11-07

The QA audit fixes.

- Accessibility (FD-184): in the light theme the primary buttons ("Hire me", "Send", "Download CV" and the Home actions) keep at least 4.5:1 contrast when hovered or focused; their hover fill is now slightly lighter instead of darker. On phones the two footer email links are 44 px tall touch targets. These are the only visible changes.
- Search (FD-185): projects and posts can have their own search description (`meta_description`, at most 160 characters); without one a project uses its summary line or card description and a post its standfirst, cut at a full sentence. Filtered project and Blog pages are `noindex,follow` with the list page as canonical, the 404 page is `noindex`, and the blog post data names its image, address, dates, author and publisher.
- Content check (FD-186): every documented limit is checked before each build from one shared table — page titles, descriptions, the editable text slots and every list — and a published post may not contain a `[bracketed]` placeholder anywhere.
- Lists, images and forms (FD-187): filter options appear only when they have items; the first card of a list loads first; card images come in 480, 960 and 1600 px widths; form fields have the same length limits as the Django forms, and a very long message is shortened in the email fallback.
- Tests (FD-188): the motion tests run on a controlled page clock, so a busy machine no longer fails them; tests read their counts from the content, rebuild a stale build themselves and pick up new test files automatically.
- CI (FD-189): the test job runs in Playwright's own container image, so the browser and its system packages are no longer installed on every run.
- Clean-up (FD-190): unused code removed, shared helpers for the motion setting and link clicks, safer cookie and observer handling, and the working copies of the content are no longer in the public export.
- Motion and the approved design are otherwise unchanged.

## 1.7.3 — 2026-11-06

- Includes everything in 1.7.1 and 1.7.2.
- The back-to-top glide test (FD-181, tests only) judges the movement with three checks instead of one reading: the average speed over three frames stays within the limit (130 px per 1/60 s, unchanged), no single frame is a sudden jump against the frames around it, and the motion was recorded densely enough to judge. A snap or a two-frame jump still fails the test.
- CI (FD-182): the test browser is kept between runs, so it is no longer downloaded each time, and the test job may run for up to 30 minutes.
- Motion and the approved design are unchanged.

## 1.7.2 — 2026-11-06

- Includes everything in 1.7.1.
- The back-to-top glide test (FD-180, tests only) now measures how fast the image moves per unit of time, on the same clock the animation uses, instead of per captured frame. On a busy test machine a frame is sometimes skipped or starts late, and the old test then counted that as one big jump. The limit is the same, 130 px per 1/60 s, and the test still catches a real jump.
- Development tools: minimatch, used only by ESLint, is updated to a fixed version (FD-179, Dependabot alert #9).
- Motion and the approved design are unchanged.

## 1.7.1 — 2026-11-06

- 14 new icons, ready for Django and not yet used by any content: briefcase, handshake, government, chart-up, team, graduation, book, globe, bulb, megaphone, shield and heart join the Area icons, the topic icons (now 36) and the Portfolio expertise icons; star and certificate join the Portfolio award icons.
- List limits (FD-178): the most Portfolio awards (9), education rows (4), expertise groups (4), items per expertise group (12), certifications (2) and bullets per role (3) are written once in the content check, which fails the build above them, and the layout test builds every list empty, with one item and at its maximum. A section stays within 3 phone screens, and within 2 screens from 768 px up.
- Two Django tests corrected (tests only): the Blog's empty text and the 404 page's code and four actions as they are since 1.7.0.
- A dev-only icon sheet (`tools/preview/icon-sheet.mjs`) shows every icon set by name. It is not in the build, the sitemap or the public export.
- Motion and the approved design are unchanged.

## 1.7.0 — 2026-11-05

- Card images (FD-177): every project and post has one card image (1600 × 900, with alt text). It shows on the Home large card, the Projects list, the Blog list and Latest posts, and at the top of its own page.
- Figures in the text: a line `[Figure n]` in a project or post places that figure there. The whole image is shown, never cropped, with the caption "Figure n. …" below it. Three sizes: narrow, normal and wide. In the dark theme a figure sits on a light plate so charts stay readable.
- Share images: each project and post page gets its own 1200 × 630 share image, made from its card image when the site is built.
- Project page: a new Methods section; the Gallery is removed.
- Cards: a card description, a role line and three card tags, each with a length limit that the content check enforces.
- A hidden formatting test page shows every content element (headings, lists, quotes, code, equations, a wide table, figures). It is not in any menu, the sitemap or the public export.
- CI installs the test browser before the build, because the build now draws the share images.
- The public copy builds and tests without the CV placeholder PDF, which is never exported (FD-146).
- Motion and the approved design are unchanged.

## 1.6.0 round 6 — 2026-11-04

- Back to top (FD-173): when the stage releases before the shrink has finished, the back-to-top image takes over at the figure's exact place and size and glides into the corner in about 300 ms (and back when scrolling up); slow scrolling is unchanged.
- Home Contact band (FD-174): less space above "Contact". Contact and Hire me (FD-175): no visible "What to expect" label; the card level with the form. Hire me header (FD-176): HIRE ME, availability, then the title with "Start a brief". Handover section 18.

## 1.6.0 round 5 — 2026-11-04

- Back to top (FD-170): the figure finishes becoming the back-to-top image before the stage releases; from then on that image stays fixed in the corner on slow, fast and reverse scrolling. The only motion change of the round.
- Navbar (FD-171): a Projects item (desktop and phone menu); the Home hero text is centred beside the figure from 1280 × 800.
- Home (FD-172): Selected work at v1.5.1's size with the image strip inside the big card and one set of text sizes; the standard gap before the Contact band and after the Areas of work on phones; a one-line copyright and a footer row the back-to-top photo never covers on phones. The unused email card, profile-links card and copy-button code are removed. Four old tests fixed (tests only).

## 1.6.0 round 4 — 2026-11-04

- Motion is v1.5.1's again (FD-163): the hero mouse effect from page open, the page transitions, the scroll story, the phone portrait motion, the Contact band settle and the back-to-top photo with the figure shrinking into it. "Two sides of this site" is removed; the desktop stage ends at the hand-off.
- Home (FD-164): a cover on the large Selected work card, "All projects" / "All publications", a leaner "Three ways to work with me" (Hire me beside the title), the Blog's cards under Latest posts, a Contact band without emails, one gap between sections, no Contact photo on phones.
- Site (FD-165): no footer AI note; a one-row mobile footer bottom; the menu's Theme button shows the state; an outlined Hire me on /hire; one back link on child pages.
- Blog and posts (FD-166): "Blog / Articles & notes", "{n} articles", "Published d Month yyyy", a collapsible "On this page" on small screens, Previous / Next article.
- Projects and Publications (FD-167), Hire me and Contact (FD-168), 404, Portfolio and Privacy (FD-169). Handover section 16.

## 1.6.0 — 2026-11-03

- Final fixes (FD-162): Home is complete before anyone scrolls (screen 2, the Fork and every section show without JavaScript, with reduced motion, in print and in a capture of an unscrolled page; the reveals and the pinned stage start on the first scroll); a project without a status shows no badge; Publications show 20 per page, a pager only above 20.

- Round 3 (FD-154 … FD-161): pagination and server-rendered list states (projects 9 per page, Blog 9, Publications grouped by year, 30 per page above 30), a GET search that works without JavaScript, 24 topic icons, uploaded post covers, two emails in one group with a copy button per address, expertise as tags, one-line hero and role lines, a round back-to-top arrow (the portrait button and the Home hand-off are gone), "Start a brief", a status on every project card, and smaller layout fixes. Handover section 15.

- Changed: the final site-basics content, Phase 1 (FD-147): the full name, role line, introduction, summary line,
  the Home Areas of work (six, with chip and gear icons) and their targets, the Portfolio / Hire me / Contact /
  Blog / Projects texts and search descriptions, the Projects archive ("Projects — Ideatrium"), "More projects",
  the drawer's Blog sub-line, the contact subjects ("Job opportunity"), skills, expertise and training.
  Google Scholar's URL loses `&hl=en`. The CV link icon is now a download icon (FD-151).
- Added: Web of Science (footer, Portfolio, Contact, `sameAs`); a generic link icon for any other link type.
- Added: the introduction on the Portfolio profile top; three experience roles (Founder · Ideatrium,
  Research Assistant, Undergraduate researcher), the sub-heading "Experience" (FD-149).
- Added: Phase 1 profile fields `second_role`, `eyebrow`, `eyebrow_short`, `location_line`, `author_line`; the
  footer role line is the hero's (FD-148); Person data gets Ideatrium as a separate organisation the person founded.
- Added: dynamic slots (FD-153): every Django-owned text hides when empty and holds its maximum length; lists of 0 to N
  items; `hire.available`; `footer.ai_portrait_shown` (FD-150). `tests/slots.spec.js` builds empty, one-item and
  maximum samples. Handover §14 lists the Django-owned texts, the two phases and the notes for Django.
- Changed: the Portfolio portrait is the owner's photo (suit and tie); the project breadcrumb says "Projects"; no line of a role line, eyebrow, location or author line starts with "·".
- Fixed: formulas, tables and code blocks scroll by keyboard in Safari: focusable, named, with the focus ring (FD-152).
- Fixed: the back-to-top tests wait for the state, not a time (20 of 20 repeats).
- Fixed: the Hire me form's mailto subject without a kind; the footer's link groups hide when empty.

## 1.5.2 — 2026-11-02

- Changed: the CV request becomes a CV download (FD-146). Every CV action (Home, Portfolio, Hire me,
  the drawer) is now a direct link "Download CV (PDF)" to `/cv/Rasel_Al_Mamun_CV.pdf` in the same
  style as the request, opening the PDF in the browser; its accessible name says it is a PDF.
  No CV-request `mailto:` remains. Both email addresses are unchanged.
- Added: a placeholder PDF (`tools/preview/cv/`) for the frontend's own preview and tests, served by
  the dev / preview servers and written into `dist/` only. It is not in `dist-django/`, it is excluded
  from `export:public`, and the export scan fails if any PDF is exported.
- Handover: Django must serve the real PDF at `/cv/Rasel_Al_Mamun_CV.pdf` (`docs/handover-django.md`).
- Tests: the CV link (href, accessible name, no `download`) on every page; no CV-request mailto.

## 1.5.1 — 2026-11-02

- Changed: two public email addresses (FD-145). Wherever the site shows an address (footer of
  every page, Home contact band, Contact, Hire me) it shows hello@ideatrium.com first, then
  mr.raselalmamun@gmail.com, each its own `mailto:` link named "Email <address>". The CV
  request, the structured data, the form's mailto and the Privacy Policy keep
  hello@ideatrium.com only.
- Added: `secondary_email` in `src/content/profile.json` (mirrored in `docs/content/`).
- Tests: the "no Gmail anywhere" release test is replaced by tests for where each address shows.

## 1.5.0 — 2026-11-02

- Added: rich-content styles in the design system (FD-142). The frontend now styles the
  markup of the Django rich-text editor with Django's exact class names, on the design tokens in
  both themes: the post body (`.rt-content`: lists, quotation, rule, highlight, inline code,
  tables, code blocks with the Pygments `tok-*` colours, inline and block math, figures and the
  alignment / size / colour vocabulary) and the rich project Overview (`.project-rich`). Wide
  formulas, tables and code scroll inside their own focusable region, never the page. The two
  template pages show one sample of each element, in Django's exact output, as the visual and
  parity reference.
- Added: the Privacy Policy page `privacy.html` (Django `/privacy/`, FD-143), in the site's text
  style, its whole text in `src/content/privacy.json` (the final v1 text); in the sitemap when `SITE_URL` is
  set. A "Privacy Policy" link in the footer of every page.
- Changed: under the Contact and Hire me forms, the privacy notice is now one line, "Your details
  are used only to reply and are processed in the EU and US.", and the link "Privacy Policy" (FD-140, amended); the
  rest of the old notice, the IP sentence included, is on the Privacy Policy page.
- Changed: each Markdown table region in a post is named "Table 1", "Table 2", … (was "Table");
  blog cards separate the category and "Draft" for screen readers and say "(draft)" in the link
  name.
- Fix round (FD-144): the Privacy Policy is the final v1 text; the public address is
  hello@ideatrium.com everywhere (the Gmail address is gone from the built site, with a test); the
  rich-text orange and purple have design tokens (`text-orange`, `text-purple`, AA in both themes).
- Privacy Policy text v1.1: the sentence about a browser-type code is removed (the site stores only a
  keyed hash of the IP address, no browser code); nothing else in the text changes.
- Docs: no local paths in `docs/setup.md` and FD-01; the Django handover lists the new page and
  route, the copy keys, the rich-content classes and the error page's forced-colours border.
- Tests: a new `tests/rich.spec.js`; the Privacy page in the page, shell, accessibility, widths,
  release and Django-path tests; the footer link on every page; the new form line; a
  forced-colours check of the 404 buttons. The flaky entrance-fade test (`motion.spec.js`) now
  records the fade when it starts and asserts the same thing.

## 1.4.1 — 2026-11-01

- Changed: the privacy notice under the Contact and Hire me forms (FD-140, amended) now says
  "Your IP address is not stored with your message, only a one-way code used to limit spam."
  (was "Your IP address is not stored, only …"). Test updated.

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
