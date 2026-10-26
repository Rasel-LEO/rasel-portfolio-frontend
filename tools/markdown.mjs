// Author: Rasel Al Mamun
// Post bodies (FD-37): Markdown → HTML at build time with `marked` (a dev dependency; nothing
// ships to the browser). Raw HTML is escaped, headings get ids, external links open
// in a new tab (FD-76), code blocks scroll inside the measure, and a paragraph that is only
// "[Figure: …]" becomes the labelled media placeholder (FD-29) until a real image exists.
// Tables scroll inside the measure; links are limited to http(s), mailto and relative URLs.
import { Marked } from 'marked';

export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

export const isBracketed = (value) =>
  typeof value === 'string' && value.trimStart().startsWith('[');

const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z0-9#]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';

const FIGURE = /^\[Figure: .+\]$/;
const NEW_TAB =
  '<span class="visually-hidden"> (opens in a new tab)</span><svg class="icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M7 17L17 7M9 7h8v8" /></svg>';
// A whole paragraph in [brackets] (placeholder copy), not one that opens with a [link](…).
const PLACEHOLDER = /^\[[^\]]*\]$/;
// http(s), mailto, and relative or same-page URLs; anything else fails the build.
const SAFE_URL = /^(?:https?:|mailto:|[/#.]|[\w-]+(?:[/?#.]|$))/i;

// One Marked instance per post, so heading ids are unique within that post.
function markdown() {
  const ids = new Map();
  const uniqueId = (text) => {
    const base = slugify(text);
    const n = ids.get(base) ?? 0;
    ids.set(base, n + 1);
    return n ? `${base}-${n + 1}` : base;
  };

  return new Marked({
    gfm: true,
    renderer: {
      // Raw HTML (block or inline) is shown as text, never rendered.
      html({ text }) {
        return escapeHtml(text);
      },
      heading({ tokens, depth, text }) {
        // The page <h1> is the post title; body headings start at h2.
        const level = Math.min(Math.max(depth, 2), 6);
        return `<h${level} id="${uniqueId(text)}">${this.parser.parseInline(tokens)}</h${level}>\n`;
      },
      link({ href, title, tokens }) {
        if (!SAFE_URL.test(href)) throw new Error(`Link scheme not allowed in a post: ${href}`);
        const external = /^https?:\/\//i.test(href);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        const text = this.parser.parseInline(tokens);
        // FD-76: another site opens in a new tab, with ↗ and a hidden "(opens in a new tab)".
        if (external) {
          return `<a href="${escapeHtml(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}${NEW_TAB}</a>`;
        }
        return `<a href="${escapeHtml(href)}"${titleAttr}>${text}</a>`;
      },
      code({ text, lang }) {
        const name = lang ? `Code sample (${escapeHtml(lang)})` : 'Code sample';
        // Focusable so a keyboard user can scroll a long line (axe scrollable-region-focusable),
        // and a named region so that tab stop is announced as something.
        return `<pre class="prose-code" tabindex="0" role="region" aria-label="${name}"><code>${escapeHtml(text)}</code></pre>\n`;
      },
      paragraph({ tokens, text }) {
        const trimmed = text.trim();
        if (FIGURE.test(trimmed)) {
          // Labelled media placeholder (FD-29), styled by .media-ph in the components stylesheet.
          return `<figure class="media-ph media-ph-3x2"><figcaption class="media-ph-caption">${escapeHtml(trimmed)}</figcaption></figure>\n`;
        }
        const plain = tokens.every((token) => token.type === 'text' || token.type === 'escape');
        const placeholder = plain && PLACEHOLDER.test(trimmed) ? ' class="is-placeholder"' : '';
        return `<p${placeholder}>${this.parser.parseInline(tokens)}</p>\n`;
      },
      image() {
        // Images need WebP + AVIF, alt and intrinsic size; not supported until post images
        // are supplied.
        throw new Error('Markdown images are not supported yet; use a "[Figure: …]" line.');
      },
    },
    hooks: {
      // Wide tables scroll inside the measure, never the page (same rule as code blocks).
      postprocess(html) {
        return html
          .replace(
            /<table>/g,
            '<div class="prose-table" tabindex="0" role="region" aria-label="Table"><table>',
          )
          .replace(/<\/table>/g, '</table></div>');
      },
    },
  });
}

export function renderMarkdown(source) {
  return markdown().parse(source);
}

// Words in the Markdown source (markup stripped), at 200 words per minute, at least 1.
export function readingMinutes(source) {
  const words = source
    .replace(/```[^\n]*\n/g, ' ')
    .replace(/[#>*_`~|[\]()-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
