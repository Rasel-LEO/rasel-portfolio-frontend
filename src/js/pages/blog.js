// Author: Rasel Al Mamun
// Blog (FD-36, FD-112): without JS every post is listed. This module shows the category tabs
// (the amber underline slides to the pressed one), filters the cards, announces the count and
// shows the empty state when a category has no post.
import { tabInk } from '../core/tab-ink.js';
import { toggleGroup } from '../core/toggle-group.js';

export function init() {
  const group = document.querySelector('[data-category-filter]');
  const count = document.querySelector('[data-category-count]');
  const empty = document.querySelector('[data-blog-empty]');
  if (!group || !count || !empty) return;

  let placeInk = () => {};
  toggleGroup(group, 'category', count, (category) => {
    const items = [...document.querySelectorAll('[data-post-category]')];
    for (const item of items) {
      item.hidden = category !== 'all' && item.dataset.postCategory !== category;
    }
    empty.hidden = items.some((item) => !item.hidden);
    // A filtered category says so; the live count also says it (toggle-group set it first).
    const line = empty.querySelector('[data-empty-category]');
    line.hidden = false;
    empty.querySelector('[data-empty-all]').hidden = true;
    if (!empty.hidden) count.textContent += `. ${line.textContent.trim()}`;
    placeInk();
  });
  placeInk = tabInk(group);
}
