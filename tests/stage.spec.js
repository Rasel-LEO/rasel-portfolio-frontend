// Author: Rasel Al Mamun
// Home stage motion: the pinned desktop stage against the motion map,
// stage accessibility (FD-53), the back-to-top hand-off (FD-54), the mobile variant, reduced
// motion and clean reverts. Production build (npm test builds first).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { entranceDone, phonePortrait, themes, useTheme } from './pages.js';

const shots = 'tests/screenshots/stage';

// Scroll so the stage is at progress p and let ScrollTrigger render the frame; the scrub's
// 0.8 s smoothing (FD-69) has caught up after SETTLE ms.
const SETTLE = 950;
async function goTo(page, p) {
  await page.evaluate(async (p) => {
    const stage = document.querySelector('[data-stage]');
    const stickyTop = parseFloat(getComputedStyle(stage.firstElementChild).top);
    const top = stage.getBoundingClientRect().top + window.scrollY;
    const start = top - stickyTop;
    const end = top + stage.offsetHeight - window.innerHeight;
    window.scrollTo({ top: start + p * (end - start), behavior: 'instant' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, p);
  await page.waitForTimeout(SETTLE);
}

async function rectsOf(page, selector) {
  return page
    .locator(selector)
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
}

async function openStage(page, { width, height }) {
  await page.setViewportSize({ width, height });
  await page.goto('/index.html');
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
  await page.evaluate(() => document.fonts.ready);
}

// Opacity as the eye sees it: the product of the element's and its ancestors' opacities.
const effectiveOpacity = (el) => {
  let value = 1;
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    value *= parseFloat(getComputedStyle(node).opacity);
  }
  return value;
};

// GSAP writes translate3d(x, y, z) first; the matrix mixes z with the face origin.
const translateZ = (transform) =>
  parseFloat(/translate3d\([^,]+,[^,]+,\s*([-\d.]+)px/.exec(transform)?.[1] ?? '0');

// The focused element: opaque as seen, inside the viewport and below the sticky header.
const focusState = `(() => {
  const effectiveOpacity = ${effectiveOpacity};
  const el = document.activeElement;
  const r = el.getBoundingClientRect();
  const header = document.querySelector('.site-header').getBoundingClientRect().bottom;
  // The skip link shows over the header while focused.
  const inHeader = !!el.closest('.site-header') || el.matches('.skip-link');
  return {
    name: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40),
    inStage: !!el.closest('[data-stage]'),
    afterStage: !!el.closest('[data-home]'),
    beforeStage: inHeader || el.matches('.skip-link'),
    opacity: effectiveOpacity(el),
    inView: r.width > 0 && r.top >= (inHeader ? 0 : header - 1) && r.bottom <= window.innerHeight &&
      r.left >= 0 && r.right <= document.documentElement.clientWidth,
  };
})()`;

async function readStage(page) {
  const state = await page.evaluate(`(() => {
    const effectiveOpacity = ${effectiveOpacity};
    const $ = (s) => document.querySelector(s);
    const m = new DOMMatrix(getComputedStyle($('[data-stage-figure] picture')).transform);
    const flat = (el) => {
      const t = getComputedStyle(el).transform;
      if (t === 'none') return true;
      // Flat: no rotation or offset left (the column keeps its own perspective).
      const c = new DOMMatrix(t);
      return Math.abs(c.m11 - 1) < 1e-3 && Math.abs(c.m13) < 1e-3 && Math.abs(c.m41) < 0.5;
    };
    const cols = [...document.querySelectorAll('[data-fork-col]')];
    return {
      rotateY: (Math.atan2(-m.m13, m.m11) * 180) / Math.PI,
      scale: m.m22,
      plane: $('[data-stage-figure] picture').style.transform,
      hero: effectiveOpacity($('[data-stage-hero]')),
      statement: effectiveOpacity($('.screen2-headline')),
      forkTitle: effectiveOpacity($('.fork-title')),
      cols: cols.map(effectiveOpacity),
      colsFlat: cols.every(flat),
      figure: $('[data-stage-figure]').getBoundingClientRect().toJSON(),
      figureRest: { w: $('[data-stage-figure]').offsetWidth, h: $('[data-stage-figure]').offsetHeight },
      // Hidden at the hand-off (FD-97: visibility, swapped in one frame with the button).
      figureOpacity:
        getComputedStyle($('[data-stage-figure]')).visibility === 'hidden'
          ? 0
          : parseFloat(getComputedStyle($('[data-stage-figure]')).opacity),
      clientWidth: document.documentElement.clientWidth,
      innerHeight: window.innerHeight,
      button: {
        hidden: $('[data-back-to-top]').hidden,
        photo: $('[data-back-to-top] img').getBoundingClientRect().toJSON(),
      },
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  return { ...state, z: translateZ(state.plane) };
}

const viewports = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
];

test.describe('Home stage, desktop (≥ 992 px)', () => {
  for (const viewport of viewports) {
    const { width, height } = viewport;

    test(`motion map at 0/20/40/65/72/100 % (${width}×${height})`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await openStage(page, viewport);

      await goTo(page, 0);
      let s = await readStage(page);
      expect(Math.abs(s.rotateY)).toBeLessThan(0.05);
      expect(s.scale).toBeCloseTo(1, 3);
      expect(s.z).toBeCloseTo(0, 1);
      expect(s.hero).toBe(1);
      expect(s.statement).toBe(0);
      expect(s.forkTitle).toBe(0);
      expect(s.cols).toEqual([0, 0]);
      await expect(page.locator('.stage-cue')).toBeVisible();
      await expect(page.locator('.stage-cue')).toHaveAttribute('aria-hidden', 'true');

      await goTo(page, 0.2);
      s = await readStage(page);
      expect(s.rotateY).toBeLessThan(-0.5);
      expect(s.rotateY).toBeGreaterThan(-9);
      expect(s.scale).toBeGreaterThan(1);
      expect(s.scale).toBeLessThan(1.1);
      // Clean hand-over: the name is gone (8–16 %); screen 2 is playing (FD-85).
      expect(s.hero).toBeLessThanOrEqual(0.05);
      expect(s.statement).toBeGreaterThan(0);
      expect(await page.locator('.stage-cue').evaluate((el) => getComputedStyle(el).opacity)).toBe(
        '0',
      );

      await goTo(page, 0.4);
      s = await readStage(page);
      expect(s.rotateY).toBeCloseTo(-9, 1);
      expect(s.scale).toBeCloseTo(1.1, 3);
      expect(s.z).toBeCloseTo(40, 1);
      expect(s.hero).toBe(0);
      expect(s.statement).toBe(1);
      expect(s.forkTitle).toBe(0);

      // From 65 % (FD-97, FD-98): the figure is the back-to-top photo — 140 px tall,
      // lower-right corner on the button's (24 px insets) — and has handed over to it; screen
      // 2 still stands, the Fork is about to come in.
      // (A hair past 65 %: the scroll position is whole pixels.)
      await goTo(page, 0.652);
      s = await readStage(page);
      expect(Math.abs(s.rotateY)).toBeLessThan(0.05);
      expect(s.scale).toBeCloseTo(1, 3);
      expect(Math.abs(s.figure.height - 140)).toBeLessThan(2);
      expect(Math.abs(s.figure.right - (s.clientWidth - 24))).toBeLessThan(2);
      expect(Math.abs(s.figure.bottom - (s.innerHeight - 24))).toBeLessThan(2);
      expect(s.figureOpacity).toBe(0);
      expect(s.statement).toBe(1);

      // 72 %: screen 2 gone, the Fork seen, its columns still turning in.
      await goTo(page, 0.72);
      s = await readStage(page);
      expect(s.statement).toBe(0);
      expect(s.forkTitle).toBeGreaterThan(0.95);
      for (const col of s.cols) expect(col).toBeGreaterThan(0.95);
      expect(s.colsFlat).toBe(false);

      await goTo(page, 1);
      s = await readStage(page);
      expect(s.figureOpacity).toBe(0);
      expect(s.hero).toBe(0);
      expect(s.forkTitle).toBe(1);
      expect(s.cols).toEqual([1, 1]);
      expect(s.colsFlat).toBe(true);
      expect(s.button.hidden).toBe(false);
      await expect(page.locator('[data-back-to-top]')).toHaveCSS('opacity', '0.7');
      // The same image at the same size and place (FD-54).
      s = await readStage(page);
      for (const key of ['left', 'top', 'right', 'bottom']) {
        expect(Math.abs(s.figure[key] - s.button.photo[key]), key).toBeLessThan(2);
      }
      expect(errors).toEqual([]);
    });

    for (const theme of themes) {
      test(`screenshots at 0/25/50/75/100 % (${width}, ${theme})`, async ({ page }) => {
        await useTheme(page, theme);
        await openStage(page, viewport);
        for (const p of [0, 25, 50, 75, 100]) {
          await goTo(page, p / 100);
          // Let the back-to-top fade (--d-slow) settle for the 70/100 % frames.
          await page.waitForTimeout(400);
          await page.screenshot({ path: `${shots}/stage-${width}-${p}-${theme}.png` });
        }
      });
    }

    for (const key of ['Tab', 'Shift+Tab']) {
      test(`keyboard ${key}: every focused element is opaque and on screen (${width}×${height})`, async ({
        page,
      }) => {
        await openStage(page, viewport);
        // Backwards: start on the Hire band's first link, below the stage.
        if (key === 'Shift+Tab') {
          await page.locator('[data-home="hire"] a').first().focus();
          await page.waitForTimeout(100);
        }
        const seen = [];
        for (let i = 0; i < 40; i += 1) {
          await page.keyboard.press(key);
          const state = await page.evaluate(focusState);
          if (key === 'Tab' ? state.afterStage : state.beforeStage) break;
          seen.push(state);
          expect(state.opacity, state.name).toBeGreaterThan(0.999);
          expect(state.inView, state.name).toBe(true);
        }
        // Hero CTAs (3), the two pillars, the two Fork CTAs; the six areas are text (FD-87).
        expect(seen.filter((state) => state.inStage).length).toBe(7);
      });
    }

    // The web-font swap shifts text on every page. With system fonts only (the
    // font tokens overridden, the files blocked) nothing swaps, so any shift left in the
    // stage would come from the stage modules.
    for (const fonts of [true, false]) {
      test(`layout shift ${fonts ? '≤ 0.05 page' : '0 from the stage'} (${width}×${height})`, async ({
        page,
      }) => {
        if (!fonts) {
          await page.route('**/*.woff2', (route) => route.abort());
          await page.addInitScript(() => {
            const style = document.createElement('style');
            style.textContent = ':root { --font-sans: Arial, sans-serif; --font-mono: monospace; }';
            document.documentElement.append(style);
          });
        }
        await page.addInitScript(() => {
          window.__shifts = [];
          // When the desktop stage starts to change the document (first .is-staged).
          window.__stagedAt = null;
          new MutationObserver((records, observer) => {
            if (records.some((record) => record.target.classList?.contains('is-staged'))) {
              window.__stagedAt = performance.now();
              observer.disconnect();
            }
          }).observe(document, { attributes: true, attributeFilter: ['class'], subtree: true });
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (entry.hadRecentInput) continue;
              window.__shifts.push({
                value: entry.value,
                stage: entry.sources.some((source) => {
                  const node =
                    source.node?.nodeType === 3 ? source.node.parentElement : source.node;
                  return Boolean(node?.closest?.('[data-stage]'));
                }),
                // Shown when the assertion fails: what moved, from where to where.
                sources: entry.sources.map((source) => {
                  const node =
                    source.node?.nodeType === 3 ? source.node.parentElement : source.node;
                  const box = (r) => [r.x, r.y, r.width, r.height].map(Math.round).join(',');
                  return `${node?.getAttribute?.('class') ?? node?.nodeName} ${box(source.previousRect)} → ${box(source.currentRect)}`;
                }),
                time: Math.round(entry.startTime),
              });
            }
          }).observe({ type: 'layout-shift', buffered: true });
        });
        await page.setViewportSize({ width, height });
        await page.goto('/index.html');
        await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
        await page.waitForTimeout(500);
        const { shifts, stagedAt } = await page.evaluate(() => ({
          shifts: window.__shifts,
          stagedAt: window.__stagedAt,
        }));
        const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
        if (fonts) expect(total).toBeLessThanOrEqual(0.05);
        else {
          // No shift of stage content at all, before or after the stage module builds (the
          // stage's top space sits on the pinned container, so pinning moves nothing).
          expect(stagedAt).not.toBeNull();
          const fromStage = shifts.filter((shift) => shift.stage);
          expect(fromStage, `stage built at ${Math.round(stagedAt)} ms`).toEqual([]);
        }
      });
    }
  }

  test('staged, the Fork keeps the full container width (FD-47)', async ({ page }) => {
    await openStage(page, { width: 1440, height: 900 });
    await goTo(page, 1);
    const [fork, services] = await page.evaluate(() =>
      ['.fork-row > :last-child .fork-card', '.home-services > :last-child .service'].map(
        (selector) => document.querySelector(selector).getBoundingClientRect().right,
      ),
    );
    expect(Math.abs(fork - services)).toBeLessThanOrEqual(1);
  });

  for (const width of [1024, 1280, 1440, 1920]) {
    test(`no horizontal overflow through the stage at ${width}px`, async ({ page }) => {
      await openStage(page, { width, height: 900 });
      for (const p of [0, 0.3, 0.6, 0.62, 0.65, 0.8, 1]) {
        await goTo(page, p);
        expect((await readStage(page)).overflow, `at ${p}`).toBeLessThanOrEqual(0);
        // The opening Fork columns stay inside the window (full-width Fork, FD-57).
        const edges = await page
          .locator('[data-fork-col]')
          .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect()))
          .then((rects) => rects.map((r) => ({ left: r.left, right: r.right })));
        for (const edge of edges) {
          expect(edge.left, `at ${p}`).toBeGreaterThanOrEqual(0);
          expect(edge.right, `at ${p}`).toBeLessThanOrEqual(width);
        }
      }
    });
  }

  test('pointer tilts the photo on fine pointers and resets on leave', async ({ page }) => {
    await openStage(page, { width: 1440, height: 900 });
    const photo = page.locator('[data-stage-figure] img');
    const rotateY = () =>
      photo.evaluate((el) => {
        const m = new DOMMatrix(getComputedStyle(el).transform);
        return (Math.atan2(-m.m13, m.m11) * 180) / Math.PI;
      });
    await page.mouse.move(1430, 450);
    await expect.poll(rotateY).toBeGreaterThan(5);
    await page.mouse.move(10, 450);
    await expect.poll(rotateY).toBeLessThan(-5);
    // Leave the frame (over the header).
    await page.mouse.move(700, 20);
    await expect.poll(async () => Math.abs(await rotateY())).toBeLessThan(0.1);
  });

  test('resize across 992px and reduced motion revert cleanly', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
    await openStage(page, { width: 1440, height: 900 });
    // Tilt the hero with the pointer first (B4), then scroll on.
    await page.mouse.move(1300, 800);
    await page.mouse.move(1350, 850);
    await page.waitForTimeout(300);
    await goTo(page, 0.5);

    // Below 992 px screen 2's own entrance (FD-85) may hold it, so that variant skips it.
    const leftovers = (skip = null) =>
      page.evaluate(
        (skip) => ({
          styled: [...document.querySelectorAll('[data-stage], [data-stage] *, [data-back-to-top]')]
            .filter((el) => !skip || !el.closest(skip))
            .filter((el) => /transform|opacity|--btt-handoff/.test(el.getAttribute('style') || ''))
            .map((el) => el.className || el.tagName),
          classes: document.querySelectorAll('.is-staged, .is-active, .is-off, .is-live').length,
          created: document.querySelectorAll('.stage-cue').length,
          sentinel:
            document.querySelector('[data-back-to-top-sentinel]').getAttribute('style') || null,
        }),
        skip,
      );
    const clean = { styled: [], classes: 0, created: 0, sentinel: null };

    await page.setViewportSize({ width: 800, height: 900 });
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'mobile');
    expect(await leftovers('[data-stage-statement]')).toEqual(clean);
    const statement = page.locator('.screen2-headline');
    await statement.scrollIntoViewIfNeeded();
    await expect(statement).toHaveCSS('opacity', '1');

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
    await goTo(page, 0.3);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-stage]')).not.toHaveAttribute('data-stage-mode');
    expect(await leftovers()).toEqual(clean);
    await expect(page.locator('[data-screen2]')).toHaveCount(0);
    await statement.scrollIntoViewIfNeeded();
    await expect(statement).toHaveCSS('opacity', '1');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
    expect(errors).toEqual([]);
  });
});

// Shift and visibility recorder from navigation start (FD-65, FD-66).
const recorder = () => {
  window.__shifts = [];
  window.__seen = [];
  window.__stagedAt = null;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) continue;
      window.__shifts.push({
        value: entry.value,
        time: Math.round(entry.startTime),
        sources: entry.sources.map((source) => {
          const node = source.node?.nodeType === 3 ? source.node.parentElement : source.node;
          return node?.getAttribute?.('class') ?? node?.nodeName;
        }),
      });
    }
  }).observe({ type: 'layout-shift', buffered: true });
  // Every frame until the stage is built: is screen 2 or the Fork visible?
  const visible = (el) => {
    if (!el) return false;
    let value = 1;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      value *= parseFloat(getComputedStyle(node).opacity);
    }
    const r = el.getBoundingClientRect();
    return value > 0.01 && r.bottom > 0 && r.top < innerHeight && r.width > 0;
  };
  const sample = () => {
    const stage = document.querySelector('[data-stage]');
    if (stage) {
      const seen = [
        '.screen2-headline',
        '.screen2-grid li',
        '.fork-title',
        '[data-fork-col]',
      ].filter((selector) => visible(document.querySelector(selector)));
      if (seen.length) window.__seen.push([Math.round(performance.now()), ...seen]);
      if (stage.classList.contains('is-staged')) {
        window.__stagedAt = performance.now();
        return;
      }
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
};

test.describe('Home stage, first paint (FD-66)', () => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    test(`from navigation to the built stage nothing shifts or shows (${viewport.width}×${viewport.height})`, async ({
      page,
    }) => {
      // Slow the stage module down, so the pre-staged CSS is on its own for a while.
      await page.route('**/assets/stage-desktop-*.js', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await route.continue();
      });
      await page.addInitScript(recorder);
      await page.setViewportSize(viewport);
      await page.goto('/index.html');
      await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
      await page.waitForTimeout(300);
      const { shifts, seen, stagedAt } = await page.evaluate(() => ({
        shifts: window.__shifts,
        seen: window.__seen,
        stagedAt: window.__stagedAt,
      }));
      expect(stagedAt).toBeGreaterThan(700);
      expect(seen).toEqual([]);
      expect(shifts).toEqual([]);
    });
  }

  test('fail-safe: without the stage module the static document returns after 4 s', async ({
    page,
    browser,
  }) => {
    await page.route('**/assets/stage-desktop-*.js', (route) => route.abort());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    // Pre-staged at first: the statement layer and the Fork are hidden (no focus, no pointer),
    // the stage is tall.
    await expect(page.locator('[data-stage-statement]')).toHaveCSS('opacity', '0');
    await expect(page.locator('[data-stage-statement]')).toHaveCSS('visibility', 'hidden');
    await expect(page.locator('[data-stage-fork]')).toHaveCSS('visibility', 'hidden');
    // Tab goes from the hero's CTAs straight past the hidden layers, out of the stage.
    await page.locator('.hero-ctas a, .hero-ctas button').last().focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('[data-stage]')))).toBe(
      false,
    );
    expect(await page.locator('[data-stage]').evaluate((el) => el.offsetHeight)).toBeGreaterThan(
      2000,
    );
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(4300);
    const selectors = [
      '[data-stage-figure]',
      'h1',
      '.screen2-headline',
      '.screen2-areas',
      '[data-stage-fork]',
    ];
    const boxes = (target) =>
      target.evaluate(
        (list) =>
          list.map((s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return [
              Math.round(r.x),
              Math.round(r.y + window.scrollY),
              Math.round(r.width),
              Math.round(r.height),
            ];
          }),
        selectors,
      );
    const noJs = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const staticPage = await noJs.newPage();
    await staticPage.goto('/index.html');
    await staticPage.evaluate(() => document.fonts.ready);
    await entranceDone(staticPage);
    await page.evaluate(() => document.fonts.ready);
    expect(await boxes(page)).toEqual(await boxes(staticPage));
    for (const selector of ['[data-stage-statement]', '[data-stage-fork]']) {
      await expect(page.locator(selector)).toHaveCSS('opacity', '1');
      await expect(page.locator(selector)).toHaveCSS('visibility', 'visible');
    }
    await noJs.close();
  });

  test('a window too short for the stage gets the document back (is-unstaged)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 520 });
    await page.goto('/index.html');
    await expect(page.locator('[data-stage]')).toHaveClass(/is-unstaged/);
    await expect(page.locator('.screen2-headline')).toHaveCSS('opacity', '1');
  });
});

// FD-65: metric-matched fallback faces — with the web fonts blocked, the hero name block is
// within 3 % of its height with them; once they load, nothing shifts.
test.describe('fonts (FD-65)', () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`hero name height with and without the web font, CLS ≤ 0.01 (${viewport.width}px)`, async ({
      browser,
    }) => {
      const measure = async (block) => {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        if (block) await page.route('**/*.woff2', (route) => route.abort());
        await page.addInitScript(recorder);
        await page.goto('/index.html');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1000);
        const result = await page.evaluate(() => ({
          height: document.querySelector('.hero-name').getBoundingClientRect().height,
          family: getComputedStyle(document.querySelector('.hero-name')).fontFamily,
          loaded: document.fonts.check('600 50px "Bricolage Grotesque"'),
          cls: window.__shifts.reduce((sum, shift) => sum + shift.value, 0),
          shifts: window.__shifts,
        }));
        await context.close();
        return result;
      };
      const loaded = await measure(false);
      const blocked = await measure(true);
      expect(loaded.loaded).toBe(true);
      expect(blocked.loaded).toBe(false);
      expect(loaded.family).toContain('Bricolage Fallback');
      expect(Math.abs(blocked.height - loaded.height) / loaded.height).toBeLessThan(0.03);
      expect(loaded.cls, JSON.stringify(loaded.shifts)).toBeLessThanOrEqual(0.01);
    });
  }

  test('the header avatar is never lazy, sized, and preloaded', async ({ page }) => {
    await page.goto('/blog.html');
    for (const selector of [
      '.site-header .brand-mark img',
      '#drawer .brand-mark img, #drawer img',
    ]) {
      const img = page.locator(selector).first();
      await expect(img).toHaveAttribute('loading', 'eager');
      await expect(img).toHaveAttribute('width', '28');
      await expect(img).toHaveAttribute('height', '28');
    }
    await expect(page.locator('link[rel="preload"][href*="avatar-96"]')).toHaveCount(1);
  });
});

// FD-70: back-to-top from anywhere on Home never plays the stage backwards.
test.describe('back-to-top on Home (FD-70)', () => {
  // From far below the stage: Selected publications.
  for (const from of ['Selected publications', 'the Fork (p = 1)']) {
    test(`from ${from}: no frame shows screen 2 or the Fork; focus to the brand`, async ({
      page,
    }) => {
      await openStage(page, { width: 1440, height: 900 });
      if (from.startsWith('the Fork')) await goTo(page, 1);
      else {
        await page.evaluate(() =>
          document
            .querySelector('[data-home="publications"]')
            .scrollIntoView({ block: 'start', behavior: 'instant' }),
        );
        await page.waitForTimeout(SETTLE);
      }
      const button = page.locator('[data-back-to-top]');
      await expect(button).toBeVisible();
      await page.waitForTimeout(400);
      await page.evaluate(`(() => {
        const effectiveOpacity = ${effectiveOpacity};
        window.__frames = [];
        const inView = (el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight && r.width > 0;
        };
        const layers = ['.screen2-headline', '.screen2-grid li', '.fork-title', '[data-fork-col]'];
        const sample = () => {
          window.__frames.push({
            y: Math.round(scrollY),
            seen: layers.flatMap((s) => [...document.querySelectorAll(s)])
              .filter((el) => inView(el))
              .map((el) => effectiveOpacity(el)),
          });
          if (window.__frames.length < 90) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      })()`);
      const startY = await page.evaluate(() => Math.round(window.scrollY));
      await button.click();
      await expect.poll(() => page.evaluate(() => window.__frames.length)).toBe(90);
      const frames = await page.evaluate(() => window.__frames);
      // Once the jump has started (the first frame away from the start), nothing of those
      // layers is visible again; at the start the Fork may be (it fades out with the page).
      const moved = frames.findIndex(({ y }) => y !== startY);
      expect(moved).toBeGreaterThan(0);
      expect(frames.slice(moved).filter(({ y }) => y > 0)).toEqual([]);
      for (const { seen } of frames.slice(moved)) {
        for (const value of seen) expect(value).toBeLessThan(0.02);
      }
      // At the top, at p = 0: the hero, shown.
      await expect(page.locator('[data-stage-hero]')).toHaveCSS('opacity', '1');
      await expect(page.locator('[data-brand]')).toBeFocused();
    });
  }

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('jumps at once', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/index.html');
      await page.evaluate(() =>
        document.querySelector('[data-home="publications"]').scrollIntoView({ block: 'start' }),
      );
      const button = page.locator('[data-back-to-top]');
      await expect(button).toBeVisible();
      await button.click();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.locator('html')).not.toHaveClass(/is-jumping/);
      await expect(page.locator('[data-brand]')).toBeFocused();
    });
  });
});

// FD-84: screen 2 stays clear of the photo's box at every progress it is shown, with the
// push-in and the pointer tilt.
test.describe('screen 2 clear of the photo (FD-84)', () => {
  for (const [width, height] of [
    [992, 800],
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ]) {
    test(`at ${width}×${height}`, async ({ page }) => {
      await openStage(page, { width, height });
      // To 64 %: the figure shrinks away while screen 2 still stands (FD-98).
      for (const p of [0.2, 0.26, 0.4, 0.5, 0.6, 0.64]) {
        await goTo(page, p);
        for (const x of [2, width / 2, width - 2]) {
          await page.mouse.move(x, height / 2);
          await page.waitForTimeout(600);
          const gap = await page.evaluate(() => {
            const right = Math.max(
              ...[...document.querySelectorAll('[data-stage-statement] *')].map(
                (el) => el.getBoundingClientRect().right,
              ),
            );
            const photo = document.querySelector('[data-stage-figure] img').getBoundingClientRect();
            return photo.left - right;
          });
          expect(gap, `at ${p}, pointer ${x}`).toBeGreaterThan(0);
        }
      }
    });
  }
});

// FD-83: from 992 px the photo is 8 % larger than its base box and its left edge 32 px (to
// 1280 px wide) … 48 px (from 1440 px) further right. Its visible outline — the opaque pixels'
// left and right ends on every 4th row and top and bottom ends on every 4th column, as probes
// on the image plane, so they follow the push-in, the tilt and the perspective — never leaves
// the pinned frame, and keeps at least the gutter on the right.
const outline = async (page) => {
  await page.evaluate(async () => {
    const img = document.querySelector('[data-stage-figure] img');
    const source = new Image();
    source.src = img.currentSrc;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = source.naturalWidth;
    canvas.height = source.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(source, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
    const opaque = (x, y) => data[(y * width + x) * 4 + 3] > 128;
    const points = [];
    for (let y = 0; y < height; y += 4) {
      const xs = [];
      for (let x = 0; x < width; x++) if (opaque(x, y)) xs.push(x);
      if (xs.length) points.push([xs[0], y], [xs.at(-1), y]);
    }
    for (let x = 0; x < width; x += 4) {
      const ys = [];
      for (let y = 0; y < height; y++) if (opaque(x, y)) ys.push(y);
      if (ys.length) points.push([x, ys[0]], [x, ys.at(-1)]);
    }
    // A layer over the picture that copies the image's own (pointer tilt) transform.
    const layer = document.createElement('div');
    Object.assign(layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
    for (const [x, y] of points) {
      const dot = document.createElement('i');
      Object.assign(dot.style, {
        position: 'absolute',
        left: `${(x / width) * 100}%`,
        top: `${(y / height) * 100}%`,
      });
      layer.append(dot);
    }
    img.parentElement.append(layer);
    window.__outline = layer;
  });
  return () =>
    page.evaluate(() => {
      const layer = window.__outline;
      const img = getComputedStyle(document.querySelector('[data-stage-figure] img'));
      layer.style.transform = img.transform;
      layer.style.transformOrigin = img.transformOrigin;
      const xs = [];
      const ys = [];
      for (const dot of layer.children) {
        const r = dot.getBoundingClientRect();
        xs.push(r.x);
        ys.push(r.y);
      }
      const frame = document.querySelector('[data-stage] > .container').getBoundingClientRect();
      return {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.min(...ys),
        bottom: Math.max(...ys),
        frame: { top: frame.top, bottom: frame.bottom },
        gutter: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gutter')),
        clientWidth: document.documentElement.clientWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
};

// The figure's box, and the base box it grew from (its CSS variables, measured on a probe).
const figureBox = (page) =>
  page.evaluate(() => {
    const figure = document.querySelector('[data-stage-figure]');
    const col = figure.parentElement;
    const probe = document.createElement('div');
    Object.assign(probe.style, { width: 'var(--fig-base-w)', height: 'var(--fig-base-h)' });
    col.append(probe);
    const base = { w: probe.offsetWidth, h: probe.offsetHeight };
    probe.remove();
    const right =
      col.getBoundingClientRect().right - parseFloat(getComputedStyle(col).paddingRight);
    const r = figure.getBoundingClientRect();
    return {
      base,
      w: figure.offsetWidth,
      h: figure.offsetHeight,
      left: r.left,
      top: r.top,
      shift: r.left - (right - base.w),
    };
  });

test.describe('hero photo (FD-83)', () => {
  for (const [width, height, shift] of [
    [1024, 768, 32],
    [1280, 800, 32],
    [1440, 900, 48],
    [1920, 1080, 48],
  ]) {
    test(`8 % larger, ${shift} px right, never clipped, CLS 0 (${width}×${height})`, async ({
      page,
    }) => {
      await page.addInitScript(recorder);
      await openStage(page, { width, height });
      await entranceDone(page);
      // Nothing in the stage shifts from navigation on (the box is sized in CSS).
      const shifts = await page.evaluate(() => window.__shifts);
      expect(shifts.filter(({ sources }) => sources.some((s) => /stage|hero|fig/.test(s)))).toEqual(
        [],
      );
      const box = await figureBox(page);
      expect(Math.abs(box.h - box.base.h * 1.08)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.w - box.base.w * 1.08)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.shift - shift)).toBeLessThanOrEqual(1);
      const read = await outline(page);
      for (const p of [0, 0.1, 0.2, 0.26, 0.4, 0.5, 0.58]) {
        await goTo(page, p);
        for (const [x, y] of [
          [2, height - 2],
          [width / 2, height / 2],
          [width - 2, height - 2],
        ]) {
          await page.mouse.move(x, y);
          await page.waitForTimeout(400);
          const o = await read();
          const at = `at ${p}, pointer ${x},${y}`;
          // Head, hands, chair and shoes inside the frame.
          expect(o.top, at).toBeGreaterThanOrEqual(o.frame.top);
          expect(o.bottom, at).toBeLessThanOrEqual(o.frame.bottom);
          expect(o.left, at).toBeGreaterThanOrEqual(0);
          // At least the page gutter on the right; no horizontal overflow.
          expect(o.right, at).toBeLessThanOrEqual(o.clientWidth - o.gutter);
          expect(o.overflow, at).toBeLessThanOrEqual(0);
        }
      }
    });
  }

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ]) {
    test(`no JS and reduced motion: the same size and place (${viewport.width}×${viewport.height})`, async ({
      browser,
      page,
    }) => {
      await openStage(page, viewport);
      await entranceDone(page);
      const staged = await figureBox(page);
      for (const options of [{ javaScriptEnabled: false }, { reducedMotion: 'reduce' }]) {
        const context = await browser.newContext({ viewport, ...options });
        const other = await context.newPage();
        await other.goto('/index.html');
        await entranceDone(other);
        const box = await figureBox(other);
        for (const key of ['w', 'h', 'left', 'top']) {
          expect(
            Math.abs(box[key] - staged[key]),
            `${Object.keys(options)} ${key}`,
          ).toBeLessThanOrEqual(1);
        }
        const overflow = await other.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        await context.close();
      }
    });
  }

  test('screenshot at 0 % (1920, light)', async ({ page }) => {
    await useTheme(page, 'light');
    await openStage(page, { width: 1920, height: 1080 });
    await entranceDone(page);
    await goTo(page, 0);
    await page.screenshot({ path: `${shots}/stage-1920-0-light.png` });
  });
});

test.describe('Home stage, edge cases', () => {
  test('back-to-top before the hand-off: hidden and no pointer, opaque on keyboard focus', async ({
    page,
  }) => {
    await openStage(page, { width: 1440, height: 900 });
    const button = page.locator('[data-back-to-top]');
    await goTo(page, 0.5);
    await expect(button).toHaveClass(/is-held/);
    await expect(button).toHaveCSS('pointer-events', 'none');
    await expect(button).toHaveCSS('opacity', '0');
    await button.evaluate((el) => el.focus({ focusVisible: true, preventScroll: true }));
    expect(await button.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    await expect(button).toHaveCSS('opacity', '1');
    await button.evaluate((el) => el.blur());
    await goTo(page, 0.97);
    await expect(button).not.toHaveClass(/is-held/);
    await expect(button).toHaveCSS('pointer-events', 'auto');
  });

  test('a mouse press on the Fork never moves the page', async ({ page }) => {
    await openStage(page, { width: 1440, height: 900 });
    const cta = page.locator('[data-fork-col="portfolio"] a');
    for (const p of [0.8, 0.95]) {
      await goTo(page, p);
      const box = await cta.boundingBox();
      const before = await page.evaluate(() => window.scrollY);
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => window.scrollY), `at ${p}`).toBe(before);
      // Release elsewhere so the link does not navigate.
      await page.mouse.move(5, 300);
      await page.mouse.up();
    }
  });

  test('half-shown Fork, hero and screen 2 take no pointer', async ({ page }) => {
    await openStage(page, { width: 1440, height: 900 });
    await goTo(page, 0.8);
    await expect(page.locator('[data-stage-fork]')).toHaveCSS('pointer-events', 'none');
    await expect(page.locator('[data-stage-statement]')).toHaveCSS('pointer-events', 'none');
    await goTo(page, 0.12);
    await expect(page.locator('[data-stage-hero]')).toHaveCSS('pointer-events', 'none');
    await expect(page.locator('[data-stage-statement]')).toHaveCSS('pointer-events', 'none');
    await goTo(page, 0.5);
    await expect(page.locator('[data-stage-statement]')).toHaveCSS('pointer-events', 'auto');
  });

  test('at 1280×720 every layer fits the pinned frame', async ({ page }) => {
    await openStage(page, { width: 1280, height: 720 });
    const header = await page
      .locator('.site-header')
      .evaluate((el) => el.getBoundingClientRect().bottom);
    await goTo(page, 0);
    const ctas = await page.locator('.hero-ctas').boundingBox();
    expect(ctas.y + ctas.height).toBeLessThanOrEqual(720);
    await goTo(page, 1);
    const title = await page.locator('.fork-title').boundingBox();
    expect(title.y).toBeGreaterThanOrEqual(header - 1);
    for (const card of await page.locator('[data-fork-col]').all()) {
      const box = await card.boundingBox();
      expect(box.y + box.height).toBeLessThanOrEqual(720);
    }
  });

  test('in a window too short for the hero the stage stays the document, until it fits', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 520 });
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-stage]')).not.toHaveAttribute('data-stage-mode');
    await expect(page.locator('.is-staged, .stage-cue')).toHaveCount(0);
    await expect(page.locator('.screen2-headline')).toHaveCSS('opacity', '1');
    // Taller again: the resize check builds the stage.
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
  });

  test('if building the stage throws, the document stays visible', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    // The scroll cue is appended to the pinned frame; make that one call throw (after the
    // stage has started to change the document).
    await page.addInitScript(() => {
      const append = Element.prototype.append;
      Element.prototype.append = function (...nodes) {
        if (this.matches?.('[data-stage] > .container') && nodes[0]?.matches?.('.stage-cue'))
          throw new Error('test: stage build fails');
        return append.apply(this, nodes);
      };
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-stage]')).not.toHaveAttribute('data-stage-mode');
    await expect(page.locator('.is-staged, .stage-cue, [data-screen2]')).toHaveCount(0);
    const styled = await page
      .locator('[data-stage] [style], [data-back-to-top][style]')
      .evaluateAll((els) => els.filter((el) => el.getAttribute('style')).length);
    expect(styled).toBe(0);
    for (const selector of ['h1', '.screen2-headline', '[data-fork-col="blog"]']) {
      await expect(page.locator(selector)).toHaveCSS('opacity', '1');
    }
    expect(errors).toEqual([]);
  });
});

// FD-86 changes phones only: from 768 px the photo's box is the one recorded before FD-86
// (the stage screenshots at 768×1024, 1024×768 and 1440×900 were compared pixel for pixel:
// identical).
test.describe('the phone hero leaves 768 px and up as it was (FD-86)', () => {
  for (const [width, height, reducedMotion, box] of [
    [1440, 900, 'no-preference', [948.4, 13, 461.8, 833.8]],
    [1440, 900, 'reduce', [948.4, 13, 461.8, 833.8]],
    [1024, 768, 'reduce', [677.5, 32.9, 382.8, 691.2]],
    [768, 1024, 'reduce', [458, 103.4, 286, 516.4]],
  ]) {
    test(`photo box at ${width}×${height} (${reducedMotion})`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
      const page = await context.newPage();
      await page.goto('/index.html');
      await page.evaluate(() => document.fonts.ready);
      await entranceDone(page);
      for (const selector of [
        '[data-stage-figure]',
        '[data-stage-figure] picture',
        '[data-stage-figure] img',
      ]) {
        const [r] = await rectsOf(page, selector);
        const got = [r.left, r.top, r.width, r.height];
        got.forEach((v, i) => expect(Math.abs(v - box[i]), `${selector} [${i}]`).toBeLessThan(0.6));
      }
      await expect(page.locator('[data-stage-figure] img')).toHaveCSS('object-fit', 'fill');
      if (width === 1440 && reducedMotion === 'no-preference') {
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'tests/screenshots/stage/stage-1440-0-dark.png' });
      }
      await context.close();
    });
  }
});

test.describe('Home stage, below 992 px', () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 800, height: 1000 },
  ]) {
    test(`no pin, reveals end visible (${viewport.width}px)`, async ({ browser }) => {
      const height = async (reducedMotion) => {
        const context = await browser.newContext({ viewport, reducedMotion });
        const page = await context.newPage();
        await page.goto('/index.html');
        await page.evaluate(() => document.fonts.ready);
        const value = await page.evaluate(() => document.documentElement.scrollHeight);
        await context.close();
        return value;
      };
      expect(await height('no-preference')).toBe(await height('reduce'));

      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await page.goto('/index.html');
      await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'mobile');
      // Reveal targets below the fold start hidden, then end visible.
      await expect(page.locator('.stage-reveal.is-pre').first()).toBeAttached();
      for (const selector of [
        '.screen2-headline',
        '.screen2-grid li:last-child',
        '[data-fork-col="portfolio"]',
        '[data-fork-col="blog"]',
      ]) {
        const el = page.locator(selector);
        await el.scrollIntoViewIfNeeded();
        await expect(el).toHaveCSS('opacity', '1');
      }
      await expect(page.locator('.stage-reveal.is-pre')).toHaveCount(0);
      await expect(page.locator('.stage-cue')).toHaveCount(0);
      await expect(page.locator('.is-staged')).toHaveCount(0);
      await context.close();
    });
  }

  // FD-86: the phone portrait moves and grows with the scroll, never cropped, never over the
  // buttons above or screen 2 below.
  for (const width of [320, 390]) {
    test(`phone parallax: the whole portrait at every point, clear of its neighbours (${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/index.html');
      await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'mobile');
      await page.locator('[data-stage-figure] img').evaluate((img) => img.decode());
      const transforms = new Set();
      for (let y = 0; y <= 1000; y += 100) {
        await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
        // The scrub's 0.6 s smoothing catches up.
        await page.waitForTimeout(750);
        const shape = await phonePortrait(page);
        const [ctas] = await rectsOf(page, '.hero-ctas');
        const [eyebrow] = await rectsOf(page, '[data-stage-statement]');
        expect(shape.content.top, `at ${y}`).toBeGreaterThanOrEqual(shape.window.top);
        expect(shape.content.bottom, `at ${y}`).toBeLessThanOrEqual(shape.window.bottom);
        expect(shape.content.left, `at ${y}`).toBeGreaterThanOrEqual(shape.window.left - 0.5);
        expect(shape.content.right, `at ${y}`).toBeLessThanOrEqual(shape.window.right);
        expect(shape.window.top, `at ${y}`).toBeGreaterThanOrEqual(ctas.bottom);
        expect(shape.window.bottom, `at ${y}`).toBeLessThanOrEqual(eyebrow.top);
        transforms.add(
          await page
            .locator('[data-stage-figure] picture')
            .evaluate((el) => getComputedStyle(el).transform),
        );
      }
      // The parallax did run.
      expect(transforms.size).toBeGreaterThan(2);
    });
  }

  test('a hidden Fork card shows at once when it takes keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'mobile');
    const card = page.locator('[data-fork-col="portfolio"]');
    await expect(card).toHaveClass(/is-pre/);
    await card.locator('a').focus();
    await expect(card).not.toHaveClass(/is-pre/);
    await expect(card).toHaveCSS('opacity', '1');
  });
});

test.describe('Home stage, reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('no stage module is requested and the document is the static one', async ({
    page,
    browser,
  }) => {
    // Only the entry module loads: no stage, GSAP or other dynamic chunk.
    const requested = [];
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      const allowed = /^\/assets\/main-[\w-]+\.js$/.test(path) || path === '/js/theme-init.js';
      if (path.endsWith('.js') && !allowed) requested.push(path);
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    await page.waitForLoadState('networkidle');
    expect(requested).toEqual([]);
    await expect(page.locator('[data-stage]')).not.toHaveAttribute('data-stage-mode');
    await expect(page.locator('.stage-cue')).toHaveCount(0);

    const selectors = [
      '[data-stage-figure]',
      'h1',
      '.hero-ctas',
      '.screen2-headline',
      '.screen2-areas',
      '[data-stage-fork]',
      '[data-fork-col="blog"]',
    ];
    const boxes = (target) =>
      target.evaluate(
        (list) => list.map((s) => document.querySelector(s).getBoundingClientRect().toJSON()),
        selectors,
      );
    const noJs = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const staticPage = await noJs.newPage();
    await staticPage.goto('/index.html');
    await staticPage.evaluate(() => document.fonts.ready);
    await entranceDone(staticPage);
    await page.evaluate(() => document.fonts.ready);
    expect(await boxes(page)).toEqual(await boxes(staticPage));
    await noJs.close();
  });
});

