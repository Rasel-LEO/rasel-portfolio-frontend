// Author: Rasel Al Mamun
// Site-wide motion (FD-52): reveals, card tilt, magnetic buttons, hero tilt, cursor
// follower, seam wipe, Lenis; reduced motion and touch; the JS budget and axe with
// the ring on screen. Production build (npm test builds first).
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { entranceDone, templatePages } from './pages.js';

const desktop = { width: 1440, height: 900 };
const shots = 'tests/screenshots/motion';
const touch = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };

// motion.js marks <html> once its parts are set up (the cursor and Lenis load a moment later).
async function motionReady(page) {
  await expect(page.locator('html')).toHaveClass(/\bhas-motion\b/);
  await page.waitForTimeout(150);
}

test.describe('reveals (B1, B9)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(desktop);
  });

  for (const file of templatePages) {
    test(`${file}: nothing on screen at load starts hidden`, async ({ page }) => {
      await page.goto(`/${file}`);
      await motionReady(page);
      const hiddenOnScreen = await page.evaluate(() =>
        [...document.querySelectorAll('.is-pre')]
          .filter((el) => el.getBoundingClientRect().top < window.innerHeight)
          .map((el) => el.className),
      );
      expect(hiddenOnScreen).toEqual([]);
    });
  }

  test('below-the-fold items reveal once, in order, and end visible', async ({ page }) => {
    await page.goto('/portfolio.html');
    await motionReady(page);
    const pending = page.locator('[data-reveal].reveal.is-pre');
    expect(await pending.count()).toBeGreaterThan(5);
    const award = page.locator('.pf-award[data-reveal]').first();
    await expect(award).toHaveClass(/is-pre/);
    await award.scrollIntoViewIfNeeded();
    await expect(award).not.toHaveClass(/is-pre/);
    await expect(award).toHaveCSS('opacity', '1');
    await expect(award).not.toHaveClass(/\breveal\b/);
    // Once: scrolled away and back, it is not hidden again.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await award.scrollIntoViewIfNeeded();
    await expect(award).not.toHaveClass(/is-pre/);
    // Cards that enter together follow each other by --stagger (60 ms; FD-111). No chip
    // reveals are left on the site (tags are pills).
    const cards = page.locator('#research .pf-card[data-reveal]');
    await cards.first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(cards.first()).not.toHaveClass(/is-pre/);
    const delays = await cards.evaluateAll((els) =>
      els.slice(0, 3).map((el) => el.style.getPropertyValue('--reveal-delay') || '0ms'),
    );
    expect(delays).toEqual(['0ms', '60ms', '120ms']);
  });

  // FD-72: from scale 1.12, 48 px right and transparent to rest when the band is centred.
  test('Home: the Contact band photo settles with the scroll (FD-72)', async ({ page }) => {
    await page.goto('/index.html');
    await motionReady(page);
    const band = page.locator('[data-home="contact"]');
    const figure = page.locator('[data-contact-figure]');
    const state = () =>
      figure.evaluate((el) => {
        const m = new DOMMatrix(getComputedStyle(el).transform);
        return { scale: m.a, x: m.e, opacity: parseFloat(getComputedStyle(el).opacity) };
      });
    // The band's top at the bottom edge: the start.
    await band.evaluate((el) =>
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - innerHeight + 1,
        behavior: 'instant',
      }),
    );
    await page.waitForTimeout(900);
    let s = await state();
    expect(s.scale).toBeGreaterThan(1.1);
    expect(s.x).toBeGreaterThan(44);
    expect(s.opacity).toBeLessThan(0.05);
    // Half-way it is between.
    await band.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const start = r.top + window.scrollY - innerHeight;
      const end = r.top + window.scrollY + r.height / 2 - innerHeight / 2;
      window.scrollTo({ top: (start + end) / 2, behavior: 'instant' });
    });
    await page.waitForTimeout(900);
    s = await state();
    expect(s.scale).toBeGreaterThan(1.01);
    expect(s.scale).toBeLessThan(1.11);
    // Centred (as the last section: the page's end) — at rest, and no bounce back on the way.
    for (const toEnd of [false, true]) {
      await band.evaluate((el, toEnd) => {
        const centre =
          el.getBoundingClientRect().top + window.scrollY + el.offsetHeight / 2 - innerHeight / 2;
        const max = document.documentElement.scrollHeight - innerHeight;
        window.scrollTo({ top: toEnd ? max : Math.min(centre, max), behavior: 'instant' });
      }, toEnd);
      await page.waitForTimeout(900);
      s = await state();
      expect(s.scale).toBeCloseTo(1, 3);
      expect(Math.abs(s.x)).toBeLessThan(0.5);
      expect(s.opacity).toBe(1);
    }
    // Screenshot for visual review, at rest.
    await page.screenshot({ path: 'tests/screenshots/motion/contact-band-1440-dark.png' });
  });

  for (const width of [1024, 1280, 1440, 1920]) {
    test(`the Contact band settle never widens the page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      await motionReady(page);
      const band = page.locator('[data-home="contact"]');
      for (const at of ['start', 'end']) {
        await band.evaluate((el, at) => el.scrollIntoView({ block: at }), at);
        await page.waitForTimeout(300);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        ).toBeLessThanOrEqual(0);
      }
    });
  }

  test('phones: the Contact band photo rises once', async ({ browser }) => {
    const context = await browser.newContext(touch);
    const page = await context.newPage();
    await page.goto('/index.html');
    await motionReady(page);
    const figure = page.locator('[data-contact-figure]');
    await figure.scrollIntoViewIfNeeded();
    await expect.poll(() => figure.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    await page.waitForTimeout(700);
    expect(await figure.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).f)).toBe(0);
    await context.close();
  });

  test('keyboard focus on a hidden item shows it at once', async ({ page }) => {
    await page.goto('/portfolio.html');
    await motionReady(page);
    const index = await page
      .locator('.card[data-reveal]')
      .evaluateAll((cards) => cards.findLastIndex((card) => card.classList.contains('is-pre')));
    expect(index).toBeGreaterThan(-1);
    const card = page.locator('.card[data-reveal]').nth(index);
    await expect(card).toHaveClass(/is-pre/);
    await card.locator('.stretched-link').focus();
    await expect(card).not.toHaveClass(/is-pre/);
    await expect(card).toHaveCSS('opacity', '1');
  });
});

test.describe('fine pointer (B2–B5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(desktop);
  });

  test('a project card tilts toward the pointer and resets on leave', async ({ page }) => {
    await page.goto('/portfolio.html');
    await motionReady(page);
    const card = page.locator('.card').first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.5);
    await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.5);
    await expect(card).toHaveClass(/is-tilting/);
    const tilt = await card.evaluate((el) => parseFloat(el.style.getPropertyValue('--tilt')));
    expect(tilt).toBeGreaterThan(4);
    expect(tilt).toBeLessThanOrEqual(6);
    await expect(card).toHaveCSS('translate', '0px -4px');
    await page.mouse.move(5, 5);
    await expect(card).not.toHaveClass(/is-tilting/);
    await expect(card).toHaveCSS('rotate', 'none');
  });

  test('primary buttons pull toward the pointer by at most 6px and spring back', async ({
    page,
  }) => {
    await page.goto('/hire.html');
    await motionReady(page);
    const button = page.locator('.btn-primary').first();
    const box = await button.boundingBox();
    // Right of and below the centre, well inside the rounded box.
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.6);
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.65);
    await expect(button).toHaveClass(/is-magnetic/);
    const pull = await button.evaluate((el) => [
      parseFloat(el.style.getPropertyValue('--magnet-x')),
      parseFloat(el.style.getPropertyValue('--magnet-y')),
    ]);
    expect(pull[0]).toBeGreaterThan(0);
    expect(Math.max(...pull.map(Math.abs))).toBeLessThanOrEqual(6);
    await page.mouse.move(5, 300);
    await expect(button).not.toHaveClass(/is-magnetic/);
    // Icon buttons are never magnetic.
    const icon = page.locator('.btn-icon:visible').first();
    const iconBox = await icon.boundingBox();
    await page.mouse.move(iconBox.x + 2, iconBox.y + 2);
    await page.mouse.move(iconBox.x + 4, iconBox.y + 4);
    await expect(icon).not.toHaveClass(/is-magnetic/);
  });

  test('Home hero tilts with the pointer at the stage start only (B4)', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
    // The pointer moves the name only once the entrance is over (FD-67).
    await entranceDone(page);
    const heroTilt = () =>
      page.locator('[data-stage-hero]').evaluate((el) => {
        const m = new DOMMatrix(getComputedStyle(el).transform);
        return Math.abs(m.m13) + Math.abs(m.m23);
      });
    const lineX = () =>
      page
        .locator('.hero-line')
        .first()
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    await page.mouse.move(1400, 850);
    await page.mouse.move(1420, 880);
    await expect.poll(heroTilt).toBeGreaterThan(0.01);
    await expect.poll(lineX).toBeLessThan(-4);
    // Past 10 % the hero is at rest again.
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: 'instant' }));
    await page.mouse.move(1410, 870);
    await expect.poll(lineX).toBeGreaterThan(-0.5);
  });

  test('cursor follower: idle ring, link, button and pressed; hidden on fields and keyboard', async ({
    page,
  }) => {
    await page.goto('/contact.html');
    await motionReady(page);
    const ring = page.locator('.cursor-ring');
    await expect(ring).toHaveCount(1);
    await expect(ring).toHaveAttribute('aria-hidden', 'true');
    await expect(ring).toHaveCSS('pointer-events', 'none');

    const at = async (locator) => {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2);
    };
    // FD-82: over a paragraph, the small idle ring (10 px, 1 px --fg-1, 70 %).
    await at(page.locator('main p').first());
    await expect(ring).toHaveAttribute('data-state', 'idle');
    await expect(ring).toHaveClass(/is-on/);
    await expect(ring).toHaveCSS('opacity', '0.7');
    await expect(ring).toHaveCSS('width', '10px');
    await expect(ring).toHaveCSS('border-top-width', '1px');
    const fg1 = await page.evaluate(() => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--fg-1)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await expect(ring).toHaveCSS('border-top-color', fg1);

    // The link ring, unchanged: 28 px, 1.5 px --accent, opaque.
    await at(page.locator('.site-header nav a').first());
    await expect(ring).toHaveAttribute('data-state', 'link');
    await expect(ring).toHaveClass(/is-on/);
    await expect(ring).toHaveCSS('width', '28px');
    await expect(ring).toHaveCSS('opacity', '1');
    // (Its 1.5 px border is snapped to whole device pixels by Chrome, so only the colour is read.)
    const accent = await page.evaluate(() => {
      const probe = document.createElement('i');
      probe.style.color = 'var(--accent)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    await expect(ring).toHaveCSS('border-top-color', accent);

    const button = page.locator('form [type="submit"]');
    await button.scrollIntoViewIfNeeded();
    await at(button);
    await expect(ring).toHaveAttribute('data-state', 'button');
    const [ringBox, buttonBox] = await Promise.all([
      ring.evaluate((el) => ({ w: parseFloat(el.style.width), h: parseFloat(el.style.height) })),
      button.boundingBox(),
    ]);
    expect(Math.abs(ringBox.w - (buttonBox.width + 12))).toBeLessThanOrEqual(1);
    expect(Math.abs(ringBox.h - (buttonBox.height + 12))).toBeLessThanOrEqual(1);
    await page.mouse.down();
    await expect
      .poll(() => ring.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a))
      .toBeLessThan(0.85);
    await page.mouse.up();

    await at(page.locator('form input[name="email"]'));
    await expect(ring).toHaveAttribute('data-state', 'input');
    await expect(ring).not.toHaveClass(/is-on/);

    await at(page.locator('.site-header nav a').first());
    await expect(ring).toHaveClass(/is-on/);
    await page.keyboard.press('Tab');
    await expect(ring).not.toHaveClass(/is-on/);
    await at(page.locator('.site-header nav a').first());
    await expect(ring).toHaveClass(/is-on/);
    // The system cursor is never hidden.
    expect(
      await page.evaluate(() =>
        [...document.querySelectorAll('*')].some((el) => getComputedStyle(el).cursor === 'none'),
      ),
    ).toBe(false);
  });

  // FD-82: over the staged Home stage a 56 px soft filled circle (--fg-0 at 12 %); a link in
  // the stage keeps the link ring; no card halo; the back-to-top photo gets the link ring.
  test('stage circle on the Home stage, link ring inside it, no card halo', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
    await motionReady(page);
    await entranceDone(page);
    const ring = page.locator('.cursor-ring');
    const moveTo = async (x, y) => {
      await page.mouse.move(x, y);
      await page.mouse.move(x + 1, y + 1);
    };
    await moveTo(1100, 400);
    await expect(ring).toHaveAttribute('data-state', 'stage');
    await expect(ring).toHaveClass(/is-on/);
    await expect(ring).toHaveCSS('width', '56px');
    await expect(ring).toHaveCSS('opacity', '0.12');
    await expect(ring).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
    const fg0 = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--fg-0').trim(),
    );
    const hex = await ring.evaluate((el) => {
      const [r, g, b] = getComputedStyle(el).backgroundColor.match(/\d+/g).map(Number);
      return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    });
    expect(hex).toBe(fg0.toLowerCase());
    // The scale playback has settled at 56 px.
    await expect
      .poll(() => ring.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a))
      .toBeGreaterThan(0.99);
    await page.screenshot({ path: `${shots}/cursor-stage-1440-dark.png` });

    // A link inside the stage: the link ring wins.
    const cta = await page.locator('.hero-ctas a').first().boundingBox();
    await moveTo(cta.x + cta.width / 2, cta.y + cta.height / 2);
    await expect(ring).not.toHaveAttribute('data-state', 'stage');
    await expect(ring).toHaveClass(/is-on/);

    // Below the stage: the idle ring, also over a card (no halo).
    const card = page.locator('.service').first();
    await card.scrollIntoViewIfNeeded();
    const box = await card.boundingBox();
    await moveTo(box.x + 20, box.y + box.height - 12);
    await expect(ring).toHaveAttribute('data-state', 'idle');
    await expect(ring).toHaveClass(/is-on/);
    await expect(ring).toHaveCSS('width', '10px');

    // The back-to-top photo: the round link ring.
    await page.evaluate(() =>
      document
        .querySelector('[data-home="publications"]')
        .scrollIntoView({ block: 'start', behavior: 'instant' }),
    );
    const button = page.locator('[data-back-to-top]');
    await expect(button).toBeVisible();
    const target = await button.boundingBox();
    await moveTo(target.x + target.width / 2, target.y + target.height / 2);
    await expect(ring).toHaveAttribute('data-state', 'link');
    await expect(ring).toHaveClass(/is-on/);
  });

  test('below 992 px the Home stage area gets the idle ring', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/index.html');
    await motionReady(page);
    const ring = page.locator('.cursor-ring');
    const name = await page.locator('.hero-line').first().boundingBox();
    await page.mouse.move(name.x + 4, name.y + name.height / 2);
    await page.mouse.move(name.x + 5, name.y + name.height / 2);
    await expect(ring).toHaveAttribute('data-state', 'idle');
  });

  test('screenshots: idle ring on Portfolio, link ring on a nav link (1440, dark)', async ({
    page,
  }) => {
    await page.goto('/portfolio.html');
    await motionReady(page);
    await entranceDone(page);
    const ring = page.locator('.cursor-ring');
    const settle = () =>
      expect
        .poll(() => ring.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a))
        .toBeGreaterThan(0.99);
    const paragraph = await page.locator('main p').first().boundingBox();
    await page.mouse.move(paragraph.x + 40, paragraph.y + paragraph.height / 2);
    await page.mouse.move(paragraph.x + 41, paragraph.y + paragraph.height / 2);
    await expect(ring).toHaveAttribute('data-state', 'idle');
    await settle();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${shots}/cursor-idle-portfolio-1440-dark.png` });
    const link = await page.locator('.site-header nav a').last().boundingBox();
    await page.mouse.move(link.x + link.width / 2, link.y + link.height / 2);
    await page.mouse.move(link.x + link.width / 2 + 1, link.y + link.height / 2);
    await expect(ring).toHaveAttribute('data-state', 'link');
    await settle();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${shots}/cursor-link-1440-dark.png` });
  });

  test('axe finds nothing on Home with the ring on screen', async ({ page }) => {
    await page.goto('/index.html');
    await motionReady(page);
    const link = await page.locator('.hero-ctas a').first().boundingBox();
    await page.mouse.move(link.x + 10, link.y + 10);
    await page.mouse.move(link.x + 12, link.y + 12);
    await expect(page.locator('.cursor-ring')).toHaveClass(/is-on/);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(violations).toEqual([]);
  });
});

// LCP entries of the page load: [element class, start time].
async function largestPaint(page, url, { entrance = true } = {}) {
  await page.addInitScript((off) => {
    window.__lcp = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__lcp.push([entry.element?.className ?? '', entry.startTime]);
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    if (off) {
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent = '* { animation: none !important; }';
        document.head.append(style);
      });
    }
  }, !entrance);
  await page.goto(url);
  await page.waitForLoadState('load');
  await page.waitForTimeout(900);
  return page.evaluate(() => window.__lcp.at(-1));
}

test.describe('entrance (FD-67)', () => {
  test('Home: on every load, within 700 ms, from the first paint; no loader', async ({ page }) => {
    await page.setViewportSize(desktop);
    for (let visit = 0; visit < 2; visit += 1) {
      if (visit) await page.reload();
      else await page.goto('/index.html');
      const animations = await page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => /^enter-/.test(animation.animationName))
          .map((animation) => {
            const timing = animation.effect.getComputedTiming();
            return {
              name: animation.animationName,
              target: animation.effect.target.className,
              end: timing.endTime,
              properties: [
                ...new Set(
                  animation.effect
                    .getKeyframes()
                    .flatMap((frame) => Object.keys(frame))
                    .filter(
                      (key) => !['offset', 'computedOffset', 'easing', 'composite'].includes(key),
                    ),
                ),
              ],
            };
          }),
      );
      const targets = animations.map(({ target }) => target.split(' '));
      for (const name of [
        'hero-eyebrow',
        'hero-line',
        'hero-role',
        'hero-ctas',
        'stage-figure-col',
      ]) {
        expect(
          targets.some((classes) => classes.includes(name)),
          name,
        ).toBe(true);
      }
      // ≤ 700 ms from its start, which waits for the seam wipe to open a third (FD-81: 180 ms).
      expect(Math.max(...animations.map(({ end }) => end)) - 180, 'text').toBeLessThanOrEqual(700);
      // The hero photo only rises (no opacity), so the LCP image is never hidden.
      const photo = animations.find(({ target }) => target.includes('stage-figure-col'));
      expect(photo.properties).toEqual(['translate']);
    }
    await expect(page.locator('.loader')).toHaveCount(0);
  });

  // Portfolio has its own profile entrance (FD-111, tests/portfolio.spec.js item 10).
  test('other pages: main fades in over --d-base', async ({ page }) => {
    await page.goto('/blog.html');
    const fade = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => animation.animationName === 'enter-fade')
        .map((animation) => [
          animation.effect.target.tagName,
          animation.effect.getComputedTiming().duration,
        ]),
    );
    expect(fade).toEqual([['MAIN', 200]]);
  });

  // The LCP element and time with and without the entrance (median of three loads each).
  for (const [width, height, kind] of [
    [1440, 900, 'IMG photo'],
    [320, 568, 'hero text'],
  ]) {
    test(`LCP element and time unchanged by the entrance at ${width}×${height} (${kind})`, async ({
      browser,
    }) => {
      const run = async (entrance) => {
        const results = [];
        for (let i = 0; i < 3; i += 1) {
          const context = await browser.newContext({ viewport: { width, height } });
          const page = await context.newPage();
          results.push(await largestPaint(page, '/index.html', { entrance }));
          await context.close();
        }
        results.sort((x, y) => x[1] - y[1]);
        return results[1];
      };
      const [withEntrance, without] = [await run(true), await run(false)];
      expect(withEntrance[0]).toBe(without[0]);
      expect(Math.abs(withEntrance[1] - without[1])).toBeLessThanOrEqual(100);
    });
  }
});

test.describe('smooth scrolling (B7)', () => {
  test('Lenis runs on a fine-pointer desktop and pauses while the drawer is open', async ({
    page,
  }) => {
    await page.setViewportSize(desktop);
    await page.goto('/portfolio.html');
    await expect(page.locator('html')).toHaveClass(/\blenis\b/);
    await page.evaluate(() =>
      document.getElementById('drawer').dispatchEvent(new Event('show.bs.offcanvas')),
    );
    await expect(page.locator('html')).toHaveClass(/lenis-stopped/);
    await page.evaluate(() =>
      document.getElementById('drawer').dispatchEvent(new Event('hidden.bs.offcanvas')),
    );
    await expect(page.locator('html')).not.toHaveClass(/lenis-stopped/);
    // Below 992 px it stops.
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(page.locator('html')).not.toHaveClass(/\blenis\b/);
  });

  test('back to top goes through Lenis and lands at the top', async ({ page }) => {
    await page.setViewportSize(desktop);
    await page.goto('/portfolio.html');
    await expect(page.locator('html')).toHaveClass(/\blenis\b/);
    await page.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' }));
    const button = page.getByRole('button', { name: 'Back to top' });
    await expect(button).toBeVisible();
    await button.click();
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 }).toBe(0);
  });
});

test.describe('same-page links with Lenis (B7)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(desktop);
  });

  test('the skip link moves focus into main', async ({ page }) => {
    await page.goto('/portfolio.html');
    await expect(page.locator('html')).toHaveClass(/\blenis\b/);
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('main')))).toBe(true);
  });

  test('a section nav link scrolls its section clear of the header and focuses it', async ({
    page,
  }) => {
    await page.goto('/portfolio.html');
    await expect(page.locator('html')).toHaveClass(/\blenis\b/);
    const link = page.locator('[data-section-nav] a[href="#awards"]');
    const hash = await link.getAttribute('href');
    const target = page.locator(hash);
    await link.scrollIntoViewIfNeeded();
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${hash}$`));
    await expect(target).toBeFocused();
    const header = await page
      .locator('.site-header')
      .evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
    const top = () => target.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    await expect.poll(top, { timeout: 4000 }).toBeGreaterThanOrEqual(header);
    await expect.poll(top, { timeout: 4000 }).toBeLessThan(header + 40);
  });
});

