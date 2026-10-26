// Author: Rasel Al Mamun
// The amber underline of a tab row (FD-111 publication tabs, FD-112 Blog tabs): sits under the
// pressed tab and, from the frame after the first placement, slides (CSS, motion only).
// Returns `place()` for the caller to run after a tab is pressed. Where the row scrolls sideways
// (phones), the pressed tab is scrolled into view. The row is laid out from the first paint but
// stays invisible until the web fonts are in (.is-set): the tab widths change at the swap, so the
// swap must move nothing on screen (CLS 0); the underline is placed then, by transform.
export function tabInk(group) {
  const ink = group.querySelector('.pf-tab-ink');
  const place = () => {
    const pressed = group.querySelector('[aria-pressed="true"]');
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
        const smooth = matchMedia('(prefers-reduced-motion: no-preference)').matches;
        group.scrollTo({ left, behavior: smooth ? 'smooth' : 'instant' });
      }
    }
  };
  document.fonts.ready.then(() => {
    place();
    group.classList.add('is-set');
    requestAnimationFrame(() => group.classList.add('is-ready'));
    // The tab widths change with the window.
    new ResizeObserver(place).observe(group);
  });
  return place;
}