// FD-85: screen 2 is played, not scrubbed — start and end states, the entrance's order and
// timing, the 180 ms exit, no half-faded text at rest, focus shows it at once.
const screen2State = `(() => {
  const effectiveOpacity = ${effectiveOpacity};
  const $ = (s) => document.querySelector(s);
  const m = (el) => new DOMMatrix(getComputedStyle(el).transform);
  const items = [...document.querySelectorAll('.screen2-grid > li')];
  return {
    state: $('[data-stage-statement]').dataset.screen2,
    layer: parseFloat(getComputedStyle($('[data-stage-statement]')).opacity),
    head: parseFloat(getComputedStyle($('.screen2-headline')).opacity),
    headY: m($('.screen2-headline')).m42,
    eyebrowY: m($('.screen2-eyebrow')).m42,
    support: parseFloat(getComputedStyle($('.screen2-support')).opacity),
    rule: m($('.pillar-rule')).a,
    pillar: parseFloat(getComputedStyle($('.pillar-head')).opacity),
    first: parseFloat(getComputedStyle(items[0]).opacity),
    firstY: m(items[0]).m42,
    last: parseFloat(getComputedStyle(items.at(-1)).opacity),
    seen: effectiveOpacity($('.screen2-grid > li:last-child')),
  };
})()`;

