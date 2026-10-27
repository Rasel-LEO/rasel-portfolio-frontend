// Author: Rasel Al Mamun
// Audit gate for the whole dependency tree (FD-134): runs `npm audit --json` and fails on any
// high or critical advisory that is not listed in tools/audit-allowlist.json. Each allow-list
// entry needs a reason and an expiry date at most 90 days ahead; an expired or malformed entry
// fails the gate, an entry that no longer matches anything is reported for removal.
// Production dependencies keep their own gate (`npm audit --omit=dev`, CI).
// Usage: npm run check:audit
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const allowlistPath = resolve(root, 'tools/audit-allowlist.json');
const blocking = new Set(['high', 'critical']);
const maxDays = 90;
const day = 24 * 60 * 60 * 1000;
const today = new Date(new Date().toISOString().slice(0, 10));

// One command string through the shell, so `npm` resolves to npm.cmd on Windows as well.
const audit = spawnSync('npm audit --json --audit-level=high', {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(audit.stdout);
} catch {
  console.error('check-audit: npm audit returned no JSON report.');
  console.error(audit.stderr || audit.stdout);
  process.exit(1);
}
if (report.error) {
  console.error(`check-audit: npm audit failed: ${report.error.summary ?? report.error.code}`);
  process.exit(1);
}

// Advisories are the object entries of `via`; string entries only name the package they pass through.
const advisories = new Map();
for (const finding of Object.values(report.vulnerabilities ?? {})) {
  for (const via of finding.via) {
    if (typeof via !== 'object') continue;
    const id = via.url?.split('/').pop() ?? `npm-${via.source}`;
    advisories.set(id, { ...via, id });
  }
}

const problems = [];
const allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
for (const [id, entry] of Object.entries(allowlist)) {
  const expires = new Date(entry.expires);
  if (!entry.reason || Number.isNaN(expires.getTime())) {
    problems.push(`${id}: allow-list entry needs "reason" and "expires" (YYYY-MM-DD).`);
  } else if (expires < today) {
    problems.push(`${id}: allow-list entry expired on ${entry.expires}; review it.`);
  } else if (expires - today > maxDays * day) {
    problems.push(`${id}: allow-list expiry ${entry.expires} is more than ${maxDays} days ahead.`);
  }
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `check-audit: ${counts.total ?? 0} findings (critical ${counts.critical ?? 0}, high ${counts.high ?? 0}, ` +
    `moderate ${counts.moderate ?? 0}, low ${counts.low ?? 0}); ${advisories.size} advisories.`,
);
for (const advisory of [...advisories.values()].sort((a, b) => a.id.localeCompare(b.id))) {
  const listed = Object.hasOwn(allowlist, advisory.id);
  const status = !blocking.has(advisory.severity) ? 'below gate' : listed ? 'allowed' : 'BLOCKING';
  console.log(
    `  ${advisory.id} ${advisory.severity} ${advisory.name} ${advisory.range} — ${status}`,
  );
  if (status === 'BLOCKING') {
    problems.push(`${advisory.id} (${advisory.severity}, ${advisory.name}): ${advisory.title}`);
  }
}
for (const id of Object.keys(allowlist)) {
  if (!advisories.has(id))
    console.log(`  ${id} is allow-listed but no longer reported; remove it.`);
}

if (problems.length) {
  console.error(`check-audit: ${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log('check-audit: no unlisted high or critical advisories.');
