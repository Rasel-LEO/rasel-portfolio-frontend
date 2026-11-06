// Author: Rasel Al Mamun
// List pages that grow (FD-154): the projects archive and the Blog. The server-rendered page is
// the source (Django answers ?q=&topic=&category=&page=; the static preview answers the same
// URLs from files), and it works without this script: a GET form, links for the categories and
// the pages. This module only enhances it: a form submit, a topic change, a category tab, a page
// link or "Clear filters" fetches the same URL, swaps the results in place, updates the address
// and the title, moves focus to the results heading and announces the count in a polite live
// region. Any failure falls back to a normal navigation. The browser's Back button works.
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

  async function go(url, { push = true, focus = true } = {}) {
    try {
      const response = await fetch(url, { headers: { Accept: 'text/html' } });
      if (!response.ok) throw new Error(String(response.status));
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const next = doc.querySelector('[data-list-results]');
      if (!next) throw new Error('no results region');
      results.replaceChildren(...next.childNodes);
      sync(doc, url);
      if (push) history.pushState({ list: true }, '', url);
      bindTabs();
      const heading = results.querySelector('[data-results-heading]');
      if (focus) heading?.focus();
      announcer.textContent =
        results.querySelector('[data-results-status]')?.textContent.trim() ?? '';
    } catch {
      window.location.assign(url);
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
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    // Pager, category tabs and "Clear filters"; cards and other links navigate as usual.
    if (!link.closest('[data-pager], [data-category-filter], .empty-state')) return;
    event.preventDefault();
    go(`${url.pathname}${url.search}`);
  });

  window.addEventListener('popstate', () =>
    go(`${location.pathname}${location.search}`, { push: false, focus: false }),
  );
}
