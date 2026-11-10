// Costumes: choose what a hero wears (or Default), and add / edit / delete costumes.
// A costume swaps the card art and the Agent icon. Its rarity drives the "Rarity" card colour.
import { el, icon } from './dom.js';
import { openModal, confirmModal } from './modal.js';
import { iconUrl } from './proficiency.js';
import { field, isWebUrl } from './custom-heroes.js';

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const linkInput = (value) => el('input', { class: 'input', type: 'url', inputmode: 'url', placeholder: 'https://…', autocomplete: 'off', value });

// One form for adding and editing (costume = existing one to edit; omit to add)
function openCostumeForm({ costume, rarities, onSave, onDelete }) {
  const error = el('p', { class: 'form-error', role: 'alert' });
  const fail = (message) => { error.textContent = message; };

  const name = el('input', { class: 'input', type: 'text', maxlength: '40', autocomplete: 'off', placeholder: 'Optional', value: costume?.name ?? '' });
  const rarity = el('select', { class: 'select' }, rarities.map((r) =>
    el('option', { value: r.title, selected: r.title === costume?.rarity }, r.title)));
  const art = linkInput(costume?.images.hero ?? '');
  const agentIcon = linkInput(costume?.images.agent ?? '');

  const form = el('form', {
    novalidate: true,
    onsubmit: (e) => {
      e.preventDefault();
      const heroLink = art.value.trim();
      const iconLink = agentIcon.value.trim();
      if (!isWebUrl(heroLink)) return fail('Card art must be a link starting with https://');
      if (iconLink && !isWebUrl(iconLink)) return fail('Agent icon must be a link starting with https://');
      onSave({
        id: costume?.id ?? newId(),
        name: name.value.trim(),
        rarity: rarity.value,
        images: { hero: heroLink, ...(iconLink && { agent: iconLink }) },
      });
      dialog.close();
    },
  }, [
    el('h2', { class: 'modal-title' }, costume ? 'Edit costume' : 'Add costume'),
    el('div', { class: 'modal-body' }, [
      field('Name (optional)', name),
      field('Rarity', rarity),
      field('Card art link', art),
      field('Agent icon link (optional)', agentIcon),
      error,
    ]),
    el('div', { class: 'modal-actions' }, [
      costume
        ? el('button', {
            class: 'btn btn-danger',
            type: 'button',
            onclick: async () => {
              const ok = await confirmModal({ title: 'Delete costume?', message: 'This removes the costume from this hero.', confirmLabel: 'Delete', danger: true });
              if (ok) { dialog.close(); onDelete(); }
            },
          }, 'Delete')
        : el('button', { class: 'btn', type: 'button', onclick: () => dialog.close() }, 'Cancel'),
      el('button', { class: 'btn btn-primary', type: 'submit' }, 'Save'),
    ]),
  ]);

  const dialog = openModal(form, { label: costume ? 'Edit costume' : 'Add costume' });
}

// data = { items: [...], equipped: id | null } (or undefined). onChange gets the new data after every change.
export function openCostumes({ hero, rarities, data, onChange }) {
  const wardrobe = { items: [...(data?.items ?? [])], equipped: data?.equipped ?? null };
  const list = el('div', { class: 'costume-list' });

  const commit = () => { onChange({ items: [...wardrobe.items], equipped: wardrobe.equipped }); renderList(); };

  // costume = null is the Default row
  const row = (costume) => {
    const rarityInfo = rarities.find((r) => r.title === costume?.rarity);
    return el('div', { class: 'costume-row' }, [
      el('button', {
        class: 'btn costume-pick',
        type: 'button',
        'aria-pressed': String(wardrobe.equipped === (costume?.id ?? null)),
        onclick: () => { wardrobe.equipped = costume?.id ?? null; commit(); },
      }, [
        rarityInfo && el('img', { src: iconUrl(rarityInfo.icon), alt: '' }),
        el('span', {}, costume ? (costume.name || `${costume.rarity} costume`) : 'Default'),
      ]),
      costume && el('button', {
        class: 'btn btn-icon',
        type: 'button',
        'aria-label': `Edit ${costume.name || 'costume'}`,
        onclick: () => openCostumeForm({
          costume,
          rarities,
          onSave: (updated) => { wardrobe.items = wardrobe.items.map((x) => (x.id === updated.id ? updated : x)); commit(); },
          onDelete: () => {
            wardrobe.items = wardrobe.items.filter((x) => x.id !== costume.id);
            if (wardrobe.equipped === costume.id) wardrobe.equipped = null;
            commit();
          },
        }),
      }, icon('edit')),
    ]);
  };

  // Default first, then rarest to most common (rarity.json is ordered common -> mythic), A-Z within a rarity
  const tier = (c) => rarities.findIndex((r) => r.title === c.rarity);
  const label = (c) => c.name || `${c.rarity} costume`;
  const sorted = () => [...wardrobe.items].sort((a, b) => tier(b) - tier(a) || label(a).localeCompare(label(b)));

  function renderList() { list.replaceChildren(row(null), ...sorted().map(row)); }
  renderList();

  const dialog = openModal(el('div', {}, [
    el('h2', { class: 'modal-title' }, 'Costumes'),
    el('div', { class: 'modal-body' }, [
      el('p', { class: 'label' }, hero.name),
      list,
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => openCostumeForm({
          rarities,
          onSave: (added) => { wardrobe.items.push(added); wardrobe.equipped = added.id; commit(); },   // new costumes are worn right away
        }),
      }, [icon('add'), 'Add costume']),
    ]),
    el('div', { class: 'modal-actions' }, [el('button', { class: 'btn btn-primary', type: 'button', onclick: () => dialog.close() }, 'Done')]),
  ]), { label: `${hero.name} costumes` });
}