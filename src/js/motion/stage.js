// Author: Rasel Al Mamun
// Home stage (FD-52 … FD-54). Loaded only while motion is allowed; it picks the
// variant for the window and switches when the window or the OS setting changes:
// - desktop (≥ 992 px): the pinned 3D stage, in stage-desktop.js with GSAP + ScrollTrigger,
//   imported the first time the desktop condition matches (it reverts itself through
//   gsap.matchMedia);
// - mobile (< 992 px): no pin — screen 2's entrance once in view (screen2.js, FD-85) and
//   one-time reveals of the Fork cards; on phones the photo band's parallax (home-motion.js,
//   FD-73);
// - reduced motion: nothing; the static document layout.
// home-motion.js (GSAP) also runs the Contact band's settle (FD-72) on every width.
export const queries = {
  desktop: '(min-width: 992px) and (prefers-reduced-motion: no-preference)',
  mobile: '(max-width: 991.98px) and (prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
};

// Fork cards follow each other by 60 ms.
const STAGGER = 60;

const belowFold = (el) => el.getBoundingClientRect().top > window.innerHeight;

// Screen 2 plays its entrance once when it comes into view (FD-85), no exit. GSAP comes with
// the entrance module; until it is in, the block stays as it is. Only while still below the
// fold is it hidden first, so nothing on screen ever blinks.
function mobileScreen2(stage) {
  const layer = stage.querySelector('[data-stage-statement]');
  let screen2 = null;
  let observer = null;
  let done = false;
  const onFocus = (event) => {
    if (!layer.contains(event.target)) return;
    // Keyboard focus never lands on hidden content (FD-53).
    observer?.disconnect();
    screen2?.show();
  };
  if (layer && belowFold(layer)) {
    import('./screen2.js')
      .then(({ createScreen2 }) => {
        if (done || !belowFold(layer)) return;
        screen2 = createScreen2(layer);
        screen2.hide(true);
        observer = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer.disconnect();
            screen2.play();
          },
          { threshold: 0.15 },
        );
        observer.observe(layer);
        stage.addEventListener('focusin', onFocus);
      })
      .catch(() => {
        // The chunk failed to load: the block stays as it is.
      });
  }
  return () => {
    done = true;
    observer?.disconnect();
    stage.removeEventListener('focusin', onFocus);
    screen2?.revert();
  };
}

function initMobile(stage) {
  stage.dataset.stageMode = 'mobile';

  const cleanupScreen2 = mobileScreen2(stage);
  const cards = [...stage.querySelectorAll('[data-fork-col]')];
  // Only what is still below the fold is hidden; nothing on screen ever blinks.
  const targets = cards.filter(belowFold);

  const reveal = (el, observer) => {
    el.classList.remove('is-pre');
    observer.unobserve(el);
  };
  const observer = new IntersectionObserver(
    (entries, self) => {
      for (const entry of entries) if (entry.isIntersecting) reveal(entry.target, self);
    },
    { threshold: 0.15 },
  );

  for (const el of targets) {
    const index = cards.indexOf(el);
    if (index > 0) el.style.setProperty('--reveal-delay', `${index * STAGGER}ms`);
    el.classList.add('stage-reveal', 'is-pre');
    observer.observe(el);
  }

  // Keyboard focus never lands on a hidden card (FD-53): reveal it at once.
  const onFocus = (event) => {
    const el = targets.find((target) => target.contains(event.target));
    if (!el?.classList.contains('is-pre')) return;
    el.classList.add('is-instant');
    reveal(el, observer);
  };
  stage.addEventListener('focusin', onFocus);

  return () => {
    cleanupScreen2();
    observer.disconnect();
    stage.removeEventListener('focusin', onFocus);
    for (const el of targets) {
      el.classList.remove('stage-reveal', 'is-pre', 'is-instant');
      el.style.removeProperty('--reveal-delay');
    }
    delete stage.dataset.stageMode;
  };
}

export function init() {
  const stage = document.querySelector('[data-stage]');
  if (!stage || !('IntersectionObserver' in window)) return;

  const desktop = matchMedia(queries.desktop);
  const mobile = matchMedia(queries.mobile);
  let cleanupMobile = null;
  let desktopModule = null;

  // Leaving the mobile variant cleans up at once, before a desktop stage is built (these
  // listeners run before gsap.matchMedia's). Entering it waits a frame, so a reverting
  // desktop stage has restored the document before the mobile variant measures it.
  const sync = () => {
    if (!mobile.matches && cleanupMobile) {
      cleanupMobile();
      cleanupMobile = null;
    }
    if (mobile.matches && !cleanupMobile) {
      requestAnimationFrame(() => {
        if (mobile.matches && !cleanupMobile) cleanupMobile = initMobile(stage);
      });
    }
    // Once loaded, the desktop module follows the conditions itself (gsap.matchMedia).
    if (desktop.matches && !desktopModule) {
      desktopModule = import('./stage-desktop.js')
        .then((m) => m.init(stage, queries))
        .catch(() => {
          // The chunk failed to load: the document stays static; try again on the next change.
          desktopModule = null;
        });
    }
  };

  desktop.addEventListener('change', sync);
  mobile.addEventListener('change', sync);
  sync();

  import('./home-motion.js')
    .then((m) => m.init())
    .catch(() => {
      // The chunk failed to load: the photo band and the Contact band stay still.
    });
}