// Every frame's screen-2 values with its time, until stopped.
async function record(page) {
  await page.evaluate(`(() => {
    window.__s2 = [];
    window.__s2stop = false;
    const sample = (t) => {
      window.__s2.push({ t, ...${screen2State} });
      if (!window.__s2stop) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  })()`);
}
async function stopRecording(page) {
  return page.evaluate(() => {
    window.__s2stop = true;
    return window.__s2;
  });
}
const firstAt = (frames, test) => frames.find(test)?.t ?? Infinity;

test.describe('Home screen 2, desktop (FD-85)', () => {
  test('FD-100: start and end states, the faster played entrance and the 180 ms exit (1440×900)', async ({
    page,
  }) => {
    await openStage(page, { width: 1440, height: 900 });
    await goTo(page, 0);
    let s = await page.evaluate(screen2State);
    expect(s).toMatchObject({ state: 'hidden', layer: 0, head: 0, support: 0, pillar: 0 });
    expect(s.headY).toBeCloseTo(8, 1);
    expect(s.eyebrowY).toBeCloseTo(8, 1);
    expect(s.rule).toBeCloseTo(0, 3);
    expect(s.first).toBe(0);
    expect(s.firstY).toBeCloseTo(6, 1);

    await record(page);
    await goTo(page, 0.3);
    await expect(page.locator('[data-stage-statement]')).toHaveAttribute('data-screen2', 'shown');
    let frames = await stopRecording(page);
    const head = firstAt(frames, (f) => f.head > 0);
    const support = firstAt(frames, (f) => f.support > 0);
    const rule = firstAt(frames, (f) => f.rule > 0.001);
    const first = firstAt(frames, (f) => f.first > 0);
    const last = firstAt(frames, (f) => f.last > 0);
    const headDone = firstAt(frames, (f) => f.head === 1);
    const allDone = firstAt(frames, (f) => f.last === 1);
    // FD-100 order and offsets (a frame or two of slack): support +40 ms, pillars +80 ms, the
    // first row after the pillars (+300 ms), the next row 30 ms later; the head in 250 ms and
    // the whole left side in about 0.55 s (last row done at 530 ms).
    expect(support - head).toBeGreaterThan(40 - 25);
    expect(support - head).toBeLessThan(40 + 25);
    expect(rule - head).toBeGreaterThan(80 - 25);
    expect(rule - head).toBeLessThan(80 + 25);
    expect(first - head).toBeGreaterThan(300 - 25);
    expect(first - head).toBeLessThan(300 + 25);
    expect(last - first).toBeGreaterThan(30 - 25);
    expect(last - first).toBeLessThan(30 + 25);
    expect(headDone - head).toBeGreaterThan(250 - 50);
    expect(headDone - head).toBeLessThan(250 + 50);
    expect(allDone - head).toBeGreaterThan(530 - 50);
    expect(allDone - head).toBeLessThan(550 + 50);
    // Played, not scrubbed: once it started, nothing went back.
    const started = frames.filter((f) => f.t >= head);
    for (const [i, f] of started.slice(1).entries()) {
      expect(f.head).toBeGreaterThanOrEqual(started[i].head);
    }
    s = await page.evaluate(screen2State);
    expect(s).toMatchObject({ layer: 1, head: 1, support: 1, pillar: 1, first: 1, last: 1 });
    expect(s.headY).toBeCloseTo(0, 3);
    expect(s.rule).toBeCloseTo(1, 3);
    expect(s.firstY).toBeCloseTo(0, 3);

    await record(page);
    await goTo(page, 0.7);
    await expect(page.locator('[data-stage-statement]')).toHaveAttribute('data-screen2', 'hidden');
    frames = await stopRecording(page);
    const fading = firstAt(frames, (f) => f.layer < 1);
    const gone = firstAt(frames, (f) => f.layer === 0);
    expect(frames.some((f) => f.state === 'leaving')).toBe(true);
    expect(gone - fading).toBeLessThanOrEqual(200 + 34);
    // Back again replays it.
    await goTo(page, 0.4);
    await expect(page.locator('[data-stage-statement]')).toHaveAttribute('data-screen2', 'shown');
  });

  test('ten points across screen 2: every frame hidden, rising or shown — never stuck half', async ({
    page,
  }) => {
    await openStage(page, { width: 1440, height: 900 });
    const inside = Array.from({ length: 10 }, (_, i) => 0.17 + i * 0.045);
    for (const p of [0.1, ...inside, 0.62, 0.7, 0.3, 0.12]) {
      // Scroll there and record every frame from the first one on, while the scrub catches up
      // and the entrance or the exit runs.
      await record(page);
      await goTo(page, p);
      await page.waitForTimeout(400);
      const frames = await stopRecording(page);
      const target = p >= 0.16 && p < 0.67;
      for (const [i, f] of frames.entries()) {
        const where = `at ${p}, frame ${i} (${f.state})`;
        if (f.state === 'hidden') expect(f.layer, where).toBe(0);
        if (f.state === 'shown') expect([f.layer, f.head, f.seen], where).toEqual([1, 1, 1]);
        if (f.state === 'playing') {
          expect(f.layer, where).toBe(1);
          // Rising: never lower than the frame before while it plays.
          const before = frames[i - 1];
          if (before?.state === 'playing')
            expect(f.head, where).toBeGreaterThanOrEqual(before.head);
        }
      }
      // At rest: shown in full inside screen 2, gone outside.
      const s = await page.evaluate(screen2State);
      if (target) expect([s.state, s.layer, s.head, s.seen], `at ${p}`).toEqual(['shown', 1, 1, 1]);
      else expect([s.state, s.layer], `at ${p}`).toEqual(['hidden', 0]);
    }
  });

  test('keyboard focus into a pillar at p = 0 jumps to screen 2 and shows it at once', async ({
    page,
  }) => {
    await openStage(page, { width: 1440, height: 900 });
    await goTo(page, 0);
    await page.locator('.hero-ctas a, .hero-ctas button').last().focus();
    await page.keyboard.press('Tab');
    await page.waitForTimeout(50);
    const state = await page.evaluate(focusState);
    expect(state.name).toContain('Research');
    expect(state.opacity).toBe(1);
    expect(state.inView).toBe(true);
    const s = await page.evaluate(screen2State);
    expect(s).toMatchObject({ state: 'shown', layer: 1, pillar: 1, seen: 1 });
    expect(s.rule).toBeCloseTo(1, 3);
    await expect(page.locator('.pillar').first()).toHaveCSS('outline-style', 'solid');
  });

  for (const theme of themes) {
    test(`axe: screen 2 shown has no violations (${theme})`, async ({ page }) => {
      await useTheme(page, theme);
      await openStage(page, { width: 1440, height: 900 });
      await goTo(page, 0.4);
      await expect(page.locator('[data-stage-statement]')).toHaveAttribute('data-screen2', 'shown');
      const result = await new AxeBuilder({ page })
        .include('[data-stage-statement]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(result.violations).toEqual([]);
    });
  }

  for (const [width, height, theme] of [
    [1440, 900, 'dark'],
    [1440, 900, 'light'],
    [1024, 768, 'dark'],
  ]) {
    test(`screenshot stage-${width}-screen2-${theme}`, async ({ page }) => {
      await useTheme(page, theme);
      await openStage(page, { width, height });
      await goTo(page, 0.4);
      await expect(page.locator('[data-stage-statement]')).toHaveAttribute('data-screen2', 'shown');
      await page.screenshot({ path: `${shots}/stage-${width}-screen2-${theme}.png` });
    });
  }
});

test.describe('Home screen 2, below 992 px (FD-85)', () => {
  test('plays once when it comes into view, never fades out (390×844)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    const layer = page.locator('[data-stage-statement]');
    await expect(layer).toHaveAttribute('data-screen2', 'hidden');
    expect((await page.evaluate(screen2State)).head).toBe(0);
    await layer.scrollIntoViewIfNeeded();
    await expect(layer).toHaveAttribute('data-screen2', 'shown');
    expect(await page.evaluate(screen2State)).toMatchObject({ head: 1, last: 1, seen: 1 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);
    await layer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    expect(await page.evaluate(screen2State)).toMatchObject({ state: 'shown', head: 1, seen: 1 });
  });

  test('a hidden screen 2 shows at once when it takes keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    const layer = page.locator('[data-stage-statement]');
    await expect(layer).toHaveAttribute('data-screen2', 'hidden');
    await page.locator('.pillar').first().focus();
    await expect(layer).toHaveAttribute('data-screen2', 'shown');
    expect(await page.evaluate(screen2State)).toMatchObject({ layer: 1, pillar: 1, seen: 1 });
  });
});

