// Author: Rasel Al Mamun
// Desktop Home stage (≥ 992 px, motion allowed): the pinned scroll stage of the motion map
// (docs/architecture.md, handoff §4, FD-69). The container sticks under the header for
// 360 svh (CSS: from the first paint, FD-66); one timeline, scrubbed with 0.8 s of smoothing,
// maps stage progress p (0–1) to the layers.
// Only transform and opacity animate. Layout is read on setup and on ScrollTrigger refresh,
// never in scroll or pointer handlers.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ease, px, seconds, token } from './motion-tokens.js';
import { createScreen2 } from './screen2.js';
import { jumpTo, onJump, onSmoothScroll } from '../core/scroll.js';

gsap.registerPlugin(ScrollTrigger);

const FINE = '(hover: hover) and (pointer: fine)';

// Where each layer is fully shown, and where focus takes the stage when it is not (FD-53,
// FD-60, FD-69, FD-98). Outside these ranges the hero takes no pointer, so nothing half-shown
// can be clicked; a Fork card takes it by its own opacity (FD-96, FORK_SOLID). Screen 2
// (FD-85) is the range from the hero's exit (8–16 %) until the Fork is half seen (65.8 %): its
// content plays when the timeline enters it and fades out on leaving. The Fork's range is
// documentary; its focus target is `at` (a card's pointer follows its opacity).
const SHOWN = {
  hero: { from: 0, to: 0.08, at: 0 },
  statement: { from: 0.16, to: 0.658, at: 0.41 },
  fork: { from: 0.78, to: 1, at: 0.9 },
};
const shown = (name, p) => p >= SHOWN[name].from && p <= SHOWN[name].to;
// FD-96: a Fork card takes the pointer once it is this opaque, wherever the scrub has it.
const FORK_SOLID = 0.95;
const inScreen2 = (p) => p >= SHOWN.statement.from && p < SHOWN.statement.to;

// FD-54, FD-97: the figure reaches the back-to-top box at 65 % and the two swap in one frame
// there — never two portraits or two shadows at once, no cross-fade.
const HANDOFF = 0.65;
// Scrub smoothing in seconds (FD-69).
const SCRUB = 0.8;

// Each Fork column's own perspective while it opens (prototype).
const PERSPECTIVE = 1200;

// FD-98: no empty stage. The figure first shrinks into the corner, fast (56–65 %), so it has
// left the Fork's place before the Fork comes in (FD-88); the Fork's content then comes in
// over FORK_FADE from 65.5 % and screen 2 leaves once it is half seen (65.8 %), so the two
// never rest on top of each other; the columns turn and settle over FORK_OPEN_FOR.
const SHRINK = 0.56;
const FORK_OPEN = 0.655;
const FORK_FADE = 0.02;
const FORK_OPEN_FOR = 0.12;

function createCue() {
  const cue = document.createElement('p');
  cue.className = 'stage-cue';
  cue.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 4v16M6 14l6 6 6-6');
  svg.append(path);
  cue.append(svg, 'Scroll — the figure moves with you');
  return cue;
}

// An element's untransformed offset inside a positioned ancestor, whatever lies between: while
// the entrance (FD-67) moves the photo's column, that column is the figure's offsetParent.
function offsetIn(el, ancestor) {
  let left = 0;
  let top = 0;
  let node = el;
  for (; node && node !== ancestor; node = node.offsetParent) {
    left += node.offsetLeft;
    top += node.offsetTop;
  }
  if (node !== ancestor) throw new Error('stage: the figure is not inside the frame');
  return { left, top };
}

