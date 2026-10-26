// Author: Rasel Al Mamun
// Theme switch (FD-12): every [data-theme-toggle] button flips dark ↔ light.
// public/js/theme-init.js has already applied the stored choice before first paint.
const root = document.documentElement;
const ONE_YEAR = 60 * 60 * 24 * 365;

const currentTheme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');

function store(theme) {
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Storage blocked: the cookie below still carries the choice.
  }
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `theme=${theme}; path=/; max-age=${ONE_YEAR}; SameSite=Lax${secure}`;
}

function render(buttons, theme) {
  const label = theme === 'light' ? 'Light' : 'Dark';
  for (const button of buttons) {
    // FD-17: the name carries the state (no aria-pressed); it contains the visible text.
    button.setAttribute('aria-label', `Theme: ${theme}`);
    const state = button.querySelector('[data-theme-state]');
    if (state) state.textContent = label;
  }
}

export function initTheme() {
  const buttons = document.querySelectorAll('[data-theme-toggle]');
  if (!buttons.length) return;

  render(buttons, currentTheme());
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const theme = currentTheme() === 'light' ? 'dark' : 'light';
      root.dataset.theme = theme;
      store(theme);
      render(buttons, theme);
    });
  }
}