test.describe('Home screen 2, reduced motion (FD-85)', () => {
  test.use({ reducedMotion: 'reduce' });
  test('static and fully visible', async ({ page }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-screen2]')).toHaveCount(0);
      for (const selector of ['.screen2-headline', '.pillar-head', '.screen2-grid > li']) {
        await expect(page.locator(selector).first()).toHaveCSS('opacity', '1');
      }
    }
  });
});

// FD-96 (screen recording 2026-10-25, 1.5–8 s): the Fork buttons looked ready but took no click.
test.describe('Fork clickable when visible (FD-96)', () => {
  test('FD-96: from the first frame both cards are ≥ 0.95 opaque, the buttons take hover and click (1440×900)', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openStage(page, { width: 1440, height: 900 });
    const opacities = () =>
      page
        .locator('[data-fork-col]')
        .evaluateAll((cols) => cols.map((col) => parseFloat(getComputedStyle(col).opacity)));
    let first = null;
    for (let step = 50; step <= 100; step += 1) {
      await goTo(page, step / 100);
      if ((await opacities()).every((value) => value >= 0.95)) {
        first = step / 100;
        break;
      }
    }
    expect(first).not.toBeNull();
    for (const col of ['portfolio', 'blog']) {
      const hit = await page.locator(`[data-fork-col="${col}"] .fork-cta`).evaluate((cta) => {
        const r = cta.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return el === cta || cta.contains(el);
      });
      expect(hit, `${col} at ${first}`).toBe(true);
    }
    await page.screenshot({ path: 'tests/screenshots/stage/fork-clickable-1440-dark.png' });
    // Hover: the follower takes the button state, not the stage circle (FD-82 amended).
    const cta = page.locator('[data-fork-col="portfolio"] .fork-cta');
    const box = await cta.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
    await expect(page.locator('.cursor-ring')).toHaveAttribute('data-state', 'button');
    // A click navigates, through the seam wipe (FD-81).
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.page-wipe')).toHaveClass(/is-leaving/);
    await page.waitForURL(/\/portfolio\.html$/);
  });
});

