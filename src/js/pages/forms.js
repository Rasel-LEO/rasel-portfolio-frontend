// Author: Rasel Al Mamun
// Hire me and Contact forms before Django (FD-38). The forms are real <form method="post">
// elements that work without JS (native validation, FD-40). Here they validate on submit
// (required, email pattern),
// mark invalid fields with aria-invalid and an inline error, move focus to the first one,
// and, in static mode, show a status message with a prefilled mailto: link.
// A form with a non-empty action is live (FD-135, FD-136): a valid submit is sent with fetch
// and the JSON answer is shown in place; when the background send cannot complete, the browser
// posts the form instead. The server-rendered errors and status are kept on load, and a
// status is brought into view. The Django templates add the action, CSRF and sending.
// Also: the email Copy button.
import { scrollToY } from '../core/scroll.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const required = {
  name: 'Enter your name.',
  email: 'Enter your email address.',
  brief: 'Describe what you need.',
  message: 'Enter your message.',
};
const emailFormat = 'Enter a complete email address, like name@example.com.';

// The message for a field, or '' when it is valid.
function problem(control) {
  const value = control.value.trim();
  if (control.required && !value) return required[control.name] ?? 'Fill in this field.';
  if (control.type === 'email' && value && !EMAIL.test(value)) return emailFormat;
  return '';
}

function setError(control, message) {
  const error = document.getElementById(`${control.id}-error`);
  const hint = document.getElementById(`${control.id}-hint`);
  if (!error) return;
  error.querySelector('[data-error-text]').textContent = message;
  error.hidden = !message;
  const describedBy = [message && error.id, hint?.id].filter(Boolean).join(' ');
  if (describedBy) control.setAttribute('aria-describedby', describedBy);
  else control.removeAttribute('aria-describedby');
  if (message) control.setAttribute('aria-invalid', 'true');
  else control.removeAttribute('aria-invalid');
}

// mailto: with the form's content, so the message can still be sent today.
function mailtoHref(form, email) {
  const field = (name) => form.elements.namedItem(name)?.value.trim() ?? '';
  const subject =
    form.dataset.form === 'hire' ? `Brief: ${field('kind')}` : field('subject') || 'Message';
  const lines = [
    field('brief') || field('message'),
    '',
    `— ${field('name')}`,
    field('organisation'),
  ].filter((line, i) => i < 3 || line);
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

function showSent(form) {
  const status = form.querySelector('[data-form-status]');
  const email = form.dataset.email;
  if (!status || !email) return;
  const link = document.createElement('a');
  link.href = mailtoHref(form, email);
  link.textContent = email;
  status.replaceChildren(
    'Thanks — this form goes live with the full site. For now, please email me at ',
    link,
    '.',
  );
}

function setBusy(button, busy) {
  if (!button) return;
  button.disabled = busy;
  if (busy) button.setAttribute('aria-disabled', 'true');
  else button.removeAttribute('aria-disabled');
}

const EXPIRED = 'The form expired. Please reload the page and send it again.';
const MOTION = '(prefers-reduced-motion: no-preference)';

function setStatus(status, text) {
  if (status) status.textContent = text;
}

// The server's fresh start-time value for the next send.
function setStarted(form, started) {
  const input = form.elements.namedItem('started');
  if (started && input) input.value = started;
}

// Bring the status into view and move focus to it. Smooth only when the OS allows motion;
// through Lenis while it runs (scrollToY).
function revealStatus(status) {
  status.focus({ preventScroll: true });
  const header = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--header-h'),
  );
  const room = Math.max((header || 0) + 16, window.innerHeight * 0.4);
  const top = status.getBoundingClientRect().top + window.scrollY - room;
  scrollToY(Math.max(0, top), { smooth: matchMedia(MOTION).matches });
}

