// Author: Rasel Al Mamun
// Hire me and Contact forms before Django (FD-38). The forms are real <form method="post">
// elements that work without JS (native validation, FD-40). Here they validate on submit
// (required, email pattern),
// mark invalid fields with aria-invalid and an inline error, move focus to the first one,
// and, because nothing is sent yet, show a status message with a prefilled mailto: link.
// The Django templates add the action, CSRF and sending. Also: the email Copy button.

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

function initForm(form) {
  const controls = [...form.querySelectorAll('.field-control')];
  const status = form.querySelector('[data-form-status]');
  // Without JS the browser's own required/email checks run; with JS the inline errors do.
  form.noValidate = true;

  form.addEventListener('submit', (event) => {
    // Nothing is sent from the static build; the values stay in the fields.
    event.preventDefault();
    let first = null;
    for (const control of controls) {
      const message = problem(control);
      setError(control, message);
      if (message && !first) first = control;
    }
    if (first) {
      status?.replaceChildren();
      first.focus();
    } else {
      showSent(form);
    }
  });

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
