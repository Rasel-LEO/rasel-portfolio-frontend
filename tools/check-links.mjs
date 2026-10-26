// Author: Rasel Al Mamun
// External link check (FD-131), opt-in and not part of CI: it needs the network and the
// answer depends on other sites. Collects every http(s) link of the built pages (dist/, so
// run `npm run build` first), requests each once (HEAD, then GET when HEAD is refused) and
// prints the status per URL with the pages that use it.
// Exit code 1 when a link is missing (404, 410), fails (5xx) or cannot be reached; sites
// that refuse automated requests (401, 403, 429, 999, or a redirect loop without cookies)
// are listed for a check by hand.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '..', 'dist');
const TIMEOUT = 15_000;
const siteUrl = (process.env.SITE_URL ?? '').trim().replace(/\/+$/, '');
const BLOCKED = new Set([401, 403, 429, 999, 'redirect loop']);

// Attribute values as the browser reads them (Handlebars escapes "=" as &#x3D;).
const decode = (url) =>
  url
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
const links = new Map();
for (const file of readdirSync(dist).filter((name) => name.endsWith('.html'))) {
  const html = readFileSync(resolve(dist, file), 'utf8');
  for (const [, url] of html.matchAll(/\shref="(https?:\/\/[^"]+)"/g)) {
    const key = decode(url);
    // Canonical links of a SITE_URL build point at the future domain.
    if (siteUrl && key.startsWith(`${siteUrl}/`)) continue;
    if (!links.has(key)) links.set(key, new Set());
    links.get(key).add(file);
  }
}

async function request(url, method) {
  const response = await fetch(url, {
    method,
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT),
    headers: { 'user-agent': 'Mozilla/5.0 (link check)' },
  });
  return response.status;
}

async function check(url) {
  try {
    const status = await request(url, 'HEAD');
    return status === 405 || status === 501 || status >= 400 ? await request(url, 'GET') : status;
  } catch (error) {
    // Sites that set a cookie and redirect to themselves loop for a client without cookies.
    if (/redirect count/i.test(error.cause?.message ?? '')) return 'redirect loop';
    return `error: ${error.cause?.code ?? error.cause?.message ?? error.name}`;
  }
}

const results = await Promise.all(
  [...links.keys()].sort().map(async (url) => ({ url, status: await check(url) })),
);
let failed = 0;
for (const { url, status } of results) {
  const blocked = BLOCKED.has(status);
  const ok = blocked || (typeof status === 'number' && status < 400);
  if (!ok) failed += 1;
  const label = blocked ? `${status} (refuses automated checks: open by hand)` : status;
  const pages = [...links.get(url)];
  const where = pages.length > 3 ? `${pages.length} pages` : pages.join(', ');
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label} ${url} — ${where}`);
}
console.log(`check-links: ${results.length} external links, ${failed} failed`);
process.exit(failed ? 1 : 0);
