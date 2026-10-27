// Author: Rasel Al Mamun
// Runs the test suite on Linux inside the official Playwright image (same Chromium build and
// fonts as CI on ubuntu-24.04), so Linux-only failures can be reproduced before pushing.
// Needs Docker. The repository is mounted read-only and copied into the container without
// node_modules/dist, so the host's Windows install is never touched.
//
//   npm run test:linux                          -> npm test (full suite)
//   npm run test:linux -- tests/x.spec.js -g y  -> build, then playwright test with those args
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const version = pkg.devDependencies['@playwright/test'];
const image = `mcr.microsoft.com/playwright:v${version}-noble`;

const quote = (arg) => `'${arg.replaceAll("'", "'\\''")}'`;
const args = process.argv.slice(2);
const run = args.length
  ? `npm run build && npx playwright test ${args.map(quote).join(' ')}`
  : 'npm test';

const script = [
  'set -e',
  'mkdir -p /work',
  'tar -C /src --exclude=./node_modules --exclude=./dist --exclude=./dist-django --exclude=./.git' +
    ' --exclude=./test-results --exclude=./playwright-report -cf - . | tar -C /work -xf -',
  'cd /work',
  'npm ci --no-audit --no-fund',
  run,
].join('\n');

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--init',
    '--ipc=host',
    '-e',
    'CI=1',
    '-v',
    `${root}:/src:ro`,
    image,
    'bash',
    '-c',
    script,
  ],
  { stdio: 'inherit' },
);
if (result.error) {
  console.error(`test-linux: ${result.error.message} (is Docker running?)`);
  process.exit(1);
}
process.exit(result.status ?? 1);
