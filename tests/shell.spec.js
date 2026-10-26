// Author: Rasel Al Mamun
// Shared shell: skip link, header, drawer, theme, back-to-top, aria-current.
import { expect, test } from '@playwright/test';
import { loadContent } from '../tools/content.mjs';
import { templatePages as pages, widths } from './pages.js';

const content = loadContent();

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

// Which link each page marks as current (vite.config.js pageNav).
const current = {
  'index.html': ['/index.html', 'page'],
  'portfolio.html': ['/portfolio.html', 'page'],
  'portfolio-entry.html': ['/portfolio.html', 'true'],
  'publications.html': ['/portfolio.html', 'true'],
  'research.html': ['/portfolio.html', 'true'],
  'blog.html': ['/blog.html', 'page'],
  'blog-post.html': ['/blog.html', 'true'],
  'hire.html': ['/hire.html', 'page'],
  'contact.html': ['/contact.html', 'page'],
  '404.html': [null, null],
};

const activeInside = (page, selector) =>
  page.evaluate((sel) => document.querySelector(sel).contains(document.activeElement), selector);

// A spacer before the footer makes short pages scroll.
async function addSpacer(page) {
  await page.evaluate(() => {
    const spacer = document.createElement('div');
    spacer.style.height = '300vh';
    document.querySelector('main').append(spacer);
  });
}

for (const size of [PHONE, DESKTOP]) {
  test.describe(`at ${size.width}px`, () => {
    test.use({ viewport: size });

    test('first Tab focuses the skip link, which moves focus to #main', async ({ page }) => {
      await page.goto('/blog.html');
      await page.keyboard.press('Tab');
      await expect(page.locator('.skip-link')).toBeFocused();
      await expect(page.locator('.skip-link')).toBeInViewport();
      await page.keyboard.press('Enter');
      await expect(page.locator('#main')).toBeFocused();
    });

    test('header shows the layout of its breakpoint', async ({ page }) => {
      await page.goto('/portfolio.html');
      const nav = page.getByRole('navigation', { name: 'Primary' });
      const hire = page.locator('.site-header .hire-cta');
      const menu = page.locator('[data-menu-button]');
      await expect(hire).toBeVisible();
      if (size.width >= 992) {
        await expect(nav).toBeVisible();
        await expect(menu).toBeHidden();
      } else {
        await expect(nav).toBeHidden();
        await expect(menu).toBeVisible();
      }
    });

    test('theme switch persists across reload and pages', async ({ page }) => {
      await page.goto('/blog.html');
      const html = page.locator('html');
      const header = page.locator('.site-header [data-theme-toggle]');
      const footer = page.locator('.site-footer [data-theme-toggle]');
      await expect(html).not.toHaveAttribute('data-theme', 'light');
      await expect(header).toHaveAttribute('aria-label', 'Theme: dark');

      await footer.click();
      await expect(html).toHaveAttribute('data-theme', 'light');
      for (const button of await page.locator('[data-theme-toggle]').all()) {
        await expect(button).toHaveAttribute('aria-label', 'Theme: light');
        await expect(button).not.toHaveAttribute('aria-pressed');
      }

      await page.reload();
      await expect(html).toHaveAttribute('data-theme', 'light');
      await page.goto('/contact.html');
      await expect(html).toHaveAttribute('data-theme', 'light');
      for (const button of await page.locator('[data-theme-toggle]').all()) {
        await expect(button).toHaveAttribute('aria-label', 'Theme: light');
        await expect(button).not.toHaveAttribute('aria-pressed');
      }

      await page.locator('.site-footer [data-theme-toggle]').click();
      await expect(html).toHaveAttribute('data-theme', 'dark');
      for (const button of await page.locator('[data-theme-toggle]').all()) {
        await expect(button).toHaveAttribute('aria-label', 'Theme: dark');
      }
    });
  });
}

test.describe('header at 320px', () => {
  test.use({ viewport: { width: 320, height: 640 } });

  test('has no overflow and keeps "Hire me" on one line', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => document.fonts.ready);
    const bar = page.locator('.site-header-bar');
    const overflow = await bar.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const hire = page.locator('.site-header .hire-cta');
    await expect(hire).toBeVisible();
    const box = await hire.boundingBox();
    expect(box.height).toBeLessThanOrEqual(44);
    const right = await hire.evaluate((el) => el.getBoundingClientRect().right);
    expect(right).toBeLessThanOrEqual(320);
    // Brand text and theme button live in the drawer below 380 px; the link keeps its name.
    await expect(page.locator('.site-header [data-theme-toggle]')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Rasel Al Mamun' })).toBeVisible();
  });
});

