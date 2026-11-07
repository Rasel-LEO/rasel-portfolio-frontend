// Author: Rasel Al Mamun
// 1.7.4 (F03, F10): every documented content limit in one place, shared by the content validator
// (tools/validate-content.mjs, which fails the build above them) and the slot layout tests
// (tests/slots.spec.js, which build the site at these maxima). The table is
// docs/handover-django.md § 14.1. Pure data and helpers; no I/O.

// The page <title>: the short title and this suffix, at most TITLE_MAX characters (FD-128, FD-139).
export const TITLE_SUFFIX = ' — Ideatrium';
export const TITLE_MAX = 60;
// Every search description (<meta name="description">, og:description, twitter:description).
export const DESCRIPTION_MAX = 160;

// The Django-owned text slots (characters), § 14.1.
export const MAX = {
  second_role: 40,
  eyebrow: 100,
  eyebrow_short: 48,
  role_line: 70,
  statement: 300,
  summary_line: 140,
  // profile.summary is the Portfolio search description.
  summary: DESCRIPTION_MAX,
  portfolio_eyebrow: 100,
  location_line: 60,
  author_line: 100,
  availability: 100,
  email: 40,
  link_label: 28,
  area_label: 28,
  service_title: 40,
  service_summary: 90,
  service_item: 50,
  evidence_label: 28,
  role_title: 40,
  role_period: 30,
  role_unit: 40,
  role_institution: 50,
  role_text: 160,
  role_bullet: 60,
  contact_intro: 120,
  audience: 60,
  subject: 30,
  form_kind: 40,
};

// 1.7.1: the most items each Portfolio list may hold (measured at 320 – 1440 px, § 14.1).
export const LIST_MAX = {
  awards: 9,
  education: 4,
  expertiseGroups: 4,
  expertiseItems: 12,
  certifications: 2,
  bullets: 3,
};

// The most items of every list slot: the layout tests build each list at this count, and the
// validator fails above it.
export const MANY = {
  areas: 8,
  services: 4,
  serviceItems: 4,
  roles: 5,
  links: 9,
  footerLinks: 8,
  options: 8,
  audiences: 6,
  awards: LIST_MAX.awards,
  education: LIST_MAX.education,
  expertiseGroups: LIST_MAX.expertiseGroups,
  expertiseItems: LIST_MAX.expertiseItems,
  certifications: LIST_MAX.certifications,
  bullets: LIST_MAX.bullets,
};

// The hard limits of the card fields (1.7.0). The large Home card has the roomier ones; every
// other card is small. `short_title` is the card title; a post's card title is its title.
export const CARD_LIMITS = {
  title: { large: 55, small: 40 },
  description: { large: 140, small: 100 },
  roleLine: 50,
  blogTitle: 80,
  blogDescription: 110,
};

// The page title a short title gives ("Short title — Ideatrium").
export const pageTitle = (shortTitle) => `${shortTitle}${TITLE_SUFFIX}`;

// 1.7.4 (F02): a text cut to at most `max` characters at the end of its last full sentence; with no
// full sentence that short, at the last word, with an ellipsis.
export function cutAtSentence(text, max = DESCRIPTION_MAX) {
  const clean = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max + 1);
  const ends = [...head.matchAll(/[.!?](?=\s|$)/g)].map((match) => match.index + 1);
  const end = ends.filter((index) => index <= max).at(-1);
  if (end) return clean.slice(0, end);
  const words = clean.slice(0, max - 1).replace(/\s+\S*$/, '');
  return `${words.replace(/[\s,;:–—-]+$/, '')}…`;
}

// 1.7.4 (F10): the [bracketed] placeholders left in a text or Markdown body. Code (fenced and
// inline), links ("[text](url)"), the figure markers ("[Figure 2]") and task boxes are not
// placeholders.
export function placeholders(text) {
  const plain = String(text ?? '')
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/^\s*\[Figure \d+\]\s*$/gm, ' ');
  return [...plain.matchAll(/\[(?![ xX]\])[^\]\n]+\](?![(:[])/g)].map((match) => match[0]);
}
