// "Add / edit custom hero" form (one form for both). Custom heroes live in the profile (storage.js).
// Their ids start at 9,000,000, far from real hero ids, so they can never clash with heroes you add to heroes.json later.
import { el, icon } from './dom.js';
import { openModal, confirmModal } from './modal.js';
import { roleImg, ROLES } from './config.js';

export const CUSTOM_ID_START = 9000000;
export const nextCustomId = (heroes) =>
  Math.max(CUSTOM_ID_START, ...heroes.filter((h) => h.custom).map((h) => h.id + 1));

// [key, label, required]. Only the hero image is required; the rest are optional.
const IMAGES = [
  ['hero', 'Hero image', true],
  ['prestige', 'Hover image (prestige)'],
  ['silhouette', 'Silhouette (popup banner)'],
  ['agent', 'Agent icon'],
  ['lord', 'Lord icon'],
  ['champion', 'Champion icon'],
];
export const isWebUrl = (s) => /^https?:\/\/\S+$/i.test(s);
export const field = (label, input) => el('label', { class: 'field' }, [el('span', { class: 'label' }, label), input]);

// hero = existing custom hero to edit (omit to create). onSave gets the clean data; onDelete only exists when editing.
export function openHeroForm({ hero, onSave, onDelete }) {
  const roles = new Set(hero ? [].concat(hero.role) : []);
  const error = el('p', { class: 'form-error', role: 'alert' });
  const fail = (message) => { error.textContent = message; };

  const name = el('input', { class: 'input', type: 'text', maxlength: '40', autocomplete: 'off', value: hero?.name ?? '' });
  const color = el('input', { class: 'input color-input', type: 'color', value: hero?.color ?? '#7a4fd6' });
  const difficulty = el('select', { class: 'select' }, [0, 1, 2, 3, 4, 5].map((n) =>
    el('option', { value: n, selected: n === (hero?.difficulty ?? 3) }, n)));
  const season = el('input', { class: 'input', type: 'number', inputmode: 'decimal', step: '0.5', min: '0', value: hero?.season ?? '' });

  const roleButtons = ROLES.map((role) => el('button', {
    class: 'btn btn-icon',
    type: 'button',
    title: role,
    'aria-label': role,
    'aria-pressed': String(roles.has(role)),
    onclick: (e) => {
      const on = !roles.has(role);
      roles[on ? 'add' : 'delete'](role);
      e.currentTarget.setAttribute('aria-pressed', on);
    },
  }, el('img', { src: roleImg(role), alt: '' })));

  const urls = Object.fromEntries(IMAGES.map(([key]) => [key, el('input', {
    class: 'input', type: 'url', inputmode: 'url', placeholder: 'https://…', autocomplete: 'off', value: hero?.images?.[key] ?? '',
  })]));
  const extras = IMAGES.slice(1);

  // Extra forms (Hulk, Darkchylde...): each has a name and its own icon links. Blank links fall back to the first form's.
  const iconLink = (value) => el('input', { class: 'input', type: 'url', inputmode: 'url', placeholder: 'https://…', autocomplete: 'off', value: value ?? '' });
  const formRows = [];
  const formsBox = el('div', { class: 'form-blocks' });
  function addFormRow(extra) {
    const row = {
      name: el('input', { class: 'input', type: 'text', maxlength: '40', autocomplete: 'off', value: extra?.name ?? '' }),
      agent: iconLink(extra?.images?.agent),
      lord: iconLink(extra?.images?.lord),
      champion: iconLink(extra?.images?.champion),
    };
    row.node = el('div', { class: 'form-block' }, [
      field('Form name', row.name),
      field('Agent icon link', row.agent),
      field('Lord icon link', row.lord),
      field('Champion icon link', row.champion),
      el('button', { class: 'btn btn-danger', type: 'button', onclick: () => { formRows.splice(formRows.indexOf(row), 1); row.node.remove(); } }, 'Remove form'),
    ]);
    formRows.push(row);
    formsBox.append(row.node);
  }
  (hero?.extraForms ?? []).forEach(addFormRow);

  const form = el('form', {
    novalidate: true,
    onsubmit: (e) => {
      e.preventDefault();
      if (!name.value.trim()) return fail('Give the hero a name.');
      const images = {};
      for (const [key, label, required] of IMAGES) {
        const value = urls[key].value.trim();
        if (!value && required) return fail(`${label} is required.`);
        if (value && !isWebUrl(value)) return fail(`${label} must be a link starting with https://`);
        if (value) images[key] = value;
      }
      const extraForms = [];
      for (const [i, row] of formRows.entries()) {
        const icons = {};
        for (const key of ['agent', 'lord', 'champion']) {
          const value = row[key].value.trim();
          if (value && !isWebUrl(value)) return fail(`Form ${i + 2}: the ${key} icon must be a link starting with https://`);
          if (value) icons[key] = value;
        }
        extraForms.push({ name: row.name.value.trim() || `Form ${i + 2}`, images: icons });
      }
      onSave({
        name: name.value.trim(),
        color: color.value,
        difficulty: Number(difficulty.value),
        season: season.value === '' ? null : Number(season.value),
        role: ROLES.filter((r) => roles.has(r)),
        images,
        extraForms,
      });
      dialog.close();
    },
  }, [
    el('h2', { class: 'modal-title' }, hero ? 'Edit hero' : 'Add hero'),
    el('div', { class: 'modal-body' }, [
      field('Name', name),
      el('div', { class: 'fields' }, [field('Colour', color), field('Difficulty', difficulty)]),
      el('div', { class: 'fields' }, [
        field('Season (optional)', season),
        el('div', { class: 'field' }, [el('span', { class: 'label' }, 'Roles'), el('div', { class: 'segmented' }, roleButtons)]),
      ]),
      field('Hero image link', urls.hero),
      el('details', { class: 'more', open: extras.some(([key]) => hero?.images?.[key]) }, [
        el('summary', {}, 'More images (optional)'),
        el('div', { class: 'more-fields' }, extras.map(([key, label]) => field(`${label} link`, urls[key]))),
      ]),
      el('details', { class: 'more', open: formRows.length > 0 }, [
        el('summary', {}, 'Extra forms (optional)'),
        el('div', { class: 'more-fields' }, [formsBox, el('button', { class: 'btn', type: 'button', onclick: () => addFormRow() }, [icon('add'), 'Add form'])]),
      ]),
      error,
    ]),
    el('div', { class: 'modal-actions' }, [
      hero
        ? el('button', {
            class: 'btn btn-danger',
            type: 'button',
            onclick: async () => {
              const ok = await confirmModal({
                title: `Delete ${hero.name}?`,
                message: 'This removes the hero along with their saved proficiency and bookmark.',
                confirmLabel: 'Delete',
                danger: true,
              });
              if (ok) { dialog.close(); onDelete(); }
            },
          }, 'Delete')
        : el('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, 'Cancel'),
      el('button', { class: 'btn btn-primary', type: 'submit' }, 'Save'),
    ]),
  ]);

  const dialog = openModal(form, { label: hero ? 'Edit hero' : 'Add hero' });
  return dialog;
}