// FD-97 (screen recording: two portraits, two shadows during the 82–100 % cross-fade): the figure
// lands on the back-to-top box and the two swap in one frame, scrolling down and back up.
test.describe('hand-off without a double image (FD-97)', () => {
  test('FD-97: every frame across the hand-off shows exactly one portrait and one shadow (1440×900)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openStage(page, { width: 1440, height: 900 });
    const { from, to } = await page.evaluate(() => {
      const stage = document.querySelector('[data-stage]');
      const stickyTop = parseFloat(getComputedStyle(stage.firstElementChild).top);
      const top = stage.getBoundingClientRect().top + window.scrollY;
      return { from: top - stickyTop, to: top + stage.offsetHeight - window.innerHeight };
    });
    await goTo(page, 0.3);
    await page.mouse.move(400, 450);
    // Every frame: the figure and the button as seen (opacity × visibility), and how many
    // painted drop-shadows lie in the window.
    await page.evaluate(`(() => {
      const effectiveOpacity = ${effectiveOpacity};
      const seen = (el) =>
        getComputedStyle(el).visibility === 'hidden' || el.closest('[hidden]') ? 0 : effectiveOpacity(el);
      window.__frames = [];
      const figure = document.querySelector('[data-stage-figure]');
      const button = document.querySelector('[data-back-to-top]');
      const sample = () => {
        // Painted shadows: drop-shadows on images, and the stage figure's floor ellipse.
        const floor =
          seen(figure) * parseFloat(getComputedStyle(figure, '::before').opacity) > 0.05 ? 1 : 0;
        const shadows = floor + [...document.querySelectorAll('img')].filter((img) => {
          const r = img.getBoundingClientRect();
          return /drop-shadow/.test(getComputedStyle(img).filter) && seen(img) > 0.05 &&
            r.bottom > 0 && r.top < innerHeight && r.width > 0;
        }).length;
        window.__frames.push({ figure: seen(figure), button: seen(button), shadows });
        if (!window.__stop) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    })()`);
    // Down through the hand-off and back up, by wheel, as a visitor scrolls.
    const steps = 30;
    for (const [a, b] of [
      [0.3, 1],
      [1, 0.3],
    ]) {
      const dy = ((b - a) * (to - from)) / steps;
      for (let i = 0; i < steps; i += 1) {
        await page.mouse.wheel(0, dy);
        await page.waitForTimeout(40);
      }
      await page.waitForTimeout(SETTLE);
    }
    const frames = await page.evaluate(() => {
      window.__stop = true;
      return window.__frames;
    });
    expect(frames.length).toBeGreaterThan(60);
    const both = frames.filter((f) => f.figure > 0.05 && f.button > 0.05);
    const none = frames.filter((f) => f.figure <= 0.05 && f.button <= 0.05);
    expect(both, 'frames with two portraits').toEqual([]);
    expect(none, 'frames with no portrait').toEqual([]);
    expect(frames.filter((f) => f.shadows > 1)).toEqual([]);
    // It went both ways: the button was seen, and the figure again after it.
    const swapped = frames.findIndex((f) => f.button > 0.05);
    expect(swapped).toBeGreaterThan(0);
    expect(frames.slice(swapped).some((f) => f.figure > 0.05)).toBe(true);

    // The figure lands exactly on the button's photo (FD-54).
    await goTo(page, 1);
    const [figure, photo] = await page.evaluate(() =>
      ['[data-stage-figure]', '[data-back-to-top] img'].map((s) =>
        document.querySelector(s).getBoundingClientRect().toJSON(),
      ),
    );
    for (const key of ['left', 'top', 'right', 'bottom']) {
      expect(Math.abs(figure[key] - photo[key]), key).toBeLessThan(1.5);
    }
    // Lands at the button's rest look: opacity 0.7, no floor shadow (FD-97).
    await goTo(page, 0.649);
    const landing = await page.evaluate(() => {
      const figure = document.querySelector('[data-stage-figure]');
      return [
        parseFloat(getComputedStyle(figure).opacity),
        parseFloat(getComputedStyle(figure, '::before').opacity),
      ];
    });
    expect(landing[0]).toBeCloseTo(0.7, 1);
    expect(landing[1]).toBeLessThan(0.05);
    for (const p of [64, 66, 82, 90, 100]) {
      await goTo(page, p / 100);
      await page.screenshot({ path: `tests/screenshots/stage/handoff-1440-${p}-dark.png` });
    }
  });
});