test.describe('drawer at 390px', () => {
  test.use({ viewport: PHONE });

  test('opens, traps focus, closes on Escape and returns focus', async ({ page }) => {
    await page.goto('/blog.html');
    const menu = page.locator('[data-menu-button]');
    const drawer = page.getByRole('dialog', { name: 'Menu' });

    await menu.click();
    await expect(drawer).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(drawer).toHaveAttribute('aria-modal', 'true');
    await expect.poll(() => activeInside(page, '#drawer')).toBe(true);

    const focusable = await drawer.locator('a, button').count();
    for (let i = 0; i < focusable + 2; i += 1) {
      await page.keyboard.press('Tab');
      expect(await activeInside(page, '#drawer')).toBe(true);
    }
    for (let i = 0; i < 2; i += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await activeInside(page, '#drawer')).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toBeFocused();
  });

  test('closes with the close button and when resized to lg', async ({ page }) => {
    await page.goto('/index.html');
    const menu = page.locator('[data-menu-button]');
    const drawer = page.getByRole('dialog', { name: 'Menu' });

    await menu.click();
    await expect(drawer).toBeVisible();
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(drawer).toBeHidden();
    await expect(menu).toBeFocused();

    await menu.click();
    await expect(drawer).toBeVisible();
    await page.setViewportSize(DESKTOP);
    await expect(drawer).toBeHidden();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
  });
});

test('theme-init.js is the first element in <head>', async ({ page }) => {
  await page.goto('/index.html');
  const first = await page.evaluate(() => {
    const el = document.head.firstElementChild;
    return { tag: el.tagName, src: el.getAttribute('src'), type: el.getAttribute('type') };
  });
  expect(first).toEqual({ tag: 'SCRIPT', src: '/js/theme-init.js', type: null });
});

test('a stored light theme applies before the bundle runs (no flash)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  // Without main.js only theme-init.js can have set the theme.
  await page.route('**/assets/*.js', (route) => route.abort());
  await page.goto('/blog.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveClass(/\bjs\b/);
});

test('the theme cookie alone also restores the choice', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'theme', value: 'light', url: baseURL }]);
  await page.goto('/hire.html');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('no motion control exists anywhere', async ({ page }) => {
  for (const name of pages) {
    await page.goto(`/${name}`);
    await expect(page.locator('button', { hasText: /motion/i })).toHaveCount(0);
    await expect(page.locator('[aria-label*="otion" i], [data-action="motion"]')).toHaveCount(0);
  }
});

for (const name of pages) {
  test(`${name} marks the current navigation item`, async ({ page }) => {
    await page.goto(`/${name}`);
    const [href, value] = current[name];
    // Site navigation only; the Portfolio index marks its own item (portfolio.spec.js).
    const marked = page.locator(
      '.site-header [aria-current], #drawer [aria-current], .site-footer [aria-current]',
    );
    if (!href) {
      await expect(marked).toHaveCount(0);
      return;
    }
    const hrefs = await marked.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
    expect(new Set(hrefs)).toEqual(new Set([href]));
    for (const el of await marked.all()) await expect(el).toHaveAttribute('aria-current', value);
  });
}

