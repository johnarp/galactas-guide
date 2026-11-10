// Theme picker (a grid of live previews, split into Built-in and Custom) and the custom theme creator.
// Custom themes live in the profile (storage.js) and are turned into CSS variables by themeVars() in preferences.js.
import { el, icon } from './dom.js';
import { openModal, confirmModal } from './modal.js';
import { field, isWebUrl } from './custom-heroes.js';
import * as store from './storage.js';
import { BUILT_IN_THEMES, getSetting, setSetting, themeVars } from './preferences.js';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const customValue = (t) => `custom:${t.id}`;

// Name of the theme currently in use (for the button in Settings)
export function themeLabel(value = getSetting('theme')) {
  return BUILT_IN_THEMES.find(([id]) => id === value)?.[1]
    ?? store.get('customThemes').find((t) => customValue(t) === value)?.name
    ?? 'Galacta';
}

// A tiny preview: page colour (and image), a panel, a line of text and a button.
// Built-in themes are painted by their own data-theme CSS; custom ones by inline variables.
function preview({ id, custom }) {
  const style = custom ? Object.entries(themeVars(custom)).map(([k, v]) => `${k}:${v}`).join(';') : null;
  return el('span', { class: 'theme-swatch', 'data-theme': custom ? 'custom' : id, style }, [
    el('span', { class: 'sw-panel' }, [el('span', { class: 'sw-line' }), el('span', { class: 'sw-btn' })]),
  ]);
}

export function openThemes(onChange) {
  const body = el('div', { class: 'modal-body' });
  const refreshAll = () => { onChange?.(); render(); };

  const card = (value, name, swatch, extra) => el('div', { class: 'theme-item' }, [
    el('button', {
      class: 'btn theme-card',
      type: 'button',
      'aria-pressed': String(getSetting('theme') === value),
      onclick: () => { setSetting('theme', value); refreshAll(); },
    }, [swatch, el('span', {}, name)]),
    extra,
  ]);

  function render() {
    const customs = store.get('customThemes');
    body.replaceChildren(
      el('p', { class: 'label' }, 'Built-in'),
      el('div', { class: 'theme-grid' }, BUILT_IN_THEMES.map(([id, name]) => card(id, name, preview({ id })))),
      el('p', { class: 'label' }, 'Custom'),
      customs.length
        ? el('div', { class: 'theme-grid' }, customs.map((t) => card(customValue(t), t.name, preview({ custom: t }),
            el('button', {
              class: 'btn btn-icon theme-edit',
              type: 'button',
              'aria-label': `Edit ${t.name}`,
              onclick: () => openThemeForm({ theme: t, onDone: refreshAll }),
            }, icon('edit')))))
        : el('p', { class: 'hint' }, 'Themes you create show up here.'),
      el('button', { class: 'btn', type: 'button', onclick: () => openThemeForm({ onDone: refreshAll }) }, [icon('add'), 'Create theme']),
    );
  }
  render();

  const dialog = openModal(el('div', {}, [
    el('h2', { class: 'modal-title' }, 'Themes'),
    body,
    el('div', { class: 'modal-actions' }, [el('button', { class: 'btn btn-primary', type: 'button', onclick: () => dialog.close() }, 'Done')]),
  ]), { label: 'Themes' });
}

// One form for creating and editing. theme = the custom theme to edit (omit to create).
function openThemeForm({ theme, onDone }) {
  const base = theme ?? {
    id: newId(), name: '', image: '', overlay: 70, radius: 10,
    colors: { bg: '#0e0415', surface: '#1a0f27', primary: '#ac4ef9', text: '#ece8f2' },
  };
  const error = el('p', { class: 'form-error', role: 'alert' });
  const fail = (message) => { error.textContent = message; };

  const name = el('input', { class: 'input', type: 'text', maxlength: '30', autocomplete: 'off', placeholder: 'My theme', value: base.name });
  const color = (key) => el('input', { class: 'input color-input', type: 'color', value: base.colors[key], oninput: refresh });
  const colors = { bg: color('bg'), surface: color('surface'), primary: color('primary'), text: color('text') };
  const image = el('input', { class: 'input', type: 'url', inputmode: 'url', autocomplete: 'off', placeholder: 'https://… (optional)', value: base.image, oninput: refresh });
  const overlay = el('input', { type: 'range', min: '0', max: '95', value: base.overlay, oninput: refresh });
  const radius = el('input', { type: 'range', min: '0', max: '24', value: base.radius, oninput: refresh });
  const previewBox = el('div', { class: 'theme-preview-box' });

  const current = () => ({
    ...base,
    name: name.value.trim(),
    colors: Object.fromEntries(Object.entries(colors).map(([key, input]) => [key, input.value])),
    image: image.value.trim(),
    overlay: Number(overlay.value),
    radius: Number(radius.value),
  });
  function refresh() {
    const t = current();
    previewBox.replaceChildren(preview({ custom: { ...t, image: isWebUrl(t.image) ? t.image : '' } }));
  }
  refresh();

  const form = el('form', {
    novalidate: true,
    onsubmit: (e) => {
      e.preventDefault();
      const next = current();
      if (!next.name) return fail('Give the theme a name.');
      if (next.image && !isWebUrl(next.image)) return fail('The background image must be a link starting with https://');
      const list = store.get('customThemes');
      store.set('customThemes', theme ? list.map((x) => (x.id === next.id ? next : x)) : [...list, next]);
      setSetting('theme', customValue(next));   // use it right away (also re-applies an edited theme)
      onDone();
      dialog.close();
    },
  }, [
    el('h2', { class: 'modal-title' }, theme ? 'Edit theme' : 'Create theme'),
    el('div', { class: 'modal-body' }, [
      previewBox,
      field('Name', name),
      el('div', { class: 'fields' }, [
        field('Background', colors.bg),
        field('Panels', colors.surface),
        field('Accent', colors.primary),
        field('Text', colors.text),
      ]),
      field('Background image link', image),
      field('Image overlay (higher = darker)', overlay),
      field('Corner roundness', radius),
      error,
    ]),
    el('div', { class: 'modal-actions' }, [
      theme
        ? el('button', {
            class: 'btn btn-danger',
            type: 'button',
            onclick: async () => {
              const ok = await confirmModal({ title: `Delete ${theme.name}?`, message: 'This removes the theme.', confirmLabel: 'Delete', danger: true });
              if (!ok) return;
              store.set('customThemes', store.get('customThemes').filter((x) => x.id !== theme.id));
              if (getSetting('theme') === customValue(theme)) setSetting('theme', 'galacta');
              onDone();
              dialog.close();
            },
          }, 'Delete')
        : el('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, 'Cancel'),
      el('button', { class: 'btn btn-primary', type: 'submit' }, 'Save'),
    ]),
  ]);

  const dialog = openModal(form, { label: theme ? 'Edit theme' : 'Create theme' });
}