// FD-98 (screen recording: an empty stage between screens 2 and 3): at every 1 % from 50 % to
// 100 %, screen 2's text or the Fork's content is at least half seen, and the portrait (the
// stage figure, or the back-to-top photo once handed over) never lies over a Fork card's text
// or actions while both can be seen (FD-88).
test.describe('no empty stage (FD-98)', () => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ]) {
    test(`FD-98: every 1 % from 50 % to 100 % something is seen, the portrait clear of the Fork (${viewport.width}×${viewport.height})`, async ({
      page,
    }) => {
      test.setTimeout(150_000);
      await openStage(page, viewport);
      const shotsAt = viewport.width === 1440 ? [55, 60, 65, 70] : [];
      const handover = [];
      for (let step = 50; step <= 100; step += 1) {
        await goTo(page, step / 100);
        const s = await page.evaluate(`(() => {
          const effectiveOpacity = ${effectiveOpacity};
          const seen = (el) =>
            getComputedStyle(el).visibility === 'hidden' || el.closest('[hidden]') ? 0 : effectiveOpacity(el);
          const screen2 = Math.min(
            ...['.screen2-headline', '.screen2-support', '.pillar-head'].map((s) =>
              seen(document.querySelector(s)),
            ),
          );
          const fork = Math.min(
            ...['.fork-title', '[data-fork-col="portfolio"]', '[data-fork-col="blog"]'].map((s) =>
              seen(document.querySelector(s)),
            ),
          );
          const portraits = ['[data-stage-figure]', '[data-back-to-top] img']
            .map((s) => document.querySelector(s))
            .filter((el) => seen(el) > 0.01)
            .map((el) => el.getBoundingClientRect());
          const parts = [...document.querySelectorAll(
            '[data-fork-col] :is(.fork-chip, h3, .fork-text, .chip-row, .fork-cta)',
          )].filter((el) => seen(el) > 0.01);
          const hits = parts
            .filter((el) => {
              const e = el.getBoundingClientRect();
              return portraits.some((f) =>
                f.left < e.right && f.right > e.left && f.top < e.bottom && f.bottom > e.top);
            })
            .map((el) => el.closest('[data-fork-col]').dataset.forkCol + ' ' + el.className);
          return { screen2, fork, hits };
        })()`);
        const at = `at ${step} %`;
        expect(Math.max(s.screen2, s.fork), at).toBeGreaterThanOrEqual(0.5);
        expect(s.hits, at).toEqual([]);
        // Never both at rest on top of each other.
        expect(s.screen2 > 0.05 && s.fork > 0.05, `${at}: screen 2 under the Fork`).toBe(false);
        // Hand-over: both partly seen, or neither in full.
        if ((s.screen2 > 0.01 && s.fork > 0.01) || Math.max(s.screen2, s.fork) < 0.95) {
          handover.push(step);
        }
        if (shotsAt.includes(step)) {
          await page.screenshot({
            path: `tests/screenshots/stage/stage-1440-${step}-dark.png`,
          });
        }
      }
      expect(handover.length, `hand-over at ${handover} %`).toBeLessThanOrEqual(4);
      // At the end: the Fork in full, the portrait handed over.
      const s = await readStage(page);
      expect(s.cols).toEqual([1, 1]);
      expect(s.figureOpacity).toBe(0);
      expect(s.button.hidden).toBe(false);
    });
  }
});

