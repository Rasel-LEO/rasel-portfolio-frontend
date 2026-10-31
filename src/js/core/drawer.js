// Author: Rasel Al Mamun
// Full-screen menu below lg (FD-11) on Bootstrap Offcanvas, which provides the
// focus trap, Escape, body scroll lock and data-bs-dismiss. This module adds the
// menu button state, focus return and closing when the viewport grows to lg.
import Offcanvas from 'bootstrap/js/dist/offcanvas.js';

const LG = '(min-width: 992px)';

export function initDrawer() {
  const element = document.getElementById('drawer');
  const button = document.querySelector('[data-menu-button]');
  if (!element || !button) return;

  const drawer = Offcanvas.getOrCreateInstance(element);

  button.addEventListener('click', () => drawer.toggle(button));
  element.addEventListener('show.bs.offcanvas', () => button.setAttribute('aria-expanded', 'true'));
  element.addEventListener('hidden.bs.offcanvas', () => {
    button.setAttribute('aria-expanded', 'false');
    // The button is hidden at lg and up; then focus goes to the brand link instead of <body>.
    const target = button.getClientRects().length ? button : document.querySelector('[data-brand]');
    target?.focus();
  });

  // A link to an anchor on the current page (e.g. /portfolio.html#cv) does not navigate,
  // so the drawer must close itself or it would keep covering the target.
  element.addEventListener('click', (event) => {
    if (event.target.closest('a[href]')) drawer.hide();
  });

  matchMedia(LG).addEventListener('change', (event) => {
    if (event.matches) drawer.hide();
  });
}
