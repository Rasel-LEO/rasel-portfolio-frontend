// Author: Rasel Al Mamun
import { readdirSync } from 'node:fs';

// The ten template pages of docs/architecture.md (src/pages/), as served from dist/.
export const templatePages = [
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

// Every page in dist/: the templates plus the generated project-<id>.html and
// post-<slug>.html pages.
// `npm test` builds first; `npm run test:widths` expects a build too.
export const pages = readdirSync('dist')
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
