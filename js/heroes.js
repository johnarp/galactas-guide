import { loadData, heroImage, roleImg, ROLES } from './config.js';
import { el, icon } from './dom.js';
import { openProficiency, progressNodes, gradient, iconUrl } from './proficiency.js';
import { openModal } from './modal.js';
import { openHeroForm, nextCustomId } from './custom-heroes.js';
import { openCostumes } from './costumes.js';
import { rankScore, pointsToGo } from './progress.js';
import * as store from './storage.js';
import { getSetting, onSettingChange } from './preferences.js';


// progress: hero id -> { rank, level, points }. saved: set of hero ids. Both persist via storage.js,
// along with the last-used sort and filters (`view`).
const view = store.get('view');
const state = {
  heroes: [], ranks: [], palettes: {},
  progress: new Map(Object.entries(store.get('progress')).map(([id, p]) => [Number(id), p])),
  saved: new Set(store.get('saved')),
  costumes: new Map(Object.entries(store.get('costumes')).map(([id, c]) => [Number(id), c])),   // hero id -> { items, equipped }
  forms: new Map(Object.entries(store.get('forms')).map(([id, n]) => [Number(id), n])),   // hero id -> form number
  rarities: [],
  sort: 'name', asc: true, tracked: 'all', source: 'all', savedOnly: false,
  query: '',   // search text (not saved)
  ...view,
  roles: new Set(view.roles),
  rankFilter: new Set(view.rankFilter ?? (view.rank && view.rank !== 'all' ? [view.rank] : [])),   // older saves had one rank
};

const prog = (h) => state.progress.get(h.id);

const defaultProgress = () => ({ rank: state.ranks[0].title, level: state.ranks[0].minLvl, points: 0 });   // Agent, level 1, 0 points

// Forms. Built-in: "forms" in heroes.json is a list of names (["Magik", "Darkchylde"]) or just a number.
// Custom heroes: the first form is the hero itself, then each entry in extraForms.
const formNames = (h) => (h.custom
  ? (h.extraForms?.length ? [h.name, ...h.extraForms.map((x) => x.name)] : null)
  : (Array.isArray(h.forms) ? h.forms : null));
const formCount = (h) => formNames(h)?.length ?? (h.custom ? 1 : Number(h.forms) || 1);
// Which form's icons a hero uses (1 = the first)
const formOf = (h) => Math.min(state.forms.get(h.id) ?? 1, formCount(h));

// The costume a hero is wearing (null = default art). Turning costumes off in Settings ignores them all.
const equippedCostume = (h) => {
  const c = getSetting('showCostumes') ? state.costumes.get(h.id) : null;
  return c?.items.find((x) => x.id === c.equipped) ?? null;
};
const neg = (n) => (n == null ? null : -n);

// Name used for A-Z ordering; optionally ignores a leading "The" / "A" / "An" (heroes.json is untouched)
const sortName = (h) => (getSetting('ignoreArticles') ? h.name.replace(/^(the|an?)\s+/i, '') : h.name);
const byName = (a, b) => sortName(a).localeCompare(sortName(b));

// value(hero) -> number | string | null. Heroes with no value always sort last.
// asc = the direction used when that sort is picked. Add an entry and it appears in the dropdown.
const SORTS = {
  name:       { label: 'Name',       asc: true,  value: sortName },
  difficulty: { label: 'Difficulty', asc: true,  value: (h) => h.difficulty },
  release:    { label: 'Release',    asc: true,  value: (h) => h.season },
  rank:       { label: 'Rank',       asc: false, progress: true, value: (h) => rankScore(state.ranks, prog(h)) },
  levelUp:    { label: 'Level up',   asc: false, progress: true, value: (h) => neg(pointsToGo(state.ranks, prog(h), 'level')) },
  rankUp:     { label: 'Rank up',    asc: false, progress: true, value: (h) => neg(pointsToGo(state.ranks, prog(h), 'rank')) },
};

const TRACKED = {
  all:       () => true,
  tracked:   (h) => state.progress.has(h.id),
  untracked: (h) => !state.progress.has(h.id),
};

// Restored settings may be stale (renamed sort, removed role...), so fall back to defaults
if (!SORTS[state.sort]) { state.sort = 'name'; state.asc = true; }
if (!TRACKED[state.tracked]) state.tracked = 'all';
if (!['all', 'builtin', 'custom'].includes(state.source)) state.source = 'all';
state.roles = new Set([...state.roles].filter((r) => ROLES.includes(r)));

