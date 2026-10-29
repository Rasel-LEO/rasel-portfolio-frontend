// Author: Rasel Al Mamun
// Runs the browser suite against a running Django site (FD-137, docs/testing-django.md):
//
//   DJANGO_BASE_URL=http://127.0.0.1:8001 npm run test:django
//   DJANGO_BASE_URL=http://127.0.0.1:8001 npm run test:django -- tests/shell.spec.js -g drawer
//
// Starts no server and builds nothing. The spec files below are the Django test sets; extra
// arguments replace them (so a single file or test can be run).
import { spawnSync } from 'node:child_process';

if (!process.env.DJANGO_BASE_URL) {
  console.error('test-django: set DJANGO_BASE_URL, for example http://127.0.0.1:8001');
  process.exit(1);
}

const sets = [
  'tests/shell.spec.js',
  'tests/a11y.spec.js',
  'tests/widths.spec.js',
  'tests/motion.spec.js',
  'tests/inner-pages.spec.js',
  'tests/home.spec.js',
  'tests/stage.spec.js',
  'tests/portfolio.spec.js',
  'tests/blog.spec.js',
  'tests/forms-live.spec.js',
  'tests/django.spec.js',
];
const args = process.argv.slice(2);

const result = spawnSync('npx', ['playwright', 'test', ...(args.length ? args : sets)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, TEST_TARGET: 'django' },
});
process.exit(result.status ?? 1);
