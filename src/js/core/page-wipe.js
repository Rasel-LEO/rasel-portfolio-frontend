// Author: Rasel Al Mamun
// Seam wipe, leaving a page (FD-81). Arriving is CSS only (_motion.scss); here a click on a
// same-site link to another page closes the halves first, then navigates — on the halves'
// transitionend or after CLOSE_MAX at most. Everything else navigates as usual: other origins,
// mail and phone links, hash-only links, new tabs and windows (target, modifier keys, other mouse
// buttons), downloads, links a page module has already handled, and reduced motion. Enter on a
// link is a click too. The listener sits on window, so the document's handlers run first.
import Offcanvas from 'bootstrap/js/dist/offcanvas.js';

const MOTION = '(prefers-reduced-motion: no-preference)';
const CLOSE_MAX = 300;
// If the browser stays on this page (a download, a 204, a failed request) the wipe reopens.
const STAY_MAX = 2000;

function wipeTarget(event) {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  // SVG links have no URL in .href.
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download')) return null;
  if (link.target && link.target !== '_self') return null;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return null;
  if (url.pathname === location.pathname && url.search === location.search) return null;
  return url.href;
}

export function initPageWipe() {
  const wipe = document.querySelector('[data-page-wipe]');
  if (!wipe) return;
  const motion = matchMedia(MOTION);
  let timers = [];

  const reopen = () => {
    timers.forEach(clearTimeout);
    timers = [];
    wipe.classList.remove('is-leaving');
  };

  const leave = (href) => {
    const drawer = document.getElementById('drawer');
    if (drawer?.classList.contains('show')) Offcanvas.getInstance(drawer)?.hide();
    let gone = false;
    const go = () => {
      if (gone) return;
      gone = true;
      location.href = href;
      timers.push(setTimeout(reopen, STAY_MAX));
    };
    const half = wipe.querySelector('.half');
    const onEnd = (event) => {
      if (event.target !== half || event.propertyName !== 'transform') return;
      half.removeEventListener('transitionend', onEnd);
      go();
    };
    half.addEventListener('transitionend', onEnd);
    timers.push(setTimeout(go, CLOSE_MAX));
    wipe.classList.add('is-leaving');
  };

  window.addEventListener('click', (event) => {
    if (!motion.matches) return;
    const href = wipeTarget(event);
    if (!href) return;
    event.preventDefault();
    // A second click while closing waits for the first navigation.
    if (!wipe.classList.contains('is-leaving')) leave(href);
  });

  // Back / forward cache: the page comes back as it was left, so open it at once (no replay of
  // the arrival either).
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    wipe.classList.add('is-restored');
    reopen();
  });
}
