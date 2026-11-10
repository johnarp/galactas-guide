// Proficiency modal: banner + rank grid + level/points. Hierarchy is rank > level > points.
import { heroImage, url } from './config.js';
import { el, icon } from './dom.js';
import { openModal } from './modal.js';

// Icon paths in proficiency.json are written relative to views/, so resolve them from there.
export const iconUrl = (path) => new URL(path, url('views/')).href;

// "color" in proficiency.json is a list of hex colours, shown left to right
export const gradient = (color, direction = 'right') => {
  const stops = [].concat(color);
  return `linear-gradient(to ${direction}, ${(stops.length > 1 ? stops : [stops[0], stops[0]]).join(', ')})`;
};

// "Champion | 66 - 2169" as nodes: only the rank name is coloured (level and points are optional)
export function progressNodes(p, ranks) {
  if (!p) return [];
  const color = ranks.find((r) => r.title === p.rank)?.color;
  let rest = '';
  if (p.level != null) rest += ` | ${p.level}`;
  if (p.points != null) rest += ` - ${p.points}`;
  return [
    el('span', { class: color && 'rank-gradient', style: color && `--rank-bg:${gradient(color)}` }, p.rank),
    rest,
  ];
}

const num = (input) => (input.value === '' ? null : Math.trunc(Number(input.value)));

// Clamp a number field into its min/max (or empty it if it isn't a number)
function fit(input) {
  const n = num(input);
  input.value = n == null || Number.isNaN(n) ? '' : Math.min(+input.max, Math.max(+input.min, n));
}

export function openProficiency({ hero, ranks, current, onSave, onEdit, onCostumes, forms }) {
  let selected = current?.rank ?? null;

  const rankBtns = ranks.map((r) => el('button', {
    class: 'btn rank',
    type: 'button',
    'aria-pressed': 'false',
    onclick: () => pick(r),
  }, [el('img', { src: iconUrl(r.icon), alt: '' }), r.title]));

  const levelHint  = el('span', { class: 'hint' });
  const pointsHint = el('span', { class: 'hint' });
  const level  = el('input', { class: 'input', type: 'number', inputmode: 'numeric', step: '1', oninput: sync, onchange: () => { fit(level); sync(); } });
  const points = el('input', { class: 'input', type: 'number', inputmode: 'numeric', step: '1', min: '0', onchange: () => fit(points) });
  level.value  = current?.level ?? '';
  points.value = current?.points ?? '';

  const field = (name, hint, input) =>
    el('label', { class: 'field' }, [el('span', { class: 'field-head' }, [el('span', { class: 'label' }, name), hint]), input]);

  // Lock/unlock fields and update ranges to match the hierarchy
  function sync() {
    const rank = ranks.find((r) => r.title === selected);
    rankBtns.forEach((b, i) => b.setAttribute('aria-pressed', ranks[i].title === selected));

    level.disabled = !rank;
    if (rank) { level.min = rank.minLvl; level.max = rank.maxLvl; } else { level.value = ''; }
    levelHint.textContent = rank ? `${rank.minLvl}–${rank.maxLvl}` : 'Pick a rank first';

    points.disabled = !rank || level.value === '';
    if (points.disabled) points.value = '';
    if (rank) points.max = rank.ppl;
    pointsHint.textContent = !rank ? '' : level.value === '' ? 'Add a level first' : `0–${rank.ppl}`;
  }

  function pick(rank) {
    selected = rank.title;
    const n = num(level);
    if (n != null && (n < rank.minLvl || n > rank.maxLvl)) level.value = '';   // level belongs to the old rank
    sync();
    if (!points.disabled) fit(points);
  }

  // Form switch. With names it shows the current form's name; if the row is also holding "Edit hero" (custom heroes),
  // it shrinks to the icon and the form number so all three buttons fit on a phone.
  const formName = (n) => forms?.names?.[n - 1] ?? `Form ${n}`;
  const compactForm = Boolean(forms && (!forms.names || onEdit));
  const formText = (n) => (compactForm ? String(n) : formName(n));
  const formLabel = el('span', {}, forms ? formText(forms.current) : '');
  const formBtn = forms && el('button', {
    class: `btn form-switch${compactForm ? ' form-compact' : ''}`,
    type: 'button',
    onclick: () => { const n = forms.cycle(); formLabel.textContent = formText(n); describeForm(n); },
  }, [icon('swap_horiz'), formLabel]);
  function describeForm(n) {
    if (!formBtn) return;
    const text = `Change icon form (now: ${formName(n)})`;
    formBtn.title = text;
    formBtn.setAttribute('aria-label', text);
  }
  if (forms) describeForm(forms.current);

  const form = el('form', {
    class: 'prof',
    onsubmit: (e) => {
      e.preventDefault();
      if (!selected) {
        onSave(null);
      } else {
        fit(level); sync();
        if (!points.disabled) fit(points);
        onSave({ rank: selected, level: num(level), points: num(points) });
      }
      dialog.close();
    },
  }, [
    el('div', { class: 'prof-body' }, [
      el('p', { class: 'label' }, 'Rank'),
      el('div', { class: 'rank-grid' }, rankBtns),
      el('div', { class: 'fields' }, [
        field('Level (optional)', levelHint, level),
        field('Points (optional)', pointsHint, points),
      ]),
      el('div', { class: 'row-buttons' }, [
        onCostumes && el('button', { class: 'btn', type: 'button', onclick: () => { dialog.close(); onCostumes(); } }, [icon('checkroom'), el('span', { class: 'btn-label' }, 'Costumes')]),
        // Only custom heroes can be edited
        onEdit && el('button', { class: 'btn', type: 'button', onclick: () => { dialog.close(); onEdit(); } }, [icon('edit'), el('span', { class: 'btn-label' }, 'Edit hero')]),
        formBtn,   // heroes with several forms: tap to cycle which form's icons are used (icon layout)
      ]),
    ]),
    el('div', { class: 'modal-actions' }, [
      el('button', { class: 'btn', type: 'button', onclick: () => { selected = null; level.value = ''; points.value = ''; sync(); } }, 'Clear'),
      el('button', { class: 'btn btn-primary', type: 'submit' }, 'Save'),
    ]),
  ]);

  const banner = el('header', { class: 'banner', style: `--hero:${hero.color}` }, [
    el('h2', { class: 'banner-name' }, hero.name),
    heroImage(hero, 'silhouette') && el('img', {
      class: 'banner-img',
      src: heroImage(hero, 'silhouette'),
      alt: '',
      referrerpolicy: hero.custom ? 'no-referrer' : null,
      onerror: (e) => e.target.remove(),
    }),
  ]);

  sync();
  const dialog = openModal([banner, form], { label: `${hero.name} proficiency` });
  return dialog;
}