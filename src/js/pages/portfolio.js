// Author: Rasel Al Mamun
// Portfolio (FD-107, FD-111). Without JS every section and every publication is shown and the
// section nav jumps to the sections. This module marks the section nav item of the section in
// view (aria-current) and runs the publication tabs (also on publications.html).
import { tabInk } from '../core/tab-ink.js';

// The section crossing the middle line of the viewport marks its nav item; none while the
// profile (above the first section) or the footer is there.
function initSectionNav() {
  const nav = document.querySelector('[data-section-nav]');
  if (!nav || !('IntersectionObserver' in window)) return;
  const links = new Map(
    [...nav.querySelectorAll('a[href^="#"]')].map((link) => [link.hash.slice(1), link]),
  );
  const sections = [...links.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const onLine = new Set();

  const mark = () => {
    const current = sections.find((section) => onLine.has(section))?.id;
    for (const [id, link] of links) {
      if (id === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
  };
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onLine.add(entry.target);
        else onLine.delete(entry.target);
      }
      mark();
    },
    { rootMargin: '-50% 0px -49% 0px' },
  );
  for (const section of sections) observer.observe(section);
}

const MOTION = matchMedia('(prefers-reduced-motion: no-preference)');
// FD-111: rows re-enter 30 ms apart (no token); fade + --m-8 rise over --d-base, --e-out.
const ROW_STAGGER = 30;
const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// Durations in either unit: the production CSS minifier writes 200ms as .2s.
const ms = (name, fallback) => {
  const value = token(name);
  return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) || fallback;
};

// The rows a tab shows fade in and rise, one after the other (only when motion is allowed).
function reenter(rows) {
  if (!MOTION.matches) return;
  const rise = token('--m-8') || '8px';
  const timing = { duration: ms('--d-base', 200), easing: token('--e-out'), fill: 'backwards' };
  rows.forEach((row, i) => {
    row.animate(
      [
        { opacity: 0, translate: `0 ${rise}` },
        { opacity: 1, translate: '0 0' },
      ],
      { ...timing, delay: i * ROW_STAGGER },
    );
  });
}

const COUNT_WORDS = {
  all: ['publication', 'publications'],
  journal: ['journal article', 'journal articles'],
  conference: ['conference paper', 'conference papers'],
};

// Publication tabs (Portfolio, publications.html): All / Journal / Conference filter the rows
// (and on publications.html their year groups); the polite live region says how many rows
// are shown; the amber underline sits under the pressed tab.
function initPublicationTabs() {
  const group = document.querySelector('[data-pub-tabs]');
  const live = document.querySelector('[data-pub-count]');
  if (!group || !live) return;
  const buttons = [...group.querySelectorAll('[data-type]')];
  const rows = [...document.querySelectorAll('[data-pub-row]')];
  const years = [...document.querySelectorAll('[data-pub-year]')];

  let placeInk = () => {};
  const select = (button) => {
    const type = button.dataset.type;
    for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
    for (const row of rows) row.hidden = type !== 'all' && row.dataset.type !== type;
    for (const year of years) {
      year.hidden = [...year.querySelectorAll('[data-pub-row]')].every((row) => row.hidden);
    }
    const shown = rows.filter((row) => !row.hidden);
    live.textContent = `${shown.length} ${COUNT_WORDS[type][shown.length === 1 ? 0 : 1]}`;
    placeInk();
    reenter(shown);
  };

  group.addEventListener('click', (event) => {
    const button = event.target.closest('[data-type]');
    if (button && button.getAttribute('aria-pressed') !== 'true') select(button);
  });
  placeInk = tabInk(group);
}

export function init() {
  initSectionNav();
  initPublicationTabs();
}
