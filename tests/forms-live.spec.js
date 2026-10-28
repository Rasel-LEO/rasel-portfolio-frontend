// Author: Rasel Al Mamun
// Live form mode (FD-135): the built pages with an action added, as the Django templates
// render them. The variant is made in the browser by request interception, so nothing
// test-only is built into dist/ or served by the preview server.
import { expect, test } from '@playwright/test';

const forms = [
  {
    page: 'hire.html',
    prefix: 'hire',
    text: 'brief',
    select: 'kind',
    submit: 'Send the brief',
    action: '/hire/send/',
  },
  {
    page: 'contact.html',
    prefix: 'contact',
    text: 'message',
    select: 'subject',
    submit: 'Send',
    action: '/contact/send/',
  },
];

const errorStatus = 'Please correct the errors below.';
const emailError = 'Enter a valid email address.';

// The page with its form given an action, optionally with server-rendered state.
async function serveLive(page, form, edit = (html) => html) {
  await page.route(`**/${form.page}`, async (route) => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/<form\b/, `<form action="${form.action}"`);
    await route.fulfill({ response, body: edit(html) });
  });
}

// The server's re-render after an invalid post: email marked invalid, error status.
function serverErrors(form, status = errorStatus) {
  const email = `${form.prefix}-email`;
  return (html) =>
    html
      .replace(
        `id="${email}" name="email"`,
        `id="${email}" name="email" value="name@example" aria-invalid="true" aria-describedby="${email}-error"`,
      )
      .replace(
        new RegExp(`(id="${email}-error") hidden>(.*?)<span data-error-text></span>`),
        `$1>$2<span data-error-text>${emailError}</span>`,
      )
      .replace('data-form-status></p>', `data-form-status>${status}</p>`);
}

for (const form of forms) {
  const id = (name) => `#${form.prefix}-${name}`;

  async function fillValid(page) {
    await page.locator(id('name')).fill('Test Person');
    await page.locator(id('email')).fill('name@example.com');
    await page.locator(id('organisation')).fill('Example Lab');
    await page.locator(id(form.text)).fill('Hello there');
  }

  test.describe(`${form.page} live`, () => {
    test('an invalid submit stays on the page with the inline errors', async ({ page }) => {
      await serveLive(page, form);
      let posted = false;
      page.on('request', (request) => {
        if (request.method() === 'POST') posted = true;
      });
      await page.goto(`/${form.page}`);
      await expect(page.locator('form[data-form]')).toHaveAttribute('action', form.action);

      await page.locator(id('email')).fill('name@example');
      await page.getByRole('button', { name: form.submit }).click();
      await expect(page).toHaveURL(new RegExp(`/${form.page}$`));
      await expect(page.locator(id('name'))).toBeFocused();
      for (const name of ['name', 'email', form.text]) {
        await expect(page.locator(id(name))).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator(`${id(name)}-error`)).toBeVisible();
      }
      await expect(page.locator('[data-form-status]')).toBeEmpty();
      await expect(page.getByRole('button', { name: form.submit })).toBeEnabled();
      expect(posted).toBe(false);
    });

    test('a valid submit posts the form once and disables the button', async ({ page }) => {
      await serveLive(page, form);
      const posts = [];
      // 204 No Content: the browser stays on the page, as it was when the post left.
      await page.route(`**${form.action}`, async (route) => {
        posts.push(route.request());
        await route.fulfill({ status: 204 });
      });
      await page.goto(`/${form.page}`);
      const options = await page.locator(`${id(form.select)} option`).allTextContents();
      const choice = options.at(-1);
      await fillValid(page);
      await page.locator(id(form.select)).selectOption(choice);

      // Clicked in the page: after a 204 the cancelled navigation keeps Playwright's
      // locators waiting, so the state after the post is read with page.evaluate.
      await page.getByRole('button', { name: form.submit }).evaluate((button) => button.click());
      await expect.poll(() => posts.length).toBe(1);
      const state = () =>
        page.evaluate(() => {
          const button = document.querySelector('form[data-form] [type="submit"]');
          return {
            url: location.pathname,
            disabled: button.disabled,
            ariaDisabled: button.getAttribute('aria-disabled'),
            status: document.querySelector('[data-form-status]').textContent,
            mailto: document.querySelectorAll('a[href^="mailto:"][href*="body="]').length,
          };
        });
      expect(await state()).toEqual({
        url: `/${form.page}`,
        disabled: true,
        ariaDisabled: 'true',
        status: '',
        mailto: 0,
      });
      // A second activation (Enter in a field) sends nothing more.
      await page.evaluate((selector) => document.querySelector(selector).focus(), id('name'));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      expect(posts).toHaveLength(1);

      const request = posts[0];
      expect(request.method()).toBe('POST');
      expect(new URL(request.url()).pathname).toBe(form.action);
      expect(request.headers()['content-type']).toBe('application/x-www-form-urlencoded');
      const fields = Object.fromEntries(new URLSearchParams(request.postData()));
      expect(fields).toEqual({
        name: 'Test Person',
        email: 'name@example.com',
        [form.select]: choice,
        organisation: 'Example Lab',
        [form.text]: 'Hello there',
      });
    });

    test('server-rendered errors and status survive load; focus on the first invalid field', async ({
      page,
    }) => {
      await serveLive(page, form, serverErrors(form));
      await page.goto(`/${form.page}`);
      const email = page.locator(id('email'));
      await expect(email).toBeFocused();
      await expect(email).toHaveAttribute('aria-invalid', 'true');
      await expect(email).toHaveValue('name@example');
      await expect(page.locator(`${id('email')}-error`)).toBeVisible();
      await expect(page.locator(`${id('email')}-error`)).toHaveText(emailError);
      await expect(email).toHaveAccessibleDescription(emailError);
      await expect(page.locator('[data-form-status]')).toHaveText(errorStatus);
      await expect(page.getByRole('button', { name: form.submit })).toBeEnabled();

      // Fixing the field clears the server's error as it clears a client-side one.
      await email.fill('name@example.com');
      await expect(email).not.toHaveAttribute('aria-invalid', /.*/);
      await expect(page.locator(`${id('email')}-error`)).toBeHidden();
    });

    test('invalid fields without an error status keep their messages but not focus', async ({
      page,
    }) => {
      await serveLive(page, form, serverErrors(form, ''));
      await page.goto(`/${form.page}`);
      await expect(page.locator(`${id('email')}-error`)).toHaveText(emailError);
      await page.waitForLoadState('networkidle');
      await expect(page.locator(id('email'))).not.toBeFocused();
    });

    test('a server-rendered success status is kept on load', async ({ page }) => {
      const sent = 'Thank you — your message has been sent.';
      await serveLive(page, form, (html) =>
        html.replace('data-form-status></p>', `data-form-status>${sent}</p>`),
      );
      await page.goto(`/${form.page}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('[data-form-status]')).toHaveText(sent);
      await expect(page.locator('[aria-invalid]')).toHaveCount(0);
      await expect(page.locator('.field-control:focus')).toHaveCount(0);
    });
  });
}
