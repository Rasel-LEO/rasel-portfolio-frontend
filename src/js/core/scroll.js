// Author: Rasel Al Mamun
// Page scrolling shared by the shell and the motion modules. While smooth scrolling runs
// (Lenis on fine-pointer desktops), jumps and smooth scrolls go through it so
// the two never fight; otherwise they are native.
let current = null;
const subscribers = new Set();

// motion.js registers the Lenis instance (or null when it is destroyed).
export function setSmoothScroll(instance) {
  current = instance;
  for (const subscriber of subscribers) subscriber.run(instance);
}

// Unregister an instance only if it is still the current one.
export function clearSmoothScroll(instance) {
  if (current === instance) setSmoothScroll(null);
}

// Run setup(lenis) now and whenever smooth scrolling starts; its returned function runs when
// smooth scrolling stops or on unsubscribe (the return value of onSmoothScroll).
export function onSmoothScroll(setup) {
  const subscriber = {
    cleanup: null,
    run(instance) {
      subscriber.cleanup?.();
      subscriber.cleanup = instance ? (setup(instance) ?? null) : null;
    },
  };
  subscribers.add(subscriber);
  if (current) subscriber.run(current);
  return () => {
    subscriber.cleanup?.();
    subscribers.delete(subscriber);
  };
}

// duration (seconds) bounds a smooth scroll through Lenis; a native smooth scroll keeps the
// browser's own.
export function scrollToY(top, { smooth = false, duration } = {}) {
  if (current) current.scrollTo(top, { immediate: !smooth, force: true, duration });
  else window.scrollTo({ top, behavior: smooth ? 'smooth' : 'instant' });
}

// Instant jumps the motion must not play through (back-to-top's fade-jump, FD-70; stage focus
// jumps, FD-53): after the scroll, every subscriber snaps its scrubbed animation to it.
const jumpSubscribers = new Set();

export function onJump(snap) {
  jumpSubscribers.add(snap);
  return () => jumpSubscribers.delete(snap);
}

export function jumpTo(top) {
  scrollToY(top);
  for (const snap of jumpSubscribers) snap();
}