// Server-rendered state (live mode): the errors and the status stay as rendered; the first
// invalid field gets focus when the status reports the errors.
function restore(controls, status) {
  const first = controls.find((control) => control.getAttribute('aria-invalid') === 'true');
  if (first) {
    if (status?.textContent.trim()) first.focus();
  } else if (status?.textContent.trim()) {
    // After the page wipe, the reveal setup and the font swap have settled, so none moves it.
    const show = () =>
      requestAnimationFrame(() => requestAnimationFrame(() => revealStatus(status)));
    const settled = () => document.fonts.ready.then(show);
    if (document.readyState === 'complete') settled();
    else window.addEventListener('load', settled, { once: true });
  }
}

// Send a valid live form in the background (FD-136). Anything that is not the JSON contract
// falls back to a normal post, so no message is lost.
async function send(form, controls, status, button) {
  setBusy(button, true);
  form.setAttribute('aria-busy', 'true');
  let reply;
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (response.status === 403) {
      setStatus(status, EXPIRED);
      form.removeAttribute('aria-busy');
      setBusy(button, false);
      return;
    }
    const data = await response.json();
    const expected = response.status === 200 ? true : [413, 422, 429].includes(response.status);
    if (!expected || typeof data?.ok !== 'boolean' || data.ok !== (response.status === 200)) {
      throw new Error('Unexpected reply');
    }
    reply = data;
  } catch {
    // The button stays disabled: the page is about to be replaced by the server's answer.
    form.submit();
    return;
  }

  const errors = reply.errors ?? {};
  if (reply.ok) {
    form.reset();
    for (const control of controls) setError(control, '');
  } else {
    for (const control of controls) setError(control, errors[control.name] ?? '');
  }
  setStarted(form, reply.started);
  setStatus(status, reply.status ?? '');
  form.removeAttribute('aria-busy');
  setBusy(button, false);
  const invalid = controls.find((control) => control.getAttribute('aria-invalid') === 'true');
  if (invalid) invalid.focus();
  else status?.focus();
}

function initForm(form) {
  const controls = [...form.querySelectorAll('.field-control')];
  const status = form.querySelector('[data-form-status]');
  const button = form.querySelector('[type="submit"]');
  const live = Boolean(form.getAttribute('action')?.trim());
  let sending = false;
  // Without JS the browser's own required/email checks run; with JS the inline errors do.
  form.noValidate = true;

  form.addEventListener('submit', (event) => {
    let first = null;
    for (const control of controls) {
      const message = problem(control);
      setError(control, message);
      if (message && !first) first = control;
    }
    if (first) {
      event.preventDefault();
      status?.replaceChildren();
      first.focus();
    } else if (live) {
      event.preventDefault();
      if (sending) return;
      sending = true;
      send(form, controls, status, button).finally(() => {
        sending = false;
      });
    } else {
      // Nothing is sent from the static build; the values stay in the fields.
      event.preventDefault();
      showSent(form);
    }
  });

  if (live) {
    // Focus can move to the status without it being a tab stop.
    status?.setAttribute('tabindex', '-1');
    restore(controls, status);
    // Back/forward cache: a page restored after the fallback post gets a usable form again.
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      form.removeAttribute('aria-busy');
      setBusy(button, false);
    });
  }

  // An error clears as soon as its field is fixed; new errors wait for the next submit.
  const recheck = (event) => {
    const control = event.target;
    if (control.getAttribute('aria-invalid') === 'true' && !problem(control)) {
      setError(control, '');
    }
  };
  form.addEventListener('input', recheck);
  form.addEventListener('change', recheck);
}

function initCopy(button) {
  const status = button.parentElement.querySelector('[data-copy-status]');
  button.addEventListener('click', async () => {
    let message = 'Email address copied';
    try {
      await navigator.clipboard.writeText(button.dataset.copyEmail);
    } catch {
      message = 'Copy did not work; select the address above.';
    }
    if (!status) return;
    // Clear first so a second copy is announced again.
    status.textContent = '';
    requestAnimationFrame(() => {
      status.textContent = message;
    });
  });
}

export function init() {
  for (const form of document.querySelectorAll('form[data-form]')) initForm(form);
  for (const button of document.querySelectorAll('[data-copy-email]')) initCopy(button);
}
