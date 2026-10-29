// Author: Rasel Al Mamun
// `test` for the specs: Playwright's own, plus, on the Django target (FD-137), page.goto() mapping
// `/<file>.html` to the page's Django URL (tests/pages.js), so one spec serves both targets.
// On the static target nothing is changed.
import { expect, test as base } from '@playwright/test';
import { isDjango, pageUrl } from './pages.js';

export const test = isDjango
  ? base.extend({
      djangoGoto: [
        // Frame.goto is the one method every page.goto() and frame.goto() call ends in; it is
        // patched once per worker, through a throw-away page of the worker's browser.
        async ({ browser }, use) => {
          const context = await browser.newContext();
          const frame = Object.getPrototypeOf((await context.newPage()).mainFrame());
          await context.close();
          const goto = frame.goto;
          frame.goto = function (url, options) {
            return goto.call(this, pageUrl(url), options);
          };
          await use();
          frame.goto = goto;
        },
        { auto: true, scope: 'worker' },
      ],
    })
  : base;

export { expect };
