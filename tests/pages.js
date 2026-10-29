// Author: Rasel Al Mamun
import { readdirSync, readFileSync } from 'node:fs';

// The ten template pages of docs/architecture.md (src/pages/), as served from dist/.
const allTemplatePages = [
  'index.html',
  'portfolio.html',
  'publications.html',
  'research.html',
  'portfolio-entry.html',
  'blog.html',
  'blog-post.html',
  'hire.html',
  'contact.html',
  '404.html',
];

// The test target (FD-137): the static build served by `vite preview` (default), or a running
// Django site (TEST_TARGET=django with DJANGO_BASE_URL; playwright.config.js starts no server then).
export const isDjango = process.env.TEST_TARGET === 'django';

// Where the built assets are served: the site root, or Django's static URL (FD-133).
export const staticBase = isDjango ? '/static/frontend' : '';

// The build whose files the tests read from disk (sizes, hashes): the one the target serves.
export const buildDir = isDjango ? 'dist-django' : 'dist';

// Django URL of each page type (FD-137); the same table as the Django parity test.
const djangoPaths = {
  'index.html': '/',
  'portfolio.html': '/portfolio/',
  'publications.html': '/portfolio/publications/',
  'research.html': '/portfolio/research/',
  'blog.html': '/blog/',
  'hire.html': '/hire/',
  'contact.html': '/contact/',
  // Any unknown path answers with the 404 page.
  '404.html': '/no-such-page/',
};

// The template pages the target serves: all ten, or the eight that have a Django URL.
export const templatePages = isDjango
  ? allTemplatePages.filter((file) => file in djangoPaths)
  : allTemplatePages;

// The path of a page file on the current target: `/<file>` for the static build, its Django URL
// otherwise. A query or hash after the file name is kept. The two template pages have no Django
// URL (Django renders the project and post pages from its own data).
export function pagePath(file) {
  if (!isDjango) return `/${file}`;
  const [, name, rest = ''] = /^([^?#]+)([?#].*)?$/.exec(file);
  let path = djangoPaths[name];
  if (name.startsWith('project-')) path = `/portfolio/${name.slice(8, -5)}/`;
  if (name.startsWith('post-')) path = `/blog/${name.slice(5, -5)}/`;
  if (!path) throw new Error(`${name} has no Django URL (FD-137)`);
  return path + rest;
}

// The same for a relative URL given to page.goto(): `/<file>` becomes the target's path; the
// site root and anything already a Django path stay as they are.
export const pageUrl = (url) =>
  isDjango && /^\/[^/?#]+\.html(?:[?#]|$)/.test(url) ? pagePath(url.slice(1)) : url;

// Every page of the site. Static: the files in dist/ (the templates plus the generated
// project-<id>.html and post-<slug>.html pages; `npm test` builds first, `npm run test:widths`
// expects a build too). Django: a fixed list, not dist/ — the templates with a Django URL,
// one page per project in src/content/projects.json, and no post page: the posts are drafts and
// Django does not publish drafts (FD-137).
export const pages = isDjango
  ? [
      ...templatePages,
      ...JSON.parse(readFileSync('src/content/projects.json', 'utf8')).map(
        (project) => `project-${project.id}.html`,
      ),
    ].sort()
  : readdirSync('dist')
      .filter((file) => file.endsWith('.html'))
      .sort();

export const projectPages = pages.filter((file) => file.startsWith('project-'));

export const postPages = pages.filter((file) => file.startsWith('post-'));

// A publication's venue line as pages show it (FD-109): display_details, when given (it may be
// empty: venue only), replaces details.
export const venueLine = (pub, separator) => {
  const details = pub.display_details ?? pub.details;
  return details ? `${pub.venue}${separator}${details}` : pub.venue;
};

// The seven test widths of the responsive matrix.
export const widths = [320, 390, 768, 1024, 1280, 1440, 1920];

export const themes = ['dark', 'light'];

// Store a theme choice before any page script runs, as a returning visitor would have it.
export async function useTheme(page, theme) {
  await page.addInitScript((value) => localStorage.setItem('theme', value), theme);
}

// Opaque pixels of the original portraits (720 × 1300): P5 (hero, back-to-top) and P6
// (Contact band).
const OPAQUE = {
  P5: { left: 0, right: 480, top: 395, bottom: 1274 },
  P6: { left: 20, right: 511, top: 395, bottom: 1273 },
};

// A phone portrait (FD-86, FD-93): its window (the picture), the image, and where the figure's
// opaque pixels are, all as seen (transforms included).
export async function phonePortrait(page, selector = '[data-stage-figure]', pose = 'P5') {
  return page.locator(selector).evaluate((figure, opaque) => {
    const window = figure.querySelector('picture').getBoundingClientRect().toJSON();
    const imgEl = figure.querySelector('img');
    const img = imgEl.getBoundingClientRect().toJSON();
    const x = (v) => img.left + (v / 720) * img.width;
    const y = (v) => img.top + (v / 1300) * img.height;
    const content = {
      left: x(opaque.left),
      right: x(opaque.right),
      top: y(opaque.top),
      bottom: y(opaque.bottom),
    };
    return { src: imgEl.currentSrc, window, img, content };
  }, OPAQUE[pose]);
}

// The load entrance (FD-67: Home's hero, other pages' main) and the arrival seam wipe (FD-81)
// have finished.
export async function entranceDone(page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => /^(enter|page-wipe)-/.test(animation.animationName ?? ''))
        .map((animation) => animation.finished.catch(() => null)),
    ),
  );
}

// Scroll through the page and back so every reveal has run, then wait until none
// is hidden or half-way and the entrance is over: screenshots and axe then see the whole page
// as a visitor would.
export async function revealAll(page) {
  await entranceDone(page);
  await page.evaluate(async () => {
    const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const step = Math.max(200, window.innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'instant' });
      await frame();
      await frame();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForFunction(() => !document.querySelector('.reveal, .stage-reveal.is-pre'));
  // Home screen 2 (FD-85): its entrance has finished; below 992 px it has played.
  await page.waitForFunction(
    () =>
      !document.querySelector(
        document.querySelector('[data-stage-mode="mobile"]')
          ? '[data-screen2]:not([data-screen2="shown"])'
          : '[data-screen2="playing"], [data-screen2="leaving"]',
      ),
  );
  // Back at the top, the Home stage's scrub smoothing (0.8 s, FD-69) catches up.
  if (await page.locator('[data-stage].is-staged').count()) await page.waitForTimeout(1000);
}

// A pattern for a URL that ends with the page's path on the current target.
export const pageEnd = (file) =>
  new RegExp(`${[...pagePath(file)].map((c) => (/\w/.test(c) ? c : `\\${c}`)).join('')}$`);
