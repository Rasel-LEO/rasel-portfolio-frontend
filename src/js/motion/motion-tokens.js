// Author: Rasel Al Mamun
// Motion tokens (_tokens.scss) for the GSAP modules (stage-desktop.js, home-motion.js): the
// only source of their easings, durations and distances.
const rootStyle = () => getComputedStyle(document.documentElement);
export const token = (name) => rootStyle().getPropertyValue(name).trim();
export const px = (name) => parseFloat(token(name));
// Durations in either unit: the production CSS minifier writes 480ms as .48s.
export const seconds = (name) => {
  const value = token(name);
  return parseFloat(value) / (value.endsWith('ms') ? 1000 : 1);
};

// A CSS cubic-bezier() as an easing function for GSAP (Newton, then bisection).
function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const x = (t) => ((ax * t + bx) * t + cx) * t;
  const y = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (progress) => {
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;
    let t = progress;
    for (let i = 0; i < 6; i += 1) {
      const error = x(t) - progress;
      if (Math.abs(error) < 1e-6) return y(t);
      const slope = dx(t);
      if (Math.abs(slope) < 1e-6) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = progress;
    while (hi - lo > 1e-6) {
      if (x(t) < progress) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return y(t);
  };
}

export function ease(name) {
  const value = token(name);
  const match = /cubic-bezier\(([^)]+)\)/.exec(value);
  if (!match) return 'none';
  const [x1, y1, x2, y2] = match[1].split(',').map(Number);
  return cubicBezier(x1, y1, x2, y2);
}