test.describe('back to top', () => {
  for (const name of pages) {
    for (const width of widths) {
      test(`${name} at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/${name}`);
        const button = page.getByRole('button', { name: 'Back to top' });
        await expect(button).toBeHidden();
        await expect(page.locator('[data-back-to-top]')).toHaveAttribute('hidden', '');

        await addSpacer(page);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await expect(button).toBeVisible();
        await expect(button).toHaveClass(/\bis-on\b/);
        await expect(button).toHaveCSS('opacity', '0.7');

        const size = await button.boundingBox();
        expect([size.width, size.height]).toEqual(width >= 768 ? [110, 140] : [76, 96]);
        // The photo fills the box's height, seated in its lower-right corner (never at
        // its natural 720 × 1300 px).
        const photo = page.locator('[data-back-to-top] img');
        await expect
          .poll(() => photo.evaluate((img) => img.complete && img.naturalWidth))
          .toBeTruthy();
        const box = await photo.boundingBox();
        expect(Math.round(box.height)).toBe(size.height);
        expect(Math.round(box.x + box.width)).toBe(Math.round(size.x + size.width));
        expect(box.width).toBeLessThanOrEqual(size.width);

        // At the bottom of the page the button never covers a footer control.
        const overlaps = await button.evaluate((btn) => {
          const b = btn.getBoundingClientRect();
          return [...document.querySelectorAll('.site-footer a, .site-footer button')]
            .map((el) => el.getBoundingClientRect())
            .filter(
              (r) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top,
            ).length;
        });
        expect(overlaps).toBe(0);

        await button.click();
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
        await expect(page.locator('[data-brand]')).toBeFocused();
        await expect(button).toBeHidden();
      });
    }
  }

  test('scrolls instantly with prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(DESKTOP);
    await page.goto('/blog.html');
    await addSpacer(page);
    await page.evaluate(() => window.scrollTo(0, 2000));
    const button = page.getByRole('button', { name: 'Back to top' });
    await expect(button).toBeVisible();
    await button.click();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  // FD-70: up to 1.5 viewports it scrolls smoothly (at most 600 ms); further, the page fades
  // out, jumps and fades in, so nothing on the way plays backwards.
  test('scrolls smoothly within 1.5 viewports, in at most 600 ms', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/blog.html');
    await addSpacer(page);
    await page.evaluate(() => window.scrollTo(0, 1300));
    const button = page.getByRole('button', { name: 'Back to top' });
    await expect(button).toBeVisible();
    const start = Date.now();
    await button.click();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(page.locator('html')).not.toHaveClass(/is-jumping/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    // The click round trip and the poll interval are in this, so allow some margin.
    expect(Date.now() - start).toBeLessThan(1200);
  });

  test('fades, jumps and fades in beyond 1.5 viewports (FD-70)', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/blog.html');
    await addSpacer(page);
    await page.evaluate(() => window.scrollTo(0, 2000));
    const button = page.getByRole('button', { name: 'Back to top' });
    await expect(button).toBeVisible();
    // Every animation frame: the scroll position and the content's opacity.
    await page.evaluate(() => {
      window.__frames = [];
      const sample = () => {
        window.__frames.push([
          window.scrollY,
          parseFloat(getComputedStyle(document.querySelector('main')).opacity),
        ]);
        if (window.__frames.length < 60) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    await button.click();
    await expect.poll(() => page.evaluate(() => window.__frames.length)).toBe(60);
    const frames = await page.evaluate(() => window.__frames);
    // No frame between the two ends of the jump: the page goes from 2000 to 0 at once, and
    // only while the content is hidden.
    expect(frames.filter(([y]) => y > 0 && y < 2000)).toEqual([]);
    const jump = frames.findIndex(([y]) => y === 0);
    expect(jump).toBeGreaterThan(0);
    expect(frames[jump][1]).toBeLessThan(0.05);
    expect(frames[jump - 1][1]).toBeLessThan(0.05);
    expect(frames.at(-1)[1]).toBe(1);
    await expect(page.locator('[data-brand]')).toBeFocused();
  });
});

test.describe('focus is never dropped to <body>', () => {
  test('back-to-top hiding while focused moves focus to the brand', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/blog.html');
    await addSpacer(page);
    await page.evaluate(() => window.scrollTo(0, 2000));
    const button = page.getByRole('button', { name: 'Back to top' });
    await expect(button).toBeVisible();
    await button.focus();
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(button).toBeHidden();
    await expect(page.locator('[data-brand]')).toBeFocused();
  });

  test('a same-page anchor in the drawer closes it', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/portfolio.html');
    await page.locator('[data-menu-button]').click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    // The drawer has no same-page link of its own; add one as a visitor's
    // page might (drawer.js closes on any link).
    await drawer.locator('nav ul').evaluate((list) => {
      list.insertAdjacentHTML('beforeend', '<li><a href="#research">Research</a></li>');
    });
    await drawer.getByRole('link', { name: 'Research', exact: true }).click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/#research$/);
  });

  test('the drawer shows the wordmark and the CV action', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/blog.html');
    await page.locator('[data-menu-button]').click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer.locator('.drawer-title')).toContainText('Rasel Al Mamun');
    await expect(drawer.getByRole('link', { name: 'Request CV' })).toHaveAttribute(
      'href',
      'mailto:mr.raselalmamun@gmail.com?subject=CV%20request',
    );
  });

  test('closing the drawer by resizing to lg focuses the brand', async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/index.html');
    await page.locator('[data-menu-button]').click();
    await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
    await page.setViewportSize(DESKTOP);
    await expect(page.locator('[data-brand]')).toBeFocused();
  });
});

