// Author: Rasel Al Mamun
// Release 1.6.0, round 6 (FD-173 … FD-176): the hand-off glide of the stage figure into the
// back-to-top image, the Home Contact band's padding, the card beside the Contact and Hire me
// forms, and the Hire me header order.
import { expect, test } from './fixtures.js';

// ---- item 1: the hand-off glide (FD-173) --------------------------------------------------

// The most the visible image (the figure or the button's photo) may move per 1/60 s (16.7 ms),
// as its lower-right corner or its height. The snap this replaces was 833 px at 1440 × 900; the
// largest steps measured now are about 120 px, which is what the eased 320 ms glide needs at its
// fastest and what the scrubbed shrink itself does at its fastest (103 px).
// v1.7.2 (FD-180): the speed is measured per elapsed time, not per captured frame, on the clock
// the motion runs on: GSAP places the image from performance.now() at the start of its ticker
// callback, so each sample is timed by the start of the latest ticker callback before it
// (a test-only requestAnimationFrame wrapper; the page code is unchanged). On a busy runner a
// frame is skipped or a callback starts late, and one sample then holds more than one frame of
// movement. The speed is taken over each pair of consecutive intervals (samples i - 2 to i), which
// evens out the few milliseconds of start-time jitter; a snap still shows in full.
const STEP_LIMIT = 130;
const FRAME_MS = 1000 / 60;
// For the check to stay meaningful the motion must be sampled densely: at least MIN_MOVING
// windows in which the image moves, and none of them longer than MAX_WINDOW_FRAMES frames (the
// 833 px snap spread over 6 frames is still 139 px per 16.7 ms, above the limit).
const MIN_MOVING = 12;
const MAX_WINDOW_FRAMES = 6;

// Optional, for local proof runs only: GLIDE_CPU_THROTTLE=4 slows Chromium's CPU fourfold (CDP),
// as on a busy shared CI runner. Off by default and in CI.
const THROTTLE = Number(process.env.GLIDE_CPU_THROTTLE) || 0;

// Before the page's own scripts: note when GSAP's ticker callback starts on each frame, so a
// sample knows the time its picture was computed for. The ticker is the callback requested on
// every frame since load, so it is the one called most often (the cursor's own loop runs only
// while the pointer settles; the sampler is left out).
const FRAME_CLOCK = () => {
  const raf = window.requestAnimationFrame.bind(window);
  const calls = new Map();
  let ticker = null;
  let most = 0;
  window.__frameStart = 0;
  window.requestAnimationFrame = (callback) =>
    raf((time) => {
      if (!callback.__sampler) {
        const n = (calls.get(callback) ?? 0) + 1;
        calls.set(callback, n);
        if (n >= most) [most, ticker] = [n, callback];
        if (callback === ticker) window.__frameStart = performance.now();
      }
      return callback(time);
    });
};

// On every animation frame: which image is visible (the stage figure or the back-to-top photo),
// its lower-right corner and height, and whether the figure's frame is carried by the page.
const TRACKER = `(() => {
  const stage = document.querySelector('[data-stage]');
  const frame = stage.firstElementChild;
  const stickyTop = parseFloat(getComputedStyle(frame).top);
  const top = stage.getBoundingClientRect().top + window.scrollY;
  window.__end = top + stage.offsetHeight - window.innerHeight;
  window.__frames = [];
  const figure = document.querySelector('[data-stage-figure]');
  const button = document.querySelector('[data-back-to-top]');
  const sample = () => {
    const figureShown = getComputedStyle(figure).visibility !== 'hidden';
    const bs = getComputedStyle(button);
    const buttonShown = !button.hidden && bs.visibility !== 'hidden' && parseFloat(bs.opacity) > 0.05;
    const img = (figureShown ? figure : button).querySelector('img').getBoundingClientRect();
    window.__frames.push({
      t: window.__frameStart,
      y: window.scrollY,
      figureShown,
      buttonShown,
      carried: figureShown && Math.abs(frame.getBoundingClientRect().top - stickyTop) > 1.5,
      gliding: button.classList.contains('is-gliding'),
      right: img.right,
      bottom: img.bottom,
      height: img.height,
      opacity: figureShown ? parseFloat(getComputedStyle(figure).opacity) : parseFloat(bs.opacity),
    });
    if (!window.__stop) requestAnimationFrame(sample);
  };
  sample.__sampler = true;
  requestAnimationFrame(sample);
})()`;

