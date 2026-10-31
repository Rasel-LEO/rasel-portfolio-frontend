// Author: Rasel Al Mamun
// Cursor follower (FD-82): a companion to the system cursor, which
// always stays visible. One fixed, aria-hidden element; created only on fine pointers with
// motion allowed (motion.js). States: idle (a 10 px ring) everywhere by default; stage (a
// 56 px soft filled circle) over the staged Home stage at 992 px and up; link (a 28 px ring);
// button (the button's box + 6 px); pressed; hidden over form fields (input). A link or button
// inside the stage keeps its own state; no card halo. Also hidden on keyboard use until the
// next mouse move, on touch, and when the pointer leaves the window. Only transform and opacity change: a size change
// is played back from the previous size by scale (FLIP), and the frame loop sleeps when
// nothing moves. A hovered button's box is read when it is entered and again only after
// something may have moved it (a scroll, the magnetic pull), never on every frame.
const LAG = 0.18; // per 60 Hz frame (--cursor-lag 90 ms)
const SNAP = 0.25; // toward a button's centre and back to scale 1
const FRAME = 1000 / 60; // the rates above are per 60 Hz frame; faster screens get the same speed
const PAD = 6; // around a button
const desktop = matchMedia('(min-width: 992px)');
const SIZES = { idle: 10, link: 28, stage: 56 };
// The states in which the follower shows.
const SHOWN = new Set(['idle', 'stage', 'link', 'button']);
const KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

function stateFor(target) {
  if (!(target instanceof Element)) return { state: 'idle' };
  if (target.closest('input, textarea, select, [contenteditable="true"]'))
    return { state: 'input' };
  // The back-to-top photo gets the round ring, not a rectangle over the photograph.
  if (target.closest('[data-back-to-top]')) return { state: 'link' };
  const button = target.closest('.btn, button');
  if (button) return { state: 'button', target: button };
  if (target.closest('a[href]')) return { state: 'link' };
  if (target.closest('[data-stage].is-staged') && desktop.matches) return { state: 'stage' };
  return { state: 'idle' };
}

export function init() {
  const ring = document.createElement('div');
  ring.className = 'cursor-ring';
  ring.setAttribute('aria-hidden', 'true');
  document.body.append(ring);

  let state = 'idle';
  let target = null;
  let size = { w: SIZES.idle, h: SIZES.idle };
  let pointer = null; // last mouse position
  const pos = { x: 0, y: 0 };
  const scale = { x: 1, y: 1 };
  let pressed = false;
  let visible = false;
  let frame = 0;
  let last = 0;
  let buttonBox = null; // the hovered button's centre, null when it must be read again

  const setSize = (w, h) => {
    if (w === size.w && h === size.h) return;
    // FLIP: the box takes its new size at once and starts scaled to look like the old one.
    scale.x *= size.w / w;
    scale.y *= size.h / h;
    size = { w, h };
    ring.style.width = `${w}px`;
    ring.style.height = `${h}px`;
  };

  const tick = (now) => {
    frame = 0;
    if (!pointer) return;
    const steps = last ? Math.min(4, (now - last) / FRAME) : 1;
    last = now;
    const ease = (rate) => 1 - (1 - rate) ** steps;
    let goal = pointer;
    if (state === 'button' && target?.isConnected) {
      if (!buttonBox) {
        // Size from the untransformed box (a pressed button scales), centre from the
        // visible one (it follows the magnetic pull).
        const box = target.getBoundingClientRect();
        setSize(target.offsetWidth + PAD * 2, target.offsetHeight + PAD * 2);
        buttonBox = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      }
      goal = buttonBox;
    }
    const rate = ease(state === 'button' ? SNAP : LAG);
    pos.x += (goal.x - pos.x) * rate;
    pos.y += (goal.y - pos.y) * rate;
    const press = pressed ? 0.8 : 1;
    scale.x += (press - scale.x) * ease(SNAP);
    scale.y += (press - scale.y) * ease(SNAP);
    ring.style.transform = `translate3d(${pos.x - size.w / 2}px, ${pos.y - size.h / 2}px, 0) scale(${scale.x.toFixed(4)}, ${scale.y.toFixed(4)})`;
    const still =
      Math.abs(goal.x - pos.x) < 0.1 &&
      Math.abs(goal.y - pos.y) < 0.1 &&
      Math.abs(press - scale.x) < 0.001 &&
      Math.abs(press - scale.y) < 0.001;
    if (still) last = 0;
    else frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };
  // Something may have moved the hovered button: read its box on the next frame.
  const restale = () => {
    buttonBox = null;
    if (state === 'button') wake();
  };

  const show = (on) => {
    visible = on;
    ring.classList.toggle('is-on', on && SHOWN.has(state));
  };
  const setState = (next) => {
    state = next.state;
    target = next.target ?? null;
    buttonBox = null;
    ring.dataset.state = state;
    if (state !== 'button') setSize(SIZES[state] ?? SIZES.idle, SIZES[state] ?? SIZES.idle);
    show(visible);
    wake();
  };

  const onMove = (event) => {
    if (event.pointerType !== 'mouse') {
      show(false);
      return;
    }
    if (!pointer) {
      pos.x = event.clientX;
      pos.y = event.clientY;
    }
    pointer = { x: event.clientX, y: event.clientY };
    // The magnetic pull follows the pointer, so the button may have moved.
    if (state === 'button') buttonBox = null;
    show(true);
    wake();
  };
  const onOver = (event) => {
    if (event.pointerType === 'mouse') setState(stateFor(event.target));
  };
  const onDown = (event) => {
    if (event.pointerType !== 'mouse') return show(false);
    pressed = true;
    return wake();
  };
  const onUp = () => {
    pressed = false;
    wake();
  };
  const onKey = (event) => {
    if (KEYS.has(event.key)) show(false);
  };
  const onOut = (event) => {
    if (!event.relatedTarget) show(false);
  };
  const onBlur = () => show(false);

  document.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', restale, { passive: true });
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerdown', onDown);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointerout', onOut);
  window.addEventListener('blur', onBlur);
  setState({ state: 'idle' });

  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('pointermove', onMove);
    window.removeEventListener('scroll', restale);
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('pointerout', onOut);
    window.removeEventListener('blur', onBlur);
    ring.remove();
  };
}
