// Settings modal: full screen on phones, small popup under the nav on larger screens (see settings.css).
import { el } from './dom.js';
import { openModal, confirmModal } from './modal.js';
import * as store from './storage.js';
import { openThemes, themeLabel } from './themes.js';
import { SETTINGS, getSetting, setSetting } from './preferences.js';

function download(data, filename) {
  const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  el('a', { href, download: filename }).click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

const row = (title, description, button) =>
  el('div', { class: 'setting' }, [
    el('div', {}, [el('p', { class: 'setting-title' }, title), el('p', { class: 'hint' }, description)]),
    button,
  ]);

// About / legal / credits, shown at the bottom of Settings. Edit the text and links here.
const REPO = 'https://github.com/johnarp/galactas-guide';
const link = (href, text) => el('a', { class: 'link', href, target: '_blank', rel: 'noopener noreferrer' }, text);

// Latest GitHub release tag. Only looked up when Settings opens, remembered for 6 hours, and kept outside the profile.
// If GitHub can't be reached (offline, rate limit, no release yet) the remembered tag stays; with none, the line stays hidden.
const RELEASE_API = `${REPO.replace('https://github.com/', 'https://api.github.com/repos/')}/releases/latest`;
const VERSION_KEY = 'galactas-guide-version';
const VERSION_TTL = 6 * 60 * 60 * 1000;
const RETRY_AFTER = 30 * 60 * 1000;

async function showVersion(line) {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(VERSION_KEY)); } catch { /* nothing saved */ }
  const show = (tag) => { line.textContent = `Galacta’s Guide ${tag}`; line.hidden = false; };
  if (cached?.tag) show(cached.tag);
  if (cached && Date.now() - cached.at < VERSION_TTL) return;

  const save = (tag, at) => { try { localStorage.setItem(VERSION_KEY, JSON.stringify({ tag, at })); } catch { /* storage blocked */ } };
  try {
    const res = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(res.status);
    const { tag_name: tag } = await res.json();
    if (typeof tag !== 'string') throw new Error('no tag');
    save(tag, Date.now());
    show(tag);
  } catch {
    save(cached?.tag ?? null, Date.now() - VERSION_TTL + RETRY_AFTER);   // don't ask again for ~30 minutes
  }
}

const about = () => {
  const version = el('p', { class: 'hint', hidden: true });
  showVersion(version);
  return el('div', { class: 'about' }, [
  el('p', { class: 'label' }, 'About'),
  version,
  el('p', { class: 'hint' }, 'Galacta’s Guide is an unofficial fan project. It is not affiliated with or endorsed by Marvel or NetEase Games. Marvel Rivals and all related names and artwork belong to their respective owners.'),
  el('p', { class: 'hint' }, ['Hero art, icons and theme backgrounds: ', link('https://psylocke.gg', 'psylocke.gg'), '. Silhouettes and rarity icons: ', link('https://rivalskins.com', 'rivalskins.com'), '.']),
  el('p', { class: 'hint' }, ['Agent icons for alternate forms: ', link('https://marvelrivals.fandom.com', 'Marvel Rivals Wiki on Fandom'), '. They are square images, so they look zoomed in on the icon tiles.']),
  el('p', { class: 'hint' }, [link(REPO, 'Source code'), ' · ', link(`${REPO}/issues`, 'Report an issue or suggest something')]),
]);
};

// A switch or a dropdown, depending on the setting
function control(s) {
  if (s.picker) {   // the theme: a button showing the current theme that opens the themes popup
    const button = el('button', { class: 'btn', type: 'button', onclick: () => openThemes(() => { button.textContent = themeLabel(); }) }, themeLabel());
    return button;
  }
  if (s.options) {
    return el('select', {
      class: 'select',
      'aria-label': s.label,
      onchange: (e) => { setSetting(s.key, e.target.value); e.target.blur(); },
    }, s.options.map(([value, text]) => el('option', { value, selected: value === getSetting(s.key) }, text)));
  }
  const toggle = el('button', {
    class: 'btn',
    type: 'button',
    role: 'switch',
    'aria-label': s.label,
    'aria-checked': String(getSetting(s.key)),
    onclick: async () => {
      const on = !getSetting(s.key);
      if (on && s.confirm) {   // e.g. auto-track: ask first, make the one-time change, then reload so pages pick it up
        if (!(await confirmModal(s.confirm))) return;
        try { await s.onEnable?.(); } catch (err) { console.error(err); return; }
        setSetting(s.key, true);
        location.reload();
        return;
      }
      setSetting(s.key, on);
      toggle.setAttribute('aria-checked', on);
      toggle.textContent = on ? 'On' : 'Off';
    },
  }, getSetting(s.key) ? 'On' : 'Off');
  return toggle;
}

// One row per entry in SETTINGS, with a section label whenever the section changes
function preferenceRows() {
  let section;
  return SETTINGS.flatMap((s) => {
    const head = s.section !== section ? [el('p', { class: 'label' }, (section = s.section))] : [];
    return [...head, row(s.label, s.description, control(s))];
  });
}

export function openSettings() {
  const status = el('p', { class: 'hint', role: 'status' });

  const fileInput = el('input', {
    type: 'file',
    accept: '.json,application/json',
    hidden: true,
    onchange: async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      let data;
      try {
        data = store.parse(JSON.parse(await file.text()));
      } catch {
        status.textContent = "That file isn't a valid Galacta's Guide export.";
        return;
      }
      const ok = await confirmModal({
        title: 'Import data?',
        message: 'This replaces everything currently saved in this browser.',
        confirmLabel: 'Import',
      });
      if (ok) { store.replace(data); location.reload(); }
    },
  });

  const exportBtn = el('button', {
    class: 'btn',
    type: 'button',
    onclick: () => download(store.exportProfile(), `galactas-guide-${new Date().toISOString().slice(0, 10)}.json`),
  }, 'Export');

  const importBtn = el('button', { class: 'btn', type: 'button', onclick: () => fileInput.click() }, 'Import');

  const clearBtn = el('button', {
    class: 'btn btn-danger',
    type: 'button',
    onclick: async () => {
      const ok = await confirmModal({
        title: 'Clear all data?',
        message: 'Your proficiency, saved heroes and filters will be deleted from this browser. Export first if you want a backup.',
        confirmLabel: 'Clear everything',
        danger: true,
      });
      if (ok) { store.clear(); location.reload(); }
    },
  }, 'Clear');

  return openModal(el('div', { class: 'settings-scroll' }, [
    el('h2', { class: 'modal-title' }, 'Settings'),
    el('div', { class: 'modal-body' }, [
      ...preferenceRows(),
      el('p', { class: 'label' }, 'Your data'),
      row('Export', 'Download your progress, saved heroes and filters as a .json file.', exportBtn),
      row('Import', 'Replace your data with a file you exported before.', importBtn),
      row('Clear', 'Delete everything saved in this browser.', clearBtn),
      status,
      fileInput,
      about(),
    ]),
  ]), { label: 'Settings', className: 'modal-settings' });
}