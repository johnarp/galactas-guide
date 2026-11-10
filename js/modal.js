// Generic modals built on <dialog>: the browser handles focus trapping and Esc.
// openModal(content, { label, className }) for anything; confirmModal(...) for yes/no questions.
import { el, icon } from './dom.js';

export function openModal(content, { label, className = '' } = {}) {
  const dialog = el('dialog', { class: `modal ${className}`.trim(), 'aria-label': label }, [
    content,
    el('button', {
      class: 'btn btn-icon modal-close',
      type: 'button',
      'aria-label': 'Close',
      onclick: () => dialog.close(),
    }, icon('close')),
  ]);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });  // backdrop
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

// Resolves true if confirmed, false if cancelled/dismissed
export function confirmModal({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const dialog = openModal(el('div', {}, [
      el('h2', { class: 'modal-title' }, title),
      el('div', { class: 'modal-body' }, el('p', { class: 'modal-text' }, message)),
      el('div', { class: 'modal-actions' }, [
        el('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, 'Cancel'),
        el('button', {
          class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
          type: 'button',
          onclick: () => { result = true; dialog.close(); },
        }, confirmLabel),
      ]),
    ]), { label: title });
    dialog.addEventListener('close', () => resolve(result));
  });
}