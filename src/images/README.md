# Images

The owner's approved portrait files, copied from the approved design with their image data
unchanged, plus two small in-house SVGs. Vite hashes them at build time. The owner's photographs are
published intentionally but are not licensed for reuse (see `LICENSE`).

The P5 and P6 figure poses are AI-generated from the owner's own photographs; the avatar is a
real photograph. The site says so in the footer of every page (FD-141): any descriptive alt
text for P5 / P6 must end with "(AI-generated from my own photo)", and decorative uses keep
`alt=""`.

Release 1.4.0 removed the embedded C2PA provenance block from every AVIF and WebP here
(FD-139): the image data is byte-identical, and `tests/release.spec.js` keeps every shipped
image free of such metadata.

| File                                     | Source                                                                         | Used in                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `avatar/avatar-96.{avif,webp}`           | portrait cut-out, approved 2026-10-21                                          | post author card (56 px); the header mark until 1.3.1, replaced by the Ideatrium logo (FD-139)       |
| `avatar/avatar-512.{avif,webp}`          | the same cut-out                                                               | Portfolio profile avatar (Open Graph / Twitter image until 1.3.1; now the share image, FD-139)       |
| `figure/P5-desktop-720x1300.{avif,webp}` | thinking pose (AI-generated from the owner's photo), approved 2026-10-24       | Home hero figure at every width (LCP; on phones the whole figure, FD-86); back-to-top button (FD-05) |
| `figure/P6-desktop-720x1300.{avif,webp}` | relaxed seated pose (AI-generated from the owner's photo), approved 2026-10-24 | 404 page; Home Contact band from 768 px                                                              |
| `placeholder.svg`                        | in-house (FD-29)                                                               | hatch tile used as a CSS mask behind the `[Photo: …]` media placeholders                             |
| `arrow.svg`                              | in-house                                                                       | the arrow between the Hire me process steps (CSS mask)                                               |

The figure frames stay 720 px wide until a larger original photograph exists (FD-130).