// The stage nodes, or null when one is missing (then the document stays static).
function stageNodes(stage) {
  const q = (selector, root = stage) => root?.querySelector(selector) ?? null;
  const nodes = {
    frame: q(':scope > .container'),
    main: q('.stage-main'),
    figure: q('[data-stage-figure]'),
    plane: q('[data-stage-figure] picture'),
    photo: q('[data-stage-figure] img'),
    hero: q('[data-stage-hero]'),
    statementLayer: q('[data-stage-statement]'),
    fork: q('[data-stage-fork]'),
    forkTitle: q('[data-stage-fork] .fork-title'),
    forkCols: q('[data-stage-fork] .fork-cols'),
    colPortfolio: q('[data-fork-col="portfolio"]'),
    colBlog: q('[data-fork-col="blog"]'),
    seam: q('[data-stage-fork] .fork-seam'),
    button: q('[data-back-to-top]', document),
    sentinel: q('[data-back-to-top-sentinel]', document),
  };
  return Object.values(nodes).every(Boolean) ? nodes : null;
}

// Every layer must fit the pinned frame (short windows, large text); otherwise part of it
// could never be reached. Offsets ignore transforms, so the scrub state does not matter.
function fits(stage, nodes) {
  const { frame, main, fork, forkTitle, forkCols } = nodes;
  const staged = stage.classList.contains('is-staged');
  stage.classList.add('is-staged');
  const forkStyle = getComputedStyle(fork);
  const forkNeed =
    parseFloat(forkStyle.paddingTop) +
    forkTitle.offsetHeight +
    parseFloat(getComputedStyle(forkTitle).marginBottom) +
    forkCols.offsetHeight +
    parseFloat(forkStyle.paddingBottom);
  const ok =
    main.offsetTop + main.offsetHeight <= frame.clientHeight && forkNeed <= fork.clientHeight;
  if (!staged) stage.classList.remove('is-staged');
  return ok;
}

