# Fonts — provenance

Self-hosted woff2, no runtime font service. Each file is the `@fontsource` latin file subset
to the characters the site uses (FD-130) with `tools/subset-fonts.mjs` (`subset-font`, run
once; output committed). Variation axes, OpenType features and metrics are unchanged.
`subset.json` lists the kept characters as code points.

| File                                              | Family                                                          | Source package                                    | Upstream                                   | Licence                                         |
| ------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------ | ----------------------------------------------- |
| `bricolage-grotesque-latin-standard-normal.woff2` | Bricolage Grotesque, variable (wght 200–800, wdth 75–100, opsz) | `@fontsource-variable/bricolage-grotesque` 5.3.0 | https://github.com/ateliertriay/bricolage | SIL OFL 1.1, `LICENSE-bricolage-grotesque.txt` |
| `jetbrains-mono-latin-400-normal.woff2`           | JetBrains Mono Regular                                          | `@fontsource/jetbrains-mono` 5.3.0                | https://github.com/JetBrains/JetBrainsMono | SIL OFL 1.1, `LICENSE-jetbrains-mono.txt`       |
| `jetbrains-mono-latin-500-normal.woff2`           | JetBrains Mono Medium                                           | `@fontsource/jetbrains-mono` 5.3.0                | https://github.com/JetBrains/JetBrainsMono | SIL OFL 1.1, `LICENSE-jetbrains-mono.txt`       |

| File                    | Latin file | Subset   |
| ----------------------- | ---------- | -------- |
| Bricolage Grotesque     | 131.5 KB   | 99.6 KB  |
| JetBrains Mono Regular  | 21.2 KB    | 17.0 KB  |
| JetBrains Mono Medium   | 21.8 KB    | 17.6 KB  |
| Total (budget 160 KB)   | 174.5 KB   | 134.3 KB |

The subset keeps printable ASCII, common Latin-1 symbols, typographic punctuation, arrows and
every character of the built pages, content and scripts. Text with a new character (an
accented name, for example) still renders, in the metric-matched fallback for that character;
`npm test` fails until the subset is regenerated:

```powershell
npm run build; node tools/subset-fonts.mjs
```
