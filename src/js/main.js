// Author: Rasel Al Mamun
import '../scss/main.scss';
import { initBackToTop } from './core/back-to-top.js';
import { initDrawer } from './core/drawer.js';
import { initPageWipe } from './core/page-wipe.js';
import { initTheme } from './core/theme.js';

// Shell, shared by every page.
initTheme();
initDrawer();
initBackToTop();
initPageWipe();

// Run once the OS allows motion (now or later); nothing motion-related loads before (FD-52).
function whenMotion(run) {
  const query = matchMedia('(prefers-reduced-motion: no-preference)');
  if (query.matches) return run();
  const onChange = () => {
    if (!query.matches) return;
    query.removeEventListener('change', onChange);
    run();
  };
  query.addEventListener('change', onChange);
  return undefined;
}

// Page modules, keyed by <body data-page="…">.
const pageModules = {
  home: () => whenMotion(() => import('./motion/stage.js').then((m) => m.init())),
  portfolio: () => import('./pages/portfolio.js').then((m) => m.init()),
  publications: () => import('./pages/portfolio.js').then((m) => m.init()),
  research: () => import('./pages/research.js').then((m) => m.init()),
  blog: () => import('./pages/blog.js').then((m) => m.init()),
  post: () => import('./pages/post.js').then((m) => m.init()),
  hire: () => import('./pages/forms.js').then((m) => m.init()),
  contact: () => import('./pages/forms.js').then((m) => m.init()),
};

const page = document.body.dataset.page;
const loadPage = pageModules[page];
if (loadPage) loadPage();

// Site-wide motion: reveals, tilt, magnetic buttons, cursor ring, smooth scrolling.
whenMotion(() => import('./motion/motion.js').then((m) => m.init()));
