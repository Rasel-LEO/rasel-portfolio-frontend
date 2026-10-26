// Author: Rasel Al Mamun
// Back to top (DD-17, FD-13): the button appears once a sentinel reaching from the top of the
// page to 100svh has scrolled above the viewport (on Home with the desktop stage: to the
// stage's start, and the stage's timeline swaps the figure for it, FD-97). No scroll handler; an
// IntersectionObserver does the work.
// The way up (FD-70): a jump that would pass through the Home stage, or is longer than 1.5
// viewports, fades the page out, jumps (the stage snapped to p = 0) and fades it in, so no
// story plays backwards; shorter ones scroll smoothly; reduced motion jumps at once.
// FD-104: once shown it stays visible and clickable everywhere, over the Contact band and the
// footer too (no tucking); the footer's bottom row keeps its place free at the page end.
import { jumpTo, scrollToY } from './scroll.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// FD-70 timings (no tokens): fade out, fade in; smooth scrolls at most this long.
const FADE_OUT = 160;
const FADE_IN = 240;
const SMOOTH = 600;

const focusBrand = () => document.querySelector('[data-brand]')?.focus({ preventScroll: true });

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fade out, jump, fade in. The fade is on <html> (.is-jumping, _shell.scss), so it never
// replaces an element's own opacity; the timers also run in a background tab.
async function fadeJump() {
  const root = document.documentElement;
  root.style.setProperty('--jump-out', `${FADE_OUT}ms`);
  root.style.setProperty('--jump-in', `${FADE_IN}ms`);
  root.classList.add('is-jumping');
  try {
    // The transition starts on the next style pass; a frame of margin before the jump.
    await wait(FADE_OUT);
    await frame();
    jumpTo(0);
    focusBrand();
    // One frame painted at the top, still hidden, before the page comes back.
    await frame();
    await frame();
  } finally {
    // Never leave the page hidden, even if a jump subscriber throws.
    root.classList.remove('is-jumping');
  }
  await wait(FADE_IN);
  root.style.removeProperty('--jump-out');
  root.style.removeProperty('--jump-in');
}

export function initBackToTop() {
  const button = document.querySelector('[data-back-to-top]');
  const sentinel = document.querySelector('[data-back-to-top-sentinel]');
  if (!button || !sentinel || !('IntersectionObserver' in window)) return;

  const show = (visible) => {
    if (visible) {
      button.hidden = false;
      // Next frame, so the opacity transition starts from the hidden state.
      requestAnimationFrame(() => button.classList.add('is-on'));
    } else {
      // Never drop keyboard focus to <body> when the button disappears.
      if (document.activeElement === button) focusBrand();
      button.classList.remove('is-on');
      button.hidden = true;
    }
  };

  new IntersectionObserver(([entry]) => {
    show(!entry.isIntersecting && entry.boundingClientRect.top < 0);
  }).observe(sentinel);

  let jumping = false;
  button.addEventListener('click', async () => {
    if (jumping) return;
    const staged = document.querySelector('[data-stage][data-stage-mode="desktop"]');
    if (reducedMotion.matches) {
      scrollToY(0);
      focusBrand();
    } else if (staged || window.scrollY > window.innerHeight * 1.5) {
      jumping = true;
      try {
        await fadeJump();
      } finally {
        jumping = false;
      }
    } else {
      scrollToY(0, { smooth: true, duration: SMOOTH / 1000 });
      focusBrand();
    }
  });
}
