// Author: Rasel Al Mamun
// Release 1.6.0, round 5 (FD-170 … FD-172): the owner's local test of round 4 — the back-to-top
// hand-off after the shorter stage, Selected work at v1.5.1's size with the image inside, the section
// gaps, the phone footer row, the Projects navbar item and the hero centred on large screens.
import { expect, test } from './fixtures.js';
import { revealAll, themes, useTheme } from './pages.js';

const box = (locator) => locator.boundingBox();

// ---- item 1: the hand-off ---------------------------------------------------------------

// Samples, on every animation frame, where the page is scrolled and what the figure and the button
// are: the figure's visibility, the button's visibility, opacity, position and its box.
const SAMPLER = `(() => {
  const stage = document.querySelector('[data-stage]');
  const stickyTop = parseFloat(getComputedStyle(stage.firstElementChild).top);
  const top = stage.getBoundingClientRect().top + window.scrollY;
  window.__end = top + stage.offsetHeight - window.innerHeight;
  window.__start = top - stickyTop;
  window.__frames = [];
  const figure = document.querySelector('[data-stage-figure]');
  const button = document.querySelector('[data-back-to-top]');
  const sample = () => {
    const b = getComputedStyle(button);
    const r = button.getBoundingClientRect();
    window.__frames.push({
      t: performance.now(),
      y: window.scrollY,
      figureHidden: getComputedStyle(figure).visibility === 'hidden',
      buttonHidden: button.hidden,
      buttonVisibility: b.visibility,
      buttonOpacity: parseFloat(b.opacity),
      position: b.position,
      held: button.classList.contains('is-held'),
      rect: [r.left, r.top, r.right, r.bottom],
      viewport: [innerWidth, innerHeight],
    });
    if (!window.__stop) requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
})()`;

// After the hand-off (the scroll has reached the end of the stage) the button is the image: shown,
// fixed in the corner, never moving, the stage figure hidden. A frame's state is checked against
// the scroll position of the frame before it (the page and the script run in the same frame); going
// back up, the frames already inside the stage are the reverse, as in v1.5.1.
function handedViolations(frames, end) {
  const isHanded = (i) => i > 0 && frames[i - 1].y >= end && frames[i].y >= end;
  const handed = frames.filter((frame, i) => isHanded(i));
  const bad = [];
  let corner = null;
  let first = null;
  for (const [i, f] of frames.entries()) {
    if (!isHanded(i)) continue;
    // Round 6 (FD-173): a stage released before the shrink had finished glides into the corner in
    // about 320 ms; the button is still while it rests there (tests/round6.spec.js proves the glide).
    if (!isHanded(i - 1)) first = f.t;
    if (f.t - first < 700) continue;
    corner ??= f.rect;
    const problems = [];
    if (!f.figureHidden) problems.push('figure shown');
    if (f.buttonHidden || f.buttonVisibility !== 'visible') problems.push('button hidden');
    if (f.buttonOpacity < 0.6) problems.push(`button opacity ${f.buttonOpacity}`);
    if (f.held) problems.push('button held');
    if (f.position !== 'fixed') problems.push(`position ${f.position}`);
    if (f.rect.some((value, k) => Math.abs(value - corner[k]) > 1.5)) problems.push('button moved');
    if (problems.length) bad.push({ y: f.y, problems });
  }
  return { count: handed.length, bad };
}