const saveProgress = () => store.set('progress', Object.fromEntries(state.progress));
const saveSaved    = () => store.set('saved', [...state.saved]);
const saveCostumes = () => store.set('costumes', Object.fromEntries(state.costumes));
const saveForms    = () => store.set('forms', Object.fromEntries(state.forms));
const saveView     = () => store.set('view', {
  sort: state.sort, asc: state.asc, roles: [...state.roles],
  rankFilter: [...state.rankFilter], tracked: state.tracked, source: state.source, savedOnly: state.savedOnly,
});

// Prestige art is only for hover, so skip downloading it on touch devices.
const canHover = matchMedia('(hover: hover)').matches;

const bar  = document.getElementById('control-bar');
const grid = document.getElementById('hero-grid');

// Icon layout: which icon image a rank uses (Agent-Centurion = agent, Lord-Guardian = lord, Champion = champion)
const ICON_SET = {
  Agent: 'agent', Knight: 'agent', Captain: 'agent', Centurion: 'agent',
  Lord: 'lord', Count: 'lord', Colonel: 'lord', Warrior: 'lord', Elite: 'lord', Guardian: 'lord',
  Champion: 'champion',
};
// Untracked heroes use the agent icon. Switching Lord/Champion icons off falls back to the next one down.
const iconSetFor = (p) => {
  const set = ICON_SET[p?.rank] ?? 'agent';
  if (set === 'champion' && !getSetting('championIcons')) return getSetting('lordIcons') ? 'lord' : 'agent';
  if (set === 'lord' && !getSetting('lordIcons')) return 'agent';
  return set;
};
const iconsView = () => getSetting('viewMode') === 'icons';

// Icon layout image. Custom heroes without icon links fall back to a lower icon, then to the hero image.
function iconSrc(hero, p) {
  const set = iconSetFor(p);
  const costumeIcon = set === 'agent' && formOf(hero) === 1 && equippedCostume(hero)?.images.agent;   // costumes only have an Agent icon
  if (costumeIcon) return costumeIcon;
  if (!hero.custom) return heroImage(hero, set, formOf(hero));
  const order = { champion: ['champion', 'lord', 'agent'], lord: ['lord', 'agent'], agent: ['agent'] }[set];
  return order.map((t) => heroImage(hero, t, formOf(hero))).find(Boolean) || heroImage(hero, 'hero');
}
const baseSrc = (hero) => (iconsView() ? iconSrc(hero, prog(hero)) : equippedCostume(hero)?.images.hero ?? heroImage(hero, 'hero'));

// Text for the small tab on a card: "Custom", the hero ID, or both. Empty means no tab.
const tagText = (hero) => [
  hero.custom && getSetting('showCustomBadge') && 'Custom',
  getSetting('showId') && hero.id,
].filter(Boolean).join(' | ');

// Difficulty (star + number) and release season (S7.5) chips, each switched on in Settings
const metaChips = (hero) => [
  getSetting('showDifficulty') && hero.difficulty != null && el('span', { class: 'tile-chip difficulty' }, [icon('star'), String(hero.difficulty)]),
  getSetting('showSeason') && hero.season != null && el('span', { class: 'tile-chip season' }, `S${hero.season}`),
].filter(Boolean);

const rolesOf = (hero) => [].concat(hero.role);   // role may be a string or an array

// Returns null when there's no image for it (custom heroes only have the links you gave them)
const art = (hero, type, cls, src = heroImage(hero, type)) => src && el('img', {
  class: cls,
  src,
  alt: '',
  loading: 'lazy',
  decoding: 'async',
  referrerpolicy: 'no-referrer',   // helps with sites that block hotlinking (custom hero and costume images)
  onload: (e) => e.target.classList.add('ready'),
  onerror: (e) => e.target.classList.add('missing'),
});

// Equal hard-edged bands, left to right: one band per colour
const bands = (colors) => `linear-gradient(to right, ${colors.map((c, i) =>
  `${c} ${(i * 100 / colors.length).toFixed(2)}% ${((i + 1) * 100 / colors.length).toFixed(2)}%`).join(', ')})`;

