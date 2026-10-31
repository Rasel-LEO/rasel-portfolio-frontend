// Author: Rasel Al Mamun
// Hire me and Contact forms (FD-38) and the email Copy button: validation,
// error wiring, the static-build status message, and the no-JS form.
import { expect, test } from '@playwright/test';
import { loadContent } from '../tools/content.mjs';

const { profile } = loadContent();

const forms = [
  {
    page: 'hire.html',
    prefix: 'hire',
    text: 'brief',
    select: 'kind',
    submit: 'Send the brief',
    subject: (value) => `Brief: ${value}`,
  },
  {
    page: 'contact.html',
    prefix: 'contact',
    text: 'message',
    select: 'subject',
    submit: 'Send',
    subject: (value) => value,
  },
];

for (const form of forms) {
  const id = (name) => `#${form.prefix}-${name}`;
  const required = ['name', 'email', form.text];

  test.describe(form.page, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/${form.page}`);
    });

    test('labels are visible and required fields say so in text', async ({ page }) => {
      for (const name of required) {
        const label = page.locator(`label[for="${form.prefix}-${name}"]`);
        await expect(label).toBeVisible();
        await expect(label).toContainText('(required)');
        await expect(page.locator(id(name))).toHaveAttribute('required', '');
      }
      await expect(page.locator(`label[for="${form.prefix}-organisation"]`)).toHaveText(
        'Organisation (optional)',
      );
      const element = page.locator('form[data-form]');
      await expect(element).toHaveAttribute('method', 'post');
      await expect(element).toHaveAttribute('novalidate', '');
      await expect(element).not.toHaveAttribute('action', /.*/);
      // FD-140: no field hint; the privacy notice under the form is the only privacy text.
      await expect(page.locator(`${id(form.text)}-hint`)).toHaveCount(0);
      await expect(page.locator(id(form.text))).not.toHaveAttribute('aria-describedby', /.*/);
    });

    test('an empty submit marks every required field and focuses the first', async ({ page }) => {
      await page.getByRole('button', { name: form.submit }).click();
      await expect(page).toHaveURL(new RegExp(`/${form.page}$`));
      await expect(page.locator(id('name'))).toBeFocused();

      for (const name of required) {
        const control = page.locator(id(name));
        const error = page.locator(`${id(name)}-error`);
        await expect(control).toHaveAttribute('aria-invalid', 'true');
        await expect(error).toBeVisible();
        await expect(error.locator('svg')).toHaveAttribute('aria-hidden', 'true');
        const describedBy = (await control.getAttribute('aria-describedby')).split(' ');
        expect(describedBy).toContain(`${form.prefix}-${name}-error`);
        await expect(control).toHaveAccessibleDescription(
          new RegExp((await error.innerText()).trim().replace(/[.]/g, '\\.')),
        );
      }
      // The text field is described by its error alone (no hint, FD-140).
      await expect(page.locator(id(form.text))).toHaveAttribute(
        'aria-describedby',
        `${form.prefix}-${form.text}-error`,
      );
      for (const name of ['organisation', form.select]) {
        await expect(page.locator(id(name))).not.toHaveAttribute('aria-invalid', /.*/);
      }
      await expect(page.locator('[data-form-status]')).toBeEmpty();
    });

    test('an incomplete email gets its own message', async ({ page }) => {
      await page.locator(id('name')).fill('Test Person');
      await page.locator(id('email')).fill('name@example');
      await page.getByRole('button', { name: form.submit }).click();
      await expect(page.locator(id('email'))).toBeFocused();
      await expect(page.locator(`${id('email')}-error`)).toHaveText(
        'Enter a complete email address, like name@example.com.',
      );
    });

    test('fixing a field clears its error, the others stay', async ({ page }) => {
      await page.getByRole('button', { name: form.submit }).click();
      await page.locator(id('name')).fill('Test Person');
      await expect(page.locator(id('name'))).not.toHaveAttribute('aria-invalid', /.*/);
      await expect(page.locator(`${id('name')}-error`)).toBeHidden();
      await expect(page.locator(id('name'))).not.toHaveAttribute('aria-describedby', /.*/);
      await expect(page.locator(id('email'))).toHaveAttribute('aria-invalid', 'true');

      await page.locator(id(form.text)).fill('Some text');
      await expect(page.locator(id(form.text))).not.toHaveAttribute('aria-describedby', /.*/);
    });

    test('a valid submit stays on the page and offers a mailto: link', async ({ page }) => {
      let posted = false;
      page.on('request', (request) => {
        if (request.method() === 'POST') posted = true;
      });
      const options = await page.locator(`${id(form.select)} option`).allTextContents();
      const choice = options.at(-1);
      await page.locator(id('name')).fill('Test Person');
      await page.locator(id('email')).fill('name@example.com');
      await page.locator(id(form.select)).selectOption(choice);
      await page.locator(id('organisation')).fill('Example Lab');
      await page.locator(id(form.text)).fill('Hello there');
      await page.getByRole('button', { name: form.submit }).click();

      const status = page.locator('[data-form-status]');
      await expect(status).toHaveAttribute('role', 'status');
      await expect(status).toHaveText(
        `Thanks — this form goes live with the full site. For now, please email me at ${profile.email}.`,
      );
      const href = await status.getByRole('link', { name: profile.email }).getAttribute('href');
      const url = new URL(href);
      expect(url.protocol).toBe('mailto:');
      expect(url.pathname).toBe(profile.email);
      expect(url.searchParams.get('subject')).toBe(form.subject(choice));
      const body = url.searchParams.get('body');
      expect(body).toContain('Hello there');
      expect(body).toContain('Test Person');
      expect(body).toContain('Example Lab');

      await expect(page).toHaveURL(new RegExp(`/${form.page}$`));
      await expect(page.locator(id('name'))).toHaveValue('Test Person');
      await expect(page.locator('[aria-invalid]')).toHaveCount(0);
      expect(posted).toBe(false);
    });

    test('Copy writes the email address and announces it', async ({ page, context, baseURL }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
      const status = page.locator('[data-copy-status]');
      await expect(status).toHaveAttribute('role', 'status');
      // Both live regions are in the accessibility tree before any text arrives.
      for (const region of [status, page.locator('[data-form-status]')]) {
        await expect(region).toBeEmpty();
        await expect(region).not.toHaveCSS('display', 'none');
      }
      await page.getByRole('button', { name: 'Copy email address' }).click();
      await expect(status).toHaveText('Email address copied');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(profile.email);
      await expect(page.locator('.email-text')).toHaveText(profile.email);
    });
  });

  test.describe(`${form.page} without JavaScript`, () => {
    test.use({ javaScriptEnabled: false });

    test('the form is labelled and complete; Copy is not offered', async ({ page }) => {
      await page.goto(`/${form.page}`);
      // FD-40: without JS the browser's own required/email checks stay on.
      await expect(page.locator('form[data-form]')).not.toHaveAttribute('novalidate', /.*/);
      for (const name of required) {
        await expect(page.locator(id(name))).toHaveAttribute('required', '');
      }
      for (const name of [...required, 'organisation', form.select]) {
        await expect(page.locator(id(name))).toBeVisible();
        await expect(page.locator(id(name))).toHaveAccessibleName(/.+/);
      }
      await expect(page.getByRole('button', { name: form.submit })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Copy email address' })).toBeHidden();
      await expect(page.locator('.email-text a')).toHaveAttribute(
        'href',
        `mailto:${profile.email}`,
      );
    });
  });
}

test('Contact lists the profile links and the audiences in order', async ({ page }) => {
  const content = loadContent();
  await page.goto('/contact.html');
  const aside = page.locator('aside.form-aside');
  const links = aside.locator('.profile-links .profile-link');
  await expect(links).toHaveCount(content.links.length);
  for (const [i, link] of content.links.entries()) {
    await expect(links.nth(i)).toHaveAttribute('href', link.url);
    await expect(links.nth(i)).toHaveAttribute('rel', /noopener/);
    // FD-118, FD-76: icon, new tab, said to screen readers.
    await expect(links.nth(i)).toHaveAttribute('target', '_blank');
    await expect(links.nth(i).locator('svg.footer-icon')).toHaveCount(1);
    await expect(links.nth(i)).toHaveAccessibleName(`${link.label} (opens in a new tab)`);
  }
  await expect(aside.locator('ol li')).toHaveText(content.contact.audiences);
});

// FD-118 (implements FD-79): no decorative photo on Contact; nothing of P6 is fetched.
test('Contact has no decorative photo at any width', async ({ page }) => {
  const fetched = [];
  page.on('request', (request) => {
    if (request.url().includes('/P6-')) fetched.push(request.url());
  });
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/contact.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main img, main figure')).toHaveCount(0);
  }
  expect(fetched).toEqual([]);
});

test('Hire me shows the services, steps and CV action from the data', async ({ page }) => {
  const { hire } = loadContent();
  await page.goto('/hire.html');
  const services = page.locator('.service');
  await expect(services).toHaveCount(hire.services.length);
  for (const [i, service] of hire.services.entries()) {
    const card = services.nth(i);
    await expect(card.locator('.service-number')).toHaveText(service.n);
    await expect(card.getByRole('heading', { level: 3 })).toHaveText(service.title);
    await expect(card.locator('.service-items li')).toHaveText(service.items);
    const evidence = card.getByRole('link', { name: service.evidence.label });
    const href = service.evidence.href.startsWith('https://')
      ? service.evidence.href
      : `/${service.evidence.href}`;
    await expect(evidence).toHaveAttribute('href', href);
  }
  await expect(page.locator('.step h3')).toHaveText(hire.process.map((step) => step.title));
  await expect(page.locator(`#hire-kind option`)).toHaveText(hire.form_kinds);
  // FD-117: in the head and in the aside.
  const cv = page.getByRole('link', { name: /Request CV|Download CV/ });
  await expect(cv).toHaveCount(2);
  for (const link of await cv.all()) {
    await expect(link).toHaveAttribute('href', /^mailto:.+\?subject=CV%20request$/);
  }
  await expect(page.getByRole('link', { name: 'See the portfolio first' })).toHaveAttribute(
    'href',
    '/portfolio.html',
  );
});