// FD-94: the footer, the same on every page.
test.describe('footer (FD-94)', () => {
  for (const name of pages) {
    test(`${name}: brand, three groups, external links, copyright and Theme`, async ({ page }) => {
      await page.goto(`/${name}`);
      const footer = page.getByRole('contentinfo');
      await expect(footer.locator('.footer-name')).toHaveText(content.profile.name);
      await expect(footer.locator('.footer-role')).toHaveText(content.footer.role_line);
      await expect(footer.locator('.footer-affiliation span')).toHaveText([
        'Farm Power and Machinery',
        content.profile.institution,
      ]);
      const email = footer.getByRole('link', { name: content.profile.email });
      await expect(email).toHaveAttribute('href', `mailto:${content.profile.email}`);
      await expect(email.locator('svg')).toHaveAttribute('aria-hidden', 'true');

      const { groups } = content.footer;
      const explore = footer.getByRole('navigation', { name: groups.explore });
      await expect(explore.getByRole('link')).toHaveText([
        'Portfolio',
        'Blog',
        'Hire me',
        'Contact',
      ]);
      const hrefs = ['/portfolio.html', '/blog.html', '/hire.html', '/contact.html'];
      for (const [i, href] of hrefs.entries()) {
        await expect(explore.getByRole('link').nth(i)).toHaveAttribute('href', href);
      }
      for (const [group, ids] of [
        [groups.research, content.footer.research_profiles],
        [groups.connect, content.footer.connect_profiles],
      ]) {
        const links = footer.getByRole('navigation', { name: group }).getByRole('link');
        await expect(links).toHaveCount(ids.length);
        for (const [i, id] of ids.entries()) {
          const data = content.links.find((link) => link.id === id);
          const link = links.nth(i);
          await expect(link).toHaveAttribute('href', data.url);
          await expect(link).toHaveAttribute('target', '_blank');
          await expect(link).toHaveAttribute('rel', /\bnoopener\b.*\bnoreferrer\b/);
          await expect(link).toHaveAccessibleName(`${data.label} (opens in a new tab)`);
          // Its icon and the ↗, both decorative.
          await expect(link.locator('svg[aria-hidden="true"]')).toHaveCount(2);
        }
      }
      // LinkedIn and GitHub: the official marks, filled in the text colour.
      const marks = await footer
        .locator('.footer-mark')
        .evaluateAll((els) =>
          els.map((el) => [getComputedStyle(el).fill, getComputedStyle(el).color]),
        );
      expect(marks).toHaveLength(2);
      for (const [fill, color] of marks) expect(fill).toBe(color);

      await expect(footer.locator('.footer-copyright')).toHaveText(
        `© ${new Date().getFullYear()} ${content.footer.copyright_name}`,
      );
      // The Theme button works.
      const before = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
      await footer.getByRole('button', { name: /^Theme/ }).click();
      await expect(page.locator('html')).toHaveAttribute(
        'data-theme',
        before === 'light' ? 'dark' : 'light',
      );
    });
  }

  test('desktop: four columns, then the rule with the copyright and Theme', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/blog.html');
    const tops = await page
      .locator('.footer-name, #footer-explore, #footer-research, #footer-connect')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    for (let i = 1; i < tops.length; i += 1) {
      expect(tops[i].left).toBeGreaterThan(tops[i - 1].left);
      expect(Math.abs(tops[i].top - tops[1].top)).toBeLessThanOrEqual(1);
    }
    const bottom = await page.locator('.site-footer-bottom').evaluate((el) => ({
      border: getComputedStyle(el).borderTopWidth,
      top: el.getBoundingClientRect().top,
    }));
    const main = await page
      .locator('.site-footer-main')
      .evaluate((el) => el.getBoundingClientRect().toJSON());
    expect(bottom.border).toBe('1px');
    expect(bottom.top).toBeGreaterThanOrEqual(main.bottom);
  });

  for (const size of [DESKTOP, PHONE]) {
    test(`screenshot at ${size.width}px (dark)`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto('/blog.html');
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(600);
      await page.screenshot({ path: `tests/screenshots/shell/footer-${size.width}-dark.png` });
    });
  }
});