// Per-card CSS variables, one set per "Card colour" source. A missing palette entry just leaves
// the variable out, and the CSS falls back to the neutral colour.
const tileStyle = (hero) => {
  const pal = state.palettes;   // data/palettes.json: { role: {...}, difficulty: {...}, season: {...} }
  const vars = [`--hero:${hero.color}`];

  const rank = state.ranks.find((r) => r.title === prog(hero)?.rank)?.color;
  if (rank) vars.push(`--rank-grad:${gradient(rank, 'bottom')}`, `--rank-end:${[].concat(rank).at(-1)}`, `--rank-start:${[].concat(rank)[0]}`);

  const difficulty = pal.difficulty?.[hero.difficulty];   // numbers become keys like "3" or "7.5"
  if (difficulty) vars.push(`--difficulty:${difficulty}`);

  const season = pal.season?.[hero.season];
  if (season) vars.push(`--season:${season}`);

  const rarity = state.rarities.find((r) => r.title === equippedCostume(hero)?.rarity)?.color;
  if (rarity) vars.push(`--rarity:${rarity}`);

  const roles = rolesOf(hero).map((r) => pal.role?.[r]).filter(Boolean);
  if (roles.length) vars.push(`--role-grad:${bands(roles)}`, `--role-first:${roles[0]}`);

  return vars.join(';');
};

const heroTile = (hero) => el('div', {
  class: iconsView() ? 'tile tile-icon' : 'tile',
  'data-id': hero.id,
  style: tileStyle(hero),
}, [
  el('span', { class: 'tile-roles' }, rolesOf(hero).map((role) =>
    el('span', { class: 'role-icon', style: `--icon:url("${roleImg(role)}")` })
  )),
  art(hero, null, 'tile-img tile-base', baseSrc(hero)),
  !iconsView() && canHover && getSetting('hoverArt') && art(hero, 'prestige', 'tile-img tile-alt'),
  el('span', { class: 'tile-text' }, [
    el('span', { class: 'tile-name' }, hero.name),
    el('span', { class: 'tile-prof' }, progressNodes(prog(hero), state.ranks)),
  ]),
  tagText(hero) && el('span', { class: 'tile-tag' }, tagText(hero)),
  metaChips(hero).length > 0 && el('span', { class: 'tile-meta' }, metaChips(hero)),
  // Two sibling buttons (a button can't contain a button): one covers the card, one is the bookmark
  el('button', { class: 'tile-open', type: 'button', 'aria-label': `${hero.name} proficiency` }),
  el('button', {
    class: 'tile-save',
    type: 'button',
    'aria-label': `Save ${hero.name}`,
    'aria-pressed': String(state.saved.has(hero.id)),
  }, icon('bookmark')),
]);

// Tiles are built once and reused, so searching and sorting don't rebuild every image
const tiles = new Map();
const tileFor = (hero) => {
  if (!tiles.has(hero.id)) tiles.set(hero.id, heroTile(hero));
  return tiles.get(hero.id);
};

function compare(a, b) {
  const { value } = SORTS[state.sort];
  const va = value(a), vb = value(b);
  if (va == null || vb == null) {
    return va == null && vb == null ? byName(a, b) : va == null ? 1 : -1;
  }
  const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
  return cmp * (state.asc ? 1 : -1) || byName(a, b);   // ties: A-Z
}

const visible = (h) =>
  (!state.query.trim() || h.name.toLowerCase().includes(state.query.trim().toLowerCase())) &&
  (!state.roles.size || rolesOf(h).some((r) => state.roles.has(r))) &&
  (!state.rankFilter.size || state.rankFilter.has(prog(h)?.rank)) &&
  TRACKED[state.tracked](h) &&
  (state.source === 'all' || (state.source === 'custom') === Boolean(h.custom)) &&
  (!state.savedOnly || state.saved.has(h.id));