test('services are equal height in a row from 992 px and stacked below', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/hire.html');
  const boxes = await page
    .locator('.service')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
  expect(new Set(boxes.map((box) => Math.round(box.top))).size).toBe(1);
  expect(new Set(boxes.map((box) => Math.round(box.height))).size).toBe(1);

  await page.setViewportSize({ width: 768, height: 900 });
  const stacked = await page
    .locator('.service')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top));
  expect(stacked[1]).toBeGreaterThan(stacked[0]);
  expect(stacked[2]).toBeGreaterThan(stacked[1]);
});

// FD-140: the owner-approved privacy notice, from each page's content, as plain small text right
// under its form (not linked by aria-describedby: the existing hint pattern is per field).
for (const form of forms) {
  test(`${form.page}: the privacy notice sits under the form`, async ({ page }) => {
    await page.goto(`/${form.page}`);
    const content = loadContent();
    const text = content[form.prefix].privacy_notice;
    expect(text).toBe(content.contact.privacy_notice);
    expect(text).toContain('deleted from the site after 12 months');
    // 1.4.1 wording: the IP address is not stored with the message.
    expect(text).toContain(
      'Your IP address is not stored with your message, only a one-way code used to limit spam.',
    );
    expect(text).not.toContain('Your IP address is not stored, only');
    // The only privacy text on the page: the old field note is gone.
    expect(content.contact).not.toHaveProperty('privacy_note');
    await expect(page.locator('.field-hint')).toHaveCount(0);
    await expect(page.getByText('Your message goes only to me')).toHaveCount(0);
    const notice = page.locator('.form-notice');
    await expect(notice).toHaveCount(1);
    await expect(notice).toHaveText(text);
    await expect(notice).toBeVisible();
    const placement = await notice.evaluate((el) => ({
      afterForm: el.previousElementSibling?.matches('form[data-form]') ?? false,
      describes: [...document.querySelectorAll('[aria-describedby]')].some((node) =>
        node.getAttribute('aria-describedby').split(' ').includes(el.id),
      ),
      size: getComputedStyle(el).fontSize,
    }));
    expect(placement.afterForm).toBe(true);
    expect(placement.describes).toBe(false);
    expect(parseFloat(placement.size)).toBeLessThan(16);
  });
}