async function openHome(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  if (THROTTLE > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  }
  await page.addInitScript(FRAME_CLOCK);
  await page.goto('/index.html');
  await expect(page.locator('[data-stage]')).toHaveAttribute('data-stage-mode', 'desktop');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.evaluate(TRACKER);
}

const moved = (a, b) =>
  Math.max(
    Math.abs(b.right - a.right),
    Math.abs(b.bottom - a.bottom),
    Math.abs(b.height - a.height),
  );

// The proof: exactly one image visible on every frame once the stage is on screen (never none,
// never two), never carried by the page, and the visible one never moves faster than STEP_LIMIT
// per 16.7 ms over two consecutive intervals, timed on the motion's own frame clock.
async function judge(page, upTo) {
  const { frames: all, end } = await page.evaluate(() => {
    window.__stop = true;
    return { frames: window.__frames, end: window.__end };
  });
  const frames = upTo ? all.slice(0, upTo) : all;
  let maxStep = 0;
  let worst = null;
  let moving = 0;
  let maxWindow = 0;
  const bad = [];
  frames.forEach((f, i) => {
    if (f.figureShown === f.buttonShown && f.y > 1) bad.push({ i, y: f.y, why: 'shown count' });
    if (f.carried) bad.push({ i, y: f.y, why: 'figure carried by the page' });
    if (i < 2) return;
    const from = frames[i - 2];
    const px = moved(from, f);
    if (px <= 0.5) return;
    const elapsed = f.t - from.t;
    if (!(elapsed > 0)) {
      bad.push({ i, y: f.y, px, why: `moved with no frame between (${elapsed} ms)` });
      return;
    }
    moving += 1;
    maxWindow = Math.max(maxWindow, elapsed / FRAME_MS);
    // px per 1/60 s over the time that really passed.
    const step = (px * FRAME_MS) / elapsed;
    if (step > maxStep) {
      maxStep = step;
      worst = { i, y: f.y, from: from.figureShown ? 'figure' : 'button', px, elapsed, step };
    }
  });
  const glideFrames = frames.filter((f) => f.gliding).length;
  return { frames, end, maxStep, worst, bad, glideFrames, moving, maxWindow };
}

// The judged motion was sampled densely enough for the per-time limit to catch a snap.
function expectDense({ moving, maxWindow }) {
  expect(moving, 'windows in which the image moves').toBeGreaterThanOrEqual(MIN_MOVING);
  expect(maxWindow, 'longest moving window, in 16.7 ms frames').toBeLessThanOrEqual(
    MAX_WINDOW_FRAMES,
  );
}

const report = (name, r) =>
  console.log(
    `${name}: ${r.frames.length} frames, ${r.moving} moving, longest window ` +
      `${r.maxWindow.toFixed(1)} frames, max ${r.maxStep.toFixed(1)} px / 16.7 ms`,
    r.worst,
  );