// Filters popup: single-choice groups (tracking, source) plus the multi-select rank grid. One popup keeps the bar
// short on phones. Everything applies live; onChange fires after every tap so the grid and the bar button update.
function openFilters(onChange) {
  const syncers = [];
  const sync = () => syncers.forEach((fn) => fn());

  const choice = (key, options) => {
    const buttons = options.map(([value, text]) => el('button', {
      class: 'btn',
      type: 'button',
      onclick: () => { state[key] = value; sync(); onChange(); },
    }, text));
    syncers.push(() => buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(state[key] === options[i][0]))));
    return el('div', { class: 'segmented' }, buttons);
  };

  const rankButtons = state.ranks.map((r) => el('button', {
    class: 'btn rank',
    type: 'button',
    onclick: () => {
      state.rankFilter[state.rankFilter.has(r.title) ? 'delete' : 'add'](r.title);
      sync();
      onChange();
    },
  }, [el('img', { src: iconUrl(r.icon), alt: '' }), r.title]));
  syncers.push(() => rankButtons.forEach((b, i) =>
    b.setAttribute('aria-pressed', String(state.rankFilter.has(state.ranks[i].title)))));

  const dialog = openModal(el('div', {}, [
    el('h2', { class: 'modal-title' }, 'Filters'),
    el('div', { class: 'modal-body' }, [
      el('p', { class: 'label' }, 'Tracking'),
      choice('tracked', [['all', 'All'], ['tracked', 'Tracked'], ['untracked', 'Untracked']]),
      el('p', { class: 'label' }, 'Source'),
      choice('source', [['all', 'All'], ['builtin', 'Built-in'], ['custom', 'Custom']]),
      el('p', { class: 'label' }, 'Rank'),
      el('div', { class: 'rank-grid' }, rankButtons),
    ]),
    el('div', { class: 'modal-actions' }, [
      el('button', {
        class: 'btn',
        type: 'button',
        onclick: () => { state.tracked = 'all'; state.source = 'all'; state.rankFilter.clear(); sync(); onChange(); },
      }, 'Clear'),
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => dialog.close() }, 'Done'),
    ]),
  ]), { label: 'Filters' });
  sync();
}

const ui = {};   // control-bar pieces other code needs (set in buildControls)

const filtersActive = () =>
  state.roles.size > 0 || state.rankFilter.size > 0 || state.tracked !== 'all' || state.source !== 'all' || state.savedOnly || state.query.trim() !== '';

const emptyState = () => el('div', { class: 'empty' }, [
  el('p', {}, 'No heroes match these filters.'),
  filtersActive() && el('button', { class: 'btn', type: 'button', onclick: () => ui.resetFilters() }, 'Reset filters'),
]);

function render() {
  const list = state.heroes.filter(visible).sort(compare);
  grid.replaceChildren(...(list.length
    ? list.map(tileFor)
    : [emptyState()]));
  if (ui.reset) ui.reset.hidden = !filtersActive();
  saveView();
}

// Does changing a hero's progress/saved state change what the grid should show?
const dynamic = () => state.rankFilter.size > 0 || state.tracked !== 'all' || SORTS[state.sort].progress;

// Reusable dropdown. isFilter highlights it whenever it's not on its first ("all") option.
function makeSelect(label, options, current, onChange, isFilter = false) {
  const select = el('select', {
    class: 'select',
    'aria-label': label,
    onchange: (e) => {
      const s = e.target;
      onChange(s.value);
      if (isFilter) s.toggleAttribute('data-on', s.selectedIndex > 0);
      s.blur();
    },
  }, options.map(([value, text]) => el('option', { value }, text)));
  select.value = current;
  if (isFilter) select.toggleAttribute('data-on', select.selectedIndex > 0);
  return select;
}