// FD-99 (design specification, Areas of work): icon + label, no 01–06, grey label, 3 × 2 from 992 px.
test.describe('Areas of work as specified (FD-99)', () => {
  test('FD-99: 3 × 2 grid of icon + label, no numbers, grey "Areas of work" (1440×900)', async ({
    page,
  }) => {
    await openStage(page, { width: 1440, height: 900 });
    await goTo(page, 0.4);
    await expect(page.locator('[data-stage-statement]')).toHaveAttribute('data-screen2', 'shown');
    const s = await page.evaluate(() => {
      const rgb = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const probe = document.createElement('span');
      document.body.append(probe);
      probe.style.color = rgb('--fg-2');
      const fg2 = getComputedStyle(probe).color;
      probe.remove();
      const title = document.querySelector('.screen2-areas-title');
      const items = [...document.querySelectorAll('.screen2-grid > li')].map((li) => {
        const icon = li.querySelector('.area-icon').getBoundingClientRect();
        const label = li.querySelector('.area-label').getBoundingClientRect();
        return {
          x: Math.round(li.getBoundingClientRect().left),
          y: Math.round(li.getBoundingClientRect().top),
          // Icon and label on one line, the label after the icon.
          inline:
            Math.abs(icon.top + icon.height / 2 - (label.top + label.height / 2)) < 2 &&
            label.left > icon.right,
          digits: /\d/.test(li.textContent),
        };
      });
      return {
        titleColor: getComputedStyle(title).color,
        fg2,
        upper: getComputedStyle(title).textTransform,
        columns: new Set(items.map((i) => i.x)).size,
        rows: new Set(items.map((i) => i.y)).size,
        items,
      };
    });
    expect(s.titleColor).toBe(s.fg2);
    expect(s.upper).toBe('uppercase');
    expect([s.columns, s.rows]).toEqual([3, 2]);
    for (const item of s.items) expect([item.inline, item.digits]).toEqual([true, false]);
    await page
      .locator('.screen2-areas')
      .screenshot({ path: 'tests/screenshots/stage/areas-1440-dark.png' });
  });
});