test.describe('hand-off glide (item 1, FD-173)', () => {
  test.describe.configure({ timeout: 90_000 });

  const wheelDown = async (page, delta, pause) => {
    await page.mouse.move(700, 450);
    const reach = await page.evaluate(() => window.__end + innerHeight * 1.5 - window.scrollY);
    for (let i = 0; i < Math.ceil(reach / delta); i += 1) {
      await page.mouse.wheel(0, delta);
      await page.waitForTimeout(pause);
    }
  };
  const wheelUp = async (page, delta, pause) => {
    for (let i = 0; i < 60; i += 1) {
      await page.mouse.wheel(0, -delta);
      await page.waitForTimeout(pause);
    }
  };

  for (const [kind, delta, pause] of [
    ['slow', 60, 30],
    ['fast', 700, 16],
  ]) {
    test(`${kind} wheel down and back up: one image, no snap`, async ({ page }) => {
      await openHome(page);
      await wheelDown(page, delta, pause);
      await page.waitForTimeout(1200);
      // Going back up through a fast wheel is the scrubbed animation itself, unchanged from
      // v1.5.1 (its own large steps); the glide is proven by the flick test below.
      const mark = await page.evaluate(() => window.__frames.length);
      await wheelUp(page, delta, pause);
      await page.waitForTimeout(1200);
      const r = await judge(page, mark);
      report(kind, r);
      if (kind === 'fast') expect(r.glideFrames, 'frames of the glide').toBeGreaterThan(8);
      expectDense(r);
      expect(r.bad).toEqual([]);
      expect(r.maxStep, `fastest movement per 16.7 ms: ${JSON.stringify(r.worst)}`).toBeLessThan(
        STEP_LIMIT,
      );
    });
  }

  test('End key and Home key: one image, no snap', async ({ page }) => {
    await openHome(page);
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('PageDown');
      await page.waitForTimeout(300);
    }
    await page.keyboard.press('End');
    await page.waitForTimeout(1500);
    // Home takes the scrubbed animation back up as v1.5.1 does (its own large steps); the End
    // jump before it is what is judged.
    const mark = await page.evaluate(() => window.__frames.length);
    await page.keyboard.press('Home');
    await page.waitForTimeout(1500);
    const r = await judge(page, mark);
    report('keys', r);
    expect(r.glideFrames, 'frames of the glide').toBeGreaterThan(8);
    expectDense(r);
    expect(r.bad).toEqual([]);
    expect(r.maxStep, `fastest movement per 16.7 ms: ${JSON.stringify(r.worst)}`).toBeLessThan(
      STEP_LIMIT,
    );
  });

  test('a flick down and straight back up: the glide out, then the glide in', async ({ page }) => {
    await openHome(page);
    await page.mouse.move(700, 450);
    for (let i = 0; i < 6; i += 1) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(120);
    for (let i = 0; i < 4; i += 1) {
      await page.mouse.wheel(0, -500);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(1500);
    const r = await judge(page);
    report('flick', r);
    expect(r.glideFrames, 'frames of the glide').toBeGreaterThan(8);
    expectDense(r);
    expect(r.bad).toEqual([]);
    expect(r.maxStep, `fastest movement per 16.7 ms: ${JSON.stringify(r.worst)}`).toBeLessThan(
      STEP_LIMIT,
    );
  });
});

// ---- item 2: the Home Contact band (FD-174) -----------------------------------------------

const box = (locator) => locator.boundingBox();

test.describe('Home Contact band padding (item 2, FD-174)', () => {
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
    [768, 1024],
    [390, 844],
  ]) {
    test(`${width}: CONTACT starts as far below the band's top as the other eyebrows`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/index.html');
      await page.evaluate(() => document.fonts.ready);
      const offset = (selector) =>
        page.evaluate((sel) => {
          const section = document.querySelector(sel);
          return (
            section.querySelector('.eyebrow').getBoundingClientRect().top -
            section.getBoundingClientRect().top
          );
        }, selector);
      const others = [
        await offset('[data-home="selected"]'),
        await offset('[data-home="publications"]'),
      ];
      const contact = await offset('[data-home="contact"]');
      for (const other of others) expect(Math.abs(contact - other)).toBeLessThanOrEqual(4);
      if (width >= 768) {
        // The band stays medium: shorter than before (480 px at 1440), taller than its content.
        const band = await box(page.locator('[data-home="contact"]'));
        expect(band.height).toBeGreaterThan(260);
        expect(band.height).toBeLessThan(width >= 1440 ? 420 : 380);
        // The figure keeps its place beside the text: its feet (2.2 % of its height above the
        // picture's lower edge) are level with the text block's bottom.
        const img = await box(page.locator('[data-contact-figure] img'));
        const button = await box(page.locator('[data-home="contact"] .btn'));
        const feet = img.y + img.height * (1 - 0.022);
        expect(Math.abs(feet - (button.y + button.height))).toBeLessThanOrEqual(16);
      }
    });
  }
});

