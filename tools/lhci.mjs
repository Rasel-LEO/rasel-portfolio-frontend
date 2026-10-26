// Author: Rasel Al Mamun
// Lighthouse CI (FD-129) on the built site: the five budget pages of lighthouserc.json,
// mobile preset, three runs each, median run asserted. Chrome is the Chromium build that
// Playwright already installs, so no second browser is downloaded.
// Usage: npm run lhci (builds first). Reports: .lighthouseci/reports/.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const cli = require.resolve('@lhci/cli/src/cli.js');
const env = { ...process.env, CHROME_PATH: process.env.CHROME_PATH || chromium.executablePath() };

const result = spawnSync(process.execPath, [cli, 'autorun'], { stdio: 'inherit', env });
process.exit(result.status ?? 1);
