// Author: Rasel Al Mamun
// Research archive (FD-115). Without JS every card is shown and the controls stay hidden
// (.js-only, laid out from the first paint, so nothing shifts). This module filters the cards
// live: the search matches the titles and tags (every word), the topic select one topic. The
// polite count says how many are shown once typing pauses (not at every key) and, when none is,
// the empty state's advice too. The URL's ?q= and ?topic= (as a submitted form or Django would
// send them) start the filter.
// The live count waits this long after the last key (no token: a typing pause, not motion).
const TYPING_PAUSE = 400;

export function init() {
  const form = document.querySelector('[data-archive-filter]');
  const query = document.querySelector('[data-archive-q]');
  const topic = document.querySelector('[data-archive-topic]');
  const count = document.querySelector('[data-archive-count]');
  const empty = document.querySelector('[data-archive-empty]');
  if (!form || !query || !topic || !count || !empty) return;
  const cards = [...document.querySelectorAll('[data-project-card]')];

  const params = new URLSearchParams(window.location.search);
  query.value = params.get('q') ?? '';
  if ([...topic.options].some((option) => option.value === params.get('topic'))) {
    topic.value = params.get('topic');
  }

  const visual = count.querySelector('[data-count-text]') ?? count;
  const advice = count.querySelector('[data-count-empty]');
  let timer = 0;
  const announce = (shown) => {
    visual.textContent = count.dataset.label
      .replace('{shown}', String(shown))
      .replace('{total}', String(cards.length));
    if (advice) advice.textContent = shown ? '' : ` ${empty.textContent.trim()}`;
  };
  const apply = (delay) => {
    const words = query.value.toLowerCase().split(/\s+/).filter(Boolean);
    for (const card of cards) {
      card.hidden =
        (topic.value !== '' && card.dataset.topic !== topic.value) ||
        !words.every((word) => card.dataset.search.includes(word));
    }
    const shown = cards.filter((card) => !card.hidden).length;
    empty.hidden = shown > 0;
    clearTimeout(timer);
    if (delay) timer = setTimeout(() => announce(shown), delay);
    else announce(shown);
  };

  form.addEventListener('submit', (event) => event.preventDefault());
  query.addEventListener('input', () => apply(TYPING_PAUSE));
  topic.addEventListener('change', () => apply(0));
  apply(0);
}
