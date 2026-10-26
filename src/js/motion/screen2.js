// Author: Rasel Al Mamun
// Home screen 2 entrance (FD-85): played, never scrubbed. The desktop stage (stage-desktop.js)
// plays it when its timeline reaches screen 2 and fades the layer out when it leaves; below
// 992 px stage.js plays it once when the block comes into view. Transform and opacity only;
// reduced motion and no JS never load it (the static document). The layer's data-screen2
// says where it is: playing, shown, leaving or hidden (tests and screenshots wait on it).
import { gsap } from 'gsap';
import { ease, px } from './motion-tokens.js';

// FD-100 values (faster than FD-85: the left side is complete in about 0.55 s) in seconds and
// px; the head's rise (--m-8) is a token, read when the entrance is built.
const TIMING = {
  head: 0.25, // eyebrow + headline fade and rise, at once
  support: 0.2,
  supportAt: 0.04,
  pillars: 0.22, // rules draw from the left, text fades
  pillarsAt: 0.08,
  row: 0.2, // Areas of work, row by row after the pillars
  rowStagger: 0.03,
  rowRise: 6,
  out: 0.18, // leaving screen 2, either way (unchanged)
};

// The grid's items grouped by row, read from the layout when the entrance is built.
function rowsOf(items) {
  const rows = new Map();
  for (const item of items) {
    const top = Math.round(item.offsetTop);
    if (!rows.has(top)) rows.set(top, []);
    rows.get(top).push(item);
  }
  return [...rows.keys()].sort((a, b) => a - b).map((top) => rows.get(top));
}

export function createScreen2(layer) {
  const q = (selector) => [...layer.querySelectorAll(selector)];
  const eOut = ease('--e-out');
  const rise = px('--m-8');
  const state = (value) => {
    layer.dataset.screen2 = value;
  };
  const tl = gsap.timeline({
    paused: true,
    defaults: { ease: eOut },
    onComplete: () => state('shown'),
  });

  tl.fromTo(
    q('.screen2-eyebrow, .screen2-headline'),
    { opacity: 0, y: rise },
    { opacity: 1, y: 0, duration: TIMING.head },
    0,
  );
  tl.fromTo(
    q('.screen2-support'),
    { opacity: 0 },
    { opacity: 1, duration: TIMING.support },
    TIMING.supportAt,
  );
  tl.fromTo(
    q('.pillar-rule'),
    { scaleX: 0 },
    { scaleX: 1, duration: TIMING.pillars },
    TIMING.pillarsAt,
  );
  tl.fromTo(
    q('.pillar-head, .pillar-lines'),
    { opacity: 0 },
    { opacity: 1, duration: TIMING.pillars },
    TIMING.pillarsAt,
  );
  // The label comes with the first row.
  const rows = rowsOf(q('.screen2-grid > li'));
  if (rows.length) rows[0].unshift(...q('.screen2-areas-title'));
  rows.forEach((row, i) => {
    tl.fromTo(
      row,
      { opacity: 0, y: TIMING.rowRise },
      { opacity: 1, y: 0, duration: TIMING.row },
      TIMING.pillarsAt + TIMING.pillars + i * TIMING.rowStagger,
    );
  });

  let out = null;
  const stopOut = () => {
    out?.kill();
    out = null;
  };

  return {
    timeline: tl,
    // Entering: from the start, then still.
    play() {
      stopOut();
      gsap.set(layer, { opacity: 1 });
      state('playing');
      tl.restart();
    },
    // At once (keyboard focus, FD-53; a jump, FD-70).
    show() {
      stopOut();
      gsap.set(layer, { opacity: 1 });
      tl.progress(1).pause();
      state('shown');
    },
    // Leaving: the layer fades out, then the entrance waits at its start for the next visit.
    hide(instant = false) {
      stopOut();
      // An entrance still playing stops where it is, so it never reports itself shown.
      tl.pause();
      if (instant) {
        gsap.set(layer, { opacity: 0 });
        tl.pause(0);
        state('hidden');
        return;
      }
      state('leaving');
      out = gsap.to(layer, {
        opacity: 0,
        duration: TIMING.out,
        ease: eOut,
        onComplete: () => {
          tl.pause(0);
          state('hidden');
        },
      });
    },
    revert() {
      stopOut();
      tl.revert();
      gsap.set(layer, { clearProps: 'opacity' });
      delete layer.dataset.screen2;
    },
  };
}
