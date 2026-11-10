// User preferences (the switches and dropdowns in Settings). To add one: add an entry to SETTINGS.
//  - It appears in the Settings modal automatically, grouped by `section`.
//  - Add `options: [[value, label], ...]` for a dropdown; without it, it's an On/Off switch.
//  - Read it in JS with getSetting(key); style against it in CSS with html[data-<key>="..."]
//    (key "rankColors" -> [data-rank-colors="off"], key "cardColors" -> [data-card-colors="none"]).
//  - Saved in the profile under "settings" (storage.js).
import * as store from './storage.js';
import { loadData } from './config.js';

// One-time change when auto-track is switched on: every hero without saved progress becomes Agent, level 1, 0 points.
// (Heroes added later are handled when the heroes page loads.) This is saved like normal progress, so it can't be undone.
async function applyAutoTrack() {
  const [heroes, ranks] = await Promise.all([loadData('data/heroes.json'), loadData('data/proficiency.json')]);
  const progress = { ...store.get('progress') };
  for (const h of [...heroes, ...store.get('customHeroes')]) {
    if (!progress[h.id]) progress[h.id] = { rank: ranks[0].title, level: ranks[0].minLvl, points: 0 };
  }
  store.set('progress', progress);
}

export const SETTINGS = [
  { key: 'theme', section: 'Theme', default: 'galacta',
    label: 'Theme', description: 'Pick a built-in theme or create your own.',
    picker: true },   // opens the themes popup (themes.js)

  { key: 'viewMode', section: 'View', default: 'cards',
    label: 'Layout',
    description: 'Portrait cards with hero art, or landscape tiles using the rank icon images.',
    options: [['cards', 'Cards'], ['icons', 'Icons']] },
  { key: 'cardSize', section: 'View', default: 'medium',
    label: 'Size', description: 'How big the cards or icons are in the grid.',
    options: [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']] },
  { key: 'lordIcons', section: 'View', default: true,
    label: 'Lord icons',
    description: 'Icons layout: use the Lord icon for Lord to Guardian. Off uses the default icon.' },
  { key: 'championIcons', section: 'View', default: true,
    label: 'Champion icons',
    description: 'Icons layout: use the Champion icon. Turn off if the animation is distracting; falls back to the Lord icon.' },

  { key: 'ignoreArticles', section: 'Sorting', default: true,
    label: 'Ignore articles when sorting',
    description: 'Skips “The”, “A” and “An” when sorting by name, so “The Punisher” sorts under P.' },

  { key: 'autoTrack', section: 'Tracking', default: false,
    label: 'Auto-track all heroes',
    description: 'Untracked heroes become Agent, level 1, 0 points, and so do heroes added later. Turning it off doesn’t undo this.',
    confirm: {
      title: 'Auto-track all heroes?',
      message: 'Every hero you haven’t tracked will be set to Agent, level 1, 0 points, and heroes added in future updates will be too. This can’t be undone: turning it off later only stops new heroes being added, and it can’t tell these apart from heroes you tracked yourself. Export your data first if you want a backup.',
      confirmLabel: 'Turn on',
      danger: true,
    },
    onEnable: applyAutoTrack },

  { key: 'cardColors', section: 'Cards', default: 'hero',
    label: 'Card colour',
    description: 'Base the card background on the hero, proficiency, role, difficulty, season, costume rarity, or a neutral colour.',
    options: [['hero', 'Hero'], ['proficiency', 'Proficiency'], ['role', 'Role'], ['difficulty', 'Difficulty'], ['season', 'Season'], ['rarity', 'Rarity'], ['none', 'None']] },
  { key: 'rankColors', section: 'Cards', default: true,
    label: 'Coloured rank names',
    description: 'Show ranks in their gradient colours. Turn off for plain text if they’re hard to read.' },
  { key: 'hoverArt', section: 'Cards', default: true,
    label: 'Prestige art on hover',
    description: 'Swap to the prestige art when you hover over a card (mouse devices, Cards layout only).' },

  { key: 'showName', section: 'Card details', default: true,
    label: 'Hero name', description: 'Show the name on each card.' },
  { key: 'showProficiency', section: 'Card details', default: true,
    label: 'Proficiency text', description: 'Show your rank, level and points. Tracking still works while hidden.' },
  { key: 'showRoles', section: 'Card details', default: true,
    label: 'Role icons', description: 'Show the role icons in the top-left corner.' },
  { key: 'showBookmark', section: 'Card details', default: true,
    label: 'Bookmark button', description: 'Show the bookmark on cards. Hidden means you can’t save heroes from the grid.' },
  { key: 'showCustomBadge', section: 'Card details', default: true,
    label: 'Custom hero badge', description: 'Mark heroes you added yourself with a small “Custom” tag.' },
  { key: 'showId', section: 'Card details', default: false,
    label: 'Hero ID', description: 'Show each hero’s ID in a small tab at the top of the card.' },
  { key: 'showCostumes', section: 'Card details', default: true,
    label: 'Costumes', description: 'Show equipped costumes on cards. Off shows the base art for every hero.' },
  { key: 'showDifficulty', section: 'Card details', default: false,
    label: 'Difficulty', description: 'Show the difficulty as a star and number under the bookmark.' },
  { key: 'showSeason', section: 'Card details', default: false,
    label: 'Release season', description: 'Show the season the hero was released in, like S7.5, under the bookmark.' },
  { key: 'colorChips', section: 'Card details', default: true,
    label: 'Coloured difficulty and season', description: 'Use each difficulty’s and season’s colour from your palettes. Off uses plain text.' },
];

const listeners = new Set();
const valueOf = (s) => {
  const v = store.get('settings')[s.key];
  if (s.picker) return typeof v === 'string' ? v : s.default;
  if (s.options) return s.options.some(([option]) => option === v) ? v : s.default;
  return typeof v === 'boolean' ? v : s.default;
};

export const getSetting = (key) => valueOf(SETTINGS.find((s) => s.key === key));
export const onSettingChange = (fn) => listeners.add(fn);

// Built-in themes are CSS blocks in theme.css; custom ones (made in the theme creator) are turned into CSS variables here.
export const BUILT_IN_THEMES = [['galacta', 'Galacta'], ['x-men', 'X-Men'], ['symbiote', 'Symbiote'], ['rivals', 'Rivals'], ['thebes', 'Thebes']];

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

// Everything else (muted text, borders, card colour...) is worked out from the four colours.
// A light background automatically gets the same fixes the Rivals theme has (dark title, inverted icons, dark popup dimming).
export function themeVars(t) {
  const { bg, surface, primary, text } = t.colors;
  const light = luminance(bg) > 0.5;
  const vars = {
    '--color-bg': bg,
    '--color-surface': surface,
    '--color-primary': primary,
    '--color-text': text,
    '--color-on-primary': luminance(primary) > 0.35 ? '#14141a' : '#ffffff',
    '--color-muted': `color-mix(in srgb, ${text} 60%, ${bg})`,
    '--color-border': `color-mix(in srgb, ${text} 20%, ${surface})`,
    '--color-card': `color-mix(in srgb, ${primary} 30%, ${surface})`,
    '--color-selected': `color-mix(in srgb, ${primary} 40%, ${surface})`,
    '--color-danger': light ? '#d62c4a' : '#ff5d73',
    '--radius': `${t.radius}px`,
  };
  if (light) {
    Object.assign(vars, {
      '--scheme': 'light', '--color-title': text, '--color-on-card': '#f6f6fb', '--color-scrim': '#000000',
      '--color-link': `color-mix(in srgb, ${primary} 55%, black)`, '--color-focus': text, '--icon-filter': 'invert(1)',
    });
  }
  if (t.image) {
    Object.assign(vars, {
      '--bg-image': `url("${t.image.replace(/"/g, '%22')}")`,
      '--bg-overlay': `color-mix(in srgb, ${bg} ${t.overlay}%, transparent)`,
      '--color-bar': `color-mix(in srgb, ${bg} 62%, transparent)`,
      '--bar-blur': 'blur(10px)',
    });
  }
  return vars;
}

let themeVarNames = [];
function applyTheme() {
  const root = document.documentElement;
  themeVarNames.forEach((k) => root.style.removeProperty(k));
  themeVarNames = [];
  const value = valueOf(SETTINGS.find((s) => s.key === 'theme'));
  const custom = store.get('customThemes').find((t) => `custom:${t.id}` === value);
  root.dataset.theme = custom ? 'custom' : (BUILT_IN_THEMES.some(([id]) => id === value) ? value : 'galacta');
  if (custom) {
    for (const [k, v] of Object.entries(themeVars(custom))) { root.style.setProperty(k, v); themeVarNames.push(k); }
  }
}

// Mirror every setting onto <html> so CSS can react without any JS
// Keep the browser's address-bar colour matching the theme (the stylesheet may not be ready yet at first, so also retry on load)
function syncThemeColor() {
  const color = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (color && meta) meta.content = color;
}
window.addEventListener('load', syncThemeColor);

function apply() {
  for (const s of SETTINGS) {
    if (s.picker) continue;   // the theme is applied below
    const v = valueOf(s);
    document.documentElement.dataset[s.key] = typeof v === 'boolean' ? (v ? 'on' : 'off') : v;
  }
  applyTheme();
  syncThemeColor();
}

export function setSetting(key, value) {
  store.set('settings', { ...store.get('settings'), [key]: value });
  apply();
  listeners.forEach((fn) => fn());
}

apply();