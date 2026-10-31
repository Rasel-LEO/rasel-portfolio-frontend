// Author: Rasel Al Mamun
// Site-wide motion (FD-52): loaded on every page once the OS allows motion.
// - Reveals (FD-63): [data-reveal] elements below the fold rise in once at 15 % in view;
//   nothing on screen at load is ever hidden. IntersectionObserver only.
// - Fine pointers: card tilt and magnetic buttons (FD-62), the cursor ring (FD-82, cursor.js).
// - Fine-pointer desktops: Lenis smooth wheel scrolling (FD-64).
// Every part is undone when its condition stops matching (window size, pointer, the OS
// motion setting), so no hidden state or inline style is left behind.
import { clearSmoothScroll, setSmoothScroll } from '../core/scroll.js';

const MOTION = '(prefers-reduced-motion: no-preference)';
const FINE = '(hover: hover) and (pointer: fine)';
const DESKTOP = '(min-width: 992px)';

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const px = (name) => parseFloat(token(name)) || 0;
// Durations in either unit: the production CSS minifier writes 320ms as .32s.
const ms = (name, fallback) => {
  const value = token(name);
  return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) || fallback;
};

// Reveal staggers: cards --stagger (60 ms), chips 40 ms (no token); at most four
// steps.
const CHIP_STAGGER = 40;
const MAX_STEPS = 4;

function initReveals() {
  const stagger = { card: ms('--stagger', 60), chip: CHIP_STAGGER };
  const settle = ms('--d-scene', 480) + 200;
  const targets = [...document.querySelectorAll('[data-reveal]')].filter((el) => {
    // Never hide what is on screen (or not rendered) when motion starts.
    if (!el.getClientRects().length) return false;
    return el.getBoundingClientRect().top > window.innerHeight;
  });
  const done = (el) => {
    el.classList.remove('reveal', 'is-pre');
    el.style.removeProperty('--reveal-delay');
  };
  const reveal = (el, delay) => {
    if (delay) el.style.setProperty('--reveal-delay', `${delay}ms`);
    el.classList.remove('is-pre');
    // The reveal transition replaces the element's own ones only while it runs; children's
    // transitionend events bubble up and are ignored.
    const finish = (event) => {
      if (event && event.target !== el) return;
      el.removeEventListener('transitionend', finish);
      done(el);
    };
    el.addEventListener('transitionend', finish);
    setTimeout(finish, delay + settle);
  };

  const observer = new IntersectionObserver(
    (entries, self) => {
      const shown = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target);
      // Elements that enter together follow each other in reading order.
      shown.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
      );
      shown.forEach((el, i) => {
        self.unobserve(el);
        const step = stagger[el.dataset.reveal] ?? stagger.card;
        reveal(el, Math.min(i, MAX_STEPS - 1) * step);
      });
    },
    { threshold: 0.15 },
  );
  for (const el of targets) {
    el.classList.add('reveal', 'is-pre');
    observer.observe(el);
  }

  // Keyboard focus never lands on a hidden or half-faded element (FD-53): show it at once.
  const onFocus = (event) => {
    const el = event.target.closest('.reveal');
    if (!el) return;
    observer.unobserve(el);
    done(el);
  };
  document.addEventListener('focusin', onFocus);

  return () => {
    observer.disconnect();
    document.removeEventListener('focusin', onFocus);
    for (const el of targets) done(el);
  };
}

// The hovered element's box for the pointer effects: read on enter, and again on the next
// move after the page has scrolled (a passive scroll listener only marks it stale), never on
// every move.
function hoverBox() {
  let el = null;
  let box = null;
  let stale = false;
  const onScroll = () => {
    stale = true;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return {
    set(next) {
      el = next;
      box = next ? next.getBoundingClientRect() : null;
      stale = false;
    },
    get() {
      if (el && stale) this.set(el);
      return box;
    },
    stop() {
      window.removeEventListener('scroll', onScroll);
    },
  };
}

// Card tilt (FD-62): toward the pointer, at most --rot-card, on an axis in the
// card's plane; the lift itself is CSS (hover, and focus-within without tilt).
function initTilt() {
  const selector = '.card, .fork-card, .service';
  const max = parseFloat(token('--rot-card')) || 6;
  const hovered = hoverBox();
  let card = null;

  const reset = () => {
    if (!card) return;
    card.classList.remove('is-tilting');
    card.style.removeProperty('--tilt-x');
    card.style.removeProperty('--tilt-y');
    card.style.removeProperty('--tilt');
    card = null;
    hovered.set(null);
  };
  const onOver = (event) => {
    if (event.pointerType !== 'mouse') return;
    const next = event.target.closest(selector);
    if (next === card) return;
    reset();
    if (!next) return;
    card = next;
    hovered.set(card);
  };
  const onMove = (event) => {
    if (!card || event.pointerType !== 'mouse') return;
    const box = hovered.get();
    // -1 … 1 from the card's centre.
    const x = Math.max(-1, Math.min(1, ((event.clientX - box.left) / box.width) * 2 - 1));
    const y = Math.max(-1, Math.min(1, ((event.clientY - box.top) / box.height) * 2 - 1));
    const amount = Math.min(1, Math.hypot(x, y));
    card.style.setProperty('--tilt-x', (-y).toFixed(3));
    card.style.setProperty('--tilt-y', x.toFixed(3));
    card.style.setProperty('--tilt', `${(amount * max).toFixed(2)}deg`);
    card.classList.add('is-tilting');
  };
  const onLeave = (event) => {
    if (card && !card.contains(event.relatedTarget)) reset();
  };
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onLeave);
  return () => {
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onLeave);
    reset();
    hovered.stop();
  };
}

