// Author: Rasel Al Mamun
// List pages that grow (FD-154): the projects archive and the Blog. The server-rendered page is
// the source (Django answers ?q=&topic=&category=&page=; the static preview answers the same
// URLs from files), and it works without this script: a GET form, links for the categories and
// the pages. This module only enhances it: a form submit, a topic change, a category tab, a page
// link or "Clear filters" fetches the same URL, swaps the results in place, updates the address
// and the title, moves focus to the results heading and announces the count in a polite live
// region. Any failure falls back to a normal navigation. The browser's Back button works.
// 1.7.4 (F11): the latest request wins — a new one aborts the one before, and a late answer to an
// older one is dropped; Back and Forward between entries that differ only by #hash fetch nothing.
import { isPlainClick } from '../core/media.js';
import { tabInk } from '../core/tab-ink.js';

export function init() {
  const results = document.querySelector('[data-list-results]');
  const announcer = document.querySelector('[data-list-announce]');
  if (!results || !announcer) return;
  const form = document.querySelector('[data-list-form]');

  const bindTabs = () => {
    const group = results.querySelector('[data-category-filter]');
    if (group) tabInk(group);
  };
  bindTabs();

  const sync = (doc, url) => {
    // The form's controls show the query that was asked for (the address), not what the response
    // happens to echo.
    if (form) {
      const asked = new URL(url, location.href).searchParams;
      for (const control of form.elements) {
        if (control.name && 'value' in control) control.value = asked.get(control.name) ?? '';
      }
    }
    document.title = doc.title;
    for (const rel of ['prev', 'next', 'canonical']) {
      document.head.querySelector(`link[rel="${rel}"]`)?.remove();
      const link = doc.head.querySelector(`link[rel="${rel}"]`);
      if (link) document.head.append(link.cloneNode());
    }
  };

  let pending = null;
  let latest = 0;
  // The list state shown now (path and query); a hash-only history entry keeps it.
  let shown = `${location.pathname}${location.search}`;

  async function go(url, { push = true, focus = true } = {}) {
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    latest += 1;
    const request = latest;
    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/html' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      const html = await response.text();
      if (request !== latest) return;
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const next = doc.querySelector('[data-list-results]');
      if (!next) throw new Error('no results region');
      results.replaceChildren(...next.childNodes);
      sync(doc, url);
      if (push) history.pushState({ list: true }, '', url);
      const address = new URL(url, location.href);
      shown = `${address.pathname}${address.search}`;
      bindTabs();
      const heading = results.querySelector('[data-results-heading]');
      if (focus) heading?.focus();
      announcer.textContent =
        results.querySelector('[data-results-status]')?.textContent.trim() ?? '';
    } catch (error) {
      // An aborted request was replaced by a newer one; a stale one is ignored.
      if (error?.name === 'AbortError' || request !== latest) return;
      window.location.assign(url);
    } finally {
      if (pending === controller) pending = null;
    }
  }

  const formUrl = () => {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form))
      if (String(value).trim() !== '') params.set(key, String(value).trim());
    const query = params.toString();
    return `${new URL(form.action).pathname}${query ? `?${query}` : ''}`;
  };

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      go(formUrl());
    });
    // The topic select applies at once (the Search button stays for the text).
    form.querySelector('[data-list-auto]')?.addEventListener('change', () => go(formUrl()));
  }

  results.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || !isPlainClick(event)) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    // Pager, category tabs and "Clear filters"; cards and other links navigate as usual.
    if (!link.closest('[data-pager], [data-category-filter], .empty-state')) return;
    event.preventDefault();
    go(`${url.pathname}${url.search}`);
  });

  window.addEventListener('popstate', () => {
    const state = `${location.pathname}${location.search}`;
    // Only the #hash changed (a same-page link): the list is already right.
    if (state === shown) return;
    go(state, { push: false, focus: false });
  });
}
