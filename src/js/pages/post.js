// Author: Rasel Al Mamun
// Post (FD-114). Without JS "On this page" links jump to the sections. This module marks the
// link of the section being read (aria-current): the last h2 above the reading line (a third of
// the viewport down), none above the first.
export function init() {
  const toc = document.querySelector('[data-post-toc]');
  if (!toc) return;
  const pairs = [...toc.querySelectorAll('a[href^="#"]')]
    .map((link) => [link, document.getElementById(link.hash.slice(1))])
    .filter(([, heading]) => heading);
  if (!pairs.length) return;
  const links = pairs.map(([link]) => link);
  const headings = pairs.map(([, heading]) => heading);

  let frame = 0;
  const mark = () => {
    frame = 0;
    const line = window.innerHeight / 3;
    let current = -1;
    headings.forEach((heading, i) => {
      if (heading.getBoundingClientRect().top <= line) current = i;
    });
    links.forEach((link, i) => {
      if (i === current) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(mark);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  mark();
}