test.describe('reveal transitions', () => {
  test('service cards fade and rise (their own transitions do not replace the reveal)', async ({
    page,
  }) => {
    await page.setViewportSize(desktop);
    await page.goto('/index.html');
    await motionReady(page);
    const pending = page.locator('.service.reveal.is-pre');
    await expect(pending.first()).toBeAttached();
    const transition = await pending.first().evaluate((el) => {
      el.classList.remove('is-pre');
      return getComputedStyle(el).transitionProperty;
    });
    expect(transition).toContain('opacity');
    expect(transition).toContain('transform');
  });

  test('phone Fork cards fade and rise', async ({ browser }) => {
    const context = await browser.newContext(touch);
    const page = await context.newPage();
    await page.goto('/index.html');
    await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'mobile');
    const card = page.locator('[data-fork-col="blog"]');
    await expect(card).toHaveClass(/stage-reveal/);
    // The transition that runs when the card is revealed (.is-pre itself has none).
    const style = await card.evaluate((el) => {
      el.classList.remove('is-pre');
      const cs = getComputedStyle(el);
      return { property: cs.transitionProperty, delay: cs.transitionDelay };
    });
    expect(style.property).toContain('opacity');
    expect(style.delay).toContain('0.06s');
    await context.close();
  });
});

test.describe('seam wipe (FD-81)', () => {
  test.use({ viewport: desktop });

  // Records the left half's box and the running animations in the first animation frame
  // (before the first paint) and,
  // when a click leaves the page, the click → pagehide time and the overlay's state.
  const record = (page) =>
    page.addInitScript(() => {
      const first = () => {
        const half = document.querySelector('.page-wipe .l');
        if (!half) return requestAnimationFrame(first);
        const box = half.getBoundingClientRect();
        const open = half.getAnimations().find((a) => a.animationName === 'page-wipe-open');
        window.__wipeFirst = {
          x: box.x,
          width: box.width,
          innerWidth: window.innerWidth,
          time: open ? Number(open.currentTime) : null,
          // The animations' start on the document timeline.
          start: open ? document.timeline.currentTime - Number(open.currentTime) : null,
          // Read here: a finished animation is no longer listed after a slow load.
          animations: document.getAnimations().map((a) => ({
            name: a.animationName,
            end: a.effect.getComputedTiming().endTime,
            delay: a.effect.getTiming().delay,
          })),
        };
        return undefined;
      };
      requestAnimationFrame(first);
      const start = (event) => {
        if (event.type === 'click' || event.key === 'Enter') window.__leaveAt = performance.now();
      };
      window.addEventListener('click', start, true);
      window.addEventListener('keydown', start, true);
      window.addEventListener('pagehide', () => {
        if (window.__leaveAt === undefined) return;
        const wipe = document.querySelector('.page-wipe');
        sessionStorage.setItem(
          'wipe-left',
          JSON.stringify({
            after: performance.now() - window.__leaveAt,
            leaving: wipe.classList.contains('is-leaving'),
          }),
        );
      });
    });

  // The halves' horizontal offsets and the overlay's pointer events, now.
  const wipeState = (page) =>
    page.evaluate(() => {
      const wipe = document.querySelector('.page-wipe');
      const style = (sel) => getComputedStyle(wipe.querySelector(sel));
      return {
        display: getComputedStyle(wipe).display,
        pointer: getComputedStyle(wipe).pointerEvents,
        left: new DOMMatrix(style('.l').transform).e,
        right: new DOMMatrix(style('.r').transform).e,
        seam: new DOMMatrix(style('.seam').transform).d,
        half: window.innerWidth / 2,
        leaving: wipe.classList.contains('is-leaving'),
      };
    });

  async function expectArrival(page) {
    // The first frame may run a little after load() returns.
    const first = await (await page.waitForFunction(() => window.__wipeFirst)).jsonValue();
    // Closed at the first frame (before the 60 ms delay has run out): the left half covers the
    // left half of the viewport; in any case it has not opened yet.
    expect(first.time).not.toBeNull();
    if (first.time <= 60) expect(first.x).toBe(0);
    expect(first.x).toBeGreaterThan(-first.width);
    expect(Math.abs(first.width - first.innerWidth / 2)).toBeLessThanOrEqual(1);
    const timing = first.animations.filter(({ name }) => /^page-wipe-/.test(name));
    expect(timing.map(({ name }) => name).sort()).toEqual([
      'page-wipe-open',
      'page-wipe-open',
      'page-wipe-seam',
    ]);
    // FD-81 amended 2026-10-25: the halves open 60 → 420 ms; the seam retracts from the same
    // moment, 60 → 260 ms, from the bottom up (scaled from its top edge).
    const ends = Object.fromEntries(timing.map(({ name, end }) => [name, end]));
    expect(ends['page-wipe-open']).toBe(420);
    expect(ends['page-wipe-seam']).toBe(260);
    for (const { delay } of timing) expect(delay).toBe(60);
    // On the wipe's own clock (under a busy test run the first frame, and the animations' start,
    // can come late after the navigation start, which is not the wipe's doing): the seam is
    // gone by about 280 ms after the open starts, and the halves are open by 600 ms.
    const reached = (time) =>
      page.waitForFunction((time) => {
        const open = document.querySelector('.page-wipe .l').getAnimations()[0];
        return !open || open.currentTime >= time;
      }, time);
    await reached(60 + 280);
    const seam = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('.page-wipe .seam'));
      return { scale: new DOMMatrix(style.transform).d, origin: style.transformOrigin };
    });
    expect(seam.scale).toBe(0);
    expect(seam.origin.split(' ')[1]).toBe('0px');
    await reached(600);
    const state = await wipeState(page);
    expect(state.display).toBe('block');
    expect(state.pointer).toBe('none');
    expect(Math.abs(state.left + state.half)).toBeLessThanOrEqual(1);
    expect(Math.abs(state.right - state.half)).toBeLessThanOrEqual(1);
    // The seam is drawn back to nothing once open.
    expect(state.seam).toBe(0);
  }

  for (const file of ['index.html', 'portfolio.html']) {
    test(`${file}: closed at the first frame, open and click-through by 600 ms, also on reload`, async ({
      page,
    }) => {
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
      await record(page);
      await page.goto(`/${file}`);
      await expectArrival(page);
      await page.reload();
      await expectArrival(page);
      expect(errors).toEqual([]);
    });
  }

  test('Home: the entrance starts as the halves open (60 ms + a third of 360 ms)', async ({
    page,
  }) => {
    await record(page);
    await page.goto('/index.html');
    const first = await (await page.waitForFunction(() => window.__wipeFirst)).jsonValue();
    const delays = first.animations
      .filter(({ name }) => /^enter-/.test(name))
      .map(({ delay }) => delay);
    expect(delays.length).toBeGreaterThan(0);
    expect(Math.min(...delays)).toBe(180);
  });

  test('leaving: an internal link closes the wipe and navigates within 350 ms', async ({
    page,
  }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await record(page);
    await page.goto('/index.html');
    await entranceDone(page);
    await page.locator('.site-header nav a[href="/portfolio.html"]').click();
    await page.waitForURL('**/portfolio.html');
    const left = JSON.parse(await page.evaluate(() => sessionStorage.getItem('wipe-left')));
    expect(left.leaving).toBe(true);
    expect(left.after).toBeLessThanOrEqual(350);
    // Keyboard: Enter on a link takes the same path.
    await entranceDone(page);
    await page.evaluate(() => sessionStorage.removeItem('wipe-left'));
    await page.locator('.site-header nav a[href="/blog.html"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForURL('**/blog.html');
    const keyed = JSON.parse(await page.evaluate(() => sessionStorage.getItem('wipe-left')));
    expect(keyed.leaving).toBe(true);
    expect(keyed.after).toBeLessThanOrEqual(350);
    expect(errors).toEqual([]);
  });

  test('external, mailto:, tel:, hash, new-tab, modifier and download links do not wipe', async ({
    page,
  }) => {
    await page.goto('/portfolio.html');
    await entranceDone(page);
    const results = await page.evaluate(() => {
      const cases = [
        ['https://example.com/', {}],
        ['mailto:someone@example.com', {}],
        ['tel:+10000000000', {}],
        ['#cv', {}],
        ['/portfolio.html#cv', {}],
        ['/blog.html', { target: '_blank' }],
        ['/blog.html', { download: '' }],
        ['/blog.html', {}, { ctrlKey: true }],
        ['/blog.html', {}, { metaKey: true }],
        ['/blog.html', {}, { shiftKey: true }],
        ['/blog.html', {}, { altKey: true }],
        ['/blog.html', { 'data-handled': '' }],
        ['/blog.html', {}, { button: 1 }],
      ];
      const wipe = document.querySelector('.page-wipe');
      // A page module that handles a link itself (it prevents the default before window).
      const handled = (event) => {
        if (event.target.closest('[data-handled]')) event.preventDefault();
      };
      document.addEventListener('click', handled);
      const results = cases.map(([href, attrs, init = {}]) => {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = 'test';
        for (const [name, value] of Object.entries(attrs)) link.setAttribute(name, value);
        document.querySelector('main').append(link);
        let prevented = null;
        // Runs after the wipe's window listener; stops the navigation itself.
        const after = (event) => {
          prevented = event.defaultPrevented;
          event.preventDefault();
        };
        window.addEventListener('click', after);
        link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
        window.removeEventListener('click', after);
        link.remove();
        const key = JSON.stringify({ ...attrs, ...init });
        return [href, key, prevented, wipe.classList.contains('is-leaving')];
      });
      document.removeEventListener('click', handled);
      return results;
    });
    // Never the wipe; and the browser keeps the link (a same-page hash is Lenis's to scroll).
    for (const [href, init, prevented, leaving] of results) {
      expect([href, init, leaving]).toEqual([href, init, false]);
      if (!href.includes('#') && !init.includes('data-handled'))
        expect([href, init, prevented]).toEqual([href, init, false]);
    }
  });

  test('back and forward restore the page without a closed overlay', async ({ page }) => {
    await page.goto('/index.html');
    await entranceDone(page);
    await page.locator('.site-header nav a[href="/portfolio.html"]').click();
    await page.waitForURL('**/portfolio.html');
    for (const [move, url] of [
      [() => page.goBack(), '**/index.html'],
      [() => page.goForward(), '**/portfolio.html'],
    ]) {
      await move();
      await page.waitForURL(url);
      await page.waitForTimeout(700);
      const state = await wipeState(page);
      expect(state.leaving).toBe(false);
      expect(Math.abs(state.left + state.half)).toBeLessThanOrEqual(1);
    }
  });

  test('a page restored from the back/forward cache opens at once', async ({ page }) => {
    await page.goto('/index.html');
    await entranceDone(page);
    // The persisted pageshow of a cache restore, after a leave had closed the overlay: open in
    // the same frame, with no replay of the arrival.
    const restored = await page.evaluate(() => {
      const wipe = document.querySelector('.page-wipe');
      wipe.classList.add('is-leaving');
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      const half = wipe.querySelector('.l');
      return {
        leaving: wipe.classList.contains('is-leaving'),
        x: new DOMMatrix(getComputedStyle(half).transform).e,
        half: window.innerWidth / 2,
        running: half.getAnimations().length,
      };
    });
    expect(restored.leaving).toBe(false);
    expect(Math.abs(restored.x + restored.half)).toBeLessThanOrEqual(1);
    expect(restored.running).toBe(0);
  });

  test('screenshots: opening and closing, mid-animation (1440, dark)', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      for (const a of document.getAnimations()) {
        if (!/^(page-wipe|enter)-/.test(a.animationName)) continue;
        a.pause();
        a.currentTime = 60 + 120;
      }
    });
    await page.screenshot({ path: `${shots}/wipe-opening-1440-dark.png` });
    await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
    await page.evaluate(() => {
      document.querySelector('.page-wipe').classList.add('is-leaving');
      for (const a of document.getAnimations()) {
        if (!a.effect?.target?.closest?.('.page-wipe')) continue;
        a.pause();
        a.currentTime = 160;
      }
    });
    await page.screenshot({ path: `${shots}/wipe-closing-1440-dark.png` });
  });
});