function buildStage(stage, nodes, { fine, context }) {
  const { frame, figure, plane, photo, hero, statementLayer } = nodes;
  const { fork, forkTitle, forkCols, colPortfolio, colBlog, seam, button, sentinel } = nodes;

  let tl = null;
  let cue = null;
  let screen2 = null;
  let measure = null;
  let onFocus = null;
  let onMove = null;
  let onLeave = null;
  let resetHero = null;
  let restPhoto = null;
  let clearHero = null;
  let heroShown = true;
  let offSmooth = null;
  let offJump = null;

  // Undoes what gsap.matchMedia does not revert by itself (and, after a throw, the rest).
  const undo = () => {
    if (onFocus) frame.removeEventListener('focusin', onFocus);
    if (onMove) stage.removeEventListener('pointermove', onMove);
    if (onLeave) stage.removeEventListener('pointerleave', onLeave);
    if (measure) ScrollTrigger.removeEventListener('refreshInit', measure);
    offSmooth?.();
    offJump?.();
    clearHero?.();
    cue?.remove();
    figure.style.removeProperty('visibility');
    screen2?.revert();
    sentinel.style.removeProperty('height');
    for (const el of [hero, statementLayer, colPortfolio, colBlog]) el.classList.remove('is-off');
    button.classList.remove('is-handoff', 'is-held');
    stage.classList.remove('is-staged', 'is-active');
    delete stage.dataset.stageMode;
  };

  // The stage does not fit or failed to build: the static document, also for the first-paint
  // CSS (FD-66).
  const unstage = () => {
    undo();
    stage.classList.add('is-unstaged');
    // The page is 360 svh shorter now: the other scroll triggers (home-motion.js) re-measure.
    ScrollTrigger.refresh();
  };

  try {
    stage.classList.remove('is-unstaged');
    stage.classList.add('is-staged');
    // Checked with the class on, so the first build changes the layout once (toggling it
    // off and on again within one task showed up as a layout shift in Chrome).
    if (!fits(stage, nodes)) {
      unstage();
      return undefined;
    }
    cue = createCue();
    frame.append(cue);

    const eOut = ease('--e-out');
    const eInOut = ease('--e-inout');
    const m24 = px('--m-24');
    const m40 = px('--m-40');
    const rotCol = parseFloat(token('--rot-col'));
    const stickyTop = parseFloat(getComputedStyle(frame).top) || 0;

    // The figure ends as the back-to-top photo (FD-54): its lower-right corner on the
    // button's, its height the button's, so the hand-off swaps the same image at the same
    // size and place (FD-97). From untransformed offsets (the scrub state does not matter);
    // also the viewport size the pointer handler uses. The figure is in the corner before the
    // Fork comes in (FD-98), so it never crosses a card's text or actions (FD-88).
    const geo = { dx: 0, dy: 0, scale: 1, vw: 1, vh: 1, shift: 0 };
    measure = () => {
      const frameLeft = frame.getBoundingClientRect().left;
      const offset = offsetIn(figure, frame);
      const left = frameLeft + offset.left;
      const top = stickyTop + offset.top;
      const box = getComputedStyle(button);
      const right = parseFloat(box.right) || px('--s-5');
      const bottom = parseFloat(box.bottom) || px('--s-5');
      const height = parseFloat(box.height) || px('--btt-h');
      geo.vw = document.documentElement.clientWidth;
      geo.vh = window.innerHeight;
      geo.dx = geo.vw - right - (left + figure.offsetWidth);
      geo.dy = geo.vh - bottom - (top + figure.offsetHeight);
      geo.scale = height / figure.offsetHeight;
      const colLeft = (col) => frameLeft + fork.offsetLeft + forkCols.offsetLeft + col.offsetLeft;
      // The columns open from ∓--m-40 and ±--rot-col, but never from beyond the window's
      // edges (the Fork is full width; at 1024–1280 px the side margin is under 40 px). The
      // turned column's outer edge comes forward and grows by `grow` in perspective.
      const half = colBlog.offsetWidth / 2;
      const turn = (rotCol * Math.PI) / 180;
      const grow =
        half * ((Math.cos(turn) * PERSPECTIVE) / (PERSPECTIVE - half * Math.sin(turn)) - 1);
      const room = Math.min(
        colLeft(colPortfolio),
        geo.vw - (colLeft(colBlog) + colBlog.offsetWidth),
      );
      geo.shift = Math.max(0, Math.min(m40, Math.floor(room - grow - 1)));
    };
    measure();
    // Every refresh measures again, a resize included (ScrollTrigger refreshes on it).
    ScrollTrigger.addEventListener('refreshInit', measure);
    // The Fork's columns change size once the web fonts are in, and the entrance (FD-67) may
    // still move the photo's column: measure again once both are done, so the hand-off target
    // never keeps a value read during the entrance (FD-97).
    const entrance = figure.closest('.stage-figure-col')?.getAnimations() ?? [];
    Promise.all([
      document.fonts?.ready,
      ...entrance.map((animation) => animation.finished.catch(() => {})),
    ]).then(() => {
      if (stage.classList.contains('is-staged')) ScrollTrigger.refresh();
    });

    // The back-to-top sentinel ends where the stage starts: from there the timeline decides
    // whether the button or the figure is seen (FD-97, syncHandoff), in both directions.
    const placeSentinel = (self) => {
      sentinel.style.height = `${Math.max(1, self.start)}px`;
    };

    const setStates = (p) => {
      // The hero's pointer tilt rests once the hero leaves (on that edge only).
      if (heroShown && !shown('hero', p)) resetHero?.();
      heroShown = shown('hero', p);
      hero.classList.toggle('is-off', !heroShown);
    };

    // Screen 2 (FD-85) follows the timeline, not the scroll position, so it never plays while
    // the scrub's smoothing still shows the hero. `instant` (a jump, keyboard focus) shows or
    // hides it at once. Its pointer state follows the same progress, so it never takes a click
    // while it is still invisible over the hero.
    screen2 = createScreen2(statementLayer);
    screen2.hide(true);
    statementLayer.classList.add('is-off');
    let screen2On = false;
    let instant = false;
    const syncScreen2 = (p) => {
      const on = inScreen2(p);
      if (on === screen2On) return;
      screen2On = on;
      statementLayer.classList.toggle('is-off', !on);
      if (on && instant) screen2.show();
      else if (on) screen2.play();
      else screen2.hide(instant);
    };

    // FD-96: each Fork card takes the pointer from the frame it is seen (nearly) in full.
    const cols = [colPortfolio, colBlog];
    const solid = (col) => parseFloat(col.style.opacity || '0') >= FORK_SOLID;
    const syncFork = () => {
      for (const col of cols) col.classList.toggle('is-off', !solid(col));
    };

    // FD-97: one write for both, on the timeline's own progress, so the figure and the button
    // swap in the same frame: before the hand-off the figure, from it the button (.is-held
    // hides it and takes its pointer; .is-handoff: no fade while the stage runs).
    let photoAtRest = false;
    const syncHandoff = (p) => {
      // The photo lands untilted on the button's (FD-97): the pointer tilt rests from the
      // shrink on.
      if (p >= SHRINK && !photoAtRest) restPhoto?.();
      photoAtRest = p >= SHRINK;
      const handed = p >= HANDOFF;
      figure.style.visibility = handed ? 'hidden' : '';
      button.classList.toggle('is-held', !handed);
      button.classList.toggle('is-handoff', p < 1);
    };

    // Everything that follows the timeline's own progress. On every rendered frame; also on a
    // refresh and on scroll, as a refresh can set the timeline's progress without an update
    // event (a page opened or reloaded below the stage).
    const syncAll = () => {
      if (!tl) return;
      const p = tl.progress();
      syncScreen2(p);
      syncFork();
      syncHandoff(p);
    };

    tl = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: syncAll,
      scrollTrigger: {
        trigger: stage,
        start: () => `top ${stickyTop}px`,
        end: 'bottom bottom',
        scrub: SCRUB,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          setStates(self.progress);
          syncAll();
        },
        onToggle: (self) => stage.classList.toggle('is-active', self.isActive),
        onRefresh: (self) => {
          placeSentinel(self);
          syncAll();
        },
      },
    });

    // FD-69 map. 0–8 %: the hero holds while the scroll cue fades.
    tl.fromTo(cue, { opacity: 1 }, { opacity: 0, duration: 0.08 }, 0);
    // 8–16 %: the hero leaves; from 16 % screen 2 plays (above), so no ghost of the name stays
    // behind it. 8–26 %: the plane turns, approaches and grows about the face. The hero and the
    // plane start at rest, so nothing is written to them until they move (an early no-op
    // transform on the hero was reported by Chrome as a layout shift).
    const fromRest = { immediateRender: false };
    tl.fromTo(
      hero,
      { opacity: 1, y: 0 },
      { opacity: 0, y: -m24, duration: 0.08, ease: eOut, ...fromRest },
      0.08,
    );
    tl.fromTo(
      plane,
      { rotationY: 0, z: 0, scale: 1 },
      { rotationY: -9, z: 40, scale: 1.1, duration: 0.18, ease: eInOut, ...fromRest },
      0.08,
    );
    // 26–46 %: hold. 46–56 %: the plane pulls back to rest.
    tl.to(plane, { rotationY: 0, z: 0, scale: 1, duration: 0.1, ease: eInOut }, 0.46);
    // 56–65 %: the figure shrinks into the back-to-top box, fast and eased (FD-98), while
    // screen 2 still stands. It lands as the button looks at rest (FD-97): at its opacity
    // (--btt-rest), its floor shadow gone (the button's photo has its own).
    const rest = parseFloat(getComputedStyle(button).getPropertyValue('--btt-rest')) || 1;
    tl.set(figure, { transformOrigin: '100% 100%' }, 0);
    tl.to(
      figure,
      {
        x: () => geo.dx,
        y: () => geo.dy,
        scale: () => geo.scale,
        opacity: rest,
        '--figure-floor': 0,
        duration: HANDOFF - SHRINK,
        ease: eInOut,
      },
      SHRINK,
    );
    // From 65.5 %: the Fork comes in as screen 2 leaves (67 %, above) — heading and columns
    // half seen within FORK_FADE; the columns turn in from ±--rot-col and ∓--m-40 (each with
    // its own perspective, as in the prototype) and the seam draws top → bottom over
    // FORK_OPEN_FOR.
    tl.fromTo(
      forkTitle,
      { opacity: 0 },
      { opacity: 1, duration: FORK_FADE, ease: eOut },
      FORK_OPEN,
    );
    tl.fromTo(forkTitle, { y: m24 }, { y: 0, duration: FORK_OPEN_FOR / 2, ease: eOut }, FORK_OPEN);
    for (const [col, sign] of [
      [colPortfolio, 1],
      [colBlog, -1],
    ]) {
      tl.fromTo(col, { opacity: 0 }, { opacity: 1, duration: FORK_FADE, ease: eOut }, FORK_OPEN);
      tl.fromTo(
        col,
        { rotationY: sign * rotCol, x: () => -sign * geo.shift, transformPerspective: PERSPECTIVE },
        { rotationY: 0, x: 0, duration: FORK_OPEN_FOR, ease: eOut },
        FORK_OPEN,
      );
    }
    tl.fromTo(
      seam,
      { xPercent: -50, x: 0, scaleY: 0, transformOrigin: '50% 0' },
      { scaleY: 1, duration: FORK_OPEN_FOR, ease: eOut },
      FORK_OPEN,
    );
    // From 65 % the back-to-top button stands where the figure was (syncHandoff, FD-97); the
    // Fork holds to the end. A no-op tween keeps the timeline's length to 100 %.
    tl.set({}, {}, 1);

    const st = tl.scrollTrigger;
    placeSentinel(st);
    setStates(st.progress);
    syncAll();

    // An instant jump (back-to-top, a focus jump) shows its target at once: the scrub's
    // smoothing would otherwise play the story through on the way (FD-70); screen 2 shows or
    // goes at once too.
    const settle = () => {
      instant = true;
      ScrollTrigger.update();
      st.getTween()?.progress(1);
      tl.progress(st.progress);
      instant = false;
    };
    offJump = onJump(settle);

    // FD-53: keyboard focus inside a layer that is not fully shown takes the stage to where
    // it is; inside screen 2 its content shows at once (FD-85). Pointer focus (mousedown)
    // never moves the page under the pointer.
    const layers = { hero, statement: statementLayer, fork };
    onFocus = (event) => {
      if (!event.target.matches(':focus-visible')) return;
      const name = Object.keys(layers).find((key) => layers[key].contains(event.target));
      if (!name) return;
      const seen = name === 'fork' ? cols.every(solid) : shown(name, st.progress);
      if (!seen) jumpTo(st.start + SHOWN[name].at * (st.end - st.start));
      else if (name === 'statement') settle();
      if (name === 'statement' && screen2On) screen2.show();
    };
    frame.addEventListener('focusin', onFocus);

    // Smooth scrolling (B7): Lenis reports to ScrollTrigger and runs on the GSAP ticker while
    // the stage is built; its own frame loop takes over again afterwards.
    offSmooth = onSmoothScroll((lenis) => {
      const offScroll = lenis.on('scroll', ScrollTrigger.update);
      const tick = (time) => lenis.raf(time * 1000);
      lenis.useOwnLoop(false);
      gsap.ticker.add(tick);
      gsap.ticker.lagSmoothing(0);
      return () => {
        offScroll();
        gsap.ticker.remove(tick);
        gsap.ticker.lagSmoothing(500, 33);
        lenis.useOwnLoop(true);
      };
    });

    // Pointer (fine pointers), anywhere over the stage (it spans the window); no layout
    // reads in the handler.
    // - The photo: ±6° rotateY / ±3° rotateX toward the pointer, until the shrink (56 %).
    // - While the hero is shown (0–10 %, B4): the hero tilts ±--tilt-hero toward the pointer
    //   and the name lines move 8 / 4 px against it.
    if (fine) {
      const duration = seconds('--d-scene');
      const toY = gsap.quickTo(photo, 'rotationY', { duration, ease: eOut });
      const toX = gsap.quickTo(photo, 'rotationX', { duration, ease: eOut });
      const tilt = parseFloat(token('--tilt-hero')) || 2;
      const [line1, line2] = hero.querySelectorAll('.hero-line');
      // The hero's perspective is set on the first move, so nothing is written to the hero at
      // build time (FD-57: no early transform on it).
      let heroReady = false;
      const heroY = gsap.quickTo(hero, 'rotationY', { duration, ease: eOut });
      const heroX = gsap.quickTo(hero, 'rotationX', { duration, ease: eOut });
      const line1X = line1 ? gsap.quickTo(line1, 'x', { duration, ease: eOut }) : () => {};
      const line2X = line2 ? gsap.quickTo(line2, 'x', { duration, ease: eOut }) : () => {};
      // Only once the pointer has tilted the hero: a reset restarts the tweens, and a
      // restarted tween would record (and on revert restore) the hero's scrubbed offset.
      resetHero = () => {
        if (!heroReady) return;
        heroY(0);
        heroX(0);
        line1X(0);
        line2X(0);
      };
      clearHero = () => {
        if (heroReady) gsap.set([hero, line1, line2].filter(Boolean), { clearProps: 'transform' });
      };
      restPhoto = () => {
        toY(0);
        toX(0);
      };
      onMove = (event) => {
        const x = event.clientX / geo.vw - 0.5;
        const y = event.clientY / geo.vh - 0.5;
        const still = tl.progress() >= SHRINK;
        toY(still ? 0 : x * 12);
        toX(still ? 0 : -y * 6);
        if (!shown('hero', st.progress)) return;
        // Not while the entrance (FD-67) still moves the lines: GSAP would keep its offset.
        const entering = hero
          .getAnimations({ subtree: true })
          .some((animation) => /^enter-/.test(animation.animationName ?? ''));
        if (!heroReady && entering) return;
        if (!heroReady) {
          // In the matchMedia context, so its revert clears it too.
          context.add(() => gsap.set(hero, { transformPerspective: 1600 }));
          heroReady = true;
        }
        heroY(x * 2 * tilt);
        heroX(-y * 2 * tilt);
        line1X(-x * 16);
        line2X(-x * 8);
      };
      onLeave = () => {
        toY(0);
        toX(0);
        resetHero();
      };
      stage.addEventListener('pointermove', onMove);
      stage.addEventListener('pointerleave', onLeave);
    }

    stage.dataset.stageMode = 'desktop';
  } catch (error) {
    // Content stays visible: drop everything this build added and keep the static document.
    tl?.scrollTrigger?.kill();
    tl?.revert();
    gsap.killTweensOf(photo);
    gsap.set(photo, { clearProps: 'transform' });
    unstage();
    console.warn('Home stage disabled:', error);
    return undefined;
  }

  return undo;
}

export function init(stage, queries) {
  const nodes = stageNodes(stage);
  if (!nodes) return null;

  let mm = null;
  const start = () => {
    mm = gsap.matchMedia();
    mm.add({ ...queries, fine: FINE }, (context) => {
      const { desktop, fine } = context.conditions;
      if (!desktop) return undefined;
      return buildStage(stage, nodes, { fine, context });
    });
  };
  start();

  // Whether the layers fit can change without a media condition changing (window height,
  // text size): check again after a resize settles and rebuild when it did.
  let timer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!matchMedia(queries.desktop).matches) return;
      const staged = stage.dataset.stageMode === 'desktop';
      if (fits(stage, nodes) === staged) return;
      mm.revert();
      start();
    }, 200);
  });
  return mm;
}
