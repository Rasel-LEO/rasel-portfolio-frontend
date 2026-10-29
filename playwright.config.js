// Author: Rasel Al Mamun
import { defineConfig, devices } from '@playwright/test';

// FD-137: TEST_TARGET=django runs the suite against a running Django site (DJANGO_BASE_URL, for
// example http://127.0.0.1:8001) and starts no web server; Django is started by its own repository.
// Any other value is the static build served by `vite preview`, as always.
const django = process.env.TEST_TARGET === 'django';
const djangoBaseURL = process.env.DJANGO_BASE_URL;
if (django && !djangoBaseURL) {
  throw new Error('TEST_TARGET=django needs DJANGO_BASE_URL, for example http://127.0.0.1:8001');
}

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: django ? djangoBaseURL : 'http://localhost:4173',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: django
    ? undefined
    : {
        command: 'npm run preview -- --port 4173 --strictPort',
        url: 'http://localhost:4173/index.html',
        reuseExistingServer: !process.env.CI,
      },
});
