// Everything the user saves lives in ONE localStorage key, as a single "profile" object.
// That makes export / import / clear trivial: export = this object, import = replace it.
// Later sections (settings, themes, costume links) just become new keys on the same object.
const KEY = 'galactas-guide';
const VERSION = 1;
const IMAGE_KEYS = ['hero', 'prestige', 'silhouette', 'agent', 'lord', 'champion'];
const webUrl = (u) => (typeof u === 'string' && /^https?:\/\/\S+$/i.test(u) ? u : null);

const empty = () => ({ version: VERSION, progress: {}, saved: [], view: {}, settings: {}, customHeroes: [], costumes: {}, forms: {}, customThemes: [] });
const isNum = (n) => Number.isFinite(n);

// Validates + cleans a profile from storage or an imported file. Throws if it isn't one.
export function parse(raw) {
  if (!raw || typeof raw !== 'object' || !isNum(raw.version) || raw.version > VERSION) {
    throw new Error('Not a Galacta\'s Guide profile');
  }
  const out = empty();

  for (const [id, p] of Object.entries(raw.progress ?? {})) {
    if (isNum(Number(id)) && p && typeof p.rank === 'string') {
      out.progress[id] = { rank: p.rank, level: isNum(p.level) ? p.level : null, points: isNum(p.points) ? p.points : null };
    }
  }
  if (Array.isArray(raw.saved)) out.saved = raw.saved.filter(isNum);
  for (const [key, val] of Object.entries(raw.settings ?? {})) {
    if (typeof val === 'boolean' || typeof val === 'string') out.settings[key] = val;
  }

  // Custom heroes (added by the user): keep only well-formed ones, and only http(s) image links
  for (const h of Array.isArray(raw.customHeroes) ? raw.customHeroes : []) {
    if (!h || !isNum(h.id) || typeof h.name !== 'string' || !h.name.trim()) continue;
    const images = {};
    for (const key of IMAGE_KEYS) { const u = webUrl(h.images?.[key]); if (u) images[key] = u; }
    out.customHeroes.push({
      id: h.id,
      name: h.name.trim().slice(0, 40),
      color: typeof h.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(h.color) ? h.color : '#6e5a8a',
      difficulty: isNum(h.difficulty) ? h.difficulty : null,
      season: isNum(h.season) ? h.season : null,
      role: Array.isArray(h.role) ? h.role.filter((r) => typeof r === 'string') : [],
      images,
      // extra forms: each has a name and its own agent / lord / champion icon links
      extraForms: (Array.isArray(h.extraForms) ? h.extraForms : []).flatMap((f) => {
        if (!f || typeof f.name !== 'string') return [];
        const icons = {};
        for (const key of ['agent', 'lord', 'champion']) { const u = webUrl(f.images?.[key]); if (u) icons[key] = u; }
        return [{ name: f.name.trim().slice(0, 40) || 'Form', images: icons }];
      }),
    });
  }

  // Custom themes: a name, four colours, an optional background image, overlay strength and roundness
  const hex = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null);
  for (const t of Array.isArray(raw.customThemes) ? raw.customThemes : []) {
    const c = t?.colors ?? {};
    if (!t || typeof t.id !== 'string' || typeof t.name !== 'string' || !['bg', 'surface', 'primary', 'text'].every((k) => hex(c[k]))) continue;
    out.customThemes.push({
      id: t.id,
      name: t.name.trim().slice(0, 30) || 'Custom',
      colors: { bg: c.bg, surface: c.surface, primary: c.primary, text: c.text },
      image: webUrl(t.image) ?? '',
      overlay: isNum(t.overlay) ? Math.min(95, Math.max(0, t.overlay)) : 70,
      radius: isNum(t.radius) ? Math.min(24, Math.max(0, t.radius)) : 10,
    });
  }

  // Which form (1, 2, 3...) of a hero's icons is used; only forms above 1 are stored
  for (const [id, n] of Object.entries(raw.forms ?? {})) {
    if (isNum(Number(id)) && Number.isInteger(n) && n > 1) out.forms[id] = n;
  }

  // Costumes per hero id: { items: [{ id, name, rarity, images: { hero, agent? } }], equipped }
  for (const [heroId, c] of Object.entries(raw.costumes ?? {})) {
    if (!isNum(Number(heroId)) || !c || !Array.isArray(c.items)) continue;
    const items = c.items.flatMap((x) => {
      const hero = webUrl(x?.images?.hero);
      if (!x || typeof x.id !== 'string' || typeof x.rarity !== 'string' || !hero) return [];
      const agent = webUrl(x.images.agent);
      return [{ id: x.id, name: typeof x.name === 'string' ? x.name.trim().slice(0, 40) : '', rarity: x.rarity, images: { hero, ...(agent && { agent }) } }];
    });
    if (items.length) out.costumes[heroId] = { items, equipped: items.some((x) => x.id === c.equipped) ? c.equipped : null };
  }

  const v = raw.view ?? {};
  for (const [key, type] of Object.entries({ sort: 'string', asc: 'boolean', rank: 'string', tracked: 'string', savedOnly: 'boolean', source: 'string' })) {
    if (typeof v[key] === type) out.view[key] = v[key];
  }
  if (Array.isArray(v.roles)) out.view.roles = v.roles.filter((r) => typeof r === 'string');
  if (Array.isArray(v.rankFilter)) out.view.rankFilter = v.rankFilter.filter((r) => typeof r === 'string');
  return out;
}

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parse(JSON.parse(raw)) : empty();
  } catch {
    return empty();   // missing, corrupt, or storage blocked
  }
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); }
  catch (err) { console.warn('Could not save to localStorage', err); }   // still works for this session
}

let profile = read();

export const get = (section) => profile[section];
export const exportProfile = () => profile;
export function set(section, value) { profile[section] = value; write(); }
export function replace(cleaned) { profile = cleaned; write(); }
export function clear() {
  profile = empty();
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
}