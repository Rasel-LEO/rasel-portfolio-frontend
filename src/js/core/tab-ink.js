// Author: Rasel Al Mamun
// The amber underline of a tab row (FD-111 publication tabs, FD-112 Blog tabs): sits under the
// pressed tab and, from the frame after the first placement, slides (CSS, motion only).
// Returns `place()` for the caller to run after a tab is pressed. Where the row scrolls sideways
// (phones), the pressed tab is scrolled into view. The row is laid out from the first paint but
// stays invisible until the web fonts are in (.is-set): the tab widths change at the swap, so the
// swap must move nothing on screen (CLS 0); the underline is placed then, by transform.
// 1.7.4 (F21): one ResizeObserver for the row on the page; a row swapped out of the page (the Blog
// tabs after a list change) is no longer observed.
// 1.7.5 (FD-191): the row is first measured once the tabs' own fonts are loaded — asked for with
// `document.fonts.load()`, because `document.fonts.ready` alone resolves at once when it is read
// before the browser has begun the font load, and the row was then measured (and pre-scrolled)
// with the fallback widths. Each tab is observed too, so a later width change re-measures.
import { MOTION } from './media.js';

let observer = null;
// Observed element (a row or one of its tabs) → the row's place().
const placers = new Map();

function observe(group, place) {
  observer ??= new ResizeObserver((entries) => {
    for (const entry of entries) placers.get(entry.target)?.();
  });
  for (const old of placers.keys()) {
    if (!old.isConnected) {
      observer.unobserve(old);
      placers.delete(old);
    }
  }
  for (const target of [group, ...group.querySelectorAll('.pf-tab')]) {
    placers.set(target, place);
    observer.observe(target);
  }
}

// Resolves once the fonts of the row's tabs (the pressed one and a plain one) are loaded, then
// once no other font is loading. A failed load falls back to `document.fonts.ready`.
function fontsIn(group) {
  const tabs = new Set(
    [
      group.querySelector('[aria-pressed="true"], [aria-current="page"]'),
      group.querySelector('.pf-tab:not([aria-pressed="true"]):not([aria-current="page"])'),
    ].filter(Boolean),
  );
  const loads = [...tabs].map((tab) => {
    const s = getComputedStyle(tab);
    return document.fonts.load(
      `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`,
      tab.textContent.trim() || undefined,
    );
  });
  return Promise.all(loads)
    .catch(() => undefined)
    .then(() => document.fonts.ready);
}

export function tabInk(group) {
  const ink = group.querySelector('.pf-tab-ink');
  const place = () => {
    const pressed = group.querySelector('[aria-pressed="true"], [aria-current="page"]');
    if (!ink || !pressed) return;
    ink.style.setProperty('--ink-x', `${pressed.offsetLeft}px`);
    ink.style.setProperty('--ink-w', `${pressed.offsetWidth}px`);
    // Wrapped tabs (Blog on phones): up from the group's bottom to the pressed tab's row.
    ink.style.setProperty(
      '--ink-y',
      `${pressed.offsetTop + pressed.offsetHeight - group.clientHeight}px`,
    );
    if (group.scrollWidth > group.clientWidth) {
      const start = pressed.offsetLeft;
      const end = start + pressed.offsetWidth;
      const view = group.scrollLeft;
      // To the tab's start: a snap point, so snapping never moves it out of view again.
      const hidden = start < view || end > view + group.clientWidth;
      const left = Math.min(start, group.scrollWidth - group.clientWidth);
      if (hidden && left !== view) {
        const smooth = matchMedia(MOTION).matches;
        group.scrollTo({ left, behavior: smooth ? 'smooth' : 'instant' });
      }
    }
  };
  fontsIn(group).then(() => {
    place();
    group.classList.add('is-set');
    requestAnimationFrame(() => group.classList.add('is-ready'));
    // The tab widths change with the window.
    if (group.isConnected) observe(group, place);
  });
  return place;
}
