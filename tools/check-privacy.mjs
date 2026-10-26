// Author: Rasel Al Mamun
// Privacy gate (FD-23): fails if src/, docs/content/ or dist/ contain a phone number or a
// private field (date of birth, parents, religion, blood group, marital status, grades,
// referees, permanent address). Fields are caught as keys or labels ("Religion:",
// "religion": …, <dt>Religion</dt>), so prose that names the rule itself still passes.
// DOIs and the ORCID/Scopus ids from src/content/links.json are not phone numbers.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const scanned = ['src', 'docs/content', 'dist'];
const textExtensions = new Set([
  '.html',
  '.hbs',
  '.js',
  '.mjs',
  '.json',
  '.md',
  '.scss',
  '.css',
  '.svg',
  '.txt',
  '.xml',
]);

const DOI = /\b10\.\d{4,9}\/\S+/g;

// Private fields; each source is a regular expression fragment for the label text.
const fields = [
  ['date of birth', String.raw`date[\s_-]*of[\s_-]*birth|birth[\s_-]*date|\bdob\b`],
  ['father', String.raw`\bfather(?:'s)?\b`],
  ['mother', String.raw`\bmother(?:'s)?\b`],
  ['religion', String.raw`\breligion\b`],
  ['blood group', String.raw`\bblood(?:[\s_-]*group)?\b`],
  ['marital status', String.raw`\bmarital\b`],
  ['grades', String.raw`\bc?gpa\b`],
  ['referee', String.raw`\breferees?\b|\breference[\s_-]*contacts?\b`],
  ['permanent address', String.raw`\bpermanent[\s_-]*address\b`],
];
// Up to three more words may follow the term inside a label ("Father's name:").
const tail = String.raw`(?:[\s_'-]*[\w']+){0,3}`;
const fieldPatterns = fields.map(([name, term]) => [
  name,
  new RegExp(
    [
      String.raw`(?:^|[\s>|*-])(?:${term})${tail}\s*(?::|\|)`, // "Religion:" or a table cell
      String.raw`["'](?:${term})${tail}["']\s*:`, // JSON / JS key
      String.raw`>\s*(?:${term})${tail}\s*</(?:dt|th|label|strong|b)>`, // HTML label
    ].join('|'),
    'gim',
  ),
]);

function allowedIds() {
  const file = join(root, 'src/content/links.json');
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, 'utf8'))
    .filter((link) => ['orcid', 'scopus'].includes(link.id))
    .map((link) => link.handle);
}

// Returns a list of "label: match" strings for one text.
export function scanText(text, allowed = allowedIds()) {
  const problems = [];
  let clean = text.replace(DOI, ' ');
  for (const id of allowed) clean = clean.split(id).join(' ');

  if (/\btel:/i.test(clean)) problems.push('tel: link');
  for (const match of clean.matchAll(/\+\s*880[\d\s-]*/g)) {
    problems.push(`phone number (+880): ${match[0].trim()}`);
  }
  for (const match of clean.matchAll(/(?<![\w.])01[3-9](?:[\s-]?\d){8}(?![\w])/g)) {
    problems.push(`phone number (01X…): ${match[0]}`);
  }
  // Any run of 10+ digits, optionally separated by spaces or dashes.
  for (const match of clean.matchAll(/(?<![\w./#-])\+?\d(?:[ \t-]?\d){9,}(?![\w.])/g)) {
    problems.push(`digit run: ${match[0]}`);
  }
  for (const [name, pattern] of fieldPatterns) {
    for (const match of clean.matchAll(pattern)) {
      problems.push(`private field (${name}): ${match[0].trim()}`);
    }
  }
  return problems;
}

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesIn(path);
    return textExtensions.has(extname(entry.name)) ? [path] : [];
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const allowed = allowedIds();
  const problems = [];
  let count = 0;
  for (const dir of scanned.map((d) => join(root, d)).filter(existsSync)) {
    for (const file of filesIn(dir)) {
      count += 1;
      for (const problem of scanText(readFileSync(file, 'utf8'), allowed)) {
        problems.push(`${relative(root, file)}: ${problem.slice(0, 120)}`);
      }
    }
  }
  if (problems.length) {
    console.error(`check-privacy: ${problems.length} problem(s)\n${problems.join('\n')}`);
    process.exit(1);
  }
  console.log(`check-privacy: ${count} files in ${scanned.join(', ')} clean`);
}