function buildControls() {
  const roleButtons = ROLES.map((role) => el('button', {
    class: 'btn btn-icon',
    type: 'button',
    title: role,
    'aria-label': role,
    'aria-pressed': String(state.roles.has(role)),
    onclick: (e) => {
      const on = !state.roles.has(role);
      state.roles[on ? 'add' : 'delete'](role);
      e.currentTarget.setAttribute('aria-pressed', on);
      render();
    },
  }, el('img', { src: roleImg(role), alt: '' })));

  const savedBtn = el('button', {
    class: 'btn btn-icon',
    type: 'button',
    title: 'Saved heroes only',
    'aria-label': 'Saved heroes only',
    'aria-pressed': String(state.savedOnly),
    onclick: (e) => {
      state.savedOnly = !state.savedOnly;
      e.currentTarget.setAttribute('aria-pressed', state.savedOnly);
      render();
    },
  }, icon('bookmark'));

  // One Filters button (popup) instead of separate tracking / rank controls, so the bar stays short on phones
  const filtersText = el('span');
  const filtersBtn = el('button', {
    class: 'btn',
    type: 'button',
    'aria-haspopup': 'dialog',
    onclick: () => openFilters(() => { syncFilters(); render(); }),
  }, [icon('tune'), filtersText]);
  function syncFilters() {
    const n = (state.tracked !== 'all') + (state.source !== 'all') + (state.rankFilter.size > 0);
    filtersText.textContent = n ? `Filters · ${n}` : 'Filters';
    filtersBtn.toggleAttribute('data-on', n > 0);
  }
  syncFilters();

  const sortSelect = makeSelect('Sort by',
    Object.entries(SORTS).map(([key, s]) => [key, s.label]),
    state.sort, (v) => { state.sort = v; state.asc = SORTS[v].asc; syncDir(); render(); });

  const dirIcon = icon('arrow_upward');
  const dirBtn = el('button', { class: 'btn btn-icon', type: 'button' }, dirIcon);
  function syncDir() {
    const label = state.asc ? 'Ascending' : 'Descending';
    dirIcon.textContent = state.asc ? 'arrow_upward' : 'arrow_downward';
    dirBtn.title = label;
    dirBtn.setAttribute('aria-label', label);
  }
  dirBtn.addEventListener('click', () => { state.asc = !state.asc; syncDir(); render(); });
  syncDir();

  // Search: phones show an icon that takes over the bar; large screens show the field inline
  const closeSearch = () => {
    input.value = '';
    state.query = '';
    bar.removeAttribute('data-searching');
    render();
  };
  const input = el('input', {
    class: 'input',
    type: 'search',
    placeholder: 'Search heroes',
    'aria-label': 'Search heroes',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    enterkeyhint: 'search',
    oninput: (e) => { state.query = e.target.value; render(); },
    onkeydown: (e) => {
      if (e.key === 'Enter') e.target.blur();      // hides the phone keyboard, keeps the results
      if (e.key === 'Escape') closeSearch();
    },
  });
  const search = el('div', { class: 'search' }, [
    el('button', {
      class: 'btn btn-icon search-toggle',
      type: 'button',
      'aria-label': 'Search heroes',
      onclick: () => { bar.dataset.searching = ''; input.focus(); },
    }, icon('search')),
    el('div', { class: 'search-field' }, [
      input,
      el('button', { class: 'btn btn-icon search-close', type: 'button', 'aria-label': 'Close search', onclick: closeSearch }, icon('close')),
    ]),
  ]);

  // Reset: clears every filter (and search) and puts the controls back to match
  const resetBtn = el('button', {
    class: 'btn btn-icon reset',
    type: 'button',
    title: 'Reset filters',
    'aria-label': 'Reset filters',
    hidden: true,
    onclick: () => resetFilters(),
  }, icon('filter_alt_off'));
  function resetFilters() {
    state.roles.clear();
    roleButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    state.savedOnly = false;
    savedBtn.setAttribute('aria-pressed', 'false');
    state.tracked = 'all';
    state.source = 'all';
    state.rankFilter.clear();
    syncFilters();
    input.value = '';
    state.query = '';
    bar.removeAttribute('data-searching');
    render();
  }

  const addBtn = el('button', {
    class: 'btn btn-icon',
    type: 'button',
    title: 'Add custom hero',
    'aria-label': 'Add custom hero',
    onclick: () => openHeroForm({ onSave: addHero }),
  }, icon('add'));

  bar.append(
    el('div', { class: 'segmented' }, roleButtons),
    savedBtn,
    filtersBtn,
    search,
    resetBtn,
    addBtn,
    el('div', { class: 'segmented push' }, [sortSelect, dirBtn]),
  );

  // Ranks come from proficiency.json, which loads after the bar is built
  ui.reset = resetBtn;
  ui.resetFilters = resetFilters;
  ui.syncFilters = syncFilters;
}

// ---- Custom heroes (added by the user, saved in the profile) ----
const saveCustom = () => store.set('customHeroes',
  state.heroes.filter((h) => h.custom).map(({ custom, ...rest }) => rest));

function addHero(data) {
  const hero = { ...data, id: nextCustomId(state.heroes), custom: true };
  state.heroes.push(hero);
  if (getSetting('autoTrack')) { state.progress.set(hero.id, defaultProgress()); saveProgress(); }
  saveCustom();
  render();
}
function updateHero(hero, data) {
  Object.assign(hero, data);
  tiles.delete(hero.id);   // rebuild this card
  saveCustom();
  render();
}
function deleteHero(hero) {
  state.heroes = state.heroes.filter((h) => h !== hero);
  tiles.delete(hero.id);
  state.progress.delete(hero.id);
  state.saved.delete(hero.id);
  state.costumes.delete(hero.id);
  saveCustom(); saveProgress(); saveSaved(); saveCostumes();
  render();
}