async function openHome(page, size = { width: 1440, height: 900 }) {
  await page.setViewportSize(size);
  await page.goto('/index.html');
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

const stop = (page) =>
  page.evaluate(() => {
    window.__stop = true;
    return { frames: window.__frames, end: window.__end, start: window.__start };
  });

test.describe('hand-off to the back-to-top image (item 1)', () => {
  test.describe.configure({ timeout: 90_000 });

  // The wheel, as a visitor scrolls: small steps (slow) and large steps (fast), then back up.
  for (const [kind, delta, pause] of [
    ['slow', 60, 30],
    ['fast', 700, 16],
  ]) {
    test(`${kind} wheel scrolling down past the stage and back up (1440×900)`, async ({ page }) => {
      await openHome(page);
      await page.evaluate(SAMPLER);
      await page.mouse.move(700, 450);
      const reach = await page.evaluate(
        () => window.__end + window.innerHeight * 2.5 - window.scrollY,
      );
      const steps = Math.ceil(reach / delta);
      for (let i = 0; i < steps; i += 1) {
        await page.mouse.wheel(0, delta);
        await page.waitForTimeout(pause);
      }
      await page.waitForTimeout(1200);
      for (let i = 0; i < steps; i += 1) {
        await page.mouse.wheel(0, -delta);
        await page.waitForTimeout(pause);
      }
      await page.waitForTimeout(1200);
      const { frames, end } = await stop(page);
      const { count, bad } = handedViolations(frames, end);
      expect(count, 'frames after the hand-off').toBeGreaterThan(20);
      expect(bad).toEqual([]);
      // Back at the top the figure is the picture again and the button waits (v1.5.1).
      const last = frames.at(-1);
      expect(last.y).toBeLessThan(5);
    });
  }

  test('End and PageDown keys', async ({ page }) => {
    await openHome(page);
    await page.evaluate(SAMPLER);
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(800);
    await page.keyboard.press('End');
    await page.waitForTimeout(1500);
    await page.keyboard.press('Home');
    await page.waitForTimeout(1200);
    await page.keyboard.press('End');
    await page.waitForTimeout(1500);
    const { frames, end } = await stop(page);
    const { count, bad } = handedViolations(frames, end);
    expect(count).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });

  test('jumps to places below the stage: shown, fixed, figure hidden', async ({ page }) => {
    await openHome(page);
    const end = await page.evaluate(() => {
      const stage = document.querySelector('[data-stage]');
      return stage.getBoundingClientRect().top + window.scrollY + stage.offsetHeight - innerHeight;
    });
    for (const offset of [0, 1, 40, 300, 900, 1800, 3000]) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), end + offset);
      await page.waitForTimeout(400);
      const state = await page.evaluate(() => {
        const button = document.querySelector('[data-back-to-top]');
        const figure = document.querySelector('[data-stage-figure]');
        const r = button.getBoundingClientRect();
        return {
          figureHidden: getComputedStyle(figure).visibility === 'hidden',
          shown: !button.hidden && getComputedStyle(button).visibility === 'visible',
          opacity: parseFloat(getComputedStyle(button).opacity),
          position: getComputedStyle(button).position,
          inCorner: r.right <= innerWidth && r.bottom <= innerHeight && r.bottom > innerHeight - 60,
        };
      });
      expect(state, `at ${offset} px below the stage's end`).toMatchObject({
        figureHidden: true,
        shown: true,
        position: 'fixed',
        inCorner: true,
      });
      expect(state.opacity).toBeGreaterThan(0.6);
    }
  });

  test('scrolling back up into the stage brings the figure back (reverse as v1.5.1)', async ({
    page,
  }) => {
    await openHome(page);
    const { start, end } = await page.evaluate(() => {
      const stage = document.querySelector('[data-stage]');
      const stickyTop = parseFloat(getComputedStyle(stage.firstElementChild).top);
      const top = stage.getBoundingClientRect().top + window.scrollY;
      return { start: top - stickyTop, end: top + stage.offsetHeight - innerHeight };
    });
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), end + 600);
    await page.waitForTimeout(600);
    await page.evaluate(
      (y) => window.scrollTo({ top: y, behavior: 'instant' }),
      start + (end - start) * 0.5,
    );
    await page.waitForTimeout(1500);
    const state = await page.evaluate(() => ({
      figureHidden:
        getComputedStyle(document.querySelector('[data-stage-figure]')).visibility === 'hidden',
      held: document.querySelector('[data-back-to-top]').classList.contains('is-held'),
    }));
    expect(state).toEqual({ figureHidden: false, held: true });
  });
});

// ---- item 6: the Projects navbar item ----------------------------------------------------

test.describe('navbar: Projects (item 6)', () => {
  test('Portfolio · Blog · Projects · Contact, then Hire me', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    const nav = page.getByRole('navigation', { name: 'Primary' });
    await expect(nav.getByRole('link')).toHaveText(['Portfolio', 'Blog', 'Projects', 'Contact']);
    await expect(nav.getByRole('link', { name: 'Projects' })).toHaveAttribute(
      'href',
      '/research.html',
    );
    const links = await nav
      .getByRole('link')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    const hire = await box(page.locator('.site-header .hire-cta'));
    expect(links.at(-1).right).toBeLessThan(hire.x);
    for (let i = 1; i < links.length; i += 1)
      expect(links[i].left).toBeGreaterThanOrEqual(links[i - 1].right - 0.5);
  });

  for (const [file, key] of [
    ['research.html', 'page'],
    ['project-biofloc-iot.html', 'true'],
  ]) {
    test(`${file}: Projects is the current item, Portfolio is not`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`/${file}`);
      const nav = page.getByRole('navigation', { name: 'Primary' });
      await expect(nav.getByRole('link', { name: 'Projects' })).toHaveAttribute(
        'aria-current',
        key,
      );
      await expect(nav.locator('[aria-current]')).toHaveCount(1);
      await expect(nav.getByRole('link', { name: 'Portfolio' })).not.toHaveAttribute(
        'aria-current',
      );
      // The same active style as the other links (the shape marks it as well as the colour).
      const shadow = await nav
        .getByRole('link', { name: 'Projects' })
        .evaluate((el) => getComputedStyle(el).boxShadow);
      expect(shadow).not.toBe('none');
    });
  }

  test('the phone menu lists Projects after Blog with its sub-line', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    await page.getByRole('button', { name: 'Menu' }).click();
    const items = page.locator('.drawer-links li');
    await expect(
      items.locator('a').evaluateAll((els) => els.map((el) => el.firstChild.textContent)),
    ).resolves.toEqual(['Home', 'Portfolio', 'Blog', 'Projects', 'Hire me', 'Contact']);
    await expect(items.nth(3).locator('.drawer-sub')).toHaveText('Research · Software');
    await expect(items.nth(3).locator('a')).toHaveAttribute('href', '/research.html');
  });
});