test.describe('seam wipe off (FD-81)', () => {
  test('reduced motion: no overlay and no leave wipe', async ({ browser }) => {
    const context = await browser.newContext({ viewport: desktop, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/index.html');
    await expect(page.locator('.page-wipe')).toHaveCSS('display', 'none');
    const prevented = await page.evaluate(() => {
      let value = null;
      const after = (event) => {
        value = event.defaultPrevented;
        event.preventDefault();
      };
      window.addEventListener('click', after);
      document.querySelector('.site-header nav a[href="/portfolio.html"]').click();
      window.removeEventListener('click', after);
      return value;
    });
    expect(prevented).toBe(false);
    await context.close();
  });

  test('without JavaScript: no overlay', async ({ browser }) => {
    const context = await browser.newContext({ viewport: desktop, javaScriptEnabled: false });
    const page = await context.newPage();
    for (const file of ['index.html', 'portfolio.html']) {
      await page.goto(`/${file}`);
      await expect(page.locator('.page-wipe')).toHaveCSS('display', 'none');
    }
    await context.close();
  });
});

test.describe('touch (no fine pointer)', () => {
  test.use(touch);

  test('no ring, no tilt, no Lenis; reveals still run', async ({ page }) => {
    await page.goto('/portfolio.html');
    await motionReady(page);
    await expect(page.locator('.cursor-ring')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/\blenis\b/);
    const card = page.locator('.card').first();
    await card.scrollIntoViewIfNeeded();
    await card.tap();
    await expect(page.locator('.is-tilting, .is-magnetic')).toHaveCount(0);
    expect(await page.locator('.reveal.is-pre, .reveal').count()).toBeGreaterThan(0);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  for (const file of ['index.html', 'portfolio.html', 'blog.html', 'hire.html', 'contact.html']) {
    test(`${file}: no motion module, ring, loader, hidden state or transition`, async ({
      page,
    }) => {
      const scripts = [];
      page.on('request', (request) => {
        const path = new URL(request.url()).pathname;
        if (path.endsWith('.js')) scripts.push(path);
      });
      await page.setViewportSize(desktop);
      await page.goto(`/${file}`);
      await page.waitForLoadState('networkidle');
      await page.mouse.move(600, 300);
      expect(
        scripts.filter((path) => /\/(motion|cursor|lenis|stage|stage-desktop)-/.test(path)),
      ).toEqual([]);
      await expect(page.locator('.cursor-ring, .loader, .is-pre, .reveal')).toHaveCount(0);
      // No entrance (FD-67), no seam wipe (FD-81).
      expect(
        await page.evaluate(
          () =>
            document.getAnimations().filter((a) => /^(enter|page-wipe)-/.test(a.animationName))
              .length,
        ),
      ).toBe(0);
      await expect(page.locator('.page-wipe')).toHaveCSS('display', 'none');
    });
  }
});

// Phones (FD-73): the entry, stage.js, home-motion.js, GSAP and motion.js — at most 70 KB.
test('JS budget: Home at 390 px loads at most 70 KB of compressed JS (FD-73)', async ({
  browser,
}) => {
  const context = await browser.newContext(touch);
  const page = await context.newPage();
  const scripts = new Set();
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith('.js')) scripts.add(path);
  });
  await page.goto('/index.html');
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'mobile');
  await motionReady(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForLoadState('networkidle');
  const sizes = [...scripts].map((path) => ({
    path,
    gzip: gzipSync(readFileSync(`dist${path}`)).length,
  }));
  const total = sizes.reduce((sum, { gzip }) => sum + gzip, 0);
  expect(
    sizes.some(({ path }) => path.includes('/home-motion-')),
    'home-motion',
  ).toBe(true);
  expect(
    sizes.some(({ path }) => path.includes('/stage-desktop-')),
    'no desktop stage',
  ).toBe(false);
  expect(total, JSON.stringify(sizes)).toBeLessThanOrEqual(70 * 1024);
  await context.close();
});

test('JS budget: Home at 1440 px loads at most 120 KB of compressed JS (handoff §5)', async ({
  page,
}) => {
  const scripts = new Set();
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path.endsWith('.js')) scripts.add(path);
  });
  await page.setViewportSize(desktop);
  await page.goto('/index.html');
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
  await page.mouse.move(600, 300);
  await expect(page.locator('html')).toHaveClass(/\blenis\b/);
  await page.waitForLoadState('networkidle');
  // Sizes from the built files (dist/ mirrors the served paths), gzip level 6 as served.
  const sizes = [...scripts].map((path) => ({
    path,
    gzip: gzipSync(readFileSync(`dist${path}`)).length,
  }));
  const total = sizes.reduce((sum, { gzip }) => sum + gzip, 0);
  // Every motion part is in: stage, GSAP, Lenis, the ring.
  for (const name of ['main', 'motion', 'cursor', 'lenis', 'stage-desktop']) {
    expect(
      sizes.some(({ path }) => path.includes(`/${name}-`)),
      name,
    ).toBe(true);
  }
  expect(total, JSON.stringify(sizes)).toBeLessThanOrEqual(120 * 1024);
});
