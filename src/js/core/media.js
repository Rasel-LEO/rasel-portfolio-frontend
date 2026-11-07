// Author: Rasel Al Mamun
// 1.7.4 (F22): shared helpers that every module used its own copy of — the OS motion queries, the
// design-token reader and the "plain click" rule.

// The OS motion setting (DD-16: motion is always on; the OS preference is respected silently).
export const MOTION = '(prefers-reduced-motion: no-preference)';
export const REDUCED = '(prefers-reduced-motion: reduce)';

// A custom property of :root (_tokens.scss), trimmed.
export const token = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// A duration token in milliseconds, in either unit: the production CSS minifier writes 320ms
// as .32s.
export const ms = (name, fallback) => {
  const value = token(name);
  return parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) || fallback;
};

// A click the page may handle itself: the main button, no modifier key (a new tab or window, a
// download), and not already handled by another listener.
export const isPlainClick = (event) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.shiftKey &&
  !event.altKey;