// ---- items 2 to 4: Selected work and the gaps -------------------------------------------

test.describe('Selected work (item 2)', () => {
  // v1.5.1's section, measured in a build of that tag: the big card 517 px (1440 wide) and 436 px
  // (390 wide); the grid is as tall as the big card.
  for (const [width, height, baseline] of [
    [1440, 900, 517],
    [1280, 800, 517],
    [390, 844, 436],
  ]) {
    test(`the big card is within 16 px of v1.5.1 (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/index.html');
      const card = await box(page.locator('.work-card-large'));
      // The image is inside the card, full width, at its top.
      const cover = await box(page.locator('.work-card-large .work-cover'));
      expect(Math.abs(cover.x - card.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(cover.width - card.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(cover.y - card.y)).toBeLessThanOrEqual(1);
      if (width >= 992) {
        // From lg the short band, as in v1.5.1.
        expect(Math.abs(card.height - baseline)).toBeLessThanOrEqual(16);
        expect(cover.height).toBeLessThan(card.height / 2);
      } else {
        // 1.7.0 (owner): below lg the whole card image at 16:9 instead of the 56 px band; the text
        // below it is as in v1.5.1.
        expect(cover.width / cover.height).toBeCloseTo(16 / 9, 1);
        expect(Math.abs(card.height - (baseline - 56 + cover.height))).toBeLessThanOrEqual(16);
      }
    });
  }

  for (const width of [1440, 390]) {
    test(`all three cards use the same text sizes (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/index.html');
      const sizes = await page.locator('.work-card').evaluateAll((cards) =>
        cards.map((card) => {
          const size = (selector) => {
            const el = card.querySelector(selector);
            return el ? getComputedStyle(el).fontSize : null;
          };
          return {
            eyebrow: size('.work-eyebrow, .work-role'),
            title: size('.card-title'),
            summary: size('.work-summary'),
            tags: size('.tag-pill, .pill, [class*="tag"] li, .tags li'),
            link: size('.work-link'),
          };
        }),
      );
      expect(sizes).toHaveLength(3);
      for (const key of ['eyebrow', 'title', 'summary', 'tags', 'link']) {
        expect(new Set(sizes.map((s) => s[key])).size, key).toBe(1);
      }
    });
  }

  test('the two right cards have no large empty area (1440)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/index.html');
    const gaps = await page
      .locator('.work-cards > li:not(.work-cards-large) .work-card')
      .evaluateAll((cards) =>
        cards.map((card) => {
          const link = card.querySelector('.work-link').getBoundingClientRect();
          const last = [...card.children]
            .filter((el) => !el.matches('.work-link'))
            .map((el) => el.getBoundingClientRect().bottom)
            .reduce((a, b) => Math.max(a, b), 0);
          return link.top - last;
        }),
      );
    for (const gap of gaps) expect(gap).toBeLessThan(48);
  });
});

