// Author: Rasel Al Mamun
// Live form mode (FD-135, FD-136): the built pages with an action added, as the Django templates
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

    // The background send: a fetch with the JSON header. Anything else is a real navigation.
    async function serveSend(page, answer) {
      const sends = [];
      const navigations = [];
      await page.route(`**${form.action}`, async (route) => {
        const request = route.request();
        if (!(request.headers().accept ?? '').includes('application/json')) {
          navigations.push(request);
          await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Posted</p>' });
          return;
        }
        sends.push(request);
        await answer(route, sends.length);
      });
      return { sends, navigations };
    }
    const json = (status, body) => (route) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    async function openLive(page, answer) {
      await serveLive(page, form, (html) =>
        html.replace(/(<form\b[^>]*>)/, '$1<input type="hidden" name="started" value="old-start">'),
      );
      const seen = await serveSend(page, answer);
      await page.goto(`/${form.page}`);
      return seen;
    }
    const submit = (page) => page.getByRole('button', { name: form.submit }).click();
    const status = (page) => page.locator('[data-form-status]');
    const sentText = 'Thank you — your message has been sent.';

    test('a valid submit is sent in the background and reset with the status shown', async ({
      page,
    }) => {
      const { sends, navigations } = await openLive(
        page,
        json(200, { ok: true, status: sentText, errors: {}, started: 'new-start' }),
      );
      const options = await page.locator(`${id(form.select)} option`).allTextContents();
      const choice = options.at(-1);
      await fillValid(page);
      await page.locator(id(form.select)).selectOption(choice);
      await submit(page);

      await expect(status(page)).toHaveText(sentText);
      await expect(status(page)).toBeFocused();
      await expect(status(page)).toHaveAttribute('tabindex', '-1');
      await expect(page).toHaveURL(new RegExp(`/${form.page}$`));
      expect(navigations).toHaveLength(0);
      expect(sends).toHaveLength(1);
      await expect(page.locator(id('name'))).toHaveValue('');
      await expect(page.locator(id('email'))).toHaveValue('');
      await expect(page.locator(id(form.text))).toHaveValue('');
      await expect(page.locator(id(form.select))).toHaveValue(options[0] ?? '');
      await expect(page.locator('input[name="started"]')).toHaveValue('new-start');
      await expect(page.locator('form[data-form]')).not.toHaveAttribute('aria-busy', /.*/);
      const button = page.getByRole('button', { name: form.submit });
      await expect(button).toBeEnabled();
      await expect(button).not.toHaveAttribute('aria-disabled', /.*/);
      await expect(page.locator('a[href^="mailto:"][href*="body="]')).toHaveCount(0);

      const request = sends[0];
      expect(request.method()).toBe('POST');
      expect(new URL(request.url()).pathname).toBe(form.action);
      expect(request.headers().accept).toBe('application/json');
      expect(request.headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
      const body = request.postData();
      for (const [name, value] of [
        ['name', 'Test Person'],
        ['email', 'name@example.com'],
        [form.select, choice],
        ['organisation', 'Example Lab'],
        [form.text, 'Hello there'],
        ['started', 'old-start'],
      ]) {
        expect(body).toContain(`name="${name}"\r\n\r\n${value}\r\n`);
      }
    });

    test('field errors from the server use the client-side markup and take focus', async ({
      page,
    }) => {
      const { navigations } = await openLive(
        page,
        json(422, {
          ok: false,
          status: errorStatus,
          errors: { email: emailError, [form.text]: 'Too short.' },
          started: 'again',
        }),
      );
      await fillValid(page);
      await submit(page);

      await expect(status(page)).toHaveText(errorStatus);
      await expect(page.locator(id('email'))).toBeFocused();
      for (const [name, message] of [
        ['email', emailError],
        [form.text, 'Too short.'],
      ]) {
        await expect(page.locator(id(name))).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator(`${id(name)}-error`)).toBeVisible();
        await expect(page.locator(`${id(name)}-error`)).toHaveText(message);
        await expect(page.locator(id(name))).toHaveAccessibleDescription(
          new RegExp(message.replace('.', '\\.')),
        );
      }
      await expect(page.locator(id('name'))).not.toHaveAttribute('aria-invalid', /.*/);
      await expect(page.locator(id('email'))).toHaveValue('name@example.com');
      await expect(page.locator('input[name="started"]')).toHaveValue('again');
      await expect(page.getByRole('button', { name: form.submit })).toBeEnabled();
      expect(navigations).toHaveLength(0);
      // Fixing a field clears its server error as usual.
      await page.locator(id(form.text)).fill('A longer message');
      await expect(page.locator(`${id(form.text)}-error`)).toBeHidden();
    });

    test('a 429 shows its status and keeps the values', async ({ page }) => {
      const wait = 'Too many messages. Please try again later.';
      const { navigations } = await openLive(
        page,
        json(429, { ok: false, status: wait, errors: {} }),
      );
      await fillValid(page);
      await submit(page);
      await expect(status(page)).toHaveText(wait);
      await expect(status(page)).toBeFocused();
      await expect(page.locator('[aria-invalid]')).toHaveCount(0);
      await expect(page.locator(id('name'))).toHaveValue('Test Person');
      await expect(page.locator('input[name="started"]')).toHaveValue('old-start');
      await expect(page.getByRole('button', { name: form.submit })).toBeEnabled();
      expect(navigations).toHaveLength(0);
    });

    test('a 413 shows its status in place and keeps the values', async ({ page }) => {
      const tooLarge = 'The message is too large. Please shorten it.';
      const { sends, navigations } = await openLive(
        page,
        json(413, { ok: false, status: tooLarge, errors: {} }),
      );
      await fillValid(page);
      await submit(page);
      await expect(status(page)).toHaveText(tooLarge);
      await expect(status(page)).toBeFocused();
      await expect(page.locator('[aria-invalid]')).toHaveCount(0);
      await expect(page.locator(id('name'))).toHaveValue('Test Person');
      await expect(page.locator(id('email'))).toHaveValue('name@example.com');
      await expect(page.locator(id(form.text))).toHaveValue('Hello there');
      await expect(page.locator('form[data-form]')).not.toHaveAttribute('aria-busy', /.*/);
      await expect(page.getByRole('button', { name: form.submit })).toBeEnabled();
      await expect(page).toHaveURL(new RegExp(`/${form.page}$`));
      expect(sends).toHaveLength(1);
      expect(navigations).toHaveLength(0);
    });

    test('a non-JSON 413 falls back to a normal post', async ({ page }) => {
      const { sends, navigations } = await openLive(page, (route) =>
        route.fulfill({ status: 413, contentType: 'text/html', body: '<p>Too large</p>' }),
      );
      await fillValid(page);
      await Promise.all([page.waitForURL(`**${form.action}`), submit(page)]);
      expect(sends).toHaveLength(1);
      expect(navigations).toHaveLength(1);
      expect(navigations[0].method()).toBe('POST');
    });

    test('a 403 shows the fixed message and keeps the values', async ({ page }) => {
      const { navigations } = await openLive(page, (route) =>
        route.fulfill({ status: 403, contentType: 'text/html', body: '<p>Forbidden</p>' }),
      );
      await fillValid(page);
      await submit(page);
      await expect(status(page)).toHaveText(
        'The form expired. Please reload the page and send it again.',
      );
      await expect(page.locator(id('name'))).toHaveValue('Test Person');
      await expect(page.locator(id(form.text))).toHaveValue('Hello there');
      await expect(page.getByRole('button', { name: form.submit })).toBeEnabled();
      await expect(page.locator('form[data-form]')).not.toHaveAttribute('aria-busy', /.*/);
      expect(navigations).toHaveLength(0);
    });

    test('a network failure falls back to a normal post', async ({ page }) => {
      const { sends, navigations } = await openLive(page, (route) => route.abort('failed'));
      await fillValid(page);
      await Promise.all([page.waitForURL(`**${form.action}`), submit(page)]);
      expect(sends).toHaveLength(1);
      expect(navigations).toHaveLength(1);
      expect(navigations[0].method()).toBe('POST');
      expect(navigations[0].headers()['content-type']).toBe('application/x-www-form-urlencoded');
      const fields = Object.fromEntries(new URLSearchParams(navigations[0].postData()));
      expect(fields).toMatchObject({ name: 'Test Person', started: 'old-start' });
    });

    test('a non-JSON 500 falls back to a normal post', async ({ page }) => {
      const { sends, navigations } = await openLive(page, (route) =>
        route.fulfill({ status: 500, contentType: 'text/html', body: '<p>Server error</p>' }),
      );
      await fillValid(page);
      await Promise.all([page.waitForURL(`**${form.action}`), submit(page)]);
      expect(sends).toHaveLength(1);
      expect(navigations).toHaveLength(1);
      expect(navigations[0].method()).toBe('POST');
    });

    test('a double submit sends one request', async ({ page }) => {
      const { sends } = await openLive(page, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        await json(200, { ok: true, status: sentText, errors: {} })(route);
      });
      await fillValid(page);
      const button = page.getByRole('button', { name: form.submit });
      await button.evaluate((element) => {
        element.click();
        element.form.requestSubmit();
      });
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute('aria-disabled', 'true');
      await expect(page.locator('form[data-form]')).toHaveAttribute('aria-busy', 'true');
      await page.locator(id('name')).focus();
      await page.keyboard.press('Enter');
      await expect(status(page)).toHaveText(sentText);
      expect(sends).toHaveLength(1);
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

    for (const motion of ['no-preference', 'reduce']) {
      for (const width of [390, 1440]) {
        test(`a server-rendered status is in view and focused (${motion}, ${width} px)`, async ({
          page,
        }) => {
          const sent = 'Thank you — your message has been sent.';
          await page.emulateMedia({ reducedMotion: motion });
          await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
          await serveLive(page, form, (html) =>
            html.replace('data-form-status></p>', `data-form-status>${sent}</p>`),
          );
          await page.goto(`/${form.page}`);
          const status = page.locator('[data-form-status]');
          await expect(status).toBeFocused();
          // Smooth scrolling and Lenis take a moment; the status ends inside the viewport.
          await expect
            .poll(() =>
              status.evaluate((element) => {
                const box = element.getBoundingClientRect();
                const header =
                  document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
                return box.top >= header && box.bottom <= window.innerHeight;
              }),
            )
            .toBe(true);
          await expect(page.locator('[aria-invalid]')).toHaveCount(0);
        });
      }
    }
  });
}