// ---- item 3: the card level with the form, no visible label (FD-175) ------------------------

test.describe('card beside the form (item 3, FD-175)', () => {
  for (const [name, path, field] of [
    ['Contact', '/contact.html', '#contact-name'],
    ['Hire me', '/hire.html', '#hire-name'],
  ]) {
    for (const width of [1440, 1024]) {
      test(`${name} at ${width}: "Response time" level with "Name"; no visible label`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);
        const card = page.locator('.expect-box');
        await expect(card.locator('dt').first()).toHaveText('Response time');
        // No visible "What to expect"; screen readers still get the card's name.
        const hidden = await box(page.getByText('What to expect', { exact: true }));
        expect(hidden.width, 'visually hidden: clipped to 1 px').toBeLessThanOrEqual(1);
        await expect(card.getByRole('heading', { name: 'What to expect' })).toHaveCount(1);
        const label = await box(page.locator(`label[for="${field.slice(1)}"]`));
        const first = await box(card.locator('dt').first());
        const border = await box(card);
        expect(Math.abs(first.y - label.y), 'first lines level').toBeLessThanOrEqual(1.5);
        // The border starts above the first line by the card's own padding (16 px) and border.
        expect(Math.abs(first.y - border.y - 17)).toBeLessThanOrEqual(1.5);
      });
    }

    test(`${name} at 390: the card stays below the form`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(path);
      const form = await box(page.locator('form.site-form'));
      const card = await box(page.locator('.expect-box'));
      expect(card.y).toBeGreaterThan(form.y + form.height);
    });
  }
});

// ---- item 4: the Hire me header order (FD-176) ----------------------------------------------

test.describe('Hire me header (item 4, FD-176)', () => {
  const parts = async (page) => ({
    eyebrow: await box(page.locator('.hire-head .eyebrow')),
    line: await box(page.locator('.hire-head .availability')),
    title: await box(page.locator('.hire-head h1')),
    button: await box(page.locator('.hire-head').getByRole('link', { name: 'Start a brief' })),
  });

  for (const width of [1440, 1024]) {
    test(`${width}: HIRE ME, the availability line, then the title with the button on its right`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/hire.html');
      await page.evaluate(() => document.fonts.ready);
      const { eyebrow, line, title, button } = await parts(page);
      expect(line.y).toBeGreaterThan(eyebrow.y + eyebrow.height - 1);
      expect(title.y).toBeGreaterThan(line.y + line.height - 1);
      expect(button.x).toBeGreaterThan(title.x + title.width);
      const centre = (b) => b.y + b.height / 2;
      expect(Math.abs(centre(button) - centre(title))).toBeLessThanOrEqual(3);
      // The line is small and muted: smaller than the 18 px body-large it was.
      const size = await page
        .locator('.hire-head .availability')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size).toBeLessThan(16);
    });
  }

  for (const width of [768, 390]) {
    test(`${width}: the same order; the button never above the title`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/hire.html');
      await page.evaluate(() => document.fonts.ready);
      const { eyebrow, line, title, button } = await parts(page);
      expect(line.y).toBeGreaterThan(eyebrow.y);
      expect(title.y).toBeGreaterThan(line.y);
      expect(button.y + button.height).toBeGreaterThan(title.y + title.height - 1);
      if (width === 390) expect(button.y).toBeGreaterThan(title.y + title.height - 1);
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scroll).toBeLessThanOrEqual(width);
    });
  }
});