// FD-104 (supersedes FD-95's tucking): the one back-to-top portrait is visible and clickable
// after the first screen on every page — over the Contact band and the footer too; at the page
// end the footer's bottom row keeps its box free, so no footer link or text lies under it.
test.describe('back-to-top portrait (FD-104)', () => {
  const state = (page) =>
    page.locator('[data-back-to-top]').evaluate((btn) => {
      const b = btn.getBoundingClientRect();
      const cs = getComputedStyle(btn);
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height * 0.6);
      const covered = [...document.querySelectorAll('.site-footer :is(a, button, p, svg)')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.width && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top
          );
        })
        .map((el) => el.className.baseVal ?? el.className);
      const figure = document.querySelector('[data-contact-figure]')?.getBoundingClientRect();
      const portrait =
        !!figure && figure.bottom > 0 && figure.top < window.innerHeight && figure.height > 0;
      return {
        shown: !btn.hidden && parseFloat(cs.opacity) >= 0.7 && cs.visibility === 'visible',
        clickable: cs.pointerEvents !== 'none' && !!hit && btn.contains(hit),
        covered,
        portrait,
        text: btn.textContent.trim(),
      };
    });

  test('one control: the small photo, named "Back to top", no visible text', async ({ page }) => {
    await page.goto('/blog.html');
    const button = page.locator('[data-back-to-top]');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveAttribute('aria-label', 'Back to top');
    expect((await state(page)).text).toBe('');
    await expect(
      page.locator('main [data-back-to-top], .site-footer [data-back-to-top]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-back-to-top] img')).toHaveAttribute('alt', '');
  });

  for (const size of [DESKTOP, PHONE]) {
    test(`FD-104: Home — visible and clickable with the Contact band in view (${size.width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await page.goto('/index.html');
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() =>
        document
          .querySelector('[data-home="contact"]')
          .scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
      const button = page.locator('[data-back-to-top]');
      await expect(button).toBeVisible();
      // (At 1440 px the stage's scrub, 0.8 s, hands the portrait over first, FD-97.)
      await expect
        .poll(async () => {
          const s = await state(page);
          return [s.portrait, s.shown, s.clickable];
        })
        .toEqual([true, true, true]);
      if (size === DESKTOP) {
        // After the page's entry wipe (FD-81).
        await page.waitForTimeout(800);
        await page.screenshot({ path: 'tests/screenshots/shell/contact-band-1440-dark.png' });
      }
      await button.click();
      await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBe(0);
    });

    // Also the two "View all" pages (FD-109).
    const ends = ['index.html', 'portfolio.html', 'publications.html', 'research.html'];
    for (const file of [...ends, 'blog.html', 'hire.html', 'contact.html']) {
      test(`FD-104: ${file} page end — visible, clickable, no footer content under it (${size.width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize(size);
        await page.goto(`/${file}`);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() =>
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
        );
        // "After the first screen" (DD-17): a page that scrolls less than one screen never
        // shows it.
        const short = await page.evaluate(
          () => document.documentElement.scrollHeight - window.innerHeight < window.innerHeight,
        );
        if (short) {
          await page.waitForTimeout(300);
          await expect(page.locator('[data-back-to-top]')).toBeHidden();
          return;
        }
        await expect(page.locator('[data-back-to-top]')).toBeVisible();
        await page.waitForTimeout(1000);
        const s = await state(page);
        expect([s.shown, s.clickable]).toEqual([true, true]);
        expect(s.covered).toEqual([]);
        if (file === 'index.html' && size === DESKTOP) {
          await page.screenshot({ path: 'tests/screenshots/shell/footer-1440-dark.png' });
        }
      });
    }
  }

  test('FD-104: while scrolling through the footer it stays shown and clickable (390px)', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await page.goto('/portfolio.html');
    await page.evaluate(() => document.fonts.ready);
    const { from, to } = await page.evaluate(() => ({
      from:
        document.querySelector('.site-footer').getBoundingClientRect().top +
        window.scrollY -
        window.innerHeight,
      to: document.documentElement.scrollHeight - window.innerHeight,
    }));
    for (let y = Math.max(0, from); y <= to; y += 80) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      const s = await state(page);
      expect([s.shown, s.clickable], `at ${y}`).toEqual([true, true]);
    }
    // No space reserved under the footer beyond the button's own inset.
    const pad = await page
      .locator('.site-footer')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    expect(pad).toBe(24);
  });

  test('keyboard: reachable after the footer, shown when focused, Enter goes to the top', async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/index.html');
    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }),
    );
    await page.waitForTimeout(1200);
    await page.locator('.site-footer [data-theme-toggle]').focus();
    await page.keyboard.press('Tab');
    const button = page.getByRole('button', { name: 'Back to top' });
    await expect(button).toBeFocused();
    await expect(button).toHaveCSS('opacity', '1');
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 }).toBe(0);
    await expect(page.locator('[data-brand]')).toBeFocused();
  });
});
