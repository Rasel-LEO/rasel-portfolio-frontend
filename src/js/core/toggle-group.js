// Author: Rasel Al Mamun
// A toggle group of aria-pressed buttons (Portfolio, Blog); `apply(value)` does the
// filtering and the button's data-count-text goes to the polite live region.
export function toggleGroup(group, key, liveRegion, apply) {
  const buttons = [...group.querySelectorAll(`[data-${key}]`)];
  const select = (button) => {
    for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
    liveRegion.textContent = button.dataset.countText;
    apply(button.dataset[key]);
  };
  group.addEventListener('click', (event) => {
    const button = event.target.closest(`[data-${key}]`);
    if (button) select(button);
  });
  group.hidden = false;
}