function setCostumes(hero, data) {
  if (data.items.length) state.costumes.set(hero.id, data); else state.costumes.delete(hero.id);
  tiles.delete(hero.id);   // rebuild this card with the new art
  saveCostumes();
  render();
}

function cycleForm(hero) {
  const next = (formOf(hero) % formCount(hero)) + 1;
  if (next === 1) state.forms.delete(hero.id); else state.forms.set(hero.id, next);
  tiles.delete(hero.id);   // rebuild this card with the other form's icons
  saveForms();
  render();
  return next;
}

// One listener for every card: bookmark toggle, or open that hero's proficiency modal
grid.addEventListener('click', (e) => {
  const tile = e.target.closest('.tile');
  const hero = tile && state.heroes.find((h) => String(h.id) === tile.dataset.id);
  if (!hero) return;

  const saveBtn = e.target.closest('.tile-save');
  if (saveBtn) {
    const on = !state.saved.has(hero.id);
    state.saved[on ? 'add' : 'delete'](hero.id);
    saveSaved();
    saveBtn.setAttribute('aria-pressed', on);
    if (state.savedOnly) render();
    return;
  }

  openProficiency({
    hero,
    ranks: state.ranks,
    current: prog(hero),
    forms: formCount(hero) > 1 ? { count: formCount(hero), names: formNames(hero), current: formOf(hero), cycle: () => cycleForm(hero) } : null,
    onCostumes: () => openCostumes({ hero, rarities: state.rarities, data: state.costumes.get(hero.id), onChange: (d) => setCostumes(hero, d) }),
    onEdit: hero.custom ? () => openHeroForm({ hero, onSave: (d) => updateHero(hero, d), onDelete: () => deleteHero(hero) }) : null,
    onSave: (saved) => {
      const p = saved ?? (getSetting('autoTrack') ? defaultProgress() : null);   // with auto-track, clearing goes back to Agent 1
      if (p) state.progress.set(hero.id, p); else state.progress.delete(hero.id);
      saveProgress();
      // Look the card up again instead of using the one clicked: switching an icon form rebuilds the card while this popup is open
      const card = tileFor(hero);
      card.querySelector('.tile-prof').replaceChildren(...progressNodes(p, state.ranks));
      card.style.cssText = tileStyle(hero);
      if (iconsView()) {   // the icon image depends on rank
        const base = card.querySelector('.tile-base');
        if (base) { base.classList.remove('missing'); base.src = iconSrc(hero, p); }
      }   // rank colours for the "proficiency" card colour
      if (dynamic()) render();
    },
  });
});

onSettingChange(() => {   // rebuild cards too, since some settings (hover art) change how they're built
  if (!state.heroes.length) return;
  tiles.clear();
  render();
});

async function init() {
  buildControls();
  try {
    [state.heroes, state.ranks, state.palettes, state.rarities] = await Promise.all([
      loadData('data/heroes.json'),
      loadData('data/proficiency.json'),
      loadData('data/palettes.json').catch(() => ({})),   // optional: without it those card colours just use the neutral one
      loadData('data/rarity.json').catch(() => []),       // optional: without it costumes have no rarity colour
    ]);
    state.heroes.push(...store.get('customHeroes').map((h) => ({ ...h, custom: true })));
    // drop saved progress whose rank no longer exists in proficiency.json
    for (const [id, p] of state.progress) if (!state.ranks.some((r) => r.title === p.rank)) state.progress.delete(id);
    state.rankFilter = new Set([...state.rankFilter].filter((t) => state.ranks.some((r) => r.title === t)));
    ui.syncFilters();
    if (getSetting('autoTrack') && state.ranks.length) {   // heroes added since last visit (updates, custom heroes) start at Agent 1 too
      for (const h of state.heroes) if (!state.progress.has(h.id)) state.progress.set(h.id, defaultProgress());
      saveProgress();
    }
    render();
  } catch (err) {
    console.error(err);
    grid.replaceChildren(el('p', { class: 'empty' }, 'Could not load heroes. Check the files in data/.'));
  }
}

init();