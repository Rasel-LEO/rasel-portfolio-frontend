// Author: Rasel Al Mamun
// Home motion outside the pinned stage, on every width while motion is allowed
// (stage.js imports it): GSAP + ScrollTrigger, scrubbed with smoothing, transform and opacity
// only, everything reverted by gsap.matchMedia when its condition stops matching.
// - Phones (< 768 px, FD-73, FD-86): the portrait moves a little slower than the page and
//   grows gently while it scrolls through (not pinned), never cropped.
// - Contact band (FD-72): from md one scroll-scrubbed settle as the band comes in — from
//   scale 1.12, 48 px to the right and transparent to rest when the band is centred (or the
//   page ends); on phones
//   a simple rise once.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ease, px, seconds } from './motion-tokens.js';
import { onJump } from '../core/scroll.js';

gsap.registerPlugin(ScrollTrigger);

const MOTION = '(prefers-reduced-motion: no-preference)';
const PHONE = `(max-width: 767.98px) and ${MOTION}`;
const WIDE = `(min-width: 768px) and ${MOTION}`;

// Scrub smoothing in seconds (FD-72, FD-73).
const SCRUB = 0.6;
// FD-72 start of the settle (no tokens).
const SETTLE = { scale: 1.12, x: 48 };

// FD-86: the phone portrait's travel and growth stay inside the room the layout leaves it
// (the column's --s-6 above, screen 2's --s-7 below), so the whole figure is always shown.
const PHONE_GROW = 1.03;

function phonePhoto(picture) {
  const travel = px('--m-16');
  const tween = gsap.fromTo(
    picture,
    { y: travel, scale: 1, transformOrigin: '50% 100%' },
    {
      y: -travel,
      scale: PHONE_GROW,
      ease: 'none',
      scrollTrigger: {
        trigger: picture,
        start: 'top bottom',
        end: 'bottom top',
        scrub: SCRUB,
      },
    },
  );
  // After back-to-top's fade-jump the band is on screen at once, not gliding in (FD-70).
  return onJump(() => tween.scrollTrigger?.getTween()?.progress(1));
}

function contactSettle(figure, band) {
  gsap.fromTo(
    figure,
    { scale: SETTLE.scale, x: SETTLE.x, opacity: 0, transformOrigin: '50% 100%' },
    {
      scale: 1,
      x: 0,
      opacity: 1,
      ease: 'none',
      scrollTrigger: {
        trigger: band,
        start: 'top bottom',
        // Centred — or, as the last section, as far as the page scrolls.
        end: () =>
          Math.min(
            band.getBoundingClientRect().top +
              window.scrollY +
              band.offsetHeight / 2 -
              window.innerHeight / 2,
            ScrollTrigger.maxScroll(window),
          ),
        scrub: SCRUB,
      },
    },
  );
}

function contactRise(figure) {
  // Only what is below the fold is hidden first; nothing on screen ever blinks.
  if (figure.getBoundingClientRect().top < window.innerHeight) return;
  gsap.from(figure, {
    y: px('--m-40'),
    opacity: 0,
    duration: seconds('--d-scene'),
    ease: ease('--e-out'),
    scrollTrigger: { trigger: figure, start: 'top 85%', once: true },
  });
}

export function init() {
  const picture = document.querySelector('[data-stage-figure] picture');
  const band = document.querySelector('[data-home="contact"]');
  const figure = band?.querySelector('[data-contact-figure]');
  const mm = gsap.matchMedia();
  mm.add({ phone: PHONE, wide: WIDE }, (context) => {
    const { phone, wide } = context.conditions;
    const offJump = phone && picture ? phonePhoto(picture) : null;
    if (figure && wide) contactSettle(figure, band);
    if (figure && phone) contactRise(figure);
    return () => offJump?.();
  });
  // The page's height changes once the web fonts are in and when the desktop stage falls back
  // to the document (its 4 s CSS fail-safe, or it does not fit): measure again then.
  const refresh = () => ScrollTrigger.refresh();
  document.fonts?.ready.then(refresh);
  document.querySelector('[data-stage]')?.addEventListener('animationend', (event) => {
    if (event.animationName === 'stage-static') refresh();
  });
  return mm;
}
