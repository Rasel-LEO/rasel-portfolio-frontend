# Security

Author: Rasel Al Mamun

## Content Security Policy target (production, served by Django)

```
default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:;
font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self';
form-action 'self'; frame-ancestors 'none'
```

Consequences for this repository: no inline `<script>` (JSON-LD data blocks excepted, they
do not execute), no `on*=` handlers, no `style=` attributes in markup (runtime style changes
from the site's own modules are fine), no `eval` / `new Function`, no third-party origins at
runtime. `tools/check-csp.mjs` scans `dist/` for violations, and `tests/pages.spec.js` loads
and scrolls every page and fails on any request to another origin; both run in `npm test`
and CI.

## Privacy

`tools/check-privacy.mjs` (FD-23) fails on phone numbers and private CV fields (date of
birth, family, address, religion, blood group, marital status, grades, referees, political
affiliations) in `src/`, `docs/content/` and `dist/`. The full CV is never committed.

## Dependencies

- Exact versions in `package.json`; `package-lock.json` committed; CI uses `npm ci`.
- `npm audit --omit=dev --audit-level=high` runs in CI; high or critical findings fail it.
  The full `npm audit` also lists advisories in the dev-only tree of `@lhci/cli` (its
  `lighthouse` / `puppeteer-core` dependencies); they run only against the site's own built
  pages on a local port and never ship.
- Dependabot (`.github/dependabot.yml`) opens weekly pull requests for npm and GitHub Actions.
- Every runtime package and vendored asset is listed below with its licence.

### Licence register — packages

| Package                                    | Version                                                                       | Licence                                                                        | Where used                                                                                                                                                                                                |
| ------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bootstrap`                                | 5.3.8                                                                         | MIT                                                                            | Runtime: Sass source compiled into `main.css` (grid, reboot, type, buttons, offcanvas, utilities); `offcanvas.js` bundled by `src/js/core/drawer.js` and `src/js/core/page-wipe.js`                       |
| `gsap`                                     | 3.15.0                                                                        | GSAP Standard "no charge" licence (https://gsap.com/standard-license), not OSI | Runtime: core + ScrollTrigger imported by `src/js/motion/stage-desktop.js`, `src/js/motion/screen2.js` and `src/js/motion/home-motion.js`; dynamic chunks loaded on Home only with motion allowed (FD-52) |
| `lenis`                                    | 1.3.27                                                                        | MIT                                                                            | Runtime: smooth wheel scrolling, imported only by `src/js/motion/motion.js` as a dynamic chunk on fine-pointer desktops with motion allowed (FD-52, FD-64); its CSS rules live in `base/_motion.scss`     |
| `@fontsource-variable/bricolage-grotesque` | 5.3.0                                                                         | OFL-1.1 (packaging MIT)                                                        | Source of `src/fonts/bricolage-grotesque-latin-standard-normal.woff2`                                                                                                                                     |
| `@fontsource/jetbrains-mono`               | 5.3.0                                                                         | OFL-1.1 (packaging MIT)                                                        | Source of `src/fonts/jetbrains-mono-latin-400-normal.woff2` and `-500-normal.woff2` (subset, FD-130)                                                                                                      |
| `@popperjs/core`                           | 2.11.8                                                                        | MIT                                                                            | Peer of `bootstrap`, installed automatically; not imported (no dropdowns or tooltips)                                                                                                                     |
| `vite`                                     | 8.3.5 (bundles `rolldown`, MIT; `lightningcss`, MPL-2.0)                      | MIT                                                                            | Build and dev server (dev only)                                                                                                                                                                           |
| `sass`                                     | 1.106.1                                                                       | MIT                                                                            | SCSS compiler (dev only)                                                                                                                                                                                  |
| `marked`                                   | 18.1.1                                                                        | MIT                                                                            | Post bodies, Markdown → HTML at build time (FD-37; dev only, raw HTML escaped)                                                                                                                            |
| `vite-plugin-handlebars`                   | 2.0.3 (pulls `handlebars` 4.7.10, MIT)                                        | MIT                                                                            | Build-time partials (FD-03; dev only)                                                                                                                                                                     |
| `eslint`                                   | 10.13.0                                                                       | MIT                                                                            | Lint (dev only)                                                                                                                                                                                           |
| `@eslint/js`                               | 10.0.1                                                                        | MIT                                                                            | ESLint recommended config (FD-10; dev only)                                                                                                                                                               |
| `globals`                                  | 17.13.0                                                                       | MIT                                                                            | Browser and Node globals for ESLint (FD-10; dev only)                                                                                                                                                     |
| `stylelint`                                | 17.16.0                                                                       | MIT                                                                            | Lint (dev only)                                                                                                                                                                                           |
| `stylelint-config-standard-scss`           | 17.0.0                                                                        | MIT                                                                            | Lint (dev only)                                                                                                                                                                                           |
| `prettier`                                 | 3.9.10                                                                        | MIT                                                                            | Formatting (dev only)                                                                                                                                                                                     |
| `@playwright/test`                         | 1.64.1                                                                        | Apache-2.0                                                                     | Tests (dev only)                                                                                                                                                                                          |
| `@axe-core/playwright`                     | 4.14.0 (pulls `axe-core` 4.14.0, MPL-2.0)                                     | MPL-2.0                                                                        | Accessibility tests (dev only)                                                                                                                                                                            |
| `html-validate`                            | 11.16.2 (pulls `@sidvind/better-ajv-errors` 7.0.0, Apache-2.0; `semver`, ISC) | MIT                                                                            | Validation of the built HTML, `npm run validate:html` (FD-126; dev only)                                                                                                                                  |
| `@lhci/cli`                                | 0.15.1 (pulls `lighthouse` 12.6.1, Apache-2.0)                                | Apache-2.0                                                                     | Lighthouse budgets on the built site, `npm run lhci` and the CI `lighthouse` job (FD-129; dev only)                                                                                                       |
| `subset-font`                              | 2.9.0 (pulls `harfbuzzjs` 1.6.4, MIT; `fontverter` 2.0.0, BSD-3-Clause)       | BSD-3-Clause                                                                   | One-time font subsetting, `tools/subset-fonts.mjs` (FD-130; dev only)                                                                                                                                     |

### Licence register — vendored assets

| Asset                                                       | Source                                                                                                        | Licence / terms                                                                                                                                                            | Where used                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/fonts/bricolage-grotesque-latin-standard-normal.woff2` | `@fontsource-variable/bricolage-grotesque` 5.3.0, subset (FD-130), upstream github.com/ateliertriay/bricolage | SIL OFL 1.1, text in `src/fonts/LICENSE-bricolage-grotesque.txt`                                                                                                           | Display and text face, every page                                                |
| `src/fonts/jetbrains-mono-latin-400-normal.woff2`           | `@fontsource/jetbrains-mono` 5.3.0, subset (FD-130), upstream github.com/JetBrains/JetBrainsMono              | SIL OFL 1.1, text in `src/fonts/LICENSE-jetbrains-mono.txt`                                                                                                                | Mono labels, every page                                                          |
| `src/fonts/jetbrains-mono-latin-500-normal.woff2`           | `@fontsource/jetbrains-mono` 5.3.0, subset (FD-130), upstream github.com/JetBrains/JetBrainsMono              | SIL OFL 1.1, text in `src/fonts/LICENSE-jetbrains-mono.txt`                                                                                                                | Mono at weight 500 and above (header theme label, mono headings)                 |
| LinkedIn "in" logo (monochrome)                             | Path data of Simple Icons 13.21.0 (`icons/linkedin.svg`), CC0-1.0; inlined                                    | Trademark of LinkedIn Corporation; used unaltered, single colour (`currentColor`), only to link to Rasel Al Mamun's LinkedIn profile, as LinkedIn's brand guidelines allow | `src/partials/icons/footer-icon.hbs` (footer, Portfolio, Contact)                |
| GitHub mark (Invertocat, monochrome)                        | Path data of Simple Icons 13.21.0 (`icons/github.svg`), CC0-1.0; inlined                                      | Trademark of GitHub, Inc.; used unaltered, single colour (`currentColor`), only to link to Rasel Al Mamun's GitHub profile, as GitHub's logo guidelines allow              | `src/partials/icons/footer-icon.hbs` (footer, Portfolio, Contact)                |
| ORCID iD icon (monochrome)                                  | Path data of Simple Icons (`icons/orcid.svg`), CC0-1.0; inlined                                               | Trademark of ORCID, Inc.; used unaltered, single colour (`currentColor`), only to link to Rasel Al Mamun's ORCID record, as ORCID's iD brand guidelines allow              | `src/partials/icons/pf-icon.hbs` (Portfolio profile links)                       |
| In-house line icons and illustrations                       | Drawn for this project                                                                                        | MIT, as the code                                                                                                                                                           | `src/partials/icons/*.hbs`, `src/images/arrow.svg`, `src/images/placeholder.svg` |
| Photographs and portrait cut-outs                           | Rasel Al Mamun                                                                                                | © Rasel Al Mamun, all rights reserved; published on the site, not licensed for reuse                                                                                       | `src/images/avatar/`, `src/images/figure/`                                       |

The footer's other icons (mail, Portfolio, Blog, Hire me, Contact, Scholar, Scopus,
ResearchGate) are in-house line icons; no other third-party logo is used.

## Public repository hygiene

- Never commit `.env*`, keys, tokens, personal phone numbers, private documents or files
  from outside this repository. `.gitignore` covers the common cases and CI rejects tracked
  `.env` files, `node_modules/` and `dist/`.
- The photographs are published intentionally (they appear on the site); they are not
  licensed for reuse (see README).
- The CV PDF is added only once its content is confirmed public.
- GitHub secret scanning and push protection are turned on in the repository settings
  (`docs/setup.md`).

## Forms

Static forms in this repository post nowhere (`action` is the future Django URL). CSRF
tokens, server-side validation and spam protection are added in the Django mount.