// Magnetic buttons (FD-62): primary and secondary buttons follow the pointer by at
// most --magnet and spring back on leave (CSS). Never icon buttons or text links.
function initMagnetic() {
  const selector = '.btn-primary, .btn-secondary';
  const max = px('--magnet') || 6;
  const hovered = hoverBox();
  let button = null;

  const reset = () => {
    if (!button) return;
    button.classList.remove('is-magnetic');
    button.style.removeProperty('--magnet-x');
    button.style.removeProperty('--magnet-y');
    button = null;
    hovered.set(null);
  };
  const onOver = (event) => {
    if (event.pointerType !== 'mouse') return;
    const next = event.target.closest(selector);
    if (next === button) return;
    reset();
    if (!next) return;
    button = next;
    hovered.set(button);
  };
  const onMove = (event) => {
    if (!button || event.pointerType !== 'mouse') return;
    // The pull itself (`translate`) is not in the box: getBoundingClientRect includes it,
    // so the centre is corrected by the current pull.
    const box = hovered.get();
    const pulled = (name) => parseFloat(button.style.getPropertyValue(name)) || 0;
    const centre = {
      x: box.left + box.width / 2 - pulled('--magnet-x'),
      y: box.top + box.height / 2 - pulled('--magnet-y'),
    };
    const pull = (d) => Math.max(-max, Math.min(max, d * 0.25)).toFixed(2);
    button.style.setProperty('--magnet-x', `${pull(event.clientX - centre.x)}px`);
    button.style.setProperty('--magnet-y', `${pull(event.clientY - centre.y)}px`);
    button.classList.add('is-magnetic');
  };
  const onLeave = (event) => {
    if (button && !button.contains(event.relatedTarget)) reset();
  };
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onLeave);
  return () => {
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onLeave);
    reset();
    hovered.stop();
  };
}

// Same-page links (#…) while Lenis runs: Lenis scrolls (smoothly; the skip link at once),
// clear of the sticky header (the page's scroll-padding-top), the URL gets the hash and the
// target takes focus, as a native jump would give it.
function anchorHandler(lenis) {
  return (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#"]');
    const id = link ? decodeURIComponent(link.hash.slice(1)) : '';
    const target = id && document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - pad);
    lenis.scrollTo(top, { immediate: link.classList.contains('skip-link'), force: true });
    history.pushState(null, '', link.hash);
    if (!target.matches('a[href], button, input, select, textarea, [tabindex]')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });
  };
}

// Lenis (FD-64): smooth wheel scrolling on fine-pointer desktops. Keyboard and touch scrolling
// stay native; same-page links and back-to-top go through Lenis (above, scroll.js); it
// pauses while the drawer is open. Its frame loop is ours until the Home stage hands it to
// the GSAP ticker (stage-desktop.js).
async function initSmoothScroll() {
  const { default: Lenis } = await import('lenis');
  const lenis = new Lenis({ autoRaf: false });
  let frame = 0;
  const loop = (time) => {
    lenis.raf(time);
    frame = requestAnimationFrame(loop);
  };
  lenis.useOwnLoop = (on) => {
    cancelAnimationFrame(frame);
    if (on) frame = requestAnimationFrame(loop);
  };
  lenis.useOwnLoop(true);

  // A native scroll Lenis did not make (scrollbar, keys, find in page, a script's instant
  // scrollTo) while it still eases a wheel scroll wins: the ease stops where the page now is,
  // instead of pulling the page back to its own target on the next frame.
  const onNativeScroll = () => {
    if (lenis.isScrolling !== 'smooth') return;
    const y = lenis.actualScroll;
    if (Math.abs(y - lenis.animatedScroll) > 2) lenis.scrollTo(y, { immediate: true, force: true });
  };
  window.addEventListener('scroll', onNativeScroll, { passive: true });

  const onClick = anchorHandler(lenis);
  document.addEventListener('click', onClick);
  const drawer = document.getElementById('drawer');
  const stop = () => lenis.stop();
  const start = () => lenis.start();
  drawer?.addEventListener('show.bs.offcanvas', stop);
  drawer?.addEventListener('hidden.bs.offcanvas', start);
  if (drawer?.classList.contains('show')) stop();

  setSmoothScroll(lenis);
  return () => {
    window.removeEventListener('scroll', onNativeScroll);
    document.removeEventListener('click', onClick);
    drawer?.removeEventListener('show.bs.offcanvas', stop);
    drawer?.removeEventListener('hidden.bs.offcanvas', start);
    // Only if no newer instance has registered meanwhile (a quick media flip).
    clearSmoothScroll(lenis);
    lenis.useOwnLoop(false);
    lenis.destroy();
  };
}

// A part that runs while its media query matches and is undone when it stops matching.
// setup may return a cleanup function or a promise of one.
function whileMatches(query, setup) {
  const list = matchMedia(query);
  let pending = null;
  const sync = () => {
    if (list.matches && !pending) {
      pending = Promise.resolve()
        .then(setup)
        .catch(() => null);
    } else if (!list.matches && pending) {
      const running = pending;
      pending = null;
      running.then((cleanup) => cleanup?.());
    }
  };
  list.addEventListener('change', sync);
  sync();
}

export function init() {
  // A hook for tests: the motion layer has been set up on this page.
  document.documentElement.classList.add('has-motion');
  whileMatches(MOTION, initReveals);
  whileMatches(`${MOTION} and ${FINE}`, initTilt);
  whileMatches(`${MOTION} and ${FINE}`, initMagnetic);
  whileMatches(`${MOTION} and ${FINE}`, () => import('./cursor.js').then((m) => m.init()));
  whileMatches(`${MOTION} and ${FINE} and ${DESKTOP}`, initSmoothScroll);
}