test.describe('section gaps (items 3 and 4)', () => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ]) {
    test(`Latest posts → the Contact band is the standard gap (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/index.html');
      const gap = await page.evaluate(() => {
        const token = parseFloat(getComputedStyle(document.querySelector('.latest')).paddingBottom);
        const band = document.querySelector('.contact-band');
        const latest = document.querySelector('.latest');
        return {
          token,
          latestToBand: Math.round(
            band.getBoundingClientRect().top - latest.getBoundingClientRect().bottom,
          ),
          bandTop: parseFloat(getComputedStyle(band).paddingTop),
          bandBottom: parseFloat(getComputedStyle(band).paddingBottom),
          between: [...document.querySelectorAll('main > .home-section')].map(
            (el) => getComputedStyle(el).paddingBottom,
          ),
        };
      });
      expect(gap.latestToBand).toBe(0);
      // The band's own inner padding is the same medium token as every section's.
      expect(gap.bandTop).toBe(gap.token);
      expect(gap.bandBottom).toBe(gap.token);
      expect(new Set(gap.between).size).toBe(1);
    });
  }

  test('phones: the standard gap after the Areas of work, before "Three ways"', async ({
    page,
  }) => {
    for (const width of [320, 390, 430, 767]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/index.html');
      // 1.7.4 (F12): measured once screen 2's entrance and every reveal have settled (under load
      // the entrance could still be moving the areas).
      await revealAll(page);
      const gap = await page.evaluate(() => {
        const last = [...document.querySelectorAll('.screen2-grid > li')].at(-1);
        const hire = document.querySelector('.hire-band');
        const token = parseFloat(getComputedStyle(hire).paddingTop);
        return {
          token,
          gap: hire.getBoundingClientRect().top - last.getBoundingClientRect().bottom,
        };
      });
      expect(gap.gap, `${width} px`).toBeGreaterThanOrEqual(gap.token - 1);
      expect(gap.gap, `${width} px`).toBeLessThanOrEqual(gap.token + 2);
    }
  });
});

// ---- item 5: the phone footer row -------------------------------------------------------

test.describe('phone footer row and back-to-top (item 5)', () => {
  for (const theme of themes) {
    for (const width of [320, 360, 390, 430]) {
      test(`${width} px, ${theme}: one-line copyright, Privacy below, Theme right; photo clear of the row`, async ({
        page,
      }) => {
        await useTheme(page, theme);
        await page.setViewportSize({ width, height: 800 });
        await page.goto('/index.html');
        const row = page.locator('.site-footer-bottom');
        await row.scrollIntoViewIfNeeded();
        await page.evaluate(() =>
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
        );
        await page.waitForTimeout(900);
        const copyright = page.locator('.footer-copyright');
        await expect(copyright).toHaveText(/^© 2026 Rasel Al Mamun$/);
        const [c, p, t, r] = await Promise.all([
          box(copyright),
          box(page.locator('.footer-privacy-link')),
          box(page.locator('.site-footer .theme-button')),
          box(row),
        ]);
        // One line: the height of one line of small text.
        expect(c.height).toBeLessThan(30);
        expect(p.y).toBeGreaterThanOrEqual(c.y + c.height - 1);
        expect(Math.abs(p.x - c.x)).toBeLessThanOrEqual(2);
        expect(t.x).toBeGreaterThan(c.x + c.width);
        const legal = await box(page.locator('.footer-legal'));
        expect(Math.abs(t.y + t.height / 2 - (legal.y + legal.height / 2))).toBeLessThanOrEqual(3);
        // The page end: the button is shown and covers nothing of the row.
        const button = page.getByRole('button', { name: 'Back to top' });
        await expect(button).toBeVisible();
        const b = await box(button);
        expect(b.y).toBeGreaterThanOrEqual(r.y + r.height - 1);
        // Nothing of the footer's links or the row is under the button.
        const covered = await page.evaluate(() => {
          const rb = document.querySelector('[data-back-to-top]').getBoundingClientRect();
          return [
            ...document.querySelectorAll('.site-footer a, .site-footer button, .site-footer p'),
          ].filter((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.width &&
              r.left < rb.right &&
              r.right > rb.left &&
              r.top < rb.bottom &&
              r.bottom > rb.top
            );
          }).length;
        });
        expect(covered).toBe(0);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);
      });
    }
  }
});

// ---- item 7: the hero centred on large screens ------------------------------------------

test.describe('Home hero on large screens (item 7)', () => {
  for (const [width, height] of [
    [1280, 800],
    [1440, 900],
    [1680, 1050],
    [1920, 1080],
    [1920, 1100],
    [1440, 1000],
  ]) {
    test(`${width}×${height}: the text block is centred beside the figure`, async ({ page }) => {
      await openHome(page, { width, height });
      const m = await page.evaluate(() => {
        const r = (s) => document.querySelector(s).getBoundingClientRect().toJSON();
        const main = document.querySelector('.stage-main').getBoundingClientRect();
        return {
          hero: r('[data-stage-hero]'),
          main: main.toJSON(),
          cue: r('.stage-cue'),
          header: r('.site-header'),
        };
      });
      const above = m.hero.top - m.main.top;
      const below = m.main.bottom - m.hero.bottom;
      expect(Math.abs(above - below), 'free space above and below').toBeLessThanOrEqual(3);
      // Never closer to the header or to the scroll cue than before (the old text sat at the top of
      // the row, 40–80 px under the header).
      expect(m.hero.top).toBeGreaterThanOrEqual(m.header.bottom + 40);
      expect(m.cue.top - m.hero.bottom).toBeGreaterThanOrEqual(24);
    });
  }

  test('1024×768 (a tablet window): the hero stays at the top as before', async ({ page }) => {
    await openHome(page, { width: 1024, height: 768 });
    const m = await page.evaluate(() => ({
      hero: document.querySelector('[data-stage-hero]').getBoundingClientRect().top,
      main: document.querySelector('.stage-main').getBoundingClientRect().top,
    }));
    expect(Math.abs(m.hero - m.main)).toBeLessThanOrEqual(2);
  });
});
