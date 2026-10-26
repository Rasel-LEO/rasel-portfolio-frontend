# Post bodies (FD-37)

One Markdown file per post, named after its `slug` in `src/content/blog.json`. Only the
body lives here; the title, category, status, date and **standfirst** are fields in
`blog.json` (the standfirst also feeds the Blog list and the meta description).

Rules the build applies (`tools/markdown.mjs`):

- Start body headings at `##`; the page `<h1>` is the post title (a `#` becomes `h2`).
- Raw HTML is shown as text, not rendered; HTML comments (`<!-- … -->`) are visible too,
  so keep notes out of these files.
- Code blocks (` ```lang `) and tables scroll sideways inside the text column.
- Links may use `https://`, `http://`, `mailto:` or a site path; anything else fails the build.
- Images are not supported yet (they need WebP + AVIF and a size). Write a line
  `[Figure: what the image shows]` to keep the slot; it renders as a labelled placeholder.
- A paragraph that is entirely in `[brackets]` is styled as placeholder copy.

Publishing a post: set `"status": "published"` and a `"date"` (`YYYY-MM-DD`) and write the
standfirst; `validate-content` refuses a published post without them.
