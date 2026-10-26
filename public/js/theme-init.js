// Author: Rasel Al Mamun
// FD-12: runs synchronously before first paint (first element in <head>, not bundled).
// Dark is the default :root theme; only a stored "light" choice sets data-theme.
(function () {
  const root = document.documentElement;
  root.classList.add('js');
  try {
    let theme = localStorage.getItem('theme');
    if (!theme) {
      const match = document.cookie.match(/(?:^|;\s*)theme=(dark|light)\b/);
      theme = match && match[1];
    }
    if (theme === 'light') root.setAttribute('data-theme', 'light');
  } catch {
    // Storage or cookies blocked: stay on the dark default.
  }
})();
